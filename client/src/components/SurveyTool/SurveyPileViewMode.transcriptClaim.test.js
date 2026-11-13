import {
  buildPileRuntimeInitialState,
  consumeTranscriptClaimHashIfPresent,
  noteInterviewProgress,
  receiveTranscriptClaim,
  toggleSessionVoiceModeModal,
} from './SurveyPileViewMode';
import { readHeldClaim, releaseHeldClaim } from './sessionTranscriptClaim';
import { readAutoJoinLink } from '../../domains/worker/workerGroupAutoJoinIntent';

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

  it('hands a group password on to the auto-join, never through the address or history state', () => {
    window.history.replaceState({}, '', '/session/salon');
    receiveTranscriptClaim(makeEngine(), { ...claim, joinGroup: 'salon-group', joinToken: 'gp:river stone' });
    expect(window.location.search).toBe('?joinGroup=salon-group');
    expect(window.location.hash).toBe('');
    expect(JSON.stringify(window.history.state)).not.toContain('river');
    const context = { sessionSlug: 'salon', sessionId: `0x${'1'.repeat(32)}`, workerUrl: 'https://worker.example' };
    expect(readAutoJoinLink('/session/salon?joinGroup=salon-group', context)?.token).toBe('gp:river stone');
  });

  it('leaves the address alone without a group', () => {
    window.history.replaceState({}, '', '/session/salon');
    receiveTranscriptClaim(makeEngine(), claim);
    expect(window.location.search).toBe('');
  });
});

describe('a claimed part across a reload', () => {
  const claim = { sessionSlug: 'salon', person: 'Person 2', transcript: 'Responder: Yes.', joinGroup: 'salon-group' };
  const reload = () =>
    buildPileRuntimeInitialState({ props: { sessionSlug: 'salon' }, buildWarmPileSeedState: () => null });
  beforeEach(() => {
    releaseHeldClaim();
    window.history.replaceState({}, '', '/session/salon');
  });

  it('reopens its review after a reload, such as a passkey sign-in', () => {
    receiveTranscriptClaim(makeEngine(), claim);
    window.history.replaceState({}, '', '/session/salon');
    expect(reload()).toMatchObject({ showVoiceModeModal: true, sessionVoiceMode: 'interview', interviewClaim: claim });
    // Only on its own session's page.
    window.history.replaceState({}, '', '/session/other');
    expect(
      buildPileRuntimeInitialState({ props: { sessionSlug: 'other' }, buildWarmPileSeedState: () => null }),
    ).toMatchObject({ interviewClaim: null });
    expect(readHeldClaim('salon')).toEqual(claim);
  });

  it('gives way to a new code being scanned', () => {
    receiveTranscriptClaim(makeEngine(), claim);
    window.history.replaceState({}, '', '/session/salon#claim=ab12.0.3.data');
    expect(reload()).toMatchObject({ interviewClaim: null, interviewClaimFrame: { id: 'ab12' } });
  });

  it('goes once its review is submitted or discarded, but not when a sign-in starts the dialog afresh', () => {
    receiveTranscriptClaim(makeEngine(), claim);
    expect(readHeldClaim('salon')).toEqual(claim);
    // Opening the dialog afresh with no review in progress drops it, as the page's own copy is dropped.
    toggleSessionVoiceModeModal({
      ...makeEngine(),
      state: { interviewProgressContext: '', interviewClaim: claim },
      buildSessionInterviewSubmitContextToken: () => 'context',
    });
    expect(readHeldClaim('salon')).toBeNull();
  });

  it('stays through a sign-in mid-review, and goes when that review ends', () => {
    receiveTranscriptClaim(makeEngine(), claim);
    const engine = makeEngine();
    engine.state = { interviewProgressContext: 'signed-out' };
    // The sign-in gives the dialog a new context, whose fresh review isn't in progress yet.
    noteInterviewProgress(engine, false, 'signed-in');
    expect(readHeldClaim('salon')).toEqual(claim);
    engine.state = { interviewProgressContext: 'signed-in' };
    noteInterviewProgress(engine, true, 'signed-in');
    expect(readHeldClaim('salon')).toEqual(claim);
    // Submitted or discarded.
    noteInterviewProgress(engine, false, 'signed-in');
    expect(readHeldClaim('salon')).toBeNull();
    expect(engine.setState).toHaveBeenLastCalledWith({ interviewProgressContext: '' });
  });

  it('forgets a damaged or day-old part', () => {
    sessionStorage.setItem(
      'ce:transcript-claim:v1',
      JSON.stringify({ claim: { ...claim, transcript: 7 }, heldAt: Date.now() }),
    );
    expect(readHeldClaim('salon')).toBeNull();
    expect(sessionStorage.getItem('ce:transcript-claim:v1')).toBeNull();
    sessionStorage.setItem(
      'ce:transcript-claim:v1',
      JSON.stringify({ claim, heldAt: Date.now() - 25 * 60 * 60 * 1000 }),
    );
    expect(readHeldClaim('salon')).toBeNull();
  });
});
