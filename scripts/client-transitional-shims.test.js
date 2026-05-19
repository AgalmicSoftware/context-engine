'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CLIENT_SRC = path.join(ROOT, 'client/src');
const ADJACENT_TS_REEXPORT_RE = /from ['"]\.\/[^'"]+\.ts['"]/;
const PURE_TS_REEXPORT_LINE_RE = /^export (?:\*|\{\s*default\s*\}) from ['"]\.\/[^'"]+\.ts['"];\s*$/;

const EXPECTED_NON_PURE_TS_TRANSITIONAL_FILES = Object.freeze({
  'client/src/variables/appConfig.js': 'initializes runtime config before re-exporting the typed config surface',
});

const stripLineComments = (source) => source
  .replace(/^\s*\/\/[^\n]*(?:\n|$)/gm, '')
  .trim();

const listFiles = (absoluteDir) => {
  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  const files = [];

  entries.forEach((entry) => {
    const absolutePath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(absolutePath));
      return;
    }
    if (entry.isFile()) {
      files.push(absolutePath);
    }
  });

  return files;
};

const toRelativePath = (absolutePath) => path.relative(ROOT, absolutePath).split(path.sep).join('/');

const listClientJsFiles = () => listFiles(CLIENT_SRC)
  .filter((absolutePath) => absolutePath.endsWith('.js'))
  .sort();

const isPureTsReexportShim = (source) => {
  const lines = stripLineComments(source)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length > 0 && lines.every((line) => PURE_TS_REEXPORT_LINE_RE.test(line));
};

test('pure JS-to-TS re-export shims stay retired', () => {
  const pureShims = listClientJsFiles()
    .filter((absolutePath) => isPureTsReexportShim(fs.readFileSync(absolutePath, 'utf8')))
    .map(toRelativePath);

  assert.deepEqual(
    pureShims,
    [],
    'pure JS wrappers should stay deleted; import the adjacent TS module through existing Vite/Jest compatibility instead',
  );
});

test('remaining explicit JS-to-TS transitional files stay documented exceptions', () => {
  const transitionalFiles = listClientJsFiles()
    .filter((absolutePath) => ADJACENT_TS_REEXPORT_RE.test(fs.readFileSync(absolutePath, 'utf8')))
    .map(toRelativePath);

  assert.deepEqual(transitionalFiles, Object.keys(EXPECTED_NON_PURE_TS_TRANSITIONAL_FILES).sort());

  transitionalFiles.forEach((relativePath) => {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assert.match(source, /initializeRuntimeConfig/);
    assert.equal(
      isPureTsReexportShim(source),
      false,
      `${relativePath} should remain a documented non-pure exception, not a pure wrapper`,
    );
  });
});

test('the SurveyTool AudioInput alias stays retired after shared extraction', () => {
  const relativePath = 'client/src/components/SurveyTool/AudioInput.tsx';
  const absolutePath = path.join(ROOT, relativePath);

  assert.equal(fs.existsSync(absolutePath), false, `${relativePath} should remain removed`);
  assert.equal(
    fs.existsSync(path.join(ROOT, 'client/src/components/Shared/AudioInput/AudioInput.tsx')),
    true,
    'Shared AudioInput should remain the canonical implementation path',
  );
});
