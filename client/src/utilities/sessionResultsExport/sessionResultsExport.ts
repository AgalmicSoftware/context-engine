import {
  loadBrowserModuleWithRetry,
  resolveDefaultExport,
  resolveJsPdfConstructor,
  saveCanvasAsPagedPdf,
} from '../ui/browserPdfExport';

export const SESSION_RESULTS_HTML_SNAPSHOT_TYPE = 'ce_session_results_html_snapshot';
export const SESSION_RESULTS_HTML_SNAPSHOT_VERSION = 1;
export const SESSION_RESULTS_HTML_PRIVACY_REDACTED = 'redacted';
export const SESSION_RESULTS_EXPORT_FORMAT_VIEWER = 'viewer';
export const SESSION_RESULTS_EXPORT_FORMAT_SINGLE_HTML = 'single-html';
export const SESSION_RESULTS_EXPORT_FORMAT_PDF = 'pdf-report';

const DEFAULT_UNAVAILABLE_REASON = 'No hydrated data was available for this section when the export was created.';
const DEFAULT_REDACTIONS = [
  'wallet_addresses',
  'raw_responses',
  'encrypted_payloads',
  'gated_values',
  'telegram_identifiers',
] as const;
const ETH_ADDRESS_TEXT_PATTERN = /\b0x[a-fA-F0-9]{40}\b/g;
const REDACTED_ADDRESS_PLACEHOLDER = '[redacted-address]';

const SENSITIVE_KEY_PATTERNS = [
  /^address$/i,
  /^wallet$/i,
  /^walletAddress$/i,
  /^responder$/i,
  /^responderAddress$/i,
  /^participantAddress$/i,
  /^participantAddresses$/i,
  /^telegram(Id|UserId|ChatId|Handle|Username)$/i,
  /^privateKey$/i,
  /^apiKey$/i,
  /^secret$/i,
  /^token$/i,
  /^provider$/i,
  /^ciphertext$/i,
  /^encrypted(Data|Envelope|Payload|Portion)?$/i,
  /^litEnvelope$/i,
  /^rawResponses?$/i,
  /^responses?$/i,
  /^answer$/i,
  /^additional$/i,
  /^additionalComments$/i,
  /^freeformAnswer$/i,
];

export type SessionResultsPrivacyMode = typeof SESSION_RESULTS_HTML_PRIVACY_REDACTED;
export type SessionResultsExportFormat =
  | typeof SESSION_RESULTS_EXPORT_FORMAT_VIEWER
  | typeof SESSION_RESULTS_EXPORT_FORMAT_SINGLE_HTML
  | typeof SESSION_RESULTS_EXPORT_FORMAT_PDF;

export type SessionResultsSectionSelection = {
  argumentMap?: boolean;
  atlas?: boolean;
  report?: boolean;
  riskMatrix?: boolean;
  snapshotJson?: boolean;
};

export type SessionResultsReportQuestion = {
  id: string;
  options: string[];
  prompt: string;
  responseCount: number;
  tags: string[];
  type: string;
};

export type SessionResultsCounts = {
  atlasNodes: number;
  participants: number;
  questions: number;
  responses: number;
  riskMatrixComments: number;
};

export type SessionResultsSnapshotSession = {
  chainId: number | null;
  latestKnownBlock: number | null;
  name: string;
  networkLabel: string;
  slug: string;
};

export type SessionResultsExporterMetadata = {
  address: string;
  chainId: number | null;
  displayAddress: string;
};

export type SessionResultsReportSection = {
  available: boolean;
  dimensions: unknown[];
  groups: unknown[];
  questions: SessionResultsReportQuestion[];
  reason?: string;
  representativeQuestions: unknown[];
  summary: Record<string, unknown>;
};

export type SessionResultsArgumentMapSection = {
  available: boolean;
  debates: unknown[];
  reason?: string;
};

export type SessionResultsRiskMatrixSection = {
  available: boolean;
  categories: unknown[];
  comments: unknown[];
  heatmap: Record<string, unknown>;
  reason?: string;
  scenarioLinks: unknown[];
};

export type SessionResultsAtlasSection = {
  available: boolean;
  edges: unknown[];
  nodes: unknown[];
  reason?: string;
};

