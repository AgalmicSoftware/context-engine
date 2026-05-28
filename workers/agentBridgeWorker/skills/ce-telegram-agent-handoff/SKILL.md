---
name: ce-telegram-agent-handoff
description: Use when an OpenClaw or similar agent needs to onboard a Telegram user into Context Engine, read active CE Telegram questions, draft preference objects for review, or pose questions through the CE Cloudflare worker.
---

# CE Telegram Agent Handoff

Use this skill when acting as an OpenClaw-style agent for a Telegram user who is, or needs to become, a participant in a Telegram-enabled Context Engine session. The worker API is for reading questions, saving drafts, and posing questions; do not submit answers unless a separate user-approved submit path is set in the user's CE settings.

## Install From Public Git

For Hermes, install the skill directly from the public branch:

```bash
hermes skills install https://raw.githubusercontent.com/AgalmicSoftware/context-engine/edge-2026/workers/agentBridgeWorker/skills/ce-telegram-agent-handoff/SKILL.md
```

For agent hosts that support Codex-style local skills:

```bash
CE_SKILL_REF="${CE_SKILL_REF:-edge-2026}" CE_SKILL_HOME="${CODEX_HOME:-$HOME/.codex}/skills/ce-telegram-agent-handoff" sh -c 'mkdir -p "$CE_SKILL_HOME" && curl -fsSL "https://raw.githubusercontent.com/AgalmicSoftware/context-engine/${CE_SKILL_REF}/workers/agentBridgeWorker/skills/ce-telegram-agent-handoff/SKILL.md" -o "$CE_SKILL_HOME/SKILL.md" && printf "Installed CE Telegram Agent Handoff skill to %s\n" "$CE_SKILL_HOME/SKILL.md"'
```

Set `CE_SKILL_REF=main` after the skill lands on the default public branch. After installation, tell the agent to use the `ce-telegram-agent-handoff` skill and ask the user for the copied CE agent install info from the Telegram bot `/start` screen's `Onboard Agent` button.

## Preconditions

- The CE worker base URL is `https://ce-agent-bridge-worker.agalmic.workers.dev` for the current Edge City deployment. Operators may override this with `AGENT_BRIDGE_PUBLIC_URL`.
- Use either a worker service token or a user-scoped agent token.
- For a worker service token, the worker has `AGENT_BRIDGE_AGENT_API_TOKEN` configured. Send `Authorization: Bearer <token>` or `X-CE-Agent-Token: <token>`.
- For a user-scoped agent token, the user opens the CE bot, taps `Onboard Agent`, and copies the full install info. The default expiry is 28 days. Send the token as `Authorization: Bearer <token>`.
- Include `telegramUserId` on every service-token call. When using a user-scoped agent token, CE infers `telegramUserId` and the token-bound session.
- Include `groupChatId` when the agent is acting from a Telegram group. If omitted, the user must already have a private session binding that came from CE bot deep-link onboarding or a joined group.
- Permission currently defaults to Telegram-native group/session binding. SBT or CE resource-gated authoring is not the default yet.

Worked `ceagt_` token smoke test:

```bash
curl -fsS "https://ce-agent-bridge-worker.agalmic.workers.dev/telegram/agent/api/questions?sessionSlug=telegram-demo-4" \
  -H "Authorization: Bearer ceagt_REPLACE_WITH_USER_TOKEN"
```

## Quickstart For Any HTTP-Capable Agent

Use this generic flow for Claude Code, Claude cowork, OpenClaw, Hermes, or any agent that can make HTTPS requests:

1. Ask the user to open the Context Engine bot and tap `Onboard Agent`.
2. The user pastes the copied install info into the agent. Extract `Worker`, `Skill`, `Session`, and the `ceagt_...` token.
3. Call `GET <Worker>/telegram/agent/api/questions?sessionSlug=<Session>` with `Authorization: Bearer <token>`.
4. Ask the user which personal data may be used for this CE flow. Keep the consent choices in your agent memory for this user.
5. Draft responses with `POST <Worker>/telegram/agent/api/preferences`; do not submit answers unless a separate user-approved submit path is set in the user's CE settings.
6. Check `GET <Worker>/telegram/agent/api/actions` to show pending drafts, vote suggestions, and prior agent actions.
7. Use the suggest/review endpoints for votes and group suggestions. Prefer user approval unless the user has explicitly opted into auto-apply behavior.

