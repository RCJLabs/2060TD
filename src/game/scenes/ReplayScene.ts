import { clamp, Scene, SHUTDOWN, type Graphics } from '../stage';
import { music } from '../music';
import { defenseCatalogFor, raidCatalogFor, trainableFor, trainMetaFor, type FactionId } from '../../content/factions';
import { afterAction, BattleRecorder } from '../../meta/afteraction';
import { Counterfactual } from '../../meta/counterfactual';
import { ghostCatalog } from '../../meta/ghost';
import { jumpTick, MomentLog, type Moment } from '../../meta/moments';
import {
  engineFor,
  ordersOf,
  SIEGE_MAX_TICKS,
  SiegeCounterfactual,
  siegeReport,
  waveStartOf,
  type OrderEntry,
  type SiegeRecord,
  type SiegeReport,
  type SiegeWhatIf,
  type WaveStart,
} from '../../meta/siegerecord';
import { buildAfterActionCard } from '../afterActionCard';
import { buildSiegeReportCard } from '../siegeReportCard';
import { buildSiegeOrdersCard, buildSiegeWhatIfCard } from '../siegeWhatIfCard';
import { buildWhatIfCard } from '../whatIfCard';
import type { OverlayApi } from '../dom/overlay';
import { createButton, type FreeButton } from '../dom/button';
import { createScrubber, type Scrubber } from '../dom/scrubber';
import { DT, Engine, TICKS_PER_SECOND } from '../../sim/engine';
import { OBJECTIVES, isObjectiveId, watchObjective } from '../../meta/objectives';
import { RAID_MAX_TICKS } from '../../meta/warfare';
import type { Catalog, Command, SimConfig } from '../../sim/types';
import { BattleRenderer } from '../BattleRenderer';
import { drawHeatMap, heatLegend } from '../heatMap';
import { COLORS } from '../palette';
import { BoardView } from '../BoardView';
import { DRAWER_REST, layoutOf, onLayoutChange, toggleDrawer, type DrawerState, type Layout, type Rect } from '../layout';
import { createLabel, type SceneLabel } from '../dom/label';
import { createPanel } from '../dom/panel';
import type { PanelApi, PanelRow } from '../rows';
import type { SiegeLaunchData } from './SiegeScene';

export interface ReplayData {
  config: SimConfig;
  /** raid = your army hits an enemy base; defense = a probe on your town. */
  kind: 'raid' | 'defense';
  title: string;
  /** Whose war this footage is from (picks the catalogs; default 'usa'). */
  faction?: FactionId;
  /**
   * A ghost raid (M27): the attacking army's side. The battle is fought on
   * `faction`'s town with this side's own units, and whichever camera story
   * `kind` tells, it is a raid: it has a report, and the raid's clock.
   */
  attacker?: FactionId;
  /** Scene key to return to (with its restart payload). */
  backTo: 'town' | 'raid';
  backData?: object;
  /** Open on the battle's end, heat map and all: the report's ON THE MAP (M29). */
  skip?: boolean;
  /**
   * The footage of a what-if (M29 Phase 3). Its report offers no what-if of
   * its own: every what-if is one change from the raid as fought, never two.
   */
  whatIf?: boolean;
  /**
   * A live siege's orders (M35 Phase 3): the footage is its config and these,
   * fought again. It opens where the assault began, with the build in place.
   */
  commands?: Command[];
  /**
   * Open at this tick, watched as it was: a seek back is the footage fought
   * again from its start to there (M35 Phase 3).
   */
  seek?: ReplaySeek;
}

/** Where a replay opens, and how it was being watched when it was sent there. */
export interface ReplaySeek {
  tick: number;
  paused: boolean;
  speed: number;
  heat: boolean;
  paths: boolean;
}

/**
 * What the replay bar knows of a battle before it plays (M35 Phase 3): the
 * battle fought once, headless, as it opens, and kept for as long as it is
 * watched. A siege's report and what-if are kept with it, for the same reason.
 */
interface Footage {
  /** The tick it ends on. */
  end: number;
  /** Where it opens: where a siege's assault began, or the start. */
  opens: number;
  moments: Moment[];
  /** Where a drill can start: the setup, then each wave's prep. */
  drills: WaveStart[];
  report?: SiegeReport;
  asked?: { cf: SiegeCounterfactual; orders: OrderEntry[] | null; answers: Map<string, SiegeWhatIf> };
}

