import Phaser from 'phaser';
import { music } from '../music';
import { BUILDABLE_KINDS, CHARGE_CAP, CHARGE_PRICES } from '../../content/buildings';
import type { MissionDef } from '../../content/campaign';
import {
  campaignFor,
  defenseCatalogFor,
  FACTION_IDS,
  flavorFor,
  townMetaFor,
  type FactionId,
} from '../../content/factions';
import { TECHS, TECH_BY_ID } from '../../content/research';
import { activeSlot, clearSave, loadSlot, saveTown } from '../../meta/save';
import { runOfflineProbes } from '../../meta/warfare';
import { fileCode, openEntry, vaultOf, VAULT_CAP } from '../../meta/vault';
import { replayFingerprint, type ReplayKind } from '../../meta/replaycode';
import { contractsAt, contractsEndAt } from '../../content/contracts';
import { contractPay, contractState } from '../../meta/contracts';
import { COACH_KEYS } from '../../content/tutorial';
import { hasSeen, markSeen } from '../../meta/coach';
import { conditionAfter, conditionAt, conditionEndsAt } from '../../content/conditions';
import {
  leagueAt,
  seasonEnd,
  seasonNumber,
  DECAY_PER_DAY,
  LEAGUE_BY_ID,
} from '../../content/leagues';
import { dayOf, decayStartsAt, leagueOf, standingToNext } from '../../meta/ladder';
import {
  allWars,
  lineBars,
  lineTrend,
  serviceRecord,
  warDay,
  type ServiceRecord,
} from '../../meta/record';
import { audio } from '../audio';
import { loadSettings } from '../settings';
import {
  applyCounterResult,
  applyMissionResult,
  applySiegeResult,
  buildSpeedFactor,
  counterattackConfig,
  buyCharge,
  canPlace,
  canPlaceWall,
  canResearch,
  caps,
  ccLevel,
  countOf,
  footprintCells,
  gating,
  hasRadar,
  isUnlocked,
  missionConfig,
  move,
  newTown,
  place,
  placeWall,
  ratesPerMinute,
  removeWall,
  repairCost,
  repairWreck,
  sell,
  siegeConfig,
  startResearch,
  structureAt,
  tick,
  unlockAll,
  upgrade,
  upgradeError,
  wallAt,
  TOWN_GRID,
  type PlacedStructure,
  type SiegeOutcome,
  type TownState,
} from '../../meta/town';
import { STANDING_ORDER_IDS, type StandingOrdersId } from '../../content/standingOrders';
import { BoardView } from '../BoardView';
import { drawFieldBase, drawStructureGlyph, drawWallGlyph } from '../glyphs';
import { layoutOf, onLayoutChange, type Layout } from '../layout';
import { Overlay } from '../overlay';
import { buildSettings } from '../settingsOverlay';
import { closeTextBox, setTextBoxStatus, showTextBox } from '../textbox';
import {
  baseFromShare,
  cleanName,
  codeFingerprint,
  decodeBase,
  encodeBase,
  type ShareError,
} from '../../meta/sharecode';
import { COLORS } from '../palette';
import { mono, Panel, type PanelRow } from '../ui';
import type { BattleTag } from './SiegeScene';

/** Which mission grants each locked key — for "LOCKED (M4)" labels. */
/** What went wrong with a pasted code, in words a player can act on. */
const SHARE_ERRORS: Record<ShareError, string> = {
  empty: 'Nothing pasted yet.',
  characters: 'That does not look like a code — check for missing characters.',
  truncated: 'The code is cut short. Copy the whole thing.',
  checksum: 'The code is damaged in transit. Ask for it again.',
  version: 'That code came from a different version of the game.',
  content: 'The code decoded to something that is not a base.',
};

const UNLOCK_MISSION: Record<FactionId, Record<string, number>> = {
  usa: {},
  china: {},
  russia: {},
  nk: {},
  un: {},
};
for (const faction of FACTION_IDS) {
  for (const mission of campaignFor(faction)) {
    for (const key of mission.unlocks) UNLOCK_MISSION[faction][key] = mission.index;
  }
}

const CELL = 32;

/** Panel tabs: five categories instead of one twenty-row rail. */
const TABS = [
  { id: 'build', label: 'BUILD' },
  { id: 'base', label: 'BASE' },
  { id: 'ops', label: 'OPS' },
  { id: 'war', label: 'WAR' },
  { id: 'sys', label: 'SYS' },
];

type Tool =
  | { type: 'select' }
  | { type: 'build'; kind: string }
  | { type: 'wall' }
  | { type: 'erase' }
  | { type: 'move'; id: number };

/**
 * The persistent base between battles (M2): build and upgrade the economy,
 * shape the wall maze, stock ordnance, and launch the next assault on the
 * ladder. This layout IS the battlefield the siege inherits.
 */
export class TownScene extends Phaser.Scene {
  private town!: TownState;
  private tool: Tool = { type: 'select' };
  private selectedId: number | null = null;
  private demoMode = false;
  /** Which war slot `this.town` came from; -1 until one is loaded. */
  private loadedSlot = -1;
  private saveTimer = 0;
  private banner = '';
  private bannerTtl = 0;
  private resetArmedUntil = 0;
  private lastPaintedCell = -1;

  private dynLayer!: Phaser.GameObjects.Graphics;
  private staticLayer!: Phaser.GameObjects.Graphics;
  private ccLabel!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private board!: BoardView;
  private panel!: Panel;
  private layout!: Layout;
  private drawerOpen = true;
  /** Research project id seen last frame — completion flips it to a banner. */
  private lastActiveResearch: string | null = null;
  private overlay: Overlay | null = null;
  /** How to rebuild the open overlay after the viewport changes. */
  private overlayBuilder: (() => void) | null = null;
  /** Which of today's orders had paid out last frame — the banner watches it. */
  private paidOrders: boolean[] = [];

  constructor() {
    super('town');
  }

  init(data: { outcome?: SiegeOutcome; battle?: BattleTag }): void {
    const now = Date.now();
    this.demoMode = new URLSearchParams(window.location.search).get('demo') === 'town';

    if (this.demoMode) {
      this.town = makeShowcaseTown(now);
    } else if (!this.town || this.loadedSlot !== activeSlot()) {
      // The scene instance outlives scene.start, so a cached town would follow
      // the player from one war slot into another. Reload when the slot moves.
      this.loadedSlot = activeSlot();
      const town = loadSlot(this.loadedSlot, now);
      const away = now - town.lastSeen;
      // Probes hit BEFORE accrual: the war didn't pause while you were gone.
      const probes = runOfflineProbes(town, now);
      const before = Math.floor(town.supplies + town.fuel);
      const settlement = tick(town, now);
      const placed = settlement.payout.supplies + settlement.payout.fuel;
      const gained = Math.floor(town.supplies + town.fuel) - before - placed;
      if (settlement.placement) {
        // A closed season outranks everything else that happened while away.
        const record = settlement.placement;
        const paid = [
          settlement.payout.supplies > 0 ? `+${settlement.payout.supplies} SUP` : '',
          settlement.payout.fuel > 0 ? `+${settlement.payout.fuel} FUEL` : '',
          settlement.payout.intel > 0 ? `+${settlement.payout.intel} INT` : '',
        ].filter(Boolean).join(' ');
        this.setBanner(
          `SEASON ${seasonNumber(record.season)} CLOSED — PLACED ${LEAGUE_BY_ID[record.league].label}` +
            ` AT ${record.peak} PTS. ${paid || 'NO PLACEMENT PAY AT THIS BAND.'}`,
          18,
        );
        saveTown(town);
      } else if (probes.length > 0) {
        const held = probes.filter((p) => p.held).length;
        const taken = probes.reduce((n, p) => n + p.suppliesLost + p.fuelLost, 0);
        this.setBanner(
          `${probes.length} PROBE${probes.length > 1 ? 'S' : ''} WHILE AWAY — ` +
            `${held} HELD, ${probes.length - held} BREACHED` +
            (taken > 0 ? `, −${taken} RESOURCES` : '') +
            '. SEE THE LOG.',
          16,
        );
        saveTown(town);
      } else if (away > 5 * 60_000 && gained > 0) {
        this.setBanner(`WHILE YOU WERE GONE: +${gained} RESOURCES ACCRUED`, 12);
      }
      this.town = town;
    }

    if (data?.outcome && !this.demoMode) {
      const mission =
        data.battle?.type === 'mission'
          ? this.missions().find((m) => m.id === (data.battle as { missionId: string }).missionId)
          : undefined;
      if (mission) {
        const result = applyMissionResult(this.town, mission, data.outcome, now);
        if (result.victory) {
          const parts = [`M${mission.index + 1} ${mission.codename}: SECTOR HELD.`];
          parts.push(
            `+${result.rewardSupplies} SUP${result.rewardFuel > 0 ? ` +${result.rewardFuel} FUEL` : ''}` +
              (result.bonusAchieved ? ' (BONUS ×1.5)' : ''),
          );
          if (result.unlocked.length > 0 && mission.unlockNote) parts.push(mission.unlockNote);
          if (this.town.campaign.next >= this.missions().length) {
            parts.push('CAMPAIGN COMPLETE — THE FRONT LINE RUNS BOTH WAYS NOW.');
          }
          this.setBanner(parts.join(' '), 16);
        } else {
          this.setBanner(
            `M${mission.index + 1} ${mission.codename}: THE LINE BROKE. RAIDERS TOOK THEIR CUT.`,
            14,
          );
        }
      } else if (data.battle?.type === 'counter') {
        applyCounterResult(this.town, data.outcome, now);
        this.setBanner(
          (data.outcome.victory
            ? 'COUNTERATTACK REPELLED — THE FRONT LINE HOLDS. BOUNTY PAID.'
            : 'THE COUNTERATTACK BROKE THROUGH. RAIDERS TOOK THEIR CUT.') +
            ` STANDING ${this.town.frontline.standing} · ${leagueOf(this.town).label}.`,
          14,
        );
      } else {
        const levelFought = this.town.assaultLevel;
        applySiegeResult(this.town, data.outcome, now);
        this.setBanner(
          data.outcome.victory
            ? `SKIRMISH LV ${levelFought} REPELLED. LOOT SECURED.`
            : `SKIRMISH LOST — RAIDERS TOOK THEIR CUT. REBUILD AND DIG IN.`,
          14,
        );
      }
      saveTown(this.town);
    }
  }

