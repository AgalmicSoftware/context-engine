import * as sessionRegistry from '../../../utilities/web3/sessionRegistry.js';
import * as sessionConfig from '../sessionConfig.js';
import { sessionRegistryReadsPort } from './sessionRegistryReadPorts';

describe('session registry read ports', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes resolved slug and config reads through call-time session facade property lookup', () => {
    const getAllSessionSlugs = jest.spyOn(sessionConfig, 'getAllSessionSlugs').mockReturnValue(['', 'edge']);
    const getSessionConfigBySlug = jest
      .spyOn(sessionConfig, 'getSessionConfigBySlug')
      .mockImplementation((slug) => ({ slug: String(slug), sessionName: 'Edge' }));

    expect(sessionRegistryReadsPort.getAllSessionSlugs({ includeEmpty: true })).toEqual(['', 'edge']);
    expect(sessionRegistryReadsPort.getSessionConfigBySlug('edge')).toEqual({ slug: 'edge', sessionName: 'Edge' });
    expect(getAllSessionSlugs).toHaveBeenCalledWith({ includeEmpty: true });
    expect(getSessionConfigBySlug).toHaveBeenCalledWith('edge');
  });

  it('routes cache reads and shared registry operations through call-time property lookup', async () => {
    const loadSessionRegistryCache = jest
      .spyOn(sessionRegistry, 'loadSessionRegistryCache')
      .mockResolvedValue({ sessions: { first: {} } });
    const loadGroupRegistryCache = jest
      .spyOn(sessionRegistry, 'loadGroupRegistryCache')
      .mockResolvedValue({ groups: { first: {} } });
    const getAllSessionEntries = jest
      .spyOn(sessionRegistry.sessionRegistryStore, 'getAllSessionEntries')
      .mockReturnValue([['first', { slug: 'first' }]]);
    const getSessionConfig = jest
      .spyOn(sessionRegistry.sessionRegistryStore, 'getSessionConfig')
      .mockImplementation((slug) => ({ slug: String(slug) }));
    const getSessionConfigById = jest
      .spyOn(sessionRegistry.sessionRegistryStore, 'getSessionConfigById')
      .mockImplementation((sessionId) => ({ slug: `${sessionId}-by-id` }));
    const fetchSessionFromRegistry = jest
      .spyOn(sessionRegistry.sessionRegistryUtils, 'fetchSessionFromRegistry')
      .mockResolvedValue({ slug: 'second' });
    const upsertSessionRegistryCache = jest
      .spyOn(sessionRegistry.sessionRegistryUtils, 'upsertSessionRegistryCache')
      .mockReturnValue({ ts: 99 });
    const formatSessionId = jest
      .spyOn(sessionRegistry.sessionRegistryUtils, 'formatSessionId')
      .mockReturnValue('0xsession');
    jest.spyOn(sessionRegistry.sessionRegistryUtils, 'normalizeSessionIdHex').mockReturnValue('0xabc');
    jest.spyOn(sessionRegistry.sessionRegistryUtils, 'toRegistrySlug').mockReturnValue('second-slug');

    await expect(sessionRegistryReadsPort.loadSessionRegistryCache({ force: true })).resolves.toEqual({
      sessions: { first: {} },
    });
    await expect(sessionRegistryReadsPort.loadGroupRegistryCache({ bootstrapRpc: true })).resolves.toEqual({
      groups: { first: {} },
    });
    expect(sessionRegistryReadsPort.getAllSessionEntries()).toEqual([['first', { slug: 'first' }]]);
    expect(sessionRegistryReadsPort.getSessionConfig('first')).toEqual({ slug: 'first' });
    expect(sessionRegistryReadsPort.getSessionConfigById('0xfirst')).toEqual({ slug: '0xfirst-by-id' });
    await expect(sessionRegistryReadsPort.fetchSessionFromRegistry({ slug: 'Second' })).resolves.toEqual({
      slug: 'second',
    });
    expect(sessionRegistryReadsPort.upsertSessionRegistryCache({ config: { slug: 'Second' } })).toEqual({ ts: 99 });
    expect(sessionRegistryReadsPort.formatSessionId('session')).toBe('0xsession');
    expect(sessionRegistryReadsPort.normalizeSessionIdHex('ABC')).toBe('0xabc');
    expect(sessionRegistryReadsPort.toRegistrySlug(' Second Slug ')).toBe('second-slug');

    expect(loadSessionRegistryCache).toHaveBeenCalledWith({ force: true });
    expect(loadGroupRegistryCache).toHaveBeenCalledWith({ bootstrapRpc: true });
    expect(getAllSessionEntries).toHaveBeenCalledTimes(1);
    expect(getSessionConfig).toHaveBeenCalledWith('first');
    expect(getSessionConfigById).toHaveBeenCalledWith('0xfirst');
    expect(fetchSessionFromRegistry).toHaveBeenCalledWith({ slug: 'Second' });
    expect(upsertSessionRegistryCache).toHaveBeenCalledWith({ config: { slug: 'Second' } });
    expect(formatSessionId).toHaveBeenCalledWith('session');
  });

  it('models registry store entries as Object.entries-shaped tuples', () => {
    const sessions = {
      alpha: { slug: 'alpha', chainId: 11155420 },
    };
    const getAllSessionEntries = jest
      .spyOn(sessionRegistry.sessionRegistryStore, 'getAllSessionEntries')
      .mockReturnValue(Object.entries(sessions));

    const [[slug, config]] = sessionRegistryReadsPort.getAllSessionEntries();

    expect(slug).toBe('alpha');
    expect(config).toEqual({ slug: 'alpha', chainId: 11155420 });
    expect(getAllSessionEntries).toHaveBeenCalledTimes(1);
  });

  it('subscribes and unsubscribes from the cache update event with the same listener', () => {
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    const listener = jest.fn();

    const unsubscribe = sessionRegistryReadsPort.subscribeToCacheUpdates(
      {
        addEventListener,
        removeEventListener,
      },
      listener,
    );
    unsubscribe();

    expect(addEventListener).toHaveBeenCalledWith(sessionRegistry.SESSION_REGISTRY_CACHE_UPDATED_EVENT, listener);
    expect(removeEventListener).toHaveBeenCalledWith(sessionRegistry.SESSION_REGISTRY_CACHE_UPDATED_EVENT, listener);
  });
});
