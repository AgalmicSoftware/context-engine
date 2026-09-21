import { useState } from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faAward,
  faRobot,
  faMountain,
  faBrain,
  faBuilding,
  faChalkboardTeacher,
  faCity,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import styles from './AboutPage.module.scss';
import cipPhoto from '../../assets/img/cip_photo.png';
import polisLogo from '../../assets/img/polis_logo.png';
import rxcLogo from '../../assets/img/rxc_logo.png';
import foresightLogo from '../../assets/img/about/foresight-logo.svg';
import eddyLogo from '../../assets/img/about/eddy-network.png';
import edgePatagoniaLogo from '../../assets/img/about/edge-patagonia-logo.svg';
import {
  derivePrimarySessionSlugFromList,
  readStoredGlobalSessionSelection,
} from '../../utilities/session/globalSessionState.js';
import { getPrimaryDemoSessionSlug } from '../../utilities/session/demoSessionSlugs.js';
import { buildPublicRoute } from '../MainSite/urlUtils.js';

type RecognitionLink = {
  url: string;
  text: string;
};

export type RecognitionGroup = {
  name: string;
  description: string;
  relationship: string;
  links: RecognitionLink[];
  logo?: string;
  itemClassName?: string;
  logoClassName?: string;
  image?: string;
};

export type RecognitionIndividual = {
  name: string;
  url?: string;
};

type RoadmapSection = {
  category: string;
  items: {
    status: 'complete' | 'planned';
    text: string;
    link?: { to: string; text: string };
  }[];
};

export const RECOGNITION_GROUPS: RecognitionGroup[] = [
  {
    name: 'Ethereum',
    logo: 'https://ethereum.org/images/assets/eth-diamond-glyph.png',
    itemClassName: 'recognitionItemEthereum',
    logoClassName: 'recognitionLogoEthereum',
    description:
      'Ethereum is an open, decentralized network for running smart contracts and applications. Its shared infrastructure lets people coordinate and maintain public records without relying on a single operator.',
    relationship:
      'Context Engine uses Ethereum-compatible accounts and contracts for decentralized sessions, SBT group membership, and on-chain session records. Group credentials can also control access to gated content, with passkey sign-on making accounts easier to use.',
    links: [
      { url: 'https://ethereum.org/', text: 'Ethereum.org' },
      { url: 'https://ethereum.org/en/what-is-ethereum/', text: 'What is Ethereum?' },
    ],
  },
  {
    name: 'RadicalxChange',
    logo: rxcLogo,
    itemClassName: 'recognitionItemRadicalxchange',
    logoClassName: 'recognitionLogoRxc',
    description:
      'RadicalxChange is a movement exploring how democratic institutions, markets, and technology can better reflect our social relationships. Its work develops ideas for plural governance, shared ownership, and collective decision-making.',
    relationship:
      'Context Engine draws on these ideas through community-issued SBT credentials and group deliberation. Its broader direction is for groups to retain ownership of the preference data and value they create.',
    links: [
      { url: 'https://www.radicalxchange.org/', text: 'Official Website' },
      { url: 'https://twitter.com/RadxChange', text: 'Twitter / X' },
    ],
  },
  {
    name: 'Pol.is',
    logo: polisLogo,
    itemClassName: 'recognitionItemPolis',
    logoClassName: 'recognitionLogoPolis',
    description:
      'Pol.is is an open-source tool for gathering opinions and identifying patterns of agreement across large groups. Participants submit statements and respond to others, helping surface shared ground as well as persistent differences.',
    relationship:
      'Context Engine builds on this approach to large-group deliberation with more question types, optional privacy, AI-assisted interviews and analysis, and permanent public storage in decentralized mode.',
    links: [{ url: 'https://pol.is/', text: 'Official Website' }],
  },
  {
    name: 'Collective Intelligence Project',
    logo: 'https://images.squarespace-cdn.com/content/v1/631d02b2dfa9482a32db47ec/250a39fb-f2d0-432e-8784-4d2113ba8ae6/favicon.ico?format=100w',
    itemClassName: 'recognitionItemCip',
    logoClassName: 'recognitionLogoCip',
    image: cipPhoto,
    description:
      'The Collective Intelligence Project studies and builds ways for people to make decisions together about transformative technology. Its work brings public input and democratic participation into the development and governance of AI.',
    relationship:
      'Context Engine shares this focus on collective intelligence through tools for large-group deliberation and coordination. Its sessions help groups express preferences and compare perspectives on complex decisions, including the AI transition.',
    links: [{ url: 'https://cip.org/', text: 'CIP Website' }],
  },
  {
    name: 'Edge City',
    logo: 'https://cdn.prod.website-files.com/65b2cb5abdecf7cd7747e170/65d5ef08c6a2bf96d1f60a27_favicon.png',
    itemClassName: 'recognitionItemEdgePatagonia',
    logoClassName: 'recognitionLogoEdge',
    description:
      'Edge City brings people together in pop-up communities to experiment with technology, culture, and new ways of living and working. Its residencies create space for participants to build and test ideas together.',
    relationship:
      'Context Engine was developed and tested during the d/acc residency at Edge City Patagonia (Sponsored by Protocol Labs).',
    links: [
      { url: 'https://www.edgecity.live/patagonia', text: 'Edge City' },
      {
        url: 'https://www.edgecity.live/blog/the-d-acc-residency-at-edge-city-patagonia-2025',
        text: 'Residency blog post',
      },
    ],
  },
];

