import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import {
  PHONES, THEMES, WORKER_ORIGIN,
  assertNoHiddenFaults, assertNoSidewaysScroll, assertReachable, assertReadableText,
  chooseTheme, createJourneySession, createPasskey, maxAtOnce, openLoginDialog, openPersonContext, outage, passkeyFixture, settled,
} from './lib/session-journey-harness.mjs';

// A participant's whole visit on a phone, in the built client against the real Session Worker code:
// open an invite link, make a passkey, land in the group, answer every kind of question on the card, reload,
// Submit forty answers through an outage, reload, sign out and back in, and read Results.
// WebKit is the engine of every iPhone browser; Chromium stands for Android.

const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseUrl).hostname), 'This journey requires a local client');
const outputDir = process.env.OUTPUT_DIR || 'artifacts/participant-journey-smoke';
const engines = { webkit, chromium };
const engineNames = (process.env.JOURNEY_ENGINES || 'webkit,chromium').split(',').map((name) => name.trim()).filter(Boolean);
for (const name of engineNames) assert.ok(engines[name], `Unknown browser engine: ${name}`);
await mkdir(outputDir, { recursive: true });
const startedAt = performance.now();

const TOTAL = 40;
const UPLOADS_AT_ONCE = 4;
// One of each kind first, then yes/no statements up to a salon's forty.
const typedQuestions = [
  { type: 'binary', prompt: 'Community decisions should be easier to understand.' },
  { type: 'multichoice', singleSelect: true, prompt: 'Which matters most this year?', options: ['Housing', 'Transport', 'Parks and shared outdoor space', 'Local business'] },
  { type: 'multichoice', prompt: 'Which of these would you use?', options: ['A shared tool library', 'A weekly market', 'A repair cafe', 'A youth club'] },
  { type: 'rating', prompt: 'How well does the council explain its budget?' },
  { type: 'quadratic', prompt: 'Spread your voice across these priorities.', options: ['Safer streets', 'Cleaner air', 'More trees'] },
  { type: 'freeform', prompt: 'What one change would help your street most?' },
];
const freeText = 'A crossing by the school, and a bench.';

const activeCard = (page) => page.getByTestId('ce-pile-active-question');
const nextButton = (page) => page.getByRole('button', { name: 'Next Question', exact: true });
const cardPrompt = async (page, prompts) => {
  const text = await activeCard(page).innerText();
  return prompts.find((prompt) => text.includes(prompt)) || '';
};

// What a finger does on each kind of card. Returns what the Worker should then hold.
const answerOnCard = {
  binary: async (page) => {
    const option = activeCard(page).getByText('Agree', { exact: true });
    await assertReachable(option, 'The Agree option');
    await option.click();
    return 'Agree';
  },
  single: async (page) => {
    const option = activeCard(page).getByText('Transport', { exact: true });
    await assertReachable(option, 'A single-choice option');
    await option.click();
    // A single choice stays on its card until the person moves on.
    await page.waitForTimeout(900);
    assert.ok((await activeCard(page).innerText()).includes('Which matters most this year?'), 'A single choice stays on its card');
    return ['Transport'];
  },
  multi: async (page) => {
    for (const label of ['A weekly market', 'A youth club']) {
      const option = activeCard(page).getByText(label, { exact: true });
      await assertReachable(option, `The option "${label}"`);
      await option.click();
    }
    return ['A weekly market', 'A youth club'];
  },
  rating: async (page) => {
    const slider = activeCard(page).locator('input[type="range"]');
    await assertReachable(slider, 'The rating slider');
    await slider.focus();
    for (let step = 0; step < 3; step += 1) await slider.press('ArrowRight');
    return Number(await slider.inputValue());
  },
  quadratic: async (page) => {
    for (const control of ['ce-quadratic-increase-0', 'ce-quadratic-increase-0', 'ce-quadratic-decrease-1']) {
      const button = activeCard(page).getByTestId(control);
      await assertReachable(button, `The quadratic control ${control}`);
      await button.click();
    }
    return [2, -1, 0];
  },
  freeform: async (page) => {
    const box = activeCard(page).locator('textarea').first();
    await assertReachable(box, 'The free-text box');
    await box.fill(freeText);
    return freeText;
  },
};
const kindOf = (question) => (question.type === 'multichoice' ? (question.singleSelect ? 'single' : 'multi') : question.type);

