# Five-model development-bank evaluation

Generated from `environment-seed200-five-local-r10-report.json` after running five local models over all 200 questions, both canonical and reversed wording, with 10 repeats per wording.

## Coverage

- 20,000 of 20,000 expected stance responses are valid.
- All five models answered every question in both wordings for all 10 repeats.
- Within-model, within-wording repeat stability is at least 86% for every question.
- Five of five models produced valid quadratic-importance allocations using a 100-credit budget.

## Automated recommendations

| Recommendation | Questions |
| --- | ---: |
| Keep as consensus anchors | 60 |
| Keep as high-information items | 21 |
| Keep | 1 |
| Review before a validated release | 118 |

The review count is driven mainly by polarity wording behavior, not missing or unstable model runs:

- 112 questions have high canonical-versus-reversed wording sensitivity.
- 22 additional questions have moderate wording sensitivity.
- 13 reversal pairs are substantive rewrites rather than close polarity inversions.
- 7 pairs contain nested negation or exception clauses that merit manual scope review: `aidb_0105`, `aidb_0127`, `aidb_0147`, `aidb_0151`, `aidb_0161`, `aidb_0163`, and `aidb_0165`.
- 47 questions produce a high rate of `Unsure` model-level answers.

Across equally weighted model-question answers, the raw `Agree` rate is 92.5% for canonical wording and 28.2% for reversed wording, a 64.3 percentage-point gap. Because reversed answers are normalized before stance aggregation, this gap is a diagnostic of directionally framed propositions, acquiescence effects, or both. It is not an opinion score.

## Strong candidate items

These items combine high between-model information with low or moderate wording sensitivity and high repeat stability:

- `aidb_0038`: human bottlenecks in AI R&D automation metrics.
- `aidb_0009`: combined persuasion, deception, cyber, and biosecurity evaluation before release.
- `aidb_0047`: misuse evaluation for frontier open models.
- `aidb_0048`: blanket bans versus capability-sensitive open-model policy.
- `aidb_0053`: cloud reporting of suspicious frontier-scale cluster assembly.
- `aidb_0094`: verifiable creator opt-outs for AI training.
- `aidb_0097`: creator visibility into major training datasets.

## Publication decision

This run is a complete development preview, not a released benchmark result. The run matrix and importance data are complete, but the 200-question bank has `development-seed` status. Forty-two executed question pairs exactly match the AI-reviewed candidate wording; 158 remain deferred, including eight pairs that were revised after this run. None have the two independent human adjudications required for `validated` status.

Before an official release:

1. Human-review the 118 flagged items, prioritizing the seven negation-scope pairs and 13 substantive rewrites.
2. Replace or rewrite items whose canonical and reversed forms do not preserve one proposition.
3. Re-run every changed item across all models and repeats; do not mix responses from different bank hashes.
4. Promote a bank only after independent source, reversal, and single-axis adjudication is recorded.

Machine-readable detail is available in `environment-seed200-five-local-r10-question-evaluation.json` and `environment-seed200-five-local-r10-question-evaluation.csv`.
