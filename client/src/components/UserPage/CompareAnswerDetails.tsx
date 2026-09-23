import { useMemo, useState } from 'react';
import { validateQuadraticAllocation } from '../../../../shared/questions/quadraticAllocation.mjs';
import { resolveCompareCompassSeriesColor } from './compareAddressStyles';
import styles from './ComparePresentation.module.scss';
import { normalizeRatingScale } from '../../utilities/survey/ratingValue.js';

type Question = {
  id?: string;
  questionID?: string;
  questionId?: string;
  qId?: string;
  prompt?: string;
  type?: string;
  answer?: unknown;
  options?: unknown;
  scale?: unknown;
  ratingScale?: unknown;
  voiceCredits?: unknown;
  additionalComment?: string;
};
export type ComparisonUser = { address?: string; questions?: Question[] };
const types = {
  all: 'All',
  binary: 'Binary',
  multichoice: 'Multi-choice',
  rating: 'Rating',
  freeform: 'Freeform',
  quadratic: 'Quadratic',
};
type Filter = keyof typeof types;
const normalizeType = (type = '') =>
  ({
    text: 'freeform',
    open: 'freeform',
    'open-ended': 'freeform',
    scale: 'rating',
    likert: 'rating',
    multi: 'multichoice',
    multiple: 'multichoice',
    'multi-choice': 'multichoice',
    multi_choice: 'multichoice',
    multi_select: 'multichoice',
    'multi-select': 'multichoice',
  })[type.toLowerCase()] || type.toLowerCase();
const unwrap = (answer: unknown): unknown =>
  answer && typeof answer === 'object' && !Array.isArray(answer) && 'value' in answer ? answer.value : answer;
