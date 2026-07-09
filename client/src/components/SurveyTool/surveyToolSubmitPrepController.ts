import { hasMeaningfulFieldValue, shouldEncryptResponseFieldForSubmit } from './surveyToolDraftState';
import { normalizeQuestionIdKey } from './surveyToolSignatures';
import type { ResponseFieldState } from './surveyToolAudienceDerivationController';

type SubmitResponseFieldState = ResponseFieldState & {
  encrypted?: boolean;
};

type SubmitPrepSlice = {
  answers?: Record<string, SubmitResponseFieldState>;
  additionalComments?: Record<string, SubmitResponseFieldState>;
  importance?: Record<string, unknown>;
  conviction?: Record<string, unknown>;
};

export interface SubmitPrepDeps {
  isQuestionLockedForResponse: (qid: string) => boolean;
  resolveFieldEncryptionGateId: (field: SubmitResponseFieldState, qid: string, fieldKey: string) => string | null;
  resolveFieldEncryptionAudience: (field: SubmitResponseFieldState, qid: string, fieldKey: string) => string;
  getEffectiveRecipientsForField: (opts: {
    questionId: string;
    fieldKey: string;
    field: SubmitResponseFieldState;
  }) => string[];
}

export interface EncryptionWorkGroup {
  recipients: string[];
  qids: string[];
  slice: {
    answers: Record<string, SubmitResponseFieldState>;
    additionalComments: Record<string, SubmitResponseFieldState>;
    importance: Record<string, unknown>;
    conviction: Record<string, unknown>;
  };
}

export interface EncryptionWorkGroupsResult {
  groups: EncryptionWorkGroup[];
  missingRecipients: string[];
}

type EncryptionBucketKey = 'answers' | 'additionalComments';
type EncryptionFieldKey = 'answer' | 'additional';

type MutableEncryptionWorkGroup = {
  recipients: string[];
  qids: Set<string>;
  slice: EncryptionWorkGroup['slice'];
};

export const buildFieldEncryptionWorkGroups = (
  slice: SubmitPrepSlice | null | undefined,
  changedQids: Set<string>,
  deps: SubmitPrepDeps,
): EncryptionWorkGroupsResult => {
  const groups = new Map<string, MutableEncryptionWorkGroup>();
  const missingRecipients: string[] = [];
  const sourceSlice = slice || {};

  const ensureGroup = (recipients: string[] = []): MutableEncryptionWorkGroup => {
    const normalizedRecipients = Array.isArray(recipients) ? recipients.filter(Boolean) : [];
    const groupKey = normalizedRecipients.length > 0 ? `gate:${JSON.stringify(normalizedRecipients)}` : 'self';
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        recipients: normalizedRecipients,
        qids: new Set(),
        slice: {
          answers: {},
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      });
    }
    return groups.get(groupKey)!;
  };

  Array.from(changedQids || []).forEach((qidRaw) => {
    const qid = normalizeQuestionIdKey(qidRaw);
    if (!qid) return;
    const questionLocked = deps.isQuestionLockedForResponse(qid);
    const applyLock = (
      field: SubmitResponseFieldState | undefined,
      fieldKey: EncryptionFieldKey = 'answer',
    ): SubmitResponseFieldState | undefined => {
      if (!questionLocked || !field || typeof field !== 'object') return field;
      return {
        ...field,
        encrypted: true,
        encryptionAudience: 'gate',
        encryptionGateId: deps.resolveFieldEncryptionGateId(field, qid, fieldKey),
      };
    };

    const fieldSpecs: Array<{
      fieldKey: EncryptionFieldKey;
      bucketKey: EncryptionBucketKey;
      value: SubmitResponseFieldState | undefined;
    }> = [
      { fieldKey: 'answer', bucketKey: 'answers', value: applyLock(sourceSlice.answers?.[qid], 'answer') },
      {
        fieldKey: 'additional',
        bucketKey: 'additionalComments',
        value: applyLock(sourceSlice.additionalComments?.[qid], 'additional'),
      },
    ];

    fieldSpecs.forEach(({ fieldKey, bucketKey, value }) => {
      if (!value || !shouldEncryptResponseFieldForSubmit(value)) return;
      const audience = deps.resolveFieldEncryptionAudience(value, qid, fieldKey);
      const recipients =
        audience === 'gate' ? deps.getEffectiveRecipientsForField({ questionId: qid, fieldKey, field: value }) : [];
      if (audience === 'gate' && (!Array.isArray(recipients) || recipients.length === 0)) {
        missingRecipients.push(`${fieldKey}:${qid}`);
        return;
      }
      const group = ensureGroup(recipients);
      group.qids.add(qid);
      group.slice[bucketKey][qid] = { ...value };
    });
  });

  return {
    groups: Array.from(groups.values()).map((group) => ({
      ...group,
      qids: Array.from(group.qids || []),
    })),
    missingRecipients,
  };
};

export const verifyEncryptionIntegrity = (
  slice: SubmitPrepSlice | null | undefined,
  onlyTheseQids: Set<string> | null = null,
): { passed: boolean; failures: string[] } => {
  const failures: string[] = [];
  const stateToCheck = slice || {};
  let verificationPassed = true;

  const limitSet = onlyTheseQids ? new Set(Array.from(onlyTheseQids)) : null;

  const qidsToCheck = new Set([
    ...Object.keys(stateToCheck.answers || {}),
    ...Object.keys(stateToCheck.additionalComments || {}),
  ]);

  for (const qId of qidsToCheck) {
    if (limitSet && !limitSet.has(qId)) continue;
    const answer = stateToCheck.answers ? stateToCheck.answers[qId] : null;
    const additional = stateToCheck.additionalComments ? stateToCheck.additionalComments[qId] : null;

    if (
      answer &&
      answer.encrypted &&
      !answer.encryptedPortion &&
      answer.value !== '*' &&
      hasMeaningfulFieldValue(answer)
    ) {
      failures.push(`Verification failed: Answer for ${qId} marked encrypted but has no encryptedPortion.`);
      verificationPassed = false;
    }
    if (
      additional &&
      additional.encrypted &&
      !additional.encryptedPortion &&
      additional.value !== '*' &&
      hasMeaningfulFieldValue(additional)
    ) {
      failures.push(`Verification failed: Additional for ${qId} marked encrypted but has no encryptedPortion.`);
      verificationPassed = false;
    }
  }

  return {
    passed: verificationPassed,
    failures,
  };
};
