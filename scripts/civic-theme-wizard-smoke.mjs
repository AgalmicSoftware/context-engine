import assert from 'node:assert/strict';
import { assertReadable } from './civic-theme-overlay-smoke.mjs';

export async function openSetupSections(page) {
  const carets = page.locator('[data-testid^="ce-setup-more-"]');
  for (let index = 0; index < (await carets.count()); index += 1) {
    const caret = carets.nth(index);
    if ((await caret.getAttribute('aria-expanded')) === 'false') await caret.click();
  }
}

// Hover and press start colour transitions; check the colours they end on.
const settle = (locator) =>
  locator.evaluate((node) =>
    Promise.allSettled(node.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  );

// Read-only setup review plus a disposable local group draft. Never generate
// credentials, deploy a Worker, create a session, or submit an on-chain action.
export async function inspectCivicWizard(page) {
  await page.getByRole('heading', { name: 'New session', exact: true }).waitFor({ state: 'visible' });
  const setup = page.getByTestId('ce-setup-section-basics').locator('..');
  // A name gives the Worker deploy a name, shown in Hosting.
  await page.getByTestId('ce-wizard-session-name').fill('Civic preview');
  // Runs on: a radio group whose labels are Centralized and Decentralized.
  const authority = page.getByTestId('ce-setup-authority');
  const runsOn = { worker_canonical: 'Centralized', evm_registry_canonical: 'Decentralized' };
  for (const mode of ['worker_canonical', 'evm_registry_canonical']) {
    await openSetupSections(page);
    await authority.getByText(runsOn[mode], { exact: true }).click();
    await assertReadable(authority.getByText(runsOn[mode], { exact: true }));
    await openSetupSections(page);
    await assertReadable(setup);
    if (mode === 'worker_canonical') {
      await page.getByTestId('ce-new-worker-group-name').fill('Civic preview group');
      await page.getByTestId('ce-new-worker-group-add').click();
      await page.getByTestId('ce-new-worker-group-draft-form').waitFor({ state: 'visible' });
      await assertReadable(setup);
      await page.getByRole('button', { name: 'Remove Civic preview group', exact: true }).click();
      const workerName = page.getByTestId('ce-wizard-worker-name');
      const deployDetails = page.locator('details', { has: workerName });
      if (!(await deployDetails.evaluate((details) => details.open))) await deployDetails.locator('summary').click();
      await assertReadable(workerName);
    } else {
      // The access rule card, hovered and held down as well as at rest.
      for (const word of ['ANY', 'ALL']) {
        const button = page.getByRole('button', { name: word, exact: true });
        await button.hover();
        await settle(button);
        await assertReadable(button);
      }
      // The rule card's and the featured groups' Create Group buttons.
      for (const createGroup of await page.getByTestId('ce-wizard-create-sbt').all()) {
        await createGroup.hover();
        await page.mouse.down();
        await settle(createGroup);
        await assertReadable(createGroup);
        // Released off the button, so nothing opens.
        await page.mouse.move(0, 0);
        await page.mouse.up();
      }
      // Add Address, before and after an address is typed.
      await page.getByRole('button', { name: '+ By Address', exact: true }).first().click();
      const addAddress = page.getByTestId('ce-sbt-selector-manual-add').first();
      await settle(addAddress);
      await assertReadable(addAddress);
      const address = page.getByTestId('ce-sbt-selector-manual-input').first();
      await address.fill(`0x${'0'.repeat(38)}a2`);
      await settle(addAddress);
      await assertReadable(addAddress);
    }
    const help = page.getByRole('button', { name: 'About Runs on', exact: true });
    await help.click();
    const tooltip = page.getByRole('tooltip').filter({ hasText: /Decentralized:/ });
    await assertReadable(tooltip);
    await help.press('Escape');
    await tooltip.waitFor({ state: 'hidden' });
    await assertReadable(page.getByTestId('ce-setup-create'));
  }
  await authority.getByText(runsOn.worker_canonical, { exact: true }).click();
  assert.equal(
    await authority.locator('input:checked').getAttribute('value'),
    'worker_canonical',
    'The review leaves the default hosting selected',
  );
}
