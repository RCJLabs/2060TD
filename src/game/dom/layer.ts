import Phaser from 'phaser';
import { devicePixelRatioCapped, type Rect } from '../layout';
import { textSources, type TextRect } from '../seam';

/**
 * The DOM layer (M30): one element over the canvas that every DOM component
 * draws into.
 *
 * It takes no pointer events itself, so a tap anywhere a component is not goes
 * through to the board exactly as it did before there was a layer. A component
 * that wants input turns it back on for its own subtree.
 *
 * UNITS. The game lays everything out in DEVICE px (see layout.ts), because
 * the canvas is drawn at the device's resolution and shown at CSS size. The
 * DOM is laid out in CSS px. Every rect crossing from one to the other goes
 * through `cssRect`, and every probe coming back through `deviceRect`, so a
 * component never does the division itself and gets it wrong in one place.
 */
let layer: HTMLDivElement | null = null;

export function uiLayer(): HTMLDivElement {
  if (layer?.isConnected) return layer;
  layer = document.createElement('div');
  layer.id = 'ui';
  layer.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'width:100%',
    'height:100%',
    'pointer-events:none',
    // Under the share-code box (50), which opens over overlays.
    'z-index:10',
    'overflow:hidden',
    // The canvas kit has no text to select and no long-press menu. Neither
    // does this one: a thumb resting on a row reads it, it does not copy it.
    'user-select:none',
    '-webkit-user-select:none',
    '-webkit-touch-callout:none',
    '-webkit-tap-highlight-color:transparent',
  ].join(';');
  // Space and Enter on a focused control activate the control. Phaser listens
  // for keys on the window, so without this the same press would also fire
  // whatever the scene binds to Space — on the front door, CONTINUE.
  layer.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') e.stopPropagation();
  });
  // A press on this layer is not a press on the board. Phaser listens for
  // touches and mouse buttons on the WINDOW as well as the canvas, and it
  // hit-tests the canvas for every one it hears, wherever it landed — so a tap
  // on a DOM button also pressed whatever canvas button sat under it. The
  // canvas overlay never met this because its scrim was the topmost canvas
  // object and swallowed the press; a DOM overlay leaves the drawer beneath it
  // exposed, and the first harness run closed a spec card and changed tab in
  // one tap. Stopping the event here keeps it from reaching the window at all.
  for (const type of ['touchstart', 'touchend', 'touchcancel', 'mousedown', 'mouseup'] as const) {
    layer.addEventListener(type, (e) => e.stopPropagation());
  }
  document.body.appendChild(layer);
  return layer;
}

const hosts = new WeakMap<Phaser.Scene, HTMLDivElement>();

/**
 * The element a scene's own DOM pieces hang from — its free buttons, its
 * labels over the board — placed at the canvas's origin, so a child placed
 * in device px lands where the canvas kit would have drawn it.
 *
 * Above the panel (20), below the overlays (60): a CONFIRM sits over the
 * drawer, and a briefing sits over everything. It goes when the scene does,
 * because nothing else would take it down: a Phaser object dies with its
 * scene, and a DOM node dies when somebody removes it.
 */
export function sceneHost(scene: Phaser.Scene): HTMLDivElement {
  let host = hosts.get(scene);
  if (host?.isConnected) return host;
  host = document.createElement('div');
  host.dataset['ui'] = 'scene';
  host.style.cssText = 'position:fixed;width:0;height:0;overflow:visible;pointer-events:none;z-index:30';
  const o = canvasOrigin();
  host.style.left = `${o.left}px`;
  host.style.top = `${o.top}px`;
  uiLayer().appendChild(host);
  hosts.set(scene, host);
  // Everything a scene hangs here is on screen for the harness to read: a
  // free button's label, a banner, the coach's line. One source for the lot,
  // so nothing that lands here can be missed by forgetting to register it.
  const texts = (): TextRect[] => {
    const out: TextRect[] = [];
    if (!host?.isConnected) return out;
    for (const el of host.querySelectorAll<HTMLElement>('[data-text]')) {
      const text = el.textContent ?? '';
      if (text.length === 0 || el.offsetParent === null) continue;
      out.push({ text, ...deviceRect(el), depth: 0, onBoard: false });
    }
    return out;
  };
  textSources.add(texts);
  const drop = (): void => {
    host?.remove();
    hosts.delete(scene);
    textSources.delete(texts);
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, drop);
  scene.events.once(Phaser.Scenes.Events.DESTROY, drop);
  return host;
}

/** Where the canvas sits on the page, in CSS px. Device px count from here. */
function canvasOrigin(): { left: number; top: number } {
  const canvas = document.querySelector('#app canvas');
  if (!canvas) return { left: 0, top: 0 };
  const r = canvas.getBoundingClientRect();
  return { left: r.left, top: r.top };
}

/** The current device px per CSS px, as the canvas uses it. */
export function dpr(): number {
  return devicePixelRatioCapped();
}

/** Device px to CSS px, for a length. */
export function css(devicePx: number): number {
  return devicePx / dpr();
}

/** A device-px rect from the layout, as page CSS px for `position:fixed`. */
export function cssRect(rect: Rect): { left: number; top: number; width: number; height: number } {
  const o = canvasOrigin();
  const d = dpr();
  return { left: o.left + rect.x / d, top: o.top + rect.y / d, width: rect.w / d, height: rect.h / d };
}

/** An element's box, as the device-px rect a probe reports. */
export function deviceRect(el: Element): Rect {
  const o = canvasOrigin();
  const d = dpr();
  const r = el.getBoundingClientRect();
  return { x: (r.left - o.left) * d, y: (r.top - o.top) * d, w: r.width * d, h: r.height * d };
}

/** A page point in CSS px, as the device px the board and the layout use. */
export function devicePoint(clientX: number, clientY: number): { x: number; y: number } {
  const o = canvasOrigin();
  const d = dpr();
  return { x: (clientX - o.left) * d, y: (clientY - o.top) * d };
}

/** Set an element's absolute box from a rect in CSS px. */
export function place(
  el: HTMLElement,
  box: { left: number; top: number; width: number; height: number },
): void {
  el.style.left = `${box.left}px`;
  el.style.top = `${box.top}px`;
  el.style.width = `${box.width}px`;
  el.style.height = `${box.height}px`;
}

/** A hex colour number as CSS, with alpha when it is not opaque. */
export function cssColor(color: number, alpha = 1): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}
