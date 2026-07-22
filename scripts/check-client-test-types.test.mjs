import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  parseTypeScriptDiagnostics,
  runClientTestTypeGate,
} from './check-client-test-types.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REAL_TSC = path.resolve(__dirname, '../client/node_modules/typescript/bin/tsc');

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
    fs.mkdirSync(path.join(clientDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(clientDir, 'tsconfig.tests.json'), JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, skipLibCheck: true },
      include: ['src/**/*.test.ts'],
    }));
    fs.writeFileSync(path.join(repoDir, 'baseline.json'), '{"diagnostics":[]}\n');
    fs.writeFileSync(path.join(clientDir, 'src/fixture.test.ts'), "const value: number = 'wrong';\n");

    const failing = runClientTestTypeGate({
      repoDir,
      clientDir,
      tscPath: REAL_TSC,
      baselinePath: path.join(repoDir, 'baseline.json'),
      typedTestFiles: ['client/src/fixture.test.ts'],
    });
    assert.equal(failing.missingInventoryFiles.length, 0);
    assert.ok(failing.findings.some((finding) => finding.includes('TS2322')));

    fs.writeFileSync(path.join(clientDir, 'src/fixture.test.ts'), 'const value: number = 1;\n');
    const passing = runClientTestTypeGate({
      repoDir,
      clientDir,
      tscPath: REAL_TSC,
      baselinePath: path.join(repoDir, 'baseline.json'),
      typedTestFiles: ['client/src/fixture.test.ts'],
    });
    assert.deepEqual(passing.findings, []);
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});
