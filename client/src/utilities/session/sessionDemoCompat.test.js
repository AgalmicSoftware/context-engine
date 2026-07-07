import demoSessions from '../../variables/demo/demo_sessions.json';
import {
  canonicalizeLegacySessionAlias,
  getBaselineDemoPlaceholderSlugs,
  getBaselineDemoSessionSlugs,
  getDemoTemplateSeed,
  getReservedLegacySessionSlugs,
  isReservedLegacySessionSlug,
} from './sessionDemoCompat.js';

describe('sessionDemoCompat', () => {
  it('canonicalizes the general alias and preserves non-alias slugs', () => {
    expect(canonicalizeLegacySessionAlias('debate')).toBe('debate');
    expect(canonicalizeLegacySessionAlias('general')).toBe('');
    expect(canonicalizeLegacySessionAlias('anything-else')).toBe('anything-else');
  });

  it('returns the reserved legacy session slug set', () => {
    const reserved = getReservedLegacySessionSlugs();

    expect(reserved).toBeInstanceOf(Set);
    expect([...reserved]).toEqual(['general']);
  });

  it('checks reserved legacy session slugs', () => {
    expect(isReservedLegacySessionSlug('general')).toBe(true);
    expect(isReservedLegacySessionSlug('my-session')).toBe(false);
  });

  it('returns baseline demo session slugs for every demo session entry', () => {
    const slugs = getBaselineDemoSessionSlugs();

    expect(slugs).toHaveLength(Object.keys(demoSessions).length);
    expect(slugs.every((slug) => typeof slug === 'string')).toBe(true);
  });

  it('returns baseline demo placeholder slugs without the default session alias', () => {
    const slugs = getBaselineDemoSessionSlugs();
    const placeholderSlugs = getBaselineDemoPlaceholderSlugs();

    expect(placeholderSlugs).toEqual(slugs.filter((slug) => slug !== ''));
    expect(placeholderSlugs).not.toContain('');
  });

  it('returns the merged wizard base template seed with expected shape', () => {
    const seed = getDemoTemplateSeed('wizardBase');

    expect(seed).not.toBeNull();
    expect(seed).toEqual(expect.any(Object));
    expect(seed).toEqual(
      expect.objectContaining({
        sessionName: demoSessions.general.sessionName,
        contracts: demoSessions.general.contracts,
        ai: expect.objectContaining({
          reasoningEffort: 'low',
          models: expect.objectContaining({
            fast: expect.objectContaining({ provider: 'openai', model: 'gpt-4o-mini' }),
            thinking: expect.objectContaining({ provider: 'openai', model: 'gpt-4o-mini' }),
            transcription: expect.objectContaining({ provider: 'openai', model: 'whisper-1' }),
          }),
        }),
      }),
    );
  });

  it('returns an empty result for an unknown template seed', () => {
    const seed = getDemoTemplateSeed('nonexistent');

    expect(seed == null || Object.keys(seed).length === 0).toBe(true);
  });

  it('returns a cloned wizard base template seed', () => {
    const seed = getDemoTemplateSeed('wizardBase');
    const originalModel = demoSessions.general.ai.models.fast.model;
    const originalContracts = demoSessions.general.contracts;

    expect(seed.ai).not.toBe(demoSessions.general.ai);
    expect(seed.contracts).not.toBe(demoSessions.general.contracts);

    seed.ai.models.fast.model = 'gpt-test';
    seed.contracts.surveys = { address: '0x123' };

    expect(demoSessions.general.ai.models.fast.model).toBe(originalModel);
    expect(demoSessions.general.contracts).toBe(originalContracts);
  });
});