type PracticeEntry = {
  id: string;
  title: string;
  url: string;
  description: string;
  icon: IconDefinition;
  image?: string;
  partnerImage?: string;
  wordmark?: 'light' | 'dark';
  photo?: boolean;
};

export const PRACTICE_ENTRIES: PracticeEntry[] = [
  {
    id: 'cosmos-fire',
    title: 'Cosmos × FIRE grants',
    url: 'https://blog.cosmos-institute.org/p/announcing-80-new-cosmos-grantees',
    description:
      'Context Engine was selected for a Cosmos × FIRE AI for Truth-Seeking grant in September 2026, for group deliberation research testing how faithfully AI agents represent the people they act for.',
    icon: faAward,
    image: 'https://www.cosmos-institute.org/media/logo.svg',
    partnerImage: 'https://cosmosaccessmemory.b-cdn.net/1777891088662-oaript.png',
  },
  {
    id: 'foresight',
    title: 'Foresight Institute grant · 2026',
    url: 'https://foresight.org/grants/ai-science-safety-nodes-rfp/',
    description:
      'Context Engine received a grant through Foresight Institute’s AI for Science & Safety Nodes program in 2026. The project studies AI opinions and framing sensitivity, comparing model responses with human perspectives through an open benchmark.',
    icon: faAward,
    image: foresightLogo,
    wordmark: 'light',
  },
  {
    id: 'agent-village',
    title: 'Agent Village 2026',
    url: '/posts/agent-village-wrapped',
    description:
      'Context Engine powered Agent Village Wrapped at Edge Esmeralda 2026, comparing personal agents’ predicted answers with their users’ actual responses. The project write-up reports what the experiment revealed about agent representation.',
    icon: faRobot,
    image: buildPublicRoute('/posts/agent-village-wrapped/attachments/header.jpg'),
    photo: true,
  },
  {
    id: 'eddy',
    title: 'EDDY 2026 demo',
    url: 'https://www.eddy-network.eu/in-person-events/eddy-2026-vienna/program',
    description:
      'Context Engine was selected for the EDDY 2026 demo program in Vienna, presenting its open-source tools for deliberation and negotiation in large groups.',
    icon: faChalkboardTeacher,
    image: eddyLogo,
  },
  {
    id: 'patagonia',
    title: 'd/acc residency · Patagonia 2025',
    url: 'https://www.edgecity.live/blog/the-d-acc-residency-at-edge-city-patagonia-2025',
    description:
      'Context Engine was developed and tested during Edge City’s d/acc residency in Patagonia with Protocol Labs. The residency write-up highlights how testing with participants helped shape Context Engine’s move to passkey sign-on.',
    icon: faMountain,
    image: edgePatagoniaLogo,
    wordmark: 'dark',
  },
];