/** Keyed by what makes the battle: a siege's log, or a config. */
const FOOTAGE = new WeakMap<object, Footage>();

type ObjectiveWatch = ReturnType<typeof watchObjective>;

/** The footage on screen, as the harness reads it (M35 Phase 3). */
export interface FootageProbe {
  tick: number;
  end: number;
  opens: number;
  paused: boolean;
  moments: Moment[];
}

let onScreen: (() => FootageProbe) | null = null;

/** The footage being watched, or null when none is. */
export function watchedFootage(): FootageProbe | null {
  return onScreen?.() ?? null;
}

/**
 * Deterministic replay viewer: re-runs the exact battle live, with playback
 * speed, pause, a timeline to scrub and jump along, and no player input. The
 * sim IS the recording.
 */
export class ReplayScene extends Scene {
  private replay!: ReplayData;
  private engine!: Engine;
  private watch: ObjectiveWatch | null = null;
  private battle!: BattleRenderer;
  private accumulator = 0;
  private speedMult = 2;
  private showPaths = true;
  /**
   * The heat map (M29 Phase 2): the battle's report, kept as the footage
   * plays, and drawn on the ground under the battle.
   */
  private recorder!: BattleRecorder;
  private heatLayer!: Graphics;
  private showHeat = true;
  private board!: BoardView;
  private panel!: PanelApi;
  private layout!: Layout;
  /** The drawer's share of the safe height. See `layout.ts` detents. */
  private drawer: DrawerState = DRAWER_REST;
  private endShown = false;
  /** The verdict, over the middle of the board once the battle is over. */
  private stamp: SceneLabel | null = null;
  /** The after-action card, while it is open. */
  private overlay: OverlayApi | null = null;
  /** The replay bar (M35 Phase 3). */
  private paused = false;
  private footage!: Footage;
  private scrubber!: Scrubber;
  private pauseButton!: FreeButton;
  private pauseText = '';

  constructor() {
    super('replay');
  }

  init(data: ReplayData): void {
    this.replay = data;
    this.accumulator = 0;
    // A seek back opens the footage again, watched as it was.
    const seek = data.seek;
    this.speedMult = seek?.speed ?? 2;
    this.showHeat = seek?.heat ?? true;
    this.showPaths = seek?.paths ?? true;
    this.paused = seek?.paused ?? false;
    this.pauseText = '';
    this.endShown = false;
    this.stamp = null;
    this.overlay = null;
  }

  create(): void {
    // Footage of a fight sounds like one: the score follows the threat to the
    // post it shows, a raid's target as much as your own town (M31).
    music.play('battle');
    this.footage = this.footageOf();
    this.engine = this.newEngine();
    this.watch = this.watchOf(this.engine);
    this.recorder = new BattleRecorder(this.replay.config);
    this.board = new BoardView(this, {
      cols: this.replay.config.width,
      rows: this.replay.config.height,
      cell: 32,
    });
    // In the world before the battle's own layers, so it lies on the ground:
    // the sheet goes in under it, and the walls, guns and men over it.
    this.heatLayer = this.add.graphics();
    this.board.world.add(this.heatLayer);
    this.battle = new BattleRenderer(
      this,
      this.engine,
      32,
      this.replay.kind === 'raid',
      this.board.world,
      // Watched, not fought: the board still jolts, the phone does not buzz.
      { live: false, view: () => this.board.listener() },
    );
    this.panel = createPanel(this, [{ id: 'ctrl', label: 'AFTER ACTION' }]);
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
    // The replay bar (M35 Phase 3): pause, and the battle along the foot of
    // the board with what happened in it marked.
    this.pauseButton = createButton(this, 0, 0, 10, 10, '', () => this.pressPause());
    this.scrubber = createScrubber(this, (at) => this.seekTo(at * this.footage.end));
    const defending = this.replay.kind !== 'raid';
    this.scrubber.setMarks(
      this.footage.moments.map((m) => ({
        at: m.tick / this.footage.end,
        strong: m.kind === 'wave',
        // What the side the footage is shot from lost.
        alarm: defending && m.kind !== 'wave' && m.kind !== 'strike',
      })),
    );
    this.applyLayout();
    onLayoutChange(this, () => this.applyLayout());

    const kb = this.input.keyboard;
    kb?.on('keydown-S', () => this.cycleSpeed());
    kb?.on('keydown-P', () => {
      this.showPaths = !this.showPaths;
    });
    kb?.on('keydown-H', () => {
      this.showHeat = !this.showHeat;
    });
    kb?.on('keydown-K', () => this.pressPause());
    onScreen = () => ({
      tick: this.engine.tick,
      end: this.footage.end,
      opens: this.footage.opens,
      paused: this.paused,
      moments: this.footage.moments,
    });
    this.events.once(SHUTDOWN, () => {
      onScreen = null;
    });
    kb?.on('keydown-SPACE', () => this.skipToEnd());
    kb?.on('keydown-ESC', () => this.goBack());
    if (this.replay.skip) this.skipToEnd();
    else this.fastForward(this.replay.seek?.tick ?? this.footage.opens);
  }

