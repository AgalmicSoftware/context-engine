'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CLIENT_SRC = path.join(ROOT, 'client/src');
const ADJACENT_TS_REEXPORT_RE = /from ['"]\.\/[^'"]+\.ts['"]/;
const PURE_TS_REEXPORT_LINE_RE = /^export (?:\*|\{\s*default\s*\}) from ['"]\.\/[^'"]+\.ts['"];\s*$/;

const EXPECTED_COMPONENT_SHIM_CLUSTERS = Object.freeze({
  'client/src/components/MainSite': Object.freeze([
    'cacheConstants.js',
    'debugTelemetry.js',
    'litSessionConfig.js',
    'mainSiteUtils.js',
    'progressHelpers.js',
    'reloadWindowLocation.js',
    'routeConfig.js',
    'routeLazyComponents.js',
    'routeStyles.js',
    'storageEviction.js',
    'urlUtils.js',
  ]),
  'client/src/components/SBTs': Object.freeze([
    'sbtSelectorSessionResolution.js',
    'sbtSessionUniverse.js',
  ]),
  'client/src/components/Sessions': Object.freeze([
    'cloudflareTokenTemplate.js',
    'sessionWizardContracts.js',
    'sessionWizardDraftCache.js',
  ]),
  'client/src/components/SurveyTool': Object.freeze([
    'surveyToolCacheState.js',
    'surveyToolDraftState.js',
    'surveyToolNavigation.js',
    'surveyToolResponseMerge.js',
    'surveyToolResponseState.js',
    'surveyToolRuntimeSupport.js',
    'surveyToolScope.js',
    'surveyToolSignatures.js',
    'surveyToolSliderState.js',
    'surveyToolSlugLookup.js',
    'surveyToolViewState.js',
  ]),
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

test('active component shim clusters stay explicitly inventoried during sequencing', () => {
  Object.entries(EXPECTED_COMPONENT_SHIM_CLUSTERS).forEach(([relativeDir, expectedEntries]) => {
    const actualEntries = readPureTsReexportShims(relativeDir);
    const expectedSorted = [...expectedEntries].sort();

    assert.deepEqual(
      actualEntries,
      expectedSorted,
      `${relativeDir} shim inventory changed; update cleanup tracking before adding or removing wrappers`,
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
