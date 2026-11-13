import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  describeCompilerExit,
  parseTypeScriptDiagnostics,
  runClientTestTypeGate,
} from './check-client-test-types.mjs';

// A gate over one fixture file and a stand-in compiler whose behaviour is the given script body.
const withFixtureCompiler = (compilerBody, run) => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-test-type-gate-'));
  try {
    const clientDir = path.join(repoDir, 'client');
    fs.mkdirSync(path.join(clientDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(clientDir, 'src/fixture.test.ts'), 'const value: number = 1;\n');
    fs.writeFileSync(path.join(repoDir, 'baseline.json'), '{"diagnostics":[]}\n');
    fs.writeFileSync(path.join(repoDir, 'fixture-tsc.cjs'), `
const path = require('node:path');
const listing = process.argv.includes('--listFilesOnly');
const listFixture = () => process.stdout.write(path.join(process.cwd(), 'src/fixture.test.ts') + '\\n');
${compilerBody}
`);
    return run(() => runClientTestTypeGate({
      repoDir,
      clientDir,
      tscPath: path.join(repoDir, 'fixture-tsc.cjs'),
      baselinePath: path.join(repoDir, 'baseline.json'),
      typedTestFiles: ['client/src/fixture.test.ts'],
    }), clientDir);
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
};

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

test('a compiler killed for lack of memory is reported with its signal and its last words', () => {
  withFixtureCompiler(`
if (listing) { listFixture(); process.exit(0); }
process.stderr.write('<--- Last few GCs --->\\nFATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory\\n 1: 0xabc node::Abort()\\n');
process.kill(process.pid, 'SIGABRT');
`, (gate) => {
    const { findings } = gate();
    assert.equal(findings.length, 1);
    assert.match(findings[0], /^typed-test compiler was killed by SIGABRT \(it said: FATAL ERROR: Reached heap limit .*heap out of memory\) without parseable diagnostics$/);
  });
});

test('a file listing that was killed says so, not that every typed test is missing', () => {
  withFixtureCompiler(`
if (listing) process.kill(process.pid, 'SIGKILL');
process.exit(0);
`, (gate) => {
    const { findings, missingInventoryFiles } = gate();
    assert.deepEqual(missingInventoryFiles, []);
    assert.deepEqual(findings, ['typed-test file listing was killed by SIGKILL']);
  });
});

test('a compiler killed after printing some diagnostics is still a finding', () => {
  withFixtureCompiler(`
if (listing) { listFixture(); process.exit(0); }
process.stdout.write(path.join(process.cwd(), 'src/fixture.test.ts') + "(1,7): error TS2322: Type 'string' is not assignable to type 'number'.\\n");
process.kill(process.pid, 'SIGKILL');
`, (gate) => {
    const { findings } = gate();
    assert.ok(findings.some((finding) => finding.includes('TS2322')));
    assert.ok(findings.some((finding) => finding.startsWith('typed-test compiler was killed by SIGKILL')));
  });
});

test('a compiler that exits with an error and nothing parseable says what it printed', () => {
  assert.equal(describeCompilerExit({ status: 2, signal: null, stderr: '', stdout: '' }), 'exited 2');
  // tsc prints an error that names no file on stdout.
  withFixtureCompiler(`
if (listing) { listFixture(); process.exit(0); }
process.stdout.write("error TS5083: Cannot read file 'tsconfig.tests.json'.\\n");
process.exit(1);
`, (gate) => {
    assert.deepEqual(gate().findings, [
      "typed-test compiler exited 1 (it said: error TS5083: Cannot read file 'tsconfig.tests.json'.) without parseable diagnostics",
    ]);
  });
});

test('the compiler gets its own heap, whatever NODE_OPTIONS allows', () => {
  const before = process.env.NODE_OPTIONS;
  // A small CI runner's default, forced lower still: the compiler must not inherit it.
  process.env.NODE_OPTIONS = '--max-old-space-size=256';
  try {
    withFixtureCompiler(`
if (listing) { listFixture(); process.exit(0); }
require('node:fs').writeFileSync('heap-limit.txt', String(require('node:v8').getHeapStatistics().heap_size_limit));
process.exit(0);
`, (gate, clientDir) => {
      assert.deepEqual(gate().findings, []);
      const heapLimitMb = Number(fs.readFileSync(path.join(clientDir, 'heap-limit.txt'), 'utf8')) / (1024 * 1024);
      assert.ok(heapLimitMb >= 4096, `the compiler ran with a ${Math.round(heapLimitMb)} MB heap`);
    });
  } finally {
    if (before === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = before;
  }
});
