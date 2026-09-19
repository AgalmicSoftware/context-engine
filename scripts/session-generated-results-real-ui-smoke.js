'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3100';
const OUTPUT = path.resolve('artifacts/session-generated-results-smoke/screenshots');
const SESSION_SLUG = 'synthetic-generated-results-smoke';
const SESSION_ID = '0x11111111111111111111111111111111';

const html = String.raw`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Generated Results Real UI Smoke</title><script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script><script type="module" src="/@vite/client"></script></head><body><div id="root"></div><script type="module" src="/src/test-smoke/generatedResultsSmokeEntry.tsx?real-session-shell=4"></script></body></html>`;

const settings = {
  version: 1,
  generationMode: 'manual',
  views: { circles: true, breakdown: true, riskMatrix: true },
  autoAfter: { threshold: 10, unit: 'distinctParticipants' },
  inputScope: 'submitted',
  publication: 'latest_success_visible',
};

const questions = [
  { id: 'q1', prompt: 'Which safeguards matter most for open AI systems?', type: 'text', options: ['Independent review', 'Open release'], tags: ['governance'] },
  { id: 'q2', prompt: 'How should release decisions weigh misuse risk?', type: 'text', options: ['Delay', 'Publish'], tags: ['risk'] },
  { id: 'q3', prompt: 'What would make generated session results trustworthy?', type: 'text', options: ['Source coverage', 'Speed'], tags: ['trust'] },
];

const responses = [
  { questionId: 'q1', participantId: 'synthetic-a', answer: 'Independent review', additional: 'Synthetic fixture response.' },
  { questionId: 'q2', participantId: 'synthetic-b', answer: 'Delay', additional: 'Synthetic fixture response.' },
  { questionId: 'q3', participantId: 'synthetic-c', answer: 'Source coverage', additional: 'Synthetic fixture response.' },
];

const artifact = {
  kind: 'ce_session_results_analysis_artifact',
  source: 'ai-generated',
  version: 1,
  generatedAt: '2026-09-19T10:00:00.000Z',
  inputSignature: 'synthetic-real-ui-smoke',
  model: 'synthetic-fixture',
  participants: [],
  sections: {
    argumentMap: {
      available: true,
      debates: [
        {
          id: 'release-governance',
          title: 'Release governance',
          claims: [
            { id: 'review', claim: 'Independent review before release', summary: 'Synthetic submitted evidence favors review before open publication.' },
            { id: 'delay', claim: 'Delay high-risk publication', summary: 'Participants support withholding details when misuse risk is concrete.' },
          ],
        },
        {
          id: 'source-trust',
          title: 'Source trust',
          claims: [
            { id: 'coverage', claim: 'Show source coverage for generated views', summary: 'Participants ask for available, included, excluded, and locked row counts.' },
            { id: 'reload', claim: 'Reload latest successful analysis for viewers', summary: 'Viewers should see the latest published artifact without admin signing.' },
          ],
        },
      ],
    },
    atlas: {
      available: true,
      nodes: [
        { id: 'root', label: 'Generated results governance', summary: 'Synthetic root node.' },
        { id: 'review', label: 'Independent review', summary: 'Review reduces publication risk.' },
      ],
      edges: [{ source: 'root', target: 'review' }],
    },
    breakdown: {
      available: true,
      summary: {
        overview: 'Synthetic generated interpretation from a frozen submitted snapshot.',
        themes: [
          { id: 'safety', label: 'Safety-first reviewers', summary: 'Prefer independent review and cautious publication.', sourceRefs: ['q1'] },
          { id: 'transparency', label: 'Transparency advocates', summary: 'Want aggregate evidence available to session members.', sourceRefs: ['q2'] },
        ],
      },
      dimensions: [{ id: 'publication', label: 'Publication posture', summary: 'Caution rises with misuse likelihood.' }],
      groups: [{ id: 'operators', label: 'Operational pragmatists', summary: 'Support latest-success publishing once source counts are clear.' }],
    },
    riskMatrix: {
      available: true,
      categories: [
        { id: 'misuse', label: 'Misuse', subcategories: ['Release', 'Monitoring'], likelihood: 'high', impact: 'high', summary: 'Dual-use release without review.', valence: 'risk' },
        { id: 'accountability', label: 'Accountability', subcategories: ['Evidence'], likelihood: 'medium', impact: 'high', summary: 'Session-authorized latest-success views improve accountability.', valence: 'opportunity' },
      ],
      heatmap: { misuse: { likelihood: 'high', impact: 'high' }, accountability: { likelihood: 'medium', impact: 'high' } },
      comments: [],
      scenarioLinks: [],
      axes: {
        x: { id: 'likelihood', label: 'Misuse likelihood', levels: [{ id: 'low', label: 'Low' }, { id: 'high', label: 'High' }] },
        y: { id: 'impact', label: 'Publication impact', levels: [{ id: 'medium', label: 'Medium' }, { id: 'high', label: 'High' }] },
      },
      assessments: [
        { id: 'misuse-release', category: 'Misuse release', summary: 'Dual-use release without review.', xLevelId: 'high', yLevelId: 'high', valence: 'risk', sourceRefs: ['q1'] },
        { id: 'accountability-view', category: 'Accountability view', summary: 'Latest-success visibility improves accountability.', xLevelId: 'low', yLevelId: 'medium', valence: 'opportunity', sourceRefs: ['q2'] },
      ],
    },
  },
};

