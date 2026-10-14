import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export async function inspectSessionSelectorLayout(selector, alignment) {
  const layout = await selector.evaluate((select, alignment) => {
    const group = select.closest('[class*="globalSessionSelector_"]');
    const row = alignment === 'center'
      ? group.closest('[class*="statsHeader_"]')
      : group.closest('[class*="expandedHeaderPrimaryControls_"]') || group.closest('[class*="expandedHeaderRow_"]');
    const rect = group.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const rowStyle = getComputedStyle(row);
    const rowContentRight = rowRect.right - parseFloat(rowStyle.paddingRight) - parseFloat(rowStyle.borderRightWidth);
    const selectRect = select.getBoundingClientRect();
    const link = group.querySelector('a, button').getBoundingClientRect();
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = getComputedStyle(select).font;
    return {
      width: rect.width,
      selectWidth: selectRect.width,
      labelWidth: context.measureText(select.selectedOptions[0].textContent).width,
      alignmentError: alignment === 'center'
        ? Math.abs((rect.left + rect.right - rowRect.left - rowRect.right) / 2)
        : Math.abs(rect.right - rowContentRight),
      fits: rect.left >= rowRect.left - 1 && rect.right <= rowRect.right + 1,
      linkInside: link.left >= rect.left && link.right <= rect.right && link.top >= rect.top && link.bottom <= rect.bottom,
      border: parseFloat(getComputedStyle(group).borderLeftWidth),
    };
  }, alignment);
  assert(layout.fits && layout.linkInside, 'Session label, selector, and link fit inside one unit');
  assert(layout.border > 0, 'Session controls have a shared visible boundary');
  assert(layout.alignmentError < 2, `Session unit is aligned ${alignment}: ${JSON.stringify(layout)}`);
  assert(layout.selectWidth > 24, 'The selected session and native dropdown remain visible');
  assert(layout.selectWidth <= layout.labelWidth + 40, 'Selector width follows the selected label, not the longest option');
  return layout;
}

