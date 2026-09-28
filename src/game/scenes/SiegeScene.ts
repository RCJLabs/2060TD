import { clamp, Scene, type Pointer } from '../stage';
import { music } from '../music';
import { FIRST_SIEGE } from '../../content/tutorial';
import { Coach } from '../coach';
import { bonusMet, missionSiege, type MissionDef } from '../../content/campaign';
import { campaignFor, defenseCatalogFor, flavorFor, type FactionId } from '../../content/factions';
import { HOLD_THE_LINE } from '../../content/missions';
import { outcomeFromEngine, TOWN_GRID } from '../../meta/town';
import { readLines, signalsOf, type Signals } from '../../meta/intel';
import { DT, Engine } from '../../sim/engine';
import { waveModifierOf } from '../../sim/read';
import type { SimConfig, SimEvent } from '../../sim/types';
import { audio } from '../audio';
import { BattleRenderer, type GhostPreview, type PowerPreview } from '../BattleRenderer';
import { COLORS } from '../palette';
import { TERRAIN_VERSION } from '../../sim/terrain';
import { siegeOnBoard } from '../../sim/board';
import { BoardView } from '../BoardView';
import { DRAWER_REST, layoutOf, onLayoutChange, toggleDrawer, type DrawerState, type Layout } from '../layout';
import { createButton, type FreeButton } from '../dom/button';
import { createLabel, type SceneLabel } from '../dom/label';
import { createOverlay, type OverlayApi } from '../dom/overlay';
import { createPanel } from '../dom/panel';
import { buildPowerSpec, buildStructureSpec, buildWallSpec } from '../spec';
import type { PanelApi, PanelRow } from '../rows';

export type BattleTag =
  | { type: 'mission'; missionId: string }
  | { type: 'skirmish' }
  | { type: 'counter' }
  /**
   * A live defence (v1.43): an offered probe the player stood and fought
   * rather than leaving to the garrison. It carries its own config because
   * the town it was built from is about to change underneath it — this
   * battle's identity has to survive the fold that wrecks half of it.
   */
  | { type: 'defense'; level: number; at: number; config: SimConfig }
  /**
   * The last stand at the capital (M25 Phase 4c), fought in person. Its own
   * config for the same reason as a live defence's.
   */
  | { type: 'laststand'; level: number; at: number; config: SimConfig };

export interface SiegeLaunchData {
  /** Battle built from the town (meta/town). Absent = standalone. */
  config?: SimConfig;
  fromTown?: boolean;
  battle?: BattleTag;
  /** Whose defense kit fights this battle (default 'usa'). */
  faction?: FactionId;
  /** Run the first-contact coach over this battle (v1.5). */
  coach?: boolean;
}

const CELL = 32;
// The board is the town's board, not a second opinion about it.
const GRID_W = TOWN_GRID.width;
const GRID_H = TOWN_GRID.height;
/** Panel tabs: build items, ordnance, and the running sitrep. */
const SIEGE_TABS = [
  { id: 'deploy', label: 'DEPLOY' },
  { id: 'fire', label: 'FIRE' },
  { id: 'intel', label: 'INTEL' },
  { id: 'ctrl', label: 'CTRL' },
];

type Tool =
  | { type: 'wall'; kind: string }
  | { type: 'gate' }
  | { type: 'structure'; kind: string }
  | { type: 'erase' }
  | { type: 'power'; kind: string }
  /** Carrying the selected field defence to where it goes next (M35 Phase 2). */
  | { type: 'move'; id: number };

const SETUP_TOOL_KEYS = ['wall', 'gate', 'm2nest', 'autocannon', 'mortar', 'aa'] as const;
const COMBAT_TOOL_KEYS = ['depmg', 'foxhole', 'claymore', 'hesco', 'manpads'] as const;

/**
 * M1: the siege vertical slice. Build the permanent layer in setup/prep with
 * Supplies; fight waves live with CP-bought field defenses and powers.
 */
