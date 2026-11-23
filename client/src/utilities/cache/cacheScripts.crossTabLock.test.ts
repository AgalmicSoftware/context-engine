// A browser that blocks site data refuses every Web Locks request. A cache write must then go ahead without the
// lock, as it does where the API does not exist, instead of failing.
describe('cross-tab write lock in a browser that refuses locks', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'locks');
  afterEach(() => {
    if (original) Object.defineProperty(navigator, 'locks', original);
    else delete (navigator as unknown as { locks?: unknown }).locks;
    jest.resetModules();
  });

  it('writes without the lock, and does not ask again', async () => {
    const request = jest.fn(async () => {
      throw new DOMException('The request was denied.', 'SecurityError');
    });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
    const { withCrossTabWriteLock } = await import('./cacheScripts.crossTabLock');
    await expect(withCrossTabWriteLock('dg:questionsCache:s', async () => 'saved')).resolves.toBe('saved');
    await expect(withCrossTabWriteLock('dg:questionsCache:s', async () => 'again')).resolves.toBe('again');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('still fails a write whose own work fails, and any other refusal', async () => {
    const request = jest
      .fn()
      .mockImplementationOnce(async (_name: string, _options: unknown, task: () => Promise<unknown>) => task())
      .mockImplementationOnce(async () => {
        throw new Error('lock manager broke');
      });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
    const { withCrossTabWriteLock } = await import('./cacheScripts.crossTabLock');
    const denied = new DOMException('quota', 'SecurityError');
    await expect(
      withCrossTabWriteLock('k', async () => {
        throw denied;
      }),
    ).rejects.toBe(denied);
    await expect(withCrossTabWriteLock('k', async () => 'x')).rejects.toThrow('lock manager broke');
  });
});
