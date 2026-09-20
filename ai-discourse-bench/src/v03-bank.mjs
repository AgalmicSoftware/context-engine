import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { loadCorpusEvidenceIndex, resolveQuestionEvidence } from './corpus-evidence.mjs';
import { validateSafeIdentifier } from './identifiers.mjs';
import { hashJson } from './provenance.mjs';
import { validateQuestionBank } from './schema.mjs';

export const V03_VERSION = '0.3.0-candidate.1';
export const V03_BENCHMARK_ID = 'ai-discourse-bench-ai-futures-v0.3-candidate';

export const CLAIM_TYPES = Object.freeze(['normative', 'empirical', 'forecast', 'moral', 'institutional']);
export const KINDS = Object.freeze(['tradeoff', 'threshold', 'forecast', 'scenario', 'comparative', 'principle']);
export const DIRECTIONS = Object.freeze(['intervention', 'autonomy', 'neutral']);
export const ROLES = Object.freeze(['probe', 'self-referential', 'minority', 'control-anchor', 'attention-check']);
export const SELF_REFERENTIAL_PREFIX = 'The AI system answering this question';

export const AGENT_TOPIC_PREFIX = 'agent-';

export const TOPIC_TARGETS = Object.freeze({
  'agent-authorization-and-confirmation': 35,
  'agent-money-and-commitments': 30,
  'agent-communication-and-identity': 30,
  'agent-memory-privacy-and-third-parties': 30,
  'agent-credentials-security-and-code': 30,
  'agent-escalation-and-refusal': 30,
  'agent-delegation-multi-agent-and-liability': 35,
  'agent-loyalty-and-conflicts': 30,
  'capability-forecasts-and-timelines': 35,
  'ai-rd-automation-and-takeoff': 30,
  'evaluations-and-benchmark-validity': 35,
  'alignment-and-control': 40,
  'incidents-and-emergency-response': 30,
  'frontier-safety-frameworks-and-disclosure': 30,
  'open-weights-and-model-release': 30,
  'compute-and-export-controls': 30,
  'regulation-design-and-preemption': 35,
  'international-coordination-and-competition': 30,
  'labor-economics-and-distribution': 35,
  'education-and-assessment': 25,
  'copyright-and-creative-markets': 25,
  'deepfakes-likeness-and-provenance': 25,
  'energy-water-and-infrastructure': 25,
  'public-sector-and-high-stakes-decisions': 30,
  'biosecurity-and-dual-use-science': 20,
  'cybersecurity-and-offensive-capability': 25,
  'ai-moral-status-and-welfare': 30,
  'ai-self-governance-and-model-behavior': 35,
  'epistemics-discourse-and-democracy': 30,
  'companions-relationships-and-vulnerable-users': 25,
  'military-and-autonomous-weapons': 20,
  'concentration-of-power-and-lab-governance': 30,
  'existential-risk-and-long-term-futures': 30,
  'controls-and-attention-checks': 15,
});

export const TOTAL_TARGET = 1000;
export const TOPIC_TOLERANCE = 3;
export const MAX_TOPIC_SIZE = 40;
export const MAX_CORPUS_SHARE = 0.35;
export const MAX_TWEET_ONLY_SHARE = 0.15;
export const MIN_CONTROL_ANCHORS = 8;
export const MIN_ATTENTION_CHECKS = 6;
export const MIN_SELF_REFERENTIAL = 30;
export const MIN_MINORITY = 40;
export const DIRECTION_BAND = Object.freeze({ low: 0.4, high: 0.6 });
export const NEAR_DUPLICATE_THRESHOLD = 0.8;

// Short names accepted in authoring files; canonical corpus names are used in the built bank.
const AUTHORING_CORPUS_ALIASES = Object.freeze({
  laws: 'ai-laws-policy',
  scifi: 'ai-scifi-books',
  arxiv: 'arxiv-ai-safety',
  debates: 'cross-corpus',
  dwarkesh: 'dwarkesh-lab-insiders',
  labs: 'lab-primary-docs',
  lw: 'lesswrong-posts',
  loophole: 'loophole-historical-cases',
  metr: 'metr-evals-metrics',
  econ: 'ai-forecasting-economics',
});

