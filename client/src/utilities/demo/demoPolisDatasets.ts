// Demo Polis fixture selection stays centralized here so session and results
// surfaces agree on which slugs use generated data. The slugs come from
// demoFixtureSessionSlugs, so callers can test a slug without loading the data.

import demoPolisData from '../../variables/demo/demo_polis_data.json';
import demo2PolisData from '../../variables/demo/demo_2_polis_data.json';
import { normalizeSessionSlug } from '../session/sessionNaming.js';
import { DEMO_POLIS_DATASET_SLUGS } from './demoFixtureSessionSlugs';

// demo-2 has its own dataset; the other listed slugs share the original one.
const DEMO_POLIS_DATASETS_BY_SLUG: Readonly<Record<string, unknown>> = Object.freeze(
  Object.fromEntries(
    DEMO_POLIS_DATASET_SLUGS.map((slug) => [slug, slug === 'demo-2' ? demo2PolisData : demoPolisData]),
  ),
);

export const resolveDemoPolisDataset = (slugIn: unknown, fallback: unknown = demoPolisData): unknown => {
  const slug = normalizeSessionSlug(slugIn);
  return DEMO_POLIS_DATASETS_BY_SLUG[slug] || fallback;
};
