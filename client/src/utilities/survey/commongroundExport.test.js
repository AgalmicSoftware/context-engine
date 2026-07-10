import fs from 'fs';
import path from 'path';

import demoPolisData from '../../variables/demo/demo_polis_data.json';
import {
  buildCommonGroundSnapshotFromDemoDataset,
  normalizeCommonGroundVote,
} from './commongroundExport';

const SNAPSHOT_DIR = path.resolve(__dirname, '../../../../artifacts/commonground/snapshots');
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, 'eval_ce_demo.jsonl');

describe('CommonGround deliberation snapshot export', () => {
  it('normalizes binary votes like the CommunityTab demo beeswarm path', () => {
    expect(normalizeCommonGroundVote(1)).toBe(1);
    expect(normalizeCommonGroundVote('agree')).toBe(1);
    expect(normalizeCommonGroundVote(true)).toBe(1);
    expect(normalizeCommonGroundVote(-1)).toBe(-1);
    expect(normalizeCommonGroundVote('no')).toBe(-1);
    expect(normalizeCommonGroundVote(false)).toBe(-1);
    expect(normalizeCommonGroundVote(0)).toBe(0);
    expect(normalizeCommonGroundVote('neutral')).toBe(0);
    expect(normalizeCommonGroundVote(undefined)).toBeNull();
    expect(normalizeCommonGroundVote('not-a-vote')).toBeNull();
  });

  it('builds the canonical demo snapshot and optionally writes JSONL', () => {
    const snapshot = buildCommonGroundSnapshotFromDemoDataset(demoPolisData, {
      sessionId: 'ce-demo',
      seed: 42,
      kAnonymity: 5,
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot).toEqual(
      expect.objectContaining({
        session_id: 'ce-demo',
        masked_cells: [],
        held_out: {},
        meta: {
          k_anonymity: 5,
          source: 'ce-demo',
          synthetic: false,
          seed: 42,
        },
      }),
    );
    expect(snapshot.statements.length).toBeGreaterThan(0);
    expect(snapshot.participants).toEqual(snapshot.participants.map((_, index) => `p${String(index).padStart(3, '0')}`));
    expect(snapshot.votes).toHaveLength(snapshot.participants.length);
    expect(snapshot.votes.every((participantVotes) => participantVotes.length === snapshot.statements.length)).toBe(true);
    expect(snapshot.votes[0][5]).toBe(demoPolisData.participantsVotes[0].votes['5']);
    expect(snapshot.stats.comment).toHaveLength(snapshot.statements.length);
    expect(snapshot.clusters.length).toBeGreaterThan(0);
    expect(snapshot.clusters.every((cluster) => cluster.members.length >= 5)).toBe(true);

    if (process.env.GENERATE_COMMONGROUND_EXPORT === '1') {
      fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
      fs.writeFileSync(SNAPSHOT_FILE, `${JSON.stringify(snapshot)}\n`, 'utf8');
    }
  });

  it('drops statements with redacted text and strips unsafe source ids from output', () => {
    const dataset = {
      comments: [
        {
          type: 'binary',
          commentId: 'unsafe-address-id',
          commentBody: 'Address 0x1234567890123456789012345678901234567890 should not export',
        },
        {
          type: 'binary',
          commentId: 'safe-id',
          commentBody: 'Email test person@example.com should not export',
        },
        {
          type: 'binary',
          commentId: 'safe-statement-id',
          commentBody: 'Safe statement text',
        },
      ],
      participantsVotes: Array.from({ length: 8 }, (_, index) => ({
        votes: {
          0: index < 4 ? 1 : -1,
          1: 1,
          2: 1,
        },
      })),
    };

    const snapshot = buildCommonGroundSnapshotFromDemoDataset(dataset, {
      sessionId: 'redaction-test',
      seed: 42,
      kAnonymity: 1,
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot.statements).toEqual([{ index: 0, text: 'Safe statement text' }]);
    expect(snapshot.statements.map((statement) => Object.keys(statement).sort())).toEqual([['index', 'text']]);
    expect(snapshot.statements[0]).not.toHaveProperty('id');
    expect(JSON.stringify(snapshot)).not.toMatch(/person@example\.com/);
    expect(JSON.stringify(snapshot)).not.toMatch(/0x1234567890123456789012345678901234567890/);
  });

  it('drops snapshots when any cluster violates the k-anonymity floor', () => {
    const dataset = {
      comments: [
        { type: 'binary', commentBody: 'First statement' },
        { type: 'binary', commentBody: 'Second statement' },
        { type: 'binary', commentBody: 'Third statement' },
        { type: 'binary', commentBody: 'Fourth statement' },
      ],
      participantsVotes: [
        { votes: { 0: 1, 1: 1, 2: -1, 3: -1 } },
        { votes: { 0: 1, 1: 1, 2: -1, 3: -1 } },
        { votes: { 0: -1, 1: -1, 2: 1, 3: 1 } },
        { votes: { 0: -1, 1: -1, 2: 1, 3: 1 } },
      ],
    };

    expect(
      buildCommonGroundSnapshotFromDemoDataset(dataset, {
        sessionId: 'small-k-test',
        seed: 42,
        kAnonymity: 5,
      }),
    ).toBeNull();
  });
});
