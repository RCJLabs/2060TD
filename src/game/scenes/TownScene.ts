import Phaser from 'phaser';
import { BUILDABLE_KINDS, CHARGE_CAP, CHARGE_PRICES, TOWN_META } from '../../content/buildings';
import { clearSave, downloadSave, loadTown, pickAndImportSave, saveTown } from '../../meta/save';
import {
  applySiegeResult,
  buildSpeedFactor,
  buyCharge,
  canPlace,
  canPlaceWall,
  caps,
  ccLevel,
  countOf,
  footprintCells,
  gating,
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
  structureAt,
  tick,
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
  private selectedText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private buttons: Record<string, Button> = {};

  constructor() {
    super('town');
  }

  init(data: { outcome?: SiegeOutcome }): void {
    const now = Date.now();
    this.demoMode = new URLSearchParams(window.location.search).get('demo') === 'town';

    if (this.demoMode) {
      this.town = makeShowcaseTown(now);
    } else if (!this.town) {
      const town = loadTown(now);
      const before = Math.floor(town.supplies + town.fuel);
      const away = now - town.lastSeen;
      tick(town, now);
      const gained = Math.floor(town.supplies + town.fuel) - before;
      if (away > 5 * 60_000 && gained > 0) {
        this.setBanner(`WHILE YOU WERE GONE: +${gained} RESOURCES ACCRUED`, 12);
      }
      this.town = town;
    }

    if (data?.outcome && !this.demoMode) {
      const levelFought = this.town.assaultLevel;
      applySiegeResult(this.town, data.outcome, now);
      saveTown(this.town);
      this.setBanner(
        data.outcome.victory
          ? `SECTOR HELD — ASSAULT LV ${levelFought} REPELLED. LOOT SECURED.`
          : `THE LINE BROKE — RAIDERS TOOK THEIR CUT. REBUILD AND DIG IN.`,
        14,
      );
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
      .text(GRID_PX_W / 2, 6, 'FORWARD BASE — COOS BAY', mono(11, COLORS.inkDim))
      .setOrigin(0.5, 0)
      .setDepth(5);

    this.buildPanel();
    this.bindInput();
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
    kb?.on('keydown-SPACE', () => this.launchSiege());
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
    this.tool = tool;
    for (const kind of BUILDABLE_KINDS) {
      this.buttons[kind]?.setActive(tool.type === 'build' && tool.kind === kind);
    }
    this.buttons['wall']?.setActive(tool.type === 'wall');
    this.buttons['erase']?.setActive(tool.type === 'erase');
    this.buttons['moveBtn']?.setActive(tool.type === 'move');
  }

  private launchSiege(): void {
    if (this.demoMode) return;
    saveTown(this.town);
    const config = siegeConfig(this.town, Date.now() >>> 0);
    this.scene.start('siege', { config, fromTown: true });
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
      const footprint = s.kind === 'cc' || TOWN_META[s.kind]?.storage || isBig(s.kind) ? 2 : 1;
      const center = this.cellCenterPx(s.cell, footprint);
      const building = s.buildEndsAt !== undefined;
      drawStructureGlyph(g, s.kind, center.x, center.y, CELL, {
        level: s.level,
        wrecked: s.wrecked,
        inert: building && s.upgradingTo === undefined,
      });
      if (building) {
        const meta = TOWN_META[s.kind];
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

    this.add.text(x0 + pad, 10, 'LAST LINE', mono(17, COLORS.ink, { fontStyle: 'bold' }));
    this.add.text(x0 + pad, 32, 'M2 — FORWARD BASE', mono(10, COLORS.inkDim));
    this.warText = this.add.text(x0 + pad, 48, '', mono(12, COLORS.signal, { fontStyle: 'bold' }));

    this.suppliesText = this.add.text(x0 + pad, 70, '', mono(11));
    this.fuelText = this.add.text(x0 + pad, 86, '', mono(11));

    this.add.text(x0 + pad, 106, 'CONSTRUCTION', mono(10, COLORS.inkDim));
    let y = 120;
    for (const kind of BUILDABLE_KINDS) {
      this.buttons[kind] = makeButton(this, x0 + pad, y, bw, 24, '', () =>
        this.setTool({ type: 'build', kind }),
      );
      y += 27;
    }
    this.buttons['wall'] = makeButton(this, x0 + pad, y, (bw - 6) / 2, 24, 'WALL 10S', () =>
      this.setTool({ type: 'wall' }),
    );
    this.buttons['erase'] = makeButton(
      this,
      x0 + pad + (bw + 6) / 2,
      y,
      (bw - 6) / 2,
      24,
      'ERASE WALL',
      () => this.setTool({ type: 'erase' }),
    );
    y += 34;

    this.add.text(x0 + pad, y, 'SELECTED', mono(10, COLORS.inkDim));
    this.selectedText = this.add.text(x0 + pad, y + 14, '', mono(11, COLORS.ink, { lineSpacing: 3 }));
    y += 84;
    const half = (bw - 6) / 2;
    this.buttons['upgradeBtn'] = makeButton(this, x0 + pad, y, half, 24, 'UPGRADE', () =>
      this.onUpgrade(),
    );
    this.buttons['moveBtn'] = makeButton(this, x0 + pad + half + 6, y, half, 24, 'MOVE', () =>
      this.onMove(),
    );
    y += 28;
    this.buttons['sellBtn'] = makeButton(this, x0 + pad, y, half, 24, 'SELL 50%', () =>
      this.onSell(),
    );
    this.buttons['repairBtn'] = makeButton(this, x0 + pad + half + 6, y, half, 24, 'REPAIR', () =>
      this.onRepair(),
    );
    y += 34;

    this.add.text(x0 + pad, y, 'ORDNANCE (FUEL)', mono(10, COLORS.inkDim));
    y += 14;
    this.buttons['buyA10'] = makeButton(this, x0 + pad, y, bw, 24, '', () => {
      if (buyCharge(this.town, 'a10')) this.saveSoon();
    });
    y += 27;
    this.buttons['buyArty'] = makeButton(this, x0 + pad, y, bw, 24, '', () => {
      if (buyCharge(this.town, 'arty')) this.saveSoon();
    });
    y += 34;

    this.buttons['defend'] = makeButton(this, x0 + pad, y, bw, 30, '', () => this.launchSiege());
    y += 40;

    const third = (bw - 12) / 3;
    this.buttons['export'] = makeButton(this, x0 + pad, y, third, 22, 'EXPORT', () =>
      downloadSave(this.town),
    );
    this.buttons['import'] = makeButton(this, x0 + pad + third + 6, y, third, 22, 'IMPORT', () => {
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
    this.buttons['reset'] = makeButton(this, x0 + pad + (third + 6) * 2, y, third, 22, 'RESET', () =>
      this.onReset(),
    );
    y += 30;

    this.bannerText = this.add.text(x0 + pad, y, '', mono(10, COLORS.signal, { lineSpacing: 3, wordWrap: { width: bw } }));

    this.add.text(
      x0 + pad,
      GRID_PX_H - 44,
      'LMB use tool · RMB/ESC select mode\nAttackers enter from the west strip.',
      mono(9, COLORS.inkDim, { lineSpacing: 3 }),
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
      this.buttons['reset']?.setLabel('SURE?');
      return;
    }
    clearSave();
    this.town = newTown(now);
    this.selectedId = null;
    this.buttons['reset']?.setLabel('RESET');
    this.setBanner('BASE ABANDONED. A NEW COMMAND CENTER STANDS.', 8);
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
    this.warText.setText(
      `ASSAULT LV ${town.assaultLevel} INBOUND · ${town.victories}W ${town.defeats}L`,
    );
    this.suppliesText.setText(
      `SUPPLIES ${Math.floor(town.supplies)}/${cap.supplies}  (+${rate.supplies}/min)`,
    );
    this.fuelText.setText(`FUEL     ${Math.floor(town.fuel)}/${cap.fuel}  (+${rate.fuel}/min)`);

    const g = gating(town);
    for (const kind of BUILDABLE_KINDS) {
      const meta = TOWN_META[kind]!;
      const cost = meta.levels[0]!;
      const max = g.counts[kind] ?? 0;
      const have = countOf(town, kind);
      const costText = cost.fuel > 0 ? `${cost.supplies}S+${cost.fuel}F` : `${cost.supplies}S`;
      const button = this.buttons[kind]!;
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
      const meta = TOWN_META[s.kind];
      const lines: string[] = [`${meta?.name.toUpperCase() ?? s.kind} — LV ${s.level}`];
      if (s.wrecked) {
        const cost = repairCost(s);
        lines.push('STATUS: WRECKED', `REPAIR: ${cost.supplies}S+${cost.fuel}F`);
      } else if (s.buildEndsAt !== undefined) {
        const secs = Math.max(0, Math.ceil((s.buildEndsAt - now) / 1000));
        lines.push(s.upgradingTo ? `UPGRADING → LV ${s.upgradingTo}: ${secs}s` : `BUILDING: ${secs}s`);
      } else {
        lines.push('STATUS: OPERATIONAL');
      }
      if (meta?.generatesSupplies) lines.push(`OUTPUT: ${meta.generatesSupplies[s.level - 1]} SUP/min`);
      if (meta?.generatesFuel) lines.push(`OUTPUT: ${meta.generatesFuel[s.level - 1]} FUEL/min`);
      if (meta?.storage) {
        const t = meta.storage[s.level - 1]!;
        lines.push(`STORAGE: +${t.supplies}S +${t.fuel}F`);
      }
      if (meta?.buildSpeed) lines.push(`BUILD SPEED: −${Math.round(meta.buildSpeed[s.level - 1]! * 100)}%`);
      const err = upgradeError(town, s);
      if (err === null) {
        const cost = meta!.levels[s.level]!;
        lines.push(`UPGRADE: ${cost.supplies}S+${cost.fuel}F, ${cost.seconds}s`);
      } else if (err === 'max' && s.kind !== 'cc') {
        lines.push(ccLevel(town) < 3 ? 'UPGRADE: NEEDS CC LEVEL UP' : 'MAX LEVEL');
      }
      this.selectedText.setText(lines.join('\n'));
      this.buttons['upgradeBtn']?.setEnabled(err === null);
      this.buttons['moveBtn']?.setEnabled(s.kind !== 'cc');
      this.buttons['sellBtn']?.setEnabled(s.kind !== 'cc');
      this.buttons['repairBtn']?.setEnabled(
        s.wrecked && town.supplies >= repairCost(s).supplies && town.fuel >= repairCost(s).fuel,
      );
    } else {
      this.selectedText.setText('Click a structure to inspect.\nThe CC gates counts and levels.');
      for (const key of ['upgradeBtn', 'moveBtn', 'sellBtn', 'repairBtn']) {
        this.buttons[key]?.setEnabled(false);
      }
    }

    for (const [key, power] of [
      ['buyA10', 'a10'],
      ['buyArty', 'arty'],
    ] as const) {
      const stock = town.charges[power] ?? 0;
      const price = CHARGE_PRICES[power]!;
      const name = power === 'a10' ? 'A-10 GUN RUN' : '155MM MISSION';
      this.buttons[key]?.setLabel(`${name} ×${stock}/${CHARGE_CAP} — BUY ${price}F`);
      this.buttons[key]?.setEnabled(stock < CHARGE_CAP && town.fuel >= price);
    }

    this.buttons['defend']?.setLabel(`DEFEND — ASSAULT LV ${town.assaultLevel} [SPACE]`);
    this.buttons['defend']?.setEnabled(!this.demoMode);

    if (Date.now() > this.resetArmedUntil && this.buttons['reset']) {
      this.buttons['reset'].setLabel('RESET');
    }
    this.bannerText.setText(this.bannerTtl > 0 ? this.banner : '');
    this.bannerText.setColor(css(this.bannerTtl > 0 ? COLORS.signal : COLORS.inkDim));
  }
}

const BIG_KINDS = new Set(['cc', 'supplyDepot', 'fuelDepot', 'storageBunker', 'engBay']);
const isBig = (kind: string): boolean => BIG_KINDS.has(kind);
const footprintOf = (kind: string): number => (isBig(kind) ? 2 : 1);

/** A prebuilt base for ?demo=town screenshots. Never touches the real save. */
function makeShowcaseTown(now: number): TownState {
  const town = newTown(now);
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
  town.lastSeen = now;
  return town;
}
