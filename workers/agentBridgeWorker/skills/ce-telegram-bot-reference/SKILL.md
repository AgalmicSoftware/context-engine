---
name: ce-telegram-bot-reference
description: Detailed Context Engine Telegram bot, Mini App, admin, and operator reference for developers and reviewers. Use the shorter context-engine skill for normal Hermes or agent runtime.
---

# CE Telegram Bot Reference

**Reference version:** 2026-07-18 (v42)

This is the detailed Telegram bot, Mini App, admin, and operator reference. It
preserves endpoint details and troubleshooting notes that are too large for the
default Hermes runtime context. For normal agent operation, install/read the
shorter `context-engine` runtime skill served by
`/api/agent/skill`.

## Endpoint Prefix

Use `/api/agent/*` as the canonical Context Engine agent API prefix. The older
`/telegram/agent/api/*` prefix remains a transition alias for existing installs,
but new examples and clients should use `/api/agent/*`.

Use this skill when acting as a Hermes, OpenClaw, Claude Code, or similar agent for a Telegram user who is, or needs to become, a participant in a Telegram-enabled Context Engine session. The worker API is for reading questions, saving drafts, directly submitting human-approved answers, and posing questions. Draft by default; submit only when the user explicitly asks or approves.

**Token handling:** a pasted `ceagt_...` value is a private bearer credential. Extract it, store it only in the agent's local secret/auth context, and never repeat, summarize, echo, log, or include it in messages back to the user. Never display the token, even partially masked, in normal chat, summaries, tool-call explanations, receipts, debug output, Markdown code blocks, or "here is what I did" status messages. If a token is ever exposed in chat or logs, treat it as rotated-needed: ask the user to mint fresh CE agent info, or rerun the trusted invite onboarding path once and replace the stored token.

## Copied Agent Info Rule

If the user pasted copied CE agent install info containing `token=ceagt_...`,
`worker=...`, and `skill=...`, you already have enough information to make
private user-scoped CE calls. Do not ask for a Telegram handle, Telegram user
id, `telegramUserId`, group chat id, or `groupChatId`.

The copied `ceagt_...` token is not optional context. Send it on every CE
request as `Authorization: Bearer <token>`. Never make an unauthenticated
question, draft, answer, vote, or results request when copied install info
included a token. The worker uses that bearer token to infer the user identity.
When acknowledging setup, say only "Context Engine is connected" or "I stored
the CE credential privately." Do not quote the token, do not show a shortened
prefix/suffix, and do not include it in a recap of copied install info.

For Claude Code or any other low-context copied-user-token flow, including
OpenClaw/Hermes when they only have pasted credentials and no authorized Edge
profile/calendar/Telegram context:

- do not run the full Edge-agent onboarding flow and do not ask for profile,
  calendar, demographic, attendance, or Telegram identifiers up front;
- first call `GET <Worker>/api/agent/questions` with only
  `Authorization: Bearer <token>` unless the user explicitly chooses another
  session;
- when that call returns one or more answerable questions, immediately surface
  the first or most relevant one using the question-card format below and ask
  how the user wants to answer; do not ask whether to fetch questions, fetch
  the skill endpoint, or "do anything else" first;
- in daily digests, late editions, recap messages, or "new questions were
  added" summaries, do not make the primary call to action a deep link; show
  the question text and answer choices directly, then ask the user to reply in
  chat so you can save or submit the response through the CE API;
- immediately select the most relevant active questions and draft likely
  answers from the user's memory, current conversation, and consented context;
- show the drafted answers and ask whether to submit, edit, or open them in the
  Mini App; if the user has already authorized direct answering, submit with
  `submit: true` and `humanApproved: true`;
- call the onboarding/settings endpoints only when the user explicitly asks to
  update CE preferences, or when the agent actually has authorized Edge profile
  context and is doing the richer Edge-agent onboarding flow;
- omit `sessionSlug` to use the user's selected session or the worker's current
  default session;
- include `sessionSlug=<existing-slug>` only when intentionally switching or
  targeting a specific session; that switch pins the user's future omitted-slug
  calls;
- include `groupChatId` only when the action is explicitly happening inside a
  Telegram group and the numeric group id is already known from Telegram
  context.

Service-token examples later in this skill are for operators/admin services and
do not apply to a copied user-scoped `ceagt_...` token.

Do not introduce this as a Telegram setup task. In any low-context external
agent, after parsing the copied install info, proceed as "Context Engine is
ready; I am fetching questions and drafting answers from what I know about
you." Mention Telegram only if the user asks how the token was created or
requests Telegram-specific actions.

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
hermes skills install https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/workers/agentBridgeWorker/skills/ce-telegram-agent-handoff/SKILL.md
```

For local skill hosts, choose a user-owned skill directory:

```bash
CE_SKILL_REF="${CE_SKILL_REF:-main}" CE_SKILL_HOME="${CE_SKILL_HOME:?Set CE_SKILL_HOME to your skill directory}" sh -c 'mkdir -p "$CE_SKILL_HOME" && curl -fsSL "https://raw.githubusercontent.com/AgalmicSoftware/context-engine/${CE_SKILL_REF}/workers/agentBridgeWorker/skills/ce-telegram-agent-handoff/SKILL.md" -o "$CE_SKILL_HOME/SKILL.md" && printf "Installed CE Telegram Agent Handoff skill to %s\n" "$CE_SKILL_HOME/SKILL.md"'
```

### Install Lookup Via Geo Node

When the user says "install context engine", first query the relevant Geo node
with the agent's own Geo/EDGE tools for the current CE install command or skill
reference. If the Geo node returns an install command, use it. If Geo is
unavailable or has no command, fall back to the canonical public Git install
command in this section. The CE worker never performs this lookup and never
proxies Geo/EDGE_OS credentials.

### Copied-Token First Run

If the user pastes the install command into Claude Code, OpenClaw, Hermes, or
another external agent, install this skill and then tell the user to open this
Telegram onboarding link:

```text
https://t.me/contextengineer_bot?start=agent_onboarding
```

If the session slug is known, use the session-specific form:

```text
https://t.me/contextengineer_bot?start=agent_onboarding__<session-slug>
```

After the user taps `Start`, Telegram should land directly on the private
agent install screen. Ask the user to tap `Copy Agent Info` and paste the copied
install info into their agent or Claude Code. Treat any paste containing a
`ceagt_...` token plus worker/skill URLs as Context Engine onboarding install
info, including first lines like `Bearer; GET /api/agent/questions; ask answer`.
Do not ask for the user's Telegram handle, Telegram id, or group chat id: the
`ceagt_...` token identifies the user and the worker infers `telegramUserId`.
Omit `groupChatId` unless a later action is explicitly tied to a Telegram group
and the group id is already known from Telegram context. Do not call the CE
worker until the pasted install info provides a `ceagt_...` token, worker URL,
and skill URL (either as `token=...` / `worker=...` / `skill=...` fields or
line-separated values). Never echo the token back to the user.

## Staying Up To Date

At the start of a CE session, when the user asks, or after an unexpected API
error, check the worker's current skill version:

```http
GET /api/agent/skill-version
```

Compare the returned `version` with the `Skill version` line above. The
endpoint also returns `updateAvailable`, `latestVersion`, and `updateNote`.
Normal question reads include `skillVersion` and `skillUpdateAvailable` too.

Agents should cache or install this Markdown skill locally after the first
fetch to avoid repeated startup latency. Key the cached copy by worker URL and
skill version. Before future CE work, call `/api/agent/skill-version`;
if `updateAvailable` is true, `latestVersion` is newer, or the returned
`version` differs from the cached `Skill version` header, fetch the configured
skill URL again, replace the cached copy, and re-read the changelog before
continuing. Treat `skillVersion` and `skillUpdateAvailable` returned by question
reads as the same stale-skill signal.

## Preconditions

- The CE worker base URL is `https://ce-agent-bridge-worker.agalmic.workers.dev` for the current Edge City deployment. Operators may override this with `AGENT_BRIDGE_PUBLIC_URL`.
- Use a session-bound user/install credential or a named scoped service
  credential. Both use the `ceagt_...` format and the same authorization
  header. The deployment root token is bootstrap/break-glass authority only.
