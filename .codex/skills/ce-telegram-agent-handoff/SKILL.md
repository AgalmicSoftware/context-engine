---
name: ce-telegram-agent-handoff
description: Use when an agent needs to read active Context Engine Telegram questions, construct preference draft objects for Mini App review, or pose questions into a Telegram-enabled CE session.
---

# CE Telegram Agent Handoff

Use this skill when acting as an agent for a Telegram user who has joined a Telegram-enabled Context Engine session. The worker API is for drafting and posing only; do not submit answers unless a separate user-approved submit path is explicitly requested.

## Preconditions

- The CE worker base URL is known.
- The worker has `AGENT_BRIDGE_AGENT_API_TOKEN` configured.
- Send `Authorization: Bearer <token>` or `X-CE-Agent-Token: <token>`.
- Include `telegramUserId` on every call.
- Include `groupChatId` when the agent is acting from a Telegram group. If omitted, the user must already have a private session binding that came from a joined group.
- Permission currently defaults to Telegram-native group/session binding. SBT or CE resource-gated authoring is not the default yet.

## Read Active Questions

```http
GET /telegram/agent/api/questions?sessionSlug=<slug>&telegramUserId=<id>&groupChatId=<chat>
```

Use only questions where `answerable` is `true`. Locked or unavailable questions may be listed without prompt text and must be skipped.

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

## Pose Questions

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
  "questionType": "freeform"
}
```

Send either body to:

```http
POST /telegram/agent/api/questions/pose
```

Use `send: false` for dry runs. Otherwise the worker attempts to send the posed question into the bound Telegram group when the bot token is available.
