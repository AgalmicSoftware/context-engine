import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';
import { faEnvelope, faFileAlt, faCaretDown, faCaretUp, faPlay } from '@fortawesome/free-solid-svg-icons';
import styles from './AboutPage.module.scss';
import { PUBLIC_REPO_URL, PUBLIC_WHITEPAPER_URL } from '../../variables/publicRepoMetadata.js';
import {
  GLOBAL_SESSION_SELECTION_UPDATED_EVENT,
  readStoredGlobalSessionSelection,
} from '../../utilities/session/globalSessionState.js';
import { buildPublicRoute } from '../MainSite/urlUtils.js';
import {
  getAboutDemoSessionPath,
  getConfiguredRecognitionIndividuals,
  getRecognitionFallback,
  getRecognitionSlug,
  PracticeVisual,
  PRACTICE_ENTRIES,
  RECOGNITION_GROUPS,
  RECOGNIZED_INDIVIDUALS,
  ROADMAP_SECTIONS,
  USE_CASES,
  type RecognitionGroup,
} from './AboutPageContent';

export { getAboutDemoSessionPath, getConfiguredRecognitionIndividuals } from './AboutPageContent';

const ABOUT_DEMO_VIDEO_MEDIA_URL = buildPublicRoute('/about-demo.mp4');

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
      setShowUsesJump(
        Boolean(
          grid &&
          window.innerWidth >= 641 &&
          window.innerWidth <= 1023 &&
          grid.getBoundingClientRect().bottom + window.scrollY > window.innerHeight,
        ),
      );
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

  useEffect(
    () => () => {
      if (titleLinkTimer.current !== null) clearTimeout(titleLinkTimer.current);
    },
    [],
  );

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
                  <span className={styles.titleLinkIcon}>
                    <FontAwesomeIcon icon={faGithub} />
                  </span>
                  <span className={styles.titleLinkLabel} aria-hidden="true">
                    github
                  </span>
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
                  <span className={styles.titleLinkIcon}>
                    <FontAwesomeIcon icon={faEnvelope} />
                  </span>
                  <span className={styles.titleLinkLabel} aria-hidden="true">
                    mail
                  </span>
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
                  <span className={styles.titleLinkIcon}>
                    <FontAwesomeIcon icon={faFileAlt} />
                  </span>
                  <span className={styles.titleLinkLabel} aria-hidden="true">
                    whitepaper
                  </span>
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
                  onClick={() =>
                    useCaseGridRef.current?.scrollIntoView({
                      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                      block: 'start',
                    })
                  }
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
                    Uses <Link to="/groups">SBT groups</Link> for gated participation, gated content, and sponsored
                    resources like RPC, AI, transaction costs, Arweave storage, and Lit encryption.
                  </span>
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.featureLabel}>Storage:</span>
                  <span className={styles.featureText}>
                    Stores responses and documents in Cloudflare or on Arweave, depending on session mode, with report
                    views, exports, and account-based comparison tools.
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

        <section
          className={`${styles.section} ${styles.collapsibleSection}`}
          aria-labelledby="ce-about-related-heading"
          data-testid="ce-about-related-work"
        >
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
            <h2 className={styles.sectionTitle} id="ce-about-related-heading">
              Related Work
            </h2>
            <div className={styles.toggleHeaderAside}>
              {!showRelatedWork && (
                <span className={styles.relatedSummary} data-testid="ce-about-related-summary" aria-hidden="true">
                  {['benchmark', 'eval', 'media'].map((category) => (
                    <span className={styles.relatedPill} key={category}>
                      {category}
                    </span>
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
                    <h3 className={styles.featureLabel}>
                      <Link to="/benchmarks">AI Opinions Benchmark</Link>
                    </h3>
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
                    <h3 className={styles.featureLabel}>
                      <Link to="/posts/agent-village-wrapped">The Agent Mirror Test</Link>
                    </h3>
                  </div>
                  <p className={styles.featureText}>
                    At Edge Esmeralda 2026, Context Engine compared personal agents’ predicted answers with their users’
                    own responses. The evaluation examines how faithfully agents represent the people they act for.
                  </p>
                </li>
                <li className={styles.featureItem}>
                  <div className={styles.relatedCardHeading}>
                    <span className={styles.relatedPill}>eval</span>
                    <h3 className={styles.featureLabel}>
                      <a
                        href="https://app.primeintellect.ai/dashboard/environments"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        CommonGround · Prime Intellect
                      </a>
                    </h3>
                  </div>
                  <p className={styles.featureText}>
                    Context Engine exports deliberation data for CommonGround, an evaluation environment designed for
                    Prime Intellect’s tooling. Models predict held-out participant responses and receive deterministic
                    scores. This work connects a company’s stakeholder feedback to tests of how well its AI represents
                    those preferences.
                  </p>
                </li>
                <li className={styles.featureItem}>
                  <div className={styles.relatedCardHeading}>
                    <span className={styles.relatedPill}>media</span>
                    <h3 className={styles.featureLabel}>Ladders Made of Numbers</h3>
                  </div>
                  <p className={styles.featureText}>
                    Speculative stories exploring cryptography, cooperation, and agent-mediated negotiation—the ideas
                    behind Context Engine through possible futures at human scale.
                  </p>
                </li>
              </ul>
            </div>
          )}
        </section>

        <section
          className={`${styles.section} ${styles.collapsibleSection}`}
          aria-labelledby="ce-about-in-practice-heading"
          data-testid="ce-about-in-practice"
        >
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
            <h2 className={styles.sectionTitle} id="ce-about-in-practice-heading">
              Recognition
            </h2>
            <div className={styles.toggleHeaderAside}>
              {!showInPractice && (
                <span className={styles.practiceSummary} data-testid="ce-about-practice-summary" aria-hidden="true">
                  {PRACTICE_ENTRIES.map((entry) => (
                    <PracticeVisual key={entry.id} entry={entry} />
                  ))}
                  <span className={styles.acknowledgementPreview}>
                    {RECOGNITION_GROUPS.map((group) => (
                      <span className={styles.practiceVisual} key={group.name}>
                        {group.logo ? (
                          <img src={group.logo} alt="" loading="lazy" />
                        ) : (
                          getRecognitionFallback(group.name)
                        )}
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
                <h3 className={styles.recognitionSubheading} id="ce-about-used-by-heading">
                  Recognized &amp; Used By
                </h3>
                <ul className={styles.featureList}>
                  {PRACTICE_ENTRIES.map((entry) => (
                    <li className={`${styles.featureItem} ${styles.practiceCard}`} key={entry.id}>
                      <div className={styles.practiceCardHeading}>
                        <PracticeVisual entry={entry} />
                        <h4 className={styles.featureLabel}>
                          {entry.url.startsWith('/') ? (
                            <Link to={entry.url}>{entry.title}</Link>
                          ) : (
                            <a href={entry.url} target="_blank" rel="noopener noreferrer">
                              {entry.title}
                            </a>
                          )}
                        </h4>
                      </div>
                      <p className={styles.featureText}>{entry.description}</p>
                    </li>
                  ))}
                </ul>
              </section>
              <section className={styles.acknowledgementsSection} aria-labelledby="ce-about-acknowledgements-heading">
                <h3 className={styles.recognitionSubheading} id="ce-about-acknowledgements-heading">
                  Acknowledgements
                </h3>
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
                              className={[
                                styles.recognitionLogo,
                                group.logoClassName ? styles[group.logoClassName] : '',
                              ]
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
                            {item.link && (
                              <>
                                <Link to={item.link.to}>{item.link.text}</Link>{' '}
                              </>
                            )}
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
