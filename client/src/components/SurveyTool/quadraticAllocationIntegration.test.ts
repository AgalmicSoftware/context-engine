import { generateQuestionId } from '../../utilities/shared/questionUtils.mjs';
import {
  buildCreateSurveyQuestionFieldUpdateList,
  buildCreateSurveyNewQuestionDraft,
  getCreateSurveyValidationError,
  normalizePayloadQuestionOptions,
} from './createQuestionsAndSurveysHelpers';
import { buildGeneratedSurveyStatements } from './SurveyGenerator/surveyGeneratorHelpers';
import { normalizeInterviewQuestions, parseInterviewDraftResponses } from './sessionInterview';
import { buildSurveyResultsQuestionsCsvExport, buildSurveyResultsResponsesCsvExport } from './surveyResultsExportPlans';
import { buildQuestionResponseHydrationPatch } from './surveyToolResponseState';

const question = {
  id: 'q1',
  prompt: 'Allocate support',
  type: 'quadratic',
  options: ['Parks', 'Transit'],
  voiceCredits: 25,
};

it('authors two default option rows, validates definitions and changes identity with the budget', () => {
  expect(buildCreateSurveyNewQuestionDraft({ addingQuestionType: 'quadratic' })?.question).toMatchObject({
    type: 'quadratic',
    options: ['', ''],
    voiceCredits: 99,
  });
  expect(getCreateSurveyValidationError({ isStandaloneQuestion: true, questions: [question] })).toBe('');
  expect(
    getCreateSurveyValidationError({ isStandaloneQuestion: true, questions: [{ ...question, options: ['Only'] }] }),
  ).toMatch(/two/);
  expect(normalizePayloadQuestionOptions('quadratic', question.options)).toEqual(question.options);
  const next = buildCreateSurveyQuestionFieldUpdateList({
    questions: [question],
    questionIndex: 0,
    key: 'voiceCredits',
    value: 99,
    generateQuestionId: (type, prompt, options, singleSelect, voiceCredits) =>
      generateQuestionId(
        String(type),
        String(prompt),
        Array.isArray(options) ? options : [],
        Boolean(singleSelect),
        Number(voiceCredits),
      ),
  });
  expect(next[0]).toMatchObject({
    voiceCredits: 99,
    id: generateQuestionId('quadratic', question.prompt, question.options, false, 99),
  });
});

it('retains a generated custom budget and maps signed interview drafts without matching option labels', () => {
  const statements = buildGeneratedSurveyStatements({
    aiData: { questions: [{ ...question, questionType: 'quadratic' }] },
    questionTypes: { quadratic: true },
    count: 1,
  }).statements;
  expect(statements[0]).toMatchObject({
    options: question.options,
    voiceCredits: 25,
    id: generateQuestionId('quadratic', question.prompt, question.options, false, 25),
  });
  const questions = normalizeInterviewQuestions([question]);
  expect(questions[0].voiceCredits).toBe(25);
  expect(
    parseInterviewDraftResponses(
      JSON.stringify({ responses: [{ questionId: 'q1', answer: [3, -4], confidence: 1 }] }),
      questions,
    )[0]?.answer,
  ).toEqual([3, -4]);
  expect(
    parseInterviewDraftResponses(
      JSON.stringify({ responses: [{ questionId: 'q1', answer: [4, -4], confidence: 1 }] }),
      questions,
    ),
  ).toEqual([]);
});

it('preserves signed arrays when hydrating saved responses and includes budgets in CSV exports', () => {
  const patch = buildQuestionResponseHydrationPatch({
    questionId: 'q1',
    response: { answer: { value: [3, -4], encrypted: false } },
    allowOverwrite: true,
  });
  expect(JSON.stringify(patch)).toContain('[3,-4]');
  expect(buildSurveyResultsQuestionsCsvExport([question])).toContain('"Parks;Transit","25"');
  const csv = buildSurveyResultsResponsesCsvExport({
    networkQuestions: { q1: question },
    aggregatorQuestionResponses: {
      q1: [{ responder: 'participant', response: { questionID: 'q1', answer: { value: [3, -4] } } }],
    },
  });
  expect(csv).toContain('"3, -4"');
  expect(csv.split('\n')[1]).toMatch(/,"25"$/);
});
