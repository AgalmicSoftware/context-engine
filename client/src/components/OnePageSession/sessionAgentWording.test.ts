import {
  SESSION_AGENT_USE_NOTICE,
  answersReach,
  sessionAgentAddressNotice,
  sessionAgentFullerAnswersNote,
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
        'and may be exported with it. Turn this off and exports leave your address off what you wrote and added; ' +
        'a group’s member list in an export still includes it, and it still shows wherever this session shows ' +
        'your answers. Copies already made keep it.',
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

  // Who gets Detailed answers is read from the session's own audiences, so the note never promises more.
  describe('who may get fuller answers', () => {
    const everyone = { match: 'any', conditions: [{ kind: 'agent_grant_scope', scope: 'ai' }] };
    const group = { match: 'any', conditions: [{ kind: 'worker_group', groupIds: ['salon'] }] };
    const otherGroup = { match: 'any', conditions: [{ kind: 'worker_group', groupIds: ['hosts'] }] };
    const holders = {
      match: 'any',
      conditions: [{ kind: 'sbt_onchain', chainId: 10, contract: `0x${'ab'.repeat(20)}`, anyOrAll: 'any' }],
    };
    const withAudiences = (...audiences: Array<[unknown, string]>) => ({
      sessionAgent: { audiences: audiences.map(([who, answers]) => ({ who, answers })) },
    });
    const CASES: Array<[string, unknown, boolean, string]> = [
      [
        'everyone gets General',
        withAudiences([everyone, 'general']),
        true,
        'In this session only its admins get Detailed answers.',
      ],
      [
        'a group gets General, which is no fuller',
        withAudiences([group, 'general'], [everyone, 'general']),
        true,
        'In this session only its admins get Detailed answers.',
      ],
      [
        'a group gets Detailed',
        withAudiences([group, 'detailed'], [everyone, 'general']),
        true,
        'In this session members of some of its groups may get Detailed answers, which also draw on members’ answers. Sign in to see which you get.',
      ],
      [
        'a group or credential holders get Detailed, read by someone signed in',
        withAudiences([group, 'detailed'], [holders, 'detailed'], [everyone, 'general']),
        false,
        'In this session members of some of its groups or people holding certain digital credentials may get Detailed answers, which also draw on members’ answers.',
      ],
      [
        'everyone signed in gets Detailed',
        withAudiences([everyone, 'detailed']),
        true,
        'In this session people who sign in may get Detailed answers, which also draw on members’ answers. Sign in to see which you get.',
      ],
      [
        'no setting the page can read',
        { sessionAgent: { audiences: 'broken' } },
        true,
        'In this session only its admins get Detailed answers.',
      ],
      // The first audience that admits a person sets their answers: after one that takes everyone, none counts.
      [
        'a group’s Detailed audience behind one that answers everyone',
        withAudiences([everyone, 'general'], [group, 'detailed']),
        true,
        'In this session only its admins get Detailed answers.',
      ],
      [
        'a group already given General answers earlier',
        withAudiences([group, 'general'], [group, 'detailed'], [everyone, 'general']),
        true,
        'In this session only its admins get Detailed answers.',
      ],
      [
        'another group behind one given General answers',
        withAudiences([group, 'general'], [otherGroup, 'detailed'], [everyone, 'general']),
        false,
        'In this session members of some of its groups may get Detailed answers, which also draw on members’ answers.',
      ],
      // An audience that asks for all its rules is not open to someone who only signs in.
      [
        'signing in and a group, both needed',
        withAudiences([{ match: 'all', conditions: [...everyone.conditions, ...group.conditions] }, 'detailed']),
        true,
        'In this session members of some of its groups may get Detailed answers, which also draw on members’ answers. Sign in to see which you get.',
      ],
      [
        'a group and a credential, both needed',
        withAudiences([{ match: 'all', conditions: [...group.conditions, ...holders.conditions] }, 'detailed']),
        true,
        'In this session members of some of its groups who also hold certain digital credentials may get Detailed answers, which also draw on members’ answers. Sign in to see which you get.',
      ],
      [
        'an audience that needs an admin',
        withAudiences([
          { match: 'all', conditions: [{ kind: 'worker_role', role: 'admin' }, ...group.conditions] },
          'detailed',
        ]),
        true,
        'In this session only its admins get Detailed answers.',
      ],
    ];
    it.each(CASES)('%s', (_name, sessionConfig, signedOut, expected) => {
      expect(sessionAgentFullerAnswersNote(sessionConfig, signedOut)).toBe(expected);
    });
  });
});
