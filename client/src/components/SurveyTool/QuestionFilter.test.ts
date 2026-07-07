import {
  QuestionFilter as QuestionFilterComponent,
} from './QuestionFilter';
import {
  QUESTION_FILTER_ACTIONS_STYLE,
  QUESTION_FILTER_BOOKMARK_FEEDBACK_STYLE,
  QUESTION_FILTER_DISABLED_TEXT_SPACING_STYLE,
  QUESTION_FILTER_ENCRYPTED_COUNT_LOCK_STYLE,
  QUESTION_FILTER_MODAL_HEADER_ROW_STYLE,
  QUESTION_FILTER_MODAL_TITLE_ROW_STYLE,
  QUESTION_FILTER_SBT_SPINNER_STYLE,
  buildQuestionFilterAiCombineRowClassName,
  buildQuestionFilterDisabledSectionClassName,
  buildQuestionFilterSectionIconClassName,
  buildQuestionFilterTagBubbleClassName,
  buildQuestionFilterTypeButtonClassName,
  buildQuestionFilterTypePillClassName,
  resolveQuestionFilterBookmarkIconStyle,
  resolveQuestionFilterClearIconStyle,
  resolveQuestionFilterCopyIconStyle,
  resolveQuestionFilterEncryptedCountBadgeStyle,
  resolveQuestionFilterInlineVisibilityStyle,
  resolveQuestionFilterSectionBodyStyle,
  resolveQuestionFilterSectionHeaderStyle,
} from './questionFilterDisplayHelpers';
import GateTooltip from '../Gates/GateTooltip';
import * as cacheScriptsModule from '../../utilities/cache/cacheScripts.js';
import { serializeFilterState as serializeFilterStateStrict } from '../../utilities/survey/filterStateUtils.js';
import { isFreeformBlankAnswer } from '../../utilities/survey/freeformAnswerUtils.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import styles from './QuestionFilter.module.scss';

jest.mock('../SBTs/SBTFilter', () => () => null);
jest.mock('../Shared/AudioInput/AudioInput', () => () => null);

type TreeNode = any;
type TreePredicate = (node: TreeNode) => boolean;
type QuestionFilterProps = Record<string, any>;
const QuestionFilter: any = QuestionFilterComponent;
const cacheScripts: any = cacheScriptsModule;
const {
  initCacheManager,
  listNamespaceEntriesSync,
  readCache,
  removeCache,
  writeCache,
} = cacheScripts as any;
const serializeFilterState: any = serializeFilterStateStrict;

const MANAGED_NAMESPACES = [
  'questionsCache',
  'surveysCache',
  'bookmarksCache',
  'filters',
  'sbtCache',
  'userCache',
];

const clearManagedCaches = async () => {
  await initCacheManager();
  for (const namespace of MANAGED_NAMESPACES) {
    const entries = listNamespaceEntriesSync(namespace);
    await Promise.all(entries.map((entry: any) => removeCache(namespace, entry?.slug || '')));
    await removeCache(namespace, '');
  }
};

const findElement = (node: TreeNode, predicate: TreePredicate): TreeNode | null => {
  const stack: TreeNode[] = [node];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (Array.isArray(current)) {
      for (let i = current.length - 1; i >= 0; i -= 1) {
        stack.push(current[i]);
      }
      continue;
    }
    if (typeof current !== 'object') continue;
    if (predicate(current)) return current;
    const children = current?.props?.children;
    if (children !== undefined) stack.push(children);
  }
  return null;
};

const getNodeText = (node: TreeNode): string => {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join('');
  if (typeof node !== 'object') return '';
  return getNodeText(node?.props?.children);
};

describe('isFreeformBlankAnswer', () => {
  it('returns true for freeform answers with blank text', () => {
    expect(
      isFreeformBlankAnswer('freeform', {
        answer: { value: '   ' },
      })
    ).toBe(true);
  });

  it('returns false for missing or unknown question type', () => {
    const parsedResponse = { answer: { value: '   ' } };
    expect(isFreeformBlankAnswer(undefined, parsedResponse)).toBe(false);
    expect(isFreeformBlankAnswer(null, parsedResponse)).toBe(false);
    expect(isFreeformBlankAnswer('', parsedResponse)).toBe(false);
    expect(isFreeformBlankAnswer('binary', parsedResponse)).toBe(false);
  });

  it('returns false for non-blank freeform answers', () => {
    expect(
      isFreeformBlankAnswer('freeform', {
        answer: { value: 'response' },
      })
    ).toBe(false);
  });

  it('returns false for malformed response payloads', () => {
    expect(isFreeformBlankAnswer('freeform', null)).toBe(false);
    expect(isFreeformBlankAnswer('freeform', 'response')).toBe(false);
    expect(isFreeformBlankAnswer('freeform', { answer: '   ' })).toBe(false);
    expect(isFreeformBlankAnswer('freeform', { answer: { value: 0 } })).toBe(false);
  });
});

