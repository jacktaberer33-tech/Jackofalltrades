import { useState } from 'react';
import { TermPicker } from './TermPicker';
import { TIER_RANK, defaultTerm, priceOption, tierById, type Term } from '../content';
import { PAYMENTS_LIVE } from '../config';
import { isPaying, useStore } from '../store';
import { Icon } from './Icon';

/**
 * The one button for moving up a plan. With payments live it opens Stripe Checkout, or for members
 * who already pay, Stripe's confirm screen for the upgrade; before that it puts the member on the
 * waiting list for that plan.
 */
export function PlanAction({ plan, className = 'btn btn--accent btn--sm self-start', onBlock = false }: {
  plan: 'deck' | 'ace' | 'royal';
  className?: string;
  onBlock?: boolean;
}) {
  const { state, actions } = useStore();
  const [busy, setBusy] = useState(false);
  const member = state.member!;
  const info = tierById(plan);
  const [term, setTerm] = useState<Term>(defaultTerm(plan));

  if (PAYMENTS_LIVE) {
    const opt = priceOption(plan, term);
    const upgrading = isPaying(member);
    return (
      <div className="stack-8">
        <TermPicker tier={plan} value={term} onChange={setTerm} idPrefix="upgrade" onBlock={onBlock} />
        <button type="button" className={className} disabled={busy} onClick={async () => {
          setBusy(true);
          const err = await actions.startCheckout(plan, term);
          if (err) setBusy(false); // on success the page leaves for Stripe
        }}>
          {busy ? (upgrading ? 'Opening…' : 'Opening checkout…') : `${upgrading ? 'Upgrade to' : 'Join'} the ${info.name} · ${opt?.price ?? info.price}${opt?.per ?? info.per}`}
        </button>
      </div>
    );
  }

  const onList = !!member.requestedTier && TIER_RANK[member.requestedTier] >= TIER_RANK[plan];
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
