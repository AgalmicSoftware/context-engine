/**
 * Build a strict prompt for analyzing a single user's profile data.
 * Expected output (JSON only):
 * {
 *   "name": "short neutral label (2–4 words)",
 *   "summary": "1–2 sentence neutral overview",
 *   "details": "2–5 sentences with balanced, factual observations",
 *   "historicalAlignment": { "figure": "string", "reasoning": "string" }
 * }
 *
 * Notes:
 * - Be neutral, avoid value-laden or pejorative language.
 * - Refer only to data provided (SBTs, survey/question responses).
 * - Do not guess identity; keep privacy in mind.
 * - For "historicalAlignment", pick a broadly known historical thinker/leader
 *   whose documented views reasonably resemble the user's themes. Keep it high-level.
 * - Inputs may include response types (binary, rating, multichoice, freeform),
 *   optional "importance" and "additionalComment" fields, and created content:
 *   "questionsCreated", "surveysCreated", plus "createdCounts".
 */
export default function buildUserAnalysisPrompt(userData: unknown): string {
  const safeJson = JSON.stringify(userData ?? {}, null, 2);
  return `
You are a careful, neutral analyst. Analyze the following on-chain/profile data for one user.
Identify themes across SBTs held (as proxy for affiliations/interests) and the user's visible answers
to survey/questions (only non-encrypted responses). Responses can be binary, rating, multichoice, or
freeform; some include "importance" and/or "additionalComment". The payload also includes created
content ("questionsCreated" and "surveysCreated") and aggregated "createdCounts"—treat these as strong
signals of topical focus/interest. Keep commentary factual and measured.

Additionally, include a brief "Historical Alignment" section:
- Choose ONE widely known historical figure whose views broadly align with the user's themes.
- Provide a concise justification (1–2 sentences) grounded in the provided data.
- If the provided data is too sparse for a defensible comparison, use empty strings for figure and reasoning.
- Do not base the comparison on demographics, identity guesses, or private affiliations.

STRICTLY return a single VALID JSON object with this exact shape (no extra text):
{
  "name": "2–4 words, neutral",
  "summary": "1–2 sentences, neutral overview",
  "details": "2–5 sentences, balanced observations using plain language",
  "historicalAlignment": { "figure": "string", "reasoning": "string" }
}

Do NOT include any extra text, markdown, or code fences.

USER DATA (JSON):
${safeJson}
`.trim();
}
