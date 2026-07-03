import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  AGENT_ONLY_ANSWER_EVENT_KV_PREFIX,
  AGENT_ONLY_INSTRUCTIONS,
  AGENT_ONLY_WINDOW_KV_PREFIX,
  __test__telegramAgentOnlyMode,
  agentOnlyInstructionWordCount,
  buildAgentOnlyWrappedImagePrompt,
  buildAgentOnlyWrappedStoryFramePrompts,
  buildAgentOnlyWrappedStoryboardPrompt,
  buildAgentOnlyStartPayload,
  buildAgentOnlyMetrics,
  canonicalAgentOnlyAnswerProjection,
  exportAgentOnlyData,
  getAgentOnlyStatementsPage,
  loadAgentOnlyPredictionsForPrincipal,
  loadAgentOnlyModeConfig,
  materializeAgentOnlyWindow,
  recordAgentOnlyAttemptEvent,
  recordAgentOnlyHumanReview,
  saveAgentOnlyModeConfig,
  semanticFingerprintForAgentOnlyAnswer,
  submitAgentOnlyAnswersBulk,
  submitAgentOnlyHumanVoteTaps,
  submitAgentOnlyTokenVotesBulk,
  windowBoundariesAround,
} from './telegramAgentOnlyMode.mjs';
import { persistTelegramProposedQuestion } from './telegramQuestionProposals.mjs';
import { persistTelegramSubmitRecord } from './telegramSubmitQueue.mjs';

class MemoryKv {
  constructor() {
    this.store = new Map();
    this.metadata = new Map();
    this.getCalls = 0;
    this.listCalls = 0;
  }

  async put(key, value, options = {}) {
    if (typeof this.beforePut === 'function') await this.beforePut(key, value, options, this);
    this.store.set(key, value);
    if (options && Object.hasOwn(options, 'metadata')) this.metadata.set(key, options.metadata);
    else this.metadata.delete(key);
  }

  async get(key) {
    this.getCalls += 1;
    const value = this.store.get(key) || null;
    if (typeof this.afterGet === 'function') await this.afterGet(key, value, this);
    return value;
  }

  async delete(key) {
    this.store.delete(key);
    this.metadata.delete(key);
  }

  async list({ prefix = '', limit = 1000, cursor = '' } = {}) {
    this.listCalls += 1;
    const keys = [...this.store.keys()].filter((key) => key.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) || 0 : 0;
    const page = keys.slice(start, start + limit);
    const next = start + page.length;
    return {
      keys: page.map((name) => ({
        name,
        ...(this.metadata.has(name) ? { metadata: this.metadata.get(name) } : {}),
      })),
      list_complete: next >= keys.length,
      cursor: next >= keys.length ? undefined : String(next),
    };
  }
}

function env(overrides = {}) {
  return {
    AGENT_ACTION_KV: new MemoryKv(),
    ...overrides,
  };
}

function normalizedUser(id = '1001') {
  return {
    user: { telegramUserId: id },
    chat: { chatId: id },
  };
}

async function seedQuestions(testEnv, sessionSlug = 'alpha') {
  const binary = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized: normalizedUser(),
    sessionSlug,
    prompt: 'Should Alpha fund the shared workspace?',
    questionType: 'binary',
  });
  const freeform = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized: normalizedUser(),
    sessionSlug,
    prompt: 'What should Alpha improve next?',
    questionType: 'freeform',
  });
  const rating = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized: normalizedUser(),
    sessionSlug,
    prompt: 'Rate the Alpha schedule from 0 to 10.',
    questionType: 'rating',
  });
  const multichoice = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized: normalizedUser(),
    sessionSlug,
    prompt: 'Which Alpha dinner should happen?',
    questionType: 'multichoice',
    options: ['Pizza', 'Sushi', 'Salad'],
  });
  const ids = [binary, freeform, rating, multichoice].map((result) => result.questionId);
  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug,
    patch: {
      enabledQuestionIds: ids,
      evalTypesByQuestionId: { [ids[0]]: 'human_split' },
    },
    createdAt: '2026-06-12T15:01:00.000Z',
  });
  return { ids, binary, freeform, rating, multichoice };
}

test('windowBoundariesAround handles launch, regular boundary, DST, and edited launch close', () => {
  assert.equal(windowBoundariesAround(Date.parse('2026-06-12T14:59:59.000Z')), null);
  assert.deepEqual(windowBoundariesAround(Date.parse('2026-06-12T15:00:00.000Z')), {
    windowId: 'w-2026-06-12',
    opensAt: '2026-06-12T15:00:00.000Z',
    closesAt: '2026-06-15T15:00:00.000Z',
  });
  assert.deepEqual(windowBoundariesAround(Date.parse('2026-06-15T15:00:00.000Z')), {
    windowId: 'w-2026-06-15',
    opensAt: '2026-06-15T15:00:00.000Z',
    closesAt: '2026-06-22T15:00:00.000Z',
  });
  assert.deepEqual(windowBoundariesAround(Date.parse('2026-11-02T16:00:00.000Z')), {
    windowId: 'w-2026-11-02',
    opensAt: '2026-11-02T16:00:00.000Z',
    closesAt: '2026-11-09T16:00:00.000Z',
  });
  assert.equal(
    windowBoundariesAround(Date.parse('2026-06-16T15:00:00.000Z'), {
      launchClosesAt: '2026-06-19T08:00:00-07:00',
    }).windowId,
    'w-2026-06-12',
  );
});

