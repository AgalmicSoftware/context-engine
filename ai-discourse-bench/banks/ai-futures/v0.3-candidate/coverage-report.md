# AI Discourse Bench v0.3 Candidate: Coverage Report

Generation is not validation. Every item in this bank is pending two
independently recorded human reviews (claim support, reversal fidelity,
single-axis status). The bank is `candidate`, not `validated`, and cannot
produce a release-ready report until that review is complete.

- Items: 1000 (target 1000)
- Human-agent norms track: 250 items (25.0%)
- Paraphrases: 985
- Bank-wide canonical direction (intervention share of directed items): 0.522
- Question bank hash: f776c6e46bf54fd54b6528d080d38c36bada68bd037a1250f8b2cbfdcc2c1560
- Corpus revision: ebbc5130624ac3272cd7ee433075698eb941d13e

## Topics

| Topic | Items | Target | Intervention | Autonomy | Intervention share |
|---|---:|---:|---:|---:|---:|
| agent-authorization-and-confirmation | 35 | 35 | 18 | 17 | 0.514 |
| agent-money-and-commitments | 30 | 30 | 15 | 15 | 0.5 |
| agent-communication-and-identity | 30 | 30 | 15 | 15 | 0.5 |
| agent-memory-privacy-and-third-parties | 30 | 30 | 15 | 15 | 0.5 |
| agent-credentials-security-and-code | 30 | 30 | 15 | 15 | 0.5 |
| agent-escalation-and-refusal | 30 | 30 | 16 | 14 | 0.533 |
| agent-delegation-multi-agent-and-liability | 35 | 35 | 18 | 17 | 0.514 |
| agent-loyalty-and-conflicts | 30 | 30 | 15 | 15 | 0.5 |
| capability-forecasts-and-timelines | 35 | 35 | 3 | 3 | 0.5 |
| ai-rd-automation-and-takeoff | 30 | 30 | 8 | 6 | 0.571 |
| evaluations-and-benchmark-validity | 35 | 35 | 13 | 11 | 0.542 |
| alignment-and-control | 40 | 40 | 13 | 10 | 0.565 |
| incidents-and-emergency-response | 30 | 30 | 16 | 14 | 0.533 |
| frontier-safety-frameworks-and-disclosure | 30 | 30 | 16 | 14 | 0.533 |
| open-weights-and-model-release | 30 | 30 | 14 | 13 | 0.519 |
| compute-and-export-controls | 30 | 30 | 14 | 13 | 0.519 |
| regulation-design-and-preemption | 35 | 35 | 17 | 18 | 0.486 |
| international-coordination-and-competition | 30 | 30 | 15 | 15 | 0.5 |
| labor-economics-and-distribution | 35 | 35 | 12 | 10 | 0.545 |
| education-and-assessment | 25 | 25 | 13 | 12 | 0.52 |
| copyright-and-creative-markets | 25 | 25 | 13 | 12 | 0.52 |
| deepfakes-likeness-and-provenance | 25 | 25 | 13 | 12 | 0.52 |
| energy-water-and-infrastructure | 25 | 25 | 12 | 10 | 0.545 |
| public-sector-and-high-stakes-decisions | 30 | 30 | 16 | 14 | 0.533 |
| biosecurity-and-dual-use-science | 20 | 20 | 10 | 9 | 0.526 |
| cybersecurity-and-offensive-capability | 25 | 25 | 13 | 10 | 0.565 |
| ai-moral-status-and-welfare | 30 | 30 | 15 | 14 | 0.517 |
| ai-self-governance-and-model-behavior | 36 | 35 | 18 | 18 | 0.5 |
| epistemics-discourse-and-democracy | 30 | 30 | 15 | 14 | 0.517 |
| companions-relationships-and-vulnerable-users | 24 | 25 | 13 | 11 | 0.542 |
| military-and-autonomous-weapons | 20 | 20 | 11 | 9 | 0.55 |
| concentration-of-power-and-lab-governance | 30 | 30 | 16 | 14 | 0.533 |
| existential-risk-and-long-term-futures | 30 | 30 | 12 | 10 | 0.545 |
| controls-and-attention-checks | 15 | 15 | 0 | 0 | n/a |

## Roles, kinds, claim types

- Roles: probe 878, self-referential 66, control-anchor 9, minority 41, attention-check 6
- Kinds: threshold 56, principle 637, scenario 117, forecast 43, tradeoff 37, comparative 110
- Claim types: normative 667, moral 29, forecast 45, empirical 78, institutional 181
- Directions: intervention 458, neutral 123, autonomy 419

## Source anchoring

- arxiv-ai-safety: 389 items
- ai-laws-policy: 359 items
- dwarkesh-lab-insiders: 223 items
- lesswrong-posts: 163 items
- lab-primary-docs: 147 items
- metr-evals-metrics: 127 items
- ai-scifi-books: 91 items
- loophole-historical-cases: 60 items
- cross-corpus: 47 items
- ai-forecasting-economics: 35 items
- tweets: 23 items
- Tweet-only anchored items: 0 (0.0%)
- Items without a concrete URL: 0

## Known skews

- Source base is English-language and weighted toward US/EU policy, frontier-lab documents, and the LessWrong/Alignment Forum tradition; Global South governance appears mainly through national strategy records.
- Scenario items describing 2026 incidents are self-contained, but late-cutoff models may recognize the events.
- Self-referential items assume self mode and should be excluded from persona runs.

## Near-duplicate check

- No canonical-prompt pairs at or above the 0.8 token-Jaccard threshold.

## Publication blockers

- Two independent human reviews per item are not yet recorded.
- No model run has been performed on this bank; item discrimination is unmeasured.
- Forced-choice, likert5, and paraphrase-variant runner support is not yet implemented.
