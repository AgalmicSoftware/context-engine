import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartBar, faDownload } from '@fortawesome/free-solid-svg-icons';
import { buildPublicRoute } from '../MainSite/urlUtils.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  decodeBenchmarkReport,
  MAX_ARTIFACT_BYTES,
  MAX_REPORT_CONTENT_BYTES,
  type BenchmarkReportEntry,
} from './benchmarkArtifact';
import styles from './BenchmarksPage.module.scss';

type BenchmarkManifest = {
  defaultReportId: string;
  reports: BenchmarkReportEntry[];
  schemaVersion: number;
};

const MANIFEST_URL = buildPublicRoute('/benchmark-artifacts/manifest.json');
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const BENCHMARK_HASH_PATTERN = /^#[a-z0-9][a-z0-9._~!$&'()*+,;=:@%/-]{0,255}$/i;

const normalizeBenchmarkHash = (value: unknown): string => {
  const candidate = String(value || '');
  const hash = candidate.startsWith('#') ? candidate : `#${candidate}`;
  return BENCHMARK_HASH_PATTERN.test(hash) ? hash : '';
};

const isSafeArtifactName = (value: string): boolean => /^[a-z0-9][a-z0-9._-]*$/i.test(value) && !value.includes('..');

const isValidReportEntry = (entry: BenchmarkReportEntry): boolean =>
  !!entry &&
  typeof entry.id === 'string' &&
  typeof entry.title === 'string' &&
  typeof entry.topic === 'string' &&
  ['development-preview', 'released'].includes(entry.publicationStatus) &&
  !Number.isNaN(Date.parse(entry.generatedAt)) &&
  Number.isInteger(entry.questionCount) &&
  entry.questionCount > 0 &&
  Number.isInteger(entry.participantCount) &&
  entry.participantCount > 0 &&
  isSafeArtifactName(entry.artifact) &&
  ['gzip', 'none'].includes(entry.compression) &&
  Number.isInteger(entry.bytes) &&
  entry.bytes > 0 &&
  entry.bytes <= MAX_ARTIFACT_BYTES &&
  Number.isInteger(entry.contentBytes) &&
  entry.contentBytes > 0 &&
  entry.contentBytes <= MAX_REPORT_CONTENT_BYTES &&
  SHA256_PATTERN.test(entry.sha256) &&
  SHA256_PATTERN.test(entry.contentSha256) &&
  (entry.publicationStatus === 'released'
    ? SHA256_PATTERN.test(String(entry.releaseReportContentHash || ''))
    : entry.releaseReportContentHash == null);

const loadManifest = async (signal: AbortSignal): Promise<BenchmarkManifest> => {
  const response = await fetch(MANIFEST_URL, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`Benchmark manifest request failed (${response.status}).`);
  const manifest = (await response.json()) as BenchmarkManifest;
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.reports)) {
    throw new Error('The benchmark manifest is invalid.');
  }
  if (manifest.reports.length === 0) {
    throw new Error('The benchmark manifest does not contain any reports.');
  }
  if (!manifest.reports.every(isValidReportEntry)) {
    throw new Error('The benchmark manifest contains an invalid report entry.');
  }
  const reportIds = new Set(manifest.reports.map((report) => report.id.toLowerCase()));
  if (reportIds.size !== manifest.reports.length) {
    throw new Error('The benchmark manifest contains duplicate report ids.');
  }
  if (!manifest.reports.some((report) => report.id === manifest.defaultReportId)) {
    throw new Error('The benchmark manifest default report is invalid.');
  }
  return manifest;
};

const reportArtifactUrl = (report: BenchmarkReportEntry): string => {
  if (!isSafeArtifactName(report.artifact)) throw new Error('The benchmark artifact path is invalid.');
  return buildPublicRoute(`/benchmark-artifacts/${report.artifact}`);
};