test('start payload pins path-only endpoints and instruction size', () => {
  const payload = buildAgentOnlyStartPayload({ sessionSlug: 'alpha', skillVersion: '2026-06-16 (v41)' });
  assert.equal(payload.statementEndpoint, '/telegram/agent/api/agent-only/statements');
  assert.equal(payload.answerEndpoint, '/telegram/agent/api/agent-only/answers/bulk');
  assert.equal(payload.voteEndpoint, '/telegram/agent/api/agent-only/token-votes/bulk');
  assert.equal(payload.wrappedImageEndpoint, '/telegram/agent/api/agent-only/wrapped-image');
  assert.deepEqual(payload.visualDefaults, {
    wrapped: true,
    wrapped_story: false,
    political_compass: false,
  });
  assert.match(payload.instructions, /Quiet lifecycle/);
  assert.match(payload.instructions, /wrappedImageEndpoint/);
  assert.match(payload.instructions, /mode "wrapped_story"/);
  assert.match(payload.instructions, /MP4 story video is disabled/);
  assert.match(payload.instructions, /mode "political_compass"/);
  assert.match(payload.instructions, /Do not generate mode "political_compass" during the default run/);
  assert.match(payload.instructions, /only generate it if the principal asks for Agent Norms Compass after the image/);
  assert.match(payload.instructions, /visualDefaults\.wrapped/);
  assert.doesNotMatch(payload.instructions, /visualDefaults\.wrapped_story/);
  assert.doesNotMatch(payload.instructions, /visualDefaults\.political_compass/);
  assert.match(payload.instructions, /must start with exactly one Markdown image line using image_url/);
  assert.match(payload.instructions, /!\[Agent Village Wrapped\]\(<image_url>\)/);
  assert.match(payload.instructions, /Do not use local paths, raw image_base64, duplicate raw links/);
  assert.match(payload.instructions, /Do not inspect, critique, describe, or summarize the poster/);
  assert.doesNotMatch(payload.instructions, /native photo/);
  assert.match(payload.instructions, /agent_metadata\.token_usage/);
  assert.match(payload.instructions, /recent_sessions_total_tokens/);
  assert.match(payload.instructions, /daily_usage_30d/);
  assert.match(payload.instructions, /Optional token_usage before answering/);
  assert.match(payload.instructions, /state\.db and \/opt\/data\/state\.db/);
  assert.match(payload.instructions, /source: "local sqlite3 query \(including cache\)"/);
  assert.match(payload.instructions, /make at most one quiet known-path SQLite attempt/);
  assert.match(payload.instructions, /COALESCE\(input_tokens,0\)/);
  assert.match(payload.instructions, /COALESCE\(output_tokens,0\)/);
  assert.match(payload.instructions, /COALESCE\(cache_read_tokens,0\)/);
  assert.match(payload.instructions, /COALESCE\(cache_write_tokens,0\)/);
  assert.match(payload.instructions, /started_at >= cutoff/);
  assert.match(payload.instructions, /date\(CAST\(started_at AS INTEGER\), 'unixepoch', 'localtime'\)/);
  assert.match(payload.instructions, /Do not assume a precomputed aggregate column exists/);
  assert.match(payload.instructions, /do not use SQL datetime string filters against started_at/);
  assert.doesNotMatch(payload.instructions, /total_tokens\s+column|SUM\(\s*total_tokens|SELECT\s+total_tokens/i);
  assert.doesNotMatch(payload.instructions, /datetime\('now'\)/);
  assert.match(payload.instructions, /If unavailable or unclear, omit token_usage/);
  assert.match(payload.instructions, /Never print rows or command output/);
  assert.doesNotMatch(payload.instructions, /skill_view|skills_list|search_files|session_search|hermes insights|\/opt\/hermes/i);
  assert.match(payload.instructions, /fresh run_id/);
  assert.match(payload.instructions, /same run_id/);
  assert.match(payload.instructions, /"run_id": "<fresh_run_id>"/);
  assert.match(payload.instructions, /Use one private helper script after credential resolution/);
  assert.match(payload.instructions, /Helper stdout may contain only one compact final JSON object/);
  assert.match(payload.instructions, /\/telegram\/agent\/api\/agent-only\/statements\?limit=5&compact=1/);
  assert.match(payload.instructions, /Compact, low-output execution is the default path/);
  assert.doesNotMatch(payload.instructions, /compact direct HTTP calls/);
  assert.match(payload.instructions, /unique request_id values/);
  assert.match(payload.instructions, /Internal prediction calls may return compact JSON keyed by local index/);
  assert.match(payload.instructions, /never print that JSON/);
  assert.match(payload.instructions, /map local indexes back to exact statement_id values/);
  assert.match(payload.instructions, /multichoice uses values arrays/);
  assert.match(payload.instructions, /Skip token allocations for the default Wrapped run/);
  assert.match(payload.instructions, /Do not POST \/telegram\/agent\/api\/agent-only\/token-votes\/bulk/);
  assert.match(payload.instructions, /standard Wrapped image can be generated from predictions alone/);
  assert.match(payload.instructions, /90-95 only for direct memory\/profile evidence/);
  assert.match(payload.instructions, /Use 100 only for an exact prior answer/);
  assert.match(payload.instructions, /Avoid flat repeated defaults/);
  assert.match(payload.instructions, /"format": "json_url"/);
  assert.match(payload.instructions, /"include_base64": false/);
  assert.match(payload.instructions, /Do not include process notes, debugging, script names, parallelization/);
  assert.match(payload.instructions, /To inspect or change your agent's responses/);
  assert.doesNotMatch(payload.instructions, /shareable story version/);
  assert.match(payload.instructions, /\[Context Engine Bot\]\(https:\/\/t\.me\/contextengineer_bot\?start=agent_onboarding__agent-village-wrapped\)/);
  assert.match(payload.instructions, /extra links/);
  assert.match(payload.instructions, /where the principal lives\/is from\/currently is/);
  assert.match(payload.instructions, /Abstract location evidence into non-location preferences/);
  assert.doesNotMatch(payload.instructions, /Review or edit your agent's responses in Context Engine Telegram Bot/);
  assert.ok(agentOnlyInstructionWordCount(AGENT_ONLY_INSTRUCTIONS) >= 250);
  assert.ok(agentOnlyInstructionWordCount(AGENT_ONLY_INSTRUCTIONS) <= 700);
  assert.equal((payload.instructions.match(/https?:\/\//gi) || []).length, 1);

  const storyDefaultPayload = buildAgentOnlyStartPayload({
    sessionSlug: 'alpha',
    skillVersion: '2026-06-16 (v41)',
    visualDefaults: { wrapped_story: true, political_compass: true },
  });
  assert.deepEqual(storyDefaultPayload.visualDefaults, {
    wrapped: true,
    wrapped_story: false,
    political_compass: false,
  });
});

test('wrapped image prompt uses importance wording and suppresses decorative text', () => {
  const snapshot = {
    windowId: 'w-2026-06-15',
    evalTypesByQuestionId: {
      ceq_archetype: 'bucket',
      ceq_unknown: 'wrapped_generation',
      ceq_historical: 'wrapped_generation',
    },
    statements: [
      {
        statement_id: 'ceq_trust',
        text: 'I would trust my agent to schedule meetings while I sleep if it could preserve enough private coordination context.',
        answer_schema: { kind: 'choice', values: ['agree', 'unsure', 'disagree'] },
      },
      {
        statement_id: 'ceq_info',
        text: "A mostly AI-written information environment could be healthier than today's mostly human-written one.",
        answer_schema: { kind: 'choice', values: ['agree', 'unsure', 'disagree'] },
      },
      {
        statement_id: 'ceq_book',
        text: 'Agent guess: what is my favorite book?',
        answer_schema: { kind: 'text', maxChars: 280 },
      },
      {
        statement_id: 'ceq_book_followup',
        text: 'Agent guess: what is my favorite book if you have a stronger signal?',
        answer_schema: { kind: 'text', maxChars: 280 },
      },
      {
        statement_id: 'ceq_book_label',
        text: 'Book Guess: what book vibe fits me?',
        answer_schema: { kind: 'text', maxChars: 280 },
      },
      {
        statement_id: 'ceq_movie',
        text: 'Agent guess: what is my favorite movie?',
        answer_schema: { kind: 'text', maxChars: 280 },
      },
      {
        statement_id: 'ceq_game',
        text: 'Agent guess: what game, puzzle, sport, or play pattern best fits me?',
        answer_schema: { kind: 'text', maxChars: 280 },
      },
      {
        statement_id: 'ceq_unanswered_guess',
        text: 'Agent guess: which impossible pet would I choose?',
        answer_schema: { kind: 'text', maxChars: 280 },
      },
      {
        statement_id: 'ceq_lowered',
        text: 'Would I want my agent to post publicly without review?',
        answer_schema: { kind: 'choice', values: ['agree', 'unsure', 'disagree'] },
      },
      {
        statement_id: 'ceq_rating',
        text: 'How comfortable are you with your agent making commitments on your behalf while you sleep, that you learn about only when you wake up?',
        answer_schema: { kind: 'choice', values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      },
      {
        statement_id: 'ceq_multi',
        text: 'What would you most want an agent to help with at Edge? Select all that apply.',
        answer_schema: { kind: 'multichoice', options: ['Find relevant people', 'Coordinate plans', 'Summarize conversations'], minSelections: 1 },
      },
      {
        statement_id: 'ceq_none_na',
        text: 'Which AI future would I most want to help bring about?',
        answer_schema: {
          kind: 'multichoice',
          options: ['Personal agency and capability', 'Care, education, and flourishing', 'None of these / N/A'],
          minSelections: 1,
          maxSelections: 1,
          selectionMode: 'single',
        },
      },
      {
        statement_id: 'ceq_ai_optimism',
        text: 'What is my AI Optimism score?',
        answer_schema: { kind: 'choice', values: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] },
      },
      {
        statement_id: 'ceq_flourish_optimism',
        text: 'How optimistic am I that AI will broadly improve human flourishing over the next decade?',
        answer_schema: { kind: 'choice', values: [1, 2, 3, 4, 5] },
      },
      {
        statement_id: 'ceq_archetype',
        text: 'Which archetype best describes this principal?',
        answer_schema: {
          kind: 'multichoice',
          options: ['privacy-first coordination builder', 'frontier researcher'],
          minSelections: 1,
          maxSelections: 1,
          selectionMode: 'single',
        },
      },
      {
        statement_id: 'ceq_unknown',
        text: 'What important thing do you not know about this principal that would most change your predictions? Use N/A if unsupported.',
        answer_schema: { kind: 'text', maxChars: 280 },
      },
      {
        statement_id: 'ceq_historical',
        text: 'Which historical figure or fictional character is the best comparison for this principal, and why? Use N/A if unsupported.',
        answer_schema: { kind: 'text', maxChars: 280 },
      },
    ],
  };
  const state = {
    byStatement: {
      ceq_trust: {
        agent: {
          answer: { value: 'agree' },
          confidence: 92,
          updatedAt: '2026-06-12T15:10:00.000Z',
          agentMetadata: {
            tokenUsage: {
              currentRunTotalTokens: 1248000,
              recentSessionsTotalTokens: 4300000,
              dailyUsage30d: [
                { date: '2026-06-03', tokens: 1000000 },
                { date: '2026-06-10', tokens: 1200000 },
                { date: '2026-06-18', tokens: 1100000 },
                { date: '2026-06-25', tokens: 1000000 },
              ],
              edgeInPersonDates: ['2026-06-18', '2026-06-19'],
              source: 'Hermes visible usage',
            },
          },
        },
      },
      ceq_info: { agent: { answer: { value: 'unsure' }, confidence: 41 } },
      ceq_book: { agent: { answer: { text: 'The Diamond Age' }, confidence: 52 } },
      ceq_book_followup: { agent: { answer: { text: 'Neuromancer' }, confidence: 70 } },
      ceq_book_label: { agent: { answer: { text: 'Cybernetic field guide' }, confidence: 77 } },
      ceq_movie: { agent: { answer: { text: 'Her' }, confidence: 58 } },
      ceq_game: { agent: { answer: { text: 'Go' }, confidence: 55 } },
      ceq_rating: { agent: { answer: { value: 7 }, confidence: 88 } },
      ceq_multi: { agent: { answer: { values: ['Find relevant people', 'Coordinate plans'] }, confidence: 90 } },
      ceq_none_na: { agent: { answer: { values: ['None of these / N/A'] }, confidence: 100 } },
      ceq_ai_optimism: { agent: { answer: { value: 80 }, confidence: 63 } },
      ceq_flourish_optimism: { agent: { answer: { value: 4 }, confidence: 63 } },
      ceq_archetype: { agent: { answer: { values: ['privacy-first coordination builder'] }, confidence: 99 } },
      ceq_unknown: { agent: { answer: { text: 'N/A' }, confidence: 100 } },
      ceq_historical: { agent: { answer: { text: 'N/A' }, confidence: 100 } },
    },
  };
  const prompt = buildAgentOnlyWrappedImagePrompt({
    snapshot,
    state,
    linearVoteState: {
      mode: 'linear',
      votes: {
        ceq_trust: 20,
        ceq_movie: 30,
        ceq_book_followup: 25,
        ceq_book_label: 40,
        ceq_none_na: 50,
        ceq_unanswered_guess: 90,
        ceq_lowered: -100,
        ceq_archetype: 100,
        ceq_unknown: 80,
      },
    },
    quadraticVoteState: { mode: 'quadratic', votes: { ceq_info: 4 } },
  });
  const promptWithoutVotes = buildAgentOnlyWrappedImagePrompt({ snapshot, state });
  assert.match(promptWithoutVotes, /Question only: "I would trust my agent to schedule meetings while I sleep/);
  assert.doesNotMatch(promptWithoutVotes, /No visible items; omit this section entirely/);
  assert.match(prompt, /Do not number the visible sections/);
  assert.match(prompt, /Questions your agent thought you would care about most/);
  assert.match(prompt, /Show exactly 3 actual question prompts/);
  assert.match(prompt, /compact top-left "Agent Village" wordmark/);
  assert.match(prompt, /What your agent thinks it knows about you/);
  assert.match(prompt, /Do not render the word "Wrapped"/);
  assert.match(prompt, /"AGENT" is heavy uppercase block sans/);
  assert.match(prompt, /attached Agent Village logo image as the style reference/);
  assert.match(prompt, /flowing calligraphic V/);
  assert.match(prompt, /lay "AGENT" and "VILLAGE" side-by-side/);
  assert.match(prompt, /content area gets most of the vertical space/);
  assert.match(prompt, /varied, shareable palettes/);
  assert.match(prompt, /Custom aesthetic must vary from person to person/);
  assert.match(prompt, /weave it through the whole poster/);
  assert.match(prompt, /visually clean and minimal/);
  assert.match(prompt, /fewest borders and grid lines needed/);
  assert.match(prompt, /Every visible word and sentence must be complete/);
  assert.match(prompt, /no cropped words, cut-off lines, trailing hyphen fragments/);
  assert.match(prompt, /shorten the wording rather than shrinking it below readable size/);
  assert.match(prompt, /no readable location labels/);
  assert.match(prompt, /Section typography: make section titles large/);
  assert.match(prompt, /Agent Core Insight \+ Agent Impression/);
  assert.match(prompt, /Make this the largest content block/);
  assert.match(prompt, /tall phone card or portrait story panel/);
  assert.match(prompt, /rather than a wide landscape banner/);
  assert.match(prompt, /Hero text fit rule/);
  assert.match(prompt, /render exactly one memeable sentence/);
  assert.match(prompt, /under 14 words and under 90 characters/);
  assert.match(prompt, /Never hyphenate, crop, truncate, or trail off the hero sentence mid-word/);
  assert.match(prompt, /Do not add a second sentence elsewhere inside the hero/);
  assert.match(prompt, /Use plain concrete language/);
  assert.match(prompt, /Do not invent undefined acronyms/);
  assert.match(prompt, /do not create new technical-sounding slogans/);
  assert.match(prompt, /Location privacy rule/);
  assert.match(prompt, /do not mention or imply where the principal lives/);
  assert.match(prompt, /current city, neighborhood, hotel, venue, coordinates, or travel origin/);
  assert.doesNotMatch(prompt, /triple-v/i);
  assert.match(prompt, /ask first, explain their reasoning, and protect private context/);
  assert.match(prompt, /Show exactly 3 actual question prompts/);
  assert.match(prompt, /Question only: "I would trust my agent to schedule meetings while I sleep/);
  assert.match(prompt, /This section is questions only: do not show predicted answers/);
  assert.match(prompt, /do not show predicted answers, answer pills, Agree\/Unsure\/Disagree, ratings, selected options, confidence, or token math/);
  assert.match(prompt, /Do not replace prompts with theme summaries/);
  assert.doesNotMatch(prompt, /Question only: "Which archetype best describes this principal/);
  assert.doesNotMatch(prompt, /Question only: "What important thing do you not know about this principal/);
  assert.match(prompt, /Agree is green with white text/);
  assert.match(prompt, /Unsure is bright yellow with dark navy text/);
  assert.match(prompt, /Disagree is red with white text/);
  assert.match(prompt, /Prediction Evidence Pool for synthesis only/);
  assert.match(prompt, /Do not render it as its own visible table/);
  assert.match(prompt, /I would trust my agent to schedule meetings while I sleep/);
  assert.match(prompt, /High-Confidence Predictions/);
  assert.match(prompt, /Cautious Predictions/);
  assert.doesNotMatch(prompt, /High-Confidence Reads/);
  assert.doesNotMatch(prompt, /Cautious Reads/);
  assert.match(prompt, /lowest-confidence eligible predictions from this run/);
  assert.match(prompt, /not necessarily objectively low confidence/);
  assert.match(prompt, /predicted human response rows/);
  assert.match(prompt, /Agent-about-user evidence for the core insight and comparison only/);
  assert.match(prompt, /Analysis prompt: "Which archetype best describes this principal/);
  assert.doesNotMatch(prompt, /Analysis prompt: "What important thing do you not know about this principal/);
  assert.match(prompt, /Question: "/);
  assert.match(prompt, /Predicted answer/);
  assert.match(prompt, /answer format: binary choice; prediction: Agree; confidence: 92%/);
  assert.match(prompt, /answer format: multichoice selection; prediction: Find relevant people, Coordinate plans; confidence: 90%/);
  assert.match(prompt, /answer format: rating scale; prediction: 7\/10; confidence: 88%/);
  assert.doesNotMatch(prompt, /answer format: multichoice selection; prediction: privacy-first coordination builder; confidence: 99%/);
  assert.doesNotMatch(prompt, /Which AI future would I most want to help bring about/);
  assert.doesNotMatch(prompt, /None of these \/ N\/A/);
  assert.doesNotMatch(prompt, /answer format: freeform text; prediction: N\/A; confidence: 100%/);
  assert.doesNotMatch(prompt, /Use N\/A if unsupported/);
  assert.match(prompt, /7\/10/);
  assert.doesNotMatch(prompt, /confidence: 88\/100/);
  assert.doesNotMatch(prompt, /prediction: 7; confidence/);
  assert.match(prompt, /show the full prompt even if the row becomes tighter/);
  assert.match(prompt, /Question: "A mostly AI-written information environment could be healthier than today's mostly human-written one\."/);
  assert.match(prompt, /Do not use the phrase "your agent's take"/);
  assert.match(prompt, /Do not render detached rating labels/);
  assert.match(prompt, /Use the whole canvas/);
  assert.match(prompt, /avoid large blank zones/);
  assert.match(prompt, /Agent Guesses/);
  assert.match(prompt, /Bottom row: Agent Guesses \+ Agent Comparison/);
  assert.match(prompt, /one continuous full-width bottom band/);
  assert.match(prompt, /Keep them aligned to the same baseline and visual height/);
  assert.match(prompt, /Do not create a separate third bottom panel for Abstract Agent Impression/);
  assert.match(prompt, /ideally 2x2 when all four guesses are supported/);
  assert.match(prompt, /Use this category order: Book Guess, Movie\/Show Guess, Game\/Play Pattern, AI Optimism/);
  assert.match(prompt, /Try to include Book Guess and Movie\/Show Guess alongside Game\/Play Pattern and AI Optimism/);
  assert.match(prompt, /Book Guess/);
  assert.match(prompt, /Movie\/Show Guess/);
  assert.match(prompt, /Game\/Play Pattern/);
  assert.match(prompt, /AI Optimism/);
  assert.match(prompt, /synthesized at image-generation time from the actual prediction evidence/);
  assert.match(prompt, /not based on dedicated favorite-book\/movie\/game questions/);
  assert.match(prompt, /Title the visible section exactly "Agent Guesses"/);
  assert.match(prompt, /do not add any subtitle, disclaimer, caveat, or extra explanatory line/);
  assert.match(prompt, /For AI Optimism, use actual AI-futures predicted response rows/);
  assert.match(prompt, /render it as a numeric score out of 10/);
  assert.match(prompt, /AI Optimism 7\/10/);
  assert.match(prompt, /Token Use metric: Token Use: 4\.3M tokens; intuition: roughly 57 books at ~75K tokens\/book, 5\.7K pages, paper stack about 1\.9 ft tall; weekly usage: Week 1=1M, Week 2=1\.2M, Week 3=1\.1M, Week 4=1M; week ranges: Week 1 May 31-Jun 6, Week 2 June 7-14, Week 3 June 14-21, Week 4 June 22-28 \(source: Hermes visible usage\)\./);
  assert.match(prompt, /feature one prominent flattened "Token Use" module in the top-right header area/);
  assert.match(prompt, /wide and shallow, not a tall card/);
  assert.match(prompt, /without pushing the main question sections smaller/);
  assert.match(prompt, /Use only the token total, comparison, and weekly values already present in Token Use evidence/);
  assert.match(prompt, /do not invent, recalculate, substitute, or copy numeric examples from these instructions/);
  assert.doesNotMatch(prompt, /1,017|book-equivalents/);
  assert.match(prompt, /Use "roughly" for approximate comparisons; do not also write "approx\." or "approximately"/);
  assert.match(prompt, /Do not show "this run", "current run", "this month", "last month", request token counts, or current-run totals/);
  assert.match(prompt, /exactly four compact horizontal bars/);
  assert.match(prompt, /Week 1 May 31-Jun 6, Week 2 June 7-14, Week 3 June 14-21, and Week 4 June 22-28/);
  assert.match(prompt, /Do not draw Edge attendance, Edge days, event-attendance underlines, or attendance brackets/);
  assert.match(prompt, /Layout balance: use the whole canvas with even spacing/);
  assert.match(prompt, /comparable title size, row height, body font size, and column label size/);
  assert.match(prompt, /Do not let Cautious Predictions become tiny/);
  assert.doesNotMatch(prompt, /Edge attendance weeks/);
  assert.match(prompt, /Token Use is a runtime metric, not a playful guess/);
  assert.match(prompt, /Never invent, estimate, or back-calculate token usage/);
  assert.match(prompt, /Do not use stored favorite\/book\/movie\/game answer rows as source data/);
  assert.match(prompt, /flower\/sunrise for AI Optimism/);
  assert.match(prompt, /omit that chip entirely instead of showing unavailable text/);
  assert.match(prompt, /Do not repeat Agent Guesses under Agent Comparison or anywhere else/);
  assert.match(prompt, /Do not include Agent Guesses in this section/);
  assert.match(prompt, /favorite book/);
  assert.match(prompt, /How optimistic am I that AI will broadly improve human flourishing over the next decade/);
  assert.match(prompt, /answer format: rating scale; prediction: 4\/5; confidence: 63%/);
  assert.doesNotMatch(prompt, /What is my AI Optimism score/);
  assert.doesNotMatch(prompt, /prediction: 80\/100/);
  assert.doesNotMatch(prompt, /prediction: Neuromancer/);
  assert.doesNotMatch(prompt, /Book Guess: what book vibe fits me/);
  assert.doesNotMatch(prompt, /prediction: Cybernetic field guide/);
  assert.doesNotMatch(prompt, /prediction: Her/);
  assert.doesNotMatch(prompt, /prediction: Go\b/);
  assert.doesNotMatch(prompt, /The Diamond Age/);
  assert.doesNotMatch(prompt, /impossible pet/);
  assert.doesNotMatch(prompt, /post publicly without review/);
  assert.match(prompt, /No visible unavailable rows/);
  assert.match(prompt, /Never show all three Agree\/Unsure\/Disagree options in a row/);
  assert.match(prompt, /render exactly one selected answer pill/);
  assert.match(prompt, /small stylized portrait\/silhouette/);
  assert.match(prompt, /one brief description line of no more than 10 words/);
  assert.match(prompt, /Keep this compact in the bottom-right corner/);
  assert.match(prompt, /It should take less space than Agent Guesses/);
  assert.match(prompt, /Do not add the old trio of comparison evidence icons/);
  assert.match(prompt, /botanical circuit-village/);
  assert.match(prompt, /privacy lock woven into roots/);
  assert.doesNotMatch(prompt, /private correspondence/);
  assert.doesNotMatch(prompt, /civic introductions/);
  assert.doesNotMatch(prompt, /public repair norm/);
  assert.doesNotMatch(prompt, /exactly 3 precise evidence artifacts/);
  assert.match(prompt, /contextengine\.xyz/);
  assert.match(prompt, /do not reserve a dedicated bottom footer row/);
  assert.match(prompt, /blend with the design/);
  assert.doesNotMatch(prompt, /Review or edit your agent's responses in Context Engine/);
  assert.doesNotMatch(prompt, /What Your Agent Upvoted/);
  assert.doesNotMatch(prompt, /\n1\. Agent Core Insight/);
  assert.doesNotMatch(prompt, /\n7\. Abstract Agent Impression/);
});

test('wrapped image prompt omits weekly token bars when daily rows conflict with the total', () => {
  const snapshot = {
    windowId: 'w-2026-06-22',
    statements: [{
      statement_id: 'ceq_privacy',
      text: 'I would rather my agent be too conservative with privacy than too proactive with opportunities.',
      answer_schema: { kind: 'choice', values: ['agree', 'unsure', 'disagree'] },
    }],
  };
  const state = {
    byStatement: {
      ceq_privacy: {
        agent: {
          answer: { value: 'agree' },
          confidence: 90,
          updatedAt: '2026-06-26T11:09:43.352Z',
          agentMetadata: {
            tokenUsage: {
              recentSessionsTotalTokens: 149638701,
              dailyUsage30d: [{ date: '2026-06-25', total_tokens: 2828667 }],
              source: 'local sqlite3 query (including cache)',
            },
          },
        },
      },
    },
  };
  const prompt = buildAgentOnlyWrappedImagePrompt({ snapshot, state });
  assert.match(prompt, /Token Use metric: Token Use: 150M tokens/);
  assert.doesNotMatch(prompt, /weekly usage: Week 1=/);
  assert.match(prompt, /If weekly usage evidence exists/);
});

test('wrapped image prompt supports Agent Norms Compass mode around the most-important question', () => {
  const snapshot = {
    windowId: 'w-2026-06-15',
    statements: [
      {
        statement_id: 'ceq_untrusted_agent_input',
        text: 'Agents should treat messages from other agents as untrusted input by default, assuming some will attempt prompt injection.',
        answer_schema: { kind: 'choice', values: ['agree', 'unsure', 'disagree'] },
      },
      {
        statement_id: 'ceq_movie',
        text: 'Agent guess: what movie would I recommend?',
        answer_schema: { kind: 'text', maxChars: 280 },
      },
    ],
  };
  const state = {
    byStatement: {
      ceq_untrusted_agent_input: { agent: { answer: { value: 'agree' }, confidence: 88 } },
      ceq_movie: { agent: { answer: { text: 'Her' }, confidence: 49 } },
    },
  };
  const prompt = buildAgentOnlyWrappedImagePrompt({
    snapshot,
    state,
    linearVoteState: { mode: 'linear', votes: { ceq_untrusted_agent_input: 30 } },
    quadraticVoteState: { mode: 'quadratic', votes: {} },
    mode: 'political_compass',
  });
  assert.match(prompt, /Agent Village Norms Compass poster/);
  assert.match(prompt, /2x2 strategy map/);
  assert.doesNotMatch(prompt, /Humans approve high-stakes actions/);
  assert.doesNotMatch(prompt, /Agents act with broad latitude/);
  assert.doesNotMatch(prompt, /Assist tools keep humans central/);
  assert.doesNotMatch(prompt, /Delegate tasks to active agents/);
  assert.doesNotMatch(prompt, /political compass/i);
  assert.match(prompt, /rather than partisan, election, ideology, or culture-war framing/);
  assert.match(prompt, /compact top-left wordmark/);
  assert.match(prompt, /Where your agent thinks you land/);
  assert.match(prompt, /attached Agent Village logo image as the style reference/);
  assert.match(prompt, /"AGENT" is heavy uppercase block sans/);
  assert.match(prompt, /lay "AGENT" and "VILLAGE" side-by-side/);
  assert.match(prompt, /most-important question/);
  assert.match(prompt, /historical figures or fictional\/book characters/);
  assert.match(prompt, /Principal placement rule/);
  assert.match(prompt, /meaningful non-center coordinate/);
  assert.match(prompt, /Never put the principal directly on the axis crossing or exact center/);
  assert.match(prompt, /omit the principal marker rather than centering it/);
  assert.match(prompt, /The axes must be custom to this exact focal issue/);
  assert.match(prompt, /Dynamic axis derivation rule/);
  assert.match(prompt, /derive the compass in three steps/);
  assert.match(prompt, /core tension/);
  assert.match(prompt, /two independent dimensions/);
  assert.match(prompt, /newly written from the focal question and evidence/);
  assert.match(prompt, /prompt injection/);
  assert.doesNotMatch(prompt, /Treat agent messages as untrusted by default/);
  assert.doesNotMatch(prompt, /Assume trusted agent-to-agent cooperation/);
  assert.doesNotMatch(prompt, /Human verifies before cross-agent impact/);
  assert.doesNotMatch(prompt, /Agents coordinate without manual review/);
  assert.match(prompt, /Coordinate sanity rule/);
  assert.match(prompt, /Infer the semantic direction of the labels first/);
  assert.match(prompt, /untrusted input/);
  assert.match(prompt, /marker must visibly agree with those chips under the custom axes/);
  assert.match(prompt, /Reference-point rule/);
  assert.match(prompt, /choose each historical figure or fictional\/book character only after choosing the custom axes/);
  assert.match(prompt, /figure set should change when the focal question changes/);
  assert.match(prompt, /Agents should treat messages from other agents as untrusted input/);
  assert.match(prompt, /Agent guesses/);
  assert.doesNotMatch(prompt, /Most Important To You/);
});

test('wrapped story prompts split the report into five phone screens', () => {
  const snapshot = {
    windowId: 'w-2026-06-15',
    statements: [
      {
        statement_id: 'ceq_privacy',
        text: 'I would rather my agent be too conservative with privacy than too proactive with opportunities.',
        answer_schema: { kind: 'choice', values: ['agree', 'unsure', 'disagree'] },
      },
      {
        statement_id: 'ceq_code',
        text: 'I would still advise a smart 18-year-old to learn to code.',
        answer_schema: { kind: 'choice', values: ['agree', 'unsure', 'disagree'] },
      },
      {
        statement_id: 'ceq_ai_optimism',
        text: 'How optimistic am I that AI will broadly improve human flourishing over the next decade?',
        answer_schema: { kind: 'choice', values: [1, 2, 3, 4, 5] },
      },
      {
        statement_id: 'ceq_archetype',
        text: 'Which archetype best describes this principal?',
        answer_schema: { kind: 'text', maxChars: 280 },
      },
    ],
    evalTypesByQuestionId: {
      ceq_archetype: 'wrapped_generation',
    },
  };
  const state = {
    byStatement: {
      ceq_privacy: {
        agent: {
          answer: { value: 'agree' },
          confidence: 94,
          agentMetadata: {
            tokenUsage: {
              currentRunTotalTokens: 880000,
              recentSessionsTotalTokens: 2200000,
              source: 'Hermes visible usage',
            },
          },
        },
      },
      ceq_code: { agent: { answer: { value: 'agree' }, confidence: 81 } },
      ceq_ai_optimism: { agent: { answer: { value: 4 }, confidence: 62 } },
      ceq_archetype: { agent: { answer: { text: 'privacy-first coordination builder' }, confidence: 95 } },
    },
  };
  const frames = buildAgentOnlyWrappedStoryFramePrompts({
    snapshot,
    state,
    linearVoteState: { mode: 'linear', votes: { ceq_privacy: 20, ceq_code: 10 } },
    quadraticVoteState: { mode: 'quadratic', votes: { ceq_ai_optimism: 3 } },
  });
  assert.equal(frames.length, 5);
  assert.deepEqual(frames.map((frame) => frame.key), ['summary', 'token_use', 'predictions', 'agent_guesses', 'comparison']);
  assert.match(frames[0].prompt, /Screen 1 of 5/);
  assert.match(frames[0].prompt, /one large abstract image/);
  assert.match(frames[1].prompt, /Screen 2 of 5/);
  assert.match(frames[1].prompt, /Token Use: 2\.2M tokens/);
  assert.match(frames[1].prompt, /Do not show "this run", "current run", "this month", or "last month" beside the headline number/);
  assert.match(frames[1].prompt, /Week 1 May 31-Jun 6, Week 2 June 7-14, Week 3 June 14-21, and Week 4 June 22-28/);
  assert.match(frames[1].prompt, /each with a compact numeric token label such as "Week 1 320K"/);
  assert.match(frames[1].prompt, /Do not draw Edge attendance or event-attendance lines/);
  assert.match(frames[2].prompt, /High-confidence predictions/);
  assert.match(frames[2].prompt, /Cautious predictions/);
  assert.match(frames[2].prompt, /Render binary answers as one selected pill only/);
  assert.match(frames[3].prompt, /Book Guess, Movie\/Show Guess, Game\/Play Pattern, and AI Optimism/);
  assert.match(frames[3].prompt, /not from dedicated favorite-book\/movie\/game question rows/);
  assert.match(frames[3].prompt, /score out of 10/);
  assert.match(frames[3].prompt, /Do not show any subtitle, disclaimer, caveat, or extra explanatory line/);
  assert.match(frames[4].prompt, /historical figure or fictional\/book character/);
  assert.match(frames[4].prompt, /interesting, historically accurate deep cut/);
  assert.match(frames.map((frame) => frame.prompt).join('\n'), /Do not mention or imply where the principal lives/);

  const storyboardPrompt = buildAgentOnlyWrappedStoryboardPrompt({
    snapshot,
    state,
    linearVoteState: { mode: 'linear', votes: { ceq_privacy: 20, ceq_code: 10 } },
    quadraticVoteState: { mode: 'quadratic', votes: { ceq_ai_optimism: 3 } },
  });
  assert.match(storyboardPrompt, /dedicated source image for a phone-story animation/);
  assert.match(storyboardPrompt, /requested canvas is 3240x1152: exactly five 648x1152 vertical phone panels/);
  assert.match(storyboardPrompt, /natural 9:16 frame/);
  assert.match(storyboardPrompt, /Panel 1: "What your agent thinks it knows about you"/);
  assert.match(storyboardPrompt, /Panel 2: "Token trail"/);
  assert.match(storyboardPrompt, /Panel 3: "Predictions"/);
  assert.match(storyboardPrompt, /Panel 4: "Agent Guesses"/);
  assert.match(storyboardPrompt, /Panel 5: "Agent comparison"/);
  assert.match(storyboardPrompt, /Token Use: 2\.2M tokens/);
  assert.match(storyboardPrompt, /Do not show "this run", "current run", "this month", or "last month" beside the headline number/);
  assert.match(storyboardPrompt, /add exactly four week-by-week rows or bars labeled Week 1, Week 2, Week 3, Week 4, each with a compact numeric token label/i);
  assert.match(storyboardPrompt, /Do not draw Edge attendance or event-attendance lines/);
  assert.match(storyboardPrompt, /Do not alter or imitate the standard wide poster layout/);
});

test('wrapped image prompt has a neutral safety retry variant for compass mode', () => {
  const snapshot = {
    windowId: 'w-2026-06-15',
    statements: [{
      statement_id: 'ceq_privacy',
      text: 'I would rather my agent be too conservative with privacy than too proactive with opportunities.',
      answer_schema: { kind: 'choice', values: ['agree', 'unsure', 'disagree'] },
    }],
  };
  const state = {
    byStatement: {
      ceq_privacy: { agent: { answer: { value: 'agree' }, confidence: 88 } },
    },
  };
  const prompt = buildAgentOnlyWrappedImagePrompt({
    snapshot,
    state,
    linearVoteState: { mode: 'linear', votes: { ceq_privacy: 30 } },
    quadraticVoteState: { mode: 'quadratic', votes: {} },
    mode: 'political_compass',
    safetyRetry: true,
  });
  assert.match(prompt, /Agent Village Norms Map/);
  assert.match(prompt, /neutral product-research language/);
  assert.doesNotMatch(prompt, /Norms Compass poster/);
  assert.doesNotMatch(prompt, /political compass/i);
});

test('current Wrapped question bank excludes image-only taste and old optimism guess prompts', () => {
  const questionBank = JSON.parse(readFileSync(new URL('../../docs/agent-village-wrapped-questions-current.json', import.meta.url), 'utf8'));
  assert.equal(questionBank.length, 58);
  const serialized = JSON.stringify(questionBank);
  assert.doesNotMatch(serialized, /Agent guess:/i);
  assert.doesNotMatch(serialized, /favorite book|favorite movie|movie or TV show|favorite game|p\(bloom\)|AI Optimism score/i);
  assert.equal(questionBank.some((question) => question.id === 'R1'), true);
  assert.equal(questionBank.some((question) => question.id === 'R4'), true);
  assert.equal(questionBank.some((question) => question.id === 'F19'), true);
  for (const keptId of ['F6', 'F20', 'E1', 'E2', 'K1', 'R1', 'R2', 'R3', 'R4', 'A1', 'AI10', 'AI13', 'AI17']) {
    assert.equal(questionBank.some((question) => question.id === keptId), true, `${keptId} should remain active`);
  }
  for (const demotedId of ['D7', 'P4', 'N3', 'N5', 'N6', 'N7', 'N9', 'K2', 'K3', 'K4', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'A2', 'A3', 'AI3', 'AI9', 'AI11']) {
    assert.equal(questionBank.some((question) => question.id === demotedId), false, `${demotedId} should be demoted from the active set`);
  }
});

test('canonical answer fingerprints compare semantics across agent and mini-app shapes', async () => {
  const longText = 'This is a deliberately long answer that would be truncated in the mini app review label.';
  assert.deepEqual(
    canonicalAgentOnlyAnswerProjection({ text: ` ${longText}\n` }, { kind: 'text' }),
    canonicalAgentOnlyAnswerProjection({ questionType: 'freeform', text: longText, label: `${longText.slice(0, 39)}...`, comments: 'ignored' }),
  );
  assert.deepEqual(
    canonicalAgentOnlyAnswerProjection({ values: ['Alpha', 'Beta'] }, { kind: 'multichoice' }),
    canonicalAgentOnlyAnswerProjection({ questionType: 'multichoice', values: ['Beta', 'Alpha'], label: 'Beta, Alpha', comments: 'ignored' }),
  );
  assert.deepEqual(
    canonicalAgentOnlyAnswerProjection({ values: ['b', 'A', 'a'] }, { kind: 'multichoice' }),
    { values: ['A', 'a', 'b'] },
  );
  assert.deepEqual(
    canonicalAgentOnlyAnswerProjection({ value: 'AGREE' }, { kind: 'choice' }),
    canonicalAgentOnlyAnswerProjection({ questionType: 'agree_unsure_disagree', value: 'agree', label: 'Agree' }),
  );
  assert.deepEqual(
    canonicalAgentOnlyAnswerProjection({ value: 0 }, { kind: 'choice', values: [0, 1, 2] }),
    canonicalAgentOnlyAnswerProjection({ questionType: 'rating', value: 0, label: '0', comments: 'ignored' }),
  );
  assert.equal(
    await semanticFingerprintForAgentOnlyAnswer({ values: ['Alpha', 'Beta'] }, { kind: 'multichoice' }),
    await semanticFingerprintForAgentOnlyAnswer({ questionType: 'multichoice', values: ['Beta', 'Alpha'], label: 'Beta, Alpha' }),
  );
  assert.equal(
    await semanticFingerprintForAgentOnlyAnswer({ value: 0 }, { kind: 'choice', values: [0, 1, 2] }),
    await semanticFingerprintForAgentOnlyAnswer({ questionType: 'rating', value: 0, label: '0' }),
  );
});

test('config normalizes ceq ids and active snapshots sync flagged statements with shared answer schemas', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  const loaded = await loadAgentOnlyModeConfig({ env: testEnv, sessionSlug: 'alpha' });
  assert.deepEqual(loaded.config.enabledQuestionIds, ids);
  assert.equal(loaded.config.evalTypesByQuestionId[ids[0]], 'human_split');

  const opened = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:05:00.000Z',
  });
  assert.equal(opened.ok, true);
  assert.equal(opened.snapshot.windowId, 'w-2026-06-12');
  assert.equal(opened.snapshot.statements.length, 4);
  assert.deepEqual(opened.snapshot.statements[0].answer_schema, {
    kind: 'choice',
    values: ['agree', 'disagree', 'unsure'],
  });
  assert.deepEqual(opened.snapshot.statements[2].answer_schema, {
    kind: 'rating',
    min: 0,
    max: 10,
    step: 1,
    values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  });
  assert.equal(opened.snapshot.statements[3].answer_schema.selectionMode, 'multi');
  assert.equal(opened.snapshot.statements[3].answer_schema.maxSelections, 3);
  assert.equal(testEnv.AGENT_ACTION_KV.metadata.get(`${AGENT_ONLY_WINDOW_KV_PREFIX}alpha:w-2026-06-12`).c, 4);

  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: ids.slice(0, 1) },
    createdAt: '2026-06-12T16:00:00.000Z',
  });
  testEnv.AGENT_ACTION_KV.listCalls = 0;
  const reopened = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T16:05:00.000Z',
  });
  assert.equal(reopened.created, false);
  assert.equal(reopened.snapshot.statements.length, 1);
  assert.equal(reopened.snapshot.statements[0].statement_id, ids[0]);
  assert.equal(testEnv.AGENT_ACTION_KV.listCalls, 0);
  assert.equal(testEnv.AGENT_ACTION_KV.metadata.get(`${AGENT_ONLY_WINDOW_KV_PREFIX}alpha:w-2026-06-12`).c, 1);

  const added = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized: normalizedUser(),
    sessionSlug: 'alpha',
    prompt: 'Should Alpha add a late-window agent-only question?',
    questionType: 'binary',
  });
  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: {
      enabledQuestionIds: [ids[0], added.questionId],
      evalTypesByQuestionId: {
        [ids[0]]: 'gold',
        [added.questionId]: 'preference',
      },
    },
    createdAt: '2026-06-12T16:10:00.000Z',
  });
  testEnv.AGENT_ACTION_KV.listCalls = 0;
  const extended = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T16:15:00.000Z',
  });
  assert.equal(extended.created, false);
  assert.equal(extended.extended, true);
  assert.equal(extended.addedStatementCount, 1);
  assert.equal(extended.snapshot.statements.length, 2);
  assert.equal(extended.snapshot.statements[1].statement_id, added.questionId);
  assert.equal(extended.snapshot.statements[1].text, 'Should Alpha add a late-window agent-only question?');
  assert.equal(extended.snapshot.evalTypesByQuestionId[ids[0]], 'gold');
  assert.equal(extended.snapshot.evalTypesByQuestionId[added.questionId], 'preference');
  assert.equal(testEnv.AGENT_ACTION_KV.listCalls > 0, true);
  assert.equal(testEnv.AGENT_ACTION_KV.metadata.get(`${AGENT_ONLY_WINDOW_KV_PREFIX}alpha:w-2026-06-12`).c, 2);
});

