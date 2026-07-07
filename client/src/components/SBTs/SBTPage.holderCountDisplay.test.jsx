import SBTPage from './SBTPage';
import styles from './SBTPage.module.scss';

const mockIsCryptoMode = jest.fn(() => true);

jest.mock('../../utilities/ui/terminology.js', () => {
  const actual = jest.requireActual('../../utilities/ui/terminology.js');
  return {
    __esModule: true,
    ...actual,
    isCryptoMode: (...args) => mockIsCryptoMode(...args),
  };
});

jest.mock('utilities/ui/blockieAvatars.js', () => ({
  generateBlockieDataUrl: jest.fn(() => ''),
}));

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

const findElementInTree = (node, predicate) => {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  const children = node?.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findElementInTree(child, predicate);
      if (found) return found;
    }
    return null;
  }
  if (children) return findElementInTree(children, predicate);
  return null;
};

const treeIncludesText = (node, text) => {
  if (node == null) return false;
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (Array.isArray(node)) {
    return node.some((entry) => treeIncludesText(entry, text));
  }
  if (typeof node === 'object') {
    return treeIncludesText(node?.props?.children, text);
  }
  return false;
};

const flattenText = (node) => {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map((entry) => flattenText(entry)).join('');
  if (typeof node === 'object') return flattenText(node?.props?.children);
  return '';
};

const setRenderableSbtState = (subject, overrides = {}) => {
  subject.state = {
    ...subject.state,
    sbtInfo: {
      name: 'Badge',
      tokenURI: 'ar://HLDsCm3ALbbgjVTCPVLhU8aF9taAdKyD1DyB7A8zkaXM',
      image: 'https://example.example.test/badge.png',
      mintingEndTime: 0,
      burnAuth: 0,
      maxTokens: '0',
      admin: '0x00000000000000000000000000000000000000a2',
    },
    countsLoaded: true,
    showModal: true,
    loadingMintersBurners: false,
    ...overrides,
  };
};

describe('SBTPage holder count display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows net holder count when burns create a holder gap', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    setRenderableSbtState(subject, {
      mintedAddresses: [
        '0x00000000000000000000000000000000000000b1',
        '0x00000000000000000000000000000000000000b2',
        '0x00000000000000000000000000000000000000b3',
        '0x00000000000000000000000000000000000000b4',
        '0x00000000000000000000000000000000000000b5',
        '0x00000000000000000000000000000000000000b6',
        '0x00000000000000000000000000000000000000b7',
      ],
      burnedAddresses: ['0x00000000000000000000000000000000000000b6', '0x00000000000000000000000000000000000000b7'],
      mintedTokensOverride: '7',
    });

    const tree = subject.render();
    const modalCount = findElementInTree(tree, (element) => element?.props?.className === styles.modalTitleCount);
    expect(modalCount).toBeTruthy();
    expect(flattenText(modalCount)).toBe('(5)');
  });

  it('shows approximate holder count from mintedTokens override even after local loading flags clear', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    setRenderableSbtState(subject, {
      mintedAddresses: [],
      burnedAddresses: [],
      mintedTokensOverride: '1',
    });

    const tree = subject.render();
    expect(treeIncludesText(tree, '~1')).toBe(true);
    expect(treeIncludesText(tree, 'No holders found.')).toBe(false);
  });

  it('shows net holder count from mint history when override is absent', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    setRenderableSbtState(subject, {
      mintedAddresses: [
        '0x00000000000000000000000000000000000000b1',
        '0x00000000000000000000000000000000000000b2',
        '0x00000000000000000000000000000000000000b3',
        '0x00000000000000000000000000000000000000b4',
      ],
      burnedAddresses: ['0x00000000000000000000000000000000000000b3'],
      mintedTokensOverride: null,
    });

    const tree = subject.render();
    const modalCount = findElementInTree(tree, (element) => element?.props?.className === styles.modalTitleCount);
    expect(modalCount).toBeTruthy();
    expect(flattenText(modalCount)).toBe('(3)');
  });

  it('shows zero holders when all tokens are burned', () => {
    const subject = createSubject({
      SBTAddress: '0x00000000000000000000000000000000000000a1',
    });
    setRenderableSbtState(subject, {
      mintedAddresses: ['0x00000000000000000000000000000000000000b1', '0x00000000000000000000000000000000000000b2'],
      burnedAddresses: ['0x00000000000000000000000000000000000000b1', '0x00000000000000000000000000000000000000b2'],
      mintedTokensOverride: null,
    });

    const tree = subject.render();
    const modalCount = findElementInTree(tree, (element) => element?.props?.className === styles.modalTitleCount);
    expect(modalCount).toBeTruthy();
    expect(flattenText(modalCount)).toBe('(0)');
  });
});
