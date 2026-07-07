/** @file UserPage.bookmarks.test.jsx */
import UserPage from './UserPage';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';

jest.mock('../../utilities/crypto/litProtocol.js', () => ({
  getGlobalLitHooks: jest.fn(() => null),
}));

jest.mock('../../utilities/crypto/cryptography.js', () => ({
  cryptoUtils: {
    decryptSingleField: jest.fn(),
  },
}));

jest.mock('../../utilities/web3/sponsoredAccess.js', () => ({
  checkSponsoredAccess: jest.fn(),
}));

jest.mock('utilities/ai/aiScripts.js', () => ({
  analyzeUserOpinions: jest.fn(async () => ({
    summary: 'summary',
    details: 'details',
    name: 'name',
    historicalAlignment: {},
  })),
}));

const makeInstance = (props = {}) => {
  const instance = new UserPage({
    viewAddress: '0x00000000000000000000000000000000000000aa',
    network: { id: 84532 },
    isSurveyCacheReady: true,
    isQuestionCacheReady: true,
    isResponsesCacheReady: true,
    isSBTCacheReady: true,
    sbtCacheRevision: 0,
    questionResponsesNonce: 0,
    ...props,
  });

  instance._isMounted = true;
  instance.setState = jest.fn((update, cb) => {
    const patch = typeof update === 'function' ? update(instance.state, instance.props) : update;
    if (patch && typeof patch === 'object') {
      instance.state = { ...instance.state, ...patch };
    }
    if (typeof cb === 'function') cb();
  });

  return instance;
};

const collectTreeNodes = (node, predicate, acc = []) => {
  if (node == null) return acc;
  if (Array.isArray(node)) {
    node.forEach((child) => collectTreeNodes(child, predicate, acc));
    return acc;
  }
  if (typeof node !== 'object') return acc;
  if (predicate(node)) acc.push(node);
  const rendered = renderResolvableComponent(node);
  if (rendered !== null) return collectTreeNodes(rendered, predicate, acc);
  return collectTreeNodes(node?.props?.children, predicate, acc);
};

const getNodeTypeName = (node) => {
  const type = node?.type;
  if (!type) return '';
  if (typeof type === 'string') return type;
  return String(type.displayName || type.name || '');
};

const RESOLVABLE_USER_PAGE_COMPONENTS = new Set(['UserPageHeader']);

const resolvedComponentCache = new WeakMap();

const renderResolvableComponent = (node) => {
  const typeName = getNodeTypeName(node);
  if (!RESOLVABLE_USER_PAGE_COMPONENTS.has(typeName)) return null;
  if (typeof node?.type !== 'function') return null;
  if (resolvedComponentCache.has(node)) return resolvedComponentCache.get(node);
  const rendered = node.type(node.props || {});
  resolvedComponentCache.set(node, rendered);
  return rendered;
};

