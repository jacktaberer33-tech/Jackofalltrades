import type { ReactNode } from 'react';
import { Link, useRouter, type Route } from '../router';
import { Icon, type IconName } from './Icon';
import { LogoMark } from './Cards';
import { SUITS, type SuitId } from '../content';

const NAV: { to: string; label: string; icon: IconName; match: Route['name'][]; railOnly?: boolean }[] = [
  { to: '/app', label: 'Home', icon: 'home', match: ['home'] },
  { to: '/deck', label: 'The Deck', icon: 'deck', match: ['deck', 'lesson'] },
  { to: '/table', label: 'The Table', icon: 'table', match: ['table'] },
  { to: '/ace', label: 'Your 1:1', icon: 'video', match: ['ace'] },
  { to: '/you', label: 'You', icon: 'user', match: ['you'], railOnly: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { route } = useRouter();
  return (
    <div className="shell">
      <aside className="rail" aria-label="Main">
        <Link to="/" className="rail__brand">
          <LogoMark />
          <span>Jack of All Trades</span>
        </Link>
        <nav className="rail__nav">
          {NAV.map((item) => {
            const active = item.match.includes(route.name);
            return (
              <Link key={item.to} to={item.to} className={`rail__item ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}>
                <Icon name={item.icon} size={22} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="shell__main">
        <p className="demo-bar">Demo · example lessons and members · saved in this browser</p>
        <main className="page">{children}</main>
      </div>

      <nav className="tabbar" aria-label="Main">
        {NAV.filter((n) => !n.railOnly).map((item) => {
          const active = item.match.includes(route.name);
          return (
            <Link key={item.to} to={item.to} className={`tabbar__item ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}>
              <Icon name={item.icon} size={22} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function SuitFilter({ value, onChange, label = 'Filter by suit' }: { value: SuitId | 'all'; onChange: (v: SuitId | 'all') => void; label?: string }) {
  const options: { id: SuitId | 'all'; text: string }[] = [{ id: 'all', text: 'All' }, ...SUITS.map((s) => ({ id: s.id, text: `${s.symbol} ${s.name}` }))];
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className="chip" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.text}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, sub, aside }: { title: string; sub?: string; aside?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="stack-4">
        <h1 className="display-l">{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {aside}
    </header>
  );
}
