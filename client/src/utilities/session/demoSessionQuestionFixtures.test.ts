import { ethers } from 'ethers';

import { getTemporaryDemoSessionQuestionFixtures } from './demoSessionQuestionFixtures.js';

describe('getTemporaryDemoSessionQuestionFixtures', () => {
  it('maps the demo polis comments to temporary demo-1 question metadata', () => {
    const questions = getTemporaryDemoSessionQuestionFixtures('demo-1', {
      sessionName: 'Context Demo',
      demoCompatibilitySeed: { temporary: true },
    });

    expect(questions).toHaveLength(42);
    expect(questions[0]).toMatchObject({
      id: ethers.utils.id('demo-1:0x6a1ce29ec6002bf93c666cba8c5139766544d55bbeb6317fbf4c970861a2f262'),
      type: 'binary',
      prompt: 'Existential risk from AI justifies extraordinary precautions.',
      sessionName: 'Context Demo',
      sessionSlug: 'demo-1',
      corpus: 'Context',
      temporaryDemoSeed: true,
      demoFixture: {
        sourceSessionSlug: 'demo',
        fixtureFile: 'client/src/variables/demo/demo_polis_data.json',
        fixturePath: 'comments',
        sourceCommentIndex: 0,
      },
    });
  });

  it('converts poll comments to single-select multichoice questions', () => {
    const questions = getTemporaryDemoSessionQuestionFixtures('demo-1');
    const pollQuestion = questions.find((question) => (
      (question.demoFixture as { fixtureType?: unknown } | undefined)?.fixtureType === 'poll'
    ));

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
    expect(getTemporaryDemoSessionQuestionFixtures('demo-1', {
      demoCompatibilitySeed: { temporary: false },
    })).toEqual([]);
  });
});
