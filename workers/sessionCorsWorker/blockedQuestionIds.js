// The session's hidden questions, which the browser and MCP leave out too: lower case, unique and sorted.
export const blockedQuestionIds = (config) => [...new Set(
  (Array.isArray(config?.BLOCKED_QUESTION_IDS) ? config.BLOCKED_QUESTION_IDS : [])
    .map((id) => String(id ?? '').trim().toLowerCase())
    .filter(Boolean),
)].sort();