test('rating snapshots preserve uploaded 1-5 scales and reject out-of-scale values', async () => {
  const testEnv = env();
  const rating = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized: normalizedUser(),
    sessionSlug: 'alpha',
    prompt: 'How strongly do you support this on a 1 to 5 scale?',
    questionType: 'rating',
    options: ['1', '2', '3', '4', '5'],
    createdAt: '2026-06-12T15:01:00.000Z',
  });
  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: [rating.questionId] },
    createdAt: '2026-06-12T15:02:00.000Z',
  });

  const opened = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:05:00.000Z',
  });
  assert.equal(opened.ok, true);
  assert.deepEqual(opened.snapshot.statements[0].answer_schema, {
    kind: 'rating',
    min: 1,
    max: 5,
    step: 1,
    values: [1, 2, 3, 4, 5],
  });

  const invalid = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    body: {
      window_id: 'w-2026-06-12',
      run_id: 'run-rating-scale-invalid',
      agent_metadata: { model: 'unit', scaffold_version: 'test' },
      answers: [{
        statement_id: rating.questionId,
        answer: { value: 0 },
        confidence: 80,
      }],
    },
    now: '2026-06-12T15:06:00.000Z',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.status, 400);
  assert.equal(invalid.errors[0].reason, 'answer_rating_invalid');

  const accepted = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    body: {
      window_id: 'w-2026-06-12',
      run_id: 'run-rating-scale-valid',
      agent_metadata: { model: 'unit', scaffold_version: 'test' },
      answers: [{
        statement_id: rating.questionId,
        answer: { value: 5 },
        confidence: 80,
      }],
    },
    now: '2026-06-12T15:07:00.000Z',
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.accepted, 1);
});