export const PracticeVisual = ({ entry }: { entry: PracticeEntry }) => {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <span
      className={[
        styles.practiceVisual,
        entry.photo ? styles.practicePhoto : '',
        entry.partnerImage && !imageFailed ? styles.practicePartnerLogos : '',
        entry.wordmark && !imageFailed ? styles.practiceWordmark : '',
        entry.wordmark === 'dark' && !imageFailed ? styles.practiceWordmarkDark : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      {entry.image && !imageFailed ? (
        <>
          <img src={entry.image} alt="" loading="lazy" onError={() => setImageFailed(true)} />
          {entry.partnerImage && (
            <img src={entry.partnerImage} alt="" loading="lazy" onError={() => setImageFailed(true)} />
          )}
        </>
      ) : (
        <FontAwesomeIcon icon={entry.icon} />
      )}
    </span>
  );
};

export const RECOGNIZED_INDIVIDUALS: RecognitionIndividual[] = [];

export const ROADMAP_SECTIONS: RoadmapSection[] = [
  {
    category: 'Current Foundations',
    items: [
      {
        status: 'complete',
        text: 'Create sessions with questions, responses, documents, access gates, and configuration from the web app.',
      },
      {
        status: 'complete',
        text: 'Run binary, rating, multiple-choice, quadratic allocation, and freeform questions with conviction weighting and comments.',
      },
      {
        status: 'complete',
        text: 'Use SBT groups for gated participation, encrypted fields, and sponsored RPC, AI, gas, Arweave, and Lit resources.',
      },
      {
        status: 'complete',
        text: 'Persist responses and documents on Arweave with report views, exports, and address-based comparison tools.',
      },
      {
        status: 'complete',
        text: 'Generate questions, transcribe input, summarize clusters, analyze results, and compare positions across wallets.',
      },
      {
        status: 'complete',
        text: 'Explore shipped demo sessions and reusable AI discourse corpus data from the app and repository.',
      },
    ],
  },
  {
    category: 'Privacy, Credentials, and Safety',
    items: [
      {
        status: 'planned',
        text: 'Stronger privacy with unlinkable per-response and per-SBT accounts, ZK/FHE aggregation, and proofs on encrypted responses.',
      },
      {
        status: 'planned',
        text: 'zkTLS group formation for privacy-preserving groups based on verifiable attributes.',
      },
      {
        status: 'planned',
        text: 'AI whistleblowing toolkit with affiliation proofs, encrypted claims, and conditional timelocks.',
      },
      {
        status: 'planned',
        text: 'Post-quantum cryptography as relevant libraries and standards mature.',
      },
    ],
  },
  {
    category: 'Deployment and Resilience',
    items: [
      {
        status: 'planned',
        text: 'Walkaway resilience through ENS-hosted frontends and stronger decentralized service options.',
      },
      {
        status: 'planned',
        text: 'More storage options, including IPFS for larger or ephemeral files and configurable centralized storage.',
      },
      {
        status: 'planned',
        text: 'Turnkey deployment bundles for Arweave, Lit, EVM gas, and AI API access.',
      },
    ],
  },
  {
    category: 'Interfaces and Inputs',
    items: [
      {
        status: 'planned',
        text: 'Agent-first UX so people can point an assistant at a session and interact through natural language.',
      },
      {
        status: 'planned',
        text: 'Voice-only mode for multilingual interaction through spoken commands.',
      },
      {
        status: 'planned',
        text: 'Better document and context integration with knowledge maps and richer debate-tree flows.',
      },
    ],
  },
  {
    category: 'Preference Data and Models',
    items: [
      {
        status: 'planned',
        text: 'Group-representative AI models that can represent preferences, earn from approved invocations, and sell revocable future access.',
      },
      {
        status: 'planned',
        text: 'Preference weighting for questions, priorities, and representative figures in automated debate.',
      },
    ],
  },
  {
    category: 'Deliberation and Negotiation',
    items: [
      {
        status: 'planned',
        text: 'Group prompting and backcasting from result clusters into scenarios to aim for or avoid.',
      },
      {
        status: 'planned',
        text: 'Agent-to-agent negotiation tooling for multi-step processes involving private information.',
      },
    ],
  },
];

export const USE_CASES = [
  {
    slug: 'ai-discourse',
    label: 'For AI Discourse',
    icon: faBrain,
    tone: 'mint',
    problemTitle: 'Low-Dimensional Debate',
    problem:
      'Public AI discourse gets flattened into slogans like "accelerate" vs. "pause," while harder questions on labor, surveillance, liability, and public goods stay under-specified.',
    solutionTitle: 'Durable Public Map',
    detail:
      'Create a structured public map of AI questions, preferences, and predictions in durable form so disagreement stays legible over time.',
  },
  {
    slug: 'corporate',
    label: 'For Companies',
    icon: faBuilding,
    tone: 'blue',
    problemTitle: 'Lost Decision Context',
    problem:
      'Organizations often preserve decisions without preserving the assumptions, tradeoffs, and confidence behind them.',
    solutionTitle: 'Private Forecasting',
    detail:
      'Record predictions, assumptions, and confidence before outcomes are known, with timestamped entries that can remain encrypted until revealed or proven privately (and in the future, evaluated while still encrypted).',
  },
  {
    slug: 'cities',
    label: 'For Cities',
    icon: faCity,
    tone: 'orange',
    problemTitle: 'Shallow Civic Input',
    problem: 'Polls and hearings rarely capture the texture of public disagreement on complex civic questions.',
    solutionTitle: 'Standing Public Record',
    detail:
      'Gather input that is more nuanced than a poll and more durable than a hearing, with responses that can be filtered across constituencies.',
  },
  {
    slug: 'conferences',
    label: 'For Events',
    icon: faChalkboardTeacher,
    tone: 'pink',
    problemTitle: 'Signal That Vanishes',
    problem: 'High-bandwidth event discussion usually disappears once the gathering ends.',
    solutionTitle: 'Persistent Opinion Map',
    detail:
      'Leave with a durable map of consensus, subgroup differences, and unresolved questions that can keep growing between gatherings.',
  },
  {
    slug: 'digital-groups',
    label: 'For Groups',
    icon: faUsers,
    tone: 'gold',
    problemTitle: 'Platform-Owned Group Data',
    problem:
      'Online communities rarely own the preference data, membership boundaries, or AI systems built from what they collectively know.',
    solutionTitle: 'Representative Models',
    detail:
      'Codify group preferences over time, train representative AI models, and keep community data attributable, licensable, and revocable.',
  },
];

export const getConfiguredRecognitionIndividuals = (individuals: unknown[] = []): RecognitionIndividual[] =>
  individuals.filter(
    (person): person is RecognitionIndividual =>
      !!person &&
      typeof person === 'object' &&
      typeof (person as { name?: unknown }).name === 'string' &&
      (person as { name: string }).name.trim().length > 0,
  );

export const getAboutDemoSessionPath = (selection = readStoredGlobalSessionSelection()) => {
  const scopeMode = String(selection?.selectedSessionScope || '')
    .trim()
    .toLowerCase();
  if (scopeMode === 'list') {
    const firstScopedSlug = derivePrimarySessionSlugFromList(selection?.selectedSessionSlugs || []);
    if (firstScopedSlug) return `/session/${encodeURIComponent(firstScopedSlug)}`;
  }
  return `/session/${encodeURIComponent(getPrimaryDemoSessionSlug())}`;
};

export const getRecognitionSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const getRecognitionFallback = (name: string) =>
  name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((chunk: string) => chunk[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
