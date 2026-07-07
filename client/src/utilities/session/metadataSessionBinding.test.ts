import { getSessionSlugByName } from '../web3/sessionConfigResolvers.js';
import { normalizeSessionSlug } from './sessionNaming.js';
import {
  buildMetadataSessionCacheEnvelope,
  resolveMetadataSessionBinding,
  resolveMetadataSessionSlug,
  resolveScopedMetadataSessionSlug,
} from './metadataSessionBinding.js';

jest.mock('../web3/sessionConfigResolvers.js', () => {
  const actual = jest.requireActual('../web3/sessionConfigResolvers.js');
  return {
    __esModule: true,
    ...actual,
    getSessionSlugByName: jest.fn(),
  };
});

const mockGetSessionSlugByName = getSessionSlugByName as jest.MockedFunction<typeof getSessionSlugByName>;

describe('metadataSessionBinding', () => {
  beforeEach(() => {
    mockGetSessionSlugByName.mockReset();
    mockGetSessionSlugByName.mockReturnValue(null);
  });

  describe('resolveMetadataSessionBinding', () => {
    it('uses an explicit sessionSlug field with explicit authority', () => {
      expect(
        resolveMetadataSessionBinding(
          {
            sessionSlug: ' edge ',
          },
          'fallback',
        ),
      ).toEqual({
        sessionSlug: normalizeSessionSlug('edge'),
        authority: 'explicit',
      });
    });

    it('uses an explicit slug field with explicit authority', () => {
      expect(
        resolveMetadataSessionBinding(
          {
            slug: ' debate ',
          },
          'fallback',
        ),
      ).toEqual({
        sessionSlug: normalizeSessionSlug('debate'),
        authority: 'explicit',
      });
    });

    it('ignores slug fields when sessionSlugExplicit is false and falls back to the session name', () => {
      mockGetSessionSlugByName.mockReturnValue('named-session');

      expect(
        resolveMetadataSessionBinding(
          {
            sessionSlugExplicit: false,
            sessionSlug: 'explicit-session',
            slug: 'explicit-slug',
            sessionName: 'Named Session',
          },
          'fallback',
        ),
      ).toEqual({
        sessionSlug: normalizeSessionSlug('named-session'),
        authority: 'name',
      });

      expect(mockGetSessionSlugByName).toHaveBeenCalledWith('Named Session');
    });

    it('treats a slug field as authoritative when the explicit flag is absent', () => {
      expect(
        resolveMetadataSessionBinding(
          {
            slug: 'alpha-session',
          },
          'fallback',
        ),
      ).toEqual({
        sessionSlug: normalizeSessionSlug('alpha-session'),
        authority: 'explicit',
      });
    });

    it('falls back to the resolved session name when lookup succeeds', () => {
      mockGetSessionSlugByName.mockReturnValue('edge-session');

      expect(
        resolveMetadataSessionBinding(
          {
            sessionName: 'Edge Session',
          },
          'fallback',
        ),
      ).toEqual({
        sessionSlug: normalizeSessionSlug('edge-session'),
        authority: 'name',
      });
    });

    it('falls back to the provided fallback slug when the session name lookup misses', () => {
      mockGetSessionSlugByName.mockReturnValue(null);

      expect(
        resolveMetadataSessionBinding(
          {
            sessionName: 'Missing Session',
          },
          'fallback-session',
        ),
      ).toEqual({
        sessionSlug: normalizeSessionSlug('fallback-session'),
        authority: 'fallback',
      });
    });

    it('returns fallback authority for null, undefined, and empty metadata inputs', () => {
      expect(resolveMetadataSessionBinding(null, 'fallback-session')).toEqual({
        sessionSlug: normalizeSessionSlug('fallback-session'),
        authority: 'fallback',
      });

      expect(resolveMetadataSessionBinding(undefined, 'fallback-session')).toEqual({
        sessionSlug: normalizeSessionSlug('fallback-session'),
        authority: 'fallback',
      });

      expect(resolveMetadataSessionBinding({}, 'fallback-session')).toEqual({
        sessionSlug: normalizeSessionSlug('fallback-session'),
        authority: 'fallback',
      });
    });

    it('returns fallback authority for non-object metadata', () => {
      expect(resolveMetadataSessionBinding(42, 'fallback-session')).toEqual({
        sessionSlug: normalizeSessionSlug('fallback-session'),
        authority: 'fallback',
      });
    });

    it('skips blank explicit slug candidates and continues to the next candidate', () => {
      expect(
        resolveMetadataSessionBinding(
          {
            sessionSlug: '   ',
            slug: 'edge-session',
          },
          'fallback',
        ),
      ).toEqual({
        sessionSlug: normalizeSessionSlug('edge-session'),
        authority: 'explicit',
      });
    });
  });

  describe('resolveMetadataSessionSlug', () => {
    it('returns only the resolved session slug', () => {
      mockGetSessionSlugByName.mockReturnValue('edge-session');

      expect(
        resolveMetadataSessionSlug(
          {
            sessionName: 'Edge Session',
          },
          'fallback-session',
        ),
      ).toBe(normalizeSessionSlug('edge-session'));
    });
  });

  describe('resolveScopedMetadataSessionSlug', () => {
    it('returns the slug for explicit authority', () => {
      expect(
        resolveScopedMetadataSessionSlug(
          {
            sessionSlug: 'edge-session',
          },
          'fallback-session',
        ),
      ).toBe(normalizeSessionSlug('edge-session'));
    });

    it('returns the slug for name authority', () => {
      mockGetSessionSlugByName.mockReturnValue('named-session');

      expect(
        resolveScopedMetadataSessionSlug(
          {
            sessionName: 'Named Session',
          },
          'fallback-session',
        ),
      ).toBe(normalizeSessionSlug('named-session'));
    });

    it('returns an empty string for fallback authority', () => {
      expect(resolveScopedMetadataSessionSlug({}, 'fallback-session')).toBe('');
    });
  });

  describe('buildMetadataSessionCacheEnvelope', () => {
    it('clones metadata without mutating the input and returns the envelope fields', () => {
      mockGetSessionSlugByName.mockReturnValue('named-session');
      const input = {
        sessionName: 'Named Session',
        note: 'preserve me',
      };

      const result = buildMetadataSessionCacheEnvelope(input, 'fallback-session');

      expect(result).toEqual({
        metadata: {
          sessionName: 'Named Session',
          note: 'preserve me',
          sessionSlug: normalizeSessionSlug('named-session'),
          sessionSlugExplicit: false,
        },
        targetSlug: normalizeSessionSlug('named-session'),
        authority: 'name',
      });
      expect(result.metadata).not.toBe(input);
      expect(input).toEqual({
        sessionName: 'Named Session',
        note: 'preserve me',
      });
    });

    it('sets sessionSlug and sessionSlugExplicit on explicit output metadata', () => {
      const result = buildMetadataSessionCacheEnvelope(
        {
          sessionSlug: 'edge-session',
        },
        'fallback-session',
      );

      expect(result.metadata.sessionSlug).toBe(normalizeSessionSlug('edge-session'));
      expect(result.metadata.sessionSlugExplicit).toBe(true);
      expect(result.authority).toBe('explicit');
    });

    it('adds a slug field when includeSlugField is true', () => {
      const result = buildMetadataSessionCacheEnvelope(
        {
          sessionSlug: 'edge-session',
        },
        'fallback-session',
        {
          includeSlugField: true,
        },
      );

      expect(result.metadata.slug).toBe(normalizeSessionSlug('edge-session'));
    });

    it('does not add a slug field when includeSlugField is false', () => {
      const result = buildMetadataSessionCacheEnvelope(
        {
          sessionName: 'Missing Session',
        },
        'fallback-session',
        {
          includeSlugField: false,
        },
      );

      expect(Object.prototype.hasOwnProperty.call(result.metadata, 'slug')).toBe(false);
    });

    it('preserves an existing slug field when includeSlugField is false', () => {
      const result = buildMetadataSessionCacheEnvelope(
        {
          slug: 'preserve-me',
          sessionSlugExplicit: false,
        },
        'fallback-session',
        {
          includeSlugField: false,
        },
      );

      expect(result.metadata.slug).toBe('preserve-me');
      expect(result.metadata.sessionSlug).toBe(normalizeSessionSlug('fallback-session'));
      expect(result.metadata.sessionSlugExplicit).toBe(false);
      expect(result.authority).toBe('fallback');
    });

    it('uses scoped session resolution when scoped is true', () => {
      const result = buildMetadataSessionCacheEnvelope({}, 'fallback-session', {
        scoped: true,
      });

      expect(result).toEqual({
        metadata: {
          sessionSlug: '',
          sessionSlugExplicit: false,
        },
        targetSlug: '',
        authority: 'fallback',
      });
    });

    it('uses the resolved slug directly when scoped is false', () => {
      const result = buildMetadataSessionCacheEnvelope({}, 'fallback-session', {
        scoped: false,
      });

      expect(result).toEqual({
        metadata: {
          sessionSlug: normalizeSessionSlug('fallback-session'),
          sessionSlugExplicit: false,
        },
        targetSlug: normalizeSessionSlug('fallback-session'),
        authority: 'fallback',
      });
    });
  });
});