- A one-time invite can mint a user credential through
  `POST /api/agent/invite/onboard`. Telegram adapters may include a verified
  Telegram user id; non-Telegram agents omit it and receive an opaque principal.
- For a user-scoped agent token, the user opens the CE bot, taps `Onboard Agent`, and copies the full install info. If CE already says onboarding is complete, the same screen offers `Copy New Agent Info`; use it to mint a fresh token for another agent surface. The default expiry is 28 days. Send the token as `Authorization: Bearer <token>`.
- Do not supply `telegramUserId` to impersonate another participant. CE derives
  the principal from the credential. Include `groupChatId` only when a
  Telegram adapter is explicitly acting in a known group.
- Every user or service credential is locked to its issued session. Omit
  `sessionSlug` or restate that session; a different slug is denied and does
  not rebind the credential.
- Permission currently defaults to Telegram-native group/session binding. SBT or CE resource-gated authoring is not the default yet.
- Current Edge 2026 demo sessions may include the default `Research Questions
  (Demo)` session for organizers plus participant sessions. Operators can stop
  surfacing older smoke-test sessions by moving
  `AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER` forward. Each `ceagt_`
  credential remains bound to the session for which it was issued; mint a new
  credential when another session is required.

Worked `ceagt_` token smoke test:

```bash
curl -fsS "https://ce-agent-bridge-worker.agalmic.workers.dev/api/agent/questions?sessionSlug=ee-26-organizers" \
  -H "Authorization: Bearer ceagt_REPLACE_WITH_USER_TOKEN"
```

## Quickstart For Any HTTP-Capable Agent

Use this generic flow for Claude Code, Claude cowork, OpenClaw, Hermes, or any agent that can make HTTPS requests:

1. If the user has a one-time CE invite, redeem it through the invite flow
   below. Include Telegram `from.id` only when a Telegram adapter already has
   that verified context. Otherwise, Telegram users can open
   `https://t.me/contextengineer_bot?start=agent_onboarding` (or the
   session-specific form) and copy install info.
2. Obtain the user-scoped `ceagt_...` token either from the invite-onboarding response or from copied bot install info. For copied install info, extract `Worker`, `Skill`, and the `ceagt_...` token. There may be no `Session`, Telegram handle, Telegram id, or group chat id field; that is expected. Never repeat the token in chat, logs, summaries, or error messages.
3. Choose the first action by agent context. In Claude Code or another
   low-context copied-token invocation, skip profile onboarding and go straight
   to questions. In an Edge-native agent with authorized profile/calendar
   context, ask one concise consent question before using that context. Do not
   ask for Telegram ids or group ids. Add `sessionSlug` only when restating the
   credential's issued session.
4. Call `GET <Worker>/api/agent/questions?limit=20` with `Authorization: Bearer <token>`, adding `sessionSlug` only when intentionally switching or targeting a specific session. The response marks submitted questions with `answeredByUser` and sorts ordinary listings unanswered-first; keep that ordering unless a sponsored question or strong local relevance signal should override it.
5. Pick up to 10 answerable, unanswered questions most relevant to the user. If memory is enabled and consented, use it to rank; otherwise use current conversation context, question tags, and session context.
6. Immediately show the first or most relevant answerable question and ask how the user wants to answer. Do not ask whether to surface it; surfacing it is the default action after a successful question read.
7. Draft responses, show the proposed answers, and ask for confirmation.
8. Save drafts with `POST <Worker>/api/agent/preferences`. If the user explicitly says to answer or choose an option on their behalf, include `submit: true` and `humanApproved: true`; this submits without requiring the Mini App.
9. When the user wants editable Telegram review, call `POST <Worker>/api/agent/mini-app-launch` to create a one-click Mini App link with the ordered questions and editable prefilled drafts.
10. Check `GET <Worker>/api/agent/actions` to show pending drafts, vote suggestions, and prior agent actions.
11. Check `GET <Worker>/api/agent/results?view=topic-map` when the user asks what the session is about or wants a graphical aggregate result.
12. For an interactive report, give the user the CE client session link and ask
    them to paste their copied agent info into the client login modal. Never
    build a URL containing the raw `ceagt_` token.
13. Use the suggest/review endpoints for votes and group suggestions. Prefer user approval unless the user has explicitly opted into auto-apply behavior.

## Onboarding Options

The preferred low-friction path is a CE bot deep link. A group-question response remains available when the user should enter through a Telegram group that already has CE bot buttons.

### One-Time Invite Onboarding

Use this path when a trusted operator or host supplies a Context Engine invite.
The invite is a one-time bootstrap secret, not an admin credential. A Telegram
adapter may attach a verified numeric user id; other agents omit Telegram
identity fields.

For ordinary Context Engine participation, the invite is configured for the
Geo node's target `sessionSlug`. Hermes should use the Telegram `from.id` it
already observes in the chat; do not ask the user to type their Telegram id.
Do not collect or send a Telegram username for this flow. Do not use this
ordinary onboarding flow for Session Wrapped; Wrapped must use the
runtime handoff skill's Agent Only Mode and send `"mode": "agent_only"`.
The Geo node can store fields like:

```json
{
  "contextEngine": {
    "inviteToken": "<geo-link-token>",
    "worker": "https://ce-agent-bridge-worker.agalmic.workers.dev",
    "skillUrl": "https://ce-agent-bridge-worker.agalmic.workers.dev/api/agent/skill?v=42",
    "sessionSlug": "<session-slug>"
  }
}
```

Keep the Geo node instructions short and point the agent at
`contextEngine.skillUrl` as the source of truth. The skill URL is a Markdown
instruction document URL, not a callable tool name. Fetch it once, save/cache it
locally for this worker/version, and refresh it only when `/skill-version` or a
question response says the cached copy is stale. Do not paste a long copy of
this onboarding procedure into the Geo node; stale hardcoded instructions can
make agents fall back to the Telegram bot instead of using invite onboarding.

When surfacing Context Engine from Geo, keep the user prompt brief: one short
description plus a single action such as `Enable Context Engine`. A blue link,
button, or quick reply with that label counts as the user's "yes" acknowledgment;
do not require a second confirmation unless the user asks for more detail. Do
not narrate internal setup steps such as API onboarding, bearer-token issuance,
token length checks, endpoint names, or local storage paths. After each
onboarding answer, avoid recapping the full answer set. Acknowledge briefly,
ask only the next needed question, then fetch and surface a relevant CE question.

Keep post-submit confirmations short too. Do not lead with implementation
details such as permissions, direct-submit mechanics, Mini App review bypasses,
HTTP status, or API behavior. Do not restate every submitted answer unless the
user asks for a receipt. Prefer one short sentence such as "Submitted those
answers to Context Engine." Then add only the next useful action, e.g. "I'll
surface the next relevant question in your morning brief."

