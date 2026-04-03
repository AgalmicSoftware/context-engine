import { buildHistoricalCompassPoints } from './DebateMap.jsx';
import treeData from '../../variables/demo/debate_map_demo_data.json';
import historicalFigureData from '../../variables/demo/historical_figures_tree_qs_and_votes.json';

jest.mock('utilities/logging.js', () => ({
  createLogger: jest.fn(() => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));
jest.mock('utilities/ui/historicalFigureAvatars.js', () => ({
  getHistoricalFigureAvatarOrBlockie: jest.fn(() => 'avatar.png'),
}));
jest.mock('../../utilities/ui/notify.js', () => ({
  notify: {
    success: jest.fn(),
    warn: jest.fn(),
  },
}));

const parseHistoricalVote = (vote) => {
  if (vote === 'up') return 1;
  if (vote === 'down') return -1;

  const parsedVote = parseInt(vote, 10);
  return Number.isNaN(parsedVote) ? null : parsedVote;
};

const getQuadrantKey = (point) => (
  `${point.y > 0.5 ? 'top' : 'bottom'}-${point.x > 0.5 ? 'right' : 'left'}`
);

const getVoteEntriesForNode = (nodeId) => (
  Object.entries(historicalFigureData || {}).reduce((entries, [username, figure]) => {
    const parsedVote = parseHistoricalVote(figure?.votes?.[nodeId]);
    if (!Number.isFinite(parsedVote)) return entries;
    return entries.concat({ username, value: parsedVote });
  }, [])
);

const getCompassNodes = (nodes, acc = []) => {
  (nodes || []).forEach((node) => {
    if (node?.compass?.xAxis && node?.compass?.yAxis) {
      acc.push(node);
    }
    getCompassNodes(node?.children || [], acc);
  });
  return acc;
};
const TARGETED_ENRICHMENT_NODE_IDS = Object.freeze([
  '0x2220000000000000000000000000000000000000000000000000000000000000',
  '0x2210000000000000000000000000000000000000000000000000000000000000',
  '0x2320000000000000000000000000000000000000000000000000000000000000',
  '0x2110000000000000000000000000000000000000000000000000000000000000',
  '0x2120000000000000000000000000000000000000000000000000000000000000',
  '0x3310000000000000000000000000000000000000000000000000000000000000',
  '0x1330000000000000000000000000000000000000000000000000000000000000',
]);

describe('DebateMap compass sampling', () => {
  it('preserves every represented simulated quadrant when sampling atlas compass figures', () => {
    getCompassNodes(treeData).forEach((node) => {
      const voteEntries = getVoteEntriesForNode(node.id);
      if (voteEntries.length === 0) return;

      const fullPoints = buildHistoricalCompassPoints(
        voteEntries,
        [],
        node.id,
        Number.MAX_SAFE_INTEGER
      );
      const sampledPoints = buildHistoricalCompassPoints(voteEntries, [], node.id);
      const fullQuadrants = new Set(fullPoints.map(getQuadrantKey));
      const sampledQuadrants = new Set(sampledPoints.map(getQuadrantKey));

      expect(sampledQuadrants).toEqual(fullQuadrants);
    });
  });

  it('keeps the most vulnerable atlas leaves meaningfully seeded after persona merges', () => {
    TARGETED_ENRICHMENT_NODE_IDS.forEach((nodeId) => {
      const voteEntries = getVoteEntriesForNode(nodeId);
      const commentCount = Object.values(historicalFigureData || {}).reduce((total, figure) => (
        total + ((figure?.comments || []).some((comment) => String(comment?.id) === nodeId) ? 1 : 0)
      ), 0);

      expect(voteEntries.length).toBeGreaterThanOrEqual(8);
      expect(commentCount).toBe(voteEntries.length);
    });
  });
});
