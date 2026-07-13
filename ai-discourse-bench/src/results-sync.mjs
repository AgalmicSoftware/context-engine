import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sha256 } from './provenance.mjs';

export const RESULTS_SYNC_SOURCE_FILES = Object.freeze([
  'client/src/components/OnePageSession/OnePageSessionStandardShell.tsx',
  'client/src/components/OnePageSession/OnePageSession.tsx',
  'client/src/components/OnePageSession/OnePageSession.module.scss',
  'client/src/components/PolisReport/PolisReport.tsx',
  'client/src/components/PolisReport/PolisReport.module.scss',
  'client/src/components/DebateMap/DebateMap.tsx',
  'client/src/components/DebateMap/DebateMap.module.scss',
  'client/src/components/MainContent/RiskMatrix.tsx',
  'client/src/components/MainContent/RiskMatrix.module.scss',
  'client/src/components/DemoViews/DemoAnalysis/DemoAnalysisWorkspace.tsx',
  'client/src/components/DemoViews/DemoAnalysis/DemoAnalysisWorkspace.module.scss',
  'client/src/components/DemoViews/DemoAnalysis/WorldResultsMap.tsx',
  'client/src/components/SurveyTool/SurveyResults.module.scss',
]);

export const defaultSyncPaths = () => {
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  return {
    packageRoot,
    contextEngineRoot: path.resolve(packageRoot, '..'),
    manifestPath: path.join(packageRoot, 'data', 'context-engine-results-sync.json'),
  };
};

const readCommit = (contextEngineRoot) => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: contextEngineRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
};

export const buildResultsSyncSnapshot = async (contextEngineRoot) => ({
  schemaVersion: 1,
  kind: 'ai_discourse_bench_context_engine_results_sync',
  sourceCommit: readCommit(contextEngineRoot),
  files: Object.fromEntries(await Promise.all(RESULTS_SYNC_SOURCE_FILES.map(async (relativePath) => {
    try {
      const content = await fs.readFile(path.join(contextEngineRoot, relativePath));
      return [relativePath, sha256(content)];
    } catch (error) {
      if (error?.code === 'ENOENT') return [relativePath, null];
      throw error;
    }
  }))),
});

export const compareResultsSyncSnapshot = (expected, actual) => {
  const expectedFiles = expected?.files || {};
  const actualFiles = actual?.files || {};
  const paths = Array.from(new Set([...Object.keys(expectedFiles), ...Object.keys(actualFiles)])).sort();
  return paths.flatMap((relativePath) => (
    expectedFiles[relativePath] === actualFiles[relativePath]
      ? []
      : [{
        path: relativePath,
        expected: expectedFiles[relativePath] || null,
        actual: actualFiles[relativePath] || null,
      }]
  ));
};
