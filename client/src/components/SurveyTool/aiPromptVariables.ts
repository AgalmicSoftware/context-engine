// The values the AI prompt a person copies carries for them and their session, each given a stand-in name,
// so the prompt is shown with `<SessionName>` where the name is and never the value itself. A key or a
// private link is then never on screen; the copied prompt keeps every value.

import type { PromptVariable } from '../Shared/aiPromptPieces';

const QUOTED = '"(?:[^"\\\\]|\\\\.)*"';

/** The values found in a copied AI prompt, longest first, so one that contains another is taken whole. */
export const findPromptVariables = (prompt: string): PromptVariable[] => {
  const found: PromptVariable[] = [];
  const add = (name: string, value: string | undefined) => {
    if (value && !found.some((variable) => variable.value === value)) found.push({ name, value });
  };
  // `session "Name" at <link>.` in the full prompt; `session "Name" (<link>)` in the short one.
  const named = new RegExp(`session (${QUOTED}) (?:at (\\S+?)\\.(?= |$)|\\((\\S+?)\\))`, 'm').exec(prompt);
  add('SessionName', named?.[1]);
  add('SessionLink', named?.[2] || named?.[3]);
  // An address on a line of its own is where the questions are read from.
  for (const [address] of prompt.matchAll(/^https?:\/\/\S+$/gm)) {
    if (/\/agent\/interview-catalog\?|\/questions\//.test(address)) add('QuestionsAddress', address);
    // The review link's address, which the packet is pasted at.
    else if (/[?&]mode=interview$/.test(address)) add('ReviewLink', address);
  }
  add('AIKey', /ceagt_[A-Za-z0-9_-]+/.exec(prompt)?.[0]);
  const scope = new RegExp(`slug (${QUOTED}), at (\\S+?), until (\\S+?)\\.(?= |$)`, 'm').exec(prompt);
  add('SessionSlug', scope?.[1]);
  add('WorkerAddress', scope?.[2]);
  add('KeyEnds', scope?.[3]);
  // The catalog's question ids, by position, and its fingerprint.
  add('QuestionIds', /^Question ids: (.+)$/m.exec(prompt)?.[1]);
  add('QuestionSetHash', /questionSetHash ("[0-9a-f]{64}")/.exec(prompt)?.[1]);
  add('UnansweredQuestions', /^Unanswered question IDs, [^:\n]*: (\[.*\])$/m.exec(prompt)?.[1]);
  add('AnsweredQuestions', /^Already answered IDs, [^:\n]*: (\[.*\])$/m.exec(prompt)?.[1]);
  return found.filter(({ value }) => value !== '[]').sort((a, b) => b.value.length - a.value.length);
};
