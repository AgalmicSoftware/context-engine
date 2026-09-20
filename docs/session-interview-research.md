# Session interview research metadata

Imported and voice-assisted session interviews can optionally attach AI provenance and draft-comparison metadata to the submitted response JSON. The metadata is meant to answer practical research questions such as: which AI draft was shown, which final value was submitted, which fields changed by the time of submission, whether answer/comment text had to be redacted, and which platform/model the workflow self-reported.

The ordinary submitted answer remains the normal response fields: `answer`, `additional`, `importance`, `conviction`, question id, responder, and timestamps/storage metadata. Interview research is a sidecar on that submitted response, not a second answer. A final submitted snapshot in `interviewProvenance` should be read as a copy of the ordinary submitted values after review, with answer/comment text redacted when field encryption requires it.

When a session URL includes a valid `src` query parameter, the browser keeps the first source token seen for that session in session storage and attaches it to submitted response entries as `recruitment: { "source": "<token>" }`. This recruitment metadata is independent of AI provenance consent and can appear on ordinary manual responses, AI prefill responses, and responses where all interview research checkboxes are off. The client stores only the normalized source token for the current browser session; it does not store the full URL, hash, account, or additional navigation history.

`changedFields` is a net comparison between the original AI draft and the final submitted values. `userEditedFields` is a narrower signal from instrumented review-modal interactions; it can be empty even when a final value differs from the original draft, and it is not a complete event log. Neither field means the participant scientifically agreed or disagreed with the model.

Encrypted answer or comment fields are redacted before this metadata is written, and the full interview transcript or imported conversation history is not attached. Saved AI draft changes appear in exportable data only after a selected draft is submitted and the relevant research controls allow the metadata; in-memory review state that is closed or discarded without submission is not a stored research record.

For a visual overview, see the [interview research diagrams](assets/interview-research/README.md). Click either diagram there to open the full-size PNG.

## Consent Controls

Interview review exposes two independent choices:

| Control | Initial default | Submitted effect |
| --- | --- | --- |
| Include platform/model provenance | On when AI prefill provenance is available | Adds `source`, `promptVersion`, `questionSetHash`, and available `source.researchCoverage` details to `interviewProvenance`. |
| Share AI draft changes for research | Off | Adds draft-comparison fields such as `originalPrediction`, `predictionRevisions`, `finalSubmitted`, `changedFields`, `userEditedFields`, `redactedFields`, `predictionComparison`, and `unselectedPredictions`. |

The draft-comparison checkbox does not control whether an AI provider processed the interview, transcript, or imported text to create drafts. It controls whether Context Engine saves the comparison metadata alongside the submitted response.

These controls are component state. Their values can persist while the same interview component remains mounted, including continued interview work or reopening review UI that does not remount the component.

The optional responder name is submitted separately as `responderName` on the submitted response; it is not part of `interviewProvenance`.

## Submission and Storage Shape

Interview submissions use the ordinary response payload shape. A single-question or single-response storage payload can be one response object with top-level `interviewProvenance`. A multi-response submit is a JSON object with a `responses` array, where each entry can include its own `interviewProvenance`.

For Cloudflare-backed sessions, response payloads are uploaded to the `responses` storage resource through `/storage/upload`. The Worker stores an opaque storage reference and metadata row; response metadata may include the lowercased responder address for `responses` resources, but the storage ref itself does not expose that address. `/storage/read` returns the stored payload bytes when the requester is authorized. If the session uses Arweave-backed response storage instead, the payload is read by its Arweave transaction id rather than the Cloudflare storage routes.

Cloudflare encrypted-envelope export is a different route: `/storage/export-envelopes?resource=responses` returns ciphertext and envelope metadata for archival continuity. It does not decrypt response JSON and is not the right interface for inspecting `interviewProvenance`.

## Field Reference

