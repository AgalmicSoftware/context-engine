'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const CORPUS_DIR = path.join(ROOT_DIR, 'ai-discourse-corpus', 'corpuses');
const CLIENT_DEBATES_PATH = path.join(ROOT_DIR, 'client', 'src', 'variables', 'demo', 'debates.json');

const CORPUS_FILES = Object.freeze({
  'ai-laws-policy': {
    corpusKey: 'ai-laws-policy',
    aliases: ['ai-laws-policy', 'ai_laws_policy', 'laws', 'ai-laws', 'ai_laws'],
    relativePath: 'ai-discourse-corpus/corpuses/ai-laws-policy-corpus.json',
    collectionKey: 'entries',
    metaCountKeys: ['total_entries'],
  },
  'ai-scifi-books': {
    corpusKey: 'ai-scifi-books',
    aliases: ['ai-scifi-books', 'ai_scifi_books', 'ai_scifi', 'ai-scifi', 'scifi'],
    relativePath: 'ai-discourse-corpus/corpuses/ai-scifi-books-corpus.json',
    collectionKey: 'entries',
    metaCountKeys: ['total_entries'],
  },
  'arxiv-ai-safety': {
    corpusKey: 'arxiv-ai-safety',
    aliases: ['arxiv-ai-safety', 'arxiv_ai_safety', 'arxiv'],
    relativePath: 'ai-discourse-corpus/corpuses/arxiv-ai-safety-corpus.json',
    collectionKey: 'entries',
    metaCountKeys: ['total_entries'],
  },
  'cross-corpus': {
    corpusKey: 'cross-corpus',
    aliases: ['cross-corpus', 'cross_corpus', 'debates'],
    relativePath: 'ai-discourse-corpus/corpuses/cross-corpus-debates.json',
    collectionKey: 'debates',
    metaCountKeys: ['total_debates'],
  },
  'dwarkesh-lab-insiders': {
    corpusKey: 'dwarkesh-lab-insiders',
    aliases: ['dwarkesh-lab-insiders', 'dwarkesh_lab_insiders', 'dwarkesh', 'interviews'],
    relativePath: 'ai-discourse-corpus/corpuses/dwarkesh-lab-insiders-corpus.json',
    collectionKey: 'entries',
    metaCountKeys: ['entry_count'],
  },
  tweets: {
    corpusKey: 'tweets',
    aliases: ['tweets', 'enriched-tweets', 'enriched_tweets'],
    relativePath: 'ai-discourse-corpus/corpuses/enriched-tweets.json',
    collectionKey: null,
    metaCountKeys: [],
  },
  'lab-primary-docs': {
    corpusKey: 'lab-primary-docs',
    aliases: ['lab-primary-docs', 'lab_primary_docs', 'lab-docs', 'labs'],
    relativePath: 'ai-discourse-corpus/corpuses/lab-primary-docs-corpus.json',
    collectionKey: 'entries',
    metaCountKeys: ['entry_count'],
  },
  'lesswrong-posts': {
    corpusKey: 'lesswrong-posts',
    aliases: ['lesswrong-posts', 'lesswrong_posts', 'lesswrong', 'lw'],
    relativePath: 'ai-discourse-corpus/corpuses/lesswrong-posts-corpus.json',
    collectionKey: 'entries',
    metaCountKeys: ['entry_count'],
  },
  'loophole-historical-cases': {
    corpusKey: 'loophole-historical-cases',
    aliases: ['loophole-historical-cases', 'loophole_historical_cases', 'loophole'],
    relativePath: 'ai-discourse-corpus/corpuses/loophole-historical-cases.json',
    collectionKey: null,
    metaCountKeys: [],
  },
  'metr-evals-metrics': {
    corpusKey: 'metr-evals-metrics',
    aliases: ['metr-evals-metrics', 'metr_evals_metrics', 'metr'],
    relativePath: 'ai-discourse-corpus/corpuses/metr-evals-metrics-corpus.json',
    collectionKey: 'entries',
    metaCountKeys: ['entry_count'],
  },
});

const TARGET_DEBATE_IDS = Object.freeze([
  'debate_exponential_progress',
  'debate_reward_hacking_misalignment',
  'debate_predeployment_eval_adequacy',
  'debate_ai_rd_automation',
  'debate_open_vs_closed_safety',
  'debate_benchmark_validity',
  'debate_regulation_speed',
  'debate_deceptive_alignment',
  'debate_ai_water_usage',
  'debate_ai_labor_automation',
  'debate_ai_education_integrity',
  'debate_ai_copyright_training',
  'debate_multimodal_deepfake_governance',
  'debate_government_prerelease_access',
  'debate_alignment_tractability_2026',
  'debate_ai_labor_displacement_timeline',
]);

