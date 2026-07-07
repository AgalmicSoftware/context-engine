import {
  ensureQuestionArweaveCacheBranches,
  mergeQuestionArweaveCacheBranches,
} from './questionArweaveCacheBranches';

describe('question arweave cache branches', () => {
  it('merges and preserves arweave cache branches', () => {
    const localNode = ensureQuestionArweaveCacheBranches({
      arweaveTxCache: {
        txA: { text: 'local-A', savedAtMs: 20 },
      },
      arweaveTxFailureCache: {
        txFail: {
          attempts: 1,
          firstFailedAtMs: 1,
          lastFailedAtMs: 5,
          nextRetryAtMs: 10,
          lastStatus: 404,
          state: 'transient',
          message: 'old',
        },
      },
    });
    const freshNode = {
      arweaveTxCache: {
        txB: { text: 'fresh-B', savedAtMs: 10 },
        txA: { text: 'fresh-A', savedAtMs: 15 },
      },
      arweaveTxFailureCache: {
        txFail: {
          attempts: 3,
          firstFailedAtMs: 1,
          lastFailedAtMs: 25,
          nextRetryAtMs: 50,
          lastStatus: 404,
          state: 'terminal_not_found',
          message: 'newer',
        },
      },
    };

    mergeQuestionArweaveCacheBranches(localNode, freshNode);

    expect(localNode.arweaveTxCache.txA.text).toBe('local-A');
    expect(localNode.arweaveTxCache.txB.text).toBe('fresh-B');
    expect(localNode.arweaveTxFailureCache.txFail.state).toBe('terminal_not_found');
    expect(localNode.arweaveTxFailureCache.txFail.lastFailedAtMs).toBe(25);
  });
});
