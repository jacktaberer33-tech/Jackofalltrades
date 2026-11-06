import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { TIERS, defaultTerm, priceOption, tierById, type Term, type Tier } from '../content';
import { TermPicker } from './TermPicker';
import { useStore } from '../store';
import { PAYMENTS_LIVE } from '../config';
import { Icon } from './Icon';
import { UNCONFIRMED, suggestEmail } from '../supabase';

export type AuthMode = 'signup' | 'signin' | 'reset' | 'newPassword';

export function AuthSheet({ mode: initialMode, tier: initialTier = 'deck', term: initialTerm, royalFull = false, onClose, onSignedIn }: {
  mode: AuthMode;
  tier?: Tier;
  term?: Term;
  /** Royal Flush has no places left: choosing it joins the waitlist instead of paying. */
  royalFull?: boolean;
  onClose: () => void;
  onSignedIn?: (plan: Tier | null, term: Term | null) => void;
}) {
  const { actions } = useStore();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [tier, setTierState] = useState<Tier>(initialTier);
  const [term, setTerm] = useState<Term>(initialTerm ?? defaultTerm(initialTier));
  const setTier = (t: Tier) => { setTierState(t); setTerm(defaultTerm(t)); };
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // After joining: the address the confirmation link went to, so they can resend it or fix a typo.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resent, setResent] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const firstField = useRef<HTMLInputElement | null>(null);
  const emailField = useRef<HTMLInputElement | null>(null);
  const suggestion = mode !== 'newPassword' ? suggestEmail(email) : null;

  useEffect(() => {
    firstField.current?.focus();
    setError(null);
    setDone(null);
    setSentTo(null);
    setResent(null);
  }, [mode]);

  // Supabase allows one resend a minute.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const resend = async (to: string) => {
    setBusy(true);
    setResent(null);
    setError(null);
    const err = await actions.resendConfirmation(to);
    setBusy(false);
    if (err) setError(err);
    else {
      setResent(`Sent again to ${to}. It can take a minute or two.`);
      setCooldown(60);
    }
  };

  const startAgain = () => {
    setSentTo(null);
    setResent(null);
    setError(null);
    setEmail('');
    window.setTimeout(() => emailField.current?.focus(), 0);
  };

  const switchTo = (m: AuthMode) => () => setMode(m);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (mode === 'signup') {
      if (password.length < 8) {
        setError('Use a password of at least 8 characters.');
      } else {
        const res = await actions.signUp(name, email, password, tier, term);
        if (res.error) setError(res.error);
        else if (res.needsConfirm) {
          setSentTo(email.trim());
          setCooldown(60);
        }
        else {
          onSignedIn?.(tier, term);
          onClose();
        }
      }
    } else if (mode === 'signin') {
      const err = await actions.signIn(email, password);
      if (err) setError(err);
      else {
        onSignedIn?.(null, null);
        onClose();
      }
    } else if (mode === 'reset') {
      const err = await actions.sendReset(email);
      if (err) setError(err);
      else setDone(`If there's an account for ${email.trim()}, a link to set a new password is on its way.`);
    } else {
      if (password.length < 8) setError('Use a password of at least 8 characters.');
      else {
        const err = await actions.setNewPassword(password);
        if (err) setError(err);
        else onClose();
      }
    }
    setBusy(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && mode !== 'newPassword') onClose();
  };

  const title = { signup: 'Take a seat', signin: 'Welcome back', reset: 'Reset your password', newPassword: 'Choose a new password' }[mode];
  const chosen = tierById(tier);
  const chosenPrice = priceOption(tier, term);
  const waitlist = PAYMENTS_LIVE && tier === 'royal' && royalFull;
  const submitLabel =
    mode === 'signup' ? (tier === 'open' ? 'Join free' : waitlist ? 'Join free and join the waitlist' : PAYMENTS_LIVE ? 'Continue to payment' : `Join and request ${chosen.name}`)
    : mode === 'signin' ? 'Sign in'
    : mode === 'reset' ? 'Send reset link'
    : 'Save new password';

  return (
    <div className="sheet-backdrop" onClick={mode === 'newPassword' ? undefined : onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="sheet__head">
          <h2 id="auth-title" className="display-m">{title}</h2>
          {mode !== 'newPassword' && (
            <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
          )}
        </div>

        {sentTo ? (
          <div className="stack-16">
            <p className="body-l">
              Nearly there. We've sent a link to <strong className="break-all">{sentTo}</strong>.{' '}
              {tier === 'open' || !PAYMENTS_LIVE
                ? 'Open it to finish joining.'
                : waitlist
                  ? "Open it to confirm your email, and you're on the Royal Flush waitlist."
                  : "Open it to confirm your email, then you'll go straight to payment."}
            </p>
            <p className="small">Is that address right? If not, <button type="button" className="link-btn small" onClick={startAgain}>start again with the right one</button>.</p>
            <p className="small muted">Can't see it? Check your Junk or Spam folder. It's from hello@jackofalltrades.life, with the subject "Take your seat at the Table".</p>
            {resent && <p className="small" role="status">{resent}</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="stack-8">
              <button type="button" className="btn btn--outline" disabled={busy || cooldown > 0} onClick={() => resend(sentTo)}>
                {busy ? 'Sending…' : cooldown > 0 ? `Send it again (in ${cooldown}s)` : 'Send it again'}
              </button>
              <button type="button" className="link-btn small self-center" onClick={onClose}>Close</button>
            </div>
          </div>
        ) : done ? (
          <div className="stack-16">
            <p className="body-l">{done}</p>
            <button type="button" className="btn btn--outline" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form className="stack-16" onSubmit={submit} noValidate>
            {mode === 'signup' && (
              <>
                <fieldset className="tier-picker">
                  <legend className="label">Your hand</legend>
                  {TIERS.map((t) => (
                    <label key={t.id} className={`tier-option ${tier === t.id ? 'is-on' : ''}`}>
                      <input type="radio" name="join-tier" id={`join-tier-${t.id}`} value={t.id} checked={tier === t.id} onChange={() => setTier(t.id)} />
                      <span className="tier-option__name">{t.name}</span>
                      <span className="tier-option__price">{t.id === 'royal' && PAYMENTS_LIVE && royalFull ? 'Full · waitlist' : `${t.price}${t.per}`}</span>
                    </label>
                  ))}
                </fieldset>
                {!waitlist && <TermPicker tier={tier} value={term} onChange={setTerm} idPrefix="join" />}
                {tier !== 'open' && (
                  <p className="small muted note">
                    {waitlist
                      ? "Royal Flush is full right now. You'll start on Open Hand and go on the waitlist, and I'll email you when a place opens."
                      : PAYMENTS_LIVE
                      ? `Next you'll pay ${chosenPrice?.price ?? chosen.price}${chosenPrice?.per ?? chosen.per} securely with Stripe.`
                      : "Payments aren't open yet. You'll start on Open Hand today, and founding members get moved up first when they open."}
                  </p>
                )}
                <div className="field">
                  <label htmlFor="auth-name" className="label">First name</label>
                  <input ref={firstField} id="auth-name" className="input" autoComplete="given-name" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </>
            )}

            {mode !== 'newPassword' && (
              <div className="field">
                <label htmlFor="auth-email" className="label">Email</label>
                <input
                  ref={(el) => {
                    emailField.current = el;
                    if (mode !== 'signup') firstField.current = el;
                  }}
                  id="auth-email"
                  className="input"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {suggestion && (
                  <p className="small" role="status">
                    Did you mean <button type="button" className="link-btn small" onClick={() => setEmail(suggestion)}>{suggestion}</button>?
                  </p>
                )}
              </div>
            )}

            {mode !== 'reset' && (
              <div className="field">
                <label htmlFor="auth-password" className="label">{mode === 'newPassword' ? 'New password' : 'Password'}</label>
                <input
                  ref={mode === 'newPassword' ? firstField : undefined}
                  id="auth-password"
                  className="input"
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {mode !== 'signin' && <span className="small muted">At least 8 characters.</span>}
              </div>
            )}

            {error && <p className="form-error" role="alert">{error}</p>}
            {mode === 'signin' && (error === UNCONFIRMED || resent) && email.trim() && (
              <div className="stack-6">
                <p className="small muted">Can't find it? Check your Junk or Spam folder, or get a fresh link.</p>
                {resent && <p className="small" role="status">{resent}</p>}
                <button type="button" className="btn btn--outline btn--sm self-start" disabled={busy || cooldown > 0} onClick={() => resend(email.trim())}>
                  {cooldown > 0 ? `Send the link again (in ${cooldown}s)` : 'Send the link again'}
                </button>
              </div>
            )}

            <button type="submit" className="btn btn--accent btn--block btn--lg" disabled={busy}>
              {busy ? 'One moment…' : submitLabel}
            </button>

            {mode === 'signup' && (
              <p className="small muted center legal-consent">
                By joining you confirm you're 18 or over and agree to the{' '}
                <a href="#/terms" target="_blank" rel="noopener">Membership Terms</a> and{' '}
                <a href="#/guidelines" target="_blank" rel="noopener">Community Guidelines</a>. The{' '}
                <a href="#/privacy" target="_blank" rel="noopener">Privacy Policy</a> explains how your information is used.
              </p>
            )}
            {mode === 'signup' && (
              <p className="small muted center">Already a member? <button type="button" className="link-btn small" onClick={switchTo('signin')}>Sign in</button></p>
            )}
            {mode === 'signin' && (
              <div className="row-between small">
                <button type="button" className="link-btn small" onClick={switchTo('reset')}>Forgotten your password?</button>
                <button type="button" className="link-btn small" onClick={switchTo('signup')}>Join instead</button>
              </div>
            )}
            {mode === 'reset' && (
              <p className="small muted center"><button type="button" className="link-btn small" onClick={switchTo('signin')}>Back to sign in</button></p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
