import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import vm from 'node:vm';
import {
  __test__telegramMiniApp,
  handleTelegramMiniAppRequest,
  validateTelegramMiniAppInitData,
} from './telegramMiniApp.mjs';
import {
  persistAnswerDraft,
  persistTelegramUserSessionBinding,
  SUBMIT_REQUEST_KV_PREFIX,
} from './telegramCommands.mjs';
import { saveTelegramAgentSettingsPatch } from './telegramAgentSettings.mjs';
import { deriveTelegramResponseExportAccount } from './telegramResponseExport.mjs';
import { submitRequestUserKvKey } from './telegramSubmitQueue.mjs';
import { persistTelegramProposedQuestion } from './telegramQuestionProposals.mjs';
import {
  materializeAgentOnlyWindow,
  saveAgentOnlyModeConfig,
  submitAgentOnlyAnswersBulk,
} from './telegramAgentOnlyMode.mjs';

class MemoryKv {
  constructor() {
    this.store = new Map();
    this.options = new Map();
  }

  async put(key, value, options = null) {
    this.store.set(key, value);
    this.options.set(key, options);
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

class StaleVoteListKv extends MemoryKv {
  async list(options = {}) {
    const listed = await super.list(options);
    if (String(options?.prefix || '').startsWith(__test__telegramMiniApp.MINI_APP_QUESTION_VOTE_KV_PREFIX)) {
      return { ...listed, keys: [] };
    }
    return listed;
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

function dotenvEscapedJson(value = {}) {
  return JSON.stringify(value).replaceAll('"', '\\"');
}

async function seedPreviewPrivateSession(env, sessionSlug = 'alpha') {
  await persistTelegramUserSessionBinding({
    env,
    normalized: {
      user: { telegramUserId: 'preview-user', username: 'preview' },
      chat: { chatId: 'preview-user', type: 'private', isPrivate: true },
    },
    session: { sessionSlug, sessionName: sessionSlug },
    source: 'test_private_chat',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
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

test('Mini App explains how to recover an expired launch', async () => {
  const botToken = '123456:test-token';
  const launch = 'cecb_1234567890';
  const initData = signInitData({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: 42, username: 'participant' }),
  }, botToken);
  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}`, {
      headers: { 'x-telegram-init-data': initData },
    }),
    env: {
      AGENT_ACTION_KV: new MemoryKv(),
      TELEGRAM_BOT_TOKEN: botToken,
      TELEGRAM_BOT_USERNAME: 'contextengineer_bot',
    },
  });

  assert.equal(state.ok, false);
  assert.equal(state.error, 'mini_app_launch_invalid');
  assert.equal(state.httpStatus, 404);
  assert.match(state.message, /send \/start/);
  assert.equal(state.launchRecovery.command, '/start');
  assert.equal(state.launchRecovery.botUrl, 'https://t.me/contextengineer_bot');
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
  const toolMenuStart = html.indexOf('<section class="toolMenu" id="toolMenu" aria-label="Mini App tools">');
  const toolMenu = toolMenuStart >= 0 ? html.slice(toolMenuStart, html.indexOf('</section>', toolMenuStart)) : '';

  assert.match(html, /<title>Context Engine<\/title>/);
  assert.equal(html.includes('<h1>Context Engine</h1>'), false);
  assert.match(html, /overflow-y: auto;/);
  assert.match(html, /touch-action: auto;/);
  assert.equal(html.includes('<h1>CE Agent</h1>'), false);
  assert.match(html, /class="headerMain"/);
  assert.match(html, /class="questionHeaderRow"[\s\S]*<div class="meta" id="meta"><span>Questions:<\/span><span class="inlineSpinner" aria-label="Loading questions"><\/span><\/div>[\s\S]*id="showFilter"[\s\S]*id="showAddQuestion"/);
  assert.match(html, /\.inlineSpinner \{[\s\S]*animation: ceSpin 0\.8s linear infinite;/);
  assert.match(html, /class="loadingProgress"/);
  assert.match(html, /setLoadingProgress/);
  assert.equal(html.includes('id="headerSessionList"'), false);
  assert.equal(html.includes('sessionHeaderRow'), false);
  assert.equal(html.includes('sessionHeaderText'), false);
  assert.equal(html.includes('sessionEditButton sessionsButton" id="showSessions"'), false);
  assert.match(html, /class="headerResultsLink resultsButton" id="showResults"[^>]*>Results<\/button>/);
  assert.match(html, /\.headerResultsLink \{[\s\S]*font-size: 19px;[\s\S]*line-height: 1\.15;/);
  assert.match(html, /id="showToolMenu"[^>]*aria-label="Open tools menu"/);
  assert.match(html, /id="toolMenu"[^>]*aria-label="Mini App tools"/);
  assert.match(toolMenu, /id="showSessions"[^>]*aria-label="Sessions"[\s\S]*<span>Sessions<\/span>/);
  assert.equal(html.includes('id="showDocuments"'), false);
  assert.match(html, /id="showAdmin"[^>]*aria-label="Admin actions"[^>]*hidden/);
  assert.equal(toolMenu.includes('<span>Documents</span>'), false);
  assert.equal(toolMenu.includes('<span>Results</span>'), false);
  assert.match(toolMenu, /<span>Groups<\/span>/);
  assert.equal(toolMenu.includes('<span>Add question</span>'), false);
  assert.equal(toolMenu.includes('<span>Filter</span>'), false);
  assert.match(toolMenu, /<span>Settings<\/span>/);
  assert.match(toolMenu, /id="showDrafts"[^>]*aria-label="Drafts"[\s\S]*<span>Drafts<\/span>/);
  assert.match(toolMenu, /id="demoDataResults"[^>]*aria-label="Demo data"[\s\S]*<span>Demo data<\/span>/);
  assert.match(toolMenu, /id="showAgentResponses"[^>]*aria-label="Agent predictions"[\s\S]*<span>Agent predictions<\/span>/);
  assert.match(html, /\.menuButton\.active \{[\s\S]*color: var\(--accent\);[\s\S]*background: rgba\(98, 255, 191, 0\.12\);/);
  assert.match(html, /\.toolMenu \.iconButton \{[\s\S]*min-height: 64px;[\s\S]*font-size: 14px;[\s\S]*line-height: 1\.15;/);
  assert.match(html, /\.toolMenu \.menuCheckbox input \{[\s\S]*accent-color: var\(--results-accent\);/);
  assert.match(html, /function setToolMenuOpen\(open\)/);
  assert.match(html, /function bindPanelClose\(closeButton, panel, button\)/);
  assert.match(html, /state\.sessionsPanelOpen/);
  assert.match(html, /scrollPanelIntoView/);
  assert.match(html, /id="showFilter"[^>]*aria-label="Filter"/);
  assert.match(html, /id="showAddQuestion"[^>]*aria-label="Add question"/);
  assert.match(html, /id="showResults"[^>]*aria-label="Results"/);
  assert.match(html, /id="showSettings"[^>]*aria-label="Settings"/);
  assert.match(html, /id="draftsPanel"[^>]*aria-label="Drafts"/);
  assert.match(html, /id="closeDrafts"[^>]*aria-label="Close drafts"/);
  assert.match(html, /id="filterPanel"[^>]*aria-label="Question filters"/);
  assert.match(html, /class="filterSubsection collapsed" id="questionTypeFilterSection"/);
  assert.match(html, /id="toggleQuestionTypeFilters"[^>]*aria-expanded="false"/);
  assert.match(html, /id="questionTypeFilters"/);
  assert.match(html, /questionTypeFiltersExpanded: false/);
  assert.match(html, /id="toggleQuestionTagFilters"[^>]*aria-expanded="false"/);
  assert.match(html, /id="questionTagFilters"/);
  assert.match(html, /questionTagFiltersExpanded: false/);
  assert.match(html, /const QUESTION_TAG_FILTER_COLLAPSED_LIMIT = 5;/);
  assert.match(html, /visibleTagEntries = state\.questionTagFiltersExpanded[\s\S]*tagEntries\.slice\(0, QUESTION_TAG_FILTER_COLLAPSED_LIMIT\);/);
  assert.match(html, /state\.questionTagFiltersExpanded = !state\.questionTagFiltersExpanded;/);
  assert.match(html, /id="filterAiSearch"/);
  assert.match(html, /class="filterSubsection collapsed" id="aiSearchFilterSection"/);
  assert.match(html, /id="toggleAiSearchFilter"[^>]*aria-expanded="false"/);
  assert.match(html, /aiSearchFilterExpanded: false/);
  assert.match(html, /id="filterAiSearchMic"[^>]*aria-label="Dictate AI search"/);
  assert.equal(html.includes('id="applyAiSearch"'), false);
  assert.match(html, /id="clearAiSearch"[^>]*hidden/);
  assert.match(html, /id="filterSummary"/);
  assert.match(html, /\.metaClearFilter/);
  assert.match(html, /function activeQuestionFilterCount\(\)/);
  assert.match(html, /function clearQuestionFilters\(\)/);
  assert.match(html, /state\.selectedQuestionTags\.clear\(\);/);
  assert.match(html, /function renderMeta\(data\)/);
  assert.match(html, /clear\.textContent = 'X';/);
  assert.match(html, /clear\.setAttribute\('aria-label', 'Clear question filters'\);/);
  assert.match(html, /return 'Questions: ' \+ filteredQuestionEntries\(\)\.length \+ '\/' \+ total;/);
  assert.match(html, /return 'Questions: ' \+ loaded \+ '\/' \+ total;/);
  assert.match(html, /return 'Questions: ' \+ total;/);
  assert.equal(html.includes("' (Filter: '"), false);
  assert.match(html, /AI search/);
  assert.match(html, /Question type/);
  assert.match(html, /function renderFilterSubsection\(section, toggle, expanded\)/);
  assert.match(html, /--filter-accent: #2cc3ff;/);
  assert.match(html, /--settings-accent: #ffd166;/);
  assert.match(html, /--pile-shadow-dark: #131532;/);
  assert.equal(html.includes('--pile-shadow-light'), false);
  assert.equal(html.includes('-7px -7px 14px'), false);
  assert.match(html, /--question-card-shadow: 7px 7px 14px var\(--pile-shadow-dark\);/);
  assert.match(html, /\.questionStack \{[\s\S]*gap: 18px;[\s\S]*min-width: 0;[\s\S]*max-width: 100%;[\s\S]*overflow-x: hidden;[\s\S]*padding: 2px 0 8px;/);
  assert.match(html, /\.loadMoreQuestions/);
  assert.match(html, /\.questionLoadingRow \{[\s\S]*justify-self: center;[\s\S]*display: inline-flex;/);
  assert.match(html, /Loading the next questions\.\.\./);
  assert.match(html, /Loading the rest in the background\.\.\./);
  assert.match(html, /Loading more questions\.\.\./);
  assert.match(html, /function loadMoreQuestions\(\)/);
  assert.match(html, /stateUrl\.searchParams\.set\('questionLimit', String\(state\.questionLimit\)\);/);
  assert.match(html, /const FAST_INITIAL_QUESTION_LIMIT = 1;/);
  assert.match(html, /const FAST_FOLLOWUP_QUESTION_COUNT = 5;/);
  assert.match(html, /const FAST_FOLLOWUP_DELAY_MS = 220;/);
  assert.match(html, /const BACKGROUND_PAGE_DELAY_MS = 650;/);
  assert.match(html, /const MAX_QUESTION_LIMIT = 500;/);
  assert.match(html, /questionLimit: FAST_INITIAL_QUESTION_LIMIT,/);
  assert.match(html, /\.agentOnlyBadgeRow\.stackedPredictionRow \{[\s\S]*display: block;[\s\S]*width: 100%;/);
  assert.match(html, /\.agentPredictionBadge\.stackedPrediction \{[\s\S]*display: grid;[\s\S]*width: min\(100%, 560px\);/);
  assert.match(html, /row\.className = 'agentOnlyBadgeRow' \+ \(stacked \? ' stackedPredictionRow' : ''\);/);
  assert.match(html, /badge\.className = 'agentPredictionBadge stackedPrediction';/);
  assert.match(html, /loadingMoreQuestions: false,/);
  assert.match(html, /backgroundQuestionLoadPending: false,/);
  assert.match(html, /autoQuestionLoadTimer: null,/);
  assert.match(html, /function shouldAutoExpandQuestions\(data\)/);
  assert.match(html, /function nextQuestionLimit\(data\)/);
  assert.match(html, /function clearAutoQuestionLoadTimer\(\)/);
  assert.match(html, /function autoQuestionLoadDelay\(data\)/);
  assert.match(html, /function scheduleAutoQuestionLoad\(data\)/);
  assert.match(html, /function backgroundQuestionLoadMessage\(\)/);
  assert.match(html, /async function load\(\{ retry = false, backgroundAuto = false \} = \{\}\)/);
  assert.match(html, /const fastFollowupLimit = FAST_INITIAL_QUESTION_LIMIT \+ FAST_FOLLOWUP_QUESTION_COUNT;/);
  assert.match(html, /if \(current <= FAST_INITIAL_QUESTION_LIMIT && fastFollowupLimit > current\) return Math\.min\(MAX_QUESTION_LIMIT, fastFollowupLimit\);/);
  assert.match(html, /if \(current < pageSize\) return Math\.min\(MAX_QUESTION_LIMIT, pageSize\);/);
  assert.match(html, /loaded < MAX_QUESTION_LIMIT/);
  assert.match(html, /return loaded <= FAST_INITIAL_QUESTION_LIMIT \? FAST_FOLLOWUP_DELAY_MS : BACKGROUND_PAGE_DELAY_MS;/);
  assert.match(html, /state\.questionLimit = current < increment \? increment : current \+ increment;/);
  assert.match(html, /if \(willAutoExpand\) scheduleAutoQuestionLoad\(body\);/);
  assert.match(html, /load\(\{ backgroundAuto: true \}\);/);
  assert.match(html, /state\.questionLimit = FAST_INITIAL_QUESTION_LIMIT;/);
  assert.match(html, /loadingProgressTimer: null,/);
  assert.match(html, /function startLoadingProgress\(/);
  assert.match(html, /<span>Loading questions and agent predictions<\/span>/);
  assert.match(html, /message: 'Loading questions and agent predictions',/);
  assert.match(html, /setLoadingProgress\('Loading questions and agent predictions', 86\);/);
  assert.equal(html.includes('class="loadingHint"'), false);
  assert.equal(html.includes('.loadingHint'), false);
  assert.equal(html.includes("note.className = 'loadingHint'"), false);
  assert.equal(html.includes("hint: 'Loading questions and agent predictions'"), false);
  assert.equal(html.includes('Loading session and agent predictions'), false);
  assert.equal(html.includes('loading the first question'), false);
  assert.equal(html.includes('Rendering the first question'), false);
  assert.match(html, /state\.loadingProgressPercent = Math\.min\(Number\(maxPercent\) \|\| 72, current \+ step\);/);
  assert.match(html, /\.card \{[\s\S]*border-radius: 20px;[\s\S]*min-width: 0;[\s\S]*max-width: 100%;[\s\S]*overflow: hidden;[\s\S]*box-shadow: var\(--question-card-shadow\);/);
  assert.match(html, /\.prompt \{[\s\S]*overflow-wrap: anywhere;[\s\S]*word-break: break-word;/);
  assert.match(html, /\.cardBody \{[\s\S]*min-width: 0;[\s\S]*max-width: 100%;/);
  assert.match(html, /\.segmented, \.choices, \.ratingTicks \{[\s\S]*min-width: 0;[\s\S]*max-width: 100%;/);
  assert.match(html, /\.choice, \.segment \{[\s\S]*min-width: 0;[\s\S]*overflow-wrap: anywhere;/);
  assert.match(html, /input\[type="range"\] \{[\s\S]*min-width: 0;[\s\S]*max-width: 100%;/);
  assert.match(html, /\.card\[data-active="true"\] \{[\s\S]*box-shadow: inset 4px 0 0 var\(--accent\), var\(--question-card-shadow\);/);
  assert.match(html, /\.card\[data-highlight="true"\] \{[\s\S]*box-shadow: inset 4px 0 0 var\(--settings-accent\), var\(--question-card-shadow\);/);
  assert.match(html, /\.filterButton\.active \{[\s\S]*background: var\(--filter-accent\);/);
  assert.match(html, /\.settingsButton\.active \{[\s\S]*background: var\(--settings-accent\);/);
  assert.match(html, /viewBox="0 0 512 512"/);
  assert.match(html, /id="sessionPicker"/);
  assert.match(html, /id="closeSessions"[^>]*aria-label="Close sessions"/);
  assert.match(html, /id="sessionSummary"/);
  assert.match(html, /const fallbackSession = state\.data\?\.session\?\.sessionSlug/);
  assert.match(html, /const hasPicker = picker\.enabled === true \|\| sessions\.length > 0 \|\| state\.sessionsPanelOpen === true;/);
  assert.match(html, /Sessions are loading\.\.\./);
  assert.equal(html.includes('id="toggleSessions"'), false);
  assert.match(html, /id="sessionPickerBody"/);
  assert.equal(html.includes('.sessionPicker.collapsed .sessionPickerBody'), false);
  assert.match(html, /<div class="sectionTitle">Sessions<\/div>/);
  assert.match(html, /id="continueSessions"/);
  assert.match(html, /id="continueSessions"[^>]*>Save<\/button>/);
  assert.equal(html.includes("el.toggleSessions.onclick"), false);
  assert.equal(html.includes('sessionPickerCollapsed'), false);
  assert.equal(html.includes('if (isOpen && picker.required !== true)'), false);
  assert.match(html, /class="status loadingStatus" id="status"/);
  assert.match(html, /class="loadingGif" src="\/telegram\/mini-app\/loading\.gif" alt="" aria-hidden="true"/);
  assert.match(html, /const LOADING_VISUAL_MODE = "gif";/);
  assert.equal(html.includes('data-loading-src="data:image/gif;base64,'), false);
  assert.match(html, /\.loadingStatus/);
  assert.match(html, /\.loadingStatus \{[\s\S]*flex-direction: column;[\s\S]*min-height: 280px;/);
  assert.match(html, /\.loadingStatus span \{[\s\S]*font-size: clamp\(22px, 5vw, 28px\);[\s\S]*font-weight: 800;/);
  assert.match(html, /\.loadingSpinner \{[\s\S]*width: min\(34vw, 112px\);[\s\S]*animation: ceSpin 0\.9s linear infinite;/);
  assert.match(html, /\.loadingGif \{[\s\S]*width: min\(68vw, 240px\);[\s\S]*height: min\(68vw, 240px\);[\s\S]*background: transparent;/);
  assert.match(html, /id="documentsPanel"[^>]*aria-label="Documents"/);
  assert.match(html, /id="toggleDocumentsPanelBody"[^>]*aria-expanded="true"/);
  assert.match(html, /id="documentsPanelBody"/);
  assert.match(html, /id="refreshDocuments"[^>]*aria-label="Refresh documents"/);
  assert.match(html, /id="closeDocuments"[^>]*aria-label="Close documents"/);
  assert.match(html, /id="documentFile"/);
  assert.match(html, /id="documentUrl"/);
  assert.match(html, /id="addDocumentUrl"/);
  assert.equal(html.includes('id="documentVisibility"'), false);
  assert.match(html, /function previewDocument\(doc, item\)/);
  assert.match(html, /\/telegram\/mini-app\/api\/documents\/preview/);
  assert.match(html, /\/telegram\/mini-app\/api\/documents/);
  assert.match(html, /documentsMessage/);
  assert.match(html, /documentsSectionOpen/);
  assert.match(html, /documentsPanel\.documentsCollapsed \.documentsPanelBody/);
  assert.match(html, /el\.toggleDocumentsPanelBody\.onclick/);
  assert.match(html, /state\.documentsMessage = 'Uploading ' \+ \(file\.name \|\| 'document'\) \+ '\.\.\.';/);
  assert.match(html, /state\.documentsMessage = 'Uploaded ' \+ \(body\.document\?\./);
  assert.match(html, /function documentUploadErrorMessage\(body, status\)/);
  assert.match(html, /document_file_too_large/);
  assert.match(html, /id="adminPanel"[^>]*aria-label="Admin actions"/);
  assert.match(html, /id="closeAdmin"[^>]*aria-label="Close admin actions"/);
  assert.match(html, /el\.showAdmin\.onclick = \(\) => \{[\s\S]*state\.sessionsPanelOpen = false;[\s\S]*renderSessionPicker\(\);[\s\S]*renderAdmin\(\);[\s\S]*setPanelOpen\(el\.adminPanel, el\.showAdmin, true\);/);
  assert.match(html, /const ADMIN_ACTION_LABELS = \{[\s\S]*export_all: 'Export data'[\s\S]*export_access: 'Manage permissions'[\s\S]*question_queue: 'Question queue'[\s\S]*group_link: 'Add group link'[\s\S]*export_allow: 'Add admin'[\s\S]*export_revoke: 'Remove admin'/);
  assert.match(html, /const DEFAULT_ADMIN_ACTION_IDS = \['export_all', 'export_access', 'results_settings', 'question_queue', 'group_link'\]/);
  assert.match(html, /function normalizeAdminActions\(adminActions = \[\]\)/);
  assert.match(html, /const remappedAccessAction = \['export_allow', 'export_revoke'\]\.includes\(actionId\);/);
  assert.match(html, /function appendAdminActionPanel\(sessionSlug\)/);
  assert.match(html, /\/telegram\/mini-app\/api\/admin\/access/);
  assert.match(html, /\/telegram\/mini-app\/api\/admin\/results-settings/);
  assert.match(html, /\/telegram\/mini-app\/api\/admin\/question-queue/);
  assert.match(html, /typeof action === 'string'/);
  assert.match(html, /button\.dataset\.action = action\.action;/);
  assert.match(html, /button\.textContent = 'Copy export command';/);
  assert.match(html, /copyAdminCommand\('\/export_all ' \+ sessionSlug, 'Export command copied\. Paste it in the CE bot\.'\)/);
  assert.equal(html.includes('Download response export'), false);
  assert.equal(html.includes("link.download = 'context-engine-'"), false);
  assert.match(html, /function appendAdminAddressList\(panel, title, entries = \[\]\)/);
  assert.match(html, /button\.className = 'adminAddressButton'/);
  assert.match(html, /heading\.textContent = title \+ ': ' \+ \(values\.length \? 'tap an address to copy\/fill' : 'None'\);/);
  assert.match(html, /Bot commands: \/export_allow ' \+ address \+ ' ' \+ sessionSlug/);
  assert.match(toolMenu, /id="showActivity"[^>]*aria-label="Activity"[\s\S]*<span>Activity<\/span>/);
  assert.match(html, /id="activityPanel"[^>]*aria-label="Activity"/);
  assert.match(html, /id="closeActivity"[^>]*aria-label="Close activity"/);
  assert.match(html, /function renderActivity\(\)/);
  assert.match(html, /\/telegram\/mini-app\/api\/activity/);
  assert.match(html, /bindPanelClose\(el\.closeActivity, el\.activityPanel, el\.showActivity\);/);
  assert.match(html, /id="showResults"[^>]*aria-label="Results"/);
  assert.match(html, /id="resultsPanel"[^>]*aria-label="Results"/);
  assert.match(html, /id="resultsTitleSession"/);
  assert.match(html, /id="resultsLoadingSpinner"[^>]*aria-label="Loading results"[^>]*hidden/);
  assert.match(html, /\.resultsTitleSession \{[\s\S]*opacity: 0\.5;/);
  assert.match(html, /class="resultsTitleRow"[\s\S]*id="showResultFilters"[^>]*aria-label="Filter results"/);
  assert.match(html, /el\.showResultFilters\.onclick = \(\) => \{[\s\S]*const open = state\.resultSectionsOpen\.filters !== true;[\s\S]*state\.resultSectionsOpen\.filters = open;[\s\S]*if \(open\) scrollPanelIntoView\(el\.resultFilters\);/);
  assert.equal(html.includes("state.resultsData.sessionName + ' | ' +"), false);
  assert.match(html, /el\.resultsSummary\.textContent = state\.resultsData\.responseCount \+ ' responses \| ' \+/);
  assert.equal(html.includes('Loading results...'), false);
  assert.match(html, /' participants' \+ filterText \+ ' \| ' \+/);
  assert.match(html, /' binary questions' \+ demoQuestionText/);
  assert.equal(html.includes('id="refreshResults"'), false);
  assert.equal(html.includes('id="resultsSessionOptions"'), false);
  assert.match(html, /id="closeResults"[^>]*aria-label="Close results"/);
  assert.equal(html.includes('id="resultViewLevels"'), false);
  assert.match(html, /id="resultFilters"[^>]*aria-label="Result filters"[^>]*hidden/);
  assert.match(html, /\.resultFilters\[hidden\] \{[\s\S]*display: none !important;/);
  assert.match(html, /id="toggleResultFilters"/);
  assert.match(html, /<span>Filter Results<\/span>/);
  assert.match(html, /class="resultFilterHeader"[\s\S]*id="toggleResultFilters"[\s\S]*id="clearResultFilters"/);
  const resultsBodyStart = html.indexOf('<div class="resultsPanelBody" id="resultsPanelBody">');
  const resultFiltersStart = html.indexOf('<section class="resultFilters', resultsBodyStart);
  const resultsBodyLead = resultsBodyStart >= 0 && resultFiltersStart > resultsBodyStart
    ? html.slice(resultsBodyStart, resultFiltersStart)
    : '';
  assert.equal(resultsBodyLead.includes('Demo data'), false);
  assert.equal(resultsBodyLead.includes('demoDataResults'), false);
  assert.match(html, /id="resultFilterOptions"/);
  assert.equal(html.includes('id="applyResultFilters"'), false);
  assert.match(html, /const DEMO_RESULTS_STORAGE_KEY = 'ce:telegram-mini-app:demo-results:v2';/);
  assert.match(html, /autoApplyResultFilters/);
  assert.match(html, /if \(key === 'filters'\) section\.hidden = !open;/);
  assert.equal(html.includes('id="toggleResultsPanelBody"'), false);
  assert.match(html, /id="moreConsensusResults"/);
  assert.match(html, /id="moreDivisiveResults"/);
  assert.match(html, /id="resultClusterControls"/);
  assert.match(html, /id="resultGroupChart"/);
  assert.match(html, /resultFilterCategoryOpen: \{\}/);
  assert.match(html, /const expanded = state\.resultFilterCategoryOpen\[categoryId\] === true;/);
  assert.match(html, /section\.className = 'groupCategory' \+ \(expanded \? '' : ' collapsed'\);/);
  assert.match(html, /state\.resultFilterCategoryOpen\[categoryId\] = !expanded;/);
  assert.equal(html.includes('id="refreshGroups"'), false);
  assert.match(html, /\.panelIconButton/);
  assert.match(html, /\.panelCloseButton/);
  assert.match(html, /id="closeGroups"[^>]*aria-label="Close groups"/);
  assert.match(html, /id="closeAddQuestion"[^>]*aria-label="Close add question"/);
  assert.match(html, /id="closeFilter"[^>]*aria-label="Close filters"/);
  assert.match(html, /id="closeSettings"[^>]*aria-label="Close settings"/);
  assert.match(html, /id="topicPreferences"/);
  assert.match(html, /id="demographicLinkOptIn"/);
  assert.match(html, /id="attendanceLinkOptIn"/);
  assert.match(html, /id="draftDivergenceOptIn"/);
  assert.match(html, /bindPanelClose\(el\.closeResults, el\.resultsPanel, el\.showResults\);/);
  assert.equal(html.includes('state.resultSectionsOpen.panel'), false);
  assert.match(html, /if \(el\.showDocuments\) \{/);
  assert.equal(html.includes('>Refresh</button>'), false);
  assert.equal(html.includes('Result images'), false);
  assert.equal(html.includes('id="renderConsensusImage"'), false);
  assert.equal(html.includes('id="renderGroupImage"'), false);
  assert.equal(html.includes('id="resultImagePreview"'), false);
  assert.match(html, /id="toggleConsensusSection"/);
  assert.match(html, /id="toggleDivisiveSection"/);
  assert.match(html, /id="divisiveSection"[\s\S]*id="consensusSection"/);
  assert.match(html, /resultSectionsOpen: \{[\s\S]*consensus: false,[\s\S]*divisive: true,/);
  assert.match(html, /id="toggleResultGroupsSection"/);
  assert.match(html, /id="toggleGroupAnalysisSection"/);
  assert.match(html, /id="resultGroupsSection"[\s\S]*id="groupAnalysisSection"/);
  assert.match(html, /function renderResultGroups\(groups\)[\s\S]*el\.resultClusterControls\.innerHTML = '';[\s\S]*el\.resultGroupChart\.innerHTML = '';[\s\S]*el\.groupAnalysisSection\.hidden = true;/);
  assert.match(html, /if \(state\.resultsData\?\.groupView\?\.enabled === false\) \{[\s\S]*el\.resultGroupsSection\.hidden = true;[\s\S]*return;[\s\S]*\}/);
  assert.match(html, /const RESULT_GROUP_COUNT = 2;/);
  assert.match(html, /const visibleGroups = groups\.slice\(0, RESULT_GROUP_COUNT\);[\s\S]*if \(!visibleGroups\.length\) \{[\s\S]*appendEmptyResult\(el\.resultGroups, 'Not enough participant response data for groups yet\.'\);[\s\S]*return;[\s\S]*\}[\s\S]*renderResultGroupChart\(visibleGroups\);[\s\S]*el\.groupAnalysisSection\.hidden = false;[\s\S]*visibleGroups\.forEach/);
  assert.match(html, /function appendLoadingResult\(mount, message\)/);
  assert.match(html, /if \(state\.resultsLoading === true && !topicMap\) \{[\s\S]*appendLoadingResult\(el\.topicMapChart, 'Loading topic map\.\.\.'\);[\s\S]*return;[\s\S]*\}/);
  assert.match(html, /resultsCache: new Map\(\)/);
  assert.match(html, /function loadResults\(\{ force = false \} = \{\}\) \{[\s\S]*const cacheKey = currentResultsCacheKey\(\);[\s\S]*state\.resultsCache\.set\(cacheKey, nextData\);/);
  assert.match(html, /function setResultsDemoData\(value\) \{[\s\S]*restoreCachedResults\(\);[\s\S]*loadResults\(\{ force: true \}\);/);
  assert.equal(html.includes('function setResultsDemoData(value) {\n      state.resultsDemoData = value === true;\n      writeDemoResults(state.resultsDemoData);\n      resetResultsForSelection();'), false);
  assert.match(html, /id="consensusResults"/);
  assert.match(html, /id="divisiveResults"/);
  assert.match(html, /id="resultGroups"/);
  assert.match(html, /Analyze ' \+ group\.label/);
  assert.match(html, /Analyzing ' \+ group\.label \+ '\.\.\. ' \+ elapsedSeconds \+ 's elapsed'/);
  assert.match(html, /function resultClusterOptionCounts\(\)[\s\S]*state\.resultClusterCount = RESULT_GROUP_COUNT;[\s\S]*return \[\];/);
  assert.equal(html.includes("label.textContent = 'Clusters';"), false);
  assert.match(html, /className = 'resultRow groupAnalysisResult'/);
  assert.match(html, /categoryId === 'contribution_role' && selected\.has\('other'\)/);
  assert.match(html, /fieldLabel\.textContent = 'Other role'/);
  assert.match(html, /save\.textContent = 'Save'/);
  assert.match(html, /font-size: 14px;/);
  assert.match(html, /function startGroupAnalysisProgressTimer\(\)/);
  assert.match(html, /state\.resultSectionsOpen\.groups = true;[\s\S]*state\.resultSectionsOpen\.groupAnalysis = true;[\s\S]*renderResults\(\);[\s\S]*scrollPanelIntoView\(el\.groupAnalysisSection\);/);
  assert.match(html, /\.distributionBar/);
  assert.match(html, /min-height: 16px;/);
  assert.match(html, /\.distributionRow/);
  assert.match(html, /totalLabel\.textContent = String\(Number\(row\.total \|\| 0\)\);/);
  assert.match(html, /\/telegram\/mini-app\/api\/results/);
  assert.match(html, /function renderResults\(\)/);
  assert.match(html, /function analyzeResultGroup\(groupId\)/);
  assert.match(html, /group\.label \+ ': ' \+ analysisName/);
  assert.match(html, /function renderResultGroupChart\(groups\)/);
  assert.equal(html.includes('id="groupsPicker"'), false);
  assert.equal(html.includes('function renderGroupsPicker()'), false);
  assert.match(html, /id="filterUnansweredFirst"/);
  assert.match(html, /id="filterTopPopular"/);
  assert.match(html, /Top popular questions/);
  assert.match(html, /class="topPopularInline"[\s\S]*Top popular questions[\s\S]*id="filterTopPopularLimit"/);
  assert.match(html, /id="filterTopPopularLimit"[^>]*type="number"[^>]*min="2"[^>]*max="50"[^>]*step="2"[^>]*value="10"/);
  assert.match(html, /id="decrementTopPopular"[^>]*aria-label="Show two fewer popular questions"[^>]*>-<\/button>/);
  assert.match(html, /id="incrementTopPopular"[^>]*aria-label="Show two more popular questions"[^>]*>\+<\/button>/);
  assert.equal(html.includes('Top N'), false);
  assert.match(html, /popularQuestionsOnly/);
  assert.match(html, /popularQuestionLimit: POPULAR_QUESTION_LIMIT_DEFAULT/);
  assert.match(html, /const POPULAR_QUESTION_LIMIT_STEP = 2;/);
  assert.match(html, /function clearQuestionFilters\(\)[\s\S]*state\.popularQuestionLimit = POPULAR_QUESTION_LIMIT_DEFAULT;/);
  assert.match(html, /function renderFilters\(\)[\s\S]*el\.filterTopPopularLimit\.value = String\(state\.popularQuestionLimit\);/);
  assert.match(html, /entries\.sort\(popularitySort\)\.slice\(0, normalizePopularQuestionLimit\(state\.popularQuestionLimit\)\)/);
  assert.match(html, /Temporary linear popularity score; replace with weighted\/decayed scoring once we have enough signal\./);
  assert.match(html, /return voteSummaryForQuestion\(question\)\.score \+ responseCountForQuestion\(question\);/);
  assert.match(html, /responseCountForQuestion\(right\.question\) - responseCountForQuestion\(left\.question\)/);
  assert.match(html, /el\.filterTopPopularLimit\.onchange = \(\) => setPopularQuestionLimit\(el\.filterTopPopularLimit\.value, \{ enable: true \}\);/);
  assert.match(html, /el\.decrementTopPopular\.onclick = \(\) => setPopularQuestionLimit\(state\.popularQuestionLimit - POPULAR_QUESTION_LIMIT_STEP, \{ enable: true \}\);/);
  assert.match(html, /el\.incrementTopPopular\.onclick = \(\) => setPopularQuestionLimit\(state\.popularQuestionLimit \+ POPULAR_QUESTION_LIMIT_STEP, \{ enable: true \}\);/);
  assert.equal(html.includes('Top 10 popular questions'), false);
  assert.equal(html.includes('slice(0, 10)'), false);
  assert.match(html, /function submitQuestionVote\(question, vote, triggerButton = null\)/);
  assert.match(html, /\/telegram\/mini-app\/api\/question-vote/);
  assert.match(html, /\.questionVotes/);
  assert.match(html, /\.questionVoteRow/);
  assert.match(html, /grid-template-columns: 30px minmax\(28px, auto\) 30px;/);
  assert.equal(html.includes('.agentOnlyVotes'), false);
  assert.equal(html.includes('.agentOnlyBudget'), false);
  assert.equal(html.includes('function renderAgentOnlyVoteControls'), false);
  assert.equal(html.includes('function submitAgentOnlyHumanVote'), false);
  assert.equal(html.includes("fetch('/telegram/mini-app/api/agent-only/token-votes'"), false);
  assert.equal(html.includes("agentVoteRow.className = 'questionVoteRow expandedOnly';"), false);
  assert.match(html, /\.voteButton \{[\s\S]*border: 0;[\s\S]*background: transparent;/);
  assert.match(html, /\.voteButton\.up \{[\s\S]*color: var\(--ok\);/);
  assert.match(html, /\.voteButton\.down \{[\s\S]*color: var\(--danger\);/);
  assert.match(html, /\.voteScore\.positive \{ color: var\(--ok\); \}/);
  assert.match(html, /\.voteScore\.negative \{ color: var\(--danger\); \}/);
  assert.match(html, /const VOTE_UP_ICON = '<span class="voteGlyph" aria-hidden="true">\+<\/span>';/);
  assert.match(html, /const VOTE_DOWN_ICON = '<span class="voteGlyph" aria-hidden="true">-<\/span>';/);
  assert.match(html, /\.voteGlyph \{[\s\S]*font-size: 22px;[\s\S]*font-weight: 900;/);
  assert.match(html, /head\.append\(headText, toggle\);/);
  assert.match(html, /voteRow\.className = 'questionVoteRow expandedOnly';/);
  assert.match(html, /voteRow\.appendChild\(renderQuestionVoteControls\(question\)\);/);
  assert.match(html, /score\.className = 'voteScore' \+ \(summary\.score > 0 \? ' positive' : \(summary\.score < 0 \? ' negative' : ''\)\);/);
  assert.match(html, /score\.textContent = String\(summary\.score\);/);
  assert.match(html, /wrap\.append\(makeButton\('down', VOTE_DOWN_ICON, 'Downvote question'\), score, makeButton\('up', VOTE_UP_ICON, 'Upvote question'\)\);/);
  assert.equal(html.includes("wrap.append(makeButton('up', VOTE_UP_ICON, 'Upvote question'), score, makeButton('down', VOTE_DOWN_ICON, 'Downvote question'));"), false);
  assert.match(html, /\.voteButton\.active/);
  assert.equal(html.includes("setStatus('Saving vote...');"), false);
  assert.equal(html.includes("setStatus('Vote saved.', 'ok');"), false);
  assert.equal(html.includes("setStatus('Submitted.', 'ok');"), false);
  assert.equal(html.includes('id="showUnansweredFirst"'), false);
  assert.match(html, /Show un-answered questions first/);
  assert.equal(html.includes('Question reminders'), false);
  assert.equal(html.includes('telegramReminders'), false);
  assert.equal(html.includes('<span>Reminders</span>'), false);
  assert.match(html, /id="clearDrafts"/);
  assert.match(html, /Clear drafts/);
  assert.match(html, /id="submitDrafts"/);
  assert.match(html, /Submit drafts/);
  assert.match(html, /\.draftActions/);
  assert.equal(html.includes('id="showSettings" type="button">Settings</button>'), false);
  assert.equal(html.includes('<footer>'), false);
  assert.equal(html.includes('footer {'), false);
  assert.equal(html.includes('id="save"'), false);
  assert.equal(html.includes('id="submit"'), false);
  assert.match(html, /\.cardActions \{[\s\S]*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(html, /\.cardActions\[hidden\] \{ display: none; \}/);
  assert.match(html, /\.submitButton \{[\s\S]*border-color: rgba\(255, 255, 255, 0\.82\);[\s\S]*background: transparent;[\s\S]*color: var\(--text\);/);
  assert.match(html, /\.submitButton\.submittedCheck \{[\s\S]*border-color: var\(--ok\);[\s\S]*background: transparent;[\s\S]*color: var\(--ok\);/);
  assert.match(html, /const shouldShowAnswerActions = \(question\) => \{/);
  assert.match(html, /actions\.hidden = !\(shouldShowAnswerActions\(question\) \|\| seriesModeEnabled\(\)\);/);
  assert.match(html, /const questionSeriesState = \(\) => state\.data\?\.questionSeries \|\| \{\};/);
  assert.match(html, /function renderQuestionStack\(\)[\s\S]*const questions = orderedQuestions\(\);/);
  assert.match(html, /skip\.textContent = 'Skip';/);
  assert.match(html, /advanceSeriesQuestion\(question, \{ skip: true \}\);/);
  assert.equal(html.includes('Save Draft'), false);
  assert.equal(html.includes('saveDraftButton'), false);
  assert.match(html, /const DRAFT_AUTOSAVE_DELAY_MS = 700;/);
  assert.match(html, /draftAutosaveTimers: new Map\(\)/);
  assert.match(html, /function selectValue\(question, value\)[\s\S]*scheduleDraftAutosave\(question\);/);
  assert.match(html, /function toggleChoice\(question, option, single\)[\s\S]*scheduleDraftAutosave\(question\);/);
  assert.match(html, /const scheduleDraftAutosave = \(question\) => \{[\s\S]*sendAnswer\(false, question, null, \{[\s\S]*suppressStatus: true,[\s\S]*autoSave: true,[\s\S]*autoSaveVersion: version,/);
  assert.match(html, /clearDraftAutosave\(question\);[\s\S]*bumpDraftAutosaveVersion\(question\);[\s\S]*setSubmitBusy\(true, triggerButton, question\);/);
  assert.match(html, /if \([\s\S]*autoSave[\s\S]*autoSaveVersion[\s\S]*state\.draftAutosaveVersions\.get\(question\.questionKey\) !== autoSaveVersion[\s\S]*\) \{[\s\S]*return true;/);
  assert.match(html, /const syncQuestionCardExpanded = \(question, expanded\) => \{/);
  assert.match(html, /card\.classList\.toggle\('collapsed', !expanded\);/);
  assert.match(html, /if \(!syncQuestionCardExpanded\(question, expanded\)\) renderQuestionStack\(\);/);
  assert.match(html, /\.cardHead \{[\s\S]*border-bottom: 0;/);
  assert.equal(html.includes('.card:not(.collapsed) .cardHead { border-bottom'), false);
  assert.match(html, /\.commentsSection \{[\s\S]*border-top: 1px solid var\(--line\);[\s\S]*padding-top: 12px;[\s\S]*margin-top: 12px;/);
  assert.match(html, /renderAnswerControls\(question, body, \{ showComments: true \}\);/);
  assert.match(html, /id="savedDrafts"/);
  assert.match(html, /Submitted responses/);
  const settingsStart = html.indexOf('<section class="settingsPanel" id="settingsPanel" aria-label="Agent settings">');
  const settingsSection = settingsStart >= 0 ? html.slice(settingsStart, html.indexOf('</section>', settingsStart)) : '';
  const draftsStart = html.indexOf('<section class="draftsPanel" id="draftsPanel" aria-label="Drafts">');
  const draftsSection = draftsStart >= 0 ? html.slice(draftsStart, html.indexOf('</section>', draftsStart)) : '';
  assert.equal(settingsSection.includes('id="savedDrafts"'), false);
  assert.equal(settingsSection.includes('id="showAgentResponses"'), false);
  assert.equal(settingsSection.includes('Show agent responses'), false);
  assert.match(draftsSection, /id="savedDrafts"/);
  assert.match(draftsSection, /id="submitDrafts"/);
  assert.match(draftsSection, /id="clearDrafts"/);
  assert.equal(html.includes('Submitted answer: '), false);
  assert.equal(html.includes('.answerBadge'), false);
  assert.match(html, /el\.submitDrafts\.disabled = savedDrafts\.length === 0 \|\| state\.submitDraftsBusy;/);
  assert.match(html, /state\.submitDraftsMessage \|\| 'Submit drafts'/);
  assert.match(html, /function submitSavedDrafts\(\)/);
  assert.match(html, /sendAnswer\(true, question, null, \{ suppressStatus: true \}\)/);
  assert.match(html, /state\.submitDraftsMessage = submittedCount[\s\S]*: 'Could not submit drafts';/);
  assert.equal(html.includes("setStatus('Could not submit drafts"), false);
  assert.match(html, /el\.submitDrafts\.onclick = \(\) => submitSavedDrafts\(\);/);
  assert.match(html, /state\.data\.savedDrafts = drafts[\s\S]*\.filter\(\(draft\) => draft\.questionKey !== question\.questionKey\)[\s\S]*\.concat\(savedDraftEntry\);/);
  assert.match(html, /\.agentPredictionChoice \{[\s\S]*min-height: 42px;[\s\S]*font-size: 20px;/);
  assert.match(html, /label\.className = 'agentPredictionLabel';/);
  assert.match(html, /value\.className = 'agentPredictionValue';/);
  assert.equal(html.includes("edit.textContent = 'Edit';"), false);
  assert.equal(html.includes('agentPredictionConfirm'), false);
  assert.equal(html.includes('function editAgentPrediction'), false);
  assert.equal(html.includes('confirmAgentPrediction(question, confirm)'), false);
  assert.equal(html.includes('confirmAgentPrediction({ questionKey: answer.questionKey }'), false);
  assert.equal(html.includes("confirm.textContent = 'Confirm';"), false);
  assert.match(html, /submittedAnswersByQuestionKey/);
  assert.match(html, /answerHasContent/);
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
  assert.match(html, /<div class="headerMain">[\s\S]*<div class="meta" id="meta"><span>Questions:<\/span><span class="inlineSpinner" aria-label="Loading questions"><\/span><\/div>[\s\S]*id="showResults"[\s\S]*<section class="toolMenu" id="toolMenu" aria-label="Mini App tools">[\s\S]*<section class="sessionPicker" id="sessionPicker" aria-label="Sessions">/);
  assert.equal(/<section class="sessionPicker" id="sessionPicker" aria-label="Sessions">[\s\S]*<div class="meta" id="meta">/.test(html), false);
  assert.match(html, /<section class="layout">\s*<section class="questionStack" id="questionStack" aria-label="Questions"><\/section>\s*<\/section>/);
  assert.match(html, /startCommentDictation/);
  assert.match(html, /startAnswerDictation/);
  assert.match(html, /startSearchDictation/);
  assert.match(html, /input\.placeholder = 'Response here';/);
  assert.equal(html.includes('Type your response'), false);
  assert.match(html, /\.freeformAnswerBox textarea,[\s\S]*\.freeformAnswerBox \.micButton \{[\s\S]*min-height: 52px;/);
  assert.match(html, /Dictate answer/);
  assert.match(html, /Dictate additional comments/);
  assert.match(html, /Dictate AI search/);
  assert.match(html, /const MIC_ICON = '<svg/);
  assert.match(html, /const STOP_ICON = '<svg/);
  assert.match(html, /const CHECK_ICON = '<svg/);
  assert.match(html, /\.micButton \{[\s\S]*border: 0;[\s\S]*background: transparent;/);
  assert.match(html, /\.commentActions \.micButton svg \{[\s\S]*width: 30px;[\s\S]*height: 30px;/);
  assert.match(html, /\.submitButton\.submittedCheck/);
  assert.match(html, /Transcribing microphone audio/);
  assert.match(html, /Transcribing search audio/);
  assert.match(html, /function startMicProgressTimer\(baseMessage, setFeedback\)/);
  assert.match(html, /setFeedback\(baseMessage \+ ' ' \+ elapsedSeconds \+ 's elapsed'\);/);
  assert.match(html, /activeMicProgressTimer = window\.setInterval\(update, 1000\);/);
  assert.match(html, /function stopMicProgressTimer\(\)/);
  assert.match(html, /startAnswerTranscriptionProgress\(question, textarea\)/);
  assert.match(html, /startCommentTranscriptionProgress\(question, textarea\)/);
  assert.match(html, /startSearchTranscriptionProgress\(\)/);
  assert.match(html, /function setCommentMicFeedback/);
  assert.match(html, /function setAnswerMicFeedback/);
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
  assert.match(html, /function setSubmitBusy\(isBusy, triggerButton = null, question = activeQuestion\(\)\)/);
  assert.match(html, /applySubmitButtonState\(button, question, \{ busy: isBusy \}\);/);
  assert.match(html, /currentAnswerMatchesSubmitted/);
  assert.match(html, /refreshQuestionSubmitButton\(question, input\);/);
  assert.match(html, /refreshQuestionSubmitButton\(question, comments\);/);
  assert.match(html, /if \(currentAnswerMatchesSubmitted\(question\)\) return;/);
  assert.match(html, /const ANSWER_CHANGE_SUBMIT_GUARD_MS = 900;/);
  assert.match(html, /answerChangedAtByQuestionKey: new Map\(\)/);
  assert.match(html, /function markAnswerChanged\(question\)/);
  assert.match(html, /answerChangeGuardActive\(question\)/);
  assert.match(html, /Review answer before submitting/);
  assert.match(html, /if \(answerChangeGuardActive\(question\)\) return;/);
  assert.match(html, /markAnswerChanged\(question\);[\s\S]*renderQuestionStack\(\);[\s\S]*scheduleDraftAutosave\(question\);/);
  assert.equal(html.includes('state.savedDraftKeys.has(question?.questionKey)'), false);
  assert.match(html, /id="filterAnsweredOnly"/);
  assert.match(html, /state\.answeredQuestionsOnly && !questionAnswered\(question\)/);
  assert.match(html, /state\.answeredQuestionsOnly = el\.filterAnsweredOnly\.checked;/);
  assert.match(html, /answered only/);
  assert.match(html, /MINI_APP_LAUNCH_RECOVERY_MESSAGE/);
  assert.match(html, /const userFacingErrorMessage =/);
  assert.match(html, /body\?\.error === 'mini_app_launch_invalid'/);
  assert.match(html, /const QUESTION_RETRY_DELAY_MS = 4000;/);
  assert.match(html, /SHOW_UNANSWERED_STORAGE_KEY/);
  assert.match(html, /function renderSessionPicker\(\)/);
  assert.match(html, /const orderedQuestions = \(\) => \{/);
  assert.match(html, /const questionHasAgentPrediction = \(question\) => \{/);
  assert.match(html, /state\.data\?\.agentOnly\?\.predictions\?\.\[question\.questionKey\]/);
  assert.match(html, /right\.score - left\.score \|\|[\s\S]*predictionPrioritySort\(left, right\)/);
  assert.match(html, /predictionPrioritySort\(left, right\) \|\|[\s\S]*Number\(questionAnswered\(left\.question\)\) - Number\(questionAnswered\(right\.question\)\)/);
  assert.match(html, /\/telegram\/mini-app\/api\/search/);
  assert.match(html, /function scheduleAiSearch/);
  assert.match(html, /state\.aiSearchQuery = state\.aiDraftQuery\.trim\(\);[\s\S]*scheduleAiSearch\(\);/);
  assert.match(html, /const answerableCount = questions\.filter\(\(question\) => question\?\.canAnswer\)\.length;/);
  assert.match(html, /const unavailableCount = questions\.filter\(\(question\) => question\?\.payloadUnavailable === true\)\.length;/);
  assert.match(html, /function questionCountText\(data\)/);
  assert.match(html, /const total = Number\(data\?\.questionCount \?\? data\?\.availableQuestionCount \?\? 0\) \|\| 0;/);
  assert.match(html, /\.questionHeaderRow \.headerIconButton \{[\s\S]*width: 36px;[\s\S]*height: 36px;[\s\S]*min-width: 36px;[\s\S]*min-height: 36px;/);
  assert.match(html, /\.questionHeaderRow \.headerIconButton svg \{[\s\S]*width: 22px;[\s\S]*height: 22px;/);
  assert.match(html, /\.questionHeaderRow \.headerIconButton,[\s\S]*\.questionHeaderRow \.headerIconButton\.active,[\s\S]*\.questionHeaderRow \.headerIconButton:active \{[\s\S]*border: 0;[\s\S]*background: transparent;[\s\S]*box-shadow: none;/);
  assert.match(html, /answerableCount === 0 && \(/);
  assert.match(html, /unavailableCount > 0/);
  assert.match(html, /window\.setTimeout\(\(\) => \{[\s\S]*load\(\{ retry: true \}\);[\s\S]*\}, QUESTION_RETRY_DELAY_MS\);/);
});

test('Mini App inline scripts remain parseable by browsers', () => {
  const html = __test__telegramMiniApp.telegramMiniAppHtml();
  const scripts = Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi))
    .map((match) => match[1]);

  assert.equal(scripts.length > 0, true);
  for (const script of scripts) {
    assert.doesNotThrow(() => new Function(script));
  }
  assert.equal(html.includes('.split(/[\\n,;|]+/)'), true);
});

test('Mini App inline boot script reaches control binding without runtime initialization errors', () => {
  const html = __test__telegramMiniApp.telegramMiniAppHtml();
  const script = Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi))
    .map((match) => match[1])
    .join('\n');
  const elements = new Map();
  const makeElement = (id = '') => {
    const classes = new Set();
    return {
      id,
      dataset: {},
      style: { setProperty() {} },
      classList: {
        add: (...names) => names.forEach((name) => classes.add(name)),
        remove: (...names) => names.forEach((name) => classes.delete(name)),
        toggle: (name, force) => {
          const enabled = force === undefined ? !classes.has(name) : Boolean(force);
          if (enabled) classes.add(name);
          else classes.delete(name);
          return enabled;
        },
        contains: (name) => classes.has(name),
      },
      appendChild() {},
      prepend() {},
      replaceChildren() {},
      setAttribute() {},
      removeAttribute() {},
      addEventListener() {},
      scrollIntoView() {},
      focus() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      innerHTML: '',
      textContent: '',
      value: '',
      checked: false,
      hidden: id === 'showAdmin',
      disabled: false,
    };
  };
  const document = {
    documentElement: { style: { setProperty() {} } },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    createElement(tagName) {
      return makeElement(tagName);
    },
    createTextNode(text) {
      return { textContent: String(text || '') };
    },
  };
  const sandbox = {
    window: {
      Telegram: null,
      localStorage: {
        getItem() { return null; },
        setItem() {},
      },
      setTimeout() { return 1; },
      clearTimeout() {},
    },
    document,
    location: { origin: 'https://bridge.example', search: '?launch=test-launch' },
    URL,
    URLSearchParams,
    Map,
    Set,
    Number,
    String,
    Array,
    Object,
    JSON,
    Math,
    Date,
    RegExp,
    Promise,
    Blob,
    FormData,
    fetch: () => new Promise(() => {}),
    setTimeout() { return 1; },
    clearTimeout() {},
    console,
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = document;
  sandbox.window.location = sandbox.location;

  assert.doesNotThrow(() => vm.runInNewContext(script, sandbox, { timeout: 1000 }));
  assert.equal(typeof elements.get('showToolMenu')?.onclick, 'function');
  assert.equal(typeof elements.get('showFilter')?.onclick, 'function');
  assert.equal(typeof elements.get('showAddQuestion')?.onclick, 'function');
});

test('Mini App admin menu action opens a visible admin panel above the session picker', async () => {
  const html = __test__telegramMiniApp.telegramMiniAppHtml();
  const script = Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi))
    .map((match) => match[1])
    .join('\n');
  const elements = new Map();
  const makeElement = (id = '') => {
    const classes = new Set();
    const attributes = new Map();
    const element = {
      id,
      dataset: {},
      style: { setProperty() {} },
      children: [],
      classList: {
        add: (...names) => names.forEach((name) => classes.add(name)),
        remove: (...names) => names.forEach((name) => classes.delete(name)),
        toggle: (name, force) => {
          const enabled = force === undefined ? !classes.has(name) : Boolean(force);
          if (enabled) classes.add(name);
          else classes.delete(name);
          return enabled;
        },
        contains: (name) => classes.has(name),
      },
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      append(...nodes) {
        nodes.forEach((node) => this.appendChild(node));
      },
      prepend(...nodes) {
        this.children.unshift(...nodes);
      },
      replaceChildren(...nodes) {
        this.children = [...nodes];
      },
      setAttribute(name, value) {
        attributes.set(name, String(value));
      },
      getAttribute(name) {
        return attributes.get(name) || null;
      },
      removeAttribute(name) {
        attributes.delete(name);
      },
      addEventListener(type, handler) {
        this[`on${type}`] = handler;
      },
      scrollIntoView() {
        this.scrolled = true;
      },
      focus() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      textContent: '',
      value: '',
      checked: false,
      hidden: false,
      disabled: false,
      scrolled: false,
    };
    Object.defineProperty(element, 'innerHTML', {
      get() {
        return this._innerHTML || '';
      },
      set(value) {
        this._innerHTML = String(value || '');
        this.children = [];
      },
    });
    return element;
  };
  const document = {
    documentElement: { style: { setProperty() {} } },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    createElement(tagName) {
      return makeElement(tagName);
    },
    createTextNode(text) {
      return { textContent: String(text || '') };
    },
  };
  const stateBody = {
    ok: true,
    session: { sessionSlug: 'alpha', title: 'Alpha' },
    sessionPicker: {
      enabled: true,
      required: false,
      selectedSessionSlugs: ['alpha'],
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', selected: true }],
    },
    selectedSessionSlugs: ['alpha'],
    groups: { sessionSlug: 'alpha', categories: [], userSelections: {}, selectedCount: 0 },
    questions: [],
    questionCount: 1,
    availableQuestionCount: 1,
    unavailableQuestionCount: 0,
    lockedQuestionCount: 0,
    sourceOk: true,
    admin: {
      available: true,
      canManage: true,
      sessionSlug: 'alpha',
      accountAddressShort: '0x1234...abcd',
      actions: [
        { action: 'export_all', label: 'Export data' },
        { action: 'export_access', label: 'Manage permissions' },
        { action: 'export_allow', label: 'Add admin' },
      ],
    },
    savedDrafts: [],
    submittedAnswers: [],
    submittedAnswerKeys: [],
    draftAnswersByQuestionKey: {},
  };
  const sandbox = {
    window: {
      Telegram: null,
      localStorage: {
        getItem() { return null; },
        setItem() {},
      },
      setTimeout(callback) {
        if (typeof callback === 'function') callback();
        return 1;
      },
      clearTimeout() {},
      requestAnimationFrame(callback) {
        if (typeof callback === 'function') callback();
        return 1;
      },
    },
    document,
    location: { origin: 'https://bridge.example', search: '?launch=test-launch' },
    URL,
    URLSearchParams,
    Map,
    Set,
    Number,
    String,
    Array,
    Object,
    JSON,
    Math,
    Date,
    RegExp,
    Promise,
    Blob,
    FormData,
    fetch: async () => ({
      ok: true,
      json: async () => stateBody,
    }),
    setTimeout(callback) {
      if (typeof callback === 'function') callback();
      return 1;
    },
    clearTimeout() {},
    console,
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = document;
  sandbox.window.location = sandbox.location;
  sandbox.window.fetch = sandbox.fetch;

  vm.runInNewContext(script, sandbox, { timeout: 1000 });
  for (let index = 0; index < 5; index += 1) await Promise.resolve();

  assert.equal(elements.get('showAdmin').hidden, false);
  elements.get('sessionPicker').classList.add('open');
  elements.get('showSessions').classList.add('active');
  assert.equal(elements.get('sessionPicker').classList.contains('open'), true);

  elements.get('showAdmin').onclick();

  assert.equal(elements.get('sessionPicker').classList.contains('open'), false);
  assert.equal(elements.get('adminPanel').classList.contains('open'), true);
  assert.equal(elements.get('showAdmin').classList.contains('active'), true);
  assert.equal(elements.get('showAdmin').getAttribute('aria-expanded'), 'true');
  assert.equal(elements.get('adminSummary').textContent.length > 0, true);
});

test('Mini App defaults to loading GIF and keeps CSS spinner test option', async () => {
  const defaultResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app'),
    env: {},
  });
  const defaultHtml = await defaultResponse.text();
  assert.equal(defaultResponse.status, 200);
  assert.match(defaultHtml, /<img class="loadingGif" src="\/telegram\/mini-app\/loading\.gif" alt="" aria-hidden="true">/);
  assert.match(defaultHtml, /const LOADING_VISUAL_MODE = "gif";/);
  assert.equal(defaultHtml.includes('class="loadingSpinner" aria-hidden="true"'), false);

  const spinnerResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app?loading=spinner'),
    env: {},
  });
  const spinnerHtml = await spinnerResponse.text();
  assert.equal(spinnerResponse.status, 200);
  assert.match(spinnerHtml, /class="loadingSpinner" aria-hidden="true"/);
  assert.match(spinnerHtml, /const LOADING_VISUAL_MODE = "spinner";/);
  assert.equal(spinnerHtml.includes('<img class="loadingGif" src="/telegram/mini-app/loading.gif"'), false);

  const envSpinnerResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app'),
    env: { AGENT_BRIDGE_MINI_APP_LOADING_VISUAL: 'spinner' },
  });
  const envSpinnerHtml = await envSpinnerResponse.text();
  assert.equal(envSpinnerResponse.status, 200);
  assert.match(envSpinnerHtml, /class="loadingSpinner" aria-hidden="true"/);
});

test('Mini App loading GIF route serves image bytes for Telegram WebView', async () => {
  const response = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/loading.gif'),
    env: {},
  });
  const bytes = new Uint8Array(await response.arrayBuffer());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/gif');
  assert.equal(response.headers.get('x-ce-asset-source'), 'embedded-public-loading-asset');
  assert.equal(response.headers.get('x-ce-asset-size'), '220x220');
  assert.equal(new TextDecoder().decode(bytes.slice(0, 6)), 'GIF89a');
  assert.equal(bytes.length > 700000, true);
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
        { sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true },
        { sessionSlug: 'e2e-spam', sessionName: 'E2E Spam', telegramBridgeEnabled: true, telegramOnly: true },
        { sessionSlug: 'hidden', sessionName: 'Hidden', telegramBridgeEnabled: false },
        { sessionSlug: 'beta', sessionName: 'Beta', telegramBridgeEnabled: true, telegramOnly: true },
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

test('Mini App question state defaults to 50 questions and supports loading more', async () => {
  const kv = new MemoryKv();
  const launch = 'cecb_page1234';
  await kv.put(`telegram:action:${launch}`, JSON.stringify({
    type: 'agent_bridge_opaque_action',
    actionId: launch,
    action: 'view_questions',
    lane: 'telegram_mini_app',
    miniAppLaunch: true,
    serverContextRef: { sessionPicker: true },
  }));
  const questions = Array.from({ length: 55 }, (_, index) => ({
    sessionSlug: 'alpha',
    questionId: `q-${String(index + 1).padStart(2, '0')}`,
    questionType: 'freeform',
    prompt: `Prompt ${index + 1}`,
    tags: index < 5 ? ['organizer'] : ['general'],
  }));
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify(questions),
  };

  const fastInitial = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}&sessions=alpha&questionLimit=1`),
    env,
  });
  assert.equal(fastInitial.ok, true);
  assert.equal(fastInitial.pageSize, 50);
  assert.equal(fastInitial.questionCount, 55);
  assert.equal(fastInitial.loadedQuestionCount, 1);
  assert.equal(fastInitial.loadedQuestionLimit, 1);
  assert.equal(fastInitial.hasMoreQuestions, true);
  assert.deepEqual(fastInitial.deferredPanels, ['groups', 'admin']);
  assert.equal(fastInitial.admin.available, false);
  assert.equal(fastInitial.admin.reason, 'deferred_fast_initial_load');
  assert.equal(fastInitial.questions.length, 1);
  const fastActionCount = Array.from(kv.store.values())
    .map((value) => JSON.parse(value))
    .filter((record) => record?.miniAppQuestionAction === true)
    .length;
  assert.equal(fastActionCount, 1);

  const oneQuestionEnv = {
    ...env,
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify(questions.slice(0, 1)),
  };
  const oneQuestionInitial = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}&sessions=alpha&questionLimit=1`),
    env: oneQuestionEnv,
  });
  assert.equal(oneQuestionInitial.ok, true);
  assert.equal(oneQuestionInitial.questionCount, 1);
  assert.equal(oneQuestionInitial.loadedQuestionCount, 1);
  assert.equal(oneQuestionInitial.hasMoreQuestions, false);
  assert.deepEqual(oneQuestionInitial.deferredPanels, []);
  assert.notEqual(oneQuestionInitial.admin.reason, 'deferred_fast_initial_load');

  const initial = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}&sessions=alpha`),
    env,
  });
  assert.equal(initial.ok, true);
  assert.equal(initial.pageSize, 50);
  assert.equal(initial.questionCount, 55);
  assert.equal(initial.loadedQuestionCount, 50);
  assert.equal(initial.loadedQuestionLimit, 50);
  assert.equal(initial.hasMoreQuestions, true);
  assert.equal(initial.questions.length, 50);
  assert.equal(initial.questions[0].tags.includes('organizer'), true);

  const loadedMore = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}&sessions=alpha&questionLimit=100`),
    env,
  });
  assert.equal(loadedMore.questionCount, 55);
  assert.equal(loadedMore.loadedQuestionCount, 55);
  assert.equal(loadedMore.hasMoreQuestions, false);
  assert.equal(loadedMore.questions.length, 55);
});

test('Mini App first state for Telegram-only Cloudflare sessions reads one question payload and no RPC', async () => {
  const kv = new MemoryKv();
  const launch = 'cecb_fastcloudflare';
  await kv.put(`telegram:action:${launch}`, JSON.stringify({
    type: 'agent_bridge_opaque_action',
    actionId: launch,
    action: 'view_questions',
    lane: 'telegram_mini_app',
    miniAppLaunch: true,
    serverContextRef: { sessionSlug: 'alpha' },
  }));
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    const target = new URL(String(url));
    fetchCalls.push({ url: target.toString(), init });
    if (init?.body) {
      const body = JSON.parse(init.body);
      if (body?.jsonrpc || body?.method?.startsWith?.('eth_')) {
        throw new Error(`unexpected_rpc_${body.method || 'call'}`);
      }
    }
    if (target.pathname.endsWith('/auth/nonce')) {
      return new Response(JSON.stringify({ nonce: 'nonce-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.pathname.endsWith('/auth/login')) {
      return new Response(JSON.stringify({ token: 'worker-token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.pathname.endsWith('/storage/list')) {
      return new Response(JSON.stringify({
        items: [
          { id: 'q-storage-1' },
          { id: 'q-storage-2' },
          { id: 'q-storage-3' },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.pathname.endsWith('/storage/read')) {
      const id = target.searchParams.get('id');
      return new Response(JSON.stringify({
        questionId: id,
        questionType: 'binary',
        prompt: `Loaded ${id}`,
        sessionSlug: 'alpha',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected_url_${target.pathname}`);
  };
  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}&sessions=alpha&questionLimit=1`),
    env: {
      AGENT_ACTION_KV: kv,
      AGENT_BRIDGE_DEPLOYMENT_ID: 'unit-deploy',
      DEMO_SIGNER_ROOT_SECRET: 'unit-root-secret',
      AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
      AGENT_BRIDGE_QUESTION_SOURCE: 'live',
      AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
        defaultSessionSlug: 'alpha',
        sessions: [{
          sessionSlug: 'alpha',
          sessionName: 'Alpha',
          telegramBridgeEnabled: true,
          telegramOnly: true,
          sessionWorkerUrl: 'https://session.example',
          workerSessionSlug: 'alpha',
          questionSource: 'cloudflare_storage',
          storageProfile: { backend: 'cloudflare' },
        }],
      }),
      QUESTION_FETCH: fetchImpl,
      REGISTRY_FETCH: async () => {
        throw new Error('registry_rpc_should_not_be_called');
      },
    },
  });

  assert.equal(state.ok, true);
  assert.equal(state.questionSource, 'telegram_only_cloudflare_storage');
  assert.equal(state.questionSourceReason, 'telegram_only_cloudflare_questions_loaded');
  assert.equal(state.questionCount, 3);
  assert.equal(state.discoveredQuestionCount, 3);
  assert.equal(state.loadedQuestionCount, 1);
  assert.equal(state.loadedQuestionLimit, 1);
  assert.equal(state.hasMoreQuestions, true);
  assert.equal(state.questionIndexComplete, false);
  assert.deepEqual(state.deferredPanels, ['groups', 'admin']);
  assert.deepEqual(state.questions.map((question) => question.title), ['Loaded q-storage-1']);
  assert.deepEqual(
    fetchCalls
      .filter((call) => new URL(call.url).pathname.endsWith('/storage/read'))
      .map((call) => new URL(call.url).searchParams.get('id')),
    ['q-storage-1']
  );
});

test('Mini App first state reuses inline Cloudflare question payloads without read', async () => {
  const kv = new MemoryKv();
  const launch = 'cecb_inlinecloudflare';
  await kv.put(`telegram:action:${launch}`, JSON.stringify({
    type: 'agent_bridge_opaque_action',
    actionId: launch,
    action: 'view_questions',
    lane: 'telegram_mini_app',
    miniAppLaunch: true,
    serverContextRef: { sessionSlug: 'alpha' },
  }));
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    const target = new URL(String(url));
    fetchCalls.push({ url: target.toString(), init });
    if (init?.body) {
      const body = JSON.parse(init.body);
      if (body?.jsonrpc || body?.method?.startsWith?.('eth_')) {
        throw new Error(`unexpected_rpc_${body.method || 'call'}`);
      }
    }
    if (target.pathname.endsWith('/auth/nonce')) {
      return new Response(JSON.stringify({ nonce: 'nonce-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.pathname.endsWith('/auth/login')) {
      return new Response(JSON.stringify({ token: 'worker-token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.pathname.endsWith('/storage/list')) {
      return new Response(JSON.stringify({
        items: [
          {
            id: 'q-inline-1',
            questionId: 'q-inline-1',
            questionType: 'binary',
            prompt: 'Inline listed question payload.',
            sessionSlug: 'alpha',
          },
          { id: 'q-storage-2' },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.pathname.endsWith('/storage/read')) {
      throw new Error('storage_read_should_not_be_called_for_inline_payload');
    }
    throw new Error(`unexpected_url_${target.pathname}`);
  };
  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}&sessions=alpha&questionLimit=1`),
    env: {
      AGENT_ACTION_KV: kv,
      AGENT_BRIDGE_DEPLOYMENT_ID: 'unit-deploy',
      DEMO_SIGNER_ROOT_SECRET: 'unit-root-secret',
      AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
      AGENT_BRIDGE_QUESTION_SOURCE: 'live',
      AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
        defaultSessionSlug: 'alpha',
        sessions: [{
          sessionSlug: 'alpha',
          sessionName: 'Alpha',
          telegramBridgeEnabled: true,
          telegramOnly: true,
          sessionWorkerUrl: 'https://session.example',
          workerSessionSlug: 'alpha',
          questionSource: 'cloudflare_storage',
          storageProfile: { backend: 'cloudflare' },
        }],
      }),
      QUESTION_FETCH: fetchImpl,
      REGISTRY_FETCH: async () => {
        throw new Error('registry_rpc_should_not_be_called');
      },
    },
  });

  assert.equal(state.ok, true);
  assert.equal(state.questionSource, 'telegram_only_cloudflare_storage');
  assert.equal(state.questionSourceReason, 'telegram_only_cloudflare_questions_loaded');
  assert.equal(state.questionCount, 2);
  assert.equal(state.discoveredQuestionCount, 2);
  assert.equal(state.loadedQuestionCount, 1);
  assert.equal(state.loadedQuestionLimit, 1);
  assert.equal(state.hasMoreQuestions, true);
  assert.equal(state.questionIndexComplete, false);
  assert.deepEqual(state.questions.map((question) => question.title), ['Inline listed question payload.']);
  assert.deepEqual(
    fetchCalls.map((call) => new URL(call.url).pathname),
    ['/auth/nonce', '/auth/login', '/storage/list']
  );
});