test('active window sync updates current eval types without changing questions', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  const opened = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:05:00.000Z',
  });
  assert.equal(opened.snapshot.evalTypesByQuestionId[ids[0]], 'human_split');

  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: {
      enabledQuestionIds: ids,
      evalTypesByQuestionId: { [ids[0]]: 'gold', [ids[1]]: 'wrapped_generation' },
    },
    createdAt: '2026-06-12T16:00:00.000Z',
  });

  const synced = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T16:05:00.000Z',
  });
  assert.equal(synced.created, false);
  assert.equal(synced.extended, true);
  assert.equal(synced.addedStatementCount, 0);
  assert.equal(synced.snapshot.statements.length, ids.length);
  assert.equal(synced.snapshot.evalTypesByQuestionId[ids[0]], 'gold');
  assert.equal(synced.snapshot.evalTypesByQuestionId[ids[1]], 'wrapped_generation');

  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: {
      enabledQuestionIds: ids,
      evalTypesByQuestionId: {},
    },
    createdAt: '2026-06-12T16:10:00.000Z',
  });
  const cleared = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T16:15:00.000Z',
  });
  assert.equal(cleared.created, false);
  assert.equal(cleared.extended, true);
  assert.equal(cleared.snapshot.evalTypesByQuestionId[ids[0]], undefined);
});