## Onboarding Options

The preferred low-friction path is a CE bot deep link. A group-question response remains available when the user should enter through a Telegram group that already has CE bot buttons.

### Sensemaking Trial Deep Link

Use the deployment's CE bot start link when the user wants to opt in to the sensemaking trial. The link should open the Context Engine Telegram bot and start the bot flow with `/start`.

Example shape:

```text
https://t.me/contextengineer_bot
```

If the deployment uses a Telegram deep-link payload, use the configured link. The current worker recognizes `sensemaking_trial` and routes it into the same onboarding flow:

```text
https://t.me/contextengineer_bot?start=sensemaking_trial
```

After the user opens the link and starts the bot, CE can create or recover the CE-managed Telegram EVM account, bind the Telegram user to the selected Telegram-only session, and route the user into the private bot or Mini App flow. The `/start` screen includes `Onboard Agent`, which returns a private masked token screen with a copy button for full install info. From then on, use this skill's API calls with the token-bound `sessionSlug`. Include `groupChatId` only when the action is explicitly tied to a Telegram group.

## Non-Telegram Agent Token Flow

Use this path when the user's assistant is not running inside the CE Telegram bot but the user wants it to act against CE on their behalf.

1. Ask the user to open the CE bot and run `/start`.
2. The user taps `Onboard Agent`, then `Copy Agent Install Info`. `/me` also links to account details and activity after onboarding.
3. The user copies the install info into the trusted external agent. The default token expiry is 28 days.
4. The external agent calls CE with `Authorization: Bearer <agent token>`.
5. With a user-scoped token, omit `telegramUserId` unless CE support explicitly asks for it; the worker infers the Telegram account and token-bound session.

Default token scope permits:

- reading active questions
- drafting answers for user review
- recommending and applying question up/down votes
- reading lightweight groups
- proposing lightweight group categories or memberships for user approval
- posing questions for the token-bound session

Default token scope does not permit:

- response export
- admin actions
- wallet/private-key export
- raw response access
- final answer submission unless a separate CE user-approved submit path is enabled

Treat the token like a password. Do not paste it into shared chats, logs, issue trackers, prompts that may be retained by third parties, or public tools.

### Calling CE With A User-Scoped Token

Use this exact auth shape for every worker call:

```http
Authorization: Bearer ceagt_...
Content-Type: application/json
```

With `ceagt_...` tokens:

- include `sessionSlug` in the query string or JSON body;
- omit `telegramUserId` by default, because the worker infers it from the token;
- do not send the token as a URL query parameter, request body field, prompt
  transcript, log line, or shared note;
- do not call admin/export endpoints with this token.

If the worker returns `401` with `reason` equal to `agent_token_expired`,
`agent_token_not_found`, `agent_token_inactive`, or another `agent_token_*`
reason plus `action: "refresh_token_via_telegram"`, stop the CE action and ask
the user to refresh the token in Telegram:

1. Open the Context Engine bot.
2. Run `/start`.
3. Tap `Onboard Agent`.
4. Paste the copied install info back into the trusted agent.

Do not keep retrying an expired token.

Before using personal data, ask the user what may be used in this CE flow. Recommended consent fields:

```json
{
  "allowedProfileFields": ["interests", "sessionsAttended", "roles"],
  "allowedUses": ["rank_questions", "draft_answers", "recommend_votes", "suggest_groups"],
  "forbiddenFields": ["private_notes", "age", "citizenship"],
  "approvalMode": {
    "answers": "draft_for_review",
    "questionVotes": "auto_apply_if_enabled",
    "groups": "suggest_for_review"
  }
}
```

Do not infer or submit demographic group membership from private user data unless the user has explicitly allowed that field and that use. Prefer suggesting groups and linking the user to the Mini App Groups panel for approval.

### Group Question Onboarding

Use this path when the user should become a CE participant by answering one CE question in a Telegram group that already has the CE bot enabled.

1. Direct the user to the Telegram group/thread where the CE bot is present.
2. Ensure the group has selected a CE session. If not, ask a group participant to run `/sessions` and join the intended session. If the session uses an approved Telegram group allowlist or `telegramGroupApprovalRequired`, the group must be approved first. A participant can run `/group_id` in that group and send the numeric chat id to a session admin, or a configured session admin can generate a one-use Add Bot To Group link with `/group_link <session>` and send that link to the group owner.
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

