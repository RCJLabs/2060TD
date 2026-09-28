import { SHUTDOWN, type Scene } from '../stage';
import { COLORS, css as hex } from '../palette';
import { buttonProbes, type LiveProbe } from '../seam';
import { css, deviceRect, sceneHost } from './layer';

/**
 * The replay bar's timeline (M35 Phase 3): the battle from its first tick to
 * its last, along the foot of the board, with what happened in it marked on
 * it. A press on it, or a drag along it, moves the playhead; the footage seeks
 * when the finger comes up, because a seek back fights the battle again from
 * its start and should be asked for once, not on every pixel of a drag.
 *
 * The harness finds it as a button labelled TIMELINE, and presses it where it
 * wants the footage to go.
 */
export interface ScrubMark {
  /** Where on the timeline, 0 to 1. */
  at: number;
  /** A wave's start, drawn taller. */
  strong?: boolean;
  /** Something lost, drawn in alarm. */
  alarm?: boolean;
}

export interface Scrubber {
  /** Where it sits, in device px. */
  setRect(x: number, y: number, w: number, h: number): void;
  setMarks(marks: readonly ScrubMark[]): void;
  /** The playhead, 0 to 1; left alone while a finger is on it. */
  setValue(fraction: number): void;
  setVisible(visible: boolean): void;
  destroy(): void;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export function createScrubber(scene: Scene, onSeek: (fraction: number) => void): Scrubber {
  const host = sceneHost(scene);
  const el = document.createElement('div');
  el.dataset['ui'] = 'timeline';
  el.style.cssText = 'position:absolute;pointer-events:auto;touch-action:none;cursor:pointer;';
  const track = document.createElement('div');
  const done = document.createElement('div');
  const marks = document.createElement('div');
  const head = document.createElement('div');
  for (const part of [track, done, marks, head]) {
    part.style.position = 'absolute';
    part.style.pointerEvents = 'none';
    el.appendChild(part);
  }
  host.appendChild(el);

  let rect = { x: 0, y: 0, w: 0, h: 0 };
  let value = 0;
  let dragging = false;
  let destroyed = false;
  let marked: readonly ScrubMark[] = [];

  /** One absolutely placed box, in CSS px. */
  const place = (part: HTMLElement, left: number, top: number, width: number, height: number, color: number): void => {
    part.style.left = `${left}px`;
    part.style.top = `${top}px`;
    part.style.width = `${width}px`;
    part.style.height = `${height}px`;
    part.style.background = hex(color);
  };

  const paint = (shown: number): void => {
    const w = css(rect.w);
    const h = css(rect.h);
    const line = Math.max(2, Math.round(h * 0.12));
    const mid = Math.round(h / 2);
    place(track, 0, mid - line / 2, w, line, COLORS.inkDim);
    place(done, 0, mid - line, Math.round(w * shown), line * 2, COLORS.ink);
    const headW = Math.max(4, Math.round(h * 0.18));
    place(head, Math.round(w * shown - headW / 2), Math.round(h * 0.12), headW, Math.round(h * 0.76), COLORS.signal);
  };

  const paintMarks = (): void => {
    const w = css(rect.w);
    const h = css(rect.h);
    marks.style.left = '0px';
    marks.style.top = '0px';
    marks.style.width = `${w}px`;
    marks.style.height = `${h}px`;
    marks.replaceChildren(
      ...marked.map((m) => {
        const tick = document.createElement('div');
        tick.style.position = 'absolute';
        const tall = m.strong ? 0.7 : 0.4;
        place(tick, Math.round(w * clamp01(m.at)) - 1, Math.round((h * (1 - tall)) / 2), 2, Math.round(h * tall), m.alarm ? COLORS.alarm : COLORS.ink);
        return tick;
      }),
    );
  };

  const fractionAt = (clientX: number): number => {
    const box = el.getBoundingClientRect();
    return box.width > 0 ? clamp01((clientX - box.left) / box.width) : 0;
  };

  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    el.setPointerCapture(e.pointerId);
    paint(fractionAt(e.clientX));
    e.preventDefault();
    e.stopPropagation();
  });
  el.addEventListener('pointermove', (e) => {
    if (dragging) paint(fractionAt(e.clientX));
  });
  el.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    const at = fractionAt(e.clientX);
    value = at;
    paint(at);
    onSeek(at);
  });
  el.addEventListener('pointercancel', () => {
    dragging = false;
    paint(value);
  });

  const probe: LiveProbe = () => {
    const box = deviceRect(el);
    return {
      label: 'TIMELINE',
      sub: `${Math.round(value * 100)}%`,
      ...box,
      full: box,
      enabled: true,
      active: false,
      visible: el.isConnected && el.style.display !== 'none' && box.w > 0,
      dead: destroyed || !el.isConnected,
    };
  };
  buttonProbes.add(probe);

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    buttonProbes.delete(probe);
    el.remove();
  };
  // It goes with the scene, probe and all.
  scene.events.once(SHUTDOWN, destroy);

  return {
    setRect(x, y, w, h) {
      rect = { x, y, w, h };
      el.style.left = `${css(x)}px`;
      el.style.top = `${css(y)}px`;
      el.style.width = `${css(w)}px`;
      el.style.height = `${css(h)}px`;
      paint(value);
      paintMarks();
    },
    setMarks(next) {
      marked = next;
      paintMarks();
    },
    setValue(fraction) {
      if (dragging) return;
      const v = clamp01(fraction);
      if (v === value) return;
      value = v;
      paint(v);
    },
    setVisible(visible) {
      el.style.display = visible ? '' : 'none';
    },
    destroy,
  };
}
