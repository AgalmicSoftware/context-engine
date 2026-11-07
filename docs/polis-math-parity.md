# Polis-Inspired Report Math

Context Engine implements a deterministic, browser-side snapshot of the parts
of pol.is math used by its results report. It is not a drop-in copy of the
stateful pol.is worker and is not an official pol.is integration.

## Audited source baseline

The implementation was checked on 2026-08-29 against both official source
lines:

- the historical standalone
  [`pol-is/polisMath`](https://github.com/pol-is/polisMath/tree/dfe233e8c9207c2ce11e1379286ad0cf0f732067)
  snapshot at `dfe233e8c9207c2ce11e1379286ad0cf0f732067`; and
- the maintained
  [`compdemocracy/polis/math`](https://github.com/compdemocracy/polis/tree/5089c6bef9eb1a1e454beb34354fb29dd0a2b6f0/math)
  snapshot at `5089c6bef9eb1a1e454beb34354fb29dd0a2b6f0`.

The active Python cutover was reviewed as additional evidence, but unmerged
changes are not a compatibility baseline. No upstream source is vendored into
Context Engine; the local implementation uses its own vote convention
(`1 = agree`, `-1 = disagree`) and TypeScript data model.

## Supported statistical surface

| Area | Context Engine behavior |
| --- | --- |
| Missing votes | Per-statement observed-mean imputation for PCA; sparse projections ignore missing cells and scale by response coverage. |
| PCA | Two-dimensional, deterministic seeded power iteration with finite empty, all-missing, and rank-one fallbacks. |
| Conversation membership | The cold-snapshot threshold is `min(7, statement count)`, with the most active participants filling a floor of 15 when available. |
| Opinion groups | Two-tier base/group K-means, participant-weighted group centers, and silhouette selection over the pol.is K range. |
| Representative comments | The pol.is-style proportion tests, 90% threshold, best-agree fallback, and five-comment cap. |

The local cold path intentionally retains several hardenings that are better
suited to a browser snapshot: seed-42 reproducibility, true Euclidean distance,
100 effective group K-means iterations, deterministic tie order, zero-norm
guards, and a zero-padded second component for rank-one data.

## Analytical membership versus display assignment

Only participants admitted to the in-conversation set define analytical group
membership. Low-participation participants may still receive a nearest-group
display color so every plotted point is legible, but those extrapolated labels
do not affect:

- group sizes or group vote tallies;
- comparative proportions, z-tests, or representative-comment selection; or
- CommonGround cluster membership and K-anonymity checks.

Because CommonGround requires its clusters to partition every emitted
participant, export fails closed when any participant has only a display
assignment. It never promotes that extrapolated label into analytical
membership merely to satisfy K-anonymity.

## Exploratory UMAP

UMAP is an exploratory Context Engine view, not part of the official pol.is
pipeline. A skipped statement takes that statement's mean vote, so it stays
neutral instead of being read as an observed unsure vote. Rows aren't rescaled
by response coverage: that scaling corrects a linear projection, and UMAP works
from distances between participants. Reports with fewer than three participants
plot from the PCA coordinates; larger reports use seeded `umap-js` with a valid
neighbor bound.

## Deliberate scope boundaries

The browser library analyzes one current, already-visible rating matrix. It
does not reproduce the pol.is worker's prior-tick PCA vectors, persistent group
lineage, four-tick K smoothing, moderation routing, subgroups, comment
priorities, or participant archetype reports. Those features depend on durable
worker state or product schemas that the snapshot API does not receive.

Large reports are still computed synchronously in the client. Future
performance work should move deterministic computation off the main thread
with cancellation and an explicit input budget; it should not adopt the legacy
unseeded mini-batch path merely for nominal parity.

## Focused verification

From `client/`:

```bash
npm test -- --watchAll=false --runTestsByPath \
  src/utilities/survey/consensusReportMath.test.js \
  src/utilities/survey/consensusMath.test.js \
  src/utilities/survey/commongroundExport.test.js \
  src/components/PolisReport/PolisReport.cache.test.js
```
