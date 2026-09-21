# Session Voice Modes

The microphone on `/session/<slug>` opens a modal with two participant workflows:

- **Interview** — one responder speaks with a realtime interviewer. Context Engine maps the completed responder transcript into reviewable response drafts and may suggest new questions for review.
- **Group Conversation** — records a discussion, creates a rolling transcript, and generates reviewable question drafts.

The session links are:

```text
/session/<slug>?mode=interview
/session/<slug>?mode=recordGroup
```

The direct links open the selected modal panel. Clicking the microphone without
a mode query opens the two-choice launcher. Its cards sit side by side with
centered icons; the header close button dismisses it without a separate footer.
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
Worker config writes reject unsupported values. The provider remains OpenAI.
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
The augmentation prompt displays paragraphs and bold key points for readability;
its Copy button copies the original plain text without formatting.

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

Auto mode generates on the first Interview opening with available public questions and permitted session AI access. No separate admin setup step is needed for an open AI-enabled session. An empty bank waits until questions exist. The Worker uses its OpenAI key and caches the result at `session:<slug>:interview-opening`, with the generation time and baseline question count, separately from owner configuration. The default reuses this opening even as the bank grows; enabling regeneration checks the threshold on the next Interview opening. For example, 42 questions require nine additions at 20%. A failed refresh retains the previous opening. Initial failure visibly falls back to an existing session question.