export async function inspectQuestionsHeader(page) {
  const toolbar = page.getByTestId('ce-survey-toolbar');
  await toolbar.waitFor({ state: 'visible' });
  const layout = await toolbar.evaluate((element) => {
    const row = element.closest('[class*="breadcrumbContainer_"]');
    const primary = row.querySelector('[class*="expandedHeaderPrimaryControls_"]');
    const primaryRect = primary.getBoundingClientRect();
    const columnRect = row.getBoundingClientRect();
    const toolbarRect = element.getBoundingClientRect();
    const toolbarStyle = getComputedStyle(element);
    const controls = Array.from(element.children, (child) => child.getBoundingClientRect());
    const back = primary.querySelector('button').getBoundingClientRect();
    const session = primary.querySelector('select').getBoundingClientRect();
    return {
      width: innerWidth,
      actionsBelow: element.getBoundingClientRect().top >= primaryRect.bottom - 1,
      primaryCenters: [back.top + back.height / 2, session.top + session.height / 2],
      toolbarEdges: [toolbarRect.left, toolbarRect.right],
      columnEdges: [columnRect.left, columnRect.right],
      border: parseFloat(toolbarStyle.borderLeftWidth),
      background: toolbarStyle.backgroundColor,
      controlsInside: controls.every((control) => control.left >= toolbarRect.left && control.right <= toolbarRect.right),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  assert(layout.actionsBelow, 'Question actions sit below Back and Session');
  assert(layout.toolbarEdges.every((edge, index) => Math.abs(edge - layout.columnEdges[index]) < 2),
    `Question toolbar spans the available question column: ${JSON.stringify(layout)}`);
  assert(layout.border > 0 && layout.background !== 'rgba(0, 0, 0, 0)' && layout.background !== 'transparent',
    'Question controls share a visible bordered panel');
  assert(layout.controlsInside && !layout.overflow, 'Question controls fit without horizontal overflow');
  if (layout.width >= 560) {
    assert(Math.abs(layout.primaryCenters[0] - layout.primaryCenters[1]) < 2, 'Back and Session share the top row');
  }
  for (const name of ['View JSON', 'question .json', 'response .json']) {
    assert.equal(await page.getByRole('button', { name, exact: true }).count(), 0, `${name} is hidden in Questions`);
  }
}


async function inspectQuestionsStickyToolbar(page, theme) {
  const toolbar = page.getByTestId('ce-survey-toolbar');
  await page.getByRole('radio', { name: 'Agree', exact: true }).first().waitFor({ state: 'visible' });
  const initial = await toolbar.boundingBox();
  const scrollAndCheck = async (pending) => {
    for (const scrollY of [initial.y + 300, initial.y + 1000]) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), scrollY);
      await page.waitForFunction(() => {
        const rect = document.querySelector('[data-testid="ce-survey-toolbar"]').getBoundingClientRect();
        return Math.abs(rect.top - 10) < 2;
      }, undefined, { timeout: 3000 });
      const bounds = await toolbar.boundingBox();
      assert(Math.abs(bounds.width - initial.width) < 2, 'Sticky toolbar preserves the question column width');
      assert(bounds.height < 853 / 2, 'Wrapped controls leave room for the questions');
      if (pending) assert(await toolbar.getByTestId('ce-survey-submit').isVisible(), 'Pending submit stays visible while scrolling');
    }
    if (pending && theme === 'civic' && page.viewportSize().width === 705) {
      await page.screenshot({ path: '/tmp/questions-sticky-705.png' });
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  };
  await scrollAndCheck(false);
  await page.getByText('Agree', { exact: true }).first().click();
  await toolbar.getByTestId('ce-survey-submit').waitFor({ state: 'visible' });
  await scrollAndCheck(true);
  await page.getByText('Agree', { exact: true }).first().click();
  await toolbar.getByTestId('ce-survey-submit').waitFor({ state: 'hidden' });
}

export async function runSmoke() {
  const { chromium } = await import('playwright');
  const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000';
  const browser = await chromium.launch({ headless: true });
  try {
    for (const theme of ['civic', 'classic-95', 'context-engine']) {
      for (const width of [320, 390, 705, 1280]) {
        console.log(`Checking ${theme} ${width}`);
        const page = await browser.newPage({ viewport: { width, height: 853 } });
        await page.addInitScript((themeId) => {
          localStorage.setItem('ce:theme', themeId);
          localStorage.setItem('ce:theme-default-version', '2026-10-13-civic-v1');
          localStorage.setItem('ce_onboarding_complete', 'true');
          localStorage.setItem('ce:firstVisitRootAboutRedirectConsumed:v20260618b', 'true');
          localStorage.setItem('ce:primarySessionSlug', 'demo-sh');
          localStorage.setItem('ce:selectedSessionScope', 'active');
        }, theme);
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.getByRole('tab', { name: 'Stats', exact: true }).click();
        const stats = page.getByTestId('ce-community-session-select');
        await stats.waitFor({ state: 'visible' });
        await page.evaluate(() => document.fonts.ready);
        for (const label of ['ALL', 'General', 'Demo Session (demo-sh)']) {
          await stats.selectOption({ label });
          await inspectSessionSelectorLayout(stats, 'center');
        }
        await page.getByRole('tab', { name: 'Tools', exact: true }).click();
        for (const tool of ['Questions', 'Groups', 'Context']) {
          await page.getByText(tool, { exact: true }).filter({ visible: true }).click();
          const selector = page.getByTestId('ce-tool-explorer-active-session');
          await selector.waitFor({ state: 'visible' });
          if (tool === 'Questions') {
            await inspectQuestionsHeader(page);
            await inspectQuestionsStickyToolbar(page, theme);
          }
          await inspectSessionSelectorLayout(selector, 'right');
          await selector.selectOption({ label: 'General' });
          await inspectSessionSelectorLayout(selector, 'right');
          await selector.selectOption({ label: 'Demo Session (demo-sh)' });
          await inspectSessionSelectorLayout(selector, 'right');
          await page.getByRole('button', { name: '← Back', exact: true }).click();
        }
        await page.close();
      }
    }
    console.log('Session selector layout smoke passed: 3 themes × 4 widths, Stats and 3 tool views.');
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSmoke().catch((error) => { console.error(error); process.exitCode = 1; });
}
