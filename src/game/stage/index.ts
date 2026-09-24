/**
 * The stage (M30 Phase 3): what draws the board, now that nothing else is
 * drawn on the canvas.
 *
 * It replaced Phaser, which was three quarters of the download and a third of
 * a phone's boot, for a game that used one camera, one container per board,
 * lists of shapes, one image and two styles of text. The pieces keep the
 * names and the behaviour the game was written against, and nothing more.
 */
export { Camera } from './camera';
export { Emitter } from './emitter';
export { Game, POST_RENDER, type GameConfig, type SceneClass } from './game';
export { Graphics } from './graphics';
export {
  keyName,
  Pointer,
  POINTER_DOWN,
  POINTER_MOVE,
  POINTER_UP,
  POINTER_UP_OUTSIDE,
  POINTER_WHEEL,
  SceneInput,
} from './input';
export { Container, GameObject, Image, OBJECT_DESTROY, Text, type ImageSource, type TextStyle } from './objects';
export { DESTROY, POST_UPDATE, RESIZE, Scene, ScaleManager, SHUTDOWN, UPDATE } from './scene';

/** `value` held to `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
