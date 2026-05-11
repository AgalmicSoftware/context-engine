import {
  buildListeningQuestionPrompt,
  buildListeningQuestionStatements,
  parseListeningQuestionResponse,
} from './sessionListeningQuestions';

describe('sessionListeningQuestions', () => {
  it('builds a transcript-aware generation prompt for listening mode', () => {
    const prompt = buildListeningQuestionPrompt('Speaker A raised budget timing. Speaker B disagreed.', {
      count: 3,
      defaultTags: ['budget', 'planning'],
      sessionInstructions: 'Prefer operational questions.',
    });

    expect(prompt).toContain('* SourceType: transcript');
    expect(prompt).toContain('* MultiSpeakerHint: likely_multiple_speakers');
    expect(prompt).toContain('numberOfSeedStatementsOrPrompts: 3');
    expect(prompt).toContain('Allowed Default Tags');
    expect(prompt).toContain('budget, planning');
    expect(prompt).toContain('Prefer operational questions.');
  });

  it('parses AI JSON and builds reviewable question statements', () => {
    const parsed = parseListeningQuestionResponse(`prefix {
      "surveyTitle": "Listening Follow-up",
      "questions": [
        {
          "prompt": "The team should decide the budget timeline before expanding scope.",
          "questionType": "binary",
          "tags": ["budget"]
        },
        {
          "prompt": "Which concern needs more evidence?",
          "questionType": "multichoice",
          "options": ["Cost", "Timing", "Risk", "None / Comment"],
          "tags": ["evidence"]
        }
      ]
    } suffix`);

    const result = buildListeningQuestionStatements(parsed, {
      count: 2,
      questionTypes: {
        binary: true,
        multichoice: true,
        rating: false,
        freeform: false,
      },
    });

    expect(result.surveyTitle).toBe('Listening Follow-up');
    expect(result.statements).toHaveLength(2);
    expect(result.statements[0]).toEqual(expect.objectContaining({
      type: 'binary',
      prompt: 'The team should decide the budget timeline before expanding scope.',
      tags: ['budget'],
    }));
    expect(result.statements[1].options).toEqual(['Cost', 'Timing', 'Risk', 'None / Comment']);
  });
});
