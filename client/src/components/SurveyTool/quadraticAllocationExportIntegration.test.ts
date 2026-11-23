import { QUADRATIC_READING_RULE } from '../../../../shared/promptRules.mjs';
import { buildSurveyResultsAnalysisResponsesForExport } from './surveyResultsAnalysisDataModel';
import { buildSurveyResultsFilteredQuestionsForExport } from './surveyResultsExportRows';
import { buildSurveyResultsQuestionsCsvExport } from './surveyResultsExportPlans';
import { buildSurveyResultsHtmlReportQuestionsForExport } from './surveyResultsHtmlReportDataModel';
import {
  buildSessionResultsSnapshot,
  renderSessionResultsHtmlReport,
} from '../../utilities/sessionResultsExport/sessionResultsExport';
import {
  buildSessionResultsAnalysisAiPayload,
  buildSessionResultsAnalysisPrompt,
} from '../../utilities/sessionResultsExport/sessionResultsAnalysisArtifacts';

const question = {
  id: 'q1',
  type: 'quadratic',
  prompt: 'Allocate support',
  options: ['Parks', 'Transit'],
  voiceCredits: 25,
};

it('preserves a custom quadratic budget through filtered CSV and report snapshots', () => {
  const filtered = buildSurveyResultsFilteredQuestionsForExport({
    questionIds: ['q1'],
    networkQuestions: { q1: question },
  });
  expect(filtered[0]).toMatchObject({ voiceCredits: 25 });
  expect(buildSurveyResultsQuestionsCsvExport(filtered)).toContain('"[""Parks"",""Transit""]","25"');
  const reportQuestions = buildSurveyResultsHtmlReportQuestionsForExport({ filteredQuestions: filtered });
  const snapshot = buildSessionResultsSnapshot({ sections: { report: { questions: reportQuestions } } });
  expect(snapshot.sections.report.questions[0]).toMatchObject({ voiceCredits: 25 });
  expect(renderSessionResultsHtmlReport(snapshot, { format: 'single-html' })).toContain('25 voice credits');
});

it('gives AI analysis named signed votes and a budget, leaving out a cleared allocation', () => {
  const { aiPayload } = buildSessionResultsAnalysisAiPayload({
    questions: [question],
    responses: [
      { answer: [3, -4] },
      { answer: [0, 0] },
      { answer: [5, -1] },
      { answer: [0, 0], additional: 'Unsure' },
    ].map((response, index) => ({
      questionId: 'q1',
      questionType: 'quadratic',
      ...response,
      participantAddress: `participant-${index}`,
    })),
  });
  expect(aiPayload.questions[0]).toMatchObject({ voiceCredits: 25 });
  // [0, 0] is what clearing leaves, so only a comment keeps it; [5, -1] costs 26 of 25 credits.
  expect(aiPayload.responses.map(({ answer, additional }) => [answer, additional])).toEqual([
    ['Parks: +3; Transit: -4', undefined],
    ['', 'Unsure'],
  ]);
  expect(aiPayload.counts).toMatchObject({ participants: 2, responses: 2 });
  expect(buildSessionResultsAnalysisPrompt(aiPayload)).toContain(QUADRATIC_READING_RULE);
});

it('keeps option-to-vote mapping in AI answers when question options exceed the context cap', () => {
  const options = Array.from({ length: 13 }, (_, index) => `Project ${index + 1}`);
  const { aiPayload } = buildSessionResultsAnalysisAiPayload({
    questions: [{ ...question, options }],
    responses: [{ questionId: 'q1', answer: options.map((_, index) => (index === 12 ? -5 : 0)) }],
  });
  expect(aiPayload.responses[0].answer).toContain('Project 13: -5');
});

it.each(['question', 'survey'])('preserves quadratic arrays through the %s analysis adapter', (viewMode) => {
  const response = { questionID: 'q1', answer: { value: [3, -4] } };
  const responses = buildSurveyResultsAnalysisResponsesForExport({
    viewMode,
    surveyViewMode: 'individuals',
    networkQuestions: { q1: question },
    aggregatorQuestionResponses: { q1: [{ responder: 'sample', response }] },
    filteredResponses: [{ responder: 'sample', response: { responses: [response] } }],
  });
  const { aiPayload } = buildSessionResultsAnalysisAiPayload({ questions: [question], responses });
  expect(aiPayload.responses.map((row) => row.answer)).toEqual(['Parks: +3; Transit: -4']);
});
