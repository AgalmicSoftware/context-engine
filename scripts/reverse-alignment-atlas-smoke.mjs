import assert from 'node:assert/strict';

async function checkReadingLayout(reading) {
  const layout = await reading.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const controls = ['Back to focus areas', 'Previous focus area', 'Next focus area'].map(name => {
      const rect = element.querySelector(`[aria-label="${name}"]`).getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
    });
    return { width: innerWidth, height: innerHeight, panelHeight: bounds.height, overflow: document.documentElement.scrollWidth - innerWidth, controls };
  });
  assert.ok(layout.overflow <= 1, 'Guide fits the viewport horizontally');
  assert.ok(layout.panelHeight <= layout.height, 'Default topic content fits in one viewport');
  for (const control of layout.controls) {
    assert.ok(control.top >= 0 && control.bottom <= layout.height, 'Back and arrows remain visible without scrolling');
    assert.ok(control.left >= 0 && control.right <= layout.width, 'Navigation fits the viewport width');
  }
}

export async function probeReverseAlignmentAtlas(page) {
  const guide = page.getByTestId('ce-rxc-context-atlas');
  const grid = guide.getByRole('group', { name: 'Explore twelve focus areas' });
  const reading = guide.getByRole('article', { name: 'Selected focus area' });
  await grid.waitFor({ state: 'visible' });
  assert.equal(await grid.getByRole('button').count(), 12);
  assert.equal(await reading.count(), 0, 'Start on the grid alone');
  await grid.getByRole('button', { name: 'Labor transition', exact: true }).press('Enter');
  await reading.waitFor({ state: 'visible' });
  assert.equal(await grid.count(), 0, 'Details replace the grid');
  assert.equal(await reading.getByRole('heading', { name: 'Labor transition', exact: true }).evaluate(el => el === document.activeElement), true);
  await checkReadingLayout(reading);
  await reading.getByRole('button', { name: 'Workplace', exact: true }).click();
  assert.equal(await reading.getByRole('heading', { name: 'Workplace', exact: true }).isVisible(), true);
  await reading.getByRole('button', { name: 'Tensions', exact: true }).click();
  assert.equal(await reading.getByRole('heading', { name: 'An invitation to discuss', exact: true }).isVisible(), true);
  await reading.getByRole('button', { name: 'Sources', exact: true }).click();
  assert.equal(await reading.getByRole('link', { name: 'Read Reverse Alignment ↗' }).getAttribute('href'), 'https://reversealignment.ai/');
  await checkReadingLayout(reading);
  await reading.getByRole('button', { name: 'Back to focus areas', exact: true }).press('Enter');
  await grid.waitFor({ state: 'visible' });
  assert.equal(await reading.count(), 0);
  assert.equal(await grid.getByRole('button', { name: 'Workplace', exact: true }).evaluate(el => el === document.activeElement), true, 'Back restores focus to the last viewed topic');
  await grid.getByRole('button', { name: 'Identity', exact: true }).press('Enter');
  assert.equal(await reading.getByRole('button', { name: 'Overview', exact: true }).getAttribute('aria-pressed'), 'true');
  const topics = ['Identity', 'Privacy', 'Provenance', 'Data value', 'Agentic collaboration', 'Communal sensemaking', 'Democracy', 'Law and liberties', 'Workplace', 'Research', 'Education', 'Labor transition'];
  for (const topic of topics) {
    assert.equal(await reading.getByRole('heading', { name: topic, exact: true }).isVisible(), true);
    await checkReadingLayout(reading);
    await reading.getByRole('button', { name: 'Next focus area', exact: true }).click();
  }
  assert.equal(await reading.getByRole('heading', { name: 'Identity', exact: true }).isVisible(), true, 'Tour wraps to the first topic');
  await reading.getByRole('button', { name: 'Previous focus area', exact: true }).click();
  assert.equal(await reading.getByRole('heading', { name: 'Labor transition', exact: true }).isVisible(), true, 'Tour wraps to the last topic');
  await reading.getByRole('button', { name: 'Back to focus areas', exact: true }).click();
  await grid.waitFor({ state: 'visible' });
  return { ok: true, checks: ['grid/detail replacement', 'keyboard entry and focus return', 'tabs and related topics', 'twelve-topic tour and wrapping', 'navigation and content fit the viewport'] };
}

export async function runSmoke() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 566, height: 853 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      for (const theme of ['context-engine', 'classic-95']) {
        await page.goto(`${process.env.BASE_URL || 'http://127.0.0.1:3000'}/tests/fixtures/reverse-alignment-atlas.html`);
        await page.getByRole('combobox', { name: 'Theme' }).selectOption(theme);
        console.log(JSON.stringify({ viewport, theme, ...await probeReverseAlignmentAtlas(page) }));
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
