# Context Engine Geo Node Template

Last updated: 2026-06-16

Use this as the canonical public Geo node template for Session Wrapped.
Do not commit a real invite token, CE bearer token, Telegram bot token, or
private profile data into this file.

## Title

Context Engine (Onboarding - 2026-06-16)

## Kind

project_pitch

## Human-Facing Body

Session Wrapped is a Context Engine experiment where your agent predicts
how you would answer research questions, what questions you would care about
most, and what those predictions say about your preferences. It produces a
shareable Wrapped image and lets you review or edit the predictions in the
Context Engine Telegram Mini App.

Context Engine turns individual preferences, responses, and contextual signals
into aggregate opinion maps. It surfaces points of consensus and difference so
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
    "skillUrl": "https://ce-agent-bridge-worker.agalmic.workers.dev/telegram/agent/api/skill?v=41",
    "sessionSlug": "session-wrapped"
  }
}
```

## Agent-Facing Bootstrap Instructions

When a Telegram-native Hermes or Edge agent surfaces this node, use these
defaults unless the user explicitly changes them before launch:

- EdgeOS Read Permission: Yes.
- Standard Session Wrapped image: Yes.
- Optional Agent Norms Compass meme: ask after the Wrapped image.

Treat "run Session Wrapped", clicking the node/link, or equivalent user
intent as approval to continue with these defaults.

Then:

1. Fetch or load the cached Markdown skill at `contextEngine.skillUrl`. It is the
   source of truth for Agent Only Mode, token handling, prediction submission,
   Wrapped image generation, and formatting. Do not use this Geo node as a
   stale copy of the API contract.
2. Use the Telegram numeric `from.id` observed by the agent. Do not ask the user
   for Telegram ID, handle, username, or group chat ID.
3. Exchange `contextEngine.inviteToken`, the observed Telegram id, and
   `contextEngine.sessionSlug` through the trusted invite onboarding flow
   described in the skill, with request body field `"mode": "agent_only"`.
4. Store the returned `ceagt_...` token only in private auth context. Never
   print, mask, summarize, recap, log, or show it in chat.
5. Do not ask an extra EdgeOS permission question when this node or the
   run prompt already says `EdgeOS Read Permission: Yes`. Use authorized
   EdgeOS profile, memory, interests, and non-identifying buckets only as
   high-level, non-sensitive context to improve predictions. If the user
   changes that setting to No, do not use profile data. Answer unavailable
   usage-style questions as `N/A` rather than hallucinating.
6. Fetch `/telegram/agent/api/agent-only/start` from `contextEngine.worker` and
   follow the returned instructions exactly. Page through statements, submit
   predicted answers for every current statement, submit both token allocation
   modes, then generate the standard Session Wrapped image.
7. Render or display the Wrapped image when the environment supports images. Do
   not print raw image prompts, base64 payloads, confidences, rationales, or
   private memory. After the image, link the text "Context Engine Bot" to
   `https://t.me/contextengineer_bot?start=agent_onboarding__session-wrapped`
   so the user can open the bot directly, tap Open Mini App to review or edit
   predictions, and decide whether they want the optional Agent Norms Compass
   meme.
8. Do not use the ordinary `/questions`, draft, direct answer, question vote, or
   question creation flow for Session Wrapped unless the user explicitly
   asks for regular Context Engine outside this mode.
