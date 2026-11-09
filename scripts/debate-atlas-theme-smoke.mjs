// Local fixtures only: the Session Worker's replies come from here, so nothing
// reaches a real Worker and no atlas is built. Checks a built atlas, its Build
// button, a running build's status and prompts, a category's and a topic's
// compass, summary and question cards in each theme and width.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assertReadable, auditPanelContrast } from './civic-theme-overlay-smoke.mjs';
import { installCivicThemeFixtures } from './civic-theme-fixtures.mjs';

const sessions = JSON.parse(readFileSync(new URL('../client/src/variables/demo/demo_sessions.json', import.meta.url)));
const config = {
  ...sessions['demo-sh'],
  corsWorkerUrl: 'https://civic-worker.example.test',
  sessionName: 'Civic smoke session',
  debateAtlas: true,
};
const address = (seed) => `0x${seed.repeat(40 / seed.length)}`;
const topic = (id, label, offset) => ({
  id,
  label,
  summary: `People split on ${label.toLowerCase()}: most want care first, a few want speed.`,
  questions: [
    { id: `q-${id}`, prompt: `How should the city handle ${label.toLowerCase()}?`, type: 'freeform' },
    { id: `q-${id}-pilot`, prompt: `Should the city pilot ${label.toLowerCase()} first?`, type: 'binary' },
  ],
  compass: {
    x: { label: 'Pace', left: 'Slow and careful', right: 'Fast and bold' },
    y: { label: 'Scope', top: 'Neighbourhood first', bottom: 'Citywide first' },
  },
  positions: [
    { label: 'Pilot it locally first', summary: 'Start small and learn.', participantCount: 5, x: 0.2, y: 0.8 },
    { label: 'Roll out citywide now', summary: 'Delay costs more.', participantCount: 2, x: 0.85, y: 0.15 },
    { label: 'Ask residents before acting', participantCount: 1, x: 0.3, y: 0.55 },
  ],
  participants: ['a1', 'b2', 'c3', 'd4', 'e5'].map((seed, index) => ({
    address: address(seed),
    x: Math.min(1, 0.15 + index * 0.17 + offset),
    y: Math.max(0, 0.85 - index * 0.16),
    reason: 'Prefers a careful local trial.',
  })),
});
const build = {
  id: 'atlas_mh1_0a1b2c3d',
  builtAt: '2026-11-08T14:05:00.000Z',
  builtBy: address('a1'),
  model: 'fixture',
  title: 'Civic services atlas',
  counts: { responses: 64, participants: 12, questions: 9, aiResponses: 48, aiQuestions: 9 },
  missingTopics: ['Libraries'],
  branches: [
    {
      ...topic('b1', 'Transport', 0.03),
      summary: 'Buses and bikes.',
      topics: [topic('b1t1', 'Bus lanes', 0), topic('b1t2', 'Bike parking', 0.05)],
    },
    { ...topic('b2t3', 'Repairs', 0.02), id: 'b2', label: 'Housing', summary: 'Rents and repairs.', topics: [topic('b2t3', 'Repairs', 0.02)] },
  ],
};
const nextBuild = {
  model: 'fixture-model',
  prompts: { plan: 'You are planning a debate atlas.\nQuestions:\n<Questions>', map: 'You are mapping one topic.\n<Responses>' },
};
// Set to show someone else's build running, without pressing Build.
const fixtureState = { active: null };
const older = { ...build, id: 'atlas_mh0_0a1b2c3e', builtAt: '2026-11-08T13:00:00.000Z', counts: { responses: 30, participants: 8 } };
const summary = ({ branches, ...rest }) => rest;
const step = async (name, run) => {
  try {
    return await run();
  } catch (error) {
    throw new Error(`${name}: ${error.message.split('\n')[0]}`);
  }
};

