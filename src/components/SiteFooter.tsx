import { LEGAL_LINK_LABELS, LEGAL_ORDER } from '../legal';
import { Link } from '../router';
import { SuitMark } from './Cards';

/** Footer shared by the join page and the policy pages. */
export function SiteFooter() {
  return (
    <footer className="band band--block footer">
      <div className="wrap footer__inner">
        <span className="footer__brand"><SuitMark suit="spades" /> Jack of All Trades</span>
        <a className="footer__link" href="https://www.instagram.com/f_taberer/" target="_blank" rel="noopener noreferrer">Instagram: @f_taberer</a>
        <nav className="footer__legal" aria-label="Policies">
          {LEGAL_ORDER.map((s) => (
            <Link key={s} to={`/${s}`} className="footer__link">{LEGAL_LINK_LABELS[s]}</Link>
          ))}
        </nav>
        <span>© 2026 Jack of All Trades</span>
      </div>
    </footer>
  );
}
