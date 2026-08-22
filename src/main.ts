import Phaser from 'phaser';
import { PlaygroundScene } from './game/scenes/PlaygroundScene';
import { SiegeScene } from './game/scenes/SiegeScene';
import { COLORS, css } from './game/palette';

const params = new URLSearchParams(window.location.search);
// Demo mode drives screenshots/smoke tests: headless browsers throttle
// requestAnimationFrame, so fall back to a setTimeout loop there.
const demoMode = params.has('demo');
// ?playground=1 opens the sandbox maze lab instead of the mission.
const playground = params.has('playground');

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
  fps: demoMode ? { forceSetTimeOut: true, target: 60 } : undefined,
  scene: playground ? [PlaygroundScene] : [SiegeScene],
});
