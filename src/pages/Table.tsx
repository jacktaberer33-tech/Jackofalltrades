import { useState, type FormEvent } from 'react';
import { SUITS, lessonById, suitById, type SuitId } from '../content';
import { useStore, type Post } from '../store';
import { Avatar, SuitMark } from '../components/Cards';
import { Icon } from '../components/Icon';
import { PageHeader, SuitFilter } from '../components/AppShell';
import { fmtDayMonth, fmtEventTime, nextFridayTable, timeAgo } from '../dates';

export function Table() {
  const { state, actions } = useStore();
  const member = state.member!;
  const [filter, setFilter] = useState<SuitId | 'all'>('all');
  const [text, setText] = useState('');
  const [tag, setTag] = useState<SuitId | null>(null);
  const friday = nextFridayTable(new Date());

  const pinned = state.posts.filter((p) => p.pinned);
  const feed = state.posts
    .filter((p) => !p.pinned)
    .filter((p) => filter === 'all' || p.suit === filter)
    .sort((a, b) => b.createdAt - a.createdAt);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    actions.addPost(text, tag);
    setText('');
    setTag(null);
  };

  return (
    <div className="stack-16">
      <PageHeader title="The Table" sub="Members only. Be honest. Be kind." />

      {member.tier === 'open' ? (
        <section className="card card--edge stack-10">
          <p className="strong">Pull up a chair with the Full Deck.</p>
          <p className="muted small">Open Hand members can read the Table. Posting is part of the Full Deck.</p>
          <button type="button" className="btn btn--accent btn--sm self-start" onClick={() => actions.setTier('deck')}>Switch to the Full Deck (demo)</button>
        </section>
      ) : (
        <form className="composer" onSubmit={submit}>
          <label htmlFor="table-post" className="label">Say the honest thing</label>
          <textarea id="table-post" className="input textarea" rows={2} placeholder="What's on your mind this week?" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="composer__foot">
            <div className="chips chips--small" role="group" aria-label="Tag a suit">
              {SUITS.map((s) => (
                <button key={s.id} type="button" className="chip chip--small" aria-pressed={tag === s.id} aria-label={`Tag ${s.name}`} onClick={() => setTag(tag === s.id ? null : s.id)}>
                  {s.symbol}
                </button>
              ))}
            </div>
            <button type="submit" className="btn btn--accent btn--sm" disabled={!text.trim()}>
              <Icon name="arrowUp" size={16} /> Post
            </button>
          </div>
        </form>
      )}

      {pinned.map((p) => (
        <article key={p.id} className="post post--pinned">
          <div className="post__head">
            <Avatar name={p.author} jack />
            <span className="strong">{p.author}</span>
            <span className="pill pill--accent push-right">Pinned</span>
          </div>
          <p className="post__text">{p.text}</p>
          <div className="row-between">
            <span className="mono small">{fmtDayMonth(friday)} · {fmtEventTime(friday)}</span>
            <button type="button" className="btn btn--light btn--xs" aria-pressed={state.fridayReminder} onClick={actions.toggleReminder}>
              {state.fridayReminder ? <><Icon name="check" size={14} /> You're going</> : "I'll be there"}
            </button>
          </div>
        </article>
      ))}

      <SuitFilter value={filter} onChange={setFilter} label="Filter posts by suit" />

      {feed.length === 0 && <p className="muted center pad-24">Nothing in this suit yet. Be the first to post.</p>}
      {feed.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const { state, actions } = useStore();
  const [confirming, setConfirming] = useState(false);
  const meeToo = state.meToo.includes(post.id);
  const count = post.meToo + (meeToo ? 1 : 0);
  const fromLesson = post.mirrorLessonId ? lessonById(post.mirrorLessonId) : undefined;

  return (
    <article className="post">
      <div className="post__head">
        <Avatar name={post.author} size={36} />
        <div className="stack-2">
          <span className="strong">{post.author}{post.mine && <span className="muted"> (you)</span>}</span>
          <span className="small muted">
            {post.suit && <><SuitMark suit={post.suit} /> {suitById(post.suit).name} · </>}
            {fromLesson && 'Mirror answer · '}
            {timeAgo(post.createdAt)}
          </span>
        </div>
      </div>
      {fromLesson && <p className="small muted post__q">On “{fromLesson.mirror}”</p>}
      <p className="post__text">{post.text}</p>
      <div className="post__actions">
        <button type="button" className="chip" aria-pressed={meeToo} onClick={() => actions.toggleMeToo(post.id)}>
          Me too · {count}
        </button>
        <span className="small muted">{post.replies === 1 ? '1 reply' : `${post.replies} replies`}</span>
        {post.mine && (
          confirming ? (
            <span className="push-right row-wrap">
              <button type="button" className="link-btn small" onClick={() => setConfirming(false)}>Keep</button>
              <button type="button" className="link-btn small accent-text" onClick={() => actions.removePost(post.id)}>Remove post</button>
            </span>
          ) : (
            <button type="button" className="link-btn small push-right" onClick={() => setConfirming(true)}>Remove</button>
          )
        )}
      </div>
    </article>
  );
}