  /** The battle, ready to step: a siege's orders queued, or a raid's assault begun. */
  private newEngine(): Engine {
    const catalog = this.catalog();
    const commands = this.replay.commands;
    if (commands) return engineFor({ config: this.replay.config, commands }, catalog);
    const engine = new Engine(this.replay.config, catalog);
    engine.enqueue({ tick: 0, type: 'startAssault' });
    return engine;
  }

  private watchOf(engine: Engine): ObjectiveWatch | null {
    const objective = this.replay.config.objective;
    return isObjectiveId(objective) ? watchObjective(objective, (cls) => engine.countStanding(cls)) : null;
  }

  /**
   * The battle fought once, headless, for the replay bar: where it ends, where
   * it opens, what happened in it and where a drill can start. A few dozen
   * milliseconds, and kept, so a seek back does not fight it twice.
   */
  private footageOf(): Footage {
    const commands = this.replay.commands;
    const key = commands ?? this.replay.config;
    const kept = FOOTAGE.get(key);
    if (kept) return kept;
    const engine = this.newEngine();
    const watch = this.watchOf(engine);
    const catalog = engine.catalog;
    const log = new MomentLog({
      side: this.replay.kind === 'raid' ? 'raider' : 'defender',
      waves: commands !== undefined,
      name: (kind) => catalog.structures[kind]?.name ?? catalog.powers[kind]?.name ?? kind,
    });
    const drills: WaveStart[] = [{ wave: 1, tick: 0 }];
    let opens = 0;
    while (!this.over(engine, watch)) {
      const events = engine.step();
      log.observe(engine, events);
      const start = waveStartOf(engine, events);
      if (start) drills.push(start);
      if (commands && opens === 0 && events.some((e) => e.type === 'assaultStarted')) opens = engine.tick;
    }
    if (commands) log.strikes(commands);
    const footage: Footage = { end: Math.max(1, engine.tick), opens, moments: log.moments, drills };
    FOOTAGE.set(key, footage);
    return footage;
  }

  /** The catalog the footage is fought on: a raid's, a town's, or a ghost's (M27). */
  private catalog(): Catalog {
    const faction = this.replay.faction ?? 'usa';
    if (this.replay.attacker) return ghostCatalog(faction, this.replay.attacker);
    return this.replay.kind === 'raid' ? raidCatalogFor(faction) : defenseCatalogFor(faction);
  }

  /** A raid on a post, or another commander's plan on a town: footage with a report. */
  private get isRaid(): boolean {
    return this.replay.kind === 'raid' || this.replay.attacker !== undefined;
  }

  private applyLayout(): void {
    this.layout = layoutOf(this, this.drawer, 0, 1, this.board.cols / this.board.rows);
    const { board, boardFull, rowH, pad, gap, font } = this.layout;
    // The replay bar takes the foot of the board, and the map fits above it.
    const barH = Math.round(rowH * 0.9);
    const above = (r: Rect): Rect => ({ ...r, h: Math.max(1, r.h - barH) });
    this.board.applyLayout({ ...this.layout, board: above(board), boardFull: above(boardFull) }, true);
    const barY = board.y + board.h - barH;
    const buttonW = Math.round(barH * 2.4);
    this.pauseButton.setRect(board.x + pad, barY + Math.round(gap / 2), buttonW, barH - gap);
    this.pauseButton.setFont(font.label);
    this.scrubber.setRect(board.x + pad * 2 + buttonW, barY, Math.max(1, board.w - pad * 3 - buttonW), barH);
    this.panel.applyLayout(this.layout);
    this.placeStamp();
    // A card laid out for the old screen is closed rather than left wrong.
    this.closeOverlay();
  }

