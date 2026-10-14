import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { SuitId, Tier } from './content';
import {
  supabase,
  friendlyError,
  type AdminMemberRow,
  type BookingRow,
  type PostRow,
  type ProfileRow,
  type ReplyRow,
} from './supabase';

// Everything the screens need lives here. The screens never talk to Supabase directly,
// so payments (Stripe) can be added later without touching them.

export interface Member {
  id: string;
  email: string;
  name: string;
  tier: Tier;
  requestedTier: Tier | null;
  isAdmin: boolean;
  joinedAt: number;
  /** Stripe subscription, when they pay for a plan. */
  billing: {
    hasAccount: boolean;
    status: string | null; // active, trialing, past_due, canceled…
    renewsOn: number | null;
    endsAtPeriodEnd: boolean;
  };
}

export interface MirrorEntry {
  lessonId: string;
  text: string;
  savedAt: number;
  shared: boolean;
}

export interface Post {
  id: string;
  authorId: string;
  author: string;
  fromJack: boolean;
  suit: SuitId | null;
  text: string;
  createdAt: number;
  pinned: boolean;
  mirrorLessonId: string | null;
  meToo: number;
  replies: number;
}

export interface Reply {
  id: string;
  postId: string;
  authorId: string;
  author: string;
  fromJack: boolean;
  text: string;
  createdAt: number;
}

export interface Booking {
  id: string;
  memberId: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:MM
  topic: string;
  bookedAt: number;
}

export interface Notice {
  id: number;
  kind: 'ok' | 'error';
  text: string;
}

export interface State {
  status: 'loading' | 'signedOut' | 'signedIn';
  recovering: boolean;
  member: Member | null;
  completed: string[];
  saved: string[];
  mirror: Record<string, MirrorEntry>;
  meToo: string[];
  bookings: Booking[];
  rsvps: string[];
  posts: Post[] | null;
  notice: Notice | null;
}

const EMPTY: Omit<State, 'status' | 'recovering' | 'notice'> = {
  member: null,
  completed: [],
  saved: [],
  mirror: {},
  meToo: [],
  bookings: [],
  rsvps: [],
  posts: null,
};

/** What the member's plan lets them see. Jack sees everything. */
export function effectiveTier(member: Member | null): Tier {
  if (!member) return 'open';
  return member.isAdmin ? 'ace' : member.tier;
}

export function canPost(member: Member | null): boolean {
  return !!member && (member.isAdmin || member.tier === 'deck' || member.tier === 'ace');
}

const toMember = (p: ProfileRow, email: string): Member => ({
  id: p.id,
  email,
  name: p.name,
  tier: p.tier,
  requestedTier: p.requested_tier,
  isAdmin: p.is_admin,
  joinedAt: Date.parse(p.created_at),
  billing: {
    hasAccount: !!p.stripe_customer_id,
    status: p.subscription_status,
    renewsOn: p.current_period_end ? Date.parse(p.current_period_end) : null,
    endsAtPeriodEnd: p.cancel_at_period_end,
  },
});

/** True while a member has a subscription Stripe is still charging (or retrying). */
export function isPaying(member: Member | null): boolean {
  return !!member && ['active', 'trialing', 'past_due'].includes(member.billing.status ?? '');
}

async function functionError(error: unknown): Promise<string> {
  // supabase.functions.invoke puts the response on error.context for non-2xx replies.
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = (await ctx.json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      // not JSON
    }
  }
  return friendlyError(error as { message?: string });
}

const toPost = (r: PostRow): Post => ({
  id: r.id,
  authorId: r.author_id,
  author: r.author_name,
  fromJack: r.from_jack,
  suit: (r.suit as SuitId | null) ?? null,
  text: r.body,
  createdAt: Date.parse(r.created_at),
  pinned: r.pinned,
  mirrorLessonId: r.mirror_lesson_id,
  meToo: r.post_me_too?.[0]?.count ?? 0,
  replies: r.post_replies?.[0]?.count ?? 0,
});

