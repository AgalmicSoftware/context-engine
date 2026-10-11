import demoPolisData from '../../variables/demo/demo_polis_data.json';
import { LEGACY_DEMO_POLL_OPTIONS } from '../../utilities/demo/demoQuestionSemantics';
import { buildPolisDemoQuestionPool } from './surveyPolisDemoQuestionPool.js';

describe('surveyPolisDemoQuestionPool', () => {
  it('normalizes the canonical Polis demo comments into question rows', () => {
    const pool = buildPolisDemoQuestionPool();

    expect(pool).toHaveLength(demoPolisData.comments.length);
    expect(pool).toHaveLength(42);
    expect(pool[0]).toEqual(
      expect.objectContaining({
        id: String(demoPolisData.comments[0].commentId).toLowerCase(),
        prompt: demoPolisData.comments[0].commentBody,
        type: demoPolisData.comments[0].type,
        source: 'demo-polis-data',
        category: demoPolisData.comments[0].category,
        nodeId: demoPolisData.comments[0].nodeId,
      }),
    );
  });

  it('preserves typed question metadata and the legacy Worker poll choices', () => {
    const pool = buildPolisDemoQuestionPool();
    const comments = demoPolisData.comments as Array<{
      type: string;
      options?: string[];
    }>;

    comments.forEach((comment, index) => {
      const question = pool[index];
      if (comment.type === 'poll') {
        expect(question).toMatchObject({
          type: 'multichoice',
          options: LEGACY_DEMO_POLL_OPTIONS,
          singleSelect: true,
        });
        expect(new Set(question.options?.map((option) => String(option).toLowerCase())).size).toBe(
          question.options?.length,
        );
        expect(question.options?.length).toBeGreaterThanOrEqual(2);
      } else {
        expect(question.type).toBe(comment.type);
        expect(question.options).toBeUndefined();
      }
    });
  });

  it('supports source slug stamping when callers need cache-bucket identity', () => {
    expect(
      buildPolisDemoQuestionPool(
        {
          comments: [
            {
              commentId: '0xABC',
              commentBody: 'Fixture question',
              type: 'binary',
            },
          ],
        },
        { sessionSlug: 'demo-source' },
      ),
    ).toEqual([
      expect.objectContaining({
        id: '0xabc',
        prompt: 'Fixture question',
        sessionSlug: 'demo-source',
      }),
    ]);
  });
});
