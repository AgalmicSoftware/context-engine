import { generateQuestionId } from '../../../utilities/shared/questionUtils.mjs';
import { buildSetupQuestionRecord } from './setupQuestionsPublish';

const context = { creator: '0xaa', sessionName: 'Salon', sessionSlug: 'salon' };

describe('setup question records', () => {
  it('derive the same IDs the question editor gives each type', () => {
    expect(buildSetupQuestionRecord({ prompt: ' Parks need shade. ', type: 'binary' }, context)).toEqual({
      id: generateQuestionId('binary', 'Parks need shade.', [], false, 99),
      type: 'binary',
      prompt: 'Parks need shade.',
      tags: [],
      creator: '0xaa',
      associatedSurveyId: `0x${'0'.repeat(64)}`,
      sessionName: 'Salon',
      sessionSlug: 'salon',
    });
    const choice = buildSetupQuestionRecord(
      { prompt: 'Which park?', type: 'multichoice', options: [' North ', 'South'], singleSelect: true },
      context,
    );
    expect(choice).toMatchObject({ options: ['North', 'South'], singleSelect: true });
    expect(choice.id).toBe(generateQuestionId('multichoice', 'Which park?', ['North', 'South'], true, 99));
    const quadratic = buildSetupQuestionRecord(
      { prompt: 'Split it.', type: 'quadratic', options: ['Trees', 'Benches'], voiceCredits: 16 },
      context,
    );
    expect(quadratic).toMatchObject({ voiceCredits: 16 });
    expect(quadratic.id).toBe(generateQuestionId('quadratic', 'Split it.', ['Trees', 'Benches'], false, 16));
  });

  it('keeps a rating scale and leaves out fields other types do not use', () => {
    const scale = { min: 0, max: 10, minLabel: 'Not at all', maxLabel: 'Completely' };
    const rating = buildSetupQuestionRecord(
      { prompt: 'Trust?', type: 'rating', scale, tags: [' trust ', ''] },
      context,
    );
    expect(rating).toMatchObject({ scale, tags: ['trust'] });
    expect(rating).not.toHaveProperty('options');
    expect(rating).not.toHaveProperty('voiceCredits');
    expect(buildSetupQuestionRecord({ prompt: 'More?', type: 'freeform', scale }, context)).not.toHaveProperty('scale');
  });
});
