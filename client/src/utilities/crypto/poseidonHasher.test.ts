import { createLazyPoseidonHasher, createPoseidonHasher, loadPoseidonHasher } from './poseidonHasher';

describe('Poseidon hasher adapter', () => {
  it('matches pinned poseidon-lite vectors for the two supported arities', async () => {
    const hasher = await loadPoseidonHasher();

    expect(hasher([1n, 2n]).toString()).toBe(
      '7853200120776062878684798364095072458815029376092732009249414926327459813530',
    );
    expect(hasher([1n, 2n, 3n]).toString()).toBe(
      '6542985608222806190361240322586112750744169038454362455181422643027100751666',
    );
  });

  it('dispatches only arities two and three', () => {
    const poseidon2 = jest.fn(() => 22n);
    const poseidon3 = jest.fn(() => 33n);
    const hasher = createPoseidonHasher({ poseidon2, poseidon3 });

    expect(hasher([1n, 2n])).toBe(22n);
    expect(hasher([1n, 2n, 3n])).toBe(33n);
    expect(() => hasher([1n])).toThrow('Unsupported Poseidon arity: 1');
    expect(() => hasher([1n, 2n, 3n, 4n])).toThrow('Unsupported Poseidon arity: 4');
    expect(poseidon2).toHaveBeenCalledTimes(1);
    expect(poseidon3).toHaveBeenCalledTimes(1);
  });

  it('fails closed when either arity module is invalid', async () => {
    await expect(
      loadPoseidonHasher({
        loadPoseidon2: async () => ({ poseidon2: null as never }),
        loadPoseidon3: async () => ({ poseidon3: () => 3n }),
      }),
    ).rejects.toThrow('Poseidon arity modules did not expose callable hashers');
  });
  it('defers loading until the first hash and retries a failed load', async () => {
    const poseidon2 = jest.fn(() => 22n);
    const poseidon3 = jest.fn(() => 33n);
    const loadPoseidon2 = jest.fn().mockRejectedValueOnce(new Error('chunk failed')).mockResolvedValue({ poseidon2 });
    const loadPoseidon3 = jest.fn(async () => ({ poseidon3 }));
    const hasher = createLazyPoseidonHasher({ loadPoseidon2, loadPoseidon3 });

    expect(loadPoseidon2).not.toHaveBeenCalled();
    await expect(hasher([1n, 2n])).rejects.toThrow('chunk failed');
    await expect(hasher([1n, 2n])).resolves.toBe(22n);
    await expect(hasher([1n, 2n, 3n])).resolves.toBe(33n);
    expect(loadPoseidon2).toHaveBeenCalledTimes(2);
    expect(loadPoseidon3).toHaveBeenCalledTimes(2);
  });
});
