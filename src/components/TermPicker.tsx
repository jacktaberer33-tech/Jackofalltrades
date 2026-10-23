import { tierById, type Term, type Tier } from '../content';

/**
 * Monthly or upfront: a small radio list for plans with more than one way to pay.
 * Renders nothing for plans with a single price.
 */
export function TermPicker({ tier, value, onChange, idPrefix, onBlock = false }: {
  tier: Tier;
  value: Term;
  onChange: (term: Term) => void;
  /** Keeps radio ids unique when several pickers are on one page. */
  idPrefix: string;
  onBlock?: boolean;
}) {
  const info = tierById(tier);
  if (info.options.length < 2) return null;
  return (
    <fieldset className={`term-picker ${onBlock ? 'term-picker--on-block' : ''}`}>
      <legend className="sr-only">How to pay for {info.name}</legend>
      {info.options.map((o) => {
        const id = `${idPrefix}-${tier}-${o.term}`;
        return (
          <label key={o.term} htmlFor={id} className={`term-option ${value === o.term ? 'is-on' : ''}`}>
            <input type="radio" id={id} name={`${idPrefix}-${tier}`} value={o.term} checked={value === o.term} onChange={() => onChange(o.term)} />
            <span className="term-option__label">
              {o.label}
              {o.note && <span className="term-option__note">{o.note}</span>}
            </span>
            <span className="term-option__price">{o.price}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
