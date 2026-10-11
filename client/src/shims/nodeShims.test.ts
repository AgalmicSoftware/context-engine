describe('client shim modules', () => {
  it('keeps node os/events shims aligned with the Node modules', () => {
    const osShim = require('./node-os');
    const eventsShim = require('./node-events');

    expect(typeof osShim.tmpdir).toBe('function');
    expect(eventsShim.EventEmitter).toBe(require('events').EventEmitter);
  });

  it('keeps the metamask superstruct shim importable', () => {
    const shim = require('./metamask-superstruct');

    expect(typeof shim.Struct).toBe('function');
    expect(shim.default).toEqual({});
  });
});
