import demoPolisData from '../../variables/demo/demo_polis_data.json';
import demo2PolisData from '../../variables/demo/demo_2_polis_data.json';
import { hasDemoAnalysisFixture, hasSimulatedDemoResponses, resolveDemoPolisDataset } from './demoPolisDatasets';

const LEGACY_DEMO_SLUGS = ['demo', 'demo-1', 'demo-3', 'demo-sh'];

describe('demoPolisDatasets', () => {
  it('maps every legacy demo slug to the legacy dataset', () => {
    LEGACY_DEMO_SLUGS.forEach((slug) => {
      expect(resolveDemoPolisDataset(slug)).toBe(demoPolisData);
    });
  });

  it('keeps demo-2 as the only dataset override', () => {
    expect(resolveDemoPolisDataset('demo-2')).toBe(demo2PolisData);
    expect(resolveDemoPolisDataset('unknown-demo')).toBe(demoPolisData);

    const customFallback = { source: 'custom' };
    expect(resolveDemoPolisDataset('unknown-demo', customFallback)).toBe(customFallback);
    expect(resolveDemoPolisDataset('', customFallback)).toBe(customFallback);
  });

  it('keeps typed simulated responses exclusive to demo-2', () => {
    expect(hasSimulatedDemoResponses('demo-2')).toBe(true);
    [...LEGACY_DEMO_SLUGS, 'unknown-demo'].forEach((slug) => {
      expect(hasSimulatedDemoResponses(slug)).toBe(false);
    });
  });

  it('uses the legacy analysis fixture for legacy slugs but not demo-2', () => {
    LEGACY_DEMO_SLUGS.forEach((slug) => {
      expect(hasDemoAnalysisFixture(slug)).toBe(true);
    });
    expect(hasDemoAnalysisFixture('demo-2')).toBe(false);
    expect(hasDemoAnalysisFixture('unknown-demo')).toBe(false);
  });
});

describe('demo_2_polis_data fixture shape', () => {
  const participants = demo2PolisData.participantsVotes as Array<Record<string, unknown>>;
  const comments = demo2PolisData.comments as Array<Record<string, unknown>>;

  it('has unique participants with no synthetic duplication', () => {
    expect(participants).toHaveLength(62);
    const xids = participants.map((participant) => participant.xid);
    expect(new Set(xids).size).toBe(62);
    const addresses = participants.map((participant) => participant.participant);
    expect(new Set(addresses).size).toBe(62);
  });

  it('has three roughly balanced clusters', () => {
    const sizes = [0, 1, 2].map(
      (groupId) => participants.filter((participant) => participant.groupId === groupId).length,
    );
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(62);
    sizes.forEach((size) => {
      expect(size).toBeGreaterThanOrEqual(15);
      expect(size).toBeLessThanOrEqual(30);
    });
  });

  it('mixes question types with per-question poll options and rating scales', () => {
    const byType = (type: string) => comments.filter((comment) => comment.type === type);
    expect(comments).toHaveLength(40);
    expect(byType('binary').length).toBeGreaterThanOrEqual(20);
    expect(byType('poll').length).toBeGreaterThanOrEqual(3);
    expect(byType('rating').length).toBeGreaterThanOrEqual(4);
    expect(byType('freeform').length).toBeGreaterThanOrEqual(3);

    byType('poll').forEach((comment) => {
      expect(Array.isArray(comment.options)).toBe(true);
      expect((comment.options as unknown[]).length).toBeGreaterThanOrEqual(4);
    });
    byType('rating').forEach((comment) => {
      expect(comment.scale).toMatchObject({ min: expect.any(Number), max: expect.any(Number) });
    });
  });

  it('ships populated, version-2 cluster analysis', () => {
    expect(demo2PolisData.clusterAnalysisVersion).toBe(2);
    expect(demo2PolisData.clusterAnalysis).toHaveLength(3);
    (demo2PolisData.clusterAnalysis as Array<Record<string, unknown>>).forEach((cluster) => {
      expect(String(cluster.clusterLabel || '')).not.toBe('');
      expect((cluster.topStatements as unknown[]).length).toBeGreaterThan(0);
    });
    expect((demo2PolisData.consensusStatements as unknown[]).length).toBeGreaterThan(0);
    expect((demo2PolisData.divisiveStatements as unknown[]).length).toBeGreaterThan(0);
  });

  it('keeps vote coverage high without being complete', () => {
    const voteQuestionCount = comments.filter(
      (comment) => comment.type === 'binary' || comment.type === 'rating',
    ).length;
    const totalVotes = participants.reduce(
      (sum, participant) => sum + Object.keys((participant.votes as Record<string, unknown>) || {}).length,
      0,
    );
    const coverage = totalVotes / (participants.length * voteQuestionCount);
    expect(coverage).toBeGreaterThan(0.8);
    expect(coverage).toBeLessThan(1);
  });
});
