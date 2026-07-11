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
  violationId,
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
    resolveClientImport('client/src/components/Admin/AdminPage.tsx', '../../utilities/web3/chainGateway.js'),
    'client/src/utilities/web3/chainGateway'
  );
  assert.equal(
    resolveClientImport('client/src/components/Admin/AdminPage.tsx', 'src/utilities/worker/corsProxy'),
    'client/src/utilities/worker/corsProxy'
  );
  assert.equal(
    resolveClientImport('client/src/components/Admin/AdminPage.tsx', '@/utilities/web3/sessionRegistry'),
    'client/src/utilities/web3/sessionRegistry'
  );
  assert.equal(
    resolveClientImport('client/src/components/Admin/AdminPage.tsx', 'utilities/web3/chainGateway.js'),
    'client/src/utilities/web3/chainGateway'
  );
  assert.equal(
    resolveClientImport('client/src/components/Admin/AdminPage.tsx', 'components/Shared/CETooltip'),
    'client/src/components/Shared/CETooltip'
  );
  assert.equal(
    resolveClientImport('client/src/components/Admin/AdminPage.tsx', 'assets/logo.png'),
    'client/src/assets/logo.png'
  );
  assert.equal(
    resolveClientImport('client/src/components/Admin/AdminPage.tsx', 'variables/chains.js'),
    'client/src/variables/chains'
  );
  assert.equal(
    resolveClientImport('client\\src\\components\\Admin\\AdminPage.tsx', '..\\..\\utilities\\web3\\index.ts'),
    'client/src/utilities/web3/'
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
  assert.equal(isRouteOrPageCode('client/src/components/MainSite/AppShell.tsx'), true);
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
      "import AppShell from '../MainSite/AppShell';\n"
    );

    const violations = collectClientBoundaryViolations({ rootDir });
    assert.deepEqual(violations.map((violation) => violation.rule), [
      'domains-no-components',
      'ui-no-route-runtime',
      'utilities-no-components',
    ]);
  });
});

