/** @file ToolExplorer.jsx */

import React, { useEffect, useState, Suspense } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExpand, faEye, faPlus } from '@fortawesome/free-solid-svg-icons';
import { createLogger } from '../../utilities/logging';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { hasCachedCreateSbtForm } from '../../utilities/sbt/createSbtFormCache.js';
import { sbtsListPath } from '../../utilities/ui/terminology.js';

import {
  Container,
  Row,
  Col,
} from 'reactstrap';

import ToolExplorerPluginExplainer from './ToolExplorerPluginExplainer.jsx';
import LazyFallback from '../Shared/LazyFallback.jsx';

import riskMatrixImage from '../../assets/img/risk_matrix.jpg';
import modelDirectoryImage from '../../assets/img/model_directory.jpg';
import debateTreeImage from '../../assets/img/debate_tree.jpg';
import worldVoteImage from '../../assets/img/world_vote.jpg';
import magnifyingGlassImage from '../../assets/img/magnifying_glass.png';
import artHeader from '../../assets/img/art_header.png';
import styles from './ToolExplorer.module.scss';
import plusSignImage from '../../assets/img/plus_sign.png';

// Tools/plugins are lazy-loaded so chunks are fetched only on click.
const RiskMatrix = React.lazy(() => import("../MainContent/RiskMatrix.jsx"));
const SurveyTool = React.lazy(() => import("../SurveyTool/SurveyTool.jsx"));
const AudioInput = React.lazy(() => import("../Shared/AudioInput/AudioInput.jsx"));
const SBTsPage = React.lazy(() => import("../SBTs/SBTsPage.jsx"));
const DebateMap = React.lazy(() => import("../DebateMap/DebateMap.jsx"));
const AudioSurveyGenerator = React.lazy(() => import("../SurveyTool/SurveyGenerator/SurveyGenerator.jsx"));

const log = createLogger('ui');
const getConfiguredPublicBasePath = () => {
  const raw = String(
    (typeof process !== 'undefined' && process?.env ? process.env.PUBLIC_URL : '') || ''
  ).trim();
  if (!raw) return '';
  try {
    return String(new URL(raw).pathname || '').trim().replace(/\/+$/, '');
  } catch (_) {
    return raw.replace(/\/+$/, '');
  }
};
const buildPublicRoute = (pathname = '') => {
  const normalizedPath = String(pathname || '').trim();
  if (!normalizedPath) return getConfiguredPublicBasePath() || '/';
  const basePath = getConfiguredPublicBasePath();
  return `${basePath}${normalizedPath}` || normalizedPath;
};

