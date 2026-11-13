# AI Discourse Bench Architecture

AI Discourse Bench is a self-contained benchmark folder inside the Context
Engine repo. It keeps its runner, report contract, sample data, prompts, docs,
and generated diagrams together under `ai-discourse-bench/`.

## Pipeline

1. **Question bank generation**
   - Give `prompts/question-bank-generator.md` to a repository-aware coding
     model. It uses context-safe corpus extraction to produce a source-resolved
     500-question candidate plus generation, rejection, coverage, and human-
     review artifacts.
   - Review and adjudicate generated candidates before promoting a versioned
     question bank from `candidate` to `validated`.
   - Each question has canonical and reversed-polarity wording.
   - `build:candidate-bank` creates a 50-question source-resolved candidate and
     manifest while preserving human review as a release gate.

2. **Model roster**
   - `data/model-roster.sample.json` shows the model metadata shape.
   - Traits such as `parameterClass`, `ossStatus`, `countryOfOrigin`, and
     `providerClass` are used by the breakdown view.
   - Optional provenance, structured-output, and pricing fields feed run
     manifests, observed-runtime reports, and experiment plans.

3. **Run modes**
   - `self`: models answer as themselves.
   - `persona`: weights-only predictions for a named public figure, with no
     supplied evidence, custom profile instruction, or cutoff date.
   - `quadratic-importance`: a complementary whole-bank allocation pass where
     every model receives the same credit budget and vote cost is squared. It
     is stored separately from self/persona stance runs. The default schema is
     a capped top-ten rating task with at most three votes per question: its
     maximum cost is 90 of 100 credits, so the budget does not bind.

4. **Providers**
   - `mock`: deterministic no-network smoke tests.
   - `local`: OpenAI-compatible local server, default
     `http://127.0.0.1:8000/v1`.
   - `openrouter`: OpenRouter chat completions endpoint.
   - `plan-run` computes exact calls plus token/cost/readiness estimates before
     either real provider is contacted.

5. **Aggregation**
   - Reversed-polarity answers are normalized back to canonical polarity.
   - Repeats are nested inside a model/question cell; each model contributes
     one equally weighted distribution per question.
   - Separately launched local/OpenRouter model runs can be merged at report
     build time only when benchmark family, run mode, and persona are compatible.
   - Reports summarize model/question distributions, uncertainty,
     invalid-output rate, normal-vs-reversed consistency, overlap-qualified
     Jensen-Shannon similarity, participant graph edges, trait breakdowns,
     deterministic topic circles, and optional provenance-bound second-pass
     topic/compass/risk-scenario overlays.
   - Reports include deterministic bootstrap intervals and explicit signed and
     absolute canonical/reversed wording sensitivity.
   - One shared pairwise-availability rule withholds automatic group labels and
     joint embedding when eligible pairs lack sufficient overlap. Measured
     edges survive; available groups remain exploratory.
   - Optional importance repeats are averaged within each model before models
     are equally weighted. Topic rollups then control Debate Atlas prominence;
     reports without allocations fall back to question-count sizing.

6. **Rendering target**
   - The report JSON is shaped to render like a Context Engine results report:
     a Results/View shell, beeswarm-style agreement/difference, model
     participants list, an opinion-profile participant graph, breakdown view,
     debate atlas, risk matrix, and collapsible raw embedded report data.
   - Reports can also be exported as Context Engine `PolisReport`
     `questionResponses`, with each model treated as a participant and each
     averaged model/question score converted to a binary response row.
   - `export-ce-native` emits `ce_benchmark_results_dataset` for future native
     rendering without discretizing measured distributions. Unsupported derived
     opinion-group labels are withheld consistently with the standalone report.
   - Observed histograms and individual model means have separate visual axes.
     Reports saved without observed distributions derive shares from retained cell
     counts or show an unavailable state; Raw Results preserve original aggregate
     evidence.
   - A source-hash gate and the `$ai-discourse-bench-results-sync` skill track
     drift from live Context Engine Results components until direct shared
     imports are practical.

7. **Run integrity**
   - A deterministic shuffled schedule avoids fixed polarity ordering.
   - Bounded concurrency, retry/backoff, durable JSONL checkpoints, and
     `--resume` support long local and hosted runs.
   - Run manifests hash the bank, roster, prompt, persona, seed, and generation
     settings. Release mode enforces coverage and provider gates.
   - Longitudinal snapshots preserve model/question stance and similarity data;
     snapshot comparisons report stance-direction and similarity drift.
   - Saved-count corrections remain previews with `rawRunsRevalidated: false`.
     Their `summaryCorrection` provenance travels through derived exports and
     analysis fingerprints; old analysis fingerprints for corrected reports must
     be regenerated. Release-content hashing is unchanged.

## Running

The [README](../README.md) has the commands: the smoke path, local and OpenRouter
runs, persona and importance modes, and the report, render, export and publish
steps. A few architectural notes on how they behave:

- The OpenRouter path uses the same OpenAI-compatible adapter as local models,
  but sends an optional roster-defined `provider` routing object. Routing policy,
  dated model ids, declared pricing, and observed serving provider/model values
  are preserved separately, so changes in OpenRouter routing cannot silently pass
  resume or release validation. `require_parameters: true` prevents a route that
  does not support requested structured output from being selected. Before a full
  run, a catalog preflight verifies that each request id still maps to the
  roster's declared canonical revision, pricing, expiration state, and
  structured-output capability. Drift stops the run before any completion call.
- `local:full` runs all questions with canonical and reversed polarity, defaults
  to 10 repeats per polarity, builds JSON reports, and renders clickable HTML.
- Persona profiles identify a public figure by name only. The prompt does not
  inject evidence summaries, custom biographical instructions, source lists, or
  cutoff dates; the track measures how each model interprets the figure from its
  weights. Self and persona artifacts are kept in separate compatibility domains
  and cannot be merged into one report.
- `build-report` without `--limit-questions` covers the full 200-question sample
  bank. A full report may still be sparse if the run files answered only a
  subset: unanswered model/question cells stay as no-data cells and the artifact
  is marked preview. `build-report --release` requires publishable coverage and
  non-fixture provider provenance.

## Publication

Context Engine serves published benchmark artifacts through the static,
cache-independent `/benchmarks` route. The client loads a versioned manifest and
a deterministic gzip report artifact from its tracked public benchmark
publication directory. `ai-discourse-bench/scripts/publish-static-report.mjs`
updates both and enforces the report's release gate when invoked with `--release`.

## Open Decisions

- Whether OpenRouter model rosters should live in public files or private local
  config.
- Whether production should store generated analysis overlays beside report
  snapshots or derive them on demand. The current standalone flow generates
  overlays from the aggregated report via `export-analysis-input`.
- When to replace the interim Results hash/sync workflow with direct imports
  from a shared Context Engine report component package.
