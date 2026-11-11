import { useEffect, useState } from 'react';
import { lessonById, rankName, seriesById, suitById } from '../content';
import { useStore } from '../store';
import { Icon } from './Icon';

/**
 * The join page's "watch one now": the single free lesson Jack has put on the front page, playable
 * without an account. Nothing shows until that lesson exists, so the page never has an empty player.
 */
export function FrontLesson({ onJoin }: { onJoin: () => void }) {
  const { actions } = useStore();
  const [front, setFront] = useState<{ lessonId: string; url: string } | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let live = true;
    void actions.frontLesson().then((f) => { if (live) setFront(f); });
    return () => { live = false; };
  }, [actions]);

  const lesson = front ? lessonById(front.lessonId) : undefined;
  if (!front || !lesson) return null;
  const suit = suitById(lesson.suit);
  const series = seriesById(lesson.seriesId);
  const cardName = series ? `${rankName(series.rank)} of ${suit.name}` : suit.name;

  return (
    <section id="watch" className="band band--block" aria-labelledby="watch-title">
      <div className="wrap front-lesson">
        <div className="front-lesson__copy stack-12">
          <p className="eyebrow eyebrow--on-block">Watch one now · no sign-up</p>
          <h2 id="watch-title" className="display-l">{lesson.title}</h2>
          <p className="lede lede--on-block">{lesson.summary}</p>
          <div className="front-lesson__mirror stack-6">
            <p className="eyebrow eyebrow--on-block">The Mirror</p>
            <p className="front-lesson__question">{lesson.mirror}</p>
          </div>
          <div className="row-wrap">
            <button type="button" className="btn btn--accent btn--lg" onClick={onJoin}>Join free to answer it</button>
          </div>
        </div>
        <div className="front-lesson__player">
          <div className="video">
            {playing ? (
              <iframe
                className="video__player"
                src={front.url}
                title={`Lesson video: ${lesson.title}`}
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            ) : (
              <button type="button" className="front-lesson__poster" onClick={() => setPlaying(true)} aria-label={`Play the lesson: ${lesson.title}`}>
                <span className={`front-lesson__pip ${suit.red ? 'is-red' : ''}`} aria-hidden="true">{suit.symbol}</span>
                <span className="play-dot front-lesson__play"><Icon name="play" size={22} /></span>
                <span className="front-lesson__label">{cardName} · {lesson.minutes} min · free</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
