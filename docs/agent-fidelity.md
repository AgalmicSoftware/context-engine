# Agent fidelity

When an AI drafts someone's answers, how often does it get them right, how
sure was it, did it beat a stereotype, and did its drafts flatten strong or
unusual views? `shared/agentFidelity.mjs` scores this, and
`scripts/agent-fidelity-report.mjs` turns a session's results into a report.
It implements the Agent Mirror Test from the
[Agent Village Wrapped post](../posts/agent-village-wrapped/agent-village-wrapped.md),
with the changes noted below.

## Data

- **Session responses.** AI prefill and interview drafts keep the AI's
  original draft in `interviewProvenance.originalPrediction` (answer and
  confidence) when the participant leaves **Share AI draft changes for
  research** on; see [session-interview-research.md](session-interview-research.md).
  The scored answer is the ordinary submitted `answer`.
- **Session Wrapped.** The Agent Bridge's agent-only export (`wide` or `gold`
  view) pairs `agent_prediction` and `agent_confidence` with the person's own
  `human_current_answer` or `prior_human_answer`.
- **Everyone's answers**, with or without AI, for the baselines and the
  unusual-views analysis.

Each prediction is scored under one condition:

| Condition | Meaning |
| --- | --- |
| `shown` | The person reviewed the AI's draft before answering. |
| `blind` | The draft stayed hidden until the person answered. |
| `separate` | The prediction was made elsewhere and not shown in review (Session Wrapped). |

