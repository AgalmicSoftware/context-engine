import examples from '../../variables/demo/polis_report_answer_examples.json';
import legacyDemoData from '../../variables/demo/demo_polis_data.json';
import { LEGACY_DEMO_POLL_OPTIONS } from './demoQuestionSemantics';

type RecordValue = Record<string, unknown>;
const extendedDatasets = new WeakMap<object, RecordValue>();

// Report-only examples must not change published question IDs, seeded Worker
// data, or the binary votes that produced the existing opinion groups.
export function withPolisReportDemoAnswers(source: unknown): unknown {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return source;
  const cached = extendedDatasets.get(source);
  if (cached) return cached;
  const dataset = source as RecordValue;
  if (!Array.isArray(dataset.comments) || !Array.isArray(dataset.participantsVotes)) return source;
  const originalComments = dataset.comments as RecordValue[];
  const comments = originalComments.map((comment) =>
    source === legacyDemoData && comment.type === 'poll'
      ? { ...comment, options: [...LEGACY_DEMO_POLL_OPTIONS] }
      : comment,
  );
  comments.push(
    ...examples.map(({ id, prompt, answers: _answers, ...question }) => ({
      ...question,
      commentId: id,
      commentBody: prompt,
    })),
  );
  const participantsVotes = (dataset.participantsVotes as RecordValue[]).map((participant, index) => {
    const responses = { ...(participant.responses as RecordValue | undefined) };
    examples.forEach((question, questionIndex) => {
      if (index >= question.answers.length) return;
      responses[originalComments.length + questionIndex] = { value: question.answers[index] };
    });
    return { ...participant, responses };
  });
  const extended = { ...dataset, comments, participantsVotes };
  extendedDatasets.set(source, extended);
  extendedDatasets.set(extended, extended);
  return extended;
}
