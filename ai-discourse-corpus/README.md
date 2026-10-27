# AI Discourse Corpus

A curated sample of high-quality AI discourse source material, spanning policy, safety, governance, science fiction, and technical evaluation perspectives.

This corpus is maintained as part of [Context Engine](https://github.com/AgalmicSoftware/context-engine) but is designed to be independently useful for research, analysis, and AI training applications.

## Contents

| Sub-corpus | Items | Description |
|------------|-------|-------------|
| `ai-forecasting-economics-corpus.json` | 24 | AI forecasting and economics: compute/capability trend data, crowd and tournament forecasts, and the formal economics of transformative AI. |
| `ai-laws-policy-corpus.json` | 247 | Global AI legislation, regulatory proposals, policy frameworks, agency guidance, and official reports with governance-focused analysis. |
| `ai-scifi-books-corpus.json` | 155 | Science fiction works curated for AI safety, alignment, ethics, and policy discourse. |
| `arxiv-ai-safety-corpus.json` | 311 | Academic papers on AI safety, alignment, interpretability, and governance. |
| `cross-corpus-debates.json` | 16 | Structured debate trees that synthesize evidence across multiple AI discourse sources. |
| `dwarkesh-lab-insiders-corpus.json` | 153 | Interviews and writings from AI lab insiders and practitioners on frontier AI development. |
| `enriched-tweets.json` | 5023 | Enriched social-media discourse from 2018-09-21 through 2026-10-15, with summaries, tags, relevance signals, and linked context. |
| `lab-primary-docs-corpus.json` | 49 | Primary safety/governance documents from frontier labs: safety frameworks (RSP, Preparedness, FSF), system cards, framework compliance reports, model specs, and deployment updates. |
| `lesswrong-posts-corpus.json` | 241 | Influential LessWrong, Alignment Forum, EA Forum, and related AI safety/rationalist writing. |
| `metr-evals-metrics-corpus.json` | 82 | METR publications, benchmarks, evaluation reports, and measurement-oriented policy material. |
| `loophole-historical-cases.json` | 40 | Mirrored copy of Context Engine's Loophole historical-case dataset, generated via the methodology from [brendanhogan/loophole](https://github.com/brendanhogan/loophole). Explores regulatory edge cases through adversarial scenario generation. |

## Format

Each sub-corpus is a JSON file containing an array of entries or a top-level object with metadata plus an entries array. Entry schema varies by source but generally includes: title/text, author/source, URL, tags, and metadata. Entries added or revised since mid-2026 also carry `verification_status` (`verified` when the primary page was fetched and read, `partially_verified` when drafted from secondary coverage or search excerpts) and `verification_notes` describing the sources used, so consumers can weight them accordingly.

Provenance and quality fields (2026-10 quality pass):

- `verification_status` / `verification_notes` now appear on most non-tweet entries; entries without them have not been checked against a primary source. Corrections found during verification (titles, author lists, dates, URLs, unsupported claims) were applied in place, and the old URL is kept in `source_links` when a URL changed.
- `quality_flags` marks problems that need a human decision: `fabrication_suspected` on non-tweet entries whose described document could not be found; on tweets, `off_topic`, `low_relevance`, `needs_context`, `empty_text`, `truncated_text` and `non_english`.
- `canonical_id` links copies of the same work filed in more than one sub-corpus (it holds the id of the copy in the preferred home sub-corpus), so evidence counts can treat them as one source.
- `ai-laws-policy` uses a fixed lifecycle `status` vocabulary (proposed, in_committee, passed_one_chamber, passed_legislature, enacted, vetoed, failed, withdrawn, repealed, superseded for legislation; published, active, ongoing, decided for other instruments), a `doc_kind` field (legislation, regulation, executive_action, agency_guidance, agency_enforcement, national_strategy, framework, voluntary_commitment, standard, international_agreement, policy_report, court_case, institution) and `jurisdiction_level` (international, supranational, national, subnational, local). Refreshed entries carry `status_detail` and `status_as_of`.
- `arxiv-ai-safety` entries carry `date` (first arXiv version) alongside `year` (which may be the venue year); `citation_count` values are unverified estimates.
- Tweets carry `enriched_at` when their summary, labels, policy analysis and cross-links were regenerated, and `date_added` when they were ingested. `corpus_crossrefs` entries always resolve by `entry_id` and include a short `note` on the specific connection; a tweet with no specific match has no cross-links.
- Tweet `policy_insights.themes` uses a fixed vocabulary of 17 keys (ai_capabilities, alignment_approach, safety_evaluation, risk_framework, governance_mechanism, democratic_ai, power_concentration, international_competition, economic_impact, labor_impact, environmental_impact, info_ecosystem, ai_rights_consciousness, prediction_forecasting, open_problems, crypto_blockchain_ai, general_discourse) as `{theme, strength}`, with 1-3 themes per tweet and strength 3 (main subject), 2 (substantial) or 1 (touched on). Free-text topic labels are in `policy_insights.topics`.

`lab-primary-docs` includes an `incident_report` document type for the July–August 2026 evaluation-escape disclosures (Hugging Face, OpenAI, Anthropic), and `cross-corpus-debates.json` positions now draw on that sub-corpus as well.

The Loophole mirror in [`corpuses/loophole-historical-cases.json`](./corpuses/loophole-historical-cases.json) is intentionally duplicated from [`client/src/variables/demo/loophole_historical_cases.json`](../client/src/variables/demo/loophole_historical_cases.json) so the corpus package and demo runtime stay aligned. Each case preserves its `source_label` and `url`, including citation of the upstream [brendanhogan/loophole](https://github.com/brendanhogan/loophole) repo.

## Usage

These files can be consumed directly by any application that reads JSON. They are not tied to Context Engine's client runtime.

For context-safe maintenance, avoid opening the large JSON files directly in an LLM session. Use the focused helper from the repository root:

```bash
node scripts/ai-discourse-corpus-tools.js summary
node scripts/ai-discourse-corpus-tools.js validate
node scripts/ai-discourse-corpus-tools.js freshness --as-of 2026-10-25
node scripts/ai-discourse-corpus-tools.js extract debate_ai_water_usage
```

The helper reports counts, metadata drift, duplicate IDs and per-sub-corpus normalized titles,
debate-reference coverage, client sample mirror coverage, taxonomy and
date/year drift, tweet cross-link resolution and debate-node vocabulary, arXiv id
format, verification-status values, works duplicated across sub-corpora without a
shared `canonical_id`, and compact single-record extracts without dumping the full
corpus into the chat context. `freshness` reports, per sub-corpus, the newest dated
entry, entries in the last 30 and 90 days, verified counts, and a `stale` flag when
nothing new has been added for 60 days. URL-form lookups normalize protocol, `www`, and
trailing slashes while preserving case-sensitive paths. This is especially
important for `enriched-tweets.json`, which is much larger than the other
corpus files.

## License

These files aggregate source-derived material from third-party publications and platforms. The corpus has its own rights notice in [LICENSE.md](LICENSE.md):

- no ownership is claimed over upstream source publications, posts, or linked material
- reuse of upstream source material remains subject to the original source licenses, platform terms, and attribution requirements referenced in each entry
- to the extent the project-authored annotations, summaries, tags, and JSON structure are copyrightable and controlled by contributors, they are dedicated under CC0 1.0