async function installAtlasFixtures(context, base) {
  await installCivicThemeFixtures(context, base);
  // demo-sh takes its config from the bundled list, so the Worker's atlas flag goes there too.
  await context.route('**/src/variables/demo/demo_sessions.json?import*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `export default ${JSON.stringify({ general: sessions.general, 'demo-sh': config, 'demo-2': sessions['demo-2'] })};`,
    }),
  );
  await context.route(`${config.corsWorkerUrl}/session-config*`, (route) =>
    route.fulfill({ json: { ok: true, sessionSlug: config.slug, sessionId: config.sessionId, config } }),
  );
  // canBuild shows the Build button without a sign-in; the button is never pressed.
  await context.route(`${config.corsWorkerUrl}/debate-atlas*`, (route) => {
    const id = new URL(route.request().url()).searchParams.get('id');
    return route.fulfill({
      json: {
        ok: true,
        active: fixtureState.active,
        canBuild: true,
        nextBuild,
        builds: [summary(build), summary(older)],
        build: id === older.id ? older : build,
      },
    });
  });
}

async function inspectBuildButton(page) {
  const buildButton = page.getByTestId('ce-session-debate-atlas-build');
  await buildButton.waitFor({ timeout: 60000 });
  await step('Build atlas', () => assertReadable(buildButton));
  // Focus opens the tooltip too; it is read after its fade-in, before any hover can queue a hide.
  const tooltip = page.getByRole('tooltip').filter({ hasText: 'Builds a debate atlas' });
  await step('Build atlas tooltip', async () => {
    let result = null;
    await buildButton.focus();
    for (const deadline = Date.now() + 20000; Date.now() < deadline; ) {
      result = await tooltip.evaluate(auditPanelContrast, 0, { timeout: 1500 }).catch(() => null);
      if (result?.checked > 0 && result.failures.length === 0) break;
      if (!result) await buildButton.focus();
      await page.waitForTimeout(200);
    }
    assert(result && result.checked > 0, 'The tooltip never stayed open long enough to read');
    assert.equal(result.failures.length, 0, `Tooltip contrast: ${JSON.stringify(result.failures)}`);
  });
  await buildButton.blur();
  await buildButton.hover();
  await step('Build atlas hovered', () => assertReadable(buildButton));
  await page.mouse.move(0, 0);
  await buildButton.focus();
  await step('Build atlas focused', () => assertReadable(buildButton));
  // Pressed: hold the mouse down on it, then release elsewhere so no build starts.
  const box = await buildButton.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await step('Build atlas pressed', () => assertReadable(buildButton));
  await page.mouse.move(1, 1);
  await page.mouse.up();
}

