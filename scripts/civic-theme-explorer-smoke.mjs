import assert from 'node:assert/strict';
import { assertReadable } from './civic-theme-overlay-smoke.mjs';

// Exercise the light surfaces that palette-only contrast tests cannot cover.
// This workflow opens read-only views; it never creates, joins, or submits.
export async function inspectCivicExplorerContent(page) {
  const body = page.locator('body');
  const back = page.getByRole('button', { name: '← Back', exact: true });
  const open = async (name) => {
    await page.getByText(name, { exact: true }).click();
    await back.waitFor({ state: 'visible' });
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
  await page.getByText('e/acc', { exact: true }).waitFor({ state: 'visible', timeoutMs: 30000 });
  await assertReadable(body);
  await back.click();

  await open('Context');
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
