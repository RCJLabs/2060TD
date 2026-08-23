import Phaser from 'phaser';
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
import { clearSave, downloadSave, loadTown, pickAndImportSave, saveTown } from '../../meta/save';
import { runOfflineProbes } from '../../meta/warfare';
import { audio } from '../audio';
import { loadSettings, saveSettings, applySettings } from '../settings';
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
import { drawFieldBase, drawStructureGlyph, drawWallGlyph } from '../glyphs';
import { COLORS, css } from '../palette';
import { makeButton, mono, type Button } from '../ui';
import type { BattleTag } from './SiegeScene';

/** Which mission grants each locked key — for "LOCKED (M4)" labels. */
const UNLOCK_MISSION: Record<FactionId, Record<string, number>> = {
  usa: {},
  china: {},
  russia: {},
  nk: {},
};
for (const faction of FACTION_IDS) {
  for (const mission of campaignFor(faction)) {
    for (const key of mission.unlocks) UNLOCK_MISSION[faction][key] = mission.index;
  }
}

const CELL = 32;
const GRID_PX_W = TOWN_GRID.width * CELL;
const GRID_PX_H = TOWN_GRID.height * CELL;
const PANEL_W = 256;

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
  private saveTimer = 0;
  private banner = '';
  private bannerTtl = 0;
  private resetArmedUntil = 0;
  private lastPaintedCell = -1;

  private dynLayer!: Phaser.GameObjects.Graphics;
  private warText!: Phaser.GameObjects.Text;
  private suppliesText!: Phaser.GameObjects.Text;
  private fuelText!: Phaser.GameObjects.Text;
  private intelText!: Phaser.GameObjects.Text;
  private selectedText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private buttons: Record<string, Button> = {};
  /** Research project id seen last frame — completion flips it to a banner. */
  private lastActiveResearch: string | null = null;
  private overlayOpen = false;

  constructor() {
    super('town');
  }

  init(data: { outcome?: SiegeOutcome; battle?: BattleTag }): void {
    const now = Date.now();
    this.demoMode = new URLSearchParams(window.location.search).get('demo') === 'town';

    if (this.demoMode) {
      this.town = makeShowcaseTown(now);
    } else if (!this.town) {
      const town = loadTown(now);
      const away = now - town.lastSeen;
      // Probes hit BEFORE accrual: the war didn't pause while you were gone.
      const probes = runOfflineProbes(town, now);
      const before = Math.floor(town.supplies + town.fuel);
      tick(town, now);
      const gained = Math.floor(town.supplies + town.fuel) - before;
      if (probes.length > 0) {
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
          data.outcome.victory
            ? 'COUNTERATTACK REPELLED — THE FRONT LINE HOLDS. BOUNTY PAID.'
            : 'THE COUNTERATTACK BROKE THROUGH. RAIDERS TOOK THEIR CUT.',
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
    this.tool = { type: 'select' };
    this.selectedId = null;
    this.buttons = {};
    this.lastPaintedCell = -1;

    const staticLayer = this.add.graphics();
    drawFieldBase(staticLayer, TOWN_GRID.width, TOWN_GRID.height, CELL, TOWN_GRID.spawnColumn);
    this.dynLayer = this.add.graphics();

    const cc = this.town.structures.find((s) => s.kind === 'cc')!;
    const ccCenter = this.cellCenterPx(cc.cell, 2);
    this.add
      .text(ccCenter.x, ccCenter.y, 'CC', mono(13, COLORS.ink, { fontStyle: 'bold' }))
      .setOrigin(0.5)
      .setDepth(5);
    this.add
      .text(GRID_PX_W / 2, 6, flavorFor(this.town.faction).base, mono(11, COLORS.inkDim))
      .setOrigin(0.5, 0)
      .setDepth(5);

    this.buildPanel();
    this.bindInput();

    if (!this.demoMode && this.town.campaign.difficulty === null) this.showIntro();
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
    this.input.removeAllListeners();
    this.input.keyboard?.removeAllListeners();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.setTool({ type: 'select' });
        return;
      }
      this.handlePointer(pointer, true);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) this.handlePointer(pointer, false);
    });

    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', () => this.setTool({ type: 'select' }));
    kb?.on('keydown-SPACE', () => this.launchPrimary());
    kb?.on('keydown-F', () => this.openFrontline());
    kb?.on('keydown-T', () => this.showResearch());
    kb?.on('keydown-M', () => this.showMissions());
  }

  private handlePointer(pointer: Phaser.Input.Pointer, isFirstPress: boolean): void {
    if (pointer.x >= GRID_PX_W || pointer.y >= GRID_PX_H) return;
    const cell = this.cellFromPointer(pointer);
    const now = Date.now();

    switch (this.tool.type) {
      case 'select': {
        if (!isFirstPress) return;
        const s = structureAt(this.town, cell);
        this.selectedId = s ? s.id : null;
        return;
      }
      case 'build': {
        if (!isFirstPress) return;
        if (place(this.town, this.tool.kind, cell, now)) this.saveSoon();
        return;
      }
      case 'wall': {
        if (cell === this.lastPaintedCell && !isFirstPress) return;
        this.lastPaintedCell = cell;
        if (placeWall(this.town, cell)) this.saveSoon();
        return;
      }
      case 'erase': {
        if (cell === this.lastPaintedCell && !isFirstPress) return;
        this.lastPaintedCell = cell;
        if (removeWall(this.town, cell)) this.saveSoon();
        return;
      }
      case 'move': {
        if (!isFirstPress) return;
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
    for (const kind of BUILDABLE_KINDS) {
      this.buttons[kind]?.setActive(tool.type === 'build' && tool.kind === kind);
    }
    this.buttons['wall']?.setActive(tool.type === 'wall');
    this.buttons['erase']?.setActive(tool.type === 'erase');
    this.buttons['moveBtn']?.setActive(tool.type === 'move');
  }

  private nextMission(): MissionDef | null {
    return this.missions()[this.town.campaign.next] ?? null;
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
    });
  }

  /** Mission select: the war so far — replay cleared sectors, fight the next. */
  private showMissions(): void {
    if (this.overlayOpen || this.demoMode) return;
    this.overlayOpen = true;
    const objects: Phaser.GameObjects.GameObject[] = [];
    const cx = (GRID_PX_W + PANEL_W) / 2;
    const missions = this.missions();
    const next = this.town.campaign.next;
    objects.push(
      this.add.rectangle(0, 0, GRID_PX_W + PANEL_W, GRID_PX_H, 0x000000, 0.78).setOrigin(0).setDepth(60),
      this.add
        .text(cx, 66, 'OPERATIONS MAP', mono(24, COLORS.ink, { fontStyle: 'bold' }))
        .setOrigin(0.5)
        .setDepth(61),
      this.add
        .text(cx, 96, 'Replays of held sectors pay 35% of the original requisition.', mono(11, COLORS.inkDim))
        .setOrigin(0.5)
        .setDepth(61),
    );
    const close = () => {
      this.overlayOpen = false;
      objects.forEach((o) => o.destroy());
    };
    missions.forEach((mission, i) => {
      const y = 128 + i * 52;
      const cleared = this.town.campaign.completed.includes(mission.id);
      const isNext = i === next;
      const starred = this.town.campaign.bonuses.includes(mission.id);
      const status = cleared
        ? `SECTOR HELD${starred ? ' ★' : ''}`
        : isNext
          ? 'NEXT OBJECTIVE'
          : 'NO CONTACT YET';
      objects.push(
        this.add
          .text(
            cx - 270,
            y,
            `M${mission.index + 1}  ${mission.codename}\n${status}`,
            mono(13, cleared ? COLORS.olive : isNext ? COLORS.signal : COLORS.inkDim, {
              lineSpacing: 4,
            }),
          )
          .setDepth(61),
      );
      if (cleared || isNext) {
        const button = makeButton(this, cx + 150, y + 2, 120, 30, cleared ? 'REPLAY' : 'FIGHT', () => {
          close();
          this.launchMissionAt(mission);
        });
        button.bg.setDepth(61);
        button.label.setDepth(61);
        objects.push(button.bg, button.label);
      }
    });
    const done = makeButton(this, cx - 60, 128 + missions.length * 52 + 12, 120, 30, 'CLOSE', close);
    done.bg.setDepth(61);
    done.label.setDepth(61);
    objects.push(done.bg, done.label);
  }

  /** The research board: three doctrines, one project at a time. */
  private showResearch(): void {
    if (this.overlayOpen || this.demoMode) return;
    this.overlayOpen = true;
    const objects: Phaser.GameObjects.GameObject[] = [];
    const cx = (GRID_PX_W + PANEL_W) / 2;
    objects.push(
      this.add.rectangle(0, 0, GRID_PX_W + PANEL_W, GRID_PX_H, 0x000000, 0.78).setOrigin(0).setDepth(60),
      this.add
        .text(cx, 56, 'RESEARCH & DOCTRINE', mono(24, COLORS.ink, { fontStyle: 'bold' }))
        .setOrigin(0.5)
        .setDepth(61),
      this.add
        .text(
          cx,
          86,
          hasRadar(this.town)
            ? `INTEL ${Math.floor(this.town.intel)} · one project at a time`
            : 'A SIGNALS STATION MUST STAND TO RUN THE PROGRAM',
          mono(11, hasRadar(this.town) ? COLORS.inkDim : COLORS.alarm),
        )
        .setOrigin(0.5)
        .setDepth(61),
    );
    const close = () => {
      this.overlayOpen = false;
      objects.forEach((o) => o.destroy());
    };
    const branchHeaders: Record<string, string> = {
      fortify: 'FORTIFY — the wire holds',
      strike: 'STRIKE — the raids bite',
      logistics: 'LOGISTICS — the war runs',
    };
    let y = 116;
    let lastBranch = '';
    for (const tech of TECHS) {
      if (tech.branch !== lastBranch) {
        lastBranch = tech.branch;
        objects.push(
          this.add.text(cx - 290, y, branchHeaders[tech.branch]!, mono(11, COLORS.intel, { fontStyle: 'bold' })).setDepth(61),
        );
        y += 20;
      }
      const err = canResearch(this.town, tech.id);
      const done = this.town.research.completed.includes(tech.id);
      const active = this.town.research.active?.id === tech.id;
      const label = `${tech.name} — ${tech.desc}`;
      const sub = done
        ? 'IN DOCTRINE'
        : active
          ? 'IN PROGRESS'
          : err === 'prereq'
            ? 'REQUIRES THE PREVIOUS DOCTRINE'
            : `${tech.intel} INTEL · ${tech.seconds}s`;
      objects.push(
        this.add
          .text(cx - 290, y, `${label}\n${sub}`, mono(12, done ? COLORS.olive : active ? COLORS.signal : COLORS.ink, { lineSpacing: 3 }))
          .setDepth(61),
      );
      if (!done && !active) {
        const button = makeButton(this, cx + 190, y, 100, 28, 'START', () => {
          if (startResearch(this.town, tech.id, Date.now())) {
            saveTown(this.town);
            audio.sfx('radio');
            this.setBanner(`RESEARCH STARTED: ${tech.name.toUpperCase()}`, 8);
            close();
          }
        });
        button.setEnabled(err === null);
        button.bg.setDepth(61);
        button.label.setDepth(61);
        objects.push(button.bg, button.label);
      }
      y += 44;
    }
    const done = makeButton(this, cx - 60, Math.min(y + 8, GRID_PX_H - 44), 120, 30, 'CLOSE', close);
    done.bg.setDepth(61);
    done.label.setDepth(61);
    objects.push(done.bg, done.label);
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
    const objects: Phaser.GameObjects.GameObject[] = [];
    const cx = (GRID_PX_W + PANEL_W) / 2;
    objects.push(
      this.add.rectangle(0, 0, GRID_PX_W + PANEL_W, GRID_PX_H, 0x000000, 0.72).setOrigin(0).setDepth(60),
      this.add
        .text(cx, 170, 'DEFENSE LOG', mono(24, COLORS.ink, { fontStyle: 'bold' }))
        .setOrigin(0.5)
        .setDepth(61),
    );
    const close = () => objects.forEach((o) => o.destroy());
    if (this.town.defenseLog.length === 0) {
      objects.push(
        this.add
          .text(cx, 230, 'No probes on record. The wire has been quiet.', mono(13, COLORS.inkDim))
          .setOrigin(0.5)
          .setDepth(61),
      );
    }
    this.town.defenseLog.forEach((entry, i) => {
      const y = 220 + i * 64;
      const when = new Date(entry.at).toISOString().slice(5, 16).replace('T', ' ');
      objects.push(
        this.add
          .text(
            cx - 250,
            y,
            `${when}Z · PROBE LV ${entry.level} — ${entry.held ? 'HELD' : 'BREACHED'}` +
              `${!entry.held && entry.killer ? ` (CC LOST TO ${entry.killer.toUpperCase()})` : ''}` +
              `\n−${entry.suppliesLost} SUP · −${entry.fuelLost} FUEL`,
            mono(12, entry.held ? COLORS.olive : COLORS.alarm, { lineSpacing: 4 }),
          )
          .setDepth(61),
      );
      const watch = makeButton(this, cx + 130, y, 120, 26, 'WATCH', () => {
        close();
        this.scene.start('replay', {
          config: entry.config,
          kind: 'defense',
          title: `PROBE LV ${entry.level}`,
          faction: this.town.faction,
          backTo: 'town',
        });
      });
      watch.bg.setDepth(61);
      watch.label.setDepth(61);
      objects.push(watch.bg, watch.label);
    });
    const done = makeButton(this, cx - 60, 560, 120, 30, 'CLOSE', close);
    done.bg.setDepth(61);
    done.label.setDepth(61);
    objects.push(done.bg, done.label);
  }

  /** First run, screen 1: alternate-history framing and the faction choice. */
  private showIntro(): void {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const cx = (GRID_PX_W + PANEL_W) / 2;
    objects.push(
      this.add.rectangle(0, 0, GRID_PX_W + PANEL_W, GRID_PX_H, 0x000000, 0.82).setOrigin(0).setDepth(60),
      this.add
        .text(cx, 150, 'LAST LINE', mono(40, COLORS.ink, { fontStyle: 'bold' }))
        .setOrigin(0.5)
        .setDepth(61),
      this.add
        .text(
          cx,
          210,
          [
            'An alternate history. 2027.',
            '',
            'A coordinated offensive — China, Russia, North Korea — strikes the',
            'American mainland and UN forces worldwide. The fiction depicts',
            'militaries and machines, not peoples.',
            '',
            'Four commands are hiring. Pick your war:',
          ].join('\n'),
          mono(14, COLORS.ink, { lineSpacing: 7, align: 'center' }),
        )
        .setOrigin(0.5, 0)
        .setDepth(61),
    );
    const pick = (faction: FactionId) => {
      for (const obj of objects) obj.destroy();
      // Intro only shows on a fresh save (difficulty === null), so a rebuild
      // here throws nothing away.
      if (faction !== this.town.faction) {
        this.town = newTown(Date.now(), faction);
        saveTown(this.town);
      }
      this.showDifficulty();
    };
    for (const [i, faction] of FACTION_IDS.entries()) {
      const flavor = flavorFor(faction);
      const button = makeButton(
        this,
        cx - 290,
        400 + i * 74,
        580,
        42,
        `${flavor.faction} — ${flavor.operation.split(' — ')[0]!.replace('OPERATION ', 'OP. ')}`,
        () => pick(faction),
      );
      const blurb = this.add
        .text(cx, 400 + i * 74 + 48, flavor.pitch, mono(11, COLORS.inkDim))
        .setOrigin(0.5, 0)
        .setDepth(61);
      button.bg.setDepth(61);
      button.label.setDepth(61);
      objects.push(button.bg, button.label, blurb);
    }
  }

  /** First run, screen 2: the difficulty commitment. */
  private showDifficulty(): void {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const cx = (GRID_PX_W + PANEL_W) / 2;
    const flavor = flavorFor(this.town.faction);
    objects.push(
      this.add.rectangle(0, 0, GRID_PX_W + PANEL_W, GRID_PX_H, 0x000000, 0.82).setOrigin(0).setDepth(60),
      this.add
        .text(cx, 210, flavor.operation, mono(22, COLORS.ink, { fontStyle: 'bold' }))
        .setOrigin(0.5)
        .setDepth(61),
      this.add
        .text(
          cx,
          260,
          [flavor.situation, '', 'CHOOSE YOUR COMMITMENT:'].join('\n'),
          mono(14, COLORS.ink, { lineSpacing: 7, align: 'center' }),
        )
        .setOrigin(0.5, 0)
        .setDepth(61),
    );
    const pick = (difficulty: 'standard' | 'hard') => {
      this.town.campaign.difficulty = difficulty;
      saveTown(this.town);
      for (const obj of objects) obj.destroy();
      // Rebuild the scene so every faction-flavored label refreshes.
      this.scene.restart({});
    };
    const std = makeButton(this, cx - 250, 460, 230, 40, 'STANDARD — hold the line', () =>
      pick('standard'),
    );
    const hard = makeButton(this, cx + 20, 460, 230, 40, 'HARD — +30% hostiles', () =>
      pick('hard'),
    );
    for (const b of [std, hard]) {
      b.bg.setDepth(61);
      b.label.setDepth(61);
      objects.push(b.bg, b.label);
    }
  }

  // ---- frame update -----------------------------------------------------------------

  override update(_time: number, deltaMs: number): void {
    const now = Date.now();
    tick(this.town, now);

    this.saveTimer += deltaMs;
    if (this.saveTimer > 5000) {
      this.saveTimer = 0;
      if (!this.demoMode) saveTown(this.town);
    }
    if (this.bannerTtl > 0) this.bannerTtl -= deltaMs / 1000;

    this.drawTown(now);
    this.updateHud(now);
  }

  private cellFromPointer(pointer: Phaser.Input.Pointer): number {
    return (
      Math.floor(pointer.y / CELL) * TOWN_GRID.width + Math.floor(pointer.x / CELL)
    );
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
    const pointer = this.input.activePointer;
    if (pointer.x >= GRID_PX_W || pointer.y >= GRID_PX_H) return;
    const cell = this.cellFromPointer(pointer);

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

  private buildPanel(): void {
    const x0 = GRID_PX_W;
    const pad = 14;
    const bw = PANEL_W - pad * 2;
    this.add.rectangle(x0, 0, PANEL_W, GRID_PX_H, COLORS.bgPanel).setOrigin(0, 0);
    this.add.rectangle(x0, 0, 2, GRID_PX_H, COLORS.gridLine).setOrigin(0, 0);

    this.add.text(x0 + pad, 8, 'LAST LINE', mono(17, COLORS.ink, { fontStyle: 'bold' }));
    this.add.text(x0 + pad, 28, flavorFor(this.town.faction).faction, mono(10, COLORS.inkDim));
    this.warText = this.add.text(x0 + pad, 42, '', mono(12, COLORS.signal, { fontStyle: 'bold' }));

    this.suppliesText = this.add.text(x0 + pad, 62, '', mono(11));
    this.fuelText = this.add.text(x0 + pad, 77, '', mono(11));
    this.intelText = this.add.text(x0 + pad, 92, '', mono(11));

    this.add.text(x0 + pad, 110, 'CONSTRUCTION', mono(10, COLORS.inkDim));
    let y = 122;
    for (const kind of BUILDABLE_KINDS) {
      this.buttons[kind] = makeButton(this, x0 + pad, y, bw, 22, '', () =>
        this.setTool({ type: 'build', kind }),
      );
      y += 25;
    }
    const half = (bw - 6) / 2;
    this.buttons['wall'] = makeButton(this, x0 + pad, y, half, 22, 'WALL 10S', () =>
      this.setTool({ type: 'wall' }),
    );
    this.buttons['erase'] = makeButton(this, x0 + pad + half + 6, y, half, 22, 'ERASE WALL', () =>
      this.setTool({ type: 'erase' }),
    );
    y += 28;

    this.add.text(x0 + pad, y, 'SELECTED', mono(10, COLORS.inkDim));
    this.selectedText = this.add.text(
      x0 + pad,
      y + 13,
      '',
      mono(10, COLORS.ink, { lineSpacing: 2 }),
    );
    y += 86;
    this.buttons['upgradeBtn'] = makeButton(this, x0 + pad, y, half, 22, 'UPGRADE', () =>
      this.onUpgrade(),
    );
    this.buttons['moveBtn'] = makeButton(this, x0 + pad + half + 6, y, half, 22, 'MOVE', () =>
      this.onMove(),
    );
    y += 26;
    this.buttons['sellBtn'] = makeButton(this, x0 + pad, y, half, 22, 'SELL 50%', () =>
      this.onSell(),
    );
    this.buttons['repairBtn'] = makeButton(this, x0 + pad + half + 6, y, half, 22, 'REPAIR', () =>
      this.onRepair(),
    );
    y += 30;

    this.add.text(x0 + pad, y, 'ORDNANCE (FUEL)', mono(10, COLORS.inkDim));
    y += 13;
    this.buttons['buyA10'] = makeButton(this, x0 + pad, y, bw, 22, '', () => {
      if (buyCharge(this.town, 'a10')) this.saveSoon();
    });
    y += 25;
    this.buttons['buyArty'] = makeButton(this, x0 + pad, y, bw, 22, '', () => {
      if (buyCharge(this.town, 'arty')) this.saveSoon();
    });
    y += 29;

    this.buttons['research'] = makeButton(this, x0 + pad, y, half, 22, 'RESEARCH [T]', () =>
      this.showResearch(),
    );
    this.buttons['missions'] = makeButton(this, x0 + pad + half + 6, y, half, 22, 'OPS MAP [M]', () =>
      this.showMissions(),
    );
    y += 26;

    this.buttons['mission'] = makeButton(this, x0 + pad, y, bw, 24, '', () => this.launchMission());
    y += 28;
    this.buttons['skirmish'] = makeButton(this, x0 + pad, y, half, 20, '', () =>
      this.launchSkirmish(),
    );
    this.buttons['frontline'] = makeButton(this, x0 + pad + half + 6, y, half, 20, '', () =>
      this.openFrontline(),
    );
    y += 24;

    const sixth = (bw - 30) / 6;
    const slotX = (i: number) => x0 + pad + i * (sixth + 6);
    this.buttons['export'] = makeButton(this, slotX(0), y, sixth, 20, 'EXP', () =>
      downloadSave(this.town),
    );
    this.buttons['import'] = makeButton(this, slotX(1), y, sixth, 20, 'IMP', () => {
      void pickAndImportSave().then((imported) => {
        if (imported) {
          this.town = imported;
          tick(this.town, Date.now());
          saveTown(this.town);
          this.selectedId = null;
          this.setBanner('SAVE IMPORTED.', 6);
        }
      });
    });
    this.buttons['reset'] = makeButton(this, slotX(2), y, sixth, 20, 'RST', () => this.onReset());
    this.buttons['log'] = makeButton(this, slotX(3), y, sixth, 20, 'LOG', () =>
      this.showDefenseLog(),
    );
    this.buttons['sfx'] = makeButton(this, slotX(4), y, sixth, 20, '', () => this.toggleSfx());
    this.buttons['cb'] = makeButton(this, slotX(5), y, sixth, 20, '', () => this.toggleColorblind());
    y += 26;

    this.bannerText = this.add.text(
      x0 + pad,
      y,
      '',
      mono(9, COLORS.signal, { lineSpacing: 3, wordWrap: { width: bw } }),
    );
    this.refreshSettingsButtons();
  }

  private refreshSettingsButtons(): void {
    const settings = loadSettings();
    this.buttons['sfx']?.setLabel(settings.mute ? 'SFX✗' : 'SFX✓');
    this.buttons['cb']?.setLabel(settings.colorblind ? 'CB✓' : 'CB');
  }

  private toggleSfx(): void {
    const settings = loadSettings();
    settings.mute = !settings.mute;
    saveSettings(settings);
    applySettings(settings);
    this.refreshSettingsButtons();
  }

  private toggleColorblind(): void {
    const settings = loadSettings();
    settings.colorblind = !settings.colorblind;
    saveSettings(settings);
    applySettings(settings);
    // Repaint everything in the new hostile palette.
    this.scene.restart({});
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
      this.buttons['reset']?.setLabel('?!');
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
    this.warText.setText(
      mission
        ? `NEXT: M${mission.index + 1} ${mission.codename} · ${town.victories}W ${town.defeats}L`
        : `CAMPAIGN COMPLETE · SKIRMISH LV ${town.assaultLevel} · ${town.victories}W ${town.defeats}L`,
    );
    this.suppliesText.setText(
      `SUPPLIES ${Math.floor(town.supplies)}/${cap.supplies}  (+${rate.supplies}/min)`,
    );
    this.fuelText.setText(`FUEL     ${Math.floor(town.fuel)}/${cap.fuel}  (+${rate.fuel}/min)`);
    this.intelText.setText(
      `INTEL    ${Math.floor(town.intel)}/${cap.intel}  (+${rate.intel}/min)`,
    );
    this.intelText.setColor(css(rate.intel > 0 ? COLORS.ink : COLORS.inkDim));

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

    const g = gating(town);
    for (const kind of BUILDABLE_KINDS) {
      const meta = this.meta(kind)!;
      const cost = meta.levels[0]!;
      const max = g.counts[kind] ?? 0;
      const have = countOf(town, kind);
      const costText = cost.fuel > 0 ? `${cost.supplies}S+${cost.fuel}F` : `${cost.supplies}S`;
      const button = this.buttons[kind]!;
      if (!isUnlocked(town, kind)) {
        const at = this.unlockAt(kind);
        button.setLabel(
          `${meta.name.toUpperCase()} — LOCKED${at !== undefined ? ` (M${at + 1})` : ''}`,
        );
        button.setEnabled(false);
        continue;
      }
      button.setLabel(`${meta.name.toUpperCase()} ${costText} — ${have}/${max}`);
      button.setEnabled(
        max > 0 && have < max && town.supplies >= cost.supplies && town.fuel >= cost.fuel,
      );
    }
    this.buttons['wall']?.setLabel(`WALL 10S ${town.walls.length}/${g.walls}`);
    this.buttons['wall']?.setEnabled(town.walls.length < g.walls && town.supplies >= 10);

    // Selected structure card.
    const s = this.selected();
    if (s) {
      const meta = this.meta(s.kind);
      const lines: string[] = [`${meta?.name.toUpperCase() ?? s.kind} — LV ${s.level}`];
      if (s.wrecked) {
        const cost = repairCost(this.town, s);
        lines.push('STATUS: WRECKED', `REPAIR: ${cost.supplies}S+${cost.fuel}F`);
      } else if (s.buildEndsAt !== undefined) {
        const secs = Math.max(0, Math.ceil((s.buildEndsAt - now) / 1000));
        lines.push(s.upgradingTo ? `UPGRADING → LV ${s.upgradingTo}: ${secs}s` : `BUILDING: ${secs}s`);
      } else {
        lines.push('STATUS: OPERATIONAL');
      }
      if (meta?.generatesSupplies) lines.push(`OUTPUT: ${meta.generatesSupplies[s.level - 1]} SUP/min`);
      if (meta?.generatesFuel) lines.push(`OUTPUT: ${meta.generatesFuel[s.level - 1]} FUEL/min`);
      if (meta?.generatesIntel) lines.push(`OUTPUT: ${meta.generatesIntel[s.level - 1]} INTEL/min`);
      if (meta?.storage) {
        const t = meta.storage[s.level - 1]!;
        lines.push(`STORAGE: +${t.supplies}S +${t.fuel}F`);
      }
      if (meta?.intelCap) lines.push(`INTEL CAP: +${meta.intelCap[s.level - 1]}`);
      if (meta?.buildSpeed) lines.push(`BUILD SPEED: −${Math.round(meta.buildSpeed[s.level - 1]! * 100)}%`);
      const err = upgradeError(town, s);
      if (err === null) {
        const cost = meta!.levels[s.level]!;
        lines.push(`UPGRADE: ${cost.supplies}S+${cost.fuel}F, ${cost.seconds}s`);
      } else if (err === 'locked') {
        const at = this.unlockAt(`cc${s.level + 1}`);
        lines.push(`UPGRADE: REQUISITION${at !== undefined ? ` AT M${at + 1}` : ' PENDING'}`);
      } else if (err === 'max' && s.kind !== 'cc') {
        lines.push(ccLevel(town) < 3 ? 'UPGRADE: NEEDS CC LEVEL UP' : 'MAX LEVEL');
      }
      this.selectedText.setText(lines.join('\n'));
      this.buttons['upgradeBtn']?.setEnabled(err === null);
      this.buttons['moveBtn']?.setEnabled(s.kind !== 'cc');
      this.buttons['sellBtn']?.setEnabled(s.kind !== 'cc');
      this.buttons['repairBtn']?.setEnabled(
        s.wrecked && town.supplies >= repairCost(town, s).supplies && town.fuel >= repairCost(town, s).fuel,
      );
    } else {
      this.selectedText.setText('Click a structure to inspect.\nThe CC gates counts and levels.');
      for (const key of ['upgradeBtn', 'moveBtn', 'sellBtn', 'repairBtn']) {
        this.buttons[key]?.setEnabled(false);
      }
    }

    const powers = defenseCatalogFor(town.faction).powers;
    for (const [key, power] of [
      ['buyA10', 'a10'],
      ['buyArty', 'arty'],
    ] as const) {
      const stock = town.charges[power] ?? 0;
      const price = CHARGE_PRICES[power]!;
      const def = powers[power]!;
      const name = (def.short ?? def.name).toUpperCase();
      if (!isUnlocked(town, power)) {
        const at = this.unlockAt(power);
        this.buttons[key]?.setLabel(`${name} — LOCKED${at !== undefined ? ` (M${at + 1})` : ''}`);
        this.buttons[key]?.setEnabled(false);
        continue;
      }
      this.buttons[key]?.setLabel(`${name} ×${stock}/${CHARGE_CAP} — BUY ${price}F`);
      this.buttons[key]?.setEnabled(stock < CHARGE_CAP && town.fuel >= price);
    }

    if (mission) {
      this.buttons['mission']?.setLabel(`MISSION ${mission.index + 1}: ${mission.codename} [SPACE]`);
      this.buttons['mission']?.setEnabled(!this.demoMode && town.campaign.difficulty !== null);
    } else {
      this.buttons['mission']?.setLabel('CAMPAIGN COMPLETE');
      this.buttons['mission']?.setEnabled(false);
    }
    if (this.skirmishUnlocked()) {
      this.buttons['skirmish']?.setLabel(`SKIRMISH L${town.assaultLevel}`);
      this.buttons['skirmish']?.setEnabled(!this.demoMode);
    } else {
      this.buttons['skirmish']?.setLabel('SKIRMISH (M2)');
      this.buttons['skirmish']?.setEnabled(false);
    }
    if (!isUnlocked(town, 'frontline')) {
      const at = this.unlockAt('frontline');
      this.buttons['frontline']?.setLabel(`FRONT${at !== undefined ? ` (M${at + 1})` : ''}`);
      this.buttons['frontline']?.setEnabled(false);
    } else if (town.frontline.pendingCounterattack) {
      this.buttons['frontline']?.setLabel('⚠ DEFEND [F]');
      this.buttons['frontline']?.setEnabled(!this.demoMode);
    } else {
      this.buttons['frontline']?.setLabel(`FRONT T${town.frontline.tier} [F]`);
      this.buttons['frontline']?.setEnabled(!this.demoMode);
    }

    // Research button: live status of the one running project.
    const active = town.research.active;
    if (active) {
      const secs = Math.max(0, Math.ceil((active.endsAt - now) / 1000));
      const name = TECH_BY_ID[active.id]?.name.toUpperCase() ?? active.id;
      this.buttons['research']?.setLabel(`${name.slice(0, 9)}… ${secs}s`);
    } else {
      this.buttons['research']?.setLabel(hasRadar(town) ? 'RESEARCH [T]' : 'RESEARCH —');
    }
    this.buttons['research']?.setEnabled(!this.demoMode);
    this.buttons['missions']?.setEnabled(!this.demoMode && town.campaign.difficulty !== null);

    if (Date.now() > this.resetArmedUntil && this.buttons['reset']) {
      this.buttons['reset'].setLabel('RST');
    }
    this.bannerText.setText(
      this.bannerTtl > 0
        ? this.banner
        : 'LMB use tool · RMB/ESC select · T research · M ops map · F front line',
    );
    this.bannerText.setColor(css(this.bannerTtl > 0 ? COLORS.signal : COLORS.inkDim));
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
  town.supplies = 740;
  town.fuel = 210;
  town.intel = 85;
  town.research.completed = ['fortify1'];
  town.research.active = { id: 'logistics1', endsAt: now + 48_000 };
  town.lastSeen = now;
  return town;
}
