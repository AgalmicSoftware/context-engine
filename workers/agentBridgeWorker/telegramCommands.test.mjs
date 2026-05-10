import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTelegramCommandResponse,
  dispatchTelegramCommandResponse,
  parseTelegramCommandText,
} from './telegramCommands.mjs';
import { __test__sessionQuestions } from './sessionQuestions.mjs';

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
}

function baseEnv(overrides = {}) {
  return {
    TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
    TELEGRAM_BOT_TOKEN: '123456:test-token',
    DEFAULT_CHAIN_ID: '11155420',
    DEFAULT_RPC_URL: 'https://rpc.example.test',
    DEMO_SIGNER_ROOT_SECRET: 'unit-root',
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      allowQuestionGeneration: true,
      allowGenerateQuestion: true,
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        default: true,
        telegramBridgeEnabled: true,
        managedAccountSubmitAllowed: true,
        docLibraryEnabled: true,
      }],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        questionId: 'q-readiness',
        questionType: 'freeform',
        prompt: 'What should Alpha decide next?',
      },
      {
        questionId: 'q-locked',
        questionType: 'freeform',
        prompt: 'Private prompt must not leak',
        visibility: 'sbt_gated',
      },
    ]),
    AGENT_BRIDGE_DEMO_DOCS_JSON: JSON.stringify([
      {
        docId: 'doc-public',
        sessionSlug: 'alpha',
        title: 'Public plan',
        fileType: 'md',
        visibility: 'public',
        contentPreview: 'Safe public summary',
      },
      {
        docId: 'doc-gated',
        sessionSlug: 'alpha',
        title: 'Gated appendix',
        fileType: 'pdf',
        visibility: 'sbt_gated',
        privateContentRef: 'r2://private/gated.pdf',
      },
    ]),
    AGENT_ACTION_KV: new MemoryKv(),
    ...overrides,
  };
}

function groupMessage(text) {
  return {
    update_id: 7001,
    message: {
      message_id: 11,
      text,
      chat: { id: -100123, type: 'supergroup', title: 'Alpha Lobby' },
      from: { id: 42, username: 'host' },
    },
  };
}

function privateMessage(text) {
  return {
    update_id: 7002,
    message: {
      message_id: 12,
      text,
      chat: { id: 42, type: 'private' },
      from: { id: 42, username: 'participant' },
    },
  };
}

function word(value) {
  return BigInt(value).toString(16).padStart(64, '0');
}

function encodeRegistryStringResult(value = '') {
  const bytes = new TextEncoder().encode(String(value));
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const paddedLength = Math.ceil(hex.length / 64) * 64;
  return `0x${word(32)}${word(bytes.length)}${hex.padEnd(paddedLength, '0')}`;
}

function registryFetchForSlugs(slugs = []) {
  return async (_url, init = {}) => {
    const body = JSON.parse(init.body || '{}');
    const data = String(body.params?.[0]?.data || '');
    if (data === '0x6e6734bf') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: `0x${word(slugs.length)}` }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (data.startsWith('0x27916a76')) {
      const index = Number(BigInt(`0x${data.slice(10) || '0'}`));
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: encodeRegistryStringResult(slugs[index] || '') }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { message: 'unknown call' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
}

function flattenButtons(replyMarkup) {
  return (replyMarkup?.inline_keyboard || []).flat();
}

function launchFromButton(button = {}) {
  if (button.web_app?.url) return new URL(button.web_app.url).searchParams.get('launch') || '';
  if (button.url) return new URL(button.url).searchParams.get('start') || '';
  return '';
}

test('parseTelegramCommandText handles mentions without accepting commands for another bot', () => {
  assert.deepEqual(parseTelegramCommandText('/ce_join@ce_demo_bot alpha', {
    botUsername: 'ce_demo_bot',
  }), {
    isCommand: true,
    command: '/ce_join',
    args: ['alpha'],
    argText: 'alpha',
    mention: 'ce_demo_bot',
    addressedToOtherBot: false,
  });
  assert.equal(parseTelegramCommandText('/ce_join@other_bot alpha', {
    botUsername: 'ce_demo_bot',
  }).addressedToOtherBot, true);
  assert.equal(parseTelegramCommandText('hello').isCommand, false);
});

test('group /ce_join returns a Workers-safe session card with opaque buttons only', async () => {
  const env = baseEnv();
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/ce_join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.command, '/ce_join');
  assert.equal(result.screen, 'group_session_card');
  assert.equal(result.response.chatId, '-100123');
  assert.match(result.response.text, /Session: Alpha Session/);
  assert.match(result.response.text, /Use \/ce_attachments for session files/);
  assert.equal(result.response.text.includes('/ce_me'), false);
  assert.equal(result.response.text.includes('Use /ce_questions'), false);

  const buttons = flattenButtons(result.response.replyMarkup);
  const startButton = buttons.find((button) => button.text === 'Join Session');
  const callbackButtons = buttons.filter((button) => button.callback_data);
  assert.match(startButton.url, /^https:\/\/t\.me\/ce_demo_bot\?start=cetg_[a-z0-9]{10,48}$/);
  assert.equal(startButton.url.includes('alpha'), false);
  assert.equal(callbackButtons.length, 3);
  for (const button of callbackButtons) {
    assert.match(button.callback_data, /^cecb_[a-z0-9]{10,48}$/);
    assert.equal(button.callback_data.includes('alpha'), false);
    assert.equal(button.callback_data.includes('q-readiness'), false);
  }
});

