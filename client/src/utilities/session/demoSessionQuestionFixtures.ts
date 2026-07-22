import { ethers } from 'ethers';

import demo1OnchainQuestionIds from '../../variables/demo/demo_1_onchain_question_ids.json';
import demoPolisData from '../../variables/demo/demo_polis_data.json';
import { normalizeSessionSlug } from './sessionNaming.js';

type DemoComment = Record<string, unknown>;
type DemoSessionConfig = Record<string, unknown>;
type DemoQuestion = Record<string, unknown> & {
  id: string;
  prompt: string;
  sessionSlug: string;
};

const TEMPORARY_DEMO_QUESTION_SLUG = 'demo-1';
const CLOUDFLARE_DEMO_QUESTION_SLUG = 'demo-sh';
const ZERO_SURVEY_ID = '0x0000000000000000000000000000000000000000000000000000000000000000';
const POLL_OPTIONS = [
  'Technical researchers',
  'AI developers and labs',
  'Governments and regulators',
  'The general public',
  'Affected communities',
];

const uniqueStrings = (values: unknown[]): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  values.forEach((raw) => {
    const value = String(raw || '').trim();
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(value);
  });
  return out;
};

const splitSources = (value: unknown): string[] =>
  String(value || '')
    .split(',')
    .map((source) => source.trim())
    .filter(Boolean);

const buildDemoQuestionFromComment = (
  comment: DemoComment,
  index: number,
  sessionConfig: DemoSessionConfig = {},
  onchainQuestionId: unknown = '',
  targetSlug = TEMPORARY_DEMO_QUESTION_SLUG,
  workerCanonical = false,
): DemoQuestion | null => {
  const sourceCommentId = String(comment?.commentId || '').trim();
  const prompt = String(comment?.commentBody || '').trim();
  if (!sourceCommentId || !prompt) return null;

  const canonicalQuestionId = String(onchainQuestionId || '')
    .trim()
    .toLowerCase();
  const fixtureType =
    String(comment?.type || '')
      .trim()
      .toLowerCase() || 'freeform';
  const type = fixtureType === 'poll' ? 'multichoice' : fixtureType;
  const question: DemoQuestion = {
    id: canonicalQuestionId || ethers.utils.id(`${targetSlug}:${sourceCommentId}`),
    type,
    prompt,
    tags: uniqueStrings([fixtureType, comment?.category, ...splitSources(comment?.sources)]),
    creator: String(comment?.authorId || ''),
    associatedSurveyId: ZERO_SURVEY_ID,
    sessionName: String(sessionConfig?.sessionName || targetSlug),
    sessionSlug: targetSlug,
    corpus: 'Context',
    temporaryDemoSeed: !workerCanonical,
    cloudflareDemoSeed: workerCanonical,
    demoFixture: {
      sourceSessionSlug: 'demo',
      fixtureFile: 'client/src/variables/demo/demo_polis_data.json',
      fixturePath: 'comments',
      onchainQuestionIdsFile: 'client/src/variables/demo/demo_1_onchain_question_ids.json',
      workerCanonical,
      sourceCommentIndex: index,
      sourceCommentId,
      fixtureType,
      nodeId: String(comment?.nodeId || ''),
    },
    demoStats: {
      agrees: Number(comment?.agrees || 0),
      disagrees: Number(comment?.disagrees || 0),
      moderated: Number(comment?.moderated || 0),
      timestamp: Number(comment?.timestamp || 0) || null,
      datetime: String(comment?.datetime || ''),
      category: String(comment?.category || ''),
      keyTension: String(comment?.key_tension || ''),
      sources: String(comment?.sources || ''),
    },
  };
  if (type === 'multichoice') {
    question.options = POLL_OPTIONS;
    question.singleSelect = true;
  }
  return question;
};

export const getTemporaryDemoSessionQuestionFixtures = (
  slugIn: unknown,
  sessionConfig: DemoSessionConfig = {},
): DemoQuestion[] => {
  const slug = normalizeSessionSlug(slugIn);
  if (slug !== TEMPORARY_DEMO_QUESTION_SLUG && slug !== CLOUDFLARE_DEMO_QUESTION_SLUG) return [];
  const seed = sessionConfig?.demoCompatibilitySeed;
  const seedConfig = seed && typeof seed === 'object' ? (seed as Record<string, unknown>) : {};
  const workerCanonical = slug === CLOUDFLARE_DEMO_QUESTION_SLUG && seedConfig.workerCanonical === true;
  if (seedConfig.temporary === false && !workerCanonical) {
    return [];
  }
  const comments = Array.isArray((demoPolisData as Record<string, unknown>)?.comments)
    ? ((demoPolisData as Record<string, unknown>).comments as DemoComment[])
    : [];
  const questionIds = Array.isArray(demo1OnchainQuestionIds) ? demo1OnchainQuestionIds : [];
  return comments
    .map((comment, index) => buildDemoQuestionFromComment(
      comment,
      index,
      sessionConfig,
      questionIds[index],
      slug,
      workerCanonical,
    ))
    .filter((question): question is DemoQuestion => !!question);
};