Live updates use [`session.instructions.append`](https://developers.openai.com/api/reference/typescript/resources/live); supported legacy sessions use [`conversation.item.create` system messages](https://developers.openai.com/api/reference/typescript/resources/realtime). These updates never restart the conversation or replace its opening. Pause and Stop cancel polling and discard late results. Discovery uses the existing public catalog's visibility checks and 100-question limit; private questions are not added through this public discovery path. There are no edit-based or scheduled regeneration conditions.

Live capacity notes for 100-person tests, checked September 19, 2026:

- [`gpt-live-1`](https://developers.openai.com/api/docs/models/gpt-live-1) rate limits are measured in concurrent sessions. The published tiers are Tier 1: 25, Tier 2: 50, Tier 3: 200, Tier 4: 300, and Tier 5: 500 concurrent sessions; Free is not supported. A 100-user live-voice test therefore needs at least Tier 3 for the live model itself.
- OpenAI's [rate-limit guide](https://developers.openai.com/api/docs/guides/rate-limits) also applies to the backend text/model calls used after Stop. Confirm the organization's actual Limits dashboard before the test because limits vary by model and can include RPM, TPM, and audio-minute ceilings. The current account tier and remaining allocation are not knowable from this repository.
- Organization and project limits both matter. OpenAI documents org/project rate limits and project-scoped headers, while [spend limits](https://developers.openai.com/api/docs/guides/spend-limits) can be configured at either org or project level; project settings cannot make traffic succeed after an applicable organization limit or approved usage limit is exhausted.
- Context Engine does not currently enforce app-level voice spend or duration caps. The practical cap is the configured OpenAI allocation plus the session Worker and browser paths.
- Authenticated submission paths still request Worker nonces. The Worker constants set `NONCE_RATE_LIMIT_MAX = 5` per minute, and nonce issuance uses the trusted Cloudflare/anonymous rate identity in `authNonceRequestDispatch`. A same-venue Wi-Fi test can bottleneck on nonce issuance before it demonstrates 100 independent live voices or submissions.
- A read-only 100-browser GET test is not equivalent to 100 live voice sessions plus response submissions. Headless browser coverage can use virtual WebAuthn PRF for auth flows, but it should be planned as a separate load profile from read-only page fetches.

Suggested questions follow the response drafts in an expandable **Suggested new questions** section, initially open, using pile-style question cards with editable prompts and tags. Interview review hides the survey/questions toggle and manual question-type selector; the normal authoring surface retains them. A help tooltip beside the section heading explains that suggestions remain drafts until uploaded. Both review sections use matching headings and support keyboard collapse/expand without losing edits. Questions can be edited or removed and require the normal explicit creation/sign-in/permission flow; stopping an interview and submitting response drafts do not create questions. Suggested questions are visible before sign-in so the responder can review them, but after sign-in the section stays hidden unless the connected participant is allowed to create questions for that session. Unresolved group, SBT, or custom permissions keep the section hidden in the UI, and the backend still enforces the upload. Suggestions share the response-mapping request, avoiding an extra model round trip. That request also generates short, non-identifying tags, prefers relevant session `defaultTags`, and incorporates `questionsGenPrompt` guidance. Default tags are suggestions rather than a restricted vocabulary; users can add or remove tags before upload.

When the session has eligible Worker-backed groups, Interview review may also show an optional **Suggested groups** section after suggested questions. Group suggestions use only explicit reviewed respondent evidence, with question prompts supplied as context for short binary, rating, or multiple-choice answers; interviewer text, names, accents, and weak topical mentions are not enough. The app validates recommendations against the current Worker group catalog and shows only open, non-expired session-visible groups that the signed-in participant has not already joined; restricted, invite-only, password, closed, full, registry, and SBT-only groups are not joined inline. Recommendations never join a group or open login by themselves. Clicking **Join** starts the normal sign-in and Worker group-join flow for that selected group, revalidates the authenticated catalog before the join, keeps the Interview modal open, and broadcasts the normal Groups membership refresh after success. Canceling login cancels only that pending join. Recommendation failures do not block response submission or suggested-question editing/upload, and the Worker still enforces membership writes. If a reviewer edits a response after suggestions appear, the group suggestions are cleared until the reviewer explicitly refreshes them.

Only responder speech becomes
answer evidence. Interviewer questions are retained as context so short replies
such as “four” can be matched to the question asked. Live input and output
transcript fragments are retained exactly, deduplicated by event ID, and ordered
by session time; legacy Realtime sessions use completed input transcriptions.
**Continue interview** continues the existing conversation. Each round appends to the transcript, and mapping reviews the combined evidence alongside earlier predictions and user-reviewed responses. Changed predictions retain numbered versions with model IDs in local review state; consented research submission includes those versions and applies the same answer/comment encryption redaction to every version. Research controls also appear after a voice-only continuation revises a prediction. Declining research excludes the history from submitted metadata. Existing matches are retained, untouched AI fields can be refined, and user edits and excluded drafts are preserved. Suggested question prompts and tags also survive continuation; only novel suggestions are appended. A failed connection or a round with no new speech leaves the previous review intact. Closing the Interview dialog still ends this in-memory review.
New speech is mapped even if the interview started with imported predictions. When the call ends, the responder can
expand a read-only transcript disclosure while `gpt-5.6-terra` with medium reasoning effort and standard processing (`service_tier: default`)
maps the transcript and any responder context imported by an AI prefill link
to response drafts. Imported context remains editable in a collapsed
**Imported responder context** disclosure; during a normal voice-only interview
that context editor is absent, keeping the microphone as the primary action.
Drafts may include comments,
importance, and conviction only when the evidence explicitly supports them.
Every generated draft also carries a confidence value from 0 to 1. The review
panel labels this **AI-estimated confidence**, describing the AI’s estimate of
how well the evidence supports its draft. It renders the estimate as weak
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
an **X** to exclude them; an excluded draft offers **Restore draft**, or
**Replace with draft** when a local answer already exists. There is no redundant
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

Interview mode displays a **Copy and paste this prompt (into Claude or ChatGPT)
to augment interview** footer card beneath the microphone when the interview has
not already been opened from a ChatGPT or Claude prefill packet. Clicking its
heading or enlarged top-right clipboard copies the request without opening the
preview. The **Prompt** dropdown inside the card expands the instruction and
collapses it again; the preview starts collapsed and remains collapsed after a
successful copy. A question-mark tooltip to the left of **Prompt** explains:
“Allows your agent to predict your responses and raise better interview questions.”
The tooltip is available on hover and keyboard focus. The copied request begins:

```text
Help me prepare a review-only Context Engine interview prefill. Fetch
<session-worker>/agent/interview-catalog?... and require the current inert
catalog contract. Search only already-authorized, question-related history,
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
has a defensible indirect signal and explains its basis; only questions with no
relevant signal are omitted. Model identity is collected to measure prediction
fidelity across models and may be `unknown` when the interface does not expose
one. The copied prompt does not request a responder name. Previously generated
packets may still include one; the client does not submit it unless the responder
enables the default-off name control. The packet contains no
credential and is carried in `#prefill=...`, so it
is not sent to the web host as an HTTP request target. The fragment is still
intentionally readable by scripts on the destination page, which is why source
identifiers are forbidden and the exact JSON is shown first. Prompt version
`ce-interview-brief-v4` provides this shorter direct-response contract and uses
the distinct `/agent/interview-catalog` URL to avoid stale external fetches. The
catalog makes the application answer contract explicit: binary responses use
`Agree`, `Unsure`, or `Disagree`; ratings use 0-10; and multichoice responses
must use an exact listed option. Its additive `researchCoverageContract` lists
the count fields and labels them self-reported without turning the catalog into
agent instructions. The client continues to accept version 1-3 packets from
previously copied prompts.

When Context Engine opens that link, it validates the packet, requires the
session slug and question-set hash to match, removes the fragment from browser
history, and validates the AI-authored response drafts against the current
questions and listed options. Current direct responses are not re-authored by a
different mapping model, so their source attribution and confidence remain
faithful to the external AI. Every proposed answer remains a local review draft.
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

The **Transcript** and prompt footer cards share one row. Without a transcript,
the prompt card fills the row, including when expanded. The heading, copy icon,
dropdown, help tooltip and preview remain inside the same bordered card.

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
route. Returned transcripts are stitched with overlap deduplication.

The visible transcript is collapsed by default. Generated questions are drafts
rendered through the existing `CreateQuestionsAndSurveys` review surface and
are never auto-published. Raw chunks are discarded after successful
transcription; the browser retains only transcript and recovery status metadata
by default.

## Access and failure behavior

- Private, encrypted, or masked question prompts are never placed in the public brief or realtime instructions before the participant can access them.
- Cloudflare-native questions are read through the canonical storage routes and their per-item authorization checks.
- Registry/on-chain question discovery is bounded by configured block limits, a two-million-block maximum window, and 100 questions.
- Realtime and response mapping use the same anonymous AI eligibility rules as other session AI features. A session end, disabled scope, restricted gate, missing Worker key, or unavailable Worker fails visibly instead of prompting for a surprise wallet/passkey signature.
- No voice mode submits, publishes, or overwrites an existing local answer without an explicit user action.

## Main files

- `client/src/components/SurveyTool/SessionVoiceModeModal.tsx`
- `client/src/components/SurveyTool/sessionInterview.ts`
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