  create(): void {
    music.play('quiet');
    this.tool = { type: 'select' };
    this.selectedId = null;
    this.lastPaintedCell = -1;
    this.overlay = null;

    // The board lives on its own camera: pinch to zoom, drag to pan.
    this.board = new BoardView(this, {
      cols: TOWN_GRID.width,
      rows: TOWN_GRID.height,
      cell: CELL,
    });
    this.staticLayer = this.add.graphics();
    drawFieldBase(this.staticLayer, TOWN_GRID.width, TOWN_GRID.height, CELL, TOWN_GRID.spawnColumn);
    this.dynLayer = this.add.graphics();
    this.board.world.add([this.staticLayer, this.dynLayer]);

    const cc = this.town.structures.find((s) => s.kind === 'cc')!;
    const ccCenter = this.cellCenterPx(cc.cell, 2);
    this.ccLabel = this.add
      .text(ccCenter.x, ccCenter.y, 'CC', mono(13, COLORS.ink, { fontStyle: 'bold' }))
      .setOrigin(0.5);
    this.board.world.add(this.ccLabel);

    this.panel = new Panel(this, this.board.ui, TABS);
    this.panel.onDrawerToggle = () => {
      this.drawerOpen = !this.drawerOpen;
      this.applyLayout();
    };
    this.bannerText = this.add.text(0, 0, '', mono(11, COLORS.signal));
    this.board.ui.add(this.bannerText);

    this.applyLayout();
    this.focusBase();
    onLayoutChange(this, () => this.applyLayout());
    this.bindInput();

    if (!this.demoMode && this.town.campaign.difficulty === null)
      this.openOverlay(() => this.showIntro());
  }

  /** Frame the built-up part of the base rather than the whole empty grid. */
  private focusBase(): void {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const note = (cell: number, span: number): void => {
      const cx = cell % TOWN_GRID.width;
      const cy = Math.floor(cell / TOWN_GRID.width);
      minX = Math.min(minX, cx);
      minY = Math.min(minY, cy);
      maxX = Math.max(maxX, cx + span);
      maxY = Math.max(maxY, cy + span);
    };
    for (const s of this.town.structures) note(s.cell, footprintOf(s.kind));
    for (const w of this.town.walls) note(w.cell, 1);
    if (!Number.isFinite(minX)) {
      this.board.fit();
      return;
    }
    this.board.focusOn(
      minX * CELL,
      minY * CELL,
      (maxX - minX) * CELL,
      (maxY - minY) * CELL,
      this.layout.mode === 'portrait' ? 1 : 2,
    );
  }

  /** Re-flow for the current viewport (orientation flip, resize, drawer). */
  /**
   * Open an overlay, remembering how to build it. A viewport change (rotation,
   * the URL bar sliding away, a desktop resize) closes and replays this
   * instead of losing the screen the player was reading.
   */
  private openOverlay(build: () => void): void {
    this.overlay?.close();
    this.overlay = null;
    this.overlayBuilder = build;
    build();
  }

  private applyLayout(): void {
    this.layout = layoutOf(this, this.drawerOpen);
    this.board.applyLayout(this.layout, true);
    this.panel.applyLayout(this.layout);
    const { board, pad, font } = this.layout;
    this.bannerText
      .setPosition(board.x + pad, board.y + board.h - pad - font.tiny * 2)
      .setFontSize(font.tiny)
      .setWordWrapWidth(board.w - pad * 2);
    // An open overlay was laid out for the old viewport; rebuild it at the
    // new one rather than dumping the player back to the board.
    if (this.overlay && this.overlayBuilder) {
      const rebuild = this.overlayBuilder;
      this.overlay.close();
      this.overlay = null;
      rebuild();
    }
  }

  /** The active faction's campaign, building meta, and unlock map. */
  private missions(): MissionDef[] {
    return campaignFor(this.town.faction);
  }

  private meta(kind: string) {
    return townMetaFor(this.town.faction)[kind];
  }

  private unlockAt(key: string): number | undefined {
    return UNLOCK_MISSION[this.town.faction][key];
  }

  // ---- input -------------------------------------------------------------------

