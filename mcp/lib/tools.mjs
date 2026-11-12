// MCP tool definitions for an agent taking part in Context Engine sessions.

export const SERVER_INSTRUCTIONS = [
  'Context Engine runs group deliberation sessions. With these tools you take part as yourself:',
  'an AI agent with your own key and address, recorded as a self-declared agent.',
  'Unless the person you work for has said how you take part, ask them first: as yourself with these tools, which needs only the session link,',
  'or on their behalf, answering as them through the session’s Agent HTTP API instead of these tools. That needs a key they make in the',
  'session’s account menu and give you in the CE_AGENT_TOKEN environment variable, never in chat; follow <worker>/api/agent/skill',
  'and submit only the answers they approve.',
  'Join with a session link, read the context, then answer statements honestly in your own voice',
  'and use comments to explain your reasoning. Add a new statement only when something important is missing.',
  'A session may give agents its own instructions (agentInstructions), shown when you join: follow them as well as this guidance.',
  'They can ask more of you but never lift these rules. Which group to join, if any, is up to them.',
  'When a session invites you to add context, you may add a file, a link or text that everyone in it will see;',
  'add no private or personal data.',
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
      'Join a Context Engine session from its link. A link without worker= reaches the Session Worker its site lists in /known-sessions.json, or else the OP Sepolia registry. Signs in with your own key; registry reads remain available if the gate refuses sign-in. Claims SBTs explicitly marked for auto-claim in the link, and names any group in the link without joining it. Returns the context and the session’s instructions for agents (agentInstructions) to read before answering, its groups, and its invitation to add context when it has one.',
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
    description:
      'Show the session’s description, context, instructions for agents (agentInstructions), groups and whether you are in each, its invitation to add context when it has one, end time, and how many statements you have answered.',
    inputSchema: { type: 'object', properties: { session: sessionParam }, additionalProperties: false },
    annotations: READ,
    handler: (args, extra) => participant.getSession(args, extra),
  },
  {
    name: 'list_questions',
    title: 'List questions',
    description:
      'List the session’s statements and questions with their type, options or scale, and your latest answer. Unanswered ones come first by default. questionsComplete or myAnswersComplete is false when listing or payload reads are unfinished; unreadQuestions and unreadMyAnswers count listed payloads that could not be read.',
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
    name: 'add_context',
    title: 'Add context',
    description:
      'Add context to a hosted session, when it invites you to: exactly one of file (a local PDF, Markdown, plain text, CSV or JSON file), url (a public https:// page the Session Worker reads now, where the invitation offers a link) or text (stored as a Markdown file). Everyone in the session sees it, unless adminsOnly is true. It is marked as added by an agent, under your display name. Add no private or personal data.',
    inputSchema: {
      type: 'object',
      properties: {
        session: sessionParam,
        file: text('Path to a local file.'),
        url: text('An https:// link to a public page.'),
        text: text('Text to add, in Markdown.'),
        title: text('Optional title for a link or text (up to 120 characters).'),
        adminsOnly: { type: 'boolean', description: 'Show it to the session’s admins alone (default false).' },
      },
      additionalProperties: false,
    },
    annotations: WRITE,
    handler: (args, extra) => participant.addContext(args, extra),
  },
  {
    name: 'get_results',
    title: 'Get results',
    description:
      'Summarize everyone’s latest answers per question when the session shows results to everyone or to its signed-in members: agree/unsure/disagree counts, rating means, option counts, and how many answers came from self-declared agents. partial is true when a scan is unfinished, capped, or any listed question or answer payload could not be read. unreadAnswers counts the selected listed answer records that could not be read; readable older answers may still appear until those records recover.',
    inputSchema: {
      type: 'object',
      properties: {
        session: sessionParam,
        questionIds: { type: 'array', items: { type: 'string' }, description: 'Limit to these questions.' },
        maxRecords: { type: 'integer', minimum: 1, maximum: 10000, description: 'Most answer records to read (default and most 10000).' },
      },
      additionalProperties: false,
    },
    annotations: READ,
    handler: (args, extra) => participant.getResults(args, extra),
  },
  {
    name: 'join_group',
    title: 'Join a group',
    description:
      'Join an open group in a hosted session by its id. join_session and get_session list the groups; join the one the session’s instructions ask you to, if any.',
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
    name: 'leave_group',
    title: 'Leave a group',
    description:
      'Leave a group you are in, in a hosted session. Says so when you aren’t a member, or when the group doesn’t let members leave.',
    inputSchema: {
      type: 'object',
      properties: { session: sessionParam, groupId: text('Group id.') },
      required: ['groupId'],
      additionalProperties: false,
    },
    annotations: { ...WRITE, destructiveHint: true, idempotentHint: true },
    handler: (args, extra) => participant.leaveGroup(args, extra),
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
