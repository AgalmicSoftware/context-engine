# Telegram Results Exposure Levels PRD

## Problem

`telegram_only` sessions need a useful participant-facing results view without
turning the normal CE client into a public raw-data surface. The same result
shape should also be reusable by Agent Village or another public viewing layer,
where exposure can be more restrictive than the Telegram participant view.

## Goals

- Define explicit result exposure levels for Telegram-only sessions.
- Let Telegram participants see aggregate results by default.
- Let admins opt into anonymized group views when a session has enough response
  density.
- Keep wallet addresses, Telegram IDs, raw response records, and per-user answer
  histories out of participant and public result views.
- Produce a snapshot envelope that Agent Village can consume later as a public
  viewing layer without needing access to Telegram internals.

## Non-Goals

- Implementing a normal CE client route for Telegram-only sessions.
- Exposing raw exports to participants.
- Solving SBT/resource parity for normal CE sessions accessible through
  Telegram.
- Publishing question text or group summaries publicly without admin approval.

## Exposure Levels

| Level | Name | Default Telegram participant access | Public layer access | Notes |
| --- | --- | --- | --- | --- |
| 1 | Metrics | Enabled | Enabled when session is public-listed | Counts only, such as submitted questions, responses, and thresholded participants. |
| 2 | Published questions | Admin-controlled | Admin-controlled | Question text appears only after admin approval in a public layer. Telegram participants already see selected session questions. |
| 3 | Aggregate results | Enabled | Admin-controlled | Consensus/divisive aggregate rows. This is the default participant result view. |
| 4 | Anonymized groups | Admin-controlled | Admin-controlled | Group clusters and AI summaries. Requires `resultsExposure.anonymizedGroupsEnabled = true`. |
| 5 | Admin/raw export | Admin only | Never | ZIP/raw records remain restricted to export admins. |

## Current Scope

For now, implement the exposure contract in the Telegram Mini App results view
and results API only. Do not add client-side CE changes for
`/session/<telegram-only-slug>` yet. The normal CE client should continue to
show a `Telegram-only session` notice for Telegram-only sessions.

The Mini App may also offer a local `Demo data` toggle in the Results view and
settings. That toggle should populate aggregate/group result panels and rendered
images with synthetic records only, so operators can inspect the Telegram chat
image format before a session has enough live responses. Demo data must be
marked as demo in API responses and must not be exported as live response data.
It must not reuse the live session's real question prompts or response records;
real results are always the questions and submitted responses actually stored
for the selected session.

The Mini App results surface should stay compact in Telegram WebViews: exposure
level labels are policy metadata, not visible pills. The results panel itself
should be collapsible and start open when a participant opens it. Aggregate
sections should be collapsible, start collapsed, and use response-distribution
bars instead of duplicating numeric consensus/difference labels. Each aggregate
section should page through additional rows with a `More` control until no more
questions are available. Live result filters should also be collapsible and
auto-apply on change so filtered aggregate views do not require a separate
submit step. Rendered PNG/JPEG result images are reserved for Telegram bot
messages; the Mini App should render inline bars and charts instead.

## Policy Shape

Session policy may include:

```json
{
  "sessionSlug": "telegram-demo-3",
  "telegramOnly": true,
  "resultsExposure": {
    "aggregateResultsEnabled": true,
    "anonymizedGroupsEnabled": false,
    "minGroupSize": 2
  }
}
```

Defaults:

- `aggregateResultsEnabled`: `true`
- `anonymizedGroupsEnabled`: `false`
- `minGroupSize`: `2`

Admins can enable level 4 by setting `resultsExposure.anonymizedGroupsEnabled`
to `true` for the session. The Telegram bot also supports a temporary
Cloudflare KV override from the private `Admin Actions` view for configured
export admins. That view can toggle published questions, aggregate results,
and anonymized groups for the selected session without exposing raw exports to
participants. If level 4 is disabled, the Mini App should show that anonymized
groups require admin enablement and should reject group AI analysis requests.

## Snapshot Shape

The Mini App results API should return a `ce_public_results_snapshot` envelope
that can be reused by Agent Village:

```json
{
  "type": "ce_public_results_snapshot",
  "version": 1,
  "audience": "telegram_participant",
  "session": {
    "sessionSlug": "telegram-demo-3",
    "sessionName": "telegram-demo-3",
    "mode": "telegram_only"
  },
  "exposure": {
    "participantLevel": 3,
    "levels": [],
    "redactions": ["telegram_user_ids", "wallet_addresses", "raw_response_records"],
    "minGroupSize": 2
  },
  "counts": {
    "questionsSubmitted": 10,
    "answerableQuestions": 10,
    "responsesGiven": 25,
    "uniqueParticipants": 8,
    "binaryQuestions": 6,
    "aggregateRows": 6
  },
  "aggregateResults": {
    "enabled": true,
    "consensus": [],
    "divisive": []
  },
  "filters": {
    "enabled": true,
    "applied": false,
    "matchedParticipants": null,
    "suppressed": false,
    "selections": {},
    "details": {}
  },
  "anonymizedGroups": {
    "enabled": false,
    "groups": []
  }
}
```

Agent Village should be able to consume the same envelope with
`audience = "public"` later. In that public mode, question text, aggregate rows,
and group summaries should be omitted unless admin-published.

## Privacy Rules

- Never expose Telegram user IDs, wallet addresses, response IDs, or per-user
  answer histories in levels 1-4.
- Use participant aliases only inside level 4, and only when the admin enables
  anonymized groups.
- Suppress or merge groups smaller than `minGroupSize`.
- Freeform responses and additional comments may inform aggregate/group
  summaries, but raw qualitative text should not be displayed publicly unless
  an admin explicitly publishes it.
- Participant counts in a public layer should be thresholded or rounded when a
  session is small.
- Lightweight Telegram-only group memberships may be used as additional
  aggregate segmentation context after the user explicitly saves them in the
  Mini App or updates them through the private bot. They are Cloudflare-managed
  demo metadata, not on-chain SBT claims, until the parity PRD defines a durable
  resource-gating model. Optional country details should be used only for
  aggregate segmentation and must not be exposed as raw participant metadata in
  levels 1-4.
- Mini App live result filters may segment level 3 aggregate results by saved
  lightweight group selections and country details. Filters apply only to real
  live results, not demo data, and must suppress filtered slices below
  `minGroupSize`.
- Mini App group results should render an inline participant-group chart in the
  Groups section, with a lightweight cluster-count control for exploring the
  group split. Group analysis buttons should sit directly below that chart and
  scroll the participant to the analysis output after a group is selected. Group
  analysis remains governed by level 4 exposure rules and the same minimum
  group size threshold.

## Agent Village Compatibility

Agent Village should treat the snapshot as a display artifact, not as a raw CE
session reader. Recommended surfaces:

- A public Forum/Plaza card showing level 1 counts and privacy status.
- Optional admin-published level 2 question list.
- Optional level 3 aggregate result cards.
- Optional level 4 anonymized group summaries once admin-enabled and above
  threshold.

The Context Engine worker remains the authority for redaction and sufficiency
rules. Agent Village should not derive public exposure directly from raw
Telegram submit records.

## Open Questions

- Should level 3 aggregate results require a minimum response threshold before
  they are shown to Telegram participants?
- Should admin publication happen through bot commands, Mini App controls, or
  a separate operator dashboard?
- Should Agent Village cache snapshots, or should it always fetch the latest
  worker-published redacted snapshot?