export type SessionResultsSnapshotSections = {
  argumentMap: SessionResultsArgumentMapSection;
  atlas: SessionResultsAtlasSection;
  report: SessionResultsReportSection;
  riskMatrix: SessionResultsRiskMatrixSection;
};

export type SessionResultsHtmlSnapshot = {
  counts: SessionResultsCounts;
  exportedAt: string;
  exportedBy?: SessionResultsExporterMetadata;
  filters: Record<string, unknown>;
  privacyMode: SessionResultsPrivacyMode;
  redactions: string[];
  sections: SessionResultsSnapshotSections;
  session: SessionResultsSnapshotSession;
  type: typeof SESSION_RESULTS_HTML_SNAPSHOT_TYPE;
  version: typeof SESSION_RESULTS_HTML_SNAPSHOT_VERSION;
};

export type BuildSessionResultsSnapshotInput = {
  counts?: Partial<SessionResultsCounts>;
  exportedBy?: Partial<SessionResultsExporterMetadata>;
  exportedAt?: unknown;
  filters?: unknown;
  redactions?: unknown;
  sections?: Partial<{
    argumentMap: Partial<SessionResultsArgumentMapSection>;
    atlas: Partial<SessionResultsAtlasSection>;
    report: Partial<SessionResultsReportSection>;
    riskMatrix: Partial<SessionResultsRiskMatrixSection>;
  }>;
  session?: Partial<SessionResultsSnapshotSession>;
};

export type BrowserFileDownloadOptions = {
  content: string;
  documentRef?: Document;
  filename: string;
  mimeType?: string;
  urlApi?: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
};

export type SessionResultsHtmlReportRenderOptions = {
  format?: SessionResultsExportFormat;
  sections?: SessionResultsSectionSelection;
};

export type SessionResultsPdfDownloadOptions = {
  documentRef?: Document;
  filename: string;
  html: string;
  html2canvasLoader?: () => Promise<unknown>;
  jsPdfLoader?: () => Promise<unknown>;
};

const toSafeString = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

const toFiniteCount = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
};

const toFiniteNullableNumber = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => toSafeString(item).trim()).filter(Boolean) : [];

const shortenAddress = (value: unknown): string => {
  const address = toSafeString(value).trim();
  if (!address) return '';
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const toPlainRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const normalizeIsoTimestamp = (value: unknown): string => {
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
};

const normalizeExporterMetadata = (
  value?: Partial<SessionResultsExporterMetadata>,
): SessionResultsExporterMetadata | undefined => {
  const address = toSafeString(value?.address).trim();
  if (!address) return undefined;
  return {
    address,
    chainId: toFiniteNullableNumber(value?.chainId),
    displayAddress: toSafeString(value?.displayAddress).trim() || shortenAddress(address),
  };
};

const shouldDropRedactedKey = (key: string): boolean => SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));

export const redactSnapshotValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => redactSnapshotValue(item));
  }
  if (typeof value === 'string') {
    return value.replace(ETH_ADDRESS_TEXT_PATTERN, REDACTED_ADDRESS_PLACEHOLDER);
  }
  if (!value || typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, entryValue]) => {
    if (shouldDropRedactedKey(key)) return;
    out[key] = redactSnapshotValue(entryValue);
  });
  return out;
};

const normalizeReportQuestion = (value: unknown): SessionResultsReportQuestion => {
  const record = toPlainRecord(redactSnapshotValue(value));
  return {
    id: toSafeString(record.id).trim(),
    options: toStringArray(record.options),
    prompt: toSafeString(record.prompt).trim(),
    responseCount: toFiniteCount(record.responseCount),
    tags: toStringArray(record.tags),
    type: toSafeString(record.type).trim(),
  };
};

