it('normalizes resource URLs and records labels without loading the Arweave client', () => {
  jest.isolateModules(() => {
    jest.doMock('./arweaveClient.js', () => {
      throw new Error('URL utilities must not load the client');
    });
    const { normalizeArweaveUrl } = require('./arweaveUrls');
    const { getArweaveTxContextLabels } = require('./arweaveClientCaches');
    const id = 'c'.repeat(43);
    expect(
      normalizeArweaveUrl(`ar://${id}`, { gateway: 'https://gateway.example.test', contextLabel: 'QUESTION' }),
    ).toBe(`https://gateway.example.test/${id}`);
    expect(getArweaveTxContextLabels(id)).toEqual(['question:normalizeArweaveUrl:ui_resource']);
    jest.dontMock('./arweaveClient.js');
  });
});

it('installs the resource listener on client load and preserves context labels', () => {
  jest.dontMock('./arweaveClient.js');
  const listeners = jest.spyOn(window, 'addEventListener');
  const warn = jest.fn();
  jest.doMock('../logging.js', () => ({
    createLogger: () => ({ warn, debug: jest.fn(), info: jest.fn(), error: jest.fn() }),
  }));
  try {
    jest.isolateModules(() => {
      const { arweaveClient } = require('./arweaveClient');
      const listener = listeners.mock.calls.find(([type]) => type === 'error')?.[1];
      expect(listener).toEqual(expect.any(Function));
      const id = 'd'.repeat(43);
      arweaveClient.registerTxContext(`ar://${id}`, { category: 'Response', caller: 'fixture', source: 'Storage' });
      listener({ target: { src: `https://arweave.net/${id}`, tagName: 'IMG' } });
      expect(warn).toHaveBeenCalledWith(
        '[arweave] resource-load-error',
        expect.objectContaining({
          txId: id,
          labels: ['response:fixture:storage'],
          tag: 'img',
        }),
      );
      listener({ target: { src: `https://arweave.net/${id}`, tagName: 'IMG' } });
      expect(warn.mock.calls.filter(([label]) => label === '[arweave] resource-load-error')).toHaveLength(1);
    });
  } finally {
    for (const [type, listener, capture] of listeners.mock.calls) window.removeEventListener(type, listener, capture);
    listeners.mockRestore();
    jest.dontMock('../logging.js');
  }
});
