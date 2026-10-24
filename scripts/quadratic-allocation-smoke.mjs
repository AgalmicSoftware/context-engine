import assert from 'node:assert/strict';

async function checkResponsePalettes(page) {
  const colorBlind = page.getByRole('checkbox', { name: 'Color-blind mode', exact: true });
  const values = await page.getByTestId('ce-quadratic-allocation').locator('input[type="range"]').evaluateAll(inputs => inputs.map(input => input.value));
  for (const enabled of [false, true, false]) {
    const selectedBefore = await page.locator('input[name="question-binary-smoke"]:checked').evaluateAll(inputs => inputs.map(input => input.value));
    await colorBlind.setChecked(enabled);
    assert.deepEqual(await page.locator('input[name="question-binary-smoke"]:checked').evaluateAll(inputs => inputs.map(input => input.value)), selectedBefore, 'Changing the palette preserves Agree/Disagree answers');
    const palette = await page.evaluate(() => {
      const luminance = color => {
        const channels = color.match(/[\d.]+/g).slice(0, 3).map(value => {
          const channel = Number(value) / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const classic = document.documentElement.dataset.ceTheme === 'classic-95';
      return {
        segments: [...document.querySelectorAll('[data-testid="ce-quadratic-meter"] span')].map(segment => ({
          direction: segment.dataset.direction, color: getComputedStyle(segment).backgroundColor,
        })),
        choices: [...document.querySelectorAll('input[name="question-binary-smoke"]')].map(input => {
          const label = input.closest('label');
          const style = getComputedStyle(label);
          const foreground = luminance(style.color);
          const background = luminance(style.backgroundColor);
          return {
            label: input.value,
            color: classic ? getComputedStyle(label, '::before').backgroundColor : style.backgroundColor,
            contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
          };
        }),
      };
    });
    const positive = palette.segments.find(segment => segment.direction === 'positive').color;
    const negative = palette.segments.find(segment => segment.direction === 'negative').color;
    assert.notEqual(positive, negative, 'Opposing allocations have distinct fills');
    if (enabled) {
      assert.equal(positive, 'rgb(86, 180, 233)', 'Support uses the bright blue fill in color-blind mode');
      assert.equal(negative, 'rgb(230, 159, 0)', 'Opposition uses the bright orange fill in color-blind mode');
      assert.equal(palette.choices.find(choice => choice.label === 'Agree').color, positive);
      assert.equal(palette.choices.find(choice => choice.label === 'Disagree').color, negative);
    } else {
      const support = positive.match(/\d+/g).map(Number);
      const opposition = negative.match(/\d+/g).map(Number);
      assert.ok(support[1] > support[0] && opposition[0] > opposition[1], 'Standard mode restores green/red fills');
    }
    for (const choice of palette.choices) {
      assert.ok(choice.contrast >= 4.5, `${choice.label} text has at least 4.5:1 contrast`);
      await page.getByRole('region', { name: 'Agree or disagree' }).getByText(choice.label, { exact: true }).click();
      assert.equal(await page.getByRole('radio', { name: choice.label, exact: true }).isChecked(), true);
    }
    assert.deepEqual(await page.getByTestId('ce-quadratic-allocation').locator('input[type="range"]').evaluateAll(inputs => inputs.map(input => input.value)), values, 'Changing the palette preserves allocations');
  }
}

async function checkStepperLayout(page) {
  const layout = await page.getByTestId('ce-quadratic-allocation').evaluate(field => {
    const luminance = color => {
      const channels = color.match(/[\d.]+/g).slice(0, 3).map(value => {
        const channel = Number(value) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const buttons = [...field.querySelectorAll('[data-testid^="ce-quadratic-decrease-"]')];
    return buttons.map(down => {
      const stepper = down.parentElement;
      const up = stepper.querySelector('[data-step="up"]');
      const count = down.nextElementSibling;
      const row = stepper.parentElement;
      const cost = row.lastElementChild;
      const a = down.getBoundingClientRect();
      const b = up.getBoundingClientRect();
      const c = count.getBoundingClientRect();
      const rowBounds = row.getBoundingClientRect();
      const label = row.querySelector('[data-quadratic-option-label]');
      return {
        left: a.x, right: b.x, count: count.textContent,
        countOverflow: count.scrollWidth - count.clientWidth,
        countOffset: Math.abs(c.x + c.width / 2 - (a.right + b.left) / 2),
        inline: label.getBoundingClientRect().bottom > a.top,
        stepperPosition: ((a.left + b.right) / 2 - rowBounds.left) / rowBounds.width,
        labelSize: parseFloat(getComputedStyle(row.querySelector('[data-quadratic-option-label]')).fontSize),
        overflow: row.scrollWidth - row.clientWidth,
        costOverflow: cost.scrollWidth - cost.clientWidth,
        icons: [down, up].map(button => {
          const rect = button.getBoundingClientRect();
          const icon = button.querySelector('svg').getBoundingClientRect();
          const style = getComputedStyle(button);
          const foreground = luminance(getComputedStyle(button.querySelector('svg')).color);
          const background = luminance(style.backgroundColor);
          return {
            x: Math.abs(rect.x + rect.width / 2 - icon.x - icon.width / 2),
            y: Math.abs(rect.y + rect.height / 2 - icon.y - icon.height / 2),
            size: icon.width,
            active: button.dataset.active === 'true',
            opacity: style.opacity,
            contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
          };
        }),
      };
    });
  });
  for (const row of layout) {
    assert.ok(Math.abs(row.left - layout[0].left) < 1 && Math.abs(row.right - layout[0].right) < 1, 'Stepper columns align across options');
    assert.match(row.count, /^\d+$/, 'Visible vote counts have no direction sign');
    assert.ok(row.countOffset < 1, 'Vote count stays centered between buttons');
    assert.ok(row.countOverflow <= 1, 'Vote digits fit between the buttons');
    if (row.inline) assert.ok(row.stepperPosition >= 0.4 && row.stepperPosition <= 0.6, 'Wide-row controls stay near the middle');
    assert.ok(row.labelSize >= 17, 'Option labels stay readable');
    assert.ok(row.overflow <= 1 && row.costOverflow <= 1, 'Rows and cost labels fit');
    for (const icon of row.icons) {
      assert.ok(icon.x < 1 && icon.y < 1 && icon.size >= 17, 'Large symbols are centered');
      if (icon.active) {
        assert.equal(icon.opacity, '1', 'Selected direction stays readable when disabled');
        assert.ok(icon.contrast >= 3, 'Highlighted button symbols have at least 3:1 contrast');
      }
    }
  }
}

// Browser probe for the shared respondent control and its compact pile layout.
export async function probeQuadraticAllocation(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const parks = page.getByTestId('ce-quadratic-vote-0');
  const transit = page.getByTestId('ce-quadratic-vote-1');
  const budget = page.getByTestId('ce-quadratic-budget');
  assert.equal(await page.getByText('Votes cost their square', { exact: true }).count(), 0, 'Squared-cost explanation stays in the help tooltip');
  await page.getByRole('button', { name: 'How voice credits work' }).press('Tab');
  assert.equal(await parks.evaluate(el => el === document.activeElement && el.matches(':focus-visible')), true);
  assert.match(await parks.evaluate(el => getComputedStyle(el.parentElement).outlineStyle), /dotted/);
  for (let i = 0; i < 7; i++) await parks.press('ArrowRight');
  for (let i = 0; i < 7; i++) await transit.press('ArrowLeft');
  assert.match(await budget.textContent(), /1 credit left/);
  assert.match(await page.getByTestId('ce-quadratic-cost-0').textContent(), /49 credits/);
  await parks.press('ArrowRight');
  assert.equal(await page.getByRole('alert').count(), 0);
  assert.match(await budget.textContent(), /1 credit left/);
  assert.equal(await page.getByTestId('ce-quadratic-increase-0').getAttribute('data-active'), 'true');
  assert.equal(await page.getByTestId('ce-quadratic-decrease-1').getAttribute('data-active'), 'true');
  assert.equal(await page.getByTestId('ce-quadratic-increase-0').isEnabled(), false);
  await checkStepperLayout(page);
  await checkResponsePalettes(page);
  await page.getByRole('button', { name: 'How voice credits work' }).hover();
  await page.getByRole('tooltip').waitFor();
  assert.match(await page.getByRole('tooltip').textContent(), /Votes cost their square:.*49 credits/);
  await page.getByRole('button', { name: 'How voice credits work' }).press('Tab');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  assert.equal(await page.getByTestId('ce-quadratic-saved').textContent(), '[7,-7,0]');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  assert.match(await budget.textContent(), /99 credits left/);
  await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  assert.match(await budget.textContent(), /1 credit left/);
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
  assert.equal(geometry.inline, geometry.inputWidth > 360, 'Controls share the title row when space allows');
  assert.ok(geometry.scrollWidth <= geometry.pageWidth, 'No horizontal overflow');
  assert.equal(geometry.hasSharedControls, false, 'Submit and progress stay outside the card');
  const before = await page.getByTestId('ce-quadratic-pile-card').boundingBox();
  await page.getByRole('checkbox', { name: 'Many options', exact: true }).check();
  const first = page.getByTestId('ce-quadratic-vote-0');
  await first.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="ce-quadratic-scroll-more"]');
    const list = button && document.getElementById(button.getAttribute('aria-controls'));
    if (!list) return false;
    const bounds = list.getBoundingClientRect();
    return [...list.querySelectorAll('[data-quadratic-option-label]')].some(label => {
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
  assert.deepEqual(await more.boundingBox(), downPosition, 'Down arrow returns to its fixed position');
  const returnedToTop = await more.evaluate(button => document.getElementById(button.getAttribute('aria-controls')).scrollTop <= 1);
  assert.equal(await up.count(), returnedToTop ? 0 : 1, 'Up arrow hides only at the top');
  if (!returnedToTop) assert.deepEqual(await up.boundingBox(), upPosition, 'Up arrow stays in place');
  assert.equal(await page.getByTestId('ce-quadratic-answer-updates').textContent(), updatesBefore, 'Scrolling does not change answers');
  const resetBounds = await page.getByRole('button', { name: 'Reset', exact: true }).boundingBox();
  const helpBounds = await page.getByRole('button', { name: 'How voice credits work' }).boundingBox();
  const center = (bounds) => bounds.y + bounds.height / 2;
  for (const bounds of [resetBounds, helpBounds]) {
    assert.ok(Math.abs(center(bounds) - center(budgetBefore)) < 2, 'Credits, help and reset share a row');
  }
  const last = page.getByTestId('ce-quadratic-vote-7');
  await last.focus();
  await last.press('ArrowRight');
  assert.equal(await last.inputValue(), '1');
  const budgetAfter = await budget.boundingBox();
  assert.equal(budgetAfter.y, budgetBefore.y, 'Budget stays visible as options scroll');
  const lastBounds = await last.boundingBox();
  assert.ok(lastBounds.y + lastBounds.height <= after.y + after.height, 'Last slider is reachable');
  await page.getByRole('combobox', { name: 'Voice credits' }).selectOption('999');
  await parks.press('End');
  for (let i = 0; i < 6; i++) await transit.press('ArrowLeft');
  await page.getByTestId('ce-quadratic-vote-2').press('ArrowRight');
  await page.getByTestId('ce-quadratic-vote-3').press('ArrowLeft');
  assert.match(await budget.textContent(), /^0 credits left$/);
  await checkStepperLayout(page);
  assert.equal(await page.getByTestId('ce-quadratic-squares-0').getAttribute('data-solid'), '');
  assert.equal(await page.getByTestId('ce-quadratic-squares-1').locator('i').count(), 36);
  assert.ok(await page.getByTestId('ce-quadratic-meter').evaluate(el => {
    const bounds = el.getBoundingClientRect();
    return el.scrollWidth <= el.clientWidth && el.lastElementChild.getBoundingClientRect().right <= bounds.right + 1;
  }), 'Full-budget meter contains even subpixel one-credit segments');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByTestId('ce-quadratic-decrease-0').click();
  assert.equal(await parks.inputValue(), '-1');
  assert.equal(await parks.evaluate(el => el.matches(':focus-visible')), false, 'Pointer shortcuts do not show the keyboard ring');
  await parks.press('ArrowRight');
  assert.equal(await page.getByTestId('ce-quadratic-decrease-0').getAttribute('data-active'), 'false');
  await page.getByRole('combobox', { name: 'Voice credits' }).selectOption('1000000');
  await parks.press('End');
  assert.equal(await parks.inputValue(), '1000');
  await checkStepperLayout(page);
  return { ok: true, checks: ['standard and color-blind allocation fills', 'readable Agree/Disagree in both palettes', 'keyboard sliders and focus', 'unsigned counts with direction highlight', 'aligned centered steppers', 'large readable labels', 'per-option costs', 'descriptive tooltip', 'signed values', 'budget enforcement', 'neutrality', 'draft restore', 'net and positive/negative totals', 'compact rows', 'fixed card height', 'half-label overflow cue', 'scroll to final option', 'scroll arrow', 'one header row', '999-credit meter and cost squares'] };
}

export async function runSmoke({ paletteOnly = false } = {}) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 551, height: 803 }, { width: 390, height: 844 }, { width: 280, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      for (const theme of ['context-engine', 'classic-95', 'civic']) {
        await page.goto(`${process.env.BASE_URL || 'http://127.0.0.1:3000'}/tests/fixtures/quadratic-allocation.html`);
        await page.getByRole('combobox', { name: 'Theme' }).selectOption(theme);
        if (paletteOnly) {
          await page.getByRole('button', { name: 'Show example allocation', exact: true }).click();
          await checkResponsePalettes(page);
          console.log(JSON.stringify({ viewport, theme, ok: true, checks: ['standard and color-blind allocation fills', 'readable Agree/Disagree in both palettes', 'palette changes preserve answers'] }));
        } else {
          console.log(JSON.stringify({ viewport, theme, ...await probeQuadraticAllocation(page) }));
        }
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
