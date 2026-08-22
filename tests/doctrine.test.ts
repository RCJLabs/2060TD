import { describe, expect, it } from 'vitest';
import { makeSandbox, spawnCell } from './helpers';

/**
 * Doctrine layout: nothing sits within weapon range (4.0) of the straight
 * row-5 lane, so target CHOICE — not opportunistic fire — drives behavior.
 * - m2nest (defense) at (8, 0)
 * - supplyDepot (economy) at (7, 9)…(8, 10)
 * - CC at (17, 4)
 */
function field() {
  const e = makeSandbox(42, {
    layout: {
      walls: [],
      structures: [
        { cell: 0 * 20 + 8, kind: 'm2nest' },
        { cell: 9 * 20 + 7, kind: 'supplyDepot' },
      ],
    },
  });
  return e;
}

describe('attacker doctrines', () => {
  it('assault beelines the CC and touches nothing else', () => {
    const e = field();
    e.enqueue({ tick: 0, type: 'spawnAttacker', cell: spawnCell(e, 5), kind: 'gunTank' });
    e.run(3000); // 550 hqDps-equivalent shelling of the CC takes a while
    expect(e.phase).toBe('defeat'); // CC down
    expect(e.stats.structuresLost).toBe(0); // nest and depot untouched
  });

  it('hunt kills the armed defense first', () => {
    const e = field();
    e.enqueue({
      tick: 0,
      type: 'spawnAttacker',
      cell: spawnCell(e, 5),
      kind: 'gunTank',
      doctrine: 'hunt',
    });
    let nestDiedAt = -1;
    for (let i = 0; i < 1500 && nestDiedAt < 0; i++) {
      const events = e.step();
      if (events.some((ev) => ev.type === 'structureDestroyed' && ev.kind === 'm2nest')) {
        nestDiedAt = e.tick;
      }
    }
    expect(nestDiedAt).toBeGreaterThan(0);
    expect(e.structureAt(9 * 20 + 7)).toBeDefined(); // the depot still stands
    expect(e.cc.hp).toBe(e.cc.profile.maxHp); // CC untouched so far
  });

  it('raze kills the economy first', () => {
    const e = field();
    e.enqueue({
      tick: 0,
      type: 'spawnAttacker',
      cell: spawnCell(e, 5),
      kind: 'gunTank',
      doctrine: 'raze',
    });
    let depotDiedAt = -1;
    for (let i = 0; i < 1500 && depotDiedAt < 0; i++) {
      const events = e.step();
      if (events.some((ev) => ev.type === 'structureDestroyed' && ev.kind === 'supplyDepot')) {
        depotDiedAt = e.tick;
      }
    }
    expect(depotDiedAt).toBeGreaterThan(0);
    expect(e.structureAt(0 * 20 + 8)).toBeDefined(); // the nest still stands
  });

  it('melee units execute raze by fist: walk to the perimeter and demolish', () => {
    const e = field();
    e.enqueue({
      tick: 0,
      type: 'spawnAttacker',
      cell: spawnCell(e, 5),
      kind: 'bruiser',
      doctrine: 'raze',
    });
    e.run(400); // ~4s travel + 400 hp / 100 dps = 4s of swinging
    expect(e.structureAt(9 * 20 + 7)).toBeUndefined(); // depot razed
    expect(e.stats.structuresLost).toBe(1);
  });

  it('doctrine units fall back to the CC when their target class is exhausted', () => {
    const e = makeSandbox(42, {
      layout: { walls: [], structures: [] }, // no economy at all
    });
    e.enqueue({
      tick: 0,
      type: 'spawnAttacker',
      cell: spawnCell(e, 5),
      kind: 'bruiser',
      doctrine: 'raze',
    });
    e.run(600); // walks to the CC (fallback) and starts swinging
    expect(e.cc.hp).toBeLessThan(e.cc.profile.maxHp);
  });

  it('retargets when someone else destroys its objective mid-walk', () => {
    const e = field();
    e.enqueue({
      tick: 0,
      type: 'spawnAttacker',
      cell: spawnCell(e, 5),
      kind: 'bruiser',
      doctrine: 'raze',
    });
    // Rip the depot out from under it after it has committed to a path.
    e.run(40);
    const depot = e.structureAt(9 * 20 + 7)!;
    depot.hp = 0;
    e.run(600); // falls back to the CC without getting stuck
    expect(e.cc.hp).toBeLessThan(e.cc.profile.maxHp);
    expect(e.attackers[0]!.state).not.toBe('stuck');
  });
});