describe('QuestionFilter display helpers', () => {
  it('builds section and action icon display state', () => {
    expect(QUESTION_FILTER_ACTIONS_STYLE).toEqual({
      marginLeft: 'auto',
      paddingLeft: '15px',
      display: 'flex',
      alignItems: 'center',
    });
    expect(QUESTION_FILTER_BOOKMARK_FEEDBACK_STYLE).toEqual({
      color: 'goldenrod',
      fontSize: '0.85em',
      fontStyle: 'italic',
    });
    expect(QUESTION_FILTER_ENCRYPTED_COUNT_LOCK_STYLE).toEqual({
      marginRight: '3px',
      fontSize: '0.85em',
    });
    expect(QUESTION_FILTER_SBT_SPINNER_STYLE).toEqual({ marginLeft: '8px' });
    expect(QUESTION_FILTER_DISABLED_TEXT_SPACING_STYLE).toEqual({ marginBottom: '10px' });
    expect(QUESTION_FILTER_MODAL_HEADER_ROW_STYLE).toEqual({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
    });
    expect(QUESTION_FILTER_MODAL_TITLE_ROW_STYLE).toEqual({
      display: 'flex',
      alignItems: 'center',
    });
    expect(resolveQuestionFilterSectionHeaderStyle({
      clickable: true,
      disabled: false,
    })).toEqual({ cursor: 'pointer', opacity: 1 });
    expect(resolveQuestionFilterSectionHeaderStyle({
      clickable: false,
      disabled: true,
    })).toEqual({ cursor: 'not-allowed', opacity: 0.5 });
    expect(buildQuestionFilterSectionIconClassName(styles, true)).toBe(
      `${styles.icon} ${styles.expanded}`
    );
    expect(buildQuestionFilterSectionIconClassName(styles, false)).toBe(`${styles.icon} `);
    expect(resolveQuestionFilterSectionBodyStyle(true, false)).toEqual({ display: 'block' });
    expect(resolveQuestionFilterSectionBodyStyle(true, true)).toEqual({ display: 'none' });
    expect(resolveQuestionFilterClearIconStyle(true)).toEqual({
      cursor: 'not-allowed',
      marginRight: '12px',
    });
    expect(resolveQuestionFilterClearIconStyle(false)).toEqual({
      cursor: 'pointer',
      marginRight: '12px',
    });
    expect(resolveQuestionFilterCopyIconStyle(false, true)).toEqual({
      cursor: 'not-allowed',
      color: 'green',
      fontSize: '1.1em',
      marginRight: '15px',
    });
    expect(resolveQuestionFilterCopyIconStyle(true, false)).toEqual({
      cursor: 'not-allowed',
      color: '#cccccc',
      fontSize: '1.1em',
      marginRight: '15px',
    });
    expect(resolveQuestionFilterBookmarkIconStyle(false, true, false)).toEqual({
      cursor: 'pointer',
      color: 'gold',
      fontSize: '1.1em',
      marginRight: '8px',
    });
    expect(resolveQuestionFilterBookmarkIconStyle(true, false, false)).toEqual({
      cursor: 'not-allowed',
      color: '#cccccc',
      fontSize: '1.1em',
      marginRight: '8px',
    });
    expect(resolveQuestionFilterEncryptedCountBadgeStyle('12px')).toEqual({
      marginLeft: '12px',
      opacity: 0.7,
    });
    expect(buildQuestionFilterTagBubbleClassName(styles, true)).toBe(
      `${styles.tagBubble} ${styles.tagBubbleSelected}`
    );
    expect(buildQuestionFilterTagBubbleClassName(styles, false)).toBe(styles.tagBubble);
    expect(buildQuestionFilterTypeButtonClassName(styles, true)).toBe(
      `${styles.typeButton} ${styles.typeButtonActive}`
    );
    expect(buildQuestionFilterTypeButtonClassName(styles, false)).toBe(styles.typeButton);
    expect(buildQuestionFilterTypePillClassName(styles, 'agree')).toBe(
      `${styles.typePill} ${styles.typePillAgree}`
    );
    expect(buildQuestionFilterTypePillClassName(styles)).toBe(styles.typePill);
    expect(buildQuestionFilterAiCombineRowClassName(styles)).toBe(
      `${styles.filterOption} ${styles.aiCombineRow}`
    );
    expect(buildQuestionFilterDisabledSectionClassName(styles, true)).toBe(styles.disabledSection);
    expect(buildQuestionFilterDisabledSectionClassName(styles, false)).toBe('');
    expect(resolveQuestionFilterInlineVisibilityStyle(true)).toEqual({ display: 'block' });
    expect(resolveQuestionFilterInlineVisibilityStyle(false)).toEqual({ display: 'none' });
  });
});

