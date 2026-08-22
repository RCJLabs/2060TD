import Phaser from 'phaser';
import { BREACHER, MG_TURRET, WALKER, WALL_HP } from '../../content/profiles';
import { DT, Engine } from '../../sim/engine';
import type { RunnerProfile, SimEvent } from '../../sim/types';
import { COLORS, css } from '../palette';

const CELL = 32;
const GRID_W = 32;
const GRID_H = 24;
const GRID_PX_W = GRID_W * CELL; // 1024
const GRID_PX_H = GRID_H * CELL; // 768
const PANEL_W = 256;

const HQ_X = 29;
const HQ_Y = 12;
const SPAWN_COLUMN = 0;

type Tool = 'wall' | 'turret' | 'erase';

interface Effect {
  kind: 'tracer' | 'boom' | 'wallBoom' | 'leak';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  age: number;
  life: number;
}

interface Button {
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  setActive(active: boolean): void;
}

/**
 * M0 Maze Playground — the proof of the maze rule.
 *
 * Paint walls, drop turrets, spawn attackers; watch walkers re-route live
 * while breachers weigh the detour and chew straight through. Rendering is
 * a thin interpolated layer over the deterministic fixed-tick sim.
 */
export class PlaygroundScene extends Phaser.Scene {
  private engine!: Engine;
  private accumulator = 0;
  private speedMult = 1;
  private tool: Tool = 'wall';
  private showPaths = true;
  private demoMode = false;

  private staticLayer!: Phaser.GameObjects.Graphics;
  private dynLayer!: Phaser.GameObjects.Graphics;
  private effects: Effect[] = [];
  private lastPaintedCell = -1;

  private hudText!: Phaser.GameObjects.Text;
  private toolButtons!: Record<Tool, Button>;
  private pathsButton!: Button;
  private speedButton!: Button;

  constructor() {
    super('playground');
  }

  create(): void {
    this.demoMode = new URLSearchParams(window.location.search).has('demo');

    this.staticLayer = this.add.graphics();
    this.dynLayer = this.add.graphics();
    this.drawStaticLayer();
    this.buildPanel();
    this.bindInput();

    this.add
      .text(GRID_PX_W / 2, 6, 'SECTOR 7 — TRAINING RANGE', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: css(COLORS.inkDim),
      })
      .setOrigin(0.5, 0);

