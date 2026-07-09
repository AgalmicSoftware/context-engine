import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isSponsoredBundleExpired,
  normalizeSparseSponsoredBundlePayload,
  readSponsoredBundleFromArweave,
  SPONSORED_BUNDLE_SUPPORTED_FIELDS,
} from '../../../utilities/arweave/sponsoredBundles.js';
import {
  clearSponsoredBootstrapFundingContext,
  normalizeSponsoredBootstrapFundingContext,
  writeSponsoredBootstrapFundingContext,
} from '../../../utilities/session/sponsoredBootstrapFunding.js';
import { toStr } from '../../../utilities/shared/primitives.js';
import { normalizeBaseUrl } from '../../../utilities/urlUtils.js';
import { scrubSponsoredBundleHashSecret } from '../sessionWizardRouteState';
import { buildEmptyProvisionedSponsoredContext } from '../sessionWizardGateUtils';
import {
  readSessionWizardSponsoredBundleCache,
  writeSessionWizardSponsoredBundleCache,
} from '../sessionWizardSponsoredBundleCache';
import { buildSponsoredBundleAppliedStatusMessage } from '../sessionWizardSponsoredBundleSupport';
import {
  mergeSponsoredBundleDeployForm,
  mergeSponsoredBundleWorkerSecrets,
  normalizeWorkerSecrets,
  sanitizeSessionWizardSponsoredFieldSnapshotForLitMode,
} from '../sessionWizardWorkerSecretSupport';
import type { AnyRecord, WorkerSecretsLike } from '../../shellTypes';
import type { MutableRefObject } from 'react';

type SponsoredBundleLike = AnyRecord & {
  meta?: AnyRecord;
};

type SponsoredBundleBaselineState = {
  workerSecrets?: WorkerSecretsLike;
  deployApiToken?: string;
  deployComplete?: boolean;
  deployWorkerUrl?: string;
  corsWorkerUrl?: string;
  provisionedSponsoredContext?: AnyRecord;
  workerSecretsEnabled?: boolean;
  persistWorkerSecrets?: boolean;
};

type SponsoredBundleRefs = {
  draftRef?: MutableRefObject<AnyRecord | null>;
  deployFormRef?: MutableRefObject<AnyRecord | null>;
  deployCompleteRef?: MutableRefObject<boolean>;
  deployWorkerUrlRef?: MutableRefObject<string>;
  provisionedSponsoredContextRef?: MutableRefObject<AnyRecord | null>;
  workerSecretsEnabledRef?: MutableRefObject<boolean>;
  persistWorkerSecretsRef?: MutableRefObject<boolean>;
};

type SponsoredBundleDeploymentStateUpdate = {
  deployForm?: AnyRecord;
  deployComplete?: boolean;
  deployWorkerUrl?: string;
  provisionedSponsoredContext?: AnyRecord;
  workerUrlAutoFilled?: boolean;
};

type SponsoredBundleWorkerSecretStateUpdate = {
  workerSecretsEnabled?: boolean;
  persistWorkerSecrets?: boolean;
};

export type SponsoredBundleStatusState = {
  tone?: string;
  message?: string;
  retryable?: boolean;
};

export type UseSponsoredBundleLifecycleOptions = {
  initialSponsoredBundleId?: string | null;
  initialSponsoredBundleKey?: string | null;
  draftSlug?: string | null;
  refs?: SponsoredBundleRefs;
  getCurrentWorkerSecrets?: () => WorkerSecretsLike;
  applyWorkerSecretsUpdate?: (nextValueOrUpdater: unknown) => unknown;
  updateDraftCorsWorkerUrl?: (nextCorsWorkerUrl: string) => void;
  updateDeploymentState?: (nextState: SponsoredBundleDeploymentStateUpdate) => void;
  updateWorkerSecretState?: (nextState: SponsoredBundleWorkerSecretStateUpdate) => void;
};

