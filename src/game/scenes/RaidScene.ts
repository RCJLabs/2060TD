import Phaser from 'phaser';
import { MAP_H, MAP_W, TARGETS_PER_TIER, type GeneratedBase } from '../../content/bases';
import { TRAINABLE, TRAIN_META } from '../../content/usaUnits';
import { saveTown } from '../../meta/save';
import {
  armyManpower,
  canTrain,
  manpowerCapOf,
  newTown,
  place,
  queueTrain,
  structureAt,
  tick,
  unlockAll,
  TOWN_GRID,
  type TownState,
} from '../../meta/town';
import {
  applyRaidResult,
  isScouted,
  planUnitCount,
  raidConfig,
  resolveRaid,
  scoutCost,
  scoutTarget,
  sectorCells,
  targetFor,
  SECTOR_IDS,
  type RaidResolution,
  type SectorId,
  type SquadPlan,
} from '../../meta/warfare';
import { drawFieldBase, drawStructureGlyph, drawWallGlyph } from '../glyphs';
import { COLORS } from '../palette';
import { makeButton, mono, type Button } from '../ui';

const CELL = 32;
const GRID_PX_W = MAP_W * CELL;
const GRID_PX_H = MAP_H * CELL;
const PANEL_W = 256;
const DOCTRINES = ['assault', 'hunt', 'raze'] as const;
const DOCTRINE_LABEL: Record<string, string> = { assault: 'ASLT', hunt: 'HUNT', raze: 'RAZE' };

/**
 * The Front Line (M4): pick a target, scout it, muster the army, split it
 * into squads with sectors and doctrines, and launch. Resolution is
 * hands-off — the plan is the skill.
 */
export class RaidScene extends Phaser.Scene {
  private town!: TownState;
  private demoMode = false;
  private variant = 0;
  private base!: GeneratedBase;
  private squads: SquadPlan[] = [];
  private selectedSquad = 0;
  private result: RaidResolution | null = null;
  private lastConfig: ReturnType<typeof raidConfig> | null = null;

