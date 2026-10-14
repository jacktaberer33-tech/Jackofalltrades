import { suitById, type SuitId } from '../content';

/** The small J♠ card used as the logo. */
export function LogoMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span className={`logo-mark logo-mark--${size}`} aria-hidden="true">
      J<span>{'♠︎'}</span>
    </span>
  );
}

/** A full playing-card face, used on the join page. */
export function CardFace({ suit, center = 'rank', className = '' }: { suit: SuitId; center?: 'rank' | 'suit'; className?: string }) {
  const s = suitById(suit);
  const tone = s.red ? 'card-face--red' : '';
  return (
    <div className={`card-face ${tone} ${className}`} aria-hidden="true">
      <span className="card-face__index">J<span>{s.symbol}</span></span>
      <span className="card-face__center">
        {center === 'rank' ? 'J' : <span className="card-face__pip">{s.symbol}</span>}
        {center === 'suit' && <span className="card-face__caption">Of all trades</span>}
      </span>
      <span className="card-face__index card-face__index--flip">J<span>{s.symbol}</span></span>
    </div>
  );
}

/** A tiny card used as a series thumbnail. */
export function MiniCard({ suit }: { suit: SuitId }) {
  const s = suitById(suit);
  return (
    <span className={`mini-card ${s.red ? 'mini-card--red' : ''}`} aria-hidden="true">
      {s.symbol}
    </span>
  );
}

/** Suit symbol coloured like a real card. */
export function SuitMark({ suit }: { suit: SuitId }) {
  const s = suitById(suit);
  return <span className={s.red ? 'suit suit--red' : 'suit'} aria-hidden="true">{s.symbol}</span>;
}

export function Avatar({ name, size = 40, jack = false }: { name: string; size?: number; jack?: boolean }) {
  if (jack) return <LogoMark size="sm" />;
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} aria-hidden="true">
      {initials}
    </span>
  );
}
