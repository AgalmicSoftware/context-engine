#!/usr/bin/env node

/*
Replay the UI portion of the doc-library session filetypes test from an existing
report JSON. Useful when the chain setup completed but the Playwright/UI phase
failed or was interrupted.

Usage:
  node scripts/run-doc-library-session-filetypes-ui-from-report.js <report-json>

Env (optional):
  OUT_PNG: override screenshot output path
  BASE_URL / SESSION_SLUG: override navigation target (defaults from report)

Note: This script is safe to run repeatedly; it only exercises the UI.
*/

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { derivePrivateKeyFromPasskeyRawId } = require('./lib/porto-wallet-derivation.js');

const ROOT = path.resolve(__dirname, '..');

async function main() {
  const arg = String(process.argv[2] || '').trim();
  const reportPathInput = arg || String(process.env.REPORT_PATH || '').trim();
  if (!reportPathInput) {
    throw new Error('Missing report path. Provide argv[2] or REPORT_PATH.');
  }

  const reportPath = path.isAbsolute(reportPathInput)
    ? reportPathInput
    : path.resolve(process.cwd(), reportPathInput);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

  const passkeyA = report?.wallets?.A?.passkeyRawIdB64Url || '';
  const passkeyB = report?.wallets?.B?.passkeyRawIdB64Url || '';
  const addressA = report?.wallets?.A?.address || '';
  const addressB = report?.wallets?.B?.address || '';
  if (!passkeyA || !passkeyB || !addressA || !addressB) {
    throw new Error('Report JSON missing wallets A/B fields.');
  }

  const portoA = {
    credentialId: passkeyA,
    address: addressA,
    privateKey: derivePrivateKeyFromPasskeyRawId(passkeyA),
  };
  const portoB = {
    credentialId: passkeyB,
    address: addressB,
    privateKey: derivePrivateKeyFromPasskeyRawId(passkeyB),
  };

  const baseUrl = String(process.env.BASE_URL || report?.baseUrl || 'http://127.0.0.1:3000').replace(/\/+$/, '');
  const sessionSlug = String(process.env.SESSION_SLUG || report?.sessionSlug || '').trim();
  if (!sessionSlug) throw new Error('SESSION_SLUG resolved empty.');

  const outPngRelOrAbs = String(process.env.OUT_PNG || report?.outputs?.screenshot || '').trim();
  if (!outPngRelOrAbs) throw new Error('OUT_PNG is required (set env or ensure report.outputs.screenshot exists).');
  const outPng = path.isAbsolute(outPngRelOrAbs) ? outPngRelOrAbs : path.resolve(process.cwd(), outPngRelOrAbs);

  const uiScript = path.join(ROOT, 'scripts', 'test-doc-library-session-filetypes.ui.js');

  const env = {
    ...process.env,
    REPORT_PATH: reportPath,
    OUT_PNG: outPng,
    BASE_URL: baseUrl,
    SESSION_SLUG: sessionSlug,
    PORTO_A: JSON.stringify(portoA),
    PORTO_B: JSON.stringify(portoB),
  };

  const child = spawn('node', [uiScript], { cwd: ROOT, env, stdio: 'inherit' });
  child.on('exit', (code) => process.exit(typeof code === 'number' ? code : 1));
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