```http
POST /api/agent/invite/onboard
Content-Type: application/json

{
  "inviteToken": "<value from contextEngine.inviteToken>",
  "telegramUserId": "<optional verified Telegram from.id>",
  "sessionSlug": "<value from contextEngine.sessionSlug>",
  "source": "geo:<optional-node-id>"
}
```

Omit `telegramUserId` entirely when the host has no verified Telegram identity.
If the invite token is valid, CE returns `token`, `worker`, `skillUrl`,
`sessionSlug`, `expiresAt`, and principal/account metadata. Telegram onboarding
state is returned only for a Telegram principal. Treat `token` as
the user's private `ceagt_...` bearer credential: store it only in the agent's
local auth context, never repeat it back to the user, and send the exact token
string as `Authorization: Bearer <token>` on later CE calls to the same
`contextEngine.worker`. Do not include quotes, angle brackets, Markdown, or
the whole JSON response in the bearer header. For Hermes or another
Edge-native agent with authorized profile/calendar/Telegram context, first ask
whether CE may use the user's Edge profile, interests, calendar, and
non-identifying fields (bio keywords, age bucket, country/region, role, and
attendance week). A plain "yes" or "accept all" can approve the recommended CE
setup; translate it into explicit onboarding answers and profile-derived
buckets rather than asking the user to re-enter data Hermes can infer. Treat the
onboarding response's group and demographic fields as a storage schema, not as a
user-facing checklist. Do not ask "Age Range / Attendance / AI Tribe /
Contribution Role" as a raw form unless a consented profile field is missing or
ambiguous. If the user declines or narrows consent, persist only the approved
subset. Then complete any relevant onboarding preferences or consent questions
from the returned onboarding state or `GET /api/agent/onboarding`. Next call
`GET <Worker>/api/agent/questions?limit=20` with the returned token and
surface the first relevant unanswered question directly in chat. For Claude Code or another
low-context copied-token agent, skip onboarding by default and fetch questions
first.

The invite is consumed after a successful redemption and cannot be used to
refresh the credential. It permits normal participant/user onboarding; it does not
grant admin rights, response export, group approval, or permission management.

### Direct Link Mini App Onboarding

When a group message shows `Onboard Agent (Mini App)`, tapping it opens a
private per-tapper Telegram Mini App page. That page must send Telegram's raw
`window.Telegram.WebApp.initData` to:

```http
POST /api/agent/miniapp/onboard
```

Send `initData` in the POST JSON body or the canonical
`X-Telegram-Init-Data` request header. Never put it in a URL query string; GET
onboarding and query-carried credentials are rejected.

The worker validates the Telegram initData server-side and returns that user's
own `ceagt_...` token, worker URL, session slug, expiry, and skill name. The
endpoint may be called again for the same Telegram user to mint a fresh token
and revoke the prior user pointer, so it is suitable when an already-onboarded
user needs a new agent credential. The token is never written into the shared
group message. The DM deep-link `Onboard Agent` path remains available as the
fallback when the Direct Link Mini App short name is not configured.

### Sensemaking Trial Deep Link

Use the deployment's CE bot start link when the user wants to opt in to the sensemaking trial. The link should open the Context Engine Telegram bot and start the bot flow with `/start`.

The current worker recognizes these onboarding payloads and routes them to the
private copy screen:

```text
https://t.me/contextengineer_bot?start=agent_onboarding
https://t.me/contextengineer_bot?start=agent_onboarding__<session-slug>
```

After the user opens the link and starts the bot, CE can create or recover the
CE-managed Telegram EVM account and render a private masked token screen with a
copy button for full install info. Generic onboarding resolves the live worker
default once; session-specific onboarding uses the named session. The minted
credential remains bound to that issued session. Omit `sessionSlug` or restate
the same slug on later calls. Include `groupChatId` only when the action is
explicitly tied to a Telegram group.

## Prepopulated Questions On First Invocation

When a user first asks CE about deliberation, governance, sensemaking, community
discussion, or "what questions are there?", proactively offer a small labeled
menu of relevant questions they can answer directly in the agent chat.

1. Seed topics from the user's authorized profile, bio, interests, and recent
   activity. Use only fields the user allowed during onboarding consent.
2. Choose matching tags and geoIDs from that context. For geoIDs, the agent uses
   its own Geo tools; the CE worker does not call Geo.
3. Fetch active questions with the existing tag-filtered question reads and the
   geo-linked question flow. Respect `questionsPerBatch` from the user's
   settings, defaulting to 3.
4. Present each cluster as a short question list with answer choices and ask the
   user which question they want to answer, or propose likely answers for
   approval. Avoid link-only prompts like "Join the deliberation" or "Share your
   perspective".
5. Use Mini App or client links only as a secondary fallback after the user asks
   to open Telegram/client review, and only when you have just created a
   question-specific Mini App launch link or token-authenticated client link
   with the endpoints below.

Useful organizer/tester labels include:

- "Participant Survey Topics"
- "Index Network Questions" (`index`, `meetings`)
- "Example Session questions"

Optional fallback link shapes, using existing link builders only:

```text
https://t.me/contextengineer_bot/<mini-app-short-name>?startapp=<payload-from-mini-app-launch>
https://contextengine.sh/session/<session-slug>/questions/results
```

This flow composes existing tags, questions, geo-linked questions, Mini App
launches, and client links. Do not put a raw `ceagt_` token in the client URL;
ask the user to paste their copied Telegram agent info into the CE client login
modal, where the browser exchanges it once through `/api/agent/client-login/exchange`.
Do not invent a new CE endpoint for it. If a link does not open the exact
relevant question or ordered question series, omit the link and continue the
response flow directly in the agent chat.

## Copied Agent Credential Flow

Use this path when the user's assistant is not running inside the CE Telegram bot but the user wants it to act against CE on their behalf.

1. Ask the user to open the CE bot and run `/start`.
2. The user taps `Onboard Agent`, then `Copy Agent Info`. `/me` also links to account details and activity after onboarding.
3. The user copies the install info into the trusted external agent. The default token expiry is 28 days.
4. The external agent calls CE with `Authorization: Bearer <agent token>`.
5. Omit `telegramUserId`; the worker infers the principal. The credential is
   fixed to the session shown in its install info. It cannot switch sessions.

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
- remote Telegram group approval (approval must be confirmed in the target group)
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

- omit `sessionSlug` to use the credential's issued session;
- include `sessionSlug` only to restate that same session;
- omit `telegramUserId` by default, because the worker infers it from the token;
- omit `groupChatId` by default, because copied-token onboarding is private-agent context; include it only when Telegram context already provided the numeric group id for a group-scoped action;
- do not send the token as a URL query parameter, request body field, prompt
  transcript, log line, or shared note;
- do not call export, raw-response, wallet/private-key, or broad admin endpoints
  with this token. The sponsored-question admin-status/plan/apply routes are
  allowed only when `GET /api/agent/admin/status` confirms the user is
  a session admin, and `apply` still requires explicit admin approval.

If the worker returns `401` with `reason` equal to `agent_token_expired`,
`agent_token_not_found`, `agent_token_inactive`, or another `agent_token_*`
reason plus `action: "obtain_new_agent_credential"`, obtain a replacement from
the original onboarding channel. One-time invites cannot be replayed. Telegram
users can mint fresh install info through the bot; named services must be
rotated by an operator. Do not keep retrying a missing, expired, or inactive
credential.

