import Phaser from 'phaser';
import { MAP_H, MAP_W, TARGETS_PER_TIER, type GeneratedBase } from '../../content/bases';
import {
  canTunnel,
  flavorFor,
  raidCatalogFor,
  trainableFor,
  trainMetaFor,
  type FactionId,
} from '../../content/factions';
import type { TrainMeta } from '../../content/usaUnits';
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
  scoutPrice,
  scoutTarget,
  sectorCells,
  targetFor,
  tunnelFuelCost,
  tunnelSiteValid,
  SECTOR_IDS,
  TUNNEL_DIG_TICKS,
  type RaidResolution,
  type SectorId,
  type SquadPlan,
} from '../../meta/warfare';
import { researchEffects } from '../../meta/town';
import type { AutoPowerRule } from '../../sim/types';
import { drawFieldBase, drawStructureGlyph, drawWallGlyph } from '../glyphs';
import { COLORS } from '../palette';
import { BoardView } from '../BoardView';
import { layoutOf, onLayoutChange, type Layout } from '../layout';
import { Overlay } from '../overlay';
import { makeButton, mono, Panel, type Button, type PanelRow } from '../ui';

/** A pasted base plus the fingerprint that stops it paying twice. */
export interface Challenge {
  base: GeneratedBase;
  fingerprint: string;
}

