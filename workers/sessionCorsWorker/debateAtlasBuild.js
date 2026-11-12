import { resolveAnalysisAiPayload } from './resultsAnalysisGeneration.js';
import {
  RESULTS_BUILD_LIMITS,
  RESULTS_BUILD_RULES,
  cleanBuildText,
  dispatchResultsBuildRead,
  runResultsBuild,
} from './resultsBuild.js';

// One admin press builds a debate atlas from the responses stored at that
// moment: a planning call groups the questions into branches and topics, then
// one call per topic, and one per branch of several topics, at most
// CONCURRENCY at once, maps positions and a political compass. Each response
// reaches its topic's call and its branch's, so a build reads about twice what
// one AI Views run does.
export const DEBATE_ATLAS_BUILD_ACTION = 'debate-atlas/build';
export const DEBATE_ATLAS_LIMITS = Object.freeze({
  branches: 5,
  topics: 12,
  positions: 6,
  placedParticipants: 40,
  concurrency: 6,
  ...RESULTS_BUILD_LIMITS,
  textChars: 600,
});

const toArray = (value) => (Array.isArray(value) ? value : []);
const trim = (value) => (value == null ? '' : String(value).trim());
const text = (value, max = DEBATE_ATLAS_LIMITS.textChars) => cleanBuildText(value, max);
const unit = (value) => {
  if (value === null || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, Math.round(number * 1000) / 1000)) : null;
};

export const buildDebateAtlasPlanPrompt = ({ sessionName = '', questions = [], contextText = '' } = {}) => `You are planning a debate atlas for a Context Engine session from its survey questions.
Group the questions into 2 to ${DEBATE_ATLAS_LIMITS.branches} branches and each branch into 1 to 4 topics, at most ${DEBATE_ATLAS_LIMITS.topics} topics in all. A topic gathers questions people can disagree about along the same lines. Put each question that has responses in exactly one topic; leave out questions with none.
Return one JSON object with no Markdown fences and no tool calls, in this shape:
{ "title": "short atlas title", "branches": [{ "label": "2-5 word branch name", "summary": "one neutral sentence", "topics": [{ "label": "2-6 word topic name", "questionIds": ["q1"] }] }] }

Rules:
${[...RESULTS_BUILD_RULES, 'Use only the question IDs listed below.', 'Name branches and topics after what the questions ask, in plain words.'].map((rule) => `- ${rule}`).join('\n')}

Session: ${JSON.stringify(text(sessionName, 200))}
Questions (responses is how many answers each has):
${JSON.stringify(questions)}${contextText ? `

The session's hosts gave this background. Use it only to understand the subject; group and name only what the questions ask.
${contextText}` : ''}`;

// Maps one topic, or with no topic one branch across all its topics' questions.
export const buildDebateAtlasTopicPrompt = ({ branch = '', topic = '', questions = [], responses = [], placeParticipants = [] } = {}) => `You are mapping ${topic ? 'one topic' : 'one branch, across all its topics,'} of a Context Engine debate atlas from survey responses.
Branch: ${JSON.stringify(text(branch, 120))}.${topic ? ` Topic: ${JSON.stringify(text(topic, 120))}.` : ''}
Return one JSON object with no Markdown fences and no tool calls, in this shape:
{
  "summary": "one or two neutral sentences, under 280 characters in all, on where participants agree and where they split",
  "compass": { "x": { "label": "axis name", "left": "short position", "right": "short position" }, "y": { "label": "axis name", "top": "short position", "bottom": "short position" } },
  "positions": [{ "label": "3-8 word position", "summary": "paraphrased reasoning behind it", "participantIds": ["participant_001"], "x": 0.2, "y": 0.7 }],
  "participants": [{ "participantId": "participant_001", "x": 0.25, "y": 0.65, "reason": "under 15 words on why they sit here" }]
}

Rules:
${[
  ...RESULTS_BUILD_RULES,
  `Choose the compass's two axes from this ${topic ? 'topic' : 'branch'}'s main disagreements, independent of each other, and write each end as a short plain position.`,
  'x runs from 0 at the left end to 1 at the right end; y runs from 0 at the bottom end to 1 at the top end. Place every point by what its responses say about the ends you wrote, and do not pile points on the centre when the evidence leans.',
  `List 2 to ${DEBATE_ATLAS_LIMITS.positions} distinct positions found in the responses, keeping a minority view even when one participant holds it. Each position cites every participant who holds it, and only participants who answered these questions.`,
  'Place each participant in placeParticipants exactly once, from their own answers only; the reason paraphrases those answers.',
].map((rule) => `- ${rule}`).join('\n')}

${topic ? 'Topic' : 'Branch'} input:
${JSON.stringify({ questions, responses, placeParticipants })}`;

