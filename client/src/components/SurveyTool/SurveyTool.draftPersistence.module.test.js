import SurveyTool from './SurveyTool';
import {
  computeSubmitLabel,
  doesQuestionProgressMatchSlug,
  normalizeSurveyToolFilterState,
  shouldShowPileFullLoadingState,
  buildSurveyDraftSemanticSignature,
} from './surveyToolUtils.js';
import { SurveyQuestions } from './SurveyQuestions';
import { PileViewMode } from './SurveyPileViewMode';
import { QuestionsDashboard } from './SurveySelector';
import DeferredRatingSlider from './DeferredRatingSlider';
import FullQuestionRatingInput from './FullQuestionRatingInput';
import SurveyQuestionTagControl from './SurveyQuestionTagControl';
import { DeferredCommitSlider } from './DeferredCommitSlider';
import { QuestionFilter as RawQuestionFilter } from './QuestionFilter';
import TagModal from '../TagPage/TagModal';
import GatedPromptNotice from './GatedPromptNotice';
import styles from './SurveyTool.module.scss';
import { renderToStaticMarkup } from 'react-dom/server';
import contractScripts, * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import * as portoFunctions from '../../utilities/web3/portoFunctions.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as sessionScanScope from '../../utilities/session/sessionScanScope.js';
import * as sbtDisplayNameUtils from '../../utilities/sbt/sbtDisplayNames.js';
import * as sponsoredAccess from '../../utilities/web3/sponsoredAccess.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';

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

const treeHasDataTestId = (node, testId) => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasDataTestId(child, testId));
  if (typeof node !== 'object') return false;
  if (node?.props?.['data-testid'] === testId) return true;
  return treeHasDataTestId(node?.props?.children, testId);
};

const treeHasLabel = (node, label) => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasLabel(child, label));
  if (typeof node !== 'object') return false;
  if (node?.props?.label === label) return true;
  return treeHasLabel(node?.props?.children, label);
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

const findFirstNodeByType = (node, targetType) => {
  if (node == null) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findFirstNodeByType(child, targetType);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  if (node?.type === targetType) return node;
  return findFirstNodeByType(node?.props?.children, targetType);
};

const nodeHasClassName = (node, className) => {
  const value = node?.props?.className;
  if (typeof value !== 'string') return false;
  return value.split(/\s+/).includes(className);
};

const findNodeByClassName = (node, className) => (
  findElement(node, (candidate) => nodeHasClassName(candidate, className))
);

const getElementChildren = (node) => {
  const children = node?.props?.children;
  if (children == null) return [];
  return (Array.isArray(children) ? children : [children]).filter((child) => child && typeof child === 'object');
};

const countElements = (node, predicate) => {
  let count = 0;
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
    if (predicate(current)) count += 1;
    const children = current?.props?.children;
    if (children !== undefined) stack.push(children);
  }

  return count;
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

