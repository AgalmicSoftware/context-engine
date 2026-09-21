import React, { useId, useState } from 'react';
import { answerTypeTitles, type AnswerType, type ReportAnswerQuestion } from './polisReportAnswers';
import styles from './PolisAnswerSections.module.scss';

const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0');
const tone = (value: number) => (value > 0 ? styles.positive : value < 0 ? styles.negative : '');

function AnswerChart({ question, showAll }: { question: ReportAnswerQuestion; showAll: boolean }) {
  if (question.type === 'freeform') {
    const texts = showAll ? question.texts : question.texts.slice(0, 3);
    return (
      <div className={styles.written}>
        {texts.map((text, index) => (
          <p data-pdf-keep-together key={index}>
            {text}
          </p>
        ))}
      </div>
    );
  }
  if (question.type === 'rating') {
    const peak = Math.max(1, ...question.bins.map((bin) => bin.count));
    return (
      <div className={styles.rating}>
        <div className={styles.average}>
          <strong>
            {question.average.toFixed(1)} / {question.max}
          </strong>
          <span>Average</span>
        </div>
        <svg
          role="img"
          aria-label={`Rating distribution, ${question.min} to ${question.max}. ${question.bins.map((bin) => `${bin.score}: ${bin.count}`).join('; ')}`}
          viewBox="0 0 440 142"
          className={styles.histogram}
        >
          <line x1="12" y1="114" x2="432" y2="114" stroke="currentColor" />
          {question.bins.map((bin, index) => {
            const width = 420 / question.bins.length;
            const height = (bin.count / peak) * 86;
            return (
              <g key={index}>
                <rect
                  x={12 + index * width + 3}
                  y={114 - height}
                  width={width - 6}
                  height={height}
                  className={styles.histogramBar}
                />
                {bin.count > 0 && (
                  <text x={12 + (index + 0.5) * width} y={107 - height} textAnchor="middle">
                    {bin.count}
                  </text>
                )}
                <text x={12 + (index + 0.5) * width} y="135" textAnchor="middle">
                  {Number(bin.score.toFixed(1))}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }
  if (question.type === 'multichoice')
    return (
      <ul className={styles.choices} aria-label="Multiple choice results">
        {question.options.map((option, index) => (
          <li key={index}>
            <span>{option.label}</span>
            <svg className={styles.choiceTrack} viewBox="0 0 100 16" preserveAspectRatio="none" aria-hidden="true">
              <rect width="100" height="16" className={styles.choiceTrackBg} />
              <rect width={(option.count / question.count) * 100} height="16" className={styles.choiceBar} />
            </svg>
            <span className={styles.numeric}>
              {Math.round((option.count / question.count) * 100)}% ({option.count})
            </span>
          </li>
        ))}
      </ul>
    );
  const max = Math.max(1, ...question.options.flatMap((option) => [option.positive, -option.negative]));
  return (
    <div className={styles.quadratic}>
      <div className={styles.legend}>
        <span className={styles.negative}>− Oppose</span>
        <span className={styles.positive}>+ Support</span>
        <span>Net</span>
      </div>
      <ul aria-label="Quadratic allocation results">
        {question.options.map((option, index) => (
          <li key={index}>
            <span className={styles.optionLabel}>{option.label}</span>
            <div className={styles.diverging}>
              <div className={styles.leftHalf}>
                <span className={styles.negative}>{signed(option.negative)}</span>
                <i style={{ width: `${(-option.negative / max) * 100}%` }} />
              </div>
              <div className={styles.rightHalf}>
                <i style={{ width: `${(option.positive / max) * 100}%` }} />
                <span className={styles.positive}>{signed(option.positive)}</span>
              </div>
            </div>
            <strong className={`${styles.numeric} ${tone(option.net)}`}>{signed(option.net)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

type AnswerSectionType = AnswerType | 'binary';
const sectionTitles = { binary: 'Binary', ...answerTypeTitles };
export type AnswerSectionsOpen = Partial<Record<AnswerSectionType, boolean>>;

export default function PolisAnswerSections({
  questions,
  pdfMode = false,
  openSections,
  onToggleSection,
  renderBinaryQuestions,
  binaryQuestionCount = 0,
}: {
  questions: ReportAnswerQuestion[];
  pdfMode?: boolean;
  openSections?: AnswerSectionsOpen;
  onToggleSection?: (type: AnswerSectionType) => void;
  renderBinaryQuestions?: (heading: React.ReactNode, limit?: number) => React.ReactNode;
  binaryQuestionCount?: number;
}) {
  const id = useId();
  const [localOpen, setLocalOpen] = useState<AnswerSectionsOpen>({});
  const [expanded, setExpanded] = useState<AnswerSectionsOpen>({});
  const toggleSection =
    onToggleSection || ((type: AnswerSectionType) => setLocalOpen((prev) => ({ ...prev, [type]: !prev[type] })));
  return (
    <div className={styles.sections} data-testid="ce-polis-answer-sections">
      {(Object.keys(sectionTitles) as AnswerSectionType[]).map((type) => {
        const items = questions.filter((question) => question.type === type);
        if (type === 'binary' ? !renderBinaryQuestions : !items.length) return null;
        const open = pdfMode || !!(openSections || localOpen)[type];
        const showAll = pdfMode || !!expanded[type];
        // One disclosure reveals both hidden questions and hidden written answers.
        const remaining =
          type === 'binary'
            ? Math.max(0, binaryQuestionCount - 5)
            : type === 'freeform'
              ? items.reduce((sum, question) => sum + question.texts.length, 0) - Math.min(3, items[0].texts.length)
              : Math.max(0, items.length - 1);
        const bodyId = `${id}-${type}`;
        return (
          <section key={type} aria-label={sectionTitles[type]} data-testid={`ce-polis-answers-${type}`}>
            {!pdfMode && (
              <h3 className={styles.sectionHeading}>
                <button
                  type="button"
                  className={styles.sectionToggle}
                  aria-expanded={open}
                  aria-controls={bodyId}
                  onClick={() => toggleSection(type)}
                >
                  <span className={styles.caret} aria-hidden="true">
                    {open ? '▾' : '▸'}
                  </span>
                  {sectionTitles[type]}
                </button>
              </h3>
            )}
            {open && (
              <div id={bodyId} className={styles.sectionContent}>
                {type === 'binary'
                  ? renderBinaryQuestions?.(pdfMode ? <h3>{sectionTitles.binary}</h3> : null, showAll ? undefined : 5)
                  : (showAll ? items : items.slice(0, 1)).map((question, index) => (
                      <article key={question.id} data-pdf-keep-together className={styles.question}>
                        {pdfMode && index === 0 && <h3>{sectionTitles[type]}</h3>}
                        <div className={styles.questionHeading} data-pdf-keep-together>
                          <h4>{question.prompt}</h4>
                          <span>
                            {question.count} {question.count === 1 ? 'response' : 'responses'}
                          </span>
                        </div>
                        <AnswerChart question={question} showAll={showAll} />
                      </article>
                    ))}
                {!pdfMode && remaining > 0 && (
                  <button
                    type="button"
                    className={styles.more}
                    aria-expanded={showAll}
                    aria-controls={bodyId}
                    title={
                      showAll
                        ? 'Return to the question preview'
                        : `Show ${remaining} more ${type === 'freeform' ? 'written responses' : 'questions'}`
                    }
                    onClick={() => setExpanded((prev) => ({ ...prev, [type]: !prev[type] }))}
                  >
                    {showAll ? 'View less' : `View more (${remaining})`}
                  </button>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
