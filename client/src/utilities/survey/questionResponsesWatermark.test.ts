import { resolvePersistedQuestionResponsesWatermark } from './questionResponsesWatermark.js';

describe('questionResponsesWatermark', () => {
  it('uses processed block when chunk writes persisted through that block', () => {
    const watermark = resolvePersistedQuestionResponsesWatermark({
      floorBlock: 99,
      processedToBlock: 120,
    });
    expect(watermark).toBe(120);
  });

  it('never drops below the floor block', () => {
    const watermark = resolvePersistedQuestionResponsesWatermark({
      floorBlock: 50,
      processedToBlock: 40,
    });
    expect(watermark).toBe(50);
  });

  it('stays at last persisted block when optimistic in-memory chunk watermark was higher', () => {
    const optimisticInMemoryWatermark = 140;
    const lastPersistedBlock = 120;
    const floorBlock = 99;

    expect(optimisticInMemoryWatermark).toBeGreaterThan(lastPersistedBlock);
    const watermark = resolvePersistedQuestionResponsesWatermark({
      floorBlock,
      processedToBlock: lastPersistedBlock,
    });
    expect(watermark).toBe(lastPersistedBlock);
  });
});
