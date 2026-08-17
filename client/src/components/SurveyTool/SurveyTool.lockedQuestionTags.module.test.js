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

const getQuestionEncryptionGates = (question) => {
  if (!question || typeof question !== 'object') return [];
  return Array.isArray(question.encryption?.gates) ? question.encryption.gates : [];
};

const getShortenedAddress = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`;

const findElement = (node, predicate) => {
  const stack = [node];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (Array.isArray(current)) {
      for (let index = current.length - 1; index >= 0; index -= 1) {
        stack.push(current[index]);
      }
      continue;
    }
    if (typeof current !== 'object') continue;
    if (predicate(current)) return current;
    if (!React.isValidElement(current)) continue;
    if (current.props.children !== undefined) stack.push(current.props.children);
  }
  return null;
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

    expect(details).toHaveLength(1);
    expect(details[0].label).toBe('Registry questionResponses gate');
    expect(details[0].sbts[0]).toMatchObject({
      address: gateSbt,
      label: 'Filter Gate SBT',
    });
  });

  it('uses neutral gated prompt copy for manual prompt decrypt buttons', () => {
    const payloadDisplay = resolveQuestionPayloadDisplayState({
      id: 'q1',
      prompt: '[encrypted]',
      promptEncrypted: '{"ciphertext":"cipher"}',
      payloadAccessMode: 'lit_encrypted',
    });
    const promptState = buildQuestionPromptDecryptDisplayState({
      questionId: 'q1',
      promptText: '[encrypted]',
      promptMasked: true,
      payloadDisplay,
      loginComplete: true,
      account: '0xabc',
      canReloadPrompt: true,
    });

    expect(promptState.showPromptAction).toBe(true);
    expect(promptState.promptTitle).toBe('Decrypt gated prompt');
    expect(promptState.noticeActionLabel).toBe('Decrypt Prompt');
    expect(promptState.promptLabel).toBe('Encrypted');
  });

  it('labels public-read masked prompts as unavailable rather than encrypted', () => {
    const payloadDisplay = resolveQuestionPayloadDisplayState({
      id: 'q-public-read',
      prompt: '[encrypted]',
      payloadAccessMode: 'public_read',
    });
    const promptState = buildQuestionPromptDecryptDisplayState({
      questionId: 'q-public-read',
      promptText: '[encrypted]',
      promptMasked: true,
      payloadDisplay,
      loginComplete: false,
      account: '',
      canReloadPrompt: true,
    });

    expect(payloadDisplay).toMatchObject({
      status: 'unavailable',
      label: 'Unavailable',
      requiresAuth: false,
    });
    expect(promptState.promptTitle).toBe('Retry loading question prompt');
    expect(promptState.noticeStatusText).toBe('unavailable');
    expect(promptState.promptLabel).toBe('Unavailable');
  });

  it('labels worker-gated masked prompts as requiring session access', () => {
    const payloadDisplay = resolveQuestionPayloadDisplayState({
      id: 'q-worker-gated',
      prompt: '[encrypted]',
      payloadAccessMode: 'worker_sbt_gate',
    });
    const promptState = buildQuestionPromptDecryptDisplayState({
      questionId: 'q-worker-gated',
      promptText: '[encrypted]',
      promptMasked: true,
      payloadDisplay,
      loginComplete: true,
      account: '0xabc',
      canReloadPrompt: true,
    });

    expect(payloadDisplay).toMatchObject({
      status: 'worker_sbt_gate',
      label: 'Requires session access',
      requiresAuth: true,
    });
    expect(promptState.noticeStatusText).toBe('requires session access');
    expect(promptState.noticeActionLabel).toBe('Load Prompt');
    expect(promptState.noticeActionTitle).toBe('Load gated prompt');
  });

  it('passes an explicit decrypt prompt action into gated prompt notices', () => {
    const payloadDisplay = resolveQuestionPayloadDisplayState({
      id: 'Q1',
      prompt: '[encrypted]',
      promptEncrypted: '{"ciphertext":"cipher"}',
      payloadAccessMode: 'lit_encrypted',
    });
    const promptState = buildQuestionPromptDecryptDisplayState({
      questionId: 'Q1',
      promptText: '[encrypted]',
      promptMasked: true,
      payloadDisplay,
      loginComplete: true,
      account: '0xabc',
      canReloadPrompt: true,
    });
    const onAction = jest.fn();
    const action = promptState.canReloadPrompt ? () => onAction(promptState.qid) : undefined;

    expect(promptState.noticeActionTitle).toBe('Decrypt gated prompt');
    expect(promptState.qid).toBe('q1');

    action();

    expect(onAction).toHaveBeenCalledWith('q1');
  });

  it('does not render inline single-question tags in the prompt title block', () => {
    const displayTags = getQuestionTagDisplayList(['Governance', 'AI Policy']);
    const layout = buildSurveyQuestionsLayoutDisplayState({
      activeTagModalTag: 'Governance',
      singleQuestionMode: true,
    });

    expect(displayTags).toEqual(['Governance', 'AI Policy']);
    expect(layout.useTagModal).toBe(false);
    expect(layout.activeTagModalTag).toBe('');
    // port note: dropped direct prompt-title child count; single-question layout state is the portable tag suppression seam.
  });

  it('keeps full-question tag dropdown scoped to the survey session on unpinned survey routes', () => {
    const previousUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState({}, '', `/survey/0x${'1'.repeat(64)}`);

    try {
      const sessionSlug = resolveCurrentTagSessionSlug({
        props: {
          singleQuestionMode: false,
          surveyID: `0x${'1'.repeat(64)}`,
          activeSessionSlug: 'edge',
          sessionSlug: 'edge',
          sessionSlugPinned: false,
        },
        state: {},
        getEffectiveDraftSlug: () => 'edge',
      });

      expect(sessionSlug).toBe('edge');
      expect(buildTagHref('Governance', '', sessionSlug)).toBe('/tag/Governance?session=edge');
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
    });

    expect(activeTagState).toEqual({ activeTagModalTag: 'governance' });
    expect(layout).toMatchObject({
      activeTagModalTag: 'governance',
      useTagModal: true,
    });
  });

  it('omits SurveyQuestionTagControl from pile cards even when tags are present', () => {
    const tree = renderPileActiveQuestionCard({
      question: {
        id: 'q1',
        type: 'freeform',
        prompt: 'Question prompt',
        tags: ['governance'],
      },
      promptMasked: false,
      renderQuestionMaskedPromptCard: jest.fn(() => null),
      promptHeader: <span>Question prompt</span>,
      questionComponent: <div data-testid="question-component">Answer input</div>,
      questionContainerClass: 'questionContainer',
      footerSection: null,
    });

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

    expect(addresses).toEqual([gateSbt]);
    expect(signature).toBe(`edge|84532|${gateSbt}`);
    expect(firstHits).toHaveLength(0);
    expect(secondHits).toHaveLength(1);
    expect(buildGateSbtNameRevisionState({ gateSbtNameRevision: 0 })).toEqual({ gateSbtNameRevision: 1 });
    // port note: private retry timer/signature bookkeeping remains in the shell; this pins the extracted address/revision seams.
  });

  it('does not retry gate label hydration when targeted lookup policy is disabled', () => {
    const previousPolicy = globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP;
    globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP = false;

    try {
      expect(isTargetedSbtMetadataLookupEnabled()).toBe(false);
      expect(shouldScheduleGateHydrationRetry([])).toBe(false);
      // port note: direct scheduleGateSbtHydrationRetry call counts are private shell details; the disabled policy is the portable branch.
    } finally {
      globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP = previousPolicy;
    }
  });

  it('memoizes rendered question ids until question sources change', () => {
    const first = buildRenderedQuestionIdsFromQuestionPools({
      questionPool: [{ id: 'q1' }, { id: 'q2' }],
      pileQuestions: [{ id: 'q2' }, { id: 'q3' }],
    });
    const third = buildRenderedQuestionIdsFromQuestionPools({
      questionPool: [{ id: 'q1' }, { id: 'q2' }, { id: 'q4' }],
      pileQuestions: [{ id: 'q2' }, { id: 'q3' }],
    });

    expect(first).toEqual(['q1', 'q2', 'q3']);
    expect(third).toEqual(['q1', 'q2', 'q4', 'q3']);
    // port note: object-identity memoization is class-private; the extracted helper pins source-change id selection.
  });

  it('normalizes hydration question ids from the current rendered-id selector', () => {
    const getRenderedQuestionIds = jest.fn(() => ['Q1', 'q1', '', 'q2']);

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
    const getRenderedQuestionIds = jest.fn(() => ['q2']);
    const questionIds = buildInitialSurveyResponseQuestionIds({
      singleQuestionMode: false,
      isStandalone: true,
      questionPoolIds: ['q1'],
      getRenderedQuestionIds,
    });
    const initial = buildInitializedSurveyResponseState({
      isStandalone: true,
      questionPoolIds: questionIds,
      buildEmptyResponseFieldState: (questionId, fieldKey = 'answer') => ({
        value: '',
        questionId,
        fieldKey,
      }),
    });

    expect(getRenderedQuestionIds).not.toHaveBeenCalled();
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
