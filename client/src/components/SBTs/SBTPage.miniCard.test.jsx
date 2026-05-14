import SBTPage from './SBTPage';
import styles from './SBTPage.module.scss';
import { getShortenedAddress } from '../../utilities/ui/displayHelpers.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';

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

const flattenText = (node) => {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map((entry) => flattenText(entry)).join('');
  if (typeof node === 'object') return flattenText(node?.props?.children);
  return '';
};

const renderMiniCardNode = (props = {}) => {
  const sbtAddress = '0x00000000000000000000000000000000000000f1';
  const subject = createSubject({
    miniaturized: true,
    miniMintable: true,
    SBTAddress: sbtAddress,
    ...props,
  });
  subject.state = {
    ...subject.state,
    sbtInfo: {
      name: 'Badge',
      image: 'https://example.example.test/badge.png',
      mintingEndTime: 0,
      burnAuth: 0,
      hasPasswordMint: false,
      maxTokens: '0',
      admin: '0x00000000000000000000000000000000000000a2',
    },
    userHasSBT: false,
    userIsSbtAdmin: false,
    mintingStatus: 'idle',
    burningStatus: 'idle',
    hasGroupPasswordMint: false,
    hasInviteMint: false,
  };
  const tree = subject.render();
  const cardNode = findElementInTree(
    tree,
    (element) => element?.props?.role === 'button' && typeof element?.props?.onClick === 'function'
  );
  return { cardNode, sbtAddress };
};

describe('SBTPage mini-card', () => {
  beforeEach(() => {
    mockIsCryptoMode.mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('opens mini-card navigation when click originates from the card itself', () => {
    const { cardNode, sbtAddress } = renderMiniCardNode();
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    const preventDefault = jest.fn();
    const stopPropagation = jest.fn();
    const cardTarget = { closest: jest.fn(() => cardTarget) };

    cardNode.props.onClick({
      target: cardTarget,
      currentTarget: cardTarget,
      preventDefault,
      stopPropagation,
    });

    expect(openSpy).toHaveBeenCalledWith(
      `${window.location.origin}${buildSbtDetailPath(sbtAddress)}`,
      '_blank',
      'noopener,noreferrer'
    );
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    openSpy.mockRestore();
  });

  it('hides the mini-card address in plain mode', () => {
    mockIsCryptoMode.mockReturnValue(false);
    const { cardNode } = renderMiniCardNode();

    expect(findElementInTree(cardNode, (element) => element?.props?.id === styles.miniSbtAddress)).toBeNull();
  });

  it('shows the mini-card address in crypto mode', () => {
    mockIsCryptoMode.mockReturnValue(true);
    const { cardNode, sbtAddress } = renderMiniCardNode();
    const addressNode = findElementInTree(cardNode, (element) => element?.props?.id === styles.miniSbtAddress);

    expect(addressNode).not.toBeNull();
    expect(flattenText(addressNode)).toContain(getShortenedAddress(sbtAddress, false));
  });

  it('includes the resolved session slug in mini-card navigation when one is available', () => {
    const { cardNode, sbtAddress } = renderMiniCardNode({ sessionSlug: 'edge-private' });
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    const preventDefault = jest.fn();
    const stopPropagation = jest.fn();
    const cardTarget = { closest: jest.fn(() => cardTarget) };

    cardNode.props.onClick({
      target: cardTarget,
      currentTarget: cardTarget,
      preventDefault,
      stopPropagation,
    });

    expect(openSpy).toHaveBeenCalledWith(
      `${window.location.origin}${buildSbtDetailPath(sbtAddress, 'edge-private')}`,
      '_blank',
      'noopener,noreferrer'
    );
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    openSpy.mockRestore();
  });

  it('ignores mini-card click and Enter key events from nested interactive elements', () => {
    const { cardNode } = renderMiniCardNode();
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    const preventDefault = jest.fn();
    const nestedInteractive = {};
    const nestedTarget = { closest: jest.fn(() => nestedInteractive) };
    const currentTarget = {};

    cardNode.props.onClick({
      target: nestedTarget,
      currentTarget,
      preventDefault,
      stopPropagation: jest.fn(),
    });
    cardNode.props.onKeyDown({
      key: 'Enter',
      target: nestedTarget,
      currentTarget,
      preventDefault,
    });

    expect(openSpy).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });
});
