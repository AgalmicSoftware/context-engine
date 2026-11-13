// Local fixtures only: the Session Worker's replies come from here, so nothing
// reaches a real Worker and nothing is built. Checks a built atlas and risk
// matrix, their Build buttons, a running build's status and prompts, a
// category's and a topic's compass, summary and question cards, the List and
// Tree views, and the matrix's cells, detail grid and notes, in each theme and
// width.
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
  riskMatrix: true,
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
const older = { ...build, id: 'atlas_mh0_0a1b2c3e', builtAt: '2026-11-08T13:00:00.000Z', counts: { responses: 30, participants: 8 } };
const note = (cell, valence, intensity, comment, participantCount) => ({
  cell,
  valence,
  intensity,
  comment,
  participantCount,
  questionIds: ['q-b1t1'],
});
// A strong and a faint cell of each kind, one with both kinds of note, and pairs with none.
const riskMatrix = {
  id: 'risk_mh1_0a1b2c3d',
  builtAt: '2026-11-08T14:20:00.000Z',
  builtBy: address('a1'),
  model: 'fixture',
  title: 'Civic services risks',
  counts: { responses: 64, participants: 12, questions: 9, aiResponses: 48, aiQuestions: 9 },
  areas: [
    { name: 'Transport', subareas: ['Bus lanes', 'Bike parking'] },
    { name: 'Housing', subareas: ['Rents', 'Repairs'] },
    { name: 'Safety', subareas: ['Street lighting'] },
  ],
  notes: [
    note('Transport.Bus lanes.Housing.Rents', 'opportunity', 8, 'Faster buses open cheaper neighbourhoods to commuters.', 6),
    note('Housing.Repairs.Safety.Street lighting', 'risk', 9, 'Slow repairs leave stairwells dark at night.', 4),
    note('Safety.Street lighting.Transport.Bus lanes', 'opportunity', 4, 'Lit bus stops make late routes feel safer.', 3),
    note('Safety.Street lighting.Transport.Bike parking', 'risk', 2, 'Dark bike racks invite theft.', 1),
    note('Housing.Rents.Transport.Bus lanes', 'risk', 2, 'Rising rents push riders away from the lanes.', 2),
  ],
};
const olderRiskMatrix = {
  ...riskMatrix,
  id: 'risk_mh0_0a1b2c3e',
  builtAt: '2026-11-08T13:20:00.000Z',
  counts: { responses: 30, participants: 8 },
};
// The builds the open Results menu offers, with the Worker's reply for each.
const BUILDS = [
  {
    kind: 'debate-atlas',
    label: 'Build atlas',
    tooltip: 'Builds a debate atlas',
    name: 'atlas',
    prompt: 'Planning prompt',
    build,
    older,
    nextBuild: {
      model: 'fixture-model',
      prompts: { plan: 'You are planning a debate atlas.\nQuestions:\n<Questions>', map: 'You are mapping one topic.\n<Responses>' },
    },
  },
  {
    kind: 'risk-matrix',
    label: 'Build risk matrix',
    tooltip: 'Builds a risk matrix',
    name: 'risk matrix',
    prompt: 'Building prompt',
    build: riskMatrix,
    older: olderRiskMatrix,
    nextBuild: { model: 'fixture-model', prompts: { build: 'You are building a risk matrix.\nResponses:\n<Responses>' } },
  },
];
// Set to show someone else's builds running, without pressing Build.
const fixtureState = { active: null };
const summary = ({ branches, areas, notes, ...rest }) => rest;
// The light themes' tree connectors are graphics on the chart, so they need 3:1 against it.
const LIGHT_THEMES = new Set(['civic', 'classic-95']);
const connectorContrast = (chart) => {
  const parse = (value) => value.match(/[\d.]+/g)?.map(Number) || [];
  const luminance = ([r, g, b]) =>
    [r, g, b]
      .map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const surface = parse(getComputedStyle(chart).backgroundColor);
  const lines = [
    ...chart.querySelectorAll(
      '[class*="orgChildrenContainer"], [class*="orgChildrenRow"], [class*="orgChildrenRow"] > [class*="orgNodeWrapper"]',
    ),
  ].map(
    (element) => parse(getComputedStyle(element, '::before').backgroundColor),
  );
  return lines.map((line) => {
    const alpha = line[3] ?? 1;
    const mixed = line.slice(0, 3).map((channel, index) => channel * alpha + surface[index] * (1 - alpha));
    const levels = [luminance(mixed), luminance(surface)].sort((a, b) => b - a);
    return (levels[0] + 0.05) / (levels[1] + 0.05);
  });
};
// A tree card's icons are graphics on the card, so they need 3:1 against it too.
const iconContrast = (chart) => {
  const parse = (value) => value.match(/[\d.]+/g)?.map(Number) || [];
  const luminance = ([r, g, b]) =>
    [r, g, b]
      .map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  return [...chart.querySelectorAll('[class*="orgCard"] svg')].map((icon) => {
    const card = icon.closest('[class*="orgCard"]');
    const levels = [luminance(parse(getComputedStyle(icon).color)), luminance(parse(getComputedStyle(card).backgroundColor))].sort(
      (a, b) => b - a,
    );
    return (levels[0] + 0.05) / (levels[1] + 0.05);
  });
};
const step = async (name, run) => {
  try {
    return await run();
  } catch (error) {
    throw new Error(`${name}: ${error.message.split('\n')[0]}`);
  }
};

