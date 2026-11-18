import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import {
  KV_OPERATIONS_PER_REQUEST, PHONES, SESSION_ID,
  assertNoHiddenFaults, assertNoSidewaysScroll, buildResponseRecord, createJourneySession, createPasskey, ethers,
  maxAtOnce, openPersonContext, outage, passkeyFixture,
} from './lib/session-journey-harness.mjs';

// Results at the size of a salon: fifty people, forty statements, two thousand answers, stored through the
// real upload path and read by the built client from the real Session Worker code. The store keeps
// Cloudflare's limits and takes time per operation, and every request to the Worker takes time, so a read
// path that only works on an instant, limitless store fails here.

const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseUrl).hostname), 'This journey requires a local client');
const outputDir = process.env.OUTPUT_DIR || 'artifacts/results-salon-journey-smoke';
const engines = { webkit, chromium };
const engineNames = (process.env.JOURNEY_ENGINES || 'webkit,chromium').split(',').map((name) => name.trim()).filter(Boolean);
for (const name of engineNames) assert.ok(engines[name], `Unknown browser engine: ${name}`);
await mkdir(outputDir, { recursive: true });
const startedAt = performance.now();

const PEOPLE = 50;
const STATEMENTS = 40;
const PAGE = 100;
const votes = ['Agree', 'Disagree', 'Unsure'];
const voteOf = (person, statement) => votes[(person + statement) % votes.length];
// What Results must say for statement `number` (1-based), from the votes above.
const expectedLine = (number) => {
  const tally = { Agree: 0, Unsure: 0, Disagree: 0 };
  for (let person = 0; person < PEOPLE; person += 1) tally[voteOf(person, number - 1)] += 1;
  return `Agree: ${tally.Agree} / Unsure: ${tally.Unsure} / Disagree: ${tally.Disagree} / Responses: ${PEOPLE}`;
};
// The slowness of a real network and store, small enough to keep the run short.
const REQUEST_MS = 20;
const KV_MS = 5;

const seedSalon = async (slug) => {
  const session = createJourneySession({ baseUrl, slug });
  const questions = [];
  for (let number = 1; number <= STATEMENTS; number += 1) {
    questions.push(await session.seedQuestion({ type: 'binary', prompt: `Salon statement ${number}: this should be decided together.` }));
  }
  for (let person = 0; person < PEOPLE; person += 1) {
    const wallet = new ethers.Wallet(ethers.utils.id(`salon-person-${person}`));
    const client = session.clientFor(wallet);
    await Promise.all(questions.map(async (question, statement) => {
      const built = buildResponseRecord({
        question: question.record, value: voteOf(person, statement), responder: wallet.address,
        session: { sessionSlug: slug, sessionId: SESSION_ID },
      });
      assert.equal(built.ok, true, JSON.stringify(built));
      await client.upload({ resource: 'responses', data: built.record });
    }));
  }
  return session;
};