export async function inspectDebateAtlas(page, { screenshotDir = '', tag = '' } = {}) {
  await page.getByTestId('ce-session-results-toggle').click();
  const nav = page.getByTestId('ce-session-results-view-nav');
  await inspectBuildButton(page);
  await nav.getByRole('button', { name: 'Debate Map', exact: true }).click();
  const atlas = page.getByTestId('ce-session-debate-atlas');
  await atlas.waitFor();
  await page.getByTestId('ce-atlas-node').first().waitFor();
  await step('atlas', () => assertReadable(atlas));
  const picker = atlas.getByRole('combobox', { name: 'Build' });
  await picker.hover();
  await step('build picker hovered', () => assertReadable(picker.locator('xpath=..')));
  await picker.focus();
  await step('build picker focused', () => assertReadable(picker.locator('xpath=..')));
  const help = atlas.getByRole('button', { name: 'About this atlas' });
  await help.focus();
  const helpTip = page.getByRole('tooltip').filter({ hasText: 'built this' });
  await step('atlas tooltip', async () => {
    await helpTip.waitFor();
    await assertReadable(helpTip);
  });
  await help.blur();
  const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  assert(overflow <= 1, `The page scrolls sideways by ${overflow}px`);
  const pickerFits = await atlas.evaluate((element) => {
    const panel = element.getBoundingClientRect();
    const select = element.querySelector('select')?.getBoundingClientRect();
    return !select || (select.left >= panel.left - 1 && select.right <= panel.right + 1);
  });
  assert(pickerFits, 'The build picker overflows the atlas panel');
  if (screenshotDir) await atlas.screenshot({ path: `${screenshotDir}/debate-atlas-${tag}.png` });

  // A topic is a leaf, so after its branch opens it opens straight to its compass.
  await page.getByTestId('ce-atlas-node').filter({ hasText: 'Transport' }).first().click();
  const topicNode = page.locator('[data-testid="ce-atlas-node"]', { hasText: 'Bus lanes' }).last();
  await step('open branch', () => topicNode.waitFor({ timeout: 15000 }));
  await topicNode.click();
  await step('open topic', () => page.locator('[data-testid^="ce-political-compass-point-"]').first().waitFor({ timeout: 15000 }));
  const panel = page.locator('[class*="modalContent"]').last();
  await step('topic panel', () => assertReadable(panel));

  // The summary leads short; its positions open on request.
  const more = panel.getByRole('button', { name: 'Show more' });
  await more.hover();
  await step('summary toggle hovered', () => assertReadable(panel));
  await more.focus();
  await step('summary toggle focused', () => assertReadable(panel));
  await more.click();
  await step('summary positions', async () => {
    await panel.getByRole('listitem').filter({ hasText: 'Pilot it locally first' }).waitFor();
    await assertReadable(panel);
    const overflowing = await panel
      .getByRole('listitem')
      .evaluateAll((items) => items.filter((item) => item.scrollWidth > item.clientWidth + 1).map((item) => item.textContent));
    assert.deepEqual(overflowing, [], 'A position overflows its card');
  });

  // Hovering a participant names them, in the tooltip's own colours.
  await page.locator('[data-testid$="-avatar"]').first().waitFor();
  const participant = page.locator('[data-testid^="ce-political-compass-point-0x"]').first();
  await participant.hover({ force: true });
  const tooltip = page.getByTestId('ce-political-compass-tooltip');
  await step('participant tooltip', async () => {
    await tooltip.getByText(/^0x[0-9a-f]{4}…[0-9a-f]{4}$/).waitFor({ timeout: 5000 });
    await assertReadable(tooltip);
  });
  await participant.click({ force: true });
  await step('selected participant', async () => {
    await assertReadable(panel);
    // The address stays whole on one line; its quadrant moves below it when there is no room.
    const name = panel.getByRole('link', { name: /^0x[0-9a-f]{4}…[0-9a-f]{4}$/ }).first();
    assert.equal(await name.evaluate((link) => link.getClientRects().length), 1, 'The participant address breaks across lines');
  });
  if (screenshotDir) await panel.screenshot({ path: `${screenshotDir}/debate-atlas-compass-${tag}.png` });

  // Its questions look like the session's cards and open their own pages, a
  // freeform one and one with the session's Agree, Unsure and Disagree buttons.
  await panel.getByText('Questions', { exact: true }).click();
  const cards = panel.getByRole('link', { name: /^Answer: / });
  await step('question cards', async () => {
    assert.equal(await cards.count(), 2);
    assert.match(String(await cards.first().getAttribute('href')), /^\/question\/q-b1t1\?session=demo-sh/);
    assert.equal(await cards.first().getAttribute('target'), '_blank');
    await cards.last().getByText('Agree', { exact: true }).waitFor();
  });
  for (const [index, card] of [cards.first(), cards.last()].entries()) {
    await step(`question card ${index + 1}`, () => assertReadable(card));
    await card.hover();
    await step(`question card ${index + 1} hovered`, () => assertReadable(card));
    await page.mouse.move(0, 0);
    await card.focus();
    await step(`question card ${index + 1} focused`, () => assertReadable(card));
    const cardBox = await card.boundingBox();
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.mouse.down();
    await step(`question card ${index + 1} pressed`, () => assertReadable(card));
    await page.mouse.move(1, 1);
    await page.mouse.up();
    await card.blur();
  }
  if (screenshotDir) await cards.last().screenshot({ path: `${screenshotDir}/debate-atlas-question-${tag}.png` });

  // The category behind it has a compass of its own, with the same legend.
  await panel.getByTitle('Close').click();
  await page.getByLabel('Open Transport').click();
  const categoryPanel = page.locator('[class*="modalContent"]').last();
  await step('open category', () => categoryPanel.getByText('Category', { exact: true }).waitFor({ timeout: 15000 }));
  await step('category compass', () => categoryPanel.getByText('Participant', { exact: true }).waitFor({ timeout: 15000 }));
  await step('category panel', () => assertReadable(categoryPanel));
  if (screenshotDir) await categoryPanel.screenshot({ path: `${screenshotDir}/debate-atlas-category-${tag}.png` });
}