describe('QuestionFilter.getMemoizedQuestionResponseStats', () => {
  it('excludes only blank freeform responses from responseCount', () => {
    const instance = new QuestionFilter({});
    const relevantResponses = {
      Q1: {
        '0x1': JSON.stringify({ answer: { value: '   ' }, conviction: 2 }),
        '0x2': JSON.stringify({ answer: { value: 'Visible answer' }, conviction: 3 }),
        '0x3': JSON.stringify({ answer: { value: '*', encrypted: true }, conviction: 1 }),
      },
    };
    const mergedQuestions = [{ id: 'q1', type: 'freeform' }];

    const stats = instance.getMemoizedQuestionResponseStats(
      relevantResponses,
      mergedQuestions,
      1,
      1
    );
    const q1Stats = stats.get('q1');

    expect(q1Stats).toEqual({
      responseCount: 2,
      totalImportance: 6,
    });
  });

  it('counts blank answers for non-freeform question types', () => {
    const instance = new QuestionFilter({});
    const relevantResponses = {
      q2: {
        '0x1': JSON.stringify({ answer: { value: '   ' }, conviction: 4 }),
        '0x2': JSON.stringify({ answer: { value: 'Agree' }, conviction: 1 }),
      },
    };
    const mergedQuestions = [{ id: 'q2', type: 'binary' }];

    const stats = instance.getMemoizedQuestionResponseStats(
      relevantResponses,
      mergedQuestions,
      2,
      2
    );
    const q2Stats = stats.get('q2');

    expect(q2Stats).toEqual({
      responseCount: 2,
      totalImportance: 5,
    });
  });
});

describe('QuestionFilter session resolution', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds AI request options without inheriting missing explicit session aliases', () => {
    const configSpy = jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug')
      .mockImplementation((slug) => {
        if (slug === 'rxc') return { slug: 'rxc', networkChainId: 84532 };
        return null;
      });

    const instance = new QuestionFilter({
      sessionSlug: 'DEBATE',
      network: { id: 84532 },
    });

    expect(instance.buildAiRequestOptions()).toEqual({
      sessionSlug: 'DEBATE',
      sessionConfig: {},
      context: {
        account: '',
        providerLike: undefined,
        chainId: 84532,
      },
    });
    expect(configSpy).toHaveBeenCalledWith('DEBATE');
  });

  it('does not inherit the general session config for unknown non-general slugs', () => {
    const configSpy = jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug')
      .mockImplementation((slug) => {
        if (slug === '') return { slug: '', networkChainId: 84532 };
        return null;
      });

    const instance = new QuestionFilter({
      sessionSlug: 'missing-session-slug',
    });

    expect(instance.getEffectiveSessionConfig()).toEqual({});
    expect(instance.buildAiRequestOptions()).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: {},
      context: {
        chainId: null,
      },
    });
    expect(configSpy).toHaveBeenCalledWith('missing-session-slug');
    expect(configSpy).not.toHaveBeenCalledWith('');
  });

  it('passes resolved session warm-start props into the SBT filter section', () => {
    const sessionConfig = { slug: 'edge', networkChainId: 84532 };
    const ensureLightSbtUniverse = jest.fn();
    const instance = new QuestionFilter({
      activeSessionSlug: 'edge',
      sessionSlug: 'alpha',
      sessionConfig,
      ensureLightSbtUniverse,
      questions: [],
      questionResponses: {},
      network: { id: 84532 },
      filterModalOpen: true,
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      isSBTCacheReady: true,
    });

    instance.buildFilterPipelineResult = jest.fn(() => ({
      finalQuestions: [],
      count: 0,
    }));
    instance.getAllTagsWithCounts = jest.fn(() => []);
    instance.getAiAccessState = jest.fn(() => ({
      enabled: false,
      localKeyAvailable: false,
    }));

    const tree = instance.render();
    const sbtFilterNode = findElement(
      tree,
      (element) => element?.props?.mode === 'creator' && element?.props?.autoExpand === true
    );

    expect(sbtFilterNode).toBeTruthy();
    expect(sbtFilterNode?.props.sessionSlug).toBe('edge');
    expect(sbtFilterNode?.props.activeSessionSlug).toBe('edge');
    expect(sbtFilterNode?.props.sessionConfig).toBe(sessionConfig);
    expect(sbtFilterNode?.props.ensureLightSbtUniverse).toBe(ensureLightSbtUniverse);
  });
});

