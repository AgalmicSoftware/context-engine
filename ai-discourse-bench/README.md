# AI Discourse Bench

AI Discourse Bench maps how AI models agree, disagree, remain uncertain, and
shift under reversed wording across a broad bank of AI discourse questions.

This is a self-contained benchmark folder inside Context Engine. It uses the
OSS `ai-discourse-corpus/` as the source substrate for question generation, then
renders results in a Context Engine-style report shape. Only the `answer` and
`compare-answers` commands need the rest of the repo, for its shared answer
rules and fidelity scorer.

The benchmark is descriptive, not a model leaderboard. Each model is one
participant; repeated generations are nested measurements of that participant.
See [docs/methodology.md](docs/methodology.md) for aggregation, similarity,
coverage, release, persona, and analysis-provenance rules.

## What It Measures

- Model agreement and disagreement over AI discourse questions, starting with
  AI policy and AI futures.
- Similarity and difference between model answer profiles.
- Polarity sensitivity by asking canonical and reversed versions of each
  question.
- Trait-level breakdowns by model metadata such as parameter class, OSS status,
  country of origin, and provider class.
- Weights-only persona mode, where models predict how a named public historical
  or contemporary figure would answer using only knowledge in model weights.
- Optional quadratic importance allocation, where every model receives the same
  credit budget and pays `votes^2` to prioritize questions. These allocations
  control Debate Map prominence without changing stance results.

## Result Views

- **Publication introduction:** a persistent Context Engine: AI Opinions Benchmark
  explainer above Results identifies the OSS corpus basis, current topic, run
  counts, response mode, and repeat depth. The current selector contains the AI
  Futures & Policy track; the report contract supports additional topic-specific
  banks without changing the Results views. Preview reports are marked `noindex`.
- **Polis report:** question-level and model-level agreement/disagreement,
  including a beeswarm-style consensus/difference view.
- **Participant graph:** models as participant nodes positioned by opinion
  profile similarity, with similarity/difference edges.
- **Breakdown view:** collapsible model cohorts by traits.
- **Debate atlas:** deterministic topic circles by default, or AI-generated
  topic circles and compasses when a second-pass overlay is supplied.
- **Participants list:** the participants are the tested models, not human
  wallets or session responders.
- **Raw Results:** collapsible aggregate report, Context Engine import, and
  second-pass analysis JSON. Raw provider responses stay in the separate run
  artifact for answer-level audit and reproducibility.

## Diagrams

![AI Discourse Bench pipeline](docs/diagrams/ai-discourse-bench-pipeline.png)

![AI Discourse Bench result views](docs/diagrams/ai-discourse-bench-results-views.png)

## Quick Start

```bash
cd ai-discourse-bench
npm run smoke
```

The smoke path uses the deterministic mock provider and does not require network
or API keys. It writes ignored local artifacts under `runs/` and `results/`,
including `results/mock-self-report.html` and
`results/mock-self-ce-polis-export.json`.

The checked-in development seed bank has 200 questions across 20 topics. It is
not yet a validated benchmark release. Regenerate it
from the corpus-grounded topic packs with:

```bash
npm run generate:questions
```

The recommended runnable bank is the source-resolved, AI-audited 50-question
candidate:

```bash
npm run build:candidate-bank
npm run build:reviewed-candidate-bank
```

The second command writes
`banks/ai-futures/v0.2-reviewed-candidate/question-bank.json`, its manifest,
and an item-level audit. The bank covers all 20 topics and every question
resolves to concrete evidence in the OSS corpus. The AI-assisted audit accepted
42 wording pairs and revised 8. It remains `candidate`, not `validated`, until
two independently recorded human reviews approve claim support, reversal
quality, and single-axis status. The two reviews are defined as: (1) an
author-side review recorded without model outputs displayed or consulted, and
(2) an external reader's review conducted blind to model outputs and
independently of the author's judgment. Unresolved disagreement leaves the
item at `candidate`.

