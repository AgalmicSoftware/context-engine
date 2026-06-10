# Telegram Session Data Mode Design

## Scope And Invariants

This consolidation is for browser/client handling of Cloudflare Telegram sessions such as `agent-village-2026`. Normal on-chain sessions must keep their current `SurveyPage`, `SBTsPage`, `PolisReport`, and `DebateMap` wiring. The only worker change allowed by the handoff is CORS exposure for an existing answer-submission route; no Telegram bot behavior or worker business logic changes are in scope.

Secrets are never rendered, logged, copied into prompts, or committed. Token handling stays inside `workerAuth` credential helpers and the existing token-login flow.

## Current Coupling Audit

`OnePageSession.tsx` currently owns too many Telegram-specific concerns:

- Session-meta probing and token login/re-entry.
- Direct calls to `fetchTelegramAgentQuestions`, `fetchTelegramAgentResults`, and `normalizeTelegramBucketCards`.
- Hand-rolled read-only question cards and answer controls.
- Hand-rolled bucket cards borrowing `SBTsList.module.scss`.
- Results rendering, approximate `PolisReport` dataset selection, aggregate fallback cards, topic-map prompt creation, and `TelegramTopicMap` placement.

The on-chain pile path mounts `SurveyPage` with `minifiedMode="pile"`. `SurveyPileViewMode` is not a presentational-only component: it hydrates local/on-chain question caches, decrypt state, prior responses, Lit gates, draft state, and contract-backed submission. Passing Telegram API data into it would either require broad on-chain-path changes or fake cache state. The safer reuse plan is to extract a small Telegram question pile component that reuses the same visual SCSS and per-type control components/patterns where practical, but owns API submission through the Telegram adapter.

`SbtListDisplayCards.tsx` exports presentational SBT card shells. Research buckets can map into that card model without invoking on-chain group discovery or mint/create flows. Bucket option changes remain local display state; no browser-callable bucket-update route exists in the audited worker route table.

`PolisReport` already accepts an aggregator object through `questionResponses`. `telegramAgentData.ts` already normalizes real `view=polis` vectors when available and synthesizes deterministic aggregate-derived vectors otherwise. The aggregate-card fallback in `OnePageSession` can be removed once the Report tab consistently renders empty/disabled/approximate states.

## Mode Resolution

Add `client/src/utilities/session/sessionDataMode.ts`:

```ts
resolveSessionDataMode({ sessionConfig, probeResult, telegramAuth }) => 'onchain' | 'telegram'
```

Rules:

- Return `telegram` only when the session config/probe is Telegram-only and the user is logged in with a valid Telegram client token.
- Otherwise return `onchain`.
- `OnePageSession` computes this once per render and passes a boolean/data-mode value down. Other code reads the computed value instead of re-deriving `telegramDataMode` through scattered ternaries.

## Telegram Adapter

Add `client/src/utilities/session/telegramSessionBackend.ts` as the UI-facing adapter over `telegramAgentData.ts`:

- `loadQuestions({ sessionSlug, agentBridgeUrl, fetchImpl })`
- `submitAnswer({ sessionSlug, agentBridgeUrl, question, answer, fetchImpl })`
- `loadResultsDataset({ sessionSlug, agentBridgeUrl, fetchImpl })`
- `loadGroups({ buckets })`
- Auth failure helpers that reuse `isTelegramAgentAuthFailure`.

The adapter returns UI-shaped data:

- Questions are normalized with `answeredByUser`, `answerable`, `questionType`, options, tags, and local submission status.
- Results include `views`, `polisDataset`, and `approximate` so the Report tab can render `PolisReport` directly and show `ce-session-telegram-report-approx` when synthesized.
- Groups return bucket cards mapped to SBT-card-compatible models plus local selected option state.

The existing lower-level fetchers stay focused on HTTP normalization and can retain their tests.

## Submission Route Findings

Existing route: `POST /telegram/agent/api/preferences`.

Evidence:

- `delegationScopeForRequest('/telegram/agent/api/preferences', 'POST')` requires `DRAFT_ANSWERS`, which default `ceagt_` tokens include.
- `handlePreferencesRequest` normalizes entries, saves a draft, and direct-submits when the root payload has `submit=true` and `humanApproved=true`.
- The accepted direct-submit payload shape is:

