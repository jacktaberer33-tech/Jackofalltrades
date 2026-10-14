import { useEffect, useState, type FormEvent } from 'react';
import { SUITS, lessonById, suitById, type SuitId } from '../content';
import { canPost, useStore, type Post, type Reply } from '../store';
import { Avatar, SuitMark } from '../components/Cards';
import { Icon } from '../components/Icon';
import { PageHeader, SuitFilter } from '../components/AppShell';
import { PlanAction } from '../components/PlanAction';
import { timeAgo } from '../dates';

export function Table() {
  const { state, actions } = useStore();
  const member = state.member!;
  const [filter, setFilter] = useState<SuitId | 'all'>('all');
  const [text, setText] = useState('');
  const [tag, setTag] = useState<SuitId | null>(null);
  const [pin, setPin] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void actions.loadPosts();
  }, [actions]);

  const posts = state.posts;
  const pinned = (posts ?? []).filter((p) => p.pinned);
  const feed = (posts ?? []).filter((p) => !p.pinned).filter((p) => filter === 'all' || p.suit === filter);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const err = await actions.addPost(text, tag, member.isAdmin && pin);
    setBusy(false);
    if (!err) {
      setText('');
      setTag(null);
      setPin(false);
    }
  };

  return (
    <div className="stack-16">
      <PageHeader title="The Table" sub="Members only. Be honest. Be kind." />

      {canPost(member) ? (
        <form className="composer" onSubmit={submit}>
          <label htmlFor="table-post" className="label">Say the honest thing</label>
          <textarea id="table-post" className="input textarea" rows={2} maxLength={2000} placeholder="What's on your mind this week?" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="composer__foot">
            <div className="chips chips--small" role="group" aria-label="Tag a suit">
              {SUITS.map((s) => (
                <button key={s.id} type="button" className="chip chip--small" aria-pressed={tag === s.id} aria-label={`Tag ${s.name}`} onClick={() => setTag(tag === s.id ? null : s.id)}>
                  {s.symbol}
                </button>
              ))}
            </div>
            <div className="row-wrap">
              {member.isAdmin && (
                <label className="check small">
                  <input type="checkbox" id="table-pin" checked={pin} onChange={(e) => setPin(e.target.checked)} />
                  Pin to the top
                </label>
              )}
              <button type="submit" className="btn btn--accent btn--sm" disabled={!text.trim() || busy}>
                <Icon name="arrowUp" size={16} /> Post
              </button>
            </div>
          </div>
        </form>
      ) : (
        <section className="card card--edge stack-10">
          <p className="strong">Pull up a chair with the Full Deck.</p>
          <p className="muted small">On Open Hand you can read the Table. Posting, replying and "me too" come with the Full Deck.</p>
          <PlanAction plan="deck" />
        </section>
      )}

      {pinned.map((p) => <PostCard key={p.id} post={p} />)}

      <SuitFilter value={filter} onChange={setFilter} label="Filter posts by suit" />

      {posts === null && <p className="muted center pad-24">Loading the Table…</p>}
      {posts !== null && feed.length === 0 && (
        <p className="muted center pad-24">
          {filter === 'all' ? 'Nobody has posted yet. Be the first to say the honest thing.' : 'Nothing in this suit yet.'}
        </p>
      )}
      {feed.map((p) => <PostCard key={p.id} post={p} />)}
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const { state, actions } = useStore();
  const member = state.member!;
  const [confirming, setConfirming] = useState(false);
  const [open, setOpen] = useState(false);
  const meToo = state.meToo.includes(post.id);
  const mine = post.authorId === member.id;
  const fromLesson = post.mirrorLessonId ? lessonById(post.mirrorLessonId) : undefined;
  const dark = post.pinned;

  return (
    <article className={`post ${dark ? 'post--pinned' : ''}`}>
      <div className="post__head">
        <Avatar name={post.author} size={36} jack={post.fromJack} />
        <div className="stack-2 grow">
          <span className="strong">{post.author}{mine && <span className={dark ? 'on-block-muted' : 'muted'}> (you)</span>}</span>
          <span className={`small ${dark ? 'on-block-muted' : 'muted'}`}>
            {post.suit && <><SuitMark suit={post.suit} /> {suitById(post.suit).name} · </>}
            {fromLesson && 'Mirror answer · '}
            {timeAgo(post.createdAt)}
          </span>
        </div>
        {post.pinned && <span className="pill pill--accent">Pinned</span>}
      </div>
      {fromLesson && <p className={`small post__q ${dark ? 'on-block-muted' : 'muted'}`}>On “{fromLesson.mirror}”</p>}
      <p className="post__text">{post.text}</p>
      <div className="post__actions">
        {canPost(member) ? (
          <button type="button" className={`chip ${dark ? 'chip--on-block' : ''}`} aria-pressed={meToo} onClick={() => actions.toggleMeToo(post.id)}>
            Me too · {post.meToo}
          </button>
        ) : (
          <span className={`small ${dark ? 'on-block-muted' : 'muted'}`}>Me too · {post.meToo}</span>
        )}
        <button type="button" className={`chip ${dark ? 'chip--on-block' : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {post.replies === 0 ? 'Reply' : post.replies === 1 ? '1 reply' : `${post.replies} replies`}
        </button>
        <span className="push-right row-wrap">
          {member.isAdmin && (
            <button type="button" className="link-btn small" onClick={() => actions.setPinned(post.id, !post.pinned)}>
              {post.pinned ? 'Unpin' : 'Pin'}
            </button>
          )}
          {(mine || member.isAdmin) && (
            confirming ? (
              <>
                <button type="button" className="link-btn small" onClick={() => setConfirming(false)}>Keep</button>
                <button type="button" className="link-btn small accent-text" onClick={() => actions.removePost(post.id)}>Remove post</button>
              </>
            ) : (
              <button type="button" className="link-btn small" onClick={() => setConfirming(true)}>Remove</button>
            )
          )}
        </span>
      </div>
      {open && <Replies post={post} dark={dark} />}
    </article>
  );
}

function Replies({ post, dark }: { post: Post; dark: boolean }) {
  const { state, actions } = useStore();
  const member = state.member!;
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const inputId = `reply-${post.id}`;

  useEffect(() => {
    let live = true;
    actions.loadReplies(post.id).then((r) => live && setReplies(r ?? []));
    return () => { live = false; };
  }, [actions, post.id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const r = await actions.addReply(post.id, text);
    setBusy(false);
    if (r) {
      setReplies((list) => [...(list ?? []), r]);
      setText('');
    }
  };

  const remove = async (r: Reply) => {
    const err = await actions.removeReply(r);
    if (!err) setReplies((list) => (list ?? []).filter((x) => x.id !== r.id));
  };

  return (
    <div className={`replies ${dark ? 'replies--on-block' : ''}`}>
      {replies === null && <p className="small muted">Loading replies…</p>}
      {replies?.map((r) => (
        <div key={r.id} className="reply">
          <Avatar name={r.author} size={28} jack={r.fromJack} />
          <div className="grow stack-2">
            <span className="small"><strong>{r.author}</strong> <span className={dark ? 'on-block-muted' : 'muted'}>· {timeAgo(r.createdAt)}</span></span>
            <p className="reply__text">{r.text}</p>
          </div>
          {(r.authorId === member.id || member.isAdmin) && (
            <button type="button" className="link-btn small" aria-label={`Remove reply from ${r.author}`} onClick={() => remove(r)}>Remove</button>
          )}
        </div>
      ))}
      {canPost(member) && (
        <form className="reply-form" onSubmit={submit}>
          <label htmlFor={inputId} className="sr-only">Write a reply</label>
          <input id={inputId} className="input" maxLength={1000} placeholder="Write a reply" value={text} onChange={(e) => setText(e.target.value)} />
          <button type="submit" className="btn btn--accent btn--sm" disabled={!text.trim() || busy}>Reply</button>
        </form>
      )}
    </div>
  );
}
