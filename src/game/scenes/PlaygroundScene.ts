import Phaser from 'phaser';
import { TERRAIN_VERSION } from '../../sim/terrain';
import { music } from '../music';
import { M1_CATALOG } from '../../content/catalog';
import { DT, Engine } from '../../sim/engine';
import type { AttackerProfile } from '../../sim/types';
import { BattleRenderer, type GhostPreview } from '../BattleRenderer';
import { BoardView } from '../BoardView';
import { layoutOf, onLayoutChange, type Layout } from '../layout';
import { Panel, type PanelRow } from '../ui';

const CELL = 32;
const GRID_W = 32;
const GRID_H = 24;

type Tool = 'pan' | 'wall' | 'turret' | 'erase';

const LAB_TABS = [
  { id: 'build', label: 'BUILD' },
  { id: 'spawn', label: 'SPAWN' },
];

/**
 * Sandbox playground (?playground=1) — the M0 maze lab, now running on the
 * full M1 sim: paint walls, drop M2 nests, spawn militia/sappers, and watch
 * the weighted paths reroute live. Free placement, no economy.
 */
export class PlaygroundScene extends Phaser.Scene {
  private engine!: Engine;
  private battle!: BattleRenderer;
  private accumulator = 0;
  private speedMult = 1;
  private tool: Tool = 'wall';
  private showPaths = true;
  private lastPaintedCell = -1;

  private board!: BoardView;
  private panel!: Panel;
  private layout!: Layout;
  private drawerOpen = true;

  constructor() {
    super('playground');
  }

  create(): void {
    music.play('quiet');
    this.children.removeAll();
    this.engine = new Engine(
      {
        width: GRID_W,
        height: GRID_H,
        seed: Date.now() >>> 0,
        ccOrigin: 11 * GRID_W + 29,
        spawnColumn: 0,
      terrainSeed: 4242,
      terrainVersion: TERRAIN_VERSION,
      },
      M1_CATALOG,
    );
    this.board = new BoardView(this, { cols: GRID_W, rows: GRID_H, cell: CELL });
    this.battle = new BattleRenderer(this, this.engine, CELL, false, this.board.world);
    this.accumulator = 0;
    this.lastPaintedCell = -1;

    this.panel = new Panel(this, this.board.ui, LAB_TABS);
    this.panel.onDrawerToggle = () => {
      this.drawerOpen = !this.drawerOpen;
      this.applyLayout();
    };

    this.board.onTap((col, row) => this.applyTool(this.engine.grid.idx(col, row), true));
    this.board.onPaint((col, row) => this.applyTool(this.engine.grid.idx(col, row), false));
    this.setTool(this.tool);

    this.applyLayout();
    onLayoutChange(this, () => this.applyLayout());
    this.bindKeys();
  }

  private applyLayout(): void {
    this.layout = layoutOf(this, this.drawerOpen);
    this.board.applyLayout(this.layout, true);
    this.panel.applyLayout(this.layout);
  }

  private spawn(profile: AttackerProfile): void {
    const row = Math.floor(Math.random() * GRID_H);
    this.engine.command({
      type: 'spawnAttacker',
      cell: this.engine.grid.idx(0, row),
      kind: profile.kind,
    });
  }

  private spawnWave(): void {
    const militia = this.engine.catalog.attackers['militia']!;
    const sapper = this.engine.catalog.attackers['sapper']!;
    for (let i = 0; i < 10; i++) {
      const kind = (i % 3 === 2 ? sapper : militia).kind;
      const row = Math.floor(Math.random() * GRID_H);
      this.engine.command({
        tick: this.engine.tick + i * 8,
        type: 'spawnAttacker',
        cell: this.engine.grid.idx(0, row),
        kind,
      });
    }
  }

  private bindKeys(): void {
    const kb = this.input.keyboard;
    kb?.removeAllListeners();
    kb?.on('keydown-ONE', () => this.setTool('wall'));
    kb?.on('keydown-TWO', () => this.setTool('turret'));
    kb?.on('keydown-THREE', () => this.setTool('erase'));
    kb?.on('keydown-W', () => this.spawn(this.engine.catalog.attackers['militia']!));
    kb?.on('keydown-B', () => this.spawn(this.engine.catalog.attackers['sapper']!));
    kb?.on('keydown-SPACE', () => this.spawnWave());
    kb?.on('keydown-P', () => this.togglePaths());
    kb?.on('keydown-S', () => this.cycleSpeed());
    kb?.on('keydown-R', () => this.scene.restart());
  }