const CELL = 32;
/** Panel tabs for the raid planner. */
const RAID_TABS = [
  { id: 'target', label: 'TARGET' },
  { id: 'muster', label: 'MUSTER' },
  { id: 'squads', label: 'SQUADS' },
  { id: 'fire', label: 'FIRE' },
];
const DOCTRINES = ['assault', 'hunt', 'raze'] as const;
const DOCTRINE_LABEL: Record<string, string> = { assault: 'ASLT', hunt: 'HUNT', raze: 'RAZE' };
/** Fire-plan timing steps (seconds into the assault); null = hold fire. */
const FIRE_TIMES = [null, 15, 40, 70] as const;
const FIRE_TARGETS = ['guns', 'cc'] as const;

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
  /** Per-power fire plan: timing index into FIRE_TIMES + target class. */
  private firePlans: Record<string, { timeIndex: number; target: 'guns' | 'cc' }> = {};
  /** Tunnel siting mode: the selected squad awaits a map click for its mouth. */
  private siting = false;
  private hintUntil = 0;
  private hintText!: Phaser.GameObjects.Text;

  private baseLayer!: Phaser.GameObjects.Graphics;
  private dynLayer!: Phaser.GameObjects.Graphics;
  private fogText!: Phaser.GameObjects.Text;
  private sectorLabels: Phaser.GameObjects.Text[] = [];
  private board!: BoardView;
  private panel!: Panel;
  private layout!: Layout;
  private drawerOpen = true;
  private launchButton!: Button;
  private overlay: Overlay | null = null;
  /** A duel against a pasted snapshot instead of a rung on the ladder. */
  private challenge: Challenge | null = null;

  constructor() {
    super('raid');
  }

  init(data: { town?: TownState; challenge?: Challenge }): void {
    const params = new URLSearchParams(window.location.search);
    this.demoMode = params.get('demo') === 'raid';
    this.challenge = data?.challenge ?? null;
    if (data?.town) this.town = data.town;
    else if (this.demoMode || !this.town) {
      const pick = params.get('faction');
      this.town = makeRaidShowcase(
        Date.now(),
        pick === 'china' || pick === 'russia' || pick === 'nk' || pick === 'un' ? pick : 'usa',
      );
    }
    this.variant = 0;
    this.selectedSquad = 0;
    this.result = null;
    this.lastConfig = null;
    this.siting = false;
    this.hintUntil = 0;
    this.squads = [
      { units: {}, sector: 'W1', doctrine: 'assault' },
      { units: {}, sector: 'N1', doctrine: 'hunt' },
      { units: {}, sector: 'S1', doctrine: 'raze' },
    ];
    this.firePlans = {};
    for (const kind of Object.keys(raidCatalogFor(this.town.faction).powers)) {
      this.firePlans[kind] = { timeIndex: 0, target: 'guns' };
    }
  }

  create(): void {
    // A challenge fights the code that was pasted; the ladder picks its own.
    this.base = this.challenge ? this.challenge.base : targetFor(this.town, this.variant);

    this.board = new BoardView(this, { cols: MAP_W, rows: MAP_H, cell: CELL });
    const staticLayer = this.add.graphics();
    drawFieldBase(staticLayer, MAP_W, MAP_H, CELL, -1); // no home entry strip
    this.baseLayer = this.add.graphics();
    this.dynLayer = this.add.graphics();
    this.board.world.add([staticLayer, this.baseLayer, this.dynLayer]);

    this.fogText = this.add
      .text(0, 0, 'RECON REQUIRED\nSCOUT THE TARGET TO REVEAL IT', {
        ...mono(18, COLORS.inkDim, { align: 'center', lineSpacing: 8 }),
      })
      .setOrigin(0.5);
    this.hintText = this.add.text(0, 0, '', mono(12, COLORS.signal, { fontStyle: 'bold' })).setOrigin(0.5, 0);
    this.board.ui.add([this.fogText, this.hintText]);

    // Tunnel siting: a map tap places the selected squad's gallery head.
    this.board.onTap((col, row) => {
      if (this.result || this.overlay) return;
      const squad = this.squads[this.selectedSquad]!;
      if (!this.siting && squad.tunnel === undefined) return;
      if (!this.scouted()) return;
      const cell = row * MAP_W + col;
      if (tunnelSiteValid(this.base, cell)) {
        squad.tunnel = cell;
        this.siting = false;
      } else {
        this.hint('NO DIG — off limits or too close to the command post');
      }
    });

    // Sector markers ride the world layer so they pan and zoom with the map.
    for (const id of SECTOR_IDS) {
      const cells = sectorCells(id);
      const mid = cells[Math.floor(cells.length / 2)]!;
      const label = this.add
        .text((mid.col + 0.5) * CELL, (mid.row + 0.5) * CELL, id, mono(13, COLORS.intel, { fontStyle: 'bold' }))
        .setOrigin(0.5);
      this.sectorLabels.push(label);
      this.board.world.add(label);
    }

    this.panel = new Panel(this, this.board.ui, RAID_TABS);
    this.panel.onDrawerToggle = () => {
      this.drawerOpen = !this.drawerOpen;
      this.applyLayout();
    };
    this.launchButton = makeButton(this, 0, 0, 10, 10, '', () => this.launch(), {
      align: 'center',
      container: this.board.ui,
    });

    // Demo raids for tunnel factions show a sited gallery out of the box.
    if (this.demoMode && this.canUseTunnel() && this.squads[1]!.tunnel === undefined) {
      const ccCol = this.base.ccOrigin % MAP_W;
      const ccRow = Math.floor(this.base.ccOrigin / MAP_W);
      for (const [dc, dr] of [[5, 0], [-5, 0], [0, -5], [0, 5]] as const) {
        const cell = (ccRow + dr) * MAP_W + (ccCol + dc);
        if (tunnelSiteValid(this.base, cell)) {
          this.squads[1]!.tunnel = cell;
          break;
        }
      }
    }

    this.applyLayout();
    onLayoutChange(this, () => this.applyLayout());
    this.redrawBase();

    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', () => this.goHome());
    kb?.on('keydown-SPACE', () => this.launch());
  }

  private applyLayout(): void {
    this.layout = layoutOf(this, this.drawerOpen);
    this.board.applyLayout(this.layout, true);
    this.panel.applyLayout(this.layout);
    const { board, pad, rowH, font } = this.layout;
    const w = Math.min(board.w - pad * 2, this.layout.px(320));
    this.launchButton.setRect(board.x + (board.w - w) / 2, board.y + board.h - rowH - pad, w, rowH);
    this.launchButton.setFont(font.body);
    this.fogText.setPosition(board.x + board.w / 2, board.y + board.h / 2).setFontSize(font.body);
    this.hintText.setPosition(board.x + board.w / 2, board.y + pad).setFontSize(font.tiny);
    if (this.overlay) {
      this.overlay.close();
      this.overlay = null;
      if (this.result) this.showResult(this.result);
    }
  }

  private goHome(): void {
    this.scene.start('town', {});
  }

  /** The player faction's raid roster, in muster order. */
  private get trainable(): TrainMeta[] {
    return trainableFor(this.town.faction);
  }

  private get trainMeta(): Record<string, TrainMeta> {
    return trainMetaFor(this.town.faction);
  }

  // ---- target handling ---------------------------------------------------------

  private scouted(): boolean {
    // A shared code carries the whole layout, so there is nothing to scout.
    if (this.challenge) return true;
    return isScouted(this.town, this.town.frontline.tier, this.variant);
  }

  private cycleTarget(): void {
    if (this.challenge) return; // one code, one base
    this.variant = (this.variant + 1) % TARGETS_PER_TIER;
    this.base = targetFor(this.town, this.variant);
    // Galleries are surveyed per target: a new base voids every mouth.
    for (const squad of this.squads) delete squad.tunnel;
    this.siting = false;
    this.clearResult();
    this.redrawBase();
  }

  private hint(message: string): void {
    this.hintText.setText(message);
    this.hintUntil = Date.now() + 2200;
  }

  /** Tunnel insertion needs the doctrine (NK) and a scouted layout to dig to. */
  private canUseTunnel(): boolean {
    return canTunnel(this.town.faction) && this.scouted();
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
      const big = ['cc', 'supplyCache', 'fuelDump', 'supplyDepot', 'fuelDepot'].includes(kind);
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
    // Tunnel mode sits at the end of the sector cycle for tunnel factions.
    if (this.siting || squad.tunnel !== undefined) {
      delete squad.tunnel;
      this.siting = false;
      squad.sector = SECTOR_IDS[0]!;
      return;
    }
    const index = SECTOR_IDS.indexOf(squad.sector);
    if (index === SECTOR_IDS.length - 1 && this.canUseTunnel()) {
      this.siting = true;
      this.hint('TUNNEL — click the map to site the gallery head');
      return;
    }
    squad.sector = SECTOR_IDS[(index + 1) % SECTOR_IDS.length] as SectorId;
  }

  private cycleDoctrine(): void {
    const squad = this.squads[this.selectedSquad]!;
    squad.doctrine = DOCTRINES[(DOCTRINES.indexOf(squad.doctrine) + 1) % DOCTRINES.length]!;
  }

  // ---- training ---------------------------------------------------------------------

  private facilityFor(kind: string): number | null {
    const meta = this.trainMeta[kind];
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

  /** The armed fire plan, as sim rules (only powers with stock count). */
  private autoPowerRules(): AutoPowerRule[] {
    const rules: AutoPowerRule[] = [];
    for (const [kind, plan] of Object.entries(this.firePlans)) {
      const atSeconds = FIRE_TIMES[plan.timeIndex] ?? null;
      if (atSeconds === null || (this.town.charges[kind] ?? 0) <= 0) continue;
      rules.push({ kind, atSeconds, target: plan.target });
    }
    return rules;
  }

  private launch(): void {
    if (this.result || planUnitCount(this.squads) === 0) return;
    if (this.town.frontline.pendingCounterattack) return;
    const squads = this.squads.filter((s) => Object.values(s.units).some((n) => n > 0));
    if (this.town.fuel < tunnelFuelCost(squads)) return;
    const fx = researchEffects(this.town);
    const config = raidConfig(this.base, squads, Date.now() >>> 0, this.trainable, {
      ...(fx.unitHp !== 1 || fx.unitDamage !== 1
        ? { mods: { hp: fx.unitHp, damage: fx.unitDamage } }
        : {}),
      autoPowers: this.autoPowerRules(),
      powerCharges: { ...this.town.charges },
    });
    const resolution = resolveRaid(
      config,
      squads,
      // A duel pays like a tier-1 post; the ladder itself does not move.
      this.challenge ? 1 : this.base.tier,
      raidCatalogFor(this.town.faction),
    );
    applyRaidResult(
      this.town,
      this.base,
      resolution,
      config,
      Date.now(),
      this.challenge ? { fingerprint: this.challenge.fingerprint } : undefined,
    );
    this.saveSoon();
    this.result = resolution;
    this.lastConfig = config;
    this.showResult(resolution);
  }

  private clearResult(): void {
    this.overlay?.close();
    this.overlay = null;
    this.result = null;
  }

  private showResult(res: RaidResolution): void {
    const lossLine = Object.entries(res.losses)
      .map(([kind, n]) => `${n}× ${this.trainMeta[kind]?.short ?? kind}`)
      .join('  ');
    const ordnanceLine = Object.entries(res.powersUsed)
      .map(([kind, n]) => `${n}× ${kind.toUpperCase()}`)
      .join('  ');
    const lines = [
      `Destruction: ${Math.round(res.destructionPct * 100)}%   Duration: ${Math.floor(res.ticks / 20)}s`,
      `Loot: +${res.loot.supplies} SUP  +${res.loot.fuel} FUEL`,
      lossLine ? `Losses: ${lossLine}` : 'Losses: none',
      ...(ordnanceLine ? [`Ordnance expended: ${ordnanceLine}`] : []),
      res.cleared
        ? `Front Line: ${this.town.frontline.wins}/3 to next tier` +
          (this.town.frontline.pendingCounterattack ? '  ·  COUNTERATTACK INBOUND' : '')
        : 'The post stands. Rebuild and go again.',
    ];

    const ov = new Overlay(this, this.layout, {
      title: res.cleared ? 'COMMAND POST DESTROYED' : 'RAID REPELLED',
      subtitle: this.base.name,
      scrim: 0.82,
      container: this.board.ui,
    });
    this.overlay = ov;
    const { font } = this.layout;
    ov.centered(
      ov.flow(Math.round(font.body * 1.7 * lines.length)),
      lines.join('\n'),
      font.body,
      res.cleared ? COLORS.olive : COLORS.ink,
      { lineSpacing: Math.round(font.body * 0.5) },
    );
    ov.footer(
      'WATCH REPLAY',
      () => {
        if (!this.lastConfig) return;
        this.scene.start('replay', {
          config: this.lastConfig,
          kind: 'raid',
          title: this.base.name,
          faction: this.town.faction,
          backTo: 'raid',
          backData: { town: this.town },
        });
      },
      0,
      2,
    );
    ov.footer('RETURN TO BASE', () => this.goHome(), 1, 2);
  }

  // ---- panel rows ---------------------------------------------------------

  private rowsForTab(now: number): PanelRow[] {
    const town = this.town;
    switch (this.panel.tab) {
      case 'target': {
        const tier = town.frontline.tier;
        const scouted = this.scouted();
        const price = scoutPrice(town, tier);
        if (this.challenge) {
          const beaten = town.duels?.includes(this.challenge.fingerprint) === true;
          return [
            { id: 'h', label: `CHALLENGE · ${this.base.name}`, heading: true },
            {
              id: 'note',
              label: beaten
                ? 'ALREADY BEATEN — no further loot'
                : 'A shared snapshot. Losses are real; the ladder does not move.',
              heading: true,
            },
            { id: 'fit', label: 'FIT VIEW', onTap: () => this.board.fit() },
            { id: 'back', label: 'RETURN TO BASE', sub: '[ESC]', onTap: () => this.goHome() },
          ];
        }
        return [
          {
            id: 'h',
            label: `${flavorFor(town.faction).enemy} POSTS · TIER ${tier} · CLEARED ${town.frontline.wins}/3`,
            heading: true,
          },
          {
            id: 'target',
            label: `TARGET ${this.variant + 1}/${TARGETS_PER_TIER}`,
            sub: 'NEXT ▸',
            onTap: () => this.cycleTarget(),
          },
          {
            id: 'scout',
            label: scouted ? 'SCOUTED — LAYOUT KNOWN' : 'SCOUT TARGET',
            sub: scouted ? '' : `${price} INT`,
            enabled: !scouted && town.intel >= price,
            onTap: () => this.scout(),
          },
          { id: 'h2', label: 'VIEW', heading: true },
          { id: 'fit', label: 'FIT VIEW', onTap: () => this.board.fit() },
          { id: 'back', label: 'RETURN TO BASE', sub: '[ESC]', onTap: () => this.goHome() },
        ];
      }
      case 'muster': {
        const rows: PanelRow[] = [
          {
            id: 'h',
            label: `MP ${armyManpower(town)}/${manpowerCapOf(town)} · SUP ${Math.floor(town.supplies)}`,
            heading: true,
          },
        ];
        for (const meta of this.trainable) {
          const cost = meta.fuel > 0 ? `${meta.supplies}S+${meta.fuel}F` : `${meta.supplies}S`;
          rows.push({
            id: `train_${meta.kind}`,
            label: `${meta.name.toUpperCase()} ×${town.army[meta.kind] ?? 0}`,
            sub: `${cost} ${meta.seconds}s`,
            enabled: this.facilityFor(meta.kind) !== null && !this.result,
            onTap: () => this.train(meta.kind),
          });
        }
        const queued: string[] = [];
        for (const s of town.structures) {
          if (s.trainQueue && s.trainQueue.length > 0) {
            const secs =
              s.trainEndsAt !== undefined ? Math.max(0, Math.ceil((s.trainEndsAt - now) / 1000)) : 0;
            queued.push(
              `${s.kind === 'barracks' ? 'BKS' : 'MTP'}: ${s.trainQueue
                .map((k) => this.trainMeta[k]?.short ?? k)
                .join(' ')} (${secs}s)`,
            );
          }
        }
        rows.push({ id: 'q', label: queued.join('  ') || 'Training lines idle.', heading: true });
        return rows;
      }
      case 'squads': {
        const squad = this.squads[this.selectedSquad]!;
        const rows: PanelRow[] = [{ id: 'h', label: 'SQUADS — pick one, then add units', heading: true }];
        this.squads.forEach((sq, i) => {
          const count = Object.values(sq.units).reduce((a, b) => a + b, 0);
          const composition = this.trainable
            .filter((m) => (sq.units[m.kind] ?? 0) > 0)
            .map((m) => `${sq.units[m.kind]}${m.short.charAt(0)}`)
            .join(' ');
          const entry = sq.tunnel !== undefined ? 'TUN' : sq.sector;
          const delay = i * 6 + (sq.tunnel !== undefined ? TUNNEL_DIG_TICKS / 20 : 0);
          rows.push({
            id: `squad_${i}`,
            label: `SQD${i + 1} ${entry} · ${DOCTRINE_LABEL[sq.doctrine]} · ${count ? composition : 'EMPTY'}`,
            sub: `T+${delay}s`,
            active: i === this.selectedSquad,
            onTap: () => {
              this.selectedSquad = i;
              this.siting = false;
            },
          });
        });
        rows.push(
          { id: 'h2', label: `SQUAD ${this.selectedSquad + 1} ORDERS`, heading: true },
          {
            id: 'sector',
            label:
              squad.tunnel !== undefined
                ? `ENTRY: TUNNEL ${squad.tunnel % MAP_W},${Math.floor(squad.tunnel / MAP_W)}`
                : this.siting
                  ? 'ENTRY: TUNNEL — TAP THE MAP'
                  : `ENTRY: ${squad.sector}`,
            sub: 'NEXT ▸',
            active: this.siting || squad.tunnel !== undefined,
            onTap: () => this.cycleSector(),
          },
          {
            id: 'doctrine',
            label: `DOCTRINE: ${DOCTRINE_LABEL[squad.doctrine]}`,
            sub: 'NEXT ▸',
            onTap: () => this.cycleDoctrine(),
          },
          { id: 'h3', label: 'ADD UNITS', heading: true },
        );
        for (const meta of this.trainable) {
          rows.push({
            id: `add_${meta.kind}`,
            label: `+ ${meta.name.toUpperCase()}`,
            sub: `${this.available(meta.kind)} FREE`,
            enabled: this.available(meta.kind) > 0 && !this.result,
            onTap: () => this.addUnit(meta.kind),
          });
        }
        rows.push({ id: 'clear', label: 'CLEAR SQUAD', onTap: () => this.clearSquad() });
        return rows;
      }
      default: {
        const powers = raidCatalogFor(town.faction).powers;
        const rows: PanelRow[] = [{ id: 'h', label: 'FIRE PLAN — town ordnance', heading: true }];
        for (const [kind, plan] of Object.entries(this.firePlans)) {
          const def = powers[kind];
          const stock = town.charges[kind] ?? 0;
          const name = (def?.short ?? def?.name ?? kind).toUpperCase();
          const when = FIRE_TIMES[plan.timeIndex];
          rows.push(
            {
              id: `fireTime_${kind}`,
              label: `${name} ×${stock}`,
              sub: when === null ? 'HOLD' : `T+${when}s`,
              enabled: stock > 0 && !this.result,
              active: when !== null,
              onTap: () => {
                plan.timeIndex = (plan.timeIndex + 1) % FIRE_TIMES.length;
              },
            },
            {
              id: `fireTarget_${kind}`,
              label: '   TARGET',
              sub: plan.target === 'guns' ? 'GUNS' : 'COMMAND POST',
              enabled: stock > 0 && when !== null && !this.result,
              onTap: () => {
                plan.target =
                  FIRE_TARGETS[(FIRE_TARGETS.indexOf(plan.target) + 1) % FIRE_TARGETS.length]!;
              },
            },
          );
        }
        rows.push({
          id: 'hint',
          label: 'Losses are permanent. Survivors come home.',
          heading: true,
        });
        return rows;
      }
    }
  }

  override update(): void {
    const now = Date.now();
    tick(this.town, now);

    const town = this.town;
    const squad = this.squads[this.selectedSquad]!;

    this.panel.setStatus(`FRONT LINE · TIER ${town.frontline.tier}`, [
      `TARGET ${this.base.name}${this.scouted() ? '' : ' · UNSCOUTED'}`,
      `MP ${armyManpower(town)}/${manpowerCapOf(town)} · SUP ${Math.floor(town.supplies)}`,
      `FUEL ${Math.floor(town.fuel)} · INTEL ${Math.floor(town.intel)}`,
    ]);
    this.panel.setRows(this.rowsForTab(now));

    // The floating primary: one tap launches, and it explains itself when it can't.
    const total = planUnitCount(this.squads);
    const activeSquads = this.squads.filter((s) => Object.values(s.units).some((n) => n > 0));
    const galleryFuel = tunnelFuelCost(activeSquads);
    if (town.frontline.pendingCounterattack) {
      this.launchButton.setLabel('COUNTERATTACK — GO DEFEND');
      this.launchButton.setEnabled(false);
    } else if (galleryFuel > 0 && town.fuel < galleryFuel) {
      this.launchButton.setLabel(`GALLERIES NEED ${galleryFuel}F — HAVE ${Math.floor(town.fuel)}`);
      this.launchButton.setEnabled(false);
    } else {
      this.launchButton.setLabel(
        `LAUNCH RAID · ${total} UNIT${total === 1 ? '' : 'S'}${galleryFuel > 0 ? ` · ${galleryFuel}F` : ''}`,
      );
      this.launchButton.setEnabled(total > 0 && !this.result && !this.demoLock());
    }
    this.launchButton.setVisible(this.overlay === null);

    if (this.hintUntil <= now) this.hintText.setText('');

    // Selected squad's entry highlight: sector strip, or the gallery mouths.
    const g = this.dynLayer;
    g.clear();
    if (squad.tunnel === undefined && !this.siting) {
      const cells = sectorCells(squad.sector);
      g.fillStyle(COLORS.intel, 0.25);
      for (const { col, row } of cells) {
        g.fillRect(col * CELL + 1, row * CELL + 1, CELL - 2, CELL - 2);
      }
    }
    this.squads.forEach((sq, i) => {
      if (sq.tunnel === undefined) return;
      const mx = ((sq.tunnel % MAP_W) + 0.5) * CELL;
      const my = (Math.floor(sq.tunnel / MAP_W) + 0.5) * CELL;
      const selected = i === this.selectedSquad;
      g.lineStyle(selected ? 3 : 2, COLORS.signal, selected ? 1 : 0.7);
      g.strokeCircle(mx, my, 11);
      g.lineBetween(mx - 15, my, mx - 6, my);
      g.lineBetween(mx + 6, my, mx + 15, my);
      g.lineBetween(mx, my - 15, mx, my - 6);
      g.lineBetween(mx, my + 6, mx, my + 15);
      g.fillStyle(COLORS.signal, selected ? 1 : 0.7);
      g.fillCircle(mx, my, 3);
    });
  }

  private demoLock(): boolean {
    return false; // demo raids are allowed — they never touch the real save
  }

  private saveSoon(): void {
    if (!this.demoMode) saveTown(this.town);
  }
}

