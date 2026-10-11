import {
  getLoadedDemoSessionFixtures,
  loadDemoSessionFixtures,
  loadTemporaryDemoSessionQuestionFixtures,
  resolveLoadedPolisDemoQuestionPool,
  shouldUseBuiltInPolisDemoQuestionPool,
} from './demoSessionFixtureLoader';

describe('demoSessionFixtureLoader before the fixtures load', () => {
  it('serves no demo questions until the fixture chunk has loaded', () => {
    jest.isolateModules(() => {
      // A fresh copy of the loader has not loaded the fixtures yet.
      const freshLoader = jest.requireActual<typeof import('./demoSessionFixtureLoader')>('./demoSessionFixtureLoader');
      expect(freshLoader.getLoadedDemoSessionFixtures()).toBeNull();
      expect(freshLoader.resolveLoadedPolisDemoQuestionPool({ displaySlug: 'demo', sourceSlug: '' })).toEqual([]);
    });
  });

  it('never loads the fixtures for a session without them', async () => {
    await expect(loadTemporaryDemoSessionQuestionFixtures('edge')).resolves.toEqual([]);
    await expect(loadTemporaryDemoSessionQuestionFixtures('democracy-2026')).resolves.toEqual([]);
    expect(getLoadedDemoSessionFixtures()).toBeNull();
  });
});

describe('demoSessionFixtureLoader', () => {
  beforeAll(() => loadDemoSessionFixtures());

  it('loads the fixtures once and keeps them', async () => {
    const fixtures = getLoadedDemoSessionFixtures();
    expect(fixtures).not.toBeNull();
    await expect(loadDemoSessionFixtures()).resolves.toBe(fixtures);
  });

  it('loads temporary demo questions for demo fixture slugs', async () => {
    const questions = await loadTemporaryDemoSessionQuestionFixtures('demo-1');
    expect(questions.length).toBeGreaterThan(0);
    expect(questions[0]).toEqual(expect.objectContaining({ sessionSlug: 'demo-1' }));
  });

  it('only resolves the built-in fixture for the display demo route backed by the default source', () => {
    expect(
      shouldUseBuiltInPolisDemoQuestionPool({
        displaySlug: 'demo',
        sourceSlug: '',
      }),
    ).toBe(true);
    expect(
      resolveLoadedPolisDemoQuestionPool({
        displaySlug: 'demo',
        sourceSlug: '',
      }),
    ).toHaveLength(42);

    expect(
      resolveLoadedPolisDemoQuestionPool({
        displaySlug: 'demo',
        sourceSlug: 'demo',
      }),
    ).toEqual([]);
    expect(
      resolveLoadedPolisDemoQuestionPool({
        displaySlug: 'edge',
        sourceSlug: '',
      }),
    ).toEqual([]);
    expect(
      resolveLoadedPolisDemoQuestionPool({
        displaySlug: 'demo-2',
        sourceSlug: 'demo-2',
        pathname: '/session/demo-2/questions',
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
      resolveLoadedPolisDemoQuestionPool({
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
      resolveLoadedPolisDemoQuestionPool({
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
      resolveLoadedPolisDemoQuestionPool({
        displaySlug: '',
        sourceSlug: 'demo',
        pathname: '/session/demo/questions/results',
      }),
    ).toHaveLength(42);
  });
});
