jest.mock('../../utilities/web3/contractScripts.js', () => ({
  __esModule: true,
  getSessionConfigBySlug: jest.fn(),
  getSessionConfigBySlugOrDefault: jest.fn(),
  getSessionChainId: jest.fn(),
  getSessionNetwork: jest.fn(),
  normalizeSessionSlug: jest.fn(),
}));

jest.mock('../../utilities/survey/questionRouting.js', () => ({
  __esModule: true,
  resolveStrictSessionValue: jest.fn(),
}));

const { getSessionCfg, getSessionChainId, getSessionNetwork } = require('./mainSiteSessionConfig.js');
const contractScriptsModule = require('../../utilities/web3/contractScripts.js');
const questionRoutingModule = require('../../utilities/survey/questionRouting.js');

describe('mainSiteSessionConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contractScriptsModule.normalizeSessionSlug.mockImplementation((slug) =>
      String(slug || '')
        .trim()
        .toLowerCase(),
    );
    contractScriptsModule.getSessionConfigBySlugOrDefault.mockImplementation((slug) => ({
      slug,
      source: 'default',
    }));
    questionRoutingModule.resolveStrictSessionValue.mockImplementation((slug, _strictLookup, resolver) =>
      resolver(slug),
    );
  });

  describe('getSessionCfg', () => {
    it('normalizes falsy slugs and falls back to the default session config when empty', () => {
      const result = getSessionCfg(null);

      expect(contractScriptsModule.normalizeSessionSlug).toHaveBeenCalledWith('');
      expect(contractScriptsModule.getSessionConfigBySlugOrDefault).toHaveBeenCalledWith('');
      expect(questionRoutingModule.resolveStrictSessionValue).not.toHaveBeenCalled();
      expect(result).toEqual({ slug: '', source: 'default' });
    });

    it('resolves non-empty slugs through resolveStrictSessionValue', () => {
      const cfg = { slug: 'edge', source: 'strict' };
      contractScriptsModule.getSessionConfigBySlug.mockImplementation((slug) => ({
        slug,
        source: 'strict',
      }));
      questionRoutingModule.resolveStrictSessionValue.mockImplementation((slug, strictLookup, resolver) => {
        expect(strictLookup).toBe(contractScriptsModule.getSessionConfigBySlug);
        return resolver(slug);
      });

      const result = getSessionCfg(' Edge ');

      expect(contractScriptsModule.normalizeSessionSlug).toHaveBeenCalledWith(' Edge ');
      expect(questionRoutingModule.resolveStrictSessionValue).toHaveBeenCalledWith(
        'edge',
        contractScriptsModule.getSessionConfigBySlug,
        expect.any(Function),
      );
      expect(contractScriptsModule.getSessionConfigBySlug).toHaveBeenCalledWith('edge');
      expect(result).toEqual(cfg);
    });
  });

  describe('getSessionChainId', () => {
    it('passes the normalized slug through resolveStrictSessionValue with the chain resolver', () => {
      contractScriptsModule.getSessionChainId.mockReturnValue(84532);

      const result = getSessionChainId(' Edge ');

      expect(contractScriptsModule.normalizeSessionSlug).toHaveBeenCalledWith(' Edge ');
      expect(questionRoutingModule.resolveStrictSessionValue).toHaveBeenCalledWith(
        'edge',
        contractScriptsModule.getSessionConfigBySlug,
        contractScriptsModule.getSessionChainId,
      );
      expect(result).toBe(84532);
    });

    it('returns null when the resolved chain id is not a positive finite number', () => {
      contractScriptsModule.getSessionChainId.mockReturnValue('not-a-chain');

      expect(getSessionChainId(' Edge ')).toBeNull();
    });
  });

  describe('getSessionNetwork', () => {
    it('passes the normalized slug through resolveStrictSessionValue with the network resolver', () => {
      const network = { id: 84532, name: 'Base Sepolia' };
      contractScriptsModule.getSessionNetwork.mockReturnValue(network);

      const result = getSessionNetwork(' Edge ');

      expect(contractScriptsModule.normalizeSessionSlug).toHaveBeenCalledWith(' Edge ');
      expect(questionRoutingModule.resolveStrictSessionValue).toHaveBeenCalledWith(
        'edge',
        contractScriptsModule.getSessionConfigBySlug,
        contractScriptsModule.getSessionNetwork,
      );
      expect(result).toBe(network);
    });

    it('returns null when the resolved network is not an object', () => {
      contractScriptsModule.getSessionNetwork.mockReturnValue('84532');

      expect(getSessionNetwork(' Edge ')).toBeNull();
    });
  });
});