test('/ce_sessions uses live SessionRegistry slugs when no demo session policy is configured', async () => {
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/ce_sessions'),
    env: {
      TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
      DEFAULT_CHAIN_ID: '11155420',
      DEFAULT_RPC_URL: 'https://public-rpc.example',
      ADDITIONAL_RPC_URL: 'https://infura.example/op-sepolia',
      REGISTRY_FETCH: registryFetchForSlugs(['alpha', 'beta-room']),
    },
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'group_session_card');
  assert.match(result.response.text, /Available sessions:/);
  assert.match(result.response.text, /- alpha \(alpha\)/);
  assert.match(result.response.text, /- beta-room \(beta-room\)/);
  assert.equal(result.response.text.includes('general'), false);
});

test('/ce_questions and callback dispatch list questions without leaking locked prompts', async () => {
  const env = baseEnv();
  const joined = await buildTelegramCommandResponse({
    update: groupMessage('/ce_join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const viewQuestions = flattenButtons(joined.response.replyMarkup)
    .find((button) => button.text === 'View Questions');
  const callback = await buildTelegramCommandResponse({
    update: {
      update_id: 7003,
      callback_query: {
        id: 'callback-1',
        data: viewQuestions.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 55,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:01.000Z',
  });

  assert.equal(callback.ok, true);
  assert.equal(callback.response.method, 'editMessageText');
  assert.match(callback.response.text, /Questions for alpha/);
  assert.match(callback.response.text, /q-readiness - What should Alpha decide next/);
  assert.match(callback.response.text, /q-locked - Locked question/);
  assert.equal(callback.response.text.includes('Private prompt must not leak'), false);
});

test('/ce_questions handles bytes32 question IDs without putting them in opaque seeds', async () => {
  const publicQuestionId = `0x${'12'.repeat(32)}`;
  const lockedQuestionId = `0x${'34'.repeat(32)}`;
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/ce_questions alpha'),
    env: baseEnv({
      AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
        {
          questionId: publicQuestionId,
          questionType: 'freeform',
          prompt: 'Can bytes32 question IDs render?',
        },
        {
          questionId: lockedQuestionId,
          questionType: 'freeform',
          prompt: 'Locked bytes32 prompt must not leak',
          visibility: 'lit_encrypted',
        },
      ]),
    }),
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'question_list');
  assert.match(result.response.text, /0x12121212\.\.\.121212 - Can bytes32 question IDs render/);
  assert.match(result.response.text, /0x34343434\.\.\.343434 - Locked question/);
  assert.equal(result.response.text.includes('Locked bytes32 prompt must not leak'), false);
  const buttons = flattenButtons(result.response.replyMarkup);
  assert.equal(buttons.length, 2);
  for (const button of buttons) {
    assert.match(button.callback_data, /^cecb_[a-z0-9]{10,48}$/);
    assert.equal(button.callback_data.includes(publicQuestionId), false);
    assert.equal(button.callback_data.includes(lockedQuestionId), false);
  }
});

test('/ce_questions caps Telegram rows at five and deep-links group Mini App launches through private chat', async () => {
  const questions = Array.from({ length: 7 }, (_value, index) => ({
    questionId: `q-${index + 1}`,
    questionType: index % 2 === 0 ? 'freeform' : 'rating',
    prompt: `Question ${index + 1} prompt`,
  }));
  const env = baseEnv({
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify(questions),
  });
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/ce_questions alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.match(result.response.text, /Showing 5 of 7/);
  assert.match(result.response.text, /Open the Mini App for the full queue/);
  assert.equal(result.response.text.includes('Question 6 prompt'), false);

  const buttons = flattenButtons(result.response.replyMarkup);
  assert.deepEqual(buttons.slice(0, 5).map((button) => button.text), [
    'Pose 1',
    'Pose 2',
    'Pose 3',
    'Pose 4',
    'Pose 5',
  ]);
  const miniApp = buttons.find((button) => button.text === 'Open Mini App');
  assert.equal(miniApp.web_app, undefined);
  assert.match(miniApp.url, /^https:\/\/t\.me\/ce_demo_bot\?start=cecb_[a-z0-9]{10,48}$/);
  assert.equal(miniApp.url.includes('alpha'), false);
  assert.equal(miniApp.url.includes('q-1'), false);

  const launch = launchFromButton(miniApp);
  const repeated = await buildTelegramCommandResponse({
    update: groupMessage('/ce_questions alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const repeatedLaunch = launchFromButton(flattenButtons(repeated.response.replyMarkup)
    .find((button) => button.text === 'Open Mini App'));
  const privateStart = await buildTelegramCommandResponse({
    update: privateMessage(`/start ${launch}`),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const privateMiniApp = flattenButtons(privateStart.response.replyMarkup)
    .find((button) => button.text === 'Open Mini App');

  assert.equal(privateStart.ok, true);
  assert.equal(privateStart.screen, 'private_start');
  assert.match(launch, /^cecb_[a-f0-9]{32}$/);
  assert.match(repeatedLaunch, /^cecb_[a-f0-9]{32}$/);
  assert.notEqual(repeatedLaunch, launch);
  assert.match(privateMiniApp.web_app.url, /^https:\/\/bridge\.example\/telegram\/mini-app\?launch=cecb_[a-z0-9]{10,48}$/);
  assert.equal(new URL(privateMiniApp.web_app.url).searchParams.get('launch'), launch);
});

test('/ce_questions uses Telegram web_app buttons directly in private chat', async () => {
  const result = await buildTelegramCommandResponse({
    update: privateMessage('/ce_questions alpha'),
    env: baseEnv({
      AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
      AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
        { questionId: 'q-private-1', questionType: 'freeform', prompt: 'Private prompt?' },
      ]),
    }),
    now: '2026-05-08T12:00:00.000Z',
  });
  const miniApp = flattenButtons(result.response.replyMarkup)
    .find((button) => button.text === 'Open Mini App');

  assert.equal(result.ok, true);
  assert.equal(miniApp.url, undefined);
  assert.match(miniApp.web_app.url, /^https:\/\/bridge\.example\/telegram\/mini-app\?launch=cecb_[a-z0-9]{10,48}$/);
});

test('/ce_questions prioritizes answerable questions before payload-unavailable rows', async () => {
  const unavailableQuestionId = `0x${'11'.repeat(32)}`;
  const answerableQuestionId = `0x${'22'.repeat(32)}`;
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/ce_questions alpha'),
    env: baseEnv({
      AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
      AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
        {
          questionId: unavailableQuestionId,
          questionType: 'unknown',
          title: 'Question unavailable',
          payloadUnavailable: true,
          visibility: 'payload_unavailable',
        },
        {
          questionId: answerableQuestionId,
          questionType: 'rating',
          prompt: 'How much do you trust this result?',
        },
      ]),
    }),
    now: '2026-05-08T12:00:00.000Z',
  });
  const posed = await buildTelegramCommandResponse({
    update: groupMessage('/q 1'),
    env: baseEnv({
      AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
      AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
        {
          questionId: unavailableQuestionId,
          questionType: 'unknown',
          title: 'Question unavailable',
          payloadUnavailable: true,
          visibility: 'payload_unavailable',
        },
        {
          questionId: answerableQuestionId,
          questionType: 'rating',
          prompt: 'How much do you trust this result?',
        },
      ]),
    }),
    now: '2026-05-08T12:00:01.000Z',
  });

  assert.equal(result.ok, true);
  assert.match(result.response.text, /1\. 0x22222222\.\.\.222222 - How much do you trust this result\?/);
  assert.match(result.response.text, /2\. 0x11111111\.\.\.111111 - Question unavailable/);
  assert.equal(posed.ok, true);
  assert.match(posed.response.text, /How much do you trust this result\?/);
  assert.equal(posed.payloadUnavailable, false);
  assert.equal(posed.posed, true);
});

