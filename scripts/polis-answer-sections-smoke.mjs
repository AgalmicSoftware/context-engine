import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export async function probeColorVision(page, reload) {
  const toggle = page.getByTestId('ce-settings-color-blind');
  const theme = page.getByTestId('ce-settings-theme');
  const original = await page.evaluate(() => ({
    enabled: document.documentElement.dataset.ceColorVision === 'color-blind',
    theme: document.querySelector('[data-testid="ce-settings-theme"]').value,
  }));
  const readPalette = () => page.evaluate(() => {
    const bar = document.querySelector('svg[aria-label="Agree 2, unsure 1, disagree 1"]');
    return {
      mode: document.documentElement.dataset.ceColorVision,
      theme: document.documentElement.dataset.ceTheme,
      checked: document.querySelector('[data-testid="ce-settings-color-blind"]').checked,
      bar: bar ? [...bar.querySelectorAll('rect')].slice(1).map((node) => getComputedStyle(node).fill) : [],
      choices: [...document.querySelectorAll('input[name="question-palette-preview"]')].map((node) => getComputedStyle(node.closest('label'), document.documentElement.dataset.ceTheme === 'classic-95' ? '::before' : null).backgroundColor),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  try {
    for (const id of ['context-engine', 'classic-95']) {
      await theme.selectOption(id);
      await toggle.setChecked(false);
      const standard = await readPalette();
      assert.equal(standard.bar.length, 3, 'Actual report must render all three response colors');
      assert.deepEqual(standard.bar, standard.choices, 'Report bars must match the shared pile input');
      await toggle.setChecked(true);
      const accessible = await readPalette();
      assert.equal(accessible.mode, 'color-blind');
      assert.deepEqual(accessible.bar, ['rgb(86, 180, 233)', 'rgb(184, 190, 199)', 'rgb(230, 159, 0)']);
      assert.deepEqual(accessible.bar, accessible.choices);
      assert.equal(accessible.overflow, false, 'Theme setting and report must fit mobile');
      await reload();
      await toggle.waitFor();
      await page.getByRole('img', { name: 'Agree 2, unsure 1, disagree 1', exact: true }).first().waitFor();
      const restored = await readPalette();
      assert.equal(restored.checked, true, 'Checkbox must restore after reload');
      assert.equal(restored.theme, id, 'Color preference must preserve the app theme');
      assert.deepEqual(restored.bar, accessible.bar, 'Reload must preserve response colors');
    }
  } finally {
    await theme.selectOption(original.theme);
    await toggle.setChecked(original.enabled);
  }
}

export async function probePolisAnswerSections(page) {
  const ratings = page.getByTestId('ce-polis-answers-rating');
  await ratings.waitFor();
  for (const value of ['8 (4 Binary)', '10 (1 Binary)', '33 (4 Binary)', '4.13 (1.00 Binary)']) {
    assert.equal(await page.getByText(value, { exact: true }).count(), 1, `Summary must include all answer types: ${value}`);
  }
  assert.equal(await ratings.locator('article').count(), 1, 'Answer sections must start with previews open');
  const followsGraph = await page.getByTestId('ce-polis-answer-sections').evaluate((sections) => {
    const headings = [...document.querySelectorAll('h5')];
    const graph = headings.find((node) => node.textContent.includes('Participants Graph'));
    const all = document.querySelector('[data-testid="ce-polis-all-questions"]');
    return !!(graph.compareDocumentPosition(sections) & Node.DOCUMENT_POSITION_FOLLOWING)
      && all.contains(sections);
  });
  assert.ok(followsGraph, 'Question types must be nested in All Questions below the graph');
  assert.equal(await ratings.locator('article').count(), 1);
  await ratings.getByRole('button', { name: 'View more (2)', exact: true }).click();
  assert.equal(await ratings.getByRole('heading', { name: 'How safe do you feel walking after dark?' }).count(), 1);
  const parent = page.getByRole('button', { name: 'All Questions', exact: true });
  await parent.click();
  assert.equal(await ratings.isVisible(), false, 'Parent collapse hides every type');
  await parent.click();
  assert.equal(await ratings.locator('article').count(), 3, 'Parent collapse preserves type expansion');
  const binary = page.getByTestId('ce-polis-answers-binary');
  assert.equal(await binary.getByRole('img', { name: 'Agree 2, unsure 1, disagree 1', exact: true }).count(), 1);
  const written = page.getByTestId('ce-polis-answers-freeform');
  assert.equal(await written.locator('p').count(), 3);
  assert.equal(await written.getByRole('button', { name: /Show all/ }).count(), 0);
  await written.getByRole('button', { name: 'View more (2)', exact: true }).click();
  assert.equal(await written.locator('p').count(), 5, 'Single control expands hidden answers and questions');
  assert.equal(await written.getByRole('button').count(), 2, 'Only the section header and one expansion control');
  await written.getByRole('button', { name: 'View less', exact: true }).click();
  for (const theme of ['context-engine', 'classic-95']) {
    await page.getByTestId('ce-settings-theme').selectOption(theme);
    const button = await written.getByRole('button', { name: 'View more (2)', exact: true }).evaluate((node) => {
      const css = getComputedStyle(node);
      return { radius: parseFloat(css.borderRadius), shadow: css.boxShadow, color: css.color, background: css.backgroundColor };
    });
    assert.ok(button.radius >= 20, `${theme}: expansion buttons must be rounded`);
    assert.equal(button.shadow, 'none', `${theme}: expansion buttons must have no heavy theme shadow`);
    const luminance = (color) => {
      const rgb = color.match(/[\d.]+/g).slice(0, 3).map((value) => {
        const channel = Number(value) / (color.startsWith('color(srgb ') ? 1 : 255);
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const text = luminance(button.color);
    const background = luminance(button.background);
    const contrast = (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
    assert.ok(contrast >= 4.5, `${theme}: expansion text must meet 4.5:1 contrast (got ${contrast.toFixed(2)}, ${button.color} on ${button.background})`);
  }
  await page.getByTestId('ce-settings-theme').selectOption('context-engine');
  await page.getByRole('combobox', { name: 'Question tag' }).selectOption('housing');
  assert.equal(await page.getByText('How well does local transport work?').count(), 0);
  assert.equal(await page.getByTestId('ce-polis-answers-multichoice').count(), 0);
  assert.equal(await written.getByRole('button', { name: /View more/ }).count(), 0, 'Filtering must update the remaining count');
  assert.equal(await page.getByText('Summary and Statistics', { exact: true }).count(), 1, 'Nonbinary-only filters retain the summary');
  for (const value of ['2 (0 Binary)', '3 (0 Binary)', '4 (0 Binary)', '2.00 (0.00 Binary)']) {
    assert.equal(await page.getByText(value, { exact: true }).count(), 1, `Summary must follow filters: ${value}`);
  }
  await page.getByRole('combobox', { name: 'Question tag' }).selectOption('empty');
  assert.equal(await page.getByText('No readable responses match the current filters.').count(), 1);
  await page.getByRole('combobox', { name: 'Question tag' }).selectOption('');
  const voteWidths = await page.getByTestId('ce-polis-answers-quadratic').locator('li').evaluateAll((rows) => rows.slice(0, 2).map((row) => row.querySelectorAll('i')[1].getBoundingClientRect().width));
  assert.ok(Math.abs(voteWidths[0] / voteWidths[1] - 7 / 5) < .02, 'Quadratic bar lengths must share a linear scale');
  const overflow = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="ce-polis-answers-"]')].some((el) => el.scrollWidth > el.clientWidth + 1));
  assert.equal(overflow, false, 'Response sections must not overflow on mobile');
}

export async function probeBuiltInPolisDemo(page, slug) {
  await page.goto(`${process.env.BASE_URL || 'http://127.0.0.1:3011'}/session/${slug}`);
  const results = page.getByRole('heading', { name: 'Results View', exact: true });
  await results.waitFor();
  const onboarding = page.getByTestId('ce-onboarding-overlay');
  if (await onboarding.count()) {
    await onboarding.getByRole('button', { name: 'Skip', exact: true }).click();
    await onboarding.waitFor({ state: 'detached' });
  }
  await results.click();
  const binary = page.getByTestId('ce-polis-answers-binary');
  await binary.locator('[data-pdf-keep-together]').first().waitFor();
  assert.equal(await binary.locator('[data-pdf-keep-together]').count(), 5);
  await binary.getByRole('button', { name: /^View more/ }).click();
  assert.ok(await binary.locator('[data-pdf-keep-together]').count() > 5);
  await binary.getByRole('button', { name: 'View less', exact: true }).click();
  assert.equal(await binary.locator('[data-pdf-keep-together]').count(), 5);
  for (const type of ['freeform', 'rating', 'multichoice', 'quadratic']) {
    const section = page.getByTestId(`ce-polis-answers-${type}`);
    await section.waitFor();
    assert.equal(await section.locator('article').count(), 1, `${slug}: preview one ${type} question`);
    await section.getByRole('button', { name: /^View more/ }).click();
    assert.ok(await section.locator('article').count() > 1, `${slug}: expand ${type} questions`);
    await section.getByRole('button', { name: 'View less', exact: true }).click();
  }
  const quadratic = page.getByTestId('ce-polis-answers-quadratic');
  assert.equal(await quadratic.getByText('8 responses', { exact: true }).count(), 1);
  assert.equal(await quadratic.getByText('−11', { exact: true }).count(), 2);
}

export async function runSmoke() {
  const browsers = await import('playwright');
  const browser = await browsers[process.env.BROWSER || 'chromium'].launch({ headless: true });
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      page.on('console', (message) => { if (message.type() === 'error') console.error(message.text()); });
      page.on('pageerror', (error) => console.error(error));
      await page.addInitScript(() => { window.CE_LOGGING = { enabled: true, categories: { surveys: true }, levels: { error: true } }; });
      await page.goto(`${process.env.BASE_URL || 'http://127.0.0.1:3011'}/tests/fixtures/polis-answer-sections.html`);
      await probePolisAnswerSections(page);
      await probeColorVision(page, () => page.reload());
      if (process.env.OUTPUT_DIR) {
        await page.getByTestId('ce-settings-color-blind').setChecked(true);
        await page.screenshot({ path: `${process.env.OUTPUT_DIR}/polis-answers-${viewport.width}.png`, fullPage: true });
        await page.getByRole('button', { name: 'Show report settings' }).click();
        await page.getByRole('button', { name: 'All Questions', exact: true }).click();
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download as PDF' }).click();
        await (await download).saveAs(`${process.env.OUTPUT_DIR}/polis-answers-${viewport.width}.pdf`);
        await page.getByRole('button', { name: 'All Questions', exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'All Questions', exact: true }).getAttribute('aria-expanded'), 'false', 'PDF restores the parent collapse state');
        await page.getByRole('button', { name: 'All Questions', exact: true }).click();
        assert.equal(await page.getByTestId('ce-polis-answer-sections').locator('article').count(), 4, 'Reopening All Questions displays every preview');
        for (const title of ['Freeform', 'Ratings', 'Multiple choice', 'Quadratic allocation']) {
          assert.equal(await page.getByRole('button', { name: title, exact: true }).getAttribute('aria-expanded'), 'true');
        }
        await page.screenshot({ path: `${process.env.OUTPUT_DIR}/polis-answers-open-${viewport.width}.png`, fullPage: true });
      }
      if (process.env.BUILT_IN_DEMOS === '1') {
        for (const slug of ['demo', 'demo-2']) await probeBuiltInPolisDemo(page, slug);
      }
      console.log(JSON.stringify({ ok: true, viewport, checks: ['all-type statistics with binary subset', 'filtered nonbinary summary', 'previews open by default', 'question types nested under All Questions', 'parent reopen opens all previews', 'top question', 'single view more control', 'rounded buttons in both themes', 'tag filters', 'empty sections', 'mobile overflow', 'shared response colors', 'color-blind mode in both themes', 'reload persistence', ...(process.env.OUTPUT_DIR ? ['color-blind PDF download', 'expansion restored'] : [])] }));
      await page.close();
    }
  } finally { await browser.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runSmoke();
