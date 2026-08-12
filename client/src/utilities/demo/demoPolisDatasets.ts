// Demo Polis fixture selection stays centralized here so session and results
// surfaces agree on which slugs use generated data and analysis overlays.

import demoPolisData from '../../variables/demo/demo_polis_data.json';
import demo2PolisData from '../../variables/demo/demo_2_polis_data.json';
import { normalizeSessionSlug } from '../session/sessionNaming.js';

const DEMO_POLIS_DATASETS_BY_SLUG: Readonly<Record<string, unknown>> = Object.freeze({
  demo: demoPolisData,
  'demo-1': demoPolisData,
  'demo-2': demo2PolisData,
  'demo-3': demoPolisData,
  'demo-sh': demoPolisData,
});

const DEMO_SIMULATED_RESPONSE_SLUGS = Object.freeze(['demo-2']);

// demo-sh's published Worker uses this one historical option set for every
// legacy poll. Keep the mirror exact until that Worker is deliberately reseeded.
export const LEGACY_DEMO_POLL_OPTIONS = Object.freeze([
  'Technical researchers',
  'AI developers and labs',
  'Governments and regulators',
  'The general public',
  'Affected communities',
]);

// The checked-in analysis fixture is derived from the legacy demo dataset.
// demo-2 remains excluded until it has a matching analysis fixture.
const DEMO_ANALYSIS_FIXTURE_SLUGS = Object.freeze([
  'demo',
  'demo-1',
  'demo-3',
  'demo-sh',
]);

export const resolveDemoPolisDataset = (
  slugIn: unknown,
  fallback: unknown = demoPolisData
): unknown => {
  const slug = normalizeSessionSlug(slugIn);
  return DEMO_POLIS_DATASETS_BY_SLUG[slug] || fallback;
};

export const hasSimulatedDemoResponses = (slugIn: unknown): boolean => (
  DEMO_SIMULATED_RESPONSE_SLUGS.includes(normalizeSessionSlug(slugIn))
);

export const hasDemoAnalysisFixture = (slugIn: unknown): boolean => (
  DEMO_ANALYSIS_FIXTURE_SLUGS.includes(normalizeSessionSlug(slugIn))
);
