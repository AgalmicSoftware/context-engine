/** @file UseCaseLoop.tsx: the short silent animation shown beside a use case on the About page. */
import { useEffect, useRef, useState } from 'react';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import styles from './AboutPage.module.scss';

type UseCaseLoopProps = {
  /** A `USE_CASES` slug; the loop's files are named after it. */
  slug: string;
  /** What the loop shows, for people who can't see it. */
  title: string;
};

// Written out in full, so the check that every public file is used can find each one.
const LOOP_FILES: Record<string, { video: string; poster: string }> = {
  'ai-discourse': {
    video: '/about/use-cases/ai-discourse-720p.mp4',
    poster: '/about/use-cases/ai-discourse-poster.jpg',
  },
  corporate: { video: '/about/use-cases/corporate-720p.mp4', poster: '/about/use-cases/corporate-poster.jpg' },
  cities: { video: '/about/use-cases/cities-720p.mp4', poster: '/about/use-cases/cities-poster.jpg' },
  conferences: { video: '/about/use-cases/conferences-720p.mp4', poster: '/about/use-cases/conferences-poster.jpg' },
  'digital-groups': {
    video: '/about/use-cases/digital-groups-720p.mp4',
    poster: '/about/use-cases/digital-groups-poster.jpg',
  },
};

// These two loops show roadmap work, so a line above each says so; the films themselves are left as they are.
const FUTURE_LOOPS = new Set(['corporate', 'digital-groups']);

/** Whether a use case's loop shows features that are not built yet. */
export const showsFutureFeatures = (slug: string): boolean => FUTURE_LOOPS.has(slug);

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Mounted afresh for each use case opened (the page keys it by slug), so nothing is fetched until a person asks
 * for it and one film's last frame or failure never carries over to the next. It plays silently on
 * a loop; someone who asked their device for less motion gets the first frame and a play button instead.
 */
const UseCaseLoop = ({ slug, title }: UseCaseLoopProps) => {
  const files = LOOP_FILES[slug];
  const still = prefersReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // A browser may refuse to start a video by itself (a phone saving power or data): the person gets the play
  // control then. A loop that can't be loaded at all is left out, so no empty frame is shown.
  const [needsControls, setNeedsControls] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (still) return;
    videoRef.current?.play?.()?.catch(() => setNeedsControls(true));
  }, [still]);
  // A use case added without a loop shows its words alone.
  if (!files || failed) return null;
  return (
    <figure className={styles.useCaseLoop}>
      {showsFutureFeatures(slug) ? (
        <p className={styles.useCaseLoopNotice}>This animation shows future features.</p>
      ) : null}
      <video
        className={styles.useCaseLoopVideo}
        src={buildPublicRoute(files.video)}
        poster={buildPublicRoute(files.poster)}
        width={1280}
        height={720}
        muted
        loop
        playsInline
        autoPlay={!still}
        controls={still || needsControls}
        ref={videoRef}
        onError={() => setFailed(true)}
        preload={still ? 'none' : 'metadata'}
        aria-label={`${title}: an illustrative animation`}
        data-testid="ce-about-use-case-loop"
      />
    </figure>
  );
};

export default UseCaseLoop;
