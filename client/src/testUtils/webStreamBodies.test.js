describe('Worker response stream test harness', () => {
  it.each(['buffer', 'view', 'arrayBuffer', 'blob'])('preserves binary %s bytes without UTF-8 conversion', async kind => {
    const bytes = new Uint8Array([0, 128, 255, 195, 40]);
    const body = {
      buffer: Buffer.from(bytes),
      view: new Uint8Array([9, ...bytes, 9]).subarray(1, 6),
      arrayBuffer: bytes.buffer,
      blob: new Blob([bytes]),
    }[kind];
    const response = new Response(body);
    const reader = response.body.getReader();
    expect(Array.from((await reader.read()).value)).toEqual(Array.from(bytes));
    expect((await reader.read()).done).toBe(true);
    reader.releaseLock();
  });
});
