import { useState } from 'react';
import { canWatch, lessonById, nextLesson, seriesById, suitById } from '../content';
import { useStore } from '../store';
import { Link, useRouter } from '../router';
import { Icon, PlayGlyph } from '../components/Icon';

export function Lesson({ id }: { id: string }) {
  const { state, actions } = useStore();
  const { navigate } = useRouter();
  const lesson = lessonById(id);
  const saved = lesson ? state.mirror[lesson.id] : undefined;
  const [draft, setDraft] = useState(saved?.text ?? '');
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!lesson) {
    return (
      <div className="stack-16">
        <h1 className="display-l">Lesson not found</h1>
        <p className="muted">That lesson may have moved. Find it in the Deck.</p>
        <Link to="/deck" className="btn btn--outline self-start">Back to the Deck</Link>
      </div>
    );
  }

  const series = seriesById(lesson.seriesId)!;
  const suit = suitById(lesson.suit);
  const tier = state.member!.tier;
  const unlocked = canWatch(tier, lesson);
  const complete = state.completed.includes(lesson.id);
  const bookmarked = state.saved.includes(lesson.id);
  const next = nextLesson(lesson);
  const hasText = draft.trim().length > 0;

  const savePrivately = () => {
    actions.saveMirror(lesson.id, draft);
    setNotice('Saved. Only you can see this.');
  };

  const share = () => {
    actions.shareMirror(lesson.id, lesson.suit, draft);
    navigate('/table');
  };

  return (
    <div className="stack-16">
      <div className="lesson-bar">
        <Link to="/deck" className="icon-btn" aria-label="Back to the Deck"><Icon name="chevronLeft" /></Link>
        <span className="eyebrow center">{suit.symbol} {suit.name} · {series.title}</span>
        <button type="button" className="icon-btn" aria-label={bookmarked ? 'Remove from saved' : 'Save lesson'} aria-pressed={bookmarked} onClick={() => actions.toggleSaved(lesson.id)}>
          <Icon name="bookmark" filled={bookmarked} />
        </button>
      </div>

      <div className="video">
        {unlocked ? (
          <>
            <button type="button" className="video__play" aria-label={playing ? 'Pause lesson' : 'Play lesson'} onClick={() => setPlaying((p) => !p)}>
              {playing ? <span className="pause-glyph" aria-hidden="true" /> : <PlayGlyph size={24} />}
            </button>
            <span className="video__label">{playing ? 'The lesson video plays here once it is uploaded' : '[Lesson video]'}</span>
            <span className="video__time">{lesson.minutes}:00</span>
          </>
        ) : (
          <div className="video__locked">
            <Icon name="lock" size={28} />
            <span>Full Deck lesson</span>
          </div>
        )}
      </div>

      <div className="stack-8">
        <p className="eyebrow">Part {lesson.number} of {series.lessons.length} · {lesson.minutes} min</p>
        <h1 className="display-l">{lesson.title}</h1>
        <p className="body-l">{lesson.summary}</p>
      </div>

      {unlocked ? (
        <>
          <section className="card card--edge stack-10" aria-labelledby="mirror-title">
            <p id="mirror-title" className="eyebrow accent-text strong">The Mirror</p>
            <p className="mirror-q">{lesson.mirror}</p>
            <label htmlFor={`mirror-${lesson.id}`} className="label">Your answer</label>
            <textarea
              id={`mirror-${lesson.id}`}
              className="input textarea"
              rows={4}
              placeholder="No need to tidy it up."
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setNotice(null); }}
            />
            <p className="small muted" role="status">
              {notice ?? (saved ? (saved.shared ? 'You shared this answer with the Table.' : 'Saved privately. Only you can see this.') : 'Only you can see this unless you choose to share it.')}
            </p>
            <div className="grid-2">
              <button type="button" className="btn btn--ink" disabled={!hasText} onClick={savePrivately}>Save privately</button>
              <button type="button" className="btn btn--outline" disabled={!hasText} onClick={share}>Share to the Table</button>
            </div>
          </section>

          <div className="row-wrap">
            <button type="button" className={`btn ${complete ? 'btn--outline' : 'btn--accent'}`} aria-pressed={complete} onClick={() => actions.toggleComplete(lesson.id)}>
              <Icon name="check" size={18} />
              {complete ? 'Finished' : 'Mark as finished'}
            </button>
            {next && (
              <Link to={`/lesson/${next.id}`} className="btn btn--outline">
                Next: {next.title}
                <Icon name="chevronRight" size={18} />
              </Link>
            )}
          </div>
        </>
      ) : (
        <section className="card card--edge stack-12">
          <p className="strong">This lesson is part of the Full Deck.</p>
          <p className="muted">You get the first lesson of every suit free. The Full Deck unlocks every lesson, the Mirror and the Table.</p>
          <button type="button" className="btn btn--accent self-start" onClick={() => actions.setTier('deck')}>Switch to the Full Deck (demo)</button>
        </section>
      )}
    </div>
  );
}
