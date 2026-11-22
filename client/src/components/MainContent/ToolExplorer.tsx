/** @file ToolExplorer.tsx */

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { connect } from 'react-redux';
import { updateGlobalSessionSelection } from '../../actions/sessionStateActions.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faExpand, faEye, faPlus, faQuestionCircle, faSearch, faUsers } from '@fortawesome/free-solid-svg-icons';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { hasCachedCreateSbtForm } from '../../utilities/sbt/sbtCreateFormCache.js';
import { sbtsListPath } from '../../utilities/ui/terminology.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { readStoredGlobalSessionSelection } from '../../utilities/session/globalSessionState.js';
import { toStr } from '../../utilities/shared/primitives.js';

import { Container, Row, Col } from 'reactstrap';

import ToolExplorerPluginExplainer from './ToolExplorerPluginExplainer';
import ToolExplorerSessionControl, { resolveToolSessionConfig } from './ToolExplorerSessionControl';
import LazyFallback from '../Shared/LazyFallback';

import modelDirectoryImage from '../../assets/img/model_directory.jpg';
import worldVoteImage from '../../assets/img/world_vote.jpg';
import magnifyingGlassImage from '../../assets/img/magnifying_glass.png';
import artHeader from '../../assets/img/art_header.png';
import styles from './ToolExplorer.module.scss';

// Tools/plugins are lazy-loaded so chunks are fetched only on click.
const SurveyTool = React.lazy(() => import('../SurveyTool/SurveyTool'));
const SBTsPage = React.lazy(() => import('../SBTs/SBTsPage'));
const AudioSurveyGenerator = React.lazy(() => import('../SurveyTool/SurveyGenerator/SurveyGenerator'));

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
};

type ExpandedComponentState = {
  component: ToolComponent;
  data: ToolData;
  props?: Record<string, unknown>;
} | null;

type ToolExplorerProps = {
  activeSessionSlug?: unknown;
  sessionLoadingView?: React.ReactNode;
  updateGlobalSessionSelection?: (selection: { primarySessionSlug: string; selectedSessionSlugs?: string[] }) => void;
  [key: string]: unknown;
};

