import fs from 'fs';
import path from 'path';
import { buildExternalInterviewKickoff } from './sessionInterview';

// The agent guide prints the prompt an agent follows from a public session's link alone. It must stay the
// prompt the session page gives a person to copy, or drafts made from the guide stop opening.
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
    .replace(`starts with exactly ${JSON.stringify(page)}`, 'starts with exactly "<session page>"');
  expect(prompt).not.toMatch(/example\.test|fixture-slug/);
  expect(guide).toContain(`\n\`\`\`text\n${prompt}\n\`\`\`\n`);
});
