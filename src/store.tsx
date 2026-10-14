import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SuitId, Tier } from './content';

// Everything a member does is kept in one state object and saved to this browser.
// When the real backend arrives (accounts, payments, shared posts), this file is the
// only one that needs to change: the screens call the same actions.

export interface Member {
  name: string;
  tier: Tier;
  joinedAt: number;
}

export interface MirrorEntry {
  lessonId: string;
  text: string;
  savedAt: number;
  shared: boolean;
}

export interface Post {
  id: string;
  author: string;
  suit: SuitId | null;
  text: string;
  createdAt: number;
  meToo: number;
  replies: number;
  pinned?: boolean;
  fromJack?: boolean;
  mine?: boolean;
  mirrorLessonId?: string;
}

export interface Booking {
  date: string; // yyyy-mm-dd
  time: string; // HH:MM
  topic: string;
  bookedAt: number;
}

export interface State {
  member: Member | null;
  completed: string[];
  saved: string[];
  mirror: Record<string, MirrorEntry>;
  posts: Post[];
  meToo: string[];
  booking: Booking | null;
  fridayReminder: boolean;
}

const STORAGE_KEY = 'joat-demo-v1';
const HOUR = 60 * 60 * 1000;

function seedPosts(now: number): Post[] {
  return [
    { id: 'jack-pinned', author: 'Jack', suit: null, fromJack: true, pinned: true, text: "Friday Table is on this month. Bring one thing you've been putting off and we'll talk it through, live.", createdAt: now - 26 * HOUR, meToo: 0, replies: 12 },
    { id: 'seed-maya', author: 'Maya', suit: 'clubs', mirrorLessonId: 'clubs-seek-discomfort-2', text: "Honestly? I've been calling it rest when it's really just avoiding the pool. Going Thursday. Someone check on me.", createdAt: now - 2 * HOUR, meToo: 14, replies: 3 },
    { id: 'seed-dan', author: 'Dan', suit: 'diamonds', text: "Put my prices up for the first time in three years after the charging what you're worth series. Nobody walked.", createdAt: now - 5 * HOUR, meToo: 9, replies: 5 },
    { id: 'seed-priya', author: 'Priya', suit: 'hearts', text: "Had the conversation I'd been rehearsing for about six months. It took four minutes.", createdAt: now - 30 * HOUR, meToo: 21, replies: 7 },
    { id: 'seed-tom', author: 'Tom', suit: 'spades', text: "Shipped the ugly version. Two people used it. That's two more than last week.", createdAt: now - 52 * HOUR, meToo: 11, replies: 2 },
  ];
}

function emptyState(now = Date.now()): State {
  return { member: null, completed: [], saved: [], mirror: {}, posts: seedPosts(now), meToo: [], booking: null, fridayReminder: false };
}

/** The account behind "Sign in": a Full Deck member a few weeks in. */
function demoMemberState(now = Date.now()): State {
  return {
    ...emptyState(now),
    member: { name: 'Alex', tier: 'deck', joinedAt: now - 40 * 24 * HOUR },
    completed: [
      'clubs-seek-discomfort-1',
      'spades-safe-path-1', 'spades-safe-path-2', 'spades-safe-path-3', 'spades-safe-path-4',
      'spades-own-thing-1',
      'diamonds-worth-1', 'diamonds-worth-2', 'diamonds-worth-3',
      'hearts-hard-thing-1', 'hearts-hard-thing-2',
    ],
    mirror: {
      'spades-safe-path-2': { lessonId: 'spades-safe-path-2', text: 'Mostly that I would look stupid if it failed. The evidence says people barely notice.', savedAt: now - 9 * 24 * HOUR, shared: false },
    },
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...emptyState(), ...(JSON.parse(raw) as Partial<State>) };
  } catch {
    // Storage blocked or corrupt: start fresh.
  }
  return emptyState();
}

function save(state: State) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked: the app still works for this visit.
  }
}

const newId = () => `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

function makeActions(set: (fn: (s: State) => State) => void) {
  return {
    join(name: string, tier: Tier) {
      set(() => ({ ...emptyState(), member: { name: name.trim() || 'Friend', tier, joinedAt: Date.now() } }));
    },
    signInDemo() {
      set(() => demoMemberState());
    },
    setTier(tier: Tier) {
      set((s) => (s.member ? { ...s, member: { ...s.member, tier } } : s));
    },
    toggleComplete(lessonId: string) {
      set((s) => ({ ...s, completed: toggle(s.completed, lessonId) }));
    },
    toggleSaved(lessonId: string) {
      set((s) => ({ ...s, saved: toggle(s.saved, lessonId) }));
    },
    saveMirror(lessonId: string, text: string) {
      set((s) => ({
        ...s,
        mirror: { ...s.mirror, [lessonId]: { lessonId, text: text.trim(), savedAt: Date.now(), shared: s.mirror[lessonId]?.shared ?? false } },
      }));
    },
    shareMirror(lessonId: string, suit: SuitId, text: string) {
      set((s) => {
        const post: Post = { id: newId(), author: s.member?.name ?? 'You', suit, text: text.trim(), createdAt: Date.now(), meToo: 0, replies: 0, mine: true, mirrorLessonId: lessonId };
        return {
          ...s,
          mirror: { ...s.mirror, [lessonId]: { lessonId, text: text.trim(), savedAt: Date.now(), shared: true } },
          posts: [post, ...s.posts],
        };
      });
    },
    addPost(text: string, suit: SuitId | null) {
      set((s) => ({
        ...s,
        posts: [{ id: newId(), author: s.member?.name ?? 'You', suit, text: text.trim(), createdAt: Date.now(), meToo: 0, replies: 0, mine: true }, ...s.posts],
      }));
    },
    removePost(id: string) {
      set((s) => ({ ...s, posts: s.posts.filter((p) => p.id !== id) }));
    },
    toggleMeToo(id: string) {
      set((s) => ({ ...s, meToo: toggle(s.meToo, id) }));
    },
    book(booking: Omit<Booking, 'bookedAt'>) {
      set((s) => ({ ...s, booking: { ...booking, topic: booking.topic.trim(), bookedAt: Date.now() } }));
    },
    cancelBooking() {
      set((s) => ({ ...s, booking: null }));
    },
    toggleReminder() {
      set((s) => ({ ...s, fridayReminder: !s.fridayReminder }));
    },
    reset() {
      set(() => emptyState());
    },
  };
}

export type Actions = ReturnType<typeof makeActions>;

const StoreContext = createContext<{ state: State; actions: Actions } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(load);
  const actions = useMemo(() => makeActions(setState), []);
  useEffect(() => save(state), [state]);
  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
