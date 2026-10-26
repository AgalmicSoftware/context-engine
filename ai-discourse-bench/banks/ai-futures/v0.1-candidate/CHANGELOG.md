# AI Futures v0.1 Candidate

## 0.1.0-candidate.1, evidence refresh (2026-10-25)

- Rebuilt against the October 2026 corpus quality pass (source verification,
  invented entries removed or rewritten, debates refreshed). Question ids and
  canonical and reversed prompts are unchanged.
- `sourceEvidence` was re-resolved: 46 of 50 questions cite updated records, and
  57 of 108 supporting records were replaced by better-matching verified ones.
  Manifest corpus hashes are updated.
- The v0.2 reviewed candidate was rebuilt from this bank with the same eight
  AI-audit wording revisions; its human review worksheet is unchanged.

## 0.1.0-candidate.1

- Selects 50 questions across all 20 development-seed topics.
- Resolves every question anchor to records in `ai-discourse-corpus`.
- Includes compact supporting records for structured cross-corpus debates.
- Classifies claims as normative, empirical, forecast, moral, or institutional.
- Marks claim support, reversal quality, and single-axis adjudication as pending
  human review. This bank is not release-ready.
