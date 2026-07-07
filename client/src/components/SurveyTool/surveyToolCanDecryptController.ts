/** @file surveyToolCanDecryptController.ts */

import {
  buildCanDecryptOtherResponsesSnapshot,
  resolveCanDecryptOtherResponsesVerdict,
} from './surveyToolResponseAccess.js';

export type CanDecryptSessionConfig = Record<string, unknown> & {
  __registry?: Record<string, unknown>;
};
export type CanDecryptPolicy = Record<string, unknown> & {
  primaryResource?: unknown;
  recipients?: unknown[];
};
export type CanDecryptSnapshot = ReturnType<typeof buildCanDecryptOtherResponsesSnapshot>;
type BuildCanDecryptSnapshotFn = (args: {
  account: string;
  loginComplete: boolean;
  singleQuestionMode: boolean;
  isStandalone: boolean;
  policy: CanDecryptPolicy | null;
  slug: string;
  sbtCacheRevision: number;
  cfg: CanDecryptSessionConfig | null;
}) => CanDecryptSnapshot;

const buildCanDecryptSnapshot = buildCanDecryptOtherResponsesSnapshot as unknown as BuildCanDecryptSnapshotFn;

export interface CanDecryptContextInputs {
  getEffectiveDraftSlug: () => string;
  resolveEffectiveSlugFromProps: () => string;
  resolveEffectiveResponseGateConfig: (slug: string) => CanDecryptSessionConfig | null;
  getResponseGatePolicy: () => CanDecryptPolicy | null;
  account: string;
  loginComplete: boolean;
  singleQuestionMode: boolean;
  isStandalone: boolean;
  sbtCacheRevision: number;
}

export interface CanDecryptContext {
  slug: string;
  cfg: CanDecryptSessionConfig | null;
  policy: CanDecryptPolicy | null;
  snapshot: CanDecryptSnapshot;
}

export type CanDecryptPreCheckResult =
  { earlyExit: true; status: 'needs-wallet' } | { earlyExit: true; status: 'no-gate' } | { earlyExit: false };

export interface ResolveCanDecryptGateAccessParams {
  cfg: CanDecryptSessionConfig | null;
  slug: string;
  account: string;
  resourceKeysToCheck: string[];
}

export type CheckAccessFn = (params: {
  sessionConfig: CanDecryptSessionConfig | null;
  sessionSlug: string;
  account: string;
  resourceKey: string;
}) => Promise<{ status: string }>;

export const buildCanDecryptContext = (inputs: CanDecryptContextInputs): CanDecryptContext => {
  const slug = inputs.getEffectiveDraftSlug() || inputs.resolveEffectiveSlugFromProps();
  const cfg = inputs.resolveEffectiveResponseGateConfig(slug);
  const policy = inputs.getResponseGatePolicy();
  const snapshot = buildCanDecryptSnapshot({
    account: inputs.account,
    loginComplete: inputs.loginComplete,
    singleQuestionMode: inputs.singleQuestionMode,
    isStandalone: inputs.isStandalone,
    policy,
    slug,
    sbtCacheRevision: inputs.sbtCacheRevision,
    cfg,
  });

  return { slug, cfg, policy, snapshot };
};

export const evaluateCanDecryptPreCheck = (snapshot: CanDecryptSnapshot): CanDecryptPreCheckResult => {
  if (!snapshot.loggedIn) {
    return { earlyExit: true, status: 'needs-wallet' };
  }
  if (snapshot.recipients.length === 0) {
    return { earlyExit: true, status: 'no-gate' };
  }
  return { earlyExit: false };
};

export const resolveCanDecryptGateAccess = async (
  params: ResolveCanDecryptGateAccessParams,
  checkAccess: CheckAccessFn,
): Promise<{ canDecrypt: boolean; status: string }> => {
  const verdicts: Array<{ status: string }> = [];
  for (const resourceKey of params.resourceKeysToCheck) {
    verdicts.push(
      await checkAccess({
        sessionConfig: params.cfg,
        sessionSlug: params.slug,
        account: params.account,
        resourceKey,
      }),
    );
  }

  return resolveCanDecryptOtherResponsesVerdict(verdicts);
};