const missing = (answer: unknown) => answer == null || answer === '*' || answer === '';
const textValue = (answer: unknown) => (['string', 'number', 'boolean'].includes(typeof answer) ? String(answer) : '');
const binaryLabel = (answer: unknown) => {
  const value = textValue(answer).toLowerCase();
  if (['1', 'agree', 'yes', 'true', 'strongly agree'].includes(value)) return 'Agree';
  if (['-1', 'disagree', 'no', 'false', 'strongly disagree'].includes(value)) return 'Disagree';
  if (['0', 'neutral', 'unsure'].includes(value)) return 'Unsure';
  return textValue(answer) || 'No visible answer';
};
const letter = (index: number) => String.fromCharCode(65 + index);
function Identity({ index }: { index: number }) {
  return (
    <strong className={styles.answerIdentity}>
      <span aria-hidden="true" style={{ color: resolveCompareCompassSeriesColor(index) }}>
        {index % 2 ? '◆' : '●'}
      </span>{' '}
      {letter(index)}
    </strong>
  );
}
function SignedBar({ value, max, index }: { value: number; max: number; index: number }) {
  return (
    <div className={styles.voteRow}>
      <Identity index={index} />
      <div className={styles.voteTrack}>
        <span className={styles.voteZero} />
        <span
          className={styles.voteBar}
          style={{
            left: `${value < 0 ? 50 - (Math.abs(value) / max) * 50 : 50}%`,
            width: `${(Math.abs(value) / max) * 50}%`,
            background: resolveCompareCompassSeriesColor(index),
          }}
        />
      </div>
      <span>{value < 0 ? `−${Math.abs(value)}` : value > 0 ? `+${value}` : '0'}</span>
    </div>
  );
}
export default function CompareAnswerDetails({ users }: { users: ComparisonUser[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const entries = useMemo(() => {
    const map = new Map<string, { question: Question; answers: Map<number, Question> }>();
    users.forEach((user, index) =>
      user.questions?.forEach((question) => {
        const id = String(
          question.id || question.questionID || question.questionId || question.qId || '',
        ).toLowerCase();
        if (!id) return;
        const entry = map.get(id) || { question, answers: new Map<number, Question>() };
        entry.answers.set(index, question);
        map.set(id, entry);
      }),
    );
    return [...map.entries()];
  }, [users]);
  const filtered = entries.filter(([, entry]) => filter === 'all' || normalizeType(entry.question.type) === filter);
  return (
    <div className={styles.answerDetails}>
      <div className={styles.filters} role="group" aria-label="Answer types">
        {Object.entries(types).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key as Filter)}>
            {label}
          </button>
        ))}
      </div>
      {filtered.length === 0 && <p>No visible answers of this type.</p>}
      {filtered.map(([id, { question, answers }]) => {
        const type = normalizeType(question.type);
        const scale = normalizeRatingScale(question);
        const options = Array.isArray(question.options)
          ? question.options.filter((v): v is string => typeof v === 'string')
          : [];
        const values = users.map((_, index) => unwrap(answers.get(index)?.answer));
        const validVotes = values.map((value) =>
          Array.isArray(value) && !validateQuadraticAllocation(value, question) ? (value as number[]) : null,
        );
        const maxVote = Math.max(1, ...validVotes.flatMap((value) => value || []).map(Math.abs));
        const selections = values.map((value) =>
          missing(value) ? null : (Array.isArray(value) ? value : [value]).map(textValue).filter(Boolean),
        );
        const choiceOptions = [...new Set([...options, ...selections.flatMap((value) => value || [])])];
        return (
          <section key={id} className={styles.question}>
            <span className={styles.questionType}>{types[type as Filter] || 'Answer'}</span>
            <h4>{question.prompt || 'Question'}</h4>
            {type === 'multichoice' ? (
              <div className={styles.tableScroll}>
                <table>
                  <caption className={styles.srOnly}>Selected options by participant</caption>
                  <thead>
                    <tr>
                      <th scope="col">Option</th>
                      {users.map((_, index) => (
                        <th scope="col" key={index}>
                          <Identity index={index} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {choiceOptions.map((option) => (
                      <tr key={option}>
                        <th scope="row">{option}</th>
                        {selections.map((selection, index) => (
                          <td key={index}>
                            {selection === null ? (
                              <span>No visible answer</span>
                            ) : (
                              <span aria-label={selection.includes(option) ? 'Selected' : 'Not selected'}>
                                {selection.includes(option) ? '✓' : '—'}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : type === 'quadratic' ? (
              <div>
                <p className={styles.provenance}>Against ← Votes → For · 0 is neutral</p>
                {options.map((option, optionIndex) => (
                  <div key={option} className={styles.voteOption}>
                    <strong>{option}</strong>
                    {validVotes.map((votes, index) =>
                      votes ? (
                        <SignedBar key={index} index={index} value={votes[optionIndex]} max={maxVote} />
                      ) : (
                        <p key={index}>
                          <Identity index={index} />{' '}
                          {missing(values[index]) ? 'No visible answer' : 'Invalid allocation'}
                        </p>
                      ),
                    )}
                  </div>
                ))}
              </div>
            ) : type === 'rating' ? (
              <div>
                <div className={styles.ratingEndpoints}>
                  <span>
                    {scale.minLabel} ({scale.min})
                  </span>
                  <span>
                    {scale.maxLabel} ({scale.max})
                  </span>
                </div>
                {values.map((value, index) => {
                  const number = Number(value);
                  const valid =
                    !missing(value) &&
                    ['number', 'string'].includes(typeof value) &&
                    Number.isFinite(number) &&
                    number >= scale.min &&
                    number <= scale.max;
                  return (
                    <div key={index} className={styles.voteRow}>
                      <Identity index={index} />
                      {valid ? (
                        <>
                          <div className={styles.ratingTrack}>
                            <span
                              className={styles.ratingPoint}
                              style={{
                                left: `${((number - scale.min) / (scale.max - scale.min)) * 100}%`,
                                color: resolveCompareCompassSeriesColor(index),
                              }}
                              aria-hidden="true"
                            >
                              {index % 2 ? '◆' : '●'}
                            </span>
                          </div>
                          <span>{number}</span>
                        </>
                      ) : (
                        <span>{missing(value) ? 'No visible answer' : 'Invalid rating'}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.answerPair}>
                {values.map((value, index) => (
                  <div key={index} className={styles.answerCell}>
                    <Identity index={index} />
                    {missing(value) ? (
                      <span>No visible answer</span>
                    ) : type === 'freeform' ? (
                      <blockquote>{textValue(value) || 'No visible answer'}</blockquote>
                    ) : (
                      <span className={styles.answerPill}>
                        {type === 'binary' ? binaryLabel(value) : textValue(value) || 'No visible answer'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {users.map(
              (_, index) =>
                answers.get(index)?.additionalComment && (
                  <p key={index} className={styles.comment}>
                    <Identity index={index} /> {answers.get(index)?.additionalComment}
                  </p>
                ),
            )}
          </section>
        );
      })}
    </div>
  );
}
