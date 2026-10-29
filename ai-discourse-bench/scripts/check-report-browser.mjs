#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { renderHtmlReport } from '../src/render-html.mjs';
import { buildResultsReport } from '../src/scoring.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, argv) => (
  value.startsWith('--') ? [...pairs, [value.slice(2), argv[index + 1]]] : pairs
), []));
const outDir = path.resolve(args['out-dir'] || '/tmp/ai-discourse-bench-browser');
await mkdir(outDir, { recursive: true });

const fixture = (disconnected = false) => {
  const models = ['mixed-a', 'mixed-b', 'mostly-unsure', 'all-unsure'];
  const questionIds = disconnected ? ['q1', 'q2', 'q3', 'q4'] : ['q1', 'q2'];
  const answers = {
    'mixed-a': ['Agree', 'Disagree'],
    'mixed-b': ['Agree', 'Disagree'],
    'mostly-unsure': [...Array(19).fill('Unsure'), 'Disagree'],
    'all-unsure': ['Unsure'],
  };
  return buildResultsReport({
    questionBank: { benchmarkId: 'browser-fixture', questions: questionIds.map((id) => ({ id, canonicalPrompt: `Observed answers and model means for ${id}.`, reversedPrompt: `Opposite statement for ${id}.`, topic: 'test-topic' })) },
    modelRoster: { models: models.map((id) => ({ id, label: id, model: id, provider: 'local', traits: { cohort: id.startsWith('mixed') ? 'mixed' : 'uncertain' } })) },
    runsFile: { repeats: 10, runs: models.flatMap((modelId, index) => (
      (disconnected ? questionIds.slice(index < 2 ? 0 : 2, index < 2 ? 2 : 4) : questionIds).flatMap((questionId) => answers[modelId].flatMap((normalizedAnswer) => (
        ['canonical', 'reversed'].map((polarity) => ({ modelId, questionId, polarity, normalizedAnswer }))
      )))
    )) },
  });
};

