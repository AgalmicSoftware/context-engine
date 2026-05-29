---
name: ce-telegram-agent-handoff
description: Use when a Hermes, OpenClaw, Claude Code, or other similar agent needs to onboard a Telegram user into Context Engine, read active CE Telegram questions, draft preference objects for review, or pose questions through the CE Cloudflare worker.
---

# CE Telegram Agent Handoff

**Skill version:** 2026-05-30 (v5)

Use this skill when acting as a Hermes, OpenClaw, Claude Code, or similar agent for a Telegram user who is, or needs to become, a participant in a Telegram-enabled Context Engine session. The worker API is for reading questions, saving drafts, and posing questions; do not submit answers unless a separate user-approved submit path is set in the user's CE settings.

## What Context Engine Does

When a user asks what Context Engine is or what this integration can do, answer
in practical terms:

- CE turns loose natural-language preferences into structured question
  responses that the user can review before they are saved or submitted.
- CE can fetch the active questions for a Telegram-first session and help the
  user's agent decide which questions are relevant based on interests, tags,
  attended sessions, and consented personal context.
- CE can draft answers from ordinary conversation. For example, if the user says
  "I care more about privacy than convenience," the agent can map that into
  candidate answers for relevant agree/disagree, rating, freeform, or
  multichoice questions and ask the user to approve or edit them.
- CE can turn a user's natural-language idea into new questions for a session.
  For example, "ask people whether the organizer recap should happen daily" can
  become a binary question, while "ask which format people prefer" can become a
  multichoice question with options.
- CE can rank, filter, upvote, or downvote questions based on what the user says
  they care about. Auto-applying votes is opt-in; otherwise the agent should
  show suggestions and ask for approval.
- CE can show the user pending drafts, vote suggestions, proposed questions, and
  previous agent actions so the user can understand and override the agent's
  choices.
- CE can read aggregate session results, including a topic-map circles view of
  answered question themes, without exposing raw response records.
- CE can help admins sponsor important questions. Admin agents should first plan
  the sponsored-question change, show the exact questions to the admin, and only
  apply it after explicit confirmation.

Do not describe CE as a generic survey form. The core value is converting
natural language and user context into reviewable, structured sensemaking
actions: answer drafts, relevant-question queues, question proposals, and
admin-curated priority questions.

## Install From Public Git

For Hermes, install the skill directly from the public branch:

```bash
hermes skills install https://raw.githubusercontent.com/AgalmicSoftware/context-engine/edge-2026/workers/agentBridgeWorker/skills/ce-telegram-agent-handoff/SKILL.md
```

For agent hosts that support Codex-style local skills:

```bash
CE_SKILL_REF="${CE_SKILL_REF:-edge-2026}" CE_SKILL_HOME="${CODEX_HOME:-$HOME/.codex}/skills/ce-telegram-agent-handoff" sh -c 'mkdir -p "$CE_SKILL_HOME" && curl -fsSL "https://raw.githubusercontent.com/AgalmicSoftware/context-engine/${CE_SKILL_REF}/workers/agentBridgeWorker/skills/ce-telegram-agent-handoff/SKILL.md" -o "$CE_SKILL_HOME/SKILL.md" && printf "Installed CE Telegram Agent Handoff skill to %s\n" "$CE_SKILL_HOME/SKILL.md"'
```

Set `CE_SKILL_REF=main` after the skill lands on the default public branch.

### Install Lookup Via Geo Node

When the user says "install context engine", first query the relevant Geo node
with the agent's own Geo/EDGE tools for the current CE install command or skill
reference. If the Geo node returns an install command, use it. If Geo is
unavailable or has no command, fall back to the canonical public Git install
command in this section. The CE worker never performs this lookup and never
proxies Geo/EDGE_OS credentials.

### Claude Code First Run

If the user pastes the install command into Claude Code, install this skill and
then tell the user to open this Telegram onboarding link:

```text
https://t.me/contextengineer_bot?start=agent_onboarding
```

If the session slug is known, use the session-specific form:

```text
https://t.me/contextengineer_bot?start=agent_onboarding__<session-slug>
```

After the user taps `Start`, Telegram should land directly on the private
agent install screen. Ask the user to tap `Copy Agent Info` and paste
the copied install info back into Claude Code. Do not call the CE worker until
the pasted install info provides a `ceagt_...` token, worker URL, and skill URL
(either as `worker=...` / `skill=...` fields or line-separated URLs).

## Staying Up To Date

At the start of a CE session, when the user asks, or after an unexpected API
error, check the worker's current skill version:

```http
GET /telegram/agent/api/skill-version
```

Compare the returned `version` with the `Skill version` line above. The
endpoint also returns `updateAvailable`, `latestVersion`, and `updateNote`.
Normal question reads include `skillVersion` and `skillUpdateAvailable` too. If
`skillUpdateAvailable` is true or the worker reports a newer version than this
file's header, re-run the install command using the configured `CE_SKILL_REF`
raw GitHub URL, then re-read the changelog before continuing.

