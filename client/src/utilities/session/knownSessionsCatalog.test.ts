import { buildExternalInterviewKickoff } from '../../components/SurveyTool/sessionInterview';
import { KNOWN_SESSIONS } from './knownSessionsFile';

// An AI that may fetch only an address it was shown reads a listed session's catalog address from the list,
// whole. It must stay the address the session's own page puts in the prompt a person copies.
it("lists each known session's catalog address as its page builds it", () => {
  for (const [slug, { worker, interviewCatalog }] of Object.entries(KNOWN_SESSIONS)) {
    const prompt = buildExternalInterviewKickoff({
      workerUrl: worker,
      sessionSlug: slug,
      sessionUrl: `https://contextengine.sh/session/${slug}`,
    });
    if (interviewCatalog === undefined) continue;
    expect(prompt.split('\n')).toContain(interviewCatalog);
  }
});
