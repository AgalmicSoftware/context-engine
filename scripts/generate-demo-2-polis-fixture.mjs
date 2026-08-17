#!/usr/bin/env node

// Generates the full demo-2 Polis data and its compact question seed from the
// hand-authored demo-2 sources:
//   - demo_2_question_set.json     (questions, categories, loadings, options, scales)
//   - demo_2_persona_stances.json  (62 personas: cluster, stance axes, freeform answers)
//   - demo_polis_data.json         (xid -> participant address mapping only)
//
// Fully deterministic: votes derive from stance-axis x question-loading dot
// products plus FNV-1a-seeded jitter; timestamps come from the question set's
// fixed base. Re-running on unchanged inputs is a byte-identical no-op.
//
// Usage: npm run demo:2:generate

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const scriptDir = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const demoDir = path.join(repoRoot, 'client', 'src', 'variables', 'demo');

// Env overrides exist for the test harness only; normal runs use the repo paths.
const QUESTION_SET_PATH = process.env.DEMO2_QUESTION_SET_PATH
  || path.join(demoDir, 'demo_2_question_set.json');
const STANCES_PATH = process.env.DEMO2_STANCES_PATH
  || path.join(demoDir, 'demo_2_persona_stances.json');
const LEGACY_POLIS_PATH = process.env.DEMO2_LEGACY_POLIS_PATH
  || path.join(demoDir, 'demo_polis_data.json');
const OUTPUT_PATH = process.env.DEMO2_OUTPUT_PATH
  || path.join(demoDir, 'demo_2_polis_data.json');
const QUESTION_SEED_OUTPUT_PATH = process.env.DEMO2_QUESTION_SEED_OUTPUT_PATH
  || path.join(demoDir, 'demo_2_question_seed.json');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const questionSet = readJson(QUESTION_SET_PATH);
const stances = readJson(STANCES_PATH);
const legacyPolis = readJson(LEGACY_POLIS_PATH);

const AXES = questionSet.axes;
const MODEL = questionSet.voteModel;
const questions = questionSet.questions;
const personas = stances.personas;
const clusters = stances.clusters;

// --- deterministic hashing -------------------------------------------------

const fnv1a = (input) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
};

// Unit float in [0, 1) derived from a namespaced key.
const unitFloat = (key) => fnv1a(key) / 0x100000000;

// Signed jitter in [-1, 1).
const signedJitter = (key) => unitFloat(key) * 2 - 1;

// Logistic-distributed noise (heavy tails), scaled by MODEL.noiseScale.
// Heavy tails matter: they produce the occasional within-cluster defector
// that keeps group agree-rates off the degenerate 0.0/1.0 extremes.
const logisticNoise = (key, scale) => {
  const r = Math.min(0.999, Math.max(0.001, unitFloat(key)));
  return scale * Math.log(r / (1 - r));
};

// --- validation ------------------------------------------------------------

const fail = (message) => {
  console.error(`generate-demo-2-polis-fixture: ${message}`);
  process.exit(1);
};

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const requireFiniteNumber = (value, label) => {
  if (!isFiniteNumber(value)) fail(`${label} must be a finite number (got ${JSON.stringify(value)})`);
};

const requireNonEmptyString = (value, label) => {
  if (typeof value !== 'string' || value.trim() === '') fail(`${label} must be a non-empty string`);
};

const VALID_QUESTION_TYPES = new Set(['binary', 'poll', 'rating', 'freeform']);

// Fail-closed model validation: a malformed input must abort before any
// output is written, never serialize as NaN/null or silently suppress votes.
requireFiniteNumber(MODEL?.noiseScale, 'voteModel.noiseScale');
if (MODEL.noiseScale <= 0) fail('voteModel.noiseScale must be > 0');
requireFiniteNumber(MODEL?.agreeThreshold, 'voteModel.agreeThreshold');
requireFiniteNumber(MODEL?.disagreeThreshold, 'voteModel.disagreeThreshold');
if (MODEL.disagreeThreshold >= MODEL.agreeThreshold) {
  fail('voteModel.disagreeThreshold must be below agreeThreshold');
}
requireFiniteNumber(MODEL?.pollJitterAmplitude, 'voteModel.pollJitterAmplitude');
requireFiniteNumber(MODEL?.ratingNoiseWeight, 'voteModel.ratingNoiseWeight');
requireFiniteNumber(MODEL?.baseTimestamp, 'voteModel.baseTimestamp');
requireFiniteNumber(MODEL?.timestampStepMs, 'voteModel.timestampStepMs');

