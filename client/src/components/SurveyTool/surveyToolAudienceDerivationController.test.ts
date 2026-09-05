import {
  buildEmptyResponseFieldState,
  buildInheritedAdditionalFieldState,
  getQuestionEncryptionGates,
  normalizeFieldAudienceMode,
  normalizeGateLabelText,
  normalizeResponseEncryptionAudience,
  resolveFieldEncryptionAudience,
} from './surveyToolAudienceDerivationController';

describe('surveyToolAudienceDerivationController', () => {
  describe('getQuestionEncryptionGates', () => {
    it('returns empty array when question has no encryption', () => {
      expect(getQuestionEncryptionGates({})).toEqual([]);
    });

    it('returns empty array when encryption.enabled is false', () => {
      expect(
        getQuestionEncryptionGates({
          encryption: {
            enabled: false,
            gates: [{ id: 'g1' }],
          },
        }),
      ).toEqual([]);
    });

    it('returns gates array from encryption.gates', () => {
      expect(
        getQuestionEncryptionGates({
          encryption: {
            gates: [{ id: 'g1' }, { id: 'g2' }],
          },
        }),
      ).toHaveLength(2);
    });

    it('normalizes single gate object from encryption.gate', () => {
      expect(
        getQuestionEncryptionGates({
          encryption: {
            gate: { id: 'g1' },
          },
        }),
      ).toEqual([{ id: 'g1' }]);
    });
  });

  describe('normalizeFieldAudienceMode', () => {
    it('returns explicit for answer fieldKey', () => {
      expect(normalizeFieldAudienceMode('inherit', 'answer', {}, () => false)).toBe('explicit');
    });

    it('returns inherit for additional with inherit value', () => {
      expect(normalizeFieldAudienceMode('inherit', 'additional', {}, () => false)).toBe('inherit');
    });

    it('returns explicit for additional with persisted state', () => {
      expect(
        normalizeFieldAudienceMode(
          '',
          'additional',
          { value: 'note' },
          (v) => !!(v && typeof v === 'object' && 'value' in v && v.value),
        ),
      ).toBe('explicit');
    });

    it('returns explicit for additional with no persisted state and empty value', () => {
      expect(normalizeFieldAudienceMode('', 'additional', {}, () => false)).toBe('explicit');
    });
  });

  describe('normalizeResponseEncryptionAudience', () => {
    it('returns gate when question is locked', () => {
      const deps = {
        isQuestionLocked: () => true,
        getEffectiveRecipientsForQid: () => [],
        hasDefaultGateRecipients: () => false,
      };

      expect(normalizeResponseEncryptionAudience('self', 'q1', deps)).toBe('gate');
    });

    it('returns gate when value is gate and recipients exist for qid', () => {
      const deps = {
        isQuestionLocked: () => false,
        getEffectiveRecipientsForQid: () => ['addr1'],
        hasDefaultGateRecipients: () => false,
      };

      expect(normalizeResponseEncryptionAudience('gate', 'q1', deps)).toBe('gate');
    });

    it('returns self when value is gate but no recipients for qid', () => {
      const deps = {
        isQuestionLocked: () => false,
        getEffectiveRecipientsForQid: () => [],
        hasDefaultGateRecipients: () => false,
      };

      expect(normalizeResponseEncryptionAudience('gate', 'q1', deps)).toBe('self');
    });

    it('returns self for non-gate value', () => {
      const deps = {
        isQuestionLocked: () => false,
        getEffectiveRecipientsForQid: () => [],
        hasDefaultGateRecipients: () => false,
      };

      expect(normalizeResponseEncryptionAudience('self', null, deps)).toBe('self');
    });
  });

  describe('resolveFieldEncryptionAudience', () => {
    it('uses field.encryptionAudience when present', () => {
      const normalizeAudience = jest.fn(() => 'gate');

      const result = resolveFieldEncryptionAudience({ encryptionAudience: 'gate' }, 'q1', 'answer', {
        normalizeAudience,
        getDefaultAudienceForQid: () => 'self',
        getDefaultAudience: () => 'self',
      });

      expect(result).toBe('gate');
      expect(normalizeAudience).toHaveBeenCalledWith('gate', 'q1');
    });

    it('preserves explicit gate selections with a gate id', () => {
      const normalizeAudience = jest.fn(() => 'self');

      const result = resolveFieldEncryptionAudience(
        { encryptionAudience: 'gate', encryptionGateId: 'questionResponses' },
        'q1',
        'answer',
        {
          normalizeAudience,
          getDefaultAudienceForQid: () => 'self',
          getDefaultAudience: () => 'self',
        },
      );

      expect(result).toBe('gate');
      expect(normalizeAudience).not.toHaveBeenCalled();
    });

    it('falls back to default audience for qid when no field audience', () => {
      expect(
        resolveFieldEncryptionAudience({}, 'q1', 'answer', {
          normalizeAudience: () => 'x',
          getDefaultAudienceForQid: () => 'gate',
          getDefaultAudience: () => 'self',
        }),
      ).toBe('gate');
    });

    it('falls back to global default when no field audience and no qid', () => {
      expect(
        resolveFieldEncryptionAudience({}, null, 'answer', {
          normalizeAudience: () => 'x',
          getDefaultAudienceForQid: () => 'gate',
          getDefaultAudience: () => 'self',
        }),
      ).toBe('self');
    });
  });

  describe('buildEmptyResponseFieldState', () => {
    it('builds field with gate encryption when default is gate', () => {
      const result = buildEmptyResponseFieldState('q1', 'answer', {
        getDefaultAudienceForQid: () => 'gate',
        getDefaultAudience: () => 'self',
        resolveFieldEncryptionGateId: () => 'gate-1',
        normalizeFieldAudienceMode: () => 'explicit',
      });

      expect(result.encrypted).toBe(true);
      expect(result.encryptionAudience).toBe('gate');
      expect(result.encryptionGateId).toBe('gate-1');
    });

    it('builds field without encryption when default is self', () => {
      const result = buildEmptyResponseFieldState('q1', 'additional', {
        getDefaultAudienceForQid: () => 'self',
        getDefaultAudience: () => 'self',
        resolveFieldEncryptionGateId: () => null,
        normalizeFieldAudienceMode: (value, fieldKey, field) =>
          normalizeFieldAudienceMode(value, fieldKey, field, () => false),
      });

      expect(result.encrypted).toBe(false);
      expect(result.encryptionGateId).toBeNull();
      expect(result.audienceMode).toBe('explicit');
    });
  });

  describe('buildInheritedAdditionalFieldState', () => {
    it('inherits encryption from answer field', () => {
      const result = buildInheritedAdditionalFieldState({ value: 'note' }, { encrypted: true }, 'q1', {
        resolveFieldEncryptionAudience: () => 'gate',
        resolveFieldEncryptionGateId: () => 'gate-1',
      });

      expect(result.encrypted).toBe(true);
      expect(result.encryptionAudience).toBe('gate');
      expect(result.audienceMode).toBe('inherit');
      expect(result.value).toBe('note');
    });

    it('preserves additional field properties', () => {
      const result = buildInheritedAdditionalFieldState({ value: 'note', hash: 'abc' }, { encrypted: false }, null, {
        resolveFieldEncryptionAudience: () => 'self',
        resolveFieldEncryptionGateId: () => null,
      });

      expect(result.encrypted).toBe(false);
      expect(result.hash).toBe('abc');
      expect(result.audienceMode).toBe('inherit');
    });
  });

  describe('normalizeGateLabelText', () => {
    it('returns empty string for null/undefined', () => {
      expect(normalizeGateLabelText(null)).toBe('');
      expect(normalizeGateLabelText(undefined)).toBe('');
    });

    it('strips [object Object]', () => {
      expect(normalizeGateLabelText('[object Object]')).toBe('');
    });

    it('returns trimmed string', () => {
      expect(normalizeGateLabelText('  My Gate  ')).toBe('My Gate');
    });
  });
});
