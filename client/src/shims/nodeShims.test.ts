describe('client shim modules', () => {
  it('keeps the metamask superstruct shim importable', () => {
    const shim = require('./metamask-superstruct');

    expect(typeof shim.Struct).toBe('function');
    expect(shim.default).toEqual({});
  });
});
