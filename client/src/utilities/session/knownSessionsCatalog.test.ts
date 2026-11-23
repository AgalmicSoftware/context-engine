import fs from 'node:fs';
import path from 'node:path';

import { buildExternalInterviewKickoff } from '../../components/SurveyTool/sessionInterview';
import { KNOWN_SESSIONS, knownSessionQuestionsAddresses } from './knownSessionsFile';

// An AI that may fetch only an address it was shown reads a listed session's catalog address from the list,
// whole. It must stay the address the session's own page builds; the prompt a person copies there shows the
// site's pass-through address for it instead, which some chat AIs open where they refuse a Worker's host.
it("lists each known session's catalog address as its page builds it, and the prompt shows the site's", () => {
  const redirects = fs.readFileSync(path.resolve(__dirname, '../../../public/_redirects'), 'utf8').split('\n');
  const llms = fs.readFileSync(path.resolve(__dirname, '../../../public/llms.txt'), 'utf8');
  for (const [slug, { worker, interviewCatalog }] of Object.entries(KNOWN_SESSIONS)) {
    const prompt = buildExternalInterviewKickoff({
      workerUrl: worker,
      sessionSlug: slug,
      sessionUrl: `https://contextengine.sh/session/${slug}`,
    });
    if (interviewCatalog === undefined) continue;
    const lines = prompt.split('\n');
    const site = `https://contextengine.sh/questions/${slug}`;
    // The two addresses come in the generator's order, as llms.txt shows them for this session.
    const listedOrder = llms
      .match(new RegExp(`/session/${slug} \\([^\\n]*\\): (\\S+)\\n\\s+second address: (\\S+)\\n`))!
      .slice(1, 3);
    expect([...listedOrder].sort()).toEqual([site, interviewCatalog].sort());
    const page = `https://contextengine.sh/session/${slug}`;
    expect(knownSessionQuestionsAddresses({ workerUrl: worker, sessionSlug: slug, sessionUrl: page })).toEqual(
      listedOrder,
    );
    const at = lines.indexOf(listedOrder[0]);
    expect(lines.slice(at, at + 3)).toEqual([
      listedOrder[0],
      'Second address, if the first does not give you that:',
      listedOrder[1],
    ]);
    // What follows the two addresses says what to do when neither gives the catalog whole.
    expect(lines[at + 3]).toMatch(
      /^From a summary or part of the list, ask your tool again for only the questionSetHash and each question's id and type, in order\. /,
    );
    // The join panel pins the Worker on the page link; the Worker drops that, so it is the same catalog.
    const pinned = buildExternalInterviewKickoff({
      workerUrl: worker,
      sessionSlug: slug,
      sessionUrl: `${page}?${new URLSearchParams({ worker })}`,
    });
    const pinnedLines = pinned.split('\n');
    const pinnedAt = pinnedLines.indexOf(listedOrder[0]);
    expect(pinnedLines.slice(pinnedAt, pinnedAt + 3)).toEqual([
      listedOrder[0],
      'Second address, if the first does not give you that:',
      listedOrder[1],
    ]);
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
