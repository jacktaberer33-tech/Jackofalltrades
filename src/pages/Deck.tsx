import { useState } from 'react';
import { FEATURED_LESSON_ID, SERIES, SUITS, TIER_RANK, canWatch, lessonById, tierById, unlockedBy, type SuitId } from '../content';
import { effectiveTier, useStore } from '../store';
import { Link } from '../router';
import { MiniCard, SuitMark } from '../components/Cards';
import { Icon } from '../components/Icon';
import { PageHeader, SuitFilter } from '../components/AppShell';

export function Deck() {
  const { state } = useStore();
  const tier = effectiveTier(state.member);
  const [filter, setFilter] = useState<SuitId | 'all'>('all');
  const [open, setOpen] = useState<string[]>(() => [lessonById(FEATURED_LESSON_ID)!.seriesId]);
  const toggleOpen = (id: string) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  return (
    <div className="stack-20">
      <PageHeader title="The Deck" sub="Every lesson, dealt into four suits." />
      <SuitFilter value={filter} onChange={setFilter} />

      {SUITS.filter((s) => filter === 'all' || filter === s.id).map((suit) => {
        const seriesList = SERIES.filter((s) => s.suit === suit.id);
        return (
          <section key={suit.id} className="stack-10" aria-labelledby={`suit-${suit.id}`}>
            <div className="row-between">
              <h2 id={`suit-${suit.id}`} className="display-s"><SuitMark suit={suit.id} /> {suit.name}</h2>
              <span className="small muted">{seriesList.length} series</span>
            </div>
            {seriesList.map((series) => {
              const done = series.lessons.filter((l) => state.completed.includes(l.id)).length;
              const isOpen = open.includes(series.id);
              const status = done === series.lessons.length ? 'Finished' : done === 0 ? 'Not started' : `${done} of ${series.lessons.length} done`;
              const seriesLocked = TIER_RANK[tier] < TIER_RANK[series.minTier];
              return (
                <article key={series.id} className={`series ${series.joker ? 'series--joker' : ''}`}>
                  <button type="button" className="series__head" aria-expanded={isOpen} aria-controls={`series-${series.id}`} onClick={() => toggleOpen(series.id)}>
                    <MiniCard suit={series.suit} />
                    <span className="grow stack-6">
                      <span className="series__title">
                        {series.title}
                        {(series.joker || seriesLocked) && (
                          <span className={`pill ${series.joker ? 'pill--accent' : ''} series__plan`}>
                            {seriesLocked && <Icon name="lock" size={12} />}
                            {series.joker ? 'Royal Flush only' : tierById(series.minTier).name}
                          </span>
                        )}
                      </span>
                      <span className="small muted">{series.lessons.length} lessons · {status}</span>
                      <span className="meter" aria-hidden="true"><span style={{ width: `${(done / series.lessons.length) * 100}%` }} /></span>
                    </span>
                    <span className={`series__chev ${isOpen ? 'is-open' : ''}`}><Icon name="chevronDown" size={20} /></span>
                  </button>
                  {isOpen && (
                    <ol id={`series-${series.id}`} className="lesson-list">
                      {series.lessons.map((lesson) => {
                        const complete = state.completed.includes(lesson.id);
                        const locked = !canWatch(tier, lesson);
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
