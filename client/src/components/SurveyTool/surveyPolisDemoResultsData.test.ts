import demoPolisData from '../../variables/demo/demo_polis_data.json';
import demo2PolisData from '../../variables/demo/demo_2_polis_data.json';
import { getDemoFixtureQuestionIdsByIndex } from '../../utilities/session/demoSessionQuestionFixtures.js';
import {
  buildPolisDemoSurveyResultsAggregatorData,
  buildPolisDemoSurveyResultsNetworkData,
  buildSimulatedDemoResultsNetworkData,
} from './surveyPolisDemoResultsData.js';

const countQuestionResponses = (questionResponses: Record<string, Record<string, unknown>>): number =>
  Object.values(questionResponses).reduce((sum, responders) => sum + Object.keys(responders || {}).length, 0);

const binaryCommentIndexes = new Set(
  demoPolisData.comments
    .map((comment, index) => ({ index, type: String(comment.type) }))
    .filter(({ type }) => type === 'binary')
    .map(({ index }) => index),
);

describe('surveyPolisDemoResultsData', () => {
  it('normalizes the canonical Polis demo comments and votes into question-results cache data', () => {
    const data = buildPolisDemoSurveyResultsNetworkData();
    const expectedVoteCount = demoPolisData.participantsVotes.reduce(
      (sum, participant) =>
        sum + Object.keys(participant.votes || {}).filter((voteIndex) => binaryCommentIndexes.has(Number(voteIndex))).length,
      0,
    );

    expect(Object.keys(data.questions)).toHaveLength(42);
    expect(countQuestionResponses(data.questionResponses)).toBe(expectedVoteCount);
    expect(countQuestionResponses(data.questionResponses)).toBeGreaterThan(0);

    const firstQuestionId = String(demoPolisData.comments[0].commentId).toLowerCase();
    expect(data.questions[firstQuestionId]).toEqual(
      expect.objectContaining({
        id: firstQuestionId,
        prompt: demoPolisData.comments[0].commentBody,
        type: 'binary',
        questionType: 'binary',
        sessionSlug: 'demo',
        sessionSlugExplicit: true,
        source: 'demo-polis-data',
        options: ['Agree', 'Unsure', 'Disagree'],
      }),
    );

    const firstQuestionResponses = Object.values(data.questionResponses[firstQuestionId] || {});
    expect(firstQuestionResponses.length).toBeGreaterThan(0);
    expect(firstQuestionResponses[0]).toEqual(
      expect.objectContaining({
        type: 'binary',
        questionId: firstQuestionId,
        questionID: firstQuestionId,
        answer: expect.objectContaining({
          encrypted: false,
        }),
        source: 'demo-polis-data',
      }),
    );
    expect(['Agree', 'Unsure', 'Disagree']).toContain(
      (firstQuestionResponses[0] as { answer?: { value?: unknown } })?.answer?.value,
    );
  });

  it('does not reinterpret tri-state sentiment as typed answers', () => {
    const data = buildPolisDemoSurveyResultsNetworkData();

    demoPolisData.comments.forEach((comment) => {
      const questionId = String(comment.commentId).toLowerCase();
      const question = data.questions[questionId] as Record<string, unknown>;
      const commentType = String(comment.type);

      if (commentType === 'binary') {
        expect(question).toMatchObject({
          type: 'binary',
          options: ['Agree', 'Unsure', 'Disagree'],
        });
        return;
      }

      expect(Object.keys(data.questionResponses[questionId] || {})).toHaveLength(0);
      if (commentType === 'poll') {
        expect(question).toMatchObject({
          type: 'multichoice',
          options: (comment as { options?: string[] }).options,
        });
      } else {
        expect(['rating', 'freeform']).toContain(question.type);
        expect(question.options).toBeUndefined();
      }
    });
  });

  it('stamps an explicit session slug when callers need a non-default demo bucket', () => {
    const data = buildPolisDemoSurveyResultsNetworkData(
      {
        comments: [
          {
            commentId: '0xABC',
            commentBody: 'Fixture question',
            type: 'binary',
          },
        ],
        participantsVotes: [
          {
            participant: '0x123',
            votes: { 0: 1 },
          },
        ],
      },
      { sessionSlug: 'demo-source' },
    );

    expect(data.questions['0xabc']).toEqual(
      expect.objectContaining({
        id: '0xabc',
        prompt: 'Fixture question',
        sessionSlug: 'demo-source',
        sessionSlugExplicit: true,
      }),
    );
    expect(data.questionResponses['0xabc']['0x123']).toEqual(
      expect.objectContaining({
        answer: { value: 'Agree', encrypted: false },
      }),
    );
  });

  it('normalizes canonical demo votes into Polis report aggregator rows', () => {
    const aggregator = buildPolisDemoSurveyResultsAggregatorData();
    const firstQuestionId = String(demoPolisData.comments[0].commentId).toLowerCase();
    const firstRows = aggregator[firstQuestionId] || [];

    expect(Object.keys(aggregator)).toHaveLength(binaryCommentIndexes.size);
    expect(firstRows.length).toBeGreaterThan(0);
    expect(firstRows[0]).toEqual(
      expect.objectContaining({
        responder: expect.any(String),
        questionId: firstQuestionId,
        response: expect.any(String),
      }),
    );
    const parsed = JSON.parse(firstRows[0].response);
    expect(['Agree', 'Unsure', 'Disagree']).toContain(parsed?.answer?.value);
  });

  describe('demo-2 typed responses', () => {
    const comments = demo2PolisData.comments as Array<Record<string, unknown>>;
    const questionIds = getDemoFixtureQuestionIdsByIndex('demo-2');
    const data = buildPolisDemoSurveyResultsNetworkData(demo2PolisData, {
      sessionSlug: 'demo-2',
      questionIdsByIndex: questionIds,
    });
    const findIndexByType = (type: string): number => comments.findIndex((comment) => comment.type === type);

    it('selects the demo-2 dataset and keys its simulated rows like the question fixtures', () => {
      const simulated = buildSimulatedDemoResultsNetworkData('demo-2');

      expect(simulated).not.toBeNull();
      expect(Object.keys(simulated?.questions || {})).toEqual(questionIds);
      expect(buildSimulatedDemoResultsNetworkData('demo-sh')).toBeNull();
      expect(Object.keys(buildPolisDemoSurveyResultsNetworkData(undefined, { sessionSlug: 'demo-2' }).questions)).toHaveLength(
        40,
      );
    });

    it('emits only valid per-question poll choices', () => {
      comments.forEach((comment, index) => {
        if (comment.type !== 'poll') return;
        const questionId = questionIds[index];
        const options = comment.options as string[];
        const responses = Object.values(data.questionResponses[questionId] || {});

        expect(data.questions[questionId]).toMatchObject({
          type: 'multichoice',
          questionType: 'multichoice',
          options,
        });
        expect(responses.length).toBeGreaterThan(0);
        responses.forEach((response) => {
          expect(response).toEqual(expect.objectContaining({ type: 'multichoice' }));
          expect(options).toContain((response as { answer?: { value?: unknown } }).answer?.value);
        });
      });
    });

    it('emits bounded ratings and freeform text without binary options', () => {
      const ratingIndex = findIndexByType('rating');
      const freeformIndex = findIndexByType('freeform');
      const ratingId = questionIds[ratingIndex];
      const freeformId = questionIds[freeformIndex];
      const scale = comments[ratingIndex].scale as { min: number; max: number };

      expect(data.questions[ratingId]).toMatchObject({ type: 'rating', scale });
      expect(data.questions[ratingId].options).toBeUndefined();
      Object.values(data.questionResponses[ratingId] || {}).forEach((response) => {
        const value = Number((response as { answer?: { value?: unknown } }).answer?.value);
        expect(value).toBeGreaterThanOrEqual(scale.min);
        expect(value).toBeLessThanOrEqual(scale.max);
      });

      expect(data.questions[freeformId]).toMatchObject({ type: 'freeform' });
      expect(data.questions[freeformId].options).toBeUndefined();
      Object.values(data.questionResponses[freeformId] || {}).forEach((response) => {
        expect(response).toEqual(expect.objectContaining({ type: 'freeform' }));
        expect(String((response as { answer?: { value?: unknown } }).answer?.value).trim()).not.toBe('');
      });
    });

    it('does not reinterpret a nonbinary vote when its typed response is missing', () => {
      const missingTyped = buildPolisDemoSurveyResultsNetworkData(
        {
          comments: [
            { commentId: 'poll', commentBody: 'Pick one', type: 'poll', options: ['A', 'B'] },
            { commentId: 'rating', commentBody: 'Rate it', type: 'rating', scale: { min: 0, max: 5 } },
            { commentId: 'freeform', commentBody: 'Explain it', type: 'freeform' },
          ],
          participantsVotes: [{ participant: '0xmissing', votes: { 0: 1, 1: 0, 2: -1 } }],
        },
        { sessionSlug: 'demo-2' },
      );

      expect(countQuestionResponses(missingTyped.questionResponses)).toBe(0);
    });

    it('preserves a zero-valued rating', () => {
      const zeroData = buildPolisDemoSurveyResultsNetworkData(
        {
          comments: [
            { commentId: 'zero-rating', commentBody: 'Rate from zero', type: 'rating', scale: { min: 0, max: 10 } },
          ],
          participantsVotes: [
            { participant: '0xzero', votes: { 0: -1 }, responses: { 0: { value: 0 } } },
          ],
        },
        { sessionSlug: 'demo-2' },
      );

      expect(zeroData.questionResponses['zero-rating']['0xzero']).toMatchObject({
        type: 'rating',
        answer: { value: '0', encrypted: false },
      });
    });

    it('rejects poll choices outside the question options and invalid ratings', () => {
      const invalidData = buildPolisDemoSurveyResultsNetworkData(
        {
          comments: [
            { commentId: 'poll', commentBody: 'Pick one', type: 'poll', options: ['A', 'B'] },
            { commentId: 'high-rating', commentBody: 'Rate it', type: 'rating', scale: { min: 1, max: 5 } },
            { commentId: 'nan-rating', commentBody: 'Rate again', type: 'rating', scale: { min: 1, max: 5 } },
          ],
          participantsVotes: [
            {
              participant: '0xinvalid',
              votes: { 0: 1, 1: 1, 2: -1 },
              responses: { 0: { value: 'C' }, 1: { value: 6 }, 2: { value: 'not-a-number' } },
            },
          ],
        },
        { sessionSlug: 'demo-2' },
      );

      expect(countQuestionResponses(invalidData.questionResponses)).toBe(0);
    });
  });
});
