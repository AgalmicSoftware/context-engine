# AI Discourse Bench Analysis Overlay Generator

You are generating a second-pass analysis overlay for a Context Engine AI
discourse benchmark report.

Input: a JSON object with `kind:
ai_discourse_bench_second_pass_analysis_input`. It contains model participants,
question-level aggregate results, participant stances, deterministic topic
circles, raw debate-atlas inputs, and risk-matrix target cells.

Output only valid JSON with this top-level shape:

```json
{
  "schemaVersion": 1,
  "kind": "ai_discourse_bench_analysis_overlay",
  "provenance": {
    "generatedBy": "analysis pipeline name",
    "model": "provider/model-id",
    "promptVersion": "analysis-overlay-v1",
    "inputReportHash": "copy inputReportHash exactly from the input",
    "generatedAt": "ISO-8601 timestamp"
  },
  "aiAnalysis": {
    "executiveSummary": "",
    "strongestConsensus": [],
    "sharpestDisagreements": [],
    "caveats": []
  },
  "debateAtlas": {
    "topicCircles": [],
    "topicEdges": [],
    "issueAreas": [],
    "compasses": []
  },
  "riskMatrix": {
    "cells": {}
  }
}
```

Requirements:

- Treat participant ids as model participants, not people.
- Copy `inputReportHash` exactly into `provenance.inputReportHash`; overlays with
  missing or mismatched provenance are rejected.
- Use `net support`, `net opposition`, and `mixed / unsure` language. Do not use
  "agree leaning" or "disagree leaning".
- Prefer short, report-ready labels and summaries. The overlay will be rendered
  inside Context Engine-style result panes.
- For `riskMatrix.cells`, use exact cell ids from
  `riskMatrix.aggregateCellTargets`, such as `Capabilities_vs_Labor`. Each cell
  may include `summary`, `opportunities`, `risks`, `linkedQuestionIds`,
  `linkedTopicIds`, `scenarios`, `confidence`, and `generatedBy`.
- Use `riskMatrix.cells.<cellId>.scenarios` sparingly for click-popup cards that
  connect a risk-matrix cell to a Debate Map topic or compass. Each scenario may
  include `id`, `atlasNodeId`, `atlasNodeLabel`, `title`, `summary`, `valence`
  (`risk`, `opportunity`, or `mixed`), `confidence`, `timeHorizon`,
  `primaryMechanism`, and optional `historicalAnchors`.
- Generate risk-matrix cell popups only where the benchmark results or question
  corpus support a meaningful interaction. Leave weak cells out.
- For `debateAtlas.topicCircles`, cluster questions into useful discourse
  topics. Include `id`, `label`, `summary`, `questionIds`, and `averageStance`
  when justified by the input.
- For `debateAtlas.topicEdges`, add only meaningful relationships between
  generated topic ids. Use relation labels such as `conflicts`, `reinforces`,
  `depends-on`, or `frames`.
- For `debateAtlas.issueAreas`, generate one modal-ready analysis object for
  each useful topic id. Every issue-area id must match an id in generated
  `topicCircles` or `debateAtlas.issueAreaTargets` so circle clicks resolve
  directly. Each object may include `title`, `summary`, `tags`,
  `keyTensions`, `pointsOfAgreement`, `pointsOfDisagreement`, `openQuestions`,
  `implications`, `linkedQuestionIds`, `confidence`, and `analysisSections`.
- `analysisSections` is the freeform extension point. Each section must have a
  concise `title`; it may include a paragraph-style `body`, `bullets`, and
  `linkedQuestionIds`. Generate 2-4 useful sections rather than generic filler.
- Keep issue-area tags short and reusable across topics. Use them for browsing
  and filtering, not as prose summaries.
- For `debateAtlas.compasses`, create two-axis maps that help interpret model
  disagreement. Include axis endpoint labels and placements with x/y values
  normalized from -1 to 1.
- Ground claims in the provided question summaries, participant stances, source
  anchors, and risk facets. Do not invent hidden runs or external evidence.
- Keep the JSON compact enough to embed in a static HTML report.
