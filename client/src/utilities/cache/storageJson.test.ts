import { boundedStringify, createStorageNamespace, removeKeys, safeJsonRead, safeJsonWrite } from './storageJson.js';

type MemoryStorage = {
  getItem: jest.Mock<string | null, [string]>;
  setItem: jest.Mock<void, [string, string]>;
  removeItem: jest.Mock<void, [string]>;
};

const createMemoryStorage = (): MemoryStorage => {
  const data = new Map<string, string>();
  return {
    getItem: jest.fn<string | null, [string]>((key) => data.get(key) ?? null),
    setItem: jest.fn<void, [string, string]>((key, value) => {
      data.set(key, String(value));
    }),
    removeItem: jest.fn<void, [string]>((key) => {
      data.delete(key);
    }),
  };
};

describe('storageJson primitives', () => {
  it('reads JSON through an optional parser', () => {
    const storage = createMemoryStorage();
    storage.setItem('draft', JSON.stringify({ count: 2 }));

    expect(safeJsonRead(storage, 'draft', (value) => (value as { count: number }).count)).toEqual(
      expect.objectContaining({
        ok: true,
        value: 2,
        status: 'ok',
      }),
    );
  });

  it('returns parse-failed and clears malformed values only when requested', () => {
    const storage = createMemoryStorage();
    storage.setItem('draft', '{bad json');

    const first = safeJsonRead(storage, 'draft');
    expect(first).toEqual(
      expect.objectContaining({
        ok: false,
        status: 'parse-failed',
      }),
    );
    expect(storage.removeItem).not.toHaveBeenCalled();

    const second = safeJsonRead(storage, 'draft', null, { clearInvalid: true });
    expect(second).toEqual(
      expect.objectContaining({
        ok: false,
        status: 'parse-failed',
      }),
    );
    expect(storage.removeItem).toHaveBeenCalledWith('draft');
  });

  it('writes JSON only when the bounded serialized payload fits', () => {
    const storage = createMemoryStorage();

    expect(safeJsonWrite(storage, 'draft', { title: 'Short' }, { maxBytes: 64 })).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'ok',
        key: 'draft',
      }),
    );

    expect(JSON.parse(storage.getItem('draft') as string)).toEqual({ title: 'Short' });

    expect(safeJsonWrite(storage, 'oversized', { body: 'x'.repeat(80) }, { maxBytes: 32 })).toEqual(
      expect.objectContaining({
        ok: false,
        status: 'too-large',
      }),
    );
    expect(storage.getItem('oversized')).toBeNull();
  });

  it('reports JSON.stringify failures without throwing', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(boundedStringify(circular)).toEqual(
      expect.objectContaining({
        ok: false,
        status: 'stringify-failed',
      }),
    );
  });

  it('removes key lists while reporting partial failures', () => {
    const storage = createMemoryStorage();
    storage.setItem('a', '1');
    storage.setItem('b', '2');
    storage.removeItem.mockImplementation((key) => {
      if (key === 'b') throw new Error('blocked');
    });

    expect(removeKeys(storage, ['a', 'b'])).toEqual({
      ok: false,
      removed: 1,
      failed: 1,
      status: 'partial-failure',
    });
  });

  it('creates stable versioned namespace keys', () => {
    const namespace = createStorageNamespace({ prefix: 'ce:surveyDraft', version: '2' });

    expect(namespace.base).toBe('ce:surveyDraft:v2');
    expect(namespace.key()).toBe('ce:surveyDraft:v2');
    expect(namespace.key(':edge')).toBe('ce:surveyDraft:v2:edge');
  });
});