The next-generation bank is the 1000-item v0.3 candidate at
`banks/ai-futures/v0.3-candidate/question-bank.json`. It is hand-authored from
`banks/ai-futures/v0.3-candidate/authoring/*.jsonl` and rebuilt with:

```bash
npm run build:v03-candidate-bank      # writes bank, manifest, audit, review CSV, coverage report
npm run check:v03-candidate-bank      # lint + constraints only, non-zero exit on violation
```

Every v0.3 item forces a tradeoff, threshold, forecast, scenario, or
comparison; canonical direction is balanced per topic; items carry a role
(`probe`, `self-referential`, `minority`, `control-anchor`, `attention-check`)
and paraphrases under `v03`. The current harness runs it unchanged (the `v03`
fields are ignored). Design rationale, methodology changes, and the slice plan
are summarized in [the methodology](docs/methodology.md). Like v0.2, it is `candidate` until
two independent human reviews are recorded.

Before launching calls, inspect the experiment plan:

```bash
node ./bin/ai-discourse-bench.mjs plan-run \
  --questions ./banks/ai-futures/v0.2-reviewed-candidate/question-bank.json \
  --models ./data/model-roster.sample.json \
  --repeats 10
```

The plan reports exact calls, deterministic token estimates, configured
credentials/endpoints, structured-output mode, and cost when roster pricing is
available.

## Local Models

Run against an OpenAI-compatible local server:

```bash
AIDB_LOCAL_BASE_URL=http://127.0.0.1:8000/v1 \
node ./bin/ai-discourse-bench.mjs run \
  --provider local \
  --questions ./banks/ai-futures/v0.2-reviewed-candidate/question-bank.json \
  --models ./data/model-roster.sample.json \
  --out ./runs/local-self-runs.json \
  --repeats 10 \
  --concurrency 2 \
  --max-attempts 3
```

If your local server requires a key, set `AIDB_LOCAL_API_KEY`.
The runner writes a JSONL checkpoint beside the output. Re-run the same command
with `--resume` after an interruption; deterministic run ids prevent completed
model/question/polarity/repeat cells from being launched again. All resume commands
repair an incomplete final JSONL record before appending, or add a missing newline
after a complete final record. Corrupt middle lines stop resume without changing
the checkpoint.

`data/model-roster.local-environment.json` records the five local model
participants used by the checked-in development preview, including quantization
and runtime provenance but no machine paths or credentials. Use it as the
combined roster when rebuilding the five-model report.

Run the 50-question candidate bank with 10 canonical runs and 10 reversed runs
per model:

```bash
AIDB_LOCAL_BASE_URL=http://127.0.0.1:8000/v1 \
AIDB_QUESTION_BANK=./banks/ai-futures/v0.2-reviewed-candidate/question-bank.json \
AIDB_LOCAL_MODELS="llama3.1:8b|Llama 3.1 8B|8B|open-weights|US,qwen2.5:14b|Qwen 2.5 14B|14B|open-weights|China" \
npm run local:full
```

This writes:

- `runs/local-self-runs.json`
- `runs/local-self-model-roster.generated.json`
- `results/local-self-report.json`
- `results/local-self-report.html`

For two models, the default run count is `50 questions * 2 polarities * 10
repeats * 2 models = 2000` local model calls. Set `AIDB_REPEATS` only for a
short dry run; leave it unset for the benchmark default of 10.

For a fast wiring check against real local models, limit the bank:

```bash
AIDB_LIMIT_QUESTIONS=5 AIDB_REPEATS=1 AIDB_MAX_TOKENS=700 npm run local:full
```

`local:full` also accepts `AIDB_CONCURRENCY`, `AIDB_MAX_ATTEMPTS`,
`AIDB_SCHEDULE_SEED`, and `AIDB_RESUME=1`.

After aggregating a report, generate a response-based question audit with:

