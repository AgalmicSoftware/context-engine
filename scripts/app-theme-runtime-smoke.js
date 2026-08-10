'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { normalizeBaseUrl } = require('./vite-navigation-smoke');

const ROUTE_CASES = Object.freeze([
  {
    path: '/',
    label: 'home welcome and login surfaces',
    requiresFramelessWelcome: true,
    requiresReadableLogin: true,
  },
  { path: '/', label: 'home Community Stats surface', requiresReadableStats: true },
  { path: '/about', label: 'about lazy route', requiresBrightLogo: true },
  { path: '/session/new', label: 'Session Wizard', requiresSessionColors: true },
  { path: '/docs', label: 'docs lazy route', requiresReadableDocs: true },
  { path: '/demos', label: 'demo surface' },
  { path: '/theme-smoke-not-found', label: 'not-found state' },
]);

const VIEWPORTS = Object.freeze([
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]);

const readThemeState = () => {
  const root = document.documentElement;
  const style = window.getComputedStyle(root);
  const probe = document.createElement('div');
  probe.className = 'modal-content';
  probe.style.position = 'fixed';
  probe.style.left = '-10000px';
  probe.textContent = 'theme probe';
  document.body.appendChild(probe);
  const probeStyle = window.getComputedStyle(probe);
  const state = {
    themeId: root.dataset.ceTheme || '',
    themeSource: root.dataset.ceThemeSource || '',
    canvas: style.getPropertyValue('--ce-canvas').trim().toLowerCase(),
    radius4: style.getPropertyValue('--ce-radius-4').trim(),
    fontBody: style.getPropertyValue('--ce-font-body').trim().toLowerCase(),
    modalBackground: probeStyle.backgroundColor,
    modalRadius: probeStyle.borderRadius,
  };
  probe.remove();
  return state;
};

