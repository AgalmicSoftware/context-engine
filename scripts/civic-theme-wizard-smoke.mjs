import assert from 'node:assert/strict';
import { assertReadable } from './civic-theme-overlay-smoke.mjs';

export async function openSetupSections(page) {
  const carets = page.locator('[data-testid^="ce-setup-more-"]');
  for (let index = 0; index < (await carets.count()); index += 1) {
    const caret = carets.nth(index);
    if ((await caret.getAttribute('aria-expanded')) === 'false') await caret.click();
  }
}

// Read-only setup review plus a disposable local group draft. Never generate
// credentials, deploy a Worker, create a session, or submit an on-chain action.
export async function inspectCivicWizard(page) {
  await page.getByRole('heading', { name: 'New session', exact: true }).waitFor({ state: 'visible' });
  const setup = page.getByTestId('ce-setup-section-basics').locator('..');
  const authority = page.getByTestId('ce-setup-authority');
  for (const mode of ['worker_canonical', 'evm_registry_canonical']) {
    await openSetupSections(page);
    await authority.selectOption(mode);
    await openSetupSections(page);
    await assertReadable(setup);
    if (mode === 'worker_canonical') {
      await page.getByTestId('ce-new-worker-group-name').fill('Civic preview group');
      await page.getByTestId('ce-new-worker-group-add').click();
      await page.getByTestId('ce-new-worker-group-draft-form').waitFor({ state: 'visible' });
      await assertReadable(setup);
      await page.getByRole('button', { name: 'Remove Civic preview group', exact: true }).click();
    }
    const help = page.getByRole('button', { name: 'About Runs on', exact: true });
    await help.click();
    const tooltip = page.getByRole('tooltip').filter({ hasText: /On-chain registry/ });
    await assertReadable(tooltip);
    await help.press('Escape');
    await tooltip.waitFor({ state: 'hidden' });
    await assertReadable(page.getByTestId('ce-setup-create'));
  }
  await authority.selectOption('worker_canonical');
  assert.equal(await authority.inputValue(), 'worker_canonical', 'The review leaves the default hosting selected');
}