## Preconditions

- The CE worker base URL is `https://ce-agent-bridge-worker.agalmic.workers.dev` for the current Edge City deployment. Operators may override this with `AGENT_BRIDGE_PUBLIC_URL`.
- Use either a worker service token or a user-scoped agent token.
- For a worker service token, the worker has `AGENT_BRIDGE_AGENT_API_TOKEN` configured. Send `Authorization: Bearer <token>` or `X-CE-Agent-Token: <token>`.
- For a user-scoped agent token, the user opens the CE bot, taps `Onboard Agent`, and copies the full install info. The default expiry is 28 days. Send the token as `Authorization: Bearer <token>`.
- Include `telegramUserId` on every service-token call. When using a user-scoped agent token, CE infers `telegramUserId`. The token is not locked to one session; if you omit `sessionSlug`, CE uses the user's selected session or the current worker default.
- Include `groupChatId` when the agent is acting from a Telegram group. If omitted, the user must already have a private session binding that came from CE bot deep-link onboarding or a joined group.
- Permission currently defaults to Telegram-native group/session binding. SBT or CE resource-gated authoring is not the default yet.
- Current Edge 2026 demo sessions may include the default `Research Questions (Demo)` session for organizers plus participant sessions. Operators can stop surfacing older smoke-test sessions by moving `AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER` forward; agents should not rely on older sessions always being listed. A `ceagt_` token follows the user's selected session. To switch sessions, send `sessionSlug=<existing-slug>` on a worker call; CE validates the slug and pins it for later omitted-slug calls.

Worked `ceagt_` token smoke test:

```bash
curl -fsS "https://ce-agent-bridge-worker.agalmic.workers.dev/telegram/agent/api/questions?sessionSlug=ee-26-organizers" \
  -H "Authorization: Bearer ceagt_REPLACE_WITH_USER_TOKEN"
```

## Quickstart For Any HTTP-Capable Agent

Use this generic flow for Claude Code, Claude cowork, OpenClaw, Hermes, or any agent that can make HTTPS requests:

1. Ask the user to open `https://t.me/contextengineer_bot?start=agent_onboarding` (or `https://t.me/contextengineer_bot?start=agent_onboarding__<session-slug>` when the session is known).
2. The user pastes the copied install info into the agent. Extract `Worker`, `Skill`, and the `ceagt_...` token. There may be no `Session` field; that is expected.
3. Call `GET <Worker>/telegram/agent/api/onboarding` with `Authorization: Bearer <token>`. Add `?sessionSlug=<existing-slug>` only when the user or event context explicitly chooses a session. If the consent questions are incomplete, ask them before fetching session questions, then persist the user's choices with `POST <Worker>/telegram/agent/api/onboarding`.
4. Call `GET <Worker>/telegram/agent/api/questions` with `Authorization: Bearer <token>`, adding `sessionSlug` only when intentionally switching or targeting a specific session.
5. Pick up to 10 answerable questions most relevant to the user. If memory is enabled and consented, use it to rank; otherwise use current conversation context, question tags, and session context.
6. Draft responses, show the proposed answers, and ask for confirmation.
7. Save confirmed drafts with `POST <Worker>/telegram/agent/api/preferences`; do not submit answers unless a separate user-approved submit path is set in the user's CE settings.
8. When you have a reviewed sequence of questions, call `POST <Worker>/telegram/agent/api/mini-app-launch` to create a one-click Mini App link with the ordered questions and editable prefilled drafts.
9. Check `GET <Worker>/telegram/agent/api/actions` to show pending drafts, vote suggestions, and prior agent actions.
10. Check `GET <Worker>/telegram/agent/api/results?view=topic-map` when the user asks what the session is about or wants a graphical aggregate result.
11. For an interactive report, give the user a private client auto-login link built from their copied `ceagt_` token.
12. Use the suggest/review endpoints for votes and group suggestions. Prefer user approval unless the user has explicitly opted into auto-apply behavior.

## Onboarding Options

The preferred low-friction path is a CE bot deep link. A group-question response remains available when the user should enter through a Telegram group that already has CE bot buttons.

### Direct Link Mini App Onboarding

When a group message shows `Onboard Agent (Mini App)`, tapping it opens a
private per-tapper Telegram Mini App page. That page must send Telegram's raw
`window.Telegram.WebApp.initData` to:

```http
POST /telegram/agent/api/miniapp/onboard
```

The worker validates the Telegram initData server-side and returns that user's
own `ceagt_...` token, worker URL, session slug, expiry, and skill name. The
token is never written into the shared group message. The DM deep-link
`Onboard Agent` path remains available as the fallback when the Direct Link Mini
App short name is not configured.

### Sensemaking Trial Deep Link

Use the deployment's CE bot start link when the user wants to opt in to the sensemaking trial. The link should open the Context Engine Telegram bot and start the bot flow with `/start`.

The current worker recognizes these onboarding payloads and routes them to the
private copy screen:

```text
https://t.me/contextengineer_bot?start=agent_onboarding
https://t.me/contextengineer_bot?start=agent_onboarding__<session-slug>
```

After the user opens the link and starts the bot, CE can create or recover the CE-managed Telegram EVM account and render a private masked token screen with a copy button for full install info. Generic onboarding follows the live worker default session. Session-specific onboarding pins the named session. From then on, use this skill's API calls with the copied token; omit `sessionSlug` for the user's current/default session, or include an existing `sessionSlug` to switch and pin the user. Include `groupChatId` only when the action is explicitly tied to a Telegram group.

## Prepopulated Deep Links On First Invocation

When a user first asks CE about deliberation, governance, sensemaking, community
discussion, or "what questions are there?", proactively offer a small labeled
menu of deep-link sets.

1. Seed topics from the user's authorized profile, bio, interests, and recent
   activity. Use only fields the user allowed during onboarding consent.
2. Choose matching tags and geoIDs from that context. For geoIDs, the agent uses
   its own Geo tools; the CE worker does not call Geo.
3. Fetch active questions with the existing tag-filtered question reads and the
   geo-linked question flow. Respect `questionsPerBatch` from the user's
   settings, defaulting to 3.
4. Build one Mini App `startapp` link or private token-authenticated client link per
   topic cluster using the link builders already described in "Mini App
   Question Links" and "Interactive Client Report".
5. Present the links as a short menu the user can choose from.

Useful organizer/tester labels include:

- "Participant Survey Topics"
- "Index Network Questions" (`index`, `meetings`)
- "Agent Village Experiment questions"

Example shapes, using existing link builders only:

```text
https://t.me/contextengineer_bot/<mini-app-short-name>?startapp=<payload-from-mini-app-launch>
https://contextengine.xyz/session/<session-slug>/questions/results?telegramToken=<urlencoded-ceagt-token>&agentBridgeUrl=<urlencoded-worker-url>
```

This flow composes existing tags, questions, geo-linked questions, Mini App
launches, and client links. Do not invent a new CE endpoint for it.

## Non-Telegram Agent Token Flow

Use this path when the user's assistant is not running inside the CE Telegram bot but the user wants it to act against CE on their behalf.

1. Ask the user to open the CE bot and run `/start`.
2. The user taps `Onboard Agent`, then `Copy Agent Info`. `/me` also links to account details and activity after onboarding.
3. The user copies the install info into the trusted external agent. The default token expiry is 28 days.
4. The external agent calls CE with `Authorization: Bearer <agent token>`.
5. With a user-scoped token, omit `telegramUserId` unless CE support explicitly asks for it; the worker infers the Telegram account and current session. To switch, pass `sessionSlug=<existing-slug>` once; omitted-slug calls stay on that pinned session until the user changes it again.

Default token scope permits:

- reading active questions
- drafting answers for user review
- recommending and applying question up/down votes
- reading aggregate result views such as the topic map
- reading lightweight groups
- proposing lightweight group categories or memberships for user approval
- posing questions for the current or explicitly selected session

Default token scope does not permit:

- response export
- broad admin actions such as response export allowlist management
- Telegram group approval link management
- wallet/private-key export
- raw response access
- final answer submission unless a separate CE user-approved submit path is enabled

If the user is a session admin, the same `ceagt_...` token can check its own
admin status and manage sponsored questions through the confirmation-gated
routes documented in Question Cadence. Do not assume admin capability; check it.

Treat the token like a password. Do not paste it into shared chats, logs, issue trackers, prompts that may be retained by third parties, or public tools.

### Calling CE With A User-Scoped Token

Use this exact auth shape for every worker call:

```http
Authorization: Bearer ceagt_...
Content-Type: application/json
```

With `ceagt_...` tokens:

- omit `sessionSlug` to use the user's selected session or the current worker default;
- include `sessionSlug` in the query string or JSON body only when the user wants to switch to a specific existing session;
- omit `telegramUserId` by default, because the worker infers it from the token;
- do not send the token as a URL query parameter, request body field, prompt
  transcript, log line, or shared note;
- do not call export, raw-response, wallet/private-key, or broad admin endpoints
  with this token. The sponsored-question admin-status/plan/apply routes are
  allowed only when `GET /telegram/agent/api/admin/status` confirms the user is
  a session admin, and `apply` still requires explicit admin approval.

If the worker returns `401` with `reason` equal to `agent_token_expired`,
`agent_token_not_found`, `agent_token_inactive`, or another `agent_token_*`
reason plus `action: "refresh_token_via_telegram"`, stop the CE action and ask
the user to refresh the token in Telegram:

1. Open the Context Engine bot.
2. Run `/start`.
3. Tap `Onboard Agent`.
4. Paste the copied install info back into the trusted agent.

Do not keep retrying an expired token.

Before using personal data, ask the user what may be used in this CE flow. The
worker exposes a first-run onboarding endpoint for this:

```http
GET /telegram/agent/api/onboarding
POST /telegram/agent/api/onboarding
```