describe('SurveyTool draft persistence', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it('blocks submit click when submitted latch is active and no pending edits exist', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    const uploadSpy = jest.fn();
    subject.encryptAndUpload = uploadSpy;
    subject.getPendingEditStats = () => ({ total: 0, encrypted: 0 });
    subject.state = {
      isSubmitting: false,
      submittedSinceLastEdit: true,
      submissionComplete: false,
      modifiedCount: 0,
    };

    subject.handlePrimarySubmitClick();
    expect(uploadSpy).not.toHaveBeenCalled();
    expect(subject._submitGuard).toBe(false);
  });

  it('canonicalizes reserved session aliases when reopening a submitted survey response', () => {
    const priorUrl = window.location.href;
    const pushStateSpy = jest.spyOn(window.history, 'pushState');
    const buildSubject = (activeSessionSlug) => {
      const subject = new SurveyQuestions({
        singleQuestionMode: false,
        isStandalone: false,
        surveyIndex: 0,
        surveyId: '0xSurvey',
        account: '0xAbC',
        loginComplete: true,
        network: { id: 84532 },
        activeSessionSlug,
        sessionSlug: activeSessionSlug,
      });
      subject.getPendingEditStats = () => ({ total: 0, encrypted: 0 });
      subject.state = {
        ...subject.state,
        isSubmitting: false,
        submittedSinceLastEdit: false,
        submissionComplete: true,
        modifiedCount: 0,
      };
      return subject;
    };

    try {
      window.history.replaceState({}, '', '/survey/0xsurvey');

      const debateSubject = buildSubject('DEBATE');
      debateSubject.handlePrimarySubmitClick();
      expect(pushStateSpy).toHaveBeenLastCalledWith({}, '', '/survey/0xsurvey/0xabc?session=DEBATE');

      const generalSubject = buildSubject('general');
      generalSubject.handlePrimarySubmitClick();
      expect(pushStateSpy).toHaveBeenLastCalledWith({}, '', '/survey/0xsurvey/0xabc');
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('flushes pending standalone draft to storage on unmount', () => {
    sessionStorage.clear();

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    const key = subject.getDraftKey();
    expect(key).toBeTruthy();

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      surveysResponseState: [
        {
          answers: {
            q1: { value: 'carry', encrypted: false, encryptionAudience: 'self' },
          },
          additionalComments: {
            q1: { value: '', encrypted: false, encryptionAudience: 'self' },
          },
          importance: {},
          conviction: {},
        },
      ],
      isDirty: true,
      modifiedCount: 1,
    };

    subject.persistDraftSafely(60);
    expect(subject._persistTimer).toBeTruthy();

    subject.componentWillUnmount();

    const raw = sessionStorage.getItem(key);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed?.answers?.q1?.value).toBe('carry');

    sessionStorage.clear();
  });

  it('keeps unresolved draft storage scoped to __pending__ instead of inheriting the general network key', () => {
    sessionStorage.clear();

    const generalCfg = {
      slug: '',
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
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
      questionPool: [{ id: 'q1' }],
    });
    subject._getEffectiveDraftSlug = jest.fn(() => 'missing-session-slug');

    const pendingKey = 'dg:surveyDraft:missing-session-slug:__pending__:0xabc:questions';
    const legacyGeneralKey = 'dg:surveyDraft:missing-session-slug:84532:0xabc:questions';
    sessionStorage.setItem(pendingKey, JSON.stringify({
      meta: { networkId: null, surveyId: 'questions', ts: 111 },
      answers: {
        q1: {
          value: 'pending-draft',
        },
      },
    }));
    sessionStorage.setItem(legacyGeneralKey, JSON.stringify({
      meta: { networkId: 84532, surveyId: 'questions', ts: 222 },
      answers: {
        q1: {
          value: 'wrong-general-draft',
        },
      },
    }));

    expect(subject.getDraftKey()).toBe(pendingKey);
    expect(subject.loadDraft()).toMatchObject({
      meta: { networkId: null, surveyId: 'questions', ts: 111 },
      answers: {
        q1: {
          value: 'pending-draft',
        },
      },
    });

    sessionStorage.clear();
  });

  it('drops invalid persisted draft payloads during loadDraft', () => {
    sessionStorage.clear();

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    const key = subject.getDraftKey();
    sessionStorage.setItem(key, JSON.stringify({
      meta: { networkId: 84532, surveyId: 'questions', ts: 111 },
      baseline: {
        q1: {
          value: 'invalid-without-answers',
        },
      },
    }));

    expect(subject.loadDraft()).toBeNull();
    expect(sessionStorage.getItem(key)).toBeNull();

    sessionStorage.clear();
  });

  it('applies draft tracking patches without clobbering omitted fields', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    subject._draftParseCache = { key: 'draft-key', raw: '{"answers":{}}', parsed: { answers: {} } };
    subject._lastDraftKey = 'draft-key';
    subject._lastDraftJSON = '{"answers":{}}';
    subject._lastDraftSemanticSignature = 'sig:old';

    subject._applyDraftTrackingState({
      lastDraftJSON: null,
      lastDraftSemanticSignature: 'sig:new',
    });

    expect(subject._draftParseCache).toEqual({ key: 'draft-key', raw: '{"answers":{}}', parsed: { answers: {} } });
    expect(subject._lastDraftKey).toBe('draft-key');
    expect(subject._lastDraftJSON).toBeNull();
    expect(subject._lastDraftSemanticSignature).toBe('sig:new');
  });

  it('applies draft hydration entries to a target slice through one local shell helper', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    const targetSlice = {
      answers: {},
      importance: {},
      conviction: {},
      additionalComments: {},
    };

    const changed = subject._applyDraftHydrationEntryToSlice({
      targetSlice,
      questionId: 'q1',
      draftEntry: {
        value: 'draft answer',
        answerEncrypted: true,
        answerEncryptionAudience: 'gate',
        additional: 'draft notes',
        additionalEncrypted: true,
        additionalAudienceMode: 'inherit',
        importance: 4,
        conviction: 7,
      },
      allowOverwrite: false,
    });

    expect(changed).toBe(true);
    expect(targetSlice.answers.q1).toMatchObject({
      value: 'draft answer',
      encrypted: true,
      encryptionAudience: 'self',
    });
    expect(targetSlice.additionalComments.q1).toMatchObject({
      value: 'draft notes',
      encrypted: true,
      audienceMode: 'inherit',
    });
    expect(targetSlice.importance.q1).toBe(4);
    expect(targetSlice.conviction.q1).toBe(7);
  });

  it('applies response hydration entries to a target slice through one local shell helper', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    const targetSlice = {
      answers: {},
      importance: {},
      conviction: {},
      additionalComments: {},
    };

    const changed = subject._applyResponseHydrationEntryToSlice({
      targetSlice,
      questionId: 'q1',
      response: {
        answer: {
          value: 'hydrated answer',
          encrypted: true,
        },
        additional: {
          value: 'hydrated notes',
          encrypted: true,
          audienceMode: 'inherit',
        },
        importance: 4,
        conviction: 7,
      },
      allowOverwrite: true,
      parseValue: (value) => value,
    });

    expect(changed).toBe(true);
    expect(targetSlice.answers.q1).toMatchObject({
      value: 'hydrated answer',
      encrypted: true,
    });
    expect(targetSlice.additionalComments.q1).toMatchObject({
      value: 'hydrated notes',
      encrypted: true,
      audienceMode: 'inherit',
    });
    expect(targetSlice.importance.q1).toBe(4);
    expect(targetSlice.conviction.q1).toBe(7);
  });

  it('skips draft rewrites when only timestamp would change and writes again after semantic edits', () => {
    sessionStorage.clear();
    const nowSpy = jest.spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(3000);

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      surveysResponseState: [
        {
          answers: {
            q1: { value: 'carry', encrypted: false, encryptionAudience: 'self' },
          },
          additionalComments: {
            q1: { value: '', encrypted: false, encryptionAudience: 'self' },
          },
          importance: {},
          conviction: {},
        },
      ],
    };

    const key = subject.getDraftKey();
    const setSpy = jest.spyOn(Storage.prototype, 'setItem');

    subject.persistDraft();
    const firstRaw = sessionStorage.getItem(key);
    const firstTs = JSON.parse(firstRaw)?.meta?.ts;

    subject.persistDraft();
    const secondRaw = sessionStorage.getItem(key);
    const secondTs = JSON.parse(secondRaw)?.meta?.ts;

    expect(secondRaw).toBe(firstRaw);
    expect(secondTs).toBe(firstTs);

    subject.state.surveysResponseState[0].answers.q1 = {
      ...subject.state.surveysResponseState[0].answers.q1,
      value: 'carry-updated',
    };
    subject._draftDirtyQids.add('q1');
    subject.persistDraft();
    const thirdRaw = sessionStorage.getItem(key);
    const thirdTs = JSON.parse(thirdRaw)?.meta?.ts;

    expect(thirdRaw).not.toBe(firstRaw);
    expect(thirdTs).toBe(3000);
    expect(setSpy.mock.calls.filter((call) => call[0] === key)).toHaveLength(2);

    nowSpy.mockRestore();
    setSpy.mockRestore();
    sessionStorage.clear();
  });

  it('persists and rehydrates encrypted portions for decrypted empty fields', () => {
    sessionStorage.clear();
    const sharedProps = {
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    };

    const subject = new SurveyQuestions(sharedProps);
    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      editBaseline: {
        answers: {
          q1: {
            value: 'baseline-answer',
            encrypted: true,
            encryptionAudience: 'gate',
            encryptedPortion: 'ans-base-1',
          },
        },
        additionalComments: {
          q1: {
            value: '',
            encrypted: true,
            encryptionAudience: 'gate',
            encryptedPortion: 'add-base-1',
          },
        },
        importance: {},
        conviction: {},
      },
      surveysResponseState: [
        {
          answers: {
            q1: {
              value: 'anchor-answer',
              encrypted: false,
              encryptionAudience: 'self',
              encryptedPortion: 'ans-env-1',
            },
          },
          additionalComments: {
            q1: {
              value: '',
              encrypted: true,
              encryptionAudience: 'gate',
              encryptedPortion: 'add-env-1',
            },
          },
          importance: {},
          conviction: {},
        },
      ],
    };

    subject.persistDraft();
    const key = subject.getDraftKey();
    const persisted = JSON.parse(sessionStorage.getItem(key) || '{}');

    expect(persisted?.answers?.q1?.answerEncryptedPortion).toBe('ans-env-1');
    expect(persisted?.answers?.q1?.additionalEncryptedPortion).toBe('add-env-1');
    expect(persisted?.baseline?.q1?.answerEncryptedPortion).toBe('ans-base-1');
    expect(persisted?.baseline?.q1?.additionalEncryptedPortion).toBe('add-base-1');
    expect(persisted?.baseline?.q1?.value).toBe('baseline-answer');

    const reloaded = new SurveyQuestions(sharedProps);
    reloaded.state = {
      ...reloaded.state,
      questionPool: [{ id: 'q1' }],
      editBaseline: { answers: {}, additionalComments: {}, importance: {}, conviction: {} },
      surveysResponseState: [
        {
          answers: {
            q1: { value: '', encrypted: true, encryptionAudience: 'gate' },
          },
          additionalComments: {
            q1: { value: '', encrypted: true, encryptionAudience: 'gate' },
          },
          importance: {},
          conviction: {},
        },
      ],
    };
    reloaded.getHydrationQuestionIds = jest.fn().mockReturnValue(['q1']);
    reloaded.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(reloaded.state, reloaded.props) : update;
      reloaded.state = { ...reloaded.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };

    reloaded.rehydrateDraftForRenderedIds(true);

    expect(reloaded.state.surveysResponseState?.[0]?.answers?.q1?.encryptedPortion).toBe('ans-env-1');
    expect(reloaded.state.surveysResponseState?.[0]?.additionalComments?.q1?.encryptedPortion).toBe('add-env-1');
    expect(reloaded.state.editBaseline?.answers?.q1?.encryptedPortion).toBe('ans-base-1');
    expect(reloaded.state.editBaseline?.additionalComments?.q1?.encryptedPortion).toBe('add-base-1');
    expect(reloaded.state.editBaseline?.answers?.q1?.value).toBe('baseline-answer');

    sessionStorage.clear();
  });

  it('rewrites draft payload when only baseline changes', () => {
    sessionStorage.clear();
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      surveysResponseState: [
        {
          answers: {
            q1: { value: 'stable-answer', encrypted: false, encryptionAudience: 'self' },
          },
          additionalComments: {
            q1: { value: '', encrypted: false, encryptionAudience: 'self' },
          },
          importance: {},
          conviction: {},
        },
      ],
      editBaseline: {
        answers: {
          q1: { value: 'baseline-v1', encrypted: true, encryptionAudience: 'gate', encryptedPortion: 'ans-base-1' },
        },
        additionalComments: {},
        importance: {},
        conviction: {},
      },
    };

    const key = subject.getDraftKey();
    const setSpy = jest.spyOn(Storage.prototype, 'setItem');

    subject.persistDraft();
    const first = JSON.parse(sessionStorage.getItem(key) || '{}');
    expect(first?.answers?.q1?.value).toBe('stable-answer');
    expect(first?.baseline?.q1?.value).toBe('baseline-v1');

    subject.state.editBaseline.answers.q1 = {
      value: 'baseline-v2',
      encrypted: true,
      encryptionAudience: 'gate',
      encryptedPortion: 'ans-base-2',
    };

    subject.persistDraft();
    const second = JSON.parse(sessionStorage.getItem(key) || '{}');
    expect(second?.answers?.q1?.value).toBe('stable-answer');
    expect(second?.baseline?.q1?.value).toBe('baseline-v2');
    expect(second?.baseline?.q1?.answerEncryptedPortion).toBe('ans-base-2');
    expect(setSpy.mock.calls.filter((call) => call[0] === key)).toHaveLength(2);

    setSpy.mockRestore();
    sessionStorage.clear();
  });

  it('rehydrates baseline from draft even when no answer entry exists', () => {
    sessionStorage.clear();
    const sharedProps = {
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    };

    const subject = new SurveyQuestions(sharedProps);
    const key = subject.getDraftKey();
    sessionStorage.setItem(key, JSON.stringify({
      meta: { networkId: 84532, surveyId: 'questions', ts: 111 },
      answers: {},
      baseline: {
        q1: {
          value: 'baseline-only',
          answerEncrypted: true,
          answerEncryptionAudience: 'gate',
          answerEncryptedPortion: 'ans-base-only',
          additional: '',
          additionalEncrypted: false,
          additionalEncryptionAudience: 'self',
          importance: null,
          conviction: null,
        },
      },
    }));

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      surveysResponseState: [
        { answers: {}, additionalComments: {}, importance: {}, conviction: {} },
      ],
      editBaseline: { answers: {}, additionalComments: {}, importance: {}, conviction: {} },
    };
    subject.getHydrationQuestionIds = jest.fn().mockReturnValue(['q1']);
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };

    subject.rehydrateDraftForRenderedIds(true);

    expect(subject.state.surveysResponseState?.[0]?.answers?.q1).toBeUndefined();
    expect(subject.state.editBaseline?.answers?.q1?.value).toBe('baseline-only');
    expect(subject.state.editBaseline?.answers?.q1?.encryptedPortion).toBe('ans-base-only');

    sessionStorage.clear();
  });

  it('keeps restored draft baseline aligned after masked prefill on refresh', () => {
    sessionStorage.clear();
    const sharedProps = {
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    };

    const subject = new SurveyQuestions(sharedProps);
    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      editBaseline: {
        answers: {
          q1: {
            value: 'real text',
            encrypted: true,
            encryptionAudience: 'gate',
            encryptedPortion: 'ans-env-1',
          },
        },
        additionalComments: {},
        importance: {},
        conviction: {},
      },
      surveysResponseState: [
        {
          answers: {
            q1: {
              value: 'real text',
              encrypted: true,
              encryptionAudience: 'gate',
              encryptedPortion: 'ans-env-1',
            },
          },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      ],
    };

    subject.persistDraft();

    const reloaded = new SurveyQuestions(sharedProps);
    reloaded.state = {
      ...reloaded.state,
      questionPool: [{ id: 'q1' }],
      editBaseline: { answers: {}, additionalComments: {}, importance: {}, conviction: {} },
      surveysResponseState: [
        { answers: {}, additionalComments: {}, importance: {}, conviction: {} },
      ],
    };
    reloaded.getHydrationQuestionIds = jest.fn().mockReturnValue(['q1']);
    reloaded.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(reloaded.state, reloaded.props) : update;
      reloaded.state = { ...reloaded.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };
    reloaded.updateJsonPreview = jest.fn();
    reloaded.recalculateEditStats = jest.fn();

    reloaded.rehydrateDraftForRenderedIds(true);
    reloaded.prefillSurveyResponses({
      responses: [
        {
          questionID: 'q1',
          answer: { value: '*', encrypted: true, encryptedPortion: 'ans-env-1' },
          additional: { value: '', encrypted: false, encryptedPortion: '' },
        },
      ],
    });

    expect(reloaded.state.surveysResponseState?.[0]?.answers?.q1?.value).toBe('real text');
    expect(reloaded.state.editBaseline?.answers?.q1?.value).toBe('real text');
    expect(reloaded.state.editBaseline?.answers?.q1?.encryptedPortion).toBe('ans-env-1');

    sessionStorage.clear();
  });

  it('keeps decrypted-empty answer aligned when masked response has encrypted=true without envelope', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    const prevSlice = {
      answers: {
        q1: {
          value: '',
          encrypted: true,
          encryptedPortion: '',
          encryptionAudience: 'gate',
        },
      },
      additionalComments: {},
      importance: {},
      conviction: {},
    };

    const userAnswers = {
      responses: [
        {
          questionID: 'q1',
          answer: { value: '*', encrypted: true, encryptedPortion: '' },
          additional: { value: '*', encrypted: true, encryptedPortion: '' },
        },
      ],
    };

    const nextSlice = subject.buildSliceFromUserAnswers(userAnswers, prevSlice);

    expect(nextSlice.answers.q1.value).toBe('');
    expect(nextSlice.additionalComments.q1.value).toBe('*');
  });

  it('prefills single-question responses into ensured survey slots', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      surveysResponseState: [],
      editBaseline: null,
      isDirty: false,
      submissionComplete: false,
    };
    subject._applyResponseHydrationListToSlice = jest.fn(({ targetSlice, responses }) => {
      targetSlice.answers.q1 = { value: responses[0].answer.value };
      targetSlice.additionalComments.q1 = { value: responses[0].additional.value };
      return true;
    });
    subject.buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: 'baseline answer' } },
      additionalComments: { q1: { value: 'baseline notes' } },
      importance: {},
      conviction: {},
    }));
    subject.updateJsonPreview = jest.fn();
    subject.recalculateEditStats = jest.fn();
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };

    subject.prefillSingleQuestionResponse({
      questionID: 'q1',
      answer: { value: 'hydrated answer' },
      additional: { value: 'hydrated notes' },
    });

    expect(subject.state.surveysResponseState).toHaveLength(1);
    expect(subject.state.surveysResponseState[0]).toEqual({
      answers: { q1: { value: 'hydrated answer' } },
      importance: {},
      conviction: {},
      additionalComments: { q1: { value: 'hydrated notes' } },
    });
    expect(subject.state.editBaseline).toEqual({
      answers: { q1: { value: 'baseline answer' } },
      additionalComments: { q1: { value: 'baseline notes' } },
      importance: {},
      conviction: {},
    });
    expect(subject.updateJsonPreview).toHaveBeenCalled();
    expect(subject.recalculateEditStats).toHaveBeenCalled();
  });

  it('prefills multi-question responses into ensured survey slots', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 1,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      surveysResponseState: [
        { answers: { keep: { value: 'persisted' } }, importance: {}, conviction: {}, additionalComments: {} },
      ],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      isDirty: false,
      submissionComplete: false,
    };
    subject._applyResponseHydrationListToSlice = jest.fn(({ targetSlice, responses }) => {
      targetSlice.answers.q1 = { value: responses[0].answer.value };
      targetSlice.additionalComments.q1 = { value: responses[0].additional.value };
      targetSlice.importance.q1 = responses[0].importance;
      targetSlice.conviction.q1 = responses[0].conviction;
      return true;
    });
    subject.buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: 'baseline answer' } },
      additionalComments: { q1: { value: 'baseline notes' } },
      importance: { q1: 4 },
      conviction: { q1: 7 },
    }));
    subject.updateJsonPreview = jest.fn();
    subject.recalculateEditStats = jest.fn();
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };

    subject.prefillSurveyResponses({
      responses: [
        {
          questionID: 'q1',
          answer: { value: 'hydrated answer' },
          additional: { value: 'hydrated notes' },
          importance: 4,
          conviction: 7,
        },
      ],
    });

    expect(subject.state.surveysResponseState).toHaveLength(2);
    expect(subject.state.surveysResponseState[0]).toEqual({
      answers: { keep: { value: 'persisted' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    });
    expect(subject.state.surveysResponseState[1]).toEqual({
      answers: { q1: { value: 'hydrated answer' } },
      importance: { q1: 4 },
      conviction: { q1: 7 },
      additionalComments: { q1: { value: 'hydrated notes' } },
    });
    expect(subject.state.editBaseline).toEqual({
      answers: { q1: { value: 'baseline answer' } },
      additionalComments: { q1: { value: 'baseline notes' } },
      importance: { q1: 4 },
      conviction: { q1: 7 },
    });
    expect(subject.updateJsonPreview).toHaveBeenCalled();
    expect(subject.recalculateEditStats).toHaveBeenCalled();
  });

  it('merges survey response state into ensured survey slots', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '',
      loginComplete: false,
      network: { id: 84532 },
    });

    subject.buildEmptyResponseFieldState = jest.fn((qid, fieldKey = 'answer') => ({
      value: '',
      qid,
      fieldKey,
    }));

    expect(subject.mergeSurveyResponseState([
      {
        answers: { keep: { value: 'persisted' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
    ], [{ id: 'q1' }], 2)).toEqual([
      {
        answers: { keep: { value: 'persisted' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      {
        answers: { q1: { value: '', qid: 'q1', fieldKey: 'answer' } },
        importance: {},
        conviction: {},
        additionalComments: { q1: { value: '', qid: 'q1', fieldKey: 'additional' } },
      },
    ]);
  });

  it('does not resurrect cleared draft answers from stale cache', () => {
    sessionStorage.clear();

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      pileQuestions: [],
      editBaseline: {
        answers: {
          q1: { value: 'keep-baseline', encrypted: false, encryptionAudience: 'self' },
        },
        additionalComments: {
          q1: { value: '', encrypted: false, encryptionAudience: 'self' },
        },
        importance: {},
        conviction: {},
      },
      surveysResponseState: [
        {
          answers: {
            q1: { value: 'keep', encrypted: false, encryptionAudience: 'self' },
          },
          additionalComments: {
            q1: { value: '', encrypted: false, encryptionAudience: 'self' },
          },
          importance: {},
          conviction: {},
        },
      ],
    };

    const key = subject.getDraftKey();
    const seedPayload = {
      meta: { networkId: 84532, surveyId: 'questions', ts: 111 },
      answers: {
        q1: {
          value: 'keep',
          answerEncrypted: false,
          answerEncryptionAudience: 'self',
          additional: '',
          additionalEncrypted: false,
          additionalEncryptionAudience: 'self',
          importance: null,
          conviction: null,
        },
        q2: {
          value: 'remove-me',
          answerEncrypted: false,
          answerEncryptionAudience: 'self',
          additional: '',
          additionalEncrypted: false,
          additionalEncryptionAudience: 'self',
          importance: null,
          conviction: null,
        },
      },
      baseline: {
        q1: {
          value: 'keep-baseline',
          answerEncrypted: false,
          answerEncryptionAudience: 'self',
          additional: '',
          additionalEncrypted: false,
          additionalEncryptionAudience: 'self',
          importance: null,
          conviction: null,
        },
        q2: {
          value: 'remove-baseline',
          answerEncrypted: false,
          answerEncryptionAudience: 'self',
          additional: '',
          additionalEncrypted: false,
          additionalEncryptionAudience: 'self',
          importance: null,
          conviction: null,
        },
      },
    };
    const seedRaw = JSON.stringify(seedPayload);
    sessionStorage.setItem(key, seedRaw);
    subject._lastDraftKey = key;
    subject._lastDraftJSON = seedRaw;
    subject._lastDraftSemanticSignature = buildSurveyDraftSemanticSignature(seedPayload);
    subject._draftParseCache = { key, raw: seedRaw, parsed: seedPayload };

    subject.clearDraftFor('q2');
    const afterClear = JSON.parse(sessionStorage.getItem(key) || '{}');
    expect(afterClear?.answers?.q2).toBeUndefined();
    expect(afterClear?.baseline?.q2).toBeUndefined();

    subject.persistDraft();
    const afterPersist = JSON.parse(sessionStorage.getItem(key) || '{}');
    expect(afterPersist?.answers?.q2).toBeUndefined();
    expect(afterPersist?.baseline?.q2).toBeUndefined();
    expect(afterPersist?.answers?.q1?.value).toBe('keep');
    expect(afterPersist?.baseline?.q1?.value).toBe('keep-baseline');

    sessionStorage.clear();
  });
});