```bash
npm run evaluate:questions -- \
  --report ./results/environment-seed200-five-local-r10-report.json \
  --reviewed-bank ./banks/ai-futures/v0.2-reviewed-candidate/question-bank.json \
  --out ./results/environment-seed200-five-local-r10-question-evaluation.json \
  --csv ./results/environment-seed200-five-local-r10-question-evaluation.csv
```

The audit separates reliability problems (coverage, invalid responses, repeat
stability, and wording sensitivity) from useful consensus and useful
between-model disagreement. It also reports the bank-wide raw agreement gap
between canonical and reversed wording to expose directional framing or
acquiescence effects, and flags reversal pairs with unusually low content-word
overlap or risky negation scope for direct adjudication. Its recommendations
are triage inputs for human review, not automatic inclusion or exclusion
decisions. The JSON records a deterministic hash of the aggregate report and,
when `--reviewed-bank` is supplied, both outputs distinguish the AI-reviewed
candidate slice from deferred development questions. Every question remains
pending human adjudication (the two independently recorded reviews defined
above) until the bank review gate is complete.

Model roster entries may set `structuredOutput` to `auto`, `json_schema`,
`json_object`, or `none`. `auto` tries the strict answer schema and falls back
only when the endpoint returns a structured-output capability error; the
fallback is recorded in response metadata. Roster `provenance` may pin model
and weights revisions, quantization, inference engine/runtime version, source
URL, license, system prompt id, and `asOf` date. Reports preserve both declared
provenance and observed resolved provider/model/fingerprint values.

## OpenRouter

Inspect the checked-in five-model OpenRouter plan before spending credits:

```bash
npm run openrouter:audit
npm run openrouter:plan
```

The sample roster uses valid OpenRouter request ids while recording their dated
canonical revisions and per-million-token prices as of `2026-07-13`. The full
runner resolves every model to its effective OpenRouter provider once, then uses
that same roster for catalog audit, plan and execution, including entries declared
as local. It fetches OpenRouter's current model catalog before making any completion
calls and fails if a revision, price, expiration, or structured-output
capability has drifted. It also requests routes that support every submitted
parameter without provider fallback.

```bash
OPENROUTER_API_KEY=... \
npm run openrouter:full
```

`openrouter:full` defaults to the 50-question candidate bank, 10 runs per
polarity, and `data/model-roster.openrouter.sample.json`. It writes an
experiment plan, checkpoint, run artifact, report JSON, and clickable HTML.
For a low-cost wiring check, set `AIDB_LIMIT_QUESTIONS=1 AIDB_REPEATS=1`.
Use `AIDB_MODEL_ROSTER` to select another roster and `AIDB_RESUME=1` to resume.
The full runner refuses an estimated cost above `$10` by default; set
`AIDB_MAX_ESTIMATED_COST_USD` to an explicit positive ceiling for the run.

OpenRouter roster entries may include a validated `providerRouting` object with
`order`, `only`, `allow_fallbacks`, `require_parameters`, `data_collection`, and `zdr`.
The exact policy is sent as OpenRouter's `provider` request field, preserved in
run provenance, and included in resume/release compatibility checks. The
observed serving provider and resolved model are recorded from every response.
Release validation checks the transport against the manifest independently of
that upstream. An `only` list restricts serving providers; `order` does too when
`allow_fallbacks` is false. Provider comparison lowercases names and replaces
spaces or underscores with hyphens, while recorded metadata stays unchanged.
Unrestricted routing accepts any upstream, but one model must still resolve to
one deployment identity across its runs.

## Persona Mode

```bash
node ./bin/ai-discourse-bench.mjs run \
  --provider mock \
  --mode persona \
  --persona ada-lovelace \
  --questions ./data/question-bank.sample.json \
  --models ./data/model-roster.sample.json \
  --personas ./data/personas.sample.json \
  --out ./runs/mock-ada-runs.json \
  --repeats 1
```