const normalizeReportSection = (input?: Partial<SessionResultsReportSection>): SessionResultsReportSection => {
  const questions = Array.isArray(input?.questions)
    ? input.questions.map(normalizeReportQuestion).filter((question) => question.id || question.prompt)
    : [];
  const summary = toPlainRecord(redactSnapshotValue(input?.summary));
  const dimensions = Array.isArray(input?.dimensions) ? input.dimensions.map(redactSnapshotValue) : [];
  const groups = Array.isArray(input?.groups) ? input.groups.map(redactSnapshotValue) : [];
  const representativeQuestions = Array.isArray(input?.representativeQuestions)
    ? input.representativeQuestions.map(redactSnapshotValue)
    : [];
  const hasContent =
    questions.length > 0 ||
    dimensions.length > 0 ||
    groups.length > 0 ||
    representativeQuestions.length > 0 ||
    Object.keys(summary).length > 0;
  const available = input?.available === true || (input?.available !== false && hasContent);

  return {
    available,
    dimensions,
    groups,
    questions,
    representativeQuestions,
    summary,
    ...(available ? {} : { reason: toSafeString(input?.reason) || DEFAULT_UNAVAILABLE_REASON }),
  };
};

const normalizeArgumentMapSection = (
  input?: Partial<SessionResultsArgumentMapSection>,
): SessionResultsArgumentMapSection => {
  const debates = Array.isArray(input?.debates) ? input.debates.map(redactSnapshotValue) : [];
  const available = input?.available === true || (input?.available !== false && debates.length > 0);
  return {
    available,
    debates,
    ...(available ? {} : { reason: toSafeString(input?.reason) || DEFAULT_UNAVAILABLE_REASON }),
  };
};

const normalizeRiskMatrixSection = (
  input?: Partial<SessionResultsRiskMatrixSection>,
): SessionResultsRiskMatrixSection => {
  const categories = Array.isArray(input?.categories) ? input.categories.map(redactSnapshotValue) : [];
  const comments = Array.isArray(input?.comments) ? input.comments.map(redactSnapshotValue) : [];
  const scenarioLinks = Array.isArray(input?.scenarioLinks) ? input.scenarioLinks.map(redactSnapshotValue) : [];
  const heatmap = toPlainRecord(redactSnapshotValue(input?.heatmap));
  const hasContent =
    categories.length > 0 || comments.length > 0 || scenarioLinks.length > 0 || Object.keys(heatmap).length > 0;
  const available = input?.available === true || (input?.available !== false && hasContent);
  return {
    available,
    categories,
    comments,
    heatmap,
    scenarioLinks,
    ...(available ? {} : { reason: toSafeString(input?.reason) || DEFAULT_UNAVAILABLE_REASON }),
  };
};

const normalizeAtlasSection = (input?: Partial<SessionResultsAtlasSection>): SessionResultsAtlasSection => {
  const nodes = Array.isArray(input?.nodes) ? input.nodes.map(redactSnapshotValue) : [];
  const edges = Array.isArray(input?.edges) ? input.edges.map(redactSnapshotValue) : [];
  const available = input?.available === true || (input?.available !== false && (nodes.length > 0 || edges.length > 0));
  return {
    available,
    edges,
    nodes,
    ...(available ? {} : { reason: toSafeString(input?.reason) || DEFAULT_UNAVAILABLE_REASON }),
  };
};

export const buildRedactedSessionResultsSnapshot = (
  input: BuildSessionResultsSnapshotInput = {},
): SessionResultsHtmlSnapshot => {
  const counts = input.counts || {};
  const session = input.session || {};
  const exportedBy = normalizeExporterMetadata(input.exportedBy);
  const redactions = new Set<string>(DEFAULT_REDACTIONS);
  if (Array.isArray(input.redactions)) {
    input.redactions.forEach((redaction) => {
      const normalized = toSafeString(redaction).trim();
      if (normalized) redactions.add(normalized);
    });
  }

  return {
    type: SESSION_RESULTS_HTML_SNAPSHOT_TYPE,
    version: SESSION_RESULTS_HTML_SNAPSHOT_VERSION,
    exportedAt: normalizeIsoTimestamp(input.exportedAt),
    privacyMode: SESSION_RESULTS_HTML_PRIVACY_REDACTED,
    session: {
      slug: toSafeString(session.slug).trim(),
      name: toSafeString(session.name).trim(),
      chainId: toFiniteNullableNumber(session.chainId),
      networkLabel: toSafeString(session.networkLabel).trim(),
      latestKnownBlock: toFiniteNullableNumber(session.latestKnownBlock),
    },
    ...(exportedBy ? { exportedBy } : {}),
    counts: {
      questions: toFiniteCount(counts.questions),
      responses: toFiniteCount(counts.responses),
      participants: toFiniteCount(counts.participants),
      atlasNodes: toFiniteCount(counts.atlasNodes),
      riskMatrixComments: toFiniteCount(counts.riskMatrixComments),
    },
    filters: toPlainRecord(redactSnapshotValue(input.filters)),
    sections: {
      report: normalizeReportSection(input.sections?.report),
      argumentMap: normalizeArgumentMapSection(input.sections?.argumentMap),
      riskMatrix: normalizeRiskMatrixSection(input.sections?.riskMatrix),
      atlas: normalizeAtlasSection(input.sections?.atlas),
    },
    redactions: Array.from(redactions).sort(),
  };
};

