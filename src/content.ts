// All lesson content lives here. These are example lessons written in Jack's voice so the
// platform has something real to show; replace titles, summaries and Mirror questions with
// the real ones as videos get recorded.
//
// Each suit is a deck of 13 cards, Ace to King, and each card is a series of lessons. Cards not
// recorded yet show face down as "coming soon". Who sees what: Open Hand gets the first lesson of
// each suit's Ace; the Full Deck gets Ace to 5; the Ace plan gets every card; Royal Flush also
// gets the two Joker lessons in each suit.

export type SuitId = 'hearts' | 'spades' | 'clubs' | 'diamonds';
export type Tier = 'open' | 'deck' | 'ace' | 'royal';

export interface Suit {
  id: SuitId;
  name: string;
  symbol: string;
  red: boolean;
  blurb: string;
}

export interface Lesson {
  id: string;
  seriesId: string;
  suit: SuitId;
  number: number;
  title: string;
  minutes: number;
  summary: string;
  mirror: string;
  /** The cheapest plan that unlocks it (the first lesson of each suit is also free, see isFreeLesson). */
  minTier: Tier;
  /** Joker lessons: two extra in each suit, only for Royal Flush. */
  joker: boolean;
}

/** The cards in each suit, in order. Jokers sit after the King. */
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export type Rank = (typeof RANKS)[number] | 'Joker';
const RANK_NAMES: Partial<Record<Rank, string>> = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King', Joker: 'Joker' };
export const rankName = (rank: Rank) => RANK_NAMES[rank] ?? rank;

/** The Full Deck plan gets these cards in every suit; the Ace plan gets all 13; Royal Flush adds the Jokers. */
const FULL_DECK_RANKS: Rank[] = ['A', '2', '3', '4', '5'];
export const tierForRank = (rank: Rank): Tier => (rank === 'Joker' ? 'royal' : FULL_DECK_RANKS.includes(rank) ? 'deck' : 'ace');

export interface Series {
  id: string;
  suit: SuitId;
  rank: Rank;
  /** Empty while the card is face down. */
  title: string;
  minTier: Tier;
  joker: boolean;
  /** Not recorded yet: shown face down. */
  comingSoon: boolean;
  lessons: Lesson[];
}

// U+FE0E asks for the text (not emoji) version of each suit symbol.
export const SUITS: Suit[] = [
  { id: 'hearts', name: 'Hearts', symbol: '♥︎', red: true, blurb: "Relationships, family, friendship, and the things we don't say out loud." },
  { id: 'spades', name: 'Spades', symbol: '♠︎', red: false, blurb: 'Work and grit. Leaving the safe path, building your own thing, digging in.' },
  { id: 'clubs', name: 'Clubs', symbol: '♣︎', red: false, blurb: 'Body and training. Endurance, discipline, and choosing discomfort on purpose.' },
  { id: 'diamonds', name: 'Diamonds', symbol: '♦︎', red: true, blurb: "Money and worth. Honest finances, and charging what you're actually worth." },
];

export const suitById = (id: SuitId): Suit => SUITS.find((s) => s.id === id)!;

type LessonSeed = [title: string, minutes: number, summary: string, mirror: string];

/** A recorded card: its rank decides which plan unlocks it (see tierForRank). */
function series(suit: SuitId, rank: Rank, slug: string, title: string, seeds: LessonSeed[]): Series {
  const seriesId = `${suit}-${slug}`;
  const minTier = tierForRank(rank);
  const joker = rank === 'Joker';
  return {
    id: seriesId,
    suit,
    rank,
    title,
    minTier,
    joker,
    comingSoon: false,
    lessons: seeds.map(([lessonTitle, minutes, summary, mirror], i) => ({
      id: `${seriesId}-${i + 1}`,
      seriesId,
      suit,
      number: i + 1,
      title: lessonTitle,
      minutes,
      summary,
      mirror,
      minTier,
      joker,
    })),
  };
}

