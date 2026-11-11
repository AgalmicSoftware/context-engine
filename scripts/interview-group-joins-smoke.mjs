import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { chromium } from 'playwright';

// Interview review's Groups section against a fake Worker: a join link's group ticked, every match
// unticked, Submit and join, each join's outcome, and the switch in Settings.
// Checks readable text in every theme, at phone and desktop widths, hovered, focused and pressed.
const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local Vite server');
const output = process.env.OUTPUT_DIR || '';
if (output) await fs.mkdir(output, { recursive: true });

const worker = 'https://worker.example.test';
const images = 'https://images.example.test';
const sessionSlug = 'fixture';
const sessionId = `0x${'1'.repeat(32)}`;
const account = '0x0000000000000000000000000000000000000001';
// A small solid-colour PNG for each group's image.
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (bytes) => {
  let c = 0xffffffff;
  for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const pngChunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), data.length + 8);
  return out;
};
const solidPng = ([r, g, b], size = 48) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits per channel
  header[9] = 2; // RGB
  const row = Buffer.from([0, ...Array.from({ length: size }, () => [r, g, b]).flat()]);
  const pixels = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
};

const groups = [
  ['salon', 'Reverse Alignment Salon', 'Everyone taking part in the salon.', [42, 157, 143]],
  ['dacc', 'd/acc', 'Defensive, decentralised acceleration.', [231, 111, 81]],
  ['uk', 'UK residents', 'People who live in the United Kingdom.', [38, 70, 83]],
  ['builders', 'Builders', 'People who build AI tools.', [233, 196, 106]],
].map(([groupId, label, description, colour]) => ({
  groupId,
  sessionSlug,
  label,
  description,
  imageUrl: `${images}/${groupId}.png`,
  colour,
  joinMode: 'open',
  memberVisibility: 'session',
}));
const workerGroups = groups.map(({ colour: _colour, ...group }) => group);

const probe = (theme, state) => `<!doctype html><html data-ce-theme="${theme}" data-ce-theme-source="user"><head>
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="padding:16px;margin:0;background:var(--ce-canvas);color:var(--ce-text)"><main id="probe"></main>
<script type="module">
  import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
  window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
  await import('/src/assets/css/contextEngine.scss');
  const ReactModule = await import('/node_modules/.vite/deps/react.js'); const React = ReactModule.default || ReactModule;
  const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
  const root = (ReactDOM.createRoot || ReactDOM.default.createRoot)(document.getElementById('probe'));
  if (${JSON.stringify(state)} === 'settings') {
    // Inside the wrappers that /new and session Settings put around their sections.
    const { SetupParticipationSection } = await import('/src/components/Sessions/setup/SetupContentSections.tsx');
    const { default: wizardStyles } = await import('/src/components/Sessions/SessionWizard.module.scss');
    const { default: setupStyles } = await import('/src/components/Sessions/setup/SessionSetup.module.scss');
    const Settings = () => {
      const [draft, setDraft] = React.useState({ interviewModeEnabled: true, interviewMode: {} });
      const onChange = (keys, value) => setDraft((current) => ({ ...current, [keys[0]]: value }));
      return React.createElement('div', { className: wizardStyles.groupWizard },
        React.createElement('div', { className: setupStyles.page },
          React.createElement(SetupParticipationSection, { draft, onChange, open: true, onToggle: () => {}, supportsEndTime: true })));
    };
    root.render(React.createElement(Settings));
  } else {
    const { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } = await import('/src/utilities/session/sessionModeProfile.ts');
    const tokens = await import('/src/utilities/worker/workerAuthTokenCache.ts');
    const { default: Modal } = await import('/src/components/SurveyTool/SessionVoiceModeModal.tsx');
    const signedIn = ${JSON.stringify(state)} === 'in';
    sessionStorage.setItem('ce:worker-group-auto-join:v1', JSON.stringify({ version: 1, sessionSlug: '${sessionSlug}', groupId: 'salon', workerOrigin: '${worker}', sessionId: '${sessionId}', createdAt: Date.now() }));
    if (signedIn) {
      // Sign-in leaves the account in the store, which Worker sign-in checks against.
      const { default: store } = await import('/src/store.ts');
      const { changeAccount } = await import('/src/actions/accountActions.ts');
      store.dispatch(changeAccount({ account: '${account}', provider: 'passkey' }));
    }
    if (signedIn) tokens.writeTokenCache(
      tokens.buildTokenCacheKey({ workerUrl: '${worker}', slug: '${sessionSlug}', sessionId: '${sessionId}', address: '${account}' }),
      tokens.buildTokenCacheEnvelope({ token: 'fixture-token', exp: Math.floor(Date.now() / 1000) + 3600, workerUrl: '${worker}', sessionSlug: '${sessionSlug}', sessionId: '${sessionId}', address: '${account}' }),
    );
    const questions = [
      { id: 'camp', type: 'multichoice', singleSelect: true, prompt: 'Which camp are you closest to?', options: ['d/acc', 'e/acc'] },
      { id: 'home', type: 'freeform', prompt: 'Where do you live?' },
      { id: 'priority', type: 'freeform', prompt: 'What should AI governance prioritise?' },
    ];
    const packet = {
      version: 1, sessionSlug: '${sessionSlug}',
      source: { platform: 'claude', modelId: 'fixture', verification: 'self_reported' }, responderContext: {},
      responses: [
        { questionId: 'camp', answer: 'd/acc', confidence: 0.8, evidence: 'Stated' },
        { questionId: 'home', answer: 'The United Kingdom', confidence: 0.9, evidence: 'Stated' },
        { questionId: 'priority', answer: 'Audits that outsiders can check', confidence: 0.6, evidence: 'Inferred' },
      ],
      groups: [
        { groupId: 'uk', reason: 'Lives in the UK', confidence: 0.9 },
        { groupId: 'builders', reason: 'Mentions side projects', confidence: 0.5 },
      ],
    };
    const sessionConfig = {
      slug: '${sessionSlug}', sessionId: '${sessionId}', corsWorkerUrl: '${worker}/',
      interviewMode: { joinMatchingGroups: true },
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      workerAuthority: { version: 1, participantScopes: ['storage'], anonymousScopes: [] },
      storageProfile: { backend: 'cloudflare', resources: { questions: 'active', surveys: 'active' }, payloadAccessControl: { gate: 'none', encryption: 'none' } },
    };
    root.render(React.createElement(Modal, {
      isOpen: true, mode: 'interview', onClose: () => {}, onSelectMode: () => {}, toggleLoginModal: () => {},
      sessionSlug: '${sessionSlug}', workerUrl: '${worker}', questionPool: questions, prefillPacket: packet, sessionConfig,
      account: signedIn ? '${account}' : '', loginComplete: signedIn, isResponsesCacheReady: true,
      existingResponseSlice: null, onApplyAnswer: () => {}, onApplyAdditional: () => {}, onApplyImportance: () => {},
      onApplyConviction: () => {}, onRecordProvenance: () => {},
      onSubmitResponses: async () => ({ status: 'submitted' }),
    }));
  }
</script></body></html>`;