  private applyTool(cell: number, isFirstPress: boolean): void {
    if (this.tool === 'pan') return;
    if (cell === this.lastPaintedCell && !isFirstPress) return;
    this.lastPaintedCell = cell;
    if (this.tool === 'wall') {
      this.engine.command({ type: 'placeWall', cell, kind: 'wall' });
    } else if (this.tool === 'erase') {
      if (this.engine.grid.wallAt(cell)) this.engine.command({ type: 'removeWall', cell });
      else this.engine.command({ type: 'removeStructure', cell });
    } else {
      this.engine.command({ type: 'placeStructure', cell, kind: 'm2nest' });
    }
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    // Wall and erase drag-paint; the rest leaves one-finger drags to the camera.
    this.board.paintMode = tool === 'wall' || tool === 'erase';
    this.lastPaintedCell = -1;
  }

  private togglePaths(): void {
    this.showPaths = !this.showPaths;
  }

  private cycleSpeed(): void {
    this.speedMult = this.speedMult >= 4 ? 1 : this.speedMult * 2;
  }

  override update(_time: number, deltaMs: number): void {
    this.accumulator += (deltaMs / 1000) * this.speedMult;
    let safety = 12;
    while (this.accumulator >= DT && safety-- > 0) {
      this.accumulator -= DT;
      this.battle.consumeEvents(this.engine.step());
    }
    if (this.accumulator > DT) this.accumulator = 0;

    const alpha = Phaser.Math.Clamp(this.accumulator / DT, 0, 1);
    this.battle.draw(alpha, deltaMs / 1000, { showPaths: this.showPaths, ghost: this.ghost() });
    this.updateHud();
  }

  private ghost(): GhostPreview | undefined {
    if (this.tool === 'pan') return undefined;
    const at = this.board.cellAt(this.input.activePointer);
    if (!at) return undefined;
    const cell = this.engine.grid.idx(at.col, at.row);
    if (this.tool === 'erase') {
      const erasable =
        this.engine.grid.wallAt(cell) !== undefined ||
        (this.engine.structureAt(cell) !== undefined &&
          this.engine.structureAt(cell)!.profile.kind !== 'cc');
      return { cell, kind: 'erase', valid: erasable };
    }
    const kind = this.tool === 'wall' ? 'wall' : 'm2nest';
    const valid =
      this.tool === 'wall'
        ? this.engine.canPlaceWall('wall', cell)
        : this.engine.canPlaceStructure('m2nest', cell);
    return { cell, kind, valid };
  }

  private rows(): PanelRow[] {
    if (this.panel.tab === 'spawn') {
      return [
        { id: 'h', label: 'SPAWN HOSTILES — they enter from the left', heading: true },
        {
          id: 'militia',
          label: 'MILITIA',
          sub: 'MAZES [W]',
          onTap: () => this.spawn(this.engine.catalog.attackers['militia']!),
        },
        {
          id: 'sapper',
          label: 'SAPPER',
          sub: 'CHEWS [B]',
          onTap: () => this.spawn(this.engine.catalog.attackers['sapper']!),
        },
        { id: 'wave', label: 'WAVE ×10', sub: '[SPACE]', onTap: () => this.spawnWave() },
        { id: 'h2', label: 'VIEW', heading: true },
        {
          id: 'paths',
          label: 'SHOW PATHS',
          sub: this.showPaths ? 'ON' : 'OFF',
          active: this.showPaths,
          onTap: () => this.togglePaths(),
        },
        { id: 'speed', label: 'SPEED', sub: `×${this.speedMult}`, onTap: () => this.cycleSpeed() },
        { id: 'fit', label: 'FIT VIEW', onTap: () => this.board.fit() },
        { id: 'reset', label: 'RESET RANGE', sub: '[R]', onTap: () => this.scene.restart() },
      ];
    }
    const tool = (id: Tool, label: string, sub: string): PanelRow => ({
      id,
      label,
      sub,
      active: this.tool === id,
      onTap: () => this.setTool(id),
    });
    return [
      { id: 'h', label: 'TOOL — drag to paint, pinch to zoom', heading: true },
      tool('pan', 'PAN & ZOOM', 'DRAG'),
      tool('wall', 'BUILD WALL', '[1]'),
      tool('turret', 'PLACE M2 NEST', '[2]'),
      tool('erase', 'ERASE', '[3]'),
      { id: 'h2', label: 'Walls reroute hostiles — sappers chew through.', heading: true },
    ];
  }

  private updateHud(): void {
    const e = this.engine;
    const integrity = Math.max(0, Math.round((e.cc.hp / e.cc.profile.maxHp) * 100));
    this.panel.setStatus('SECTOR 7 — MAZE LAB', [
      `TICK ${String(e.tick).padStart(6, '0')} · ALIVE ${e.attackers.length} · KILLS ${e.stats.kills}`,
      `CC ${integrity}%${e.phase === 'defeat' ? ' — LOST' : ''} · WALLS ${e.grid.walls.size} (${e.stats.wallsLost} lost)`,
      `SPEED ×${this.speedMult} · PATHS ${this.showPaths ? 'ON' : 'OFF'}`,
    ]);
    this.panel.setRows(this.rows());
  }
}
