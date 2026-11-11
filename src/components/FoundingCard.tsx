import { useRef, useState } from 'react';
import { useStore } from '../store';

const W = 1080, H = 1512; // playing-card proportions, big enough to share

/**
 * The founding member's own playing card: their name and their number out of 50. They can save it as
 * a picture or share it. Jack sees a sample, so he can check how it looks.
 */
export function FoundingCard() {
  const { state, actions } = useStore();
  const member = state.member!;
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const number = member.foundingNumber ?? (member.isAdmin ? 0 : null);
  if (number === null) return null;

  const sample = member.foundingNumber === null;
  const no = String(number).padStart(2, '0');
  const joined = new Date(member.joinedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const name = member.name.trim() || 'Member';

  const save = async () => {
    setBusy(true);
    try {
      const blob = await drawCard(name, no, joined);
      const file = new File([blob], `founding-member-${no}.png`, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: 'Jack of All Trades', text: `Founding member No. ${no} of 50 · jackofalltrades.life` });
          return;
        } catch (e) {
          if ((e as Error).name === 'AbortError') return; // they closed the share sheet
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      actions.notify('ok', 'Card saved to your downloads.');
    } catch {
      actions.notify('error', "Couldn't make the picture. Try again, or take a screenshot of the card.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="stack-10" aria-labelledby="founding-title">
      <h2 id="founding-title" className="display-s">Your founding card</h2>
      <div className="card founding">
        <div
          ref={cardRef}
          className="founding__card"
          role="img"
          aria-label={`Founding member card: ${name}, number ${number} of 50`}
          onPointerMove={(e) => {
            const el = cardRef.current;
            if (!el || e.pointerType === 'touch') return;
            const r = el.getBoundingClientRect();
            el.style.setProperty('--tilt-x', `${(((e.clientY - r.top) / r.height) - 0.5) * -10}deg`);
            el.style.setProperty('--tilt-y', `${(((e.clientX - r.left) / r.width) - 0.5) * 12}deg`);
          }}
          onPointerLeave={() => {
            cardRef.current?.style.setProperty('--tilt-x', '0deg');
            cardRef.current?.style.setProperty('--tilt-y', '0deg');
          }}
        >
          <span className="founding__index">J<span>♠︎</span></span>
          <span className="founding__kicker">Founding member</span>
          <span className="founding__no">No. {no}</span>
          <span className="founding__of">of 50</span>
          <span className="founding__name">{name}</span>
          <span className="founding__since">Since {joined}</span>
          <span className="founding__index founding__index--flip">J<span>♠︎</span></span>
        </div>
        <div className="stack-10 founding__copy">
          <p>
            {sample
              ? 'A sample, so you can see what founding members get. Theirs carries their own name and number.'
              : `You're one of the first 50. Your price stays the same for as long as you stay on your plan, and this card is yours.`}
          </p>
          <button type="button" className="btn btn--outline btn--sm self-start" onClick={save} disabled={busy}>
            {busy ? 'Making your card…' : 'Save or share your card'}
          </button>
        </div>
      </div>
    </section>
  );
}

/** Draws the card as a PNG. Drawn by hand so the picture is the same on every phone. */
async function drawCard(name: string, no: string, joined: string): Promise<Blob> {
  try { await document.fonts.ready; } catch { /* draw with fallbacks */ }
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  const INK = '#141414', FACE = '#FAFAF7', RED = '#B3122A', MUTED = '#6B6B66';
  const display = "'Anton', Impact, 'Arial Narrow Bold', sans-serif";
  const mono = "'JetBrains Mono', ui-monospace, Menlo, monospace";
  const body = "'Instrument Sans', 'Helvetica Neue', Arial, sans-serif";

  x.fillStyle = INK; x.fillRect(0, 0, W, H);
  const m = 44, r = 64;
  x.fillStyle = FACE;
  x.beginPath(); x.roundRect(m, m, W - 2 * m, H - 2 * m, r); x.fill();
  x.strokeStyle = INK; x.lineWidth = 3;
  x.beginPath(); x.roundRect(m + 26, m + 26, W - 2 * (m + 26), H - 2 * (m + 26), r - 22); x.stroke();

  const index = (flip: boolean) => {
    x.save();
    if (flip) { x.translate(W, H); x.rotate(Math.PI); }
    x.fillStyle = INK; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.font = `120px ${display}`; x.fillText('J', 176, 250);
    x.font = `92px ${body}`; x.fillText('♠', 176, 350);
    x.restore();
  };
  index(false); index(true);

  x.textAlign = 'center';
  x.fillStyle = RED; x.font = `500 34px ${mono}`;
  spaced(x, 'FOUNDING MEMBER', W / 2, 520, 10);
  x.fillStyle = INK; x.font = `300px ${display}`;
  x.fillText(`No. ${no}`, W / 2, 810);
  x.fillStyle = MUTED; x.font = `500 38px ${mono}`;
  spaced(x, 'OF 50', W / 2, 890, 12);
  x.fillStyle = RED; x.fillRect(W / 2 - 60, 940, 120, 8);

  x.fillStyle = INK;
  let size = 96;
  do { x.font = `${size}px ${display}`; size -= 4; } while (x.measureText(name.toUpperCase()).width > W - 320 && size > 40);
  x.fillText(name.toUpperCase(), W / 2, 1090);
  x.fillStyle = MUTED; x.font = `500 30px ${mono}`;
  spaced(x, `SINCE ${joined.toUpperCase()}`, W / 2, 1160, 6);
  x.fillStyle = INK; x.font = `500 30px ${mono}`;
  spaced(x, 'JACKOFALLTRADES.LIFE', W / 2, 1300, 6);

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'));
}

/** Centred text with letter spacing (canvas letterSpacing isn't everywhere yet). */
function spaced(x: CanvasRenderingContext2D, text: string, cx: number, y: number, gap: number) {
  const widths = [...text].map((ch) => x.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (text.length - 1);
  let at = cx - total / 2;
  const align = x.textAlign;
  x.textAlign = 'left';
  [...text].forEach((ch, i) => { x.fillText(ch, at, y); at += widths[i] + gap; });
  x.textAlign = align;
}
