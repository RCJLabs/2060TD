import Phaser from 'phaser';
import { M1_CATALOG } from '../../content/catalog';
import { DT, Engine } from '../../sim/engine';
import type { AttackerProfile } from '../../sim/types';
import { BattleRenderer, type GhostPreview } from '../BattleRenderer';
import { COLORS } from '../palette';
import { makeButton, mono, type Button } from '../ui';

const CELL = 32;
const GRID_W = 32;
const GRID_H = 24;
const GRID_PX_W = GRID_W * CELL;
const GRID_PX_H = GRID_H * CELL;
const PANEL_W = 256;

type Tool = 'wall' | 'turret' | 'erase';

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

  private hudText!: Phaser.GameObjects.Text;
  private toolButtons!: Record<Tool, Button>;
  private pathsButton!: Button;
  private speedButton!: Button;

  constructor() {
    super('playground');
  }

  create(): void {
    this.children.removeAll();
    this.engine = new Engine(
      {
        width: GRID_W,
        height: GRID_H,
        seed: Date.now() >>> 0,
        ccOrigin: 11 * GRID_W + 29,
        spawnColumn: 0,
      },
      M1_CATALOG,
    );
    this.battle = new BattleRenderer(this, this.engine, CELL);
    this.accumulator = 0;
    this.lastPaintedCell = -1;

    this.add
      .text(GRID_PX_W / 2, 6, 'SECTOR 7 — TRAINING RANGE (SANDBOX)', mono(11, COLORS.inkDim))
      .setOrigin(0.5, 0)
      .setDepth(5);

    this.buildPanel();
    this.bindInput();
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

  private bindInput(): void {
    this.input.removeAllListeners();
    this.input.keyboard?.removeAllListeners();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const cell = this.cellFromPointer(pointer);
      if (cell !== null) this.applyTool(cell, true);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      const cell = this.cellFromPointer(pointer);
      if (cell !== null) this.applyTool(cell, false);
    });

    const kb = this.input.keyboard;
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

  private cellFromPointer(pointer: Phaser.Input.Pointer): number | null {
    if (pointer.x >= GRID_PX_W || pointer.y >= GRID_PX_H) return null;
    return this.engine.grid.idx(Math.floor(pointer.x / CELL), Math.floor(pointer.y / CELL));
  }

  private applyTool(cell: number, isFirstPress: boolean): void {
    if (cell === this.lastPaintedCell && !isFirstPress) return;
    this.lastPaintedCell = cell;
    if (this.tool === 'wall') {
      this.engine.command({ type: 'placeWall', cell, kind: 'wall' });
    } else if (this.tool === 'erase') {
      if (this.engine.grid.wallAt(cell)) this.engine.command({ type: 'removeWall', cell });
      else this.engine.command({ type: 'removeStructure', cell });
    } else if (isFirstPress) {
      this.engine.command({ type: 'placeStructure', cell, kind: 'm2nest' });
    }
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    for (const key of ['wall', 'turret', 'erase'] as const) {
      this.toolButtons[key].setActive(key === tool);
    }
  }

  private togglePaths(): void {
    this.showPaths = !this.showPaths;
    this.pathsButton.setLabel(this.showPaths ? 'PATHS: ON  [P]' : 'PATHS: OFF [P]');
  }

  private cycleSpeed(): void {
    this.speedMult = this.speedMult >= 4 ? 1 : this.speedMult * 2;
    this.speedButton.setLabel(`SPEED: ×${this.speedMult} [S]`);
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
    const pointer = this.input.activePointer;
    if (pointer.x >= GRID_PX_W || pointer.y >= GRID_PX_H) return undefined;
    const cell = this.engine.grid.idx(Math.floor(pointer.x / CELL), Math.floor(pointer.y / CELL));
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

  private buildPanel(): void {
    const x0 = GRID_PX_W;
    const pad = 16;
    const bw = PANEL_W - pad * 2;
    this.add.rectangle(x0, 0, PANEL_W, GRID_PX_H, COLORS.bgPanel).setOrigin(0, 0);
    this.add.rectangle(x0, 0, 2, GRID_PX_H, COLORS.gridLine).setOrigin(0, 0);

    let y = pad;
    this.add.text(x0 + pad, y, 'LAST LINE', mono(20, COLORS.ink, { fontStyle: 'bold' }));
    y += 26;
    this.add.text(x0 + pad, y, 'SANDBOX — MAZE LAB', mono(11, COLORS.inkDim));
    y += 30;

    const section = (title: string) => {
      this.add.text(x0 + pad, y, title, mono(10, COLORS.inkDim));
      y += 18;
    };
    const button = (label: string, onClick: () => void): Button => {
      const b = makeButton(this, x0 + pad, y, bw, 26, label, onClick);
      y += 32;
      return b;
    };

    section('TOOL');
    this.toolButtons = {
      wall: button('BUILD WALL [1]', () => this.setTool('wall')),
      turret: button('PLACE M2 NEST [2]', () => this.setTool('turret')),
      erase: button('ERASE [3]', () => this.setTool('erase')),
    };
    this.toolButtons.wall.setActive(true);
    y += 6;

    section('SPAWN HOSTILES');
    button('MILITIA — mazes [W]', () => this.spawn(this.engine.catalog.attackers['militia']!));
    button('SAPPER — chews [B]', () => this.spawn(this.engine.catalog.attackers['sapper']!));
    button('WAVE ×10 [SPACE]', () => this.spawnWave());
    y += 6;

    section('VIEW');
    this.pathsButton = button('PATHS: ON  [P]', () => this.togglePaths());
    this.speedButton = button('SPEED: ×1 [S]', () => this.cycleSpeed());
    button('RESET RANGE [R]', () => this.scene.restart());
    y += 10;

    section('SITREP');
    this.hudText = this.add.text(x0 + pad, y, '', mono(12, COLORS.ink, { lineSpacing: 5 }));

    this.add.text(
      x0 + pad,
      GRID_PX_H - 74,
      'Hostiles enter left, push for\nthe CC. Walls reroute them —\nsappers do the math and\nchew straight through.',
      mono(10, COLORS.inkDim, { lineSpacing: 4 }),
    );
  }

  private updateHud(): void {
    const e = this.engine;
    const integrity = Math.max(0, Math.round((e.cc.hp / e.cc.profile.maxHp) * 100));
    this.hudText.setText(
      [
        `TICK   ${String(e.tick).padStart(6, '0')}`,
        `ALIVE  ${e.attackers.length}`,
        `KILLS  ${e.stats.kills}`,
        `CC     ${integrity}%${e.phase === 'defeat' ? ' — LOST' : ''}`,
        `WALLS  ${e.grid.walls.size} (${e.stats.wallsLost} lost)`,
      ].join('\n'),
    );
  }
}
