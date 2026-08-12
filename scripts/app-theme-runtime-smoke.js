'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { normalizeBaseUrl } = require('./vite-navigation-smoke');

const ROUTE_CASES = Object.freeze([
  {
    path: '/',
    label: 'home Tools cards',
    requiresStandardToolCards: true,
  },
  { path: '/', label: 'home footer controls', requiresFooterButtons: true },
  { path: '/', label: 'home title-bar tab spacing', requiresSpreadHomeTabs: true },
  {
    path: '/',
    label: 'home welcome and login surfaces',
    requiresFramelessWelcome: true,
    requiresReadableLogin: true,
    requiresPreloginThemeSettings: true,
  },
  { path: '/', label: 'question authoring controls', requiresReadableAuthoring: true },
  { path: '/', label: 'question card utility controls', requiresReadableQuestionUtilities: true },
  { path: '/', label: 'home Community Stats surface', requiresReadableStats: true },
  {
    path: '/about',
    label: 'about lazy route',
    requiresBrightLogo: true,
    requiresTransparentRecognitionLogos: true,
  },
  {
    path: '/session/new',
    label: 'Session Wizard',
    requiresBottomDockedFooter: true,
    requiresReadableSessionSetup: true,
    requiresSessionColors: true,
  },
  { path: '/docs', label: 'docs lazy route', requiresReadableDocs: true },
  { path: '/demos', label: 'demo surface' },
  { path: '/session/demo-sh', label: 'session question surface', requiresReadableSessionSurface: true },
  { path: '/su/CatherineTheGreat', label: 'simulated-user surface', requiresReadableSimUserSurface: true },
  {
    path: '/groups?sessionName=demo-sh',
    label: 'session groups surface',
    requiresMinimalGroupsSurface: true,
  },
  { path: '/theme-smoke-not-found', label: 'not-found state' },
]);

const VIEWPORTS = Object.freeze([
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]);

const TOOL_CARD_VIEWPORTS = Object.freeze([...VIEWPORTS, { name: 'compact', width: 765, height: 799 }]);

const HOME_TAB_VIEWPORTS = Object.freeze([...VIEWPORTS, { name: 'compact window', width: 765, height: 799 }]);

const FOOTER_VIEWPORTS = Object.freeze([...VIEWPORTS, { name: 'compact window', width: 765, height: 799 }]);

const SESSION_SURFACE_VIEWPORTS = Object.freeze([...VIEWPORTS, { name: 'compact window', width: 765, height: 799 }]);

const SESSION_SETUP_VIEWPORTS = Object.freeze([...VIEWPORTS, { name: 'compact window', width: 765, height: 799 }]);

const WELCOME_FIT_VIEWPORTS = Object.freeze([
  { name: 'compact window', width: 765, height: 799 },
  { name: 'compact desktop', width: 1280, height: 720 },
  { name: 'wide desktop', width: 1904, height: 900 },
  { name: 'ultra-wide short desktop', width: 2048, height: 876 },
]);

const WELCOME_SLIDE_KEYS = Object.freeze(['intro', 'toolkit', 'goals', 'built-to-help', 'because', 'looking-for']);

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
    layoutProfile: style.getPropertyValue('--ce-layout-profile').trim(),
    canvas: style.getPropertyValue('--ce-canvas').trim().toLowerCase(),
    radius4: style.getPropertyValue('--ce-radius-4').trim(),
    fontBody: style.getPropertyValue('--ce-font-body').trim().toLowerCase(),
    modalBackground: probeStyle.backgroundColor,
    modalRadius: probeStyle.borderRadius,
  };
  probe.remove();
  return state;
};