// A running build shows its time, model and, on request, its prompts.
export async function inspectBuildStatus(page, { screenshotDir = '', tag = '' } = {}) {
  await page.getByTestId('ce-session-results-toggle').click();
  const status = page.getByTestId('ce-session-debate-atlas-status');
  await step('build status', async () => {
    await status.getByText(/Building the atlas · \d+s/).waitFor({ timeout: 60000 });
    await status.getByText('AI model: fixture-model').waitFor();
    await assertReadable(status);
  });
  const toggle = status.getByRole('button', { name: /Show AI prompt/ });
  await toggle.hover();
  await step('prompt toggle hovered', () => assertReadable(status));
  await page.mouse.move(0, 0);
  await toggle.focus();
  await step('prompt toggle focused', () => assertReadable(status));
  const box = await toggle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await step('prompt toggle pressed', () => assertReadable(status));
  await page.mouse.up();
  await step('prompts shown', async () => {
    await status.getByRole('region', { name: 'Planning prompt' }).waitFor();
    await assertReadable(status);
  });
  const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  assert(overflow <= 1, `The page scrolls sideways by ${overflow}px with the prompts open`);
  if (screenshotDir) await status.screenshot({ path: `${screenshotDir}/debate-atlas-status-${tag}.png` });
}

export async function runDebateAtlasThemeSmoke() {
  const { chromium } = await import('playwright');
  const base = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
  assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local Vite server');
  const themes = process.env.THEMES?.split(',') || ['civic', 'context-engine', 'classic-95'];
  const widths = process.env.WIDTHS?.split(',').map(Number) || [375, 1280];
  const screenshotDir = process.env.ATLAS_SCREENSHOT_DIR || '';
  const browser = await chromium.launch({ headless: true });
  try {
    for (const theme of themes) {
      for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        await installAtlasFixtures(context, base);
        await context.addInitScript((value) => {
          localStorage.setItem('ce:theme-default-version', '2026-10-13-civic-v1');
          localStorage.setItem('ce:theme', value);
          localStorage.setItem('ce_onboarding_complete', 'true');
          localStorage.setItem('ce:firstVisitRootAboutRedirectConsumed:v20260618b', 'true');
        }, theme);
        const page = await context.newPage();
        try {
          await page.goto(`${base}/session/demo-sh`, { waitUntil: 'domcontentloaded' });
          await page.waitForFunction((value) => document.documentElement.dataset.ceTheme === value, theme);
          fixtureState.active = null;
          await inspectDebateAtlas(page, { screenshotDir, tag: `${theme}-${width}` });
          fixtureState.active = { startedAtMs: Date.now() - 42_000 };
          await page.reload({ waitUntil: 'domcontentloaded' });
          await inspectBuildStatus(page, { screenshotDir, tag: `${theme}-${width}` });
          console.log(`PASS debate atlas contrast ${theme} ${width}px`);
        } catch (error) {
          if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/failed-${theme}-${width}.png` }).catch(() => {});
          throw new Error(`${theme} ${width}px: ${error.message}`);
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDebateAtlasThemeSmoke().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
