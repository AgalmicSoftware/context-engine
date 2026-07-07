import type { SessionWizardPublishReadinessDescriptor } from './sessionWizardPublishReadiness';

export type NormalModeLabelFn = (key: string) => string;

export type NormalModeCardKey = 'metadata' | 'encryption' | 'worker' | 'publish';

export type NormalModeCardTone = 'ready' | 'pending' | 'neutral';

export type NormalModeCard = {
  key: NormalModeCardKey;
  title: string;
  summary: string;
  tone: NormalModeCardTone;
  stepNumber: number;
};

export type NormalModeCardsInput = {
  sessionName: string;
  sessionDetailsComplete: boolean;
  configuredPrivateGateCount: number;
  privateSlugMode: boolean;
  showNormalModeWorkerStep: boolean;
  normalModeRequiresCustomWorker: boolean;
  resolvedWorkerBaseUrl: string;
  workerMode: string;
  deployVerifiedInUi: boolean;
  canUseSponsoredAutoDeployNow: boolean;
  publishReadiness: Pick<SessionWizardPublishReadinessDescriptor, 'canPublishNow' | 'uploadBlockedReason'>;
  t: NormalModeLabelFn;
};

export type NormalModePublishSummaryInput = {
  sessionName: string;
  configuredPrivateGateCount: number;
  privateSlugMode: boolean;
  canUseSponsoredAutoDeployNow: boolean;
  shouldUseSponsoredAutoDeployFlow: boolean;
  normalModeRequiresCustomWorker: boolean;
  resolvedWorkerBaseUrl: string;
  workerMode: string;
  deployVerifiedInUi: boolean;
  pendingDraftCount: number;
  t: NormalModeLabelFn;
};

export type NormalModePublishSummaryItem = {
  label: string;
  value: string;
};

type NormalModeCardWithoutStepNumber = Omit<NormalModeCard, 'stepNumber'>;

const normalizeDisplayString = (value: string): string => value.trim();

export function buildNormalModeCards(opts: NormalModeCardsInput): NormalModeCard[] {
  const {
    sessionName,
    sessionDetailsComplete,
    configuredPrivateGateCount,
    privateSlugMode,
    showNormalModeWorkerStep,
    normalModeRequiresCustomWorker,
    resolvedWorkerBaseUrl,
    workerMode,
    deployVerifiedInUi,
    canUseSponsoredAutoDeployNow,
    publishReadiness,
    t,
  } = opts;
  const { canPublishNow, uploadBlockedReason } = publishReadiness;
  const normalizedSessionName = normalizeDisplayString(sessionName);
  const privacyTone: NormalModeCardTone = configuredPrivateGateCount || privateSlugMode ? 'ready' : 'neutral';
  const workerTone: NormalModeCardTone = normalModeRequiresCustomWorker
    ? resolvedWorkerBaseUrl
      ? 'ready'
      : 'pending'
    : workerMode === 'default' || deployVerifiedInUi
      ? 'ready'
      : 'neutral';
  const publishTone: NormalModeCardTone = canPublishNow ? 'ready' : 'pending';
  const workerCards: NormalModeCardWithoutStepNumber[] = showNormalModeWorkerStep
    ? [
        {
          key: 'worker',
          title: 'Worker',
          summary: normalModeRequiresCustomWorker
            ? resolvedWorkerBaseUrl
              ? 'Your worker URL is configured.'
              : 'Deploy or paste your own worker URL.'
            : workerMode === 'default'
              ? 'Using the shared default worker.'
              : deployVerifiedInUi
                ? 'Custom worker deployed in this run.'
                : 'Custom worker setup is available here.',
          tone: workerTone,
        },
      ]
    : [];

  const cards: NormalModeCardWithoutStepNumber[] = [
    {
      key: 'metadata',
      title: 'Session Details',
      summary: normalizedSessionName,
      tone: sessionDetailsComplete ? 'ready' : 'pending',
    },
    {
      key: 'encryption',
      title: 'Privacy',
      summary: configuredPrivateGateCount
        ? `${configuredPrivateGateCount} ${configuredPrivateGateCount === 1 ? `${t('sbt')} ${t('gate')}` : `${t('sbt')} ${t('gates')}`} selected`
        : privateSlugMode
          ? 'Private URL enabled'
          : 'Open link by default',
      tone: privacyTone,
    },
    ...workerCards,
    {
      key: 'publish',
      title: 'Deploy Session',
      summary: canPublishNow
        ? canUseSponsoredAutoDeployNow
          ? 'Publish will deploy the sponsored worker before uploading metadata.'
          : 'Review the setup and deploy when ready.'
        : uploadBlockedReason,
      tone: publishTone,
    },
  ];

  return cards.map((card, index) => ({
    ...card,
    stepNumber: index + 1,
  }));
}

export function buildNormalModePublishSummary(opts: NormalModePublishSummaryInput): NormalModePublishSummaryItem[] {
  const {
    sessionName,
    configuredPrivateGateCount,
    privateSlugMode,
    canUseSponsoredAutoDeployNow,
    shouldUseSponsoredAutoDeployFlow,
    normalModeRequiresCustomWorker,
    resolvedWorkerBaseUrl,
    workerMode,
    deployVerifiedInUi,
    pendingDraftCount,
    t,
  } = opts;
  const normalizedSessionName = normalizeDisplayString(sessionName);

  return [
    {
      label: 'Session',
      value: normalizedSessionName || 'Add a session name',
    },
    {
      label: 'Privacy',
      value: configuredPrivateGateCount
        ? `${configuredPrivateGateCount} ${configuredPrivateGateCount === 1 ? t('gate') : t('gates')} configured`
        : privateSlugMode
          ? 'Private URL mode'
          : 'Open access',
    },
    {
      label: 'Worker',
      value: canUseSponsoredAutoDeployNow
        ? 'Sponsored auto-deploy on Publish'
        : shouldUseSponsoredAutoDeployFlow
          ? 'Sponsored auto-deploy waiting for the hosted bundle URL'
          : normalModeRequiresCustomWorker
            ? resolvedWorkerBaseUrl
              ? 'Custom worker ready'
              : 'Bring your own worker'
            : workerMode === 'default'
              ? 'Shared hosted worker'
              : deployVerifiedInUi
                ? 'Custom worker deployed'
                : 'Custom worker setup',
    },
    {
      label: `Pending ${t('sbts')}`,
      value: pendingDraftCount ? `${pendingDraftCount} draft${pendingDraftCount === 1 ? '' : 's'} ready` : 'None',
    },
  ];
}
