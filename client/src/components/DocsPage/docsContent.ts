import { SESSION_AGENT_LIMITS } from '@ce-shared/sessionAgent.mjs';
import { t } from '../../utilities/ui/terminology.js';

export type QuickstartLink = Readonly<{
  href: string;
  label: string;
}>;

export type QuickstartStep = Readonly<{
  id: string;
  title: string;
  body: string;
  links?: readonly QuickstartLink[];
}>;

export type GuideTopic = Readonly<{
  id: string;
  title: string;
  summary: string;
  points: readonly string[];
}>;

export type DocsLink = Readonly<{
  href: string;
  label: string;
}>;

export type SessionAgentTopic = GuideTopic &
  Readonly<{
    link?: DocsLink;
  }>;

export type AgentKind = Readonly<{
  id: string;
  name: string;
  status: 'Available' | 'Available (preview)' | 'Planned';
  body: string;
}>;

export type FaqItem = Readonly<{
  id: string;
  question: string;
  answer: string;
}>;

const freezeQuickstartStep = (step: QuickstartStep): QuickstartStep => {
  if (!step.links) return Object.freeze(step);
  return Object.freeze({
    ...step,
    links: Object.freeze(step.links.map((link) => Object.freeze(link))),
  });
};
const freezeGuideTopic = (topic: GuideTopic): GuideTopic =>
  Object.freeze({ ...topic, points: Object.freeze([...topic.points]) });
const freezeSessionAgentTopic = (topic: SessionAgentTopic): SessionAgentTopic =>
  Object.freeze({
    ...topic,
    points: Object.freeze([...topic.points]),
    ...(topic.link ? { link: Object.freeze(topic.link) } : {}),
  });
const freezeFaqItem = (item: FaqItem): FaqItem => Object.freeze(item);

export const DOCS_PAGE_COPY = Object.freeze({
  title: 'Docs',
  introduction:
    'Start here to join a session, understand its privacy and storage choices, and inspect the infrastructure behind it.',
});

export const QUICKSTART_STEPS: readonly QuickstartStep[] = Object.freeze(
  [
    {
      id: 'open-session',
      title: 'Open or create a session',
      body: 'Follow a shared session link, or create a session of your own. On the setup page, “Set up with AI” lets ChatGPT or Claude ask about your session and fill in the page for you to review.',
      links: [
        { href: '/session/new', label: 'Create a session' },
        // The session the About page's Demo button opens; a test keeps the two the same.
        { href: '/session/rxc-ra-2', label: 'Try the demo session' },
      ],
    },
    {
      id: 'create-passkey-wallet',
      title: 'Sign in with a passkey',
      body: 'Choose Create to make an account with a passkey, or Login to return to one. You control the account: there is no password or seed phrase to manage, and participants do not need crypto expertise. Where a session uses Ethereum wallets, you can connect one you already have instead.',
    },
    {
      id: 'respond',
      title: 'Answer questions and surveys',
      body: 'Sessions can use binary, rating, multiple-choice, quadratic allocation, and freeform questions, plus optional conviction weighting and comments.',
    },
    {
      id: 'add-documents',
      title: 'Add supporting documents when enabled',
      body: 'Session document libraries can accept files or link records. A session can keep them public, private to you, or encrypted for an eligible group.',
    },
    {
      id: 'view-results',
      title: 'Explore the results',
      body: 'Use filters, cluster and report views, comparisons, and the available CSV, JSON, HTML, or PDF exports to understand the discussion.',
    },
    {
      id: 'understand-storage',
      title: 'Know where the data lives',
      body: 'New sessions use Cloudflare storage in the account that deployed their Worker. On-chain sessions use public, permanent Arweave payloads and on-chain anchors; anyone can read them unless a field is encrypted, and encrypted fields stay ciphertext until an authorized viewer decrypts them.',
    },
  ].map(freezeQuickstartStep),
);