const RECORDED: Series[] = [
  series('hearts', 'A', 'hard-thing', 'Saying the hard thing', [
    ['The conversation you keep rehearsing', 12, "Everyone has one conversation they've played out in the shower a hundred times. Why rehearsing it feels like progress, and why it isn't.", 'Who needs to hear something from you that you keep putting off?'],
    ["Honest isn't the same as harsh", 10, 'Honesty is about what you say. Harshness is about how. I have got this wrong more times than I can count.', 'When did you use honesty as an excuse to hurt someone?'],
    ['Hearing it back', 9, 'Taking hard feedback without building a defence before the other person has finished talking.', "What feedback have you heard more than once and ignored?"],
  ]),
  series('hearts', '2', 'friendship', 'Friendship after 30', [
    ["Who's still in your corner", 11, 'Friendships thin out quietly in your late twenties. Working out who is actually still there.', 'Who would you call at 2am, and when did you last tell them that?'],
    ['Making new friends as an adult', 13, 'Nobody tells you it gets awkward again. What has worked for me: clubs, training partners, saying yes.', 'What would you do if making a new friend was a skill you could practise?'],
    ['Letting some go', 10, 'Not every friendship has to last forever to have mattered.', 'Which friendship are you keeping out of habit?'],
  ]),
  series('hearts', 'Joker', 'jokers', 'Jokers', [
    ['The person you need to forgive', 12, "Forgiveness is mostly for you. What it actually takes, and what it doesn't mean.", 'Who are you still carrying, and what would it cost to put them down?'],
    ['Being the one who reaches out', 10, "Someone has to go first. Why it's usually worth it being you.", 'Who are you waiting to hear from first?'],
  ]),
  series('spades', 'A', 'safe-path', 'Leaving the safe path', [
    ['The job that looked fine on paper', 12, 'Good salary, pension, holidays. Why that still was not enough, and how long it took me to admit it.', "What part of your life looks fine on paper but doesn't feel it?"],
    ['Fear versus evidence', 11, 'Writing down what you are scared of, then writing down what you actually know. They are rarely the same list.', "What's the actual evidence behind the fear that's stopping you?"],
    ['Telling people', 9, 'Family, friends, colleagues. Whose opinion gets a vote and whose just gets heard.', 'Whose opinion are you most afraid of, and why does it get a vote?'],
    ['The first month after', 14, 'The first month after a big change is the hardest. What I would put in place before jumping again.', 'What would you need in place to get through the first month of a big change?'],
  ]),
  series('spades', '2', 'own-thing', 'Building your own thing', [
    ['Jack of all trades, on purpose', 10, 'Why having lots of skills becomes an advantage the moment you stop apologising for it.', "Which of your skills do you undersell because it doesn't fit your job title?"],
    ['Ship it ugly', 12, 'Every app I have shipped was embarrassing at launch. Shipping it anyway is the whole trick.', "What have you finished in your head but never shown anyone?"],
    ['Your first ten customers', 13, 'Forget audiences of thousands. Ten people who would pay you is a business.', "Who are the first ten people who'd pay for what you do?"],
  ]),
  series('spades', 'Joker', 'jokers', 'Jokers', [
    ['The plan B I always write down', 11, 'Why I never jump without one, and why having it makes plan A braver.', "What's your plan B, and is it written down anywhere?"],
    ['Working when nobody is watching', 12, 'Self-employed means nobody checks. The routines that keep me honest.', 'What would your week look like if nobody was checking?'],
  ]),
  series('clubs', 'A', 'seek-discomfort', 'Seek discomfort', [
    ['Why I go looking for it', 11, "Comfort isn't the enemy. Never choosing anything else is.", 'When did you last choose the harder option when nobody was watching?'],
    ['The second hour', 14, "The first hour of anything hard runs on adrenaline. The second hour is where you find out what you believe about yourself. This week: what I do when I want to stop, and why I don't trust the voice that says that's enough.", "What are you avoiding because it's uncomfortable, not because it's wrong?"],
    ['Cold starts', 9, 'Starting before you feel ready, every single time. Readiness turns up halfway through.', 'What are you waiting to feel ready for?'],
    ['Knowing when to stop', 12, 'Discomfort on purpose is different from damage. How I tell the two apart.', "Where are you pushing through something you should be listening to?"],
  ]),
  series('clubs', '2', 'long-one', 'Training for the long one', [
    ['Picking a goal that scares you', 10, 'A goal you are sure you can hit will not change you. Choosing one that might not work.', 'What goal would you set if nobody could see you fail?'],
    ['Boring weeks win', 13, 'Most of a big goal is unremarkable sessions done anyway, in the rain, on a Tuesday.', 'Which boring habit would change everything if you kept it for a year?'],
    ['When the plan breaks', 11, 'Injury, illness, life. Adjusting the plan without quitting on it.', "What's your plan for the week everything goes wrong?"],
  ]),
  series('clubs', 'Joker', 'jokers', 'Jokers', [
    ["Inside the one I didn't train for", 15, 'The ultra I turned up to under-prepared. Hour by hour: what went wrong, and what kept me going.', 'Where are you relying on grit instead of preparation?'],
    ['My training week, unfiltered', 13, 'Every session from a real week, including the ones I skipped and why.', 'What does your real week look like, not the one you planned?'],
  ]),
  series('diamonds', 'A', 'worth', "Charging what you're worth", [
    ['The number that makes you wince', 10, 'Say your price out loud. If it does not make you wince a little, it is probably too low.', "What would you charge if you weren't scared of the answer?"],
    ['Raising your prices', 11, 'How to tell existing clients, and why most of them will not leave.', 'Who are you discounting for, and does it actually help either of you?'],
    ['Saying no to bad money', 9, 'Some work costs you more than it pays. Learning to spot it before you say yes.', 'Which piece of work costs you more than it pays?'],
  ]),
  series('diamonds', '2', 'honest-money', 'Honest money', [
    ['Looking at the numbers', 12, "Opening the banking app you've been avoiding. Five minutes of discomfort that changes the month.", 'Which number in your finances are you avoiding looking at?'],
    ['Debt without shame', 13, 'Debt is a number, not a verdict on you. Paying it down without hating yourself the whole way.', "What story do you tell yourself about money that isn't true any more?"],
    ['Spending on what matters', 10, 'Cutting the spending you will not miss so you can keep the spending you would.', "What did you spend on last month that you'd happily cut?"],
  ]),
  series('diamonds', 'Joker', 'jokers', 'Jokers', [
    ['Building a buffer', 11, 'A few months of breathing room changes every decision you make. Building one, a little at a time.', 'How many weeks could you last if the money stopped tomorrow?'],
    ["What I'd do with a thousand pounds", 10, 'A thought experiment I use to find out what I actually value.', 'If a thousand pounds landed tomorrow, where would it go first?'],
  ]),
];

