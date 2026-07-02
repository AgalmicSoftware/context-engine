import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ReactReduxContext } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';
import { Modal, ModalBody } from 'reactstrap';

import styles from './TagPage.module.scss';
import TagPage from './TagPage';
import { normalizeGlobalSessionSelection } from '../../utilities/session/globalSessionState.js';
import { parseQuestionSessionSlugFromSearch } from '../../utilities/survey/questionRouting.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import {
  getDemoSessionConfigBySlug,
  getSessionConfigBySlug as getStrictSessionConfigBySlug,
} from '../../domains/sessions/sessionConfig.js';

type SessionScopeState = {
  filterMode: 'all' | 'set';
  scopeSlugs: string[];
};

type ScopeSummaryOptions = {
  filterMode?: 'all' | 'set';
  scopeSlugs?: unknown[];
  routePinned?: boolean;
  localOverrideTouched?: boolean;
};

type TagModalProps = {
  isOpen: boolean;
  toggle: () => void;
  activeTag?: string | null;
  demoCorpusMode?: boolean;
  demoCorpusRecords?: any[];
};

const TagPageComponent = TagPage as React.ComponentType<any>;

const dedupeSessionSlugs = (values: unknown[] | unknown = []): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  (Array.isArray(values) ? values : [values]).forEach((value) => {
    const normalized = normalizeSessionSlug(value);
    if (normalized == null || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
};

const buildSessionScopeLabel = (slugIn = ''): string => {
  const slug = normalizeSessionSlug(slugIn);
  if (!slug) return 'General';
  const cfg = (
    getStrictSessionConfigBySlug(slug) ||
    getDemoSessionConfigBySlug(slug, { allowDemoFallback: true }) ||
    {}
  );
  const sessionName = String(cfg?.sessionName || '').trim();
  return sessionName && sessionName.toLowerCase() !== slug.toLowerCase()
    ? `${sessionName} (${slug})`
    : (sessionName || slug);
};

const buildGlobalTagPageScope = (selection: Record<string, any> = {}): SessionScopeState => {
  const scopeMode = String(selection?.selectedSessionScope || '').trim().toLowerCase() || 'active';
  if (scopeMode === 'all') {
    return { filterMode: 'all', scopeSlugs: [] };
  }
  if (scopeMode === 'list') {
    return {
      filterMode: 'set',
      scopeSlugs: dedupeSessionSlugs(selection?.selectedSessionSlugs || []),
    };
  }
  if (scopeMode === 'general') {
    return { filterMode: 'set', scopeSlugs: [''] };
  }
  return {
    filterMode: 'set',
    scopeSlugs: [normalizeSessionSlug(selection?.primarySessionSlug || '') || ''],
  };
};

const describeScopeSummary = ({
  filterMode = 'all',
  scopeSlugs = [],
  routePinned = false,
  localOverrideTouched = false,
}: ScopeSummaryOptions = {}) => {
  const normalizedScopeSlugs = dedupeSessionSlugs(scopeSlugs);
  let labelCore = 'all sessions';
  let title = 'Showing questions from all sessions.';

  if (filterMode === 'set') {
    if (!normalizedScopeSlugs.length) {
      labelCore = 'no sessions selected';
      title = 'The current session scope does not include any sessions.';
    } else if (normalizedScopeSlugs.length === 1) {
      labelCore = buildSessionScopeLabel(normalizedScopeSlugs[0]);
      title = `Showing questions from ${labelCore}.`;
    } else if (normalizedScopeSlugs.length <= 2) {
      const labels = normalizedScopeSlugs.map((slug) => buildSessionScopeLabel(slug));
      labelCore = labels.join(' + ');
      title = `Showing questions from ${labels.join(', ')}.`;
    } else {
      const labels = normalizedScopeSlugs.map((slug) => buildSessionScopeLabel(slug));
      labelCore = `${normalizedScopeSlugs.length} selected sessions`;
      title = `Showing questions from ${labels.join(', ')}.`;
    }
  }

  if (routePinned) {
    return {
      label: `Session scope: ${labelCore} (URL pin)`,
      title,
    };
  }
  if (localOverrideTouched) {
    return {
      label: `Session scope: ${labelCore} (override)`,
      title,
    };
  }
  return {
    label: `Session scope: ${labelCore}`,
    title,
  };
};

const buildEmptyQuestionsText = (selectedTags: string[] = []) => {
  if (selectedTags.length === 1) {
    return `No questions tagged ${selectedTags[0]} in this session yet.`;
  }

  return 'No questions found for this tag comparison yet.';
};

const TagModal = ({
  isOpen,
  toggle,
  activeTag,
  demoCorpusMode = false,
  demoCorpusRecords = [],
}: TagModalProps) => {
  const location = useLocation();
  const reduxContext = useContext(ReactReduxContext);
  const sessionState = reduxContext?.store?.getState?.()?.sessionState;
  const normalizedActiveTag = String(activeTag || '').trim();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [demoInfoOpen, setDemoInfoOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelectedTags(normalizedActiveTag ? [normalizedActiveTag] : []);
  }, [normalizedActiveTag]);

  const emptyQuestionsText = useMemo(
    () => buildEmptyQuestionsText(selectedTags),
    [selectedTags]
  );
  const selectedTagsKey = useMemo(
    () => selectedTags.join('||'),
    [selectedTags]
  );
  const globalSessionSelection = useMemo(
    () => normalizeGlobalSessionSelection(sessionState || {}),
    [sessionState]
  );
  const demoScopeSummary = useMemo(() => {
    if (!demoCorpusMode) return null;

    const queryPinnedScopeSlug = parseQuestionSessionSlugFromSearch(location.search);
    const routePinned = queryPinnedScopeSlug !== null;
    const globalScopeState = buildGlobalTagPageScope(globalSessionSelection);
    const effectiveScopeState: SessionScopeState = routePinned
      ? {
        filterMode: 'set',
        scopeSlugs: [normalizeSessionSlug(queryPinnedScopeSlug) || ''],
      }
      : globalScopeState;

    return describeScopeSummary({
      filterMode: effectiveScopeState.filterMode,
      scopeSlugs: effectiveScopeState.scopeSlugs,
      routePinned,
      localOverrideTouched: false,
    });
  }, [demoCorpusMode, globalSessionSelection, location.search]);

  const resetAllScrollContainers = useCallback(() => {
    const modalNode = modalRef.current;
    const scrollContainer = scrollContainerRef.current;

    const resetScroll = (node: Element | null) => {
      if (!node) return;
      const scrollNode = node as HTMLElement;
      scrollNode.scrollTop = 0;
      scrollNode.scrollLeft = 0;
    };

    resetScroll(modalNode);
    resetScroll(scrollContainer);

    if (modalNode && typeof modalNode.querySelectorAll === 'function') {
      modalNode.querySelectorAll('.modal-dialog, .modal-content, .modal-body').forEach(resetScroll);
    }
  }, []);

  const handleSelectedTagsChange = (nextTags: unknown[] = []) => {
    const normalizedNextTags = (Array.isArray(nextTags) ? nextTags : [])
      .map((tag) => String(tag || '').trim())
      .filter(Boolean);

    if (!normalizedNextTags.length) {
      toggle();
      return;
    }

    setSelectedTags(normalizedNextTags);
  };

  useEffect(() => {
    setDemoInfoOpen(false);
  }, [isOpen, selectedTagsKey]);

  useEffect(() => {
    if (!isOpen) return;

    resetAllScrollContainers();

    const frameId = (
      typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame(resetAllScrollContainers)
        : null
    );

    return () => {
      if (frameId !== null && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [isOpen, resetAllScrollContainers, selectedTagsKey]);

  return (
    <Modal
      isOpen={isOpen}
      toggle={toggle}
      onOpened={resetAllScrollContainers}
      innerRef={modalRef}
      modalClassName={styles.tagModal}
      contentClassName={styles.tagModalContent}
      backdropClassName={styles.tagModalBackdrop}
      wrapClassName={styles.tagModalWrap}
    >
      <div
        data-testid="tag-modal-top-bar"
        className={styles.tagModalHeaderBar}
      >
        <span>Tag explorer</span>
        <div className={styles.tagModalHeaderActions}>
          {demoCorpusMode ? (
            <div className={styles.tagModalChromeControl}>
              <button
                type="button"
                className={styles.tagModalChromeButton}
                aria-label="Tag explorer info"
                aria-expanded={demoInfoOpen}
                data-testid="tag-modal-demo-info-toggle"
                onClick={() => setDemoInfoOpen((prev) => !prev)}
              >
                <FontAwesomeIcon icon={faCog} />
              </button>
              {demoInfoOpen && demoScopeSummary ? (
                <div
                  className={styles.tagModalChromePopover}
                  data-testid="tag-modal-demo-info-panel"
                >
                  <div className={styles.sessionSelectorHint}>
                    Demo corpus mode uses the demo corpus records currently loaded in this view instead of session-scoped questions.
                  </div>
                  <div className={styles.sessionSelectorInfoCard}>
                    <div className={styles.sessionSelectorInfoLabel}>Hidden session scope</div>
                    <div className={styles.sessionSelectorInfoValue}>{demoScopeSummary.label}</div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            className={[styles.tagModalChromeButton, styles.tagModalCloseButton].join(' ')}
            onClick={toggle}
            aria-label="Close tag explorer"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>
      <ModalBody className={styles.tagModalBody}>
        <div
          key={selectedTagsKey || 'empty'}
          ref={scrollContainerRef}
          className={styles.tagModalScrollArea}
          data-testid="tag-modal-scroll-area"
        >
          {isOpen && selectedTags.length ? (
            <TagPageComponent
              embedded={true}
              demoCorpusMode={demoCorpusMode}
              demoCorpusRecords={demoCorpusRecords}
              selectedTagsOverride={selectedTags}
              onSelectedTagsChange={handleSelectedTagsChange}
              emptyQuestionsText={emptyQuestionsText}
              hideEmbeddedSessionSelector={demoCorpusMode}
            />
          ) : null}
        </div>
      </ModalBody>
    </Modal>
  );
};

export default TagModal;
