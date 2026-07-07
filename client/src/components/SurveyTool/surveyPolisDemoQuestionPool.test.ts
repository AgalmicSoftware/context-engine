import demoPolisData from '../../variables/demo/demo_polis_data.json';
import {
  buildPolisDemoQuestionPool,
  resolvePolisDemoQuestionPool,
  shouldUseBuiltInPolisDemoQuestionPool,
} from './surveyPolisDemoQuestionPool.js';

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

  it('only resolves the built-in fixture for the display demo route backed by the default source', () => {
    expect(
      shouldUseBuiltInPolisDemoQuestionPool({
        displaySlug: 'demo',
        sourceSlug: '',
      }),
    ).toBe(true);
    expect(
      resolvePolisDemoQuestionPool({
        displaySlug: 'demo',
        sourceSlug: '',
      }),
    ).toHaveLength(42);

    expect(
      resolvePolisDemoQuestionPool({
        displaySlug: 'demo',
        sourceSlug: 'demo',
      }),
    ).toEqual([]);
    expect(
      resolvePolisDemoQuestionPool({
        displaySlug: 'edge',
        sourceSlug: '',
      }),
    ).toEqual([]);
  });

  it('recognizes /session/demo after route source aliasing clears the display slug', () => {
    expect(
      shouldUseBuiltInPolisDemoQuestionPool({
        displaySlug: '',
        sourceSlug: '',
        pathname: '/session/demo',
      }),
    ).toBe(true);
    expect(
      resolvePolisDemoQuestionPool({
        displaySlug: '',
        sourceSlug: '',
        pathname: '/session/demo',
      }),
    ).toHaveLength(42);
  });

  it('keeps /session/demo on the built-in fixture when routing resolves the source slug to demo', () => {
    expect(
      shouldUseBuiltInPolisDemoQuestionPool({
        displaySlug: '',
        sourceSlug: 'demo',
        pathname: '/session/demo',
      }),
    ).toBe(true);
    expect(
      resolvePolisDemoQuestionPool({
        displaySlug: '',
        sourceSlug: 'demo',
        pathname: '/session/demo',
      }),
    ).toHaveLength(42);
  });

  it('keeps /session/demo question subroutes on the built-in fixture', () => {
    expect(
      shouldUseBuiltInPolisDemoQuestionPool({
        displaySlug: '',
        sourceSlug: 'demo',
        pathname: '/session/demo/questions',
      }),
    ).toBe(true);
    expect(
      resolvePolisDemoQuestionPool({
        displaySlug: '',
        sourceSlug: 'demo',
        pathname: '/session/demo/questions/results',
      }),
    ).toHaveLength(42);
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
