// Run against a local server with demo surfaces enabled. Answers stay in the
// isolated browser context and are cleared; this smoke never submits responses.
import assert from 'node:assert/strict';
import { inspectSessionSelectorLayout } from './session-selector-layout-smoke.mjs';
import { assertReadable, auditPanelContrast, clickQuestionAction, inspectCivicOverlays } from './civic-theme-overlay-smoke.mjs';
import { inspectCivicExplorerContent } from './civic-theme-explorer-smoke.mjs';
import { inspectCivicWizard } from './civic-theme-wizard-smoke.mjs';
import { inspectCivicAuthoring } from './civic-theme-authoring-smoke.mjs';

export const readControl = (element) => {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return {
    color: style.color,
    background: style.backgroundColor,
    fontSize: style.fontSize,
    headingSize: element.querySelector('h1') ? getComputedStyle(element.querySelector('h1')).fontSize : null,
    opacity: style.opacity,
    width: rect.width,
    height: rect.height,
    top: rect.top,
    bottom: rect.bottom,
  };
};

export async function inspectCivicAbout(page) {
  const hero = page.getByTestId('ce-about-hero');
  await assertReadable(hero);
  const topPadding = await hero.evaluate((element) => {
    const container = element.closest('[class*="aboutPageContainer_"]');
    return element.getBoundingClientRect().top - container.getBoundingClientRect().top;
  });
  assert(topPadding >= 16, 'The About hero has space above it below the navbar');
  await assertReadable(page.locator('body'));
  for (const name of ['Related Work', 'Recognition', 'Roadmap', 'Functionality']) {
    const section = page.getByRole('button', { name, exact: true });
    if ((await section.getAttribute('aria-expanded')) !== 'true') await section.click();
    await assertReadable(page.locator('body'));
  }
}

export async function inspectMinimalPost(page) {
  await page.getByRole('heading', { name: 'Agent Village Wrapped: Does Your Agent Know You? (Experiment + Eval)', exact: true }).waitFor({ state: 'visible' });
  await assertReadable(page.locator('body'));
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await assertReadable(page.locator('body'));
  const point = page.getByRole('button', { name: 'P1: 3/10, 70% confidence', exact: true });
  await point.click();
  await assertReadable(page.getByRole('tooltip'));
  await point.press('Escape');
  await page.getByText('Evaluation protocol, scoring, and record schema', { exact: true }).click();
  await assertReadable(page.locator('body'));
}

export async function inspectMinimalProfile(page) {
  const switcher = page.getByRole('button', { name: 'Show Surveys', exact: true }).first();
  await switcher.waitFor({ state: 'visible' });
  await assertReadable(page.locator('body'));
  await switcher.click();
  await page.getByRole('button', { name: 'Show Questions', exact: true }).first().waitFor({ state: 'visible' });
  await assertReadable(page.locator('body'));
}

export async function inspectCivicWelcome(page) {
  await page.getByRole('tab', { name: 'Tools', exact: true }).click();
  await page.getByRole('tab', { name: 'Welcome', exact: true }).click();
  const pane = page.locator('[class*="onboardingWalkthrough_"]');
  const back = pane.locator('[class*="sidebarOpen_"] > [class*="takeSurveyButton_"]');
  for (let step = 0; step < 5 && (await back.count()) > 0; step += 1) await back.click();
  for (let index = 0; index < 6; index += 1) {
    const artwork = await pane.getByRole('img').evaluate((element) => {
      const style = getComputedStyle(element);
      return { opacity: style.opacity, filter: style.filter, content: style.content, width: element.getBoundingClientRect().width };
    });
    assert.equal(artwork.opacity, '1', 'Welcome artwork is not washed out');
    assert(artwork.width > 0, 'Welcome artwork has visible dimensions');
    if (index === 3) assert(artwork.content.includes('seedsman_civic'), 'Civic uses the transparent robot artwork');
    if ([0, 2, 5].includes(index)) assert(artwork.filter.includes('invert(1)'), 'White artwork is adapted to the light canvas');
    else assert.equal(artwork.filter, 'none', 'Color illustrations retain their original colors');
    const result = await pane.evaluate(auditPanelContrast);
    assert.equal(result.failures.length, 0, `Welcome slide ${index}: ${JSON.stringify(result.failures)}`);
    if (index < 5) await page.locator('[class*="onboardingControls_"] > button').click();
  }
  await page.getByRole('button', { name: 'See Tools', exact: true }).click();
}

