import { normalizeSessionSlug } from '../session/sessionNaming.js';

// Which sessions read the checked-in demo fixtures. These checks are cheap;
// the fixture data is large, so session routes load it only for these slugs.
// The fixture modules build their slug maps from these lists.

// Slugs with a Polis dataset (see demoPolisDatasets).
export const DEMO_POLIS_DATASET_SLUGS: readonly string[] = Object.freeze([
  'demo',
  'demo-1',
  'demo-2',
  'demo-3',
  'demo-sh',
]);
// Slugs with temporary question fixtures (see demoSessionQuestionFixtures).
export const DEMO_QUESTION_FIXTURE_SLUGS: readonly string[] = Object.freeze([
  'demo-1',
  'demo-2',
  'demo-sh',
  'demo-interview',
]);

const DEMO_SIMULATED_RESPONSE_SLUGS = Object.freeze(['demo-2']);

// The checked-in Breakdown fixture is derived from the legacy demo dataset.
// demo-2's Polis cluster summaries are separate; keep Breakdown hidden until
// demo-2 has a matching Breakdown fixture.
const DEMO_ANALYSIS_FIXTURE_SLUGS = Object.freeze(['demo', 'demo-1', 'demo-3', 'demo-sh']);

export const hasSimulatedDemoResponses = (slugIn: unknown): boolean =>
  DEMO_SIMULATED_RESPONSE_SLUGS.includes(normalizeSessionSlug(slugIn));

export const hasDemoAnalysisFixture = (slugIn: unknown): boolean =>
  DEMO_ANALYSIS_FIXTURE_SLUGS.includes(normalizeSessionSlug(slugIn));

export const hasDemoQuestionFixtures = (slugIn: unknown): boolean =>
  DEMO_QUESTION_FIXTURE_SLUGS.includes(normalizeSessionSlug(slugIn));

/** Whether any of these session slugs reads demo fixture data. */
export const usesDemoSessionFixtures = (...slugs: unknown[]): boolean =>
  slugs.some((slugIn) => {
    const slug = normalizeSessionSlug(slugIn);
    return !!slug && (DEMO_POLIS_DATASET_SLUGS.includes(slug) || DEMO_QUESTION_FIXTURE_SLUGS.includes(slug));
  });