  private baseLayer!: Phaser.GameObjects.Graphics;
  private dynLayer!: Phaser.GameObjects.Graphics;
  private fogText!: Phaser.GameObjects.Text;
  private headerText!: Phaser.GameObjects.Text;
  private armyText!: Phaser.GameObjects.Text;
  private queueText!: Phaser.GameObjects.Text;
  private resultTexts: Phaser.GameObjects.GameObject[] = [];
  private buttons: Record<string, Button> = {};
  private sectorLabels: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('raid');
  }

  init(data: { town?: TownState }): void {
    this.demoMode = new URLSearchParams(window.location.search).get('demo') === 'raid';
    if (data?.town) this.town = data.town;
    else if (this.demoMode || !this.town) this.town = makeRaidShowcase(Date.now());
    this.variant = 0;
    this.selectedSquad = 0;
    this.result = null;
    this.lastConfig = null;
    this.squads = [
      { units: {}, sector: 'W1', doctrine: 'assault' },
      { units: {}, sector: 'N1', doctrine: 'hunt' },
      { units: {}, sector: 'S1', doctrine: 'raze' },
    ];
  }

  create(): void {
    this.buttons = {};
    this.resultTexts = [];
    this.base = targetFor(this.town, this.variant);

    const staticLayer = this.add.graphics();
    drawFieldBase(staticLayer, MAP_W, MAP_H, CELL, -1); // no home entry strip
    this.baseLayer = this.add.graphics();
    this.dynLayer = this.add.graphics();

    this.fogText = this.add
      .text(GRID_PX_W / 2, GRID_PX_H / 2, 'RECON REQUIRED\nSCOUT THE TARGET TO REVEAL IT', {
        ...mono(18, COLORS.inkDim, { align: 'center', lineSpacing: 8 }),
      })
      .setOrigin(0.5)
      .setDepth(6);

    this.headerText = this.add
      .text(GRID_PX_W / 2, 6, '', mono(11, COLORS.inkDim))
      .setOrigin(0.5, 0)
      .setDepth(5);

    // Sector markers around the map edge.
    for (const id of SECTOR_IDS) {
      const cells = sectorCells(id);
      const mid = cells[Math.floor(cells.length / 2)]!;
      const inset = 14;
      const px = mid.col === 0 ? inset : mid.col === MAP_W - 1 ? GRID_PX_W - inset : (mid.col + 0.5) * CELL;
      const py = mid.row === 0 ? inset : mid.row === MAP_H - 1 ? GRID_PX_H - inset : (mid.row + 0.5) * CELL;
      this.sectorLabels.push(
        this.add
          .text(px, py, id, mono(11, COLORS.intel, { fontStyle: 'bold' }))
          .setOrigin(0.5)
          .setDepth(6),
      );
    }

    this.buildPanel();
    this.redrawBase();

    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', () => this.goHome());
    kb?.on('keydown-SPACE', () => this.launch());
  }

  private goHome(): void {
    this.scene.start('town', {});
  }

  // ---- target handling ---------------------------------------------------------

  private scouted(): boolean {
    return isScouted(this.town, this.town.frontline.tier, this.variant);
  }

  private cycleTarget(): void {
    this.variant = (this.variant + 1) % TARGETS_PER_TIER;
    this.base = targetFor(this.town, this.variant);
    this.clearResult();
    this.redrawBase();
  }

  private scout(): void {
    if (scoutTarget(this.town, this.town.frontline.tier, this.variant)) {
      this.saveSoon();
      this.redrawBase();
    }
  }

  private redrawBase(): void {
    const g = this.baseLayer;
    g.clear();
    const revealed = this.scouted();
    this.fogText.setVisible(!revealed);
    if (!revealed) return;

    for (const wall of this.base.walls) {
      drawWallGlyph(g, (wall.cell % MAP_W) * CELL, Math.floor(wall.cell / MAP_W) * CELL, CELL, wall.kind, 1);
    }
    const draw = (kind: string, cell: number, level: number) => {
      const big = ['cc', 'supplyCache', 'fuelDump'].includes(kind);
      const half = big ? 1 : 0.5;
      drawStructureGlyph(
        g,
        kind,
        ((cell % MAP_W) + half) * CELL,
        (Math.floor(cell / MAP_W) + half) * CELL,
        CELL,
        { level, hostile: true },
      );
    };
    draw('cc', this.base.ccOrigin, this.base.ccLevel);
    for (const s of this.base.structures) draw(s.kind, s.cell, s.level ?? 1);
  }

  // ---- squads ----------------------------------------------------------------------

  private allocated(kind: string): number {
    return this.squads.reduce((sum, squad) => sum + (squad.units[kind] ?? 0), 0);
  }

  private available(kind: string): number {
    return (this.town.army[kind] ?? 0) - this.allocated(kind);
  }

  private addUnit(kind: string): void {
    if (this.available(kind) <= 0 || this.result) return;
    const squad = this.squads[this.selectedSquad]!;
    squad.units[kind] = (squad.units[kind] ?? 0) + 1;
  }

  private clearSquad(): void {
    this.squads[this.selectedSquad]!.units = {};
  }

  private cycleSector(): void {
    const squad = this.squads[this.selectedSquad]!;
    squad.sector = SECTOR_IDS[(SECTOR_IDS.indexOf(squad.sector) + 1) % SECTOR_IDS.length] as SectorId;
  }

  private cycleDoctrine(): void {
    const squad = this.squads[this.selectedSquad]!;
    squad.doctrine = DOCTRINES[(DOCTRINES.indexOf(squad.doctrine) + 1) % DOCTRINES.length]!;
  }

  // ---- training ---------------------------------------------------------------------

  private facilityFor(kind: string): number | null {
    const meta = TRAIN_META[kind];
    if (!meta) return null;
    for (const s of this.town.structures) {
      if (s.kind !== meta.facility || s.wrecked) continue;
      if (s.buildEndsAt !== undefined && s.upgradingTo === undefined) continue;
      if (canTrain(this.town, s.id, kind) === null) return s.id;
    }
    return null;
  }

  private train(kind: string): void {
    const id = this.facilityFor(kind);
    if (id !== null && queueTrain(this.town, id, kind, Date.now())) this.saveSoon();
  }

  // ---- launch ------------------------------------------------------------------------

  private launch(): void {
    if (this.result || planUnitCount(this.squads) === 0) return;
    if (this.town.frontline.pendingCounterattack) return;
    const squads = this.squads.filter((s) => Object.values(s.units).some((n) => n > 0));
    const config = raidConfig(this.base, squads, Date.now() >>> 0);
    const resolution = resolveRaid(config, squads, this.base.tier);
    applyRaidResult(this.town, this.base, resolution, config, Date.now());
    this.saveSoon();
    this.result = resolution;
    this.lastConfig = config;
    this.showResult(resolution);
  }

  private clearResult(): void {
    for (const obj of this.resultTexts) obj.destroy();
    this.resultTexts = [];
    this.result = null;
  }

  private showResult(res: RaidResolution): void {
    const cx = (GRID_PX_W + PANEL_W) / 2;
    const overlay = this.add
      .rectangle(0, 0, GRID_PX_W + PANEL_W, GRID_PX_H, 0x000000, 0.62)
      .setOrigin(0)
      .setDepth(40);
    const title = this.add
      .text(cx, 240, res.cleared ? 'COMMAND POST DESTROYED' : 'RAID REPELLED', {
        ...mono(30, res.cleared ? COLORS.olive : COLORS.alarm, { fontStyle: 'bold' }),
      })
      .setOrigin(0.5)
      .setDepth(41);

    const lossLine = Object.entries(res.losses)
      .map(([kind, n]) => `${n}× ${TRAIN_META[kind]?.short ?? kind}`)
      .join('  ');
    const lines = [
      `Destruction: ${Math.round(res.destructionPct * 100)}%   Duration: ${Math.floor(res.ticks / 20)}s`,
      `Loot: +${res.loot.supplies} SUP  +${res.loot.fuel} FUEL`,
      lossLine ? `Losses: ${lossLine}` : 'Losses: none',
      res.cleared
        ? `Front Line: ${this.town.frontline.wins}/3 to next tier` +
          (this.town.frontline.pendingCounterattack ? '  ·  COUNTERATTACK INBOUND' : '')
        : 'The post stands. Rebuild and go again.',
    ];
    const body = this.add
      .text(cx, 292, lines.join('\n'), {
        ...mono(13, COLORS.ink, { lineSpacing: 7, align: 'center' }),
      })
      .setOrigin(0.5, 0)
      .setDepth(41);

    const watch = makeButton(this, cx - 250, 420, 230, 34, 'WATCH REPLAY', () => {
      if (!this.lastConfig) return;
      this.scene.start('replay', {
        config: this.lastConfig,
        kind: 'raid',
        title: this.base.name,
        backTo: 'raid',
        backData: { town: this.town },
      });
    });
    const back = makeButton(this, cx + 20, 420, 230, 34, 'RETURN TO BASE', () => this.goHome());
    for (const b of [watch, back]) {
      b.bg.setDepth(41);
      b.label.setDepth(41);
    }
    this.resultTexts.push(overlay, title, body, watch.bg, watch.label, back.bg, back.label);
  }

  // ---- panel ---------------------------------------------------------------------------

  private buildPanel(): void {
    const x0 = GRID_PX_W;
    const pad = 14;
    const bw = PANEL_W - pad * 2;
    this.add.rectangle(x0, 0, PANEL_W, GRID_PX_H, COLORS.bgPanel).setOrigin(0, 0);
    this.add.rectangle(x0, 0, 2, GRID_PX_H, COLORS.gridLine).setOrigin(0, 0);

    this.add.text(x0 + pad, 10, 'FRONT LINE', mono(17, COLORS.ink, { fontStyle: 'bold' }));
    this.add.text(x0 + pad, 32, 'M4 — COUNTER-RAID OPERATIONS', mono(10, COLORS.inkDim));
    this.armyText = this.add.text(x0 + pad, 48, '', mono(11, COLORS.ink, { lineSpacing: 3 }));

    let y = 92;
    this.add.text(x0 + pad, y, 'TARGET', mono(10, COLORS.inkDim));
    y += 14;
    this.buttons['target'] = makeButton(this, x0 + pad, y, bw, 24, '', () => this.cycleTarget());
    y += 27;
    this.buttons['scout'] = makeButton(this, x0 + pad, y, bw, 24, '', () => this.scout());
    y += 31;

    this.add.text(x0 + pad, y, 'MUSTER', mono(10, COLORS.inkDim));
    y += 14;
    for (const meta of TRAINABLE) {
      this.buttons[`train_${meta.kind}`] = makeButton(this, x0 + pad, y, bw, 22, '', () =>
        this.train(meta.kind),
      );
      y += 25;
    }
    this.queueText = this.add.text(x0 + pad, y, '', mono(9, COLORS.inkDim));
    y += 16;

    this.add.text(x0 + pad, y, 'SQUADS — click one, then add units', mono(10, COLORS.inkDim));
    y += 14;
    for (let i = 0; i < 3; i++) {
      const index = i;
      this.buttons[`squad_${i}`] = makeButton(this, x0 + pad, y, bw, 22, '', () => {
        this.selectedSquad = index;
        this.refreshSquadButtons();
      });
      y += 25;
    }
    const half = (bw - 6) / 2;
    this.buttons['sector'] = makeButton(this, x0 + pad, y, half, 22, 'SECTOR ▸', () => this.cycleSector());
    this.buttons['doctrine'] = makeButton(this, x0 + pad + half + 6, y, half, 22, 'DOCTRINE ▸', () =>
      this.cycleDoctrine(),
    );
    y += 25;
    const fifth = (bw - 16) / 5;
    TRAINABLE.forEach((meta, i) => {
      this.buttons[`add_${meta.kind}`] = makeButton(
        this,
        x0 + pad + i * (fifth + 4),
        y,
        fifth,
        22,
        `+${meta.short.charAt(0)}`,
        () => this.addUnit(meta.kind),
      );
    });
    y += 25;
    this.buttons['clear'] = makeButton(this, x0 + pad, y, bw, 20, 'CLEAR SQUAD', () => this.clearSquad());
    y += 30;

    this.buttons['launch'] = makeButton(this, x0 + pad, y, bw, 30, '', () => this.launch());
    y += 38;
    this.buttons['back'] = makeButton(this, x0 + pad, y, bw, 24, 'RETURN TO BASE [ESC]', () =>
      this.goHome(),
    );

    this.add.text(
      x0 + pad,
      GRID_PX_H - 32,
      'Losses are permanent. Survivors come home.',
      mono(9, COLORS.inkDim),
    );
    this.refreshSquadButtons();
  }

  private refreshSquadButtons(): void {
    for (let i = 0; i < 3; i++) this.buttons[`squad_${i}`]?.setActive(i === this.selectedSquad);
  }

  override update(): void {
    const now = Date.now();
    tick(this.town, now);

    const town = this.town;
    const tier = town.frontline.tier;
    this.headerText.setText(
      `FRONT LINE — TIER ${tier} · TARGET: ${this.base.name} ${this.scouted() ? '' : '(UNSCOUTED)'}`,
    );
    this.armyText.setText(
      [
        `TIER ${tier} · POSTS CLEARED ${town.frontline.wins}/3`,
        `MANPOWER ${armyManpower(town)}/${manpowerCapOf(town)} · SUP ${Math.floor(town.supplies)} · FUEL ${Math.floor(town.fuel)}`,
        TRAINABLE.map((m) => `${m.short} ${town.army[m.kind] ?? 0}`).join('  '),
      ].join('\n'),
    );

    this.buttons['target']?.setLabel(`TARGET ${this.variant + 1}/${TARGETS_PER_TIER} ▸`);
    const scouted = this.scouted();
    this.buttons['scout']?.setLabel(scouted ? 'SCOUTED — LAYOUT KNOWN' : `SCOUT — ${scoutCost(tier)} SUP`);
    this.buttons['scout']?.setEnabled(!scouted && town.supplies >= scoutCost(tier));

    for (const meta of TRAINABLE) {
      const cost = meta.fuel > 0 ? `${meta.supplies}S+${meta.fuel}F` : `${meta.supplies}S`;
      const button = this.buttons[`train_${meta.kind}`];
      button?.setLabel(`${meta.short} ×${town.army[meta.kind] ?? 0} — TRAIN ${cost} ${meta.seconds}s`);
      button?.setEnabled(this.facilityFor(meta.kind) !== null && !this.result);
    }
    const queued: string[] = [];
    for (const s of town.structures) {
      if (s.trainQueue && s.trainQueue.length > 0) {
        const secs = s.trainEndsAt !== undefined ? Math.max(0, Math.ceil((s.trainEndsAt - now) / 1000)) : 0;
        queued.push(`${s.kind === 'barracks' ? 'BKS' : 'MTP'}: ${s.trainQueue.map((k) => TRAIN_META[k]?.short ?? k).join(' ')} (${secs}s)`);
      }
    }
    this.queueText.setText(queued.join('   ') || 'Training lines idle.');

    this.squads.forEach((squad, i) => {
      const count = Object.values(squad.units).reduce((a, b) => a + b, 0);
      const composition = TRAINABLE.filter((m) => (squad.units[m.kind] ?? 0) > 0)
        .map((m) => `${squad.units[m.kind]}${m.short.charAt(0)}`)
        .join(' ');
      this.buttons[`squad_${i}`]?.setLabel(
        `SQD${i + 1} ${squad.sector} · ${DOCTRINE_LABEL[squad.doctrine]} · ${count ? composition : 'EMPTY'} · T+${i * 6}s`,
      );
    });
    const squad = this.squads[this.selectedSquad]!;
    this.buttons['sector']?.setLabel(`SECTOR: ${squad.sector} ▸`);
    this.buttons['doctrine']?.setLabel(`DOCTRINE: ${DOCTRINE_LABEL[squad.doctrine]} ▸`);
    for (const meta of TRAINABLE) {
      this.buttons[`add_${meta.kind}`]?.setEnabled(this.available(meta.kind) > 0 && !this.result);
    }

    const total = planUnitCount(this.squads);
    if (town.frontline.pendingCounterattack) {
      this.buttons['launch']?.setLabel('COUNTERATTACK INBOUND — GO DEFEND');
      this.buttons['launch']?.setEnabled(false);
    } else {
      this.buttons['launch']?.setLabel(`LAUNCH RAID — ${total} UNITS [SPACE]`);
      this.buttons['launch']?.setEnabled(total > 0 && !this.result && !this.demoLock());
    }

    // Selected squad's sector highlight.
    const g = this.dynLayer;
    g.clear();
    const cells = sectorCells(squad.sector);
    g.fillStyle(COLORS.intel, 0.25);
    for (const { col, row } of cells) {
      g.fillRect(col * CELL + 1, row * CELL + 1, CELL - 2, CELL - 2);
    }
  }

  private demoLock(): boolean {
    return false; // demo raids are allowed — they never touch the real save
  }

  private saveSoon(): void {
    if (!this.demoMode) saveTown(this.town);
  }
}