test('payload-unavailable question rows do not render as encrypted locks', async () => {
  const unavailableQuestionId = `0x${'78'.repeat(32)}`;
  const env = baseEnv({
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        questionId: unavailableQuestionId,
        questionType: 'unknown',
        title: 'Question unavailable',
        payloadUnavailable: true,
        visibility: 'payload_unavailable',
      },
      {
        questionId: `0x${'90'.repeat(32)}`,
        questionType: 'freeform',
        prompt: 'Encrypted prompt must not leak',
        visibility: 'lit_encrypted',
      },
    ]),
  });
  const list = await buildTelegramCommandResponse({
    update: groupMessage('/ce_questions alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const posed = await buildTelegramCommandResponse({
    update: groupMessage(`/q ${unavailableQuestionId.slice(0, 10)}...${unavailableQuestionId.slice(-6)}`),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });

  assert.equal(list.ok, true);
  assert.match(list.response.text, /0x78787878\.\.\.787878 - Question unavailable/);
  assert.match(list.response.text, /0x90909090\.\.\.909090 - Locked question/);
  assert.equal(list.response.text.includes('Encrypted prompt must not leak'), false);

  assert.equal(posed.ok, true);
  assert.match(posed.response.text, /Question 0x78787878\.\.\.787878 is unavailable/);
  assert.match(posed.response.text, /public payload could not be loaded yet/);
  const buttons = flattenButtons(posed.response.replyMarkup);
  assert.equal(buttons.some((button) => button.text === 'Open Mini App'), false);
  assert.equal(posed.payloadUnavailable, true);
  assert.equal(posed.posed, false);
});

