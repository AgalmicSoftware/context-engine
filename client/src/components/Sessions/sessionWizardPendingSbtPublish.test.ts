import { ethers } from 'ethers';
import {
  buildPendingSbtDeployContextSignature,
  deploySessionWizardPendingSbtDraft,
  finalizeSessionWizardPendingSbtDraft,
  normalizeFeaturedDraftGateAutoLink,
  persistSessionWizardSbtRecoveryCodes,
} from './sessionWizardPendingSbtPublish';

describe('sessionWizardPendingSbtPublish', () => {
  it('normalizes featured draft auto-links and deploy context signatures', () => {
    expect(normalizeFeaturedDraftGateAutoLink({
      address: '0x59c6995e998f97a5a0044976f1d8fa9f2b5f0d2c',
    })).toEqual({
      gateId: 'gate-1',
      address: '0x59c6995e998f97a5a0044976f1d8fa9f2b5f0d2c',
      dismissed: false,
      source: 'defaultFeaturedSBTs',
    });

    expect(normalizeFeaturedDraftGateAutoLink({ address: 'not-an-address' })).toBeNull();

    expect(buildPendingSbtDeployContextSignature({
      networkChainId: 84532,
      contracts: { sbtFactory: { address: '0xABCDEF' } },
    })).toBe('84532|0xabcdef');
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

    expect(finalizedDraft).toEqual(expect.objectContaining({
      tokenURI: 'ar://finalized-token',
      metadataUploadStatus: 'ready',
      metadataPreview: { phase: 'finalized' },
      authoringPayload: { step: 'finalized' },
    }));

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
    expect(persistSessionWizardSbtRecoveryCodes({
      finalizedDraft: {
        hasPasswordMintOnChain: true,
        passwordList: ['claim-code-1'],
      },
      sbtAddress: '0x59c6995e998f97a5a0044976f1d8fa9f2b5f0d2c',
      sessionConfigForDeploy: { networkChainId: 84532 },
      writeRecoveryCodes,
    })).toEqual({ ok: true, status: 'ok' });
  });
});
