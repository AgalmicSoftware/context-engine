// Synthetic browser-local data and drafts; never submit answers or modify a Worker.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
const config = JSON.parse(readFileSync(new URL('../client/src/variables/demo/demo_sessions.json', import.meta.url)))['demo-sh'];
const questions = Array.from({ length: 6 }, (_, index) => ({
  id: `0x${String(index + 1).padStart(64, '0')}`,
  type: index < 4 ? 'binary' : 'freeform', prompt: `Synthetic heading question ${index + 1}`,
  options: [], tags: [], sessionSlug: 'demo-sh', sessionId: config.sessionId,
}));
const survey = { id: `0x${'a'.repeat(64)}`, title: 'Synthetic survey', questionIDs: [questions[0].id], sessionSlug: 'demo-sh', sessionId: config.sessionId };
const browser = await chromium.launch({ headless: true });
try {
  for (const theme of (process.env.SMOKE_THEMES || 'civic,classic-95,context-engine').split(',')) {
    for (const width of (process.env.SMOKE_WIDTHS || '320,390,596,705,937,1280').split(',').map(Number)) {
      for (const hasSurveys of [false, true]) {
        if (hasSurveys && width !== 596) continue;
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        await page.addInitScript(theme => {
          localStorage.setItem('ce:theme', theme);
          localStorage.setItem('ce:theme-default-version', '2026-10-13-civic-v1');
          localStorage.setItem('ce_onboarding_complete', 'true');
        }, theme);
        await page.route(`${new URL(config.corsWorkerUrl).origin}/storage/list?*`, route => {
          const resource = new URL(route.request().url()).searchParams.get('resource');
          const items = resource === 'questions' ? questions : resource === 'surveys' && hasSurveys ? [survey] : [];
          return route.fulfill({ json: { items: items.map(item => ({ storageRef: { backend: 'cloudflare', id: item.id, resource } })), listComplete: true, cursor: null } });
        });
        await page.route(`${new URL(config.corsWorkerUrl).origin}/storage/read?*`, route => {
          const item = [...questions, survey].find(item => item.id === new URL(route.request().url()).searchParams.get('id'));
          return route.fulfill({ status: item ? 200 : 404, json: item || {} });
        });
        await page.route('**/session-config?*', route => route.fulfill({ json: { ok: true, sessionSlug: 'demo-sh', config } }));
        await page.goto(`${base}/session/demo-sh`);
        await page.getByTestId('ce-pile-active-question').waitFor({ timeout: 60000 });
        if (width <= 768) await page.getByRole('button', { name: 'Question actions', exact: true }).click();
        await page.getByTestId('ce-survey-view-all').click();
        const heading = page.getByTestId('ce-session-questions-full-header').getByRole('heading', { level: 2 });
        const selector = page.getByTestId('ce-survey-questions-toggle');
        const expectCount = async count => {
          await page.waitForFunction(({ count, hasSurveys }) => {
            const element = document.querySelector(hasSurveys ? '[data-testid="ce-survey-questions-toggle"]' : '[data-testid="ce-session-questions-full-header"] h2');
            return element?.textContent.replace(/\s+/g, '') === `Questions(${count})`;
          }, { count, hasSurveys }).catch(async error => {
            console.error({ theme, width, hasSurveys, expectedCount: count, heading: await heading.textContent(), toolbar: await page.getByTestId('ce-survey-toolbar').textContent() });
            if (process.env.OUTPUT_DIR) await page.screenshot({ path: `${process.env.OUTPUT_DIR}/${theme}-${width}-failure.png` });
            throw error;
          });
          assert.equal(await selector.count(), hasSurveys ? 1 : 0);
          if (hasSurveys) assert.equal((await heading.textContent()).trim(), 'Questions');
        };
        const inspectLayout = async suffix => {
          const layout = await page.getByTestId('ce-survey-toolbar').evaluate(toolbar => {
            const rect = element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
            const header = document.querySelector('[data-testid="ce-session-questions-full-header"]');
            return {
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
              overflowElements: [...document.querySelectorAll('body *')].filter(element => {
                const r = element.getBoundingClientRect();
                return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
              }).slice(0, 12).map(element => ({ tag: element.tagName, class: element.className, ...rect(element) })),
              controls: [...toolbar.querySelectorAll('button'), ...header.querySelectorAll('button,h2')].filter(element => element.getBoundingClientRect().width > 0).map(rect),
            };
          });
          const detail = JSON.stringify({ theme, width, hasSurveys, suffix, layout });
          if (process.env.OUTPUT_DIR) await page.screenshot({ path: `${process.env.OUTPUT_DIR}/${theme}-${width}-${hasSurveys ? 'surveys' : 'questions'}-${suffix}.png` });
          assert(!layout.overflow, `No page overflow: ${detail}`);
          if (!hasSurveys) {
            const primary = layout.controls.slice(0, 3);
            assert(primary.every(control => Math.abs((control.top + control.bottom) / 2 - (primary[0].top + primary[0].bottom) / 2) <= 1), `Primary toolbar actions share one row: ${detail}`);
          }
          for (const [index, control] of layout.controls.entries()) {
            assert(control.left >= -1 && control.right <= width + 1, `Control fits viewport: ${detail}`);
            for (const other of layout.controls.slice(index + 1)) {
              assert(Math.min(control.right, other.right) <= Math.max(control.left, other.left) + 1 || Math.min(control.bottom, other.bottom) <= Math.max(control.top, other.top) + 1, `Controls do not overlap: ${detail}`);
            }
          }
        };
        await expectCount(6);
        await inspectLayout('initial');
        if (hasSurveys) {
          await selector.click();
          assert(await page.getByRole('menuitem', { name: 'Synthetic survey', exact: true }).isVisible(), 'Existing surveys remain selectable');
          await selector.click();
        }
        const applyType = async type => {
          await page.getByTestId('ce-survey-filter-toggle').click();
          const modal = page.getByTestId('ce-question-filter-modal');
          await modal.waitFor();
          const clear = modal.getByTestId('ce-question-filter-clear-all');
          if (await clear.isVisible()) await clear.click();
          if (type) {
            const button = modal.getByRole('button', { name: new RegExp(`^${type}`) });
            if (!await button.isVisible()) await modal.getByRole('heading', { name: 'Question Types', exact: true }).click();
            await button.click();
          }
          await modal.getByRole('button', { name: 'See Questions', exact: true }).click();
          await modal.waitFor({ state: 'hidden' });
        };
        await applyType('Binary');
        await expectCount(4);
        await applyType('Rating');
        await expectCount(0);
        await applyType(null);
        await expectCount(6);
        await page.getByText('Agree', { exact: true }).first().click();
        await page.getByTestId('ce-survey-toolbar').getByRole('button', { name: /^Submit/ }).waitFor();
        await expectCount(6);
        await inspectLayout('pending');
        await page.getByTestId('ce-session-questions-full-header').getByRole('button', { name: /Back/ }).click();
        await page.getByTestId('ce-pile-active-question').waitFor();
        console.log(`PASS heading: ${theme} ${width}, surveys=${hasSurveys}, filters 6→4→0→6, pending draft, and Back`);
        await page.close();
      }
    }
  }
} finally { await browser.close(); }