test('/ce_questions does not invent demo questions when live question cache is empty', async () => {
  __test__sessionQuestions.clearCaches();
  const questionFetch = async (_url, init = {}) => {
    const body = JSON.parse(init.body || '{}');
    if (body.method === 'eth_blockNumber') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: '0x64' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (body.method === 'eth_getLogs') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected ${body.method}`);
  };
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/ce_questions alpha'),
    env: baseEnv({
      AGENT_BRIDGE_QUESTION_SOURCE: 'live',
      AGENT_BRIDGE_QUESTION_SKIP_SESSION_REGISTRY: '1',
      AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK: '90',
      AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK: '100',
      QUESTION_FETCH: questionFetch,
    }),
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.questionCount, 0);
  assert.equal(result.questionSourceReason, 'live_questions_empty');
  assert.match(result.response.text, /No public questions are available yet/);
  assert.equal(result.response.text.includes('q-readiness'), false);
  assert.equal(result.response.text.includes('What should Alpha decide next'), false);
});

test('/ce_questions reports live source failures without caching them as empty lists', async () => {
  __test__sessionQuestions.clearCaches();
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/ce_questions alpha'),
    env: baseEnv({
      AGENT_BRIDGE_QUESTION_SOURCE: 'live',
      DEFAULT_RPC_URL: '',
      ADDITIONAL_RPC_URL: '',
    }),
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.questionCount, 0);
  assert.equal(result.questionSourceReason, 'question_rpc_url_missing');
  assert.match(result.response.text, /Question source is missing RPC config/);
  assert.equal(result.response.text.includes('No public questions are available yet'), false);
});

test('group session binding makes later question and doc commands use the joined session', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      allowQuestionGeneration: true,
      allowGenerateQuestion: true,
      sessions: [
        {
          sessionSlug: 'alpha',
          sessionName: 'Alpha Session',
          default: true,
          telegramBridgeEnabled: true,
          managedAccountSubmitAllowed: true,
          docLibraryEnabled: true,
        },
        {
          sessionSlug: 'demo',
          sessionName: 'Demo Session',
          telegramBridgeEnabled: true,
          managedAccountSubmitAllowed: true,
          docLibraryEnabled: true,
        },
      ],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        questionId: 'q-demo',
        questionType: 'freeform',
        prompt: 'What should Demo decide next?',
      },
    ]),
    AGENT_BRIDGE_DEMO_DOCS_JSON: JSON.stringify([
      {
        docId: 'doc-demo',
        sessionSlug: 'demo',
        title: 'Demo brief',
        fileType: 'md',
        visibility: 'public',
      },
    ]),
  });

  const joined = await buildTelegramCommandResponse({
    update: groupMessage('/ce_join demo'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const questions = await buildTelegramCommandResponse({
    update: groupMessage('/ce_questions'),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const posed = await buildTelegramCommandResponse({
    update: groupMessage('/q q-demo'),
    env,
    now: '2026-05-08T12:00:02.000Z',
  });
  const docs = await buildTelegramCommandResponse({
    update: groupMessage('/ce_attachments'),
    env,
    now: '2026-05-08T12:00:03.000Z',
  });

  assert.equal(joined.sessionSlug, 'demo');
  assert.match(joined.response.text, /Use \/ce_attachments for session files/);
  assert.equal(joined.response.text.includes('/ce_me'), false);
  assert.equal(joined.response.text.includes('Use /ce_questions'), false);
  assert.match(questions.response.text, /Questions for demo/);
  assert.match(questions.response.text, /q-demo - What should Demo decide next/);
  assert.match(posed.response.text, /Question for demo:/);
  assert.match(docs.response.text, /Attachments for demo/);
  assert.match(docs.response.text, /Demo brief/);
});

test('private session join makes later question commands use the selected session', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [
        {
          sessionSlug: 'alpha',
          sessionName: 'Alpha Session',
          default: true,
          telegramBridgeEnabled: true,
          managedAccountSubmitAllowed: true,
        },
        {
          sessionSlug: 'demo',
          sessionName: 'Demo Session',
          telegramBridgeEnabled: true,
          managedAccountSubmitAllowed: true,
        },
      ],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        sessionSlug: 'alpha',
        questionId: 'q-alpha',
        questionType: 'freeform',
        prompt: 'What should Alpha decide next?',
      },
      {
        sessionSlug: 'demo',
        questionId: 'q-demo',
        questionType: 'freeform',
        prompt: 'What should Demo decide next?',
      },
    ]),
  });

  const joined = await buildTelegramCommandResponse({
    update: privateMessage('/ce_join demo'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const questions = await buildTelegramCommandResponse({
    update: privateMessage('/ce_questions'),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const posed = await buildTelegramCommandResponse({
    update: privateMessage('/q 1'),
    env,
    now: '2026-05-08T12:00:02.000Z',
  });

  assert.equal(joined.sessionSlug, 'demo');
  assert.match(questions.response.text, /Questions for demo/);
  assert.match(questions.response.text, /q-demo - What should Demo decide next/);
  assert.equal(questions.response.text.includes('q-alpha'), false);
  assert.match(posed.response.text, /Question for demo:/);
  assert.match(posed.response.text, /What should Demo decide next/);
});

test('/ce_sessions callback switches the group session used by later question commands', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [
        {
          sessionSlug: 'alpha',
          sessionName: 'Alpha Session',
          default: true,
          telegramBridgeEnabled: true,
          managedAccountSubmitAllowed: true,
        },
        {
          sessionSlug: 'demo',
          sessionName: 'Demo Session',
          telegramBridgeEnabled: true,
          managedAccountSubmitAllowed: true,
        },
      ],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        sessionSlug: 'alpha',
        questionId: 'q-alpha',
        questionType: 'freeform',
        prompt: 'What should Alpha decide next?',
      },
      {
        sessionSlug: 'demo',
        questionId: 'q-demo',
        questionType: 'freeform',
        prompt: 'What should Demo decide next?',
      },
    ]),
  });
  const sessions = await buildTelegramCommandResponse({
    update: groupMessage('/ce_sessions'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const demoButton = flattenButtons(sessions.response.replyMarkup)
    .find((button) => button.text === 'Demo Session');

  const selected = await buildTelegramCommandResponse({
    update: {
      update_id: 7010,
      callback_query: {
        id: 'callback-select-demo',
        data: demoButton.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 60,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const questions = await buildTelegramCommandResponse({
    update: groupMessage('/ce_questions'),
    env,
    now: '2026-05-08T12:00:02.000Z',
  });

  assert.equal(selected.sessionSlug, 'demo');
  assert.match(questions.response.text, /Questions for demo/);
  assert.match(questions.response.text, /q-demo - What should Demo decide next/);
  assert.equal(questions.response.text.includes('q-alpha'), false);
});

test('group Pose Question callback opens a choose-question menu instead of posing the first question', async () => {
  const env = baseEnv();
  const joined = await buildTelegramCommandResponse({
    update: groupMessage('/ce_join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const poseQuestion = flattenButtons(joined.response.replyMarkup)
    .find((button) => button.text === 'Pose Question');
  const callback = await buildTelegramCommandResponse({
    update: {
      update_id: 7004,
      callback_query: {
        id: 'callback-pose-menu',
        data: poseQuestion.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 56,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:01.000Z',
  });

  assert.equal(callback.ok, true);
  assert.equal(callback.response.method, 'editMessageText');
  assert.equal(callback.response.messageId, '56');
  assert.equal(callback.screen, 'question_list');
  assert.match(callback.response.text, /Choose a question to pose to the group/);
  assert.match(callback.response.text, /q-readiness - What should Alpha decide next/);
  assert.equal(callback.response.text.startsWith('Question for alpha:'), false);
});

test('/q poses existing or ad hoc public questions to the group', async () => {
  const env = baseEnv();
  const existing = await buildTelegramCommandResponse({
    update: groupMessage('/q q-readiness'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const byNumber = await buildTelegramCommandResponse({
    update: groupMessage('/q 1'),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const adHoc = await buildTelegramCommandResponse({
    update: groupMessage('/q What should we fund this week?'),
    env,
    now: '2026-05-08T12:00:02.000Z',
  });

  assert.equal(existing.ok, true);
  assert.equal(existing.screen, 'pose_question');
  assert.match(existing.response.text, /What should Alpha decide next/);
  assert.equal(byNumber.ok, true);
  assert.match(byNumber.response.text, /What should Alpha decide next/);
  assert.equal(adHoc.ok, true);
  assert.match(adHoc.response.text, /What should we fund this week\?/);
  assert.equal(JSON.stringify(adHoc.response.replyMarkup).includes('What should we fund'), false);
});

test('/q renders structured answer buttons and saves answer drafts from callbacks', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        questionId: `0x${'12'.repeat(32)}`,
        questionType: 'binary',
        prompt: 'Should Demo adopt this proposal?',
      },
      {
        questionId: `0x${'34'.repeat(32)}`,
        questionType: 'rating',
        prompt: 'How strong is the signal?',
      },
      {
        questionId: `0x${'56'.repeat(32)}`,
        questionType: 'multichoice',
        prompt: 'Which option should Demo prioritize?',
        options: ['Option A', 'Option B', 'Option C'],
        singleSelect: true,
      },
    ]),
  });

  const binary = await buildTelegramCommandResponse({
    update: groupMessage('/q 1'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const rating = await buildTelegramCommandResponse({
    update: groupMessage('/q 2'),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const multichoice = await buildTelegramCommandResponse({
    update: groupMessage('/q 3'),
    env,
    now: '2026-05-08T12:00:02.000Z',
  });

  assert.equal(binary.ok, true);
  assert.match(binary.response.text, /Tap an answer, then submit the draft from Telegram/);
  assert.deepEqual(
    flattenButtons(binary.response.replyMarkup).map((button) => button.text).slice(0, 3),
    ['Agree', 'Unsure', 'Disagree']
  );
  assert.deepEqual(
    flattenButtons(rating.response.replyMarkup).map((button) => button.text).slice(0, 11),
    ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
  );
  assert.deepEqual(
    flattenButtons(multichoice.response.replyMarkup).map((button) => button.text).slice(0, 3),
    ['Option A', 'Option B', 'Option C']
  );
  assert.equal(binary.response.text.includes('0x1212121212121212121212121212121212121212121212121212121212121212'), false);

  const binaryButtons = flattenButtons(binary.response.replyMarkup);
  const agree = binaryButtons.find((button) => button.text === 'Agree');
  const disagree = binaryButtons.find((button) => button.text === 'Disagree');
  const submitDraft = binaryButtons.find((button) => button.text === 'Submit Draft');
  assert.match(submitDraft.callback_data, /^cecb_[a-z0-9]{10,48}$/);
  const saved = await buildTelegramCommandResponse({
    update: {
      update_id: 7011,
      callback_query: {
        id: 'callback-answer-agree',
        data: agree.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 61,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:03.000Z',
  });

  assert.equal(saved.ok, true);
  assert.equal(saved.response, null);
  assert.equal(saved.answerDraftSaved, true);
  assert.equal(saved.callbackAnswerText, 'Draft saved. Tap Submit Draft when ready.');

  const draftRecords = Array.from(env.AGENT_ACTION_KV.store.values())
    .map((value) => JSON.parse(value))
    .filter((value) => value.status === 'draft_saved');
  assert.equal(draftRecords.length, 1);
  assert.equal(draftRecords[0].answerLabel, 'Agree');
  assert.equal(draftRecords[0].questionId, `0x${'12'.repeat(32)}`);
  assert.equal(draftRecords[0].submitLane, 'telegram_private_account');

  const submitted = await buildTelegramCommandResponse({
    update: {
      update_id: 7012,
      callback_query: {
        id: 'callback-submit-draft',
        data: submitDraft.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 61,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:04.000Z',
  });

  assert.equal(submitted.ok, true);
  assert.equal(submitted.response, null);
  assert.equal(submitted.submitRequestCreated, true);
  assert.equal(submitted.submitRequest.status, 'submit_request_created');
  assert.equal(submitted.submitRequest.canonicalApiRequest.path, '/api/agent/responses/submit-request');
  assert.equal(submitted.submitRequest.replayed, false);
  assert.match(submitted.submitRequest.idempotencyKey, /^telegram_bot_submit:42:alpha:/);
  assert.match(submitted.callbackAnswerText, /Submit request queued for 0x12121212\.\.\.121212/);

  const replayedSubmit = await buildTelegramCommandResponse({
    update: {
      update_id: 7013,
      callback_query: {
        id: 'callback-submit-draft-replay',
        data: submitDraft.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 61,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:05.000Z',
  });

  assert.equal(replayedSubmit.ok, true);
  assert.equal(replayedSubmit.submitRequestCreated, true);
  assert.equal(replayedSubmit.submitRequest.requestId, submitted.submitRequest.requestId);
  assert.equal(replayedSubmit.submitRequest.replayed, true);

  const submitRecords = Array.from(env.AGENT_ACTION_KV.store.entries())
    .filter(([key]) => key.startsWith('telegram:submit-request:'))
    .map(([, value]) => JSON.parse(value));
  assert.equal(submitRecords.length, 1);
  assert.equal(submitRecords[0].action, 'submit_response');
  assert.equal(submitRecords[0].lane, 'telegram_private_account');
  assert.equal(submitRecords[0].answer.label, 'Agree');
  assert.equal(submitRecords[0].canonicalApiRequest.body.questionId, `0x${'12'.repeat(32)}`);
  assert.equal(submitRecords[0].canonicalApiRequest.body.idempotencyKey, submitted.submitRequest.idempotencyKey);

  const changedSaved = await buildTelegramCommandResponse({
    update: {
      update_id: 7014,
      callback_query: {
        id: 'callback-answer-disagree',
        data: disagree.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 61,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:06.000Z',
  });
  const changedSubmitted = await buildTelegramCommandResponse({
    update: {
      update_id: 7015,
      callback_query: {
        id: 'callback-submit-changed-draft',
        data: submitDraft.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 61,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:07.000Z',
  });

  assert.equal(changedSaved.ok, true);
  assert.equal(changedSubmitted.ok, true);
  assert.equal(changedSubmitted.submitRequestCreated, true);
  assert.equal(changedSubmitted.submitRequest.replayed, false);
  assert.notEqual(changedSubmitted.submitRequest.requestId, submitted.submitRequest.requestId);
  assert.notEqual(changedSubmitted.submitRequest.idempotencyKey, submitted.submitRequest.idempotencyKey);
  const changedSubmitRecords = Array.from(env.AGENT_ACTION_KV.store.entries())
    .filter(([key]) => key.startsWith('telegram:submit-request:'))
    .map(([, value]) => JSON.parse(value));
  assert.equal(changedSubmitRecords.length, 2);
  assert.equal(changedSubmitRecords.some((record) => record.answer.label === 'Agree'), true);
  assert.equal(changedSubmitRecords.some((record) => record.answer.label === 'Disagree'), true);

  const calls = [];
  const dispatched = await dispatchTelegramCommandResponse({
    commandResponse: saved,
    env,
    fetchImpl: async (...args) => {
      calls.push(args);
      return new Response(JSON.stringify({ ok: true, result: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  assert.equal(dispatched.telegram.ok, true);
  assert.equal(dispatched.telegram.skipped, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://api.telegram.org/bot123456:test-token/answerCallbackQuery');
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    callback_query_id: 'callback-answer-agree',
    show_alert: false,
    cache_time: 0,
    text: 'Draft saved. Tap Submit Draft when ready.',
  });
});

test('callback dispatch answers callback queries before editing messages', async () => {
  const env = baseEnv();
  const joined = await buildTelegramCommandResponse({
    update: groupMessage('/ce_join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const viewQuestions = flattenButtons(joined.response.replyMarkup)
    .find((button) => button.text === 'View Questions');
  const commandResponse = await buildTelegramCommandResponse({
    update: {
      update_id: 7005,
      callback_query: {
        id: 'callback-answer-me',
        data: viewQuestions.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 57,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const calls = [];
  const fetchMock = async (...args) => {
    calls.push(args);
    return new Response(JSON.stringify({ ok: true, result: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const dispatched = await dispatchTelegramCommandResponse({
    commandResponse,
    env,
    fetchImpl: fetchMock,
  });

  assert.equal(dispatched.telegram.ok, true);
  assert.equal(dispatched.telegram.callbackAnswer.ok, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'https://api.telegram.org/bot123456:test-token/answerCallbackQuery');
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    callback_query_id: 'callback-answer-me',
    show_alert: false,
    cache_time: 0,
  });
  assert.equal(calls[1][0], 'https://api.telegram.org/bot123456:test-token/editMessageText');
});

test('/ce_attachments lists public metadata and hides private storage refs', async () => {
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/ce_attachments alpha'),
    env: baseEnv(),
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'doc_library');
  assert.match(result.response.text, /Attachments for alpha/);
  assert.match(result.response.text, /Private or gated files open in the Mini App/);
  assert.match(result.response.text, /Public plan \(md, public\)/);
  assert.match(result.response.text, /Gated appendix \(pdf, sbt_gated\)/);
  assert.equal(result.response.text.includes('r2://private'), false);
});

test('/ce_docs remains a legacy alias for attachments', async () => {
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/ce_docs alpha'),
    env: baseEnv(),
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'doc_library');
  assert.match(result.response.text, /Attachments for alpha/);
});

test('/ce_me returns managed demo account metadata without the root secret', async () => {
  const result = await buildTelegramCommandResponse({
    update: privateMessage('/ce_me'),
    env: baseEnv(),
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'my_account');
  assert.match(result.response.text, /Account/);
  assert.match(result.response.text, /Address: 0x[0-9a-f]{4}\.\.\.[0-9a-f]{4}/);
  assert.equal(JSON.stringify(result).includes('unit-root'), false);
});

test('dispatchTelegramCommandResponse uses mocked fetch and does not require real Telegram credentials', async () => {
  const calls = [];
  const fetchMock = async (...args) => {
    calls.push(args);
    return new Response(JSON.stringify({ ok: true, result: { message_id: 77 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const commandResponse = await buildTelegramCommandResponse({
    update: privateMessage('/start'),
    env: baseEnv(),
    now: '2026-05-08T12:00:00.000Z',
  });
  const dispatched = await dispatchTelegramCommandResponse({
    commandResponse,
    env: baseEnv(),
    fetchImpl: fetchMock,
  });

  assert.equal(dispatched.telegram.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://api.telegram.org/bot123456:test-token/sendMessage');
});
