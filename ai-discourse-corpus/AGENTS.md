# AI Discourse Corpus Agent Notes

## Context Safety

- Do not open or paste full corpus JSON files into the conversation context, especially `corpuses/enriched-tweets.json`.
- Prefer the compact maintenance CLI from the repo root:
  - `node scripts/ai-discourse-corpus-tools.js summary`
  - `node scripts/ai-discourse-corpus-tools.js validate`
  - `node scripts/ai-discourse-corpus-tools.js extract <id-or-url>`
- When inspecting records manually, use targeted commands such as `rg`, short `sed` windows, or the `extract` command above.
- Keep generated audit output concise: summarize counts, IDs, and failing references instead of dumping full records.

## Mirror Data

- If cross-corpus debates change, keep `client/src/variables/demo/debates.json` and `client/src/variables/demo/corpus_sample.json` aligned.
- If Loophole historical case atlas mappings change, keep `client/src/variables/demo/loophole_historical_cases.json` aligned.
