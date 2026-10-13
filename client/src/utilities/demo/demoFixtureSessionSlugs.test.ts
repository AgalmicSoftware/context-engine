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
import { getDemoSessionMap } from '../session/sessionDemoCompat';

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

  // The slug lists stand in for the fixture data, so they must name exactly the
  // slugs the data covers: every listed slug has data, and every slug with data
  // is listed. Check each demo session slug and the extra route aliases.
  const knownSlugs = Array.from(
    new Set([
      ...DEMO_POLIS_DATASET_SLUGS,
      ...DEMO_QUESTION_FIXTURE_SLUGS,
      ...Object.entries(getDemoSessionMap() as Record<string, { slug?: string }>).flatMap(([key, config]) => [
        key,
        String(config?.slug || ''),
      ]),
      'demo',
      'demo-3',
      'edge',
      'democracy-2026',
    ]),
  ).filter(Boolean);
  const hasPolisDataset = (slug: string) => {
    const fallback = { source: 'none' };
    return resolveDemoPolisDataset(slug, fallback) !== fallback;
  };
  const hasQuestionData = (slug: string) => getDemoFixtureQuestionIdsByIndex(slug).length > 0;

  it('lists exactly the slugs that have a Polis dataset', () => {
    knownSlugs.forEach((slug) => {
      expect({ slug, hasData: hasPolisDataset(slug) }).toEqual({
        slug,
        hasData: DEMO_POLIS_DATASET_SLUGS.includes(slug),
      });
    });
    expect(resolveDemoPolisDataset('demo-2')).not.toBe(resolveDemoPolisDataset('demo'));
  });

  it('lists exactly the slugs that have question fixtures', () => {
    knownSlugs.forEach((slug) => {
      expect({ slug, listed: hasDemoQuestionFixtures(slug), hasData: hasQuestionData(slug) }).toEqual({
        slug,
        listed: DEMO_QUESTION_FIXTURE_SLUGS.includes(slug),
        hasData: DEMO_QUESTION_FIXTURE_SLUGS.includes(slug),
      });
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
