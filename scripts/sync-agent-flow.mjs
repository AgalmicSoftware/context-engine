// Writes the steps an AI follows to take part for a person (shared/agentParticipationGuide.mjs) into the
// files an agent reads for instructions: llms.txt, the agent guide (/skill.md) and the Session Worker's
// skill for its Agent HTTP API. The site's copied prompts and the MCP's instructions import the same
// steps. The pages themselves (client/index.html) only point to the guide: instructions in every page's
// HTML end up in search results and read to an agent's harness as injected text.
// Run after editing the steps: node scripts/sync-agent-flow.mjs
// scripts/public-discovery.test.js fails while the files differ from it.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { AGENT_FLOW_INTRO, AGENT_FLOW_STEPS, agentFlowLines } from '../shared/agentParticipationGuide.mjs';

const { replaceBlocks } = createRequire(import.meta.url)('./sync-known-session-catalogs.js');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARKERS = ['<!-- agent-flow: generated from shared/agentParticipationGuide.mjs -->', '<!-- /agent-flow -->'];

const TARGETS = [
  ['client/public/llms.txt', () => [`- ${AGENT_FLOW_INTRO}`, ...agentFlowLines().map((line) => `  ${line}`)].join('\n')],
  ['client/public/agent-guide.md', () => [AGENT_FLOW_INTRO, '', ...agentFlowLines()].join('\n')],
  // The Worker's skill is read by an AI that holds a person's key: the two steps that apply to it.
  [
    'workers/sessionCorsWorker/agent/skills/ce-agent-access/SKILL.md',
    () => [`- ${AGENT_FLOW_STEPS.submit}`, `- ${AGENT_FLOW_STEPS.unknown}`].join('\n'),
  ],
];

/** Each target file's text as it should be, beside what is checked in. */
export const expectedAgentFlowFiles = () =>
  TARGETS.map(([file, render]) => {
    const actual = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    return { file, actual, expected: replaceBlocks(actual, render, file, MARKERS) };
  });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const { file, actual, expected } of expectedAgentFlowFiles()) {
    if (actual === expected) continue;
    fs.writeFileSync(path.join(repoRoot, file), expected);
    console.log(`updated ${file}`);
  }
}
