// Local fixtures only: the Session Worker's replies come from here, so nothing reaches a real Worker and
// nothing is stored. Opens the session page's Feedback section by keyboard alone, sends one message and has a
// second refused, and checks every state is readable in each theme at phone and desktop width, and that what
// was sent says where the sender was without the page's address.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { assertReadable } from './civic-theme-overlay-smoke.mjs';
import { installCivicThemeFixtures } from './civic-theme-fixtures.mjs';

const WORKER = 'https://civic-worker.example.test';
const REFUSAL = 'You’ve sent 5 today. Thanks! Try again tomorrow.';

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
  const section = page.getByTestId('ce-session-feedback');
  const toggle = page.getByTestId('ce-session-feedback-toggle');
  await section.waitFor({ state: 'visible' });
  await section.scrollIntoViewIfNeeded();
  await step('closed section', () => assertReadable(section));
  await step('opens from the keyboard', async () => {
    await toggle.focus();
    await page.keyboard.press('Enter');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  });
  await step('focused header', () => assertReadable(section));
  await step('header tooltip', async () => {
    await page.getByRole('button', { name: 'About feedback' }).focus();
    await assertReadable(page.locator('.tooltip.show', { hasText: 'It goes to this session’s admins' }));
  });

  const box = page.getByTestId('ce-session-feedback-text');
  const body = page.locator('#ce-session-feedback-body');
  await step('empty form', async () => {
    await assertReadable(body);
    assert.equal(await page.getByTestId('ce-session-feedback-send').isDisabled(), true);
  });
  await step('typing', async () => {
    await tabTo(page, box);
    await page.keyboard.type('The map was hard to read on my phone.');
    await assertReadable(body);
    assert.match(await page.locator('#ce-session-feedback-left').innerText(), /^1,9\d\d left$/);
  });
  await step('no contact choice', async () => {
    // Every message goes without saying who sent it, so the form asks for no way to reach them.
    assert.equal(await body.getByRole('checkbox').count(), 0);
  });
  await step('nothing wider than the screen', async () => {
    const overflow = await section.evaluate((node) => node.scrollWidth - node.clientWidth);
    assert(overflow <= 1, `The section overflows by ${overflow}px`);
  });
  if (screenshotDir) {
    // The header's tooltip fades out after focus moves on; wait, so it covers nothing in the picture.
    await page.locator('.tooltip').waitFor({ state: 'detached' });
    await section.screenshot({ path: `${screenshotDir}/feedback-form-${tag}.png` });
  }

  await step('sends from the keyboard', async () => {
    const send = page.getByTestId('ce-session-feedback-send');
    await tabTo(page, send);
    await assertReadable(body);
    await page.keyboard.press('Enter');
    const thanks = page.getByTestId('ce-session-feedback-sent');
    await thanks.waitFor({ state: 'visible' });
    // Focus goes to the thanks, so it is read out and the keyboard isn't left nowhere.
    assert.equal(await thanks.evaluate((node) => node === document.activeElement), true);
    await assertReadable(body);
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
    assert.equal(message.screen, width < 640 ? 'phone' : 'desktop');
    assert.match(message.view, /^[A-Za-z0-9:_-]{1,80}$/);
    assert.match(message.appRelease, /^\d+\.\d+\.\d+$/);
    assert(!JSON.stringify(message).includes(new URL(page.url()).host), 'The message holds the page’s address');
  });
  if (screenshotDir) await section.screenshot({ path: `${screenshotDir}/feedback-sent-${tag}.png` });

  await step('a refused message says why and keeps the text', async () => {
    await page.getByRole('button', { name: 'Send more' }).click();
    await page.waitForFunction(() => document.activeElement?.id === 'ce-session-feedback-text');
    await box.fill('One more thing.');
    await page.getByTestId('ce-session-feedback-send').click();
    const alert = body.getByRole('alert');
    await alert.waitFor({ state: 'visible' });
    assert.equal(await alert.innerText(), REFUSAL);
    assert.equal(await box.inputValue(), 'One more thing.');
    await assertReadable(body);
  });
  await step('closes again', async () => {
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await body.count(), 0);
  });
}

export async function runSessionFeedbackThemeSmoke() {
  const { chromium } = await import('playwright');
  const base = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
  assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local Vite server');
  const themes = process.env.THEMES?.split(',') || ['civic', 'context-engine', 'classic-95'];
  const widths = process.env.WIDTHS?.split(',').map(Number) || [375, 1280];
  const screenshotDir = process.env.SCREENSHOT_DIR || '';
  const browser = await chromium.launch({ headless: true });
  try {
    for (const theme of themes) {
      for (const width of widths) {
        const tag = `${theme}-${width}`;
        const sent = [];
        const context = await browser.newContext({ viewport: { width, height: 900 } });
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
          console.log(`PASS Feedback section ${tag}px`);
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