test('window extension re-reads latest snapshot and config before appending', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  const opened = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:05:00.000Z',
  });
  assert.equal(opened.ok, true);

  const concurrent = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized: normalizedUser(),
    sessionSlug: 'alpha',
    prompt: 'Should Alpha keep concurrent appends?',
    questionType: 'binary',
  });
  const preWrite = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized: normalizedUser(),
    sessionSlug: 'alpha',
    prompt: 'Should Alpha keep pre-write appends?',
    questionType: 'binary',
  });
  const late = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized: normalizedUser(),
    sessionSlug: 'alpha',
    prompt: 'Should Alpha keep the local late append?',
    questionType: 'binary',
  });
  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: {
      enabledQuestionIds: [...ids, late.questionId],
      evalTypesByQuestionId: { [late.questionId]: 'preference' },
    },
    createdAt: '2026-06-12T16:00:00.000Z',
  });

  const key = `${AGENT_ONLY_WINDOW_KV_PREFIX}alpha:w-2026-06-12`;
  let windowSnapshotReads = 0;
  testEnv.AGENT_ACTION_KV.afterGet = async (getKey, value) => {
    if (getKey !== key || !value) return;
    windowSnapshotReads += 1;
    if (windowSnapshotReads > 2) return;
    const append = windowSnapshotReads === 1 ? concurrent : preWrite;
    await saveAgentOnlyModeConfig({
      env: testEnv,
      sessionSlug: 'alpha',
      patch: {
        enabledQuestionIds: windowSnapshotReads === 1
          ? [...ids, concurrent.questionId, late.questionId]
          : [...ids, concurrent.questionId, preWrite.questionId, late.questionId],
        evalTypesByQuestionId: {
          [concurrent.questionId]: 'human_split',
          [preWrite.questionId]: 'calibration',
          [late.questionId]: 'preference',
        },
      },
      createdAt: windowSnapshotReads === 1 ? '2026-06-12T16:01:00.000Z' : '2026-06-12T16:02:00.000Z',
    });
    const snapshot = JSON.parse(testEnv.AGENT_ACTION_KV.store.get(key) || value);
    const updated = {
      ...snapshot,
      statements: [
        ...(Array.isArray(snapshot.statements) ? snapshot.statements : []),
        {
          statement_id: append.questionId,
          text: append.question.prompt,
          question_type: append.question.questionType,
          answer_schema: { kind: 'choice', values: ['agree', 'disagree', 'unsure'] },
        },
      ],
      evalTypesByQuestionId: {
        ...(snapshot.evalTypesByQuestionId || {}),
        [append.questionId]: windowSnapshotReads === 1 ? 'human_split' : 'calibration',
      },
      extendedAt: windowSnapshotReads === 1 ? '2026-06-12T16:01:00.000Z' : '2026-06-12T16:02:00.000Z',
    };
    await testEnv.AGENT_ACTION_KV.put(key, JSON.stringify(updated), {
      metadata: { v: 1, t: 'ao_window', sg: 'alpha', w: 'w-2026-06-12', c: updated.statements.length },
    });
  };

  const extended = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T16:05:00.000Z',
  });
  testEnv.AGENT_ACTION_KV.afterGet = null;
  assert.equal(extended.ok, true);
  assert.equal(extended.extended, true);
  assert.equal(extended.addedStatementCount, 1);
  assert.deepEqual(
    extended.snapshot.statements.slice(-3).map((statement) => statement.statement_id),
    [concurrent.questionId, preWrite.questionId, late.questionId],
  );
  assert.equal(extended.snapshot.evalTypesByQuestionId[concurrent.questionId], 'human_split');
  assert.equal(extended.snapshot.evalTypesByQuestionId[preWrite.questionId], 'calibration');
  assert.equal(extended.snapshot.evalTypesByQuestionId[late.questionId], 'preference');
});

test('initial window creation verifies the active config after write', async () => {
  const testEnv = env();
  const normalized = normalizedUser();
  const firstQuestion = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized,
    sessionSlug: 'alpha',
    prompt: 'Should Alpha include the first create-time question?',
    questionType: 'binary',
  });
  const secondQuestion = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized,
    sessionSlug: 'alpha',
    prompt: 'Should Alpha include the concurrent create-time question?',
    questionType: 'binary',
  });
  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: [firstQuestion.questionId] },
    createdAt: '2026-06-12T15:00:00.000Z',
  });

  const key = `${AGENT_ONLY_WINDOW_KV_PREFIX}alpha:w-2026-06-12`;
  let changed = false;
  testEnv.AGENT_ACTION_KV.beforePut = async (putKey) => {
    if (putKey !== key || changed) return;
    changed = true;
    await saveAgentOnlyModeConfig({
      env: testEnv,
      sessionSlug: 'alpha',
      patch: {
        enabledQuestionIds: [firstQuestion.questionId, secondQuestion.questionId],
        evalTypesByQuestionId: { [secondQuestion.questionId]: 'preference' },
      },
      createdAt: '2026-06-12T15:01:00.000Z',
    });
  };

  const opened = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:05:00.000Z',
  });
  testEnv.AGENT_ACTION_KV.beforePut = null;
  assert.equal(opened.ok, true);
  assert.equal(opened.created, true);
  assert.deepEqual(
    opened.snapshot.statements.map((statement) => statement.statement_id),
    [firstQuestion.questionId, secondQuestion.questionId],
  );
  const stored = JSON.parse(testEnv.AGENT_ACTION_KV.store.get(key));
  assert.deepEqual(
    stored.statements.map((statement) => statement.statement_id),
    [firstQuestion.questionId, secondQuestion.questionId],
  );
  assert.equal(stored.evalTypesByQuestionId[secondQuestion.questionId], 'preference');
});

test('initial window creation removes a stale just-created snapshot when windowing changes', async () => {
  const testEnv = env();
  const normalized = normalizedUser();
  const question = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized,
    sessionSlug: 'alpha',
    prompt: 'Should Alpha skip a create-time stale launch window?',
    questionType: 'binary',
  });
  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: [question.questionId] },
    createdAt: '2026-06-12T15:00:00.000Z',
  });

  const key = `${AGENT_ONLY_WINDOW_KV_PREFIX}alpha:w-2026-06-12`;
  let changed = false;
  testEnv.AGENT_ACTION_KV.beforePut = async (putKey) => {
    if (putKey !== key || changed) return;
    changed = true;
    await saveAgentOnlyModeConfig({
      env: testEnv,
      sessionSlug: 'alpha',
      patch: {
        enabledQuestionIds: [question.questionId],
        windowing: {
          launchOpensAt: '2026-06-12T08:00:00-07:00',
          launchClosesAt: '2026-06-12T08:30:00-07:00',
        },
      },
      createdAt: '2026-06-12T15:01:00.000Z',
    });
  };

  const opened = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T16:05:00.000Z',
  });
  testEnv.AGENT_ACTION_KV.beforePut = null;
  assert.equal(opened.ok, false);
  assert.equal(opened.reason, 'window_not_open');
  assert.equal(testEnv.AGENT_ACTION_KV.store.has(key), false);
});

test('initial window creation removes stale snapshot when windowing changes to a different active id', async () => {
  const testEnv = env();
  const question = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized: normalizedUser(),
    sessionSlug: 'alpha',
    prompt: 'Should Alpha avoid orphan active snapshots?',
    questionType: 'binary',
  });
  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: [question.questionId] },
    createdAt: '2026-06-13T14:55:00.000Z',
  });

  const staleKey = `${AGENT_ONLY_WINDOW_KV_PREFIX}alpha:w-2026-06-12`;
  const activeKey = `${AGENT_ONLY_WINDOW_KV_PREFIX}alpha:w-2026-06-13`;
  let changed = false;
  testEnv.AGENT_ACTION_KV.beforePut = async (putKey) => {
    if (putKey !== staleKey || changed) return;
    changed = true;
    await saveAgentOnlyModeConfig({
      env: testEnv,
      sessionSlug: 'alpha',
      patch: {
        enabledQuestionIds: [question.questionId],
        windowing: {
          launchOpensAt: '2026-06-13T08:00:00-07:00',
          launchClosesAt: '2026-06-15T08:00:00-07:00',
        },
      },
      createdAt: '2026-06-13T15:00:00.000Z',
    });
  };

  const opened = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-13T15:05:00.000Z',
  });
  testEnv.AGENT_ACTION_KV.beforePut = null;

  assert.equal(opened.ok, true);
  assert.equal(opened.created, true);
  assert.equal(opened.snapshot.windowId, 'w-2026-06-13');
  assert.equal(testEnv.AGENT_ACTION_KV.store.has(staleKey), false);
  assert.equal(testEnv.AGENT_ACTION_KV.store.has(activeKey), true);
});

test('window extension repairs newer appends overwritten by a paused writer', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  const opened = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:05:00.000Z',
  });
  assert.equal(opened.ok, true);

  const pausedWriterQuestion = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized: normalizedUser(),
    sessionSlug: 'alpha',
    prompt: 'Should Alpha keep the paused writer append?',
    questionType: 'binary',
  });
  const newerWriterQuestion = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized: normalizedUser(),
    sessionSlug: 'alpha',
    prompt: 'Should Alpha keep the newer writer append?',
    questionType: 'binary',
  });
  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: [...ids, pausedWriterQuestion.questionId] },
    createdAt: '2026-06-12T16:00:00.000Z',
  });

  const key = `${AGENT_ONLY_WINDOW_KV_PREFIX}alpha:w-2026-06-12`;
  let paused = false;
  let releasePausedWriter = null;
  const releasePromise = new Promise((resolve) => { releasePausedWriter = resolve; });
  const pauseReached = new Promise((resolve) => {
    testEnv.AGENT_ACTION_KV.beforePut = async (putKey, value) => {
      if (putKey !== key || paused) return;
      const idsInWrite = JSON.parse(value).statements.map((statement) => statement.statement_id);
      if (idsInWrite.includes(pausedWriterQuestion.questionId) && !idsInWrite.includes(newerWriterQuestion.questionId)) {
        paused = true;
        resolve();
        await releasePromise;
      }
    };
  });

  const first = materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T16:05:00.000Z',
  });
  await pauseReached;
  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: [...ids, pausedWriterQuestion.questionId, newerWriterQuestion.questionId] },
    createdAt: '2026-06-12T16:01:00.000Z',
  });
  const second = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T16:06:00.000Z',
  });
  assert.equal(second.ok, true);
  assert.equal(second.snapshot.statements.some((statement) => statement.statement_id === newerWriterQuestion.questionId), true);
  releasePausedWriter();
  const repaired = await first;
  testEnv.AGENT_ACTION_KV.beforePut = null;
  assert.equal(repaired.ok, true);
  const finalSnapshot = JSON.parse(testEnv.AGENT_ACTION_KV.store.get(key));
  const finalIds = finalSnapshot.statements.map((statement) => statement.statement_id);
  assert.equal(finalIds.includes(pausedWriterQuestion.questionId), true);
  assert.equal(finalIds.includes(newerWriterQuestion.questionId), true);
  assert.equal(finalSnapshot.statements.length, 6);
});

test('window extension rechecks config before appending active questions', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  const opened = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:05:00.000Z',
  });
  assert.equal(opened.ok, true);

  const removedBeforeAppend = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized: normalizedUser(),
    sessionSlug: 'alpha',
    prompt: 'Should Alpha skip a question removed during materialization?',
    questionType: 'binary',
  });
  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: [...ids, removedBeforeAppend.questionId] },
    createdAt: '2026-06-12T16:00:00.000Z',
  });

  const key = `${AGENT_ONLY_WINDOW_KV_PREFIX}alpha:w-2026-06-12`;
  let removed = false;
  testEnv.AGENT_ACTION_KV.afterGet = async (getKey) => {
    if (getKey !== key || removed) return;
    removed = true;
    await saveAgentOnlyModeConfig({
      env: testEnv,
      sessionSlug: 'alpha',
      patch: { enabledQuestionIds: ids },
      createdAt: '2026-06-12T16:01:00.000Z',
    });
  };

  const extended = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T16:05:00.000Z',
  });
  testEnv.AGENT_ACTION_KV.afterGet = null;
  assert.equal(extended.ok, true);
  assert.equal(extended.extended, false);
  assert.equal(extended.snapshot.statements.some((statement) => statement.statement_id === removedBeforeAppend.questionId), false);
  const finalSnapshot = JSON.parse(testEnv.AGENT_ACTION_KV.store.get(key));
  assert.equal(finalSnapshot.statements.some((statement) => statement.statement_id === removedBeforeAppend.questionId), false);
});

