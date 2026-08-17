import type { SyntheticEvent } from 'react';
import {
  getHistoricalFigureAvatarOrBlockie,
  getHistoricalFigureBlockie,
} from '../../utilities/ui/historicalFigureAvatars.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import { buildCompareSubjectsRoutePath } from './compareSubjectContract';
import { buildSimUserRelatedScoreClassName } from './simUserPageHelpers';
import styles from './SimUserPage.module.scss';

type SimRelatedFigureProps = {
  currentDisplayName: string;
  currentUsername: string;
  displayName: string;
  score: string;
  tone?: 'agree' | 'disagree';
  username: string;
};

const SimRelatedFigure = ({
  currentDisplayName,
  currentUsername,
  displayName,
  score,
  tone = 'agree',
  username,
}: SimRelatedFigureProps) => {
  const avatar = getHistoricalFigureAvatarOrBlockie(username, {
    preferBlockie: false,
    fallbackSeed: username,
  });
  const sessionSlug = (() => {
    try {
      return typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('session') || '' : '';
    } catch {
      return '';
    }
  })();
  const compareHref = buildPublicRoute(
    buildCompareSubjectsRoutePath({
      sessionSlug,
      subjects: [`sim:${currentUsername}`, `sim:${username}`],
    }),
  );
  const handleAvatarError = (event: SyntheticEvent<HTMLImageElement>) => {
    const fallbackSrc = getHistoricalFigureBlockie(username, { fallbackSeed: username });
    if (fallbackSrc && event.currentTarget.src !== fallbackSrc) event.currentTarget.src = fallbackSrc;
  };

  return (
    <div className={styles.relatedFigureRow}>
      <a href={buildPublicRoute(`/su/${username}`)} className={styles.relatedFigure}>
        <img src={avatar} alt={username} className={styles.relatedAvatar} onError={handleAvatarError} />
        <span className={styles.relatedName}>{displayName}</span>
        <span
          className={buildSimUserRelatedScoreClassName({
            baseClassName: styles.relatedScore,
            disagreeClassName: tone === 'disagree' ? styles.disagree : '',
          })}
        >
          {score}
        </span>
      </a>
      <a
        href={compareHref}
        className={styles.relatedCompareLink}
        aria-label={`Compare ${currentDisplayName} with ${displayName}`}
      >
        Compare
      </a>
    </div>
  );
};

export default SimRelatedFigure;