  private closeOverlay(): void {
    this.overlay?.close();
    this.overlay = null;
  }

  /**
   * The verdict, at the top of the board. It sat over the middle until the
   * heat map (M29), where it covered the post: the ground the whole map is
   * read against.
   */
  private placeStamp(): void {
    if (!this.stamp) return;
    const { board, font, pad } = this.layout;
    this.stamp.setFontSize(font.title).setPosition(board.x + board.w / 2, board.y + pad);
  }

  private rows(): PanelRow[] {
    const siege = this.replay.commands !== undefined;
    const drill = siege ? this.drillPoint() : null;
    const at = this.momentAt();
    return [
      {
        id: 'h',
        label: this.replay.attacker
          ? 'GHOST RAID FOOTAGE'
          : siege
            ? 'SIEGE FOOTAGE'
            : this.replay.kind === 'raid'
              ? 'RAID FOOTAGE'
              : 'DEFENSE FOOTAGE',
        heading: true,
      },
      { id: 'pause', label: this.pauseLabel(), sub: '[K]', active: this.paused && !this.ended(), onTap: () => this.pressPause() },
      { id: 'speed', label: `SPEED ×${this.speedMult}`, sub: '[S]', onTap: () => this.cycleSpeed() },
      // A drill (M35 Phase 3): this siege, from the start of the wave on
      // screen, in the commander's hands.
      ...(drill
        ? [
            {
              id: 'take',
              label: 'TAKE COMMAND',
              sub: drill.wave === 1 ? 'FROM THE SETUP' : `FROM WAVE ${drill.wave}`,
              onTap: () => this.takeCommand(drill),
            },
          ]
        : []),
      {
        id: 'paths',
        label: 'PATH MARKERS',
        sub: '[P]',
        active: this.showPaths,
        onTap: () => {
          this.showPaths = !this.showPaths;
        },
      },
      {
        id: 'heat',
        label: 'HEAT MAP',
        sub: '[H]',
        active: this.showHeat,
        onTap: () => {
          this.showHeat = !this.showHeat;
        },
      },
      ...(this.showHeat
        ? [{ id: 'heatnote', label: heatLegend(this.recorder.deaths.length), heading: true }]
        : []),
      { id: 'skip', label: 'SKIP TO END', sub: '[SPACE]', onTap: () => this.skipToEnd() },
      // A raid's report (M29), or a siege's (M35 Phase 3), fought from the
      // same battle this is playing.
      ...(this.isRaid || siege
        ? [{ id: 'report', label: 'AFTER ACTION REPORT', onTap: () => this.showReport() }]
        : []),
      { id: 'fit', label: 'FIT VIEW', onTap: () => this.board.fit() },
      { id: 'back', label: 'BACK', sub: '[ESC]', onTap: () => this.goBack() },
      // What happened, to go to (M35 Phase 3); the one last passed is lit.
      ...(this.footage.moments.length > 0
        ? [
            { id: 'jump', label: 'JUMP TO', heading: true },
            ...this.footage.moments.map((m, i) => ({
              id: `jump${i}`,
              label: m.label,
              sub: `T+${Math.floor(m.tick / TICKS_PER_SECOND)}s`,
              active: i === at,
              onTap: () => this.seekTo(jumpTick(m)),
            })),
          ]
        : []),
    ];
  }

  /** The last moment the footage has passed, or -1. */
  private momentAt(): number {
    let at = -1;
    this.footage.moments.forEach((m, i) => {
      if (m.tick <= this.engine.tick) at = i;
    });
    return at;
  }

  /** Where a drill from here starts: the prep of the wave on screen, or the setup. */
  private drillPoint(): WaveStart {
    let point = this.footage.drills[0]!;
    for (const start of this.footage.drills) if (start.tick <= this.engine.tick) point = start;
    return point;
  }

  /**
   * Into the siege from `drill`, the commander's to fight (M35 Phase 3). It
   * comes back to this footage, paused where the drill began.
   */
  private takeCommand(drill: WaveStart): void {
    const commands = this.replay.commands;
    if (!commands) return;
    const record: SiegeRecord = { config: this.replay.config, commands };
    const footage: ReplayData = {
      ...this.replay,
      skip: false,
      seek: this.seekState(Math.max(drill.tick, this.footage.opens), true),
    };
    const data: SiegeLaunchData = {
      faction: this.replay.faction ?? 'usa',
      drill: { record, tick: drill.tick, wave: drill.wave, footage },
    };
    this.scene.start('siege', data);
  }

