import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  __test__telegramMiniApp,
  handleTelegramMiniAppRequest,
  validateTelegramMiniAppInitData,
} from './telegramMiniApp.mjs';
import { persistAnswerDraft, SUBMIT_REQUEST_KV_PREFIX } from './telegramCommands.mjs';

class MemoryKv {
  constructor() {
    this.store = new Map();
  }

  async put(key, value) {
    this.store.set(key, value);
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  async delete(key) {
    this.store.delete(key);
  }

  async list({ prefix = '', limit = 1000 } = {}) {
    const keys = Array.from(this.store.keys())
      .filter((key) => key.startsWith(prefix))
      .sort()
      .slice(0, limit)
      .map((name) => ({ name }));
    return { keys, list_complete: true };
  }
}

function signInitData(fields = {}, botToken = '') {
  const dataCheckString = Object.entries(fields)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => (
      leftKey === rightKey
        ? String(leftValue).localeCompare(String(rightValue))
        : leftKey.localeCompare(rightKey)
    ))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

test('validateTelegramMiniAppInitData accepts current Telegram HMAC init data', async () => {
  const nowSeconds = 1_800_000_000;
  const botToken = '123456:test-token';
  const initData = signInitData({
    auth_date: String(nowSeconds),
    query_id: 'mini-query-1',
    user: JSON.stringify({ id: 42, username: 'participant', first_name: 'Pat' }),
  }, botToken);

  const result = await validateTelegramMiniAppInitData(initData, {
    TELEGRAM_BOT_TOKEN: botToken,
  }, {
    nowMs: nowSeconds * 1000,
  });

  assert.equal(result.ok, true);
  assert.equal(result.authMode, 'telegram');
  assert.equal(result.user.telegramUserId, '42');
  assert.equal(result.user.username, 'participant');
  assert.equal(result.queryId, 'mini-query-1');
});

test('validateTelegramMiniAppInitData rejects tampered and expired init data', async () => {
  const nowSeconds = 1_800_000_000;
  const botToken = '123456:test-token';
  const valid = signInitData({
    auth_date: String(nowSeconds),
    user: JSON.stringify({ id: 42, username: 'participant' }),
  }, botToken);

  const tampered = valid.replace('participant', 'attacker');
  const tamperedResult = await validateTelegramMiniAppInitData(tampered, {
    TELEGRAM_BOT_TOKEN: botToken,
  }, {
    nowMs: nowSeconds * 1000,
  });

  assert.equal(tamperedResult.ok, false);
  assert.equal(tamperedResult.reason, 'telegram_init_hash_invalid');

  const expired = signInitData({
    auth_date: String(nowSeconds - 90_000),
    user: JSON.stringify({ id: 42, username: 'participant' }),
  }, botToken);
  const expiredResult = await validateTelegramMiniAppInitData(expired, {
    TELEGRAM_BOT_TOKEN: botToken,
  }, {
    nowMs: nowSeconds * 1000,
  });

  assert.equal(expiredResult.ok, false);
  assert.equal(expiredResult.reason, 'telegram_init_data_expired');
});

test('Mini App renders agree-style controls in client order with client colors', () => {
  const html = __test__telegramMiniApp.telegramMiniAppHtml();
  const agreeIndex = html.indexOf("['agree', 'Agree']");
  const unsureIndex = html.indexOf("['unsure', 'Unsure']");
  const disagreeIndex = html.indexOf("['disagree', 'Disagree']");

  assert.notEqual(agreeIndex, -1);
  assert.notEqual(unsureIndex, -1);
  assert.notEqual(disagreeIndex, -1);
  assert.ok(agreeIndex < unsureIndex);
  assert.ok(unsureIndex < disagreeIndex);
  assert.match(html, /\.segment\.agree \{[\s\S]*border-color: #4caf50;[\s\S]*color: #81c784;/);
  assert.match(html, /\.segment\.unsure \{[\s\S]*border-color: #fdd835;[\s\S]*color: #fff176;/);
  assert.match(html, /\.segment\.disagree \{[\s\S]*border-color: #f44336;[\s\S]*color: #e57373;/);
  assert.match(html, /\.segment\.agree\.selected \{[\s\S]*background: #4caf50;[\s\S]*color: #ffffff;/);
  assert.match(html, /\.segment\.unsure\.selected \{[\s\S]*background: #ffeb3b;[\s\S]*color: #202458;/);
  assert.match(html, /\.segment\.disagree\.selected \{[\s\S]*background: #f44336;[\s\S]*color: #ffffff;/);
});

test('Mini App keeps primary actions visible while retrying unavailable questions', () => {
  const html = __test__telegramMiniApp.telegramMiniAppHtml();

  assert.match(html, /<title>Context Engine<\/title>/);
  assert.match(html, /<h1>Context Engine<\/h1>/);
  assert.match(html, /overflow-y: auto;/);
  assert.match(html, /touch-action: auto;/);
  assert.equal(html.includes('<h1>CE Agent</h1>'), false);
  assert.match(html, /id="showFilter"[^>]*aria-label="Filter"/);
  assert.match(html, /id="showSettings"[^>]*aria-label="Settings"/);
  assert.match(html, /id="filterPanel"[^>]*aria-label="Question filters"/);
  assert.match(html, /id="questionTypeFilters"/);
  assert.match(html, /id="filterAiSearch"/);
  assert.match(html, /id="filterAiSearchMic"[^>]*aria-label="Dictate AI search"/);
  assert.equal(html.includes('id="applyAiSearch"'), false);
  assert.match(html, /id="clearAiSearch"[^>]*hidden/);
  assert.match(html, /id="filterSummary"/);
  assert.match(html, /AI search/);
  assert.match(html, /Question type/);
  assert.match(html, /--filter-accent: #2cc3ff;/);
  assert.match(html, /--settings-accent: #ffd166;/);
  assert.match(html, /\.filterButton\.active \{[\s\S]*background: var\(--filter-accent\);/);
  assert.match(html, /\.settingsButton\.active \{[\s\S]*background: var\(--settings-accent\);/);
  assert.match(html, /viewBox="0 0 512 512"/);
  assert.match(html, /id="sessionPicker"/);
  assert.match(html, /id="sessionSummary"/);
  assert.match(html, /id="toggleSessions"/);
  assert.match(html, /id="sessionPickerBody"/);
  assert.match(html, /\.sessionPicker\.collapsed \.sessionPickerBody \{ display: none; \}/);
  assert.match(html, /<div class="sectionTitle">Sessions<\/div>/);
  assert.match(html, /id="continueSessions"/);
  assert.equal(html.includes('id="groupsPicker"'), false);
  assert.equal(html.includes('function renderGroupsPicker()'), false);
  assert.match(html, /id="filterUnansweredFirst"/);
  assert.equal(html.includes('id="showUnansweredFirst"'), false);
  assert.match(html, /Show un-answered questions first/);
  assert.match(html, /id="clearDrafts"/);
  assert.match(html, /Clear drafts/);
  assert.equal(html.includes('id="showSettings" type="button">Settings</button>'), false);
  assert.equal(html.includes('<footer>'), false);
  assert.equal(html.includes('footer {'), false);
  assert.equal(html.includes('id="save"'), false);
  assert.equal(html.includes('id="submit"'), false);
  assert.match(html, /\.cardActions \{[\s\S]*grid-template-columns: minmax\(96px, 3fr\) minmax\(0, 7fr\);/);
  assert.match(html, /id="savedDrafts"/);
  assert.match(html, /const serverDrafts = body\.draftAnswersByQuestionKey \|\| \{\};/);
  assert.equal(html.includes('enableVerticalSwipes'), false);
  assert.equal(html.includes('disableVerticalSwipes'), false);
  assert.match(html, /--tg-viewport-height/);
  assert.match(html, /body \{[\s\S]*overflow-y: auto;[\s\S]*-webkit-overflow-scrolling: touch;/);
  assert.match(html, /\.app \{[\s\S]*min-height: var\(--tg-viewport-height, 100dvh\);[\s\S]*grid-template-rows: auto auto;[\s\S]*overflow-y: visible;/);
  assert.match(html, /\.layout \{[\s\S]*overflow-y: visible;[\s\S]*touch-action: auto;/);
  assert.equal(html.includes('class="pager"'), false);
  assert.equal(html.includes('id="prev"'), false);
  assert.equal(html.includes('id="next"'), false);
  assert.equal(html.includes('id="page"'), false);
  assert.equal(html.includes('state.page'), false);
  assert.equal(html.includes('.slice(state.page'), false);
  assert.match(html, /<h1>Context Engine<\/h1>[\s\S]*<section class="sessionPicker" id="sessionPicker" aria-label="Sessions">[\s\S]*<div class="meta" id="meta"><\/div>/);
  assert.match(html, /<section class="layout">\s*<section class="questionStack" id="questionStack" aria-label="Questions"><\/section>\s*<\/section>/);
  assert.match(html, /startCommentDictation/);
  assert.match(html, /startSearchDictation/);
  assert.match(html, /Dictate additional comments/);
  assert.match(html, /Dictate AI search/);
  assert.match(html, /const MIC_ICON = '<svg/);
  assert.match(html, /const STOP_ICON = '<svg/);
  assert.match(html, /\.commentActions \.micButton svg \{[\s\S]*width: 30px;[\s\S]*height: 30px;/);
  assert.match(html, /Transcribing microphone audio/);
  assert.match(html, /Transcribing search audio/);
  assert.match(html, /function setCommentMicFeedback/);
  assert.match(html, /function setSearchMicFeedback/);
  assert.equal(html.includes("mic.textContent = 'Mic';"), false);
  assert.equal(html.includes("button.textContent = 'Stop';"), false);
  assert.equal(html.includes("setStatus('Transcribing comment"), false);
  assert.equal(html.includes("setStatus('Recording comment"), false);
  assert.equal(html.includes("setStatus('Could not transcribe microphone input"), false);
  assert.match(html, /MediaRecorder/);
  assert.match(html, /\/telegram\/mini-app\/api\/transcribe/);
  assert.match(html, /SpeechRecognition/);
  assert.match(html, /\/telegram\/mini-app\/api\/clear-drafts/);
  assert.equal(html.includes("setStatus(submit ? 'Submitting...' : 'Saving draft...');"), false);
  assert.match(html, /button\.textContent = isBusy \? 'Submitting\.\.\.' : 'Submit';/);
  assert.match(html, /const QUESTION_RETRY_DELAY_MS = 4000;/);
  assert.match(html, /SHOW_UNANSWERED_STORAGE_KEY/);
  assert.match(html, /function renderSessionPicker\(\)/);
  assert.match(html, /const orderedQuestions = \(\) => \{/);
  assert.match(html, /\/telegram\/mini-app\/api\/search/);
  assert.match(html, /function scheduleAiSearch/);
  assert.match(html, /state\.aiSearchQuery = state\.aiDraftQuery\.trim\(\);[\s\S]*scheduleAiSearch\(\);/);
  assert.match(html, /const answerableCount = questions\.filter\(\(question\) => question\?\.canAnswer\)\.length;/);
  assert.match(html, /const unavailableCount = questions\.filter\(\(question\) => question\?\.payloadUnavailable === true\)\.length;/);
  assert.match(html, /function questionCountText\(data\)/);
  assert.equal(html.includes("return available + ' questions';"), true);
  assert.match(html, /answerableCount === 0 && \(/);
  assert.match(html, /unavailableCount > 0/);
  assert.match(html, /window\.setTimeout\(\(\) => \{[\s\S]*load\(\{ retry: true \}\);[\s\S]*\}, QUESTION_RETRY_DELAY_MS\);/);
});

test('Mini App session picker lists sessions and loads multi-selected questions', async () => {
  const kv = new MemoryKv();
  const launch = 'cecb_1234567890';
  await kv.put(`telegram:action:${launch}`, JSON.stringify({
    type: 'agent_bridge_opaque_action',
    actionId: launch,
    action: 'view_questions',
    lane: 'telegram_mini_app',
    miniAppLaunch: true,
    serverContextRef: { sessionPicker: true },
  }));
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [
        { sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true },
        { sessionSlug: 'e2e-spam', sessionName: 'E2E Spam', telegramBridgeEnabled: true },
        { sessionSlug: 'hidden', sessionName: 'Hidden', telegramBridgeEnabled: false },
        { sessionSlug: 'beta', sessionName: 'Beta', telegramBridgeEnabled: true },
      ],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { sessionSlug: 'alpha', questionId: 'q-alpha', questionType: 'freeform', prompt: 'Alpha prompt' },
      { sessionSlug: 'beta', questionId: 'q-beta', questionType: 'freeform', prompt: 'Beta prompt' },
    ]),
  };

  const picker = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}`),
    env,
  });
  assert.equal(picker.ok, true);
  assert.equal(picker.sessionPicker.required, true);
  assert.equal(picker.questionCount, 0);
  assert.deepEqual(picker.sessionPicker.sessions.map((session) => session.sessionSlug), ['alpha', 'beta']);

  const selected = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}&sessions=alpha,beta`),
    env,
  });
  assert.equal(selected.ok, true);
  assert.equal(selected.sessionPicker.required, false);
  assert.deepEqual(selected.selectedSessionSlugs, ['alpha', 'beta']);
  assert.equal(selected.questionCount, 2);
  assert.deepEqual(selected.questions.map((question) => question.sessionSlug), ['alpha', 'beta']);
  assert.equal(selected.session.title, '2 sessions');
});

test('Mini App keeps multi-select sessions visible after a joined-session launch', async () => {
  const kv = new MemoryKv();
  const launch = 'cecb_joinedalpha';
  await kv.put(`telegram:action:${launch}`, JSON.stringify({
    type: 'agent_bridge_opaque_action',
    actionId: launch,
    action: 'view_questions',
    lane: 'telegram_mini_app',
    miniAppLaunch: true,
    serverContextRef: { sessionSlug: 'alpha' },
  }));
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [
        { sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true },
        { sessionSlug: 'beta', sessionName: 'Beta', telegramBridgeEnabled: true },
      ],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { sessionSlug: 'alpha', questionId: 'q-alpha', questionType: 'freeform', prompt: 'Alpha prompt' },
      { sessionSlug: 'beta', questionId: 'q-beta', questionType: 'rating', prompt: 'Beta prompt' },
    ]),
  };

  const joined = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}`),
    env,
  });
  assert.equal(joined.ok, true);
  assert.equal(joined.sessionPicker.enabled, true);
  assert.equal(joined.sessionPicker.required, false);
  assert.equal(joined.sessionPicker.multiSelect, true);
  assert.equal(joined.sessionPicker.initiallyCollapsed, true);
  assert.deepEqual(joined.sessionPicker.selectedSessionSlugs, ['alpha']);
  assert.deepEqual(joined.sessionPicker.sessions.map((session) => [
    session.sessionSlug,
    session.selected,
  ]), [['alpha', true], ['beta', false]]);
  assert.deepEqual(joined.selectedSessionSlugs, ['alpha']);
  assert.equal(joined.questionCount, 1);
  assert.equal(joined.questions[0].sessionSlug, 'alpha');

  const multi = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}&sessions=alpha,beta`),
    env,
  });
  assert.equal(multi.sessionPicker.required, false);
  assert.equal(multi.sessionPicker.initiallyCollapsed, true);
  assert.deepEqual(multi.selectedSessionSlugs, ['alpha', 'beta']);
  assert.equal(multi.questionCount, 2);
});

test('Mini App falls back to session picker when launch session is not selectable', async () => {
  const kv = new MemoryKv();
  const launch = 'cecb_launchwitholdsession';
  await kv.put(`telegram:action:${launch}`, JSON.stringify({
    type: 'agent_bridge_opaque_action',
    actionId: launch,
    action: 'view_questions',
    lane: 'telegram_mini_app',
    miniAppLaunch: true,
    serverContextRef: { sessionSlug: 'old-session' },
  }));

  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}`),
    env: {
      AGENT_ACTION_KV: kv,
      AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
      AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
        defaultSessionSlug: 'alpha',
        sessions: [
          { sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true },
          { sessionSlug: 'e2e-old', sessionName: 'E2E Old', telegramBridgeEnabled: true },
        ],
      }),
    },
  });

  assert.equal(state.ok, true);
  assert.equal(state.sessionPicker.required, true);
  assert.equal(state.session.title, 'Select sessions');
  assert.deepEqual(state.sessionPicker.sessions.map((session) => session.sessionSlug), ['alpha']);
  assert.equal(state.questionCount, 0);
});

test('Mini App settings accepts show-unanswered-first with true default', () => {
  const defaultState = __test__telegramMiniApp.normalizeAgentSettingsInput({
    showUnansweredFirst: true,
  });
  assert.equal(defaultState.ok, true);
  assert.equal(defaultState.publicSummary.showUnansweredFirst, true);

  const disabled = __test__telegramMiniApp.normalizeAgentSettingsInput({
    showUnansweredFirst: 'false',
  });
  assert.equal(disabled.ok, true);
  assert.equal(disabled.publicSummary.showUnansweredFirst, false);

  const invalid = __test__telegramMiniApp.normalizeAgentSettingsInput({
    showUnansweredFirst: 'maybe',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.reason, 'show_unanswered_first_invalid');
});

test('Mini App state pre-populates previously saved answers and exposes them in settings', async () => {
  const kv = new MemoryKv();
  const questionId = 'q-previous';
  await persistAnswerDraft({
    env: { AGENT_ACTION_KV: kv },
    normalized: { user: { telegramUserId: 'preview-user' }, chat: { chatId: 'preview-user' } },
    sessionSlug: 'alpha',
    selectedQuestionId: questionId,
    answerLabel: 'Agree',
    answerValue: JSON.stringify({ questionType: 'agree_unsure_disagree', value: 'agree', label: 'Agree', comments: 'Saved context' }),
    controlType: 'agree_unsure_disagree',
    submitLane: 'telegram_mini_app',
    createdAt: '2026-05-08T12:00:00.000Z',
  });

  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env: {
      AGENT_ACTION_KV: kv,
      AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
      AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
      AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([{
        sessionSlug: 'alpha',
        questionId,
        questionType: 'agree_unsure_disagree',
        prompt: 'Should previous answers hydrate?',
      }]),
    },
    createdAt: '2026-05-08T12:00:01.000Z',
  });

  assert.equal(state.ok, true);
  assert.equal(state.savedDrafts.length, 1);
  assert.equal(state.savedDrafts[0].answerLabel, 'Agree');
  assert.equal(JSON.stringify(state).includes(questionId), false);
  const questionKey = state.questions[0].questionKey;
  assert.deepEqual(state.draftAnswersByQuestionKey[questionKey], {
    value: 'agree',
    comments: 'Saved context',
  });
});

test('Mini App clear drafts endpoint deletes saved draft answers for visible questions', async () => {
  const kv = new MemoryKv();
  const questionId = 'q-clear-draft';
  await persistAnswerDraft({
    env: { AGENT_ACTION_KV: kv },
    normalized: { user: { telegramUserId: 'preview-user' }, chat: { chatId: 'preview-user' } },
    sessionSlug: 'alpha',
    selectedQuestionId: questionId,
    answerLabel: 'Unsure',
    answerValue: JSON.stringify({ questionType: 'agree_unsure_disagree', value: 'unsure', label: 'Unsure' }),
    controlType: 'agree_unsure_disagree',
    submitLane: 'telegram_mini_app',
    createdAt: '2026-05-08T12:00:00.000Z',
  });
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([{
      sessionSlug: 'alpha',
      questionId,
      questionType: 'agree_unsure_disagree',
      prompt: 'Should drafts be clearable?',
    }]),
  };
  const before = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env,
  });
  assert.equal(before.savedDrafts.length, 1);

  const response = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/clear-drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionKeys: [before.savedDrafts[0].questionKey] }),
    }),
    env,
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.clearedCount, 1);

  const after = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env,
  });
  assert.equal(after.savedDrafts.length, 0);
  assert.deepEqual(after.draftAnswersByQuestionKey, {});
});

test('Mini App clear drafts leaves submitted answer history intact', async () => {
  const kv = new MemoryKv();
  const questionId = 'q-submitted-history';
  await persistAnswerDraft({
    env: { AGENT_ACTION_KV: kv },
    normalized: { user: { telegramUserId: 'preview-user' }, chat: { chatId: 'preview-user' } },
    sessionSlug: 'alpha',
    selectedQuestionId: questionId,
    answerLabel: 'Agree',
    answerValue: JSON.stringify({ questionType: 'agree_unsure_disagree', value: 'agree', label: 'Agree' }),
    controlType: 'agree_unsure_disagree',
    submitLane: 'telegram_mini_app',
    createdAt: '2026-05-08T12:00:00.000Z',
  });
  await kv.put(`${SUBMIT_REQUEST_KV_PREFIX}submitted-history`, JSON.stringify({
    version: 1,
    requestId: 'submitted-history',
    status: 'direct_submitted',
    lane: 'telegram_mini_app',
    telegramUserId: 'preview-user',
    sessionSlug: 'alpha',
    questionId,
    answer: { value: 'agree', label: 'Agree' },
    createdAt: '2026-05-08T12:00:02.000Z',
  }));
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([{
      sessionSlug: 'alpha',
      questionId,
      questionType: 'agree_unsure_disagree',
      prompt: 'Should submitted answers survive clear drafts?',
    }]),
  };
  const before = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env,
  });
  const questionKey = before.questions[0].questionKey;

  assert.deepEqual(before.submittedAnswerKeys, [questionKey]);
  assert.equal(before.submittedAnswers[0].answerLabel, 'Agree');
  assert.equal(before.savedDrafts.length, 0);
  assert.deepEqual(before.draftAnswersByQuestionKey, {});

  const response = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/clear-drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionKeys: [questionKey] }),
    }),
    env,
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);

  const after = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env,
  });
  assert.deepEqual(after.submittedAnswerKeys, [questionKey]);
  assert.equal(after.submittedAnswers[0].answerLabel, 'Agree');
  assert.equal(after.savedDrafts.length, 0);
});

test('Mini App search falls back to semantic food-preference matching when AI is unavailable', async () => {
  const env = {
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
        sponsoredAiAllowed: false,
      }],
    }),
  };
  const response = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        query: 'questions about food preference',
        questions: [
          { questionKey: 'q-temperature', prompt: 'Should the office be warmer?' },
          { questionKey: 'q-pizza', prompt: 'Which pizza should the team order for lunch?' },
        ],
      }),
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.source, 'semantic_fallback');
  assert.equal(body.results[0].key, 'q-pizza');
});

test('Mini App search ranks questions through the session worker AI route when allowed', async () => {
  const env = {
    AGENT_BRIDGE_DEPLOYMENT_ID: 'test-deploy',
    DEMO_SIGNER_ROOT_SECRET: 'test-root-secret',
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
        sponsoredAiAllowed: true,
        sessionWorkerUrl: 'https://session.example',
      }],
    }),
  };
  const calls = [];
  env.AGENT_BRIDGE_FETCH = async (url, init = {}) => {
    const target = String(url);
    calls.push({ url: target, init });
    if (target.endsWith('/auth/nonce')) {
      return new Response(JSON.stringify({ nonce: 'nonce-123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.endsWith('/auth/login')) {
      return new Response(JSON.stringify({ token: 'worker-token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.endsWith('/ai')) {
      assert.equal(init.headers.Authorization, 'Bearer worker-token');
      const body = JSON.parse(init.body);
      assert.equal(body.provider, 'openai');
      assert.equal(body.model, 'gpt-5');
      assert.deepEqual(body.response_format, { type: 'json_object' });
      assert.match(body.messages[1].content, /food preference/);
      return new Response(JSON.stringify({
        completion: JSON.stringify({
          matches: [{ key: 'q-pizza', score: 96, reason: 'pizza preference' }],
        }),
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'unexpected_url' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  };

  const response = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        query: 'food preference',
        questions: [
          { questionKey: 'q-pets', prompt: 'Should pets be allowed in the office?' },
          { questionKey: 'q-pizza', prompt: 'Which pizza topping should we choose?' },
        ],
      }),
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.source, 'ai');
  assert.deepEqual(body.results, [{ key: 'q-pizza', score: 96, rank: 1, reason: 'pizza preference' }]);
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), ['/auth/nonce', '/auth/login', '/ai']);
});

test('Mini App transcribe endpoint forwards microphone audio through the session worker', async () => {
  const kv = new MemoryKv();
  const questionId = 'q-transcribe';
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_DEPLOYMENT_ID: 'test-deploy',
    DEMO_SIGNER_ROOT_SECRET: 'test-root-secret',
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([{
      sessionSlug: 'alpha',
      questionId,
      questionType: 'freeform',
      prompt: 'Should audio comments transcribe?',
    }]),
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
        sponsoredAiAllowed: true,
        sessionWorkerUrl: 'https://session.example',
      }],
    }),
  };
  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env,
  });
  const questionKey = state.questions[0].questionKey;
  const calls = [];
  env.AGENT_BRIDGE_FETCH = async (url, init = {}) => {
    const target = String(url);
    calls.push({ url: target, init });
    if (target.endsWith('/auth/nonce')) {
      const body = JSON.parse(init.body);
      if (body.sessionSlug === 'alpha') {
        return new Response(JSON.stringify({ error: 'sessionSlug does not match worker session.' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        });
      }
      assert.equal(body.sessionSlug, undefined);
      return new Response(JSON.stringify({ nonce: 'nonce-123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.endsWith('/auth/login')) {
      const body = JSON.parse(init.body);
      assert.equal(body.sessionSlug, undefined);
      return new Response(JSON.stringify({ token: 'worker-token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.endsWith('/transcribe')) {
      assert.equal(init.headers.Authorization, 'Bearer worker-token');
      assert.equal(Object.hasOwn(init.headers, 'Origin'), false);
      assert.equal(init.body.get('model'), 'whisper-1');
      assert.equal(init.body.get('file').name, 'comment.webm');
      return new Response(JSON.stringify({ text: 'audio note' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'unexpected_url' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  };
  const form = new FormData();
  form.append('questionKey', questionKey);
  form.append('audio', new File(['audio-bytes'], 'comment.webm', { type: 'audio/webm' }));

  const response = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/transcribe', {
      method: 'POST',
      body: form,
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true, text: 'audio note' });
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), ['/auth/nonce', '/auth/nonce', '/auth/login', '/transcribe']);
});

test('Mini App transcribe endpoint accepts session-scoped AI search dictation without a question key', async () => {
  const env = {
    AGENT_BRIDGE_DEPLOYMENT_ID: 'test-deploy',
    DEMO_SIGNER_ROOT_SECRET: 'test-root-secret',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
        sponsoredAiAllowed: true,
        sessionWorkerUrl: 'https://session.example',
      }],
    }),
  };
  const calls = [];
  env.AGENT_BRIDGE_FETCH = async (url, init = {}) => {
    const target = String(url);
    calls.push({ url: target, init });
    if (target.endsWith('/auth/nonce')) {
      const body = JSON.parse(init.body);
      assert.equal(body.sessionSlug, 'alpha');
      return new Response(JSON.stringify({ nonce: 'nonce-123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.endsWith('/auth/login')) {
      const body = JSON.parse(init.body);
      assert.equal(body.sessionSlug, 'alpha');
      return new Response(JSON.stringify({ token: 'worker-token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.endsWith('/transcribe')) {
      assert.equal(init.headers.Authorization, 'Bearer worker-token');
      assert.equal(init.body.get('file').name, 'search.webm');
      return new Response(JSON.stringify({ text: 'office pets' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'unexpected_url' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  };
  const form = new FormData();
  form.append('sessionSlug', 'alpha');
  form.append('audio', new File(['audio-bytes'], 'search.webm', { type: 'audio/webm' }));

  const response = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/transcribe', {
      method: 'POST',
      body: form,
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true, text: 'office pets' });
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), ['/auth/nonce', '/auth/login', '/transcribe']);
});

test('Mini App distinguishes encrypted questions from unavailable payloads', async () => {
  const sbtAddress = '0x1111111111111111111111111111111111111111';
  const encrypted = await __test__telegramMiniApp.miniQuestionFromRecord({
    sessionSlug: 'alpha',
    question: {
      questionId: `0x${'12'.repeat(32)}`,
      questionType: 'freeform',
      visibility: 'lit_encrypted',
      encrypted: true,
      requiredSbtAddresses: [sbtAddress],
      prompt: 'Private prompt must not leak',
    },
  });
  const unavailable = await __test__telegramMiniApp.miniQuestionFromRecord({
    sessionSlug: 'alpha',
    question: {
      questionId: `0x${'34'.repeat(32)}`,
      questionType: 'unknown',
      payloadUnavailable: true,
      visibility: 'payload_unavailable',
    },
  });

  assert.equal(encrypted.title, 'Encrypted question');
  assert.equal(encrypted.encrypted, true);
  assert.equal(encrypted.payloadUnavailable, false);
  assert.equal(encrypted.canAnswer, false);
  assert.match(encrypted.lockMessage, /This question is encrypted/);
  assert.match(encrypted.lockMessage, /0x1111\.\.\.1111/);
  assert.equal(JSON.stringify(encrypted).includes('Private prompt must not leak'), false);

  assert.equal(unavailable.title, 'Question unavailable');
  assert.equal(unavailable.encrypted, false);
  assert.equal(unavailable.payloadUnavailable, true);
  assert.match(unavailable.lockMessage, /not available yet/);
});
