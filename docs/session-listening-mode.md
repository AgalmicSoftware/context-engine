# Session Voice Modes

The microphone on `/session/<slug>` opens a modal with two participant workflows:

- **Interview** — one responder speaks with a realtime interviewer. Context Engine maps the completed responder transcript into reviewable response drafts and may suggest new questions for review.
- **Group Conversation** — records a discussion, creates a rolling transcript, and generates reviewable question drafts.

The session links are:

```text
/session/<slug>?mode=voice
/session/<slug>?mode=interview
/session/<slug>?mode=recordGroup
```

The direct links open the selected modal panel; `?mode=voice` opens the
launcher, as does clicking the microphone without a mode query. The launcher's
two choices sit side by side with centered icons and titles; a question mark
beside each icon shows what the choice does. Below them, a bordered **Let your
AI draft your answers** card holds the ChatGPT or Claude prefill prompt (see
below), with its own question mark beside the heading. Screen readers get each
description with its choice. The header close button dismisses the launcher
without a separate footer. Picking a choice replaces `?mode=voice` with its own
mode.
The older
`?mode=listening` link remains supported and opens the original pile-adjacent
group recorder.

`interviewModeEnabled` is a per-session public config value. It defaults to
`true`; setting it to `false` hides the microphone entry point and makes the
public interview-brief endpoint return `404`.

## Interview

Interview mode sends an SDP offer and interviewer instructions to the
session's own Cloudflare Worker. The Worker creates a GPT-Live session through
`POST https://api.openai.com/v1/live/sessions` using its own `openaiKey`; the
browser never receives that key. New sessions and the Interview demo default
to `gpt-live-1`. The JSON request carries `session: { model, instructions,
store: false, delegation: { type: "client" } }` and `transport: { type: "webrtc",
sdp }`. Audio is negotiated through WebRTC; Realtime session type, output
modalities, VAD, and transcription-model fields are not sent to Live.

The per-session `interviewMode.realtimeModel` setting also accepts the supported
legacy aliases `gpt-realtime-2.1`, `gpt-realtime-2.1-mini`, `gpt-realtime-2`, and
`gpt-realtime-1.5`. Those retain the Realtime multipart call contract. Invented
or retired model IDs normalize to `gpt-live-1` when reading old configurations;
Worker config writes reject newly supplied unsupported values. Previously
accepted stored `gpt-realtime` aliases migrate to that same runtime fallback
during later config, limits, or Lit-descriptor updates, including an unchanged
model echoed by an older settings form. Other malformed stored fields still
fail validation. The provider remains OpenAI.
Session creators can change the model in `/new` under **Optional details**
(or **More options** in Customize) → **Interview settings** →
**Interview voice model**.

The Interview header shows a colored pill with its status always visible: Ready,
Connecting, Listening, Paused, Ending, Preparing drafts, Review drafts, or Error.
The pill itself carries the status color without a separate dot. The header
shares the dialog background without a dividing line, and its close icon is half-opacity until hovered
or keyboard-focused.
Green readiness requires a reachable Worker that confirms an OpenAI key, voice
provider, and session access, plus browser microphone support and no known
permission denial. This setup check does not call OpenAI or request microphone
permission; the live connection still validates the key when Start is clicked.
Yellow indicates loading, pauses, or readiness that could not be verified; red
indicates an error or missing setup. Older Workers show **Not checked** rather
than green. Click the idle pill to retry the check. Status changes are also
announced to screen readers. The adjacent question-mark tooltip explains the
current phase. A large circular microphone control starts or continues the interview.

Listening requires a connected peer, an open data
channel, a started voice session, and a live enabled microphone. Connecting
keeps the microphone track disabled until readiness. Pause disables microphone
transmission and mutes interviewer playback; it keeps the session connected.
Stop and close immediately stop local tracks, close the peer/channel, and clear
remote audio. Closing during startup also cancels the request and stops a late
microphone grant. Connection, microphone, and playback failures stop capture
and offer recovery. Reopening starts a fresh interview.