```json
{
  "sessionSlug": "<session>",
  "preferences": [
    {
      "questionId": "<question id>",
      "answer": { "value": "agree" }
    }
  ],
  "submit": true,
  "humanApproved": true
}
```

`AGENT_BRIDGE_DIRECT_SUBMIT_ENABLED` gates lower-level direct submission behavior in the worker stack, but the route already reports direct-submit success/failure through `submittedCount`, `skipped`, and `reviewRequired`.

Browser gap: `AGENT_BROWSER_READ_CORS_PATHS` currently covers only GET reads for `/questions` and `/results`. Add `/telegram/agent/api/preferences` to the existing browser-CORS pattern with `POST, OPTIONS` for that path. This is the single permitted worker commit and requires deployment before live browser submission works.

## Surface Strategy

### Questions

Use a new Telegram question pile component under `components/OnePageSession/telegram/`.

Reason: real `SurveyPileViewMode` is coupled to on-chain caches, decrypt flow, and contract/local response submission. A prop-injected reuse would be larger and risk normal-session regressions.

The new component will:

- Render a pile/deck with one active card and previous/next navigation.
- Use per-type interactive controls: binary, multichoice, rating, and freeform.
- Submit through the adapter with root `submit=true` and `humanApproved=true`.
- Optimistically mark the active question answered and refresh question state after submit.
- Preserve test IDs: `ce-session-telegram-questions`, `ce-session-telegram-question-item`, `ce-session-telegram-question-*`, refresh/view-all.
- Route auth failures to the existing re-paste flow.

### Groups

Use `SbtListStandardCard` presentational chrome from `SbtListDisplayCards.tsx`, with research buckets mapped to SBT-like cards:

- `name` = bucket category label.
- `description` = selected option labels or "No selection yet".
- details panel = local dropdown/list of bucket options with `ce-session-telegram-bucket-select`.

No worker write is added for bucket option changes. Changes remain local visual selection until a browser-callable settings/bucket endpoint exists.

### Results

Results tabs in Telegram mode:

- `Report`: always attempts the real `PolisReport` using the adapter dataset.
- `Debate Map`: hosts `TelegramTopicMap` plus the "Copy Codex prompt" button.

Prefer `view=polis` vectors when available. Otherwise synthesize deterministic vectors from aggregate rows and anonymized group breakdowns. Show `ce-session-telegram-report-approx` for synthesized data. Delete the old aggregate-card fallback if the synthesized/empty states cover all cases.

### Telegram-Only UI

Extract token gate, connected/change-token bar, and topic-map prompt builder into `components/OnePageSession/telegram/` so `OnePageSession` keeps mode resolution, data loading orchestration, and section mounting only.

## Deletion List

Expected removals or relocations:

- `renderTelegramQuestionAnswerSurface` from `OnePageSession.tsx`.
- Hand-rolled question-card markup in `renderTelegramQuestionsPanel`.
- Hand-rolled bucket cards in `renderTelegramBucketsPanel`.
- Aggregate-card fallback blocks in `renderTelegramResultsPanel`, if the Report tab covers the data states.
- `buildTelegramTopicMapCodexPrompt`, `handleCopyTopicMapPrompt`, and `renderTelegramTopicMapSection` from `OnePageSession.tsx` after extraction.
- Unused `.telegramPanel*`, `.telegramReadonly*`, and duplicated `.telegramPile*` styles that are replaced by shared/extracted components.
- Direct imports of `SurveyTool.module.scss` and `SBTsList.module.scss` in `OnePageSession.tsx`; extracted components may import the SCSS they directly use.

## Slice Plan

1. Add `sessionDataMode.ts`, `telegramSessionBackend.ts`, and focused tests.
2. Add the narrow worker CORS extension for `POST /telegram/agent/api/preferences` plus worker tests.
3. Replace read-only Telegram questions with the interactive Telegram pile component and adapter submission.
4. Replace bucket markup with SBT card chrome mapped from bucket cards.
5. Consolidate Results into Report and Debate Map tabs, keeping `PolisReport` for Telegram data.
6. Extract token gate/connected bar/topic-map prompt UI and remove dead styles/imports.

Each slice is committed separately with tests after the slice. Final verification runs the requested Jest scope, confirms typecheck still reports exactly the known six TS errors, and runs worker tests if the CORS slice landed.
