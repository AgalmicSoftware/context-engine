import { createSurveyQuestionsLockAudienceRuntime } from './surveyQuestionsLockAudienceRuntime';
import { buildLockAudienceButtonAction, buildLockAudienceDisplayState } from './surveyToolViewState';

const disabledSession = {
  sessionModeProfile: {
    authority: { mode: 'worker_canonical' },
    encryption: { mode: 'none' },
    storage: { backend: 'cloudflare' },
  },
  storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
};

const makeRuntime = (menuOpen: boolean, toggleAnswerEncryption: jest.Mock) =>
  createSurveyQuestionsLockAudienceRuntime({
    propsRef: { current: { sessionConfig: disabledSession } },
    stateRef: { current: { lockAudienceMenuByQuestion: menuOpen ? { q1: true } : {} } },
    setState: jest.fn(),
    SurveyQuestionsLockAudienceControl: () => null,
    isQuestionLockedForResponse: () => false,
    resolveQuestionGateOption: () => null,
    resolveFieldEncryptionAudience: (field: { encryptionAudience?: string }) => field?.encryptionAudience || 'self',
    resolveFieldEncryptionGateId: () => '',
    normalizeFieldAudienceMode: () => 'explicit',
    normalizeGateLabelText: (s: string) => String(s || '').trim(),
    buildLockAudienceDisplayState,
    buildLockAudienceButtonAction,
    buildLockAudienceMenuState: jest.fn(),
    toggleAnswerEncryption,
    toggleAdditionalCommentsEncryption: jest.fn(),
  });

const render = (runtime: ReturnType<typeof makeRuntime>, answer: Record<string, unknown>) =>
  runtime.renderAnswerLockControl({
    surveyIndex: 0,
    questionId: 'q1',
    answer,
    lockDisabled: false,
    forceAudienceMenu: true, // as renderQuestionAnswerLockControl passes it
    selfAudienceLabel: 'only me',
    visualContext: 'default',
  });

it(' unlocking an old Only me answer in an encryption-off session can be reversed before submit', () => {
  const saved = {
    value: 'decrypted private answer',
    encrypted: true,
    encryptionAudience: 'self',
    encryptedPortion: '{"v":1,"recipients":[{"type":"self-eip712-v1"}]}',
    hash: '0xabc',
  };
  const toggle = jest.fn();
  // 1. The old locked answer shows an enabled lock (the fix).
  const lockedControl = render(makeRuntime(true, toggle), saved);
  expect(lockedControl).not.toBeNull();
  expect(lockedControl.props.isLockDisabled).toBe(false);
  // 2. With the audience menu open, pressing the lock turns encryption off.
  lockedControl.props.onLockClick();
  expect(toggle).toHaveBeenCalledWith(0, 'q1', false);
  // 3. buildToggleFieldState keeps the saved envelope but sets encrypted: false.
  const afterUnlock = { ...saved, encrypted: false };
  const control = render(makeRuntime(false, toggle), afterUnlock);
  // Desired: the user can still choose "only me" again before submitting.
  expect(control).not.toBeNull();
  expect(control.props.isLockDisabled).toBe(false);
});

it('keeps a new plaintext field without a saved envelope hidden when encryption is disabled', () => {
  expect(render(makeRuntime(false, jest.fn()), { value: 'public', encrypted: false })).toBeNull();
});
