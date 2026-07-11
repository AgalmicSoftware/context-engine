# Demo Data Fixtures

This directory contains demo and fixture data for the Context Engine survey platform. These files back demo sessions, historical figure personas, Polis-style analysis, debate visualizations, risk matrix views, and simulated profile pages.

## File Inventory

### Data Files

| File | Purpose |
| --- | --- |
| [`all_300_questions.json`](./all_300_questions.json) | Full question bank of roughly 300 survey questions used across demo sessions. Questions are stored in declarative statement form for survey presentation. |
| [`policy_atlas_council.json`](./policy_atlas_council.json) | Canonical source for roughly 54 historical figure "council members" in the AI Policy Atlas. Entries include `id`, `name`, `bio`, `atlasCategory`, SBT metadata, created questions, and avatar placeholders. Categories include Macro Trends, Supply Chains, Actors/Civil Society, and Governance Institutions. |
| [`additional_historical_figures.json`](./additional_historical_figures.json) | Supplementary set of 15 figures with richer persona fields such as questions, votes, comments, `biggestHope`, `biggestFear`, and `avatarPrompt`. |
| [`historical_figure_users.json`](./historical_figure_users.json) | Rich per-figure profile data for roughly 50 figures, including Q&A responses, legislation stances, bios, featured quotes, and highlighted advice. Used heavily by simulated user profile views. |
| [`historical_figures_merged.json`](./historical_figures_merged.json) | Consolidated superset combining data from the richer figure sources. Used for demographic computation, avatar resolution, and shared profile question lookups. |
| [`historical_figures_tree_qs_and_votes.json`](./historical_figures_tree_qs_and_votes.json) | Debate-oriented dataset for 66 figures with tree-structured questions, in-character comments, and vote stances. Used by debate tree and political compass views. |
| [`demo_polis_data.json`](./demo_polis_data.json) | Polis-format clustering dataset with participants, vote arrays, and group assignments. Used by the demo analysis adapter and Polis report surfaces. |
| [`demo_1_onchain_question_ids.json`](./demo_1_onchain_question_ids.json) | Canonical OP Sepolia `QuestionsAdded` IDs for the 42 `demo-1` Context corpus questions. Used to preload fast demo metadata while keeping responses answerable on-chain. |
| [`demo_analysis_data.json`](./demo_analysis_data.json) | Dedicated breakdown-tab analysis fixture. Uses the canonical 42 questions and seeded historical-figure personas, then expands them with deterministic synthetic responses so the breakdown view has richer comparison density without hardcoding question content in the generator. Participant rows now also carry explicit profile metadata so the UI can distinguish baseline historical personas from modeled variants. |
| [`demo_analysis_generation_config.json`](./demo_analysis_generation_config.json) | Corpus-backed curation config for the breakdown fixture generator. Keeps vetted question-to-node mappings, selected statement overrides, and deterministic synthetic-response settings in demo data, not in the generator script. Variant profiles include labels, rationale, and confidence so modeled rows stay inspectable. |
| [`demo_sessions.json`](./demo_sessions.json) | Demo session definitions keyed by slug with metadata and worker configuration. Used by session resolution code and worker/cors proxy tests. |
| [`sim_profile_answer_reconciliation.json`](./sim_profile_answer_reconciliation.json) | Curated evidence config for `scripts/reconcile-sim-profile-answers.mjs`. Pins the polarity of key_tension links between the policy question bank and demo comments, and whitelists tree-node fallbacks (with explicit polarity, anchors, and rationale) used to keep simulated profile answers consistent with the vote fixtures. |
| [`demo_sbt_collection.json`](./demo_sbt_collection.json) | Sample SBT group metadata with per-figure demographic attributes such as gender, era, country, affiliation, and atlas category. |
| [`expanded_tag_list.json`](./expanded_tag_list.json) | Taxonomy tag list for survey question classification and topic labeling. |
| [`risk_matrix_data.json`](./risk_matrix_data.json) | Input data for the debate risk matrix visualization. |
| [`corpus_sample.json`](./corpus_sample.json) | Sample AI discourse corpus documents used by demo corpus views. |
| [`corpus_debate_map_links.json`](./corpus_debate_map_links.json) | Legacy corpus `debate_nodes` to atlas node mapping used to deep-link demo cards into the Debate Map. |
| [`debates.json`](./debates.json) | Generated debate entries for Debate HUD and related demo views. |
| [`loophole_historical_figure_principles.json`](./loophole_historical_figure_principles.json) | Per-figure moral principles used to deepen the atlas historical-case briefs in the Loophole-style demo flow. |
| [`loophole_historical_cases.json`](./loophole_historical_cases.json) | Historical-figure cases inspired by `brendanhogan/loophole`, injected into relevant atlas nodes as a dedicated demo-mode section and mirrored into [`ai-discourse-corpus/corpuses/loophole-historical-cases.json`](../../../../ai-discourse-corpus/corpuses/loophole-historical-cases.json). |