const tallyLine = /^Agree: \d+ \/ Unsure: \d+ \/ Disagree: \d+ \/ Responses: \d+$/;
// Every statement's line in the Report, by statement number.
const readReport = async (page) => {
  const block = page.getByTestId('ce-polis-all-questions');
  await block.getByText(tallyLine).first().waitFor({ timeout: 90000 });
  for (let guard = 0; guard < STATEMENTS; guard += 1) {
    const more = block.getByRole('button', { name: /^View more/ });
    if (!(await more.count())) break;
    await more.first().click();
  }
  const lines = (await block.innerText()).split('\n').map((line) => line.trim()).filter(Boolean);
  const report = new Map();
  for (const [index, line] of lines.entries()) {
    const statement = line.match(/Salon statement (\d+):/);
    if (statement && tallyLine.test(lines[index + 1] || '')) report.set(Number(statement[1]), lines[index + 1]);
  }
  return report;
};
const assertReportCountsEveryAnswer = async (page, label) => {
  const report = await readReport(page);
  assert.equal(report.size, STATEMENTS, `${label}: the Report lists every statement`);
  for (let number = 1; number <= STATEMENTS; number += 1) {
    assert.equal(report.get(number), expectedLine(number), `${label}: statement ${number}`);
  }
};
const openReport = async (page) => {
  await page.getByTestId('ce-session-results-toggle').click();
  await page.getByRole('button', { name: 'Report', exact: true }).click();
};
const runSalon = async (engineName) => {
  const session = await seedSalon(`salon-${engineName}`);
  const seeded = session.requests.length;
  session.network.kvDelayMs = KV_MS;
  const browser = await engines[engineName].launch({ headless: true });
  let page;
  try {
    // 1. A member who has answered nothing opens Results on a phone.
    const member = passkeyFixture(`salon-member-${engineName}`);
    const opened = await openPersonContext(browser, session, {
      fixture: member, viewport: PHONES.iphone, contextOptions: { hasTouch: true }, onWorkerRequest: () => REQUEST_MS,
    });
    page = await opened.context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(session.sessionUrl, { waitUntil: 'domcontentloaded' });
    const signedInAt = performance.now();
    await createPasskey(page, member.wallet);
    await openReport(page);
    await assertReportCountsEveryAnswer(page, 'A member');
    const waited = Math.round(performance.now() - signedInAt);
    await assertNoSidewaysScroll(page, 'Results');
    assert.deepEqual(pageErrors, [], 'No page errors while Results loaded');

    // What that load cost. Twenty pages of a hundred answers, read in batches of a hundred. Just after a
    // sign-in the client reads its first few batches before its sign-in is attached and reads them again, so
    // the batch allowance is wider than the page count; lower it when that second read goes.
    const pages = Math.ceil((PEOPLE * STATEMENTS) / PAGE);
    const batches = opened.browserRequests.filter(({ path }) => path === '/storage/read-batch');
    const answerLists = opened.browserRequests.filter(({ path, search }) => path === '/storage/list' && search.includes('resource=responses'));
    assert.ok(batches.length <= pages + 10, `Results read its answers in ${batches.length} batches (at most ${pages + 10})`);
    assert.ok(answerLists.length <= pages + 5, `Results listed its answers in ${answerLists.length} pages (at most ${pages + 5})`);
    assertNoHiddenFaults(session, opened.browserRequests, 'A member\'s Results');
    // Reading must overlap: batches while later pages are still being listed, and items within a batch.
    assert.ok(maxAtOnce(batches) >= 2, `Batches overlap in the browser (most at once: ${maxAtOnce(batches)})`);
    const workerBatches = session.requests.slice(seeded).filter(({ path }) => path === '/storage/read-batch');
    const itemsAtOnce = Math.max(...workerBatches.map(({ kvAtOnce }) => kvAtOnce));
    assert.ok(itemsAtOnce >= 4, `The Worker reads a batch's answers side by side (most at once: ${itemsAtOnce})`);
    const mostOperations = Math.max(...session.requests.slice(seeded).map(({ kvOperations }) => kvOperations));
    assert.ok(mostOperations <= KV_OPERATIONS_PER_REQUEST, 'No Worker request passes Cloudflare\'s storage operation limit');
    console.log(`[${engineName}] A member's Results counted all ${PEOPLE * STATEMENTS} answers: ${answerLists.length} list pages, ${batches.length} batches, ${waited}ms from sign-in with ${REQUEST_MS}ms a request.`);
    await page.screenshot({ path: `${outputDir}/${engineName}-member-results.png` });
    await opened.context.close();

    // 2. One answer batch fails, and keeps failing. The page says so and offers Retry; it does not spin.
    const unlucky = passkeyFixture(`salon-unlucky-${engineName}`);
    const net = { failing: true, batches: 0 };
    const second = await openPersonContext(browser, session, {
      fixture: unlucky, viewport: PHONES.iphone, contextOptions: { hasTouch: true },
      onWorkerRequest: ({ url }) => {
        if (url.pathname === '/storage/read-batch') {
          net.batches += 1;
          if (net.failing && net.batches >= 5) return outage(session);
        }
        return REQUEST_MS;
      },
    });
    page = await second.context.newPage();
    await page.goto(session.sessionUrl, { waitUntil: 'domcontentloaded' });
    await createPasskey(page, unlucky.wallet);
    await openReport(page);
    const failed = page.getByText(/Responses could not be loaded/);
    await failed.waitFor({ timeout: 60000 }).catch(() => assert.fail('A failed answer read left Results without a message'));
    assert.equal(await page.getByTestId('ce-polis-all-questions').count(), 0, 'No partial Report is shown as if it were whole');
    const retry = page.getByRole('button', { name: 'Retry', exact: true });
    await retry.waitFor();
    net.failing = false;
    await retry.click();
    await assertReportCountsEveryAnswer(page, 'After Retry');
    assertNoHiddenFaults(session, second.browserRequests, 'Results through an outage');
    console.log(`[${engineName}] A failed answer read showed a message with Retry, and Retry loaded every answer.`);
    await second.context.close();

    // 3. A visitor who is not signed in is told to log in and is sent no answers.
    const third = await openPersonContext(browser, session, { viewport: PHONES.iphone, contextOptions: { hasTouch: true } });
    page = await third.context.newPage();
    await page.goto(session.sessionUrl, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('ce-session-results-toggle').click();
    await page.getByText(/Log in to see/).first().waitFor();
    assert.equal(await page.getByText(tallyLine).count(), 0, 'A visitor sees no tallies');
    // Requests still under way have no status yet; judge the ones that were answered.
    const refused = third.browserRequests.filter(({ path, search, status }) => status && path === '/storage/list' && search.includes('resource=responses'));
    assert.ok(refused.length > 0 && refused.every(({ status }) => status === 403), 'The Worker refuses a visitor the answer list');
    assertNoHiddenFaults(session, third.browserRequests, 'A visitor\'s Results');
    console.log(`[${engineName}] A signed-out visitor was asked to log in and was sent no answers.`);
  } catch (error) {
    if (page) await page.screenshot({ path: `${outputDir}/${engineName}-failure.png` }).catch(() => {});
    error.message = `[${engineName}] ${error.message}`;
    throw error;
  } finally {
    await browser.close();
  }
};

for (const engineName of engineNames) await runSalon(engineName);
console.log(`Salon-size Results journey passed in ${Math.round(performance.now() - startedAt)}ms (${engineNames.join(', ')}).`);
