import { toStr } from '../../utilities/shared/primitives.js';
import type { AnyRecord, WorkerSecretSyncResult, WorkerSecretsLike } from '../shellTypes';
import { CHIPOTLE_LIT_CONFIG_FIELDS, LIT_RUNTIME_RECOVERY_MARKER_FIELD } from './sessionWizardWorkerSecretSupport';
import { normalizeSessionWizardSlug, normalizeSessionWizardWorkerUrl } from './sessionWizardUrlSupport';

export type SessionWizardLitBootstrapRecovery = {
  workerUrl: string;
  slug: string;
  litCredentials: Record<string, string>;
};

export const createSessionWizardEnsureWorkerSessionConfig =
  ({
    getWorkerConfig,
    getAdminAddress,
    signTypedAdminAction,
    fetchImpl = fetch,
  }: {
    getWorkerConfig: () => AnyRecord;
    getAdminAddress: () => string;
    signTypedAdminAction: (input: AnyRecord) => Promise<AnyRecord>;
    fetchImpl?: typeof fetch;
  }) =>
  async ({ workerUrl, slug: targetSlug }: AnyRecord): Promise<void> => {
    const workerConfig = getWorkerConfig();
    const requestBody = {
      sessionSlug: targetSlug,
      adminAddress: workerConfig.adminAddress || getAdminAddress(),
      config: workerConfig,
    };
    const auth = await signTypedAdminAction({
      action: 'set-config',
      body: requestBody,
      targetSlug,
      workerUrl,
    });
    const configRes = await fetchImpl(`${workerUrl}/admin/set-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...requestBody,
        adminAddress: requestBody.adminAddress || auth.address,
        ...auth,
      }),
    });
    const configData = await configRes.json().catch(() => ({}));
    if (!configRes.ok) throw new Error(configData?.error || 'Failed to sync worker config after deploy.');
  };

export const resolveCompleteSessionWizardLitRuntime = (value: unknown): Record<string, string> | null => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {};
  const litCredentials = CHIPOTLE_LIT_CONFIG_FIELDS.reduce<Record<string, string>>((result, field) => {
    result[field] = toStr(source[field]).trim();
    return result;
  }, {});
  return CHIPOTLE_LIT_CONFIG_FIELDS.every((field) => !!litCredentials[field]) ? litCredentials : null;
};

export const mergeRecoveredSessionWizardLitRuntime = (
  current: WorkerSecretsLike | AnyRecord,
  litCredentials: Record<string, string>,
): WorkerSecretsLike => ({
  ...(current && typeof current === 'object' ? current : {}),
  ...litCredentials,
  [LIT_RUNTIME_RECOVERY_MARKER_FIELD]: 'bootstrap',
});

export const buildSessionWizardLitBootstrapRecovery = ({
  workerUrl,
  slug,
  litCredentials,
}: {
  workerUrl?: unknown;
  slug?: unknown;
  litCredentials?: unknown;
}): SessionWizardLitBootstrapRecovery | null => {
  const normalizedWorkerUrl = normalizeSessionWizardWorkerUrl(workerUrl);
  const normalizedSlug = normalizeSessionWizardSlug(slug);
  const normalizedLitCredentials = resolveCompleteSessionWizardLitRuntime(litCredentials);
  return normalizedWorkerUrl && normalizedSlug && normalizedLitCredentials
    ? { workerUrl: normalizedWorkerUrl, slug: normalizedSlug, litCredentials: normalizedLitCredentials }
    : null;
};

export const matchesSessionWizardLitBootstrapRecovery = ({
  recovery,
  workerUrl,
  slug,
  litCredentials,
}: {
  recovery?: SessionWizardLitBootstrapRecovery | null;
  workerUrl?: unknown;
  slug?: unknown;
  litCredentials?: unknown;
}): boolean => {
  const candidate = buildSessionWizardLitBootstrapRecovery({ workerUrl, slug, litCredentials });
  return !!(
    recovery &&
    candidate &&
    recovery.workerUrl === candidate.workerUrl &&
    recovery.slug === candidate.slug &&
    CHIPOTLE_LIT_CONFIG_FIELDS.every((field) => recovery.litCredentials[field] === candidate.litCredentials[field])
  );
};

export const syncSessionWizardLitRuntimeConfigAfterDeploy = async ({
  requiresLit = false,
  workerUrl,
  slug,
  litCredentials,
  ensureSessionConfig,
}: {
  requiresLit?: boolean;
  workerUrl?: unknown;
  slug?: unknown;
  litCredentials?: unknown;
  ensureSessionConfig?: (input: AnyRecord) => Promise<unknown>;
}): Promise<WorkerSecretSyncResult> => {
  if (
    !requiresLit ||
    !normalizeSessionWizardWorkerUrl(workerUrl) ||
    !resolveCompleteSessionWizardLitRuntime(litCredentials)
  ) {
    return { warning: '', note: '', synced: false, skipped: true };
  }
  try {
    await ensureSessionConfig?.({ workerUrl, slug });
    return { warning: '', note: 'Lit runtime config verified.', synced: true };
  } catch (err) {
    return {
      warning: toStr((err as AnyRecord)?.message || err).trim() || 'Failed to verify the Lit runtime config.',
      note: '',
      synced: false,
    };
  }
};
