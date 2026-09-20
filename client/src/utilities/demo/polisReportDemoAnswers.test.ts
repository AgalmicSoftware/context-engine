import legacy from '../../variables/demo/demo_polis_data.json';
import demo2 from '../../variables/demo/demo_2_polis_data.json';
import examples from '../../variables/demo/polis_report_answer_examples.json';
import { withPolisReportDemoAnswers } from './polisReportDemoAnswers';
import {
  buildPolisDemoSurveyResultsAggregatorData,
  buildPolisDemoSurveyResultsNetworkData,
} from '../../components/SurveyTool/surveyPolisDemoResultsData';
import { buildReportAnswerQuestions } from '../../components/PolisReport/polisReportAnswers';
import { LEGACY_DEMO_POLL_OPTIONS } from './demoQuestionSemantics';

describe.each([
  ['demo', legacy],
  ['demo-2', demo2],
] as const)('Polis report examples for %s', (slug, source) => {
  it('adds valid, tagged answers for every section, including multiple questions and custom budgets', () => {
    const extended = withPolisReportDemoAnswers(source);
    const { questions } = buildPolisDemoSurveyResultsNetworkData(extended, { sessionSlug: slug });
    const aggregator = buildPolisDemoSurveyResultsAggregatorData(extended, { sessionSlug: slug });
    const summaries = buildReportAnswerQuestions(aggregator, questions, { sessionSlug: slug, allowDemo: true });
    examples.forEach((example) => {
      const summary = summaries.find((question) => question.id === example.id);
      expect(summary).toMatchObject({
        type: example.type === 'poll' ? 'multichoice' : example.type,
        count: example.answers.length,
        prompt: example.prompt,
      });
      expect(questions[example.id].tags).toEqual(expect.arrayContaining(example.tags));
    });
    ['freeform', 'rating', 'multichoice', 'quadratic'].forEach((type) => {
      const section = summaries.filter((question) => question.type === type);
      expect(section.length).toBeGreaterThan(1);
      expect(section[0].count).toBeGreaterThanOrEqual(section[1].count);
    });
    expect(questions['report-demo-quadratic-education'].voiceCredits).toBe(49);
    expect(summaries.find((question) => question.id === 'report-demo-rating-governance')?.bins[0].count).toBe(1);
    const allocations = summaries.find((question) => question.id === 'report-demo-quadratic-governance');
    expect(allocations?.options.some((option) => option.net < 0)).toBe(true);
    expect(allocations?.options.some((option) => option.net > 0)).toBe(true);
  });

  it('preserves seeded fixtures, binary votes, participant identities, and precomputed analysis', () => {
    const before = JSON.stringify(source);
    const extended = withPolisReportDemoAnswers(source) as typeof source;
    expect(extended.comments.slice(0, source.comments.length).map((question) => question.commentId)).toEqual(
      source.comments.map((question) => question.commentId),
    );
    expect(extended.participantsVotes.map((participant) => participant.votes)).toEqual(
      source.participantsVotes.map((participant) => participant.votes),
    );
    expect(extended.participantsVotes.map((participant) => participant.participant)).toEqual(
      source.participantsVotes.map((participant) => participant.participant),
    );
    expect(extended.clusterAnalysis).toBe(source.clusterAnalysis);
    expect(JSON.stringify(source)).toBe(before);
    expect(withPolisReportDemoAnswers(source)).toBe(extended);
    expect(withPolisReportDemoAnswers(extended)).toBe(extended);
  });
});

it('retains the published legacy poll options in the report adapter', () => {
  const { questions } = buildPolisDemoSurveyResultsNetworkData(withPolisReportDemoAnswers(legacy));
  legacy.comments
    .filter((comment) => comment.type === 'poll')
    .forEach((comment) => {
      expect(questions[comment.commentId.toLowerCase()].options).toEqual(LEGACY_DEMO_POLL_OPTIONS);
    });
});
