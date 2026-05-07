import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectSelectedSessionSlugs,
  normalizeConfiguredSessions,
  normalizeActiveSessions,
} from '../public/js/sessionSlugs.mjs';

describe('public auth session selection', () => {
  it('preserves the default session empty slug in the multi-select picker', () => {
    assert.deepEqual(collectSelectedSessionSlugs([
      { dataset: { slug: '' } },
      { dataset: { slug: 'edge' } },
    ]), ['', 'edge']);
  });

  it('keeps the default session as an active session when it is the current session', () => {
    assert.deepEqual(normalizeActiveSessions({ currentSession: '' }), ['']);
  });

  it('keeps default-session selections when the selected-session list contains an empty slug', () => {
    assert.deepEqual(normalizeActiveSessions({ selectedSessions: ['', 'edge'] }), ['', 'edge']);
  });

  it('preserves explicit default-session selections in persisted config arrays', () => {
    assert.deepEqual(
      normalizeConfiguredSessions({ selectedSessions: ['', 'edge'], defaultSession: 'ignored' }),
      ['', 'edge'],
    );
    assert.deepEqual(
      normalizeConfiguredSessions({ selectedSessions: [], defaultSession: 'edge' }),
      ['edge'],
    );
    assert.deepEqual(
      normalizeConfiguredSessions({ selectedSessions: [], defaultSession: '' }),
      [''],
    );
  });
});