/** A mustered mid-game town for ?demo=raid screenshots. */
function makeRaidShowcase(now: number): TownState {
  const town = unlockAll(newTown(now));
  town.campaign.difficulty = 'standard';
  town.campaign.next = 6;
  town.supplies = 2400;
  town.fuel = 600;
  town.frontline.tier = 2;
  town.frontline.wins = 1;
  town.frontline.totalWins = 4;
  town.frontline.scouted = ['t2v0', 't2v1', 't2v2'];
  town.army = { ranger: 4, engineer: 2, javelin: 2, humvee: 1, abrams: 1 };
  const idx = (x: number, y: number) => y * TOWN_GRID.width + x;
  place(town, 'barracks', idx(20, 5), now - 600_000);
  town.structures.find((s) => s.kind === 'cc')!.level = 2;
  place(town, 'motorpool', idx(20, 17), now - 600_000);
  tick(town, now - 500_000);
  structureAt(town, idx(20, 5))!.level = 3; // veteran garrison: cap 6+15+12 = 33
  structureAt(town, idx(20, 17))!.level = 2;
  const barracks = structureAt(town, idx(20, 5));
  if (barracks) {
    barracks.trainQueue = ['ranger', 'javelin'];
    barracks.trainEndsAt = now + 9_000;
  }
  town.lastSeen = now;
  return town;
}
