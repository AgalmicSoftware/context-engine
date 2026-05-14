import SBTPage from './SBTPage';

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

describe('SBTPage holder signatures', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('reuses memoized net-holder list when holder signatures are unchanged', () => {
    const subject = createSubject();
    const minted = ['0xA', '0xB'];
    const burned = ['0xB'];

    const first = subject.getMemoizedNetHoldersList(minted, burned);
    const second = subject.getMemoizedNetHoldersList(minted, burned);
    const third = subject.getMemoizedNetHoldersList([...minted], burned);

    expect(first).toEqual(['0xa']);
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('skips modal filtered-list state updates when signatures are equivalent', () => {
    const subject = createSubject();
    const baseline = ['0xabc'];

    subject.state = {
      ...subject.state,
      filteredMintedUsers: baseline,
      filteredMintedUsersSignature: subject.buildAddressListSignature(baseline),
      loadingMintedFilter: false,
    };

    subject.handleModalFilteredMintedUsers(['0xAbC']);
    expect(subject.setState).not.toHaveBeenCalled();
  });

  it('keeps address signatures stable for equivalent lists with different casing', () => {
    const subject = createSubject();
    const sig1 = subject.buildAddressListSignature(['0xabc', '0xdef']);
    const sig2 = subject.buildAddressListSignature(['0xAbC', '0xDeF']);
    expect(sig2).toBe(sig1);
  });

  it('changes address signatures when list content changes at equal length', () => {
    const subject = createSubject();
    const sig1 = subject.buildAddressListSignature(['0xabc', '0xdef']);
    const sig2 = subject.buildAddressListSignature(['0xabc', '0x999']);
    expect(sig2).not.toBe(sig1);
  });

  it('changes address signatures when the same list reference mutates in place', () => {
    const subject = createSubject();
    const shared = ['0xabc', '0xdef'];
    const sig1 = subject.buildAddressListSignature(shared);
    shared[1] = '0x999';
    const sig2 = subject.buildAddressListSignature(shared);
    expect(sig2).not.toBe(sig1);
  });
});
