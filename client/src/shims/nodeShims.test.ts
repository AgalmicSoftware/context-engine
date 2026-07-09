describe('client shim modules', () => {
  it('keeps node os/events shims aligned with the Node modules', () => {
    const osShim = require('./node-os');
    const eventsShim = require('./node-events');

    expect(typeof osShim.tmpdir).toBe('function');
    expect(eventsShim.EventEmitter).toBe(require('events').EventEmitter);
  });

  it('keeps browser-only worker and source-map shims inert', () => {
    const workerThreads = require('./node-worker-threads');
    const sourceMapSupport = require('./source-map-support-register');

    expect(workerThreads.threadId).toBe(0);
    expect(workerThreads.isMainThread).toBe(true);
    expect(workerThreads.parentPort).toBeNull();
    expect(() => new workerThreads.Worker()).toThrow('worker_threads is not available in browser builds');
    expect(sourceMapSupport).toEqual({});
  });

  it('keeps the metamask superstruct shim importable', () => {
    const shim = require('./metamask-superstruct');

    expect(typeof shim.Struct).toBe('function');
    expect(shim.default).toEqual({});
  });
});
