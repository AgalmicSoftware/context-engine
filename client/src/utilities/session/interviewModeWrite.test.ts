import { withoutNewInterviewDefaults } from './interviewModeWrite';

// The values come from the shared defaults, so a changed default changes what is left out.
jest.mock('../../../../shared/interviewSettings.mjs', () => {
  const actual = jest.requireActual<typeof import('../../../../shared/interviewSettings.mjs')>(
    '../../../../shared/interviewSettings.mjs',
  );
  return { ...actual, DEFAULT_INTERVIEW_SETTINGS: { ...actual.DEFAULT_INTERVIEW_SETTINGS, recordingQuestionCount: 4 } };
});

describe('withoutNewInterviewDefaults', () => {
  it('leaves out a newer key only at the shared default', () => {
    expect(withoutNewInterviewDefaults({ recordingQuestionCount: 4 })).toEqual({});
    expect(withoutNewInterviewDefaults({ recordingQuestionCount: 3 })).toEqual({ recordingQuestionCount: 3 });
  });

  it('saves a note on where the data goes only when there is one, so older Workers still save', () => {
    expect(withoutNewInterviewDefaults({ dataNote: '', steeringPrompt: 'Listen.' })).toEqual({
      steeringPrompt: 'Listen.',
    });
    expect(withoutNewInterviewDefaults({ dataNote: 'Funded study.' })).toEqual({ dataNote: 'Funded study.' });
  });

  it('saves the voice context switch only when it is on, so older Workers still save', () => {
    expect(withoutNewInterviewDefaults({ voiceSessionContext: false })).toEqual({});
    expect(withoutNewInterviewDefaults({ voiceSessionContext: true })).toEqual({ voiceSessionContext: true });
  });
});
