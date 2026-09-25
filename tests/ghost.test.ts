import { describe, expect, it } from 'vitest';
import { yardTown } from './helpers';
import { raidCatalogFor, trainableFor, type FactionId } from '../src/content/factions';
import { GHOST_BREACHED, GHOST_FAILED, GHOST_HELD, GHOST_WON } from '../src/content/leagues';
import { afterAction } from '../src/meta/afteraction';
import { Counterfactual, choicesFor, planOf } from '../src/meta/counterfactual';
import {
  callsignOf,
  cleanCallsign,
  collectGhost,
  decodeGhost,
  encodeGhost,
  generatedCallsign,
  ghostCatalog,
  ghostLedger,
  GHOST_MAX_MEN,
  GHOST_PAID_PER_DAY,
  GHOST_SENT_CAP,
  normalizeGhosts,
  paidLeftToday,
  sendGhost,
  setCallsign,
  takeGhost,
  type Ghost,
} from '../src/meta/ghost';
import { decodeReplay, encodeReplay } from '../src/meta/replaycode';
import { deserialize, serialize } from '../src/meta/save';
import { baseFromShare, decodeBase, encodeBase } from '../src/meta/sharecode';
import { newTown, place, placeWall, tick, unlockAll, TOWN_GRID, type TownState } from '../src/meta/town';
import { vaultOf } from '../src/meta/vault';
import {
  entrySectors,
  fightRaid,
  nextSector,
  raidConfig,
  SECTOR_IDS,
  sectorWithin,
  squadRoster,
  TOWN_ENTRY_SECTORS,
  type SquadPlan,
} from '../src/meta/warfare';
import { Engine } from '../src/sim/engine';
import { CHINA_BASE_KIT, generateBase } from '../src/content/bases';

/** M27 Phase 1: a commander's plan, sent as a code and fought on another's town. */

const T0 = Date.UTC(2026, 5, 1, 12);
const DAY = 86_400_000;
const idx = (x: number, y: number): number => y * TOWN_GRID.width + x;

/** A commander with men in the yard and a callsign of their own. */
function commander(faction: FactionId, callsign: string, army: Record<string, number> = {}): TownState {
  const town = newTown(T0, faction);
  town.army = { ...army };
  setCallsign(town, callsign);
  return town;
}

/** A town walled across its middle with two guns behind the wire: three men do not get through. */
function walledTown(faction: FactionId, callsign: string): TownState {
  const town = unlockAll(yardTown(T0, faction));
  setCallsign(town, callsign);
  town.supplies = 99_999;
  town.fuel = 99_999;
  place(town, 'm2nest', idx(3, 10), T0 - 1_000_000);
  place(town, 'm2nest', idx(6, 10), T0 - 1_000_000);
  tick(town, T0);
  for (let x = 0; x < TOWN_GRID.width; x++) placeWall(town, idx(x, 8));
  return town;
}

function bareTown(faction: FactionId, callsign: string): TownState {
  const town = yardTown(T0, faction);
  setCallsign(town, callsign);
  return town;
}

/** The base a commander would be handed: their share code, named for their callsign. */
const targetOf = (town: TownState) => {
  const read = decodeBase(encodeBase(town, callsignOf(town)));
  if (!read.ok) throw new Error('the share code did not read');
  return baseFromShare(read.base);
};

const ARMY = { ranger: 14, abrams: 3, javelin: 4, engineer: 2 };
const FEW: SquadPlan[] = [{ units: { ranger: 3 }, sector: 'N1', doctrine: 'assault', slot: 0, delay: 0 }];
const MANY: SquadPlan[] = [
  { units: { ranger: 10, abrams: 3 }, sector: 'N1', doctrine: 'assault', slot: 0, delay: 0 },
  { units: { javelin: 4, engineer: 2, ranger: 4 }, sector: 'N2', doctrine: 'hunt', slot: 1, delay: 6 },
];

/** Send `plan` from `attacker` to `defender`, returning the ghost code. */
function send(attacker: TownState, defender: TownState, plan: SquadPlan[], now = T0 + 1_000): string {
  const sent = sendGhost(attacker, targetOf(defender), structuredClone(plan), now);
  if (!sent.ok) throw new Error(`the ghost was not sent: ${sent.error}`);
  return sent.code;
}

