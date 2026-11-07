import {
  consumeTranscriptClaimHashIfPresent,
  receiveTranscriptClaim,
  toggleSessionVoiceModeModal,
} from './SurveyPileViewMode';

const makeEngine = (sessionConfig = {}) => ({ props: { sessionConfig }, state: {}, setState: jest.fn() });

describe('a code’s link on the session page', () => {
  it('opens the scanner with the frame it holds, and takes it out of the address', () => {
    window.history.replaceState({}, '', '/session/salon?mode=x#claim=ab12.0.3.data&other=1');
    const engine = makeEngine();
    consumeTranscriptClaimHashIfPresent(engine);
    expect(engine.setState).toHaveBeenCalledWith({
      showVoiceModeModal: true,
      interviewClaimFrame: { id: 'ab12', index: 0, total: 3, data: 'data' },
    });
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
      '/session/salon?mode=x#other=1',
    );
    consumeTranscriptClaimHashIfPresent(engine);
    expect(engine.setState).toHaveBeenCalledTimes(1);
  });

  it('clears a damaged frame without opening anything', () => {
    window.history.replaceState({}, '', '/session/salon#claim=ab12.9.3.data');
    const engine = makeEngine();
    consumeTranscriptClaimHashIfPresent(engine);
    expect(engine.setState).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('leaves the link alone on a session with interviews off', () => {
    window.history.replaceState({}, '', '/session/salon#claim=ab12.0.3.data');
    const engine = makeEngine({ interviewModeEnabled: false });
    consumeTranscriptClaimHashIfPresent(engine);
    expect(engine.setState).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#claim=ab12.0.3.data');
  });
});

describe('a claimed part', () => {
  const claim = { sessionSlug: 'salon', person: 'Person 2', transcript: 'Responder: Yes.' };

  it('goes to the interview, and joins the group the recorder’s link was for', () => {
    window.history.replaceState({}, '', '/session/salon');
    const popstate = jest.fn();
    window.addEventListener('popstate', popstate);
    const engine = makeEngine();
    receiveTranscriptClaim(engine, { ...claim, joinGroup: 'salon-group' });
    window.removeEventListener('popstate', popstate);
    expect(engine.setState).toHaveBeenCalledWith({
      showVoiceModeModal: true,
      sessionVoiceMode: 'interview',
      interviewClaim: { ...claim, joinGroup: 'salon-group' },
      interviewClaimFrame: null,
    });
    expect(window.location.search).toBe('?joinGroup=salon-group');
    expect(popstate).toHaveBeenCalled();
  });

  it('isn’t taken in again when the dialog is opened afresh, but stays while a review is in progress', () => {
    const open = (interviewProgressContext) => {
      const engine = {
        ...makeEngine(),
        state: { interviewProgressContext, interviewClaim: claim },
        buildSessionInterviewSubmitContextToken: () => 'context',
      };
      toggleSessionVoiceModeModal(engine);
      return engine.setState.mock.calls[0][0];
    };
    expect(open('')).toMatchObject({ sessionVoiceMode: null, interviewClaim: null });
    expect(open('context')).toEqual({ showVoiceModeModal: true, sessionVoiceMode: 'interview' });
  });

  it('leaves the address alone without a group', () => {
    window.history.replaceState({}, '', '/session/salon');
    receiveTranscriptClaim(makeEngine(), claim);
    expect(window.location.search).toBe('');
  });
});
