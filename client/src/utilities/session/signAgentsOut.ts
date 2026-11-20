// "Sign Agents Out", for a person signed in to their own account.
//
// A prompt or key copied from "Your AI agent" works only while the sign-in it was copied from stands: the
// Worker checks that sign-in on every call an agent makes with it. So ending this tab's sign-in at the Worker
// ends every prompt and key copied from it, at once. The person stays signed in on the page: it signs in to the
// session again when it next needs to, and a prompt copied after that carries a new key.
//
// It reaches only what was copied from this tab's sign-in. A prompt copied in another tab or on another device
// came from that one's sign-in, and lasts until that sign-in is signed out or runs out.
import { normalizeSessionSlug } from './sessionNaming.js';
import { forgetHeldToken, listHeldTokens } from '../worker/workerAuthTokenCache';

const NOT_REACHED = 'The session could not be reached, so your agents are still signed in. Try again.';

export const signAgentsOut = async (sessionSlug: unknown): Promise<void> => {
  const slug = normalizeSessionSlug(sessionSlug);
  if (!slug) throw new Error('Open a session first.');
  // With no sign-in held here, nothing copied from this tab is still alive.
  for (const { workerUrl, token } of listHeldTokens().filter((held) => held.sessionSlug === slug)) {
    let response: Response;
    try {
      response = await fetch(`${workerUrl}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'X-Group-Slug': slug },
      });
    } catch {
      throw new Error(NOT_REACHED);
    }
    // 401: that sign-in had already ended, and what was copied from it with it.
    if (!response.ok && response.status !== 401) throw new Error(NOT_REACHED);
    // Forgotten here too, so the page signs in afresh and does not go on using the ended sign-in.
    forgetHeldToken(token);
  }
};