function take(defender: TownState, code: string, now = T0 + 2_000) {
  const took = takeGhost(defender, code, now);
  if (!took.ok) throw new Error(`the ghost was not taken: ${took.error}`);
  return took.taken;
}

/** A result code with its battle changed, carrying the same commanders. */
function tampered(result: string, edit: (replay: ReturnType<typeof decodeOk>) => void): string {
  const replay = decodeOk(result);
  edit(replay);
  return encodeReplay(replay);
}

function decodeOk(code: string) {
  const read = decodeReplay(code);
  if (!read.ok) throw new Error('the code did not read');
  return read.replay;
}

describe('a callsign (M27)', () => {
  it('is capitals, digits, spaces and hyphens, at most sixteen, or nothing', () => {
    expect(cleanCallsign(' raven-47 ')).toBe('RAVEN-47');
    expect(cleanCallsign('Iron  Horse!!')).toBe('IRON HORSE');
    expect(cleanCallsign('A VERY LONG CALLSIGN INDEED')).toBe('A VERY LONG CALL');
    expect(cleanCallsign('x')).toBeNull();
    expect(cleanCallsign('☆☆☆')).toBeNull();
  });

  it('is made for a war until one is chosen: the same every time, and one a code can carry', () => {
    const town = newTown(T0, 'usa');
    const made = callsignOf(town);
    expect(cleanCallsign(made)).toBe(made);
    expect(callsignOf(town)).toBe(made);
    expect(generatedCallsign(structuredClone(town))).toBe(made);
    // Wars begun at other times are, mostly, called other things.
    const others = new Set([0, 1, 2, 3, 4, 5].map((i) => callsignOf(newTown(T0 + i * 60_000, 'usa'))));
    expect(others.size).toBeGreaterThan(3);
  });

  it('is kept as chosen, refused when nothing of it is left, and survives the save', () => {
    const town = newTown(T0, 'china');
    expect(setCallsign(town, '!!')).toBe(false);
    expect(town.callsign).toBeUndefined();
    expect(setCallsign(town, 'red lantern')).toBe(true);
    expect(callsignOf(town)).toBe('RED LANTERN');
    const back = deserialize(serialize(town));
    expect(back && callsignOf(back)).toBe('RED LANTERN');
    const junk = JSON.parse(serialize(town));
    junk.town.callsign = 42;
    const cleaned = deserialize(JSON.stringify(junk));
    expect(cleaned?.callsign).toBeUndefined();
  });
});

