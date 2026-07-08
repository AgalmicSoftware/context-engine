import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';
import {
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
import { CE_ABOUT_POSTS_ENABLED } from '../../variables/appConfig.js';
import {
  PUBLIC_REPO_URL,
  PUBLIC_WHITEPAPER_URL,
} from '../../variables/publicRepoMetadata.js';
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
  }[];
};

const HEADER_LINKS = [
  { url: PUBLIC_WHITEPAPER_URL, text: 'Whitepaper', testId: 'ce-about-link-whitepaper', external: true },
];

const ABOUT_DEMO_VIDEO_VIEW_URL = 'https://drive.google.com/file/d/1nss6RZnF4yFwMFE6kjSW3ESi3ImpMcnf/view';
const ABOUT_DEMO_VIDEO_EMBED_URL = 'https://drive.google.com/file/d/1nss6RZnF4yFwMFE6kjSW3ESi3ImpMcnf/preview';
const ABOUT_DEMO_VIDEO_MEDIA_URL = buildPublicRoute('/about-demo.mp4');
const ABOUT_DEMO_VIDEO_THUMBNAIL_URL =
  'https://drive.google.com/thumbnail?id=1nss6RZnF4yFwMFE6kjSW3ESi3ImpMcnf&sz=w1000';

const RECOGNITION_GROUPS: RecognitionGroup[] = [
  {
    name: 'Ethereum',
    logo: 'https://ethereum.org/images/assets/eth-diamond-glyph.png',
    itemClassName: 'recognitionItemEthereum',
    logoClassName: 'recognitionLogoEthereum',
    description:
      'Context Engine uses a passkey Ethereum wallet model rather than email for accounts. Ethereum provides the cryptographic foundation for proof-of-human and attestation-based access, SBT-style membership, gated encryption, and durable on-chain references, while decentralized infrastructure adds censorship-resistance and data permanence. Users do not need any crypto expertise to use it.',
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
      'Context Engine builds on RadicalxChange ideas around social identity, plural governance, and groups owning the data and value they create. SBT-style credentials issued by different communities can shape filtering and encryption, while the broader direction is for digital groups to retain ownership over the preference data and value they create instead of surrendering it to platforms.',
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
      'Pol.is showed how large-group discourse software can clarify both consensus and persistent difference, especially in vTaiwan where simple Agree / Unsure / Disagree inputs helped structure public reasoning. Context Engine builds on that approach with more question types, optional privacy, AI-native workflows, and permanent public storage.',
    links: [{ url: 'https://pol.is/', text: 'Official Website' }],
  },
  {
    name: 'Collective Intelligence Project',
    logo: 'https://images.squarespace-cdn.com/content/v1/631d02b2dfa9482a32db47ec/250a39fb-f2d0-432e-8784-4d2113ba8ae6/favicon.ico?format=100w',
    itemClassName: 'recognitionItemCip',
    logoClassName: 'recognitionLogoCip',
    image: cipPhoto,
    description:
      'Context Engine is social infrastructure for the AI transition: a toolkit for collective intelligence, large-group deliberation, and coordination under information overload. That mission sits directly alongside CIP’s work on scalable collective decision-making for transformative technology.',
    links: [{ url: 'https://cip.org/', text: 'CIP Website' }],
  },
  {
    name: 'Edge City',
    logo: 'https://cdn.prod.website-files.com/65b2cb5abdecf7cd7747e170/65d5ef08c6a2bf96d1f60a27_favicon.png',
    itemClassName: 'recognitionItemEdgePatagonia',
    logoClassName: 'recognitionLogoEdge',
    description:
      'Residencies like the d/acc residency at Edge Patagonia, sponsored by Protocol Labs, created space to prototype tools for resilient technology, coordination, and governance in live community settings.',
    links: [{ url: 'https://www.edgecity.live/patagonia', text: 'Edge City' }],
  },
];

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