Before using personal data, ask the user what may be used in this CE flow. The
worker exposes a first-run onboarding endpoint for this:

```http
GET /api/agent/onboarding
POST /api/agent/onboarding
```

`GET` returns the fixed first-run consent questions and any saved answers. `POST`
persists the answers for the token's Telegram user and current session. Defaults
are privacy-preserving: all consent is off until the user explicitly answers.
For Edge-native Hermes/OpenClaw, lead with a single concise permission question:
"Can I use your Edge profile, interests, and calendar info to surface relevant
CE questions? Can I also use non-identifying Edge profile fields for research
buckets: bio keywords, age bucket, country/region, role, and attendance week?"
If the user says "yes", "accept all", or gives equivalent approval, treat that
as consent for the recommended onboarding settings returned by the endpoint and
auto-fill topic preferences plus attendance/role buckets from authorized Edge
profile/activity. Ask manual follow-ups only for fields that are missing or
uncertain. If they do not opt in, use only the current conversation and public
session context. Persist approved topics as `topicPreferences` in the onboarding
POST body. The current questions map to these settings:

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
      "contribution_role": ["community_host"]
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
Demographic and attendance linking are default-off. Ask in Edge-profile terms:
"Can I use non-identifying Edge profile fields for research buckets: bio
keywords, age bucket, country/region, role, and attendance week?" Only when the
user opts in may the agent link otherwise anonymous responses to approved
buckets such as Edge Bio keywords, age bucket, country, region, Week 1, Week 2,
Week 3, Week 4, Entire Month, or Attended Previous Edge Events. These buckets
are associated with the user's answers for research and filtering, not
published as the user's identity.
Draft-edit research is also default-off. Unless the user opts in, do not ask CE
to record draft/edit research metrics. When opted in, CE stores
privacy-preserving metrics comparing the initial draft to the saved or
submitted answer: binary transitions, rating direction/delta, multichoice
added/removed counts, and text/comment length buckets. CE does not store raw
freeform text or raw comments in these research records.

For a low-friction Hermes UX, the agent should offer a natural-language
"accept all recommended onboarding permissions" option. That is not a separate
API flag. If the user accepts, translate it into explicit onboarding answers and
persist those normal fields; if the user declines or narrows consent, persist
only the explicit allowed fields. After saving onboarding, immediately fetch
`GET /api/agent/questions?limit=20` and surface the first relevant
unanswered question rather than stopping at a settings summary.

Do not turn the returned group bucket schema into a user-facing onboarding
form. In particular, do not say that CE returned "demographic and
categorization groups" and then ask the user to fill out Age Range,
Attendance, AI Tribe, or Contribution Role one by one. For Edge-native agents,
first ask permission to use authorized Edge profile/activity data; if approved,
infer buckets from that data and ask only targeted follow-ups for missing or
uncertain values.

When the user answers yes to demographic or attendance linking, auto-fill
aggregate buckets from any profile fields the user authorized. For attendance,
read Edge profile/activity for Week 1, Week 2, Week 3, Week 4, Entire Month,
and previous Edge attendance; if the profile does not say which week they are
coming, ask directly. For role, use authorized bio/profile text to choose from
`builder`, `researcher`, `founder_operator`, `investor`, `artist_designer`,
`community_host`, or `other`; map "organizer", "host", or "facilitator" to
`community_host`. If the role is not clear from the profile, ask directly.
Include the chosen buckets under `groups.selections` in the onboarding POST.
Positive consent writes aggregate bucket memberships such as attendance, age
bucket, region, AI tribe, or role. Explain plainly: these buckets are
associated with their answers for research and filtering, not
published under their name. Do not infer or submit group membership from
private user data unless the user has explicitly allowed that field and that
use.

### Group Question Onboarding

Use this path when the user should become a CE participant by answering one CE question in a Telegram group that already has the CE bot enabled.

1. Direct the user to the Telegram group/thread where the CE bot is present.
2. Ensure the group has selected a CE session. If not, ask a group participant to run `/sessions` and join the intended session. If the session uses an approved Telegram group allowlist or `telegramGroupApprovalRequired`, add the CE bot to the target group and have a configured session admin run `/join <session>` inside that group. CE verifies the admin and group together before approving it. Operators can instead run `/group_id` there and add the numeric chat id to session policy. `/group_link <session>` is guidance-only and never returns an authorization-bearing URL.
3. Ask the user to answer any visible CE bot question by tapping a CE inline response button.
4. After the tap, CE can bind `telegramUserId` to the group/session, derive or recover the CE-managed Telegram EVM account, and mark the user as an approved participant for worker calls.
5. From then on, in this Telegram-group button flow only, use this skill's API calls with the same `telegramUserId`, `groupChatId`, and `sessionSlug` captured by Telegram. Do not ask for these identifiers during copied-token Claude Code onboarding. For `telegram_only` sessions, a private user who has already joined the session can also use participant-bound question authoring paths.

If the user is only in a one-on-one OpenClaw Telegram DM, send them a CE deep link or group link first. CE-owned inline response buttons cannot appear inside a normal private DM with another bot unless CE sends the message in a CE-accessible chat.

## Read Active Questions

```http
GET /api/agent/questions
GET /api/agent/questions?sessionSlug=<slug>
POST /api/agent/questions
```

Use only questions where `answerable` is `true`. Locked or unavailable questions may be listed without prompt text and must be skipped. Public question objects include normalized `tags` and, when present, `geoRefs`; use them when deciding relevance.

### Present Questions To Humans

Present CE as native agent behavior, not as an API transcript. Do not tell the
user "I fetched the API", mention HTTP statuses, or reference Geo-node metadata
unless they ask for implementation details. Say "Here is a relevant question for
you" and keep the conversation focused on the user's answer.

When showing questions in chat or an agent UI, do not dump raw fields. Use a
short card with the endpoint result translated into human language:

```text
Q<number>. <short readable title if obvious>
<question prompt without wrapping quotes>

Type: <binary | rating | freeform | single choice | multiple choice>
Tags: ethics · safety · methodology
Answer options: Agree / Unsure / Disagree
```

Use the stable CE question number when present; otherwise use the list order.
Keep the full prompt visible, leave a blank line between questions, and omit
internal ids unless the user asks. Do not lead with raw labels like
`Question (binary, proposed)` as the main title. For binary CE questions, show
the user's choices as `Agree`, `Unsure`, and `Disagree` unless the question
itself clearly asks for yes/no wording.

After a successful question read, do not end with a generic prompt such as
"Want me to do anything with this?" Instead, surface the first relevant
answerable question and ask "How would you like to answer?" with the available
choices or a freeform reply path.

Do not rely only on the worker's `relevance` ordering. Read the returned
answerable questions, use the user's consented profile, current conversation,
memory, interests, and attendance context in your own model, and pick the most
subjectively relevant question from the batch. When helpful, include a suggested
answer and short rationale the user can confirm or edit, e.g. "Given your recent
work on programmable cryptography, I would suggest Agree because ... Does that
sound right?"

For personalized question selection, send a POST body with preferences:

