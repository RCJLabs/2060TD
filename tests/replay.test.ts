import { describe, expect, it } from 'vitest';
import { generateBase } from '../src/content/bases';
import { RAID_CATALOG } from '../src/content/catalog';
import { defenseCatalogFor } from '../src/content/factions';
import { Engine } from '../src/sim/engine';
import type { Catalog, SimConfig } from '../src/sim/types';
import { deserialize, serialize } from '../src/meta/save';
import {
  newTown,
  place,
  placeWall,
  probeConfig,
  tick,
  unlockAll,
  TOWN_GRID,
  type TownState,
} from '../src/meta/town';
import {
  cleanTitle,
  decodeReplay,
  encodeReplay,
  replayFingerprint,
} from '../src/meta/replaycode';
import {
  fileCode,
  normalizeVault,
  openEntry,
  recordBattle,
  vaultOf,
  VAULT_CAP,
} from '../src/meta/vault';
import { applyRaidResult, raidConfig, resolveRaid, type SquadPlan } from '../src/meta/warfare';

const T0 = Date.UTC(2026, 5, 1, 12);
const idx = (x: number, y: number): number => y * TOWN_GRID.width + x;

/** Run a battle to its end and describe exactly how it went. */
function outcome(config: SimConfig, catalog: Catalog): string {
  const engine = new Engine(config, catalog);
  engine.enqueue({ tick: 0, type: 'startAssault' });
  while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < 4000) {
    engine.step();
  }
  return `${engine.stateHash()}@${engine.tick}:${engine.phase}`;
}

const PLAN: SquadPlan[] = [
  { units: { ranger: 6, abrams: 2 }, sector: 'W1', doctrine: 'assault', slot: 0, vet: 1.09 },
  { units: { javelin: 3, engineer: 1 }, sector: 'N1', doctrine: 'hunt', slot: 1 },
];

const raidFixture = (): SimConfig =>
  raidConfig(generateBase(4, 1), PLAN, 12_345, undefined, {
    mods: { hp: 1.1, damage: 1.05 },
    powerCharges: { a10: 2, arty: 1 },
    autoPowers: [{ kind: 'a10', atSeconds: 15, target: 'guns' }],
  });

function probeFixture(): SimConfig {
  const town = unlockAll(newTown(T0));
  place(town, 'supplyDepot', idx(23, 6), T0 - 1_000_000);
  place(town, 'm2nest', idx(21, 9), T0 - 1_000_000);
  tick(town, T0);
  for (let y = 3; y <= 20; y++) placeWall(town, idx(19, y));
  town.standingOrders = 'holdfast';
  return probeConfig(town, 4, 999);
}

describe('a replay code is the battle', () => {
  it('re-fights a raid to the identical state hash', () => {
    const config = raidFixture();
    const code = encodeReplay({
      kind: 'raid',
      faction: 'usa',
      title: 'GRID 4-1',
      won: true,
      config,
    });
    const back = decodeReplay(code);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    // The whole point: the code does not describe the battle, it IS the
    // battle. Same hash, same tick, same ending.
    expect(outcome(back.replay.config, RAID_CATALOG)).toBe(outcome(config, RAID_CATALOG));
  });

  it('re-fights an offline probe, standing orders and all', () => {
    const config = probeFixture();
    const catalog = defenseCatalogFor('usa');
    const code = encodeReplay({
      kind: 'probe',
      faction: 'usa',
      title: 'PROBE — LEVEL 4',
      won: false,
      config,
    });
    const back = decodeReplay(code);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.replay.config.standingOrders?.id).toBe('holdfast');
    expect(outcome(back.replay.config, catalog)).toBe(outcome(config, catalog));
  });

  it('round-trips the config shape, not just the outcome', () => {
    const config = raidFixture();
    const code = encodeReplay({ kind: 'raid', faction: 'nk', title: 'X', won: false, config });
    const back = decodeReplay(code);
    if (!back.ok) throw new Error('decode failed');
    // Walls are grouped by kind and delta-encoded, so their ORDER does not
    // survive — the engine keys them by cell, and the hash tests above are
    // what prove that is harmless. Everything else is exact.
    const sorted = (c: SimConfig): SimConfig => ({
      ...c,
      layout: c.layout
        ? { ...c.layout, walls: [...c.layout.walls].sort((a, b) => a.cell - b.cell) }
        : undefined,
    });
    expect(sorted(back.replay.config)).toEqual(sorted(config));
    expect(back.replay.config.layout!.walls.map((w) => w.cell).sort((a, b) => a - b)).toEqual(
      config.layout!.walls.map((w) => w.cell).sort((a, b) => a - b),
    );
    expect(back.replay.faction).toBe('nk');
    expect(back.replay.won).toBe(false);
  });

  it('keeps the title as written, curly quotes and em dashes included', () => {
    const config = raidFixture();
    const fancy = 'GRID 4-2 \u201cJADE WALL\u201d';
    const back = decodeReplay(
      encodeReplay({ kind: 'raid', faction: 'usa', title: fancy, won: true, config }),
    );
    if (!back.ok) throw new Error('decode failed');
    expect(back.replay.title).toBe(fancy);
    // The siege's own name rides through untouched too.
    expect(back.replay.config.siege!.name).toBe(config.siege!.name);
    expect(back.replay.config.siege!.name).toContain('\u2014');
  });

  it('is much smaller than the config it carries', () => {
    const config = raidFixture();
    const code = encodeReplay({ kind: 'raid', faction: 'usa', title: 'T', won: true, config });
    expect(code.length).toBeLessThan(JSON.stringify(config).length / 4);
    // Long, but a paste rather than a file: a whole battle in one line.
    expect(code.length).toBeLessThan(1200);
  });
});