// Each element's own text against what is painted behind it, half-transparent layers included.
const readContrast = (root) => {
  const parse = (value) => {
    const [r = 0, g = 0, b = 0, a = 1] = (value.match(/[\d.]+/g) || []).map(Number);
    return { r, g, b, a };
  };
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const behind = (element) => {
    const layers = [];
    for (let node = element; node; node = node.parentElement) {
      const color = parse(getComputedStyle(node).backgroundColor);
      if (color.a > 0) layers.push(color);
      if (color.a >= 1) break;
    }
    return layers.reverse().reduce((color, layer) => over(layer, color), {
      r: 255,
      g: 255,
      b: 255,
      a: 1,
    });
  };
  const luminance = ({ r, g, b }) =>
    [r, g, b]
      .map((value) => value / 255)
      .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const readings = [];
  for (const element of [root, ...root.querySelectorAll('*')]) {
    const text = [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent.trim())
      .join(' ')
      .trim();
    if (!text || element.closest('[hidden]') || !element.getClientRects().length) continue;
    const style = getComputedStyle(element);
    if (style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
    const background = behind(element);
    const foreground = over(parse(style.color), background);
    const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    readings.push({
      text: text.slice(0, 48),
      ratio: Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100,
    });
  }
  return readings;
};

const expectReadable = async (locator, label) => {
  const readings = await locator.evaluate(readContrast);
  assert(readings.length, `${label}: no text measured`);
  const low = readings.filter(({ ratio }) => ratio < 4.5);
  assert.deepEqual(low, [], `${label}: text below 4.5:1`);
  return Math.min(...readings.map(({ ratio }) => ratio));
};

// Hovered, focused and pressed, without letting a press become a click.
const expectReadableInStates = async (page, target, region, label) => {
  const lowest = [await expectReadable(region, `${label} normal`)];
  await target.hover();
  lowest.push(await expectReadable(region, `${label} hover`));
  await target.focus();
  lowest.push(await expectReadable(region, `${label} focus`));
  const box = await target.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  lowest.push(await expectReadable(region, `${label} pressed`));
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await page.locator('body').evaluate((body) => document.activeElement?.blur?.() ?? body);
  return Math.min(...lowest);
};

// The label follows the ticks a render later, so wait for it rather than read it once.
const expectSubmitLabel = (page, label) =>
  page.waitForFunction(
    (expected) =>
      document.querySelector('[data-testid="ce-session-interview-apply"]')?.textContent.trim().toLowerCase() ===
      expected,
    label,
  );

const browser = await chromium.launch({ headless: true });
const joined = [];
try {
  for (const theme of ['civic', 'context-engine', 'classic-95']) {
    for (const width of [375, 1280]) {
      const run = async (state) => {
        const page = await browser.newPage({
          viewport: { width, height: 1000 },
        });
        page.setDefaultTimeout(20000);
        const failures = [];
        page.on('pageerror', (error) => failures.push(error.message));
        await page.route('**/*', async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.origin === new URL(base).origin) {
            if (url.pathname === '/group-joins-probe')
              return route.fulfill({
                contentType: 'text/html',
                body: probe(theme, state),
              });
            return route.continue();
          }
          if (url.origin === images) {
            const group = groups.find(({ groupId }) => url.pathname === `/${groupId}.png`);
            return group ? route.fulfill({ contentType: 'image/png', body: solidPng(group.colour) }) : route.abort();
          }
          if (url.origin !== worker) return route.abort();
          const reply = (body, status = 200) =>
            route.fulfill({
              status,
              contentType: 'application/json',
              body: JSON.stringify(body),
            });
          const identity = { sessionId, sessionSlug };
          if (url.pathname === '/groups/list') return reply({ ok: true, ...identity, groups: workerGroups });
          if (url.pathname === '/groups/my-memberships') return reply({ ok: true, ...identity, memberships: [] });
          if (url.pathname === '/groups/join') {
            const { groupId } = JSON.parse(request.postData() || '{}');
            if (groupId === 'uk') return reply({ ok: false, reason: 'worker_group_member_cap_exceeded' }, 409);
            joined.push(groupId);
            const group = workerGroups.find((candidate) => candidate.groupId === groupId);
            return reply({
              ok: true,
              ...identity,
              group,
              member: { groupId, sessionSlug },
              memberCount: 1,
            });
          }
          return reply({ error: 'Not found.' }, 404);
        });
        await page.goto(`${base}/group-joins-probe`);
        return { page, failures };
      };

      // Signed out, with a join link: the review before submitting.
      {
        const { page, failures } = await run('out');
        const section = page.getByTestId('ce-session-interview-group-recommendations');
        await section.waitFor().catch(async (error) => {
          console.error(await page.locator('body').innerText(), failures);
          throw error;
        });
        await page.getByRole('heading', { name: 'Groups (4)' }).waitFor();
        await page.waitForFunction(() =>
          [...document.querySelectorAll('.modal')].some((element) => Number(getComputedStyle(element).opacity) === 1),
        );
        const box = (name) => section.getByRole('checkbox', { name });
        const names = await section
          .locator('label strong')
          .evaluateAll((elements) => elements.map((element) => element.textContent));
        assert.deepEqual(names, ['Reverse Alignment Salon', 'd/acc', 'UK residents', 'Builders']);
        assert.equal(await box(/Reverse Alignment Salon/).isChecked(), true);
        assert.equal(await box(/d\/acc/).isChecked(), false);
        assert.equal(await box(/UK residents/).isChecked(), false);
        assert.equal(await box(/Builders/).isChecked(), false);
        await section.getByText('From your link.').waitFor();
        // Each group's image shows beside its name, loaded, with no text of its own.
        await page.waitForFunction(
          () =>
            [...document.querySelectorAll('[data-testid^="ce-session-interview-group-image-"]')].filter(
              (image) => image.complete && image.naturalWidth > 0,
            ).length === 4,
        );
        assert.deepEqual(
          await section
            .locator('label img')
            .evaluateAll((elements) => elements.map((element) => element.getAttribute('alt'))),
          ['', '', '', ''],
        );
        await section.getByText('Your AI: Lives in the UK').waitFor();
        const submit = page.getByTestId('ce-session-interview-apply');
        await expectSubmitLabel(page, 'submit and join');
        // The link's own notice stands aside while its group is listed here.
        assert.equal(await page.getByTestId('ce-session-worker-group-auto-join').count(), 0);
        const rows = section.locator('label');
        let lowest = Infinity;
        for (let index = 0; index < (await rows.count()); index += 1) {
          const row = rows.nth(index);
          lowest = Math.min(
            lowest,
            await expectReadableInStates(page, row.getByRole('checkbox'), row, `${theme} ${width} row ${index}`),
          );
        }
        lowest = Math.min(lowest, await expectReadableInStates(page, submit, submit, `${theme} ${width} submit`));
        const header = section.locator('xpath=ancestor::details[1]').locator('summary');
        lowest = Math.min(lowest, await expectReadable(header, `${theme} ${width} heading`));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        await box(/Builders/).check();
        await box(/Builders/).uncheck();
        await box(/Reverse Alignment Salon/).uncheck();
        await expectSubmitLabel(page, 'submit responses');
        await box(/Reverse Alignment Salon/).check();
        await box(/d\/acc/).check();
        await box(/UK residents/).check();
        await expectSubmitLabel(page, 'submit and join');
        if (output) {
          await page.evaluate(() => document.activeElement?.blur());
          await page.mouse.move(0, 0);
          await section.locator('xpath=ancestor::details[1]').scrollIntoViewIfNeeded();
          await page.screenshot({
            path: path.join(output, `before-${theme}-${width}.png`),
            animations: 'disabled',
          });
          await section.locator('xpath=ancestor::details[1]').screenshot({
            path: path.join(output, `groups-${theme}-${width}.png`),
            animations: 'disabled',
          });
        }
        assert.deepEqual(failures, []);
        console.log(
          `PASS Groups before submit ${theme} ${width}: ticks, link, Submit and join, lowest contrast ${lowest}`,
        );
        await page.close();
      }

      // Signed in: Submit and join, and what each join did.
      {
        const { page, failures } = await run('in');
        const section = page.getByTestId('ce-session-interview-group-recommendations');
        await page.getByRole('heading', { name: 'Groups (4)' }).waitFor();
        await section.getByRole('checkbox', { name: /d\/acc/ }).check();
        await section.getByRole('checkbox', { name: /UK residents/ }).check();
        const before = joined.length;
        await page.getByTestId('ce-session-interview-apply').click();
        await section.getByText('Joined Reverse Alignment Salon and d/acc.').waitFor();
        assert.deepEqual(joined.slice(before), ['salon', 'dacc']);
        const alert = section.getByRole('alert');
        assert.equal(await alert.innerText(), 'Couldn’t join UK residents: it is full.');
        const retry = section.getByRole('button', {
          name: 'Join ticked groups',
        });
        let lowest = await expectReadable(section, `${theme} ${width} outcome`);
        lowest = Math.min(lowest, await expectReadableInStates(page, retry, retry, `${theme} ${width} join ticked`));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        if (output) {
          await page.evaluate(() => document.activeElement?.blur());
          await page.mouse.move(0, 0);
          await retry.scrollIntoViewIfNeeded();
          await page.screenshot({
            path: path.join(output, `after-${theme}-${width}.png`),
            animations: 'disabled',
          });
        }
        assert.deepEqual(failures, []);
        console.log(`PASS Groups after submit ${theme} ${width}: joined two, one full, lowest contrast ${lowest}`);
        await page.close();
      }

      // The switch in Interview settings, with its help, then what the AI may use.
      {
        const { page, failures } = await run('settings');
        const toggle = page.getByLabel('Suggest groups to join');
        await toggle.waitFor();
        const row = toggle.locator('xpath=ancestor::div[1]');
        let lowest = await expectReadableInStates(page, toggle, row, `${theme} ${width} setting`);
        await toggle.check();
        assert.equal(await toggle.isChecked(), true);
        await page.getByRole('button', { name: 'About suggesting groups to join' }).hover();
        const tooltip = page.getByRole('tooltip');
        await tooltip.waitFor();
        if (output)
          await page.screenshot({
            path: path.join(output, `setting-${theme}-${width}.png`),
          });
        assert.match(
          await tooltip.innerText(),
          /They tick any they want, and submitting joins them.*Off, no groups are matched/,
        );
        lowest = Math.min(lowest, await expectReadable(tooltip, `${theme} ${width} setting help`));
        await page.mouse.move(0, 0);
        await tooltip.waitFor({ state: 'hidden' });
        const data = page.getByRole('group', { name: 'The AI may use' });
        assert.deepEqual(
          await data
            .getByRole('checkbox')
            .evaluateAll((boxes) => boxes.map((box) => [box.closest('label').textContent.trim(), box.checked])),
          [
            ['Country', true],
            ['Town or city', false],
            ['Work', true],
            ['Interests and causes', true],
          ],
        );
        const town = data.getByLabel('Town or city');
        lowest = Math.min(lowest, await expectReadableInStates(page, town, data, `${theme} ${width} AI may use`));
        await town.check();
        assert.equal(await town.isChecked(), true);
        await data.getByRole('button', { name: 'About what the AI may use' }).hover();
        await tooltip.waitFor();
        if (output) await page.screenshot({ path: path.join(output, `setting-data-${theme}-${width}.png`) });
        assert.match(
          await tooltip.innerText(),
          /Town or city means anywhere smaller than a country.*suggested either way/,
        );
        lowest = Math.min(lowest, await expectReadable(tooltip, `${theme} ${width} AI may use help`));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        assert.deepEqual(failures, []);
        console.log(`PASS Setting ${theme} ${width}: switch, help, what the AI may use, lowest contrast ${lowest}`);
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
