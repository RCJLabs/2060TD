/**
 * Mobile shell (v0.6.1): everything a phone needs that the scenes don't
 * know about. Pure DOM, no Phaser imports — it runs beside the game and
 * ships in the same bundle, so the Pages site and the single-file build
 * both get it for free.
 *
 * - Touch CSS hardening: no long-press callouts, no overscroll bounce,
 *   no tap highlights on the canvas.
 * - A rotate prompt on small portrait screens: the war is 1280×768, and
 *   Scale.FIT in portrait leaves an unreadable strip.
 * - A fullscreen toggle on touch devices, with a best-effort landscape
 *   orientation lock (Android honors it; iOS declines politely).
 */

const isTouchDevice = (): boolean =>
  (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
  (typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches);

async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen();
    // Best effort: locks on Android once fullscreen, throws elsewhere.
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (mode: string) => Promise<void>;
    };
    await orientation?.lock?.('landscape').catch(() => undefined);
  } catch {
    // Fullscreen is a convenience, never a blocker.
  }
}

export function initMobileShell(): void {
  if (typeof document === 'undefined') return;

  const style = document.createElement('style');
  style.textContent = `
    html, body { overscroll-behavior: none; }
    #app, #app canvas {
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
      -webkit-touch-callout: none;
      user-select: none;
      -webkit-user-select: none;
    }
    .ll-overlay {
      position: fixed; inset: 0; z-index: 1000; background: #101210;
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 18px; padding: 24px; text-align: center;
      font-family: 'Courier New', Courier, monospace; color: #cfd4c9;
    }
    .ll-overlay h1 { margin: 0; font-size: 28px; letter-spacing: 6px; }
    .ll-overlay p { margin: 0; font-size: 13px; line-height: 1.7; color: #8b9184; max-width: 320px; }
    .ll-rotate { font-size: 40px; animation: ll-tip 1.4s ease-in-out infinite alternate; }
    @keyframes ll-tip { from { transform: rotate(0deg); } to { transform: rotate(90deg); } }
    .ll-btn {
      font-family: inherit; font-size: 12px; letter-spacing: 1px; color: #cfd4c9;
      background: #1c211c; border: 1px solid #3a423a; padding: 12px 20px; cursor: pointer;
    }
    .ll-btn:active { background: #2a322a; }
    .ll-fs {
      position: fixed; top: 8px; right: 8px; z-index: 999;
      opacity: 0.75; padding: 8px 12px; font-size: 16px; line-height: 1;
    }
  `;
  document.head.appendChild(style);

  if (!isTouchDevice()) return;

  const fullscreenSupported = !!document.documentElement.requestFullscreen;

  // ---- fullscreen toggle, always within thumb's reach --------------------
  if (fullscreenSupported) {
    const fsButton = document.createElement('button');
    fsButton.className = 'll-btn ll-fs';
    fsButton.textContent = '⛶';
    fsButton.title = 'Fullscreen';
    fsButton.addEventListener('click', () => void toggleFullscreen());
    document.body.appendChild(fsButton);
    document.addEventListener('fullscreenchange', () => {
      fsButton.textContent = document.fullscreenElement ? '✕' : '⛶';
    });
  }

  // ---- rotate prompt on small portrait screens ----------------------------
  const overlay = document.createElement('div');
  overlay.className = 'll-overlay';
  overlay.style.display = 'none';

  const title = document.createElement('h1');
  title.textContent = 'LAST LINE';
  const icon = document.createElement('div');
  icon.className = 'll-rotate';
  icon.textContent = '📱';
  const message = document.createElement('p');
  message.textContent =
    'The front is wider than it is tall. ' +
    'Rotate to landscape — fullscreen holds the whole line.';
  overlay.append(title, icon, message);

  let dismissed = false;
  const sync = (): void => {
    const smallPortrait = window.innerHeight > window.innerWidth && window.innerWidth < 600;
    overlay.style.display = !dismissed && smallPortrait ? 'flex' : 'none';
  };

  if (fullscreenSupported) {
    const go = document.createElement('button');
    go.className = 'll-btn';
    go.textContent = 'GO FULLSCREEN LANDSCAPE';
    go.addEventListener('click', () => void toggleFullscreen());
    overlay.append(go);
  }
  const dismiss = document.createElement('button');
  dismiss.className = 'll-btn';
  dismiss.textContent = 'CONTINUE IN PORTRAIT';
  dismiss.addEventListener('click', () => {
    dismissed = true;
    sync();
  });
  overlay.append(dismiss);

  document.body.appendChild(overlay);
  window.addEventListener('resize', sync);
  window.addEventListener('orientationchange', sync);
  sync();
}