`GET` returns the fixed first-run consent questions and any saved answers. `POST`
persists the answers for the token's Telegram user and current session. Defaults
are privacy-preserving: all consent is off until the user explicitly answers.
Ask the user what topics they want CE to prioritize, such as AI futures, Edge
City, governance, infra, social, art, or sessions they attended. Treat this as
opt-in: if the user says yes to preference tailoring, the agent may read the
authorized parts of the user's Edge profile and activity to choose questions.
If they do not opt in, use only the current conversation and public session
context. Persist approved topics as `topicPreferences` in the onboarding POST
body. The current questions map to these settings:

```json
{
  "topicPreferences": ["ai-futures", "edge-city"],
  "allowedProfileFields": ["interests", "sessions_attended", "roles", "edge_bio_keywords", "age_bucket", "country", "region", "edge_attendance"],
  "allowedUses": ["rank_questions", "draft_answers", "recommend_votes", "suggest_groups", "link_demographics_research", "link_attendance_context", "research_draft_divergence"],
  "forbiddenFields": ["private_notes", "age", "citizenship", "raw_geo_private_data"],
  "demographicLinkOptIn": false,
  "attendanceLinkOptIn": false,
  "draftDivergenceOptIn": false,
  "approvalMode": {
    "answers": "draft_for_review",
    "questionVotes": "auto_apply_if_enabled",
    "groups": "suggest_for_review"
  },
  "groups": {
    "selections": {
      "events_attended": ["week_1", "attended_previous_edge_events"],
      "region": ["north_america"],
      "contribution_role": ["organizer"]
    },
    "details": {
      "contribution_role": { "other": "community research" }
    }
  }
}
```

The onboarding endpoint also persists `dailyDigestOptIn` for future Edge daily
digest integrations. It also stores `topicPreferences`,
`demographicLinkOptIn`, `attendanceLinkOptIn`, and `draftDivergenceOptIn`.
Demographic linking is default-off; only when the user opts in may the agent
link otherwise anonymous responses to approved aggregate buckets such as Edge
Bio keywords, age bucket, country, or region. Attendance linking is also
default-off; only when the user opts in may the agent pass Edge attendance
buckets such as Week 1, Week 2, Week 3, Week 4, Entire Month, or Attended
Previous Edge Events to CE. These attendance buckets are associated with the
user's answers for aggregate analysis, not published as the user's identity.
Draft-divergence research is also default-off; unless the user opts in, do not
send agent-drafted answers to the worker as durable research records. A Mini
App launch may still carry an editable prefill draft for review, but that is a
short-lived launch artifact rather than a draft-divergence research record.

When the user answers yes to demographic or attendance linking and provides
explicit bucket choices, include those choices under `groups.selections` in the
onboarding POST. Positive consent writes aggregate bucket memberships such as
attendance, age bucket, region, AI tribe, or role. Explain plainly: these
buckets are associated with their answers for aggregate research and filtering,
not published under their name. Do not infer or submit demographic group
membership from private user data unless the user has explicitly allowed that
field and that use. Prefer suggesting groups and linking the user to the Mini
App Groups panel for approval.

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

Use only questions where `answerable` is `true`. Locked or unavailable questions may be listed without prompt text and must be skipped. Public question objects include normalized `tags` and, when present, `geoRefs`; use them when deciding relevance.

For personalized question selection, send a POST body with preferences:

```json
{
  "telegramUserId": "42",
  "groupChatId": "-100123",
  "sessionSlug": "ee-26-organizers",
  "relevanceMode": "rank",
  "preferences": {
    "tags": ["ai", "governance"],
    "interests": ["funding"],
    "attendance": ["week_1", "attended_previous_edge_events"]
  }
}
```

The `GET` endpoint also accepts `tags=<tag-a>,<tag-b>` and `relevanceMode=filter` when the caller only wants tag matches. Use `tags=geo:<geoId>&relevanceMode=filter` to find questions already linked to a Geo node. The default `rank` mode returns all questions sorted by inferred relevance. Use `relevanceMode: "filter"` only when the user wants unrelated questions hidden. Relevance is inferred from explicit question tags, prompt text, selected session metadata, and attended-session hints.

For queue-driven reads, `POST /telegram/agent/api/questions/next` supports `sponsoredFirst` and `includeSponsored` so admin-selected sponsored questions can be served before the general queue.

If the user is interacting in an OpenClaw DM, use this endpoint to fetch CE questions, then ask the user in natural language. Save their answer through `POST /telegram/agent/api/preferences` for CE Mini App review. Do not claim the response is submitted.

## Tags: Reuse Before You Invent

Before generating or creating questions, pull the tags already active in the
session:

```http
GET /telegram/agent/api/tags?sessionSlug=<slug>
POST /telegram/agent/api/tags
```

The response is text-safe metadata only:

```json
{
  "ok": true,
  "sessionSlug": "ee-26-organizers",
  "tags": [
    { "tag": "organizer-feedback", "count": 6 },
    { "tag": "src:example-org", "count": 3 }
  ],
  "total": 2
}
```

