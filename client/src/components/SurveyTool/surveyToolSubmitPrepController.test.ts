import { buildFieldEncryptionWorkGroups, verifyEncryptionIntegrity } from './surveyToolSubmitPrepController';
import type { SubmitPrepDeps } from './surveyToolSubmitPrepController';

type TestFieldState = {
  value?: unknown;
  encrypted?: boolean;
  encryptionAudience?: string;
  encryptionGateId?: string | null;
  encryptedPortion?: string;
};

type TestSlice = {
  answers?: Record<string, TestFieldState>;
  additionalComments?: Record<string, TestFieldState>;
  importance?: Record<string, unknown>;
  conviction?: Record<string, unknown>;
};

const makeDeps = (overrides: Partial<SubmitPrepDeps> = {}): SubmitPrepDeps => ({
  isQuestionLockedForResponse: () => false,
  resolveFieldEncryptionGateId: () => 'gate-abc',
  resolveFieldEncryptionAudience: () => 'self',
  getEffectiveRecipientsForField: () => ['0xRecipient1'],
  ...overrides,
});

const makeSlice = (overrides: Partial<TestSlice> = {}): TestSlice => ({
  answers: {},
  additionalComments: {},
  importance: {},
  conviction: {},
  ...overrides,
});

describe('surveyToolSubmitPrepController', () => {
  describe('buildFieldEncryptionWorkGroups', () => {
    it('returns empty groups for empty changedQids', () => {
      const result = buildFieldEncryptionWorkGroups({}, new Set(), makeDeps());

      expect(result.groups).toHaveLength(0);
      expect(result.missingRecipients).toHaveLength(0);
    });

    it('skips non-encrypted answer field', () => {
      const slice = makeSlice({
        answers: {
          q1: { value: 'yes', encrypted: false },
        },
      });

      const result = buildFieldEncryptionWorkGroups(slice, new Set(['q1']), makeDeps());

      expect(result.groups).toHaveLength(0);
    });

    it('groups self-encrypted answer into self group', () => {
      const slice = makeSlice({
        answers: {
          q1: { value: 'yes', encrypted: true, encryptionAudience: 'self' },
        },
      });

      const result = buildFieldEncryptionWorkGroups(
        slice,
        new Set(['q1']),
        makeDeps({ resolveFieldEncryptionAudience: () => 'self' }),
      );

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].recipients).toEqual([]);
      expect(result.groups[0].qids).toContain('q1');
    });

    it('does not promote self-audience fields to gate recipients during submit prep', () => {
      const slice = makeSlice({
        answers: {
          q1: { value: 'yes', encrypted: true, encryptionAudience: 'self' },
        },
        additionalComments: {
          q1: { value: 'private note', encrypted: true, encryptionAudience: 'self' },
        },
      });
      const getEffectiveRecipientsForField = jest.fn(() => ['0xGate']);

      const result = buildFieldEncryptionWorkGroups(
        slice,
        new Set(['q1']),
        makeDeps({
          resolveFieldEncryptionAudience: (field) => field.encryptionAudience || 'self',
          getEffectiveRecipientsForField,
        }),
      );

      expect(getEffectiveRecipientsForField).not.toHaveBeenCalled();
      expect(result.missingRecipients).toHaveLength(0);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].recipients).toEqual([]);
      expect(result.groups[0].slice.answers.q1).toMatchObject({
        encrypted: true,
        encryptionAudience: 'self',
      });
      expect(result.groups[0].slice.additionalComments.q1).toMatchObject({
        encrypted: true,
        encryptionAudience: 'self',
      });
    });

    it('groups gate-encrypted answer with recipients', () => {
      const slice = makeSlice({
        answers: {
          q1: { value: 'yes', encrypted: true, encryptionAudience: 'gate' },
        },
      });

      const result = buildFieldEncryptionWorkGroups(
        slice,
        new Set(['q1']),
        makeDeps({
          resolveFieldEncryptionAudience: () => 'gate',
          getEffectiveRecipientsForField: () => ['0xA', '0xB'],
        }),
      );

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].recipients).toEqual(['0xA', '0xB']);
      expect(result.groups[0].qids).toContain('q1');
    });

    it('reports missing recipients for gate audience with empty recipients', () => {
      const slice = makeSlice({
        answers: {
          q1: { value: 'yes', encrypted: true, encryptionAudience: 'gate' },
        },
      });

      const result = buildFieldEncryptionWorkGroups(
        slice,
        new Set(['q1']),
        makeDeps({
          resolveFieldEncryptionAudience: () => 'gate',
          getEffectiveRecipientsForField: () => [],
        }),
      );

      expect(result.groups).toHaveLength(0);
      expect(result.missingRecipients).toContain('answer:q1');
    });

    it('locked question forces encryption with gate audience', () => {
      const slice = makeSlice({
        answers: {
          q1: { value: 'yes', encrypted: false },
        },
      });

      const result = buildFieldEncryptionWorkGroups(
        slice,
        new Set(['q1']),
        makeDeps({
          isQuestionLockedForResponse: () => true,
          resolveFieldEncryptionAudience: () => 'gate',
          getEffectiveRecipientsForField: () => ['0xA'],
        }),
      );

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].recipients).toEqual(['0xA']);
      expect(result.groups[0].slice.answers.q1).toMatchObject({
        encrypted: true,
        encryptionAudience: 'gate',
        encryptionGateId: 'gate-abc',
      });
    });

    it('locked question forces both answer and additional fields into gate encryption', () => {
      const slice = makeSlice({
        answers: {
          q1: { value: 'yes', encrypted: false },
        },
        additionalComments: {
          q1: { value: 'private note', encrypted: false },
        },
      });

      const result = buildFieldEncryptionWorkGroups(
        slice,
        new Set(['q1']),
        makeDeps({
          isQuestionLockedForResponse: () => true,
          resolveFieldEncryptionAudience: () => 'gate',
          getEffectiveRecipientsForField: () => ['0xA'],
        }),
      );

      expect(result.missingRecipients).toHaveLength(0);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].slice.answers.q1).toMatchObject({
        encrypted: true,
        encryptionAudience: 'gate',
        encryptionGateId: 'gate-abc',
      });
      expect(result.groups[0].slice.additionalComments.q1).toMatchObject({
        encrypted: true,
        encryptionAudience: 'gate',
        encryptionGateId: 'gate-abc',
      });
    });

    it('keeps self answer encryption while reporting a missing gate audience for additional comments', () => {
      const slice = makeSlice({
        answers: {
          q1: { value: 'yes', encrypted: true, encryptionAudience: 'self' },
        },
        additionalComments: {
          q1: { value: 'private note', encrypted: true, encryptionAudience: 'gate' },
        },
      });

      const result = buildFieldEncryptionWorkGroups(
        slice,
        new Set(['q1']),
        makeDeps({
          resolveFieldEncryptionAudience: (_field, _qid, fieldKey) => (fieldKey === 'answer' ? 'self' : 'gate'),
          getEffectiveRecipientsForField: () => [],
        }),
      );

      expect(result.missingRecipients).toEqual(['additional:q1']);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].recipients).toEqual([]);
      expect(result.groups[0].slice.answers.q1).toBeDefined();
      expect(result.groups[0].slice.additionalComments.q1).toBeUndefined();
    });

    it('groups both answer and additional into same group when same recipients', () => {
      const slice = makeSlice({
        answers: {
          q1: { value: 'yes', encrypted: true },
        },
        additionalComments: {
          q1: { value: 'comment', encrypted: true },
        },
      });

      const result = buildFieldEncryptionWorkGroups(
        slice,
        new Set(['q1']),
        makeDeps({ resolveFieldEncryptionAudience: () => 'self' }),
      );

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].slice.answers.q1).toBeDefined();
      expect(result.groups[0].slice.additionalComments.q1).toBeDefined();
    });

    it('separates answer and additional into different groups when different audiences', () => {
      const slice = makeSlice({
        answers: {
          q1: { value: 'yes', encrypted: true, encryptionAudience: 'gate' },
        },
        additionalComments: {
          q1: { value: 'comment', encrypted: true, encryptionAudience: 'self' },
        },
      });

      const result = buildFieldEncryptionWorkGroups(
        slice,
        new Set(['q1']),
        makeDeps({
          resolveFieldEncryptionAudience: (_field, _qid, fieldKey) => (fieldKey === 'answer' ? 'gate' : 'self'),
          getEffectiveRecipientsForField: () => ['0xA'],
        }),
      );

      const gateGroup = result.groups.find((group) => group.recipients.length > 0);
      const selfGroup = result.groups.find((group) => group.recipients.length === 0);

      expect(result.groups).toHaveLength(2);
      expect(gateGroup?.slice.answers.q1).toBeDefined();
      expect(gateGroup?.slice.additionalComments.q1).toBeUndefined();
      expect(selfGroup?.slice.additionalComments.q1).toBeDefined();
      expect(selfGroup?.slice.answers.q1).toBeUndefined();
    });
  });

  describe('verifyEncryptionIntegrity', () => {
    it('passes for empty slice', () => {
      const result = verifyEncryptionIntegrity({});

      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it('passes for encrypted answer with encryptedPortion', () => {
      const slice = makeSlice({
        answers: {
          q1: { encrypted: true, encryptedPortion: 'abc', value: 'secret' },
        },
      });

      const result = verifyEncryptionIntegrity(slice);

      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it('fails for encrypted answer without encryptedPortion', () => {
      const slice = makeSlice({
        answers: {
          q1: { encrypted: true, value: 'secret' },
        },
      });

      const result = verifyEncryptionIntegrity(slice);

      expect(result.passed).toBe(false);
      expect(result.failures).toHaveLength(1);
    });

    it("passes for encrypted answer with value '*' (wildcard)", () => {
      const slice = makeSlice({
        answers: {
          q1: { encrypted: true, value: '*' },
        },
      });

      const result = verifyEncryptionIntegrity(slice);

      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it('passes for empty default-gated encrypted answer without encryptedPortion', () => {
      const slice = makeSlice({
        answers: {
          q1: {
            encrypted: true,
            encryptionAudience: 'gate',
            value: '',
          },
        },
      });

      const result = verifyEncryptionIntegrity(slice);

      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it('passes for empty encrypted additional comment without encryptedPortion', () => {
      const slice = makeSlice({
        answers: {
          q1: { encrypted: true, encryptedPortion: 'abc', value: '*' },
        },
        additionalComments: {
          q1: { encrypted: true, value: '' },
        },
      });

      const result = verifyEncryptionIntegrity(slice);

      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it('fails for non-empty encrypted additional comment without encryptedPortion', () => {
      const slice = makeSlice({
        answers: {
          q1: { encrypted: true, encryptedPortion: 'abc', value: '*' },
        },
        additionalComments: {
          q1: { encrypted: true, value: 'notes' },
        },
      });

      const result = verifyEncryptionIntegrity(slice);

      expect(result.passed).toBe(false);
      expect(result.failures).toEqual([
        'Verification failed: Additional for q1 marked encrypted but has no encryptedPortion.',
      ]);
    });

    it('fails for additional-only encrypted comments without encryptedPortion', () => {
      const slice = makeSlice({
        additionalComments: {
          q1: { encrypted: true, value: 'standalone private note' },
        },
      });

      const result = verifyEncryptionIntegrity(slice);

      expect(result.passed).toBe(false);
      expect(result.failures).toEqual([
        'Verification failed: Additional for q1 marked encrypted but has no encryptedPortion.',
      ]);
    });

    it('respects onlyTheseQids filter', () => {
      const slice = makeSlice({
        answers: {
          q1: { encrypted: true, value: 'bad' },
          q2: { encrypted: true, value: 'also bad' },
        },
        additionalComments: {
          q3: { encrypted: true, value: 'additional bad' },
        },
      });

      const result = verifyEncryptionIntegrity(slice, new Set(['q1']));

      expect(result.passed).toBe(false);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toContain('q1');
    });
  });
});