const report = args.report ? JSON.parse(await readFile(path.resolve(args.report), 'utf8')) : fixture();
const reportPath = path.join(outDir, 'report.html');
await writeFile(reportPath, renderHtmlReport(report));
const browser = await chromium.launch({ headless: true });
const errors = [];
const checks = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  // Font downloads are not needed for functional checks; do not depend on a
  // remote CDN becoming available before an offline artifact can be inspected.
  await page.route('https://**/*', (route) => route.abort());
  for (const [name, width, height] of [['desktop', 1280, 900], ['mobile', 390, 844], ['narrow-mobile', 320, 800]]) {
    await page.setViewportSize({ width, height });
    await page.goto(pathToFileURL(reportPath).href, { waitUntil: 'load' });
    const row = page.locator('#all-questions .questionListItem').first();
    await row.scrollIntoViewIfNeeded();
    const geometry = await page.locator('#all-questions').evaluate((section) => {
      const intersections = [];
      const outOfBounds = [];
      const tracks = [...section.querySelectorAll('[data-ce-model-stance-axis] .modelStanceTrack')];
      for (const track of tracks) {
        const bounds = track.parentElement.getBoundingClientRect();
        const markers = [...track.querySelectorAll('[data-ce-atlas-model-marker]')];
        markers.forEach((marker, index) => {
          const rect = marker.getBoundingClientRect();
          if (rect.left < bounds.left - 1 || rect.right > bounds.right + 1) outOfBounds.push(marker.dataset.ceAtlasModelMarker);
          markers.slice(index + 1).forEach((other) => {
            const otherRect = other.getBoundingClientRect();
            if (Math.min(rect.right, otherRect.right) > Math.max(rect.left, otherRect.left)
              && Math.min(rect.bottom, otherRect.bottom) > Math.max(rect.top, otherRect.top)) {
              intersections.push([marker.dataset.ceAtlasModelMarker, other.dataset.ceAtlasModelMarker]);
            }
          });
        });
      }
      return { tracks: tracks.length, intersections, outOfBounds, markersInHistogram: section.querySelectorAll('[data-ce-atlas-question-vote-bar] [data-ce-atlas-model-marker]').length };
    });
    assert.ok(geometry.tracks > 0);
    assert.deepEqual(geometry.intersections, [], `${name}: markers must not overlap`);
    assert.deepEqual(geometry.outOfBounds, [], `${name}: markers must fit their axis`);
    assert.equal(geometry.markersInHistogram, 0);
    const marker = row.locator('[data-ce-model-stance-tooltip]').first();
    await marker.focus();
    const tooltip = page.locator('[data-ce-beeswarm-tooltip]');
    assert.equal(await tooltip.isVisible(), true, `${name}: focused marker tooltip; runtime errors: ${errors.join('; ')}`);
    assert.match(await tooltip.textContent(), /Mean stance.*Observed answers:/);
    await page.screenshot({ path: path.join(outDir, `${name}-stance-focus.png`) });
    await marker.blur();
    await page.mouse.move(0, 0);
    await marker.hover();
    assert.equal(await tooltip.isVisible(), true, `${name}: hovered marker tooltip`);
    await page.mouse.move(0, 0);
    const question = page.locator('[data-ce-beeswarm-point]').first();
    await question.scrollIntoViewIfNeeded();
    await question.hover();
    assert.equal(await tooltip.isVisible(), true);
    assert.match(await tooltip.textContent(), /Agree:.*Unsure:.*Disagree:/);
    await page.screenshot({ path: path.join(outDir, `${name}-beeswarm-hover.png`) });
    await page.locator('[data-ce-report-view-mode="breakdown"]').click();
    const questionSelect = page.getByTestId('ce-breakdown-question-select');
    const options = await questionSelect.locator('option').evaluateAll((items) => items.map((option) => ({ value: option.value, text: option.textContent })));
    for (const option of [options[options.length - 1], options[0]]) {
      await questionSelect.selectOption(option.value);
      assert.equal(await page.getByTestId('demo-analysis-selected-question').innerText(), option.text);
    }
    await questionSelect.focus();
    const selectorBounds = await questionSelect.boundingBox();
    const panelBounds = await questionSelect.locator('..').boundingBox();
    assert.ok(selectorBounds && panelBounds && selectorBounds.x >= panelBounds.x && selectorBounds.x + selectorBounds.width <= Math.min(width, panelBounds.x + panelBounds.width), `${name}: question selector fits its panel and viewport`);
    await page.screenshot({ path: path.join(outDir, `${name}-breakdown-selector.png`) });
    checks.push({ viewport: name, width, ...geometry });
    await page.locator('[data-ce-report-view-mode="report"]').click();
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  const participant = page.locator('[data-ce-graph-participant-point]').first();
  if (await participant.count()) {
    await participant.scrollIntoViewIfNeeded();
    await participant.focus();
    assert.match(await page.locator('[data-ce-beeswarm-tooltip]').textContent(), /Opinion group:/);
    await page.screenshot({ path: path.join(outDir, 'desktop-participant-focus.png') });
    const count = page.locator('[data-ce-cluster-count-input]');
    await count.fill('2');
    await count.dispatchEvent('change');
    assert.match(await page.locator('[data-ce-opinion-group-status]').textContent(), /exploratory manual K-medoids/);
    await page.locator('[data-ce-cluster-auto]').click();
    assert.match(await page.locator('[data-ce-opinion-group-status]').textContent(), /exploratory automatically generated/);
  }
  const missingPath = path.join(outDir, 'missing-pairs.html');
  await writeFile(missingPath, renderHtmlReport(fixture(true)));
  await page.goto(pathToFileURL(missingPath).href, { waitUntil: 'load' });
  await page.locator('[data-ce-participant-embedding-unavailable]').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('[data-ce-graph-participant-point]').count(), 0);
  assert.equal(await page.locator('[data-ce-cluster-count-input]').count(), 0);
  await page.screenshot({ path: path.join(outDir, 'desktop-missing-pairs.png') });

  const incomplete = fixture();
  delete incomplete.polisReport.responseDistributionVersion;
  delete incomplete.polisReport.byModelQuestion['mixed-a'].q1.counts;
  const incompletePath = path.join(outDir, 'incomplete-counts.html');
  await writeFile(incompletePath, renderHtmlReport(incomplete));
  await page.goto(`${pathToFileURL(incompletePath).href}#tag-test-topic`, { waitUntil: 'load' });
  assert.equal(await page.locator('[data-ce-tag-modal] [data-ce-observed-distribution-unavailable]').count(), 1);
  await page.screenshot({ path: path.join(outDir, 'desktop-incomplete-legacy-tag.png') });
  await page.goto(pathToFileURL(incompletePath).href, { waitUntil: 'load' });
  const unavailablePoint = page.locator('[data-ce-beeswarm-point][data-question-distribution-unavailable="true"]').first();
  await unavailablePoint.scrollIntoViewIfNeeded();
  await unavailablePoint.hover();
  const unavailableTooltip = page.locator('[data-ce-beeswarm-tooltip]');
  assert.match(await unavailableTooltip.textContent(), /Observed answer distribution unavailable/);
  assert.doesNotMatch(await unavailableTooltip.textContent(), /Agree:/);
  await page.screenshot({ path: path.join(outDir, 'desktop-incomplete-legacy-hover.png') });
  assert.deepEqual(errors, [], 'report runtime errors');
  await writeFile(path.join(outDir, 'browser-checks.json'), `${JSON.stringify({ checks, runtimeErrors: errors, screenshots: outDir }, null, 2)}\n`);
  console.log(`Browser report checks passed at 1280px, 390px and 320px; evidence: ${outDir}`);
} finally {
  await browser.close();
}
