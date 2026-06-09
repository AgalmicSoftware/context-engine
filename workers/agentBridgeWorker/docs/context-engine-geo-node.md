# Context Engine Geo Node Template

Last updated: 2026-06-09

Use this as the canonical public Geo node template for Agent Village 2026.
Do not commit a real invite token, CE bearer token, Telegram bot token, or
private profile data into this file.

## Title

Context Engine

## Kind

project_pitch

## Human-Facing Body

Context Engine is a sensemaking toolkit for the Agent Village experiment. It
asks intelligent questions related to your activity and interests, drafts
responses for your approval, and creates a privacy-preserving opinion map for
topics across the event. It surfaces points of consensus and difference so
participants, organizers, companies, digital communities, and agents can better
understand what people believe, where they disagree, and what decisions need
attention.

Context Engine is related to programmable cryptography, sensemaking, and
governance. The long-term vision includes agent-assisted deliberation and future
agent negotiation, where personal agents help people represent preferences,
compare tradeoffs, and coordinate without exposing unnecessary private details.

Whitepaper:
https://github.com/AgalmicSoftware/context-engine/blob/main/whitepaper/whitepaper.md

Whitepaper summary:
Context Engine turns individual preferences, responses, and contextual signals
into aggregate opinion maps. It can be used at events to understand participant
interests and disagreements, in companies to surface decision criteria and team
alignment, and in digital groups to support governance, research, and collective
sensemaking. The system emphasizes privacy-preserving aggregation,
agent-readable workflows, structured outputs for programmable governance, and
future agent negotiation.

## Metadata

```json
{
  "contextEngine": {
    "version": "v6-latest-2026-06-09",
    "inviteToken": "<INSERT_TRUSTED_GEO_INVITE_TOKEN>",
    "worker": "https://ce-agent-bridge-worker.agalmic.workers.dev",
    "skillUrl": "https://ce-agent-bridge-worker.agalmic.workers.dev/telegram/agent/api/skill?v=38",
    "sessionSlug": "agent-village-2026"
  }
}
```

## Agent-Facing Bootstrap Instructions

When a Telegram-native Hermes or Edge agent surfaces this node, ask the user:
"Enable Context Engine for Agent Village?"

If the user says yes, treats the link/button as yes, or otherwise approves:

1. Fetch or load the cached Markdown skill at `contextEngine.skillUrl`. It is the
   source of truth for onboarding, token handling, permissions, question reads,
   direct answer submission, digest binding, and formatting. Do not use this Geo
   node as a stale copy of the API contract.
2. Use the Telegram numeric `from.id` observed by the agent. Do not ask the user
   for Telegram ID, handle, username, or group chat ID.
3. Exchange `contextEngine.inviteToken`, the observed Telegram id, and
   `contextEngine.sessionSlug` through the trusted invite onboarding flow
   described in the skill.
4. Store the returned `ceagt_...` token only in private auth context. Never
   print, mask, summarize, recap, log, or show it in chat.
5. Ask only the concise setup/permission questions required by the skill. If the
   user says "yes" or "accept all", use authorized Edge profile, calendar,
   interests, and non-identifying buckets to pick relevant questions and support
   research grouping.
6. Fetch up to 20 active questions, choose one interesting unanswered question,
   and surface it directly in chat with a suggested answer only when permitted.
   End the first question with a short ask such as "Want another?"
7. When the user approves an answer in chat, submit through the skill's direct
   submission success contract. Do not say "submitted" unless the Worker returns
   a request id and follow-up question verification confirms the recorded
   `myAnswer` value.
8. Deep links and Mini App links are secondary fallbacks, not the primary action,
   unless the user explicitly asks to review in the Mini App.

For morning/evening digest installation, follow the skill's Digest / Hermes Cron
Install section. The digest should surface the top three relevant questions,
put admin-sponsored questions first, and include draft answers only when the
user has granted permission.