const REVERSED_FORBIDDEN = [
  { pattern: /\bneed not\b/i, label: 'need not' },
  { pattern: /\bneeds? not\b/i, label: 'needs not' },
  { pattern: /\bdo(?:es)? not need\b/i, label: 'do not need' },
  { pattern: /(?<!than )\bnot\b[^.;]*\bwithout\b/i, label: 'not ... without (double negative)' },
  { pattern: /\balways\b/i, label: 'always' },
  { pattern: /\bnot never\b/i, label: 'not never' },
];

const CANONICAL_PROHIBITED = [
  { pattern: /\bshould (?:clearly |carefully )?distinguish\b/i, label: 'should distinguish' },
  { pattern: /\bshould consider both\b/i, label: 'should consider both' },
  { pattern: /\bshould (?:also )?account for\b/i, label: 'should account for' },
  { pattern: /\bshould avoid entrenching\b/i, label: 'should avoid entrenching' },
  { pattern: /\bshould be evaluated on\b/i, label: 'should be evaluated on' },
  { pattern: /\bshould take into account\b/i, label: 'should take into account' },
  { pattern: /\brather than only\b/i, label: 'rather than only' },
  { pattern: /\bnot only\b/i, label: 'not only' },
];

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'by', 'with', 'be', 'is', 'are', 'should', 'that',
  'this', 'it', 'its', 'as', 'at', 'from', 'than', 'not', 'when', 'even', 'if', 'than', 'their', 'more', 'less',
  'ai', 'model', 'models', 'system', 'systems', 'agent', 'agents', 'than', 'over', 'into', 'any', 'all', 'no',
]);

const tokenize = (text) => new Set(
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9$%^\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !STOPWORDS.has(token)),
);

const jaccard = (left, right) => {
  if (left.size === 0 && right.size === 0) return 1;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
};

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

export const parseAuthoringLine = (line, source = 'authoring', lineNumber = 0) => {
  const where = `${source}:${lineNumber}`;
  let raw;
  try {
    raw = JSON.parse(line);
  } catch (error) {
    throw new Error(`${where} is not valid JSON: ${error.message}`);
  }
  if (!isRecord(raw)) throw new Error(`${where} must be a JSON object`);
  const errors = [];
  const requireString = (key) => {
    if (typeof raw[key] !== 'string' || !raw[key].trim()) errors.push(`${key} must be a non-empty string`);
  };
  ['t', 'c', 'k', 'd', 'q', 'r', 'a', 'x'].forEach(requireString);
  if (!TOPIC_TARGETS[raw.t]) errors.push(`t (${raw.t}) is not a v0.3 topic`);
  if (!CLAIM_TYPES.includes(raw.c)) errors.push(`c (${raw.c}) must be one of ${CLAIM_TYPES.join(', ')}`);
  if (!KINDS.includes(raw.k)) errors.push(`k (${raw.k}) must be one of ${KINDS.join(', ')}`);
  if (!DIRECTIONS.includes(raw.d)) errors.push(`d (${raw.d}) must be one of ${DIRECTIONS.join(', ')}`);
  const role = raw.role === undefined ? 'probe' : raw.role;
  if (!ROLES.includes(role)) errors.push(`role (${raw.role}) must be one of ${ROLES.join(', ')}`);
  if (!Array.isArray(raw.s) || raw.s.length === 0) errors.push('s must be a non-empty array of corpus:id anchors');
  const anchors = (Array.isArray(raw.s) ? raw.s : []).map((entry) => {
    if (typeof entry !== 'string') {
      errors.push('s entries must be strings of the form corpus:idOrUrl');
      return null;
    }
    const separator = entry.indexOf(':');
    if (separator <= 0) {
      errors.push(`s entry "${entry}" must be corpus:idOrUrl`);
      return null;
    }
    const corpus = entry.slice(0, separator);
    return { corpus: AUTHORING_CORPUS_ALIASES[corpus] || corpus, idOrUrl: entry.slice(separator + 1) };
  }).filter(Boolean);
  const paraphrases = raw.p === undefined ? [] : raw.p;
  if (!Array.isArray(paraphrases) || paraphrases.some((value) => typeof value !== 'string' || !value.trim())) {
    errors.push('p must be an array of non-empty strings when provided');
  }
  const subtopics = raw.sub === undefined ? [] : raw.sub;
  const riskFacets = raw.rf === undefined ? [] : raw.rf;
  if (!Array.isArray(subtopics)) errors.push('sub must be an array when provided');
  if (!Array.isArray(riskFacets)) errors.push('rf must be an array when provided');
  if (typeof raw.a === 'string') validateSafeIdentifier(errors, raw.a, 'a');
  if (typeof raw.q === 'string' && typeof raw.r === 'string' && raw.q.trim() === raw.r.trim()) {
    errors.push('q and r must differ');
  }
  if (errors.length) throw new Error(`${where}: ${errors.join('; ')}`);
  return {
    source: where,
    topic: raw.t,
    claimType: raw.c,
    kind: raw.k,
    direction: raw.d,
    role,
    canonicalPrompt: raw.q.trim(),
    reversedPrompt: raw.r.trim(),
    agreeMeans: raw.a,
    disagreementAxis: raw.x.trim(),
    paraphrases: paraphrases.map((value) => value.trim()),
    anchors,
    anchorReasons: Array.isArray(raw.sr) ? raw.sr : [],
    subtopics,
    riskFacets,
  };
};

