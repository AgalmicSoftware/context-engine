// Local fixtures only: the Session Worker's replies come from here, so nothing reaches a real Worker, no AI
// is paid for and nothing is stored. Opens the footer's Feedback dialog by keyboard alone, sends one message,
// speaks a second through a fake microphone and has it refused, and checks every state is readable in each
// theme at phone, tablet and desktop width, and that what was sent says where the sender was without the
// page's address.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { assertReadable } from './civic-theme-overlay-smoke.mjs';
import { installCivicThemeFixtures } from './civic-theme-fixtures.mjs';

const WORKER = 'https://civic-worker.example.test';
const REFUSAL = 'You’ve sent 5 today. Thanks! Try again tomorrow.';
const SPOKEN = 'One more thing.';

const step = async (name, run) => {
  try {
    return await run();
  } catch (error) {
    throw new Error(`${name}: ${error.message.split('\n')[0]}`);
  }
};

async function installFeedbackFixtures(context, base, sent) {
  await installCivicThemeFixtures(context, base);
  await context.route(`${WORKER}/capabilities*`, (route) =>
    route.fulfill({
      json: { type: 'ce_worker_capabilities', version: 1, apiVersion: 1, release: '0.9.8', features: ['session_feedback'] },
    }),
  );
  // The session pays for AI, so the form has a microphone; what it hears is written down as SPOKEN.
  await context.route(`${WORKER}/resource-presence*`, (route) =>
    route.fulfill({ json: { resources: { ai: true, arweave: false, rpc: false, txGas: false } } }),
  );
  await context.route(`${WORKER}/transcribe*`, (route) => route.fulfill({ json: { text: SPOKEN } }));
  // The first message is taken; later ones meet the daily limit.
  await context.route(`${WORKER}/feedback*`, (route) => {
    const request = route.request();
    if (request.method() !== 'POST') return route.fulfill({ status: 204 });
    sent.push({ url: request.url(), body: request.postDataJSON(), authorization: request.headers().authorization || '' });
    return sent.length === 1
      ? route.fulfill({ json: { ok: true } })
      : route.fulfill({ status: 429, json: { error: REFUSAL, reason: 'feedback_person_limit' } });
  });
}

