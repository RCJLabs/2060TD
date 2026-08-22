import Phaser from 'phaser';
import { PlaygroundScene } from './game/scenes/PlaygroundScene';
import { COLORS, css } from './game/palette';

// Demo mode drives screenshots/smoke tests: headless browsers throttle
// requestAnimationFrame, so fall back to a setTimeout loop there.
const demoMode = new URLSearchParams(window.location.search).has('demo');

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
  scene: [PlaygroundScene],
});
