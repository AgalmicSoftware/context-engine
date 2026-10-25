// The review stamps each draft's research record with the session's research
// detail and where the draft came from.
import { recordInterviewProvenance } from './SurveyPileViewMode';
import { keepConsentWithdrawals } from './sessionInterviewConsent';

jest.mock('./CreateQuestionsAndSurveys', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionListeningPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionVoiceModeModal', () => ({ __esModule: true, default: () => null }));

const SOURCE = { platform: 'claude', modelId: 'claude-example', verification: 'self_reported' };
const PACKET = { promptVersion: 'ce-interview-brief-v5', questionSetHash: 'a'.repeat(64), source: SOURCE };

const fakeEngine = (sessionConfig) => ({
  props: { sessionConfig },
  state: { surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }] },
  getChangedQidsAndFields: () => ({ changedQids: new Set(['q1']) }),
  persistDraft: () => {},
  setState(updater, callback) {
    this.state = { ...this.state, ...updater(this.state) };
    callback?.();
  },
});

const drafts = [
  { questionId: 'q1', answer: 'Agree', revisions: [{ revision: 1, modelId: 'claude-example', answer: 'Agree' }] },
];
const review = [
  { ...drafts[0], selected: true, original: drafts[0] },
  { questionId: 'q2', answer: 'Disagree', selected: false, original: { questionId: 'q2', answer: 'Disagree' } },
];
const recordFor = async (sessionConfig) => {
  const engine = fakeEngine(sessionConfig);
  await recordInterviewProvenance(engine, drafts, SOURCE, PACKET, true, true, '', review);
  return engine.state.surveysResponseState[0].interviewProvenance.q1;
};

it('records minimal detail by default and leaves out drafts for skipped questions', async () => {
  const record = await recordFor({ slug: 'demo' });
  expect(record).toMatchObject({ researchTier: 'minimal', draftOrigin: 'external_prefill' });
  expect(record.unselectedDrafts).toBeUndefined();
});

it('keeps drafts for skipped questions at full detail', async () => {
  const record = await recordFor({ slug: 'demo', interviewMode: { researchDetail: 'full' } });
  expect(record.researchTier).toBe('full');
  expect(record.unselectedDrafts).toEqual([expect.objectContaining({ questionId: 'q2' })]);
});

it('leaves hidden drafts the person never answered out of the skipped-question drafts', async () => {
  const engine = fakeEngine({ slug: 'demo', interviewMode: { researchDetail: 'full' } });
  const hidden = {
    questionId: 'q3',
    answer: undefined,
    selected: false,
    original: { questionId: 'q3', answer: 'Agree' },
  };
  await recordInterviewProvenance(engine, drafts, SOURCE, PACKET, true, true, '', [
    ...review,
    { ...hidden, predictionCondition: 'blind' },
  ]);
  const { unselectedDrafts } = engine.state.surveysResponseState[0].interviewProvenance.q1;
  expect(unselectedDrafts.map((entry) => entry.questionId)).toEqual(['q2']);
});

it('labels voice drafts that did not come from a prefill packet', async () => {
  const engine = fakeEngine({ slug: 'demo' });
  const voiceDrafts = [
    { questionId: 'q1', answer: 'Agree', revisions: [{ revision: 1, modelId: 'gpt-realtime', answer: 'Agree' }] },
  ];
  await recordInterviewProvenance(engine, voiceDrafts, null, null, true, true, '', []);
  expect(engine.state.surveysResponseState[0].interviewProvenance.q1.draftOrigin).toBe('voice_interview');
});

it('records minimal detail when that is what the participant was shown, even if the session now asks for full', async () => {
  const engine = fakeEngine({ slug: 'demo', interviewMode: { researchDetail: 'full' } });
  await recordInterviewProvenance(engine, drafts, SOURCE, PACKET, true, true, '', review, {
    researchDetail: 'minimal',
  });
  const record = engine.state.surveysResponseState[0].interviewProvenance.q1;
  expect(record.researchTier).toBe('minimal');
  expect(record.unselectedDrafts).toBeUndefined();
});

it('records whether the AI draft was shown or hidden, with the answer given before the reveal', async () => {
  const engine = fakeEngine({ slug: 'demo' });
  const both = [
    ...drafts,
    { questionId: 'q3', answer: 'Agree', revisions: [{ revision: 1, modelId: 'claude-example', answer: 'Agree' }] },
  ];
  const reviewed = [
    { ...both[0], selected: true, original: both[0] },
    {
      questionId: 'q3',
      answer: 'Unsure',
      selected: true,
      original: both[1],
      predictionCondition: 'blind',
      blindAnswer: 'Disagree',
      revealedAt: 1234,
    },
  ];
  await recordInterviewProvenance(engine, both, SOURCE, PACKET, true, true, '', reviewed);
  const { q1, q3 } = engine.state.surveysResponseState[0].interviewProvenance;
  expect(q1.predictionCondition).toBe('shown');
  expect(q1).not.toHaveProperty('blindAnswer');
  expect(q3).toMatchObject({ predictionCondition: 'blind', blindAnswer: 'Disagree', revealedAt: 1234 });
  expect(q3.originalPrediction.answer).toBe('Agree');
});

it('withdrawing research consent removes the tier and origin with the rest of the research', () => {
  const kept = keepConsentWithdrawals(
    {
      includePredictionComparison: true,
      predictionComparison: { version: 2 },
      originalPrediction: { answer: 'Agree' },
      researchTier: 'minimal',
      draftOrigin: 'external_prefill',
      predictionCondition: 'blind',
      blindAnswer: 'Disagree',
      revealedAt: 1234,
    },
    { includePredictionComparison: false },
  );
  expect(kept).toMatchObject({ includePredictionComparison: false });
  expect(kept).not.toHaveProperty('researchTier');
  expect(kept).not.toHaveProperty('draftOrigin');
  for (const key of ['predictionCondition', 'blindAnswer', 'revealedAt']) expect(kept).not.toHaveProperty(key);
  expect(kept).not.toHaveProperty('predictionComparison');
});
