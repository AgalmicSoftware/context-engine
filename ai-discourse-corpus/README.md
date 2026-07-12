# AI Discourse Corpus

A curated sample of high-quality AI discourse source material, spanning policy, safety, governance, science fiction, and technical evaluation perspectives.

This corpus is maintained as part of [Context Engine](https://github.com/AgalmicSoftware/context-engine) but is designed to be independently useful for research, analysis, and AI training applications.

## Contents

| Sub-corpus | Items | Description |
|------------|-------|-------------|
| `ai-forecasting-economics-corpus.json` | 17 | AI forecasting and economics: compute/capability trend data, crowd and tournament forecasts, and the formal economics of transformative AI. |
| `ai-laws-policy-corpus.json` | 227 | Global AI legislation, regulatory proposals, policy frameworks, agency guidance, and official reports with governance-focused analysis. |
| `ai-scifi-books-corpus.json` | 156 | Science fiction works curated for AI safety, alignment, ethics, and policy discourse. |
| `arxiv-ai-safety-corpus.json` | 278 | Academic papers on AI safety, alignment, interpretability, and governance. |
| `cross-corpus-debates.json` | 16 | Structured debate trees that synthesize evidence across multiple AI discourse sources. |
| `dwarkesh-lab-insiders-corpus.json` | 152 | Interviews and writings from AI lab insiders and practitioners on frontier AI development. |
| `enriched-tweets.json` | 4140 | Enriched social-media discourse with summaries, tags, relevance signals, and linked context. |
| `lab-primary-docs-corpus.json` | 30 | Primary safety/governance documents from frontier labs: safety frameworks (RSP, Preparedness, FSF), system cards, framework compliance reports, model specs, and deployment updates. |
| `lesswrong-posts-corpus.json` | 219 | Influential LessWrong, Alignment Forum, EA Forum, and related AI safety/rationalist writing. |
| `metr-evals-metrics-corpus.json` | 95 | METR publications, benchmarks, evaluation reports, and measurement-oriented policy material. |
| `loophole-historical-cases.json` | 40 | Mirrored copy of Context Engine's Loophole historical-case dataset, generated via the methodology from [brendanhogan/loophole](https://github.com/brendanhogan/loophole). Explores regulatory edge cases through adversarial scenario generation. |

## Format

Each sub-corpus is a JSON file containing an array of entries or a top-level object with metadata plus an entries array. Entry schema varies by source but generally includes: title/text, author/source, URL, tags, and metadata.

The Loophole mirror in [`corpuses/loophole-historical-cases.json`](./corpuses/loophole-historical-cases.json) is intentionally duplicated from [`client/src/variables/demo/loophole_historical_cases.json`](../client/src/variables/demo/loophole_historical_cases.json) so the corpus package and demo runtime stay aligned. Each case preserves its `source_label` and `url`, including citation of the upstream [brendanhogan/loophole](https://github.com/brendanhogan/loophole) repo.

## Usage

These files can be consumed directly by any application that reads JSON. They are not tied to Context Engine's client runtime.

For context-safe maintenance, avoid opening the large JSON files directly in an LLM session. Use the focused helper from the repository root:

```bash
node scripts/ai-discourse-corpus-tools.js summary
node scripts/ai-discourse-corpus-tools.js validate
node scripts/ai-discourse-corpus-tools.js extract debate_ai_water_usage
```

The helper reports counts, metadata drift, debate-reference coverage, client mirror coverage, malformed date/year fields, and compact single-record extracts without dumping the full corpus into the chat context. This is especially important for `enriched-tweets.json`, which is much larger than the other corpus files.

## License

These files aggregate source-derived material from third-party publications and platforms. The corpus has its own rights notice in [LICENSE.md](LICENSE.md):

- no ownership is claimed over upstream source publications, posts, or linked material
- reuse of upstream source material remains subject to the original source licenses, platform terms, and attribution requirements referenced in each entry
- to the extent the project-authored annotations, summaries, tags, and JSON structure are copyrightable and controlled by contributors, they are dedicated under CC0 1.0