if (!Array.isArray(AXES) || AXES.length === 0) fail('axes must be a non-empty array');
AXES.forEach((axis) => requireNonEmptyString(axis, 'axes entry'));
if (new Set(AXES).size !== AXES.length) fail('axes must be unique (duplicates double-count in scoring)');
if (JSON.stringify(stances.axes) !== JSON.stringify(AXES)) {
  fail('stances.axes must match the question set axes exactly');
}
if (!Array.isArray(personas) || personas.length === 0) fail('personas must be a non-empty array');
// The emitted groupRates objects are keyed group1..group3, so the cluster
// count is a fixed contract, not a free parameter.
if (!Array.isArray(clusters) || clusters.length !== 3) {
  fail('clusters must contain exactly 3 entries (groupRates serialize as group1..group3)');
}
clusters.forEach((cluster, index) => {
  if (cluster?.id !== index) fail(`clusters[${index}].id must equal its index (got ${cluster?.id})`);
  requireNonEmptyString(cluster?.label, `clusters[${index}].label`);
  requireNonEmptyString(cluster?.characteristics, `clusters[${index}].characteristics`);
});

const addressByXid = new Map();
(legacyPolis.participantsVotes || []).forEach((participant) => {
  if (participant?.xid && participant?.participant) {
    addressByXid.set(String(participant.xid), String(participant.participant));
  }
});

const personaXidSeen = new Set();
const personaAddressSeen = new Set();
personas.forEach((persona) => {
  if (!addressByXid.has(persona.xid)) {
    fail(`persona xid ${persona.xid} has no address in demo_polis_data.json`);
  }
  if (personaXidSeen.has(persona.xid)) {
    fail(`duplicate persona xid ${persona.xid}`);
  }
  personaXidSeen.add(persona.xid);
  const personaAddress = String(addressByXid.get(persona.xid)).toLowerCase();
  if (personaAddressSeen.has(personaAddress)) {
    fail(`persona xid ${persona.xid} resolves to an address already used by another persona (${personaAddress})`);
  }
  personaAddressSeen.add(personaAddress);
  if (!Number.isInteger(persona.cluster) || persona.cluster < 0 || persona.cluster >= clusters.length) {
    fail(`persona ${persona.xid} cluster must be an integer in [0, ${clusters.length - 1}]`);
  }
  if (!isFiniteNumber(persona.engagement) || persona.engagement <= 0 || persona.engagement > 1) {
    fail(`persona ${persona.xid} engagement must be a number in (0, 1]`);
  }
  AXES.forEach((axis) => {
    const value = persona.axes?.[axis];
    if (!isFiniteNumber(value) || value < -1 || value > 1) {
      fail(`persona ${persona.xid} axis ${axis} must be a number in [-1, 1]`);
    }
  });
  Object.entries(persona.freeform || {}).forEach(([slug, answer]) => {
    const question = questions.find((entry) => entry.slug === slug);
    if (!question) fail(`persona ${persona.xid} freeform references unknown question ${slug}`);
    if (question.type !== 'freeform') fail(`persona ${persona.xid} freeform answer targets non-freeform question ${slug}`);
    if (typeof answer !== 'string' || answer.trim() === '') {
      fail(`persona ${persona.xid} freeform answer for ${slug} must be a non-empty string`);
    }
  });
});