  private showReport(): void {
    if (this.overlay) return;
    if (this.replay.commands) {
      this.showSiegeReport({ config: this.replay.config, commands: this.replay.commands });
      return;
    }
    // The force's side: the town's own on a raid, the other commander's on a ghost.
    const faction = this.replay.attacker ?? this.replay.faction ?? 'usa';
    const catalog = this.catalog();
    const meta = trainMetaFor(faction);
    // A ghost's plan was another commander's, and so is any what-if about it.
    const cf =
      this.replay.whatIf || this.replay.attacker
        ? null
        : Counterfactual.of(this.replay.config, catalog, trainableFor(faction));
    this.overlay = buildAfterActionCard(this, afterAction(this.replay.config, catalog), {
      layout: this.layout,
      title: this.replay.title,
      faction,
      catalog,
      unit: (kind) => meta[kind]?.short ?? kind,
      chain: this.replay.config.killChainVersion !== undefined,
      // Where it happened: the end of this footage, with the heat map on.
      onMap: () => this.onTheMap(),
      ...(cf ? { onWhatIf: () => this.showWhatIf(cf) } : {}),
      onClose: () => this.closeOverlay(),
    });
  }

  /** Where it happened: the end of this footage, with the heat map on. */
  private onTheMap(): void {
    this.closeOverlay();
    this.showHeat = true;
    this.skipToEnd();
  }

  /** A siege's report (M35 Phase 3), fought from its record once and kept. */
  private showSiegeReport(record: SiegeRecord): void {
    const catalog = this.catalog();
    const report = (this.footage.report ??= siegeReport(record, catalog));
    this.overlay = buildSiegeReportCard(this, report, {
      layout: this.layout,
      title: this.replay.title,
      catalog,
      chain: this.replay.config.killChainVersion !== undefined,
      onMap: () => this.onTheMap(),
      // A what-if's footage has none of its own: every what-if is one change from the siege as fought.
      ...(this.replay.whatIf ? {} : { onWhatIf: () => this.showSiegeOrders(record) }),
      onClose: () => this.closeOverlay(),
    });
  }

  /** What this siege's what-if has asked and fought, kept with its footage. */
  private asked(record: SiegeRecord): NonNullable<Footage['asked']> {
    return (this.footage.asked ??= {
      cf: new SiegeCounterfactual(record, this.catalog()),
      orders: null,
      answers: new Map(),
    });
  }

  /** The orders the siege was given, to pick one to change. */
  private showSiegeOrders(record: SiegeRecord): void {
    this.closeOverlay();
    const catalog = this.catalog();
    const asked = this.asked(record);
    this.overlay = buildSiegeOrdersCard(this, {
      layout: this.layout,
      title: this.replay.title,
      catalog,
      orders: (asked.orders ??= ordersOf(record, catalog)),
      onPick: (entry) => this.showSiegeWhatIf(record, entry),
      onBack: () => {
        this.closeOverlay();
        this.showReport();
      },
    });
  }

  /** One order changed; its footage plays here, from the start. */
  private showSiegeWhatIf(record: SiegeRecord, entry: OrderEntry): void {
    this.closeOverlay();
    const asked = this.asked(record);
    this.overlay = buildSiegeWhatIfCard(this, {
      layout: this.layout,
      title: this.replay.title,
      catalog: this.catalog(),
      counterfactual: asked.cf,
      entry,
      answers: asked.answers,
      onWatch: (answer, what) => {
        const data: ReplayData = {
          ...this.replay,
          commands: answer.record.commands,
          title: `WHAT IF: ${what}`,
          skip: false,
          whatIf: true,
          seek: undefined,
        };
        this.scene.start('replay', data);
      },
      onOrders: () => this.showSiegeOrders(record),
    });
  }

