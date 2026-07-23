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
  canPublishNow: boolean;
  canUseSponsoredAutoDeployNow: boolean;
  publishReadiness: Pick<SessionWizardPublishReadinessDescriptor, 'canPublishNow' | 'uploadBlockedReason'>;
  isWorkerCanonical: boolean;
  deployPendingSbts: boolean;
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
  isWorkerCanonical: boolean;
  deployPendingSbts: boolean;
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
    canPublishNow,
    canUseSponsoredAutoDeployNow,
    publishReadiness,
    isWorkerCanonical,
    deployPendingSbts,
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
          title: isWorkerCanonical ? 'Session Worker' : 'Worker',
          summary: normalModeRequiresCustomWorker
            ? resolvedWorkerBaseUrl
              ? isWorkerCanonical
                ? 'Worker URL configured; verify canonical config and browser access.'
                : 'Your worker URL is configured.'
              : isWorkerCanonical
                ? 'Complete the Cloudflare dashboard handoff, then verify the Worker URL.'
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
      title: isWorkerCanonical ? 'Session Access' : 'Privacy',
      summary:
        isWorkerCanonical && !deployPendingSbts
          ? 'Passkey identity · Worker roles and Groups'
          : configuredPrivateGateCount
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
        ? isWorkerCanonical
          ? 'Deploy saves and verifies canonical config in the Session Worker.'
          : canUseSponsoredAutoDeployNow
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
    isWorkerCanonical,
    deployPendingSbts,
    t,
  } = opts;
  const normalizedSessionName = normalizeDisplayString(sessionName);

  return [
    {
      label: 'Session',
      value: normalizedSessionName || 'Add a session name',
    },
    {
      label: isWorkerCanonical ? 'Session access' : 'Privacy',
      value: configuredPrivateGateCount
        ? `${configuredPrivateGateCount} ${configuredPrivateGateCount === 1 ? t('gate') : t('gates')} configured`
        : isWorkerCanonical
          ? 'Passkey · Worker roles and Groups'
          : privateSlugMode
            ? 'Private URL mode'
            : 'Open access',
    },
    {
      label: 'Worker',
      value:
        isWorkerCanonical && deployVerifiedInUi
          ? 'Canonical Worker config verified'
          : isWorkerCanonical
            ? resolvedWorkerBaseUrl
              ? 'Worker URL awaiting verification'
              : 'Cloudflare dashboard handoff required'
            : canUseSponsoredAutoDeployNow
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
    ...(deployPendingSbts
      ? [
          {
            label: `Pending ${t('sbts')}`,
            value: pendingDraftCount ? `${pendingDraftCount} draft${pendingDraftCount === 1 ? '' : 's'} ready` : 'None',
          },
        ]
      : []),
  ];
}
