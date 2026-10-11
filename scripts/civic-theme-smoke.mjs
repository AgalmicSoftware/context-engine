// Run against a local server with demo surfaces enabled. Answers stay in the
// isolated browser context and are cleared; this smoke never submits responses.
import assert from 'node:assert/strict';
import { assertReadable, auditPanelContrast, clickQuestionAction, inspectCivicOverlays } from './civic-theme-overlay-smoke.mjs';
import { inspectCivicExplorerContent } from './civic-theme-explorer-smoke.mjs';
import { inspectCivicWizard } from './civic-theme-wizard-smoke.mjs';
import { inspectCivicAuthoring } from './civic-theme-authoring-smoke.mjs';

const contrast = (foreground, background) => {
  const luminance = (color) => {
    const channels = color
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

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
  await inspectStatsSessionLabels(page);
  await assertReadable(stats);
  const more = stats.getByRole('button', { name: /^Show More/ });
  if (await more.isVisible()) {
    await more.click();
    await assertReadable(stats);
    await stats.getByRole('button', { name: /^Show Less/ }).press('Enter');
  }
  const filters = stats.getByRole('button', { name: 'Leaderboard filters', exact: true });
  await filters.click();
  await assertReadable(stats);
  await filters.click();
  for (const name of ['Users', 'Questions', 'Surveys', 'Groups']) {
    await stats.getByText(name, { exact: true }).click();
    const dialog = page.getByRole('dialog');
    await assertReadable(dialog);
    if (name === 'Users') {
      await dialog.getByRole('button', { name: 'Filter', exact: true }).click();
      await assertReadable(dialog);
      await dialog.getByRole('button', { name: 'Select Group...', exact: true }).first().click();
      await assertReadable(dialog);
    }
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
  }
  await inspectSessionDirectory(page);
}

export async function inspectStatsSessionLabels(page) {
  const section = page.getByTestId('ce-community-session-section');
  const label = section.getByTestId('ce-community-session-scope');
  await label.waitFor({ state: 'visible' });
  assert(await label.isVisible(), 'One shared session label is visible above the chart and leaderboard');
  assert.match((await label.innerText()).trim(), /^(?:Demo session: .+|Sessions?: .+|All sessions)$/);
  await assertReadable(label);
  const labelBottom = await label.evaluate((element) => element.getBoundingClientRect().bottom);
  for (const id of ['ce-community-beeswarm-section', 'ce-community-leaderboard-section']) {
    const child = section.getByTestId(id);
    assert.equal(await child.count(), 1, `${id} belongs to the shared session section`);
    const top = await child.evaluate((element) => element.getBoundingClientRect().top);
    assert(top >= labelBottom - 1, `${id} appears below the shared session label`);
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
    assert.equal(await rows(), 0, `${name} excludes older and unknown dates`);
    assert(await dialog.getByText('No sessions match these filters.', { exact: true }).isVisible());
    await dialog.getByRole('button', { name: 'Clear filters', exact: true }).click();
  }
  await dialog.getByRole('searchbox', { name: 'Admin address', exact: true }).fill('unmatched-admin');
  assert.equal(await rows(), 0, 'Admin address filter excludes nonmatching sessions');
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-pressed'), 'true', 'Collapsed header indicates active filters');
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
  assert(contrast(clearStyle.color, 'rgb(255, 255, 255)') >= 4.5, 'Clear control is legible on white');
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
  assert(contrast(fullClearStyle.color, 'rgb(255, 255, 255)') >= 4.5, 'Full-view clear control is visible');
  await fullClear.click();
  await assertReadable(page.locator('body'));
  const option = page.getByText('An elected legislature', { exact: true });
  await option.waitFor({ state: 'visible' });
  const choiceStyle = () =>
    option.evaluate((element) => {
      const label = element.closest('label');
      const style = getComputedStyle(label);
      return { color: style.color, background: style.backgroundColor, checked: label.querySelector('input').checked };
    });
  for (const selected of [false, true]) {
    if (selected) await option.click();
    const style = await choiceStyle();
    assert.equal(style.checked, selected);
    assert(contrast(style.color, style.background) >= 4.5, 'Multi-choice labels remain readable in both states');
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
  assert(contrast(reportStyle.color, 'rgb(255, 255, 255)') >= 4.5, 'Report description remains readable');
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
      await inspectCivicStats(page);
      const profilePath = await page.locator('a[href^="/u/"]').first().getAttribute('href');
      assert(profilePath, 'The demo leaderboard links to a public profile');
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
