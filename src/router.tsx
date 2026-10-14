import { createContext, useCallback, useContext, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';

// A small hash router. Paths look like "/deck" or "/lesson/clubs-seek-discomfort-2" and are
// mirrored into the URL as #/deck. Swap for React Router if the app outgrows it.

export type Route =
  | { name: 'landing' }
  | { name: 'home' }
  | { name: 'deck' }
  | { name: 'lesson'; id: string }
  | { name: 'table' }
  | { name: 'ace' }
  | { name: 'you' };

export function parse(path: string): Route {
  const parts = path.replace(/^\/+/, '').split('/').filter(Boolean);
  switch (parts[0]) {
    case 'app': return { name: 'home' };
    case 'deck': return { name: 'deck' };
    case 'lesson': return parts[1] ? { name: 'lesson', id: decodeURIComponent(parts[1]) } : { name: 'deck' };
    case 'table': return { name: 'table' };
    case 'ace': return { name: 'ace' };
    case 'you': return { name: 'you' };
    default: return { name: 'landing' };
  }
}

function readHash(): string {
  try {
    const h = window.location.hash;
    return h.startsWith('#/') ? h.slice(1) : '/';
  } catch {
    return '/';
  }
}

const RouterContext = createContext<{ path: string; route: Route; navigate: (path: string) => void } | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(readHash);

  useEffect(() => {
    const sync = () => setPath(readHash());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  const navigate = useCallback((next: string) => {
    setPath(next);
    try {
      if (window.location.hash !== `#${next}`) window.history.pushState(null, '', `#${next}`);
    } catch {
      // Some embedded frames refuse history changes; in-app navigation still works.
    }
    window.scrollTo(0, 0);
  }, []);

  const value = useMemo(() => ({ path, route: parse(path), navigate }), [path, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used inside RouterProvider');
  return ctx;
}

export function Link({ to, className, children, ...rest }: { to: string; className?: string; children: ReactNode; 'aria-label'?: string; 'aria-current'?: 'page' }) {
  const { navigate } = useRouter();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a href={`#${to}`} className={className} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}
