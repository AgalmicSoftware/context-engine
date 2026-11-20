import { useId, useState } from 'react';
import ElapsedLoadingLabel from '../Shared/ElapsedLoadingLabel';
import type { CompareSummary } from '../../utilities/ai/aiCompareContracts';
import CompareAnswerDetails from './CompareAnswerDetails';
import CompareAnswerStrips from './CompareAnswerStrips';
import type { ComparisonUser } from './compareAnswers';
import CompareStand from './CompareStand';
import type { ComparisonCompass } from './compareStandDimensions';
import CompareSummaryCards from './CompareSummaryCards';
import styles from './ComparePresentation.module.scss';

export type ComparisonGeneration = { model: string; provider: string; source: 'reported' | 'requested' | 'mock' };

type Props = {
  users: ComparisonUser[];
  labels: string[];
  result: CompareSummary | null;
  compass: ComparisonCompass | null;
  axesSource: 'ai' | 'fallback' | 'mock';
  generation: ComparisonGeneration | null;
  /** Why there is no AI summary, shown beside the note that the comparison is local. */
  aiUnavailableReason?: string;
  bulletsLoading?: boolean;
  compassLoading?: boolean;
  opinionComparable?: boolean;
  /** Questions every person compared answered visibly; counted when the AI gives no headline. */
  sharedQuestionCount?: number;
  /** The viewer is one of the people compared, so the strips can say "you". */
  viewerCompared?: boolean;
};
export default function ComparePresentation({
  users,
  labels,
  result,
  compass,
  axesSource,
  generation,
  aiUnavailableReason = '',
  bulletsLoading = false,
  compassLoading = false,
  opinionComparable = true,
  sharedQuestionCount = 0,
  viewerCompared = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  return (
    <div className={styles.presentation}>
      <section aria-label="Comparison summary" aria-busy={bulletsLoading}>
        {bulletsLoading ? (
          <p role="status">
            <ElapsedLoadingLabel label="Loading summary…" />
          </p>
        ) : (
          <>
            {!generation && (
              <p className={styles.provenance}>
                Local comparison · AI summary unavailable{aiUnavailableReason ? `: ${aiUnavailableReason}` : ''}
              </p>
            )}
            <CompareSummaryCards
              summary={result}
              labels={labels}
              people={users.length}
              sharedQuestions={sharedQuestionCount}
            />
          </>
        )}
      </section>
      <CompareStand
        users={users}
        labels={labels}
        compass={compass}
        axesSource={axesSource}
        loading={compassLoading}
        opinionComparable={opinionComparable}
      />
      <CompareAnswerStrips users={users} labels={labels} viewerCompared={viewerCompared} />
      {!bulletsLoading && (
        <p className={`${styles.provenance} ${styles.foot}`}>
          {generation?.source === 'mock' ? (
            'Illustrative summary for preview'
          ) : (
            <>
              Based on visible answers and available activity.
              {generation && (
                <>
                  {' · '}
                  <span>{`${generation.source === 'requested' ? 'Requested model' : 'Model'}: ${generation.model}`}</span>
                </>
              )}
            </>
          )}
        </p>
      )}
      <button
        type="button"
        className={styles.explore}
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((value) => !value)}
        data-testid="ce-compare-explore"
      >
        <span>
          <strong>Explore answers</strong>
          <span className={styles.exploreHint}>Binary · Multi-choice · Rating · Freeform · Quadratic</span>
        </span>
        <span aria-hidden="true">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <div id={detailsId}>
          <CompareAnswerDetails users={users} />
        </div>
      )}
    </div>
  );
}
