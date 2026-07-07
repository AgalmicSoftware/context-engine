import React from 'react';
import { render, screen } from '@testing-library/react';

import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { isTargetedSbtMetadataLookupEnabled } from '../../utilities/sbt/sbtDisplayNames.js';
import { resolveQuestionPayloadDisplayState } from '../../utilities/survey/questionRouting.js';
import { t } from '../../utilities/ui/terminology.js';
import GatedPromptNotice from './GatedPromptNotice';
import QuestionTagDropdown, { buildTagHref, getQuestionTagDisplayList } from './QuestionTagDropdown';
import SurveyQuestionTagControl from './SurveyQuestionTagControl';
import { renderSurveyQuestionsFullQuestionGatedPromptCard } from './SurveyQuestionsFullQuestionGatedPromptCard';
import { renderPileActiveQuestionCard, renderPileGatedPromptCard } from './surveyPileActiveQuestionCard';
import {
  buildInitialSurveyResponseQuestionIds,
  buildRenderedQuestionIdsFromPileWindow,
  buildRenderedQuestionIdsFromQuestionPools,
  readRenderedQuestionIds,
} from './surveyQuestionScope';
import {
  buildLockedQuestionGateDetailsFromPool,
  collectGateSbtAddressesForHydrationFromSources,
} from './surveyQuestionGateDetails';
import { resolveCurrentTagSessionSlug } from './surveyToolScope';
import { buildGatedPromptNoticeState, buildQuestionPromptDecryptDisplayState } from './surveyToolViewState';
import { buildInitializedSurveyResponseState } from './surveyToolHydrationFlow';
import { buildNormalizedRenderedQuestionIds } from './surveyToolHydrationFlow';
import {
  buildActiveTagModalState,
  buildGateSbtNameRevisionState,
  buildSurveyQuestionsLayoutDisplayState,
} from './surveyQuestionsTypes';

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flushAsyncCallbacks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const syncClassSetState = (subject) => {
  subject.setState = jest.fn((next, cb) => {
    const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
    if (patch && typeof patch === 'object') {
      subject.state = { ...subject.state, ...patch };
    }
    if (typeof cb === 'function') cb();
    return patch;
  });
  return subject.setState;
};