Persona mode is a weights-only interpretation for public historical or
contemporary figures. The prompt includes the figure's name and the same generic
prediction instructions for every persona, with no evidence packet, custom
profile instruction, source list, or cutoff date. This isolates differences in
what models already encode and how they interpret the named figure. It is not
ground truth about that person, and the benchmark should not include
private-person profiles or identifying participant data.

Run the OpenRouter roster through a historical-persona lens:

```bash
OPENROUTER_API_KEY=... \
AIDB_MODE=persona \
AIDB_PERSONA=norbert-wiener \
npm run openrouter:full
```

Self and persona runs produce separate reports. This prevents a simulated
figure from being confused with a model's own stated profile while allowing
the same models and questions to be compared across lenses with longitudinal
or downstream analysis tools. A separate source-grounded calibration track is
deferred; it should use a distinct mode and must not be mixed with weights-only
persona results.

## Quadratic Importance Mode

Importance is a complementary pass over the question bank, not another stance
label. Each model receives a fixed credit budget and assigns positive integer
votes to selected questions. A question receiving `v` votes costs `v^2`
credits, so concentrated priority is deliberately expensive.

```bash
node ./bin/ai-discourse-bench.mjs run-importance \
  --provider local \
  --questions ./banks/ai-futures/v0.2-reviewed-candidate/question-bank.json \
  --models ./data/model-roster.sample.json \
  --out ./runs/local-importance-runs.json \
  --budget 100 \
  --max-allocations 10 \
  --repeats 1
```

The command supports `mock`, `local`, and `openrouter`, plus the same
checkpoint, retry, concurrency, and `--resume` behavior as stance runs. One
allocation covers the whole bank, so its repeat count is configured separately
from the canonical/reversed stance depth. Repeats are averaged within each
model first; models then receive equal weight in question and topic importance.
Each model and allocation repeat receives a deterministic hash-shuffled question
order, recorded in provenance, so fixed bank order does not systematically favor
early questions.
Allocations are sparse by default: a model may prioritize at most 10 questions.
The per-question vote maximum is derived from the budget and allocation cap
(`3` votes for the default 100-credit/10-question method), so every
schema-valid allocation is guaranteed to remain within the quadratic budget.
At defaults, ten maximum ratings cost only `10 × 3² = 90` of 100 credits:
the budget does not bind. This is a capped top-ten rating task, not an
unconstrained quadratic allocation. Historical measurement names, instruction
versions, and results remain unchanged; any redesigned instrument needs its own
measurement version.
Use `--max-allocations` to change that cap for a separately identified run.

## Answer Any Question Set

`answer` asks every model in a roster every question of a Context Engine
session, whatever its type: agree/disagree, rating, single and multiple choice,
quadratic allocation and freeform. It writes one row per reply, with the answer
in the form people's answers are stored in, so models can be compared with
people.

```bash
node ./bin/ai-discourse-bench.mjs answer \
  --provider openrouter \
  --questions ./results.json \
  --models ./data/model-roster.openrouter.sample.json \
  --out ./runs/session-answers.json \
  --repeats 3
```

`--questions` takes the Results screen's **JSON: Questions + Responses**
download, a plain list of questions, or this benchmark's own bank. Questions
whose text the export couldn't read (shown as `[encrypted]`) are skipped, but a
gated question you could read is asked like any other: its text goes to the
model provider, so remove it from the file first if it shouldn't. Older `poll`
questions are asked as single choices, as the web client shows them. Answers
are checked with the same rules as people's and MCP agents'
(`shared/questions/answerValue.mjs`); a reply that fails them is asked again,
then kept as unanswered with the reason.

Each question is asked in the ways that expose wording and ordering effects:

- agree/disagree statements also in their reversed wording, when the set has
  one (this benchmark's bank does; session questions don't);
- ratings with labelled ends also with the scale flipped, mapped back to the
  question's own scale;
