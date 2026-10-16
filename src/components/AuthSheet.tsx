import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { TIERS, tierById, type Tier } from '../content';
import { useStore } from '../store';
import { PAYMENTS_LIVE } from '../config';
import { Icon } from './Icon';

export type AuthMode = 'signup' | 'signin' | 'reset' | 'newPassword';

export function AuthSheet({ mode: initialMode, tier: initialTier = 'deck', onClose, onSignedIn }: {
  mode: AuthMode;
  tier?: Tier;
  onClose: () => void;
  onSignedIn?: (plan: Tier | null) => void;
}) {
  const { actions } = useStore();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [tier, setTier] = useState<Tier>(initialTier);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstField.current?.focus();
    setError(null);
    setDone(null);
  }, [mode]);

  const switchTo = (m: AuthMode) => () => setMode(m);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (mode === 'signup') {
      if (password.length < 8) {
        setError('Use a password of at least 8 characters.');
      } else {
        const res = await actions.signUp(name, email, password, tier);
        if (res.error) setError(res.error);
        else if (res.needsConfirm) setDone(`Nearly there. We've sent a link to ${email.trim()}. Open it to finish joining.`);
        else {
          onSignedIn?.(tier);
          onClose();
        }
      }
    } else if (mode === 'signin') {
      const err = await actions.signIn(email, password);
      if (err) setError(err);
      else {
        onSignedIn?.(null);
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
  const submitLabel =
    mode === 'signup' ? (tier === 'open' ? 'Join free' : PAYMENTS_LIVE ? 'Continue to payment' : `Join and request ${chosen.name}`)
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

        {done ? (
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
                      <span className="tier-option__price">{t.price}{t.per}</span>
                    </label>
                  ))}
                </fieldset>
                {tier !== 'open' && (
                  <p className="small muted note">
                    {PAYMENTS_LIVE
                      ? `Next you'll pay ${chosen.price}${chosen.per} securely with Stripe. Cancel any time.`
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
                  ref={mode === 'signup' ? undefined : firstField}
                  id="auth-email"
                  className="input"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
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
