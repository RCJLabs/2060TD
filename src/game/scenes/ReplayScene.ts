import { clamp, Scene, type Graphics } from '../stage';
import { music } from '../music';
import { defenseCatalogFor, raidCatalogFor, trainMetaFor, type FactionId } from '../../content/factions';
import { afterAction, BattleRecorder } from '../../meta/afteraction';
import { buildAfterActionCard } from '../afterActionCard';
import type { OverlayApi } from '../dom/overlay';
import { DT, Engine } from '../../sim/engine';
import { OBJECTIVES, isObjectiveId, watchObjective } from '../../meta/objectives';
import { RAID_MAX_TICKS } from '../../meta/warfare';
import type { SimConfig } from '../../sim/types';
import { BattleRenderer } from '../BattleRenderer';
import { drawHeatMap, heatLegend } from '../heatMap';
import { COLORS } from '../palette';
import { BoardView } from '../BoardView';
import { DRAWER_REST, layoutOf, onLayoutChange, toggleDrawer, type DrawerState, type Layout } from '../layout';
import { createLabel, type SceneLabel } from '../dom/label';
import { createPanel } from '../dom/panel';
import type { PanelApi, PanelRow } from '../rows';

export interface ReplayData {
  config: SimConfig;
  /** raid = your army hits an enemy base; defense = a probe on your town. */
  kind: 'raid' | 'defense';
  title: string;
  /** Whose war this footage is from (picks the catalogs; default 'usa'). */
  faction?: FactionId;
  /** Scene key to return to (with its restart payload). */
  backTo: 'town' | 'raid';
  backData?: object;
  /** Open on the battle's end, heat map and all: the report's ON THE MAP (M29). */
  skip?: boolean;
}

/**
 * Deterministic replay viewer: re-runs the exact battle config live, with
 * playback speed, skip-to-end, and no player input. The sim IS the recording.
 */
export class ReplayScene extends Scene {
  private replay!: ReplayData;
  private engine!: Engine;
  private watch: ReturnType<typeof watchObjective> | null = null;
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

  constructor() {
    super('replay');
  }

  init(data: ReplayData): void {
    this.replay = data;
    this.accumulator = 0;
    this.speedMult = 2;
    this.showHeat = true;
    this.endShown = false;
    this.stamp = null;
    this.overlay = null;
  }

  create(): void {
    music.play('quiet');
    const faction = this.replay.faction ?? 'usa';
    const catalog =
      this.replay.kind === 'raid' ? raidCatalogFor(faction) : defenseCatalogFor(faction);
    this.engine = new Engine(this.replay.config, catalog);
    const objective = this.replay.config.objective;
    this.watch = isObjectiveId(objective)
      ? watchObjective(objective, (cls) => this.engine.countStanding(cls))
      : null;
    this.engine.enqueue({ tick: 0, type: 'startAssault' });
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
    kb?.on('keydown-SPACE', () => this.skipToEnd());
    kb?.on('keydown-ESC', () => this.goBack());
    if (this.replay.skip) this.skipToEnd();
  }

  private applyLayout(): void {
    this.layout = layoutOf(this, this.drawer, 0, 1, this.board.cols / this.board.rows);
    this.board.applyLayout(this.layout, true);
    this.panel.applyLayout(this.layout);
    this.placeStamp();
    // A card laid out for the old screen is closed rather than left wrong.
    if (this.overlay) {
      this.overlay.close();
      this.overlay = null;
    }
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
    return [
      { id: 'h', label: this.replay.kind === 'raid' ? 'RAID FOOTAGE' : 'DEFENSE FOOTAGE', heading: true },
      { id: 'speed', label: `SPEED ×${this.speedMult}`, sub: '[S]', onTap: () => this.cycleSpeed() },
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
      // A raid's report (M29), fought from the same config this is playing.
      ...(this.replay.kind === 'raid'
        ? [{ id: 'report', label: 'AFTER ACTION REPORT', onTap: () => this.showReport() }]
        : []),
      { id: 'fit', label: 'FIT VIEW', onTap: () => this.board.fit() },
      { id: 'back', label: 'BACK', sub: '[ESC]', onTap: () => this.goBack() },
    ];
  }

  private showReport(): void {
    if (this.overlay) return;
    const faction = this.replay.faction ?? 'usa';
    const catalog = raidCatalogFor(faction);
    const meta = trainMetaFor(faction);
    this.overlay = buildAfterActionCard(this, afterAction(this.replay.config, catalog), {
      layout: this.layout,
      title: this.replay.title,
      faction,
      catalog,
      unit: (kind) => meta[kind]?.short ?? kind,
      chain: this.replay.config.killChainVersion !== undefined,
      // Where it happened: the end of this footage, with the heat map on.
      onMap: () => {
        this.overlay?.close();
        this.overlay = null;
        this.showHeat = true;
        this.skipToEnd();
      },
      onClose: () => {
        this.overlay?.close();
        this.overlay = null;
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
    if (this.engine.phase === 'victory' || this.engine.phase === 'defeat') return true;
    // A raid's resolution stops at its hard limit, so its footage does too.
    if (this.replay.kind === 'raid' && this.engine.tick >= RAID_MAX_TICKS) return true;
    return this.watch?.met() === true;
  }

  /** One tick of footage: the board's effects and the heat map both hear it. */
  private advance(): void {
    const events = this.engine.step();
    this.recorder.observe(this.engine, events);
    this.battle.consumeEvents(events);
  }

  private skipToEnd(): void {
    let safety = 20_000;
    while (!this.ended() && safety-- > 0) this.advance();
    this.accumulator = 0;
    this.battle.settle();
  }

  private goBack(): void {
    this.scene.start(this.replay.backTo, this.replay.backData ?? {});
  }

  override update(_time: number, deltaMs: number): void {
    if (!this.ended()) {
      this.accumulator += (deltaMs / 1000) * this.speedMult;
      let safety = 24;
      while (this.accumulator >= DT && safety-- > 0 && !this.ended()) {
        this.accumulator -= DT;
        this.advance();
      }
      if (this.accumulator > DT) this.accumulator = 0;
    } else if (!this.endShown) {
      this.endShown = true;
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
    this.battle.draw(this.ended() ? 1 : alpha, deltaMs / 1000, { showPaths: this.showPaths });
    this.heatLayer.clear();
    if (this.showHeat) {
      drawHeatMap(
        this.heatLayer,
        { width: this.replay.config.width, hits: this.recorder.hits, deaths: this.recorder.deaths },
        32,
      );
    }

    const e = this.engine;
    this.panel.setRows(this.rows());
    const watch = this.watchLine();
    this.panel.setStatus(
      `REPLAY — ${this.replay.title}`,
      this.layout.mode === 'portrait'
        ? [
            `T+${Math.floor(e.tick / 20)}s · ALIVE ${e.attackers.length} · KILLS ${e.stats.kills}`,
            ...(watch ? [watch.short] : []),
          ]
        : [
            `T+${Math.floor(e.tick / 20)}s  ${this.ended() ? '· FOOTAGE ENDS' : ''}`,
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
