import { describe, expect, it } from 'vitest';
import { defenseCatalogFor, FACTION_IDS, raidCatalogFor } from '../src/content/factions';
import {
  craterRadius,
  notePainted,
  paintedScars,
  paintScar,
  SCAR_INK,
  SCAR_KINDS,
  ScarField,
  scarFor,
  SCARS,
  SMOKE_SECONDS,
  type Scar,
  type ScarBoard,
  type ScarCanvas,
} from '../src/game/scars';
import type { ArmorClass, SimEvent } from '../src/sim/types';

/**
 * Persistent scarring (M31 Phase 2): what a battle leaves on its board, where,
 * and how it is drawn.
 */

/** A ten-wide board where a 2x2 building is the post, and unit 7 last drove south. */
const board: ScarBoard = {
  centerOf: (cell) => ({ x: (cell % 10) + 0.5, y: Math.floor(cell / 10) + 0.5 }),
  footprintOf: (kind) => (kind === 'cc' ? 2 : 1),
  headingOf: (id) => (id === 7 ? Math.PI / 2 : undefined),
};
const at = { x: 3.5, y: 6.5 };
const died = (armor: ArmorClass, id = 1): SimEvent => ({ type: 'attackerDied', id, at, armor });

describe('what a battle leaves', () => {
  it('a blast leaves a crater, and a bigger blast a bigger one, within reason', () => {
    const small = scarFor({ type: 'aoe', at, radius: 0.8 }, board)!;
    const big = scarFor({ type: 'aoe', at, radius: 2.5 }, board)!;
    expect(small).toMatchObject({ kind: 'crater', x: 3.5, y: 6.5 });
    expect(big.size).toBeGreaterThan(small.size);
    expect(craterRadius(0)).toBeGreaterThan(0);
    // A crater is a pit in one cell, however big the blast.
    expect(craterRadius(10)).toBeLessThanOrEqual(0.5);
  });

  it('armour leaves a wreck lying the way it last drove, and heavy armour a longer one', () => {
    const tank = scarFor(died('heavy', 7), board)!;
    const ifv = scarFor(died('light', 7), board)!;
    expect(tank).toMatchObject({ kind: 'wreck', x: 3.5, y: 6.5, heading: Math.PI / 2 });
    expect(tank.size).toBeGreaterThan(ifv.size);
    // A vehicle the page never saw turn lies as it entered.
    expect(scarFor(died('light', 99), board)!.heading).toBe(0);
  });

  it('an aircraft leaves a crash', () => {
    expect(scarFor(died('air'), board)).toMatchObject({ kind: 'crash', x: 3.5, y: 6.5 });
  });

  it('a soldier leaves nothing', () => {
    expect(scarFor(died('none'), board)).toBeNull();
  });

  it('a broken wall leaves rubble in its cell, and a fallen building scorch over its footprint', () => {
    expect(scarFor({ type: 'wallDestroyed', cell: 23 }, board)).toMatchObject({ kind: 'rubble', x: 3.5, y: 2.5 });
    const gun = scarFor({ type: 'structureDestroyed', id: 4, kind: 'm2nest', at }, board)!;
    const post = scarFor({ type: 'structureDestroyed', id: 5, kind: 'cc', at }, board)!;
    expect(gun).toMatchObject({ kind: 'scorch', size: 1 });
    expect(post.size).toBe(2);
    // One that burns on as a hulk leaves the same scorch, under it.
    expect(scarFor({ type: 'structureDestroyed', id: 4, kind: 'm2nest', at, hulk: true }, board)).toEqual(gun);
  });

  it('rounds, a gun run, a call for fire, a reserve and a refund leave nothing', () => {
    const passing: SimEvent[] = [
      { type: 'shot', from: at, to: at, damageType: 'explosive' },
      { type: 'strafePulse', x0: 1, x1: 8, y: 4 },
      { type: 'powerCast', kind: 'arty', at },
      { type: 'garrisonDeployed', kind: 'rifle', at, committed: 1, ceiling: 4 },
      { type: 'refund', id: 3, at, cp: 2 },
      { type: 'waveStarted', index: 1 },
    ];
    for (const event of passing) expect(scarFor(event, board), event.type).toBeNull();
  });

  it("every army's units: every vehicle and aircraft leaves one, and no soldier does", () => {
    const seen = new Set<string>();
    for (const f of FACTION_IDS) {
      for (const catalog of [defenseCatalogFor(f), raidCatalogFor(f)]) {
        for (const [kind, profile] of Object.entries(catalog.attackers)) {
          if (seen.has(kind)) continue;
          seen.add(kind);
          const scar = scarFor(died(profile.armor), board);
          if (profile.air) expect(scar?.kind, kind).toBe('crash');
          else if (profile.armor === 'none') expect(scar, kind).toBeNull();
          else expect(scar?.kind, kind).toBe('wreck');
        }
      }
    }
    expect(seen.size).toBeGreaterThan(20);
  });

  it('a wreck, a crash and a fallen building smoke a while; a crater and rubble do not', () => {
    expect(SCAR_KINDS.filter((k) => SCARS[k].smokes).sort()).toEqual(['crash', 'scorch', 'wreck']);
    expect(SMOKE_SECONDS).toBeGreaterThan(3);
    expect(SMOKE_SECONDS).toBeLessThanOrEqual(12);
  });
});

