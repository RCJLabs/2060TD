import { Emitter } from './emitter';

export const POINTER_DOWN = 'pointerdown';
export const POINTER_MOVE = 'pointermove';
export const POINTER_UP = 'pointerup';
export const POINTER_UP_OUTSIDE = 'pointerupoutside';
export const POINTER_WHEEL = 'wheel';

/**
 * A finger or the mouse, in canvas device px, as the board reads it.
 *
 * `downTime` identifies the press: the board binds a pan to the press that
 * opened it and to no other, so it has to be the same number on every event
 * of one press and a different one on the next.
 */
export class Pointer {
  x = 0;
  y = 0;
  isDown = false;
  downTime = 0;
  /** Which buttons are held, as `PointerEvent.buttons` has it. */
  buttons = 0;
  /** The browser's id for the pointer this is tracking, or -1 when free. */
  pointerId = -1;

  constructor(readonly id: number) {}

  rightButtonDown(): boolean {
    return (this.buttons & 2) !== 0;
  }
}

/**
 * What a scene hears of the pointers (Phaser's input plugin, in the part the
 * game uses): events for down, move, up, up-outside and the wheel, the two
 * touch slots a pinch reads, and the pointer last used. Its listeners go when
 * the scene shuts down; the pointers are the game's and stay.
 */
export class SceneInput extends Emitter {
  readonly keyboard = new Emitter();

  constructor(private readonly manager: InputManager) {
    super();
  }

  /** The first touch down, and the second: what a pinch is made of. */
  get pointer1(): Pointer {
    return this.manager.touches[0]!;
  }

  get pointer2(): Pointer {
    return this.manager.touches[1]!;
  }

  get activePointer(): Pointer {
    return this.manager.active;
  }
}

const DIGITS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];

/** Phaser's name for a key: `keydown-SPACE`, `keydown-ESC`, `keydown-ONE`, `keydown-Q`. */
export function keyName(e: Pick<KeyboardEvent, 'key' | 'code'>): string | null {
  if (e.code === 'Space' || e.key === ' ') return 'SPACE';
  if (e.key === 'Escape') return 'ESC';
  if (e.key === 'Enter') return 'ENTER';
  if (/^Digit\d$/.test(e.code)) return DIGITS[Number(e.code[5])]!;
  if (/^Key[A-Z]$/.test(e.code)) return e.code[3]!;
  if (/^[a-z]$/i.test(e.key)) return e.key.toUpperCase();
  if (/^\d$/.test(e.key)) return DIGITS[Number(e.key)]!;
  return null;
}

/** Is a key press meant for a text field rather than the game? */
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

/**
 * The game's one listener on the canvas and the keyboard (M30 Phase 3).
 *
 * Pointer Events on the canvas itself, with the pointer captured on the down
 * so its moves and its lift keep coming wherever the finger goes. That is a
 * narrower net than Phaser's, which listened on the WINDOW and hit-tested the
 * canvas for every press it heard, wherever it landed; a DOM button over the
 * board used to press the board too, and the DOM layer had to stop the event
 * before the window could hear it. The canvas only hears what lands on it.
 *
 * Keys come from the window, as they did, except while a text field has
 * focus: typing a share code is not a string of orders.
 */
export class InputManager {
  /** Two touch slots, filled in the order fingers land. */
  readonly touches = [new Pointer(1), new Pointer(2)];
  readonly mouse = new Pointer(0);
  active: Pointer = this.mouse;
  /** The scene's input the events go to: the running one, or none. */
  target: SceneInput | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const opts = { passive: false } as const;
    canvas.addEventListener('pointerdown', (e) => this.down(e), opts);
    canvas.addEventListener('pointermove', (e) => this.move(e), opts);
    canvas.addEventListener('pointerup', (e) => this.up(e), opts);
    canvas.addEventListener('pointercancel', (e) => this.up(e, true), opts);
    canvas.addEventListener('wheel', (e) => this.wheel(e), opts);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.key(e));
  }

  /** Where a client point lands on the canvas, in its own (device) px. */
  private at(p: Pointer, e: { clientX: number; clientY: number }): void {
    const box = this.canvas.getBoundingClientRect();
    const sx = box.width > 0 ? this.canvas.width / box.width : 1;
    const sy = box.height > 0 ? this.canvas.height / box.height : 1;
    p.x = (e.clientX - box.left) * sx;
    p.y = (e.clientY - box.top) * sy;
  }

  private slotFor(e: PointerEvent, claim: boolean): Pointer | null {
    if (e.pointerType !== 'touch') return this.mouse;
    const held = this.touches.find((t) => t.pointerId === e.pointerId);
    if (held || !claim) return held ?? null;
    const free = this.touches.find((t) => t.pointerId === -1);
    if (free) free.pointerId = e.pointerId;
    return free ?? null;
  }

  private down(e: PointerEvent): void {
    const p = this.slotFor(e, true);
    if (!p) return;
    this.at(p, e);
    p.isDown = true;
    p.downTime = e.timeStamp;
    p.buttons = e.buttons;
    this.active = p;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // A synthetic pointer the browser will not capture still ends here.
    }
    this.target?.emit(POINTER_DOWN, p);
  }

  private move(e: PointerEvent): void {
    const p = this.slotFor(e, false);
    if (!p) return;
    this.at(p, e);
    p.buttons = e.buttons;
    this.active = p;
    this.target?.emit(POINTER_MOVE, p);
  }

  private up(e: PointerEvent, cancelled = false): void {
    const p = this.slotFor(e, false);
    if (!p) return;
    this.at(p, e);
    const wasDown = p.isDown;
    p.isDown = false;
    p.buttons = e.buttons;
    this.active = p;
    if (p !== this.mouse) p.pointerId = -1;
    if (!wasDown) return;
    const inside = p.x >= 0 && p.y >= 0 && p.x <= this.canvas.width && p.y <= this.canvas.height;
    this.target?.emit(inside && !cancelled ? POINTER_UP : POINTER_UP_OUTSIDE, p);
  }

  private wheel(e: WheelEvent): void {
    e.preventDefault();
    const p = this.mouse;
    this.at(p, e);
    this.active = p;
    this.target?.emit(POINTER_WHEEL, p, [], e.deltaX, e.deltaY, e.deltaZ);
  }

  private key(e: KeyboardEvent): void {
    if (!this.target || typing(e.target)) return;
    const name = keyName(e);
    this.target.keyboard.emit('keydown', e);
    if (name) this.target.keyboard.emit(`keydown-${name}`, e);
  }
}
