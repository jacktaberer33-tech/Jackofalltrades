import { Fragment, useEffect, type MouseEvent, type ReactNode } from 'react';
import { LEGAL } from '../config';
import { LEGAL_DOCS, LEGAL_ORDER, LEGAL_LINK_LABELS, type Block, type LegalSlug } from '../legal';
import { Link } from '../router';
import { LogoMark } from '../components/Cards';
import { SiteFooter } from '../components/SiteFooter';

// The Privacy Policy, Membership Terms and Community Guidelines. Readable signed in or out.

function Todo({ children }: { children: ReactNode }) {
  return <mark className="legal-todo">{children}</mark>;
}

function placeholder(key: string): ReactNode {
  switch (key) {
    case 'email':
      return LEGAL.email ? <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> : <Todo>contact email to add</Todo>;
    case 'address':
      return LEGAL.address || <Todo>postal address to add</Todo>;
    case 'ico':
      return LEGAL.icoNumber || <Todo>to add once registered</Todo>;
    default:
      return `{{${key}}}`;
  }
}

/** Renders [text](href) links and {{placeholders}} inside a line of policy text. */
function Rich({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\{\{(\w+)\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[3]) {
      parts.push(<Fragment key={m.index}>{placeholder(m[3])}</Fragment>);
    } else {
      const [, label, href] = m;
      if (href.startsWith('#/')) {
        parts.push(<Link key={m.index} to={href.slice(1)}>{label}</Link>);
      } else if (href.startsWith('http')) {
        parts.push(<a key={m.index} href={href} target="_blank" rel="noopener noreferrer">{label}</a>);
      } else {
        parts.push(<a key={m.index} href={href}>{label}</a>);
      }
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function BlockView({ block }: { block: Block }) {
  if ('h3' in block) return <h3 className="legal__h3">{block.h3}</h3>;
  if ('ul' in block) {
    return (
      <ul className="legal__list">
        {block.ul.map((item) => <li key={item}><Rich text={item} /></li>)}
      </ul>
    );
  }
  return <p><Rich text={block.p} /></p>;
}

function jumpTo(id: string) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}

export function Legal({ slug }: { slug: LegalSlug }) {
  const doc = LEGAL_DOCS[slug];

  useEffect(() => {
    const before = document.title;
    document.title = `${doc.title} · Jack of All Trades`;
    return () => { document.title = before; };
  }, [doc.title]);

  return (
    <div className="landing legal-page">
      <header className="site-header">
        <div className="wrap site-header__inner">
          <Link to="/" className="brand">
            <LogoMark />
            <span>Jack of All Trades</span>
          </Link>
          <nav className="site-nav" aria-label="Policies">
            {LEGAL_ORDER.filter((s) => s !== slug).map((s) => (
              <Link key={s} to={`/${s}`} className="link-btn">{LEGAL_DOCS[s].title}</Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="band band--paper">
        <div className="wrap legal">
          <div className="legal__head">
            <p className="eyebrow">{doc.eyebrow}</p>
            <h1 className="display-l">{doc.title}</h1>
            <p className="small muted">Last updated {LEGAL.updated}</p>
            <p className="lede"><Rich text={doc.intro} /></p>
          </div>

          <nav className="legal__toc" aria-label="On this page">
            <p className="eyebrow">On this page</p>
            <ol>
              {doc.sections.map((s) => (
                <li key={s.id}><a href={`#${s.id}`} onClick={jumpTo(s.id)}>{s.title}</a></li>
              ))}
            </ol>
          </nav>

          <div className="legal__body">
            {doc.sections.map((s) => (
              <section key={s.id} id={s.id} className="legal__section" aria-labelledby={`${s.id}-title`}>
                <h2 id={`${s.id}-title`} className="display-s">{s.title}</h2>
                {s.blocks.map((b, i) => <BlockView key={i} block={b} />)}
              </section>
            ))}
          </div>

          <nav className="legal__more" aria-label="Other policies">
            {LEGAL_ORDER.filter((s) => s !== slug).map((s) => (
              <Link key={s} to={`/${s}`} className="btn btn--outline">{LEGAL_LINK_LABELS[s]}</Link>
            ))}
            <Link to="/" className="btn btn--ink">Back to the site</Link>
          </nav>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
