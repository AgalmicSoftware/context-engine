/** @file OnePageSession.component.test.jsx */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ethers } from 'ethers';
import { TestMemoryRouter as MemoryRouter } from 'testUtils/TestMemoryRouter';
import OnePageSession from './OnePageSession';
import styles from './OnePageSession.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import contractScripts from '../../utilities/web3/contractScripts.js';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as sessionScanScope from '../../utilities/session/sessionScanScope.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';

const mockSurveyPage = jest.fn();
const mockPolisReport = jest.fn();
const mockSBTsPage = jest.fn();
const mockDebateMap = jest.fn();
const mockRiskMatrix = jest.fn();
const mockDebateSelector = jest.fn();
const mockDemoAnalysisWorkspace = jest.fn();
const originalFetch = global.fetch;
const fullCrossCorpusPayload = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../../ai-discourse-corpus/corpuses/cross-corpus-debates.json'), 'utf8'),
);

const extractMediaBlock = (scss, query, requiredSnippet = '') => {
  let searchFrom = 0;

  while (searchFrom < scss.length) {
    const queryIndex = scss.indexOf(query, searchFrom);
    if (queryIndex === -1) {
      return null;
    }

    const blockStart = scss.indexOf('{', queryIndex);
    if (blockStart === -1) {
      return null;
    }

    let depth = 0;
    for (let index = blockStart; index < scss.length; index += 1) {
      const char = scss[index];
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
      if (depth === 0) {
        const block = scss.slice(queryIndex, index + 1);
        if (!requiredSnippet || block.includes(requiredSnippet)) {
          return block;
        }
        searchFrom = queryIndex + query.length;
        break;
      }
    }
  }

  return null;
};

jest.mock('../SurveyTool/SurveyPage', () => (props) => {
  mockSurveyPage(props);
  if (props.minifiedMode === 'pile') {
    return (
      <div data-testid="survey-page-pile">
        <button type="button" data-testid="pile-view-all" onClick={props.onViewAllClick}>
          View All Questions
        </button>
      </div>
    );
  }
  return <div data-testid="survey-page-full">Full Questions</div>;
});

jest.mock('../SBTs/SBTsPage', () => (props) => {
  mockSBTsPage(props);
  return <div data-testid="sbts-page">{props.showCreateGroupExternal ? 'Create Open' : 'Create Closed'}</div>;
});
jest.mock('../PolisReport/PolisReport', () => (props) => {
  mockPolisReport(props);
  return <div data-testid="polis-report">Polis</div>;
});
jest.mock('../DebateMap/DebateMap', () => ({
  __esModule: true,
  default: (props) => {
    mockDebateMap(props);
    return (
      <div data-testid="ai-policy-atlas">
        AI Policy Atlas
        {props.onModalClose ? (
          <button type="button" onClick={props.onModalClose}>
            Close Atlas Modal
          </button>
        ) : null}
      </div>
    );
  },
}));
jest.mock('../MainContent/RiskMatrix', () => ({
  __esModule: true,
  default: (props) => {
    mockRiskMatrix(props);
    return (
      <div data-testid="risk-matrix-view">
        Risk Matrix
        {typeof props.onOpenAtlasNode === 'function' ? (
          <button
            type="button"
            data-testid="risk-matrix-open-atlas-node"
            onClick={() =>
              props.onOpenAtlasNode('0x4110000000000000000000000000000000000000000000000000000000000000', {
                modal: true,
                selectedCellId: 'Capabilities_vs_Labor',
                activeCategoryX: 'Capabilities',
                activeCategoryY: 'Labor',
                comment: 'Return here after checking the atlas node.',
                valence: 'risk',
                intensity: 6,
                comments: [
                  {
                    cell: 'Capabilities.Reasoning.Labor.Productivity',
                    comment: 'Capability gains can compress reporting, research, and drafting cycles.',
                    valence: 'opportunity',
                    intensity: 5,
                  },
                ],
              })
            }
          >
            Open linked atlas node
          </button>
        ) : null}
      </div>
    );
  },
}));
jest.mock('../DemoViews/DemoAnalysis/DemoAnalysisWorkspace', () => ({
  __esModule: true,
  default: (props) => {
    mockDemoAnalysisWorkspace(props);
    return <div data-testid="demo-analysis-workspace-view">Demo Analysis</div>;
  },
}));
jest.mock('../DemoViews/DebateHUD/DebateSelector', () => (props) => {
  mockDebateSelector(props);
  return <div data-testid="debate-selector">Debate Selector</div>;
});

