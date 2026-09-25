import { describe, expect, it } from 'vitest';
import { drawHeatMap, heatLegend, HIT_FLOOR } from '../src/game/heatMap';
import type { Ink } from '../src/game/ink';
import { COLORS } from '../src/game/palette';

/** An Ink that keeps every call, with the fill it was made under. */
function paper(): { ink: Ink; rects: { x: number; y: number; alpha: number }[]; lines: { width: number; color: number }[] } {
  const rects: { x: number; y: number; alpha: number }[] = [];
  const lines: { width: number; color: number }[] = [];
  let fill = { color: 0, alpha: 1 };
  let stroke = { width: 1, color: 0 };
  const ink = new Proxy(
    {},
    {
      get: (_target, op: string) =>
        (...args: number[]) => {
          if (op === 'fillStyle') fill = { color: args[0]!, alpha: args[1] ?? 1 };
          if (op === 'lineStyle') stroke = { width: args[0]!, color: args[1]! };
          if (op === 'fillRect') {
            expect(fill.color).toBe(COLORS.signal);
            rects.push({ x: args[0]!, y: args[1]!, alpha: fill.alpha });
          }
          if (op === 'lineBetween') lines.push({ ...stroke });
          return ink;
        },
    },
  ) as unknown as Ink;
  return { ink, rects, lines };
}

describe('the heat map’s drawing (M29 Phase 2)', () => {
  const width = 4;
  const hits = (cells: Record<number, number>): number[] =>
    Array.from({ length: width * 3 }, (_, i) => cells[i] ?? 0);

  it('shades every cell the fire landed in, the worst at full strength, and no other', () => {
    const { ink, rects } = paper();
    drawHeatMap(ink, { width, hits: hits({ 1: 3, 6: 0.75 }), deaths: [] }, 10);
    expect(rects.map(({ x, y }) => [x, y])).toEqual([
      [10, 0],
      [20, 10],
    ]);
    const [worst, lesser] = rects;
    // A cell hit a quarter as hard reads at half the strength (the square root).
    expect(lesser!.alpha).toBeCloseTo(worst!.alpha / 2, 9);
    expect(worst!.alpha).toBeLessThan(0.5);
  });

  it('never paints a scratch as the killing ground: the scale does not go below the floor', () => {
    const scratch = paper();
    drawHeatMap(scratch.ink, { width, hits: hits({ 2: HIT_FLOOR / 4 }), deaths: [] }, 10);
    const killing = paper();
    drawHeatMap(killing.ink, { width, hits: hits({ 2: HIT_FLOOR * 4 }), deaths: [] }, 10);
    expect(scratch.rects[0]!.alpha).toBeCloseTo(killing.rects[0]!.alpha / 2, 9);
  });

  it('crosses each man where he fell, on a paper halo drawn under every cross', () => {
    const { ink, lines } = paper();
    const deaths = [{ at: { x: 1.5, y: 0.5 } }, { at: { x: 2.2, y: 2.9 } }];
    drawHeatMap(ink, { width, hits: hits({}), deaths }, 10);
    // Two strokes a cross, in two passes: every halo, then every cross.
    expect(lines).toHaveLength(deaths.length * 2 * 2);
    const halo = lines.slice(0, 4);
    const cross = lines.slice(4);
    expect(halo.every((l) => l.color === COLORS.bgField)).toBe(true);
    expect(cross.every((l) => l.color === COLORS.signal)).toBe(true);
    expect(halo[0]!.width).toBeGreaterThan(cross[0]!.width);
  });

  it('says what the marks mean, with the count where it has one', () => {
    expect(heatLegend()).toMatch(/^× WHERE EACH MAN FELL · SHADED WHERE THEY WERE HIT$/);
    expect(heatLegend(7)).toContain('FELL (7)');
  });
});
