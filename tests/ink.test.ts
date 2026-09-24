import { describe, expect, it } from 'vitest';
import { CanvasInk } from '../src/game/dom/ink';
import { drawAttackerGlyph, drawFactionMark, drawStructureGlyph, drawWallGlyph } from '../src/game/glyphs';

/** A 2D context that records what was asked of it, and nothing else. */
function recorder() {
  const calls: string[] = [];
  const state = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1 };
  const log =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push(`${name}(${args.map((a) => (typeof a === 'number' ? Math.round(a * 100) / 100 : a)).join(',')})`);
    };
  const ctx = new Proxy(state as unknown as CanvasRenderingContext2D, {
    get(target, key) {
      if (key in state) return (state as Record<string, unknown>)[key as string];
      if (key === 'canvas') return { width: 64, height: 64 };
      return log(String(key));
    },
    set(target, key, value) {
      (state as Record<string, unknown>)[key as string] = value;
      calls.push(`${String(key)}=${value}`);
      return true;
    },
  });
  return { ctx, calls };
}

describe('CanvasInk (M30)', () => {
  it('a shape drawn mid-path leaves the path it interrupted alone', () => {
    // The board's Graphics keeps a built path apart from its one-shot shapes,
    // as Phaser's did; a canvas has one current path, so a naive port would
    // lose the line here.
    const { ctx, calls } = recorder();
    const ink = new CanvasInk(ctx);
    ink.lineStyle(2, 0x111111).fillStyle(0xe0243c);
    ink.beginPath();
    ink.moveTo(0, 0);
    ink.fillCircle(10, 10, 3);
    ink.lineTo(20, 0);
    ink.strokePath();
    const stroke = calls.lastIndexOf('stroke()');
    const traced = calls.slice(calls.lastIndexOf('beginPath()'), stroke + 1);
    expect(traced).toEqual(['beginPath()', 'moveTo(0,0)', 'lineTo(20,0)', 'stroke()']);
  });

  it('paints each call in its own style, alpha included', () => {
    const { ctx, calls } = recorder();
    const ink = new CanvasInk(ctx);
    ink.fillStyle(0xe0243c, 0.5).fillRect(1, 2, 3, 4);
    ink.lineStyle(3, 0x111111).strokeRect(0, 0, 8, 8);
    expect(calls).toEqual([
      'globalAlpha=0.5',
      'fillStyle=#e0243c',
      'fillRect(1,2,3,4)',
      'globalAlpha=1',
      'strokeStyle=#111111',
      'lineWidth=3',
      'strokeRect(0,0,8,8)',
    ]);
  });

  it('draws every glyph the game has without reaching for a call it lacks', () => {
    // The typechecker holds the contract; this holds it at runtime, across the
    // real glyph code, so an `as` cast somewhere cannot hide a missing method.
    const { ctx, calls } = recorder();
    const ink = new CanvasInk(ctx);
    for (const kind of ['m2nest', 'autocannon', 'cc', 'supplyDepot', 'depmg', 'claymore', 'flak']) {
      drawStructureGlyph(ink, kind, 16, 16, 32);
    }
    for (const kind of ['rifle', 'abrams', 'apache', 'sapper']) drawAttackerGlyph(ink, kind, 16, 16, 32);
    drawWallGlyph(ink, 0, 0, 16, 'wall', 1);
    drawWallGlyph(ink, 0, 0, 16, 'gate', 0.5, true);
    for (const faction of ['usa', 'china', 'russia', 'nk', 'un'] as const) drawFactionMark(ink, faction, 0, 0, 32);
    expect(calls.some((c) => c.startsWith('fill'))).toBe(true);
  });
});
