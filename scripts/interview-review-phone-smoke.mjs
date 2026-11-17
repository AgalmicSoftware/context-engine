import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

// The interview's review on a phone: Submit floats at the foot of the dialog whatever the number of questions,
// and stays reachable with "AI submission info" open. Renders the review against a fake Worker.
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
assert(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Use a local Vite server",
);
const output = process.env.OUTPUT_DIR || "";
const label = process.env.LABEL || "after";
if (output) await fs.mkdir(output, { recursive: true });
const counts = (process.env.QUESTION_COUNTS || "5,20,40")
  .split(",")
  .map(Number);
const themes = (process.env.THEMES || "civic,context-engine,classic-95").split(
  ",",
);
// [width, visible height, large height]. A phone browser shows its bars over part of a larger viewport: there
// `vh` and a fixed box's 100% count the large height and `dvh` the visible one, which desktop Chromium can't
// model, so the large phone rows rewrite those units to the large height. 440 × 755/956 is Brave on an iPhone
// Pro Max with its bottom bar shown, measured from a real screenshot; the others are rough.
const sizes = [
  [375, 667, 667],
  [375, 553, 667],
  [393, 659, 852],
  [440, 755, 956],
  [440, 956, 956],
  [466, 800, 800],
  [1280, 900, 900],
];
const worker = "https://worker.example.test";
const sessionSlug = "fixture";
const sessionId = `0x${"1".repeat(32)}`;

const probe = (
  theme,
  count,
) => `<!doctype html><html data-ce-theme="${theme}" data-ce-theme-source="user"><head>
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:var(--ce-canvas);color:var(--ce-text)"><main id="probe"></main>
<script type="module">
  import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
  window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
  await import('/src/assets/css/contextEngine.scss');
  const ReactModule = await import('/node_modules/.vite/deps/react.js'); const React = ReactModule.default || ReactModule;
  const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
  const root = (ReactDOM.createRoot || ReactDOM.default.createRoot)(document.getElementById('probe'));
  const { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } = await import('/src/utilities/session/sessionModeProfile.ts');
  const { default: Modal } = await import('/src/components/SurveyTool/SessionVoiceModeModal.tsx');
  const questions = Array.from({ length: ${count} }, (_, index) => ({
    id: 'q' + index, type: 'freeform', prompt: 'Question ' + (index + 1) + ': what should AI governance prioritise next?',
  }));
  const packet = {
    version: 1, sessionSlug: '${sessionSlug}',
    source: { platform: 'claude', modelId: 'fixture', verification: 'self_reported' }, responderContext: { name: 'Sam' },
    responses: questions.map((question) => ({
      questionId: question.id, answer: 'Audits that outsiders can check, and a public record of what was found.',
      confidence: 0.7, evidence: 'Stated',
    })),
  };
  const sessionConfig = {
    slug: '${sessionSlug}', sessionId: '${sessionId}', corsWorkerUrl: '${worker}/',
    sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    workerAuthority: { version: 1, participantScopes: ['storage'], anonymousScopes: [] },
    storageProfile: { backend: 'cloudflare', resources: { questions: 'active', surveys: 'active' }, payloadAccessControl: { gate: 'none', encryption: 'none' } },
  };
  root.render(React.createElement(Modal, {
    isOpen: true, mode: 'interview', onClose: () => {}, onSelectMode: () => {}, toggleLoginModal: () => {},
    sessionSlug: '${sessionSlug}', workerUrl: '${worker}', questionPool: questions, prefillPacket: packet, sessionConfig,
    account: '', loginComplete: false, isResponsesCacheReady: true,
    existingResponseSlice: null, onApplyAnswer: () => {}, onApplyAdditional: () => {}, onApplyImportance: () => {},
    onApplyConviction: () => {}, onRecordProvenance: () => {},
    onSubmitResponses: async () => ({ status: 'submitted' }),
  }));
</script></body></html>`;

// Where Submit is against the screen, and the element that scrolls the dialog.
const measure = (page) =>
  page.evaluate(() => {
    const submit = document.querySelector(
      '[data-testid="ce-session-interview-apply"]',
    );
    const box = submit.getBoundingClientRect();
    const scroller = (() => {
      for (let node = submit.parentElement; node; node = node.parentElement) {
        const { overflowY } = getComputedStyle(node);
        if (
          /(auto|scroll)/.test(overflowY) &&
          node.scrollHeight > node.clientHeight
        )
          return node;
      }
      return document.scrollingElement;
    })();
    const bar = submit.parentElement.getBoundingClientRect();
    return {
      submitVisible:
        box.top >= 0 && box.bottom <= window.innerHeight && box.height > 0,
      submitTop: Math.round(box.top),
      viewport: window.innerHeight,
      barHeight: Math.round(bar.height),
      scroller:
        scroller === document.scrollingElement
          ? "page"
          : scroller.className.split(" ")[0].slice(0, 40),
      atEnd:
        Math.abs(
          scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop,
        ) < 2,
    };
  });

// Where the dialog sits, and whether the overlay itself scrolls (on a phone it springs back under the finger).
const dialogBox = (page) =>
  page.evaluate(() => {
    const content = document.querySelector(".modal.show .modal-content");
    const overlay = content.closest(".modal");
    const box = content.getBoundingClientRect();
    return {
      dialogTop: Math.round(box.top),
      dialogBottom: Math.round(box.bottom),
      overlayScroll: overlay.scrollHeight - overlay.clientHeight,
    };
  });

