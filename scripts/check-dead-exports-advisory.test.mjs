import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  collectDeadExportAdvisory,
  formatDeadExportAdvisory,
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
      "import { UsedWidget } from '../Used/Used';\nexport const Page = () => UsedWidget();\n",
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
