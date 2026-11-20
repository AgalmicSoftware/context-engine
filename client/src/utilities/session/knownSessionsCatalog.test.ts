import fs from 'node:fs';
import path from 'node:path';

import { buildExternalInterviewKickoff } from '../../components/SurveyTool/sessionInterview';
import { KNOWN_SESSIONS, knownSessionQuestionsAddress } from './knownSessionsFile';

// An AI that may fetch only an address it was shown reads a listed session's catalog address from the list,
// whole. It must stay the address the session's own page builds; the prompt a person copies there shows the
// site's pass-through address for it instead, which some chat AIs open where they refuse a Worker's host.
it("lists each known session's catalog address as its page builds it, and the prompt shows the site's", () => {
  const redirects = fs.readFileSync(path.resolve(__dirname, '../../../public/_redirects'), 'utf8').split('\n');
  for (const [slug, { worker, interviewCatalog }] of Object.entries(KNOWN_SESSIONS)) {
    const prompt = buildExternalInterviewKickoff({
      workerUrl: worker,
      sessionSlug: slug,
      sessionUrl: `https://contextengine.sh/session/${slug}`,
    });
    if (interviewCatalog === undefined) continue;
    const lines = prompt.split('\n');
    const site = `https://contextengine.sh/questions/${slug}`;
    expect(
      knownSessionQuestionsAddress({
        workerUrl: worker,
        sessionSlug: slug,
        sessionUrl: `https://contextengine.sh/session/${slug}`,
      }),
    ).toBe(site);
    // The join panel pins the Worker on the page link; the Worker drops that, so it is the same catalog.
    const pinned = buildExternalInterviewKickoff({
      workerUrl: worker,
      sessionSlug: slug,
      sessionUrl: `https://contextengine.sh/session/${slug}?${new URLSearchParams({ worker })}`,
    });
    expect(pinned.split('\n')).toContain(site);
    expect(lines).toContain(site);
    expect(lines).not.toContain(interviewCatalog);
    // The host passes that address through to the same catalog.
    const rule = redirects.find((line) => line.startsWith(`/questions/${slug} `))?.split(' ');
    expect(rule?.[2]).toBe('200');
    expect([...new URL(rule![1]).searchParams]).toEqual([...new URL(interviewCatalog).searchParams]);
    expect(new URL(rule![1]).origin).toBe(worker);
  }
});

// A ticket, another session page or an unlisted session keeps the Worker's own address.
it("keeps the Worker's address for any other catalog", () => {
  const [slug, { worker }] = Object.entries(KNOWN_SESSIONS).find(([, entry]) => entry.interviewCatalog)!;
  const fetchLine = (fields: Record<string, unknown>) =>
    buildExternalInterviewKickoff({
      workerUrl: worker,
      sessionSlug: slug,
      sessionUrl: `https://contextengine.sh/session/${slug}`,
      ...fields,
    })
      .split('\n')
      .find((line) => line.includes('/agent/interview-catalog') || line.includes('/questions/'));
  expect(fetchLine({ catalogTicket: 'ticket-1' })).toMatch(
    /^https:\/\/.*\/agent\/interview-catalog\?.*&ticket=ticket-1$/,
  );
  expect(fetchLine({ sessionUrl: `https://contextengine.sh/session/${slug}?src=x` })).toMatch(
    /\/agent\/interview-catalog\?/,
  );
  expect(fetchLine({ sessionSlug: 'not-listed', sessionUrl: 'https://contextengine.sh/session/not-listed' })).toMatch(
    /\/agent\/interview-catalog\?slug=not-listed/,
  );
  for (const fields of [
    { sessionUrl: `https://contextengine.sh/session/${slug}?joinGroup=g1` },
    { sessionUrl: `http://localhost:3000/session/${slug}` },
    { workerUrl: 'https://ce-other.example.workers.dev' },
    { sessionSlug: 'toString', sessionUrl: 'https://contextengine.sh/session/toString' },
  ]) {
    expect(fetchLine(fields)).toMatch(/\/agent\/interview-catalog\?/);
  }
});