const ToolExplorer = (props) => {
  const [expandedComponent, setExpandedComponent] = useState(null);
  const [showEmbeddedCreateGroup, setShowEmbeddedCreateGroup] = useState(false);
  const [dataToolMode, setDataToolMode] = useState('add');
  const demoSurfaceEnabled = props.demoSurfaceMode !== false;
  const showDemoCards = demoSurfaceEnabled;

  const exampleData = [
    {
      name: 'Questions',
      subtext: 'Opinions and Priorities',
      explainText: 'Survey and question platform allowing detailed responses, advanced question formats, preference weighing, and group filtering. Responses can be encrypted for privacy and retroactive evaluation by ZK systems (opt-in). Audio input processed by OpenAI – not stored by this app. Responses stored permanently on Arweave',
      image: worldVoteImage,
      headerImage: artHeader,
      content: SurveyTool,
      disabled: false,
      status: 'live',
    },
    {
      name: 'Groups',
      subtext: 'Create and Use',
      explainText: 'Soulbound tokens (non-transferrable NFTs) enable digital groups to organize and coordinate by representing membership, roles, and permissions on-chain. SBTs can create private spaces for collective action, decision-making, and training custom AI models together, unlocking new possibilities for decentralized governance.',
      image: modelDirectoryImage,
      content: SBTsPage,
      disabled: false,
      status: 'live',
    },
    {
      name: 'Data',
      subtext: 'AI Opinion Database',
      explainText: 'AI Database Tool ingests URLs or PDFs, generates debate-worthy questions using AI, and allows users to select and add these questions to a debate tree and/or question bank.',
      image: magnifyingGlassImage,
      headerImage: null,
      content: AudioSurveyGenerator,
      disabled: false,
      status: 'live',
    },
    {
      name: 'Debate Tree',
      subtext: 'For efficient discourse',
      explainText: 'Demo of an interactive version of Deepmind\'s "AI Policy Atlas". Intended to help users structure and navigate complex arguments, and to help AI researchers and policymakers understand and communicate about AI policy issues. Work in progress.',
      image: debateTreeImage,
      headerImage: null,
      content: DebateMap,
      disabled: false,
      status: 'future',
    },
    {
      name: 'Risks',
      subtext: 'Track opps and risks',
      explainText: 'A tool for collective "heatmap" tracking of opportunities and risks related to disruptive technologies. Input from other areas of the site could be used to populate and improve this display. Axes could be different, and a 3D version (with subcategories) can be previewed by clicking a row and column',
      image: riskMatrixImage,
      headerImage: null,
      content: RiskMatrix,
      disabled: false,
      status: 'future',
    },
    {
      name: 'Suggest Tool',
      subtext: 'Fill form',
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
  const showDataHeaderActions = expandedToolName === 'Data';
  const expandedDemoCard = expandedComponent?.data?.status === 'future';

  const readInitialGroupsCreateState = () => (
    hasCachedCreateSbtForm({
      sessionSlug: props.activeSessionSlug || '',
      migrateLegacyToSessionKey: true,
      clearInvalid: true,
    })
  );

  const handleClick = (Component, data) => {
    if (!data.disabled) {
      setDataToolMode('add');
      if (data.name === 'Groups') {
        setShowEmbeddedCreateGroup(readInitialGroupsCreateState());
      } else {
        setShowEmbeddedCreateGroup(false);
      }
      setExpandedComponent(() => ({
        component: Component,
        data: data
      }));
    }
  };

  const resetExpandedComponent = () => {
    setShowEmbeddedCreateGroup(false);
    setDataToolMode('add');
    setExpandedComponent(null);
  };

  const toggleEmbeddedCreateGroup = () => {
    setShowEmbeddedCreateGroup((prevState) => !prevState);
  };

  useEffect(() => {
    if (props.demoSurfaceMode === false && expandedDemoCard) {
      setShowEmbeddedCreateGroup(false);
      setExpandedComponent(null);
    }
  }, [expandedDemoCard, props.demoSurfaceMode]);

  const expandedChildProps = expandedComponent ? {
    ...expandedComponent.data,
    account: props.account,
    provider: props.provider,
    activeSessionSlug: props.activeSessionSlug,
    loginComplete: props.loginComplete,
    toggleLoginModal: props.toggleLoginModal,
    network: props.network,
    isSBTCacheReady: props.isSBTCacheReady,
    isSurveyCacheReady: props.isSurveyCacheReady,
    isQuestionCacheReady: props.isQuestionCacheReady,
    ...(expandedToolName === 'Debate Tree'
      ? { demoMode: demoSurfaceEnabled }
      : {}),
    ...(showGroupsHeaderActions ? {
      hideMiniActionRow: true,
      showCreateGroupAboveFeatured: true,
      showCreateGroupExternal: showEmbeddedCreateGroup,
      onCreateGroupToggleExternal: toggleEmbeddedCreateGroup,
    } : {}),
    ...(showDataHeaderActions ? {
      explorerMode: dataToolMode,
      demoSurfaceMode: props.demoSurfaceMode,
    } : {}),
  } : null;

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
                    {...expandedComponent.props}
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
              {React.createElement(
                expandedComponent.component,
                expandedChildProps,
              )}
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
              className={`${styles.explorerCol} ${useSparseGrid ? styles.explorerColSparse : ''} ${props.disabled ? styles.disabled : ''} ${styles[props.status]}`}
              onClick={() => handleClick(Component, data)}
            >
              <div className={styles.square}>
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