describe('the ghost code (M27)', () => {
  const attacker = commander('usa', 'VIPER 43', ARMY);
  const defender = bareTown('china', 'RED LANTERN');

  it('carries the plan as the planner sent it: in slot order, every start and rank written out', () => {
    const planned: SquadPlan[] = [
      { units: { javelin: 2 }, sector: 'N2', doctrine: 'hunt', slot: 2 },
      { units: {}, sector: 'W1', doctrine: 'assault', slot: 1, delay: 30 },
      { units: { ranger: 3, abrams: 1 }, sector: 'N1', doctrine: 'raze', slot: 0, delay: 12 },
    ];
    const town = structuredClone(attacker);
    squadRoster(town)[0]!.xp = 500;
    const sent = sendGhost(town, targetOf(defender), planned, T0);
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(sent.ghost.plan.map((s) => [s.slot, s.sector, s.delay])).toEqual([
      [0, 'N1', 12],
      [2, 'N2', 0],
    ]);
    expect(sent.ghost.plan[0]!.vet).toBeGreaterThan(1);
    expect(sent.ghost.from).toEqual({ callsign: 'VIPER 43', faction: 'usa' });
    expect(sent.ghost.to).toBe('RED LANTERN');
    const read = decodeGhost(sent.code);
    expect(read.ok && read.ghost).toEqual(sent.ghost);
    // The sender's own base rides along, named for them: the way back.
    const home = decodeBase(sent.ghost.base);
    expect(home.ok && home.base.name).toBe('VIPER 43');
  });

  it('writes the army’s research to the thousandth', () => {
    const town = structuredClone(attacker);
    town.research.completed.push('strike1', 'strike2');
    const sent = sendGhost(town, targetOf(defender), structuredClone(FEW), T0);
    expect(sent.ok && sent.ghost.mods).toEqual({ hp: 1.12, damage: 1.12 });
  });

  it('refuses a plan the town cannot send', () => {
    const at = targetOf(defender);
    const one = (squad: Partial<SquadPlan>): SquadPlan[] => [{ ...FEW[0]!, ...squad }];
    const refused = (plan: SquadPlan[], target = at, town = attacker) => {
      const sent = sendGhost(structuredClone(town), target, plan, T0);
      return sent.ok ? 'sent' : sent.error;
    };
    expect(refused(one({ sector: 'S1' }))).toBe('sector');
    expect(refused(one({ sector: 'W2' }))).toBe('sector');
    expect(refused(one({ tunnel: idx(4, 6) }))).toBe('gallery');
    expect(refused(one({ units: { ranger: 99 } }))).toBe('army');
    expect(refused(one({ units: {} }))).toBe('empty');
    expect(refused(FEW, { ...at, name: 'VIPER 43' })).toBe('self');
    expect(refused(FEW, { ...at, name: 'Coos Bay' })).toBe('address');
    expect(refused(FEW)).toBe('sent');
  });

  it('is refused where a base or a battle is expected, and reads neither as a ghost', () => {
    const code = send(structuredClone(attacker), defender, FEW);
    expect(decodeReplay(code)).toEqual({ ok: false, error: 'version' });
    expect(decodeBase(code)).toEqual({ ok: false, error: 'version' });
    expect(decodeGhost(encodeBase(defender, 'RED LANTERN'))).toEqual({ ok: false, error: 'version' });
    const probe = vaultOf(defender)[0];
    if (probe) expect(decodeGhost(probe.code).ok).toBe(false);
  });

  it('refuses a paste that was damaged or written by hand', () => {
    const code = send(structuredClone(attacker), defender, FEW);
    expect(decodeGhost('')).toEqual({ ok: false, error: 'empty' });
    expect(decodeGhost('not a code!')).toEqual({ ok: false, error: 'characters' });
    expect(decodeGhost(code.slice(0, 20)).ok).toBe(false);
    const at = Math.floor(code.length / 2);
    const flipped = code.slice(0, at) + (code[at] === 'A' ? 'B' : 'A') + code.slice(at + 1);
    expect(decodeGhost(flipped).ok).toBe(false);
    expect(decodeGhost(`  ${code.slice(0, 30)}\n${code.slice(30)}  `).ok).toBe(true);
    const ghost = (decodeGhost(code) as { ok: true; ghost: Ghost }).ghost;
    const rewrite = (change: (g: Ghost) => void): string => {
      const g = structuredClone(ghost);
      change(g);
      return encodeGhost(g);
    };
    expect(decodeGhost(rewrite((g) => (g.plan[0]!.sector = 'S2')))).toEqual({ ok: false, error: 'content' });
    expect(decodeGhost(rewrite((g) => (g.plan[0]!.units = { m1a2: 3 })))).toEqual({ ok: false, error: 'content' });
    expect(decodeGhost(rewrite((g) => (g.plan[0]!.units = { ranger: GHOST_MAX_MEN + 1 })))).toEqual({
      ok: false,
      error: 'content',
    });
    expect(decodeGhost(rewrite((g) => (g.from.callsign = 'lower case')))).toEqual({ ok: false, error: 'content' });
    expect(decodeGhost(rewrite((g) => g.plan.push({ ...g.plan[0]! })))).toEqual({ ok: false, error: 'content' });
  });

  it('keeps the last ten sent waiting on a result', () => {
    const town = structuredClone(attacker);
    for (let i = 0; i < GHOST_SENT_CAP + 3; i++) send(town, defender, FEW, T0 + i * 1_000);
    const sent = ghostLedger(town).sent;
    expect(sent).toHaveLength(GHOST_SENT_CAP);
    expect(new Set(sent.map((s) => s.id)).size).toBe(GHOST_SENT_CAP);
    expect(sent[0]!.at).toBe(T0 + (GHOST_SENT_CAP + 2) * 1_000);
  });

  it('spends nothing: the men stay in the yard', () => {
    const town = structuredClone(attacker);
    const before = structuredClone({ army: town.army, supplies: town.supplies, fuel: town.fuel, squads: town.squads });
    send(town, defender, MANY);
    expect({ army: town.army, supplies: town.supplies, fuel: town.fuel, squads: town.squads }).toEqual(before);
  });
});