```json
{
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

For queue-driven reads, `POST /api/agent/questions/next` supports `sponsoredFirst` and `includeSponsored` so admin-selected sponsored questions can be served before the general queue.

If the user is interacting in an OpenClaw DM, use this endpoint to fetch CE questions, then ask the user in natural language. Save their answer through `POST /api/agent/preferences`. By default this creates a draft; when the user explicitly says "answer", "submit", "choose unsure", or otherwise authorizes an answer, set `submit: true` and `humanApproved: true` so CE records the response without requiring the Mini App.

## Tags: Reuse Before You Invent

Before generating or creating questions, pull the tags already active in the
session:

```http
GET /api/agent/tags?sessionSlug=<slug>
POST /api/agent/tags
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
POST /api/agent/preferences
```

The response reports `draftCount`, `submittedCount`, and `skipped`. By default
it only saves drafts. To answer on the user's behalf after explicit approval,
include both `submit: true` and `humanApproved: true`. The worker accepts them
at the top level, inside a `preferences` object, or on an individual answer in a
`preferences` array:

```json
{
  "sessionSlug": "ee-26-organizers",
  "submit": true,
  "humanApproved": true,
  "preferences": {
    "answersByQuestionId": {
      "q-binary": { "value": "unsure", "comments": "The premise depends on how intervention is defined." }
    }
  }
}
```

Equivalent per-answer direct-submit shape:

```json
{
  "sessionSlug": "ee-26-organizers",
  "preferences": [
    {
      "questionId": "q-binary",
      "answer": "unsure",
      "comments": "The premise depends on how intervention is defined.",
      "submit": true,
      "humanApproved": true
    }
  ]
}
```

Use direct submit for commands like "choose unsure", "answer agree", or "submit
that" when the user has clearly authorized the action. Use drafts when the user
asks for suggestions, wants to review language, or has not clearly approved
submission.

For direct submit, do not treat the answer as recorded unless the HTTP status is
2xx, `ok` is true, `submittedCount === submitRequestedCount` for the answers you
intended to submit, every intended answer has a returned `requestId`, and no
target question appears in `skipped`. If `replayed: true` appears on a submitted
item, say the answer was already recorded rather than implying a new write. If
the worker returns `422` with `reason: "direct_submit_incomplete"`, at least one
requested answer was skipped or not recorded. Do not tell the user the answer
was submitted; re-fetch active questions, repair the question reference or
answer shape, and retry.

After a direct submit, verify with `GET /api/agent/questions?limit=20`
or `GET /api/agent/questions?questionId=<id>`. For authenticated
user-scoped requests, answered questions include `answeredByUser`, `answeredAt`,
`answerStatus`, and `myAnswer`. Use `myAnswer` to confirm the value you just
sent (for example rating `5`) before telling the user it was recorded. Keep the
user-facing summary brief and do not show question IDs unless the user asks for
debug details.

If the user enabled draft-edit research and you adjust an answer in chat, send
the initial suggestion alongside the final answer so CE can calculate
privacy-preserving edit metrics:

```json
{
  "sessionSlug": "ee-26-organizers",
  "submit": true,
  "humanApproved": true,
  "preferences": [
    {
      "questionId": "q-binary",
      "initialAnswer": { "value": "agree", "comments": "Initial agent guess." },
      "answer": { "value": "unsure", "comments": "Final user-approved nuance." }
    }
  ]
}
```

For answers previously saved as CE drafts, the worker can also compare the
stored draft with the later saved or submitted answer. The response may include
`draftEditMetrics` with `stored`, `changed`, `answerChanged`, and
`commentChanged`; it never includes raw research text.
If you use the `answersByQuestionId` object shape instead of the array shape,
put parallel initial suggestions in `initialAnswersByQuestionId`.

## Mini App Question Links

After the user confirms drafted answers, create a Mini App launch link when the
next step should be editable review inside Telegram:

```http
POST /api/agent/mini-app-launch
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
draft for review.

The Mini App is an optional review path, not a required finalization step. If a
review deep link opens `/start` or otherwise fails to launch the Mini App,
continue in the agent chat: show the saved drafts from
`GET /api/agent/actions`, ask what to submit, then call
`POST /api/agent/preferences` with `submit: true` and
`humanApproved: true` for approved answers.

## Review Activity

Use this endpoint as the agent's read surface for previous mutations and pending suggestions:

```http
GET /api/agent/actions?sessionSlug=<slug>
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
GET /api/agent/tags?sessionSlug=<slug>
```

After approval, create the questions as proposed questions:

```http
POST /api/agent/questions/create
```

Example body:

```json
{
  "sessionSlug": "ee-26-organizers",
  "sourceUrl": "https://example.org/source-note",
  "questions": [
    {
      "prompt": "Should organizers publish a daily session recap?",
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
GET /api/agent/questions?sessionSlug=<slug>&tags=geo:<geoId>&relevanceMode=filter
```

2. If a matching answerable question exists, phrase the user's natural-language
   input as an editable draft response and save it with
   `POST /api/agent/preferences`.
3. If no good question exists and the topic is worth discussion, draft a short
   CE question, show the exact question to the user/admin, and only create it
   after approval with `geoRefs`:

```json
{
  "sessionSlug": "ee-26-organizers",
  "questions": [
    {
      "prompt": "Should the session publish a daily recap?",
      "questionType": "binary",
      "tags": ["session-topic"],
      "geoRefs": [
        { "geoId": "edge-node-1", "label": "session recap" }
      ]
    }
  ]
}
```

The worker stores `geoRefs` on the proposed question and adds a normalized
`geo:<geoId>` tag, so later lookups can use the tag filter above. To post a CE
backlink into Geo, call:

```http
GET /api/agent/geo-backlink?sessionSlug=<slug>&questionId=<id>&geoId=<geoId>
POST /api/agent/geo-backlink
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
GET /api/agent/results?sessionSlug=<slug>&view=topic-map
GET /api/agent/results?sessionSlug=<slug>&view=consensus
GET /api/agent/results?sessionSlug=<slug>&view=difference
GET /api/agent/results?sessionSlug=<slug>&view=groups
GET /api/agent/results-image?sessionSlug=<slug>&view=topic-map
GET /api/agent/results-image?sessionSlug=<slug>&view=consensus
GET /api/agent/results-image?sessionSlug=<slug>&view=group
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

When the user wants the full interactive report, send a client session link
instead of asking them to connect a wallet. Use the public CE client origin
(`https://contextengine.sh` unless the operator gives you a different client
URL) and the current session slug:

```text
https://contextengine.sh/session/<session-slug>/questions/results
```

Do not put a raw `ceagt_...` token or copied install payload into the URL. The
client login box accepts the copied token or install message, extracts the token
in component state only, exchanges it through
`POST <Worker>/api/agent/client-login/exchange`, and stores only the returned
short-lived browser envelope in tab-scoped `sessionStorage`.

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
`digestFrequency` plus `digestTimeOfDay` when deciding digest cadence and quiet hours.

```json
{
  "questionsPerBatch": 3,
  "digestFrequency": "weekly",
  "digestTimeOfDay": "morning"
}
```

`questionsPerBatch` is clamped from 1 to 10. `digestFrequency` is one of `off`,
`weekly`, `few_per_week`, or `daily`. `dailyDigestOptIn` remains the simple Edge
brief consent flag; `digestFrequency` is the finer-grained cadence preference
for the host agent. If the user opts into a digest, ask whether they prefer the
morning or evening Edge brief and store `digestTimeOfDay` as `morning` or
`night`.

For daily digests, late editions, and new-question summaries, the first action
should be answering in the agent chat, not opening a deep link. For each
question, show the concise title, question text, and available choices, then ask
for a direct reply such as "agree", "unsure", "disagree", an option name, or a
short freeform answer. After the user replies, call
`POST /api/agent/preferences`; include `submit: true` and
`humanApproved: true` only when the reply clearly authorizes submission.
Generate a Mini App link only when the user asks to review or edit in Telegram.

