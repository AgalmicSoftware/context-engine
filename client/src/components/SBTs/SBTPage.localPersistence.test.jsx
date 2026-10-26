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

  it("keeps another tab's managed bookmarks while updating the legacy localStorage mirror", () => {
    jest.useFakeTimers();
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({ sbts: [] });
    const saved = Object.freeze({ sbts: Object.freeze(['0xother']), questions: Object.freeze(['q-other-tab']) });
    let persisted;
    const updateSpy = jest
      .spyOn(cacheScripts, 'updateCacheAtomic')
      .mockImplementation(async (_namespace, _slug, update) => {
        persisted = update(saved);
        return persisted;
      });
    const subject = createSubject({
      SBTAddress: '0xAbC0000000000000000000000000000000000000',
      activeSessionSlug: 'edge',
    });

    subject.bookmarkSBT();
    jest.runOnlyPendingTimers();

    expect(updateSpy).toHaveBeenCalledWith('bookmarksCache', 'edge', expect.any(Function));
    expect(persisted).toEqual({
      sbts: ['0xother', '0xabc0000000000000000000000000000000000000'],
      questions: ['q-other-tab'],
    });
    expect(saved.sbts).toEqual(['0xother']);
    expect(JSON.parse(localStorage.getItem('bookmarks'))?.sbts || []).toContain(
      '0xAbC0000000000000000000000000000000000000',
    );
  });

  it('uses props.slug as the bookmark cache fallback when explicit session props are absent', () => {
    jest.useFakeTimers();
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({ sbts: [] });
    const updateSpy = jest.spyOn(cacheScripts, 'updateCacheAtomic').mockResolvedValue({});
    const subject = createSubject({
      SBTAddress: '0xAbD0000000000000000000000000000000000000',
      slug: 'route-slug',
    });

    subject.bookmarkSBT();
    jest.runOnlyPendingTimers();

    expect(updateSpy).toHaveBeenCalledWith('bookmarksCache', 'route-slug', expect.any(Function));
    expect(updateSpy.mock.calls[0][2]({})).toEqual(
      expect.objectContaining({
        sbts: expect.arrayContaining(['0xabd0000000000000000000000000000000000000']),
      }),
    );
  });

  it('does not duplicate an SBT that another tab has already bookmarked', () => {
    jest.useFakeTimers();
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({ sbts: [] });
    const address = '0xAbD0000000000000000000000000000000000000';
    const saved = Object.freeze({ sbts: Object.freeze([address]), surveys: Object.freeze(['s-other-tab']) });
    let persisted;
    jest.spyOn(cacheScripts, 'updateCacheAtomic').mockImplementation(async (_namespace, _slug, update) => {
      persisted = update(saved);
      return persisted;
    });

    createSubject({ SBTAddress: address, activeSessionSlug: 'edge' }).bookmarkSBT();
    jest.runOnlyPendingTimers();

    expect(persisted).toEqual(saved);
    expect(persisted.sbts).not.toBe(saved.sbts);
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