describe('replay codes from before the ghost (M27)', () => {
  // Written by v1.65.0's encoder, from the same three battles as below.
  const GOLDEN = {
    raid: 'AQAAARZSQUlEIOKAlCDigJxISUxMIDQw4oCdCwtzdXBwbHlDYWNoZQhmdWVsRHVtcAhobWdUb3dlcghxbHpUb3dlcgZhYVNpdGUJYXRnbVRvd2VyBHdhbGwGcmFuZ2VyBmFicmFtcwhlbmdpbmVlcgdqYXZlbGluCg8LQAEAAQHgCOgHoAboB-gHAQkAIgH_AABUAf8AAFIB_wABIAH_AAIrAf8AA1MB_wAELgH_AAVgAf8AA0kB_wABBhYWAQECAQEKAwcKCgoKAwcDAgEBAQEBASVSQUlEIOKAlCBHUklEIDMtMiDigJxCTEFDSyBURVJSQUNF4oCdAAAAeLAJAegHAQQHAgABAQAB6AcEBAEAAegHCAEIAQEAAegHCQF4AAIBAsIICgJ8AAUBAsIIBAAEAQLCCAAAAAAC2IfbSgdzdGFuZHRvAwEAAAEGAtOm',
    duel: 'AQEAAAZBIERVRUwIC3N1cHBseUNhY2hlCGZ1ZWxEdW1wCGhtZ1Rvd2VyCHFselRvd2VyBmFhU2l0ZQlhdGdtVG93ZXIEd2FsbAZyYW5nZXIKDwVAAQABAegH6AegBugH6AcBCQAiAf8AAFQB_wAAUgH_AAEgAf8AAisB_wADUwH_AAQuAf8ABWAB_wADSQH_AAEGFhYBAQIBAQoDBwoKCgoDBwMCAQEBAQEBJVJBSUQg4oCUIEdSSUQgMy0yIOKAnEJMQUNLIFRFUlJBQ0XigJ0AAAB4sAkB6AcBAQcDAA4GAAHoBwQOCQAB6AcEDggAAegHAAAAAALYh9tKB3N0YW5kdG8DAQFNAAEGAlxx',
    probe: 'AQICARFQUk9CRSDigJQgTEVWRUwgMwUJZ3VhcmRzbWFuBnJhbmdlcghlbmdpbmVlcgNhMTAEYXJ0eQoPY4YBAQAAAegH6AfoB-gH6AcBAAABEVBST0JFIOKAlCBMRVZFTCAzAAAAlgEAGSgCAgAHAAAEAADoBygABgAA6AcoAAcAAOgHKAAEAADoBygABgAA6AcoAAcAAOgHKAAEAADoBwEBrAIABgAA6AcDAgEAAAYAAOgHAAg8AAIAAOgHJAAEAADoByQABwAA6AckAAkAAOgHJAACAADoByQABAAA6AckAAcAAOgHJAAJAADoBwEChAIABgAA6AcoAAYAAOgHAgMABAAAAAACtbzTwQ0AAAEAAAEGAhKYdfoB6wbPJA',
  };

  it('read as they did, carry no commanders, and write back to the same code', () => {
    for (const [kind, code] of Object.entries(GOLDEN)) {
      const replay = decodeOk(code);
      expect(replay.kind).toBe(kind);
      expect(replay.ghost).toBeUndefined();
      expect(encodeReplay(replay)).toBe(code);
    }
  });

  it('are written exactly as v1.65.0 wrote them', () => {
    const base = generateBase(3, 1, CHINA_BASE_KIT);
    const raid = raidConfig(
      base,
      [
        { units: { abrams: 1, ranger: 2 }, sector: 'W1', doctrine: 'assault', slot: 0 },
        { units: { javelin: 2, engineer: 1 }, sector: 'N1', doctrine: 'hunt', slot: 1, vet: 1.09 },
      ],
      11,
      trainableFor('usa'),
      { mods: { hp: 1.12, damage: 1 } },
    );
    expect(encodeReplay({ kind: 'raid', faction: 'usa', title: 'RAID — “HILL 40”', won: true, config: raid })).toBe(
      GOLDEN.raid,
    );
  });

  it('a ghost battle carries its commanders, and a ghost without them is not written', () => {
    const config = decodeOk(GOLDEN.duel).config;
    const tag = { attacker: 'nk' as const, attackerCallsign: 'ONYX 12', defenderCallsign: 'RED LANTERN', id: 4_000_000_001 };
    const code = encodeReplay({ kind: 'ghost', faction: 'china', title: 'GHOST — ONYX 12', won: true, config, ghost: tag });
    const back = decodeOk(code);
    expect(back.kind).toBe('ghost');
    expect(back.ghost).toEqual(tag);
    expect(back.config).toEqual(config);
    expect(() => encodeReplay({ kind: 'ghost', faction: 'china', title: 'X', won: true, config })).toThrow();
  });
});

