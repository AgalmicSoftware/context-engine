'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readClientSecurityHeaders() {
  const source = fs.readFileSync(path.join(__dirname, '../../client/public/_headers'), 'utf8');
  const headers = {};
  let applies = false;
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) { applies = line.trim() === '/*'; continue; }
    if (!applies) continue;
    const separator = line.indexOf(':');
    assert.ok(separator > 0, `Invalid static header: ${line}`);
    headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
  }
  assert.ok(headers['content-security-policy'], 'The app must have an enforced CSP');
  return headers;
}

async function collectSecurityPolicyViolations(target) {
  const violations = [];
  await target.exposeBinding('__ceSmokeCspViolation', (_source, event) => { violations.push(event); });
  await target.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      void window.__ceSmokeCspViolation({
        documentURI: event.documentURI,
        blockedURI: event.blockedURI,
        effectiveDirective: event.effectiveDirective,
        disposition: event.disposition,
      });
    });
  });
  return violations;
}

async function installClientSecurityHeaders(target, baseUrl) {
  const appOrigin = new URL(baseUrl).origin;
  const headers = readClientSecurityHeaders();
  const violations = await collectSecurityPolicyViolations(target);
  // Exercise hosted chain discovery: loopback automatically opts into Anvil,
  // whose plain-HTTP endpoint intentionally falls outside the hosted policy.
  await target.addInitScript(() => { window.CE_INCLUDE_LOCAL_SESSION_REGISTRY = false; });
  // Preview does not serve _headers. Install last so fixture handlers still
  // receive every non-document request through fallback, including Worker APIs.
  await target.route('**/*', async (route) => {
    const request = route.request();
    if (request.resourceType() !== 'document' || new URL(request.url()).origin !== appOrigin) return route.fallback();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...headers } });
  });
  return violations;
}

async function verifyBlockedScriptInjection(browser, baseUrl) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const violations = await collectSecurityPolicyViolations(context);
    const headers = readClientSecurityHeaders();
    const appOrigin = new URL(baseUrl).origin;
    const externalScript = 'https://csp-negative.example.test/injected.js';
    await context.route('**/*', (route) => {
      const request = route.request();
      if (request.resourceType() === 'document' && new URL(request.url()).origin === appOrigin) {
        return route.fulfill({ headers: { ...headers, 'content-type': 'text/html' }, body: '<!doctype html><title>CSP negative fixture</title>' });
      }
      if (request.url() === externalScript) {
        return route.fulfill({ contentType: 'application/javascript', body: 'window.__ceExternalInjectionRan = true;' });
      }
      return route.abort();
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/__ce-csp-negative`);
    // DOM insertion is subject to CSP. addInitScript/evaluate code itself is
    // privileged browser automation and cannot prove that injection is blocked.
    await page.evaluate((src) => new Promise((resolve) => {
      const inline = document.createElement('script');
      inline.textContent = 'window.__ceInlineInjectionRan = true;';
      document.head.appendChild(inline);
      const external = document.createElement('script');
      external.src = src;
      external.onload = external.onerror = resolve;
      document.head.appendChild(external);
    }), externalScript);
    await page.waitForFunction(() => !document.querySelector('script[src]') || document.readyState === 'complete');
    const ran = await page.evaluate(() => [window.__ceInlineInjectionRan === true, window.__ceExternalInjectionRan === true]);
    assert.deepEqual(ran, [false, false], 'Inline and other-origin scripts must not execute');
    for (const blockedURI of ['inline', externalScript]) {
      assert.ok(violations.some((event) => event.blockedURI === blockedURI && event.disposition === 'enforce' && event.effectiveDirective === 'script-src-elem'),
        `Missing enforced script violation for ${blockedURI}: ${JSON.stringify(violations)}`);
    }
    assert.ok(violations.every((event) => ['inline', externalScript].includes(event.blockedURI) && event.effectiveDirective === 'script-src-elem'),
      `Unexpected CSP violation in injection fixture: ${JSON.stringify(violations)}`);
    return { inlineBlocked: true, externalBlocked: true };
  } finally {
    await context.close();
  }
}

module.exports = { readClientSecurityHeaders, installClientSecurityHeaders, verifyBlockedScriptInjection };
