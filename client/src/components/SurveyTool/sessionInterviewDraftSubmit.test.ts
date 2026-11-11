import { runInterviewDraftSubmit } from './sessionInterviewDraftSubmit';
import { buildUnselectedInterviewResearch } from './sessionInterviewResearch';
import type { InterviewDraftResponse } from './sessionInterview';

const draft = { questionId: 'q1', answer: 'Yes', additionalComments: 'From my AI' };
const leftOut = { questionId: 'q2', answer: 'No', additionalComments: 'AI note' };

// Submits q1 and leaves q2 out; `edited` holds the cards' states, `responses` what review reads now.
const run = async (edited: Record<string, InterviewDraftResponse>, responses: Record<string, unknown>) => {
  const onApplyAdditional = jest.fn();
  const onRecordProvenance = jest.fn();
  await runInterviewDraftSubmit({
    activeSubmitContextToken: 'context',
    authenticatedForSubmit: true,
    baseSubmitContextToken: 'context',
    drafts: [draft, leftOut],
    editedDrafts: edited,
    earlierResponses: () => responses,
    hasAiPrefill: false,
    includePredictionComparison: false,
    includeProvenance: false,
    includeResponderName: false,
    isInterviewBusy: false,
    researchAvailable: false,
    responderContext: '',
    responseStateReadyForSubmit: true,
    selected: { q1: true },
    transcript: '',
    applyingRef: { current: false },
    disposedRef: { current: false },
    mappingRef: { current: false },
    pendingSubmitActiveContextRef: { current: '' },
    pendingSubmitBaseContextRef: { current: '' },
    prefillPacket: null,
    isSubmitContextCurrent: () => true,
    onApplyAdditional,
    onApplyAnswer: jest.fn(),
    onApplyConviction: jest.fn(),
    onApplyImportance: jest.fn(),
    onRecordProvenance,
    onSubmitResponses: jest.fn(async () => ({ status: 'submitted' as const })),
    setApplying: jest.fn(),
    setError: jest.fn(),
    setPendingSubmitAfterLogin: jest.fn(),
    setStatus: jest.fn(),
  });
  const review: Array<InterviewDraftResponse & { selected: boolean }> = onRecordProvenance.mock.calls[0][6];
  return { onApplyAdditional, recorded: review.find(({ questionId }) => questionId === 'q2') };
};
const submit = async (edited: InterviewDraftResponse, responses: Record<string, unknown>) =>
  (await run({ q1: edited }, responses)).onApplyAdditional;
const comment = (value: string) => ({ additionalComments: { q1: { value } } });

describe('the comment a submit sends', () => {
  it('works out an untouched card from the comment review reads now, not the card’s last render', async () => {
    // The card last rendered before the saved comment reached it.
    const untouched = { ...draft };
    expect(await submit(untouched, comment('Saved note'))).toHaveBeenCalledWith('q1', 'Saved note\n\nFrom my AI');
    // A locked comment is kept as it is.
    expect(await submit(untouched, comment('*'))).not.toHaveBeenCalled();
  });

  it('sends a comment the person touched as they left it, unless the form already holds it', async () => {
    const mine = { ...draft, additionalComments: 'Saved note', userEditedFields: ['additionalComments' as const] };
    expect(await submit(mine, comment('Saved note'))).not.toHaveBeenCalled();
    const typed = { ...mine, additionalComments: 'Typed in review' };
    expect(await submit(typed, comment('Saved note'))).toHaveBeenCalledWith('q1', 'Typed in review');
  });
});

describe('the comment research records for a card left out', () => {
  const onPage = (value: string, unsubmitted = true) => ({
    additionalComments: { q2: { value, ...(unsubmitted ? { unsubmitted: true } : {}) } },
  });
  const typed = (additionalComments: string) => ({
    ...leftOut,
    additionalComments,
    userEditedFields: ['additionalComments' as const],
  });

  it('records the AI’s own comment for a card the person didn’t touch, so nothing reads as changed', async () => {
    // The card holds their unsubmitted comment, then the AI's.
    const untouched = { ...leftOut, additionalComments: 'My private note\n\nAI note' };
    const { recorded } = await run({ q2: untouched }, onPage('My private note'));
    expect(recorded).toMatchObject({ selected: false, additionalComments: 'AI note' });
    expect(buildUnselectedInterviewResearch([recorded])[0]).toMatchObject({
      reviewed: { additionalComments: 'AI note' },
      changedFields: [],
    });
  });

  it('leaves out a comment of theirs from the page they haven’t submitted, and keeps what they typed', async () => {
    const edited = typed('My private note\n\nAI note, and more');
    expect((await run({ q2: edited }, onPage('My private note'))).recorded?.additionalComments).toBe(
      'AI note, and more',
    );
    // Keeping only theirs leaves nothing of the AI's.
    expect((await run({ q2: typed('My private note') }, onPage('My private note'))).recorded).toMatchObject({
      additionalComments: '',
    });
    // A comment they've submitted is already part of their response.
    expect((await run({ q2: edited }, onPage('My private note', false))).recorded?.additionalComments).toBe(
      'My private note\n\nAI note, and more',
    );
  });
});
