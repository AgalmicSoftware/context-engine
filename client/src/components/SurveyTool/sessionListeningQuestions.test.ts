import { callAI } from '../../utilities/ai/aiClient.js';
import {
  buildListeningQuestionPrompt,
  buildListeningQuestionStatements,
  generateQuestionsFromListeningTranscript,
  parseListeningQuestionResponse,
} from './sessionListeningQuestions';
import { generateQuestionId } from '../../utilities/shared/questionUtils.mjs';

jest.mock('../../utilities/ai/aiClient.js', () => ({
  callAI: jest.fn(),
}));

const mockCallAI = callAI as jest.MockedFunction<typeof callAI>;

describe('sessionListeningQuestions', () => {
  it('includes a generated quadratic budget in the listening question identity', () => {
    const question = { prompt: 'Allocate support', questionType: 'quadratic', options: ['Parks', 'Transit'] };
    const build = (voiceCredits: number) =>
      buildListeningQuestionStatements({ questions: [{ ...question, voiceCredits }] }).statements[0];
    expect(build(25)).toMatchObject({
      voiceCredits: 25,
      options: question.options,
      id: generateQuestionId('quadratic', question.prompt, question.options, false, 25),
    });
    expect(build(25).id).not.toBe(build(99).id);
  });
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
    expect(prompt).toContain('read the entire transcript');
    expect(prompt).toContain('Do not overweight the opening topic');
    expect(prompt).toContain('Prefer operational questions.');
  });

  it('keeps late transcript topics in the prompt for full-session coverage', () => {
    const earlyTopic = 'Early topic: procurement schedule and budget timing. ';
    const lateTopic =
      'Late topic: participants disagree about model accountability, evidence thresholds, and community trust.';
    const prompt = buildListeningQuestionPrompt(`${earlyTopic.repeat(450)}\n\n${lateTopic}`, {
      count: 5,
    });

    expect(prompt).toContain(earlyTopic.trim());
    expect(prompt).toContain(lateTopic);
    expect(prompt.indexOf(lateTopic)).toBeGreaterThan(prompt.indexOf(earlyTopic.trim()));
  });

  it('can build a document-source prompt after transcript summarization', () => {
    const prompt = buildListeningQuestionPrompt('Concise transcript summary.', {
      sourceTypeOverride: 'document',
      multiSpeakerHintOverride: 'likely_multiple_speakers',
    });

    expect(prompt).toContain('* SourceType: document');
    expect(prompt).toContain('* MultiSpeakerHint: likely_multiple_speakers');
  });

  it('adds prior generated prompts to the model context and requests the configured thinking tier', async () => {
    mockCallAI.mockResolvedValue(`{
      "surveyTitle": "Follow-up",
      "questions": [
        { "prompt": "What evidence should the group review next?", "questionType": "freeform", "tags": ["evidence"] }
      ]
    }`);

    await generateQuestionsFromListeningTranscript(
      'The group discussed budget timing, evidence thresholds, operational risk, and accountability tradeoffs in enough detail.',
      {
        sessionSlug: 'demo',
        existingQuestionPrompts: ['Which budget tradeoff matters most?'],
      },
    );

    expect(callAI).toHaveBeenCalledWith(
      expect.stringContaining('Already drafted questions from this conversation:'),
      expect.objectContaining({
        sessionSlug: 'demo',
        taskType: 'generate',
        thinking: true,
      }),
    );
    expect(callAI).toHaveBeenCalledWith(
      expect.stringContaining('Which budget tradeoff matters most?'),
      expect.anything(),
    );
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
    expect(result.statements[0]).toEqual(
      expect.objectContaining({
        type: 'binary',
        prompt: 'The team should decide the budget timeline before expanding scope.',
        tags: ['budget'],
      }),
    );
    expect(result.statements[1].options).toEqual(['Cost', 'Timing', 'Risk', 'None / Comment']);
  });
});
