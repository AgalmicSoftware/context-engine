export const TELEGRAM_TOPIC_MAP_CACHE_PREFIX = 'telegram:topic-map:v1:';

const TOPIC_MAP_VERSION = 1;
const TOPIC_MAP_VIEWBOX = Object.freeze({ width: 720, height: 420 });
const MIN_TOPIC_MAP_QUESTIONS = 2;
const MIN_TOPIC_MAP_RESPONSES = 2;
const MAX_TOPICS = 8;
const MAX_QUESTIONS_PER_TOPIC = 6;
const TOPIC_MAP_RESPONSE_REFRESH_FRACTION = 0.15;

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'against', 'agent', 'agents', 'allow', 'also',
  'and', 'answer', 'answers', 'are', 'because', 'before', 'being', 'best',
  'between', 'both', 'can', 'could', 'during', 'each', 'every', 'from',
  'group', 'groups', 'have', 'into', 'more', 'most', 'need', 'people',
  'question', 'questions', 'response', 'responses', 'session', 'should',
  'than', 'that', 'the', 'their', 'there', 'these', 'this', 'through',
  'user', 'users', 'want', 'what', 'when', 'where', 'which', 'while', 'with',
  'would', 'your',
]);

function safeString(value) {
  return String(value || '').trim();
}

function lower(value) {
  return safeString(value).toLowerCase();
}

function sanitizeSessionSlug(value = '') {
  return lower(value).replace(/[^a-z0-9_-]/g, '').slice(0, 128);
}

