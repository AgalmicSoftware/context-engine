import { ethers } from 'ethers';

import demoSessions from '../../variables/demo/demo_sessions.json';
import demo1OnchainQuestionIds from '../../variables/demo/demo_1_onchain_question_ids.json';
import demo2QuestionSeed from '../../variables/demo/demo_2_question_seed.json';
import { LEGACY_DEMO_POLL_OPTIONS } from '../demo/demoQuestionSemantics';
import {
  getDemoFixtureQuestionIdsByIndex,
  getTemporaryDemoSessionQuestionFixtures,
} from './demoSessionQuestionFixtures.js';
import { classifySessionModeProfileSupport } from './sessionModeProfile';

describe('getTemporaryDemoSessionQuestionFixtures', () => {
  it('maps the demo polis comments to temporary demo-1 question metadata', () => {
    const questions = getTemporaryDemoSessionQuestionFixtures('demo-1', {
      sessionName: 'Demo Session',
      demoCompatibilitySeed: { temporary: true },
    });

    expect(questions).toHaveLength(42);
    expect(questions.map((question) => question.id)).toEqual(demo1OnchainQuestionIds);
    expect(questions[0]).toMatchObject({
      id: '0xa1f2ff65069c4fbce9c0728364c5c0dc59f45c3caedb45fa3c8988cc79d06735',
      type: 'binary',
      prompt: 'Existential risk from AI justifies extraordinary precautions.',
      sessionName: 'Demo Session',
      sessionSlug: 'demo-1',
      corpus: 'Context',
      temporaryDemoSeed: true,
      demoFixture: {
        sourceSessionSlug: 'demo',
        fixtureFile: 'client/src/variables/demo/demo_polis_data.json',
        fixturePath: 'comments',
        onchainQuestionIdsFile: 'client/src/variables/demo/demo_1_onchain_question_ids.json',
        sourceCommentIndex: 0,
      },
    });
    expect(questions[0].id).toBe(
      ethers.utils.id('demo-1:0x6a1ce29ec6002bf93c666cba8c5139766544d55bbeb6317fbf4c970861a2f262'),
    );
  });

  it('exposes only source-derived tags in the demo-1 question filter', () => {
    const questions = getTemporaryDemoSessionQuestionFixtures('demo-1');
    const tags = new Set(questions.flatMap((question) => (question.tags as string[]) || []));

    expect(tags).not.toContain('demo-fixture');
    expect(tags).not.toContain('context-corpus');
    expect(questions[0].tags).toEqual([
      'binary',
      'EXISTENTIAL RISK & SAFETY FOUNDATIONS',
      'tweets',
      'arxiv',
      'LessWrong',
      'insiders',
      'laws',
    ]);
  });

  it('preserves the legacy Worker-canonical poll choices', () => {
    const questions = getTemporaryDemoSessionQuestionFixtures('demo-1');
    const pollQuestions = questions.filter(
      (question) => (question.demoFixture as { fixtureType?: unknown } | undefined)?.fixtureType === 'poll',
    );

    expect(pollQuestions).toHaveLength(5);
    pollQuestions.forEach((pollQuestion) => {
      expect(pollQuestion).toMatchObject({ type: 'multichoice', singleSelect: true });
      expect((pollQuestion.options as string[]).length).toBeGreaterThanOrEqual(2);
      expect(new Set((pollQuestion.options as string[]).map((option) => option.toLowerCase())).size).toBe(
        (pollQuestion.options as string[]).length,
      );
    });

    expect(pollQuestions[0].prompt).toBe('Who should most influence AI development decisions?');
    pollQuestions.forEach((question) => {
      expect(question.options).toEqual(LEGACY_DEMO_POLL_OPTIONS);
    });
    expect(pollQuestions.every((question) => question.options === pollQuestions[0].options)).toBe(false);
  });

  it('does not seed other slugs or explicitly disabled demo sessions', () => {
    expect(getTemporaryDemoSessionQuestionFixtures('demo')).toEqual([]);
    expect(
      getTemporaryDemoSessionQuestionFixtures('demo-1', {
        demoCompatibilitySeed: { temporary: false },
      }),
    ).toEqual([]);
  });

  it('keeps demo-1 fixture data out of worker and faucet authority', () => {
    const config = (demoSessions as Record<string, any>)['demo-1'];

    expect(config.corsWorkerUrl).toBe('');
    expect(config.networkChainId).toBe(11155420);
    expect(config.sponsoredKeys).toBeUndefined();
    expect(config.__registry).toBeUndefined();
    expect(config.demoCompatibilitySeed).toMatchObject({
      temporary: true,
      sessionSlug: 'demo-1',
      questionCount: 42,
    });
  });

  it('maps the same 42 questions to the Cloudflare-canonical demo-sh session', () => {
    const config = (demoSessions as Record<string, any>)['demo-sh'];
    const questions = getTemporaryDemoSessionQuestionFixtures('demo-sh', config);

    expect(questions).toHaveLength(42);
    expect(questions.map((question) => question.id)).toEqual(demo1OnchainQuestionIds);
    expect(questions[0]).toMatchObject({
      sessionSlug: 'demo-sh',
      temporaryDemoSeed: false,
      cloudflareDemoSeed: true,
      demoFixture: { workerCanonical: true },
    });
    expect(config).toMatchObject({
      slug: 'demo-sh',
      sessionId: '0xb822b3eca85bdc35cf83cb947bceb6b2',
      configRevision: 'demo-sh-v1',
      corsWorkerUrl: 'https://ce-demo-sh-481bb6cd0a81.agalmic.workers.dev/',
      demoCompatibilitySeed: {
        temporary: false,
        workerCanonical: true,
        questionCount: 42,
      },
    });
  });

  it('seeds all 40 typed demo-2 questions with deterministic fixture ids', () => {
    const questions = getTemporaryDemoSessionQuestionFixtures('demo-2', {
      sessionName: 'Living With Artificial Minds',
      demoCompatibilitySeed: { temporary: true },
    });
    const comments = demo2QuestionSeed.comments as Array<{ commentId: string; type: string }>;
    const typeCounts = questions.reduce<Record<string, number>>((counts, question) => {
      counts[String(question.type)] = (counts[String(question.type)] || 0) + 1;
      return counts;
    }, {});

    expect(questions).toHaveLength(40);
    expect(typeCounts).toEqual({ binary: 27, rating: 5, multichoice: 4, freeform: 4 });
    expect(questions.map((question) => question.id)).toEqual(
      comments.map((comment) => ethers.utils.id(`demo-2:${comment.commentId}`)),
    );
    expect(questions[0]).toMatchObject({
      sessionName: 'Living With Artificial Minds',
      sessionSlug: 'demo-2',
      temporaryDemoSeed: true,
      cloudflareDemoSeed: false,
      demoFixture: {
        sourceSessionSlug: 'demo-2',
        fixtureFile: 'client/src/variables/demo/demo_2_question_seed.json',
        onchainQuestionIdsFile: '',
      },
      workerAuthority: {
        version: 1,
        anonymousScopes: ['storage', 'ai', 'transcribe'],
      },
    });
    expect(getDemoFixtureQuestionIdsByIndex('demo-2')).toEqual(
      questions.map((question) => question.id.toLowerCase()),
    );
  });

  it('keeps the checked-in demo-2 config on the fixture-only preview path', () => {
    const config = (demoSessions as Record<string, any>)['demo-2'];
    const questions = getTemporaryDemoSessionQuestionFixtures('demo-2', config);

    expect(questions).toHaveLength(40);
    expect(config).toMatchObject({
      slug: 'demo-2',
      corsWorkerUrl: '',
      demoCompatibilitySeed: {
        temporary: true,
        questionFixture: 'client/src/variables/demo/demo_2_question_seed.json#comments',
        questionCount: 40,
      },
    });
    expect(config.demoCompatibilitySeed.workerCanonical).toBeUndefined();
    expect(questions[0]).toMatchObject({ temporaryDemoSeed: true, cloudflareDemoSeed: false });
  });

  it('preserves each demo-2 poll choice list and rating scale', () => {
    const questions = getTemporaryDemoSessionQuestionFixtures('demo-2');
    const comments = demo2QuestionSeed.comments as Array<{
      options?: string[];
      scale?: { min: number; max: number };
      type: string;
    }>;
    const pollQuestions = questions.filter((question) => question.type === 'multichoice');
    const ratingQuestions = questions.filter((question) => question.type === 'rating');

    expect(pollQuestions.map((question) => question.options)).toEqual(
      comments.filter((comment) => comment.type === 'poll').map((comment) => comment.options),
    );
    expect(new Set(pollQuestions.map((question) => JSON.stringify(question.options))).size).toBe(4);
    expect(ratingQuestions.map((question) => question.scale)).toEqual(
      comments.filter((comment) => comment.type === 'rating').map((comment) => comment.scale),
    );
  });

  it('derives canonical-worker behavior from the seed config for every fixture slug', () => {
    const questions = getTemporaryDemoSessionQuestionFixtures('demo-2', {
      demoCompatibilitySeed: { temporary: false, workerCanonical: true },
    });

    expect(questions).toHaveLength(40);
    questions.forEach((question) => {
      expect(question).toMatchObject({
        temporaryDemoSeed: false,
        cloudflareDemoSeed: true,
        demoFixture: { workerCanonical: true },
      });
    });
  });

  it('keeps legacy fixture ids stable across demo-1 and demo-sh', () => {
    expect(getDemoFixtureQuestionIdsByIndex('demo-1')).toEqual(demo1OnchainQuestionIds);
    expect(getDemoFixtureQuestionIdsByIndex('demo-sh')).toEqual(demo1OnchainQuestionIds);
    expect(getDemoFixtureQuestionIdsByIndex('demo')).toEqual([]);
  });
});