Prefer an existing tag when one fits the user's intent. Create a new short,
topic-like tag only when the current list has no good match. This applies to
URL-based question generation, future geographic/topic generation, and any
agent-authored questions. It keeps the one-session-by-tags model navigable in
the Mini App. See also "Tags Instead Of Child Sessions" below.

If `sessionSlug` is omitted, the worker uses the current default session. If an
agent sends an explicit unrecognized `sessionSlug`, treat the 404 as a typo or
stale session name and ask the user/operator for the correct session rather
than silently continuing.

## Preference Object

Build preferences as drafts keyed by exact `questionId`:

```json
{
  "telegramUserId": "42",
  "groupChatId": "-100123",
  "sessionSlug": "ee-26-organizers",
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

### Writing Good Additional Comments

`comments` is optional, but valuable when it adds a genuine, specific contribution. Add one when the user has:

- A meta-comment on the question itself, such as leading framing, conflated ideas, or an undefined key term.
- A premise challenge, such as "this assumes X, but in my context X does not hold because ...".
- Nuance or a conditional, such as agreeing for new users but disagreeing for power users.
- A missing option or false binary that changes how the answer should be interpreted.
- Ambiguity that materially changes the response.
- A concrete data point, counterexample, or lived-experience detail that explains the stance.

Avoid restating the chosen answer, generic praise or filler, comments longer than about 1-3 sentences, and private or identifying details the user has not authorized.

Draft the preferences:

```http
POST /telegram/agent/api/preferences
```

The response reports `draftCount` and `skipped`. Send the user to the Mini App for review after drafts are saved.

## Mini App Question Links

After the user confirms drafted answers, create a Mini App launch link when the
next step should be editable review inside Telegram:

```http
POST /telegram/agent/api/mini-app-launch
```

```json
{
  "sessionSlug": "ee-26-organizers",
  "questionIds": ["q-freeform", "q-binary"],
  "skippedQuestionIds": [],
  "draftAnswersByQuestionId": {
    "q-freeform": { "text": "Editable draft answer." },
    "q-binary": { "value": "agree", "comments": "Optional rationale." }
  }
}
```

The worker resolves the question references against the current or explicitly selected session,
stores an expiring Mini App launch record, and returns `link`, usually in the
`https://t.me/<bot>/<mini-app-short-name>?startapp=<payload>` form. Send that
link to the user. The Mini App opens the ordered series, pre-fills each draft
without marking it as submitted, lets the user edit manually, use microphone
dictation/transcription in the WebView, submit, or skip to the next question.
If WebView audio is unreliable, the user can send a native Telegram voice
message in the private DM after opening a Mini App question link; the bot
transcribes it through the session worker and appends it to the latest Mini App
draft for review. The CE worker does not silently submit these answers.

## Review Activity

Use this endpoint as the agent's read surface for previous mutations and pending suggestions:

```http
GET /telegram/agent/api/actions?sessionSlug=<slug>
```

With a `ceagt_` token, the worker scopes results to the token's Telegram user and the current or explicitly selected session. The response includes only mutation-oriented records: answer drafts, pending vote recommendations, applied vote decisions, proposed questions, and group suggestions. It does not include pure read calls. Items have this shape:

```json
{
  "type": "answer_draft",
  "sessionSlug": "ee-26-organizers",
  "questionId": "q-binary",
  "createdAt": "2026-05-28T12:00:00.000Z",
  "status": "draft_saved",
  "summary": "Draft: Agree",
  "pendingAction": "review_draft"
}
```

Use this endpoint before prompting the user so you can say what is already pending, what needs approval, and what the agent previously changed. Do not expose activity records in group chats unless the worker has already reduced them to counts.

## Generate Questions From A URL

When the user says "generate questions about <URL>" or similar, the agent
fetches and summarizes the URL with its own tools. The worker does not fetch the
URL. Draft about five candidate questions by default, show them to the user,
and only create the approved questions.

Before generating, pull the session's active tags and reuse existing tags where
they fit:

```http
GET /telegram/agent/api/tags?sessionSlug=<slug>
```

After approval, create the questions as proposed questions:

```http
POST /telegram/agent/api/questions/create
```

Example body:

```json
{
  "sessionSlug": "ee-26-organizers",
  "sourceUrl": "https://example.org/source-note",
  "questions": [
    {
      "prompt": "Should organizers publish a daily Agent Village recap?",
      "questionType": "binary",
      "tags": ["organizer-feedback"]
    }
  ]
}
```

The worker validates and persists the approved questions, adds a host-derived
`src:<host>` tag for navigation, and stores the URL as a structured
`references` citation on each question. Created questions are proposed only; use
the normal pose/surfacing flow later if the user wants them posted into a
Telegram group. The create endpoint accepts batches up to 20 questions. If an
organizer gives you 50 tagged questions, send three create calls such as
20 + 20 + 10. They will be stored as proposed off-chain Cloudflare questions
for the session and should appear in the Mini App and `/questions`. Never
auto-create questions before the user approves the exact list.

