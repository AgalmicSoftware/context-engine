import SBTPage from './SBTPage';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';

const createSubject = (props = {}) => {
  const subject = new SBTPage({
    network: { id: 84532, name: 'Base Sepolia' },
    provider: 'mock',
    ...props,
  });
  subject._isMounted = true;
  subject.setState = jest.fn((next, cb) => {
    const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
    subject.state = { ...subject.state, ...(patch || {}) };
    if (typeof cb === 'function') cb();
    return patch;
  });
  return subject;
};

describe('SBTPage local persistence', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    jest.restoreAllMocks();
    localStorage.clear();
    window.sessionStorage.clear();
  });

  it('writes bookmark updates to managed cache and legacy localStorage', () => {
    jest.useFakeTimers();
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({ sbts: [] });
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(true);
    const subject = createSubject({
      SBTAddress: '0xAbC0000000000000000000000000000000000000',
      activeSessionSlug: 'edge',
    });

    subject.bookmarkSBT();
    jest.runOnlyPendingTimers();

    expect(peekSpy).toHaveBeenCalledWith('bookmarksCache', 'edge', { clone: false });
    expect(writeSpy).toHaveBeenCalledWith(
      'bookmarksCache',
      'edge',
      expect.objectContaining({
        sbts: expect.arrayContaining(['0xabc0000000000000000000000000000000000000']),
      }),
    );
    expect(JSON.parse(localStorage.getItem('bookmarks'))?.sbts || []).toContain(
      '0xAbC0000000000000000000000000000000000000',
    );
  });

  it('uses props.slug as the bookmark cache fallback when explicit session props are absent', () => {
    jest.useFakeTimers();
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({ sbts: [] });
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(true);
    const subject = createSubject({
      SBTAddress: '0xAbD0000000000000000000000000000000000000',
      slug: 'route-slug',
    });

    subject.bookmarkSBT();
    jest.runOnlyPendingTimers();

    expect(peekSpy).toHaveBeenCalledWith('bookmarksCache', 'route-slug', { clone: false });
    expect(writeSpy).toHaveBeenCalledWith(
      'bookmarksCache',
      'route-slug',
      expect.objectContaining({
        sbts: expect.arrayContaining(['0xabd0000000000000000000000000000000000000']),
      }),
    );
  });

  it('coalesces repeated sbtDetails writes when payload is unchanged', () => {
    jest.useFakeTimers();
    const setSpy = jest.spyOn(Storage.prototype, 'setItem');
    const subject = createSubject({
      SBTAddress: '0xdef0000000000000000000000000000000000000',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: { name: 'Badge', creator: '0xabc' },
    };

    subject.storeSBTDetails();
    subject.storeSBTDetails();
    jest.runOnlyPendingTimers();

    expect(setSpy.mock.calls.filter((call) => call[0] === 'sbtDetails')).toHaveLength(1);
    setSpy.mockRestore();
  });

  it('retains queued transaction hashes when multiple writes happen before flush', () => {
    jest.useFakeTimers();
    const subject = createSubject({ account: '0xABC' });

    subject.cacheTransactionHash('0xtx1');
    subject.cacheTransactionHash('0xtx2');
    jest.runOnlyPendingTimers();

    const txCache = JSON.parse(localStorage.getItem('transactions') || '{}');
    expect(txCache['0xabc']).toEqual(['0xtx1', '0xtx2']);
  });
});
