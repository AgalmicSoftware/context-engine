import {
  DEMO_POLIS_DATASET_SLUGS,
  DEMO_QUESTION_FIXTURE_SLUGS,
  hasDemoAnalysisFixture,
  hasDemoQuestionFixtures,
  hasSimulatedDemoResponses,
  usesDemoSessionFixtures,
} from './demoFixtureSessionSlugs';
import { resolveDemoPolisDataset } from './demoPolisDatasets';
import { getDemoFixtureQuestionIdsByIndex } from '../session/demoSessionQuestionFixtures';

const LEGACY_DEMO_SLUGS = ['demo', 'demo-1', 'demo-3', 'demo-sh'];

describe('demoFixtureSessionSlugs', () => {
  it('keeps typed simulated responses exclusive to demo-2', () => {
    expect(hasSimulatedDemoResponses('demo-2')).toBe(true);
    [...LEGACY_DEMO_SLUGS, 'unknown-demo'].forEach((slug) => {
      expect(hasSimulatedDemoResponses(slug)).toBe(false);
    });
  });

  it('uses the legacy analysis fixture for legacy slugs but not demo-2', () => {
    LEGACY_DEMO_SLUGS.forEach((slug) => {
      expect(hasDemoAnalysisFixture(slug)).toBe(true);
    });
    expect(hasDemoAnalysisFixture('demo-2')).toBe(false);
    expect(hasDemoAnalysisFixture('unknown-demo')).toBe(false);
  });

  // The slug lists stand in for the fixture data, so they must name exactly
  // the slugs the data covers.
  it('lists exactly the slugs that have a Polis dataset', () => {
    const fallback = { source: 'none' };
    DEMO_POLIS_DATASET_SLUGS.forEach((slug) => {
      expect(resolveDemoPolisDataset(slug, fallback)).not.toBe(fallback);
    });
    ['demo-interview', 'democracy-2026', 'edge'].forEach((slug) => {
      expect(resolveDemoPolisDataset(slug, fallback)).toBe(fallback);
    });
  });

  it('lists exactly the slugs that have question fixtures', () => {
    DEMO_QUESTION_FIXTURE_SLUGS.forEach((slug) => {
      expect(hasDemoQuestionFixtures(slug)).toBe(true);
      expect(getDemoFixtureQuestionIdsByIndex(slug).length).toBeGreaterThan(0);
    });
    ['demo', 'demo-3', 'edge'].forEach((slug) => {
      expect(hasDemoQuestionFixtures(slug)).toBe(false);
      expect(getDemoFixtureQuestionIdsByIndex(slug)).toEqual([]);
    });
  });

  it('marks only demo fixture sessions as needing the fixtures', () => {
    expect(usesDemoSessionFixtures('edge', '')).toBe(false);
    expect(usesDemoSessionFixtures('democracy-2026')).toBe(false);
    expect(usesDemoSessionFixtures('edge', 'demo-2')).toBe(true);
    expect(usesDemoSessionFixtures('demo-interview')).toBe(true);
    expect(usesDemoSessionFixtures('demo')).toBe(true);
  });
});
