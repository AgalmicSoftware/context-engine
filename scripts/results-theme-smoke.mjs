// Local fixtures only: verify rendered raw results, including expanded content,
// rather than just checking that the theme's token pairs have enough contrast.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { assertReadable, auditPanelContrast } from './civic-theme-overlay-smoke.mjs';
import { installCivicThemeFixtures } from './civic-theme-fixtures.mjs';

export async function inspectResultsTheme(page) {
  const dialog = page.getByRole('dialog');
  const listTitle = dialog.getByText('View & Sort Questions', { exact: true });
  await listTitle.waitFor({ state: 'visible', timeout: 60000 });
  await assertReadable(dialog);
  const heading = dialog.getByRole('heading', { name: 'Question Results', exact: true });
  const geometry = await heading.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const header = element.closest('.modal-header').getBoundingClientRect();
    return { width: rect.width, height: rect.height, lineHeight: parseFloat(getComputedStyle(element).lineHeight), headerWidth: header.width };
  });
  assert(geometry.width >= Math.min(260, geometry.headerWidth - 110), 'Modal heading uses the available width');
  assert(geometry.height <= geometry.lineHeight * 2 + 2, 'Modal heading wraps between words, within two lines');

  await listTitle.click();
  await assertReadable(dialog);
  await listTitle.click();
  await dialog.getByRole('button', { name: 'Export Data', exact: true }).click();
  await assertReadable(dialog);
  const download = dialog.getByRole('button', { name: 'Download', exact: true });
  await download.hover();
  await assertReadable(download);
  await download.focus();
  await assertReadable(download);
  await dialog.getByRole('button', { name: 'Collapse export area', exact: true }).click();

  // The fixture has binary, rating, multichoice, quadratic and freeform questions.
  // Opening each card exercises empty as well as populated summaries.
  const headers = dialog.locator('[class*="aggregatorSummaryCard_"] > [class*="questionSummaryHeader_"]');
  assert((await headers.count()) > 0, 'Question summaries are present');
  for (let index = 0; index < await headers.count(); index += 1) {
    const header = headers.nth(index);
    await header.click();
    await assertReadable(header, 1);
    await header.click();
  }
  const bookmark = dialog.getByRole('button', { name: 'Bookmark question', exact: true }).first();
  await bookmark.click();
  await assertReadable(dialog.getByRole('button', { name: 'Remove bookmark', exact: true }).first());
  await dialog.getByRole('button', { name: 'Remove bookmark', exact: true }).first().click();
  assert.equal(await dialog.evaluate((element) => element.scrollWidth > element.clientWidth + 1), false, 'Results dialog does not overflow horizontally');
  return dialog.evaluate(auditPanelContrast);
}

export async function runResultsThemeSmoke() {
  const { chromium } = await import('playwright');
  const base = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
  assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local Vite server');
  const themes = process.env.THEMES?.split(',') || ['civic', 'context-engine', 'classic-95'];
  const widths = process.env.WIDTHS?.split(',').map(Number) || [390, 653, 1280];
  const browser = await chromium.launch({ headless: true });
  try {
    for (const theme of themes) for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await installCivicThemeFixtures(context, base, { privateGroups: true });
      await context.addInitScript((value) => {
        localStorage.setItem('ce:theme-default-version', '2026-10-13-civic-v1');
        localStorage.setItem('ce:theme', value);
        localStorage.setItem('ce_onboarding_complete', 'true');
        localStorage.setItem('ce:firstVisitRootAboutRedirectConsumed:v20260618b', 'true');
      }, theme);
      const page = await context.newPage();
      try {
        await page.goto(`${base}/session/demo-2/questions/results?session=demo-2`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction((value) => document.documentElement.dataset.ceTheme === value, theme);
        const result = await inspectResultsTheme(page);
        await page.goto(`${base}/session/demo-sh`, { waitUntil: 'domcontentloaded' });
        await page.getByTestId('ce-session-groups-toggle').click();
        const notice = page.getByTestId('ce-session-worker-groups-login');
        await assertReadable(notice);
        const signIn = notice.getByRole('button', { name: 'Sign in', exact: true });
        await signIn.hover();
        await assertReadable(signIn);
        await signIn.focus();
        await assertReadable(signIn);
        console.log(`PASS results contrast ${theme} ${width}px (${result.checked} labels)`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runResultsThemeSmoke().catch((error) => { console.error(error); process.exitCode = 1; });
}
