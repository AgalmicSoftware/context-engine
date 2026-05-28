---
name: ce-telegram-agent-handoff
description: Use when an OpenClaw or similar agent needs to onboard a Telegram user into Context Engine, read active CE Telegram questions, draft preference objects for review, or pose questions through the CE Cloudflare worker.
---

# CE Telegram Agent Handoff

Use this skill when acting as an OpenClaw-style agent for a Telegram user who is, or needs to become, a participant in a Telegram-enabled Context Engine session. The worker API is for reading questions, saving drafts, and posing questions; do not submit answers unless a separate user-approved submit path is set in the user's CE settings.

## Preconditions

- The CE worker base URL is known.
- The worker has `AGENT_BRIDGE_AGENT_API_TOKEN` configured.
- Send `Authorization: Bearer <token>` or `X-CE-Agent-Token: <token>`.
- Include `telegramUserId` on every call.
- Include `groupChatId` when the agent is acting from a Telegram group. If omitted, the user must already have a private session binding that came from CE bot deep-link onboarding or a joined group.
- Permission currently defaults to Telegram-native group/session binding. SBT or CE resource-gated authoring is not the default yet.

## Onboarding Options

The preferred low-friction path is a CE bot deep link. A group-question response remains available when the user should enter through a Telegram group that already has CE bot buttons.

### Sensemaking Trial Deep Link

Use the deployment's CE bot start link when the user wants to opt in to the sensemaking trial. The link should open the Context Engine Telegram bot and start the bot flow with `/start`.

Example shape:

```text
https://t.me/contextengineer_bot
```

If the deployment uses a Telegram deep-link payload, use the configured link, for example:

```text
https://t.me/contextengineer_bot?start=sensemaking_trial
```

After the user opens the link and starts the bot, CE can create or recover the CE-managed Telegram EVM account, bind the Telegram user to the selected Telegram-only session, and route the user into the private bot or Mini App flow. From then on, use this skill's API calls with the same `telegramUserId` and `sessionSlug`. Include `groupChatId` only when the action is explicitly tied to a Telegram group.

### Group Question Onboarding

Use this path when the user should become a CE participant by answering one CE question in a Telegram group that already has the CE bot enabled.

1. Direct the user to the Telegram group/thread where the CE bot is present.
2. Ensure the group has selected a CE session. If not, ask a group participant to run `/sessions` and join the intended session.
3. Ask the user to answer any visible CE bot question by tapping a CE inline response button.
4. After the tap, CE can bind `telegramUserId` to the group/session, derive or recover the CE-managed Telegram EVM account, and mark the user as an approved participant for worker calls.
5. From then on, use this skill's API calls with the same `telegramUserId`, `groupChatId`, and `sessionSlug`. For `telegram_only` sessions, a private user who has already joined the session can also use participant-bound question authoring paths.

If the user is only in a one-on-one OpenClaw Telegram DM, send them a CE deep link or group link first. CE-owned inline response buttons cannot appear inside a normal private DM with another bot unless CE sends the message in a CE-accessible chat.

## Read Active Questions

```http
GET /telegram/agent/api/questions?sessionSlug=<slug>&telegramUserId=<id>&groupChatId=<chat>
POST /telegram/agent/api/questions
```

Use only questions where `answerable` is `true`. Locked or unavailable questions may be listed without prompt text and must be skipped. Public question objects include normalized `tags`; use them when deciding relevance.

For personalized question selection, send a POST body with preferences:

```json
{
  "telegramUserId": "42",
  "groupChatId": "-100123",
  "sessionSlug": "telegram-demo-3",
  "relevanceMode": "rank",
  "preferences": {
    "tags": ["ai", "governance"],
    "interests": ["funding"],
    "sessionsAttended": ["edge-city-ai-salon"]
  }
}
```

The default `rank` mode returns all questions sorted by inferred relevance. Use `relevanceMode: "filter"` only when the user wants unrelated questions hidden. Relevance is inferred from explicit question tags, prompt text, selected session metadata, and attended-session hints.