  /** This raid with one thing changed (M29 Phase 3); its footage plays here, and BACK is the report. */
  private showWhatIf(cf: Counterfactual): void {
    this.overlay?.close();
    const faction = this.replay.faction ?? 'usa';
    const meta = trainMetaFor(faction);
    const objective = this.replay.config.objective;
    this.overlay = buildWhatIfCard(this, {
      layout: this.layout,
      title: this.replay.title,
      faction,
      counterfactual: cf,
      unitName: (kind) => meta[kind]?.name ?? kind,
      objective: isObjectiveId(objective) ? objective : 'post',
      chain: this.replay.config.killChainVersion !== undefined,
      onWatch: (answer, what) => {
        // From the start, whatever this footage was opened on.
        this.scene.start('replay', {
          ...this.replay,
          config: answer.config,
          title: `WHAT IF: ${what.toUpperCase()}`,
          skip: false,
          whatIf: true,
          seek: undefined,
        });
      },
      onBack: () => {
        this.closeOverlay();
        this.showReport();
      },
    });
  }

  private cycleSpeed(): void {
    this.speedMult = this.speedMult >= 8 ? 1 : this.speedMult * 2;
  }

  /**
   * A raid that came for the guns STOPPED when it had them (v1.24), so the
   * replay has to stop there too — running on would show a battle that did
   * not happen. The watch comes from the same helper the resolver uses, built
   * from the same config, so the two cannot drift to different ticks.
   */
  private ended(): boolean {
    return this.over(this.engine, this.watch);
  }

  private over(engine: Engine, watch: ObjectiveWatch | null): boolean {
    if (engine.phase === 'victory' || engine.phase === 'defeat') return true;
    // A raid's resolution stops at its hard limit, so its footage does too; a
    // siege stops where the balance tool's does.
    if (engine.tick >= (this.isRaid ? RAID_MAX_TICKS : SIEGE_MAX_TICKS)) return true;
    return watch?.met() === true;
  }

  /** One tick of footage: the board's effects and the heat map both hear it. */
  private advance(): void {
    const events = this.engine.step();
    this.recorder.observe(this.engine, events);
    this.battle.consumeEvents(events);
  }

  private skipToEnd(): void {
    this.fastForward(this.footage.end);
  }

  /**
   * On to `tick` in one frame: the skip, a seek forward, and a siege's footage
   * opening where its assault began. None of it is heard at once: the board
   * keeps its bookkeeping and plays nothing, since none of its marks is ever
   * drawn.
   */
  private fastForward(tick: number): void {
    if (tick <= this.engine.tick) return;
    this.battle.hush(() => {
      while (this.engine.tick < tick && !this.ended()) this.advance();
    });
    this.accumulator = 0;
    this.battle.settle();
  }

  /**
   * The footage at `tick` (M35 Phase 3): on from here, hushed, or for a tick
   * already past, fought again from its start to there, which is the same
   * battle to the tick.
   */
  private seekTo(tick: number): void {
    const target = Math.max(0, Math.min(this.footage.end, Math.round(tick)));
    if (target >= this.engine.tick) {
      this.fastForward(target);
      return;
    }
    const data: ReplayData = { ...this.replay, skip: false, seek: this.seekState(target) };
    this.scene.restart(data);
  }

  private seekState(tick: number, paused = this.paused): ReplaySeek {
    return { tick, paused, speed: this.speedMult, heat: this.showHeat, paths: this.showPaths };
  }

  /** PAUSE and PLAY, and at the end, the footage again from where it opened. */
  private pressPause(): void {
    if (this.ended()) {
      this.paused = false;
      this.seekTo(this.footage.opens);
      return;
    }
    this.paused = !this.paused;
  }

  private pauseLabel(): string {
    return this.ended() ? 'AGAIN' : this.paused ? 'PLAY' : 'PAUSE';
  }

  private goBack(): void {
    this.scene.start(this.replay.backTo, this.replay.backData ?? {});
  }