test('Mini App first state treats Cloudflare storage without explicit onchain mode as worker-backed', async () => {
  const kv = new MemoryKv();
  const launch = 'cecb_cloudflarenochain';
  await kv.put(`telegram:action:${launch}`, JSON.stringify({
    type: 'agent_bridge_opaque_action',
    actionId: launch,
    action: 'view_questions',
    lane: 'telegram_mini_app',
    miniAppLaunch: true,
    serverContextRef: { sessionSlug: 'alpha' },
  }));
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    const target = new URL(String(url));
    fetchCalls.push({ url: target.toString(), init });
    if (init?.body) {
      const body = JSON.parse(init.body);
      if (body?.jsonrpc || body?.method?.startsWith?.('eth_')) {
        throw new Error(`unexpected_rpc_${body.method || 'call'}`);
      }
    }
    if (target.pathname.endsWith('/auth/nonce')) {
      return new Response(JSON.stringify({ nonce: 'nonce-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.pathname.endsWith('/auth/login')) {
      return new Response(JSON.stringify({ token: 'worker-token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.pathname.endsWith('/storage/list')) {
      return new Response(JSON.stringify({
        items: [
          { id: 'q-storage-1' },
          { id: 'q-storage-2' },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.pathname.endsWith('/storage/read')) {
      return new Response(JSON.stringify({
        questionId: target.searchParams.get('id'),
        questionType: 'binary',
        prompt: 'Cloudflare first question without chain mode.',
        sessionSlug: 'alpha',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected_url_${target.pathname}`);
  };
  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}&sessions=alpha&questionLimit=1`),
    env: {
      AGENT_ACTION_KV: kv,
      AGENT_BRIDGE_DEPLOYMENT_ID: 'unit-deploy',
      DEMO_SIGNER_ROOT_SECRET: 'unit-root-secret',
      AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
      AGENT_BRIDGE_QUESTION_SOURCE: 'live',
      AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
        defaultSessionSlug: 'alpha',
        sessions: [{
          sessionSlug: 'alpha',
          sessionName: 'Alpha',
          telegramBridgeEnabled: true,
          sessionMode: 'telegram_enabled',
          sessionWorkerUrl: 'https://session.example',
          workerSessionSlug: 'alpha',
          questionSource: 'cloudflare_storage',
          storageProfile: { backend: 'cloudflare' },
        }],
      }),
      QUESTION_FETCH: fetchImpl,
      REGISTRY_FETCH: async () => {
        throw new Error('registry_rpc_should_not_be_called');
      },
    },
  });

  assert.equal(state.ok, true);
  assert.equal(state.questionSource, 'telegram_only_cloudflare_storage');
  assert.equal(state.questionCount, 2);
  assert.equal(state.loadedQuestionCount, 1);
  assert.equal(state.hasMoreQuestions, true);
  assert.equal(state.questionIndexComplete, false);
  assert.deepEqual(state.selectedSessionSlugs, ['alpha']);
  assert.deepEqual(state.questions.map((question) => question.title), ['Cloudflare first question without chain mode.']);
  assert.deepEqual(
    fetchCalls.map((call) => new URL(call.url).pathname),
    ['/auth/nonce', '/auth/login', '/storage/list', '/storage/read']
  );
});

test('Mini App session picker honors the Telegram session created-after cutoff', async () => {
  const kv = new MemoryKv();
  const launch = 'cecb_cutoff1234';
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
    AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER: '2026-05-20T00:00:00.000Z',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'new-beta',
      sessions: [
        {
          sessionSlug: 'old-alpha',
          sessionName: 'Old Alpha',
          telegramBridgeEnabled: true,
          telegramOnly: true,
          createdAt: '2026-05-19T23:59:59.000Z',
        },
        {
          sessionSlug: 'new-beta',
          sessionName: 'New Beta',
          telegramBridgeEnabled: true,
          telegramOnly: true,
          createdAt: '2026-05-20T00:00:00.000Z',
        },
        {
          sessionSlug: 'missing-created-at',
          sessionName: 'Missing Created At',
          telegramBridgeEnabled: true,
          telegramOnly: true,
        },
      ],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { sessionSlug: 'old-alpha', questionId: 'q-old', questionType: 'freeform', prompt: 'Old prompt' },
      { sessionSlug: 'new-beta', questionId: 'q-new', questionType: 'freeform', prompt: 'New prompt' },
      { sessionSlug: 'missing-created-at', questionId: 'q-missing', questionType: 'freeform', prompt: 'Missing prompt' },
    ]),
  };

  const picker = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}`),
    env,
  });
  assert.equal(picker.ok, true);
  assert.equal(picker.sessionPicker.required, false);
  assert.deepEqual(picker.selectedSessionSlugs, ['new-beta']);
  assert.equal(picker.questionCount, 1);
  assert.deepEqual(picker.sessionPicker.sessions.map((session) => session.sessionSlug), ['new-beta']);

  const selected = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}&sessions=new-beta`),
    env,
  });
  assert.equal(selected.ok, true);
  assert.equal(selected.sessionPicker.required, false);
  assert.deepEqual(selected.selectedSessionSlugs, ['new-beta']);
  assert.equal(selected.questionCount, 1);
  assert.equal(selected.questions[0].sessionSlug, 'new-beta');
});

test('Mini App keeps the default Telegram-only session selectable when cutoff is set before it but metadata is missing', async () => {
  const kv = new MemoryKv();
  const launch = 'cecb_defaultcutoff';
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
    AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER: '2026-05-23T00:00:00.000Z',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'telegram-demo-3',
      sessions: [{
        sessionSlug: 'telegram-demo-3',
        sessionName: 'telegram-demo-3',
        telegramBridgeEnabled: true,
        telegramOnly: true,
      }],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { sessionSlug: 'telegram-demo-3', questionId: 'q-demo-3', questionType: 'freeform', prompt: 'Demo 3 prompt' },
    ]),
  };

  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}`),
    env,
  });

  assert.equal(state.ok, true);
  assert.equal(state.sessionPicker.required, false);
  assert.deepEqual(state.selectedSessionSlugs, ['telegram-demo-3']);
  assert.equal(state.questionCount, 1);
});

test('Mini App session picker accepts dotenv-escaped session policy JSON', async () => {
  const kv = new MemoryKv();
  const launch = 'cecb_escapedpolicy';
  await kv.put(`telegram:action:${launch}`, JSON.stringify({
    type: 'agent_bridge_opaque_action',
    actionId: launch,
    action: 'view_questions',
    lane: 'telegram_mini_app',
    miniAppLaunch: true,
    serverContextRef: { sessionSlug: 'telegram-demo-4' },
  }));
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_SESSION_POLICY_JSON: dotenvEscapedJson({
      defaultSessionSlug: 'telegram-demo-4',
      sessions: [{
        sessionSlug: 'telegram-demo-4',
        sessionName: 'Session Lab Organizers (Demo)',
        telegramBridgeEnabled: true,
        telegramOnly: true,
        sessionMode: 'telegram_only',
      }],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        sessionSlug: 'telegram-demo-4',
        questionId: 'q-demo-4',
        questionType: 'freeform',
        prompt: 'Demo 4 prompt',
      },
    ]),
  };

  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}`),
    env,
  });

  assert.equal(state.ok, true);
  assert.deepEqual(state.selectedSessionSlugs, ['telegram-demo-4']);
  assert.deepEqual(state.sessionPicker.sessions.map((session) => session.sessionSlug), ['telegram-demo-4']);
  assert.equal(state.questionCount, 1);
  assert.equal(state.session.title, 'Session Lab Organizers (Demo)');
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
        { sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true },
        { sessionSlug: 'beta', sessionName: 'Beta', telegramBridgeEnabled: true, telegramOnly: true },
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

