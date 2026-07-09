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
      sessionStorage.setItem('createSbtFormCache', JSON.stringify(legacyPayload));

      const found = hasCachedCreateSbtForm('edge');

      expect(found).toBe(true);
      expect(sessionStorage.getItem('createSbtFormCache')).toBeNull();
      expect(sessionStorage.getItem('dg:createSbtFormCache:edge')).toBe(JSON.stringify(legacyPayload));
    });

    it('detects cached tags or distribution data', () => {
      sessionStorage.setItem(
        'dg:createSbtFormCache:',
        JSON.stringify({
          sbtName: 'Alpha',
          tags: ['alpha'],
          sbtDistribution: { isLimited: true },
        }),
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

    it('drops built-in Polis demo fixture rows from live aggregators', () => {
      const networkObj = {
        questions: {
          q1: { id: 'q1', type: 'binary' },
        },
        questionResponses: {
          q1: {
            '0xFixture': JSON.stringify({
              type: 'binary',
              answer: { value: 'Agree', encrypted: false },
              source: 'demo-polis-data',
            }),
            '0xLive': JSON.stringify({
              type: 'binary',
              answer: { value: 'Agree', encrypted: false },
            }),
          },
        },
      };

      const { map } = buildAggregatorFromLocalCache(networkObj);

      expect(map.q1).toHaveLength(1);
      expect(map.q1[0]).toMatchObject({
        responder: '0xLive',
        questionId: 'q1',
      });
      expect(JSON.stringify(map)).not.toContain('0xFixture');
      expect(JSON.stringify(map)).not.toContain('demo-polis-data');
    });

    it('requires visible question metadata to belong to the route session', () => {
      const leakedResponder = '0x02a2a289d5cde3c7d7b957c7f32299ca35d53526';
      const binaryResponse = {
        type: 'binary',
        answer: { value: 'yes', encrypted: false },
      };
      const networkObj = {
        questions: {
          qLocal: { id: 'qLocal', type: 'binary', sessionSlug: 'edge' },
          qLegacyBucket: {
            id: 'qLegacyBucket',
            type: 'binary',
            sessionSlug: 'demo',
            sessionSlugExplicit: false,
          },
          qForeignImplicit: { id: 'qForeignImplicit', type: 'binary', sessionSlug: 'demo' },
          qForeignExplicit: {
            id: 'qForeignExplicit',
            type: 'binary',
            sessionSlug: 'demo',
            sessionSlugExplicit: true,
          },
          qPending: {
            id: 'qPending',
            type: 'binary',
            __ceQuestionMetadataPending: true,
          },
        },
        questionResponses: {
          qLocal: { '0xLocal': binaryResponse },
          qLegacyBucket: { '0xLegacy': binaryResponse },
          qForeignImplicit: { [leakedResponder]: binaryResponse },
          qForeignExplicit: { [leakedResponder]: binaryResponse },
          qPending: { [leakedResponder]: binaryResponse },
        },
      };

      const { map } = buildAggregatorFromLocalCache(networkObj, { sessionSlug: 'edge' });

      expect(Object.keys(map).sort()).toEqual(['qLegacyBucket', 'qLocal']);
      expect(JSON.stringify(map).toLowerCase()).not.toContain(leakedResponder);
    });

    it('rejects explicitly foreign real response bindings from the demo aggregator', () => {
      const networkObj = {
        questions: {
          qDemo: {
            id: 'qDemo',
            type: 'binary',
            sessionSlug: 'demo',
            sessionSlugExplicit: true,
          },
        },
        questionResponses: {
          qDemo: {
            '0xDemo': JSON.stringify({
              type: 'binary',
              sessionSlug: 'demo',
              answer: { value: 'Agree', encrypted: false },
            }),
            '0xLegacyDemo': JSON.stringify({
              type: 'binary',
              answer: { value: 'Unsure', encrypted: false },
            }),
            '0xForeign': JSON.stringify({
              type: 'binary',
              sessionSlug: 'test-2',
              answer: { value: 'Disagree', encrypted: false },
            }),
          },
        },
      };

      const { map } = buildAggregatorFromLocalCache(networkObj, { sessionSlug: 'demo' });

      expect(map.qDemo.map((row) => row.responder).sort()).toEqual(['0xDemo', '0xLegacyDemo']);
      expect(JSON.stringify(map)).not.toContain('0xForeign');
      expect(JSON.stringify(map)).not.toContain('test-2');
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
