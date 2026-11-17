/**
 * Splits test files into shards of about equal run time. A few suites take a
 * minute each and most take a fraction of a second, so an even split by count
 * (Jest's default) leaves one shard twice as long as the rest.
 *
 * The split depends only on the set of files and the recorded times, so every
 * shard of one run, on any machine, computes the same partition: each file
 * lands in exactly one shard.
 */
function partitionByRecordedTime(relativePaths, shardCount, timings) {
  const seconds = (relativePath) => Number(timings.suites?.[relativePath]) || Number(timings.defaultSeconds) || 1;
  const shards = Array.from({ length: shardCount }, () => ({ load: 0, files: [] }));
  const heaviestFirst = [...relativePaths].sort((left, right) => (
    seconds(right) - seconds(left) || (left < right ? -1 : 1)
  ));
  for (const relativePath of heaviestFirst) {
    const lightest = shards.reduce((best, shard) => (shard.load < best.load ? shard : best));
    lightest.load += seconds(relativePath);
    lightest.files.push(relativePath);
  }
  return shards.map((shard) => shard.files.sort());
}

module.exports = { partitionByRecordedTime };