export const escapeHtml = (value: unknown): string =>
  toSafeString(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const serializeJsonForHtmlScript = (value: unknown): string =>
  (JSON.stringify(value, null, 2) || 'null')
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

const renderUnavailable = (label: string, reason?: string): string => `
    <section id="${escapeHtml(label)}" class="ce-report-section ce-report-section--unavailable">
      <h2>${escapeHtml(label)}</h2>
      <p>${escapeHtml(reason || DEFAULT_UNAVAILABLE_REASON)}</p>
    </section>`;

const renderQuestionRows = (questions: SessionResultsReportQuestion[]): string => {
  if (questions.length === 0) {
    return '<p>No report questions were captured in this snapshot.</p>';
  }
  return `
      <table>
        <thead>
          <tr>
            <th scope="col">Question</th>
            <th scope="col">Type</th>
            <th scope="col">Responses</th>
            <th scope="col">Tags</th>
            <th scope="col">Options</th>
          </tr>
        </thead>
        <tbody>
          ${questions
            .map(
              (question) => `
            <tr data-ce-searchable>
              <td>
                <a href="#question-${escapeHtml(question.id || question.prompt)}" id="question-${escapeHtml(question.id || question.prompt)}">
                  ${escapeHtml(question.prompt || question.id || 'Untitled question')}
                </a>
                ${question.id ? `<div class="ce-report-muted">${escapeHtml(question.id)}</div>` : ''}
              </td>
              <td>${escapeHtml(question.type || 'unknown')}</td>
              <td>${escapeHtml(question.responseCount)}</td>
              <td>${escapeHtml(question.tags.join(', '))}</td>
              <td>${escapeHtml(question.options.join(', '))}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>`;
};

const renderReportDimensions = (dimensions: unknown[]): string => {
  if (dimensions.length === 0) return '';
  return `
      <h3>Comparison Dimensions</h3>
      <p class="ce-report-muted">Generated Breakdown views should use these dataset-specific segment controls instead of demo-only demographic labels.</p>
      ${dimensions
        .map((dimension) => {
          const record = toPlainRecord(dimension);
          const values = Array.isArray(record.values) ? record.values : [];
          return `
        <details data-ce-searchable>
          <summary>${escapeHtml(record.label || record.id || 'Comparison dimension')}</summary>
          ${
            values.length > 0
              ? `
          <ul>
            ${values
              .map((value) => {
                const valueRecord = toPlainRecord(value);
                const count = toFiniteCount(valueRecord.count);
                return `<li>${escapeHtml(valueRecord.label || valueRecord.id || 'Segment')}${count ? ` <span class="ce-report-muted">(${escapeHtml(count)})</span>` : ''}</li>`;
              })
              .join('')}
          </ul>`
              : '<p class="ce-report-muted">No segment values were captured for this dimension.</p>'
          }
        </details>`;
        })
        .join('')}`;
};

const renderReportSection = (snapshot: SessionResultsHtmlSnapshot): string => {
  const { report } = snapshot.sections;
  if (!report.available) return renderUnavailable('report', report.reason);

  return `
    <section id="report" class="ce-report-section">
      <h2>Report</h2>
      <dl class="ce-report-stats">
        <div><dt>Questions</dt><dd>${escapeHtml(snapshot.counts.questions)}</dd></div>
        <div><dt>Responses</dt><dd>${escapeHtml(snapshot.counts.responses)}</dd></div>
        <div><dt>Participants</dt><dd>${escapeHtml(snapshot.counts.participants)}</dd></div>
        <div><dt>Latest Block</dt><dd>${escapeHtml(snapshot.session.latestKnownBlock ?? 'Unknown')}</dd></div>
      </dl>
      ${renderReportDimensions(report.dimensions)}
      ${renderQuestionRows(report.questions)}
    </section>`;
};

const renderJsonRows = (items: unknown[], emptyText: string): string => {
  if (items.length === 0) return `<p>${escapeHtml(emptyText)}</p>`;
  return items
    .map(
      (item, index) => `
    <details data-ce-searchable>
      <summary>Item ${escapeHtml(index + 1)}</summary>
      <pre>${escapeHtml(JSON.stringify(item, null, 2))}</pre>
    </details>`,
    )
    .join('');
};

const renderArgumentMapSection = (snapshot: SessionResultsHtmlSnapshot): string => {
  const { argumentMap } = snapshot.sections;
  if (!argumentMap.available) return renderUnavailable('argument-map', argumentMap.reason);
  return `
    <section id="argument-map" class="ce-report-section">
      <h2>Argument Map</h2>
      ${renderJsonRows(argumentMap.debates, 'No argument-map debates were captured in this snapshot.')}
    </section>`;
};

const renderRiskMatrixSection = (snapshot: SessionResultsHtmlSnapshot): string => {
  const { riskMatrix } = snapshot.sections;
  if (!riskMatrix.available) return renderUnavailable('risk-matrix', riskMatrix.reason);
  return `
    <section id="risk-matrix" class="ce-report-section">
      <h2>Risk Matrix</h2>
      <h3>Categories</h3>
      ${renderJsonRows(riskMatrix.categories, 'No risk matrix categories were captured in this snapshot.')}
      <h3>Heatmap</h3>
      <pre>${escapeHtml(JSON.stringify(riskMatrix.heatmap, null, 2))}</pre>
      <h3>Comments</h3>
      ${renderJsonRows(riskMatrix.comments, 'No risk matrix comments were captured in this snapshot.')}
    </section>`;
};

const renderAtlasSection = (snapshot: SessionResultsHtmlSnapshot): string => {
  const { atlas } = snapshot.sections;
  if (!atlas.available) return renderUnavailable('atlas', atlas.reason);
  return `
    <section id="atlas" class="ce-report-section">
      <h2>Atlas Nodes</h2>
      ${renderJsonRows(atlas.nodes, 'No atlas nodes were captured in this snapshot.')}
    </section>`;
};

const isSelected = (sections: SessionResultsSectionSelection, key: keyof SessionResultsSectionSelection): boolean =>
  sections[key] !== false;

const resolveRenderSections = (
  sections: SessionResultsSectionSelection = {},
): Required<SessionResultsSectionSelection> => ({
  argumentMap: isSelected(sections, 'argumentMap'),
  atlas: isSelected(sections, 'atlas'),
  report: isSelected(sections, 'report'),
  riskMatrix: isSelected(sections, 'riskMatrix'),
  snapshotJson: isSelected(sections, 'snapshotJson'),
});

const renderNavLinks = (sections: Required<SessionResultsSectionSelection>): string =>
  [
    sections.report ? '<a href="#report">Report</a>' : '',
    sections.argumentMap ? '<a href="#argument-map">Argument Map</a>' : '',
    sections.riskMatrix ? '<a href="#risk-matrix">Risk Matrix</a>' : '',
    sections.atlas ? '<a href="#atlas">Atlas Nodes</a>' : '',
    sections.snapshotJson ? '<a href="#snapshot-json">Snapshot JSON</a>' : '',
  ]
    .filter(Boolean)
    .join('\n      ');

const renderSelectedReportSections = (
  snapshot: SessionResultsHtmlSnapshot,
  sections: Required<SessionResultsSectionSelection>,
): string =>
  [
    sections.report ? renderReportSection(snapshot) : '',
    sections.argumentMap ? renderArgumentMapSection(snapshot) : '',
    sections.riskMatrix ? renderRiskMatrixSection(snapshot) : '',
    sections.atlas ? renderAtlasSection(snapshot) : '',
    sections.snapshotJson
      ? `
    <section id="snapshot-json" class="ce-report-section">
      <h2>Embedded Snapshot JSON</h2>
      <p class="ce-report-muted">This JSON is embedded as inert application data for reproducibility.</p>
      <pre>${escapeHtml(JSON.stringify(snapshot, null, 2))}</pre>
    </section>`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

export const renderSessionResultsHtmlReport = (
  inputSnapshot: SessionResultsHtmlSnapshot,
  options: SessionResultsHtmlReportRenderOptions = {},
): string => {
  const snapshot = buildRedactedSessionResultsSnapshot(inputSnapshot);
  const sessionTitle = snapshot.session.name || snapshot.session.slug || 'Session';
  const format = options.format || SESSION_RESULTS_EXPORT_FORMAT_VIEWER;
  const sections = resolveRenderSections(options.sections);
  const snapshotJson = serializeJsonForHtmlScript(snapshot);
  const isViewer = format === SESSION_RESULTS_EXPORT_FORMAT_VIEWER;
  const isPdf = format === SESSION_RESULTS_EXPORT_FORMAT_PDF;
  const exporterLabel = snapshot.exportedBy?.displayAddress || 'missing exporter';
  const exporterAddress = snapshot.exportedBy?.address || '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(sessionTitle)} - Context Engine Session Results Report</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f7f8fb; color: #111827; }
    header { background: #ffffff; border-bottom: 1px solid #d9dee8; padding: 28px clamp(18px, 4vw, 48px); }
    main { max-width: 1180px; margin: 0 auto; padding: 24px clamp(18px, 4vw, 48px) 76px; }
    h1 { font-size: clamp(2rem, 4vw, 3.4rem); line-height: 1.05; margin: 0 0 12px; }
    h2 { margin-top: 0; }
    nav { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
    nav a, button { border: 1px solid #aab5c8; border-radius: 8px; background: #ffffff; color: #10233f; padding: 8px 12px; text-decoration: none; font-weight: 700; }
    button { cursor: pointer; }
    input[type="search"] { width: min(100%, 520px); border: 1px solid #aab5c8; border-radius: 8px; padding: 10px 12px; font: inherit; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; background: #ffffff; }
    th, td { border-bottom: 1px solid #e3e7ef; padding: 10px 12px; text-align: left; vertical-align: top; }
    th { background: #edf2f7; color: #24364f; }
    pre { overflow: auto; background: #101828; color: #f4f7fb; border-radius: 8px; padding: 14px; }
    details { border: 1px solid #d9dee8; border-radius: 8px; background: #ffffff; padding: 10px 12px; margin: 10px 0; }
    summary { cursor: pointer; font-weight: 700; }
    .ce-report-meta { display: flex; flex-wrap: wrap; gap: 10px 18px; color: #4b5563; }
    .ce-report-section { background: #ffffff; border: 1px solid #d9dee8; border-radius: 8px; padding: 20px; margin: 18px 0; }
    .ce-report-section--unavailable { background: #fbfcfe; color: #5b6472; }
    .ce-report-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 18px 0; }
    .ce-report-stats div { border: 1px solid #d9dee8; border-radius: 8px; padding: 12px; background: #fbfcfe; }
    .ce-report-stats dt { color: #5b6472; font-size: 0.86rem; }
    .ce-report-stats dd { margin: 4px 0 0; font-size: 1.35rem; font-weight: 800; }
    .ce-report-muted { color: #6b7280; font-size: 0.86rem; margin-top: 4px; overflow-wrap: anywhere; }
    .ce-report-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 20px; }
    .ce-export-watermark { position: fixed; right: 14px; bottom: 10px; z-index: 50; border: 1px solid #cbd5e1; border-radius: 999px; background: rgba(255, 255, 255, 0.92); color: #334155; padding: 6px 10px; font-size: 0.78rem; font-weight: 800; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14); }
    .ce-integrity-warning { border: 2px solid #f97316; background: #fff7ed; color: #7c2d12; padding: 14px 18px; font-weight: 800; }
    .ce-report-integrity-failed header, .ce-report-integrity-failed main { filter: grayscale(1) blur(1px); opacity: 0.55; pointer-events: none; }
    body.ce-report-pdf { background: #ffffff; }
    body.ce-report-pdf header { padding: 18px 24px; }
    body.ce-report-pdf main { max-width: none; padding: 16px 24px 52px; }
    body.ce-report-pdf h1 { font-size: 2rem; }
    body.ce-report-pdf .ce-report-section { break-inside: avoid; page-break-inside: avoid; margin: 12px 0; padding: 14px; }
    body.ce-report-pdf pre { max-height: 220px; white-space: pre-wrap; }
    body.ce-report-static nav, body.ce-report-pdf nav, body.ce-report-static .ce-report-toolbar, body.ce-report-pdf .ce-report-toolbar { display: none; }
    @page { margin: 0.45in; size: A4 portrait; }
    @media print {
      body { background: #ffffff; }
      header { padding: 18px 0; }
      main { max-width: none; padding: 12px 0 48px; }
      nav, .ce-report-toolbar { display: none; }
      .ce-report-section { break-inside: avoid; page-break-inside: avoid; }
      .ce-export-watermark { position: fixed; }
    }
    [hidden] { display: none !important; }
  </style>
</head>
<body class="${escapeHtml(isPdf ? 'ce-report-pdf' : isViewer ? 'ce-report-viewer' : 'ce-report-static')}">
  <div id="ce-report-integrity-warning" class="ce-integrity-warning" hidden>
    Exporter metadata is missing from the embedded report snapshot. Treat this artifact as modified or incomplete.
  </div>
  <header>
    <p class="ce-report-muted">Context Engine Session Results Report</p>
    <h1>${escapeHtml(sessionTitle)}</h1>
    <div class="ce-report-meta">
      <span>Exported ${escapeHtml(snapshot.exportedAt)}</span>
      <span>Privacy: ${escapeHtml(snapshot.privacyMode)}</span>
      <span>Session: ${escapeHtml(snapshot.session.slug || 'Unknown')}</span>
      <span>Network: ${escapeHtml(snapshot.session.networkLabel || snapshot.session.chainId || 'Unknown')}</span>
      <span>Downloaded by: ${escapeHtml(exporterLabel)}</span>
    </div>
    <nav aria-label="Report sections">
      ${renderNavLinks(sections)}
    </nav>
    ${
      isViewer
        ? `<div class="ce-report-toolbar">
      <label>
        <span class="ce-report-muted">Search captured rows</span><br>
        <input type="search" data-ce-report-search placeholder="Search questions, argument items, and atlas data">
      </label>
      <button type="button" data-ce-download-snapshot>Download Snapshot JSON</button>
    </div>`
        : ''
    }
  </header>
  <main>
    ${renderSelectedReportSections(snapshot, sections)}
  </main>
  <div class="ce-export-watermark" data-ce-exporter-address="${escapeHtml(exporterAddress)}">
    Downloaded by ${escapeHtml(exporterLabel)}
  </div>
  <script type="application/json" id="ce-session-results-snapshot">${snapshotJson}</script>
  <script>
    (function () {
      var snapshotEl = document.getElementById('ce-session-results-snapshot');
      var integrityWarning = document.getElementById('ce-report-integrity-warning');
      var searchInput = document.querySelector('[data-ce-report-search]');
      var downloadButton = document.querySelector('[data-ce-download-snapshot]');
      try {
        var parsedSnapshot = JSON.parse((snapshotEl && snapshotEl.textContent) || '{}');
        if (!parsedSnapshot.exportedBy || !parsedSnapshot.exportedBy.address) {
          document.body.classList.add('ce-report-integrity-failed');
          if (integrityWarning) integrityWarning.hidden = false;
        }
      } catch (err) {
        document.body.classList.add('ce-report-integrity-failed');
        if (integrityWarning) integrityWarning.hidden = false;
      }
      if (searchInput) {
        searchInput.addEventListener('input', function () {
          var query = String(searchInput.value || '').toLowerCase();
          document.querySelectorAll('[data-ce-searchable]').forEach(function (node) {
            node.hidden = query && !String(node.textContent || '').toLowerCase().includes(query);
          });
        });
      }
      if (downloadButton && snapshotEl) {
        downloadButton.addEventListener('click', function () {
          var blob = new Blob([snapshotEl.textContent || '{}'], { type: 'application/json;charset=utf-8' });
          var url = URL.createObjectURL(blob);
          var anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = 'contextEngine_sessionResultsSnapshot.json';
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          URL.revokeObjectURL(url);
        });
      }
    }());
  </script>
</body>
</html>`;
};

export const sanitizeFilenameSegment = (value: unknown, fallback = 'session'): string => {
  const trimmed = toSafeString(value).trim();
  const normalized = typeof trimmed.normalize === 'function' ? trimmed.normalize('NFKD') : trimmed;
  const cleaned = normalized
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_\-.]+|[_\-.]+$/g, '')
    .slice(0, 80);
  return cleaned || fallback;
};

