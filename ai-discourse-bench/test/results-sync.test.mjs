import assert from "node:assert/strict";
import test from "node:test";

import { compareResultsSyncSnapshot } from "../src/results-sync.mjs";
import { sha256 } from "../src/provenance.mjs";

test("Results sync comparison reports changed and newly-added source files", () => {
  const drift = compareResultsSyncSnapshot(
    { files: { "a.scss": "old" } },
    { files: { "a.scss": "new", "b.tsx": "hash" } },
  );
  assert.deepEqual(
    drift.map((entry) => entry.path),
    ["a.scss", "b.tsx"],
  );
});

test("byte hashing preserves distinct non-UTF8 buffers", () => {
  assert.notEqual(sha256(Buffer.from([0xff])), sha256(Buffer.from([0xfe])));
});
