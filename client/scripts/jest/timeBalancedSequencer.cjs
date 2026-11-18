const fs = require('fs');
const path = require('path');
const Sequencer = require('@jest/test-sequencer').default;
const { partitionByRecordedTime } = require('./shardPartition.cjs');

const TIMINGS_PATH = path.join(__dirname, 'shardTimings.json');

function relativeTestPath(test) {
  return path.relative(test.context.config.rootDir, test.path).split(path.sep).join('/');
}

/** Replaces Jest's even-count --shard split with one balanced by recorded run time. */
class TimeBalancedSequencer extends Sequencer {
  shard(tests, { shardIndex, shardCount }) {
    const timings = JSON.parse(fs.readFileSync(TIMINGS_PATH, 'utf8'));
    const byPath = new Map(tests.map((test) => [relativeTestPath(test), test]));
    const assigned = partitionByRecordedTime([...byPath.keys()], shardCount, timings)[shardIndex - 1];

    // The run that merges the shards checks this record: every file Jest found
    // must have been run by exactly one shard.
    const manifestPath = process.env.CE_JEST_SHARD_MANIFEST;
    if (manifestPath) {
      fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
      fs.writeFileSync(manifestPath, `${JSON.stringify({
        shardIndex,
        shardCount,
        universe: [...byPath.keys()].sort(),
        assigned,
      })}\n`);
    }
    return assigned.map((relativePath) => byPath.get(relativePath));
  }
}

module.exports = TimeBalancedSequencer;