Sessions write blind records when `interviewMode.hiddenDraftShare` is set
(see [session-interview-research.md](session-interview-research.md#hidden-drafts)):
`interviewProvenance.predictionCondition: "blind"` with `blindAnswer`, the
answer given before the draft was revealed, and `revealedAt`. Other version 2
records say `"shown"`. Version 2 records also carry `draftOrigin`; for older records, origin is inferred from the self-reported
source (`chatgpt` or `claude` means chat-assistant prefill; the app's default
model with platform `other` means a voice interview). At minimal research
detail, freeform predictions are `null` and are not scored.

## Scores

Similarity between a prediction and an answer runs from 0 to 1:

| Question type | Similarity |
| --- | --- |
| Agree / Unsure / Disagree | 1 if the same, otherwise 0 |
| Single choice | 1 if the same option, otherwise 0 |
| Multiple choice | Shared options divided by all options either picked |
| Rating | 1 − distance ÷ scale width (7 against 9 on 0–10 scores 0.8) |
| Quadratic | (1 + cosine of the two vote vectors) ÷ 2: same priorities 1, unrelated 0.5, opposite 0. Two empty allocations score 1; one empty scores 0.5. |
| Freeform | Not scored |

- **Mirror Score:** mean similarity for each person, then the mean across
  people, so prolific participants don't dominate.
- **Correction rate:** the share of shown choice drafts the person changed.
  Ratings and vote allocations rarely come back exactly, so they count through
  similarity only.
- **Calibration:** for choice predictions with a stated confidence, the share
  kept unchanged in each tenth of the confidence range, plus the Brier score
  and expected calibration error. Prefill confidences are 0–1; Wrapped
  confidences are 0–100 and are rescaled. Only confidences that mean the chance
  of keeping the answer count. Version 2 records say so in `confidenceMeaning`;
  older ones are read from their prompt version (`ce-interview-brief-v6` and
  later). Earlier prompts and Session Wrapped's rubric grade strength of
  support, so they are left out; `coverage.byConfidenceMeaning` counts each
  among choice predictions.
- **Anchoring:** for people with both conditions, agreement on shown drafts
  minus agreement on hidden ones. Above zero means showing a draft pulled
  answers toward it, so shown-draft scores overstate fidelity by about that
  much. Shown drafts count only from the hidden ones' source, since only
  AI-prefill drafts are hidden; voice drafts would otherwise inflate it.
- **Baselines and lift:** the same predictions scored against the most common
  answer among everyone else, and among the person's own group when at least
  three others are in it. The most common answer is the mode for choices, the
  median for ratings, options most people picked for multiple choice, and mean
  votes for quadratic. Lift is the Mirror Score minus the baseline on the same
  predictions.
- **Unusual views:** each person's typicality is the mean similarity of their
  answers to every other person's answers on the same questions. The report
  splits people into thirds by typicality and gives the AI's score, the
  baseline's and the lift for each, plus rank correlations with intervals. An
  AI that only knows the stereotype loses accuracy on unusual people as fast as
  the baseline does; one that knows the person keeps its lift.
- **Synthesis checks:** the AI's drafts minus people's own answers, per person
  and then averaged:
  - rating extremity;
  - the share of quadratic credits on the top option, and of the budget used;
  - the rate of "Unsure";
  - importance and conviction;
  - agreement with the most common answer.

  A spread measure compares how much drafts and answers differ between people
  on each question. Below zero means the drafts were weaker or more alike than
  what people said.

## Uncertainty and privacy

- Intervals are 95% bootstrap intervals that resample people (default 1,000
  samples, seed 1), because rows from one person aren't independent.
- Any result based on fewer than 5 people is withheld, including calibration,
  anchoring and each third of the unusual-views table.
  - Groups that small are not named at all, since a group can be a single
    invite link.
  - Per-person rows, listed by pseudonym (`p001`…) and never by address, appear
    only when the whole report has at least 5 people.
- Self-declared agents (`participant.kind: "agent"`) are left out unless asked
  for.
- For each person and question only the latest record counts. If someone later
  withdraws research consent or encrypts the answer, their earlier draft
  comparison is not used.
- Importance and conviction are read with the app's stored-rating rule
  (`shared/questions/storedRating.mjs`): legacy 0–100 values are rescaled, and
  a missing importance falls back on conviction.

## Running it

Download **JSON: Questions + Responses** from the session's Results screen
(either view), then:

```bash
node scripts/agent-fidelity-report.mjs --export results.json --out reports/
```

This writes `agent-fidelity-report.json` and `agent-fidelity-report.md`.

| Option | Use |
| --- | --- |
| `--questions <file> --responses <file>` | Instead of `--export`: a question list and raw stored payloads. |
| `--wrapped <file>` | Add Session Wrapped export rows (the `wide` or `gold` view, as JSONL or JSON). |
| `--groups <file>` | JSON mapping each address to its group ids. Without it, the `src` link a person arrived through is used. |
| `--exclude <file>` | Addresses to leave out (for example test accounts), one per line. |
| `--bootstrap`, `--seed`, `--min-participants` | Interval samples, random seed, smallest reported cell. |
| `--include-agents` | Keep self-declared agent participants. |

## What participants see

When a session turns on `interviewMode.showFidelityScore`, each person sees
their own result after submitting AI-prefill drafts: matches on choice
questions, the Mirror Score, hidden-draft guesses and the most confident
misses. It's computed in their browser and never stored; see
[session-interview-research.md](session-interview-research.md#score-screen).

The same setting adds **How well AIs predicted people** to the session's
Results report, below its summary statistics. It scores the responses the
report shows, after its filters, with `scoreFidelityOverview`: the overall and
hidden-draft Mirror Scores, the share of shown choice drafts people changed,
a chart of stated confidence against the share kept, and the Mirror Score by
platform. These are the same numbers as this report's, except that only
AI-prefill drafts count (voice and typed-context drafts restate what the
person said) and the browser draws 200 bootstrap samples instead of 1,000.
Every cell follows the withholding rules above, and until 5 people have shared
draft comparisons the report shows a one-line note instead.

## Fix the plan before looking

Write down the primary measure, exclusions and minimum cell size before
reading results. The primary measure is the Mirror Score on hidden drafts. If
there are none, use the shown-draft score together with its anchoring caveat.
Treat other cuts as exploratory.

## Limitations

- Platform and model are self-reported.
- Prompts before `ce-interview-brief-v6` and Session Wrapped's rubric grade
  confidence as strength of support, so they add nothing to calibration until
  Wrapped asks for the chance of keeping the answer too.
- People who use AI prefill are not a random sample.
- Wrapped principals have pseudonymous ids that don't match session
  addresses. When both sources are mixed, a principal's own answer can be
  included in the baseline for their questions.
