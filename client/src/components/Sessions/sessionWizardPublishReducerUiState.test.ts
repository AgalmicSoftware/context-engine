import {
  createInitialSessionPublishState,
  type SessionPublishState,
} from '../../domains/sessions/publish/sessionPublishReducer';
import { resolveSessionWizardPublishReducerUiState } from './sessionWizardPublishReducerUiState';

const stepNumbers = {
  'deploy-worker': 1,
  'deploy-sbts': 2,
  'upload-metadata': 3,
  'register-session': 4,
  done: 5,
};

const state = (overrides: Partial<SessionPublishState>): SessionPublishState => (
  createInitialSessionPublishState({
    status: 'editing',
    ...overrides,
  })
);

describe('resolveSessionWizardPublishReducerUiState', () => {
  it.each([
    ['idle', state({ status: 'idle' }), { publishBusy: false, publishStep: 0 }],
    ['editing', state({ status: 'editing' }), { publishBusy: false, publishStep: 0 }],
    [
      'checkingRequirements',
      state({ status: 'checkingRequirements', currentEffect: 'checkRequirements' }),
      { publishBusy: true, publishStep: 0 },
    ],
    [
      'deployingWorker',
      state({ status: 'deployingWorker', currentEffect: 'deployWorker' }),
      { publishBusy: true, publishStep: 1 },
    ],
    [
      'deployingPendingSbts',
      state({ status: 'deployingPendingSbts', currentEffect: 'deployPendingSbts' }),
      { publishBusy: true, publishStep: 2 },
    ],
    [
      'uploadingMetadata',
      state({ status: 'uploadingMetadata', currentEffect: 'uploadMetadata' }),
      { publishBusy: true, publishStep: 3 },
    ],
    [
      'registerSession',
      state({ status: 'registeringOnChain', currentEffect: 'registerSession' }),
      { publishBusy: true, publishStep: 4 },
    ],
    [
      'refreshRegistryCache',
      state({ status: 'registeringOnChain', currentEffect: 'refreshRegistryCache' }),
      { publishBusy: true, publishStep: 4 },
    ],
    ['published', state({ status: 'published' }), { publishBusy: false, publishStep: 5 }],
    [
      'failedRecoverable',
      state({ status: 'failedRecoverable', error: { effect: 'uploadMetadata', message: 'Upload failed.', recoverable: true } }),
      { publishBusy: false, publishStep: 0 },
    ],
    [
      'failedTerminal',
      state({ status: 'failedTerminal', error: { effect: 'registerSession', message: 'Registration failed.', recoverable: false } }),
      { publishBusy: false, publishStep: 0 },
    ],
  ])('maps %s to the legacy publish progress inputs', (_label, inputState, expected) => {
    expect(resolveSessionWizardPublishReducerUiState({
      state: inputState,
      stepNumbers,
    })).toEqual(expected);
  });

  it('keeps unknown or missing step numbers at the legacy preparing state', () => {
    expect(resolveSessionWizardPublishReducerUiState({
      state: state({ status: 'uploadingMetadata', currentEffect: 'uploadMetadata' }),
      stepNumbers: {},
    })).toEqual({
      publishBusy: true,
      publishStep: 0,
    });
  });
});