export class SiegeScene extends Scene {
  private engine!: Engine;
  private battle!: BattleRenderer;
  private accumulator = 0;
  private speedMult = 1;
  private tool: Tool | null = null;
  private showPaths = true;
  /** The next wave's lanes for the board's edge, and the wave they are for. */
  private lanes: readonly number[] | undefined;
  private lanesKey = '';
  /** The field defence the commander has picked out, by id (M35 Phase 2). */
  private selected: number | null = null;
  /**
   * Rebuilds the card on screen, when one is (M35 Phase 2): a spec card is
   * rebuilt at the new size on a layout change, where the end-of-battle card
   * is re-shown. The battle holds while a card is up.
   */
  private cardBuilder: (() => void) | null = null;
  private demoMode = false;
  private lastPaintedCell = -1;
  private overlayShown = false;
  private fromTown = false;
  private launchConfig: SimConfig | null = null;
  private battleTag: BattleTag | null = null;
  private faction: FactionId = 'usa';
  private paused = false;
  private pausedText!: SceneLabel;
  /** First-contact coach (v1.5): only ever on a commander's first battle. */
  private coach: Coach | null = null;
  private wantCoach = false;
  /** Field defenses placed and fire missions called DURING combat. */
  private deployed = 0;
  private casts = 0;

