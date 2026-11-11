// Interview review cards beside earlier answers: the comment choices, the earlier-answer note and their
// contrast in every theme, at phone and desktop widths, at rest and when hovered, focused or pressed.
// Run against a local Vite server: BASE_URL=http://127.0.0.1:3031 node scripts/interview-comment-review-smoke.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:3031';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local Vite server');
const output = process.env.OUTPUT_DIR || '/tmp/ce-interview-comment-review';
await fs.mkdir(output, { recursive: true });
const MIN_CONTRAST = 4.5;

const page = (theme) => `<!doctype html><html data-ce-theme="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="padding:16px;margin:0;background:var(--ce-canvas)"><main id="probe"></main><script type="module">
  import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
  window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
  await import('/src/assets/css/contextEngine.scss');
  const ReactModule = await import('/node_modules/.vite/deps/react.js'); const React = ReactModule.default || ReactModule;
  const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
  const { default: Modal } = await import('/src/components/SurveyTool/SessionVoiceModeModal.tsx');
  const questions = [
    { id: 'q1', type: 'freeform', prompt: 'How should the garden be run?' },
    { id: 'q2', type: 'binary', prompt: 'Keep the garden open late?' },
    { id: 'q3', type: 'quadratic', prompt: 'Where should the budget go?', options: ['Parks', 'Transit', 'Housing'], voiceCredits: 25 },
  ];
  // The person's own words, so drafts that change an answer join review with their earlier answers.
  const packet = { version: 1, sessionSlug: 'fixture', source: { platform: 'other', modelId: 'direct-user-context', verification: 'self_reported' }, responderContext: { summary: 'Fixture context.' }, responses: [
    { questionId: 'q1', answer: 'By a rota of neighbours.', additionalComments: 'A small rota could share the watering.', evidence: 'fixture', confidence: 0.8 },
    { questionId: 'q2', answer: 'Disagree', additionalComments: 'Only in summer.', evidence: 'fixture', confidence: 0.8 },
    { questionId: 'q3', answer: [2, -1, 0], evidence: 'fixture', confidence: 0.8 },
  ] };
  const longAnswer = 'Yes. A garden gives the street somewhere to meet and the children somewhere to learn where food comes from. It should be run by the people who live here, with a small budget the council reviews each year, and a noticeboard that says who looks after what each week.';
  const existingResponseSlice = {
    answers: { q1: { value: longAnswer }, q2: { value: 'Agree' }, q3: { value: [0, 1, 1] } },
    additionalComments: { q1: { value: 'Costs matter most to me.' }, q2: { value: '*', encrypted: true } },
  };
  window.__contrast = (element) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const parse = (color) => {
      context.clearRect(0, 0, 1, 1); context.fillStyle = '#010203'; context.fillStyle = color;
      if (context.fillStyle === '#010203' && color !== 'rgb(1, 2, 3)') throw new Error('Unreadable colour ' + color);
      context.fillRect(0, 0, 1, 1); const data = context.getImageData(0, 0, 1, 1).data;
      return [data[0], data[1], data[2], data[3] / 255];
    };
    const over = (top, bottom) => top.slice(0, 3).map((value, index) => value * top[3] + bottom[index] * (1 - top[3]));
    // Layers from the page down to the element; a translucent layer (a fading tooltip) blends what it draws
    // with what is behind it.
    const nodes = []; for (let node = element; node; node = node.parentElement) nodes.unshift(node);
    let backdrop = [255, 255, 255]; let background = backdrop; let opacity = 1;
    for (const node of nodes) {
      const style = getComputedStyle(node);
      if (style.backgroundImage !== 'none') throw new Error('Background image under ' + node.className);
      if (Number(style.opacity) < 1 && opacity === 1) backdrop = background;
      opacity *= Number(style.opacity);
      background = over(parse(style.backgroundColor), background);
    }
    const blend = (rgb) => rgb.map((value, index) => value * opacity + backdrop[index] * (1 - opacity));
    const foreground = blend(over(parse(getComputedStyle(element).color), background));
    background = blend(background);
    const luminance = (rgb) => rgb.map((value) => { value /= 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; })
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const [a, b] = [luminance(foreground), luminance(background)];
    return { ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), opacity };
  };
  (ReactDOM.createRoot || ReactDOM.default.createRoot)(document.getElementById('probe')).render(React.createElement(Modal, { isOpen: true, mode: 'interview', loginComplete: true, account: '0x0000000000000000000000000000000000000001', onClose: () => {}, onSelectMode: () => {}, sessionSlug: 'fixture', workerUrl: 'https://worker.example.test', questionPool: questions, prefillPacket: packet, existingResponseSlice, sessionConfig: { interviewMode: { hiddenDraftShare: 0 } } }));
</script></body></html>`;

