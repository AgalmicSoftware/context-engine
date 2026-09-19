import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';
import {
  faEnvelope,
  faFileAlt,
  faAward,
  faRobot,
  faMountain,
  faCaretDown,
  faCaretUp,
  faBrain,
  faBuilding,
  faChalkboardTeacher,
  faCity,
  faPlay,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import styles from './AboutPage.module.scss';
import cipPhoto from '../../assets/img/cip_photo.png';
import polisLogo from '../../assets/img/polis_logo.png';
import rxcLogo from '../../assets/img/rxc_logo.png';
import foresightLogo from '../../assets/img/about/foresight-logo.svg';
import eddyLogo from '../../assets/img/about/eddy-network.png';
import edgePatagoniaLogo from '../../assets/img/about/edge-patagonia-logo.svg';
import { PUBLIC_REPO_URL, PUBLIC_WHITEPAPER_URL } from '../../variables/publicRepoMetadata.js';
import {
  derivePrimarySessionSlugFromList,
  GLOBAL_SESSION_SELECTION_UPDATED_EVENT,
  readStoredGlobalSessionSelection,
} from '../../utilities/session/globalSessionState.js';
import { getPrimaryDemoSessionSlug } from '../../utilities/session/demoSessionSlugs.js';
import { buildPublicRoute } from '../MainSite/urlUtils.js';

type RecognitionLink = {
  url: string;
  text: string;
};

type RecognitionGroup = {
  name: string;
  description: string;
  relationship: string;
  links: RecognitionLink[];
  logo?: string;
  itemClassName?: string;
  logoClassName?: string;
  image?: string;
};

type RecognitionIndividual = {
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

const ABOUT_DEMO_VIDEO_MEDIA_URL = buildPublicRoute('/about-demo.mp4');

const RECOGNITION_GROUPS: RecognitionGroup[] = [
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
      { url: 'https://www.edgecity.live/blog/the-d-acc-residency-at-edge-city-patagonia-2025', text: 'Residency blog post' },
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

const PRACTICE_ENTRIES: PracticeEntry[] = [
  {
    id: 'cosmos-fire',
    title: 'Cosmos × FIRE grants',
    url: 'https://blog.cosmos-institute.org/p/announcing-80-new-cosmos-grantees',
    description: 'Context Engine was selected for a Cosmos × FIRE AI for Truth-Seeking grant in September 2026, for group deliberation research testing how faithfully AI agents represent the people they act for.',
    icon: faAward,
    image: 'https://www.cosmos-institute.org/media/logo.svg',
    partnerImage: 'https://cosmosaccessmemory.b-cdn.net/1777891088662-oaript.png',
  },
  {
    id: 'foresight',
    title: 'Foresight Institute grant · 2026',
    url: 'https://foresight.org/grants/ai-science-safety-nodes-rfp/',
    description: 'Context Engine received a grant through Foresight Institute’s AI for Science & Safety Nodes program in 2026. The project studies AI opinions and framing sensitivity, comparing model responses with human perspectives through an open benchmark.',
    icon: faAward,
    image: foresightLogo,
    wordmark: 'light',
  },
  {
    id: 'agent-village',
    title: 'Agent Village 2026',
    url: '/posts/agent-village-wrapped',
    description: 'Context Engine powered Agent Village Wrapped at Edge Esmeralda 2026, comparing personal agents’ predicted answers with their users’ actual responses. The project write-up reports what the experiment revealed about agent representation.',
    icon: faRobot,
    image: buildPublicRoute('/posts/agent-village-wrapped/attachments/header.jpg'),
    photo: true,
  },
  {
    id: 'eddy',
    title: 'EDDY 2026 demo',
    url: 'https://www.eddy-network.eu/in-person-events/eddy-2026-vienna/program',
    description: 'Context Engine was selected for the EDDY 2026 demo program in Vienna, presenting its open-source tools for deliberation and negotiation in large groups.',
    icon: faChalkboardTeacher,
    image: eddyLogo,
  },
  {
    id: 'patagonia',
    title: 'd/acc residency · Patagonia 2025',
    url: 'https://www.edgecity.live/blog/the-d-acc-residency-at-edge-city-patagonia-2025',
    description: 'Context Engine was developed and tested during Edge City’s d/acc residency in Patagonia with Protocol Labs. The residency write-up highlights how testing with participants helped shape Context Engine’s move to passkey sign-on.',
    icon: faMountain,
    image: edgePatagoniaLogo,
    wordmark: 'dark',
  },
];

const PracticeVisual = ({ entry }: { entry: PracticeEntry }) => {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <span className={[
      styles.practiceVisual,
      entry.photo ? styles.practicePhoto : '',
      entry.partnerImage && !imageFailed ? styles.practicePartnerLogos : '',
      entry.wordmark && !imageFailed ? styles.practiceWordmark : '',
      entry.wordmark === 'dark' && !imageFailed ? styles.practiceWordmarkDark : '',
    ].filter(Boolean).join(' ')} aria-hidden="true">
      {entry.image && !imageFailed ? (
        <>
          <img src={entry.image} alt="" loading="lazy" onError={() => setImageFailed(true)} />
          {entry.partnerImage && <img src={entry.partnerImage} alt="" loading="lazy" onError={() => setImageFailed(true)} />}
        </>
      ) : (
        <FontAwesomeIcon icon={entry.icon} />
      )}
    </span>
  );
};

const RECOGNIZED_INDIVIDUALS: RecognitionIndividual[] = [];

const ROADMAP_SECTIONS: RoadmapSection[] = [
  {
    category: 'Current Foundations',
    items: [
      {
        status: 'complete',
        text: 'Create sessions with questions, responses, documents, access gates, and configuration from the web app.',
      },
      {
        status: 'complete',
        text: 'Run binary, rating, multiple-choice, and freeform questions with conviction weighting and comments.',
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

const USE_CASES = [
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

const getRecognitionSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const getRecognitionFallback = (name: string) =>
  name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((chunk: string) => chunk[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const AboutPage = () => {
  const [activeUseCase, setActiveUseCase] = useState('');
  const [activeRecognition, setActiveRecognition] = useState<RecognitionGroup | null>(null);
  const [showPresent, setShowPresent] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [showRelatedWork, setShowRelatedWork] = useState(false);
  const [showInPractice, setShowInPractice] = useState(false);
  const [expandedTitleLink, setExpandedTitleLink] = useState<string | null>(null);
  const titleLinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mobileDemoVideoStarted, setMobileDemoVideoStarted] = useState(false);
  const [mobileDemoVideoError, setMobileDemoVideoError] = useState('');
  const [demoSessionPath, setDemoSessionPath] = useState(() => getAboutDemoSessionPath());
  const [showUsesJump, setShowUsesJump] = useState(false);
  const useCaseGridRef = useRef<HTMLDivElement | null>(null);
  const useCaseDetailRef = useRef<HTMLElement | null>(null);
  const mobileDemoVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeUseCaseConfig = USE_CASES.find(({ slug }) => slug === activeUseCase) || null;
  const configuredRecognitionIndividuals = getConfiguredRecognitionIndividuals(RECOGNIZED_INDIVIDUALS);
  const hasRecognizedIndividuals = configuredRecognitionIndividuals.length > 0;

  useEffect(() => {
    const updateUsesJump = () => {
      const grid = useCaseGridRef.current;
      // Compare document coordinates so scrolling does not change initial-viewport eligibility.
      setShowUsesJump(Boolean(grid && window.innerWidth >= 641 && window.innerWidth <= 1023
        && grid.getBoundingClientRect().bottom + window.scrollY > window.innerHeight));
    };
    updateUsesJump();
    window.addEventListener('resize', updateUsesJump);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateUsesJump);
    observer?.observe(document.documentElement);
    if (useCaseGridRef.current) observer?.observe(useCaseGridRef.current);
    return () => {
      window.removeEventListener('resize', updateUsesJump);
      observer?.disconnect();
    };
  }, []);

  const revealTitleLink = (label: string) => {
    if (titleLinkTimer.current !== null) clearTimeout(titleLinkTimer.current);
    setExpandedTitleLink(label);
    titleLinkTimer.current = setTimeout(() => {
      setExpandedTitleLink(null);
      titleLinkTimer.current = null;
    }, 1000);
  };

  useEffect(() => () => {
    if (titleLinkTimer.current !== null) clearTimeout(titleLinkTimer.current);
  }, []);

  const handleUseCaseToggle = (slug: string) => {
    setActiveUseCase((currentSlug) => (currentSlug === slug ? '' : slug));
  };

  const handleSectionToggleKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    setSectionVisibility: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSectionVisibility((currentState) => !currentState);
    }
  };

  const closeRecognitionModal = () => {
    setActiveRecognition(null);
  };

  const handleMobileDemoVideoPlay = async () => {
    const video = mobileDemoVideoRef.current;
    if (!video) return;

    setMobileDemoVideoError('');

    try {
      video.load();
      await video.play();
      setMobileDemoVideoStarted(true);
    } catch (error) {
      setMobileDemoVideoStarted(false);
      setMobileDemoVideoError('Could not start the demo video here.');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined;

    const handleGlobalSessionSelectionUpdated = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : null;
      setDemoSessionPath(getAboutDemoSessionPath(detail || readStoredGlobalSessionSelection()));
    };

    window.addEventListener(GLOBAL_SESSION_SELECTION_UPDATED_EVENT, handleGlobalSessionSelectionUpdated);

    return () => {
      window.removeEventListener(GLOBAL_SESSION_SELECTION_UPDATED_EVENT, handleGlobalSessionSelectionUpdated);
    };
  }, []);

  useEffect(() => {
    if (!activeUseCaseConfig || !useCaseDetailRef.current || typeof window === 'undefined') {
      return undefined;
    }

    const detailNode = useCaseDetailRef.current;
    const prefersReducedMotion =
      typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
    const isCompactViewport =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(max-width: 640px)').matches
        : window.innerWidth <= 640;

    const scrollUseCaseIntoView = () => {
      const detailRect = detailNode.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const detailIsFullyVisible = detailRect.top >= 0 && detailRect.bottom <= viewportHeight;

      if (!isCompactViewport && detailIsFullyVisible) {
        return;
      }

      detailNode.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    };

    if (typeof window.requestAnimationFrame === 'function') {
      const frameId = window.requestAnimationFrame(scrollUseCaseIntoView);
      return () => {
        if (typeof window.cancelAnimationFrame === 'function') {
          window.cancelAnimationFrame(frameId);
        }
      };
    }

    scrollUseCaseIntoView();
    return undefined;
  }, [activeUseCaseConfig]);

  return (
    <div className={styles.aboutPageContainer}>
      <div className={styles.pageShell}>
        <section className={styles.hero} data-testid="ce-about-hero">
          <div className={styles.heroText}>
            <div className={styles.titleRow} data-testid="ce-about-title-row">
              <h1 className={styles.mainTitle}>Context Engine</h1>
              <div className={styles.titleLinks}>
                <a
                  href={PUBLIC_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.titleRepoLink}
                  data-testid="ce-about-link-github"
                  aria-label="View Context Engine on GitHub"
                  data-label-visible={expandedTitleLink === 'github'}
                  onMouseEnter={() => revealTitleLink('github')}
                  onFocus={() => revealTitleLink('github')}
                  onPointerDown={() => revealTitleLink('github')}
                  onClick={() => revealTitleLink('github')}
                >
                  <span className={styles.titleLinkIcon}><FontAwesomeIcon icon={faGithub} /></span>
                  <span className={styles.titleLinkLabel} aria-hidden="true">github</span>
                </a>
                <a
                  href="mailto:contextengine@protonmail.com"
                  className={styles.titleRepoLink}
                  data-testid="ce-about-link-email"
                  aria-label="Email Context Engine"
                  data-label-visible={expandedTitleLink === 'mail'}
                  onMouseEnter={() => revealTitleLink('mail')}
                  onFocus={() => revealTitleLink('mail')}
                  onPointerDown={() => revealTitleLink('mail')}
                  onClick={() => revealTitleLink('mail')}
                >
                  <span className={styles.titleLinkIcon}><FontAwesomeIcon icon={faEnvelope} /></span>
                  <span className={styles.titleLinkLabel} aria-hidden="true">mail</span>
                </a>
                <a
                  href={PUBLIC_WHITEPAPER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.titleRepoLink}
                  data-testid="ce-about-link-whitepaper"
                  aria-label="Whitepaper"
                  data-label-visible={expandedTitleLink === 'whitepaper'}
                  onMouseEnter={() => revealTitleLink('whitepaper')}
                  onFocus={() => revealTitleLink('whitepaper')}
                  onPointerDown={() => revealTitleLink('whitepaper')}
                  onClick={() => revealTitleLink('whitepaper')}
                >
                  <span className={styles.titleLinkIcon}><FontAwesomeIcon icon={faFileAlt} /></span>
                  <span className={styles.titleLinkLabel} aria-hidden="true">whitepaper</span>
                </a>
              </div>
            </div>
            <p className={styles.tagline}>
              An open toolkit for deliberation, decision-making, and negotiation (for humans and AI agents)
            </p>

            <div className={styles.heroActions}>
              <Link
                to={demoSessionPath}
                className={`${styles.ctaButton} ${styles.primaryButton} ${styles.heroPrimaryButton}`}
              >
                Demo
              </Link>
              <Link
                to={buildPublicRoute('/new')}
                className={`${styles.ctaButton} ${styles.secondaryButton} ${styles.heroPrimaryButton}`}
              >
                New Session
              </Link>
              {showUsesJump && (
              <button
                type="button"
                className={`${styles.ctaButton} ${styles.secondaryButton} ${styles.heroPrimaryButton} ${styles.usesButton}`}
                data-testid="ce-about-uses"
                data-ce-control-appearance="frameless"
                onClick={() => useCaseGridRef.current?.scrollIntoView({
                  behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                  block: 'start',
                })}
              >
                Uses <FontAwesomeIcon icon={faCaretDown} aria-hidden="true" />
              </button>
              )}
            </div>


          </div>

          <div className={styles.heroVideo}>
            <video
              className={styles.demoVideo}
              controls
              playsInline
              preload="metadata"
              src={ABOUT_DEMO_VIDEO_MEDIA_URL}
              data-testid="ce-about-demo-video-desktop"
              aria-label="Context Engine demo video player"
            >
              <a href={ABOUT_DEMO_VIDEO_MEDIA_URL}>Open the Context Engine demo video.</a>
            </video>
            <div className={styles.mobileDemoVideo} data-testid="ce-about-demo-video-mobile">
              <div className={styles.mobileDemoVideoPlayerWrap}>
                <video
                  ref={mobileDemoVideoRef}
                  className={styles.mobileDemoVideoPlayer}
                  controls
                  playsInline
                  preload="none"
                  src={ABOUT_DEMO_VIDEO_MEDIA_URL}
                  data-testid="ce-about-demo-video-player"
                  aria-label="Context Engine demo video player"
                  onPlay={() => {
                    setMobileDemoVideoStarted(true);
                    setMobileDemoVideoError('');
                  }}
                  onError={() => {
                    setMobileDemoVideoStarted(false);
                    setMobileDemoVideoError('Could not start the demo video here.');
                  }}
                >
                  <a href={ABOUT_DEMO_VIDEO_MEDIA_URL}>Open the Context Engine demo video.</a>
                </video>
                {!mobileDemoVideoStarted && (
                  <button
                    type="button"
                    className={styles.mobileDemoVideoPlayButton}
                    onClick={handleMobileDemoVideoPlay}
                    aria-label="Play Context Engine demo video"
                    data-testid="ce-about-demo-video-play"
                  >
                    <span className={styles.mobileDemoVideoPlayIcon} aria-hidden="true">
                      <FontAwesomeIcon icon={faPlay} />
                    </span>
                  </button>
                )}
              </div>
              {mobileDemoVideoError && (
                <p className={styles.mobileDemoVideoStatus} role="alert">
                  {mobileDemoVideoError}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.useCaseGrid} ref={useCaseGridRef} data-testid="ce-about-use-cases">
            {USE_CASES.map((useCase) => (
              <button
                key={useCase.slug}
                type="button"
                className={`${styles.useCaseTile} ${styles[`useCaseTile${useCase.tone.charAt(0).toUpperCase()}${useCase.tone.slice(1)}`]} ${activeUseCase === useCase.slug ? styles.useCaseTileActive : ''}`}
                data-testid={`ce-about-usecase-${useCase.slug}`}
                aria-pressed={activeUseCase === useCase.slug}
                onClick={() => handleUseCaseToggle(useCase.slug)}
              >
                <span className={styles.useCaseTileContent}>
                  <FontAwesomeIcon icon={useCase.icon} className={styles.useCaseIcon} />
                  <span className={styles.useCaseLabel}>{useCase.label}</span>
                </span>
              </button>
            ))}
          </div>

          {activeUseCaseConfig && (
            <article ref={useCaseDetailRef} className={styles.useCaseDetail} aria-live="polite" aria-atomic="true">
              <p className={styles.srOnly}>{activeUseCaseConfig.label}</p>
              <div className={styles.useCaseDetailRow}>
                <span className={styles.useCaseDetailProblemTag}>{activeUseCaseConfig.problemTitle}</span>
                <p className={styles.useCaseDetailRowText}>{activeUseCaseConfig.problem}</p>
              </div>
              <div className={styles.useCaseDetailRow}>
                <span className={styles.useCaseDetailSolutionTag}>{activeUseCaseConfig.solutionTitle}</span>
                <p className={styles.useCaseDetailRowText}>{activeUseCaseConfig.detail}</p>
              </div>
            </article>
          )}
        </section>

        <section className={`${styles.section} ${styles.collapsibleSection}`}>
          <div
            className={styles.toggleHeader}
            onClick={() => setShowPresent((currentState) => !currentState)}
            onKeyDown={(event) => handleSectionToggleKeyDown(event, setShowPresent)}
            role="button"
            data-ce-control-appearance="frameless"
            tabIndex={0}
            aria-expanded={showPresent}
          >
            <h2 className={styles.sectionTitle}>Functionality</h2>
            <FontAwesomeIcon icon={showPresent ? faCaretUp : faCaretDown} className={styles.toggleIcon} />
          </div>
          {showPresent && (
            <div className={`${styles.collapsibleContent} ${styles.unframedContent}`}>
              <ul className={styles.featureList}>
                <li className={styles.featureItem}>
                  <span className={styles.featureLabel}>Sessions:</span>
                  <span className={styles.featureText}>
                    Include questions, responses, documents, access gates, and configuration, and new sessions can be
                    created from the web application.
                  </span>
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.featureLabel}>Questions:</span>
                  <span className={styles.featureText}>
                    Supports binary, rating, multiple-choice, and freeform questions, with optional conviction weighting
                    and comments.
                  </span>
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.featureLabel}>Access Control:</span>
                  <span className={styles.featureText}>
                    Uses <Link to="/groups">SBT groups</Link> for gated participation, gated content, and sponsored resources like RPC,
                    AI, transaction costs, Arweave storage, and Lit encryption.
                  </span>
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.featureLabel}>Storage:</span>
                  <span className={styles.featureText}>
                    Stores responses and documents in Cloudflare or on Arweave, depending on session mode, with report views,
                    exports, and account-based comparison tools.
                  </span>
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.featureLabel}>AI:</span>
                  <span className={styles.featureText}>
                    Natural language interviews by voice or text, question generation, transcription, cluster summaries,
                    result analysis, and comparison of positions across accounts.
                  </span>
                </li>
              </ul>
            </div>
          )}
        </section>

        <section className={`${styles.section} ${styles.collapsibleSection}`} aria-labelledby="ce-about-related-heading" data-testid="ce-about-related-work">
          <div
            className={`${styles.toggleHeader} ${styles.relatedToggle}`}
            onClick={() => setShowRelatedWork((currentState) => !currentState)}
            onKeyDown={(event) => handleSectionToggleKeyDown(event, setShowRelatedWork)}
            role="button"
            data-ce-control-appearance="frameless"
            data-testid="ce-about-related-toggle"
            tabIndex={0}
            aria-expanded={showRelatedWork}
            aria-controls="ce-about-related-content"
          >
            <h2 className={styles.sectionTitle} id="ce-about-related-heading">Related Work</h2>
            <div className={styles.toggleHeaderAside}>
              {!showRelatedWork && (
                <span className={styles.relatedSummary} data-testid="ce-about-related-summary" aria-hidden="true">
                  {['benchmark', 'eval', 'media'].map((category) => (
                    <span className={styles.relatedPill} key={category}>{category}</span>
                  ))}
                </span>
              )}
              <FontAwesomeIcon icon={showRelatedWork ? faCaretUp : faCaretDown} className={styles.toggleIcon} />
            </div>
          </div>
          {showRelatedWork && (
            <div className={`${styles.collapsibleContent} ${styles.unframedContent}`} id="ce-about-related-content">
              <ul className={styles.featureList}>
                <li className={styles.featureItem}>
                  <div className={styles.relatedCardHeading}>
                    <span className={styles.relatedPill}>benchmark</span>
                    <h3 className={styles.featureLabel}><Link to="/benchmarks">AI Opinions Benchmark</Link></h3>
                  </div>
                  <p className={styles.featureText}>
                    Context Engine’s AI Opinions Benchmark uses its open AI discourse corpus and results views to map
                    model positions on AI futures and policy. It compares agreement, disagreement, and sensitivity to
                    reversed question wording, making model opinions available to explore alongside human perspectives.
                  </p>
                </li>
                <li className={styles.featureItem}>
                  <div className={styles.relatedCardHeading}>
                    <span className={styles.relatedPill}>eval</span>
                    <h3 className={styles.featureLabel}><Link to="/posts/agent-village-wrapped">The Agent Mirror Test</Link></h3>
                  </div>
                  <p className={styles.featureText}>
                    At Edge Esmeralda 2026, Context Engine compared personal agents’ predicted answers with their
                    users’ own responses. The evaluation examines how faithfully agents represent the people they act for.
                  </p>
                </li>
                <li className={styles.featureItem}>
                  <div className={styles.relatedCardHeading}>
                    <span className={styles.relatedPill}>eval</span>
                    <h3 className={styles.featureLabel}>
                      <a href="https://app.primeintellect.ai/dashboard/environments" target="_blank" rel="noopener noreferrer">CommonGround · Prime Intellect</a>
                    </h3>
                  </div>
                  <p className={styles.featureText}>
                    Context Engine exports deliberation data for CommonGround, an evaluation environment designed for
                    Prime Intellect’s tooling. Models predict held-out participant responses and receive deterministic
                    scores. This work connects a company’s stakeholder feedback to tests of how well its AI represents those preferences.
                  </p>
                </li>
                <li className={styles.featureItem}>
                  <div className={styles.relatedCardHeading}>
                    <span className={styles.relatedPill}>media</span>
                    <h3 className={styles.featureLabel}>Ladders Made of Numbers</h3>
                  </div>
                  <p className={styles.featureText}>
                    Speculative stories exploring cryptography, cooperation, and agent-mediated negotiation—the
                    ideas behind Context Engine through possible futures at human scale.
                  </p>
                </li>
              </ul>
            </div>
          )}
        </section>

        <section className={`${styles.section} ${styles.collapsibleSection}`} aria-labelledby="ce-about-in-practice-heading" data-testid="ce-about-in-practice">
          <div
            className={`${styles.toggleHeader} ${styles.practiceToggle}`}
            onClick={() => setShowInPractice((currentState) => !currentState)}
            onKeyDown={(event) => handleSectionToggleKeyDown(event, setShowInPractice)}
            role="button"
            data-ce-control-appearance="frameless"
            data-testid="ce-about-in-practice-toggle"
            tabIndex={0}
            aria-expanded={showInPractice}
            aria-controls="ce-about-in-practice-content"
          >
            <h2 className={styles.sectionTitle} id="ce-about-in-practice-heading">Recognition</h2>
            <div className={styles.toggleHeaderAside}>
              {!showInPractice && (
                <span className={styles.practiceSummary} data-testid="ce-about-practice-summary" aria-hidden="true">
                  {PRACTICE_ENTRIES.map((entry) => <PracticeVisual key={entry.id} entry={entry} />)}
                  <span className={styles.acknowledgementPreview}>
                    {RECOGNITION_GROUPS.map((group) => (
                      <span className={styles.practiceVisual} key={group.name}>
                        {group.logo ? <img src={group.logo} alt="" loading="lazy" /> : getRecognitionFallback(group.name)}
                      </span>
                    ))}
                  </span>
                </span>
              )}
              <FontAwesomeIcon icon={showInPractice ? faCaretUp : faCaretDown} className={styles.toggleIcon} />
            </div>
          </div>
          {showInPractice && (
            <div className={`${styles.collapsibleContent} ${styles.unframedContent}`} id="ce-about-in-practice-content">
              <section aria-labelledby="ce-about-used-by-heading" data-testid="ce-about-used-by">
                <h3 className={styles.recognitionSubheading} id="ce-about-used-by-heading">Recognized &amp; Used By</h3>
                <ul className={styles.featureList}>
                  {PRACTICE_ENTRIES.map((entry) => (
                    <li className={`${styles.featureItem} ${styles.practiceCard}`} key={entry.id}>
                      <div className={styles.practiceCardHeading}>
                        <PracticeVisual entry={entry} />
                        <h4 className={styles.featureLabel}>
                          {entry.url.startsWith('/') ? (
                            <Link to={entry.url}>{entry.title}</Link>
                          ) : (
                            <a href={entry.url} target="_blank" rel="noopener noreferrer">{entry.title}</a>
                          )}
                        </h4>
                      </div>
                      <p className={styles.featureText}>{entry.description}</p>
                    </li>
                  ))}
                </ul>
              </section>
              <section className={styles.acknowledgementsSection} aria-labelledby="ce-about-acknowledgements-heading">
                <h3 className={styles.recognitionSubheading} id="ce-about-acknowledgements-heading">Acknowledgements</h3>
                <div className={styles.recognitionCard}>
                  <div className={styles.recognitionStrip}>
                    {RECOGNITION_GROUPS.map((group) => {
                      return (
                        <button
                          key={group.name}
                          type="button"
                          className={[styles.recognitionItem, group.itemClassName ? styles[group.itemClassName] : '']
                            .filter(Boolean)
                            .join(' ')}
                          data-testid={`ce-about-recognition-${getRecognitionSlug(group.name)}`}
                          title={group.description}
                          onClick={() => setActiveRecognition(group)}
                          aria-haspopup="dialog"
                        >
                          {group.logo ? (
                            <img
                              src={group.logo}
                              alt={`${group.name} logo`}
                              className={[styles.recognitionLogo, group.logoClassName ? styles[group.logoClassName] : '']
                                .filter(Boolean)
                                .join(' ')}
                            />
                          ) : (
                            <span className={styles.recognitionLogoFallback}>{getRecognitionFallback(group.name)}</span>
                          )}
                          <span className={styles.recognitionName}>{group.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {hasRecognizedIndividuals && (
                    <div className={styles.recognitionIndividuals} data-testid="ce-about-recognition-individuals">
                      {configuredRecognitionIndividuals.map((person) => (
                        <span key={person.name} className={styles.recognitionIndividual}>
                          {person.url ? (
                            <a href={person.url} target="_blank" rel="noopener noreferrer">
                              {person.name}
                            </a>
                          ) : (
                            person.name
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </section>

        <section className={`${styles.section} ${styles.collapsibleSection}`}>
          <div
            className={styles.toggleHeader}
            onClick={() => setShowRoadmap((currentState) => !currentState)}
            onKeyDown={(event) => handleSectionToggleKeyDown(event, setShowRoadmap)}
            role="button"
            data-ce-control-appearance="frameless"
            tabIndex={0}
            aria-expanded={showRoadmap}
          >
            <h2 className={styles.sectionTitle}>Roadmap</h2>
            <FontAwesomeIcon icon={showRoadmap ? faCaretUp : faCaretDown} className={styles.toggleIcon} />
          </div>
          {showRoadmap && (
            <div className={styles.collapsibleContent}>
              <ul className={styles.roadmapSectionList}>
                {ROADMAP_SECTIONS.map((section) => (
                  <li className={styles.roadmapSectionItem} key={section.category}>
                    <h3 className={styles.roadmapCategory}>{section.category}</h3>
                    <ul className={styles.roadmapChecklist}>
                      {section.items.map((item) => (
                        <li
                          className={`${styles.roadmapChecklistItem} ${
                            item.status === 'complete'
                              ? styles.roadmapChecklistItemComplete
                              : styles.roadmapChecklistItemPlanned
                          }`}
                          key={item.text}
                        >
                          <span className={styles.roadmapCheck} aria-hidden="true" />
                          <span>
                            <span className={styles.srOnly}>
                              {item.status === 'complete' ? 'Complete: ' : 'Planned: '}
                            </span>
                            {item.link && <><Link to={item.link.to}>{item.link.text}</Link>{' '}</>}
                            {item.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <Modal
          isOpen={Boolean(activeRecognition)}
          toggle={closeRecognitionModal}
          centered
          modalClassName={styles.recognitionModalDialog}
          backdropClassName={styles.recognitionBackdrop}
        >
          <ModalHeader
            toggle={closeRecognitionModal}
            className={styles.recognitionModalHeaderBar}
            close={
              <button
                type="button"
                className={styles.recognitionModalCloseButton}
                data-ce-control-appearance="frameless"
                onClick={closeRecognitionModal}
                aria-label="Close acknowledgement details"
              >
                <span aria-hidden="true">×</span>
              </button>
            }
          >
            {activeRecognition && (
              <div className={styles.recognitionModalHeader}>
                {activeRecognition.logo ? (
                  <img
                    src={activeRecognition.logo}
                    alt={`${activeRecognition.name} logo`}
                    className={[
                      styles.recognitionModalLogo,
                      activeRecognition.logoClassName ? styles[activeRecognition.logoClassName] : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  />
                ) : null}
                <span className={styles.recognitionModalTitle}>{activeRecognition.name}</span>
              </div>
            )}
          </ModalHeader>

          <ModalBody className={styles.recognitionModalBody}>
            {activeRecognition && (
              <>
                <p className={styles.recognitionModalDescription}>{activeRecognition.description}</p>
                <p className={styles.recognitionModalDescription}>{activeRecognition.relationship}</p>

                {activeRecognition?.image && (
                  <img
                    src={activeRecognition.image}
                    alt={activeRecognition.name + ' overview'}
                    className={styles.recognitionModalImage}
                  />
                )}

                {activeRecognition.links?.length ? (
                  <div className={styles.recognitionModalLinks}>
                    {activeRecognition.links.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.recognitionModalLink}
                      >
                        {link.text}
                      </a>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </ModalBody>
        </Modal>
      </div>
    </div>
  );
};

export default AboutPage;
