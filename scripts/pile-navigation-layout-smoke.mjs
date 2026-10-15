// Synthetic browser-local questions and drafts; never submit answers or modify a Worker.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
const sessions = JSON.parse(readFileSync(new URL('../client/src/variables/demo/demo_sessions.json', import.meta.url)));
const config = sessions['demo-sh'];
const questions = Array.from({ length: 50 }, (_, index) => ({
  id: `0x${String(index + 1).padStart(64, '0')}`, type: 'binary',
  prompt: `Synthetic navigation question ${index + 1}`, options: [], tags: [],
  sessionSlug: 'demo-sh', sessionId: config.sessionId,
}));
const browser = await chromium.launch({ headless: true });
try {
  for (const theme of ['civic', 'classic-95', 'context-engine']) {
    for (const width of [320, 705, 773, 937, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await page.addInitScript(theme => {
        localStorage.setItem('ce:theme', theme);
        localStorage.setItem('ce:theme-default-version', '2026-10-13-civic-v1');
        localStorage.setItem('ce_onboarding_complete', 'true');
      }, theme);
      await page.route(`${new URL(config.corsWorkerUrl).origin}/storage/list?*`, route => route.fulfill({ json: {
        items: new URL(route.request().url()).searchParams.get('resource') === 'questions'
          ? questions.map(question => ({ storageRef: { backend: 'cloudflare', id: question.id, resource: 'questions' } })) : [],
        listComplete: true, cursor: null,
      } }));
      await page.route(`${new URL(config.corsWorkerUrl).origin}/storage/read?*`, route => {
        const question = questions.find(item => item.id === new URL(route.request().url()).searchParams.get('id'));
        return route.fulfill({ status: question ? 200 : 404, json: question || {} });
      });
      await page.route('**/session-config?*', route => route.fulfill({ json: { ok: true, sessionSlug: 'demo-sh', config } }));
      await page.goto(`${base}/session/demo-sh`);
      await page.getByTestId('ce-pile-active-question').waitFor({ timeout: 60000 });
      const next = page.getByRole('button', { name: 'Next Question', exact: true });
      const prev = page.getByRole('button', { name: 'Previous Question', exact: true });
      const inspect = async expected => {
        await page.waitForFunction(expected => {
          const card = document.querySelector('[data-testid="ce-pile-active-question"]');
          if (card?.getAttribute('aria-label') !== `Question ${expected} of 50`) return false;
          const transform = getComputedStyle(card).transform;
          return transform === 'none' || new DOMMatrixReadOnly(transform).isIdentity;
        }, expected);
        const layout = await next.evaluate(button => {
          const nav = button.parentElement, controls = nav.parentElement;
          const card = controls.parentElement.querySelector('[data-testid="ce-pile-active-question"] .card');
          const counter = nav.querySelector('span');
          const actions = controls.querySelector('[class*="pileActions_"]');
          const range = document.createRange(); range.selectNodeContents(counter);
          const rect = element => { const r = element.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, cx: r.left + r.width / 2 }; };
          return {
            nav: rect(nav), counter: rect(counter), card: rect(card), prev: rect(nav.querySelector('button')), actions: rect(actions),
            buttons: [...controls.querySelectorAll('button')].filter(button => button.getBoundingClientRect().width > 0 && getComputedStyle(button).visibility !== 'hidden').map(rect),
            text: counter.textContent.trim(), lineTops: [...new Set([...range.getClientRects()].map(r => Math.round(r.top)))],
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
          };
        });
        const detail = JSON.stringify({ theme, width, expected, layout });
        assert.equal(layout.text, `${expected} / 50`, detail);
        assert.equal(layout.lineTops.length, 1, `Counter stays on one line: ${detail}`);
        assert(layout.counter.left >= layout.nav.left && layout.counter.right <= layout.nav.right, `Counter fits its rail: ${detail}`);
        assert(!layout.overflow, `No horizontal overflow: ${detail}`);
        for (const [index, button] of layout.buttons.entries()) {
          for (const other of layout.buttons.slice(index + 1)) {
            assert(Math.min(button.right, other.right) <= Math.max(button.left, other.left) + 1 || Math.min(button.bottom, other.bottom) <= Math.max(button.top, other.top) + 1, `Controls do not overlap: ${detail}`);
          }
        }
        if (width > 768) {
          assert(Math.abs(layout.nav.top - layout.card.top) < 1, `Top edge alignment: ${detail}`);
          assert(Math.abs(layout.nav.cx - layout.actions.cx) < 1, `Rail center alignment: ${detail}`);
          assert(layout.actions.top >= layout.nav.bottom + 19, `Actions follow navigation: ${detail}`);
        } else assert(layout.nav.top >= layout.card.bottom, `Mobile controls remain below the card: ${detail}`);
        return layout;
      };
      await inspect(1);
      for (let index = 2; index <= 20; index += 1) await next.click();
      const before = await inspect(20);
      await prev.click();
      await inspect(19);
      await next.click();
      const after = await inspect(20);
      assert.equal(after.nav.top, before.nav.top, 'Navigation does not jump after switching questions');
      if (process.env.OUTPUT_DIR) await page.screenshot({ path: `${process.env.OUTPUT_DIR}/${theme}-${width}.png` });
      await page.getByTestId('ce-pile-active-question').getByText('Agree', { exact: true }).click();
      await inspect(21);
      assert(await page.getByRole('button', { name: /^Submit/ }).isVisible(), 'Pending draft keeps Submit visible');
      if (process.env.OUTPUT_DIR) await page.screenshot({ path: `${process.env.OUTPUT_DIR}/${theme}-${width}-pending.png` });
      console.log(`PASS pile navigation: ${theme} ${width}, 20 / 50, forward/back, and pending draft`);
      await page.close();
    }
  }
} finally { await browser.close(); }
