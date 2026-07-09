import {
  normalizeSessionNameFields,
  normalizeSbtSessionLinkFields,
  resolveSbtSessionSlug,
  resolveSessionNameValue,
} from './sessionMetadataFormatting.js';
import { normalizeSessionSlug, resolveSessionByName } from './sessionConfigResolvers.js';

jest.mock('./sessionConfigResolvers.js', () => ({
  normalizeSessionSlug: jest.fn((value = '') =>
    String(value || '')
      .trim()
      .toLowerCase(),
  ),
  resolveSessionByName: jest.fn(() => null),
}));

describe('sessionMetadataFormatting helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    normalizeSessionSlug.mockImplementation((value = '') =>
      String(value || '')
        .trim()
        .toLowerCase(),
    );
    resolveSessionByName.mockReturnValue(null);
  });

  it('reads only the canonical sessionName field', () => {
    expect(resolveSessionNameValue({ sessionName: '  Direct Name  ', groupName: 'Legacy Name' })).toBe('Direct Name');
    expect(resolveSessionNameValue({ groupName: 'Legacy Name' })).toBe('');
    expect(resolveSessionNameValue(null)).toBe('');
  });

  it('treats explicit slug fields as authoritative and defaults them to explicit', () => {
    expect(resolveSbtSessionSlug({ slug: '  Alpha  ' }, 'fallback-slug')).toEqual({
      slug: 'alpha',
      explicit: true,
    });

    expect(normalizeSessionSlug).toHaveBeenCalledWith('Alpha');
    expect(resolveSessionByName).not.toHaveBeenCalled();
  });

  it('respects an explicit false sessionSlugExplicit flag', () => {
    expect(
      resolveSbtSessionSlug({
        sessionSlug: '  Beta  ',
        sessionSlugExplicit: false,
        sessionName: 'Ignored Name',
      }),
    ).toEqual({
      slug: 'beta',
      explicit: false,
    });

    expect(resolveSessionByName).not.toHaveBeenCalled();
  });

  it('falls back to resolving by sessionName before using the fallback slug', () => {
    resolveSessionByName.mockReturnValue({ slug: 'Resolved-Slug' });

    expect(resolveSbtSessionSlug({ sessionName: 'Name Match' }, 'fallback-slug')).toEqual({
      slug: 'resolved-slug',
      explicit: false,
    });

    expect(resolveSessionByName).toHaveBeenCalledWith('Name Match');
    expect(normalizeSessionSlug).toHaveBeenCalledWith('Resolved-Slug');
  });

  it('normalizes link fields in place and removes the legacy slug key', () => {
    const metadata = {
      slug: '  Gamma  ',
      sessionName: 'Gamma Session',
    };

    const normalized = normalizeSbtSessionLinkFields(metadata, 'fallback-slug');

    expect(normalized).toBe(metadata);
    expect(metadata).toEqual({
      sessionName: 'Gamma Session',
      sessionSlug: 'gamma',
      sessionSlugExplicit: true,
    });
  });

  it('uses the fallback session name only when the canonical field is empty', () => {
    const fromFallback = {};
    const existing = { sessionName: '  Canonical Name  ', groupName: 'Legacy Name' };

    normalizeSessionNameFields(fromFallback, '  Fallback Name  ');
    normalizeSessionNameFields(existing, 'Ignored Fallback');

    expect(fromFallback).toEqual({ sessionName: 'Fallback Name' });
    expect(existing).toEqual({
      sessionName: 'Canonical Name',
      groupName: 'Legacy Name',
    });
  });
});