// Scoring inputs must be recognized axes with finite values — a typo'd axis
// name or non-numeric loading would otherwise silently score as 0/NaN.
const validateLoadings = (loadings, label) => {
  if (loadings === undefined) return;
  if (!loadings || typeof loadings !== 'object' || Array.isArray(loadings)) {
    fail(`${label} must be an object of axis -> number`);
  }
  Object.entries(loadings).forEach(([axis, value]) => {
    if (!AXES.includes(axis)) fail(`${label} references unknown axis ${axis}`);
    if (!isFiniteNumber(value) || value < -1 || value > 1) {
      fail(`${label}.${axis} must be a number in [-1, 1] (got ${JSON.stringify(value)})`);
    }
  });
};

const validateBias = (bias, label) => {
  if (bias === undefined) return;
  if (!isFiniteNumber(bias) || bias < -1 || bias > 1) {
    fail(`${label} must be a number in [-1, 1] (got ${JSON.stringify(bias)})`);
  }
};

const slugSeen = new Set();
questions.forEach((question) => {
  requireNonEmptyString(question?.slug, 'question.slug');
  if (slugSeen.has(question.slug)) fail(`duplicate question slug ${question.slug}`);
  slugSeen.add(question.slug);
  requireNonEmptyString(question?.prompt, `question ${question.slug} prompt`);
  requireNonEmptyString(question?.category, `question ${question.slug} category`);
  if (!VALID_QUESTION_TYPES.has(question.type)) {
    fail(`question ${question.slug} type must be one of ${[...VALID_QUESTION_TYPES].join('/')}`);
  }
  if (question.author && !addressByXid.has(question.author)) {
    fail(`question ${question.slug} author ${question.author} has no address`);
  }
  validateLoadings(question.loadings, `question ${question.slug} loadings`);
  validateBias(question.bias, `question ${question.slug} bias`);
  if (question.type === 'poll') {
    if (!Array.isArray(question.options) || question.options.length < 2) {
      fail(`poll question ${question.slug} needs at least 2 options`);
    }
    question.options.forEach((option, optionIndex) => {
      requireNonEmptyString(option?.label, `question ${question.slug} options[${optionIndex}].label`);
      validateLoadings(option.loadings, `question ${question.slug} options[${optionIndex}].loadings`);
      validateBias(option.bias, `question ${question.slug} options[${optionIndex}].bias`);
    });
  }
  if (question.type === 'rating') {
    const scale = question.scale;
    requireFiniteNumber(scale?.min, `rating question ${question.slug} scale.min`);
    requireFiniteNumber(scale?.max, `rating question ${question.slug} scale.max`);
    if (scale.min >= scale.max) fail(`rating question ${question.slug} scale.min must be below scale.max`);
  }
});

// --- scoring ---------------------------------------------------------------

const dotLoadings = (axes, loadings = {}) => (
  AXES.reduce((sum, axis) => sum + (axes[axis] || 0) * (loadings[axis] || 0), 0)
);

const stanceScore = (persona, question) => {
  const noise = logisticNoise(`score|${persona.xid}|${question.slug}`, MODEL.noiseScale);
  return dotLoadings(persona.axes, question.loadings) + (question.bias || 0) + noise;
};

const triStateVote = (score) => {
  if (score > MODEL.agreeThreshold) return 1;
  if (score < MODEL.disagreeThreshold) return -1;
  return 0;
};

const ratingValue = (persona, question, score) => {
  const { min, max } = question.scale;
  const mid = (min + max) / 2;
  const span = max - min;
  const noise = logisticNoise(`rating|${persona.xid}|${question.slug}`, MODEL.noiseScale)
    * MODEL.ratingNoiseWeight;
  const raw = Math.round(mid + (score + noise) * (span / 2));
  return Math.min(max, Math.max(min, raw));
};

const pollChoice = (persona, question) => {
  let best = null;
  let bestScore = -Infinity;
  question.options.forEach((option, optionIndex) => {
    const jitter = signedJitter(`poll|${persona.xid}|${question.slug}|${optionIndex}`)
      * MODEL.pollJitterAmplitude;
    const score = dotLoadings(persona.axes, option.loadings) + (option.bias || 0) + jitter;
    if (score > bestScore) {
      bestScore = score;
      best = option.label;
    }
  });
  return best;
};