const VALID_PRIMARY_URL_RE = /^https?:\/\//i;
const DATE_RANGE_RE = /^\d{4}-\d{4}$/;

// Canonical vocabularies for taxonomy fields that previously drifted across
// ingestion batches (mixed casing / snake_case variants). `validate` flags any
// value outside these sets so new batches cannot re-introduce drift.
const TAXONOMY_ENUMS = Object.freeze({
  'arxiv-ai-safety': Object.freeze({
    category: Object.freeze([
      'Alignment Theory',
      'Capabilities',
      'Evaluations',
      'Fairness',
      'Forecasting',
      'Framework',
      'Governance',
      'Interpretability',
      'Policy',
      'Robustness',
      'Survey',
      'Technical Safety',
    ]),
  }),
  'lesswrong-posts': Object.freeze({
    platform: Object.freeze([
      'AI Alignment Blog',
      'AI Impacts',
      'ARC Evals',
      'Alignment Forum',
      'Anthropic',
      'Astral Codex Ten',
      'Bounded Regret',
      'Cold Takes',
      'EA Forum',
      'Epoch AI',
      'Google DeepMind',
      'Gwern',
      'LessWrong',
      'MIRI',
      'Managing AI Risks',
      'OpenAI',
      'Personal Blog',
      'Sideways View',
      'Slate Star Codex',
      'Substack',
      'TIME Magazine',
      'arXiv',
    ]),
  }),
  'lab-primary-docs': Object.freeze({
    lab: Object.freeze([
      'Amazon',
      'Anthropic',
      'Frontier Model Forum',
      'Google DeepMind',
      'Meta',
      'Microsoft',
      'OpenAI',
      'xAI',
    ]),
    doc_type: Object.freeze([
      'deployment_update',
      'framework_report',
      'model_spec',
      'policy_statement',
      'safety_framework',
      'safety_publication',
      'system_card',
      'transparency_report',
    ]),
  }),
  'dwarkesh-lab-insiders': Object.freeze({
    role_category: Object.freeze([
      'capabilities_researcher',
      'former_insider',
      'governance_expert',
      'independent_researcher',
      'investor_strategist',
      'lab_leader',
      'lab_researcher',
      'policy_advisor',
      'researcher',
      'safety_researcher',
    ]),
  }),
});

