export const rankQuestionsPrompt = `
You are ranking question candidates for relevance.

Inputs:
1) User query: "{{userQuery}}"
2) Candidate questions (IDs and prompts only):
{{questionListStr}}

Rules:
- Select at most {{topX}} IDs.
- IDs must come only from the provided candidate list.
- Sort IDs in descending relevance order (best match first).
- Do not invent IDs.

Return EXACTLY one JSON object in this shape:
{
  "selectedQuestionIDs": ["id1", "id2"]
}

Do not return markdown, explanations, or any extra keys.
`;