// --- generation ------------------------------------------------------------

const pad2 = (value) => String(value).padStart(2, '0');
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatUtc = (timestamp) => {
  const date = new Date(timestamp);
  return `${WEEKDAYS[date.getUTCDay()]} ${MONTHS[date.getUTCMonth()]} ${pad2(date.getUTCDate())} `
    + `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())} UTC ${date.getUTCFullYear()}`;
};

const participants = personas.map((persona) => ({
  participant: addressByXid.get(persona.xid),
  xid: persona.xid,
  groupId: persona.cluster,
  nVotes: 0,
  nAgree: 0,
  nDisagree: 0,
  votes: {},
  responses: {},
}));

const comments = questions.map((question, index) => {
  const timestamp = MODEL.baseTimestamp + index * MODEL.timestampStepMs;
  const comment = {
    timestamp,
    datetime: formatUtc(timestamp),
    commentId: question.slug,
    authorId: question.author ? addressByXid.get(question.author) : '',
    agrees: 0,
    disagrees: 0,
    moderated: 0,
    commentBody: question.prompt,
    type: question.type,
    category: question.category,
    key_tension: question.keyTension,
    sources: question.sources,
  };
  if (question.type === 'poll') {
    comment.options = question.options.map((option) => option.label);
  }
  if (question.type === 'rating') {
    comment.scale = question.scale;
  }
  return comment;
});

personas.forEach((persona, personaIndex) => {
  const row = participants[personaIndex];
  questions.forEach((question, questionIndex) => {
    const engaged = unitFloat(`engage|${persona.xid}|${question.slug}`) < persona.engagement;
    const key = String(questionIndex);

    if (question.type === 'freeform') {
      const answer = persona.freeform?.[question.slug];
      if (answer) row.responses[key] = { value: answer };
      return;
    }
    if (!engaged) return;

    const score = stanceScore(persona, question);

    if (question.type === 'poll') {
      row.responses[key] = { value: pollChoice(persona, question) };
      return;
    }

    let vote;
    if (question.type === 'rating') {
      const value = ratingValue(persona, question, score);
      row.responses[key] = { value };
      const { min, max } = question.scale;
      const mid = (min + max) / 2;
      vote = value >= mid + 1.5 ? 1 : value <= mid - 1.5 ? -1 : 0;
    } else {
      vote = triStateVote(score);
    }

    row.votes[key] = vote;
    row.nVotes += 1;
    if (vote === 1) {
      row.nAgree += 1;
      comments[questionIndex].agrees += 1;
    } else if (vote === -1) {
      row.nDisagree += 1;
      comments[questionIndex].disagrees += 1;
    }
  });
});

// --- cluster analysis, consensus, divisiveness -----------------------------

const voteRates = questions.map((question, questionIndex) => {
  const key = String(questionIndex);
  const perGroup = clusters.map(() => ({ agree: 0, total: 0 }));
  let agree = 0;
  let total = 0;
  participants.forEach((row) => {
    if (!(key in row.votes)) return;
    total += 1;
    perGroup[row.groupId].total += 1;
    if (row.votes[key] === 1) {
      agree += 1;
      perGroup[row.groupId].agree += 1;
    }
  });
  return {
    questionIndex,
    isBinary: question.type === 'binary',
    overallRate: total ? agree / total : 0,
    total,
    groupRates: perGroup.map((group) => (group.total ? group.agree / group.total : 0)),
  };
});

const round3 = (value) => Math.round(value * 1000) / 1000;

