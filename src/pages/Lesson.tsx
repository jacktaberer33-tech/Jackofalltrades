import { useEffect, useState } from 'react';
import { canWatch, lessonById, nextLesson, rankName, seriesById, suitById, tierById, unlockedBy, type Lesson as LessonInfo } from '../content';
import { canPost, effectiveTier, useStore, type LessonVideo } from '../store';
import { Link, useRouter } from '../router';
import { Icon } from '../components/Icon';
import { PlanAction } from '../components/PlanAction';

export function Lesson({ id }: { id: string }) {
  const { state, actions } = useStore();
  const { navigate } = useRouter();
  const lesson = lessonById(id);
  const saved = lesson ? state.mirror[lesson.id] : undefined;
  const [draft, setDraft] = useState(saved?.text ?? '');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Jack can watch (and attach videos to) every lesson, Jokers included.
  const unlocked = !!lesson && !!state.member && (state.member.isAdmin || canWatch(effectiveTier(state.member), lesson));
  const [video, setVideo] = useState<LessonVideo | null>(null); // null while loading
  const [videoKey, setVideoKey] = useState(0); // bumped to reload after Jack attaches a video

  useEffect(() => {
    if (!unlocked) return;
    let live = true;
    setVideo(null);
    void actions.lessonVideo(id).then((v) => { if (live) setVideo(v); });
    return () => { live = false; };
  }, [unlocked, id, actions, videoKey]);

  if (!lesson) {
    return (
      <div className="stack-16">
        <h1 className="display-l">Lesson not found</h1>
        <p className="muted">That lesson may have moved. Find it in the Deck.</p>
        <Link to="/deck" className="btn btn--outline self-start">Back to the Deck</Link>
      </div>
    );
  }

  const member = state.member!;
  const series = seriesById(lesson.seriesId)!;
  const suit = suitById(lesson.suit);
  const needs = unlockedBy(lesson);
  const plan = needs === 'open' ? 'deck' : needs;
  const pitch = {
    deck: ['This lesson is part of the Full Deck.', 'Open Hand gets one free lesson in every suit. The Full Deck unlocks the first five cards of every suit (Ace to 5), plus the Mirror and the Table.'],
    ace: ['This lesson is part of Ace.', 'Ace unlocks the whole deck, every card from Ace to King in all four suits, plus a 45-minute 1:1 call with me every month.'],
    royal: ['This is a Joker lesson, only for Royal Flush.', 'Royal Flush gets two Joker lessons in every suit, plus a 1:1 call with me every week. There are five places.'],
  }[plan];
  const complete = state.completed.includes(lesson.id);
  const bookmarked = state.saved.includes(lesson.id);
  const next = nextLesson(lesson);
  const hasText = draft.trim().length > 0;

  const savePrivately = async () => {
    setBusy(true);
    const err = await actions.saveMirror(lesson.id, draft);
    setBusy(false);
    if (!err) setNotice('Saved. Only you can see this.');
  };

  const share = async () => {
    setBusy(true);
    const err = await actions.shareMirror(lesson.id, lesson.suit, draft);
    setBusy(false);
    if (!err) navigate('/table');
  };

  return (
    <div className="stack-16">
      <div className="lesson-bar">
        <Link to="/deck" className="icon-btn" aria-label="Back to the Deck"><Icon name="chevronLeft" /></Link>
        <span className="eyebrow center">
          {suit.symbol} {series.joker ? `${suit.name} Joker` : `${rankName(series.rank)} of ${suit.name}`} · {series.title}
        </span>
        <button type="button" className="icon-btn" aria-label={bookmarked ? 'Remove from saved' : 'Save lesson'} aria-pressed={bookmarked} onClick={() => actions.toggleSaved(lesson.id)}>
          <Icon name="bookmark" filled={bookmarked} />
        </button>
      </div>

      <div className="video">
        {!unlocked ? (
          <div className="video__locked">
            <Icon name="lock" size={28} />
            <span>{lesson.joker ? 'Royal Flush Joker' : `${tierById(plan).name} lesson`}</span>
          </div>
        ) : video === null ? (
          <div className="video__locked" role="status"><span>Loading the lesson…</span></div>
        ) : video.status === 'ready' ? (
          <iframe
            className="video__player"
            src={video.url}
            title={`Lesson video: ${lesson.title}`}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : video.status === 'none' ? (
          <div className="video__locked">
            <Icon name="video" size={28} />
            <span>Video coming soon</span>
          </div>
        ) : (
          <div className="video__locked" role="alert">
            <span>{video.message}</span>
            <button type="button" className="btn btn--outline btn--sm video__retry" onClick={() => setVideoKey((k) => k + 1)}>Try again</button>
          </div>
        )}
      </div>

      {member.isAdmin && (
        <VideoAdmin
          lesson={lesson}
          attached={video?.status === 'ready' ? video.videoId : null}
          onSaved={() => setVideoKey((k) => k + 1)}
        />
      )}

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
              maxLength={4000}
              placeholder="No need to tidy it up."
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setNotice(null); }}
            />
            <p className="small muted" role="status">
              {notice ?? (saved ? (saved.shared ? 'You shared this answer with the Table.' : 'Saved privately. Only you can see this.') : 'Only you can see this unless you choose to share it.')}
            </p>
            <div className={canPost(member) ? 'grid-2' : 'stack-8'}>
              <button type="button" className="btn btn--ink" disabled={!hasText || busy} onClick={savePrivately}>Save privately</button>
              {canPost(member) && (
                <button type="button" className="btn btn--outline" disabled={!hasText || busy} onClick={share}>Share to the Table</button>
              )}
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
          <p className="strong">{pitch[0]}</p>
          <p className="muted">{pitch[1]}</p>
          <PlanAction plan={plan} />
        </section>
      )}
    </div>
  );
}

const BUNNY_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Jack only: attach this lesson's Bunny Stream video. Paste the video's ID, or any Bunny link or embed
 * code that contains it. The plan it needs is taken from the deck, so members only get what they pay for.
 */
function VideoAdmin({ lesson, attached, onSaved }: { lesson: LessonInfo; attached: string | null; onSaved: () => void }) {
  const { actions } = useStore();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const found = text.match(BUNNY_ID)?.[0].toLowerCase() ?? null;
  const plan = unlockedBy(lesson);

  const save = async (videoId: string | null) => {
    setBusy(true);
    const err = await actions.setLessonVideo(lesson.id, videoId, plan);
    setBusy(false);
    if (!err) {
      setText('');
      onSaved();
    }
  };

  return (
    <details className="card admin-box" open={!attached}>
      <summary className="admin-box__summary">
        <span className="eyebrow">Lesson video · only you see this</span>
        <span className="small muted">{attached ? 'Attached' : 'No video yet'}</span>
      </summary>
      <div className="stack-10">
        <p className="small muted">
          Watchable by {plan === 'open' ? 'everyone, free (the free lesson in this suit)' : `${tierById(plan).name} and above`}.
          {attached && <> Bunny video <span className="mono">{attached}</span>.</>}
        </p>
        <label htmlFor={`bunny-${lesson.id}`} className="label">{attached ? 'Replace with another Bunny video' : 'Bunny video ID'}</label>
        <input
          id={`bunny-${lesson.id}`}
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
