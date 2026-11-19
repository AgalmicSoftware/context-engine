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

// AI Views has no tabs of its own: its build feeds the Session Agent. This checks that Results shows none of
// its views, and that an admin can update the Session Agent and retry a failed update.
async function assertNoAiViewsTabs(page) {
  const nav = page.getByTestId('ce-session-results-view-nav');
  await nav.getByRole('button', { name: 'Report', exact: true }).first().waitFor({ state: 'visible', timeout: 20000 });
  for (const name of ['Circles', 'Breakdown', 'Risk Matrix', 'Atlas']) {
    assert.equal(await nav.getByRole('button', { name, exact: true }).count(), 0, `${name} should not be a Results tab`);
  }
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
      await assertNoAiViewsTabs(page);
      await assertDesktopReportButtonInsideResultsScroller(page, viewport);
      await capture(page, 'results', viewport);
      // One press proves the admin and starts the build; later presses start the next ones.
      const update = page.getByRole('button', { name: 'Update Session Agent', exact: true });
      const built = page.waitForRequest('https://worker.example/admin/results-analysis/generate');
      await update.click();
      await built;
      await update.and(page.locator(':enabled')).waitFor();
      await capture(page, 'permission', viewport);
      await update.click();
      await assertVisibleText(page, 'AI provider timeout');
      await capture(page, 'provider-failure', viewport);
      await page.getByRole('button', { name: 'Retry Session Agent update' }).click();
      await page.getByTestId('ce-session-agent-update').waitFor({ state: 'visible', timeout: 20000 });
      await capture(page, 'permission-error', viewport);
      await assertNoAiViewsTabs(page);
      results.push({ viewport, ok: true });
      await page.close();

      const anonPage = await browser.newPage({ viewport, reducedMotion: 'reduce' });
      anonPage.setDefaultTimeout(25000);
      await installRoutes(anonPage);
      await anonPage.goto(`${BASE_URL}/generated-results-smoke?viewer=anonymous`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await anonPage.getByTestId('ce-real-generated-results-smoke').waitFor();
      await anonPage.getByTestId('ce-session-results-toggle').click();
      await assertNoAiViewsTabs(anonPage);
      assert.equal(await anonPage.getByTestId('ce-session-agent-update').count(), 0);
      await capture(anonPage, 'anonymous-viewer', viewport);
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