export const formatTimestampForFilename = (value: unknown): string =>
  normalizeIsoTimestamp(value).replace(/[:.]/g, '_');

export const buildSessionResultsHtmlReportFilename = (
  args: {
    exportedAt?: unknown;
    name?: unknown;
    slug?: unknown;
  } = {},
): string => {
  const sessionPart = sanitizeFilenameSegment(args.slug || args.name || 'session', 'session');
  const timestampPart = formatTimestampForFilename(args.exportedAt);
  return `contextEngine_sessionReport_${sessionPart}_${timestampPart}.html`;
};

export const buildSessionResultsPdfReportFilename = (
  args: {
    exportedAt?: unknown;
    name?: unknown;
    slug?: unknown;
  } = {},
): string => {
  const sessionPart = sanitizeFilenameSegment(args.slug || args.name || 'session', 'session');
  const timestampPart = formatTimestampForFilename(args.exportedAt);
  return `contextEngine_sessionReport_${sessionPart}_${timestampPart}.pdf`;
};

export const downloadBrowserFile = ({
  content,
  documentRef = document,
  filename,
  mimeType = 'text/plain;charset=utf-8;',
  urlApi = URL,
}: BrowserFileDownloadOptions): void => {
  if (!documentRef || !documentRef.body) {
    throw new Error('Document is not available for browser download.');
  }
  if (!urlApi || typeof urlApi.createObjectURL !== 'function') {
    throw new Error('URL.createObjectURL is not available for browser download.');
  }

  const blob = new Blob([content], { type: mimeType });
  const url = urlApi.createObjectURL(blob);
  const anchor = documentRef.createElement('a');

  anchor.setAttribute('hidden', '');
  anchor.setAttribute('href', url);
  anchor.setAttribute('download', filename);
  documentRef.body.appendChild(anchor);
  anchor.click();
  documentRef.body.removeChild(anchor);

  if (typeof urlApi.revokeObjectURL === 'function') {
    urlApi.revokeObjectURL(url);
  }
};