The `GET` endpoint also accepts `tags=<tag-a>,<tag-b>` and `relevanceMode=filter` when the caller only wants tag matches. The default `rank` mode returns all questions sorted by inferred relevance. Use `relevanceMode: "filter"` only when the user wants unrelated questions hidden. Relevance is inferred from explicit question tags, prompt text, selected session metadata, and attended-session hints.

For queue-driven reads, `POST /telegram/agent/api/questions/next` supports `sponsoredFirst` and `includeSponsored` so admin-selected sponsored questions can be served before the general queue.

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

## Review Activity

Use this endpoint as the agent's read surface for previous mutations and pending suggestions:

```http
GET /telegram/agent/api/actions?sessionSlug=<slug>
```

With a `ceagt_` token, the worker scopes results to the token-bound Telegram user and session. The response includes only mutation-oriented records: answer drafts, pending vote recommendations, applied vote decisions, proposed questions, and group suggestions. It does not include pure read calls. Items have this shape:

```json
{
  "type": "answer_draft",
  "sessionSlug": "telegram-demo-4",
  "questionId": "q-binary",
  "createdAt": "2026-05-28T12:00:00.000Z",
  "status": "draft_saved",
  "summary": "Draft: Agree",
  "pendingAction": "review_draft"
}
```

Use this endpoint before prompting the user so you can say what is already pending, what needs approval, and what the agent previously changed. Do not expose activity records in group chats unless the worker has already reduced them to counts.

## Question Cadence

CE does not schedule recurring Telegram prompts for the user. Keep reminder
cadence in the OpenClaw or host-agent layer, where the agent can respect the
user's requested frequency and quiet hours.

When the user has elected to see one question every so often, prefer the
next-question queue endpoint:

```http
POST /telegram/agent/api/questions/next
```

Example request:

```json
{
  "sessionSlug": "telegram-demo-4",
  "queueKey": "daily-ai-governance",
  "criteria": {
    "tags": ["ai-governance"],
    "questionTypes": ["binary"],
    "sponsoredFirst": true
  },
  "preferences": {
    "interests": ["organizer-feedback", "agent-village"]
  }
}
```

The worker returns one `question`, advances a per-user queue cursor by default,
and marks `sponsored: true` when the selected question came from the
admin-configured sponsored queue. Send `advance: false` for preview-only calls,
or `resetQueue: true` when the user asks to restart a cadence. Session admins
can set the sponsored queue from the bot Admin Actions screen or with
`/question_queue 1 3 4`.

Operator agents can also manage that same sponsored queue through the worker:

```http
GET /telegram/agent/api/question-queue
POST /telegram/agent/api/question-queue
```

This is an admin-only route. Use the worker service token, include
`telegramUserId` for a Telegram user whose managed wallet is configured as a
session admin, and send either `sponsoredQuestionIds` / `questionIds` or
`{"clear": true}`. Ordinary user-scoped `ceagt_` tokens cannot call this route.
Question refs may be exact IDs or 1-based candidate numbers from the `GET`
response.

Recommended loop for scheduled prompts:

1. At the user's chosen cadence, call `POST /telegram/agent/api/questions/next`
   with the user's selected criteria.
2. Confirm the returned question is `answerable`; if no question is returned,
   ask whether to broaden criteria or reset the queue.
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
defaults to off and must be opted into by the user. When auto-applied, CE records the vote as
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

## Parked Design Note

Named `/start` deep-link payloads could later drive a permission-preferences onboarding: a short series of yes/no consent questions pre-loaded and served from the worker before any session questions:

1. Can your agent pass preference info to CE to tailor which questions you see?
2. Can your agent share non-identifying demographics for research only, never published in connection to you?
3. Can your agent draft question responses for you based on your activity and user file?
4. Can your agent upvote questions it thinks you will find relevant?

This maps onto the existing consent fields: `allowedProfileFields`, `allowedUses`, `approvalMode`, and `agentAutoApplyQuestionVotes`. This design is parked; the current implemented onboarding is the fixed `Onboard Agent` token handoff.