const toReply = (r: ReplyRow): Reply => ({
  id: r.id,
  postId: r.post_id,
  authorId: r.author_id,
  author: r.author_name,
  fromJack: r.from_jack,
  text: r.body,
  createdAt: Date.parse(r.created_at),
});

const toBooking = (r: BookingRow): Booking => ({
  id: r.id,
  memberId: r.member_id,
  date: r.slot_date,
  time: r.slot_time,
  topic: r.topic,
  bookedAt: Date.parse(r.created_at),
});

const POST_SELECT = '*, post_replies(count), post_me_too(count)';

type Err = string | null;

function useStoreValue() {
  const [state, setState] = useState<State>({ ...EMPTY, status: 'loading', recovering: false, notice: null });
  const userId = useRef<string | null>(null);
  // Always the latest state, for actions that need to know the current value before changing it.
  const stateRef = useRef(state);
  stateRef.current = state;
  const noticeTimer = useRef<number | undefined>(undefined);

  const notify = useCallback((kind: Notice['kind'], text: string) => {
    window.clearTimeout(noticeTimer.current);
    setState((s) => ({ ...s, notice: { id: Date.now(), kind, text } }));
    noticeTimer.current = window.setTimeout(() => setState((s) => ({ ...s, notice: null })), 4500);
  }, []);

  const fail = useCallback((err: { message?: string; code?: string } | null | undefined): string => {
    const text = friendlyError(err);
    notify('error', text);
    return text;
  }, [notify]);

  const loadPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return fail(error);
    setState((s) => ({ ...s, posts: (data as PostRow[]).map(toPost) }));
    return null;
  }, [fail]);

  const loadMember = useCallback(async (session: Session) => {
    const uid = session.user.id;
    const [profile, progress, saved, mirror, meToo, bookings, rsvps] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('progress').select('lesson_id'),
      supabase.from('saved_lessons').select('lesson_id'),
      supabase.from('mirror_answers').select('lesson_id, body, shared, updated_at'),
      supabase.from('post_me_too').select('post_id').eq('member_id', uid),
      supabase.from('bookings').select('*').eq('member_id', uid).order('slot_date'),
      supabase.from('event_rsvps').select('event_date').eq('member_id', uid),
    ]);
    if (profile.error || !profile.data) {
      fail(profile.error);
      setState((s) => ({ ...s, ...EMPTY, status: 'signedOut' }));
      return;
    }
    const mirrorMap: Record<string, MirrorEntry> = {};
    for (const m of (mirror.data ?? []) as { lesson_id: string; body: string; shared: boolean; updated_at: string }[]) {
      mirrorMap[m.lesson_id] = { lessonId: m.lesson_id, text: m.body, shared: m.shared, savedAt: Date.parse(m.updated_at) };
    }
    setState((s) => ({
      ...s,
      status: 'signedIn',
      member: toMember(profile.data as ProfileRow, session.user.email ?? ''),
      completed: ((progress.data ?? []) as { lesson_id: string }[]).map((r) => r.lesson_id),
      saved: ((saved.data ?? []) as { lesson_id: string }[]).map((r) => r.lesson_id),
      mirror: mirrorMap,
      meToo: ((meToo.data ?? []) as { post_id: string }[]).map((r) => r.post_id),
      bookings: ((bookings.data ?? []) as BookingRow[]).map(toBooking),
      rsvps: ((rsvps.data ?? []) as { event_date: string }[]).map((r) => r.event_date),
    }));
    void loadPosts();
  }, [fail, loadPosts]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setState((s) => ({ ...s, recovering: true }));
      // Supabase asks that no other Supabase calls run inside this callback, so defer.
      window.setTimeout(() => {
        if (!session) {
          userId.current = null;
          setState((s) => ({ ...s, ...EMPTY, status: 'signedOut' }));
          return;
        }
        if (userId.current === session.user.id) return; // token refresh, nothing new
        userId.current = session.user.id;
        void loadMember(session);
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [loadMember]);

  const uid = () => userId.current ?? '';

  const actions = useMemo(() => ({
    notify,

    // ---------- Account ----------
    async signUp(name: string, email: string, password: string, tier: Tier): Promise<{ error: Err; needsConfirm: boolean }> {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: name.trim(), requested_tier: tier }, emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) return { error: friendlyError(error), needsConfirm: false };
      return { error: null, needsConfirm: !data.session };
    },
    async signIn(email: string, password: string): Promise<Err> {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return error ? friendlyError(error) : null;
    },
    async sendReset(email: string): Promise<Err> {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/` });
      return error ? friendlyError(error) : null;
    },
    async setNewPassword(password: string): Promise<Err> {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return friendlyError(error);
      setState((s) => ({ ...s, recovering: false }));
      notify('ok', 'Password changed.');
      return null;
    },
    finishRecovery() {
      setState((s) => ({ ...s, recovering: false }));
    },
    async signOut() {
      await supabase.auth.signOut();
    },
    async deleteAccount(): Promise<Err> {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) return fail(error);
      await supabase.auth.signOut();
      return null;
    },
    async requestTier(tier: Tier): Promise<Err> {
      const { error } = await supabase.from('profiles').update({ requested_tier: tier }).eq('id', uid());
      if (error) return fail(error);
      setState((s) => (s.member ? { ...s, member: { ...s.member, requestedTier: tier } } : s));
      return null;
    },
    async rename(name: string): Promise<Err> {
      const { error } = await supabase.from('profiles').update({ name: name.trim() }).eq('id', uid());
      if (error) return fail(error);
      setState((s) => (s.member ? { ...s, member: { ...s.member, name: name.trim() } } : s));
      return null;
    },

    async refreshProfile(): Promise<Member | null> {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid()).single();
      if (error || !data) return null;
      const member = toMember(data as ProfileRow, auth.user?.email ?? stateRef.current.member?.email ?? '');
      setState((s) => ({ ...s, member }));
      return member;
    },
    /** Sends the member to Stripe Checkout (or the billing portal if they already pay). */
    async startCheckout(plan: 'deck' | 'ace'): Promise<Err> {
      const { data, error } = await supabase.functions.invoke('create-checkout', { body: { plan } });
      if (error || !data?.url) {
        const text = error ? await functionError(error) : 'Checkout did not start. Try again.';
        notify('error', text);
        return text;
      }
      window.location.assign(data.url as string);
      return null;
    },
    async openBilling(): Promise<Err> {
      const { data, error } = await supabase.functions.invoke('billing-portal', { body: {} });
      if (error || !data?.url) {
        const text = error ? await functionError(error) : 'Billing did not open. Try again.';
        notify('error', text);
        return text;
      }
      window.location.assign(data.url as string);
      return null;
    },

    // ---------- Lessons ----------
    async toggleComplete(lessonId: string) {
      const wasDone = stateRef.current.completed.includes(lessonId);
      setState((s) => ({ ...s, completed: wasDone ? s.completed.filter((x) => x !== lessonId) : [...s.completed, lessonId] }));
      const { error } = wasDone
        ? await supabase.from('progress').delete().eq('member_id', uid()).eq('lesson_id', lessonId)
        : await supabase.from('progress').insert({ lesson_id: lessonId });
      if (error) {
        setState((s) => ({ ...s, completed: wasDone ? [...s.completed, lessonId] : s.completed.filter((x) => x !== lessonId) }));
        fail(error);
      }
    },
    async toggleSaved(lessonId: string) {
      const was = stateRef.current.saved.includes(lessonId);
      setState((s) => ({ ...s, saved: was ? s.saved.filter((x) => x !== lessonId) : [...s.saved, lessonId] }));
      const { error } = was
        ? await supabase.from('saved_lessons').delete().eq('member_id', uid()).eq('lesson_id', lessonId)
        : await supabase.from('saved_lessons').insert({ lesson_id: lessonId });
      if (error) {
        setState((s) => ({ ...s, saved: was ? [...s.saved, lessonId] : s.saved.filter((x) => x !== lessonId) }));
        fail(error);
      }
    },
    async saveMirror(lessonId: string, text: string, shared?: boolean): Promise<Err> {
      const body = text.trim();
      const prev = stateRef.current.mirror[lessonId];
      const isShared = shared ?? prev?.shared ?? false;
      const { error } = await supabase
        .from('mirror_answers')
        .upsert({ member_id: uid(), lesson_id: lessonId, body, shared: isShared, updated_at: new Date().toISOString() });
      if (error) return fail(error);
      setState((s) => ({ ...s, mirror: { ...s.mirror, [lessonId]: { lessonId, text: body, shared: isShared, savedAt: Date.now() } } }));
      return null;
    },
    async shareMirror(lessonId: string, suit: SuitId, text: string): Promise<Err> {
      const err = await actions.saveMirror(lessonId, text, true);
      if (err) return err;
      return actions.addPost(text, suit, false, lessonId);
    },

    // ---------- The Table ----------
    loadPosts,
    async addPost(text: string, suit: SuitId | null, pinned = false, mirrorLessonId: string | null = null): Promise<Err> {
      const { data, error } = await supabase
        .from('posts')
        .insert({ body: text.trim(), suit, pinned, mirror_lesson_id: mirrorLessonId })
        .select(POST_SELECT)
        .single();
      if (error) return fail(error);
      const post = toPost(data as PostRow);
      setState((s) => ({ ...s, posts: [post, ...(s.posts ?? [])].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt) }));
      return null;
    },
    async removePost(id: string): Promise<Err> {
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (error) return fail(error);
      setState((s) => ({ ...s, posts: (s.posts ?? []).filter((p) => p.id !== id) }));
      return null;
    },
    async setPinned(id: string, pinned: boolean): Promise<Err> {
      const { error } = await supabase.from('posts').update({ pinned }).eq('id', id);
      if (error) return fail(error);
      setState((s) => ({
        ...s,
        posts: (s.posts ?? [])
          .map((p) => (p.id === id ? { ...p, pinned } : p))
          .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt),
      }));
      return null;
    },
    async toggleMeToo(postId: string) {
      const was = stateRef.current.meToo.includes(postId);
      const bump = (s: State, on: boolean): State => ({
        ...s,
        meToo: on ? [...s.meToo, postId] : s.meToo.filter((x) => x !== postId),
        posts: (s.posts ?? []).map((p) => (p.id === postId ? { ...p, meToo: Math.max(0, p.meToo + (on ? 1 : -1)) } : p)),
      });
      setState((s) => bump(s, !was));
      const { error } = was
        ? await supabase.from('post_me_too').delete().eq('post_id', postId).eq('member_id', uid())
        : await supabase.from('post_me_too').insert({ post_id: postId });
      if (error) {
        setState((s) => bump(s, was));
        fail(error);
      }
    },
    async loadReplies(postId: string): Promise<Reply[] | null> {
      const { data, error } = await supabase.from('post_replies').select('*').eq('post_id', postId).order('created_at');
      if (error) {
        fail(error);
        return null;
      }
      return (data as ReplyRow[]).map(toReply);
    },
    async addReply(postId: string, text: string): Promise<Reply | null> {
      const { data, error } = await supabase.from('post_replies').insert({ post_id: postId, body: text.trim() }).select('*').single();
      if (error) {
        fail(error);
        return null;
      }
      setState((s) => ({ ...s, posts: (s.posts ?? []).map((p) => (p.id === postId ? { ...p, replies: p.replies + 1 } : p)) }));
      return toReply(data as ReplyRow);
    },
    async removeReply(reply: Reply): Promise<Err> {
      const { error } = await supabase.from('post_replies').delete().eq('id', reply.id);
      if (error) return fail(error);
      setState((s) => ({ ...s, posts: (s.posts ?? []).map((p) => (p.id === reply.postId ? { ...p, replies: Math.max(0, p.replies - 1) } : p)) }));
      return null;
    },

    // ---------- Friday Table ----------
    async toggleRsvp(eventDate: string) {
      const was = stateRef.current.rsvps.includes(eventDate);
      setState((s) => ({ ...s, rsvps: was ? s.rsvps.filter((d) => d !== eventDate) : [...s.rsvps, eventDate] }));
      const { error } = was
        ? await supabase.from('event_rsvps').delete().eq('event_date', eventDate).eq('member_id', uid())
        : await supabase.from('event_rsvps').insert({ event_date: eventDate });
      if (error) {
        setState((s) => ({ ...s, rsvps: was ? [...s.rsvps, eventDate] : s.rsvps.filter((d) => d !== eventDate) }));
        fail(error);
      }
    },
    async rsvpCount(eventDate: string): Promise<number | null> {
      const { data, error } = await supabase.rpc('rsvp_count', { p_event_date: eventDate });
      return error ? null : (data as number);
    },

    // ---------- 1:1 calls ----------
    async takenSlots(from: string, to: string): Promise<{ date: string; time: string }[]> {
      const { data, error } = await supabase.rpc('taken_slots', { from_date: from, to_date: to });
      if (error) {
        fail(error);
        return [];
      }
      return (data as { slot_date: string; slot_time: string }[]).map((r) => ({ date: r.slot_date, time: r.slot_time }));
    },
    async book(date: string, time: string, topic: string): Promise<Err> {
      const { data, error } = await supabase
        .from('bookings')
        .insert({ slot_date: date, slot_time: time, topic: topic.trim() })
        .select('*')
        .single();
      if (error) return fail(error);
      setState((s) => ({ ...s, bookings: [...s.bookings, toBooking(data as BookingRow)].sort((a, b) => a.date.localeCompare(b.date)) }));
      return null;
    },
    async moveBooking(id: string, date: string, time: string, topic: string): Promise<Err> {
      const { data, error } = await supabase
        .from('bookings')
        .update({ slot_date: date, slot_time: time, topic: topic.trim() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) return fail(error);
      const updated = toBooking(data as BookingRow);
      setState((s) => ({ ...s, bookings: s.bookings.map((b) => (b.id === id ? updated : b)) }));
      return null;
    },
    async cancelBooking(id: string): Promise<Err> {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) return fail(error);
      setState((s) => ({ ...s, bookings: s.bookings.filter((b) => b.id !== id) }));
      return null;
    },

    // ---------- Jack's tools ----------
    async adminMembers(): Promise<AdminMemberRow[] | null> {
      const { data, error } = await supabase.rpc('admin_members');
      if (error) {
        fail(error);
        return null;
      }
      return data as AdminMemberRow[];
    },
    async setMemberTier(memberId: string, tier: Tier): Promise<Err> {
      const { error } = await supabase.rpc('set_member_tier', { p_member: memberId, p_tier: tier });
      if (error) return fail(error);
      if (memberId === uid()) setState((s) => (s.member ? { ...s, member: { ...s.member, tier } } : s));
      return null;
    },
    async adminUpcomingCalls(fromDate: string): Promise<Booking[] | null> {
      const { data, error } = await supabase.from('bookings').select('*').gte('slot_date', fromDate).order('slot_date').order('slot_time');
      if (error) {
        fail(error);
        return null;
      }
      return (data as BookingRow[]).map(toBooking);
    },
  }), [notify, fail, loadPosts]);

  return { state, actions };
}

export type Actions = ReturnType<typeof useStoreValue>['actions'];

const StoreContext = createContext<{ state: State; actions: Actions } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue();
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
