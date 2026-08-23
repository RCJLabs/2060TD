import Phaser from 'phaser';
import { bonusMet, missionSiege, type MissionDef } from '../../content/campaign';
import { campaignFor, defenseCatalogFor, flavorFor, type FactionId } from '../../content/factions';
import { HOLD_THE_LINE } from '../../content/missions';
import { outcomeFromEngine } from '../../meta/town';
import { DT, Engine } from '../../sim/engine';
import type { SimConfig, SimEvent } from '../../sim/types';
import { audio } from '../audio';
import { BattleRenderer, type GhostPreview, type PowerPreview } from '../BattleRenderer';
import { COLORS, css } from '../palette';
import { BoardView } from '../BoardView';
import { layoutOf, onLayoutChange, type Layout } from '../layout';
import { Overlay } from '../overlay';
import { makeButton, mono, Panel, type Button, type PanelRow } from '../ui';

export type BattleTag =
  | { type: 'mission'; missionId: string }
  | { type: 'skirmish' }
  | { type: 'counter' };

export interface SiegeLaunchData {
  /** Battle built from the town (meta/town). Absent = standalone. */
  config?: SimConfig;
  fromTown?: boolean;
  battle?: BattleTag;
  /** Whose defense kit fights this battle (default 'usa'). */
  faction?: FactionId;
}

const CELL = 32;
const GRID_W = 32;
const GRID_H = 24;
/** Panel tabs: build items, ordnance, and the running sitrep. */
const SIEGE_TABS = [
  { id: 'deploy', label: 'DEPLOY' },
  { id: 'fire', label: 'FIRE' },
  { id: 'intel', label: 'INTEL' },
  { id: 'ctrl', label: 'CTRL' },
];

type Tool =
  | { type: 'wall'; kind: string }
  | { type: 'structure'; kind: string }
  | { type: 'erase' }
  | { type: 'power'; kind: string };

const SETUP_TOOL_KEYS = ['wall', 'm2nest', 'autocannon', 'mortar', 'aa'] as const;
const COMBAT_TOOL_KEYS = ['depmg', 'foxhole', 'claymore', 'hesco', 'manpads'] as const;

/**
 * M1: the siege vertical slice. Build the permanent layer in setup/prep with
 * Supplies; fight waves live with CP-bought field defenses and powers.
 */
export class SiegeScene extends Phaser.Scene {
  private engine!: Engine;
  private battle!: BattleRenderer;
  private accumulator = 0;
  private speedMult = 1;
  private tool: Tool | null = null;
  private showPaths = true;
  private demoMode = false;
  private lastPaintedCell = -1;
  private overlayShown = false;
  private fromTown = false;
  private launchConfig: SimConfig | null = null;
  private battleTag: BattleTag | null = null;
  private faction: FactionId = 'usa';
  private paused = false;
  private pausedText!: Phaser.GameObjects.Text;

  private board!: BoardView;
  private panel!: Panel;
  private layout!: Layout;
  private drawerOpen = true;
  private primary!: Button;
  private overlay: Overlay | null = null;
  private buttons: Record<string, Button> = {};

  constructor() {
    super('siege');
  }

  init(data: SiegeLaunchData): void {
    this.launchConfig = data?.config ?? null;
    this.fromTown = data?.fromTown ?? false;
    this.battleTag = data?.battle ?? null;
    const urlFaction = new URLSearchParams(window.location.search).get('faction');
    this.faction =
      data?.faction ??
      (urlFaction === 'china' || urlFaction === 'russia' || urlFaction === 'nk' || urlFaction === 'un'
        ? urlFaction
        : 'usa');
    this.paused = false;
  }

  private get mission(): MissionDef | null {
    if (this.battleTag?.type !== 'mission') return null;
    return (
      campaignFor(this.faction).find(
        (m) => m.id === (this.battleTag as { missionId: string }).missionId,
      ) ?? null
    );
  }

