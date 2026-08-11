import fs from 'node:fs/promises';
import path from 'node:path';

import { hashJson, sha256 } from './provenance.mjs';

const CORPUS_CONFIG = Object.freeze({
  'ai-forecasting-economics': ['ai-forecasting-economics-corpus.json', 'entries'],
  'ai-laws-policy': ['ai-laws-policy-corpus.json', 'entries'],
  'ai-scifi-books': ['ai-scifi-books-corpus.json', 'entries'],
  'arxiv-ai-safety': ['arxiv-ai-safety-corpus.json', 'entries'],
  'cross-corpus': ['cross-corpus-debates.json', 'debates'],
  'dwarkesh-lab-insiders': ['dwarkesh-lab-insiders-corpus.json', 'entries'],
  tweets: ['enriched-tweets.json', null],
  'lab-primary-docs': ['lab-primary-docs-corpus.json', 'entries'],
  'lesswrong-posts': ['lesswrong-posts-corpus.json', 'entries'],
  'loophole-historical-cases': ['loophole-historical-cases.json', null],
  'metr-evals-metrics': ['metr-evals-metrics-corpus.json', 'entries'],
});

const CORPUS_ALIASES = Object.freeze({
  'enriched-tweets': 'tweets',
  'enriched_tweets': 'tweets',
  'cross_corpus': 'cross-corpus',
  'ai_laws_policy': 'ai-laws-policy',
  'ai_scifi': 'ai-scifi-books',
  'arxiv_ai_safety': 'arxiv-ai-safety',
  'dwarkesh_lab_insiders': 'dwarkesh-lab-insiders',
  'lab_primary_docs': 'lab-primary-docs',
  'lesswrong_posts': 'lesswrong-posts',
  'metr_evals_metrics': 'metr-evals-metrics',
});

const canonicalCorpus = (value) => CORPUS_ALIASES[value] || value;

const recordsFrom = (data, collectionKey) => {
  if (Array.isArray(data)) return data;
  if (collectionKey && Array.isArray(data?.[collectionKey])) return data[collectionKey];
  return [];
};

const lookupKeys = (record) => [record?.id, record?.url, record?.source_url, record?.domain]
  .filter((value) => typeof value === 'string' && value.trim());

const sourceUrl = (record) => [
  record?.url,
  record?.source_url,
  ...(Array.isArray(record?.source_links) ? record.source_links : []),
].find((value) => typeof value === 'string' && /^https?:\/\//i.test(value)) || null;

const compactRecord = ({ corpus, relativePath, record }) => ({
  corpus,
  idOrUrl: record.id || record.url || record.domain,
  title: record.title || record.domain || record.question || record.id || record.url,
  url: sourceUrl(record),
  date: record.date || record.year || null,
  summary: String(record.summary || record.question || '').trim().slice(0, 500),
  sourcePath: relativePath,
  sourceRecordHash: hashJson(record),
});

export const loadCorpusEvidenceIndex = async (corpusRoot) => {
  const byCorpusAndKey = new Map();
  const files = [];
  for (const [corpus, [fileName, collectionKey]] of Object.entries(CORPUS_CONFIG)) {
    const absolutePath = path.join(corpusRoot, 'corpuses', fileName);
    const raw = await fs.readFile(absolutePath);
    const data = JSON.parse(raw.toString('utf8'));
    const relativePath = `ai-discourse-corpus/corpuses/${fileName}`;
    files.push({ corpus, relativePath, sha256: sha256(raw) });
    recordsFrom(data, collectionKey).forEach((record) => {
      lookupKeys(record).forEach((key) => {
        const scopedKey = `${corpus}:${key}`;
        if (!byCorpusAndKey.has(scopedKey)) {
          byCorpusAndKey.set(scopedKey, { corpus, relativePath, record });
        }
      });
    });
  }
  return { byCorpusAndKey, files };
};

export const resolveCorpusRecord = (index, corpusInput, idOrUrl) => {
  const corpus = canonicalCorpus(corpusInput);
  return index.byCorpusAndKey.get(`${corpus}:${idOrUrl}`) || null;
};

const supportingRecordsForDebate = (index, debateRecord, limit = 3) => {
  if (!Array.isArray(debateRecord?.positions)) return [];
  const seen = new Set();
  return [...debateRecord.positions]
    .sort((left, right) => Number(right.relevance_score || 0) - Number(left.relevance_score || 0))
    .flatMap((position) => {
      const resolved = resolveCorpusRecord(index, position.corpus, position.entry_url_or_id);
      if (!resolved) return [];
      const compact = compactRecord(resolved);
      const key = `${compact.corpus}:${compact.idOrUrl}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{
        ...compact,
        stanceSide: position.side || null,
        stanceSummary: position.stance_summary || '',
        relevanceScore: Number(position.relevance_score || 0),
      }];
    })
    .slice(0, limit);
};

export const resolveQuestionEvidence = (index, question) => (question.sourceAnchors || []).map((anchor) => {
  const resolved = resolveCorpusRecord(index, anchor.corpus, anchor.idOrUrl);
  if (!resolved) {
    throw new Error(`unresolved corpus anchor ${anchor.corpus}:${anchor.idOrUrl} for ${question.id}`);
  }
  const compact = compactRecord(resolved);
  return {
    ...compact,
    resolution: 'resolved',
    evidenceScope: 'source-record-resolution-only',
    relatedDisagreementAxis: question.disagreementAxis,
    anchorReason: anchor.reason || '',
    supportingRecords: compact.corpus === 'cross-corpus'
      ? supportingRecordsForDebate(index, resolved.record)
      : [],
  };
});
