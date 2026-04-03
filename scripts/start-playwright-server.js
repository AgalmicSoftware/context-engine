#!/usr/bin/env node
'use strict';

/*
Starts a single Chromium instance via Playwright's launchServer() and prints the WS endpoint.

Use case: keep one browser process alive and have multiple E2E runners connect via
PLAYWRIGHT_WS_ENDPOINT to avoid repeated Chromium launches (which can crash under host
memory pressure).

Stop with Ctrl+C.
*/

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  launchChromiumServerWithRetry,
  requirePlaywright,
  resolvePlaywrightExecutablePath,
} = require('./lib/e2e/playwright');

const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));

const writeIfRequested = (wsEndpoint) => {
  const outPath = toStr(process.env.PLAYWRIGHT_WS_ENDPOINT_PATH).trim();
  if (!outPath) return null;
  const abs = path.isAbsolute(outPath) ? outPath : path.join(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${wsEndpoint}\n`, 'utf8');
  return abs;
};

async function main() {
  // Prefer broad fallback + isolated home for server mode. This reduces "cannot write to $HOME"
  // issues inside workspace-write sandboxes, and gives Chromium a chance to pick a smaller binary.
  if (!toStr(process.env.PLAYWRIGHT_ALLOW_FALLBACK).trim()) {
    process.env.PLAYWRIGHT_ALLOW_FALLBACK = '1';
  }
  if (!toStr(process.env.PLAYWRIGHT_BROWSER_HOME).trim()) {
    process.env.PLAYWRIGHT_BROWSER_HOME = path.join(os.tmpdir(), `ce-playwright-home-server-${Date.now()}`);
  }

  const { chromium } = requirePlaywright();
  const executablePath = toStr(process.env.PLAYWRIGHT_EXECUTABLE_PATH).trim() || resolvePlaywrightExecutablePath();
  const server = await launchChromiumServerWithRetry({ chromium, executablePath: executablePath || undefined });

  const wsEndpoint = server.wsEndpoint();
  const wrotePath = writeIfRequested(wsEndpoint);

  console.log(`[playwright-server] wsEndpoint: ${wsEndpoint}`);
  if (wrotePath) {
    console.log(`[playwright-server] wrote PLAYWRIGHT_WS_ENDPOINT to ${wrotePath}`);
  }
  console.log('[playwright-server] export PLAYWRIGHT_WS_ENDPOINT to reuse this browser across E2E runs.');

  let stopping = false;
  const stop = async (signal) => {
    if (stopping) return;
    stopping = true;
    console.log(`[playwright-server] received ${signal}; closing...`);
    await server.close().catch(() => null);
    process.exit(0);
  };

  ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((sig) => {
    try {
      process.on(sig, () => void stop(sig));
    } catch (_) {}
  });

  // Keep process alive until signalled.
  // eslint-disable-next-line no-promise-executor-return
  await new Promise(() => {});
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
