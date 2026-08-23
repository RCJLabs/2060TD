import { describe, expect, it } from 'vitest';
import { generateBase, MAP_H, MAP_W } from '../src/content/bases';
import { baseKitFor, canTunnel, raidCatalogFor, trainableFor, FACTION_IDS } from '../src/content/factions';
import { SILENT_TUNNELS } from '../src/content/silentTunnels';
import { ALL_UNLOCK_KEYS } from '../src/content/campaign';
import { deserialize, serialize } from '../src/meta/save';
import { newTown, unlockAll } from '../src/meta/town';
import {
  applyRaidResult,
  raidConfig,
  raidWave,
  resolveRaid,
  tunnelCount,
  tunnelFuelCost,
  tunnelSiteValid,
  SQUAD_DELAY_TICKS,
  TUNNEL_DIG_TICKS,
  TUNNEL_FUEL_COST,
  TUNNEL_MIN_CC_DIST,
  type SquadPlan,
} from '../src/meta/warfare';

const T0 = 1_700_000_000_000;
const cellOf = (col: number, row: number) => row * MAP_W + col;

/** A tier-2 target and a mouth 5 cells east of its command post. */
const target = () => {
  const base = generateBase(2, 0, baseKitFor('nk'));
  const ccCol = base.ccOrigin % MAP_W;
  const ccRow = Math.floor(base.ccOrigin / MAP_W);
  const mouth = cellOf(ccCol + 5, ccRow);
  expect(tunnelSiteValid(base, mouth)).toBe(true);
  return { base, mouth };
};

const squadsWithTunnel = (mouth: number): SquadPlan[] => [
  { units: { chonma: 1, nkrifle: 2 }, sector: 'W1', doctrine: 'assault' },
  { units: { rpg7: 1, tunneler: 2 }, sector: 'N1', doctrine: 'hunt', tunnel: mouth },
  { units: { nkrifle: 3, infiltrator: 2 }, sector: 'S1', doctrine: 'raze', tunnel: mouth },
];

