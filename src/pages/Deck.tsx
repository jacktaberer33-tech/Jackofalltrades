import { useState } from 'react';
import { FEATURED_LESSON_ID, RANKS, SERIES, SUITS, TIER_RANK, canWatch, lessonById, rankName, tierById, unlockedBy, type SuitId } from '../content';
import { effectiveTier, isFilmed, useStore } from '../store';
import { Link } from '../router';
import { MiniCard, SuitMark } from '../components/Cards';
import { Icon } from '../components/Icon';
import { PageHeader, SuitFilter } from '../components/AppShell';
import { DealCard } from '../components/DealCard';

export function Deck() {
  const { state } = useStore();
  const tier = effectiveTier(state.member);
  const admin = !!state.member?.isAdmin;
  // A lesson is live once Jack attaches its video. He sees every lesson, so he can attach them.
  const filmed = (id: string) => isFilmed(state.filmed, id);
  const [filter, setFilter] = useState<SuitId | 'all'>('all');
  const [open, setOpen] = useState<string[]>(() => [lessonById(FEATURED_LESSON_ID)!.seriesId]);
  const toggleOpen = (id: string) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  return (
    <div className="stack-20">
      <PageHeader title="The Deck" sub="Four suits, thirteen cards each, Ace to King. Every card is a series of lessons." aside={<DealCard />} />
      <SuitFilter value={filter} onChange={setFilter} />

      {SUITS.filter((s) => filter === 'all' || filter === s.id).map((suit) => {
        const seriesList = SERIES.filter((s) => s.suit === suit.id);
        const dealt = seriesList.filter((s) => !s.comingSoon && !s.joker && s.lessons.some((l) => filmed(l.id))).length;
        return (
          <section key={suit.id} className="stack-10" aria-labelledby={`suit-${suit.id}`}>
            <div className="row-between">
              <h2 id={`suit-${suit.id}`} className="display-s"><SuitMark suit={suit.id} /> {suit.name}</h2>
              <span className="small muted">{dealt} of {RANKS.length} cards dealt</span>
            </div>
            {seriesList.map((series) => {
              const cardName = series.joker ? `${suit.name} Jokers` : `${rankName(series.rank)} of ${suit.name}`;
              const seriesLocked = TIER_RANK[tier] < TIER_RANK[series.minTier];
              const planPill = (series.joker || seriesLocked) && (
                <span className={`pill ${series.joker ? 'pill--accent' : ''}`}>
                  {seriesLocked && <Icon name="lock" size={12} />}
                  {series.joker ? 'Royal Flush only' : tierById(series.minTier).name}
                </span>
              );

              const live = series.lessons.filter((l) => filmed(l.id));
              if (series.comingSoon || (!admin && live.length === 0)) {
                return (
                  <article key={series.id} className="series series--soon" aria-label={`${cardName}: coming soon`}>
                    <div className="series__head">
                      <MiniCard suit={series.suit} faceDown />
                      <span className="grow stack-6">
                        <span className="series__title">{series.comingSoon ? 'Coming soon' : 'Filming now'} {planPill}</span>
                        <span className="small muted">{cardName} · not dealt yet</span>
                      </span>
                    </div>
                  </article>
                );
              }

              // Counts and progress go by the lessons that are out.
              const out = admin ? series.lessons : live;
              const done = out.filter((l) => state.completed.includes(l.id)).length;
              const isOpen = open.includes(series.id);
              const status = done === out.length ? 'Finished' : done === 0 ? 'Not started' : `${done} of ${out.length} done`;
              const lessonCount = live.length === series.lessons.length || admin
                ? `${series.lessons.length} lessons`
                : `${live.length} of ${series.lessons.length} lessons out`;
              return (
                <article key={series.id} className={`series ${series.joker ? 'series--joker' : ''}`}>
                  <button type="button" className="series__head" aria-expanded={isOpen} aria-controls={`series-${series.id}`} onClick={() => toggleOpen(series.id)}>
                    <MiniCard suit={series.suit} rank={series.rank} />
                    <span className="grow stack-6">
                      <span className="series__title">{series.title} {planPill}</span>
                      <span className="small muted">{cardName} · {lessonCount} · {status}</span>
                      <span className="meter" aria-hidden="true"><span style={{ width: `${out.length ? (done / out.length) * 100 : 0}%` }} /></span>
                    </span>
                    <span className={`series__chev ${isOpen ? 'is-open' : ''}`}><Icon name="chevronDown" size={20} /></span>
                  </button>
                  {isOpen && (
                    <ol id={`series-${series.id}`} className="lesson-list">
                      {series.lessons.map((lesson) => {
                        const complete = state.completed.includes(lesson.id);
                        const locked = !canWatch(tier, lesson);
                        if (!filmed(lesson.id) && !admin) {
                          return (
                            <li key={lesson.id}>
                              <div className="lesson-row lesson-row--soon" aria-label={`${lesson.title}: filming soon`}>
                                <span className="lesson-row__num">{lesson.number}</span>
                                <span className="grow">
                                  <span className="block strong">{lesson.title}</span>
                                  <span className="small muted">Filming soon</span>
                                </span>
                              </div>
                            </li>
                          );
                        }
                        return (
                          <li key={lesson.id}>
                            <Link to={`/lesson/${lesson.id}`} className="lesson-row">
                              <span className={`lesson-row__num ${complete ? 'is-done' : ''}`}>
                                {complete ? <Icon name="check" size={16} /> : lesson.number}
                              </span>
                              <span className="grow">
                                <span className="block strong">{lesson.title}</span>
                                <span className="small muted">
                                  {lesson.minutes} min
                                  {lesson.id === FEATURED_LESSON_ID && ' · This week'}
                                  {complete && ' · Finished'}
                                  {admin && !filmed(lesson.id) && ' · No video yet'}
                                </span>
                              </span>
                              {locked ? <span className="muted" aria-label={`${tierById(unlockedBy(lesson)).name} only`}><Icon name="lock" size={18} /></span> : <Icon name="chevronRight" size={18} />}
                            </Link>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