describe('QuestionFilter encrypted count gate tooltip integration', () => {
  it('hides response-status controls and summary chips when no account is connected', () => {
    const instance = new QuestionFilter({
      questions: [{ id: 'q1', prompt: 'Q1', type: 'freeform' }],
      questionResponses: {},
      network: { id: 84532 },
      resultsMode: true,
      filterModalOpen: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
      account: undefined,
    });

    instance.state = {
      ...instance.state,
      filterByResponded: true,
      filteredQuestionsCount: 1,
    };
    instance.handleApplyFilters = jest.fn();
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    instance.buildFilterPipelineResult = jest.fn(() => ({
      finalQuestions: [{ id: 'q1', prompt: 'Q1', type: 'freeform' }],
      count: 1,
    }));
    instance.getAllTagsWithCounts = jest.fn(() => []);
    instance.getAiAccessState = jest.fn(() => ({
      enabled: false,
      localKeyAvailable: false,
    }));

    const summaryItems = instance.getFilterSummaryItems();
    const respondedItem = summaryItems.find((item: any) => item.label === 'Responded');
    const tree = instance.render();
    const responseStatusHeader = findElement(
      tree,
      (element) => element?.type === 'h3' && getNodeText(element).includes('Response Status')
    );

    expect(respondedItem).toBeUndefined();
    expect(responseStatusHeader).toBeNull();
  });

  it('shows response-status controls when an account is connected', () => {
    const instance = new QuestionFilter({
      questions: [{ id: 'q1', prompt: 'Q1', type: 'freeform' }],
      questionResponses: {},
      network: { id: 84532 },
      resultsMode: true,
      filterModalOpen: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
      account: '0xabc',
    });

    instance.state = {
      ...instance.state,
      filterByResponded: true,
      filteredQuestionsCount: 1,
    };
    instance.handleApplyFilters = jest.fn();
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    instance.buildFilterPipelineResult = jest.fn(() => ({
      finalQuestions: [{ id: 'q1', prompt: 'Q1', type: 'freeform' }],
      count: 1,
    }));
    instance.getAllTagsWithCounts = jest.fn(() => []);
    instance.getAiAccessState = jest.fn(() => ({
      enabled: false,
      localKeyAvailable: false,
    }));

    const summaryItems = instance.getFilterSummaryItems();
    const respondedItem = summaryItems.find((item: any) => item.label === 'Responded');
    const tree = instance.render();
    const responseStatusHeader = findElement(
      tree,
      (element) => element?.type === 'h3' && getNodeText(element).includes('Response Status')
    );

    expect(respondedItem).toBeTruthy();
    expect(responseStatusHeader).not.toBeNull();
  });

  it('hides response-status summary chips while AI override owns the results', () => {
    const instance = new QuestionFilter({
      questions: [{ id: 'q1', prompt: 'Q1', type: 'freeform' }],
      questionResponses: {},
      network: { id: 84532 },
      resultsMode: true,
      filterModalOpen: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
      account: '0xabc',
    });

    instance.state = {
      ...instance.state,
      aiAppliedTopN: 5,
      aiCombineWithOtherFilters: false,
      aiFilterApplied: true,
      aiSearchQuery: 'priority topics',
      filterByResponded: true,
      filteredQuestionsCount: 1,
    };

    let summaryItems = instance.getFilterSummaryItems();
    expect(summaryItems.find((item: any) => item.type === 'ai')).toBeTruthy();
    expect(summaryItems.find((item: any) => item.label === 'Responded')).toBeUndefined();

    instance.state = {
      ...instance.state,
      aiCombineWithOtherFilters: true,
    };

    summaryItems = instance.getFilterSummaryItems();
    expect(summaryItems.find((item: any) => item.label === 'Responded')).toBeTruthy();
  });

  it('shows visible group-loading status while SBT cache is still hydrating', () => {
    const instance = new QuestionFilter({
      questions: [{ id: 'q1', prompt: 'Q1', type: 'freeform' }],
      questionResponses: {},
      network: { id: 84532 },
      resultsMode: true,
      filterModalOpen: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: false,
    });

    instance.state = {
      ...instance.state,
      filteredQuestionsCount: 1,
    };
    instance.buildFilterPipelineResult = jest.fn(() => ({
      finalQuestions: [{ id: 'q1', prompt: 'Q1', type: 'freeform' }],
      count: 1,
    }));
    instance.getFilterSummaryItems = jest.fn(() => []);
    instance.getAllTagsWithCounts = jest.fn(() => []);
    instance.getAiAccessState = jest.fn(() => ({
      enabled: false,
      localKeyAvailable: false,
    }));

    const tree = instance.render();
    const sbtHeader = findElement(
      tree,
      (element) => element?.type === 'h3' && getNodeText(element).includes('Group(s) of Question Creator')
    );

    expect(sbtHeader).toBeTruthy();
    expect(getNodeText(sbtHeader)).toContain('Loading groups');
  });

  it('passes session gate details into the encrypted-count badge tooltip when available', () => {
    const gateSbt = '0x1111111111111111111111111111111111111111';
    const instance = new QuestionFilter({
      questions: [{ id: 'q1', prompt: '[encrypted]', type: 'freeform' }],
      questionResponses: {},
      network: { id: 84532 },
      resultsMode: true,
      filterModalOpen: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
    });

    instance.state = {
      ...instance.state,
      filteredQuestionsCount: 1,
    };
    instance.buildFilterPipelineResult = jest.fn(() => ({
      finalQuestions: [{ id: 'q1', prompt: '[encrypted]', type: 'freeform' }],
    }));
    instance.getFilterSummaryItems = jest.fn(() => []);
    instance.getAllTagsWithCounts = jest.fn(() => []);
    instance.getAiAccessState = jest.fn(() => ({
      enabled: false,
      localKeyAvailable: false,
    }));
    instance.getEffectiveSessionConfig = jest.fn(() => ({
      encryption: {
        defaultGateId: 'vip_access',
        gates: {
          vip_access: {
            gateId: 'vip_access',
            label: 'VIP Gate',
            mode: 'all',
            sbtAddresses: [gateSbt],
          },
        },
      },
    }));

    const tree = instance.render();
    const tooltip = findElement(
      tree,
      (element) => element?.type === GateTooltip && element?.props?.gateId === 'vip_access'
    );

    expect(tooltip).toBeTruthy();
    expect(tooltip.props.gateConfig).toMatchObject({
      label: 'VIP Gate',
      mode: 'all',
    });
    expect(tooltip.props.sbtAddresses).toEqual([gateSbt]);
  });

  it('renders compact AI apply copy with elapsed seconds', () => {
    const instance = new QuestionFilter({
      questions: [{ id: 'q1', prompt: 'Q1', type: 'freeform' }],
      questionResponses: {},
      network: { id: 84532 },
      resultsMode: true,
      filterModalOpen: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
    });

    instance.state = {
      ...instance.state,
      aiDraftQuery: 'a question of each type',
      aiRankingCount: 4,
      aiApplying: true,
      aiApplyingElapsedSec: 9,
      expandedSections: {
        ...instance.state.expandedSections,
        ai: true,
      },
      filteredQuestionsCount: 1,
    };
    instance.buildFilterPipelineResult = jest.fn(() => ({
      finalQuestions: [{ id: 'q1', prompt: 'Q1', type: 'freeform' }],
      count: 1,
    }));
    instance.getFilterSummaryItems = jest.fn(() => []);
    instance.getAllTagsWithCounts = jest.fn(() => []);
    instance.getAiAccessState = jest.fn(() => ({
      enabled: true,
      localKeyAvailable: false,
    }));

    const tree = instance.render();
    const aiApplyButton = findElement(
      tree,
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.QUESTION_FILTER_AI_APPLY
    );

    expect(aiApplyButton).toBeTruthy();
    expect(getNodeText(aiApplyButton)).toContain('Applying... 9s');
  });
});