export const GUIDE_TOPICS: readonly GuideTopic[] = Object.freeze(
  [
    {
      id: 'network',
      title: 'Chain and network',
      summary:
        'Chain-backed sessions declare `networkChainId` and use that network for contracts and access checks. OP Sepolia is the default testnet; pure Worker sessions can be chain-free.',
      points: [
        'The session context below shows the resolved chain for the documentation you are viewing.',
        'Contract addresses are session-specific and can differ between networks.',
      ],
    },
    {
      id: 'access-gates',
      title: 'Access gates',
      summary: `Chain-backed sessions can require one or more ${t('sbtFull')}s for a resource, using Any or All matching. \`SessionRegistry\` is authoritative for those on-chain gates.`,
      points: [
        'Supported resource keys are `default`, `questionResponses`, `surveyResponses`, `docUploads`, `docUrls`, `ai`, `arweave`, `rpc`, `txGas`, and `lit`.',
        'Pure Worker sessions use their Worker roles and native Groups instead of inventing on-chain gate authority.',
      ],
    },
    {
      id: 'encrypted-fields',
      title: 'Encrypted fields',
      summary:
        'Session metadata, question or survey prompts and tags, responses, and documents can be stored as encrypted payloads.',
      points: [
        `Lit access conditions commonly grant decryption to wallets that hold the selected ${t('sbt')} gate.`,
        'Worker-envelope sessions decrypt only after the Worker applies the configured access policy, so the Worker operator and Cloudflare runtime stay trusted.',
        'Lit protects only the fields you lock. They remain ciphertext until their conditions pass, the Worker operator and Lit account administrators stay trusted, and which wallet answered which question stays public.',
      ],
    },
    {
      id: 'sponsored-resources',
      title: 'Sponsored resources',
      summary:
        'A session Worker can proxy resources that need protected credentials, including AI, transcription, RPC, testnet gas, Arweave, fetch, and Lit operations.',
      points: [
        'Resource access can be scoped by the session policy instead of exposing provider secrets to the browser.',
        'The `/sponsor` flow creates grant-backed bundles that can prefill eligible setup resources for a new session.',
      ],
    },
    {
      id: 'document-library',
      title: 'Session document library',
      summary:
        'Open `/session/<slug>/docs` to browse a session library. Depending on the profile, records are backed by Arweave or by Worker-managed Cloudflare storage.',
      points: [
        'Arweave libraries can store plaintext or Lit-encrypted files and link records.',
        'The `docUploads` gate can supply the default encrypted audience; private “only me” saves use the connected wallet.',
      ],
    },
    {
      id: 'ai-features',
      title: 'AI features',
      summary:
        'Context Engine supports conversational voice interviews, group-conversation question generation, cluster summaries, result analysis, and position comparison.',
      points: [
        'Interview mode turns a realtime conversation or a reviewed ChatGPT/Claude handoff into local response drafts with visible confidence; it never submits automatically.',
        'Generated questions remain drafts for review rather than being published automatically.',
        'Prompt templates for question generation, summaries, and analysis are published in the Prompts section below.',
      ],
    },
    {
      id: 'limits-listening',
      title: 'Block limits and voice modes',
      summary:
        'Chain-scanned sessions use `blockLimits` to bound discovery. Worker-canonical sessions can instead use `sessionEndsAt` to close participant mutations while preserving allowed reads and admin recovery.',
      points: [
        'Use `?mode=voice` to open the voice chooser, `?mode=interview` for one-person conversational response drafting, or `?mode=groupRecording` to turn a recorded discussion into draft questions.',
        'Admins copy the `?mode=groupRecording` link, one per breakout room, with “Copy group recorder link” under Join or on the settings page; it keeps any Worker pin, and other `mode` values are ignored and removed.',
        'The optional ChatGPT/Claude memory handoff, offered in the voice chooser, keeps instructions in the pasted user request, fetches only an inert question catalog, shows the exact packet before encoding, and includes explained per-answer confidence; no relevant signal produces a clean interview link. A cut-off or damaged link says why and accepts the pasted JSON packet instead.',
        '`?mode=listening` opens the pile-adjacent group recorder, and recording starts only after you press Record.',
        'Back keeps a running recording on the page, and reloading or closing the tab asks first while audio is still being recorded or uploaded.',
      ],
    },
    {
      id: 'session-sources',
      title: 'Demo, Worker, and registry sessions',
      summary:
        'Demo sessions provide curated examples. Worker-canonical sessions use a session Worker as their operational authority, while registry-canonical sessions anchor identity and SBT gate authority on-chain.',
      points: [
        'Demo configuration is the fallback while registry and Worker session reads resolve.',
        'A pure Worker session has no contracts, gas, or on-chain authority.',
      ],
    },
  ].map(freezeGuideTopic),
);

// Paths in the public repository, linked from the Session Agent section.
export const SESSION_AGENT_DOC_PATH = 'docs/session-agent.md';
export const AGENT_PARTICIPANTS_DOC_PATH = 'docs/agent-participants.md';