describe('taking a ghost (M27)', () => {
  it('fights it on the town as it stands, through its entry edge, under its standing orders', () => {
    const attacker = commander('usa', 'VIPER 43', ARMY);
    const defender = walledTown('china', 'RED LANTERN');
    defender.standingOrders = 'holdfast';
    const taken = take(defender, send(attacker, defender, MANY));
    const { config } = taken;
    expect(config.width).toBe(TOWN_GRID.width);
    expect(config.layout!.walls).toEqual(defender.walls.map((w) => ({ cell: w.cell, kind: w.kind })));
    expect(config.standingOrders?.id).toBe('holdfast');
    expect(config.siege!.waves).toHaveLength(1);
    expect(config.siege!.waves[0]!.entries.every((e) => e.row === 0)).toBe(true);
    expect(config.siege!.waves[0]!.entries).toHaveLength(23);
  });

  it('takes nothing from the town: stores, walls, guns and ordnance are as they were', () => {
    const attacker = commander('usa', 'VIPER 43', ARMY);
    const defender = walledTown('china', 'RED LANTERN');
    defender.charges = { a10: 2, arty: 2 };
    defender.standingOrders = 'holdfast';
    const keep = (t: TownState) =>
      structuredClone({ s: t.supplies, f: t.fuel, c: t.charges, w: t.walls, b: t.structures, a: t.army, sh: t.shieldUntil });
    const before = keep(defender);
    const taken = take(defender, send(attacker, defender, MANY));
    expect(taken.held).toBe(false);
    expect(keep(defender)).toEqual(before);
  });

  it('goes in the defence log and the vault naming who sent it, and the vault’s code is the result', () => {
    const attacker = commander('usa', 'VIPER 43', ARMY);
    const defender = walledTown('china', 'RED LANTERN');
    const taken = take(defender, send(attacker, defender, FEW));
    expect(taken.held).toBe(true);
    expect(defender.defenseLog[0]!.ghost).toEqual({ callsign: 'VIPER 43', faction: 'usa' });
    expect(defender.defenseLog[0]!.held).toBe(true);
    const entry = vaultOf(defender)[0]!;
    expect(entry.kind).toBe('ghost');
    expect(entry.code).toBe(taken.result);
    expect(entry.won).toBe(true);
    const result = decodeOk(taken.result);
    expect(result.faction).toBe('china');
    expect(result.ghost).toEqual({
      attacker: 'usa',
      attackerCallsign: 'VIPER 43',
      defenderCallsign: 'RED LANTERN',
      id: taken.ghost.id,
    });
    // The war log counts probes, and this was not one.
    expect(defender.log?.probesHeld).toBe(0);
  });

  it('moves the standing as settled: a hold pays, a breach costs', () => {
    const attacker = commander('usa', 'VIPER 43', ARMY);
    const walled = walledTown('china', 'RED LANTERN');
    const before = walled.frontline.standing;
    const held = take(walled, send(attacker, walled, FEW));
    expect(held.standing).toBe(GHOST_HELD);
    expect(walled.frontline.standing).toBe(before + GHOST_HELD);
    const bare = bareTown('china', 'RED LANTERN');
    bare.frontline.standing = 100;
    const breached = take(bare, send(attacker, bare, MANY));
    expect(breached.held).toBe(false);
    expect(breached.standing).toBe(GHOST_BREACHED);
    expect(bare.frontline.standing).toBe(100 + GHOST_BREACHED);
  });

  it(`pays ${GHOST_PAID_PER_DAY} a day, and fights the rest for nothing`, () => {
    const attacker = commander('usa', 'VIPER 43', ARMY);
    const defender = walledTown('china', 'RED LANTERN');
    const codes = Array.from({ length: GHOST_PAID_PER_DAY + 2 }, (_, i) => send(attacker, defender, FEW, T0 + i * 1_000));
    const paid = codes.slice(0, GHOST_PAID_PER_DAY + 1).map((code) => take(defender, code).standing);
    expect(paid).toEqual([...Array(GHOST_PAID_PER_DAY).fill(GHOST_HELD), 0]);
    expect(paidLeftToday(defender, 'taken', T0 + 2_000)).toBe(0);
    expect(take(defender, codes[GHOST_PAID_PER_DAY + 1]!, T0 + DAY).standing).toBe(GHOST_HELD);
  });

  it('is refused from yourself, when it was sent to someone else, and a second time', () => {
    const attacker = commander('usa', 'VIPER 43', ARMY);
    const defender = walledTown('china', 'RED LANTERN');
    const code = send(attacker, defender, FEW);
    expect(takeGhost(attacker, code, T0)).toEqual({ ok: false, error: 'own' });
    expect(takeGhost(walledTown('russia', 'IRON HORSE'), code, T0)).toEqual({ ok: false, error: 'address' });
    take(defender, code);
    expect(takeGhost(defender, code, T0 + 5_000)).toEqual({ ok: false, error: 'taken' });
    expect(takeGhost(defender, 'garbage', T0)).toEqual({ ok: false, error: 'truncated' });
  });
});

