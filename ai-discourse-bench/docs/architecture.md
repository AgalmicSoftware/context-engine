# AI Discourse Bench Architecture

AI Discourse Bench is a self-contained benchmark folder inside the Context
Engine repo. It keeps its runner, report contract, sample data, prompts, docs,
and generated diagrams together under `ai-discourse-bench/`.

## Pipeline

1. **Question bank generation**
   - Use `prompts/question-bank-generator.md` with compact extracts from the
     OSS `ai-discourse-corpus/`.
   - Review and prune generated candidates into a versioned question bank.
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
   - `persona`: source-bounded counterfactual predictions for a public figure,
     with an evidence cutoff and public citations.

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

6. **Rendering target**
   - The report JSON is shaped to render like a Context Engine results report:
     a Results/View shell, beeswarm-style agreement/difference, model
     participants list, an opinion-profile participant graph, breakdown view,
     debate atlas, risk matrix, and collapsible raw embedded report data.
   - Reports can also be exported as Context Engine `PolisReport`
     `questionResponses`, with each model treated as a participant and each
     averaged model/question score converted to a binary response row.
   - `export-ce-native` emits the lossless `ce_benchmark_results_dataset`
     contract for future native rendering without discretizing distributions.
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

## Running

From `ai-discourse-bench/`:

```bash
npm run smoke
```

Regenerate the 200-question development seed bank:

```bash
npm run generate:questions
```

Local OpenAI-compatible server:

```bash
AIDB_LOCAL_BASE_URL=http://127.0.0.1:8000/v1 \
node ./bin/ai-discourse-bench.mjs run \
  --provider local \
  --questions ./data/question-bank.sample.json \
  --models ./data/model-roster.sample.json \
  --out ./runs/local-self-runs.json \
  --repeats 10 \
  --concurrency 2 \
  --max-attempts 3
```

OpenRouter:

```bash
OPENROUTER_API_KEY=... \
node ./bin/ai-discourse-bench.mjs run \
  --provider openrouter \
  --questions ./data/question-bank.sample.json \
  --models ./data/model-roster.sample.json \
  --out ./runs/openrouter-self-runs.json \
  --repeats 10 \
  --concurrency 4 \
  --max-attempts 3
```

Full local benchmark run:

```bash
AIDB_LOCAL_BASE_URL=http://127.0.0.1:8000/v1 \
AIDB_LOCAL_MODELS="llama3.1:8b|Llama 3.1 8B|8B|open-weights|US,qwen2.5:14b|Qwen 2.5 14B|14B|open-weights|China" \
npm run local:full
```

`local:full` runs all questions with canonical and reversed polarity, defaults
to 10 repeats per polarity, builds JSON reports, and renders clickable HTML.
Use `AIDB_LIMIT_QUESTIONS=5 AIDB_REPEATS=1 AIDB_MAX_TOKENS=700` for a fast
real-model wiring check, especially with local models that emit visible
reasoning before JSON. Set `AIDB_RESUME=1` to continue from the output and
checkpoint; concurrency, retries, and schedule seed are also configurable.

Persona mode:

```bash
node ./bin/ai-discourse-bench.mjs run \
  --provider mock \
  --mode persona \
  --persona norbert-wiener \
  --questions ./data/question-bank.sample.json \
  --models ./data/model-roster.sample.json \
  --personas ./data/personas.sample.json \
  --out ./runs/mock-norbert-wiener-runs.json \
  --repeats 1
```

Build a report:

```bash
node ./bin/ai-discourse-bench.mjs build-report \
  --questions ./data/question-bank.sample.json \
  --models ./data/model-roster.sample.json \
  --runs ./runs/mock-self-runs.json \
  --out ./results/mock-self-report.json
```

Build a report from multiple model-specific run artifacts:

```bash
node ./bin/ai-discourse-bench.mjs build-report \
  --questions ./data/question-bank.sample.json \
  --models ./runs/model-a-roster.generated.json,./runs/model-b-roster.generated.json \
  --runs ./runs/model-a-runs.json,./runs/model-b-runs.json \
  --out ./results/local-smoke-combined-report.json
```

Leave `--limit-questions` unset for the full 200-question report. Use it only
when intentionally producing a small report artifact for a wiring check. Full
reports may still be sparse if the input run files only answered a subset of the
bank; unanswered model/question cells are preserved as no-data cells and the
artifact is marked preview. Use `build-report --release` to require publishable
coverage and non-fixture provider provenance.

Render a standalone Context Engine-style report:

```bash
node ./bin/ai-discourse-bench.mjs render-report \
  --report ./results/mock-self-report.json \
  --out ./results/mock-self-report.html
```

Export for native Context Engine `PolisReport` rendering:

```bash
node ./bin/ai-discourse-bench.mjs export-ce \
  --report ./results/mock-self-report.json \
  --out ./results/mock-self-ce-polis-export.json
```

## Open Decisions

- Final Context Engine route/path for publishing rendered benchmark reports.
- Whether OpenRouter model rosters should live in public files or private local
  config.
- Whether production should store generated analysis overlays beside report
  snapshots or derive them on demand. The current standalone flow generates
  overlays from the aggregated report via `export-analysis-input`.
- When to replace the interim Results hash/sync workflow with direct imports
  from a shared Context Engine report component package.