export const SESSION_AGENT_TOPICS: readonly SessionAgentTopic[] = Object.freeze(
  [
    {
      id: 'what-it-is',
      title: 'What it is',
      summary:
        'An AI that answers questions about one session from that session’s own material, using the AI the session is set up with. It is a preview, off until an admin turns it on under AI, and only sessions on a Session Worker have one.',
      points: [
        'While it is on, a robot shows by the session’s title, and anyone signed in can open it from the session’s Context.',
        `It takes one question at a time and answers in at most ${SESSION_AGENT_LIMITS.answerWords.toLocaleString('en-US')} words.`,
      ],
      link: { href: SESSION_AGENT_DOC_PATH, label: 'Full Session Agent docs' },
    },
    {
      id: 'who-may-ask',
      title: 'Who may ask',
      summary:
        'The admin lists who may ask: everyone signed in, members of chosen groups, or SBT holders. The first entry that matches you sets how you are answered.',
      points: [
        'Admins always get Detailed answers. With no entries, only admins may ask.',
        'Everyone who asks needs to be allowed to use the session’s AI, and the session’s own group or SBT lock still applies.',
      ],
    },
    {
      id: 'answer-styles',
      title: 'Two answer styles',
      summary:
        'General answers read what the session shares. Detailed answers also read members’ answers, without names.',
      points: [
        'General: the session’s context, files open to everyone, and the published results if you may see Results.',
        'Detailed: every file you may read, and members’ answers with how many chose each option.',
        'It is told never to name a participant or say who gave an answer. Unless an admin lowers the bar, members’ answers to a session question that fewer than three members answered are left out for everyone but admins.',
      ],
    },
    {
      id: 'keep-out',
      title: 'Keeping your answers and files out',
      summary:
        'Your answers and files are in until you say otherwise. Untick “Session Agent may use my answers and files” in the Context section, beside the Session Agent button.',
      points: [
        'It applies from the next question on; answers already given can’t be taken back.',
        'The published results still count your answers, as on the Results page.',
        'You can turn it off even when the Session Agent doesn’t answer you, and back on at any time.',
      ],
    },
  ].map(freezeSessionAgentTopic),
);

export const AGENT_KINDS_COPY = Object.freeze({
  title: 'Which agent is which',
  introduction: 'Four ideas are easy to mix up. Two exist today; two are planned and not available.',
});

const agentKinds: AgentKind[] = [
  {
    id: 'own-agent',
    name: 'Your own AI agent',
    status: 'Available',
    body: 'An agent you run takes part like a participant, as itself or, where the session allows it, on your behalf. The session’s rules apply to it.',
  },
  {
    id: 'session-agent',
    name: 'The Session Agent',
    status: 'Available (preview)',
    body: 'Belongs to one session and answers only from that session’s own material.',
  },
  {
    id: 'group-agent',
    name: 'A Group Agent',
    status: 'Planned',
    body: 'An agent for one group that would draw on that group’s work across several sessions.',
  },
  {
    id: 'community-hosted',
    name: 'Community-hosted knowledge',
    status: 'Planned',
    body: 'A community would take a session’s export and host the same knowledge itself, outside the session’s Worker.',
  },
];

export const AGENT_KINDS: readonly AgentKind[] = Object.freeze(agentKinds.map((kind) => Object.freeze(kind)));

export const FAQ_ITEMS: readonly FaqItem[] = Object.freeze(
  [
    {
      id: 'crypto-experience',
      question: 'Do I need crypto experience?',
      answer:
        'No. The participant flow uses a browser passkey and the embedded wallet. Session administrators choosing decentralized or other chain-backed options may still need testnet funding and network configuration.',
    },
    {
      id: 'cost',
      question: 'Does it cost money to participate?',
      answer:
        'That depends on the session. Workers can sponsor AI, storage, RPC, and testnet gas, while direct on-chain creation or writes require the configured network’s gas and any contract fee.',
    },
    {
      id: 'data-location',
      question: 'Where is my data stored?',
      answer:
        'The session profile decides. New sessions use Cloudflare storage in the account that deployed their Worker. On-chain sessions use public, permanent Arweave payloads and keep minimal identity, pointers, and gate authority on-chain.',
    },
    {
      id: 'private-answers',
      question: 'Can my answers be private?',
      answer:
        'It depends on the session. New sessions show every answer to the session’s signed-in members, and some sessions show them to everyone. When a session enables response encryption, answers and additional comments have independent locks, can be encrypted for you or for a gated audience, and only an authorized viewer can decrypt the protected fields. Comments follow the answer lock only when you explicitly choose that option. In on-chain sessions, which wallet answered which question stays public.',
    },
    {
      id: 'active-chain',
      question: 'Which chain am I using?',
      answer:
        'Check the session context above Smart Contracts. It shows the resolved network name and chain ID; OP Sepolia is the default testnet when no session-specific chain is available.',
    },
    {
      id: 'sbt',
      question: `What is an ${t('sbt')}?`,
      answer: `An ${t('sbtFull')} is a non-transferable token used as a membership or entitlement signal. A session can use ${t('sbt')} ownership to control participation, resources, or decryption.`,
    },
    {
      id: 'results-visibility',
      question: 'Who can see the results?',
      answer:
        'The session’s result-visibility and access policy decides. New sessions show every answer to the session’s signed-in members, and signed-out visitors see none. A session can instead make its results public, or show each person only their own answers, with session admins and authorized agents able to read session-wide responses. Protected fields still require decryption access.',
    },
  ].map(freezeFaqItem),
);