### JS Modules

| File | Purpose |
| --- | --- |
| [`historical_figure_demographics.ts`](./historical_figure_demographics.ts) | Computes demographic breakdowns from merged historical figure data plus the Polis fixture. Exports `DEMO_ANALYSIS_DEMOGRAPHIC_FIELDS` and the default historical figure lookup object. |
| [`historical_figure_demographics.test.ts`](./historical_figure_demographics.test.ts) | Regression coverage for the demographics lookup and fixture completeness. |
| [`debateData.ts`](./debateData.ts) | Debate HUD fixture module with debate cards, argument trees, audience roster/votes, voter profiles, and source links. |
| [`index.ts`](./index.ts) | Barrel export for the most commonly imported demo datasets and demographics helpers. |

## Primary Consumers

The main consumers of this folder are:

- [`demoAnalysisAdapter.ts`](../../utilities/demo/demoAnalysisAdapter.ts)
- [`demoAvatars.ts`](../../utilities/ui/demoAvatars.ts)
- [`sessionSourceResolver.ts`](../../utilities/session/sessionSourceResolver.ts)
- [`PolisReport.tsx`](../../components/PolisReport/PolisReport.tsx)
- [`DebateMap.tsx`](../../components/DebateMap/DebateMap.tsx)
- [`PoliticalCompassView.tsx`](../../components/DemoViews/DebateHUD/PoliticalCompassView.tsx)
- [`DebateSelector.tsx`](../../components/DemoViews/DebateHUD/DebateSelector.tsx)
- [`ArgumentTreeView.tsx`](../../components/DemoViews/DebateHUD/ArgumentTreeView.tsx)
- [`VotesOnArgumentsView.tsx`](../../components/DemoViews/DebateHUD/VotesOnArgumentsView.tsx)
- [`CommunityTab.tsx`](../../components/CommunityTab/CommunityTab.tsx)
- [`SimUserPage.tsx`](../../components/UserPage/SimUserPage.tsx)

## Temporary Demo Session Seed

`demo_sessions.json` keeps `demo-1` as a temporary display/question compatibility seed until the Cloudflare-backed demo session replaces the Arweave/on-chain preload path. Worker URLs, faucet sponsorship, and gate authority must stay in the live SessionRegistry plus Worker KV config, not in this fixture. Remove the preloaded question IDs when the pure Cloudflare demo session ships.

## Conceptual Data Pipeline

This is the logical relationship between the core demo fixtures. It describes how the datasets build on each other; it is not an automated build graph by itself.

```text
Raw corpus / demo integration package
  |
  v
all_300_questions.json
  |
  v
policy_atlas_council.json
additional_historical_figures.json
historical_figure_users.json
  |
  v
historical_figures_merged.json
  |
  +--> demo_polis_data.json
  |
  +--> demo_analysis_data.json
  |
  +--> historical_figures_tree_qs_and_votes.json
  |
  v
historical_figure_demographics.js
  |
  v
DemoAnalysisAdapter, DebateMap, PolisReport, SimUserPage
```

## Avatar Resolution Chain

Avatar lookup is assembled across multiple data sources. Figure records provide candidate names and placeholders, then UI utilities resolve the best available image source.

