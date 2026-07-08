import {
  buildCompareFallbackTree,
  sanitizeCompareTreeNode,
  sanitizeCompareTreePayload,
} from './aiClientCompareTree.js';

describe('aiClientCompareTree', () => {
  it('sanitizes compare tree payloads without widening model output', () => {
    const long = 'x'.repeat(400);
    const payload = {
      title: 'T'.repeat(140),
      nodes: Array.from({ length: 8 }, (_, index) => ({
        label: `Node ${index} ${long}`,
        evidence: [long, 'two', 'three', 'four', 'five'],
        participants: ['0xABC', { address: '0xDEF', stance: 'a'.repeat(80) }, { address: '', stance: 'ignored' }, null],
        children: [
          {
            label: 'child',
            evidence: ['child-evidence'],
            children: [
              {
                label: 'grandchild',
                evidence: ['grandchild-evidence'],
                children: [
                  {
                    label: 'depth-3',
                    evidence: ['depth-3-evidence'],
                    children: [{ label: 'trimmed', evidence: ['trimmed'] }],
                  },
                ],
              },
            ],
          },
        ],
      })),
    };

    const tree = sanitizeCompareTreePayload(payload, 'fallback');

    expect(tree?.title).toHaveLength(120);
    expect(tree?.nodes).toHaveLength(6);
    expect(tree?.nodes[0].label).toHaveLength(240);
    expect(tree?.nodes[0].evidence).toEqual([long.slice(0, 280), 'two', 'three', 'four']);
    expect(tree?.nodes[0].participants).toEqual([{ address: '0xabc' }, { address: '0xdef', stance: 'a'.repeat(32) }]);
    expect(tree?.nodes[0].children[0].children[0].children[0].children).toEqual([]);
  });

  it('rejects invalid payloads and nodes', () => {
    expect(sanitizeCompareTreePayload({ title: 'Missing nodes' }, 'fallback')).toBeNull();
    expect(sanitizeCompareTreePayload({ title: 1, nodes: [] }, 'fallback')).toBeNull();
    expect(sanitizeCompareTreeNode(null)).toBeNull();
  });

  it('builds the fallback summary tree', () => {
    expect(buildCompareFallbackTree('Why this agreement holds', 'plain text')).toEqual({
      title: 'Why this agreement holds',
      nodes: [{ label: 'Summary', evidence: ['plain text'], children: [] }],
    });
  });
});