const normalizeProvisionedSponsoredContextForState = (value: AnyRecord | null | undefined = {}): AnyRecord => {
  const source = value && typeof value === 'object' ? value : {};
  return {
    ...buildEmptyProvisionedSponsoredContext(),
    ...source,
    fields: sanitizeSessionWizardSponsoredFieldSnapshotForLitMode(source?.fields),
  };
};

const useSponsoredBundleLifecycle = ({
  initialSponsoredBundleId,
  initialSponsoredBundleKey,
  draftSlug,
  refs = {},
  getCurrentWorkerSecrets = () => normalizeWorkerSecrets({}),
  applyWorkerSecretsUpdate = () => undefined,
  updateDraftCorsWorkerUrl = () => undefined,
  updateDeploymentState = () => undefined,
  updateWorkerSecretState = () => undefined,
}: UseSponsoredBundleLifecycleOptions = {}) => {
  const {
    draftRef,
    deployFormRef,
    deployCompleteRef,
    deployWorkerUrlRef,
    provisionedSponsoredContextRef,
    workerSecretsEnabledRef,
    persistWorkerSecretsRef,
  } = refs;
  const [sponsoredBundleStatus, setSponsoredBundleStatus] = useState<SponsoredBundleStatusState | null>(null);
  const [sponsoredBundleRetryNonce, setSponsoredBundleRetryNonce] = useState(0);
  const sponsoredBundleApplyRef = useRef('');
  const sponsoredBundleBaselineRef = useRef<SponsoredBundleBaselineState | null>(null);
  const sponsoredBundleAppliedBundleRef = useRef<SponsoredBundleLike | null>(null);
  const sponsoredBundleTerminalTxIdRef = useRef('');
  const hasSponsoredBundleLink = useMemo(
    () => !!toStr(initialSponsoredBundleId || '').trim() || !!toStr(initialSponsoredBundleKey || '').trim(),
    [initialSponsoredBundleId, initialSponsoredBundleKey],
  );

  const buildRestoredSponsoredWorkerSecrets = useCallback(
    ({
      currentSecrets = {},
      baselineSecrets = {},
      appliedBundle = {},
    }: {
      currentSecrets?: WorkerSecretsLike | AnyRecord;
      baselineSecrets?: WorkerSecretsLike | AnyRecord;
      appliedBundle?: SponsoredBundleLike | AnyRecord;
    } = {}) => {
      const next = normalizeWorkerSecrets(currentSecrets);
      const baseline = normalizeWorkerSecrets(baselineSecrets);
      const normalizedApplied = normalizeSparseSponsoredBundlePayload(appliedBundle) as SponsoredBundleLike;
      SPONSORED_BUNDLE_SUPPORTED_FIELDS.forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(next, key)) return;
        const appliedValue = toStr(normalizedApplied?.[key] || '').trim();
        if (!appliedValue) return;
        if (toStr(next[key] || '').trim() !== appliedValue) return;
        next[key] = toStr(baseline[key] || '').trim();
      });
      const appliedRpcUrl = toStr(normalizedApplied?.customRpcUrl || '').trim();
      if (
        appliedRpcUrl &&
        toStr(currentSecrets?.customRpcUrl || '').trim() === appliedRpcUrl &&
        !toStr(currentSecrets?.customRpcKey || '').trim()
      ) {
        next.customRpcKey = toStr(baseline.customRpcKey || '').trim();
      }
      return next;
    },
    [],
  );

  const resolveSponsoredBundleRestoreState = useCallback(
    ({
      currentSecrets = {},
      currentDeployForm = {},
      currentDeployComplete = false,
      currentDeployWorkerUrl = '',
      currentCorsWorkerUrl = '',
      currentProvisionedSponsoredContext = buildEmptyProvisionedSponsoredContext(),
      currentWorkerSecretsEnabled = true,
      currentPersistWorkerSecrets = false,
      baseline = {},
      appliedBundle = {},
    }: {
      currentSecrets?: WorkerSecretsLike | AnyRecord;
      currentDeployForm?: AnyRecord;
      currentDeployComplete?: boolean;
      currentDeployWorkerUrl?: string;
      currentCorsWorkerUrl?: string;
      currentProvisionedSponsoredContext?: AnyRecord;
      currentWorkerSecretsEnabled?: boolean;
      currentPersistWorkerSecrets?: boolean;
      baseline?: SponsoredBundleBaselineState | AnyRecord;
      appliedBundle?: SponsoredBundleLike | AnyRecord;
    } = {}) => {
      const resolvedBaseline = baseline && typeof baseline === 'object' ? baseline : {};
      const normalizedApplied = normalizeSparseSponsoredBundlePayload(appliedBundle) as SponsoredBundleLike;
      const nextSecrets = buildRestoredSponsoredWorkerSecrets({
        currentSecrets,
        baselineSecrets: resolvedBaseline.workerSecrets,
        appliedBundle: normalizedApplied,
      });
      return {
        workerSecrets: nextSecrets,
        workerSecretsEnabled:
          currentWorkerSecretsEnabled === true ? !!resolvedBaseline.workerSecretsEnabled : currentWorkerSecretsEnabled,
        persistWorkerSecrets:
          currentPersistWorkerSecrets === false ? !!resolvedBaseline.persistWorkerSecrets : currentPersistWorkerSecrets,
        deployForm: currentDeployForm,
        deployComplete: currentDeployComplete === false ? !!resolvedBaseline.deployComplete : currentDeployComplete,
        deployWorkerUrl: toStr(currentDeployWorkerUrl).trim()
          ? currentDeployWorkerUrl
          : toStr(resolvedBaseline.deployWorkerUrl || '').trim(),
        corsWorkerUrl: toStr(currentCorsWorkerUrl).trim()
          ? currentCorsWorkerUrl
          : toStr(resolvedBaseline.corsWorkerUrl || '').trim(),
        provisionedSponsoredContext:
          toStr(currentProvisionedSponsoredContext?.sessionSlug || '').trim() ||
          toStr(currentProvisionedSponsoredContext?.workerUrl || '').trim()
            ? currentProvisionedSponsoredContext
            : normalizeProvisionedSponsoredContextForState(resolvedBaseline.provisionedSponsoredContext),
      };
    },
    [buildRestoredSponsoredWorkerSecrets],
  );

  const clearSponsoredBundleTracking = useCallback(() => {
    sponsoredBundleApplyRef.current = '';
    sponsoredBundleBaselineRef.current = null;
    sponsoredBundleAppliedBundleRef.current = null;
    sponsoredBundleTerminalTxIdRef.current = '';
    clearSponsoredBootstrapFundingContext();
  }, []);

  const syncSponsoredBootstrapFundingContext = useCallback(
    (
      bundle: SponsoredBundleLike | AnyRecord | null = null,
      targetSessionSlugOverride: string | undefined = undefined,
    ) => {
      const sourceBundle = bundle && typeof bundle === 'object' ? bundle : sponsoredBundleAppliedBundleRef.current;
      const sponsoredFundingContext = normalizeSponsoredBootstrapFundingContext({
        sessionSlug: sourceBundle?.meta?.sourceSessionSlug,
        workerUrl: sourceBundle?.bootstrapWorkerUrl || sourceBundle?.meta?.sourceWorkerUrl,
        targetSessionSlug: targetSessionSlugOverride ?? draftRef?.current?.slug ?? '',
        faucetGrantToken: sourceBundle?.faucetGrantToken,
      });
      if (sponsoredFundingContext.sessionSlug || sponsoredFundingContext.workerUrl) {
        writeSponsoredBootstrapFundingContext(sponsoredFundingContext);
      } else {
        clearSponsoredBootstrapFundingContext();
      }
      return sponsoredFundingContext;
    },
    [draftRef],
  );

  const restoreSponsoredBundleOverrides = useCallback(() => {
    const baseline = sponsoredBundleBaselineRef.current;
    const appliedBundle = sponsoredBundleAppliedBundleRef.current;
    if (!baseline || !appliedBundle) {
      clearSponsoredBundleTracking();
      return;
    }
    const restored = resolveSponsoredBundleRestoreState({
      currentSecrets: getCurrentWorkerSecrets(),
      currentDeployForm: deployFormRef?.current || {},
      currentDeployComplete: !!deployCompleteRef?.current,
      currentDeployWorkerUrl: deployWorkerUrlRef?.current || '',
      currentCorsWorkerUrl: toStr(draftRef?.current?.corsWorkerUrl || '').trim(),
      currentProvisionedSponsoredContext:
        provisionedSponsoredContextRef?.current || buildEmptyProvisionedSponsoredContext(),
      currentWorkerSecretsEnabled: workerSecretsEnabledRef?.current !== false,
      currentPersistWorkerSecrets: !!persistWorkerSecretsRef?.current,
      baseline,
      appliedBundle,
    });
    applyWorkerSecretsUpdate(restored.workerSecrets);
    updateDeploymentState({
      deployForm: restored.deployForm,
      deployComplete: !!restored.deployComplete,
      deployWorkerUrl: normalizeBaseUrl(toStr(restored.deployWorkerUrl).trim()),
      provisionedSponsoredContext: normalizeProvisionedSponsoredContextForState(restored.provisionedSponsoredContext),
    });
    updateDraftCorsWorkerUrl(toStr(restored.corsWorkerUrl || '').trim());
    updateWorkerSecretState({
      workerSecretsEnabled: restored.workerSecretsEnabled,
      persistWorkerSecrets: restored.persistWorkerSecrets,
    });
    clearSponsoredBundleTracking();
  }, [
    applyWorkerSecretsUpdate,
    clearSponsoredBundleTracking,
    deployCompleteRef,
    deployFormRef,
    deployWorkerUrlRef,
    draftRef,
    getCurrentWorkerSecrets,
    persistWorkerSecretsRef,
    provisionedSponsoredContextRef,
    resolveSponsoredBundleRestoreState,
    updateDeploymentState,
    updateDraftCorsWorkerUrl,
    updateWorkerSecretState,
    workerSecretsEnabledRef,
  ]);

  const applySponsoredBundleOverrides = useCallback(
    (bundle: SponsoredBundleLike | AnyRecord = {}, applyKey = '', terminalTxId = '') => {
      const normalizedBundle = normalizeSparseSponsoredBundlePayload(bundle) as SponsoredBundleLike;
      let baselineSource = {
        workerSecrets: getCurrentWorkerSecrets(),
        deployForm: deployFormRef?.current || {},
        deployComplete: !!deployCompleteRef?.current,
        deployWorkerUrl: deployWorkerUrlRef?.current || '',
        corsWorkerUrl: toStr(draftRef?.current?.corsWorkerUrl || '').trim(),
        provisionedSponsoredContext: provisionedSponsoredContextRef?.current || buildEmptyProvisionedSponsoredContext(),
        workerSecretsEnabled: workerSecretsEnabledRef?.current !== false,
        persistWorkerSecrets: !!persistWorkerSecretsRef?.current,
      };
      if (
        sponsoredBundleBaselineRef.current &&
        sponsoredBundleAppliedBundleRef.current &&
        sponsoredBundleApplyRef.current &&
        sponsoredBundleApplyRef.current !== applyKey
      ) {
        baselineSource = resolveSponsoredBundleRestoreState({
          currentSecrets: baselineSource.workerSecrets,
          currentDeployForm: baselineSource.deployForm,
          currentDeployComplete: baselineSource.deployComplete,
          currentDeployWorkerUrl: baselineSource.deployWorkerUrl,
          currentCorsWorkerUrl: baselineSource.corsWorkerUrl,
          currentProvisionedSponsoredContext: baselineSource.provisionedSponsoredContext,
          currentWorkerSecretsEnabled: baselineSource.workerSecretsEnabled,
          currentPersistWorkerSecrets: baselineSource.persistWorkerSecrets,
          baseline: sponsoredBundleBaselineRef.current,
          appliedBundle: sponsoredBundleAppliedBundleRef.current,
        });
      }
      sponsoredBundleBaselineRef.current = {
        workerSecrets: baselineSource.workerSecrets,
        deployApiToken: toStr(baselineSource.deployForm?.apiToken || '').trim(),
        deployComplete: !!baselineSource.deployComplete,
        deployWorkerUrl: toStr(baselineSource.deployWorkerUrl || '').trim(),
        corsWorkerUrl: toStr(baselineSource.corsWorkerUrl || '').trim(),
        provisionedSponsoredContext: normalizeProvisionedSponsoredContextForState(
          baselineSource.provisionedSponsoredContext,
        ),
        workerSecretsEnabled: baselineSource.workerSecretsEnabled,
        persistWorkerSecrets: baselineSource.persistWorkerSecrets,
      };
      sponsoredBundleAppliedBundleRef.current = normalizedBundle;
      updateWorkerSecretState({
        persistWorkerSecrets: false,
        workerSecretsEnabled: true,
      });
      applyWorkerSecretsUpdate(mergeSponsoredBundleWorkerSecrets(baselineSource.workerSecrets, normalizedBundle));
      updateDeploymentState({
        deployForm: mergeSponsoredBundleDeployForm(baselineSource.deployForm, normalizedBundle),
        deployComplete: false,
        deployWorkerUrl: '',
        workerUrlAutoFilled: false,
        provisionedSponsoredContext: normalizeProvisionedSponsoredContextForState(
          buildEmptyProvisionedSponsoredContext(),
        ),
      });
      syncSponsoredBootstrapFundingContext(normalizedBundle);
      updateDraftCorsWorkerUrl('');
      sponsoredBundleApplyRef.current = applyKey;
      sponsoredBundleTerminalTxIdRef.current = terminalTxId;
    },
    [
      applyWorkerSecretsUpdate,
      deployCompleteRef,
      deployFormRef,
      deployWorkerUrlRef,
      draftRef,
      getCurrentWorkerSecrets,
      persistWorkerSecretsRef,
      provisionedSponsoredContextRef,
      resolveSponsoredBundleRestoreState,
      syncSponsoredBootstrapFundingContext,
      updateDeploymentState,
      updateDraftCorsWorkerUrl,
      updateWorkerSecretState,
      workerSecretsEnabledRef,
    ],
  );

  useEffect(() => {
    if (!sponsoredBundleAppliedBundleRef.current) return;
    syncSponsoredBootstrapFundingContext();
  }, [draftSlug, syncSponsoredBootstrapFundingContext]);

  useEffect(() => {
    const bundleId = toStr(initialSponsoredBundleId || '').trim();
    const bundleKey = toStr(initialSponsoredBundleKey || '').trim();
    if (!bundleId && !bundleKey) {
      // Regression guard: query-only route changes do not remount SessionWizard,
      // so removing `?sponsored=` must explicitly roll back sponsor-applied state.
      restoreSponsoredBundleOverrides();
      setSponsoredBundleStatus(null);
      return;
    }
    const applyKey = bundleKey ? `${bundleId}::${bundleKey}` : `${bundleId}::__session_cache__`;
    const activeApplyKey = sponsoredBundleRetryNonce > 0 ? `${applyKey}::retry:${sponsoredBundleRetryNonce}` : applyKey;
    if (sponsoredBundleApplyRef.current === activeApplyKey) return;
    let cancelled = false;
    const run = async () => {
      const cachedSponsoredBundle = await readSessionWizardSponsoredBundleCache(bundleId);
      if (cancelled) return;
      if (!bundleKey && cachedSponsoredBundle) {
        if (isSponsoredBundleExpired(cachedSponsoredBundle)) {
          await writeSessionWizardSponsoredBundleCache(bundleId, null);
          if (cancelled) return;
          restoreSponsoredBundleOverrides();
          sponsoredBundleTerminalTxIdRef.current = bundleId;
          setSponsoredBundleStatus({ tone: 'error', message: 'Sponsored bundle expired.', retryable: false });
          return;
        }
        applySponsoredBundleOverrides(cachedSponsoredBundle, activeApplyKey, bundleId);
        setSponsoredBundleStatus({
          tone: 'success',
          message: buildSponsoredBundleAppliedStatusMessage(cachedSponsoredBundle),
          retryable: false,
        });
        return;
      }
      if (!bundleKey && sponsoredBundleTerminalTxIdRef.current === bundleId) return;

      if (!bundleId || !bundleKey) {
        restoreSponsoredBundleOverrides();
        scrubSponsoredBundleHashSecret();
        setSponsoredBundleStatus({ tone: 'error', message: 'Malformed sponsored link.', retryable: false });
        return;
      }

      setSponsoredBundleStatus({ tone: 'info', message: 'Loading sponsored bundle…', retryable: false });
      try {
        const result = await readSponsoredBundleFromArweave({
          txId: bundleId,
          secret: bundleKey,
          arweaveOpts: {
            debugContext: {
              caller: 'SessionWizard.sponsoredBundle',
              source: 'session_wizard',
            },
            ...(sponsoredBundleRetryNonce > 0 ? { bypassFailureCache: true } : {}),
          },
        });
        if (cancelled) return;
        applySponsoredBundleOverrides(result.bundle, activeApplyKey, bundleId);
        await writeSessionWizardSponsoredBundleCache(bundleId, result.bundle);
        if (cancelled) return;
        scrubSponsoredBundleHashSecret();
        setSponsoredBundleStatus({
          tone: 'success',
          message: buildSponsoredBundleAppliedStatusMessage(result.bundle),
          retryable: false,
        });
      } catch (error) {
        if (cancelled) return;
        restoreSponsoredBundleOverrides();
        const errorLike = error && typeof error === 'object' ? (error as AnyRecord) : {};
        const code = toStr(errorLike?.code || '')
          .trim()
          .toLowerCase();
        if (code === 'expired_bundle') {
          await writeSessionWizardSponsoredBundleCache(bundleId, null);
          if (cancelled) return;
          scrubSponsoredBundleHashSecret();
          sponsoredBundleTerminalTxIdRef.current = bundleId;
          setSponsoredBundleStatus({ tone: 'error', message: 'Sponsored bundle expired.', retryable: false });
          return;
        }
        if (code === 'decrypt_failed') {
          await writeSessionWizardSponsoredBundleCache(bundleId, null);
          if (cancelled) return;
          scrubSponsoredBundleHashSecret();
          sponsoredBundleTerminalTxIdRef.current = bundleId;
          setSponsoredBundleStatus({ tone: 'error', message: 'Failed to decrypt sponsored bundle.', retryable: false });
          return;
        }
        if (code === 'malformed_link') {
          await writeSessionWizardSponsoredBundleCache(bundleId, null);
          if (cancelled) return;
          scrubSponsoredBundleHashSecret();
          sponsoredBundleTerminalTxIdRef.current = bundleId;
          setSponsoredBundleStatus({ tone: 'error', message: 'Malformed sponsored link.', retryable: false });
          return;
        }
        if (code === 'invalid_bundle' || code === 'empty_bundle') {
          await writeSessionWizardSponsoredBundleCache(bundleId, null);
          if (cancelled) return;
          scrubSponsoredBundleHashSecret();
          sponsoredBundleTerminalTxIdRef.current = bundleId;
          setSponsoredBundleStatus({ tone: 'error', message: 'Invalid sponsored bundle.', retryable: false });
          return;
        }
        setSponsoredBundleStatus({ tone: 'error', message: 'Failed to load sponsored bundle.', retryable: true });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [
    applySponsoredBundleOverrides,
    initialSponsoredBundleId,
    initialSponsoredBundleKey,
    restoreSponsoredBundleOverrides,
    sponsoredBundleRetryNonce,
  ]);

  return {
    sponsoredBundleStatus,
    sponsoredBundleRetryNonce,
    setSponsoredBundleRetryNonce,
    sponsoredBundleAppliedBundleRef,
    restoreSponsoredBundleOverrides,
    clearSponsoredBundleTracking,
    hasSponsoredBundleLink,
  };
};

export default useSponsoredBundleLifecycle;
