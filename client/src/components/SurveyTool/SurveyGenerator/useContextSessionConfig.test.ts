import { act, renderHook } from '@testing-library/react';
import { useContextSessionConfig } from './useContextSessionConfig';
import { readKnownSessionCatalog } from '../../../utilities/session/sessionCatalog';
import {
  getVerifiedWorkerCanonicalSessionBootstrap,
  SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT,
} from '../../../utilities/session/sessionWorkerConfigCache';

jest.mock('../../../utilities/session/sessionCatalog', () => ({ readKnownSessionCatalog: jest.fn() }));
jest.mock('../../../utilities/session/sessionWorkerConfigCache', () => ({
  getVerifiedWorkerCanonicalSessionBootstrap: jest.fn(),
  SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT: 'test-worker-config-updated',
}));

const catalog = jest.mocked(readKnownSessionCatalog);
const verified = jest.mocked(getVerifiedWorkerCanonicalSessionBootstrap);
const entry = (slug: string, origin = `https://${slug}.example`) => ({
  slug,
  name: slug,
  kind: 'centralized' as const,
  href: `/session/${slug}?worker=${encodeURIComponent(origin)}`,
  createdAt: null,
  lastActivityAt: null,
  adminAddresses: [],
});
const bootstrap = (slug: string) => ({
  sessionSlug: slug,
  sessionId: '0x00112233445566778899aabbccddeeff',
  workerOrigin: `https://${slug}.example`,
  configRevision: '1',
  config: { slug, corsWorkerUrl: `https://${slug}.example` },
});

beforeEach(() => {
  jest.clearAllMocks();
  catalog.mockReturnValue([entry('session-a'), entry('session-b')]);
  verified.mockReturnValue(null);
});

it('loads a catalog-only session through verified bootstrap and ignores a stale selection', () => {
  const { result, rerender } = renderHook(({ slug }) => useContextSessionConfig(slug, null), {
    initialProps: { slug: 'session-a' },
  });
  expect(result.current.sessionConfig).toBeNull();
  expect(result.current.bootstrapProps).toMatchObject({
    sessionSlug: 'session-a',
    workerQueryValue: 'https://session-a.example',
  });
  const finish = result.current.bootstrapProps!.onResolved;
  rerender({ slug: 'session-b' });
  act(() => finish(bootstrap('session-a')));
  expect(result.current.sessionConfig).toBeNull();
  expect(result.current.bootstrapProps?.sessionSlug).toBe('session-b');
  act(() => finish(bootstrap('session-b')));
  expect(result.current.sessionConfig).toEqual(bootstrap('session-b').config);
  expect(result.current.bootstrapProps).toBeNull();
});

it('uses only the verified cache for the selected Worker origin and refreshes when discovery changes', () => {
  verified.mockReturnValue(bootstrap('session-a').config);
  const { result } = renderHook(() => useContextSessionConfig('session-a', null));
  expect(verified).toHaveBeenLastCalledWith({ slug: 'session-a', workerOrigin: 'https://session-a.example' });
  expect(result.current.sessionConfig).toEqual(bootstrap('session-a').config);
  expect(result.current.bootstrapProps).toBeNull();
  verified.mockReturnValue(null);
  catalog.mockReturnValue([entry('session-a', 'https://changed.example')]);
  act(() => window.dispatchEvent(new Event(SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT)));
  expect(verified).toHaveBeenLastCalledWith({ slug: 'session-a', workerOrigin: 'https://changed.example' });
  expect(result.current.sessionConfig).toBeNull();
  expect(result.current.bootstrapProps?.workerQueryValue).toBe('https://changed.example');
});

it('preserves an authoritative supplied config and never falls back to another session Worker', () => {
  const supplied = { slug: 'session-a', corsWorkerUrl: 'https://explicit.example' };
  const { result, rerender } = renderHook(({ slug, config }) => useContextSessionConfig(slug, config), {
    initialProps: { slug: 'session-a', config: supplied as Record<string, unknown> | null },
  });
  expect(result.current.sessionConfig).toBe(supplied);
  expect(catalog).not.toHaveBeenCalled();
  rerender({ slug: 'missing', config: null });
  expect(result.current.sessionConfig).toBeNull();
  expect(result.current.bootstrapProps).toBeNull();
});

it('uses an exact discovery hint ahead of the catalog and rejects an invalid Worker origin', () => {
  const { result, rerender } = renderHook(
    ({ origin }) =>
      useContextSessionConfig('session-a', {
        slug: 'session-a',
        corsWorkerUrl: origin,
        workerCanonicalCleanRoute: true,
      }),
    { initialProps: { origin: 'https://explicit.example' } },
  );
  expect(result.current.sessionConfig).toBeNull();
  expect(result.current.bootstrapProps?.sessionSlug).toBe('session-a');
  expect(result.current.bootstrapProps?.workerQueryValue).toBe('https://explicit.example');
  rerender({ origin: 'https://worker.example/untrusted-path' });
  expect(result.current.sessionConfig).toBeNull();
  expect(result.current.bootstrapProps).toBeNull();
});