| Field | Included when | Meaning |
| --- | --- | --- |
| `recruitment.source` | A valid first `src` URL token was captured for the session before submission | Session recruitment source attached to the submitted response entry. It is separate from `interviewProvenance`, does not depend on AI research consent, and is normalized to a bounded token rather than a URL. |
| `version` | AI provenance or draft-comparison sharing is included | Schema version for the submitted `interviewProvenance` object. The current value is `1`. |
| `source.platform` | AI provenance is included | Self-reported platform label from the import or voice workflow, normalized to a short string such as `chatgpt`, `claude`, or `other`. |
| `source.modelId` | AI provenance is included | Self-reported model identifier, capped before submission. |
| `source.verification` | AI provenance is included | Always written as `self_reported`; the app does not independently verify provider/model identity. |
| `source.researchCoverage` | AI provenance is included and coverage details exist | Optional counts for searched/used chat history, memory items, connected sources, and user statements. Counts are normalized and capped; an optional search-scope note is trimmed. |
| `promptVersion` | AI provenance is included | Interview prompt/schema version supplied by the prefill packet. |
| `questionSetHash` | AI provenance is included | Hash of the question set shown to the model, when available. |
| `originalPrediction` | Draft-comparison sharing is included | Redacted-safe snapshot of the selected AI draft before review: answer, additional comments, importance, conviction, confidence, and evidence. |
| `predictionRevisions` | Draft-comparison sharing is included and saved revisions exist | Up to 100 saved AI draft versions with revision number, model ID, answer/comment text when unencrypted, ratings, confidence, and evidence. This is record truncation for saved AI versions, not a complete history of every human edit. |
| `finalSubmitted` | Draft-comparison sharing is included | Redacted-safe final values submitted for the selected question. |
| `changedFields` | Draft-comparison sharing is included | Net fields whose final submitted value differs from the original AI prediction. Possible values are `answer`, `additionalComments`, `importance`, and `conviction`. |
| `userEditedFields` | Draft-comparison sharing is included and instrumented review interactions were captured | Fields touched through the review modal instrumentation, even when the final value was restored to the original. It is not a keystroke log or a complete edit history. |
| `redactedFields` | Draft-comparison sharing is included | Text fields withheld from research snapshots because the submitted answer/comment field was encrypted or followed an encrypted answer. |
| `predictionComparison` | Draft-comparison sharing is included | Nested versioned copy of original, revisions, submitted values, changed fields, touched fields, and redaction fields for downstream consumers that prefer a single comparison object. |
| `unselectedPredictions` | Draft-comparison sharing is included and there were excluded drafts | Up to 100 excluded draft records attached under the selected anchor response. They include selection status, original/reviewed/submitted snapshots where applicable, changed/touched fields, and redaction fields. They are metadata, not submitted answers. This is a submitted-record cap, not a promise that every possible excluded draft was retained forever. |
| `appliedAt` | AI provenance or draft-comparison sharing is included | Timestamp from when drafts are applied to the response draft state during submission preparation, or `null` when unavailable. |

## Touched Versus Changed

`changedFields` and `userEditedFields` answer different questions. If the AI draft answer was "Unsure", the reviewer changed it to "Agree", and then restored it to "Unsure" before submitting through an instrumented review control, `changedFields` is empty while `userEditedFields` can contain `answer`.

That distinction is intentional. An unchanged final value means only that the submitted value matched the original draft. It is not an agreement score and should not be interpreted as proof that the participant endorsed the AI's reasoning.

The reverse can also happen: `changedFields` can list a field while `userEditedFields` is empty. That means the final submitted value differs from the original AI draft, but the captured review-state touch markers did not record a modal interaction for that field. Treat touched fields as sparse UI instrumentation, not as proof that no edit, replacement, or upstream change occurred.

The nested `predictionComparison` object repeats the top-level comparison snapshot in a versioned shape for downstream consumers. Treat it as the same observation represented in a second schema shape, not as a second independent measurement.

## Redaction, Identifiers, and Visibility

When answer text is encrypted, the research snapshot writes `{ "redacted": true, "reason": "encrypted_field" }` instead of plaintext answer text. When additional comments are encrypted, or when comments follow an encrypted answer rather than an explicit plaintext audience, the comment text is redacted too. Evidence/basis strings are removed whenever answer or comment text is redacted, because evidence can repeat or reveal the protected text.

Redaction does not remove the whole record. Field names, changed/touched indicators, confidence, importance, conviction, revision numbers, model IDs, and timestamps can remain. The ordinary submitted response still carries its normal question and responder identifiers, including the responder wallet field written by the response payload. Interview research follows the response's normal session storage and visibility path; it is not automatically anonymous and does not create a separate private research backend.

The full interview transcript, imported conversation history, keystrokes, cursor history, edit timing, time-to-review, and semantic agreement score are not attached to this record. Unencrypted draft answers, comments, and evidence can still quote or summarize transcript-derived or import-derived content because those fields are the AI-generated draft and reviewed response content. Confidence, evidence, platform/model identity, and provenance details are reported by the workflow/model path; they are not independently validated research truth.

## Reading and Exporting Stored Records

The most direct read-only procedure for Cloudflare response storage is:

1. List response payload refs with `GET <session-worker>/storage/list?resource=responses`. The browser storage client calls this through `listSessionStorageRefsPage()` with anonymous-first fetch and authenticated fallback.
2. For each returned `storageRef.id`, read the raw payload with `GET <session-worker>/storage/read?id=<storageRef.id>`. The browser storage client calls this through `readSessionStorageBlob()`.
3. Parse the returned JSON. If the payload has a `responses` array, inspect `responses[].interviewProvenance` on each response entry. If the payload is a single response object, inspect its top-level `interviewProvenance`.

