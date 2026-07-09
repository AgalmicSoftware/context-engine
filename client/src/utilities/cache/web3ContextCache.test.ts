import { __test__web3ContextCache, resolveWeb3ContextCacheEntry } from './web3ContextCache';

describe('web3ContextCache', () => {
  beforeEach(() => {
    __test__web3ContextCache.clear();
  });

  it('reuses equivalent object inputs within the same microtask window', () => {
    const createEntry = jest.fn(() => ({ context: true }));

    const first = resolveWeb3ContextCacheEntry({ slug: 'alpha', chainId: 11155420 }, createEntry);
    const second = resolveWeb3ContextCacheEntry({ chainId: 11155420, slug: 'alpha' }, createEntry);

    expect(second).toBe(first);
    expect(createEntry).toHaveBeenCalledTimes(1);
  });

  it('clears the short-lived context cache after the queued microtask', async () => {
    const createEntry = jest.fn(() => ({ id: createEntry.mock.calls.length + 1 }));

    const first = resolveWeb3ContextCacheEntry('alpha', createEntry);
    expect(resolveWeb3ContextCacheEntry('alpha', createEntry)).toBe(first);

    await Promise.resolve();

    const second = resolveWeb3ContextCacheEntry('alpha', createEntry);
    expect(second).not.toBe(first);
    expect(createEntry).toHaveBeenCalledTimes(2);
  });

  it('serializes functions, symbols, undefined, and circular inputs deterministically', () => {
    const input: Record<string, unknown> = {
      missing: undefined,
      symbol: Symbol('scope'),
      fn: function namedFactory() {
        return null;
      },
    };
    input.self = input;

    expect(__test__web3ContextCache.serialize(input)).toBe(
      '{"fn":"__fn:namedFactory__","missing":"__undefined__","self":"__circular__","symbol":"Symbol(scope)"}',
    );
  });
});