const refreshedArtifact = JSON.parse(JSON.stringify(artifact));
refreshedArtifact.generatedAt = '2026-09-19T10:05:00.000Z';
refreshedArtifact.inputSignature = 'synthetic-real-ui-smoke-refreshed';
refreshedArtifact.sections.riskMatrix.categories[0].label = 'Post-refresh misuse';
refreshedArtifact.sections.riskMatrix.categories[0].summary = 'Successful refresh published a newer risk assessment.';
refreshedArtifact.sections.riskMatrix.assessments[0].category = 'Post-refresh misuse release';
refreshedArtifact.sections.riskMatrix.assessments[0].summary = 'Successful refresh published a newer risk assessment.';
refreshedArtifact.sections.breakdown.summary.overview = 'Synthetic refreshed interpretation from the latest submitted snapshot.';

let publishedArtifact = artifact;

const buildLastGood = () => ({
  draftId: publishedArtifact === refreshedArtifact ? 'synthetic-refreshed-artifact' : 'synthetic-visible-artifact',
  generatedAt: '2026-09-19T10:00:00.000Z',
  requestId: 'synthetic-request',
  trigger: 'manual',
  source: {
    kind: 'worker-canonical',
    signature: 'synthetic-source',
    responseCount: 3,
    participantCount: 3,
    excludedCount: 0,
    lockedCount: 0,
    aiInputResponseCount: 3,
    aiInputQuestionCount: 2,
    totalQuestionCount: 3,
  },
  artifact: publishedArtifact,
  snapshot: { sessionSlug: SESSION_SLUG, sessionId: SESSION_ID, questions, responses },
});

function statusBody({ adminAuthorized = true, jobState = 'succeeded', lastFailure = null } = {}) {
  return {
    ok: true,
    viewerAuthorized: true,
    sessionSlug: SESSION_SLUG,
    sessionId: SESSION_ID,
    settings,
    capability: {
      manual: { supported: adminAuthorized, sourceKinds: ['worker-canonical'], reason: adminAuthorized ? '' : 'Authenticate with the session Worker.' },
      automatic: { supported: true, sourceKinds: ['worker-canonical'] },
    },
    state: { jobState, active: jobState === 'running' ? { requestId: 'synthetic-refresh' } : null, lastFailure, lastGood: buildLastGood() },
  };
}

