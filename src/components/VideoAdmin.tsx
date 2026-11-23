import { useState } from 'react';
import { tierById, type Tier } from '../content';
import { useStore } from '../store';

const BUNNY_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Jack only: attach a Bunny Stream video to a lesson (or to the Table's welcome video). Paste the video's
 * ID, or any Bunny link or embed code that contains it. `plan` is the cheapest plan that may watch it, so
 * members only get what they pay for.
 */
export function VideoAdmin({ id, plan, label, attached, onSaved }: { id: string; plan: Tier; label: string; attached: string | null; onSaved: () => void }) {
  const { actions } = useStore();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const found = text.match(BUNNY_ID)?.[0].toLowerCase() ?? null;

  const save = async (videoId: string | null) => {
    setBusy(true);
    const err = await actions.setLessonVideo(id, videoId, plan);
    setBusy(false);
    if (!err) {
      setText('');
      onSaved();
    }
  };

  return (
    <details className="card admin-box" open={!attached}>
      <summary className="admin-box__summary">
        <span className="eyebrow">{label} · only you see this</span>
        <span className="small muted">{attached ? 'Attached' : 'No video yet'}</span>
      </summary>
      <div className="stack-10">
        <p className="small muted">
          Watchable by {plan === 'open' ? 'everyone, free (the one Open Hand lesson)' : `${tierById(plan).name} and above`}.
          {attached && <> Bunny video <span className="mono">{attached}</span>.</>}
        </p>
        <label htmlFor={`bunny-${id}`} className="label">{attached ? 'Replace with another Bunny video' : 'Bunny video ID'}</label>
        <input
          id={`bunny-${id}`}
          className="input"
          placeholder="Paste the video ID or its embed link"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        {text && !found && <p className="small" role="alert">That doesn't contain a Bunny video ID. It looks like 1a2b3c4d-…</p>}
        <div className="row-wrap">
          <button type="button" className="btn btn--ink btn--sm" disabled={!found || busy} onClick={() => save(found)}>
            {attached ? 'Replace video' : 'Attach video'}
          </button>
          {attached && (
            <button type="button" className="btn btn--outline btn--sm" disabled={busy} onClick={() => save(null)}>Remove video</button>
          )}
        </div>
      </div>
    </details>
  );
}