test('Mini App exposes admin state only for configured export admin managed wallet', async () => {
  const createdAt = '2026-05-25T12:00:00.000Z';
  const rootSecret = 'test-root-secret-for-mini-admin';
  const adminAccount = await deriveTelegramResponseExportAccount({
    env: { DEMO_SIGNER_ROOT_SECRET: rootSecret },
    normalized: { telegramUserId: 'preview-user', user: { telegramUserId: 'preview-user' } },
    createdAt,
  });
  const baseEnv = {
    DEMO_SIGNER_ROOT_SECRET: rootSecret,
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES: adminAccount.accountAddress,
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
    }),
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([]),
  };

  const adminState = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env: baseEnv,
    createdAt,
  });
  const guestState = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env: {
      ...baseEnv,
      AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES: '0x1111111111111111111111111111111111111111',
    },
    createdAt,
  });

  assert.equal(adminState.admin.available, true);
  assert.equal(adminState.admin.canManage, true);
  assert.equal(adminState.admin.sessionSlug, 'alpha');
  assert.equal(adminState.admin.actions.map((action) => action.action).includes('export_all'), true);
  assert.equal(adminState.admin.actions.map((action) => action.action).includes('export_allow'), false);
  assert.equal(adminState.admin.actions.map((action) => action.action).includes('export_revoke'), false);
  assert.equal(adminState.admin.actions.map((action) => action.action).includes('question_queue'), true);
  assert.equal(adminState.admin.actions.map((action) => action.action).includes('group_link'), true);
  assert.equal(adminState.admin.actions.find((action) => action.action === 'export_all').label, 'Export data');
  assert.equal(adminState.admin.actions.find((action) => action.action === 'export_access').label, 'Manage permissions');
  assert.equal(adminState.admin.actions.find((action) => action.action === 'question_queue').label, 'Question queue');
  assert.equal(guestState.admin.available, false);
  assert.equal(guestState.admin.reason, 'response_export_admin_required');
});

