#!/usr/bin/env node
'use strict';

const path = require('path');

const {
  addStep,
  buildTimestampedSlug,
  createBaseReport,
  parseArgs,
  readJson,
  relRoot,
  resolveArtifacts,
  resolveRunTag,
  ROOT,
  toStr,
  writeJson,
} = require('./lib/e2e/common');
const { assertAndRecord } = require('./lib/e2e/assertions');
const {
  ensureRealArweaveUploadsForManualFollowup,
} = require('./lib/e2e/arweave-mode');
const { resolveChainDefaults } = require('./lib/e2e/network-defaults');
const { isLegacyDefaultSessionSlug } = require('./lib/e2e/session-target');
const { runNodeScriptJsonLive } = require('./lib/e2e/node-runner');

const log = (...args) => console.log('[survey-gated-any-all]', ...args);
const toMs = (value, fallbackMs) => {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return fallbackMs;
};
const toBool = (value) => /^(1|true|yes|y)$/i.test(String(value || '').trim());

const resolveGatedDecryptTimeoutMs = (env = process.env) => {
  const gatedUiTimeoutMs = Math.max(
    60 * 1000,
    toMs(
      env.SURVEY_GATED_ANY_ALL_GATED_UI_TIMEOUT_MS || env.GATED_DECRYPT_UI_TIMEOUT_MS,
      40 * 60 * 1000,
    ),
  );
  const recommendedDecryptTimeoutMs = Math.max(20 * 60 * 1000, gatedUiTimeoutMs + (8 * 60 * 1000));
  const overrideRaw = Number.parseInt(String(env.SURVEY_GATED_DECRYPT_TIMEOUT_MS || '').trim(), 10);
  return Number.isFinite(overrideRaw) && overrideRaw > 0
    ? Math.max(60 * 1000, overrideRaw)
    : recommendedDecryptTimeoutMs;
};

