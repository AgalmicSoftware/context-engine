// A quick first read of a person's answers: one short request to the session's fast model, made beside the
// analysis and shown until the analysis arrives.
import buildUserFirstReadPrompt, { USER_FIRST_READ_RESPONSE_FORMAT } from '../../prompts/userFirstReadPrompt';

import { callAI } from './aiClient.js';
import { asParsedJsonRecord, parseJsonFlexible } from './aiClientParsing.js';
import { createQueuedAiCallRunner } from './aiClientQueue';
import { withAiTaskTypeFallback } from './aiClientRequestOptions.js';

export type UserFirstRead = { headline: string; points: string[] };

export const USER_FIRST_READ_MAX_POINTS = 3;
// Longer than the prompt asks for, so only a reply that ignored it is cut.
const HEADLINE_MAX_CHARS = 200;
const POINT_MAX_CHARS = 140;
// The reply is under a hundred tokens; the rest is room for a model that thinks first.
const FIRST_READ_MAX_TOKENS = 800;

// One line of plain text, or nothing: a model that ignored the reply's shape must not put an object on screen.
const oneLine = (value: unknown, maxChars: number): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxChars) : '';

/**
 * Throws when the request fails or the reply has no headline; the caller then simply shows no first read.
 * Each call has its own lane: the shared AI queue runs one request at a time, and the first read must wait
 * neither for the analysis nor for an earlier first read that never came back.
 */
export async function analyzeUserFirstRead(userData: unknown, opts: unknown = {}): Promise<UserFirstRead> {
  const aiCallOpts = {
    ...withAiTaskTypeFallback(opts, 'summarize'),
    max_tokens: FIRST_READ_MAX_TOKENS,
    response_format: USER_FIRST_READ_RESPONSE_FORMAT,
  };
  const raw = await createQueuedAiCallRunner()(() => callAI(buildUserFirstReadPrompt(userData), aiCallOpts));
  const parsed = asParsedJsonRecord(parseJsonFlexible(raw)) || {};
  const headline = oneLine(parsed.headline, HEADLINE_MAX_CHARS);
  if (!headline) throw new Error('The AI reply had no first read.');
  const points = (Array.isArray(parsed.points) ? parsed.points : [])
    .map((point: unknown) => oneLine(point, POINT_MAX_CHARS))
    .filter(Boolean)
    .slice(0, USER_FIRST_READ_MAX_POINTS);
  return { headline, points };
}