  create(): void {
    this.demoMode =
      !this.fromTown && new URLSearchParams(window.location.search).get('demo') === '1';
    this.tool = null;
    this.speedMult = 1;
    this.accumulator = 0;
    this.overlayShown = false;
    this.buttons = {};

    // Standalone battles fight the faction's own war: USA gets the tuned
    // HOLD THE LINE demo; the others get their armor mission at strength.
    const standaloneSiege =
      this.faction === 'usa'
        ? HOLD_THE_LINE
        : {
            ...missionSiege(campaignFor(this.faction)[4]!, 'standard'),
            name:
              this.faction === 'china'
                ? 'HOLD THE SAND (SANDBOX)'
                : this.faction === 'nk'
                  ? 'HOLD THE GROUND (SANDBOX)'
                  : this.faction === 'un'
                    ? 'HOLD THE CORRIDOR (SANDBOX)'
                    : 'HOLD THE CONCRETE (SANDBOX)',
            startingSupplies: HOLD_THE_LINE.startingSupplies,
          };
    const config: SimConfig = this.launchConfig ?? {
      width: GRID_W,
      height: GRID_H,
      seed: this.demoMode ? 1337 : Date.now() >>> 0,
      ccOrigin: 11 * GRID_W + 27,
      spawnColumn: 0,
      siege: standaloneSiege,
    };
    this.engine = new Engine(config, defenseCatalogFor(this.faction));
    this.board = new BoardView(this, { cols: GRID_W, rows: GRID_H, cell: CELL });
    this.battle = new BattleRenderer(this, this.engine, CELL, false, this.board.world);

    this.panel = new Panel(this, this.board.ui, SIEGE_TABS);
    this.panel.onDrawerToggle = () => {
      this.drawerOpen = !this.drawerOpen;
      this.applyLayout();
    };
    // The one action that must always be under a thumb.
    this.primary = makeButton(this, 0, 0, 10, 10, '', () => this.advancePhase(), {
      align: 'center',
      container: this.board.ui,
    });
    this.pausedText = this.add
      .text(0, 0, 'HOLDING', {
        ...mono(24, COLORS.ink, { fontStyle: 'bold', backgroundColor: css(COLORS.bgPanel) }),
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.board.ui.add(this.pausedText);

    this.applyLayout();
    onLayoutChange(this, () => this.applyLayout());
    this.bindInput();

    if (this.demoMode) this.applyDemoScript();
  }

  private applyLayout(): void {
    this.layout = layoutOf(this, this.drawerOpen);
    this.board.applyLayout(this.layout, true);
    this.panel.applyLayout(this.layout);
    const { board, pad, rowH, font } = this.layout;
    const w = Math.min(board.w - pad * 2, this.layout.px(320));
    this.primary.setRect(board.x + (board.w - w) / 2, board.y + board.h - rowH - pad, w, rowH);
    this.primary.setFont(font.body);
    this.pausedText.setPosition(board.x + board.w / 2, board.y + board.h / 2).setFontSize(font.title);
    if (this.overlay) {
      this.overlay.close();
      this.overlay = null;
      this.overlayShown = false;
      this.showOverlay(this.engine.phase === 'victory');
    }
  }

  // ---- demo (screenshots & smoke tests) ------------------------------------------

  /** A scripted battle: funnel base, assault started, fast-forwarded into wave 2. */
  private applyDemoScript(): void {
    const e = this.engine;
    const idx = (x: number, y: number) => e.grid.idx(x, y);
    const wall = (x: number, y: number) =>
      e.enqueue({ tick: 0, type: 'placeWall', cell: idx(x, y), kind: 'wall' });

    for (let y = 2; y <= 10; y++) wall(20, y);
    for (let y = 14; y <= 22; y++) wall(20, y);
    for (let y = 8; y <= 10; y++) wall(24, y);
    for (let y = 14; y <= 16; y++) wall(24, y);
    e.enqueue({ tick: 0, type: 'placeStructure', cell: idx(22, 10), kind: 'm2nest' });
    e.enqueue({ tick: 0, type: 'placeStructure', cell: idx(22, 13), kind: 'm2nest' });
    e.enqueue({ tick: 0, type: 'placeStructure', cell: idx(25, 12), kind: 'autocannon' });
    e.enqueue({ tick: 0, type: 'placeStructure', cell: idx(26, 9), kind: 'mortar' });
    e.enqueue({ tick: 0, type: 'placeStructure', cell: idx(25, 15), kind: 'aa' });
    e.enqueue({ tick: 0, type: 'startAssault' });

    // Jump into mid-wave-2 so screenshots land on the action even when the
    // headless browser renders few frames.
    while (
      !(e.waveIndex === 1 && e.phase === 'combat' && e.waveTick >= 240) &&
      e.phase !== 'defeat' &&
      e.tick < 8000
    ) {
      e.step();
    }
    // Live-window actions: field defenses drop in and a fire mission lands
    // on the gate while the first frames render.
    e.command({ tick: e.tick + 3, type: 'placeStructure', cell: idx(21, 11), kind: 'depmg' });
    e.command({ tick: e.tick + 5, type: 'placeStructure', cell: idx(19, 12), kind: 'claymore' });
    e.command({ tick: e.tick + 10, type: 'castPower', kind: 'arty', target: { x: 19.5, y: 12.5 } });


  }

  // ---- input ----------------------------------------------------------------------

  private bindInput(): void {
    this.board.onTap((col, row) => this.handleCell(col, row, true));
    this.board.onPaint((col, row) => this.handleCell(col, row, false));
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) this.setTool(null);
    });

    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', () => this.setTool(null));
    kb?.on('keydown-ONE', () => this.selectToolSlot(0));
    kb?.on('keydown-TWO', () => this.selectToolSlot(1));
    kb?.on('keydown-THREE', () => this.selectToolSlot(2));
    kb?.on('keydown-FOUR', () => this.selectToolSlot(3));
    kb?.on('keydown-E', () => this.setTool({ type: 'erase' }));
    kb?.on('keydown-Q', () => this.armPower('a10'));
    kb?.on('keydown-W', () => this.armPower('arty'));
    kb?.on('keydown-SPACE', () => this.advancePhase());
    kb?.on('keydown-P', () => {
      this.showPaths = !this.showPaths;
    });
    kb?.on('keydown-S', () => this.cycleSpeed());
    kb?.on('keydown-F', () => this.togglePause());
    kb?.on('keydown-R', () => {
      // Town battles have consequences — no free restarts.
      if (!this.fromTown) this.scene.restart({});
    });
  }

  private selectToolSlot(slot: number): void {
    const inCombat = this.engine.phase === 'combat';
    const keys = inCombat ? COMBAT_TOOL_KEYS : SETUP_TOOL_KEYS;
    const kind = keys[slot];
    if (!kind) return;
    if (kind === 'wall' || kind === 'hesco') this.setTool({ type: 'wall', kind });
    else this.setTool({ type: 'structure', kind });
  }

  private armPower(kind: string): void {
    if (this.engine.canCastPower(kind)) this.setTool({ type: 'power', kind });
  }

  private advancePhase(): void {
    const phase = this.engine.phase;
    if (phase === 'setup') this.engine.command({ type: 'startAssault' });
    else if (phase === 'prep') this.engine.command({ type: 'skipPrep' });
    else if ((phase === 'victory' || phase === 'defeat') && this.fromTown) this.returnToTown();
  }

  private returnToTown(): void {
    this.scene.start('town', {
      outcome: outcomeFromEngine(this.engine),
      battle: this.battleTag ?? { type: 'skirmish' },
    });
  }

  private togglePause(): void {
    const phase = this.engine.phase;
    if (phase === 'victory' || phase === 'defeat') return;
    this.paused = !this.paused;
    this.pausedText.setVisible(this.paused);
  }

  private setTool(tool: Tool | null): void {
    // Tapping the armed tool's button again disarms it — the touch-device
    // stand-in for right-click/ESC.
    if (
      tool !== null &&
      this.tool !== null &&
      tool.type === this.tool.type &&
      ('kind' in tool ? tool.kind : null) === ('kind' in this.tool ? this.tool.kind : null)
    ) {
      tool = null;
    }
    this.tool = tool;
    // Walls and the eraser paint across a drag; everything else leaves the
    // drag to the camera so the board can still be panned mid-build.
    this.board.paintMode = tool?.type === 'wall' || tool?.type === 'erase';
    this.lastPaintedCell = -1;
  }

  private handleCell(cellX: number, cellY: number, isTap: boolean): void {
    if (!this.tool || this.overlay) return;
    const cell = this.engine.grid.idx(cellX, cellY);

    if (this.tool.type === 'power') {
      if (!isTap) return;
      this.engine.command({
        type: 'castPower',
        kind: this.tool.kind,
        // Aim at the cell centre: a fingertip is wider than a pixel.
        target: { x: cellX + 0.5, y: cellY + 0.5 },
      });
      this.setTool(null);
      return;
    }

    if (cell === this.lastPaintedCell && !isTap) return;
    this.lastPaintedCell = cell;

    if (this.tool.type === 'wall') {
      this.engine.command({ type: 'placeWall', cell, kind: this.tool.kind });
    } else if (this.tool.type === 'erase') {
      if (this.engine.grid.wallAt(cell)) this.engine.command({ type: 'removeWall', cell });
      else this.engine.command({ type: 'removeStructure', cell });
    } else if (isTap) {
      // Structures place on tap only — drag-placing towers is a misclick machine.
      this.engine.command({ type: 'placeStructure', cell, kind: this.tool.kind });
    }
  }

  private cycleSpeed(): void {
    this.speedMult = this.speedMult >= 8 ? 1 : this.speedMult * 2;
  }

  // ---- sim stepping ------------------------------------------------------------------

  override update(_time: number, deltaMs: number): void {
    if (this.paused) {
      this.battle.draw(1, deltaMs / 1000, { showPaths: this.showPaths });
      this.updateHud();
      return;
    }
    this.accumulator += (deltaMs / 1000) * this.speedMult;
    let safety = 12;
    while (this.accumulator >= DT && safety-- > 0) {
      this.accumulator -= DT;
      const events = this.engine.step();
      this.battle.consumeEvents(events);
      this.handleEvents(events);
    }
    if (this.accumulator > DT) this.accumulator = 0;

    const alpha = Phaser.Math.Clamp(this.accumulator / DT, 0, 1);
    this.battle.draw(alpha, deltaMs / 1000, {
      showPaths: this.showPaths,
      ghost: this.currentGhost(),
      powerPreview: this.currentPowerPreview(),
    });
    this.updateHud();
  }

  private handleEvents(events: SimEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'assaultStarted':
        case 'waveStarted':
        case 'prepStarted':
          // Phase flips retarget the deploy tab (fortify ⇄ field deploy).
          this.setTool(null);
          // setTab on the *current* tab collapses the drawer, so only move.
          if (this.panel.tab !== 'deploy') this.panel.setTab('deploy');
          break;
        case 'victory':
          this.showOverlay(true);
          break;
        case 'defeat':
          this.showOverlay(false);
          break;
        default:
          break;
      }
    }
  }

  private currentGhost(): GhostPreview | undefined {
    if (!this.tool || this.tool.type === 'power') return undefined;
    const pointer = this.input.activePointer;
    const at = this.board.cellAt(pointer);
    if (!at) return undefined;
    const cell = this.engine.grid.idx(Math.floor(pointer.x / CELL), Math.floor(pointer.y / CELL));

    if (this.tool.type === 'erase') {
      const erasable =
        this.engine.grid.wallAt(cell) !== undefined ||
        (this.engine.structureAt(cell) !== undefined &&
          this.engine.structureAt(cell)!.profile.kind !== 'cc');
      return { cell, kind: 'erase', valid: erasable };
    }
    if (this.tool.type === 'wall') {
      return { cell, kind: this.tool.kind, valid: this.engine.canPlaceWall(this.tool.kind, cell) };
    }
    return {
      cell,
      kind: this.tool.kind,
      valid: this.engine.canPlaceStructure(this.tool.kind, cell),
    };
  }

  private currentPowerPreview(): PowerPreview | undefined {
    if (this.tool?.type !== 'power') return undefined;
    const pointer = this.input.activePointer;
    const at = this.board.cellAt(pointer);
    if (!at) return undefined;
    return { kind: this.tool.kind, at: { x: at.col + 0.5, y: at.row + 0.5 } };
  }

  // ---- panel -----------------------------------------------------------------------------

  // ---- panel rows -------------------------------------------------------------

  private toolRow(kind: string, isWall: boolean, key: string): PanelRow {
    const e = this.engine;
    const def = isWall ? e.catalog.walls[kind]! : e.catalog.structures[kind]!;
    const cpCost = def.cpCost;
    const supplyCost = (def as { supplyCost?: number }).supplyCost;
    const cost = cpCost !== undefined ? `${cpCost} CP` : `${supplyCost ?? 0} SUP`;
    const affordable =
      cpCost !== undefined ? e.cp >= e.cpPrice(cpCost) : e.supplies >= (supplyCost ?? 0);
    const armed =
      this.tool !== null && 'kind' in this.tool && this.tool.kind === kind && this.tool.type !== 'power';
    return {
      id: kind,
      label: `${def.name.toUpperCase()} [${key}]`,
      sub: cost,
      enabled: affordable,
      active: armed,
      onTap: () => this.setTool(isWall ? { type: 'wall', kind } : { type: 'structure', kind }),
    };
  }

  private rowsForTab(): PanelRow[] {
    const e = this.engine;
    const build = e.phase === 'setup' || e.phase === 'prep';
    switch (this.panel.tab) {
      case 'deploy': {
        const rows: PanelRow[] = [
          { id: 'h', label: build ? 'FORTIFY (SUPPLIES)' : 'FIELD DEPLOY (CP)', heading: true },
        ];
        const keys = build ? SETUP_TOOL_KEYS : COMBAT_TOOL_KEYS;
        keys.forEach((kind, i) => {
          rows.push(this.toolRow(kind, kind === 'wall' || kind === 'hesco', String(i + 1)));
        });
        if (build) {
          const cost = e.repairAllCost();
          rows.push(
            {
              id: 'erase',
              label: 'ERASE / REFUND [E]',
              active: this.tool?.type === 'erase',
              onTap: () => this.setTool({ type: 'erase' }),
            },
            {
              id: 'repair',
              label: 'REPAIR ALL',
              sub: cost > 0 ? `${cost} SUP` : 'INTACT',
              enabled: cost > 0 && e.supplies >= cost,
              onTap: () => e.command({ type: 'repairAll' }),
            },
          );
        }
        return rows;
      }
      case 'fire': {
        const rows: PanelRow[] = [{ id: 'h', label: 'COMMANDER POWERS', heading: true }];
        for (const kind of ['a10', 'arty'] as const) {
          const def = e.catalog.powers[kind]!;
          const cd = e.powerCooldownSeconds(kind);
          const charges = e.powerChargesLeft(kind);
          const stock = charges !== null ? ` ×${charges}` : '';
          rows.push({
            id: kind,
            label: `${(def.short ?? def.name).toUpperCase()} [${kind === 'a10' ? 'Q' : 'W'}]`,
            sub: cd > 0 ? `${Math.ceil(cd)}s${stock}` : `${def.cpCost} CP${stock}`,
            enabled: cd <= 0 && e.canCastPower(kind),
            active: this.tool?.type === 'power' && this.tool.kind === kind,
            onTap: () => this.armPower(kind),
          });
        }
        rows.push({ id: 'hint', label: 'Arm a power, then tap the map.', heading: true });
        return rows;
      }
      case 'intel': {
        const rows: PanelRow[] = [];
        const preview = e.nextWavePreview();
        if (preview) {
          const waveNumber = e.phase === 'setup' ? 1 : e.waveIndex + 2;
          rows.push({ id: 'h', label: `INBOUND — WAVE ${waveNumber}/${e.waveCount}`, heading: true });
          for (const { kind, count } of preview) {
            rows.push({
              id: `p${kind}`,
              label: `  ${count}× ${e.catalog.attackers[kind]?.name.toUpperCase() ?? kind}`,
              heading: true,
            });
          }
        }
        const integrity = Math.max(0, Math.round((e.cc.hp / e.cc.profile.maxHp) * 100));
        rows.push(
          { id: 'h2', label: 'SITREP', heading: true },
          { id: 's1', label: `CC INTEGRITY ${integrity}%`, heading: true },
          { id: 's2', label: `KILLS ${e.stats.kills} / ${e.stats.spawned} SPAWNED`, heading: true },
          { id: 's3', label: `WALLS LOST ${e.stats.wallsLost}`, heading: true },
          { id: 's4', label: `GUNS LOST ${e.stats.structuresLost}`, heading: true },
          { id: 's5', label: `SUP SPENT ${e.stats.suppliesSpent}`, heading: true },
          { id: 's6', label: `CP SPENT ${Math.round(e.stats.cpSpent)}`, heading: true },
        );
        if (e.phase === 'combat') {
          rows.push({ id: 's7', label: `HOSTILES ON FIELD ${e.attackers.length}`, heading: true });
        }
        return rows;
      }
      default:
        return [
          { id: 'h', label: 'BATTLE CONTROL', heading: true },
          {
            id: 'speed',
            label: `SPEED ×${this.speedMult}`,
            sub: '[S]',
            onTap: () => this.cycleSpeed(),
          },
          {
            id: 'pause',
            label: this.paused ? 'RESUME' : 'HOLD',
            sub: '[F]',
            active: this.paused,
            onTap: () => this.togglePause(),
          },
          {
            id: 'paths',
            label: 'PATH MARKERS',
            sub: '[P]',
            active: this.showPaths,
            onTap: () => {
              this.showPaths = !this.showPaths;
            },
          },
          { id: 'h2', label: 'VIEW', heading: true },
          { id: 'fit', label: 'FIT VIEW', onTap: () => this.board.fit() },
          ...(this.fromTown
            ? []
            : [
                {
                  id: 'restart',
                  label: 'RESTART BATTLE',
                  sub: '[R]',
                  onTap: () => this.scene.restart({}),
                } as PanelRow,
              ]),
        ];
    }
  }

  private updateHud(): void {
    const e = this.engine;
    const siege = e.config.siege ?? HOLD_THE_LINE;

    let phase: string;
    switch (e.phase) {
      case 'setup':
        phase = 'FORTIFY';
        break;
      case 'combat':
        phase = `WAVE ${e.waveIndex + 1}/${e.waveCount} — CONTACT`;
        break;
      case 'prep':
        phase = `PREP — WAVE IN ${Math.ceil(e.prepTicksLeft / 20)}s`;
        break;
      case 'victory':
        phase = 'SECTOR HELD';
        break;
      case 'defeat':
        phase = 'CC DESTROYED';
        break;
      default:
        phase = e.phase.toUpperCase();
        break;
    }

    const cpFrac = Math.round(Math.min(1, e.cp / siege.cpCap) * 100);
    this.panel.setStatus(
      `${siege.name}`,
      this.layout.mode === 'portrait'
        ? [`${phase} · SUP ${Math.floor(e.supplies)} · CP ${Math.floor(e.cp)}`]
        : [phase, `SUPPLIES ${Math.floor(e.supplies)}`, `CP ${Math.floor(e.cp)} (${cpFrac}%)`],
    );
    this.panel.setRows(this.rowsForTab());

    // The primary action: whatever the phase is waiting on.
    const label =
      e.phase === 'setup'
        ? 'START ASSAULT'
        : e.phase === 'prep'
          ? 'SKIP PREP'
          : (e.phase === 'victory' || e.phase === 'defeat') && this.fromTown
            ? 'RETURN TO BASE'
            : '';
    this.primary.setVisible(label !== '');
    if (label) this.primary.setLabel(label);
  }

  private showOverlay(victory: boolean): void {
    if (this.overlayShown) return;
    this.overlayShown = true;
    this.paused = false;
    this.pausedText.setVisible(false);
    audio.sfx(victory ? 'victory' : 'defeat');

    const mission = this.mission;
    const s = this.engine.stats;
    const lines: string[] = [];
    if (mission) {
      lines.push(...(victory ? mission.debriefVictory : mission.debriefDefeat), '');
    } else {
      const flavor = flavorFor(this.faction);
      lines.push(victory ? flavor.heldLine : flavor.brokeLine, '');
    }
    lines.push(
      `Hostiles destroyed: ${s.kills} / ${s.spawned}`,
      `Walls lost: ${s.wallsLost}   Structures lost: ${s.structuresLost}`,
    );
    if (!victory && s.ccKillerKind) lines.push(`Command Center lost to: ${s.ccKillerKind}`);
    if (victory && s.salvage > 0) lines.push(`Unspent CP salvaged: +${s.salvage} SUP`);
    if (mission?.bonus) {
      const achieved = bonusMet(mission.bonus.id, outcomeFromEngine(this.engine));
      lines.push(
        '',
        `BONUS ${victory && achieved ? 'ACHIEVED (+50% REWARD)' : 'MISSED'} — ${mission.bonus.label}`,
      );
    }
    if (mission && victory) {
      const reward = mission.reward;
      lines.push(
        `REWARD: ${reward.supplies} SUP${reward.fuel > 0 ? ` + ${reward.fuel} FUEL` : ''} (before bonus)`,
      );
      if (mission.unlockNote) lines.push(mission.unlockNote);
    }

    const ov = new Overlay(this, this.layout, {
      title: victory ? 'SECTOR HELD' : 'COMMAND CENTER LOST',
      subtitle: mission ? `M${mission.index + 1} — ${mission.codename}` : 'AFTER ACTION',
      scrim: 0.8,
      container: this.board.ui,
    });
    this.overlay = ov;
    const { font } = this.layout;
    ov.centered(
      ov.flow(Math.round(font.body * 1.6 * lines.length)),
      lines.join('\n'),
      font.body,
      COLORS.ink,
      { lineSpacing: Math.round(font.body * 0.4) },
    );
    ov.footer(this.fromTown ? 'RETURN TO BASE' : 'RUN IT BACK', () => {
      ov.close();
      this.overlay = null;
      if (this.fromTown) this.returnToTown();
      else this.scene.restart({});
    });
  }
}
