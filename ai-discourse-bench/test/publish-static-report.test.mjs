import assert from 'node:assert/strict';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildStaticReportPublication } from '../scripts/publish-static-report.mjs';
import { buildReleaseValidationReceipt, buildReportFingerprint } from '../src/provenance.mjs';
import { renderHtmlReport } from '../src/render-html.mjs';

const report = {
  title: 'AI Futures & Policy',
  generatedAt: '2026-08-10T00:00:00.000Z',
  counts: { questions: 500, models: 5 },
  integrity: { releaseReady: false, warnings: ['question bank is not validated'] },
};

test('static publication emits a deterministic compressed preview artifact', () => {
  const html = renderHtmlReport(report);
  const first = buildStaticReportPublication({ html, report, reportId: 'preview' });
  const second = buildStaticReportPublication({ html, report, reportId: 'preview' });

  assert.equal(first.entry.publicationStatus, 'development-preview');
  assert.equal(first.entry.questionCount, 500);
  assert.equal(first.entry.participantCount, 5);
  assert.equal(first.entry.sha256, second.entry.sha256);
  assert.equal(gunzipSync(first.artifactBytes).toString('utf8'), html);
  assert.throws(
    () => buildStaticReportPublication({ html: '<p>unbound preview</p>', report, reportId: 'preview' }),
    /HTML does not match the supplied report/,
  );
});

test('official static publication requires a release-ready report', () => {
  assert.throws(
    () => buildStaticReportPublication({ html: '<p>blocked</p>', report, reportId: 'blocked', requireRelease: true }),
    /question bank is not validated/,
  );

  const releaseReportBase = { ...report, integrity: { releaseReady: true, warnings: [] } };
  const releaseReport = {
    ...releaseReportBase,
    releaseValidationReceipt: buildReleaseValidationReceipt({
      report: releaseReportBase,
      questionBank: { benchmarkId: 'bank', questions: [] },
      modelRoster: { models: [] },
      runsFiles: [{ manifest: { kind: 'test-manifest' } }],
      validatedAt: '2026-08-10T00:00:00.000Z',
    }),
  };
  const renderedHtml = renderHtmlReport(releaseReport);
  const released = buildStaticReportPublication({
    html: renderedHtml,
    report: releaseReport,
    reportId: 'released',
    requireRelease: true,
  });
  assert.equal(released.entry.publicationStatus, 'released');
  assert.equal(released.entry.releaseReportContentHash, releaseReport.releaseValidationReceipt.reportContentHash);
  assert.equal(released.entry.contentBytes, Buffer.byteLength(renderedHtml));

  assert.throws(
    () => buildStaticReportPublication({
      html: '<p>unvalidated rendering</p>',
      report: releaseReport,
      reportId: 'released',
      requireRelease: true,
    }),
    /HTML does not match the supplied report/,
  );

  const injectedOverlay = {
    ...releaseReport,
    analysisOverlay: {
      kind: 'ai_discourse_bench_analysis_overlay',
      provenance: { generatedBy: 'unvalidated' },
    },
  };
  assert.throws(
    () => buildStaticReportPublication({
      html: renderHtmlReport(injectedOverlay),
      report: injectedOverlay,
      reportId: 'released',
      requireRelease: true,
    }),
    /reportContentHash does not match/,
  );

  assert.throws(
    () => buildStaticReportPublication({
      html: renderHtmlReport({ ...releaseReport, title: 'Altered' }),
      report: { ...releaseReport, title: 'Altered' },
      reportId: 'released',
      requireRelease: true,
    }),
    /reportContentHash does not match/,
  );
});

test('release-ready reports remain previews unless release is explicit', () => {
  const previewReport = { ...report, integrity: { releaseReady: true, warnings: [] } };
  const preview = buildStaticReportPublication({
    html: renderHtmlReport(previewReport),
    report: previewReport,
    reportId: 'release-ready-preview',
  });

  assert.equal(preview.entry.publicationStatus, 'development-preview');
});

const publicationFixture = (ready, release) => {
  const input = { ...report, integrity: { releaseReady: ready, warnings: [] } };
  if (release) input.releaseValidationReceipt = buildReleaseValidationReceipt({
    report: input, questionBank: { benchmarkId: 'bank', questions: [] }, modelRoster: { models: [] },
    runsFiles: [{ manifest: { kind: 'local-test-manifest' } }],
  });
  return input;
};