test('Mini App treats dynamically added response addresses as admin-capable in the Mini App', async () => {
  const createdAt = '2026-05-25T12:00:00.000Z';
  const rootSecret = 'test-root-secret-for-mini-exporter';
  const exporterAccount = await deriveTelegramResponseExportAccount({
    env: { DEMO_SIGNER_ROOT_SECRET: rootSecret },
    normalized: { telegramUserId: 'preview-user', user: { telegramUserId: 'preview-user' } },
    createdAt,
  });
  const kv = new MemoryKv();
  await kv.put('telegram:response-export-allowlist:v1:alpha', JSON.stringify({
    version: 1,
    sessionSlug: 'alpha',
    addresses: [{ address: exporterAccount.accountAddress }],
  }));
  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env: {
      AGENT_ACTION_KV: kv,
      DEMO_SIGNER_ROOT_SECRET: rootSecret,
      AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
      AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES: '0x1111111111111111111111111111111111111111',
      AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
        defaultSessionSlug: 'alpha',
        sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
      }),
      AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
      AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([]),
    },
    createdAt,
  });

  assert.equal(state.admin.available, true);
  assert.equal(state.admin.canManage, true);
  assert.equal(state.admin.accountAddress, exporterAccount.accountAddress.toLowerCase());
  assert.equal(state.admin.actions.map((action) => action.action).includes('export_access'), true);
  assert.equal(state.admin.actions.map((action) => action.action).includes('results_settings'), true);
});

test('Mini App admin endpoints manage permissions, results settings, queue, and group invite links', async () => {
  const createdAt = '2026-05-25T12:00:00.000Z';
  const rootSecret = 'test-root-secret-for-mini-admin-endpoints';
  const adminAccount = await deriveTelegramResponseExportAccount({
    env: { DEMO_SIGNER_ROOT_SECRET: rootSecret },
    normalized: { telegramUserId: 'preview-user', user: { telegramUserId: 'preview-user' } },
    createdAt,
  });
  const kv = new MemoryKv();
  const env = {
    AGENT_ACTION_KV: kv,
    DEMO_SIGNER_ROOT_SECRET: rootSecret,
    TELEGRAM_BOT_USERNAME: 'contextengineer_bot',
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES: adminAccount.accountAddress,
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
        telegramOnly: true,
      }],
    }),
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: 'q1', prompt: 'Should alpha start with sponsored questions?', questionType: 'agree_unsure_disagree' },
      { questionId: 'q2', prompt: 'Should results be visible by default?', questionType: 'agree_unsure_disagree' },
    ]),
  };
  const addedAddress = '0x2222222222222222222222222222222222222222';

  const accessResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/admin/access?sessionSlug=alpha', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operation: 'add', address: addedAddress }),
    }),
    env,
  });
  const accessBody = await accessResponse.json();
  assert.equal(accessResponse.status, 200);
  assert.equal(accessBody.ok, true);
  assert.equal(accessBody.access.additionalAdmins.some((entry) => entry.address === addedAddress), true);
  assert.equal(accessBody.botCommands.exportAllow, `/export_allow ${addedAddress} alpha`);

  const settingsResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/admin/results-settings?sessionSlug=alpha', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        resultsExposure: {
          aggregateResultsEnabled: false,
          anonymizedGroupsEnabled: true,
          minGroupSize: 3,
        },
      }),
    }),
    env,
  });
  const settingsBody = await settingsResponse.json();
  assert.equal(settingsResponse.status, 200);
  assert.equal(settingsBody.ok, true);
  assert.equal(settingsBody.resultsExposure.aggregateResultsEnabled, false);
  assert.equal(settingsBody.resultsExposure.anonymizedGroupsEnabled, true);
  assert.equal(settingsBody.resultsExposure.minGroupSize, 3);

  const queueResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/admin/question-queue?sessionSlug=alpha', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refs: '1 2' }),
    }),
    env,
  });
  const queueBody = await queueResponse.json();
  assert.equal(queueResponse.status, 200);
  assert.deepEqual(queueBody.questionQueue.sponsoredQuestionIds, ['q1', 'q2']);
  assert.equal(queueBody.candidates.length, 2);

  const linkResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/admin/group-link?sessionSlug=alpha', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }),
    env,
  });
  const linkBody = await linkResponse.json();
  assert.equal(linkResponse.status, 200);
  assert.equal(linkBody.ok, true);
  assert.match(linkBody.link, /^https:\/\/t\.me\/contextengineer_bot\?startgroup=cetg_/);
});