const getHeroTertiaryLinks = () => [
  ...HEADER_LINKS,
  ...(CE_ABOUT_POSTS_ENABLED
    ? [{ url: buildPublicRoute('/posts'), text: 'Posts', testId: 'ce-about-link-posts', external: false }]
    : []),
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
  const [showRecognition, setShowRecognition] = useState(true);
  const [mobileDemoVideoStarted, setMobileDemoVideoStarted] = useState(false);
  const [mobileDemoVideoError, setMobileDemoVideoError] = useState('');
  const [demoSessionPath, setDemoSessionPath] = useState(() => getAboutDemoSessionPath());
  const useCaseDetailRef = useRef<HTMLElement | null>(null);
  const mobileDemoVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeUseCaseConfig = USE_CASES.find(({ slug }) => slug === activeUseCase) || null;
  const configuredRecognitionIndividuals = getConfiguredRecognitionIndividuals(RECOGNIZED_INDIVIDUALS);
  const hasRecognizedIndividuals = configuredRecognitionIndividuals.length > 0;
  const heroTertiaryLinks = getHeroTertiaryLinks();

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
      setMobileDemoVideoError('Could not start the embedded video here.');
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
            <div className={styles.titleRow}>
              <h1 className={styles.mainTitle}>Context Engine</h1>
              <a
                href={PUBLIC_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.titleRepoLink}
                data-testid="ce-about-link-github"
                aria-label="View Context Engine on GitHub"
                title="View Context Engine on GitHub"
              >
                <FontAwesomeIcon icon={faGithub} />
              </a>
            </div>
            <p className={styles.tagline}>
              An open-source toolkit for deliberation, sensemaking, and negotiation (for humans and AI agents)
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
            </div>

            <div className={styles.heroLinks}>
              {heroTertiaryLinks.map((link) => (
                <a
                  key={link.text}
                  href={link.url}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  className={styles.tertiaryLink}
                  data-testid={link.testId}
                >
                  {link.text}
                </a>
              ))}
              <a href="mailto:[redacted-email]" className={styles.tertiaryLink}>
                Email
              </a>
            </div>
          </div>

          <div className={styles.heroVideo}>
            <iframe
              src={ABOUT_DEMO_VIDEO_EMBED_URL}
              className={styles.demoVideo}
              allow="autoplay"
              allowFullScreen
              title="Context Engine demo video"
              data-testid="ce-about-demo-video-desktop"
            />
            <div className={styles.mobileDemoVideo} data-testid="ce-about-demo-video-mobile">
              <div className={styles.mobileDemoVideoPlayerWrap}>
                <video
                  ref={mobileDemoVideoRef}
                  className={styles.mobileDemoVideoPlayer}
                  controls
                  playsInline
                  preload="none"
                  poster={ABOUT_DEMO_VIDEO_THUMBNAIL_URL}
                  src={ABOUT_DEMO_VIDEO_MEDIA_URL}
                  data-testid="ce-about-demo-video-player"
                  aria-label="Context Engine demo video player"
                  onPlay={() => {
                    setMobileDemoVideoStarted(true);
                    setMobileDemoVideoError('');
                  }}
                  onError={() => {
                    setMobileDemoVideoStarted(false);
                    setMobileDemoVideoError('Could not start the embedded video here.');
                  }}
                >
                  <a href={ABOUT_DEMO_VIDEO_VIEW_URL} target="_blank" rel="noopener noreferrer">
                    Open the Context Engine demo video.
                  </a>
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
          <div className={styles.useCaseGrid}>
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
            tabIndex={0}
            aria-expanded={showPresent}
          >
            <h2 className={styles.sectionTitle}>Functionality</h2>
            <FontAwesomeIcon icon={showPresent ? faCaretUp : faCaretDown} className={styles.toggleIcon} />
          </div>
          {showPresent && (
            <div className={styles.collapsibleContent}>
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
                    Uses soulbound tokens for gated participation, encrypted fields, and sponsored resources like RPC,
                    AI, transaction costs, Arweave storage, and Lit encryption.
                  </span>
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.featureLabel}>Storage:</span>
                  <span className={styles.featureText}>
                    Lives in durable records, with responses and documents on Arweave plus built-in report views,
                    exports, and address-based comparison tools.
                  </span>
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.featureLabel}>AI:</span>
                  <span className={styles.featureText}>
                    Already supports question generation, transcription, cluster summaries, result analysis, and
                    comparison of user positions across wallets.
                  </span>
                </li>
              </ul>
            </div>
          )}
        </section>

        <section className={`${styles.section} ${styles.collapsibleSection}`}>
          <div
            className={styles.toggleHeader}
            onClick={() => setShowRoadmap((currentState) => !currentState)}
            onKeyDown={(event) => handleSectionToggleKeyDown(event, setShowRoadmap)}
            role="button"
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

        <section className={`${styles.section} ${styles.collapsibleSection}`} data-testid="ce-about-recognition-toggle">
          <div
            className={styles.toggleHeader}
            onClick={() => setShowRecognition((currentState) => !currentState)}
            onKeyDown={(event) => handleSectionToggleKeyDown(event, setShowRecognition)}
            role="button"
            tabIndex={0}
            aria-expanded={showRecognition}
          >
            <h2 className={styles.sectionTitle}>Recognition</h2>
            <div className={styles.toggleHeaderAside}>
              {!showRecognition && (
                <div
                  className={styles.recognitionSummary}
                  data-testid="ce-about-recognition-summary"
                  aria-hidden="true"
                >
                  {RECOGNITION_GROUPS.map((group) =>
                    group.logo ? (
                      <img
                        key={group.name}
                        src={group.logo}
                        alt=""
                        className={[
                          styles.recognitionSummaryLogo,
                          group.logoClassName ? styles[group.logoClassName] : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      />
                    ) : (
                      <span
                        key={group.name}
                        className={`${styles.recognitionSummaryLogo} ${styles.recognitionLogoFallback}`}
                      >
                        {getRecognitionFallback(group.name)}
                      </span>
                    ),
                  )}
                </div>
              )}
              <FontAwesomeIcon icon={showRecognition ? faCaretUp : faCaretDown} className={styles.toggleIcon} />
            </div>
          </div>

          {showRecognition && (
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
                onClick={closeRecognitionModal}
                aria-label="Close recognition details"
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
