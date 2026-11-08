# Session Voice Modes

The microphone on `/session/<slug>` opens a modal with two participant workflows:

- **Interview** — one responder speaks with a realtime interviewer. Context Engine maps the completed responder transcript into reviewable response drafts and may suggest new questions for review.
- **Group Conversation** — records a discussion, creates a rolling transcript, and generates reviewable question drafts.

The session links are:

```text
/session/<slug>?mode=voice
/session/<slug>?mode=interview
/session/<slug>?mode=groupRecording
```

The direct links open the selected modal panel; `?mode=voice` opens the
launcher, as does clicking the microphone without a mode query. The launcher's
two choices sit side by side, each with a question mark that shows what it
does. Below them, a bordered **Let your AI draft your answers** card holds the
ChatGPT or Claude prefill prompt (see below). Picking a choice replaces
`?mode=voice` with its own mode.
`?mode=listening` still opens the pile-adjacent group recorder. Any other
`mode` value, such as `recordGroup`, opens nothing and is removed from the
address. `joinGroup=<id>` is a separate query parameter that can sit beside
`mode`; it asks to join an open Worker group.

`interviewModeEnabled` is a per-session public config value. It defaults to
`true`; setting it to `false` hides the microphone entry point and makes the
public interview-brief endpoint return `404`.

## Interview

Interview mode sends an SDP offer and interviewer instructions to the
session's own Cloudflare Worker. The Worker creates a GPT-Live session through
`POST https://api.openai.com/v1/live/sessions` using its own `openaiKey`; the
browser never receives that key. The default model is `gpt-live-1`. The JSON
request carries `session: { model, instructions,
store: false, delegation: { type: "client" } }` and `transport: { type: "webrtc",
sdp }`. Audio is negotiated through WebRTC; Realtime session type, output
modalities, VAD, and transcription-model fields are not sent to Live.

The per-session `interviewMode.realtimeModel` setting also accepts the legacy
aliases `gpt-realtime-2.1`, `gpt-realtime-2.1-mini`, `gpt-realtime-2`, and
`gpt-realtime-1.5`, which keep the Realtime multipart call contract. Worker
config writes reject any other value, and an unsupported stored value runs as
`gpt-live-1`. The provider is OpenAI.
Session creators set the model in `/new` under **Participation** → **Interview
settings** → **Interview voice model**. The **Voice interviews and AI prefill**
checkbox in the same section is the `interviewModeEnabled` switch.

The Interview header shows a colored status pill, such as Ready, Connecting,
Listening, Paused, Ending, Preparing responses…, Review drafts or Error.
Green readiness requires a reachable Worker that confirms an OpenAI key, voice
provider, and session access, plus browser microphone support and no known
permission denial. This setup check does not call OpenAI or request microphone
permission; the live connection still validates the key when Start is clicked.
Yellow indicates loading, pauses, or readiness that could not be verified; red
indicates an error or missing setup. A Worker that cannot report voice readiness
shows **Not checked** rather than green. Click the idle pill to retry the check. Status changes are also
announced to screen readers. The adjacent question-mark tooltip explains the
current phase. A large circular microphone control starts or continues the interview.

Listening requires a connected peer, an open data
channel, a started voice session, and a live enabled microphone. Connecting
keeps the microphone track disabled until readiness. Pause disables microphone
transmission and mutes interviewer playback; it keeps the session connected.
Stop and close immediately stop local tracks, close the peer/channel, and clear
remote audio. Closing during startup also cancels the request and stops a late
microphone grant. Connection, microphone, and playback failures stop capture
and offer recovery.

Stop requests `session.close` on Live as a best effort before immediate teardown.
It does not wait for `session.closed`, so final API usage and any undelivered
transcript tail are unconfirmed. Drafts use only text received before Stop;
review the transcript and edit drafts if the final words are missing. Stopping
prepares drafts. Closing ends the live session without preparing drafts and keeps
the captured transcript and any review in memory; reopening resumes them, and
the trash button beside the microphone discards them after a confirmation.

