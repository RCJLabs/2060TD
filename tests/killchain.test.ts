import { describe, expect, it } from 'vitest';
import { CHAIN_CURRENT, CHAIN_NONE, chainModelFor } from '../src/sim/killchain';
import { decodeReplay, encodeReplay } from '../src/meta/replaycode';
import type { SimConfig } from '../src/sim/types';
import { Engine } from '../src/sim/engine';
import { makeSandbox, spawnCell, TEST_CATALOG } from './helpers';

/**
 * The post stops being a health bar (v1.41).
 *
 * Every test here is about ONE stage refusing to be paid in the wrong
 * currency, because that is the entire model: four gates, four different
 * asks, and no unit that answers all four.
 */
describe('the kill chain', () => {
  const MODEL = chainModelFor(CHAIN_CURRENT);
  /** The sandbox CC, level 1. */
  const MAX_HP = TEST_CATALOG.structures['cc']!.maxHp;
  const BREACH_FLOOR = MODEL.breachTo * MAX_HP;
  const CHARGE_FLOOR = MODEL.chargeTo * MAX_HP;

  const staged = (over: Partial<SimConfig> = {}): Engine =>
    makeSandbox(42, { killChainVersion: CHAIN_CURRENT, ...over });

  /** Send `n` of a kind up the middle of the sandbox, spread over spawn rows. */
  const send = (e: Engine, kind: string, n: number): void => {
    for (let i = 0; i < n; i++) {
      e.enqueue({ tick: 0, type: 'spawnAttacker', cell: spawnCell(e, 4 + i), kind });
    }
  };

  it('version 0 is the sponge, frozen: naming it changes nothing', () => {
    const run = (over: Partial<SimConfig>): string => {
      const e = makeSandbox(42, over);
      send(e, 'bruiser', 2);
      e.run(900);
      return e.stateHash();
    };
    const absent = run({});
    expect(run({ killChainVersion: CHAIN_NONE })).toBe(absent);
    // The liveness half: a hash that agrees because nothing happened is not a
    // passing test. On the sponge these two chew the post down in 900 ticks.
    const e = makeSandbox(42);
    send(e, 'bruiser', 2);
    e.run(900);
    expect(e.cc.hp, 'the sponge fixture never reached the post').toBeLessThan(MAX_HP);
    expect(e.chainProgress(), 'version 0 pretended to have stages').toBeNull();
  });

  it('a unit with no demolition cannot open the post, however long it stands there', () => {
    const e = staged();
    send(e, 'sealed', 3); // wallDps 0, hqDps 10 — all post-killer, no charges
    e.run(1200);
    const chain = e.chainProgress()!;
    expect(chain.holders, 'the fixture never reached the post at all').toBeGreaterThanOrEqual(2);
    expect(chain.stage).toBe('breach');
    expect(e.cc.hp).toBe(MAX_HP);
  });

  it('demolition opens it, and hqDps buys nothing until it is open', () => {
    // Speed-independent: count only the ticks each force spends WORKING the
    // breach, so the comparison is 60 wallDps against 30 and not 1.6 speed
    // against 2.5. The bruiser has ten times the hqDps of the breacher and it
    // is worth exactly nothing here, which is the thesis in one number.
    const breachTicks = (kind: string): number => {
      const e = staged();
      send(e, kind, 2);
      let working = 0;
      for (let i = 0; i < 2000; i++) {
        e.step();
        const chain = e.chainProgress()!;
        if (chain.stage === 'breach' && chain.holders > 0) working++;
        if (chain.stage !== 'breach') return working;
      }
      return Infinity;
    };
    const withCharges = breachTicks('breacher'); // wallDps 60, hqDps 10
    const withGun = breachTicks('bruiser'); //      wallDps 30, hqDps 100
    expect(withCharges).toBeLessThan(withGun);
    expect(withGun).toBeLessThan(Infinity);
  });

  it('a shell opens the post; an aircraft cannot then walk into it', () => {
    const e = staged();
    // wallDps 0 and a 30-damage explosive: it shells the post open from above
    // and then has nothing left to pay the next stage with. The first draft of
    // this test asserted the same thing and FAILED, because a pair of these
    // opened the post, closed on it, counted as crew and burned it down from
    // the air — no demolition and no infantry anywhere in the force.
    send(e, 'gunFlyer', 2);
    e.run(1500);
    expect(e.cc.hp).toBe(BREACH_FLOOR);
    expect(e.chainProgress()!.holders, 'an aircraft held the ground').toBe(0);
    expect(e.phase).not.toBe('defeat');
  });

  it('a live gun covering the post holds the charge, and killing it releases it', () => {
    const covered = staged();
    // Three cells from the post's centre, off its perimeter so it blocks
    // nothing — the gate is about the gun being alive, not in the way.
    covered.enqueue({ tick: 0, type: 'placeStructure', cell: covered.grid.idx(15, 5), kind: 'm2nest' });
    send(covered, 'tank', 2);
    covered.run(2000);
    const chain = covered.chainProgress()!;
    expect(chain.stage).toBe('suppress');
    expect(chain.covering).toBe(1);
    expect(covered.cc.hp).toBe(BREACH_FLOOR);

    const clear = staged();
    send(clear, 'tank', 2);
    clear.run(2000);
    expect(clear.cc.hp, 'the same force got no further on an open post').toBeLessThan(BREACH_FLOOR);
  });

  it('an air-defence mount does not cover the post', () => {
    // Its own profile says it "watches the sky and nothing else", so it cannot
    // shoot the men setting a charge and cannot be what stops them.
    //
    // This test exists because nothing else exercises the rule. The balance
    // snapshot's WITH AA COVER rows use the DUAL-PURPOSE flak, which gates
    // suppression correctly, so those rows are identical with the rule and
    // without it. Without this test the rule would be unmeasured code.
    const e = staged();
    e.enqueue({ tick: 0, type: 'placeStructure', cell: e.grid.idx(15, 5), kind: 'aaSite' });
    send(e, 'tank', 2);
    e.run(2500);
    const chain = e.chainProgress()!;
    expect(chain.covering, 'an air-only mount was counted as cover').toBe(0);
    expect(e.cc.hp, 'the assault was gated by a gun that cannot shoot it').toBeLessThan(
      BREACH_FLOOR,
    );
  });

  it('one body cannot work the charge; two can', () => {
    const alone = staged();
    send(alone, 'tank', 1);
    // Read it BEFORE the stall rule fires. A lone tank reaches the post around
    // t=13s and has the shell open by t=28s; from there the board is static
    // and `stallSeconds` starts counting, so at 2500 ticks the unit has
    // already withdrawn and `holders` is 0. 1500 sits inside that window.
    alone.run(1500);
    const chain = alone.chainProgress()!;
    expect(chain.holders).toBe(1);
    expect(chain.crew).toBe(2);
    expect(chain.stage).toBe('charge');
    expect(alone.cc.hp).toBe(BREACH_FLOOR);

    const pair = staged();
    send(pair, 'tank', 2);
    pair.run(2500);
    expect(pair.cc.hp).toBeLessThan(CHARGE_FLOOR);
  });

  it('an assault that can achieve nothing is spent, and the battle ends', () => {
    // v1.41 shipped a hang: the crew minimum means one attacker can never take
    // a post, and once every gun that could reach it is dead it can never be
    // killed either — so a wave that ends when the attackers do never ends.
    // Measured at 18% of reference sieges. The sandbox reproduces it exactly:
    // one tank, nothing that can shoot it.
    const e = staged();
    send(e, 'tank', 1);
    e.run(1500);
    expect(e.chainProgress()!.holders, 'the fixture never reached the post').toBe(1);
    expect(e.attackers.length).toBe(1);

    // Past the model's patience it gives up and the board clears.
    e.run(MODEL.stallSeconds * 20 + 100);
    expect(e.attackers.length, 'the spent assault is still standing there').toBe(0);
    expect(e.cc.hp, 'the post fell to a force that could never take it').toBeGreaterThan(0);

    // And the rule does not fire on an assault that is getting somewhere: two
    // tanks move the bar, so the board is never static.
    const working = staged();
    send(working, 'tank', 2);
    working.run(MODEL.stallSeconds * 20 + 2000);
    expect(working.cc.hp, 'a working assault was withdrawn').toBeLessThan(CHARGE_FLOOR);
  });

  it('and an aircraft loitering over the post is spent too', () => {
    // The half that was missed the first time. "An aircraft is not a body on
    // the ground" keeps it out of the holder count, so a stall clock gated on
    // HOLDERS never starts for the one attacker that is hardest to shoot down
    // — a lone Reaper deadlocked every late reference base at level 4 after
    // the ground case was already fixed. The quorum counts anyone who reached
    // the objective; only the crew minimum counts boots.
    const e = staged();
    send(e, 'gunFlyer', 1);
    e.run(1500);
    expect(e.attackers.length, 'the fixture never reached the post').toBe(1);
    expect(e.chainProgress()!.holders, 'an aircraft was counted as a holder').toBe(0);

    e.run(MODEL.stallSeconds * 20 + 100);
    expect(e.attackers.length, 'the aircraft is still loitering').toBe(0);
  });

  it('the burn is a clock, and it backs off when the ground is not held', () => {
    const e = staged();
    send(e, 'bruiser', 2);
    let lit = -1;
    for (let i = 0; i < 2000 && lit < 0; i++) {
      e.step();
      if (e.chainProgress()!.stage === 'burn') lit = e.tick;
    }
    expect(lit, 'the fixture never set the charge').toBeGreaterThan(0);
    expect(e.cc.hp).toBeCloseTo(CHARGE_FLOOR, 6);

    // Half the fuse, held: half the remaining bar.
    e.run(MODEL.burnSeconds * 10);
    const half = e.cc.hp;
    expect(half).toBeCloseTo(CHARGE_FLOOR / 2, 1);

    // Now the holders die and the fuse goes out. It backs off rather than
    // resetting: losing the ground costs the attacker ground, not the raid.
    for (const attacker of e.attackers) attacker.hp = 0;
    e.run(60);
    expect(e.chainProgress()!.holders).toBe(0);
    expect(e.cc.hp).toBeGreaterThan(half);
    expect(e.cc.hp).toBeLessThanOrEqual(CHARGE_FLOOR);
  });

  it('the whole chain ends in a taken post, and the sim says who took it', () => {
    const e = staged();
    send(e, 'bruiser', 3);
    for (let i = 0; i < 3000 && e.phase !== 'defeat'; i++) e.step();
    expect(e.phase).toBe('defeat');
    expect(e.chainStagesCleared).toBe(4);
    expect(e.stats.ccKillerKind).toBe('Bruiser');
  });

  it('the same config fights the same battle twice', () => {
    const hash = (): string => {
      const e = staged();
      send(e, 'bruiser', 2);
      e.run(1400);
      return e.stateHash();
    };
    expect(hash()).toBe(hash());
  });

  it('a replay carries the model it was fought under, and an older code does not', () => {
    const config: SimConfig = {
      width: 20,
      height: 11,
      seed: 7,
      ccOrigin: 4 * 20 + 17,
      spawnLane: 0,
      killChainVersion: CHAIN_CURRENT,
    };
    const round = decodeReplay(
      encodeReplay({ kind: 'raid', faction: 'usa', title: 'T', won: false, config }),
    );
    expect(round.ok).toBe(true);
    if (!round.ok) return;
    expect(round.replay.config.killChainVersion).toBe(CHAIN_CURRENT);

    const older = { ...config };
    delete older.killChainVersion;
    const before = decodeReplay(
      encodeReplay({ kind: 'raid', faction: 'usa', title: 'T', won: false, config: older }),
    );
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.replay.config.killChainVersion, 'an old code woke up staged').toBeUndefined();
  });
});