- choice and allocation questions with a fresh option order on every repeat,
  recorded in each row, with allocations mapped back to the question's order.

Rating prompts retain their original whole-number wording when the minimum is an
integer and the step is 1. Other grids state the step and origin explicitly.

The command has the same retry, concurrency, checkpoint and `--resume`
behavior as stance runs; `--seed` fixes the option orders.

## Compare Models With People

`compare-answers` reads an `answer` file and the same session's Results export,
then reports how close each model is to everyone and to each group of people,
and for each question the statistics suited to its type.

```bash
node ./bin/ai-discourse-bench.mjs compare-answers \
  --answers ./runs/session-answers.json \
  --people ./results.json \
  --out ./results/session-comparison
```

It writes `answer-comparison.json` and `answer-comparison.md`. People are
grouped by `--groups` (a JSON object from address to group id or ids) or else by
the link they arrived through, and self-declared agents are left out. A group
is withheld when it has fewer than `--min-people` people (default 5), or when
subtracting it from everyone, or from the other groups, would leave fewer;
each question is checked again with the people who answered it, and a question
with fewer is withheld for everyone. Each model counts as one respondent: its replies are
summarized as its most common answer (an even split between agreeing and
disagreeing counts as Unsure), the options it picked in at least half its
replies, its median rating, or its mean allocation.

| Type | One model against a group | Models against a group |
| --- | --- | --- |
| Agree / Unsure / Disagree | Share of the group giving the same answer | Difference in % agree with a Newcombe interval; earth mover's distance on the three-point scale |
| Single choice | Share choosing the same option | Total variation and Jensen–Shannon distances |
| Multiple choice | Mean Jaccard similarity to people's sets | Per-option inclusion-rate differences with Newcombe intervals |
| Rating | Percentile within the group; distance from its median | Earth mover's distance; median difference with a bootstrap interval |
| Quadratic | Cosine to the group's mean allocation | Per-option mean vote differences with bootstrap intervals; top-option shares |
| Freeform | Not compared yet: it needs theme coding by a judge model against a human-checked codebook | |

Every comparison also gives the mean similarity (0 to 1) of the model's answer
to each person's, using the agent fidelity report's per-type measure
(`shared/agentFidelity.mjs`); the headline table averages it over questions.

## Generate a Report

```bash
node ./bin/ai-discourse-bench.mjs build-report \
  --questions ./data/question-bank.sample.json \
  --models ./data/model-roster.sample.json \
  --runs ./runs/mock-self-runs.json \
  --importance ./runs/mock-importance-runs.json \
  --out ./results/mock-self-report.json
```

`--importance` is optional and accepts comma-separated model-specific
artifacts. When present, Debate Map circle size and its `Most important` sort
use the aggregated allocations. Without it, circle size falls back to the
number of questions in each topic.

Add `--release` only for a publishable artifact. The command then fails unless
every model clears the coverage, polarity-pairing, repeat-completion,
valid-output, non-fixture-provider, validated-bank, and run-manifest gates.
Reports built without the flag remain usable previews and display integrity
warnings in the HTML. The checked-in development seed bank is intentionally
preview-only until the deferred bank-validation work is complete.

### Publish To The Context Engine Route

The Context Engine client serves benchmark artifacts at `/benchmarks`. Publish
a built report into the client artifact directory with:

```bash
npm run publish:static -- \
  --html ./results/local-self-report.html \
  --report ./results/local-self-report.json \
  --out-dir ../client/public/benchmark-artifacts \
  --id ai-futures-policy-v0-1 \
  --title "AI Futures & Policy" \
  --topic "AI Futures & Policy"
```

When rendering with `render-report --analysis`, pass the same `--analysis` file
to `publish:static`. Publication validates its source-report fingerprint and
compares the supplied HTML with a rendering of that same report and overlay.
Altered HTML and mismatched overlays are refused.