async function installRoutes(page) {
  let statusMode = 'ready';
  let generateCount = 0;
  await page.route('**/src/components/SurveyTool/SurveyPage.tsx*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `import React from '/node_modules/.vite/deps/react.js';
export default function SurveyPage(props) {
  const mode = props && props.miniMode ? 'full' : 'pile';
  return React.createElement('section', { 'data-testid': 'ce-smoke-survey-page', 'data-mode': mode },
    React.createElement('button', { type: 'button', onClick: () => props?.onViewAllClick?.() }, 'View All Questions'));
}
`,
  }));
  await page.route('**/src/components/OnePageSession/GroupsSection.tsx*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `import React from '/node_modules/.vite/deps/react.js';
export default function GroupsSection() {
  return React.createElement('section', { 'data-testid': 'ce-smoke-groups-section' }, 'Synthetic groups shell');
}
`,
  }));
  await page.route('**/generated-results-smoke*', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
  await page.route('https://worker.example/auth/nonce', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, nonce: 'synthetic-worker-nonce', sessionSlug: SESSION_SLUG, sessionId: SESSION_ID }),
    });
  });
  await page.route('https://worker.example/auth/login', async (route) => {
    const payload = JSON.parse(route.request().postData() || '{}');
    assert.equal(payload.sessionSlug, SESSION_SLUG);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        token: 'synthetic-viewer-token',
        exp: Math.floor(Date.now() / 1000) + 3600,
        sessionSlug: SESSION_SLUG,
        sessionId: SESSION_ID,
      }),
    });
  });
  await page.route('https://worker.example/results-analysis/artifact?*', async (route) => {
    const headers = route.request().headers();
    if (headers.authorization) assert.equal(headers.authorization, 'Bearer synthetic-viewer-token');
    if (headers['x-group-slug']) assert.equal(headers['x-group-slug'], SESSION_SLUG);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      ok: true,
      sessionSlug: SESSION_SLUG,
      sessionId: SESSION_ID,
      artifact: publishedArtifact,
      snapshot: { sessionSlug: SESSION_SLUG, sessionId: SESSION_ID, questions, responses },
      source: buildLastGood().source,
      generatedAt: buildLastGood().generatedAt,
    }) });
  });
  await page.route('https://worker.example/admin/results-analysis/status?*', async (route) => {
    const headers = route.request().headers();
    assert.equal(headers.authorization, 'Bearer synthetic-viewer-token');
    assert.equal(headers['x-group-slug'], SESSION_SLUG);
    if (statusMode === 'authPending') {
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ ok: false, authPending: true, error: 'Authenticate with the session Worker.' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(statusBody()) });
  });
  await page.route('https://worker.example/admin/results-analysis/generate', async (route) => {
    const payload = JSON.parse(route.request().postData() || '{}');
    assert.equal(payload.sessionSlug, SESSION_SLUG);
    assert.equal(payload.action, 'results-analysis/generate');
    assert.deepEqual(payload.sections, ['circles', 'breakdown', 'riskMatrix']);
    generateCount += 1;
    if (generateCount === 1) {
      publishedArtifact = refreshedArtifact;
    }
    if (generateCount === 2) {
      await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'AI provider timeout.' }) });
      return;
    }
    statusMode = generateCount === 3 ? 'authPending' : 'ready';
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ ok: true, jobState: 'running', capability: statusBody().capability, reservation: { requestId: `synthetic-refresh-${generateCount}` } }) });
  });
}

async function capture(page, name, viewport) {
  await page.screenshot({ path: path.join(OUTPUT, `${viewport.width}-${name}.png`), fullPage: true });
}

async function getCircleNodeForLabel(page, label) {
  const marker = `data-smoke-circle-node-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const foundInteractiveNode = await page.evaluate(
    ({ attributeName, expectedLabel }) => {
      const nodes = Array.from(document.querySelectorAll('[data-ce-node-layout="packed"]'));
      const target = nodes.find((node) => (node.textContent || '').includes(expectedLabel));
      if (!(target instanceof HTMLElement)) return false;
      target.setAttribute(attributeName, 'true');
      return true;
    },
    { attributeName: marker, expectedLabel: label },
  );
  assert.ok(foundInteractiveNode, `expected ${label} to be inside an interactive circle node`);
  const node = page.locator(`[${marker}="true"]`).first();
  await node.waitFor({ state: 'visible', timeout: 20000 });
  return node;
}

async function closeDebateMapDetailIfOpen(page) {
  const closeButton = page.getByRole('button', { name: 'Close', exact: true }).first();
  if ((await closeButton.count()) === 0) return;
  if (await closeButton.isVisible()) {
    await closeButton.click();
  }
}

async function assertRiskMatrixDetailInsideScrollBounds(page, scrollTarget) {
  const detailText = page.getByText('Dual-use release without review.', { exact: true }).first();
  await detailText.waitFor({ state: 'visible', timeout: 20000 });
  const detailBox = await detailText.boundingBox();
  const scrollBox = await scrollTarget.boundingBox();
  assert.ok(detailBox, 'mobile Risk Matrix detail paragraph should be measurable');
  assert.ok(scrollBox, 'mobile Risk Matrix scroll container should be measurable for detail bounds');
  assert.ok(
    detailBox.x + 0.5 >= scrollBox.x,
    `mobile Risk Matrix detail should not be clipped at the scroll container leading edge: ${JSON.stringify({ detailBox, scrollBox })}`,
  );
  assert.ok(
    detailBox.x + detailBox.width <= scrollBox.x + scrollBox.width + 0.5,
    `mobile Risk Matrix detail should not be clipped at the scroll container trailing edge: ${JSON.stringify({ detailBox, scrollBox })}`,
  );
}

async function captureMobileRiskMatrixAccess(page, viewport) {
  if (viewport.width > 480) return;

  const targetSelector = 'data-smoke-risk-scroll-target';
  const foundScrollableRiskGrid = await page.evaluate((attributeName) => {
    const candidates = Array.from(document.querySelectorAll('*')).filter((node) => node instanceof HTMLElement);
    const scored = candidates
      .map((node) => {
        const text = node.textContent || '';
        const className = typeof node.className === 'string' ? node.className : '';
        const id = node.id || '';
        const testId = node.getAttribute('data-testid') || '';
        const riskTextScore = /Misuse|Publication impact|likelihood|risk|matrix|Release|Monitoring/i.test(text) ? 1 : 0;
        const identityScore = /risk|matrix|heat|grid/i.test(`${className} ${id} ${testId}`) ? 2 : 0;
        const overflowScore = node.scrollWidth > node.clientWidth + 24 && node.clientWidth >= 180 && node.clientHeight >= 80 ? 4 : 0;
        return { node, score: overflowScore + identityScore + riskTextScore };
      })
      .filter(({ score, node }) => score >= 5 && node.scrollWidth > node.clientWidth + 24)
      .sort((left, right) => right.score - left.score || (right.node.scrollWidth - right.node.clientWidth) - (left.node.scrollWidth - left.node.clientWidth));
    const target = scored[0]?.node;
    if (!target) return false;
    target.setAttribute(attributeName, 'true');
    target.scrollLeft = 0;
    return true;
  }, targetSelector);

  assert.ok(foundScrollableRiskGrid, 'mobile Risk Matrix should expose a horizontal scroll container');
  const scrollTarget = page.locator(`[${targetSelector}="true"]`).first();
  const box = await scrollTarget.boundingBox();
  assert.ok(box, 'mobile Risk Matrix scroll target should be visible');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(700, 0);
  const didScroll = await scrollTarget.evaluate((node) => {
    if (!(node instanceof HTMLElement)) return false;
    if (node.scrollLeft <= 0) node.scrollLeft = node.scrollWidth;
    return node.scrollLeft > 0 && node.scrollWidth > node.clientWidth;
  });
  assert.ok(didScroll, 'mobile Risk Matrix should scroll horizontally to offscreen cells');
  await capture(page, 'risk-matrix-mobile-scrolled', viewport);

  const detailTarget = page.getByRole('button', { name: /Misuse release/i }).first();
  await detailTarget.click();
  await assertVisibleText(page, 'Dual-use release without review');
  await assertRiskMatrixDetailInsideScrollBounds(page, scrollTarget);
  await capture(page, 'risk-matrix-mobile-details', viewport);
}

async function assertVisibleText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout: 20000 });
}