## Geo Digest And Geo-Linked Questions

The CE worker does not call Geo/EDGE_OS, does not store an `EDGEOS_BEARER_TOKEN`,
and does not fetch Geo node content. A Geo-capable agent should use its own Geo
tools and credentials, then pass only public node references into CE.

When a user mentions a topic that maps to a Geo node:

1. Look up existing CE questions for that node:

```http
GET /telegram/agent/api/questions?sessionSlug=<slug>&tags=geo:<geoId>&relevanceMode=filter
```

2. If a matching answerable question exists, phrase the user's natural-language
   input as an editable draft response and save it with
   `POST /telegram/agent/api/preferences`.
3. If no good question exists and the topic is worth discussion, draft a short
   CE question, show the exact question to the user/admin, and only create it
   after approval with `geoRefs`:

```json
{
  "sessionSlug": "ee-26-organizers",
  "questions": [
    {
      "prompt": "Should Agent Village publish a daily recap?",
      "questionType": "binary",
      "tags": ["agent-village"],
      "geoRefs": [
        { "geoId": "edge-node-1", "label": "Agent Village recap" }
      ]
    }
  ]
}
```

The worker stores `geoRefs` on the proposed question and adds a normalized
`geo:<geoId>` tag, so later lookups can use the tag filter above. To post a CE
backlink into Geo, call:

```http
GET /telegram/agent/api/geo-backlink?sessionSlug=<slug>&questionId=<id>&geoId=<geoId>
POST /telegram/agent/api/geo-backlink
```

This endpoint only returns a CE backlink payload. The agent must post that
payload to Geo using its own Geo credentials. On Geo content upload, the agent
may pre-generate a small set of discussion questions, ask for approval, create
the approved CE questions with `geoRefs`, and post the returned CE backlink
payload to the corresponding Geo node.

## Read Aggregate Results

Use this endpoint when the user asks what themes are emerging in the session or
asks for the CE results view:

```http
GET /telegram/agent/api/results?sessionSlug=<slug>&view=topic-map
GET /telegram/agent/api/results?sessionSlug=<slug>&view=consensus
GET /telegram/agent/api/results?sessionSlug=<slug>&view=difference
GET /telegram/agent/api/results?sessionSlug=<slug>&view=groups
GET /telegram/agent/api/results-image?sessionSlug=<slug>&view=topic-map
GET /telegram/agent/api/results-image?sessionSlug=<slug>&view=consensus
GET /telegram/agent/api/results-image?sessionSlug=<slug>&view=group
```

The JSON endpoint returns an aggregate `topicMap` data contract with `topics`,
circle positions, per-topic question counts, response counts, and question
bubbles. It does not return raw response records, Telegram user ids, wallet
addresses, or individual answer text. The image endpoint returns a PNG rendering
of that same topic map for agents that can send or display images.

`consensus` and `difference` return aggregate-only question rows: prompt, vote
counts, participant count, total responses, agreement score, and difference
score. They never include Telegram user ids, wallet addresses, aliases, or raw
answer text.

`groups` returns k-anonymized opinion groups only when the session's results
exposure allows `anonymized_groups`. Each group has:

```json
{
  "groupId": "group-1",
  "label": "Group 1",
  "theme": "higher agreement",
  "size": 4,
  "averageScore": 0.42,
  "topStatements": [
    {
      "label": "Q1",
      "prompt": "Should organizers publish a daily recap?",
      "cluster": { "agree": 3, "disagree": 0, "unsure": 1, "responded": 4 },
      "overall": { "agree": 5, "disagree": 3, "unsure": 2, "responded": 10 },
      "differenceScore": 0.38
    }
  ]
}
```

The groups JSON deliberately omits per-participant aliases and all raw response
text. Groups smaller than the session `minGroupSize` are suppressed and counted
as `suppressedGroupCount`. Do not try to re-identify or infer individuals.

For group analysis, first send or show the group graph image, then offer to
analyze each group. Do the per-group narrative analysis from the anonymized
`topStatements`; CE does not send raw participant text for this. Admin toggles:
`aggregate_results` gates topic-map, consensus, and difference; `anonymized_groups`
gates group views; `minGroupSize` sets the suppression threshold.

The interactive client report uses the worker result-view cache for generated
report analysis plus the demo circles and breakdown views. The cache key is the
session plus the client data-version key, so existing viewers reuse the cached
view and materially new questions or responses create a new cache entry.

### Interactive Client Report

When the user wants the full interactive report, create a private client link
instead of asking them to connect a wallet. Use the public CE client origin
(`https://contextengine.xyz` unless the operator gives you a different client
URL), the copied worker URL, the current session slug, and the user's
copied `ceagt_...` token:

```text
https://contextengine.xyz/session/<session-slug>/questions/results?telegramToken=<urlencoded-ceagt-token>&agentBridgeUrl=<urlencoded-worker-url>
```

