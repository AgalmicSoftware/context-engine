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
  confidence) when the participant leaves **Share for research** on; see
  [session-interview-research.md](session-interview-research.md).
  The scored answer is the ordinary submitted `answer`.
- **Session Wrapped.** The Session Worker's agent-only export (admin route
  `/api/agent/admin/agent-only/export`, `wide` or `gold` view) pairs
  `agent_prediction` and `agent_confidence` with the person's own
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
model with platform `other` means a voice interview). Drafts made after
someone claimed their part of a group recording say `group_recording`;
before 0.9.5 they were recorded as `voice_interview`. At minimal research
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
- **Where drafts came from:** the headline scores only predictions made before
  the person spoke: AI prefill, and Session Wrapped when given. Voice
  interview, typed-context and group-recording drafts restate what the person
  said, so each gets its own row instead (`report.origins`, from
  `scoreDraftOrigins`): its Mirror Score, its hidden-draft score, and the
  share of shown drafts each person submitted with a different answer or
  comment (`changedFields`, freeform answers included, so minimal records
  count too). These rows measure how faithfully the interview and the mapping
  captured what people said, not how well an AI knows them.
- **By model and by context used:** the model is the one the draft's first
  revision names, else the self-reported source's. Context used adds up the
  past chats, memories and connected sources the person's AI said it drew on
  (`source.researchCoverage`): none, 1–9, 10–49 or 50 or more. A count the AI
  left out (`null`) adds nothing, and a draft with no counts at all, or no
  coverage, is "not reported". Both are AI-prefill breakdowns, withheld like
  platforms.
- **Cohen's kappa:** exact agreement on choice predictions beyond what chance
  would give. Chance comes from each question's answer shares among the
  predictions and among the answers, and questions are pooled by their number
  of predictions. 1 is perfect agreement and 0 no better than predicting from
  those shares; the interval resamples people.
- **Rating error:** the mean absolute difference between a predicted and a
  given rating, as a share of the question's scale (7 against 9 on 0–10 is
  0.2), per person and then across people.
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
  predictions. A prediction no one else's answer can check has no baseline, so
  the AI's score shown beside a baseline leaves it out too.
- **Unusual views:** each person's typicality is the mean similarity of their
  answers to every other person's answers on the same questions. The report
  splits people into thirds by typicality and gives the AI's score, the
  baseline's and the lift for each, plus rank correlations with intervals.
  Equally typical people stay together, whatever order their records came in, so
  groups can be uneven: two camps leave the middle empty, and when everyone ties
  there are no groups to compare. An
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
- Any result based on fewer people than the minimum is withheld, including
  calibration and each of its confidence bands, anchoring and each third of
  the unusual-views table. The minimum is 5 by default.
  - In Results it is the session's **Smallest group shown in “How well AIs
    predicted people”** (`interviewMode.fidelityMinimumPeople`), under
    Interview settings. **Off** shows every figure, even one person's, so use
    it only where everyone knows small groups' figures are visible.
  - The Results export doesn't carry session settings, so the command-line
    report (`--min-participants`) and the benchmark's `compare-answers`
    (`--min-people`) take their own; match the session's setting when
    running them.
  - Per-person rows, listed by pseudonym (`p001`…) and never by address, appear
    only when the whole report reaches the minimum.
- Breakdowns that divide people (by platform, model, context used, where the
  draft came from, and group) also withhold a row when subtracting it from the total, or
  from the other rows, would reveal a result for fewer people than the
  minimum: with six people, five on Claude and one on ChatGPT, a minimum of 5
  shows neither platform. The smallest row goes first. The benchmark's
  `compare-answers` applies the same rule to its groups.
  - Withheld groups are not named at all, since a group can be a single
    invite link.
- The overall calibration figure counts every confidence band, including bands
  withheld for having fewer people than the minimum. When every other band is
  shown, a withheld band's keep rate can sometimes be worked out from it. That
  reveals how often those few people kept their AI's drafts, never what they
  answered.
- Each person is the responder the Worker or the chain recorded for the
  response; a payload's own claim counts only for raw payloads, so one account
  can't pose as several people. The self-reported platform counts as ChatGPT,
  Claude or other, as the app records it.