export const ToolExplorer = (props: ToolExplorerProps) => {
  const [expandedComponent, setExpandedComponent] = useState<ExpandedComponentState>(null);
  const [createGroupSessionSlug, setCreateGroupSessionSlug] = useState<string | null>(null);
  const [dataToolMode, setDataToolMode] = useState('add');
  const [questionsToolbarTarget, setQuestionsToolbarTarget] = useState<HTMLDivElement | null>(null);
  const [groupsActionsTarget, setGroupsActionsTarget] = useState<HTMLDivElement | null>(null);
  const [dataSessionOverrideSlug, setDataSessionOverrideSlug] = useState<string | null>(null);
  const [dataSessionOverrideTouched, setDataSessionOverrideTouched] = useState(false);
  const activeSessionSlug = normalizeSessionSlug(props.activeSessionSlug || '');
  const activeSessionConfig = resolveToolSessionConfig(activeSessionSlug, props.sessionConfig);
  const showEmbeddedCreateGroup = createGroupSessionSlug === activeSessionSlug;

  const exampleData: ToolData[] = [
    {
      name: 'Questions',
      subtext: 'Create and explore questions.',
      icon: faQuestionCircle,
      explainText:
        'Survey and question platform with detailed responses, advanced question formats, preference weighing, and group filtering. Responses can be encrypted for privacy (opt-in). Audio input goes to the session’s AI provider for transcription. Storage depends on the session: Cloudflare by default, or public and permanent on Arweave.',
      image: worldVoteImage,
      headerImage: artHeader,
      content: SurveyTool,
      disabled: false,
    },
    {
      name: 'Groups',
      subtext: 'Organize and manage groups.',
      icon: faUsers,
      explainText:
        'Groups organize people by membership, roles, and permissions. Worker-hosted sessions use Worker Groups; chain-backed sessions can use Soulbound tokens (non-transferable NFTs). Groups can create private spaces for collective action and decision-making.',
      image: modelDirectoryImage,
      content: SBTsPage,
      disabled: false,
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
    },
    data: data,
  }));
  const useSparseGrid = !expandedComponent && exampleComponents.length <= 3;

  const expandedToolName = expandedComponent?.data?.name || '';
  const showGroupsHeaderActions = expandedToolName === 'Groups';
  const showQuestionsHeaderActions = expandedToolName === 'Questions';
  const useCompactExpandedHeader = showGroupsHeaderActions || showQuestionsHeaderActions;
  const showDataHeaderActions = expandedToolName === 'Context';
  const selectedDataSessionSlug = useMemo(
    () =>
      dataSessionOverrideTouched
        ? normalizeSessionSlug(dataSessionOverrideSlug || '')
        : normalizeSessionSlug(props.activeSessionSlug || ''),
    [dataSessionOverrideSlug, dataSessionOverrideTouched, props.activeSessionSlug],
  );
  const readInitialGroupsCreateState = () =>
    hasCachedCreateSbtForm({
      sessionSlug: toStr(props.activeSessionSlug),
      migrateLegacyToSessionKey: true,
      clearInvalid: true,
    });

  const handleClick = (Component: ToolComponent, data: ToolData) => {
    if (!data.disabled) {
      setDataToolMode('add');
      if (data.name === 'Groups') {
        setCreateGroupSessionSlug(readInitialGroupsCreateState() ? activeSessionSlug : null);
      } else {
        setCreateGroupSessionSlug(null);
      }
      setExpandedComponent(() => ({
        component: Component,
        data: data,
      }));
    }
  };

  const resetExpandedComponent = () => {
    setCreateGroupSessionSlug(null);
    setDataToolMode('add');
    setDataSessionOverrideSlug(null);
    setDataSessionOverrideTouched(false);
    setExpandedComponent(null);
  };

  const toggleEmbeddedCreateGroup = () => {
    setCreateGroupSessionSlug((previousSlug) => (previousSlug === activeSessionSlug ? null : activeSessionSlug));
  };

  const handleDataSessionSelect = (slugIn: string) => {
    const nextSlug = normalizeSessionSlug(slugIn);
    const useInheritedSession = nextSlug === activeSessionSlug;
    setDataSessionOverrideSlug(useInheritedSession ? null : nextSlug);
    setDataSessionOverrideTouched(!useInheritedSession);
  };

  const resetDataSessionSelection = () => {
    setDataSessionOverrideSlug(null);
    setDataSessionOverrideTouched(false);
  };

  const handleActiveSessionChange = (slugIn: string) => {
    const nextSlug = normalizeSessionSlug(slugIn);
    if (nextSlug === activeSessionSlug) return;
    const selection = readStoredGlobalSessionSelection();
    props.updateGlobalSessionSelection?.({
      primarySessionSlug: nextSlug,
      // A list that excludes General would coerce its blank primary back to
      // the first named session. Retain that list and include General explicitly.
      ...(nextSlug === '' && selection.selectedSessionScope === 'list' && !selection.selectedSessionSlugs.includes('')
        ? { selectedSessionSlugs: [...selection.selectedSessionSlugs, ''] }
        : {}),
    });
  };

  useEffect(() => {
    setCreateGroupSessionSlug(null);
  }, [activeSessionSlug]);

  const expandedChildProps = expandedComponent
    ? {
        ...expandedComponent.data,
        account: props.account,
        provider: props.provider,
        litHooks: props.litHooks,
        activeSessionSlug: props.activeSessionSlug,
        sessionConfig: activeSessionConfig,
        ensureLightSbtUniverse: props.ensureLightSbtUniverse,
        loginComplete: props.loginComplete,
        toggleLoginModal: props.toggleLoginModal,
        network: props.network,
        networkChainId: props.networkChainId,
        isSBTCacheReady: props.isSBTCacheReady,
        isSurveyCacheReady: props.isSurveyCacheReady,
        isQuestionCacheReady: props.isQuestionCacheReady,
        cacheInitializationError: props.cacheInitializationError,
        isResponsesCacheReady: props.isResponsesCacheReady,
        questionResponsesNonce: props.questionResponsesNonce,
        questionScanProgress: props.questionScanProgress,
        ...(expandedToolName === 'Questions'
          ? {
              preventUrlChange: true,
              hideEmbeddedDebugUi: true,
              toolbarTarget: questionsToolbarTarget,
            }
          : {}),
        ...(showGroupsHeaderActions
          ? {
              sessionSlug: props.activeSessionSlug,
              embeddedWorkerGroups: true,
              refreshControlTarget: groupsActionsTarget,
              hideMiniActionRow: true,
              showCreateGroupAboveFeatured: true,
              showCreateGroupExternal: showEmbeddedCreateGroup,
              onCreateGroupToggleExternal: toggleEmbeddedCreateGroup,
            }
          : {}),
        ...(showDataHeaderActions
          ? {
              explorerMode: dataToolMode,
              sessionOverrideSlug: dataSessionOverrideSlug,
              sessionOverrideTouched: dataSessionOverrideTouched,
              hideInternalSessionSelector: true,
            }
          : {}),
      }
    : null;

  const expandedHeaderHelp = expandedComponent && (
    <div className={styles.expandedHeaderMeta}>
      <ToolExplorerPluginExplainer
        explainText={expandedComponent.data.explainText}
        label={`About ${expandedToolName}`}
        {...(expandedComponent.props || {})}
      />
    </div>
  );

  const expandedHeaderLead = (
    <div className={styles.expandedHeaderLead}>
      <button
        type="button"
        className={`${styles.headerActionButton} ${styles.headerActionButtonPrimary}`}
        onClick={resetExpandedComponent}
      >
        ← Back
      </button>
      {expandedHeaderHelp}
    </div>
  );

  const expandedHeaderSession = (
    <div className={styles.expandedHeaderSession}>
      <ToolExplorerSessionControl
        activeSessionSlug={showDataHeaderActions ? selectedDataSessionSlug : activeSessionSlug}
        sessionConfig={
          showDataHeaderActions
            ? resolveToolSessionConfig(selectedDataSessionSlug, props.sessionConfig)
            : activeSessionConfig
        }
        inheritedSessionSlug={showDataHeaderActions ? activeSessionSlug : undefined}
        onUseInheritedSession={showDataHeaderActions ? resetDataSessionSelection : undefined}
        onChange={showDataHeaderActions ? handleDataSessionSelect : handleActiveSessionChange}
      />
    </div>
  );

  return (
    <>
      <Container className={`${styles.explorerContainer} ${useSparseGrid ? styles.explorerContainerSparse : ''}`}>
        {expandedComponent ? (
          <div className={styles.breadcrumbContainer}>
            <div
              className={`${styles.expandedHeaderRow} ${useCompactExpandedHeader ? styles.expandedHeaderCompact : ''} ${showQuestionsHeaderActions ? styles.expandedHeaderQuestions : ''} ${showGroupsHeaderActions ? styles.expandedHeaderGroups : ''} ${showDataHeaderActions ? styles.expandedHeaderContext : ''}`}
            >
              <div className={styles.expandedHeaderPrimaryControls}>
                {expandedHeaderLead}
                {expandedHeaderSession}
              </div>

              {!showQuestionsHeaderActions && (
                <div
                  className={styles.expandedHeaderActions}
                  ref={showGroupsHeaderActions ? setGroupsActionsTarget : undefined}
                >
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
                </div>
              )}
            </div>

            {showQuestionsHeaderActions && (
              <div
                className={`${styles.expandedHeaderActions} ${styles.expandedQuestionsToolbar}`}
                ref={setQuestionsToolbarTarget}
              />
            )}

            <Suspense fallback={<LazyFallback label="Loading..." minHeight="30vh" />}>
              {/* Questions and Groups read the session's own settings, so both wait for them: until the Worker has
                  answered, a listed session has only a placeholder that Groups cannot open. */}
              {((showQuestionsHeaderActions || showGroupsHeaderActions) && props.sessionLoadingView) ||
                React.createElement(expandedComponent.component, {
                  ...expandedChildProps,
                  ...(showGroupsHeaderActions ? { key: activeSessionSlug } : {}),
                })}
            </Suspense>
          </div>
        ) : (
          <Row className={`${styles.explorerRow} ${useSparseGrid ? styles.explorerRowSparse : ''}`}>
            {exampleComponents.map(({ Component, props, data }, index) => (
              <Col
                key={index}
                xs="12"
                sm="6"
                md="4"
                className={`${styles.explorerCol} ${useSparseGrid ? styles.explorerColSparse : ''} ${props.disabled ? styles.disabled : ''}`}
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

export default connect(null, { updateGlobalSessionSelection })(ToolExplorer);