test('Mini App documents endpoint lists fixture docs and stores lightweight uploads', async () => {
  const kv = new MemoryKv();
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
    }),
    AGENT_BRIDGE_DEMO_DOCS_JSON: JSON.stringify([{
      sessionSlug: 'alpha',
      title: 'Existing brief',
      name: 'brief.md',
      fileType: 'md',
      visibility: 'public',
      storageProfile: 'cloudflare',
      contentPreview: 'Existing public summary',
    }]),
  };
  const beforeResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/documents?sessionSlug=alpha'),
    env,
  });
  const before = await beforeResponse.json();
  assert.equal(beforeResponse.status, 200);
  assert.equal(before.documents.documents.length, 1);
  assert.equal(before.documents.documents[0].title, 'Existing brief');

  const form = new FormData();
  form.append('title', 'Uploaded note');
  form.append('visibility', 'public');
  form.append('file', new Blob(['# Uploaded note\nThis is a preview.'], { type: 'text/markdown' }), 'note.md');
  const uploadResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/documents?sessionSlug=alpha', {
      method: 'POST',
      body: form,
    }),
    env,
  });
  const upload = await uploadResponse.json();

  assert.equal(uploadResponse.status, 200);
  assert.equal(upload.ok, true);
  assert.equal(upload.document.title, 'Uploaded note');
  assert.equal(upload.document.fileType, 'md');
  assert.match(upload.document.contentPreview, /Uploaded note/);
  assert.equal(upload.documents.documents.length, 2);

  const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const imageForm = new FormData();
  imageForm.append('title', 'Uploaded diagram');
  imageForm.append('file', new Blob([imageBytes], { type: 'image/png' }), 'diagram.png');
  const imageUploadResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/documents?sessionSlug=alpha', {
      method: 'POST',
      body: imageForm,
    }),
    env,
  });
  const imageUpload = await imageUploadResponse.json();
  assert.equal(imageUploadResponse.status, 200);
  assert.equal(imageUpload.document.fileType, 'png');
  assert.equal(imageUpload.document.previewAvailable, true);
  assert.equal(imageUpload.document.previewKind, 'image');
  const imagePreviewResponse = await handleTelegramMiniAppRequest({
    request: new Request(`https://bridge.example/telegram/mini-app/api/documents/preview?sessionSlug=alpha&docId=${imageUpload.document.docId}`),
    env,
  });
  assert.equal(imagePreviewResponse.status, 200);
  assert.equal(imagePreviewResponse.headers.get('content-type'), 'image/png');
  assert.deepEqual(Array.from(new Uint8Array(await imagePreviewResponse.arrayBuffer())), Array.from(imageBytes));

  const pdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10, 37]);
  const pdfForm = new FormData();
  pdfForm.append('title', 'Uploaded PDF');
  pdfForm.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), 'brief.pdf');
  const pdfUploadResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/documents?sessionSlug=alpha', {
      method: 'POST',
      body: pdfForm,
    }),
    env,
  });
  const pdfUpload = await pdfUploadResponse.json();
  assert.equal(pdfUploadResponse.status, 200);
  assert.equal(pdfUpload.document.fileType, 'pdf');
  assert.equal(pdfUpload.document.previewAvailable, true);
  assert.equal(pdfUpload.document.previewKind, 'pdf');
  const pdfPreviewResponse = await handleTelegramMiniAppRequest({
    request: new Request(`https://bridge.example/telegram/mini-app/api/documents/preview?sessionSlug=alpha&docId=${pdfUpload.document.docId}`),
    env,
  });
  assert.equal(pdfPreviewResponse.status, 200);
  assert.equal(pdfPreviewResponse.headers.get('content-type'), 'application/pdf');
  assert.deepEqual(Array.from(new Uint8Array(await pdfPreviewResponse.arrayBuffer())), Array.from(pdfBytes));

  const urlResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/documents?sessionSlug=alpha', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        title: 'External PDF',
        url: 'https://example.com/reports/demo.pdf#section',
      }),
    }),
    env,
  });
  const urlUpload = await urlResponse.json();
  assert.equal(urlResponse.status, 200);
  assert.equal(urlUpload.document.title, 'External PDF');
  assert.equal(urlUpload.document.fileType, 'pdf');
  assert.equal(urlUpload.document.previewAvailable, true);
  assert.equal(urlUpload.document.previewKind, 'pdf');
  assert.equal(urlUpload.document.externalUrl, 'https://example.com/reports/demo.pdf');

  const oversizedForm = new FormData();
  oversizedForm.append('visibility', 'session');
  oversizedForm.append('file', new Blob([new Uint8Array((1024 * 1024) + 1)], { type: 'text/plain' }), 'too-large.txt');
  const oversizedResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/documents?sessionSlug=alpha', {
      method: 'POST',
      body: oversizedForm,
    }),
    env,
  });
  const oversized = await oversizedResponse.json();

  assert.equal(oversizedResponse.status, 413);
  assert.equal(oversized.ok, false);
  assert.equal(oversized.error, 'document_file_too_large');
  assert.equal(oversized.maxBytes, 1024 * 1024);
});

test('Mini App auto-selects the lone visible session when launch session is not selectable', async () => {
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
          { sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true },
          { sessionSlug: 'e2e-old', sessionName: 'E2E Old', telegramBridgeEnabled: true, telegramOnly: true },
        ],
      }),
      AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
        { sessionSlug: 'alpha', questionId: 'q-alpha', questionType: 'freeform', prompt: 'Alpha prompt' },
      ]),
    },
  });

  assert.equal(state.ok, true);
  assert.equal(state.sessionPicker.required, false);
  assert.equal(state.session.title, 'Alpha');
  assert.deepEqual(state.selectedSessionSlugs, ['alpha']);
  assert.deepEqual(state.sessionPicker.sessions.map((session) => session.sessionSlug), ['alpha']);
  assert.equal(state.questionCount, 1);
  assert.equal(state.questions[0].sessionSlug, 'alpha');
});

test('Mini App settings accepts show-unanswered-first with true default', () => {
  const defaultState = __test__telegramMiniApp.normalizeAgentSettingsInput({
    showUnansweredFirst: true,
    agentAutoApplyQuestionVotes: true,
    topicPreferences: 'AI futures, governance',
    demographicLinkOptIn: 'yes',
    attendanceLinkOptIn: 'on',
    draftDivergenceOptIn: true,
  });
  assert.equal(defaultState.ok, true);
  assert.equal(defaultState.publicSummary.showUnansweredFirst, true);
  assert.equal(defaultState.publicSummary.agentAutoApplyQuestionVotes, true);
  assert.deepEqual(defaultState.publicSummary.topicPreferences, ['ai-futures', 'governance']);
  assert.equal(defaultState.publicSummary.demographicLinkOptIn, true);
  assert.equal(defaultState.publicSummary.attendanceLinkOptIn, true);
  assert.equal(defaultState.publicSummary.draftDivergenceOptIn, true);

  const disabled = __test__telegramMiniApp.normalizeAgentSettingsInput({
    showUnansweredFirst: 'false',
    agentAutoApplyQuestionVotes: 'off',
    demographicLinkOptIn: 'off',
    attendanceLinkOptIn: 'no',
    draftDivergenceOptIn: 'no',
  });
  assert.equal(disabled.ok, true);
  assert.equal(disabled.publicSummary.showUnansweredFirst, false);
  assert.equal(disabled.publicSummary.agentAutoApplyQuestionVotes, false);
  assert.equal(disabled.publicSummary.demographicLinkOptIn, false);
  assert.equal(disabled.publicSummary.attendanceLinkOptIn, false);
  assert.equal(disabled.publicSummary.draftDivergenceOptIn, false);

  const invalid = __test__telegramMiniApp.normalizeAgentSettingsInput({
    agentAutoApplyQuestionVotes: 'maybe',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.reason, 'agent_auto_apply_question_votes_invalid');

  const invalidOptIn = __test__telegramMiniApp.normalizeAgentSettingsInput({
    draftDivergenceOptIn: 'sometimes',
  });
  assert.equal(invalidOptIn.ok, false);
  assert.equal(invalidOptIn.reason, 'draft_divergence_opt_in_invalid');

  const invalidAttendance = __test__telegramMiniApp.normalizeAgentSettingsInput({
    attendanceLinkOptIn: 'sometimes',
  });
  assert.equal(invalidAttendance.ok, false);
  assert.equal(invalidAttendance.reason, 'attendance_link_opt_in_invalid');
});

test('Mini App state pre-populates previously saved answers and exposes them in drafts', async () => {
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
      AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
        defaultSessionSlug: 'alpha',
        sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
      }),
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

test('Mini App launch question series applies ordering skips and prefilled drafts', async () => {
  const kv = new MemoryKv();
  const launch = 'cecb_series1234';
  await kv.put(`telegram:action:${launch}`, JSON.stringify({
    type: 'agent_bridge_opaque_action',
    actionId: launch,
    action: 'submit_response',
    lane: 'telegram_mini_app',
    miniAppLaunch: true,
    serverContextRef: {
      sessionSlug: 'alpha',
      questionSeries: {
        questionIds: ['q-second', 'q-first', 'q-third'],
        skippedQuestionIds: ['q-first'],
        draftAnswersByQuestionId: {
          'q-second': { text: 'Drafted answer from the agent' },
        },
      },
    },
  }));

  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}`),
    env: {
      AGENT_ACTION_KV: kv,
      AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
      AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
        defaultSessionSlug: 'alpha',
        sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
      }),
      AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
      AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
        { sessionSlug: 'alpha', questionId: 'q-first', questionType: 'freeform', prompt: 'First prompt' },
        { sessionSlug: 'alpha', questionId: 'q-second', questionType: 'freeform', prompt: 'Second prompt' },
        { sessionSlug: 'alpha', questionId: 'q-third', questionType: 'freeform', prompt: 'Third prompt' },
      ]),
    },
    createdAt: '2026-05-08T12:00:01.000Z',
  });

  assert.equal(state.ok, true);
  assert.equal(state.questionSeries.enabled, true);
  assert.equal(state.questionSeries.questionCount, 3);
  assert.equal(state.questionSeries.skippedQuestionCount, 1);
  assert.deepEqual(state.questions.map((question) => question.prompt), ['Second prompt', 'Third prompt']);
  assert.equal(state.activeQuestionKey, state.questions[0].questionKey);
  assert.deepEqual(state.prefilledDraftAnswersByQuestionKey[state.questions[0].questionKey], {
    text: 'Drafted answer from the agent',
  });
  assert.equal(JSON.stringify(state).includes('q-first'), false);
  assert.equal(JSON.stringify(state).includes('q-second'), false);
  assert.equal(JSON.stringify(state).includes('q-third'), false);
});

test('Mini App draft save endpoint returns draft metadata and reloads saved draft state', async () => {
  const kv = new MemoryKv();
  const questionId = 'q-save-visible';
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
    }),
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([{
      sessionSlug: 'alpha',
      questionId,
      questionType: 'agree_unsure_disagree',
      prompt: 'Should saved drafts stay visible?',
    }]),
  };
  const before = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env,
    createdAt: '2026-05-08T12:00:00.000Z',
  });

  const response = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        questionKey: before.questions[0].questionKey,
        answer: { value: 'disagree', comments: 'Needs work' },
        submit: false,
      }),
    }),
    env,
    createdAt: '2026-05-08T12:00:01.000Z',
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.status, 'draft_saved');
  assert.equal(body.draft.answerLabel, 'Disagree');
  assert.match(body.draft.selectedAt, /^\d{4}-\d{2}-\d{2}T/);

  const after = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env,
    createdAt: '2026-05-08T12:00:02.000Z',
  });
  assert.equal(after.savedDrafts.length, 1);
  assert.equal(after.savedDrafts[0].answerLabel, 'Disagree');
  assert.equal(after.savedDrafts[0].selectedAt, body.draft.selectedAt);
  assert.deepEqual(after.draftAnswersByQuestionKey[after.questions[0].questionKey], {
    value: 'disagree',
    comments: 'Needs work',
  });
});

test('Mini App exposes agent-only sidecar state, human votes, confirm, and edit-after-agent events', async () => {
  const kv = new MemoryKv();
  const env = {
    AGENT_ACTION_KV: kv,
    DEMO_SIGNER_ROOT_SECRET: 'unit-root-secret',
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
    }),
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
  };
  const proposed = await persistTelegramProposedQuestion({
    env,
    normalized: {
      user: { telegramUserId: 'preview-user' },
      chat: { chatId: 'preview-user' },
    },
    sessionSlug: 'alpha',
    prompt: 'Should the agent-only prediction be visible?',
    questionType: 'binary',
    createdAt: '2026-06-12T15:00:00.000Z',
  });
  env.AGENT_BRIDGE_DEMO_QUESTIONS_JSON = JSON.stringify([{
    sessionSlug: 'alpha',
    questionId: proposed.questionId,
    questionType: 'agree_unsure_disagree',
    prompt: proposed.record.prompt,
  }]);
  await saveAgentOnlyModeConfig({
    env,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: [proposed.questionId] },
    createdAt: '2026-06-12T15:01:00.000Z',
  });
  await materializeAgentOnlyWindow({
    env,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:02:00.000Z',
  });
  await submitAgentOnlyAnswersBulk({
    env,
    sessionSlug: 'alpha',
    telegramUserId: 'preview-user',
    now: '2026-06-12T15:03:00.000Z',
    body: {
      window_id: 'w-2026-06-12',
      run_id: 'run-mini-agent-answer',
      request_id: 'mini-agent-answer',
      agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
      answers: [{
        statement_id: proposed.questionId,
        answer: { value: 'agree' },
        confidence: 91,
      }],
    },
  });

  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env,
    createdAt: '2026-06-12T15:04:00.000Z',
  });
  assert.equal(state.ok, true);
  const questionKey = state.questions[0].questionKey;
  assert.deepEqual(state.agentOnly.flaggedQuestionKeys, [questionKey]);
  assert.equal(state.agentOnly.windowId, 'w-2026-06-12');
  assert.equal(state.agentOnly.predictions[questionKey].valueLabel, 'Agree');
  assert.deepEqual(state.agentOnly.counts, {
    flaggedQuestions: 1,
    loadedFlaggedQuestions: 1,
    predictions: 1,
    loadedPredictions: 1,
    loadedQuestions: 1,
  });
  assert.equal(JSON.stringify(state.agentOnly).includes('confidence'), false);

  await saveTelegramAgentSettingsPatch({
    env,
    sessionSlug: 'alpha',
    telegramUserId: 'preview-user',
    patch: { showAgentResponses: false },
    createdAt: '2026-06-12T15:04:30.000Z',
  });
  const hidden = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env,
    createdAt: '2026-06-12T15:05:00.000Z',
  });
  assert.equal(hidden.agentOnly.showAgentResponses, false);
  assert.equal(Object.hasOwn(hidden.agentOnly, 'predictions'), false);
  await saveTelegramAgentSettingsPatch({
    env,
    sessionSlug: 'alpha',
    telegramUserId: 'preview-user',
    patch: { showAgentResponses: true },
    createdAt: '2026-06-12T15:05:30.000Z',
  });

  const voteResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/agent-only/token-votes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        taps: [
          { questionKey, delta: 1 },
          { questionKey, delta: 1 },
          { questionKey, delta: -1 },
        ],
      }),
    }),
    env,
    createdAt: '2026-06-12T15:06:00.000Z',
  });
  const voteBody = await voteResponse.json();
  assert.equal(voteResponse.status, 200);
  assert.equal(voteBody.budgetUsed, 1);

  const confirmResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/agent-only/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionKey }),
    }),
    env,
    createdAt: '2026-06-12T15:07:00.000Z',
  });
  const confirmBody = await confirmResponse.json();
  assert.equal(confirmResponse.status, 200);
  assert.equal(confirmBody.ok, true);

  const editResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        questionKey,
        answer: { value: 'disagree' },
        submit: true,
      }),
    }),
    env,
    createdAt: '2026-06-12T15:08:00.000Z',
  });
  const editBody = await editResponse.json();
  assert.equal(editResponse.status, 200);
  assert.equal(editBody.ok, true);
  assert.equal(editBody.agentOnlyReview.source, 'human_edit_after_agent');
});

test('Mini App classifies agent-only confirm/edit by answer semantics, not display labels', async () => {
  const kv = new MemoryKv();
  const env = {
    AGENT_ACTION_KV: kv,
    DEMO_SIGNER_ROOT_SECRET: 'unit-root-secret',
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
    }),
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
  };
  const normalized = {
    user: { telegramUserId: 'preview-user' },
    chat: { chatId: 'preview-user' },
  };
  const longText = 'This is a deliberately long freeform answer that is identical but too long for the display label.';
  const freeform = await persistTelegramProposedQuestion({
    env,
    normalized,
    sessionSlug: 'alpha',
    prompt: 'What should Alpha improve?',
    questionType: 'freeform',
    createdAt: '2026-06-12T15:00:00.000Z',
  });
  const multichoice = await persistTelegramProposedQuestion({
    env,
    normalized,
    sessionSlug: 'alpha',
    prompt: 'Which priorities matter?',
    questionType: 'multichoice',
    options: ['Alpha', 'Beta', 'Gamma'],
    createdAt: '2026-06-12T15:00:01.000Z',
  });
  env.AGENT_BRIDGE_DEMO_QUESTIONS_JSON = JSON.stringify([
    {
      sessionSlug: 'alpha',
      questionId: freeform.questionId,
      questionType: 'freeform',
      prompt: freeform.record.prompt,
    },
    {
      sessionSlug: 'alpha',
      questionId: multichoice.questionId,
      questionType: 'multichoice',
      prompt: multichoice.record.prompt,
      options: ['Alpha', 'Beta', 'Gamma'],
    },
  ]);
  await saveAgentOnlyModeConfig({
    env,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: [freeform.questionId, multichoice.questionId] },
    createdAt: '2026-06-12T15:01:00.000Z',
  });
  await materializeAgentOnlyWindow({
    env,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:02:00.000Z',
  });
  const submittedPredictions = await submitAgentOnlyAnswersBulk({
    env,
    sessionSlug: 'alpha',
    telegramUserId: 'preview-user',
    now: '2026-06-12T15:03:00.000Z',
    body: {
      window_id: 'w-2026-06-12',
      run_id: 'run-semantic-agent-answers',
      request_id: 'semantic-agent-answers',
      agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
      answers: [
        {
          statement_id: freeform.questionId,
          answer: { text: longText },
          confidence: 88,
        },
        {
          statement_id: multichoice.questionId,
          answer: { values: ['Alpha', 'Beta'] },
          confidence: 82,
        },
      ],
    },
  });
  assert.equal(submittedPredictions.ok, true);

  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env,
    createdAt: '2026-06-12T15:04:00.000Z',
  });
  const freeformKey = state.questions.find((question) => question.questionId === freeform.questionId)?.questionKey;
  const multichoiceKey = state.questions.find((question) => question.questionId === multichoice.questionId)?.questionKey;
  assert.ok(freeformKey);
  assert.ok(multichoiceKey);

  const freeformConfirmResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        questionKey: freeformKey,
        answer: { text: longText },
        submit: true,
      }),
    }),
    env,
    createdAt: '2026-06-12T15:05:00.000Z',
  });
  const freeformConfirm = await freeformConfirmResponse.json();
  assert.equal(freeformConfirmResponse.status, 200);
  assert.equal(freeformConfirm.agentOnlyReview.source, 'human_confirm');

  const multichoiceConfirmResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        questionKey: multichoiceKey,
        answer: { values: ['Beta', 'Alpha'] },
        submit: true,
      }),
    }),
    env,
    createdAt: '2026-06-12T15:06:00.000Z',
  });
  const multichoiceConfirm = await multichoiceConfirmResponse.json();
  assert.equal(multichoiceConfirmResponse.status, 200);
  assert.equal(multichoiceConfirm.agentOnlyReview.source, 'human_confirm');

  const editResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        questionKey: freeformKey,
        answer: { text: `${longText} Changed.` },
        submit: true,
      }),
    }),
    env,
    createdAt: '2026-06-12T15:07:00.000Z',
  });
  const edit = await editResponse.json();
  assert.equal(editResponse.status, 200);
  assert.equal(edit.agentOnlyReview.source, 'human_edit_after_agent');
});

test('Mini App submit skips agent-only sidecar work when the session is not configured', async () => {
  const kv = new MemoryKv();
  const env = {
    AGENT_ACTION_KV: kv,
    DEMO_SIGNER_ROOT_SECRET: 'unit-root-secret',
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
    }),
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([{
      sessionSlug: 'alpha',
      questionId: 'q-not-agent-only',
      questionType: 'agree_unsure_disagree',
      prompt: 'Should normal sessions avoid agent-only sidecar work?',
    }]),
  };
  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env,
    createdAt: '2026-06-12T15:04:00.000Z',
  });
  assert.equal(state.ok, true);
  assert.equal(Object.hasOwn(state, 'agentOnly'), false);
  const questionKey = state.questions[0].questionKey;

  const response = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        questionKey,
        answer: { value: 'agree' },
        submit: true,
      }),
    }),
    env,
    createdAt: '2026-06-12T15:05:00.000Z',
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.agentOnlyReview, { recorded: false, reason: 'agent_only_not_configured' });

  const confirmResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/agent-only/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionKey }),
    }),
    env,
    createdAt: '2026-06-12T15:06:00.000Z',
  });
  const confirmBody = await confirmResponse.json();
  assert.equal(confirmResponse.status, 409);
  assert.equal(confirmBody.error, 'agent_only_window_not_open');

  const voteResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/agent-only/token-votes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ taps: [{ questionKey, delta: 1 }] }),
    }),
    env,
    createdAt: '2026-06-12T15:07:00.000Z',
  });
  const voteBody = await voteResponse.json();
  assert.equal(voteResponse.status, 409);
  assert.equal(voteBody.error, 'agent_only_window_not_open');

  const keys = Array.from(kv.store.keys());
  assert.equal(keys.some((key) => key.startsWith('telegram:agent-mode-window:v1:')), false);
  assert.equal(keys.some((key) => key.startsWith('telegram:agent-only:')), false);
});

test('Mini App submit contains agent-only review failures after persisting the human submit', async () => {
  const kv = new MemoryKv();
  const env = {
    AGENT_ACTION_KV: kv,
    DEMO_SIGNER_ROOT_SECRET: 'unit-root-secret',
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
    }),
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
  };
  const normalized = {
    user: { telegramUserId: 'preview-user' },
    chat: { chatId: 'preview-user' },
  };
  const proposed = await persistTelegramProposedQuestion({
    env,
    normalized,
    sessionSlug: 'alpha',
    prompt: 'Should optional agent-only review failures be contained?',
    questionType: 'binary',
    createdAt: '2026-06-12T15:00:00.000Z',
  });
  env.AGENT_BRIDGE_DEMO_QUESTIONS_JSON = JSON.stringify([{
    sessionSlug: 'alpha',
    questionId: proposed.questionId,
    questionType: 'agree_unsure_disagree',
    prompt: proposed.record.prompt,
  }]);
  await saveAgentOnlyModeConfig({
    env,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: [proposed.questionId] },
    createdAt: '2026-06-12T15:01:00.000Z',
  });
  await materializeAgentOnlyWindow({
    env,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:02:00.000Z',
  });
  const submittedPredictions = await submitAgentOnlyAnswersBulk({
    env,
    sessionSlug: 'alpha',
    telegramUserId: 'preview-user',
    now: '2026-06-12T15:03:00.000Z',
    body: {
      window_id: 'w-2026-06-12',
      run_id: 'run-contained-review-agent-answer',
      request_id: 'contained-review-agent-answer',
      agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
      answers: [{
        statement_id: proposed.questionId,
        answer: { value: 'agree' },
        confidence: 87,
      }],
    },
  });
  assert.equal(submittedPredictions.ok, true);
  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env,
    createdAt: '2026-06-12T15:04:00.000Z',
  });
  const questionKey = state.questions[0].questionKey;
  const originalPut = kv.put.bind(kv);
  kv.put = async (key, value, options = null) => {
    if (String(key).startsWith('telegram:agent-only:answer-event:v1:')) {
      throw new Error('agent-only review write unavailable');
    }
    return originalPut(key, value, options);
  };

  const response = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        questionKey,
        answer: { value: 'agree' },
        submit: true,
      }),
    }),
    env,
    createdAt: '2026-06-12T15:05:00.000Z',
  });
  const body = await response.json();
  const submitKeys = Array.from(kv.store.keys()).filter((key) => key.startsWith('telegram:submit-request:'));

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.agentOnlyReview, { recorded: false, reason: 'agent_only_review_unavailable' });
  assert.equal(submitKeys.length, 1);
});

test('Mini App stores draft divergence only after explicit opt in', async () => {
  const kv = new MemoryKv();
  const botToken = '123456:test-token';
  const nowSeconds = Math.floor(Date.now() / 1000);
  const initData = signInitData({
    auth_date: String(nowSeconds),
    query_id: 'mini-divergence-query',
    user: JSON.stringify({ id: 42, username: 'participant' }),
  }, botToken);
  const launch = 'cecb_divergence123';
  const questionId = 'q-divergence';
  await kv.put(`telegram:action:${launch}`, JSON.stringify({
    type: 'agent_bridge_opaque_action',
    actionId: launch,
    action: 'submit_response',
    lane: 'telegram_mini_app',
    miniAppLaunch: true,
    serverContextRef: {
      sessionSlug: 'alpha',
      questionSeries: {
        questionIds: [questionId],
        draftAnswersByQuestionId: {
          [questionId]: { text: 'Agent-generated starting draft' },
        },
      },
    },
  }));
  const env = {
    AGENT_ACTION_KV: kv,
    DEMO_SIGNER_ROOT_SECRET: 'unit-root-secret',
    TELEGRAM_BOT_TOKEN: botToken,
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
    }),
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([{
      sessionSlug: 'alpha',
      questionId,
      questionType: 'freeform',
      prompt: 'What should the agent improve?',
    }]),
  };
  const authHeaders = { 'x-telegram-init-data': initData };
  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}`, {
      headers: authHeaders,
    }),
    env,
  });
  assert.equal(state.ok, true);
  const questionKey = state.questions[0].questionKey;

  async function submitAnswer(text) {
    const response = await handleTelegramMiniAppRequest({
      request: new Request('https://bridge.example/telegram/mini-app/api/draft', {
        method: 'POST',
        headers: { ...authHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({
          launch,
          questionKey,
          answer: { text },
          submit: true,
        }),
      }),
      env,
    });
    return { response, body: await response.json() };
  }

  const optOut = await submitAnswer('Edited without research opt in');
  assert.equal(optOut.response.status, 200);
  assert.equal(optOut.body.ok, true);
  assert.equal(optOut.body.draftDivergence.stored, false);
  assert.equal(optOut.body.draftDivergence.reason, 'draft_divergence_opt_out');
  assert.deepEqual(Array.from(kv.store.keys()).filter((key) => (
    key.startsWith(__test__telegramMiniApp.MINI_APP_DRAFT_DIVERGENCE_KV_PREFIX)
  )), []);

  await saveTelegramAgentSettingsPatch({
    env,
    sessionSlug: 'alpha',
    telegramUserId: '42',
    patch: { draftDivergenceOptIn: true },
    createdAt: '2026-05-08T12:00:00.000Z',
  });

  const optIn = await submitAnswer('Edited final answer after opt in');
  assert.equal(optIn.response.status, 200);
  assert.equal(optIn.body.ok, true);
  assert.equal(optIn.body.draftDivergence.stored, true);
  assert.equal(JSON.stringify(optIn.body).includes('telegram:mini-app-draft-divergence'), false);
  const divergenceKeys = Array.from(kv.store.keys()).filter((key) => (
    key.startsWith(__test__telegramMiniApp.MINI_APP_DRAFT_DIVERGENCE_KV_PREFIX)
  ));
  assert.equal(divergenceKeys.length, 1);
  assert.equal(kv.options.get(divergenceKeys[0]), null);
  const record = JSON.parse(await kv.get(divergenceKeys[0]));
  assert.equal(record.type, 'telegram_draft_edit_metric');
  assert.equal(record.source, 'mini_app');
  assert.equal(record.finality, 'submitted');
  assert.equal(record.sessionSlug, 'alpha');
  assert.equal(record.questionId, questionId);
  assert.equal(record.metrics.questionType, 'freeform');
  assert.equal(record.metrics.changed, true);
  assert.equal(record.metrics.answerChanged, true);
  assert.equal(record.metrics.draftTextLengthBucket, '1-80');
  assert.equal(record.metrics.finalTextLengthBucket, '1-80');
  assert.equal(Object.hasOwn(record, 'telegramUserId'), false);
  assert.equal(Object.hasOwn(record, 'draftAnswer'), false);
  assert.equal(Object.hasOwn(record, 'sentAnswer'), false);
  assert.equal(JSON.stringify(record).includes('Agent-generated starting draft'), false);
  assert.equal(JSON.stringify(record).includes('Edited final answer after opt in'), false);
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
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
    }),
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
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
    }),
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