/** A mustered mid-game town for ?demo=raid screenshots (&faction=china flips sides). */
function makeRaidShowcase(now: number, faction: FactionId = 'usa'): TownState {
  const town = unlockAll(newTown(now, faction));
  town.campaign.difficulty = 'standard';
  town.campaign.next = 6;
  town.supplies = 2400;
  town.fuel = 600;
  town.frontline.tier = 2;
  town.frontline.wins = 1;
  town.frontline.totalWins = 4;
  town.frontline.scouted = ['t2v0', 't2v1', 't2v2'];
  town.army =
    faction === 'china'
      ? { rifle: 4, sapper: 2, grenadier: 2, zbd: 1, type99: 1 }
      : faction === 'russia'
        ? { motorrifle: 4, demoteam: 2, rpg: 2, btr: 1, t72: 1 }
        : faction === 'nk'
          ? { nkrifle: 6, infiltrator: 3, tunneler: 2, rpg7: 2, chonma: 1 }
          : faction === 'un'
            ? { peacekeeper: 4, unmedic: 2, unsapper: 2, nlaw: 2, vab: 1, leo1: 1 }
            : { ranger: 4, engineer: 2, javelin: 2, humvee: 1, abrams: 1 };
  const idx = (x: number, y: number) => y * TOWN_GRID.width + x;
  place(town, 'barracks', idx(20, 5), now - 600_000);
  town.structures.find((s) => s.kind === 'cc')!.level = 2;
  place(town, 'motorpool', idx(20, 17), now - 600_000);
  tick(town, now - 500_000);
  structureAt(town, idx(20, 5))!.level = 3; // veteran garrison: cap 6+15+12 = 33
  structureAt(town, idx(20, 17))!.level = 2;
  const barracks = structureAt(town, idx(20, 5));
  if (barracks) {
    barracks.trainQueue =
      faction === 'china'
        ? ['rifle', 'grenadier']
        : faction === 'russia'
          ? ['motorrifle', 'rpg']
          : faction === 'nk'
            ? ['nkrifle', 'rpg7']
            : faction === 'un'
              ? ['peacekeeper', 'unmedic']
              : ['ranger', 'javelin'];
    barracks.trainEndsAt = now + 9_000;
  }
  town.charges = { a10: 2, arty: 1 };
  town.intel = 120;
  town.lastSeen = now;
  return town;
}
