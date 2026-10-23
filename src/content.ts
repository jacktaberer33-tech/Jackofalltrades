// All lesson content lives here. These are example lessons written in Jack's voice so the
// platform has something real to show; replace titles, summaries and Mirror questions with
// the real ones as videos get recorded.

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
}

export interface Series {
  id: string;
  suit: SuitId;
  title: string;
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

function series(suit: SuitId, slug: string, title: string, seeds: LessonSeed[]): Series {
  const seriesId = `${suit}-${slug}`;
  return {
    id: seriesId,
    suit,
    title,
    lessons: seeds.map(([lessonTitle, minutes, summary, mirror], i) => ({
      id: `${seriesId}-${i + 1}`,
      seriesId,
      suit,
      number: i + 1,
      title: lessonTitle,
      minutes,
      summary,
      mirror,
    })),
  };
}

export const SERIES: Series[] = [
  series('hearts', 'hard-thing', 'Saying the hard thing', [
    ['The conversation you keep rehearsing', 12, "Everyone has one conversation they've played out in the shower a hundred times. Why rehearsing it feels like progress, and why it isn't.", 'Who needs to hear something from you that you keep putting off?'],
    ["Honest isn't the same as harsh", 10, 'Honesty is about what you say. Harshness is about how. I have got this wrong more times than I can count.', 'When did you use honesty as an excuse to hurt someone?'],
    ['Hearing it back', 9, 'Taking hard feedback without building a defence before the other person has finished talking.', "What feedback have you heard more than once and ignored?"],
  ]),
  series('hearts', 'friendship', 'Friendship after 30', [
    ["Who's still in your corner", 11, 'Friendships thin out quietly in your late twenties. Working out who is actually still there.', 'Who would you call at 2am, and when did you last tell them that?'],
    ['Making new friends as an adult', 13, 'Nobody tells you it gets awkward again. What has worked for me: clubs, training partners, saying yes.', 'What would you do if making a new friend was a skill you could practise?'],
    ['Letting some go', 10, 'Not every friendship has to last forever to have mattered.', 'Which friendship are you keeping out of habit?'],
  ]),
  series('spades', 'safe-path', 'Leaving the safe path', [
    ['The job that looked fine on paper', 12, 'Good salary, pension, holidays. Why that still was not enough, and how long it took me to admit it.', "What part of your life looks fine on paper but doesn't feel it?"],
    ['Fear versus evidence', 11, 'Writing down what you are scared of, then writing down what you actually know. They are rarely the same list.', "What's the actual evidence behind the fear that's stopping you?"],
    ['Telling people', 9, 'Family, friends, colleagues. Whose opinion gets a vote and whose just gets heard.', 'Whose opinion are you most afraid of, and why does it get a vote?'],
    ['The first month after', 14, 'The first month after a big change is the hardest. What I would put in place before jumping again.', 'What would you need in place to get through the first month of a big change?'],
  ]),
  series('spades', 'own-thing', 'Building your own thing', [
    ['Jack of all trades, on purpose', 10, 'Why having lots of skills becomes an advantage the moment you stop apologising for it.', "Which of your skills do you undersell because it doesn't fit your job title?"],
    ['Ship it ugly', 12, 'Every app I have shipped was embarrassing at launch. Shipping it anyway is the whole trick.', "What have you finished in your head but never shown anyone?"],
    ['Your first ten customers', 13, 'Forget audiences of thousands. Ten people who would pay you is a business.', "Who are the first ten people who'd pay for what you do?"],
  ]),
  series('clubs', 'seek-discomfort', 'Seek discomfort', [
    ['Why I go looking for it', 11, "Comfort isn't the enemy. Never choosing anything else is.", 'When did you last choose the harder option when nobody was watching?'],
    ['The second hour', 14, "The first hour of anything hard runs on adrenaline. The second hour is where you find out what you believe about yourself. This week: what I do when I want to stop, and why I don't trust the voice that says that's enough.", "What are you avoiding because it's uncomfortable, not because it's wrong?"],
    ['Cold starts', 9, 'Starting before you feel ready, every single time. Readiness turns up halfway through.', 'What are you waiting to feel ready for?'],
    ['Knowing when to stop', 12, 'Discomfort on purpose is different from damage. How I tell the two apart.', "Where are you pushing through something you should be listening to?"],
  ]),
  series('clubs', 'long-one', 'Training for the long one', [
    ['Picking a goal that scares you', 10, 'A goal you are sure you can hit will not change you. Choosing one that might not work.', 'What goal would you set if nobody could see you fail?'],
    ['Boring weeks win', 13, 'Most of a big goal is unremarkable sessions done anyway, in the rain, on a Tuesday.', 'Which boring habit would change everything if you kept it for a year?'],
    ['When the plan breaks', 11, 'Injury, illness, life. Adjusting the plan without quitting on it.', "What's your plan for the week everything goes wrong?"],
  ]),
  series('diamonds', 'worth', "Charging what you're worth", [
    ['The number that makes you wince', 10, 'Say your price out loud. If it does not make you wince a little, it is probably too low.', "What would you charge if you weren't scared of the answer?"],
    ['Raising your prices', 11, 'How to tell existing clients, and why most of them will not leave.', 'Who are you discounting for, and does it actually help either of you?'],
    ['Saying no to bad money', 9, 'Some work costs you more than it pays. Learning to spot it before you say yes.', 'Which piece of work costs you more than it pays?'],
  ]),
  series('diamonds', 'honest-money', 'Honest money', [
    ['Looking at the numbers', 12, "Opening the banking app you've been avoiding. Five minutes of discomfort that changes the month.", 'Which number in your finances are you avoiding looking at?'],
    ['Debt without shame', 13, 'Debt is a number, not a verdict on you. Paying it down without hating yourself the whole way.', "What story do you tell yourself about money that isn't true any more?"],
    ['Spending on what matters', 10, 'Cutting the spending you will not miss so you can keep the spending you would.', "What did you spend on last month that you'd happily cut?"],
  ]),
];

export const LESSONS: Lesson[] = SERIES.flatMap((s) => s.lessons);
export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
export const seriesById = (id: string) => SERIES.find((s) => s.id === id);

/** The lesson shown as "this week's hand" on Home. */
export const FEATURED_LESSON_ID = 'clubs-seek-discomfort-2';

/** Open Hand (free) members get the first lesson of each suit. */
export function isFreeLesson(lesson: Lesson): boolean {
  const first = SERIES.find((s) => s.suit === lesson.suit);
  return first?.lessons[0]?.id === lesson.id;
}

export function canWatch(tier: Tier, lesson: Lesson): boolean {
  return tier !== 'open' || isFreeLesson(lesson);
}

export function nextLesson(lesson: Lesson): Lesson | undefined {
  const s = seriesById(lesson.seriesId);
  return s?.lessons[lesson.number];
}

export interface TierInfo {
  id: Tier;
  name: string;
  price: string;
  per: string;
  pitch: string;
  perks: string[];
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
  },
  {
    id: 'deck',
    name: 'Full Deck',
    price: '£19',
    per: '/month',
    pitch: 'The whole membership.',
    perks: ['Every lesson, across all four suits', 'A new lesson and Mirror question every week', "A seat at the Table, the members' community", 'Monthly live Friday Table with me'],
  },
  {
    id: 'ace',
    name: 'Ace',
    price: '£99',
    per: '/month',
    pitch: 'For when you want me in your corner.',
    perks: ['Everything in the Full Deck', 'A 45-minute 1:1 video call with me, every month', 'A small accountability group of six', 'First replies from me on the Table'],
  },
  {
    id: 'royal',
    name: 'Royal Flush',
    price: '£349',
    per: '/month',
    pitch: 'Me in your corner, every week.',
    perks: [
      'Everything in Ace',
      'A 45-minute 1:1 video call every week, with notes and three actions after each',
      'Voice notes between calls, answered within a working day',
      'A 60-minute kickoff and your own 90-day plan',
      'A personal training plan, written by me',
      'A run, ride or hike together, once a quarter',
      'First pick of call times',
    ],
  },
];

/** Royal Flush is capped. The database (royal_places_left) is the source of truth; this is for copy. */
export const ROYAL_PLACES = 5;

/** Plans in order, so "is this an upgrade?" is a comparison. */
export const TIER_RANK: Record<Tier, number> = { open: 0, deck: 1, ace: 2, royal: 3 };

/** Plans that include 1:1 calls. */
export const hasCalls = (tier: Tier) => tier === 'ace' || tier === 'royal';

export const tierById = (id: Tier) => TIERS.find((t) => t.id === id)!;

/** Times Jack offers for 1:1 calls (placeholder availability). */
export const CALL_TIMES = ['07:00', '07:45', '12:30', '18:00', '18:45', '19:30'];
