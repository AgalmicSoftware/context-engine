import assert from 'node:assert/strict';

// Browser probe for the shared respondent control and its compact pile layout.
export async function probeQuadraticAllocation(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const parks = page.getByTestId('ce-quadratic-vote-0');
  const transit = page.getByTestId('ce-quadratic-vote-1');
  const budget = page.getByTestId('ce-quadratic-budget');
  for (let i = 0; i < 7; i++) await parks.press('ArrowRight');
  for (let i = 0; i < 7; i++) await transit.press('ArrowLeft');
  assert.match(await budget.textContent(), /1 credits left/);
  assert.match(await page.getByTestId('ce-quadratic-cost-0').textContent(), /49 credits/);
  await parks.press('ArrowRight');
  assert.equal(await page.getByRole('alert').count(), 0);
  assert.match(await budget.textContent(), /1 credits left/);
  await page.getByRole('button', { name: 'How voice credits work' }).click();
  assert.match(await page.getByRole('tooltip').textContent(), /49 credits/);
  await page.getByRole('button', { name: 'How voice credits work' }).press('Tab');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  assert.equal(await page.getByTestId('ce-quadratic-saved').textContent(), '[7,-7,0]');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  assert.match(await budget.textContent(), /99 credits left/);
  await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  assert.match(await budget.textContent(), /1 credits left/);
  await page.getByRole('button', { name: 'Submit locally', exact: true }).click();
  for (let i = 0; i < 9; i++) await parks.press('ArrowLeft');
  for (let i = 0; i < 12; i++) await transit.press('ArrowRight');
  await page.getByRole('button', { name: 'Submit locally', exact: true }).click();
  const rows = page.getByTestId('ce-quadratic-results').getByRole('row');
  assert.match(await rows.nth(1).textContent(), /Parks7-25/);
  assert.match(await rows.nth(2).textContent(), /Transit5-7-2/);
  const geometry = await page.evaluate(() => {
    const container = document.querySelector('[data-testid="ce-quadratic-pile-card"]');
    const sliders = container.querySelectorAll('input[type="range"]');
    return {
      inline: (() => {
        const input = sliders[0].getBoundingClientRect();
        const label = container.querySelector('label').getBoundingClientRect();
        return input.left >= label.right && input.top < label.bottom && input.bottom > label.top;
      })(),
      inputWidth: container.querySelector('fieldset').clientWidth,
      pageWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      hasSharedControls: /Submit locally|Question 3 of 12/.test(container.textContent),
    };
  });
  assert.ok(await page.getByTestId('ce-quadratic-pile-card').evaluate(el => el.querySelector('.card').getBoundingClientRect().height <= el.clientHeight + 1), 'Pile retains the standard card height');
  assert.equal(geometry.inline, geometry.inputWidth >= 420, 'Slider shares the title row when space allows');
  assert.ok(geometry.scrollWidth <= geometry.pageWidth, 'No horizontal overflow');
  assert.equal(geometry.hasSharedControls, false, 'Submit and progress stay outside the card');
  const before = await page.getByTestId('ce-quadratic-pile-card').boundingBox();
  await page.getByRole('checkbox', { name: 'Many options', exact: true }).check();
  const first = page.getByTestId('ce-quadratic-vote-0');
  await first.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const slider = document.querySelector('[data-testid="ce-quadratic-vote-0"]');
    const list = slider.parentElement.parentElement;
    const bounds = list.getBoundingClientRect();
    return [...list.querySelectorAll('label')].some(label => {
      const r = label.getBoundingClientRect();
      return r.top < bounds.bottom && r.bottom > bounds.bottom;
    });
  });
  const after = await page.getByTestId('ce-quadratic-pile-card').boundingBox();
  assert.equal(after.height, before.height, 'Adding options must not grow the card');
  const budgetBefore = await budget.boundingBox();
  const more = page.getByTestId('ce-quadratic-scroll-more');
  assert.equal(await more.isEnabled(), true);
  assert.ok(await more.evaluate(button => {
    const list = document.getElementById(button.getAttribute('aria-controls'));
    return button.getBoundingClientRect().top >= list.getBoundingClientRect().bottom - 1;
  }), 'Scroll arrow sits below the options');
  const downPosition = await more.boundingBox();
  const updatesBefore = await page.getByTestId('ce-quadratic-answer-updates').textContent();
  for (let step = 0; step < 12 && await more.count(); step++) {
    assert.deepEqual(await more.boundingBox(), downPosition, 'Down arrow stays in place');
    const previousTop = await more.evaluate(button => document.getElementById(button.getAttribute('aria-controls')).scrollTop);
    if (step === 0) await more.press('Enter');
    else await more.click();
    await page.waitForFunction(previous => {
      const button = document.querySelector('[data-testid="ce-quadratic-scroll-more"]');
      if (!button) return true;
      const list = document.getElementById(button.getAttribute('aria-controls'));
      const atEnd = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
      return list.scrollTop > previous && !atEnd;
    }, previousTop);
  }
  assert.equal(await more.count(), 0, 'Down arrow hides at the last option');
  const up = page.getByRole('button', { name: 'Scroll to previous options' });
  assert.equal(await up.count(), 1);
  const upPosition = await up.boundingBox();
  await up.click();
  await more.waitFor();
  assert.deepEqual(await up.boundingBox(), upPosition, 'Up arrow stays in place');
  assert.deepEqual(await more.boundingBox(), downPosition, 'Down arrow returns to its fixed position');
  assert.equal(await up.count(), 1, 'Both directions are available in the middle');
  assert.equal(await page.getByTestId('ce-quadratic-answer-updates').textContent(), updatesBefore, 'Scrolling does not change answers');
  const resetBounds = await page.getByRole('button', { name: 'Reset', exact: true }).boundingBox();
  const opposeBounds = await page.getByText('− Oppose', { exact: true }).boundingBox();
  const supportBounds = await page.getByText('+ Support', { exact: true }).boundingBox();
  const center = (bounds) => bounds.y + bounds.height / 2;
  for (const bounds of [resetBounds, opposeBounds, supportBounds]) {
    assert.ok(Math.abs(center(bounds) - center(budgetBefore)) < 2, 'Oppose, credits, support, and reset share a row');
  }
  const last = page.getByTestId('ce-quadratic-vote-7');
  await last.focus();
  await last.press('ArrowRight');
  assert.equal(await last.inputValue(), '1');
  const budgetAfter = await budget.boundingBox();
  assert.equal(budgetAfter.y, budgetBefore.y, 'Budget stays visible as options scroll');
  const lastBounds = await last.boundingBox();
  assert.ok(lastBounds.y + lastBounds.height <= after.y + after.height, 'Last slider is reachable');
  return { ok: true, checks: ['keyboard sliders', 'per-option costs', 'descriptive tooltip', 'signed votes', 'budget enforcement', 'neutrality', 'draft restore', 'net and positive/negative totals', 'compact rows', 'fixed card height', 'half-label overflow cue', 'scroll to final option', 'scroll arrow', 'one control row'] };
}

export async function runSmoke() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 551, height: 803 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      for (const theme of ['context-engine', 'classic-95']) {
        await page.goto(`${process.env.BASE_URL || 'http://127.0.0.1:3000'}/tests/fixtures/quadratic-allocation.html`);
        await page.getByRole('combobox', { name: 'Theme' }).selectOption(theme);
        console.log(JSON.stringify({ viewport, theme, ...await probeQuadraticAllocation(page) }));
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
