import Phaser from 'phaser';
import { M1_CATALOG } from '../../content/catalog';
import { HOLD_THE_LINE } from '../../content/missions';
import { outcomeFromEngine } from '../../meta/town';
import { DT, Engine } from '../../sim/engine';
import type { SimConfig, SimEvent } from '../../sim/types';
import { BattleRenderer, type GhostPreview, type PowerPreview } from '../BattleRenderer';
import { COLORS, css } from '../palette';
import { makeButton, mono, type Button } from '../ui';

export interface SiegeLaunchData {
  /** Battle built from the town (meta/town.siegeConfig). Absent = standalone. */
  config?: SimConfig;
  fromTown?: boolean;
}

const CELL = 32;
const GRID_W = 32;
const GRID_H = 24;
const GRID_PX_W = GRID_W * CELL; // 1024
const GRID_PX_H = GRID_H * CELL; // 768
const PANEL_W = 256;

type Tool =
  | { type: 'wall'; kind: string }
  | { type: 'structure'; kind: string }
  | { type: 'erase' }
  | { type: 'power'; kind: string };

const SETUP_TOOL_KEYS = ['wall', 'm2nest', 'autocannon', 'mortar'] as const;
const COMBAT_TOOL_KEYS = ['depmg', 'foxhole', 'claymore', 'hesco'] as const;

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

  private phaseText!: Phaser.GameObjects.Text;
  private suppliesText!: Phaser.GameObjects.Text;
  private cpText!: Phaser.GameObjects.Text;
  private cpBarFill!: Phaser.GameObjects.Rectangle;
  private buildLabel!: Phaser.GameObjects.Text;
  private powersLabel!: Phaser.GameObjects.Text;
  private intelText!: Phaser.GameObjects.Text;
  private sitrepText!: Phaser.GameObjects.Text;
  private buttons: Record<string, Button> = {};

  constructor() {
    super('siege');
  }

  init(data: SiegeLaunchData): void {
    this.launchConfig = data?.config ?? null;
    this.fromTown = data?.fromTown ?? false;
  }

  create(): void {
    this.demoMode =
      !this.fromTown && new URLSearchParams(window.location.search).get('demo') === '1';
    this.tool = null;
    this.speedMult = 1;
    this.accumulator = 0;
    this.overlayShown = false;
    this.buttons = {};

    const config: SimConfig = this.launchConfig ?? {
      width: GRID_W,
      height: GRID_H,
      seed: this.demoMode ? 1337 : Date.now() >>> 0,
      ccOrigin: 11 * GRID_W + 27,
      spawnColumn: 0,
      siege: HOLD_THE_LINE,
    };
    this.engine = new Engine(config, M1_CATALOG);
    this.battle = new BattleRenderer(this, this.engine, CELL);

    this.add
      .text(GRID_PX_W / 2, 6, 'OPERATION LANDFALL — COOS BAY PERIMETER', mono(11, COLORS.inkDim))
      .setOrigin(0.5, 0)
      .setDepth(5);

    this.buildPanel();
    this.bindInput();
    this.refreshPanel();

    if (this.demoMode) this.applyDemoScript();
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
    this.refreshPanel();
  }

  // ---- input ----------------------------------------------------------------------

  private bindInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.setTool(null);
        return;
      }
      this.handlePointer(pointer, true);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) this.handlePointer(pointer, false);
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
    this.scene.start('town', { outcome: outcomeFromEngine(this.engine) });
  }

  private setTool(tool: Tool | null): void {
    this.tool = tool;
    for (const key of [...SETUP_TOOL_KEYS, ...COMBAT_TOOL_KEYS, 'erase', 'a10', 'arty']) {
      const active =
        tool !== null &&
        ((tool.type === 'erase' && key === 'erase') ||
          ((tool.type === 'wall' || tool.type === 'structure' || tool.type === 'power') &&
            'kind' in tool &&
            tool.kind === key));
      this.buttons[key]?.setActive(active);
    }
  }

  private handlePointer(pointer: Phaser.Input.Pointer, isFirstPress: boolean): void {
    if (!this.tool || pointer.x >= GRID_PX_W || pointer.y >= GRID_PX_H) return;
    const cellX = Math.floor(pointer.x / CELL);
    const cellY = Math.floor(pointer.y / CELL);
    const cell = this.engine.grid.idx(cellX, cellY);

    if (this.tool.type === 'power') {
      if (!isFirstPress) return;
      this.engine.command({
        type: 'castPower',
        kind: this.tool.kind,
        target: { x: pointer.x / CELL, y: pointer.y / CELL },
      });
      this.setTool(null);
      return;
    }

    if (cell === this.lastPaintedCell && !isFirstPress) return;
    this.lastPaintedCell = cell;

    if (this.tool.type === 'wall') {
      this.engine.command({ type: 'placeWall', cell, kind: this.tool.kind });
    } else if (this.tool.type === 'erase') {
      if (this.engine.grid.wallAt(cell)) this.engine.command({ type: 'removeWall', cell });
      else this.engine.command({ type: 'removeStructure', cell });
    } else if (isFirstPress) {
      // Structures place on click only — drag-placing towers is a misclick machine.
      this.engine.command({ type: 'placeStructure', cell, kind: this.tool.kind });
    }
  }

  private cycleSpeed(): void {
    this.speedMult = this.speedMult >= 4 ? 1 : this.speedMult * 2;
    this.buttons['speed']?.setLabel(`SPEED ×${this.speedMult} [S]`);
  }

  // ---- sim stepping ------------------------------------------------------------------

  override update(_time: number, deltaMs: number): void {
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
          this.setTool(null);
          this.refreshPanel();
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
    if (pointer.x >= GRID_PX_W || pointer.y >= GRID_PX_H) return undefined;
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
    if (pointer.x >= GRID_PX_W || pointer.y >= GRID_PX_H) return undefined;
    return { kind: this.tool.kind, at: { x: pointer.x / CELL, y: pointer.y / CELL } };
  }

  // ---- panel -----------------------------------------------------------------------------

  private buildPanel(): void {
    const x0 = GRID_PX_W;
    const pad = 14;
    const bw = PANEL_W - pad * 2;
    this.add.rectangle(x0, 0, PANEL_W, GRID_PX_H, COLORS.bgPanel).setOrigin(0, 0);
    this.add.rectangle(x0, 0, 2, GRID_PX_H, COLORS.gridLine).setOrigin(0, 0);

    this.add.text(x0 + pad, 12, 'LAST LINE', mono(17, COLORS.ink, { fontStyle: 'bold' }));
    this.add.text(
      x0 + pad,
      34,
      this.engine.config.siege?.name ?? 'SANDBOX',
      mono(10, COLORS.inkDim),
    );
    this.phaseText = this.add.text(x0 + pad, 54, '', mono(13, COLORS.ink, { fontStyle: 'bold' }));

    this.suppliesText = this.add.text(x0 + pad, 78, '', mono(12));
    this.cpText = this.add.text(x0 + pad, 96, '', mono(12));
    this.add
      .rectangle(x0 + pad + 64, 97, bw - 64, 10, COLORS.bgField)
      .setOrigin(0, 0)
      .setStrokeStyle(1, COLORS.gridLine);
    this.cpBarFill = this.add
      .rectangle(x0 + pad + 65, 98, 0, 8, COLORS.intel)
      .setOrigin(0, 0);

    this.buildLabel = this.add.text(x0 + pad, 118, 'BUILD', mono(10, COLORS.inkDim));
    const slot = (i: number) => 132 + i * 30;
    const catalog = this.engine.catalog;

    // Permanent layer (setup/prep).
    this.buttons['wall'] = makeButton(this, x0 + pad, slot(0), bw, 26, '', () =>
      this.setTool({ type: 'wall', kind: 'wall' }),
    );
    this.buttons['m2nest'] = makeButton(this, x0 + pad, slot(1), bw, 26, '', () =>
      this.setTool({ type: 'structure', kind: 'm2nest' }),
    );
    this.buttons['autocannon'] = makeButton(this, x0 + pad, slot(2), bw, 26, '', () =>
      this.setTool({ type: 'structure', kind: 'autocannon' }),
    );
    this.buttons['mortar'] = makeButton(this, x0 + pad, slot(3), bw, 26, '', () =>
      this.setTool({ type: 'structure', kind: 'mortar' }),
    );
    this.buttons['erase'] = makeButton(this, x0 + pad, slot(4) + 4, bw, 26, 'ERASE / REFUND [E]', () =>
      this.setTool({ type: 'erase' }),
    );
    this.buttons['repair'] = makeButton(this, x0 + pad, slot(5) + 8, bw, 26, '', () =>
      this.engine.command({ type: 'repairAll' }),
    );
    this.buttons['start'] = makeButton(this, x0 + pad, slot(6) + 16, bw, 30, 'START ASSAULT [SPACE]', () =>
      this.advancePhase(),
    );
    this.buttons['skip'] = makeButton(this, x0 + pad, slot(6) + 16, bw, 30, 'SKIP PREP [SPACE]', () =>
      this.advancePhase(),
    );

    // Battle layer (combat).
    this.buttons['depmg'] = makeButton(this, x0 + pad, slot(0), bw, 26, '', () =>
      this.setTool({ type: 'structure', kind: 'depmg' }),
    );
    this.buttons['foxhole'] = makeButton(this, x0 + pad, slot(1), bw, 26, '', () =>
      this.setTool({ type: 'structure', kind: 'foxhole' }),
    );
    this.buttons['claymore'] = makeButton(this, x0 + pad, slot(2), bw, 26, '', () =>
      this.setTool({ type: 'structure', kind: 'claymore' }),
    );
    this.buttons['hesco'] = makeButton(this, x0 + pad, slot(3), bw, 26, '', () =>
      this.setTool({ type: 'wall', kind: 'hesco' }),
    );
    this.powersLabel = this.add.text(x0 + pad, slot(4) + 6, 'COMMANDER POWERS', mono(10, COLORS.inkDim));
    this.buttons['a10'] = makeButton(this, x0 + pad, slot(4) + 20, bw, 26, '', () =>
      this.armPower('a10'),
    );
    this.buttons['arty'] = makeButton(this, x0 + pad, slot(5) + 24, bw, 26, '', () =>
      this.armPower('arty'),
    );

    // Static labels for costs.
    const w = catalog.walls;
    const s = catalog.structures;
    const p = catalog.powers;
    this.buttons['wall']!.setLabel(`WALL — ${w['wall']!.supplyCost} SUP [1]`);
    this.buttons['m2nest']!.setLabel(`M2 MG NEST — ${s['m2nest']!.supplyCost} SUP [2]`);
    this.buttons['autocannon']!.setLabel(`25MM AUTOCANNON — ${s['autocannon']!.supplyCost} [3]`);
    this.buttons['mortar']!.setLabel(`120MM MORTAR — ${s['mortar']!.supplyCost} SUP [4]`);
    this.buttons['depmg']!.setLabel(`DEPLOYABLE MG — ${s['depmg']!.cpCost} CP [1]`);
    this.buttons['foxhole']!.setLabel(`RIFLE FOXHOLE — ${s['foxhole']!.cpCost} CP [2]`);
    this.buttons['claymore']!.setLabel(`CLAYMORE FIELD — ${s['claymore']!.cpCost} CP [3]`);
    this.buttons['hesco']!.setLabel(`HESCO BARRICADE — ${w['hesco']!.cpCost} CP [4]`);
    this.buttons['a10']!.setLabel(`A-10 GUN RUN — ${p['a10']!.cpCost} CP [Q]`);
    this.buttons['arty']!.setLabel(`155MM MISSION — ${p['arty']!.cpCost} CP [W]`);

    this.add.text(x0 + pad, 386, 'INTEL', mono(10, COLORS.inkDim));
    this.intelText = this.add.text(x0 + pad, 402, '', mono(11, COLORS.ink, { lineSpacing: 4 }));

    this.add.text(x0 + pad, 540, 'SITREP', mono(10, COLORS.inkDim));
    this.sitrepText = this.add.text(x0 + pad, 556, '', mono(11, COLORS.ink, { lineSpacing: 4 }));

    this.buttons['paths'] = makeButton(this, x0 + pad, 676, (bw - 6) / 2, 24, 'PATHS [P]', () => {
      this.showPaths = !this.showPaths;
    });
    this.buttons['speed'] = makeButton(
      this,
      x0 + pad + (bw + 6) / 2,
      676,
      (bw - 6) / 2,
      24,
      'SPEED ×1 [S]',
      () => this.cycleSpeed(),
    );

    this.add.text(
      x0 + pad,
      712,
      'LMB build · RMB/ESC cancel\nHostiles breach or bypass walls —\nwatch the orange path markers.',
      mono(9, COLORS.inkDim, { lineSpacing: 3 }),
    );
  }

  /** Show/hide button groups when the phase changes. */
  private refreshPanel(): void {
    const phase = this.engine.phase;
    const build = phase === 'setup' || phase === 'prep';
    const combat = phase === 'combat';

    for (const key of ['wall', 'm2nest', 'autocannon', 'mortar', 'erase', 'repair'] as const) {
      this.buttons[key]?.setVisible(build);
    }
    this.buttons['start']?.setVisible(phase === 'setup');
    this.buttons['skip']?.setVisible(phase === 'prep');
    for (const key of ['depmg', 'foxhole', 'claymore', 'hesco', 'a10', 'arty'] as const) {
      this.buttons[key]?.setVisible(combat);
    }
    this.powersLabel.setVisible(combat);
    this.buildLabel.setText(combat ? 'FIELD DEPLOY' : 'BUILD');
  }

  private updateHud(): void {
    const e = this.engine;
    const siege = e.config.siege ?? HOLD_THE_LINE;

    switch (e.phase) {
      case 'setup':
        this.phaseText.setText('PHASE: FORTIFY').setColor(css(COLORS.ink));
        break;
      case 'combat':
        this.phaseText
          .setText(`WAVE ${e.waveIndex + 1}/${e.waveCount} — CONTACT`)
          .setColor(css(COLORS.signal));
        break;
      case 'prep':
        this.phaseText
          .setText(`PREP — NEXT WAVE IN ${Math.ceil(e.prepTicksLeft / 20)}s`)
          .setColor(css(COLORS.intel));
        break;
      case 'victory':
        this.phaseText.setText('SECTOR HELD').setColor(css(COLORS.olive));
        break;
      case 'defeat':
        this.phaseText.setText('CC DESTROYED').setColor(css(COLORS.alarm));
        break;
      default:
        this.phaseText.setText(e.phase.toUpperCase());
        break;
    }

    this.suppliesText.setText(`SUPPLIES ${Math.floor(e.supplies)}`);
    this.cpText.setText(`CP ${Math.floor(e.cp)}`);
    const cpFrac = Math.min(1, e.cp / siege.cpCap);
    this.cpBarFill.setSize(Math.max(0, (PANEL_W - 28 - 66) * cpFrac), 8);

    // Button affordability + cooldowns.
    const s = e.catalog.structures;
    const w = e.catalog.walls;
    this.buttons['wall']?.setEnabled(e.supplies >= (w['wall']!.supplyCost ?? 0));
    this.buttons['m2nest']?.setEnabled(e.supplies >= (s['m2nest']!.supplyCost ?? 0));
    this.buttons['autocannon']?.setEnabled(e.supplies >= (s['autocannon']!.supplyCost ?? 0));
    this.buttons['mortar']?.setEnabled(e.supplies >= (s['mortar']!.supplyCost ?? 0));
    this.buttons['depmg']?.setEnabled(e.cp >= (s['depmg']!.cpCost ?? 0));
    this.buttons['foxhole']?.setEnabled(e.cp >= (s['foxhole']!.cpCost ?? 0));
    this.buttons['claymore']?.setEnabled(e.cp >= (s['claymore']!.cpCost ?? 0));
    this.buttons['hesco']?.setEnabled(e.cp >= (w['hesco']!.cpCost ?? 0));

    for (const kind of ['a10', 'arty'] as const) {
      const def = e.catalog.powers[kind]!;
      const cd = e.powerCooldownSeconds(kind);
      const button = this.buttons[kind];
      if (!button) continue;
      const charges = e.powerChargesLeft(kind);
      const stock = charges !== null ? ` ×${charges}` : '';
      if (cd > 0) {
        button.setEnabled(false);
        button.setLabel(`${def.name.toUpperCase()} — ${Math.ceil(cd)}s${stock}`);
      } else {
        button.setEnabled(e.canCastPower(kind));
        button.setLabel(
          `${def.name.toUpperCase()} — ${def.cpCost} CP${stock} [${kind === 'a10' ? 'Q' : 'W'}]`,
        );
      }
    }
    const repairCost = e.repairAllCost();
    this.buttons['repair']?.setLabel(
      repairCost > 0 ? `REPAIR ALL — ${repairCost} SUP` : 'REPAIR ALL — INTACT',
    );
    this.buttons['repair']?.setEnabled(repairCost > 0 && e.supplies >= repairCost);

    // Intel block.
    const preview = e.nextWavePreview();
    if (preview) {
      const waveNumber = e.phase === 'setup' ? 1 : e.waveIndex + 2;
      const lines = [`INBOUND — WAVE ${waveNumber}/${e.waveCount}:`];
      for (const { kind, count } of preview) {
        lines.push(` ${count}× ${e.catalog.attackers[kind]?.name.toUpperCase() ?? kind}`);
      }
      this.intelText.setText(lines.join('\n'));
    } else if (e.phase === 'combat') {
      this.intelText.setText(
        [
          `WAVE ${e.waveIndex + 1}/${e.waveCount}`,
          `HOSTILES ON FIELD: ${e.attackers.length}`,
          `CC INTEGRITY: ${Math.max(0, Math.round((e.cc.hp / e.cc.profile.maxHp) * 100))}%`,
        ].join('\n'),
      );
    } else {
      this.intelText.setText('');
    }

    this.sitrepText.setText(
      [
        `CC INTEGRITY ${Math.max(0, Math.round((e.cc.hp / e.cc.profile.maxHp) * 100))}%`,
        `KILLS ${e.stats.kills}   SPAWNED ${e.stats.spawned}`,
        `WALLS LOST ${e.stats.wallsLost}   GUNS LOST ${e.stats.structuresLost}`,
        `SUP SPENT ${e.stats.suppliesSpent}   CP SPENT ${Math.round(e.stats.cpSpent)}`,
      ].join('\n'),
    );
  }

  private showOverlay(victory: boolean): void {
    if (this.overlayShown) return;
    this.overlayShown = true;
    const cx = (GRID_PX_W + PANEL_W) / 2;
    this.add.rectangle(0, 0, GRID_PX_W + PANEL_W, GRID_PX_H, 0x000000, 0.55).setOrigin(0).setDepth(40);
    this.add
      .text(cx, 300, victory ? 'SECTOR HELD' : 'COMMAND CENTER LOST', {
        ...mono(34, victory ? COLORS.olive : COLORS.alarm, { fontStyle: 'bold' }),
      })
      .setOrigin(0.5)
      .setDepth(41);
    const s = this.engine.stats;
    const lines = [
      victory
        ? 'The perimeter held. Coos Bay stays on the map.'
        : 'The line broke. Survivors are falling back inland.',
      '',
      `Hostiles destroyed: ${s.kills} / ${s.spawned}`,
      `Walls lost: ${s.wallsLost}   Structures lost: ${s.structuresLost}`,
    ];
    if (victory && s.salvage > 0) lines.push(`Unspent CP salvaged: +${s.salvage} SUP`);
    lines.push('', this.fromTown ? 'PRESS SPACE TO RETURN TO BASE' : 'PRESS R TO RUN IT BACK');
    this.add
      .text(cx, 356, lines.join('\n'), {
        ...mono(13, COLORS.ink, { lineSpacing: 6, align: 'center' }),
      })
      .setOrigin(0.5, 0)
      .setDepth(41);
  }
}
