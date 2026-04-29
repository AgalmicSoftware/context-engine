/** @file surveyToolCanDecryptController.ts */

import {
  buildCanDecryptOtherResponsesSnapshot,
  resolveCanDecryptOtherResponsesVerdict,
} from './surveyToolResponseAccess.js';

export interface CanDecryptContextInputs {
  getEffectiveDraftSlug: () => string;
  resolveEffectiveSlugFromProps: () => string;
  resolveEffectiveResponseGateConfig: (slug: string) => any;
  getResponseGatePolicy: () => any;
  account: string;
  loginComplete: boolean;
  singleQuestionMode: boolean;
  isStandalone: boolean;
  sbtCacheRevision: number;
}

export type CanDecryptSnapshot = ReturnType<typeof buildCanDecryptOtherResponsesSnapshot>;

export interface CanDecryptContext {
  slug: string;
  cfg: any;
  policy: any;
  snapshot: CanDecryptSnapshot;
}

export type CanDecryptPreCheckResult =
  | { earlyExit: true; status: 'needs-wallet' }
  | { earlyExit: true; status: 'no-gate' }
  | { earlyExit: false };

export interface ResolveCanDecryptGateAccessParams {
  cfg: any;
  slug: string;
  account: string;
  resourceKeysToCheck: string[];
}

export type CheckAccessFn = (params: {
  sessionConfig: any;
  sessionSlug: string;
  account: string;
  resourceKey: string;
}) => Promise<{ status: string }>;

export const buildCanDecryptContext = (
  inputs: CanDecryptContextInputs,
): CanDecryptContext => {
  const slug = inputs.getEffectiveDraftSlug() || inputs.resolveEffectiveSlugFromProps();
  const cfg = inputs.resolveEffectiveResponseGateConfig(slug);
  const policy = inputs.getResponseGatePolicy();
  const snapshot = buildCanDecryptOtherResponsesSnapshot({
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

export const evaluateCanDecryptPreCheck = (
  snapshot: CanDecryptSnapshot,
): CanDecryptPreCheckResult => {
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
    verdicts.push(await checkAccess({
      sessionConfig: params.cfg,
      sessionSlug: params.slug,
      account: params.account,
      resourceKey,
    }));
  }

  return resolveCanDecryptOtherResponsesVerdict(verdicts);
};
