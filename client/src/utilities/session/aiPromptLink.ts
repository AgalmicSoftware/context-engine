import { AGENT_PROMPT_LINK_QUERY } from '../../../../shared/agentPromptLink.mjs';

// A session link with this in its query opens the account dialog on the person's AI prompt (the agent guide's
// steps give an AI the link to hand a person who already has an account). An AI may add it after a second
// `?` or after the `#`, so it is read from wherever it ends up in the address.
const AI_PROMPT_IN_ADDRESS = new RegExp(`[?&#]${AGENT_PROMPT_LINK_QUERY}(?=$|[&#?])`);
const AI_PROMPT_REMOVAL = new RegExp(`([?&#])${AGENT_PROMPT_LINK_QUERY}(?=$|[&#?])`);
export const requestsAiPrompt = (address: unknown): boolean => AI_PROMPT_IN_ADDRESS.test(String(address ?? ''));

/** The address without the request, so a reload, or the prompt's own return link, doesn't carry it. */
export const withoutAiPromptRequest = (address: string): string =>
  address
    .replace(AI_PROMPT_REMOVAL, '$1')
    // Whatever separators the request leaves side by side or at an end go with it.
    .replace(/([?#])[&?]+/g, '$1')
    .replace(/&&+/g, '&')
    .replace(/[?&]+(?=#|$)/, '')
    .replace(/#$/, '');

// Asked for once: the page takes the request out of its address as it opens the account dialog, and the dialog
// takes it from here as it mounts. A later opening of the dialog in the same tab is an ordinary one, and makes
// no key unasked.
let pending = false;
export const noteAiPromptRequest = (): void => {
  pending = true;
};
export const takeAiPromptRequest = (): boolean => {
  const asked = pending;
  pending = false;
  return asked;
};
