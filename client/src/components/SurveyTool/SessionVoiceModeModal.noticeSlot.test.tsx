import React from 'react';
import { render } from '@testing-library/react';
import { VOICE_DIALOG_NOTICE_SLOT_ID } from '../../utilities/ui/voiceDialogNoticeSlot';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import type { SessionVoiceModeModalProps } from './sessionVoiceModeTypes';

jest.mock('./SessionInterviewPanel', () => ({ __esModule: true, default: () => <div>Interview panel</div> }));
jest.mock('./SessionListeningPanel', () => ({ __esModule: true, default: () => <div>Listening panel</div> }));
jest.mock('./SessionVoiceModeChooser', () => ({ __esModule: true, default: () => <div>Chooser</div> }));
jest.mock('./SessionVoicePrefillCard', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionRecordingHelp', () => ({ __esModule: true, default: () => null }));
jest.mock('../../utilities/audio/useRecordingChunkQueue', () => ({
  useKeptRecording: () => ({ kept: false, unsaved: false }),
}));

const slot = () => document.getElementById(VOICE_DIALOG_NOTICE_SLOT_ID);
const dialog = (props: Partial<SessionVoiceModeModalProps>) => {
  const required = { onClose: () => {}, onSelectMode: () => {}, sessionSlug: 'alpha' };
  return <SessionVoiceModeModal {...(required as unknown as SessionVoiceModeModalProps)} {...props} />;
};

describe('SessionVoiceModeModal notice slot', () => {
  it.each(['interview', 'recordGroup', null] as const)('hosts page notices while open in %s mode', (mode) => {
    render(dialog({ isOpen: true, mode }));
    expect(slot()).toBeInTheDocument();
    expect(slot()?.closest('.modal-content')).toBeInTheDocument();
  });

  // The interview dialog stays mounted once closed. A slot left behind would hide the notice inside it.
  it('drops the slot when a kept interview dialog closes', () => {
    const { rerender } = render(dialog({ isOpen: true, mode: 'interview' }));
    expect(slot()).toBeInTheDocument();
    rerender(dialog({ isOpen: false, mode: 'interview' }));
    expect(slot()).toBeNull();
  });
});
