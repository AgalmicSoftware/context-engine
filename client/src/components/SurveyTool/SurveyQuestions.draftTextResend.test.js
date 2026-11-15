import { waitFor } from '@testing-library/react';

import { renderSurveyQuestions } from './surveyQuestionsTestHarness';
import { resendPendingDraftTextDeletes } from './sessionInterviewDraftText';

jest.mock('./sessionInterviewDraftText', () => ({
  ...jest.requireActual('./sessionInterviewDraftText'),
  resendPendingDraftTextDeletes: jest.fn(async () => undefined),
}));

describe('SurveyQuestions and AI draft text deletes kept from a failure', () => {
  it('sends them on page load once someone is signed in', async () => {
    const view = renderSurveyQuestions({
      account: '',
      activeSessionSlug: 'edge',
      isStandalone: true,
      loginComplete: false,
      questionPool: [],
      sessionSlug: 'edge',
      runtimeStrategy: { render: () => null },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(resendPendingDraftTextDeletes).not.toHaveBeenCalled();

    view.rerenderSurveyQuestions({ account: '0xABC', loginComplete: true });
    await waitFor(() =>
      expect(resendPendingDraftTextDeletes).toHaveBeenCalledWith(
        expect.objectContaining({ sessionSlug: 'edge', account: '0xabc' }),
      ),
    );
    view.unmount();
  });
});
