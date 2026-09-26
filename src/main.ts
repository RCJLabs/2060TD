import { Game, type SceneClass } from './game/stage';
import { BriefingScene } from './game/scenes/BriefingScene';
import { MenuScene } from './game/scenes/MenuScene';
import { PlaygroundScene } from './game/scenes/PlaygroundScene';
import { RaidScene } from './game/scenes/RaidScene';
import { ReplayScene } from './game/scenes/ReplayScene';
import { SiegeScene } from './game/scenes/SiegeScene';
import { TownScene } from './game/scenes/TownScene';
import { dismissBootCard } from './game/boot';
import { devicePixelRatioCapped } from './game/layout';
import { initMobileShell } from './game/mobile';
import { COLORS, css } from './game/palette';
import { applySettings, loadSettings } from './game/settings';
import { liveButtons, liveTextRects, liveTexts, panelLayout, panelScroll, panelTab } from './game/probe';
import { boardCamera, boardCellAt, boardGrid, boardStrays, boardWetAt } from './game/BoardView';
import { audio } from './game/audio';
import { playedImpacts, silentImpacts } from './game/impacts';

// Device preferences (sound, colorblind palette) apply before any scene draws.
applySettings(loadSettings());
// Touch CSS and the fullscreen affordance for phones.
initMobileShell();

const params = new URLSearchParams(window.location.search);
// Demo modes drive screenshots/smoke tests: headless browsers throttle
// requestAnimationFrame, so fall back to a setTimeout loop there.
// ?demo=1 → scripted siege; ?demo=town → showcase base; ?playground=1 → sandbox.
const demo = params.get('demo');
const playground = params.has('playground');

// Demos boot straight into the screen they exist to show; a real session
// starts at the front door.
const scenes: SceneClass[] = playground
  ? [PlaygroundScene]
  : demo === '1'
    ? [SiegeScene, TownScene, BriefingScene, RaidScene, ReplayScene, MenuScene]
    : demo === 'raid'
      ? [RaidScene, TownScene, SiegeScene, BriefingScene, ReplayScene, MenuScene]
      : demo === 'town'
        ? [TownScene, SiegeScene, BriefingScene, RaidScene, ReplayScene, MenuScene]
        : [MenuScene, TownScene, SiegeScene, BriefingScene, RaidScene, ReplayScene];

const host = document.getElementById('app')!;

/** The area the game may draw into, in CSS px (honours 100dvh, so the mobile
 * URL bar sliding away resizes us instead of cropping us). */
function viewportCss(): { w: number; h: number } {
  const w = host.clientWidth || window.innerWidth;
  const h = host.clientHeight || window.innerHeight;
  return { w: Math.max(320, Math.round(w)), h: Math.max(320, Math.round(h)) };
}

let dpr = devicePixelRatioCapped();
const start = viewportCss();

/**
 * The drawing buffer is viewport × DPR (crisp lines on phones), and `zoom`
 * shrinks the CSS size back to the viewport. Layout math lives in device px —
 * see game/layout.ts.
 */
/**
 * Wait for the display face before a single Text object exists.
 *
 * Canvas text does not trigger font loading, and board text measures its
 * string the first time it is laid out — so a game that starts first measures
 * the FALLBACK, caches those metrics, and places the board's lettering for a
 * font it is not drawing. The two weights are already in the bundle as
 * data URIs (see fonts.css); this is only the promise that they have been
 * parsed.
 *
 * Raced against a timeout, because a font that somehow fails to decode should
 * cost the look and not the game.
 */
await Promise.race([
  Promise.all([
    document.fonts.load('600 16px "Barlow Condensed"'),
    document.fonts.load('800 16px "Barlow Condensed"'),
  ]).catch(() => undefined),
  new Promise((resolve) => setTimeout(resolve, 2500)),
]);

const game = new Game({
  parent: host,
  width: start.w * dpr,
  height: start.h * dpr,
  zoom: 1 / dpr,
  backgroundColor: css(COLORS.bgField),
  timer: demo !== null,
  scenes,
});

// The boot card is DOM and comes down on the first rendered frame.
dismissBootCard(game);

/**
 * Test seam: the headless harness taps buttons by label. Rects come back in
 * device px, so `dpr` converts them to the CSS px a synthetic click wants.
 *
 * The handle keeps the game's old name for the same reason the save key does:
 * twelve harnesses address it, and renaming it would be churn with nothing on
 * the other side of it.
 */
(window as unknown as Record<string, unknown>)['lastline'] = {
  buttons: () => liveButtons(),
  texts: () => liveTexts(game.scene.getScenes(true)),
  textRects: () => liveTextRects(game.scene.getScenes(true)),
  strays: () => boardStrays(),
  cell: (col: number, row: number) => boardCellAt(col, row),
  wet: (col: number, row: number) => boardWetAt(col, row),
  camera: () => boardCamera(),
  grid: () => boardGrid(),
  scroll: () => panelScroll(),
  layout: () => panelLayout(),
  tab: () => panelTab(),
  // Every impact the battle renderer has played, and every sound the kit
  // has made, since the page loaded (M31).
  impacts: () => {
    const sounds = audio.soundsMade();
    return { played: playedImpacts(), sounds, silent: silentImpacts(sounds) };
  },
  get dpr() {
    return dpr;
  },
};

/** Re-fit the canvas to the viewport; coalesced to one call per frame. */
let pending = 0;
function refit(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    const next = devicePixelRatioCapped();
    const { w, h } = viewportCss();
    if (next !== dpr) {
      dpr = next;
      game.scale.setZoom(1 / dpr);
    }
    game.scale.resize(w * dpr, h * dpr);
  });
}

window.addEventListener('resize', refit);
window.addEventListener('orientationchange', refit);
// iOS fires this as the URL bar collapses without a window resize.
window.visualViewport?.addEventListener('resize', refit);
document.addEventListener('fullscreenchange', refit);
