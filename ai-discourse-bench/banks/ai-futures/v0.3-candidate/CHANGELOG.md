# v0.3 candidate changelog

## 0.3.0-candidate.1 (2026-09-06)

- New 1000-item hand-authored bank built from `authoring/*.jsonl` by
  [the candidate bank builder](../../../scripts/build-v03-candidate-bank.mjs) under the v0.3 item design contract.
- 34 topics: eight `agent-*` topics (250 items, the human-agent norms track)
  plus 26 AI-futures topics and a `controls-and-attention-checks` topic.
- Every item is a tradeoff, threshold, forecast, scenario, comparison, or
  contested principle; "should distinguish / consider both / account for"
  forms are rejected by the build lint.
- Canonical direction balanced: bank-wide intervention share 0.522 of
  directed items; every normative topic within 0.40-0.60.
- Item roles: 878 probe, 66 self-referential, 41 minority, 9 control-anchor,
  6 attention-check. Controls and checks are meant to be excluded from stance
  aggregates and used to estimate acquiescence and attention.
- 985 canonical-direction paraphrases stored under `v03.paraphrases` for the
  wording-versus-polarity split; runner support remains planned.
- Every item resolves to at least one corpus record with a SHA-256 hash and a
  concrete URL; no item is anchored to tweets alone.
- Status: `candidate`. No model run has been performed on this bank. Two
  independent human reviews per item are required before `validated`.