describe('spacing: clustered blasts pit the ground and do not bury it', () => {
  const crater = (x: number, y: number): Scar => ({ kind: 'crater', x, y, size: 0.3, heading: 0 });

  it('a scar within half a cell of one of its own kind is not painted again', () => {
    const field = new ScarField();
    expect(field.admit(crater(3, 3))).toBe(true);
    expect(field.admit(crater(3.3, 3.2))).toBe(false);
    expect(field.admit(crater(3.6, 3))).toBe(true);
    expect(field.count).toBe(2);
  });

  it('each kind keeps its own spacing: a wreck in a crater is still painted', () => {
    const field = new ScarField();
    field.admit(crater(3, 3));
    expect(field.admit({ kind: 'wreck', x: 3, y: 3, size: 0.6, heading: 0 })).toBe(true);
  });

  it('sixty-nine blasts in nineteen half-cells stay a few dozen craters at most', () => {
    const field = new ScarField();
    let painted = 0;
    for (let i = 0; i < 69; i++) {
      const cell = i % 19;
      if (field.admit(crater(1 + (cell % 5) * 0.5 + (i % 3) * 0.1, 2 + Math.floor(cell / 5) * 0.5))) painted++;
    }
    expect(painted).toBeLessThanOrEqual(19);
    expect(painted).toBeGreaterThan(5);
  });

  it('clear forgets every scar', () => {
    const field = new ScarField();
    field.admit(crater(3, 3));
    field.clear();
    expect(field.count).toBe(0);
    expect(field.admit(crater(3, 3))).toBe(true);
  });
});

/** A canvas that records what is drawn on it, with only what a scar may use. */
function recorder() {
  const ops: string[] = [];
  const fills: unknown[] = [];
  const strokes: unknown[] = [];
  const log =
    (name: string) =>
    (...args: number[]): void =>
      void ops.push(`${name} ${args.map((a) => (typeof a === 'number' ? a.toFixed(3) : String(a))).join(' ')}`.trim());
  const ctx = {
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    set fillStyle(v: unknown) {
      fills.push(v);
    },
    get fillStyle(): unknown {
      return fills.at(-1) ?? '#000000';
    },
    set strokeStyle(v: unknown) {
      strokes.push(v);
    },
    get strokeStyle(): unknown {
      return strokes.at(-1) ?? '#000000';
    },
    save: log('save'),
    restore: log('restore'),
    beginPath: log('beginPath'),
    closePath: log('closePath'),
    moveTo: log('moveTo'),
    lineTo: log('lineTo'),
    arc: log('arc'),
    stroke: log('stroke'),
    fill: log('fill'),
    translate: log('translate'),
    rotate: log('rotate'),
  };
  return { ctx: ctx as unknown as ScarCanvas, ops, fills, strokes };
}

describe('the painter draws ink lines, never paper or tone', () => {
  const scars: Scar[] = [
    { kind: 'crater', x: 3.5, y: 6.5, size: 0.3, heading: 0 },
    { kind: 'wreck', x: 3.5, y: 6.5, size: 0.62, heading: 1.1 },
    { kind: 'crash', x: 3.5, y: 6.5, size: 0.5, heading: -0.4 },
    { kind: 'scorch', x: 3.5, y: 6.5, size: 2, heading: 0 },
    { kind: 'rubble', x: 3.5, y: 6.5, size: 1, heading: 0 },
  ];

  it('every kind strokes in ink, and fills nothing but a little ink', () => {
    expect(scars.map((s) => s.kind).sort()).toEqual([...SCAR_KINDS].sort());
    for (const scar of scars) {
      const { ctx, ops, fills, strokes } = recorder();
      // The recorder has no fillRect, clearRect or createPattern: a painter
      // that reached for paper, a knockout or a tone would throw here.
      paintScar(ctx, scar, 64);
      expect(ops.filter((o) => o === 'stroke').length, scar.kind).toBeGreaterThan(0);
      expect(strokes.every((s) => s === SCAR_INK), scar.kind).toBe(true);
      expect(fills.every((f) => f === SCAR_INK), scar.kind).toBe(true);
      expect(ops.filter((o) => o === 'save').length, scar.kind).toBe(ops.filter((o) => o === 'restore').length);
    }
  });

  it('draws lighter than the keylines', () => {
    for (const scar of scars) {
      const { ctx } = recorder();
      paintScar(ctx, scar, 64);
      // Keylines are about 0.075 of a cell; a scar is under half that.
      expect(ctx.lineWidth, scar.kind).toBeLessThan(64 * 0.04);
    }
  });

  it('paints the same scar every time, so a replay paints what the battle painted', () => {
    for (const scar of scars) {
      const a = recorder();
      const b = recorder();
      paintScar(a.ctx, scar, 64);
      paintScar(b.ctx, scar, 64);
      expect(a.ops, scar.kind).toEqual(b.ops);
    }
  });

  it('turns a wreck with its heading, and places every scar where it happened', () => {
    const { ctx, ops } = recorder();
    paintScar(ctx, scars[1]!, 64);
    expect(ops).toContain('rotate 1.100');
    expect(ops).toContain(`translate ${(3.5 * 64).toFixed(3)} ${(6.5 * 64).toFixed(3)}`);
  });
});

describe('the record the harness reads', () => {
  it('counts every scar painted, by kind', () => {
    const before = paintedScars().crater ?? 0;
    notePainted('crater');
    expect(paintedScars().crater).toBe(before + 1);
  });
});
