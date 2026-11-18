import React from 'react';
import { render, screen } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import type { SessionVoiceModeModalProps } from './sessionVoiceModeTypes';

let mockMounts = 0;
jest.mock('./SessionInterviewPanel', () => ({
  __esModule: true,
  default: function Panel() {
    const [mount] = (jest.requireActual('react') as typeof React).useState(() => (mockMounts += 1));
    return <div>Interview {mount}</div>;
  },
}));
jest.mock('./SessionListeningPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionVoiceModeChooser', () => ({ __esModule: true, default: () => <div>Chooser</div> }));
jest.mock('./SessionVoicePrefillCard', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionRecordingHelp', () => ({ __esModule: true, default: () => null }));
jest.mock('../../utilities/audio/useRecordingChunkQueue', () => ({
  useKeptRecording: () => ({ kept: false, unsaved: false }),
}));

const dialog = (props: Partial<SessionVoiceModeModalProps>) => {
  const required = { onClose: () => {}, onSelectMode: () => {}, sessionSlug: 'alpha', mode: 'interview' };
  return <SessionVoiceModeModal {...(required as unknown as SessionVoiceModeModalProps)} {...props} />;
};

// The closed interview dialog stays mounted, so opening it straight at the interview would show the last one.
it('starts a new interview on a fresh open, and keeps the one resumed', () => {
  const { rerender } = render(dialog({ isOpen: true, openCount: 1 }));
  expect(screen.getByText('Interview 1')).toBeInTheDocument();
  rerender(dialog({ isOpen: false, openCount: 1 }));
  rerender(dialog({ isOpen: true, openCount: 1 }));
  expect(screen.getByText('Interview 1')).toBeInTheDocument();
  rerender(dialog({ isOpen: false, openCount: 1 }));
  rerender(dialog({ isOpen: true, openCount: 2 }));
  expect(screen.getByText('Interview 2')).toBeInTheDocument();
});