```text
historical_figures_merged.json
historical_figure_users.json
policy_atlas_council.json
additional_historical_figures.json
  |
  v
utilities/ui/demoAvatars.js
  |
  v
utilities/ui/historicalFigureAvatars.js
  |
  +--> utilities/ui/historicalFigureLocalPhotoManifest.json
  |
  +--> utilities/ui/historicalFigurePhotoManifest.json
  |
  v
PoliticalCompassView, PolisReport, CommunityTab, SimUserPage
```

Related files:

- [`demoAvatars.ts`](../../utilities/ui/demoAvatars.ts)
- [`historicalFigureAvatars.ts`](../../utilities/ui/historicalFigureAvatars.ts)
- [`historicalFigureLocalPhotoManifest.json`](../../utilities/ui/historicalFigureLocalPhotoManifest.json)
- [`historicalFigurePhotoManifest.json`](../../utilities/ui/historicalFigurePhotoManifest.json)

Canonical shipped source:

- `historicalFigureLocalPhotoManifest.json` is the canonical manifest for repo-shipped demo avatars under `client/public/historical-avatars/`.
- `historicalFigurePhotoManifest.json` must stay free of placeholder sentinel values and may only contain approved local asset paths or intentionally whitelisted hosted URLs.

## Adding a New Historical Figure

To add a new historical figure cleanly, update the datasets that drive the surfaces you care about:

1. Update [`policy_atlas_council.json`](./policy_atlas_council.json) with the new figure's `id`, `name`, `bio`, `atlasCategory`, SBT metadata, question content, and tags.
2. Update [`historical_figures_tree_qs_and_votes.json`](./historical_figures_tree_qs_and_votes.json) with debate questions, at least several in-character comments, and vote stances.
3. Update [`historical_figure_demographics.ts`](./historical_figure_demographics.ts) with the figure's demographics entry, including display name, bio, era, country, gender, affiliation, and atlas category.
4. Update [`demo_sbt_collection.json`](./demo_sbt_collection.json) with matching demographic attributes.
5. Update [`historicalFigureLocalPhotoManifest.json`](../../utilities/ui/historicalFigureLocalPhotoManifest.json) first, then keep [`historicalFigurePhotoManifest.json`](../../utilities/ui/historicalFigurePhotoManifest.json) aligned if a second manifest is still being used for hosted or mirrored sources.
6. Optionally update [`additional_historical_figures.json`](./additional_historical_figures.json) when you need richer persona fields such as `biggestHope`, `biggestFear`, or `avatarPrompt`.
7. Optionally update [`historical_figure_users.json`](./historical_figure_users.json) when the figure needs a full SimUserPage-style profile.
8. Keep [`historical_figures_merged.json`](./historical_figures_merged.json) in sync with the source datasets if your workflow does not regenerate it automatically.

## Regenerating The Breakdown Fixture

The breakdown tab now uses [`demo_analysis_data.json`](./demo_analysis_data.json) instead of the canonical Polis demo fixture.

- Regenerate it from the repo root with `npm run demo:analysis:generate`
- The generator lives at [`scripts/generate-demo-analysis-fixture.mjs`](../../../../scripts/generate-demo-analysis-fixture.mjs)
- Generation policy is explicit-map tree-first, Polis-fallback:
  - only map a breakdown question to atlas tree votes when the generator contains a manually validated question-to-node mapping for that exact question index
  - require the mapped atlas `nodeId` to still match the question's current `nodeId` in [`demo_polis_data.json`](./demo_polis_data.json) before using tree votes
  - map tree scores to `Agree` / `Unsure` / `Disagree` with `>= 2`, between, and `<= -2`
  - fall back to [`demo_polis_data.json`](./demo_polis_data.json) when a question is unmapped, when the mapping drifts, or when a persona has no tree vote for that node
- Keep [`demo_polis_data.json`](./demo_polis_data.json) unchanged unless you also intend to refresh `PolisReport` precomputed cluster metadata

## Naming And Compatibility Notes

- Most JSON fixtures in this folder use `snake_case`.
- Most fixture filenames in this folder now follow `snake_case`, including [`demo_polis_data.json`](./demo_polis_data.json).
- TypeScript modules in this folder now follow the same `snake_case` filename convention, including [`historical_figure_demographics.ts`](./historical_figure_demographics.ts).
