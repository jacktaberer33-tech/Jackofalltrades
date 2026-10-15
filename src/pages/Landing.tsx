import { useEffect, useState, type MouseEvent } from 'react';
import { SUITS, TIERS, tierById, type Tier } from '../content';
import { isPaying, useStore } from '../store';
import { PAYMENTS_LIVE } from '../config';
import { useRouter } from '../router';
import { CardFace, LogoMark, SuitMark } from '../components/Cards';
import { Icon } from '../components/Icon';
import { AuthSheet, type AuthMode } from '../components/AuthSheet';

// Captured before Supabase tidies the address bar: true when this visit came from a sign-up confirmation link.
let arrivedFromEmail = (() => {
  try {
    const h = window.location.hash;
    return h.includes('access_token=') && !h.includes('type=recovery');
  } catch {
    return false;
  }
})();
function consumeEmailArrival(): boolean {
  const v = arrivedFromEmail;
  arrivedFromEmail = false;
  return v;
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// In-page links: real hrefs (so they can be opened, shared and crawled) that scroll smoothly
// without touching the hash, which the router uses for app pages.
function jumpTo(id: string) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    scrollToId(id);
  };
}

export function Landing() {
  const { state, actions } = useStore();
  const { navigate } = useRouter();
  const [auth, setAuth] = useState<{ mode: AuthMode; tier: Tier } | null>(null);
  const [openWhenReady, setOpenWhenReady] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<Tier | null>(null);
  const member = state.member;

  // After signing up for a paid plan, go to checkout; otherwise straight into the app
  // once the profile loads (also when arriving from an email link).
  useEffect(() => {
    if (!member) return;
    if (PAYMENTS_LIVE && pendingPlan && pendingPlan !== 'open') {
      const plan = pendingPlan;
      setPendingPlan(null);
      void actions.startCheckout(plan);
      return;
    }
    if (openWhenReady || consumeEmailArrival()) navigate('/app');
  }, [member, openWhenReady, pendingPlan, navigate, actions]);

  const signIn = () => {
    if (member) navigate('/app');
    else setAuth({ mode: 'signin', tier: 'deck' });
  };

  // Joining from any button: new visitors sign up; existing members just ask for that plan.
  const join = async (tier: Tier) => {
    if (!member) {
      setAuth({ mode: 'signup', tier });
      return;
    }
    if (PAYMENTS_LIVE && tier !== 'open' && tier !== member.tier && !isPaying(member)) {
      await actions.startCheckout(tier);
      return;
    }
    if (tier !== 'open' && tier !== member.tier) {
      const err = await actions.requestTier(tier);
      if (!err) actions.notify('ok', `Noted. You're on the list for ${tierById(tier).name}.`);
    }
    navigate('/app');
  };

  return (
    <div className="landing">
      <header className="site-header">
        <div className="wrap site-header__inner">
          <button type="button" className="brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <LogoMark />
            <span>Jack of All Trades</span>
          </button>
          <nav className="site-nav" aria-label="Page">
            <a href="#how" className="link-btn" onClick={jumpTo('how')}>How it works</a>
            <a href="#tiers" className="link-btn" onClick={jumpTo('tiers')}>Membership</a>
            <button type="button" className="btn btn--outline btn--sm" onClick={signIn}>
              {member ? 'Open the app' : 'Sign in'}
            </button>
          </nav>
        </div>
      </header>

      <section className="band band--paper">
        <div className="wrap hero">
          <div className="hero__copy">
            <p className="eyebrow">The mentorship · Founding places open</p>
            <h1 className="display-xl">
              Honest enough that you <span className="accent-text">see yourself</span> in it.
            </h1>
            <p className="lede">
              No polished guru. Every week I share one lesson from my own life (the training, the setbacks, the decisions
              I'm still not sure about) and ask you one honest question back.
            </p>
            <div className="row-wrap">
              <button type="button" className="btn btn--accent btn--lg" onClick={() => join('deck')}>Become a founding member</button>
              <a href="#how" className="btn btn--outline btn--lg" onClick={jumpTo('how')}>See how it works</a>
            </div>
            <p className="small muted">Free to start. Cancel any time.</p>
          </div>
          <div className="hero__cards">
            <div className="hero__fan">
              <CardFace suit="spades" className="hero__card hero__card--back" />
              <CardFace suit="hearts" center="suit" className="hero__card hero__card--front" />
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="band band--surface">
        <div className="wrap stack-48">
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2 className="display-l">One lesson. One question. One table.</h2>
          </div>
          <ol className="steps">
            <li className="step">
              <span className="step__num">01</span>
              <h3>Watch the week's lesson</h3>
              <p>A short, unscripted video every Monday. What happened, what I got wrong, what I'd do next time.</p>
            </li>
            <li className="step">
              <span className="step__num">02</span>
              <h3>Answer the Mirror</h3>
              <p>Every lesson ends with one honest question about you. Answer it privately, or share it with the Table.</p>
            </li>
            <li className="step">
              <span className="step__num">03</span>
              <h3>Sit at the Table</h3>
              <p>A members-only community to talk it through, plus a live Friday Table with me once a month.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="band band--block">
        <div className="wrap stack-48">
          <div className="section-head">
            <p className="eyebrow eyebrow--on-block">The four suits</p>
            <h2 className="display-l">Life doesn't come in one category.</h2>
            <p className="lede lede--on-block">Being a jack of all trades means I can't pretend it does. Every lesson is dealt into one of four suits.</p>
          </div>
          <div className="suit-grid">
            {SUITS.map((s) => (
              <article key={s.id} className="suit-card">
                <span className={`suit-card__pip ${s.red ? 'is-red' : ''}`} aria-hidden="true">{s.symbol}</span>
                <h3 className="display-s">{s.name}</h3>
                <p>{s.blurb}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="tiers" className="band band--paper">
        <div className="wrap stack-40">
          <div className="section-head">
            <p className="eyebrow">Membership</p>
            <h2 className="display-l">Pick your hand.</h2>
            <p className="lede">Founding members (the first 50 to join) keep their price for as long as they stay.</p>
          </div>
          <div className="tiers">
            {TIERS.map((t) => (
              <article key={t.id} className={`tier ${t.id === 'deck' ? 'tier--featured' : ''}`}>
                <div className="stack-6">
                  <div className="tier__top">
                    <p className="eyebrow">{t.name}</p>
                    {t.id === 'deck' && <span className="pill pill--accent">Founding price</span>}
                    {t.id === 'ace' && <span className="pill">Limited places</span>}
                  </div>
                  <p className="tier__price">
                    {t.price}
                    {t.per && <span>{t.per}</span>}
                  </p>
                  <p className="tier__pitch">{t.pitch}</p>
                </div>
                <ul className="ticks">
                  {t.perks.map((p) => (
                    <li key={p}><Icon name="check" size={18} />{p}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`btn btn--block ${t.id === 'deck' ? 'btn--accent' : 'btn--outline'}`}
                  onClick={() => join(t.id)}
                >
                  {t.id === 'open' ? 'Start free' : t.id === 'deck' ? 'Join the Full Deck' : 'Go Ace'}
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="band band--surface">
        <div className="wrap about">
          <div className="about__photo"><span>[Photo of Jack]</span></div>
          <div className="about__copy">
            <p className="eyebrow">Who's dealing</p>
            <h2 className="display-l">Master of none. Done apologising for it.</h2>
            <p className="lede">
              I'm Jack. PE and maths teacher, personal trainer, endurance athlete, bike mechanic and self-taught developer.
              I've spent years being told to pick one lane.
            </p>
            <p className="lede">
              This isn't advice from someone who's figured it all out. It's what I'm learning, while I'm learning it, told
              as honestly as I can, so you can hold it up and see yourself.
            </p>
            <p className="display-s accent-text">Seek discomfort.</p>
          </div>
        </div>
      </section>

      <section className="band band--accent">
        <div className="wrap cta">
          <div className="stack-12">
            <h2 className="display-l">Pull up a chair.</h2>
            <p className="lede lede--on-accent">Founding places close at 50 members.</p>
          </div>
          <button type="button" className="btn btn--light btn--lg" onClick={() => join('deck')}>Become a founding member</button>
        </div>
      </section>

      <footer className="band band--block footer">
        <div className="wrap footer__inner">
          <span className="footer__brand"><SuitMark suit="spades" /> Jack of All Trades</span>
          <a className="footer__link" href="https://www.instagram.com/f_taberer/" target="_blank" rel="noopener noreferrer">Instagram: @f_taberer</a>
          <span>© 2026 Jack of All Trades</span>
        </div>
      </footer>

      {auth && <AuthSheet mode={auth.mode} tier={auth.tier} onClose={() => setAuth(null)} onSignedIn={(plan) => { setPendingPlan(plan); setOpenWhenReady(true); }} />}
    </div>
  );
}