The client accepts `telegramToken`, `ceTelegramToken`, `ceagt`, `agentToken`, or
`token`, extracts a bare `ceagt_...` token even when the user pasted the full
Telegram install message, exchanges it through
`POST <Worker>/telegram/agent/api/client-login/exchange`, and then strips the
token query parameter from browser history. Treat this URL as a login
credential: only send it in a private channel controlled by the user. If the
user does not want a token-bearing URL, send `/session/<session-slug>` and ask
them to paste the copied Telegram bot install info into the login box.

If the response has `available: false`, do not invent a map. Explain the
`unavailableReason` and ask the user to gather more answered questions. For demos
or previews, pass `demo=1` to either endpoint.

## Question Cadence

CE does not schedule recurring Telegram prompts for the user. Keep reminder
cadence in the OpenClaw or host-agent layer, where the agent can respect the
user's requested frequency and quiet hours.

Store the user's preferred volume and cadence through the same onboarding/settings
flow used for `draftStyle`, `topicPreferences`, and digest consent. The worker
stores these values but does not schedule delivery; the host agent must respect
`questionsPerBatch` when choosing how many questions to fetch and
`digestFrequency` when deciding digest cadence and quiet hours.

```json
{
  "questionsPerBatch": 3,
  "digestFrequency": "weekly"
}
```

`questionsPerBatch` is clamped from 1 to 10. `digestFrequency` is one of `off`,
`weekly`, `few_per_week`, or `daily`. `dailyDigestOptIn` remains the simple
Edge daily digest consent flag; `digestFrequency` is the finer-grained cadence
preference for the host agent.

When the user has elected to see one question every so often, prefer the
next-question queue endpoint:

```http
POST /telegram/agent/api/questions/next
```

Example request:

```json
{
  "sessionSlug": "ee-26-organizers",
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

Session admins can also ask the worker to mint a one-use Telegram group approval
link:

```http
POST /telegram/agent/api/group-approval-link
Content-Type: application/json
Authorization: Bearer <worker service token>

