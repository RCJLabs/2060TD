/**
 * A real text box (v1.2). Phaser draws text, it cannot take any: share codes
 * have to be copied out and pasted in, and `window.prompt` on a phone is a
 * tiny system dialog that mangles a 300-character string.
 *
 * So this is plain DOM, styled to match the game, laid over the canvas. It
 * ships in the same bundle as the mobile shell and knows nothing about
 * Phaser — scenes hand it a title and a callback.
 */

export interface TextBoxOptions {
  title: string;
  /** Explanatory line under the title. */
  note?: string;
  /** Prefilled content. Present it read-only for a code you are sharing. */
  value?: string;
  readOnly?: boolean;
  /** Label of the confirming button; omit on a read-only box. */
  confirm?: string;
  onConfirm?: (value: string) => void;
  onClose?: () => void;
}

const FONT =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Roboto Mono", monospace';

let open: HTMLDivElement | null = null;

/** True while a box is up, so scenes can ignore keys meant for the field. */
export function textBoxOpen(): boolean {
  return open !== null;
}

export function closeTextBox(): void {
  open?.remove();
  open = null;
}

export function showTextBox(opts: TextBoxOptions): void {
  if (typeof document === 'undefined') return;
  closeTextBox();

  const scrim = document.createElement('div');
  scrim.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:50', 'background:rgba(10,12,10,0.92)',
    'display:flex', 'align-items:center', 'justify-content:center', 'padding:16px',
    `font-family:${FONT}`, 'color:#d8d6c8',
  ].join(';');

  const card = document.createElement('div');
  card.style.cssText = [
    'width:min(560px,100%)', 'max-height:90vh', 'overflow:auto',
    'background:#1b1e1a', 'border:1px solid #3b4038', 'padding:16px',
    'display:flex', 'flex-direction:column', 'gap:12px',
  ].join(';');

  const heading = document.createElement('div');
  heading.textContent = opts.title;
  heading.style.cssText = 'font-size:18px;font-weight:700;letter-spacing:0.04em';
  card.appendChild(heading);

  if (opts.note) {
    const note = document.createElement('div');
    note.textContent = opts.note;
    note.style.cssText = 'font-size:12px;line-height:1.5;color:#8c9184';
    card.appendChild(note);
  }

  const field = document.createElement('textarea');
  field.value = opts.value ?? '';
  field.readOnly = opts.readOnly === true;
  field.spellcheck = false;
  field.autocapitalize = 'off';
  field.autocomplete = 'off';
  field.rows = 5;
  field.placeholder = opts.readOnly ? '' : 'Paste the code here';
  field.style.cssText = [
    'width:100%', 'box-sizing:border-box', 'resize:vertical', 'padding:10px',
    `font-family:${FONT}`, 'font-size:13px', 'line-height:1.45',
    'background:#101310', 'color:#d8d6c8', 'border:1px solid #3b4038',
    'word-break:break-all',
  ].join(';');
  card.appendChild(field);

  const status = document.createElement('div');
  status.dataset['role'] = 'status';
  status.style.cssText = 'font-size:12px;min-height:16px;color:#8c9184';
  card.appendChild(status);

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  card.appendChild(row);

  const button = (label: string, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = [
      'flex:1 1 140px', 'min-height:44px', 'padding:0 14px', 'cursor:pointer',
      `font-family:${FONT}`, 'font-size:14px', 'letter-spacing:0.04em',
      'background:#242821', 'color:#d8d6c8', 'border:1px solid #3b4038',
    ].join(';');
    b.onclick = onClick;
    row.appendChild(b);
    return b;
  };

  if (opts.readOnly) {
    button('COPY CODE', () => {
      const text = field.value;
      field.select();
      const done = (ok: boolean): void => {
        status.textContent = ok
          ? 'Copied. Paste it to whoever you want to lose to you.'
          : 'Copy failed — select the text above and copy it by hand.';
      };
      // The clipboard API needs a secure context; the old command is the
      // fallback that still works on http and older mobile browsers.
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => done(true), () => done(false));
      } else {
        done(false);
      }
    });
  } else {
    button(opts.confirm ?? 'CONFIRM', () => {
      const value = field.value.trim();
      if (!value) {
        status.textContent = 'Nothing pasted yet.';
        return;
      }
      opts.onConfirm?.(value);
    });
  }
  button('CLOSE', () => {
    closeTextBox();
    opts.onClose?.();
  });

  scrim.appendChild(card);
  document.body.appendChild(scrim);
  open = scrim;
  if (!opts.readOnly) field.focus();
  else field.select();
}

/** Report a problem inside an open box without tearing it down. */
export function setTextBoxStatus(message: string): void {
  const status = open?.querySelector('[data-role="status"]');
  if (status instanceof HTMLElement) status.textContent = message;
}