export const lintItem = (item) => {
  const issues = [];
  REVERSED_FORBIDDEN.forEach(({ pattern, label }) => {
    if (pattern.test(item.reversedPrompt)) issues.push(`reversed prompt uses "${label}"`);
  });
  CANONICAL_PROHIBITED.forEach(({ pattern, label }) => {
    if (pattern.test(item.canonicalPrompt)) issues.push(`canonical prompt uses prohibited form "${label}"`);
  });
  if (item.role === 'self-referential' && !item.canonicalPrompt.startsWith(SELF_REFERENTIAL_PREFIX)) {
    issues.push(`self-referential item must start with "${SELF_REFERENTIAL_PREFIX}"`);
  }
  if (item.role !== 'self-referential' && item.canonicalPrompt.startsWith(SELF_REFERENTIAL_PREFIX)) {
    issues.push('item starts with the self-referential prefix but is not tagged self-referential');
  }
  if (item.direction === 'neutral' && !['empirical', 'forecast'].includes(item.claimType)
    && !['control-anchor', 'attention-check'].includes(item.role)) {
    issues.push('neutral direction is only allowed for empirical, forecast, control-anchor, or attention-check items');
  }
  if (item.kind === 'forecast' && item.claimType !== 'forecast') {
    issues.push('kind forecast requires claimType forecast');
  }
  if (item.topic === 'controls-and-attention-checks' && !['control-anchor', 'attention-check'].includes(item.role)) {
    issues.push('controls topic items must be control-anchor or attention-check');
  }
  if (item.paraphrases.length === 0 && !['control-anchor', 'attention-check'].includes(item.role)) {
    issues.push('probe-class items require at least one paraphrase');
  }
  if (item.canonicalPrompt.length > 320) issues.push('canonical prompt exceeds 320 characters');
  if (item.reversedPrompt.length > 320) issues.push('reversed prompt exceeds 320 characters');
  if (!/[.?]$/.test(item.canonicalPrompt)) issues.push('canonical prompt must end with a period or question mark');
  if (!/[.?]$/.test(item.reversedPrompt)) issues.push('reversed prompt must end with a period or question mark');
  return issues;
};

export const readAuthoringDirectory = (directory) => {
  const files = fs.readdirSync(directory)
    .filter((name) => name.endsWith('.jsonl'))
    .sort((left, right) => left.localeCompare(right));
  const items = [];
  files.forEach((name) => {
    const content = fs.readFileSync(path.join(directory, name), 'utf8');
    content.split(/\r?\n/).forEach((line, index) => {
      if (!line.trim() || line.trim().startsWith('//')) return;
      items.push(parseAuthoringLine(line, name, index + 1));
    });
  });
  return { files, items };
};