// What a build would send now, with the session's data left as placeholders,
// so a builder sees the model and the prompts before and while one runs.
export const describeNextDebateAtlasBuild = (config) => {
  const unquote = (prompt) => prompt.replace(/"(<[A-Za-z ,]+>)"/g, '$1');
  return {
    model: trim(resolveAnalysisAiPayload({ config, prompt: '' }).model),
    prompts: {
      plan: unquote(buildDebateAtlasPlanPrompt({
        sessionName: config?.sessionName,
        questions: '<Questions>',
        contextText: '<Background, when the hosts gave some>',
      })),
      map: unquote(buildDebateAtlasTopicPrompt({
        branch: '<Branch>',
        topic: '<Topic, left out for a whole branch>',
        questions: '<Questions>',
        responses: '<Responses>',
        placeParticipants: '<Participants>',
      })),
    },
  };
};

const planQuestion = (question, responseCount) => ({
  id: question.id,
  prompt: text(question.prompt, 400),
  type: question.type,
  ...(toArray(question.options).length ? { options: question.options.slice(0, 8).map((option) => text(option, 80)) } : {}),
  ...(toArray(question.tags).length ? { tags: question.tags.slice(0, 6) } : {}),
  responses: responseCount,
});

// Every question with responses goes to at most one topic, in plan order.
export const normalizeDebateAtlasPlan = ({ value, answeredQuestionIds }) => {
  const claimed = new Set();
  let topicCount = 0;
  const branches = toArray(value?.branches).slice(0, DEBATE_ATLAS_LIMITS.branches).map((branch, branchIndex) => {
    const label = text(branch?.label, 80);
    if (!label) return null;
    const topics = toArray(branch?.topics).map((topic) => {
      const topicLabel = text(topic?.label, 80);
      if (!topicLabel || topicCount >= DEBATE_ATLAS_LIMITS.topics) return null;
      const questionIds = [...new Set(toArray(topic?.questionIds).map(trim))]
        .filter((id) => answeredQuestionIds.has(id) && !claimed.has(id));
      if (!questionIds.length) return null;
      questionIds.forEach((id) => claimed.add(id));
      topicCount += 1;
      return { id: `b${branchIndex + 1}t${topicCount}`, label: topicLabel, questionIds };
    }).filter(Boolean);
    return topics.length ? { id: `b${branchIndex + 1}`, label, summary: text(branch?.summary, 300), topics } : null;
  }).filter(Boolean);
  return { title: text(value?.title, 120), branches };
};

const normalizeCompass = (value) => {
  const axis = (record, ends) => {
    const out = { label: text(record?.label, 80) };
    ends.forEach((end) => { out[end] = text(record?.[end], 80); });
    return Object.values(out).every(Boolean) ? out : null;
  };
  const x = axis(value?.x, ['left', 'right']);
  const y = axis(value?.y, ['top', 'bottom']);
  return x && y ? { x, y } : null;
};

// AI output is evidence only where it names participants who answered this
// topic's questions; anything else is dropped rather than shown.
export const normalizeDebateAtlasTopic = ({ value, answeredBy, placeParticipants, participantAddresses }) => {
  const compass = normalizeCompass(value?.compass);
  const positions = toArray(value?.positions).map((position) => {
    const label = text(position?.label, 100);
    const holders = [...new Set(toArray(position?.participantIds).map(trim))].filter((id) => answeredBy.has(id));
    const x = unit(position?.x);
    const y = unit(position?.y);
    if (!label || !holders.length) return null;
    return {
      label,
      summary: text(position?.summary, 400),
      participantCount: holders.length,
      ...(compass && x !== null && y !== null ? { x, y } : {}),
    };
  }).filter(Boolean).slice(0, DEBATE_ATLAS_LIMITS.positions);
  const placeable = new Set(placeParticipants);
  const placed = new Set();
  const participants = compass ? toArray(value?.participants).map((entry) => {
    const id = trim(entry?.participantId);
    const x = unit(entry?.x);
    const y = unit(entry?.y);
    if (!placeable.has(id) || placed.has(id) || x === null || y === null) return null;
    placed.add(id);
    const address = participantAddresses?.get?.(id) || '';
    return {
      ...(address ? { address } : { label: `Participant ${Number(id.replace(/\D/g, '')) || placed.size}` }),
      x,
      y,
      reason: text(entry?.reason, 160),
    };
  }).filter(Boolean) : [];
  // `answered` counts everyone whose answers the AI read here, the whole that each position's holders are part of.
  return positions.length ? { summary: text(value?.summary, 600), compass, positions, participants, answered: answeredBy.size } : null;
};