test('Mini App state exposes submitted rating answers for hydration', async () => {
  const kv = new MemoryKv();
  const questionId = 'q-rating-history';
  await kv.put(`${SUBMIT_REQUEST_KV_PREFIX}rating-history`, JSON.stringify({
    version: 1,
    requestId: 'rating-history',
    status: 'direct_submitted',
    lane: 'telegram_mini_app',
    telegramUserId: 'preview-user',
    sessionSlug: 'alpha',
    questionId,
    answer: { questionType: 'rating', value: 0, comments: 'Lowest score' },
    createdAt: '2026-05-08T12:00:02.000Z',
  }));
  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env: {
      AGENT_ACTION_KV: kv,
      AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
      AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
        defaultSessionSlug: 'alpha',
        sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
      }),
      AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
      AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([{
        sessionSlug: 'alpha',
        questionId,
        questionType: 'rating',
        prompt: 'Rate the Mini App.',
      }]),
    },
    createdAt: '2026-05-08T12:00:03.000Z',
  });

  assert.equal(state.ok, true);
  const questionKey = state.questions[0].questionKey;
  assert.deepEqual(state.submittedAnswerKeys, [questionKey]);
  assert.equal(state.submittedAnswers[0].answerLabel, '0');
  assert.deepEqual(state.submittedAnswers[0].answer, {
    value: 0,
    comments: 'Lowest score',
  });
  assert.equal(state.savedDrafts.length, 0);
  assert.deepEqual(state.draftAnswersByQuestionKey, {});
});

test('Mini App state hydrates submitted rating answers from serialized values', async () => {
  const kv = new MemoryKv();
  const questionId = 'q-rating-serialized-history';
  await kv.put(`${SUBMIT_REQUEST_KV_PREFIX}rating-serialized-history`, JSON.stringify({
    version: 1,
    requestId: 'rating-serialized-history',
    status: 'direct_submitted',
    lane: 'telegram_agent',
    telegramUserId: 'preview-user',
    sessionSlug: 'alpha',
    questionId,
    answer: {
      value: JSON.stringify({
        questionType: 'rating',
        value: 7,
        comments: 'Agent-submitted rating rationale.',
      }),
      controlType: 'rating_button',
    },
    createdAt: '2026-05-08T12:00:02.000Z',
  }));
  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env: {
      AGENT_ACTION_KV: kv,
      AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
      AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
        defaultSessionSlug: 'alpha',
        sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
      }),
      AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
      AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([{
        sessionSlug: 'alpha',
        questionId,
        questionType: 'rating',
        prompt: 'Rate serialized agent answers.',
      }]),
    },
    createdAt: '2026-05-08T12:00:03.000Z',
  });

  assert.equal(state.ok, true);
  const questionKey = state.questions[0].questionKey;
  assert.deepEqual(state.submittedAnswerKeys, [questionKey]);
  assert.equal(state.submittedAnswers[0].answerLabel, '7');
  assert.deepEqual(state.submittedAnswers[0].answer, {
    value: 7,
    comments: 'Agent-submitted rating rationale.',
  });
  assert.equal(JSON.stringify(state.submittedAnswers).includes('questionType'), false);
});

test('Mini App state hydrates submitted multichoice answers from serialized values', async () => {
  const kv = new MemoryKv();
  const questionId = 'q-multichoice-history';
  await kv.put(`${SUBMIT_REQUEST_KV_PREFIX}multichoice-history`, JSON.stringify({
    version: 1,
    requestId: 'multichoice-history',
    status: 'direct_submitted',
    lane: 'telegram_agent',
    telegramUserId: 'preview-user',
    sessionSlug: 'alpha',
    questionId,
    answer: {
      label: 'Option B',
      value: JSON.stringify({
        questionType: 'multichoice',
        values: ['Option B'],
        comments: 'Only if facilitators can intervene transparently.',
      }),
    },
    createdAt: '2026-05-08T12:00:02.000Z',
  }));
  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env: {
      AGENT_ACTION_KV: kv,
      AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
      AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
        defaultSessionSlug: 'alpha',
        sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
      }),
      AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
      AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([{
        sessionSlug: 'alpha',
        questionId,
        questionType: 'multichoice',
        prompt: 'Which option should be selected?',
        options: ['Option A', 'Option B', 'Option C'],
      }]),
    },
    createdAt: '2026-05-08T12:00:03.000Z',
  });

  assert.equal(state.ok, true);
  const questionKey = state.questions[0].questionKey;
  assert.deepEqual(state.submittedAnswerKeys, [questionKey]);
  assert.equal(state.submittedAnswers[0].answerLabel, 'Option B');
  assert.deepEqual(state.submittedAnswers[0].answer, {
    values: ['Option B'],
    comments: 'Only if facilitators can intervene transparently.',
  });
  assert.equal(state.savedDrafts.length, 0);
});

test('Mini App state hydrates submitted multichoice object values', async () => {
  const kv = new MemoryKv();
  const questionId = 'q-multichoice-object-history';
  await kv.put(`${SUBMIT_REQUEST_KV_PREFIX}multichoice-object-history`, JSON.stringify({
    version: 1,
    requestId: 'multichoice-object-history',
    status: 'direct_submitted',
    lane: 'telegram_agent',
    telegramUserId: 'preview-user',
    sessionSlug: 'alpha',
    questionId,
    answer: {
      label: 'Option A, Option C',
      questionType: 'multichoice',
      values: [{ label: 'Option A' }, { value: 'Option C' }],
      comments: 'Native object values should hydrate for review.',
    },
    createdAt: '2026-05-08T12:00:02.000Z',
  }));
  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env: {
      AGENT_ACTION_KV: kv,
      AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
      AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
        defaultSessionSlug: 'alpha',
        sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
      }),
      AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
      AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([{
        sessionSlug: 'alpha',
        questionId,
        questionType: 'multichoice',
        prompt: 'Which object options should be selected?',
        options: ['Option A', 'Option B', 'Option C'],
      }]),
    },
    createdAt: '2026-05-08T12:00:03.000Z',
  });

  assert.equal(state.ok, true);
  const questionKey = state.questions[0].questionKey;
  assert.deepEqual(state.submittedAnswerKeys, [questionKey]);
  assert.deepEqual(state.submittedAnswers[0].answer, {
    values: ['Option A', 'Option C'],
    comments: 'Native object values should hydrate for review.',
  });
});

test('Mini App submitted answer hydration reads per-user indexes when global submit records are noisy', async () => {
  const kv = new MemoryKv();
  const questionId = 'q-indexed-history';
  for (let index = 0; index < 1050; index += 1) {
    await kv.put(`telegram:submit-request:noise-${String(index).padStart(4, '0')}`, JSON.stringify({
      requestId: `noise-${index}`,
      status: 'direct_submitted',
      lane: 'telegram_mini_app',
      telegramUserId: `other-${index}`,
      sessionSlug: 'other',
      questionId: 'q-noise',
      answer: { value: 'agree', label: 'Agree' },
      createdAt: `2026-05-08T11:${String(index % 60).padStart(2, '0')}:00.000Z`,
    }));
  }
  const submitted = {
    version: 1,
    requestId: 'indexed-history',
    status: 'direct_submitted',
    lane: 'telegram_mini_app',
    telegramUserId: 'preview-user',
    sessionSlug: 'alpha',
    questionId,
    answer: { questionType: 'freeform', text: 'Indexed response' },
    createdAt: '2026-05-08T12:00:02.000Z',
  };
  await kv.put(submitRequestUserKvKey(submitted), JSON.stringify(submitted));

  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env: {
      AGENT_ACTION_KV: kv,
      AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
      AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
        defaultSessionSlug: 'alpha',
        sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
      }),
      AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
      AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([{
        sessionSlug: 'alpha',
        questionId,
        questionType: 'freeform',
        prompt: 'What indexed response should hydrate?',
      }]),
    },
    createdAt: '2026-05-08T12:00:03.000Z',
  });

  assert.equal(state.ok, true);
  assert.equal(state.submittedAnswers.length, 1);
  assert.equal(state.submittedAnswers[0].answerLabel, 'Indexed response');
});

test('Mini App question voting stores one current up/down vote per Telegram user', async () => {
  const kv = new MemoryKv();
  const questionId = 'q-popular-vote';
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
    }),
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([{
      sessionSlug: 'alpha',
      questionId,
      questionType: 'agree_unsure_disagree',
      prompt: 'Should popular questions be surfaced?',
    }]),
  };
  const before = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env,
    createdAt: '2026-05-08T12:00:03.000Z',
  });
  const questionKey = before.questions[0].questionKey;
  assert.deepEqual(before.questions[0].voteSummary, {
    up: 0,
    down: 0,
    score: 0,
    total: 0,
    userVote: '',
    mode: 'single',
    weight: 1,
    quadraticReady: true,
  });

  const upResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/question-vote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionKey, vote: 'up' }),
    }),
    env,
  });
  const upBody = await upResponse.json();
  assert.equal(upResponse.status, 200);
  assert.equal(upBody.ok, true);
  assert.equal(upBody.voteSummary.up, 1);
  assert.equal(upBody.voteSummary.down, 0);
  assert.equal(upBody.voteSummary.score, 1);
  assert.equal(upBody.voteSummary.userVote, 'up');

  const downResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/question-vote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionKey, vote: 'down' }),
    }),
    env,
  });
  const downBody = await downResponse.json();
  assert.equal(downResponse.status, 200);
  assert.equal(downBody.ok, true);
  assert.equal(downBody.voteSummary.up, 0);
  assert.equal(downBody.voteSummary.down, 1);
  assert.equal(downBody.voteSummary.score, -1);
  assert.equal(downBody.voteSummary.userVote, 'down');
  assert.equal(downBody.voteSummary.quadraticReady, true);

  const after = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env,
    createdAt: '2026-05-08T12:00:04.000Z',
  });
  assert.equal(after.questions[0].voteSummary.up, 0);
  assert.equal(after.questions[0].voteSummary.down, 1);
  assert.equal(after.questions[0].voteSummary.userVote, 'down');
});

test('Mini App question vote response includes the new vote when KV list is stale', async () => {
  const kv = new StaleVoteListKv();
  const questionId = 'q-stale-vote-list';
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
    }),
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([{
      sessionSlug: 'alpha',
      questionId,
      questionType: 'agree_unsure_disagree',
      prompt: 'Should vote writes be visible immediately?',
    }]),
  };
  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env,
  });
  const response = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/question-vote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionKey: state.questions[0].questionKey, vote: 'up' }),
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.voteSummary.up, 1);
  assert.equal(body.voteSummary.down, 0);
  assert.equal(body.voteSummary.userVote, 'up');
});

test('Mini App state exposes per-question response counts for popularity scoring', async () => {
  const kv = new MemoryKv();
  const records = [
    ['r1', 'user-a', 'q-many', 'Agree'],
    ['r2', 'user-b', 'q-many', 'Unsure'],
    ['r3', 'user-c', 'q-few', 'Disagree'],
  ];
  for (const [requestId, telegramUserId, questionId, label] of records) {
    await kv.put(`${SUBMIT_REQUEST_KV_PREFIX}${requestId}`, JSON.stringify({
      version: 1,
      requestId,
      status: 'direct_submitted',
      telegramUserId,
      sessionSlug: 'alpha',
      questionId,
      answer: { label, value: label.toLowerCase() },
      createdAt: `2026-05-08T12:00:0${requestId.slice(1)}.000Z`,
    }));
  }
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
    }),
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        sessionSlug: 'alpha',
        questionId: 'q-many',
        questionType: 'agree_unsure_disagree',
        prompt: 'Should answered questions count toward popularity?',
      },
      {
        sessionSlug: 'alpha',
        questionId: 'q-few',
        questionType: 'agree_unsure_disagree',
        prompt: 'Should lightly answered questions rank lower?',
      },
      {
        sessionSlug: 'alpha',
        questionId: 'q-none',
        questionType: 'agree_unsure_disagree',
        prompt: 'Should unanswered questions start at zero?',
      },
    ]),
  };

  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env,
    createdAt: '2026-05-08T12:00:04.000Z',
  });

  const counts = Object.fromEntries(state.questions.map((question) => [question.prompt, question.responseCount]));
  assert.equal(counts['Should answered questions count toward popularity?'], 2);
  assert.equal(counts['Should lightly answered questions rank lower?'], 1);
  assert.equal(counts['Should unanswered questions start at zero?'], 0);

  await kv.put('telegram:agent-only:answer-state:v1:alpha:w-2026-06-12:user-a', JSON.stringify({
    type: 'telegram_agent_only_answer_state',
    version: 1,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: 'user-a',
    byStatement: {
      'q-many': {
        agent: { answer: { value: 'agent-only-sidecar-answer' }, confidence: 99 },
        agentSkip: null,
        human: null,
      },
    },
    counts: { answers: 1, skips: 0 },
    createdAt: '2026-06-12T15:10:00.000Z',
    updatedAt: '2026-06-12T15:10:00.000Z',
  }), { metadata: { v: 1, t: 'ao_ans', sg: 'alpha', w: 'w-2026-06-12', a: 1, s: 0 } });
  const afterSidecar = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env,
    createdAt: '2026-05-08T12:00:05.000Z',
  });
  const afterCounts = Object.fromEntries(afterSidecar.questions.map((question) => [question.prompt, question.responseCount]));
  assert.deepEqual(afterCounts, counts);
  assert.equal(JSON.stringify(afterSidecar).includes('agent-only-sidecar-answer'), false);
});