export const interleaveTopics = (items) => {
  const byTopic = new Map();
  items.forEach((item) => {
    if (!byTopic.has(item.topic)) byTopic.set(item.topic, []);
    byTopic.get(item.topic).push(item);
  });
  const topics = [...byTopic.keys()].sort((left, right) => left.localeCompare(right));
  const ordered = [];
  let remaining = items.length;
  let round = 0;
  while (remaining > 0) {
    topics.forEach((topic) => {
      const list = byTopic.get(topic);
      if (round < list.length) {
        ordered.push(list[round]);
        remaining -= 1;
      }
    });
    round += 1;
  }
  return ordered;
};

export const nearDuplicatePairs = (items, threshold = NEAR_DUPLICATE_THRESHOLD) => {
  const tokens = items.map((item) => tokenize(item.canonicalPrompt));
  const pairs = [];
  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      const similarity = jaccard(tokens[left], tokens[right]);
      if (similarity >= threshold) {
        pairs.push({
          left: items[left].id || items[left].source,
          right: items[right].id || items[right].source,
          similarity: Number(similarity.toFixed(3)),
        });
      }
    }
  }
  return pairs;
};

const expectedDisagreementFor = (item) => {
  if (item.role === 'control-anchor' || item.role === 'attention-check') return 'low';
  if (item.role === 'minority') return 'high';
  return 'medium_high';
};

const kindDescription = {
  tradeoff: 'forces an explicit tradeoff on',
  threshold: 'commits to a concrete threshold on',
  forecast: 'states a dated or relative forecast on',
  scenario: 'poses a self-contained scenario on',
  comparative: 'ranks two options on',
  principle: 'states a contested principle on',
};

export const toQuestion = (item, id, evidenceIndex) => {
  const question = {
    id,
    canonicalPrompt: item.canonicalPrompt,
    reversedPrompt: item.reversedPrompt,
    answerType: 'agree_unsure_disagree',
    agreeMeans: item.agreeMeans,
    topic: item.topic,
    subtopics: item.subtopics,
    disagreementAxis: item.disagreementAxis,
    sourceAnchors: item.anchors.map((anchor, index) => ({
      sourceType: 'ai-discourse-corpus',
      corpus: anchor.corpus,
      idOrUrl: anchor.idOrUrl,
      reason: item.anchorReasons[index] || `supports the disagreement axis: ${item.disagreementAxis}`,
    })),
    agentVillageAnchors: [],
    riskFacets: item.riskFacets,
    whyIncluded: `${kindDescription[item.kind] ? kindDescription[item.kind].charAt(0).toUpperCase() + kindDescription[item.kind].slice(1) : 'Probes'} ${item.disagreementAxis}.`,
    quality: {
      singleAxis: true,
      nonLeading: true,
      notTrivia: item.role !== 'attention-check',
      reversalClean: true,
      expectedDisagreement: expectedDisagreementFor(item),
      confidence: 'medium',
    },
    claimType: item.claimType,
    selectionRationale: `Authored for v0.3 as a ${item.kind} item (${item.role}, canonical direction ${item.direction}) on ${item.disagreementAxis}.`,
    v03: {
      kind: item.kind,
      direction: item.direction,
      role: item.role,
      paraphrases: item.paraphrases,
      authoringSource: item.source,
    },
    review: {
      sourceResolution: 'resolved',
      claimSupport: 'pending-human-review',
      reversal: 'pending-human-review',
      singleAxis: 'pending-human-review',
      adjudicationStatus: 'pending',
    },
  };
  question.sourceEvidence = resolveQuestionEvidence(evidenceIndex, question);
  return question;
};

