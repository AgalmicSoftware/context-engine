import styles from './QuestionStanceCard.module.scss';

export type QuestionStanceVote = -1 | 0 | 1;

export const selectConcreteQuestionStances = (votes: Array<number | null | undefined> = []): QuestionStanceVote[] =>
  (Array.isArray(votes) ? votes : []).filter(
    (vote): vote is QuestionStanceVote => vote === 1 || vote === 0 || vote === -1,
  );

export function QuestionStanceBar({ votes = [] }: { votes?: Array<number | null | undefined> }) {
  const concreteVotes = selectConcreteQuestionStances(votes);
  const agrees = concreteVotes.filter((vote) => vote === 1).length;
  const disagrees = concreteVotes.filter((vote) => vote === -1).length;
  const unsures = concreteVotes.filter((vote) => vote === 0).length;
  const denominator = concreteVotes.length || 1;
  const width = 200;
  const height = 30;
  const agreeWidth = (agrees / denominator) * width;
  const unsureWidth = (unsures / denominator) * width;
  const disagreeWidth = (disagrees / denominator) * width;

  return (
    <div className={styles.barContainer}>
      <svg
        width={width}
        height={height}
        className={styles.bar}
        role="img"
        aria-label={`Agree ${agrees}, unsure ${unsures}, disagree ${disagrees}`}
      >
        <rect x={0} y={0} width={width} height={height} fill="none" stroke="currentColor" strokeWidth={1} />
        {concreteVotes.length > 0 ? (
          <>
            <rect x={0} y={0} width={agreeWidth} height={height} fill="var(--ce-binary-choice-agree-bg)" />
            <rect x={agreeWidth} y={0} width={unsureWidth} height={height} fill="var(--ce-binary-choice-unsure-bg)" />
            <rect
              x={agreeWidth + unsureWidth}
              y={0}
              width={disagreeWidth}
              height={height}
              fill="var(--ce-binary-choice-disagree-bg)"
            />
          </>
        ) : null}
      </svg>
    </div>
  );
}