If the user is interacting in an OpenClaw DM, use this endpoint to fetch CE questions, then ask the user in natural language. Save their answer through `POST /telegram/agent/api/preferences` for CE Mini App review. Do not claim the response is submitted.

## Preference Object

Build preferences as drafts keyed by exact `questionId`:

```json
{
  "telegramUserId": "42",
  "groupChatId": "-100123",
  "sessionSlug": "telegram-demo-3",
  "preferences": {
    "requireReview": true,
    "answersByQuestionId": {
      "q-binary": { "value": "agree", "comments": "Optional rationale." },
      "q-rating": { "value": 4, "comments": "Optional rationale." },
      "q-freeform": { "text": "Natural language answer.", "comments": "" },
      "q-choice": { "values": ["Option A"], "comments": "" }
    }
  }
}
```

Supported answer shapes:

- `binary`: `value` is `agree`, `unsure`, or `disagree`.
- `rating`: `value` is a number.
- `freeform`: `text` is the answer body.
- `multichoice`: `values` is an array of selected option labels.

Draft the preferences:

```http
POST /telegram/agent/api/preferences
```

The response reports `draftCount` and `skipped`. Send the user to the Mini App for review after drafts are saved.

## Question Cadence

CE does not schedule recurring Telegram prompts for the user. Keep reminder
cadence in the OpenClaw or host-agent layer, where the agent can respect the
user's requested frequency and quiet hours.

Recommended loop for scheduled prompts:

1. At the user's chosen cadence, call `GET /telegram/agent/api/questions`.
2. Filter to relevant `answerable` questions.
3. Ask one or a small batch in the OpenClaw conversation, or call
   `POST /telegram/agent/api/questions/pose` when the question should appear in
   the CE-bound Telegram group.
4. Save the user's natural-language answers as drafts with
   `POST /telegram/agent/api/preferences`.
5. Send the user to the CE Mini App for review and final submission.

Do not make CE-specific reminder promises from worker settings. Scheduling,
retry cadence, notification quiet hours, and "ask me later" behavior belong in
the agent scheduler until CE owns a dedicated notification service.

## Pose Questions

Use tags within the current overall session to distinguish topics, events, tracks, or agent-originated themes. Do not create child sessions for this flow.

Pose an existing active question:

```json
{
  "telegramUserId": "42",
  "groupChatId": "-100123",
  "sessionSlug": "telegram-demo-3",
  "questionId": "q-binary"
}
```

Create and pose a new freeform question:

```json
{
  "telegramUserId": "42",
  "groupChatId": "-100123",
  "sessionSlug": "telegram-demo-3",
  "prompt": "What should the group decide next?",
  "questionType": "freeform",
  "tags": ["governance", "agent-village"],
  "sessionContext": "Short public context that helps CE format and tag the question."
}
```

Send either body to:

```http
POST /telegram/agent/api/questions/pose
```

Use `send: false` for dry runs. Otherwise the worker attempts to send the posed question into the bound Telegram group when the bot token is available.

## Agent Question Importance Votes

To ask CE which active questions seem most important for a user, call:

```http
POST /telegram/agent/api/question-votes/recommend
```

Example:

```json
{
  "telegramUserId": "42",
  "groupChatId": "-100123",
  "sessionSlug": "telegram-demo-3",
  "preferences": {
    "interests": ["food", "governance"],
    "attendedSessions": ["agent-village"]
  },
  "agent": {
    "id": "hermes-1",
    "name": "Hermes",
    "model": "model-name"
  },
  "metadata": {
    "runId": "agent-run-id",
    "source": "openclaw"
  }
}
```

The response includes a `metaQuestion`, relevance fields, and
`recommendations[]` with `questionId`, `suggestedVote` (`up` or `down`),
`confidence`, `reason`, and `agentNote`.