const BenchmarksPage = () => {
  const reportFrameRef = useRef<HTMLIFrameElement>(null);
  const [manifest, setManifest] = useState<BenchmarkManifest | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [reportHtml, setReportHtml] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const selectedReport = useMemo(
    () => manifest?.reports.find((report) => report.id === selectedId) || null,
    [manifest, selectedId],
  );
  const selectedArtifact = useMemo(() => {
    if (!selectedReport) return { url: '', error: '' };
    try {
      return { url: reportArtifactUrl(selectedReport), error: '' };
    } catch (caught) {
      return {
        url: '',
        error: caught instanceof Error ? caught.message : 'The benchmark artifact path is invalid.',
      };
    }
  }, [selectedReport]);
  const syncHashToReport = useCallback(() => {
    const hash = normalizeBenchmarkHash(window.location.hash) || '#report';
    reportFrameRef.current?.contentWindow?.postMessage(
      {
        type: 'ce-benchmark-set-hash',
        hash,
      },
      '*',
    );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    loadManifest(controller.signal)
      .then((nextManifest) => {
        const defaultReportId = nextManifest.reports.some((report) => report.id === nextManifest.defaultReportId)
          ? nextManifest.defaultReportId
          : nextManifest.reports[0].id;
        setManifest(nextManifest);
        setSelectedId(defaultReportId);
        setError('');
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setError(caught?.message || 'The benchmark manifest could not be loaded.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [syncHashToReport]);

  useEffect(() => {
    const handleParentHashChange = () => syncHashToReport();
    window.addEventListener('hashchange', handleParentHashChange);
    return () => window.removeEventListener('hashchange', handleParentHashChange);
  }, [syncHashToReport]);

  useEffect(() => {
    if (!selectedReport) return;
    const controller = new AbortController();
    setLoading(true);
    setReportHtml('');
    setError('');
    if (selectedArtifact.error) {
      setError(selectedArtifact.error);
      setLoading(false);
      return () => controller.abort();
    }
    fetch(selectedArtifact.url, { cache: 'no-store', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Benchmark report request failed (${response.status}).`);
        return decodeBenchmarkReport(response, selectedReport);
      })
      .then((html) => {
        if (controller.signal.aborted) return;
        setReportHtml(html);
        setLoading(false);
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setError(caught?.message || 'The benchmark report could not be loaded.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [selectedArtifact, selectedReport]);

  useEffect(() => {
    const handleReportHashChange = (event: MessageEvent) => {
      if (event.source !== reportFrameRef.current?.contentWindow) return;
      if (event.data?.type !== 'ce-benchmark-hash-change') return;
      const hash = normalizeBenchmarkHash(event.data.hash);
      if (!hash || window.location.hash === hash) return;
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    };
    window.addEventListener('message', handleReportHashChange);
    return () => window.removeEventListener('message', handleReportHashChange);
  }, []);

  return (
    <main className={styles.page} data-testid={E2E_TESTIDS.PAGE_BENCHMARKS_ROOT}>
      <header className={styles.toolbar}>
        <div className={styles.identity}>
          <span className={styles.icon} aria-hidden="true">
            <FontAwesomeIcon icon={faChartBar} />
          </span>
          <div>
            <p className={styles.eyebrow}>Context Engine benchmarks</p>
            <h1>AI Opinions Benchmark</h1>
          </div>
        </div>

        <div className={styles.controls}>
          <label className={styles.selector}>
            <span>Report</span>
            <select
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              disabled={!manifest || manifest.reports.length < 2}
              aria-label="Benchmark report"
            >
              {(manifest?.reports || []).map((report) => (
                <option key={report.id} value={report.id}>
                  {report.title}
                </option>
              ))}
            </select>
          </label>
          {selectedReport ? (
            <>
              <span
                className={selectedReport.publicationStatus === 'released' ? styles.released : styles.preview}
                data-testid="ce-benchmark-publication-status"
              >
                {selectedReport.publicationStatus === 'released' ? 'Released' : 'Development preview'}
              </span>
              {selectedArtifact.url ? (
                <a
                  className={styles.openArtifact}
                  href={selectedArtifact.url}
                  download={selectedReport.artifact}
                  title="Download compressed benchmark artifact"
                >
                  <FontAwesomeIcon icon={faDownload} />
                  <span className={styles.srOnly}>Download compressed benchmark artifact</span>
                </a>
              ) : null}
            </>
          ) : null}
        </div>
      </header>

      {selectedReport ? (
        <div className={styles.reportMeta}>
          <span>{selectedReport.topic}</span>
          <span>{selectedReport.questionCount} questions</span>
          <span>{selectedReport.participantCount} model participants</span>
        </div>
      ) : null}

      <section className={styles.reportSurface} aria-busy={loading}>
        {loading ? <div className={styles.status}>Loading benchmark report...</div> : null}
        {error ? (
          <div className={styles.error} role="alert">
            <strong>Report unavailable</strong>
            <span>{error}</span>
          </div>
        ) : null}
        {reportHtml ? (
          <iframe
            ref={reportFrameRef}
            className={styles.reportFrame}
            data-testid="ce-benchmark-report-frame"
            title={selectedReport?.title || 'Context Engine benchmark report'}
            srcDoc={reportHtml}
            sandbox="allow-downloads allow-modals allow-popups allow-scripts"
            onLoad={syncHashToReport}
          />
        ) : null}
      </section>
    </main>
  );
};

export default BenchmarksPage;
