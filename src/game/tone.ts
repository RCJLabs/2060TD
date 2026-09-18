/**
 * Screentone: the adhesive tone sheets a graphic novel is shaded with.
 *
 * The whole art direction rests on one substitution. Where the topographic
 * sheet used HUE to say what ground you were looking at — green woodland,
 * blue water, buff paper — this says it with TONE DENSITY, and keeps the
 * value budget for the things that matter: your structures are bare paper
 * inside a black keyline, and everything hostile is solid black.
 *
 * Two rules make it work, and both are about where the dots live.
 *
 * **The tone is locked to the WORLD, not to the screen.** A dot screen that
 * is fixed to the viewport crawls and moires the instant the camera pans,
 * which is the single most common way this style fails in a game. The sheet
 * is baked once in world space and lives inside `board.world`, so the dots
 * are part of the ground: pan and they stay put, zoom and you lean in over
 * the paper.
 *
 * **The pitch is in world px, not texture px.** `toneFill` is handed the bake
 * scale and multiplies the pitch by it, so a dot is `TONE_PITCH` world pixels
 * apart whether the sheet was baked at 1x or 4x.
 *
 * Canvas2D rather than Phaser `Graphics` for one reason: `createPattern` is
 * native here and does not exist there. A Graphics implementation would have
 * to emit one `fillCircle` per dot — about 31,000 of them for a 32x24 board
 * at 2x — where this is a single `fillRect` per region.
 */

/**
 * World pixels between dot centres.
 *
 * Coarse on purpose. A cell is 32 world px, so this is four dots to a cell,
 * which survives the fit-zoom a phone uses (roughly 0.4x, putting the dots
 * about 3 CSS px apart) without collapsing into flat grey. Finer tone looks
 * better on a desktop and disappears on the device most people play on.
 */
export const TONE_PITCH = 8;

/** Line tones run coarser than dot tones, the way real tone sheets do. */
const LINE_PITCH = TONE_PITCH * 1.4;

/**
 * The tones, by the density they read as. `t10` through `t60` are dot
 * screens; `hatch` and `cross` are line screens, which is how a sheet
 * distinguishes a SURFACE (dots) from a MATERIAL you cannot walk on (lines).
 */
export type ToneKind = 't10' | 't20' | 't40' | 't60' | 'hatch' | 'cross';

/** Dot radius as a share of the pitch. Measured off the approved mockup. */
const DOT: Record<string, number> = { t10: 0.09, t20: 0.15, t40: 0.24, t60: 0.34 };

/** Line width as a share of the pitch, and the angle the screen runs at. */
const LINE: Record<string, { w: number; deg: number }> = {
  hatch: { w: 0.15, deg: 45 },
  cross: { w: 0.11, deg: -30 },
};

export const INK = '#111111';
export const PAPER = '#ffffff';

const tiles = new Map<string, HTMLCanvasElement>();

/**
 * One tile of a tone, at `scale` texture px per world px.
 *
 * Cached by (kind, scale): a board bakes six of these at most, and a scene
 * restart re-bakes the same six.
 */
function toneTile(kind: ToneKind, scale: number): HTMLCanvasElement {
  const key = `${kind}@${scale}`;
  const hit = tiles.get(key);
  if (hit) return hit;

  const c = document.createElement('canvas');
  const line = LINE[kind];
  // A line screen is drawn as vertical bars and rotated by the pattern
  // transform, so the tile itself only ever needs to be one pitch wide.
  const pitch = Math.max(2, Math.round((line ? LINE_PITCH : TONE_PITCH) * scale));
  c.width = pitch;
  c.height = pitch;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, pitch, pitch);
  ctx.fillStyle = INK;
  if (line) {
    ctx.fillRect(0, 0, Math.max(1, pitch * line.w), pitch);
  } else {
    ctx.beginPath();
    ctx.arc(pitch / 2, pitch / 2, Math.max(0.5, pitch * DOT[kind]!), 0, Math.PI * 2);
    ctx.fill();
  }
  tiles.set(key, c);
  return c;
}

/**
 * Set `ctx.fillStyle` to a tone, ready for any number of fills.
 *
 * The pattern is anchored to the canvas origin rather than to the shape, so
 * two regions filled separately still share one continuous screen — which is
 * what stops a board of per-cell fills reading as a patchwork of tiles.
 */
export function toneFill(ctx: CanvasRenderingContext2D, kind: ToneKind, scale: number): void {
  const pattern = ctx.createPattern(toneTile(kind, scale), 'repeat');
  if (!pattern) {
    // No pattern support at all: fall back to a flat grey of roughly the
    // right density, so the board is still readable rather than blank.
    ctx.fillStyle = kind === 't60' ? '#9a9a9a' : kind === 't40' ? '#c0c0c0' : '#e0e0e0';
    return;
  }
  const line = LINE[kind];
  if (line) {
    // setTransform is what rotates a line screen. Where it is missing the
    // bars simply stay vertical, which still separates water from woodland.
    try {
      pattern.setTransform(new DOMMatrix().rotate(line.deg));
    } catch {
      /* vertical bars are an acceptable degradation */
    }
  }
  ctx.fillStyle = pattern;
}

/** Drop cached tiles. Only the bake scale changing makes this worth doing. */
export function clearToneCache(): void {
  tiles.clear();
}