test('Mini App results endpoint summarizes consensus, divisive questions, groups, and group analysis', async () => {
  const kv = new MemoryKv();
  const submitRecords = [
    ['r1', 'user-a', 'q-consensus', { value: 'agree', label: 'Agree' }],
    ['r2', 'user-b', 'q-consensus', { value: 'agree', label: 'Agree' }],
    ['r3', 'user-a', 'q-divisive', { value: 'agree', label: 'Agree' }],
    ['r4', 'user-b', 'q-divisive', { value: 'disagree', label: 'Disagree' }],
    ['r5', 'user-c', 'q-divisive', { value: 'unsure', label: 'Unsure' }],
  ];
  for (const [id, telegramUserId, questionId, answer] of submitRecords) {
    await kv.put(`${SUBMIT_REQUEST_KV_PREFIX}${id}`, JSON.stringify({
      version: 1,
      requestId: id,
      status: 'direct_submitted',
      lane: 'telegram_mini_app',
      telegramUserId,
      sessionSlug: 'alpha',
      questionId,
      answer,
      createdAt: `2026-05-08T12:00:0${id.slice(1)}.000Z`,
    }));
  }
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
        telegramOnly: true,
        resultsExposure: { anonymizedGroupsEnabled: true },
      }],
    }),
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        sessionSlug: 'alpha',
        questionId: 'q-consensus',
        questionType: 'agree_unsure_disagree',
        prompt: 'Should the team keep the current plan?',
      },
      {
        sessionSlug: 'alpha',
        questionId: 'q-divisive',
        questionType: 'agree_unsure_disagree',
        prompt: 'Should the team change the launch date?',
      },
      {
        sessionSlug: 'alpha',
        questionId: 'q-freeform',
        questionType: 'freeform',
        prompt: 'What context is missing?',
      },
    ]),
  };

  const response = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/results?sessionSlug=alpha&clusters=2'),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.sessionSlug, 'alpha');
  assert.equal(body.responseCount, 5);
  assert.equal(body.binaryQuestionCount, 2);
  assert.equal(body.exposure.participantLevel, 4);
  assert.equal(body.viewLevels.find((level) => level.key === 'aggregate_results').enabled, true);
  assert.equal(body.viewLevels.find((level) => level.key === 'anonymized_groups').enabled, true);
  assert.equal(body.publicSnapshot.type, 'ce_public_results_snapshot');
  assert.equal(body.publicSnapshot.audience, 'telegram_participant');
  assert.equal(body.publicSnapshot.counts.responsesGiven, 5);
  assert.equal(body.groupView.clusterCount, 2);
  assert.equal(body.publicSnapshot.exposure.clusterCount, 2);
  assert.equal(body.publicSnapshot.aggregateResults.consensus[0].questionId, 'q-consensus');
  assert.equal(body.questions.consensus[0].questionId, 'q-consensus');
  assert.equal(body.questions.divisive[0].questionId, 'q-divisive');
  assert.equal(body.questions.divisive[0].counts.Disagree, 1);
  assert.equal(body.groups.length > 0, true);
  assert.equal(body.topicMap.availability.available, true);
  assert.equal(body.topicMap.counts.answeredQuestions, 2);
  assert.equal(body.topicMap.topics.length > 0, true);
  assert.equal(body.publicSnapshot.topicMap.enabled, true);

  await kv.put('telegram:agent-only:answer-event:v1:alpha:w-2026-06-12:user-a:1718192021223-deadbeef', JSON.stringify({
    type: 'telegram_agent_only_answer_event',
    version: 1,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: 'user-a',
    questionId: 'q-consensus',
    source: 'agent_autofill',
    eventKind: 'answer',
    answer: { value: 'agent-only-sidecar-answer' },
    confidence: 99,
    createdAt: '2026-06-12T15:10:00.000Z',
  }), { metadata: { v: 1, t: 'ao_evt', k: 'a', src: 'agent_autofill' } });
  await kv.put('telegram:agent-only:answer-state:v1:alpha:w-2026-06-12:user-a', JSON.stringify({
    type: 'telegram_agent_only_answer_state',
    version: 1,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: 'user-a',
    byStatement: {
      'q-consensus': {
        agent: { answer: { value: 'agent-only-sidecar-answer' }, confidence: 99 },
        agentSkip: null,
        human: null,
      },
    },
    counts: { answers: 1, skips: 0 },
    createdAt: '2026-06-12T15:10:00.000Z',
    updatedAt: '2026-06-12T15:10:00.000Z',
  }), { metadata: { v: 1, t: 'ao_ans', sg: 'alpha', w: 'w-2026-06-12', a: 1, s: 0 } });
  const afterSidecarResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/results?sessionSlug=alpha&clusters=2'),
    env,
  });
  const afterSidecarBody = await afterSidecarResponse.json();
  assert.equal(afterSidecarResponse.status, 200);
  assert.equal(afterSidecarBody.responseCount, body.responseCount);
  assert.deepEqual(afterSidecarBody.questions.consensus, body.questions.consensus);
  assert.deepEqual(afterSidecarBody.questions.divisive, body.questions.divisive);
  assert.equal(JSON.stringify(afterSidecarBody).includes('agent-only-sidecar-answer'), false);

  const cachedResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/results?sessionSlug=alpha&clusters=2'),
    env,
  });
  const cachedBody = await cachedResponse.json();
  assert.equal(cachedBody.topicMap.cache.status, 'hit');

  const analysisResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/results', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'analyze_group',
        sessionSlug: 'alpha',
        groupId: body.groups[0].groupId,
        clusterCount: 2,
      }),
    }),
    env,
  });
  const analysisBody = await analysisResponse.json();

  assert.equal(analysisResponse.status, 200);
  assert.equal(analysisBody.ok, true);
  assert.equal(analysisBody.group.groupId, body.groups[0].groupId);
  assert.match(analysisBody.analysis.short, /group/i);
});

test('Mini App results hides level 4 group views unless an admin enables anonymized groups', async () => {
  const kv = new MemoryKv();
  const submitRecords = [
    ['r1', 'user-a', 'q-consensus', { value: 'agree', label: 'Agree' }],
    ['r2', 'user-b', 'q-consensus', { value: 'agree', label: 'Agree' }],
    ['r3', 'user-a', 'q-divisive', { value: 'agree', label: 'Agree' }],
    ['r4', 'user-b', 'q-divisive', { value: 'disagree', label: 'Disagree' }],
  ];
  for (const [id, telegramUserId, questionId, answer] of submitRecords) {
    await kv.put(`${SUBMIT_REQUEST_KV_PREFIX}${id}`, JSON.stringify({
      version: 1,
      requestId: id,
      status: 'direct_submitted',
      lane: 'telegram_mini_app',
      telegramUserId,
      sessionSlug: 'alpha',
      questionId,
      answer,
      createdAt: `2026-05-08T12:00:0${id.slice(1)}.000Z`,
    }));
  }
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
    }),
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        sessionSlug: 'alpha',
        questionId: 'q-consensus',
        questionType: 'agree_unsure_disagree',
        prompt: 'Should the team keep the current plan?',
      },
      {
        sessionSlug: 'alpha',
        questionId: 'q-divisive',
        questionType: 'agree_unsure_disagree',
        prompt: 'Should the team change the launch date?',
      },
      {
        sessionSlug: 'alpha',
        questionId: 'q-unavailable',
        questionType: 'agree_unsure_disagree',
      },
    ]),
  };

  const response = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/results?sessionSlug=alpha'),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.exposure.participantLevel, 3);
  assert.equal(body.counts.questionsSubmitted, 3);
  assert.equal(body.counts.answerableQuestions, 2);
  assert.equal(body.groupView.enabled, false);
  assert.equal(body.groupView.reason, 'level_4_anonymized_groups_admin_disabled');
  assert.deepEqual(body.groups, []);
  assert.equal(body.publicSnapshot.aggregateResults.consensus.length > 0, true);
  assert.equal(body.topicMap.availability.available, true);
  assert.equal(body.publicSnapshot.topicMap.enabled, true);
  assert.equal(body.publicSnapshot.anonymizedGroups.enabled, false);
  assert.equal(body.viewLevels.find((level) => level.key === 'aggregate_results').enabled, true);
  assert.equal(body.viewLevels.find((level) => level.key === 'anonymized_groups').status, 'admin_can_enable');

  const analysisResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/results', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'analyze_group',
        sessionSlug: 'alpha',
        groupId: 'group-1',
      }),
    }),
    env,
  });
  const analysisBody = await analysisResponse.json();

  assert.equal(analysisResponse.status, 403);
  assert.equal(analysisBody.ok, false);
  assert.equal(analysisBody.error, 'level_4_anonymized_groups_admin_disabled');
  assert.equal(analysisBody.summary.groupView.enabled, false);
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
        telegramBridgeEnabled: true, telegramOnly: true,
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
    AGENT_BRIDGE_OPENAI_API_KEY: 'sk-bridge-openai',
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true, telegramOnly: true,
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
      assert.equal(body.apiKey, 'sk-bridge-openai');
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

test('Mini App transcribe endpoint uses bridge OpenAI key before session worker auth', async () => {
  const kv = new MemoryKv();
  const questionId = 'q-transcribe';
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_DEPLOYMENT_ID: 'test-deploy',
    DEMO_SIGNER_ROOT_SECRET: 'test-root-secret',
    AGENT_BRIDGE_OPENAI_API_KEY: 'sk-bridge-openai',
    AGENT_BRIDGE_OPENAI_TRANSCRIBE_URL: 'https://api.openai.example/v1/audio/transcriptions',
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
        telegramBridgeEnabled: true, telegramOnly: true,
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
    if (target === 'https://api.openai.example/v1/audio/transcriptions') {
      assert.equal(init.headers.Authorization, 'Bearer sk-bridge-openai');
      assert.equal(init.body.get('model'), 'whisper-1');
      assert.equal(init.body.get('apiKey'), null);
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
  assert.deepEqual(calls.map((call) => call.url), ['https://api.openai.example/v1/audio/transcriptions']);
});

test('Mini App transcribe endpoint accepts session-scoped AI search dictation without a question key', async () => {
  const kv = new MemoryKv();
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_DEPLOYMENT_ID: 'test-deploy',
    DEMO_SIGNER_ROOT_SECRET: 'test-root-secret',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true, telegramOnly: true,
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

test('Mini App transcribe endpoint rejects oversized microphone audio before upstream auth', async () => {
  const env = {
    AGENT_ACTION_KV: new MemoryKv(),
    AGENT_BRIDGE_TRANSCRIBE_MAX_BYTES: '4',
  };
  let upstreamCalled = false;
  env.AGENT_BRIDGE_FETCH = async () => {
    upstreamCalled = true;
    return new Response('{}', { status: 500, headers: { 'content-type': 'application/json' } });
  };
  const form = new FormData();
  form.append('sessionSlug', 'alpha');
  form.append('audio', new File(['too-large'], 'large.webm', { type: 'audio/webm' }));

  const response = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/transcribe', {
      method: 'POST',
      body: form,
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 413);
  assert.equal(body.error, 'audio_file_too_large');
  assert.equal(body.maxBytes, 4);
  assert.equal(upstreamCalled, false);
});

test('Mini App transcribe endpoint rate limits repeated microphone requests per user and session', async () => {
  const kv = new MemoryKv();
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_DEPLOYMENT_ID: 'test-deploy',
    DEMO_SIGNER_ROOT_SECRET: 'test-root-secret',
    AGENT_BRIDGE_TRANSCRIBE_RATE_LIMIT: '1',
    AGENT_BRIDGE_TRANSCRIBE_RATE_WINDOW_SECONDS: '60',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
        telegramOnly: true,
        sponsoredAiAllowed: true,
        sessionWorkerUrl: 'https://session.example',
      }],
    }),
  };
  env.AGENT_BRIDGE_FETCH = async (url) => {
    const target = String(url);
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
    if (target.endsWith('/transcribe')) {
      return new Response(JSON.stringify({ text: 'first note' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'unexpected_url' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  };
  async function sendAudio() {
    const form = new FormData();
    form.append('sessionSlug', 'alpha');
    form.append('audio', new File(['audio-bytes'], 'search.webm', { type: 'audio/webm' }));
    return handleTelegramMiniAppRequest({
      request: new Request('https://bridge.example/telegram/mini-app/api/transcribe', {
        method: 'POST',
        body: form,
      }),
      env,
    });
  }

  const first = await sendAudio();
  const firstBody = await first.json();
  const second = await sendAudio();
  const secondBody = await second.json();

  assert.equal(first.status, 200);
  assert.deepEqual(firstBody, { ok: true, text: 'first note' });
  assert.equal(second.status, 429);
  assert.equal(secondBody.error, 'transcribe_rate_limited');
  assert.equal(secondBody.retryAfterSeconds, 60);
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

test('Mini App exposes Cloudflare-managed group UX, collapsible cards, demo toggle, and inline result controls', () => {
  const html = __test__telegramMiniApp.telegramMiniAppHtml();

  assert.match(html, /id="showGroups"[^>]*aria-label="Groups"/);
  assert.match(html, /id="showAddQuestion"[^>]*aria-label="Add question"/);
  assert.match(html, /id="groupsPanel"[^>]*aria-label="Groups"/);
  assert.match(html, /\.sectionTitle \{[\s\S]*font-size: 19\.5px;[\s\S]*font-weight: 700;/);
  assert.match(html, /id="groupsTitleSession"/);
  assert.match(html, /\.groupsTitleSession \{[\s\S]*opacity: 0\.5;/);
  assert.match(html, /id="groupCategories"/);
  assert.match(html, /id="saveGroups"/);
  assert.equal(html.includes('id="saveGroupsTop"'), false);
  assert.equal(html.includes('groupsSessionOptions'), false);
  assert.equal(html.includes('groupsSessionOptions: document.getElementById'), false);
  assert.equal(html.includes('el.refreshGroups'), false);
  assert.equal(html.includes('el.saveGroupsTop'), false);
  assert.equal(html.includes("categories + ' categories | ' + joined + ' selected'"), false);
  assert.match(html, /function renderGroups\(\)/);
  assert.match(html, /state\.groupCategoryOpen\[categoryId\] === true/);
  assert.match(html, /section\.className = 'groupCategory' \+ \(expanded \? '' : ' collapsed'\);/);
  assert.match(html, /header\.setAttribute\('aria-expanded', expanded \? 'true' : 'false'\);/);
  assert.match(html, /\.groupCategory\.collapsed \.groupOptions \{ display: none; \}/);
  assert.match(html, /el\.groupsTitleSession\.textContent = currentSession\.sessionName \|\| state\.groupsSessionSlug \|\| '';/);
  assert.match(html, /el\.groupsSummary\.textContent = categories\.length \? '' : 'No groups are configured for this session\.';/);
  assert.match(html, /\/telegram\/mini-app\/api\/groups/);
  assert.match(html, /id="addQuestionPanel"/);
  assert.match(html, /class="sectionTitle addQuestionTitle"[\s\S]*<span>Add question<\/span>[\s\S]*id="addQuestionTitleSession"/);
  assert.match(html, /\.addQuestionTitleSession \{[\s\S]*opacity: 0\.5;[\s\S]*font-size: 12px;[\s\S]*color: var\(--muted\);/);
  assert.match(html, /addQuestionTitleSession: document\.getElementById\('addQuestionTitleSession'\)/);
  assert.match(html, /el\.addQuestionTitleSession\.textContent = currentSession\.sessionName \|\| state\.addQuestionSessionSlug \|\| 'No session selected';/);
  assert.equal(html.includes('id="resetAddQuestion"'), false);
  assert.equal(html.includes("resetAddQuestion: document.getElementById('resetAddQuestion')"), false);
  assert.equal(html.includes('function resetAddQuestionForm()'), false);
  assert.equal(html.includes('el.resetAddQuestion.onclick'), false);
  assert.equal(html.includes('id="addQuestionSessionOptions"'), false);
  assert.equal(html.includes('Choose a type, write the prompt, then add it to the session.'), false);
  assert.equal(html.includes('id="addQuestionSessionContext"'), false);
  assert.equal(html.includes('id="addQuestionTags"'), false);
  assert.match(html, /id="toggleAddQuestionUrl"[^>]*>from URL<\/button>/);
  assert.match(html, /id="addQuestionUrlControls"/);
  assert.match(html, /id="addQuestionUrl"[^>]*placeholder="https:\/\/example\.com\/source"/);
  assert.match(html, /id="generateUrlQuestions"/);
  assert.match(html, /id="urlQuestionCandidates"/);
  assert.match(html, /id="submitUrlQuestions"/);
  assert.match(html, /function renderUrlQuestionCandidates\(\)/);
  assert.match(html, /function generateQuestionsFromUrl\(\)/);
  assert.match(html, /function submitGeneratedUrlQuestions\(\)/);
  assert.match(html, /const URL_GENERATED_QUESTION_COUNT = 5;/);
  assert.match(html, /\/telegram\/mini-app\/api\/questions\/generate-from-url/);
  assert.match(html, /class="commentBox addQuestionPromptBox"/);
  assert.match(html, /id="addQuestionMic"[^>]*aria-label="Dictate question"/);
  assert.match(html, /addQuestionMic: document\.getElementById\('addQuestionMic'\)/);
  assert.match(html, /el\.addQuestionMic\.onclick = \(\) => startAddQuestionDictation\(el\.addQuestionMic\);/);
  assert.match(html, /function startAddQuestionDictation\(button\)/);
  assert.match(html, /function startAddQuestionSpeechRecognitionFallback\(button\)/);
  assert.match(html, /function startAddQuestionTranscriptionProgress\(\)/);
  assert.match(html, /Transcribing question audio/);
  assert.match(html, /function formatAddQuestionDraft\(text, options = \{\}\)/);
  assert.match(html, /\/telegram\/mini-app\/api\/questions\/format/);
  assert.match(html, /questionType: inferQuestionType \? 'auto' : state\.addQuestionType/);
  assert.match(html, /await formatAddQuestionDraft\(text, \{ inferQuestionType: true \}\);/);
  assert.match(html, /sessionContext: state\.addQuestionSessionContext/);
  assert.match(html, /tags: normalizeQuestionTags\(state\.addQuestionTags\)/);
  assert.match(html, /state\.addQuestionOptions = nextQuestionType === 'multichoice'/);
  assert.match(html, /state\.addQuestionTags = formatted\.tags\.join\(', '\);/);
  assert.match(html, /id="addQuestionTypes"/);
  assert.match(html, /\/telegram\/mini-app\/api\/questions\/add/);
  assert.match(html, /id="resultGroupChart"/);
  assert.match(html, /id="resultClusterControls"/);
  assert.match(html, /id="topicMapSection"[^>]*aria-label="Topic map"/);
  assert.match(html, /id="topicMapChart"/);
  assert.match(html, /function renderTopicMap\(topicMap\)/);
  assert.match(html, /setResultSectionOpen\('topicMap', el\.topicMapSection, el\.toggleTopicMapSection\);/);
  assert.match(html, /id="moreConsensusResults"/);
  assert.match(html, /id="moreDivisiveResults"/);
  assert.match(html, /resultsUrl\.searchParams\.set\('clusters', String\(RESULT_GROUP_COUNT\)\)/);
  assert.equal(html.includes('/telegram/mini-app/api/results-image'), false);
  assert.equal(html.includes('id="renderConsensusImage"'), false);
  assert.equal(html.includes('id="renderGroupImage"'), false);
  assert.equal(html.includes('fetch(imageUrl.pathname + imageUrl.search'), false);
  assert.match(html, /id="demoDataResults"/);
  assert.equal(html.includes('id="demoDataResultsInline"'), false);
  assert.match(html, /Demo data/);
  assert.match(html, /expandedQuestionKeys: new Set\(\)/);
  assert.match(html, /highlightedQuestionKey/);
  assert.match(html, /scrollHighlightedQuestionIntoView/);
  assert.match(html, /\.card\.collapsed \.expandedOnly \{ display: none; \}/);
  assert.match(html, /className = 'card' \+ \(expanded \? '' : ' collapsed'\)/);
  assert.match(html, /renderAnswerControls\(question, body, \{ showComments: true \}\);/);
  assert.match(html, /function renderAnswerControls\(question, mount, \{ showComments = true \} = \{\}\)/);
  assert.match(html, /commentBox\.className = 'commentBox commentsSection expandedOnly';/);
  assert.match(html, /tagRow\.className = 'questionTags expandedOnly';/);
  assert.match(html, /mount\.appendChild\(commentBox\);[\s\S]*tagRow\.className = 'questionTags expandedOnly';/);
  assert.equal(html.includes('headText.appendChild(tagRow);'), false);
  assert.equal(html.includes("meta.textContent = 'Question ' + question.displayIndex;"), false);
  assert.match(html, /\.cardToggle \{[\s\S]*border: 0;[\s\S]*background: transparent;/);
  assert.match(html, /CARET_DOWN_ICON/);
  assert.match(html, /groupCountryDetails/);
  assert.match(html, /Groups saved/);
  assert.doesNotMatch(html, /setStatus\('Groups saved\./);
  assert.doesNotMatch(html, /toggle\.textContent = expanded \? '−' : '\+'/);
});

test('Mini App state and group endpoints support lightweight Telegram-only groups', async () => {
  const kv = new MemoryKv();
  const env = {
    AGENT_ACTION_KV: kv,
    DEMO_SIGNER_ROOT_SECRET: 'unit-root-secret',
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
        telegramOnly: true,
        lightweightGroups: [{
          categoryId: 'demo_track',
          label: 'Demo track',
          selectionMode: 'single',
          options: [{ optionId: 'builder', label: 'Builder' }],
        }],
      }],
    }),
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([{
      sessionSlug: 'alpha',
      questionId: 'q-group-state',
      questionType: 'freeform',
      prompt: 'Which group should review this?',
    }]),
  };

  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env,
  });

  assert.equal(state.ok, true);
  assert.equal(state.groups.enabled, true);
  assert.equal(state.groups.sessionSlug, 'alpha');
  assert.equal(state.groups.categories.some((category) => category.categoryId === 'age_bucket'), true);
  const attendance = state.groups.categories.find((category) => category.categoryId === 'events_attended');
  assert.equal(attendance.label, 'Attendance');
  assert.deepEqual(attendance.options.map((option) => option.optionId), [
    'week_1',
    'week_2',
    'week_3',
    'week_4',
    'entire_month',
    'attended_previous_edge_events',
  ]);
  assert.equal(state.groups.categories.some((category) => category.categoryId === 'time_in_crypto'), false);
  assert.equal(state.groups.categories.some((category) => category.categoryId === 'primary_focus'), false);
  assert.equal(state.groups.categories.some((category) => category.categoryId === 'demo_track'), true);
  assert.equal(state.groups.categories.some((category) => (
    category.categoryId === 'contribution_role' &&
    category.options.some((option) => option.optionId === 'investor')
  )), true);

  const saveResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/groups?sessionSlug=alpha', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        selections: {
          age_bucket: ['25_34'],
          ai_tribe: ['e_acc', 'pause_ai'],
          country_relationship: ['live_in', 'citizen_of'],
          contribution_role: ['other'],
          events_attended: ['week_1', 'attended_previous_edge_events'],
          missing_category: ['ignored'],
        },
        details: {
          country_relationship: {
            live_in_country: 'United States',
            citizen_of_country: 'Canada',
          },
          contribution_role: {
            other_text: 'Facilitator',
          },
        },
      }),
    }),
    env,
  });
  const saved = await saveResponse.json();

  assert.equal(saveResponse.status, 200);
  assert.equal(saved.ok, true);
  assert.deepEqual(saved.groups.selections.age_bucket, ['25_34']);
  assert.deepEqual(saved.groups.selections.ai_tribe, ['e_acc']);
  assert.deepEqual(saved.groups.selections.country_relationship, ['live_in', 'citizen_of']);
  assert.deepEqual(saved.groups.selections.contribution_role, ['other']);
  assert.deepEqual(saved.groups.selections.events_attended, ['week_1', 'attended_previous_edge_events']);
  assert.deepEqual(saved.groups.details.country_relationship, {
    live_in_country: 'United States',
    citizen_of_country: 'Canada',
  });
  assert.deepEqual(saved.groups.details.contribution_role, { other_text: 'Facilitator' });
  assert.equal(saved.groups.selections.missing_category, undefined);

  const getResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/groups?sessionSlug=alpha'),
    env,
  });
  const loaded = await getResponse.json();

  assert.equal(getResponse.status, 200);
  assert.deepEqual(loaded.groups.selections.age_bucket, ['25_34']);
  assert.deepEqual(loaded.groups.details.country_relationship, {
    live_in_country: 'United States',
    citizen_of_country: 'Canada',
  });
  assert.deepEqual(loaded.groups.details.contribution_role, { other_text: 'Facilitator' });
});

