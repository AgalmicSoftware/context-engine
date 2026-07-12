# Methodology

AI Discourse Bench is a descriptive benchmark for comparing model positions,
uncertainty, and wording sensitivity across an AI discourse question bank. It
does not produce a single capability score or claim that one model is better
than another.

## Unit of Analysis

Each tested model is one participant. Repeated generations are nested
observations for that participant, not additional participants.

For every model and question, the harness:

1. collects repeated canonical and reversed-polarity answers;
2. maps reversed answers back to canonical polarity;
3. averages the valid observations into one model/question distribution; and
4. gives each model/question cell equal weight in question-level comparisons.

This prevents a model with more successful or repeated calls from receiving
more influence than another model.

## Response Scale

The structured response labels are `Agree`, `Unsure`, and `Disagree`. After
polarity normalization they are represented as distributions over those three
states. Invalid outputs remain visible in coverage and validity metrics but do
not become stance observations.

Canonical and reversed wording are paired to measure polarity consistency.
Reversal is a robustness probe, not a guarantee that the two statements are
perfect semantic negations. Question-bank releases therefore require human
review of every pair.

## Similarity And Groups

Model similarity is computed from the Jensen-Shannon distance between the two
models' answer distributions on questions answered by both models. Similarity
is reported only when the pair has sufficient question overlap. The report
records the overlap count and rate with every edge.

The participant graph uses classical multidimensional scaling over those
pairwise distances. Opinion groups are connected components over a documented
similarity threshold. Models without enough overlap are shown separately and
are not assigned misleading similarity positions.

## Coverage And Release Status

Every report exposes model-level question coverage, canonical/reversed pairing,
repeat completion, valid-output rate, and provider provenance. A report is a
preview unless every participant clears the configured coverage, pairing,
completion, validity, and non-fixture provider gates.

`build-report --release` refuses to write a release artifact when those gates
are not satisfied. Small smoke runs, mock runs, and mixed-completeness reports
remain useful for development, but their HTML carries a visible preview notice.
The gate also requires a question bank marked `validated`, full-bank execution,
complete run manifests, and coordinate-consistent records. The checked-in
development seed bank therefore cannot produce a release-ready report.

## Reproducibility

Run output includes a manifest containing hashes of the question bank, model
roster, prompt template, persona data when applicable, schedule seed, and
generation configuration. Each response records its deterministic run id,
prompt hash, attempt count, requested and resolved model identity, provider
request metadata, token usage when available, and latency.

Each release manifest model is matched against the model roster selected for
the report, including effective provider and generation settings. This prevents
a same-ID roster from relabeling runs produced by a different model.

The runner shuffles canonical and reversed tasks deterministically, supports
bounded concurrency and retry/backoff, and writes a durable JSONL checkpoint.
Repeating the command with `--resume` reuses completed run ids.
Only successful records whose prompt, model, provider, and generation settings
still match are reusable; failed, invalid, legacy, or configuration-mismatched
records are run again. A truncated final checkpoint line is ignored while
earlier corruption remains a hard error.

The HTML report embeds aggregate report and export data. Raw provider outputs,
attempt metadata, and rationales remain in the separate run artifact so the
published report does not silently become an answer-level data dump.

## Persona Mode

Persona mode is a source-bounded counterfactual simulation: models predict how
a named public figure might answer as of a declared evidence cutoff. It is not
ground truth about that person. Every persona definition must identify this
claim, provide an `asOf` date, and cite public sources. Unsupported positions
should resolve to `Unsure`.

## AI Analysis Boundary

Debate Map topics, compasses, narrative analysis, and Risk Matrix cells may be
generated as a second pass. They are interpretations of measured results, not
raw benchmark observations.

An analysis overlay must include the exact input report hash plus generator,
model, prompt version, and generation timestamp. The renderer rejects overlays
whose report hash or question references do not match. Without a validated
overlay, the Risk Matrix remains visibly ungenerated rather than displaying
synthetic seed content.

## Question-Bank Status

`data/question-bank.sample.json` is a development seed bank. It is not yet a
validated benchmark release. The release process for corpus provenance,
semantic deduplication, reversal review, source coverage, and held-out question
policy is intentionally tracked as deferred private planning work.
