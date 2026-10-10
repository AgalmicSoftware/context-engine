import { assertReadable } from './civic-theme-overlay-smoke.mjs';

// Read-only setup review plus a disposable local group draft. Never generate
// credentials, deploy a Worker, publish a session, or submit an on-chain action.
export async function inspectCivicWizard(page) {
  const body = page.locator('body');
  for (const [profile, accessStep] of [
    ['Centralized (Cloudflare)', 'Step 2: Session Access'],
    ['Decentralized (Ethereum + Arweave)', 'Step 2: Privacy'],
  ]) {
    await page.getByRole('radio', { name: profile, exact: true }).click();
    await page.getByRole('button', { name: 'Custom session settings', exact: true }).waitFor({ state: 'visible' });

    await page.getByRole('button', { name: 'Step 1: Session Details', exact: true }).click();
    if (!(await page.getByRole('region', { name: 'Voice interview settings', exact: true }).isVisible())) {
      await page.getByRole('button', { name: 'Optional details', exact: true }).click();
    }
    await assertReadable(body);

    await page.getByRole('button', { name: accessStep, exact: true }).click();
    await assertReadable(body);
    if (profile.startsWith('Centralized')) {
      await page.getByTestId('ce-new-worker-group-name').fill('Civic preview group');
      await page.getByTestId('ce-new-worker-group-add').click();
      await page.getByTestId('ce-new-worker-group-draft-form').waitFor({ state: 'visible' });
      await assertReadable(body);
      await page.getByRole('button', { name: 'Remove Civic preview group', exact: true }).click();
    } else {
      const groupPicker = page.getByRole('button', { name: 'Select Group...', exact: true });
      await groupPicker.click();
      await page.getByRole('textbox', { name: 'Search options', exact: true }).waitFor({ state: 'visible' });
      await assertReadable(body);
      await groupPicker.click();
      await page.getByRole('button', { name: '+ By Address', exact: true }).click();
      await assertReadable(body);
      await page.getByRole('button', { name: 'Hide', exact: true }).click();
    }

    await page.getByRole('button', { name: 'Step 3: Session Worker', exact: true }).click();
    await assertReadable(body);
    await page.getByRole('button', { name: 'Step 4: Deploy Session', exact: true }).click();
    await assertReadable(body);
    const advanced = page.getByRole('button', { name: 'Advanced publish settings', exact: true });
    if (await advanced.isVisible()) {
      await advanced.click();
      await assertReadable(body);
    }

    await page.getByRole('button', { name: 'Custom session settings', exact: true }).click();
    await page.getByRole('button', { name: 'Session Information', exact: true }).click();
    await page.getByRole('button', { name: 'Worker deployment & secrets', exact: true }).click();
    await assertReadable(body);
    const accessMenu = page.getByRole('button', { name: 'Choose access rule', exact: true }).first();
    await accessMenu.click();
    await assertReadable(page.getByRole('dialog', { name: 'Select access rules', exact: true }));
    await accessMenu.click();

    if (profile.startsWith('Decentralized')) {
      const expandContracts = page.getByRole('button', { name: 'Smart Contracts expand', exact: true });
      if (await expandContracts.isVisible()) await expandContracts.click();
      await assertReadable(body);
      await page.getByRole('button', { name: 'Open Surveys contract details', exact: true }).click();
      await assertReadable(page.getByRole('dialog'));
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
    }

    await page.getByRole('button', { name: 'Back to templates', exact: true }).click();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('heading', { name: 'Session Setup', exact: true }).waitFor({ state: 'visible' });
  }
}