Stop requests `session.close` on Live as a best effort before immediate teardown.
It does not wait for `session.closed`, so final API usage and any undelivered
transcript tail are unconfirmed. Drafts use only text received before Stop;
review the transcript and edit drafts if the final words are missing. Stopping
prepares drafts; closing discards the modal session without preparing drafts.

The contract follows OpenAI's [WebRTC guide](https://developers.openai.com/api/docs/guides/voice-webrtc?api=live),
[session lifecycle guide](https://developers.openai.com/api/docs/guides/live-conversations),
and [Live migration guide](https://developers.openai.com/api/docs/guides/live-migration),
verified September 10, 2026. Live waits for `session.started` and requests a
greeting through `session.instructions.append`; it does not send
`response.create` or a second `session.start`. No live task backend is invoked:
a client delegation receives a factual notice that drafting happens after Stop.

The shipped `demo-interview` client record pins its deployed Worker and enables question suggestions.
The shipped `demo-interview-5` record is a trusted clean-route discovery stub:
`/session/demo-interview-5?mode=interview` bootstraps and verifies the live config from its pinned
Worker, so the public URL does not require a visible `worker=` parameter. Registry-backed sessions
likewise read `corsWorkerUrl` from registered session metadata. A newly shared,
Worker-canonical session still needs an explicit discovery link unless its app
deployment bundles the Worker origin or serves the session from that origin.

The interviewer starts directly with a topic-relevant question, without a
greeting or preamble. It follows the responder's direction, chooses relevant
existing questions, and asks useful follow-ups. Sessions may add
`interviewMode.steeringPrompt` for owner-authored interview guidance. The value
is trimmed, capped at 3000 characters, and inserted as its own paragraph after
the fixed two-line realtime preamble and before the opening question. Empty
values are omitted.

In Group Conversation mode, the recorder keeps the captured transcript when the participant records more.
When an eligible completed transcript segment is available and no transcription chunk is pending, the client asks
the configured session AI to draft questions automatically. New drafts append to the existing editor, while exact
ID or prompt duplicates are skipped and prior generated prompts are included as avoidance context. Manual retry
remains available after a generation error; the client does not auto-retry unchanged transcript text in a loop.

Session `interviewMode` settings are available in the wizard and admin metadata editor:

| Setting | Default | Behavior |
| --- | --- | --- |
| `openingMode` | `auto` | Generate an opening from session information and public questions; `owner` uses the owner's text. |
| `openingPrompt` | empty | Owner-written opening, required in owner mode. |
| `steeringPrompt` | empty | Optional owner-authored guidance inserted into the live interviewer instructions before the opening question; capped at 3000 characters. |
| `autoRegenerate` | `false` | Refresh the generated opening when enough questions have been added. |
| `questionGrowthPercent` | `20` | Additions needed since the last successful generation or conversation update, rounded up to at least one. |
| `followNewQuestions` | `false` | Check the public question catalog every 30 seconds during active recording and append qualifying additions to the interviewer's context. |
| `suggestQuestions` | `false` | Propose up to three new respondent-grounded question drafts when preparing responses. Drafts may be freeform, rating, binary, or multichoice; multichoice drafts include suggested options for review. |
| `allowManualRefresh` | `true` | Enable **Regenerate interview opening** for session admins. |
| `shareDraftChangesByDefault` | `false` | Initially check **Share AI draft changes for research** for new responses. Participants can change the checkbox before submission; saved per-question choices take precedence. |
| `researchDetail` | `minimal` | What a shared draft comparison keeps: `minimal` has no AI notes or drafted text; `full` adds them and drafts for skipped questions. `full` needs a Session Worker newer than 0.8.0. |
| `hiddenDraftShare` | `0` | Share of each participant's AI-prefill drafts, up to 0.5, hidden until they answer, while they share draft changes. Above 0 it needs a Session Worker newer than 0.8.0. |
| `showFidelityScore` | `false` | After someone submits AI-prefill drafts, show them privately how well their AI predicted them. Needs a Session Worker newer than 0.8.0. |
| `suggestGroups` | `false` | After an interview or AI prefill, suggest the session's open groups that fit the participant's answers; never joins for them. Needs a Session Worker newer than 0.8.0. |
| `showFidelityResults` | `false` | Add **How well AIs predicted people** to the Results report once its responses include AI-prefill drafts from `fidelityMinimumPeople` people. Needs a Session Worker newer than 0.8.0. |
| `fidelityMinimumPeople` | `5` | Smallest number of people, from 1 to 50, that any figure in that section describes; 1 (**Off**) shows every figure. A changed value needs a Session Worker newer than 0.8.0. |

**Measure how well AI represents participants**, at the top of Interview settings, sets `shareDraftChangesByDefault`, `hiddenDraftShare` (1 in 5) and `showFidelityScore` together, with `interviewMode.enabled`, and leaves `showFidelityResults` and `fidelityMinimumPeople` alone; in `/admin` it also sets the top-level `interviewModeEnabled`, so it turns voice interviews back on. It shows as on while all three research settings are, whatever hidden share is chosen, and turning it off restores their defaults.

Auto mode generates on the first Interview opening with available public questions and permitted session AI access. No separate admin setup step is needed for an open AI-enabled session. An empty bank waits until questions exist. The Worker uses its OpenAI key and caches the result at `session:<slug>:interview-opening`, with the generation time and baseline question count, separately from owner configuration. The default reuses this opening even as the bank grows; enabling regeneration checks the threshold on the next Interview opening. For example, 42 questions require nine additions at 20%. A failed refresh retains the previous opening. Initial failure visibly falls back to an existing session question.

Live updates use [`session.instructions.append`](https://developers.openai.com/api/reference/typescript/resources/live); supported legacy sessions use [`conversation.item.create` system messages](https://developers.openai.com/api/reference/typescript/resources/realtime). These updates never restart the conversation or replace its opening. Pause and Stop cancel polling and discard late results. Discovery uses the existing public catalog's visibility checks and 100-question limit; private questions are not added through this public discovery path. There are no edit-based or scheduled regeneration conditions.

Live capacity notes for 100-person tests, checked September 19, 2026:

- [`gpt-live-1`](https://developers.openai.com/api/docs/models/gpt-live-1) rate limits are measured in concurrent sessions. The published tiers are Tier 1: 25, Tier 2: 50, Tier 3: 200, Tier 4: 300, and Tier 5: 500 concurrent sessions; Free is not supported. A 100-user live-voice test therefore needs at least Tier 3 for the live model itself.
- OpenAI's [rate-limit guide](https://developers.openai.com/api/docs/guides/rate-limits) also applies to the backend text/model calls used after Stop. Confirm the organization's actual Limits dashboard before the test because limits vary by model and can include RPM, TPM, and audio-minute ceilings. The current account tier and remaining allocation are not knowable from this repository.
- Organization and project limits both matter. OpenAI documents org/project rate limits and project-scoped headers, while [spend limits](https://developers.openai.com/api/docs/guides/spend-limits) can be configured at either org or project level; project settings cannot make traffic succeed after an applicable organization limit or approved usage limit is exhausted.
- Context Engine does not currently enforce app-level voice spend or duration caps. The practical cap is the configured OpenAI allocation plus the session Worker and browser paths.
- Authenticated submission paths request Worker nonces. The current defaults are five nonce requests per wallet per minute and a separate 300-request shared-network limit per session per minute, coordinated by the Worker. Distinct venue participants do not share a five-request allowance. Shared-network/provider concurrency still needs a venue rehearsal; these constants do not prove a capacity level.
- A read-only 100-browser GET test is not equivalent to 100 live voice sessions plus response submissions. Headless browser coverage can use virtual WebAuthn PRF for auth flows, but it should be planned as a separate load profile from read-only page fetches.

Suggested questions follow the response drafts in an expandable **Suggested new questions** section, initially open, using pile-style question cards with editable prompts and tags. Interview review hides the survey/questions toggle and manual question-type selector; the normal authoring surface retains them. A help tooltip beside the section heading explains that suggestions remain drafts until uploaded. Both review sections use matching headings and support keyboard collapse/expand without losing edits. Questions can be edited or removed and require the normal explicit creation/sign-in/permission flow; stopping an interview and submitting response drafts do not create questions. Suggested questions are visible before sign-in so the responder can review them, but after sign-in the section stays hidden unless the connected participant is allowed to create questions for that session. Unresolved group, SBT, or custom permissions keep the section hidden in the UI, and the backend still enforces the upload. Suggestions share the response-mapping request, avoiding an extra model round trip. That request also generates short, non-identifying tags, prefers relevant session `defaultTags`, and incorporates `questionsGenPrompt` guidance. Default tags are suggestions rather than a restricted vocabulary; users can add or remove tags before upload.

When a session turns on `interviewMode.suggestGroups` (off by default; it needs a Session Worker newer than 0.8.0) and lets visitors list its Worker-backed groups without signing in, Interview review shows an optional **Suggested groups** section after suggested questions, both after a voice interview and after an AI prefill link. A group named exactly like the option the person chose, or their AI drafted, on a single-choice question is suggested first without an AI call, with the reason “You chose “d/acc”.”; case and extra spacing don't matter. Only drafts the person keeps selected count, so a removed draft, or an unchosen one for an answer they already saved, is left out. AI suggestions cover the other groups and use only explicit reviewed respondent evidence, with question prompts supplied as context for short binary, rating, or multiple-choice answers; interviewer text, names, accents, and weak topical mentions are not enough. Still-hidden AI drafts are left out until their guess is shown. If the AI suggestions fail or take longer than 30 seconds, the exact-name matches still show. The app validates suggestions against the current Worker group catalog and shows only open, non-expired session-visible groups that the signed-in participant has not already joined; without a saved Worker sign-in, as when signed out, the list can include a group they already belong to, and **Join** then signs them in, finds the membership and shows it as joined without joining again; restricted, invite-only, password, closed, full, registry, and SBT-only groups are not joined inline. Suggestions never join a group or open login by themselves. Clicking **Join** starts the normal sign-in and Worker group-join flow for that selected group, revalidates the authenticated catalog before the join, keeps the Interview modal open, and broadcasts the normal Groups membership refresh after success. Canceling login cancels only that pending join. Suggestion failures do not block response submission or suggested-question editing/upload, and the Worker still enforces membership writes. If a reviewer edits or removes a response after suggestions appear, the group suggestions are cleared until the reviewer explicitly refreshes them. With the setting off, participants join groups from the session's **Groups** section.

Only responder speech becomes
answer evidence. Interviewer questions are retained as context so short replies
such as “four” can be matched to the question asked. Live input and output
transcript fragments are retained exactly, deduplicated by event ID, and ordered
by session time. Supported legacy Realtime sessions retain completed responder
transcriptions and interviewer output turns, deduplicating repeated completion events.
**Continue interview** continues the existing conversation. Each round appends to the transcript, and mapping reviews the combined evidence alongside earlier predictions and user-reviewed responses. Changed predictions retain numbered versions with model IDs in local review state; consented research submission includes those versions and applies the same answer/comment encryption redaction to every version. Research controls also appear after a voice-only continuation revises a prediction. Declining research excludes the history from submitted metadata. Existing matches are retained, untouched AI fields can be refined, and user edits and excluded drafts are preserved. Suggested question prompts and tags also survive continuation; only novel suggestions are appended. A failed connection or a round with no new speech leaves the previous review intact. Closing the Interview dialog still ends this in-memory review.
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
Relevant interview explanations appear as editable additional comments. The
review body no longer adds **Agent:** or **User:** labels, and it does not remove
literal text that happens to begin with those words. A single glowing robot icon
beside the footer/comment controls marks an untouched AI-proposed response; it
stays through focus-only review and disappears after any real answer, comment,
importance, or conviction edit. The responder selects which drafts to submit and
must explicitly opt into replacing an existing local answer. Selected drafts have
an **X** that removes the whole card from review and excludes its answer from
submission. Removed cards stay hidden during continued interviews. Drafts that
conflict with an existing local answer remain visible with **Replace with draft**
until the responder explicitly selects them. There is no redundant
selected-state button. **Submit responses** saves reviewed values and enters the
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
**Share AI draft changes for research** checkbox appears when imported or
voice-generated AI drafts or prediction revisions are being reviewed, and it is
off by default. The platform checkbox is labeled **Include platform/model
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
anything; the interview itself no longer shows it. Clicking its **Copy** line
copies the request without opening the preview. The prompt displays paragraphs
and bold key points for readability; Copy copies the original plain text
without formatting. The **Prompt** dropdown inside the card expands the instruction and
collapses it again; the preview starts collapsed and remains collapsed after a
successful copy. In the expanded prompt, a question-mark tooltip explains:
“Allows your agent to predict your responses and raise better interview questions.”
The tooltip is available on hover and keyboard focus. The copied request begins:

```text
Help me prepare a review-only Context Engine interview prefill. Fetch
<session-worker>/agent/interview-catalog?... and validate the session and supported v4/v5 inert
catalog contract without changing its version or fingerprint. Search only already-authorized, question-related history,
memory, and connected sources; show the exact response packet before encoding;
then return its local review link.
```

The copied prompt is a user-authored request; the fetched endpoint is deliberately
an inert JSON question catalog with no instructions. This separation lets an
ordinary ChatGPT or Claude conversation treat linked content as data while still
following the user's pasted request. It requires no plugin, MCP server, account
link, or installation. Existing connected sources are used only when that AI
already has access to them; Context Engine does not add a connector or broaden
permissions.

The copied prompt tells the AI:

> Search only conversation history, memory, and connected sources directly related to the questions at the Context Engine session.

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
one. The copied prompt does not request a responder name. Previously generated
packets may still include one; the client does not submit it unless the responder
enables the default-off name control. The packet contains no
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

The answer contract is question-specific:

- Binary answers use one exact option: `Agree`, `Unsure`, or `Disagree`.
- Ratings use the question's `scale` bounds and labels. Only questions without a
  scale use `answerContract.rating` (the current catalog default is 0–10).
- V5 multichoice questions include boolean `singleSelect`. `true` takes one
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
original fingerprint rules and current question validation. V5 hashes include
selection mode; v1–v4 hashes do not. Source compatibility does not prove a live
frontend or Worker has been updated: verify both served contracts during an
authorized rollout, especially before generating v5 packets.


When Context Engine opens that link, it validates the packet, requires the
session slug and question-set hash to match, removes the fragment from browser
history, and validates the AI-authored response drafts against the current
questions and listed options. Current direct responses are not re-authored by a
different mapping model, so their source attribution and confidence remain
faithful to the external AI. Every proposed answer remains a local review draft.
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

After an interview, a compact **Transcript** toggle sits beside the microphone;
the AI-prefill prompt card stays in the voice launcher.

In the full question list, rating sliders update locally during a drag and save
the final value on release. Loaded lists retain the Questions label during
background refreshes; the spinner still indicates refresh activity.

The review surface shows confidence as a progress meter and keeps each evidence
basis and AI-estimated support level collapsed under **Basis** until requested.
Binary drafts reuse the normal pile-view
Agree/Unsure/Disagree controls. The bullhorn opens both Conviction and Importance
choices, with the same button opacity and hover styling as pile view. Both values
remain editable through review and are carried into submission. Applied source/model provenance is persisted in
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

Group Conversation reuses the rolling transcription recorder. Recording begins
only after the user clicks Record so microphone permission follows a user
gesture. Capture requests echo cancellation, noise suppression, automatic gain
control, and mono audio. A fresh `MediaRecorder` segment rotates every three
minutes, and completed chunks are sent to the session Worker `/transcribe`
route. Returned transcripts are stitched with overlap deduplication. Rolling
and uploaded audio share Unicode letter/digit matching with original-text
offsets, so trimming an overlap preserves new speech in every script.

Closing Group Conversation with Close, Escape, or an outside click first stops capture, waits for the final segment to finish transcription, and saves the transcript. The dialog shows **Finalizing recording…** and ignores further dismissals until it finishes. Failed uploads retry automatically with backoff. If recovery still fails, the dialog stays open with Retry and Download audio controls. Saved chunks and completed transcripts return when the same session and account reopen the recorder; recovery does not start the microphone.

The visible transcript is collapsed by default. Generated questions are drafts
rendered through the existing `CreateQuestionsAndSurveys` review surface and
are never auto-published. Generation uses the session’s `questionsGenPrompt`. A participant with question-authoring permission can review the generated questions and press Submit. Raw chunks are removed only in the same successful IndexedDB transaction that saves their transcript.

## Access and failure behavior

- Private, encrypted, or masked question prompts are never placed in the public brief or realtime instructions before the participant can access them.
- Cloudflare-native questions are read through the canonical storage routes and their per-item authorization checks.
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


Interview mapping uses the Worker-side OpenAI key and the Responses API. It sends
`reasoning.effort: medium`, `service_tier: default`, and JSON output formatting, without
unsupported sampling parameters. GPT-Live remains the voice interviewer. See
[OpenAI’s Terra model documentation](https://developers.openai.com/api/docs/models/gpt-5.6-terra).
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

The session page, admin page and publish result include a compact **Join** panel. Its QR code and **Copy link** action open the voice chooser on another device. A Worker origin is included only for Worker-canonical sessions or when the current session link already carries one; registry session links keep registry routing. **For your AI** copies the same review-only prompt as the voice launcher after checking catalog compatibility. Join links contain only the session path and, when needed, the validated Worker origin; admin tokens and prefill fragments are never copied.

### Recording on a phone or with remote speakers

Group Conversation and Interview request a Screen Wake Lock while recording or paused, release it on stop/close, and request it again when the page returns to the foreground. Group Conversation explains when the page is hidden or the screen lock is unavailable and asks the recorder to keep the page visible and screen unlocked. Interview keeps its screen-on notice. A wake lock cannot keep a backgrounded browser recording reliably; keep the recording page visible.

Group Conversation's **Record speaker audio** option is off by default and remembered on the device. It turns off microphone echo cancellation for people heard through the device's speakers, keeping noise suppression and gain control. Use speakers instead of headphones and test levels before the breakout. The option cannot change during capture.

Foreground recordings rotate into independently decodable three-minute chunks. While capturing, the browser delivers one-second audio fragments; a cumulative snapshot is saved at most every ten seconds and when the chunk ends, keeping its container header intact for Safari. Finished chunks upload serially in capture order. A failed upload retries after 1, 2, 4 and 8 seconds, then remains Failed with Retry and Download audio actions. Later chunks wait behind it. Offline capture stays local and resumes uploading when connectivity returns. Reopening or reloading the same session restores saved chunks in order without acquiring the microphone.

Each chunk shows Recording, Waiting to upload, Uploading, Transcribed, Failed or Retrying. Download audio saves the original retained bytes as a WebM, Ogg or M4A file. Downloading does not delete the recovery copy. Raw audio is removed only after its transcript commits successfully; clearing the transcript is disabled while audio is pending. Storage is best-effort: unavailable IndexedDB or a failed write leaves capture and transcription running from memory, with “This recording can't be recovered after a reload”. Download unsaved audio before leaving. A completed transcript remains in memory with its original audio if its durable save fails. Microphone revocation stops capture and tells the recorder to restore permission before pressing Record again.

Recovery covers audio already delivered by the browser and committed to IndexedDB. A crash can lose up to ten seconds since the last successful snapshot or an undelivered final fragment, and operating-system suspension can interrupt capture before any audio exists to save. Browser storage eviction, private browsing limits and phone battery policies still require device testing.

#### 45-minute phone rehearsal

Run this checklist on the intended iOS Safari and Android Chrome devices, microphone, room and network. Automated fake-time tests do not establish phone endurance.

1. Open the session’s HTTPS link on the phone. Confirm the session and Worker; a desktop `127.0.0.1` preview is not reachable from the phone.
2. Record a short sample from every expected seat. Pause, resume and stop. Confirm readable transcript text, released microphone and wake lock, and speaker labels enabled by default for OpenAI. Labels restart per chunk and do not identify people.
3. If remote participants use the device’s speakers, repeat with Record speaker audio enabled. Check feedback and distant voices; headphones do not feed speaker audio into the microphone.
4. Record for 45 minutes in the foreground, powered as intended for the event. Expect 15 three-minute rotations plus a final partial chunk. Watch chunk status, memory, battery temperature and the final upload.
5. Interrupt connectivity during an upload. Confirm local audio remains, retries resume in order after reconnecting, and a stuck chunk offers Retry and a playable Download audio file. Reload during a short recording and confirm the persisted partial chunk recovers without restarting the microphone.
6. Separately test switching tabs, backgrounding, screen lock, a phone call and low-power mode. Check the hidden-page/screen-lock notice and reacquisition on return. Record any missing capture; these are not guarantees of continuous background recording.
7. Test microphone denial/revocation, unavailable/full storage and reopening the app. Confirm actionable errors and that pending audio remains downloadable. Stop and wait until every chunk is Transcribed, then reopen and compare the transcript.
8. Confirm the generated questions reflect the session’s instructions. Review and edit them, submit as a participant with question-authoring permission, and verify they appear in the session. Generation alone must not publish them.

The labeled route has a 24 MiB chunk limit and falls back to ordinary transcription when needed. Actual phone encoding, delayed timers and long background intervals must be checked on the devices.


### Speaker labels

Group Conversation enables **Label speakers** by default for OpenAI transcription. Record becomes available after the provider settings load; the recorder can turn labels off before capturing. It uses OpenAI `gpt-4o-transcribe-diarize` with `diarized_json` and automatic chunking, retaining normalized speaker turns alongside the ordinary transcript in the saved recording. When the Worker cannot provide labels, the recorder keeps plain transcription and explains that labels are unavailable. Other transcription callers retain their existing model, request and text response.

Labels restart for each three-minute upload. They do not establish identity and are not merged across uploads. Speaker review, per-speaker mapping and claiming QR codes are not yet available. The labels toggle is available only for OpenAI transcription. If labels are unsupported by the provider or Worker, or a chunk exceeds 24 MiB, the same audio falls back to plain transcription using the normal audio chunker. A text-only reply is kept without another upload. The recorder reports that labels are unavailable and uses plain transcription for the rest of that recording. Keep the page visible during capture. The diarization model is deprecated with removal scheduled for 2027-02-26; replacing it is separate work.


### Returning after new questions are added

The voice interview starts with unanswered questions, newest first using creation dates already available in the browser. It keeps questions without dates in their existing relative order. If every question has an answer, it asks which answer the person wants to change instead of repeating the opening.

The voice chooser's personal AI-prefill prompt includes the same ordered question IDs and the IDs already answered in that browser. It does not include saved answer text or send progress to the public catalog. The catalog schema, prompt version and question-set fingerprint are unchanged. Generic Join prompts remain shareable and carry no person's progress. Dates and progress unavailable to the browser cannot be inferred; opening on another device before signing in may therefore offer questions already answered elsewhere.


### Reading session results

The session Results Report includes consensus and difference plus the Participants Graph. **Analyze clusters** uses the selected session's Worker configuration and the current viewer's authentication context. It requires that session's AI configuration and access. A political compass is currently available only within curated demo content; arbitrary session responses have no configured compass axes or scoring map.

### Realtime transcript order

Realtime sessions place completed input and interviewer transcripts in conversation
slots from `conversation.item.created`, `conversation.item.added`, and
`input_audio_buffer.committed`, using their item IDs and `previous_item_id`.
Late completions fill their existing slots; repeated completions update the same
turn. A completion without an ordering event appears after known slots in arrival
order until its event arrives. The live display and stopped transcript use the
same order. Live protocol fragments continue to use their timestamps. See the
[OpenAI server-event reference](https://developers.openai.com/api/reference/resources/realtime/server-events).