test('window extension stops when windowing config changes make the snapshot historical', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  const opened = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:05:00.000Z',
  });
  assert.equal(opened.ok, true);

  const late = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized: normalizedUser(),
    sessionSlug: 'alpha',
    prompt: 'Should Alpha skip a question after windowing changes?',
    questionType: 'binary',
  });
  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: [...ids, late.questionId] },
    createdAt: '2026-06-12T16:00:00.000Z',
  });

  const key = `${AGENT_ONLY_WINDOW_KV_PREFIX}alpha:w-2026-06-12`;
  let changed = false;
  testEnv.AGENT_ACTION_KV.afterGet = async (getKey) => {
    if (getKey !== key || changed) return;
    changed = true;
    await saveAgentOnlyModeConfig({
      env: testEnv,
      sessionSlug: 'alpha',
      patch: {
        enabledQuestionIds: [...ids, late.questionId],
        windowing: {
          launchOpensAt: '2026-06-12T08:00:00-07:00',
          launchClosesAt: '2026-06-12T08:30:00-07:00',
        },
      },
      createdAt: '2026-06-12T16:01:00.000Z',
    });
  };

  const result = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T16:05:00.000Z',
  });
  testEnv.AGENT_ACTION_KV.afterGet = null;
  assert.equal(result.ok, true);
  assert.equal(result.extended, false);
  const finalSnapshot = JSON.parse(testEnv.AGENT_ACTION_KV.store.get(key));
  assert.equal(finalSnapshot.statements.length, 4);
  assert.equal(finalSnapshot.statements.some((statement) => statement.statement_id === late.questionId), false);
});

test('window extension does not mutate historical snapshots', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  const opened = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:05:00.000Z',
  });
  assert.equal(opened.snapshot.windowId, 'w-2026-06-12');
  assert.equal(opened.snapshot.statements.length, 4);

  const late = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized: normalizedUser(),
    sessionSlug: 'alpha',
    prompt: 'Should Alpha add a historical-window question?',
    questionType: 'binary',
  });
  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: [...ids, late.questionId] },
    createdAt: '2026-06-16T15:00:00.000Z',
  });
  testEnv.AGENT_ACTION_KV.listCalls = 0;
  const historical = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    now: '2026-06-16T15:05:00.000Z',
  });
  assert.equal(historical.ok, true);
  assert.equal(historical.extended, false);
  assert.equal(historical.snapshot.windowId, 'w-2026-06-12');
  assert.equal(historical.snapshot.statements.length, 4);
  assert.equal(historical.snapshot.statements.some((statement) => statement.statement_id === late.questionId), false);
  assert.equal(testEnv.AGENT_ACTION_KV.listCalls, 0);
});

test('explicit historical windows are not backfilled when no snapshot exists', async () => {
  const testEnv = env();
  await seedQuestions(testEnv);
  const historical = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    now: '2026-06-22T15:05:00.000Z',
  });
  assert.equal(historical.ok, false);
  assert.equal(historical.reason, 'agent_only_window_historical_missing');
  assert.equal(testEnv.AGENT_ACTION_KV.store.has(`${AGENT_ONLY_WINDOW_KV_PREFIX}alpha:w-2026-06-12`), false);
});

test('agent-only prediction reads do not materialize windows before config exists', async () => {
  const testEnv = env();
  const predictions = await loadAgentOnlyPredictionsForPrincipal({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:05:00.000Z',
  });
  assert.equal(predictions.windowId, null);
  const opened = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:05:00.000Z',
  });
  assert.equal(opened.ok, false);
  assert.equal(opened.reason, 'agent_only_not_configured');
  assert.equal((await testEnv.AGENT_ACTION_KV.list({ prefix: AGENT_ONLY_WINDOW_KV_PREFIX })).keys.length, 0);
});

test('single-select multichoice snapshots enforce one selected value', () => {
  const statement = __test__telegramAgentOnlyMode.snapshotStatementFromQuestion({
    questionId: 'ceq_single_choice',
    questionType: 'multichoice',
    prompt: 'Choose one option.',
    options: ['Alpha', 'Beta', 'Gamma'],
    singleSelect: true,
  });
  assert.equal(statement.answer_schema.selectionMode, 'single');
  assert.equal(statement.answer_schema.maxSelections, 1);
  assert.deepEqual(
    __test__telegramAgentOnlyMode.normalizeAnswerForSchema({ values: ['Alpha'] }, statement.answer_schema),
    { ok: true, answer: { values: ['Alpha'] } },
  );
  assert.deepEqual(
    __test__telegramAgentOnlyMode.normalizeAnswerForSchema({ value: 'Beta' }, statement.answer_schema),
    { ok: true, answer: { values: ['Beta'] } },
  );
  assert.deepEqual(
    __test__telegramAgentOnlyMode.normalizeAnswerForSchema({ values: ['Alpha', 'Beta'] }, statement.answer_schema),
    { ok: false, reason: 'answer_multichoice_too_many' },
  );
});

test('statement page supports pre-launch response, cursor pagination, and no config leakage', async () => {
  const testEnv = env();
  await seedQuestions(testEnv);
  const prelaunch = await getAgentOnlyStatementsPage({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T14:59:00.000Z',
  });
  assert.deepEqual(prelaunch, {
    ok: true,
    window_id: null,
    window_state: 'not_open',
    statements: [],
    cursor: '',
  });

  const first = await getAgentOnlyStatementsPage({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:05:00.000Z',
    limit: 2,
  });
  assert.equal(first.statements.length, 2);
  assert.ok(first.cursor);
  const second = await getAgentOnlyStatementsPage({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:05:00.000Z',
    cursor: first.cursor,
    limit: 2,
  });
  assert.equal(second.statements.length, 2);
  assert.equal(second.cursor, '');
  const serialized = JSON.stringify(first);
  assert.equal(serialized.includes('eval_type'), false);
  assert.equal(serialized.includes('evalType'), false);
  assert.equal(serialized.includes('agent_mode_enabled'), false);
});

test('statement pagination continues after active pruning before the cursor position', async () => {
  const testEnv = env();
  const ids = [];
  for (let index = 0; index < 51; index += 1) {
    const result = await persistTelegramProposedQuestion({
      env: testEnv,
      normalized: normalizedUser(),
      sessionSlug: 'alpha',
      prompt: `Agent-only pagination question ${String(index + 1).padStart(2, '0')}?`,
      questionType: 'binary',
      createdAt: `2026-06-12T15:${String(index).padStart(2, '0')}:00.000Z`,
    });
    ids.push(result.questionId);
  }
  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: ids },
    createdAt: '2026-06-12T15:00:00.000Z',
  });

  const first = await getAgentOnlyStatementsPage({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:05:00.000Z',
    limit: 50,
  });
  assert.equal(first.statements.length, 50);
  assert.ok(first.cursor);

  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: ids.slice(1) },
    createdAt: '2026-06-12T15:06:00.000Z',
  });
  const second = await getAgentOnlyStatementsPage({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:07:00.000Z',
    cursor: first.cursor,
    limit: 50,
  });
  assert.deepEqual(second.statements.map((statement) => statement.statement_id), [ids[50]]);
  assert.equal(second.cursor, '');
});

test('statement pagination continues after active set replacement', async () => {
  const testEnv = env();
  const ids = [];
  for (let index = 0; index < 350; index += 1) {
    const result = await persistTelegramProposedQuestion({
      env: testEnv,
      normalized: normalizedUser(),
      sessionSlug: 'alpha',
      prompt: `Agent-only replacement pagination question ${String(index + 1).padStart(3, '0')}?`,
      questionType: 'binary',
    });
    ids.push(result.questionId);
  }
  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: ids.slice(0, 200) },
    createdAt: '2026-06-12T15:00:00.000Z',
  });

  let cursor = '';
  const initiallyServed = [];
  for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
    const page = await getAgentOnlyStatementsPage({
      env: testEnv,
      sessionSlug: 'alpha',
      now: '2026-06-12T15:05:00.000Z',
      cursor,
      limit: 50,
    });
    initiallyServed.push(...page.statements.map((statement) => statement.statement_id));
    cursor = page.cursor;
  }
  assert.equal(initiallyServed.length, 150);
  assert.ok(cursor);

  const replacementActiveIds = [...ids.slice(150, 200), ...ids.slice(200, 350)];
  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: replacementActiveIds },
    createdAt: '2026-06-12T15:06:00.000Z',
  });

  const afterReplacement = [];
  let guard = 0;
  while (cursor && guard < 10) {
    const page = await getAgentOnlyStatementsPage({
      env: testEnv,
      sessionSlug: 'alpha',
      now: '2026-06-12T15:07:00.000Z',
      cursor,
      limit: 50,
    });
    afterReplacement.push(...page.statements.map((statement) => statement.statement_id));
    cursor = page.cursor;
    guard += 1;
  }
  assert.equal(cursor, '');
  assert.equal(guard, 4);
  assert.deepEqual(afterReplacement, replacementActiveIds);
});

test('statement pagination advances stable snapshots for legacy offset cursors', async () => {
  const testEnv = env();
  const ids = [];
  for (let index = 0; index < 250; index += 1) {
    const result = await persistTelegramProposedQuestion({
      env: testEnv,
      normalized: normalizedUser(),
      sessionSlug: 'alpha',
      prompt: `Agent-only legacy cursor question ${String(index + 1).padStart(3, '0')}?`,
      questionType: 'binary',
    });
    ids.push(result.questionId);
  }
  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: ids.slice(0, 200) },
    createdAt: '2026-06-12T15:00:00.000Z',
  });
  await getAgentOnlyStatementsPage({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:05:00.000Z',
    limit: 50,
  });

  const legacyOffsetCursor = Buffer.from('50').toString('base64url');
  const secondPage = await getAgentOnlyStatementsPage({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:07:00.000Z',
    cursor: legacyOffsetCursor,
    limit: 50,
  });
  assert.deepEqual(
    secondPage.statements.map((statement) => statement.statement_id),
    ids.slice(50, 100),
  );
  assert.ok(secondPage.cursor);
});

test('statement pagination preserves legacy offset cursors after active pruning', async () => {
  const testEnv = env();
  const ids = [];
  for (let index = 0; index < 51; index += 1) {
    const result = await persistTelegramProposedQuestion({
      env: testEnv,
      normalized: normalizedUser(),
      sessionSlug: 'alpha',
      prompt: `Agent-only pruned legacy cursor question ${String(index + 1).padStart(2, '0')}?`,
      questionType: 'binary',
      createdAt: `2026-06-12T15:${String(index).padStart(2, '0')}:00.000Z`,
    });
    ids.push(result.questionId);
  }
  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: ids },
    createdAt: '2026-06-12T15:00:00.000Z',
  });
  await getAgentOnlyStatementsPage({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:05:00.000Z',
    limit: 50,
  });

  const legacyOffsetCursor = Buffer.from('50').toString('base64url');
  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: ids.slice(1) },
    createdAt: '2026-06-12T15:06:00.000Z',
  });
  const secondPage = await getAgentOnlyStatementsPage({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:07:00.000Z',
    cursor: legacyOffsetCursor,
    limit: 50,
  });
  assert.deepEqual(secondPage.statements.map((statement) => statement.statement_id), [ids[50]]);
  assert.equal(secondPage.cursor, '');
});

