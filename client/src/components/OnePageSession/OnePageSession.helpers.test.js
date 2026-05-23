import {
  buildAggregatorFromLocalCache,
  computeAggregatorSourceSnapshotSignature,
  hasCachedCreateSbtForm,
} from './OnePageSession';

describe('OnePageSession helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe('hasCachedCreateSbtForm', () => {
    it('returns false when no cache exists', () => {
      expect(hasCachedCreateSbtForm('edge')).toBe(false);
    });

    it('migrates legacy cache to the group-aware key', () => {
      const legacyPayload = {
        sbtName: 'Alpha',
        sbtDescription: 'Legacy draft details',
      };
      sessionStorage.setItem(
        'createSbtFormCache',
        JSON.stringify(legacyPayload)
      );

      const found = hasCachedCreateSbtForm('edge');

      expect(found).toBe(true);
      expect(sessionStorage.getItem('createSbtFormCache')).toBeNull();
      expect(sessionStorage.getItem('dg:createSbtFormCache:edge')).toBe(
        JSON.stringify(legacyPayload)
      );
    });

    it('detects cached tags or distribution data', () => {
      sessionStorage.setItem(
        'dg:createSbtFormCache:',
        JSON.stringify({
          sbtName: 'Alpha',
          tags: ['alpha'],
          sbtDistribution: { isLimited: true },
        })
      );

      expect(hasCachedCreateSbtForm()).toBe(true);
    });
  });

  describe('buildAggregatorFromLocalCache', () => {
    it('filters to binary, non-encrypted responses and drops invalid entries', () => {
      const networkObj = {
        questions: {
          q1: { id: 'q1', type: 'binary' },
          q2: { id: 'q2', type: 'binary' },
        },
        questionResponses: {
          q1: {
            '0xA': JSON.stringify({
              type: 'binary',
              answer: { value: 'yes' },
            }),
            '0xB': JSON.stringify({
              type: 'rating',
              answer: { value: 5 },
            }),
          },
          q2: {
            '0xC': '{bad json',
            '0xD': JSON.stringify({
              type: 'binary',
              answer: { value: '*' },
            }),
            '0xE': JSON.stringify({
              type: 'binary',
              answer: { encrypted: true },
            }),
          },
        },
      };

      const { map, dirty } = buildAggregatorFromLocalCache(networkObj);

      expect(dirty).toBe(true);
      expect(map.q1).toHaveLength(1);
      expect(map.q1[0]).toMatchObject({
        responder: '0xA',
        questionId: 'q1',
      });
      expect(map.q2).toHaveLength(0);
      expect(networkObj.questionResponses.q2['0xC']).toBeUndefined();
    });

    it('reuses parse memo across repeated aggregator builds', () => {
      const networkObj = {
        questions: {
          q1: { id: 'q1', type: 'binary' },
        },
        questionResponses: {
          q1: {
            '0xA': JSON.stringify({
              type: 'binary',
              answer: { value: 'yes' },
            }),
          },
        },
      };
      const parseMemo = new Map();
      const parseSpy = jest.spyOn(JSON, 'parse');
      try {
        buildAggregatorFromLocalCache(networkObj, { parseMemo });
        buildAggregatorFromLocalCache(networkObj, { parseMemo });

        expect(parseSpy).toHaveBeenCalledTimes(1);
      } finally {
        parseSpy.mockRestore();
      }
    });

    it('preserves raw string payload formatting for accepted binary responses', () => {
      const rawBinaryPayload = '{"type":"binary","answer":{"value":"yes"},"meta":{"order":[3,2,1]}}';
      const networkObj = {
        questions: {
          q1: { id: 'q1', type: 'binary' },
        },
        questionResponses: {
          q1: {
            '0xA': rawBinaryPayload,
          },
        },
      };

      const { map } = buildAggregatorFromLocalCache(networkObj);

      expect(map.q1).toHaveLength(1);
      expect(map.q1[0].response).toBe(rawBinaryPayload);
    });
  });

  describe('computeAggregatorSourceSnapshotSignature', () => {
    it('changes when rating fields mutate on object-form responses', () => {
      const questionResponses = {
        q1: {
          '0xA': {
            type: 'binary',
            answer: { value: 'Agree', encrypted: false },
            conviction: 3,
          },
        },
      };

      const first = computeAggregatorSourceSnapshotSignature(questionResponses);
      questionResponses.q1['0xA'].conviction = 9;
      const second = computeAggregatorSourceSnapshotSignature(questionResponses);

      expect(second).not.toBe(first);
    });
  });
});
