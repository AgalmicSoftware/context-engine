'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function runAgentBridgeWorkerTests(rootDir = path.resolve(__dirname, '..')) {
  if (!fs.existsSync(path.join(rootDir, 'workers', 'agentBridgeWorker', 'package.json'))) {
    console.log('Skipping agent bridge worker tests: worker is not present in this checkout.');
    return 0;
  }
  const result = spawnSync('npm', ['--prefix', path.join('workers', 'agentBridgeWorker'), 'test'], {
    cwd: rootDir,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  return typeof result.status === 'number' ? result.status : 1;
}

if (require.main === module) {
  process.exit(runAgentBridgeWorkerTests());
}

module.exports = {
  runAgentBridgeWorkerTests,
};