  private board!: BoardView;
  private panel!: PanelApi;
  private layout!: Layout;
  /** The drawer's share of the safe height. See `layout.ts` detents. */
  private drawer: DrawerState = DRAWER_REST;
  private primary!: FreeButton;
  private overlay: OverlayApi | null = null;

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
    this.wantCoach = data?.coach === true;
    this.deployed = 0;
    this.casts = 0;
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
    music.play('battle');
    this.demoMode =
      !this.fromTown && new URLSearchParams(window.location.search).get('demo') === '1';
    this.tool = null;
    this.speedMult = 1;
    this.accumulator = 0;
    this.overlayShown = false;

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
      cellSize: TOWN_GRID.cellSize,
      seed: this.demoMode ? 1337 : Date.now() >>> 0,
      ccOrigin: TOWN_GRID.ccOrigin,
      spawnLane: TOWN_GRID.spawnLane,
      spawnEdge: TOWN_GRID.spawnEdge,
      // Authored in physical positions, like every siege (M34).
      siege: siegeOnBoard(standaloneSiege, TOWN_GRID.cellSize),
      // The sandbox is fought on ground like everything else. Pinned in demo
      // mode so a screenshot run is comparable to the last one.
      terrainSeed: this.demoMode ? 4242 : Date.now() >>> 0,
      terrainVersion: TERRAIN_VERSION,
    };
    this.engine = new Engine(config, defenseCatalogFor(this.faction));
    this.board = new BoardView(this, { cols: GRID_W, rows: GRID_H, cell: CELL });
    this.battle = new BattleRenderer(this, this.engine, CELL, false, this.board.world, {
      live: true,
      view: () => this.board.listener(),
    });
    this.board.passable = (col, row) => this.engine.terrain.passable(row * GRID_W + col);

    this.panel = createPanel(this, SIEGE_TABS);
    this.panel.onDrawerToggle = () => {
      this.drawer = toggleDrawer(this.drawer);
      this.applyLayout();
    };
    // The handle reports a live share while it is being dragged and a snapped
    // one when it is let go; both are just a re-layout at a new height.
    this.panel.onDrawerShare = (share) => {
      this.drawer = share;
      this.applyLayout();
    };
    // The one action that must always be under a thumb.
    this.primary = createButton(this, 0, 0, 10, 10, '', () => this.advancePhase(), {
      emphasis: 'primary',
      align: 'center',
    });
    this.pausedText = createLabel(this, 'HOLDING', {
      size: 24,
      color: COLORS.ink,
      bold: true,
      background: COLORS.bgPanel,
      padX: 18,
      padY: 10,
      originX: 0.5,
      originY: 0.5,
    }).setVisible(false);

    this.applyLayout();
    onLayoutChange(this, () => this.applyLayout());
    this.bindInput();

    // After applyLayout: the coach measures its plate against the board rect,
    // so it cannot be built before there is a layout to measure against.
    this.coach =
      this.wantCoach && !this.demoMode
        ? new Coach(this, this.layout, FIRST_SIEGE)
        : null;

    if (this.demoMode) this.applyDemoScript();
  }

  private applyLayout(): void {
    this.layout = layoutOf(this, this.drawer, 0, 1, this.board.cols / this.board.rows);
    this.board.applyLayout(this.layout, true);
    this.panel.applyLayout(this.layout);
    const { board, pad, rowH, font } = this.layout;
    const w = Math.min(board.w - pad * 2, this.layout.px(320));
    this.primary.setRect(board.x + (board.w - w) / 2, board.y + board.h - rowH - pad, w, rowH);
    this.primary.setFont(font.body);
    this.pausedText.setPosition(board.x + board.w / 2, board.y + board.h / 2).setFontSize(font.title);
    this.coach?.applyLayout(this.layout);
    if (this.overlay) {
      this.overlay.close();
      this.overlay = null;
      if (this.cardBuilder) {
        this.cardBuilder();
      } else {
        this.overlayShown = false;
        this.showOverlay(this.engine.phase === 'victory');
      }
    }
  }

  // ---- demo (screenshots & smoke tests) ------------------------------------------

  /** A scripted battle: funnel base, assault started, fast-forwarded into wave 2. */
  private applyDemoScript(): void {
    const e = this.engine;
    // Approach space: `u` is depth from the line they come down, `v` across it.
    // The funnel has to run ACROSS the advance to be a funnel, which is the one
    // thing a plan written in x and y stops doing the moment the board rotates.
    const at = (u: number, v: number) => e.grid.idx(v, u);
    const wall = (u: number, v: number) =>
      e.enqueue({ tick: 0, type: 'placeWall', cell: at(u, v), kind: 'wall' });

    // Drawn for 10x15 (M34): the outer line with its gap over the post, the
    // inner line split around the post's column, two nests flanking the gap.
    for (let v = 0; v <= 3; v++) wall(10, v);
    for (let v = 6; v <= 8; v++) wall(10, v);
    for (let v = 2; v <= 3; v++) wall(12, v);
    for (let v = 6; v <= 7; v++) wall(12, v);
    e.enqueue({ tick: 0, type: 'placeStructure', cell: at(11, 3), kind: 'm2nest' });
    e.enqueue({ tick: 0, type: 'placeStructure', cell: at(11, 6), kind: 'm2nest' });
    e.enqueue({ tick: 0, type: 'placeStructure', cell: at(14, 5), kind: 'autocannon' });
    e.enqueue({ tick: 0, type: 'placeStructure', cell: at(14, 3), kind: 'mortar' });
    e.enqueue({ tick: 0, type: 'placeStructure', cell: at(13, 7), kind: 'aa' });
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
    e.command({ tick: e.tick + 3, type: 'placeStructure', cell: at(11, 4), kind: 'depmg' });
    e.command({ tick: e.tick + 5, type: 'placeStructure', cell: at(9, 5), kind: 'claymore' });
    // The fire mission lands on the gap in the line, in board coordinates.
    e.command({ tick: e.tick + 10, type: 'castPower', kind: 'arty', target: { x: 5, y: 10.5 } });


  }

  // ---- input ----------------------------------------------------------------------

  private bindInput(): void {
    this.board.onTap((col, row) => this.handleCell(col, row, true));
    this.board.onPaint((col, row) => this.handleCell(col, row, false));
    this.board.onAim((from, to) => this.aimed(from, to));
    this.input.on('pointerdown', (pointer: Pointer) => {
      if (pointer.rightButtonDown()) this.setTool(null);
    });

    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', () => this.setTool(null));
    kb?.on('keydown-ONE', () => this.selectToolSlot(0));
    kb?.on('keydown-TWO', () => this.selectToolSlot(1));
    kb?.on('keydown-THREE', () => this.selectToolSlot(2));
    kb?.on('keydown-FOUR', () => this.selectToolSlot(3));
    // The rows offer five keys in a wave and six before it (M35 Phase 2).
    kb?.on('keydown-FIVE', () => this.selectToolSlot(4));
    kb?.on('keydown-SIX', () => this.selectToolSlot(5));
    // And the selected field defence's three verbs.
    kb?.on('keydown-M', () => this.armMove());
    kb?.on('keydown-X', () => this.sellSelected());
    kb?.on('keydown-U', () => this.upgradeSelected());
    kb?.on('keydown-E', () => this.setTool({ type: 'erase' }));
    kb?.on('keydown-G', () => this.setTool({ type: 'gate' }));
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
    // The gate is a wall piece, as its row places it: key 2 used to arm it as
    // a structure the battle could not place (M35 Phase 2).
    if (kind === 'wall' || kind === 'gate' || kind === 'hesco') this.setTool({ type: 'wall', kind });
    else this.setTool({ type: 'structure', kind });
  }

  // ---- field command (M35 Phase 2) -------------------------------------------------

  /** The selected field defence and what can be done with it, or null (and the selection dropped). */
  private selection(): { cell: number; kind: string; name: string; level: number; move: number; sell: number; upgrade: number | null } | null {
    if (this.selected === null) return null;
    const s = this.engine.structures.find((st) => st.id === this.selected);
    const options = s ? this.engine.fieldOptions(s.origin) : null;
    if (!s || !options) {
      this.selected = null;
      return null;
    }
    return { cell: s.origin, name: s.profile.name, level: s.level, ...options };
  }

  private armMove(): void {
    const sel = this.selection();
    if (sel && this.engine.cp >= sel.move && this.selected !== null) this.setTool({ type: 'move', id: this.selected });
  }

  private sellSelected(): void {
    const sel = this.selection();
    if (!sel) return;
    this.engine.command({ type: 'sellStructure', cell: sel.cell });
    this.selected = null;
    if (this.tool?.type === 'move') this.setTool(null);
  }

  private upgradeSelected(): void {
    const sel = this.selection();
    if (sel && sel.upgrade !== null) this.engine.command({ type: 'upgradeStructure', cell: sel.cell });
  }

  /**
   * An armed power's press, lifted: a tap casts on the cell as it always did,
   * and a drag aims it — the gun run along the drag, the barrage as wide.
   */
  private aimed(from: { x: number; y: number }, to: { x: number; y: number } | null): void {
    if (this.tool?.type !== 'power' || this.overlay) return;
    // Aim at the cell centre: a fingertip is wider than a pixel.
    const target = { x: Math.floor(from.x) + 0.5, y: Math.floor(from.y) + 0.5 };
    this.engine.command({ type: 'castPower', kind: this.tool.kind, target, ...(to ? { toward: to } : {}) });
    if (this.engine.phase === 'combat') this.casts++;
    this.setTool(null);
  }

  /** Open a card over the battle; it is rebuilt if the layout changes, and closes on its footer. */
  private openCard(build: (close: () => void) => OverlayApi | null): void {
    if (this.overlay) return;
    const close = (): void => {
      this.overlay?.close();
      this.overlay = null;
      this.cardBuilder = null;
    };
    this.cardBuilder = () => {
      this.overlay = build(close);
      if (!this.overlay) this.cardBuilder = null;
    };
    this.cardBuilder();
  }

  /** A deploy row's card: the structure or wall as this battle has it. */
  private showSpec(kind: string, wall: boolean): void {
    const opts = { layout: this.layout, catalog: this.engine.catalog };
    this.openCard((onClose) =>
      wall ? buildWallSpec(this, kind, { ...opts, onClose }) : buildStructureSpec(this, kind, { ...opts, onClose }),
    );
  }

  /** A fire row's card, at what this battle charges for the power. */
  private showPowerSpec(kind: string): void {
    const def = this.engine.catalog.powers[kind];
    if (!def) return;
    const cp = this.engine.cpPrice(def.cpCost);
    this.openCard((onClose) => buildPowerSpec(this, kind, { layout: this.layout, catalog: this.engine.catalog, cp, onClose }));
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
    // An armed power is aimed by the drag instead (M35 Phase 2).
    this.board.aimMode = tool?.type === 'power';
    this.lastPaintedCell = -1;
  }

  private handleCell(cellX: number, cellY: number, isTap: boolean): void {
    if (this.overlay) return;
    const cell = this.engine.grid.idx(cellX, cellY);

    // With nothing in hand, a tap picks out a field defence (M35 Phase 2), and
    // anywhere else lets it go. The drawer opens on what can be done with it.
    if (!this.tool) {
      if (!isTap) return;
      const hit = this.engine.structureAt(cell);
      this.selected = hit && this.engine.fieldOptions(cell) ? hit.id : null;
      if (this.selected !== null && this.panel.tab !== 'deploy') this.panel.setTab('deploy');
      return;
    }

    if (this.tool.type === 'move') {
      if (!isTap) return;
      const sel = this.selection();
      if (sel) this.engine.command({ type: 'moveStructure', cell: sel.cell, to: cell });
      this.setTool(null);
      return;
    }

    if (this.tool.type === 'power') {
      if (!isTap) return;
      this.engine.command({
        type: 'castPower',
        kind: this.tool.kind,
        // Aim at the cell centre: a fingertip is wider than a pixel.
        target: { x: cellX + 0.5, y: cellY + 0.5 },
      });
      if (this.engine.phase === 'combat') this.casts++;
      this.setTool(null);
      return;
    }

    if (this.tool.type === 'gate') {
      // Tap only: a gate is a decision, and drag-painting decisions across a
      // wall line is how you spend a fight's worth of CP by accident.
      if (!isTap) return;
      this.engine.command({ type: 'toggleGate', cell });
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
      // Only combat placements are FIELD defenses; the rest are fortification.
      if (this.engine.phase === 'combat') this.deployed++;
    }
  }

  private cycleSpeed(): void {
    this.speedMult = this.speedMult >= 8 ? 1 : this.speedMult * 2;
  }

  // ---- sim stepping ------------------------------------------------------------------

  override update(_time: number, deltaMs: number): void {
    const held = this.runCoach(deltaMs / 1000);
    const lanes = this.laneShares();
    const picked = this.selection() ? { selected: this.selected! } : {};
    if (this.paused || held || this.cardBuilder) {
      this.battle.draw(1, deltaMs / 1000, { showPaths: this.showPaths, ...(lanes ? { lanes } : {}), ...picked });
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

    const alpha = clamp(this.accumulator / DT, 0, 1);
    const ahead = this.laneShares();
    this.battle.draw(alpha, deltaMs / 1000, {
      showPaths: this.showPaths,
      ghost: this.currentGhost(),
      powerPreview: this.currentPowerPreview(),
      ...(ahead ? { lanes: ahead } : {}),
      ...(this.selection() ? { selected: this.selected! } : {}),
    });
    this.updateHud();
  }

  /**
   * Advance the coach and report whether it wants the battle held. It reads a
   * projection of the engine rather than the engine itself, so the script is
   * testable without a scene.
   */
  private runCoach(dtSeconds: number): boolean {
    const coach = this.coach;
    if (!coach || coach.done) return false;
    const e = this.engine;
    const held = coach.update(
      {
        phase: e.phase,
        waveIndex: e.waveIndex,
        cp: Math.floor(e.cp),
        kills: e.stats.kills,
        deployed: this.deployed,
        casts: this.casts,
        gun: this.cheapestGun(),
      },
      dtSeconds,
    );
    const tab = coach.takeTab();
    // Naming a tab is no use if it is not the one on screen.
    if (tab && this.panel.tab !== tab) this.panel.setTab(tab);
    return held;
  }

  /** The cheapest field gun on the deploy tab that this battle lets the town place, at its price. */
  private cheapestGun(): number {
    const e = this.engine;
    let best = Infinity;
    for (const kind of COMBAT_TOOL_KEYS) {
      const cpCost = e.catalog.structures[kind]?.cpCost;
      const room = e.buildRoom(kind);
      if (cpCost !== undefined && (room === null || room > 0)) best = Math.min(best, e.fieldPrice(cpCost));
    }
    return Number.isFinite(best) ? best : 0;
  }

  private handleEvents(events: SimEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'assaultStarted':
        case 'waveStarted':
          // Phase flips retarget the deploy tab (fortify ⇄ field deploy).
          this.setTool(null);
          // setTab on the *current* tab collapses the drawer, so only move.
          if (this.panel.tab !== 'deploy') this.panel.setTab('deploy');
          break;
        case 'prepStarted':
          // A prep opens on the read of the wave it is getting ready for (M35).
          this.setTool(null);
          if (this.panel.tab !== 'intel') this.panel.setTab('intel');
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

  /** Whether the read is whole: a Signals Station standing, lost, or never here. */
  private signals(): Signals {
    const hadStation = this.engine.config.layout?.structures.some((s) => s.kind === 'radar') ?? false;
    return signalsOf(this.engine.structures, hadStation);
  }

  /**
   * The next wave's share down each lane, for the board's edge (M35), or
   * nothing while a wave fights. Kept per wave: the read does not change
   * while it is being waited for.
   */
  private laneShares(): readonly number[] | undefined {
    const e = this.engine;
    const key = e.phase === 'setup' || e.phase === 'prep' ? `${e.phase}:${e.waveIndex}` : '';
    if (key !== this.lanesKey) {
      this.lanesKey = key;
      this.lanes = undefined;
      const read = key ? e.nextWaveRead() : null;
      if (read) {
        const shares = [0, 0, 0];
        let total = 0;
        for (const g of read.groups) {
          shares[g.lane]! += g.count;
          total += g.count;
        }
        if (total > 0) this.lanes = shares.map((n) => n / total);
      }
    }
    return this.lanes;
  }

  private currentGhost(): GhostPreview | undefined {
    if (!this.tool || this.tool.type === 'power') return undefined;
    const pointer = this.input.activePointer;
    const at = this.board.cellAt(pointer);
    if (!at) return undefined;
    // The cell the board says is under the pointer, which knows the camera.
    const cell = this.engine.grid.idx(at.col, at.row);

    if (this.tool.type === 'move') {
      const sel = this.selection();
      if (!sel) return undefined;
      return { cell, kind: sel.kind, valid: this.engine.isBuildable(cell) && this.engine.cp >= sel.move };
    }

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
    if (this.tool.type === 'gate') {
      // The preview marks which cells the lever actually reaches: a gate, and
      // one the CP will buy. Everything else under the cursor reads as refused.
      const wall = this.engine.grid.wallAt(cell);
      const def = wall ? this.engine.catalog.walls[wall.kind] : undefined;
      return {
        cell,
        kind: 'gate',
        valid:
          def?.gateCpCost !== undefined && this.engine.cp >= this.engine.cpPrice(def.gateCpCost),
      };
    }
    return {
      cell,
      kind: this.tool.kind,
      valid: this.engine.canPlaceStructure(this.tool.kind, cell),
    };
  }

  private currentPowerPreview(): PowerPreview | undefined {
    if (this.tool?.type !== 'power') return undefined;
    // Being aimed (M35 Phase 2): from the pressed cell, along or out to the drag.
    const aim = this.board.aim();
    if (aim) {
      const at = { x: Math.floor(aim.from.x) + 0.5, y: Math.floor(aim.from.y) + 0.5 };
      const travelled = Math.hypot(aim.to.x - aim.from.x, aim.to.y - aim.from.y) >= 0.5;
      return { kind: this.tool.kind, at, ...(travelled ? { toward: aim.to } : {}) };
    }
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
    // What it costs in this battle: research's discount, and for a field
    // defence the USA's kit (M26), which is twice the price.
    const cpPriced = cpCost === undefined ? undefined : isWall ? e.cpPrice(cpCost) : e.fieldPrice(cpCost);
    const cost = cpPriced !== undefined ? `${cpPriced} CP` : `${supplyCost ?? 0} SUP`;
    const affordable = cpPriced !== undefined ? e.cp >= cpPriced : e.supplies >= (supplyCost ?? 0);
    // What this battle's limits leave: none of a kind the town has not
    // unlocked, and the town's count for its post. A row that cannot be used
    // says why, rather than taking a tap the battle will refuse.
    const room = e.buildRoom(kind);
    const spent = room !== null && room <= 0;
    const locked = spent && e.config.buildLimits?.structures?.[kind] === 0;
    const armed =
      this.tool !== null && 'kind' in this.tool && this.tool.kind === kind && this.tool.type !== 'power';
    return {
      id: kind,
      label: `${def.name.toUpperCase()} [${key}]`,
      sub: locked ? 'LOCKED' : spent ? 'NONE LEFT' : cost,
      enabled: affordable && !spent,
      active: armed,
      onTap: () => this.setTool(isWall ? { type: 'wall', kind } : { type: 'structure', kind }),
      // What it does, on a hold, as the town's rows have it (M35 Phase 2).
      onHold: () => this.showSpec(kind, isWall),
    };
  }

  private rowsForTab(): PanelRow[] {
    const e = this.engine;
    const build = e.phase === 'setup' || e.phase === 'prep';
    switch (this.panel.tab) {
      case 'deploy': {
        const rows: PanelRow[] = [];
        // The picked-out field defence's verbs, first (M35 Phase 2). The two
        // a fight reaches for come first, where a phone's drawer shows them
        // at rest, and the sale, which gives the ground up, last.
        const sel = this.selection();
        if (sel) {
          const moving = this.tool?.type === 'move';
          rows.push(
            { id: 'sh', label: `SELECTED — ${sel.name.toUpperCase()}${sel.level >= 2 ? ' (UPGRADED)' : ''}`, heading: true },
            {
              id: 'sel-move',
              label: moving ? 'TAP WHERE IT GOES [M]' : 'MOVE [M]',
              sub: `${sel.move} CP · 3s DOWN`,
              enabled: e.cp >= sel.move,
              active: moving,
              onTap: () => (moving ? this.setTool(null) : this.armMove()),
            },
            {
              id: 'sel-up',
              label: 'UPGRADE [U]',
              sub: sel.upgrade === null ? 'UPGRADED' : `${sel.upgrade} CP`,
              enabled: sel.upgrade !== null && e.cp >= sel.upgrade,
              onTap: () => this.upgradeSelected(),
              onHold: () => this.showSpec(sel.kind, false),
            },
            {
              id: 'sel-sell',
              label: 'SELL [X]',
              sub: `+${Math.floor(sel.sell)} CP`,
              onTap: () => this.sellSelected(),
            },
          );
        }
        rows.push({ id: 'h', label: build ? 'FORTIFY (SUPPLIES)' : 'FIELD DEPLOY (CP)', heading: true });
        const keys = build ? SETUP_TOOL_KEYS : COMBAT_TOOL_KEYS;
        keys.forEach((kind, i) => {
          rows.push(this.toolRow(kind, kind === 'wall' || kind === 'gate' || kind === 'hesco', String(i + 1)));
        });
        // Working the gates is only a thing when there are gates to work, and
        // only in combat — CP is the price, and CP only flows once the shooting
        // starts. The row states the standing count, so a gate destroyed
        // mid-siege stops being offered rather than silently failing.
        const gates = [...e.grid.walls.values()].filter((w) => w.kind === 'gate');
        if (!build && gates.length > 0) {
          const def = e.catalog.walls['gate'];
          const price = e.cpPrice(def?.gateCpCost ?? 0);
          const shut = gates.filter((w) => w.open !== true).length;
          rows.push({
            id: 'gate',
            label: 'WORK THE GATES [G]',
            sub: `${price} CP · ${shut}/${gates.length} SHUT`,
            enabled: e.cp >= price,
            active: this.tool?.type === 'gate',
            onTap: () => this.setTool({ type: 'gate' }),
          });
        }
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
            // A jammed net (M35) is why a power cannot go, and the row says so.
            sub: e.fightingMods?.jammed ? `JAMMED${stock}` : cd > 0 ? `${Math.ceil(cd)}s${stock}` : `${def.cpCost} CP${stock}`,
            enabled: cd <= 0 && e.canCastPower(kind),
            active: this.tool?.type === 'power' && this.tool.kind === kind,
            onTap: () => this.armPower(kind),
            onHold: () => this.showPowerSpec(kind),
          });
        }
        rows.push({
          id: 'hint',
          label: 'Arm a power, then tap the map, or press and drag to aim it: the gun run along the drag, the barrage as wide.',
          heading: true,
        });
        if (e.pinSeconds > 0) {
          rows.push({ id: 'pin', label: `What it lands on is pinned ${e.pinSeconds}s.`, heading: true });
        }
        return rows;
      }
      case 'intel': {
        const rows: PanelRow[] = [];
        // The read of the next wave (M35): what, down which lane, and with a
        // Signals Station standing, when and for what.
        const read = e.nextWaveRead();
        if (read) {
          rows.push({ id: 'h', label: `INBOUND — WAVE ${read.index + 1}/${e.waveCount}`, heading: true });
          for (const line of readLines(read, this.signals(), (kind) => e.catalog.attackers[kind]?.name ?? kind)) {
            rows.push({ id: `r${line.id}`, label: `  ${line.text}`, heading: true });
          }
        }
        // And while a wave fights, what the enemy did to it.
        const fighting = e.fightingMods;
        const modifier = fighting ? waveModifierOf({ entries: [], mods: fighting }) : undefined;
        if (modifier) {
          const [line] = readLines({ index: e.waveIndex, modifier, mods: fighting!, groups: [] }, 'up', (k) => k);
          if (line) rows.push({ id: 'hm', label: `THIS WAVE — ${line.text}`, heading: true });
        }
        const integrity = Math.max(0, Math.round((e.cc.hp / e.cc.profile.maxHp) * 100));
        // Under the kill chain the integrity number STOPS for reasons the bar
        // cannot show — a gun still covering the post, or a crew one body
        // short. That is a defensive decision (keep the gun alive, kill the
        // holders) and the panel has to be able to state it.
        const chain = e.chainProgress();
        const chainLine =
          chain === null || chain.stage === 'down'
            ? null
            : chain.stage === 'breach'
              ? 'SHELL HOLDING'
              : chain.stage === 'suppress'
                ? `COVERED BY ${chain.covering} GUN${chain.covering === 1 ? '' : 'S'}`
                : chain.stage === 'charge'
                  ? `CHARGE SETTING — ${chain.holders}/${chain.crew} ON IT`
                  : 'CHARGE SET — BURN THEM OFF IT';
        rows.push(
          { id: 'h2', label: 'SITREP', heading: true },
          { id: 's1', label: `CC INTEGRITY ${integrity}%`, heading: true },
          ...(chainLine ? [{ id: 's1b', label: `POST — ${chainLine}`, heading: true }] : []),
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

    const ov = createOverlay(this, this.layout, {
      title: victory ? 'SECTOR HELD' : 'COMMAND CENTER LOST',
      subtitle: mission ? `M${mission.index + 1} — ${mission.codename}` : 'AFTER ACTION',
      scrim: 0.8,
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
