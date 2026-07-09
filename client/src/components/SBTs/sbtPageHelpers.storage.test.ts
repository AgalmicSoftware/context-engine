import {
  appendSbtPageBookmark,
  appendSbtPageTransactionHash,
  readSbtPageQueuedOrStoredLocalStorageJson,
  resolveSbtPageLocalStorageJsonWriteDecision,
  serializeSbtPageLocalStorageJsonWrite,
} from './sbtPageHelpers';

describe('sbtPageHelpers storage helpers', () => {
  it('reads queued localStorage JSON before stored JSON with fallback guards', () => {
    const fallback = { empty: true };
    const storageRef = {
      getItem: jest.fn((key: string) => (key === 'saved' ? '{"stored":true}' : 'not-json')),
    };
    const queuedWrites = new Map<string, string>([['saved', '{"queued":true}']]);

    expect(
      readSbtPageQueuedOrStoredLocalStorageJson({
        fallback,
        key: 'saved',
        queuedWrites,
        storageRef,
      }),
    ).toEqual({ queued: true });
    expect(storageRef.getItem).not.toHaveBeenCalledWith('saved');
    expect(
      readSbtPageQueuedOrStoredLocalStorageJson({
        fallback,
        key: 'saved',
        queuedWrites: new Map(),
        storageRef,
      }),
    ).toEqual({ stored: true });
    expect(
      readSbtPageQueuedOrStoredLocalStorageJson({
        fallback,
        key: 'bad',
        storageRef,
      }),
    ).toBe(fallback);
    expect(
      readSbtPageQueuedOrStoredLocalStorageJson({
        fallback,
        key: '',
        storageRef,
      }),
    ).toBe(fallback);
    expect(
      readSbtPageQueuedOrStoredLocalStorageJson({
        fallback,
        key: 'saved',
        storageRef: null,
      }),
    ).toBe(fallback);
    expect(
      serializeSbtPageLocalStorageJsonWrite({
        key: 'saved',
        value: { ok: true },
      }),
    ).toEqual({
      storageKey: 'saved',
      nextJson: '{"ok":true}',
    });
    expect(
      serializeSbtPageLocalStorageJsonWrite({
        key: '',
        value: { ok: true },
      }),
    ).toBeNull();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(
      serializeSbtPageLocalStorageJsonWrite({
        key: 'circular',
        value: circular,
      }),
    ).toBeNull();
    expect(
      resolveSbtPageLocalStorageJsonWriteDecision({
        cachedJson: '{"ok":true}',
        currentRaw: '',
        nextJson: '{"ok":true}',
      }),
    ).toBe('skip');
    expect(
      resolveSbtPageLocalStorageJsonWriteDecision({
        cachedJson: '',
        currentRaw: '{"ok":true}',
        nextJson: '{"ok":true}',
      }),
    ).toBe('adopt');
    expect(
      resolveSbtPageLocalStorageJsonWriteDecision({
        cachedJson: '',
        currentRaw: '',
        nextJson: '{"ok":true}',
      }),
    ).toBe('write');
  });

  it('appends transaction hashes to the lower-cased user cache bucket', () => {
    const txCache = { '0xabc': ['0xold'] };

    expect(
      appendSbtPageTransactionHash({
        cacheObj: txCache,
        txHash: '0xnew',
        userAddress: '0xABC',
      }),
    ).toEqual({
      shouldWrite: true,
      txCache: { '0xabc': ['0xold', '0xnew'] },
    });
    expect(
      appendSbtPageTransactionHash({
        cacheObj: {},
        txHash: '0xfresh',
        userAddress: '0xDEF',
      }),
    ).toEqual({
      shouldWrite: true,
      txCache: { '0xdef': ['0xfresh'] },
    });
    expect(
      appendSbtPageTransactionHash({
        cacheObj: {},
        txHash: '0xignored',
        userAddress: '',
      }),
    ).toEqual({
      shouldWrite: false,
      txCache: {},
    });
    expect(() =>
      appendSbtPageTransactionHash({
        cacheObj: { '0xabc': 'bad-shape' },
        txHash: '0xnew',
        userAddress: '0xABC',
      }),
    ).toThrow();
  });

  it('appends SBT bookmarks without duplicating existing addresses', () => {
    expect(
      appendSbtPageBookmark({
        bookmarksObj: {},
        sbtAddress: '0xSBT',
      }),
    ).toEqual({
      bookmarks: { sbts: ['0xSBT'] },
      shouldWrite: true,
    });

    const existing = { sbts: ['0xSBT'] };
    expect(
      appendSbtPageBookmark({
        bookmarksObj: existing,
        sbtAddress: '0xSBT',
      }),
    ).toEqual({
      bookmarks: existing,
      shouldWrite: false,
    });
    expect(
      appendSbtPageBookmark({
        bookmarksObj: {},
        sbtAddress: '',
      }),
    ).toEqual({
      bookmarks: {},
      shouldWrite: false,
    });
    expect(() =>
      appendSbtPageBookmark({
        bookmarksObj: { sbts: 'bad-shape' },
        sbtAddress: '0xSBT',
      }),
    ).toThrow();
  });
});
