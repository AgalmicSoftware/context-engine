# Session interview research metadata

Imported and voice-assisted session interviews can optionally attach AI provenance and draft-comparison metadata to the submitted response JSON. The research checkbox is opt-in for each review. If it is left unchecked, the response can still include ordinary provenance such as source platform/model when that separate checkbox is enabled, but it omits prediction-comparison fields.

This metadata is for workflow-quality research: it compares AI-proposed draft responses with the reviewed values a participant chose to submit. `changedFields` lists final values that differ from the original AI draft. `userEditedFields` records fields the reviewer touched during review, even if they restored the original value before submitting. Neither field means the participant scientifically agreed or disagreed with the model.

The submitted wire format is attached to each response at `responses[].interviewProvenance`. Encrypted answer or comment fields are redacted before this metadata is written, and the full interview transcript or imported conversation history is not attached.

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

The in-memory draft-review state is keyed by question id while the modal is open. That internal state is converted to the submitted wire format by `client/src/components/SurveyTool/surveyToolResponsePayloadController.ts`, where final redaction also happens.

## Comparison with Edge2026 agent-village agent-only research

The Edge2026 agent-village experiment is implemented by `workers/agentBridgeWorker/telegramAgentOnlyMode.mjs`. It stores a separate agent-only event/state stream under Telegram agent-only KV prefixes and can export dedicated research views through `exportAgentOnlyData()`.

Agent-only records include agent answer events with `source: "agent_autofill"`, `eventKind`, answer payload, required confidence, optional rationale, model/scaffold/instructions metadata, run/request ids, token-usage metadata when available, privacy-protective skips, and a semantic fingerprint produced by `semanticFingerprintForAgentOnlyAnswer()`. Human review is recorded separately by `recordAgentOnlyHumanReview()` as explicit `confirm` or `edit` sidecars. The export path then derives `review_status` values such as `human_confirm`, `human_edit`, or `human_stale_confirm`; calibration exports bucket agent confidence into 10-point bands and count predictions, confirms, edits, and edit rate. Wide/gold exports can join current normal answers, prior submitted answers, agent predictions, confidence, eval type, and review status.

Session interview research is narrower and persists with ordinary submitted response data. When the responder opts in, `responses[].interviewProvenance` records the original AI draft, saved draft revisions, reviewed final values, net changed fields, touched fields, redacted fields, and rejected draft metadata for that submitted response. It does not create the agent-only KV event stream, does not feed `exportAgentOnlyData()`, and is not automatically exported to the Edge2026 calibration/gold/wide files.

The semantics are also different. Edge2026 distinguishes explicit confirm, edit, stale confirm, skips, agent reruns, and prior human answers with semantic fingerprints. Interview research distinguishes selected versus unselected drafts, final submitted values, fields whose final values changed, and fields the reviewer touched. It does not record keystrokes, edit timing, time-to-review, cursor history, or a semantic agreement score. A no-change submitted value is documented as unchanged, not as scientific agreement with the AI. An edited field later restored to the original remains in `userEditedFields` but drops out of `changedFields`.

Interview research follows the submitted response's normal visibility and storage path. If answer or additional-comment text is encrypted or locked, the comparison metadata redacts that text and the associated evidence rather than creating a separate plaintext research backend.