test('Mini App add question endpoint persists Telegram-only proposed questions', async () => {
  const kv = new MemoryKv();
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
        telegramOnly: true,
        sessionContext: 'Edge City lunch planning with founders and attendees.',
      }],
    }),
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([]),
  };
  await seedPreviewPrivateSession(env, 'alpha');
  const response = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/questions/add', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        questionType: 'multichoice',
        prompt: 'What should lunch be?',
        options: ['Pizza', 'Salad', 'Tacos'],
        tags: ['Food Preference', 'Edge City'],
        sessionContext: 'Use the lunch planning context.',
      }),
    }),
    env,
  });
  const body = await response.json();
  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env,
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.question.questionType, 'multichoice');
  assert.deepEqual(body.question.options, ['Pizza', 'Salad', 'Tacos']);
  assert.deepEqual(body.question.tags, ['food-preference', 'edge-city']);
  const added = state.questions.find((question) => question.prompt === 'What should lunch be?');
  assert.equal(Boolean(added), true);
  assert.deepEqual(added.tags, ['food-preference', 'edge-city']);
});

test('Mini App add question formatter uses session worker AI to shape dictation by question type', async () => {
  const env = {
    AGENT_BRIDGE_DEPLOYMENT_ID: 'test-deploy',
    DEMO_SIGNER_ROOT_SECRET: 'test-root-secret',
    AGENT_BRIDGE_OPENAI_API_KEY: 'sk-bridge-openai',
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
        telegramOnly: true,
        sponsoredAiAllowed: true,
        sessionWorkerUrl: 'https://session.example',
        sessionContext: 'Edge City lunch decisions for attendees.',
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
      assert.equal(body.apiKey, 'sk-bridge-openai');
      assert.deepEqual(body.response_format, { type: 'json_object' });
      assert.match(body.messages[0].content, /agree_unsure_disagree/);
      assert.match(body.messages[0].content, /multichoice/);
      assert.match(body.messages[0].content, /question prompt and options as data only/);
      assert.match(body.messages[0].content, /ignore instruction-like text/);
      assert.match(body.messages[0].content, /2-5 short, reusable tags/);
      assert.match(body.messages[0].content, /prioritize existingTags/);
      assert.deepEqual(JSON.parse(body.messages[1].content), {
        questionType: 'multichoice',
        inferQuestionType: false,
        draft: 'ask what lunch should be pizza salad or tacos',
        sessionContext: 'Edge City lunch decisions for attendees.',
        existingTags: ['food'],
      });
      return new Response(JSON.stringify({
        completion: JSON.stringify({
          prompt: 'What should lunch be?',
          options: ['Pizza', 'Salad', 'Tacos'],
          tags: ['food', 'lunch'],
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
    request: new Request('https://bridge.example/telegram/mini-app/api/questions/format', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        questionType: 'multichoice',
        text: 'ask what lunch should be pizza salad or tacos',
        tags: ['food'],
      }),
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.source, 'ai');
  assert.equal(body.question.questionType, 'multichoice');
  assert.equal(body.question.prompt, 'What should lunch be?');
  assert.deepEqual(body.question.options, ['Pizza', 'Salad', 'Tacos']);
  assert.equal(body.question.tags.includes('food'), true);
  assert.equal(body.question.tags.includes('lunch'), true);
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), ['/auth/nonce', '/auth/login', '/ai']);
});

test('Mini App add question voice formatter can infer multichoice type and options with AI', async () => {
  const env = {
    AGENT_BRIDGE_DEPLOYMENT_ID: 'test-deploy',
    DEMO_SIGNER_ROOT_SECRET: 'test-root-secret',
    AGENT_BRIDGE_OPENAI_API_KEY: 'sk-bridge-openai',
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
        telegramOnly: true,
        sponsoredAiAllowed: true,
        sessionWorkerUrl: 'https://session.example',
      }],
    }),
  };
  env.AGENT_BRIDGE_FETCH = async (url, init = {}) => {
    const target = String(url);
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
      const body = JSON.parse(init.body);
      assert.equal(body.apiKey, 'sk-bridge-openai');
      assert.match(body.messages[0].content, /inferQuestionType is true/);
      assert.deepEqual(JSON.parse(body.messages[1].content), {
        questionType: 'auto',
        inferQuestionType: true,
        draft: 'ask what lunch should be pizza salad or tacos',
        sessionContext: '',
        existingTags: [],
      });
      return new Response(JSON.stringify({
        completion: JSON.stringify({
          questionType: 'multichoice',
          prompt: 'What should lunch be?',
          options: ['Pizza', 'Salad', 'Tacos'],
          tags: ['food', 'lunch'],
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
    request: new Request('https://bridge.example/telegram/mini-app/api/questions/format', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        questionType: 'auto',
        inferQuestionType: true,
        text: 'ask what lunch should be pizza salad or tacos',
      }),
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.source, 'ai');
  assert.equal(body.question.questionType, 'multichoice');
  assert.equal(body.question.prompt, 'What should lunch be?');
  assert.deepEqual(body.question.options, ['Pizza', 'Salad', 'Tacos']);
  assert.equal(body.question.tags.includes('food'), true);
});

test('Mini App add question voice formatter locally infers multichoice when AI is unavailable', async () => {
  const env = {
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
        telegramOnly: true,
      }],
    }),
  };

  const response = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/questions/format', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        questionType: 'auto',
        inferQuestionType: true,
        text: 'ask what lunch should be pizza salad or tacos',
      }),
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.source, 'local_fallback');
  assert.equal(body.question.questionType, 'multichoice');
  assert.equal(body.question.prompt, 'what lunch should be');
  assert.deepEqual(body.question.options, ['pizza', 'salad', 'tacos']);
});

test('Mini App URL question generation endpoint returns AI candidate drafts', async () => {
  const kv = new MemoryKv();
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_DEPLOYMENT_ID: 'test-deploy',
    DEMO_SIGNER_ROOT_SECRET: 'test-root-secret',
    AGENT_BRIDGE_OPENAI_API_KEY: 'sk-bridge-openai',
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Session Lab Organizers',
        telegramBridgeEnabled: true,
        telegramOnly: true,
        sponsoredAiAllowed: true,
        sessionWorkerUrl: 'https://session.example',
        sessionContext: 'Organizers are deciding how to run an session lab experiment and what outcomes matter.',
        telegramQuestionTags: ['session-topic'],
      }],
    }),
  };
  await seedPreviewPrivateSession(env, 'alpha');
  const calls = [];
  env.AGENT_BRIDGE_FETCH = async (url, init = {}) => {
    const target = String(url);
    calls.push({ url: target, init });
    if (target === 'https://example.com/source') {
      return new Response([
        '<html><head><title>Session Lab Brief</title></head><body>',
        'The session lab will explore participant onboarding, agent-mediated sensemaking, organizer workload, privacy, consent, and practical outcomes. ',
        'Organizers need questions that reveal tradeoffs about how to run the experiment and how success should be evaluated.',
        '</body></html>',
      ].join(''), {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    }
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
      const aiBody = JSON.parse(init.body);
      assert.equal(aiBody.apiKey, 'sk-bridge-openai');
      assert.equal(aiBody.max_output_tokens, 6000);
      assert.equal(aiBody.reasoning_effort, 'minimal');
      assert.deepEqual(aiBody.response_format, { type: 'json_object' });
      assert.match(aiBody.messages[1].content, /numberOfSeedStatementsOrPrompts: 2/);
      assert.match(aiBody.messages[1].content, /Session Lab Brief/);
      assert.match(aiBody.messages[1].content, /Organizers are deciding how to run an session lab experiment/);
      return new Response(JSON.stringify({
        completion: JSON.stringify({
          surveyTitle: 'Session Lab Brief',
          questions: [
            {
              prompt: 'Session Lab organizers should prioritize onboarding clarity over adding more demo features.',
              questionType: 'binary',
              tags: ['onboarding'],
            },
            {
              prompt: 'The experiment should measure whether agent-mediated sensemaking improves organizer decisions.',
              questionType: 'binary',
              tags: ['sensemaking'],
            },
          ],
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
    request: new Request('https://bridge.example/telegram/mini-app/api/questions/generate-from-url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        url: 'https://example.com/source',
        count: 2,
        questionType: 'agree_unsure_disagree',
      }),
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.source, 'ai');
  assert.equal(body.sourceTitle, 'Session Lab Brief');
  assert.equal(body.candidates.length, 2);
  assert.equal(body.candidates[0].questionType, 'agree_unsure_disagree');
  assert.equal(body.candidates[0].tags.includes('session-topic'), true);
  assert.equal(body.candidates[0].tags.includes('onboarding'), true);
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), ['/source', '/auth/nonce', '/auth/login', '/ai']);
});

test('Mini App add question endpoint enforces Telegram-native authoring binding', async () => {
  const env = {
    AGENT_ACTION_KV: new MemoryKv(),
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
        telegramOnly: true,
      }],
    }),
  };
  const response = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/questions/add', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        questionType: 'freeform',
        prompt: 'Who can add questions?',
      }),
    }),
    env,
  });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'telegram_group_binding_required');
});

test('Mini App add question endpoint keeps agree questions binary', async () => {
  const kv = new MemoryKv();
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
        telegramOnly: true,
      }],
    }),
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([]),
  };
  await seedPreviewPrivateSession(env, 'alpha');
  const response = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/questions/add', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        questionType: 'agree_unsure_disagree',
        prompt: 'Should this render as buttons?',
      }),
    }),
    env,
  });
  const body = await response.json();
  const state = await __test__telegramMiniApp.buildMiniAppState({
    request: new Request('https://bridge.example/telegram/mini-app/api/state'),
    env,
  });
  const added = state.questions.find((question) => question.prompt === 'Should this render as buttons?');

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.question.questionType, 'binary');
  assert.equal(added.questionType, 'agree_unsure_disagree');
});

test('Mini App group and image routes enforce Telegram-only and results exposure boundaries', async () => {
  const nonTelegramOnlyEnv = {
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
        telegramOnly: false,
      }],
    }),
  };
  const groupsResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/groups?sessionSlug=alpha'),
    env: nonTelegramOnlyEnv,
  });
  const groupsBody = await groupsResponse.json();

  assert.equal(groupsResponse.status, 403);
  assert.equal(groupsBody.error, 'telegram_only_session_required');

  const aggregateDisabledEnv = {
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
        telegramOnly: true,
        resultsExposure: {
          aggregateResultsEnabled: false,
        },
      }],
    }),
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([{
      sessionSlug: 'alpha',
      questionId: 'q-pizza',
      questionType: 'agree_unsure_disagree',
      prompt: 'Leftover pizza tastes better cold than reheated.',
    }]),
  };
  const imageResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/results-image?sessionSlug=alpha&mode=consensus'),
    env: aggregateDisabledEnv,
  });
  const imageBody = await imageResponse.json();

  assert.equal(imageResponse.status, 403);
  assert.equal(imageBody.error, 'level_3_aggregate_results_admin_disabled');

  const topicImageResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/results-image?sessionSlug=alpha&mode=topic-map'),
    env: aggregateDisabledEnv,
  });
  const topicImageBody = await topicImageResponse.json();

  assert.equal(topicImageResponse.status, 403);
  assert.equal(topicImageBody.error, 'level_3_aggregate_results_admin_disabled');
});

test('Mini App results demo data and image endpoint render PNG previews', async () => {
  const env = {
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
        telegramOnly: true,
      }],
    }),
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([{
      sessionSlug: 'alpha',
      questionId: 'q-pizza',
      questionType: 'agree_unsure_disagree',
      prompt: 'Leftover pizza tastes better cold than reheated.',
    }]),
  };

  const summaryResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/results?sessionSlug=alpha&demo=1'),
    env,
  });
  const summary = await summaryResponse.json();

  assert.equal(summaryResponse.status, 200);
  assert.equal(summary.ok, true);
  assert.equal(summary.demo, true);
  assert.equal(summary.questionCount >= 10, true);
  assert.equal(summary.responseCount > 0, true);
  assert.equal(summary.groupView.status, 'demo_preview');
  assert.equal(summary.groups.length > 0, true);
  assert.equal(JSON.stringify(summary).includes('Leftover pizza tastes better cold than reheated.'), false);

  const analysisResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/results', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        demo: true,
        action: 'analyze_group',
        groupId: summary.groups[0].groupId,
      }),
    }),
    env,
  });
  const analysis = await analysisResponse.json();

  assert.equal(analysisResponse.status, 200);
  assert.equal(analysis.ok, true);
  assert.match(analysis.analysis.name, /Builders|Stewards|Seekers|cluster/i);

  const imageResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/results-image?sessionSlug=alpha&mode=consensus&demo=1'),
    env,
  });
  const bytes = new Uint8Array(await imageResponse.arrayBuffer());

  assert.equal(imageResponse.status, 200);
  assert.equal(imageResponse.headers.get('content-type'), 'image/png');
  assert.deepEqual(Array.from(bytes.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);

  const consensusImageResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/results-image?sessionSlug=alpha&mode=consensus&sort=most_consensus&demo=1'),
    env,
  });
  const consensusBytes = new Uint8Array(await consensusImageResponse.arrayBuffer());

  assert.equal(consensusImageResponse.status, 200);
  assert.equal(consensusImageResponse.headers.get('content-type'), 'image/png');
  assert.deepEqual(Array.from(consensusBytes.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);

  const topicImageResponse = await handleTelegramMiniAppRequest({
    request: new Request('https://bridge.example/telegram/mini-app/api/results-image?sessionSlug=alpha&mode=topic-map&demo=1'),
    env,
  });
  const topicBytes = new Uint8Array(await topicImageResponse.arrayBuffer());

  assert.equal(topicImageResponse.status, 200);
  assert.equal(topicImageResponse.headers.get('content-type'), 'image/png');
  assert.deepEqual(Array.from(topicBytes.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
});

test('Mini App live results can filter by saved lightweight group details', async () => {
  const kv = new MemoryKv();
  const env = {
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_DEFAULT_SESSION_SLUG: 'alpha',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
        telegramOnly: true,
        resultsExposure: { minGroupSize: 2, anonymizedGroupsEnabled: true },
      }],
    }),
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([{
      sessionSlug: 'alpha',
      questionId: 'q-filter',
      questionType: 'agree_unsure_disagree',
      prompt: 'Should filtered results include this?',
    }]),
  };
  await kv.put('telegram:submit-request:one', JSON.stringify({
    status: 'submit_request_created',
    sessionSlug: 'alpha',
    telegramUserId: 'user-a',
    questionId: 'q-filter',
    answer: { questionType: 'agree_unsure_disagree', value: 'agree', label: 'Agree' },
    createdAt: '2026-05-25T00:00:00.000Z',
  }));
  await kv.put('telegram:submit-request:two', JSON.stringify({
    status: 'submit_request_created',
    sessionSlug: 'alpha',
    telegramUserId: 'user-b',
    questionId: 'q-filter',
    answer: { questionType: 'agree_unsure_disagree', value: 'disagree', label: 'Disagree' },
    createdAt: '2026-05-25T00:01:00.000Z',
  }));
  await kv.put('telegram:submit-request:three', JSON.stringify({
    status: 'submit_request_created',
    sessionSlug: 'alpha',
    telegramUserId: 'user-c',
    questionId: 'q-filter',
    answer: { questionType: 'agree_unsure_disagree', value: 'agree', label: 'Agree' },
    createdAt: '2026-05-25T00:02:00.000Z',
  }));
  await kv.put('telegram:lightweight-group-membership:alpha:user-a', JSON.stringify({
    sessionSlug: 'alpha',
    telegramUserId: 'user-a',
    selections: { age_bucket: ['25_34'], country_relationship: ['live_in'] },
    details: { country_relationship: { live_in_country: 'United States' } },
  }));
  await kv.put('telegram:lightweight-group-membership:alpha:user-b', JSON.stringify({
    sessionSlug: 'alpha',
    telegramUserId: 'user-b',
    selections: { age_bucket: ['35_44'], country_relationship: ['live_in'] },
    details: { country_relationship: { live_in_country: 'Canada' } },
  }));
  await kv.put('telegram:lightweight-group-membership:alpha:user-c', JSON.stringify({
    sessionSlug: 'alpha',
    telegramUserId: 'user-c',
    selections: { age_bucket: ['25_34'], country_relationship: ['live_in'] },
    details: { country_relationship: { live_in_country: 'United States' } },
  }));

  const filters = encodeURIComponent(JSON.stringify({
    selections: { age_bucket: ['25_34'], country_relationship: ['live_in'] },
    details: { country_relationship: { live_in_country: 'United States' } },
  }));
  const response = await handleTelegramMiniAppRequest({
    request: new Request(`https://bridge.example/telegram/mini-app/api/results?sessionSlug=alpha&filters=${filters}`),
    env,
  });
  const summary = await response.json();

  assert.equal(response.status, 200);
  assert.equal(summary.ok, true);
  assert.equal(summary.demo, false);
  assert.equal(summary.responseCount, 2);
  assert.equal(summary.participantCount, 2);
  assert.equal(summary.filters.applied, true);
  assert.equal(summary.filters.matchedParticipants, 2);
  assert.equal(summary.publicSnapshot.filters.applied, true);
  assert.equal(summary.publicSnapshot.filters.matchedParticipants, 2);
  assert.deepEqual(summary.publicSnapshot.filters.details, {
    country_relationship: { live_in_country: 'United States' },
  });
  assert.equal(summary.questions.consensus[0].counts.Agree, 2);
  assert.equal(summary.questions.consensus[0].counts.Disagree, undefined);
});