- Self-declared agents (`participant.kind: "agent"`) are left out unless asked
  for.
- For each person and question only the latest record counts. If someone later
  withdraws research consent or encrypts the answer, their earlier draft
  comparison is not used. Latest means recorded last by the Worker
  (`createdAt`) or on the chain (block, transaction and log index), or else
  last in the input. A payload's own `timeStamp` comes from the participant's
  browser, so it never decides.
- Importance and conviction are read with the app's stored-rating rule
  (`shared/questions/storedRating.mjs`): legacy 0–100 values are rescaled, and
  a missing importance falls back on conviction.
- Ratings and allocations, both answers and drafts, are checked with the app's
  answer rules (`shared/questions/answerValue.mjs`): a rating off its scale's
  steps or an allocation over the credit budget counts as unreadable.

## Running it

Download **JSON: Questions + Responses** from the session's Results screen
(either view), then:

```bash
node scripts/agent-fidelity-report.mjs --export results.json --out reports/
```

This writes `agent-fidelity-report.json` and `agent-fidelity-report.md`.

| Option | Use |
| --- | --- |
| `--questions <file> --responses <file>` | Instead of `--export`: a question list and response rows (below). |
| `--wrapped <file>` | Add Session Wrapped export rows (the `wide` or `gold` view, as JSONL or JSON). |
| `--groups <file>` | JSON mapping each address to its group ids. Without it, the `src` link a person arrived through is used. |
| `--exclude <file>` | Addresses to leave out (for example test accounts), one per line. |
| `--bootstrap`, `--seed`, `--min-participants` | Interval samples, random seed, smallest reported cell. |
| `--include-agents` | Keep self-declared agent participants. |
| `--predictions <file.csv>` | Also write one row per scored prediction, for analysis elsewhere (below). |

`--responses` takes a JSON array of rows as the Worker stores them:
`{ "responder": "0x…", "createdAt": "2026-10-02T09:00:00Z", "response": … }`,
where `response` is the stored payload (one answer entry, or
`{ "responses": [ … ] }`), as an object or a JSON string. Rows read from the
chain give `blockNumber`, `transactionIndex` and `logIndex` instead of
`createdAt`. Bare payloads without a row are read too: their own `responder`
then names the person, and for each question the later one in the file counts.

`--predictions` writes every scored prediction of every origin as a CSV row:
the person's pseudonym (the same one as in the report's per-person rows, in an
order drawn afresh each run), origin, platform, model, context used, group
(only groups the report names), condition, question, prediction, answer,
similarity, exact match and confidence. It has no addresses, names or free
text: freeform questions are left out, and choice answers keep only the
question's own options. Excluded people and agents are left out, but no
minimum applies, so it is de-identified rather than anonymous: keep it with
the raw export.

## What participants see

When a session turns on `interviewMode.showFidelityScore`, each person sees
their own result after submitting AI-prefill drafts: matches on choice
questions, the Mirror Score, hidden-draft guesses and the most confident
misses. It's computed in their browser and never stored; see
[session-interview-research.md](session-interview-research.md#score-screen).
By default this private score is the only fidelity result a session shows:
the measure is each person's own.

A separate setting, **Show “How well AIs predicted people” in Results**
(`interviewMode.showFidelityResults`, off by default), adds a section with
that name to the session's Results report, below its summary statistics. It
scores the responses the report shows, after its filters, with
`scoreFidelityOverview`: the overall and hidden-draft Mirror Scores, the share
of shown choice drafts people changed, a chart of stated confidence against
the share kept, and the Mirror Score by platform. It scores in a background
thread, so large sessions don't freeze the page, and gives the same numbers as
this report's, except that only AI-prefill drafts count (voice and
typed-context drafts restate what the person said). Every cell follows the
withholding rules above with the session's minimum, and until the report's
responses include AI-prefill drafts from that many people it shows a one-line
note instead. To set a session up for this, see
[session-creation-guide.md](session-creation-guide.md#measure-how-well-ai-represents-participants).

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