export async function inspectCivicExplorer(page) {
  await page.getByRole('tablist').waitFor({ state: 'visible' });
  assert.equal(await page.getByRole('tab', { name: 'Latest', exact: true }).count(), 0);
  assert.equal(await page.getByRole('tablist').getByRole('tab').count(), 3);
  for (const name of ['Stats', 'Tools', 'Welcome']) {
    const tab = page.getByRole('tab', { name, exact: true });
    await tab.click();
    assert.equal(await tab.getAttribute('aria-selected'), 'true');
    const contrastResult = await page.getByRole('tablist').evaluate(auditPanelContrast);
    assert(contrastResult.checked > 0, 'Selected Explorer tab has a visible label');
    assert.equal(
      contrastResult.failures.length,
      0,
      `Explorer tab contrast: ${JSON.stringify(contrastResult.failures)}`,
    );
  }
  await page.getByRole('tab', { name: 'Tools', exact: true }).click();
}

export async function inspectCivicStats(page) {
  await page.getByRole('tab', { name: 'Stats', exact: true }).click();
  const stats = page.locator('[class*="communityTab_"]');
  await inspectStatsCounters(page);
  await assertReadable(stats);
  let profilePath = null;
  let reportHref = null;
  for (const name of ['Users', 'Questions', 'Surveys', 'Groups']) {
    await stats.getByTestId(`ce-community-stat-${name.toLowerCase()}`).click();
    const dialog = page.getByRole('dialog');
    await assertReadable(dialog);
    if (name === 'Questions') {
      const table = dialog.getByTestId('ce-community-questions-table');
      await table.waitFor({ state: 'visible' });
      assert.deepEqual(await table.getByRole('columnheader').allTextContents(), ['Session', 'Question']);
      reportHref = await table.getByRole('link').first().getAttribute('href');
      assert(reportHref?.endsWith('#report'), 'Question links target their session report');
      await dialog.getByTestId('ce-community-questions-session-link').waitFor({ state: 'visible' });
    }
    if (name === 'Users') {
      const usersSelector = dialog.getByTestId('ce-community-users-session-select');
      await usersSelector.waitFor({ state: 'visible' });
      const previousSelection = await usersSelector.inputValue();
      await usersSelector.selectOption('');
      await page.waitForFunction(() => document.querySelector('[data-testid="ce-community-session-select"]')?.value === '');
      await usersSelector.selectOption(previousSelection);
      await page.waitForFunction((value) => document.querySelector('[data-testid="ce-community-session-select"]')?.value === value, previousSelection);
      const [profilePage] = await Promise.all([
        page.waitForEvent('popup'),
        dialog.locator('[class*="userItem_"]').first().click(),
      ]);
      try {
        await profilePage.waitForURL(/\/u\//);
        const profileUrl = new URL(profilePage.url());
        profilePath = `${profileUrl.pathname}${profileUrl.search}`;
      } finally {
        await profilePage.close();
      }
      await dialog.getByRole('button', { name: 'Filter', exact: true }).click();
      await assertReadable(dialog);
      await dialog.getByRole('button', { name: 'Select Group...', exact: true }).first().click();
      await assertReadable(dialog);
    }
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
  }
  await inspectSessionDirectory(page);
  assert(reportHref, 'Questions Details exposes a report link');
  const reportPage = await page.context().newPage();
  try {
    await reportPage.goto(new URL(reportHref, page.url()).href, { waitUntil: 'domcontentloaded' });
    const report = reportPage.locator('#report');
    await report.waitFor({ state: 'visible' });
    await report.getByRole('button', { name: 'Report', exact: true }).waitFor({ state: 'visible' });
    assert.equal(await report.getByRole('button', { name: 'Report', exact: true }).getAttribute('aria-pressed'), 'true');
    await reportPage.waitForFunction(() => {
      const rect = document.getElementById('report')?.getBoundingClientRect();
      return rect && rect.top >= -2 && rect.top < innerHeight;
    });
  } finally {
    await reportPage.close();
  }
  return profilePath;
}

export async function inspectStatsCounters(page) {
  const selector = page.getByTestId('ce-community-session-select');
  await selector.waitFor({ state: 'visible' });
  await selector.selectOption({ label: 'General' });
  await inspectSessionSelectorLayout(selector, 'center');
  const sessionLink = page.getByTestId('ce-community-session-select-link');
  assert.equal(await sessionLink.getAttribute('target'), '_blank', 'A concrete session opens in a new tab');
  assert(new URL(await sessionLink.getAttribute('href'), page.url()).pathname.endsWith('/session'), 'General links to its session page');
  assert.equal(await page.getByTestId('ce-community-stat-sessions').count(), 0, 'Specific session scope hides the Sessions total');
  await selector.selectOption({ label: 'ALL' });
  assert.equal(await sessionLink.isDisabled(), true, 'Aggregate scope has no single-session destination');
  for (const name of ['users', 'questions', 'surveys', 'groups', 'sessions']) {
    await page.getByTestId(`ce-community-stat-${name}`).waitFor({ state: 'visible' });
  }
  for (const id of [
    'ce-community-session-section',
    'ce-community-session-scope',
    'ce-community-beeswarm-section',
    'ce-community-leaderboard-section',
  ]) {
    assert.equal(await page.getByTestId(id).count(), 0, `${id} is hidden from Stats`);
  }
}

export async function inspectSessionDirectory(page, { checkContrast = true } = {}) {
  const tile = page.getByTestId('ce-community-stat-sessions');
  const total = Number(await tile.getAttribute('data-ce-count'));
  assert(Number.isInteger(total) && total >= 0, 'Sessions tile shows a count');
  await tile.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('heading', { name: 'Sessions Details', exact: true }).waitFor({ state: 'visible' });
  if (checkContrast) await assertReadable(dialog);
  const centralized = Number(await dialog.getByTestId('ce-community-sessions-centralized').innerText());
  const decentralized = Number(await dialog.getByTestId('ce-community-sessions-decentralized').innerText());
  assert(centralized + decentralized <= total, 'Known authority totals fit the discovered session count');
  if (total) {
    const list = dialog.getByRole('region', { name: 'Session list', exact: true });
    assert.equal(await list.getByRole('link').count(), total, 'Each counted session has a directory link');
    const geometry = await list.evaluate((element) => ({
      height: element.clientHeight,
      contentHeight: element.scrollHeight,
      overflow: getComputedStyle(element).overflowY,
    }));
    assert.equal(geometry.overflow, 'auto', 'Session list supports scrolling');
    assert(geometry.height > 0 && geometry.height <= 400, 'Session list fits the dialog');
    if (geometry.contentHeight > geometry.height) {
      await list.getByRole('link').last().press('Shift+Tab');
      const scrollTop = await list.evaluate((element) => element.scrollTop);
      assert(scrollTop > 0, 'Keyboard focus can reach entries beyond the first page');
      await list.getByRole('link').first().press('Shift+Tab');
    }
  } else {
    assert(await dialog.getByText('No sessions discovered yet.', { exact: true }).isVisible());
  }
  await inspectSessionDirectoryFilters(dialog, { total, centralized, decentralized, checkContrast });
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
}

export async function inspectSessionDirectoryFilters(dialog, { total, centralized, decentralized, checkContrast = true }) {
  const toggle = dialog.getByRole('button', { name: 'Session filters', exact: true });
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(await dialog.getByText('Sessions discovered by this app.', { exact: true }).count(), 0);
  if (checkContrast) await assertReadable(dialog);
  const rows = () => dialog.getByRole('link').count();
  for (const [kind, expected] of [['centralized', centralized], ['decentralized', decentralized]]) {
    await dialog.getByRole('combobox', { name: 'Session type', exact: true }).selectOption(kind);
    assert.equal(await rows(), expected, `${kind} filter matches its count`);
  }
  await dialog.getByRole('button', { name: 'Clear filters', exact: true }).click();
  for (const name of ['Date created from', 'Last activity from']) {
    await dialog.getByRole('textbox', { name, exact: true }).fill('2099-01-01');
    await dialog.getByRole('textbox', { name, exact: true }).press('ArrowLeft');
    await dialog.getByRole('textbox', { name, exact: true }).press('ArrowLeft');
    await dialog.getByRole('textbox', { name, exact: true }).press('ArrowUp');
    // Older dated sessions drop out; undated (Worker) sessions stay and say so.
    const remaining = await rows();
    for (let index = 0; index < remaining; index += 1) {
      const text = await dialog.getByRole('link').nth(index).innerText();
      assert.match(text, /date unavailable/, `${name} keeps only undated sessions`);
    }
    if (!remaining) assert(await dialog.getByText('No sessions match these filters.', { exact: true }).isVisible());
    await dialog.getByRole('button', { name: 'Clear filters', exact: true }).click();
  }
  await dialog.getByRole('searchbox', { name: 'Admin address', exact: true }).fill('unmatched-admin');
  assert.equal(await rows(), 0, 'Admin address filter excludes nonmatching sessions');
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-pressed'), null, 'The filter toggle is a disclosure button');
  const panel = dialog.locator(`#${await toggle.getAttribute('aria-controls')}`);
  assert.equal(await panel.count(), 1, 'Collapsed filters stay mounted for aria-controls');
  assert.equal(await panel.isVisible(), false, 'Collapsed filters are hidden');
  const summaryId = await toggle.getAttribute('aria-describedby');
  assert(summaryId, 'The collapsed toggle is described by the filtered summary');
  assert.match(await dialog.locator(`#${summaryId}`).innerText(), /^Filtered: /, 'The summary says filters are active');
  await toggle.click();
  await dialog.getByRole('button', { name: 'Clear filters', exact: true }).click();
  assert.equal(await rows(), total, 'Clear filters restores every session');
  await toggle.click();
}

// Exercise the rendered cascade: a theme override previously disabled this animation.
export async function inspectCivicTitleFade(page, titleName = 'Living With Artificial Minds') {
  const title = page.getByRole('heading', { name: titleName, exact: true });
  const readTitle = (element) => {
    const container = element.parentElement;
    const style = getComputedStyle(container);
    return { opacity: Number(style.opacity), animation: style.animationName, delay: style.animationDelay };
  };
  await title.waitFor({ state: 'visible' });
  const initial = await title.evaluate(readTitle);
  assert.notEqual(initial.animation, 'none', 'Civic retains the shared title fade');
  assert.equal(initial.delay, '5s');
  let faded;
  for (let attempt = 0; attempt < 35; attempt += 1) {
    faded = await title.evaluate(readTitle);
    if (faded.opacity === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.equal(faded.opacity, 0, 'Session title disappears after the delay');
  // Clicking the non-interactive container moves the pointer into its retained hover target.
  await page.locator('[class*="titleContainer_"]').click();
  const revealed = await title.evaluate(readTitle);
  assert.equal(revealed.opacity, 1, 'Pointer interaction reveals the title');
  assert.equal(revealed.animation, 'none');
}

export async function inspectSectionSubtitles(page, { captureGroups } = {}) {
  for (const testId of ['ce-session-groups-toggle', 'ce-demo-documents-toggle', 'ce-session-results-toggle']) {
    const header = page.getByTestId(testId);
    if (!(await header.isVisible())) continue;
    const title = header.locator('[class*="sectionHeaderTitle_"]');
    const subtitle = header.locator('[class*="sectionHeaderSubtitle_"]');
    if (!(await subtitle.isVisible())) await title.click();
    await subtitle.waitFor({ state: 'visible' });
    await title.click();
    await subtitle.waitFor({ state: 'hidden' });
    assert.equal(await subtitle.count(), 0, 'Expanded sections omit the subtitle');
    if (testId === 'ce-session-groups-toggle' && captureGroups) await captureGroups();
    await title.click();
    await subtitle.waitFor({ state: 'visible' });
  }
}

export async function inspectMobileSessionSpacing(page) {
  if ((await page.evaluate(() => innerWidth)) > 767) return null;
  const report = page.getByTestId('ce-polis-report-root');
  await report.waitFor({ state: 'visible' });
  const geometry = await report.evaluate((element) => {
    const section = element.closest('[class*="sectionContainer_"]');
    const controls = section.querySelector('[class*="resultsModeActions_"]');
    const buttons = [...controls.querySelectorAll('button')];
    const rect = element.getBoundingClientRect();
    return {
      viewport: innerWidth,
      width: rect.width,
      gapAfterControls: rect.top - controls.getBoundingClientRect().bottom,
      smallestControlHeight: Math.min(...buttons.map((button) => button.getBoundingClientRect().height)),
      pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  assert(geometry.width >= geometry.viewport * 0.84, 'The mobile report uses at least 84% of the viewport width');
  assert(geometry.gapAfterControls <= 16, 'The report sits close to the results controls');
  assert(geometry.smallestControlHeight >= 44, 'Results controls keep usable touch targets');
  assert.equal(geometry.pageOverflow, false, 'Nested content does not overflow the page');
  return geometry;
}

export async function inspectCivicSession(page) {
  const login = page.getByRole('button', { name: 'LOG IN', exact: true });
  await login.waitFor({ state: 'visible' });
  await inspectSectionSubtitles(page);
  const civicLogin = await login.evaluate(readControl);
  await inspectCivicTitleFade(page);
  const title = page.getByRole('heading', { name: 'Living With Artificial Minds', exact: true });
  const titleGeometry = await title.evaluate((element) => {
    const rect = element.parentElement.getBoundingClientRect();
    return { center: rect.x + rect.width / 2, viewport: innerWidth };
  });
  assert(Math.abs(titleGeometry.center - titleGeometry.viewport / 2) < 20, 'Session title stays centered');

  await page.getByRole('radio', { name: 'Agree', exact: true }).check();
  const clear = page.getByRole('button', { name: 'Clear pending changes', exact: true });
  await clear.waitFor({ state: 'visible' });
  const clearStyle = await clear.evaluate(readControl);
  await assertReadable(clear);
  assert.equal(clearStyle.opacity, '1', 'Clear control is not faded');
  const submit = await page.getByRole('button', { name: 'Submit (1)', exact: true }).evaluate(readControl);
  const titleBox = await title.evaluate(readControl);
  assert(submit.top >= titleBox.bottom, 'Submit does not overlap the session title');
  await clear.click();
  await clear.waitFor({ state: 'hidden' });

  await clickQuestionAction(page, 'View All Questions');
  await page.getByRole('radio', { name: 'Agree', exact: true }).first().check();
  const fullClear = page.getByRole('button', { name: 'Clear pending changes', exact: true });
  await fullClear.waitFor({ state: 'visible' });
  const fullClearStyle = await fullClear.evaluate(readControl);
  assert.equal(fullClearStyle.opacity, '1', 'Full-view clear control is not faded');
  await assertReadable(fullClear);
  await fullClear.click();
  await assertReadable(page.locator('body'));
  const option = page.getByText('An elected legislature', { exact: true });
  await option.waitFor({ state: 'visible' });
  const choiceLabel = option.locator('xpath=ancestor::label[1]');
  for (const selected of [false, true]) {
    if (selected) await option.click();
    assert.equal(await choiceLabel.evaluate((label) => label.querySelector('input').checked), selected);
    // Multi-choice labels remain readable in both states.
    await assertReadable(choiceLabel);
  }
  await option.click();
  await page.getByRole('button', { name: 'Back to pile view', exact: true }).click();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');

  await page.getByTestId('ce-session-results-toggle').click();
  await page.getByRole('heading', { name: 'Summary and Statistics', exact: true }).waitFor({ state: 'visible' });
  await inspectMobileSessionSpacing(page);
  const description = page.getByText(/^Preview of a new public demo in which sixty-two historical figures/);
  const reportStyle = await description.evaluate(readControl);
  assert.equal(reportStyle.opacity, '1');
  await assertReadable(description);
  return civicLogin;
}

export async function runSmoke() {
  const { chromium } = await import('playwright');
  const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport });
      await page.addInitScript(() => {
        if (!localStorage.getItem('ce:theme')) localStorage.setItem('ce:theme', 'civic');
        localStorage.setItem('ce_onboarding_complete', 'true');
        localStorage.setItem('ce:firstVisitRootAboutRedirectConsumed:v20260618b', 'true');
      });
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await inspectCivicExplorer(page);
      const profilePath = await inspectCivicStats(page);
      assert(profilePath, 'The Users detail modal links to a public profile');
      await page.goto(`${baseUrl}${profilePath}`, { waitUntil: 'domcontentloaded' });
      await inspectMinimalProfile(page);
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await inspectCivicWelcome(page);
      await inspectCivicExplorerContent(page);
      await page.goto(`${baseUrl}/about`, { waitUntil: 'domcontentloaded' });
      await inspectCivicAbout(page);
      await page.goto(`${baseUrl}/posts/agent-village-wrapped-2026`, { waitUntil: 'domcontentloaded' });
      await inspectMinimalPost(page);
      await page.goto(`${baseUrl}/session/new`, { waitUntil: 'domcontentloaded' });
      await inspectCivicWizard(page);
      await page.goto(`${baseUrl}/session/demo-2`, { waitUntil: 'domcontentloaded' });
      const civic = await inspectCivicSession(page);
      await inspectCivicOverlays(page);
      await inspectCivicAuthoring(page);
      await page.evaluate(() => localStorage.setItem('ce:theme', 'context-engine'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      const login = page.getByRole('button', { name: 'LOG IN', exact: true });
      await login.waitFor({ state: 'visible' });
      const original = await login.evaluate(readControl);
      for (const property of ['width', 'height', 'fontSize', 'headingSize']) {
        assert.equal(civic[property], original[property], `Login ${property} matches the existing theme`);
      }
      await page.close();
    }
    console.log('Civic theme smoke passed at desktop and mobile sizes.');
  } finally {
    await browser.close();
  }
}
