/** @file ToolExplorer.tsx */

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faCog,
  faExclamationTriangle,
  faExpand,
  faEye,
  faLightbulb,
  faPlus,
  faProjectDiagram,
  faQuestionCircle,
  faSearch,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { createLogger } from '../../utilities/logging';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { hasCachedCreateSbtForm } from '../../utilities/sbt/sbtCreateFormCache.js';
import { sbtsListPath } from '../../utilities/ui/terminology.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import { getAllSessionSlugs, getSessionConfigBySlug } from '../../utilities/web3/chainGateway.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { toStr } from '../../utilities/shared/primitives.js';

import { Container, Row, Col } from 'reactstrap';

import ToolExplorerPluginExplainer from './ToolExplorerPluginExplainer';
import LazyFallback from '../Shared/LazyFallback';
import SessionChipSelector from '../Shared/SessionChipSelector';

import riskMatrixImage from '../../assets/img/risk_matrix.jpg';
import modelDirectoryImage from '../../assets/img/model_directory.jpg';
import debateTreeImage from '../../assets/img/debate_tree.jpg';
import worldVoteImage from '../../assets/img/world_vote.jpg';
import magnifyingGlassImage from '../../assets/img/magnifying_glass.png';
import artHeader from '../../assets/img/art_header.png';
import styles from './ToolExplorer.module.scss';
import plusSignImage from '../../assets/img/plus_sign.png';

// Tools/plugins are lazy-loaded so chunks are fetched only on click.
const RiskMatrix = React.lazy(() => import('../MainContent/RiskMatrix'));
const SurveyTool = React.lazy(() => import('../SurveyTool/SurveyTool'));
const AudioInput = React.lazy(() => import('../Shared/AudioInput/AudioInput'));
const SBTsPage = React.lazy(() => import('../SBTs/SBTsPage'));
const DebateMap = React.lazy(() => import('../DebateMap/DebateMap'));
const AudioSurveyGenerator = React.lazy(() => import('../SurveyTool/SurveyGenerator/SurveyGenerator'));

const log = createLogger('ui');

type ToolComponent = React.ComponentType<any> | React.LazyExoticComponent<React.ComponentType<any>>;

type ToolData = {
  name: string;
  subtext: string;
  icon: IconDefinition;
  explainText: string;
  image: string;
  headerImage?: string | null;
  content: ToolComponent;
  disabled: boolean;
  status: 'live' | 'future';
};

type ExpandedComponentState = {
  component: ToolComponent;
  data: ToolData;
  props?: Record<string, unknown>;
} | null;

type ToolExplorerProps = {
  activeSessionSlug?: unknown;
  demoSurfaceMode?: unknown;
  [key: string]: unknown;
};

