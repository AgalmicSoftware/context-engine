import * as contractScripts from '../../utilities/web3/contractScripts.js';
import {
  getAllSessionSlugs,
  getDemoSessionConfigBySlug,
  getSessionChainId,
  getSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
  getSessionSlugByName,
  normalizeSessionSlug,
} from './sessionConfig.js';

jest.mock('../../utilities/web3/contractScripts.js', () => ({
  __esModule: true,
  normalizeSessionSlug: jest.fn((slug) => `normalized:${slug}`),
  getSessionConfigBySlug: jest.fn((slug) => ({ slug, source: 'strict' })),
  getDemoSessionConfigBySlug: jest.fn((slug) => ({ slug, source: 'demo' })),
  getSessionConfigBySlugOrDefault: jest.fn((slug) => ({ slug, source: 'default' })),
  getSessionSlugByName: jest.fn((name) => (name === 'Named Session' ? 'named-session' : null)),
  getAllSessionSlugs: jest.fn(() => ['edge']),
  getSessionChainId: jest.fn(() => 11155420),
}));

const mockedContractScripts = contractScripts as jest.Mocked<typeof contractScripts>;

describe('sessionConfig domain adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates session config reads through the shared contractScripts module', () => {
    expect(normalizeSessionSlug('Edge')).toBe('normalized:Edge');
    expect(getSessionConfigBySlug('edge')).toEqual({ slug: 'edge', source: 'strict' });
    expect(getDemoSessionConfigBySlug('demo', { allowDemoFallback: true })).toEqual({
      slug: 'demo',
      source: 'demo',
    });
    expect(getSessionConfigBySlugOrDefault('')).toEqual({ slug: '', source: 'default' });
    expect(getSessionSlugByName('Named Session')).toBe('named-session');
    expect(getAllSessionSlugs({ includeEmpty: true })).toEqual(['edge']);
    expect(getSessionChainId('edge')).toBe(11155420);

    expect(mockedContractScripts.normalizeSessionSlug).toHaveBeenCalledWith('Edge');
    expect(mockedContractScripts.getSessionConfigBySlug).toHaveBeenCalledWith('edge');
    expect(mockedContractScripts.getDemoSessionConfigBySlug).toHaveBeenCalledWith('demo', { allowDemoFallback: true });
    expect(mockedContractScripts.getSessionConfigBySlugOrDefault).toHaveBeenCalledWith('');
    expect(mockedContractScripts.getSessionSlugByName).toHaveBeenCalledWith('Named Session');
    expect(mockedContractScripts.getAllSessionSlugs).toHaveBeenCalledWith({ includeEmpty: true });
    expect(mockedContractScripts.getSessionChainId).toHaveBeenCalledWith('edge');
  });

  it('uses the latest contractScripts implementation at call time', () => {
    mockedContractScripts.getSessionConfigBySlug.mockReturnValueOnce({ slug: 'late-bound' });
    mockedContractScripts.getSessionSlugByName.mockReturnValueOnce('late-bound-name');
    mockedContractScripts.getSessionChainId.mockReturnValueOnce(84532);

    expect(getSessionConfigBySlug('edge')).toEqual({ slug: 'late-bound' });
    expect(getSessionSlugByName('Late Bound')).toBe('late-bound-name');
    expect(getSessionChainId('edge')).toBe(84532);
  });
});
