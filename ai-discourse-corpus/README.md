# AI Discourse Corpus

A curated sample of high-quality AI discourse source material, spanning policy, safety, governance, science fiction, and technical evaluation perspectives.

This corpus is maintained as part of [Context Engine](https://github.com/AgalmicSoftware/context-engine) but is designed to be independently useful for research, analysis, and AI training applications.

## Contents

| Sub-corpus | Items | Description |
|------------|-------|-------------|
| `ai-laws-policy-corpus.json` | 204 | Global AI legislation, regulatory proposals, and policy frameworks with governance-focused analysis. |
| `ai-scifi-books-corpus.json` | 142 | Science fiction works curated for AI safety, alignment, ethics, and policy discourse. |
| `arxiv-ai-safety-corpus.json` | 245 | Academic papers on AI safety, alignment, interpretability, and governance. |
| `cross-corpus-debates.json` | 8 | Structured debate trees that synthesize evidence across multiple AI discourse sources. |
| `dwarkesh-lab-insiders-corpus.json` | 130 | Interviews and writings from AI lab insiders and practitioners on frontier AI development. |
| `enriched-tweets.json` | 4036 | Enriched social-media discourse with summaries, tags, relevance signals, and linked context. |
| `lesswrong-posts-corpus.json` | 202 | Influential LessWrong, Alignment Forum, EA Forum, and related AI safety/rationalist writing. |
| `metr-evals-metrics-corpus.json` | 86 | METR publications, benchmarks, evaluation reports, and measurement-oriented policy material. |

## Format

Each sub-corpus is a JSON file containing an array of entries or a top-level object with metadata plus an entries array. Entry schema varies by source but generally includes: title/text, author/source, URL, tags, and metadata.

## Usage

These files can be consumed directly by any application that reads JSON. They are not tied to Context Engine's client runtime.

## License

These files aggregate source-derived material from third-party publications and platforms. The corpus has its own rights notice in [LICENSE.md](LICENSE.md):

- no ownership is claimed over upstream source publications, posts, or linked material
- reuse of upstream source material remains subject to the original source licenses, platform terms, and attribution requirements referenced in each entry
- to the extent the project-authored annotations, summaries, tags, and JSON structure are copyrightable and controlled by contributors, they are dedicated under CC0 1.0