async function inspectRoute(page, baseUrl, routeCase, viewportName) {
  const response = await page.goto(`${baseUrl}${routeCase.path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForSelector('#root', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 15000 });

  if (routeCase.requiresSessionColors) {
    await page.getByTestId('ce-new-preset-fast_cheap_cloudflare').click();
    await page.waitForSelector('[data-testid="ce-wizard-session-color-scheme"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="ce-wizard-session-color-preview"]', { timeout: 15000 });
  }

  if (routeCase.requiresReadableDocs) {
    await page.getByRole('button', { name: 'Prompts', exact: true }).click();
    const firstPrompt = page.locator('#docs-section-prompts [role="button"][aria-controls^="prompt-"]').first();
    await firstPrompt.click();
    await page.locator('[data-testid^="ce-contract-viewer-card-"]').first().click();
    await page.locator('[data-testid^="ce-contract-viewer-source-"]').first().waitFor({ state: 'visible' });
  }

  if (routeCase.requiresFramelessWelcome) {
    await page.waitForFunction(() => document.querySelectorAll('.nav-tabs .nav-link').length >= 4, null, {
      timeout: 15000,
    });
    await page.locator('.nav-tabs .nav-link').nth(3).click();
    await page.getByTestId('ce-welcome-slide-media').waitFor({ state: 'visible' });
  }

  if (routeCase.requiresReadableLogin) {
    await page.getByRole('button', { name: 'LOG IN', exact: true }).click();
    await page.getByText('Account uses a passkey:', { exact: true }).waitFor({ state: 'visible' });
  }

  if (routeCase.requiresReadableStats) {
    await page.waitForFunction(() => document.querySelectorAll('.nav-tabs .nav-link').length >= 4, null, {
      timeout: 15000,
    });
    await page.locator('.nav-tabs .nav-link').nth(1).click();
    await page.getByTestId('ce-community-beeswarm-section').waitFor({ state: 'visible' });
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid^="ce-beeswarm-point-"]').length >= 20,
      null,
      { timeout: 15000 },
    );
    await page.getByTestId('ce-beeswarm-point-0').hover();
    await page.getByTestId('ce-beeswarm-tooltip').waitFor({ state: 'visible' });
  }

  const classic = await page.evaluate(readThemeState);
  const routeState = await page.evaluate(() => {
    const root = document.querySelector('#root');
    const preview = document.querySelector('[data-testid="ce-wizard-session-color-preview"]');
    const rootRect = root?.getBoundingClientRect();
    const overflow = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const overflowElements = Array.from(document.querySelectorAll('body *'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${
            typeof element.className === 'string' && element.className
              ? `.${element.className.trim().split(/\s+/).slice(0, 2).join('.')}`
              : ''
          }`,
          overflow: Math.max(0, rect.right - document.documentElement.clientWidth),
        };
      })
      .filter((entry) => entry.overflow > 4)
      .sort((left, right) => right.overflow - left.overflow)
      .slice(0, 3);
    return {
      rootWidth: rootRect?.width || 0,
      overflow,
      overflowElements,
      sessionPreviewAccent: preview
        ? window.getComputedStyle(preview).getPropertyValue('--ce-session-accent').trim()
        : '',
    };
  });
  const docsContrastState = routeCase.requiresReadableDocs
    ? await page.evaluate(() => {
        const parseRgb = (value) => {
          const channels =
            String(value || '')
              .match(/[\d.]+/g)
              ?.map(Number) || [];
          if (channels.length < 3) throw new Error(`Unsupported computed color: ${value}`);
          return channels.slice(0, 3).map((channel) => channel / 255);
        };
        const luminance = (value) => {
          const channels = parseRgb(value).map((channel) =>
            channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4),
          );
          return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
        };
        const sample = (label, foregroundSelector, backgroundSelector = foregroundSelector) => {
          const foreground = document.querySelector(foregroundSelector);
          const background = document.querySelector(backgroundSelector);
          if (!foreground || !background) return { label, missing: true, ratio: 0 };
          const foregroundColor = window.getComputedStyle(foreground).color;
          const backgroundColor = window.getComputedStyle(background).backgroundColor;
          const foregroundLuminance = luminance(foregroundColor);
          const backgroundLuminance = luminance(backgroundColor);
          return {
            label,
            foregroundColor,
            backgroundColor,
            ratio:
              (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
              (Math.min(foregroundLuminance, backgroundLuminance) + 0.05),
          };
        };

        return [
          sample(
            'Docs title',
            '[data-testid="ce-page-docs-root"] > header h1',
            '[data-testid="ce-page-docs-root"] > header',
          ),
          sample(
            'Docs introduction',
            '[data-testid="ce-page-docs-root"] > header p',
            '[data-testid="ce-page-docs-root"] > header',
          ),
          sample('Quickstart title bar', 'button[aria-controls="docs-section-quickstart"]'),
          sample(
            'Quickstart card title',
            '#docs-section-quickstart li:first-child h2',
            '#docs-section-quickstart li:first-child',
          ),
          sample(
            'Quickstart card copy',
            '#docs-section-quickstart li:first-child p',
            '#docs-section-quickstart li:first-child',
          ),
          sample('Contracts title bar', '[data-testid="ce-contract-viewer-toggle"]'),
          sample('Contract card', '[data-testid^="ce-contract-viewer-card-"]'),
          sample('Contract source title bar', '[data-testid^="ce-contract-viewer-source-"] > div:first-child'),
          sample('Contract source code', '[data-testid^="ce-contract-viewer-source-"] pre'),
          sample(
            'Prompt title bar',
            '#docs-section-prompts [role="button"][aria-controls^="prompt-"] > div:first-child',
            '#docs-section-prompts [role="button"][aria-controls^="prompt-"]',
          ),
          sample('Prompt body', '#docs-section-prompts pre'),
        ];
      })
    : [];
  const welcomeFrameState = routeCase.requiresFramelessWelcome
    ? await page.getByTestId('ce-welcome-slide-media').evaluate((element) => {
        const style = window.getComputedStyle(element);
        return {
          appearance: style.appearance,
          borderBottomWidth: style.borderBottomWidth,
          borderLeftWidth: style.borderLeftWidth,
          borderRightWidth: style.borderRightWidth,
          borderTopWidth: style.borderTopWidth,
          boxShadow: style.boxShadow,
        };
      })
    : null;
  const loginContrastState = routeCase.requiresReadableLogin
    ? await page.evaluate(() => {
        const parseRgb = (value) => {
          const channels =
            String(value || '')
              .match(/[\d.]+/g)
              ?.map(Number) || [];
          if (channels.length < 3) throw new Error(`Unsupported computed color: ${value}`);
          return channels.slice(0, 3).map((channel) => channel / 255);
        };
        const luminance = (value) => {
          const channels = parseRgb(value).map((channel) =>
            channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4),
          );
          return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
        };
        const ratio = (foregroundColor, backgroundColor) => {
          const foregroundLuminance = luminance(foregroundColor);
          const backgroundLuminance = luminance(backgroundColor);
          return (
            (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
            (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
          );
        };
        const modal = document.querySelector('.modal-login');
        const content = modal?.querySelector('.modal-content');
        const card = modal?.querySelector('.card');
        const header = modal?.querySelector('.card-header');
        const title = header?.querySelector('div');
        const paragraph = Array.from(modal?.querySelectorAll('p') || []).find(
          (element) => element.textContent?.trim() === 'Account uses a passkey:',
        );
        const message = paragraph?.parentElement;
        const listItem = message?.querySelector('li');
        const createButton = modal?.querySelector('[data-testid="ce-passkey-wallet-create"]');
        if (!content || !card || !header || !title || !paragraph || !message || !listItem || !createButton) {
          return { missing: true };
        }
        const headerStyle = window.getComputedStyle(header);
        const titleStyle = window.getComputedStyle(title);
        const messageStyle = window.getComputedStyle(message);
        const paragraphStyle = window.getComputedStyle(paragraph);
        const listItemStyle = window.getComputedStyle(listItem);
        const createButtonStyle = window.getComputedStyle(createButton);
        return {
          cardTopGap: card.getBoundingClientRect().top - content.getBoundingClientRect().top,
          messageBackground: messageStyle.backgroundColor,
          titleRatio: ratio(titleStyle.color, headerStyle.backgroundColor),
          paragraphRatio: ratio(paragraphStyle.color, messageStyle.backgroundColor),
          listItemRatio: ratio(listItemStyle.color, messageStyle.backgroundColor),
          createButtonRatio: ratio(createButtonStyle.color, createButtonStyle.backgroundColor),
        };
      })
    : null;
  const statsContrastState = routeCase.requiresReadableStats
    ? await page.evaluate(() => {
        const parseRgb = (value) => {
          const channels =
            String(value || '')
              .match(/[\d.]+/g)
              ?.map(Number) || [];
          if (channels.length < 3) throw new Error(`Unsupported computed color: ${value}`);
          return channels.slice(0, 3).map((channel) => channel / 255);
        };
        const luminance = (value) => {
          const channels = parseRgb(value).map((channel) =>
            channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4),
          );
          return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
        };
        const ratio = (foregroundColor, backgroundColor) => {
          const foregroundLuminance = luminance(foregroundColor);
          const backgroundLuminance = luminance(backgroundColor);
          return (
            (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
            (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
          );
        };
        const backgroundFor = (element) => {
          let current = element;
          while (current) {
            const background = window.getComputedStyle(current).backgroundColor;
            const channels =
              String(background || '')
                .match(/[\d.]+/g)
                ?.map(Number) || [];
            if (channels.length >= 3 && (channels.length < 4 || channels[3] > 0)) return background;
            current = current.parentElement;
          }
          return window.getComputedStyle(document.documentElement).backgroundColor;
        };
        const textRatio = (selector, colorProperty = 'color') => {
          const element = document.querySelector(selector);
          if (!element) return 0;
          const style = window.getComputedStyle(element);
          return ratio(style[colorProperty], backgroundFor(element));
        };
        const points = Array.from(document.querySelectorAll('[data-testid^="ce-beeswarm-point-"]'));
        const pointXs = points.map((point) => Number(point.getAttribute('cx'))).filter(Number.isFinite);
        const firstPointStyle = points[0] ? window.getComputedStyle(points[0]) : null;
        const svg = document.querySelector('[data-testid="ce-community-beeswarm-section"] svg');
        const tooltip = document.querySelector('[data-testid="ce-beeswarm-tooltip"]');
        const tooltipText = tooltip?.textContent || '';
        return {
          pointCount: points.length,
          pointSpread: pointXs.length ? Math.max(...pointXs) - Math.min(...pointXs) : 0,
          hasCountedVotes: /Counted\s+[1-9]\d*/i.test(tooltipText),
          statIconRatio: textRatio('[class*="statIcon"]'),
          statCountRatio: textRatio('[class*="statCount"]'),
          statLabelRatio: textRatio('[class*="statLabel"]'),
          leaderboardRatio: textRatio('[class*="leaderboardItem"]'),
          axisLabelRatio: textRatio('[data-testid="ce-community-beeswarm-section"] text', 'fill'),
          pointRatio:
            firstPointStyle && svg ? ratio(firstPointStyle.fill, window.getComputedStyle(svg).backgroundColor) : 0,
          tooltipPromptRatio: textRatio('[data-testid="ce-beeswarm-tooltip"] p'),
          tooltipAgreeRatio: textRatio('[data-testid="ce-beeswarm-tooltip-agree"]'),
          tooltipUnsureRatio: textRatio('[data-testid="ce-beeswarm-tooltip-unsure"]'),
          tooltipDisagreeRatio: textRatio('[data-testid="ce-beeswarm-tooltip-disagree"]'),
          tooltipTotalRatio: textRatio('[data-testid="ce-beeswarm-tooltip-total"]'),
        };
      })
    : null;
  const classicLogoState = routeCase.requiresBrightLogo
    ? await page
        .getByRole('link', { name: 'Context Engine home', exact: true })
        .locator('img')
        .evaluate((element) => {
          const style = window.getComputedStyle(element);
          return {
            filter: style.filter,
            mixBlendMode: style.mixBlendMode,
            opacity: style.opacity,
          };
        })
    : null;

  await page.evaluate(() => {
    document.documentElement.dataset.ceTheme = 'context-engine';
    window.dispatchEvent(new CustomEvent('ce:theme-change', { detail: { id: 'context-engine', source: 'user' } }));
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const current = await page.evaluate(readThemeState);
  const currentLogoState = routeCase.requiresBrightLogo
    ? await page
        .getByRole('link', { name: 'Context Engine home', exact: true })
        .locator('img')
        .evaluate((element) => {
          const style = window.getComputedStyle(element);
          return {
            filter: style.filter,
            mixBlendMode: style.mixBlendMode,
            opacity: style.opacity,
          };
        })
    : null;

  assert.equal(response?.status(), 200, `${routeCase.label} should load in ${viewportName}`);
  assert.equal(classic.themeId, 'classic-95', `${routeCase.label} should bootstrap the stored theme`);
  assert.equal(classic.themeSource, 'user', `${routeCase.label} should preserve user-theme precedence`);
  assert.equal(classic.canvas, '#008080', `${routeCase.label} should receive the Classic 95 palette`);
  assert.equal(classic.radius4, '0', `${routeCase.label} should receive square Classic 95 geometry`);
  assert.match(classic.fontBody, /tahoma/, `${routeCase.label} should receive Classic 95 typography`);
  assert.equal(current.themeId, 'context-engine', `${routeCase.label} should switch without a reload`);
  assert.equal(current.canvas, '#20204e', `${routeCase.label} should repaint to the Context Engine palette`);
  assert.equal(current.radius4, '4px', `${routeCase.label} should repaint rounded geometry`);
  assert.match(current.fontBody, /poppins/, `${routeCase.label} should repaint typography`);
  assert.notEqual(classic.modalBackground, current.modalBackground, `${routeCase.label} modal chrome should repaint`);
  assert.notEqual(classic.modalRadius, current.modalRadius, `${routeCase.label} modal geometry should repaint`);
  assert.ok(routeState.rootWidth > 0, `${routeCase.label} should render a visible app root`);
  assert.ok(
    routeState.overflow <= 4,
    `${routeCase.label} should not overflow the ${viewportName} viewport; received ${routeState.overflow}px (${JSON.stringify(routeState.overflowElements)})`,
  );
  if (routeCase.requiresSessionColors) {
    assert.ok(routeState.sessionPreviewAccent, 'Session Wizard preview should expose its scoped accent immediately');
  }
  docsContrastState.forEach(({ label, missing, ratio }) => {
    assert.equal(missing, undefined, `${label} should render in the Classic 95 Docs page`);
    assert.ok(ratio >= 4.5, `${label} should meet 4.5:1 contrast in Classic 95; received ${ratio.toFixed(2)}:1`);
  });
  if (welcomeFrameState) {
    assert.equal(welcomeFrameState.appearance, 'none', 'Classic 95 welcome media should not use native button chrome');
    assert.deepEqual(
      [
        welcomeFrameState.borderTopWidth,
        welcomeFrameState.borderRightWidth,
        welcomeFrameState.borderBottomWidth,
        welcomeFrameState.borderLeftWidth,
      ],
      ['0px', '0px', '0px', '0px'],
      'Classic 95 welcome media should not render a frame border',
    );
    assert.equal(welcomeFrameState.boxShadow, 'none', 'Classic 95 welcome media should not render a raised shadow');
  }
  if (loginContrastState) {
    assert.equal(loginContrastState.missing, undefined, 'Classic 95 login contrast surfaces should render');
    assert.equal(
      loginContrastState.messageBackground,
      'rgb(255, 255, 255)',
      'Classic 95 passkey copy should use a light inset panel',
    );
    assert.ok(
      loginContrastState.cardTopGap <= 4,
      `Classic 95 login card should not leave a dark top gap; received ${loginContrastState.cardTopGap}px`,
    );
    assert.ok(
      loginContrastState.titleRatio >= 4.5,
      `Classic 95 login title contrast should be at least 4.5:1; received ${loginContrastState.titleRatio.toFixed(2)}:1`,
    );
    assert.ok(
      loginContrastState.paragraphRatio >= 4.5,
      `Classic 95 passkey copy contrast should be at least 4.5:1; received ${loginContrastState.paragraphRatio.toFixed(2)}:1`,
    );
    assert.ok(
      loginContrastState.listItemRatio >= 4.5,
      `Classic 95 passkey list contrast should be at least 4.5:1; received ${loginContrastState.listItemRatio.toFixed(2)}:1`,
    );
    assert.ok(
      loginContrastState.createButtonRatio >= 4.5,
      `Classic 95 passkey button contrast should be at least 4.5:1; received ${loginContrastState.createButtonRatio.toFixed(2)}:1`,
    );
  }
  if (statsContrastState) {
    assert.ok(statsContrastState.pointCount >= 20, 'Community Stats should render the default-session questions');
    assert.ok(
      statsContrastState.pointSpread >= 200,
      `Community Stats should preserve the default-session consensus cluster; received ${statsContrastState.pointSpread.toFixed(2)}px spread`,
    );
    assert.equal(
      statsContrastState.hasCountedVotes,
      true,
      'Community Stats hover details should use default-session votes',
    );
    [
      ['stat icon', statsContrastState.statIconRatio, 3],
      ['stat count', statsContrastState.statCountRatio, 4.5],
      ['stat label', statsContrastState.statLabelRatio, 4.5],
      ['leaderboard row', statsContrastState.leaderboardRatio, 4.5],
      ['axis label', statsContrastState.axisLabelRatio, 4.5],
      ['question point', statsContrastState.pointRatio, 3],
      ['tooltip prompt', statsContrastState.tooltipPromptRatio, 4.5],
      ['tooltip Agree state', statsContrastState.tooltipAgreeRatio, 4.5],
      ['tooltip Unsure state', statsContrastState.tooltipUnsureRatio, 4.5],
      ['tooltip Disagree state', statsContrastState.tooltipDisagreeRatio, 4.5],
      ['tooltip total', statsContrastState.tooltipTotalRatio, 4.5],
    ].forEach(([label, received, minimum]) => {
      assert.ok(
        received >= minimum,
        `Classic 95 ${label} contrast should be at least ${minimum}:1; received ${received.toFixed(2)}:1`,
      );
    });
  }
  if (classicLogoState && currentLogoState) {
    assert.equal(classicLogoState.opacity, '0.74', 'Classic 95 navbar logo should be visibly brighter');
    assert.equal(classicLogoState.mixBlendMode, 'screen', 'Classic 95 navbar logo should blend lightly into teal');
    assert.match(
      classicLogoState.filter,
      /brightness\(1\.45\).*contrast\(1\.12\)/,
      'Classic 95 navbar logo should retain its contrast lift',
    );
    assert.equal(currentLogoState.opacity, '0.4', 'Context Engine navbar logo should preserve its original opacity');
    assert.equal(
      currentLogoState.mixBlendMode,
      'luminosity',
      'Context Engine navbar logo should preserve its original blend',
    );
    assert.equal(
      currentLogoState.filter,
      'none',
      'Context Engine navbar logo should not inherit the Classic 95 filter',
    );
  }
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.env.BASE_URL || 'http://127.0.0.1:3000');
  const browser = await chromium.launch({ headless: true });

  try {
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      await page.addInitScript(() => {
        window.localStorage.setItem('ce:firstVisitRootAboutRedirectConsumed:v20260618b', 'true');
        window.localStorage.setItem('ce_onboarding_complete', 'true');
        window.localStorage.setItem('firstVisit', 'false');
        window.localStorage.setItem('ce:theme', 'classic-95');
        window.localStorage.setItem('ce:primarySessionSlug', 'demo-sh');
        window.localStorage.setItem('ce:selectedSessionScope', 'active');
      });
      for (const routeCase of ROUTE_CASES) {
        await inspectRoute(page, baseUrl, routeCase, viewport.name);
      }
      await page.close();
    }
    console.log(
      `App theme runtime Playwright smoke passed (${ROUTE_CASES.length} routes × ${VIEWPORTS.length} viewports).`,
    );
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