const clusterAnalysis = clusters.map((cluster) => {
  const distinctive = voteRates
    .filter((rate) => rate.isBinary && rate.total > 0)
    .map((rate) => ({
      ...rate,
      lift: rate.groupRates[cluster.id] - rate.overallRate,
    }))
    .sort((a, b) => b.lift - a.lift)
    .slice(0, 4);
  return {
    clusterLabel: cluster.label,
    participantCount: participants.filter((row) => row.groupId === cluster.id).length,
    characteristics: cluster.characteristics,
    topStatements: distinctive.map((rate) => ({
      questionIndex: rate.questionIndex,
      label: `#${rate.questionIndex + 1}`,
      commentId: comments[rate.questionIndex].commentId,
      prompt: comments[rate.questionIndex].commentBody,
      agreeRate: round3(rate.groupRates[cluster.id]),
    })),
  };
});

const groupRatesObject = (rate) => ({
  group1: round3(rate.groupRates[0]),
  group2: round3(rate.groupRates[1]),
  group3: round3(rate.groupRates[2]),
});

const spreadOf = (rate) => Math.max(...rate.groupRates) - Math.min(...rate.groupRates);

const consensusStatements = voteRates
  .filter((rate) => rate.isBinary && rate.overallRate >= 0.6 && spreadOf(rate) <= 0.45)
  .sort((a, b) => b.overallRate - a.overallRate)
  .slice(0, 6)
  .map((rate) => ({
    questionIndex: rate.questionIndex,
    prompt: comments[rate.questionIndex].commentBody,
    agreeRate: round3(rate.overallRate),
    groupRates: groupRatesObject(rate),
  }));

const divisiveStatements = voteRates
  .filter((rate) => rate.isBinary && spreadOf(rate) >= 0.45)
  .sort((a, b) => spreadOf(b) - spreadOf(a))
  .slice(0, 10)
  .map((rate) => ({
    questionIndex: rate.questionIndex,
    prompt: comments[rate.questionIndex].commentBody,
    spread: round3(spreadOf(rate)),
    groupRates: groupRatesObject(rate),
  }));

// --- output ----------------------------------------------------------------

const fixture = {
  session: questionSet.session,
  comments,
  participantsVotes: participants,
  clusterAnalysis,
  consensusStatements,
  divisiveStatements,
  clusterAnalysisVersion: 2,
};

const questionSeed = {
  session: fixture.session,
  comments: fixture.comments,
};

fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(fixture, null, 2)}\n`);
fs.writeFileSync(QUESTION_SEED_OUTPUT_PATH, `${JSON.stringify(questionSeed, null, 2)}\n`);

// --- summary ---------------------------------------------------------------

const voteCells = participants.reduce((sum, row) => sum + row.nVotes, 0);
const voteQuestions = questions.filter((q) => q.type === 'binary' || q.type === 'rating').length;
const agreeTotal = participants.reduce((sum, row) => sum + row.nAgree, 0);
const disagreeTotal = participants.reduce((sum, row) => sum + row.nDisagree, 0);
const typedResponses = participants.reduce((sum, row) => sum + Object.keys(row.responses).length, 0);
const groupSizes = clusters.map((cluster) => participants.filter((row) => row.groupId === cluster.id).length);

console.log(`demo-2 fixture written to ${path.relative(repoRoot, OUTPUT_PATH)}`);
console.log(`  compact question seed: ${path.relative(repoRoot, QUESTION_SEED_OUTPUT_PATH)}`);
console.log(`  questions: ${questions.length} (${questions.filter((q) => q.type === 'binary').length} binary, `
  + `${questions.filter((q) => q.type === 'poll').length} poll, `
  + `${questions.filter((q) => q.type === 'rating').length} rating, `
  + `${questions.filter((q) => q.type === 'freeform').length} freeform)`);
console.log(`  participants: ${participants.length}; cluster sizes: ${groupSizes.join('/')}`);
console.log(`  tri-state votes: ${voteCells}/${participants.length * voteQuestions} `
  + `(${Math.round((voteCells / (participants.length * voteQuestions)) * 100)}% coverage); `
  + `agree ${agreeTotal} / disagree ${disagreeTotal} / unsure ${voteCells - agreeTotal - disagreeTotal}`);
console.log(`  typed responses: ${typedResponses}; consensus ${consensusStatements.length}; divisive ${divisiveStatements.length}`);