describe('collecting the result (M27)', () => {
  const cases: [string, () => TownState, SquadPlan[], FactionId][] = [
    ['a walled town holds against three men', () => walledTown('china', 'RED LANTERN'), FEW, 'usa'],
    ['a bare town falls to two squads', () => bareTown('china', 'RED LANTERN'), MANY, 'usa'],
    ['a walled town of the same side falls to two squads', () => walledTown('usa', 'OLD GLORY'), MANY, 'usa'],
  ];

  it('fights it again and reaches the ending the defender did', () => {
    for (const [name, defenderOf, plan, faction] of cases) {
      const attacker = commander(faction, 'VIPER 43', ARMY);
      const defender = defenderOf();
      const taken = take(defender, send(attacker, defender, plan));
      const got = collectGhost(attacker, taken.result, T0 + 3_000);
      expect(got.ok, name).toBe(true);
      if (!got.ok) continue;
      expect(got.collected.won, name).toBe(!taken.held);
      expect(got.collected.resolution.ticks, name).toBe(taken.resolution.ticks);
      expect(got.collected.resolution.losses, name).toEqual(taken.resolution.losses);
      expect(got.collected.resolution.destroyed, name).toEqual(taken.resolution.destroyed);
    }
  });

  it('pays a win in standing and a duel’s loot, and a loss in standing', () => {
    const attacker = commander('usa', 'VIPER 43', ARMY);
    attacker.frontline.standing = 100;
    const bare = bareTown('china', 'RED LANTERN');
    const supplies = attacker.supplies;
    const won = collectGhost(attacker, take(bare, send(attacker, bare, MANY)).result, T0 + 3_000);
    expect(won.ok && won.collected.won).toBe(true);
    if (!won.ok) return;
    expect(won.collected.standing).toBe(GHOST_WON);
    expect(won.collected.loot.supplies).toBeGreaterThan(0);
    expect(attacker.supplies).toBe(supplies + won.collected.loot.supplies);
    expect(attacker.frontline.standing).toBe(100 + GHOST_WON);
    const walled = walledTown('china', 'RED LANTERN');
    const lost = collectGhost(attacker, take(walled, send(attacker, walled, FEW)).result, T0 + 4_000);
    expect(lost.ok && lost.collected.won).toBe(false);
    expect(lost.ok && lost.collected.standing).toBe(GHOST_FAILED);
    expect(lost.ok && lost.collected.loot).toEqual({ supplies: 0, fuel: 0 });
    expect(attacker.frontline.standing).toBe(100 + GHOST_WON + GHOST_FAILED);
    // Nothing the ghost was made of was spent.
    expect(attacker.army).toEqual(ARMY);
  });

  it('files the battle in the attacker’s vault, watchable on the right units to the same end', () => {
    const attacker = commander('nk', 'ONYX 12', { nkrifle: 8, rpg7: 2 });
    const defender = bareTown('china', 'RED LANTERN');
    const plan: SquadPlan[] = [{ units: { nkrifle: 8, rpg7: 2 }, sector: 'N2', doctrine: 'assault', slot: 0, delay: 0 }];
    const taken = take(defender, send(attacker, defender, plan));
    const got = collectGhost(attacker, taken.result, T0 + 3_000);
    expect(got.ok).toBe(true);
    const entry = vaultOf(attacker)[0]!;
    expect(entry.kind).toBe('ghost');
    expect(entry.title).toBe('GHOST — RED LANTERN');
    const replay = decodeOk(entry.code);
    const catalog = ghostCatalog(replay.faction, replay.ghost!.attacker);
    const engine = new Engine(replay.config, catalog);
    engine.enqueue({ tick: 0, type: 'startAssault' });
    fightRaid(engine, replay.config);
    expect(engine.phase === 'defeat').toBe(!taken.held);
    expect(engine.tick).toBe(taken.resolution.ticks);
    const report = afterAction(replay.config, catalog);
    expect(report.deaths.length).toBe(Object.values(taken.resolution.losses).reduce((a, b) => a + b, 0));
  });

  it('is refused a second time, from a stranger, or for a battle that is not the one sent', () => {
    const attacker = commander('usa', 'VIPER 43', ARMY);
    const defender = walledTown('china', 'RED LANTERN');
    const { result } = take(defender, send(attacker, defender, FEW));

    // Somebody else's ghost, however like this one.
    const stranger = commander('usa', 'OTHER 99', ARMY);
    expect(collectGhost(stranger, result, T0)).toEqual({ ok: false, error: 'stranger' });
    // A battle that is not a ghost's.
    const fought = decodeOk(result);
    const probe = encodeReplay({ kind: 'probe', faction: fought.faction, title: fought.title, won: fought.won, config: fought.config });
    expect(collectGhost(attacker, probe, T0)).toEqual({ ok: false, error: 'kind' });

    const edits: [string, (r: ReturnType<typeof decodeOk>) => void][] = [
      ['a man moved', (r) => (r.config.siege!.waves[0]!.entries[1]!.atTick += 4)],
      ['a man dropped', (r) => r.config.siege!.waves[0]!.entries.pop()],
      ['a rank lowered', (r) => (r.config.siege!.waves[0]!.entries[0]!.vet = 0.9)],
      ['the research lowered', (r) => (r.config.mods = { ...r.config.mods, attacker: { hp: 0.8, damage: 1 } })],
      ['the dice changed', (r) => (r.config.seed = (r.config.seed + 1) >>> 0)],
      ['the dice pinned', (r) => (r.config.combatSeed = 7)],
      ['a fire plan against it', (r) => (r.config.autoPowers = [{ kind: 'a10', atSeconds: 5, target: 'guns' }])],
      ['sent for the guns', (r) => (r.config.objective = 'guns')],
    ];
    for (const [name, edit] of edits) {
      const forged = tampered(result, edit);
      expect(collectGhost(structuredClone(attacker), forged, T0), name).toEqual({ ok: false, error: 'tampered' });
    }

    expect(collectGhost(attacker, result, T0 + 3_000).ok).toBe(true);
    expect(collectGhost(attacker, result, T0 + 4_000)).toEqual({ ok: false, error: 'collected' });
  });

  it(`pays ${GHOST_PAID_PER_DAY} a day, and collects the rest for nothing`, () => {
    const attacker = commander('usa', 'VIPER 43', ARMY);
    const results = Array.from({ length: GHOST_PAID_PER_DAY + 1 }, (_, i) => {
      const defender = bareTown('china', 'RED LANTERN');
      return take(defender, send(attacker, defender, MANY, T0 + i * 1_000)).result;
    });
    const standings = results.map((code) => {
      const got = collectGhost(attacker, code, T0 + 10_000);
      return got.ok ? got.collected.standing : null;
    });
    expect(standings).toEqual([...Array(GHOST_PAID_PER_DAY).fill(GHOST_WON), 0]);
  });

  it('survives the save: the ghosts waiting and the ones paid for', () => {
    const attacker = commander('usa', 'VIPER 43', ARMY);
    const defender = walledTown('china', 'RED LANTERN');
    const code = send(attacker, defender, FEW);
    const back = deserialize(serialize(attacker))!;
    expect(back.ghosts).toEqual(attacker.ghosts);
    const { result } = take(defender, code);
    expect(collectGhost(back, result, T0 + 3_000).ok).toBe(true);
    const again = deserialize(serialize(back))!;
    expect(collectGhost(again, result, T0 + 4_000)).toEqual({ ok: false, error: 'collected' });
    expect(normalizeGhosts({ sent: [{ id: 'x' }], taken: [3, 'A#1'], collected: 'no' })).toEqual({
      sent: [],
      taken: ['A#1'],
      collected: [],
    });
    expect(normalizeGhosts(null)).toBeUndefined();
  });
});