describe('tunnel doctrine', () => {
  it('is a KPA exclusive', () => {
    for (const faction of FACTION_IDS) {
      expect(canTunnel(faction)).toBe(faction === 'nk');
    }
  });

  it('validates gallery sites: margins, walls, and the CC standoff', () => {
    const { base } = target();
    const ccCol = base.ccOrigin % MAP_W;
    const ccRow = Math.floor(base.ccOrigin / MAP_W);
    // Too close to the command post (its own footprint most of all).
    expect(tunnelSiteValid(base, base.ccOrigin)).toBe(false);
    expect(tunnelSiteValid(base, cellOf(ccCol + 2, ccRow))).toBe(false);
    // The map margin is off limits.
    expect(tunnelSiteValid(base, cellOf(0, 5))).toBe(false);
    expect(tunnelSiteValid(base, cellOf(MAP_W - 1, 5))).toBe(false);
    expect(tunnelSiteValid(base, cellOf(10, MAP_H - 1))).toBe(false);
    // Wall cells refuse the dig; the cell beside a far wall accepts it.
    const farWall = base.walls.find((w) => {
      const dc = (w.cell % MAP_W) - (ccCol + 0.5);
      const dr = Math.floor(w.cell / MAP_W) - (ccRow + 0.5);
      return dc * dc + dr * dr >= TUNNEL_MIN_CC_DIST * TUNNEL_MIN_CC_DIST;
    });
    expect(farWall).toBeDefined();
    expect(tunnelSiteValid(base, farWall!.cell)).toBe(false);
  });

  it('surfaces tunneled squads around the mouth after the dig delay', () => {
    const { mouth } = target();
    const squads = squadsWithTunnel(mouth);
    const wave = raidWave(squads, trainableFor('nk'));
    const mouthCol = mouth % MAP_W;
    const mouthRow = Math.floor(mouth / MAP_W);

    const bySquad = [0, 1, 2].map((i) =>
      wave.entries.filter((e) =>
        i === 0 ? e.col === 0 : e.doctrine === (i === 1 ? 'hunt' : 'raze'),
      ),
    );
    // Conventional squad: sector edge, no dig delay.
    for (const e of bySquad[0]!) expect(e.atTick).toBeLessThan(TUNNEL_DIG_TICKS);
    // Tunneled squads: every unit within the surfacing ring, delayed by the dig.
    bySquad[1]!.concat(bySquad[2]!).forEach((e) => {
      expect(Math.abs((e.col ?? 0) - mouthCol)).toBeLessThanOrEqual(2);
      expect(Math.abs(e.row - mouthRow)).toBeLessThanOrEqual(2);
    });
    const hunterFirst = Math.min(...bySquad[1]!.map((e) => e.atTick));
    expect(hunterFirst).toBe(1 * SQUAD_DELAY_TICKS + TUNNEL_DIG_TICKS);
  });

  it('carries the mouths as reserved cells and replays identically', () => {
    const { base, mouth } = target();
    const squads = squadsWithTunnel(mouth);
    const config = raidConfig(base, squads, 4242, trainableFor('nk'), {});
    expect(config.reservedCells).toEqual([mouth, mouth]);

    const a = resolveRaid(config, squads, 2, raidCatalogFor('nk'));
    const b = resolveRaid(
      raidConfig(base, squads, 4242, trainableFor('nk'), {}),
      squads,
      2,
      raidCatalogFor('nk'),
    );
    expect(a).toEqual(b);
  });

  it('bills fuel per gallery on resolution', () => {
    const { base, mouth } = target();
    const squads = squadsWithTunnel(mouth);
    expect(tunnelCount(squads)).toBe(2);
    expect(tunnelFuelCost(squads)).toBe(2 * TUNNEL_FUEL_COST);

    const town = unlockAll(newTown(T0, 'nk'));
    town.fuel = 100;
    town.army = { chonma: 1, nkrifle: 5, rpg7: 1, tunneler: 2, infiltrator: 2 };
    const config = raidConfig(base, squads, 7, trainableFor('nk'), {});
    const res = resolveRaid(config, squads, 2, raidCatalogFor('nk'));
    const fuelBefore = town.fuel;
    applyRaidResult(town, base, res, config, T0 + 1000);
    expect(town.fuel).toBe(
      Math.max(0, fuelBefore - 2 * TUNNEL_FUEL_COST) + res.loot.fuel,
    );
  });

  it('tunneled infantry hurt an enclosed base far beyond what the walk-in manages', () => {
    // A sealed compound: full wall ring, no gates, one gun inside. The
    // conventional squad must chew the wall; the tunneled one starts inside.
    const base = generateBase(2, 0, baseKitFor('nk'));
    const ccCol = base.ccOrigin % MAP_W;
    const ccRow = Math.floor(base.ccOrigin / MAP_W);
    const ring: { cell: number; kind: string }[] = [];
    for (let d = -4; d <= 5; d++) {
      ring.push({ cell: cellOf(ccCol + d, ccRow - 4), kind: 'wall' });
      ring.push({ cell: cellOf(ccCol + d, ccRow + 5), kind: 'wall' });
      ring.push({ cell: cellOf(ccCol - 4, ccRow + d), kind: 'wall' });
      ring.push({ cell: cellOf(ccCol + 5, ccRow + d), kind: 'wall' });
    }
    const sealed = { ...base, walls: ring, structures: base.structures.slice(0, 2) };
    const mouth = cellOf(ccCol + 3, ccRow + 3);

    const infantry: SquadPlan[] = [
      { units: { nkrifle: 4, tunneler: 1 }, sector: 'W1', doctrine: 'assault' },
    ];
    const run = (squads: SquadPlan[]) =>
      resolveRaid(
        raidConfig(sealed, squads, 99, trainableFor('nk'), {}),
        squads,
        2,
        raidCatalogFor('nk'),
      );
    const walked = run(infantry);
    const dug = run([{ ...infantry[0]!, tunnel: mouth }]);
    // Surfacing inside reaches the command post much sooner than walking
    // through the ring — the maze bypass is the whole doctrine.
    expect(dug.cleared).toBe(true);
    expect(dug.ticks).toBeLessThan(walked.ticks);
  });
});

describe('silent tunnels campaign', () => {
  it('is six missions distributing every unlock key', () => {
    expect(SILENT_TUNNELS).toHaveLength(6);
    const granted = SILENT_TUNNELS.flatMap((m) => m.unlocks);
    expect([...granted].sort()).toEqual([...ALL_UNLOCK_KEYS].sort());
    SILENT_TUNNELS.forEach((m, i) => {
      expect(m.index).toBe(i);
      expect(m.id).toBe(`st${i + 1}`);
    });
  });

  it('marks the finale counter-tunnel mouths as reserved and spawns from them', () => {
    const finale = SILENT_TUNNELS[5]!;
    expect(finale.tunnels).toHaveLength(2);
    const cols = new Set(finale.tunnels!.map((t) => t.col));
    const interior = finale.waves.flatMap((w) => w.entries).filter((e) => e.col !== undefined);
    expect(interior.length).toBeGreaterThan(0);
    for (const e of interior) expect(cols.has(e.col!)).toBe(true);
  });
});

describe('save v5 with faction nk', () => {
  it('round-trips an NK town', () => {
    const town = unlockAll(newTown(T0, 'nk'));
    town.army = { nkrifle: 3, chonma: 1 };
    const back = deserialize(serialize(town));
    expect(back).not.toBeNull();
    expect(back!.faction).toBe('nk');
    expect(back!.army['chonma']).toBe(1);
  });
});
