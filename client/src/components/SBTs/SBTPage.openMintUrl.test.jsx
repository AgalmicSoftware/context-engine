import SBTPage from './SBTPage';
import SbtPageAdminSection from './SbtPageAdminSection';
import SbtPageOpenMintUrlCard from './SbtPageOpenMintUrlCard';
import { ethers } from 'ethers';
import { cryptoUtils } from 'utilities/crypto/cryptography.js';

const mockIsCryptoMode = jest.fn(() => true);
const RESOLVABLE_TREE_COMPONENTS = new Set([SbtPageAdminSection]);
const resolvedTreeComponentCache = new WeakMap();

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
  if (typeof node === 'object') return flattenText(node?.props?.children);
  return '';
};

const renderOpenMintUrlCardTree = (tree) => {
  const card = findElementInTree(tree, (element) => element?.type === SbtPageOpenMintUrlCard);
  return card ? SbtPageOpenMintUrlCard(card.props) : null;
};

describe('SBTPage admin open-mint URL', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    localStorage.clear();
    window.sessionStorage.clear();
  });

  it('renders the admin open-mint URL card for eligible public SBTs', () => {
    const account = '0x00000000000000000000000000000000000000a2';
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const subject = createSubject({
      SBTAddress: sbtAddress,
      account,
      sessionSlug: 'edge',
    });

    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Open Badge',
        image: 'https://example.example.test/badge.png',
        mintingEndTime: 0,
        burnAuth: 0,
        hasPasswordMint: false,
        maxTokens: '0',
        admin: account,
        chainID: 84532,
      },
      userIsSbtAdmin: true,
      showAdminSection: true,
      hasInviteMint: false,
      hasGroupPasswordMint: false,
      groupPasswordHash: ethers.constants.HashZero,
    };

    const tree = subject.render();
    const cardNode = renderOpenMintUrlCardTree(tree);

    expect(cardNode).not.toBeNull();
    expect(flattenText(cardNode)).toContain('URL Where Anyone Can Join');
    expect(flattenText(cardNode)).toContain('http://localhost/session/edge?sbt=');
  });

  it('prepends PUBLIC_URL when building the admin open-mint URL', () => {
    const previousPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = '/ce/';

    try {
      const sbtAddress = '0x00000000000000000000000000000000000000a1';
      const subject = createSubject({
        SBTAddress: sbtAddress,
        sessionSlug: 'edge',
      });

      subject.state = {
        ...subject.state,
        sbtInfo: {
          name: 'Open Badge',
          image: 'https://example.example.test/badge.png',
          mintingEndTime: 0,
          burnAuth: 0,
          hasPasswordMint: false,
          maxTokens: '0',
          admin: '0x00000000000000000000000000000000000000a2',
          chainID: 84532,
        },
        hasInviteMint: false,
        hasGroupPasswordMint: false,
        groupPasswordHash: ethers.constants.HashZero,
      };

      expect(subject.getOpenMintAutoJoinUrl()).toBe(
        `http://localhost/ce/session/edge?sbt=${encodeURIComponent(sbtAddress)}&auto=1`,
      );
    } finally {
      if (previousPublicUrl === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = previousPublicUrl;
    }
  });

  it('prepends PUBLIC_URL when rendering admin invite links', () => {
    const previousPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = '/ce/';

    try {
      const account = '0x00000000000000000000000000000000000000a2';
      const sbtAddress = '0x00000000000000000000000000000000000000a1';
      const subject = createSubject({
        SBTAddress: sbtAddress,
        account,
        sessionSlug: 'edge',
      });
      subject.state = {
        ...subject.state,
        userIsSbtAdmin: true,
        hasInviteMint: true,
        adminGeneratedPasswords: ['claim-code'],
        cachedPasswords: [],
        includePreviousPasswords: false,
        sbtInfo: {
          hasPasswordMint: true,
          maxTokens: '0',
          admin: account,
          burnAuth: 0,
        },
      };

      expect(flattenText(subject.renderAdminActions())).toContain(
        `http://localhost/ce/session/edge?auto=1&sbt=${sbtAddress}`,
      );
    } finally {
      if (previousPublicUrl === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = previousPublicUrl;
    }
  });

  it('prepends PUBLIC_URL when exporting admin invite links', () => {
    const previousPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = '/ce/';
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const OriginalBlob = global.Blob;
    let capturedBlob = null;

    global.Blob = jest.fn((parts, options) => ({ parts, options }));
    URL.createObjectURL = jest.fn((blob) => {
      capturedBlob = blob;
      return 'blob:invite-export';
    });
    URL.revokeObjectURL = jest.fn();

    try {
      const sbtAddress = '0x00000000000000000000000000000000000000a1';
      const subject = createSubject({
        SBTAddress: sbtAddress,
        sessionSlug: 'edge',
      });
      subject.state = {
        ...subject.state,
        hasInviteMint: true,
        adminGeneratedPasswords: ['claim-code'],
        cachedPasswords: [],
        includePreviousPasswords: false,
        exportFormat: 'json',
        sbtInfo: {
          name: 'Invite Badge',
        },
      };

      subject.exportPasswords();

      expect(capturedBlob).not.toBeNull();
      expect(String(capturedBlob.parts.join(''))).toContain(
        `http://localhost/ce/session/edge?auto=1&sbt=${sbtAddress}`,
      );
      expect(String(capturedBlob.parts.join(''))).not.toContain('gp=');
    } finally {
      global.Blob = OriginalBlob;
      URL.createObjectURL = originalCreateObjectUrl;
      URL.revokeObjectURL = originalRevokeObjectUrl;
      if (previousPublicUrl === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = previousPublicUrl;
    }
  });

  it('canonicalizes reserved session aliases when building the admin open-mint URL', () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';

    const buildEligibleSubject = (sessionSlug) => {
      const subject = createSubject({
        SBTAddress: sbtAddress,
        sessionSlug,
      });
      subject.state = {
        ...subject.state,
        sbtInfo: {
          name: 'Open Badge',
          image: 'https://example.example.test/badge.png',
          mintingEndTime: 0,
          burnAuth: 0,
          hasPasswordMint: false,
          maxTokens: '0',
          admin: '0x00000000000000000000000000000000000000a2',
          chainID: 84532,
        },
        hasInviteMint: false,
        hasGroupPasswordMint: false,
        groupPasswordHash: ethers.constants.HashZero,
      };
      return subject;
    };

    expect(buildEligibleSubject('general').getOpenMintAutoJoinUrl()).toBe(
      `http://localhost/session?sbt=${encodeURIComponent(sbtAddress)}&auto=1`,
    );
    expect(buildEligibleSubject('debate').getOpenMintAutoJoinUrl()).toBe(
      `http://localhost/session/debate?sbt=${encodeURIComponent(sbtAddress)}&auto=1`,
    );
  });

  it('hides the admin open-mint URL card when the SBT has an on-chain group password hash', () => {
    const account = '0x00000000000000000000000000000000000000a2';
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const password = 'shared-secret';
    const subject = createSubject({
      SBTAddress: sbtAddress,
      account,
      sessionSlug: 'edge',
    });

    subject.state = {
      ...subject.state,
      sbtInfo: {
        name: 'Private Badge',
        image: 'https://example.example.test/badge.png',
        mintingEndTime: 0,
        burnAuth: 0,
        hasPasswordMint: false,
        maxTokens: '0',
        admin: account,
        chainID: 84532,
      },
      userIsSbtAdmin: true,
      showAdminSection: true,
      hasInviteMint: false,
      hasGroupPasswordMint: false,
      groupPasswordHash: cryptoUtils.computeGroupPasswordHash({ password, sbtAddress: '' }),
    };

    const tree = subject.render();
    const cardNode = renderOpenMintUrlCardTree(tree);

    expect(cardNode).toBeNull();
  });
});