describe('the catalog a ghost is fought on (M27)', () => {
  it('is the defender’s town and the attacker’s own units', () => {
    const catalog = ghostCatalog('china', 'usa');
    expect(catalog.attackers.ranger).toBe(raidCatalogFor('usa').attackers.ranger);
    expect(catalog.structures).toBe(ghostCatalog('china', 'nk').structures);
    expect(ghostCatalog('china', 'usa')).toBe(catalog);
  });
});

describe('a commander’s town is entered by its edge (M27)', () => {
  it('offers a duel or a ghost the entry edge, and a post all eight', () => {
    expect(entrySectors(true)).toEqual(TOWN_ENTRY_SECTORS);
    expect(entrySectors(false)).toEqual(SECTOR_IDS);
    const seen = new Set<string>();
    let sector = sectorWithin('S2', TOWN_ENTRY_SECTORS);
    for (let i = 0; i < 6; i++) {
      seen.add(sector);
      sector = nextSector(sector, TOWN_ENTRY_SECTORS);
    }
    expect([...seen].sort()).toEqual(['N1', 'N2']);
  });

  it('brings a plan made against a post onto the edge, each squad on its own side', () => {
    const moved = SECTOR_IDS.map((s) => sectorWithin(s, TOWN_ENTRY_SECTORS));
    expect(moved).toEqual(['N1', 'N2', 'N2', 'N2', 'N1', 'N2', 'N1', 'N1']);
    expect(SECTOR_IDS.map((s) => sectorWithin(s, SECTOR_IDS))).toEqual(SECTOR_IDS);
  });

  it('asks a duel’s what-if about the edge only', () => {
    const base = generateBase(3, 1, CHINA_BASE_KIT);
    const plan: SquadPlan[] = [{ units: { ranger: 3 }, sector: 'N1', doctrine: 'assault', slot: 0 }];
    const duel = raidConfig(base, plan, 5, trainableFor('usa'), { combatSeed: 77 });
    const cf = Counterfactual.of(duel, raidCatalogFor('usa'), trainableFor('usa'))!;
    expect(cf.sectors).toEqual(TOWN_ENTRY_SECTORS);
    expect(choicesFor(cf.plan, 0, cf.trainable, cf.sectors).entry).toEqual(['N2']);
    const raid = raidConfig(base, plan, 5, trainableFor('usa'));
    expect(Counterfactual.of(raid, raidCatalogFor('usa'), trainableFor('usa'))!.sectors).toEqual(SECTOR_IDS);
    expect(planOf(duel, trainableFor('usa'))).not.toBeNull();
  });
});
