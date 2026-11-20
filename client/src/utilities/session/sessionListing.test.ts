import { KNOWN_SESSION_CONFIGS, KNOWN_SESSIONS } from './knownSessionsFile';
import { getDemoSessionConfigForDisplay } from './sessionSourceResolver';
import { buildCommunitySessionCatalog } from './sessionCatalog';
import {
  buildSessionListOptions,
  isListedSession,
  RETIRED_SESSION_SLUGS,
  sessionListLabel,
  UNLISTED_SESSION_PATTERNS,
} from './sessionListing';

// Slugs from the live session registry and the bundled demos, 19 Nov 2026.
const TEST_RUN_SLUGS = [
  'cloudflare-wg-20260825-180530',
  'cloudflare-ge-cl-ge-mvhak3wh',
  'cloudflare-kl-20260712-194430',
  'e2e-admin-gate-20261106-174339-06-nov-2026-05-43-pm',
  'e2e-custom-20260702-234338',
  'live-gates-mvhf6mkw',
  'ce-mod-session-setup-20260710-l2-sponsored-a3',
  'demo-sh',
  'demo-interview',
  'demo-1',
  'telegram-demo',
  'telegram-demo-4',
  'dweb-demo',
];

const LISTED = ['eddy26', 'rxc-ra-2', 'rxc-ra-test-5', 'rxc-ra-agent-test-1'];

describe('session listing', () => {
  it('leaves test runs and older demos off, and keeps sessions people take part in', () => {
    expect(TEST_RUN_SLUGS.filter(isListedSession)).toEqual([]);
    expect([...LISTED, 'town-hall', 'demo-2', 'cloudflare', 'my-e2e-review', 'demo'].every(isListedSession)).toBe(true);
    expect(isListedSession('')).toBe(false);
    expect(UNLISTED_SESSION_PATTERNS.length).toBeLessThanOrEqual(8);
  });

  it('shows the known sessions under their titles, with the slug', () => {
    const names: Record<string, string> = { eddy26: 'EDDY 2026 - Bridging theory and practice' };
    expect(LISTED.map((slug) => sessionListLabel(slug, names[slug] || 'Reverse Alignment'))).toEqual([
      'EDDY 2026 - Bridging theory and practice (eddy26)',
      'Reverse Alignment Salon (rxc-ra-2)',
      'RA test (rxc-ra-test-5)',
      'RA agent test (rxc-ra-agent-test-1)',
    ]);
    expect(sessionListLabel('town-hall', 'Town Hall')).toBe('Town Hall (town-hall)');
    expect(sessionListLabel('town-hall')).toBe('town-hall');
    expect(sessionListLabel('')).toBe('General');
  });

  it('orders EDDY, the salon, the test sessions, then everything else by name', () => {
    const options = buildSessionListOptions({
      slugs: ['zeta', 'rxc-ra-agent-test-1', '', ...TEST_RUN_SLUGS, 'rxc-ra-test-5', 'alpha', 'rxc-ra-2', 'eddy26'],
      nameOf: (slug) => (slug === 'zeta' ? 'Aardvark' : ''),
    });
    expect(options.map(({ slug }) => slug)).toEqual([...LISTED, 'zeta', 'alpha']);
  });

  it('leaves the retired trial sessions off every list, and nothing that only looks like them', () => {
    expect(RETIRED_SESSION_SLUGS).toEqual(['rxc-ra-test', 'rxc-test']);
    expect(RETIRED_SESSION_SLUGS.some(isListedSession)).toBe(false);
    expect(
      [
        'rxc-ra-test-5',
        'rxc-ra-test-6',
        'rxc-ra-2',
        'rxc-ra-agent-test-1',
        'my-rxc-ra-test',
        'rxc-test-2',
        'my-rxc-test',
        'rxc-tests',
        'rxc',
      ].every(isListedSession),
    ).toBe(true);
    const options = buildSessionListOptions({
      slugs: ['rxc-ra-test', 'rxc-test', 'rxc-ra-agent-test-1', 'rxc-ra-2', 'eddy26'],
    });
    expect(options.map(({ slug }) => slug)).toEqual(['eddy26', 'rxc-ra-2', 'rxc-ra-agent-test-1']);
    // Opened from its own link it is the current choice, and shows while it is.
    expect(
      buildSessionListOptions({ slugs: ['rxc-ra-test', 'rxc-ra-2'], keep: ['rxc-ra-test'] }).map(({ slug }) => slug),
    ).toEqual(['rxc-ra-2', 'rxc-ra-test']);
  });

  it('keeps the current choice, even General or a session left off', () => {
    const slugs = ['', 'eddy26', 'cloudflare-wg-20260825-180530'];
    expect(buildSessionListOptions({ slugs, keep: [''] }).map(({ label }) => label)).toEqual(['General', 'eddy26']);
    expect(buildSessionListOptions({ slugs, keep: ['cloudflare-wg-20260825-180530'] }).map(({ slug }) => slug)).toEqual(
      ['eddy26', 'cloudflare-wg-20260825-180530'],
    );
  });

  it('does not move the known sessions when a later source adds more', () => {
    const first = buildSessionListOptions({ slugs: ['', ...LISTED] });
    const later = buildSessionListOptions({ slugs: ['', ...LISTED, 'new-session', ...TEST_RUN_SLUGS] });
    expect(later.slice(0, first.length)).toEqual(first);
    expect(buildSessionListOptions({ slugs: ['', ...LISTED, ...TEST_RUN_SLUGS] })).toEqual(first);
  });

  it('still opens sessions it leaves off, and the agent test from a normal link', () => {
    expect(KNOWN_SESSION_CONFIGS['demo-sh']).toMatchObject({ slug: 'demo-sh', workerCanonicalCleanRoute: true });
    expect(getDemoSessionConfigForDisplay('demo-interview')).toMatchObject({
      slug: 'demo-interview',
      corsWorkerUrl: expect.stringMatching(/^https:\/\/ce-demo-interview-/),
    });
    expect(KNOWN_SESSION_CONFIGS['rxc-ra-agent-test-1']).toMatchObject({
      sessionId: KNOWN_SESSIONS['rxc-ra-agent-test-1'].sessionId,
      corsWorkerUrl: 'https://ce-rxc-ra-agent-test-1.agalmic.workers.dev',
      workerCanonicalCleanRoute: true,
    });
    // The catalog behind the lists still describes a hidden session and its link.
    const [entry] = buildCommunitySessionCatalog({
      entries: [['cloudflare-wg-20260825-180530', { slug: 'cloudflare-wg-20260825-180530', sessionName: 'Test' }]],
    });
    expect(entry).toMatchObject({
      slug: 'cloudflare-wg-20260825-180530',
      href: '/session/cloudflare-wg-20260825-180530',
    });
  });

  it('gives display titles only to the salon and the two test sessions', () => {
    expect(
      Object.entries(KNOWN_SESSIONS)
        .filter(([, { title }]) => title)
        .map(([slug]) => slug),
    ).toEqual(['rxc-ra-2', 'rxc-ra-test-5', 'rxc-ra-agent-test-1']);
  });
});
