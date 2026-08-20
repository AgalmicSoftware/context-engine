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
    requiresClassicAboutHeroControls: true,
    requiresFooterBelowFold: true,
    requiresFooterButtons: true,
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
  {
    path: '/session/demo-sh',
    label: 'tag related-chip surface',
    requiresReadableTagRelatedChips: true,
  },
  { path: '/demos', label: 'demo surface' },
  {
    path: '/session/demo-sh',
    label: 'session question surface',
    requiresDocumentEndFooter: true,
    requiresReadableSessionSurface: true,
  },
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

const FEEDBACK_COMPACT_VIEWPORT = Object.freeze({ name: 'feedback compact', width: 630, height: 803 });
const SESSION_BACK_FEEDBACK_VIEWPORT = Object.freeze({ name: 'session back feedback', width: 735, height: 803 });
const AUTHORING_FEEDBACK_VIEWPORT = Object.freeze({ name: 'authoring feedback', width: 735, height: 803 });
const LOGIN_FEEDBACK_VIEWPORT = Object.freeze({ name: 'login feedback', width: 735, height: 803 });
const DOCS_FEEDBACK_VIEWPORT = Object.freeze({ name: 'docs feedback', width: 735, height: 803 });

const FOOTER_VIEWPORTS = Object.freeze([
  ...VIEWPORTS,
  FEEDBACK_COMPACT_VIEWPORT,
  { name: 'compact window', width: 765, height: 799 },
]);

const SESSION_SURFACE_VIEWPORTS = Object.freeze([
  ...VIEWPORTS,
  FEEDBACK_COMPACT_VIEWPORT,
  SESSION_BACK_FEEDBACK_VIEWPORT,
  { name: 'compact window', width: 765, height: 799 },
]);

const SESSION_SETUP_VIEWPORTS = Object.freeze([...VIEWPORTS, { name: 'compact window', width: 765, height: 799 }]);
const AUTHORING_VIEWPORTS = Object.freeze([...VIEWPORTS, AUTHORING_FEEDBACK_VIEWPORT]);
const LOGIN_VIEWPORTS = Object.freeze([...VIEWPORTS, LOGIN_FEEDBACK_VIEWPORT]);
const DOCS_VIEWPORTS = Object.freeze([...VIEWPORTS, DOCS_FEEDBACK_VIEWPORT]);
const TAG_VIEWPORTS = Object.freeze([...VIEWPORTS, { name: 'tag feedback', width: 735, height: 802 }]);

const WELCOME_FIT_VIEWPORTS = Object.freeze([
  { name: 'feedback compact window', width: 735, height: 803 },
  { name: 'compact window', width: 765, height: 799 },
  { name: 'compact desktop', width: 1280, height: 720 },
  { name: 'wide desktop', width: 1904, height: 900 },
  { name: 'ultra-wide short desktop', width: 2048, height: 876 },
  { name: 'full-screen desktop', width: 2048, height: 1151 },
]);