async function assertDesktopReportButtonInsideResultsScroller(page, viewport) {
  if (viewport.width < 1000) return;

  const nav = page.getByTestId('ce-session-results-view-nav');
  const reportButton = nav.getByRole('button', { name: 'Report', exact: true }).first();
  await reportButton.waitFor({ state: 'visible', timeout: 20000 });
  const geometry = await reportButton.evaluate((button) => {
    if (!(button instanceof HTMLElement)) return null;
    let scroller = button.parentElement;
    while (scroller) {
      const style = window.getComputedStyle(scroller);
      const scrollsHorizontally = /(auto|scroll|overlay)/.test(style.overflowX) || scroller.scrollWidth > scroller.clientWidth + 1;
      if (scrollsHorizontally) break;
      scroller = scroller.parentElement;
    }
    if (!(scroller instanceof HTMLElement)) return null;
    const scrollerRect = scroller.getBoundingClientRect();
    const reportRect = button.getBoundingClientRect();
    return {
      reportLeft: reportRect.left,
      reportRight: reportRect.right,
      scrollerLeft: scrollerRect.left,
      scrollerRight: scrollerRect.right,
    };
  });
  assert.ok(geometry, 'Report button and results scroller should be measurable');
  assert.ok(
    geometry.reportLeft + 0.5 >= geometry.scrollerLeft,
    `Report button should not be clipped at the scroller leading edge: ${JSON.stringify(geometry)}`,
  );
  assert.ok(
    geometry.reportRight <= geometry.scrollerRight + 0.5,
    `Report button should not be clipped at the scroller trailing edge: ${JSON.stringify(geometry)}`,
  );
}