This writes a deterministic gzip artifact and updates the route manifest. A
preview report remains visibly marked and unindexed, including a release-ready
report built without `build-report --release`. Only a valid release validation
receipt makes a report a release. Publishing that report requires `--release`
confirmation; the flag is refused for previews. Renderer, publisher and verifier
use that same receipt-bound status. Released artifacts are indexed, omit the
preview notice, and bind the manifest release hash to the embedded original
report. Preview manifest entries retain the `development-preview` label.
API keys and raw provider responses are never part of the route artifact.

Build one report from multiple separately-run local/OpenRouter model artifacts:

```bash
node ./bin/ai-discourse-bench.mjs build-report \
  --questions ./data/question-bank.sample.json \
  --models ./runs/qwen-model-roster.generated.json,./runs/nemotron-model-roster.generated.json \
  --runs ./runs/qwen-runs.json,./runs/nemotron-runs.json \
  --out ./results/local-smoke-combined-report.json
```

Use this when local models must be launched one at a time. The merged report
uses the combined model rosters as the participant set and preserves missing or
invalid model/question cells as report data.

`--limit-questions` is only for deliberately small smoke reports. Omit it for a
full-bank report with all 200 sample questions. A report can contain all 200
questions even when a local smoke run only answered a subset; unanswered cells
remain visible as no-data cells so sparse model runs are not confused with
missing questions.

Render the report as standalone HTML:

```bash
node ./bin/ai-discourse-bench.mjs render-report \
  --report ./results/mock-self-report.json \
  --out ./results/mock-self-report.html
```

Export the same report in Context Engine `PolisReport` input shape:

```bash
node ./bin/ai-discourse-bench.mjs export-ce \
  --report ./results/mock-self-report.json \
  --out ./results/mock-self-ce-polis-export.json
```

The compatibility CE export treats each model as a participant/responder. Each model/question
cell uses the averaged benchmark score and discretizes it back to
`Agree` / `Unsure` / `Disagree`, while preserving the source run counts and
mean score in response metadata. It is intentionally lossy.

For native integration, use the distribution-preserving benchmark contract:

```bash
node ./bin/ai-discourse-bench.mjs export-ce-native \
  --report ./results/mock-self-report.json \
  --out ./results/mock-self-ce-native.json
```

`ce_benchmark_results_dataset` preserves repeated-answer distributions,
uncertainty intervals, wording sensitivity, similarity details, model
provenance, graph inputs, quadratic importance, Debate Map inputs, and integrity state. Its schema is
`schemas/ce-benchmark-results-v1.schema.json`; this is the preferred substrate
for eventual native Context Engine rendering.

Track model changes over time with content-addressed snapshots:

```bash
node ./bin/ai-discourse-bench.mjs snapshot-report \
  --report ./results/baseline-report.json \
  --out ./results/baseline-snapshot.json \
  --label 2026-07

node ./bin/ai-discourse-bench.mjs compare-snapshots \
  --baseline ./results/baseline-snapshot.json \
  --current ./results/current-snapshot.json \
  --out ./results/model-drift.json
```

Comparisons report per-model stance shifts, direction changes, and pairwise
similarity drift on common models and questions. Each model pair recomputes both
similarities from questions present in both snapshots with usable distributions
for both models at both times. The pair lists those question IDs and their count;
new questions or newly available observations cannot change its comparison.
Pairs covering fewer than half of the questions common to the two snapshots
(rounded up, at least one) are unavailable and excluded from the summary.

For second-pass AI analysis, export a compact analysis input:

```bash
node ./bin/ai-discourse-bench.mjs export-analysis-input \
  --report ./results/mock-self-report.json \
  --out ./results/mock-self-ai-analysis-input.json
```

Feed that JSON plus `prompts/analysis-overlay-generator.md` to an analysis model
to produce an `ai_discourse_bench_analysis_overlay`. Re-render with the overlay
when you want generated risk-matrix popups, higher-level AI analysis, generated
Debate Map topics, issue-area modal analysis, edges, or compasses:

