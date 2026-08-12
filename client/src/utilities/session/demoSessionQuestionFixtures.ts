import { ethers } from 'ethers';

import demo1OnchainQuestionIds from '../../variables/demo/demo_1_onchain_question_ids.json';
import demo2PolisData from '../../variables/demo/demo_2_polis_data.json';
import demoPolisData from '../../variables/demo/demo_polis_data.json';
import { normalizeSessionSlug } from './sessionNaming.js';

type DemoComment = Record<string, unknown>;
type DemoSessionConfig = Record<string, unknown>;
type DemoQuestion = Record<string, unknown> & {
  id: string;
  prompt: string;
  sessionSlug: string;
};

type DemoFixtureRegistryEntry = {
  data: Record<string, unknown>;
  fixtureFile: string;
  onchainQuestionIds: unknown[];
  onchainQuestionIdsFile: string;
  sourceSessionSlug: string;
};

const ZERO_SURVEY_ID = '0x0000000000000000000000000000000000000000000000000000000000000000';
const legacyQuestionIds = Array.isArray(demo1OnchainQuestionIds) ? demo1OnchainQuestionIds : [];
const LEGACY_DEMO_FIXTURE: DemoFixtureRegistryEntry = {
  data: demoPolisData as Record<string, unknown>,
  fixtureFile: 'client/src/variables/demo/demo_polis_data.json',
  onchainQuestionIds: legacyQuestionIds,
  onchainQuestionIdsFile: 'client/src/variables/demo/demo_1_onchain_question_ids.json',
  sourceSessionSlug: 'demo',
};

const DEMO_FIXTURES_BY_SLUG: Readonly<Record<string, DemoFixtureRegistryEntry>> = Object.freeze({
  'demo-1': LEGACY_DEMO_FIXTURE,
  'demo-2': {
    data: demo2PolisData as Record<string, unknown>,
    fixtureFile: 'client/src/variables/demo/demo_2_polis_data.json',
    onchainQuestionIds: [],
    onchainQuestionIdsFile: '',
    sourceSessionSlug: 'demo-2',
  },
  'demo-sh': LEGACY_DEMO_FIXTURE,
});

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

const readCommentPollOptions = (comment: DemoComment): string[] =>
  uniqueStrings(Array.isArray(comment.options) ? comment.options : []);

const splitSources = (value: unknown): string[] =>
  String(value || '')
    .split(',')
    .map((source) => source.trim())
    .filter(Boolean);

const buildDemoQuestionFromComment = (
  fixture: DemoFixtureRegistryEntry,
  comment: DemoComment,
  index: number,
  sessionConfig: DemoSessionConfig = {},
  onchainQuestionId: unknown = '',
  targetSlug = 'demo-1',
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
    tags: uniqueStrings([
      'demo-fixture',
      'context-corpus',
      fixtureType,
      comment?.category,
      ...splitSources(comment?.sources),
    ]),
    creator: String(comment?.authorId || ''),
    associatedSurveyId: ZERO_SURVEY_ID,
    sessionName: String(sessionConfig?.sessionName || targetSlug),
    sessionSlug: targetSlug,
    corpus: 'Context',
    temporaryDemoSeed: !workerCanonical,
    cloudflareDemoSeed: workerCanonical,
    demoFixture: {
      sourceSessionSlug: fixture.sourceSessionSlug,
      fixtureFile: fixture.fixtureFile,
      fixturePath: 'comments',
      onchainQuestionIdsFile: fixture.onchainQuestionIdsFile,
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
    question.options = readCommentPollOptions(comment);
    question.singleSelect = true;
  }
  if (type === 'rating' && comment.scale && typeof comment.scale === 'object' && !Array.isArray(comment.scale)) {
    question.scale = { ...comment.scale };
  }
  return question;
};

export const getDemoFixtureQuestionIdsByIndex = (slugIn: unknown): string[] => {
  const slug = normalizeSessionSlug(slugIn);
  const fixture = DEMO_FIXTURES_BY_SLUG[slug];
  if (!fixture) return [];
  const comments = Array.isArray(fixture.data.comments) ? (fixture.data.comments as DemoComment[]) : [];
  return comments.map((comment, index) => {
    const canonicalQuestionId = String(fixture.onchainQuestionIds[index] || '')
      .trim()
      .toLowerCase();
    if (canonicalQuestionId) return canonicalQuestionId;
    const sourceCommentId = String(comment?.commentId || '').trim();
    return sourceCommentId ? ethers.utils.id(`${slug}:${sourceCommentId}`).toLowerCase() : '';
  });
};

export const getTemporaryDemoSessionQuestionFixtures = (
  slugIn: unknown,
  sessionConfig: DemoSessionConfig = {},
): DemoQuestion[] => {
  const slug = normalizeSessionSlug(slugIn);
  const fixture = DEMO_FIXTURES_BY_SLUG[slug];
  if (!fixture) return [];
  const seed = sessionConfig?.demoCompatibilitySeed;
  const seedConfig = seed && typeof seed === 'object' ? (seed as Record<string, unknown>) : {};
  const workerCanonical = seedConfig.workerCanonical === true;
  if (seedConfig.temporary === false && !workerCanonical) {
    return [];
  }
  const comments = Array.isArray(fixture.data.comments) ? (fixture.data.comments as DemoComment[]) : [];
  return comments
    .map((comment, index) =>
      buildDemoQuestionFromComment(
        fixture,
        comment,
        index,
        sessionConfig,
        fixture.onchainQuestionIds[index],
        slug,
        workerCanonical,
      ),
    )
    .filter((question): question is DemoQuestion => !!question);
};
