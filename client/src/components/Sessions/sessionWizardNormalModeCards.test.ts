import {
  buildNormalModeCards,
  buildNormalModePublishSummary,
  type NormalModeCardsInput,
  type NormalModePublishSummaryInput,
} from './sessionWizardNormalModeCards';

const labels: Record<string, string> = {
  sbt: 'SBT',
  sbts: 'SBTs',
  gate: 'gate',
  gates: 'gates',
};

const t = (key: string): string => labels[key] || key;

const baseCardsInput: NormalModeCardsInput = {
  sessionName: 'Research Session',
  sessionDetailsComplete: true,
  configuredPrivateGateCount: 0,
  privateSlugMode: false,
  showNormalModeWorkerStep: true,
  normalModeRequiresCustomWorker: false,
  resolvedWorkerBaseUrl: 'https://worker.example',
  workerMode: 'default',
  deployVerifiedInUi: false,
  canUseSponsoredAutoDeployNow: false,
  publishReadiness: {
    canPublishNow: false,
    uploadBlockedReason: 'Upload is blocked.',
  },
  t,
};

const basePublishSummaryInput: NormalModePublishSummaryInput = {
  sessionName: 'Research Session',
  configuredPrivateGateCount: 0,
  privateSlugMode: false,
  canUseSponsoredAutoDeployNow: false,
  shouldUseSponsoredAutoDeployFlow: false,
  normalModeRequiresCustomWorker: false,
  resolvedWorkerBaseUrl: 'https://worker.example',
  workerMode: 'default',
  deployVerifiedInUi: false,
  pendingDraftCount: 0,
  t,
};

describe('sessionWizardNormalModeCards', () => {
  describe('buildNormalModeCards', () => {
    it('includes or omits the worker step and assigns visible step numbers', () => {
      expect(
        buildNormalModeCards({
          ...baseCardsInput,
          showNormalModeWorkerStep: true,
        }).map(({ key, stepNumber }) => [key, stepNumber]),
      ).toEqual([
        ['metadata', 1],
        ['encryption', 2],
        ['worker', 3],
        ['publish', 4],
      ]);

      expect(
        buildNormalModeCards({
          ...baseCardsInput,
          showNormalModeWorkerStep: false,
        }).map(({ key, stepNumber }) => [key, stepNumber]),
      ).toEqual([
        ['metadata', 1],
        ['encryption', 2],
        ['publish', 3],
      ]);
    });

    it('marks publish ready when publishing is available', () => {
      const publishCard = buildNormalModeCards({
        ...baseCardsInput,
        publishReadiness: {
          ...baseCardsInput.publishReadiness,
          canPublishNow: true,
        },
      }).find((card) => card.key === 'publish');

      expect(publishCard).toEqual(
        expect.objectContaining({
          summary: 'Review the setup and deploy when ready.',
          tone: 'ready',
        }),
      );
    });

    it('pluralizes configured gate counts in the privacy summary', () => {
      const singleGateCard = buildNormalModeCards({
        ...baseCardsInput,
        configuredPrivateGateCount: 1,
      }).find((card) => card.key === 'encryption');
      const multipleGateCard = buildNormalModeCards({
        ...baseCardsInput,
        configuredPrivateGateCount: 2,
      }).find((card) => card.key === 'encryption');

      expect(singleGateCard?.summary).toBe('1 SBT gate selected');
      expect(multipleGateCard?.summary).toBe('2 SBT gates selected');
    });
  });

  describe('buildNormalModePublishSummary', () => {
    it('shows pending SBT draft counts', () => {
      expect(
        buildNormalModePublishSummary({
          ...basePublishSummaryInput,
          pendingDraftCount: 1,
        }).find((item) => item.label === 'Pending SBTs')?.value,
      ).toBe('1 draft ready');

      expect(
        buildNormalModePublishSummary({
          ...basePublishSummaryInput,
          pendingDraftCount: 3,
        }).find((item) => item.label === 'Pending SBTs')?.value,
      ).toBe('3 drafts ready');

      expect(
        buildNormalModePublishSummary({
          ...basePublishSummaryInput,
          pendingDraftCount: 0,
        }).find((item) => item.label === 'Pending SBTs')?.value,
      ).toBe('None');
    });

    it('labels worker states in publish summary order', () => {
      expect(
        buildNormalModePublishSummary({
          ...basePublishSummaryInput,
          canUseSponsoredAutoDeployNow: true,
          shouldUseSponsoredAutoDeployFlow: true,
          normalModeRequiresCustomWorker: true,
          workerMode: 'custom',
          deployVerifiedInUi: true,
        }).find((item) => item.label === 'Worker')?.value,
      ).toBe('Sponsored auto-deploy on Publish');

      expect(
        buildNormalModePublishSummary({
          ...basePublishSummaryInput,
          shouldUseSponsoredAutoDeployFlow: true,
        }).find((item) => item.label === 'Worker')?.value,
      ).toBe('Sponsored auto-deploy waiting for the hosted bundle URL');

      expect(
        buildNormalModePublishSummary({
          ...basePublishSummaryInput,
          normalModeRequiresCustomWorker: true,
          resolvedWorkerBaseUrl: '',
        }).find((item) => item.label === 'Worker')?.value,
      ).toBe('Bring your own worker');

      expect(
        buildNormalModePublishSummary({
          ...basePublishSummaryInput,
          normalModeRequiresCustomWorker: true,
        }).find((item) => item.label === 'Worker')?.value,
      ).toBe('Custom worker ready');

      expect(
        buildNormalModePublishSummary({
          ...basePublishSummaryInput,
          workerMode: 'default',
        }).find((item) => item.label === 'Worker')?.value,
      ).toBe('Shared hosted worker');

      expect(
        buildNormalModePublishSummary({
          ...basePublishSummaryInput,
          workerMode: 'custom',
          deployVerifiedInUi: true,
        }).find((item) => item.label === 'Worker')?.value,
      ).toBe('Custom worker deployed');

      expect(
        buildNormalModePublishSummary({
          ...basePublishSummaryInput,
          workerMode: 'custom',
          deployVerifiedInUi: false,
        }).find((item) => item.label === 'Worker')?.value,
      ).toBe('Custom worker setup');
    });
  });
});