function safeJsonParse(value, fallback = null) {
  const text = safeString(value);
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function stableFingerprint(value = {}) {
  const input = stableJson(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(10, '0');
}

function kvKeySafePart(value = '') {
  const text = safeString(value);
  if (!text) return 'default';
  const safe = text.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
  return `${safe || 'ref'}_${stableFingerprint(text)}`;
}

function questionId(question = {}) {
  return safeString(question.questionId || question.id || question.key);
}

function questionText(question = {}) {
  return safeString(question.questionText || question.prompt || question.title || question.text || question.question);
}

function normalizeTags(input = []) {
  const source = Array.isArray(input) ? input : safeString(input).split(/[\n,;|]+/);
  const tags = source
    .map((tag) => lower(tag).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter((tag) => tag && tag.length >= 2 && tag.length <= 48);
  return Array.from(new Set(tags)).slice(0, 8);
}

function titleCaseTag(tag = '') {
  const replacements = new Map([
    ['ai', 'AI'],
    ['tg', 'Telegram'],
    ['ux', 'UX'],
    ['sbt', 'SBT'],
  ]);
  return safeString(tag)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => replacements.get(part.toLowerCase()) || `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function inferKeywordTags(question = {}, session = {}) {
  const text = [
    questionText(question),
    safeString(question.questionType || question.type || question.controlType),
    safeString(session.sessionName || session.name),
  ].join(' ');
  const counts = new Map();
  for (const word of lower(text).split(/[^a-z0-9]+/).filter(Boolean)) {
    if (word.length < 4 || STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([word]) => word);
}

function topicTagsForQuestion(question = {}, session = {}) {
  const explicit = normalizeTags(question.tags || question.questionTags || question.generatedTags);
  if (explicit.length) return explicit;
  const inferred = inferKeywordTags(question, session);
  return inferred.length ? inferred : ['general'];
}

function recordsByQuestion(records = []) {
  const byQuestion = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const qid = safeString(record.questionId);
    if (!qid) continue;
    if (!byQuestion.has(qid)) {
      byQuestion.set(qid, {
        responseCount: 0,
        participants: new Set(),
        latestCreatedAt: '',
      });
    }
    const item = byQuestion.get(qid);
    item.responseCount += 1;
    if (record.telegramUserId) item.participants.add(safeString(record.telegramUserId));
    const createdAt = safeString(record.createdAt);
    if (createdAt && createdAt > item.latestCreatedAt) item.latestCreatedAt = createdAt;
  }
  return byQuestion;
}

function topicLayout(topics = []) {
  const slots = [
    [360, 210],
    [205, 165],
    [515, 165],
    [235, 305],
    [485, 305],
    [130, 255],
    [590, 255],
    [360, 98],
  ];
  const maxScore = Math.max(...topics.map((topic) => Number(topic.score || 0)), 1);
  return topics.map((topic, index) => {
    const [x, y] = slots[index % slots.length];
    const normalized = Math.sqrt(Math.max(1, Number(topic.score || 0)) / maxScore);
    const radius = Math.round(54 + normalized * 48);
    return { ...topic, x, y, r: radius };
  });
}

function questionBubbleLayout(topic = {}) {
  const questions = Array.isArray(topic.questions) ? topic.questions : [];
  const count = Math.min(MAX_QUESTIONS_PER_TOPIC, questions.length);
  return questions.slice(0, MAX_QUESTIONS_PER_TOPIC).map((question, index) => {
    const angle = -Math.PI / 2 + ((index + 0.25) * Math.PI * 2) / Math.max(1, count);
    const distance = Math.max(18, Number(topic.r || 60) * 0.58);
    const size = Math.max(7, Math.min(16, 7 + Math.round(Math.sqrt(Number(question.responseCount || 0)) * 3)));
    return {
      ...question,
      label: question.label || `Q${index + 1}`,
      x: Math.round(Number(topic.x || 0) + Math.cos(angle) * distance),
      y: Math.round(Number(topic.y || 0) + Math.sin(angle) * distance),
      r: size,
    };
  });
}

export function buildTelegramTopicMapSignature({
  questions = [],
  records = [],
} = {}) {
  const questionParts = (Array.isArray(questions) ? questions : [])
    .map((question) => ({
      questionId: questionId(question),
      prompt: questionText(question),
      tags: normalizeTags(question.tags || question.questionTags || question.generatedTags),
      type: safeString(question.questionType || question.type || question.controlType),
    }))
    .filter((question) => question.questionId || question.prompt)
    .sort((left, right) => (left.questionId || left.prompt).localeCompare(right.questionId || right.prompt));
  const responseParts = Array.from(recordsByQuestion(records).entries())
    .map(([qid, item]) => ({
      questionId: qid,
      responseCount: item.responseCount,
      participantCount: item.participants.size,
      latestCreatedAt: item.latestCreatedAt,
    }))
    .sort((left, right) => left.questionId.localeCompare(right.questionId));
  const participantIds = new Set((Array.isArray(records) ? records : []).map((record) => safeString(record.telegramUserId)).filter(Boolean));
  return {
    questionCount: questionParts.length,
    responseCount: responseParts.reduce((sum, item) => sum + item.responseCount, 0),
    participantCount: participantIds.size,
    answeredQuestionCount: responseParts.filter((item) => item.responseCount > 0).length,
    questionFingerprint: stableFingerprint(questionParts),
    responseFingerprint: stableFingerprint(responseParts),
  };
}

export function buildTelegramTopicMap({
  session = {},
  questions = [],
  records = [],
  demo = false,
  generatedAt = new Date().toISOString(),
  cache = null,
} = {}) {
  const signature = buildTelegramTopicMapSignature({ questions, records });
  const byQuestion = recordsByQuestion(records);
  const topicBuckets = new Map();
  const renderableParticipants = new Set();
  const orderedQuestions = (Array.isArray(questions) ? questions : [])
    .map((question) => {
      const qid = questionId(question);
      const stats = byQuestion.get(qid);
      return {
        questionId: qid,
        prompt: questionText(question),
        tags: topicTagsForQuestion(question, session),
        responseCount: Number(stats?.responseCount || 0),
        participantCount: Number(stats?.participants?.size || 0),
      };
    })
    .filter((question) => question.questionId && question.prompt && question.responseCount > 0);
  const renderableResponseCount = orderedQuestions.reduce((sum, question) => sum + question.responseCount, 0);

  orderedQuestions.forEach((question, index) => {
    const primaryTag = question.tags[0] || 'general';
    if (!topicBuckets.has(primaryTag)) {
      topicBuckets.set(primaryTag, {
        topicId: primaryTag,
        label: titleCaseTag(primaryTag),
        questionCount: 0,
        responseCount: 0,
        participants: new Set(),
        questions: [],
        firstIndex: index,
      });
    }
    const bucket = topicBuckets.get(primaryTag);
    bucket.questionCount += 1;
    bucket.responseCount += question.responseCount;
    const stats = byQuestion.get(question.questionId);
    if (stats?.participants) {
      stats.participants.forEach((participantId) => {
        bucket.participants.add(participantId);
        renderableParticipants.add(participantId);
      });
    }
    bucket.questions.push({
      questionId: question.questionId,
      label: `Q${index + 1}`,
      prompt: question.prompt,
      responseCount: question.responseCount,
      participantCount: question.participantCount,
      tags: question.tags,
    });
  });

  const topics = topicLayout(Array.from(topicBuckets.values())
    .map((topic) => ({
      topicId: topic.topicId,
      label: topic.label,
      questionCount: topic.questionCount,
      responseCount: topic.responseCount,
      participantCount: topic.participants.size,
      score: topic.responseCount + topic.questionCount,
      questions: topic.questions
        .sort((left, right) => right.responseCount - left.responseCount || left.prompt.localeCompare(right.prompt))
        .slice(0, MAX_QUESTIONS_PER_TOPIC),
      overflowQuestionCount: Math.max(0, topic.questions.length - MAX_QUESTIONS_PER_TOPIC),
      firstIndex: topic.firstIndex,
    }))
    .sort((left, right) => right.score - left.score || left.firstIndex - right.firstIndex)
    .slice(0, MAX_TOPICS))
    .map((topic) => ({
      ...topic,
      questions: questionBubbleLayout(topic),
    }));

  const availability = {
    available: demo === true || (orderedQuestions.length >= MIN_TOPIC_MAP_QUESTIONS && renderableResponseCount >= MIN_TOPIC_MAP_RESPONSES && topics.length > 0),
    reason: '',
    minAnsweredQuestions: MIN_TOPIC_MAP_QUESTIONS,
    minResponses: MIN_TOPIC_MAP_RESPONSES,
  };
  if (!availability.available) {
    availability.reason = renderableResponseCount < MIN_TOPIC_MAP_RESPONSES
      ? 'not_enough_responses'
      : 'not_enough_answered_questions';
  }

  return {
    type: 'telegram_topic_map',
    version: TOPIC_MAP_VERSION,
    generatedAt,
    demo: demo === true,
    sessionSlug: sanitizeSessionSlug(session.sessionSlug),
    sessionName: safeString(session.sessionName || session.name || session.sessionSlug),
    viewBox: TOPIC_MAP_VIEWBOX,
    availability,
    counts: {
      questions: signature.questionCount,
      answeredQuestions: orderedQuestions.length,
      responses: renderableResponseCount,
      participants: renderableParticipants.size,
      topics: topics.length,
    },
    topics,
    sourceRevision: signature,
    cache,
  };
}

function topicMapCacheKey(sessionSlug = '', variantKey = 'all') {
  const slug = sanitizeSessionSlug(sessionSlug);
  return `${TELEGRAM_TOPIC_MAP_CACHE_PREFIX}${slug}:${kvKeySafePart(variantKey || 'all')}`;
}

function shouldRefreshTopicMap(cached = {}, signature = {}) {
  const previous = cached.signature && typeof cached.signature === 'object' ? cached.signature : {};
  if (!previous.questionFingerprint || previous.questionFingerprint !== signature.questionFingerprint) return true;
  if (Number(previous.questionCount || 0) !== Number(signature.questionCount || 0)) return true;
  if (Number(previous.answeredQuestionCount || 0) !== Number(signature.answeredQuestionCount || 0)) return true;
  const previousResponses = Number(previous.responseCount || 0);
  const nextResponses = Number(signature.responseCount || 0);
  const delta = Math.abs(nextResponses - previousResponses);
  if (delta === 0) return false;
  // For tiny sessions every new response can materially change the map. For larger
  // sessions, avoid rebuilding until the aggregate data has moved enough to matter.
  const threshold = previousResponses < 10
    ? 1
    : Math.max(3, Math.ceil(previousResponses * TOPIC_MAP_RESPONSE_REFRESH_FRACTION));
  return delta >= threshold;
}

export async function loadOrBuildTelegramTopicMap({
  env = {},
  session = {},
  sessionSlug = '',
  questions = [],
  records = [],
  demo = false,
  variantKey = 'all',
  forceRefresh = false,
  generatedAt = new Date().toISOString(),
} = {}) {
  const slug = sanitizeSessionSlug(sessionSlug || session.sessionSlug);
  const signature = buildTelegramTopicMapSignature({ questions, records });
  const kv = env.AGENT_ACTION_KV;
  if (demo === true || !kv?.get || !kv?.put || !slug) {
    return buildTelegramTopicMap({
      session: { ...session, sessionSlug: slug },
      questions,
      records,
      demo,
      generatedAt,
      cache: { status: demo ? 'demo' : 'disabled' },
    });
  }

  const key = topicMapCacheKey(slug, variantKey);
  const cachedRecord = safeJsonParse(await kv.get(key).catch(() => null), null);
  if (!forceRefresh && cachedRecord?.topicMap && !shouldRefreshTopicMap(cachedRecord, signature)) {
    return {
      ...cachedRecord.topicMap,
      cache: {
        status: 'hit',
        key,
        generatedAt: cachedRecord.generatedAt || cachedRecord.topicMap.generatedAt || '',
        sourceRevision: cachedRecord.signature || {},
      },
    };
  }

  const topicMap = buildTelegramTopicMap({
    session: { ...session, sessionSlug: slug },
    questions,
    records,
    demo: false,
    generatedAt,
    cache: {
      status: cachedRecord?.topicMap ? 'refresh' : 'miss',
      key,
      previousGeneratedAt: cachedRecord?.generatedAt || '',
      sourceRevision: signature,
    },
  });
  if (topicMap.availability.available) {
    await kv.put(key, JSON.stringify({
      type: 'telegram_topic_map_cache',
      version: TOPIC_MAP_VERSION,
      sessionSlug: slug,
      variantKey: safeString(variantKey || 'all'),
      generatedAt,
      signature,
      topicMap: {
        ...topicMap,
        cache: null,
      },
    })).catch(() => {});
  }
  return topicMap;
}
