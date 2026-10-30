// The site's policies. Plain-English, written in Jack's voice.
// Placeholders in double braces ({{email}}, {{address}}, {{ico}}) are filled from LEGAL in
// config.ts; links use [text](url) and are rendered by pages/Legal.tsx.

export type Block = { p: string } | { ul: string[] } | { h3: string };

export interface LegalSection {
  id: string;
  title: string;
  blocks: Block[];
}

export interface LegalDoc {
  slug: LegalSlug;
  eyebrow: string;
  title: string;
  intro: string;
  sections: LegalSection[];
}

export type LegalSlug = 'privacy' | 'terms' | 'guidelines';

const SUPPORT_LINES = `Samaritans are there day and night on [116 123](tel:116123), free from any phone. You can also text SHOUT to 85258 to talk to a trained volunteer. In an emergency, call 999.`;

/* ------------------------------------------------------------------ */
/* Privacy and cookies                                                 */
/* ------------------------------------------------------------------ */

const privacy: LegalDoc = {
  slug: 'privacy',
  eyebrow: 'Privacy and cookies',
  title: 'Privacy Policy',
  intro: `This policy explains what personal information I collect when you use Jack of All Trades, why I collect it, who helps me look after it, how long I keep it, and the rights you have over it. I've written it to be read, not skimmed past. If anything in it is unclear, ask me and I'll explain.`,
  sections: [
    {
      id: 'short-version',
      title: 'The short version',
      blocks: [
        {
          ul: [
            `I collect only what the membership needs in order to work.`,
            `I never sell your information, and the site has no advertising, analytics or tracking cookies.`,
            `Your Mirror answers are private to you unless you choose to share one at the Table.`,
            `You can close your account yourself, at any time, from the You page. Doing so deletes your account and everything in it.`,
          ],
        },
      ],
    },
    {
      id: 'who',
      title: 'Who I am',
      blocks: [
        { p: `Jack of All Trades is run by me, Jack Taberer, as a sole trader. Under UK data protection law I'm the "controller" of your personal information. That means I decide how it's used, and I'm responsible for protecting it.` },
        { ul: [`Email: {{email}}`, `Post: {{address}}`, `ICO registration number: {{ico}}`] },
        { p: `The Information Commissioner's Office (ICO) is the UK's independent regulator for data protection.` },
      ],
    },
    {
      id: 'what',
      title: 'What I collect, and why',
      blocks: [
        { p: `Data protection law asks me to name a "lawful basis" for everything I do with your information. Each one is listed below in plain terms.` },
        { h3: 'Your account' },
        { p: `Your first name, email address and password, the plan you choose, and the date you joined. Your password is stored by my database provider only as a secure, one-way scrambled version (a "hash"). Neither I nor anyone else can read it. I use this information to create your account, let you sign in and give you what your plan includes. Lawful basis: it's necessary to provide the membership you've signed up for (contract).` },
        { h3: 'What you do in the membership' },
        { p: `The lessons you finish and save; your Mirror answers, and whether you've chosen to share each one; your posts, replies and "me too"s at the Table; your RSVPs to the Friday Table; and, for Ace and Royal Flush members, your 1:1 call bookings, including anything you write about what you'd like to talk about. This is how the membership remembers your progress and makes the Table work. Lawful basis: contract.` },
        { h3: 'Royal Flush' },
        { p: `If you're on Royal Flush, I also keep the notes and actions I write after each call, your 90-day plan, and your training plan, along with anything you tell me so that I can write it safely, such as injuries or health conditions. Your voice notes and messages to me go through WhatsApp, which means I'll see your phone number. To arrange our quarterly session in person, I'll need to agree a time and place with you. Lawful basis: contract, and your explicit consent for any health information (see "Sensitive information" below).` },
        { h3: 'Payments' },
        { p: `Payments are taken by Stripe. Your card details go straight to Stripe and are never seen or stored by me. I keep a Stripe customer reference, the status of your subscription, its renewal date, and whether you've asked for it to end. Lawful basis: contract, and my legal obligation to keep accurate financial records for tax.` },
        { h3: 'Emails' },
        { p: `I send emails you need in order to use your account, such as confirming your sign-up and resetting your password, as well as emails that are part of your plan: the monthly email from me (every member gets it, and each one has a one-click unsubscribe link), call links for Ace and Royal Flush members, and important notices about your membership or these policies. Lawful basis: contract. I won't email you about anything other than your membership unless you've asked me to, and you can opt out of anything optional at any time.` },
        { h3: 'Messages you send me' },
        { p: `If you email me or contact me another way, I keep the conversation so I can help you and refer back to it. Lawful basis: my legitimate interest in responding to you and running the membership well.` },
        { h3: 'Technical information' },
        { p: `When you visit the site, the companies that host it automatically record technical details such as your IP address, browser type and the time of each request. These logs are used to keep the service secure, stop abuse and fix problems. Lawful basis: legitimate interests.` },
        { h3: 'Calls' },
        { p: `I may record 1:1 calls for training purposes, so that I can review them and get better at what I do, but only with your agreement. I'll ask at the start of each call, and if you'd rather I didn't, I won't, and nothing about the call changes. Because calls often touch on personal matters, I rely on your explicit consent, which you can withdraw at any time, including after the call, and I'll delete the recording. Recordings are kept private to me, are never shared or published, and are deleted within 90 days.` },
        { p: `If a live Friday Table session is ever recorded, I'll say so clearly at the start, and you can keep your camera and microphone off.` },
      ],
    },
    {
      id: 'sensitive',
      title: 'Sensitive information',
      blocks: [
        { p: `The lessons are about real life: relationships, health, training, money and how you're actually doing. You never have to tell me anything sensitive, and nothing in the membership depends on it.` },
        { p: `If you choose to write about your physical or mental health, your sex life or sexuality, your religious or philosophical beliefs, or anything similar in a Mirror answer, a Table post, a 1:1 booking or a Royal Flush voice note, or to help me write your training plan, the law treats that as "special category" information and gives it extra protection. I only hold it because you've chosen to share it (your explicit consent), and I only use it to provide the membership to you. You can withdraw that consent at any time by editing or deleting what you wrote, or by closing your account.` },
        { p: `Anything you post at the Table can be read by other members, so please think before sharing details you'd want kept private.` },
      ],
    },
    {
      id: 'visibility',
      title: 'Who can see what',
      blocks: [
        {
          ul: [
            `Mirror answers: only you, unless you share one at the Table, where members see it alongside your first name.`,
            `Table posts, replies and "me too"s: all members, alongside your first name.`,
            `Your lesson progress and saved lessons: only you.`,
            `Friday Table RSVPs: other members see only the total number going.`,
            `1:1 call bookings, and any call recording you've agreed to: you and me.`,
            `Royal Flush call notes, plans, voice notes and messages: you and me.`,
            `Your email address and plan: me, so I can run the membership.`,
          ],
        },
        { p: `Private Mirror answers are protected by the database's access rules, so they don't appear to me or to anyone else in the app. Because I run the service, I could technically reach the underlying database. I don't read private answers, and I would only access one if the law required it or you asked me to fix a problem that involved it.` },
      ],
    },
    {
      id: 'sharing',
      title: 'Who helps me run the service',
      blocks: [
        { p: `I use a small number of trusted companies to run the membership. They act on my instructions, are bound by contracts that require them to protect your information, and may not use it for their own purposes.` },
        {
          ul: [
            `Supabase: the database that stores your account and membership activity, and the system that handles sign-in. Your data is stored in London.`,
            `Netlify: hosts the website.`,
            `Resend: sends account and membership emails, and keeps the mailing list for the monthly email (your first name and email address, plus whether you've unsubscribed). When you close your account, you're removed from it within an hour.`,
            `WhatsApp (Meta): carries voice notes and messages between Royal Flush members and me. They're end-to-end encrypted, and Meta's own privacy policy applies to your use of WhatsApp.`,
            `Google Fonts: provides the typefaces the site uses. When a page loads, your browser fetches them from Google's servers, which can see your IP address.`,
            `A video hosting service, which streams the lesson videos. I'll name it here before lesson videos go live.`,
            `A video-calling service for 1:1 calls and the Friday Table. It's named in every call invitation, and its own privacy policy applies while you're on a call.`,
          ],
        },
        { p: `Stripe processes payments as an independent controller, which means its own [privacy policy](https://stripe.com/gb/privacy) also applies to the payment information you give it.` },
        { p: `If you pay for a plan, my payment records are shared with my accountant and with HM Revenue & Customs where tax law requires it. I'll also share information if the law requires me to, or if it's necessary to protect someone's safety.` },
        { p: `I never sell your personal information, and I never share it with advertisers.` },
      ],
    },
    {
      id: 'transfers',
      title: 'Information that leaves the UK',
      blocks: [
        { p: `Some of these companies are based in, or have support teams in, the United States. Where your information is transferred outside the UK, it's protected by the UK–US data bridge or by the ICO's approved international data transfer agreements. Both require it to be protected to the standard UK law expects.` },
      ],
    },
    {
      id: 'retention',
      title: 'How long I keep it',
      blocks: [
        {
          ul: [
            `Your account and everything in it: for as long as your account is open. When you close it, it's deleted from the live database straight away, and any copies in routine backups are overwritten automatically, normally within 30 days.`,
            `Payment and tax records: six years from the end of the tax year they relate to, because tax law requires it.`,
            `1:1 call recordings, if you agreed to one: deleted within 90 days of the call, or sooner if you ask.`,
            `Royal Flush call notes, plans, voice notes and messages: kept while you're on Royal Flush, then deleted within 30 days of you leaving it, unless you ask me to keep your plans.`,
            `Emails and messages with me: up to two years after we last spoke, unless they relate to a complaint or dispute that's still open.`,
            `Technical logs: kept by the hosting companies for their standard security periods, which are normally a few weeks.`,
          ],
        },
      ],
    },
    {
      id: 'rights',
      title: 'Your rights',
      blocks: [
        { p: `You have the right to:` },
        {
          ul: [
            `get a copy of the personal information I hold about you;`,
            `have anything inaccurate corrected;`,
            `have your information deleted;`,
            `ask me to limit how I use it, or object to my using it on the basis of legitimate interests;`,
            `receive the information you gave me in a format you can take elsewhere;`,
            `withdraw your consent at any time, wherever I rely on it.`,
          ],
        },
        { p: `I don't make decisions about you using purely automated processes.` },
        { p: `To use any of these rights, email me at {{email}}. It's free. I may ask you to confirm your identity first, and I'll respond within one month. You can close your account yourself from the You page at any time.` },
      ],
    },
    {
      id: 'complaints',
      title: 'Complaints',
      blocks: [
        { p: `If you're unhappy with how I've handled your information, please tell me first, by email or post, so I can put it right. I'll acknowledge your complaint within 30 days, look into it properly, and tell you the outcome without undue delay.` },
        { p: `You also have the right to complain to the Information Commissioner's Office: [ico.org.uk/make-a-complaint](https://ico.org.uk/make-a-complaint/), or call 0303 123 1113.` },
      ],
    },
    {
      id: 'cookies',
      title: 'Cookies and browser storage',
      blocks: [
        { p: `This site doesn't use advertising cookies, analytics or tracking pixels.` },
        { p: `It uses one essential item of browser storage. When you sign in, a secure session token is saved in your browser's local storage so that you stay signed in as you move around the app. It's strictly necessary to provide the service you've asked for, so the law doesn't require a consent banner for it. It's removed when you sign out.` },
        { p: `When you pay, Stripe's checkout and billing pages set their own cookies to process the payment and prevent fraud. Those are covered by [Stripe's cookie policy](https://stripe.com/gb/legal/cookies-policy).` },
        { p: `If I ever add anything that isn't strictly necessary, I'll ask for your consent first and update this policy.` },
      ],
    },
    {
      id: 'age',
      title: 'Age',
      blocks: [
        { p: `The membership is for adults. You must be 18 or over to create an account, and I don't knowingly collect information from anyone under 18. If you think someone under 18 has joined, please tell me and I'll delete their account.` },
      ],
    },
    {
      id: 'security',
      title: 'Keeping it safe',
      blocks: [
        { p: `Your information is encrypted as it travels between your device and the site, encrypted where it's stored, and protected by database rules that control exactly what each person can see. No system is perfectly secure. If something ever happened that put your information at risk, I'd tell you promptly and, where the law requires it, report it to the ICO.` },
      ],
    },
    {
      id: 'changes',
      title: 'Changes to this policy',
      blocks: [
        { p: `I'll update this policy when the service or the law changes. The date at the top always shows the current version. If a change affects you significantly, I'll email you before it takes effect.` },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Membership terms                                                    */
/* ------------------------------------------------------------------ */

const terms: LegalDoc = {
  slug: 'terms',
  eyebrow: 'Membership terms',
  title: 'Membership Terms',
  intro: `These terms are the agreement between you and me when you join Jack of All Trades. I've kept them as clear and fair as I can, and they never take away your legal rights as a consumer. Please read them before you join: by creating an account, you agree to them.`,
  sections: [
    {
      id: 'about',
      title: 'About me',
      blocks: [
        { p: `Jack of All Trades is run by me, Jack Taberer, a sole trader trading as Jack of All Trades. In these terms, "I", "me" and "my" mean me, and "you" means the member.` },
        { ul: [`Email: {{email}}`, `Post: {{address}}`] },
      ],
    },
    {
      id: 'joining',
      title: 'Joining',
      blocks: [
        { p: `To join, you must be 18 or over, and the membership must be for your own personal use, not for a business. One account is for one person: please don't share your sign-in details. You're responsible for keeping your password safe and for what happens on your account. If you think someone else has used it, tell me straight away.` },
        { p: `Our agreement begins when your account is created. For a paid plan, it begins when your first payment is confirmed.` },
      ],
    },
    {
      id: 'plans',
      title: 'The plans',
      blocks: [
        { h3: 'Open Hand: free' },
        { p: `The first full lesson in each of the four suits, weekly lesson clips on Instagram, a monthly email from me, and the ability to read the Table.` },
        { h3: 'Full Deck: £19 a month' },
        { p: `The first five series of lessons (Ace to 5) in each of the four suits, with a Mirror question for every lesson, the ability to post and reply at the Table, and a live Friday Table session with me once a month.` },
        { h3: 'Ace: £99 a month, or £269 for 3 months, or £495 for 6 months' },
        { p: `Everything in the Full Deck, plus every series of lessons (Ace to King) across all four suits, one 45-minute 1:1 video call with me each calendar month, a place in a small accountability group of up to six members, and first replies from me at the Table. Ace places are limited.` },
        { h3: 'Royal Flush: £949 for 3 months, or £1,745 for 6 months' },
        { p: `Everything in Ace, plus two Joker lessons in each suit that only Royal Flush members can watch, a 45-minute 1:1 video call with me every week with written notes and three actions afterwards, voice notes between calls answered within one working day, a 60-minute kickoff call and your own 90-day plan, a personal training plan written by me, a run, ride or hike together once a quarter, and first pick of call times. Royal Flush is limited to five members at a time; when it's full, you can join the waitlist. Because the 90-day plan and the quarterly session in person run on a three-month rhythm, Royal Flush is sold in blocks of three or six months, paid upfront.` },
        { p: `Prices are in pounds sterling and are the full amount you pay. The membership is a living thing: I'll keep adding lessons, and I may update, reorder or retire older ones, or change how features work, to keep it useful. If I make a change that significantly reduces what your paid plan includes, I'll tell you in advance, and you can cancel and receive a refund for any period you've paid for but won't use.` },
      ],
    },
    {
      id: 'paying',
      title: 'Paying',
      blocks: [
        { p: `All plans are paid in advance through Stripe, starting on the day you join. Monthly plans renew each month on the same date. Upfront plans (3 or 6 months) renew for the same length at the end of each term. Your plan keeps renewing until you cancel, and your card is charged at each renewal.` },
        { p: `Before an upfront plan renews, I'll email you at least 7 days ahead, so you can cancel, or switch Ace to monthly, if you'd rather.` },
        { p: `If a payment fails, Stripe will try again over the following days, and you'll be able to update your card. If the payment still can't be taken, your plan moves to the free Open Hand plan. Your account, progress, Mirror answers and posts are all kept, and you can rejoin a paid plan at any time.` },
        { p: `You can see your plan, update your card, switch plans and see your billing history from the You page, using "Change plan, card or cancel".` },
      ],
    },
    {
      id: 'founding',
      title: 'Founding members',
      blocks: [
        { p: `The first 50 people to join a paid plan are founding members. As a founding member, your price will not go up for as long as you stay on the same plan and payment term without a break, even if I raise prices for everyone else. If you cancel and later rejoin, or switch plans, the price that applies at that time is the one you'll pay.` },
      ],
    },
    {
      id: 'price-changes',
      title: 'Price changes',
      blocks: [
        { p: `I may change prices in the future. Founding members are protected as set out above. For everyone else, if the price of your plan goes up, I'll email you at least 30 days before your first payment at the new price, so that you can cancel beforehand if you'd rather not continue.` },
      ],
    },
    {
      id: 'cooling-off',
      title: 'Changing your mind: 14 days',
      blocks: [
        { p: `When you first join a paid plan, you have 14 days to change your mind.` },
        {
          ul: [
            `Monthly plans: if you cancel within 14 days of your first payment, I'll refund that payment in full, even if you've already watched lessons, posted at the Table or had a 1:1 call. That goes further than the law requires.`,
            `Upfront plans (3 or 6 months): if you cancel within 14 days of your first payment, I'll refund it minus a fair share for the days you've had, worked out day by day across your term. For example, cancelling on day 10 of a 3-month plan means a refund of about 89% of what you paid.`,
          ],
        },
        { p: `To cancel, use "Change plan, card or cancel" on the You page, or email me. I'll refund you within 14 days of your cancellation, to the card you paid with.` },
      ],
    },
    {
      id: 'cancelling',
      title: 'Cancelling at any time',
      blocks: [
        { p: `You can cancel whenever you like, online, in a couple of clicks: go to the You page and choose "Change plan, card or cancel". You can also email me. Your plan stays active until the end of the month or term you've already paid for, then it won't renew and you'll move to the free Open Hand plan.` },
        { p: `Apart from the 14-day rules above, I don't refund part of a month or term you've paid for, unless these terms or the law say I must. If I can't provide what you've paid for, for example because I end your membership for a reason that isn't your fault or close Jack of All Trades, I'll refund the unused part.` },
        { p: `You can also close your account completely, at any time, from the You page. This permanently deletes your account and everything in it, as described in the [Privacy Policy](#/privacy). If you're on a paid plan, cancel it first so that you aren't charged again; the You page will remind you.` },
      ],
    },
    {
      id: 'calls',
      title: '1:1 calls and the Friday Table',
      blocks: [
        { h3: '1:1 calls (Ace and Royal Flush)' },
        { p: `Ace includes one 45-minute 1:1 video call with me in each calendar month, booked in the app from the times available. I'll send you the link the day before.` },
        {
          ul: [
            `If you need to move your call, please cancel it in the app at least 24 hours beforehand and book another time in the same month.`,
            `If you miss a call without letting me know, it counts as your call for that month.`,
            `If I need to move a call, I'll offer you another time. If we can't find one that month, the call carries over to the next.`,
            `Otherwise, unused calls don't carry over from one month to the next.`,
            `I may ask to record a call for training purposes. It's always your choice, and the [Privacy Policy](#/privacy) explains how recordings are kept and deleted.`,
          ],
        },
        { p: `I arrange the Ace accountability groups, and I'll let you know who's in yours and how it will run.` },
        { h3: 'Royal Flush' },
        { p: `Royal Flush includes one 45-minute 1:1 video call each week (Monday to Sunday), which you can book in the app up to four weeks ahead. The same rules apply as for Ace, applied to the week rather than the month. After each call, I'll send you written notes and three actions.` },
        {
          ul: [
            `When you join, we'll arrange your 60-minute kickoff call directly and agree your 90-day plan, which we'll review in your weekly calls.`,
            `I take up to four weeks off a year. I'll tell you at least two weeks ahead, and there's no call in those weeks.`,
            `Between calls, you can send me WhatsApp voice notes or messages. I'll reply within one working day (Monday to Friday, not bank holidays). This isn't an emergency service: if you need urgent help, see "What the membership is, and what it isn't" below.`,
            `I'll write your training plan once you've told me about your goals, your training history and any injuries or health conditions, and we'll review it as you go.`,
            `Once each quarter, we'll go for a run, ride or hike together at a time and place we agree, at a pace that suits you. You cover your own travel. If you live too far away to meet, I'll swap it for an extra 45-minute video call.`,
          ],
        },
        { h3: 'The Friday Table' },
        { p: `Full Deck, Ace and Royal Flush members are invited to a live Friday Table session with me once a month. The date and time are shown in the app, and I may occasionally need to move them.` },
      ],
    },
    {
      id: 'not-advice',
      title: `What the membership is, and what it isn't`,
      blocks: [
        { p: `Jack of All Trades is me sharing what I've learned from my own life: honestly, practically, and personally. It's not professional advice. I'm not a doctor, therapist, financial adviser or lawyer, and nothing in the membership is medical, psychological, financial or legal advice, or a substitute for it.` },
        {
          ul: [
            `Training and the body: the lessons describe what I do. Royal Flush training plans are written for you by me as a qualified personal trainer, based on what you tell me, but they aren't medical advice. Before you start or change an exercise programme, especially if you have a health condition or injury, or are pregnant, check with your GP or a qualified professional. Stop if something hurts in a way it shouldn't, and seek help.`,
            `Money: the lessons are about habits and mindset, not regulated financial advice. Speak to a qualified adviser before making significant financial decisions.`,
            `Your wellbeing: the membership isn't therapy or a crisis service. ${SUPPORT_LINES}`,
          ],
        },
        { p: `You're responsible for the decisions you make. Please make them with care, and with proper advice where it matters.` },
      ],
    },
    {
      id: 'your-content',
      title: 'What you write',
      blocks: [
        { p: `Your Mirror answers, posts and replies stay yours. By writing them, you give me permission to store them and display them within the membership so that its features work (for example, showing your Table posts to other members). I won't use your words outside the membership, for example on Instagram or in marketing, without asking you first.` },
        { p: `When you post at the Table, you agree to follow the [Community Guidelines](#/guidelines), which form part of these terms.` },
      ],
    },
    {
      id: 'my-content',
      title: 'My content',
      blocks: [
        { p: `The lessons, videos, Mirror questions, written material and design of Jack of All Trades belong to me. Your membership gives you a personal, non-transferable right to use them for your own development while you're a member. Please don't download, record, copy, share, sell or publish them, or share your account with anyone else.` },
      ],
    },
    {
      id: 'ending',
      title: 'If I end or suspend a membership',
      blocks: [
        { p: `I may suspend or end your membership if you seriously or repeatedly break these terms or the Community Guidelines, for example by harassing other members, or by sharing what someone has posted at the Table outside the membership. I'll normally warn you first, unless the breach is serious.` },
        { p: `If I end a paid membership for any other reason, I'll refund any period you've paid for but won't receive. If I ever close Jack of All Trades altogether, I'll give you at least 30 days' notice and refund any unused period.` },
      ],
    },
    {
      id: 'availability',
      title: 'Availability',
      blocks: [
        { p: `I'll do my best to keep the membership running smoothly, but it depends on outside services and may occasionally be unavailable for maintenance or for reasons outside my control. If a problem I'm responsible for stops you using a paid plan for a significant time, tell me and I'll put it right, which may include a partial refund.` },
      ],
    },
    {
      id: 'liability',
      title: 'Your rights and my responsibility to you',
      blocks: [
        { p: `As a consumer, you have legal rights if digital content or a service isn't as described, or isn't provided with reasonable care and skill. Nothing in these terms affects those rights. [Citizens Advice](https://www.citizensadvice.org.uk/consumer/) can explain them.` },
        { p: `I'm responsible for loss or damage you suffer that is a foreseeable result of my breaking these terms or failing to use reasonable care and skill. I'm not responsible for loss that wasn't foreseeable, or for any business losses, because the membership is for personal use.` },
        { p: `I don't exclude or limit my liability where it would be unlawful to do so. That includes liability for death or personal injury caused by my negligence, and for fraud.` },
      ],
    },
    {
      id: 'complaints',
      title: `If something isn't right`,
      blocks: [
        { p: `Please email me at {{email}}. I aim to reply within five working days, and to sort things out fairly and quickly.` },
      ],
    },
    {
      id: 'changes',
      title: 'Changes to these terms',
      blocks: [
        { p: `I may update these terms, for example when I add new features or the law changes. If a change significantly affects you, I'll email you at least 30 days before it applies. If you don't want to continue under the new terms, you can cancel before then, and I'll refund any period you've paid for but won't use.` },
      ],
    },
    {
      id: 'general',
      title: 'The legal bits',
      blocks: [
        { p: `These terms are between you and me, and nobody else can enforce them. If a court decides that part of them is invalid, the rest still applies. If I don't enforce a term straight away, I can still do so later. You can't transfer your membership to anyone else.` },
        { p: `These terms are governed by the law of England and Wales. You can bring legal proceedings in the courts of England and Wales. If you live in Scotland or Northern Ireland, you can also bring them in the courts where you live.` },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Community guidelines                                                */
/* ------------------------------------------------------------------ */

const guidelines: LegalDoc = {
  slug: 'guidelines',
  eyebrow: 'The Table',
  title: 'Community Guidelines',
  intro: `The Table works because people are honest there. Honesty needs safety, so these guidelines exist to protect it. They're short, they apply to everyone, me included, and they form part of the [Membership Terms](#/terms).`,
  sections: [
    {
      id: 'stays',
      title: `What's shared at the Table stays at the Table`,
      blocks: [
        { p: `Never screenshot, copy or share anything another member has posted outside the membership, unless they've given you permission. Don't try to work out who someone is from what they've shared, and never identify them. This is the rule everything else rests on, and breaking it is the quickest way to lose your seat.` },
      ],
    },
    {
      id: 'honest',
      title: 'Honest, not harsh',
      blocks: [
        { p: `Say what you think, and say it with care. Disagree with ideas, never attack people. Before giving advice, ask whether it's wanted: sometimes people need to be heard, not fixed.` },
      ],
    },
    {
      id: 'own-experience',
      title: 'Speak from your own experience',
      blocks: [
        { p: `Share what happened to you and what worked for you. Don't present opinions as facts, and don't tell others what to do about their health, their money or legal matters. That's a job for qualified professionals.` },
      ],
    },
    {
      id: 'not-allowed',
      title: 'Not allowed at the Table',
      blocks: [
        {
          ul: [
            `Harassment, bullying, threats or intimidation.`,
            `Hateful or discriminatory content, including about anyone's race, ethnicity, religion, sex, gender identity, sexual orientation, disability or age.`,
            `Sexual content, or unwanted personal or romantic approaches.`,
            `Sharing anyone's private information, whether they're a member or not.`,
            `Content that encourages self-harm, suicide, disordered eating or dangerous challenges.`,
            `Selling, advertising, recruiting, affiliate links or fundraising, unless I've agreed to it.`,
            `Anything illegal, or that infringes someone else's copyright.`,
            `Pretending to be someone you're not. Use your real first name.`,
          ],
        },
      ],
    },
    {
      id: 'yourself',
      title: 'Look after yourself',
      blocks: [
        { p: `Share only what you're comfortable sharing. You can delete your own posts and replies at any time, and your Mirror answers stay private unless you choose to share them.` },
        { p: `The Table isn't a crisis service, and it isn't watched around the clock. If you or someone else is in danger, call 999. ${SUPPORT_LINES.replace(' In an emergency, call 999.', '')}` },
      ],
    },
    {
      id: 'worried',
      title: `If you're worried about someone`,
      blocks: [
        { p: `If something posted at the Table makes you worried about someone's safety, email me straight away at {{email}}. Please don't try to handle a crisis on your own.` },
      ],
    },
    {
      id: 'reporting',
      title: 'Reporting a problem',
      blocks: [
        { p: `If you see something that breaks these guidelines, email me at {{email}} with a description of the post and where it is. I read every report, I keep reports confidential, and I act on them as quickly as I can.` },
      ],
    },
    {
      id: 'moderation',
      title: `What I'll do`,
      blocks: [
        { p: `I may remove posts or replies that break these guidelines. Depending on how serious it is, I'll talk to you about it, pause your ability to post, or end your membership as set out in the [Membership Terms](#/terms). I also pin posts I think everyone should see.` },
        { p: `Pull up a chair. Be honest. Be kind. Seek discomfort.` },
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalSlug, LegalDoc> = { privacy, terms, guidelines };
export const LEGAL_ORDER: LegalSlug[] = ['privacy', 'terms', 'guidelines'];
export const LEGAL_LINK_LABELS: Record<LegalSlug, string> = {
  privacy: 'Privacy',
  terms: 'Terms',
  guidelines: 'Community guidelines',
};
