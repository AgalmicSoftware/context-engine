import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';
import {
  faCaretDown,
  faCaretUp,
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
import {
  PUBLIC_REPO_URL,
  PUBLIC_WHITEPAPER_URL,
} from '../../variables/publicRepoMetadata.js';
import {
  derivePrimarySessionSlugFromList,
  GLOBAL_SESSION_SELECTION_UPDATED_EVENT,
  readStoredGlobalSessionSelection,
} from '../../utilities/session/globalSessionState.js';

const SLIDES_URL = 'https://docs.google.com/presentation/d/1fFExDsGNpy13SE3TOw9ogasi5BcxXOQwKaXf96mBL-8/edit?usp=sharing';

const HEADER_LINKS = [
  { url: PUBLIC_WHITEPAPER_URL, text: 'Whitepaper', testId: 'ce-about-link-whitepaper' },
  { url: PUBLIC_REPO_URL, text: 'GitHub', testId: 'ce-about-link-github' },
  { url: SLIDES_URL, text: 'Slides', testId: 'ce-about-link-slides' },
];

const RECOGNITION_GROUPS = [
  {
    name: 'Ethereum',
    logo: 'https://ethereum.org/images/assets/eth-diamond-glyph.png',
    itemClassName: 'recognitionItemEthereum',
    logoClassName: 'recognitionLogoEthereum',
    description:
      'Context Engine is built on Ethereum — the decentralized, open-source blockchain that powers the smart contracts, SBT credentials, and on-chain session registry at the core of the platform. Ethereum provides the trustless infrastructure that makes token-gated surveys, verifiable group membership, and encrypted response storage possible without a central authority.',
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
      'RadicalxChange is a research and organizing ecosystem focused on quadratic voting, plural governance, and large-group coordination without winner-take-all collapse. Context Engine overlaps with that governance agenda by mapping where groups agree, where minority views persist, and how communities can build auditable inputs for pluralist decision-making before everything gets flattened into a binary vote.',
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
      'Pol.is is a pioneering conversation platform for large-group opinion mapping, designed to surface both consensus and persistent disagreement in complex public discourse.',
    links: [
      { url: 'https://pol.is/', text: 'Official Website' },
    ],
  },
  {
    name: 'Collective Intelligence Project',
    logo: 'https://images.squarespace-cdn.com/content/v1/631d02b2dfa9482a32db47ec/250a39fb-f2d0-432e-8784-4d2113ba8ae6/favicon.ico?format=100w',
    itemClassName: 'recognitionItemCip',
    logoClassName: 'recognitionLogoCip',
    image: cipPhoto,
    description:
      'The Collective Intelligence Project (CIP) develops frameworks and tools for scalable collective decision-making on transformative technology.',
    links: [
      { url: 'https://cip.org/', text: 'CIP Website' },
    ],
  },
  {
    name: 'Edge City',
    logo: 'https://cdn.prod.website-files.com/65b2cb5abdecf7cd7747e170/65d5ef08c6a2bf96d1f60a27_favicon.png',
    itemClassName: 'recognitionItemEdgePatagonia',
    logoClassName: 'recognitionLogoEdge',
    description:
      'Edge Patagonia hosted a d/acc residency backed by Protocol Labs, bringing builders and researchers together to prototype tools for resilient technology, governance, and collective coordination.',
    links: [
      { url: 'https://www.edgecity.live/patagonia', text: 'Edge City' },
    ],
  },
];

const RECOGNIZED_INDIVIDUALS = [];

const USE_CASES = [
  {
    slug: 'ai-discourse',
    label: 'For AI Discourse',
    icon: faBrain,
    tone: 'mint',
    problem:
      'Public AI discourse is low-dimensional. It collapses into slogans like "accelerate" vs. "pause" even when the real questions are about deployment, liability, labor, surveillance, and public goods.',
    detail:
      'Build a structured public map of AI questions, record positions and predictions in durable form, and make disagreement legible enough that leaders in industry and government cannot hide behind vague camp labels.',
  },
  {
    slug: 'corporate',
    label: 'For Companies',
    icon: faBuilding,
    tone: 'blue',
    problem:
      'Internal signal gets flattened by hierarchy, fragmented tools, and meetings that preserve decisions without preserving why people disagreed.',
    detail:
      'Companies and organizations can surface honest internal signal inside gated spaces, make private predictions, retroactively recognize the strongest predictors, compare perspectives across teams, and preserve decision context over time.',
  },
  {
    slug: 'cities',
    label: 'For Cities',
    icon: faCity,
    tone: 'orange',
    problem:
      'Hearings and polls rarely capture the texture of public disagreement, so cities end up with shallow input on complex civic questions.',
    detail:
      'Cities and policy groups can gather input more nuanced than a poll and more durable than a hearing, with responses that can be public or encrypted and preserved in a durable record.',
  },
  {
    slug: 'conferences',
    label: 'For Events',
    icon: faChalkboardTeacher,
    tone: 'pink',
    problem:
      'Conferences and pop-up communities generate intense discussion, but the shared signal usually disappears as soon as the event ends.',
    detail:
      'Events, including conferences and pop-up cities, can leave with an artifact of where the group stood — opinion space mapped, sub-group differences surfaced, unresolved questions identified — and that artifact keeps growing instead of vanishing when the event ends.',
  },
  {
    slug: 'digital-groups',
    label: 'For Groups',
    icon: faUsers,
    tone: 'gold',
    problem:
      'Digital communities rarely own the preference data, membership boundaries, or AI systems built from what they collectively know.',
    detail:
      'Digital communities can codify fluid values and membership, train AI models to represent them, and monetize tacit and local data in a privacy-preserving, attributable, and revocable way.',
  },
];

const HERO_TERTIARY_LINKS = HEADER_LINKS.filter(Boolean);

export const getConfiguredRecognitionIndividuals = (individuals = []) => individuals.filter(
  (person) => typeof person?.name === 'string' && person.name.trim().length > 0
);

export const getAboutDemoSessionPath = (selection = readStoredGlobalSessionSelection()) => {
  const scopeMode = String(selection?.selectedSessionScope || '').trim().toLowerCase();
  if (scopeMode === 'list') {
    const firstScopedSlug = derivePrimarySessionSlugFromList(selection?.selectedSessionSlugs || []);
    if (firstScopedSlug) return `/session/${encodeURIComponent(firstScopedSlug)}`;
  }
  return '/session/demo';
};

const getRecognitionSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const getRecognitionFallback = (name) => name
  .split(/[^A-Za-z0-9]+/)
  .filter(Boolean)
  .map((chunk) => chunk[0])
  .join('')
  .slice(0, 2)
  .toUpperCase();

const AboutPage = () => {
  const [activeUseCase, setActiveUseCase] = useState('');
  const [activeRecognition, setActiveRecognition] = useState(null);
  const [showPresent, setShowPresent] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [showRecognition, setShowRecognition] = useState(true);
  const [demoSessionPath, setDemoSessionPath] = useState(() => getAboutDemoSessionPath());
  const activeUseCaseConfig = USE_CASES.find(({ slug }) => slug === activeUseCase) || null;
  const configuredRecognitionIndividuals = getConfiguredRecognitionIndividuals(RECOGNIZED_INDIVIDUALS);
  const hasRecognizedIndividuals = configuredRecognitionIndividuals.length > 0;

  const handleUseCaseToggle = (slug) => {
    setActiveUseCase((currentSlug) => (currentSlug === slug ? '' : slug));
  };

  const handleSectionToggleKeyDown = (event, setSectionVisibility) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSectionVisibility((currentState) => !currentState);
    }
  };

  const closeRecognitionModal = () => {
    setActiveRecognition(null);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined;

    const handleGlobalSessionSelectionUpdated = (event) => {
      setDemoSessionPath(getAboutDemoSessionPath(event?.detail || readStoredGlobalSessionSelection()));
    };

    window.addEventListener(
      GLOBAL_SESSION_SELECTION_UPDATED_EVENT,
      handleGlobalSessionSelectionUpdated
    );

    return () => {
      window.removeEventListener(
        GLOBAL_SESSION_SELECTION_UPDATED_EVENT,
        handleGlobalSessionSelectionUpdated
      );
    };
  }, []);

  return (
    <div className={styles.aboutPageContainer}>
      <div className={styles.pageShell}>
        <section className={styles.hero} data-testid="ce-about-hero">
          <div className={styles.heroText}>
            <h1 className={styles.mainTitle}>Context Engine</h1>
            <p className={styles.tagline}>
              An open-source toolkit for large-group deliberation and sensemaking. Built to help us navigate the AI transition.
            </p>

            <div className={styles.heroActions}>
              <Link to={demoSessionPath} className={`${styles.ctaButton} ${styles.primaryButton}`}>
                Explore Demo
              </Link>
            </div>

            <div className={styles.heroLinks}>
              {HERO_TERTIARY_LINKS.map((link) => (
                <a
                  key={link.text}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.tertiaryLink}
                  data-testid={link.testId}
                >
                  {link.text}
                </a>
              ))}
              <a href="mailto:contextengine@protonmail.com" className={styles.tertiaryLink}>
                Email
              </a>
            </div>
          </div>

          <div className={styles.heroVideo}>
            <iframe
              src="https://drive.google.com/file/d/1nss6RZnF4yFwMFE6kjSW3ESi3ImpMcnf/preview"
              className={styles.demoVideo}
              allow="autoplay"
              allowFullScreen
              title="Context Engine demo video"
            />
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
            <article className={styles.useCaseDetail} aria-live="polite">
              <p className={styles.useCaseDetailLabel}>{activeUseCaseConfig.label}</p>
              <div className={styles.useCaseDetailRow}>
                <span className={styles.useCaseDetailProblemTag}>Problem</span>
                <p className={styles.useCaseDetailRowText}>{activeUseCaseConfig.problem}</p>
              </div>
              <div className={styles.useCaseDetailRow}>
                <span className={styles.useCaseDetailSolutionTag}>How CE helps</span>
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
            <h2 className={styles.sectionTitle}>Current Functionalities</h2>
            <FontAwesomeIcon
              icon={showPresent ? faCaretUp : faCaretDown}
              className={styles.toggleIcon}
            />
          </div>
          {showPresent && (
            <div className={styles.collapsibleContent}>
              <ul className={styles.bulletList}>
                <li>Sessions: Create and publish sessions through the Session Wizard, including sponsored-session links and sponsored worker-backed setup flows.</li>
                <li>Questions: Multi-format survey creation and responses (binary, rating, multichoice, freeform), stored permanently on Arweave with hashes in smart contracts. Includes CSV exports, built-in clustering reports, and PDF exports.</li>
                <li>Groups: Deploy soulbound tokens (non-transferable credentials) for gating survey access. Filter and encrypt responses by group membership via Lit Protocol.</li>
                <li>AI Tools: Generate survey questions from URLs, documents, and audio transcripts. AI-assisted analysis and opinion clustering.</li>
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
            <FontAwesomeIcon
              icon={showRoadmap ? faCaretUp : faCaretDown}
              className={styles.toggleIcon}
            />
          </div>
          {showRoadmap && (
            <div className={styles.collapsibleContent}>
              <ul className={styles.bulletList}>
                <li>✅ Stage 1: Upgraded decentralized Pol.is — large-group deliberation with permanent storage</li>
                <li>Stage 2: Public trial for AI safety discourse database</li>
                <li>
                  Stage 3: Advanced cryptography
                  <ul className={styles.roadmapSubList}>
                    <li>Zero-knowledge proofs for encrypted predictions and retroactive evaluation</li>
                    <li>FHE for private computation on encrypted group data</li>
                    <li>Threshold encryption for private group data sharing</li>
                    <li>Privacy-preserving proof-of-unique-human filtering</li>
                  </ul>
                </li>
                <li>
                  Stage 4+: Collaborative worldbuilding, data labor, AI governance agents
                  <ul className={styles.roadmapSubList}>
                    <li>AI agents that learn group preferences and represent communities in governance</li>
                    <li>Data labor tools for groups to monetize preference data revokably</li>
                  </ul>
                </li>
              </ul>
            </div>
          )}
        </section>

        <section
          className={`${styles.section} ${styles.collapsibleSection}`}
          data-testid="ce-about-recognition-toggle"
        >
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
                  {RECOGNITION_GROUPS.map((group) => (
                    group.logo ? (
                      <img
                        key={group.name}
                        src={group.logo}
                        alt=""
                        className={[
                          styles.recognitionSummaryLogo,
                          group.logoClassName ? styles[group.logoClassName] : '',
                        ].filter(Boolean).join(' ')}
                      />
                    ) : (
                      <span
                        key={group.name}
                        className={`${styles.recognitionSummaryLogo} ${styles.recognitionLogoFallback}`}
                      >
                        {getRecognitionFallback(group.name)}
                      </span>
                    )
                  ))}
                </div>
              )}
              <FontAwesomeIcon
                icon={showRecognition ? faCaretUp : faCaretDown}
                className={styles.toggleIcon}
              />
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
                      className={[
                        styles.recognitionItem,
                        group.itemClassName ? styles[group.itemClassName] : '',
                      ].filter(Boolean).join(' ')}
                      data-testid={`ce-about-recognition-${getRecognitionSlug(group.name)}`}
                      title={group.description}
                      onClick={() => setActiveRecognition(group)}
                      aria-haspopup="dialog"
                    >
                      {group.logo ? (
                        <img
                          src={group.logo}
                          alt={`${group.name} logo`}
                          className={[
                            styles.recognitionLogo,
                            group.logoClassName ? styles[group.logoClassName] : '',
                          ].filter(Boolean).join(' ')}
                        />
                      ) : (
                        <span className={styles.recognitionLogoFallback}>
                          {getRecognitionFallback(group.name)}
                        </span>
                      )}
                      <span className={styles.recognitionName}>{group.name}</span>
                    </button>
                  );
                })}
              </div>

              {hasRecognizedIndividuals && (
                <div
                  className={styles.recognitionIndividuals}
                  data-testid="ce-about-recognition-individuals"
                >
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
            close={(
              <button
                type="button"
                className={styles.recognitionModalCloseButton}
                onClick={closeRecognitionModal}
                aria-label="Close recognition details"
              >
                <span aria-hidden="true">×</span>
              </button>
            )}
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
                    ].filter(Boolean).join(' ')}
                  />
                ) : null}
                <span className={styles.recognitionModalTitle}>{activeRecognition.name}</span>
              </div>
            )}
          </ModalHeader>

          <ModalBody className={styles.recognitionModalBody}>
            {activeRecognition && (
              <>
                <p className={styles.recognitionModalDescription}>
                  {activeRecognition.description}
                </p>

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
