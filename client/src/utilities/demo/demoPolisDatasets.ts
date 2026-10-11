// Demo Polis fixture selection stays centralized here so session and results
// surfaces agree on which slugs use generated data. The slug checks live in
// demoFixtureSessionSlugs, so callers can test a slug without loading the data.

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

export const resolveDemoPolisDataset = (slugIn: unknown, fallback: unknown = demoPolisData): unknown => {
  const slug = normalizeSessionSlug(slugIn);
  return DEMO_POLIS_DATASETS_BY_SLUG[slug] || fallback;
};