const publishWithCli = async (input, requireRelease, exercise) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'benchmark-publication-'));
  try {
    const reportPath = path.join(directory, 'report.json');
    const htmlPath = path.join(directory, 'report.html');
    const outDir = path.join(directory, 'published');
    await writeFile(reportPath, JSON.stringify(input));
    await writeFile(htmlPath, renderHtmlReport(input));
    const publish = () => execFileSync(process.execPath, [
      new URL('../scripts/publish-static-report.mjs', import.meta.url).pathname,
      '--report', reportPath, '--html', htmlPath, '--out-dir', outDir, '--id', 'test-report',
      ...(requireRelease ? ['--release'] : []),
    ], { encoding: 'utf8', stdio: 'pipe' });
    const verify = () => execFileSync(process.execPath, [
      new URL('../scripts/verify-static-publication.mjs', import.meta.url).pathname, outDir,
    ], { encoding: 'utf8', stdio: 'pipe' });
    await exercise({ publish, verify, outDir });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

for (const [name, ready, release] of [['ordinary preview', false, false], ['release-ready preview', true, false], ['explicit release', true, true]]) {
  test(`the real publisher and verifier agree on ${name}`, async () => {
    await publishWithCli(publicationFixture(ready, release), release, async ({ publish, verify, outDir }) => {
      publish();
      const manifest = JSON.parse(await readFile(path.join(outDir, 'manifest.json'), 'utf8'));
      const entry = manifest.reports[0];
      const html = gunzipSync(await readFile(path.join(outDir, entry.artifact))).toString('utf8');
      assert.equal(entry.publicationStatus, release ? 'released' : 'development-preview');
      assert.match(html, new RegExp(`data-ce-benchmark-publication-status="${release ? 'released' : 'preview'}"`));
      assert.match(html, new RegExp(`<meta name="robots" content="${release ? 'index,follow' : 'noindex,nofollow'}"`));
      assert.equal(html.includes('data-ce-benchmark-preview>'), !release);
      assert.match(verify(), /verified 1 benchmark publication/);
      if (release) {
        const embedded = JSON.parse(html.match(/id="ce-ai-discourse-bench-report">([\s\S]*?)<\/script>/)[1]);
        assert.equal(entry.releaseReportContentHash, embedded.releaseValidationReceipt.reportContentHash);
        entry.releaseReportContentHash = '0'.repeat(64);
        await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest));
        assert.throws(verify, /release report hash/);
      } else {
        await writeFile(path.join(outDir, entry.artifact), 'tampered');
        assert.throws(verify, /artifact integrity mismatch/);
      }
    });
  });
}

test('release publication requires the confirmation and confirmation requires a valid receipt', async () => {
  await publishWithCli(publicationFixture(true, true), false, async ({ publish }) => {
    assert.throws(publish, /requires --release/);
  });
  await publishWithCli(publicationFixture(true, false), true, async ({ publish }) => {
    assert.throws(publish, /releaseValidationReceipt must be present/);
  });
});

for (const withAnalysis of [false, true]) {
  test(`render, publish and verify share the same preview inputs (analysis=${withAnalysis})`, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'benchmark-overlay-publication-'));
    try {
      const reportPath = path.join(directory, 'report.json');
      const htmlPath = path.join(directory, 'report.html');
      const analysisPath = path.join(directory, 'analysis.json');
      const outDir = path.join(directory, 'published');
      const overlay = {
        kind: 'ai_discourse_bench_analysis_overlay',
        provenance: { generatedBy: 'local-fixture', model: 'fixture', promptVersion: '1', generatedAt: report.generatedAt, inputReportHash: buildReportFingerprint(report) },
        riskMatrix: { cells: { Capabilities_vs_Labor: { summary: 'OVERLAY_MARKER' } } },
      };
      await writeFile(reportPath, JSON.stringify(report));
      await writeFile(analysisPath, JSON.stringify(overlay));
      const analysisArgs = withAnalysis ? ['--analysis', analysisPath] : [];
      execFileSync(process.execPath, [new URL('../bin/ai-discourse-bench.mjs', import.meta.url).pathname,
        'render-report', '--report', reportPath, '--out', htmlPath, ...analysisArgs], { stdio: 'pipe' });
      const html = await readFile(htmlPath, 'utf8');
      const publish = () => execFileSync(process.execPath, [new URL('../scripts/publish-static-report.mjs', import.meta.url).pathname,
        '--report', reportPath, '--html', htmlPath, '--out-dir', outDir, '--id', 'fixture', ...analysisArgs], { encoding: 'utf8', stdio: 'pipe' });
      assert.match(publish(), /development-preview/);
      assert.equal(gunzipSync(await readFile(path.join(outDir, 'fixture.html.gz'))).toString('utf8'), html);
      assert.equal(html.includes('OVERLAY_MARKER'), withAnalysis);
      assert.match(execFileSync(process.execPath, [new URL('../scripts/verify-static-publication.mjs', import.meta.url).pathname, outDir], { encoding: 'utf8', stdio: 'pipe' }), /verified 1 benchmark publication/);
      await writeFile(htmlPath, html + '<p>altered</p>');
      assert.throws(publish, /HTML does not match/);
      if (withAnalysis) {
        await writeFile(htmlPath, html);
        overlay.provenance.inputReportHash = '0'.repeat(64);
        await writeFile(analysisPath, JSON.stringify(overlay));
        assert.throws(publish, /inputReportHash does not match/);
      }
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
}