Access depends on the session's storage and results policy. Some sessions allow anonymous reads for public results; others require the normal Worker bearer token acquired by the app's SIWE/passkey worker-login flow. In the browser client, `fetchWorkerWithAuth()` first tries anonymous read/list when requested, then retries with `Authorization: Bearer <worker-token>` and `X-Group-Slug: <slug>` if the Worker requires authentication.

The Results screen has separate browser downloads for `CSV: Questions`, `CSV: Questions + Responses`, `JSON: Questions`, and `JSON: Questions + Responses`. The CSV response export intentionally flattens response rows to question id, prompt, type, options, responder address, importance, answer value/hash, additional value/hash, encryption flags, timestamp, and voice credits; it does not include `interviewProvenance`. The JSON questions-and-responses export includes the filtered response rows as held by the results view. Depending on the view and hydration path, each row's raw `response` can be an object or a JSON string; inspect and parse that nested `response` value, then check either `response.interviewProvenance` or `response.responses[].interviewProvenance`. For full-fidelity research review, use the raw storage read path above.

```json
{
  "responses": [
    {
      "questionID": "q-ai-safety-1",
      "answer": { "value": "I worry that evaluations can miss deployment risks." },
      "additional": { "value": "The strongest evidence was about monitoring after launch." },
      "interviewProvenance": {
        "version": 1,
        "source": {
          "platform": "chatgpt",
          "modelId": "gpt-example",
          "verification": "self_reported"
        },
        "promptVersion": "ce-interview-brief-v4",
        "questionSetHash": "8b7f...",
        "originalPrediction": {
          "answer": "I expect model evaluations to miss deployment risks.",
          "additionalComments": "The source mentioned monitoring after launch.",
          "importance": 70,
          "conviction": 60,
          "confidence": 0.74,
          "evidence": "Grounded in the imported summary."
        },
        "predictionRevisions": [
          {
            "revision": 1,
            "modelId": "gpt-example",
            "answer": "I expect model evaluations to miss deployment risks.",
            "additionalComments": "The source mentioned monitoring after launch.",
            "importance": 70,
            "conviction": 60,
            "confidence": 0.74,
            "evidence": "Grounded in the imported summary."
          }
        ],
        "finalSubmitted": {
          "answer": "I worry that evaluations can miss deployment risks.",
          "additionalComments": "The strongest evidence was about monitoring after launch.",
          "importance": 80,
          "conviction": 60
        },
        "changedFields": ["answer", "additionalComments", "importance"],
        "userEditedFields": ["answer", "additionalComments", "importance"],
        "redactedFields": [],
        "predictionComparison": {
          "version": 1,
          "original": {
            "answer": "I expect model evaluations to miss deployment risks.",
            "additionalComments": "The source mentioned monitoring after launch.",
            "importance": 70,
            "conviction": 60,
            "confidence": 0.74,
            "evidence": "Grounded in the imported summary."
          },
          "revisions": [
            {
              "revision": 1,
              "modelId": "gpt-example",
              "answer": "I expect model evaluations to miss deployment risks.",
              "additionalComments": "The source mentioned monitoring after launch.",
              "importance": 70,
              "conviction": 60,
              "confidence": 0.74,
              "evidence": "Grounded in the imported summary."
            }
          ],
          "submitted": {
            "answer": "I worry that evaluations can miss deployment risks.",
            "additionalComments": "The strongest evidence was about monitoring after launch.",
            "importance": 80,
            "conviction": 60
          },
          "changedFields": ["answer", "additionalComments", "importance"],
          "userEditedFields": ["answer", "additionalComments", "importance"],
          "redactedFields": []
        },
        "unselectedPredictions": [
          {
            "questionId": "q-ai-safety-2",
            "selection": "not_selected",
            "revisions": [],
            "original": {
              "answer": { "redacted": true, "reason": "encrypted_field" },
              "additionalComments": { "redacted": true, "reason": "encrypted_field" },
              "importance": null,
              "conviction": null,
              "confidence": 0.52,
              "evidence": ""
            },
            "reviewed": {
              "answer": { "redacted": true, "reason": "encrypted_field" },
              "additionalComments": { "redacted": true, "reason": "encrypted_field" },
              "importance": null,
              "conviction": null
            },
            "submitted": null,
            "changedFields": [],
            "userEditedFields": [],
            "redactedFields": ["answer", "additionalComments"]
          }
        ],
        "appliedAt": 1789776000000
      }
    }
  ]
}
```