```bash
node ./bin/ai-discourse-bench.mjs render-report \
  --report ./results/mock-self-report.json \
  --analysis ./results/mock-self-analysis-overlay.json \
  --out ./results/mock-self-report.html
```

## Reviewing Benchmark Output

The rendered report is a review aid, not a substitute for question
adjudication:

- Each model contributes one averaged answer per question; repeated calls inform
  stability and wording-sensitivity measures.
- Raw Results retains the aggregate report, Context Engine export, and
  provenance needed to audit a finding.
- Optional AI-generated summaries, Debate Map topics, and Risk Matrix content
  are accepted only when their overlay is bound to the exact source-report
  hash.

See [docs/methodology.md](docs/methodology.md) for interpretation and release
rules. See [docs/results-sync.md](docs/results-sync.md) for report-rendering and
live-client synchronization details.

## Question Bank Prompt

The coding-model handoff prompt lives at:

```text
prompts/question-bank-generator.md
```

It asks a repository-aware model to derive and rank exactly 500 source-resolved
candidate questions from the OSS AI discourse corpus. The prompt reserves
substantial coverage for norms governing human use of AI agents, requires
canonical and reversed wording, and produces provenance, coverage, rejection,
and human-review artifacts without treating generation as validation.

The second-pass analysis overlay prompt lives at:

```text
prompts/analysis-overlay-generator.md
```

It asks an analysis model to return compact JSON for risk-matrix popups,
generated Debate Map topics, modal-ready issue areas, topic edges, compasses,
and report-level analysis.

## Keeping Results Styling In Sync

Run `npm run check:results-sync` when Context Engine's live Results components
change. The repository skill `$ai-discourse-bench-results-sync` guides the
semantic port, tests, and screenshot checks before
`npm run sync:results-snapshot` accepts a new source baseline. See
[docs/results-sync.md](docs/results-sync.md). Direct shared component imports
are the intended replacement once the package and client boundaries are merged.

With the repository's Playwright and Chromium installed, run
`npm run check:report-browser -- --out-dir /tmp/benchmark-browser` to verify
desktop, mobile, and narrow-mobile marker geometry, keyboard/hover tooltips,
group controls, and unavailable-data views. Screenshots and a JSON check report
are saved there. Pass `--report /absolute/path/report.json` to also inspect a
saved report; the missing-data fixtures always run. Font downloads are disabled
in this offline check.

### Observed answers and mean stances

Reports with `polisReport.responseDistributionVersion: 1` preserve each valid
model/question cell's full Agree / Unsure / Disagree distribution. Question,
cohort, and opinion-group summaries average those normalized distributions with
one weight per contributing model. Model summaries give each answered question
one weight. Repeats and failed attempts cannot increase a model's weight; cells
with no valid answers contribute to missing/invalid coverage instead. The
standalone report uses the same aggregation function for initial views and
interactive cohort filters.

`observedDistribution.probabilities` contains the three observed shares;
`observedDistribution.counts` contains fractional model (or question) equivalents,
whose sum is `validUnits`. `totalUnits` includes cells without a valid answer.
`runSummary` retains actual valid, invalid, and attempted run counts separately.
Thus a model that answers Agree and Disagree equally has zero observed Unsure,
while a model that always answers Unsure has an observed Unsure share of one,
even though both have mean stance zero. The observed-share histogram is separate
from each model's explicitly labeled -1 to +1 mean-stance axis. Nearby markers
use separate vertical lanes without moving their means. Marker tooltips and
keyboard focus expose observed shares; majority-Unsure observations are labeled
"Mostly Unsure", and all-Unsure observations remain "Unsure". A central mean
without majority uncertainty is labeled "Mixed (mean stance)". Displayed model
equivalents are rounded to at most four decimal places; stored values and raw
trial counts are unchanged. Within-polarity repeat consistency and wording
sensitivity calculations are unchanged.

