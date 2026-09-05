const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const SCRIPT_SOURCE = path.join(__dirname, 'generate-map-docs.mjs');

const makeFixture = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-map-docs-'));
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.copyFileSync(SCRIPT_SOURCE, path.join(root, 'scripts', 'generate-map-docs.mjs'));
  return root;
};

const runCheck = (root) =>
  spawnSync(process.execPath, ['scripts/generate-map-docs.mjs', '--check'], {
    cwd: root,
    encoding: 'utf8',
  });

test('map check tolerates a public release with all private map docs stripped', (t) => {
  const root = makeFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const result = runCheck(root);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /map documentation is not included in this release surface/i);
});

test('map check rejects a partially stripped map documentation set', (t) => {
  const root = makeFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'SurveyTool.MAP.md'), '# partial\n');

  const result = runCheck(root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /map documentation is incomplete/i);
  assert.match(result.stderr, /docs\/maps\/SurveyTool\.intro\.md/);
});
