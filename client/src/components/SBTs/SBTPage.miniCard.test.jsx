import SBTPage from './SBTPage';
import SbtPageMiniActionArea from './SbtPageMiniActionArea';
import SbtPageMiniCard from './SbtPageMiniCard';
import SbtPageMiniCardDisplay from './SbtPageMiniCardDisplay';
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

jest.mock('../Shared/CETooltip', () => ({
  __esModule: true,
  default: ({ children }) => <span>{children}</span>,
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

const RESOLVABLE_TREE_COMPONENTS = new Set([SbtPageMiniActionArea, SbtPageMiniCardDisplay]);
const resolvedTreeComponentCache = new WeakMap();

const findElementInTree = (node, predicate) => {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  if (RESOLVABLE_TREE_COMPONENTS.has(node.type)) {
    if (!resolvedTreeComponentCache.has(node)) {
      resolvedTreeComponentCache.set(node, node.type(node.props || {}));
    }
    return findElementInTree(resolvedTreeComponentCache.get(node), predicate);
  }
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
  if (typeof node === 'object') {
    if (RESOLVABLE_TREE_COMPONENTS.has(node.type)) {
      if (!resolvedTreeComponentCache.has(node)) {
        resolvedTreeComponentCache.set(node, node.type(node.props || {}));
      }
      return flattenText(resolvedTreeComponentCache.get(node));
    }
    return flattenText(node?.props?.children);
  }
  return '';
};

const nodeHasClassName = (node, className) =>
  String(node?.props?.className || '')
    .split(/\s+/)
    .includes(className);

const renderMiniCardNode = (props = {}, stateOverrides = {}, configureSubject = null) => {
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
    showMiniPasswordInput: false,
    ...stateOverrides,
  };
  if (typeof configureSubject === 'function') configureSubject(subject);
  const tree = subject.render();
  const cardNode = findElementInTree(tree, (element) => element?.type === SbtPageMiniCard);
  return { cardNode, sbtAddress, subject };
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

    cardNode.props.onCardClick({
      target: cardTarget,
      currentTarget: cardTarget,
      preventDefault,
      stopPropagation,
    });

    expect(openSpy).toHaveBeenCalledWith(
      `${window.location.origin}${buildSbtDetailPath(sbtAddress)}`,
      '_blank',
      'noopener,noreferrer',
    );
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    openSpy.mockRestore();
  });

  it('hides the mini-card address in plain mode', () => {
    mockIsCryptoMode.mockReturnValue(false);
    const { cardNode } = renderMiniCardNode();
    const cardTree = SbtPageMiniCard(cardNode.props);

    expect(cardNode.props.showMiniSbtAddress).toBe(false);
    expect(findElementInTree(cardTree, (element) => nodeHasClassName(element, styles.miniSbtAddress))).toBeNull();
  });

  it('shows the mini-card address in crypto mode', () => {
    mockIsCryptoMode.mockReturnValue(true);
    const { cardNode, sbtAddress } = renderMiniCardNode();
    const cardTree = SbtPageMiniCard(cardNode.props);
    const addressNode = findElementInTree(cardTree, (element) => nodeHasClassName(element, styles.miniSbtAddress));

    expect(cardNode.props.showMiniSbtAddress).toBe(true);
    expect(addressNode).not.toBeNull();
    expect(flattenText(addressNode)).toContain(getShortenedAddress(sbtAddress, false));
  });

  it('passes the parent-derived mini mint action plan to the mini card', () => {
    const { cardNode } = renderMiniCardNode();

    expect(cardNode.props.miniMintActionPlan).toMatchObject({
      blockedReason: 'none',
      disabled: false,
      handlerKind: 'mini-mint',
      inertReason: 'none',
      isInteractive: true,
      labelKind: 'status',
      shouldRenderMintArea: true,
      viewKind: 'open-mint-button',
    });
  });

  it('routes mini-card mint clicks through the parent mini mint handler', () => {
    const miniMintHandler = jest.fn();
    const { cardNode } = renderMiniCardNode({}, {}, (subject) => {
      subject.miniMintHandler = miniMintHandler;
    });
    const preventDefault = jest.fn();

    cardNode.props.onMiniMint({ preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(miniMintHandler).toHaveBeenCalledTimes(1);
  });

  it('does not route disabled mini-card mint clicks to the parent handler', () => {
    const miniMintHandler = jest.fn();
    const { cardNode } = renderMiniCardNode({}, { mintingStatus: 'pending' }, (subject) => {
      subject.miniMintHandler = miniMintHandler;
    });
    const preventDefault = jest.fn();

    expect(cardNode.props.miniMintActionPlan).toMatchObject({
      disabled: true,
      handlerKind: 'mini-mint',
      inertReason: 'disabled',
    });

    cardNode.props.onMiniMint({ preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(miniMintHandler).not.toHaveBeenCalled();
  });

  it('keeps manual mini-card claim pending state inert while preserving parent wiring', () => {
    const miniMintHandler = jest.fn();
    const { cardNode } = renderMiniCardNode(
      {},
      {
        manualPasswordInput: 'claim-code',
        mintingStatus: 'pending',
        sbtInfo: {
          name: 'Badge',
          image: 'https://example.example.test/badge.png',
          mintingEndTime: 0,
          burnAuth: 0,
          hasPasswordMint: true,
          maxTokens: '0',
          admin: '0x00000000000000000000000000000000000000a2',
        },
        showMiniPasswordInput: true,
      },
      (subject) => {
        subject.miniMintHandler = miniMintHandler;
      },
    );
    const cardTree = SbtPageMiniCard(cardNode.props);
    const passwordInput = findElementInTree(
      cardTree,
      (element) => element?.type === 'input' && element?.props?.placeholder === 'Password',
    );
    const actionButton = findElementInTree(
      cardTree,
      (element) => element?.type === 'button' && element?.props?.onClick === cardNode.props.onMiniMint,
    );
    const preventDefault = jest.fn();

    expect(cardNode.props.miniMintActionPlan).toMatchObject({
      disabled: true,
      handlerKind: 'mini-mint',
      inertReason: 'disabled',
      viewKind: 'manual-password-start-input',
    });
    expect(cardNode.props.miniManualClaimActionRequest).toMatchObject({
      disabled: true,
      handlerKind: 'mini-mint',
      inputDisabled: true,
      inputValue: 'claim-code',
      shouldRenderInputAction: true,
      viewKind: 'manual-password-start-input',
      buttonState: {
        disabled: true,
        isPending: true,
      },
    });
    expect(passwordInput?.props).toMatchObject({
      disabled: true,
      value: 'claim-code',
    });
    expect(actionButton?.props.disabled).toBe(true);

    cardNode.props.onMiniMint({ preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(miniMintHandler).not.toHaveBeenCalled();
  });

  it('keeps manual mini-card claim countdown display inert while reusing parent action ports', () => {
    const miniMintHandler = jest.fn();
    const { cardNode } = renderMiniCardNode(
      {},
      {
        claimCountdown: 12,
        mintStep: 1,
        sbtInfo: {
          name: 'Badge',
          image: 'https://example.example.test/badge.png',
          mintingEndTime: 0,
          burnAuth: 0,
          hasPasswordMint: true,
          maxTokens: '0',
          admin: '0x00000000000000000000000000000000000000a2',
        },
      },
      (subject) => {
        subject.miniMintHandler = miniMintHandler;
      },
    );
    const cardTree = SbtPageMiniCard(cardNode.props);
    const preventDefault = jest.fn();

    expect(cardNode.props.miniMintActionPlan).toMatchObject({
      disabled: false,
      handlerKind: 'none',
      inertReason: 'status-only',
      isInteractive: false,
      labelKind: 'countdown',
      viewKind: 'manual-claim-countdown',
    });
    expect(cardNode.props.miniManualClaimActionRequest).toMatchObject({
      handlerKind: 'none',
      shouldRenderStatus: true,
      statusText: 'Wait: 12s',
      viewKind: 'manual-claim-countdown',
    });
    expect(flattenText(cardTree)).toContain('Wait: 12s');

    cardNode.props.onMiniMint({ preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(miniMintHandler).not.toHaveBeenCalled();
  });

  it('routes mini-card invite and group-password mint clicks through parent handlers', () => {
    const claimWithInviteCode = jest.fn();
    const { cardNode: inviteCardNode } = renderMiniCardNode(
      {},
      {
        groupPasswordInput: 'invite-code',
        hasInviteMint: true,
        showMiniPasswordInput: true,
      },
      (subject) => {
        subject.claimWithInviteCode = claimWithInviteCode;
      },
    );

    inviteCardNode.props.onClaimWithInviteCode({ preventDefault: jest.fn() });
    expect(claimWithInviteCode).toHaveBeenCalledTimes(1);
    expect(claimWithInviteCode).toHaveBeenCalledWith('invite-code');

    const mintUnlimitedWithGroupPassword = jest.fn();
    const { cardNode: groupPasswordCardNode } = renderMiniCardNode(
      {},
      {
        groupPasswordInput: 'group-code',
        hasGroupPasswordMint: true,
        showMiniPasswordInput: true,
      },
      (subject) => {
        subject.mintUnlimitedWithGroupPassword = mintUnlimitedWithGroupPassword;
      },
    );

    groupPasswordCardNode.props.onMintUnlimitedWithGroupPassword({ preventDefault: jest.fn() });
    expect(mintUnlimitedWithGroupPassword).toHaveBeenCalledTimes(1);
    expect(mintUnlimitedWithGroupPassword).toHaveBeenCalledWith();
  });

  it('keeps pending mini-card invite and group-password joins disabled and inert', () => {
    const claimWithInviteCode = jest.fn();
    const { cardNode: inviteCardNode } = renderMiniCardNode(
      {},
      {
        groupPasswordInput: 'invite-code',
        hasInviteMint: true,
        mintingStatus: 'pending',
        showMiniPasswordInput: true,
      },
      (subject) => {
        subject.claimWithInviteCode = claimWithInviteCode;
      },
    );
    const inviteCardTree = SbtPageMiniCard(inviteCardNode.props);
    const inviteButton = findElementInTree(
      inviteCardTree,
      (element) => element?.type === 'button' && element?.props?.onClick === inviteCardNode.props.onClaimWithInviteCode,
    );

    expect(inviteCardNode.props.miniMintActionPlan).toMatchObject({
      disabled: true,
      handlerKind: 'claim-with-invite-code',
      inertReason: 'disabled',
      viewKind: 'invite-input',
    });
    expect(inviteButton?.props.disabled).toBe(true);
    inviteCardNode.props.onClaimWithInviteCode({ preventDefault: jest.fn() });
    expect(claimWithInviteCode).not.toHaveBeenCalled();

    const mintUnlimitedWithGroupPassword = jest.fn();
    const { cardNode: groupPasswordCardNode } = renderMiniCardNode(
      {},
      {
        groupPasswordInput: 'group-code',
        hasGroupPasswordMint: true,
        mintingStatus: 'pending',
        showMiniPasswordInput: true,
      },
      (subject) => {
        subject.mintUnlimitedWithGroupPassword = mintUnlimitedWithGroupPassword;
      },
    );
    const groupPasswordCardTree = SbtPageMiniCard(groupPasswordCardNode.props);
    const groupPasswordButton = findElementInTree(
      groupPasswordCardTree,
      (element) =>
        element?.type === 'button' &&
        element?.props?.onClick === groupPasswordCardNode.props.onMintUnlimitedWithGroupPassword,
    );

    expect(groupPasswordCardNode.props.miniMintActionPlan).toMatchObject({
      disabled: true,
      handlerKind: 'mint-unlimited-with-group-password',
      inertReason: 'disabled',
      viewKind: 'group-password-input',
    });
    expect(groupPasswordButton?.props.disabled).toBe(true);
    groupPasswordCardNode.props.onMintUnlimitedWithGroupPassword({ preventDefault: jest.fn() });
    expect(mintUnlimitedWithGroupPassword).not.toHaveBeenCalled();
  });

  it('routes mini-card disclosure clicks through the parent password input action', () => {
    const { cardNode, subject } = renderMiniCardNode(
      {},
      {
        hasInviteMint: true,
        showMiniPasswordInput: false,
      },
    );
    const preventDefault = jest.fn();

    cardNode.props.onShowMiniPasswordInput({ preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(subject.state.showMiniPasswordInput).toBe(true);
  });

  it('includes the resolved session slug in mini-card navigation when one is available', () => {
    const { cardNode, sbtAddress } = renderMiniCardNode({ sessionSlug: 'edge-private' });
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    const preventDefault = jest.fn();
    const stopPropagation = jest.fn();
    const cardTarget = { closest: jest.fn(() => cardTarget) };

    cardNode.props.onCardClick({
      target: cardTarget,
      currentTarget: cardTarget,
      preventDefault,
      stopPropagation,
    });

    expect(openSpy).toHaveBeenCalledWith(
      `${window.location.origin}${buildSbtDetailPath(sbtAddress, 'edge-private')}`,
      '_blank',
      'noopener,noreferrer',
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

    cardNode.props.onCardClick({
      target: nestedTarget,
      currentTarget,
      preventDefault,
      stopPropagation: jest.fn(),
    });
    cardNode.props.onCardKeyDown({
      key: 'Enter',
      target: nestedTarget,
      currentTarget,
      preventDefault,
    });

    expect(openSpy).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('routes mini-card burn clicks through the parent mini burn handler', () => {
    const subject = createSubject({
      account: '0x00000000000000000000000000000000000000f1',
      miniaturized: true,
      miniMintable: true,
      SBTAddress: '0x00000000000000000000000000000000000000f1',
    });
    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Badge',
        image: 'https://example.example.test/badge.png',
        mintingEndTime: 0,
        burnAuth: 1,
        hasPasswordMint: false,
        maxTokens: '0',
        admin: '0x00000000000000000000000000000000000000a2',
      },
      userHasSBT: true,
      userIsSbtAdmin: false,
      mintingStatus: 'idle',
      burningStatus: 'idle',
      hasGroupPasswordMint: false,
      hasInviteMint: false,
    };
    subject.miniBurnHandler = jest.fn();

    const tree = subject.render();
    const miniCardNode = findElementInTree(tree, (element) => element?.type === SbtPageMiniCard);

    expect(miniCardNode).not.toBeNull();
    miniCardNode.props.onMiniBurn({ preventDefault: jest.fn() });
    expect(subject.miniBurnHandler).toHaveBeenCalledTimes(1);
  });
});
