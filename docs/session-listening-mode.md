# Session Voice Modes

The microphone on `/session/<slug>` opens a modal with two participant workflows:

- **Interview** — one responder speaks with a realtime interviewer. Context Engine maps the completed responder transcript into reviewable response drafts.
- **Group Conversation** — records a discussion, creates a rolling transcript, and generates reviewable question drafts.

The session links are:

```text
/session/<slug>?mode=interview
/session/<slug>?mode=recordGroup
```

The direct links open the selected modal panel. Clicking the microphone without
a mode query opens the two-choice launcher. The older
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
(or **More options** in Customize) → **Interview voice settings** →
**Interview voice model**.

The UI shows Ready, Connecting, Listening, Paused, Ending, Preparing drafts,
Review drafts, or Error. Listening requires a connected peer, an open data
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

The shipped `demo-interview` client record pins its deployed Worker, so its
route is simply `/session/demo-interview?mode=interview`; it does not require a
`worker=` discovery parameter. Registry-backed sessions likewise read
`corsWorkerUrl` from registered session metadata. A newly shared,
Worker-canonical session still needs an explicit discovery link unless its app
deployment bundles the Worker origin or serves the session from that origin.

The interviewer opens by asking for an important insight either about the
responder and their perspective or about the broader topic behind the
questions. It explicitly tells the responder that they can steer the
conversation at any point, follows that direction, and then covers the
accessible session questions conversationally. Only responder speech becomes
answer evidence. Interviewer questions are retained as context so short replies
such as “four” can be matched to the question asked. Live input and output
transcript fragments are retained exactly, deduplicated by event ID, and ordered
by session time; legacy Realtime sessions use completed input transcriptions.
A new interview clears the previous transcript and review drafts.
New speech is mapped even if the interview started with imported predictions. When the call ends, the responder can
expand a read-only transcript disclosure while `gpt-5.6-terra` with low reasoning effort and standard processing (`service_tier: default`)
maps the transcript and any responder context imported by an AI prefill link
to response drafts. Imported context remains editable but the context field
stays hidden during a normal voice-only interview. Drafts may include comments,
importance, and conviction only when the evidence explicitly supports them.
Every generated draft also carries a confidence value from 0 to 1. The review
panel renders it as weak inference (0–39%), moderate support (40–69%), or strong
support (70–100%) so a responder can keep, edit, or reject tentative answers
instead of losing useful low-confidence signal.
If the evidence cannot support any session answer, the modal says that there
is not enough information, explains that no directly relevant detail was
found, and suggests another interview or relevant Claude/ChatGPT memories. It
does not present an unchanged generate button as though more input had arrived.

Drafts open in a review panel with the session's answer inputs, additional
comments, conviction/importance control, and answer/comment lock menus. Relevant
interview explanations appear as editable additional comments. The responder
selects which drafts to submit and must explicitly opt into replacing an existing
local answer. **Submit responses** saves reviewed values and enters the normal
submission flow, opening sign-in when necessary. Drafts survive that sign-in;
the responder can finish submission through the session's normal Submit control.
Stopping alone never submits answers. The default-on platform provenance option
appears only when an AI augmentation packet was imported. When it is retained,
submitted response metadata keeps the prompt/question-set revision
and self-reported source platform/model. A separate accuracy-research checkbox
is also on by default. It records the original AI prediction, the final submitted
answer, the fields that changed, and the prediction confidence so model fidelity
can be evaluated without treating low-confidence drafts as unusable. Responders
can disable either consent independently before submitting. Its question-mark
tooltip explains that edited and unselected drafts are included. Unselected
predictions are stored once as research metadata alongside a selected submitted
response, with their original and edited values and selection status; they do
not become answers. An unsubmitted draft has a null final submitted value. For an
encrypted answer or additional comment, the comparison records only an encrypted
field marker and whether the field changed; it never places the protected text in
plaintext metadata, and it omits the prediction basis from that metadata.
An external AI may also include a preferred responder name that it already
knows from the permitted context. The review modal shows a separate
**Include “name” as the responder name** checkbox only when a name was supplied,
and that checkbox is off by default. The name is attached to submitted answers
only after this explicit opt-in; declining it does not affect the drafts or the
platform/model provenance choice.

## Ordinary ChatGPT or Claude, without MCP

Interview mode displays a compact **Paste this prompt to augment interview with
history from Claude or ChatGPT** card. Its prompt is collapsed by default. A
**View prompt** button with a downward caret reveals the exact instruction at
reduced opacity and changes to **Hide prompt** while expanded. The top-right
clipboard icon copies the same explicit user request without requiring the
preview to be open:

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
hash, prompt version, an optional responder summary, proposed response drafts, per-draft
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
one. A packet may include a preferred name only when the external AI already
knows it; the prompt forbids inference and the client does not submit it unless
the responder enables the default-off name control. The packet contains no
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
The account used at final normal submission owns the response. If an older
packet contains context facts but not responses, the session AI mapping lane
still converts those facts into drafts.

The review surface shows confidence as a progress meter and keeps each evidence
basis collapsed until requested. Binary drafts reuse the normal pile-view
Agree/Unsure/Disagree controls. Applied source/model provenance is persisted in
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
`reasoning.effort: low`, `service_tier: default`, and JSON output formatting, without
unsupported sampling parameters. GPT-Live remains the voice interviewer. See
[OpenAI’s Terra model documentation](https://developers.openai.com/api/docs/models/gpt-5.6-terra).
Mapping targets roughly ten seconds for ordinary interviews, but latency depends
on transcript length, number of drafts, and provider load; it is not a deadline
that discards partial work.