// Waits for the card on screen to stop showing `prompt`.
const cardLeft = (page, prompt, timeout) => page.waitForFunction(
  (shown) => !document.querySelector('[data-testid="ce-pile-active-question"]')?.innerText.includes(shown),
  prompt, { timeout },
).then(() => true, () => false);

// Answers the card on screen if it is unanswered, then moves on. Stops when `count` cards are answered.
// A yes/no card moves on by itself a moment after the tap; every other kind waits for Next. Next is tapped
// only while the answered card is still on screen, so a slow machine cannot skip a card.
const answerCards = async (page, questions, answered, count) => {
  const prompts = questions.map((question) => question.record.prompt);
  for (let guard = 0; answered.size < count && guard < questions.length * 3; guard += 1) {
    await activeCard(page).waitFor();
    const prompt = await cardPrompt(page, prompts);
    const question = questions.find((entry) => entry.record.prompt === prompt);
    const fresh = question && !answered.has(question.id);
    if (fresh) {
      await assertNoSidewaysScroll(page, `The ${kindOf(question.record)} card`);
      answered.set(question.id, await answerOnCard[kindOf(question.record)](page));
      if (answered.size >= count) break;
    }
    const movesOnByItself = fresh && question.record.type === 'binary';
    if (movesOnByItself && await cardLeft(page, prompt, 5000)) continue;
    await nextButton(page).click();
    assert.ok(await cardLeft(page, prompt, 5000), `Next did not leave the card "${prompt}"`);
  }
  assert.equal(answered.size, count, `Answered ${answered.size} of ${count} cards`);
};

// Walks the deck to the card that shows `prompt`.
const showQuestion = async (page, prompt, count) => {
  const card = activeCard(page);
  await card.waitFor();
  const previous = page.getByRole('button', { name: 'Previous Question', exact: true });
  for (let index = 0; index <= count && await previous.isEnabled(); index += 1) await previous.click();
  for (let index = 0; index <= count; index += 1) {
    if ((await card.innerText()).includes(prompt)) return card;
    await nextButton(page).click();
  }
  return assert.fail(`Question was not shown: ${prompt}`);
};

