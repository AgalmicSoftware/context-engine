import assert from 'node:assert/strict';
import { inspectSessionSelectorLayout } from './session-selector-layout-smoke.mjs';
import { assertReadable } from './civic-theme-overlay-smoke.mjs';

// Exercise the light surfaces that palette-only contrast tests cannot cover.
// This workflow opens read-only views; it never creates, joins, or submits.
export async function inspectCivicExplorerContent(page) {
  const body = page.locator('body');
  const back = page.getByRole('button', { name: '← Back', exact: true });
  const open = async (name) => {
    await page.getByText(name, { exact: true }).click();
    await back.waitFor({ state: 'visible' });
    const control = page.getByTestId('ce-tool-explorer-active-session');
    await control.waitFor({ state: 'visible' });
    await inspectSessionSelectorLayout(control, 'right');
    const help = page.getByRole('button', { name: `About ${name}`, exact: true });
    await help.press('Enter');
    const helpId = await help.getAttribute('aria-describedby');
    assert(helpId, `${name}: explicit help describes its button`);
    await page.locator(`[id="${helpId}"]`).waitFor({ state: 'visible' });
    assert.equal(await help.getAttribute('aria-expanded'), 'true');
    await help.press('Escape');
    assert.equal(await help.getAttribute('aria-expanded'), 'false');
    await page.locator(`[id="${helpId}"]`).waitFor({ state: 'hidden' });
    if (name === 'Groups' || name === 'Context') {
      const primary = await control.evaluate((element) => {
        const group = element.closest('[class*="expandedHeaderPrimaryControls_"]');
        const back = group?.querySelector('button');
        const help = group?.querySelector('button[aria-expanded]');
        const rects = [back, help, element].map((control) => control?.getBoundingClientRect());
        return {
          viewport: innerWidth,
          grouped: rects.every(Boolean),
          fits: rects.every((rect) => rect && rect.left >= 0 && rect.right <= innerWidth),
          centers: rects.map((rect) => rect ? rect.top + rect.height / 2 : 0),
        };
      });
      assert(primary.grouped && primary.fits, `${name}: Back, help, and Session stay in their primary group`);
      if (primary.viewport >= 560) {
        assert(Math.max(...primary.centers) - Math.min(...primary.centers) < 2, `${name}: primary controls share a row when space permits`);
      }
    }
    if (name === 'Questions' || name === 'Groups') {
      const action = page.getByTestId(name === 'Questions' ? 'ce-survey-toolbar' : 'ce-sbts-create-toggle');
      await action.waitFor({ state: 'visible' });
      assert.equal(await action.count(), 1, `${name}: only one action toolbar is mounted`);
      const layout = await action.evaluate((element) => {
        const row = element.closest('[class*="expandedHeaderRow_"]');
        const rowRect = row?.getBoundingClientRect();
        const regions = row ? Array.from(row.children).filter((child) => child.getBoundingClientRect().width > 0) : [];
        return {
          inHeader: Boolean(row),
          viewport: innerWidth,
          fits: Boolean(rowRect) && regions.every((child) => {
            const rect = child.getBoundingClientRect();
            return rect.left >= rowRect.left - 1 && rect.right <= rowRect.right + 1;
          }),
          centers: regions.map((child) => {
            const rect = child.getBoundingClientRect();
            return rect.top + rect.height / 2;
          }),
        };
      });
      assert(layout.inHeader, `${name}: actions share the Explorer header`);
      assert(layout.fits, `${name}: wrapped header regions stay within the available width`);
      if (layout.viewport >= 1100) {
        assert(Math.max(...layout.centers) - Math.min(...layout.centers) < 2, `${name}: roomy desktop controls share one row`);
      }
    }
    const header = await control.evaluate((element) => {
      const wrapper = element.closest('[class*="expandedHeaderSession_"]');
      const row = wrapper?.closest('[class*="expandedHeaderPrimaryControls_"]') || wrapper?.closest('[class*="expandedHeaderRow_"]');
      return {
        value: element.value,
        label: element.selectedOptions[0]?.textContent.trim(),
        width: element.getBoundingClientRect().width,
        right: wrapper?.getBoundingClientRect().right,
        rowRight: row?.getBoundingClientRect().right,
      };
    });
    assert(header.width >= 100, `${name}: session dropdown has readable width`);
    assert(header.right && header.rowRight && Math.abs(header.rowRight - header.right) < 10, `${name}: session control is at the header's right edge`);
    if (header.value) assert(header.label.endsWith(`(${header.value})`), `${name}: selected option includes its slug`);
    else assert.equal(header.label, 'General');
    const link = page.getByTestId('ce-tool-explorer-active-session-link');
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
    const destination = new URL(await link.getAttribute('href'), page.url());
    assert(destination.pathname.endsWith(header.value ? `/session/${encodeURIComponent(header.value)}` : '/session'), `${name}: external icon links to the selected session`);
  };
  await assertReadable(body);

  await open('Risks');
  const cell = page.getByRole('button', { name: /^Capabilities versus Safety,.*Open aggregated notes\.$/ });
  await cell.waitFor({ state: 'visible' });
  await assertReadable(body);
  await cell.click();
  await assertReadable(page.getByRole('dialog'));
  await page.getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await back.click();

  await open('Groups');
  const sessionSelector = page.getByTestId('ce-tool-explorer-active-session');
  await sessionSelector.waitFor({ state: 'visible' });
  assert.equal(await sessionSelector.getAttribute('aria-label'), 'Active session');
  const sessionSelection = await sessionSelector.evaluate((element) => ({
    value: element.value,
    selected: element.selectedOptions[0]?.value,
    name: element.selectedOptions[0]?.textContent.trim(),
    hasGeneral: Array.from(element.options).some((option) => option.value === ''),
  }));
  assert.equal(sessionSelection.value, sessionSelection.selected);
  assert(sessionSelection.name, 'The active session name is visible');
  assert(sessionSelection.hasGeneral, 'General is available in the session chooser');
  await sessionSelector.press('Tab');
  await page.getByText('e/acc', { exact: true }).waitFor({ state: 'visible', timeoutMs: 30000 });
  await assertReadable(body);
  await back.click();

  await open('Context');
  await sessionSelector.waitFor({ state: 'visible' });
  assert.equal(await sessionSelector.getAttribute('aria-label'), 'Active session');
  assert.equal(await page.getByTestId('ce-database-session-selector-toggle').count(), 0);
  const inheritedContextSession = await sessionSelector.inputValue();
  await sessionSelector.selectOption('');
  assert.equal(await sessionSelector.inputValue(), '');
  const inheritOptionValue = await sessionSelector.getByRole('option', { name: /^Use global default/ }).getAttribute('value');
  assert(inheritOptionValue, 'Context offers an explicit return to the global session');
  await sessionSelector.selectOption(inheritOptionValue);
  assert.equal(await sessionSelector.inputValue(), inheritedContextSession);
  await page.getByRole('button', { name: 'View', exact: true }).waitFor({ state: 'visible' });
  await assertReadable(body);
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Demo corpus', exact: true }).check();
  for (const name of [
    'Cross-Corpus',
    'Tweets',
    'Laws & Policy',
    'Papers',
    'LessWrong',
    'Insider Interviews',
    'Sci-Fi',
    'Metrics',
  ]) {
    const category = page.getByRole('button', { name, exact: true }).and(page.locator('[aria-pressed]'));
    // Keyboard activation also covers category tabs beyond the horizontal scroll area.
    await category.press('Enter');
    await category.and(page.locator('[aria-pressed="true"]')).waitFor({ state: 'visible' });
    await page.getByRole('article').first().waitFor({ state: 'visible' });
    assert.equal(await category.getAttribute('aria-pressed'), 'true');
    await assertReadable(body);
  }
  await back.click();

  await open('Questions');
  await page.getByRole('button', { name: 'View JSON', exact: true }).waitFor({ state: 'visible', timeoutMs: 30000 });
  await assertReadable(body);
  await back.click();

  await open('Debate Map');
  await page.getByRole('heading', { name: 'Debate Map', exact: true }).waitFor({ state: 'visible' });
  await assertReadable(body);
  await page.getByRole('button', { name: 'Top Debates', exact: true }).click();
  await assertReadable(body);
  const hoverNode = page.getByRole('button', { name: 'Safety Evaluations', exact: true });
  // Move the pointer without following the node's primary-click navigation.
  await hoverNode.click({ button: 'right' });
  await hoverNode.press('Escape');
  const hoverStyle = await hoverNode.evaluate((element) => ({
    hovered: element.matches(':hover'),
    labelBackground: getComputedStyle(element.querySelector('[class*="nodeLabel_"]')).backgroundColor,
    shadow: getComputedStyle(element.querySelector('[class*="nodeDot_"]')).boxShadow,
    transform: getComputedStyle(element.querySelector('[class*="nodeDot_"]')).transform,
  }));
  assert(hoverStyle.hovered, 'Packed node hover is exercised');
  assert.equal(hoverStyle.labelBackground, 'rgba(0, 0, 0, 0)', 'Hover labels do not cover circles with rectangles');
  assert.equal(hoverStyle.shadow, 'none');
  assert.equal(hoverStyle.transform, 'none');
  await page.getByRole('button', { name: 'Tree', exact: true }).click();
  await assertReadable(body);
  await page.getByRole('button', { name: 'AI Safety & Alignment', exact: true }).click();
  await assertReadable(body);
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await assertReadable(body);
  await inspectCivicDebateDetails(page);
  await back.click();
}

export async function inspectCivicDebateDetails(page) {
  await page.getByRole('button', { name: 'Liability Frameworks', exact: true }).click();
  const modal = page.locator('[class*="modalContent_"]');
  await modal.getByRole('button', { name: 'Historical Cases (1) Show', exact: true }).click();
  await assertReadable(modal);
  await modal.getByRole('button', { name: 'View full brief', exact: true }).click();
  await modal.getByRole('button', { name: 'Questions (6) Show', exact: true }).click();
  await assertReadable(modal);
  await modal.getByRole('button', { name: 'Close', exact: true }).click();
  await modal.waitFor({ state: 'hidden' });
}