This is a semantic revision within report schema v2 and native dataset v1,
identified by `responseDistributionVersion: 1`; it is not wholly additive.
Existing report/analysis aggregate `counts` and report `responseEntropy` retain their discretized mean
stance semantics for compatibility; `countsUnit: 'discretized-mean-stances'` and
`meanStance` make that interpretation explicit. Aggregate `uncertaintyRate` now
means the equal-weight observed Unsure share among valid cells, as declared by
`polisReport.uncertaintyRateSemantics`. Use the version/semantics fields when
comparing new summaries with older saved reports. Rebuild reports from their run
artifacts for full reproducibility. A schema-v2 preview with complete saved
model/question and polarity counts can instead receive this narrow correction:

```bash
node scripts/correct-saved-report-distributions.mjs old-report.json corrected-report.json
node bin/ai-discourse-bench.mjs render-report --report corrected-report.json --out corrected-report.html
```

The correction verifies legacy means against both the count-derived mean and
its original calculation from rounded cell means. It retains the stored mean
and interval; it does not widen the tolerance for arbitrary inconsistent values.

The correction preserves original cells, run summaries, intervals, source hashes,
model metadata, and preview status. It records the source report digest and the
correction method in `summaryCorrection` and displays a notice that the original
runs were not rerun or revalidated. Incomplete counts, changed means, analysis
overlays, and release receipts require separate regeneration; the correction
does not fabricate individual responses or rebind old analysis. No stored report
is rewritten implicitly. The compatibility CE export still discretizes a mean into one answer;
its `answerSemantics` flag and `averagedFrom.observedDistribution` distinguish that
lossy answer from observed uncertainty. The analysis input includes observed
shares, valid model counts, raw run counts, and the separate mean stance.

When rendering an older report, visible distributions are derived from its
retained model/question histograms, including interactive cohort and tag views.
An omitted question in an existing model row denotes no attempts; a missing row
or a present cell with incomplete counts makes that distribution unavailable.
The legacy notice explains this read-only view. Original aggregates and cell
evidence remain in Raw Results; legacy mean-stance buckets are never presented
as observed Unsure.

Native, compatibility, analysis-input, and longitudinal exports carry
`summaryCorrection`. The analysis fingerprint includes that provenance whenever
it is present. Uncorrected reports retain the historical fingerprint algorithm;
older fingerprints for corrected reports must not be accepted or rebound.
Regenerate the analysis input and its overlay against the corrected report.
Rendering a corrected report also rejects an attached overlay with an obsolete
fingerprint. The HTML analysis-input download stays bound to the original saved
report, even when display normalization withholds legacy opinion groups. Attach
its overlay to that original JSON; the normalized embedded Snapshot JSON is a
derived display artifact and can have a different fingerprint.
Release-content hashing already includes the correction record and is unchanged.

Participant embedding and automatic or manual opinion groups require at least
two eligible participants and measured similarity for every eligible pair.
`participantGraph.opinionGroupAvailability` discloses this shared rule. Missing
pairs withhold group labels in report JSON and native exports, including exports
of older reports, and withhold the HTML graph and group controls. A connected
overlap graph with a missing pair is also insufficient: a path through a third
participant does not supply a measured distance. Measured edges and raw
distributions remain available. Remaining groups are exploratory descriptions
of this sample, with no established stability claim. Missing similarity is never
filled with maximal disagreement.

Report grouping treats roster trait names and values as data, including names
such as `constructor` and `__proto__`. Grouped JSON retains them as own properties;
the same key handling applies to interactive trait filters and model dictionaries.

Model answer parsing removes inline `<think>` and `<analysis>` reasoning regions
before recovering final JSON. Conflicting final answers or truncated JSON/reasoning
are parse errors, so the runner retries them within its configured attempt budget.