describe('UserPage bookmark cache controls', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('reads bookmarks cache with clone:false and returns detached arrays', () => {
    const instance = makeInstance({ activeSessionSlug: 'edge' });
    const source = {
      surveys: ['s1'],
      questions: ['q1'],
      users: [{ address: '0x1' }],
      filters: ['f1'],
    };
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue(source);

    const result = instance.getBookmarksCache();
    result.surveys.push('s2');
    result.questions.push('q2');
    result.users.push({ address: '0x2' });
    result.filters.push('f2');

    expect(peekSpy).toHaveBeenCalledWith('bookmarksCache', 'edge', { clone: false });
    expect(source).toEqual({
      surveys: ['s1'],
      questions: ['q1'],
      users: [{ address: '0x1' }],
      filters: ['f1'],
    });

    peekSpy.mockRestore();
  });

  it('adds a bookmark from the rendered control without opening nickname editing', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      viewAddress,
      activeSessionSlug: 'session-a',
    });
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({
      surveys: [],
      questions: [],
      users: [],
      filters: [],
    });
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(true);

    try {
      const tree = instance.render();
      const bookmarkButtons = collectTreeNodes(
        tree,
        (node) => node?.type === 'button' && node?.props?.['aria-label'] === 'Bookmark user',
      );

      expect(bookmarkButtons).toHaveLength(1);
      expect(() => bookmarkButtons[0].props.onClick()).not.toThrow();

      expect(peekSpy).toHaveBeenCalledWith('bookmarksCache', 'session-a', { clone: false });
      expect(writeSpy).toHaveBeenCalledWith('bookmarksCache', 'session-a', {
        surveys: [],
        questions: [],
        users: [viewAddress],
        filters: [],
      });
      expect(instance.state.bookmarked).toBe(true);
      expect(instance.state.isEditingNickname).toBe(false);

      const updatedTree = instance.render();
      const removeButtons = collectTreeNodes(
        updatedTree,
        (node) => node?.type === 'button' && node?.props?.['aria-label'] === 'Remove bookmark',
      );
      expect(removeButtons).toHaveLength(1);
      expect(removeButtons[0].props.style).toEqual({ color: 'yellow' });
    } finally {
      peekSpy.mockRestore();
      writeSpy.mockRestore();
    }
  });

  it('keeps bookmark dispatch active when content cache readiness is disabled', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      viewAddress,
      activeSessionSlug: 'session-cache',
      isSurveyCacheReady: false,
      isQuestionCacheReady: false,
      isResponsesCacheReady: false,
      isSBTCacheReady: false,
    });
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({
      surveys: [],
      questions: [],
      users: [],
      filters: [],
    });
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(true);

    try {
      const tree = instance.render();
      const bookmarkButtons = collectTreeNodes(
        tree,
        (node) => node?.type === 'button' && node?.props?.['aria-label'] === 'Bookmark user',
      );

      expect(bookmarkButtons).toHaveLength(1);
      expect(bookmarkButtons[0].props.disabled).toBeUndefined();
      expect(() => bookmarkButtons[0].props.onClick({ preventDefault: jest.fn() })).not.toThrow();

      expect(peekSpy).toHaveBeenCalledWith('bookmarksCache', 'session-cache', { clone: false });
      expect(writeSpy).toHaveBeenCalledWith('bookmarksCache', 'session-cache', {
        surveys: [],
        questions: [],
        users: [viewAddress],
        filters: [],
      });
      expect(instance.state.bookmarked).toBe(true);
    } finally {
      peekSpy.mockRestore();
      writeSpy.mockRestore();
    }
  });

  it('falls back to the empty bookmarks slug when no session slug props are present', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      viewAddress,
      minimized: true,
      activeSessionSlug: undefined,
      sessionSlug: undefined,
    });
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({
      surveys: [],
      questions: [],
      users: [],
      filters: [],
    });
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(true);

    try {
      expect(instance.getActiveSessionSlug()).toBe('');
      expect(() => instance.toggleBookmark()).not.toThrow();
      expect(writeSpy).toHaveBeenCalledWith('bookmarksCache', '', {
        surveys: [],
        questions: [],
        users: [viewAddress],
        filters: [],
      });
      expect(instance.state.bookmarked).toBe(true);
    } finally {
      peekSpy.mockRestore();
      writeSpy.mockRestore();
    }
  });

  it('recognizes existing legacy string and object bookmarks', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const legacyInstance = makeInstance({ viewAddress });
    legacyInstance.getBookmarksCache = jest.fn(() => ({
      surveys: [],
      questions: [],
      users: [viewAddress.toUpperCase()],
      filters: [],
    }));

    legacyInstance.checkIfBookmarked();

    expect(legacyInstance.state.bookmarked).toBe(true);
    expect(legacyInstance.state.nicknameInput).toBe('');

    const objectInstance = makeInstance({ viewAddress });
    objectInstance.getBookmarksCache = jest.fn(() => ({
      surveys: [],
      questions: [],
      users: [{ address: viewAddress.toLowerCase(), nickname: 'Alice' }],
      filters: [],
    }));

    objectInstance.checkIfBookmarked();

    expect(objectInstance.state.bookmarked).toBe(true);
    expect(objectInstance.state.nicknameInput).toBe('Alice');
  });

  it('skips bookmark state writes when computed bookmark values are unchanged', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({ viewAddress });
    instance.state = {
      ...instance.state,
      bookmarked: false,
      nicknameInput: 'keep-me',
    };
    instance.getBookmarksCache = jest.fn(() => ({
      surveys: [],
      questions: [],
      users: [],
      filters: [],
    }));
    instance.setState.mockClear();

    instance.checkIfBookmarked();

    expect(instance.setState).not.toHaveBeenCalled();
  });

  it('updates bookmark state when computed bookmark or nickname values change', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({ viewAddress });
    instance.state = {
      ...instance.state,
      bookmarked: false,
      nicknameInput: '',
    };
    instance.getBookmarksCache = jest.fn(() => ({
      surveys: [],
      questions: [],
      users: [{ address: viewAddress, nickname: 'Alice' }],
      filters: [],
    }));
    instance.setState.mockClear();

    instance.checkIfBookmarked();

    expect(instance.setState).toHaveBeenCalledTimes(1);
    expect(instance.setState.mock.calls[0][0]).toEqual({
      bookmarked: true,
      nicknameInput: 'Alice',
    });
  });

  it('clears nickname edit state when removing a bookmarked user', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({ viewAddress });
    instance.state = {
      ...instance.state,
      bookmarked: true,
      nicknameInput: 'Alice',
      isEditingNickname: true,
    };
    instance.getBookmarksCache = jest.fn(() => ({
      surveys: [],
      questions: [],
      users: [{ address: viewAddress.toLowerCase(), nickname: 'Alice' }],
      filters: [],
    }));
    instance.persistBookmarksCache = jest.fn();

    instance.toggleBookmark();

    expect(instance.persistBookmarksCache).toHaveBeenCalledWith(
      {
        surveys: [],
        questions: [],
        users: [],
        filters: [],
      },
      'toggleBookmark',
    );
    expect(instance.state.bookmarked).toBe(false);
    expect(instance.state.isEditingNickname).toBe(false);
    expect(instance.state.nicknameInput).toBe('');
  });
});
