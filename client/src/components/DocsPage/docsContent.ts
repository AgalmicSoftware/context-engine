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
      body: 'Follow a shared session link, replace `<slug>` in `/session/<slug>` with the session you want to join, or create a session of your own.',
      links: [
        { href: '/session/general', label: 'Open /session/general' },
        { href: '/session/new', label: 'Create a session' },
      ],
    },
    {
      id: 'create-passkey-wallet',
      title: 'Create your passkey wallet',
      body: 'Use the browser WebAuthn prompt to create or unlock the embedded wallet. There is no seed phrase to manage, and participants do not need crypto expertise.',
    },
    {
      id: 'respond',
      title: 'Answer questions and surveys',
      body: 'Sessions can use binary, rating, multiple-choice, and freeform questions, plus optional conviction weighting and comments.',
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
      body: 'A session profile chooses Cloudflare or Arweave storage. Decentralized sessions use durable Arweave payloads and on-chain anchors; encrypted fields remain ciphertext until an authorized viewer decrypts them.',
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
        'Worker-envelope sessions decrypt only after the Worker applies the configured access policy; decentralized Lit payloads remain client-side ciphertext until their conditions pass.',
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
        'Open `/session/<slug>/docs` to browse a session library. Depending on the profile, records are backed by Arweave or by private Worker-managed storage references.',
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
        'The prompt templates used by these features are published in the Prompts section below.',
      ],
    },
    {
      id: 'limits-listening',
      title: 'Block limits and voice modes',
      summary:
        'Chain-scanned sessions use `blockLimits` to bound discovery. Worker-canonical sessions can instead use `sessionEndsAt` to close participant mutations while preserving allowed reads and admin recovery.',
      points: [
        'Use `?mode=interview` for one-person conversational response drafting or `?mode=recordGroup` to turn a recorded discussion into draft questions.',
        'The optional ChatGPT/Claude memory handoff keeps instructions in the pasted user request, fetches only an inert question catalog, shows the exact packet before encoding, and includes explained per-answer confidence; no relevant signal produces a clean interview link.',
        'The legacy `?mode=listening` link remains supported for the pile-adjacent group recorder, and recording starts only after you press Record.',
      ],
    },
    {
      id: 'session-sources',
      title: 'Demo, Worker, and registry sessions',
      summary:
        'Demo sessions provide curated examples. Worker-canonical sessions use a session Worker as their operational authority, while registry-canonical sessions anchor identity and SBT gate authority on-chain.',
      points: [
        'Legacy demo configuration remains a compatibility source while registry and Worker session reads are resolved.',
        'A pure Worker session does not gain contracts, gas, or on-chain authority from stale legacy fields.',
      ],
    },
  ].map(freezeGuideTopic),
);

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
        'The session profile decides. It may use Worker-managed Cloudflare storage or durable Arweave payloads, with registry-canonical sessions keeping minimal identity, pointers, and gate authority on-chain.',
    },
    {
      id: 'private-answers',
      question: 'Can my answers be private?',
      answer:
        'Yes, when the session enables response encryption. A response can be encrypted for you or for a gated audience, and only an authorized viewer can decrypt the protected fields.',
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
        'The session’s result-visibility and access policy decides. Results may be public aggregates or limited to participants, session members, or administrators, and protected fields still require decryption access.',
    },
  ].map(freezeFaqItem),
);