When the user has elected to see questions in a digest or recurring brief,
fetch a candidate batch and rank it inside the host agent using the user's
consented profile, schedule, interests, and recent activity. Do not let CE pick
the "most relevant" ordinary question for the user. CE may still choose the next
admin-sponsored question when a sponsored queue is configured.

```http
GET /api/agent/questions?limit=20
```

or:

```json
{
  "sessionSlug": "ee-26-organizers",
  "limit": 20,
  "preferences": {
    "interests": ["session-topic", "programmable-cryptography"]
  }
}
```

Use `limit: 20` as the normal digest candidate set. If the host agent has enough
latency budget, it may request more candidates; the worker caps explicit
question-list limits at 200. The worker annotates each question with
`answeredByUser` when it has a submitted answer from the current user and sorts
ordinary question listings unanswered-first. The agent should then select the most relevant
question or the top `questionsPerBatch` questions itself. Prefer questions the
user has not answered, that match consented profile/activity context, and that
would be useful or interesting to answer now.

Use the next-question queue endpoint only when you need the admin-sponsored
queue or a persistent per-user cursor:

```http
POST /api/agent/questions/next
```

For sponsored queues, send `criteria.sponsoredFirst: true`. The worker returns
one `question`, advances a per-user queue cursor by default, and marks
`sponsored: true` when the selected question came from the admin-configured
sponsored queue. Send `advance: false` for preview-only calls, or
`resetQueue: true` when the user asks to restart a cadence. If the returned
question is not sponsored, the host agent may ignore it and rank the broader
`/questions` batch instead. Session admins can set the sponsored queue from the
bot Admin Actions screen or with `/question_queue 1 3 4`.

Operator agents can also manage that same sponsored queue through the worker:

```http
GET /api/agent/question-queue
POST /api/agent/question-queue
```

This is an admin-only route. Use the root/break-glass token only for explicit
operator recovery, or a scoped user/service `ceagt_` credential whose managed
account is configured as a session admin. Send either
`sponsoredQuestionIds` / `questionIds` or `{"clear": true}`. Ordinary
participant credentials cannot mutate the queue.
Question refs may be exact IDs or 1-based candidate numbers from the `GET`
response.

The historical group-approval-link endpoint no longer mints Telegram links:

```http
POST /api/agent/group-approval-link
Content-Type: application/json
Authorization: Bearer <root break-glass token>

{
  "telegramUserId": "123456789",
  "sessionSlug": "ee-26-organizers"
}
```

The caller must still pass CE's session-admin gate. The compatibility endpoint
returns `409 group_approval_link_disabled` with fixed guidance and no token or
URL. To approve dynamically, add the bot to the target Telegram group and have
a configured session admin run `/join <session>` inside that group. CE verifies
the admin and target chat together before persisting approval. Operators can
instead add the `/group_id` value to the session's approved-group policy.

For a user-scoped `ceagt_` token, first check whether the user is an admin for
the current or explicitly selected session:

```http
GET /api/agent/admin/status?sessionSlug=ee-26-organizers
```

If the response has `admin: true` and
`capabilities.canManageSponsoredQuestions: true`, an agent may help the admin
manage sponsored questions without needing exact question IDs. Use a two-step
confirm-before-write flow:

Admins can also read aggregate bridge metrics:

```http
GET /api/agent/admin/metrics?sessionSlug=ee-26-organizers
```

This endpoint is admin-only and returns counts only: token mints, distinct
onboarded Telegram users, bridge-created questions, rolling 30-day submitted
answer records, answer drafts, draft-edit metric records, group proposals,
distinct respondents, registry-session count, and sessions with bridge KV activity. Measurement
boundaries matter: `agentsOnboarded` means CE delegation-token mints, not
external skill installs; `registrySessionCount` comes from the cached on-chain
SessionRegistry read and is not a count of worker-created sessions; and
`questionsAnswered` counts submit-queue records with submitted statuses during
the submit-record TTL window. The worker reads submit status from KV list
metadata for current records, with a legacy body-read fallback for older records.
Env-level root admins receive global totals and a per-session breakdown; session
admins receive only their current or target session. When the worker has
`AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER` set, root-admin global metrics
default to the sessions still visible after that cutoff, so smoke-test and demo
sessions should not be pulled into normal analysis. Use
`includeLegacySessions=1` only when the operator explicitly asks for a historical
all-session sweep.

```http
POST /api/agent/question-queue/plan
POST /api/agent/question-queue/apply
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
      "prompt": "Should the session prioritize organizer follow-up interviews?",
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
      "prompt": "Should the session prioritize organizer follow-up interviews?",
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

1. At the user's chosen cadence, call `GET /api/agent/questions?limit=20`
   or `POST /api/agent/questions` with `limit: 20`, plus any consented
   interest/session hints.
2. Rank the returned answerable questions inside the host agent. If the admin
   sponsored queue should preempt ordinary relevance, call
   `/api/agent/questions/next` with `criteria.sponsoredFirst: true`
   first and include the sponsored result when present.
3. Ask one or a small batch directly in the OpenClaw conversation, or call
   `POST /api/agent/questions/pose` when the question should appear in
   the CE-bound Telegram group.
4. When the user clearly approves an answer in chat, submit it directly with
   `POST /api/agent/preferences` and root-level `submit: true` plus
   `humanApproved: true`.
5. Save a draft or send a Mini App link only when the user asks to review/edit,
   when the answer is ambiguous, or when the agent is not authorized to submit
   directly.

Do not make CE-specific reminder promises from worker settings. Scheduling,
retry cadence, notification quiet hours, and "ask me later" behavior belong in
the agent scheduler until CE owns a dedicated notification service.

## Digest / Hermes Cron Install

Use this when the user asks to add Context Engine questions to a recurring
digest (a Hermes daily brief, an OpenClaw scheduler, or similar). CE never
schedules delivery itself; the host agent's cron owns timing, quiet hours, and
frequency. Ask the user's permission before binding CE into any recurring job.

Installing into a scheduler is different from interactive use, because
background cron jobs run in an isolated environment that resolves skills only
from the host's persistent skill configuration, not the interactive session
registry. Before binding CE to a cron job:

1. Install this skill into the cron-visible skill registry from the worker skill
   URL, or from the public `main` branch raw `SKILL.md`.
2. Make sure the directory holding the installed skill is registered in the
   host's external-skills configuration so cron can resolve it. On Hermes this
   means the skills directory (for example `/opt/data/skills`) must appear in
   `skills.external_dirs` in the host `config.yaml`; if it is missing, the
   digest silently skips CE and the brief shows a line like
   `Skill(s) not found and skipped: <slug>`.
3. Read the exact installed slug back from the host's skill list and bind cron
   to that exact slug. Do not assume the slug. The interactive alias can differ
   from the cron-resolvable slug. The short runtime skill now installs with
   frontmatter name `context-engine`; this reference skill installs as
   `ce-telegram-bot-reference`.
4. Use the host's cron CLI to add or replace the binding; do not hand-edit the
   jobs file. If the CLI only supports add, warn the user before creating a
   second binding rather than silently duplicating.

Keep one active prepare job per digest slot. Two prepare jobs writing the same
digest state file at the same time can race, corrupt it, and waste tokens. Pause
a redundant duplicate first (reversible) and delete it only after one clean
digest cycle. Bind CE into both the morning and evening jobs when the user wants
both, and store their `digestTimeOfDay` preference.

In the digest itself, rank a fetched batch locally and surface the top three
questions using the user's consented profile, schedule, interests, and recent
activity. Put admin-sponsored questions first when a sponsored queue is
configured (`POST /api/agent/questions/next` with
`criteria.sponsoredFirst: true`). Include draft answers only when the user has
granted that permission. Keep it succinct and do not show question IDs.

After binding, do a read-only verification: no active job still references a
missing slug; the user's `ceagt_` bearer credential exists in the host's private
store but is never printed; the digest path calls
`GET /api/agent/questions?limit=20` (using `/questions/next` only for
the sponsored queue); and chat-approved answers submit only with `submit: true`
plus `humanApproved: true`. Never print the `ceagt_` token, user profile data,
or private file contents in digest output or logs.

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
  "sessionSlug": "ee-26-organizers",
  "questionId": "q-binary"
}
```