  private bindInput(): void {
    this.input.keyboard?.removeAllListeners();

    // Taps place and select; wall tools paint across a drag (see paintMode).
    this.board.onTap((col, row) => this.handleCell(row * TOWN_GRID.width + col, true));
    this.board.onPaint((col, row) => this.handleCell(row * TOWN_GRID.width + col, false));
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) this.setTool({ type: 'select' });
    });

    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', () => this.setTool({ type: 'select' }));
    kb?.on('keydown-SPACE', () => this.launchPrimary());
    kb?.on('keydown-F', () => this.openFrontline());
    kb?.on('keydown-T', () => this.openOverlay(() => this.showResearch()));
    kb?.on('keydown-M', () => this.openOverlay(() => this.showMissions()));
  }

  private handleCell(cell: number, isTap: boolean): void {
    if (this.overlay) return;
    const now = Date.now();

    switch (this.tool.type) {
      case 'select': {
        if (!isTap) return;
        const s = structureAt(this.town, cell);
        this.selectedId = s ? s.id : null;
        // Inspecting jumps to the card that describes what you just tapped.
        if (s) this.panel.setTab('base');
        return;
      }
      case 'build': {
        if (!isTap) return;
        if (place(this.town, this.tool.kind, cell, now)) this.saveSoon();
        return;
      }
      case 'wall': {
        if (cell === this.lastPaintedCell && !isTap) return;
        this.lastPaintedCell = cell;
        // Pass the clock: without it the segment is credited against
        // whatever day lastSeen happens to hold, and wire laid just after
        // midnight would count towards a sheet that is already discarded.
        if (placeWall(this.town, cell, Date.now())) this.saveSoon();
        return;
      }
      case 'erase': {
        if (cell === this.lastPaintedCell && !isTap) return;
        this.lastPaintedCell = cell;
        if (removeWall(this.town, cell)) this.saveSoon();
        return;
      }
      case 'move': {
        if (!isTap) return;
        if (move(this.town, this.tool.id, cell)) {
          this.setTool({ type: 'select' });
          this.saveSoon();
        }
        return;
      }
    }
  }

  private setTool(tool: Tool): void {
    // Tapping the armed tool's button again returns to select — the
    // touch-device stand-in for right-click/ESC.
    if (
      tool.type !== 'select' &&
      tool.type !== 'move' &&
      tool.type === this.tool.type &&
      ('kind' in tool ? tool.kind : null) === ('kind' in this.tool ? this.tool.kind : null)
    ) {
      tool = { type: 'select' };
    }
    this.tool = tool;
    // Wall painting owns the drag; every other tool leaves it to the camera.
    this.board.paintMode = tool.type === 'wall' || tool.type === 'erase';
    this.lastPaintedCell = -1;
  }

  private nextMission(): MissionDef | null {
    return this.missions()[this.town.campaign.next] ?? null;
  }

  /**
   * True once, on the first battle this commander ever fights, and marked as
   * spent immediately. Quitting a coached siege still counts as having been
   * shown it — the alternative is re-teaching someone who walked away.
   */
  private claimCoach(): boolean {
    if (this.demoMode || hasSeen(this.town, COACH_KEYS.firstSiege)) return false;
    markSeen(this.town, COACH_KEYS.firstSiege);
    saveTown(this.town);
    return true;
  }

  private launchMission(): void {
    this.launchMissionAt(this.nextMission());
  }

  /** Launch any unlocked mission — the next one, or a cleared one to replay. */
  private launchMissionAt(mission: MissionDef | null): void {
    if (this.demoMode || !mission || this.town.campaign.difficulty === null) return;
    saveTown(this.town);
    this.scene.start('briefing', {
      mission,
      config: missionConfig(this.town, mission, Date.now() >>> 0),
      faction: this.town.faction,
      ...(this.claimCoach() ? { coach: true } : {}),
    });
  }

  /** Mission select: the war so far — replay cleared sectors, fight the next. */
  /** One overlay entry: a text block plus an optional action button.
   * Stacks on phones, sits side-by-side when there is room. */
  private overlayEntry(
    ov: Overlay,
    text: string,
    color: number,
    action?: { label: string; onTap: () => void; enabled?: boolean },
  ): void {
    const { rowH, gap, font, compact, px } = this.layout;
    if (compact || !action) {
      ov.paragraph(text, font.body, color, {
        gapAfter: action ? Math.round(gap / 2) : gap,
      });
      if (action) {
        const b = ov.button(ov.flow(rowH), action.label, action.onTap);
        if (action.enabled === false) b.setEnabled(false);
      }
      return;
    }
    const btnW = px(150);
    const t = ov.paragraph(text, font.body, color, {
      width: ov.card.w - btnW - gap,
      minHeight: rowH,
    });
    const b = ov.button(
      { x: ov.card.x + ov.card.w - btnW, y: t.y, w: btnW, h: rowH },
      action.label,
      action.onTap,
    );
    if (action.enabled === false) b.setEnabled(false);
  }

  private showMissions(): void {
    if (this.overlay || this.demoMode) return;
    const ov = new Overlay(this, this.layout, {
      title: 'OPERATIONS MAP',
      subtitle: 'Replays of held sectors pay 35% of the original requisition.',
      container: this.board.ui,
    });
    this.overlay = ov;
    const close = (): void => {
      ov.close();
      this.overlay = null;
      this.overlayBuilder = null;
    };
    const next = this.town.campaign.next;
    this.missions().forEach((mission, i) => {
      const cleared = this.town.campaign.completed.includes(mission.id);
      const isNext = i === next;
      const starred = this.town.campaign.bonuses.includes(mission.id);
      const status = cleared
        ? `SECTOR HELD${starred ? ' ★' : ''}`
        : isNext
          ? 'NEXT OBJECTIVE'
          : 'NO CONTACT YET';
      this.overlayEntry(
        ov,
        `M${mission.index + 1}  ${mission.codename}\n${status}`,
        cleared ? COLORS.olive : isNext ? COLORS.signal : COLORS.inkDim,
        cleared || isNext
          ? {
              label: cleared ? 'REPLAY' : 'FIGHT',
              onTap: () => {
                close();
                this.launchMissionAt(mission);
              },
            }
          : undefined,
      );
    });
    ov.footer('CLOSE', close);
  }

  /** The research board: three doctrines, one project at a time. */
  private showResearch(): void {
    if (this.overlay || this.demoMode) return;
    const radar = hasRadar(this.town);
    const ov = new Overlay(this, this.layout, {
      title: 'RESEARCH & DOCTRINE',
      subtitle: radar
        ? `INTEL ${Math.floor(this.town.intel)} · one project at a time`
        : 'A SIGNALS STATION MUST STAND TO RUN THE PROGRAM',
      container: this.board.ui,
    });
    this.overlay = ov;
    const close = (): void => {
      ov.close();
      this.overlay = null;
      this.overlayBuilder = null;
    };
    const branchHeaders: Record<string, string> = {
      fortify: 'FORTIFY — the wire holds',
      strike: 'STRIKE — the raids bite',
      logistics: 'LOGISTICS — the war runs',
    };
    let lastBranch = '';
    for (const tech of TECHS) {
      if (tech.branch !== lastBranch) {
        lastBranch = tech.branch;
        ov.text(
          ov.flow(Math.round(this.layout.font.label * 1.4)),
          branchHeaders[tech.branch]!,
          this.layout.font.label,
          COLORS.intel,
          { fontStyle: 'bold' },
        );
      }
      const err = canResearch(this.town, tech.id);
      const done = this.town.research.completed.includes(tech.id);
      const active = this.town.research.active?.id === tech.id;
      const sub = done
        ? 'IN DOCTRINE'
        : active
          ? 'IN PROGRESS'
          : err === 'prereq'
            ? 'REQUIRES THE PREVIOUS DOCTRINE'
            : `${tech.intel} INTEL · ${tech.seconds}s`;
      this.overlayEntry(
        ov,
        `${tech.name} — ${tech.desc}\n${sub}`,
        done ? COLORS.olive : active ? COLORS.signal : COLORS.ink,
        !done && !active
          ? {
              label: 'START',
              enabled: err === null,
              onTap: () => {
                if (startResearch(this.town, tech.id, Date.now())) {
                  saveTown(this.town);
                  audio.sfx('radio');
                  this.setBanner(`RESEARCH STARTED: ${tech.name.toUpperCase()}`, 8);
                  close();
                }
              },
            }
          : undefined,
      );
    }
    ov.footer('CLOSE', close);
  }

  private skirmishUnlocked(): boolean {
    return this.town.campaign.next >= 2 || this.town.campaign.next >= this.missions().length;
  }

  private launchSkirmish(): void {
    if (this.demoMode || !this.skirmishUnlocked()) return;
    saveTown(this.town);
    this.scene.start('siege', {
      config: siegeConfig(this.town, Date.now() >>> 0),
      fromTown: true,
      battle: { type: 'skirmish' },
      faction: this.town.faction,
      ...(this.claimCoach() ? { coach: true } : {}),
    });
  }

  private launchPrimary(): void {
    if (this.town.frontline.pendingCounterattack) this.launchCounterattack();
    else if (this.nextMission()) this.launchMission();
    else this.launchSkirmish();
  }

  private launchCounterattack(): void {
    if (this.demoMode || !this.town.frontline.pendingCounterattack) return;
    saveTown(this.town);
    this.scene.start('siege', {
      config: counterattackConfig(this.town, Date.now() >>> 0),
      fromTown: true,
      battle: { type: 'counter' },
      faction: this.town.faction,
      ...(this.claimCoach() ? { coach: true } : {}),
    });
  }

  private openFrontline(): void {
    if (this.demoMode || !isUnlocked(this.town, 'frontline')) return;
    if (this.town.frontline.pendingCounterattack) {
      this.launchCounterattack();
      return;
    }
    saveTown(this.town);
    this.scene.start('raid', { town: this.town });
  }

  /** Defense log overlay: offline probe history with replays. */
  private showDefenseLog(): void {
    if (this.overlay) return;
    const ov = new Overlay(this, this.layout, {
      title: 'DEFENSE LOG',
      subtitle: 'Probes fought while you were away.',
      container: this.board.ui,
    });
    this.overlay = ov;
    const close = (): void => {
      ov.close();
      this.overlay = null;
      this.overlayBuilder = null;
    };
    if (this.town.defenseLog.length === 0) {
      ov.centered(
        ov.flow(Math.round(this.layout.font.body * 2)),
        'No probes on record. The wire has been quiet.',
        this.layout.font.body,
        COLORS.inkDim,
      );
    }
    for (const entry of this.town.defenseLog) {
      const when = new Date(entry.at).toISOString().slice(5, 16).replace('T', ' ');
      this.overlayEntry(
        ov,
        `${when}Z · PROBE LV ${entry.level} — ${entry.held ? 'HELD' : 'BREACHED'}` +
          `${!entry.held && entry.killer ? ` (CC LOST TO ${entry.killer.toUpperCase()})` : ''}` +
          `\n−${entry.suppliesLost} SUP · −${entry.fuelLost} FUEL` +
          `${entry.orders ? ` · ORDERS: ${entry.orders.toUpperCase()}` : ''}`,
        entry.held ? COLORS.olive : COLORS.alarm,
        {
          label: 'WATCH',
          onTap: () => {
            close();
            this.scene.start('replay', {
              config: entry.config,
              kind: 'defense',
              title: `PROBE LV ${entry.level}`,
              faction: this.town.faction,
              backTo: 'town',
            });
          },
        },
      );
    }
    ov.footer('CLOSE', close);
  }

  /**
   * The board: standing, the band it buys, what it costs to keep, and the
   * condition the front is fighting under today.
   */
  /** A section rule inside the record: a heading with air above it. */
  private recordSection(ov: Overlay, title: string): void {
    const { font, gap } = this.layout;
    // The air is the rule. A record is a wall of numbers; without a gap the
    // sections read as one paragraph and the headings stop doing any work.
    ov.flow(Math.round(gap / 2), 0);
    ov.paragraph(title, font.body, COLORS.olive, { gapAfter: Math.round(gap / 2) });
  }

  /**
   * The service record (v1.10). Almost none of this is new — the ladder, the
   * campaign, the town and the squad roster have been accumulating it since
   * v0.2. It simply had nowhere to be read, which meant a long war left no
   * trace of itself anywhere the commander could look.
   */
  /** How long ago, in the terse way the rest of the game says it. */
  private static agoLabel(ms: number): string {
    if (ms < 3_600_000) return `${Math.max(1, Math.round(ms / 60_000))}m ago`;
    if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
    return `${Math.round(ms / 86_400_000)}d ago`;
  }

  /**
   * The vault (v1.11): the last ten hands-off battles, each one still
   * watchable and each one a code you can hand to somebody else.
   *
   * Live sieges are deliberately absent. A raid, a duel and an offline probe
   * resolve from their config, so re-running it IS the battle; a siege you
   * fought yourself was made of commands the config never held, and a
   * "replay" of one would be a battle nobody fought.
   */
  /**
   * Today's standing orders (v1.12).
   *
   * There is nothing to claim here. A contract pays the instant it finishes,
   * because this is a game built to be left alone for a day and a reward that
   * expires because nobody tapped it punishes exactly that. The screen is for
   * reading what today asks, not for collecting a debt.
   */
  private showContracts(): void {
    if (this.overlay) return;
    const now = Date.now();
    const today = contractsAt(now);
    const state = contractState(this.town, now);
    const done = state.paid.filter(Boolean).length;
    const ov = new Overlay(this, this.layout, {
      title: 'DAY ORDERS',
      subtitle: `${done} of ${today.length} filled · new orders in ${untilLabel(
        contractsEndAt(now) - now,
      )}`,
      container: this.board.ui,
    });
    this.overlay = ov;
    const { font, gap } = this.layout;

    today.forEach((contract, i) => {
      const at = Math.min(contract.goal, state.progress[i] ?? 0);
      const paid = state.paid[i] === true;
      const pay = state.pay[i] ?? contractPay(this.town, contract);
      ov.paragraph(
        `${contract.label} — ${paid ? 'FILLED' : `${at}/${contract.goal}`}`,
        font.body,
        paid ? COLORS.olive : COLORS.ink,
        { gapAfter: Math.round(gap / 4) },
      );
      ov.paragraph(contract.brief, font.tiny, COLORS.inkDim, {
        gapAfter: Math.round(gap / 4),
      });
      ov.paragraph(
        `${paid ? 'PAID' : 'PAYS'} +${pay.supplies} SUP · +${pay.fuel} FUEL · +${pay.intel} INT`,
        font.tiny,
        paid ? COLORS.olive : COLORS.inkDim,
        { gapAfter: gap },
      );
    });

    ov.paragraph(
      'Three a day — one on the front, one at home behind the wire, one in ' +
        'the yard — and they pay the moment they are filled, not when you ' +
        'come back to collect. The rate is your band on the board. Orders ' +
        'never pay standing: that is the one number that falls on its own, ' +
        'and a daily faucet of it would quietly undo the whole board.',
      font.tiny,
      COLORS.inkDim,
      { center: true },
    );

    ov.footer('CLOSE', () => {
      ov.close();
      this.overlay = null;
      this.overlayBuilder = null;
    });
  }

  /**
   * Contracts are filled deep in the meta layer — mid-raid, mid-probe — so
   * the town notices by WATCHING the sheet rather than by being told. A
   * completion that happened during a raid surfaces the moment you are back
   * in the base, which is when it is worth reading.
   */
  private checkContracts(now: number): void {
    const state = contractState(this.town, now);
    if (this.paidOrders.length !== state.paid.length) {
      this.paidOrders = [...state.paid];
      return;
    }
    const today = contractsAt(now);
    state.paid.forEach((paid, i) => {
      if (!paid || this.paidOrders[i]) return;
      const contract = today[i];
      const pay = state.pay[i];
      if (!contract || !pay) return;
      this.setBanner(
        `ORDER FILLED — ${contract.label}  +${pay.supplies} SUP  +${pay.fuel} FUEL  +${pay.intel} INT`,
        6,
      );
      audio.sfx('radio');
    });
    this.paidOrders = [...state.paid];
  }

  private showVault(): void {
    if (this.overlay) return;
    const now = Date.now();
    const vault = vaultOf(this.town);
    const ov = new Overlay(this, this.layout, {
      title: 'REPLAY VAULT',
      subtitle:
        vault.length > 0
          ? `${vault.length} of the last ${VAULT_CAP} battles`
          : 'Nothing fought yet',
      container: this.board.ui,
    });
    this.overlay = ov;
    const { font, gap, rowH } = this.layout;
    const close = (): void => {
      ov.close();
      this.overlay = null;
      this.overlayBuilder = null;
    };

    if (vault.length === 0) {
      ov.paragraph(
        'Raids, code duels and the probes fought while you were away are ' +
          'filed here as you fight them. A live siege is not: what you place ' +
          'during one is a command, not part of the battle plan, so there is ' +
          'nothing to re-run.',
        font.body,
        COLORS.inkDim,
        { center: true },
      );
    }

    const KIND_LABEL: Record<ReplayKind, string> = {
      raid: 'RAID',
      duel: 'DUEL',
      probe: 'DEFENSE',
    };
    for (const entry of vault) {
      const outcomeWord = entry.won ? (entry.kind === 'probe' ? 'HELD' : 'TAKEN') : 'LOST';
      this.overlayEntry(
        ov,
        `${KIND_LABEL[entry.kind]} · ${entry.title}\n` +
          `${outcomeWord} · ${entry.detail || '—'} · ${TownScene.agoLabel(Math.max(0, now - entry.at))}`,
        entry.won ? COLORS.olive : COLORS.ink,
        {
          label: 'WATCH',
          onTap: () => {
            const replay = openEntry(entry);
            if (!replay) return;
            close();
            this.scene.start('replay', {
              config: replay.config,
              // The viewer only knows two camera stories: your army going in,
              // or something coming at your town.
              kind: replay.kind === 'probe' ? 'defense' : 'raid',
              title: replay.title,
              faction: replay.faction,
              backTo: 'town',
              backData: { town: this.town },
            });
          },
        },
      );
      // The code is what the entry IS, so handing it over costs nothing.
      const b = ov.button(
        { x: ov.card.x, y: ov.flow(rowH, gap).y, w: ov.card.w, h: rowH },
        `COPY CODE · ${replayFingerprint(entry.code)}`,
        () => {
          showTextBox({
            title: `${KIND_LABEL[entry.kind]} — ${entry.title}`,
            note:
              'The whole battle, as a string. Anyone who pastes it watches ' +
              'exactly the fight you did — same seed, same walls, same ' +
              'result. It changes nothing on their front line.',
            value: entry.code,
            readOnly: true,
          });
        },
      );
      b.setFont(font.body);
    }

    ov.footer(
      'WATCH A CODE',
      () => {
        showTextBox({
          title: 'WATCH A PASTED BATTLE',
          note:
            'Paste a replay code. It is filed in your vault and plays back ' +
            'exactly as it was fought — nothing of yours is risked.',
          confirm: 'WATCH IT',
          onConfirm: (value) => {
            const filed = fileCode(this.town, value, Date.now());
            if (!filed.ok) {
              setTextBoxStatus(
                filed.error === 'duplicate'
                  ? 'That battle is already in your vault.'
                  : 'That does not read as a replay code.',
              );
              return;
            }
            closeTextBox();
            saveTown(this.town);
            close();
            this.scene.start('replay', {
              config: filed.replay.config,
              kind: filed.replay.kind === 'probe' ? 'defense' : 'raid',
              title: filed.replay.title,
              faction: filed.replay.faction,
              backTo: 'town',
              backData: { town: this.town },
            });
          },
        });
      },
      0,
      2,
    );
    ov.footer('CLOSE', close, 1, 2);
  }

  private showRecord(): void {
    if (this.overlay) return;
    const now = Date.now();
    const r: ServiceRecord = serviceRecord(this.town, now);
    const ov = new Overlay(this, this.layout, {
      title: 'SERVICE RECORD',
      subtitle: `${r.army} · DAY ${r.day}`,
      container: this.board.ui,
    });
    this.overlay = ov;
    const { font, gap, px } = this.layout;
    const line = (text: string, color = COLORS.ink): void => {
      ov.paragraph(text, font.body, color, { gapAfter: Math.round(gap / 2) });
    };

    // ---- the standing line ------------------------------------------------
    const trend = lineTrend(r.line);
    this.recordSection(ov, `THE BOARD — ${r.league.label}`);
    ov.chart(lineBars(r.line), px(46), { gapAfter: Math.round(gap / 2) });
    line(
      `${r.line.length} day${r.line.length === 1 ? '' : 's'} of standing · ` +
        `now ${r.standing} · peak ${r.peak} · ` +
        (trend === 'up' ? 'CLIMBING' : trend === 'down' ? 'SLIPPING' : 'HOLDING'),
      trend === 'down' ? COLORS.alarm : COLORS.inkDim,
    );
    line(
      `Tier ${r.tier} on the Front Line · best band held: ${r.bestLeague.label}`,
      COLORS.inkDim,
    );

    // ---- what it has taken -------------------------------------------------
    this.recordSection(ov, 'THE OFFENSE');
    line(
      `Raids launched ${r.raids} · posts taken ${r.postsTaken}` +
        (r.duelsWon > 0 ? ` · codes beaten ${r.duelsWon}` : ''),
    );
    line(`Men lost ${r.menLost}`, r.menLost > 0 ? COLORS.alarm : COLORS.inkDim);
    for (const f of r.formations) {
      line(
        `${f.name.padEnd(9)} ${f.rank.short.padEnd(4)} ` +
          `${f.record.raids}R · ${f.record.clears}C · ${f.record.lost} lost`,
        COLORS.inkDim,
      );
    }

    // ---- what it has cost --------------------------------------------------
    this.recordSection(ov, 'THE DEFENSE');
    line(`Battles won ${r.battlesWon} · lost ${r.battlesLost}`);
    line(`Heaviest assault turned back: level ${r.assaultLevel}`, COLORS.inkDim);
    line(
      `While you were away: ${r.probesHeld} probe${r.probesHeld === 1 ? '' : 's'} held, ` +
        `${r.probesBreached} through`,
      r.probesBreached > 0 ? COLORS.alarm : COLORS.inkDim,
    );

    // ---- the long game -----------------------------------------------------
    this.recordSection(ov, 'THE LONG GAME');
    line(`Missions completed ${r.missions} · technologies ${r.research}`, COLORS.inkDim);
    if (r.seasons.length > 0) {
      for (const season of r.seasons) {
        line(
          `Season ${seasonNumber(season.season)} — ` +
            `${LEAGUE_BY_ID[season.league]?.label ?? season.league} at ${season.peak}`,
          COLORS.inkDim,
        );
      }
    } else {
      line('No season has closed on this war yet.', COLORS.inkDim);
    }

    // ---- the other wars ----------------------------------------------------
    const others = allWars().filter((w) => w.slot !== activeSlot());
    if (others.length > 0) {
      this.recordSection(ov, 'OTHER WARS');
      for (const war of others) {
        line(
          `${war.slot} · ${war.army} — tier ${war.tier}, ${war.league.label}, ` +
            `${war.battlesWon} won`,
          COLORS.inkDim,
        );
      }
    }

    ov.footer('CLOSE', () => {
      ov.close();
      this.overlay = null;
      this.overlayBuilder = null;
    });
  }

  private showLeague(): void {
    if (this.overlay) return;
    const now = Date.now();
    const fl = this.town.frontline;
    const league = leagueOf(this.town);
    const toNext = standingToNext(this.town);
    const condition = conditionAt(now);
    const ov = new Overlay(this, this.layout, {
      title: `THE BOARD — ${league.label}`,
      subtitle: league.blurb,
      container: this.board.ui,
    });
    this.overlay = ov;
    const close = (): void => {
      ov.close();
      this.overlay = null;
      this.overlayBuilder = null;
    };

    const decayAt = decayStartsAt(this.town);
    const bleeding = now >= decayAt;
    this.overlayEntry(
      ov,
      `STANDING ${fl.standing}  ·  PEAK ${fl.peak}` +
        `${toNext === null ? '  ·  TOP OF THE BOARD' : `  ·  ${toNext} TO NEXT BAND`}` +
        `\nLadder loot ×${league.loot.toFixed(2)}` +
        `${league.probePressure > 0 ? `  ·  probes +${league.probePressure} level${league.probePressure > 1 ? 's' : ''}` : '  ·  no extra probe pressure'}`,
      COLORS.olive,
    );
    this.overlayEntry(
      ov,
      bleeding
        ? `BLEEDING −${DECAY_PER_DAY}/DAY. Fight anything on the Front Line to stop it.`
        : `Decay starts in ${untilLabel(decayAt - now)} of silence, then −${DECAY_PER_DAY}/day.`,
      bleeding ? COLORS.alarm : COLORS.inkDim,
    );

    const ends = seasonEnd(fl.season);
    // The placement reads the peak, so show what the peak is currently worth.
    const placement = leagueAt(fl.peak).placement;
    const pay = [
      placement.supplies > 0 ? `${placement.supplies} SUP` : '',
      placement.fuel > 0 ? `${placement.fuel} FUEL` : '',
      placement.intel > 0 ? `${placement.intel} INT` : '',
    ].filter(Boolean).join(' · ');
    this.overlayEntry(
      ov,
      `SEASON ${seasonNumber(fl.season)} ends in ${untilLabel(ends - now)}.` +
        `\nPlacement pays for the PEAK band, not the closing one: ${pay || 'nothing at this band'}.` +
        `\nA quarter of the standing carries into the next season.`,
      COLORS.ink,
    );

    this.overlayEntry(
      ov,
      `TODAY — ${condition.label}  (${untilLabel(conditionEndsAt(now) - now)} left)` +
        `\n${condition.effect}  ·  ${condition.pay}` +
        `\n${condition.blurb}` +
        `\nNext up: ${conditionAfter(now).label}.`,
      COLORS.signal,
    );

    if (fl.placements.length > 0) {
      this.overlayEntry(ov, 'CLOSED SEASONS', COLORS.inkDim);
      for (const record of fl.placements) {
        this.overlayEntry(
          ov,
          `SEASON ${seasonNumber(record.season)} — ${LEAGUE_BY_ID[record.league].label} at ${record.peak} pts`,
          COLORS.inkDim,
        );
      }
    }
    ov.footer('CLOSE', close);
  }

  /** Hand the player their own layout as a string they can paste anywhere. */
  private shareBase(): void {
    const flavor = flavorFor(this.town.faction);
    const name = `${flavor.base.split(',')[0] ?? 'FORWARD POST'}`;
    const code = encodeBase(this.town, cleanName(name));
    showTextBox({
      title: 'YOUR BASE, AS A CODE',
      note:
        'Send this to a friend and they can raid a snapshot of your layout. ' +
        'It carries the wire, the emplacements and the command post — nothing ' +
        'else. They fight a copy: nothing here changes, whatever they do to it.',
      value: code,
      readOnly: true,
    });
  }

  /** Take a friend's code and go and see how good their maze really is. */
  private raidCode(): void {
    showTextBox({
      title: 'RAID A SHARED BASE',
      note:
        'Paste a code. Your losses are real and permanent; a given code pays ' +
        'loot once, and the Front Line does not move for a duel.',
      confirm: 'SCOUT IT',
      onConfirm: (value) => {
        const result = decodeBase(value);
        if (!result.ok) {
          setTextBoxStatus(SHARE_ERRORS[result.error]);
          return;
        }
        closeTextBox();
        saveTown(this.town);
        this.scene.start('raid', {
          town: this.town,
          challenge: { base: baseFromShare(result.base), fingerprint: codeFingerprint(value.trim()) },
        });
      },
    });
  }

  /** The shared settings screen, opened from the SYS tab. */
  private showSettings(): void {
    if (this.overlay || this.demoMode) return;
    const close = (): void => {
      this.overlay?.close();
      this.overlay = null;
      this.overlayBuilder = null;
    };
    this.overlay = buildSettings(this, this.layout, {
      container: this.board.ui,
      town: this.town,
      onImport: (imported) => {
        this.town = imported;
        tick(this.town, Date.now());
        saveTown(this.town);
        this.selectedId = null;
        close();
        this.setBanner('SAVE IMPORTED.', 6);
      },
      rebuild: () => this.openOverlay(() => this.showSettings()),
      close,
      toMenu: () => this.toMainMenu(),
      onPaletteChange: () => {
        saveTown(this.town);
        this.scene.restart({});
      },
    });
  }

  /** Back to the front door, with the campaign written down first. */
  private toMainMenu(): void {
    if (!this.demoMode) saveTown(this.town);
    this.overlay?.close();
    this.overlay = null;
    this.overlayBuilder = null;
    this.scene.start('menu');
  }

  /** First run, screen 1: alternate-history framing and the faction choice. */
  private showIntro(): void {
    if (this.overlay) return;
    // No pinned title, and no half-transparent scrim. A title pinned to the
    // top of the screen leaves a hole between itself and a body that centres
    // on its own; flowing the hero inside the card centres the whole
    // composition as one block, which is what the main menu already does. The
    // scrim is opaque because a first-run card has nothing behind it worth
    // seeing — only a town HUD showing through the title.
    const ov = new Overlay(this, this.layout, { scrim: 1, container: this.board.ui });
    this.overlay = ov;
    const { gap, font } = this.layout;
    const air = this.layout.compact ? gap : Math.round(gap * 2);
    const hero = (value: string, size: number, color: number, gapAfter: number): void => {
      ov.paragraph(value, size, color, {
        center: true,
        width: Math.min(ov.card.w, this.layout.px(560)),
        gapAfter,
        lineSpacing: Math.round(size * 0.5),
      });
    };
    hero('2060TD', font.hero, COLORS.ink, air);
    hero(
      'An alternate history. 2027. A coordinated offensive — China, Russia, ' +
        'North Korea — strikes the American mainland and UN forces worldwide. ' +
        'The fiction depicts militaries and machines, not peoples.',
      font.tiny,
      COLORS.inkDim,
      Math.round(air * 1.4),
    );
    ov.paragraph('Five commands are hiring. Pick your war:', font.body, COLORS.ink, {
      center: true,
      gapAfter: gap,
    });

    const pick = (faction: FactionId): void => {
      ov.close();
      this.overlay = null;
      this.overlayBuilder = null;
      // Intro only shows on a fresh save (difficulty === null), so a rebuild
      // here throws nothing away.
      if (faction !== this.town.faction) {
        this.town = newTown(Date.now(), faction);
        saveTown(this.town);
      }
      this.openOverlay(() => this.showDifficulty());
    };
    for (const faction of FACTION_IDS) {
      const flavor = flavorFor(faction);
      // Both blocks are measured. A faction name plus an operation name is a
      // phrase, not a label — on a phone it wraps, and so does the pitch under
      // it. Reserving a line count for either is how the picker came to draw
      // its rows off both edges of the screen and its pitches into the row
      // below.
      ov.flowButton(
        `${flavor.faction} — ${flavor.operation.split(' — ')[0]!.replace('OPERATION ', 'OP. ')}`,
        () => pick(faction),
        { gapAfter: Math.round(gap / 2) },
      );
      ov.paragraph(flavor.pitch, font.tiny, COLORS.inkDim, { center: true, gapAfter: gap });
    }
  }

  /** First run, screen 2: the difficulty commitment. */
  private showDifficulty(): void {
    if (this.overlay) return;
    const flavor = flavorFor(this.town.faction);
    // Screen 2 of the same card, laid out the same way: everything measured,
    // everything in one centred block. An operation name is long enough to
    // wrap on a phone, and a pinned one would take the body's space with it.
    const ov = new Overlay(this, this.layout, { scrim: 1, container: this.board.ui });
    this.overlay = ov;
    const { gap, font } = this.layout;
    const air = this.layout.compact ? gap : Math.round(gap * 2);
    ov.paragraph(flavor.operation, font.title, COLORS.ink, {
      center: true,
      width: Math.min(ov.card.w, this.layout.px(560)),
      gapAfter: Math.round(gap * 0.8),
      lineSpacing: Math.round(font.title * 0.4),
    });
    ov.paragraph(flavor.situation.replace(/\n/g, ' '), font.tiny, COLORS.inkDim, {
      center: true,
      width: Math.min(ov.card.w, this.layout.px(560)),
      gapAfter: air,
    });
    ov.paragraph('CHOOSE YOUR COMMITMENT:', font.body, COLORS.ink, {
      center: true,
      gapAfter: gap,
    });

    const pick = (difficulty: 'standard' | 'hard'): void => {
      this.town.campaign.difficulty = difficulty;
      saveTown(this.town);
      ov.close();
      this.overlay = null;
      this.overlayBuilder = null;
      // Rebuild the scene so every faction-flavored label refreshes.
      this.scene.restart({});
    };
    ov.flowButton('STANDARD — hold the line', () => pick('standard'));
    ov.flowButton('HARD — +30% hostiles', () => pick('hard'));
  }

  // ---- frame update -----------------------------------------------------------------

  override update(_time: number, deltaMs: number): void {
    const now = Date.now();
    const settlement = tick(this.town, now);
    // A season can turn over with the game open. Rare, but it pays real
    // resources, so it must never land silently.
    if (settlement.placement && !this.demoMode) {
      this.setBanner(
        `SEASON ${seasonNumber(settlement.placement.season)} CLOSED — PLACED ` +
          `${LEAGUE_BY_ID[settlement.placement.league].label} AT ${settlement.placement.peak} PTS.`,
        18,
      );
      saveTown(this.town);
    }

    this.saveTimer += deltaMs;
    if (this.saveTimer > 5000) {
      this.saveTimer = 0;
      if (!this.demoMode) saveTown(this.town);
    }
    if (this.bannerTtl > 0) this.bannerTtl -= deltaMs / 1000;
    this.checkContracts(now);

    this.drawTown(now);
    this.updateHud(now);
  }

  /** Grid cell under the pointer, undoing the board camera's pan and zoom. */
  private cellFromPointer(pointer: Phaser.Input.Pointer): number | null {
    const at = this.board.cellAt(pointer);
    return at ? at.row * TOWN_GRID.width + at.col : null;
  }

  private cellCenterPx(cell: number, footprint: number): { x: number; y: number } {
    const x = cell % TOWN_GRID.width;
    const y = Math.floor(cell / TOWN_GRID.width);
    const half = footprint === 2 ? 1 : 0.5;
    return { x: (x + half) * CELL, y: (y + half) * CELL };
  }

  private drawTown(now: number): void {
    const g = this.dynLayer;
    g.clear();

    for (const wall of this.town.walls) {
      const x = (wall.cell % TOWN_GRID.width) * CELL;
      const y = Math.floor(wall.cell / TOWN_GRID.width) * CELL;
      drawWallGlyph(g, x, y, CELL, wall.kind, 1);
    }

    for (const s of this.town.structures) {
      const footprint = footprintOf(s.kind);
      const center = this.cellCenterPx(s.cell, footprint);
      const building = s.buildEndsAt !== undefined;
      drawStructureGlyph(g, s.kind, center.x, center.y, CELL, {
        level: s.level,
        wrecked: s.wrecked,
        inert: building && s.upgradingTo === undefined,
      });
      if (building) {
        const meta = this.meta(s.kind);
        const target = s.upgradingTo ?? 1;
        const total = (meta?.levels[target - 1]?.seconds ?? 1) * buildSpeedFactor(this.town) * 1000;
        const remaining = Math.max(0, (s.buildEndsAt ?? now) - now);
        const frac = total > 0 ? 1 - remaining / total : 1;
        const w = footprint === 2 ? CELL * 2 - 10 : CELL - 8;
        g.fillStyle(0x000000, 0.6);
        g.fillRect(center.x - w / 2, center.y + (footprint === 2 ? CELL : CELL / 2) + 2, w, 4);
        g.fillStyle(COLORS.intel, 1);
        g.fillRect(
          center.x - w / 2,
          center.y + (footprint === 2 ? CELL : CELL / 2) + 2,
          w * Phaser.Math.Clamp(frac, 0.03, 1),
          4,
        );
      }
      if (s.id === this.selectedId) {
        const half = footprint === 2 ? CELL : CELL / 2;
        g.lineStyle(2, COLORS.intel, 0.9);
        g.strokeRect(center.x - half - 2, center.y - half - 2, half * 2 + 4, half * 2 + 4);
      }
    }

    this.drawGhost(g);
  }

  private drawGhost(g: Phaser.GameObjects.Graphics): void {
    const cell = this.cellFromPointer(this.input.activePointer);
    if (cell === null) return;

    let kind: string | null = null;
    let valid = false;
    if (this.tool.type === 'build') {
      kind = this.tool.kind;
      valid = canPlace(this.town, kind, cell) === null;
    } else if (this.tool.type === 'wall') {
      kind = 'wall';
      valid = canPlaceWall(this.town, cell) === null;
    } else if (this.tool.type === 'erase') {
      kind = 'erase';
      valid = wallAt(this.town, cell);
    } else if (this.tool.type === 'move') {
      const s = this.town.structures.find((x) => x.id === (this.tool as { id: number }).id);
      if (!s) return;
      kind = s.kind;
      const cells = footprintCells(s.kind, cell);
      valid = cells.every(
        (c) =>
          c >= 0 &&
          c < TOWN_GRID.width * TOWN_GRID.height &&
          c % TOWN_GRID.width !== TOWN_GRID.spawnColumn &&
          !wallAt(this.town, c) &&
          (structureAt(this.town, c)?.id ?? s.id) === s.id,
      );
    } else {
      return;
    }

    const footprint = kind && kind !== 'erase' && kind !== 'wall' ? footprintOf(kind) : 1;
    const color = valid ? COLORS.olive : COLORS.alarm;
    const x = (cell % TOWN_GRID.width) * CELL;
    const y = Math.floor(cell / TOWN_GRID.width) * CELL;
    g.fillStyle(color, 0.22);
    g.fillRect(x + 1, y + 1, CELL * footprint - 2, CELL * footprint - 2);
    g.lineStyle(1, color, 0.8);
    g.strokeRect(x + 1, y + 1, CELL * footprint - 2, CELL * footprint - 2);
  }

  // ---- panel -----------------------------------------------------------------------------

  // ---- panel rows ------------------------------------------------------------------
  //
  // The panel is data: each tab returns a fresh row list every frame and the
  // Panel diffs it against a pooled set of buttons. One layout description
  // serves the landscape rail and the portrait drawer alike.

  private rowsForTab(now: number): PanelRow[] {
    switch (this.panel.tab) {
      case 'build':
        return this.buildRows();
      case 'base':
        return this.baseRows(now);
      case 'ops':
        return this.opsRows(now);
      case 'war':
        return this.warRows();
      default:
        return this.sysRows();
    }
  }

  private buildRows(): PanelRow[] {
    const town = this.town;
    const g = gating(town);
    const rows: PanelRow[] = [{ id: 'h1', label: 'CONSTRUCTION', heading: true }];

    for (const kind of BUILDABLE_KINDS) {
      const meta = this.meta(kind)!;
      const cost = meta.levels[0]!;
      const max = g.counts[kind] ?? 0;
      const have = countOf(town, kind);
      if (!isUnlocked(town, kind)) {
        const at = this.unlockAt(kind);
        rows.push({
          id: kind,
          label: meta.name.toUpperCase(),
          sub: `LOCKED${at !== undefined ? ` M${at + 1}` : ''}`,
          enabled: false,
        });
        continue;
      }
      const costText = cost.fuel > 0 ? `${cost.supplies}S+${cost.fuel}F` : `${cost.supplies}S`;
      rows.push({
        id: kind,
        label: meta.name.toUpperCase(),
        sub: `${costText} ${have}/${max}`,
        enabled: max > 0 && have < max && town.supplies >= cost.supplies && town.fuel >= cost.fuel,
        active: this.tool.type === 'build' && this.tool.kind === kind,
        onTap: () => this.setTool({ type: 'build', kind }),
      });
    }

    rows.push(
      { id: 'h2', label: 'WALL LINE — drag to paint', heading: true },
      {
        id: 'wall',
        label: 'BUILD WALL',
        sub: `10S ${town.walls.length}/${g.walls}`,
        enabled: town.walls.length < g.walls && town.supplies >= 10,
        active: this.tool.type === 'wall',
        onTap: () => this.setTool({ type: 'wall' }),
      },
      {
        id: 'erase',
        label: 'ERASE WALL',
        active: this.tool.type === 'erase',
        onTap: () => this.setTool({ type: 'erase' }),
      },
    );
    return rows;
  }

  private baseRows(now: number): PanelRow[] {
    const town = this.town;
    const s = this.selected();
    if (!s) {
      return [
        { id: 'h', label: 'NOTHING SELECTED', heading: true },
        { id: 'hint', label: 'Tap a structure on the map', heading: true },
        { id: 'hint2', label: 'to inspect and upgrade it.', heading: true },
        { id: 'hint3', label: 'Pinch to zoom · drag to pan', heading: true },
        { id: 'fit', label: 'FIT VIEW', onTap: () => this.focusBase() },
      ];
    }

    const meta = this.meta(s.kind);
    const rows: PanelRow[] = [
      { id: 'h', label: `${meta?.name.toUpperCase() ?? s.kind} — LV ${s.level}`, heading: true },
    ];
    const info = (text: string): void => {
      rows.push({ id: `i${rows.length}`, label: text, heading: true });
    };
    if (s.wrecked) {
      const cost = repairCost(town, s);
      info('STATUS: WRECKED');
      info(`REPAIR: ${cost.supplies}S+${cost.fuel}F`);
    } else if (s.buildEndsAt !== undefined) {
      const secs = Math.max(0, Math.ceil((s.buildEndsAt - now) / 1000));
      info(s.upgradingTo ? `UPGRADING → LV ${s.upgradingTo}: ${secs}s` : `BUILDING: ${secs}s`);
    } else {
      info('STATUS: OPERATIONAL');
    }
    if (meta?.generatesSupplies) info(`OUTPUT: ${meta.generatesSupplies[s.level - 1]} SUP/min`);
    if (meta?.generatesFuel) info(`OUTPUT: ${meta.generatesFuel[s.level - 1]} FUEL/min`);
    if (meta?.generatesIntel) info(`OUTPUT: ${meta.generatesIntel[s.level - 1]} INTEL/min`);
    if (meta?.storage) {
      const t = meta.storage[s.level - 1]!;
      info(`STORAGE: +${t.supplies}S +${t.fuel}F`);
    }
    if (meta?.intelCap) info(`INTEL CAP: +${meta.intelCap[s.level - 1]}`);
    if (meta?.buildSpeed) info(`BUILD SPEED: −${Math.round(meta.buildSpeed[s.level - 1]! * 100)}%`);

    const err = upgradeError(town, s);
    let upgradeSub = '';
    if (err === null) {
      const cost = meta!.levels[s.level]!;
      upgradeSub = `${cost.supplies}S+${cost.fuel}F ${cost.seconds}s`;
    } else if (err === 'locked') {
      const at = this.unlockAt(`cc${s.level + 1}`);
      upgradeSub = at !== undefined ? `M${at + 1}` : 'PENDING';
    } else if (err === 'max' && s.kind !== 'cc') {
      upgradeSub = ccLevel(town) < 3 ? 'NEEDS CC' : 'MAX';
    }
    const repair = repairCost(town, s);
    rows.push(
      {
        id: 'upgrade',
        label: 'UPGRADE',
        sub: upgradeSub,
        enabled: err === null,
        onTap: () => this.onUpgrade(),
      },
      {
        id: 'move',
        label: 'MOVE',
        enabled: s.kind !== 'cc',
        active: this.tool.type === 'move',
        onTap: () => this.onMove(),
      },
      { id: 'sell', label: 'SELL 50%', enabled: s.kind !== 'cc', onTap: () => this.onSell() },
      {
        id: 'repair',
        label: 'REPAIR WRECK',
        sub: s.wrecked ? `${repair.supplies}S+${repair.fuel}F` : '',
        enabled: s.wrecked && town.supplies >= repair.supplies && town.fuel >= repair.fuel,
        onTap: () => this.onRepair(),
      },
    );
    return rows;
  }

  private opsRows(now: number): PanelRow[] {
    const town = this.town;
    const mission = this.nextMission();
    const active = town.research.active;
    const researchLabel = active
      ? `${(TECH_BY_ID[active.id]?.name ?? active.id).toUpperCase()}`
      : hasRadar(town)
        ? 'RESEARCH'
        : 'RESEARCH — NO SIGNALS';
    const researchSub = active
      ? `${Math.max(0, Math.ceil((active.endsAt - now) / 1000))}s`
      : '[T]';

    return [
      { id: 'h', label: 'OPERATIONS', heading: true },
      {
        id: 'mission',
        label: mission ? `MISSION ${mission.index + 1}: ${mission.codename}` : 'CAMPAIGN COMPLETE',
        sub: mission ? '[SPACE]' : '',
        enabled: !!mission && !this.demoMode && town.campaign.difficulty !== null,
        onTap: () => this.launchMission(),
      },
      {
        id: 'opsmap',
        label: 'OPERATIONS MAP',
        sub: '[M]',
        enabled: !this.demoMode && town.campaign.difficulty !== null,
        onTap: () => this.openOverlay(() => this.showMissions()),
      },
      {
        id: 'research',
        label: researchLabel,
        sub: researchSub,
        enabled: !this.demoMode,
        onTap: () => this.openOverlay(() => this.showResearch()),
      },
      { id: 'h2', label: 'TRAINING GROUND', heading: true },
      {
        id: 'skirmish',
        label: this.skirmishUnlocked() ? `SKIRMISH LV ${town.assaultLevel}` : 'SKIRMISH',
        sub: this.skirmishUnlocked() ? '' : 'M2',
        enabled: this.skirmishUnlocked() && !this.demoMode,
        onTap: () => this.launchSkirmish(),
      },
    ];
  }

  private warRows(): PanelRow[] {
    const town = this.town;
    const rows: PanelRow[] = [{ id: 'h', label: 'THE FRONT LINE', heading: true }];

    if (!isUnlocked(town, 'frontline')) {
      const at = this.unlockAt('frontline');
      rows.push({
        id: 'front',
        label: 'FRONT LINE',
        sub: at !== undefined ? `M${at + 1}` : 'LOCKED',
        enabled: false,
      });
    } else if (town.frontline.pendingCounterattack) {
      rows.push({
        id: 'front',
        label: '⚠ COUNTERATTACK — DEFEND',
        sub: '[F]',
        enabled: !this.demoMode,
        onTap: () => this.openFrontline(),
      });
    } else {
      rows.push({
        id: 'front',
        label: `FRONT LINE — TIER ${town.frontline.tier}`,
        sub: '[F]',
        enabled: !this.demoMode,
        onTap: () => this.openFrontline(),
      });
    }

    // The board (M7): where you stand, and what the front is like today.
    if (isUnlocked(town, 'frontline')) {
      const now = Date.now();
      const league = leagueOf(town);
      const toNext = standingToNext(town);
      const condition = conditionAt(now);
      rows.push(
        { id: 'h4', label: 'THE BOARD', heading: true },
        {
          id: 'league',
          label: `${league.label} · ${town.frontline.standing} PTS`,
          sub: toNext === null ? 'TOP' : `+${toNext}`,
          onTap: () => this.openOverlay(() => this.showLeague()),
        },
        {
          id: 'condition',
          label: `TODAY — ${condition.label}`,
          sub: untilLabel(conditionEndsAt(now) - now),
          onTap: () => this.openOverlay(() => this.showLeague()),
        },
      );
    }

    // The record is not gated on the Front Line. Most of what it counts —
    // missions, research, sieges held, the heaviest assault turned back —
    // happens before the ladder is even offered, and a commander three
    // missions into a campaign has a war worth reading.
    rows.push({
      id: 'record',
      label: 'SERVICE RECORD',
      sub: `DAY ${warDay(town, Date.now())}`,
      onTap: () => this.openOverlay(() => this.showRecord()),
    });
    const vault = vaultOf(town);
    rows.push({
      id: 'vault',
      label: 'REPLAY VAULT',
      sub: vault.length > 0 ? `${vault.length}/${VAULT_CAP}` : 'EMPTY',
      onTap: () => this.openOverlay(() => this.showVault()),
    });
    // "STANDING ORDERS" is already the offline-defense policy on this tab, so
    // the daily ones are DAY ORDERS — different thing, different word.
    const sheet = contractState(town, Date.now());
    rows.push({
      id: 'contracts',
      label: 'DAY ORDERS',
      sub: `${sheet.paid.filter(Boolean).length}/${sheet.paid.length}`,
      onTap: () => this.openOverlay(() => this.showContracts()),
    });

    // Share-code duels (v1.2): no server, no ladder — a snapshot and a boast.
    rows.push({ id: 'h3', label: 'CHALLENGE', heading: true });
    rows.push({
      id: 'share',
      label: 'SHARE MY BASE',
      sub: 'CODE',
      enabled: !this.demoMode,
      onTap: () => this.shareBase(),
    });
    rows.push({
      id: 'duel',
      label: 'RAID A CODE',
      sub: town.duels?.length ? `${town.duels.length} BEATEN` : 'PASTE',
      enabled: !this.demoMode && isUnlocked(town, 'frontline'),
      onTap: () => this.raidCode(),
    });

    rows.push({ id: 'h2', label: 'ORDNANCE (FUEL)', heading: true });
    const powers = defenseCatalogFor(town.faction).powers;
    for (const power of ['a10', 'arty'] as const) {
      const stock = town.charges[power] ?? 0;
      const price = CHARGE_PRICES[power]!;
      const def = powers[power]!;
      const name = (def.short ?? def.name).toUpperCase();
      if (!isUnlocked(town, power)) {
        const at = this.unlockAt(power);
        rows.push({
          id: power,
          label: name,
          sub: `LOCKED${at !== undefined ? ` M${at + 1}` : ''}`,
          enabled: false,
        });
        continue;
      }
      rows.push({
        id: power,
        label: `${name} ×${stock}/${CHARGE_CAP}`,
        sub: `BUY ${price}F`,
        enabled: stock < CHARGE_CAP && town.fuel >= price,
        onTap: () => {
          if (buyCharge(this.town, power)) this.saveSoon();
        },
      });
    }

    const orders = town.standingOrders;
    rows.push(
      { id: 'h3', label: 'WHILE YOU ARE AWAY', heading: true },
      {
        id: 'orders',
        label: 'STANDING ORDERS',
        sub: orders ? orders.toUpperCase().slice(0, 7) : 'NONE',
        active: orders !== null,
        onTap: () => this.cycleOrders(),
      },
      {
        id: 'log',
        label: 'DEFENSE LOG',
        onTap: () => this.openOverlay(() => this.showDefenseLog()),
      },
    );
    return rows;
  }

  private sysRows(): PanelRow[] {
    const settings = loadSettings();
    const armed = Date.now() <= this.resetArmedUntil;
    return [
      { id: 'h', label: 'VIEW', heading: true },
      { id: 'fit', label: 'FIT VIEW TO BASE', onTap: () => this.focusBase() },
      {
        id: 'fs',
        label: this.scale.isFullscreen ? 'EXIT FULLSCREEN' : 'FULLSCREEN',
        active: this.scale.isFullscreen,
        onTap: () => {
          if (this.scale.isFullscreen) this.scale.stopFullscreen();
          else this.scale.startFullscreen();
        },
      },
      { id: 'h2', label: 'GAME', heading: true },
      {
        id: 'settings',
        label: 'SETTINGS',
        sub:
          `${settings.sfx <= 0 && settings.music <= 0 ? 'MUTED' : 'SOUND'}` +
          `${settings.colorblind ? ' · CB' : ''}`,
        onTap: () => this.openOverlay(() => this.showSettings()),
      },
      {
        id: 'menu',
        label: 'MAIN MENU',
        sub: 'SAVES FIRST',
        onTap: () => this.toMainMenu(),
      },
      {
        id: 'reset',
        label: armed ? 'TAP AGAIN TO ABANDON' : 'ABANDON BASE',
        active: armed,
        onTap: () => this.onReset(),
      },
    ];
  }

  /** Standing orders for offline defenses (v0.8): none → the three presets. */
  private cycleOrders(): void {
    const cycle: (StandingOrdersId | null)[] = [null, ...STANDING_ORDER_IDS];
    const index = cycle.indexOf(this.town.standingOrders);
    const next = cycle[(index + 1) % cycle.length]!;
    this.town.standingOrders = next;
    this.saveSoon();
    this.setBanner(
      next === null
        ? 'STANDING ORDERS RESCINDED — offline defenses fight with the permanent layer only.'
        : next === 'holdfast'
          ? 'STANDING ORDERS: HOLDFAST — the garrison guns down breaches with your CP while you are away (supplies upkeep per action).'
          : next === 'counterbattery'
            ? 'STANDING ORDERS: COUNTERBATTERY — the garrison spends your STOCKED ORDNANCE on massed attackers, mines in between.'
            : 'STANDING ORDERS: TRIPWIRE — the garrison seeds mines on the approach and mans the inner line.',
      9,
    );
  }

  private selected(): PlacedStructure | null {
    return this.town.structures.find((s) => s.id === this.selectedId) ?? null;
  }

  private onUpgrade(): void {
    const s = this.selected();
    if (s && upgrade(this.town, s.id, Date.now())) this.saveSoon();
  }

  private onMove(): void {
    const s = this.selected();
    if (s && s.kind !== 'cc') this.setTool({ type: 'move', id: s.id });
  }

  private onSell(): void {
    const s = this.selected();
    if (s && sell(this.town, s.id)) {
      this.selectedId = null;
      this.saveSoon();
    }
  }

  private onRepair(): void {
    const s = this.selected();
    if (s && repairWreck(this.town, s.id)) this.saveSoon();
  }

  private onReset(): void {
    const now = Date.now();
    if (now > this.resetArmedUntil) {
      this.resetArmedUntil = now + 3000;
      this.setBanner('TAP ABANDON AGAIN TO CONFIRM.', 3);
      return;
    }
    clearSave();
    this.town = newTown(now);
    this.selectedId = null;
    this.resetArmedUntil = 0;
    this.setBanner('BASE ABANDONED. A NEW COMMAND STANDS.', 8);
    // Fresh save: restart into the intro so the faction pick runs again.
    this.scene.restart({});
  }

  private saveSoon(): void {
    if (!this.demoMode) saveTown(this.town);
  }

  private setBanner(text: string, seconds: number): void {
    this.banner = text;
    this.bannerTtl = seconds;
  }

  // ---- HUD refresh ---------------------------------------------------------------------------

  private updateHud(now: number): void {
    const town = this.town;
    const cap = caps(town);
    const rate = ratesPerMinute(town);
    const mission = this.nextMission();
    const headline = mission
      ? `M${mission.index + 1} ${mission.codename} · ${town.victories}W ${town.defeats}L`
      : `SKIRMISH LV ${town.assaultLevel} · ${town.victories}W ${town.defeats}L`;

    // Portrait has one status line to spend; the rail can afford three.
    const lines =
      this.layout.mode === 'portrait'
        ? [
            `SUP ${Math.floor(town.supplies)}  FUEL ${Math.floor(town.fuel)}  INT ${Math.floor(town.intel)}`,
          ]
        : [
            `SUPPLIES ${Math.floor(town.supplies)}/${cap.supplies} (+${rate.supplies}/min)`,
            `FUEL     ${Math.floor(town.fuel)}/${cap.fuel} (+${rate.fuel}/min)`,
            `INTEL    ${Math.floor(town.intel)}/${cap.intel} (+${rate.intel}/min)`,
          ];
    this.panel.setStatus(`${flavorFor(town.faction).faction} · ${headline}`, lines);
    this.panel.setRows(this.rowsForTab(now));

    // Research completion lands as a banner the moment tick() finishes it.
    const activeId = town.research.active?.id ?? null;
    if (this.lastActiveResearch && activeId === null) {
      const tech = TECH_BY_ID[this.lastActiveResearch];
      if (tech && town.research.completed.includes(tech.id)) {
        this.setBanner(`RESEARCH COMPLETE: ${tech.name.toUpperCase()} — ${tech.desc.toUpperCase()}`, 12);
        audio.sfx('research');
      }
    }
    this.lastActiveResearch = activeId;

    this.bannerText.setText(this.bannerTtl > 0 ? this.banner : '');
    this.bannerText.setVisible(this.bannerTtl > 0);
  }
}