async function installBuildFixtures(context, base) {
  await installCivicThemeFixtures(context, base);
  // demo-sh takes its config from the bundled list, so the Worker's build flags go there too.
  await context.route('**/src/variables/demo/demo_sessions.json?import*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `export default ${JSON.stringify({ general: sessions.general, 'demo-sh': config, 'demo-2': sessions['demo-2'] })};`,
    }),
  );
  await context.route(`${config.corsWorkerUrl}/session-config*`, (route) =>
    route.fulfill({ json: { ok: true, sessionSlug: config.slug, sessionId: config.sessionId, config } }),
  );
  // canBuild shows the Build buttons without a sign-in; they are never pressed.
  for (const { kind, build: newest, older: earlier, nextBuild } of BUILDS) {
    await context.route(`${config.corsWorkerUrl}/${kind}*`, (route) => {
      const id = new URL(route.request().url()).searchParams.get('id');
      return route.fulfill({
        json: {
          ok: true,
          active: fixtureState.active,
          canBuild: true,
          nextBuild,
          builds: [summary(newest), summary(earlier)],
          build: id === earlier.id ? earlier : newest,
        },
      });
    });
  }
}

async function inspectBuildButton(page, { kind, label, tooltip: tooltipText }) {
  const buildButton = page.getByTestId(`ce-session-${kind}-build`);
  await buildButton.waitFor({ timeout: 60000 });
  await step(label, () => assertReadable(buildButton));
  // Focus opens the tooltip too; it is read after its fade-in, before any hover can queue a hide.
  const tooltip = page.getByRole('tooltip').filter({ hasText: tooltipText });
  await step(`${label} tooltip`, async () => {
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
  await inspectStates(page, buildButton, label, buildButton);
}

// A select's shown text has no box of its own, so the audit reads a copy of it
// on the select's background, among the same ancestors.
async function assertSelectReadable(select) {
  await select.evaluate((node) => {
    const style = getComputedStyle(node);
    const copy = document.createElement('span');
    copy.dataset.ceSelectCopy = '';
    copy.textContent = node.selectedOptions[0]?.textContent || '';
    Object.assign(copy.style, { background: style.backgroundColor, color: style.color, font: style.font });
    node.after(copy);
  });
  const copy = select.locator('xpath=..').locator('[data-ce-select-copy]');
  try {
    await assertReadable(copy);
  } finally {
    await copy.evaluate((node) => node.remove());
  }
}

// Hovered, focused and pressed, with `target` read in each. A press is released
// elsewhere, so nothing it would start or open does.
async function inspectStates(page, control, name, target) {
  await control.hover();
  await step(`${name} hovered`, () => assertReadable(target));
  await page.mouse.move(0, 0);
  await control.focus();
  await step(`${name} focused`, () => assertReadable(target));
  const box = await control.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await step(`${name} pressed`, () => assertReadable(target));
  await page.mouse.move(1, 1);
  await page.mouse.up();
  await control.blur();
}

export async function inspectDebateAtlas(page, { screenshotDir = '', tag = '', theme = '' } = {}) {
  const nav = page.getByTestId('ce-session-results-view-nav');
  await nav.getByRole('button', { name: 'Debate Map', exact: true }).click();
  const atlas = page.getByTestId('ce-session-debate-atlas');
  await atlas.waitFor();
  await page.getByTestId('ce-atlas-node').first().waitFor();
  await step('atlas', () => assertReadable(atlas));
  const picker = atlas.getByRole('combobox', { name: 'Version' });
  await step('build picker text', () => assertSelectReadable(picker));
  await picker.hover();
  await step('build picker hovered', () => assertReadable(picker.locator('xpath=..')));
  await picker.focus();
  await step('build picker focused', async () => {
    await assertReadable(picker.locator('xpath=..'));
    await assertSelectReadable(picker);
  });
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
    await inspectStates(page, card, `question card ${index + 1}`, card);
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
  await categoryPanel.getByTitle('Close').click();

  // The List keeps each level's colour and the Tree its connectors, in every theme.
  await atlas.locator('[data-testid="ce-debate-view-mode"][data-ce-view-mode="list"]').click();
  await step('list view', async () => {
    await atlas.getByRole('button', { name: 'Bus lanes', exact: true }).waitFor();
    await assertReadable(atlas);
    // Each level's chip has its own colour, as the legend says, not the plain surface.
    const plain = await atlas.evaluate((element) => {
      const probe = element.appendChild(document.createElement('span'));
      probe.style.background = 'var(--ce-document-surface)';
      const colour = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return colour;
    });
    const [category, topicChip] = await Promise.all(
      ['Transport', 'Bus lanes'].map((name) =>
        atlas
          .getByRole('button', { name, exact: true })
          .last()
          .evaluate((chip) => getComputedStyle(chip).backgroundColor),
      ),
    );
    assert.notEqual(category, topicChip, `List levels share one colour, ${category}`);
    assert(![category, topicChip].includes(plain), `A List level has no colour of its own: ${category}, ${topicChip}`);
  });
  if (screenshotDir) await atlas.screenshot({ path: `${screenshotDir}/debate-atlas-list-${tag}.png` });
  await atlas.locator('[data-testid="ce-debate-view-mode"][data-ce-view-mode="tree"]').click();
  await step('tree categories', () => assertReadable(atlas));
  await atlas.getByRole('button', { name: 'Transport', exact: true }).first().click();
  await step('tree chart', async () => {
    await atlas.getByText('Bike parking').first().waitFor();
    await assertReadable(atlas);
  });
  if (LIGHT_THEMES.has(theme)) {
    const chart = atlas.locator('[class*="orgChartContainer"]').first();
    await step('tree connectors', async () => {
      const ratios = await chart.evaluate(connectorContrast);
      assert(ratios.length > 0, 'The tree draws no connectors');
      assert(Math.min(...ratios) >= 3, `Tree connector contrast ${ratios.map((ratio) => ratio.toFixed(2)).join(', ')}`);
    });
    await step('tree card icons', async () => {
      const ratios = await chart.evaluate(iconContrast);
      assert(ratios.length > 0, 'The tree cards draw no icons');
      assert(Math.min(...ratios) >= 3, `Tree card icon contrast ${ratios.map((ratio) => ratio.toFixed(2)).join(', ')}`);
    });
  }
  if (screenshotDir) await atlas.screenshot({ path: `${screenshotDir}/debate-atlas-tree-${tag}.png` });
}

// A built risk matrix: its stamp, picker and "?", its cells in each state, a
// cell's notes, and the detail grid of the two areas it joins.
export async function inspectRiskMatrix(page, { screenshotDir = '', tag = '' } = {}) {
  const nav = page.getByTestId('ce-session-results-view-nav');
  await nav.getByRole('button', { name: 'Risk Matrix', exact: true }).click();
  const view = page.getByTestId('ce-session-risk-matrix');
  await view.waitFor();
  await step('risk matrix', () => assertReadable(view));
  if (screenshotDir) await view.screenshot({ path: `${screenshotDir}/risk-matrix-${tag}.png` });
  const picker = view.getByRole('combobox', { name: 'Version' });
  await step('risk matrix picker text', () => assertSelectReadable(picker));
  await picker.hover();
  await step('risk matrix picker hovered', () => assertReadable(picker.locator('xpath=..')));
  await picker.focus();
  await step('risk matrix picker focused', async () => {
    await assertReadable(picker.locator('xpath=..'));
    await assertSelectReadable(picker);
  });
  const help = view.getByRole('button', { name: 'About this risk matrix' });
  await help.focus();
  await step('risk matrix tooltip', async () => {
    const helpTip = page.getByRole('tooltip').filter({ hasText: 'Each note is an opportunity or a risk' });
    await helpTip.waitFor();
    await assertReadable(helpTip);
  });
  await help.blur();
  const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  assert(overflow <= 1, `The page scrolls sideways by ${overflow}px`);

  // The strongest opportunity and risk, and a faint cell holding both kinds.
  for (const pair of ['transport-vs-housing', 'housing-vs-safety', 'safety-vs-transport']) {
    await inspectStates(page, view.getByTestId(`ce-risk-matrix-cell-${pair}`), `cell ${pair}`, view);
  }
  await view.getByTestId('ce-risk-matrix-cell-safety-vs-transport').click();
  await page.mouse.move(0, 0);
  const modal = page.getByTestId('ce-risk-matrix-modal');
  await step('cell notes', async () => {
    await modal.getByText('From 3 participants').waitFor();
    await modal.getByText('From 1 participant', { exact: true }).waitFor();
    await assertReadable(modal);
  });
  for (const group of ['Opportunities', 'Risks']) {
    await inspectStates(page, modal.getByRole('button', { name: new RegExp(`^${group}`) }), `${group} toggle`, modal);
  }
  const close = modal.getByRole('button', { name: 'Close', exact: true }).last();
  await inspectStates(page, close, 'notes Close', modal);
  if (screenshotDir) await modal.screenshot({ path: `${screenshotDir}/risk-matrix-notes-${tag}.png` });
  await close.click();

  // The cell opened the detail grid of its two areas.
  const subgrid = view.getByTestId('ce-risk-matrix-subgrid');
  await step('detail grid', () => assertReadable(subgrid));
  const subcell = subgrid.getByTestId('ce-risk-matrix-subcell-safety-street-lighting-vs-transport-bus-lanes');
  await inspectStates(page, subcell, 'detail cell', subgrid);
  const detailHelp = subgrid.getByRole('button', { name: 'How to read this grid' });
  await detailHelp.focus();
  await step('detail grid tooltip', async () => {
    const tip = page.getByRole('tooltip').filter({ hasText: 'A square holds the notes' });
    await tip.waitFor();
    await assertReadable(tip);
  });
  await detailHelp.blur();
  const heading = subgrid.getByTestId('ce-risk-matrix-subheader-x-street-lighting');
  await inspectStates(page, heading, 'detail heading', subgrid);
  await heading.click();
  await step('detail grid highlighted', () => assertReadable(subgrid));
  const clear = subgrid.getByTestId('ce-risk-matrix-clear-highlight');
  await inspectStates(page, clear, 'clear highlight', subgrid);
  if (screenshotDir) await subgrid.screenshot({ path: `${screenshotDir}/risk-matrix-detail-highlight-${tag}.png` });
  await clear.click();
  await subcell.click();
  await step('detail cell notes', async () => {
    await modal.getByText('Lit bus stops make late routes feel safer.').waitFor();
    await assertReadable(modal);
  });
  await modal.getByRole('button', { name: 'Close', exact: true }).last().click();
  const detailOverflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  assert(detailOverflow <= 1, `The page scrolls sideways by ${detailOverflow}px with the detail grid open`);
  if (screenshotDir) await subgrid.screenshot({ path: `${screenshotDir}/risk-matrix-detail-${tag}.png` });
}

// A running build shows its time, model and, on request, its prompts.
export async function inspectBuildStatus(page, { kind, name, prompt }, { screenshotDir = '', tag = '' } = {}) {
  const status = page.getByTestId(`ce-session-${kind}-status`);
  await step(`${name} build status`, async () => {
    await status.getByText(new RegExp(`Building the ${name} · \\d+s`)).waitFor({ timeout: 60000 });
    await status.getByText('AI model: fixture-model').waitFor();
    await assertReadable(status);
  });
  await step(`${name} busy button`, () => assertReadable(page.getByTestId(`ce-session-${kind}-build`)));
  const toggle = status.getByRole('button', { name: /Show AI prompt/ });
  await toggle.hover();
  await step(`${name} prompt toggle hovered`, () => assertReadable(status));
  await page.mouse.move(0, 0);
  await toggle.focus();
  await step(`${name} prompt toggle focused`, () => assertReadable(status));
  const box = await toggle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await step(`${name} prompt toggle pressed`, () => assertReadable(status));
  await page.mouse.up();
  await step(`${name} prompts shown`, async () => {
    await status.getByRole('region', { name: prompt }).waitFor();
    await assertReadable(status);
  });
  const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  assert(overflow <= 1, `The page scrolls sideways by ${overflow}px with the prompts open`);
  if (screenshotDir) await status.screenshot({ path: `${screenshotDir}/${kind}-status-${tag}.png` });
}

export async function runResultsBuildsThemeSmoke() {
  const { chromium } = await import('playwright');
  const base = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
  assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local Vite server');
  const themes = process.env.THEMES?.split(',') || ['civic', 'context-engine', 'classic-95'];
  const widths = process.env.WIDTHS?.split(',').map(Number) || [375, 1280];
  const screenshotDir = process.env.SCREENSHOT_DIR || '';
  const browser = await chromium.launch({ headless: true });
  try {
    for (const theme of themes) {
      for (const width of widths) {
        const tag = `${theme}-${width}`;
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        await installBuildFixtures(context, base);
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
          await page.getByTestId('ce-session-results-toggle').click();
          for (const entry of BUILDS) await inspectBuildButton(page, entry);
          await inspectDebateAtlas(page, { screenshotDir, tag, theme });
          await inspectRiskMatrix(page, { screenshotDir, tag });
          fixtureState.active = { startedAtMs: Date.now() - 42_000 };
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.getByTestId('ce-session-results-toggle').click();
          for (const entry of BUILDS) await inspectBuildStatus(page, entry, { screenshotDir, tag });
          console.log(`PASS Results builds contrast ${tag}px`);
        } catch (error) {
          if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/failed-${tag}.png` }).catch(() => {});
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
  runResultsBuildsThemeSmoke().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
