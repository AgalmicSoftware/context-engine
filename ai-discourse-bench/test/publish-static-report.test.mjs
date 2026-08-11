import assert from 'node:assert/strict';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { buildStaticReportPublication } from '../scripts/publish-static-report.mjs';
import { buildReleaseValidationReceipt } from '../src/provenance.mjs';
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