Create and pose a new freeform question:

```json
{
  "sessionSlug": "ee-26-organizers",
  "prompt": "What should the group decide next?",
  "questionType": "freeform",
  "tags": ["governance", "session-topic"],
  "sessionContext": "Short public context that helps CE format and tag the question."
}
```

Send either body to:

```http
POST /api/agent/questions/pose
```

Use `send: false` for dry runs. Otherwise the worker attempts to send the posed question into the bound Telegram group when the bot token is available.

## Agent Question Importance Votes

To ask CE which active questions seem most important for a user, call:

```http
POST /api/agent/question-votes/recommend
```

Example:

```json
{
  "sessionSlug": "ee-26-organizers",
  "preferences": {
    "interests": ["food", "governance"],
    "attendedSessions": ["session-topic"]
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
POST /api/agent/question-votes/apply
```

Example:

```json
{
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
- The OpenClaw agent should save answers as CE drafts with `POST /api/agent/preferences`.
- CE-owned inline response buttons are not available inside that DM unless the CE bot is the sender or the chat is shared with CE.
- If the OpenClaw Telegram integration has its own bot token, OpenClaw may render its own inline buttons and forward button callbacks to CE as preference drafts. Those buttons are OpenClaw-owned, not CE-owned.
- If OpenClaw has no associated Telegram bot or client integration, it cannot render Telegram-native buttons; it can only produce text or links through whatever host channel is available.

Prefer the shared-group pattern when CE-owned response buttons matter:

1. User + OpenClaw bot + CE bot are present in one group or topic.
2. OpenClaw calls `POST /api/agent/questions/pose`.
3. CE bot posts the question with CE response buttons.
4. User taps the CE button, and CE handles the callback.

## Lightweight Telegram Groups

Telegram-only sessions may expose Cloudflare-managed group categories without
on-chain SBTs. Groups are optional user self-selections and must not be treated
as submitted until the user approves them.

Read available group categories and current selections:

```http
GET /api/agent/groups
GET /api/agent/groups?sessionSlug=<slug>
```

Propose or create a group category, while leaving membership to the user:

```http
POST /api/agent/groups/propose
```

```json
{
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
user, call `GET /api/agent/onboarding`. If `completed` is false, ask
the user this fixed series of yes/no consent questions and persist their
answers with `POST /api/agent/onboarding`:

1. Can I pass preferences and calendar info to CE to surface relevant questions?
2. Can I link non-identifying information (demographics, attendance week) to your responses for research purposes?
3. Can your agent draft question responses for you based on your activity and user file?
4. Can CE store privacy-preserving draft-edit metrics for research?
5. Can your agent upvote questions it thinks you will find relevant?
6. Want CE questions in your morning or evening Edge brief?

If the user says yes to the Edge brief, also ask: "Do you prefer the morning or
evening Edge brief?" Persist the answer as `digestTimeOfDay: "morning"` or
`digestTimeOfDay: "night"`.

These answers map onto `allowedProfileFields`, `allowedUses`, `approvalMode`,
`topicPreferences`, `demographicLinkOptIn`, `attendanceLinkOptIn`, `draftDivergenceOptIn`,
`agentAutoApplyQuestionVotes`, `dailyDigestOptIn`, and `digestTimeOfDay`. Auto-apply votes remain
off unless the user says yes to question 5. Demographic-link, attendance-link,
and draft-divergence settings remain off unless explicitly enabled. The digest
flag stores morning/evening Edge brief preference; the host agent or digest
runner handles delivery.

For Edge-native Hermes/OpenClaw, do not present this section as a long raw form
when a shorter consent prompt plus profile inference is available. Treat these
items as the settings that must be persisted, not necessarily the exact words to
show. Never expose "under the hood" token, endpoint, or storage details in the
onboarding message.

## Changelog

### 2026-07-18 (v42)

- Documented transport-neutral one-time invites, opaque non-Telegram
  principals, session-bound user/service credentials, root-only bootstrap, and
  audience-correct browser exchange.

### 2026-06-16 (v41)

- Documented that Session Wrapped uses Agent Only Mode, not the ordinary
  trusted invite question/draft flow.

### 2026-06-08 (v38)

- Clarified that Edge-native Hermes/OpenClaw onboarding should ask permission
  to use authorized profile/activity data before bucket setup, treat group
  fields as a storage schema rather than a user-facing checklist, and avoid
  narrating token or endpoint mechanics to the user.

### 2026-06-08 (v36)

- Added a stricter direct-submit success contract: agents must require returned
  request ids, no skipped target questions, and follow-up authenticated question
  verification before telling users an answer was recorded.
- Documented the authenticated `myAnswer` echo on question reads so agents can
  verify the submitted value without relying on local state or stale Geo-node
  instructions.

### 2026-06-08 (v35)

- Strengthened copied-token handling instructions: agents must never display,
  mask, summarize, or recap `ceagt_...` credentials, and should rotate/re-onboard
  if a token is exposed in chat or logs.

### 2026-06-08 (v34)

- Agent question listings now annotate the current user's submitted questions
  and sort ordinary batches unanswered-first, so host agents can fetch
  `limit=20` and avoid repeating answered questions.
- Clarified Edge-native onboarding: ask permission to use Edge profile,
  interests, calendar, and non-identifying research buckets first; a plain
  "yes" can accept the recommended setup, and agents should infer buckets from
  authorized Edge context before asking manual follow-ups.

### 2026-06-08 (v33)

- Added a Digest / Hermes Cron Install section: register the skill directory in
  the host's external-skills config, bind cron to the exact installed slug (not
  the interactive alias), keep one prepare job per digest slot, and surface the
  top three locally-ranked questions with sponsored-first ordering and consented
  draft answers.

### 2026-06-08 (v32)

- Already-onboarded Telegram users can mint fresh copied agent install info
  from the bot instead of getting stuck at a Mini App-only screen.
- Clarified the trusted invite refresh loop: on `agent_token_*` 401s, re-run
  invite onboarding with the observed Telegram id, replace the stored token,
  and retry once without making the user redo completed preferences.
- Mini App question cards now constrain long prompts, rating sliders, and
  answer controls to the Telegram viewport.

### 2026-06-08 (v31)

- Direct-submit preference calls now fail closed with
  `direct_submit_incomplete` when a requested answer is skipped instead of
  returning a draft-only success that an agent could misreport as submitted.
- Agents now verify `submittedCount === submitRequestedCount` before telling a
  user that chat-submitted answers were recorded, and keep question IDs out of
  normal user-facing summaries.
