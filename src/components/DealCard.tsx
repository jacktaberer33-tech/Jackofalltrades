import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SERIES, canWatch, rankName, seriesById, suitById, type Lesson } from '../content';
import { effectiveTier, isFilmed, useStore } from '../store';
import { Link } from '../router';
import { Icon } from './Icon';

/**
 * "Deal me a card": shuffles, then turns over a random lesson the member can watch right now.
 * Lessons they haven't finished come up first; once they've finished everything, any lesson can.
 */
export function DealCard() {
  const { state } = useStore();
  const tier = effectiveTier(state.member);
  const [dealt, setDealt] = useState<Lesson | null>(null);
  const [round, setRound] = useState(0); // bumped on every deal, so the animation plays again
  const [turned, setTurned] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  const pool = useMemo(
    () => SERIES.filter((s) => !s.comingSoon).flatMap((s) => s.lessons).filter((l) => isFilmed(state.filmed, l.id) && canWatch(tier, l)),
    [state.filmed, tier],
  );

  const deal = () => {
    const fresh = pool.filter((l) => !state.completed.includes(l.id));
    const from = (fresh.length ? fresh : pool).filter((l) => pool.length === 1 || l.id !== dealt?.id);
    const pick = (from.length ? from : pool)[Math.floor(Math.random() * (from.length || pool.length))];
    setTurned(false);
    setDealt(pick);
    setRound((r) => r + 1);
  };
  const close = () => {
    setDealt(null);
    openerRef.current?.focus();
  };

  // Turn the card over after the shuffle (straight away for people who've asked for less motion).
  useEffect(() => {
    if (!dealt) return;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => setTurned(true), still ? 0 : 850);
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => { window.clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [dealt, round]);

  if (pool.length === 0) return null;

  const suit = dealt ? suitById(dealt.suit) : null;
  const series = dealt ? seriesById(dealt.seriesId) : null;
  const rank = series ? (series.joker ? '★' : series.rank) : '';
  const cardName = series && suit ? (series.joker ? `${suit.name} Joker` : `${rankName(series.rank)} of ${suit.name}`) : '';

  return (
    <>
      <button ref={openerRef} type="button" className="btn btn--accent deal-btn" onClick={deal}>
        <Icon name="deck" size={18} /> Deal me a card
      </button>

      {dealt && suit && createPortal(
        <div className="deal" role="dialog" aria-modal="true" aria-label="Your card" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="deal__panel">
            <button ref={closeRef} type="button" className="deal__close" onClick={close} aria-label="Close"><Icon name="close" size={20} /></button>
            <div key={round} className={`deal__stage ${turned ? 'is-turned' : ''}`} aria-hidden="true">
              <span className="deal__ghost deal__ghost--a" />
              <span className="deal__ghost deal__ghost--b" />
              <div className="deal__card">
                <span className="deal__face deal__face--back" />
                <span className={`deal__face deal__face--front ${suit.red ? 'is-red' : ''}`}>
                  <span className="deal__index">{rank}<span>{suit.symbol}</span></span>
                  <span className="deal__pip">{suit.symbol}</span>
                  <span className="deal__index deal__index--flip">{rank}<span>{suit.symbol}</span></span>
                </span>
              </div>
            </div>
            <div className={`deal__copy stack-8 ${turned ? 'is-shown' : ''}`} aria-live="polite">
              {turned && (
                <>
                  <p className="eyebrow">{cardName} · {dealt.minutes} min</p>
                  <h2 className="display-s">{dealt.title}</h2>
                  <p className="muted">{dealt.summary}</p>
                  <div className="row-wrap deal__actions">
                    <Link to={`/lesson/${dealt.id}`} className="btn btn--accent">Watch this lesson</Link>
                    {pool.length > 1 && <button type="button" className="btn btn--outline" onClick={deal}>Deal again</button>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