describe('OnePageSession auto-mint queue', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    jest.restoreAllMocks();
    window.sessionStorage.clear();
    Object.defineProperty(global, 'fetch', {
      writable: true,
      value: originalFetch,
    });
  });

  const buildProps = () => ({
    network: { id: 84532, name: 'Base Sepolia' },
    provider: 'wagmi',
    account: '',
    loginComplete: false,
    toggleLoginModal: jest.fn(),
    isQuestionCacheReady: false,
    isResponsesCacheReady: false,
    isSBTCacheReady: false,
    isSurveyCacheReady: false,
    sbtCacheRevision: 0,
    sbtScanProgressBySlug: {},
    questionResponsesNonce: 0,
    questionScanProgress: null,
    refreshSurveyResponsesByID: jest.fn(),
    refreshQuestionMetadata: jest.fn(),
    refreshQuestionResponses: jest.fn(),
    refreshSbtData: jest.fn(),
    defaultFilterState: { includedSBTs: [], excludedSBTs: [], onlyVerifiedHumans: false },
    sessionConfig: {
      slug: 'edge',
      sessionName: 'Edge Session',
      sessionInfo: 'Edge info',
      defaultTags: [],
      defaultSbtTags: [],
      defaultFeaturedSBTs: [],
      contracts: {},
      blockLimits: {},
      networkChainId: 84532,
      __registry: {
        registryChainId: 84532,
        sessionIdHex: '0x00112233445566778899aabbccddeeff',
      },
    },
  });

  const createSubject = (props = {}) => {
    const mergedProps = { ...buildProps(), ...props };
    const subject = new OnePageSession(mergedProps);
    subject._isMounted = true;
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    return subject;
  };

  const getAutoMintStorageKey = (account, sbtAddress, chainId = 84532) =>
    `autoMint:${String(account || '').toLowerCase()}:${chainId}:${String(sbtAddress || '').toLowerCase()}`;

  it('uses getNativeBalance for auto-mint balance checks when the legacy getETHBalance alias is unavailable', async () => {
    const subject = createSubject({
      sessionConfig: {
        ...buildProps().sessionConfig,
        slug: 'demo-30',
      },
    });
    const account = '0x00000000000000000000000000000000000000aa';
    const nativeBalanceSpy = jest
      .spyOn(contractScripts, 'getNativeBalance')
      .mockResolvedValue(ethers.utils.parseEther('0.1'));
    const originalLegacyReader = contractScripts.getETHBalance;

    try {
      delete contractScripts.getETHBalance;
      const ok = await subject.waitForSufficientBalance('mock', account, ethers.utils.parseEther('0.00002'), 50, 1);

      expect(ok).toBe(true);
      expect(nativeBalanceSpy).toHaveBeenCalledWith(account, expect.any(String));
    } finally {
      contractScripts.getETHBalance = originalLegacyReader;
    }
  });

  it('pins the session slug on auto-mint status links', () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b1';
    const subject = createSubject({
      slug: 'edge',
      sessionConfig: {
        ...buildProps().sessionConfig,
        slug: 'edge',
      },
    });
    subject.state = {
      ...subject.state,
      autoMintStatuses: {
        [sbtAddress.toLowerCase()]: {
          status: 'success',
          name: 'Joined: Edge Badge',
        },
      },
    };

    render(subject.render());

    const statusAlert = screen.getByTestId(E2E_TESTIDS.SESSION_AUTO_MINT_STATUS);
    const link = within(statusAlert).getByRole('link', { name: 'Joined: Edge Badge' });
    expect(link.getAttribute('href')).toBe(buildSbtDetailPath(sbtAddress.toLowerCase(), 'edge'));
  });

  it('keeps the auto-join status close control on the same banner row', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'OnePageSession.module.scss'), 'utf8');

    expect(scss).toMatch(/\.sbtMintStatusItem\s*{[\s\S]*?position:\s*relative;[\s\S]*?padding-right:\s*54px;/);
    expect(scss).toMatch(
      /:global\(\.sbt-alert-close-btn\)\s*{[\s\S]*?position:\s*absolute !important;[\s\S]*?top:\s*50% !important;[\s\S]*?right:\s*10px !important;[\s\S]*?transform:\s*translateY\(-50%\) !important;/,
    );
  });

  it('auto-mints public no-password SBTs through the session queue', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b1';
    const subject = createSubject({
      account: '0x00000000000000000000000000000000000000b2',
      loginComplete: true,
      refreshSbtData: jest.fn(),
      slug: 'edge',
    });
    subject.state = {
      ...subject.state,
      autoMintTargets: [{ sbt: sbtAddress }],
    };

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'Public Badge',
      tokenURI: 'ar://public-badge',
      hasPasswordMint: false,
      maxTokens: '0',
    });
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    const claimSpy = jest.spyOn(contractScripts, 'claim').mockResolvedValue({ transactionHash: '0xclaim' });
    subject.waitForSufficientBalance = jest.fn().mockResolvedValue(true);

    await subject.runAutoMintQueue();

    expect(claimSpy).toHaveBeenCalledWith('wagmi', sbtAddress);
    expect(subject.state.autoMintStatuses[sbtAddress.toLowerCase()]).toMatchObject({
      status: 'success',
      name: 'Joined: Public Badge',
    });
    expect(subject.props.refreshSbtData).toHaveBeenCalledWith(sbtAddress, expect.any(String));
  });

  it('consumes successful public auto-mint targets so rerunning the queue does not claim twice', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b3';
    const sbtKey = sbtAddress.toLowerCase();
    const account = '0x00000000000000000000000000000000000000b4';
    const subject = createSubject({
      account,
      loginComplete: true,
      refreshSbtData: jest.fn(),
      slug: 'edge',
    });
    subject.state = {
      ...subject.state,
      autoMintTargets: [{ sbt: sbtAddress }],
    };

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'One Shot Badge',
      tokenURI: 'ar://one-shot-badge',
      hasPasswordMint: false,
      maxTokens: '0',
    });
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    const claimSpy = jest.spyOn(contractScripts, 'claim').mockResolvedValue({ transactionHash: '0xclaim' });
    subject.waitForSufficientBalance = jest.fn().mockResolvedValue(true);

    await subject.runAutoMintQueue();
    await subject.runAutoMintQueue();

    expect(claimSpy).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(account, sbtAddress))).toBe('done');
    expect(subject.state.autoMintStatuses[sbtKey]).toMatchObject({
      status: 'success',
      name: 'Joined: One Shot Badge',
    });
  });

  it('re-evaluates cached auto-mint targets when the connected wallet changes', () => {
    const sbtAddress = '0x00000000000000000000000000000000000000be';
    const accountA = '0x00000000000000000000000000000000000000bf';
    const accountB = '0x00000000000000000000000000000000000000c0';
    const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    try {
      window.history.replaceState({}, '', `/?auto=1&sbt=${sbtAddress}`);
      window.sessionStorage.setItem(getAutoMintStorageKey(accountA, sbtAddress), 'done');

      const subject = createSubject({
        account: accountA,
        loginComplete: true,
        slug: 'edge',
      });

      expect(subject.parseAutoMintFragment()).toEqual([]);

      subject.props = {
        ...subject.props,
        account: accountB,
      };

      expect(subject.parseAutoMintFragment()).toEqual([
        {
          sbt: sbtAddress,
          gp: '',
          inv: '',
        },
      ]);
    } finally {
      window.history.replaceState({}, '', originalUrl || '/');
    }
  });

  it('does not consume public auto-mint attempts when a claim fails before succeeding later', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b5';
    const sbtKey = sbtAddress.toLowerCase();
    const account = '0x00000000000000000000000000000000000000b6';
    const subject = createSubject({
      account,
      loginComplete: true,
      refreshSbtData: jest.fn(),
      slug: 'edge',
    });
    subject.state = {
      ...subject.state,
      autoMintTargets: [{ sbt: sbtAddress }],
    };

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'Retry Badge',
      tokenURI: 'ar://retry-badge',
      hasPasswordMint: false,
      maxTokens: '0',
    });
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    const claimSpy = jest
      .spyOn(contractScripts, 'claim')
      .mockRejectedValueOnce(new Error('temporary rpc failure'))
      .mockResolvedValueOnce({ transactionHash: '0xclaim' });
    subject.waitForSufficientBalance = jest.fn().mockResolvedValue(true);

    await subject.runAutoMintQueue();

    expect(window.sessionStorage.getItem(getAutoMintStorageKey(account, sbtAddress))).toBeNull();

    await subject.runAutoMintQueue();

    expect(claimSpy).toHaveBeenCalledTimes(2);
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(account, sbtAddress))).toBe('done');
    expect(subject.state.autoMintStatuses[sbtKey]).toMatchObject({
      status: 'success',
      name: 'Joined: Retry Badge',
    });
  });

  it('keeps failed auto-mint targets queued until they succeed later', async () => {
    const firstSbtAddress = '0x00000000000000000000000000000000000000c1';
    const secondSbtAddress = '0x00000000000000000000000000000000000000c2';
    const account = '0x00000000000000000000000000000000000000c3';
    const subject = createSubject({
      account,
      loginComplete: true,
      refreshSbtData: jest.fn(),
      slug: 'edge',
    });
    const persistedIntent = ['auto=1', `sbt=${firstSbtAddress}`, `sbt1=${secondSbtAddress}`, 'auto1=1'].join('&');
    let secondClaimAttempts = 0;

    subject.state = {
      ...subject.state,
      autoMintTargets: [{ sbt: firstSbtAddress }, { sbt: secondSbtAddress }],
    };

    window.sessionStorage.setItem(subject.getAutoHashStorageKey(), persistedIntent);
    window.history.replaceState({}, '', `/demo?${persistedIntent}`);

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getSbtMetadata').mockImplementation(async (_provider, sbtAddress) => ({
      name: sbtAddress === firstSbtAddress ? 'First Badge' : 'Second Badge',
      tokenURI: `ar://${String(sbtAddress || '').toLowerCase()}`,
      hasPasswordMint: false,
      maxTokens: '0',
    }));
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    const claimSpy = jest.spyOn(contractScripts, 'claim').mockImplementation(async (_provider, sbtAddress) => {
      if (sbtAddress === firstSbtAddress) {
        return { transactionHash: '0xclaim-first' };
      }
      secondClaimAttempts += 1;
      if (secondClaimAttempts === 1) {
        throw new Error('temporary rpc failure');
      }
      return { transactionHash: '0xclaim-second' };
    });
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');
    subject.waitForSufficientBalance = jest.fn().mockResolvedValue(true);

    await subject.runAutoMintQueue();

    expect(claimSpy).toHaveBeenCalledTimes(2);
    expect(subject.state.autoMintTargets).toEqual([{ sbt: secondSbtAddress }]);
    expect(subject.state.mintSuccess).toBe(false);
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(account, firstSbtAddress))).toBe('done');
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(account, secondSbtAddress))).toBeNull();
    expect(window.sessionStorage.getItem(subject.getAutoHashStorageKey())).toBe(persistedIntent);
    expect(replaceStateSpy).not.toHaveBeenCalled();

    await subject.runAutoMintQueue();

    expect(claimSpy).toHaveBeenCalledTimes(3);
    expect(subject.state.autoMintTargets).toEqual([]);
    expect(subject.state.mintSuccess).toBe(true);
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(account, secondSbtAddress))).toBe('done');
    expect(window.sessionStorage.getItem(subject.getAutoHashStorageKey())).toBeNull();
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
  });

  it('does not consume public auto-mint attempts when the balance gate times out', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b7';
    const sbtKey = sbtAddress.toLowerCase();
    const account = '0x00000000000000000000000000000000000000b8';
    const subject = createSubject({
      account,
      loginComplete: true,
      refreshSbtData: jest.fn(),
      slug: 'edge',
    });
    subject.state = {
      ...subject.state,
      autoMintTargets: [{ sbt: sbtAddress }],
    };

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'Gas Retry Badge',
      tokenURI: 'ar://gas-retry-badge',
      hasPasswordMint: false,
      maxTokens: '0',
    });
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    const claimSpy = jest.spyOn(contractScripts, 'claim').mockResolvedValue({ transactionHash: '0xclaim' });
    subject.waitForSufficientBalance = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await subject.runAutoMintQueue();

    expect(claimSpy).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(account, sbtAddress))).toBeNull();

    await subject.runAutoMintQueue();

    expect(claimSpy).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(account, sbtAddress))).toBe('done');
    expect(subject.state.autoMintStatuses[sbtKey]).toMatchObject({
      status: 'success',
      name: 'Joined: Gas Retry Badge',
    });
  });

  it('scopes consumed auto-mint attempts to the connected wallet', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b9';
    const sbtKey = sbtAddress.toLowerCase();
    const accountA = '0x00000000000000000000000000000000000000ba';
    const accountB = '0x00000000000000000000000000000000000000bb';
    const subjectA = createSubject({
      account: accountA,
      loginComplete: true,
      refreshSbtData: jest.fn(),
      slug: 'edge',
    });
    const subjectB = createSubject({
      account: accountB,
      loginComplete: true,
      refreshSbtData: jest.fn(),
      slug: 'edge',
    });
    subjectA.state = {
      ...subjectA.state,
      autoMintTargets: [{ sbt: sbtAddress }],
    };
    subjectB.state = {
      ...subjectB.state,
      autoMintTargets: [{ sbt: sbtAddress }],
    };

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'Wallet Scoped Badge',
      tokenURI: 'ar://wallet-scoped-badge',
      hasPasswordMint: false,
      maxTokens: '0',
    });
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    const claimSpy = jest.spyOn(contractScripts, 'claim').mockResolvedValue({ transactionHash: '0xclaim' });
    subjectA.waitForSufficientBalance = jest.fn().mockResolvedValue(true);
    subjectB.waitForSufficientBalance = jest.fn().mockResolvedValue(true);

    await subjectA.runAutoMintQueue();
    await subjectA.runAutoMintQueue();
    await subjectB.runAutoMintQueue();

    expect(claimSpy).toHaveBeenCalledTimes(2);
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(accountA, sbtAddress))).toBe('done');
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(accountB, sbtAddress))).toBe('done');
  });

  it('scopes consumed auto-mint attempts to the session chain as well as the wallet', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000bc';
    const account = '0x00000000000000000000000000000000000000bd';
    const subjectSepolia = createSubject({
      account,
      loginComplete: true,
      refreshSbtData: jest.fn(),
      slug: 'edge',
      network: { id: 84532, name: 'Base Sepolia' },
      sessionConfig: {
        ...buildProps().sessionConfig,
        networkChainId: 84532,
      },
    });
    const subjectBase = createSubject({
      account,
      loginComplete: true,
      refreshSbtData: jest.fn(),
      slug: 'edge',
      network: { id: 8453, name: 'Base' },
      sessionConfig: {
        ...buildProps().sessionConfig,
        networkChainId: 8453,
      },
    });
    subjectSepolia.state = {
      ...subjectSepolia.state,
      autoMintTargets: [{ sbt: sbtAddress }],
    };
    subjectBase.state = {
      ...subjectBase.state,
      autoMintTargets: [{ sbt: sbtAddress }],
    };

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'Cross Chain Badge',
      tokenURI: 'ar://cross-chain-badge',
      hasPasswordMint: false,
      maxTokens: '0',
    });
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    const claimSpy = jest.spyOn(contractScripts, 'claim').mockResolvedValue({ transactionHash: '0xclaim' });
    subjectSepolia.waitForSufficientBalance = jest.fn().mockResolvedValue(true);
    subjectBase.waitForSufficientBalance = jest.fn().mockResolvedValue(true);

    await subjectSepolia.runAutoMintQueue();
    await subjectBase.runAutoMintQueue();

    expect(claimSpy).toHaveBeenCalledTimes(2);
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(account, sbtAddress, 84532))).toBe('done');
    expect(window.sessionStorage.getItem(getAutoMintStorageKey(account, sbtAddress, 8453))).toBe('done');
  });

  it('auto-mints invite-code SBTs through the session queue', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000c1';
    const subject = createSubject({
      account: '0x00000000000000000000000000000000000000c2',
      loginComplete: true,
      slug: 'edge',
    });
    subject.state = {
      ...subject.state,
      autoMintTargets: [{ sbt: sbtAddress, inv: 'invite-token' }],
    };
    subject.decodeInviteInput = jest.fn().mockReturnValue({ nonce: '7', signature: '0xinvite' });
    subject.waitForSufficientBalance = jest.fn().mockResolvedValue(true);

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'Invite Badge',
      tokenURI: 'ar://invite-badge',
      hasPasswordMint: false,
      maxTokens: '0',
    });
    const claimInviteSpy = jest
      .spyOn(contractScripts, 'claimWithInvite')
      .mockResolvedValue({ transactionHash: '0xinviteclaim' });

    await subject.runAutoMintQueue();

    expect(claimInviteSpy).toHaveBeenCalledWith('wagmi', sbtAddress, '7', '0xinvite');
    expect(subject.state.autoMintStatuses[sbtAddress.toLowerCase()]).toMatchObject({
      status: 'success',
      name: 'Joined: Invite Badge',
    });
  });

  it('does not expose provider-returned invite credentials in auto-mint status', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000c3';
    const secretSentinel = '0xinvite-secret-sentinel';
    const subject = createSubject({
      account: '0x00000000000000000000000000000000000000c4',
      loginComplete: true,
      slug: 'edge',
    });
    subject.state = {
      ...subject.state,
      autoMintTargets: [{ sbt: sbtAddress, inv: 'invite-token' }],
    };
    subject.decodeInviteInput = jest.fn().mockReturnValue({ nonce: '7', signature: secretSentinel });
    subject.waitForSufficientBalance = jest.fn().mockResolvedValue(true);

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'Invite Badge',
      tokenURI: 'ar://invite-badge',
      hasPasswordMint: false,
      maxTokens: '0',
    });
    jest.spyOn(contractScripts, 'claimWithInvite').mockRejectedValue(new Error(`provider echoed ${secretSentinel}`));

    await subject.runAutoMintQueue();

    const status = subject.state.autoMintStatuses[sbtAddress.toLowerCase()];
    expect(status).toMatchObject({
      status: 'failed',
      name: 'Join Failed',
      error: 'Join failed. Verify the credential and network, then retry.',
    });
    expect(JSON.stringify(status)).not.toContain(secretSentinel);
  });

  it('auto-mints limited password SBTs through generated invite payloads in the session queue', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000d1';
    const subject = createSubject({
      account: '0x00000000000000000000000000000000000000d2',
      loginComplete: true,
      slug: 'edge',
    });
    subject.state = {
      ...subject.state,
      autoMintTargets: [{ sbt: sbtAddress, gp: 'shared-secret' }],
    };
    subject.waitForSufficientBalance = jest.fn().mockResolvedValue(true);

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'Limited Badge',
      tokenURI: 'ar://limited-badge',
      hasPasswordMint: true,
      maxTokens: '5',
    });
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    jest.spyOn(contractScripts, 'getMintedTokens').mockResolvedValue('0');
    const generateInviteSpy = jest
      .spyOn(contractScripts, 'generateInvitePayloads')
      .mockResolvedValue([{ nonce: '1', signature: '0xlimitedinvite' }]);
    const claimInviteSpy = jest
      .spyOn(contractScripts, 'claimWithInvite')
      .mockResolvedValue({ transactionHash: '0xlimitedclaim' });

    await subject.runAutoMintQueue();

    expect(generateInviteSpy).toHaveBeenCalledWith({
      password: 'shared-secret',
      sbtAddress,
      nonces: ['1'],
      walletScopeSbtAddress: sbtAddress,
    });
    expect(claimInviteSpy).toHaveBeenCalledWith('wagmi', sbtAddress, '1', '0xlimitedinvite');
    expect(subject.state.autoMintStatuses[sbtAddress.toLowerCase()]).toMatchObject({
      status: 'success',
      name: 'Joined: Limited Badge',
    });
  });

  it('auto-mints unlimited group-password SBTs through the session queue', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000e1';
    const subject = createSubject({
      account: '0x00000000000000000000000000000000000000e2',
      loginComplete: true,
      slug: 'edge',
    });
    subject.state = {
      ...subject.state,
      autoMintTargets: [{ sbt: sbtAddress, gp: 'shared-secret' }],
    };
    subject.waitForSufficientBalance = jest.fn().mockResolvedValue(true);
    subject.verifyGroupPasswordBinding = jest.fn().mockResolvedValue(true);
    subject.mintUnlimitedSBTWithGroupPassword = jest.fn().mockResolvedValue(undefined);

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'Unlimited Badge',
      tokenURI: 'ar://unlimited-badge',
      hasPasswordMint: false,
      maxTokens: '0',
    });
    jest
      .spyOn(contractScripts, 'getGroupPasswordHash')
      .mockResolvedValue('0x1111111111111111111111111111111111111111111111111111111111111111');

    await subject.runAutoMintQueue();

    expect(subject.verifyGroupPasswordBinding).toHaveBeenCalledWith(sbtAddress, 'shared-secret');
    expect(subject.mintUnlimitedSBTWithGroupPassword).toHaveBeenCalledWith(sbtAddress, 'shared-secret');
    expect(subject.state.autoMintStatuses[sbtAddress.toLowerCase()]).toMatchObject({
      status: 'success',
      name: 'Joined: Unlimited Badge',
    });
  });

  it('treats positive count-map ownership as already joined during auto mint preflight', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000f1';
    const account = '0x00000000000000000000000000000000000000f2';
    const accountLower = account.toLowerCase();
    const subject = createSubject({
      account,
      loginComplete: true,
      slug: 'edge',
      refreshSbtData: jest.fn(),
    });
    subject.state = {
      ...subject.state,
      autoMintTargets: [{ sbt: sbtAddress }],
    };

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return {
        84532: {
          sbtList: {
            [sbtAddress.toLowerCase()]: {
              sbtAddress,
              sbtInfo: {
                name: 'Reminted Badge',
                tokenURI: 'ar://reminted-badge',
                hasPasswordMint: false,
                maxTokens: '0',
              },
              mintedAddresses: [accountLower],
              burnedAddresses: [accountLower],
              mintedCountByAddress: { [accountLower]: 2 },
              burnedCountByAddress: { [accountLower]: 1 },
              countsLoaded: true,
            },
          },
        },
      };
    });
    const claimSpy = jest.spyOn(contractScripts, 'claim').mockResolvedValue({ transactionHash: '0xclaim' });
    subject.waitForSufficientBalance = jest.fn().mockResolvedValue(true);

    await subject.runAutoMintQueue();

    expect(claimSpy).not.toHaveBeenCalled();
    expect(subject.state.autoMintStatuses[sbtAddress.toLowerCase()]).toMatchObject({
      status: 'success',
      name: 'Group Already Joined',
    });
  });

  it('ignores checkpoint-backed partial ownership counts during auto mint preflight', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000f3';
    const account = '0x00000000000000000000000000000000000000f4';
    const accountLower = account.toLowerCase();
    const subject = createSubject({
      account,
      loginComplete: true,
      slug: 'edge',
      refreshSbtData: jest.fn(),
    });
    subject.state = {
      ...subject.state,
      autoMintTargets: [{ sbt: sbtAddress }],
    };

    jest.spyOn(contractScriptsModule, 'getAllSessionSlugs').mockReturnValue([]);
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return {
        84532: {
          sbtList: {
            [sbtAddress.toLowerCase()]: {
              sbtAddress,
              sbtInfo: {
                name: 'Partial Badge',
                tokenURI: 'ar://partial-badge',
                hasPasswordMint: false,
                maxTokens: '0',
              },
              mintedAddresses: [accountLower],
              burnedAddresses: [],
              mintedCountByAddress: { [accountLower]: 1 },
              burnedCountByAddress: {},
              countsLoaded: false,
              countsScanCheckpoint: {
                phase: 'activity',
                blockNumber: 15,
                mintedCountByAddress: { [accountLower]: 1 },
                burnedCountByAddress: {},
              },
            },
          },
        },
      };
    });
    jest.spyOn(contractScripts, 'getGroupPasswordHash').mockResolvedValue(ethers.constants.HashZero);
    const claimSpy = jest.spyOn(contractScripts, 'claim').mockResolvedValue({ transactionHash: '0xclaim' });
    subject.waitForSufficientBalance = jest.fn().mockResolvedValue(true);

    await subject.runAutoMintQueue();

    expect(claimSpy).toHaveBeenCalledWith('wagmi', sbtAddress);
  });
});
