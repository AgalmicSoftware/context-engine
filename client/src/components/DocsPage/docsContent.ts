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
      body: 'Follow a shared session link, replace `<slug>` in `/session/<slug>` with the session you want to join, or create a session of your own. On the setup page, “Set up with your AI” lets ChatGPT or Claude ask about your session and fill in the page for you to review.',
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
        'It depends on the session, and new sessions start with public results. When a session enables response encryption, answers and additional comments have independent locks, can be encrypted for you or for a gated audience, and only an authorized viewer can decrypt the protected fields. Comments follow the answer lock only when you explicitly choose that option. In on-chain sessions, which wallet answered which question stays public.',
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
        'The session’s result-visibility and access policy decides. New sessions start public, so anyone can see the results. A session can instead show each person only their own answers, with session admins and authorized agents able to read session-wide responses. Protected fields still require decryption access.',
    },
  ].map(freezeFaqItem),
);
