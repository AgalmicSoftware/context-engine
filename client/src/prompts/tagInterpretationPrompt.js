/**
 * Build the Tag Explorer interpretation prompt for a selected tag comparison.
 */
export default function buildTagInterpretationPrompt({
  selectedTags = [],
  questions = [],
  maxQuestions = 20,
} = {}) {
  const tags = (Array.isArray(selectedTags) ? selectedTags : [])
    .map((tag) => String(tag || '').trim())
    .filter(Boolean);
  const visibleQuestions = (Array.isArray(questions) ? questions : []).slice(0, maxQuestions);

  return [
    `Analyze these questions tagged with ${tags.join(', ')}. For each, the prompt and response count are given. Provide: 1) Key themes, 2) Areas of consensus, 3) Points of disagreement, 4) Suggested follow-up questions. Be concise.`,
    '',
    ...visibleQuestions.map((question) => {
      const prompt = String(question?.prompt || 'Untitled question').trim() || 'Untitled question';
      const responseCount = Number(question?.responseCount || 0);
      return `Q: ${prompt} (${responseCount} ${responseCount === 1 ? 'response' : 'responses'})`;
    }),
  ].join('\n');
}
