import { assertReadable, clickQuestionAction } from './civic-theme-overlay-smoke.mjs';

// Uses disposable local drafts only; never generates with AI or submits content.
export async function inspectCivicAuthoring(page) {
  await clickQuestionAction(page, 'Create New Question');
  const panel = page.locator('[class*="createSurveyContainer_"]');
  await panel.waitFor({ state: 'visible' });
  const manual = panel.getByRole('button', { name: 'Manual', exact: true });
  if (await manual.isVisible()) await manual.click();
  await assertReadable(panel);
  for (const name of ['Multichoice', 'Binary', 'Rating', 'Quadratic allocation', 'Freeform']) {
    await panel.getByRole('button', { name: `Add ${name} question`, exact: true }).click();
  }
  await panel.getByRole('textbox', { name: 'Question prompt', exact: true }).first().fill('Which service improvement matters most?');
  await panel.getByRole('button', { name: 'Add Option', exact: true }).first().click();
  await panel.getByRole('button', { name: 'Credits: 99', exact: true }).click();
  await assertReadable(panel);
  await panel.locator('[class*="toggleSwitch_"]').click();
  await panel.getByRole('textbox', { name: 'Title', exact: true }).waitFor({ state: 'visible' });
  await assertReadable(panel);
  for (const name of ['Show JSON', 'Show AI Prompt']) {
    const show = panel.getByRole('button', { name, exact: true });
    if (await show.isVisible()) await show.click();
  }
  await assertReadable(panel);
  await panel.getByRole('button', { name: 'Hide JSON', exact: true }).click();
  await panel.getByRole('button', { name: 'Hide AI Prompt', exact: true }).click();
  await panel.getByTestId('ce-create-clear').click();
  await assertReadable(page.getByRole('dialog'));
  const close = await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const header = element.closest('.modal-header').getBoundingClientRect();
    return { opacity: getComputedStyle(element).opacity, top: rect.top, bottom: rect.bottom, headerTop: header.top, headerBottom: header.bottom };
  });
  if (close.opacity !== '1' || close.top < close.headerTop || close.bottom > close.headerBottom) {
    throw new Error('Confirmation close icon must be visible and fit inside its header');
  }
  await page.getByRole('dialog').getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await clickQuestionAction(page, 'Close Create Interface');
}
