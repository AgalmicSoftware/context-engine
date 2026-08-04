import { buildCommunityBeeswarmPointsFromResults } from './communityBeeswarmPoints';

describe('community beeswarm point shaping', () => {
  it('maps divisiveness results and includes unsure votes in totals', () => {
    expect(
      buildCommunityBeeswarmPointsFromResults({
        questions: [{ label: 'Shared prompt', questionId: 'q1' }],
        ratingMatrix: [[1, 0, -1]],
        results: [{ agrees: 1, commentIndex: 0, disagrees: 1, divisiveness: 1 }],
      }),
    ).toEqual([
      {
        agrees: 1,
        disagrees: 1,
        index: 0,
        label: 'Shared prompt',
        questionId: 'q1',
        total: 3,
        unsure: 1,
        value: 1,
      },
    ]);
  });

  it('uses stable fallbacks and ignores malformed result indexes', () => {
    expect(
      buildCommunityBeeswarmPointsFromResults({
        ratingMatrix: [[]],
        results: [{ agrees: 0, commentIndex: 0, disagrees: 0, divisiveness: 0 }, { commentIndex: 'invalid' }],
      }),
    ).toEqual([
      expect.objectContaining({
        index: 0,
        label: '(No prompt)',
        questionId: '0',
        total: 0,
      }),
    ]);
  });
});
