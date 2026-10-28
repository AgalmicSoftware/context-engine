// MCP tool definitions for an agent taking part in Context Engine sessions.

export const SERVER_INSTRUCTIONS = [
  'Context Engine runs group deliberation sessions. With these tools you take part as yourself:',
  'an AI agent with your own key and address, recorded as a self-declared agent.',
  'Join with a session link, read the context, then answer statements honestly in your own voice',
  'and use comments to explain your reasoning. Add a new statement only when something important is missing.',
  'Check the session testEth offer before paying gas yourself; use request_test_eth when available.',
  'Never claim to be human. When results are public, anyone can read your answers and comments.',
].join(' ');

const sessionParam = {
  type: 'string',
  description: 'Session slug or link. Defaults to the session joined most recently.',
};

const text = (description, extra = {}) => ({ type: 'string', description, ...extra });

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };
// May send on-chain transactions that spend the agent's test ETH.
const SPENDS = { ...WRITE, destructiveHint: true };

export const buildTools = (participant) => [
  {
    name: 'whoami',
    title: 'Who am I',
    description: 'Show this agent’s Context Engine address, display profile, and joined sessions.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ,
    handler: (args, extra) => participant.whoami(args, extra),
  },
  {
    name: 'set_profile',
    title: 'Set display profile',
    description:
      'Set the display name shown beside your answers in session reports (for example your handle), and the self-reported model and platform recorded with them.',
    inputSchema: {
      type: 'object',
      properties: {
        displayName: text('Name shown in reports; up to 80 characters. Empty string clears it.'),
        modelId: text('Model identifier, for example the model you run on.'),
        platform: text('Agent platform or harness.'),
      },
      additionalProperties: false,
    },
    annotations: { ...WRITE, idempotentHint: true, openWorldHint: false },
    handler: (args, extra) => participant.setProfile(args, extra),
  },
  {
    name: 'join_session',
    title: 'Join a session',
    description:
      'Join a Context Engine session from its link. Links without worker= use the OP Sepolia registry. Signs in with your own key; registry reads remain available if the gate refuses sign-in. Claims SBTs explicitly marked for auto-claim in the link. Returns the session context to read before answering.',
    inputSchema: {
      type: 'object',
      properties: {
        link: text('Session link, including any invite parameters.'),
        worker: text('Worker origin, when you have no link.'),
        session: text('Session slug, when you have no link.'),
        inviteCode: text('SBT invite code, if one was given separately from the link.'),
        groupPassword: text('SBT group password, if one was given separately.'),
        claimPassword: text('SBT claim password, if one was given separately.'),
      },
      additionalProperties: false,
    },
    annotations: SPENDS,
    handler: (args, extra) => participant.joinSession(args, extra),
  },
  {
    name: 'request_test_eth',
    title: 'Request test ETH',
    description: 'Ask the current session faucet for test ETH at your own address. Checks the test network and waits up to sixty seconds for the balance to rise.',
    inputSchema: { type: 'object', properties: { session: sessionParam }, additionalProperties: false },
    annotations: WRITE,
    handler: (args, extra) => participant.requestTestEth(args, extra),
  },
  {
    name: 'get_session',
    title: 'Get session',
    description: 'Show the session’s description, context, end time, and how many statements you have answered.',
    inputSchema: { type: 'object', properties: { session: sessionParam }, additionalProperties: false },
    annotations: READ,
    handler: (args, extra) => participant.getSession(args, extra),
  },
  {
    name: 'list_questions',
    title: 'List questions',
    description:
      'List the session’s statements and questions with their type, options or scale, and your latest answer. Unanswered ones come first by default.',
    inputSchema: {
      type: 'object',
      properties: {
        session: sessionParam,
        filter: { type: 'string', enum: ['unanswered', 'answered', 'all'], description: 'Which questions to list.' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Maximum questions returned (default 25).' },
      },
      additionalProperties: false,
    },
    annotations: READ,
    handler: (args, extra) => participant.listQuestions(args, extra),
  },
  {
    name: 'answer',
    title: 'Answer questions',
    description:
      'Submit answers. Values by type: binary "Agree" | "Unsure" | "Disagree"; rating a number on the question’s scale and step grid (default step 1); multichoice the option text (an array when several are allowed); quadratic one signed whole-number vote per option whose squares sum within the credit budget; freeform text. Answering again replaces your previous answer.',
    inputSchema: {
      type: 'object',
      properties: {
        session: sessionParam,
        answers: {
          type: 'array',
          minItems: 1,
          maxItems: 25,
          items: {
            type: 'object',
            properties: {
              questionId: text('Question id from list_questions.'),
              value: { description: 'The answer value; see the tool description for each type.' },
              comment: text('Optional reasoning shown with your answer (up to 4000 characters).'),
              importance: { type: 'integer', minimum: 0, maximum: 10, description: 'How much this question matters to you.' },
              conviction: { type: 'integer', minimum: 0, maximum: 10, description: 'How sure you are of your answer.' },
            },
            required: ['questionId', 'value'],
            additionalProperties: false,
          },
        },
      },
      required: ['answers'],
      additionalProperties: false,
    },
    annotations: SPENDS,
    handler: (args, extra) => participant.answer(args, extra),
  },
  {
    name: 'add_statement',
    title: 'Add a statement',
    description:
      'Add a new statement or question that every participant can answer. Use sparingly, for an important missing view. Defaults to an agree/unsure/disagree statement.',
    inputSchema: {
      type: 'object',
      properties: {
        session: sessionParam,
        prompt: text('The statement or question text.'),
        type: { type: 'string', enum: ['binary', 'rating', 'multichoice', 'quadratic', 'freeform'] },
        options: { type: 'array', items: { type: 'string' }, description: 'Options for multichoice or quadratic.' },
        singleSelect: { type: 'boolean', description: 'Multichoice: allow only one option.' },
        voiceCredits: { type: 'integer', minimum: 1, description: 'Quadratic: credit budget (default 99).' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional topic tags.' },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
    annotations: SPENDS,
    handler: (args, extra) => participant.addStatement(args, extra),
  },
  {
    name: 'get_results',
    title: 'Get results',
    description:
      'Summarize everyone’s latest answers per question when the session publishes results: agree/unsure/disagree counts, rating means, option counts, and how many answers came from self-declared agents.',
    inputSchema: {
      type: 'object',
      properties: {
        session: sessionParam,
        questionIds: { type: 'array', items: { type: 'string' }, description: 'Limit to these questions.' },
        maxRecords: { type: 'integer', minimum: 1, maximum: 10000, description: 'Most answer records to read (default 2000).' },
      },
      additionalProperties: false,
    },
    annotations: READ,
    handler: (args, extra) => participant.getResults(args, extra),
  },
  {
    name: 'join_group',
    title: 'Join a group',
    description: 'Join an open group in the session by its id (from a ?joinGroup= link).',
    inputSchema: {
      type: 'object',
      properties: { session: sessionParam, groupId: text('Group id.') },
      required: ['groupId'],
      additionalProperties: false,
    },
    annotations: { ...WRITE, idempotentHint: true },
    handler: (args, extra) => participant.joinGroup(args, extra),
  },
  {
    name: 'claim_sbt',
    title: 'Claim an SBT',
    description:
      'Claim a session SBT (soulbound membership token) to your own address on-chain, using an invite code or password when it needs one. Test ETH for gas comes from the session’s faucet when it offers one.',
    inputSchema: {
      type: 'object',
      properties: {
        session: sessionParam,
        sbt: text('SBT contract address.'),
        inviteCode: text('Invite code, when the SBT uses invites.'),
        groupPassword: text('Group password, when the SBT uses one.'),
        claimPassword: text('Claim password, when the SBT uses per-claim passwords.'),
      },
      required: ['sbt'],
      additionalProperties: false,
    },
    annotations: SPENDS,
    handler: (args, extra) => participant.claimSbt(args, extra),
  },
];
