import { ethers } from 'ethers';
import {
  buildPendingSbtDeployContextSignature,
  deploySessionWizardPendingSbtDraft,
  finalizeSessionWizardPendingSbtDraft,
  normalizeFeaturedDraftGateAutoLink,
  persistSessionWizardSbtRecoveryCodes,
} from './sessionWizardPendingSbtPublish';
import type { PendingSbtDraftLike } from './sessionWizardSbtSelections';

describe('sessionWizardPendingSbtPublish', () => {
  it('normalizes featured draft auto-links and deploy context signatures', () => {
    expect(
      normalizeFeaturedDraftGateAutoLink({
        address: '0x59c6995e998f97a5a0044976f1d8fa9f2b5f0d2c',
      }),
    ).toEqual({
      gateId: 'gate-1',
      address: '0x59c6995e998f97a5a0044976f1d8fa9f2b5f0d2c',
      dismissed: false,
      source: 'defaultFeaturedSBTs',
    });

    expect(normalizeFeaturedDraftGateAutoLink({ address: 'not-an-address' })).toBeNull();

    expect(
      buildPendingSbtDeployContextSignature({
        networkChainId: 84532,
        contracts: { sbtFactory: { address: '0xABCDEF' } },
      }),
    ).toBe('84532|0xabcdef');
  });

  it('finalizes, deploys, and persists recovery codes for pending sbt drafts', async () => {
    const finalizeDeferredDraftUpload = jest.fn(async () => ({
      tokenURI: 'ar://finalized-token',
      metadataPreview: { phase: 'finalized' },
      authoringPayload: { step: 'finalized' },
    }));

    const finalizedDraft = await finalizeSessionWizardPendingSbtDraft({
      draftEntry: {
        predictedAddress: '0x59c6995e998f97a5a0044976f1d8fa9f2b5f0d2c',
        displayName: 'Pending SBT',
        authoringPayload: { step: 'draft' },
      },
      workerUrlOverride: 'https://worker.example',
      createSbtComponentProps: {
        sessionConfigOverride: { slug: 'pending-sbt' },
      },
      finalizeDeferredDraftUpload,
    });

    expect(finalizedDraft).toEqual(
      expect.objectContaining({
        tokenURI: 'ar://finalized-token',
        metadataUploadStatus: 'ready',
        metadataPreview: { phase: 'finalized' },
        authoringPayload: { step: 'finalized' },
      }),
    );

    const createSBT = jest.fn(async () => ({ transactionHash: '0xreceipt' }));
    const deployed = await deploySessionWizardPendingSbtDraft({
      sbtDraft: {
        ...finalizedDraft,
        contractName: 'Pending SBT',
        symbol: 'CE-SBT-PEND',
        finalGroupPasswordHash: ethers.constants.HashZero,
        createOptions: { useConfiguredDeterministic: true },
      },
      providerLike: 'mock-provider',
      sessionConfigForDeploy: { slug: 'pending-sbt', contracts: {} },
      finalizePendingDraft: jest.fn(async () => finalizedDraft),
      createSBT,
    });

    expect(deployed.receipt).toEqual({ transactionHash: '0xreceipt' });
    expect(createSBT).toHaveBeenCalled();

    const writeRecoveryCodes = jest.fn(() => ({ ok: true, status: 'ok' }));
    expect(
      persistSessionWizardSbtRecoveryCodes({
        finalizedDraft: {
          hasPasswordMintOnChain: true,
          passwordList: ['claim-code-1'],
        },
        sbtAddress: '0x59c6995e998f97a5a0044976f1d8fa9f2b5f0d2c',
        sessionConfigForDeploy: { networkChainId: 84532 },
        writeRecoveryCodes,
      }),
    ).toEqual({ ok: true, status: 'ok' });
  });

  it('derives protected recovery and deploy flags from mintMode when legacy booleans are absent', async () => {
    const finalizedDraft: PendingSbtDraftLike = {
      contractName: 'Invite Draft',
      symbol: 'CE-INVITE',
      limitedNumber: 2,
      adminAddress: '0xCreator',
      mintingEndTimeUnix: 0,
      mintModeOnChain: 3,
      burnAuthEnum: 0,
      hashedPasswords: [],
      tokenURI: 'ar://invite-token',
      finalGroupPasswordHash: '0x' + '11'.repeat(32),
      create2Salt: 'draft/invite',
      createOptions: { useConfiguredDeterministic: true, initializeGroupPasswordHash: true },
      usesInviteCodes: true,
      groupPassword: 'shared-secret',
    };

    const createSBT = jest.fn(async () => ({ transactionHash: '0xreceipt' }));
    await deploySessionWizardPendingSbtDraft({
      sbtDraft: finalizedDraft,
      providerLike: 'mock-provider',
      sessionConfigForDeploy: { slug: 'pending-sbt', contracts: {} },
      finalizePendingDraft: jest.fn(async () => finalizedDraft),
      createSBT,
    });

    expect(createSBT).toHaveBeenCalledWith(
      'mock-provider',
      'Invite Draft',
      'CE-INVITE',
      2,
      '0xCreator',
      0,
      true,
      0,
      [],
      'ar://invite-token',
      '0x' + '11'.repeat(32),
      { slug: 'pending-sbt', contracts: {} },
      'draft/invite',
      { useConfiguredDeterministic: true, initializeGroupPasswordHash: true },
    );

    const writeRecoveryCodes = jest.fn(() => ({ ok: true, status: 'ok' }));
    expect(
      persistSessionWizardSbtRecoveryCodes({
        finalizedDraft,
        sbtAddress: '0x59c6995e998f97a5a0044976f1d8fa9f2b5f0d2c',
        sessionConfigForDeploy: { networkChainId: 84532 },
        writeRecoveryCodes,
      }),
    ).toEqual({ ok: true, status: 'ok' });
  });
});