const submitButton = (page) => page.locator('[data-testid="ce-survey-submit"]:visible').first();
const runJourney = async (engineName, phoneName) => {
  const label = `${engineName} ${phoneName}`;
  const session = createJourneySession({ baseUrl, slug: `journey-${engineName}` });
  const questions = [];
  for (const question of typedQuestions) questions.push(await session.seedQuestion(question));
  for (let index = questions.length + 1; index <= TOTAL; index += 1) {
    questions.push(await session.seedQuestion({ type: 'binary', prompt: `Statement ${index}: neighbours should hear about local plans early.` }));
  }
  // The host's invite link: it names the group and carries a one-use code after the #.
  const inviteCode = 'a1b2c3d4'.repeat(4);
  const groupId = await session.createCodeGroup({ groupId: 'salon', label: 'Salon', description: 'Everyone at the salon.', codes: [inviteCode] });

  const person = passkeyFixture(`person-${engineName}`);
  const personClient = session.clientFor(person.wallet);
  const browser = await engines[engineName].launch({ headless: true });
  let page;
  try {
    // The Worker's network, as this visit sees it: slow enough to watch, with one answer upload lost.
    const net = { delayMs: 0, failResponseUploadAt: 0, responseUploads: [] };
    const { context, browserRequests } = await openPersonContext(browser, session, {
      fixture: person,
      viewport: PHONES[phoneName],
      contextOptions: { hasTouch: true, ...(engineName === 'chromium' ? { isMobile: true } : {}) },
      onWorkerRequest: ({ request, url, record }) => {
        if (url.pathname === '/storage/upload' && request.method() === 'POST') {
          const upload = request.postDataJSON();
          if (upload?.resource === 'responses') {
            record.responseUpload = true;
            net.responseUploads.push(record);
            if (net.responseUploads.length === net.failResponseUploadAt) return outage(session);
          }
        }
        return net.delayMs;
      },
    });
    page = await context.newPage();
    // A reload cuts off requests in flight, which WebKit reports as page errors; those are not faults.
    const pageErrors = [];
    let leaving = false;
    page.on('pageerror', (error) => { if (!leaving) pageErrors.push(error.message); });
    const reload = async () => {
      leaving = true;
      await page.reload({ waitUntil: 'domcontentloaded' });
      leaving = false;
    };

    // 1. The invite link, signed out, then a new passkey.
    await page.goto(`${session.sessionUrl}&joinGroup=${groupId}#groupInvite=${inviteCode}`, { waitUntil: 'domcontentloaded' });
    await activeCard(page).waitFor();
    await settled(page);
    await assertNoSidewaysScroll(page, 'The session page');
    const dialog = await openLoginDialog(page);
    await assertReachable(page.getByTestId('ce-passkey-wallet-create'), 'Create passkey, in the log-in dialog,');
    await assertReachable(page.getByTestId('ce-passkey-wallet-sign-in'), 'Sign in, in the log-in dialog,');
    await assertReadableText(dialog, 'The log-in dialog');
    await createPasskey(page, person.wallet);
    console.log(`[${label}] Opened the invite link and made a passkey.`);

    // 2. The link's group, joined once.
    const joined = () => session.groupsOf(person.wallet);
    const deadline = Date.now() + 15000;
    while (!(await joined()).includes(groupId) && Date.now() < deadline) await page.waitForTimeout(200);
    assert.deepEqual(await joined(), [groupId], 'The invite link joined its group once the person signed in');
    assert.equal(new URL(page.url()).hash.includes(inviteCode), false, 'The code leaves the address bar');
    console.log(`[${label}] Joined the invite link's group.`);

    // 3. One of every kind of question, on the card.
    const answered = new Map();
    await answerCards(page, questions, answered, typedQuestions.length);
    await assertReadableText(activeCard(page), 'The question card');
    console.log(`[${label}] Answered one card of every kind.`);

    // 4. A reload before Submit keeps the unsent answers.
    await submitButton(page).waitFor();
    await reload();
    await submitButton(page).filter({ hasText: `(${typedQuestions.length})` }).waitFor();
    assert.equal((await personClient.listAll('responses', { mine: true })).items.length, 0, 'Nothing is stored before Submit');
    console.log(`[${label}] The unsent answers survived a reload.`);

    // 5. The rest of the forty, then Submit through an outage.
    await answerCards(page, questions, answered, TOTAL);
    net.delayMs = 120;
    net.failResponseUploadAt = 7;
    const submit = submitButton(page);
    await assertReachable(submit, 'Submit');
    // Watch from before the tap: the count is on screen only while the answers are being stored.
    const sawCount = page
      .waitForFunction((total) => new RegExp(`Saving \\d+ of ${total}`).test(document.body.innerText), TOTAL, { timeout: 30000 })
      .then(() => true, () => false);
    await submit.click();
    assert.ok(await sawCount, `Submit never showed its count ("Saving n of ${TOTAL}")`);
    const partialError = page.getByText(/Some answers didn't save \(/);
    await partialError.waitFor();
    // An outage stops the Submit: the answers already on their way finish, and the rest wait for the retry.
    const firstWave = net.responseUploads.length;
    const savedFirst = net.responseUploads.filter(({ status }) => status === 200).length;
    assert.ok(firstWave >= net.failResponseUploadAt && firstWave < TOTAL, `The outage stopped the Submit part-way (${firstWave} sent)`);
    assert.equal(maxAtOnce(net.responseUploads), UPLOADS_AT_ONCE, `Submit sends ${UPLOADS_AT_ONCE} answers at a time`);
    assert.equal((await personClient.listAll('responses', { mine: true })).items.length, savedFirst, 'Every answer the Worker accepted is stored');
    net.failResponseUploadAt = 0;
    await submitButton(page).click();
    await partialError.waitFor({ state: 'hidden' });
    await page.getByTestId('ce-survey-submitted-indicator').first().waitFor();
    assert.equal(net.responseUploads.filter(({ status }) => status === 200).length, TOTAL, 'The retry sends only what was not yet saved');
    assert.equal(net.responseUploads.length, TOTAL + 1, 'One lost upload, one extra request');
    console.log(`[${label}] Submitted ${TOTAL} answers ${UPLOADS_AT_ONCE} at a time, with a count, through one lost upload.`);

    // 6. What the Worker now holds is what the finger chose.
    const stored = await personClient.listAll('responses', { mine: true });
    assert.equal(stored.complete, true);
    assert.equal(stored.items.length, TOTAL, 'One stored answer per question');
    const records = await Promise.all(stored.items.map((entry) => personClient.read(entry.storageRef.id)));
    const storedByQuestion = new Map(records.map((record) => [record.questionID, record.answer.value]));
    for (const question of questions) {
      assert.deepEqual(storedByQuestion.get(question.id.toLowerCase()), answered.get(question.id), `Stored answer to "${question.record.prompt}"`);
    }

    // 7. A reload says the saved answers are loading, then shows them.
    net.delayMs = 150;
    await reload();
    const sawLoading = await page.waitForFunction(() => /Loading your saved answers/.test(document.body.innerText), null, { timeout: 30000 })
      .then(() => true, () => false);
    assert.ok(sawLoading, 'The reload never said the saved answers were loading');
    await page.waitForFunction(() => !/saved answers/.test(document.body.innerText), null, { timeout: 60000 });
    net.delayMs = 0;
    await activeCard(page).waitFor();
    assert.equal(await submitButton(page).count(), 0, 'Nothing is left to submit after a reload');
    console.log(`[${label}] Reloaded: the saved answers were announced as loading, then shown.`);

    // 8. Signed out, the answers are not on the page; signed in again with the same passkey, they are.
    const firstAnswer = async () => {
      const card = await showQuestion(page, questions[0].record.prompt, TOTAL);
      return card.getByRole('radio', { name: 'Agree', exact: true }).isChecked();
    };
    assert.equal(await firstAnswer(), true, 'The saved answer shows on its card');
    await page.getByTestId('ce-wallet-display').click();
    const disconnect = page.getByRole('dialog').getByRole('button', { name: 'Disconnect' });
    await assertReachable(disconnect, 'Disconnect, in the account dialog,');
    await disconnect.click();
    await page.getByTestId('ce-account-login-button').waitFor();
    // Signing out leaves the log-in dialog open; the person closes it to look at the page.
    await page.getByTestId('ce-passkey-wallet-sign-in').waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await firstAnswer(), false, 'A signed-out page shows no saved answer');
    await page.getByTestId('ce-account-login-button').click();
    await page.getByTestId('ce-passkey-wallet-sign-in').click();
    await page.getByTestId('ce-wallet-display').waitFor().catch(() => assert.fail('Signing in with the passkey did not sign the person in'));
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => !/saved answers/.test(document.body.innerText));
    const backDeadline = Date.now() + 20000;
    while (!(await firstAnswer()) && Date.now() < backDeadline) await page.waitForTimeout(250);
    assert.equal(await firstAnswer(), true, 'Signing in again brings the saved answers back');
    assert.equal(await submitButton(page).count(), 0, 'Nothing is left to submit after signing in again');
    console.log(`[${label}] Signed out (answers gone from the page) and in again (answers back).`);

    // 9. Results count this person's answer.
    await page.getByTestId('ce-session-results-toggle').click();
    await page.getByRole('button', { name: 'Report', exact: true }).click();
    await page.getByTestId('ce-polis-all-questions').getByText(/^Agree: 1\s*\/\s*Unsure: 0\s*\/\s*Disagree: 0\s*\/\s*Responses: 1$/).first().waitFor();
    await assertNoSidewaysScroll(page, 'Results');
    console.log(`[${label}] Results show the submitted answer.`);

    assert.deepEqual(pageErrors, [], 'No page errors during the visit');
    assertNoHiddenFaults(session, browserRequests, 'The visit');
    await page.screenshot({ path: `${outputDir}/${engineName}-${phoneName}-end.png` });
  } catch (error) {
    if (page) await page.screenshot({ path: `${outputDir}/${engineName}-${phoneName}-failure.png` }).catch(() => {});
    error.message = `[${label}] ${error.message}`;
    throw error;
  } finally {
    await browser.close();
  }
};