async function run() {
  await fs.mkdir(OUTPUT, { recursive: true });
  const headed = process.env.HEADED === '1' || process.env.PWDEBUG === '1';
  const browser = await chromium.launch({ headless: !headed, slowMo: headed ? 50 : undefined });
  const viewports = [{ width: 1280, height: 900 }, { width: 375, height: 812 }];
  const results = [];
  try {
    for (const viewport of viewports) {
      publishedArtifact = artifact;
      const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
      page.setDefaultTimeout(25000);
      await installRoutes(page);
      await page.goto(`${BASE_URL}/generated-results-smoke`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByTestId('ce-real-generated-results-smoke').waitFor();
      await page.getByTestId('ce-session-results-toggle').click();
      await page.getByRole('button', { name: 'Breakdown' }).waitFor();
      await assertDesktopReportButtonInsideResultsScroller(page, viewport);
      await page.getByRole('button', { name: 'Circles' }).click();
      await assertVisibleText(page, 'Independent review before release');
      await assertVisibleText(page, 'Source trust');
      assert.ok(await page.getByText(/Release governance|Source trust|Independent review/).count() >= 2);
      await capture(page, 'circles', viewport);
      const sourceTrustNode = await getCircleNodeForLabel(page, 'Source trust');
      await sourceTrustNode.hover();
      await capture(page, 'circles-hover', viewport);
      await sourceTrustNode.click();
      await assertVisibleText(page, 'Reload latest successful analysis for viewers');
      await capture(page, 'circles-category-drill', viewport);
      const reloadLeafNode = await getCircleNodeForLabel(page, 'Reload latest successful analysis for viewers');
      await reloadLeafNode.click();
      await assertVisibleText(page, 'Viewers should see the latest published artifact');
      await capture(page, 'circles-leaf-detail', viewport);
      await closeDebateMapDetailIfOpen(page);
      await page.getByRole('button', { name: 'Breakdown' }).click();
      await assertVisibleText(page, 'Synthetic generated interpretation');
      await capture(page, 'breakdown', viewport);
      await page.getByRole('button', { name: 'Risk Matrix' }).click();
      await assertVisibleText(page, 'Misuse');
      await capture(page, 'risk-matrix', viewport);
      await captureMobileRiskMatrixAccess(page, viewport);
      await page.getByRole('button', { name: 'Check AI Views' }).click();
      await page.getByRole('button', { name: 'Refresh AI Views' }).waitFor();
      await capture(page, 'permission', viewport);
      await page.getByRole('button', { name: 'Refresh AI Views' }).click();
      await assertVisibleText(page, 'Refreshing generated views');
      await capture(page, 'refresh-running', viewport);
      await assertVisibleText(page, 'Post-refresh misuse');
      await capture(page, 'refresh-success', viewport);
      await page.getByRole('button', { name: 'Refresh AI Views' }).click();
      await assertVisibleText(page, 'AI provider timeout');
      await assertVisibleText(page, 'Post-refresh misuse');
      await capture(page, 'provider-failure-preserves-artifact', viewport);
      await page.getByRole('button', { name: 'Retry AI Views' }).click();
      await assertVisibleText(page, 'Authenticate with the session Worker');
      await assertVisibleText(page, 'Post-refresh misuse');
      await capture(page, 'permission-error-preserves-artifact', viewport);
      results.push({ viewport, ok: true });
      await page.close();

      const anonPage = await browser.newPage({ viewport, reducedMotion: 'reduce' });
      anonPage.setDefaultTimeout(25000);
      await installRoutes(anonPage);
      await anonPage.goto(`${BASE_URL}/generated-results-smoke?viewer=anonymous`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await anonPage.getByTestId('ce-real-generated-results-smoke').waitFor();
      await anonPage.getByTestId('ce-session-results-toggle').click();
      await anonPage.getByRole('button', { name: 'Breakdown' }).waitFor();
      await anonPage.getByRole('button', { name: 'Breakdown' }).click();
      await assertVisibleText(anonPage, 'Synthetic refreshed interpretation');
      assert.equal(await anonPage.getByTestId('ce-session-generated-results-check').count(), 0);
      assert.equal(await anonPage.getByTestId('ce-session-generated-results-generate').count(), 0);
      await capture(anonPage, 'anonymous-viewer', viewport);
      await anonPage.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await anonPage.getByTestId('ce-real-generated-results-smoke').waitFor();
      await anonPage.getByTestId('ce-session-results-toggle').click();
      await anonPage.getByRole('button', { name: 'Risk Matrix' }).click();
      await assertVisibleText(anonPage, 'Post-refresh misuse');
      assert.equal(await anonPage.getByTestId('ce-session-generated-results-generate').count(), 0);
      await capture(anonPage, 'anonymous-reload', viewport);
      await anonPage.close();
    }
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify({ ok: true, screenshots: OUTPUT, results }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
