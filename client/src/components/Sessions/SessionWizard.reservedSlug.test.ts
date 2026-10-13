import {
  INVALID_SESSION_SLUG_FORMAT_ERROR,
  REQUIRED_SESSION_SLUG_ERROR,
  RESERVED_SESSION_SLUG_ERROR,
  getSessionSlugValidationError,
  hasInvalidSessionSlugFormat,
  isMissingSessionSlug,
  isReservedSessionSlug,
} from './sessionWizardSlugValidation';
import { buildSessionWorkerBootstrapUrl } from '../../utilities/session/sessionWorkerDiscovery';
import { canonicalizeSessionSlug } from '../../utilities/session/sessionSlug';
import { validateInboundWorkerSessionSlug } from '../../../../workers/sessionCorsWorker/sessionSlugResolution.js';

describe('SessionWizard reserved slug validation', () => {
  it('marks "general" as reserved regardless of case or surrounding whitespace', () => {
    expect(isReservedSessionSlug('general')).toBe(true);
    expect(isReservedSessionSlug(' GENERAL ')).toBe(true);
    expect(isReservedSessionSlug('General')).toBe(true);
  });

  it('reserves debate, which the Worker opens as rxc, and names the route resolves elsewhere', () => {
    expect(isReservedSessionSlug('debate')).toBe(true);
    expect(isReservedSessionSlug(' DEBATE ')).toBe(true);
    expect(isReservedSessionSlug('constructor')).toBe(true);
    expect(isReservedSessionSlug('prototype')).toBe(true);
    expect(isReservedSessionSlug('rxc')).toBe(false);
    expect(isReservedSessionSlug(' RXC ')).toBe(false);
  });

  it('does not mark non-reserved slugs as reserved', () => {
    expect(isReservedSessionSlug('general-1')).toBe(false);
    expect(isReservedSessionSlug('community')).toBe(false);
  });

  it('rejects slug formats the worker will not accept', () => {
    expect(hasInvalidSessionSlugFormat('Bad Slug')).toBe(true);
    expect(hasInvalidSessionSlugFormat('mixedCase')).toBe(true);
    expect(hasInvalidSessionSlugFormat('bad.slug')).toBe(true);
    expect(hasInvalidSessionSlugFormat('good_slug-1')).toBe(false);
  });

  it('accepts exactly the slugs a participant link can open', () => {
    // A link opens a slug only if the bootstrap accepts it and neither the
    // session route nor the Worker resolves it to another session.
    const opensForParticipants = (slug: string): boolean => {
      try {
        buildSessionWorkerBootstrapUrl('https://worker.example.test', slug);
      } catch {
        return false;
      }
      const worker = validateInboundWorkerSessionSlug(slug);
      return canonicalizeSessionSlug(slug) === slug && worker.ok && worker.slug === slug;
    };
    const accepted = ['a', '0-team', 'good_slug-1', 'rxc', 'general-1', 'a'.repeat(128)];
    const rejected = ['-team', '_x', 'a'.repeat(129), 'general', 'debate', 'constructor', 'prototype', '__proto__'];
    [...accepted, ...rejected].forEach((slug) => {
      expect(opensForParticipants(slug)).toBe(accepted.includes(slug));
      expect(getSessionSlugValidationError(slug) === '').toBe(opensForParticipants(slug));
    });
  });

  it('marks empty and blank slugs as missing (not reserved)', () => {
    expect(isMissingSessionSlug('')).toBe(true);
    expect(isMissingSessionSlug('   ')).toBe(true);
    expect(isReservedSessionSlug('')).toBe(false);
    expect(isReservedSessionSlug('   ')).toBe(false);
  });

  it('returns required-vs-reserved slug errors for the correct condition', () => {
    expect(getSessionSlugValidationError('')).toBe(REQUIRED_SESSION_SLUG_ERROR);
    expect(getSessionSlugValidationError('   ')).toBe(REQUIRED_SESSION_SLUG_ERROR);
    expect(getSessionSlugValidationError('Bad Slug')).toBe(INVALID_SESSION_SLUG_FORMAT_ERROR);
    expect(getSessionSlugValidationError('general')).toBe(RESERVED_SESSION_SLUG_ERROR);
    expect(getSessionSlugValidationError('debate')).toBe(RESERVED_SESSION_SLUG_ERROR);
    expect(getSessionSlugValidationError('rxc')).toBe('');
    expect(getSessionSlugValidationError('community')).toBe('');
  });

  it('uses the exact slug validation error copy', () => {
    expect(REQUIRED_SESSION_SLUG_ERROR).toBe('A session slug is required.');
    expect(INVALID_SESSION_SLUG_FORMAT_ERROR).toBe(
      'Session slugs must start with a lowercase letter or number and use at most 128 lowercase letters, numbers, "_" or "-".',
    );
    expect(RESERVED_SESSION_SLUG_ERROR).toBe(
      'This slug is reserved because its link opens a different session ("general", "debate", "constructor", "prototype"). Please choose a different slug.',
    );
  });
});