test('answer bulk validates rows, writes sidecar events/state, and replays idempotently', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  await materializeAgentOnlyWindow({ env: testEnv, sessionSlug: 'alpha', now: '2026-06-12T15:05:00.000Z' });
  const base = {
    window_id: 'w-2026-06-12',
    run_id: 'run-answers-1',
    request_id: 'answers-1',
    agent_metadata: {
      model: 'unit-model',
      scaffold_version: 'unit-scaffold',
      agent_initialized_at: '2026-06-12T12:00:00.000Z',
      token_usage: {
        current_run_total_tokens: '1,234,567',
        recent_sessions_total_tokens: 4567000,
        input_tokens: 900000,
        output_tokens: 334567,
        daily_usage_30d: [
          { date: '2026-06-10', tokens: 120000 },
          { date: '2026-06-11', tokens: 240000 },
        ],
        edge_in_person_dates: ['2026-06-10'],
        source: 'Hermes visible usage',
      },
    },
  };
  const rejected = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      ...base,
      request_id: 'bad-skip',
      answers: [{ statement_id: ids[0], skipped: true, skip_reason: 'privacy_protective', rationale: 'too much' }],
    },
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.errors[0].reason, 'privacy_skip_shape_invalid');
  const stale = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      ...base,
      request_id: 'stale-window',
      window_id: 'w-2026-06-15',
      answers: [{ statement_id: ids[0], answer: { value: 'agree' }, confidence: 85 }],
    },
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.status, 409);
  assert.equal(stale.reason, 'window_mismatch');

  const accepted = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      ...base,
      answers: [
        { statement_id: ids[0], answer: { value: 'agree' }, confidence: 85, rationale: 'Matches prior preferences.' },
        { statement_id: ids[1], answer: { text: 'Improve the way sessions are scheduled.' }, confidence: 61 },
        { statement_id: ids[2], answer: { value: 8 }, confidence: 74 },
        { statement_id: ids[3], skipped: true, skip_reason: 'privacy_protective' },
      ],
    },
  });
  assert.deepEqual(accepted, {
    ok: true,
    window_id: 'w-2026-06-12',
    accepted: 4,
    skipsRecorded: 1,
    replay: false,
  });
  const eventCount = (await testEnv.AGENT_ACTION_KV.list({ prefix: AGENT_ONLY_ANSWER_EVENT_KV_PREFIX })).keys.length;
  assert.equal(eventCount, 4);

  const replay = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      ...base,
      answers: [
        { statement_id: ids[0], answer: { value: 'agree' }, confidence: 85, rationale: 'Matches prior preferences.' },
        { statement_id: ids[1], answer: { text: 'Improve the way sessions are scheduled.' }, confidence: 61 },
        { statement_id: ids[2], answer: { value: 8 }, confidence: 74 },
        { statement_id: ids[3], skipped: true, skip_reason: 'privacy_protective' },
      ],
    },
  });
  assert.equal(replay.replay, true);
  const eventCountAfterReplay = (await testEnv.AGENT_ACTION_KV.list({ prefix: AGENT_ONLY_ANSWER_EVENT_KV_PREFIX })).keys.length;
  assert.equal(eventCountAfterReplay, 4);

  const metrics = await buildAgentOnlyMetrics({ env: testEnv, scope: 'session', sessionSlug: 'alpha' });
  assert.equal(metrics.responsesSubmitted, 3);
  assert.equal(metrics.privacySkips, 1);
  assert.equal(metrics.distinctPrincipals, 1);

  const exported = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'answers',
    format: 'jsonl',
  });
  const answerRows = exported.body.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const skipRow = answerRows.find((row) => row.event_kind === 'privacy_protective_skip');
  assert.equal(exported.ok, true);
  assert.equal(answerRows.length, 4);
  assert.equal(answerRows.every((row) => row.request_id === 'answers-1'), true);
  assert.equal(answerRows.every((row) => row.run_id === 'run-answers-1'), true);
  assert.equal(answerRows.every((row) => row.model === 'unit-model'), true);
  assert.equal(answerRows.every((row) => row.token_current_run_total === 1234567), true);
  assert.equal(answerRows.every((row) => row.token_recent_sessions_total === 4567000), true);
  assert.equal(answerRows.every((row) => row.token_input === 900000), true);
  assert.equal(answerRows.every((row) => row.token_output === 334567), true);
  assert.deepEqual(answerRows[0].token_daily_usage_30d, [
    { date: '2026-06-10', tokens: 120000 },
    { date: '2026-06-11', tokens: 240000 },
  ]);
  assert.deepEqual(answerRows[0].token_edge_in_person_dates, ['2026-06-10']);
  assert.equal(answerRows.every((row) => row.token_usage_source === 'Hermes visible usage'), true);
  assert.equal(skipRow.rationale, null);
  assert.equal(skipRow.confidence, null);

  const calibration = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'calibration',
    format: 'jsonl',
  });
  const calibrationRows = calibration.body.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(calibrationRows.reduce((sum, row) => sum + row.prediction_count, 0), 3);
  assert.equal(calibrationRows.some((row) => row.confidence_band === '0-9'), false);

  const rerun = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:11:00.000Z',
    body: {
      ...base,
      run_id: 'run-answers-rerun',
      request_id: 'answers-rerun',
      answers: [{ statement_id: ids[0], answer: { value: 'disagree' }, confidence: 42 }],
    },
  });
  assert.equal(rerun.ok, true);
  const rerunAnswers = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'answers',
    format: 'jsonl',
  });
  assert.equal(rerunAnswers.body.split('\n').filter(Boolean).length, 5);
  const identicalFreshRun = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:12:00.000Z',
    body: {
      ...base,
      run_id: 'run-answers-rerun-2',
      request_id: 'answers-rerun-identical-fresh-run',
      answers: [{ statement_id: ids[0], answer: { value: 'disagree' }, confidence: 42 }],
    },
  });
  assert.equal(identicalFreshRun.ok, true);
  assert.equal(identicalFreshRun.replay, false);
  const identicalFreshRunAnswers = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'answers',
    format: 'jsonl',
  });
  const identicalFreshRunRows = identicalFreshRunAnswers.body.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(identicalFreshRunRows.length, 6);
  assert.equal(identicalFreshRunRows.some((row) => row.request_id === 'answers-rerun-identical-fresh-run'), true);
  const rerunCalibration = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'calibration',
    format: 'jsonl',
  });
  const rerunCalibrationRows = rerunCalibration.body.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(rerunCalibrationRows.reduce((sum, row) => sum + row.prediction_count, 0), 3);
  assert.deepEqual(rerunCalibrationRows.map((row) => row.confidence_band), ['40-49', '60-69', '70-79']);
});

test('admin metrics count distinct principals once across multiple windows', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  const common = {
    run_id: 'run-principal-window',
    agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
    answers: [{ statement_id: ids[0], answer: { value: 'agree' }, confidence: 83 }],
  };
  const first = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      ...common,
      window_id: 'w-2026-06-12',
      run_id: 'run-principal-window-a',
      request_id: 'principal-window-a',
    },
  });
  const second = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-15T15:10:00.000Z',
    body: {
      ...common,
      window_id: 'w-2026-06-15',
      run_id: 'run-principal-window-b',
      request_id: 'principal-window-b',
    },
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);

  const metrics = await buildAgentOnlyMetrics({ env: testEnv, scope: 'session', sessionSlug: 'alpha' });
  assert.equal(metrics.responsesSubmitted, 2);
  assert.equal(metrics.distinctPrincipals, 1);
  assert.deepEqual(
    metrics.perWindow.map((window) => [window.windowId, window.distinctPrincipals]),
    [['w-2026-06-12', 1], ['w-2026-06-15', 1]],
  );
});

test('rating zero predictions keep a visible label and matching semantic fingerprint', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  await materializeAgentOnlyWindow({ env: testEnv, sessionSlug: 'alpha', now: '2026-06-12T15:05:00.000Z' });
  const accepted = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      window_id: 'w-2026-06-12',
      run_id: 'run-rating-zero',
      request_id: 'rating-zero',
      agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
      answers: [{ statement_id: ids[2], answer: { value: 0 }, confidence: 77 }],
    },
  });
  assert.equal(accepted.ok, true);
  const review = await loadAgentOnlyPredictionsForPrincipal({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:11:00.000Z',
  });
  assert.equal(review.predictionsByQuestionId[ids[2]].valueLabel, '0');
  assert.equal(
    review.predictionsByQuestionId[ids[2]].semanticFingerprint,
    await semanticFingerprintForAgentOnlyAnswer({ questionType: 'rating', value: 0, label: '0' }),
  );
});

test('token votes enforce linear and quadratic budgets and replace per-mode allocation', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  await materializeAgentOnlyWindow({ env: testEnv, sessionSlug: 'alpha', now: '2026-06-12T15:05:00.000Z' });
  const common = {
    window_id: 'w-2026-06-12',
    run_id: 'run-votes-1',
    agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
  };
  const linear = await submitAgentOnlyTokenVotesBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      ...common,
      request_id: 'linear-1',
      mode: 'linear',
      votes: [{ statement_id: ids[0], votes: 60 }, { statement_id: ids[1], votes: -40 }],
    },
  });
  assert.equal(linear.ok, true);
  assert.equal(linear.budgetUsed, 100);

  const over = await submitAgentOnlyTokenVotesBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      ...common,
      request_id: 'linear-over',
      mode: 'linear',
      votes: [{ statement_id: ids[0], votes: 60 }, { statement_id: ids[1], votes: -41 }],
    },
  });
  assert.equal(over.ok, false);
  assert.equal(over.errors[0].reason, 'vote_budget_exceeded');
  const stale = await submitAgentOnlyTokenVotesBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      ...common,
      request_id: 'stale-votes',
      window_id: 'w-2026-06-15',
      mode: 'linear',
      votes: [{ statement_id: ids[0], votes: 1 }],
    },
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.status, 409);
  assert.equal(stale.reason, 'window_mismatch');

  const quadratic = await submitAgentOnlyTokenVotesBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      ...common,
      request_id: 'quad-1',
      mode: 'quadratic',
      votes: [{ statement_id: ids[0], votes: 10 }],
    },
  });
  assert.equal(quadratic.ok, true);
  assert.equal(quadratic.budgetUsed, 100);

  const metrics = await buildAgentOnlyMetrics({ env: testEnv, scope: 'session', sessionSlug: 'alpha' });
  assert.equal(metrics.voteAllocations, 2);
  assert.equal(metrics.voteBudgetUsed, 200);

  const rerun = await submitAgentOnlyTokenVotesBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:11:00.000Z',
    body: {
      ...common,
      run_id: 'run-votes-2',
      request_id: 'linear-2',
      mode: 'linear',
      votes: [{ statement_id: ids[0], votes: 30 }],
    },
  });
  assert.equal(rerun.ok, true);
  const exported = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'votes',
    format: 'jsonl',
  });
  const linearRows = exported.body
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((row) => row.source === 'agent_autofill' && row.mode === 'linear' && row.statement_id === ids[0])
    .sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)));
  assert.deepEqual(linearRows.map((row) => row.votes), [60, 30]);
});

test('summary export counts distinct principals and completed runs from attempt telemetry', async () => {
  const testEnv = env();
  await recordAgentOnlyAttemptEvent({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    stage: 'answers_bulk',
    status: 200,
    now: '2026-06-12T15:00:00.000Z',
    body: { window_id: 'w-2026-06-12', run_id: 'run-complete', request_id: 'answers-1' },
    result: {
      ok: true,
      window_id: 'w-2026-06-12',
      run_id: 'run-complete',
      accepted: 58,
      statement_count: 58,
      agent_response_count: 58,
      privacy_skip_count: 0,
    },
  });
  await recordAgentOnlyAttemptEvent({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    stage: 'wrapped_image',
    status: 200,
    now: '2026-06-12T15:01:00.000Z',
    body: { window_id: 'w-2026-06-12', run_id: 'run-complete', request_id: 'image-1' },
    result: {
      ok: true,
      window_id: 'w-2026-06-12',
      run_id: 'run-complete',
      statement_count: 58,
      agent_response_count: 58,
    },
  });
  await recordAgentOnlyAttemptEvent({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '2002',
    stage: 'answers_bulk',
    status: 200,
    now: '2026-06-12T15:02:00.000Z',
    body: { window_id: 'w-2026-06-12', run_id: 'run-partial', request_id: 'answers-2' },
    result: {
      ok: true,
      window_id: 'w-2026-06-12',
      run_id: 'run-partial',
      accepted: 12,
      statement_count: 58,
      agent_response_count: 58,
    },
  });
  await recordAgentOnlyAttemptEvent({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '3003',
    stage: 'answers_bulk',
    status: 200,
    now: '2026-06-19T15:00:00.000Z',
    body: { window_id: 'w-2026-06-19', run_id: 'run-other-window', request_id: 'answers-3' },
    result: {
      ok: true,
      window_id: 'w-2026-06-19',
      run_id: 'run-other-window',
      accepted: 58,
      statement_count: 58,
      agent_response_count: 58,
    },
  });

  const exported = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    view: 'summary',
    format: 'json',
    now: '2026-06-12T16:00:00.000Z',
  });
  assert.equal(exported.ok, true);
  assert.equal(exported.contentType, 'application/json; charset=utf-8');
  const summary = JSON.parse(exported.body);
  assert.equal(summary.attempt_event_count, 3);
  assert.equal(summary.distinct_principal_count, 2);
  assert.equal(summary.answer_complete_principal_count, 1);
  assert.equal(summary.wrapped_image_principal_count, 1);
  assert.equal(summary.successful_principal_count, 1);
  assert.equal(summary.run_count, 2);
  assert.equal(summary.answer_complete_run_count, 1);
  assert.equal(summary.wrapped_image_run_count, 1);
  assert.equal(summary.first_attempt_at, '2026-06-12T15:00:00.000Z');
  assert.equal(summary.latest_attempt_at, '2026-06-12T15:02:00.000Z');
  assert.equal(summary.principals.length, 2);
  assert.equal(summary.runs.find((run) => run.run_id === 'run-complete').answer_complete, true);
  assert.equal(summary.runs.find((run) => run.run_id === 'run-partial').answer_complete, false);
});

test('human review is idempotent and agent reruns never overwrite human precedence', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  await materializeAgentOnlyWindow({ env: testEnv, sessionSlug: 'alpha', now: '2026-06-12T15:05:00.000Z' });
  const firstAgent = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      window_id: 'w-2026-06-12',
      run_id: 'run-precedence-1',
      request_id: 'precedence-agent-1',
      agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
      answers: [{ statement_id: ids[0], answer: { value: 'agree' }, confidence: 85 }],
    },
  });
  assert.equal(firstAgent.ok, true);
  const confirm = await recordAgentOnlyHumanReview({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    questionId: ids[0],
    answer: { questionType: 'agree_unsure_disagree', value: 'agree' },
    kind: 'confirm',
    now: '2026-06-12T15:11:00.000Z',
  });
  assert.equal(confirm.recorded, true);
  assert.equal(confirm.source, 'human_confirm');
  const duplicateConfirm = await recordAgentOnlyHumanReview({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    questionId: ids[0],
    answer: { questionType: 'agree_unsure_disagree', value: 'agree' },
    kind: 'confirm',
    now: '2026-06-12T15:12:00.000Z',
  });
  assert.equal(duplicateConfirm.recorded, false);
  assert.equal(duplicateConfirm.reason, 'already_confirmed');
  const rerun = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:13:00.000Z',
    body: {
      window_id: 'w-2026-06-12',
      run_id: 'run-precedence-2',
      request_id: 'precedence-agent-2',
      agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
      answers: [{ statement_id: ids[0], answer: { value: 'disagree' }, confidence: 64 }],
    },
  });
  assert.equal(rerun.ok, true);
  const stateKey = __test__telegramAgentOnlyMode.answerStateKey('alpha', 'w-2026-06-12', '1001');
  const state = JSON.parse(await testEnv.AGENT_ACTION_KV.get(stateKey));
  assert.deepEqual(state.byStatement[ids[0]].agent.answer, { value: 'disagree' });
  assert.equal(state.byStatement[ids[0]].human.kind, 'confirm');
  assert.deepEqual(state.byStatement[ids[0]].human.answer, { questionType: 'agree_unsure_disagree', value: 'agree' });
  const predictions = await loadAgentOnlyPredictionsForPrincipal({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:14:00.000Z',
  });
  assert.equal(predictions.predictionsByQuestionId[ids[0]].valueLabel, 'Disagree');
  assert.equal(predictions.predictionsByQuestionId[ids[0]].confirmed, false);
  assert.equal(predictions.predictionsByQuestionId[ids[0]].reviewed, true);
  const exported = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'answers',
    format: 'jsonl',
  });
  const agentRows = exported.body.split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((row) => row.source === 'agent_autofill');
  assert.deepEqual(agentRows.map((row) => row.answer.value).sort(), ['agree', 'disagree']);
  const calibration = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'calibration',
    format: 'jsonl',
  });
  const calibrationRows = calibration.body.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(calibrationRows[0].confirm_count, 0);
  assert.equal(calibrationRows[0].edit_count, 1);
  const wide = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'wide',
    format: 'jsonl',
  });
  const wideRows = wide.body.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(wideRows[0].review_status, 'human_stale_confirm');
});