// Runs `task` over `items` with at most `limit` in flight, keeping order.
export const runWithConcurrency = async (items, limit, task) => {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

const failure = (status, error) => ({ ok: false, status, error });

export const buildDebateAtlas = (args = {}) => runResultsBuild({
  ...args,
  kindName: 'debate-atlas',
  limits: DEBATE_ATLAS_LIMITS,
  compose: async ({ source, callAi, contextText }) => {
    const { questions, responses } = source.aiSnapshot;
    const responsesByQuestion = new Map();
    responses.forEach((response) => {
      responsesByQuestion.set(response.questionId, [...(responsesByQuestion.get(response.questionId) || []), response]);
    });
    const answeredQuestionIds = new Set(responsesByQuestion.keys());
    const planResult = await callAi(buildDebateAtlasPlanPrompt({
      sessionName: args.config?.sessionName,
      questions: questions.filter((question) => answeredQuestionIds.has(question.id))
        .map((question) => planQuestion(question, responsesByQuestion.get(question.id).length)),
      contextText,
    }));
    if (!planResult.ok) return failure(planResult.status || 502, `Planning the atlas failed: ${planResult.error}`);
    const plan = normalizeDebateAtlasPlan({ value: planResult.value, answeredQuestionIds });
    if (!plan.branches.length) return failure(502, 'The AI did not group the questions into topics; try again.');

    const questionsById = new Map(questions.map((question) => [question.id, question]));
    const topics = plan.branches.flatMap((branch) => branch.topics.map((topic) => ({ branch, topic, questionIds: topic.questionIds })));
    // Branches go last, so a build short of time drops a branch's compass before a topic.
    const branchJobs = plan.branches.filter((branch) => branch.topics.length > 1)
      .map((branch) => ({ branch, topic: null, questionIds: branch.topics.flatMap((topic) => topic.questionIds) }));
    const mapped = await runWithConcurrency([...topics, ...branchJobs], DEBATE_ATLAS_LIMITS.concurrency, async ({ branch, topic, questionIds }) => {
      const topicResponses = questionIds.flatMap((id) => responsesByQuestion.get(id));
      const answeredBy = new Map();
      topicResponses.forEach((response) => answeredBy.set(response.participantId, (answeredBy.get(response.participantId) || 0) + 1));
      // The most active participants first, so the cap drops the lightest evidence.
      const placeParticipants = [...answeredBy.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, DEBATE_ATLAS_LIMITS.placedParticipants)
        .map(([id]) => id);
      const result = await callAi(buildDebateAtlasTopicPrompt({
        branch: branch.label,
        topic: topic?.label || '',
        questions: questionIds.map((id) => {
          const { id: questionId, prompt, type, options, scale, voiceCredits } = questionsById.get(id);
          return { id: questionId, prompt, type, ...(options?.length ? { options } : {}), ...(scale ? { scale } : {}), ...(voiceCredits ? { voiceCredits } : {}) };
        }),
        responses: topicResponses.map(({ participantId, questionId, answer, additional }) => ({ participantId, questionId, answer, ...(additional ? { additional } : {}) })),
        placeParticipants,
      }));
      return result.ok
        ? normalizeDebateAtlasTopic({ value: result.value, answeredBy, placeParticipants, participantAddresses: source.participantAddresses })
        : null;
    });

    let topicIndex = 0;
    const missingTopics = [];
    const branchMaps = new Map(branchJobs.map(({ branch }, index) => [branch.id, mapped[topics.length + index]]));
    const branches = plan.branches.map((branch) => {
      const mappedTopics = branch.topics.map((topic) => {
        const result = mapped[topicIndex];
        topicIndex += 1;
        if (!result) {
          missingTopics.push(topic.label);
          return null;
        }
        return {
          id: topic.id,
          label: topic.label,
          ...result,
          questions: topic.questionIds.map((id) => ({ id, prompt: text(questionsById.get(id).prompt, 400), type: questionsById.get(id).type })),
        };
      }).filter(Boolean);
      // A branch of one topic shares that topic's compass and keeps the plan's summary.
      const own = branch.topics.length > 1;
      const map = own ? branchMaps.get(branch.id) : mappedTopics[0];
      return {
        id: branch.id,
        label: branch.label,
        summary: (own && map?.summary) || branch.summary,
        ...(map ? { compass: map.compass, positions: map.positions, participants: map.participants, answered: map.answered } : {}),
        topics: mappedTopics,
      };
    }).filter((branch) => branch.topics.length);
    if (!branches.length) return failure(502, 'No topic of the atlas could be mapped; try again.');
    return { ok: true, build: { title: plan.title, missingTopics, branches } };
  },
});

export const dispatchDebateAtlasReadRequest = (args = {}) => dispatchResultsBuildRead({
  ...args,
  kindName: 'debate-atlas',
  describeNextBuild: describeNextDebateAtlasBuild,
});