const BIG_KINDS = new Set([
  'cc',
  'supplyDepot',
  'fuelDepot',
  'storageBunker',
  'engBay',
  'radar',
  'barracks',
  'motorpool',
]);
const footprintOf = (kind: string): number => (BIG_KINDS.has(kind) ? 2 : 1);

/** A prebuilt base for ?demo=town screenshots. Never touches the real save. */
/** "3H", "2D 4H", "18M" — a countdown a panel row can hold. */
function untilLabel(ms: number): string {
  const total = Math.max(0, Math.round(ms / 60_000));
  if (total < 60) return `${total}M`;
  const hours = Math.floor(total / 60);
  if (hours < 48) return `${hours}H`;
  return `${Math.floor(hours / 24)}D ${hours % 24}H`;
}

function makeShowcaseTown(now: number): TownState {
  const town = unlockAll(newTown(now));
  town.campaign.difficulty = 'standard';
  town.campaign.next = 5;
  town.campaign.completed = ['m1', 'm2', 'm3', 'm4', 'm5'];
  town.supplies = 50_000;
  town.fuel = 50_000;
  const idx = (x: number, y: number) => y * TOWN_GRID.width + x;

  // Grow the CC to 2 instantly.
  upgrade(town, 1, now - 600_000);
  tick(town, now - 500_000);

  place(town, 'supplyDepot', idx(23, 6), now - 400_000);
  place(town, 'supplyDepot', idx(23, 16), now - 400_000);
  place(town, 'fuelDepot', idx(26, 5), now - 400_000);
  place(town, 'storageBunker', idx(26, 16), now - 400_000);
  place(town, 'engBay', idx(23, 11), now - 400_000);
  place(town, 'radar', idx(29, 5), now - 400_000);
  tick(town, now - 300_000);

  place(town, 'm2nest', idx(21, 9), now - 200_000);
  place(town, 'autocannon', idx(21, 13), now - 200_000);
  tick(town, now - 100_000);

  for (let y = 3; y <= 9; y++) placeWall(town, idx(19, y));
  for (let y = 14; y <= 20; y++) placeWall(town, idx(19, y));
  for (let x = 19; x <= 24; x++) {
    placeWall(town, idx(x, 3));
    placeWall(town, idx(x, 20));
  }

  // Showcase states: one wreck, one upgrade in flight, one build in flight.
  const depot = structureAt(town, idx(23, 16))!;
  depot.wrecked = true;
  const nest = structureAt(town, idx(21, 9))!;
  upgrade(town, nest.id, now);
  place(town, 'm2nest', idx(21, 11), now);

  town.charges = { a10: 2, arty: 1 };
  town.assaultLevel = 3;
  town.victories = 2;
  // Somewhere mid-board, so the screenshots show a league that has been held.
  town.frontline.standing = 465;
  town.frontline.peak = 512;
  town.frontline.totalWins = 6;
  // Three weeks of board behind it, so the service record has a line to draw
  // rather than a single bar. Shaped like a real run: a climb, a bad week off
  // the game, and a recovery that has not got back to the peak.
  const RUN = [
    120, 168, 205, 190, 244, 288, 331, 372, 410, 455, 492, 512, 482, 452,
    422, 392, 362, 401, 438, 466, 452, 465,
  ];
  town.frontline.history = { from: dayOf(now) - (RUN.length - 1), values: RUN };
  town.log = {
    startedAt: now - RUN.length * 86_400_000,
    raids: 14,
    probesHeld: 9,
    probesBreached: 2,
  };
  town.squads = [
    { xp: 132, raids: 11, clears: 7, lost: 19 },
    { xp: 46, raids: 8, clears: 4, lost: 24 },
    { xp: 0, raids: 3, clears: 1, lost: 11 },
  ];
  town.supplies = 740;
  town.fuel = 210;
  town.intel = 85;
  town.research.completed = ['fortify1'];
  town.research.active = { id: 'logistics1', endsAt: now + 48_000 };
  town.lastSeen = now;
  return town;
}