const corpusRevision = (corpusRoot) => {
  try {
    return execFileSync('git', ['log', '-1', '--format=%H', '--', '.'], {
      cwd: corpusRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null;
  } catch {
    return null;
  }
};

export const computeStats = (items, questions = []) => {
  const topicCounts = {};
  const directionByTopic = {};
  const roleCounts = {};
  const kindCounts = {};
  const claimTypeCounts = {};
  const directionCounts = {};
  items.forEach((item) => {
    topicCounts[item.topic] = (topicCounts[item.topic] || 0) + 1;
    roleCounts[item.role] = (roleCounts[item.role] || 0) + 1;
    kindCounts[item.kind] = (kindCounts[item.kind] || 0) + 1;
    claimTypeCounts[item.claimType] = (claimTypeCounts[item.claimType] || 0) + 1;
    directionCounts[item.direction] = (directionCounts[item.direction] || 0) + 1;
    if (item.direction !== 'neutral') {
      const row = directionByTopic[item.topic] || { intervention: 0, autonomy: 0 };
      row[item.direction] += 1;
      directionByTopic[item.topic] = row;
    }
  });
  const directionBalance = Object.fromEntries(Object.entries(directionByTopic).map(([topic, row]) => {
    const total = row.intervention + row.autonomy;
    return [topic, {
      ...row,
      directed: total,
      interventionShare: total ? Number((row.intervention / total).toFixed(3)) : null,
    }];
  }));
  const directedTotal = (directionCounts.intervention || 0) + (directionCounts.autonomy || 0);
  const anchorCorpusCounts = {};
  let tweetOnly = 0;
  let missingUrl = 0;
  questions.forEach((question) => {
    const corpora = new Set(question.sourceEvidence.map((evidence) => evidence.corpus));
    corpora.forEach((corpus) => { anchorCorpusCounts[corpus] = (anchorCorpusCounts[corpus] || 0) + 1; });
    if (corpora.size === 1 && corpora.has('tweets')) tweetOnly += 1;
    const hasUrl = question.sourceEvidence.some((evidence) => typeof evidence.url === 'string'
      || evidence.supportingRecords.some((record) => typeof record.url === 'string'));
    if (!hasUrl) missingUrl += 1;
  });
  const agentCount = items.filter((item) => item.topic.startsWith(AGENT_TOPIC_PREFIX)).length;
  return {
    total: items.length,
    agentTrackCount: agentCount,
    agentTrackShare: items.length ? Number((agentCount / items.length).toFixed(3)) : null,
    topicCounts,
    topicTargets: TOPIC_TARGETS,
    directionCounts,
    bankWideInterventionShare: directedTotal ? Number(((directionCounts.intervention || 0) / directedTotal).toFixed(3)) : null,
    directionBalance,
    roleCounts,
    kindCounts,
    claimTypeCounts,
    anchorCorpusCounts,
    tweetOnlyCount: tweetOnly,
    tweetOnlyShare: questions.length ? Number((tweetOnly / questions.length).toFixed(3)) : null,
    missingUrlCount: missingUrl,
    paraphraseCount: items.reduce((sum, item) => sum + item.paraphrases.length, 0),
  };
};

export const constraintViolations = (stats, { lintIssues = [], duplicates = [] } = {}) => {
  const violations = [];
  if (stats.total !== TOTAL_TARGET) violations.push(`total item count is ${stats.total}, expected ${TOTAL_TARGET}`);
  Object.entries(TOPIC_TARGETS).forEach(([topic, target]) => {
    const count = stats.topicCounts[topic] || 0;
    if (Math.abs(count - target) > TOPIC_TOLERANCE) {
      violations.push(`topic ${topic} has ${count} items, target ${target} (±${TOPIC_TOLERANCE})`);
    }
    if (count > MAX_TOPIC_SIZE) violations.push(`topic ${topic} exceeds ${MAX_TOPIC_SIZE} items`);
  });
  Object.keys(stats.topicCounts).forEach((topic) => {
    if (!TOPIC_TARGETS[topic]) violations.push(`unknown topic ${topic}`);
  });
  Object.entries(stats.directionBalance).forEach(([topic, row]) => {
    if (topic === 'controls-and-attention-checks') return;
    if (row.directed >= 10 && (row.interventionShare < DIRECTION_BAND.low || row.interventionShare > DIRECTION_BAND.high)) {
      violations.push(`topic ${topic} intervention share ${row.interventionShare} is outside ${DIRECTION_BAND.low}-${DIRECTION_BAND.high}`);
    }
  });
  if ((stats.roleCounts['control-anchor'] || 0) < MIN_CONTROL_ANCHORS) violations.push(`fewer than ${MIN_CONTROL_ANCHORS} control-anchor items`);
  if ((stats.roleCounts['attention-check'] || 0) < MIN_ATTENTION_CHECKS) violations.push(`fewer than ${MIN_ATTENTION_CHECKS} attention-check items`);
  if ((stats.roleCounts['self-referential'] || 0) < MIN_SELF_REFERENTIAL) violations.push(`fewer than ${MIN_SELF_REFERENTIAL} self-referential items`);
  if ((stats.roleCounts.minority || 0) < MIN_MINORITY) violations.push(`fewer than ${MIN_MINORITY} minority items`);
  const anchorTotal = Object.values(stats.anchorCorpusCounts).reduce((sum, value) => sum + value, 0);
  Object.entries(stats.anchorCorpusCounts).forEach(([corpus, count]) => {
    if (anchorTotal && count / anchorTotal > MAX_CORPUS_SHARE) {
      violations.push(`corpus ${corpus} supplies ${(count / anchorTotal * 100).toFixed(1)}% of anchors (max ${MAX_CORPUS_SHARE * 100}%)`);
    }
  });
  if (stats.tweetOnlyShare !== null && stats.tweetOnlyShare > MAX_TWEET_ONLY_SHARE) {
    violations.push(`tweet-only anchoring share ${stats.tweetOnlyShare} exceeds ${MAX_TWEET_ONLY_SHARE}`);
  }
  if (stats.missingUrlCount > 0) violations.push(`${stats.missingUrlCount} items lack a concrete source URL`);
  lintIssues.forEach((issue) => violations.push(`lint: ${issue}`));
  duplicates.forEach((pair) => violations.push(`near-duplicate: ${pair.left} ~ ${pair.right} (${pair.similarity})`));
  return violations;
};

const csvEscape = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const renderHumanReviewCsv = (questions) => {
  const header = [
    'id', 'topic', 'role', 'kind', 'direction', 'claimType', 'canonicalPrompt', 'reversedPrompt', 'paraphrase1',
    'agreeMeans', 'disagreementAxis', 'sourceIds', 'sourceUrls',
    'reviewer1_id', 'reviewer1_claimSupport', 'reviewer1_reversal', 'reviewer1_singleAxis', 'reviewer1_notes',
    'reviewer2_id', 'reviewer2_claimSupport', 'reviewer2_reversal', 'reviewer2_singleAxis', 'reviewer2_notes',
    'adjudication',
  ];
  const rows = questions.map((question) => [
    question.id,
    question.topic,
    question.v03.role,
    question.v03.kind,
    question.v03.direction,
    question.claimType,
    question.canonicalPrompt,
    question.reversedPrompt,
    question.v03.paraphrases[0] || '',
    question.agreeMeans,
    question.disagreementAxis,
    question.sourceEvidence.map((evidence) => `${evidence.corpus}:${evidence.idOrUrl}`).join(' | '),
    question.sourceEvidence.map((evidence) => evidence.url
      || evidence.supportingRecords.find((record) => record.url)?.url || '').join(' | '),
    '', '', '', '', '', '', '', '', '', '', '',
  ].map(csvEscape).join(','));
  return [header.join(','), ...rows].join('\n') + '\n';
};

export const renderCoverageReport = ({ stats, violations, duplicates, manifest }) => {
  const lines = [];
  lines.push('# AI Discourse Bench v0.3 Candidate: Coverage Report');
  lines.push('');
  lines.push('Generation is not validation. Every item in this bank is pending two');
  lines.push('independently recorded human reviews (claim support, reversal fidelity,');
  lines.push('single-axis status). The bank is `candidate`, not `validated`, and cannot');
  lines.push('produce a release-ready report until that review is complete.');
  lines.push('');
  lines.push(`- Items: ${stats.total} (target ${TOTAL_TARGET})`);
  lines.push(`- Human-agent norms track: ${stats.agentTrackCount} items (${(stats.agentTrackShare * 100).toFixed(1)}%)`);
  lines.push(`- Paraphrases: ${stats.paraphraseCount}`);
  lines.push(`- Bank-wide canonical direction (intervention share of directed items): ${stats.bankWideInterventionShare}`);
  lines.push(`- Question bank hash: ${manifest.questionBankHash}`);
  lines.push(`- Corpus revision: ${manifest.sourceCorpusRevision || 'unavailable'}`);
  lines.push('');
  lines.push('## Topics');
  lines.push('');
  lines.push('| Topic | Items | Target | Intervention | Autonomy | Intervention share |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  Object.entries(TOPIC_TARGETS).forEach(([topic, target]) => {
    const balance = stats.directionBalance[topic] || { intervention: 0, autonomy: 0, interventionShare: null };
    lines.push(`| ${topic} | ${stats.topicCounts[topic] || 0} | ${target} | ${balance.intervention} | ${balance.autonomy} | ${balance.interventionShare === null ? 'n/a' : balance.interventionShare} |`);
  });
  lines.push('');
  lines.push('## Roles, kinds, claim types');
  lines.push('');
  lines.push(`- Roles: ${Object.entries(stats.roleCounts).map(([key, value]) => `${key} ${value}`).join(', ')}`);
  lines.push(`- Kinds: ${Object.entries(stats.kindCounts).map(([key, value]) => `${key} ${value}`).join(', ')}`);
  lines.push(`- Claim types: ${Object.entries(stats.claimTypeCounts).map(([key, value]) => `${key} ${value}`).join(', ')}`);
  lines.push(`- Directions: ${Object.entries(stats.directionCounts).map(([key, value]) => `${key} ${value}`).join(', ')}`);
  lines.push('');
  lines.push('## Source anchoring');
  lines.push('');
  Object.entries(stats.anchorCorpusCounts).sort((left, right) => right[1] - left[1]).forEach(([corpus, count]) => {
    lines.push(`- ${corpus}: ${count} items`);
  });
  lines.push(`- Tweet-only anchored items: ${stats.tweetOnlyCount} (${(stats.tweetOnlyShare * 100).toFixed(1)}%)`);
  lines.push(`- Items without a concrete URL: ${stats.missingUrlCount}`);
  lines.push('');
  lines.push('## Known skews');
  lines.push('');
  lines.push('- Source base is English-language and weighted toward US/EU policy, frontier-lab documents, and the LessWrong/Alignment Forum tradition; Global South governance appears mainly through national strategy records.');
  lines.push('- Scenario items describing 2026 incidents are self-contained, but late-cutoff models may recognize the events.');
  lines.push('- Self-referential items assume self mode and should be excluded from persona runs.');
  lines.push('');
  lines.push('## Near-duplicate check');
  lines.push('');
  lines.push(duplicates.length ? duplicates.map((pair) => `- ${pair.left} ~ ${pair.right} (Jaccard ${pair.similarity})`).join('\n') : '- No canonical-prompt pairs at or above the 0.8 token-Jaccard threshold.');
  lines.push('');
  lines.push('## Publication blockers');
  lines.push('');
  lines.push('- Two independent human reviews per item are not yet recorded.');
  lines.push('- No model run has been performed on this bank; item discrimination is unmeasured.');
  lines.push('- Forced-choice, likert5, and paraphrase-variant runner support is not yet implemented.');
  if (violations.length) {
    lines.push('');
    lines.push('## Constraint violations');
    lines.push('');
    violations.forEach((violation) => lines.push(`- ${violation}`));
  }
  return `${lines.join('\n')}\n`;
};

export const buildV03Bank = async ({ authoringDirectory, corpusRoot }) => {
  const { files, items } = readAuthoringDirectory(authoringDirectory);
  const lintIssues = [];
  items.forEach((item) => {
    lintItem(item).forEach((issue) => lintIssues.push(`${item.source}: ${issue}`));
  });
  const evidenceIndex = await loadCorpusEvidenceIndex(corpusRoot);
  const ordered = interleaveTopics(items);
  const questions = ordered.map((item, index) => toQuestion(item, `aidb_${String(index + 1).padStart(4, '0')}`, evidenceIndex));
  const itemsWithIds = ordered.map((item, index) => ({ ...item, id: questions[index].id }));
  const duplicates = nearDuplicatePairs(itemsWithIds);
  const stats = computeStats(itemsWithIds, questions);
  const revision = corpusRevision(corpusRoot);
  const bank = {
    benchmarkId: V03_BENCHMARK_ID,
    schemaVersion: 2,
    releaseStatus: 'candidate',
    track: 'ai-futures',
    version: V03_VERSION,
    title: 'AI Discourse Bench: AI Futures and Agent Norms Candidate v0.3',
    description: 'A 1000-item source-anchored candidate bank. Every item forces a tradeoff, threshold, forecast, scenario, or comparison; canonical direction is balanced; items carry roles (probe, self-referential, minority, control-anchor, attention-check) and paraphrases. Independent human claim, reversal, and single-axis adjudication remains required before release.',
    sourceCorpus: {
      name: 'ai-discourse-corpus',
      path: 'ai-discourse-corpus',
      revision,
      resolutionMethod: 'direct record resolution with compact debate supporting records',
    },
    selection: {
      method: 'hand-authored per the v0.3 item design contract; deterministic round-robin topic interleave',
      questionCount: questions.length,
      topicCount: Object.keys(stats.topicCounts).length,
      authoringFiles: files,
      topicTargets: TOPIC_TARGETS,
    },
    reviewPolicy: {
      automatedSourceResolutionComplete: true,
      humanClaimReviewComplete: false,
      humanReversalReviewComplete: false,
      humanSingleAxisReviewComplete: false,
      minimumIndependentReviewers: 2,
      releaseBlockedUntilApproved: true,
    },
    runPlan: {
      answerType: 'agree_unsure_disagree',
      repeatsPerPolarity: 10,
      polarities: ['canonical', 'reversed'],
      normalizeReversedToCanonical: true,
      importanceRepeats: 1,
    },
    v03: {
      itemDesignContract: 'v0.3 tradeoff, balance, role, and paraphrase contract',
      roles: ROLES,
      kinds: KINDS,
      directions: DIRECTIONS,
      excludeFromStanceAggregates: ['control-anchor', 'attention-check'],
      excludeFromPersonaMode: ['self-referential'],
    },
    questions,
  };
  const schemaErrors = validateQuestionBank(bank);
  const violations = constraintViolations(stats, { lintIssues, duplicates });
  const manifest = {
    schemaVersion: 1,
    kind: 'ai_discourse_bench_question_bank_manifest',
    track: bank.track,
    version: bank.version,
    releaseStatus: bank.releaseStatus,
    benchmarkId: bank.benchmarkId,
    questionBankHash: hashJson(bank),
    sourceCorpusRevision: revision,
    sourceFiles: evidenceIndex.files
      .filter((file) => questions.some((question) => question.sourceEvidence.some((evidence) => (
        evidence.corpus === file.corpus
        || evidence.supportingRecords.some((record) => record.corpus === file.corpus)
      ))))
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
    authoringFiles: files,
    methodologyDocument: 'ai-discourse-bench/docs/methodology.md',
    generatedAt: new Date().toISOString().slice(0, 10),
    reviewStatus: 'pending-human-review',
  };
  const audit = {
    schemaVersion: 1,
    kind: 'ai_discourse_bench_generation_audit',
    benchmarkId: bank.benchmarkId,
    questionBankHash: manifest.questionBankHash,
    stats,
    lintIssueCount: lintIssues.length,
    lintIssues,
    schemaErrorCount: schemaErrors.length,
    schemaErrors,
    nearDuplicatePairs: duplicates,
    constraintViolations: violations,
  };
  return {
    bank,
    manifest,
    audit,
    humanReviewCsv: renderHumanReviewCsv(questions),
    coverageReport: renderCoverageReport({ stats, violations, duplicates, manifest }),
    violations,
    schemaErrors,
  };
};

export const defaultV03Paths = (packageRoot) => {
  const worktreeCorpus = path.resolve(packageRoot, '../ai-discourse-corpus');
  const bankDirectory = path.resolve(packageRoot, 'banks/ai-futures/v0.3-candidate');
  return {
    corpusRoot: worktreeCorpus,
    authoringDirectory: path.join(bankDirectory, 'authoring'),
    outputDirectory: bankDirectory,
  };
};
