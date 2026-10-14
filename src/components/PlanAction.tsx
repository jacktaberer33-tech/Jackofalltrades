import { useState } from 'react';
import { tierById } from '../content';
import { PAYMENTS_LIVE } from '../config';
import { useStore } from '../store';
import { Icon } from './Icon';

/**
 * The one button for moving up a plan. With payments live it opens Stripe Checkout;
 * before that it puts the member on the waiting list for that plan.
 */
export function PlanAction({ plan, className = 'btn btn--accent btn--sm self-start', onBlock = false }: {
  plan: 'deck' | 'ace';
  className?: string;
  onBlock?: boolean;
}) {
  const { state, actions } = useStore();
  const [busy, setBusy] = useState(false);
  const member = state.member!;
  const info = tierById(plan);

  if (PAYMENTS_LIVE) {
    return (
      <button type="button" className={className} disabled={busy} onClick={async () => {
        setBusy(true);
        const err = await actions.startCheckout(plan);
        if (err) setBusy(false); // on success the page leaves for Stripe
      }}>
        {busy ? 'Opening checkout…' : `Join the ${info.name} · ${info.price}${info.per}`}
      </button>
    );
  }

  const onList = member.requestedTier === plan || (plan === 'deck' && member.requestedTier === 'ace');
  if (onList) {
    return (
      <p className={`small ${onBlock ? 'on-block-muted' : ''}`}>
        <Icon name="check" size={14} /> You're on the list for {tierById(member.requestedTier ?? plan).name}. Founding members get moved up first when payments open.
      </p>
    );
  }
  return (
    <button type="button" className={className} disabled={busy} onClick={async () => {
      setBusy(true);
      const err = await actions.requestTier(plan);
      setBusy(false);
      if (!err) actions.notify('ok', `You're on the list for ${info.name}.`);
    }}>
      Put me on the {info.name} list
    </button>
  );
}
