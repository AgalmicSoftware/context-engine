// Runs Agent HTTP's tests (the Session Agent's run with the Session Worker's).
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
function runAgentHttpTests(rootDir = path.resolve(__dirname, '..')) {
  const dir = path.join(rootDir, 'workers/sessionCorsWorker');
  const files = fs.readdirSync(dir).filter(name => /^agent.*\.test\.mjs$/.test(name))
    .map(name => path.join(dir, name));
  files.push(...fs.readdirSync(path.join(dir, 'agent')).filter(name => name.endsWith('.test.mjs'))
    .map(name => path.join(dir, 'agent', name)));
  if (!files.length) throw new Error('Agent HTTP behavioral tests are missing.');
  const result = spawnSync(process.execPath, ['--test', ...files], { cwd: rootDir, stdio: 'inherit' });
  if (result.error) throw result.error;
  return typeof result.status === 'number' ? result.status : 1;
}
if (require.main === module) process.exit(runAgentHttpTests());
module.exports = { runAgentHttpTests };