{
  "telegramUserId": "123456789",
  "sessionSlug": "ee-26-organizers"
}
```

The caller must pass CE's session-admin gate. A normal `ceagt_` token does not
include the `manage_group_approvals` scope by default; use the worker service
token for this link endpoint. The response contains a `url` to send to the
Telegram group owner. The first group that opens it becomes approved for that
session. User-scoped admin tokens should use the normal in-group admin approval
flow instead of minting group approval links directly.

For a user-scoped `ceagt_` token, first check whether the user is an admin for
the current or explicitly selected session:

```http
GET /telegram/agent/api/admin/status?sessionSlug=ee-26-organizers
```

If the response has `admin: true` and
`capabilities.canManageSponsoredQuestions: true`, an agent may help the admin
manage sponsored questions without needing exact question IDs. Use a two-step
confirm-before-write flow:

Admins can also read aggregate bridge metrics:

```http
GET /telegram/agent/api/admin/metrics?sessionSlug=ee-26-organizers
```

This endpoint is admin-only and returns counts only: token mints, distinct
onboarded Telegram users, bridge-created questions, rolling 30-day submitted
answer records, answer drafts, group proposals, distinct respondents,
registry-session count, and sessions with bridge KV activity. Measurement
boundaries matter: `agentsOnboarded` means CE delegation-token mints, not
external skill installs; `registrySessionCount` comes from the cached on-chain
SessionRegistry read and is not a count of worker-created sessions; and
`questionsAnswered` counts submit-queue records with submitted statuses during
the submit-record TTL window. The worker reads submit status from KV list
metadata for current records, with a legacy body-read fallback for older records.
Env-level root admins receive global totals and a per-session breakdown; session
admins receive only their current or target session.

```http
POST /telegram/agent/api/question-queue/plan
POST /telegram/agent/api/question-queue/apply
```

`plan` accepts natural-language references to existing questions plus one or
more draft questions. It does not write anything. Show the returned
`resolvedExistingQuestions`, `draftQuestions`, and `skipped` items to the admin
and ask for explicit approval before calling `apply`.

Example: make an existing question sponsored by description, and create another
sponsored question in the same operation:

```json
{
  "sessionSlug": "ee-26-organizers",
  "references": ["the question about food preference", "pizza"],
  "createQuestions": [
    {
      "prompt": "Should Agent Village prioritize organizer follow-up interviews?",
      "questionType": "binary"
    }
  ]
}
```

Example apply after the admin has approved the exact plan:

```json
{
  "sessionSlug": "ee-26-organizers",
  "references": ["the question about food preference", "pizza"],
  "createQuestions": [
    {
      "prompt": "Should Agent Village prioritize organizer follow-up interviews?",
      "questionType": "binary"
    }
  ],
  "approvalText": "Approved, make these sponsored questions."
}
```

Multiple references and multiple new questions are allowed. By default, apply
appends to the existing sponsored queue; send `replace: true` only when the
admin explicitly asked to replace the whole sponsored queue. The agent must not
call `apply` from its own inference alone.

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

### What Makes A Good Question

- Use plain language with no jargon, so a newcomer and a specialist can both understand it.
- Prefer discussion topics that expose disagreement, trade-offs, decision criteria, or evidence gaps.
- Avoid questions whose answer is obvious, settled, or boring.
- Make it interesting to specialists and/or the general public.
- Keep it concise: one clear claim per question, not a double-barrelled bundle.
- Prefer a debatable agree/disagree claim over a vague open prompt.

Avoid leading or loaded framing, compound questions, insider acronyms, and anything already obviously true.

Pose an existing active question:

```json
{
  "telegramUserId": "42",
  "groupChatId": "-100123",
  "sessionSlug": "ee-26-organizers",
  "questionId": "q-binary"
}
```

Create and pose a new freeform question:

```json
{
  "telegramUserId": "42",
  "groupChatId": "-100123",
  "sessionSlug": "ee-26-organizers",
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
  "sessionSlug": "ee-26-organizers",
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
  "sessionSlug": "ee-26-organizers",
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
  "sessionSlug": "ee-26-organizers",
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

## First-Run Consent Questions

Before fetching and drafting against session questions for a newly onboarded
user, call `GET /telegram/agent/api/onboarding`. If `completed` is false, ask
the user this fixed series of yes/no consent questions and persist their
answers with `POST /telegram/agent/api/onboarding`:

1. Can your agent pass preference info to CE to tailor which questions you see?
2. Can your agent share non-identifying demographics for research only, never published in connection to you?
3. Can CE link your otherwise-anonymous responses to approved demographic buckets for aggregate research?
4. Can CE associate your Edge attendance buckets with your answers, but not your identity?
5. Can your agent draft question responses for you based on your activity and user file?
6. Can CE store agent-drafted answers and final sent answers to study where people edit drafts?
7. Can your agent upvote questions it thinks you will find relevant?
8. Want your top 3 CE questions (from your activity + admin sponsored) in your Edge daily digest?

These answers map onto `allowedProfileFields`, `allowedUses`, `approvalMode`,
`topicPreferences`, `demographicLinkOptIn`, `attendanceLinkOptIn`, `draftDivergenceOptIn`,
`agentAutoApplyQuestionVotes`, and `dailyDigestOptIn`. Auto-apply votes remain
off unless the user says yes to question 7. The demographic-link,
attendance-link, and draft-divergence settings remain off unless explicitly
enabled. The digest flag is stored for Phase 2 and should not be treated as an
active delivery subscription yet.

## Changelog

### 2026-05-30 (v5)

- User-scoped `ceagt_` tokens now follow the user's selected/default session instead of being locked to one session; sending an existing `sessionSlug` switches and pins the user.
- Agent onboarding docs now cover opt-in topic preferences, consent-gated aggregate bucket membership writes, and the quick preference flow.
- Documented the 20-question create batch limit and the 20 + 20 + 10 pattern for 50 organizer questions.
- Added the public-release edge allow rule expectation for publishing the Telegram worker and skill on the `edge-2026` branch.

### 2026-05-30 (v4)

- Added guidance for meaningful answer comments, question batch size and digest cadence preferences, and good question-generation heuristics.
- Documented first-invocation deep-link menus and Geo-node install lookup fallback.
- Added anonymized result views for consensus, difference, and k-anonymized groups, including group-image-first analysis guidance.
- Normal question reads and `/skill-version` now expose skill version/update signals, with an admin flag for announcing new skill updates.

### 2026-05-29 (v3)

- First-run onboarding now stores topic preferences, explicit demographic-link
  consent, and explicit draft-divergence research consent.
- Mini App settings expose the same topic and opt-in controls; draft-divergence
  records are only persisted after the user opts in.
- Agents can send private interactive-report links that auto-login with the
  copied Telegram `ceagt_` token and worker URL.

### 2026-05-28 (v2)

- Host-neutral description now covers Hermes, OpenClaw, Claude Code, and
  similar HTTP-capable agents.
- Direct Link Mini App onboarding can mint a per-tapper token in a private
  Telegram WebView while the DM `Onboard Agent` path remains available.
- Agent onboarding deep links can go straight to the private copy screen, and
  `/telegram/agent/api/onboarding` stores first-run consent answers.
- Admin agents can request group approval links and revoke group approvals.
- Telegram group access is closed by default unless a group is statically or
  dynamically approved, or the session explicitly enables open group access.
- The confusing `/actions` Telegram command was removed; use `/agent` for the
  agent menu and `/activity` for recent activity.
- The worker exposes `/telegram/agent/api/skill-version` so agents can check
  whether their installed skill is current.
- Admin agents can read aggregate bridge metrics through
  `/telegram/agent/api/admin/metrics`.
- Agents can create approved batches of proposed questions from
  agent-summarized URLs with durable `references` citations.
- Agents can read active tag counts through `/telegram/agent/api/tags` before
  creating new question tags.
- Agents can create Mini App question-series launch links with editable
  prefilled drafts through `/telegram/agent/api/mini-app-launch`.
