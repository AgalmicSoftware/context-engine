import assert from 'node:assert/strict';

// Run inside the browser so ancestor opacity and translucent surfaces count,
// not just the palette's foreground/background token values.
export const auditPanelContrast = (element, parentLevels = 0) => {
  let root = element;
  for (let index = 0; index < parentLevels; index += 1) root = root.parentElement;
  const parse = (value) => {
    const values = value.match(/[\d.]+/g)?.map(Number) || [];
    const normalized = value.startsWith('color(srgb ');
    return { rgb: values.slice(0, 3).map((channel) => (normalized ? channel * 255 : channel)), alpha: values[3] ?? 1 };
  };
  const blend = (foreground, background) =>
    foreground.rgb.map((channel, index) => channel * foreground.alpha + background[index] * (1 - foreground.alpha));
  const luminance = (rgb) =>
    rgb
      .map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const results = [];
  for (const node of [root, ...root.querySelectorAll('*')]) {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height || style.visibility === 'hidden' || node.getAttribute('aria-hidden') === 'true')
      continue;
    const text = [...node.childNodes]
      .filter((child) => child.nodeType === Node.TEXT_NODE)
      .map((child) => child.textContent.trim())
      .filter(Boolean)
      .join(' ');
    const isTextField = node.matches(
      'textarea, input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="color"]):not([type="file"])',
    );
    const placeholder = isTextField && !node.value ? node.getAttribute('placeholder') : '';
    const value = isTextField ? node.value : '';
    // An icon-only control drawn in currentColor: audit its color under its label.
    const iconLabel =
      node === root && !node.textContent.trim() && node.querySelector('svg') ? node.getAttribute('aria-label') || '' : '';
    if (!text && !placeholder && !value && !iconLabel) continue;
    const chain = [];
    for (let current = node; current; current = current.parentElement) chain.unshift(current);
    let backgrounds = [[255, 255, 255]];
    let opacity = 1;
    for (const ancestor of chain) {
      const ancestorStyle = getComputedStyle(ancestor);
      const color = parse(ancestorStyle.backgroundColor);
      color.alpha *= Number(ancestorStyle.opacity);
      backgrounds = backgrounds.map((background) => blend(color, background));
      // Treat every gradient stop as a possible surface behind the label. A
      // transparent backgroundColor alone misses dark gradient-based panels.
      const stops = ancestorStyle.backgroundImage.includes('gradient(')
        ? ancestorStyle.backgroundImage.match(/rgba?\([^)]*\)|color\(srgb [^)]*\)/g) || []
        : [];
      if (stops.length) {
        backgrounds = backgrounds.flatMap((background) =>
          stops.map((stop) => {
            const gradientColor = parse(stop);
            gradientColor.alpha *= Number(ancestorStyle.opacity);
            return blend(gradientColor, background);
          }),
        );
      }
      backgrounds = [...new Map(backgrounds.map((rgb) => [rgb.map(Math.round).join(','), rgb])).values()];
      opacity *= Number(ancestorStyle.opacity);
    }
    // Some graph labels intentionally stay invisible until their node is hovered.
    if (opacity === 0) continue;
    const textStyle = placeholder ? getComputedStyle(node, '::placeholder') : style;
    const textFill = isTextField && textStyle.webkitTextFillColor;
    const svgFill = node.matches('text, tspan') && textStyle.fill;
    const foreground = parse(textFill && textFill !== 'currentcolor' ? textFill : svgFill || textStyle.color);
    foreground.alpha *= opacity * (placeholder ? Number(textStyle.opacity) : 1);
    const ratios = backgrounds.map((background) => {
      const levels = [luminance(blend(foreground, background)), luminance(background)].sort((a, b) => b - a);
      return (levels[0] + 0.05) / (levels[1] + 0.05);
    });
    results.push({
      text: (text || placeholder || value || iconLabel).slice(0, 100),
      ratio: Math.min(...ratios),
    });
  }
  return { checked: results.length, failures: results.filter(({ ratio }) => !Number.isFinite(ratio) || ratio < 4.5) };
};

export const assertReadable = async (locator, parentLevels = 0) => {
  await locator.waitFor({ state: 'visible' });
  let result = await locator.evaluate(auditPanelContrast, parentLevels);
  // Modal entrance transitions briefly fade the entire panel. Retry the
  // assertion until it settles, while still failing persistent low contrast.
  const deadline = Date.now() + 3000;
  while ((!result.checked || result.failures.length) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    result = await locator.evaluate(auditPanelContrast, parentLevels);
  }
  assert(result.checked > 0, 'Panel has visible text to audit');
  assert.equal(result.failures.length, 0, `Panel contrast: ${JSON.stringify(result.failures)}`);
};

export async function clickQuestionAction(page, name) {
  const action = page.getByRole('button', { name, exact: true });
  if (!(await action.isVisible())) await page.getByRole('button', { name: 'Question actions', exact: true }).click();
  await action.click();
}

export async function inspectCivicOverlays(page) {
  const lock = page.getByRole('button', { name: 'Choose encryption audience', exact: true });
  await lock.click();
  const self = page.getByRole('button', { name: 'only me', exact: true });
  await assertReadable(self, 1);
  await page.getByRole('button', { name: 'Show Registry questionResponses gate Groups', exact: true }).click();
  await assertReadable(self, 1);
  await lock.click();

  await page.getByRole('button', { name: 'Conviction / importance', exact: true }).click();
  await assertReadable(page.getByRole('heading', { name: 'Conviction 0 Importance 0', exact: true }), 1);

  await page.getByTestId('ce-survey-additional-toggle').click();
  await assertReadable(page.getByRole('textbox', { name: 'Additional comments...', exact: true }), 3);
  await page.getByTestId('ce-survey-additional-lock').click();
  await assertReadable(self, 1);
  await page.getByTestId('ce-survey-additional-lock').click();
  await page.getByTestId('ce-survey-additional-toggle').click();

  await clickQuestionAction(page, 'Filter Questions');
  const filterTag = page.getByRole('dialog').locator('[class*="tagBubble_"]').first();
  await filterTag.click();
  assert.equal(await filterTag.getAttribute('aria-pressed'), 'true');
  await assertReadable(filterTag);
  await filterTag.press('Tab');
  await assertReadable(filterTag);
  await filterTag.click();
  for (const name of ['Most Popular', 'Question Types', 'AI Filter']) {
    await page.getByRole('heading', { name, exact: true }).click();
  }
  await assertReadable(page.getByRole('dialog'));
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });

  await clickQuestionAction(page, 'Open voice mode');
  await assertReadable(page.getByRole('dialog'));
  await page.getByRole('button', { name: /^Interview Talk/ }).click();
  await assertReadable(page.getByRole('dialog'));
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });

  await clickQuestionAction(page, 'View All Questions');
  const tags = page.getByRole('button', { name: 'Show question tags', exact: true }).first();
  await tags.click();
  await assertReadable(page.getByRole('menu'));
  await tags.click();
  await page.getByRole('button', { name: 'Back to pile view', exact: true }).click();
}