The contract follows OpenAI's [WebRTC guide](https://developers.openai.com/api/docs/guides/voice-webrtc?api=live),
[session lifecycle guide](https://developers.openai.com/api/docs/guides/live-conversations),
and [Live migration guide](https://developers.openai.com/api/docs/guides/live-migration),
verified September 10, 2026. Live waits for `session.started` and requests a
greeting through `session.instructions.append`; it does not send
`response.create` or a second `session.start`. No live task backend is invoked:
a client delegation receives a factual notice that drafting happens after Stop.

The shipped `demo-interview` client record pins its deployed Worker and enables question suggestions.
A session listed in the repo's `known-sessions.json` opens from its normal link:
`/session/<slug>?mode=interview` bootstraps and verifies the live config from the listed
Worker, and opens only when that config carries the listed session ID, so the public URL needs
no visible `worker=` parameter. Registry-backed sessions likewise read `corsWorkerUrl` from
registered session metadata. Any other Worker-canonical session needs a `worker=<origin>` link
for first-time visitors.

The interviewer starts directly with a topic-relevant question, without a
greeting or preamble. It follows the responder's direction, chooses relevant
existing questions, and asks useful follow-ups. Sessions may add
`interviewMode.steeringPrompt` for owner-authored interview guidance. The value
is trimmed, capped at 3000 characters, and inserted as its own paragraph after
the fixed two-line realtime preamble and before the opening question. Empty
values are omitted.

In Group Conversation mode, the recorder keeps the captured transcript when the participant records more.
When an eligible completed transcript segment is available and no transcription chunk is pending, the client asks
the configured session AI to draft questions automatically. The part completed last decides: text pasted or
uploaded after the last transcribed chunk waits for **Generate questions**, while a chunk that finishes
transcribing after such text still drafts automatically. New drafts append to the existing editor, while exact
ID or prompt duplicates are skipped and prior generated prompts are included as avoidance context. Manual retry
remains available after a generation error; the client does not auto-retry unchanged transcript text in a loop.

Session `interviewMode` settings are available under **Participation** on `/new` and on the session's settings page:

| Setting | Default | Behavior |
| --- | --- | --- |
| `openingMode` | `auto` | Generate an opening from session information and public questions; `owner` uses the owner's text. |
| `openingPrompt` | empty | Owner-written opening, required in owner mode. |
| `steeringPrompt` | empty | Optional owner-authored guidance inserted into the live interviewer instructions before the opening question; capped at 3000 characters. |
| `autoRegenerate` | `false` | Refresh the generated opening when enough questions have been added. |
| `questionGrowthPercent` | `20` | Additions needed since the last successful generation or conversation update, rounded up to at least one. |
| `followNewQuestions` | `false` | Check the public question catalog every 30 seconds during active recording and append qualifying additions to the interviewer's context. |
| `suggestQuestions` | `false` | Propose up to three new respondent-grounded question drafts when preparing responses. Drafts may be freeform, rating, binary, multichoice or quadratic; multichoice and quadratic drafts include suggested options for review. |
| `allowManualRefresh` | `true` | Enable **Regenerate interview opening** for session admins. |
| `shareDraftChangesByDefault` | `true` | Initially check **Share for research**, beside **AI submission info**, for new responses. Participants can change the checkbox before submission; saved per-question choices take precedence. |
| `researchDetail` | `minimal` | What a shared draft comparison keeps: `minimal` has no AI notes or drafted text; `full` adds them and drafts for skipped questions. `full` needs a Session Worker newer than 0.8.0. |
| `hiddenDraftShare` | `0` | Share of each participant's AI-prefill drafts, up to 0.5, hidden until they answer, while they share draft changes. Above 0 it needs a Session Worker newer than 0.8.0. |
| `showFidelityScore` | `false` | After someone submits AI-prefill drafts, show them privately how well their AI predicted them. Needs a Session Worker newer than 0.8.0. |
| `suggestGroups` | `false` | After an interview or AI prefill, list the session's open groups that fit the participant's answers under their drafts, unticked; submitting joins any they tick. Needs a Session Worker newer than 0.8.0. |
| `joinMatchingGroups` | `false` | List those groups too, with strong matches ticked, so submitting joins them unless the participant unticks them; the participant's own AI can suggest groups through the prefill catalog. Needs a 0.9.1 or later Session Worker. |
| `showFidelityResults` | `false` | Add **How well AIs predicted people** to the Results report once its responses include AI-prefill drafts from `fidelityMinimumPeople` people. Needs a Session Worker newer than 0.8.0. |
| `fidelityMinimumPeople` | `5` | Smallest number of people, from 1 to 50, that any figure in that section describes; 1 (**Off**) shows every figure. A changed value needs a Session Worker newer than 0.8.0. |

**Measure how well AI represents participants**, at the top of Interview settings, sets `shareDraftChangesByDefault`, `hiddenDraftShare` (1 in 5) and `showFidelityScore` together, with `interviewMode.enabled`, and leaves `showFidelityResults` and `fidelityMinimumPeople` alone. It also sets the top-level `interviewModeEnabled`, so it turns voice interviews on. It shows as on while all three research settings are, whatever hidden share is chosen, and turning it off restores their defaults.

Auto mode generates on the first Interview opening with available public questions and permitted session AI access. No separate admin setup step is needed for an open AI-enabled session. An empty bank waits until questions exist. The Worker uses the session's AI provider and key and caches the result at `session:<slug>:interview-opening`, with the generation time and baseline question count, separately from owner configuration. The default reuses this opening even as the bank grows; enabling regeneration checks the threshold on the next Interview opening. For example, 42 questions require nine additions at 20%. A failed refresh retains the previous opening. Initial failure visibly falls back to an existing session question.

Live updates use [`session.instructions.append`](https://developers.openai.com/api/reference/typescript/resources/live); supported legacy sessions use [`conversation.item.create` system messages](https://developers.openai.com/api/reference/typescript/resources/realtime). These updates never restart the conversation or replace its opening. Pause and Stop cancel polling and discard late results. Discovery uses the existing public catalog's visibility checks and 100-question limit; private questions are not added through this public discovery path. There are no edit-based or scheduled regeneration conditions.

Live capacity notes for 100-person tests, checked September 19, 2026:

- [`gpt-live-1`](https://developers.openai.com/api/docs/models/gpt-live-1) rate limits are measured in concurrent sessions. The published tiers are Tier 1: 25, Tier 2: 50, Tier 3: 200, Tier 4: 300, and Tier 5: 500 concurrent sessions; Free is not supported. A 100-user live-voice test therefore needs at least Tier 3 for the live model itself.
- OpenAI's [rate-limit guide](https://developers.openai.com/api/docs/guides/rate-limits) also applies to the backend text/model calls used after Stop. Confirm the organization's actual Limits dashboard before the test because limits vary by model and can include RPM, TPM, and audio-minute ceilings. The current account tier and remaining allocation are not knowable from this repository.
- Organization and project limits both matter. OpenAI documents org/project rate limits and project-scoped headers, while [spend limits](https://developers.openai.com/api/docs/guides/spend-limits) can be configured at either org or project level; project settings cannot make traffic succeed after an applicable organization limit or approved usage limit is exhausted.
- Context Engine does not currently enforce app-level voice spend or duration caps. The practical cap is the configured OpenAI allocation plus the session Worker and browser paths.
- Authenticated submission paths request Worker nonces. The current defaults are five nonce requests per wallet per minute and a separate 300-request shared-network limit per session per minute, coordinated by the Worker. Distinct venue participants do not share a five-request allowance. Shared-network/provider concurrency still needs a venue rehearsal; these constants do not prove a capacity level.
- A read-only 100-browser GET test is not equivalent to 100 live voice sessions plus response submissions. Headless browser coverage can use virtual WebAuthn PRF for auth flows, but it should be planned as a separate load profile from read-only page fetches.

Suggested questions follow the response drafts in an expandable **Suggested new questions** section, initially open, using pile-style question cards with editable prompts and tags. Interview review hides the survey/questions toggle and manual question-type selector; the normal authoring surface retains them. A help tooltip beside the section heading explains that suggestions remain drafts until uploaded. Both review sections use matching headings and support keyboard collapse/expand without losing edits. Questions can be edited or removed and require the normal explicit creation/sign-in/permission flow; stopping an interview and submitting response drafts do not create questions. Suggested questions are visible before sign-in so the responder can review them, but after sign-in the section stays hidden unless the connected participant is allowed to create questions for that session. Unresolved group, SBT, or custom permissions keep the section hidden in the UI, and the backend still enforces the upload. Suggestions share the response-mapping request, avoiding an extra model round trip. That request also generates short, non-identifying tags, prefers relevant session `defaultTags`, and incorporates `questionsGenPrompt` guidance. Default tags are suggestions rather than a restricted vocabulary; users can add or remove tags before upload.

When a session turns on `interviewMode.suggestGroups` or `interviewMode.joinMatchingGroups` (both off by default), Interview review shows a collapsible **Groups** section right below the drafts, both after a voice interview and after an AI prefill. Each group in it has a tick box:

- A join link's group (`?joinGroup=`) still waiting for sign-in comes first, ticked, marked “From your link.” Unticking it cancels that link's join in this browser, as the link notice's **Cancel** does, and ticking it again restores the join; an untick made while sign-in is still reading the groups stops that join too. While the dialog is open and the join is waiting, the link's own notice stands aside; once someone signs in, joining and its outcome show in the notice as before, and a group they join leaves the section.
- Then the groups that fit the person's answers. A group named exactly like the option the person chose, or their AI drafted, on a single-choice question comes first, with the reason “You chose “d/acc”.”; case and extra spacing don't matter. Only drafts the person keeps selected count, so a removed draft, or an unchosen one for an answer they already saved, is left out. With `joinMatchingGroups` on, groups the person's own AI suggested in its prefill packet come next. These need no AI call, so they show at once. The session's AI covers the remaining groups, using only explicit reviewed respondent evidence, with question prompts supplied as context for short binary, rating, or multiple-choice answers; interviewer text, names, accents, and weak topical mentions are not enough. Still-hidden AI drafts are left out until their guess is shown. If the AI suggestions fail or take longer than 30 seconds, the earlier matches still show. Every match that fits is listed; there is no cap.

Each match carries a confidence from 0 to 1, and a name match counts as 1. With `joinMatchingGroups` on, matches of 0.7 or more start ticked and weaker ones unticked; with only `suggestGroups` on, all start unticked. While anything is ticked, the submit button reads **Submit and join**. A link's group joins at sign-in, as links always have; the ticked matches join only after the answers save. For those, the app reuses the submit's Worker sign-in, checks each ticked group against the signed-in catalog, counts groups the person already belongs to as joined, and joins the rest through the Worker's `/groups/join` route. It then says which groups it joined, and for each one it couldn't, why: full, closed, no longer open, or a sign-in problem. A failed group stays ticked, with **Join ticked groups** to try again; groups ticked after submitting join the same way, and a match that first appears after a submit starts unticked, since the person didn't see it when they chose. A failed submit joins none of the matches, and the Worker still enforces every join.

The section lists only open, unexpired, session-visible groups the person hasn't joined. Signed in, suggestions use the person's saved Worker sign-in, never asking for a new one. Without one, they use the unsigned group list, which a public session shows to anyone and a private session shows only to someone holding a join link to a group they could join on their own, and then only what that group's members see. A signed-out visitor on a private session without such a link sees no suggestions. Suggestion failures do not block submitting answers or editing and uploading suggested questions. The section stays through another interview round, out of sight, keeping its ticks. If a reviewer edits or removes a response after suggestions appear, the listed groups and their ticks stay until the reviewer chooses **Refresh group suggestions** in the section, which replaces them. With both settings off, nothing here changes: participants join groups from the session's **Groups** section, and a join link joins at sign-in.

Only responder speech becomes
answer evidence. Interviewer questions are retained as context so short replies
such as “four” can be matched to the question asked. Live input and output
transcript fragments are retained exactly, deduplicated by event ID, and ordered
by session time. Supported legacy Realtime sessions retain completed responder
transcriptions and interviewer output turns, deduplicating repeated completion events.
**Continue interview** continues the existing conversation. Each round appends to the transcript, and mapping reviews the combined evidence alongside earlier predictions and user-reviewed responses. Changed predictions retain numbered versions with model IDs in local review state; consented research submission includes those versions and applies the same answer/comment encryption redaction to every version. Research controls also appear after a voice-only continuation revises a prediction. Declining research excludes the history from submitted metadata. Existing matches are retained, untouched AI fields can be refined, and user edits and excluded drafts are preserved. Suggested question prompts and tags also survive continuation; only novel suggestions are appended. A failed connection or a round with no new speech leaves the previous review intact. The transcript is kept in memory only and is not restored after a reload.
New speech is mapped even if the interview started with imported predictions. When the call ends, the responder can
expand a read-only transcript disclosure while the session's configured thinking model,
with at most 8,000 output tokens and reasoning effort capped by the owner's setting,
maps the transcript and any responder context imported by an AI prefill link
to response drafts. Imported context remains editable in a collapsed
**Imported responder context** disclosure; during a normal voice-only interview
that context editor is absent, keeping the microphone as the primary action.
Drafts may include comments,
importance, and conviction only when the evidence explicitly supports them.
Every generated draft also carries a confidence value from 0 to 1. From prompt
version `ce-interview-brief-v6` it is the AI’s estimate of the chance the
responder keeps the draft unchanged, which research can check against what they
submit; earlier versions estimated how well the evidence supports the draft. The
review panel labels it **AI-estimated confidence** and renders it as weak
inference (0–39%), moderate support (40–69%), or strong support (70–100%) so a responder can keep, edit, or reject tentative answers
instead of losing useful low-confidence signal.
If the evidence cannot support any session answer, the modal says that there
is not enough information, explains that no directly relevant detail was
found, and suggests another interview or relevant Claude/ChatGPT memories. It
does not present an unchanged generate button as though more input had arrived.

Drafts open in a collapsible **Review proposed responses** section with the session's answer inputs, additional
comments, conviction/importance control, and answer/comment lock menus. The
readable answer and comment text is shown by default; tapping or pressing Enter
opens editing. Prose draft editors keep microphone dictation and autosize to the
full text, but hide the AI rewrite/cleanup action inside interview draft review.
Icon tooltips explain the remaining actions on hover and keyboard focus.
Relevant interview explanations appear as editable additional comments. A single glowing robot icon
beside the footer/comment controls marks an untouched AI-proposed response; it
stays through focus-only review and disappears after any real answer, comment,
importance, or conviction edit. The responder selects which drafts to submit and
must explicitly opt into replacing an existing local answer. Selected drafts have
an **X** that removes the whole card from review and excludes its answer from
submission. Removed cards stay hidden during continued interviews. Drafts that
conflict with an existing local answer remain visible with **Replace with draft**
until the responder explicitly selects them. **Submit responses** saves reviewed values and enters the
normal submission flow, opening sign-in when necessary. Drafts survive sign-in,
and the modal resumes the normal response upload after the authenticated
response state has rehydrated. Canceling sign-in leaves the review open without
submitting; after a successful submit the submit button changes to
**Responses submitted**, and a **View results** action appears after five seconds
when a results handler is available. The modal remains open so suggested
questions can still be reviewed or uploaded separately. Editing a draft after
submission clears the success/results affordance until the reviewer submits
again. The **Submit responses**
and **Upload Questions** actions share the pile view’s submit styling. **Upload
Questions** remains inside Suggested new questions and uses the normal question
upload flow. Stopping alone never submits answers.
The platform provenance option appears only when an AI augmentation packet was
imported. When it is retained, submitted response metadata keeps the
prompt/question-set revision and self-reported source platform/model. A separate
**Share for research** checkbox, beside **AI submission info**, appears when
imported or voice-generated AI drafts or prediction revisions are being
reviewed, and it is on unless the session's `shareDraftChangesByDefault` turns
it off. The platform checkbox is labeled **Include platform/model
provenance**. An **AI prefill metadata** disclosure explains the included
platform, revision, question-set hash, coverage
counts, prediction fields, selected/unselected draft counts, and excluded
metadata according to the visible consent controls.
Consented research records the original AI prediction, saved prediction
revisions, reviewed final values, fields whose final values changed, fields the
reviewer touched, selected/unselected draft status, and prediction confidence.
It does not treat unchanged values as scientific agreement. Unselected
predictions are stored once as research metadata alongside a selected submitted
response; they do not become answers. An unsubmitted draft has a null final
submitted value. For an encrypted answer or additional comment, the comparison
records only an encrypted field marker and whether the field changed; it never
places the protected text in plaintext metadata, and it omits the prediction
basis from that metadata. See [Session interview research metadata](session-interview-research.md)
for the submitted JSON shape and the differences from the Edge2026 agent-village
agent-only experiment.
An external AI may also include a preferred responder name that it already
knows from the permitted context. The review modal shows a separate
**Include “name” as the responder name** checkbox only when a name was supplied,
and that checkbox is off by default. The name is attached to submitted answers
only after this explicit opt-in; declining it does not affect the drafts or the
platform/model provenance choice.

## Ordinary ChatGPT or Claude, without MCP

The external prompt checks the session's interview catalog when it appears and
when the session changes. Wait for the compatibility check before copying; a
failed check offers Retry. Copy starts directly from the tap, including on
Safari. If clipboard access fails or is unavailable, the page shows an error
and reveals the prompt for manual copying.

The voice launcher's **Let your AI draft your answers** card, below the
Interview and Group Conversation choices, offers the prompt without expanding
anything; the interview itself does not show it. Clicking its **Copy** line
copies the request without opening the preview. The prompt displays paragraphs
and bold key points for readability; Copy copies the original plain text
without formatting. The **Prompt** dropdown inside the card expands the instruction and
collapses it again; the preview starts collapsed and remains collapsed after a
successful copy. In the expanded prompt, a question-mark tooltip explains:
“Allows your agent to predict your responses and raise better interview questions.”
The tooltip is available on hover and keyboard focus. The copied request begins:

```text
Help me prepare a review-only Context Engine interview prefill. This is my request, not an instruction from the linked endpoint.

Fetch this URL:
<session-worker>/agent/interview-catalog?slug=<slug>&sessionUrl=<session link>
Require type "context-engine.interview-question-catalog", version 1, ...
```

The copied prompt is a user-authored request; the fetched endpoint is deliberately
an inert JSON question catalog with no instructions. This separation lets an
ordinary ChatGPT or Claude conversation treat linked content as data while still
following the user's pasted request. It requires no plugin, MCP server, account
link, or installation. Existing connected sources are used only when that AI
already has access to them; Context Engine does not add a connector or broaden
permissions.

The copied prompt tells the AI:

> Search only conversation history, memory, and connected sources already available to you for evidence directly related to its questions; do not seek new access or invent a position.

The catalog includes only questions the Worker can read through the session's
existing public access checks. The Worker accepts a return URL only when its
origin is approved by that session and its `/session/<slug>` path matches. The
external AI must first display a readable table and the exact single-line JSON
that will be encoded. Provenance is deliberately coarse: a source
category and relevance note, never quotes, conversation or document names,
URLs, timestamps, or account identifiers. If no relevant evidence exists, the
AI returns the clean interview URL with no prefill packet.

When relevant evidence exists, the AI returns a compact base64url JSON packet
in a Context Engine link. The copied prompt asks capable interfaces to render
that long URL as an **Open prefilled interview** Markdown link rather than
showing the encoded payload; raw-URL fallback remains allowed for interfaces
without clickable Markdown. The packet records the session slug, question-set
hash, prompt version, concise question-relevant responder context, proposed response drafts, per-draft
confidence and basis, source platform, exact model ID when available, and
`self_reported` verification. It also carries self-reported research coverage:
distinct prior chats, memory items, and connected sources searched and used,
plus the number of distinct user-authored statements used as evidence. A
searched count is `null` when the platform does not expose it; zero means the AI
reports that it used none. The review modal shows these counts before drafts are
applied, and retained model provenance keeps them beside the eventual prediction
comparison. Low-confidence responses are allowed when the AI
has a defensible indirect signal and explains its basis; questions with no
relevant signal are omitted. When an older v4 catalog cannot represent a
multiple-selection answer, the prompt also requires omitting that draft and
disclosing the limitation instead of losing some selections. Model identity is collected to measure prediction
fidelity across models and may be `unknown` when the interface does not expose
one. The copied prompt does not ask for a responder name; if a packet includes
one, the client submits it only when the responder ticks the default-off name
control. The packet contains no
credential and is carried in `#prefill=...`, so it
is not sent to the web host as an HTTP request target. The fragment is still
intentionally readable by scripts on the destination page, which is why source
identifiers are forbidden and the exact JSON is shown first. The current catalog prompt version is
`ce-interview-brief-v6`. The copied request accepts a catalog with type
`context-engine.interview-question-catalog`, schema `version: 1`, the expected
session slug, and prompt version v4, v5 or v6, and states confidence by that
version: for v6 the chance the responder keeps the answer, for v4/v5 strength of
support. Unknown or inconsistent contracts must stop generation. The packet
copies `prefillPromptVersion` to `promptVersion` and retains `questionSetHash`
exactly; a version or hash must never be relabeled as another.
The distinct `/agent/interview-catalog` URL avoids stale external brief fetches.

With `interviewMode.joinMatchingGroups` on, the catalog also lists the groups the visitor could join on their own, with their names, descriptions and tags, as data like the rest of the catalog. It lists them on a public session, or on a private one when the session link in the request carries a join link's group, and then only what that group's members see. The copied prompt itself, not the catalog, gives the format: when groups are listed, add `"groups":[{"groupId":"...","reason":"...","confidence":0.8}]` for any that clearly fit, with confidence scored like answers. The client reads at most 100 picks, keeps each listed group once, trims reasons to 240 characters and clamps confidence to 0–1, and checks every pick against the live groups before listing it, as “Your AI: …”.

The answer contract is question-specific:

- Binary answers use one exact option: `Agree`, `Unsure`, or `Disagree`.
- Ratings use the question's `scale` bounds and labels. Only questions without a
  scale use `answerContract.rating` (the current catalog default is 0–10).
- V5 and v6 multichoice questions include boolean `singleSelect`. `true` takes one
  exact option string; `false` takes an array of exact option strings. Missing
  or invalid selection metadata is not permission to assume multiple selection.
- V4 multichoice uses one exact option string. Missing `singleSelect` does not
  indicate multi-select support. If the evidence requires several options,
  omit that draft and explain the older catalog's limitation.
- Quadratic answers are signed integer arrays in option order with squared
  cost within `voiceCredits` (99 when absent); neutral zeros and unused credits
  are valid.

The additive `researchCoverageContract` describes self-reported count fields,
not agent instructions. Existing v1–v5 packets remain importable with their
original fingerprint rules and current question validation. V5 and v6 hashes
include selection mode; v1–v4 hashes do not. Source compatibility does not prove
a live frontend or Worker has been updated: verify both served contracts during
an authorized rollout, especially before generating v6 packets.


When Context Engine opens that link, it validates the packet, requires the
session slug and question-set hash to match, removes the fragment from browser
history, and validates the AI-authored response drafts against the current
questions and listed options. Current direct responses are not re-authored by a
different mapping model, so their source attribution and confidence remain
faithful to the external AI. Every proposed answer remains a local review draft.
The link is read by the same decoder as setup links
([session-creation-guide.md](session-creation-guide.md#templates-and-share-links)):
spaces, line breaks and `=` padding from a wrapped chat link are ignored, and
data that isn't UTF-8 is refused rather than repaired. A link that was cut off
or damaged opens the interview with the reason, even without `?mode=interview`,
and a box for the JSON packet the AI returned with the link: **Review these
drafts** imports the pasted packet with the same checks. A packet without a
required field, such as `questionSetHash`, names it. Drafts are never dropped
silently: a notice counts those left out because they were incomplete or
repeated, and those that fit none of the session's questions or their options.
A prefill link opens the interview on its drafts with one status line, such as
“Your AI drafted 6 answers · Claude, self-reported”, and the microphone reads
**Talk through your drafts**.
When the participant starts or continues the live voice interview after a valid
prefill is loaded, the realtime interviewer receives a bounded JSON background
block with the imported summary/facts, question-matched predictions, and any
fields the participant already edited in review. That block is labeled as
untrusted, unconfirmed AI prediction data: the interviewer can ask useful
confirmation, correction, and gap-filling follow-ups, but it must not treat
predicted answers as spoken beliefs, skip all predicted questions, or override
later spoken clarifications. If the prefill hash is stale or belongs to a
different question set, the live interviewer is not started with the imported
context.
The account used at final normal submission owns the response. If an older
packet contains context facts but not responses, the session AI mapping lane
still converts those facts into drafts.

After an interview, a compact **Transcript** toggle sits beside the microphone.

The review surface shows confidence as a progress meter and keeps each evidence
basis and AI-estimated support level collapsed under **Basis** until requested.
Binary drafts reuse the normal pile-view
Agree/Unsure/Disagree controls. The bullhorn opens both Conviction and Importance
choices. Both values remain editable through review and are carried into submission. Applied source/model provenance is persisted in
the anonymous draft together with its answer, so logging in after review does
not remove the attribution before final submission. An explicitly opted-in
responder name follows the same draft migration and becomes the report display
name for that response address. The accuracy-research choice and original
prediction use the same draft migration; final comparison values are captured
immediately before encryption and normal submission.

The external AI's own memory/source availability is platform-controlled.
Context Engine neither grants it new access nor verifies the claimed model ID;
the provenance therefore stays explicitly self-reported. Enabling past-chat or
memory access in ChatGPT or Claude can make related earlier conversations
available when that platform supports it, but the handoff cannot enable or
override those settings itself.

## Group Conversation

Use **Record** for the microphone, or **+** to upload audio (MP3, M4A,
WAV, MP4, WebM, OGG; up to 30 minutes and 20 MB), upload a `.txt`/`.md` transcript (up to 100,000
characters), or paste a written transcript. Imported input is appended to the
recording, saved on this device, and available to **Generate questions**. An audio
file is decoded once on this device when added, at 16 kHz mono, and joins the
recording as three-minute parts, the recorder's chunk length, saved together in
one write so a reload finds all of them or none. Each part after the first
starts a second early, so a word cut at a boundary is whole in one of them;
stitching drops the repeat. Each part uploads,
retries and keeps its audio until transcribed like a recorded chunk, as a 16 kHz WAV file, so a
stalled upload sends only its part again and nothing decodes or uploads the whole
file later. Decoding can take some seconds on a phone; meanwhile Record waits,
and closing the dialog waits for the import instead of dropping it. A file
longer than 30 minutes, or one the browser can't decode, is refused with a
message and adds nothing. Text import does not request the
microphone or transcription. The input menu is unavailable during capture. Longer
or larger audio files must be split first.

A signed-out question view backed by protected Cloudflare storage explains that
participant sign-in is required. Anonymous AI/transcription access does not itself
make those stored questions public.

`/session/<slug>?mode=groupRecording` opens Group Conversation directly: one
link per breakout room, for the phone that records it. Admins copy it with
**Copy group recorder link**, in the admin page's **Interview & share** panel or on the session's settings
page; it keeps the Worker origin that a Worker-hosted session's links carry.
Opening the link records nothing: recording starts only when someone presses
Record and the browser grants the microphone. If submitting needs a sign-in, it
happens in the usual login dialog while capture keeps running.

Group Conversation reuses the rolling transcription recorder. Recording begins
only after the user clicks Record so microphone permission follows a user
gesture. Capture requests echo cancellation, noise suppression, automatic gain
control, and mono audio. A fresh `MediaRecorder` segment rotates every three
minutes, and completed chunks are sent to the session Worker `/transcribe`
route. Returned transcripts are stitched with overlap deduplication. Rolling
and uploaded audio share Unicode letter/digit matching with original-text
offsets, so trimming an overlap preserves new speech in every script.

While the microphone is capturing, Escape and a tap outside the dialog do nothing, so only Stop or the header close button ends a recording. While recording or paused, the header close button first asks **Stop recording?**: **Stop** ends the recording and closes as below, and **Keep recording** goes on capturing. It closes without asking once capture has stopped. Back, including a phone's back gesture, also leaves the recording running: the page stays and says “Still recording. Press Stop before leaving.” Some browsers, such as Chrome on Android, can still leave on a second Back straight after the first, so press Stop before leaving. Reloading or closing the tab asks first while capturing, while a chunk is waiting or uploading, or while some audio or pasted text is held only in memory, then also after the dialog closes and wherever the app goes, until the reopened recording saves it or it is cleared; the browser shows its own prompt, and iOS Safari shows none. Closing with the close button first stops capture, waits for the final segment to finish transcription, and saves the transcript; once capture has stopped, Escape and an outside click close the same way. The dialog shows **Finalizing recording…** and ignores further dismissals until it finishes. The arrow left of the title, **Back to Voice mode**, finishes the same way and then shows the two choices, with focus on Group Conversation; it's off while capturing and while finishing. **Close and keep the audio** appears only after capture stops, while audio is still waiting or failed; its question mark explains that it closes without waiting. Failed uploads retry automatically with backoff. If recovery still fails, the dialog stays open with Retry and Download audio controls. Saved chunks and completed transcripts return when the same session and account reopen the recorder; recovery does not start the microphone.

Group Conversation opens the transcript once it has text, then keeps the host's
choice; the listening panel starts with it collapsed. An open transcript keeps
its newest line in view as chunks arrive. A host who scrolls up to reread stays
there until they scroll back to the end. Generated questions are drafts
rendered through the existing `CreateQuestionsAndSurveys` review surface and
are never auto-published. Generation uses the session’s `questionsGenPrompt`. A participant with question-authoring permission can review the generated questions and press Submit. Each chunk's audio stays on the device only until its transcript is saved, which replaces it in the same write. Recorder audio, and the voice samples cut from it, leave the device only for the session Worker's `/transcribe` relay, which forwards them to the transcription provider and stores nothing.

Each speaker's label is bold and has its own colour in the transcript
(`--ce-speaker-1` to `-8`, at least 4.5:1 on the transcript's white in every theme).

### Adding the transcript to context

The **Add transcript to context** box sits on the **Submit questions** line and is off
by default. Ticked, it asks who can read the transcript: anyone who can see the session,
or some of its groups, starting with the group the page's link joined. Submitting uploads the
transcript as a text file through the same path as any
[context file](session-context-sources.md), after the questions, so the person has
signed in by then. A later submit with more of the same conversation, or a new choice
of who can read it, replaces that file; another conversation keeps its own. A failure
says so beside **Try again**, and closing waits for an upload under way. The box only
shows when the Worker takes participants' files (`participant_context_v1`) and the
session allows them, or for an admin.

### Handing each person their part

Under a labelled transcript, **Give each person their part** has one button per speaker
who said anything; in a group recording, a speaker's label in the transcript opens the same
code. A button shows that person's code, for them to scan with their own phone, signed in
or not. The part isn't stored on the way, and the recorder needn't be signed in: holding the
code is the permission, on the assumption that the room trusts each other. On the phone,
the session's AI drafts the answers from the part, as it does from a voice interview, and
nothing is saved until the person submits.

When the recorder gives one person two labels, the host drags one button onto the other
(on a touch screen after holding it still for a moment, so a swipe over the buttons still
scrolls), or chooses **Same person as…** in that person's code, which needs no dragging. The transcript
then shows the merged lines under the label they joined, the button reads **Person 1 + 3**,
and its code carries all those lines as one part. The × beside a merged button splits it
again. Merges are kept with the recording on this device (`speakerMerges.ts`), so a reload
keeps them and **Clear recording** forgets them. Question drafting and the transcript added
to context keep the labels the recorder gave.

The part is that person's lines as `Responder:` and the line before each as
`Other person:` (its last 240 characters), so a reply such as "I agree" can be read. It is
packed with the session slug and the group the recorder's link joined as deflated JSON in
base64url (`sessionTranscriptClaim.ts`), then split across QR codes:

- Each code is a link: `/session/<slug>#claim=<share id>.<index>.<total>.<data>`. So an
  ordinary camera opens the session, whose page then opens its own scanner and collects
  the rest. The QR-code icon (**Scan code**) in the Group Conversation and voice-mode
  dialog headers starts the same scanner. It stays disabled while that dialog is capturing, and a code's link
  opened in a tab that's recording waits for Stop.
- Every code is QR version 12 at level M (65×65 modules, 287 bytes) so nothing jumps as
  they change, and one shows for 800 ms. That is slow enough for a shared screen to settle
  between codes and well under the three changes a second that count as flashing. About
  10 KB of text takes about 20 seconds a loop. A phone that misses a code gets it next time
  round, and a code from another share starts the collection over, so two people's parts never mix.
- The scanner reads with `jsQR`, loaded only when scanning, because iOS has no
  `BarcodeDetector`. It asks for the rear camera at 1080p and alternates the view's middle
  at full detail with the whole view scaled down. The video stays on the device.
- **Copy link instead** gives the same part as one link in the URL fragment, which
  browsers don't send to a server, for when a camera can't be used.

The part opens the interview review like a prefill link, and the person joins the group
the recorder's link was for. Their lines join whatever they've said in this review, and
mapping treats `Responder:` lines as their words and `Other person:` lines as context only.

What they already had is reconsidered against it. A signed-in person's saved answers load
first (or drafting goes ahead without them if they can't be read). The mapper gets those
answers and their comments, the drafts already in review and any responder context as
usual, and the files they added to the session themselves. A draft that gives a different
answer shows for review, saying which answer it changes. One that repeats the saved answer
adds nothing and is counted in a note, unless it adds a new comment. A locked answer stands
and goes to no AI, even after it's been unlocked on the page.
Someone signed out gets drafts from their part alone; if they sign in to submit, the usual
check of drafts against saved answers applies.

## Access and failure behavior

- Private, encrypted, or masked question prompts are never placed in the public brief or realtime instructions before the participant can access them.
- Cloudflare-native questions are read through the canonical storage routes and their per-item authorization checks.
- Questions an admin has hidden are left out of the interview catalog and its hash, and a generated opening is written again when the hidden list changes.
- Registry/on-chain question discovery is bounded by configured block limits, a two-million-block maximum window, and 100 questions.
- Realtime and response mapping use the same anonymous AI eligibility rules as other session AI features. A session end, disabled scope, restricted gate, missing Worker key, or unavailable Worker fails visibly instead of prompting for a surprise wallet/passkey signature.
- No voice mode submits, publishes, or overwrites an existing local answer without an explicit user action.

## Main files

- `client/src/components/SurveyTool/SessionVoiceModeModal.tsx`
- `client/src/components/SurveyTool/sessionInterview.ts`
- `client/src/components/SurveyTool/sessionInterviewRealtimeInstructions.ts`
- `client/src/components/SurveyTool/sessionInterviewRealtimePrefill.ts`
- `client/src/utilities/audio/realtimeInterviewClient.ts`
- `client/src/components/SurveyTool/SessionListeningPanel.tsx`
- `workers/sessionCorsWorker/interviewBriefDispatch.js`
- `workers/sessionCorsWorker/interviewQuestionCatalog.js`
- `workers/sessionCorsWorker/realtimeCallExecution.js`


Interview mapping uses the session's thinking model, `gpt-6.1-sol` by default, on the
Worker-held key. It asks for medium reasoning effort, which the Worker allows even on a
low-effort session unless the session sets an effort for this task, plus
`service_tier: default` and JSON output, without unsupported sampling parameters.
GPT-Live remains the voice interviewer. See
[OpenAI’s Sol model documentation](https://developers.openai.com/api/docs/models/gpt-6.1-sol).
Mapping targets roughly ten seconds for ordinary interviews, but latency depends
on transcript length, number of drafts, and provider load; it is not a deadline
that discards partial work.

Continued interviews retain user-edited fields even when an intermediate AI
prediction agrees with the edit. A valid imported prefill is checked against the
question bank once; later question additions can be included in the ongoing interview.

### Returning from interview submission

Signing in from the interview closes the account dialog after successful login; reviewed drafts remain in the interview while session response data loads. Submitting selected drafts that are already saved and unchanged shows “Responses already saved” without uploading duplicates. On a session page, **View results** closes the interview and opens and scrolls to the inline Results section. Standalone question views keep their raw-results navigation.

Interview choice mapping and review preserve one option for binary/single-select questions and arrays for multiple-selection questions. A legacy scalar choice imported for a current multi-select question becomes a one-element selection; it does not reconstruct selections absent from the original packet. Unknown options and multiple distinct options for a single-select question are rejected.

Prefill validation uses the shared public-question normalization contract. If the
local bank differs from the Worker’s bounded catalog (up to 100 questions), the
client fetches that session’s current catalog and verifies its identity, hash,
and each question against locally available metadata. It never accepts an
arbitrary prefix. Imported predictions are scoped to the verified catalog;
network failures remain retryable and closing the modal cancels catalog work.

### Live interview context limits

The complete initial/continued voice instructions fit below the Worker’s 32,000-character limit. The client keeps whole question rows, recent role-labelled conversation turns, and bounded background/review data. Participant edits are either included exactly or omitted with their obsolete prediction; they are never shortened into a different answer. Review state also reaches continued voice when no external prefill was imported. A notice explains omitted voice context. The full local transcript and review drafts remain available to final response mapping. If no complete question fits, the client reports an error before opening the microphone; participants can answer manually or ask the owner to shorten the question content.

### Sharing the voice interview

The admin page and publish result include a compact **Interview & share** panel. The standard session page opens directly to its normal questions interface, without this panel. The panel's QR code and **Copy link** action open the voice chooser on another device. A Worker origin is included only for Worker-canonical sessions or when the current session link already carries one; registry session links keep registry routing. **For your AI** copies the same review-only prompt as the voice launcher after checking catalog compatibility. Admins also get **Copy group recorder link**, the same link with `?mode=groupRecording` (see [Group Conversation](#group-conversation)). Join links contain only the session path and, when needed, the validated Worker origin; admin tokens and prefill fragments are never copied.

### Recording on a phone or with remote speakers

Use one dedicated, plugged-in phone per breakout and keep this page visible with the screen unlocked. **Do not record on the phone that is on Zoom**; use a separate call device and place its speakers where the recorder can hear them. iOS Safari stops capture when the phone locks or the app goes into the background. Treat any hidden period as potentially missing audio, even when the timer continues. Screen Wake Lock needs iOS 16.4 or later ([WebKit release notes](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)); it prevents automatic screen locking while held, but cannot keep Safari capturing in the background or override a manual lock. The owner must rehearse the actual phones before the event.

Group Conversation and Interview request a Screen Wake Lock while recording or paused, release it on stop/close, and request it again when the page returns to the foreground. Group Conversation explains when the page is hidden or the screen lock is unavailable and asks the recorder to keep the page visible and screen unlocked. After returning, Group Conversation keeps a timestamped hidden-period notice, including after Stop, until the recorder dismisses it or clears the recording. On a computer (a fine pointer) it skips the notice when the live recorder delivered audio throughout, with no gap over 3 seconds up to the return, the microphone never muted, and recording still on: a background tab there keeps recording. A phone always gets it, because it can feed the page silence while a call holds the microphone. The notice is saved with the recording, so it survives a reload, the browser discarding the tab, and closing and reopening the recorder. A hidden period that is still open when capture stops ends when the page returns. Interview keeps its screen-on notice. A wake lock cannot keep a backgrounded browser recording reliably; keep the recording page visible.

Group Conversation's **Recording voices coming from this device** option is off by default and remembered on the device. It turns off microphone echo cancellation while keeping noise suppression and gain control. Test both settings with the separate call device's speakers and every seat before the breakout; headphones do not feed remote voices into the room microphone. The option cannot change during capture.

Foreground recordings rotate into independently decodable three-minute chunks. While capturing, the browser delivers one-second audio fragments; a cumulative snapshot is saved at most every ten seconds and when the chunk ends, keeping its container header intact for Safari. Finished chunks upload serially in capture order. Network failures, 5xx responses, 408 and 429 retry after up to 1, 2, 4, 8 and 15 seconds, then up to every 30 seconds while the page stays open; each wait is cut by a random amount of up to half, so rooms sharing a key don't retry together. An upload with no answer after two minutes is abandoned and retried the same way; after each such stall the next attempt waits two minutes longer, so a slow upload still finishes, while quick failures such as a 503 don't lengthen the wait. Other 4xx failures mark that chunk Failed and later chunks continue. Failed chunks retain their audio for Retry and Download; the transcript includes a gap marker and Generate remains available with a warning. Generate needs at least 50 characters of speech; gap markers don't count. Close and keep the audio saves pending chunks for reopening. While any wait to upload, the session page shows, “Saved audio is waiting to upload.” with **Reopen recording**, which reopens Group Conversation to finish, and **Dismiss**, which hides it until the dialog next closes; Failed chunks wait for Retry instead and aren't counted. After a reload, the page finds such audio on this device and shows the notice without the dialog being opened. If device storage failed, the memory copy of the recording lasts while this page stays open, however often the dialog is closed and reopened, and each reopening tries the save again. Meanwhile that notice says “This recording can't be recovered after a reload.” instead, whether its chunks are transcribed or not, or it holds only pasted text. Offline capture stays local and resumes uploading when connectivity returns; an upload still waiting for an answer then starts again at once. Reopening or reloading the same session in this tab restores saved chunks in order without acquiring the microphone. Only one tab at a time opens a recording, using a Web Lock on its session, Worker and account: a second tab says “This recording is open in another tab.”, keeps Record off and uploads nothing, then takes over, restoring and uploading what the first saved, once that tab closes the recorder. Browsers without Web Locks, or that refuse them (as with site data blocked), open the recording in every tab. Record pins the account scope for the whole recording, so signing in or a late account restore does not interrupt capture or split the transcript. Clearing the recording releases that scope for the next recording. A recording made while signed in belongs to that account: after a sign-out or account switch, opening the recorder starts afresh, and the recording returns when its account signs back in. If the recorder is open at the time, the recording stays until capture stops, its uploads finish and its audio is saved, with a notice and Record unavailable; a recording held only by this page stays with its account until it is saved, or downloaded and cleared. After a sign-out, capture goes on and chunks upload signed out. When another account signs in, recording stops and its chunks wait on this device, uploading only once the account that made them signs back in. A recording started while signed out stays with the account that signs in during it.

The recorder hides internal chunk numbers and exposes a single **Retry transcription** action for failed or stalled audio: a failed chunk, one waiting to retry, or an upload that has already stalled once. An ordinary upload doesn't offer it, since retrying would abort the request and might pay for it twice. **Download audio** combines the audio not yet transcribed, in capture/import order, into one 128 kbps mono MP3, entirely on this device; with none left, it and the list of original files are hidden. The encoder loads only on download and runs in a dedicated Web Worker; decoding processes one part at a time. The combined download is unavailable during capture. If any part cannot decode, export fails visibly and offers the original files instead of silently dropping speech. Downloading never deletes the recovery copy. A chunk's audio, waiting, uploading or Failed, stays until it is transcribed or the recording is cleared. Its transcript then replaces it in one IndexedDB write, so the audio is deleted only once the transcript is saved; if that write fails, the stored audio stays for a reload to transcribe again. The page keeps only the transcript either way, and without device storage it drops a chunk's audio once transcribed too. **Clear recording** asks before deleting audio not yet transcribed. Clear is unavailable while audio is waiting or uploading. Under storage failure, clearing empties the recording on this page.

Storage is best-effort: unavailable IndexedDB or a failed write leaves capture and transcription running from memory, with “This recording can't be recovered after a reload”. Download audio not yet transcribed before leaving: each part's original file stays downloadable until it is transcribed, even during capture. If the microphone or recorder stops, its error appears ahead of the storage and offline notices. If a transcript's durable save fails, the page keeps the transcript and device storage keeps the chunk's audio; the next successful write saves the transcript, which replaces the audio, and clears the notice, so a reload after that doesn't send the chunk again. A failed capture start reports an error without adding an empty chunk; a failed rotation keeps the current recorder running and retries on the next rotation. If the browser doesn't confirm a stop within two seconds, whether after Stop or at a chunk boundary, the chunk ends with the audio already delivered and uploads as usual, so later chunks aren't held up; audio the recorder hands over after that is ignored, and Record is available again. When the device takes the microphone without hiding the page, as a call or Siri can, the recorder shows **Mic paused** and “Microphone paused by the device. Recording resumes when it returns.” Capture keeps running, so nothing depends on the microphone coming back. When it does, recording continues in a new chunk, and the transcript marks the gap before it, for example `[Microphone paused for 1 min 20 s.]`; markers don't count as speech. If no audio arrives for a chunk length and 30 seconds while recording, with the page in view and the microphone not paused by the device, capture has died without telling the page: the recorder stops the silent recorder, keeping any audio it still hands over, takes a fresh microphone stream and goes on in a new chunk, saying “No audio arrived for a while, so the microphone was restarted.” One restart runs at a time, and one that the browser answers only after Stop or a new Record press is dropped, with its microphone released. The transcript marks the gap, for example `[No audio for 3 min 35 s.]`. If the microphone can't restart, recording stops with an error and one press of Record continues it. Microphone revocation stops capture and tells the recorder to restore permission before pressing Record again. If the browser stops the recorder by itself, with no error, the dialog says so instead of still showing Recording; the audio delivered so far is kept, and one press of Record continues the recording.

Recovery covers audio already delivered by the browser and committed to IndexedDB. A reload or a closed tab can lose up to the last 10 seconds; everything saved before that returns. Hiding the page during capture saves the audio so far at once and asks the recorder for its last part second, so a phone that later discards the hidden tab loses at most about a second. A crash with the page in view can lose up to ten seconds since the last successful snapshot or an undelivered final fragment, and operating-system suspension can interrupt capture before any audio exists to save. Browser storage eviction, private browsing limits and phone battery policies still require device testing.

#### 45-minute phone rehearsal

Run this checklist on the intended iOS Safari and Android Chrome devices, microphone, room and network. Automated fake-time tests do not establish phone endurance.

1. Open the session’s HTTPS link on the dedicated, plugged-in phone. Confirm the session and Worker; a desktop `127.0.0.1` preview is not reachable from the phone. Keep Zoom on a separate device.
2. Record a short sample from every expected seat and the separate call device's speakers. Pause, resume and stop. Confirm readable transcript text, released microphone and wake lock, and speaker labels enabled by default for OpenAI. Record past a three-minute boundary with three or four people and confirm each keeps the same Person number in the next chunk; if the recorder warns that speaker numbers may change, check that the Worker is 0.9.0 or later and that the phone can decode its own audio. Compare **Recording voices coming from this device** on and off and check for feedback.
3. Record for 45 minutes with this page in the foreground and the screen unlocked. Expect about 15 three-minute chunks and, if stopped between boundaries, a final partial chunk. Watch transcription progress, memory, battery temperature and the final upload. Sign in during capture and confirm the same recording and transcript continue.
4. Interrupt connectivity for at least 30 seconds during an upload. Confirm capture continues, audio remains local, and retries resume automatically on reconnect. For a permanently rejected chunk, confirm later chunks transcribe, the transcript shows a gap, Generate works with the missing-part warning, and Retry transcription plus a playable MP3 of the rejected audio remain available. Once a chunk is transcribed, confirm its audio is no longer offered.
5. Close with **Close and keep the audio**, then reopen and confirm pending chunks resume. Separately reload during a short test recording with working storage; confirm the saved partial chunk recovers without restarting the microphone. Compare its header and playback on Safari. Up to the last 10 seconds can be lost on a reload, a closed tab or a crash.
6. Test unavailable or full device storage. Confirm Record and transcription still work with “This recording can't be recovered after a reload”, and audio remains downloadable until it is transcribed. Download it, and copy the transcript, before leaving; do not reload this test expecting memory-only recovery.
7. In a separate interruption test, press Back during capture and confirm the recording continues; then switch tabs, background Safari, lock the screen, take a call and use low-power mode. Confirm the hidden-period notice survives return, Stop and a reload until dismissed, and the screen lock is requested again. Check for missing speech; background and locked-screen capture are not supported for the breakout. Test microphone denial/revocation and a failed start: each must explain the problem without leaving a phantom chunk.
8. Exercise a rejected speaker-label request and a provider check longer than two seconds. Confirm the visible plain-transcription fallback retains the transcript; a transient 408/429/5xx must retry. Stop and wait for Transcribed or explicitly review/download every Failed chunk, then reopen and compare the saved transcript.
9. Confirm generated questions reflect the session’s instructions. Review and edit them, submit as a participant with question-authoring permission, and verify they appear in the session. Generation alone must not publish them.

The labeled route has a 24 MiB chunk limit and falls back to ordinary transcription when needed. Actual phone encoding, delayed timers and long background intervals must be checked on the devices.


### Speaker labels

Group Conversation enables **Label speakers** by default for OpenAI transcription. Record waits at most two seconds for the provider settings; if that check times out, it becomes available with a notice and plain transcription. A result that arrives later still applies until Record is pressed, and is ignored after that. When the check succeeds, the recorder can turn labels off before capturing. It uses OpenAI `gpt-4o-transcribe-diarize` with `diarized_json` and automatic chunking, retaining normalized speaker turns alongside the ordinary transcript in the saved recording. When the Worker cannot provide labels, the recorder keeps plain transcription and explains that labels are unavailable. Other transcription callers retain their existing model, request and text response.

The transcript shows each voice's turns as `Person 1: …`, `Person 2: …`, numbered by first appearance in the recording, and a chunk transcribed without labels as plain text. The transcript sent to question generation keeps the same labels; labels don't count toward the 50 characters of speech Generate needs. After a chunk is transcribed, the recorder cuts a five-second sample of each new voice from the middle of its longest turn in that chunk's own audio, decoded on the device and saved as 16 kHz mono 16-bit WAV, and sends the samples of up to four voices with every later chunk. OpenAI then labels a matching voice with its Person name, so it keeps its number across chunks. A voice whose turns in the chunk are all under two seconds, or whose audio the browser can't decode, gets no sample yet and is numbered after the known voices within that chunk only, as is a fifth or later voice: such a voice may change number between chunks. The names and samples are kept with the recording, in the same device storage and account scope as its chunks, while it is open or still has chunks to transcribe, so reopening or reloading meanwhile keeps them. Once every chunk is transcribed and saved, closing the recorder deletes them, or, after a closed tab, opening it next does; Clear deletes them too. A later Record more then numbers its voices afresh. Sampling never holds an upload for more than ten seconds. The model's odd labels, such as `@`, join the neighbouring turn's voice, and a line it repeats over the same time is shown once.

If samples were sent but no voice in a chunk matched one, as with a Session Worker before 0.9.0, which drops them, that chunk numbers its voices on its own and adds none to the known voices; the recorder warns that speaker numbers may change during the conversation. If the provider refuses the samples, the chunk is sent once more without them and the rest of the recording numbers each chunk on its own. Labels do not identify people. Speaker review, per-speaker mapping and claiming QR codes are not yet available. The labels toggle is available only for OpenAI transcription. A non-transient 4xx rejection of a labelled request retries the same audio as plain transcription. Only a rejection of that chunk's audio, a 413 or a provider error naming the file (such as corrupt or undecodable audio), affects that chunk alone: it is transcribed without labels and later chunks still request them. Any other non-transient 4xx, such as an older Worker without label support or a model the Worker doesn't allow, or a Worker reply with text only, makes the recorder report that labels are unavailable and use plain transcription for the rest of that recording, uploading each later chunk once. Network failures, 408, 429 and 5xx remain on the transient retry path. A chunk above 24 MiB also uses the plain path and normal audio chunker for that chunk only; undecodable audio then fails visibly while later chunks continue. A text-only reply is kept without another upload. Keep the page visible during capture. The diarization model is deprecated, and OpenAI shuts it down on 2027-02-26 without naming a replacement; replacing it is separate work.


### Returning after new questions are added

The voice interview starts with unanswered questions, newest first using creation dates already available in the browser. It keeps questions without dates in their existing relative order. If every question has an answer, it asks which answer the person wants to change instead of repeating the opening.

The voice chooser's personal AI-prefill prompt includes the same ordered question IDs and the IDs already answered in that browser. It does not include saved answer text or send progress to the public catalog. The catalog schema, prompt version and question-set fingerprint are unchanged. Generic Join prompts remain shareable and carry no person's progress. Dates and progress unavailable to the browser cannot be inferred; opening on another device before signing in may therefore offer questions already answered elsewhere.


### Realtime transcript order

Legacy Realtime sessions place completed input and interviewer transcripts in conversation
slots from `conversation.item.created`, `conversation.item.added`, and
`input_audio_buffer.committed`, using their item IDs and `previous_item_id`.
Late completions fill their existing slots; repeated completions update the same
turn. A completion without an ordering event appears after known slots in arrival
order until its event arrives. The live display and stopped transcript use the
same order. Live protocol fragments continue to use their timestamps. See the
[OpenAI server-event reference](https://developers.openai.com/api/reference/resources/realtime/server-events).


After an interview submission leaves page answers unsaved, a notice beside the ordinary Submit button shows their count. Ordinary editing does not show this notice. Submitting the remaining page answers clears it.

Hidden-draft help includes a screen-reader description on its question-mark button; its explanation stays open when the pointer moves into the tooltip.

Voice interview context omits imported facts whose related questions in the interview all have concealed AI drafts, wherever their words appear in the editable background, including inside the summary. A fact with a visible related question stays whole, even when it contains a concealed fact's words.

Generated group-conversation drafts show their question type and a top-right 44-pixel **X** control. Once drafts exist, **Submit questions** replaces the generation action. While drafts generate, Submit is disabled and reads “Waiting for new drafts…”. Drafts generated during an upload join the list afterwards as new drafts; a successful upload always shows its success list and removes the drafts it sent, so none is sent twice. Removing the last draft restores **Generate questions**; submission remains the normal reviewed authoring flow. The **+** input menu shows upload/paste labels only after opening.

Group Conversation keeps the Record/upload/transcript guidance in the question-mark tooltip beside its title, available on hover or keyboard focus.
