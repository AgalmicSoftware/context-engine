export const SESSION_CONTEXT_TEXT_LIMITS: Readonly<{ itemChars: number; totalChars: number }>;

/** A context source's text, from the items the person the AI acts for may read. */
export type SessionContextPromptSource = {
  title?: string;
  kind?: 'link' | 'file';
  url?: string;
  text?: string;
  /** Text the session's AI read from a PDF. */
  readByAi?: boolean;
};

/** The session's notes, links and sources as one delimited block of untrusted data. */
export function buildSessionContextPrompt(input?: {
  sessionContext?: unknown;
  sources?: SessionContextPromptSource[];
  itemChars?: number;
  totalChars?: number;
}): { text: string; included: number; omitted: number };