test('collectClientBoundaryViolations returns stable sorted results from unsorted file lists', () => {
  withTempRoot((rootDir) => {
    const domainFile = 'client/src/domains/surveys/surveyModel.ts';
    const uiFile = 'client/src/components/ui/IconButton.tsx';
    const utilityFile = 'client/src/utilities/session/sessionHelpers.ts';
    writeFile(
      rootDir,
      utilityFile,
      "import Widget from '../../components/Shared/Widget';\n"
    );
    writeFile(
      rootDir,
      uiFile,
      "import AppShell from '../MainSite/AppShell';\n"
    );
    writeFile(
      rootDir,
      domainFile,
      "import SurveyTool from '../../components/SurveyTool/SurveyTool';\n"
    );

    const violations = collectClientBoundaryViolations({
      rootDir,
      listFiles: () => [utilityFile, uiFile, domainFile],
    });
    const violationIds = violations.map(violationId);

    assert.deepEqual(violationIds, [...violationIds].sort());
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

test('route/page low-level imports through Vite bare aliases are violations', () => {
  withTempRoot((rootDir) => {
    writeFile(
      rootDir,
      'client/src/components/UserPage/UserPage.tsx',
      "import contractScripts from 'utilities/web3/chainGateway.js';\n"
    );

    const violations = collectClientBoundaryViolations({ rootDir });
    assert.deepEqual(violations, [
      {
        rule: 'route-page-no-low-level',
        source: 'client/src/components/UserPage/UserPage.tsx',
        import: 'utilities/web3/chainGateway.js',
        resolved: 'client/src/utilities/web3/chainGateway',
      },
    ]);
  });
});

test('shared runtime components cannot add low-level imports', () => {
  withTempRoot((rootDir) => {
    writeFile(
      rootDir,
      'client/src/components/SurveyTool/SurveyQuestions.tsx',
      "import contractScripts from '../../utilities/web3/chainGateway.js';\n"
    );

    const largeRuntimeSource = [
      "import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';",
      ...Array.from({ length: 5001 }, (_, index) => `const line${index} = ${index};`),
    ].join('\n');
    writeFile(
      rootDir,
      'client/src/components/SharedRuntime/LargeRuntime.tsx',
      largeRuntimeSource
    );
    writeFile(
      rootDir,
      'client/src/components/SharedRuntime/SmallRuntime.tsx',
      "import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';\n"
    );

    const violations = collectClientBoundaryViolations({ rootDir });
    assert.deepEqual(violations, [
      {
        rule: 'shared-runtime-no-new-low-level',
        source: 'client/src/components/SharedRuntime/LargeRuntime.tsx',
        import: '../../utilities/arweave/arweaveUrls.js',
        resolved: 'client/src/utilities/arweave/arweaveUrls',
      },
      {
        rule: 'shared-runtime-no-new-low-level',
        source: 'client/src/components/SurveyTool/SurveyQuestions.tsx',
        import: '../../utilities/web3/chainGateway.js',
        resolved: 'client/src/utilities/web3/chainGateway',
      },
    ]);
  });
});

test('pure low-level re-export barrels are pass-through facade violations', () => {
  withTempRoot((rootDir) => {
    writeFile(
      rootDir,
      'client/src/utilities/user/userPageRuntime.ts',
      `
        export {
          getDemoSessionConfigBySlug,
          getSessionConfigBySlug,
          normalizeSessionSlug,
        } from '../web3/chainGateway.js';
        export {
          checkSponsoredAccess,
        } from '../web3/sponsoredAccess.js';
      `
    );

    const violations = collectClientBoundaryViolations({ rootDir });
    assert.deepEqual(violations, [
      {
        rule: 'no-passthrough-facade',
        source: 'client/src/utilities/user/userPageRuntime.ts',
        import: '<passthrough-facade>',
        resolved: 'client/src/utilities/user/userPageRuntime.ts',
      },
    ]);
  });
});

test('naming-migration aliases may re-export canonical low-level modules', () => {
  withTempRoot((rootDir) => {
    writeFile(
      rootDir,
      'client/src/utilities/web3/legacyChainReads.ts',
      `
        /** naming-migration alias, remove after compatibility cleanup. */
        export {
          createChainReads,
          createChainReads as createLegacyChainReads,
        } from './chainReads.js';
        export type { ChainReadOptions } from './chainReads.js';
      `
    );

    assert.deepEqual(collectClientBoundaryViolations({ rootDir }), []);
  });
});

test('component-local runtime micro-facades over low-level modules are violations', () => {
  withTempRoot((rootDir) => {
    writeFile(
      rootDir,
      'client/src/components/Admin/adminWorkerRuntime.ts',
      `
        import { corsProxyUtils } from '../../utilities/worker/corsProxy.js';

        export const resolveAdminWorkerUrl = (...args) => (
          corsProxyUtils.resolveCorsProxyUrl(...args)
        );
      `
    );

    const violations = collectClientBoundaryViolations({ rootDir });
    assert.deepEqual(violations, [
      {
        rule: 'no-passthrough-facade',
        source: 'client/src/components/Admin/adminWorkerRuntime.ts',
        import: '<passthrough-facade>',
        resolved: 'client/src/components/Admin/adminWorkerRuntime.ts',
      },
    ]);
  });
});

test('app runtime modules may delegate to low-level modules', () => {
  withTempRoot((rootDir) => {
    writeFile(
      rootDir,
      'client/src/app/runtime/appWagmiRuntime.ts',
      `
        import contractScripts from '../../utilities/web3/chainGateway.js';

        export const first = () => (
          contractScripts.first()
        );
        export const second = () => (
          contractScripts.second()
        );
        export const third = () => (
          contractScripts.third()
        );
      `
    );

    assert.deepEqual(collectClientBoundaryViolations({ rootDir }), []);
  });
});

test('production files cannot import excluded harness or test utility modules', () => {
  withTempRoot((rootDir) => {
    writeFile(
      rootDir,
      'client/src/components/Widget/Widget.tsx',
      `
        import { renderWidget } from './WidgetHarness';
        import { buildWidget } from './Widget.testUtils';
        import fixtureData from './fixtures/data';
      `
    );

    const violations = collectClientBoundaryViolations({ rootDir });
    assert.deepEqual(violations, [
      {
        rule: 'production-no-test-exclusion-imports',
        source: 'client/src/components/Widget/Widget.tsx',
        import: './fixtures/data',
        resolved: 'client/src/components/Widget/fixtures/data',
      },
      {
        rule: 'production-no-test-exclusion-imports',
        source: 'client/src/components/Widget/Widget.tsx',
        import: './Widget.testUtils',
        resolved: 'client/src/components/Widget/Widget.testUtils',
      },
      {
        rule: 'production-no-test-exclusion-imports',
        source: 'client/src/components/Widget/Widget.tsx',
        import: './WidgetHarness',
        resolved: 'client/src/components/Widget/WidgetHarness',
      },
    ]);
  });
});

test('test files may import excluded harness modules', () => {
  withTempRoot((rootDir) => {
    writeFile(
      rootDir,
      'client/src/components/Widget/Widget.test.tsx',
      "import { renderWidget } from './WidgetHarness';\n"
    );

    assert.deepEqual(collectClientBoundaryViolations({ rootDir }), []);
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

test('resolved baseline entries fail with ratchet-down guidance', () => {
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
    }), 1);
    assert.match(stdout.join('\n'), /Current violations: 1; baseline: 2; new: 0; resolved: 1\./);
    assert.match(stderr.join('\n'), /resolved baseline entry\/entries found; prune the baseline in the same commit/);
    assert.match(stderr.join('\n'), /route-page-no-low-level/);
  });
});

test('json output includes resolved baseline entries and exits nonzero', () => {
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
      argv: ['--json'],
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    }), 1);

    const result = JSON.parse(stdout.join('\n'));
    assert.equal(result.totalViolations, 1);
    assert.equal(result.baselineViolations, 2);
    assert.deepEqual(result.newViolations, []);
    assert.deepEqual(result.resolvedViolations, [baselineViolations[0]]);
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
