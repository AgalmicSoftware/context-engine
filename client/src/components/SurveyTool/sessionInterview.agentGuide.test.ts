import fs from 'fs';
import path from 'path';
import { buildExternalInterviewKickoff } from './sessionInterview';

// The agent guide prints the prompt an agent follows from a public session's link alone. It must stay the
// prompt the session page gives a person to copy, or drafts made from the guide stop opening.
const GUIDE_REVIEW_ADDRESS = '<review address>';

it('prints in the agent guide the same prompt the session page gives, with the link parts left to fill in', () => {
  const guide = fs.readFileSync(path.resolve(__dirname, '../../../public/agent-guide.md'), 'utf8');
  const worker = 'https://worker.example.test';
  const page = 'https://app.example.test/session/fixture-slug';
  const prompt = buildExternalInterviewKickoff({ workerUrl: worker, sessionSlug: 'fixture-slug', sessionUrl: page })
    .replace(
      `${worker}/agent/interview-catalog?slug=fixture-slug&sessionUrl=${encodeURIComponent(page)}`,
      '<worker>/agent/interview-catalog?slug=<slug>&sessionUrl=<session page>',
    )
    .replace('sessionSlug "fixture-slug"', 'sessionSlug "<slug>"')
    // The guide is read on the site itself, so its own address stands for the session page's site.
    .replace('https://app.example.test/skill.md', 'https://contextengine.sh/skill.md')
    // The review link opens the session link the agent was given, whatever its query already holds.
    .replace(`${page}?worker=${encodeURIComponent(worker)}&mode=interview`, GUIDE_REVIEW_ADDRESS);
  expect(prompt).not.toMatch(/example\.test|fixture-slug/);
  expect(guide).toContain(`\n\`\`\`text\n${prompt}\n\`\`\`\n`);
});