export const downloadSessionResultsHtmlReport = (
  html: string,
  filename: string,
  deps: Omit<BrowserFileDownloadOptions, 'content' | 'filename' | 'mimeType'> = {},
): void => {
  downloadBrowserFile({
    ...deps,
    content: html,
    filename,
    mimeType: 'text/html;charset=utf-8;',
  });
};

export const downloadSessionResultsPdfReport = async ({
  documentRef = document,
  filename,
  html,
  html2canvasLoader = () => import('html2canvas'),
  jsPdfLoader = () => import('jspdf'),
}: SessionResultsPdfDownloadOptions): Promise<void> => {
  if (!documentRef || !documentRef.body) {
    throw new Error('Document is not available for PDF export.');
  }

  const iframe = documentRef.createElement('iframe');
  iframe.setAttribute('title', 'Context Engine PDF export');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '1122px';
  iframe.style.height = '1588px';
  iframe.style.border = '0';
  documentRef.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc || !iframeDoc.body) {
      throw new Error('Unable to create a PDF export document.');
    }
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    await new Promise((resolve) => setTimeout(resolve, 80));

    const [html2canvasModule, jsPdfModule] = await Promise.all([
      loadBrowserModuleWithRetry(html2canvasLoader),
      loadBrowserModuleWithRetry(jsPdfLoader),
    ]);
    const html2canvas =
      resolveDefaultExport<(element: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLCanvasElement>>(
        html2canvasModule,
      );
    const JsPdf = resolveJsPdfConstructor(jsPdfModule);
    const captureTarget = iframeDoc.body;
    const canvas = await html2canvas(captureTarget, {
      backgroundColor: '#ffffff',
      scale: 2,
      scrollX: 0,
      scrollY: 0,
      useCORS: true,
      windowHeight: captureTarget.scrollHeight,
      windowWidth: captureTarget.scrollWidth,
    });

    saveCanvasAsPagedPdf({ canvas, filename, JsPdf });
  } finally {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }
};