`source` is self-reported by the import or voice workflow. `questionSetHash` records which question bank was shown to the model when available. `unselectedPredictions` are retained only as consented research metadata; they are never submitted answers. `redactedFields` lists answer/comment fields whose text was withheld because the participant locked or encrypted that field.

The in-memory draft-review state is keyed by question id while the modal is open. Excluded draft metadata is attached to one research-anchor response: the first pending selected draft when one exists, otherwise the first draft. That internal state is converted to the submitted wire format by `client/src/components/SurveyTool/surveyToolResponsePayloadController.ts`, where final redaction also happens.

## Compatibility with Agent Mirror Evaluation

The record is compatible with an agent-mirror or model-quality evaluation only as ordinary raw response JSON that a downstream evaluator explicitly knows how to read. The useful fields for that evaluator are the selected draft snapshot, final submitted snapshot, saved draft revisions, selected/unselected status, confidence, self-reported platform/model provenance, redaction flags, and changed/touched field lists.

It is not automatically in the Edge2026 agent-only export schema, and it does not by itself provide an explicit human confirm/edit event, semantic fingerprint, calibration bucket, edit timing, or agent run/request lifecycle. A downstream mirror eval must treat `changedFields` and `userEditedFields` as field-level review signals, not as a direct agree/disagree label.

## Comparison with Edge2026 agent-village agent-only research

The Edge2026 agent-village experiment is implemented by `workers/agentBridgeWorker/telegramAgentOnlyMode.mjs`. It stores a separate agent-only event/state stream under Telegram agent-only KV prefixes and can export dedicated research views through `exportAgentOnlyData()`.

Agent-only records include agent answer events with `source: "agent_autofill"`, `eventKind`, answer payload, required confidence, optional rationale, model/scaffold/instructions metadata, run/request ids, token-usage metadata when available, privacy-protective skips, and a semantic fingerprint produced by `semanticFingerprintForAgentOnlyAnswer()`. Human review is recorded separately by `recordAgentOnlyHumanReview()` as explicit `confirm` or `edit` sidecars. The export path then derives `review_status` values such as `human_confirm`, `human_edit`, or `human_stale_confirm`; calibration exports bucket agent confidence into 10-point bands and count predictions, confirms, edits, and edit rate. Wide/gold exports can join current normal answers, prior submitted answers, agent predictions, confidence, eval type, and review status.

Session interview research is narrower and persists with ordinary submitted response data. When the responder opts in, `interviewProvenance` records the original AI draft, saved draft revisions, reviewed final values, net changed fields, sparse touched-field markers, redacted fields, and rejected draft metadata for that submitted response. It does not create the agent-only KV event stream, does not feed `exportAgentOnlyData()`, and is not automatically exported to the Edge2026 calibration/gold/wide files.

The semantics are also different. Edge2026 distinguishes explicit confirm, edit, stale confirm, skips, agent reruns, and prior human answers with semantic fingerprints. Interview research distinguishes selected versus unselected drafts, final submitted values, fields whose final values changed, and instrumented fields the reviewer touched. It does not record keystrokes, edit timing, time-to-review, cursor history, or a semantic agreement score. A no-change submitted value is documented as unchanged, not as scientific agreement with the AI. When a touched marker is captured for a field that is later restored to the original, that field remains in `userEditedFields` but drops out of `changedFields`.

Interview research follows the submitted response's normal visibility and storage path. If answer or additional-comment text is encrypted or locked, the comparison metadata redacts that text and the associated evidence rather than creating a separate plaintext research backend.

## Source Map

The current implementation path is:

- `client/src/components/SurveyTool/SessionInterviewResearchConsent.tsx` renders the research and provenance disclosure.
- `client/src/components/SurveyTool/sessionInterviewDraftSubmit.ts` applies selected drafts and passes the consent flags into the submit path.
- `client/src/components/SurveyTool/SurveyPileViewMode.tsx` records review-state provenance by question id in the active response draft.
- `client/src/components/SurveyTool/surveyQuestionsSubmitRuntime.ts` keeps that provenance while encrypting answer/comment fields.
- `client/src/components/SurveyTool/surveyToolResponsePayloadController.ts` builds the final response payload and writes `interviewProvenance` on submitted response objects.
- `client/src/components/SurveyTool/sessionInterviewResearch.ts` redacts encrypted text and formats selected/unselected draft comparison records.
- `client/src/utilities/web3/contractScripts.impl.ts` uploads the final JSON payload to the configured response storage resource.
- `client/src/utilities/storage/storageClient.ts` and `workers/sessionCorsWorker/storageRouteExecution.js` implement Cloudflare `/storage/upload`, `/storage/list`, and `/storage/read` for sessions using Cloudflare response storage.