test('explicit confirm after a human edit is a no-op and preserves edit classification', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  await materializeAgentOnlyWindow({ env: testEnv, sessionSlug: 'alpha', now: '2026-06-12T15:05:00.000Z' });
  const agent = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      window_id: 'w-2026-06-12',
      run_id: 'run-edit-before-confirm',
      request_id: 'edit-before-confirm-agent',
      agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
      answers: [{ statement_id: ids[0], answer: { value: 'agree' }, confidence: 85 }],
    },
  });
  assert.equal(agent.ok, true);
  const edit = await recordAgentOnlyHumanReview({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    questionId: ids[0],
    answer: { questionType: 'agree_unsure_disagree', value: 'disagree' },
    kind: 'edit',
    now: '2026-06-12T15:11:00.000Z',
  });
  assert.equal(edit.recorded, true);
  assert.equal(edit.source, 'human_edit_after_agent');
  const eventCountBeforeConfirm = (await testEnv.AGENT_ACTION_KV.list({ prefix: AGENT_ONLY_ANSWER_EVENT_KV_PREFIX })).keys.length;
  const confirm = await recordAgentOnlyHumanReview({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    questionId: ids[0],
    answer: { questionType: 'agree_unsure_disagree', value: 'disagree' },
    kind: 'confirm',
    now: '2026-06-12T15:12:00.000Z',
  });
  assert.equal(confirm.recorded, false);
  assert.equal(confirm.reason, 'already_reviewed');
  const eventCountAfterConfirm = (await testEnv.AGENT_ACTION_KV.list({ prefix: AGENT_ONLY_ANSWER_EVENT_KV_PREFIX })).keys.length;
  assert.equal(eventCountAfterConfirm, eventCountBeforeConfirm);
  const stateKey = __test__telegramAgentOnlyMode.answerStateKey('alpha', 'w-2026-06-12', '1001');
  const state = JSON.parse(await testEnv.AGENT_ACTION_KV.get(stateKey));
  assert.equal(state.byStatement[ids[0]].human.kind, 'edit');
  assert.deepEqual(state.byStatement[ids[0]].human.answer, { questionType: 'agree_unsure_disagree', value: 'disagree' });
});

test('human review and vote sidecars sync active pruning before recording', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  await materializeAgentOnlyWindow({ env: testEnv, sessionSlug: 'alpha', now: '2026-06-12T15:05:00.000Z' });
  const agent = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      window_id: 'w-2026-06-12',
      run_id: 'run-pruned-sidecar',
      request_id: 'pruned-sidecar-agent-answer',
      agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
      answers: [
        { statement_id: ids[0], answer: { value: 'agree' }, confidence: 85 },
        { statement_id: ids[1], answer: { text: 'Earlier answer' }, confidence: 80 },
      ],
    },
  });
  assert.equal(agent.ok, true);
  const prePruneVote = await submitAgentOnlyHumanVoteTaps({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:30.000Z',
    taps: [{ questionId: ids[1], delta: 1 }],
  });
  assert.equal(prePruneVote.ok, true);
  assert.deepEqual(prePruneVote.nets, { [ids[1]]: 1 });
  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: [ids[0]] },
    createdAt: '2026-06-12T15:11:00.000Z',
  });

  const review = await recordAgentOnlyHumanReview({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    questionId: ids[1],
    answer: { text: 'Earlier answer' },
    kind: 'confirm',
    now: '2026-06-12T15:12:00.000Z',
  });
  assert.equal(review.recorded, false);
  assert.equal(review.reason, 'agent_statement_not_flagged');

  const vote = await submitAgentOnlyHumanVoteTaps({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    now: '2026-06-12T15:13:00.000Z',
    taps: [{ questionId: ids[1], delta: 1 }],
  });
  assert.equal(vote.ok, false);
  assert.equal(vote.reason, 'tap_statement_not_flagged');
  const visibleVote = await submitAgentOnlyHumanVoteTaps({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    now: '2026-06-12T15:13:30.000Z',
    taps: [{ questionId: ids[0], delta: 1 }],
  });
  assert.equal(visibleVote.ok, true);
  assert.deepEqual(visibleVote.nets, { [ids[0]]: 1 });
  assert.equal(visibleVote.budgetUsed, 1);
  const predictions = await loadAgentOnlyPredictionsForPrincipal({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:14:00.000Z',
  });
  assert.deepEqual(Object.keys(predictions.predictionsByQuestionId), [ids[0]]);
  assert.deepEqual(predictions.flaggedQuestionIds, [ids[0]]);
  assert.deepEqual(predictions.humanVote.nets, { [ids[0]]: 1 });
  assert.equal(predictions.humanVote.budgetUsed, 1);
  const exported = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'votes',
    format: 'jsonl',
  });
  const humanVoteRows = exported.body
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((row) => row.source === 'human_direct');
  assert.deepEqual(new Set(humanVoteRows.map((row) => row.statement_id)), new Set([ids[0], ids[1]]));
  const snapshot = JSON.parse(testEnv.AGENT_ACTION_KV.store.get(`${AGENT_ONLY_WINDOW_KV_PREFIX}alpha:w-2026-06-12`));
  assert.deepEqual(snapshot.statements.map((statement) => statement.statement_id), [ids[0]]);
  assert.equal(snapshot.evalTypesByQuestionId[ids[0]], 'human_split');
});

test('human tap batches are flagged-only, refundable, and exported without raw user ids', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  await materializeAgentOnlyWindow({ env: testEnv, sessionSlug: 'alpha', now: '2026-06-12T15:05:00.000Z' });
  const taps = await submitAgentOnlyHumanVoteTaps({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    taps: [{ questionId: ids[0], delta: 1 }, { questionId: ids[0], delta: 1 }, { questionId: ids[0], delta: -1 }],
  });
  assert.equal(taps.ok, true);
  assert.deepEqual(taps.nets, { [ids[0]]: 1 });
  assert.equal(taps.budgetUsed, 1);
  const refunded = await submitAgentOnlyHumanVoteTaps({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    now: '2026-06-12T15:11:00.000Z',
    taps: [{ questionId: ids[0], delta: -1 }],
  });
  assert.equal(refunded.ok, true);
  assert.deepEqual(refunded.nets, {});
  assert.equal(refunded.budgetUsed, 0);
  const exactBatches = Array.from({ length: 50 }, () => ({ questionId: ids[0], delta: 1 }));
  const exactA = await submitAgentOnlyHumanVoteTaps({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    now: '2026-06-12T15:12:00.000Z',
    taps: exactBatches,
  });
  const exactB = await submitAgentOnlyHumanVoteTaps({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    now: '2026-06-12T15:13:00.000Z',
    taps: exactBatches,
  });
  assert.equal(exactA.ok, true);
  assert.equal(exactB.ok, true);
  assert.equal(exactB.budgetUsed, 100);
  const over = await submitAgentOnlyHumanVoteTaps({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    now: '2026-06-12T15:14:00.000Z',
    taps: [{ questionId: ids[0], delta: 1 }],
  });
  assert.equal(over.ok, false);
  assert.equal(over.reason, 'human_vote_budget_exceeded');
  const afterOver = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'votes',
    format: 'jsonl',
  });
  assert.equal(afterOver.body.includes('"votes":100'), true);

  const isolated = await submitAgentOnlyHumanVoteTaps({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1002',
    now: '2026-06-12T15:15:00.000Z',
    taps: [{ questionId: ids[1], delta: 1 }],
  });
  assert.equal(isolated.ok, true);
  assert.deepEqual(isolated.nets, { [ids[1]]: 1 });
  const unflagged = await submitAgentOnlyHumanVoteTaps({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1002',
    now: '2026-06-12T15:16:00.000Z',
    taps: [{ questionId: 'ceq_not_flagged', delta: 1 }],
  });
  assert.equal(unflagged.ok, false);
  assert.equal(unflagged.reason, 'tap_statement_not_flagged');

  const exported = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'votes',
    format: 'jsonl',
  });
  assert.equal(exported.ok, true);
  assert.equal(exported.body.includes('1001'), false);
  assert.equal(exported.body.includes('cep_'), true);
  assert.notEqual(
    exported.body.includes(createHash('sha256').update('1001').digest('hex').slice(0, 24)),
    true,
  );
});

test('wide and gold exports join normal submitted answers and snapshot eval types', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  await materializeAgentOnlyWindow({ env: testEnv, sessionSlug: 'alpha', now: '2026-06-12T15:05:00.000Z' });
  await persistTelegramSubmitRecord({
    env: testEnv,
    record: {
      requestId: 'normal-prior',
      status: 'submit_request_created',
      sessionSlug: 'alpha',
      telegramUserId: '1001',
      questionId: ids[0],
      answer: { value: 'disagree' },
      createdAt: '2026-06-12T15:03:00.000Z',
    },
  });
  const agent = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:05:00.000Z',
    body: {
      window_id: 'w-2026-06-12',
      run_id: 'run-agent-after-prior',
      agent_metadata: { model: 'unit', scaffold_version: 'test' },
      request_id: 'agent-after-prior',
      answers: [{ statement_id: ids[0], answer: { value: 'agree' }, confidence: 70 }],
    },
  });
  assert.equal(agent.ok, true);
  await persistTelegramSubmitRecord({
    env: testEnv,
    record: {
      requestId: 'normal-current',
      status: 'submit_request_created',
      sessionSlug: 'alpha',
      telegramUserId: '1001',
      questionId: ids[0],
      answer: { value: 'unsure' },
      createdAt: '2026-06-12T15:10:00.000Z',
    },
  });

  const wide = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'wide',
    format: 'jsonl',
  });
  assert.equal(wide.ok, true);
  const wideRows = wide.body.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(wideRows.length, 1);
  assert.equal(wideRows[0].eval_type, 'human_split');
  assert.deepEqual(wideRows[0].agent_prediction, { value: 'agree' });
  assert.deepEqual(wideRows[0].human_current_answer, { value: 'unsure' });

  const compactWide = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'wide',
    format: 'jsonl',
    compact: true,
  });
  assert.equal(compactWide.ok, true);
  const compactWideRows = compactWide.body.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(compactWideRows.length, 1);
  assert.deepEqual(compactWideRows[0].agent_prediction, { value: 'agree' });
  assert.equal(compactWideRows[0].human_current_answer, null);
  assert.equal(compactWideRows[0].review_status, '');
  assert.equal(compactWideRows[0].eval_type, '');

  const gold = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'gold',
    format: 'jsonl',
  });
  assert.equal(gold.ok, true);
  const goldRows = gold.body.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(goldRows.length, 1);
  assert.equal(goldRows[0].eval_type, 'human_split');
  assert.deepEqual(goldRows[0].prior_human_answer, { value: 'disagree' });
  assert.deepEqual(goldRows[0].agent_prediction, { value: 'agree' });
  assert.equal(gold.body.includes('1001'), false);

  const compactGold = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'gold',
    format: 'jsonl',
    compact: true,
  });
  assert.equal(compactGold.ok, true);
  const compactGoldRows = compactGold.body.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(compactGoldRows.length, 1);
  assert.deepEqual(compactGoldRows[0].prior_human_answer, { value: 'disagree' });
  assert.deepEqual(compactGoldRows[0].agent_prediction, { value: 'agree' });
  assert.equal(compactGoldRows[0].eval_type, '');

  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: {
      enabledQuestionIds: ids,
      evalTypesByQuestionId: {},
    },
    createdAt: '2026-06-12T15:12:00.000Z',
  });
  const clearedWide = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'wide',
    format: 'jsonl',
    now: '2026-06-12T15:13:00.000Z',
  });
  const clearedWideRows = clearedWide.body.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(clearedWideRows[0].eval_type, '');

  const clearedGold = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'gold',
    format: 'jsonl',
    now: '2026-06-12T15:14:00.000Z',
  });
  const clearedGoldRows = clearedGold.body.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(clearedGoldRows[0].eval_type, '');
});
