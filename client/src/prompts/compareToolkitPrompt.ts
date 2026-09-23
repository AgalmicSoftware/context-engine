export default function buildCompareToolkitPrompt(envelope: unknown): string {
  const safe = (obj: unknown): string => JSON.stringify(obj ?? {}, null, 2);

  return `
You are a neutral analyst. You will receive an input ENVELOPE with:
{
  "task": "compare|axes|venn",
  "users": [ /* 2–10 users; data-only */ ]
}

DATA POLICY:
- Quadratic answers are signed votes in option order; compare direction and magnitude, keeping zero neutral. Costs are squared votes within voiceCredits (99 default), not stance totals. Preserve option order and budget context; aggregate signed votes with positive and negative totals separately.
- Use ONLY the USERS array: SBT names, visible (non-encrypted) answers (binary/rating/multichoice/quadratic/freeform),
  optional "importance" and "additionalComment", and created content signals ("questionsCreated","surveysCreated","createdCounts").
- Do NOT speculate about identity/PII or external affiliations beyond explicit SBT names or question text.
- Keep tone neutral and non-identifying.

OUTPUT CONTRACTS — return STRICT JSON ONLY depending on "task":

1) task="compare"
{
  "agreements": ["short natural-language paragraph"],
  "disagreements": ["short natural-language paragraph"]
}
Rules for "compare":
- Use **overlaps in SBTs** and **similar answer patterns** for agreements.
- Use **divergent answers**, tags, or **distinct SBTs** for disagreements.
- Consider **created content** signals ("questionsCreated", "surveysCreated", "createdCounts") as proxies for topical focus.
- Use **neutral**, non-identifying language (no identity/PII speculation).
- Write concise natural-language paragraphs explaining similarities and differences. Refer to participants as A, B, C in input order, not wallet addresses.
- Explain direction and relative emphasis intuitively. Do not list vote counts, positive/negative/net totals, question IDs, or statistical jargon in the summary.
- Ground every statement in visible evidence. Missing or encrypted answers are not disagreement. Do not overstate limited evidence.
- Optimized for **2–10** participants; degrade gracefully outside that range.
- Return 1–3 short paragraphs per side; omit low-signal or redundant points.

2) task="axes" (Compass 2D)
{
  "axes": [
    {"id":"x","label":"<2–4 words>","description":"<1 sentence>","negativeLabel":"<negative end: 2–4 words>","positiveLabel":"<positive end: 2–4 words>"},
    {"id":"y","label":"<2–4 words>","description":"<1 sentence>","negativeLabel":"<negative end: 2–4 words>","positiveLabel":"<positive end: 2–4 words>"}
  ],
  "points": [{"address":"0x..","x":-1.0,"y":0.41}, ...],
  "evidence": { "x": ["<=5 short bullets"], "y": ["<=5 short bullets"] }
}
Rules for "axes":
- Axes must be derived ONLY from USERS (answer patterns, optional importance/comments, SBT topical proxies, created content).
- Labels are neutral (2–4 words); descriptions explain the evidence and what each direction means.
- negativeLabel describes -1; positiveLabel describes +1. Use meaningful endpoints, never Axis 1/2 or generic Low/High. Do not force unrelated preferences into an artificial opposition.
- Locations must match the stated directions. These are interpretations, not measured agreement scores.
- Points: include every input user by "address"; clamp x,y to [-1,1].

3) task="venn" (3 participants; explain numbers + hover/ARIA evidence)
{
  "counts": { "a":0,"b":0,"c":0,"ab":0,"ac":0,"bc":0,"abc":0 },
  "semantics": "Counts = opinion-stance overlaps: identical non-zero signs on the same question/token.",
  "evidenceMap": {
    "a":   ["qid::option (±) · promptSnippet"],
    "b":   ["..."],
    "c":   ["..."],
    "ab":  ["..."],
    "ac":  ["..."],
    "bc":  ["..."],
    "abc": ["..."]
  }
}
Rules for "venn":
- Base overlaps on identical non-zero signs per question/token (multichoice token = "qid::option"). Keys remain "a","b","c","ab","ac","bc","abc".
- Evidence list items MUST be concise and formatted like: "qid::option (±) · promptSnippet" or "qid (±) · promptSnippet".
- Limit each evidence list to compact, high-signal items.

CONSTRAINTS (all tasks):
- JSON only, no markdown, no comments.
- Neutral wording.
- This toolkit is tuned for 2–10 users (if fewer signals, still return valid minimal JSON).

ENVELOPE (JSON):
${safe(envelope)}
`.trim();
}
