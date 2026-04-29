import { shouldEncryptResponseFieldForSubmit } from './surveyToolDraftState';
import { normalizeQuestionIdKey } from './surveyToolSignatures';

export interface SubmitPrepDeps {
  isQuestionLockedForResponse: (qid: string) => boolean;
  resolveFieldEncryptionGateId: (field: any, qid: string, fieldKey: string) => string | null;
  resolveFieldEncryptionAudience: (field: any, qid: string, fieldKey: string) => string;
  getEffectiveRecipientsForField: (opts: { questionId: string; fieldKey: string; field: any }) => string[];
}

export interface EncryptionWorkGroup {
  recipients: string[];
  qids: string[];
  slice: {
    answers: Record<string, any>;
    additionalComments: Record<string, any>;
    importance: Record<string, any>;
    conviction: Record<string, any>;
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
  slice: Record<string, any>,
  changedQids: Set<string>,
  deps: SubmitPrepDeps,
): EncryptionWorkGroupsResult => {
  const groups = new Map<string, MutableEncryptionWorkGroup>();
  const missingRecipients: string[] = [];
  const sourceSlice = slice || {};

  const ensureGroup = (recipients: string[] = []): MutableEncryptionWorkGroup => {
    const normalizedRecipients = Array.isArray(recipients) ? recipients.filter(Boolean) : [];
    const groupKey = normalizedRecipients.length > 0
      ? `gate:${JSON.stringify(normalizedRecipients)}`
      : 'self';
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
    const applyLock = (field: any, fieldKey: EncryptionFieldKey = 'answer') => {
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
      value: any;
    }> = [
      { fieldKey: 'answer', bucketKey: 'answers', value: applyLock(sourceSlice.answers?.[qid], 'answer') },
      { fieldKey: 'additional', bucketKey: 'additionalComments', value: applyLock(sourceSlice.additionalComments?.[qid], 'additional') },
    ];

    fieldSpecs.forEach(({ fieldKey, bucketKey, value }) => {
      if (!shouldEncryptResponseFieldForSubmit(value)) return;
      const audience = deps.resolveFieldEncryptionAudience(value, qid, fieldKey);
      const recipients = audience === 'gate'
        ? deps.getEffectiveRecipientsForField({ questionId: qid, fieldKey, field: value })
        : [];
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
  slice: Record<string, any>,
  onlyTheseQids: Set<string> | null = null,
): { passed: boolean; failures: string[] } => {
  const failures: string[] = [];
  const stateToCheck = slice || {};
  let verificationPassed = true;

  const limitSet = onlyTheseQids ? new Set(Array.from(onlyTheseQids)) : null;

  if (stateToCheck && stateToCheck.answers) {
    for (const qId in stateToCheck.answers) {
      if (limitSet && !limitSet.has(qId)) continue;
      const answer = stateToCheck.answers[qId];
      const additional = stateToCheck.additionalComments ? stateToCheck.additionalComments[qId] : null;

      if (answer && answer.encrypted && !answer.encryptedPortion && answer.value !== '*') {
        failures.push(`Verification failed: Answer for ${qId} marked encrypted but has no encryptedPortion.`);
        verificationPassed = false;
      }
      if (additional && additional.encrypted && !additional.encryptedPortion && additional.value !== '*') {
        failures.push(`Verification failed: Additional for ${qId} marked encrypted but has no encryptedPortion.`);
        verificationPassed = false;
      }
    }
  }

  return {
    passed: verificationPassed,
    failures,
  };
};
