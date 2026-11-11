import { runInterviewDraftSubmit } from './sessionInterviewDraftSubmit';
import type { InterviewDraftResponse } from './sessionInterview';

const draft = { questionId: 'q1', answer: 'Yes', additionalComments: 'From my AI' };

// Submits one chosen draft; `edited` is the card's state, `responses` what review reads now.
const submit = async (edited: InterviewDraftResponse, responses: Record<string, unknown>) => {
  const onApplyAdditional = jest.fn();
  await runInterviewDraftSubmit({
    activeSubmitContextToken: 'context',
    authenticatedForSubmit: true,
    baseSubmitContextToken: 'context',
    drafts: [draft],
    editedDrafts: { q1: edited },
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
    onSubmitResponses: jest.fn(async () => ({ status: 'submitted' as const })),
    setApplying: jest.fn(),
    setError: jest.fn(),
    setPendingSubmitAfterLogin: jest.fn(),
    setStatus: jest.fn(),
  });
  return onApplyAdditional;
};
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