describe('a code that arrives damaged', () => {
  const good = (): string =>
    encodeReplay({
      kind: 'raid',
      faction: 'usa',
      title: 'GRID 4-1',
      won: true,
      config: raidFixture(),
    });

  it('refuses an empty paste', () => {
    expect(decodeReplay('   ')).toEqual({ ok: false, error: 'empty' });
  });

  it('refuses characters that are not in the alphabet', () => {
    expect(decodeReplay('not a code!!')).toEqual({ ok: false, error: 'characters' });
  });

  it('refuses a truncated paste rather than loading half a battle', () => {
    const cut = good().slice(0, 60);
    const result = decodeReplay(cut);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(['checksum', 'truncated', 'content']).toContain(result.error);
  });

  it('catches a single flipped character', () => {
    const code = good();
    const at = Math.floor(code.length / 2);
    const swapped = code[at] === 'A' ? 'B' : 'A';
    const result = decodeReplay(code.slice(0, at) + swapped + code.slice(at + 1));
    expect(result.ok).toBe(false);
  });

  it('survives being pasted with line breaks in it', () => {
    const code = good();
    const wrapped = `${code.slice(0, 40)}\n  ${code.slice(40, 90)}\n${code.slice(90)}`;
    expect(decodeReplay(wrapped).ok).toBe(true);
  });

  it('gives every code a short stable handle', () => {
    const code = good();
    expect(replayFingerprint(code)).toBe(replayFingerprint(code));
    expect(replayFingerprint(code)).toHaveLength(7);
    expect(replayFingerprint(code)).not.toBe(replayFingerprint(`${code}A`));
  });

  it('trims a title rather than letting it run away with the code', () => {
    expect(cleanTitle('  GRID 2-1 "GRANITE NEST"  ')).toBe('GRID 2-1 "GRANITE NEST"');
    expect(cleanTitle('x'.repeat(200)).length).toBeLessThanOrEqual(28);
    expect(cleanTitle('   ')).toBe('UNNAMED BATTLE');
  });
});

