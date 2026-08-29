import {
  buildAdditionalAudienceSelectionPlan,
  buildAnswerAudienceSelectionPlan,
  buildEncryptionTogglePlan,
} from './surveyToolFieldEncryptionController';
import { normalizeFieldAudienceMode } from './surveyToolAudienceDerivationController';
import type {
  AudienceSelectionPlan,
  EncryptionTogglePlan,
  FieldEncryptionDeps,
} from './surveyToolFieldEncryptionController';

type TestFieldState = {
  value: string;
  encrypted: boolean;
  encryptionAudience: string;
  encryptionGateId: string | null;
  audienceMode: string;
};

type TestSlice = {
  answers: Record<string, TestFieldState>;
  additionalComments: Record<string, TestFieldState>;
};

const makeDeps = (overrides: Partial<FieldEncryptionDeps> = {}): FieldEncryptionDeps => ({
  isQuestionLockedForResponse: () => false,
  buildEmptyResponseFieldState: () => ({
    value: '',
    encrypted: false,
    encryptionAudience: 'self',
    encryptionGateId: null,
    audienceMode: 'default',
  }),
  resolveFieldEncryptionAudience: () => 'self',
  resolveFieldEncryptionGateId: () => 'gate-abc',
  normalizeFieldAudienceMode: (value) => String(value || ''),
  buildInheritedAdditionalFieldState: (additionalField, answerField) => ({
    ...additionalField,
    encrypted: answerField.encrypted,
    encryptionAudience: answerField.encryptionAudience,
    encryptionGateId: answerField.encryptionGateId,
    audienceMode: 'inherited',
  }),
  normalizeResponseEncryptionAudience: (audience) => String(audience || ''),
  ...overrides,
});

const makeSlice = (overrides: Partial<TestSlice> = {}): TestSlice => ({
  answers: {},
  additionalComments: {},
  ...overrides,
});