function readJson(absolutePath) {
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function getEntries(data, config) {
  if (Array.isArray(data)) {
    return data;
  }
  if (config.collectionKey && Array.isArray(data?.[config.collectionKey])) {
    return data[config.collectionKey];
  }
  return [];
}

function getEntryIdentifier(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  return entry.id || entry.url || null;
}

function getEntryLookupKeys(entry) {
  if (!entry || typeof entry !== 'object') {
    return [];
  }
  const keys = new Set();
  [entry.id, entry.url].forEach((value) => {
    if (typeof value === 'string' && value) {
      keys.add(value);
    }
  });
  return [...keys];
}

function createCorpusAliasMap() {
  const aliasMap = new Map();
  Object.values(CORPUS_FILES).forEach((config) => {
    config.aliases.forEach((alias) => {
      aliasMap.set(alias, config.corpusKey);
    });
  });
  return aliasMap;
}

function normalizeCorpusKey(corpusKey, aliasMap = createCorpusAliasMap()) {
  if (!corpusKey || typeof corpusKey !== 'string') {
    return null;
  }
  return aliasMap.get(corpusKey) || aliasMap.get(corpusKey.replaceAll('_', '-')) || corpusKey;
}

function loadCorpusFiles(rootDir = ROOT_DIR) {
  return Object.values(CORPUS_FILES).map((config) => {
    const absolutePath = path.join(rootDir, config.relativePath);
    const data = readJson(absolutePath);
    const entries = getEntries(data, config);
    return {
      ...config,
      absolutePath,
      data,
      entries,
      sizeBytes: fs.statSync(absolutePath).size,
    };
  });
}

function buildRecordIndex(corpusFiles = loadCorpusFiles()) {
  const aliasMap = createCorpusAliasMap();
  const byCorpusAndId = new Map();
  const duplicateIds = [];
  const seenGlobalIds = new Map();

  corpusFiles.forEach((file) => {
    file.entries.forEach((entry) => {
      const id = getEntryIdentifier(entry);
      if (!id) {
        return;
      }
      // Index every lookup key (id and url) so debate references can resolve
      // records by either form; duplicate detection stays on the primary id.
      getEntryLookupKeys(entry).forEach((lookupKey) => {
        byCorpusAndId.set(`${file.corpusKey}:${lookupKey}`, { file, entry });
      });
      if (seenGlobalIds.has(id)) {
        duplicateIds.push({
          id,
          firstCorpus: seenGlobalIds.get(id),
          secondCorpus: file.corpusKey,
        });
      } else {
        seenGlobalIds.set(id, file.corpusKey);
      }
    });
  });

  return {
    aliasMap,
    byCorpusAndId,
    duplicateIds,
  };
}

function collectSummary(rootDir = ROOT_DIR) {
  const corpusFiles = loadCorpusFiles(rootDir);
  const clientDebates = readJson(path.join(rootDir, path.relative(ROOT_DIR, CLIENT_DEBATES_PATH)));

  return {
    corpuses: corpusFiles.map((file) => ({
      corpus: file.corpusKey,
      path: file.relativePath,
      count: file.entries.length,
      sizeBytes: file.sizeBytes,
      metaCounts: Object.fromEntries(
        file.metaCountKeys
          .filter((key) => Object.prototype.hasOwnProperty.call(file.data?.meta || {}, key))
          .map((key) => [key, file.data.meta[key]])
      ),
    })),
    clientDebates: {
      path: path.relative(rootDir, CLIENT_DEBATES_PATH),
      count: Array.isArray(clientDebates) ? clientDebates.length : 0,
    },
  };
}

function hasRecord(index, corpusKey, id) {
  const normalizedCorpusKey = normalizeCorpusKey(corpusKey, index.aliasMap);
  return index.byCorpusAndId.has(`${normalizedCorpusKey}:${id}`);
}

function collectDebateReferenceIssues(crossCorpusFile, index, debateIds = null) {
  const debateIdSet = debateIds ? new Set(debateIds) : null;
  const missing = [];
  const duplicatePositions = [];

  crossCorpusFile.entries.forEach((debate) => {
    if (debateIdSet && !debateIdSet.has(debate.id)) {
      return;
    }

    const seenPositionKeys = new Set();
    (debate.positions || []).forEach((position, positionIndex) => {
      const id = position.entry_url_or_id;
      const corpus = position.corpus;
      const positionKey = `${corpus}:${id}`;
      if (seenPositionKeys.has(positionKey)) {
        duplicatePositions.push({ debateId: debate.id, positionIndex, corpus, id });
      }
      seenPositionKeys.add(positionKey);
      if (id && corpus && !hasRecord(index, corpus, id)) {
        missing.push({ debateId: debate.id, field: 'positions.entry_url_or_id', corpus, id });
      }
    });

    (debate.cross_corpus_references || []).forEach((reference, referenceIndex) => {
      [
        ['from', reference.from_corpus, reference.from_id],
        ['to', reference.to_corpus, reference.to_id],
      ].forEach(([side, corpus, id]) => {
        if (id && corpus && !hasRecord(index, corpus, id)) {
          missing.push({
            debateId: debate.id,
            field: `cross_corpus_references[${referenceIndex}].${side}_id`,
            corpus,
            id,
          });
        }
      });
    });
  });

  return { missing, duplicatePositions };
}

function collectValidation(rootDir = ROOT_DIR) {
  const corpusFiles = loadCorpusFiles(rootDir);
  const index = buildRecordIndex(corpusFiles);
  const crossCorpusFile = corpusFiles.find((file) => file.corpusKey === 'cross-corpus');
  const crossCorpusDebateIds = new Set(crossCorpusFile.entries.map((debate) => debate.id));
  const clientDebates = readJson(path.join(rootDir, path.relative(ROOT_DIR, CLIENT_DEBATES_PATH)));
  const clientDebateIds = new Set((Array.isArray(clientDebates) ? clientDebates : []).map((debate) => debate.id));
  const metaCountDrift = [];
  const malformedYears = [];
  const rangeDateFields = [];
  const invalidPrimaryUrls = [];
  const taxonomyDrift = [];
  const unknownCorpusKeys = [];

  corpusFiles.forEach((file) => {
    file.metaCountKeys.forEach((key) => {
      const expected = file.data?.meta?.[key];
      if (typeof expected === 'number' && expected !== file.entries.length) {
        metaCountDrift.push({
          corpus: file.corpusKey,
          field: key,
          expected,
          actual: file.entries.length,
        });
      }
    });

    file.entries.forEach((entry) => {
      const id = getEntryIdentifier(entry);
      if (typeof entry?.year === 'string' && /^\d+$/.test(entry.year)) {
        malformedYears.push({ corpus: file.corpusKey, id, year: entry.year });
      }
      ['date_enacted', 'date_proposed'].forEach((field) => {
        if (typeof entry?.[field] === 'string' && DATE_RANGE_RE.test(entry[field])) {
          rangeDateFields.push({ corpus: file.corpusKey, id, field, value: entry[field] });
        }
      });
      ['url', 'source_url'].forEach((field) => {
        if (!Object.prototype.hasOwnProperty.call(entry || {}, field)) {
          return;
        }
        const value = entry[field];
        if (typeof value === 'string' && value && value !== 'N/A' && !VALID_PRIMARY_URL_RE.test(value)) {
          invalidPrimaryUrls.push({ corpus: file.corpusKey, id, field, value });
        }
        if (value === 'N/A') {
          invalidPrimaryUrls.push({ corpus: file.corpusKey, id, field, value });
        }
      });

      Object.entries(TAXONOMY_ENUMS[file.corpusKey] || {}).forEach(([field, allowedValues]) => {
        if (!Object.prototype.hasOwnProperty.call(entry || {}, field)) {
          return;
        }
        if (!allowedValues.includes(entry[field])) {
          taxonomyDrift.push({ corpus: file.corpusKey, id, field, value: entry[field] });
        }
      });
    });
  });

  crossCorpusFile.entries.forEach((debate) => {
    const flagUnknown = (field, value) => {
      if (value && !index.aliasMap.has(value) && !index.aliasMap.has(String(value).replaceAll('_', '-'))) {
        unknownCorpusKeys.push({ debateId: debate.id, field, value });
      }
    };
    (debate.positions || []).forEach((position, positionIndex) => {
      flagUnknown(`positions[${positionIndex}].corpus`, position.corpus);
    });
    (debate.cross_corpus_references || []).forEach((reference, referenceIndex) => {
      flagUnknown(`cross_corpus_references[${referenceIndex}].from_corpus`, reference.from_corpus);
      flagUnknown(`cross_corpus_references[${referenceIndex}].to_corpus`, reference.to_corpus);
    });
  });

  const allReferenceIssues = collectDebateReferenceIssues(crossCorpusFile, index);
  const targetReferenceIssues = collectDebateReferenceIssues(crossCorpusFile, index, TARGET_DEBATE_IDS);

  return {
    duplicateIds: index.duplicateIds,
    metaCountDrift,
    malformedYears,
    rangeDateFields,
    invalidPrimaryUrls,
    taxonomyDrift,
    unknownCorpusKeys,
    debateReferences: allReferenceIssues,
    targetDebateReferences: targetReferenceIssues,
    clientDebateMirror: {
      missingFromClient: [...crossCorpusDebateIds].filter((id) => !clientDebateIds.has(id)),
      extraInClient: [...clientDebateIds].filter((id) => !crossCorpusDebateIds.has(id)),
    },
  };
}

function compactRecord(record) {
  if (!record || typeof record !== 'object') {
    return record;
  }

  const preferredKeys = [
    'id',
    'title',
    'question',
    'author',
    'authors',
    'date',
    'year',
    'status',
    'category',
    'summary',
    'url',
    'source_url',
    'source_links',
    'positions',
    'cross_corpus_references',
    'tags',
    'verification_status',
    'verification_notes',
  ];

  return Object.fromEntries(
    preferredKeys
      .filter((key) => Object.prototype.hasOwnProperty.call(record, key))
      .map((key) => [key, record[key]])
  );
}

function extractRecord(id, rootDir = ROOT_DIR) {
  const corpusFiles = loadCorpusFiles(rootDir);
  for (const file of corpusFiles) {
    const entry = file.entries.find((candidate) => getEntryLookupKeys(candidate).includes(id));
    if (entry) {
      return {
        corpus: file.corpusKey,
        path: file.relativePath,
        record: compactRecord(entry),
      };
    }
  }
  return null;
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main(argv = process.argv.slice(2)) {
  const command = argv[0] || 'summary';
  if (command === 'summary') {
    printJson(collectSummary());
    return 0;
  }
  if (command === 'validate') {
    printJson(collectValidation());
    return 0;
  }
  if (command === 'extract') {
    const id = argv[1];
    if (!id) {
      process.stderr.write('Usage: node scripts/ai-discourse-corpus-tools.js extract <id-or-url>\n');
      return 1;
    }
    const result = extractRecord(id);
    if (!result) {
      process.stderr.write(`No corpus record found for ${id}\n`);
      return 1;
    }
    printJson(result);
    return 0;
  }
  process.stderr.write('Usage: node scripts/ai-discourse-corpus-tools.js <summary|validate|extract>\n');
  return 1;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = {
  CLIENT_DEBATES_PATH,
  CORPUS_FILES,
  TARGET_DEBATE_IDS,
  TAXONOMY_ENUMS,
  buildRecordIndex,
  collectSummary,
  collectValidation,
  compactRecord,
  extractRecord,
  loadCorpusFiles,
  main,
  normalizeCorpusKey,
};