const ToolExplorer = (props: ToolExplorerProps) => {
  const [expandedComponent, setExpandedComponent] = useState<ExpandedComponentState>(null);
  const [showEmbeddedCreateGroup, setShowEmbeddedCreateGroup] = useState(false);
  const [dataToolMode, setDataToolMode] = useState('add');
  const [showDataSessionSelector, setShowDataSessionSelector] = useState(false);
  const [dataSessionOverrideSlug, setDataSessionOverrideSlug] = useState<string | null>(null);
  const [dataSessionOverrideTouched, setDataSessionOverrideTouched] = useState(false);
  const demoSurfaceEnabled = props.demoSurfaceMode !== false;
  const showDemoCards = demoSurfaceEnabled;

  const exampleData: ToolData[] = [
    {
      name: 'Questions',
      subtext: 'Create and explore questions.',
      icon: faQuestionCircle,
      explainText:
        'Survey and question platform allowing detailed responses, advanced question formats, preference weighing, and group filtering. Responses can be encrypted for privacy and retroactive evaluation by ZK systems (opt-in). Audio input processed by OpenAI – not stored by this app. Responses stored permanently on Arweave',
      image: worldVoteImage,
      headerImage: artHeader,
      content: SurveyTool,
      disabled: false,
      status: 'live',
    },
    {
      name: 'Groups',
      subtext: 'Organize and manage groups.',
      icon: faUsers,
      explainText:
        'Soulbound tokens (non-transferrable NFTs) enable digital groups to organize and coordinate by representing membership, roles, and permissions on-chain. SBTs can create private spaces for collective action, decision-making, and training custom AI models together, unlocking new possibilities for decentralized governance.',
      image: modelDirectoryImage,
      content: SBTsPage,
      disabled: false,
      status: 'live',
    },
    {
      name: 'Context',
      subtext: 'Analyze and explore context.',
      icon: faSearch,
      explainText:
        'AI Database Tool ingests URLs or PDFs, generates debate-worthy questions using AI, and allows users to select and add these questions to a debate tree and/or question bank.',
      image: magnifyingGlassImage,
      headerImage: null,
      content: AudioSurveyGenerator,
      disabled: false,
      status: 'live',
    },
    {
      name: 'Debate Tree',
      subtext: 'For efficient discourse',
      icon: faProjectDiagram,
      explainText:
        'Demo of an interactive version of Deepmind\'s "AI Policy Atlas". Intended to help users structure and navigate complex arguments, and to help AI researchers and policymakers understand and communicate about AI policy issues. Work in progress.',
      image: debateTreeImage,
      headerImage: null,
      content: DebateMap,
      disabled: false,
      status: 'future',
    },
    {
      name: 'Risks',
      subtext: 'Track opps and risks',
      icon: faExclamationTriangle,
      explainText:
        'A tool for collective "heatmap" tracking of opportunities and risks related to disruptive technologies. Input from other areas of the site could be used to populate and improve this display. Axes could be different, and a 3D version (with subcategories) can be previewed by clicking a row and column',
      image: riskMatrixImage,
      headerImage: null,
      content: RiskMatrix,
      disabled: false,
      status: 'future',
    },
    {
      name: 'Suggest Tool',
      subtext: 'Fill form',
      icon: faLightbulb,
      explainText: 'Suggest a tool or plugin which would aid in coordination between AI researchers and/or the public',
      image: plusSignImage,
      headerImage: null,
      content: AudioInput,
      disabled: true,
      status: 'future',
    },
  ];

  const exampleComponents = exampleData.map((data, i) => ({
    Component: data.content,
    props: {
      key: i,
      name: data.name,
      subtext: data.subtext,
      explainText: data.explainText,
      icon: data.icon,
      image: data.image,
      disabled: data.disabled,
      status: data.status,
    },
    data: data,
  }));
  const visibleExampleComponents = exampleComponents.filter(({ data }) => showDemoCards || data.status !== 'future');
  const useSparseGrid = !expandedComponent && visibleExampleComponents.length <= 3;

  const expandedToolName = expandedComponent?.data?.name || '';
  const showGroupsHeaderActions = expandedToolName === 'Groups';
  const showDataHeaderActions = expandedToolName === 'Context';
  const expandedDemoCard = expandedComponent?.data?.status === 'future';
  const selectedDataSessionSlug = useMemo(
    () =>
      dataSessionOverrideTouched
        ? normalizeSessionSlug(dataSessionOverrideSlug || '')
        : normalizeSessionSlug(props.activeSessionSlug || ''),
    [dataSessionOverrideSlug, dataSessionOverrideTouched, props.activeSessionSlug],
  );
  const dataSessionSelectorOptions = useMemo(() => {
    const options = new Map();
    const pushOption = (slugIn = '') => {
      const slug = normalizeSessionSlug(slugIn || '');
      if (options.has(slug)) return;
      const cfg = getSessionConfigBySlug(slug) || {};
      const sessionName = toStr(cfg?.sessionName || '').trim();
      const slugLabel = slug || 'General';
      const label =
        sessionName && sessionName.toLowerCase() !== slugLabel.toLowerCase()
          ? `${sessionName} (${slugLabel})`
          : sessionName || slugLabel;
      options.set(slug, {
        key: `database-session-${slug || 'general'}`,
        slug,
        label,
        selected: selectedDataSessionSlug === slug,
        general: slug === '',
        primary: normalizeSessionSlug(props.activeSessionSlug || '') === slug,
        chipTestId: `ce-database-session-chip-${slug || 'general'}`,
      });
    };

    pushOption(selectedDataSessionSlug);
    pushOption(toStr(props.activeSessionSlug));
    pushOption('');
    (getAllSessionSlugs({ includeEmpty: true }) || []).forEach(pushOption);
    return Array.from(options.values());
  }, [props.activeSessionSlug, selectedDataSessionSlug]);

  const readInitialGroupsCreateState = () =>
    hasCachedCreateSbtForm({
      sessionSlug: toStr(props.activeSessionSlug),
      migrateLegacyToSessionKey: true,
      clearInvalid: true,
    } as any);

  const handleClick = (Component: ToolComponent, data: ToolData) => {
    if (!data.disabled) {
      setDataToolMode('add');
      setShowDataSessionSelector(false);
      if (data.name === 'Groups') {
        setShowEmbeddedCreateGroup(readInitialGroupsCreateState());
      } else {
        setShowEmbeddedCreateGroup(false);
      }
      setExpandedComponent(() => ({
        component: Component,
        data: data,
      }));
    }
  };

  const resetExpandedComponent = () => {
    setShowEmbeddedCreateGroup(false);
    setDataToolMode('add');
    setShowDataSessionSelector(false);
    setDataSessionOverrideSlug(null);
    setDataSessionOverrideTouched(false);
    setExpandedComponent(null);
  };

  const toggleEmbeddedCreateGroup = () => {
    setShowEmbeddedCreateGroup((prevState) => !prevState);
  };

  const handleDataSessionSelect = (slugIn: unknown) => {
    setDataSessionOverrideSlug(normalizeSessionSlug(slugIn || ''));
    setDataSessionOverrideTouched(true);
  };

  const resetDataSessionSelection = () => {
    setDataSessionOverrideSlug(null);
    setDataSessionOverrideTouched(false);
  };

  useEffect(() => {
    if (props.demoSurfaceMode === false && expandedDemoCard) {
      setShowEmbeddedCreateGroup(false);
      setExpandedComponent(null);
    }
  }, [expandedDemoCard, props.demoSurfaceMode]);

  const expandedChildProps = expandedComponent
    ? {
        ...expandedComponent.data,
        account: props.account,
        provider: props.provider,
        litHooks: props.litHooks,
        activeSessionSlug: props.activeSessionSlug,
        sessionConfig: props.sessionConfig || getSessionConfigBySlug(props.activeSessionSlug || '') || null,
        ensureLightSbtUniverse: props.ensureLightSbtUniverse,
        loginComplete: props.loginComplete,
        toggleLoginModal: props.toggleLoginModal,
        network: props.network,
        networkChainId: props.networkChainId,
        isSBTCacheReady: props.isSBTCacheReady,
        isSurveyCacheReady: props.isSurveyCacheReady,
        isQuestionCacheReady: props.isQuestionCacheReady,
        isResponsesCacheReady: props.isResponsesCacheReady,
        questionResponsesNonce: props.questionResponsesNonce,
        questionScanProgress: props.questionScanProgress,
        ...(expandedToolName === 'Questions'
          ? {
              preventUrlChange: true,
            }
          : {}),
        ...(expandedToolName === 'Debate Tree' ? { demoMode: demoSurfaceEnabled } : {}),
        ...(showGroupsHeaderActions
          ? {
              hideMiniActionRow: true,
              showCreateGroupAboveFeatured: true,
              showCreateGroupExternal: showEmbeddedCreateGroup,
              onCreateGroupToggleExternal: toggleEmbeddedCreateGroup,
            }
          : {}),
        ...(showDataHeaderActions
          ? {
              explorerMode: dataToolMode,
              demoSurfaceMode: props.demoSurfaceMode,
              sessionOverrideSlug: dataSessionOverrideSlug,
              sessionOverrideTouched: dataSessionOverrideTouched,
              hideInternalSessionSelector: true,
            }
          : {}),
      }
    : null;

  return (
    <>
      {showDemoCards ? (
        <Container className={`${styles.legendContainer} ${expandedComponent ? styles.hidden : ''}`}>
          <div className={styles.legendItem}>
            <div className={`${styles.legendDot} ${styles.live}`}></div>
            <span className={styles.legendText}>Live</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendDot} ${styles.future}`}></div>
            <span className={styles.legendText}>Demo</span>
          </div>
        </Container>
      ) : null}
      <Container className={`${styles.explorerContainer} ${useSparseGrid ? styles.explorerContainerSparse : ''}`}>
        {expandedComponent ? (
          <div className={styles.breadcrumbContainer}>
            <div className={styles.expandedHeaderRow}>
              <div className={styles.expandedHeaderLead}>
                <button
                  type="button"
                  className={`${styles.headerActionButton} ${styles.headerActionButtonPrimary}`}
                  onClick={resetExpandedComponent}
                >
                  ← Back
                </button>

                <div className={styles.expandedHeaderMeta}>
                  <ToolExplorerPluginExplainer
                    explainText={expandedComponent.data.explainText}
                    {...(expandedComponent.props || {})}
                  />
                </div>
              </div>

              <div className={styles.expandedHeaderActions}>
                {showGroupsHeaderActions && (
                  <>
                    <a
                      href={buildPublicRoute(sbtsListPath())}
                      className={`${styles.headerActionButton} ${styles.headerActionButtonSecondary} ${styles.headerActionLink}`}
                    >
                      <FontAwesomeIcon icon={faExpand} />
                      View All
                    </a>
                    <button
                      type="button"
                      className={`${styles.headerActionButton} ${styles.headerActionButtonSecondary}`}
                      onClick={toggleEmbeddedCreateGroup}
                      data-testid={E2E_TESTIDS.SBTS_CREATE_TOGGLE}
                    >
                      <FontAwesomeIcon icon={faPlus} />
                      {showEmbeddedCreateGroup ? 'Exit' : 'Create'}
                    </button>
                  </>
                )}

                {showDataHeaderActions && (
                  <div className={styles.headerModeToggleGroup}>
                    <button
                      type="button"
                      className={`${styles.headerActionButton} ${styles.headerActionButtonSecondary} ${styles.headerModeButton} ${dataToolMode === 'add' ? styles.headerActionButtonActive : ''}`}
                      onClick={() => setDataToolMode('add')}
                      data-testid={E2E_TESTIDS.TOOL_EXPLORER_DATA_ADD}
                    >
                      <FontAwesomeIcon icon={faPlus} />
                      Add
                    </button>
                    <button
                      type="button"
                      className={`${styles.headerActionButton} ${styles.headerActionButtonSecondary} ${styles.headerModeButton} ${dataToolMode === 'view' ? styles.headerActionButtonActive : ''}`}
                      onClick={() => setDataToolMode('view')}
                      data-testid={E2E_TESTIDS.TOOL_EXPLORER_DATA_VIEW}
                    >
                      <FontAwesomeIcon icon={faEye} />
                      View
                    </button>
                    <div className={styles.headerSessionSelector} data-testid="ce-database-session-selector">
                      <button
                        type="button"
                        className={`${styles.headerActionButton} ${styles.headerActionButtonSecondary} ${styles.headerIconButton} ${showDataSessionSelector ? styles.headerActionButtonActive : ''}`}
                        onClick={() => setShowDataSessionSelector((value) => !value)}
                        aria-label="Context session selector"
                        data-testid="ce-database-session-selector-toggle"
                      >
                        <FontAwesomeIcon icon={faCog} />
                      </button>
                      {showDataSessionSelector && (
                        <div
                          className={styles.headerSessionSelectorPanel}
                          data-testid="ce-database-session-selector-panel"
                        >
                          <div className={styles.headerSessionSelectorHeader}>
                            <div className={styles.headerSessionSelectorHint}>
                              {dataSessionOverrideTouched
                                ? 'Using a local AudioSurveyGenerator override.'
                                : 'Using the global primary session by default.'}
                            </div>
                            {dataSessionOverrideTouched ? (
                              <button
                                type="button"
                                className={`${styles.headerActionButton} ${styles.headerActionButtonSecondary} ${styles.headerSessionResetButton}`}
                                onClick={resetDataSessionSelection}
                              >
                                Use global default
                              </button>
                            ) : null}
                          </div>
                          <SessionChipSelector
                            options={dataSessionSelectorOptions}
                            onToggle={handleDataSessionSelect}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {expandedComponent.data.name === 'Debate Tree' && (
                  <a
                    href={buildPublicRoute('/atlas')}
                    className={`${styles.headerActionButton} ${styles.headerActionButtonSecondary} ${styles.headerActionLink}`}
                    title="Open in Full Screen"
                  >
                    <FontAwesomeIcon icon={faExpand} />
                    Full Screen
                  </a>
                )}
              </div>
            </div>

            <Suspense fallback={<LazyFallback label="Loading..." minHeight="30vh" />}>
              {React.createElement(expandedComponent.component, expandedChildProps)}
            </Suspense>
          </div>
        ) : (
          <Row className={`${styles.explorerRow} ${useSparseGrid ? styles.explorerRowSparse : ''}`}>
            {visibleExampleComponents.map(({ Component, props, data }, index) => (
              <Col
                key={index}
                xs="12"
                sm="6"
                md="4"
                className={`${styles.explorerCol} ${useSparseGrid ? styles.explorerColSparse : ''} ${props.disabled ? styles.disabled : ''} ${styles[props.status]} ${demoSurfaceEnabled ? styles.statusBorderEnabled : ''}`}
                onClick={() => handleClick(Component, data)}
              >
                <div className={styles.square}>
                  <FontAwesomeIcon icon={props.icon} className={styles.classicToolIcon} aria-hidden="true" />
                  <div
                    className={styles.backgroundImage}
                    style={{
                      backgroundImage: `url(${props.image})`,
                    }}
                  ></div>
                  <div className={styles.squareText}>{props.name}</div>
                  <div className={styles.squareSubtext}>{props.subtext}</div>
                </div>
              </Col>
            ))}
          </Row>
        )}
      </Container>
    </>
  );
};

export default ToolExplorer;
