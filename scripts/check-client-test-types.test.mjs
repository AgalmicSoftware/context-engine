import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  parseTypeScriptDiagnostics,
  runClientTestTypeGate,
} from './check-client-test-types.mjs';

test('diagnostic parser creates stable file/code/message counts without line binding', () => {
  assert.deepEqual(parseTypeScriptDiagnostics([
    "src/example.test.ts(1,7): error TS2322: Type 'string' is not assignable to type 'number'.",
    "src/example.test.ts(8,7): error TS2322: Type 'string' is not assignable to type 'number'.",
  ].join('\n')), [{
    signature: "src/example.test.ts|TS2322|Type 'string' is not assignable to type 'number'.",
    count: 2,
  }]);
});

test('typed-test gate catches a deliberate test-only type error and passes after correction', () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-test-type-gate-'));
  try {
    const clientDir = path.join(repoDir, 'client');
    const fixturePath = path.join(clientDir, 'src/fixture.test.ts');
    const fixtureCompilerPath = path.join(repoDir, 'fixture-tsc.cjs');
    fs.mkdirSync(path.join(clientDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(clientDir, 'tsconfig.tests.json'), JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, skipLibCheck: true },
      include: ['src/**/*.test.ts'],
    }));
    fs.writeFileSync(path.join(repoDir, 'baseline.json'), '{"diagnostics":[]}\n');
    fs.writeFileSync(fixturePath, "const value: number = 'wrong';\n");
    fs.writeFileSync(fixtureCompilerPath, `
const fs = require('node:fs');
const path = require('node:path');

const fixturePath = path.join(process.cwd(), 'src/fixture.test.ts');
if (process.argv.includes('--listFilesOnly')) {
  process.stdout.write(\`\${fixturePath}\\n\`);
  process.exit(0);
}
if (fs.readFileSync(fixturePath, 'utf8').includes("'wrong'")) {
  process.stdout.write(\`\${fixturePath}(1,7): error TS2322: Type 'string' is not assignable to type 'number'.\\n\`);
  process.exit(1);
}
`);

    const failing = runClientTestTypeGate({
      repoDir,
      clientDir,
      tscPath: fixtureCompilerPath,
      baselinePath: path.join(repoDir, 'baseline.json'),
      typedTestFiles: ['client/src/fixture.test.ts'],
    });
    assert.equal(failing.missingInventoryFiles.length, 0);
    assert.ok(failing.findings.some((finding) => finding.includes('TS2322')));

    fs.writeFileSync(fixturePath, 'const value: number = 1;\n');
    const passing = runClientTestTypeGate({
      repoDir,
      clientDir,
      tscPath: fixtureCompilerPath,
      baselinePath: path.join(repoDir, 'baseline.json'),
      typedTestFiles: ['client/src/fixture.test.ts'],
    });
    assert.deepEqual(passing.findings, []);
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});
