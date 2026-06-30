import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  collectClientBoundaryViolations,
  compareToBaseline,
  extractImportSpecifiers,
  findDuplicateBaselineViolations,
  isProductionClientSourceFile,
  isRouteOrPageCode,
  readBoundaryBaseline,
  resolveClientImport,
  runClientBoundaryCheck,
  writeBoundaryBaseline,
} from './check-client-boundaries.mjs';

function writeFile(rootDir, relativePath, contents = '// fixture\n') {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function withTempRoot(run) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-client-boundaries-'));
  try {
    return run(rootDir);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

test('extractImportSpecifiers finds static, dynamic, and require imports', () => {
  assert.deepEqual(extractImportSpecifiers(`
    import React from 'react';
    import '../side-effect';
    import type { Thing } from './types';
    export { value } from './barrel';
    const lazy = import('./lazy');
    const legacy = require('./legacy');
  `), [
    '../side-effect',
    './barrel',
    './lazy',
    './legacy',
    './types',
    'react',
  ]);
});

test('resolveClientImport resolves local client imports and ignores packages', () => {
  assert.equal(
    resolveClientImport('client/src/components/Admin/AdminPage.tsx', '../../utilities/web3/contractScripts.js'),
    'client/src/utilities/web3/contractScripts'
  );
  assert.equal(
    resolveClientImport('client/src/components/Admin/AdminPage.tsx', 'src/utilities/worker/corsProxy'),
    'client/src/utilities/worker/corsProxy'
  );
  assert.equal(
    resolveClientImport('client/src/components/Admin/AdminPage.tsx', '@/utilities/web3/sessionRegistry'),
    'client/src/utilities/web3/sessionRegistry'
  );
  assert.equal(resolveClientImport('client/src/components/Admin/AdminPage.tsx', 'react'), null);
});

test('isProductionClientSourceFile excludes tests, fixtures, and harness files', () => {
  assert.equal(isProductionClientSourceFile('client/src/components/Admin/AdminPage.tsx'), true);
  assert.equal(isProductionClientSourceFile('client/src/components/Admin/AdminPage.test.tsx'), false);
  assert.equal(isProductionClientSourceFile('client/src/components/testing/render.tsx'), false);
  assert.equal(isProductionClientSourceFile('client/src/components/SurveyTool/surveyResultsTestHarness.tsx'), false);
  assert.equal(isProductionClientSourceFile('client/src/artifacts/Generated.ts'), false);
});

test('isRouteOrPageCode identifies route/page owners conservatively', () => {
  assert.equal(isRouteOrPageCode('client/src/components/Admin/AdminPage.tsx'), true);
  assert.equal(isRouteOrPageCode('client/src/components/MainSite/MainSite.tsx'), true);
  assert.equal(isRouteOrPageCode('client/src/app/routes/session.tsx'), true);
  assert.equal(isRouteOrPageCode('client/src/components/Shared/Button.tsx'), false);
});

test('collectClientBoundaryViolations enforces stable non-baselined boundaries', () => {
  withTempRoot((rootDir) => {
    writeFile(
      rootDir,
      'client/src/utilities/session/sessionHelpers.ts',
      "import Widget from '../../components/Shared/Widget';\n"
    );
    writeFile(
      rootDir,
      'client/src/domains/surveys/surveyModel.ts',
      "import SurveyTool from '../../components/SurveyTool/SurveyTool';\n"
    );
    writeFile(
      rootDir,
      'client/src/components/ui/IconButton.tsx',
      "import MainSite from '../MainSite/MainSite';\n"
    );

    const violations = collectClientBoundaryViolations({ rootDir });
    assert.deepEqual(violations.map((violation) => violation.rule), [
      'domains-no-components',
      'ui-no-route-runtime',
      'utilities-no-components',
    ]);
  });
});

test('route/page low-level imports fail only when not present in the baseline', () => {
  withTempRoot((rootDir) => {
    writeFile(
      rootDir,
      'client/src/components/Admin/AdminPage.tsx',
      "import { getSession } from '../../utilities/web3/sessionRegistry';\n"
    );
    let violations = collectClientBoundaryViolations({ rootDir });
    assert.equal(violations.length, 1);
    assert.equal(violations[0].rule, 'route-page-no-low-level');

    writeBoundaryBaseline(violations, rootDir);
    assert.deepEqual(readBoundaryBaseline(rootDir).violations, violations);

    const stdout = [];
    const stderr = [];
    assert.equal(runClientBoundaryCheck({
      rootDir,
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    }), 0);
    assert.match(stdout.join('\n'), /no new boundary violations/);
    assert.equal(stderr.length, 0);

    writeFile(
      rootDir,
      'client/src/components/UserPage/UserPage.tsx',
      "import { upload } from '../../utilities/worker/corsProxy';\n"
    );
    violations = collectClientBoundaryViolations({ rootDir });
    const comparison = compareToBaseline(violations, readBoundaryBaseline(rootDir).violations);
    assert.equal(comparison.newViolations.length, 1);

    const failedStderr = [];
    assert.equal(runClientBoundaryCheck({
      rootDir,
      stdout: () => {},
      stderr: (line) => failedStderr.push(line),
    }), 1);
    assert.match(failedStderr.join('\n'), /new architecture boundary violation/);
  });
});

test('duplicate baseline entries fail even when the current violation is baselined', () => {
  withTempRoot((rootDir) => {
    writeFile(
      rootDir,
      'client/src/components/Admin/AdminPage.tsx',
      "import { getSession } from '../../utilities/web3/sessionRegistry';\n"
    );
    const violations = collectClientBoundaryViolations({ rootDir });
    assert.equal(violations.length, 1);
    writeBoundaryBaseline([violations[0], violations[0]], rootDir);

    assert.deepEqual(findDuplicateBaselineViolations(readBoundaryBaseline(rootDir).violations), [
      violations[0],
    ]);

    const stderr = [];
    assert.equal(runClientBoundaryCheck({
      rootDir,
      stdout: () => {},
      stderr: (line) => stderr.push(line),
    }), 1);
    assert.match(stderr.join('\n'), /duplicate baseline entry/);
    assert.match(stderr.join('\n'), /route-page-no-low-level/);
  });
});

test('json output includes duplicate baseline entries and exits nonzero', () => {
  withTempRoot((rootDir) => {
    writeFile(
      rootDir,
      'client/src/components/Admin/AdminPage.tsx',
      "import { getSession } from '../../utilities/web3/sessionRegistry';\n"
    );
    const violations = collectClientBoundaryViolations({ rootDir });
    writeBoundaryBaseline([violations[0], violations[0]], rootDir);

    const stdout = [];
    const stderr = [];
    assert.equal(runClientBoundaryCheck({
      rootDir,
      argv: ['--json'],
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    }), 1);

    const result = JSON.parse(stdout.join('\n'));
    assert.deepEqual(result.duplicateBaselineViolations, [violations[0]]);
    assert.equal(result.newViolations.length, 0);
    assert.equal(stderr.length, 0);
  });
});

test('resolved baseline entries report ratchet-down guidance without failing', () => {
  withTempRoot((rootDir) => {
    const staleSource = 'client/src/components/Admin/AdminPage.tsx';
    writeFile(
      rootDir,
      staleSource,
      "import { getSession } from '../../utilities/web3/sessionRegistry';\n"
    );
    writeFile(
      rootDir,
      'client/src/components/Sponsor/SponsorPage.tsx',
      "import { getWorkerUrl } from '../../utilities/worker/workerUrl';\n"
    );
    const baselineViolations = collectClientBoundaryViolations({ rootDir });
    assert.equal(baselineViolations.length, 2);
    writeBoundaryBaseline(baselineViolations, rootDir);

    fs.rmSync(path.join(rootDir, staleSource), { force: true });

    const stdout = [];
    const stderr = [];
    assert.equal(runClientBoundaryCheck({
      rootDir,
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    }), 0);
    assert.match(stdout.join('\n'), /Current violations: 1; baseline: 2; new: 0; resolved: 1\./);
    assert.match(stdout.join('\n'), /Resolved baseline entries detected/);
    assert.equal(stderr.length, 0);
  });
});

test('new violation output includes rule, source, import, and resolved path', () => {
  withTempRoot((rootDir) => {
    writeFile(
      rootDir,
      'client/src/utilities/session/sessionHelpers.ts',
      "import Widget from '../../components/Shared/Widget';\n"
    );

    const stderr = [];
    assert.equal(runClientBoundaryCheck({
      rootDir,
      stdout: () => {},
      stderr: (line) => stderr.push(line),
    }), 1);
    assert.match(
      stderr.join('\n'),
      /utilities-no-components: client\/src\/utilities\/session\/sessionHelpers\.ts imports \.\.\/\.\.\/components\/Shared\/Widget \(client\/src\/components\/Shared\/Widget\)/
    );
  });
});