describe('surveyToolFieldEncryptionController', () => {
  describe('buildEncryptionTogglePlan', () => {
    it('toggle answer on - sets encrypted true, audience from resolver', () => {
      const plan: EncryptionTogglePlan = buildEncryptionTogglePlan(
        'q1',
        'answer',
        true,
        makeSlice(),
        makeDeps({ resolveFieldEncryptionAudience: () => 'team' }),
      );

      expect(plan.nextFieldState).toMatchObject({
        encrypted: true,
        encryptionAudience: 'team',
        audienceMode: 'explicit',
      });
      expect(plan.clearMenus).toBe(false);
    });

    it('toggle answer off - sets encrypted false, audience self, clearMenus true', () => {
      const plan: EncryptionTogglePlan = buildEncryptionTogglePlan('q1', 'answer', false, makeSlice(), makeDeps());

      expect(plan.nextFieldState).toMatchObject({
        encrypted: false,
        encryptionAudience: 'self',
        audienceMode: 'explicit',
      });
      expect(plan.clearMenus).toBe(true);
    });

    it('toggle answer on locked question - forces encrypted true regardless of newEncryptedState=false', () => {
      const deps = makeDeps({
        isQuestionLockedForResponse: () => true,
      });

      const plan: EncryptionTogglePlan = buildEncryptionTogglePlan('q1', 'answer', false, makeSlice(), deps);

      expect(plan.nextFieldState.encrypted).toBe(true);
      expect(plan.nextFieldState.encryptionAudience).toBe('gate');
      expect(plan.clearMenus).toBe(false);
    });

    it('toggle answer on with gate audience - resolves gateId', () => {
      const plan: EncryptionTogglePlan = buildEncryptionTogglePlan(
        'q1',
        'answer',
        true,
        makeSlice(),
        makeDeps({
          resolveFieldEncryptionAudience: () => 'gate',
          resolveFieldEncryptionGateId: () => 'gate-xyz',
        }),
      );

      expect(plan.nextFieldState.encryptionGateId).toBe('gate-xyz');
    });

    it('toggle answer on - propagates to additional when additional is not explicit', () => {
      const plan: EncryptionTogglePlan = buildEncryptionTogglePlan(
        'q1',
        'answer',
        true,
        makeSlice({
          additionalComments: {
            q1: {
              value: 'note',
              encrypted: false,
              encryptionAudience: 'self',
              encryptionGateId: null,
              audienceMode: 'default',
            },
          },
        }),
        makeDeps({
          normalizeFieldAudienceMode: (value) => String(value || ''),
        }),
      );

      expect(plan.nextAdditionalState).not.toBeNull();
      expect(plan.nextAdditionalState?.audienceMode).toBe('inherited');
    });

    it('toggle answer on - does NOT propagate to additional when additional IS explicit', () => {
      const plan: EncryptionTogglePlan = buildEncryptionTogglePlan(
        'q1',
        'answer',
        true,
        makeSlice({
          additionalComments: {
            q1: {
              value: 'note',
              encrypted: true,
              encryptionAudience: 'team',
              encryptionGateId: null,
              audienceMode: 'explicit',
            },
          },
        }),
        makeDeps(),
      );

      expect(plan.nextAdditionalState).toBeNull();
    });

    it('keeps a new additional-comment field plaintext when the answer is encrypted', () => {
      const plan: EncryptionTogglePlan = buildEncryptionTogglePlan(
        'q1',
        'answer',
        true,
        makeSlice(),
        makeDeps({
          buildEmptyResponseFieldState: (_qid, fieldKey = 'answer') => ({
            value: '',
            encrypted: false,
            encryptionAudience: 'self',
            encryptionGateId: null,
            audienceMode: normalizeFieldAudienceMode('', fieldKey, {}, () => false),
          }),
          normalizeFieldAudienceMode: (value, fieldKey, field) =>
            normalizeFieldAudienceMode(value, fieldKey, field, () => false),
        }),
      );

      expect(plan.nextAdditionalState).toBeNull();
    });

    it('toggle additional on - sets encrypted true, no additional propagation', () => {
      const plan: EncryptionTogglePlan = buildEncryptionTogglePlan(
        'q1',
        'additional',
        true,
        makeSlice(),
        makeDeps({ resolveFieldEncryptionAudience: () => 'team' }),
      );

      expect(plan.nextFieldState).toMatchObject({
        encrypted: true,
        encryptionAudience: 'team',
        audienceMode: 'explicit',
      });
      expect(plan.nextAdditionalState).toBeNull();
    });

    it('toggle additional off - clearMenus true, nextAdditionalState null', () => {
      const plan: EncryptionTogglePlan = buildEncryptionTogglePlan('q1', 'additional', false, makeSlice(), makeDeps());

      expect(plan.clearMenus).toBe(true);
      expect(plan.nextAdditionalState).toBeNull();
    });
  });

  describe('buildAnswerAudienceSelectionPlan', () => {
    it('sets answer audience explicitly with gate', () => {
      const plan: AudienceSelectionPlan = buildAnswerAudienceSelectionPlan(
        'q1',
        'gate',
        'g1',
        makeSlice(),
        makeDeps({
          normalizeResponseEncryptionAudience: () => 'gate',
          resolveFieldEncryptionGateId: () => 'g1',
        }),
      );

      expect(plan.nextAnswerState).toMatchObject({
        encrypted: true,
        encryptionAudience: 'gate',
        encryptionGateId: 'g1',
        audienceMode: 'explicit',
      });
    });

    it('preserves explicit gate selection even when default normalization is stale', () => {
      const plan: AudienceSelectionPlan = buildAnswerAudienceSelectionPlan(
        'q1',
        'gate',
        'questionResponses',
        makeSlice(),
        makeDeps({
          normalizeResponseEncryptionAudience: () => 'self',
          resolveFieldEncryptionGateId: () => null,
        }),
      );

      expect(plan.nextAnswerState).toMatchObject({
        encrypted: true,
        encryptionAudience: 'gate',
        encryptionGateId: 'questionResponses',
        audienceMode: 'explicit',
      });
    });

    it('propagates to non-explicit additional', () => {
      const plan: AudienceSelectionPlan = buildAnswerAudienceSelectionPlan(
        'q1',
        'team',
        '',
        makeSlice({
          additionalComments: {
            q1: {
              value: 'note',
              encrypted: false,
              encryptionAudience: 'self',
              encryptionGateId: null,
              audienceMode: 'default',
            },
          },
        }),
        makeDeps(),
      );

      expect(plan.nextAdditionalState.audienceMode).toBe('inherited');
    });

    it('preserves explicit additional unchanged', () => {
      const plan: AudienceSelectionPlan = buildAnswerAudienceSelectionPlan(
        'q1',
        'self',
        '',
        makeSlice({
          additionalComments: {
            q1: {
              value: 'note',
              encrypted: true,
              encryptionAudience: 'team',
              encryptionGateId: null,
              audienceMode: 'explicit',
            },
          },
        }),
        makeDeps(),
      );

      expect(plan.nextAdditionalState).toMatchObject({
        encrypted: true,
        encryptionAudience: 'team',
        audienceMode: 'explicit',
      });
    });

    it('normalizes audience through deps', () => {
      const plan: AudienceSelectionPlan = buildAnswerAudienceSelectionPlan(
        'q1',
        'team',
        '',
        makeSlice(),
        makeDeps({
          normalizeResponseEncryptionAudience: () => 'self',
        }),
      );

      expect(plan.nextAnswerState.encryptionAudience).toBe('self');
    });
  });

  describe('buildAdditionalAudienceSelectionPlan', () => {
    it('inherit - builds inherited state from answer', () => {
      const plan = buildAdditionalAudienceSelectionPlan(
        'q1',
        'inherit',
        '',
        makeSlice({
          answers: {
            q1: {
              value: 'answer',
              encrypted: true,
              encryptionAudience: 'team',
              encryptionGateId: null,
              audienceMode: 'explicit',
            },
          },
        }),
        makeDeps(),
      );

      expect(plan.nextAdditionalState.audienceMode).toBe('inherited');
      expect(plan.nextAdditionalState.encryptionAudience).toBe('team');
    });

    it('follow - same as inherit', () => {
      const plan = buildAdditionalAudienceSelectionPlan(
        'q1',
        'follow',
        '',
        makeSlice({
          answers: {
            q1: {
              value: 'answer',
              encrypted: true,
              encryptionAudience: 'team',
              encryptionGateId: null,
              audienceMode: 'explicit',
            },
          },
        }),
        makeDeps(),
      );

      expect(plan.nextAdditionalState.audienceMode).toBe('inherited');
      expect(plan.nextAdditionalState.encryptionAudience).toBe('team');
    });

    it('follow-answer - same as inherit', () => {
      const plan = buildAdditionalAudienceSelectionPlan(
        'q1',
        'follow-answer',
        '',
        makeSlice({
          answers: {
            q1: {
              value: 'answer',
              encrypted: true,
              encryptionAudience: 'team',
              encryptionGateId: null,
              audienceMode: 'explicit',
            },
          },
        }),
        makeDeps(),
      );

      expect(plan.nextAdditionalState.audienceMode).toBe('inherited');
      expect(plan.nextAdditionalState.encryptionAudience).toBe('team');
    });

    it('none - sets explicit unencrypted', () => {
      const plan = buildAdditionalAudienceSelectionPlan('q1', 'none', '', makeSlice(), makeDeps());

      expect(plan.nextAdditionalState).toMatchObject({
        encrypted: false,
        encryptionAudience: 'self',
        encryptionGateId: null,
        audienceMode: 'explicit',
      });
    });

    it('plaintext - same as none', () => {
      const plan = buildAdditionalAudienceSelectionPlan('q1', 'plaintext', '', makeSlice(), makeDeps());

      expect(plan.nextAdditionalState).toMatchObject({
        encrypted: false,
        encryptionAudience: 'self',
        encryptionGateId: null,
        audienceMode: 'explicit',
      });
    });

    it('explicit audience - normalizes and sets encrypted with gate', () => {
      const plan = buildAdditionalAudienceSelectionPlan(
        'q1',
        'gate',
        'g2',
        makeSlice(),
        makeDeps({
          normalizeResponseEncryptionAudience: () => 'gate',
          resolveFieldEncryptionGateId: () => 'g2',
        }),
      );

      expect(plan.nextAdditionalState).toMatchObject({
        encrypted: true,
        encryptionAudience: 'gate',
        encryptionGateId: 'g2',
        audienceMode: 'explicit',
      });
    });
  });
});