/** Every suit's full deck, Ace to King then the Jokers, with unrecorded cards face down. */
export const SERIES: Series[] = SUITS.flatMap((suit) =>
  [...RANKS, 'Joker' as const].map((rank): Series => {
    const recorded = RECORDED.find((s) => s.suit === suit.id && s.rank === rank);
    return recorded ?? {
      id: `${suit.id}-${rank.toLowerCase()}`,
      suit: suit.id,
      rank,
      title: '',
      minTier: tierForRank(rank),
      joker: rank === 'Joker',
      comingSoon: true,
      lessons: [],
    };
  }),
);

export const LESSONS: Lesson[] = SERIES.flatMap((s) => s.lessons);
export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
export const seriesById = (id: string) => SERIES.find((s) => s.id === id);

/** The lesson shown as "this week's hand" on Home. */
export const FEATURED_LESSON_ID = 'clubs-seek-discomfort-2';

/** Open Hand (free) members get the first lesson of each suit's Ace. */
export function isFreeLesson(lesson: Lesson): boolean {
  const ace = SERIES.find((s) => s.suit === lesson.suit && s.rank === 'A');
  return ace?.lessons[0]?.id === lesson.id;
}

export function canWatch(tier: Tier, lesson: Lesson): boolean {
  return isFreeLesson(lesson) || TIER_RANK[tier] >= TIER_RANK[lesson.minTier];
}

/** The cheapest plan that unlocks a lesson. */
export const unlockedBy = (lesson: Lesson): Tier => (isFreeLesson(lesson) ? 'open' : lesson.minTier);