If you want the agent to auto-apply these question up/down votes, pass
`"autoApply": true`. Auto-apply is controlled by the user's Mini App setting
`agentAutoApplyQuestionVotes`, scoped to the Telegram account and session; it
defaults to enabled for now. When auto-applied, CE records the vote as
`agent_auto_applied_pending_human_review` so later human approval or override
can be distinguished.

To submit the user's natural-language approval or override, call:

```http
POST /telegram/agent/api/question-votes/apply
```

Example:

```json
{
  "telegramUserId": "42",
  "groupChatId": "-100123",
  "sessionSlug": "telegram-demo-3",
  "approvalText": "Approve q-pizza, but change q-budget to downvote.",
  "recommendations": [
    { "questionId": "q-pizza", "suggestedVote": "up" },
    { "questionId": "q-budget", "suggestedVote": "up" }
  ],
  "decisions": [
    { "questionId": "q-pizza", "suggestedVote": "up", "approved": true },
    { "questionId": "q-budget", "suggestedVote": "up", "finalVote": "down", "approved": true }
  ],
  "metadata": {
    "runId": "agent-run-id"
  }
}
```

Always include non-secret metadata that helps research later distinguish agent
suggestions from human overrides, such as `runId`, agent name/model, source
surface, and preference tags used. Never include API keys, bearer tokens, raw
private keys, or hidden chain/session credentials.

## OpenClaw DM Fallback

In a one-on-one Telegram DM between the user and an OpenClaw bot:

- The OpenClaw agent can ask CE questions in natural language.
- The OpenClaw agent can collect the user's answer as plain text.
- The OpenClaw agent should save answers as CE drafts with `POST /telegram/agent/api/preferences`.
- CE-owned inline response buttons are not available inside that DM unless the CE bot is the sender or the chat is shared with CE.
- If the OpenClaw Telegram integration has its own bot token, OpenClaw may render its own inline buttons and forward button callbacks to CE as preference drafts. Those buttons are OpenClaw-owned, not CE-owned.
- If OpenClaw has no associated Telegram bot or client integration, it cannot render Telegram-native buttons; it can only produce text or links through whatever host channel is available.

Prefer the shared-group pattern when CE-owned response buttons matter:

1. User + OpenClaw bot + CE bot are present in one group or topic.
2. OpenClaw calls `POST /telegram/agent/api/questions/pose`.
3. CE bot posts the question with CE response buttons.
4. User taps the CE button, and CE handles the callback.

## Lightweight Telegram Groups

Telegram-only sessions may expose Cloudflare-managed group categories without
on-chain SBTs. Groups are optional user self-selections and must not be treated
as submitted until the user approves them.

Read available group categories and current selections:

```http
GET /telegram/agent/api/groups?sessionSlug=<slug>&telegramUserId=<id>&groupChatId=<chat>
```

Propose or create a group category, while leaving membership to the user:

```http
POST /telegram/agent/api/groups/propose
```

```json
{
  "telegramUserId": "42",
  "groupChatId": "-100123",
  "sessionSlug": "telegram-demo-3",
  "category": {
    "categoryId": "ai_tribe",
    "label": "AI tribe",
    "selectionMode": "single",
    "options": [
      { "optionId": "e_acc", "label": "e/acc" },
      { "optionId": "d_acc", "label": "d/acc" },
      { "optionId": "pause_ai", "label": "Pause AI" }
    ]
  },
  "optionIds": ["e_acc"],
  "message": "Consider joining the e/acc group for this session."
}
```

The response includes `requiresUserApproval: true`. Direct the user to the Mini
App Groups panel or the private bot `/groups` command to review memberships.
Mini App country relationship choices can include country details for `live in`
and `citizen of`; do not infer or submit those details without user approval.

## Tags Instead Of Child Sessions

Do not create worker-local child sessions for now. They are too complex for the
current Telegram-only operating mode.

Keep users, questions, generated prompts, and agent-originated themes inside
one overall Telegram-only session. Use question tags and session context to
represent subtopics such as events, tracks, rooms, cohorts, or source material.
When an agent needs a new topical lane, create or reuse a tag, then pose or
draft questions with that tag.