describe('the vault', () => {
  const armed = (): TownState => {
    const town = unlockAll(newTown(T0));
    town.army = { ranger: 20, abrams: 6, javelin: 8, engineer: 6 };
    return town;
  };

  it('files a raid the moment it resolves, and keeps it watchable', () => {
    const town = armed();
    const base = generateBase(1, 0);
    const plan: SquadPlan[] = [
      { units: { ranger: 5 }, sector: 'W1', doctrine: 'assault', slot: 0 },
    ];
    const config = raidConfig(base, plan, 7);
    const res = resolveRaid(config, plan, 1, RAID_CATALOG);
    applyRaidResult(town, base, res, config, T0 + 1000);

    const vault = vaultOf(town);
    expect(vault).toHaveLength(1);
    expect(vault[0]!.kind).toBe('raid');
    expect(vault[0]!.title).toBe(cleanTitle(base.name));
    expect(vault[0]!.won).toBe(res.cleared);
    expect(vault[0]!.detail).toMatch(/destroyed/);

    const replay = openEntry(vault[0]!);
    expect(replay).not.toBeNull();
    expect(outcome(replay!.config, RAID_CATALOG)).toBe(outcome(config, RAID_CATALOG));
  });

  it('keeps the newest ten and drops the rest', () => {
    const town = armed();
    for (let i = 0; i < VAULT_CAP + 5; i++) {
      recordBattle(town, {
        kind: 'raid',
        faction: 'usa',
        title: `BATTLE ${i}`,
        won: i % 2 === 0,
        at: T0 + i * 1000,
        detail: `#${i}`,
        config: raidFixture(),
      });
    }
    const vault = vaultOf(town);
    expect(vault).toHaveLength(VAULT_CAP);
    expect(vault[0]!.title).toBe(`BATTLE ${VAULT_CAP + 4}`); // newest first
    expect(vault[VAULT_CAP - 1]!.title).toBe(`BATTLE ${5}`);
  });

  it('marks a duel as a duel, not a rung', () => {
    const town = armed();
    const base = { ...generateBase(1, 0), tier: 0 };
    const plan: SquadPlan[] = [
      { units: { ranger: 4 }, sector: 'W1', doctrine: 'assault', slot: 0 },
    ];
    const config = raidConfig(base, plan, 9);
    const res = resolveRaid(config, plan, 1, RAID_CATALOG);
    applyRaidResult(town, base, res, config, T0 + 2000, { fingerprint: 'abc' });
    expect(vaultOf(town)[0]!.kind).toBe('duel');
  });

  it('survives a save round trip as codes, not as configs', () => {
    const town = armed();
    recordBattle(town, {
      kind: 'raid',
      faction: 'usa',
      title: 'GRID 4-1',
      won: true,
      at: T0,
      detail: '61% destroyed',
      config: raidFixture(),
    });
    const json = serialize(town);
    const back = deserialize(json)!;
    expect(back.vault).toEqual(town.vault);
    // The saved shape is a code, so the whole battle costs a few hundred
    // bytes rather than a few thousand.
    expect(json).not.toContain('"ccOrigin"');
    expect(openEntry(back.vault![0]!)).not.toBeNull();
  });

  it('drops entries that no longer decode instead of failing the load', () => {
    const town = armed();
    recordBattle(town, {
      kind: 'raid',
      faction: 'usa',
      title: 'GOOD',
      won: true,
      at: T0,
      detail: '',
      config: raidFixture(),
    });
    const good = vaultOf(town)[0]!;
    const repaired = normalizeVault([
      good,
      { code: 'not-a-real-code', kind: 'raid', title: 'JUNK', won: true, at: T0, detail: '' },
      { title: 'no code at all' },
      null,
      'nonsense',
    ]);
    expect(repaired).toHaveLength(1);
    expect(repaired[0]!.title).toBe('GOOD');
  });

  it('lets the code overrule a hand-edited label', () => {
    const town = armed();
    recordBattle(town, {
      kind: 'raid',
      faction: 'usa',
      title: 'REAL NAME',
      won: false,
      at: T0,
      detail: '',
      config: raidFixture(),
    });
    const tampered = { ...vaultOf(town)[0]!, title: 'A LIE', won: true, kind: 'probe' as const };
    const repaired = normalizeVault([tampered]);
    expect(repaired[0]!.title).toBe('REAL NAME');
    expect(repaired[0]!.won).toBe(false);
    expect(repaired[0]!.kind).toBe('raid');
  });

  it('files a pasted code, and refuses the same paste twice', () => {
    const town = armed();
    const code = encodeReplay({
      kind: 'raid',
      faction: 'china',
      title: 'SOMEBODY ELSE',
      won: true,
      config: raidFixture(),
    });
    const first = fileCode(town, code, T0);
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.replay.faction).toBe('china');
    expect(vaultOf(town)).toHaveLength(1);

    const again = fileCode(town, `  ${code}  `, T0 + 5);
    expect(again).toEqual({ ok: false, error: 'duplicate' });
    expect(vaultOf(town)).toHaveLength(1);

    expect(fileCode(town, 'rubbish!', T0)).toEqual({ ok: false, error: 'code' });
  });

  it('is empty on a war that predates it, not broken', () => {
    const town = armed();
    delete town.vault;
    const back = deserialize(serialize(town))!;
    expect(back.vault).toEqual([]);
    expect(vaultOf(back)).toEqual([]);
  });
});
