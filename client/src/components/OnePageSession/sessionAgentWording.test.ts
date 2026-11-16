import {
  SESSION_AGENT_USE_NOTICE,
  answersReach,
  sessionAgentAddressNotice,
  sessionAgentPageNotice,
} from './sessionAgentWording';

const withResults = (visibility: unknown) => ({ sessionModeProfile: { results: { visibility } } });

// Each results setting, and who it shows a person's answers to with their address.
const REACH: Array<[string, unknown, string]> = [
  ['anyone may read every answer', 'public_full_if_storage_public', 'to anyone with this session’s link'],
  [
    'signed-in members may read every answer',
    'session_member_full',
    'to this session’s organisers and its signed-in members',
  ],
  ['members see totals only', 'session_member_aggregate', 'to this session’s organisers'],
  ['each person sees totals only', 'participant_aggregate', 'to this session’s organisers'],
  // A setting this page doesn't know, or none, claims no one beyond the organisers, who always are.
  ['an unknown setting', 'something_new', 'to this session’s organisers'],
  ['no setting', undefined, 'to this session’s organisers'],
];

describe('sessionAgentWording', () => {
  it.each(REACH)('says who is shown a person’s answers where %s', (_label, visibility, reach) => {
    const config = withResults(visibility);
    expect(answersReach(config)).toBe(reach);
    expect(sessionAgentPageNotice(config)).toBe(
      'The Session Agent may draw on your answers and the files you add when it answers others, never naming you. ' +
        `They are available with your account address ${reach}, and may be exported; ` +
        'a summary without names or addresses may be published.',
    );
    expect(sessionAgentAddressNotice(config)).toBe(
      `What you wrote and the files you added are available with your account address ${reach}, ` +
        'and may be exported with it. Turning this off leaves your address off exports only; it still shows ' +
        'wherever this session shows your answers. Copies already made keep it.',
    );
  });

  it('reads no setting from a config that isn’t one', () => {
    for (const config of [null, undefined, 'salon', [], { sessionModeProfile: 'custom' }]) {
      expect(answersReach(config)).toBe('to this session’s organisers');
    }
  });

  it('says the same of the first switch under every setting: it speaks only of the agent and exports', () => {
    expect(SESSION_AGENT_USE_NOTICE).toBe(
      'The Session Agent may draw on the files you added, and Detailed answers on your answers too, never naming ' +
        'you. Turning it off stops future use and keeps them out of exports made from then on; it can’t take back ' +
        'answers already given.',
    );
    for (const said of [SESSION_AGENT_USE_NOTICE, sessionAgentPageNotice({}), sessionAgentAddressNotice({})]) {
      // The owner's cuts stay cut.
      expect(said).not.toMatch(/On unless you turn it off|Select it for how it works/);
    }
  });
});
