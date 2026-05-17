import { SurveyQuestions } from './SurveyQuestions';
import SurveyQuestionsLockAudienceControl from './SurveyQuestionsLockAudienceControl';
import styles from './SurveyTool.module.scss';
import { renderToStaticMarkup } from 'react-dom/server';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';

const treeHasDataTestId = (node, testId) => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasDataTestId(child, testId));
  if (typeof node !== 'object') return false;
  if (node?.props?.['data-testid'] === testId) return true;
  return treeHasDataTestId(node?.props?.children, testId);
};

const treeHasText = (node, text) => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasText(child, text));
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (typeof node !== 'object') return false;
  return treeHasText(node?.props?.children, text);
};

const findElement = (node, predicate) => {
  const stack = [node];
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

const nodeHasClassName = (node, className) => {
  const value = node?.props?.className;
  if (typeof value !== 'string') return false;
  return value.split(/\s+/).includes(className);
};

const findNodeByClassName = (node, className) => (
  findElement(node, (candidate) => nodeHasClassName(candidate, className))
);

const renderLockAudienceControl = (lockControl) => {
  expect(lockControl.type).toBe(SurveyQuestionsLockAudienceControl);
  return SurveyQuestionsLockAudienceControl(lockControl.props);
};

describe('SurveyQuestions lock audience details', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('keeps lock audience SBT detail links on terminology-aware routes instead of nested /u/ links', () => {
    const address = '0x1111111111111111111111111111111111111111';
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const menuKey = subject.getLockAudienceMenuStateKey('q1', 'answer');
    subject.state = {
      ...subject.state,
      lockAudienceMenuByQuestion: { [menuKey]: true },
      lockAudienceGateDetailsByQuestion: { [menuKey]: 'vip_gate' },
    };
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => ({
      gateDetails: [{
        gateId: 'vip_gate',
        label: 'VIP gate',
        sbtItems: subject.buildGateAudienceSbtItems([address], 'edge'),
      }],
    }));
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject.resolveFieldEncryptionGateId = jest.fn(() => '');
    subject.resolveSbtGateLabel = jest.fn(() => '');

    const lockControl = subject.renderAnswerLockControl({
      surveyIndex: 0,
      questionId: 'q1',
      answer: { encrypted: false, encryptionAudience: 'self' },
      lockDisabled: false,
      lockTitle: 'Choose encryption audience',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
    });

    const markup = renderToStaticMarkup(lockControl);
    expect(markup).toContain(`href="${buildSbtDetailPath(address, 'edge')}"`);
    expect(markup).not.toContain(`href="/u/${address}"`);
  });

  it('does not inherit the general session name in lock audience labels when the slug is unresolved', () => {
    const generalCfg = {
      slug: '',
      sessionName: 'General Session',
      networkChainId: 84532,
    };
    const strictLookup = (slug) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      strictLookup(slug) || generalCfg
    ));

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: '',
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: 'missing-session-slug',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
    });
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.getResponseGatePolicy = jest.fn(() => ({
      gates: [{
        gateId: 'default_gate',
        label: 'Registry default gate',
        sbtAddresses: ['0x1111111111111111111111111111111111111111'],
      }],
      recipients: [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'baseSepolia' }],
    }));
    subject.resolveConfiguredGateLabel = jest.fn(() => 'Registry default gate');
    subject.resolveGateDisplayLabel = jest.fn(() => 'Registry default gate');

    const gateOptions = subject.getResponseGateOptions('q1');

    expect(gateOptions).toHaveLength(1);
    expect(gateOptions[0]).toEqual(expect.objectContaining({
      gateId: 'default_gate',
      label: 'session',
    }));
    expect(gateOptions[0].label).not.toBe('General Session');
  });

  it('does not inherit the general response gate policy for unknown explicit session slugs', () => {
    const generalCfg = {
      slug: '',
      sessionName: 'General Session',
      networkChainId: 84532,
      sponsored: {
        defaultGateId: 'general_gate',
        gates: {
          general_gate: {
            gateId: 'general_gate',
            type: 'sbt',
            label: 'General Gate',
            chainId: 84532,
            sbtAddresses: ['0x1111111111111111111111111111111111111111'],
          },
        },
        resources: {
          questionResponses: { gateId: 'general_gate' },
          default: { gateId: 'general_gate' },
        },
      },
    };
    const strictLookup = (slug) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      strictLookup(slug) || generalCfg
    ));

    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      sessionConfig: {
        sessionName: 'Pinned Missing Session',
      },
    });

    const policy = subject.getResponseGatePolicy();

    expect(policy).toEqual({
      primaryResource: 'questionResponses',
      gates: [],
      recipients: [],
      allowFallbackConditions: true,
    });
    expect(subject._responseGatePolicyCache?.cfg).toMatchObject({
      slug: 'missing-session-slug',
      sessionName: 'Pinned Missing Session',
    });
    expect(subject._responseGatePolicyCache?.cfg?.sponsored).toBeUndefined();
  });

  it('keeps response gate SBT details hidden behind the caret until expanded', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      lockAudienceMenuByQuestion: { q1: true },
      lockAudienceGateDetailsByQuestion: {},
    };
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => ({
      gateDetails: [{
        gateId: 'default_gate',
        label: 'test-12',
        sbtItems: [{
          address: '0x1111111111111111111111111111111111111111',
          label: 'AI Gate Test SBT',
          meta: '0x1111...1111',
          href: '/sbt/0x1111111111111111111111111111111111111111',
        }],
      }],
    }));
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject.resolveFieldEncryptionGateId = jest.fn(() => null);

    const collapsedControl = subject.renderAnswerLockControl({
      surveyIndex: 0,
      questionId: 'q1',
      answer: { encrypted: false, encryptionAudience: 'self' },
      lockDisabled: false,
      lockTitle: 'Not encrypted',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
    });

    const collapsedTree = renderLockAudienceControl(collapsedControl);
    expect(treeHasText(collapsedTree, 'only me')).toBe(true);
    expect(treeHasText(collapsedTree, 'test-12')).toBe(true);
    expect(treeHasText(collapsedTree, 'for test-12')).toBe(false);
    expect(treeHasText(collapsedTree, 'AI Gate Test SBT')).toBe(false);
    expect(findNodeByClassName(collapsedTree, styles.lockAudienceCaretButton)).toBeTruthy();

    subject.state = {
      ...subject.state,
      lockAudienceMenuByQuestion: { q1: true },
      lockAudienceGateDetailsByQuestion: { q1: 'default_gate' },
    };

    const expandedControl = subject.renderAnswerLockControl({
      surveyIndex: 0,
      questionId: 'q1',
      answer: { encrypted: false, encryptionAudience: 'self' },
      lockDisabled: false,
      lockTitle: 'Not encrypted',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
    });

    const expandedTree = renderLockAudienceControl(expandedControl);
    expect(treeHasText(expandedTree, 'AI Gate Test SBT')).toBe(true);
    expect(treeHasText(expandedTree, '0x1111...1111')).toBe(true);
  });

  it('wires shared lock-audience gate helper callbacks for select and details toggle', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.toggleLockAudienceGateDetails = jest.fn();
    subject.applyLockAudienceSelection = jest.fn();
    subject.state = {
      ...subject.state,
      lockAudienceMenuByQuestion: { q1: true },
      lockAudienceGateDetailsByQuestion: {},
    };
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => ({
      gateDetails: [{
        gateId: 'vip_gate',
        label: 'VIP gate',
        sbtItems: [{
          address: '0x1111111111111111111111111111111111111111',
          label: 'AI Gate Test SBT',
          meta: '0x1111...1111',
          href: '/sbt/0x1111111111111111111111111111111111111111',
        }],
      }],
    }));
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject.resolveFieldEncryptionGateId = jest.fn(() => null);

    const lockControl = subject.renderAnswerLockControl({
      surveyIndex: 0,
      questionId: 'q1',
      answer: { encrypted: false, encryptionAudience: 'self' },
      lockDisabled: false,
      lockTitle: 'Not encrypted',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
    });
    const gateOption = lockControl.props.gateOptions[0];
    expect(gateOption).toEqual(expect.objectContaining({
      gateId: 'vip_gate',
      label: 'VIP gate',
    }));

    const gateButton = findElement(
      renderLockAudienceControl(lockControl),
      (candidate) => candidate?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_GATE
        && candidate?.props?.['data-ce-gate-id'] === 'vip_gate'
    );
    const caretButton = findNodeByClassName(renderLockAudienceControl(lockControl), styles.lockAudienceCaretButton);

    expect(gateButton).toBeTruthy();
    expect(caretButton).toBeTruthy();

    gateButton.props.onClick();
    expect(subject.applyLockAudienceSelection).toHaveBeenCalledWith({
      surveyIndex: 0,
      qid: 'q1',
      effectiveFieldKey: 'answer',
      audience: 'gate',
      gateId: 'vip_gate',
    });

    const preventDefault = jest.fn();
    const stopPropagation = jest.fn();
    caretButton.props.onClick({ preventDefault, stopPropagation });

    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(subject.toggleLockAudienceGateDetails).toHaveBeenCalledWith('q1', 'vip_gate', 'answer');
  });

  it('hides the plaintext audience option for additional comment lock menus', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = { ...subject.state, lockAudienceMenuByQuestion: { 'q1:additional': true } };
    subject.isQuestionLockedForResponse = jest.fn(() => false);
    subject.resolveQuestionGateOption = jest.fn(() => null);
    subject.resolveFieldEncryptionAudience = jest.fn(() => 'self');
    subject.resolveLockAudienceSessionName = jest.fn(() => 'session');

    const lockControl = subject.renderAnswerLockControl({
      surveyIndex: 0,
      questionId: 'q1',
      answer: { encrypted: false, encryptionAudience: 'self' },
      field: { encrypted: false, encryptionAudience: 'self' },
      fieldKey: 'additional',
      lockDisabled: false,
      lockTitle: 'Comments encryption audience',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
      showPlaintextOption: true,
      showFollowOption: true,
    });

    const lockTree = renderLockAudienceControl(lockControl);
    expect(treeHasText(lockTree, 'Not encrypted')).toBe(false);
    expect(treeHasDataTestId(lockTree, E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_NONE)).toBe(false);
    expect(treeHasText(lockTree, 'only me')).toBe(true);
    expect(treeHasText(lockTree, 'Match Answer')).toBe(true);
  });
});