export function nextLesson(lesson: Lesson): Lesson | undefined {
  const s = seriesById(lesson.seriesId);
  return s?.lessons[lesson.number];
}

/** How long a member pays for at once. Royal Flush is sold in blocks of at least 3 months. */
export type Term = 'month' | 'quarter' | 'half';

export interface PriceOption {
  term: Term;
  label: string;
  price: string;
  per: string;
  /** Short saving line, e.g. "Save £28". */
  note?: string;
}

export interface TierInfo {
  id: Tier;
  name: string;
  /** The headline price: the first entry in `options`. */
  price: string;
  per: string;
  pitch: string;
  perks: string[];
  /** Ways to pay for a paid plan. The first is the default. Stripe lookup keys: `${tier}_${term}`. */
  options: PriceOption[];
}

// Prices are proposals; change them here and they update everywhere.
export const TIERS: TierInfo[] = [
  {
    id: 'open',
    name: 'Open Hand',
    price: 'Free',
    per: '',
    pitch: "Start here and see if it's for you.",
    perks: ['Weekly lesson clips on Instagram', 'One full lesson from each suit', 'A monthly email from me'],
    options: [],
  },
  {
    id: 'deck',
    name: 'Full Deck',
    price: '£19',
    per: '/month',
    pitch: 'The core of the membership.',
    perks: ['The first five cards of every suit, Ace to 5', 'A Mirror question with every lesson', "A seat at the Table, the members' community", 'Monthly live Friday Table with me'],
    options: [{ term: 'month', label: 'Monthly', price: '£19', per: '/month' }],
  },
  {
    id: 'ace',
    name: 'Ace',
    price: '£99',
    per: '/month',
    pitch: 'For when you want me in your corner.',
    perks: ['Everything in the Full Deck', 'The whole deck: every card, Ace to King, in all four suits', 'A 45-minute 1:1 video call with me, every month', 'A small accountability group of six', 'First replies from me on the Table'],
    options: [
      { term: 'month', label: 'Monthly', price: '£99', per: '/month' },
      { term: 'quarter', label: '3 months', price: '£269', per: '/3 months', note: 'Paid upfront · save £28' },
      { term: 'half', label: '6 months', price: '£495', per: '/6 months', note: 'Paid upfront · save £99' },
    ],
  },
  {
    id: 'royal',
    name: 'Royal Flush',
    price: '£949',
    per: '/3 months',
    pitch: 'Me in your corner, every week.',
    perks: [
      'Everything in Ace',
      'Two Joker lessons in every suit, only for Royal Flush',
      'A 45-minute 1:1 video call every week, with notes and three actions after each',
      'Voice notes between calls, answered within a working day',
      'A 60-minute kickoff and your own 90-day plan',
      'A personal training plan, written by me',
      'A run, ride or hike together, once a quarter',
      'First pick of call times',
    ],
    options: [
      { term: 'quarter', label: '3 months', price: '£949', per: '/3 months', note: 'Paid upfront' },
      { term: 'half', label: '6 months', price: '£1,745', per: '/6 months', note: 'Paid upfront · save £153' },
    ],
  },
];

/** The price option for a plan and term, falling back to the plan's default. */
export function priceOption(tier: Tier, term?: Term | null): PriceOption | undefined {
  const opts = tierById(tier).options;
  return opts.find((o) => o.term === term) ?? opts[0];
}
export const defaultTerm = (tier: Tier): Term => tierById(tier).options[0]?.term ?? 'month';

/** Royal Flush is capped. The database (royal_places_left) is the source of truth; this is for copy. */
export const ROYAL_PLACES = 5;

/** Plans in order, so "is this an upgrade?" is a comparison. */
export const TIER_RANK: Record<Tier, number> = { open: 0, deck: 1, ace: 2, royal: 3 };

/** Plans that include 1:1 calls. */
export const hasCalls = (tier: Tier) => tier === 'ace' || tier === 'royal';

export const tierById = (id: Tier) => TIERS.find((t) => t.id === id)!;

/** Times Jack offers for 1:1 calls (placeholder availability). */
export const CALL_TIMES = ['07:00', '07:45', '12:30', '18:00', '18:45', '19:30'];