// Every option of the card on screen lies inside the screen's width: none is cut off at the side.
const assertOptionsInsideScreen = async (page, what) => {
  const cut = await activeCard(page).evaluate((card) => {
    const width = (window.visualViewport || { width: innerWidth }).width;
    return [...card.querySelectorAll('label, input, textarea, button')]
      .map((element) => ({ element, box: element.getBoundingClientRect() }))
      .filter(({ box }) => box.width && box.height && (box.left < -2 || box.right > width + 2))
      .map(({ element, box }) => `${element.tagName.toLowerCase()} "${(element.innerText || element.getAttribute('aria-label') || '').slice(0, 30)}" at ${Math.round(box.left)}-${Math.round(box.right)} of ${Math.round(width)}`);
  });
  assert.deepEqual(cut, [], `${what}: controls cut off at the side`);
};

// With the page unscrolled, the card's top, its first control and Next are on one screen: a person reads the
// question, answers and moves on without scrolling.
const assertCardFitsWithNext = async (page, what) => {
  const problem = await page.evaluate(() => {
    const height = (window.visualViewport || { height: innerHeight }).height;
    if (scrollY > 1) return `the page is scrolled by ${Math.round(scrollY)}px`;
    const card = document.querySelector('[data-testid="ce-pile-active-question"]').getBoundingClientRect();
    if (card.top < 0 || card.top > height) return `the card's top is at ${Math.round(card.top)} of ${Math.round(height)}`;
    const control = document.querySelector('[data-testid="ce-pile-active-question"]').querySelector('label, input, textarea');
    const first = control?.getBoundingClientRect();
    if (first && (first.top < 0 || first.bottom > height + 2)) return `the first control ends at ${Math.round(first.bottom)} of ${Math.round(height)}`;
    const next = [...document.querySelectorAll('button')].find((button) => button.getAttribute('aria-label') === 'Next Question' || button.innerText.trim() === 'Next Question');
    const box = next?.getBoundingClientRect();
    if (!box || !box.height) return 'there is no Next';
    if (box.top < 0 || box.bottom > height + 2) return `Next ends at ${Math.round(box.bottom)} of ${Math.round(height)}`;
    return '';
  });
  assert.equal(problem, '', `${what}: ${problem}`);
};