const browser = await chromium.launch({ headless: true });
let lowest = Infinity;
try {
  for (const theme of ['civic', 'context-engine', 'classic-95']) for (const width of [375, 1280]) {
    const tab = await browser.newPage({ viewport: { width, height: 900 } });
    tab.setDefaultTimeout(20000);
    const failures = [];
    tab.on('pageerror', (error) => failures.push(error.message));
    await tab.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (url.pathname === '/comment-review-probe') return route.fulfill({ contentType: 'text/html', body: page(theme) });
      return route.continue();
    });
    await tab.goto(`${base}/comment-review-probe`);
    const card = (id) => tab.locator(`[data-testid="ce-session-interview-draft"][data-ce-question-id="${id}"]`);
    await card('q1').waitFor().catch(async (error) => {
      console.error(await tab.locator('body').innerText(), failures);
      throw error;
    });
    await tab.waitForFunction(() => [...document.querySelectorAll('.modal')].some((element) => Number(getComputedStyle(element).opacity) === 1));
    const results = [];
    const measure = async (name, locator) => {
      // Transitions finish first, so a state is measured as it settles.
      await tab.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
            .map((animation) => animation.finished.catch(() => {})),
        ),
      );
      const { ratio, opacity } = await locator.evaluate((element) => window.__contrast(element));
      results.push({ name, ratio: Math.round(ratio * 100) / 100, ...(opacity < 1 ? { opacity } : {}) });
      lowest = Math.min(lowest, ratio);
    };
    const rest = async () => {
      await tab.mouse.move(1, 1);
      await tab.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
    };
    // At rest, hovered, keyboard-focused and held down (moved off before release, so nothing is chosen).
    const measureStates = async (name, locator) => {
      await rest();
      await measure(`${name} rest`, locator);
      await locator.hover();
      await measure(`${name} hover`, locator);
      await rest();
      await tab.keyboard.press('Tab');
      await locator.focus();
      assert.equal(await locator.evaluate((element) => element.matches(':focus-visible')), true, `${name} shows keyboard focus`);
      await measure(`${name} focus`, locator);
      await rest();
      await locator.hover();
      await tab.mouse.down();
      await measure(`${name} active`, locator);
      await tab.mouse.move(1, 1);
      await tab.mouse.up();
    };

    // Their comment and the AI's: each choice measured pressed and not.
    const choices = card('q1').getByRole('group', { name: 'Comment to submit' });
    const comment = card('q1').getByRole('button', { name: /Additional comments for How should the garden be run/ });
    assert.equal(await comment.innerText(), 'Costs matter most to me.\n\nA small rota could share the watering.');
    assert.equal(await choices.getByRole('button', { name: 'Both' }).getAttribute('aria-pressed'), 'true');
    for (const chosen of ['Mine', 'AI’s', 'Both']) {
      await choices.getByRole('button', { name: chosen }).click();
      for (const label of ['Both', 'Mine', 'AI’s']) {
        const button = choices.getByRole('button', { name: label });
        await measureStates(`${label} ${(await button.getAttribute('aria-pressed')) === 'true' ? 'pressed' : 'unpressed'}`, button);
      }
    }
    assert.equal(await comment.innerText(), 'Costs matter most to me.\n\nA small rota could share the watering.');
    const help = choices.getByRole('button', { name: 'About these comment choices' });
    await measureStates('Choices help', help);
    // Let the hide that leaving the button scheduled run out, then open the tooltip and let it settle.
    await rest();
    await tab.waitForTimeout(400);
    await help.hover();
    await tab.getByRole('tooltip').waitFor();
    await tab.waitForTimeout(400);
    await tab.waitForFunction(() => Number(getComputedStyle(document.querySelector('.tooltip.show')).opacity) >= 0.9);
    assert((await tab.getByRole('tooltip').innerText()).includes('Both keeps your earlier comment'));
    await measure('Choices tooltip', tab.locator('.tooltip.show .tooltip-inner'));
    await rest();

    // A locked comment stays unless they choose the AI's.
    const locked = card('q2');
    assert.equal(await locked.getByRole('group', { name: 'Comment to submit' }).getByRole('button').count(), 3);
    const placeholder = locked.getByText('Your locked comment stays.');
    await measure('Locked comment placeholder', placeholder);

    await card('q1').scrollIntoViewIfNeeded();
    await card('q1').screenshot({ animations: 'disabled', path: path.join(output, `comment-${theme}-${width}.png`) });
    await locked.screenshot({ animations: 'disabled', path: path.join(output, `locked-${theme}-${width}.png`) });
    assert.equal(await tab.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'No sideways scroll');
    assert.deepEqual(failures, []);
    const low = results.reduce((min, entry) => (entry.ratio < min.ratio ? entry : min));
    for (const entry of results) assert(entry.ratio >= MIN_CONTRAST, `${theme} ${width} ${entry.name}: ${entry.ratio}:1`);
    console.log(`PASS ${theme} ${width}: ${results.length} checks, lowest ${low.ratio}:1 (${low.name})`);
    console.log(JSON.stringify({ theme, width, results }));
    await tab.close();
  }
} finally {
  await browser.close();
}
console.log(`Lowest contrast: ${Math.round(lowest * 100) / 100}:1`);