  override update(_time: number, deltaMs: number): void {
    if (!this.ended()) {
      if (!this.paused) {
        this.accumulator += (deltaMs / 1000) * this.speedMult;
        let safety = 24;
        while (this.accumulator >= DT && safety-- > 0 && !this.ended()) {
          this.accumulator -= DT;
          this.advance();
        }
        if (this.accumulator > DT) this.accumulator = 0;
      }
    } else if (!this.endShown) {
      this.endShown = true;
      // The footage has run out, whoever is still on the board: the score settles.
      this.battle.over = true;
      const raid = this.replay.kind === 'raid';
      // A force that pulled out on its objective was not repelled — it left
      // with what it came for, which is a different ending and has to read as
      // one.
      const withdrew = this.watch?.met() === true;
      const attackersWon = this.engine.phase === 'defeat' || withdrew;
      const objective = isObjectiveId(this.replay.config.objective)
        ? OBJECTIVES[this.replay.config.objective]
        : null;
      const text = raid
        ? withdrew
          ? `${objective?.name ?? 'OBJECTIVE'} — WITHDRAWN`
          : attackersWon
            ? 'COMMAND POST DESTROYED'
            : 'RAID REPELLED'
        : attackersWon
          ? 'PERIMETER BREACHED'
          : this.replay.attacker
            ? 'RAID REPELLED'
            : 'PROBE REPELLED';
      const killer = this.engine.stats.ccKillerKind;
      const cause = attackersWon && !withdrew && killer ? `\nKILLING BLOW: ${killer.toUpperCase()}` : '';
      this.stamp = createLabel(this, text + cause, {
        size: this.layout.font.title,
        // Ink for the side the footage was shot from winning, alarm for it
        // losing. It was the olive of the pre-ink palette, which the ink pass
        // turned into a pale tone that read as nothing on paper.
        color: attackersWon === raid ? COLORS.ink : COLORS.alarm,
        bold: true,
        align: 'center',
        background: COLORS.bgPanel,
        padX: 16,
        padY: 10,
        originX: 0.5,
        originY: 0,
      });
      this.placeStamp();
    }

    const alpha = clamp(this.accumulator / DT, 0, 1);
    // A paused frame holds still, smoke and all.
    this.battle.draw(this.ended() ? 1 : alpha, this.paused ? 0 : deltaMs / 1000, { showPaths: this.showPaths });
    this.heatLayer.clear();
    if (this.showHeat) {
      drawHeatMap(
        this.heatLayer,
        { width: this.replay.config.width, hits: this.recorder.hits, deaths: this.recorder.deaths },
        32,
      );
    }

    const e = this.engine;
    this.scrubber.setValue(e.tick / this.footage.end);
    const pause = this.pauseLabel();
    if (pause !== this.pauseText) {
      this.pauseText = pause;
      this.pauseButton.setLabel(pause);
      this.pauseButton.setActive(this.paused && !this.ended());
    }
    this.panel.setRows(this.rows());
    const watch = this.watchLine();
    const clock = `T+${Math.floor(e.tick / TICKS_PER_SECOND)}s/${Math.floor(this.footage.end / TICKS_PER_SECOND)}s`;
    this.panel.setStatus(
      `REPLAY — ${this.replay.title}`,
      this.layout.mode === 'portrait'
        ? [
            `${clock} · ALIVE ${e.attackers.length} · KILLS ${e.stats.kills}`,
            ...(watch ? [watch.short] : []),
          ]
        : [
            `${clock}  ${this.ended() ? '· FOOTAGE ENDS' : this.paused ? '· PAUSED' : ''}`,
            `ALIVE ${e.attackers.length}   KILLS ${e.stats.kills}`,
            `LOST  -${e.stats.structuresLost} guns  -${e.stats.wallsLost} walls`,
            ...(watch ? [watch.long] : []),
          ],
    );
  }

  /**
   * The watch, counting down (v1.20).
   *
   * A raid is decided by how much of the base is shooting at you, and since
   * v1.20 part of that is bought with the time you spend getting there. That
   * only teaches anybody anything if it is on screen while it happens, so the
   * line says how many reserves are already committed and how many seconds of
   * dawdling buys the next one.
   */
  private watchLine(): { short: string; long: string } | null {
    const state = this.engine.garrisonReadiness();
    if (!state) return null;
    const raid = this.replay.kind === 'raid';
    const name = raid ? 'GARRISON' : 'ORDERS';
    const tally = `${state.committed}/${state.ceiling}`;
    const cps = this.replay.config.siege?.cpPerSecond ?? 0;
    let tail: string;
    if (state.committed >= state.ceiling) tail = 'RESERVE SPENT';
    else if (state.nextAt !== null && cps > 0) {
      tail = `NEXT IN ${Math.max(0, Math.ceil((state.nextAt - state.cp) / cps))}s`;
    } else tail = 'STANDING TO';
    return { short: `${raid ? 'GAR' : 'ORD'} ${tally} · ${tail}`, long: `${name}  ${tally}   ${tail}` };
  }
}