- Submit records receive server timestamps when callers omit `createdAt`, so
  admin metrics can count recent real responses reliably.

### 2026-05-31 (v30)

- Scheduled digests now instruct agents to fetch a question batch and rank it
  locally, using `/questions/next` only for sponsored queues or cursors.
- The scheduled prompt loop now direct-submits explicit chat answers instead of
  defaulting to Mini App draft review.
- The worker skill endpoint now redirects to the public `main` skill file
  instead of a stale pinned commit URL.

### 2026-05-31 (v29)

- Admin metrics now respect the Telegram session cutoff by default, with an
  explicit `includeLegacySessions=1` escape hatch for historical sweeps.

### 2026-05-31 (v28)

- Added opt-in draft-edit research metrics for agent, bot, and Mini App answer
  flows, recording answer transitions and length buckets without raw freeform
  text or comments.
- Admin metrics now count draft-edit metric records per session.

### 2026-05-31 (v27)

- Clarified that Hermes should present Context Engine concisely from Geo, with an `Enable Context Engine` link/button serving as the user's affirmative acknowledgment.
- Clarified that Edge agents should avoid long onboarding recaps and ask only the next needed preference or consent question.
- Clarified that post-submit confirmations should be brief and conversational, avoiding API/Mini App mechanics or full answer recaps unless requested.

### 2026-05-30 (v26)

- Clarified that Hermes and other Edge agents should cache or install the fetched Markdown skill locally, then refresh it only when `/skill-version` or question-response update fields indicate a newer or flagged skill.
- Clarified that `contextEngine.skillUrl` is a Markdown instruction URL, not a callable tool name, so Geo-node instructions can stay short and point at the skill as source of truth.

### 2026-05-30 (v25)

- Accepted per-answer `submit: true` plus `humanApproved: true` in agent preference arrays so chat agents can direct-submit approved answers even when they attach flags beside the answer.
- Clarified that agents should choose relevant questions with their own consented context, suggest a response when useful, and present CE conversationally instead of exposing API internals.

### 2026-05-30 (v24)

- Hardened trusted Geo/Hermes token handling so bearer headers may contain copied wrappers, invite onboarding can read nested `contextEngine.inviteToken`, and stale token errors direct agents back through invite refresh when available.
- Updated Geo-node guidance to keep metadata concise, fetch the live skill URL as source of truth, store returned `ceagt_...` tokens in private auth context, and express "accept all" onboarding as normal explicit answers.

### 2026-05-30 (v23)

- Clarified that Edge-native Hermes/OpenClaw flows should complete relevant onboarding before questions, while Claude Code copied-token flows skip onboarding and fetch questions first.

### 2026-05-30 (v22)

- Hardened trusted Geo/Hermes onboarding to use hash-only invite configuration and numeric Telegram ids only, without collecting Telegram usernames.

### 2026-05-30 (v21)

- Documented the Geo invite shape and clarified that Hermes should onboard with the observed Telegram `from.id` into the invite's configured session.

### 2026-05-30 (v20)

- Added trusted Geo/Hermes invite onboarding: a Telegram-native agent can exchange a Geo invite token plus observed Telegram user id for a user-scoped `ceagt_...` token, then continue with the normal CE question flow.

### 2026-05-30 (v19)

- Made daily digests, late editions, and new-question summaries direct-answer first; deep links are now secondary fallback only when they open the exact question or the user asks for Mini App/client review.

### 2026-05-30 (v18)

- Clarified that copied-token agents must automatically surface the first relevant answerable question after reading `/api/agent/questions`, instead of asking whether to do anything next.

### 2026-05-30 (v17)

- Made copied install info point agents at the full `/api/agent/questions` route and added a human-facing question card format so agents present questions cleanly instead of dumping raw fields.

### 2026-05-30 (v16)

- Made copied-agent install text host-neutral while preserving bearer-token, no-ID, fetch-questions-first instructions for Claude Code, OpenClaw, Hermes, and other HTTPS-capable agents.

### 2026-05-30 (v15)

- Made copied-agent instructions explicit that `ceagt_...` must be sent as `Authorization: Bearer <token>` on every CE request; no copied-token call should be unauthenticated or ask for Telegram identifiers.

### 2026-05-30 (v14)

- Shortened copied-agent skill links through the worker-hosted skill redirect and added a compact copied-text instruction so Claude Code sees "no IDs; fetch questions first" even before refreshing the full skill.

### 2026-05-30 (v13)

- Clarified that Claude Code and other low-context copied-token agents should skip full Edge-agent onboarding, fetch questions immediately, and draft answers from available memory/conversation unless the user explicitly asks to update settings.

### 2026-05-30 (v12)

- Added a top-level copied-agent-info rule for Claude Code: user-scoped tokens already imply user identity and current/default session, so agents should fetch questions and draft answers immediately without asking for Telegram ids.

### 2026-05-30 (v11)

- Clarified Claude Code install handling further: copied user-scoped agent info does not require a Telegram handle, Telegram id, or group chat id.

### 2026-05-30 (v10)

- Clarified Claude Code install handling: copied `ceagt_...` install info is enough, and agents should not ask for a Telegram handle or id.

### 2026-05-30 (v9)

- Shortened first-run onboarding to six consent prompts, combining preferences with calendar context and demographics with attendance-week research linking.
- Reworded the digest prompt around morning/evening Edge brief preference.

### 2026-05-30 (v8)

- Reworded the Edge attendance permission around asking relevant event-related questions, while keeping attendance bucket sharing opt-in.

### 2026-05-30 (v7)

- Onboarding can auto-fill consented attendance and role buckets from authorized profile/bio context, and asks follow-up bucket questions when profile data is missing.
- Clarified that agents should infer Edge weeks and role only after the user opts into those research buckets.

### 2026-05-30 (v6)

- Made agent onboarding paste parsing and token handling explicit; agents must never echo `ceagt_` tokens.
- Documented direct human-approved answer submission with `submit: true` plus `humanApproved: true`; Mini App review is optional, not required.
- Added morning/night digest preference guidance via `digestTimeOfDay` and clarified draft edit tracking is for research.

### 2026-05-30 (v5)

- User-scoped `ceagt_` tokens now follow the user's selected/default session instead of being locked to one session; sending an existing `sessionSlug` switches and pins the user.
- Agent onboarding docs now cover opt-in topic preferences, consent-gated aggregate bucket membership writes, and the quick preference flow.
- Documented the 20-question create batch limit and the 20 + 20 + 10 pattern for 50 organizer questions.
- Added the public-release edge allow rule expectation for publishing the Telegram worker and skill on the `main` branch.

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
  `/api/agent/onboarding` stores first-run consent answers.
- Admin agents can revoke group approvals; group approval now requires verified
  admin action inside the target group.
- Telegram group access is closed by default unless a group is statically or
  dynamically approved, or the session explicitly enables open group access.
- The confusing `/actions` Telegram command was removed; use `/agent` for the
  agent menu and `/activity` for recent activity.
- The worker exposes `/api/agent/skill-version` so agents can check
  whether their installed skill is current.
- Admin agents can read aggregate bridge metrics through
  `/api/agent/admin/metrics`.
- Agents can create approved batches of proposed questions from
  agent-summarized URLs with durable `references` citations.
- Agents can read active tag counts through `/api/agent/tags` before
  creating new question tags.
- Agents can create Mini App question-series launch links with editable
  prefilled drafts through `/api/agent/mini-app-launch`.