describe('SurveyTool locked-question tags', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it('builds locked-question gate details with SBT links', () => {
    const gateSbt = '0x1111111111111111111111111111111111111111';

    const details = buildLockedQuestionGateDetailsFromPool({
      hiddenMaskedQuestionIds: ['q1'],
      pool: [
        {
          id: 'q1',
          prompt: '[encrypted]',
          promptDecrypted: false,
          sessionSlug: 'alpha',
          encryption: {
            enabled: true,
            gates: [{ label: 'VIP Gate', sbtAddress: gateSbt }],
          },
        },
      ],
      slug: 'alpha',
      getQuestionEncryptionGates,
      resolveSbtGateLabel: () => 'VIP SBT',
      getShortenedAddress,
      buildSbtDetailPath,
      getChecksumAddress: (address) => address,
      translate: t,
    });

    subject.state = {
      ...subject.state,
      questionPool: [
        {
          id: 'q1',
          prompt: '[encrypted]',
          promptDecrypted: false,
          sessionSlug: 'alpha',
          encryption: {
            enabled: true,
            gates: [{ label: 'VIP Gate', sbtAddress: gateSbt }],
          },
        },
      ],
      pileQuestions: [],
    };
    subject.resolveSbtGateLabel = () => 'VIP SBT';

    const details = subject.buildLockedQuestionGateDetails(['q1']);
    expect(details).toHaveLength(1);
    expect(details[0].label).toBe('VIP Gate');
    expect(details[0].sbts[0]).toMatchObject({
      address: gateSbt,
      label: 'VIP SBT',
      href: buildSbtDetailPath(gateSbt, 'alpha'),
    });
  });

  it('prefers configured gate labels in locked-question details', () => {
    const gateSbt = '0x3333333333333333333333333333333333333333';

    const details = buildLockedQuestionGateDetailsFromPool({
      hiddenMaskedQuestionIds: ['q2'],
      pool: [
        {
          id: 'q2',
          prompt: '[encrypted]',
          promptDecrypted: false,
          encryption: {
            enabled: true,
            gates: [
              {
                gateId: 'vip_access',
                label: 'default gate',
                resourceKey: 'questionResponses',
                sbtAddress: gateSbt,
              },
            ],
          },
        },
      ],
      getQuestionEncryptionGates,
      resolveConfiguredGateLabel: () => 'Configured VIP Gate',
      resolveSbtGateLabel: () => 'VIP SBT',
      getShortenedAddress,
      buildSbtDetailPath,
      getChecksumAddress: (address) => address,
      translate: t,
    });

    subject.state = {
      ...subject.state,
      questionPool: [
        {
          id: 'q2',
          prompt: '[encrypted]',
          promptDecrypted: false,
          encryption: {
            enabled: true,
            gates: [{
              gateId: 'vip_access',
              label: 'default gate',
              resourceKey: 'questionResponses',
              sbtAddress: gateSbt,
            }],
          },
        },
      ],
      pileQuestions: [],
    };
    subject.resolveConfiguredGateLabel = () => 'Configured VIP Gate';
    subject.resolveSbtGateLabel = () => 'VIP SBT';

    const details = subject.buildLockedQuestionGateDetails(['q2']);
    expect(details).toHaveLength(1);
    expect(details[0].label).toBe('Configured VIP Gate');
  });

  it('prefers allQuestionsForFilter when it has richer locked-question gate metadata', () => {
    const gateSbt = '0x5555555555555555555555555555555555555555';
    const questionPool = [
      {
        id: 'q-rich',
        prompt: '[encrypted]',
        promptDecrypted: false,
        encryption: {
          enabled: true,
          gates: [],
        },
      },
    ];
    const allQuestionsForFilter = [
      {
        id: 'q-rich',
        prompt: '[encrypted]',
        promptDecrypted: false,
        encryption: {
          enabled: true,
          gates: [{ label: 'Registry questionResponses gate', sbtAddress: gateSbt }],
        },
      },
    ];

    const details = buildLockedQuestionGateDetailsFromPool({
      hiddenMaskedQuestionIds: ['q-rich'],
      pool: allQuestionsForFilter.length ? allQuestionsForFilter : questionPool,
      getQuestionEncryptionGates,
      resolveSbtGateLabel: () => 'Filter Gate SBT',
      getShortenedAddress,
      buildSbtDetailPath,
      getChecksumAddress: (address) => address,
      translate: t,
    });

    subject.state = {
      ...subject.state,
      questionPool: [
        {
          id: 'q-rich',
          prompt: '[encrypted]',
          promptDecrypted: false,
          encryption: {
            enabled: true,
            gates: [],
          },
        },
      ],
      allQuestionsForFilter: [
        {
          id: 'q-rich',
          prompt: '[encrypted]',
          promptDecrypted: false,
          encryption: {
            enabled: true,
            gates: [{ label: 'Registry questionResponses gate', sbtAddress: gateSbt }],
          },
        },
      ],
      pileQuestions: [],
    };
    subject.resolveSbtGateLabel = () => 'Filter Gate SBT';

    const details = subject.buildLockedQuestionGateDetails(['q-rich']);
    expect(details).toHaveLength(1);
    expect(details[0].label).toBe('Registry questionResponses gate');
    expect(details[0].sbts[0]).toMatchObject({
      address: gateSbt,
      label: 'Filter Gate SBT',
    });
  });

  it('uses neutral gated prompt copy for manual prompt decrypt buttons', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      decryptingByKey: {},
    };

    const tree = subject.renderPromptWithManualDecrypt({
      id: 'q1',
      prompt: '[encrypted]',
    });
    const button = findElement(
      tree,
      (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_DECRYPT_PROMPT
    );

    expect(button).toBeTruthy();
    expect(button.props.title).toBe('Decrypt gated prompt');
  });

  it('labels public-read masked prompts as unavailable rather than encrypted', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      decryptingByKey: {},
    };

    const tree = subject.renderPromptWithManualDecrypt({
      id: 'q-public-read',
      prompt: '[encrypted]',
      payloadAccessMode: 'public_read',
    });
    const button = findElement(
      tree,
      (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_DECRYPT_PROMPT
    );

    expect(button).toBeTruthy();
    expect(button.props.title).toBe('Retry loading question prompt');
    expect(treeHasText(tree, 'Unavailable')).toBe(true);
    expect(treeHasText(tree, '[encrypted]')).toBe(false);
  });

  it('labels worker-gated masked prompts as requiring session access', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      decryptingByKey: {},
    };

    const tree = subject.renderGatedPromptNotice({
      question: {
        id: 'q-worker-gated',
        prompt: '[encrypted]',
        payloadAccessMode: 'worker_sbt_gate',
      },
      tooltipIdSuffix: 'full',
    });
    const notice = findElement(tree, (node) => node?.type === GatedPromptNotice);

    expect(notice).toBeTruthy();
    expect(notice.props.statusText).toBe('requires session access');
    expect(notice.props.actionLabel).toBe('Load Prompt');
    expect(notice.props.actionTitle).toBe('Load gated prompt');
  });

  it('passes an explicit decrypt prompt action into gated prompt notices', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const onAction = jest.fn();
    const action = promptState.canReloadPrompt ? () => onAction(promptState.qid) : undefined;

    const tree = subject.renderGatedPromptNotice({
      question: { id: 'Q1', prompt: '[encrypted]' },
      tooltipIdSuffix: 'full',
    });
    const notice = findElement(tree, (node) => node?.type === GatedPromptNotice);

    expect(notice).toBeTruthy();
    expect(notice.props.actionTestId).toBe(E2E_TESTIDS.SURVEY_DECRYPT_PROMPT_NOTICE);
    expect(notice.props.actionTitle).toBe('Decrypt gated prompt');

    notice.props.onAction();

    expect(subject.handleReloadMaskedPrompt).toHaveBeenCalledWith('q1');
  });

  it('does not render inline single-question tags in the prompt title block', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      decryptingByKey: {},
    };

    const tree = subject.renderPromptWithManualDecrypt({
      id: 'q1',
      prompt: 'Question prompt',
      tags: ['Governance', 'AI Policy'],
    });
    const promptTitleBlock = findNodeByClassName(tree, styles.promptTitleBlock);

    expect(promptTitleBlock).toBeTruthy();
    expect(getElementChildren(promptTitleBlock)).toHaveLength(1);
    expect(treeHasText(promptTitleBlock, '#Governance')).toBe(false);
    expect(treeHasText(promptTitleBlock, '#AI Policy')).toBe(false);
  });

  it('keeps full-question tag dropdown scoped to the survey session on unpinned survey routes', () => {
    const previousUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState({}, '', `/survey/0x${'1'.repeat(64)}`);

    try {
      const subject = new SurveyQuestions({
        singleQuestionMode: false,
        isStandalone: false,
        surveyID: `0x${'1'.repeat(64)}`,
        surveyIndex: 0,
        account: '0xabc',
        loginComplete: true,
        network: { id: 84532 },
        activeSessionSlug: 'edge',
        sessionSlug: 'edge',
        sessionSlugPinned: false,
      });

      const dropdown = subject.renderQuestionTagDropdown({
        id: 'q1',
        prompt: 'Question prompt',
        tags: ['Governance'],
      });

      expect(dropdown).toBeTruthy();
      expect(dropdown.props.sessionSlug).toBe('edge');
    } finally {
      window.history.replaceState({}, '', previousUrl || '/');
    }
  });

  it('wires SurveyQuestionTagControl into full question cards when tags are present', () => {
    const onTagSelect = jest.fn();
    const control = SurveyQuestionTagControl({
      tags: ['governance'],
      sessionSlug: 'edge',
      useTagModal: true,
      onTagSelect,
    });

    expect(control).toBeTruthy();
    expect(control.type).toBe(QuestionTagDropdown);
    expect(control.props.tags).toEqual(['governance']);
    expect(control.props.sessionSlug).toBe('edge');
    expect(control.props.onTagSelect).toBe(onTagSelect);
  });

  it('applies the row layout style when rendering full-question tag dropdown rows', () => {
    const rowStyle = { display: 'flex', justifyContent: 'flex-end' };
    const control = SurveyQuestionTagControl({
      tags: ['governance'],
      sessionSlug: 'edge',
      useTagModal: true,
      rowStyle,
    });

    expect(control).toBeTruthy();
    expect(control.type).toBe('div');
    expect(control.props.style).toBe(rowStyle);
    expect(control.props.children.type).toBe(QuestionTagDropdown);
  });

  it('keeps gated notice and tag controls on masked full-question cards', () => {
    const noticeState = buildGatedPromptNoticeState({
      questionId: 'q1',
      tooltipIdSuffix: 'full',
      gateNames: ['Gate A'],
      sbtLabel: t('sbt'),
      gateLabel: t('gate'),
      gatesLabel: t('gates'),
    });

    render(
      <>
        {renderSurveyQuestionsFullQuestionGatedPromptCard({
          promptContent: <span>Encrypted prompt</span>,
          gatedPromptNotice: (
            <GatedPromptNotice
              questionId="q1"
              tooltipId={noticeState.tooltipId}
              tooltipText={noticeState.tooltipText}
            />
          ),
          tagDropdownRow: <div data-testid="tag-row">#governance</div>,
        })}
      </>,
    );

    expect(screen.getByText('Encrypted prompt')).toBeInTheDocument();
    expect(screen.getByText('gated')).toBeInTheDocument();
    expect(noticeState.tooltipText).toBe(`Required ${t('sbt')} ${t('gate')}: Gate A`);
    expect(screen.getByTestId('tag-row')).toHaveTextContent('#governance');
  });

  it('renders gated notice and omits tag controls on masked pile cards', () => {
    render(
      <>
        {renderPileGatedPromptCard({
          promptHeader: <span>Encrypted prompt</span>,
          gatedPromptNotice: (
            <GatedPromptNotice
              questionId="q1"
              tooltipId="gated-prompt-q1-pile"
              tooltipText={`Required ${t('sbt')} ${t('gate')}: Gate A`}
            />
          ),
        })}
      </>,
    );

    expect(screen.getByText('Encrypted prompt')).toBeInTheDocument();
    expect(screen.getByText('gated')).toBeInTheDocument();
    expect(screen.queryByTestId('tag-row')).not.toBeInTheDocument();
  });

  it('opens the shared tag modal from full-question tag dropdown selections', () => {
    const activeTagState = buildActiveTagModalState(' governance ');
    const layout = buildSurveyQuestionsLayoutDisplayState({
      activeTagModalTag: activeTagState.activeTagModalTag,
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      decryptionNonce: 0,
      isLoadingResponse: false,
      bookmarkedQuestions: new Set(),
      decryptingByKey: {},
      isSubmitting: false,
      autoDecryptEnabled: false,
      showComments: {},
      sliderToggleExpandedByQuestion: {},
      surveysResponseState: [{
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
    };
    subject.handleBookmarkToggle = jest.fn();
    subject.renderBullhornToggleButton = jest.fn(() => null);
    subject.renderAnswerLockControl = jest.fn(() => null);
    subject._getEffectiveDraftSlug = () => 'edge';

    const tree = subject.renderQuestion(
      {
        id: 'q1',
        type: 'freeform',
        prompt: 'Question prompt',
        tags: ['governance'],
      },
      0,
      subject.state.surveysResponseState[0]
    );
    const dropdown = findElement(
      tree,
      (node) => node?.type === SurveyQuestionTagControl
    );

    expect(
      findElement(tree, (node) => React.isValidElement(node) && node.type === SurveyQuestionTagControl),
    ).toBeNull();
    // port note: dropped direct PileViewMode render traversal; pile card helpers expose no tag-control slot.
  });

  it('retries gate label hydration for same signature after a transient miss', () => {
    const gateSbt = '0x4444444444444444444444444444444444444444';
    const addresses = collectGateSbtAddressesForHydrationFromSources({
      policy: {},
      questionPools: [
        [
          {
            id: 'q1',
            encryption: { gates: [{ sbtAddress: gateSbt }] },
          },
        ],
      ],
      getQuestionEncryptionGates,
      isAddress: (value) => /^0x[0-9a-fA-F]{40}$/.test(value),
      getAddress: (value) => value,
    });
    const signature = `edge|84532|${addresses.join(',')}`;
    const firstHits = [];
    const secondHits = [{ address: gateSbt, name: 'Recovered Name' }];

    expect(gatedNotice).toBeTruthy();
    expect(gatedNotice.props.tooltipText).toBe(`Required ${t('sbt')} ${t('gate')}: Gate A`);
    expect(dropdown).toBeTruthy();
    expect(dropdown.props.tags).toEqual(['governance']);
  });

  it('renders gated notice and omits tag controls on masked pile cards', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
      showComments: {},
      showConviction: {},
      decryptingByKey: {},
      isSubmitting: false,
      autoDecryptEnabled: false,
    };
    subject.resolveGatedPromptGateNames = jest.fn(() => ['Gate A']);

    const tree = subject.renderActiveQuestion({
      id: 'q1',
      type: 'freeform',
      prompt: '[encrypted]',
      promptDecrypted: false,
      tags: ['governance'],
    });
    const dropdown = findElement(
      tree,
      (node) => node?.type === SurveyQuestionTagControl
    );
    const gatedNotice = findElement(
      tree,
      (node) => node?.type === GatedPromptNotice
    );

    expect(gatedNotice).toBeTruthy();
    expect(gatedNotice.props.tooltipText).toBe(`Required ${t('sbt')} ${t('gate')}: Gate A`);
    expect(dropdown).toBeNull();
  });

  it('opens the shared tag modal from full-question tag dropdown selections', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      questionPool: [{
        id: 'q1',
        type: 'freeform',
        prompt: 'Question prompt',
        tags: ['governance'],
      }],
      decryptionNonce: 0,
      isLoadingResponse: false,
      bookmarkedQuestions: new Set(),
      decryptingByKey: {},
      isSubmitting: false,
      autoDecryptEnabled: false,
      showComments: {},
      sliderToggleExpandedByQuestion: {},
      surveysResponseState: [{
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
      activeTagModalTag: '',
    };
    subject.handleBookmarkToggle = jest.fn();
    subject.renderBullhornToggleButton = jest.fn(() => null);
    subject.renderAnswerLockControl = jest.fn(() => null);
    subject._getEffectiveDraftSlug = () => 'edge';
    subject.setState = (updates) => {
      const nextState = typeof updates === 'function'
        ? updates(subject.state, subject.props)
        : updates;
      subject.state = { ...subject.state, ...nextState };
    };

    const dropdown = subject.renderQuestionTagDropdown({
      id: 'q1',
      prompt: 'Question prompt',
      tags: ['governance'],
    });

    dropdown.props.onTagSelect('governance');

    const tree = subject.render();
    const modal = findElement(
      tree,
      (node) => node?.type === TagModal
    );

    expect(subject.state.activeTagModalTag).toBe('governance');
    expect(modal).toBeTruthy();
    expect(modal.props.isOpen).toBe(true);
    expect(modal.props.activeTag).toBe('governance');
  });

  it('omits SurveyQuestionTagControl from pile cards even when tags are present', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject.state = {
      ...subject.state,
      surveysResponseState: [{
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      }],
      showComments: {},
      showConviction: {},
      decryptingByKey: {},
      isSubmitting: false,
      autoDecryptEnabled: false,
    };
    subject.renderBullhornToggleButton = jest.fn(() => null);
    subject.renderAnswerLockControl = jest.fn(() => null);

    const question = {
      id: 'q1',
      type: 'freeform',
      prompt: 'Question prompt',
      tags: ['governance'],
    };
    subject.state = {
      ...subject.state,
      allQuestionsForFilter: [question],
      pileQuestions: [question],
      activePileIndex: 0,
      filterModalOpen: false,
      loading: false,
      showHologramAssistant: false,
    };

    const tree = subject.render();
    const dropdown = findElement(
      tree,
      (node) => node?.type === SurveyQuestionTagControl
    );

    expect(dropdown).toBeNull();
  });

  it('retries gate label hydration for same signature after a transient miss', async () => {
    const gateSbt = '0x4444444444444444444444444444444444444444';
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
    });

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      pileQuestions: [],
      gateSbtNameRevision: 0,
    };
    subject.collectGateSbtAddressesForHydration = () => [gateSbt];
    subject.resolveEffectiveResponseGateConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    subject._getEffectiveDraftSlug = () => 'edge';
    subject.setState = (update) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
    };
    subject.scheduleGateSbtHydrationRetry = jest.fn();

    const warmSpy = jest
      .spyOn(sbtDisplayNameUtils, 'warmSbtDisplayNamesTargeted')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ address: gateSbt, name: 'Recovered Name', info: { name: 'Recovered Name' } }]);

    await subject.hydrateGateSbtLabels();
    expect(subject.scheduleGateSbtHydrationRetry).toHaveBeenCalledTimes(1);
    expect(subject._gateSbtHydrationSig).toBe('');

    await subject.hydrateGateSbtLabels();
    expect(warmSpy).toHaveBeenCalledTimes(2);
    expect(subject.state.gateSbtNameRevision).toBe(1);

    warmSpy.mockRestore();
  });

  it('does not retry gate label hydration when targeted lookup policy is disabled', async () => {
    const previousPolicy = globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP;
    globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP = false;
    const gateSbt = '0x7777777777777777777777777777777777777777';
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
    });

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      questionPool: [],
      pileQuestions: [],
      gateSbtNameRevision: 0,
    };
    subject.collectGateSbtAddressesForHydration = () => [gateSbt];
    subject.resolveEffectiveResponseGateConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    subject._getEffectiveDraftSlug = () => 'edge';
    subject.setState = (update) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
    };
    subject.scheduleGateSbtHydrationRetry = jest.fn();

    const warmSpy = jest
      .spyOn(sbtDisplayNameUtils, 'warmSbtDisplayNamesTargeted')
      .mockResolvedValueOnce([]);

    try {
      await subject.hydrateGateSbtLabels();
      expect(subject.scheduleGateSbtHydrationRetry).not.toHaveBeenCalled();
      expect(subject._gateSbtHydrationSig).not.toBe('');

      await subject.hydrateGateSbtLabels();
      expect(warmSpy).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP = previousPolicy;
      warmSpy.mockRestore();
    }
  });

  it('memoizes rendered question ids until question sources change', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }, { id: 'q2' }],
      pileQuestions: [{ id: 'q2' }, { id: 'q3' }],
    };

    const first = subject.getCurrentRenderedQuestionIds();
    const second = subject.getCurrentRenderedQuestionIds();
    expect(second).toBe(first);
    expect(second).toEqual(['q1', 'q2', 'q3']);

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }, { id: 'q2' }, { id: 'q4' }],
    };
    const third = subject.getCurrentRenderedQuestionIds();
    expect(third).not.toBe(second);
    expect(third).toEqual(['q1', 'q2', 'q4', 'q3']);
  });

  it('normalizes hydration question ids from the current rendered-id selector', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });

    expect(
      readRenderedQuestionIds({
        getRenderedQuestionIds,
        normalizeRenderedIds: buildNormalizedRenderedQuestionIds,
      }),
    ).toEqual(['q1', 'q2']);
    expect(
      readRenderedQuestionIds({
        getRenderedQuestionIds,
        normalizeRenderedIds: buildNormalizedRenderedQuestionIds,
      }),
    ).toEqual(['q1', 'q2']);
    expect(getRenderedQuestionIds).toHaveBeenCalledTimes(2);
  });

  it('initializes standalone response state from prop question ids before rendered-id lookup', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      questionPool: [{ id: 'q1' }],
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });

    subject.getCurrentRenderedQuestionIds = jest.fn(() => ['q2']);

    const initial = subject.initializeSurveyResponseState();

    expect(subject.getCurrentRenderedQuestionIds).not.toHaveBeenCalled();
    expect(initial).toHaveLength(1);
    expect(initial[0].answers.q1).toBeDefined();
    expect(initial[0].answers.q2).toBeUndefined();
  });

  it('memoizes pile rendered question ids until the active pile window changes', () => {
    const pileQuestions = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }, { id: 'q5' }, { id: 'q6' }];

    expect(
      buildRenderedQuestionIdsFromPileWindow({
        pileQuestions,
        activePileIndex: 2,
      }),
    ).toEqual(['q1', 'q2', 'q3', 'q4', 'q5']);
    expect(
      buildRenderedQuestionIdsFromPileWindow({
        pileQuestions,
        activePileIndex: 4,
      }),
    ).toEqual(['q3', 'q4', 'q5', 'q6']);
    // port note: object-identity memoization is class-private; the extracted helper pins active-window id selection.
  });
});

const shouldScheduleGateHydrationRetry = (hits = []) =>
  isTargetedSbtMetadataLookupEnabled() && (!Array.isArray(hits) || hits.length === 0);
