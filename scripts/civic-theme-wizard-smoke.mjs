import assert from 'node:assert/strict';
import { assertReadable } from './civic-theme-overlay-smoke.mjs';

export async function inspectPublishSummary(page) {
  const summary = page.locator('#session-wizard-section-publish dl');
  await summary.waitFor({ state: 'visible' });
  await assertReadable(summary);
  const layout = await summary.evaluate((list) => {
    const bounds = list.getBoundingClientRect();
    const rows = [...list.children].map((row) => {
      const label = row.querySelector('dt');
      const value = row.querySelector('dd');
      const rect = row.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        labelRight: label.getBoundingClientRect().right,
        valueLeft: value.getBoundingClientRect().left,
        overflow: value.scrollWidth > value.clientWidth + 1,
      };
    });
    return { mobile: window.innerWidth <= 720, left: bounds.left, right: bounds.right, rows };
  });
  assert.ok(layout.rows.length >= 3, 'Deployment summary includes session, access, and Worker details');
  for (const [index, row] of layout.rows.entries()) {
    assert.ok(!row.overflow && row.left >= layout.left - 1 && row.right <= layout.right + 1, 'Summary values fit');
    if (layout.mobile) {
      assert.ok(row.valueLeft >= row.labelRight + 8, 'Mobile summary places each value beside its label');
      assert.ok(Math.abs(row.left - layout.left) <= 1 && Math.abs(row.right - layout.right) <= 1, 'Rows fill the width');
      if (index) assert.ok(row.top >= layout.rows[index - 1].bottom + 8, 'Mobile summary rows stack with spacing');
    }
  }
}

export async function inspectParticipationChannels(page) {
  const channels = page.getByRole('region', { name: 'Participation channels', exact: true });
  await channels.waitFor({ state: 'visible' });
  const checkboxes = channels.locator('input[type="checkbox"]');
  assert.equal(await checkboxes.count(), 2, 'Only website and direct agent access are offered');
  const before = await checkboxes.evaluateAll((inputs) => inputs.map((input) => input.checked));
  for (const [id, explanation] of [
    ['ce-wizard-surface-web-info', /always enabled/i],
    ['ce-wizard-surface-agent-http-info', /through a scoped credential/i],
  ]) {
    const help = channels.getByTestId(id);
    await help.click();
    const tooltip = page.getByRole('tooltip').filter({ hasText: explanation });
    await assertReadable(tooltip);
    await help.press('Escape');
    await tooltip.waitFor({ state: 'hidden' });
  }
  assert.deepEqual(
    await checkboxes.evaluateAll((inputs) => inputs.map((input) => input.checked)),
    before,
    'Opening channel help does not change participation settings',
  );
  assert.match(await channels.getByRole('status').innerText(), /Access requires a scoped agent credential/);
  await assertReadable(channels);
}

// Read-only setup review plus a disposable local group draft. Never generate
// credentials, deploy a Worker, publish a session, or submit an on-chain action.
export async function inspectCivicWizard(page) {
  const body = page.locator('body');
  for (const [profile, accessStep] of [
    ['Centralized (Cloudflare)', 'Step 2: Session Access'],
    ['Decentralized (Ethereum + Arweave)', 'Step 2: Privacy'],
  ]) {
    const confirmPreset = (dialog) => (
      dialog.message() === 'Replace all custom hosting settings with this template?'
        ? dialog.accept()
        : dialog.dismiss()
    );
    page.on('dialog', confirmPreset);
    try {
      await page.getByRole('radio', { name: profile, exact: true }).click();
    } finally {
      page.off('dialog', confirmPreset);
    }
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
    await inspectPublishSummary(page);
    await assertReadable(body);
    const advanced = page.getByRole('button', { name: 'Advanced publish settings', exact: true });
    if (await advanced.isVisible()) {
      await advanced.click();
      await assertReadable(body);
    }

    await page.getByRole('button', { name: 'Custom session settings', exact: true }).click();
    await page.getByRole('button', { name: 'Session Information', exact: true }).click();
    await page.getByRole('button', { name: 'Worker deployment & secrets', exact: true }).click();
    await inspectParticipationChannels(page);
    assert.equal(
      await page.getByTestId('ce-wizard-worker-secrets-require-pay').count(),
      profile.startsWith('Decentralized') ? 1 : 0,
      'User-paid usage is offered only for decentralized sessions',
    );
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
