import Phaser from 'phaser';
import { PlaygroundScene } from './game/scenes/PlaygroundScene';
import { SiegeScene } from './game/scenes/SiegeScene';
import { TownScene } from './game/scenes/TownScene';
import { COLORS, css } from './game/palette';

const params = new URLSearchParams(window.location.search);
// Demo modes drive screenshots/smoke tests: headless browsers throttle
// requestAnimationFrame, so fall back to a setTimeout loop there.
// ?demo=1 → scripted siege; ?demo=town → showcase base; ?playground=1 → sandbox.
const demo = params.get('demo');
const playground = params.has('playground');

const scene: Phaser.Types.Scenes.SceneType[] = playground
  ? [PlaygroundScene]
  : demo === '1'
    ? [SiegeScene, TownScene]
    : [TownScene, SiegeScene];

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: 1280,
  height: 768,
  backgroundColor: css(COLORS.bgField),
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  fps: demo !== null ? { forceSetTimeOut: true, target: 60 } : undefined,
  scene,
});