// The same screens in every theme at every phone size: the cards and the log-in dialog as a visitor sees them,
// then the group code field, which a members-only session shows once the person has signed in.
const runLookPass = async (engineName) => {
  const session = createJourneySession({ baseUrl, slug: `look-${engineName}` });
  const questions = [];
  for (const question of typedQuestions) questions.push(await session.seedQuestion(question));
  await session.createCodeGroup({ groupId: 'by-invitation', label: 'By invitation', description: 'Needs a code.', codes: ['e5f6a7b8'.repeat(4)] });
  const browser = await engines[engineName].launch({ headless: true });
  let page;
  let where = '';
  // Every screen is looked at before the pass fails, so one fault does not hide the next.
  const problems = [];
  const faint = new Set();
  const look = async (check) => {
    try {
      for (const note of (await check()) || []) faint.add(`${where.split(' ')[1]}: ${note}`);
    } catch (error) {
      if (error?.code !== 'ERR_ASSERTION') throw error;
      problems.push(`[${where}] ${error.message.split('\n')[0]} ${error.actual && typeof error.actual === 'object' ? JSON.stringify(error.actual) : ''}`.trim());
    }
  };
  try {
    for (const theme of THEMES) {
      for (const [phoneName, viewport] of Object.entries(PHONES)) {
        where = `${engineName} ${theme} ${phoneName}`;
        const person = passkeyFixture(`look-${engineName}-${theme}-${phoneName}`);
        const { context, browserRequests } = await openPersonContext(browser, session, {
          fixture: person, viewport, contextOptions: { hasTouch: true, ...(engineName === 'chromium' ? { isMobile: true } : {}) },
        });
        page = await context.newPage();
        await page.goto(session.sessionUrl, { waitUntil: 'domcontentloaded' });
        await activeCard(page).waitFor();
        await chooseTheme(page, theme);
        await activeCard(page).waitFor();
        await settled(page);
        // Listen from here: the theme's reload cuts off requests in flight, which WebKit reports as errors.
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        const seen = new Set();
        for (let index = 0; index < questions.length; index += 1) {
          const prompt = await cardPrompt(page, questions.map((question) => question.record.prompt));
          assert.ok(prompt, 'A question card is on screen');
          seen.add(prompt);
          await look(() => assertCardFitsWithNext(page, `The card "${prompt}"`));
          await look(() => assertNoSidewaysScroll(page, `The card "${prompt}"`));
          await look(() => assertOptionsInsideScreen(page, `The card "${prompt}"`));
          await look(() => assertReadableText(activeCard(page), `The card "${prompt}"`));
          if (index + 1 < questions.length) {
            await nextButton(page).click();
            assert.ok(await cardLeft(page, prompt, 5000), `Next did not leave the card "${prompt}"`);
          }
        }
        assert.equal(seen.size, questions.length, 'The pass looked at every kind of card');
        const dialog = await openLoginDialog(page);
        await look(() => assertReachable(page.getByTestId('ce-passkey-wallet-create'), 'Create passkey, in the log-in dialog,'));
        await look(() => assertReachable(page.getByTestId('ce-passkey-wallet-sign-in'), 'Sign in, in the log-in dialog,'));
        await look(() => assertReadableText(dialog, 'The log-in dialog'));
        await createPasskey(page, person.wallet);
        await page.getByTestId('ce-session-groups-toggle').click();
        const code = page.getByLabel('Invite link or password for By invitation', { exact: true });
        await code.waitFor();
        await look(() => assertReachable(code, 'The group code field'));
        await look(() => assertReadableText(code, 'The empty group code field'));
        await code.fill('ab12-cd34');
        await look(() => assertReadableText(code, 'The filled group code field'));
        await look(() => assertNoSidewaysScroll(page, 'The Groups section'));
        await look(() => assert.deepEqual(pageErrors, [], 'No page errors'));
        assertNoHiddenFaults(session, browserRequests, 'The look pass');
        await context.close();
      }
    }
  } catch (error) {
    if (page) await page.screenshot({ path: `${outputDir}/look-${where.replace(/ /g, '-')}-failure.png` }).catch(() => {});
    error.message = `[look: ${where}] ${error.message}`;
    throw error;
  } finally {
    await browser.close();
  }
  for (const note of faint) console.log(`  faint, not failed: ${note}`);
  assert.deepEqual(problems, [], `The look pass found ${problems.length} problem(s)`);
  console.log(`[${engineName}] Cards, log-in dialog and group code field checked in ${THEMES.length} themes at ${Object.keys(PHONES).length} phone sizes.`);
};

const only = process.env.JOURNEY_ONLY || "";
for (const engineName of engineNames) {
  if (only !== "look") await runJourney(engineName, engineName === "webkit" ? "iphone" : "android");
  if (only !== "visit") await runLookPass(engineName);
}
console.log(`Participant journey passed in ${Math.round(performance.now() - startedAt)}ms (${engineNames.join(', ')}; Worker ${WORKER_ORIGIN}).`);