async function main() {
  ensureRealArweaveUploadsForManualFollowup({
    env: process.env,
    contextLabel: 'survey-gated-decrypt:any-all',
  });

  const args = parseArgs(process.argv);
  const runTag = resolveRunTag(args);
  const baseUrl = toStr(args['base-url'] || process.env.BASE_URL || 'http://127.0.0.1:3000').trim().replace(/\/+$/, '');
  const chain = resolveChainDefaults({
    args: {
      ...args,
      'base-url': baseUrl,
    },
  });
  const argSessionSlug = toStr(args['session-slug']).trim();
  const envSessionSlug = toStr(process.env.SESSION_SLUG).trim();
  const workerUrl = toStr(process.env.WORKER_URL).trim();
  const forceFreshSessionSlug = toBool(
    process.env.SURVEY_GATED_ANY_ALL_FORCE_FRESH_SESSION_SLUG
      || process.env.FORCE_FRESH_SESSION_SLUG
      || '',
  );
  const explicitReuseEnvSessionSlug = toBool(
    process.env.SURVEY_GATED_ANY_ALL_REUSE_SESSION_SLUG
      || process.env.REUSE_SESSION_SLUG
      || '',
  );
  const reuseEnvSessionSlug = explicitReuseEnvSessionSlug || (
    !!envSessionSlug
      && !!workerUrl
      && !forceFreshSessionSlug
      && !isLegacyDefaultSessionSlug(envSessionSlug)
  );
  const generatedGateSlug = buildTimestampedSlug({ prefix: 'e2e-survey-anyall', runTag });
  const gateSlug = argSessionSlug || (reuseEnvSessionSlug ? envSessionSlug : generatedGateSlug);
  const gateAnyAllTimeoutMs = Math.max(60 * 1000, toMs(process.env.SURVEY_GATE_ANY_ALL_TIMEOUT_MS, 12 * 60 * 1000));
  const gatedDecryptTimeoutMs = resolveGatedDecryptTimeoutMs(process.env);

  const artifacts = resolveArtifacts({ runTag, baseName: 'survey-gated-decrypt-any-all' });
  log('starting', {
    runTag,
    baseUrl,
    chainId: chain.chainId,
    sessionSlug: gateSlug,
    sessionSlugSource: argSessionSlug ? 'arg' : (reuseEnvSessionSlug && envSessionSlug ? 'env' : 'generated'),
  });
  const report = createBaseReport({
    flowId: 'CE-E2E-SURVEY-MULTI-GATE-ANY-ALL',
    runner: path.basename(__filename),
    runTag,
    chain: { mode: chain.chainMode, chainId: chain.chainId, rpcUrl: chain.rpcUrl },
    inputs: { baseUrl, sessionSlug: gateSlug },
    contracts: { sessionRegistry: chain.sessionRegistry, sbtFactory: chain.sbtFactory },
    outputs: {
      json: relRoot(artifacts.json),
      screenshot: relRoot(artifacts.png),
      errorScreenshot: relRoot(artifacts.errorPng),
    },
  });

  writeJson(artifacts.json, report);

  addStep(report, { phase: 'subrun', name: 'gate-any-all', slug: gateSlug });
  log('running substep: gate-any-all', { gateSlug, timeoutMs: gateAnyAllTimeoutMs });
  const gateResExec = await runNodeScriptJsonLive({
    script: 'scripts/test-session-gates-any-all.js',
    env: {
      ...process.env,
      BASE_URL: baseUrl,
      CHAIN_ID: String(chain.chainId),
      RPC_URL: chain.rpcUrl,
      SESSION_REGISTRY: chain.sessionRegistry,
      SBT_FACTORY: chain.sbtFactory,
      SESSION_SLUG: gateSlug,
    },
    streamPrefix: 'gate-any-all',
    heartbeatLabel: 'gate-any-all',
    heartbeatMs: 20 * 1000,
    timeoutMs: gateAnyAllTimeoutMs,
  });
  const gateOut = gateResExec.json;
  assertAndRecord(report, {
    name: 'gate-any-all subrunner succeeded',
    ok: !!gateOut?.ok,
    expected: { ok: true },
    got: gateOut || { stdout: gateResExec.stdout.slice(0, 3000) },
  });

  const gateReportPath = gateOut?.outPath ? path.join(ROOT, String(gateOut.outPath)) : '';
  const gateReport = gateReportPath ? readJson(gateReportPath, null) : null;
  const gateTests = Array.isArray(gateReport?.tests) ? gateReport.tests : [];

  const orHolderB = gateTests.find((t) => /OR gate.*walletB/i.test(String(t?.name || '')));
  const orHolderC = gateTests.find((t) => /OR gate.*walletC/i.test(String(t?.name || '')));
  const orHolderBoth = gateTests.find((t) => /OR gate.*walletA/i.test(String(t?.name || '')));
  const andHolderB = gateTests.find((t) => /AND gate.*walletB/i.test(String(t?.name || '')));
  const andHolderC = gateTests.find((t) => /AND gate.*walletC/i.test(String(t?.name || '')));
  const andHolderBoth = gateTests.find((t) => /AND gate.*walletA/i.test(String(t?.name || '')));

  assertAndRecord(report, {
    name: 'Any gate: walletB single-gate holder allowed (1-of-2)',
    ok: !!orHolderB?.result?.ok,
    expected: { ok: true },
    got: orHolderB || null,
  });
  assertAndRecord(report, {
    name: 'Any gate: walletC single-gate holder allowed (1-of-2)',
    ok: !!orHolderC?.result?.ok,
    expected: { ok: true },
    got: orHolderC || null,
  });
  assertAndRecord(report, {
    name: 'Any gate: holder-both allowed (2-of-2)',
    ok: !!orHolderBoth?.result?.ok,
    expected: { ok: true },
    got: orHolderBoth || null,
  });
  assertAndRecord(report, {
    name: 'All gate: walletB single-gate holder denied (needs 2-of-2)',
    ok: andHolderB?.result?.ok === false && Number(andHolderB?.result?.status) === 403,
    expected: { ok: false, status: 403 },
    got: andHolderB || null,
  });
  assertAndRecord(report, {
    name: 'All gate: walletC single-gate holder denied (needs 2-of-2)',
    ok: andHolderC?.result?.ok === false && Number(andHolderC?.result?.status) === 403,
    expected: { ok: false, status: 403 },
    got: andHolderC || null,
  });
  assertAndRecord(report, {
    name: 'All gate: holder-both allowed (2-of-2)',
    ok: andHolderBoth?.result?.ok === true,
    expected: { ok: true },
    got: andHolderBoth || null,
  });

  addStep(report, { phase: 'subrun', name: 'gated-decrypt-all-types' });
  log('running substep: gated-decrypt-all-types', { gateSlug, timeoutMs: gatedDecryptTimeoutMs });
  const decryptExec = await runNodeScriptJsonLive({
    script: 'scripts/test-session-gated-decrypt-all-types.js',
    env: {
      ...process.env,
      AI_RUN_TAG: `${runTag}-anyall`,
      BASE_URL: baseUrl,
      CHAIN_ID: String(chain.chainId),
      RPC_URL: chain.rpcUrl,
      SESSION_REGISTRY: chain.sessionRegistry,
      SBT_FACTORY: chain.sbtFactory,
      SESSION_SLUG: gateSlug,
    },
    streamPrefix: 'gated-decrypt-all-types',
    heartbeatLabel: 'gated-decrypt-all-types',
    heartbeatMs: 20 * 1000,
    timeoutMs: gatedDecryptTimeoutMs,
  });
  const decryptOut = decryptExec.json;
  assertAndRecord(report, {
    name: 'gated-decrypt-all-types subrunner succeeded',
    ok: !!decryptOut?.ok,
    expected: { ok: true },
    got: decryptOut || { stdout: decryptExec.stdout.slice(0, 3000) },
  });

  const decryptReportPath = decryptOut?.outJson ? path.join(ROOT, String(decryptOut.outJson)) : '';
  const decryptReport = decryptReportPath ? readJson(decryptReportPath, null) : null;
  const decryptAssertions = Array.isArray(decryptReport?.assertions) ? decryptReport.assertions : [];
  const responses = Array.isArray(decryptReport?.responses) ? decryptReport.responses : [];

  const aiScopeAssertion = decryptAssertions.find((a) => /ai gated to SBT holder only/i.test(String(a?.name || '')));
  const arweaveAssertion = decryptAssertions.find((a) => /arweave open/i.test(String(a?.name || '')));
  const aiDenyAssertion = decryptAssertions.find((a) => /\/ai denied for non-holder/i.test(String(a?.name || '')));
  const walletBMaskedSubmitAssertion = decryptAssertions.find((a) => /walletB cannot submit while prompt is masked/i.test(String(a?.name || '')));
  const walletBLoadingSubmitAssertion = decryptAssertions.find((a) => /walletB cannot submit while gated question remains loading/i.test(String(a?.name || '')));

  assertAndRecord(report, {
    name: 'gated decrypt: ai scope remains holder-only',
    ok: !!aiScopeAssertion?.ok,
    expected: { ok: true },
    got: aiScopeAssertion || null,
  });
  assertAndRecord(report, {
    name: 'gated decrypt: arweave remains open for upload',
    ok: !!arweaveAssertion?.ok,
    expected: { ok: true },
    got: arweaveAssertion || null,
  });
  assertAndRecord(report, {
    name: 'gated decrypt: non-holder denied by worker /ai',
    ok: !!aiDenyAssertion?.ok,
    expected: { ok: true },
    got: aiDenyAssertion || null,
  });
  assertAndRecord(report, {
    name: 'gated decrypt: non-holder cannot submit gated question',
    ok: !!walletBMaskedSubmitAssertion?.ok || !!walletBLoadingSubmitAssertion?.ok,
    expected: { ok: true },
    got: walletBMaskedSubmitAssertion || walletBLoadingSubmitAssertion || null,
  });
  assertAndRecord(report, {
    name: 'gated decrypt: at least one response submission executed',
    ok: responses.length > 0,
    expected: { minResponses: 1 },
    got: { responseCount: responses.length },
  });

  report.outputs.subruns = {
    gateAnyAll: {
      summary: gateOut,
      reportFile: gateReportPath ? relRoot(gateReportPath) : null,
    },
    decrypt: {
      summary: decryptOut,
      reportFile: decryptReportPath ? relRoot(decryptReportPath) : null,
    },
  };
  writeJson(artifacts.json, report);
  log('subruns complete', {
    gateReportFile: report.outputs.subruns.gateAnyAll.reportFile,
    decryptReportFile: report.outputs.subruns.decrypt.reportFile,
  });

  log('running substep: any-all ui checkpoint');
  await runNodeScriptJsonLive({
    script: 'scripts/test-survey-gated-decrypt-any-all.ui.js',
    env: {
      ...process.env,
      REPORT_PATH: artifacts.json,
      OUT_PNG: artifacts.png,
      OUT_ERROR_PNG: artifacts.errorPng,
      BASE_URL: baseUrl,
      UI_PATH: `/session/${encodeURIComponent(gateSlug)}`,
      ASSERT_TESTIDS: JSON.stringify(['ce-survey-create-toggle-pile']),
      ASSERT_TEXTS: JSON.stringify([]),
    },
    streamPrefix: 'survey-gated-any-all-ui',
    heartbeatLabel: 'survey-gated-any-all-ui',
    heartbeatMs: 20 * 1000,
    timeoutMs: 10 * 60 * 1000,
  });

  const final = readJson(artifacts.json, report) || report;
  writeJson(artifacts.json, final);
  log('completed', { outJson: relRoot(artifacts.json), outPng: relRoot(artifacts.png) });

  console.log(JSON.stringify({ ok: true, flowId: report.flowId, outJson: relRoot(artifacts.json), outPng: relRoot(artifacts.png) }, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err?.stack || err?.message || String(err));
    process.exit(1);
  });
}

module.exports = {
  resolveGatedDecryptTimeoutMs,
};