const auditVisibleTextContrast = (rootSelector) => {
  const parseColor = (value) => {
    const channels =
      String(value || '')
        .match(/[\d.]+/g)
        ?.map(Number) || [];
    if (channels.length < 3) return null;
    return {
      r: channels[0],
      g: channels[1],
      b: channels[2],
      a: channels.length >= 4 ? channels[3] : 1,
    };
  };
  const composite = (foreground, background) => {
    const alpha = foreground.a + background.a * (1 - foreground.a);
    if (alpha <= 0) return { r: 255, g: 255, b: 255, a: 1 };
    return {
      r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
      g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
      b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha,
      a: alpha,
    };
  };
  const backgroundFor = (element) => {
    const chain = [];
    let current = element;
    while (current) {
      chain.unshift(current);
      current = current.parentElement;
    }
    return chain.reduce(
      (background, node) => {
        const color = parseColor(window.getComputedStyle(node).backgroundColor);
        if (!color) return background;
        color.a *= Number(window.getComputedStyle(node).opacity || 1);
        return composite(color, background);
      },
      { r: 255, g: 255, b: 255, a: 1 },
    );
  };
  const luminance = ({ r, g, b }) => {
    const channels = [r, g, b].map((value) => {
      const channel = value / 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const root = document.querySelector(rootSelector);
  if (!root) return { missing: true, failures: [] };
  const failures = Array.from(root.querySelectorAll('*'))
    .filter((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || rect.width <= 0 || rect.height <= 0)
        return false;
      if (element.getAttribute('aria-hidden') === 'true') return false;
      if (element.matches('input, select, textarea')) return true;
      return Array.from(element.childNodes).some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      );
    })
    .map((element) => {
      const style = window.getComputedStyle(element);
      const background = backgroundFor(element);
      const color = parseColor(style.color);
      if (!color) return null;
      let opacity = 1;
      let current = element;
      while (current && root.contains(current)) {
        opacity *= Number(window.getComputedStyle(current).opacity || 1);
        current = current.parentElement;
      }
      color.a *= opacity;
      const foreground = composite(color, background);
      const foregroundLuminance = luminance(foreground);
      const backgroundLuminance = luminance(background);
      const ratio =
        (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
        (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
      const text = element.matches('input, select, textarea')
        ? element.value || element.getAttribute('placeholder') || element.getAttribute('aria-label') || element.tagName
        : Array.from(element.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent?.trim())
            .filter(Boolean)
            .join(' ');
      return {
        ratio,
        selector: `${element.tagName.toLowerCase()}${element.className ? `.${String(element.className).trim().split(/\s+/).join('.')}` : ''}`,
        text: String(text).slice(0, 80),
      };
    })
    .filter((entry) => entry && entry.ratio < 4.5)
    .sort((left, right) => left.ratio - right.ratio);
  return { failures };
};

async function inspectRoute(page, baseUrl, routeCase, viewportName) {
  const response = await page.goto(`${baseUrl}${routeCase.path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForSelector('#root', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 15000 });
  if (routeCase.requiresSpreadHomeTabs) {
    await page.locator('[role="tablist"]').waitFor({ state: 'visible', timeout: 15000 });
  }

  const readSessionHeaderGeometry = async () => {
    const logo = page.getByRole('link', { name: 'Context Engine home', exact: true }).locator('img');
    const login = page.getByRole('button', { name: 'LOG IN', exact: true });
    await logo.waitFor({ state: 'visible' });
    await login.waitFor({ state: 'visible' });
    const readBox = (locator) =>
      locator.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { centerY: rect.top + rect.height / 2, height: rect.height, width: rect.width };
      });
    return { logo: await readBox(logo), login: await readBox(login) };
  };

  const toolCard = routeCase.requiresStandardToolCards ? page.locator('div[class^="_square_"]').first() : null;
  if (toolCard) await toolCard.waitFor({ state: 'visible' });
  const classicToolCardState = toolCard
    ? {
        resting: await toolCard.evaluate((element) => {
          const style = window.getComputedStyle(element);
          return {
            backgroundColor: style.backgroundColor,
            borderBottomColor: style.borderBottomColor,
            borderBottomWidth: style.borderBottomWidth,
            borderLeftColor: style.borderLeftColor,
            borderLeftWidth: style.borderLeftWidth,
            borderRightColor: style.borderRightColor,
            borderRightWidth: style.borderRightWidth,
            borderTopColor: style.borderTopColor,
            borderTopWidth: style.borderTopWidth,
            boxShadow: style.boxShadow,
          };
        }),
        hovered: null,
      }
    : null;
  const classicToolArtworkState = toolCard
    ? await page.locator('div[class*="_backgroundImage_"]').evaluateAll((elements) =>
        elements.map((element) => {
          const style = window.getComputedStyle(element);
          return {
            backgroundImage: style.backgroundImage,
            display: style.display,
            height: element.getBoundingClientRect().height,
          };
        }),
      )
    : null;
  if (toolCard && classicToolCardState) {
    await toolCard.hover();
    await page.waitForFunction(
      () =>
        window.getComputedStyle(document.querySelector('div[class^="_square_"]')).backgroundColor ===
        'rgb(192, 192, 192)',
    );
    classicToolCardState.hovered = await toolCard.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        boxShadow: style.boxShadow,
      };
    });
  }

  const footerLink = routeCase.requiresFooterButtons ? page.getByRole('link', { name: 'NEW', exact: true }) : null;
  if (footerLink) {
    await footerLink.waitFor({ state: 'visible' });
    await footerLink.scrollIntoViewIfNeeded();
  }
  const classicFooterLinkState = footerLink
    ? await footerLink.evaluate((element) => {
        const style = window.getComputedStyle(element);
        const nav = element.closest('nav');
        const navRect = nav?.getBoundingClientRect();
        const linkRect = element.getBoundingClientRect();
        return {
          backgroundColor: style.backgroundColor,
          borderBottomColor: style.borderBottomColor,
          borderBottomWidth: style.borderBottomWidth,
          borderLeftColor: style.borderLeftColor,
          borderLeftWidth: style.borderLeftWidth,
          borderRightColor: style.borderRightColor,
          borderRightWidth: style.borderRightWidth,
          borderTopColor: style.borderTopColor,
          borderTopWidth: style.borderTopWidth,
          boxShadow: style.boxShadow,
          color: style.color,
          height: linkRect.height,
          left: linkRect.left,
          navLeft: navRect?.left || 0,
          navPseudoContent: nav ? window.getComputedStyle(nav, '::before').content : '',
        };
      })
    : null;
  const footerAttributionText = routeCase.requiresFooterButtons
    ? page.getByText('Software by Agalmic', { exact: true })
    : null;
  const footerGithubLink = routeCase.requiresFooterButtons ? page.getByTestId('ce-footer-link-github') : null;
  const classicFooterBrandState = footerAttributionText && footerGithubLink
    ? {
        text: await footerAttributionText.evaluate((element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return {
            display: style.display,
            height: rect.height,
            width: rect.width,
          };
        }),
        github: await footerGithubLink.evaluate((element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return {
            fontSize: Number.parseFloat(style.fontSize),
            height: rect.height,
            width: rect.width,
          };
        }),
      }
    : null;
  const dockedFooter = routeCase.requiresBottomDockedFooter ? page.locator('footer') : null;
  if (dockedFooter) await dockedFooter.waitFor({ state: 'visible' });
  const classicDockedFooterState = dockedFooter
    ? await dockedFooter.evaluate((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          bodyPaddingBottom: window.getComputedStyle(document.body).paddingBottom,
          bottom: rect.bottom,
          position: style.position,
          viewportHeight: window.innerHeight,
        };
      })
    : null;

  if (routeCase.requiresReadableSessionSetup) {
    await page.getByTestId('ce-new-preset-fast_cheap_cloudflare').waitFor({ state: 'visible' });
    await page
      .locator('[role="listitem"][class*="modePresetCardRequirementPill"]')
      .first()
      .waitFor({ state: 'visible' });
  }

  const sessionSetupContrastState = routeCase.requiresReadableSessionSetup
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
        const textRatio = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return 0;
          return ratio(window.getComputedStyle(element).color, backgroundFor(element));
        };

        return {
          eyebrowRatio: textRatio('[class*="modeProfileEntryEyebrow"]'),
          providerRatio: textRatio(
            '[data-testid="ce-new-preset-fast_cheap_cloudflare"] [class*="modePresetCardProvider"]',
          ),
          descriptionRatio: textRatio(
            '[data-testid="ce-new-preset-fast_cheap_cloudflare"] [class*="modePresetCardDescription"]',
          ),
          requirementRatio: textRatio('[role="listitem"][class*="modePresetCardRequirementPill"]'),
          requirementPillCount: document.querySelectorAll('[role="listitem"][class*="modePresetCardRequirementPill"]')
            .length,
          entryCardText: Array.from(document.querySelectorAll('[data-testid^="ce-new-preset-"]'))
            .map((card) => card.textContent || '')
            .join(' '),
        };
      })
    : null;

  if (routeCase.requiresSessionColors) {
    await page.getByTestId('ce-new-preset-fast_cheap_cloudflare').click();
    await page.waitForSelector('[data-testid="ce-wizard-session-color-scheme"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="ce-wizard-session-color-preview"]', { timeout: 15000 });
  }

  if (routeCase.requiresReadableSessionSurface) {
    await page.getByText('Existential risk from AI justifies extraordinary precautions.', { exact: true }).waitFor({
      state: 'visible',
    });
  }

  if (routeCase.requiresReadableSimUserSurface) {
    await page.getByRole('heading', { name: 'Catherine the Great', exact: true }).waitFor({ state: 'visible' });
  }

  if (routeCase.requiresMinimalGroupsSurface) {
    await page.getByTestId('ce-session-worker-groups').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Refresh groups', exact: true }).waitFor({ state: 'visible' });
  }

  if (routeCase.requiresReadableDocs) {
    await page.getByTestId('ce-contract-viewer-card-surveys').waitFor({ state: 'visible' });
    await page.getByTestId('ce-contract-viewer-card-sbtFactory').waitFor({ state: 'visible' });
    await page.getByTestId('ce-contract-viewer-card-customSBT').waitFor({ state: 'visible' });
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
    await page.locator('.modal-login.show').waitFor({ state: 'visible' });
    await page.getByText('Account uses a passkey:', { exact: true }).waitFor({ state: 'visible' });
  }

  if (routeCase.requiresPreloginThemeSettings) {
    await page.getByRole('button', { name: 'Toggle pre-login settings', exact: true }).click();
    await page.getByTestId('ce-prelogin-settings-panel').waitFor({ state: 'visible' });
    await page.getByTestId('ce-settings-theme').waitFor({ state: 'visible' });
    await page.getByTestId('ce-prelogin-config-toggle').click();
    await page.getByTestId('ce-prelogin-config-panel').waitFor({ state: 'visible' });
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

  if (routeCase.requiresReadableAuthoring) {
    await page.getByText('Questions', { exact: true }).click();
    await page.waitForFunction(
      () =>
        /Questions\s*\([1-9]\d*\)/.test(
          document.querySelector('[data-testid="ce-survey-questions-toggle"]')?.textContent || '',
        ),
      null,
      { timeout: 15000 },
    );
    await page.getByTestId('ce-survey-create-toggle').waitFor({ state: 'visible' });
    await page.getByTestId('ce-survey-create-toggle').click();
    await page.getByPlaceholder('Speak or type text here...').waitFor({ state: 'visible' });
    await page.getByTestId('ce-database-image-paste').waitFor({ state: 'visible' });
  }

  if (routeCase.requiresReadableQuestionUtilities) {
    await page.getByText('Questions', { exact: true }).click();
    await page.getByRole('button', { name: 'Conviction / importance' }).first().waitFor({ state: 'visible' });
  }

  const classicPileControlState = routeCase.requiresReadableSessionSurface
    ? await (async () => {
        const convictionButton = page.getByRole('button', { name: 'Conviction / importance' }).first();
        await convictionButton.click();
        const sliderPanel = page.locator('[class*="pileCardFooter"] [class*="importanceSlider"]').first();
        await sliderPanel.waitFor({ state: 'visible' });
        const conviction = await sliderPanel.evaluate((element) => {
          const style = window.getComputedStyle(element);
          const label = element.querySelector('[class*="importanceText"]');
          const slider = element.querySelector('[class*="convictionSlider"]');
          const labelStyle = label ? window.getComputedStyle(label) : null;
          const sliderStyle = slider ? window.getComputedStyle(slider) : null;
          return {
            backgroundColor: style.backgroundColor,
            borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
            boxShadow: style.boxShadow,
            color: style.color,
            opacity: Number(style.opacity),
            labelColor: labelStyle?.color || '',
            labelOpacity: Number(labelStyle?.opacity || 0),
            sliderBackground: sliderStyle?.backgroundColor || '',
            sliderOpacity: Number(sliderStyle?.opacity || 0),
          };
        });

        const lockButton = page.getByTestId('ce-survey-answer-lock').first();
        await lockButton.click();
        const onlyMeButton = page.getByTestId('ce-survey-lock-audience-self').first();
        await onlyMeButton.waitFor({ state: 'visible' });
        const lockAudience = await onlyMeButton.evaluate((element) => {
          const style = window.getComputedStyle(element);
          const popover = element.closest('[class*="pileLockAudiencePopover"]');
          const popoverStyle = popover ? window.getComputedStyle(popover) : null;
          return {
            backgroundColor: style.backgroundColor,
            borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
            boxShadow: style.boxShadow,
            color: style.color,
            opacity: Number(style.opacity),
            popoverBackground: popoverStyle?.backgroundColor || '',
            popoverBorderWidths: popoverStyle
              ? [
                  popoverStyle.borderTopWidth,
                  popoverStyle.borderRightWidth,
                  popoverStyle.borderBottomWidth,
                  popoverStyle.borderLeftWidth,
                ]
              : [],
            popoverBoxShadow: popoverStyle?.boxShadow || '',
          };
        });
        await lockButton.click();
        return { conviction, lockAudience };
      })()
    : null;

  const classic = await page.evaluate(readThemeState);
  const questionUtilityButton = routeCase.requiresReadableQuestionUtilities
    ? page.getByRole('button', { name: 'Conviction / importance' }).first()
    : null;
  const questionUtilityState = questionUtilityButton
    ? {
        resting: await questionUtilityButton.evaluate((element) => {
          const style = window.getComputedStyle(element);
          return {
            backgroundColor: style.backgroundColor,
            borderWidths: [
              style.borderTopWidth,
              style.borderRightWidth,
              style.borderBottomWidth,
              style.borderLeftWidth,
            ],
            boxShadow: style.boxShadow,
            color: style.color,
            opacity: Number.parseFloat(style.opacity),
          };
        }),
        hoveredOpacity: 0,
        focusedOutlineStyle: '',
      }
    : null;
  if (questionUtilityButton && questionUtilityState) {
    await questionUtilityButton.hover();
    await page.waitForFunction(
      (element) => Number.parseFloat(window.getComputedStyle(element).opacity) === 1,
      await questionUtilityButton.elementHandle(),
    );
    questionUtilityState.hoveredOpacity = await questionUtilityButton.evaluate((element) =>
      Number.parseFloat(window.getComputedStyle(element).opacity),
    );
    await questionUtilityButton.focus();
    questionUtilityState.focusedOutlineStyle = await questionUtilityButton.evaluate(
      (element) => window.getComputedStyle(element).outlineStyle,
    );
  }
  const routeState = await page.evaluate(() => {
    const root = document.querySelector('#root');
    const preview = document.querySelector('[data-testid="ce-wizard-session-color-preview"]');
    const homeTabs = document.querySelector('[role="tablist"]');
    const homeTabCenters = homeTabs
      ? Array.from(homeTabs.children).map((item) => {
          const rect = item.getBoundingClientRect();
          return rect.left + rect.width / 2;
        })
      : [];
    const homeTabControlCenters = homeTabs
      ? Array.from(homeTabs.children).map((item) => {
          const control = item.querySelector('.nav-link.active > div, .nav-link:not(.active) svg');
          const rect = control?.getBoundingClientRect();
          return rect ? rect.left + rect.width / 2 : null;
        })
      : [];
    const homeTabGaps = homeTabCenters.slice(1).map((center, index) => center - homeTabCenters[index]);
    const homeTabControlGaps = homeTabControlCenters
      .slice(1)
      .map((center, index) =>
        center === null || homeTabControlCenters[index] === null ? null : center - homeTabControlCenters[index],
      )
      .filter((gap) => gap !== null);
    const inactiveHomeTab = homeTabs?.querySelector('.nav-link:not(.active)');
    const inactiveHomeTabIcon = inactiveHomeTab?.querySelector('svg');
    const inactiveHomeTabStyle = inactiveHomeTab ? window.getComputedStyle(inactiveHomeTab) : null;
    const inactiveHomeTabIconRect = inactiveHomeTabIcon?.getBoundingClientRect();
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
      homeTabCount: homeTabCenters.length,
      homeTabGapRange: homeTabGaps.length ? Math.max(...homeTabGaps) - Math.min(...homeTabGaps) : null,
      homeTabControlCenters,
      homeTabControlGapRange: homeTabControlGaps.length
        ? Math.max(...homeTabControlGaps) - Math.min(...homeTabControlGaps)
        : null,
      inactiveHomeTabBorderWidths: inactiveHomeTabStyle
        ? [
            inactiveHomeTabStyle.borderTopWidth,
            inactiveHomeTabStyle.borderRightWidth,
            inactiveHomeTabStyle.borderBottomWidth,
            inactiveHomeTabStyle.borderLeftWidth,
          ]
        : [],
      inactiveHomeTabBackground: inactiveHomeTabStyle?.backgroundColor || '',
      inactiveHomeTabBoxShadow: inactiveHomeTabStyle?.boxShadow || '',
      inactiveHomeTabIconSize: Math.min(inactiveHomeTabIconRect?.width || 0, inactiveHomeTabIconRect?.height || 0),
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
  const classicWelcomeImageState = routeCase.requiresFramelessWelcome
    ? await page.getByTestId('ce-welcome-slide-image').evaluate((element) => {
        const stage = element.closest('.block-gradient-slow');
        return {
          backgroundImage: stage ? window.getComputedStyle(stage).backgroundImage : '',
          mixBlendMode: window.getComputedStyle(element).mixBlendMode,
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
  const preloginThemeSettingsState = routeCase.requiresPreloginThemeSettings
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
        const panel = document.querySelector('[data-testid="ce-prelogin-settings-panel"]');
        const selector = panel?.querySelector('[data-testid="ce-settings-theme"]');
        const label = panel?.querySelector('label[for="ce-settings-theme-select"]');
        const hint = selector?.parentElement?.querySelector('div');
        const sections = Array.from(panel?.querySelectorAll('[class*="settingsSectionCard"]') || []);
        const appearanceSection = selector?.closest('[class*="settingsSectionCard"]');
        const summary = appearanceSection?.querySelector('[class*="settingsSectionSummary"]');
        if (!panel || !selector || !label || !hint || !appearanceSection || !summary) return { missing: true };
        const selectorStyle = window.getComputedStyle(selector);
        const labelStyle = window.getComputedStyle(label);
        const hintStyle = window.getComputedStyle(hint);
        const summaryStyle = window.getComputedStyle(summary);
        return {
          isFinalSection: sections.at(-1) === appearanceSection,
          labelRatio: ratio(labelStyle.color, backgroundFor(label)),
          hintRatio: ratio(hintStyle.color, backgroundFor(hint)),
          summaryRatio: ratio(summaryStyle.color, backgroundFor(summary)),
          selectorRatio: ratio(selectorStyle.color, backgroundFor(selector)),
        };
      })
    : null;
  const preloginTextContrastAudit = routeCase.requiresPreloginThemeSettings
    ? await page.evaluate(auditVisibleTextContrast, '[data-testid="ce-prelogin-settings-panel"]')
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
        const firstPointRect = points[0]?.getBoundingClientRect();
        const svg = document.querySelector('[data-testid="ce-community-beeswarm-section"] svg');
        const tooltip = document.querySelector('[data-testid="ce-beeswarm-tooltip"]');
        const tooltipText = tooltip?.textContent || '';
        const tooltipRect = tooltip?.getBoundingClientRect();
        const tooltipStyle = tooltip ? window.getComputedStyle(tooltip) : null;
        const leaderboardName = document.querySelector('[class*="leaderboardItem"] [class*="name"]');
        const leaderboardText = leaderboardName?.querySelector('a') || leaderboardName;
        const leaderboardTextRect = leaderboardText?.getBoundingClientRect();
        const tooltipPointGap =
          tooltipRect && firstPointRect
            ? tooltipRect.right <= firstPointRect.left
              ? firstPointRect.left - tooltipRect.right
              : firstPointRect.right <= tooltipRect.left
                ? tooltipRect.left - firstPointRect.right
                : tooltipRect.bottom <= firstPointRect.top
                  ? firstPointRect.top - tooltipRect.bottom
                  : firstPointRect.bottom <= tooltipRect.top
                    ? tooltipRect.top - firstPointRect.bottom
                    : -Math.min(
                        tooltipRect.right - firstPointRect.left,
                        firstPointRect.right - tooltipRect.left,
                        tooltipRect.bottom - firstPointRect.top,
                        firstPointRect.bottom - tooltipRect.top,
                      )
            : -1;
        return {
          pointCount: points.length,
          pointSpread: pointXs.length ? Math.max(...pointXs) - Math.min(...pointXs) : 0,
          hasCountedVotes: /Counted\s+[1-9]\d*/i.test(tooltipText),
          statIconRatio: textRatio('[class*="statIcon"]'),
          statCountRatio: textRatio('[class*="statCount"]'),
          statLabelRatio: textRatio('[class*="statLabel"]'),
          leaderboardRatio: leaderboardText
            ? ratio(window.getComputedStyle(leaderboardText).color, backgroundFor(leaderboardText))
            : 0,
          leaderboardTextColor: leaderboardText ? window.getComputedStyle(leaderboardText).color : '',
          leaderboardTextOpacity: leaderboardText
            ? Number.parseFloat(window.getComputedStyle(leaderboardText).opacity)
            : 0,
          leaderboardTextWidth: leaderboardTextRect?.width || 0,
          leaderboardTextHeight: leaderboardTextRect?.height || 0,
          axisLabelRatio: textRatio('[data-testid="ce-community-beeswarm-section"] text', 'fill'),
          pointRatio:
            firstPointStyle && svg ? ratio(firstPointStyle.fill, window.getComputedStyle(svg).backgroundColor) : 0,
          tooltipPromptRatio: textRatio('[data-testid="ce-beeswarm-tooltip"] p'),
          tooltipAgreeRatio: textRatio('[data-testid="ce-beeswarm-tooltip-agree"]'),
          tooltipUnsureRatio: textRatio('[data-testid="ce-beeswarm-tooltip-unsure"]'),
          tooltipDisagreeRatio: textRatio('[data-testid="ce-beeswarm-tooltip-disagree"]'),
          tooltipTotalRatio: textRatio('[data-testid="ce-beeswarm-tooltip-total"]'),
          tooltipWidth: tooltipRect?.width || 0,
          tooltipPointGap,
          tooltipRect: tooltipRect
            ? { left: tooltipRect.left, right: tooltipRect.right, top: tooltipRect.top, bottom: tooltipRect.bottom }
            : null,
          hoveredPointRect: firstPointRect
            ? {
                left: firstPointRect.left,
                right: firstPointRect.right,
                top: firstPointRect.top,
                bottom: firstPointRect.bottom,
              }
            : null,
          tooltipPointerEvents: tooltipStyle?.pointerEvents || '',
        };
      })
    : null;
  const authoringContrastState = routeCase.requiresReadableAuthoring
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
        const textRatio = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return 0;
          return ratio(window.getComputedStyle(element).color, backgroundFor(element));
        };
        const panel = document.querySelector('[class*="databaseTool"]');
        const section = panel?.querySelector('[class*="formSection"]');
        return {
          panelBackground: panel ? window.getComputedStyle(panel).backgroundColor : '',
          panelText: panel ? window.getComputedStyle(panel).color : '',
          sectionBackground: section ? window.getComputedStyle(section).backgroundColor : '',
          samples: [
            ['questions selector', '[data-testid="ce-survey-questions-toggle"]'],
            ['filter control', '[data-testid="ce-survey-filter-toggle"]'],
            ['create control', '[data-testid="ce-survey-create-toggle"]'],
            ['mode switch', '[data-testid="ce-create-mode-switch"]'],
            ['content input', 'textarea[placeholder="Speak or type text here..."]'],
            ['URL input', 'input[placeholder="Add URL"]'],
            ['paste control', '[data-testid="ce-database-image-paste"]'],
            ['question type', '[class*="typeTitle"]'],
            ['question count label', '[class*="countInlineLabel"]'],
            ['question count', '[class*="countReadout"]'],
            ['AI prompt toggle', '[class*="aiPromptToggleBtn"]'],
          ].map(([label, selector]) => ({ label, ratio: textRatio(selector) })),
        };
      })
    : null;
  const reportedSurfaceState =
    routeCase.requiresReadableSessionSurface ||
    routeCase.requiresReadableSimUserSurface ||
    routeCase.requiresMinimalGroupsSurface
      ? await page.evaluate(
          (surface) => {
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
            const textRatio = (selector) => {
              const element = document.querySelector(selector);
              if (!element) return 0;
              const foregroundLuminance = luminance(window.getComputedStyle(element).color);
              const backgroundLuminance = luminance(backgroundFor(element));
              return (
                (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
                (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
              );
            };

            if (surface === 'session') {
              const branding = document.querySelector('[class*="brandingSection"]');
              const pileCard = document.querySelector('[class*="pileCardInner"]');
              const pileCardBody = document.querySelector('[class*="pileCardBody"]');
              const iconControlState = (label, selector) => {
                const element = document.querySelector(selector);
                if (!element) return { label, exists: false };
                const style = window.getComputedStyle(element);
                return {
                  label,
                  exists: true,
                  backgroundColor: style.backgroundColor,
                  borderWidths: [
                    style.borderTopWidth,
                    style.borderRightWidth,
                    style.borderBottomWidth,
                    style.borderLeftWidth,
                  ],
                  boxShadow: style.boxShadow,
                  opacity: Number(style.opacity),
                };
              };
              return {
                brandingBackground: branding ? window.getComputedStyle(branding).backgroundColor : '',
                hasPileWindowTitlebar: Boolean(document.querySelector('[class*="pileWindowTitlebar"]')),
                pileCardBodyPaddingTop: pileCardBody ? window.getComputedStyle(pileCardBody).paddingTop : '',
                pileCardMarginTop: pileCard ? window.getComputedStyle(pileCard).marginTop : '',
                promptRatio: textRatio('[class*="pileCardHeader"] h4'),
                sessionTitleRatio: textRatio('[class*="brandingSectionTitle"]'),
                sectionTitleRatio: textRatio('[class*="sectionHeaderTitle"]'),
                iconControls: [
                  iconControlState('question actions', 'button[aria-label="Question actions"]'),
                  iconControlState('microphone', '[data-testid="ce-session-listening-toggle"]'),
                  iconControlState('comment', '[data-testid="ce-survey-additional-toggle"]'),
                  iconControlState('lock', '[data-testid="ce-survey-answer-lock"]'),
                  iconControlState('previous question', 'button[aria-label="Previous Question"]'),
                  iconControlState('next question', 'button[aria-label="Next Question"]'),
                ],
              };
            }
            if (surface === 'sim-user') {
              return {
                heroNameRatio: textRatio('[class*="heroName"]'),
                heroBioRatio: textRatio('[class*="heroBio"]'),
                quoteRatio: textRatio('[class*="featuredQuote"]'),
              };
            }
            const refresh = document.querySelector('button[aria-label="Refresh groups"]');
            return {
              hasLegacyListHeading: Boolean(document.querySelector('[class*="telegramListHeader"] span')),
              refreshHasIcon: Boolean(refresh?.querySelector('svg')),
              refreshText: refresh?.textContent?.trim() || '',
            };
          },
          routeCase.requiresReadableSessionSurface
            ? 'session'
            : routeCase.requiresReadableSimUserSurface
              ? 'sim-user'
              : 'groups',
        )
      : null;
  const classicQuestionsSectionState = routeCase.requiresReadableSessionSurface
    ? await (async () => {
        await page.getByTestId('ce-survey-view-all').click();
        await page.getByTestId('ce-session-questions-full-header').waitFor({ state: 'visible' });
        return page.locator('[class*="questionsSectionContainer"]').evaluate((element) => {
          const style = window.getComputedStyle(element);
          return {
            backgroundColor: style.backgroundColor,
            borderWidths: [
              style.borderTopWidth,
              style.borderRightWidth,
              style.borderBottomWidth,
              style.borderLeftWidth,
            ],
            boxShadow: style.boxShadow,
            padding: style.padding,
          };
        });
      })()
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
  const classicRecognitionLogoState = routeCase.requiresTransparentRecognitionLogos
    ? await page
        .getByTestId('ce-about-recognition-ethereum')
        .locator('img')
        .evaluate((element) => {
          const style = window.getComputedStyle(element);
          return { backgroundColor: style.backgroundColor, borderColor: style.borderColor };
        })
    : null;
  const classicSessionHeaderGeometry = routeCase.requiresReadableSessionSurface
    ? await readSessionHeaderGeometry()
    : null;

  await page.evaluate(() => {
    document.documentElement.dataset.ceTheme = 'context-engine';
    window.dispatchEvent(new CustomEvent('ce:theme-change', { detail: { id: 'context-engine', source: 'user' } }));
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const current = await page.evaluate(readThemeState);
  if (toolCard) {
    await page.waitForFunction(() => {
      const style = window.getComputedStyle(document.querySelector('div[class^="_square_"]'));
      return style.backgroundColor === 'rgb(29, 140, 248)' && style.boxShadow.includes('24px 42px');
    });
  }
  const currentToolCardState = toolCard
    ? await toolCard.evaluate((element) => {
        const style = window.getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
        };
      })
    : null;
  const currentFooterLinkState = footerLink
    ? await footerLink.evaluate((element) => {
        const style = window.getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          borderBottomWidth: style.borderBottomWidth,
          borderLeftWidth: style.borderLeftWidth,
          borderRightWidth: style.borderRightWidth,
          borderTopWidth: style.borderTopWidth,
          boxShadow: style.boxShadow,
        };
      })
    : null;
  const currentFooterBrandState = footerAttributionText && footerGithubLink
    ? {
        text: await footerAttributionText.evaluate((element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return {
            display: style.display,
            height: rect.height,
            width: rect.width,
          };
        }),
        github: await footerGithubLink.evaluate((element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return {
            fontSize: Number.parseFloat(style.fontSize),
            height: rect.height,
            width: rect.width,
          };
        }),
      }
    : null;
  const currentDockedFooterState = dockedFooter
    ? await dockedFooter.evaluate((element) => ({
        bodyPaddingBottom: window.getComputedStyle(document.body).paddingBottom,
        position: window.getComputedStyle(element).position,
      }))
    : null;
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
  const currentRecognitionLogoState = routeCase.requiresTransparentRecognitionLogos
    ? await page
        .getByTestId('ce-about-recognition-ethereum')
        .locator('img')
        .evaluate((element) => {
          const style = window.getComputedStyle(element);
          return { backgroundColor: style.backgroundColor, borderColor: style.borderColor };
        })
    : null;
  const currentSessionHeaderGeometry = routeCase.requiresReadableSessionSurface
    ? await readSessionHeaderGeometry()
    : null;
  const currentWelcomeImageState = routeCase.requiresFramelessWelcome
    ? await page.getByTestId('ce-welcome-slide-image').evaluate((element) => {
        const stage = element.closest('.block-gradient-slow');
        return {
          backgroundImage: stage ? window.getComputedStyle(stage).backgroundImage : '',
          mixBlendMode: window.getComputedStyle(element).mixBlendMode,
        };
      })
    : null;

  assert.equal(response?.status(), 200, `${routeCase.label} should load in ${viewportName}`);
  assert.equal(classic.themeId, 'classic-95', `${routeCase.label} should bootstrap the stored theme`);
  assert.equal(classic.themeSource, 'user', `${routeCase.label} should preserve user-theme precedence`);
  assert.equal(classic.layoutProfile, 'desktop-window', `${routeCase.label} should receive the desktop layout profile`);
  assert.equal(classic.canvas, '#008080', `${routeCase.label} should receive the Classic 95 palette`);
  assert.equal(classic.radius4, '0', `${routeCase.label} should receive square Classic 95 geometry`);
  assert.match(classic.fontBody, /tahoma/, `${routeCase.label} should receive Classic 95 typography`);
  assert.equal(current.themeId, 'context-engine', `${routeCase.label} should switch without a reload`);
  assert.equal(current.layoutProfile, 'standard-app', `${routeCase.label} should restore the default layout profile`);
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
  if (routeCase.requiresSpreadHomeTabs) {
    assert.equal(routeState.homeTabCount, 4, 'Classic 95 home title bar should expose all four tab options');
    assert.ok(
      routeState.homeTabGapRange !== null && routeState.homeTabGapRange <= 2,
      `Classic 95 home title-bar options should be evenly spaced; received a ${routeState.homeTabGapRange}px gap range`,
    );
    assert.ok(
      routeState.homeTabControlGapRange !== null && routeState.homeTabControlGapRange <= 2,
      `Classic 95 home title-bar icons and active label should be evenly distributed in ${viewportName}; received centers ${JSON.stringify(routeState.homeTabControlCenters)} and a ${routeState.homeTabControlGapRange}px gap range`,
    );
    assert.deepEqual(
      routeState.inactiveHomeTabBorderWidths,
      ['0px', '0px', '0px', '0px'],
      'Classic 95 inactive home tab icons should not render button borders',
    );
    assert.equal(
      routeState.inactiveHomeTabBackground,
      'rgba(0, 0, 0, 0)',
      'Classic 95 inactive home tab icons should rest on the title-bar background',
    );
    assert.equal(
      routeState.inactiveHomeTabBoxShadow,
      'none',
      'Classic 95 inactive home tab icons should not be raised',
    );
    assert.ok(
      routeState.inactiveHomeTabIconSize >= 20,
      `Classic 95 inactive home tab icons should be at least 20px; received ${routeState.inactiveHomeTabIconSize}px`,
    );
  }
  if (questionUtilityState) {
    assert.deepEqual(
      questionUtilityState.resting.borderWidths,
      ['0px', '0px', '0px', '0px'],
      'Classic 95 full-question utility icons should not render button borders',
    );
    assert.equal(
      questionUtilityState.resting.backgroundColor,
      'rgba(0, 0, 0, 0)',
      'Classic 95 full-question utility icons should use a transparent background',
    );
    assert.equal(
      questionUtilityState.resting.boxShadow,
      'none',
      'Classic 95 full-question utility icons should not render a raised shadow',
    );
    assert.ok(
      questionUtilityState.resting.opacity >= 0.8,
      `Classic 95 full-question utility icons should remain clearly visible; received opacity ${questionUtilityState.resting.opacity}`,
    );
    assert.equal(
      questionUtilityState.hoveredOpacity,
      1,
      'Classic 95 full-question utility icons should become fully opaque on hover',
    );
    assert.equal(
      questionUtilityState.focusedOutlineStyle,
      'dotted',
      'Classic 95 full-question utility icons should retain a visible keyboard focus indicator',
    );
  }
  if (classicToolCardState?.hovered && currentToolCardState) {
    assert.equal(classicToolArtworkState?.length, 3, 'Classic 95 should render artwork for all three live tool cards');
    classicToolArtworkState?.forEach((artwork) => {
      assert.equal(artwork.display, 'block', 'Classic 95 tool artwork should remain visible');
      assert.match(artwork.backgroundImage, /^url\(/, 'Classic 95 tool artwork should use its bundled image');
      assert.equal(
        artwork.height,
        viewportName === 'mobile' ? 84 : 124,
        'Classic 95 tool artwork should use the compact theme thumbnail height',
      );
    });
    assert.deepEqual(
      [
        classicToolCardState.resting.borderTopWidth,
        classicToolCardState.resting.borderRightWidth,
        classicToolCardState.resting.borderBottomWidth,
        classicToolCardState.resting.borderLeftWidth,
      ],
      ['2px', '2px', '2px', '2px'],
      'Classic 95 tool cards should use the theme control-border width',
    );
    assert.deepEqual(
      [
        classicToolCardState.resting.borderTopColor,
        classicToolCardState.resting.borderRightColor,
        classicToolCardState.resting.borderBottomColor,
        classicToolCardState.resting.borderLeftColor,
      ],
      ['rgb(255, 255, 255)', 'rgb(64, 64, 64)', 'rgb(64, 64, 64)', 'rgb(255, 255, 255)'],
      'Classic 95 tool cards should use a standard raised bevel',
    );
    assert.match(
      classicToolCardState.resting.boxShadow,
      /1px 1px 0px/,
      'Classic 95 tool cards should use a compact raised shadow',
    );
    assert.equal(
      classicToolCardState.hovered.backgroundColor,
      'rgb(192, 192, 192)',
      'Classic 95 tool-card hover should remain on the standard control face',
    );
    assert.match(
      classicToolCardState.hovered.boxShadow,
      /1px 1px 0px/,
      'Classic 95 tool-card hover should not add a colored halo',
    );
    assert.equal(
      currentToolCardState.backgroundColor,
      'rgb(29, 140, 248)',
      'Context Engine tool-card hover should preserve the existing information-blue surface',
    );
    assert.match(
      currentToolCardState.boxShadow,
      /24px 42px/,
      'Context Engine tool-card hover should preserve its existing layered depth',
    );
  }
  if (classicFooterLinkState && currentFooterLinkState) {
    assert.deepEqual(
      [
        classicFooterLinkState.borderTopWidth,
        classicFooterLinkState.borderRightWidth,
        classicFooterLinkState.borderBottomWidth,
        classicFooterLinkState.borderLeftWidth,
      ],
      ['2px', '2px', '2px', '2px'],
      'Classic 95 footer links should use the theme control-border width',
    );
    assert.deepEqual(
      [
        classicFooterLinkState.borderTopColor,
        classicFooterLinkState.borderRightColor,
        classicFooterLinkState.borderBottomColor,
        classicFooterLinkState.borderLeftColor,
      ],
      ['rgb(255, 255, 255)', 'rgb(64, 64, 64)', 'rgb(64, 64, 64)', 'rgb(255, 255, 255)'],
      'Classic 95 footer links should use a standard raised bevel',
    );
    assert.equal(
      classicFooterLinkState.backgroundColor,
      'rgb(192, 192, 192)',
      'Classic 95 footer links should use the standard control face',
    );
    assert.equal(
      classicFooterLinkState.color,
      'rgb(0, 0, 0)',
      'Classic 95 footer links should use readable black text',
    );
    assert.match(
      classicFooterLinkState.boxShadow,
      /1px 1px 0px/,
      'Classic 95 footer links should use a compact raised shadow',
    );
    assert.ok(
      classicFooterLinkState.navPseudoContent === 'none' || classicFooterLinkState.navPseudoContent === 'normal',
      'Classic 95 footer navigation should not render a decorative pseudo-button',
    );
    assert.ok(
      Math.abs(classicFooterLinkState.left - classicFooterLinkState.navLeft) <= 1,
      'Classic 95 footer navigation should begin with the first real link',
    );
    if (viewportName !== 'mobile') {
      assert.equal(classicFooterLinkState.height, 32, 'Classic 95 footer links should use compact taskbar height');
    }
    assert.deepEqual(
      [
        currentFooterLinkState.borderTopWidth,
        currentFooterLinkState.borderRightWidth,
        currentFooterLinkState.borderBottomWidth,
        currentFooterLinkState.borderLeftWidth,
      ],
      ['0px', '0px', '0px', '0px'],
      'Context Engine footer links should remain unframed',
    );
    assert.equal(
      currentFooterLinkState.backgroundColor,
      'rgba(0, 0, 0, 0)',
      'Context Engine footer links should keep their transparent background',
    );
    assert.equal(currentFooterLinkState.boxShadow, 'none', 'Context Engine footer links should remain shadow-free');
  }
  if (classicFooterBrandState && currentFooterBrandState) {
    assert.equal(
      classicFooterBrandState.text.display,
      'none',
      'Classic 95 should replace the footer attribution wording with the GitHub icon',
    );
    assert.ok(
      classicFooterBrandState.github.width >= 24 && classicFooterBrandState.github.height >= 24,
      `Classic 95 footer GitHub icon should be at least 24px; received ${JSON.stringify(classicFooterBrandState.github)}`,
    );
    assert.notEqual(
      currentFooterBrandState.text.display,
      'none',
      'Context Engine should preserve the footer attribution wording',
    );
    assert.ok(
      currentFooterBrandState.text.width > 0 && currentFooterBrandState.text.height > 0,
      'Context Engine footer attribution wording should remain visible',
    );
    assert.ok(
      classicFooterBrandState.github.fontSize > currentFooterBrandState.github.fontSize,
      'Classic 95 footer GitHub icon should be larger than the Context Engine icon',
    );
  }
  if (classicDockedFooterState && currentDockedFooterState) {
    assert.equal(classicDockedFooterState.position, 'fixed', 'Classic 95 should dock the taskbar to the viewport');
    assert.ok(
      Math.abs(classicDockedFooterState.bottom - classicDockedFooterState.viewportHeight) <= 1,
      `Classic 95 footer should touch the viewport bottom; received ${JSON.stringify(classicDockedFooterState)}`,
    );
    assert.equal(
      classicDockedFooterState.bodyPaddingBottom,
      '42px',
      'Classic 95 should reserve room for the fixed taskbar',
    );
    assert.notEqual(
      currentDockedFooterState.position,
      'fixed',
      'Context Engine should preserve its document-flow footer',
    );
    assert.equal(
      currentDockedFooterState.bodyPaddingBottom,
      '0px',
      'Context Engine should not inherit Classic 95 taskbar spacing',
    );
  }
  if (sessionSetupContrastState) {
    assert.equal(
      sessionSetupContrastState.requirementPillCount,
      6,
      'Session Setup should render every requirement as an individual pill',
    );
    assert.doesNotMatch(
      sessionSetupContrastState.entryCardText,
      /worker/i,
      'Session Setup entry cards should explain storage without internal Worker terminology',
    );
    assert.match(
      sessionSetupContrastState.entryCardText,
      /EVM RPC URL/,
      'Session Setup should identify the RPC URL as an EVM requirement',
    );
    assert.match(
      sessionSetupContrastState.entryCardText,
      /EVM Gas \(TX Fees\)/,
      'Session Setup should explain that EVM gas pays transaction fees',
    );
    assert.doesNotMatch(
      sessionSetupContrastState.entryCardText,
      /EVM testnet gas/,
      'Session Setup should not use the superseded gas label',
    );
    [
      ['Choose a setup', sessionSetupContrastState.eyebrowRatio],
      ['Cloudflare provider', sessionSetupContrastState.providerRatio],
      ['Cloudflare description', sessionSetupContrastState.descriptionRatio],
      ['setup requirement pill', sessionSetupContrastState.requirementRatio],
    ].forEach(([label, received]) => {
      assert.ok(
        received >= 4.5,
        `Classic 95 ${label} contrast should be at least 4.5:1; received ${received.toFixed(2)}:1`,
      );
    });
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
    assert.equal(
      classicWelcomeImageState?.mixBlendMode,
      'screen',
      'Classic 95 welcome artwork should use a brighter palette-safe blend',
    );
    assert.equal(
      currentWelcomeImageState?.mixBlendMode,
      'lighten',
      'Context Engine welcome artwork should preserve its original blend',
    );
    assert.equal(
      classicWelcomeImageState?.backgroundImage,
      currentWelcomeImageState?.backgroundImage,
      'Welcome artwork should preserve its branded backdrop across app themes',
    );
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
  if (preloginThemeSettingsState) {
    assert.equal(
      preloginThemeSettingsState.missing,
      undefined,
      'Signed-out Appearance & colors controls should render',
    );
    assert.equal(
      preloginThemeSettingsState.isFinalSection,
      true,
      'Appearance & colors should be the final signed-out Settings section',
    );
    assert.ok(
      preloginThemeSettingsState.labelRatio >= 4.5,
      `Classic 95 App theme label contrast should be at least 4.5:1; received ${preloginThemeSettingsState.labelRatio.toFixed(2)}:1`,
    );
    assert.ok(
      preloginThemeSettingsState.hintRatio >= 4.5,
      `Classic 95 App theme hint contrast should be at least 4.5:1; received ${preloginThemeSettingsState.hintRatio.toFixed(2)}:1`,
    );
    assert.ok(
      preloginThemeSettingsState.summaryRatio >= 4.5,
      `Classic 95 Appearance summary contrast should be at least 4.5:1; received ${preloginThemeSettingsState.summaryRatio.toFixed(2)}:1`,
    );
    assert.ok(
      preloginThemeSettingsState.selectorRatio >= 4.5,
      `Classic 95 App theme selector contrast should be at least 4.5:1; received ${preloginThemeSettingsState.selectorRatio.toFixed(2)}:1`,
    );
  }
  if (preloginTextContrastAudit) {
    assert.equal(preloginTextContrastAudit.missing, undefined, 'Signed-out Settings text audit root should render');
    assert.deepEqual(
      preloginTextContrastAudit.failures,
      [],
      `Classic 95 signed-out Settings text should meet 4.5:1 contrast: ${JSON.stringify(preloginTextContrastAudit.failures.slice(0, 12))}`,
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
    assert.ok(
      statsContrastState.tooltipWidth <= 320,
      `Community Stats hover details should stay compact; received ${statsContrastState.tooltipWidth.toFixed(2)}px`,
    );
    assert.ok(
      statsContrastState.tooltipPointGap >= 8,
      `Community Stats hover details should leave the hovered dot visible; received ${statsContrastState.tooltipPointGap.toFixed(2)}px gap (${JSON.stringify({ tooltip: statsContrastState.tooltipRect, point: statsContrastState.hoveredPointRect })})`,
    );
    assert.equal(
      statsContrastState.tooltipPointerEvents,
      'none',
      'Community Stats hover details should not block nearby points',
    );
    assert.equal(
      statsContrastState.leaderboardTextColor,
      'rgb(0, 0, 0)',
      'Classic 95 participant addresses should use readable black text on light rows',
    );
    assert.equal(
      statsContrastState.leaderboardTextOpacity,
      1,
      'Classic 95 participant addresses should be fully opaque',
    );
    assert.ok(
      statsContrastState.leaderboardTextWidth > 0 && statsContrastState.leaderboardTextHeight > 0,
      `Classic 95 participant addresses should occupy visible layout space; received ${statsContrastState.leaderboardTextWidth.toFixed(2)}x${statsContrastState.leaderboardTextHeight.toFixed(2)}px`,
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
  if (authoringContrastState) {
    assert.equal(
      authoringContrastState.panelBackground,
      'rgb(192, 192, 192)',
      'Classic 95 authoring should use the standard gray workspace instead of the navy overlay',
    );
    assert.equal(authoringContrastState.panelText, 'rgb(0, 0, 0)', 'Classic 95 authoring should use black panel text');
    assert.equal(
      authoringContrastState.sectionBackground,
      'rgb(212, 208, 200)',
      'Classic 95 authoring sections should use the standard Windows surface',
    );
    authoringContrastState.samples.forEach(({ label, ratio: received }) => {
      assert.ok(
        received >= 4.5,
        `Classic 95 ${label} contrast should be at least 4.5:1; received ${received.toFixed(2)}:1`,
      );
    });
  }
  if (routeCase.requiresReadableSessionSurface) {
    const assertMatchingBox = (classicBox, currentBox, label) => {
      ['height', 'width'].forEach((dimension) => {
        assert.ok(
          Math.abs(classicBox[dimension] - currentBox[dimension]) <= 0.5,
          `Classic 95 ${label} ${dimension} should match Context Engine in ${viewportName}; received ${classicBox[dimension]}px versus ${currentBox[dimension]}px`,
        );
      });
    };
    assertMatchingBox(classicSessionHeaderGeometry.logo, currentSessionHeaderGeometry.logo, 'session logo');
    assertMatchingBox(classicSessionHeaderGeometry.login, currentSessionHeaderGeometry.login, 'session login button');
    assert.ok(
      Math.abs(classicSessionHeaderGeometry.logo.centerY - classicSessionHeaderGeometry.login.centerY) <= 0.5,
      `Classic 95 session logo and login button should share a vertical center in ${viewportName}; received ${classicSessionHeaderGeometry.logo.centerY}px versus ${classicSessionHeaderGeometry.login.centerY}px`,
    );
    assert.deepEqual(
      classicQuestionsSectionState,
      {
        backgroundColor: 'rgba(0, 0, 0, 0)',
        borderWidths: ['0px', '0px', '0px', '0px'],
        boxShadow: 'none',
        padding: '0px',
      },
      'Classic 95 Questions explorer should not render an exterior shell',
    );
    assert.equal(
      reportedSurfaceState.hasPileWindowTitlebar,
      false,
      'Classic 95 session questions should rely on the navigation counter instead of a duplicate title bar',
    );
    assert.equal(
      reportedSurfaceState.pileCardMarginTop,
      '0px',
      'Classic 95 question cards should reclaim the title-bar gap',
    );
    assert.equal(
      reportedSurfaceState.pileCardBodyPaddingTop,
      '12px',
      'Classic 95 question content should begin without reserved title-bar padding',
    );
    assert.equal(
      reportedSurfaceState.brandingBackground,
      'rgba(0, 0, 0, 0)',
      'Classic 95 session branding should keep its simplified transparent stage',
    );
    assert.deepEqual(
      classicPileControlState.conviction.borderWidths,
      ['0px', '0px', '0px', '0px'],
      'Classic 95 conviction/importance controls should not have an exterior border',
    );
    assert.equal(
      classicPileControlState.conviction.backgroundColor,
      'rgba(0, 0, 0, 0)',
      'Classic 95 conviction/importance controls should use the card surface directly',
    );
    assert.equal(
      classicPileControlState.conviction.boxShadow,
      'none',
      'Classic 95 conviction/importance controls should not add an exterior shadow',
    );
    assert.equal(classicPileControlState.conviction.opacity, 1, 'Classic 95 slider controls should be fully opaque');
    assert.equal(
      classicPileControlState.conviction.labelColor,
      'rgb(0, 0, 0)',
      'Classic 95 conviction/importance labels should use readable black text',
    );
    assert.equal(
      classicPileControlState.conviction.labelOpacity,
      1,
      'Classic 95 conviction/importance labels should be fully opaque',
    );
    assert.equal(
      classicPileControlState.conviction.sliderOpacity,
      1,
      'Classic 95 conviction/importance sliders should be fully opaque',
    );
    assert.notEqual(
      classicPileControlState.conviction.sliderBackground,
      'rgba(0, 0, 0, 0)',
      'Classic 95 conviction/importance sliders should retain a visible track',
    );
    assert.deepEqual(
      classicPileControlState.lockAudience.borderWidths,
      ['0px', '0px', '0px', '0px'],
      'Classic 95 Only me option should not have an exterior border',
    );
    assert.equal(
      classicPileControlState.lockAudience.backgroundColor,
      'rgba(0, 0, 0, 0)',
      'Classic 95 Only me option should use the lock menu surface directly',
    );
    assert.equal(classicPileControlState.lockAudience.boxShadow, 'none', 'Classic 95 Only me option should be flat');
    assert.equal(classicPileControlState.lockAudience.color, 'rgb(0, 0, 0)', 'Classic 95 Only me text should be black');
    assert.equal(classicPileControlState.lockAudience.opacity, 1, 'Classic 95 Only me option should be fully opaque');
    assert.deepEqual(
      classicPileControlState.lockAudience.popoverBorderWidths,
      ['0px', '0px', '0px', '0px'],
      'Classic 95 lock menu should not have an exterior border',
    );
    assert.equal(
      classicPileControlState.lockAudience.popoverBoxShadow,
      'none',
      'Classic 95 lock menu should not add an exterior shadow',
    );
    reportedSurfaceState.iconControls.forEach((control) => {
      assert.equal(control.exists, true, `Classic 95 ${control.label} control should be present`);
      assert.deepEqual(
        control.borderWidths,
        ['0px', '0px', '0px', '0px'],
        `Classic 95 ${control.label} control should not have a persistent button border`,
      );
      assert.equal(
        control.backgroundColor,
        'rgba(0, 0, 0, 0)',
        `Classic 95 ${control.label} control should have a transparent background`,
      );
      assert.equal(control.boxShadow, 'none', `Classic 95 ${control.label} control should not have a button shadow`);
      assert.equal(control.opacity, 1, `Classic 95 ${control.label} control should remain fully visible`);
    });
    [
      ['session title', reportedSurfaceState.sessionTitleRatio],
      ['question prompt', reportedSurfaceState.promptRatio],
      ['lower panel title', reportedSurfaceState.sectionTitleRatio],
    ].forEach(([label, received]) => {
      assert.ok(
        received >= 4.5,
        `Classic 95 ${label} contrast should be at least 4.5:1; received ${received.toFixed(2)}:1`,
      );
    });
  }
  if (routeCase.requiresReadableSimUserSurface) {
    [
      ['simulated-user name', reportedSurfaceState.heroNameRatio],
      ['simulated-user biography', reportedSurfaceState.heroBioRatio],
      ['simulated-user quote', reportedSurfaceState.quoteRatio],
    ].forEach(([label, received]) => {
      assert.ok(
        received >= 4.5,
        `Classic 95 ${label} contrast should be at least 4.5:1; received ${received.toFixed(2)}:1`,
      );
    });
  }
  if (routeCase.requiresMinimalGroupsSurface) {
    assert.equal(
      reportedSurfaceState.hasLegacyListHeading,
      false,
      'Groups should not restore the redundant list heading',
    );
    assert.equal(reportedSurfaceState.refreshHasIcon, true, 'Groups refresh should remain an icon control');
    assert.equal(reportedSurfaceState.refreshText, '', 'Groups refresh should not restore a visible text label');
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
  if (classicRecognitionLogoState && currentRecognitionLogoState) {
    assert.equal(
      /^(?:rgba\(0, 0, 0, 0\)|color\(srgb 0 0 0 \/ 0\))$/.test(classicRecognitionLogoState.backgroundColor),
      true,
      `Classic 95 recognition logos should expose their transparent image regions; received ${classicRecognitionLogoState.backgroundColor}`,
    );
    assert.equal(
      /^(?:rgba\(0, 0, 0, 0\)|color\(srgb 0 0 0 \/ 0\))$/.test(classicRecognitionLogoState.borderColor),
      true,
      `Classic 95 recognition logos should not retain a blue tile border; received ${classicRecognitionLogoState.borderColor}`,
    );
    assert.notEqual(
      currentRecognitionLogoState.backgroundColor,
      'rgba(0, 0, 0, 0)',
      'Context Engine recognition logos should preserve their existing backing',
    );
    assert.notEqual(
      currentRecognitionLogoState.borderColor,
      'rgba(0, 0, 0, 0)',
      'Context Engine recognition logos should preserve their existing border',
    );
  }
}

async function assertWelcomeFitsViewport(browser, baseUrl, viewport) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  try {
    await page.addInitScript(() => {
      window.localStorage.setItem('ce:firstVisitRootAboutRedirectConsumed:v20260618b', 'true');
      window.localStorage.setItem('ce_onboarding_complete', 'true');
      window.localStorage.setItem('firstVisit', 'false');
      window.localStorage.setItem('ce:theme', 'classic-95');
      window.localStorage.setItem('ce:primarySessionSlug', 'demo-sh');
      window.localStorage.setItem('ce:selectedSessionScope', 'active');
    });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#root', { state: 'attached', timeout: 15000 });
    await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, null, { timeout: 15000 });
    const welcomeLink = page.locator('.nav-tabs .nav-link').filter({ hasText: /^\s*Welcome\s*$/i });
    await welcomeLink.waitFor({ state: 'visible', timeout: 30000 });
    await welcomeLink.click();
    await page.getByTestId('ce-welcome-slide-media').waitFor({ state: 'visible' });
    const nextSlideButton = page.locator('[class*="onboardingControls"] > button[class*="takeSurveyButton"]');
    const slideFits = [];
    for (let slideIndex = 0; slideIndex < WELCOME_SLIDE_KEYS.length; slideIndex += 1) {
      const expectedSlideKey = WELCOME_SLIDE_KEYS[slideIndex];
      await page.waitForFunction(
        (slideKey) => document.querySelector('[data-testid="ce-welcome-slide-media"]')?.dataset.slideKey === slideKey,
        expectedSlideKey,
      );
      slideFits.push(
        await page.evaluate(() => {
          const footer = document.querySelector('footer');
          const walkthrough = document.querySelector('[class*="onboardingWalkthrough"]');
          const info = walkthrough?.querySelector(':scope > [class*="onboardingInfo"]');
          const controls = walkthrough?.querySelector(':scope > [class*="onboardingControls"]');
          const title = info?.querySelector('[class*="onboardingTitle"]');
          const slideLayout = info?.querySelector('[class*="welcomeSlideLayout"]');
          const slideImage = info?.querySelector('[data-testid="ce-welcome-slide-image"]');
          const slideKey = info?.querySelector('[data-testid="ce-welcome-slide-media"]')?.dataset.slideKey || '';
          const rect = (element) => element?.getBoundingClientRect() || null;
          const footerBottom = footer?.getBoundingClientRect().bottom || 0;
          return {
            slideKey,
            clientHeight: document.documentElement.clientHeight,
            footerBottom,
            scrollHeight: document.documentElement.scrollHeight,
            walkthrough: rect(walkthrough),
            info: rect(info),
            controls: rect(controls),
            title: rect(title),
            slideLayout: rect(slideLayout),
            slideImage: rect(slideImage),
          };
        }),
      );
      if (slideIndex < WELCOME_SLIDE_KEYS.length - 1) await nextSlideButton.click();
    }

    const firstFit = slideFits[0];
    slideFits.forEach((fit) => {
      const slideLabel = `${viewport.name} ${fit.slideKey} welcome slide`;
      assert.ok(
        fit.footerBottom <= fit.clientHeight + 1 && fit.scrollHeight <= fit.clientHeight + 1,
        `${slideLabel} should fit the viewport; received footer bottom ${fit.footerBottom.toFixed(1)}px, scroll height ${fit.scrollHeight}px, viewport ${fit.clientHeight}px`,
      );
      assert.ok(fit.walkthrough && fit.info && fit.controls, `${slideLabel} geometry should render`);
      assert.ok(
        fit.info.top >= fit.walkthrough.top - 1 && fit.info.bottom <= fit.controls.top + 1,
        `${slideLabel} content should remain above its controls`,
      );
      assert.ok(
        fit.controls.left <= fit.walkthrough.left + 1 && fit.controls.right >= fit.walkthrough.right - 1,
        `${slideLabel} controls should span the bottom edge`,
      );
      assert.ok(
        Math.abs(fit.walkthrough.height - firstFit.walkthrough.height) <= 1 &&
          Math.abs(fit.controls.top - firstFit.controls.top) <= 1 &&
          Math.abs(fit.controls.height - firstFit.controls.height) <= 1,
        `${slideLabel} should keep the same window and arrow-strip geometry as the first slide`,
      );
      if (fit.title && fit.slideLayout) {
        assert.ok(
          fit.title.bottom <= fit.slideLayout.top + 1,
          `${slideLabel} title should not overlap the slide artwork`,
        );
      }
      if (fit.slideImage && fit.slideLayout) {
        assert.ok(
          fit.slideImage.top >= fit.slideLayout.top - 1 && fit.slideImage.bottom <= fit.slideLayout.bottom + 1,
          `${slideLabel} artwork should remain inside its slide panel`,
        );
      }
    });
  } finally {
    await page.close();
  }
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.env.BASE_URL || 'http://127.0.0.1:3000');
  const welcomeFitOnly = process.env.WELCOME_FIT_ONLY === '1' || process.argv.includes('--welcome-fit-only');
  const homeTabsOnly = process.argv.includes('--home-tabs-only');
  const questionUtilitiesOnly = process.argv.includes('--question-utilities-only');
  const statsOnly = process.argv.includes('--stats-only');
  const sessionOnly = process.argv.includes('--session-only');
  const sessionSetupOnly = process.argv.includes('--session-setup-only');
  const footerOnly = process.argv.includes('--footer-only');
  const toolCardsOnly = process.argv.includes('--tool-cards-only');
  const routeCases = homeTabsOnly
    ? ROUTE_CASES.filter((routeCase) => routeCase.requiresSpreadHomeTabs)
    : questionUtilitiesOnly
      ? ROUTE_CASES.filter((routeCase) => routeCase.requiresReadableQuestionUtilities)
      : statsOnly
        ? ROUTE_CASES.filter((routeCase) => routeCase.requiresReadableStats)
        : sessionOnly
          ? ROUTE_CASES.filter((routeCase) => routeCase.requiresReadableSessionSurface)
          : sessionSetupOnly
            ? ROUTE_CASES.filter((routeCase) => routeCase.requiresReadableSessionSetup)
            : footerOnly
              ? ROUTE_CASES.filter((routeCase) => routeCase.requiresFooterButtons)
              : toolCardsOnly
                ? ROUTE_CASES.filter((routeCase) => routeCase.requiresStandardToolCards)
                : ROUTE_CASES;
  const viewports = toolCardsOnly
    ? TOOL_CARD_VIEWPORTS
    : homeTabsOnly
      ? HOME_TAB_VIEWPORTS
        : footerOnly
          ? FOOTER_VIEWPORTS
          : sessionOnly
            ? SESSION_SURFACE_VIEWPORTS
            : sessionSetupOnly
              ? SESSION_SETUP_VIEWPORTS
              : VIEWPORTS;
  const browser = await chromium.launch({ headless: true });

  try {
    if (!welcomeFitOnly) {
      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
        await page.addInitScript(() => {
          window.localStorage.setItem('ce:firstVisitRootAboutRedirectConsumed:v20260618b', 'true');
          window.localStorage.setItem('ce_onboarding_complete', 'true');
          window.localStorage.setItem('firstVisit', 'false');
          window.localStorage.setItem('ce:theme', 'classic-95');
          window.localStorage.setItem('ce:primarySessionSlug', 'demo-sh');
          window.localStorage.setItem('ce:selectedSessionScope', 'active');
        });
        for (const routeCase of routeCases) {
          await inspectRoute(page, baseUrl, routeCase, viewport.name);
        }
        await page.close();
      }
    }
    if (
      !homeTabsOnly &&
      !questionUtilitiesOnly &&
      !statsOnly &&
      !sessionOnly &&
      !sessionSetupOnly &&
      !footerOnly &&
      !toolCardsOnly
    ) {
      for (const viewport of WELCOME_FIT_VIEWPORTS) {
        await assertWelcomeFitsViewport(browser, baseUrl, viewport);
      }
    }
    console.log(
      welcomeFitOnly
        ? `Welcome fit Playwright smoke passed (${WELCOME_FIT_VIEWPORTS.length} viewports).`
        : homeTabsOnly
          ? `Classic 95 home tab-spacing Playwright smoke passed (${viewports.length} viewports).`
          : questionUtilitiesOnly
            ? `Classic 95 question utility-control Playwright smoke passed (${VIEWPORTS.length} viewports).`
            : statsOnly
              ? `Classic 95 Community Stats Playwright smoke passed (${VIEWPORTS.length} viewports).`
              : sessionOnly
                ? `Classic 95 session-surface Playwright smoke passed (${viewports.length} viewports).`
                : sessionSetupOnly
                  ? `Classic 95 Session Setup Playwright smoke passed (${viewports.length} viewports).`
                  : footerOnly
                    ? `Classic 95 footer Playwright smoke passed (${viewports.length} viewports).`
                    : toolCardsOnly
                      ? `Classic 95 tool-card Playwright smoke passed (${viewports.length} viewports).`
                      : `App theme runtime Playwright smoke passed (${routeCases.length} routes × ${VIEWPORTS.length} viewports).`,
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
