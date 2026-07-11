import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  collectDeadExportAdvisory,
  formatDeadExportAdvisory,
  runDeadExportCheck,
  runDeadExportAdvisory,
} from './check-dead-exports-advisory.mjs';

function writeFile(rootDir, relativePath, contents) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function withTempRoot(run) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-dead-export-advisory-'));
  try {
    return run(rootDir);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

test('collectDeadExportAdvisory reports candidates without failing', () => {
  withTempRoot((rootDir) => {
    writeFile(
      rootDir,
      'client/src/components/Widget/Widget.tsx',
      "export function RenderWidget() { return null; }\nexport const unusedWidgetHelper = () => null;\n",
    );
    writeFile(
      rootDir,
      'client/src/components/Widget/index.ts',
      "export { RenderWidget } from './Widget';\n",
    );
    writeFile(
      rootDir,
      'client/src/components/Used/Used.tsx',
      "export const UsedWidget = () => null;\n",
    );
    writeFile(
      rootDir,
      'client/src/components/Page/Page.tsx',
      "import { UsedWidget } from '../Used/Used.js';\nexport const Page = () => UsedWidget();\n",
    );

    const result = collectDeadExportAdvisory({ rootDir });
    assert.equal(result.filesScanned, 4);
    assert.deepEqual(result.candidateDeadFiles, ['client/src/components/Page/Page.tsx']);
    assert.deepEqual(result.candidateUnusedExports, [
      {
        exportName: 'Page',
        file: 'client/src/components/Page/Page.tsx',
      },
      {
        exportName: 'unusedWidgetHelper',
        file: 'client/src/components/Widget/Widget.tsx',
      },
    ]);

    const output = [];
    assert.equal(runDeadExportAdvisory({ rootDir, stdout: (line) => output.push(line) }), 0);
    assert.match(output.join('\n'), /Dead export advisory scanned 4 production client files/);
  });
});

test('formatDeadExportAdvisory prints bounded candidate lists', () => {
  const output = formatDeadExportAdvisory({
    filesScanned: 1,
    candidateDeadFiles: ['client/src/components/Dead/Dead.tsx'],
    candidateUnusedExports: [{ file: 'client/src/components/Dead/Dead.tsx', exportName: 'deadExport' }],
  });

  assert.match(output, /Candidate dead files: 1/);
  assert.match(output, /dead-file\? client\/src\/components\/Dead\/Dead\.tsx/);
  assert.match(output, /unused-export\? client\/src\/components\/Dead\/Dead\.tsx#deadExport/);
});

test('runDeadExportCheck passes at the banked counts and fails on regrowth', () => {
  withTempRoot((rootDir) => {
    writeFile(rootDir, 'client/src/components/Dead/Dead.ts', 'export const deadExport = true;\n');
    writeFile(
      rootDir,
      'scripts/dead-exports-baseline.json',
      `${JSON.stringify({ version: 1, candidateDeadFiles: 1, candidateUnusedExports: 1 }, null, 2)}\n`,
    );

    const passingOutput = [];
    assert.equal(runDeadExportCheck({ rootDir, stdout: (line) => passingOutput.push(line) }), 0);
    assert.match(passingOutput.join('\n'), /Dead export ratchet passed/);

    writeFile(rootDir, 'client/src/components/Dead/Second.ts', 'export const secondDeadExport = true;\n');
    const failingOutput = [];
    assert.equal(runDeadExportCheck({ rootDir, stderr: (line) => failingOutput.push(line) }), 1);
    assert.match(failingOutput.join('\n'), /candidate dead files increased: 1 -> 2/);
    assert.match(failingOutput.join('\n'), /candidate unused named exports increased: 1 -> 2/);
  });
});

test('collectDeadExportAdvisory treats parity-locked twins as one module', () => {
  withTempRoot((rootDir) => {
    writeFile(
      rootDir,
      'client/src/variables/twinDefaults.js',
      "export const sharedValue = 1;\nexport const unusedTwinHelper = () => null;\n",
    );
    writeFile(
      rootDir,
      'client/src/variables/twinDefaults.ts',
      "export const sharedValue = 1;\nexport const unusedTwinHelper = () => null;\n",
    );
    writeFile(
      rootDir,
      'client/src/components/Consumer/Consumer.tsx',
      "import { sharedValue } from '../../variables/twinDefaults.js';\nexport const Consumer = () => sharedValue;\n",
    );

    const result = collectDeadExportAdvisory({ rootDir });
    assert.equal(result.filesScanned, 3);
    // Importing the .js specifier keeps BOTH twins alive.
    assert.deepEqual(result.candidateDeadFiles, ['client/src/components/Consumer/Consumer.tsx']);
    // The shared unused export name counts once, attributed to the .ts twin.
    assert.deepEqual(result.candidateUnusedExports, [
      {
        exportName: 'Consumer',
        file: 'client/src/components/Consumer/Consumer.tsx',
      },
      {
        exportName: 'unusedTwinHelper',
        file: 'client/src/variables/twinDefaults.ts',
      },
    ]);
  });
});

test('collectDeadExportAdvisory twin closure works from the .ts side and stays scoped to js/ts', () => {
  withTempRoot((rootDir) => {
    writeFile(
      rootDir,
      'client/src/variables/otherTwin.js',
      "export const otherShared = 1;\nexport const onlyJsHelper = () => null;\n",
    );
    writeFile(
      rootDir,
      'client/src/variables/otherTwin.ts',
      "export const otherShared = 1;\n",
    );
    writeFile(
      rootDir,
      'client/src/components/TsConsumer/TsConsumer.tsx',
      "import { otherShared } from '../../variables/otherTwin.ts';\nexport const TsConsumer = () => otherShared;\n",
    );
    writeFile(rootDir, 'client/src/components/Widget/Widget.jsx', 'export const JsxWidget = () => null;\n');
    writeFile(rootDir, 'client/src/components/Widget/Widget.tsx', 'export const TsxWidget = () => null;\n');
    writeFile(
      rootDir,
      'client/src/components/Page/Page.tsx',
      "import { JsxWidget } from '../Widget/Widget.jsx';\nexport const Page = () => JsxWidget();\n",
    );

    const result = collectDeadExportAdvisory({ rootDir });
    // A .ts-specifier import keeps the .js twin alive too; .jsx/.tsx pairs
    // are deliberately NOT twinned, so Widget.tsx stays a candidate.
    assert.deepEqual(result.candidateDeadFiles, [
      'client/src/components/Page/Page.tsx',
      'client/src/components/TsConsumer/TsConsumer.tsx',
      'client/src/components/Widget/Widget.tsx',
    ]);
    // An export present in only one twin is NOT deduped away.
    assert.ok(
      result.candidateUnusedExports.some(
        ({ file, exportName }) => file === 'client/src/variables/otherTwin.js' && exportName === 'onlyJsHelper',
      ),
    );
    assert.ok(
      result.candidateUnusedExports.some(
        ({ file, exportName }) => file === 'client/src/components/Widget/Widget.tsx' && exportName === 'TsxWidget',
      ),
    );
  });
});
