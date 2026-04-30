import {
  buildAdditionalUpdatePlan,
  buildAnswerUpdatePlan,
  resolveFieldEncryptionDefaults,
} from './surveyToolResponseMutationController';

const defaultDeps = (overrides: Partial<any> = {}) => ({
  buildEmptyResponseFieldState: (qid: string, fieldKey = 'answer') => ({
    value: '',
    encrypted: false,
    encryptionAudience: 'self',
    encryptionGateId: null,
    audienceMode: fieldKey === 'additional' ? 'inherit' : 'explicit',
    hash: '',
    encryptedPortion: '',
  }),
  resolveFieldEncryptionAudience: () => 'self',
  resolveFieldEncryptionGateId: () => null,
  isQuestionLockedForResponse: () => false,
  getEffectiveRecipientsForQid: () => [],
  normalizeFieldAudienceMode: (_val: any, _fk: string, _f: any) => 'inherit',
  buildInheritedAdditionalFieldState: (add: any, ans: any) => ({
    ...add,
    encrypted: !!ans?.encrypted,
    audienceMode: 'inherit',
  }),
  valuesEqual: (a: any, b: any) => a === b,
  getQuestionById: () => ({ type: 'freeform' }),
  computeHash: (val: string) => `hash-${val}`,
  ...overrides,
});

describe('surveyToolResponseMutationController', () => {
  describe('resolveFieldEncryptionDefaults', () => {
    it('returns unlocked self defaults for basic field', () => {
      const result = resolveFieldEncryptionDefaults(
        { value: 'a', encrypted: false },
        'q1',
        'answer',
        defaultDeps(),
      );

      expect(result).toEqual({
        questionLocked: false,
        resolvedAudience: 'self',
        resolvedGateId: null,
        nextEncrypted: false,
      });
    });

    it('returns locked gate defaults when question is locked', () => {
      const result = resolveFieldEncryptionDefaults(
        { value: 'a', encrypted: false },
        'q1',
        'answer',
        defaultDeps({
          isQuestionLockedForResponse: () => true,
        }),
      );

      expect(result.questionLocked).toBe(true);
      expect(result.resolvedAudience).toBe('gate');
      expect(result.nextEncrypted).toBe(true);
    });

    it('auto-encrypts when recipients exist and no existing encryption state', () => {
      const result = resolveFieldEncryptionDefaults(
        { value: 'a' },
        'q1',
        'answer',
        defaultDeps({
          getEffectiveRecipientsForQid: () => ['addr1'],
          resolveFieldEncryptionGateId: () => 'gate-1',
          resolveFieldEncryptionAudience: () => '',
        }),
      );

      expect(result.nextEncrypted).toBe(true);
      expect(result.resolvedAudience).toBe('gate');
      expect(result.resolvedGateId).toBe('gate-1');
    });
  });

  describe('buildAnswerUpdatePlan', () => {
    it('returns changed=false when value and encryption unchanged and hash exists', () => {
      const plan = buildAnswerUpdatePlan(
        'q1',
        'same',
        {
          answers: {
            q1: {
              value: 'same',
              encrypted: false,
              encryptionAudience: 'self',
              hash: 'existing',
            },
          },
          additionalComments: {},
        },
        defaultDeps(),
      );

      expect(plan.changed).toBe(false);
    });

    it('detects value change and computes hash', () => {
      const plan = buildAnswerUpdatePlan(
        'q1',
        'new',
        {
          answers: {
            q1: {
              value: 'old',
              hash: 'x',
            },
          },
          additionalComments: {},
        },
        defaultDeps(),
      );

      expect(plan.changed).toBe(true);
      expect(plan.nextAnswerState.value).toBe('new');
      expect(plan.nextAnswerState.hash).toBe('hash-new');
    });

    it('binary re-click clears answer', () => {
      const plan = buildAnswerUpdatePlan(
        'q1',
        'Yes',
        {
          answers: {
            q1: {
              value: 'Yes',
              hash: '',
            },
          },
          additionalComments: {},
        },
        defaultDeps({
          getQuestionById: () => ({ type: 'binary' }),
        }),
      );

      expect(plan.changed).toBe(true);
      expect(plan.nextAnswerState.value).toBe('');
    });

    it('skips hash for array answers', () => {
      const plan = buildAnswerUpdatePlan(
        'q1',
        ['a', 'b'],
        {
          answers: {},
          additionalComments: {},
        },
        defaultDeps(),
      );

      expect(plan.changed).toBe(true);
      expect(plan.nextAnswerState.hash).toBe('');
    });

    it('propagates inherited additional state when answer changes', () => {
      const plan = buildAnswerUpdatePlan(
        'q1',
        'new',
        {
          answers: {},
          additionalComments: {
            q1: {
              value: 'note',
              audienceMode: 'inherit',
            },
          },
        },
        defaultDeps({
          normalizeFieldAudienceMode: () => 'inherit',
        }),
      );

      expect(plan.nextAdditionalState).not.toBeNull();
      expect(plan.nextAdditionalState?.audienceMode).toBe('inherit');
    });

    it('does not propagate additional when mode is explicit', () => {
      const plan = buildAnswerUpdatePlan(
        'q1',
        'new',
        {
          answers: {},
          additionalComments: {
            q1: {
              value: 'note',
              audienceMode: 'explicit',
            },
          },
        },
        defaultDeps({
          normalizeFieldAudienceMode: () => 'explicit',
        }),
      );

      expect(plan.nextAdditionalState).toBeNull();
    });
  });

  describe('buildAdditionalUpdatePlan', () => {
    it('returns changed=false when value and encryption unchanged and hash exists', () => {
      const plan = buildAdditionalUpdatePlan(
        'q1',
        'same',
        {
          answers: {},
          additionalComments: {
            q1: {
              value: 'same',
              encrypted: false,
              encryptionAudience: 'self',
              hash: 'x',
              audienceMode: 'inherit',
            },
          },
        },
        defaultDeps(),
      );

      expect(plan.changed).toBe(false);
    });

    it('detects additional value change', () => {
      const plan = buildAdditionalUpdatePlan(
        'q1',
        'new',
        {
          answers: {},
          additionalComments: {
            q1: {
              value: 'old',
              hash: 'x',
              audienceMode: 'inherit',
            },
          },
        },
        defaultDeps(),
      );

      expect(plan.changed).toBe(true);
      expect(plan.nextAdditionalState.value).toBe('new');
      expect(plan.nextAdditionalState.hash).toBe('hash-new');
    });

    it('resolves inherited state from answer when mode is inherit', () => {
      const plan = buildAdditionalUpdatePlan(
        'q1',
        'new',
        {
          answers: {
            q1: {
              value: 'answer',
              encrypted: true,
            },
          },
          additionalComments: {
            q1: {
              value: 'old',
              audienceMode: 'inherit',
            },
          },
        },
        defaultDeps(),
      );

      expect(plan.nextAdditionalState.encrypted).toBe(true);
    });
  });
});