// Tab reaches it from wherever focus is, as a keyboard user would.
const tabTo = async (page, target) => {
  for (let presses = 0; presses < 400; presses += 1) {
    if (await target.evaluate((node) => node === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Tab never reached it');
};

export async function inspectFeedback(page, { theme, width, sent, screenshotDir = '', tag = '' }) {
  const footer = page.locator('footer');
  // The footer holds it in two places and shows the one its theme uses.
  const button = page.locator('[data-testid="ce-session-feedback-button"]:visible');
  const dialog = page.getByRole('dialog', { name: 'Feedback' });
  const box = page.getByTestId('ce-session-feedback-text');
  const isFocused = (target) => target.evaluate((node) => node === document.activeElement);
  await button.waitFor({ state: 'visible' });
  await button.scrollIntoViewIfNeeded();
  await step('footer button, one, after the links', async () => {
    assert.equal(await button.count(), 1);
    await assertReadable(footer);
  });
  // A desktop-window theme keeps its links in the Start menu, and Feedback on the taskbar.
  const inRow = await page.locator('#ce-footer-session-actions').isVisible();
  if (inRow && width >= 466 && width <= 768) {
    await step('the six links share one row on a tablet', async () => {
      const row = await page.evaluate(() => ({
        tops: [...document.querySelectorAll('footer nav ul > li')]
          .filter((item) => getComputedStyle(item).display !== 'none')
          .map((item) => item.getBoundingClientRect().top),
        wider: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }));
      assert.equal(row.tops.length, 6);
      assert.equal(new Set(row.tops).size, 1, `Not one row: ${row.tops}`);
      assert.equal(row.wider, false, 'The page scrolls sideways');
    });
  }
  if (screenshotDir) await footer.screenshot({ path: `${screenshotDir}/footer-${tag}.png` });
  await step('opens from the keyboard, focus in the box', async () => {
    await tabTo(page, button);
    await assertReadable(button);
    await page.keyboard.press('Enter');
    await dialog.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.activeElement?.id === 'ce-session-feedback-text');
    assert.match(await dialog.innerText(), /It never says who you are\./);
  });
  await step('empty form', async () => {
    await assertReadable(dialog);
    assert.equal(await page.getByTestId('ce-session-feedback-send').isDisabled(), true);
  });
  await step('typing', async () => {
    await page.keyboard.type('The map was hard to read on my phone.');
    await assertReadable(dialog);
    assert.match(await page.locator('#ce-session-feedback-left').innerText(), /^1,9\d\d left$/);
  });
  await step('no contact choice', async () => {
    // Every message goes without saying who sent it, so the form asks for no way to reach them.
    assert.equal(await dialog.getByRole('checkbox').count(), 0);
  });
  await step('nothing wider than the screen', async () => {
    const box = await page.locator('.modal-content').boundingBox();
    assert(box && box.x >= 0 && box.x + box.width <= width + 1, `The dialog runs off the screen: ${JSON.stringify(box)}`);
  });
  await step('Esc closes it, focus returns, and the text stays', async () => {
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.dataset.testid === 'ce-session-feedback-button');
    await button.click();
    // Focus moves into the box once the dialog has faded in.
    await page.waitForFunction(() => document.activeElement?.id === 'ce-session-feedback-text');
    assert.equal(await box.inputValue(), 'The map was hard to read on my phone.');
  });
  if (screenshotDir) await page.locator('.modal-content').screenshot({ path: `${screenshotDir}/feedback-modal-${tag}.png` });

  await step('sends from the keyboard', async () => {
    const send = page.getByTestId('ce-session-feedback-send');
    await tabTo(page, send);
    await assertReadable(dialog);
    await page.keyboard.press('Enter');
    const thanks = page.getByTestId('ce-session-feedback-sent');
    await thanks.waitFor({ state: 'visible' });
    // Focus goes to the thanks, so it is read out and the keyboard isn't left nowhere.
    assert.equal(await isFocused(thanks), true);
    await assertReadable(dialog);
  });
  await step('what was sent', () => {
    assert.equal(sent.length, 1);
    const [{ url, body: message, authorization }] = sent;
    // Signed out: the session is named in the address and no sign-in goes with it.
    assert.equal(url, `${WORKER}/feedback?slug=demo-sh`);
    assert.equal(authorization, '');
    assert.deepEqual(Object.keys(message).sort(), ['appRelease', 'screen', 'text', 'theme', 'view']);
    assert.equal(message.text, 'The map was hard to read on my phone.');
    assert.equal(message.theme, theme);
    assert.equal(message.screen, width < 640 ? 'phone' : width < 1024 ? 'tablet' : 'desktop');
    assert.match(message.view, /^[A-Za-z0-9:_-]{1,80}$/);
    assert.match(message.appRelease, /^\d+\.\d+\.\d+$/);
    assert(!JSON.stringify(message).includes(new URL(page.url()).host), 'The message holds the page’s address');
  });
  if (screenshotDir) await page.locator('.modal-content').screenshot({ path: `${screenshotDir}/feedback-sent-${tag}.png` });

  await step('speaking writes the words into the box', async () => {
    await page.getByRole('button', { name: 'Send more' }).click();
    await page.waitForFunction(() => document.activeElement?.id === 'ce-session-feedback-text');
    const mic = page.getByTestId('ce-session-feedback-mic');
    await tabTo(page, mic);
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Stop recording' }).waitFor({ state: 'visible' });
    await assertReadable(dialog);
    if (screenshotDir) await page.locator('.modal-content').screenshot({ path: `${screenshotDir}/feedback-recording-${tag}.png` });
    // Past the recorder's shortest take, then stopped from the keyboard.
    await page.waitForTimeout(800);
    await page.keyboard.press('Enter');
    await page.waitForFunction((spoken) => document.getElementById('ce-session-feedback-text')?.value === spoken, SPOKEN);
    assert.equal(await mic.getAttribute('aria-pressed'), 'false');
  });
  await step('a refused message says why and keeps the text', async () => {
    await page.getByTestId('ce-session-feedback-send').click();
    const alert = dialog.getByRole('alert');
    await alert.waitFor({ state: 'visible' });
    assert.equal(await alert.innerText(), REFUSAL);
    assert.equal(await box.inputValue(), SPOKEN);
    await assertReadable(dialog);
  });
  await step('the close button closes it', async () => {
    await dialog.getByRole('button', { name: 'Close' }).click();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await isFocused(button), true);
  });
}

export async function runSessionFeedbackThemeSmoke() {
  const { chromium } = await import('playwright');
  const base = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
  assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local Vite server');
  const themes = process.env.THEMES?.split(',') || ['civic', 'context-engine', 'classic-95'];
  const widths = process.env.WIDTHS?.split(',').map(Number) || [375, 466, 1280];
  const screenshotDir = process.env.SCREENSHOT_DIR || '';
  // A fake microphone that grants itself, so speaking needs no person and no device.
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  try {
    for (const theme of themes) {
      for (const width of widths) {
        const tag = `${theme}-${width}`;
        const sent = [];
        const context = await browser.newContext({ viewport: { width, height: 900 }, permissions: ['microphone'] });
        await installFeedbackFixtures(context, base, sent);
        await context.addInitScript((value) => {
          localStorage.setItem('ce:theme-default-version', '2026-10-13-civic-v1');
          localStorage.setItem('ce:theme', value);
          localStorage.setItem('ce_onboarding_complete', 'true');
          localStorage.setItem('ce:firstVisitRootAboutRedirectConsumed:v20260618b', 'true');
        }, theme);
        const page = await context.newPage();
        try {
          await page.goto(`${base}/session/demo-sh`, { waitUntil: 'domcontentloaded' });
          await page.waitForFunction((value) => document.documentElement.dataset.ceTheme === value, theme);
          await inspectFeedback(page, { theme, width, sent, screenshotDir, tag });
          console.log(`PASS Feedback button and form ${tag}px`);
        } catch (error) {
          if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/failed-${tag}.png` }).catch(() => {});
          throw new Error(`${theme} ${width}px: ${error.message}`);
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSessionFeedbackThemeSmoke().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