    this.resetBattle();
  }

  // ---- battle lifecycle -----------------------------------------------------

  private resetBattle(): void {
    this.engine = new Engine({
      width: GRID_W,
      height: GRID_H,
      seed: this.demoMode ? 1337 : (Date.now() >>> 0),
      wallHp: WALL_HP,
      hqCell: HQ_Y * GRID_W + HQ_X,
      spawnColumn: SPAWN_COLUMN,
    });
    this.effects = [];
    this.accumulator = 0;
    this.lastPaintedCell = -1;
    if (this.demoMode) this.applyDemoScript();
  }

  /**
   * A scripted battle for screenshots/smoke tests (?demo=1): a four-baffle
   * serpentine with turrets at the corners. Walkers run the maze; breachers
   * chew straight through it — the maze rule, visible at a glance.
   */
  private applyDemoScript(): void {
    const e = this.engine;
    const wall = (x: number, y: number) =>
      e.enqueue({ tick: 0, type: 'placeWall', cell: e.grid.idx(x, y) });
    const turret = (x: number, y: number) =>
      e.enqueue({ tick: 0, type: 'placeTurret', cell: e.grid.idx(x, y), profile: MG_TURRET });

    for (let y = 0; y <= 17; y++) wall(8, y); // gap at the bottom
    for (let y = 6; y < GRID_H; y++) wall(14, y); // gap at the top
    for (let y = 0; y <= 17; y++) wall(20, y); // gap at the bottom
    for (let y = 6; y < GRID_H; y++) wall(26, y); // gap at the top

    turret(6, 16);
    turret(10, 20);
    turret(16, 3);
    turret(22, 20);
    turret(28, 3);

    const rows = [2, 6, 10, 14, 18, 22];
    for (let i = 0; i < 14; i++) {
      e.enqueue({
        tick: i * 10,
        type: 'spawnRunner',
        cell: e.grid.idx(SPAWN_COLUMN, rows[i % rows.length]!),
        profile: i % 4 === 1 ? BREACHER : WALKER,
      });
    }

    // Jump straight into mid-battle so screenshots land on the action even
    // when the headless browser only renders a handful of frames.
    e.run(120);
  }

  private spawn(profile: RunnerProfile, atTick?: number): void {
    const row = Math.floor(Math.random() * GRID_H);
    this.engine.enqueue({
      tick: atTick ?? this.engine.tick,
      type: 'spawnRunner',
      cell: this.engine.grid.idx(SPAWN_COLUMN, row),
      profile,
    });
  }

  private spawnWave(): void {
    for (let i = 0; i < 10; i++) {
      this.spawn(i % 3 === 2 ? BREACHER : WALKER, this.engine.tick + i * 8);
    }
  }

  // ---- input ------------------------------------------------------------------

  private bindInput(): void {
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
    kb?.on('keydown-W', () => this.spawn(WALKER));
    kb?.on('keydown-B', () => this.spawn(BREACHER));
    kb?.on('keydown-SPACE', () => this.spawnWave());
    kb?.on('keydown-P', () => this.togglePaths());
    kb?.on('keydown-S', () => this.cycleSpeed());
    kb?.on('keydown-R', () => this.resetBattle());
  }

  private cellFromPointer(pointer: Phaser.Input.Pointer): number | null {
    if (pointer.x >= GRID_PX_W || pointer.y >= GRID_PX_H) return null;
    const x = Math.floor(pointer.x / CELL);
    const y = Math.floor(pointer.y / CELL);
    return this.engine.grid.idx(x, y);
  }

  private applyTool(cell: number, isFirstPress: boolean): void {
    if (cell === this.lastPaintedCell && !isFirstPress) return;
    this.lastPaintedCell = cell;
    if (this.tool === 'wall') {
      this.engine.command({ type: 'placeWall', cell });
    } else if (this.tool === 'erase') {
      this.engine.command({ type: 'removeWall', cell });
    } else if (isFirstPress) {
      // Turrets place on click only — drag-placing towers is a misclick machine.
      this.engine.command({ type: 'placeTurret', cell, profile: MG_TURRET });
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
    this.pathsButton.label.setText(this.showPaths ? 'PATHS: ON  [P]' : 'PATHS: OFF [P]');
  }

  private cycleSpeed(): void {
    this.speedMult = this.speedMult >= 4 ? 1 : this.speedMult * 2;
    this.speedButton.label.setText(`SPEED: ×${this.speedMult} [S]`);
  }

  // ---- sim stepping ---------------------------------------------------------

  override update(_time: number, deltaMs: number): void {
    this.accumulator += (deltaMs / 1000) * this.speedMult;
    let safety = 12; // don't spiral if a tab was backgrounded
    while (this.accumulator >= DT && safety-- > 0) {
      this.accumulator -= DT;
      const events = this.engine.step();
      this.consumeEvents(events);
    }
    if (this.accumulator > DT) this.accumulator = 0;

    const alpha = Phaser.Math.Clamp(this.accumulator / DT, 0, 1);
    this.drawDynamicLayer(alpha, deltaMs / 1000);
    this.updateHud();
  }

  private consumeEvents(events: SimEvent[]): void {
    const grid = this.engine.grid;
    for (const event of events) {
      switch (event.type) {
        case 'shot':
          this.effects.push({
            kind: 'tracer',
            x: event.from.x,
            y: event.from.y,
            x2: event.to.x,
            y2: event.to.y,
            age: 0,
            life: 0.1,
          });
          break;
        case 'runnerDied':
          this.effects.push({ kind: 'boom', x: event.at.x, y: event.at.y, age: 0, life: 0.35 });
          break;
        case 'wallDestroyed': {
          const c = grid.centerOf(event.cell);
          this.effects.push({ kind: 'wallBoom', x: c.x, y: c.y, age: 0, life: 0.4 });
          break;
        }
        case 'runnerLeaked': {
          const c = grid.centerOf(this.engine.config.hqCell);
          this.effects.push({ kind: 'leak', x: c.x, y: c.y, age: 0, life: 0.5 });
          break;
        }
        case 'runnerSpawned':
          break;
      }
    }
  }

  // ---- rendering --------------------------------------------------------------

  private drawStaticLayer(): void {
    const g = this.staticLayer;
    g.clear();

    g.fillStyle(COLORS.bgField, 1);
    g.fillRect(0, 0, GRID_PX_W, GRID_PX_H);

    g.lineStyle(1, COLORS.gridLine, 1);
    for (let x = 0; x <= GRID_W; x++) {
      g.lineBetween(x * CELL, 0, x * CELL, GRID_PX_H);
    }
    for (let y = 0; y <= GRID_H; y++) {
      g.lineBetween(0, y * CELL, GRID_PX_W, y * CELL);
    }

    // Attacker entry column: tinted strip with chevrons.
    g.fillStyle(COLORS.alarm, 0.07);
    g.fillRect(0, 0, CELL, GRID_PX_H);
    g.fillStyle(COLORS.alarm, 0.4);
    for (let y = 1; y < GRID_H; y += 3) {
      const cy = y * CELL + CELL / 2;
      g.fillTriangle(8, cy - 6, 8, cy + 6, 20, cy);
    }

    // Command Center.
    const hx = HQ_X * CELL;
    const hy = HQ_Y * CELL;
    g.fillStyle(COLORS.intel, 1);
    g.fillRect(hx + 3, hy + 3, CELL - 6, CELL - 6);
    g.lineStyle(2, COLORS.ink, 0.9);
    g.strokeRect(hx + 3, hy + 3, CELL - 6, CELL - 6);
    this.add
      .text(hx + CELL / 2, hy + CELL / 2, 'HQ', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: css(COLORS.ink),
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
  }

  private drawDynamicLayer(alpha: number, dtSeconds: number): void {
    const g = this.dynLayer;
    const grid = this.engine.grid;
    g.clear();

    // Walls, shaded by remaining HP.
    for (const [cell, wall] of grid.walls) {
      const x = grid.xOf(cell) * CELL;
      const y = grid.yOf(cell) * CELL;
      g.fillStyle(COLORS.sandDark, 1);
      g.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      g.fillStyle(COLORS.sand, 0.35 + 0.65 * (wall.hp / wall.maxHp));
      g.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
      const damage = 1 - wall.hp / wall.maxHp;
      if (damage > 0.02) {
        g.fillStyle(COLORS.signal, 0.35 * damage);
        g.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
      }
    }

    // Turrets.
    for (const turret of this.engine.turrets) {
      const c = grid.centerOf(turret.cell);
      const px = c.x * CELL;
      const py = c.y * CELL;
      if (this.tool === 'turret') {
        g.lineStyle(1, COLORS.olive, 0.18);
        g.strokeCircle(px, py, turret.profile.range * CELL);
      }
      g.fillStyle(COLORS.oliveDark, 1);
      g.fillRect(px - 11, py - 11, 22, 22);
      g.fillStyle(COLORS.olive, 1);
      g.fillCircle(px, py, 7);
      g.lineStyle(3, COLORS.steel, 1);
      g.lineBetween(px, py, px, py - 12);
    }

    // Attacker paths (the maze rule, visualized).
    if (this.showPaths) {
      for (const runner of this.engine.runners) {
        if (!runner.path) continue;
        g.lineStyle(1.5, runner.profile.wallDps > 20 ? COLORS.signal : COLORS.alarm, 0.22);
        g.beginPath();
        const rp = this.lerpPos(runner, alpha);
        g.moveTo(rp.x * CELL, rp.y * CELL);
        for (let i = runner.pathIndex; i < runner.path.length; i++) {
          const c = grid.centerOf(runner.path[i]!);
          g.lineTo(c.x * CELL, c.y * CELL);
        }
        g.strokePath();
        // Mark the wall cells this unit intends to chew through.
        for (let i = runner.pathIndex; i < runner.path.length; i++) {
          const cell = runner.path[i]!;
          if (grid.wallAt(cell)) {
            const c = grid.centerOf(cell);
            g.fillStyle(COLORS.signal, 0.5);
            g.fillCircle(c.x * CELL, c.y * CELL, 4);
          }
        }
      }
    }

    // Runners.
    for (const runner of this.engine.runners) {
      const p = this.lerpPos(runner, alpha);
      const px = p.x * CELL;
      const py = p.y * CELL;
      const isBreacher = runner.profile.wallDps > 20;

      if (isBreacher) {
        g.fillStyle(COLORS.signal, 1);
        g.fillPoints(
          [
            { x: px, y: py - 9 },
            { x: px + 9, y: py },
            { x: px, y: py + 9 },
            { x: px - 9, y: py },
          ],
          true,
        );
      } else {
        g.fillStyle(COLORS.alarm, 1);
        g.fillCircle(px, py, 8);
      }
      if (runner.state === 'breaking') {
        g.lineStyle(2, COLORS.tracer, 0.8);
        g.strokeCircle(px, py, 11);
      }

      const hpFrac = runner.hp / runner.profile.maxHp;
      if (hpFrac < 1) {
        g.fillStyle(0x000000, 0.6);
        g.fillRect(px - 10, py - 15, 20, 3);
        g.fillStyle(hpFrac > 0.4 ? COLORS.olive : COLORS.signal, 1);
        g.fillRect(px - 10, py - 15, 20 * Math.max(hpFrac, 0), 3);
      }
    }

    // Transient effects.
    this.effects = this.effects.filter((fx) => (fx.age += dtSeconds) < fx.life);
    for (const fx of this.effects) {
      const t = fx.age / fx.life;
      switch (fx.kind) {
        case 'tracer':
          g.lineStyle(1.5, COLORS.tracer, 0.9 * (1 - t));
          g.lineBetween(fx.x * CELL, fx.y * CELL, fx.x2! * CELL, fx.y2! * CELL);
          break;
        case 'boom':
          g.lineStyle(2, COLORS.signal, 0.8 * (1 - t));
          g.strokeCircle(fx.x * CELL, fx.y * CELL, 4 + 12 * t);
          break;
        case 'wallBoom':
          g.lineStyle(3, COLORS.sand, 0.8 * (1 - t));
          g.strokeCircle(fx.x * CELL, fx.y * CELL, 6 + 14 * t);
          break;
        case 'leak':
          g.lineStyle(3, COLORS.alarm, 0.9 * (1 - t));
          g.strokeCircle(fx.x * CELL, fx.y * CELL, 8 + 22 * t);
          break;
      }
    }
  }

  private lerpPos(
    runner: { pos: { x: number; y: number }; prevPos: { x: number; y: number } },
    alpha: number,
  ): { x: number; y: number } {
    return {
      x: runner.prevPos.x + (runner.pos.x - runner.prevPos.x) * alpha,
      y: runner.prevPos.y + (runner.pos.y - runner.prevPos.y) * alpha,
    };
  }

  // ---- side panel ---------------------------------------------------------------

  private buildPanel(): void {
    const x0 = GRID_PX_W;
    this.add.rectangle(x0, 0, PANEL_W, GRID_PX_H, COLORS.bgPanel).setOrigin(0, 0);
    this.add.rectangle(x0, 0, 2, GRID_PX_H, COLORS.gridLine).setOrigin(0, 0);

    const pad = 16;
    let y = pad;

    this.add.text(x0 + pad, y, 'LAST LINE', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: css(COLORS.ink),
      fontStyle: 'bold',
    });
    y += 26;
    this.add.text(x0 + pad, y, 'M0 — MAZE PLAYGROUND', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: css(COLORS.inkDim),
    });
    y += 30;

    const section = (title: string) => {
      this.add.text(x0 + pad, y, title, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: css(COLORS.inkDim),
      });
      y += 18;
    };
    const button = (label: string, onClick: () => void): Button => {
      const b = this.makeButton(x0 + pad, y, PANEL_W - pad * 2, 26, label, onClick);
      y += 32;
      return b;
    };

    section('TOOL');
    this.toolButtons = {
      wall: button('BUILD WALL [1]', () => this.setTool('wall')),
      turret: button('PLACE MG TURRET [2]', () => this.setTool('turret')),
      erase: button('ERASE WALL [3]', () => this.setTool('erase')),
    };
    this.toolButtons.wall.setActive(true);
    y += 6;

    section('SPAWN HOSTILES');
    button('WALKER — mazes [W]', () => this.spawn(WALKER));
    button('BREACHER — chews [B]', () => this.spawn(BREACHER));
    button('WAVE ×10 [SPACE]', () => this.spawnWave());
    y += 6;

    section('VIEW');
    this.pathsButton = button('PATHS: ON  [P]', () => this.togglePaths());
    this.speedButton = button(`SPEED: ×1 [S]`, () => this.cycleSpeed());
    button('RESET RANGE [R]', () => this.resetBattle());
    y += 10;

    section('SITREP');
    this.hudText = this.add.text(x0 + pad, y, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: css(COLORS.ink),
      lineSpacing: 5,
    });

    this.add.text(
      x0 + pad,
      GRID_PX_H - 74,
      'Hostiles enter left,\npush toward the HQ.\nWalls reroute them —\nbreachers do the math.',
      {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: css(COLORS.inkDim),
        lineSpacing: 4,
      },
    );
  }

  private makeButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
  ): Button {
    const bg = this.add
      .rectangle(x, y, width, height, COLORS.bgField)
      .setOrigin(0, 0)
      .setStrokeStyle(1, COLORS.gridLine)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x + 10, y + height / 2, label, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: css(COLORS.ink),
      })
      .setOrigin(0, 0.5);

    let active = false;
    const restingColor = () => (active ? COLORS.oliveDark : COLORS.bgField);
    bg.on('pointerover', () => bg.setFillStyle(active ? COLORS.olive : COLORS.gridLine));
    bg.on('pointerout', () => bg.setFillStyle(restingColor()));
    bg.on('pointerdown', (pointer: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      onClick();
      bg.setFillStyle(restingColor());
    });

    return {
      bg,
      label: text,
      setActive(value: boolean) {
        active = value;
        bg.setFillStyle(restingColor());
        bg.setStrokeStyle(1, active ? COLORS.olive : COLORS.gridLine);
      },
    };
  }

  private updateHud(): void {
    const s = this.engine.stats;
    this.hudText.setText(
      [
        `TICK   ${String(this.engine.tick).padStart(6, '0')}`,
        `ALIVE  ${this.engine.runners.length}`,
        `KILLS  ${s.kills}`,
        `LEAKS  ${s.leaks}`,
        `WALLS  ${this.engine.grid.walls.size} (${s.wallsLost} lost)`,
      ].join('\n'),
    );
  }
}
