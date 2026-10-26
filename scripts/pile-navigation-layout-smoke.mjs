// Synthetic browser-local questions and drafts; never submit answers or modify a Worker.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizePublicInterviewQuestions } from '../shared/interviewQuestionCatalog.mjs';
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
  for (const theme of (process.env.SMOKE_THEMES || 'civic,classic-95,context-engine').split(',')) {
    for (const width of (process.env.SMOKE_WIDTHS || '320,335,390,596,640,705,768,773,937,1280').split(',').map(Number)) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width <= 768, reducedMotion: 'reduce' });
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
      const menu = page.getByRole('button', { name: 'Question actions', exact: true });
      const filter = page.getByTestId('ce-survey-filter-toggle');
      const voice = page.getByTestId('ce-session-listening-toggle');
      assert(await voice.isVisible(), 'Voice mode is directly visible before opening any menu');
      assert.equal(await voice.count(), 1, 'Voice mode has one toolbar control');
      if (width <= 768) {
        assert(await menu.isVisible(), 'Mobile hamburger is available before answering');
        assert(!await filter.isVisible(), 'Mobile actions start collapsed');
        if (theme === 'civic') {
          const appearance = locator => locator.evaluate(element => ({ color: getComputedStyle(element).color, opacity: getComputedStyle(element).opacity }));
          assert.deepEqual(await appearance(voice), await appearance(menu), 'Idle microphone matches hamburger color and opacity');
          assert.deepEqual(await appearance(voice), await appearance(next), 'Idle microphone matches enabled arrow color and opacity');
        }
        const voiceBox = await voice.boundingBox(), menuBox = await menu.boundingBox();
        assert(voiceBox.x >= menuBox.x + menuBox.width && Math.abs(voiceBox.y + voiceBox.height / 2 - menuBox.y - menuBox.height / 2) <= 1, 'Microphone sits beside the hamburger');
        await voice.click();
        await page.getByTestId('ce-session-voice-mode-chooser').waitFor();
        await page.getByRole('button', { name: 'Close', exact: true }).click();
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
        await next.focus();
        await filter.waitFor({ state: 'hidden' });
        await menu.tap();
        const actionDialog = page.getByRole('dialog', { name: 'Question actions', exact: true });
        await actionDialog.waitFor();
        await filter.waitFor({ state: 'visible' });
        for (const name of ['Filter questions', 'Add questions', 'All questions']) {
          assert(await actionDialog.getByRole('button', { name, exact: true }).isVisible(), `${name} has a visible label`);
        }
        const popupBox = await actionDialog.boundingBox();
        assert(popupBox.x >= 0 && popupBox.x + popupBox.width <= width && popupBox.y >= 0 && popupBox.y + popupBox.height <= 900, 'Labelled menu fits viewport');
        assert(await page.getByTestId('ce-question-actions-backdrop').evaluate(element => getComputedStyle(element).backdropFilter.includes('blur(')), 'Open actions blur the background');
        assert(await filter.evaluate(element => element === document.activeElement), 'First menu action receives focus');
        if (process.env.OUTPUT_DIR) await page.screenshot({ path: `${process.env.OUTPUT_DIR}/${theme}-${width}-menu.png` });
        await page.keyboard.press('Tab');
        assert(await actionDialog.getByRole('button', { name: 'Add questions', exact: true }).evaluate(element => element === document.activeElement), 'Labelled actions are keyboard reachable');
        await page.keyboard.press('Escape');
        await actionDialog.waitFor({ state: 'hidden' });
        assert(await menu.evaluate(element => element === document.activeElement), 'Escape restores hamburger focus');
        await menu.press('Enter');
        await actionDialog.waitFor();
        await page.getByTestId('ce-question-actions-backdrop').click({ position: { x: width - 5, y: 5 } });
        await actionDialog.waitFor({ state: 'hidden' });
        assert.equal(await page.getByTestId('ce-question-actions-backdrop').count(), 0, 'Dismissal removes blur');
        await next.tap();
        await prev.tap();
      } else {
        assert(!await menu.isVisible(), 'Desktop keeps inline actions');
        assert(await filter.isVisible(), 'Desktop filter remains directly accessible');
      }
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
          const textRects = [...counter.children].flatMap(part => {
            const range = document.createRange(); range.selectNodeContents(part);
            return [...range.getClientRects()];
          });
          const rect = element => { const r = element.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, cx: r.left + r.width / 2, cy: r.top + r.height / 2, width: r.width }; };
          return {
            nav: rect(nav), menu: rect(actions.querySelector('button')), next: rect(button), counter: rect(counter), card: rect(card), prev: rect(nav.querySelector('button')), actions: rect(actions),
            buttons: [...controls.querySelectorAll('button')].filter(button => button.getBoundingClientRect().width > 0 && getComputedStyle(button).visibility !== 'hidden').map(button => ({ ...rect(button), inFooter: !!button.closest('[class*="pileFooter_"]') })),
            text: counter.textContent.trim(), lineTops: [...new Set(textRects.map(r => Math.round(r.top)))],
            submitLabelFits: [...controls.querySelectorAll('[class*="pileSubmitButtonLabel_"]')].every(label => {
              const labelRect = label.getBoundingClientRect(), buttonRect = label.closest('button').getBoundingClientRect();
              return labelRect.left >= buttonRect.left && labelRect.right <= buttonRect.right;
            }),
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
          };
        });
        const detail = JSON.stringify({ theme, width, expected, layout });
        assert.equal(layout.text, `${expected} / 50`, detail);
        if (width <= 640) {
          assert.equal(layout.lineTops.length, 3, `Phone counter uses a narrow column: ${detail}`);
          assert(layout.counter.width < 32, `Counter leaves room for the controls: ${detail}`);
        } else assert.equal(layout.lineTops.length, 1, `Wide counter stays on one line: ${detail}`);
        if (width <= 768) {
          for (const control of layout.buttons) {
            if (width <= 480 && control.inFooter) {
              assert(control.top >= layout.nav.bottom, `Submit and clear have their own row on narrow phones: ${detail}`);
            } else {
              assert(Math.abs(control.cy - layout.nav.cy) <= 1, `Microphone, menu, and arrows share a row: ${detail}`);
            }
          }
          assert(layout.submitLabelFits, `Submit label fits its button: ${detail}`);
        }
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
      if (width === 320) {
        for (let expected = 22; expected <= 31; expected += 1) {
          await page.getByTestId('ce-pile-active-question').getByText('Agree', { exact: true }).click();
          await inspect(expected);
        }
        assert(await page.getByRole('button', { name: 'Submit (11)', exact: true }).isVisible(), 'Two-digit pending count fits the row');
        if (process.env.OUTPUT_DIR) await page.screenshot({ path: `${process.env.OUTPUT_DIR}/${theme}-${width}-pending-11.png` });
      }
      console.log(`PASS pile navigation: ${theme} ${width}, 20 / 50, forward/back, and pending draft`);
      if (theme === 'civic' && width === 390) {
        const catalog = normalizePublicInterviewQuestions(questions).sort((a, b) => a.id.localeCompare(b.id));
        const questionSetHash = createHash('sha256').update(JSON.stringify(catalog)).digest('hex');
        const packet = { version: 1, sessionSlug: 'demo-sh', questionSetHash, promptVersion: 'ce-interview-brief-v5',
          source: { platform: 'other', modelId: 'synthetic', verification: 'self_reported' },
          responderContext: {}, responses: [{ questionId: questions[0].id, answer: 'Agree', confidence: 0.8 }] };
        await page.route('**/agent/interview-catalog?*', route => route.fulfill({ json: {
          type: 'context-engine.interview-question-catalog', version: 1, sessionSlug: 'demo-sh',
          prefillPromptVersion: packet.promptVersion, questionSetHash, questions: catalog,
        } }));
        await page.goto(`${base}/session/demo-sh#prefill=${Buffer.from(JSON.stringify(packet)).toString('base64url')}`);
        await page.getByTestId('ce-session-interview-review').waitFor();
        await page.getByRole('button', { name: 'Close', exact: true }).click();
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
        await next.focus();
        assert.equal(await voice.getAttribute('aria-pressed'), 'true', 'Retained review keeps microphone active while closed');
        await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="ce-session-listening-toggle"]')).opacity === '1');
        await voice.click();
        await page.getByTestId('ce-session-interview-review').waitFor();
        assert(!await page.getByTestId('ce-session-voice-mode-chooser').isVisible(), 'Microphone resumes the retained review');
        await page.getByRole('button', { name: 'Discard interview', exact: true }).click();
        await page.getByRole('dialog', { name: 'Discard this interview?' }).getByRole('button', { name: 'Discard interview', exact: true }).click();
        await page.getByRole('dialog', { name: 'Interview', exact: true }).waitFor({ state: 'hidden' });
        await page.getByRole('dialog', { name: /Discard this interview/ }).waitFor({ state: 'hidden' });
        await next.focus();
        assert.equal(await voice.getAttribute('aria-pressed'), 'false', 'Discard clears the interview indicator');
        await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="ce-session-listening-toggle"]')).opacity === '0.45');
        console.log('PASS interview close/reopen, retained indicator, and explicit discard');
      }
      await page.close();
    }
  }
} finally { await browser.close(); }
