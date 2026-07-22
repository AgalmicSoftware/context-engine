import { ethers } from 'ethers';

import demoSessions from '../../variables/demo/demo_sessions.json';
import demo1OnchainQuestionIds from '../../variables/demo/demo_1_onchain_question_ids.json';
import { getTemporaryDemoSessionQuestionFixtures } from './demoSessionQuestionFixtures.js';

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

  it('converts poll comments to single-select multichoice questions', () => {
    const questions = getTemporaryDemoSessionQuestionFixtures('demo-1');
    const pollQuestion = questions.find(
      (question) => (question.demoFixture as { fixtureType?: unknown } | undefined)?.fixtureType === 'poll',
    );

    expect(pollQuestion).toMatchObject({
      type: 'multichoice',
      singleSelect: true,
      options: [
        'Technical researchers',
        'AI developers and labs',
        'Governments and regulators',
        'The general public',
        'Affected communities',
      ],
    });
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
    expect(config.defaultTags).toBe('');
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
});
