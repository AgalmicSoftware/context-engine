# Session interview research metadata

Imported and voice-assisted session interviews can optionally attach AI provenance and draft-comparison metadata to the submitted response JSON. The draft-comparison research checkbox defaults off when the interview component initializes. If it is left unchecked, the response can still include ordinary provenance such as source platform/model when that separate checkbox is enabled, but it omits prediction-comparison fields.

This metadata is for workflow-quality research: it compares AI-proposed draft responses with the reviewed values a participant chose to submit. `changedFields` lists final values that differ from the original AI draft. `userEditedFields` records fields the reviewer touched during review, even if they restored the original value before submitting. Neither field means the participant scientifically agreed or disagreed with the model.

The submitted wire format is attached to each response at `responses[].interviewProvenance`. Encrypted answer or comment fields are redacted before this metadata is written, and the full interview transcript or imported conversation history is not attached.

For a visual overview, see the [interview research diagrams](assets/interview-research/README.md). Click either diagram there to open the full-size PNG.

## Consent Controls

Interview review exposes two independent choices:

| Control | Initial default | Submitted effect |
| --- | --- | --- |
| Include self-reported AI platform/model provenance with submitted responses | On when AI prefill provenance is available | Adds `source`, `promptVersion`, `questionSetHash`, and available `source.researchCoverage` details to `responses[].interviewProvenance`. |
| Share AI draft changes for research | Off | Adds draft-comparison fields such as `originalPrediction`, `predictionRevisions`, `finalSubmitted`, `changedFields`, `userEditedFields`, `redactedFields`, `predictionComparison`, and `unselectedPredictions`. |

The checkbox does not control whether an AI provider processed the interview, transcript, or imported text to create drafts. It controls whether Context Engine saves the comparison metadata alongside the submitted response.

These controls are component state. Their values can persist while the same interview component remains mounted, including continued interview work or reopening review UI that does not remount the component.

The optional responder name is submitted separately as `responses[].responderName`; it is not part of `responses[].interviewProvenance`.

## Field Reference

| Field | Included when | Meaning |
| --- | --- | --- |
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
| `userEditedFields` | Draft-comparison sharing is included | Fields touched during review, even when the final value was restored to the original. It is not a keystroke log. |
| `redactedFields` | Draft-comparison sharing is included | Text fields withheld from research snapshots because the submitted answer/comment field was encrypted or followed an encrypted answer. |
| `predictionComparison` | Draft-comparison sharing is included | Nested versioned copy of original, revisions, submitted values, changed fields, touched fields, and redaction fields for downstream consumers that prefer a single comparison object. |
| `unselectedPredictions` | Draft-comparison sharing is included and there were excluded drafts | Up to 100 excluded draft records attached under the selected anchor response. They include selection status, original/reviewed/submitted snapshots where applicable, changed/touched fields, and redaction fields. They are metadata, not submitted answers. This is a submitted-record cap, not a promise that every possible excluded draft was retained forever. |
| `appliedAt` | AI provenance or draft-comparison sharing is included | Timestamp from when drafts are applied to the response draft state during submission preparation, or `null` when unavailable. |

## Touched Versus Changed

`changedFields` and `userEditedFields` answer different questions. If the AI draft answer was "Unsure", the reviewer changed it to "Agree", and then restored it to "Unsure" before submitting, `changedFields` is empty while `userEditedFields` contains `answer`.

That distinction is intentional. An unchanged final value means only that the submitted value matched the original draft. It is not an agreement score and should not be interpreted as proof that the participant endorsed the AI's reasoning.

The nested `predictionComparison` object repeats the top-level comparison snapshot in a versioned shape for downstream consumers. Treat it as the same observation represented in a second schema shape, not as a second independent measurement.

## Redaction, Identifiers, and Visibility

When answer text is encrypted, the research snapshot writes `{ "redacted": true, "reason": "encrypted_field" }` instead of plaintext answer text. When additional comments are encrypted, or when comments follow an encrypted answer rather than an explicit plaintext audience, the comment text is redacted too. Evidence/basis strings are removed whenever answer or comment text is redacted, because evidence can repeat or reveal the protected text.

Redaction does not remove the whole record. Field names, changed/touched indicators, confidence, importance, conviction, revision numbers, model IDs, and timestamps can remain. The ordinary submitted response still carries its normal question and responder identifiers, including the responder wallet field written by the response payload. Interview research follows the response's normal session storage and visibility path; it is not automatically anonymous and does not create a separate private research backend.

The full interview transcript, imported conversation history, keystrokes, cursor history, edit timing, time-to-review, and semantic agreement score are not attached to this record. Unencrypted draft answers, comments, and evidence can still quote or summarize transcript-derived or import-derived content because those fields are the AI-generated draft and reviewed response content. Confidence, evidence, platform/model identity, and provenance details are reported by the workflow/model path; they are not independently validated research truth.

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

## Comparison with Edge2026 agent-village agent-only research

The Edge2026 agent-village experiment is implemented by `workers/agentBridgeWorker/telegramAgentOnlyMode.mjs`. It stores a separate agent-only event/state stream under Telegram agent-only KV prefixes and can export dedicated research views through `exportAgentOnlyData()`.

Agent-only records include agent answer events with `source: "agent_autofill"`, `eventKind`, answer payload, required confidence, optional rationale, model/scaffold/instructions metadata, run/request ids, token-usage metadata when available, privacy-protective skips, and a semantic fingerprint produced by `semanticFingerprintForAgentOnlyAnswer()`. Human review is recorded separately by `recordAgentOnlyHumanReview()` as explicit `confirm` or `edit` sidecars. The export path then derives `review_status` values such as `human_confirm`, `human_edit`, or `human_stale_confirm`; calibration exports bucket agent confidence into 10-point bands and count predictions, confirms, edits, and edit rate. Wide/gold exports can join current normal answers, prior submitted answers, agent predictions, confidence, eval type, and review status.

Session interview research is narrower and persists with ordinary submitted response data. When the responder opts in, `responses[].interviewProvenance` records the original AI draft, saved draft revisions, reviewed final values, net changed fields, touched fields, redacted fields, and rejected draft metadata for that submitted response. It does not create the agent-only KV event stream, does not feed `exportAgentOnlyData()`, and is not automatically exported to the Edge2026 calibration/gold/wide files.

The semantics are also different. Edge2026 distinguishes explicit confirm, edit, stale confirm, skips, agent reruns, and prior human answers with semantic fingerprints. Interview research distinguishes selected versus unselected drafts, final submitted values, fields whose final values changed, and fields the reviewer touched. It does not record keystrokes, edit timing, time-to-review, cursor history, or a semantic agreement score. A no-change submitted value is documented as unchanged, not as scientific agreement with the AI. An edited field later restored to the original remains in `userEditedFields` but drops out of `changedFields`.

Interview research follows the submitted response's normal visibility and storage path. If answer or additional-comment text is encrypted or locked, the comparison metadata redacts that text and the associated evidence rather than creating a separate plaintext research backend.
