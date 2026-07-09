import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  collectStrictDebtFreeDirectoryViolations,
  collectTypeDebt,
  compareTypeDebtCounts,
  compareTypeDebtReductions,
  countTypeDebtInText,
  createZeroCounts,
  isProductionTypeScriptFile,
  normalizeStrictDebtFreeDirectories,
  runTypeDebtRatchet,
} from './check-type-debt-ratchet.mjs';

function writeFile(rootDir, relativePath, contents) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function withTempGitRepo(run) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-type-debt-'));
  try {
    execFileSync('git', ['init'], { cwd: rootDir, stdio: 'ignore' });
    return run(rootDir);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

test('countTypeDebtInText counts each tracked debt marker', () => {
  const counts = countTypeDebtInText(`
// @ts-nocheck
const value: any = input as any;
const narrowed = input as unknown as string;
type AsyncValue = Promise<any>;
type ListValue = Array<any>;
type MapValue = Record<string, any>;
type AliasValue = any;
export type ExportedAliasValue<T = unknown> = any;
type Callback<T = any> = (value: T) => void;
const lookup = new Map<string, any>();
const set = new Set<any>();
`);

  assert.equal(counts.tsNocheck, 1);
  assert.equal(counts.colonAny, 1);
  assert.equal(counts.asAny, 1);
  assert.equal(counts.asUnknownAs, 1);
  assert.equal(counts.promiseAny, 1);
  assert.equal(counts.arrayAny, 1);
  assert.equal(counts.recordAny, 1);
  assert.equal(counts.aliasAny, 2);
  assert.equal(counts.mapSetAny, 2);
});

test('isProductionTypeScriptFile excludes tests and test utilities', () => {
  assert.equal(isProductionTypeScriptFile('client/src/components/App.tsx'), true);
  assert.equal(isProductionTypeScriptFile('client/src/components/App.test.tsx'), false);
  assert.equal(isProductionTypeScriptFile('client/src/components/App.spec.ts'), false);
  assert.equal(isProductionTypeScriptFile('client/src/setupTests.ts'), false);
  assert.equal(isProductionTypeScriptFile('client/src/__tests__/App.tsx'), false);
  assert.equal(isProductionTypeScriptFile('client/src/testing/render.tsx'), false);
  assert.equal(isProductionTypeScriptFile('client/src/utilities/testUtils.ts'), false);
  assert.equal(isProductionTypeScriptFile('client/src/components/WidgetHarness.tsx'), false);
  assert.equal(isProductionTypeScriptFile('client/src/components/SurveyResults.exportControlsHarness.ts'), false);
  assert.equal(isProductionTypeScriptFile('client/src/utilities/e2eTestIds.ts'), true);
  assert.equal(isProductionTypeScriptFile('scripts/check-type-debt-ratchet.mjs'), false);
});

test('collectTypeDebt only scans tracked production TS and TSX source files', () => {
  withTempGitRepo((rootDir) => {
    writeFile(rootDir, 'client/src/components/Production.tsx', 'const value: any = input as any;\n');
    writeFile(rootDir, 'client/src/components/Production.test.tsx', 'const value: any = input as any;\n');
    writeFile(rootDir, 'client/src/utilities/testUtils.ts', 'const value: any = input as any;\n');
    writeFile(rootDir, 'client/src/components/ProductionHarness.tsx', 'const value: any = input as any;\n');
    writeFile(rootDir, 'client/src/components/Production.jsx', 'const value = input;\n');
    execFileSync('git', ['add', 'client/src'], { cwd: rootDir, stdio: 'ignore' });

    const debt = collectTypeDebt({ rootDir });

    assert.equal(debt.filesChecked, 1);
    assert.deepEqual(debt.counts, {
      ...createZeroCounts(),
      colonAny: 1,
      asAny: 1,
    });
    assert.deepEqual(debt.files.map((file) => file.path), [
      'client/src/components/Production.tsx',
    ]);
  });
});

test('compareTypeDebtCounts reports only increases over baseline', () => {
  const increases = compareTypeDebtCounts(
    {
      ...createZeroCounts(),
      tsNocheck: 4,
      colonAny: 1,
    },
    {
      ...createZeroCounts(),
      tsNocheck: 3,
      colonAny: 2,
    },
  );

  assert.deepEqual(increases, [
    {
      key: 'tsNocheck',
      label: '@ts-nocheck',
      current: 4,
      baseline: 3,
      delta: 1,
    },
  ]);
});

test('compareTypeDebtReductions reports only counts below baseline', () => {
  const reductions = compareTypeDebtReductions(
    {
      ...createZeroCounts(),
      tsNocheck: 2,
      colonAny: 2,
    },
    {
      ...createZeroCounts(),
      tsNocheck: 3,
      colonAny: 2,
    },
  );

  assert.deepEqual(reductions, [
    {
      key: 'tsNocheck',
      label: '@ts-nocheck',
      current: 2,
      baseline: 3,
      delta: -1,
    },
  ]);
});

test('normalizeStrictDebtFreeDirectories keeps only client source directories', () => {
  assert.deepEqual(
    normalizeStrictDebtFreeDirectories({
      strictDebtFreeDirectories: [
        'client/src/components/About/',
        'client/src/components/About',
        'client/src/utilities/cache',
        'scripts',
        '',
      ],
    }),
    [
      'client/src/components/About',
      'client/src/utilities/cache',
    ],
  );
});

test('collectStrictDebtFreeDirectoryViolations reports debt under protected directories', () => {
  const violations = collectStrictDebtFreeDirectoryViolations(
    [
      {
        path: 'client/src/components/About/AboutPage.tsx',
        counts: {
          ...createZeroCounts(),
          colonAny: 1,
        },
      },
      {
        path: 'client/src/components/Admin/AdminPage.tsx',
        counts: {
          ...createZeroCounts(),
          colonAny: 2,
        },
      },
    ],
    ['client/src/components/About'],
  );

  assert.deepEqual(violations, [
    {
      directory: 'client/src/components/About',
      path: 'client/src/components/About/AboutPage.tsx',
      counts: {
        ...createZeroCounts(),
        colonAny: 1,
      },
    },
  ]);
});

test('runTypeDebtRatchet passes and reports baseline headroom', () => {
  withTempGitRepo((rootDir) => {
    writeFile(rootDir, 'client/src/components/Production.tsx', 'const value = input;\n');
    writeFile(rootDir, 'scripts/type-debt-baseline.json', JSON.stringify({
      counts: {
        ...createZeroCounts(),
        colonAny: 1,
      },
    }));
    execFileSync('git', ['add', '.'], { cwd: rootDir, stdio: 'ignore' });

    const stdout = [];
    const stderr = [];
    const status = runTypeDebtRatchet({
      rootDir,
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    });

    assert.equal(status, 0);
    assert.match(stdout.join('\n'), /Type debt baseline has headroom/);
    assert.match(stdout.join('\n'), /: any: 0 is below baseline 1 by 1/);
    assert.equal(stderr.length, 0);
  });
});

test('runTypeDebtRatchet fails when protected directories contain counted debt', () => {
  withTempGitRepo((rootDir) => {
    writeFile(rootDir, 'client/src/components/Protected/Production.tsx', 'const value: any = input;\n');
    writeFile(rootDir, 'scripts/type-debt-baseline.json', JSON.stringify({
      strictDebtFreeDirectories: ['client/src/components/Protected'],
      counts: {
        ...createZeroCounts(),
        colonAny: 1,
      },
    }));
    execFileSync('git', ['add', '.'], { cwd: rootDir, stdio: 'ignore' });

    const stdout = [];
    const stderr = [];
    const status = runTypeDebtRatchet({
      rootDir,
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    });

    assert.equal(status, 1);
    assert.match(stdout.join('\n'), /Strict debt-free directories: 1/);
    assert.match(stderr.join('\n'), /strict debt-free directories contain counted debt/);
    assert.match(stderr.join('\n'), /client\/src\/components\/Protected\/Production\.tsx/);
  });
});

test('runTypeDebtRatchet write-baseline preserves strict directory ownership', () => {
  withTempGitRepo((rootDir) => {
    writeFile(rootDir, 'client/src/components/Protected/Production.tsx', 'const value = input;\n');
    writeFile(rootDir, 'scripts/type-debt-baseline.json', JSON.stringify({
      strictDebtFreeDirectories: ['client/src/components/Protected'],
      counts: {
        ...createZeroCounts(),
        colonAny: 1,
      },
    }));
    execFileSync('git', ['add', '.'], { cwd: rootDir, stdio: 'ignore' });

    const stdout = [];
    const stderr = [];
    const status = runTypeDebtRatchet({
      rootDir,
      argv: ['--write-baseline'],
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    });

    const baseline = JSON.parse(fs.readFileSync(path.join(rootDir, 'scripts/type-debt-baseline.json'), 'utf8'));
    assert.equal(status, 0);
    assert.deepEqual(baseline.strictDebtFreeDirectories, ['client/src/components/Protected']);
    assert.equal(baseline.counts.colonAny, 0);
    assert.equal(stderr.length, 0);
  });
});

test('runTypeDebtRatchet fails when current counts exceed the checked-in baseline', () => {
  withTempGitRepo((rootDir) => {
    writeFile(rootDir, 'client/src/components/Production.tsx', 'const value: any = input;\n');
    writeFile(rootDir, 'scripts/type-debt-baseline.json', JSON.stringify({
      counts: createZeroCounts(),
    }));
    execFileSync('git', ['add', '.'], { cwd: rootDir, stdio: 'ignore' });

    const stdout = [];
    const stderr = [];
    const status = runTypeDebtRatchet({
      rootDir,
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    });

    assert.equal(status, 1);
    assert.match(stderr.join('\n'), /: any: 1 exceeds baseline 0 by 1/);
    assert.match(stdout.join('\n'), /Current counts/);
  });
});