// Gives `vh` and the overlay's 100% the large viewport's height, as a phone browser does with its bars shown.
const simulateBars = (page, large) =>
  page.evaluate((largeHeight) => {
    const toPx = (value) =>
      value.replace(
        /(\d*\.?\d+)vh\b/g,
        (_, amount) => `${(amount * largeHeight) / 100}px`,
      );
    const walk = (rules) => {
      for (const rule of rules) {
        if (rule.cssRules) walk(rule.cssRules);
        if (!rule.style) continue;
        for (const property of [...rule.style]) {
          const value = rule.style.getPropertyValue(property);
          if (/\dvh\b/.test(value))
            rule.style.setProperty(
              property,
              toPx(value),
              rule.style.getPropertyPriority(property),
            );
        }
        if (rule.selectorText === ".modal" && rule.style.height === "100%")
          rule.style.setProperty("height", `${largeHeight}px`);
      }
    };
    for (const sheet of document.styleSheets) walk(sheet.cssRules);
  }, large);

const scrollDialog = (page, where) =>
  page.evaluate((to) => {
    const submit = document.querySelector(
      '[data-testid="ce-session-interview-apply"]',
    );
    for (let node = submit.parentElement; node; node = node.parentElement) {
      const { overflowY } = getComputedStyle(node);
      if (
        /(auto|scroll)/.test(overflowY) &&
        node.scrollHeight > node.clientHeight
      ) {
        node.scrollTop = to === "top" ? 0 : node.scrollHeight;
      }
    }
    window.scrollTo(0, to === "top" ? 0 : document.body.scrollHeight);
  }, where);

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const theme of themes) {
    for (const [width, height, large] of sizes) {
      for (const count of counts) {
        const page = await browser.newPage({ viewport: { width, height } });
        page.setDefaultTimeout(20000);
        await page.route("**/*", async (route) => {
          const url = new URL(route.request().url());
          if (url.origin === new URL(base).origin) {
            if (url.pathname === "/interview-phone-probe")
              return route.fulfill({
                contentType: "text/html",
                body: probe(theme, count),
              });
            return route.continue();
          }
          if (url.origin !== worker) return route.abort();
          return route.fulfill({
            status: 404,
            contentType: "application/json",
            body: '{"error":"Not found."}',
          });
        });
        const failures = [];
        page.on("pageerror", (error) => failures.push(error.message));
        await page.goto(`${base}/interview-phone-probe`);
        await page
          .getByTestId("ce-session-interview-apply")
          .waitFor()
          .catch(async (error) => {
            console.error(
              (await page.locator("body").innerText()).slice(0, 1500),
              failures,
            );
            throw error;
          });
        if (large > height) await simulateBars(page, large);
        // The dialog slides in; measure where it settles.
        await page.waitForFunction(() => {
          const dialog = document.querySelector(".modal.show .modal-dialog");
          return dialog && getComputedStyle(dialog).transform === "none";
        });
        await page.waitForTimeout(400);
        const name = `${label}-${theme}-${width}x${height}-${count}q`;
        const closedTop = {
          ...(await measure(page)),
          ...(await dialogBox(page)),
        };
        if (output)
          await page.screenshot({ path: path.join(output, `${name}-top.png`) });
        await page.getByText("AI submission info", { exact: true }).click();
        await page.waitForTimeout(200);
        await scrollDialog(page, "end");
        await page.waitForTimeout(200);
        const openEnd = {
          ...(await measure(page)),
          ...(await dialogBox(page)),
        };
        if (output)
          await page.screenshot({
            path: path.join(output, `${name}-open.png`),
          });
        results.push({ theme, width, height, count, closedTop, openEnd });
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
for (const { theme, width, height, count, closedTop, openEnd } of results) {
  console.log(
    `${theme} ${width}x${height} ${count}q | dialog ${closedTop.dialogTop}-${closedTop.dialogBottom}, overlay scroll ${closedTop.overlayScroll} | top: submit ${closedTop.submitVisible ? "visible" : "HIDDEN"} (y=${closedTop.submitTop}/${closedTop.viewport}, bar ${closedTop.barHeight}px, scroller ${closedTop.scroller}) | info open, scrolled to end: submit ${openEnd.submitVisible ? "visible" : "HIDDEN"} (y=${openEnd.submitTop}, bar ${openEnd.barHeight}px)`,
  );
}
// On a phone a full review fills the screen from near the top, and only the dialog's body scrolls.
const phoneMisfit = ({ width, count, closedTop, openEnd }) =>
  width < 576 &&
  count >= 20 &&
  (closedTop.dialogTop < 0 ||
    closedTop.dialogTop > 16 ||
    closedTop.dialogBottom > closedTop.viewport ||
    closedTop.overlayScroll > 0 ||
    openEnd.overlayScroll > 0);
if (process.env.CHECK !== "0") {
  const failed = results.filter(
    (result) =>
      !result.closedTop.submitVisible ||
      !result.openEnd.submitVisible ||
      phoneMisfit(result),
  );
  assert.deepEqual(
    failed.map(
      ({ theme, width, height, count }) =>
        `${theme} ${width}x${height} ${count}q`,
    ),
    [],
    "Submit out of reach",
  );
}
