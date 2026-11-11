import { useEffect, useState, type MouseEvent } from 'react';
import { DEALT_NOTE, ROYAL_PLACES, SUITS, TIERS, TIER_RANK, defaultTerm, priceOption, tierById, type Term, type Tier } from '../content';
import { TermPicker } from '../components/TermPicker';
import { isPaying, useStore } from '../store';
import { PAYMENTS_LIVE } from '../config';
import { useRouter } from '../router';
import { CardFace, LogoMark } from '../components/Cards';
import { SiteFooter } from '../components/SiteFooter';
import { Icon } from '../components/Icon';
import { AuthSheet, type AuthMode } from '../components/AuthSheet';
import { FrontLesson } from '../components/FrontLesson';
import { pendingRef } from '../referral';

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
  const [auth, setAuth] = useState<{ mode: AuthMode; tier: Tier; term?: Term } | null>(null);
  const [openWhenReady, setOpenWhenReady] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<{ tier: Tier; term: Term | null } | null>(null);
  const [terms, setTerms] = useState<Record<Tier, Term>>(() => ({
    open: defaultTerm('open'), deck: defaultTerm('deck'), ace: defaultTerm('ace'), royal: defaultTerm('royal'),
  }));
  const [royalLeft, setRoyalLeft] = useState<number | null>(null);
  const member = state.member;
  const inviteCode = pendingRef();
  const showInvite = !!inviteCode && !(member && (isPaying(member) || member.tier === 'ace' || member.tier === 'royal'));

  useEffect(() => {
    let live = true;
    actions.royalPlacesLeft().then((n) => { if (live) setRoyalLeft(n); });
    return () => { live = false; };
  }, [actions]);
  const royalFull = royalLeft === 0;

  // After signing up for a paid plan, go to checkout; otherwise straight into the app once the profile
  // loads. Arriving from the confirmation email after choosing a paid plan also goes to checkout, with
  // the term they picked. If checkout can't start (say Royal Flush is full, so they're on the waitlist),
  // they land in the app.
  useEffect(() => {
    if (!member) return;
    const checkout = (plan: 'deck' | 'ace' | 'royal', term: Term | null) => {
      void actions.startCheckout(plan, term ?? undefined).then((err) => { if (err) navigate('/app'); });
    };
    if (PAYMENTS_LIVE && pendingPlan && pendingPlan.tier !== 'open') {
      const { tier: plan, term } = pendingPlan;
      setPendingPlan(null);
      checkout(plan, term);
      return;
    }
    if (openWhenReady) {
      navigate('/app');
      return;
    }
    if (consumeEmailArrival()) {
      const wanted = member.requestedTier;
      if (PAYMENTS_LIVE && wanted && wanted !== 'open' && !member.isAdmin && !isPaying(member) && TIER_RANK[wanted] > TIER_RANK[member.tier]) {
        checkout(wanted, member.requestedTerm);
        return;
      }
      navigate('/app');
    }
  }, [member, openWhenReady, pendingPlan, navigate, actions]);

  const signIn = () => {
    if (member) navigate('/app');
    else setAuth({ mode: 'signin', tier: 'deck' });
  };

  // Joining from any button: new visitors sign up. Members go to checkout, or if they already pay, to
  // Stripe's confirm screen for the change. (If Royal Flush is full, checkout puts them on the waitlist.)
  const join = async (tier: Tier) => {
    if (!member) {
      setAuth({ mode: 'signup', tier, term: terms[tier] });
      return;
    }
    if (PAYMENTS_LIVE && tier !== 'open' && tier !== member.tier) {
      const err = await actions.startCheckout(tier, terms[tier]);
      if (err) navigate('/app');
      return;
    }
    if (!PAYMENTS_LIVE && tier !== 'open' && tier !== member.tier) {
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

      {showInvite && (
        <aside className="invite" aria-label="Your invitation">
          <div className="wrap invite__inner">
            <p>
              <strong>A friend has invited you to Ace.</strong> Join with their code <span className="invite__code">{inviteCode}</span> and get £50 off your first payment.
            </p>
            <button type="button" className="btn btn--light btn--sm" onClick={() => join('ace')}>Join Ace</button>
          </div>
        </aside>
      )}

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

      <FrontLesson onJoin={() => join('open')} />

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
                    {t.id === 'royal' && (
                      <span className={`pill ${royalFull ? '' : 'pill--accent'}`}>
                        {royalLeft === null ? `${ROYAL_PLACES} places only` : royalFull ? 'Full · waitlist open' : `${royalLeft} of ${ROYAL_PLACES} places left`}
                      </span>
                    )}
                  </div>
                  <p className="tier__price">
                    {priceOption(t.id, terms[t.id])?.price ?? t.price}
                    {(priceOption(t.id, terms[t.id])?.per ?? t.per) && <span>{priceOption(t.id, terms[t.id])?.per ?? t.per}</span>}
                  </p>
                  <p className="tier__pitch">{t.pitch}</p>
                </div>
                <TermPicker tier={t.id} value={terms[t.id]} onChange={(term) => setTerms((s) => ({ ...s, [t.id]: term }))} idPrefix="card" />
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
                  {t.id === 'open' ? 'Start free' : t.id === 'deck' ? 'Join the Full Deck' : t.id === 'ace' ? 'Go Ace' : royalFull ? 'Join the waitlist' : 'Go Royal Flush'}
                </button>
              </article>
            ))}
          </div>
          <p className="small muted center">{DEALT_NOTE}</p>
        </div>
      </section>

      <section className="band band--surface">
        <div className="wrap about">
          <div className="about__photo">
            <img src="/jack.jpg" width={960} height={1200} loading="lazy" decoding="async"
              alt="Jack smiling in the driver's seat of his car, wearing a teal retro track jacket" />
          </div>
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

      <SiteFooter />

      {auth && <AuthSheet mode={auth.mode} tier={auth.tier} term={auth.term} royalFull={royalFull} onClose={() => setAuth(null)} onSignedIn={(plan, term) => { setPendingPlan(plan ? { tier: plan, term } : null); setOpenWhenReady(true); }} />}
    </div>
  );
}