const WELCOME_FIT_THEME_IDS = Object.freeze(['context-engine', 'classic-95']);

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
    tahomaLoaded: document.fonts.check('16px "CE Tahoma"'),
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
  if (routeCase.requiresReadableTagRelatedChips) {
    const tweets = page.getByRole('button', { name: 'Tweets', exact: true });
    const skipOnboarding = page.getByRole('button', { name: 'Skip', exact: true });
    const contextHeading = page.getByRole('heading', { name: 'Context View', exact: true });

    if (await skipOnboarding.isVisible()) await skipOnboarding.click();
    if (!(await tweets.isVisible())) {
      await contextHeading.waitFor({ state: 'visible', timeout: 60000 });
      await contextHeading.click();
    }
    await tweets.waitFor({ state: 'visible', timeout: 60000 });
    await tweets.click();
    await page.getByRole('button', { name: 'Google', exact: true }).first().click();
  }
  const readRelatedTagChipState = async () => {
    const chip = page.getByRole('button', { name: 'Add Anthropic tag to comparison', exact: true });
    await chip.waitFor({ state: 'visible', timeout: 60000 });
    return chip.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
        color: style.color,
      };
    });
  };
  if (routeCase.requiresFooterBelowFold) {
    await page.getByTestId('ce-page-about-root').waitFor({ state: 'visible', timeout: 15000 });
  }
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

  const readSessionSectionTypography = async () =>
    page.locator('div[class*="sectionsGrid"]').first().evaluate((grid) =>
      Array.from(grid.querySelectorAll('h2'))
        .map((heading) => {
          const title = heading.querySelector('[class*="sectionHeaderTitle"]');
          const subtitle = heading.querySelector('[class*="sectionHeaderSubtitle"]');
          if (!(title && subtitle)) return null;
          return {
            label: `${title.textContent?.trim() || ''} ${subtitle.textContent?.trim() || ''}`.trim(),
            subtitleFontSize: Number.parseFloat(window.getComputedStyle(subtitle).fontSize),
            titleFontSize: Number.parseFloat(window.getComputedStyle(title).fontSize),
          };
        })
        .filter(Boolean),
    );

  const readAuthoringSourceControlGeometry = async () =>
    page.getByPlaceholder('Add URL').evaluate((input) => {
      const surface = input.parentElement;
      const chooser = surface?.querySelector('[data-testid="ce-database-image-chooser"]');
      const paste = surface?.querySelector('[data-testid="ce-database-image-paste"]');
      const upload = surface?.querySelector('[data-testid="ce-database-image-upload"]');
      const add = surface?.querySelector('button[title="Add URL"]');
      const controls = [input, paste, upload, add].filter(Boolean);
      const rects = controls.map((element) => element.getBoundingClientRect());
      const surfaceRect = surface?.getBoundingClientRect();
      const centers = rects.map((rect) => rect.top + rect.height / 2);
      return {
        addIsLast: surface?.lastElementChild === add,
        chooserInsideSurface: chooser?.parentElement === surface,
        controlCount: controls.length,
        centerSpread: centers.length ? Math.max(...centers) - Math.min(...centers) : 0,
        overflows:
          !surfaceRect ||
          rects.some((rect) => rect.left < surfaceRect.left - 1 || rect.right > surfaceRect.right + 1) ||
          surface.scrollWidth > surface.clientWidth + 1,
        surfaceHeight: surfaceRect?.height || 0,
      };
    });

  const readLoginBackgroundState = async () =>
    page.locator('.modal-login .card').evaluate((card) => {
      const body = card.querySelector('.card-body');
      const cardStyle = window.getComputedStyle(card);
      const bodyStyle = body ? window.getComputedStyle(body) : null;
      return {
        bodyBackgroundImage: bodyStyle?.backgroundImage || '',
        cardBackgroundColor: cardStyle.backgroundColor,
        cardBackgroundImage: cardStyle.backgroundImage,
        overlayBackgroundImage: window.getComputedStyle(card, '::after').backgroundImage,
      };
    });

  const readPreloginSettingsControlLayout = async () =>
    page.getByTestId('ce-prelogin-settings-panel').evaluate((panel) => {
      const session = document.querySelector('[aria-label^="Active session:"]');
      const config = panel.querySelector('[data-testid="ce-prelogin-config-toggle"]');
      const explainers = Array.from(panel.querySelectorAll('button')).find((button) =>
        button.getAttribute('aria-label')?.startsWith('Explainers '),
      );
      const demo = Array.from(panel.querySelectorAll('button')).find((button) =>
        button.getAttribute('aria-label')?.startsWith('Demo Mode '),
      );
      const row = config?.parentElement;
      const controls = [config, explainers, demo].filter(Boolean);
      const rects = controls.map((element) => element.getBoundingClientRect());
      const units = Array.from(row?.children || []);
      const unitRects = units.map((element) => element.getBoundingClientRect());
      const centers = rects.map((rect) => rect.top + rect.height / 2);
      const rowRect = row?.getBoundingClientRect();
      const visualRows = unitRects.reduce((groups, rect) => {
        const group = groups.find((candidate) => Math.abs(candidate[0].top - rect.top) <= 2);
        if (group) group.push(rect);
        else groups.push([rect]);
        return groups;
      }, []);
      const rowCenter = rowRect ? rowRect.left + rowRect.width / 2 : 0;
      const panelRect = panel.getBoundingClientRect();
      const sessionRect = session?.getBoundingClientRect();
      const authActionBottom = Math.max(
        ...['ce-passkey-wallet-create', 'ce-passkey-wallet-sign-in'].map(
          (testId) => document.querySelector(`[data-testid="${testId}"]`)?.getBoundingClientRect().bottom || 0,
        ),
      );
      return {
        centerSpread: centers.length ? Math.max(...centers) - Math.min(...centers) : 0,
        controlCount: controls.length,
        controlWidths: rects.map((rect) => rect.width),
        contentOverflows: controls.some((element) => element.scrollWidth > element.clientWidth + 1),
        overflows:
          !rowRect || unitRects.some((rect) => rect.left < rowRect.left - 1 || rect.right > rowRect.right + 1),
        rowCenterOffsets: visualRows.map((group) => {
          const left = Math.min(...group.map((rect) => rect.left));
          const right = Math.max(...group.map((rect) => rect.right));
          return Math.abs((left + right) / 2 - rowCenter);
        }),
        rowClientWidth: row?.clientWidth || 0,
        rowCount: visualRows.length,
        rowScrollWidth: row?.scrollWidth || 0,
        sessionAbovePanel: Boolean(sessionRect && sessionRect.bottom <= panelRect.top + 1),
        sessionBelowAuthActions: Boolean(sessionRect && sessionRect.top >= authActionBottom - 1),
        sessionOutsidePanel: Boolean(session && !panel.contains(session)),
      };
    });

  const readAboutHeroControlState = async () =>
    page.getByTestId('ce-about-hero').evaluate((hero) => {
      const links = Array.from(hero.querySelectorAll('a'));
      const findLink = (text) => links.find((link) => link.textContent?.trim() === text);
      const readControl = (element) => {
        if (!element) return null;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          backgroundColor: style.backgroundColor,
          borderRadius: style.borderRadius,
          borderWidths: [
            style.borderTopWidth,
            style.borderRightWidth,
            style.borderBottomWidth,
            style.borderLeftWidth,
          ],
          boxShadow: style.boxShadow,
          color: style.color,
          fontFamily: style.fontFamily.toLowerCase(),
          height: rect.height,
          width: rect.width,
        };
      };
      return {
        heroFontFamily: window.getComputedStyle(hero).fontFamily.toLowerCase(),
        linkLabels: links.map((link) => link.textContent?.trim() || ''),
        demo: readControl(findLink('Demo')),
        github: readControl(
          links.find((link) => link.getAttribute('aria-label') === 'View Context Engine on GitHub'),
        ),
        newSession: readControl(findLink('New Session')),
        whitepaper: readControl(findLink('Whitepaper')),
      };
    });

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

  const footer = routeCase.requiresFooterButtons ? page.locator('footer') : null;
  const footerStartButton = routeCase.requiresFooterButtons ? page.getByTestId('ce-footer-start-button') : null;
  const footerStartMenu = routeCase.requiresFooterButtons ? page.getByTestId('ce-footer-start-menu') : null;
  const footerLink = routeCase.requiresFooterButtons ? page.getByRole('menuitem', { name: 'NEW', exact: true }) : null;
  let classicFooterInitialState = null;
  let classicFooterStartState = null;
  let classicFooterMenuState = null;
  if (footer && footerStartButton && footerStartMenu && footerLink) {
    await footer.waitFor({ state: 'attached' });
    await page.evaluate(() => window.scrollTo(0, 0));
    classicFooterInitialState = await footer.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        documentHeight: document.documentElement.scrollHeight,
        footerTop: rect.top,
        position: window.getComputedStyle(element).position,
        viewportHeight: window.innerHeight,
      };
    });
    assert.equal(await footerStartMenu.isHidden(), true, 'Classic 95 Start menu should begin closed');
    await footer.scrollIntoViewIfNeeded();
    await footerStartButton.waitFor({ state: 'visible' });
    classicFooterStartState = await footerStartButton.evaluate((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        ariaLabel: element.getAttribute('aria-label'),
        ariaExpanded: element.getAttribute('aria-expanded'),
        borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
        boxShadow: style.boxShadow,
        height: rect.height,
        left: rect.left,
        text: element.textContent?.trim() || '',
        width: rect.width,
      };
    });
    await footerStartButton.click();
    await footerStartMenu.waitFor({ state: 'visible' });
    await footerLink.waitFor({ state: 'visible' });
    classicFooterMenuState = await footerStartMenu.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const footerRect = element.closest('footer')?.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        footerTop: footerRect?.top || 0,
        left: rect.left,
      };
    });
  }
  const classicFooterLinkState = footerLink
    ? await footerLink.evaluate((element) => {
        const style = window.getComputedStyle(element);
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

  let classicReportClusterColors = null;
  let classicGroupLinkState = null;
  const sessionGroupsToggle = routeCase.requiresReadableSessionSurface
    ? page.getByTestId('ce-session-groups-toggle')
    : null;
  const sessionGroupLinkButton = routeCase.requiresReadableSessionSurface
    ? page.getByRole('button', { name: /^Copy .* group link$/ }).first()
    : null;
  if (routeCase.requiresReadableSessionSurface) {
    await page.getByText('Existential risk from AI justifies extraordinary precautions.', { exact: true }).waitFor({
      state: 'visible',
    });
    await page.getByTestId('ce-session-results-toggle').click();
    await page.waitForSelector('svg[class*="clusterSwatchSvg"] circle', { timeout: 15000 });
    classicReportClusterColors = await page
      .locator('svg[class*="clusterSwatchSvg"] circle')
      .evaluateAll((circles) => circles.map((circle) => circle.getAttribute('fill')));
    await sessionGroupsToggle.click();
    await sessionGroupLinkButton.waitFor({
      state: 'visible',
      timeout: 15000,
    });
    classicGroupLinkState = await sessionGroupLinkButton.evaluate((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        backgroundColor: style.backgroundColor,
        borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
        boxShadow: style.boxShadow,
        height: rect.height,
        width: rect.width,
      };
    });
    await sessionGroupsToggle.click();
  }

  const classicDocumentEndFooterState = routeCase.requiresDocumentEndFooter
    ? await page.locator('footer').evaluate((element) => {
        const style = window.getComputedStyle(element);
        const footerRect = element.getBoundingClientRect();
        const sections = document.querySelector('[class*="sectionsGrid"]');
        const sectionsRect = sections?.getBoundingClientRect();
        return {
          bodyPaddingBottom: window.getComputedStyle(document.body).paddingBottom,
          footerTop: footerRect.top,
          placement: element.getAttribute('data-ce-footer-placement'),
          position: style.position,
          sectionsBottom: sectionsRect?.bottom || 0,
        };
      })
    : null;

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

  if (routeCase.requiresPreloginControlLayout) {
    const sessionSummary = page.locator('[aria-label^="Active session:"]').first();
    await sessionSummary.waitFor({ state: 'visible' });
    assert.equal(
      await page.getByTestId('ce-prelogin-settings-panel').count(),
      0,
      'Session should render before the settings drawer opens',
    );
    await page.getByRole('button', { name: 'Toggle pre-login settings', exact: true }).click();
    await page.getByTestId('ce-prelogin-settings-panel').waitFor({ state: 'visible' });
  }

  if (routeCase.requiresPreloginThemeSettings) {
    const settingsPanel = page.getByTestId('ce-prelogin-settings-panel');
    if (!(await settingsPanel.isVisible())) {
      await page.getByRole('button', { name: 'Toggle pre-login settings', exact: true }).click();
    }
    await settingsPanel.waitFor({ state: 'visible' });
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
    const authoringTextInput = page.locator('textarea').first();
    const typesHeading = page.getByRole('heading', { name: 'Types', exact: true });
    const questionCount = page.getByTestId('ce-database-question-count-value');
    await authoringTextInput.waitFor({ state: 'visible' });
    await page.getByTestId('ce-database-image-paste').waitFor({ state: 'visible' });
    assert.equal(await typesHeading.count(), 0, 'Question types should stay hidden while the text box is empty');
    assert.equal(await questionCount.count(), 0, 'Question count should stay hidden while the text box is empty');
    await authoringTextInput.fill('Question configuration should appear after text is entered.');
    await typesHeading.waitFor({ state: 'visible' });
    await questionCount.waitFor({ state: 'visible' });
    await authoringTextInput.fill('   ');
    await page.waitForFunction(
      () =>
        !Array.from(document.querySelectorAll('h3')).some((heading) => heading.textContent?.trim() === 'Types') &&
        !document.querySelector('[data-testid="ce-database-question-count-value"]'),
    );
    await authoringTextInput.fill('Question configuration should return when text is entered again.');
    await typesHeading.waitFor({ state: 'visible' });
    await questionCount.waitFor({ state: 'visible' });
  }

  let classicRatingInteractionState = null;
  if (routeCase.requiresReadableQuestionUtilities) {
    await page.getByText('Questions', { exact: true }).click();
    await page.getByRole('button', { name: 'Conviction / importance' }).first().waitFor({ state: 'visible' });
    await page.getByTestId('ce-survey-additional-toggle').first().waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Show question tags' }).first().waitFor({ state: 'visible' });
    await page
      .locator('button[title="Bookmark Question"], button[title="Remove Bookmark"]')
      .first()
      .waitFor({ state: 'visible' });

  }

  const classicPileControlState = routeCase.requiresReadableSessionSurface
    ? await (async () => {
        const footerIcons = await page.locator('[class*="pileCardFooter"] button').evaluateAll((buttons) =>
          buttons.map((button) => {
            const style = window.getComputedStyle(button);
            return {
              ariaLabel: button.getAttribute('aria-label') || '',
              opacity: Number(style.opacity),
            };
          }),
        );
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
        return { conviction, footerIcons, lockAudience };
      })()
    : null;

  await page.evaluate(async () => {
    await document.fonts.load('16px "CE Tahoma"');
    await document.fonts.ready;
  });
  const classic = await page.evaluate(readThemeState);
  const classicAboutHeroControlState = routeCase.requiresClassicAboutHeroControls
    ? await readAboutHeroControlState()
    : null;
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
  const classicQuestionIconFamilyState = routeCase.requiresReadableQuestionUtilities
    ? await Promise.all(
        [
          ['comment', page.getByTestId('ce-survey-additional-toggle').first()],
          ['hashtag', page.getByRole('button', { name: 'Show question tags' }).first()],
          [
            'bookmark',
            page.locator('button[title="Bookmark Question"], button[title="Remove Bookmark"]').first(),
          ],
        ].map(async ([label, locator]) => ({
          label,
          ...(await locator.evaluate((element) => {
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
              opacity: Number.parseFloat(style.opacity),
            };
          })),
        })),
      )
    : null;
  let classicFullQuestionConvictionState = null;
  let classicFullQuestionLockAudienceState = null;
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
    await questionUtilityButton.click();
    const sliderPanel = page.locator('[class*="fullQuestionFooter"] [class*="importanceSlider"]').first();
    await sliderPanel.waitFor({ state: 'visible' });
    classicFullQuestionConvictionState = await sliderPanel.evaluate((element) => {
      const style = window.getComputedStyle(element);
      const label = element.querySelector('[class*="importanceText"]');
      const toggleLine = element.querySelector('[class*="convictionToggleLine"]');
      const slider = element.querySelector('[class*="convictionSlider"]');
      const labelStyle = label ? window.getComputedStyle(label) : null;
      const toggleLineStyle = toggleLine ? window.getComputedStyle(toggleLine) : null;
      const sliderStyle = slider ? window.getComputedStyle(slider) : null;
      const sliderRect = slider?.getBoundingClientRect();
      return {
        backgroundColor: style.backgroundColor,
        borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
        boxShadow: style.boxShadow,
        opacity: Number.parseFloat(style.opacity),
        labelColor: labelStyle?.color || '',
        labelOpacity: Number.parseFloat(labelStyle?.opacity || '0'),
        toggleLineBackground: toggleLineStyle?.backgroundColor || '',
        toggleLineBorderWidths: toggleLineStyle
          ? [
              toggleLineStyle.borderTopWidth,
              toggleLineStyle.borderRightWidth,
              toggleLineStyle.borderBottomWidth,
              toggleLineStyle.borderLeftWidth,
            ]
          : [],
        toggleLineBoxShadow: toggleLineStyle?.boxShadow || '',
        toggleLineColor: toggleLineStyle?.color || '',
        toggleLineOpacity: Number.parseFloat(toggleLineStyle?.opacity || '0'),
        sliderBackground: sliderStyle?.backgroundColor || '',
        sliderHeight: sliderRect?.height || 0,
        sliderOpacity: Number.parseFloat(sliderStyle?.opacity || '0'),
        sliderWidth: sliderRect?.width || 0,
      };
    });

    const fullQuestionLockButton = page.getByTestId('ce-survey-answer-lock').first();
    await fullQuestionLockButton.click();
    const onlyMeButton = page.getByTestId('ce-survey-lock-audience-self').first();
    await onlyMeButton.waitFor({ state: 'visible' });
    classicFullQuestionLockAudienceState = await onlyMeButton.evaluate((element) => {
      const style = window.getComputedStyle(element);
      const popover = element.closest('[class*="lockAudiencePopover"]');
      const popoverStyle = popover ? window.getComputedStyle(popover) : null;
      return {
        backgroundColor: style.backgroundColor,
        borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
        boxShadow: style.boxShadow,
        color: style.color,
        opacity: Number.parseFloat(style.opacity),
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
    await fullQuestionLockButton.click();
  }
  let classicQuestionFilterState = null;
  if (routeCase.requiresReadableQuestionUtilities) {
    await page.getByTestId('ce-survey-filter-toggle').first().click();
    const filterModal = page.getByTestId('ce-question-filter-modal');
    await filterModal.waitFor({ state: 'visible' });
    const firstTag = filterModal.locator('button[class*="tagBubble"][aria-pressed="false"]').first();
    await firstTag.waitFor({ state: 'visible' });
    const readControlState = (locator) =>
      locator.evaluate((element) => {
        const style = window.getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
          boxShadow: style.boxShadow,
          color: style.color,
          className: element.className,
          outlineStyle: style.outlineStyle,
        };
      });
    const header = filterModal.locator('.modal-header').first();
    const title = filterModal.locator('.modal-title').first();
    const applyButton = filterModal.getByRole('button', { name: 'See Questions' });
    const closeButton = filterModal.locator('.modal-header button').first();
    const firstTagLabel = (await firstTag.textContent())?.trim() || '';
    const tagResting = await readControlState(firstTag);
    await firstTag.focus();
    const tagFocused = await readControlState(firstTag);
    await firstTag.click();
    const selectedTag = filterModal.getByRole('button', { name: firstTagLabel, exact: true });
    await selectedTag.waitFor({ state: 'visible' });
    await page.waitForFunction(
      ({ modalTestId, tagLabel }) =>
        Array.from(document.querySelectorAll(`[data-testid="${modalTestId}"] button`)).some(
          (button) => button.textContent?.trim() === tagLabel && button.getAttribute('aria-pressed') === 'true',
        ),
      { modalTestId: 'ce-question-filter-modal', tagLabel: firstTagLabel },
    );
    const tagSelected = await readControlState(selectedTag);
    classicQuestionFilterState = {
      headerBackground: await header.evaluate((element) => window.getComputedStyle(element).backgroundColor),
      titleColor: await title.evaluate((element) => window.getComputedStyle(element).color),
      tagResting,
      tagFocused,
      tagSelected,
      applyButton: await readControlState(applyButton),
      closeButton: await readControlState(closeButton),
    };
    await closeButton.click();
    await filterModal.waitFor({ state: 'hidden' });
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
    const homeRouteRoot = document.querySelector('[data-testid="ce-page-home-root"]');
    const homeWindow = homeTabs?.closest('.card');
    const homeRouteRootRect = homeRouteRoot?.getBoundingClientRect();
    const homeWindowRect = homeWindow?.getBoundingClientRect();
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
      homeWindowTopGap:
        homeRouteRootRect && homeWindowRect ? Math.max(0, homeWindowRect.top - homeRouteRootRect.top) : null,
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
          sample('Docs GitHub link', '[data-testid="ce-docs-github-link"]'),
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
  const docsLayoutState = routeCase.requiresReadableDocs
    ? await page.evaluate(() => {
        const root = document.querySelector('[data-testid="ce-page-docs-root"]');
        const prompts = root?.querySelector('button[aria-controls="docs-section-prompts"]');
        const faq = root?.querySelector('button[aria-controls="docs-section-faq"]');
        const group = root?.querySelector('[data-testid="ce-docs-session-contracts-group"]');
        const session = root?.querySelector('[data-testid="ce-docs-session-context"]');
        const contracts = root?.querySelector('[data-testid="ce-contract-viewer-toggle"]');
        const heading = root?.querySelector('header h1');
        const githubLink = root?.querySelector('[data-testid="ce-docs-github-link"]');
        const loginButton = document.querySelector('[data-testid="ce-account-login-button"]');
        const loginPrompt = loginButton?.querySelector('h1');
        const groupStyle = group ? window.getComputedStyle(group) : null;
        return {
          hasAdvancedExternalNotice: Boolean(
            root?.querySelector('[data-testid="ce-contracts-advanced-external-notice"]'),
          ),
          promptsTop: prompts?.getBoundingClientRect().top ?? null,
          faqTop: faq?.getBoundingClientRect().top ?? null,
          groupTop: group?.getBoundingClientRect().top ?? null,
          groupContainsSession: Boolean(group && session && group.contains(session)),
          groupContainsContracts: Boolean(group && contracts && group.contains(contracts)),
          groupIsLast: root?.lastElementChild === group,
          githubHref: githubLink?.href ?? '',
          githubTarget: githubLink?.getAttribute('target') ?? '',
          githubHasIcon: Boolean(githubLink?.querySelector('svg')),
          githubSharesTitleRow: Boolean(heading && githubLink && heading.parentElement === githubLink.parentElement),
          loginIdleIconCount: loginButton?.querySelectorAll('svg').length ?? -1,
          loginFontFamily: loginPrompt ? window.getComputedStyle(loginPrompt).fontFamily : '',
          groupBorderWidths: groupStyle
            ? [
                groupStyle.borderTopWidth,
                groupStyle.borderRightWidth,
                groupStyle.borderBottomWidth,
                groupStyle.borderLeftWidth,
              ]
            : [],
        };
      })
    : null;
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
  const classicLoginBackgroundState = routeCase.requiresReadableLogin ? await readLoginBackgroundState() : null;
  const classicPreloginSettingsControlLayout = routeCase.requiresPreloginControlLayout
    ? await readPreloginSettingsControlLayout()
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
        const sections = Array.from(panel?.querySelectorAll('[class*="settingsSectionCard"]') || []);
        const appearanceSection = selector?.closest('[class*="settingsSectionCard"]');
        const summary = appearanceSection?.querySelector('[class*="settingsSectionSummary"]');
        const resourceCards = Array.from(panel?.querySelectorAll('[class*="supportedResourceCard"]') || []);
        const aiCard = resourceCards.find(
          (candidate) => candidate.querySelector('[class*="supportedResourceName"]')?.textContent?.trim() === 'AI',
        );
        const activeSessionPill = aiCard?.querySelector('[class*="sessionPillActive"]');
        const sponsorDetail = aiCard?.querySelector('[class*="supportedResourceDetail"]');
        if (!panel || !selector || !appearanceSection || !aiCard || !activeSessionPill || !sponsorDetail) {
          return { missing: true };
        }
        const selectorStyle = window.getComputedStyle(selector);
        return {
          activeSessionPillText: activeSessionPill.textContent?.trim() || '',
          accessibleName: selector.getAttribute('aria-label'),
          defaultOptionText: selector.querySelector('option[value=""]')?.textContent?.trim() || '',
          hasVisibleHint: appearanceSection.textContent?.includes('Changes the complete app appearance') || false,
          hasVisibleLabel: Array.from(appearanceSection.querySelectorAll('*')).some(
            (element) => element.childElementCount === 0 && element.textContent?.trim() === 'App theme',
          ),
          hasVisibleSummary: !!summary,
          isFinalSection: sections.at(-1) === appearanceSection,
          selectorRatio: ratio(selectorStyle.color, backgroundFor(selector)),
          sponsorDetailInsideActivePill: activeSessionPill.contains(sponsorDetail),
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
        const beeswarmSection = document.querySelector('[data-testid="ce-community-beeswarm-section"]');
        const beeswarmSectionRect = beeswarmSection?.getBoundingClientRect();
        const svg = document.querySelector('[data-testid="ce-community-beeswarm-section"] svg');
        const svgRect = svg?.getBoundingClientRect();
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
          beeswarmVerticalDelta:
            beeswarmSectionRect && svgRect
              ? Math.abs(
                  (svgRect.top - beeswarmSectionRect.top) -
                    (beeswarmSectionRect.bottom - svgRect.bottom),
                )
              : Number.POSITIVE_INFINITY,
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
            ['content input', 'textarea[class*="audioTextarea"]'],
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
  const classicAuthoringSourceControlGeometry = routeCase.requiresReadableAuthoring
    ? await readAuthoringSourceControlGeometry()
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
              const actionMenuToggle = document.querySelector('button[aria-label="Question actions"]');
              const pileActions = actionMenuToggle?.parentElement;
              const actionButtonGroup = pileActions?.querySelector('[class*="pileActionButtonGroup"]');
              const pileControls = pileActions?.parentElement;
              const pileNav = pileControls?.querySelector('[class*="pileNav"]');
              const sectionsGrid = document.querySelector('[class*="sectionsGrid"]');
              const expandedSection = sectionsGrid?.querySelector('[class*="sectionExpanded"]');
              const expandedHeaderRow = expandedSection?.querySelector('[class*="sectionHeaderRow"]');
              const expandedHeader = expandedHeaderRow?.querySelector('h2');
              const expandedActionsScroller = expandedHeaderRow?.querySelector(
                '[class*="sectionHeaderActionsScroller"]',
              );
              const expandedActions = expandedActionsScroller?.querySelector('[class*="sectionHeaderActions"]');
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
                promptFontFamily: (() => {
                  const prompt = document.querySelector('[class*="pileCardHeader"] h4');
                  return prompt ? window.getComputedStyle(prompt).fontFamily.toLowerCase() : '';
                })(),
                promptFontWeight: (() => {
                  const prompt = document.querySelector('[class*="pileCardHeader"] h4');
                  return prompt ? window.getComputedStyle(prompt).fontWeight : '';
                })(),
                promptRatio: textRatio('[class*="pileCardHeader"] h4'),
                sessionTitleRatio: textRatio('[class*="brandingSectionTitle"]'),
                sectionTitleRatio: textRatio('[class*="sectionHeaderTitle"]'),
                compactControls: {
                  viewportWidth: window.innerWidth,
                  actionMenuToggleDisplay: actionMenuToggle
                    ? window.getComputedStyle(actionMenuToggle).display
                    : '',
                  actionGroupDisplay: actionButtonGroup ? window.getComputedStyle(actionButtonGroup).display : '',
                  actionGroupPosition: actionButtonGroup ? window.getComputedStyle(actionButtonGroup).position : '',
                  actionGroupDirection: actionButtonGroup
                    ? window.getComputedStyle(actionButtonGroup).flexDirection
                    : '',
                  actionsBackground: pileActions ? window.getComputedStyle(pileActions).backgroundColor : '',
                  actionsBorderWidth: pileActions ? window.getComputedStyle(pileActions).borderTopWidth : '',
                  actionsBoxShadow: pileActions ? window.getComputedStyle(pileActions).boxShadow : '',
                  navBackground: pileNav ? window.getComputedStyle(pileNav).backgroundColor : '',
                  navBorderWidth: pileNav ? window.getComputedStyle(pileNav).borderTopWidth : '',
                  navBoxShadow: pileNav ? window.getComputedStyle(pileNav).boxShadow : '',
                  controlsBottom: pileControls?.getBoundingClientRect().bottom || 0,
                  panelsTop: sectionsGrid?.getBoundingClientRect().top || 0,
                  expandedHeaderLayout:
                    expandedHeaderRow && expandedHeader && expandedActionsScroller && expandedActions
                      ? {
                          rowHeight: expandedHeaderRow.getBoundingClientRect().height,
                          headerTop: expandedHeader.getBoundingClientRect().top,
                          actionsTop: expandedActionsScroller.getBoundingClientRect().top,
                          actionsDisplay: window.getComputedStyle(expandedActions).display,
                          actionsOverflowX: window.getComputedStyle(expandedActionsScroller).overflowX,
                        }
                      : null,
                  panelBounds: sectionsGrid
                    ? Array.from(sectionsGrid.children).map((panel) => {
                        const rect = panel.getBoundingClientRect();
                        return { left: rect.left, right: rect.right };
                      })
                    : [],
                  sectionHeaders: sectionsGrid
                    ? Array.from(sectionsGrid.children)
                        .map((panel) => {
                          const caret = panel.querySelector('[class*="sectionToggleIcon"]');
                          const title = panel.querySelector('[class*="sectionHeaderTitle"]');
                          const subtitle = panel.querySelector('[class*="sectionHeaderSubtitle"]');
                          if (!(caret && title && subtitle)) return null;
                          const caretRect = caret.getBoundingClientRect();
                          const titleRect = title.getBoundingClientRect();
                          const subtitleRect = subtitle.getBoundingClientRect();
                          const caretStyle = window.getComputedStyle(caret);
                          const titleStyle = window.getComputedStyle(title);
                          const subtitleStyle = window.getComputedStyle(subtitle);
                          return {
                            caretTop: caretRect.top,
                            caretOpacity: Number(caretStyle.opacity),
                            titleTop: titleRect.top,
                            titleBottom: titleRect.bottom,
                            titleLeft: titleRect.left,
                            titleFontSize: titleStyle.fontSize,
                            subtitleTop: subtitleRect.top,
                            subtitleLeft: subtitleRect.left,
                            subtitleFontSize: subtitleStyle.fontSize,
                            subtitleOpacity: Number(subtitleStyle.opacity),
                            titleOpacity: Number(titleStyle.opacity),
                          };
                        })
                        .filter(Boolean)
                    : [],
                  actionButtons: actionButtonGroup
                    ? Array.from(actionButtonGroup.querySelectorAll('button')).map((button) => {
                        const rect = button.getBoundingClientRect();
                        const style = window.getComputedStyle(button);
                        return {
                          display: style.display,
                          color: style.color,
                          height: rect.height,
                          opacity: Number(style.opacity),
                          pointerEvents: style.pointerEvents,
                          width: rect.width,
                        };
                      })
                    : [],
                  navButtons: pileNav
                    ? Array.from(pileNav.querySelectorAll('button')).map((button) => {
                        const rect = button.getBoundingClientRect();
                        const style = window.getComputedStyle(button);
                        return {
                          color: style.color,
                          height: rect.height,
                          opacity: Number(style.opacity),
                          width: rect.width,
                        };
                      })
                    : [],
                  railButtons: [...(actionButtonGroup?.querySelectorAll('button') || []), ...(pileNav?.querySelectorAll('button') || [])].map(
                    (button) => {
                      const rect = button.getBoundingClientRect();
                      const style = window.getComputedStyle(button);
                      return {
                        color: style.color,
                        fontSize: Number.parseFloat(style.fontSize),
                        height: rect.height,
                        opacity: Number(style.opacity),
                        width: rect.width,
                      };
                    },
                  ),
                },
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

      const ratingPromptText = "How optimistic are you about AI's impact on humanity? (1-10)";
      const ratingCard = page
        .getByText(ratingPromptText, { exact: true })
        .locator('xpath=ancestor::div[contains(@class, "fullQuestionCard")]')
        .first();
      await ratingCard.waitFor({ state: 'visible', timeout: 60000 });
      const ratingSlider = ratingCard.locator('input[type="range"]').first();
      await ratingSlider.scrollIntoViewIfNeeded();
      await ratingSlider.waitFor({ state: 'visible' });
      const initialValue = Number(await ratingSlider.inputValue());
      await ratingSlider.evaluate((element) => element.setAttribute('data-ce-runtime-rating-probe', 'true'));
      const sliderBounds = await ratingSlider.boundingBox();
      assert.ok(sliderBounds && sliderBounds.width > 0, 'Full-question rating slider should have draggable geometry');
      const dragFrom = initialValue >= 7 ? 0.8 : 0.2;
      const dragTo = initialValue >= 7 ? 0.2 : 0.8;
      await page.mouse.move(sliderBounds.x + sliderBounds.width * dragFrom, sliderBounds.y + sliderBounds.height / 2);
      await page.mouse.down();
      await page.mouse.move(sliderBounds.x + sliderBounds.width * dragTo, sliderBounds.y + sliderBounds.height / 2, {
        steps: 12,
      });
      await page.waitForFunction(
        (initial) => {
          const slider = document.querySelector('[data-ce-runtime-rating-probe="true"]');
          return slider instanceof HTMLInputElement && Number(slider.value) !== initial;
        },
        initialValue,
      );
      const liveValue = Number(await ratingSlider.inputValue());
      const liveLabel = Number(await ratingCard.locator('[class*="ratingLabelText"]').textContent());
      await page.mouse.up();
      classicRatingInteractionState = {
        initialValue,
        liveLabel,
        liveValue,
        committedValue: Number(await ratingSlider.inputValue()),
      };

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
  const classicRelatedTagChipState = routeCase.requiresReadableTagRelatedChips
    ? await readRelatedTagChipState()
    : null;

  await page.evaluate(() => {
    document.documentElement.dataset.ceTheme = 'context-engine';
    window.dispatchEvent(new CustomEvent('ce:theme-change', { detail: { id: 'context-engine', source: 'user' } }));
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const current = await page.evaluate(readThemeState);
  const currentLoginBackgroundState = routeCase.requiresReadableLogin ? await readLoginBackgroundState() : null;
  const currentPreloginSettingsControlLayout = routeCase.requiresPreloginControlLayout
    ? await readPreloginSettingsControlLayout()
    : null;
  const currentAboutHeroControlState = routeCase.requiresClassicAboutHeroControls
    ? await readAboutHeroControlState()
    : null;
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
  const currentFooterLink = routeCase.requiresFooterButtons
    ? page.getByRole('link', { name: 'NEW', exact: true })
    : null;
  if (currentFooterLink) await currentFooterLink.waitFor({ state: 'visible' });
  const currentFooterLinkState = currentFooterLink
    ? await currentFooterLink.evaluate((element) => {
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
  const currentFooterLayoutState = footerStartMenu
    ? await footerStartMenu.evaluate((element) => {
        const menuRect = element.getBoundingClientRect();
        const links = Array.from(element.querySelectorAll('a'));
        const linkRects = links.map((link) => link.getBoundingClientRect());
        const tops = linkRects.map((rect) => rect.top);
        return {
          fontSizes: links.map((link) => Number.parseFloat(window.getComputedStyle(link).fontSize)),
          linkCount: links.length,
          linkOverflows: links.map((link) => link.scrollWidth > link.clientWidth + 1),
          menuOverflows: element.scrollWidth > element.clientWidth + 1,
          outsideMenu: linkRects.some((rect) => rect.left < menuRect.left - 1 || rect.right > menuRect.right + 1),
          topSpread: tops.length ? Math.max(...tops) - Math.min(...tops) : 0,
        };
      })
    : null;
  const currentFooterControlState = footerStartButton && footerStartMenu
    ? {
        menuVisible: await footerStartMenu.isVisible(),
        startVisible: await footerStartButton.isVisible(),
      }
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
  const currentSessionSectionTypography = routeCase.requiresReadableSessionSurface
    ? await readSessionSectionTypography()
    : null;
  const currentAuthoringSourceControlGeometry = routeCase.requiresReadableAuthoring
    ? await readAuthoringSourceControlGeometry()
    : null;
  const currentRelatedTagChipState = routeCase.requiresReadableTagRelatedChips
    ? await (async () => {
        await page.waitForFunction(() => {
          const chip = document.querySelector('button[aria-label="Add Anthropic tag to comparison"]');
          return chip && window.getComputedStyle(chip).backgroundColor === 'rgb(39, 43, 101)';
        });
        return readRelatedTagChipState();
      })()
    : null;
  const currentPileBackOpacityState = routeCase.requiresReadableSessionSurface
    ? await page.getByTestId('ce-session-pile-back').evaluate((element) => ({
        arrow: Number.parseFloat(window.getComputedStyle(element.querySelector('svg')).opacity),
        button: Number.parseFloat(window.getComputedStyle(element).opacity),
        label: Number.parseFloat(window.getComputedStyle(element.querySelector('span')).opacity),
      }))
    : null;
  const currentQuestionsToolbarState =
    routeCase.requiresReadableSessionSurface && viewportName === 'session back feedback'
      ? await (async () => {
          const toolbarPage = await page.context().browser().newPage({ viewport: page.viewportSize() });
          try {
            await toolbarPage.addInitScript(() => {
              window.localStorage.setItem('ce:firstVisitRootAboutRedirectConsumed:v20260618b', 'true');
              window.localStorage.setItem('ce_onboarding_complete', 'true');
              window.localStorage.setItem('firstVisit', 'false');
              window.localStorage.setItem('ce:theme', 'context-engine');
              window.localStorage.setItem('ce:primarySessionSlug', 'demo-sh');
              window.localStorage.setItem('ce:selectedSessionScope', 'active');
            });
            await toolbarPage.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await toolbarPage.getByText('Questions', { exact: true }).click();
            const toolbar = toolbarPage.getByTestId('ce-survey-toolbar');
            await toolbar.waitFor({ state: 'visible', timeout: 15000 });
            await toolbarPage.waitForFunction(
              () =>
                /Questions\s*\([1-9]\d*\)/.test(
                  document.querySelector('[data-testid="ce-survey-questions-toggle"]')?.textContent || '',
                ),
              null,
              { timeout: 15000 },
            );
            const agreeChoice = toolbarPage.locator('label:has(input[type="radio"][value="Agree"])').first();
            await agreeChoice.waitFor({ state: 'visible', timeout: 15000 });
            await agreeChoice.click();
            await toolbarPage.getByTestId('ce-survey-submit').waitFor({ state: 'visible', timeout: 15000 });
            const layout = await toolbar.evaluate((element) => {
              const style = window.getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              let section = element.parentElement;
              while (section && Number.parseFloat(window.getComputedStyle(section).borderTopWidth) === 0) {
                section = section.parentElement;
              }
              const sectionRect = section?.getBoundingClientRect();
              const childRects = Array.from(element.children).map((child) => child.getBoundingClientRect());
              const contentLeft =
                rect.left + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft);
              const contentRight =
                rect.right - Number.parseFloat(style.borderRightWidth) - Number.parseFloat(style.paddingRight);
              const centers = childRects.map((childRect) => childRect.top + childRect.height / 2);
              return {
                centerSpread: centers.length ? Math.max(...centers) - Math.min(...centers) : 0,
                childCount: childRects.length,
                gaps: childRects.slice(1).map((childRect, index) => childRect.left - childRects[index].right),
                justifyContent: style.justifyContent,
                leftEdgeGap: childRects.length ? childRects[0].left - contentLeft : 0,
                overflows: element.scrollWidth > element.clientWidth + 1,
                rightEdgeGap: childRects.length ? contentRight - childRects[childRects.length - 1].right : 0,
                topInset: sectionRect ? rect.top - sectionRect.top : Number.POSITIVE_INFINITY,
                width: rect.width,
              };
            });
            await toolbarPage.setViewportSize({
              width: 700,
              height: page.viewportSize()?.height || 802,
            });
            const wrapped = await toolbar.evaluate((element) => {
              const rect = element.getBoundingClientRect();
              const childRects = Array.from(element.children).map((child) => child.getBoundingClientRect());
              const submitRect = element.querySelector('[data-testid="ce-survey-submit"]')?.getBoundingClientRect();
              return {
                rowCount: new Set(childRects.map((childRect) => Math.round(childRect.top))).size,
                submitCenterDelta: submitRect
                  ? Math.abs(submitRect.left + submitRect.width / 2 - (rect.left + rect.width / 2))
                  : Number.POSITIVE_INFINITY,
              };
            });
            await toolbarPage.setViewportSize(page.viewportSize());
            const documentTop = await toolbar.evaluate(
              (element) => element.getBoundingClientRect().top + window.scrollY,
            );
            await toolbarPage.waitForFunction(
              (minimumScrollHeight) => document.documentElement.scrollHeight >= minimumScrollHeight,
              documentTop + 900 + (page.viewportSize()?.height || 0),
              { timeout: 15000 },
            );
            await toolbarPage.evaluate((scrollTop) => window.scrollTo(0, scrollTop), documentTop + 900);
            await toolbarPage.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
            const sticky = await toolbar.evaluate((element) => {
              const style = window.getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return {
                bottom: rect.bottom,
                position: style.position,
                top: rect.top,
                viewportHeight: window.innerHeight,
              };
            });
            return { ...layout, sticky, wrapped };
          } finally {
            await toolbarPage.close();
          }
        })()
      : null;
  const classicQuestionsStickyState =
    routeCase.requiresReadableSessionSurface && viewportName === 'session back feedback'
      ? await (async () => {
          const toolbarPage = await page.context().browser().newPage({ viewport: page.viewportSize() });
          try {
            await toolbarPage.addInitScript(() => {
              window.localStorage.setItem('ce:firstVisitRootAboutRedirectConsumed:v20260618b', 'true');
              window.localStorage.setItem('ce_onboarding_complete', 'true');
              window.localStorage.setItem('firstVisit', 'false');
              window.localStorage.setItem('ce:theme', 'classic-95');
              window.localStorage.setItem('ce:primarySessionSlug', 'demo-sh');
              window.localStorage.setItem('ce:selectedSessionScope', 'active');
            });
            await toolbarPage.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await toolbarPage.getByText('Questions', { exact: true }).click();
            const toolbar = toolbarPage.getByTestId('ce-survey-toolbar');
            await toolbar.waitFor({ state: 'visible', timeout: 15000 });
            await toolbarPage.waitForFunction(
              () =>
                /Questions\s*\([1-9]\d*\)/.test(
                  document.querySelector('[data-testid="ce-survey-questions-toggle"]')?.textContent || '',
                ),
              null,
              { timeout: 15000 },
            );
            const agreeChoice = toolbarPage.locator('label:has(input[type="radio"][value="Agree"])').first();
            await agreeChoice.waitFor({ state: 'visible', timeout: 15000 });
            const documentTop = await toolbar.evaluate(
              (element) => element.getBoundingClientRect().top + window.scrollY,
            );
            await toolbarPage.waitForFunction(
              (minimumScrollHeight) => document.documentElement.scrollHeight >= minimumScrollHeight,
              documentTop + 900 + (page.viewportSize()?.height || 0),
              { timeout: 15000 },
            );
            await toolbarPage.evaluate((scrollTop) => window.scrollTo(0, scrollTop), documentTop + 900);
            await toolbarPage.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
            const sticky = await toolbar.evaluate((element) => {
              const style = window.getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return {
                bottom: rect.bottom,
                position: style.position,
                top: rect.top,
                viewportHeight: window.innerHeight,
              };
            });
            await agreeChoice.scrollIntoViewIfNeeded();
            await agreeChoice.click();
            return {
              ...sticky,
              voteChecked: await agreeChoice.locator('input').isChecked(),
            };
          } finally {
            await toolbarPage.close();
          }
        })()
      : null;
  let currentGroupLinkState = null;
  if (sessionGroupsToggle && sessionGroupLinkButton) {
    await sessionGroupsToggle.click();
    await sessionGroupLinkButton.waitFor({ state: 'visible', timeout: 15000 });
    const readState = () =>
      sessionGroupLinkButton.evaluate((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          backgroundColor: style.backgroundColor,
          borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
          boxShadow: style.boxShadow,
          height: rect.height,
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          width: rect.width,
        };
      });
    const resting = await readState();
    await sessionGroupLinkButton.hover();
    const hovered = await readState();
    await sessionGroupLinkButton.evaluate((element) => {
      const card = element.closest('article');
      card?.setAttribute('tabindex', '0');
      card?.focus();
    });
    await page.keyboard.press('Tab');
    assert.equal(
      await sessionGroupLinkButton.evaluate((element) => document.activeElement === element),
      true,
      'Session group-card link control should be reachable by keyboard',
    );
    const focused = await readState();
    await sessionGroupLinkButton.evaluate((element) => element.closest('article')?.removeAttribute('tabindex'));
    currentGroupLinkState = { focused, hovered, resting };
  }
  const currentReportClusterColors = routeCase.requiresReadableSessionSurface
    ? await page
        .locator('svg[class*="clusterSwatchSvg"] circle')
        .evaluateAll((circles) => circles.map((circle) => circle.getAttribute('fill')))
    : null;
  const currentDocumentEndFooterState = routeCase.requiresDocumentEndFooter
    ? await page.locator('footer').evaluate((element) => ({
        placement: element.getAttribute('data-ce-footer-placement'),
        position: window.getComputedStyle(element).position,
      }))
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
  assert.match(classic.fontBody, /ce tahoma/, `${routeCase.label} should receive the bundled Classic 95 typography`);
  assert.equal(classic.tahomaLoaded, true, `${routeCase.label} should load the local Wine Tahoma face`);
  assert.equal(current.themeId, 'context-engine', `${routeCase.label} should switch without a reload`);
  assert.equal(current.layoutProfile, 'standard-app', `${routeCase.label} should restore the default layout profile`);
  assert.equal(current.canvas, '#20204e', `${routeCase.label} should repaint to the Context Engine palette`);
  assert.equal(current.radius4, '4px', `${routeCase.label} should repaint rounded geometry`);
  assert.match(current.fontBody, /poppins/, `${routeCase.label} should repaint typography`);
  assert.notEqual(classic.modalBackground, current.modalBackground, `${routeCase.label} modal chrome should repaint`);
  assert.notEqual(classic.modalRadius, current.modalRadius, `${routeCase.label} modal geometry should repaint`);
  if (classicRelatedTagChipState && currentRelatedTagChipState) {
    assert.equal(
      classicRelatedTagChipState.backgroundColor,
      'rgb(192, 192, 192)',
      'Classic 95 related tags should use the standard gray control face',
    );
    assert.equal(
      classicRelatedTagChipState.color,
      'rgb(0, 0, 0)',
      'Classic 95 related tags should use readable black text',
    );
    assert.deepEqual(
      classicRelatedTagChipState.borderWidths,
      ['2px', '2px', '2px', '2px'],
      'Classic 95 related tags should use the theme control border width',
    );
    assert.equal(
      currentRelatedTagChipState.backgroundColor,
      'rgb(39, 43, 101)',
      'Context Engine related tags should use the dark control face',
    );
    assert.equal(
      currentRelatedTagChipState.color,
      'rgb(244, 247, 255)',
      'Context Engine related tags should use readable light text',
    );
  }
  if (classicAboutHeroControlState && currentAboutHeroControlState) {
    [classicAboutHeroControlState, currentAboutHeroControlState].forEach((state) => {
      assert.equal(state.linkLabels.includes('Posts'), false, 'About hero should leave Posts in footer navigation only');
    });
    assert.match(
      classicAboutHeroControlState.heroFontFamily,
      /ce tahoma/,
      'Classic 95 About content should use the locally bundled Tahoma face',
    );
    [
      ['Demo', classicAboutHeroControlState.demo],
      ['GitHub', classicAboutHeroControlState.github],
      ['New Session', classicAboutHeroControlState.newSession],
      ['Whitepaper', classicAboutHeroControlState.whitepaper],
    ].forEach(([label, control]) => {
      assert.ok(control, `Classic 95 About ${label} control should render`);
      assert.deepEqual(
        control.borderWidths,
        ['2px', '2px', '2px', '2px'],
        `Classic 95 About ${label} control should use a standard raised border`,
      );
      assert.match(control.boxShadow, /1px 1px 0px/, `Classic 95 About ${label} control should be raised`);
      assert.match(control.fontFamily, /ce tahoma/, `Classic 95 About ${label} control should use bundled Tahoma`);
    });
    assert.equal(
      classicAboutHeroControlState.demo.backgroundColor,
      'rgb(0, 0, 128)',
      'Classic 95 About Demo should use the navy primary-action face',
    );
    assert.equal(
      classicAboutHeroControlState.demo.color,
      'rgb(255, 255, 255)',
      'Classic 95 About Demo should keep high-contrast white text',
    );
    assert.equal(
      classicAboutHeroControlState.newSession.backgroundColor,
      'rgb(192, 192, 192)',
      'Classic 95 About New Session should use the standard gray control face',
    );
    assert.ok(classicAboutHeroControlState.demo.height >= 48, 'Classic 95 About primary actions should remain tappable');
    assert.ok(
      classicAboutHeroControlState.whitepaper.height >= 34,
      'Classic 95 About resource actions should remain tappable',
    );
    assert.equal(
      classicAboutHeroControlState.github.backgroundColor,
      'rgb(192, 192, 192)',
      'Classic 95 About GitHub action should use the standard gray control face',
    );
    assert.ok(
      classicAboutHeroControlState.github.width > classicAboutHeroControlState.github.height,
      'Classic 95 About GitHub action should read as a rectangular push button',
    );
    assert.notEqual(
      currentAboutHeroControlState.demo.borderRadius,
      '0px',
      'Context Engine About primary actions should preserve their rounded default-theme geometry',
    );
    assert.notEqual(
      currentAboutHeroControlState.heroFontFamily,
      classicAboutHeroControlState.heroFontFamily,
      'Context Engine About typography should remain independent from the Classic 95 override',
    );
  }
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
      routeState.homeWindowTopGap !== null && routeState.homeWindowTopGap <= 24,
      `Classic 95 home window should use a compact top gap in ${viewportName}; received ${routeState.homeWindowTopGap}px`,
    );
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
    assert.equal(
      questionUtilityState.resting.opacity,
      0.5,
      `Classic 95 full-question utility icons should share the quiet 50% resting treatment; received opacity ${questionUtilityState.resting.opacity}`,
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
  if (classicQuestionIconFamilyState) {
    classicQuestionIconFamilyState.forEach((control) => {
      assert.deepEqual(
        control.borderWidths,
        ['0px', '0px', '0px', '0px'],
        `Classic 95 ${control.label} icon should not render button borders`,
      );
      assert.equal(
        control.backgroundColor,
        'rgba(0, 0, 0, 0)',
        `Classic 95 ${control.label} icon should use a transparent background`,
      );
      assert.equal(control.boxShadow, 'none', `Classic 95 ${control.label} icon should not render a raised shadow`);
      assert.equal(control.opacity, 0.5, `Classic 95 ${control.label} icon should rest at 50% opacity`);
    });
  }
  if (classicRatingInteractionState) {
    assert.notEqual(
      classicRatingInteractionState.liveValue,
      classicRatingInteractionState.initialValue,
      'Classic 95 full-question rating slider should move during a pointer drag',
    );
    assert.equal(
      classicRatingInteractionState.liveLabel,
      classicRatingInteractionState.liveValue,
      'Classic 95 full-question rating label should track the live drag value',
    );
    assert.equal(
      classicRatingInteractionState.committedValue,
      classicRatingInteractionState.liveValue,
      'Classic 95 full-question rating slider should preserve the released value',
    );
  }
  if (classicFullQuestionConvictionState) {
    assert.deepEqual(
      classicFullQuestionConvictionState.borderWidths,
      ['0px', '0px', '0px', '0px'],
      'Classic 95 full-question conviction controls should not render an exterior border',
    );
    assert.equal(
      classicFullQuestionConvictionState.backgroundColor,
      'rgba(0, 0, 0, 0)',
      'Classic 95 full-question conviction controls should use the card surface directly',
    );
    assert.equal(
      classicFullQuestionConvictionState.boxShadow,
      'none',
      'Classic 95 full-question conviction controls should not render an exterior shadow',
    );
    assert.equal(
      classicFullQuestionConvictionState.opacity,
      1,
      'Classic 95 full-question conviction controls should be fully opaque',
    );
    assert.equal(
      classicFullQuestionConvictionState.labelColor,
      'rgb(0, 0, 0)',
      'Classic 95 full-question conviction labels should use readable black text',
    );
    assert.equal(
      classicFullQuestionConvictionState.labelOpacity,
      1,
      'Classic 95 full-question conviction labels should be fully opaque',
    );
    assert.deepEqual(
      classicFullQuestionConvictionState.toggleLineBorderWidths,
      ['0px', '0px', '0px', '0px'],
      'Classic 95 full-question conviction labels should not render individual button borders',
    );
    assert.equal(
      classicFullQuestionConvictionState.toggleLineBackground,
      'rgba(0, 0, 0, 0)',
      'Classic 95 full-question conviction labels should use transparent backgrounds',
    );
    assert.equal(
      classicFullQuestionConvictionState.toggleLineBoxShadow,
      'none',
      'Classic 95 full-question conviction labels should not render raised shadows',
    );
    assert.equal(
      classicFullQuestionConvictionState.toggleLineColor,
      'rgb(0, 0, 0)',
      'Classic 95 full-question conviction values should use readable black text',
    );
    assert.equal(
      classicFullQuestionConvictionState.toggleLineOpacity,
      1,
      'Classic 95 full-question conviction values should be fully opaque',
    );
    assert.equal(
      classicFullQuestionConvictionState.sliderOpacity,
      1,
      'Classic 95 full-question conviction slider should be fully opaque',
    );
    assert.notEqual(
      classicFullQuestionConvictionState.sliderBackground,
      'rgba(0, 0, 0, 0)',
      'Classic 95 full-question conviction slider should retain a visible track',
    );
    assert.ok(
      classicFullQuestionConvictionState.sliderWidth >= 100 && classicFullQuestionConvictionState.sliderHeight >= 8,
      `Classic 95 full-question conviction slider should remain usable; received ${classicFullQuestionConvictionState.sliderWidth}x${classicFullQuestionConvictionState.sliderHeight}`,
    );
  }
  if (classicFullQuestionLockAudienceState) {
    assert.deepEqual(
      classicFullQuestionLockAudienceState.borderWidths,
      ['0px', '0px', '0px', '0px'],
      'Classic 95 full-question Only me option should not have an exterior border',
    );
    assert.equal(
      classicFullQuestionLockAudienceState.backgroundColor,
      'rgba(0, 0, 0, 0)',
      'Classic 95 full-question Only me option should use the lock menu surface directly',
    );
    assert.equal(
      classicFullQuestionLockAudienceState.boxShadow,
      'none',
      'Classic 95 full-question Only me option should be flat',
    );
    assert.equal(
      classicFullQuestionLockAudienceState.color,
      'rgb(0, 0, 0)',
      'Classic 95 full-question Only me text should be black',
    );
    assert.equal(
      classicFullQuestionLockAudienceState.opacity,
      1,
      'Classic 95 full-question Only me option should be fully opaque',
    );
    assert.equal(
      classicFullQuestionLockAudienceState.popoverBackground,
      'rgb(192, 192, 192)',
      'Classic 95 full-question lock menu should use a readable Windows gray surface',
    );
    assert.deepEqual(
      classicFullQuestionLockAudienceState.popoverBorderWidths,
      ['0px', '0px', '0px', '0px'],
      'Classic 95 full-question lock menu should not have an exterior border',
    );
    assert.equal(
      classicFullQuestionLockAudienceState.popoverBoxShadow,
      'none',
      'Classic 95 full-question lock menu should not add an exterior shadow',
    );
  }
  if (classicQuestionFilterState) {
    assert.equal(
      classicQuestionFilterState.headerBackground,
      'rgb(0, 0, 128)',
      'Classic 95 question filter should use a navy title bar',
    );
    assert.equal(
      classicQuestionFilterState.titleColor,
      'rgb(255, 255, 255)',
      'Classic 95 question filter title should use readable white text',
    );
    assert.equal(
      classicQuestionFilterState.tagResting.backgroundColor,
      'rgb(192, 192, 192)',
      'Classic 95 unselected tags should use the standard control face',
    );
    assert.equal(
      classicQuestionFilterState.tagResting.color,
      'rgb(0, 0, 0)',
      'Classic 95 unselected tags should use black text',
    );
    assert.deepEqual(
      classicQuestionFilterState.tagResting.borderWidths,
      ['2px', '2px', '2px', '2px'],
      'Classic 95 tags should use a standard raised border',
    );
    assert.notEqual(
      classicQuestionFilterState.tagResting.boxShadow,
      'none',
      'Classic 95 tags should read as raised controls',
    );
    assert.equal(
      classicQuestionFilterState.tagFocused.outlineStyle,
      'dotted',
      'Classic 95 tags should expose a visible keyboard focus ring',
    );
    assert.equal(
      classicQuestionFilterState.tagSelected.backgroundColor,
      'rgb(0, 0, 128)',
      'Classic 95 selected tags should use the standard navy selection',
    );
    assert.equal(
      classicQuestionFilterState.tagSelected.color,
      'rgb(255, 255, 255)',
      'Classic 95 selected tags should use readable white text',
    );
    assert.equal(
      classicQuestionFilterState.applyButton.backgroundColor,
      'rgb(0, 0, 128)',
      'Classic 95 filter action should use the primary navy control',
    );
    assert.equal(
      classicQuestionFilterState.applyButton.color,
      'rgb(255, 255, 255)',
      'Classic 95 filter action should use white text',
    );
    assert.equal(
      classicQuestionFilterState.closeButton.backgroundColor,
      'rgb(192, 192, 192)',
      'Classic 95 filter close control should use the standard control face',
    );
  }
  if (classicToolCardState?.hovered && currentToolCardState) {
    assert.equal(classicToolArtworkState?.length, 3, 'Classic 95 should render artwork for all three live tool cards');
    classicToolArtworkState?.forEach((artwork) => {
      assert.equal(artwork.display, 'block', 'Classic 95 tool artwork should remain visible');
      assert.match(artwork.backgroundImage, /^url\(/, 'Classic 95 tool artwork should use its bundled image');
      assert.equal(
        artwork.height,
        viewportName === 'mobile' ? 128 : 124,
        'Classic 95 tool artwork should use the viewport-specific theme thumbnail height',
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
      ['0px', '0px', '0px', '0px'],
      'Classic 95 Start-menu items should be unframed',
    );
    assert.equal(
      classicFooterLinkState.backgroundColor,
      'rgba(0, 0, 0, 0)',
      'Classic 95 Start-menu items should rest on the menu surface',
    );
    assert.equal(
      classicFooterLinkState.color,
      'rgb(0, 0, 0)',
      'Classic 95 Start-menu items should use readable black text',
    );
    assert.equal(classicFooterLinkState.boxShadow, 'none', 'Classic 95 Start-menu items should remain shadow-free');
    assert.ok(classicFooterLinkState.height >= 38, 'Classic 95 Start-menu items should keep accessible targets');
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
    if (viewportName === 'feedback compact') {
      assert.equal(currentFooterLayoutState.linkCount, 5, 'Context Engine footer should preserve all five links');
      assert.ok(
        currentFooterLayoutState.fontSizes.every((fontSize) => fontSize >= 14),
        `Context Engine footer links should use at least 14px type at 630px; received ${JSON.stringify(currentFooterLayoutState.fontSizes)}`,
      );
      assert.ok(
        currentFooterLayoutState.topSpread <= 1,
        `Context Engine footer links should remain on one row; received ${currentFooterLayoutState.topSpread}px top spread`,
      );
      assert.equal(currentFooterLayoutState.menuOverflows, false, 'Context Engine footer menu should not overflow');
      assert.equal(currentFooterLayoutState.outsideMenu, false, 'Context Engine footer links should stay inside the menu');
      assert.equal(
        currentFooterLayoutState.linkOverflows.some(Boolean),
        false,
        'Context Engine footer labels should fit inside their links',
      );
    }
  }
  if (classicFooterInitialState && classicFooterStartState && classicFooterMenuState && currentFooterControlState) {
    assert.equal(classicFooterInitialState.position, 'relative', 'Classic 95 taskbar should remain in document flow');
    if (routeCase.requiresFooterBelowFold) {
      assert.ok(
        classicFooterInitialState.documentHeight > classicFooterInitialState.viewportHeight &&
          classicFooterInitialState.footerTop >= classicFooterInitialState.viewportHeight,
        `Classic 95 footer should remain below the fold until the page end; received ${JSON.stringify(classicFooterInitialState)}`,
      );
    }
    assert.deepEqual(
      classicFooterStartState.borderWidths,
      ['2px', '2px', '2px', '2px'],
      'Classic 95 Start button should use a standard raised border',
    );
    assert.match(classicFooterStartState.boxShadow, /1px 1px 0px/, 'Classic 95 Start button should be raised');
    assert.ok(classicFooterStartState.height >= 32, 'Classic 95 Start button should have an accessible target');
    assert.ok(classicFooterStartState.width >= 32, 'Classic 95 Start button should have an accessible target width');
    assert.ok(classicFooterStartState.width < 48, 'Classic 95 Start button should remain a compact icon control');
    assert.equal(classicFooterStartState.text, '', 'Classic 95 Start button should not render a visible text label');
    assert.equal(
      classicFooterStartState.ariaLabel,
      'Open Start menu',
      'Classic 95 icon-only Start button should preserve its accessible name',
    );
    assert.ok(
      classicFooterMenuState.bottom <= classicFooterMenuState.footerTop + 1,
      `Classic 95 Start menu should open above the taskbar; received ${JSON.stringify(classicFooterMenuState)}`,
    );
    assert.equal(currentFooterControlState.startVisible, false, 'Context Engine should not expose the Start control');
    assert.equal(currentFooterControlState.menuVisible, true, 'Context Engine should preserve visible footer navigation');
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
    assert.equal(classicDockedFooterState.position, 'relative', 'Classic 95 should keep the taskbar in document flow');
    assert.ok(
      Math.abs(classicDockedFooterState.bottom - classicDockedFooterState.viewportHeight) <= 1,
      `Classic 95 footer should touch the viewport bottom; received ${JSON.stringify(classicDockedFooterState)}`,
    );
    assert.equal(
      classicDockedFooterState.bodyPaddingBottom,
      '0px',
      'Classic 95 should not reserve fixed-taskbar spacing',
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
  if (classicDocumentEndFooterState && currentDocumentEndFooterState) {
    assert.deepEqual(
      {
        bodyPaddingBottom: classicDocumentEndFooterState.bodyPaddingBottom,
        placement: classicDocumentEndFooterState.placement,
        position: classicDocumentEndFooterState.position,
      },
      {
        bodyPaddingBottom: '0px',
        placement: 'document-end',
        position: 'relative',
      },
      'Classic 95 session footer should remain in document flow without fixed-taskbar spacing',
    );
    assert.ok(
      classicDocumentEndFooterState.footerTop >= classicDocumentEndFooterState.sectionsBottom - 1,
      `Classic 95 session footer should follow the lower session panels without overlap; received ${JSON.stringify(classicDocumentEndFooterState)}`,
    );
    assert.equal(
      currentDocumentEndFooterState.placement,
      'document-end',
      'Context Engine session footer should preserve the session-only document placement',
    );
    assert.notEqual(
      currentDocumentEndFooterState.position,
      'fixed',
      'Context Engine session footer should remain in document flow',
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
  if (docsLayoutState) {
    assert.equal(docsLayoutState.hasAdvancedExternalNotice, false, 'Docs should not render the external-tools notice');
    assert.ok(
      docsLayoutState.promptsTop < docsLayoutState.faqTop,
      'Docs should place Prompts before FAQ in visual and document order',
    );
    assert.ok(
      docsLayoutState.faqTop < docsLayoutState.groupTop,
      'Docs should place the session/contracts group below FAQ',
    );
    assert.equal(docsLayoutState.groupContainsSession, true, 'Docs should group the session context inside its frame');
    assert.equal(docsLayoutState.groupContainsContracts, true, 'Docs should group Smart Contracts inside its frame');
    assert.equal(docsLayoutState.groupIsLast, true, 'Docs should keep the session/contracts group at the page bottom');
    assert.equal(
      docsLayoutState.githubHref,
      'https://github.com/AgalmicSoftware/context-engine',
      'Docs GitHub action should open the public Context Engine repository',
    );
    assert.equal(docsLayoutState.githubTarget, '_blank', 'Docs GitHub action should open in a new tab');
    assert.equal(docsLayoutState.githubHasIcon, true, 'Docs GitHub action should render its GitHub icon');
    assert.equal(docsLayoutState.githubSharesTitleRow, true, 'Docs GitHub action should sit beside the Docs title');
    assert.equal(docsLayoutState.loginIdleIconCount, 0, 'Signed-out Log In should not render a decorative key icon');
    assert.match(
      docsLayoutState.loginFontFamily,
      /ce tahoma/i,
      'Classic 95 Log In text should use the bundled Tahoma face',
    );
    assert.ok(
      docsLayoutState.groupBorderWidths.every((width) => Number.parseFloat(width) > 0),
      `Docs session/contracts group should have a visible border; received ${JSON.stringify(docsLayoutState.groupBorderWidths)}`,
    );
  }
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
      'normal',
      'Classic 95 welcome artwork should preserve image detail without blend-mode washout',
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
  if (classicLoginBackgroundState && currentLoginBackgroundState) {
    [classicLoginBackgroundState, currentLoginBackgroundState].forEach((state) => {
      assert.equal(state.cardBackgroundImage, 'none', 'Login card should use a solid background');
      assert.equal(state.bodyBackgroundImage, 'none', 'Login body should not add a background gradient');
      assert.equal(state.overlayBackgroundImage, 'none', 'Login card should not render a decorative gradient overlay');
      assert.notEqual(state.cardBackgroundColor, 'rgba(0, 0, 0, 0)', 'Login card solid background should be opaque');
    });
  }
  if (classicPreloginSettingsControlLayout && currentPreloginSettingsControlLayout) {
    [classicPreloginSettingsControlLayout, currentPreloginSettingsControlLayout].forEach((layout) => {
      assert.equal(layout.controlCount, 3, 'Pre-login settings should expose Config, Explainers, and Demo Mode');
      assert.equal(layout.sessionOutsidePanel, true, 'Active Session should remain outside the settings drawer');
      assert.equal(layout.sessionAbovePanel, true, 'Active Session should sit below auth actions and above settings');
      assert.equal(layout.sessionBelowAuthActions, true, 'Active Session should render below Create and Login');
      assert.equal(
        layout.overflows,
        false,
        `Pre-login settings controls should not overflow their row; received ${JSON.stringify(layout)}`,
      );
      assert.equal(
        layout.contentOverflows,
        false,
        `Pre-login settings control labels should not collide or clip; received ${JSON.stringify(layout)}`,
      );
      assert.ok(
        layout.rowCenterOffsets.every((offset) => offset <= 1),
        `Every pre-login settings row should be centered; received ${JSON.stringify(layout.rowCenterOffsets)}`,
      );
      assert.equal(
        layout.rowCount,
        viewportName === 'mobile' ? 3 : viewportName === 'login feedback' ? 2 : 1,
        `Pre-login settings should wrap only when needed in ${viewportName}; received ${JSON.stringify(layout)}`,
      );
    });
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
    assert.equal(preloginThemeSettingsState.hasVisibleSummary, false, 'Appearance should not show a summary');
    assert.equal(preloginThemeSettingsState.hasVisibleLabel, false, 'Appearance should not show an App theme label');
    assert.equal(preloginThemeSettingsState.hasVisibleHint, false, 'Appearance should not show explanatory copy');
    assert.equal(preloginThemeSettingsState.accessibleName, 'App theme', 'Theme selector should retain its accessible name');
    assert.equal(
      preloginThemeSettingsState.defaultOptionText,
      'Deployment theme: Context Engine',
      'Theme selector should identify the configured deployment theme',
    );
    assert.equal(
      preloginThemeSettingsState.sponsorDetailInsideActivePill,
      true,
      'Active-session sponsor detail should render inside the named session pill',
    );
    assert.match(
      preloginThemeSettingsState.activeSessionPillText,
      /Demo Session\s+No sponsor key is configured for the active session\./,
      'Active-session pill should combine the session name with its sponsorship status',
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
    assert.ok(
      statsContrastState.beeswarmVerticalDelta <= 8,
      `Classic 95 Community Stats should vertically center the beeswarm plot; received ${statsContrastState.beeswarmVerticalDelta.toFixed(2)}px top/bottom gap delta`,
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
    [classicAuthoringSourceControlGeometry, currentAuthoringSourceControlGeometry].forEach((geometry) => {
      assert.ok(geometry, 'Authoring source-control geometry should render in both themes');
      assert.equal(geometry.controlCount, 4, 'Add URL should include its input, Paste, Upload, and add controls');
      assert.equal(geometry.chooserInsideSurface, true, 'Paste and Upload should live inside the Add URL field');
      assert.equal(geometry.addIsLast, true, 'The Add URL submit button should remain the final field control');
      assert.equal(geometry.overflows, false, 'Add URL controls should stay inside the field at compact widths');
      assert.ok(
        geometry.centerSpread <= 1,
        `Add URL controls should share one row; received ${geometry.centerSpread.toFixed(2)}px center spread`,
      );
      assert.ok(
        geometry.surfaceHeight >= 36 && geometry.surfaceHeight <= 40,
        `Add URL should remain a compact single field; received ${geometry.surfaceHeight.toFixed(2)}px height`,
      );
    });
  }
  if (routeCase.requiresReadableSessionSurface) {
    const originalReportClusterColors = ['#1f77b4', '#ff7f0e', '#2ca02c'];
    assert.deepEqual(
      classicReportClusterColors,
      originalReportClusterColors,
      'Classic 95 should preserve the original D3 opinion-group palette',
    );
    assert.deepEqual(
      currentReportClusterColors,
      originalReportClusterColors,
      'Context Engine should preserve the original D3 opinion-group palette',
    );
    assert.deepEqual(
      classicGroupLinkState.borderWidths,
      ['0px', '0px', '0px', '0px'],
      'Classic 95 group-card link controls should not render a persistent border',
    );
    assert.equal(
      classicGroupLinkState.backgroundColor,
      'rgba(0, 0, 0, 0)',
      'Classic 95 group-card link controls should keep a transparent background',
    );
    assert.equal(classicGroupLinkState.boxShadow, 'none', 'Classic 95 group-card link controls should not be raised');
    assert.ok(classicGroupLinkState.width >= 28, 'Classic 95 group-card link controls should preserve their click width');
    assert.ok(classicGroupLinkState.height >= 28, 'Classic 95 group-card link controls should preserve their click height');
    ['resting', 'hovered', 'focused'].forEach((stateName) => {
      const state = currentGroupLinkState[stateName];
      assert.deepEqual(
        state.borderWidths,
        ['0px', '0px', '0px', '0px'],
        `Context Engine group-card link control should remain frameless while ${stateName}`,
      );
      assert.equal(
        state.boxShadow,
        'none',
        `Context Engine group-card link control should remain shadow-free while ${stateName}`,
      );
    });
    assert.equal(
      currentGroupLinkState.resting.backgroundColor,
      'rgba(0, 0, 0, 0)',
      'Context Engine group-card link control should rest on a transparent background',
    );
    assert.ok(currentGroupLinkState.resting.width >= 28, 'Context Engine group-card link control should preserve its click width');
    assert.ok(currentGroupLinkState.resting.height >= 28, 'Context Engine group-card link control should preserve its click height');
    assert.notEqual(
      currentGroupLinkState.focused.outlineStyle,
      'none',
      'Context Engine group-card link control should retain a visible keyboard-focus outline',
    );
    assert.ok(
      Number.parseFloat(currentGroupLinkState.focused.outlineWidth) >= 2,
      'Context Engine group-card link control should retain at least a 2px keyboard-focus outline',
    );
    if (viewportName === 'session back feedback') {
      assert.deepEqual(
        currentPileBackOpacityState,
        { arrow: 1, button: 1, label: 0.6 },
        'Context Engine full-question Back control should use a fully opaque arrow and muted label at 735px',
      );
      assert.equal(
        currentQuestionsToolbarState.justifyContent,
        'space-between',
        'Context Engine questions toolbar should maximize spacing at 735px',
      );
      assert.equal(
        currentQuestionsToolbarState.childCount,
        5,
        'Context Engine questions toolbar should expose all five controls when a response is pending',
      );
      assert.ok(
        currentQuestionsToolbarState.gaps.every((gap) => gap >= 8),
        `Context Engine questions toolbar controls should preserve at least 8px gaps; received ${JSON.stringify(currentQuestionsToolbarState.gaps)}`,
      );
      assert.ok(
        Math.abs(currentQuestionsToolbarState.leftEdgeGap) <= 1 &&
          Math.abs(currentQuestionsToolbarState.rightEdgeGap) <= 1,
        `Context Engine questions toolbar should distribute controls to both content edges; received ${JSON.stringify(currentQuestionsToolbarState)}`,
      );
      assert.ok(
        currentQuestionsToolbarState.centerSpread <= 1,
        `Context Engine questions toolbar controls should remain centered on one row; received ${currentQuestionsToolbarState.centerSpread}px center spread`,
      );
      assert.ok(
        currentQuestionsToolbarState.width >= 650,
        `Context Engine embedded questions toolbar should reclaim the card width at 735px; received ${currentQuestionsToolbarState.width}px`,
      );
      assert.ok(
        currentQuestionsToolbarState.topInset <= 1,
        `Context Engine embedded questions toolbar should sit against the section top border; received ${currentQuestionsToolbarState.topInset}px inset`,
      );
      assert.equal(
        currentQuestionsToolbarState.overflows,
        false,
        'Context Engine questions toolbar should not overflow',
      );
      assert.ok(
        currentQuestionsToolbarState.wrapped.rowCount > 1,
        'Context Engine questions toolbar should wrap below its single-row fit threshold',
      );
      assert.ok(
        currentQuestionsToolbarState.wrapped.submitCenterDelta <= 1,
        `Context Engine wrapped Submit control should remain centered; received ${currentQuestionsToolbarState.wrapped.submitCenterDelta}px delta`,
      );
      assert.equal(
        currentQuestionsToolbarState.sticky.position,
        'sticky',
        'Context Engine questions toolbar should remain sticky',
      );
      assert.ok(
        Math.abs(currentQuestionsToolbarState.sticky.top - 10) <= 1,
        `Context Engine questions toolbar should remain pinned 10px from the viewport top; received ${currentQuestionsToolbarState.sticky.top}px`,
      );
      assert.ok(
        currentQuestionsToolbarState.sticky.bottom <= currentQuestionsToolbarState.sticky.viewportHeight,
        'Context Engine questions toolbar should remain inside the viewport after scrolling',
      );
      assert.equal(classicQuestionsStickyState.position, 'sticky', 'Classic 95 questions toolbar should remain sticky');
      assert.ok(
        Math.abs(classicQuestionsStickyState.top - 10) <= 1,
        `Classic 95 questions toolbar should remain pinned 10px from the viewport top; received ${classicQuestionsStickyState.top}px`,
      );
      assert.ok(
        classicQuestionsStickyState.bottom <= classicQuestionsStickyState.viewportHeight,
        'Classic 95 questions toolbar should remain inside the viewport after scrolling',
      );
      assert.equal(
        classicQuestionsStickyState.voteChecked,
        true,
        'Classic 95 binary votes should become selected through the visible question control',
      );
    }
    if (viewportName === 'feedback compact') {
      assert.equal(
        currentSessionSectionTypography.length,
        3,
        'Context Engine should expose all three expandable session headings at 630px',
      );
      currentSessionSectionTypography.forEach((heading) => {
        assert.ok(
          Math.abs(heading.titleFontSize - heading.subtitleFontSize) <= 0.1,
          `Context Engine ${heading.label} should use one font size at 630px; received ${JSON.stringify(heading)}`,
        );
      });
    }
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
      Math.abs(classicSessionHeaderGeometry.logo.centerY - classicSessionHeaderGeometry.login.centerY) <= 2,
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
    assert.equal(classicPileControlState.footerIcons.length, 3, 'Classic 95 question cards should expose three footer icons');
    classicPileControlState.footerIcons.forEach((control) => {
      assert.equal(
        control.opacity,
        0.5,
        `Classic 95 ${control.ariaLabel || 'question footer'} icon should rest at 50% opacity`,
      );
    });
    const dimmedPileFooterControls = new Set(['comment', 'lock', 'previous question', 'next question']);
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
      if (dimmedPileFooterControls.has(control.label)) {
        assert.ok(
          control.opacity >= 0.5 && control.opacity <= 1,
          `Classic 95 ${control.label} control should remain within its 50%-to-active opacity transition`,
        );
      } else {
        assert.equal(control.opacity, 1, `Classic 95 ${control.label} control should remain fully visible`);
      }
    });
    assert.ok(
      reportedSurfaceState.compactControls.railButtons.length >= 5,
      'Classic 95 question rail should expose navigation and action controls',
    );
    reportedSurfaceState.compactControls.railButtons.forEach((button, index) => {
      assert.ok(button.width >= 48, `Classic 95 rail control ${index + 1} should be at least 48px wide`);
      assert.ok(button.height >= 48, `Classic 95 rail control ${index + 1} should be at least 48px tall`);
      assert.ok(button.fontSize >= 32, `Classic 95 rail icon ${index + 1} should match the default 2rem glyph size`);
      assert.equal(button.color, 'rgb(255, 255, 255)', `Classic 95 rail control ${index + 1} should be white`);
      assert.ok(
        button.opacity === 1 || button.opacity === 0.5,
        `Classic 95 rail control ${index + 1} should be fully visible or use the disabled treatment`,
      );
    });
    assert.equal(
      reportedSurfaceState.compactControls.sectionHeaders.length,
      3,
      'Classic 95 should expose the three lower section headings',
    );
    reportedSurfaceState.compactControls.sectionHeaders.forEach((header, index) => {
      assert.equal(
        header.titleFontSize,
        '21.6px',
        `Classic 95 section ${index + 1} title should use the larger task-heading size`,
      );
      assert.equal(
        header.subtitleFontSize,
        '16px',
        `Classic 95 section ${index + 1} subtitle should remain legible`,
      );
      assert.equal(
        header.caretOpacity,
        0.5,
        `Classic 95 section ${index + 1} caret should use the requested half opacity`,
      );
    });
    if (viewportName === 'compact window') {
      const compactControls = reportedSurfaceState.compactControls;
      assert.equal(
        compactControls.actionMenuToggleDisplay,
        'none',
        'Compact Classic 95 should not use the hover-only question-actions menu',
      );
      assert.equal(compactControls.actionGroupDisplay, 'flex', 'Compact Classic 95 actions should remain visible');
      assert.equal(compactControls.actionGroupPosition, 'static', 'Compact Classic 95 actions should stay in flow');
      assert.equal(compactControls.actionGroupDirection, 'row', 'Compact Classic 95 actions should form a toolbar');
      assert.equal(
        compactControls.actionsBackground,
        'rgba(0, 0, 0, 0)',
        'Compact Classic 95 actions should sit directly on the session background',
      );
      assert.equal(compactControls.actionsBorderWidth, '0px', 'Compact Classic 95 actions should not have a rail border');
      assert.equal(compactControls.actionsBoxShadow, 'none', 'Compact Classic 95 actions should not have a rail shadow');
      assert.equal(
        compactControls.navBackground,
        'rgba(0, 0, 0, 0)',
        'Compact Classic 95 navigation should sit directly on the session background',
      );
      assert.equal(compactControls.navBorderWidth, '0px', 'Compact Classic 95 navigation should not have a rail border');
      assert.equal(compactControls.navBoxShadow, 'none', 'Compact Classic 95 navigation should not have a rail shadow');
      assert.ok(
        compactControls.controlsBottom <= compactControls.panelsTop,
        `Compact Classic 95 controls should not cover lower panels; received ${compactControls.controlsBottom}px versus ${compactControls.panelsTop}px`,
      );
      assert.ok(
        compactControls.expandedHeaderLayout,
        'Compact Classic 95 should expose its expanded lower-section header layout',
      );
      assert.ok(
        Math.abs(
          compactControls.expandedHeaderLayout.headerTop - compactControls.expandedHeaderLayout.actionsTop,
        ) <= 8,
        `Compact Classic 95 expanded-section actions should stay inline when they fit; received ${JSON.stringify(compactControls.expandedHeaderLayout)}`,
      );
      assert.ok(
        compactControls.expandedHeaderLayout.rowHeight <= 64,
        `Compact Classic 95 expanded-section headers should not waste a second row; received ${JSON.stringify(compactControls.expandedHeaderLayout)}`,
      );
      assert.equal(
        compactControls.expandedHeaderLayout.actionsDisplay,
        'flex',
        'Compact Classic 95 expanded-section actions should remain a horizontal strip',
      );
      assert.equal(
        compactControls.expandedHeaderLayout.actionsOverflowX,
        'auto',
        'Compact Classic 95 expanded-section actions should scroll only when they cannot fit',
      );
      compactControls.panelBounds.forEach(({ left, right }, index) => {
        assert.ok(left >= 0, `Compact Classic 95 panel ${index + 1} should remain inside the left viewport edge`);
        assert.ok(
          right <= compactControls.viewportWidth,
          `Compact Classic 95 panel ${index + 1} should remain inside the right viewport edge; received ${right}px`,
        );
      });
      assert.equal(
        compactControls.sectionHeaders.length,
        3,
        'Compact Classic 95 should expose the three lower section headings',
      );
      compactControls.sectionHeaders.forEach((header, index) => {
        assert.ok(
          Math.abs(header.caretTop - header.titleTop) <= 4,
          `Compact Classic 95 section ${index + 1} title should begin beside its caret; received ${JSON.stringify(header)}`,
        );
        assert.ok(
          header.subtitleTop >= header.titleBottom,
          `Compact Classic 95 section ${index + 1} subtitle should sit below its title; received ${JSON.stringify(header)}`,
        );
        assert.ok(
          Math.abs(header.subtitleLeft - header.titleLeft) <= 1,
          `Compact Classic 95 section ${index + 1} title and subtitle should share a left edge; received ${JSON.stringify(header)}`,
        );
        assert.equal(
          header.subtitleFontSize,
          '16px',
          `Compact Classic 95 section ${index + 1} subtitle should remain legible; received ${JSON.stringify(header)}`,
        );
        assert.equal(
          header.subtitleOpacity,
          0.5,
          `Compact Classic 95 section ${index + 1} subtitle should remain visibly secondary; received ${JSON.stringify(header)}`,
        );
        assert.equal(
          header.titleOpacity,
          0.5,
          `Compact Classic 95 section ${index + 1} title should use the requested half opacity; received ${JSON.stringify(header)}`,
        );
      });
      assert.ok(compactControls.actionButtons.length >= 3, 'Compact Classic 95 should expose its action toolbar');
      compactControls.actionButtons.forEach((button, index) => {
        assert.notEqual(button.display, 'none', `Compact Classic 95 action ${index + 1} should be visible`);
        assert.ok(button.width >= 40, `Compact Classic 95 action ${index + 1} should have a usable width`);
        assert.ok(button.height >= 40, `Compact Classic 95 action ${index + 1} should have a usable height`);
        assert.equal(button.color, 'rgb(255, 255, 255)', `Compact Classic 95 action ${index + 1} should be white`);
        assert.ok(
          button.opacity >= 0.5,
          `Compact Classic 95 action ${index + 1} should remain legible; received opacity ${button.opacity}`,
        );
        assert.notEqual(
          button.pointerEvents,
          'none',
          `Compact Classic 95 action ${index + 1} should accept pointer input`,
        );
      });
      assert.equal(compactControls.navButtons.length, 2, 'Compact Classic 95 should expose both navigation arrows');
      compactControls.navButtons.forEach((button, index) => {
        assert.ok(button.width >= 40, `Compact Classic 95 navigation ${index + 1} should have a usable width`);
        assert.ok(button.height >= 40, `Compact Classic 95 navigation ${index + 1} should have a usable height`);
        assert.equal(button.color, 'rgb(255, 255, 255)', `Compact Classic 95 navigation ${index + 1} should be white`);
        assert.ok(
          button.opacity >= 0.5,
          `Compact Classic 95 navigation ${index + 1} should remain legible; received opacity ${button.opacity}`,
        );
      });
    }
    [
      ['session title', reportedSurfaceState.sessionTitleRatio],
      ['question prompt', reportedSurfaceState.promptRatio],
    ].forEach(([label, received]) => {
      assert.ok(
        received >= 4.5,
        `Classic 95 ${label} contrast should be at least 4.5:1; received ${received.toFixed(2)}:1`,
      );
    });
    assert.match(
      reportedSurfaceState.promptFontFamily,
      /ce tahoma/,
      'Classic 95 session question prompts should use the bundled Tahoma face',
    );
    assert.equal(
      reportedSurfaceState.promptFontWeight,
      '400',
      'Classic 95 session question prompts should use Tahoma regular rather than a synthetic heavy weight',
    );
    reportedSurfaceState.compactControls.sectionHeaders.forEach((header, index) => {
      assert.equal(
        header.titleOpacity,
        0.5,
        `Classic 95 lower-panel title ${index + 1} should use the requested half opacity`,
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

async function assertWelcomeSlideGeometry(browser, baseUrl, viewport, themeId) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  try {
    await page.addInitScript((selectedThemeId) => {
      window.localStorage.setItem('ce:firstVisitRootAboutRedirectConsumed:v20260618b', 'true');
      window.localStorage.setItem('ce_onboarding_complete', 'true');
      window.localStorage.setItem('firstVisit', 'false');
      window.localStorage.setItem('ce:theme', selectedThemeId);
      window.localStorage.setItem('ce:primarySessionSlug', 'demo-sh');
      window.localStorage.setItem('ce:selectedSessionScope', 'active');
    }, themeId);
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
          const controlIcons = [...(controls?.querySelectorAll('[class*="takeSurveyIcon"]') || [])];
          const title = info?.querySelector('[class*="onboardingTitle"]');
          const slideLayout = info?.querySelector('[class*="welcomeSlideLayout"]');
          const slideImage = info?.querySelector('[data-testid="ce-welcome-slide-image"]');
          const bulletTexts = [...(info?.querySelectorAll('[class*="welcomeSlideBulletText"]') || [])];
          const finalAction = controls?.querySelector('button[class*="getStartedButton"]');
          const slideKey = info?.querySelector('[data-testid="ce-welcome-slide-media"]')?.dataset.slideKey || '';
          const rect = (element) => {
            const bounds = element?.getBoundingClientRect();
            return bounds
              ? {
                  top: bounds.top,
                  right: bounds.right,
                  bottom: bounds.bottom,
                  left: bounds.left,
                  width: bounds.width,
                  height: bounds.height,
                  documentTop: bounds.top + window.scrollY,
                  documentBottom: bounds.bottom + window.scrollY,
                }
              : null;
          };
          const footerBounds = footer?.getBoundingClientRect();
          const footerTop = footerBounds?.top || 0;
          const footerBottom = footerBounds?.bottom || 0;
          const slideImageStyle = slideImage ? window.getComputedStyle(slideImage) : null;
          const finalActionStyle = finalAction ? window.getComputedStyle(finalAction) : null;
          return {
            slideKey,
            clientHeight: document.documentElement.clientHeight,
            footerTop,
            footerBottom,
            scrollHeight: document.documentElement.scrollHeight,
            walkthrough: rect(walkthrough),
            info: rect(info),
            controls: rect(controls),
            controlIcons: controlIcons.map(rect),
            title: rect(title),
            slideLayout: rect(slideLayout),
            slideImage: rect(slideImage),
            bulletTexts: bulletTexts.map((element) => ({
              text: element.textContent?.trim() || '',
              ...rect(element),
              clientWidth: element.clientWidth,
              scrollWidth: element.scrollWidth,
            })),
            slideImageBlendMode: slideImageStyle?.mixBlendMode || '',
            slideImageObjectPosition: slideImageStyle?.objectPosition || '',
            slideImageOpacity: slideImageStyle ? Number.parseFloat(slideImageStyle.opacity) : null,
            finalAction: finalAction
              ? {
                  text: finalAction.textContent?.trim() || '',
                  backgroundColor: finalActionStyle?.backgroundColor || '',
                  color: finalActionStyle?.color || '',
                }
              : null,
          };
        }),
      );
      if (slideIndex < WELCOME_SLIDE_KEYS.length - 1) await nextSlideButton.click();
    }

    const firstFit = slideFits[0];
    slideFits.forEach((fit) => {
      const slideLabel = `${themeId} ${viewport.name} ${fit.slideKey} welcome slide`;
      if (themeId === 'classic-95') {
        assert.ok(
          fit.footerBottom <= fit.clientHeight + 1 && fit.scrollHeight <= fit.clientHeight + 1,
          `${slideLabel} should fit the viewport; received footer bottom ${fit.footerBottom.toFixed(1)}px, scroll height ${fit.scrollHeight}px, viewport ${fit.clientHeight}px`,
        );
      } else if (viewport.width >= 1367 && fit.slideKey === 'intro') {
        assert.ok(
          fit.footerTop >= fit.clientHeight - 1 && fit.scrollHeight > fit.clientHeight + 1,
          `${slideLabel} should keep the footer below the initial full-screen viewport`,
        );
      }
      assert.ok(fit.walkthrough && fit.info && fit.controls, `${slideLabel} geometry should render`);
      assert.ok(
        fit.info.documentTop >= fit.walkthrough.documentTop - 1 &&
          fit.info.documentBottom <= fit.controls.documentTop + 1,
        `${slideLabel} content should remain above its controls`,
      );
      assert.ok(
        fit.controls.left <= fit.walkthrough.left + 1 && fit.controls.right >= fit.walkthrough.right - 1,
        `${slideLabel} controls should span the bottom edge`,
      );
      assert.ok(
        Math.abs(fit.walkthrough.height - firstFit.walkthrough.height) <= 1 &&
          Math.abs(fit.controls.documentTop - firstFit.controls.documentTop) <= 1 &&
          Math.abs(fit.controls.height - firstFit.controls.height) <= 1,
        `${slideLabel} should keep the same window and arrow-strip geometry as the first slide`,
      );
      if (themeId === 'context-engine' && viewport.width >= 1367) {
        assert.ok(
          fit.controls.height >= 107,
          `${slideLabel} should restore the taller standard-desktop navigation strip`,
        );
        assert.ok(
          fit.controlIcons.length > 0 && fit.controlIcons.every((icon) => icon.height >= 63),
          `${slideLabel} should restore the larger standard-desktop arrow icons`,
        );
      }
      if (fit.title && fit.slideLayout) {
        assert.ok(
          fit.title.bottom <= fit.slideLayout.top + 1,
          `${slideLabel} title should not overlap the slide artwork`,
        );
        assert.ok(
          Math.abs((fit.title.left + fit.title.right) / 2 - (fit.info.left + fit.info.right) / 2) <= 2,
          `${slideLabel} title should remain horizontally centered in the slide frame`,
        );
      }
      if (fit.slideImage && fit.slideLayout) {
        assert.ok(
          fit.slideImage.top >= fit.slideLayout.top - 1 && fit.slideImage.bottom <= fit.slideLayout.bottom + 1,
          `${slideLabel} artwork should remain inside its slide panel`,
        );
      }
      if (themeId === 'context-engine' && viewport.width >= 1367 && fit.slideKey === 'intro') {
        assert.equal(
          fit.slideImageObjectPosition,
          '50% 50%',
          `${slideLabel} artwork should be centered in its media pane`,
        );
        assert.ok(
          Math.abs((fit.slideImage.left + fit.slideImage.right) / 2 - (fit.slideLayout.left + fit.slideLayout.right) / 2) <=
            2,
          `${slideLabel} artwork should remain horizontally centered in the slide frame`,
        );
        assert.ok(
          fit.slideImage.height >= fit.clientHeight * 0.44,
          `${slideLabel} artwork should be large enough to anchor the full-screen deck`,
        );
      }
      if (fit.slideKey === 'looking-for') {
        const ideasBullet = fit.bulletTexts.find((bullet) => bullet.text === 'Ideas for further tools');
        assert.ok(ideasBullet, `${slideLabel} should render the Ideas bullet`);
        assert.ok(
          ideasBullet.right <= fit.slideLayout.right - 10,
          `${slideLabel} Ideas bullet should keep a right inset; received ${JSON.stringify({ bulletRight: ideasBullet.right, panelRight: fit.slideLayout.right })}`,
        );
        fit.bulletTexts.forEach((bullet) => {
          assert.ok(
            bullet.scrollWidth <= bullet.clientWidth + 1,
            `${slideLabel} ${bullet.text} should wrap without horizontal clipping`,
          );
          assert.ok(
            bullet.top >= fit.slideLayout.top + 1 && bullet.bottom <= fit.slideLayout.bottom - 1,
            `${slideLabel} ${bullet.text} should remain vertically inside the slide panel; received ${JSON.stringify({ bulletTop: bullet.top, bulletBottom: bullet.bottom, panelTop: fit.slideLayout.top, panelBottom: fit.slideLayout.bottom })}`,
          );
        });
        assert.equal(fit.finalAction?.text, 'See Tools', `${slideLabel} should expose the final action`);
        if (themeId === 'classic-95') {
          assert.equal(
            fit.slideImageBlendMode,
            'normal',
            `${slideLabel} should preserve illustration detail without blend-mode washout`,
          );
          assert.ok(
            fit.slideImageOpacity >= 0.5,
            `${slideLabel} artwork should remain visible; received opacity ${fit.slideImageOpacity}`,
          );
          assert.equal(
            fit.finalAction.backgroundColor,
            'rgb(192, 192, 192)',
            `${slideLabel} final action should use the Classic control face`,
          );
          assert.equal(fit.finalAction.color, 'rgb(0, 0, 0)', `${slideLabel} final action text should be black`);
        } else {
          assert.equal(
            fit.slideImageBlendMode,
            'lighten',
            `${slideLabel} should preserve the Context Engine artwork blend`,
          );
          assert.notEqual(
            fit.finalAction.backgroundColor,
            'rgb(192, 192, 192)',
            `${slideLabel} should not inherit the Classic control face`,
          );
        }
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
  const authoringOnly = process.argv.includes('--authoring-only');
  const loginOnly = process.argv.includes('--login-only');
  const statsOnly = process.argv.includes('--stats-only');
  const sessionOnly = process.argv.includes('--session-only');
  const sessionSetupOnly = process.argv.includes('--session-setup-only');
  const footerOnly = process.argv.includes('--footer-only');
  const aboutOnly = process.argv.includes('--about-only');
  const docsOnly = process.argv.includes('--docs-only');
  const tagOnly = process.argv.includes('--tag-only');
  const toolCardsOnly = process.argv.includes('--tool-cards-only');
  const routeCases = aboutOnly
    ? ROUTE_CASES.filter((routeCase) => routeCase.requiresClassicAboutHeroControls)
    : docsOnly
      ? ROUTE_CASES.filter((routeCase) => routeCase.requiresReadableDocs)
    : tagOnly
      ? ROUTE_CASES.filter((routeCase) => routeCase.requiresReadableTagRelatedChips)
    : homeTabsOnly
      ? ROUTE_CASES.filter((routeCase) => routeCase.requiresSpreadHomeTabs)
    : authoringOnly
      ? ROUTE_CASES.filter((routeCase) => routeCase.requiresReadableAuthoring)
      : loginOnly
        ? ROUTE_CASES.filter((routeCase) => routeCase.requiresReadableLogin).map((routeCase) => ({
            path: routeCase.path,
            label: 'login modal surface',
            requiresReadableLogin: true,
            requiresPreloginControlLayout: true,
            requiresPreloginThemeSettings: true,
          }))
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
  const viewports = aboutOnly
    ? FOOTER_VIEWPORTS
    : docsOnly
      ? DOCS_VIEWPORTS
    : tagOnly
      ? TAG_VIEWPORTS
    : toolCardsOnly
      ? TOOL_CARD_VIEWPORTS
    : homeTabsOnly
      ? HOME_TAB_VIEWPORTS
      : authoringOnly
        ? AUTHORING_VIEWPORTS
      : loginOnly
        ? LOGIN_VIEWPORTS
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
      !aboutOnly &&
      !docsOnly &&
      !tagOnly &&
      !homeTabsOnly &&
      !authoringOnly &&
      !loginOnly &&
      !questionUtilitiesOnly &&
      !statsOnly &&
      !sessionOnly &&
      !sessionSetupOnly &&
      !footerOnly &&
      !toolCardsOnly
    ) {
      for (const themeId of WELCOME_FIT_THEME_IDS) {
        for (const viewport of WELCOME_FIT_VIEWPORTS) {
          await assertWelcomeSlideGeometry(browser, baseUrl, viewport, themeId);
        }
      }
    }
    console.log(
      welcomeFitOnly
        ? `Welcome fit Playwright smoke passed (${WELCOME_FIT_THEME_IDS.length} themes × ${WELCOME_FIT_VIEWPORTS.length} viewports).`
        : aboutOnly
          ? `Classic 95 About hero Playwright smoke passed (${viewports.length} viewports).`
        : docsOnly
          ? `Classic 95 Docs structure Playwright smoke passed (${viewports.length} viewports).`
        : tagOnly
          ? `Related-tag contrast Playwright smoke passed (${viewports.length} viewports × 2 themes).`
        : homeTabsOnly
          ? `Classic 95 home tab-spacing Playwright smoke passed (${viewports.length} viewports).`
          : authoringOnly
            ? `Authoring source-control Playwright smoke passed (${viewports.length} viewports).`
          : loginOnly
            ? `Solid login-surface Playwright smoke passed (${viewports.length} viewports).`
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
