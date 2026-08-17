import { buildSecondPassAnalysisInput } from './analysis-export.mjs';
import { buildContextEnginePolisExport } from './ce-export.mjs';
import { clusterBySimilarity } from './opinion-groups.mjs';
import {
  WORLD_MAP_GEOGRAPHIES,
  WORLD_MAP_GRATICULE_PATH,
  WORLD_MAP_SPHERE_PATH,
  WORLD_MAP_VIEW_BOX,
} from './world-map-geographies.mjs';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]));

const FONT_AWESOME_ICONS = {
  cog: {
    viewBox: '0 0 512 512',
    path: 'M487.4 315.7l-42.6-24.6c4.3-23.2 4.3-47 0-70.2l42.6-24.6c4.9-2.8 7.1-8.6 5.5-14-11.1-35.6-30-67.8-54.7-94.6-3.8-4.1-10-5.1-14.8-2.3L380.8 110c-17.9-15.4-38.5-27.3-60.8-35.1V25.8c0-5.6-3.9-10.5-9.4-11.7-36.7-8.2-74.3-7.8-109.2 0-5.5 1.2-9.4 6.1-9.4 11.7V75c-22.2 7.9-42.8 19.8-60.8 35.1L88.7 85.5c-4.9-2.8-11-1.9-14.8 2.3-24.7 26.7-43.6 58.9-54.7 94.6-1.7 5.4.6 11.2 5.5 14L67.3 221c-4.3 23.2-4.3 47 0 70.2l-42.6 24.6c-4.9 2.8-7.1 8.6-5.5 14 11.1 35.6 30 67.8 54.7 94.6 3.8 4.1 10 5.1 14.8 2.3l42.6-24.6c17.9 15.4 38.5 27.3 60.8 35.1v49.2c0 5.6 3.9 10.5 9.4 11.7 36.7 8.2 74.3 7.8 109.2 0 5.5-1.2 9.4-6.1 9.4-11.7v-49.2c22.2-7.9 42.8-19.8 60.8-35.1l42.6 24.6c4.9 2.8 11 1.9 14.8-2.3 24.7-26.7 43.6-58.9 54.7-94.6 1.5-5.5-.7-11.3-5.6-14.1zM256 336c-44.1 0-80-35.9-80-80s35.9-80 80-80 80 35.9 80 80-35.9 80-80 80z',
  },
  expand: {
    viewBox: '0 0 448 512',
    path: 'M0 180V56c0-13.3 10.7-24 24-24h124c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12H64v84c0 6.6-5.4 12-12 12H12c-6.6 0-12-5.4-12-12zM288 44v40c0 6.6 5.4 12 12 12h84v84c0 6.6 5.4 12 12 12h40c6.6 0 12-5.4 12-12V56c0-13.3-10.7-24-24-24H300c-6.6 0-12 5.4-12 12zm148 276h-40c-6.6 0-12 5.4-12 12v84h-84c-6.6 0-12 5.4-12 12v40c0 6.6 5.4 12 12 12h124c13.3 0 24-10.7 24-24V332c0-6.6-5.4-12-12-12zM160 468v-40c0-6.6-5.4-12-12-12H64v-84c0-6.6-5.4-12-12-12H12c-6.6 0-12 5.4-12 12v124c0 13.3 10.7 24 24 24h124c6.6 0 12-5.4 12-12z',
  },
  'question-circle': {
    viewBox: '0 0 512 512',
    path: 'M504 256c0 136.997-111.043 248-248 248S8 392.997 8 256C8 119.083 119.043 8 256 8s248 111.083 248 248zM262.655 90c-54.497 0-89.255 22.957-116.549 63.758-3.536 5.286-2.353 12.415 2.715 16.258l34.699 26.31c5.205 3.947 12.621 3.008 16.665-2.122 17.864-22.658 30.113-35.797 57.303-35.797 20.429 0 45.698 13.148 45.698 32.958 0 14.976-12.363 22.667-32.534 33.976C247.128 238.528 216 254.941 216 296v4c0 6.627 5.373 12 12 12h56c6.627 0 12-5.373 12-12v-1.333c0-28.462 83.186-29.647 83.186-106.667 0-58.002-60.165-102-116.531-102zM256 338c-25.365 0-46 20.635-46 46 0 25.364 20.635 46 46 46s46-20.636 46-46c0-25.365-20.635-46-46-46z',
  },
  'info-circle': {
    viewBox: '0 0 512 512',
    path: 'M256 8C119.043 8 8 119.083 8 256c0 136.997 111.043 248 248 248s248-111.003 248-248C504 119.083 392.957 8 256 8zm0 110c23.196 0 42 18.804 42 42s-18.804 42-42 42-42-18.804-42-42 18.804-42 42-42zm56 254c0 6.627-5.373 12-12 12h-88c-6.627 0-12-5.373-12-12v-24c0-6.627 5.373-12 12-12h12v-64h-12c-6.627 0-12-5.373-12-12v-24c0-6.627 5.373-12 12-12h64c6.627 0 12 5.373 12 12v100h12c6.627 0 12 5.373 12 12v24z',
  },
  'external-link-alt': {
    viewBox: '0 0 512 512',
    path: 'M432 320h-32a16 16 0 0 0-16 16v112H64V128h144a16 16 0 0 0 16-16V80a16 16 0 0 0-16-16H48A48 48 0 0 0 0 112v352a48 48 0 0 0 48 48h352a48 48 0 0 0 48-48V336a16 16 0 0 0-16-16zM488 0H360c-21.37 0-32.05 25.91-17 41l35.73 35.73L135 320.37a24 24 0 0 0 0 34L157.67 377a24 24 0 0 0 34 0l243.61-243.68L471 169c15.11 15.11 41 4.41 41-17V24a24 24 0 0 0-24-24z',
  },
  magic: {
    viewBox: '0 0 512 512',
    path: 'M224 96l16-32 32-16-32-16-16-32-16 32-32 16 32 16 16 32zM80 160l26.7-53.3L160 80l-53.3-26.7L80 0 53.3 53.3 0 80l53.3 26.7L80 160zm352 128l-26.7 53.3L352 368l53.3 26.7L432 448l26.7-53.3L512 368l-53.3-26.7L432 288zm70.6-193.8L417.8 9.4C411.5 3.1 403.3 0 395.1 0s-16.4 3.1-22.6 9.4L9.4 372.5c-12.5 12.5-12.5 32.8 0 45.3l84.9 84.9c6.3 6.3 14.5 9.4 22.6 9.4s16.4-3.1 22.6-9.4l363.1-363.2c12.5-12.5 12.5-32.8 0-45.3zM359.5 203.5l-50.9-50.9 86.6-86.6 50.9 50.9-86.6 86.6z',
  },
  comments: {
    viewBox: '0 0 576 512',
    path: 'M416 192c0-88.4-93.1-160-208-160S0 103.6 0 192c0 34.3 14.1 65.9 38 92.1-13.4 30.2-35.5 54.2-35.8 54.5-2.2 2.3-2.8 5.7-1.5 8.7S4.8 352 8 352c36.6 0 66.9-12.3 88.7-25 32.2 15.7 70.3 25 111.3 25 114.9 0 208-71.6 208-160zm122 220.1c23.9-26.2 38-57.8 38-92.1 0-66.9-53.5-124.2-129.3-148.1.9 6.6 1.3 13.3 1.3 20.1 0 105.9-107.7 192-240 192-10.8 0-21.3-.8-31.7-1.9C207.8 439.6 281.8 480 368 480c41 0 79.1-9.2 111.3-25 21.8 12.7 52.1 25 88.7 25 3.2 0 6.1-1.9 7.3-4.8 1.3-2.9.7-6.4-1.5-8.7-.3-.3-22.4-24.2-35.8-54.4z',
  },
  fire: {
    viewBox: '0 0 384 512',
    path: 'M216 23.86c0-23.8 30.65-32.77 44.15-13.04C308.3 81.43 320 161.8 320 161.8c0 35.5-14.07 68.88-39.6 94.4-6.25 6.25-16.38 6.25-22.63 0s-6.25-16.38 0-22.63c19.48-19.48 30.23-45.28 30.23-71.77 0-24.15-5.7-62.83-22.2-102.41-34.92 54.68-96.58 96.65-142.23 142.3C83.97 241.3 64 284.76 64 336c0 79.4 64.6 144 144 144s144-64.6 144-144c0-46.45-22.73-90.52-58.42-128.95 32.7 16.38 58.42 41.21 74.42 72.95 10.43 20.68 16 43.77 16 68 0 88.37-71.63 164-160 164S64 436.37 64 348c0-62.46 26.24-114.18 70.94-158.88C176.2 147.86 216 111.05 216 23.86z',
  },
  times: {
    viewBox: '0 0 352 512',
    path: 'M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.19 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.19 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z',
  },
  'caret-up': {
    viewBox: '0 0 320 512',
    path: 'M288.662 352H31.338c-17.818 0-26.741-21.543-14.142-34.142l128.662-128.662c7.81-7.81 20.474-7.81 28.284 0l128.662 128.662c12.6 12.599 3.676 34.142-14.142 34.142z',
  },
  'caret-down': {
    viewBox: '0 0 320 512',
    path: 'M31.3 192h257.3c17.8 0 26.7 21.5 14.1 34.1L174.1 354.8c-7.8 7.8-20.5 7.8-28.3 0L17.2 226.1C4.6 213.5 13.5 192 31.3 192z',
  },
  'chevron-left': {
    viewBox: '0 0 320 512',
    path: 'M34.52 239.03L228.87 44.69c9.37-9.37 24.57-9.37 33.94 0l22.67 22.67c9.36 9.36 9.37 24.52.04 33.9L131.49 256l154.03 154.75c9.34 9.38 9.32 24.54-.04 33.9l-22.67 22.67c-9.37 9.37-24.57 9.37-33.94 0L34.52 272.97c-9.37-9.37-9.37-24.57 0-33.94z',
  },
  'chevron-right': {
    viewBox: '0 0 320 512',
    path: 'M285.48 272.97L91.13 467.31c-9.37 9.37-24.57 9.37-33.94 0l-22.67-22.67c-9.36-9.36-9.37-24.52-.04-33.9L188.51 256 34.48 101.25c-9.34-9.38-9.32-24.54.04-33.9l22.67-22.67c9.37-9.37 24.57-9.37 33.94 0l194.35 194.35c9.37 9.37 9.37 24.57 0 33.94z',
  },
  'minus-square': {
    viewBox: '0 0 448 512',
    path: 'M400 32H48C21.5 32 0 53.5 0 80v352c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V80c0-26.5-21.5-48-48-48zM92 296c-6.6 0-12-5.4-12-12v-56c0-6.6 5.4-12 12-12h264c6.6 0 12 5.4 12 12v56c0 6.6-5.4 12-12 12H92z',
  },
  'plus-square': {
    viewBox: '0 0 448 512',
    path: 'M400 32H48C21.5 32 0 53.5 0 80v352c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V80c0-26.5-21.5-48-48-48zM372 292c0 6.6-5.4 12-12 12h-92v92c0 6.6-5.4 12-12 12h-56c-6.6 0-12-5.4-12-12v-92H96c-6.6 0-12-5.4-12-12v-56c0-6.6 5.4-12 12-12h92v-92c0-6.6 5.4-12 12-12h56c6.6 0 12 5.4 12 12v92h92c6.6 0 12 5.4 12 12v56z',
  },
  circle: {
    viewBox: '0 0 512 512',
    path: 'M256 8C119.03 8 8 119.03 8 256s111.03 248 248 248 248-111.03 248-248S392.97 8 256 8z',
  },
  'network-wired': {
    viewBox: '0 0 640 512',
    path: 'M640 264v-48c0-13.3-10.7-24-24-24H368v-64h72c13.3 0 24-10.7 24-24V24c0-13.3-10.7-24-24-24H200c-13.3 0-24 10.7-24 24v80c0 13.3 10.7 24 24 24h72v64H24c-13.3 0-24 10.7-24 24v48c0 13.3 10.7 24 24 24h80v64H56c-13.3 0-24 10.7-24 24v112c0 13.3 10.7 24 24 24h176c13.3 0 24-10.7 24-24V376c0-13.3-10.7-24-24-24h-48v-64h272v64h-48c-13.3 0-24 10.7-24 24v112c0 13.3 10.7 24 24 24h176c13.3 0 24-10.7 24-24V376c0-13.3-10.7-24-24-24h-48v-64h80c13.3 0 24-10.7 24-24z',
  },
  sitemap: {
    viewBox: '0 0 640 512',
    path: 'M128 352H32c-17.7 0-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32v-96c0-17.7-14.3-32-32-32zm256 0h-96c-17.7 0-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32v-96c0-17.7-14.3-32-32-32zm224 0h-96c-17.7 0-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32v-96c0-17.7-14.3-32-32-32zM512 160h-80V96c0-17.7-14.3-32-32-32H240c-17.7 0-32 14.3-32 32v64h-80c-35.3 0-64 28.7-64 64v64h64v-64h160v64h64v-64h160v64h64v-64c0-35.3-28.7-64-64-64z',
  },
  list: {
    viewBox: '0 0 512 512',
    path: 'M80 368H16c-8.8 0-16 7.2-16 16v64c0 8.8 7.2 16 16 16h64c8.8 0 16-7.2 16-16v-64c0-8.8-7.2-16-16-16zm0-160H16c-8.8 0-16 7.2-16 16v64c0 8.8 7.2 16 16 16h64c8.8 0 16-7.2 16-16v-64c0-8.8-7.2-16-16-16zM80 48H16C7.2 48 0 55.2 0 64v64c0 8.8 7.2 16 16 16h64c8.8 0 16-7.2 16-16V64c0-8.8-7.2-16-16-16zm416 336H176c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h320c8.8 0 16-7.2 16-16v-32c0-8.8-7.2-16-16-16zm0-160H176c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h320c8.8 0 16-7.2 16-16v-32c0-8.8-7.2-16-16-16zm0-160H176c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h320c8.8 0 16-7.2 16-16V80c0-8.8-7.2-16-16-16z',
  },
};

const renderFontAwesomeIcon = (name, className = '', extraAttributes = '') => {
  const icon = FONT_AWESOME_ICONS[name];
  if (!icon) return '';
  const classes = ['svg-inline--fa', `fa-${name}`, className].filter(Boolean).join(' ');
  const attributes = extraAttributes ? ` ${extraAttributes}` : '';
  return `<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="${escapeHtml(name)}" class="${escapeHtml(classes)}"${attributes} xmlns="http://www.w3.org/2000/svg" viewBox="${escapeHtml(icon.viewBox)}"><path fill="currentColor" d="${escapeHtml(icon.path)}"></path></svg>`;
};

const renderTooltipReference = (text) => `<span class="pdfIgnore aidb-inline-tooltip-reference" style="display: inline-flex;" title="${escapeHtml(text)}">${renderFontAwesomeIcon('question-circle', 'tooltipIcon')}</span>`;

const renderStatLabel = (label, tooltipText = '') => `<span class="statLabel">${escapeHtml(label)}${tooltipText ? renderTooltipReference(tooltipText) : ''}:</span>`;

const formatPolisUtcTimestamp = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return escapeHtml(String(value || ''));
  return date.toISOString().replace('T', ' ').split('.')[0] + ' UTC';
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const BENCHMARK_PUBLIC_TITLE = 'Context Engine: AI Opinions Benchmark';

const buildStaticTagHref = (tag) => {
  const trimmedTag = String(tag ?? '').trim();
  return trimmedTag ? `#tag-${encodeURIComponent(trimmedTag)}` : '#tag';
};

const stanceColor = (score) => {
  if (!Number.isFinite(score)) return '#e5e7eb';
  const normalized = (clamp(score, -1, 1) + 1) / 2;
  const left = [232, 91, 67];
  const mid = [229, 231, 235];
  const right = [20, 148, 136];
  const from = normalized < 0.5 ? left : mid;
  const to = normalized < 0.5 ? mid : right;
  const t = normalized < 0.5 ? normalized * 2 : (normalized - 0.5) * 2;
  const rgb = from.map((channel, index) => Math.round(channel + (to[index] - channel) * t));
  return `rgb(${rgb.join(', ')})`;
};

const scoreLabel = (summary) => {
  if (!summary || summary.meanScore === null || summary.meanScore === undefined) return 'no data';
  if (summary.meanScore > 0.25) return 'net support';
  if (summary.meanScore < -0.25) return 'net opposition';
  return 'mixed / unsure';
};

const modelStanceLabel = (score) => {
  if (!Number.isFinite(score)) return 'No model answers';
  if (score > 0.25) return 'Models lean toward support';
  if (score < -0.25) return 'Models lean toward opposition';
  return 'Models are mixed or unsure';
};

const modelDifferenceLabel = (difference) => {
  if (!Number.isFinite(difference)) return 'No model comparison yet';
  if (difference < 0.25) return 'Models are closely aligned';
  if (difference < 0.75) return 'Models differ somewhat';
  if (difference < 1.25) return 'Models differ substantially';
  return 'Models are far apart';
};

const scoreClass = (score) => {
  if (!Number.isFinite(score)) return 'aidb-score-empty';
  if (score > 0.25) return 'aidb-score-agree';
  if (score < -0.25) return 'aidb-score-disagree';
  return 'aidb-score-mixed';
};

const formatScore = (value) => (
  Number.isFinite(value) ? value.toFixed(2) : 'no data'
);

const formatSignedScore = (value) => (
  Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value.toFixed(2)}` : 'no data'
);

const formatPercent = (value) => (
  Number.isFinite(value) ? `${Math.round(value * 100)}%` : '0%'
);

const formatDisplayLabel = (value) => {
  const raw = String(value || '').trim();
  const knownLabels = {
    parameterClass: 'Parameter Class',
    ossStatus: 'OSS Status',
    countryOfOrigin: 'Country of Origin',
    providerClass: 'Provider Class',
  };
  if (knownLabels[raw]) return knownLabels[raw];
  const normalized = raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bOss\b/g, 'OSS')
    .replace(/\bRd\b/g, 'R&D')
    .replace(/\bAi\b/g, 'AI');
  const smallWords = new Set(['and', 'or', 'of', 'the', 'to', 'for', 'in', 'on', 'with', 'vs']);
  return normalized
    .split(' ')
    .map((word, index) => (index > 0 && smallWords.has(word.toLowerCase()) ? word.toLowerCase() : word))
    .join(' ');
};

const computeStaticPackedTopicLayout = (topics) => {
  const prominenceFor = (topic) => (
    topic.sizeMetric === 'quadratic-importance' && Number.isFinite(Number(topic.importanceVotes))
      ? Number(topic.importanceVotes)
      : Number(topic.questionCount || 0)
  );
  const maxProminence = Math.max(1, ...topics.map(prominenceFor));
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const nodes = topics.map((topic, index) => {
    const scale = clamp(Math.sqrt(prominenceFor(topic) / maxProminence), 0.38, 1);
    const radius = 4.8 + (scale * 2.9);
    const angle = index * goldenAngle;
    const ring = Math.sqrt(index) * 5.9;
    return {
      topic,
      index,
      scale,
      radius,
      x: 50 + (Math.cos(angle) * ring * 1.24),
      y: 53 + (Math.sin(angle) * ring * 0.86),
      diameterPx: 78 + (scale * 74),
      mobileDiameterPx: 62 + (scale * 30),
    };
  });

  for (let iteration = 0; iteration < 120; iteration += 1) {
    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
        const left = nodes[leftIndex];
        const right = nodes[rightIndex];
        const dx = right.x - left.x;
        const dy = right.y - left.y;
        const distance = Math.sqrt((dx * dx) + (dy * dy)) || 0.001;
        const minDistance = left.radius + right.radius + 0.65;
        if (distance >= minDistance) continue;
        const push = (minDistance - distance) * 0.5;
        const nx = dx / distance;
        const ny = dy / distance;
        left.x -= nx * push;
        left.y -= ny * push;
        right.x += nx * push;
        right.y += ny * push;
      }
    }

    nodes.forEach((node) => {
      node.x += (50 - node.x) * 0.01;
      node.y += (54 - node.y) * 0.006;
      node.x = clamp(node.x, 8 + node.radius, 92 - node.radius);
      node.y = clamp(node.y, 16 + node.radius, 90 - node.radius);
    });
  }

  const mobileColumns = Math.max(1, Math.min(3, topics.length || 1));
  const mobileRows = Math.max(1, Math.ceil(topics.length / mobileColumns));
  return nodes.map((node) => {
    const mobileCol = node.index % mobileColumns;
    const mobileRow = Math.floor(node.index / mobileColumns);
    return {
      ...node,
      mobileX: ((mobileCol + 0.5) / mobileColumns) * 100,
      mobileY: 15 + (((mobileRow + 0.5) / mobileRows) * 76),
    };
  });
};

const toTestIdFragment = (value = '') => String(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const RISK_MATRIX_CATEGORIES = [
  { name: 'Safety', subcategories: ['Alignment', 'Evaluations', 'Red Teaming', 'Containment'] },
  { name: 'Capabilities', subcategories: ['Scaling', 'Agents', 'Reasoning', 'Multimodal'] },
  { name: 'Governance', subcategories: ['Regulation', 'Licensing', 'International', 'Liability'] },
  { name: 'Open Source', subcategories: ['Weight Release', 'Democratization', 'Safety Tradeoffs'] },
  { name: 'Labor', subcategories: ['Automation', 'Productivity', 'Inequality', 'Retraining'] },
  { name: 'Security', subcategories: ['Cyber Offense', 'Biosecurity', 'Surveillance', 'Deepfakes'] },
  { name: 'Military', subcategories: ['Autonomous Weapons', 'Escalation', 'Arms Control'] },
  { name: 'Infra', subcategories: ['Compute', 'Energy', 'Data Centers', 'Supply Chain'] },
  { name: 'Discourse', subcategories: ['Media', 'Narratives', 'Trust', 'Misinformation'] },
  { name: 'Crypto', subcategories: ['ZK Proofs', 'Trustless Agreements', 'Post-Quantum', 'Key Management'] },
];

const isCanonicalRiskMatrixCellId = (cell = '') => {
  const parts = String(cell).split('.');
  return parts.length === 4 && parts.every(Boolean);
};

const isValidRiskAnalysisComment = (entry) => {
  if (!entry || typeof entry !== 'object') return false;
  const intensity = Number(entry.intensity);
  return isCanonicalRiskMatrixCellId(entry.cell)
    && typeof entry.comment === 'string'
    && entry.comment.trim().length > 0
    && (entry.valence === 'opportunity' || entry.valence === 'risk')
    && Number.isFinite(intensity)
    && intensity > 0;
};

const getRiskCommentsForAggregateCell = (comments = [], catX = '', catY = '') => (
  comments.filter((entry) => {
    if (!isValidRiskAnalysisComment(entry)) return false;
    const [entryCatX, , entryCatY] = String(entry.cell).split('.');
    return entryCatX === catX && entryCatY === catY;
  })
);

const getRiskCommentsForSubCell = (comments = [], catX = '', subX = '', catY = '', subY = '') => (
  comments.filter((entry) => entry.cell === `${catX}.${subX}.${catY}.${subY}`)
);

const riskCommentSignedValue = (entry) => (
  (entry?.valence === 'risk' ? -1 : 1) * Number(entry?.intensity || 0)
);

const sumRiskComments = (comments = []) => (
  comments.reduce((sum, entry) => sum + riskCommentSignedValue(entry), 0)
);

const riskAggregateCellId = (catX = '', catY = '') => `${catX}_vs_${catY}`;

const riskSubCellId = (catX = '', subX = '', catY = '', subY = '') => `${catX}.${subX}.${catY}.${subY}`;

const formatRiskCellPath = (cellId = '') => {
  const parts = String(cellId || '').split('.');
  if (parts.length !== 4) return cellId;
  return `${parts[0]} / ${parts[1]} -> ${parts[2]} / ${parts[3]}`;
};

const formatRiskSelectionTitle = (cellId = '') => {
  const raw = String(cellId || '');
  if (!raw) return 'Interaction detail';
  if (raw.includes('_vs_')) {
    const [catX, catY] = raw.split('_vs_');
    return `Interaction: ${catX} vs ${catY}`;
  }
  const [catX, subX, catY, subY] = raw.split('.');
  if (!catX || !subX || !catY || !subY) return raw;
  return `${catX} / ${subX} vs ${catY} / ${subY}`;
};

const normalizeOverlayList = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (typeof entry === 'string') return entry.trim();
    if (entry && typeof entry === 'object') {
      return String(entry.summary || entry.text || entry.comment || '').trim();
    }
    return '';
  }).filter(Boolean);
};

const normalizeOverlayScenarios = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const id = String(entry.id || entry.scenarioId || `scenario-${index + 1}`).trim();
      const title = String(entry.title || entry.label || '').trim();
      const summary = String(entry.summary || entry.description || '').trim();
      if (!title && !summary) return null;
      return {
        id,
        atlasNodeId: String(entry.atlasNodeId || entry.topicId || entry.linkedTopicId || '').trim(),
        atlasNodeLabel: String(entry.atlasNodeLabel || entry.topicLabel || entry.topic || entry.atlasNodeId || 'Debate atlas overlap').trim(),
        title: title || 'Generated atlas scenario',
        summary,
        valence: String(entry.valence || entry.type || 'mixed').trim().toLowerCase(),
        confidence: String(entry.confidence || '').trim(),
        timeHorizon: String(entry.timeHorizon || entry.horizon || '').trim(),
        primaryMechanism: String(entry.primaryMechanism || entry.mechanism || entry.whyItMatters || '').trim(),
        image: String(entry.image || entry.imageUrl || '').trim(),
        imageAlt: String(entry.imageAlt || '').trim(),
        historicalAnchors: Array.isArray(entry.historicalAnchors)
          ? entry.historicalAnchors.map((anchor) => ({
            name: String(anchor?.name || '').trim(),
            role: String(anchor?.role || anchor?.description || '').trim(),
            avatar: String(anchor?.avatar || anchor?.image || '').trim(),
          })).filter((anchor) => anchor.name)
          : [],
      };
    })
    .filter(Boolean);
};

const buildRiskMatrixAnalysisPayload = (comments = [], overlayCells = {}) => {
  const cells = Object.create(null);
  const putCell = (cellId, value, cellComments = [], type = 'aggregate') => {
    cells[cellId] = {
      id: cellId,
      type,
      title: formatRiskSelectionTitle(cellId),
      value,
      noteCount: cellComments.length,
      opportunities: cellComments.filter((entry) => entry.valence === 'opportunity'),
      risks: cellComments.filter((entry) => entry.valence === 'risk'),
    };
  };

  RISK_MATRIX_CATEGORIES.forEach((catY) => {
    RISK_MATRIX_CATEGORIES.forEach((catX) => {
      if (catX.name === catY.name) return;
      const cellComments = getRiskCommentsForAggregateCell(comments, catX.name, catY.name);
      putCell(riskAggregateCellId(catX.name, catY.name), sumRiskComments(cellComments), cellComments, 'aggregate');
    });
  });

  comments.forEach((entry) => {
    if (!isValidRiskAnalysisComment(entry)) return;
    const existing = cells[entry.cell] || {
      id: entry.cell,
      type: 'subcell',
      title: formatRiskSelectionTitle(entry.cell),
      value: 0,
      noteCount: 0,
      opportunities: [],
      risks: [],
    };
    existing.value += riskCommentSignedValue(entry);
    existing.noteCount += 1;
    if (entry.valence === 'opportunity') existing.opportunities.push(entry);
    if (entry.valence === 'risk') existing.risks.push(entry);
    cells[entry.cell] = existing;
  });

  Object.entries(overlayCells || {}).forEach(([cellId, overlay]) => {
    if (!cellId || !overlay || typeof overlay !== 'object') return;
    const existing = cells[cellId] || {
      id: cellId,
      type: String(cellId).includes('_vs_') ? 'aggregate' : 'subcell',
      title: formatRiskSelectionTitle(cellId),
      value: 0,
      noteCount: 0,
      opportunities: [],
      risks: [],
    };
    if (overlay.title) existing.title = String(overlay.title);
    existing.aiSummary = String(overlay.summary || overlay.aiSummary || '').trim();
    existing.aiOpportunities = normalizeOverlayList(overlay.opportunities || overlay.aiOpportunities);
    existing.aiRisks = normalizeOverlayList(overlay.risks || overlay.aiRisks);
    existing.linkedQuestionIds = normalizeOverlayList(overlay.linkedQuestionIds);
    existing.linkedTopicIds = normalizeOverlayList(overlay.linkedTopicIds);
    existing.confidence = String(overlay.confidence || '').trim();
    existing.generatedBy = String(overlay.generatedBy || overlay.model || '').trim();
    existing.scenarios = normalizeOverlayScenarios(overlay.scenarios || overlay.atlasScenarios);
    cells[cellId] = existing;
  });

  return {
    schemaVersion: 1,
    generatedBy: Object.keys(overlayCells || {}).length
      ? 'ai-discourse-bench.validated-analysis-overlay'
      : 'not-generated',
    cells,
  };
};

const normalizeAiAnalysisItems = (value, report) => {
  if (!Array.isArray(value)) return [];
  const questionIds = new Set(getQuestions(report).map((question) => question.id));
  return value
    .map((entry) => {
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        return trimmed ? { label: trimmed, questionId: questionIds.has(trimmed) ? trimmed : '' } : null;
      }
      if (!entry || typeof entry !== 'object') return null;
      const questionId = String(entry.questionId || entry.id || '').trim();
      const label = String(entry.summary || entry.text || entry.claim || entry.label || questionId).trim();
      if (!label) return null;
      return { label, questionId: questionIds.has(questionId) ? questionId : '' };
    })
    .filter(Boolean);
};

const renderAiAnalysisList = (title, items) => {
  if (!items.length) return '';
  return `<section class="aidb-ai-analysis-card">
    <h6>${escapeHtml(title)}</h6>
    <ul>
      ${items.map((item) => `<li>${item.questionId
    ? `<a href="#question-${escapeHtml(item.questionId)}">${escapeHtml(item.label)}</a>`
    : escapeHtml(item.label)}</li>`).join('')}
    </ul>
  </section>`;
};

const renderAiAnalysis = (report) => {
  const analysis = report.analysisOverlay?.aiAnalysis;
  if (!analysis || typeof analysis !== 'object') return '';
  const executiveSummary = String(analysis.executiveSummary || analysis.summary || '').trim();
  const strongestConsensus = normalizeAiAnalysisItems(analysis.strongestConsensus, report);
  const sharpestDisagreements = normalizeAiAnalysisItems(analysis.sharpestDisagreements, report);
  const caveats = normalizeAiAnalysisItems(analysis.caveats, report);
  if (!executiveSummary && !strongestConsensus.length && !sharpestDisagreements.length && !caveats.length) {
    return '';
  }

  const body = `<div class="reportAnalysisContent aidb-ai-analysis-content" data-ce-ai-analysis-overlay>
    ${executiveSummary ? `<p class="aidb-ai-analysis-summary">${escapeHtml(executiveSummary)}</p>` : ''}
    <div class="aidb-ai-analysis-grid">
      ${renderAiAnalysisList('Strongest Consensus', strongestConsensus)}
      ${renderAiAnalysisList('Sharpest Disagreements', sharpestDisagreements)}
      ${renderAiAnalysisList('Caveats', caveats)}
    </div>
  </div>`;

  return renderCollapsibleSection({
    id: 'ai-analysis',
    title: 'AI Analysis',
    subtitle: 'Second-pass synthesis generated from the benchmark result',
    bodyClassName: 'graphSection aidb-ai-analysis-section',
    body,
  });
};

const selectDefaultRiskMatrixIntersection = (comments = [], heatmap = new Map()) => {
  let selected = null;
  RISK_MATRIX_CATEGORIES.forEach((catY) => {
    RISK_MATRIX_CATEGORIES.forEach((catX) => {
      if (catX.name === catY.name) return;
      const value = heatmap.get(`${catY.name}_${catX.name}`) || 0;
      const aggregateComments = getRiskCommentsForAggregateCell(comments, catX.name, catY.name);
      if (value === 0) return;
      const score = Math.abs(value) + (aggregateComments.length / 100);
      if (!selected || score > selected.score) {
        selected = {
          activeCategoryX: catX.name,
          activeCategoryY: catY.name,
          score,
        };
      }
    });
  });

  return selected || {
    activeCategoryX: RISK_MATRIX_CATEGORIES[1]?.name || null,
    activeCategoryY: RISK_MATRIX_CATEGORIES[0]?.name || null,
  };
};

const REPORT_DEFAULT_EMBEDDING_LABEL = 'Polis Auto';
const PARTICIPANTS_GRAPH_TOOLTIP_TEXT = `This static diagram uses distributional answer similarity and places models with classical MDS. ${REPORT_DEFAULT_EMBEDDING_LABEL} assigns connected opinion groups while preserving insufficient-overlap participants separately; the opinion-group control can preview deterministic K-medoids alternatives without changing the report data.`;
const REPORT_DEFAULT_EMBEDDING_TOOLTIP_TEXT = "Polis Auto is the closest live control vocabulary for this static export. The generated position is classical MDS over Jensen-Shannon answer-distribution distance, and opinion groups are connected components over the report threshold. This is Polis-inspired analysis inside Context Engine, not an official Polis/Pol.is integration or endorsement.";
const OPINION_GROUPS_TOOLTIP_TEXT = "Choose a deterministic K-medoids grouping over the report similarity matrix. Auto restores the generated connected-component opinion groups.";
const D3_CATEGORY10 = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
const WORLD_MAP_ANSWER_COLORS = Object.freeze({
  Agree: '#4dffa4',
  Unsure: '#ffd166',
  Disagree: '#ff6b6b',
});
const WORLD_MAP_DEFAULT_COUNTRY_FILL = 'rgba(226, 232, 255, 0.08)';
const WORLD_MAP_COUNTRY_ALIASES = Object.freeze({
  AU: 'Australia',
  AUS: 'Australia',
  AT: 'Austria',
  AUT: 'Austria',
  BE: 'Belgium',
  BEL: 'Belgium',
  BR: 'Brazil',
  BRA: 'Brazil',
  CA: 'Canada',
  CAN: 'Canada',
  CN: 'China',
  CHN: 'China',
  CZ: 'Czechia',
  CZE: 'Czechia',
  DK: 'Denmark',
  DNK: 'Denmark',
  DE: 'Germany',
  DEU: 'Germany',
  FR: 'France',
  FRA: 'France',
  GB: 'United Kingdom',
  GBR: 'United Kingdom',
  UK: 'United Kingdom',
  IN: 'India',
  IND: 'India',
  JP: 'Japan',
  JPN: 'Japan',
  KR: 'South Korea',
  KOR: 'South Korea',
  RU: 'Russia',
  RUS: 'Russia',
  TR: 'Turkey',
  TUR: 'Turkey',
  US: 'United States of America',
  USA: 'United States of America',
  'United States': 'United States of America',
});

const participantsById = (report) => Object.fromEntries((report.participants || []).map((entry) => [entry.id, entry]));

const getQuestions = (report) => {
  if (Array.isArray(report.questions) && report.questions.length) return report.questions;
  return Object.keys(report.polisReport?.byQuestion || {}).map((id) => ({ id, prompt: id, topic: 'uncategorized' }));
};

const answerTotals = (summary = {}) => {
  const counts = summary.counts || {};
  const agree = counts.Agree || 0;
  const unsure = counts.Unsure || 0;
  const disagree = counts.Disagree || 0;
  const invalid = summary.invalid || 0;
  const total = Math.max(1, agree + unsure + disagree + invalid);
  return { agree, unsure, disagree, invalid, total };
};

const validVoteCount = (summary = {}) => {
  const { agree, unsure, disagree } = answerTotals(summary);
  return agree + unsure + disagree;
};

const answerFromMeanScore = (score) => {
  if (!Number.isFinite(score)) return null;
  if (score > 0.25) return 'Agree';
  if (score < -0.25) return 'Disagree';
  return 'Unsure';
};

const concreteVoteCount = (summary = {}) => {
  const { agree, disagree } = answerTotals(summary);
  return agree + disagree;
};

const normalizeAnalysisTopicCircles = (report) => {
  const overlayTopics = report.analysisOverlay?.debateAtlas?.topicCircles;
  const measuredTopics = report.debateAtlas?.topicCircles || [];
  const measuredTopicById = new Map(measuredTopics.map((topic) => [String(topic.id), topic]));
  const sourceTopics = (
    Array.isArray(overlayTopics) && overlayTopics.length
      ? overlayTopics
      : report.debateAtlas?.topicCircles
  ) || [];
  const questions = getQuestions(report);
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const byQuestion = report.polisReport?.byQuestion || {};
  return sourceTopics.map((topic, index) => {
    const measuredTopic = measuredTopicById.get(String(topic.id || '')) || null;
    const questionIds = Array.isArray(topic.questionIds)
      ? topic.questionIds.filter((id) => questionById.has(id))
      : [];
    const summaries = questionIds
      .map((id) => byQuestion[id])
      .filter((summary) => summary && Number.isFinite(summary.meanScore));
    const derivedAverage = summaries.length
      ? summaries.reduce((sum, summary) => sum + summary.meanScore, 0) / summaries.length
      : null;
    const averageStance = Number.isFinite(topic.averageStance)
      ? topic.averageStance
      : (Number.isFinite(derivedAverage) ? derivedAverage : 0);
    const rawLabel = topic.label || topic.id || `topic-${index + 1}`;
    return {
      ...topic,
      id: topic.id || String(rawLabel).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `topic-${index + 1}`,
      label: rawLabel,
      questionCount: Number.isFinite(topic.questionCount) ? topic.questionCount : questionIds.length,
      averageStance,
      importanceVotes: Number.isFinite(Number(topic.importanceVotes))
        ? Number(topic.importanceVotes)
        : measuredTopic?.importanceVotes ?? null,
      importanceShare: Number.isFinite(Number(topic.importanceShare))
        ? Number(topic.importanceShare)
        : measuredTopic?.importanceShare ?? null,
      importanceModelCount: Number(topic.importanceModelCount || measuredTopic?.importanceModelCount || 0),
      sizeMetric: topic.sizeMetric || measuredTopic?.sizeMetric || 'question-count',
      questionIds,
    };
  });
};

const averageFiniteValues = (values = []) => {
  const finiteValues = values.filter(Number.isFinite);
  if (!finiteValues.length) return null;
  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
};

const polarityRepeatTotalsForCell = (cell = {}) => (
  ['canonical', 'reversedNormalized'].reduce((totals, polarity) => {
    const form = cell?.polarity?.[polarity];
    const attempts = Number(form?.total || 0);
    if (!Number.isFinite(attempts) || attempts <= 0) return totals;
    const answerCounts = ['Agree', 'Unsure', 'Disagree'].map((answer) => (
      Number(form?.counts?.[answer] || 0)
    ));
    totals.winningResponses += Math.max(0, ...answerCounts);
    totals.attemptedRuns += attempts;
    totals.validRuns += answerCounts.reduce((sum, count) => sum + count, 0);
    return totals;
  }, { winningResponses: 0, attemptedRuns: 0, validRuns: 0 })
);

const questionModelDifference = (report, questionId) => {
  const scores = Object.values(report.polisReport?.byModelQuestion || {})
    .map((modelQuestions) => modelQuestions?.[questionId]?.meanScore)
    .filter(Number.isFinite);
  if (scores.length < 2) return null;
  return Math.max(...scores) - Math.min(...scores);
};

const participantVisualsForReport = (report) => new Map(
  (Array.isArray(report.participants) ? report.participants : []).map((participant, index) => [participant.id, {
    color: D3_CATEGORY10[index % D3_CATEGORY10.length],
    markerLabel: String(index + 1),
  }]),
);

const modelAnswersForQuestion = (report, questionId, participantVisuals = participantVisualsForReport(report)) => {
  const byModelQuestion = report.polisReport?.byModelQuestion || {};
  return (Array.isArray(report.participants) ? report.participants : []).map((participant) => {
    const modelSummary = byModelQuestion[participant.id]?.[questionId];
    if (!modelSummary) return null;
    const answer = answerFromMeanScore(modelSummary.meanScore)
      || (Number(modelSummary.total || 0) > 0 ? 'Invalid' : null);
    if (!answer) return null;
    const visual = participantVisuals.get(participant.id);
    const attemptedRuns = Number(modelSummary.total || 0);
    const winningResponses = Math.max(
      0,
      ...['Agree', 'Unsure', 'Disagree'].map((value) => Number(modelSummary.counts?.[value] || 0)),
    );
    return {
      id: participant.id,
      label: participant.label || participant.id,
      answer,
      meanScore: modelSummary.meanScore,
      winningResponses,
      attemptedRuns,
      repeatStability: attemptedRuns > 0 ? winningResponses / attemptedRuns : null,
      color: visual.color,
      markerLabel: visual.markerLabel,
    };
  }).filter(Boolean);
};

const normalizeIssueAnalysisSections = (sections, questionById) => (
  Array.isArray(sections)
    ? sections.map((section, index) => {
      if (!section || typeof section !== 'object') return null;
      const title = String(section.title || '').trim();
      const body = String(section.body || '').trim();
      const bullets = normalizeOverlayList(section.bullets);
      const linkedQuestionIds = Array.isArray(section.linkedQuestionIds)
        ? section.linkedQuestionIds.filter((id) => questionById.has(id))
        : [];
      if (!title || (!body && !bullets.length && !linkedQuestionIds.length)) return null;
      return {
        id: `analysis-section-${index + 1}`,
        title,
        body,
        bullets,
        linkedQuestionIds,
      };
    }).filter(Boolean)
    : []
);

const normalizeAnalysisIssueAreas = (report, topics = normalizeAnalysisTopicCircles(report)) => {
  const questions = getQuestions(report);
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const byQuestion = report.polisReport?.byQuestion || {};
  const byModelQuestion = report.polisReport?.byModelQuestion || {};
  const participants = Array.isArray(report.participants) ? report.participants : [];
  const participantVisuals = participantVisualsForReport(report);
  const overlayIssueAreas = Array.isArray(report.analysisOverlay?.debateAtlas?.issueAreas)
    ? report.analysisOverlay.debateAtlas.issueAreas
    : [];
  const overlayById = new Map(overlayIssueAreas
    .filter((issueArea) => issueArea && typeof issueArea === 'object' && issueArea.id)
    .map((issueArea) => [String(issueArea.id), issueArea]));

  return topics.map((topic, index) => {
    const overlay = overlayById.get(String(topic.id)) || null;
    const linkedQuestionIds = Array.from(new Set([
      ...(Array.isArray(topic.questionIds) ? topic.questionIds : []),
      ...(Array.isArray(overlay?.linkedQuestionIds) ? overlay.linkedQuestionIds : []),
    ])).filter((id) => questionById.has(id));
    const linkedQuestions = linkedQuestionIds.map((questionId) => {
      const question = questionById.get(questionId);
      const summary = byQuestion[questionId] || {};
      const modelAnswers = modelAnswersForQuestion(report, questionId, participantVisuals);
      return {
        ...question,
        voteSummary: {
          counts: {
            Agree: Number(summary.counts?.Agree || 0),
            Unsure: Number(summary.counts?.Unsure || 0),
            Disagree: Number(summary.counts?.Disagree || 0),
          },
          invalid: Number(summary.invalid || 0),
        },
        modelAnswers,
        modelDifference: questionModelDifference(report, questionId),
        winningResponseConsistency: Number.isFinite(summary.winningResponseConsistency?.rate)
          ? summary.winningResponseConsistency.rate
          : null,
        meanScore: Number.isFinite(summary.meanScore) ? summary.meanScore : null,
      };
    });
    const tags = [];
    const seenTags = new Set();
    [
      ...(Array.isArray(overlay?.tags) ? overlay.tags : []),
      ...(Array.isArray(topic.tags) ? topic.tags : []),
      ...linkedQuestions.flatMap((question) => (Array.isArray(question.subtopics) ? question.subtopics : [])),
    ].forEach((value) => {
      const tag = String(value || '').trim();
      const key = tag.toLowerCase();
      if (!tag || seenTags.has(key) || tags.length >= 8) return;
      seenTags.add(key);
      tags.push(tag);
    });
    const averageModelDifference = averageFiniteValues(linkedQuestions.map((question) => question.modelDifference));
    const averageWinningResponseConsistency = averageFiniteValues(
      linkedQuestions.map((question) => question.winningResponseConsistency),
    );
    const answeringModels = participants.map((participant) => {
      const modelQuestions = byModelQuestion[participant.id] || {};
      const answeredQuestionIds = linkedQuestionIds.filter((questionId) => (
        validVoteCount(modelQuestions[questionId]) > 0
      ));
      const peerDifferences = answeredQuestionIds.flatMap((questionId) => {
        const selectedScore = modelQuestions[questionId]?.meanScore;
        if (!Number.isFinite(selectedScore)) return [];
        return participants
          .filter((peer) => peer.id !== participant.id)
          .map((peer) => byModelQuestion[peer.id]?.[questionId]?.meanScore)
          .filter(Number.isFinite)
          .map((peerScore) => Math.abs(selectedScore - peerScore));
      });
      const repeatTotals = answeredQuestionIds.reduce((totals, questionId) => {
        const modelSummary = modelQuestions[questionId] || {};
        const attempts = Number(modelSummary.total || 0);
        if (!Number.isFinite(attempts) || attempts <= 0) return totals;
        const answerCounts = ['Agree', 'Unsure', 'Disagree'].map((answer) => (
          Number(modelSummary.counts?.[answer] || 0)
        ));
        totals.winningResponses += Math.max(0, ...answerCounts);
        totals.attemptedRuns += attempts;
        return totals;
      }, { winningResponses: 0, attemptedRuns: 0 });
      return {
        id: participant.id,
        label: participant.label || participant.id,
        ...participantVisuals.get(participant.id),
        answeredQuestionCount: answeredQuestionIds.length,
        averageStance: averageFiniteValues(answeredQuestionIds.map((questionId) => (
          modelQuestions[questionId]?.meanScore
        ))),
        averagePeerDifference: averageFiniteValues(peerDifferences),
        repeatStability: repeatTotals.attemptedRuns
          ? repeatTotals.winningResponses / repeatTotals.attemptedRuns
          : null,
      };
    }).filter((participant) => participant.answeredQuestionCount > 0);
    const fallbackTitle = topic.label || topic.id || `Issue Area ${index + 1}`;
    const title = String(overlay?.title || formatDisplayLabel(fallbackTitle) || fallbackTitle).trim();
    return {
      ...topic,
      title,
      summary: String(overlay?.summary || topic.summary || '').trim(),
      tags,
      linkedQuestionIds,
      linkedQuestions,
      answeringModels,
      totalModelCount: participants.length,
      answeredModelQuestionCount: answeringModels.reduce(
        (sum, participant) => sum + participant.answeredQuestionCount,
        0,
      ),
      averageModelDifference,
      averageWinningResponseConsistency,
      keyTensions: normalizeOverlayList(overlay?.keyTensions),
      pointsOfAgreement: normalizeOverlayList(overlay?.pointsOfAgreement),
      pointsOfDisagreement: normalizeOverlayList(overlay?.pointsOfDisagreement),
      openQuestions: normalizeOverlayList(overlay?.openQuestions),
      implications: normalizeOverlayList(overlay?.implications),
      confidence: ['low', 'medium', 'high'].includes(overlay?.confidence) ? overlay.confidence : null,
      analysisSections: normalizeIssueAnalysisSections(overlay?.analysisSections, questionById),
      hasGeneratedAnalysis: !!overlay,
    };
  });
};

const normalizeCompassAxis = (axis = {}, fallbackLeft = 'Left', fallbackRight = 'Right') => ({
  label: axis.label || axis.name || '',
  left: axis.left || axis.bottom || axis.negative || axis.low || fallbackLeft,
  right: axis.right || axis.top || axis.positive || axis.high || fallbackRight,
});

const normalizeAnalysisCompasses = (report) => {
  const compasses = report.analysisOverlay?.debateAtlas?.compasses;
  if (!Array.isArray(compasses)) return [];
  return compasses
    .map((compass, index) => {
      const placements = Array.isArray(compass.placements)
        ? compass.placements
        : (Array.isArray(compass.points) ? compass.points : []);
      const normalizedPlacements = placements
        .map((placement, placementIndex) => {
          const x = Number(placement.x);
          const y = Number(placement.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
          return {
            ...placement,
            id: placement.id || placement.label || `placement-${placementIndex + 1}`,
            label: placement.label || placement.id || `Point ${placementIndex + 1}`,
            x: clamp(x, -1, 1),
            y: clamp(y, -1, 1),
          };
        })
        .filter(Boolean);
      if (!normalizedPlacements.length) return null;
      return {
        ...compass,
        id: compass.id || `analysis-compass-${index + 1}`,
        title: compass.title || compass.name || `Analysis Compass ${index + 1}`,
        xAxis: normalizeCompassAxis(compass.xAxis, 'Left', 'Right'),
        yAxis: normalizeCompassAxis(compass.yAxis, 'Bottom', 'Top'),
        placements: normalizedPlacements,
      };
    })
    .filter(Boolean);
};

const renderAnswerBar = (summary = {}) => {
  const { agree, unsure, disagree, invalid, total } = answerTotals(summary);
  return `<span class="aidb-answer-bar" aria-label="answer distribution">
    <i class="aidb-answer-agree" style="width:${(agree / total) * 100}%"></i>
    <i class="aidb-answer-unsure" style="width:${(unsure / total) * 100}%"></i>
    <i class="aidb-answer-disagree" style="width:${(disagree / total) * 100}%"></i>
    <i class="aidb-answer-invalid" style="width:${(invalid / total) * 100}%"></i>
  </span>`;
};

const renderPolisBoxPlot = (summary = {}) => {
  const { agree, unsure, disagree } = answerTotals(summary);
  const totalConcrete = agree + unsure + disagree;
  const width = 200;
  const height = 30;
  const denom = totalConcrete > 0 ? totalConcrete : 1;
  const agreeWidth = (agree / denom) * width;
  const unsureWidth = (unsure / denom) * width;
  const disagreeWidth = (disagree / denom) * width;
  let currentX = 0;
  const segments = totalConcrete > 0
    ? [
      `<rect x="${currentX}" y="0" width="${agreeWidth}" height="${height}" fill="green" />`,
      (currentX += agreeWidth, `<rect x="${currentX}" y="0" width="${unsureWidth}" height="${height}" fill="yellow" />`),
      (currentX += unsureWidth, `<rect x="${currentX}" y="0" width="${disagreeWidth}" height="${height}" fill="red" />`),
    ].join('')
    : '';
  return `<div class="polisBoxPlotContainer">
    <svg width="${width}" height="${height}" class="polisBoxPlotSvg" role="img" aria-label="Agree, unsure, and disagree box plot">
      <rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="#000" stroke-width="1" />
      ${segments}
    </svg>
  </div>`;
};

const questionSpread = (report, questionId) => {
  const values = (report.participants || [])
    .map((participant) => report.polisReport?.byModelQuestion?.[participant.id]?.[questionId]?.meanScore)
    .filter(Number.isFinite);
  if (values.length < 2) return null;
  return Math.max(...values) - Math.min(...values);
};

const aggregateQuestionSummaryForModels = (report, questionId, participantIds = []) => {
  const ids = new Set(participantIds);
  const counts = { Agree: 0, Unsure: 0, Disagree: 0 };
  let invalid = 0;
  let total = 0;
  (report.participants || []).forEach((participant) => {
    if (ids.size && !ids.has(participant.id)) return;
    const summary = report.polisReport?.byModelQuestion?.[participant.id]?.[questionId];
    if (!summary) return;
    counts.Agree += summary.counts?.Agree || 0;
    counts.Unsure += summary.counts?.Unsure || 0;
    counts.Disagree += summary.counts?.Disagree || 0;
    invalid += summary.invalid || 0;
    total += summary.total || 0;
  });
  const valid = counts.Agree + counts.Unsure + counts.Disagree;
  return {
    counts,
    invalid,
    total,
    meanScore: valid > 0 ? (counts.Agree - counts.Disagree) / valid : null,
    uncertaintyRate: valid > 0 ? counts.Unsure / valid : 0,
    invalidRate: total > 0 ? invalid / total : 0,
  };
};

const topDifferenceQuestions = (report, limit = 12) => getQuestions(report)
  .map((question) => ({
    ...question,
    spread: questionSpread(report, question.id),
    summary: report.polisReport?.byQuestion?.[question.id] || {},
  }))
  .sort((left, right) => (right.spread ?? -1) - (left.spread ?? -1))
  .slice(0, limit);

const strongestAnswerForSummary = (summary = {}) => {
  const { agree, unsure, disagree } = answerTotals(summary);
  const ordered = [
    ['Agree', agree],
    ['Unsure', unsure],
    ['Disagree', disagree],
  ].sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    const preference = { Agree: 0, Disagree: 1, Unsure: 2 };
    return preference[left[0]] - preference[right[0]];
  });
  return ordered[0]?.[1] > 0 ? ordered[0][0] : 'Unsure';
};

const answerDistributionRows = (summary = {}) => {
  const { agree, unsure, disagree } = answerTotals(summary);
  const valid = Math.max(1, agree + unsure + disagree);
  return [
    ['Agree', agree],
    ['Unsure', unsure],
    ['Disagree', disagree],
  ].map(([responseText, count]) => ({
    responseText,
    count,
    rate: count / valid,
  }));
};

const renderAnalysisDistribution = (summary, groupName, segmentKey = groupName) => {
  const rows = answerDistributionRows(summary);
  const valid = rows.reduce((sum, row) => sum + row.count, 0);
  const segments = rows.map((row) => `<span
    class="analysisCandleSegment analysisCandleSegment${escapeHtml(row.responseText)}"
    style="width:${escapeHtml((row.rate * 100).toFixed(2))}%"
    title="${escapeHtml(`${row.responseText}: ${(row.rate * 100).toFixed(0)}%`)}"
  ></span>`).join('');
  const legend = rows.map((row) => `<span class="analysisDistributionLegendItem">
    <span class="analysisDistributionDot analysisCandleSegment${escapeHtml(row.responseText)}"></span>
    ${escapeHtml(row.responseText)} ${escapeHtml((row.rate * 100).toFixed(0))}%
  </span>`).join('');
  return `<div class="analysisDistributionDataset">
    <div class="analysisDistributionHeader">
      <span class="analysisDistributionTitle">${escapeHtml(groupName)}</span>
      <span class="analysisDistributionMeta">${escapeHtml(valid)} modeled responses</span>
    </div>
    <div
      class="analysisCandlestick"
      data-testid="ce-demo-analysis-card-candlestick-${escapeHtml(toTestIdFragment(segmentKey))}"
      aria-label="${escapeHtml(`${groupName} response distribution: ${rows.map((row) => `${row.responseText} ${(row.rate * 100).toFixed(0)}%`).join(', ')}.`)}"
    >
      ${segments}
    </div>
    <div class="analysisDistributionLegend">${legend}</div>
  </div>`;
};

const getTraitComparisonCandidates = (report, selectedQuestion) => {
  const traits = report.breakdown || {};
  return Object.entries(traits).flatMap(([trait, groups]) => {
    const entries = Object.entries(groups || {})
      .map(([value, ids]) => {
        const summary = selectedQuestion
          ? aggregateQuestionSummaryForModels(report, selectedQuestion.id, ids)
          : {};
        return {
          trait,
          value,
          ids,
          summary,
          name: `${formatDisplayLabel(trait)}: ${formatDisplayLabel(value)}`,
          segmentKey: `${trait}:${value}`,
        };
      })
      .filter((entry) => entry.ids.length > 0);
    const pairs = [];
    for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
        const left = entries[leftIndex];
        const right = entries[rightIndex];
        const leftMean = Number.isFinite(left.summary.meanScore) ? left.summary.meanScore : 0;
        const rightMean = Number.isFinite(right.summary.meanScore) ? right.summary.meanScore : 0;
        const leftVotes = validVoteCount(left.summary);
        const rightVotes = validVoteCount(right.summary);
        pairs.push({
          trait,
          groups: [left, right],
          divergence: Math.abs(leftMean - rightMean),
          support: leftVotes + rightVotes,
          size: left.ids.length + right.ids.length,
        });
      }
    }
    return pairs;
  });
};

const defaultComparisonGroups = (report, selectedQuestion) => {
  const candidates = getTraitComparisonCandidates(report, selectedQuestion)
    .sort((left, right) => (
      (right.divergence - left.divergence)
      || (right.support - left.support)
      || (right.size - left.size)
    ));
  if (candidates[0]) return candidates[0].groups;
  const fallbackTrait = Object.entries(report.breakdown || {})
    .map(([trait, groups]) => [trait, Object.entries(groups || {})])
    .find(([, groups]) => groups.length >= 2);
  if (!fallbackTrait) return [];
  const [trait, groups] = fallbackTrait;
  return groups.slice(0, 2).map(([value, ids]) => ({
    trait,
    value,
    ids,
    name: `${formatDisplayLabel(trait)}: ${formatDisplayLabel(value)}`,
    segmentKey: `${trait}:${value}`,
    summary: selectedQuestion ? aggregateQuestionSummaryForModels(report, selectedQuestion.id, ids) : {},
  }));
};

const comparisonRowsForGroups = (report, groups, limit = 10) => getQuestions(report)
  .map((question) => {
    const groupSummaries = groups.map((group) => ({
      ...group,
      summary: aggregateQuestionSummaryForModels(report, question.id, group.ids),
    }));
    const validGroups = groupSummaries.filter((group) => validVoteCount(group.summary) > 0);
    if (validGroups.length < 2) return null;
    const means = validGroups.map((group) => (
      Number.isFinite(group.summary.meanScore) ? group.summary.meanScore : 0
    ));
    const divergence = Math.max(...means) - Math.min(...means);
    const averageMean = means.reduce((sum, value) => sum + value, 0) / means.length;
    const comparisonModelIds = Array.from(new Set(groupSummaries.flatMap((group) => group.ids || [])));
    const summary = aggregateQuestionSummaryForModels(report, question.id, comparisonModelIds);
    return {
      question,
      groupSummaries,
      divergence,
      similarity: 1 - Math.min(1, Math.abs(divergence) / 2),
      responseText: strongestAnswerForSummary(summary),
      averageMean,
      summary,
      winningResponseConsistency: questionWinningResponseConsistency(
        report,
        question.id,
        summary,
        comparisonModelIds,
      ),
    };
  })
  .filter(Boolean)
  .sort((left, right) => right.divergence - left.divergence)
  .slice(0, limit);

const renderComparisonAnalysisItem = (row, type) => {
  const distributions = row.groupSummaries.map((group) => (
    renderAnalysisDistribution(group.summary, group.name, group.segmentKey)
  )).join('');
  return `<li class="analysisListItem">
    <div class="reportAnalysisContent">
      <div class="questionText">${escapeHtml(row.question.prompt || row.question.id)}</div>
      <div class="analysisDistributionList">${distributions}</div>
    </div>
  </li>`;
};

const renderInteractiveQuestionBeeswarmPoint = ({
  question,
  summary = {},
  x,
  y,
  radius = 5,
  spread = null,
  extremity = null,
  difference = null,
  winningResponseConsistency = {},
  hasVotes = validVoteCount(summary) > 0,
  comparison = false,
  differenceLabel = 'Model disagreement',
}) => {
  const consistencyRate = Number.isFinite(winningResponseConsistency.rate)
    ? winningResponseConsistency.rate
    : null;
  const consistencyLabel = consistencyRate === null
    ? 'repeat consistency unavailable'
    : `${formatPercent(consistencyRate)} repeat consistency`;
  const totals = answerTotals(summary);
  const noRepeatData = hasVotes && consistencyRate === null;
  const pointClassName = `beeswarmPoint${hasVotes ? '' : ' beeswarmPointNoData'}${noRepeatData ? ' beeswarmPointNoRepeat' : ''}`;
  const circleClassName = `beeswarmCircle${hasVotes ? '' : ' beeswarmCircleNoData'}${noRepeatData ? ' beeswarmCircleNoRepeat' : ''}`;
  const statusLabel = hasVotes ? `${validVoteCount(summary)} modeled responses` : 'No model responses yet';
  const questionId = question.id;
  const prompt = question.prompt || question.id;
  const topic = question.topic || 'uncategorized';
  return `<a
    href="#question-${escapeHtml(questionId)}"
    class="${escapeHtml(pointClassName)}"
    data-ce-searchable
    data-ce-beeswarm-point
    ${comparison ? 'data-ce-comparison-beeswarm-point' : ''}
    data-question-id="${escapeHtml(questionId)}"
    data-question-prompt="${escapeHtml(prompt)}"
    data-question-topic="${escapeHtml(topic)}"
    data-question-has-votes="${hasVotes ? 'true' : 'false'}"
    data-question-status="${escapeHtml(statusLabel)}"
    data-question-agree="${escapeHtml(totals.agree)}"
    data-question-disagree="${escapeHtml(totals.disagree)}"
    data-question-unsure="${escapeHtml(totals.unsure)}"
    data-question-invalid="${escapeHtml(totals.invalid)}"
    data-question-mean="${escapeHtml(formatScore(summary.meanScore))}"
    data-question-spread="${escapeHtml(formatScore(spread))}"
    data-question-extremity="${escapeHtml(formatScore(extremity))}"
    data-question-difference="${escapeHtml(formatScore(difference))}"
    data-question-difference-label="${escapeHtml(differenceLabel)}"
    data-question-votes="${escapeHtml(validVoteCount(summary))}"
    data-question-winning-response-consistency="${escapeHtml(formatScore(consistencyRate))}"
    data-question-winning-responses="${escapeHtml(winningResponseConsistency.winningResponses || 0)}"
    data-question-attempted-runs="${escapeHtml(winningResponseConsistency.attemptedRuns || 0)}"
    data-question-contributing-models="${escapeHtml(winningResponseConsistency.contributingModels || 0)}"
    aria-label="${escapeHtml(`${questionId}: ${prompt} (${statusLabel}; ${consistencyLabel})`)}"
  >
    <circle class="${escapeHtml(circleClassName)}" cx="${escapeHtml(x)}" cy="${escapeHtml(y)}" r="${escapeHtml(radius)}" />
  </a>`;
};

const renderComparisonBeeswarm = (rows = []) => {
  if (!rows.length) {
    return '<p class="noData">No data available to generate a beeswarm plot for the current filter.</p>';
  }
  const width = 700;
  const height = 250;
  const plotLeft = 62;
  const plotRight = width - 20;
  const plotTop = 24;
  const plotBottom = 190;
  const points = rows.map((row) => ({
    ...row,
    id: row.question.id,
    xMetric: clamp(row.divergence / 2, 0, 1),
    yMetric: Number.isFinite(row.winningResponseConsistency?.rate)
      ? clamp(row.winningResponseConsistency.rate, 0, 1)
      : null,
    radius: rows.length > 100 ? 3 : 5,
  }));
  const positionById = packBeeswarmPositions(points, {
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    seedPrefix: 'comparison-swarm',
    getXMetric: (point) => point.xMetric,
    getYMetric: (point) => point.yMetric,
  });
  const yTicks = [1, 0.75, 0.5, 0.25, 0];
  const yGrid = yTicks.map((rate) => {
    const y = plotBottom - rate * (plotBottom - plotTop);
    return `<g class="beeswarmGridTick" aria-hidden="true">
      <line class="beeswarmGridLine" x1="${plotLeft}" y1="${y}" x2="${plotRight}" y2="${y}" />
      <text class="beeswarmTickLabel" x="${plotLeft - 8}" y="${y + 4}" text-anchor="end">${Math.round(rate * 100)}%</text>
    </g>`;
  }).join('');
  const circles = points.map((point, index) => {
    const position = positionById.get(point.id);
    const x = position
      ? position.x
      : plotLeft + point.xMetric * (plotRight - plotLeft);
    const y = position
      ? position.y
      : clamp(plotBottom + 8 + ((index % 3) * 5), plotBottom + 5, height - 34);
    return renderInteractiveQuestionBeeswarmPoint({
      question: point.question,
      summary: point.summary,
      x,
      y,
      radius: point.radius,
      spread: point.divergence,
      extremity: Math.abs(point.averageMean),
      difference: point.xMetric,
      winningResponseConsistency: point.winningResponseConsistency,
      comparison: true,
      differenceLabel: 'Cohort difference',
    });
  }).join('');
  return `<div class="swarmLayoutContainer" data-ce-comparison-beeswarm>
    <div class="swarmContainer" data-ce-beeswarm-scroll-viewport>
      <svg width="${width}" height="${height}" class="beeswarmSvg comparisonBeeswarmSvg" role="img" aria-label="Questions by model-cohort difference and repeat consistency">
        ${yGrid}
        <line class="beeswarmAxisLine" x1="${plotLeft}" y1="${plotTop}" x2="${plotLeft}" y2="${plotBottom}" />
        <line class="beeswarmAxisLine" x1="${plotLeft}" y1="${plotBottom}" x2="${plotRight}" y2="${plotBottom}" />
        <text class="beeswarmAxisTitle" x="14" y="${(plotTop + plotBottom) / 2}" transform="rotate(-90 14 ${(plotTop + plotBottom) / 2})" text-anchor="middle">Repeat consistency</text>
        <text class="beeswarmAxisLabel" x="${plotLeft}" y="232">Similarity</text>
        <text class="beeswarmAxisLabel" x="${plotRight}" y="232" text-anchor="end">Difference</text>
        ${circles}
      </svg>
    </div>
    <div class="swarmScrollControls" data-ce-beeswarm-scroll-controls hidden>
      <button type="button" class="scrollButton" data-ce-beeswarm-scroll="left" title="Scroll to Start" aria-label="Scroll comparison spectrum to start">${renderFontAwesomeIcon('chevron-left')}</button>
      <button type="button" class="scrollButton" data-ce-beeswarm-scroll="right" title="Scroll to End" aria-label="Scroll comparison spectrum to end">${renderFontAwesomeIcon('chevron-right')}</button>
    </div>
  </div>`;
};

const renderComparisonReport = (report, selectedQuestion, groupsOverride = null) => {
  const groups = Array.isArray(groupsOverride) && groupsOverride.length
    ? groupsOverride
    : defaultComparisonGroups(report, selectedQuestion);
  if (groups.length < 2) {
    return `<section class="polisReportContainer comparisonReportContainer" data-testid="demo-analysis-empty-state">
      <div class="comparisonReportEmptyState">
        ${renderFontAwesomeIcon('info-circle', 'comparisonReportEmptyIcon')}
        <h4 style="color: #343a40;">Comparison Report</h4>
        <p class="noData">Select two or more demographic groups from the filters above to see a detailed comparison report.</p>
      </div>
    </section>`;
  }
  const rows = comparisonRowsForGroups(report, groups, 12);
  const topDivergent = rows.slice(0, 5);
  const topSimilar = rows.slice().sort((left, right) => right.similarity - left.similarity).slice(0, 5);
  const colorPalette = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'];
  const legend = groups.map((group, index) => `<span class="legendPill" style="background-color:${escapeHtml(colorPalette[index % colorPalette.length])}">
    ${escapeHtml(group.name)}
  </span>`).join('');
  const summary = `Comparing ${groups.map((group) => group.name).join(', ')}`;
  return `<section class="polisReportContainer comparisonReportContainer" data-testid="demo-analysis-comparison-report" data-ce-searchable>
    <button
      type="button"
      class="reportCollapseHeader"
      aria-expanded="true"
      aria-controls="demo-analysis-comparison-report-body"
      data-testid="demo-analysis-comparison-report-toggle"
    >
      <span class="reportCollapseCopy">
        <span class="mainReportTitle">Comparison Report</span>
        <span class="reportSummaryText" data-testid="demo-analysis-report-summary">${escapeHtml(summary)}</span>
      </span>
      ${renderFontAwesomeIcon('caret-up', 'reportCollapseIcon')}
    </button>
    <div id="demo-analysis-comparison-report-body" class="reportCollapseBody" data-testid="demo-analysis-comparison-report-body">
      <div class="legendContainer">
        <span class="legendTitle">Comparing Groups:</span>
        <div class="legendPills">${legend}</div>
      </div>
      <div class="sectionCollapse comparisonReportSectionCollapse">
        <div class="sectionHeaderRow">
          <h5 class="sectionTitle">${renderFontAwesomeIcon('caret-up')} Similarity &amp; Difference Spectrum</h5>
        </div>
        ${renderComparisonBeeswarm(rows)}
      </div>
      <div class="sectionCollapse comparisonReportSectionCollapse">
        <div class="sectionHeaderRow">
          <h5 class="sectionTitle">${renderFontAwesomeIcon('caret-up')} Top Similar Items</h5>
        </div>
        <ul class="analysisList">${topSimilar.map((row) => renderComparisonAnalysisItem(row, 'Similarity')).join('') || '<li class="noData">No significant items found for this selection.</li>'}</ul>
      </div>
      <div class="sectionCollapse comparisonReportSectionCollapse">
        <div class="sectionHeaderRow">
          <h5 class="sectionTitle">${renderFontAwesomeIcon('caret-up')} Top Divergent Items</h5>
        </div>
        <ul class="analysisList">${topDivergent.map((row) => renderComparisonAnalysisItem(row, 'Divergence')).join('') || '<li class="noData">No significant items found for this selection.</li>'}</ul>
      </div>
    </div>
  </section>`;
};

const hashNumber = (value) => {
  const text = String(value || '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
};

const packBeeswarmPositions = (points, {
  plotLeft,
  plotRight,
  plotTop,
  plotBottom,
  seedPrefix = 'swarm',
  getXMetric = (point) => point.xMetric,
  getYMetric = (point) => point.yMetric,
}) => {
  const occupiedPositions = [];
  const positionById = new Map();
  points.filter((point) => (
    Number.isFinite(getXMetric(point)) && Number.isFinite(getYMetric(point))
  )).forEach((point) => {
    const targetX = plotLeft + getXMetric(point) * (plotRight - plotLeft);
    const targetY = plotBottom - getYMetric(point) * (plotBottom - plotTop);
    const radius = Number(point.radius || 5);
    const step = radius * 2 + 1;
    const xDirection = hashNumber(`${point.id}:${seedPrefix}-x-direction`) >= 0.5 ? 1 : -1;
    const yDirection = hashNumber(`${point.id}:${seedPrefix}-y-direction`) >= 0.5 ? 1 : -1;
    const xOffsets = [0];
    const yOffsets = [0];
    for (let index = 1; index <= 20; index += 1) {
      xOffsets.push(xDirection * index * step, -xDirection * index * step);
    }
    for (let index = 1; index <= 10; index += 1) {
      yOffsets.push(yDirection * index * step, -yDirection * index * step);
    }
    let position = null;
    for (const yOffset of yOffsets) {
      for (const xOffset of xOffsets) {
        const candidate = { x: targetX + xOffset, y: targetY + yOffset, radius };
        if (candidate.x < plotLeft || candidate.x > plotRight || candidate.y < plotTop || candidate.y > plotBottom) continue;
        const hasCollision = occupiedPositions.some((occupied) => {
          const minimumDistance = occupied.radius + candidate.radius + 1;
          const xDistance = occupied.x - candidate.x;
          const yDistance = occupied.y - candidate.y;
          return xDistance * xDistance + yDistance * yDistance < minimumDistance * minimumDistance;
        });
        if (!hasCollision) {
          position = candidate;
          break;
        }
      }
      if (position) break;
    }
    const finalPosition = position || { x: targetX, y: targetY, radius };
    occupiedPositions.push(finalPosition);
    positionById.set(point.id, finalPosition);
  });
  return positionById;
};

const hashSeed = (value) => {
  const text = String(value || '');
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const hslToRgb = (hue, saturation, lightness) => {
  const a = saturation * Math.min(lightness, 1 - lightness);
  const f = (n) => {
    const k = (n + hue / 30) % 12;
    return lightness - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return [
    Math.round(255 * f(0)),
    Math.round(255 * f(8)),
    Math.round(255 * f(4)),
  ];
};

const modelBlockieDataUrl = (seedValue) => {
  const seed = String(seedValue || 'model').toLowerCase();
  const cellCount = 8;
  const scale = 4;
  const size = cellCount * scale;
  const prng = mulberry32(hashSeed(seed));
  const hue = Math.floor(prng() * 360);
  const [red, green, blue] = hslToRgb(hue, 0.6, 0.5);
  const fill = `rgb(${red},${green},${blue})`;
  const half = Math.ceil(cellCount / 2);
  const rects = [];
  for (let y = 0; y < cellCount; y += 1) {
    for (let x = 0; x < half; x += 1) {
      if (prng() <= 0.5) continue;
      rects.push(`<rect x="${x * scale}" y="${y * scale}" width="${scale}" height="${scale}" fill="${fill}" />`);
      const mirrorX = cellCount - 1 - x;
      if (mirrorX !== x) {
        rects.push(`<rect x="${mirrorX * scale}" y="${y * scale}" width="${scale}" height="${scale}" fill="${fill}" />`);
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#ffffff" />${rects.join('')}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const normalizeSeries = (values, minOut, maxOut, fallback = (minOut + maxOut) / 2) => {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return values.map(() => fallback);
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (max === min) return values.map(() => fallback);
  return values.map((value) => (
    Number.isFinite(value)
      ? minOut + ((value - min) / (max - min)) * (maxOut - minOut)
      : fallback
  ));
};

const questionWinningResponseConsistency = (report, questionId, summary = {}, modelIds = null) => {
  const declared = summary.winningResponseConsistency;
  const hasModelScope = Array.isArray(modelIds);
  if (!hasModelScope && Number.isFinite(declared?.rate)) {
    return {
      method: declared.method || 'pooled-within-model-polarity-modal-share',
      rate: clamp(Number(declared.rate), 0, 1),
      winningResponses: Number(declared.winningResponses || 0),
      attemptedRuns: Number(declared.attemptedRuns || 0),
      validRuns: Number(declared.validRuns || 0),
      contributingModels: Number(declared.contributingModels || 0),
    };
  }

  let winningResponses = 0;
  let attemptedRuns = 0;
  let validRuns = 0;
  let contributingModels = 0;
  const byModelQuestion = report.polisReport?.byModelQuestion || {};
  const questionsByModel = hasModelScope
    ? Array.from(new Set(modelIds)).map((modelId) => byModelQuestion[modelId])
    : Object.values(byModelQuestion);
  questionsByModel.forEach((questionsById) => {
    const cell = questionsById?.[questionId];
    if (!cell) return;
    const totals = polarityRepeatTotalsForCell(cell);
    if (totals.attemptedRuns <= 0) return;
    winningResponses += totals.winningResponses;
    attemptedRuns += totals.attemptedRuns;
    validRuns += totals.validRuns;
    contributingModels += 1;
  });
  return {
    method: 'pooled-within-model-polarity-modal-share',
    rate: attemptedRuns ? clamp(winningResponses / attemptedRuns, 0, 1) : null,
    winningResponses,
    attemptedRuns,
    validRuns,
    contributingModels,
  };
};

const buildQuestionBeeswarmPoints = (report) => {
  const questions = getQuestions(report);
  return questions
    .map((question, index) => {
      const summary = report.polisReport?.byQuestion?.[question.id] || {};
      const spread = questionSpread(report, question.id);
      const hasVotes = validVoteCount(summary) > 0;
      const meanScore = Number.isFinite(summary.meanScore) ? summary.meanScore : 0;
      const spreadMetric = hasVotes ? clamp(spread || 0, 0, 2) : null;
      const extremity = hasVotes
        ? clamp(Math.abs(meanScore), 0, 1)
        : null;
      const difference = hasVotes ? clamp((spreadMetric || 0) / 2, 0, 1) : null;
      const winningResponseConsistency = questionWinningResponseConsistency(report, question.id, summary);
      return {
        id: question.id,
        prompt: question.prompt || question.id,
        topic: question.topic || 'uncategorized',
        xMetric: difference,
        spread: spreadMetric,
        extremity,
        difference,
        winningResponseConsistency,
        hasVotes,
        noDataLane: index % 10,
        noDataJitter: hashNumber(`${question.id}:no-data`) - 0.5,
        radius: hasVotes ? (questions.length > 100 ? 3 : 5) : 3,
        summary,
      };
    })
    .filter(Boolean);
};

const renderBeeswarmChart = (report) => {
  const points = buildQuestionBeeswarmPoints(report);
  const width = 700;
  const height = 250;
  const plotLeft = 62;
  const plotRight = width - 20;
  const plotTop = 24;
  const plotBottom = 190;
  if (!points.length) {
    return '<p class="ce-report-muted">No answered statements are available for the beeswarm yet.</p>';
  }
  const yTicks = [1, 0.75, 0.5, 0.25, 0];
  const yGrid = yTicks.map((rate) => {
    const y = plotBottom - rate * (plotBottom - plotTop);
    return `<g class="beeswarmGridTick" aria-hidden="true">
      <line class="beeswarmGridLine" x1="${plotLeft}" y1="${y}" x2="${plotRight}" y2="${y}" />
      <text class="beeswarmTickLabel" x="${plotLeft - 8}" y="${y + 4}" text-anchor="end">${Math.round(rate * 100)}%</text>
    </g>`;
  }).join('');
  const answeredPositionById = packBeeswarmPositions(points.filter((point) => point.hasVotes), {
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    seedPrefix: 'swarm',
    getXMetric: (point) => point.xMetric,
    getYMetric: (point) => point.winningResponseConsistency?.rate,
  });
  const circles = points.map((point, index) => {
    const consistency = point.winningResponseConsistency || {};
    const answeredPosition = answeredPositionById.get(point.id);
    const x = point.hasVotes && answeredPosition
      ? answeredPosition.x
      : plotLeft + (point.noDataLane * 18) + (point.noDataJitter * 8);
    const y = point.hasVotes && answeredPosition
      ? answeredPosition.y
      : clamp(plotBottom + 9 + (Math.floor(index / 10) * 2) + (point.noDataJitter * 4), plotBottom + 5, height - 34);
    return renderInteractiveQuestionBeeswarmPoint({
      question: point,
      summary: point.summary,
      x,
      y,
      radius: point.radius,
      spread: point.spread,
      extremity: point.extremity,
      difference: point.difference,
      winningResponseConsistency: consistency,
      hasVotes: point.hasVotes,
    });
  }).join('');
  return `<div class="swarmLayoutContainer">
    <div class="swarmContainer" data-ce-beeswarm-scroll-viewport>
      <svg width="${width}" height="${height}" class="beeswarmSvg" role="img" aria-label="Questions by model disagreement and repeat consistency">
        ${yGrid}
        <line class="beeswarmAxisLine" x1="${plotLeft}" y1="${plotTop}" x2="${plotLeft}" y2="${plotBottom}" />
        <line class="beeswarmAxisLine" x1="${plotLeft}" y1="${plotBottom}" x2="${plotRight}" y2="${plotBottom}" />
        <text class="beeswarmAxisTitle" x="14" y="${(plotTop + plotBottom) / 2}" transform="rotate(-90 14 ${(plotTop + plotBottom) / 2})" text-anchor="middle">Repeat consistency</text>
        <text class="beeswarmAxisLabel" x="${plotLeft}" y="232">Consensus</text>
        <text class="beeswarmAxisLabel" x="${plotRight}" y="232" text-anchor="end">Difference</text>
        ${circles}
      </svg>
    </div>
    <div class="swarmScrollControls" data-ce-beeswarm-scroll-controls hidden>
      <button type="button" class="scrollButton" data-ce-beeswarm-scroll="left" title="Scroll to Start" aria-label="Scroll beeswarm to start">${renderFontAwesomeIcon('chevron-left')}</button>
      <button type="button" class="scrollButton" data-ce-beeswarm-scroll="right" title="Scroll to End" aria-label="Scroll beeswarm to end">${renderFontAwesomeIcon('chevron-right')}</button>
    </div>
  </div>`;
};

const dot = (left, right) => left.reduce((sum, value, index) => sum + value * right[index], 0);

const normalizeVector = (vector) => {
  const norm = Math.sqrt(dot(vector, vector));
  if (!Number.isFinite(norm) || norm === 0) return vector.map(() => 0);
  return vector.map((value) => value / norm);
};

const multiplyMatrixVector = (matrix, vector) => matrix.map((row) => dot(row, vector));

const powerIteration = (matrix, seedOffset = 0) => {
  const size = matrix.length;
  if (!size) return [];
  let vector = normalizeVector(Array.from({ length: size }, (_, index) => 1 + ((index + seedOffset) % 3)));
  for (let iteration = 0; iteration < 36; iteration += 1) {
    const next = normalizeVector(multiplyMatrixVector(matrix, vector));
    if (next.every((value) => value === 0)) break;
    vector = next;
  }
  return vector;
};

const deflateMatrix = (matrix, vector) => {
  const eigenvalue = dot(vector, multiplyMatrixVector(matrix, vector));
  return matrix.map((row, rowIndex) => row.map((value, colIndex) => (
    value - eigenvalue * vector[rowIndex] * vector[colIndex]
  )));
};

const buildParticipantEmbedding = (report, width = 680, height = 430) => {
  const participants = report.participants || [];
  if (!participants.length) return [];
  const graphNodeById = new Map((report.participantGraph?.nodes || []).map((node) => [node.id, node]));
  const active = participants.filter((participant) => participant.coverage?.eligibleForSimilarity);
  const inactive = participants.filter((participant) => !participant.coverage?.eligibleForSimilarity);
  const activeCoordinates = new Map();

  if (active.length === 1) {
    activeCoordinates.set(active[0].id, { x: width / 2, y: height / 2 });
  } else if (active.length > 1) {
    const distances = active.map((left) => active.map((right) => {
      if (left.id === right.id) return 0;
      const similarity = report.polisReport?.similarityMatrix?.[left.id]?.[right.id];
      return Number.isFinite(similarity) ? clamp(1 - similarity, 0, 1) : 1;
    }));
    const squared = distances.map((row) => row.map((value) => value * value));
    const rowMeans = squared.map((row) => row.reduce((sum, value) => sum + value, 0) / row.length);
    const totalMean = rowMeans.reduce((sum, value) => sum + value, 0) / rowMeans.length;
    const gram = squared.map((row, rowIndex) => row.map((value, columnIndex) => (
      -0.5 * (value - rowMeans[rowIndex] - rowMeans[columnIndex] + totalMean)
    )));
    const first = powerIteration(gram, 0);
    const firstEigenvalue = Math.max(0, dot(first, multiplyMatrixVector(gram, first)));
    const deflated = deflateMatrix(gram, first);
    const second = powerIteration(deflated, 1);
    const secondEigenvalue = Math.max(0, dot(second, multiplyMatrixVector(deflated, second)));
    const rawX = first.map((value) => value * Math.sqrt(firstEigenvalue));
    const rawY = second.map((value) => value * Math.sqrt(secondEigenvalue));
    const xValues = normalizeSeries(rawX, 76, width - 76, width / 2);
    const yValues = normalizeSeries(rawY, height - 70, 70, height / 2);
    active.forEach((participant, index) => {
      activeCoordinates.set(participant.id, { x: xValues[index], y: yValues[index] });
    });
  }

  const inactiveCoordinates = new Map(inactive.map((participant, index) => [
    participant.id,
    {
      x: inactive.length === 1 ? width / 2 : 55 + index * ((width - 110) / Math.max(1, inactive.length - 1)),
      y: height - 34,
    },
  ]));

  return participants.map((participant) => {
    const graphNode = graphNodeById.get(participant.id) || {};
    const coordinates = activeCoordinates.get(participant.id) || inactiveCoordinates.get(participant.id);
    return {
      ...participant,
      ...coordinates,
      cluster: Number.isInteger(graphNode.opinionGroup) ? graphNode.opinionGroup : -1,
      insufficientOverlap: !participant.coverage?.eligibleForSimilarity,
    };
  });
};

const uniqueGraphPoints = (points) => Array.from(new Map(
  points
    .filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))
    .map((point) => [`${point.x}:${point.y}`, { x: Number(point.x), y: Number(point.y) }])
).values());

const buildConvexHull = (points) => {
  const sorted = uniqueGraphPoints(points).sort((left, right) => (
    left.x - right.x || left.y - right.y
  ));
  if (sorted.length < 3) return null;

  const cross = (origin, left, right) => (
    (left.x - origin.x) * (right.y - origin.y)
      - (left.y - origin.y) * (right.x - origin.x)
  );
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (const point of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
    upper.push(point);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  return hull.length >= 3 ? hull : null;
};

const graphHullPath = (points) => points.map((point, index) => (
  `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`
)).join(' ') + ' Z';

const renderCollapsibleSection = ({
  id,
  title,
  subtitle = '',
  body = '',
  className = '',
  open = true,
  bodyClassName = 'graphSection',
  titleSuffix = '',
  anchorAliases = [],
}) => {
  const viewModeById = {
    'model-participants': 'model-participants',
    'polis-matrix': 'polis-matrix',
    'debate-atlas': 'debate-atlas',
    breakdown: 'breakdown',
    'risk-matrix': 'risk-matrix',
    'snapshot-json': 'snapshot-json',
  };
  const viewMode = viewModeById[id] || 'report';
  return `<div
  id="${escapeHtml(id)}"
  class="ce-report-section aidb-view-section sectionCollapse ${escapeHtml(className)}"
  data-ce-static-collapsible
  data-ce-collapsible-open="${open ? 'true' : 'false'}"
  data-ce-report-mode-section="${escapeHtml(viewMode)}"
  ${subtitle ? `data-ce-section-subtitle="${escapeHtml(subtitle)}"` : ''}
  data-ce-default-open="${open ? 'true' : 'false'}"
>
  ${anchorAliases.map((alias) => `<span id="${escapeHtml(alias)}" class="aidb-anchor-alias" aria-hidden="true"></span>`).join('')}
  <div class="sectionHeaderRow aidb-native-summary" style="width: 100%; cursor: pointer;" data-ce-collapsible-toggle role="button" tabindex="0" aria-expanded="${open ? 'true' : 'false'}">
    <h5 class="sectionHeader sectionTitle">
      <span class="aidb-section-caret" aria-hidden="true">
        ${renderFontAwesomeIcon('caret-up', 'aidb-section-caret-icon aidb-section-caret-up')}
        ${renderFontAwesomeIcon('caret-down', 'aidb-section-caret-icon aidb-section-caret-down')}
      </span>
      <span class="aidb-section-title">${escapeHtml(title)}</span>${titleSuffix}
    </h5>
    <div class="pdfIgnore aidb-summary-toggle">
      <span data-ce-summary-toggle-label>${open ? 'Hide' : 'Show'}</span>
      <span class="showWhenPdf aidb-omitted-note" data-ce-summary-toggle-omitted ${open ? 'hidden' : ''}>(Omitted)</span>
    </div>
  </div>
  <div class="aidb-section-body ${escapeHtml(bodyClassName)}" data-ce-collapsible-body ${open ? '' : 'hidden'}>${body}</div>
</div>`;
};

const renderModePane = ({
  id,
  title,
  subtitle = '',
  body = '',
  className = '',
  bodyClassName = 'graphSection',
}) => {
  const modeById = {
    'model-participants': 'model-participants',
    'polis-matrix': 'polis-matrix',
    'debate-atlas': 'debate-atlas',
    breakdown: 'breakdown',
    'risk-matrix': 'risk-matrix',
    'snapshot-json': 'snapshot-json',
  };
  const mode = modeById[id] || id;
  const modeSurfaceClass = '';
  const modeHostClass = '';
  return `<section
  id="${escapeHtml(id)}"
  class="ce-report-section ce-results-mode-pane aidb-mode-pane${modeSurfaceClass}${modeHostClass} ${escapeHtml(className)}"
  data-ce-report-mode-section="${escapeHtml(mode)}"
  data-ce-pane-title="${escapeHtml(title)}"
  ${subtitle ? `data-ce-pane-subtitle="${escapeHtml(subtitle)}"` : ''}
  data-ce-default-open="true"
  aria-label="${escapeHtml(title)}"
  hidden
>
  <div class="aidb-section-body ${escapeHtml(bodyClassName)}">${body}</div>
</section>`;
};

const renderSummaryStats = (report) => {
  const runsWithIssues = Object.values(report.polisReport?.byModel || {})
    .reduce((sum, summary) => sum + (summary.invalid || 0), 0);
  const modelSummaries = Object.values(report.polisReport?.byModel || {});
  const totalConcreteVotes = modelSummaries.reduce((sum, summary) => sum + concreteVoteCount(summary), 0);
  const voters = modelSummaries.filter((summary) => concreteVoteCount(summary) > 0).length;
  const averageVotes = voters
    ? totalConcreteVotes / voters
    : 0;
  const activeFilter = report.mode === 'persona'
    ? `Persona mode: ${report.personaProfile?.label || report.personaId || 'Unknown'} (weights-only)`
    : 'None';
  const personaAttribute = report.personaId ? ` data-benchmark-persona="${escapeHtml(report.personaId)}"` : '';
  return renderCollapsibleSection({
    id: 'report',
    title: 'Summary and Statistics',
    bodyClassName: 'statsSectionCollapsible',
    body: `<div class="statsSection" data-benchmark-id="${escapeHtml(report.benchmarkId || '')}" data-benchmark-mode="${escapeHtml(report.mode || 'self')}" data-benchmark-issue-count="${escapeHtml(runsWithIssues)}"${personaAttribute}>
      <div class="statsRow">
        <div class="statsItem">${renderStatLabel('Participants', 'Participants who voted or wrote statements in the conversation.')}<span class="statValue">${escapeHtml(report.counts?.models ?? 0)}</span></div>
        <div class="statsItem">${renderStatLabel('Statements', 'Number of statements (questions) with a binary vote option available.')}<span class="statValue">${escapeHtml(report.counts?.questions ?? 0)}</span></div>
        <div class="statsItem">${renderStatLabel('Votes', 'Total agree or disagree clicks recorded across all statements by participants.')}<span class="statValue">${escapeHtml(totalConcreteVotes)}</span></div>
        <div class="statsItem">${renderStatLabel('Votes/Voter Avg', 'The average number of vote actions each participant made.')}<span class="statValue">${escapeHtml(averageVotes.toFixed(2))}</span></div>
      </div>
      <div class="statsRow">
        <div class="statsItem">${renderStatLabel('Active Filters', 'Summary of all active filters applied to this data.')}<div class="statValue"><span>${escapeHtml(activeFilter)}</span></div></div>
      </div>
      <div class="statsRow">
        <div class="statsItem">${renderStatLabel('Blockchain')}<span class="statValue">Unknown</span></div>
        <div class="statsItem">${renderStatLabel('Timestamp')}<span class="statValue">${formatPolisUtcTimestamp(report.generatedAt)}</span></div>
      </div>
    </div>`,
  });
};

const benchmarkPublicationDescription = (report) => {
  const questionCount = Number(report.counts?.questions || 0);
  const modelCount = Number(report.counts?.models || 0);
  return `A Context Engine AI opinions benchmark mapping agreement, disagreement, uncertainty, and wording sensitivity across ${questionCount} corpus-grounded question${questionCount === 1 ? '' : 's'} answered by ${modelCount} model participant${modelCount === 1 ? '' : 's'}.`;
};

const renderBenchmarkIntroduction = (report) => {
  const releaseReady = report.integrity?.releaseReady === true;
  const modeSummary = report.mode === 'persona'
    ? `Weights-only persona: ${report.personaProfile?.label || report.personaId || 'Unnamed figure'}`
    : 'Models answer as themselves';
  return `<section
    class="aidb-benchmark-intro"
    data-ce-benchmark-intro
    data-ce-benchmark-publication-status="${releaseReady ? 'release-ready' : 'preview'}"
    aria-labelledby="aidb-benchmark-intro-title"
  >
    <p class="aidb-benchmark-provenance"><span class="aidb-benchmark-technical-name">model-opinions-bench</span><span class="aidb-benchmark-generated">Generated: ${escapeHtml(formatPolisUtcTimestamp(report.generatedAt))}</span></p>
    <h1 id="aidb-benchmark-intro-title">${escapeHtml(BENCHMARK_PUBLIC_TITLE)}</h1>
    <p class="aidb-benchmark-lead" id="aidb-benchmark-topic-description">This edition maps where AI models agree, disagree, remain unsure, and change under reversed wording across questions about AI futures and policy, drawn from or implied by the OSS <strong>ai-discourse-corpus</strong>. The same benchmark method can be applied to any topic. An optional quadratic-importance mode gives every model the same credit budget to prioritize questions; those allocations determine Debate Map prominence when present.</p>
    <dl class="aidb-benchmark-facts" aria-label="Benchmark run summary">
      <div class="aidb-benchmark-fact-number"><dt>Questions</dt><dd>${escapeHtml(report.counts?.questions ?? 0)}</dd></div>
      <div class="aidb-benchmark-fact-number"><dt>Model participants</dt><dd>${escapeHtml(report.counts?.models ?? 0)}</dd></div>
      <div><dt>Mode<button type="button" class="tooltip aidb-benchmark-fact-tooltip pdfIgnore" aria-label="About benchmark mode" aria-describedby="aidb-mode-tooltip-copy" data-ce-mode-tooltip>${renderFontAwesomeIcon('question-circle')}<span class="tooltiptext" id="aidb-mode-tooltip-copy" role="tooltip">Persona mode asks each model to predict how a named historical or contemporary public figure would answer, using only information in the model's weights.</span></button></dt><dd>${escapeHtml(modeSummary)}</dd></div>
      <div class="aidb-benchmark-topic-fact"><dt><label for="aidb-benchmark-topic">Benchmark topic</label></dt><dd><select id="aidb-benchmark-topic" aria-describedby="aidb-benchmark-topic-description" data-ce-benchmark-topic-selector><option value="ai-futures-policy" selected>AI Futures &amp; Policy</option></select></dd></div>
    </dl>
  </section>`;
};

const renderIntegrityNotice = (report) => {
  if (report.integrity?.releaseReady) return '';
  const integrity = report.integrity || {};
  const detailItems = [];
  const bankStatus = formatDisplayLabel(integrity.bankReleaseStatus || 'unvalidated');
  if (!integrity.bankValidated) {
    detailItems.push(`<li><strong>Question bank:</strong> ${escapeHtml(bankStatus)}. An official release requires a separately reviewed and validated bank.</li>`);
  }

  if (!integrity.repeatConfigurationValid) {
    const declaredRepeats = Array.from(new Set(
      (integrity.declaredRepeatValues || [])
        .map(Number)
        .filter((value) => Number.isInteger(value) && value > 0)
    )).sort((left, right) => left - right);
    const declaredLabel = declaredRepeats.length === 1
      ? `${declaredRepeats[0]} completed run${declaredRepeats[0] === 1 ? '' : 's'} per wording`
      : declaredRepeats.length > 1
        ? `mixed completed-run counts (${declaredRepeats.join(', ')}) per wording`
        : 'no completed repeat count';
    const expectedRepeats = Number(integrity.expectedRepeatsPerPolarity || 0);
    detailItems.push(`<li><strong>Repeat depth:</strong> The imported artifacts declare ${escapeHtml(declaredLabel)}${expectedRepeats ? `; this bank requires ${escapeHtml(expectedRepeats)} for release` : ''}.</li>`);
  }

  const participantLabels = new Map((report.participants || []).map((participant) => (
    [participant.id, participant.label || participant.id]
  )));
  const coverageRows = Object.entries(integrity.coverageByModel || {});
  if (coverageRows.length) {
    const fullCurrentCoverage = coverageRows.filter(([, row]) => (
      Number(row.questionCount || 0) > 0
      && Number(row.answeredQuestions || 0) === Number(row.questionCount || 0)
      && Number(row.pairedQuestions || 0) === Number(row.questionCount || 0)
      && Number(row.actualRuns || 0) > 0
      && Number(row.validRuns || 0) === Number(row.actualRuns || 0)
    ));
    detailItems.push(`<li><strong>Current model coverage:</strong> ${escapeHtml(fullCurrentCoverage.length)} of ${escapeHtml(coverageRows.length)} model participant${coverageRows.length === 1 ? '' : 's'} answered every question in both wordings with no invalid responses in this run set.</li>`);
    coverageRows
      .filter(([modelId]) => !fullCurrentCoverage.some(([fullModelId]) => fullModelId === modelId))
      .forEach(([modelId, row]) => {
        const questionCount = Number(row.questionCount || report.counts?.questions || 0);
        detailItems.push(`<li><strong>${escapeHtml(participantLabels.get(modelId) || modelId)}:</strong> ${escapeHtml(row.answeredQuestions || 0)}/${escapeHtml(questionCount)} questions answered; ${escapeHtml(row.pairedQuestions || 0)}/${escapeHtml(questionCount)} included both wordings; ${escapeHtml(row.validRuns || 0)}/${escapeHtml(row.actualRuns || 0)} responses were valid.</li>`);
      });
    const fixtureModels = coverageRows
      .filter(([, row]) => row.fixtureProvider)
      .map(([modelId]) => participantLabels.get(modelId) || modelId);
    if (fixtureModels.length) {
      detailItems.push(`<li><strong>Fixture providers:</strong> ${escapeHtml(fixtureModels.join(', '))}. Official releases require non-fixture model runs.</li>`);
    }
  }

  if (!detailItems.length) {
    const warnings = Array.isArray(integrity.warnings) ? integrity.warnings : [];
    warnings.forEach((warning) => detailItems.push(`<li>${escapeHtml(warning)}</li>`));
  }
  return `<div class="aidb-preview-notice" role="status" data-ce-benchmark-preview>
    <strong>Development preview.</strong>
    <span>The measurements below are useful for testing the report and methodology, but this is not an official benchmark release.</span>
    ${detailItems.length ? `<details><summary>Why this is a development preview</summary><ul>${detailItems.join('')}</ul></details>` : ''}
  </div>`;
};

const renderConsensusAndDifference = (report) => {
  return renderCollapsibleSection({
    id: 'consensus-difference',
    title: 'Consensus and Difference',
    subtitle: 'Beeswarm plus statement-level agreement and difference',
    body: renderBeeswarmChart(report),
  });
};

const renderPolisMatrix = (report) => {
  const questions = getQuestions(report);
  const participants = report.participants || [];
  const matrix = report.polisReport?.byModelQuestion || {};
  const byQuestion = report.polisReport?.byQuestion || {};
  const rows = participants.map((participant) => {
    const cells = questions.map((question) => {
      const summary = matrix[participant.id]?.[question.id] || {};
      const title = `${participant.label} / ${question.id}: ${scoreLabel(summary)}`;
      return `<td title="${escapeHtml(title)}" style="background:${stanceColor(summary.meanScore)}">${escapeHtml(formatScore(summary.meanScore))}</td>`;
    }).join('');
    return `<tr data-ce-searchable><th>${escapeHtml(participant.label)}</th>${cells}</tr>`;
  }).join('');
  const questionBars = questions.map((question, index) => {
    const summary = byQuestion[question.id] || {};
    return `<li data-ce-searchable>
      <span class="rank">${index + 1}</span>
      <span class="statement">${escapeHtml(question.prompt)}</span>
      ${renderAnswerBar(summary)}
    </li>`;
  }).join('');
  return renderModePane({
    id: 'polis-matrix',
    title: 'Model / Statement Matrix',
    subtitle: 'Agreement and disagreement across model participants',
    bodyClassName: 'graphSection aidb-matrix-section',
    body: `
      <p class="ce-report-muted">Agreement and disagreement across model participants, normalized across canonical and reversed wording.</p>
      <div class="polis-grid">
        <table class="aidb-matrix-table">
          <thead><tr><th>Participant</th>${questions.map((q) => `<th title="${escapeHtml(q.prompt)}">${escapeHtml(q.id)}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <ol class="question-bars">${questionBars}</ol>
      </div>`,
  });
};

const renderParticipantGraph = (report) => {
  const width = 500;
  const height = 400;
  const staticEmbeddingControlTitle = 'Static benchmark exports preserve the generated participant embedding. Re-render the report after a new run to change this control.';
  const manualClusterControlTitle = 'Choose a deterministic K-medoids grouping over the report similarity matrix. Auto restores the generated connected-component grouping.';
  const staticClusterAnalysisTitle = "Use AI to summarize each cluster's unique viewpoint";
  const embeddedNodes = buildParticipantEmbedding(report, width, height);
  const edges = report.participantGraph?.edges || [];
  const questions = getQuestions(report);
  const questionSummaries = questions.map((question, index) => {
    const summary = report.polisReport?.byQuestion?.[question.id] || {};
    const mean = Number.isFinite(summary.meanScore) ? Number(summary.meanScore) : 0;
    const extremity = Number.isFinite(summary.extremity) ? Number(summary.extremity) : Math.abs(mean);
    const column = index % 20;
    const row = Math.floor(index / 20);
    const x = Math.round(40 + column * ((width - 80) / 19));
    const y = Math.round(40 + row * Math.min(32, (height - 80) / Math.max(1, Math.ceil(questions.length / 20) - 1)) + mean * 18);
    return {
      question,
      summary,
      x: clamp(x + extremity * 8, 34, width - 34),
      y: clamp(y, 34, height - 34),
    };
  });
  const discoveredClusters = Array.from(new Set(
    embeddedNodes.map((node) => node.cluster).filter((cluster) => Number(cluster) >= 0)
  ));
  const eligibleClusterNodeIds = embeddedNodes
    .filter((node) => !node.insufficientOverlap)
    .map((node) => node.id);
  const activeClusterCount = discoveredClusters.length || (eligibleClusterNodeIds.length ? 1 : 0);
  const manualClusterAssignments = Object.fromEntries(
    Array.from({ length: eligibleClusterNodeIds.length }, (_, index) => index + 1).map((count) => {
      const grouping = clusterBySimilarity({
        participantIds: eligibleClusterNodeIds,
        similarityMatrix: report.polisReport?.similarityMatrix || {},
        count,
      });
      return [String(count), grouping.assignments];
    }),
  );
  const clusterAssignmentById = new Map(embeddedNodes.map((node) => [node.id, node.cluster]));
  const clusterColor = (clusterIndex) => (
    Number(clusterIndex) < 0
      ? '#94a3b8'
      : D3_CATEGORY10[Math.abs(Number(clusterIndex) || 0) % D3_CATEGORY10.length]
  );
  const centerX = width / 2;
  const centerY = height / 2;
  const graphX = (value) => Number(value) - centerX;
  const graphY = (value) => Number(value) - centerY;
  const clusterControlPayload = {
    method: 'deterministic-k-medoids',
    autoClusterCount: activeClusterCount,
    minClusterCount: eligibleClusterNodeIds.length ? 1 : 0,
    maxClusterCount: eligibleClusterNodeIds.length,
    autoAssignments: Object.fromEntries(embeddedNodes.map((node) => [node.id, node.cluster])),
    assignmentsByCount: manualClusterAssignments,
    participants: embeddedNodes.map((node) => ({
      id: node.id,
      label: node.label,
      eligible: !node.insufficientOverlap,
    })),
  };
  const participantMetaById = new Map((report.participants || []).map((participant) => [
    participant.id,
    {
      model: participant.model || '',
      provider: participant.provider || '',
      traits: participant.traits || {},
    },
  ]));
  const circles = embeddedNodes.map((node) => {
    const cluster = clusterAssignmentById.get(node.id) ?? -1;
    const clusterLabel = cluster < 0 ? 'Insufficient overlap' : `Opinion Group ${cluster + 1}`;
    const meta = participantMetaById.get(node.id) || {};
    const traits = meta.traits || {};
    const traitSummary = [
      traits.parameterClass,
      traits.ossStatus,
      traits.countryOfOrigin,
    ].filter(Boolean).join(' / ');
    return `<g class="graph-participant${node.insufficientOverlap ? ' graph-participant-no-data' : ''}" data-ce-searchable data-ce-graph-participant-point tabindex="0" focusable="true" role="img" aria-label="${escapeHtml(`${node.label}: ${clusterLabel}`)}" data-ce-graph-cluster="${escapeHtml(cluster)}" data-participant-group="${escapeHtml(clusterLabel)}" data-participant-id="${escapeHtml(node.id)}" data-participant-label="${escapeHtml(node.label)}" data-participant-model="${escapeHtml(meta.model || '')}" data-participant-provider="${escapeHtml(meta.provider || '')}" data-participant-traits="${escapeHtml(traitSummary)}" data-participant-coverage="${escapeHtml(node.coverage?.coverageRate ?? 0)}">
      <circle cx="${escapeHtml(graphX(node.x).toFixed(2))}" cy="${escapeHtml(graphY(node.y).toFixed(2))}" r="5" fill="${clusterColor(cluster)}" />
      <title>${escapeHtml(`${node.label}: ${clusterLabel}`)}</title>
    </g>`;
  }).join('');
  const clusterOutlines = Object.entries(embeddedNodes.reduce((groups, node) => {
    const cluster = clusterAssignmentById.get(node.id) ?? -1;
    groups[cluster] = groups[cluster] || [];
    groups[cluster].push(node);
    return groups;
  }, {})).map(([cluster, nodes]) => {
    const points = uniqueGraphPoints(nodes.map((node) => ({
      x: graphX(node.x),
      y: graphY(node.y),
    })));
    if (points.length < 2) return '';
    const color = clusterColor(cluster);
    if (points.length === 2) {
      return `<line
      class="graph-outline graph-group-connector"
      data-ce-graph-cluster="${escapeHtml(cluster)}"
      x1="${escapeHtml(points[0].x.toFixed(2))}"
      y1="${escapeHtml(points[0].y.toFixed(2))}"
      x2="${escapeHtml(points[1].x.toFixed(2))}"
      y2="${escapeHtml(points[1].y.toFixed(2))}"
      stroke="${escapeHtml(color)}"
      stroke-opacity="0.7"
      stroke-width="1"
    />`;
    }
    const hull = buildConvexHull(points);
    if (!hull) return '';
    return `<path
      class="graph-outline graph-group-hull"
      data-ce-graph-cluster="${escapeHtml(cluster)}"
      d="${escapeHtml(graphHullPath(hull))}"
      fill="${escapeHtml(color)}"
      fill-opacity="0.1"
      stroke="${escapeHtml(color)}"
      stroke-opacity="0.7"
      stroke-width="1"
    />`;
  }).join('');
  const statementCircles = questionSummaries.map(({ question, summary, x, y }) => {
    const { agree, unsure, disagree, invalid } = answerTotals(summary);
    return `<g class="graph-statement" data-ce-searchable hidden>
      <circle cx="${escapeHtml(graphX(x).toFixed(2))}" cy="${escapeHtml(graphY(y).toFixed(2))}" r="3" fill="#000" />
      <title>${escapeHtml(`${question.id}: ${question.prompt || ''} Agree: ${agree}, Disagree: ${disagree}, Unsure: ${unsure}, Invalid: ${invalid}`)}</title>
    </g>`;
  }).join('');
  const strongestEdges = [...edges]
    .sort((left, right) => (right.similarity ?? -2) - (left.similarity ?? -2))
    .slice(0, 8)
    .map((edge) => {
      const source = embeddedNodes.find((node) => node.id === edge.source)?.label || edge.source;
      const target = embeddedNodes.find((node) => node.id === edge.target)?.label || edge.target;
      return `<li data-ce-searchable>
        <span>${escapeHtml(source)} / ${escapeHtml(target)}</span>
        <strong>${escapeHtml(formatScore(edge.similarity))}</strong>
        <small class="ce-report-muted">${escapeHtml(edge.questionsCompared ?? 0)} shared questions</small>
      </li>`;
    }).join('');
  const uniqueClusters = Array.from(new Set(embeddedNodes.map((node) => clusterAssignmentById.get(node.id) ?? -1)))
    .sort((left, right) => left - right);
  const representativeStatementsForCluster = (clusterIndex, members) => {
    const memberIds = members.map((node) => node.id);
    const renderOtherClusterComparisons = (questionId) => {
      const comparisonBoxes = uniqueClusters
        .filter((otherCluster) => otherCluster !== clusterIndex)
        .map((otherCluster) => {
          const otherMembers = embeddedNodes.filter((node) => (clusterAssignmentById.get(node.id) ?? -1) === otherCluster);
          const otherSummary = aggregateQuestionSummaryForModels(report, questionId, otherMembers.map((node) => node.id));
          return `<div class="clusterRepresentativeComparisonBox" data-ce-cluster-comparison="${escapeHtml(otherCluster)}" style="border:1px solid ${escapeHtml(clusterColor(otherCluster))};padding:4px;">
            <div style="color:${escapeHtml(clusterColor(otherCluster))};font-weight:bold;margin-bottom:4px;">${otherCluster < 0 ? 'Insufficient overlap' : `Opinion Group ${escapeHtml(otherCluster + 1)}`}</div>
            ${renderPolisBoxPlot(otherSummary)}
          </div>`;
        })
        .join('');
      if (!comparisonBoxes) return '';
      return `<div class="clusterRepresentativeComparisons" style="margin-top:6px;margin-bottom:6px;">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;">
          ${comparisonBoxes}
        </div>
      </div>`;
    };
    const rows = questions
      .map((question) => {
        const clusterSummary = aggregateQuestionSummaryForModels(report, question.id, memberIds);
        const overallSummary = report.polisReport?.byQuestion?.[question.id] || {};
        const clusterMean = Number.isFinite(clusterSummary.meanScore) ? clusterSummary.meanScore : 0;
        const overallMean = Number.isFinite(overallSummary.meanScore) ? overallSummary.meanScore : 0;
        return {
          question,
          clusterSummary,
          difference: Math.abs(clusterMean - overallMean),
        };
      })
      .filter((entry) => validVoteCount(entry.clusterSummary) > 0)
      .sort((left, right) => right.difference - left.difference)
      .slice(0, 3);
    if (!rows.length) {
      return `<p style="margin-left:20px;margin-top:6px;">No representative questions found for ${clusterIndex < 0 ? 'participants with insufficient overlap' : `Opinion Group ${escapeHtml(clusterIndex + 1)}`}</p>`;
    }
    return `<div class="clusterRepresentativeList" style="margin-top:6px;">
      ${rows.map((entry, index) => `<div class="clusterRepresentativeQuestion" data-ce-searchable style="margin-left:20px;margin-bottom:8px;border-left:2px solid #ccc;padding-left:8px;">
        <strong>Representative statement ${escapeHtml(index + 1)}</strong>: ${escapeHtml(entry.question.prompt || entry.question.id)}<br>
        <small style="color:#666;">(agreement rate differs from the overall conversation by ${escapeHtml((entry.difference * 100).toFixed(1))} percentage points)</small>
        <div style="margin-top:4px;">${renderPolisBoxPlot(entry.clusterSummary)}</div>
        ${renderOtherClusterComparisons(entry.question.id)}
      </div>`).join('')}
    </div>`;
  };
  const clusterLegend = uniqueClusters
    .map((cluster) => {
      const members = embeddedNodes.filter((node) => (clusterAssignmentById.get(node.id) ?? -1) === cluster);
      if (!members.length) return '';
      return `<div class="clusterSectionDiv" data-ce-cluster-section data-ce-cluster-open="false">
        <div class="clusterLegendHeader" data-ce-cluster-toggle role="button" tabindex="0" aria-expanded="false">
          <div class="clusterLegendLabel">
            <svg width="16" height="16" class="clusterSwatchSvg" aria-hidden="true">
              <circle cx="8" cy="8" r="6" fill="${escapeHtml(clusterColor(cluster))}" />
            </svg>
              <span class="clusterLegendName">${cluster < 0 ? 'Insufficient overlap' : `Opinion Group ${escapeHtml(cluster + 1)}`}</span>
          </div>
          <span class="clusterLegendToggleIcon" aria-hidden="true">
            ${renderFontAwesomeIcon('minus-square', 'clusterToggleSvgIcon clusterToggleSvgIconOpen')}
            ${renderFontAwesomeIcon('plus-square', 'clusterToggleSvgIcon clusterToggleSvgIconClosed')}
          </span>
        </div>
        <div class="clusterLegendBody" data-ce-cluster-body hidden>
          ${representativeStatementsForCluster(cluster, members)}
        </div>
        <div class="clusterLegendOmitted" data-ce-cluster-omitted><em class="showWhenPdf">Omitted</em></div>
      </div>`;
    })
    .join('');
  return renderCollapsibleSection({
    id: 'participant-graph',
    title: 'Participants Graph',
    subtitle: 'Opinion-profile embedding from model answers',
    titleSuffix: renderTooltipReference(PARTICIPANTS_GRAPH_TOOLTIP_TEXT),
    anchorAliases: ['participants-graph'],
    bodyClassName: 'aidb-participant-graph-section',
    body: `
      <script type="application/json" id="ce-ai-discourse-bench-participant-clusters">${serializeJsonForHtmlScript(clusterControlPayload)}</script>
      <div class="participantGraphControls">
        <div class="controlGroup">
          <label for="embedding-choice-select">Embedding:${renderTooltipReference(REPORT_DEFAULT_EMBEDDING_TOOLTIP_TEXT)}</label>
          <select id="embedding-choice-select" disabled aria-disabled="true" title="${escapeHtml(staticEmbeddingControlTitle)}">
            <option value="UMAP">UMAP</option>
            <option value="SVD">SVD/PCA</option>
            <option value="POLIS" selected>${escapeHtml(REPORT_DEFAULT_EMBEDDING_LABEL)}</option>
          </select>
        </div>
        <div class="controlGroup">
          <label for="cluster-count-input">Opinion groups:${renderTooltipReference(OPINION_GROUPS_TOOLTIP_TEXT)}</label>
          <div class="numberInputWrapper">
            <button type="button" class="stepperButton" data-ce-cluster-step="-1" aria-label="Decrease opinion-group count" aria-disabled="false" title="${escapeHtml(manualClusterControlTitle)}">-</button>
            <input id="cluster-count-input" class="clusterNumberInput" data-ce-cluster-count-input type="number" value="${escapeHtml(activeClusterCount)}" min="${eligibleClusterNodeIds.length ? 1 : 0}" max="${escapeHtml(eligibleClusterNodeIds.length)}" aria-label="Opinion-group count" title="${escapeHtml(manualClusterControlTitle)}" ${eligibleClusterNodeIds.length ? '' : 'disabled aria-disabled="true"'}>
            <button type="button" class="stepperButton" data-ce-cluster-step="1" aria-label="Increase opinion-group count" aria-disabled="false" title="${escapeHtml(manualClusterControlTitle)}">+</button>
            <button type="button" class="clusterAutoButton clusterAutoButtonActive" data-ce-cluster-auto aria-pressed="true" title="${escapeHtml(manualClusterControlTitle)}">Auto</button>
          </div>
          <span class="aidb-sr-only" data-ce-opinion-group-status aria-live="polite"></span>
        </div>
        <div class="controlGroup aidb-layer-toggles" aria-label="Participant graph layers">
          <label><input type="checkbox" data-ce-graph-toggle="statements"> Statements</label>
          <label><input type="checkbox" data-ce-graph-toggle="participants" checked> Participants</label>
          <label><input type="checkbox" data-ce-graph-toggle="outline" checked> Outline</label>
          <label><input type="checkbox" data-ce-graph-toggle="axes" checked> Axes</label>
          <label><input type="checkbox" data-ce-graph-toggle="radial-axes" checked> Radial Axes</label>
        </div>
      </div>
      <div class="graphSection aidb-graph-layout" data-ce-participant-graph>
        <div class="graphItem">
          <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="participantSvg graph" role="img" aria-label="participant similarity graph">
          <g transform="translate(${centerX}, ${centerY})">
            <g class="graph-radial-axes">
              <circle r="${Math.round(Math.min(width, height) / 2.3)}" stroke="rgb(230,230,230)" stroke-width="1" fill="rgb(248,248,248)" />
              <circle r="${Math.round(Math.min(width, height) / 4)}" stroke="rgb(230,230,230)" stroke-width="1" fill="rgb(245,245,245)" />
              <circle r="${Math.round(Math.min(width, height) / 8)}" stroke="rgb(230,230,230)" stroke-width="1" fill="rgb(248,248,248)" />
            </g>
            <g class="graph-axes">
              <line class="graph-axis" x1="${-(width / 2) + 40}" y1="0" x2="${(width / 2) - 40}" y2="0" stroke="black" stroke-width="1" />
              <line class="graph-axis" x1="0" y1="${-(height / 2) + 40}" x2="0" y2="${(height / 2) - 40}" stroke="black" stroke-width="1" />
            </g>
            <g class="graph-outlines">${clusterOutlines}</g>
            ${statementCircles}
            ${circles}
          </g>
          </svg>
        </div>
      </div>
      <div class="pdfIgnore">
        <button type="button" data-ce-clusters-action="collapse" style="margin-right: 10px;">Collapse Clusters</button>
        <button type="button" data-ce-clusters-action="expand">Expand Clusters</button>
        <button type="button" class="analyzeClustersBtn" title="${escapeHtml(staticClusterAnalysisTitle)}" style="margin-left: 10px;" disabled aria-disabled="true">${renderFontAwesomeIcon('magic', 'analysisWandIcon')}<span>Analyze clusters</span></button>
      </div>
      <div class="clusterLegendSection">
        <strong class="clusterLegendTitle">Opinion Groups${renderTooltipReference('Groups are made of participants who voted similarly on statements.')}: </strong>
        <div class="clusterLegendItems" data-ce-cluster-legend-items>${clusterLegend || '<p class="ce-report-muted">No opinion groups yet.</p>'}</div>
        <details class="aidb-similarity-details">
          <summary>Most Similar Participant Pairs</summary>
          <ol>${strongestEdges || '<li>No similarity edges yet.</li>'}</ol>
        </details>
      </div>`,
  });
};

const renderBreakdown = (report) => {
  const participantMap = participantsById(report);
  const traits = report.breakdown || {};
  const traitEntries = Object.entries(traits);
  const differenceQuestions = topDifferenceQuestions(report, 6);
  const suggestionQuestions = differenceQuestions.length ? differenceQuestions : getQuestions(report).slice(0, 6);
  const selectedQuestion = differenceQuestions[0] || getQuestions(report)[0] || null;
  const comparisonGroups = defaultComparisonGroups(report, selectedQuestion);
  const renderSelectedPills = (groups = []) => groups.map((group) => `<div
    class="filterPill"
    data-ce-searchable
    data-ce-breakdown-pill
    data-ce-breakdown-group-key="${escapeHtml(group.segmentKey || `${group.trait}:${group.value}`)}"
  >
    <span class="pillName">${escapeHtml(group.name)}</span>
    <div class="pillControls">
      <button type="button" class="pillIconButton" data-ce-breakdown-suggest-group title="Suggest related comparisons" aria-label="${escapeHtml(`Suggest related comparisons for ${group.name}`)}">
        ${renderFontAwesomeIcon('magic', 'pillIconSvgIcon')}
      </button>
      <button type="button" class="pillIconButton" data-ce-breakdown-remove-group title="Remove group" aria-label="${escapeHtml(`Remove ${group.name}`)}">
        ${renderFontAwesomeIcon('times', 'pillIconSvgIcon')}
      </button>
    </div>
  </div>`).join('');
  const selectedPills = renderSelectedPills(comparisonGroups);
  const selectedFilterState = `<div class="workspaceContainer" data-ce-breakdown-selected-workspace>
    <div class="pillsLayout" data-ce-breakdown-selected-pills>${selectedPills}</div>
    <p class="breakdownFilterEmpty" data-ce-breakdown-filter-empty${selectedPills ? ' hidden' : ''}>Add filters from the menus below to begin.</p>
  </div>`;
  const selectedGroupsByTrait = comparisonGroups.reduce((map, group) => {
    if (!map[group.trait]) map[group.trait] = [];
    map[group.trait].push(group);
    return map;
  }, {});
  const renderBreakdownCandlestick = (summary = {}) => {
    const { agree, unsure, disagree } = answerTotals(summary);
    const valid = Math.max(1, agree + unsure + disagree);
    return `<div class="breakdownCandlestick" aria-label="response distribution">
      <span class="breakdownCandleSegment breakdownCandleSegmentAgree" style="width:${escapeHtml(((agree / valid) * 100).toFixed(2))}%" title="Agree: ${escapeHtml(agree)}"></span>
      <span class="breakdownCandleSegment breakdownCandleSegmentUnsure" style="width:${escapeHtml(((unsure / valid) * 100).toFixed(2))}%" title="Unsure: ${escapeHtml(unsure)}"></span>
      <span class="breakdownCandleSegment breakdownCandleSegmentDisagree" style="width:${escapeHtml(((disagree / valid) * 100).toFixed(2))}%" title="Disagree: ${escapeHtml(disagree)}"></span>
    </div>`;
  };
  const summaryForQuestion = (question) => (
    question
      ? (question.summary || report.polisReport?.byQuestion?.[question.id] || {})
      : {}
  );
  const cohortEntriesForQuestion = (question) => traitEntries.flatMap(([trait, groups]) => (
    Object.entries(groups).map(([value, ids]) => ({
      trait,
      value,
      ids,
      summary: question
        ? aggregateQuestionSummaryForModels(report, question.id, ids)
        : {},
    }))
  ))
    .filter((entry) => validVoteCount(entry.summary) > 0)
    .sort((left, right) => validVoteCount(right.summary) - validVoteCount(left.summary))
    .slice(0, 3);
  const renderBreakdownRowsForQuestion = (question) => {
    if (!question) return '';
    const summary = summaryForQuestion(question);
    const datasets = [
      {
        label: 'Overall',
        meta: `${escapeHtml(validVoteCount(summary))} modeled responses`,
        summary,
      },
      ...cohortEntriesForQuestion(question).map((entry) => ({
        label: `${formatDisplayLabel(entry.trait)}: ${formatDisplayLabel(entry.value)}`,
        meta: `${validVoteCount(entry.summary)} modeled responses`,
        summary: entry.summary,
      })),
    ].filter((entry) => entry.summary);
    return datasets.map((dataset) => `<div class="breakdownDataset" data-ce-searchable>
      <div class="breakdownDatasetHeader">
        <span class="breakdownDatasetTitle">${escapeHtml(dataset.label)}</span>
        <span class="breakdownDatasetMeta">${escapeHtml(dataset.meta)}</span>
      </div>
      ${renderBreakdownCandlestick(dataset.summary)}
      <p class="breakdownQuestionText">${escapeHtml(question.prompt || question.id)}</p>
    </div>`).join('');
  };
  const traitPanels = traitEntries.map(([trait, groups]) => {
    const groupEntries = Object.entries(groups)
      .sort((left, right) => right[1].length - left[1].length);
    const selectedGroups = selectedGroupsByTrait[trait] || [];
    const selectedValues = selectedGroups.map((group, index) => `<span class="breakdownTraitSelectValue">
      ${escapeHtml(formatDisplayLabel(group.value))}
    </span>${index === selectedGroups.length - 1 ? '' : ''}`).join('');
    const menuItems = groupEntries.map(([value, ids]) => {
      const groupKey = `${trait}:${value}`;
      const inputId = `breakdown-group-${toTestIdFragment(groupKey)}`;
      const labels = ids.map((id) => participantMap[id]?.label || id).join(', ');
      const isSelected = selectedGroups.some((group) => group.value === value);
      return `<label class="breakdownTraitOption" for="${escapeHtml(inputId)}" title="${escapeHtml(labels)}">
        <input
          id="${escapeHtml(inputId)}"
          type="checkbox"
          value="${escapeHtml(groupKey)}"
          data-ce-breakdown-group-input
          data-ce-breakdown-group-key="${escapeHtml(groupKey)}"
          ${isSelected ? 'checked' : ''}
        >
        <span>
          <strong>${escapeHtml(formatDisplayLabel(value))}</strong>
          <small>${escapeHtml(ids.length)} model${ids.length === 1 ? '' : 's'}</small>
        </span>
      </label>`;
    }).join('');
    return `<div class="selectorField breakdownTraitField" data-ce-searchable>
      <details class="demographicSelect breakdownTraitMenu" data-ce-breakdown-trait="${escapeHtml(trait)}">
        <summary class="demoAnalysisSelect__control breakdownTraitSelect" aria-label="${escapeHtml(`${formatDisplayLabel(trait)} cohorts`)}">
          <div class="demoAnalysisSelect__value-container">
            <span class="demoAnalysisSelect__placeholder">${escapeHtml(formatDisplayLabel(trait))}</span>
            <span class="breakdownTraitSelectValues" data-ce-breakdown-trait-values>${selectedValues}</span>
          </div>
          <span class="demoAnalysisSelect__dropdown-indicator" aria-hidden="true">▾</span>
        </summary>
        <div class="breakdownTraitMenuList" role="group" aria-label="${escapeHtml(`${formatDisplayLabel(trait)} options`)}">
          ${menuItems}
        </div>
      </details>
    </div>`;
  }).join('');
  const breakdownTemplates = [];
  const registerBreakdownTemplate = (question, groups, key) => {
    if (!question || !Array.isArray(groups) || groups.length < 2) return '';
    const templateId = `breakdown-template-${toTestIdFragment(key || question.id)}`;
    const topic = question.topic || 'uncategorized';
    breakdownTemplates.push(`<template
      id="${escapeHtml(templateId)}"
      data-ce-breakdown-template
      data-ce-breakdown-question-id="${escapeHtml(question.id)}"
      data-ce-breakdown-group-keys="${escapeHtml(JSON.stringify(groups.map((group) => group.segmentKey || `${group.trait}:${group.value}`)))}"
    >
      <span data-ce-template-prompt>${escapeHtml(question.prompt || question.id)}</span>
      <span data-ce-template-tension>${escapeHtml(question.disagreementAxis || question.whyIncluded || 'Model cohorts diverge on this benchmark statement.')}</span>
      <a data-ce-template-topic data-ce-tag-open data-ce-tag="${escapeHtml(topic)}" href="${escapeHtml(buildStaticTagHref(topic))}" title="${escapeHtml(`Open ${topic} in the tag explorer`)}">${escapeHtml(topic)}</a>
      <div data-ce-template-pills>${renderSelectedPills(groups)}</div>
      <div data-ce-template-breakdown-list>${renderBreakdownRowsForQuestion(question)}</div>
      <div data-ce-template-comparison-report>${renderComparisonReport(report, question, groups)}</div>
    </template>`);
    return templateId;
  };
  const renderSuggestionButton = ({
    active = false,
    groups,
    key,
    question,
  }) => {
    const templateId = registerBreakdownTemplate(question, groups, key);
    if (!templateId || !groups?.[0] || !groups?.[1]) return '';
    return `<button
      type="button"
      class="suggestionButton${active ? ' suggestionButtonActive' : ''}"
      aria-pressed="${active ? 'true' : 'false'}"
      data-ce-searchable
      data-ce-breakdown-suggestion
      data-ce-breakdown-template-id="${escapeHtml(templateId)}"
      ${active ? 'data-ce-selected-breakdown-suggestion' : ''}
    >
      <span class="suggestionPair">
        ${escapeHtml(formatDisplayLabel(groups[0].value))}
        <span class="suggestionVs">vs</span>
        ${escapeHtml(formatDisplayLabel(groups[1].value))}
      </span>
      <span class="suggestionQuestion">${escapeHtml(question?.prompt || 'Select a benchmark statement to inspect the split.')}</span>
    </button>`;
  };
  const defaultSuggestionRow = renderSuggestionButton({
    active: true,
    groups: comparisonGroups,
    key: 'default',
    question: selectedQuestion,
  });
  const suggestionRows = defaultSuggestionRow + traitEntries.flatMap(([trait, groups]) => {
    const entries = Object.entries(groups)
      .sort((left, right) => right[1].length - left[1].length);
    if (entries.length < 2) return [];
    return entries.slice(0, 2).map(([value, ids], index) => ({
      trait,
      value,
      ids,
      pairValue: entries[index === 0 ? 1 : 0]?.[0] || entries[0]?.[0] || value,
      pairIds: entries[index === 0 ? 1 : 0]?.[1] || entries[0]?.[1] || ids,
      labels: ids.map((id) => participantMap[id]?.label || id).join(', '),
    }));
  })
    .sort((left, right) => right.ids.length - left.ids.length)
    .slice(0, 6)
    .map((entry, index) => {
      const suggestionQuestion = suggestionQuestions[index % Math.max(1, suggestionQuestions.length)];
      const groupsForSuggestion = [
        {
          trait: entry.trait,
          value: entry.value,
          ids: entry.ids,
          name: `${formatDisplayLabel(entry.trait)}: ${formatDisplayLabel(entry.value)}`,
          segmentKey: `${entry.trait}:${entry.value}`,
          summary: suggestionQuestion ? aggregateQuestionSummaryForModels(report, suggestionQuestion.id, entry.ids) : {},
        },
        {
          trait: entry.trait,
          value: entry.pairValue,
          ids: entry.pairIds,
          name: `${formatDisplayLabel(entry.trait)}: ${formatDisplayLabel(entry.pairValue)}`,
          segmentKey: `${entry.trait}:${entry.pairValue}`,
          summary: suggestionQuestion ? aggregateQuestionSummaryForModels(report, suggestionQuestion.id, entry.pairIds) : {},
        },
      ];
      return renderSuggestionButton({
        groups: groupsForSuggestion,
        key: `${entry.trait}-${entry.value}-${entry.pairValue}-${suggestionQuestion?.id || index}`,
        question: suggestionQuestion,
      });
    }).join('');
  const countryGroups = Object.entries(traits.countryOfOrigin || {})
    .sort((left, right) => right[1].length - left[1].length);
  const mapDataByGeography = new Map(countryGroups.map(([country, ids]) => {
    const summary = aggregateQuestionSummaryForModels(report, selectedQuestion?.id, ids);
    const distribution = answerDistributionRows(summary)
      .sort((left, right) => right.count - left.count);
    const topAnswer = distribution[0];
    const geographyName = WORLD_MAP_COUNTRY_ALIASES[String(country).trim()] || String(country).trim();
    return [geographyName, {
      country,
      ids,
      topAnswer: topAnswer?.count > 0 ? topAnswer.responseText : null,
      topRate: topAnswer?.count > 0 ? topAnswer.rate : 0,
    }];
  }));
  const mapCountries = WORLD_MAP_GEOGRAPHIES.map((geography) => {
    const countryData = mapDataByGeography.get(geography.name);
    const hasData = Boolean(countryData?.topAnswer);
    const fill = hasData
      ? WORLD_MAP_ANSWER_COLORS[countryData.topAnswer] || WORLD_MAP_DEFAULT_COUNTRY_FILL
      : WORLD_MAP_DEFAULT_COUNTRY_FILL;
    const title = hasData
      ? `${formatDisplayLabel(countryData.country)}: ${countryData.topAnswer} (${(countryData.topRate * 100).toFixed(0)}%)`
      : `${geography.name}: No data`;
    const participantLabels = hasData
      ? countryData.ids.map((id) => participantMap[id]?.label || id).join(', ')
      : '';
    return `<path
      class="worldMapCountry${hasData ? ' worldMapCountryHasData' : ''}"
      fill="${escapeHtml(fill)}"
      data-ce-world-map-country="${escapeHtml(geography.name)}"
      ${hasData ? `data-ce-searchable tabindex="0" aria-label="${escapeHtml(`${title}. Models: ${participantLabels}`)}"` : ''}
      d="${escapeHtml(geography.path)}"
    ><title>${escapeHtml(title)}</title></path>`;
  }).join('');
  const mapLegend = Object.entries(WORLD_MAP_ANSWER_COLORS)
    .map(([label, color]) => `<span class="legendPill">
      <span class="legendSwatch" style="background-color:${escapeHtml(color)}"></span>
      ${escapeHtml(label)}
    </span>`)
    .join('');
  const mapPanelHeader = selectedQuestion
    ? `<div>
        <h3 class="panelTitle">World Results Map</h3>
        <p class="panelMeta">${countryGroups.length ? 'Showing all model-origin country cohorts in this benchmark.' : 'Showing all country segments in the demo corpus.'}</p>
      </div>`
    : '<h3 class="panelTitle">World Results Map</h3>';
  const mapPanelBody = selectedQuestion ? `<div class="mapLegend" aria-label="Map answer legend">${mapLegend}</div>
  <div class="mapFrameShell">
    <div class="mapFrameViewport">
      <div class="mapFrame mapFrameCompact" data-testid="demo-analysis-world-map">
        <svg class="aidb-world-map-svg" viewBox="${escapeHtml(WORLD_MAP_VIEW_BOX)}" role="img" aria-label="World results map" preserveAspectRatio="xMidYMid meet">
          <path class="worldMapSphere" d="${escapeHtml(WORLD_MAP_SPHERE_PATH)}"></path>
          <path class="worldMapGraticule" d="${escapeHtml(WORLD_MAP_GRATICULE_PATH)}"></path>
          <g class="worldMapCountries">${mapCountries}</g>
        </svg>
      </div>
    </div>
  </div>` : `<div class="mapFrameShell">
    <div class="mapFrameViewport mapFrameViewportEmpty">
      <p class="mapViewportHint">Choose a comparison suggestion or inspect a question below to load the country map.</p>
    </div>
  </div>`;
  const breakdownRows = renderBreakdownRowsForQuestion(selectedQuestion);
  const questionBreakdownPanel = selectedQuestion ? `<section class="panel demoPanel chartPanel" data-testid="demo-analysis-question-breakdown">
    <div class="panelHeader">
      <div>
        <h3 class="panelTitle">Question Breakdown</h3>
        <p class="panelMeta">Selected statement distributions by model cohort</p>
      </div>
    </div>
    <div class="breakdownList" data-ce-breakdown-list>${breakdownRows || '<p class="emptyHint">Select a question to inspect its response breakdown.</p>'}</div>
  </section>` : `<section class="panel demoPanel chartPanel" data-testid="demo-analysis-question-breakdown">
    <h3 class="panelTitle">Question Breakdown</h3>
    <p class="emptyHint">Select a question to inspect its response breakdown.</p>
  </section>`;
  return renderModePane({
    id: 'breakdown',
    title: 'Breakdown',
    subtitle: 'Trait-level model cohorts for faceted comparison',
    className: 'aidb-demo-analysis-pane',
    bodyClassName: 'graphSection aidb-breakdown-section',
    body: `<div class="workspace demoAnalysisWorkspace aidb-breakdown-workspace" data-testid="demo-analysis-workspace" data-ce-demo-analysis-workspace>
      <section class="panel demoPanel filterPanel" data-testid="demo-analysis-demographic-selector">
        <div class="panelHeader">
          <div>
            <h3 class="panelTitle">Compare Demographics</h3>
            <p class="panelMeta">Select any two or more model trait segments to power the comparison report.</p>
          </div>
          <div class="selectorActions">
            <button type="button" class="clearButton" data-ce-breakdown-auto title="Auto-select the strongest correlation" aria-label="Auto-select strongest correlation">
              ${renderFontAwesomeIcon('magic', 'selectorActionSvgIcon')}
            </button>
            <button type="button" class="clearButton" data-ce-breakdown-clear${selectedPills ? '' : ' disabled'}>Clear all</button>
          </div>
        </div>
        ${selectedFilterState}
        <div class="selectorLayout breakdownTraitGrid">${traitPanels}</div>
      </section>
      ${selectedQuestion ? `<section class="selectedQuestionBanner" data-testid="demo-analysis-question-banner" data-ce-breakdown-question-id="${escapeHtml(selectedQuestion.id)}" data-ce-searchable>
        <div class="selectedQuestionFrame">
          <div class="selectedQuestionCard">
            <div class="selectedQuestionCardBody">
              <p class="selectedQuestionCardPrompt" data-testid="demo-analysis-selected-question" data-ce-breakdown-selected-prompt>${escapeHtml(selectedQuestion.prompt || selectedQuestion.id)}</p>
            </div>
          </div>
          <div class="selectedQuestionGrounding">
            <p class="selectedQuestionTension" data-testid="demo-analysis-selected-question-tension"><strong>Key tension:</strong> <span data-ce-breakdown-selected-tension>${escapeHtml(selectedQuestion.disagreementAxis || selectedQuestion.whyIncluded || 'Model cohorts diverge on this benchmark statement.')}</span></p>
            <div class="selectedQuestionGroundingPills" data-testid="demo-analysis-selected-question-tags">
              <a class="selectedQuestionTagButton selectedQuestionTagButtonActive" data-ce-breakdown-selected-topic data-ce-tag-open data-ce-tag="${escapeHtml(selectedQuestion.topic || 'uncategorized')}" href="${escapeHtml(buildStaticTagHref(selectedQuestion.topic || 'uncategorized'))}" title="${escapeHtml(`Open ${selectedQuestion.topic || 'uncategorized'} in the tag explorer`)}">${escapeHtml(selectedQuestion.topic || 'uncategorized')}</a>
            </div>
          </div>
        </div>
      </section>` : ''}
      ${questionBreakdownPanel}
      <div class="primaryGrid">
        <section class="panel demoPanel suggestionPanel">
          <div class="panelHeader">
            <div>
              <h3 class="panelTitle">Comparison Suggestions</h3>
              <p class="panelMeta">Suggestions compare cohorts within models matching the current filters. Values in one category combine as OR; categories combine as AND.</p>
            </div>
          </div>
          <p class="suggestionFilterStatus" data-ce-breakdown-suggestions-status aria-live="polite"></p>
          <div class="suggestionsList" data-ce-breakdown-suggestions-list>${suggestionRows || '<p class="emptyHint">No suggestion pairs are available for the current selection.</p>'}</div>
        </section>
        <section class="panel demoPanel mapPanel" data-ce-searchable>
          <div class="panelHeader">
            ${mapPanelHeader}
          </div>
          ${mapPanelBody}
        </section>
      </div>
      <div data-ce-breakdown-comparison-report>${renderComparisonReport(report, selectedQuestion, comparisonGroups)}</div>
      ${breakdownTemplates.join('')}
    </div>`,
  });
};

const renderRiskMatrix = (report) => {
  const overlayCells = report.analysisOverlay?.riskMatrix?.cells || {};
  const analysisPayload = buildRiskMatrixAnalysisPayload([], overlayCells);
  const heatmap = new Map();
  Object.entries(overlayCells).forEach(([cellId, cell]) => {
    if (!cellId.includes('_vs_') || !cell || typeof cell !== 'object') return;
    const [catX, catY] = cellId.split('_vs_');
    const explicitValue = Number(cell.value ?? cell.score);
    const generatedValue = normalizeOverlayList(cell.opportunities).length - normalizeOverlayList(cell.risks).length;
    const value = Number.isFinite(explicitValue) ? explicitValue : generatedValue;
    heatmap.set(`${catY}_${catX}`, value);
  });
  const categoryEntries = RISK_MATRIX_CATEGORIES;
  const defaultSelection = selectDefaultRiskMatrixIntersection([], heatmap);
  const activeCategoryX = defaultSelection.activeCategoryX;
  const activeCategoryY = defaultSelection.activeCategoryY;
  const activeCategoryXEntry = categoryEntries.find((category) => category.name === activeCategoryX);
  const activeCategoryYEntry = categoryEntries.find((category) => category.name === activeCategoryY);
  const formatMatrixValue = (value) => {
    if (!Number.isFinite(value) || value === 0) return '';
    return value > 0 ? `+${value}` : String(value);
  };
  const riskMatrixColor = (value) => {
    if (!Number.isFinite(value) || value === 0) return '';
    const ratio = Math.min(Math.abs(value) / 6, 1);
    const opacity = 0.35 + ratio * 0.55;
    return value > 0 ? `rgba(50, 255, 140, ${opacity})` : `rgba(255, 80, 90, ${opacity})`;
  };
  const categoryCell = (rowCategory, colCategory) => {
    const key = `${rowCategory.name}_${colCategory.name}`;
    const value = heatmap.get(key) || 0;
    const cellId = riskAggregateCellId(colCategory.name, rowCategory.name);
    const overlay = overlayCells[cellId];
    return { value, comments: [], linked: Boolean(overlay), overlay };
  };
  const subCell = (subY, subX) => {
    if (!activeCategoryXEntry || !activeCategoryYEntry) return { value: 0, linked: false };
    const cellId = riskSubCellId(activeCategoryXEntry.name, subX, activeCategoryYEntry.name, subY);
    const overlay = overlayCells[cellId];
    const opportunities = normalizeOverlayList(overlay?.opportunities).length;
    const risks = normalizeOverlayList(overlay?.risks).length;
    const explicitValue = Number(overlay?.value ?? overlay?.score);
    return {
      comments: [],
      value: Number.isFinite(explicitValue) ? explicitValue : opportunities - risks,
      linked: Boolean(overlay),
    };
  };
  const categoryCellLabel = (rowCategory, colCategory, cell) => {
    if (cell.value === 0) {
      return 'no generated analysis yet';
    }
    const leaning = cell.value > 0 ? 'opportunity' : 'risk';
    return `${leaning} balance ${formatMatrixValue(cell.value)}`;
  };
  const subCellLabel = (subY, subX, cell) => {
    if (cell.value === 0) {
      return `${activeCategoryXEntry?.name || ''} ${subX} versus ${activeCategoryYEntry?.name || ''} ${subY}, no generated analysis yet.`;
    }
    const leaning = cell.value > 0 ? 'opportunity' : 'risk';
    return `${activeCategoryXEntry?.name || ''} ${subX} versus ${activeCategoryYEntry?.name || ''} ${subY}, ${leaning} balance ${formatMatrixValue(cell.value)}. Open detailed notes.`;
  };
  const headerCells = categoryEntries.map((category, index) => {
    const isActive = activeCategoryX === category.name;
    return `<button
      type="button"
      class="riskMatrixCell cell riskMatrixHeaderCell headerCell${isActive ? ' activeHeaderCell' : ''}"
      style="grid-column:${index + 2};grid-row:1;"
      data-testid="ce-risk-matrix-header-x-${escapeHtml(toTestIdFragment(category.name))}"
      aria-pressed="${isActive ? 'true' : 'false'}"
    >${escapeHtml(category.name)}</button>`;
  }).join('');
  const gridRows = categoryEntries.map((rowCategory, rowIndex) => {
    const cells = categoryEntries.map((colCategory, colIndex) => {
      const isDiagonal = rowIndex === colIndex;
      if (isDiagonal) {
        return `<div
          class="riskMatrixCell cell riskMatrixDiagonalCell diagonalCell"
          style="grid-column:${colIndex + 2};grid-row:${rowIndex + 2};"
        >&bull;</div>`;
      }
      const cell = categoryCell(rowCategory, colCategory);
      const valueLabel = formatMatrixValue(cell.value);
      const label = categoryCellLabel(rowCategory, colCategory, cell);
      const linkedClass = cell.linked ? ' riskMatrixGridCellLinked gridCellLinked' : '';
      const emptyClass = cell.value === 0 ? ' riskMatrixEmptyCell emptyCell' : '';
      const highlightedClass = (
        rowCategory.name === activeCategoryY || colCategory.name === activeCategoryX
      ) ? ' highlighted' : '';
      const color = riskMatrixColor(cell.value);
      const style = `grid-column:${colIndex + 2};grid-row:${rowIndex + 2};${color ? `background-color:${color};` : ''}`;
      const cellId = riskAggregateCellId(colCategory.name, rowCategory.name);
      return `<button
        type="button"
        class="riskMatrixCell cell riskMatrixGridCell gridCell${emptyClass}${linkedClass}${highlightedClass}"
        style="${escapeHtml(style)}"
        data-ce-searchable
        data-ce-risk-matrix-cell
        data-ce-ai-analysis-target="risk-matrix-cell"
        data-risk-cell-id="${escapeHtml(cellId)}"
        data-risk-category-x="${escapeHtml(colCategory.name)}"
        data-risk-category-y="${escapeHtml(rowCategory.name)}"
        data-risk-value="${escapeHtml(cell.value)}"
        data-risk-note-count="${escapeHtml(cell.comments.length)}"
        data-testid="ce-risk-matrix-cell-${escapeHtml(toTestIdFragment(colCategory.name))}-vs-${escapeHtml(toTestIdFragment(rowCategory.name))}"
        aria-label="${escapeHtml(`${colCategory.name} versus ${rowCategory.name}, ${label}. Open aggregated notes.`)}"
        title="${escapeHtml(`${rowCategory.name} / ${colCategory.name}: ${label}`)}"
      >
        ${valueLabel ? `<span class="riskMatrixCellValue cellValue">${escapeHtml(valueLabel)}</span>` : ''}
      </button>`;
    }).join('');
    const isActive = activeCategoryY === rowCategory.name;
    return `<button
      type="button"
      class="riskMatrixCell cell riskMatrixHeaderCell headerCell riskMatrixRowHeader${isActive ? ' activeHeaderCell' : ''}"
      style="grid-column:1;grid-row:${rowIndex + 2};"
      data-testid="ce-risk-matrix-header-y-${escapeHtml(toTestIdFragment(rowCategory.name))}"
      aria-pressed="${isActive ? 'true' : 'false'}"
    >${escapeHtml(rowCategory.name)}</button>${cells}`;
  }).join('');
  const selectorSection = (activeCategoryXEntry && activeCategoryYEntry) ? `<div class="selectorGrid">
    <div class="selectorPanel">
      <h4 class="selectorTitle">${escapeHtml(activeCategoryXEntry.name)}</h4>
      <div class="selectorButtonRow">
        ${activeCategoryXEntry.subcategories.map((subcategory) => `<button
          type="button"
          class="selectorButton"
          data-testid="ce-risk-matrix-selector-x-${escapeHtml(toTestIdFragment(subcategory))}"
          aria-pressed="false"
        >${escapeHtml(subcategory)}</button>`).join('')}
        <button
          type="button"
          class="selectorButton selectorButtonClear"
          data-testid="ce-risk-matrix-selector-x-clear"
          disabled
        >Clear X</button>
      </div>
    </div>
    <div class="selectorPanel">
      <h4 class="selectorTitle">${escapeHtml(activeCategoryYEntry.name)}</h4>
      <div class="selectorButtonRow">
        ${activeCategoryYEntry.subcategories.map((subcategory) => `<button
          type="button"
          class="selectorButton"
          data-testid="ce-risk-matrix-selector-y-${escapeHtml(toTestIdFragment(subcategory))}"
          aria-pressed="false"
        >${escapeHtml(subcategory)}</button>`).join('')}
        <button
          type="button"
          class="selectorButton selectorButtonClear"
          data-testid="ce-risk-matrix-selector-y-clear"
          disabled
        >Clear Y</button>
      </div>
    </div>
  </div>` : '';
  const subgridSection = (activeCategoryXEntry && activeCategoryYEntry) ? `<section class="riskMatrixSectionCard sectionCard" data-testid="ce-risk-matrix-subgrid">
    <div class="subgridHeader">
      <h3 class="riskMatrixSectionTitle sectionTitle">${escapeHtml(activeCategoryYEntry.name)} x ${escapeHtml(activeCategoryXEntry.name)}</h3>
      <p class="subgridSummary">Refine generated analysis into sub-overlaps and open atlas-linked scenarios attached to each detail cell.</p>
    </div>
    ${selectorSection}
    <div class="riskMatrixGridScroll gridScroll">
      <div class="subgridContainer" style="grid-template-columns: minmax(140px, 0.85fr) repeat(${activeCategoryXEntry.subcategories.length}, minmax(0, 1fr)); grid-template-rows: auto repeat(${activeCategoryYEntry.subcategories.length}, minmax(72px, auto));">
        <div class="riskMatrixCell cell riskMatrixCornerCell cornerCell" style="grid-column:1;grid-row:1;"><span>Detail</span></div>
        ${activeCategoryXEntry.subcategories.map((subX, index) => `<button
          type="button"
          class="riskMatrixCell cell riskMatrixHeaderCell headerCell"
          style="grid-column:${index + 2};grid-row:1;"
          data-testid="ce-risk-matrix-subheader-x-${escapeHtml(toTestIdFragment(subX))}"
          aria-pressed="false"
        >${escapeHtml(subX)}</button>`).join('')}
        ${activeCategoryYEntry.subcategories.map((subY, rowIndex) => {
          const rowHeader = `<button
            type="button"
            class="riskMatrixCell cell riskMatrixHeaderCell headerCell riskMatrixRowHeader"
            style="grid-column:1;grid-row:${rowIndex + 2};"
            data-testid="ce-risk-matrix-subheader-y-${escapeHtml(toTestIdFragment(subY))}"
            aria-pressed="false"
          >${escapeHtml(subY)}</button>`;
          const rowCells = activeCategoryXEntry.subcategories.map((subX, colIndex) => {
            const cell = subCell(subY, subX);
            const valueLabel = formatMatrixValue(cell.value);
            const linkedClass = cell.linked ? ' riskMatrixGridCellLinked gridCellLinked' : '';
            const emptyClass = cell.value === 0 ? ' riskMatrixEmptyCell emptyCell' : '';
            const color = riskMatrixColor(cell.value);
            const style = `grid-column:${colIndex + 2};grid-row:${rowIndex + 2};${color ? `background-color:${color};` : ''}`;
            const cellId = riskSubCellId(activeCategoryXEntry.name, subX, activeCategoryYEntry.name, subY);
            return `<button
              type="button"
              class="riskMatrixCell cell riskMatrixGridCell gridCell${emptyClass}${linkedClass}"
              style="${escapeHtml(style)}"
              data-ce-searchable
              data-ce-risk-matrix-cell
              data-ce-ai-analysis-target="risk-matrix-subcell"
              data-risk-cell-id="${escapeHtml(cellId)}"
              data-risk-category-x="${escapeHtml(activeCategoryXEntry.name)}"
              data-risk-subcategory-x="${escapeHtml(subX)}"
              data-risk-category-y="${escapeHtml(activeCategoryYEntry.name)}"
              data-risk-subcategory-y="${escapeHtml(subY)}"
              data-risk-value="${escapeHtml(cell.value)}"
              data-risk-note-count="${escapeHtml(cell.comments.length)}"
              data-testid="ce-risk-matrix-subcell-${escapeHtml(toTestIdFragment(activeCategoryXEntry.name))}-${escapeHtml(toTestIdFragment(subX))}-vs-${escapeHtml(toTestIdFragment(activeCategoryYEntry.name))}-${escapeHtml(toTestIdFragment(subY))}"
              aria-label="${escapeHtml(subCellLabel(subY, subX, cell))}"
              title="${escapeHtml(`${activeCategoryYEntry.name} / ${subY} / ${activeCategoryXEntry.name} / ${subX}: ${cell.value === 0 ? 'no generated analysis yet' : `${cell.value > 0 ? 'opportunity' : 'risk'} balance ${valueLabel}`}`)}"
            >
              ${valueLabel ? `<span class="riskMatrixCellValue cellValue">${escapeHtml(valueLabel)}</span>` : ''}
              ${cell.linked ? '<span class="riskMatrixCellMeta">AI analysis</span>' : ''}
            </button>`;
          }).join('');
          return `${rowHeader}${rowCells}`;
        }).join('')}
      </div>
    </div>
  </section>` : '';
  return renderModePane({
    id: 'risk-matrix',
    title: 'Risk Matrix',
    subtitle: 'Validated second-pass analysis in the Context Engine category matrix',
    className: 'aidb-risk-matrix-pane',
    bodyClassName: 'graphSection aidb-risk-matrix-section',
    body: `<div class="riskMatrixContainer container riskMatrixEmbedded embedded">
        <div class="riskMatrixShell shell">
          ${Object.keys(overlayCells).length === 0 ? '<div class="aidb-analysis-required" role="status"><strong>Analysis not generated.</strong> The measured benchmark does not infer risk or opportunity interactions. Supply a validated second-pass analysis overlay to populate this matrix.</div>' : ''}
          <section class="riskMatrixSectionCard sectionCard">
            <div class="riskMatrixGridScroll gridScroll">
              <div class="riskMatrixGridContainer gridContainer" style="grid-template-columns: 122px repeat(${RISK_MATRIX_CATEGORIES.length}, minmax(104px, 1fr)); grid-template-rows: auto repeat(${RISK_MATRIX_CATEGORIES.length}, minmax(78px, auto));">
                <div class="riskMatrixCell cell riskMatrixCornerCell cornerCell" style="grid-column:1;grid-row:1;"><span>Y / X</span></div>
                ${headerCells}
                ${gridRows}
              </div>
            </div>
          </section>
          ${subgridSection}
        </div>
      </div>
      <script type="application/json" id="ce-ai-discourse-bench-risk-matrix-analysis">${serializeJsonForHtmlScript(analysisPayload)}</script>
      <div class="riskMatrixBackdrop" data-ce-risk-matrix-backdrop hidden></div>
      <div class="riskMatrixCommentModal" data-ce-risk-matrix-modal hidden role="dialog" aria-modal="true" aria-labelledby="ce-risk-matrix-modal-title">
        <div class="modal-dialog">
          <div class="riskMatrixModalContent modal-content">
            <div class="riskMatrixModalBody" data-testid="ce-risk-matrix-modal">
              <div class="riskMatrixModalHeader">
                <div class="modalTitleBlock">
                  <h3 class="modalTitle" id="ce-risk-matrix-modal-title" data-ce-risk-matrix-modal-title>Interaction detail</h3>
                  <span class="modalMeta" data-ce-risk-matrix-modal-meta>0 notes</span>
                </div>
                <button type="button" class="modalCloseButton" aria-label="Close" data-ce-risk-matrix-close>&times;</button>
              </div>
              <div data-ce-risk-matrix-scenario-rail></div>
              <div class="commentSections" data-ce-risk-matrix-comment-list></div>
              <p class="emptyState" data-ce-risk-matrix-empty hidden>No notes yet.</p>
              <div class="riskMatrixModalFooter">
                <button type="button" class="modalButton modalButtonSecondary" data-ce-risk-matrix-close>Close</button>
              </div>
            </div>
          </div>
        </div>
      </div>`,
  });
};

const renderAnalysisCompassSvg = (compass) => {
  const width = 420;
  const height = 280;
  const left = 54;
  const right = width - 54;
  const top = 42;
  const bottom = height - 42;
  const xFor = (value) => left + ((clamp(Number(value), -1, 1) + 1) / 2) * (right - left);
  const yFor = (value) => bottom - ((clamp(Number(value), -1, 1) + 1) / 2) * (bottom - top);
  const points = compass.placements.map((placement, index) => {
    const x = xFor(placement.x);
    const y = yFor(placement.y);
    const color = D3_CATEGORY10[index % D3_CATEGORY10.length];
    return `<g class="aidb-compass-point" data-ce-searchable data-ce-compass-placement="${escapeHtml(placement.id)}" tabindex="0">
      <circle cx="${escapeHtml(x.toFixed(1))}" cy="${escapeHtml(y.toFixed(1))}" r="6" fill="${escapeHtml(color)}" />
      <text x="${escapeHtml((x + 10).toFixed(1))}" y="${escapeHtml((y - 8).toFixed(1))}" class="aidb-compass-point-label">${escapeHtml(placement.label)}</text>
      <title>${escapeHtml(`${placement.label}: ${placement.summary || `${formatScore(placement.x)}, ${formatScore(placement.y)}`}`)}</title>
    </g>`;
  }).join('');
  return `<svg class="aidb-compass-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(compass.title)}">
    <rect class="aidb-compass-bg" x="16" y="16" width="${width - 32}" height="${height - 32}" rx="14" />
    <line class="aidb-compass-axis" x1="${left}" y1="${(top + bottom) / 2}" x2="${right}" y2="${(top + bottom) / 2}" />
    <line class="aidb-compass-axis" x1="${(left + right) / 2}" y1="${top}" x2="${(left + right) / 2}" y2="${bottom}" />
    <text class="aidb-compass-axis-label" x="${left}" y="${height - 18}" text-anchor="start">${escapeHtml(compass.xAxis.left)}</text>
    <text class="aidb-compass-axis-label" x="${right}" y="${height - 18}" text-anchor="end">${escapeHtml(compass.xAxis.right)}</text>
    <text class="aidb-compass-axis-label" x="${(left + right) / 2}" y="28" text-anchor="middle">${escapeHtml(compass.yAxis.right)}</text>
    <text class="aidb-compass-axis-label" x="${(left + right) / 2}" y="${height - 30}" text-anchor="middle">${escapeHtml(compass.yAxis.left)}</text>
    ${points}
  </svg>`;
};

const renderAnalysisCompasses = (report) => {
  const compasses = normalizeAnalysisCompasses(report);
  if (!compasses.length) return '';
  return `<div class="aidb-analysis-compasses" data-ce-analysis-compasses>
    ${compasses.map((compass) => `<div class="collapseSection aidb-analysis-compass" data-ce-static-compass data-ce-compass-id="${escapeHtml(compass.id)}">
      <div class="collapseHeader" data-ce-static-compass-toggle role="button" tabindex="0" aria-expanded="true">
        ${renderFontAwesomeIcon('caret-up', 'aidb-compass-caret aidb-compass-caret-open', 'data-ce-static-compass-caret-open')}
        ${renderFontAwesomeIcon('caret-down', 'aidb-compass-caret aidb-compass-caret-closed', 'data-ce-static-compass-caret-closed hidden')}
        <span>${escapeHtml(compass.title)}</span>
        <span class="collapseCount">${escapeHtml(compass.placements.length)} placements</span>
        <span class="collapseToggle" data-ce-static-compass-label>Hide</span>
      </div>
      <div class="collapseContent compassSection" data-ce-static-compass-body>
        <div class="compassContainer">
          ${renderAnalysisCompassSvg(compass)}
        </div>
      </div>
    </div>`).join('')}
  </div>`;
};

const renderAtlasModalCollapse = ({ id, title, count = null, content, open = false }) => {
  const bodyId = `ce-atlas-modal-${toTestIdFragment(id)}-body`;
  return `<section class="atlasIssueCollapse" data-ce-atlas-modal-collapse-section>
    <button
      type="button"
      class="atlasIssueCollapseHeader"
      data-ce-atlas-modal-collapse
      aria-expanded="${open ? 'true' : 'false'}"
      aria-controls="${escapeHtml(bodyId)}"
    >
      ${renderFontAwesomeIcon('caret-up', 'atlasIssueCollapseCaret', `data-ce-atlas-modal-caret-open${open ? '' : ' hidden'}`)}
      ${renderFontAwesomeIcon('caret-down', 'atlasIssueCollapseCaret', `data-ce-atlas-modal-caret-closed${open ? ' hidden' : ''}`)}
      <span>${escapeHtml(title)}</span>
      ${Number.isFinite(count) ? `<span class="atlasIssueCollapseCount">(${escapeHtml(count)})</span>` : ''}
      <span class="atlasIssueCollapseToggle" data-ce-atlas-modal-collapse-label>${open ? 'Hide' : 'Show'}</span>
    </button>
    <div class="atlasIssueCollapseContent" id="${escapeHtml(bodyId)}" data-ce-atlas-modal-collapse-body${open ? '' : ' hidden'}>
      ${content}
    </div>
  </section>`;
};

const renderAtlasIssueFindingGroup = (title, items) => {
  if (!items.length) return '';
  return `<div class="atlasIssueFindingGroup">
    <h4>${escapeHtml(title)}</h4>
    <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
  </div>`;
};

const renderAtlasIssueQuestionLinks = (questionIds) => {
  if (!questionIds.length) return '';
  return `<div class="atlasIssueSectionLinks">
    <span>Linked questions</span>
    ${questionIds.map((questionId) => `<a href="#question-${escapeHtml(questionId)}" data-ce-atlas-question-link>${escapeHtml(questionId)}</a>`).join('')}
  </div>`;
};

const renderAtlasQuestionDistribution = (summary = {}, modelAnswers = [], options = {}) => {
  const className = String(options.className || '').trim();
  const showLegend = options.showLegend !== false;
  const { agree, unsure, disagree, invalid } = answerTotals(summary);
  const total = agree + unsure + disagree + invalid;
  const widthTotal = Math.max(1, total);
  const entries = [
    { label: 'Agree', count: agree, className: 'aidb-answer-agree' },
    { label: 'Unsure', count: unsure, className: 'aidb-answer-unsure' },
    { label: 'Disagree', count: disagree, className: 'aidb-answer-disagree' },
    ...(invalid > 0 ? [{ label: 'Invalid', count: invalid, className: 'aidb-answer-invalid' }] : []),
  ];
  let precedingCount = 0;
  const markers = entries.flatMap((entry) => {
    const matchingModels = modelAnswers.filter((modelAnswer) => modelAnswer.answer === entry.label);
    const segmentStart = precedingCount / widthTotal;
    const segmentWidth = entry.count / widthTotal;
    precedingCount += entry.count;
    return matchingModels.map((modelAnswer, index) => ({
      ...modelAnswer,
      left: (segmentStart + (segmentWidth * ((index + 1) / (matchingModels.length + 1)))) * 100,
    }));
  });
  const modelAssignments = markers.map((marker) => `${marker.label}: ${marker.answer}`).join(', ');
  const ariaLabel = `Model vote distribution: ${entries.map((entry) => `${entry.label} ${entry.count}`).join(', ')}${modelAssignments ? `. Model answers: ${modelAssignments}` : ''}`;
  return `<div class="atlasIssueQuestionDistribution${className ? ` ${escapeHtml(className)}` : ''}" data-ce-atlas-question-distribution aria-label="${escapeHtml(ariaLabel)}">
    <div class="atlasIssueQuestionBar" data-ce-atlas-question-vote-bar>
      <span class="atlasIssueQuestionSegments" aria-hidden="true">
        ${entries.map((entry) => `<i class="${escapeHtml(entry.className)}" style="width:${escapeHtml(((entry.count / widthTotal) * 100).toFixed(2))}%" title="${escapeHtml(`${entry.label}: ${entry.count} (${formatPercent(entry.count / widthTotal)})`)}"></i>`).join('')}
      </span>
      ${markers.map((marker) => `<span
        class="atlasIssueModelMarker"
        data-ce-atlas-model-marker="${escapeHtml(marker.id)}"
        data-ce-atlas-model-answer="${escapeHtml(marker.answer)}"
        data-ce-atlas-model-label="${escapeHtml(marker.label)}"
        data-ce-atlas-model-repeat-value="${escapeHtml(Number.isFinite(marker.repeatStability) ? formatPercent(marker.repeatStability) : 'No repeat data')}"
        data-ce-atlas-model-winning-responses="${escapeHtml(marker.winningResponses || 0)}"
        data-ce-atlas-model-attempted-runs="${escapeHtml(marker.attemptedRuns || 0)}"
        style="--atlas-model-color:${escapeHtml(marker.color)};left:${escapeHtml(marker.left.toFixed(2))}%"
        title="${escapeHtml(`${marker.label}: ${marker.answer}`)}"
        role="img"
        aria-label="${escapeHtml(`${marker.label}: ${marker.answer}`)}"
      >${escapeHtml(marker.markerLabel)}</span>`).join('')}
    </div>
    ${showLegend ? `<div class="atlasIssueQuestionVoteLegend">
      ${entries.map((entry) => `<span class="atlasIssueQuestionVoteItem" data-ce-atlas-question-vote-count="${escapeHtml(entry.label)}"><i class="${escapeHtml(entry.className)}"></i><span>${escapeHtml(entry.label)}</span><strong>${escapeHtml(entry.count)}</strong></span>`).join('')}
      <span class="atlasIssueQuestionVoteTotal">${escapeHtml(total)} model vote${total === 1 ? '' : 's'}</span>
    </div>` : ''}
  </div>`;
};

const renderAtlasIssueTemplate = (issueArea, index) => {
  const depthClass = ['depth0', 'depth1', 'depth2'][index % 3];
  const answeringModelCount = issueArea.answeringModels.length;
  const answeredModelQuestionCount = Number(issueArea.answeredModelQuestionCount || 0);
  const hasModelAnswers = answeredModelQuestionCount > 0;
  const stanceValue = hasModelAnswers
    ? `Average ${formatSignedScore(issueArea.averageStance)}`
    : 'No model answers';
  const stanceDetail = hasModelAnswers && Number.isFinite(issueArea.averageStance)
    ? '-1 disagree | 0 unsure | +1 agree'
    : 'Valid averaged answers required';
  const differenceValue = Number.isFinite(issueArea.averageModelDifference)
    ? `Mean gap ${formatScore(issueArea.averageModelDifference)}`
    : 'No comparison';
  const differenceDetail = Number.isFinite(issueArea.averageModelDifference)
    ? '0 same | 2 opposite'
    : 'Two models must answer the same question';
  const consistencyValue = Number.isFinite(issueArea.averageWinningResponseConsistency)
    ? formatPercent(issueArea.averageWinningResponseConsistency)
    : 'No repeat data';
  const consistencyDetail = Number.isFinite(issueArea.averageWinningResponseConsistency)
    ? "Runs matching each model's most common answer"
    : 'Repeated runs required';
  const modelRoster = answeringModelCount
    ? `<section class="atlasIssueModelRoster" data-ce-atlas-model-roster aria-label="Models included">
      <div class="atlasIssueModelRosterHeader">
        <strong>Models included</strong>
      </div>
      <ul class="atlasIssueModelList">
        ${issueArea.answeringModels.map((participant) => `<li class="atlasIssueModelListItem">
          <button
            type="button"
            class="atlasIssueModelCard"
            data-ce-atlas-model-card="${escapeHtml(participant.id)}"
            data-ce-atlas-model-label="${escapeHtml(participant.label)}"
            data-ce-atlas-model-stance-value="${escapeHtml(Number.isFinite(participant.averageStance) ? `Average ${formatSignedScore(participant.averageStance)}` : 'No model answers')}"
            data-ce-atlas-model-stance-detail="${escapeHtml(`Across ${participant.answeredQuestionCount} answered question${participant.answeredQuestionCount === 1 ? '' : 's'}`)}"
            data-ce-atlas-model-difference-value="${escapeHtml(Number.isFinite(participant.averagePeerDifference) ? `Mean peer gap ${formatScore(participant.averagePeerDifference)}` : 'No peer comparison')}"
            data-ce-atlas-model-difference-detail="Average absolute score gap from the other models"
            data-ce-atlas-model-consistency-value="${escapeHtml(Number.isFinite(participant.repeatStability) ? formatPercent(participant.repeatStability) : 'No repeat data')}"
            data-ce-atlas-model-consistency-detail="Runs matching this model's most common answer"
            style="--atlas-model-color:${escapeHtml(participant.color)}"
            aria-label="Highlight ${escapeHtml(participant.label)} answers and metrics; click to lock selection"
            aria-pressed="false"
          >
            <span class="atlasIssueModelBadge" aria-hidden="true">${escapeHtml(participant.markerLabel)}</span>
            <strong>${escapeHtml(participant.label)}</strong>
          </button>
        </li>`).join('')}
      </ul>
    </section>`
    : '';
  const findingGroups = [
    renderAtlasIssueFindingGroup('Key tensions', issueArea.keyTensions),
    renderAtlasIssueFindingGroup('Points of agreement', issueArea.pointsOfAgreement),
    renderAtlasIssueFindingGroup('Points of disagreement', issueArea.pointsOfDisagreement),
    renderAtlasIssueFindingGroup('Open questions', issueArea.openQuestions),
    renderAtlasIssueFindingGroup('Implications', issueArea.implications),
  ].join('');
  const findings = findingGroups
    ? renderAtlasModalCollapse({
      id: `${issueArea.id}-analysis`,
      title: 'Issue Analysis',
      count: [
        issueArea.keyTensions,
        issueArea.pointsOfAgreement,
        issueArea.pointsOfDisagreement,
        issueArea.openQuestions,
        issueArea.implications,
      ].reduce((sum, items) => sum + items.length, 0),
      content: `<div class="atlasIssueFindingGrid">${findingGroups}</div>`,
      open: true,
    })
    : '';
  const freeformSections = issueArea.analysisSections.map((section, sectionIndex) => renderAtlasModalCollapse({
    id: `${issueArea.id}-${section.id}`,
    title: section.title,
    count: section.bullets.length || null,
    content: `<div class="atlasIssueFreeform">
      ${section.body ? `<p>${escapeHtml(section.body)}</p>` : ''}
      ${section.bullets.length ? `<ul>${section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>` : ''}
      ${renderAtlasIssueQuestionLinks(section.linkedQuestionIds)}
    </div>`,
    open: sectionIndex === 0,
  })).join('');
  const questions = issueArea.linkedQuestions.map((question) => {
    const difference = Number.isFinite(question.modelDifference)
      ? formatScore(question.modelDifference)
      : 'unavailable';
    const consistency = Number.isFinite(question.winningResponseConsistency)
      ? formatPercent(question.winningResponseConsistency)
      : 'unavailable';
    const aggregateMeta = `Model score gap ${difference} | ${consistency} repeat stability`;
    return `<a class="atlasIssueQuestion" href="#question-${escapeHtml(question.id)}" data-ce-atlas-question-link>
      <span class="atlasIssueQuestionId">${escapeHtml(question.id)}</span>
      <strong>${escapeHtml(question.prompt || question.id)}</strong>
      ${renderAtlasQuestionDistribution(question.voteSummary, question.modelAnswers)}
      <span class="atlasIssueQuestionMeta" data-ce-atlas-question-meta data-ce-atlas-question-meta-default="${escapeHtml(aggregateMeta)}">${escapeHtml(aggregateMeta)}</span>
    </a>`;
  }).join('');
  const questionSection = renderAtlasModalCollapse({
    id: `${issueArea.id}-questions`,
    title: 'Questions',
    count: issueArea.linkedQuestions.length,
    content: `<div class="atlasIssueQuestions">${questions || '<p class="atlasIssueEmpty">No linked benchmark questions.</p>'}</div>`,
    open: true,
  });
  return `<template
    data-ce-atlas-issue-template
    data-ce-atlas-topic-id="${escapeHtml(issueArea.id)}"
    data-ce-atlas-topic-title="${escapeHtml(issueArea.title)}"
  >
    <div class="atlasIssueModalTags">
      <span class="atlasIssueDepthTag ${escapeHtml(depthClass)}">Issue area</span>
      ${issueArea.tags.map((tag) => `<button type="button" class="atlasIssueTag" data-ce-atlas-modal-tag="${escapeHtml(tag)}" title="Filter the Debate Map by ${escapeHtml(tag)}">${escapeHtml(formatDisplayLabel(tag) || tag)}</button>`).join('')}
      ${issueArea.confidence ? `<span class="atlasIssueTag atlasIssueConfidence">AI confidence: ${escapeHtml(issueArea.confidence)}</span>` : ''}
    </div>
    <div class="atlasIssueOverview">
      ${issueArea.summary ? `<p class="atlasIssueSummary">${escapeHtml(issueArea.summary)}</p>` : ''}
      ${modelRoster}
      <div class="atlasIssueMetricGrid" data-ce-atlas-model-metric-grid aria-label="Issue area benchmark metrics">
        <div><span data-ce-atlas-metric-label="stance" data-ce-atlas-metric-default="Response direction">Response direction</span><strong data-ce-atlas-metric-value="stance" data-ce-atlas-metric-default="${escapeHtml(stanceValue)}">${escapeHtml(stanceValue)}</strong><small data-ce-atlas-metric-detail="stance" data-ce-atlas-metric-default="${escapeHtml(stanceDetail)}">${escapeHtml(stanceDetail)}</small></div>
        <div><span data-ce-atlas-metric-label="difference" data-ce-atlas-metric-default="Model difference">Model difference</span><strong data-ce-atlas-metric-value="difference" data-ce-atlas-metric-default="${escapeHtml(differenceValue)}">${escapeHtml(differenceValue)}</strong><small data-ce-atlas-metric-detail="difference" data-ce-atlas-metric-default="${escapeHtml(differenceDetail)}">${escapeHtml(differenceDetail)}</small></div>
        <div><span data-ce-atlas-metric-label="consistency" data-ce-atlas-metric-default="Repeat stability">Repeat stability</span><strong data-ce-atlas-metric-value="consistency" data-ce-atlas-metric-default="${escapeHtml(consistencyValue)}">${escapeHtml(consistencyValue)}</strong><small data-ce-atlas-metric-detail="consistency" data-ce-atlas-metric-default="${escapeHtml(consistencyDetail)}">${escapeHtml(consistencyDetail)}</small></div>
      </div>
    </div>
    ${findings}
    ${freeformSections}
    ${questionSection}
  </template>`;
};

const renderDebateAtlas = (report) => {
  const topics = normalizeAnalysisTopicCircles(report);
  const issueAreas = normalizeAnalysisIssueAreas(report, topics);
  const packedTopics = computeStaticPackedTopicLayout(issueAreas);
  const importanceAvailable = Boolean(report.importance?.available);
  const analysisCompasses = renderAnalysisCompasses(report);
  const tagOptions = Array.from(new Set(issueAreas.flatMap((issueArea) => issueArea.tags)))
    .sort((left, right) => left.localeCompare(right));
  const topDebateRows = [...issueAreas]
    .sort((left, right) => (
      (Number.isFinite(right.averageModelDifference) ? right.averageModelDifference : -1)
      - (Number.isFinite(left.averageModelDifference) ? left.averageModelDifference : -1)
    ) || Number(right.questionCount || 0) - Number(left.questionCount || 0))
    .slice(0, 3)
    .map((topic) => {
      const rawLabel = topic.label || 'uncategorized';
      const label = formatDisplayLabel(rawLabel) || rawLabel;
      return `<button
        type="button"
        class="topNodeItem"
        data-ce-node-id="${escapeHtml(topic.id || rawLabel)}"
        data-ce-atlas-open="${escapeHtml(topic.id || rawLabel)}"
        data-ce-searchable
      >
        <span class="nodeTitle">${escapeHtml(label)}</span>
        <span class="nodeStats">
          <span>${escapeHtml(String(topic.questionCount || 0))} questions</span>
          <span>difference ${escapeHtml(Number.isFinite(topic.averageModelDifference) ? formatScore(topic.averageModelDifference) : 'N/A')}</span>
          ${importanceAvailable ? `<span>importance ${escapeHtml(formatPercent(Number(topic.importanceShare || 0)))}</span>` : ''}
        </span>
      </button>`;
    }).join('');
  const nodes = packedTopics.map((node) => {
    const { topic, index, scale } = node;
    const rawLabel = topic.label || 'uncategorized';
    const label = formatDisplayLabel(rawLabel) || rawLabel;
    const depthClass = ['depth0', 'depth1', 'depth2'][index % 3];
    const longestSegment = String(label).split(/[-\s]+/).reduce((maxLength, segment) => Math.max(maxLength, segment.length), 0);
    const fontSize = clamp((11.8 + (scale * 1.4)) - Math.max(0, longestSegment - 11) * 0.42, 9.2, 13.4);
    const mobileFontSize = clamp(fontSize * (Number(node.mobileDiameterPx || node.diameterPx || 1) / Math.max(1, Number(node.diameterPx || 1))) * 1.04, 7.2, fontSize);
    return `<button
      type="button"
      id="debate-atlas-${escapeHtml(topic.id || rawLabel)}"
      class="atlasNode packedAtlasNode ${escapeHtml(depthClass)}"
      data-ce-searchable
      data-testid="ce-atlas-node"
      data-ce-node-id="${escapeHtml(topic.id || rawLabel)}"
      data-ce-atlas-open="${escapeHtml(topic.id || rawLabel)}"
      data-ce-atlas-label="${escapeHtml(label)}"
      data-ce-atlas-tags="${escapeHtml(JSON.stringify(topic.tags || []))}"
      data-ce-atlas-difference="${escapeHtml(Number.isFinite(topic.averageModelDifference) ? topic.averageModelDifference : '')}"
      data-ce-atlas-stance="${escapeHtml(Number.isFinite(topic.averageStance) ? topic.averageStance : '')}"
      data-ce-atlas-question-count="${escapeHtml(topic.questionCount || 0)}"
      data-ce-atlas-importance="${escapeHtml(Number.isFinite(Number(topic.importanceVotes)) ? Number(topic.importanceVotes) : '')}"
      data-ce-atlas-order="${escapeHtml(index)}"
      data-ce-atlas-scale="${escapeHtml(scale.toFixed(4))}"
      data-ce-node-layout="packed"
      style="z-index:${20 + index}; --atlas-left:${escapeHtml(node.x.toFixed(2))}%; --atlas-top:${escapeHtml(node.y.toFixed(2))}%; --atlas-mobile-left:${escapeHtml(node.mobileX.toFixed(2))}%; --atlas-mobile-top:${escapeHtml(node.mobileY.toFixed(2))}%; --topic-color:${escapeHtml(stanceColor(topic.averageStance))}; --topic-scale:${escapeHtml(scale.toFixed(2))}; --topic-diameter:${escapeHtml(node.diameterPx.toFixed(1))}px; --topic-mobile-diameter:${escapeHtml(node.mobileDiameterPx.toFixed(1))}px; --topic-mobile-font-size:${escapeHtml(mobileFontSize.toFixed(1))}px;"
      aria-label="${escapeHtml(`${label}: ${topic.questionCount || 0} questions, ${scoreLabel({ meanScore: topic.averageStance })}${importanceAvailable ? `, ${formatPercent(Number(topic.importanceShare || 0))} of allocated importance` : ''}`)}"
      title="${escapeHtml(`${label}: ${topic.questionCount || 0} questions, ${scoreLabel({ meanScore: topic.averageStance })}${importanceAvailable ? `, ${formatPercent(Number(topic.importanceShare || 0))} of allocated importance` : ''}`)}"
    >
      <div class="nodeDot packedNodeDot">
        <div class="nodeLabel packedNodeLabel alwaysVisible" style="font-size:${escapeHtml(fontSize.toFixed(1))}px;">
          ${escapeHtml(label)}
        </div>
      </div>
    </button>`;
  }).join('');
  const issueTemplates = issueAreas.map(renderAtlasIssueTemplate).join('');
  return renderModePane({
    id: 'debate-atlas',
    title: 'Debate Map',
    subtitle: importanceAvailable
      ? 'Circle prominence reflects equal-budget quadratic importance allocations from model participants'
      : 'Circle prominence currently reflects question count; quadratic importance allocations can replace this fallback',
    className: 'aidb-debate-atlas-pane',
    body: `<div class="aidb-debate-map-scroll-shell">
      <div class="debateMapWrapper embeddedAtlas aidb-debate-map-embed">
        <div class="debateMap">
          <div class="controls">
            <div class="primaryControls">
              <div class="viewModeSwitch" aria-label="Debate map view mode">
                <button type="button" data-testid="ce-debate-view-mode" data-ce-view-mode="circles" class="active">${renderFontAwesomeIcon('circle', 'debateViewModeIcon')} Circles</button>
                <button type="button" data-testid="ce-debate-view-mode" data-ce-view-mode="list">${renderFontAwesomeIcon('list', 'debateViewModeIcon')} List</button>
                <span class="viewModeSeparator" aria-hidden="true"></span>
                <span class="inlineLegendItem"><span class="legendDot category"></span><span>Category</span></span>
                <span class="inlineLegendItem"><span class="legendDot subcategory"></span><span>Sub-Category</span></span>
                <span class="inlineLegendItem"><span class="legendDot topic"></span><span>Topic</span></span>
                <span class="inlineLegendItem"><span class="legendDot instance"></span><span>Instance</span></span>
              </div>
            </div>
            <div class="secondaryControls">
              <div class="atlasBrowseControls" aria-label="Browse issue areas">
                <div class="atlasBrowseField atlasTagFilterField">
                  <span class="atlasBrowseLabel">Tags</span>
                  <details class="atlasTagFilter" data-ce-atlas-tag-filter>
                    <summary aria-label="Filter issue areas by tags">
                      <span data-ce-atlas-tag-summary>All tags</span>
                      ${renderFontAwesomeIcon('caret-down', 'atlasTagChevron')}
                    </summary>
                    <div class="atlasTagMenu" role="group" aria-label="Select tags to match">
                      <div class="atlasTagMenuHeader">
                        <span>Match any selected</span>
                        <button type="button" data-ce-atlas-tag-clear>Clear</button>
                      </div>
                      <div class="atlasTagOptions">
                        ${tagOptions.map((tag) => {
                          const label = formatDisplayLabel(tag) || tag;
                          return `<label class="atlasTagOption"><input type="checkbox" value="${escapeHtml(tag)}" data-ce-atlas-tag-option data-ce-atlas-tag-label="${escapeHtml(label)}"><span>${escapeHtml(label)}</span></label>`;
                        }).join('')}
                      </div>
                    </div>
                  </details>
                </div>
                <label class="atlasBrowseField">Sort
                  <select data-ce-atlas-sort aria-label="Sort issue areas">
                    <option value="atlas">Atlas order</option>
                    <option value="tag">Tag</option>
                    <option value="difference-desc">Most contested</option>
                    <option value="difference-asc">Most consensus</option>
                    <option value="questions">Most questions</option>
                    ${importanceAvailable ? '<option value="importance">Most important</option>' : ''}
                    <option value="label">A-Z</option>
                  </select>
                </label>
                <span class="atlasBrowseStatus" data-ce-atlas-browser-status aria-live="polite">${escapeHtml(issueAreas.length)} issue areas</span>
              </div>
            </div>
          </div>
          <div class="nodesContainer">
            <div class="atlasViewContainer packedAtlasViewContainer">
              <button type="button" class="hotDebatesBtn" data-ce-atlas-top-debates-toggle aria-expanded="false">
                ${renderFontAwesomeIcon('fire', 'atlasChromeIcon')} Top Debates
              </button>
              <div class="topNodesOverlay" data-ce-atlas-top-debates-overlay>
                <h3>
                  <span>${renderFontAwesomeIcon('fire', 'atlasChromeIcon')} Active Debates</span>
                  <button type="button" class="minimizeBtn" data-ce-atlas-top-debates-close aria-label="Minimize active debates">
                    ${renderFontAwesomeIcon('times', 'atlasChromeIcon')}
                  </button>
                </h3>
                <div class="topNodeItems">
                  ${topDebateRows}
                </div>
              </div>
              ${nodes}
            </div>
          </div>
          ${analysisCompasses}
        </div>
      </div>
    </div>
    ${issueTemplates}
    <div class="atlasIssueModalOverlay" data-ce-atlas-issue-modal hidden role="dialog" aria-modal="true" aria-labelledby="ce-atlas-issue-modal-title">
      <div class="atlasIssueModalContent" data-ce-atlas-issue-modal-content tabindex="-1">
        <div class="atlasIssueModalHeader">
          <div class="atlasIssueModalTitleSection">
            <div>
              <h2 class="atlasIssueModalTitle" id="ce-atlas-issue-modal-title" data-ce-atlas-issue-modal-title>Issue area</h2>
            </div>
            <button type="button" class="atlasIssueModalLinkButton" data-ce-atlas-issue-copy-link aria-label="Copy issue area deep link" title="Copy deep link">
              ${renderFontAwesomeIcon('external-link-alt')}
            </button>
          </div>
          <button type="button" class="atlasIssueModalClose" data-ce-atlas-issue-close aria-label="Close issue area">
            ${renderFontAwesomeIcon('times')}
          </button>
        </div>
        <div class="atlasIssueModalBody" data-ce-atlas-issue-modal-body></div>
      </div>
    </div>`,
  });
};

const renderQuestionExplorer = (report) => {
  const questions = getQuestions(report);
  const byQuestion = report.polisReport?.byQuestion || {};
  const participantVisuals = participantVisualsForReport(report);
  const modelLegend = (report.participants || []).map((participant) => {
    const visual = participantVisuals.get(participant.id);
    const label = participant.label || participant.id;
    return `<button
      type="button"
      class="questionModelLegendItem"
      data-ce-question-model-card="${escapeHtml(participant.id)}"
      style="--atlas-model-color:${escapeHtml(visual.color)}"
      title="${escapeHtml(label)}"
      aria-label="Toggle ${escapeHtml(label)} answer highlighting"
      aria-pressed="false"
    >
      <span class="atlasIssueModelMarker" aria-hidden="true">${escapeHtml(visual.markerLabel)}</span>
      <span>${escapeHtml(participant.label || participant.id)}</span>
    </button>`;
  }).join('');
  const items = questions.map((question, index) => {
    const summary = byQuestion[question.id] || {};
    const modelAnswers = modelAnswersForQuestion(report, question.id, participantVisuals);
    const { agree, unsure, disagree, invalid } = answerTotals(summary);
    const label = `#${index + 1}`;
    const total = Number.isFinite(summary.total)
      ? summary.total
      : agree + unsure + disagree + invalid;
    const anchors = [...(question.sourceAnchors || []), ...(question.agentVillageAnchors || [])]
      .map((anchor) => anchor.idOrUrl || anchor.corpus || anchor.sourceType || '')
      .filter(Boolean)
      .join(' / ');
    return `<div
      class="questionListItem"
      data-ce-searchable
      id="question-${escapeHtml(question.id)}"
      data-question-id="${escapeHtml(question.id)}"
      data-question-reversed="${escapeHtml(question.reversedPrompt || '')}"
      data-question-axis="${escapeHtml(question.disagreementAxis || '')}"
      data-question-topic="${escapeHtml(question.topic || 'uncategorized')}"
      data-question-anchors="${escapeHtml(anchors)}"
      title="${escapeHtml(question.whyIncluded || question.prompt || question.id)}"
    >
      <div class="questionPromptLine"><span class="questionPromptLabel">${escapeHtml(label)}</span>: ${escapeHtml(question.prompt || '(No prompt)')}</div>
      <div class="questionVoteRow">
        <span class="questionVoteSummary">
          <strong>Agree:</strong> ${escapeHtml(agree)} /
          <strong>Disagree:</strong> ${escapeHtml(disagree)} /
          <strong>Unsure:</strong> ${escapeHtml(unsure)} /
          (Total: ${escapeHtml(total)})
        </span>
        ${renderAtlasQuestionDistribution(summary, modelAnswers, {
          className: 'questionModelDistribution',
          showLegend: false,
        })}
      </div>
    </div>`;
  }).join('');
  return renderCollapsibleSection({
    id: 'all-questions',
    title: 'All Questions',
    subtitle: 'Question prompts with aggregate agree, disagree, and unsure counts',
    bodyClassName: 'graphSection aidb-question-section',
    body: `<div class="questionModelLegend" aria-label="Model marker legend">${modelLegend}</div><div class="questionList">${items}</div>`,
  });
};

const renderParticipantsList = (report) => {
  const participantVisuals = participantVisualsForReport(report);
  const items = (report.participants || []).map((participant, index) => {
    const traits = participant.traits || {};
    const visual = participantVisuals.get(participant.id);
    const details = [
      participant.model,
      traits.parameterClass,
      traits.ossStatus,
      traits.countryOfOrigin,
      traits.providerClass,
    ].filter(Boolean).join(' / ');
    const title = details || participant.label || participant.id;
    return `<div class="participantListItem" data-ce-searchable title="${escapeHtml(title)}">
      <span class="showWhenPdf participantIndex">${index + 1}.</span>
      <img src="${escapeHtml(modelBlockieDataUrl(participant.id || participant.label))}" alt="" width="24" height="24" class="participantBlockie">
      <span
        class="participantModelNumber"
        style="--participant-model-color:${escapeHtml(visual.color)}"
        title="Model marker ${escapeHtml(visual.markerLabel)}"
        aria-label="Model marker ${escapeHtml(visual.markerLabel)}"
      >${escapeHtml(visual.markerLabel)}</span>
      <span class="participantAddressLink">
        <span class="participantAddressFull">${escapeHtml(participant.label || participant.id)}</span>
        <span class="participantAddressShort">${escapeHtml(participant.id)}</span>
      </span>
    </div>`;
  }).join('');
  return renderCollapsibleSection({
    id: 'participants-list',
    title: 'List of Participants',
    subtitle: 'The participant list is the set of benchmarked models',
    bodyClassName: 'graphSection aidb-participants-list-section',
    body: `<div class="participantsList">${items}</div>`,
  });
};

const renderSnapshotJson = (report) => {
  const ceExport = buildContextEnginePolisExport(report);
  const analysisInput = buildSecondPassAnalysisInput(report);
  const renderedDebateTopics = normalizeAnalysisTopicCircles(report);
  const sectionRows = [
    ['report', 'Report', 'Available', `${report.counts?.questions || 0} statements / ${report.counts?.models || 0} participants`],
    ['debate-atlas', 'Debate Map', 'Available', `${renderedDebateTopics.length} topic circles`],
    ['breakdown', 'Breakdown', 'Available', `${Object.keys(report.breakdown || {}).length} model trait dimensions`],
    ['risk-matrix', 'Risk Matrix', 'Available', `${report.riskMatrix?.facets?.length || 0} risk facets`],
    ['snapshot-json', 'Snapshot JSON', 'Available', 'Embedded inert report snapshot'],
    ['ce-polis-export', 'CE Import JSON', 'Available', `${ceExport.counts?.responses || 0} averaged model responses`],
    ['ai-analysis-input', 'AI Analysis Input', 'Available', `${analysisInput.riskMatrix?.aggregateCellTargets?.length || 0} matrix targets / ${analysisInput.questions?.length || 0} questions`],
  ];
  const sectionTableRows = sectionRows.map(([key, label, availability, why]) => `<tr data-ce-searchable>
    <td><input type="checkbox" checked disabled aria-label="Include ${escapeHtml(label)}"></td>
    <td>${escapeHtml(label)}</td>
    <td>${escapeHtml(availability)}</td>
    <td>${escapeHtml(why)}</td>
  </tr>`).join('');
  return renderModePane({
    id: 'snapshot-json',
    title: 'Raw Results',
    subtitle: 'Inert embedded snapshot JSON for reproducibility',
    className: 'aidb-raw-results-modal-pane',
    bodyClassName: 'graphSection aidb-json-section',
    body: `<div class="modal-dialog resultsModal aidb-raw-results-dialog" role="document">
      <div class="modal-content aidb-raw-results-surface">
      <section class="modal-header modalHeader">
        <div class="modalHeaderContent">
          <div class="modalHeaderTitleBlock">
            <h2 class="modalTitle">Question Results</h2>
          </div>
        </div>
        <div class="modalHeaderControls">
          <div class="demoResultsViewNav" aria-label="Demo results views" data-testid="ce-surveyresults-demo-view-nav">
            <button type="button" class="demoResultsViewButton demoResultsViewButtonActive" aria-pressed="true" data-ce-raw-demo-view="report" data-testid="ce-surveyresults-demo-view-report">Report</button>
            <button type="button" class="demoResultsViewButton" aria-pressed="false" data-ce-raw-demo-view="debate-atlas" data-testid="ce-surveyresults-demo-view-atlas">Debate Map</button>
            <button type="button" class="demoResultsViewButton" aria-pressed="false" data-ce-raw-demo-view="breakdown" data-testid="ce-surveyresults-demo-view-breakdown">Breakdown</button>
            <button type="button" class="demoResultsViewButton" aria-pressed="false" data-ce-raw-demo-view="risk-matrix" data-testid="ce-surveyresults-demo-view-riskMatrix">Risk Matrix</button>
          </div>
        </div>
        <button type="button" class="close htmlReportCloseButton rawResultsCloseButton" data-ce-close-raw-results aria-label="Close">
          <span aria-hidden="true">&times;</span>
        </button>
      </section>
      <section class="modal-body modalBody aidb-raw-results-modal-body">
        <div class="htmlReportInfo">Context Engine import data is embedded separately from the benchmark snapshot so model participants can be rendered through native results tooling.</div>
        <div class="exportDataBox aidb-raw-export-box" data-ce-export-data-box>
          <button type="button" class="exportToggleButton" aria-expanded="false" aria-controls="surveyResultsExportArea" data-ce-export-toggle>Export Data</button>
          <div class="exportAreaExpanded" id="surveyResultsExportArea" hidden>
            <div class="exportAreaHeader">
              <label for="exportType" class="exportLabel">Export Data:</label>
              <button type="button" class="exportCollapseButton" aria-label="Collapse export area" data-ce-export-toggle>${renderFontAwesomeIcon('caret-up', 'exportCollapseIcon')}</button>
            </div>
            <div id="exportOptions">
              <button type="button" id="exportType" class="downloadButton" data-ce-download-snapshot>Download Snapshot JSON</button>
              <button type="button" class="downloadButton" data-ce-download-polis-export>Download CE Import JSON</button>
              <button type="button" class="downloadButton" data-ce-download-analysis-input>Download AI Analysis Input</button>
            </div>
          </div>
        </div>
        <div class="table-responsive htmlReportSectionTableResponsive">
          <table class="table table-sm htmlReportSectionTable">
            <thead>
              <tr>
                <th scope="col">Include</th>
                <th scope="col">Section</th>
                <th scope="col">Availability</th>
                <th scope="col">Why</th>
              </tr>
            </thead>
            <tbody>${sectionTableRows}</tbody>
          </table>
        </div>
        <div class="aidb-raw-json-panels">
          <details class="aidb-json-details htmlReportJsonDetails rawResultsJsonDetails">
            <summary>Embedded Snapshot JSON</summary>
            <div class="jsonContainer"><pre class="jsonDisplay">${escapeHtml(JSON.stringify(report, null, 2))}</pre></div>
          </details>
          <details class="aidb-json-details htmlReportJsonDetails rawResultsJsonDetails">
            <summary>Context Engine Polis Import JSON</summary>
            <div class="jsonContainer"><pre class="jsonDisplay">${escapeHtml(JSON.stringify(ceExport, null, 2))}</pre></div>
          </details>
          <details class="aidb-json-details htmlReportJsonDetails rawResultsJsonDetails">
            <summary>AI Analysis Input JSON</summary>
            <div class="jsonContainer"><pre class="jsonDisplay">${escapeHtml(JSON.stringify(analysisInput, null, 2))}</pre></div>
          </details>
          <details class="aidb-json-details htmlReportJsonDetails rawResultsJsonDetails">
            <summary>Raw Material JSON</summary>
            <div class="jsonContainer"><pre class="jsonDisplay">${escapeHtml(JSON.stringify(report.rawMaterial || {}, null, 2))}</pre></div>
          </details>
        </div>
        <div class="htmlReportWarning">This report embeds aggregate benchmark data, not raw provider responses. Keep the separate run artifact for answer-level audit and reproducibility.</div>
      </section>
      <section class="modal-footer aidb-raw-results-footer"></section>
      </div>`,
  });
};

const serializeJsonForHtmlScript = (value) => (
  (JSON.stringify(value, null, 2) || 'null')
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/&/g, '\\u0026')
);

export const renderHtmlReport = (report) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="${escapeHtml(benchmarkPublicationDescription(report))}" />
  <meta name="robots" content="${report.integrity?.releaseReady === true ? 'index,follow' : 'noindex,nofollow'}" />
  <meta name="theme-color" content="#20204e" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(BENCHMARK_PUBLIC_TITLE)}" />
  <meta property="og:description" content="${escapeHtml(benchmarkPublicationDescription(report))}" />
  <title>${escapeHtml(BENCHMARK_PUBLIC_TITLE)} - Results Report</title>
  <link href="https://fonts.googleapis.com/css?family=Poppins:200,300,400,600,700,800" rel="stylesheet" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,500;1,500;1,600&display=swap" rel="stylesheet">
  <style>
    :root {
      color-scheme: light;
      --ink:#111827;
      --muted:#667085;
      --line:#d7dde5;
      --bg:#f7f8fb;
      --panel:#ffffff;
      --agree:#149488;
      --disagree:#e85b43;
      --unsure:#cbd5e1;
      --invalid:#111827;
      --blue:#5e72e4;
      --indigo:#5603ad;
      --purple:#8965e0;
      --pink:#f3a4b5;
      --red:#f5365c;
      --orange:#fb6340;
      --yellow:#ffd600;
      --green:#2dce89;
      --teal:#11cdef;
      --cyan:#2bffc6;
      --white:#ffffff;
      --gray:#6c757d;
      --gray-dark:#32325d;
      --light:#adb5bd;
      --lighter:#e9ecef;
      --primary:#e14eca;
      --secondary:#f4f5f7;
      --success:#00f2c3;
      --info:#1d8cf8;
      --warning:#ff8d72;
      --danger:#fd5d93;
      --dark:#212529;
      --default:#344675;
      --neutral:#ffffff;
      --darker:black;
      --breakpoint-xs:0;
      --breakpoint-sm:576px;
      --breakpoint-md:768px;
      --breakpoint-lg:992px;
      --breakpoint-xl:1200px;
      --font-family-sans-serif:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
      --font-family-monospace:SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
      --ce-color-white:#fff;
      --ce-color-black:#000;
      --ce-color-text:#525f7f;
      --ce-color-text-muted:#6c757d;
      --ce-color-bg:#20204e;
      --ce-color-surface:#1f2251;
      --ce-color-surface-alt:#272b65;
      --ce-color-surface-light:#f8f9fa;
      --ce-color-dark:#212529;
      --ce-color-light:#e9ecef;
      --ce-color-border:#333333;
      --ce-color-border-light:#cccccc;
      --ce-color-tooltip-bg:rgba(15, 18, 34, 0.95);
      --ce-color-tooltip-border:rgba(255, 255, 255, 0.16);
      --ce-color-tooltip-text:#f4f7ff;
      --ce-color-tooltip-muted:rgba(244, 247, 255, 0.7);
      --ce-color-panel-bg:#171941;
      --ce-color-panel-text:#f4f7ff;
      --ce-color-panel-text-muted:rgba(244, 247, 255, 0.65);
      --ce-color-card-bg:rgba(255, 255, 255, 0.06);
      --ce-color-card-border:rgba(255, 255, 255, 0.14);
      --ce-shadow-card:0 6px 22px rgba(0, 0, 0, 0.25);
      --ce-color-input-bg:rgba(255, 255, 255, 0.08);
      --ce-color-input-border:rgba(255, 255, 255, 0.16);
      --ce-color-input-border-strong:rgba(255, 255, 255, 0.18);
      --ce-color-error:#ff4757;
      --ce-color-primary:#e14eca;
      --ce-color-primary-hover:#c221a9;
      --ce-color-info:#1d8cf8;
      --ce-color-success:#2dce89;
      --ce-color-success-bright:#00f2c3;
      --ce-color-warning:#ff8d72;
      --ce-color-danger:#fd5d93;
      --ce-color-orange:#fb6340;
      --ce-color-indigo:#5e72e4;
      --ce-color-indigo-hover:#324cdd;
      --ce-color-blue:#3358f4;
      --ce-color-yellow:#ffd600;
      --ce-color-pink:#ff6491;
      --ce-color-purple:#ba54f5;
      --ce-color-cyan:#0098f0;
      --ce-color-accent:#4dffa4;
      --ce-color-accent-hover:#1aff8a;
      --ce-color-info-soft:#89cff0;
      --ce-color-success-soft:#d4edda;
      --ce-color-success-soft-hover:#c3e6cb;
      --ce-color-warning-soft:#fff3cd;
      --ce-color-warning-soft-hover:#ffeeba;
      --ce-radius-0:0px;
      --ce-radius-2:2px;
      --ce-radius-3:3px;
      --ce-radius-4:4px;
      --ce-radius-5:5px;
      --ce-radius-6:6px;
      --ce-radius-7:7px;
      --ce-radius-8:8px;
      --ce-radius-10:10px;
      --ce-radius-12:12px;
      --ce-radius-14:14px;
      --ce-radius-15:15px;
      --ce-radius-16:16px;
      --ce-radius-20:20px;
      --ce-radius-pill:999px;
      --ce-radius-round:50%;
      --ce-card-bg:rgba(22, 26, 60, 0.78);
      --ce-card-border:rgba(255, 255, 255, 0.08);
      --ce-card-shadow:0 16px 40px rgba(3, 5, 18, 0.24);
      --ce-font-body:"Poppins", sans-serif;
      --ce-font-ui:"Open Sans", sans-serif;
      --ce-font-mono:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      --ce-font-button:"Poppins", sans-serif;
    }
    *,
    *::before,
    *::after { box-sizing: border-box; }
    html { font-family: sans-serif; line-height: 1.15; -webkit-text-size-adjust: 100%; -webkit-tap-highlight-color: rgba(34, 42, 66, 0); scrollbar-gutter: stable; scroll-behavior: smooth; }
    article, aside, figcaption, figure, footer, header, hgroup, main, nav, section { display: block; }
    body { margin: 0; font-family: var(--ce-font-body); font-size: 0.875rem; font-weight: 400; line-height: 1.5; color: var(--ce-color-text); text-align: left; background-color: var(--ce-color-bg); }
    .index-page { background-image: none; }
    #root { padding-right: 2%; padding-left: 2%; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px clamp(10px, 2.4vw, 28px) 76px; }
    .onePageDemoContainer { font-family: var(--ce-font-body); font-size: 1rem; line-height: 1.6; color: #1a1a1a; padding: 20px; padding-top: 0 !important; }
    h1, h2, h3, h4, h5, h6 { margin-top: 0; margin-bottom: 0.5rem; }
    p { margin-top: 0; margin-bottom: 1rem; }
    ol, ul, dl { margin-top: 0; margin-bottom: 1rem; }
    ol ol, ul ul, ol ul, ul ol { margin-bottom: 0; }
    dt { font-weight: 600; }
    dd { margin-bottom: 0.5rem; margin-left: 0; }
    b, strong { font-weight: bolder; }
    small { font-size: 80%; }
    a { color: var(--ce-color-primary); text-decoration: none; background-color: transparent; }
    a:hover { color: var(--ce-color-primary-hover); text-decoration: none; }
    nav { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
    nav a { border: 1px solid #aab5c8; border-radius: 8px; background: #fff; color: #10233f; padding: 6px 10px; text-decoration: none; font-weight: 700; }
    button { border-radius: var(--ce-radius-0); }
    button:focus { outline: 1px dotted; outline: 5px auto -webkit-focus-ring-color; }
    input, button, select, optgroup, textarea { margin: 0; font-family: inherit; font-size: inherit; line-height: inherit; }
    button, input { overflow: visible; }
    button, select { text-transform: none; }
    select { word-wrap: normal; }
    button, [type='button'], [type='reset'], [type='submit'] { -webkit-appearance: button; }
    button:not(:disabled), [type='button']:not(:disabled), [type='reset']:not(:disabled), [type='submit']:not(:disabled) { cursor: pointer; }
    button::-moz-focus-inner, [type='button']::-moz-focus-inner, [type='reset']::-moz-focus-inner, [type='submit']::-moz-focus-inner { padding: 0; border-style: none; }
    input[type='radio'], input[type='checkbox'] { box-sizing: border-box; padding: 0; }
    table { border-collapse: collapse; }
    th { text-align: inherit; }
    label { display: inline-block; margin-bottom: 0.5rem; }
    input[type="search"] { width: min(100%, 420px); border: 1px solid #aab5c8; border-radius: var(--ce-radius-4); padding: 6px 8px; font: inherit; }
    .aidb-matrix-table { width: 100%; border-collapse: collapse; margin-top: 16px; background: #fff; font-size: 13px; }
    .aidb-matrix-table th, .aidb-matrix-table td { border-bottom: 1px solid #e3e7ef; padding: 10px 12px; text-align: left; vertical-align: top; }
    .aidb-matrix-table th { background: #edf2f7; color: var(--ce-color-border); font-weight: 800; }
    .aidb-matrix-table td:nth-child(n+3), .aidb-matrix-table th:nth-child(n+3) { text-align: center; }
    pre { overflow: auto; background: #101828; color: #f4f7fb; border-radius: 8px; padding: 14px; }
    .aidb-similarity-details, .htmlReportJsonDetails { border: 1px solid #d9dee8; border-radius: 8px; background: #fff; padding: 10px 12px; margin: 10px 0; }
    .aidb-similarity-details > summary, .htmlReportJsonDetails > summary { cursor: pointer; font-weight: 700; }
    svg { overflow: hidden; vertical-align: middle; }
    .svg-inline--fa { display: inline-block; height: 1em; overflow: visible; vertical-align: -0.125em; }
    .participantSvg, .aidb-world-map-svg { display: block; width: 100%; height: auto; }
    .participantSvg text { font-size: 15px; font-weight: 700; fill: #111827; }
    .participantSvg text.small { font-size: 11px; font-weight: 600; fill: #475467; }
    .ce-report-section { min-width: 0; }
    .ce-report-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 18px 0; }
    .ce-report-stats div { border: 1px solid #d9dee8; border-radius: 8px; padding: 12px; background: #fbfcfe; }
    .ce-report-stats dt { color: #5b6472; font-size: 0.86rem; }
    .ce-report-stats dd { margin: 4px 0 0; font-size: 1.35rem; font-weight: 800; }
    .ce-report-muted { color: #6b7280; font-size: 0.86rem; margin-top: 4px; overflow-wrap: anywhere; }
    .ce-report-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 0; }
    .ce-session-results-section { grid-column: 1 / -1; box-sizing: border-box; width: 100%; max-width: 100%; min-width: 0; margin-bottom: 20px; margin-top: 20px; background-color: #5c58a630; border: 0 solid #af95db; padding: 20px; border-radius: var(--ce-radius-6); }
    .ce-session-results-section > .sectionHeaderRow { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; flex-wrap: wrap; max-width: 100%; min-width: 0; }
    .ce-session-results-section > .sectionHeaderRow > .sectionHeader { display: flex; flex-direction: row; align-items: flex-start; flex-wrap: wrap; gap: 10px; cursor: pointer; font-size: 2rem; margin: 0; font-weight: bold; color: rgba(255, 255, 255, 0.75); flex: 0 1 auto; min-width: 0; line-height: 1.1; }
    .ce-session-results-section > .sectionHeaderRow > .sectionHeader .sectionHeaderText { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 6px; min-width: 0; }
    .sectionHeaderTitle { display: block; max-width: 100%; line-height: 1; color: rgba(255, 255, 255, 0.5); }
    .sectionHeaderSubtitle { display: block; max-width: 100%; font-size: 0.63em; line-height: 1.12; font-weight: 600; color: rgba(255, 255, 255, 0.25); }
    .tooltip { position: relative; display: inline-block; cursor: pointer; font-size: 1.4em; z-index: 1000; opacity: 1; }
    .tooltip > svg { color: rgba(255, 255, 255, 0.75); opacity: 0.1; transition: opacity 0.25s ease; }
    .tooltip:hover > svg,
    .tooltip:focus-within > svg,
    .tooltip:focus > svg { opacity: 0.55; }
    .tooltip .tooltiptext { visibility: hidden; width: 250px; background-color: var(--ce-color-tooltip-bg) !important; color: var(--ce-color-tooltip-text) !important; text-align: left; border-radius: var(--ce-radius-6); padding: 12px; position: absolute; z-index: 99999 !important; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 10px; opacity: 0; transition: opacity 0.3s; font-size: 1rem; line-height: 1.4; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5); pointer-events: none; }
    .tooltip .tooltiptext::after { content: ""; position: absolute; bottom: 100%; left: 50%; margin-left: -5px; border-width: 5px; border-style: solid; border-color: transparent transparent var(--ce-color-tooltip-bg) transparent; }
    .tooltip:hover .tooltiptext,
    .tooltip:focus-within .tooltiptext,
    .tooltip:focus .tooltiptext { visibility: visible; opacity: 1 !important; }
    .ce-session-results-section > .sectionHeaderRow > .sectionHeader .tooltip .tooltiptext { left: 50%; right: auto; transform: translateX(-50%); text-align: left; }
    @media only screen and (max-width: 600px) {
      .ce-session-results-section > .sectionHeaderRow > .sectionHeader .tooltip .tooltiptext { left: auto; right: -10px; transform: none; text-align: left; }
      .ce-session-results-section > .sectionHeaderRow > .sectionHeader .tooltip .tooltiptext::after { left: auto; right: 15px; margin-left: 0; }
    }
    .sectionHeaderTooltip { margin-left: 6px; margin-top: 2px; align-self: flex-start; flex: 0 0 auto; }
    .sectionHeaderActionsScroller { box-sizing: border-box; display: flex; flex: 1 1 320px; justify-content: flex-end; max-width: 100%; min-width: 0; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; }
    .sectionHeaderActions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: nowrap; min-width: max-content; }
    .sectionContainer { box-sizing: border-box; max-width: 100%; min-width: 0; margin-bottom: 20px; margin-top: 20px; background-color: #5c58a630; border: 0 solid #af95db; padding: 20px; border-radius: var(--ce-radius-6); }
    .sectionExpanded { max-width: 100%; }
    .sectionsGrid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 12px; max-width: 100%; min-width: 0; }
    .aidb-benchmark-intro { grid-column: 1 / -1; min-width: 0; margin: 0 0 4px; padding: 8px 10px 24px; color: var(--ce-color-panel-text); }
    .aidb-benchmark-intro h1 { margin: 0; color: #ffffff; font-size: 2rem; line-height: 1.2; overflow-wrap: anywhere; }
    .aidb-benchmark-lead { max-width: 82ch; margin: 18px 0 10px; color: #f4f7ff; font-size: 1.05rem; line-height: 1.65; }
    .aidb-benchmark-facts { display: grid; grid-template-columns: minmax(5.5rem, 0.55fr) minmax(8rem, 0.78fr) minmax(13rem, 1.25fr) minmax(19.75rem, 1.65fr); margin: 20px 0 0; border-top: 1px solid rgba(255, 255, 255, 0.13); }
    .aidb-benchmark-facts > div { display: flex; flex-direction: column; justify-content: center; min-width: 0; min-height: 112px; padding: 13px 14px; border-left: 1px solid rgba(255, 255, 255, 0.13); }
    .aidb-benchmark-facts > div:first-child { border-left: 0; }
    .aidb-benchmark-facts dt { display: flex; align-items: center; gap: 6px; color: rgba(244, 247, 255, 0.64); font-family: var(--ce-font-ui); font-size: 0.82rem; font-weight: 700; line-height: 1.25; text-transform: uppercase; }
    .aidb-benchmark-facts dd { margin: 6px 0 0; color: #ffffff; font-size: 1.08rem; font-weight: 650; line-height: 1.35; overflow-wrap: anywhere; }
    .aidb-benchmark-fact-number { align-items: center; text-align: center; }
    .aidb-benchmark-fact-number dt { width: 100%; justify-content: center; }
    .aidb-benchmark-fact-number dd { margin-top: 9px; font-family: var(--ce-font-body); font-size: 2rem; font-variant-numeric: tabular-nums; font-weight: 700; line-height: 1; }
    .aidb-benchmark-topic-fact label { margin: 0; color: inherit; font: inherit; text-transform: inherit; }
    .aidb-benchmark-topic-fact select { box-sizing: border-box; width: 100%; min-width: 0; min-height: 40px; padding: 8px 34px 8px 10px; border: 1px solid rgba(255, 255, 255, 0.24); border-radius: 4px; background-color: rgba(255, 255, 255, 0.07); color: #ffffff; color-scheme: dark; font: inherit; font-weight: 650; cursor: pointer; }
    .aidb-benchmark-topic-fact select:focus-visible { border-color: #4dffa4; outline: 2px solid rgba(77, 255, 164, 0.55); outline-offset: 2px; }
    .aidb-benchmark-fact-tooltip { padding: 0; border: 0; background: transparent; color: inherit; font-size: 1em; line-height: 1; text-transform: none; vertical-align: middle; box-shadow: none; }
    .aidb-benchmark-fact-tooltip:hover,
    .aidb-benchmark-fact-tooltip:focus { background: transparent; box-shadow: none; }
    .aidb-benchmark-fact-tooltip:focus-visible { outline: 2px solid #4dffa4; outline-offset: 2px; }
    .aidb-benchmark-fact-tooltip > svg { width: 1em; height: 1em; color: rgba(244, 247, 255, 0.7); opacity: 0.8; }
    .aidb-benchmark-fact-tooltip:hover > svg,
    .aidb-benchmark-fact-tooltip:focus > svg,
    .aidb-benchmark-fact-tooltip:focus-within > svg { opacity: 1; }
    .aidb-benchmark-fact-tooltip .tooltiptext { font-family: var(--ce-font-body); font-weight: 400; text-transform: none; }
    .aidb-benchmark-provenance { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 12px; margin: 0 0 10px; color: rgba(244, 247, 255, 0.52); font-family: var(--ce-font-mono); font-size: 0.76rem; overflow-wrap: anywhere; }
    .aidb-benchmark-technical-name { color: rgba(244, 247, 255, 0.82); font-weight: 700; }
    @media (min-width: 768px) {
      .sectionsGrid { grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: start; }
      .sectionsGridTwoUp { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .sectionsGrid .sectionExpanded { grid-column: 1 / -1; }
    }
    @media (min-width: 1367px) {
      .sectionsGrid { margin-top: 60px; }
    }
    .resultsModeActionsScroller { min-width: 0; padding-block: 6px; margin-block: -6px; }
    .resultsModeActions { min-width: max-content; }
    .sectionHeaderViewModeButton { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 50px; min-width: 138px; padding: 10px 20px; background: linear-gradient(180deg, rgba(82, 78, 149, 0.72) 0%, rgba(50, 46, 102, 0.9) 100%); color: rgba(255, 255, 255, 0.98); font-size: 0.98rem; font-weight: 700; line-height: 1.05; letter-spacing: 0.01em; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 999px; cursor: pointer; white-space: nowrap; box-shadow: 0 10px 24px rgba(11, 13, 34, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.08); transition: transform 0.14s ease, background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease; }
    .sectionHeaderViewModeButton:hover,
    .sectionHeaderViewModeButton:focus-visible { background: linear-gradient(180deg, rgba(100, 95, 176, 0.82) 0%, rgba(63, 58, 127, 0.94) 100%); border-color: rgba(255, 255, 255, 0.36); color: var(--ce-color-white); transform: translateY(-1px); box-shadow: 0 14px 30px rgba(12, 14, 38, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.12); outline: none; }
    .sectionHeaderViewModeIcon { display: inline-flex; align-items: center; justify-content: center; font-size: 1.1rem; line-height: 1; }
    .sectionHeaderViewModeLabel { display: inline-flex; align-items: center; }
    .sectionHeaderViewModeButtonActive,
    .sectionHeaderViewModeButtonActive:hover,
    .sectionHeaderViewModeButtonActive:focus-visible { background: linear-gradient(135deg, rgba(77, 255, 164, 0.24) 0%, rgba(94, 137, 255, 0.3) 54%, rgba(255, 255, 255, 0.2) 100%); border-color: rgba(77, 255, 164, 0.7); color: var(--ce-color-white); box-shadow: 0 0 0 1px rgba(77, 255, 164, 0.28), 0 16px 32px rgba(10, 18, 44, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.18); text-shadow: 0 1px 10px rgba(0, 0, 0, 0.18); transform: translateY(-1px); }
    .sectionToggleIcon { font-size: 1.5em; margin-right: 10px; }
    .sectionToggleIconClosed { display: none; }
    .ce-session-results-section[data-ce-results-open="false"] .sectionToggleIconOpen { display: none; }
    .ce-session-results-section[data-ce-results-open="false"] .sectionToggleIconClosed { display: inline-block; }
    .ce-session-results-section[data-ce-results-open="false"] .sectionHeaderTooltip { display: none; }
    .ce-session-results-section[data-ce-results-open="false"] .resultsModeActionsScroller,
    .ce-session-results-section[data-ce-results-open="false"] .miniSectionContent { display: none; }
    .miniSectionContent { box-sizing: border-box; margin-top: 15px; max-width: 100%; min-width: 0; overflow-x: auto; background: transparent; padding: 15px; border-radius: var(--ce-radius-4); }
    .ce-polis-report-shell { margin-top: 20px; border: 1px solid #ddd; padding: 10px; position: relative; background: #fafafa; width: 100%; max-width: 100vw; overflow-x: scroll; }
    .polisReportModern { background: radial-gradient(900px 600px at 5% 0%, rgba(122, 160, 255, 0.2), transparent 60%), radial-gradient(700px 500px at 95% 8%, rgba(255, 180, 220, 0.18), transparent 55%), #f4f6ff; border: none; border-radius: var(--ce-radius-6); box-shadow: 0 18px 32px rgba(15, 23, 42, 0.1); color: #1f2a44; }
    .polisReportDark { background: radial-gradient(1000px 700px at 5% 0%, rgba(80, 110, 255, 0.18), transparent 60%), radial-gradient(700px 500px at 95% 10%, rgba(120, 90, 200, 0.18), transparent 55%), #0b1020; border: 1px solid #1f2937; border-radius: var(--ce-radius-6); box-shadow: 0 18px 40px rgba(3, 6, 14, 0.6); color: #e5e7eb; color-scheme: dark; }
    body:not([data-ce-results-view-mode="report"]) .ce-polis-report-shell { display: none; }
    .reportInner { background: #fff; padding: 20px; }
    .reportInnerModern { background: rgba(255, 255, 255, 0.95); border: none; border-radius: var(--ce-radius-6); padding: 24px; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08); }
    .reportInnerDark { background: #0b1120; border: 1px solid #1f2937; border-radius: var(--ce-radius-6); padding: 24px; box-shadow: 0 18px 36px rgba(3, 6, 14, 0.6); }
    .settingsRow { margin-bottom: 10px; display: flex; flex-direction: row; justify-content: space-between; align-items: center; background: #8080805e; padding: 10px; }
    .demoToggleLabel { font-size: 0.9rem; color: #555; cursor: pointer; }
    .demoToggleCheckbox { margin-right: 5px; cursor: pointer; }
    .heading { font-size: 1.4rem; margin-bottom: 10px; color: var(--ce-color-border); }
    .disclaimerBox { border: 1px solid var(--ce-color-border-light); background: #ffffe0; padding: 8px; margin-bottom: 12px; font-size: 0.9rem; }
    .noData { font-style: italic; color: #666; }
    .reportStyleSelect { padding: 4px 10px; border: 1px solid var(--ce-color-border-light); border-radius: var(--ce-radius-4); background: var(--ce-color-white); color: var(--ce-color-border); }
    .brandingHeader { margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee; text-align: center; }
    body:not([data-ce-results-view-mode="report"]) [data-ce-report-settings-toggle-row],
    body:not([data-ce-results-view-mode="report"]) .settingsRow,
    body:not([data-ce-results-view-mode="report"]) .brandingHeader { display: none; }
    .sessionInfo { opacity: 0.5; color: #2429b5; margin-top: 5px; font-size: 1.15em; font-weight: 600; }
    .polisReportModern .settingsRow { background: rgba(255, 255, 255, 0.95); border: none; border-radius: var(--ce-radius-6); box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08); justify-content: flex-start; gap: 12px; flex-wrap: wrap; }
    .polisReportModern .sessionInfo { color: #5a6aa3; opacity: 0.9; }
    .polisReportModern .demoToggleLabel { color: #3f4b6b; }
    .polisReportModern .reportStyleSelect { background: var(--ce-color-white); color: #1f2a44; border: 1px solid #dbe2f4; box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08); }
    .polisReportModern .heading { font-size: 1.55rem; letter-spacing: 0.2px; color: #1f2a44; }
    .polisReportModern .disclaimerBox { background: #fff8df; border: none; color: #6c5a24; box-shadow: 0 2px 10px rgba(15, 23, 42, 0.08); }
    .polisReportModern .statsSection { background: var(--ce-color-white); border: none; border-radius: var(--ce-radius-6); box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08); }
    .polisReportModern .statLabel, .polisReportModern .statValue { color: #2a3556; }
    .polisReportModern .sectionCollapse { background: var(--ce-color-white); border: none; border-radius: var(--ce-radius-6); padding: 12px 14px; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08); box-sizing: border-box; }
    .polisReportModern .sectionHeaderRow { padding-bottom: 8px; border-bottom: 1px solid #edf0fb; margin-bottom: 10px; }
    .polisReportModern .sectionHeader, .polisReportModern .sectionTitle, .polisReportModern .aidb-view-section .sectionHeader, .polisReportModern .aidb-view-section .sectionTitle { font-weight: 700; color: #1f2a44; }
    .polisReportModern .graphSection { gap: 16px; }
    .polisReportModern .graphItem { background: var(--ce-color-white); border: none; border-radius: var(--ce-radius-6); padding: 12px; box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08); box-sizing: border-box; }
    .polisReportModern .participantSvg, .polisReportModern .beeswarmSvg { border-radius: var(--ce-radius-6); border: none; background: var(--ce-color-white); }
    .polisReportModern .participantGraphControls { background: #f6f8ff; border: none; border-radius: var(--ce-radius-6); padding: 10px 12px; }
    .polisReportModern .participantListItem { border: none; background: var(--ce-color-white); box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08); }
    .polisReportModern .participantAddressLink { color: #2b3758; }
    .polisReportModern .tooltipIcon { color: #5a6aa3; }
    .polisReportModern .beeTooltip { background: var(--ce-color-white); border: none; color: #2b3758; box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12); }
    .polisReportModern .scrollButton { background: #eef2ff; border: none; color: #2b3758; }
    .polisReportModern .polisBoxPlotSvg { border: 1px solid #e4e9f7; }
    .polisReportModern button { background: #f4f6ff; color: #2b3758; border: none; box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08); }
    .polisReportDark .settingsRow { background: #0f172a; border: 1px solid #1f2937; border-radius: var(--ce-radius-6); box-shadow: 0 10px 24px rgba(3, 6, 14, 0.55); justify-content: flex-start; gap: 12px; flex-wrap: wrap; }
    .polisReportDark .sessionInfo { color: #9aa4bf; opacity: 0.9; }
    .polisReportDark .demoToggleLabel { color: #c1c7db; }
    .polisReportDark .reportStyleSelect { background: #111827; color: #e5e7eb; border: 1px solid #2b3446; }
    .polisReportDark .heading { font-size: 1.55rem; letter-spacing: 0.2px; color: #f3f4f6; }
    .polisReportDark .disclaimerBox { background: rgba(255, 235, 150, 0.12); border: 1px solid rgba(255, 235, 150, 0.3); color: #f3e7bf; }
    .polisReportDark .statsSection { background: #0f172a; border: 1px solid #1f2937; border-radius: var(--ce-radius-6); box-shadow: 0 10px 22px rgba(3, 6, 14, 0.55); }
    .polisReportDark .statLabel, .polisReportDark .statValue { color: #d1d5db; }
    .polisReportDark .sectionCollapse { background: #0f172a; border: 1px solid #1f2937; border-radius: var(--ce-radius-6); padding: 12px 14px; box-shadow: 0 12px 26px rgba(3, 6, 14, 0.55); box-sizing: border-box; }
    .polisReportDark .sectionHeaderRow { padding-bottom: 8px; border-bottom: 1px solid #1f2937; margin-bottom: 10px; }
    .polisReportDark .sectionHeader, .polisReportDark .sectionTitle, .polisReportDark .aidb-view-section .sectionHeader, .polisReportDark .aidb-view-section .sectionTitle { font-weight: 700; color: #f3f4f6; }
    .polisReportDark .graphSection { gap: 16px; }
    .polisReportDark .graphItem { background: #0f172a; border: 1px solid #1f2937; border-radius: var(--ce-radius-6); padding: 12px; box-shadow: 0 10px 22px rgba(3, 6, 14, 0.55); box-sizing: border-box; }
    .polisReportDark .participantSvg, .polisReportDark .beeswarmSvg { border-radius: var(--ce-radius-6); border: 1px solid #2b3446; background: #1f2937; }
    .polisReportDark .participantSvg text, .polisReportDark .beeswarmSvg text { fill: #e5e7eb; }
    .polisReportDark .participantSvg line, .polisReportDark .beeswarmSvg line { stroke: #9ca3af; }
    .polisReportDark .participantGraphControls { background: #111827; border: 1px solid #1f2937; border-radius: var(--ce-radius-6); padding: 10px 12px; }
    .polisReportDark .participantListItem { border: 1px solid #1f2937; background: #111827; box-shadow: 0 6px 14px rgba(3, 6, 14, 0.5); }
    .polisReportDark .participantAddressLink { color: #e5e7eb; }
    .polisReportDark .tooltipIcon { color: #a5b4fc; }
    .polisReportDark .beeTooltip { background: #111827; border: 1px solid #1f2937; color: #e5e7eb; box-shadow: 0 12px 24px rgba(3, 6, 14, 0.6); }
    .polisReportDark .scrollButton { background: #1f2937; border: 1px solid #2b3446; color: #e5e7eb; }
    .polisReportDark .polisBoxPlotSvg { border: 1px solid #2b3446; }
    .polisReportDark button { background: #1f2937; color: #e5e7eb; border: 1px solid #2b3446; box-shadow: 0 8px 18px rgba(3, 6, 14, 0.5); }
    .sectionCollapse { margin-bottom: 20px; }
    .aidb-view-section { padding: 0; overflow: visible; background: transparent; border: 0; border-radius: 0; box-shadow: none; }
    .aidb-native-summary { display: flex; align-items: center; justify-content: space-between; padding: 0; border: 0; list-style: none; flex-wrap: nowrap; width: 100%; }
    .aidb-native-summary::-webkit-details-marker { display: none; }
    .aidb-anchor-alias { display: block; height: 0; overflow: hidden; scroll-margin-top: 24px; }
    .ce-polis-report-shell .sectionHeaderRow { align-items: center; justify-content: space-between; }
    .aidb-summary-toggle { flex: 1 1 auto; margin-left: auto; text-align: right; align-self: center; }
    .aidb-omitted-note { margin-left: 10px; color: #555; }
    .aidb-view-section .sectionTitle { margin: 0; font-size: 1.2rem; color: var(--ce-color-border); }
    .aidb-view-section .sectionHeader { cursor: pointer; font-size: 1.4rem; margin-bottom: 10px; color: var(--ce-color-border); font-weight: 600; }
    .aidb-section-title { display: inline; min-width: 0; overflow-wrap: anywhere; }
    .aidb-section-caret { display: inline-flex; margin-right: 6px; color: inherit; font-size: 1em; line-height: 1; }
    .aidb-section-caret-icon { width: 1em; height: 1em; display: inline-block; overflow: visible; vertical-align: -0.125em; }
    .aidb-section-caret-down { display: none; }
    [data-ce-static-collapsible][data-ce-collapsible-open="false"] .aidb-section-caret-up { display: none; }
    [data-ce-static-collapsible][data-ce-collapsible-open="false"] .aidb-section-caret-down { display: inline-block; }
    .aidb-section-body { display: block; padding: 0; margin: 0; }
    .aidb-section-body.graphSection { display: flex; flex-wrap: wrap; margin-bottom: 20px; padding: 0; }
    [data-ce-static-collapsible][data-ce-collapsible-open="false"] > .aidb-section-body { display: none !important; }
    .ce-results-mode-surfaces { max-width: 100%; min-width: 0; }
    .ce-results-mode-surfaces .aidb-mode-pane { margin-top: 0; }
    .ce-results-mode-pane { scroll-margin-top: 190px; }
    .ce-polis-report-shell .sectionCollapse,
    .ce-polis-report-shell .aidb-view-section,
    .ce-polis-report-shell .questionListItem { scroll-margin-top: 24px; }
    .ce-results-mode-pane { box-sizing: border-box; display: block; max-width: 100%; min-width: 0; margin-top: 0; position: relative; background: transparent; overflow-x: visible; }
    .ce-results-mode-pane[hidden] { display: none !important; }
    .ce-report-view-mode-panel { margin-top: 0; }
    .ce-results-mode-pane > .aidb-section-body.graphSection { box-sizing: border-box; display: block; margin: 0; padding: 0; background: transparent; }
    .aidb-debate-atlas-pane,
    .aidb-demo-analysis-pane,
    .aidb-risk-matrix-pane { border: 0; padding: 0; background: transparent; overflow-x: visible; }
    .aidb-debate-atlas-pane > .aidb-section-body.graphSection,
    .aidb-demo-analysis-pane > .aidb-section-body.graphSection,
    .aidb-risk-matrix-pane > .aidb-section-body.graphSection { padding: 0; background: transparent; }
    .aidb-raw-results-modal-pane { position: fixed; inset: 0; z-index: 1050; display: flex; align-items: flex-start; justify-content: center; max-width: none; min-width: 0; margin: 0; padding: clamp(18px, 5vh, 56px) clamp(10px, 3vw, 28px); border: 0; background: rgba(15, 23, 42, 0.48); overflow-x: hidden; overflow-y: auto; scroll-margin-top: 0; }
    .aidb-raw-results-modal-pane[hidden] { display: none !important; }
    .aidb-raw-results-modal-pane > .aidb-section-body.graphSection { width: min(100%, 1120px); margin: 0 auto; padding: 0; background: transparent; }
    body[data-ce-raw-results-open="true"] { overflow: hidden; }
    .resultsModal { max-width: 80%; width: 100%; background-color: var(--ce-color-white); overflow-y: auto; display: flex; flex-direction: column; border-radius: var(--ce-radius-12); }
    .modalBody { display: flex; flex-direction: column; color: var(--ce-color-black) !important; max-width: 95vw; }
    .modalHeader { display: flex; position: relative; flex-direction: row; flex-wrap: wrap; overflow-wrap: anywhere; justify-content: space-between; align-items: center; border-bottom: 1px solid #dee2e6; padding-right: 4.5rem; padding-bottom: 1rem; border-top-left-radius: 12px; border-top-right-radius: 12px; }
    .modalHeaderContent { display: flex; flex-direction: row; flex-wrap: wrap; flex-grow: 1; margin-right: 1rem; gap: 10px; }
    .modalHeaderTitleBlock { display: flex; flex-direction: column; gap: 0.7rem; min-width: 0; }
    .modalHeaderControls { display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-wrap: wrap; margin-left: auto; }
    .modalTitle { font-size: 2.5rem; font-weight: bold; margin: 0; color: var(--ce-color-black); }
    .demoResultsViewNav { display: flex; flex-wrap: wrap; gap: 0.55rem; }
    .demoResultsViewButton { display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border: 1px solid rgba(15, 94, 199, 0.18); background: rgba(15, 94, 199, 0.08); color: #1a4e94; border-radius: var(--ce-radius-pill); padding: 0.45rem 0.85rem; font-size: 0.9rem; font-weight: 700; line-height: 1; transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease; }
    .demoResultsViewButton:hover, .demoResultsViewButton:focus { background: rgba(15, 94, 199, 0.14); border-color: rgba(15, 94, 199, 0.28); color: #0e3d79; transform: translateY(-1px); outline: none; }
    .demoResultsViewButtonActive { background: #0f5ec7; border-color: #0f5ec7; color: var(--ce-color-white); box-shadow: 0 10px 24px rgba(15, 94, 199, 0.2); }
    .demoResultsViewButtonActive:hover, .demoResultsViewButtonActive:focus { background: #0b4da6; border-color: #0b4da6; color: var(--ce-color-white); }
    .aidb-raw-results-dialog { position: relative; width: 100%; margin: 0 auto; pointer-events: none; }
    .aidb-raw-results-dialog .modal-content { pointer-events: auto; }
    .aidb-raw-results-surface { background: #fff; color: #111827; border: 1px solid rgba(15, 23, 42, 0.16); border-radius: var(--ce-radius-12); box-shadow: 0 24px 70px rgba(15, 23, 42, 0.34); overflow: hidden; opacity: 1; }
    .aidb-raw-results-modal-body { gap: 1rem; background: #fff; padding: 1rem; }
    .aidb-raw-results-footer { display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem; flex-wrap: wrap; background: #fff; border-top: 1px solid #d7dde8; padding: 14px 18px; }
    .modalHeader .close,
    .modalHeader .btn-close,
    .rawResultsCloseButton { position: absolute; top: 0.85rem; right: 0.85rem; z-index: 2; background: transparent; border: 0; box-shadow: none; color: #0f1222; opacity: 1; margin: 0; padding: 0.25rem; align-self: flex-start; }
    .modalHeader .close:hover,
    .modalHeader .close:focus,
    .modalHeader .btn-close:hover,
    .modalHeader .btn-close:focus,
    .rawResultsCloseButton:hover,
    .rawResultsCloseButton:focus { background: transparent; color: #0f1222; opacity: 1; outline: none; }
    .exportDataBox { display: flex; flex-direction: column; justify-content: center; align-items: flex-end; gap: 8px; min-width: 220px; padding: 0; }
    .exportAreaExpanded { display: flex; flex-direction: column; align-items: flex-end; width: 100%; max-width: 420px; padding: 12px 14px; border: 1px solid rgba(15, 23, 42, 0.12); border-radius: var(--ce-radius-10); background: rgba(255, 255, 255, 0.92); box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08); }
    .exportAreaExpanded[hidden] { display: none !important; }
    .exportAreaHeader { display: flex; align-items: center; justify-content: flex-end; gap: 6px; width: 100%; }
    .exportLabel { font-size: 1rem; font-weight: 600; margin-right: 1rem; color: #334155; }
    .exportToggleButton { white-space: nowrap; background: rgba(255, 255, 255, 0.92) !important; border: 1px solid rgba(15, 23, 42, 0.14) !important; box-shadow: none !important; color: #111827 !important; font-weight: 600; border-radius: var(--ce-radius-8); padding: 0.375rem 0.75rem; }
    .exportToggleButton:hover, .exportToggleButton:focus, .exportToggleButton:active { background: #ffffff !important; border-color: rgba(77, 255, 164, 0.34) !important; color: #111827 !important; outline: none; }
    .exportCollapseButton { padding: 0 !important; min-width: auto; line-height: 1; color: #334155 !important; background: transparent !important; border: 0 !important; box-shadow: none !important; opacity: 0.65; }
    .exportCollapseButton:hover, .exportCollapseButton:focus { color: #111827 !important; opacity: 1; outline: none; }
    .exportCollapseIcon { width: 1em; height: 1em; display: inline-block; overflow: visible; vertical-align: -0.125em; }
    #exportOptions { display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 10px; width: 100%; flex-wrap: wrap; }
    .downloadButton { background-color: var(--ce-color-bg) !important; background-image: none !important; border: 1px solid var(--ce-color-bg) !important; color: var(--ce-color-white) !important; font-weight: bold; border-radius: var(--ce-radius-8); padding: 6px 12px; }
    .downloadButton:hover, .downloadButton:focus { background-color: #11133b !important; border-color: #11133b !important; color: var(--ce-color-white) !important; outline: none; }
    .aidb-raw-json-panels { display: grid; gap: 0.75rem; }
    .rawResultsJsonDetails { border: 1px solid #d9dee8; border-radius: var(--ce-radius-8); background: #fff; padding: 10px 12px; margin: 0; }
    .rawResultsJsonDetails > summary { cursor: pointer; color: #111827; font-weight: 800; }
    .jsonContainer { position: relative; }
    .jsonDisplay { max-height: 460px; margin-top: 12px; background-color: #037df8; color: var(--ce-color-white); padding: 15px; border-radius: var(--ce-radius-5); border: 1px solid #ced4da; white-space: pre-wrap; word-break: break-all; font-size: 0.9em; overflow: auto; }
    .statsSection { margin-bottom: 20px; padding: 12px; background: var(--ce-color-white); border: var(--ce-color-black) solid 0.5px; }
    .statsSectionCollapsible { padding: 8px; margin-top: 8px; margin-bottom: 8px; }
    .statsRow { display: flex; flex-wrap: wrap; margin-bottom: 6px; }
    .statsItem { margin-right: 20px; margin-bottom: 4px; }
    .statLabel { font-weight: 600; margin-right: 4px; color: var(--ce-color-border); }
    .statValue { color: var(--ce-color-border); }
    .tooltipIcon { display: inline-block; margin-left: 4px; color: #555; cursor: help; width: 1em; height: 1em; overflow: visible; vertical-align: -0.125em; }
    .aidb-inline-tooltip-reference { align-items: center; }
    .aidb-answer-bar { display: flex; width: 100%; height: 12px; overflow: hidden; border-radius: 999px; background: #eef2f7; border: 1px solid rgba(17, 24, 39, 0.08); }
    .aidb-answer-bar i { display: block; height: 100%; }
    .aidb-answer-agree { background: var(--agree); }
    .aidb-answer-unsure { background: var(--unsure); }
    .aidb-answer-disagree { background: var(--disagree); }
    .aidb-answer-invalid { background: var(--invalid); opacity: 0.55; }
    .aidb-score-agree { color: #0f766e; }
    .aidb-score-disagree { color: #b42318; }
    .aidb-score-mixed { color: #344054; }
    .aidb-score-empty { color: #98a2b3; }
    .participantGraphControls { display: flex; flex-wrap: wrap; gap: 15px 20px; }
    .controlGroup { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .controlGroup select { padding: 4px; }
    .numberInputWrapper { display: flex; align-items: center; border: 1px solid var(--ce-color-border-light); border-radius: var(--ce-radius-4); overflow: hidden; }
    .clusterNumberInput { width: 50px; height: 28px; text-align: center; border: none; font-size: 1rem; -moz-appearance: textfield; }
    .clusterNumberInput::-webkit-outer-spin-button,
    .clusterNumberInput::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .clusterNumberInput:focus { outline: 2px solid #03a9f4; outline-offset: -1px; }
    .stepperButton { width: 30px; height: 30px; border: none; background-color: #f7f7f7; cursor: pointer; font-weight: bold; font-size: 1.1rem; line-height: 1; color: #555; transition: background-color 0.2s; }
    .stepperButton:hover { background-color: #e9e9e9; }
    .controlGroup select:disabled, .clusterNumberInput:disabled, .stepperButton:disabled, .clusterAutoButton:disabled { opacity: 1; cursor: default; color: inherit; -webkit-text-fill-color: currentColor; }
    .stepperButton:disabled:hover { background-color: #f7f7f7; }
    .stepperButton:first-child { border-right: 1px solid var(--ce-color-border-light); }
    .stepperButton:last-of-type { border-left: 1px solid var(--ce-color-border-light); }
    .clusterAutoButton { margin-left: 6px; cursor: pointer; }
    .clusterAutoButtonActive { background: #e5e7eb; box-shadow: inset 0 0 0 1px #9ca3af; }
    .aidb-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    .aidb-layer-toggles { flex: 1 1 100%; flex-wrap: wrap; }
    .aidb-layer-toggles label { cursor: pointer; }
    .aidb-layer-toggles input { margin-right: 4px; }
    .analyzeClustersBtn { display: inline-flex; align-items: center; gap: 8px; background-color: #7063f5; color: var(--ce-color-white); border: 1px solid #5e54e5; border-radius: var(--ce-radius-4); font-weight: 600; cursor: pointer; margin-left: 0; }
    .analysisWandIcon { width: 1em; height: 1em; display: inline-block; overflow: visible; vertical-align: -0.125em; flex: 0 0 auto; }
    .analyzeClustersBtn:disabled { opacity: 0.7; cursor: not-allowed; }
    .swarmLayoutContainer { width: 100%; max-width: 100%; min-width: 0; flex: 1 1 100%; box-sizing: border-box; }
    .swarmContainer { position: relative; overflow-x: auto; overflow-y: hidden; }
    .swarmScrollControls { display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 5px; }
    .swarmScrollControls[hidden] { display: none !important; }
    .scrollButton { background: #f0f0f0; border: 1px solid var(--ce-color-border-light); border-radius: var(--ce-radius-round); width: 30px; height: 30px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background-color 0.2s; }
    .scrollButton:hover { background: #e0e0e0; }
    .beeswarmSvg { border: 1px solid #ddd; background: var(--ce-color-white); overflow: scroll; }
    .beeswarmSvg text { font-size: 14px; font-weight: 400; fill: #000; }
    .beeswarmSvg line { stroke: #000; }
    .beeswarmSvg .beeswarmGridLine { stroke: #e2e8f0; stroke-width: 1; }
    .beeswarmSvg .beeswarmAxisLine { stroke: #111827; stroke-width: 1; }
    .beeswarmSvg .beeswarmTickLabel { fill: #64748b; font-size: 11px; }
    .beeswarmSvg .beeswarmAxisTitle { fill: #475569; font-size: 11px; font-weight: 600; }
    .beeswarmSvg .beeswarmAxisLabel { fill: #111827; font-size: 14px; }
    .beeswarmPoint { cursor: pointer; outline: none; }
    .beeswarmCircle { fill: steelblue; }
    .beeswarmCircleNoData { fill: #cbd5e1; opacity: 0.42; stroke: #94a3b8; stroke-width: 1; }
    .beeswarmCircleNoRepeat { fill: #94a3b8; opacity: 0.62; stroke: #64748b; stroke-width: 1; }
    .beeswarmPointNoData:hover .beeswarmCircleNoData,
    .beeswarmPointNoData:focus-visible .beeswarmCircleNoData { opacity: 0.78; }
    .beeswarmCircleHover { fill: #ff9900; }
    .beeTooltip { position: absolute; width: 300px; background: var(--ce-color-tooltip-bg); border: 1px solid var(--ce-color-tooltip-border); padding: 10px; font-size: 0.85rem; color: var(--ce-color-tooltip-text); pointer-events: auto; z-index: 999; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15); }
    .beeTooltip[hidden] { display: none; }
    .beeTooltip .ce-report-muted { color: var(--ce-color-tooltip-muted); }
    .clusterLegendSection { width: 100%; margin-top: 12px; margin-bottom: 20px; }
    .clusterLegendTitle { color: var(--ce-color-border); margin-right: 6px; }
    .clusterLegendItems { display: flex; flex-direction: column; margin-top: 6px; }
    .clusterSectionDiv { margin-bottom: 8px; border: 1px dashed #ccc; padding: 6px; background: transparent; }
    .clusterLegendHeader { cursor: pointer; display: flex; align-items: center; justify-content: space-between; }
    .clusterLegendLabel { display: flex; align-items: center; min-width: 0; }
    .clusterSwatchSvg { vertical-align: middle; flex: 0 0 auto; }
    .clusterLegendName { margin-left: 4px; font-weight: bold; color: var(--ce-color-border); overflow-wrap: anywhere; }
    .clusterLegendToggleIcon { margin-right: 8px; color: var(--ce-color-border); display: inline-flex; align-items: center; flex: 0 0 auto; }
    .clusterToggleSvgIcon { width: 1em; height: 1em; display: inline-block; overflow: visible; vertical-align: -0.125em; }
    .clusterToggleSvgIconClosed { display: none; }
    [data-ce-cluster-section][data-ce-cluster-open="false"] .clusterToggleSvgIconOpen { display: none; }
    [data-ce-cluster-section][data-ce-cluster-open="false"] .clusterToggleSvgIconClosed { display: inline-block; }
    .clusterLegendBody ul { margin: 8px 0 0; padding-left: 20px; color: #475467; }
    .aidb-similarity-details { margin-top: 12px; margin-bottom: 12px; }
    .graph { border: 1px solid #ddd; background: var(--ce-color-white); }
    .aidb-section-body.aidb-participant-graph-section { padding: 0; margin-top: 0; margin-bottom: 0; }
    .aidb-participant-graph-section .graphSection { display: flex; flex-wrap: wrap; margin-bottom: 20px; }
    .graphItem { flex: 1 1 50%; max-width: 50%; margin-right: 0; margin-bottom: 20px; }
    .participantSvg { border: 1px solid #ddd; background: var(--ce-color-white); width: 100%; height: auto; }
    .graph-participant { cursor: pointer; outline: none; }
    .graph-participant circle { transition: stroke-width 0.16s ease, filter 0.16s ease; }
    .graph-participant:hover circle, .graph-participant:focus-visible circle { stroke: rgba(15, 23, 42, 0.72); stroke-width: 3; filter: drop-shadow(0 6px 12px rgba(15, 23, 42, 0.16)); }
    .aidb-debate-map-scroll-shell { max-height: 80vh; overflow-y: auto; }
    .debateMapWrapper { display: block; box-sizing: border-box; color: #f1f5f9; font-family: var(--ce-font-mono); padding: 20px; }
    .debateMapWrapper.embeddedAtlas { background: transparent; min-height: unset; }
    .debateMap { width: 100%; max-width: 1600px; margin: 0 auto; }
    .debateMap .controls { position: relative; z-index: 200; display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 25px; margin-bottom: 25px; padding: 15px 20px; overflow: visible; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--ce-radius-12); background: rgba(255, 255, 255, 0.03); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
    .debateMap .primaryControls, .debateMap .secondaryControls { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .debateMap .secondaryControls { margin-left: auto; }
    .debateMap .viewModeSwitch { display: flex; align-items: center; padding: 4px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--ce-radius-8); background: rgba(0, 0, 0, 0.3); }
    .debateMap .viewModeSwitch button { background: transparent; border: none; color: #94a3b8; padding: 6px 16px; border-radius: var(--ce-radius-6); cursor: pointer; font-family: inherit; font-weight: 600; text-transform: uppercase; font-size: 0.8rem; transition: background-color 0.3s ease, color 0.3s ease; }
    .debateMap .viewModeSwitch button:hover { color: var(--ce-color-white); }
    .debateMap .viewModeSwitch button svg { margin-right: 6px; }
    .debateMap .viewModeSwitch button.active { background: rgba(56, 189, 248, 0.15); color: #38bdf8; box-shadow: 0 0 10px rgba(56, 189, 248, 0.1); }
    .debateMap .viewModeSeparator { display: inline-block; width: 1px; height: 18px; margin: 0 8px; background: rgba(255, 255, 255, 0.2); }
    .debateMap .inlineLegendItem { display: inline-flex; align-items: center; gap: 5px; font-size: 0.7rem; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; letter-spacing: 0.03em; margin: 0 6px; }
    .debateMap .legendDot { display: inline-block; width: 10px; height: 10px; border-radius: var(--ce-radius-round); box-shadow: 0 0 8px currentColor; }
    .debateMap .legendDot.category { background: #3b82f6; color: #3b82f6; }
    .debateMap .legendDot.subcategory { background: #2dd4bf; color: #2dd4bf; }
    .debateMap .legendDot.topic { background: #4ade80; color: #4ade80; }
    .debateMap .legendDot.instance { background: #fde047; color: #fde047; }
    .debateMap .atlasBrowseControls { display: flex; align-items: flex-end; justify-content: flex-end; flex-wrap: wrap; gap: 10px; }
    .debateMap .atlasBrowseField { display: grid; gap: 4px; color: rgba(226, 232, 240, 0.72); font-size: 0.68rem; font-weight: 700; text-transform: uppercase; }
    .debateMap .atlasBrowseControls select { min-width: 132px; height: 34px; padding: 4px 30px 4px 9px; border: 1px solid rgba(255, 255, 255, 0.14); border-radius: var(--ce-radius-6); background: #111827; color: #f1f5f9; font: inherit; font-size: 0.78rem; text-transform: none; cursor: pointer; }
    .debateMap .atlasBrowseControls select:hover,
    .debateMap .atlasBrowseControls select:focus-visible { border-color: #38bdf8; outline: none; box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.14); }
    .debateMap .atlasTagFilterField { position: relative; min-width: 190px; }
    .debateMap .atlasTagFilter { position: relative; color: #f1f5f9; font-size: 0.78rem; text-transform: none; }
    .debateMap .atlasTagFilter summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 190px; height: 34px; padding: 4px 10px; border: 1px solid rgba(255, 255, 255, 0.14); border-radius: var(--ce-radius-6); background: #111827; color: #f1f5f9; cursor: pointer; list-style: none; }
    .debateMap .atlasTagFilter summary::-webkit-details-marker { display: none; }
    .debateMap .atlasTagFilter summary:hover,
    .debateMap .atlasTagFilter summary:focus-visible { border-color: #38bdf8; outline: none; box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.14); }
    .debateMap .atlasTagChevron { width: 0.8em; height: 0.8em; flex: 0 0 auto; transition: transform 0.16s ease; }
    .debateMap .atlasTagFilter[open] .atlasTagChevron { transform: rotate(180deg); }
    .debateMap .atlasTagMenu { position: absolute; top: calc(100% + 6px); left: 0; z-index: 120; width: min(310px, calc(100vw - 48px)); padding: 8px; border: 1px solid rgba(56, 189, 248, 0.34); border-radius: var(--ce-radius-8); background: #111827; box-shadow: 0 18px 42px rgba(0, 0, 0, 0.42); }
    .debateMap .atlasTagMenuHeader { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 3px 4px 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); color: rgba(226, 232, 240, 0.72); font-size: 0.68rem; text-transform: uppercase; }
    .debateMap .atlasTagMenuHeader button { padding: 3px 7px; border: 1px solid rgba(255, 255, 255, 0.16); border-radius: var(--ce-radius-4); background: transparent; color: #f1f5f9; font: inherit; cursor: pointer; }
    .debateMap .atlasTagMenuHeader button:hover,
    .debateMap .atlasTagMenuHeader button:focus-visible { border-color: #38bdf8; outline: none; }
    .debateMap .atlasTagOptions { display: grid; max-height: 260px; padding-top: 5px; overflow-y: auto; overscroll-behavior: contain; }
    .debateMap .atlasTagOption { display: flex; align-items: center; gap: 8px; min-height: 32px; padding: 5px 6px; border-radius: var(--ce-radius-4); color: #e2e8f0; font-size: 0.76rem; font-weight: 600; line-height: 1.2; text-transform: none; cursor: pointer; }
    .debateMap .atlasTagOption:hover { background: rgba(56, 189, 248, 0.1); }
    .debateMap .atlasTagOption input { width: 15px; height: 15px; margin: 0; accent-color: #38bdf8; flex: 0 0 auto; }
    .debateMap .atlasBrowseStatus { align-self: center; color: rgba(148, 163, 184, 0.9); font-size: 0.74rem; white-space: nowrap; }
    .debateMap .nodesContainer { position: relative; min-height: 60vh; }
    .debateMap .atlasViewContainer { position: relative; width: 100%; height: 85vh; overflow: hidden; cursor: grab; touch-action: none; border-radius: var(--ce-radius-16); }
    .debateMap .atlasViewContainer:active { cursor: grabbing; }
    .debateMap .packedAtlasViewContainer { cursor: default; touch-action: auto; }
    .debateMap .packedAtlasViewContainer:active { cursor: default; }
    .debateMap .hotDebatesBtn { position: absolute; top: 20px; right: 20px; z-index: 50; display: flex; align-items: center; gap: 8px; padding: 10px 15px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--ce-radius-8); background: rgba(255, 255, 255, 0.03); color: #f1f5f9; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); cursor: pointer; font-family: inherit; font-weight: 700; transition: transform 0.2s, background-color 0.2s, border-color 0.2s, color 0.2s; }
    .debateMap .hotDebatesBtn:hover,
    .debateMap .hotDebatesBtn:focus-visible { background: rgba(56, 189, 248, 0.2); border-color: #38bdf8; color: var(--ce-color-white); transform: translateY(-2px); box-shadow: 0 0 15px rgba(56, 189, 248, 0.3); outline: none; }
    .debateMap .hotDebatesBtn svg { color: #fde047; }
    .debateMap .atlasChromeIcon { width: 1em; height: 1em; display: inline-block; overflow: visible; vertical-align: -0.125em; flex: 0 0 auto; }
    .debateMap .topNodesOverlay { position: absolute; top: 70px; right: 20px; width: 300px; padding: 20px; z-index: 40; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--ce-radius-12); background: rgba(11, 17, 32, 0.95); opacity: 0; transform: translateY(-20px); pointer-events: none; transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .debateMap .topNodesOverlay.visible { opacity: 1; transform: translateY(0); pointer-events: auto; z-index: 999; }
    .debateMap .topNodesOverlay h3 { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin: 0 0 15px; padding-bottom: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); color: #38bdf8; font-size: 1rem; letter-spacing: 1px; line-height: 1.2; text-transform: uppercase; }
    .debateMap .topNodesOverlay h3 span { display: inline-flex; align-items: center; gap: 8px; }
    .debateMap .minimizeBtn { cursor: pointer; background: transparent; border: none; padding: 0; color: #94a3b8; font-size: 0.8em; display: inline-flex; align-items: center; justify-content: center; box-shadow: none; }
    .debateMap .minimizeBtn:hover,
    .debateMap .minimizeBtn:focus-visible { color: var(--ce-color-white); outline: none; }
    .debateMap .topNodeItem { width: 100%; padding: 10px; margin-bottom: 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid transparent; border-radius: var(--ce-radius-6); color: inherit; cursor: pointer; display: block; font-family: inherit; text-align: left; transition: transform 0.2s, background-color 0.2s, border-color 0.2s; }
    .debateMap .topNodeItem:hover,
    .debateMap .topNodeItem:focus-visible { background: rgba(255, 255, 255, 0.1); border-color: #38bdf8; transform: translateX(-5px); outline: none; }
    .debateMap .nodeTitle { display: block; margin-bottom: 4px; font-size: 0.9rem; font-weight: 700; }
    .debateMap .nodeStats { display: flex; flex-wrap: wrap; gap: 10px; color: #94a3b8; font-size: 0.8rem; }
    .debateMap .atlasNode { appearance: none; position: absolute; left: var(--atlas-left, 50%); top: var(--atlas-top, 50%); transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; transition: left 0.35s ease, top 0.35s ease, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease; z-index: 10; }
    .debateMap .atlasNode[hidden] { display: none !important; }
    .debateMap .atlasNode:focus-visible { outline: none; }
    .debateMap .atlasNode:focus-visible .nodeDot { outline: 3px solid #38bdf8; outline-offset: 4px; }
    .debateMap .atlasNode .nodeDot { position: relative; border-radius: var(--ce-radius-round); background-color: #0b1120; display: flex; align-items: center; justify-content: center; transition: transform 0.3s, background-color 0.3s, border-color 0.3s, color 0.3s; border: 2px solid rgba(255, 255, 255, 0.3); box-shadow: 0 0 10px rgba(0, 0, 0, 0.2); }
    .debateMap .atlasNode .nodeLabel { position: absolute; top: 110%; font-size: 0.75rem; color: #94a3b8; text-shadow: 0 2px 4px var(--ce-color-black); white-space: nowrap; pointer-events: none; transition: opacity 0.2s, transform 0.2s, color 0.2s, background-color 0.2s; opacity: 0; transform: scale(0.9); font-family: var(--ce-font-mono); letter-spacing: 0.5px; background: transparent; padding: 0; border: none; z-index: 30; }
    .debateMap .atlasNode .nodeLabel.alwaysVisible { opacity: 0.8; transform: scale(1); }
    .debateMap .atlasNode:hover,
    .debateMap .atlasNode.hovered { z-index: 100 !important; }
    .debateMap .atlasNode:hover .nodeDot,
    .debateMap .atlasNode.hovered .nodeDot { transform: scale(1.15); background-color: #1e293b; box-shadow: 0 0 20px rgba(255, 255, 255, 0.1); }
    .debateMap .atlasNode:hover .nodeLabel,
    .debateMap .atlasNode.hovered .nodeLabel { opacity: 1 !important; color: var(--ce-color-white); font-weight: 700; transform: scale(1.2); z-index: 101; background: rgba(0, 0, 0, 0.8); padding: 2px 6px; border-radius: var(--ce-radius-4); }
    .debateMap .atlasNode.depth0 .nodeDot { border-color: #3b82f6; color: #3b82f6; background: rgba(59, 130, 246, 0.05); }
    .debateMap .atlasNode.depth0 .nodeLabel { font-size: 1rem; color: #93c5fd; font-weight: 700; }
    .debateMap .atlasNode.depth1 .nodeDot { border-color: #2dd4bf; color: #2dd4bf; }
    .debateMap .atlasNode.depth2 .nodeDot { border-color: #4ade80; background-color: #0b1120; }
    .debateMap .atlasNode.packedAtlasNode .nodeDot { overflow: hidden; border-width: 1.5px; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04), 0 8px 24px rgba(0, 0, 0, 0.2); }
    .debateMap .atlasNode.packedAtlasNode .packedNodeDot { display: flex; align-items: center; justify-content: center; width: var(--topic-diameter, 124px); height: var(--topic-diameter, 124px); }
    .debateMap .atlasNode.packedAtlasNode .packedNodeLabel { position: absolute; inset: 12%; display: flex; align-items: center; justify-content: center; text-align: center; white-space: normal; line-height: 1.06; padding: 0; transform: scale(0.94); text-shadow: 0 2px 10px rgba(11, 17, 32, 0.55); background: transparent; border-radius: 0; font-weight: 700; letter-spacing: 0.02em; overflow-wrap: normal; word-break: normal; hyphens: manual; }
    .debateMap .atlasNode.packedAtlasNode.depth0 .packedNodeDot { background: rgba(59, 130, 246, 0.17); border-color: rgba(147, 197, 253, 0.32); }
    .debateMap .atlasNode.packedAtlasNode.depth0 .packedNodeLabel { color: rgba(219, 234, 254, 0.96); }
    .debateMap .atlasNode.packedAtlasNode.depth1 .packedNodeDot { background: rgba(45, 212, 191, 0.16); border-color: rgba(45, 212, 191, 0.3); }
    .debateMap .atlasNode.packedAtlasNode.depth1 .packedNodeLabel { color: rgba(204, 251, 241, 0.96); }
    .debateMap .atlasNode.packedAtlasNode.depth2 .packedNodeDot { background: rgba(74, 222, 128, 0.14); border-color: rgba(74, 222, 128, 0.28); }
    .debateMap .atlasNode.packedAtlasNode.depth2 .packedNodeLabel { color: rgba(220, 252, 231, 0.95); }
    .debateMap .atlasNode.packedAtlasNode:hover .packedNodeDot,
    .debateMap .atlasNode.packedAtlasNode.hovered .packedNodeDot { transform: scale(1.03); }
    .debateMap .atlasNode.packedAtlasNode:hover .packedNodeLabel,
    .debateMap .atlasNode.packedAtlasNode.hovered .packedNodeLabel { background: transparent; padding: 0; transform: scale(1); }
    body[data-ce-atlas-modal-open="true"] { overflow: hidden; }
    body[data-ce-tag-modal-open="true"] { overflow: hidden; }
    .tagExplorerModalOverlay { position: fixed; inset: 0; z-index: 2100; display: flex; align-items: stretch; justify-content: center; padding: 16px; overflow: hidden; background: rgba(3, 5, 18, 0.82); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
    .tagExplorerModalOverlay[hidden] { display: none !important; }
    .tagExplorerModalContent { display: flex; flex-direction: column; width: min(1440px, 100%); min-width: 0; height: calc(100vh - 32px); min-height: 0; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 22px; background: #20204e; color: #f4f7ff; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45); overflow: hidden; }
    .tagExplorerModalContent:focus { outline: none; }
    .tagExplorerModalHeaderBar { display: flex; align-items: center; justify-content: space-between; flex: 0 0 auto; min-height: 68px; padding: 16px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.04); color: rgba(244, 247, 255, 0.88); font-size: 0.92rem; font-weight: 700; text-transform: uppercase; }
    .tagExplorerModalClose { appearance: none; display: inline-flex; align-items: center; justify-content: center; width: 2.4rem; height: 2.4rem; padding: 0; border: 1px solid rgba(255, 255, 255, 0.18); border-radius: var(--ce-radius-pill); background: transparent; color: rgba(244, 247, 255, 0.9); font-size: 1.25rem; cursor: pointer; }
    .tagExplorerModalClose:hover,
    .tagExplorerModalClose:focus-visible { border-color: rgba(77, 255, 164, 0.42); background: rgba(255, 255, 255, 0.08); color: #4dffa4; outline: none; }
    .tagExplorerModalClose svg { width: 1em; height: 1em; }
    .tagExplorerModalBody { flex: 1 1 auto; min-height: 0; overflow: hidden; }
    .tagExplorerModalScrollArea { box-sizing: border-box; width: 100%; height: 100%; padding: clamp(18px, 2.6vw, 30px); overflow-x: hidden; overflow-y: auto; }
    .tagExplorerHeader { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 14px; margin-bottom: 24px; }
    .tagExplorerTitle { display: flex; min-width: 0; margin: 0; color: #f4f7ff; font-family: var(--ce-font-mono); font-size: 1rem; line-height: 1; }
    .tagExplorerTitlePill { display: inline-flex; align-items: center; max-width: 100%; padding: 13px 20px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: var(--ce-radius-pill); background: rgba(255, 255, 255, 0.08); color: #f4f7ff; font-size: clamp(1.25rem, 3.6vw, 2.7rem); font-weight: 700; line-height: 1; overflow-wrap: anywhere; }
    .tagExplorerSummary { margin: 10px 0 0; color: rgba(244, 247, 255, 0.7); font-size: 0.86rem; line-height: 1.5; }
    .tagExplorerSection { min-width: 0; }
    .tagExplorerSectionHeader { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.12); }
    .tagExplorerSectionHeader h3 { margin: 0; color: #f4f7ff; font-family: var(--ce-font-mono); font-size: 1.15rem; }
    .tagExplorerSectionHeader span { color: rgba(244, 247, 255, 0.62); font-family: var(--ce-font-mono); font-size: 0.86rem; }
    .tagExplorerQuestionList { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .tagExplorerQuestionCard { display: grid; gap: 10px; min-width: 0; padding: 16px; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: var(--ce-radius-8); background: rgba(255, 255, 255, 0.05); color: #f4f7ff; text-decoration: none; }
    .tagExplorerQuestionCard:hover,
    .tagExplorerQuestionCard:focus-visible { border-color: rgba(77, 255, 164, 0.42); background: rgba(255, 255, 255, 0.08); color: #f4f7ff; outline: none; }
    .tagExplorerQuestionMeta { display: flex; justify-content: space-between; gap: 10px; color: rgba(244, 247, 255, 0.58); font-family: var(--ce-font-mono); font-size: 0.72rem; }
    .tagExplorerQuestionPrompt { margin: 0; color: #f4f7ff; font-size: 0.92rem; font-weight: 600; line-height: 1.45; }
    .tagExplorerQuestionBar { display: flex; width: 100%; height: 8px; border: 1px solid rgba(255, 255, 255, 0.14); border-radius: var(--ce-radius-pill); overflow: hidden; background: rgba(255, 255, 255, 0.08); }
    .tagExplorerQuestionBar i { display: block; height: 100%; }
    .tagExplorerAgree { background: #149488; }
    .tagExplorerUnsure { background: #cbd5e1; }
    .tagExplorerDisagree { background: #e85b43; }
    .tagExplorerQuestionLegend { display: flex; flex-wrap: wrap; gap: 6px 12px; color: rgba(244, 247, 255, 0.7); font-family: var(--ce-font-mono); font-size: 0.7rem; }
    .tagExplorerEmpty { grid-column: 1 / -1; margin: 0; padding: 20px 0; color: rgba(244, 247, 255, 0.7); }
    .atlasIssueModalOverlay { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: flex-start; justify-content: center; padding: 24px 16px; overflow-y: auto; overscroll-behavior: contain; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
    .atlasIssueModalOverlay[hidden] { display: none !important; }
    .atlasIssueModalContent { position: relative; width: min(95%, 800px); max-height: calc(100vh - 48px); margin: 0 auto; padding: 30px; overflow-y: auto; overscroll-behavior: contain; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: var(--ce-radius-12); background: #111827; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); color: #f1f5f9; font-family: var(--ce-font-mono); }
    .atlasIssueModalContent:focus { outline: none; }
    .atlasIssueModalContent::-webkit-scrollbar { width: 8px; }
    .atlasIssueModalContent::-webkit-scrollbar-thumb { border-radius: var(--ce-radius-4); background: rgba(255, 255, 255, 0.2); }
    .atlasIssueModalHeader { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
    .atlasIssueModalTitleSection { display: flex; flex: 1 1 auto; align-items: flex-start; gap: 10px; min-width: 0; }
    .atlasIssueModalTitleSection > div { min-width: 0; }
    .atlasIssueModalTitle { margin: 0; color: var(--ce-color-white); font-family: var(--ce-font-mono); font-size: 1.6rem; font-weight: 700; line-height: 1.2; overflow-wrap: anywhere; }
    .atlasIssueModalLinkButton,
    .atlasIssueModalClose { appearance: none; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; padding: 5px; border: 0; background: transparent; color: #94a3b8; cursor: pointer; transition: color 0.2s, opacity 0.2s, transform 0.2s, background-color 0.2s; }
    .atlasIssueModalLinkButton { margin-top: 1px; border-radius: var(--ce-radius-4); opacity: 0.5; }
    .atlasIssueModalLinkButton svg { width: 1rem; height: 1rem; }
    .atlasIssueModalClose { font-size: 1.5rem; }
    .atlasIssueModalClose svg { width: 1em; height: 1em; }
    .atlasIssueModalLinkButton:hover,
    .atlasIssueModalLinkButton:focus-visible { color: #38bdf8; opacity: 1; outline: none; background: rgba(255, 255, 255, 0.05); }
    .atlasIssueModalClose:hover,
    .atlasIssueModalClose:focus-visible { color: var(--ce-color-white); outline: none; transform: scale(1.1); }
    .atlasIssueModalTags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 25px; }
    .atlasIssueTag,
    .atlasIssueDepthTag { display: inline-flex; align-items: center; min-height: 26px; padding: 4px 10px; font-family: inherit; font-size: 0.72rem; line-height: 1.1; text-transform: uppercase; }
    .atlasIssueTag { appearance: none; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--ce-radius-20); background: rgba(255, 255, 255, 0.05); color: #94a3b8; cursor: pointer; transition: background-color 0.2s, border-color 0.2s, color 0.2s; }
    .atlasIssueTag:hover,
    .atlasIssueTag:focus-visible { border-color: rgba(255, 255, 255, 0.3); background: rgba(255, 255, 255, 0.15); color: var(--ce-color-white); outline: none; }
    .atlasIssueTag.atlasIssueConfidence { cursor: default; }
    .atlasIssueDepthTag { border: 1px solid transparent; border-radius: var(--ce-radius-4); color: #0b1120; font-weight: 800; letter-spacing: 1px; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2); }
    .atlasIssueDepthTag.depth0 { background: #3b82f6; box-shadow: 0 0 10px rgba(59, 130, 246, 0.3); }
    .atlasIssueDepthTag.depth1 { background: #2dd4bf; box-shadow: 0 0 10px rgba(45, 212, 191, 0.3); }
    .atlasIssueDepthTag.depth2 { background: #4ade80; box-shadow: 0 0 10px rgba(74, 222, 128, 0.3); }
    .atlasIssueOverview { margin-bottom: 16px; }
    .atlasIssueSummary { margin: 0 0 18px; color: rgba(226, 232, 240, 0.9); font-family: var(--ce-font-body); font-size: 1rem; line-height: 1.65; }
    .atlasIssueMetricGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-bottom: 16px; border-top: 1px solid rgba(255, 255, 255, 0.08); border-bottom: 1px solid rgba(255, 255, 255, 0.08); transition: background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease; }
    .atlasIssueMetricGrid[data-ce-atlas-model-metrics-active] { border-color: color-mix(in srgb, var(--atlas-active-model-color) 62%, rgba(255, 255, 255, 0.12)); background: color-mix(in srgb, var(--atlas-active-model-color) 24%, rgba(15, 23, 42, 0.82)); box-shadow: inset 4px 0 0 var(--atlas-active-model-color); }
    .atlasIssueMetricGrid > div { display: flex; flex-direction: column; gap: 3px; min-width: 0; padding: 11px 12px; border-right: 1px solid rgba(255, 255, 255, 0.08); }
    .atlasIssueMetricGrid > div:last-child { border-right: 0; }
    .atlasIssueMetricGrid span { color: rgba(148, 163, 184, 0.9); font-size: 0.67rem; font-weight: 700; text-transform: uppercase; }
    .atlasIssueMetricGrid strong { color: #f8fafc; font-family: var(--ce-font-body); font-size: 0.98rem; line-height: 1.3; }
    .atlasIssueMetricGrid small { color: #94a3b8; font-family: var(--ce-font-body); font-size: 0.73rem; line-height: 1.3; }
    .atlasIssueModelRoster { margin: 0 0 16px; padding: 14px; border: 1px solid rgba(56, 189, 248, 0.2); border-radius: var(--ce-radius-8); background: rgba(56, 189, 248, 0.05); }
    .atlasIssueModelRosterHeader { margin-bottom: 11px; }
    .atlasIssueModelRosterHeader strong { color: #e0f2fe; font-family: var(--ce-font-body); font-size: 0.9rem; }
    .atlasIssueModelList { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .atlasIssueModelListItem { min-width: 0; }
    .atlasIssueModelCard { appearance: none; display: inline-flex; align-items: center; gap: 7px; min-width: 0; padding: 6px 9px 6px 6px; border: 1px solid color-mix(in srgb, var(--atlas-model-color) 55%, rgba(255, 255, 255, 0.14)); border-radius: var(--ce-radius-6); background: rgba(15, 23, 42, 0.48); color: inherit; font: inherit; text-align: left; cursor: pointer; transition: border-color 0.16s ease, background-color 0.16s ease, box-shadow 0.16s ease; }
    .atlasIssueModelCard:hover,
    .atlasIssueModelCard:focus-visible { border-color: var(--atlas-model-color); background: rgba(30, 41, 59, 0.92); outline: none; box-shadow: 0 0 0 2px color-mix(in srgb, var(--atlas-model-color) 45%, transparent); }
    .atlasIssueModelCard.atlasIssueModelCardLocked { border-color: var(--atlas-model-color); background: color-mix(in srgb, var(--atlas-model-color) 24%, rgba(15, 23, 42, 0.9)); box-shadow: 0 0 0 2px color-mix(in srgb, var(--atlas-model-color) 65%, transparent), 0 0 14px color-mix(in srgb, var(--atlas-model-color) 38%, transparent); }
    .atlasIssueModelBadge,
    .atlasIssueModelMarker { display: inline-flex; align-items: center; justify-content: center; border: 2px solid rgba(255, 255, 255, 0.92); border-radius: var(--ce-radius-round); background: var(--atlas-model-color); color: #fff; font-family: var(--ce-font-mono); font-size: 0.62rem; font-weight: 800; line-height: 1; box-shadow: 0 2px 7px rgba(0, 0, 0, 0.42); }
    .atlasIssueModelBadge { width: 22px; height: 22px; flex: 0 0 22px; }
    .atlasIssueModelCard strong { color: #f8fafc; font-family: var(--ce-font-body); font-size: 0.8rem; line-height: 1.3; overflow-wrap: anywhere; }
    .atlasIssueCollapse { margin-bottom: 12px; background: transparent; }
    .atlasIssueCollapseHeader { appearance: none; display: flex; align-items: center; width: 100%; margin: 0 0 8px; padding: 8px 0; border: 0; border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; user-select: none; }
    .atlasIssueCollapseHeader:hover,
    .atlasIssueCollapseHeader:focus-visible { outline: none; border-bottom-color: rgba(56, 189, 248, 0.45); }
    .atlasIssueCollapseCaret { width: 14px; margin-right: 6px; color: rgba(255, 255, 255, 0.5); }
    .atlasIssueCollapseCaret[hidden] { display: none !important; }
    .atlasIssueCollapseHeader > span:first-of-type { color: rgba(255, 255, 255, 0.75); font-size: 1.1rem; font-weight: 600; }
    .atlasIssueCollapseCount { margin-left: 6px; color: rgba(255, 255, 255, 0.4); font-size: 0.8rem; }
    .atlasIssueCollapseToggle { margin-left: auto; color: rgba(255, 255, 255, 0.35); font-size: 0.7rem; text-transform: uppercase; }
    .atlasIssueCollapseContent { padding: 4px 0 8px; }
    .atlasIssueCollapseContent[hidden] { display: none !important; }
    .atlasIssueFindingGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 20px; }
    .atlasIssueFindingGroup { min-width: 0; padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
    .atlasIssueFindingGroup h4 { margin: 0 0 8px; color: #38bdf8; font-size: 0.76rem; text-transform: uppercase; }
    .atlasIssueFindingGroup ul,
    .atlasIssueFreeform ul { margin: 0; padding-left: 20px; color: rgba(226, 232, 240, 0.86); font-family: var(--ce-font-body); line-height: 1.55; }
    .atlasIssueFindingGroup li + li,
    .atlasIssueFreeform li + li { margin-top: 6px; }
    .atlasIssueFreeform p { margin: 0 0 12px; white-space: pre-line; color: rgba(226, 232, 240, 0.88); font-family: var(--ce-font-body); line-height: 1.65; }
    .atlasIssueSectionLinks { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin-top: 12px; color: #64748b; font-size: 0.74rem; }
    .atlasIssueSectionLinks a { color: #7dd3fc; text-decoration: none; }
    .atlasIssueSectionLinks a:hover,
    .atlasIssueSectionLinks a:focus-visible { color: #bae6fd; text-decoration: underline; outline: none; }
    .atlasIssueQuestions { display: grid; gap: 10px; }
    .atlasIssueQuestion { display: grid; gap: 5px; padding: 12px; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--ce-radius-8); background: rgba(255, 255, 255, 0.03); color: inherit; text-decoration: none; }
    .atlasIssueQuestion:hover,
    .atlasIssueQuestion:focus-visible { border-color: rgba(56, 189, 248, 0.42); background: rgba(56, 189, 248, 0.08); outline: none; }
    .atlasIssueQuestionId { color: #38bdf8; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; }
    .atlasIssueQuestion strong { color: rgba(241, 245, 249, 0.96); font-family: var(--ce-font-body); font-size: 0.9rem; line-height: 1.4; }
    .atlasIssueQuestionDistribution { display: grid; gap: 7px; margin-top: 4px; }
    .atlasIssueQuestionBar { position: relative; width: 100%; height: 20px; border: 1px solid rgba(255, 255, 255, 0.16); border-radius: var(--ce-radius-pill); background: rgba(148, 163, 184, 0.12); }
    .atlasIssueQuestionSegments { position: absolute; inset: 0; display: flex; overflow: hidden; border-radius: inherit; }
    .atlasIssueQuestionSegments i { display: block; height: 100%; }
    .atlasIssueModelMarker { position: absolute; top: 50%; z-index: 1; width: 18px; height: 18px; opacity: 1; transform: translate(-50%, -50%); pointer-events: auto; transition: opacity 0.16s ease, filter 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease; }
    .atlasIssueModalContent[data-ce-atlas-model-highlight] .atlasIssueModelMarker { opacity: 0.25; filter: brightness(0.72) saturate(0.55); }
    .atlasIssueModalContent[data-ce-atlas-model-highlight] .atlasIssueModelMarker.atlasIssueModelMarkerActive { z-index: 3; opacity: 1; filter: brightness(1.38) saturate(1.25); transform: translate(-50%, -50%) scale(1.18); box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.96), 0 0 12px var(--atlas-model-color); }
    .atlasIssueQuestionVoteLegend { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 12px; color: #94a3b8; font-size: 0.7rem; line-height: 1.2; }
    .atlasIssueQuestionVoteItem { display: inline-flex; align-items: center; gap: 5px; }
    .atlasIssueQuestionVoteItem > i { width: 8px; height: 8px; flex: 0 0 auto; border-radius: var(--ce-radius-round); }
    .atlasIssueQuestionVoteItem strong { color: #e2e8f0; font-family: var(--ce-font-mono); font-size: 0.72rem; }
    .atlasIssueQuestionVoteTotal { margin-left: auto; color: #64748b; white-space: nowrap; }
    .atlasIssueQuestionMeta { color: #64748b; font-size: 0.7rem; line-height: 1.35; }
    .atlasIssueQuestionMeta[data-ce-atlas-question-meta-active] { color: color-mix(in srgb, var(--atlas-active-model-color) 78%, #e2e8f0); font-weight: 700; }
    .atlasIssueEmpty { color: #94a3b8; font-family: var(--ce-font-body); }
    .debateMap .collapseSection { margin-bottom: 12px; background: transparent; border-radius: var(--ce-radius-6); }
    .debateMap .collapseHeader { display: flex; align-items: center; cursor: pointer; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.08); margin-bottom: 8px; user-select: none; }
    .debateMap .collapseHeader > svg { color: rgba(255, 255, 255, 0.5); width: 14px; margin-right: 6px; }
    .debateMap .collapseHeader > span:first-of-type { font-size: 1.1rem; font-weight: 600; color: rgba(255, 255, 255, 0.75); }
    .debateMap .collapseCount { font-size: 0.8rem; color: rgba(255, 255, 255, 0.4); margin-left: 6px; }
    .debateMap .collapseToggle { margin-left: auto; font-size: 0.75rem; color: rgba(255, 255, 255, 0.35); text-transform: uppercase; letter-spacing: 0.05em; }
    .debateMap .collapseContent { padding: 4px 0; }
    .debateMap .compassSection .compassContainer { width: 100%; padding: 4px 0 8px; }
    .aidb-analysis-compasses { display: grid; gap: 10px; margin-top: 16px; }
    .aidb-analysis-compass { border: 1px solid rgba(255, 255, 255, 0.08); padding: 0 14px 10px; background: rgba(15, 23, 42, 0.42); }
    .aidb-compass-caret-closed[hidden],
    .aidb-compass-caret-open[hidden] { display: none !important; }
    .aidb-compass-svg { display: block; width: 100%; max-width: 760px; height: auto; margin: 0 auto; overflow: visible; }
    .aidb-compass-bg { fill: rgba(15, 23, 42, 0.78); stroke: rgba(255, 255, 255, 0.12); stroke-width: 1; }
    .aidb-compass-axis { stroke: rgba(148, 163, 184, 0.5); stroke-width: 1; }
    .aidb-compass-axis-label { fill: rgba(226, 232, 240, 0.78); font-size: 11px; font-weight: 700; letter-spacing: 0.03em; }
    .aidb-compass-point { outline: none; }
    .aidb-compass-point circle { stroke: rgba(255, 255, 255, 0.85); stroke-width: 1.5; filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.28)); }
    .aidb-compass-point-label { fill: rgba(241, 245, 249, 0.94); font-size: 11px; font-weight: 700; paint-order: stroke; stroke: rgba(15, 23, 42, 0.78); stroke-width: 3; }
    .debateMap .atlasTopicCircle { color: #f1f5f9; }
    .debateMap .atlasTopicBubble { border: 1.5px solid rgba(45, 212, 191, 0.28); background: rgba(45, 212, 191, 0.14); background: color-mix(in srgb, var(--topic-color, #2dd4bf) 18%, rgba(11, 17, 32, 0.92)); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04), 0 8px 24px rgba(0, 0, 0, 0.2); }
    .debateMap .atlasTopicBubble strong { color: rgba(204, 251, 241, 0.96); text-shadow: 0 2px 10px rgba(11, 17, 32, 0.55); }
    .debateMap .atlasTopicBubble span { color: rgba(226, 232, 240, 0.78); }
    .debateMap .atlasTopicCircle p { color: #94a3b8; }
    .workspace { display: grid; gap: 1rem; color: var(--ce-color-dark, #212529); }
    .demoAnalysisWorkspace { display: grid; gap: 1rem; color: var(--ce-color-dark, #212529); }
    .primaryGrid,
    .secondaryGrid { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: stretch; }
    .panel { padding: 1rem 1.1rem; border: 1px solid #dee2e6; border-radius: var(--ce-radius-8, 8px); background: #ffffff; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); }
    .demoPanel { padding: 1rem 1.1rem; border: 1px solid #dee2e6; border-radius: var(--ce-radius-8, 8px); background: #ffffff; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); }
    .reportPanel, .demoPanel.reportPanel, .comparisonReportContainer { background: #f4f6f9; }
    .filterPanel { background: #ffffff; }
    .chartPanel, .mapPanel, .demoPanel.filterPanel, .demoPanel.chartPanel, .demoPanel.mapPanel { background: #ffffff; }
    .suggestionPanel { background: #fdfdea; border-color: #f0e68c; }
    .demoPanel.suggestionPanel { background: #fdfdea; border-color: #f0e68c; }
    .suggestionFilterStatus { margin: 0 0 0.75rem; color: #657083; font-size: 0.88rem; line-height: 1.45; }
    .selectedQuestionBanner { padding: 0; border: 0; background: transparent; box-shadow: none; }
    .selectedQuestionFrame { background: linear-gradient(145deg, #f8fbff 0%, #edf4ff 100%); border: 1px solid rgba(15, 94, 199, 0.14); border-radius: var(--ce-radius-8, 8px); box-shadow: 0 16px 38px rgba(15, 94, 199, 0.14); padding: 1.25rem 1.35rem 1.1rem; }
    .selectedQuestionCard { margin-bottom: 0; background: transparent !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
    .selectedQuestionCardBody { padding: 0; }
    .selectedQuestionCardPrompt { color: #1f2733 !important; font-size: clamp(1.6rem, 2.25vw, 2.16rem); line-height: 1.42; max-width: 48rem; text-shadow: none; }
    .selectedQuestionGrounding { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-top: 0.9rem; }
    .selectedQuestionGroundingPills { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-end; margin-left: auto; max-width: min(34rem, 48%); }
    .selectedQuestionTension { color: #364252; font-size: 0.96rem; line-height: 1.55; margin: 0; max-width: 44rem; }
    .selectedQuestionTagButton { display: inline-flex; align-items: center; justify-content: center; min-height: 34px; padding: 0.42rem 0.78rem; border: 1px solid rgba(15, 94, 199, 0.18); border-radius: var(--ce-radius-16, 16px); background: #dbeafe; color: #234267; font-size: 0.88rem; font-weight: 650; line-height: 1.1; text-decoration: none; cursor: pointer; box-shadow: 0 4px 12px rgba(15, 94, 199, 0.08); transition: transform 0.14s ease, background 0.14s ease, border-color 0.14s ease, color 0.14s ease; }
    .selectedQuestionTagButton:hover, .selectedQuestionTagButton:focus-visible { background: #c7ddff; border-color: rgba(15, 94, 199, 0.38); color: #122c4d; outline: none; transform: translateY(-1px); }
    .selectedQuestionTagButtonActive, .selectedQuestionTagButtonActive:hover, .selectedQuestionTagButtonActive:focus-visible { background: #0f5ec7; border-color: #0b4da4; color: #ffffff; box-shadow: 0 6px 16px rgba(15, 94, 199, 0.24); }
    .panelHeader { display: flex; justify-content: space-between; gap: 0.75rem; align-items: flex-start; margin-bottom: 0.8rem; }
    .selectorActions { display: flex; align-items: center; gap: 0.5rem; flex: 0 0 auto; }
    .panelTitle { margin: 0; font-size: 1.08rem; font-weight: 600; color: var(--ce-color-dark, #212529); }
    .panelMeta { margin: 0.3rem 0 0; color: var(--ce-color-text-muted, #6c757d); line-height: 1.45; }
    .clearButton { border: 1px solid #ced4da; border-radius: 999px; background: #f8f9fa; color: #495057; font-weight: 600; padding: 0.45rem 0.85rem; cursor: pointer; white-space: nowrap; transition: background-color 0.2s ease, border-color 0.2s ease; }
    .clearButton:hover { background: #e9ecef; border-color: #adb5bd; }
    .clearButton:disabled { cursor: default; opacity: 0.45; }
    .selectorActionSvgIcon { width: 1em; height: 1em; display: inline-block; overflow: visible; vertical-align: -0.125em; }
    .activePills, .pillsLayout, .tagFilterRow, .mapLegend { display: flex; flex-wrap: wrap; gap: 0.55rem; }
    .activePills { margin-bottom: 1rem; }
    .pillButton, .legendPill, .ratePill { display: inline-flex; align-items: center; gap: 0.4rem; border-radius: var(--ce-radius-16, 16px); padding: 0.4rem 0.75rem; border: 1px solid #ced4da; background: #f1f3f5; color: #495057; font-size: 0.88rem; font-weight: 500; }
    .legendSwatch { width: 0.7rem; height: 0.7rem; border-radius: var(--ce-radius-pill, 999px); }
    .pillButton { cursor: pointer; }
    button.pillButton { font: inherit; text-align: left; }
    .pillButtonActive, .segmentButton:hover { border-color: #b6d4fe; background: #d1e7fd; color: #084298; }
    .pillButton b { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; min-height: 22px; padding: 0 6px; border-radius: 999px; background: rgba(8, 66, 152, 0.1); font-size: 0.78rem; }
    .workspaceEmpty { display: flex; flex-direction: row; justify-content: center; align-items: center; text-align: center; padding: 10px; border: 2px dashed #d6d6d6; border-radius: var(--ce-radius-8, 8px); background-color: var(--ce-color-surface-light, #f8f9fa); color: var(--ce-color-text-muted, #6c757d); margin-bottom: 1rem; }
    .workspaceContainer { padding: 10px; border: 1px solid #d6d6d6; border-radius: var(--ce-radius-8, 8px); min-height: 64px; background-color: #fdfdff; margin-bottom: 1rem; }
    .pillsLayout { display: flex; flex-wrap: wrap; gap: 10px; }
    .breakdownFilterEmpty { margin: 8px 4px; color: #6c757d; font-size: 0.9rem; text-align: center; }
    .filterPill { display: flex; align-items: center; padding: 8px 12px; background-color: #f0f0f0; border: 1px solid #d6d6d6; border-radius: var(--ce-radius-16, 16px); font-size: 0.9rem; font-weight: 500; color: #495057; }
    .pillName { margin-right: 8px; white-space: nowrap; }
    .pillControls { display: flex; align-items: center; gap: 4px; }
    .pillIconButton { background: none; border: none; box-shadow: none; cursor: pointer; padding: 2px 4px; color: #666; border-radius: 999px; display: flex; align-items: center; justify-content: center; }
    .pillIconButton:hover, .pillIconButton:focus-visible { color: #000; background-color: rgba(0, 0, 0, 0.1); outline: none; }
    .pillIconSvgIcon { width: 1em; height: 1em; display: inline-block; overflow: visible; vertical-align: -0.125em; }
    .selectorLayout { display: grid; gap: 1rem; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: start; padding-top: 0.25rem; padding-bottom: 0.25rem; }
    .selectorField { min-width: 0; }
    .demographicSelect { width: 100%; }
    .breakdownTraitMenu { position: relative; }
    .breakdownTraitMenu > summary { list-style: none; }
    .breakdownTraitMenu > summary::-webkit-details-marker { display: none; }
    .demoAnalysisSelect__control { min-height: 48px; border: 1px solid #ced4da; background: #ffffff; box-shadow: none; cursor: pointer; border-radius: var(--ce-radius-8, 8px); display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 12px; min-width: 0; }
    .demoAnalysisSelect__control:hover { border-color: #adb5bd; }
    .demoAnalysisSelect__control:focus-visible { border-color: #0f5ec7; outline: 3px solid rgba(15, 94, 199, 0.18); }
    .demoAnalysisSelect__value-container { display: flex; flex: 1 1 auto; flex-direction: column; gap: 3px; min-width: 0; padding: 0; }
    .demoAnalysisSelect__placeholder { color: #495057; font-size: 0.95rem; font-weight: 600; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .demoAnalysisSelect__dropdown-indicator { color: #adb5bd; flex: 0 0 auto; padding: 6px 8px; }
    .breakdownTraitMenu[open] .demoAnalysisSelect__dropdown-indicator { transform: rotate(180deg); }
    .breakdownTraitSelectValues { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; min-width: 0; }
    .breakdownTraitSelectValue { display: inline-flex; align-items: center; max-width: 100%; min-height: 20px; border: 1px solid #dee2e6; border-radius: var(--ce-radius-pill, 999px); background: #f1f3f5; color: #495057; font-size: 0.74rem; font-weight: 650; line-height: 1.15; padding: 2px 6px; white-space: nowrap; }
    .breakdownTraitSelectValueMore { color: #6c757d; background: #f8f9fa; }
    .breakdownTraitMenuList { position: absolute; z-index: 80; top: calc(100% + 6px); left: 0; right: 0; display: grid; gap: 3px; max-height: 260px; padding: 7px; overflow-y: auto; border: 1px solid #c7d0dc; border-radius: var(--ce-radius-8, 8px); background: #ffffff; box-shadow: 0 14px 30px rgba(15, 23, 42, 0.18); }
    .breakdownTraitOption { display: grid; grid-template-columns: 18px minmax(0, 1fr); align-items: start; gap: 9px; margin-bottom: 0; padding: 8px; border-radius: var(--ce-radius-6, 6px); color: #344054; cursor: pointer; }
    .breakdownTraitOption:hover { background: #f1f5f9; }
    .breakdownTraitOption:focus-within { outline: 2px solid #0f5ec7; outline-offset: -2px; }
    .breakdownTraitOption input { position: static; width: 16px; height: 16px; margin: 2px 0 0; opacity: 1; visibility: visible; accent-color: #0f5ec7; }
    .breakdownTraitOption span { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; min-width: 0; }
    .breakdownTraitOption strong { min-width: 0; color: #243447; font-size: 0.84rem; overflow-wrap: anywhere; }
    .breakdownTraitOption small { flex: 0 0 auto; color: #6c757d; font-size: 0.72rem; }
    .breakdownTraitGrid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .selectorLayout.breakdownTraitGrid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .suggestionsList, .breakdownList { display: grid; gap: 0.75rem; }
    .suggestionButton { display: grid; gap: 0.35rem; width: 100%; padding: 0.85rem 0.95rem; border: 1px solid #e9e5c9; border-left: 4px solid #f0c420; border-radius: var(--ce-radius-6, 6px); background: #ffffff; color: var(--ce-color-dark, #212529); text-align: left; cursor: pointer; transition: background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; }
    .suggestionButton:hover { background: var(--ce-color-surface-light, #f8f9fa); box-shadow: 0 2px 5px rgba(0, 0, 0, 0.08); border-left-color: #e65516; }
    .suggestionButtonActive { border-color: #ffc56f; border-left-color: #e65516; background: #fffaf0; box-shadow: 0 0 0 1px rgba(230, 85, 22, 0.08); }
    .suggestionPair { display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem; font-weight: 600; }
    .suggestionVs { color: #6c757d; font-size: 0.82rem; font-style: italic; font-weight: 600; }
    .suggestionQuestion { color: #5a6268; line-height: 1.4; }
    .suggestionMeta { color: #7a8495; font-size: 0.8rem; line-height: 1.35; }
    .analysisList { list-style-type: none; padding: 1rem; margin: 0; display: grid; gap: 1rem; grid-template-columns: 1fr; }
    .workspace .chartPanel .analysisList, .demoAnalysisWorkspace .chartPanel .analysisList { padding: 0; }
    .analysisListItem { padding: 0; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: var(--ce-radius-8, 8px); display: flex; flex-direction: column; justify-content: space-between; min-width: 0; overflow: hidden; }
    .questionText { font-weight: 600; color: #212529; margin-bottom: 0.25rem; text-align: left; line-height: 1.35; }
    .responseText { font-style: italic; color: #5a6268; margin-bottom: 0.75rem; text-align: left; overflow-wrap: anywhere; }
    .responseTextPillRow { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-style: normal; }
    .responseTextPillLabel { color: #5a6268; font-size: 0.86rem; font-style: normal; font-weight: 600; }
    .responsePill { display: inline-flex; align-items: center; justify-content: center; min-height: 28px; padding: 4px 10px; border: 1px solid transparent; border-radius: var(--ce-radius-pill, 999px); font-size: 0.82rem; font-weight: 700; line-height: 1; letter-spacing: 0.01em; white-space: nowrap; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2); }
    .responsePill.aidb-score-agree { background: rgba(86, 214, 146, 0.16); border-color: rgba(86, 214, 146, 0.4); color: #236c4c; }
    .responsePill.aidb-score-mixed { background: rgba(255, 206, 86, 0.18); border-color: rgba(255, 206, 86, 0.45); color: #886200; }
    .responsePill.aidb-score-disagree { background: rgba(255, 115, 115, 0.15); border-color: rgba(255, 115, 115, 0.4); color: #a43b3b; }
    .reportAnalysisContent { display: grid; gap: 0.55rem; padding: 0.95rem 1rem; }
    .aidb-ai-analysis-content { padding: 0; }
    .aidb-ai-analysis-summary { margin: 0; color: var(--ce-color-dark, #212529); font-size: 0.98rem; line-height: 1.55; }
    .aidb-ai-analysis-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; margin-top: 0.35rem; }
    .aidb-ai-analysis-card { border: 1px solid #e0e0e0; border-radius: var(--ce-radius-8, 8px); background: #ffffff; padding: 0.85rem 0.95rem; }
    .aidb-ai-analysis-card h6 { margin: 0 0 0.55rem; color: #243447; font-size: 0.92rem; font-weight: 700; line-height: 1.2; }
    .aidb-ai-analysis-card ul { margin: 0; padding-left: 1.1rem; color: #344054; display: grid; gap: 0.42rem; }
    .aidb-ai-analysis-card li { line-height: 1.4; }
    .aidb-ai-analysis-card a { color: #0f5ec7; }
    .analysisDistributionList { display: grid; gap: 0.65rem; margin-top: 0.85rem; }
    .analysisDistributionDataset { display: grid; gap: 0.45rem; padding: 0.7rem 0.75rem; background: #f8fafc; border: 1px solid #edf1f5; border-radius: var(--ce-radius-6, 6px); }
    .analysisDistributionHeader { display: flex; align-items: baseline; justify-content: space-between; gap: 0.75rem; }
    .analysisDistributionTitle { color: #243447; font-size: 0.9rem; font-weight: 700; line-height: 1.25; }
    .analysisDistributionMeta { color: #65758a; font-size: 0.78rem; font-weight: 600; line-height: 1.25; text-align: right; }
    .analysisCandlestick { display: flex; width: 100%; height: 13px; overflow: hidden; background: #e6ebf1; border-radius: var(--ce-radius-pill, 999px); }
    .analysisCandleSegment { height: 100%; min-width: 0; }
    .analysisCandleSegmentAgree { background: linear-gradient(90deg, #168263, #47de8c); }
    .analysisCandleSegmentUnsure { background: linear-gradient(90deg, #9b8016, #f5c84e); }
    .analysisCandleSegmentDisagree { background: linear-gradient(90deg, #96364a, #ff6b6b); }
    .analysisCandleSegmentOther { background: linear-gradient(90deg, #667085, #98a2b3); }
    .analysisDistributionLegend { display: flex; flex-wrap: wrap; gap: 0.4rem 0.7rem; }
    .analysisDistributionLegendItem { display: inline-flex; align-items: center; gap: 0.28rem; color: #3e4b5d; font-size: 0.78rem; font-weight: 650; line-height: 1.2; }
    .analysisDistributionDot { width: 0.55rem; height: 0.55rem; border-radius: var(--ce-radius-pill); flex: 0 0 auto; }
    .mapFrame { margin-top: 0; overflow: hidden; width: 100%; }
    .mapFrameShell { display: grid; border: 1px solid #e0e6ef; border-radius: 14px; overflow: hidden; background: linear-gradient(180deg, rgba(248, 250, 252, 0.98) 0%, rgba(244, 247, 251, 0.96) 100%); }
    .mapFrameViewport { min-height: 320px; display: flex; align-items: center; justify-content: center; padding: 0.75rem 0.75rem 0.25rem; }
    .mapFrameViewportEmpty { min-height: 280px; padding: 1.5rem; text-align: center; }
    .mapViewportHint { margin: 0; max-width: 34rem; color: #5f6b7a; font-size: 1rem; line-height: 1.55; }
    .mapFrameCompact { align-items: center; display: flex; justify-content: center; margin-top: 0; width: 100%; padding: 0; }
    .aidb-world-map-svg { display: block; width: 100%; height: auto; max-width: none; }
    .worldMapSphere { fill: transparent; stroke: #e4e5e6; stroke-width: 0.5; }
    .worldMapGraticule { fill: none; stroke: #e4e5e6; stroke-width: 0.5; }
    .worldMapCountry { stroke: #ffffff; stroke-width: 0.7; outline: none; transition: fill 0.12s ease; }
    .worldMapCountry:hover, .worldMapCountry:focus-visible { fill: #ff5533; outline: none; }
    .worldMapCountry:active { fill: #ee4422; }
    .worldMapCountryHasData:focus-visible { stroke: #0f5ec7; stroke-width: 1.8; }
    .breakdownDataset { display: grid; gap: 0.65rem; padding: 0.9rem; border: 1px solid #e0e0e0; border-radius: var(--ce-radius-8, 8px); background: #ffffff; }
    .breakdownDatasetHeader { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; }
    .breakdownDatasetTitle { font-weight: 600; color: #495057; }
    .breakdownDatasetMeta { color: #6c757d; font-size: 0.88rem; }
    .breakdownQuestionText { margin: 0.35rem 0 0; color: #495057; font-size: 0.96rem; line-height: 1.45; max-width: 60rem; }
    .breakdownCandlestick { display: flex; width: 100%; height: 1.55rem; border: 1px solid #1f2733; background: #ffffff; overflow: hidden; }
    .breakdownCandleSegment { display: block; height: 100%; min-width: 0; }
    .breakdownCandleSegmentAgree { background: #18a05f; }
    .breakdownCandleSegmentUnsure { background: #ffd166; }
    .breakdownCandleSegmentDisagree { background: #dc3f46; }
    .comparisonReportContainer { background-color: #f4f6f9; border: 1px solid #dee2e6; border-radius: var(--ce-radius-8, 8px); padding: 1.5rem; font-family: var(--ce-font-body); position: relative; }
    .comparisonReportEmptyState { text-align: center; padding: 2rem; }
    .comparisonReportEmptyIcon { color: #6c757d; display: inline-block; font-size: 2em; height: 1em; margin-bottom: 1rem; overflow: visible; vertical-align: -0.125em; width: 1em; }
    .comparisonReportEmptyState h4 { margin: 0 0 0.5rem; font-size: 1.5rem; font-weight: 500; line-height: 1.2; }
    .demoAnalysisWorkspace .noData, .comparisonReportContainer .noData { padding: 1.5rem; text-align: center; color: var(--ce-color-text-muted, #6c757d); font-style: italic; }
    .reportCollapseHeader { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; width: 100%; margin: 0 0 1rem; padding: 0; border: 0; background: transparent; color: var(--ce-color-dark, #212529); text-align: left; cursor: pointer; }
    .reportCollapseHeader:hover .mainReportTitle,
    .reportCollapseHeader:focus-visible .mainReportTitle { color: #0f5ec7; }
    .reportCollapseHeader:focus-visible { outline: 2px solid #0f5ec7; outline-offset: 4px; border-radius: var(--ce-radius-6, 6px); }
    .reportCollapseCopy { display: grid; gap: 0.4rem; min-width: 0; }
    .mainReportTitle { text-align: left; color: var(--ce-color-dark, #212529); margin: 0; font-size: 1.3rem; font-weight: 600; line-height: 1.2; }
    .reportSummaryText { color: #5f6f82; font-size: 0.98rem; font-weight: 500; line-height: 1.4; }
    .reportCollapseIcon { flex: 0 0 auto; margin-top: 0.2rem; color: #34495e; width: 1em; height: 1em; display: inline-block; overflow: visible; vertical-align: -0.125em; }
    .reportCollapseBody { display: grid; gap: 0; }
    .comparisonReportContainer .sectionCollapse,
    .comparisonReportSectionCollapse { margin-bottom: 1rem; padding: 0; border: 1px solid #e0e0e0; border-radius: var(--ce-radius-8, 8px); background-color: var(--ce-color-white, #ffffff); overflow: hidden; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); }
    .comparisonReportSectionCollapse .sectionHeaderRow { display: flex; align-items: center; justify-content: flex-start; padding: 0.75rem 1.25rem; cursor: pointer; border-bottom: 1px solid var(--ce-color-light, #f1f3f5); margin-bottom: 0; }
    .comparisonReportSectionCollapse .sectionHeaderRow:hover { background-color: var(--ce-color-surface-light, #f8f9fa); }
    .comparisonReportSectionCollapse .sectionTitle { margin: 0; font-size: 1.1rem; font-weight: 500; color: var(--ce-color-dark, #212529); line-height: 1.2; }
    .comparisonReportSectionCollapse .sectionTitle svg { margin-right: 10px; width: 1em; height: 1em; display: inline-block; overflow: visible; vertical-align: -0.125em; }
    .comparisonBeeswarmSvg { width: 700px; min-width: 700px; max-width: none; }
    .comparisonReportContainer .beeswarmCircle { fill: steelblue; transition: fill 0.2s ease-in-out, filter 0.2s ease-in-out; cursor: pointer; }
    .comparisonReportContainer .beeswarmCircle:hover { fill: #ff9900; filter: brightness(1.2); }
    .comparisonReportContainer .analysisListItem { padding: 1rem 1.25rem; justify-content: space-between; }
    .comparisonReportContainer .reportAnalysisContent { gap: 0.45rem; padding: 0; }
    @media (min-width: 1024px) {
      .comparisonReportContainer .analysisList { grid-template-columns: repeat(2, 1fr); }
    }
    .legendContainer { margin-bottom: 1rem; padding: 0.75rem 1rem; background-color: var(--ce-color-light, #f1f3f5); border-radius: var(--ce-radius-6, 6px); display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
    .legendTitle { font-weight: 500; color: #495057; margin-right: 10px; }
    .legendPills { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
    .comparisonReportContainer .legendPill { padding: 4px 12px; border: 0; border-radius: var(--ce-radius-12, 12px); color: var(--ce-color-white, #ffffff); font-size: 0.9rem; font-weight: 500; text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); }
    .riskMatrixContainer,
    .riskMatrixContainer.container { color: rgba(244, 247, 255, 0.96); font-family: var(--ce-font-mono); padding: 24px 18px 36px; }
    .riskMatrixEmbedded,
    .riskMatrixEmbedded.embedded { background: transparent; min-height: unset; padding: 0; width: 100%; }
    .aidb-analysis-required { margin: 0 0 12px; padding: 10px 12px; border: 1px solid #f1c40f; border-radius: 6px; background: #fff8d6; color: #4a3b00; }
    .aidb-preview-notice { margin: 0 0 14px; padding: 10px 12px; border: 1px solid #60a5fa; border-radius: 6px; background: #eff6ff; color: #1e3a8a; }
    .aidb-preview-notice > span { display: block; margin-top: 3px; }
    .aidb-preview-notice details { margin-top: 8px; }
    .aidb-preview-notice summary { cursor: pointer; font-weight: 700; }
    .aidb-preview-notice ul { margin: 6px 0 0; padding-left: 20px; }
    .aidb-preview-notice li + li { margin-top: 5px; }
    .riskMatrixShell,
    .riskMatrixShell.shell { display: flex; flex-direction: column; gap: 14px; }
    .riskMatrixSectionCard,
    .riskMatrixSectionCard.sectionCard { padding: 16px; background: var(--ce-card-bg); border: 1px solid var(--ce-card-border); border-radius: var(--ce-radius-14); box-shadow: var(--ce-card-shadow); }
    .riskMatrixSectionHeader { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; font-size: 1rem; line-height: 1.2; color: rgba(244, 247, 255, 0.96); cursor: default; }
    .riskMatrixContainer .riskMatrixSectionHeader { font-size: 1rem; line-height: 1.2; color: rgba(244, 247, 255, 0.96); cursor: default; }
    .riskMatrixSectionTitle { margin: 0; color: rgba(244, 247, 255, 0.96); font-size: 1rem; line-height: 1.2; }
    .riskMatrixContainer .sectionTitle { color: rgba(244, 247, 255, 0.96); }
    .riskMatrixContainer .emptyState { color: rgba(190, 199, 230, 0.82); }
    .riskMatrixEmptyState { color: rgba(190, 199, 230, 0.82); font-size: 0.95rem; font-weight: 400; line-height: 1.6; margin: 8px 0 0; }
    .riskMatrixGridScroll,
    .riskMatrixGridScroll.gridScroll { overflow-x: auto; padding-bottom: 6px; width: 100%; max-width: 100%; }
    .riskMatrixGridContainer,
    .riskMatrixGridContainer.gridContainer { display: grid; gap: 8px; min-width: 980px; }
    .riskMatrixCell,
    .riskMatrixCell.cell { display: flex; align-items: center; justify-content: center; min-height: 72px; width: 100%; padding: 8px; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--ce-radius-10); background: #24264d; color: rgba(244, 247, 255, 0.96); font: inherit; text-align: center; line-height: 1.25; min-width: 0; overflow-wrap: anywhere; word-break: break-word; transition: transform 0.16s ease, box-shadow 0.2s ease, border-color 0.16s ease, background-color 0.16s ease; }
    button.riskMatrixCell,
    button.riskMatrixCell.cell { appearance: none; cursor: pointer; }
    .riskMatrixCornerCell,
    .riskMatrixCornerCell.cornerCell { background: rgba(255, 255, 255, 0.04); color: rgba(190, 199, 230, 0.82); font-size: 0.78rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    .riskMatrixHeaderCell,
    .riskMatrixHeaderCell.headerCell { min-height: 72px; padding: 10px; background: rgba(255, 255, 255, 0.08); font-size: 0.88rem; font-weight: 700; line-height: 1.25; overflow-wrap: normal; word-break: normal; hyphens: manual; }
    .riskMatrixHeaderCell:hover, .riskMatrixHeaderCell:focus-visible,
    .riskMatrixHeaderCell.headerCell:hover, .riskMatrixHeaderCell.headerCell:focus-visible { border-color: rgba(77, 255, 164, 0.38); background: rgba(77, 255, 164, 0.14); box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18); outline: none; }
    .activeHeaderCell { border-color: rgba(77, 255, 164, 0.38); background: rgba(77, 255, 164, 0.18); color: rgba(244, 247, 255, 0.96); }
    .riskMatrixRowHeader { justify-content: flex-start; text-align: left; }
    .riskMatrixGridCell,
    .riskMatrixGridCell.gridCell { min-height: 88px; align-items: center; justify-content: center; padding: 10px; background: #1f234f; }
    .riskMatrixGridCell:hover, .riskMatrixGridCell:focus-visible,
    .riskMatrixGridCell.gridCell:hover, .riskMatrixGridCell.gridCell:focus-visible { border-color: rgba(255, 255, 255, 0.18); box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22); outline: none; }
    .riskMatrixGridCellLinked,
    .riskMatrixGridCellLinked.gridCellLinked { border-color: rgba(0, 197, 255, 0.18); box-shadow: inset 0 0 0 1px rgba(0, 197, 255, 0.08), 0 12px 24px rgba(0, 0, 0, 0.14); }
    .riskMatrixEmptyCell,
    .riskMatrixEmptyCell.emptyCell { background: rgba(255, 255, 255, 0.04); color: rgba(244, 247, 255, 0.35); }
    .riskMatrixDiagonalCell, .diagonalCell { cursor: default; background: rgba(255, 255, 255, 0.03); color: rgba(244, 247, 255, 0.35); font-size: 1.35rem; }
    .highlighted { border-color: rgba(255, 255, 255, 0.18); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08); }
    .popOutEffect { transform: translateY(-2px) scale(1.02); box-shadow: 0 14px 30px rgba(0, 0, 0, 0.28); }
    .riskMatrixCellValue { color: rgba(244, 247, 255, 0.96); font-size: 1.2rem; font-weight: 700; letter-spacing: 0.02em; }
    .riskMatrixCellMeta { color: rgba(190, 199, 230, 0.72); font-size: 0.68rem; font-weight: 700; text-transform: uppercase; }
    .selectorGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-bottom: 16px; }
    .selectorPanel { padding: 12px; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--ce-radius-10); background: rgba(255, 255, 255, 0.04); }
    .selectorTitle { margin: 0 0 10px; color: rgba(244, 247, 255, 0.96); font-size: 1rem; line-height: 1.2; }
    .selectorButtonRow { display: flex; flex-wrap: wrap; gap: 8px; }
    .selectorButton { appearance: none; display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 10px 14px; border: 1px solid rgba(255, 255, 255, 0.14); border-radius: var(--ce-radius-10); background: rgba(255, 255, 255, 0.06); color: rgba(244, 247, 255, 0.96); font: inherit; cursor: pointer; transition: transform 0.08s ease, background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease; }
    .selectorButton:hover, .selectorButton:focus-visible { border-color: rgba(77, 255, 164, 0.38); background: rgba(77, 255, 164, 0.12); transform: translateY(-1px); outline: none; box-shadow: 0 0 0 3px rgba(77, 255, 164, 0.18); }
    .selectorButton:disabled { cursor: not-allowed; opacity: 0.55; transform: none; }
    .selectorButtonActive { border-color: rgba(77, 255, 164, 0.38); background: rgba(77, 255, 164, 0.18); }
    .selectorButtonClear { color: rgba(190, 199, 230, 0.82); }
    .subgridHeader { margin-bottom: 14px; }
    .subgridSummary { margin: 8px 0 0; color: rgba(190, 199, 230, 0.82); font-size: 0.88rem; line-height: 1.5; }
    .subgridContainer { display: grid; gap: 8px; min-width: 100%; width: 100%; }
    .riskMatrixBackdrop { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; background: rgba(3, 5, 18, 0.82) !important; opacity: 1 !important; z-index: 1040 !important; }
    .riskMatrixBackdrop[hidden] { display: none !important; }
    body[data-ce-risk-matrix-modal-open="true"] { overflow: hidden; }
    .riskMatrixCommentModal { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; max-width: none !important; margin: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; z-index: 1050 !important; pointer-events: none; }
    .riskMatrixCommentModal[hidden] { display: none !important; }
    .riskMatrixCommentModal .modal-dialog { max-width: 920px; width: min(90%, 920px); margin: auto; pointer-events: auto; }
    .riskMatrixModalContent { background: #090d1e !important; border: 1px solid rgba(255, 255, 255, 0.08) !important; border-radius: var(--ce-radius-14) !important; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4) !important; color: rgba(244, 247, 255, 0.96) !important; overflow: hidden !important; max-height: min(86vh, 820px); }
    .riskMatrixModalBody { display: flex; flex-direction: column; gap: 16px; padding: 0 20px 20px; max-height: min(86vh, 820px); overflow-y: auto; }
    .riskMatrixModalHeader { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 20px 20px 0; margin-bottom: 18px; background: linear-gradient(90deg, rgba(77, 255, 164, 0.08), rgba(77, 255, 164, 0)); color: rgba(244, 247, 255, 0.96); border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
    .modalTitleBlock { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .modalTitle { margin: 0; color: rgba(244, 247, 255, 0.96); font-size: 1.4rem; line-height: 1.2; }
    .modalMeta { color: rgba(190, 199, 230, 0.82); font-size: 0.88rem; }
    .modalCloseButton { appearance: none; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 40px; height: 40px; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: var(--ce-radius-10); background: rgba(255, 255, 255, 0.06); color: rgba(244, 247, 255, 0.96); font-size: 1.5rem; line-height: 1; cursor: pointer; transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.08s ease; }
    .modalCloseButton:hover, .modalCloseButton:focus-visible { outline: none; border-color: rgba(77, 255, 164, 0.38); background: rgba(77, 255, 164, 0.12); transform: translateY(-1px); }
    .commentSections { display: flex; flex-direction: column; gap: 14px; }
    .commentSection { padding: 14px; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--ce-radius-14); background: rgba(255, 255, 255, 0.03); }
    .commentSectionOpportunity { border-color: rgba(77, 255, 164, 0.18); background: rgba(13, 31, 25, 0.28); }
    .commentSectionRisk { border-color: rgba(255, 107, 114, 0.18); background: rgba(39, 17, 24, 0.28); }
    .commentSectionHeader { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; margin-bottom: 12px; padding: 0; border: 0; background: transparent; color: rgba(244, 247, 255, 0.96); text-align: left; flex-wrap: wrap; }
    .commentSectionHeaderText { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
    .commentSectionTitle { margin: 0; color: rgba(244, 247, 255, 0.96); font-size: 1.18rem; font-weight: 700; line-height: 1.2; }
    .commentSectionCount { display: inline-flex; align-items: center; min-height: 26px; padding: 4px 10px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--ce-radius-pill); background: rgba(8, 11, 33, 0.42); color: rgba(190, 199, 230, 0.82); font-size: 0.74rem; font-weight: 700; }
    .commentList { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
    .commentItem { padding: 16px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--ce-radius-14); background: rgba(12, 16, 42, 0.92); box-shadow: var(--ce-card-shadow); transition: border-color 0.18s ease, transform 0.08s ease, box-shadow 0.18s ease; }
    .commentItem:hover, .commentItem:focus-within { transform: translateY(-1px); }
    .commentItemOpportunity { border-color: rgba(77, 255, 164, 0.38); background: linear-gradient(135deg, rgba(77, 255, 164, 0.09), rgba(77, 255, 164, 0.02)), rgba(13, 31, 25, 0.96); }
    .commentItemRisk { border-color: rgba(255, 107, 114, 0.28); background: linear-gradient(135deg, rgba(255, 107, 114, 0.09), rgba(255, 107, 114, 0.02)), rgba(39, 17, 24, 0.96); }
    .commentHeader { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .commentHeaderMain { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1 1 240px; }
    .commentEyebrow { color: rgba(190, 199, 230, 0.82); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    .commentCardTitle { margin: 0; color: rgba(244, 247, 255, 0.96); font-size: 0.96rem; line-height: 1.35; }
    .commentHeaderMeta { display: inline-flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
    .commentBadge, .commentIntensity { display: inline-flex; align-items: center; min-height: 28px; padding: 4px 10px; border-radius: var(--ce-radius-pill); font-size: 0.75rem; font-weight: 700; }
    .commentBadge { background: rgba(8, 11, 33, 0.72); color: rgba(244, 247, 255, 0.96); letter-spacing: 0.04em; text-transform: uppercase; }
    .commentIntensity { border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(8, 11, 33, 0.38); color: rgba(190, 199, 230, 0.82); }
    .commentText { margin: 12px 0 0; color: rgba(244, 247, 255, 0.92); line-height: 1.55; }
    .riskMatrixAiSummary { padding: 16px; border: 1px solid rgba(125, 211, 252, 0.22); border-radius: var(--ce-radius-14); background: linear-gradient(135deg, rgba(125, 211, 252, 0.1), rgba(77, 255, 164, 0.03)), rgba(12, 16, 42, 0.9); }
    .riskMatrixAiSummary p { margin: 0; color: rgba(244, 247, 255, 0.94); line-height: 1.58; }
    .riskMatrixAiMeta { margin-top: 10px; color: rgba(190, 199, 230, 0.82); font-size: 0.78rem; font-weight: 700; line-height: 1.4; }
    .riskMatrixAiGeneratedSection .commentText { margin-top: 0; }
    .riskMatrixModalFooter { display: flex; justify-content: flex-end; gap: 10px; padding-top: 4px; }
    .modalButton { border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.08); color: rgba(244, 247, 255, 0.96); border-radius: var(--ce-radius-10); padding: 10px 14px; font: inherit; font-weight: 700; }
    .modalButton:hover:not(:disabled), .modalButton:focus-visible:not(:disabled) { transform: translateY(-1px); outline: none; }
    .modalButtonSecondary { color: rgba(190, 199, 230, 0.82); }
    .modalButtonSecondary:hover:not(:disabled), .modalButtonSecondary:focus-visible:not(:disabled) { border-color: rgba(255, 255, 255, 0.18); background: rgba(255, 255, 255, 0.1); }
    .atlasScenarioRail { display: block; }
    .atlasScenarioGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px; }
    .atlasScenarioCard { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 14px; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--ce-radius-14); background: rgba(12, 16, 42, 0.78); transition: border-color 0.18s ease, background-color 0.18s ease; }
    .atlasScenarioCard:hover, .atlasScenarioCard:focus-within { border-color: rgba(125, 211, 252, 0.24); background: rgba(12, 16, 42, 0.88); }
    .atlasScenarioContent { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
    .atlasScenarioHeader { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .atlasScenarioHeaderMain { display: flex; align-items: flex-start; gap: 14px; min-width: 0; flex: 1 1 auto; }
    .atlasScenarioImage,
    .atlasScenarioImageFallback { flex: 0 0 96px; width: 96px; height: 96px; min-height: 96px; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--ce-radius-10); background: rgba(255, 255, 255, 0.05); }
    .atlasScenarioImage { display: block; object-fit: cover; }
    .atlasScenarioImageFallback { display: flex; align-items: center; justify-content: center; padding: 12px; color: rgba(244, 247, 255, 0.72); font-size: 0.82rem; font-weight: 800; text-align: center; }
    .atlasScenarioTitleBlock { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1 1 auto; }
    .atlasScenarioNodeLabel { color: rgba(190, 199, 230, 0.82); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    .atlasScenarioValence { flex: 0 0 auto; align-self: flex-start; display: inline-flex; align-items: center; min-height: 28px; padding: 4px 10px; border: 1px solid rgba(255, 255, 255, 0.09); border-radius: var(--ce-radius-pill); background: rgba(8, 11, 33, 0.62); color: rgba(244, 247, 255, 0.96); font-size: 0.74rem; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; }
    .atlasScenarioValenceRisk { border-color: rgba(255, 107, 114, 0.22) !important; color: #ff9298; }
    .atlasScenarioValenceOpportunity { border-color: rgba(77, 255, 164, 0.22) !important; color: #7fffc2; }
    .atlasScenarioValenceMixed { border-color: rgba(255, 193, 77, 0.24) !important; color: rgba(255, 210, 128, 0.96); }
    .atlasScenarioTitle { margin: 0; color: rgba(244, 247, 255, 0.96); font-size: 1rem; line-height: 1.28; }
    .atlasScenarioSummary { margin: 0; color: rgba(244, 247, 255, 0.84); font-size: 0.88rem; line-height: 1.5; }
    .atlasScenarioMetaLine { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; }
    .atlasScenarioMetaPill { display: inline-flex; align-items: center; min-height: 24px; padding: 3px 9px; border: 1px solid rgba(125, 211, 252, 0.18); border-radius: var(--ce-radius-pill); background: rgba(255, 255, 255, 0.06); color: rgba(244, 247, 255, 0.82); font-size: 0.74rem; font-weight: 700; line-height: 1.2; }
    .atlasScenarioMechanism { display: flex; flex-direction: column; gap: 4px; }
    .atlasScenarioMechanism span { display: block; color: rgba(190, 199, 230, 0.82); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
    .atlasScenarioMechanism p { margin: 0; color: rgba(244, 247, 255, 0.86); font-size: 0.82rem; line-height: 1.5; }
    .atlasScenarioAnchors { display: flex; flex-wrap: wrap; gap: 8px; }
    .atlasScenarioAnchorChip { display: inline-flex; align-items: center; gap: 8px; min-width: 0; padding: 4px 0; }
    .atlasScenarioAnchorAvatar { flex: 0 0 auto; width: 32px; height: 32px; border-radius: var(--ce-radius-round); object-fit: cover; background: rgba(255, 255, 255, 0.06); }
    .atlasScenarioAnchorCopy { display: flex; flex-direction: column; min-width: 0; }
    .atlasScenarioAnchorName { color: rgba(244, 247, 255, 0.96); font-size: 0.76rem; font-weight: 700; line-height: 1.2; }
    .atlasScenarioAnchorRole { color: rgba(190, 199, 230, 0.82); font-size: 0.68rem; line-height: 1.2; }
    .atlasScenarioLink { appearance: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: flex-start; gap: 8px; margin-top: auto; padding: 0; border: 0; background: transparent; color: #4dffa4; font-size: 0.82rem; font-weight: 800; text-decoration: none; transition: color 0.18s ease, opacity 0.18s ease; }
    .atlasScenarioLink:hover, .atlasScenarioLink:focus-visible { outline: none; color: #7fffc2; opacity: 1; }
    .atlasScenarioLinkIcon { flex: 0 0 auto; font-size: 0.86rem; width: 1em; height: 1em; display: inline-block; overflow: visible; vertical-align: -0.125em; }
    .atlasScenarioLinkLabel { min-width: 0; line-height: 1.3; }
    .atlasScenarioLinkIconTrailing { flex: 0 0 auto; font-size: 0.72rem; width: 1em; height: 1em; display: inline-block; overflow: visible; vertical-align: -0.125em; opacity: 0.72; }
    .polis-grid { display: grid; grid-template-columns: minmax(360px, 1fr) minmax(320px, 0.9fr); gap: 18px; align-items: start; }
    tbody th { text-align: left; min-width: 150px; }
    .question-bars { display: grid; gap: 10px; padding: 0; margin: 0; list-style: none; }
    .question-bars li { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; align-items: center; }
    .rank { width: 26px; height: 26px; display: grid; place-items: center; background: #0f766e; color: white; border-radius: 999px; font-weight: 700; }
    .statement { font-size: 13px; line-height: 1.35; }
    .breakdown { display: grid; gap: 18px; }
    .trait-group { border-top: 1px solid var(--line); padding-top: 10px; }
    .trait-group summary { color: #10233f; font-size: 1rem; font-weight: 800; }
    .trait-row { display: grid; grid-template-columns: 150px minmax(0, 1fr) 120px; gap: 10px; align-items: center; padding: 7px 0; font-size: 13px; }
    .trait-row span { color: var(--muted); overflow-wrap: anywhere; }
    .trait-row b { justify-self: end; display: block; max-width: 120px; height: 12px; border-radius: 999px; background: linear-gradient(90deg, #149488, #60a5fa); }
    .risk-list { display: grid; gap: 9px; }
    .risk-row { display: grid; grid-template-columns: minmax(0, 1fr) 92px 46px; gap: 10px; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
    .risk-row span { color: var(--muted); }
    .risk-row b { display: block; width: 34px; height: 18px; border-radius: 999px; border: 1px solid rgba(17, 24, 39, 0.1); }
    .questionList { margin-top: 10px; width: 100%; }
    .questionListItem { margin-bottom: 6px; border-bottom: 1px solid #ddd; padding-bottom: 6px; scroll-margin-top: 24px; }
    .questionPromptLine { font-weight: bold; font-size: 0.9rem; color: var(--ce-color-border); line-height: 1.35; overflow-wrap: anywhere; }
    .questionPromptLabel { font-weight: bold; }
    .questionVoteRow { display: flex; flex-direction: column; }
    .questionVoteRow > span { margin-right: 0; }
    .questionVoteSummary { font-size: 0.8rem; margin-right: 8px; color: var(--ce-color-border); }
    .questionVoteSummary strong { color: var(--ce-color-border); }
    .questionModelLegend { display: flex; align-items: center; flex-wrap: wrap; gap: 7px 12px; margin: 0 0 12px; padding: 9px 10px; border: 1px solid #d7dde5; border-radius: var(--ce-radius-6); background: #f8fafc; }
    .questionModelLegendItem { display: inline-flex; align-items: center; gap: 6px; min-width: 0; padding: 3px 5px; border: 1px solid transparent; border-radius: var(--ce-radius-4); background: transparent; color: #344054; font: inherit; font-size: 0.72rem; font-weight: 700; line-height: 1.2; text-align: left; cursor: pointer; transition: opacity 120ms ease, border-color 120ms ease, background 120ms ease, box-shadow 120ms ease; }
    .questionModelLegendItem:hover, .questionModelLegendItem:focus-visible { border-color: color-mix(in srgb, var(--atlas-model-color) 72%, #d7dde5); background: color-mix(in srgb, var(--atlas-model-color) 10%, #ffffff); outline: none; }
    .questionModelLegendItem.questionModelLegendItemLocked { border-color: var(--atlas-model-color); background: color-mix(in srgb, var(--atlas-model-color) 14%, #ffffff); box-shadow: 0 0 0 2px color-mix(in srgb, var(--atlas-model-color) 24%, transparent); }
    .questionModelLegend .atlasIssueModelMarker { position: static; width: 20px; height: 20px; flex: 0 0 auto; transform: none; }
    .questionModelDistribution { width: min(100%, 560px); margin-top: 3px; }
    .questionModelDistribution .atlasIssueQuestionBar { height: 24px; border-color: #64748b; background: #eef2f6; }
    .questionModelDistribution .atlasIssueModelMarker { width: 20px; height: 20px; }
    #all-questions[data-ce-question-model-highlight] .questionModelLegendItem { opacity: 0.38; }
    #all-questions[data-ce-question-model-highlight] .questionModelLegendItem.questionModelLegendItemActive { opacity: 1; }
    #all-questions[data-ce-question-model-highlight] .questionModelDistribution .atlasIssueModelMarker { opacity: 0.25; filter: brightness(0.72) saturate(0.55); }
    #all-questions[data-ce-question-model-highlight] .questionModelDistribution .atlasIssueModelMarker.atlasIssueModelMarkerActive { z-index: 3; opacity: 1; filter: brightness(1.22) saturate(1.2); transform: translate(-50%, -50%) scale(1.16); box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.96), 0 0 10px var(--atlas-model-color); }
    .polisBoxPlotContainer { display: inline-block; margin-left: 10px; }
    .polisBoxPlotSvg { display: block; border: var(--ce-color-black) solid 0.5px; }
    .pdfIgnore { display: block; }
    .settingsRow.pdfIgnore { display: flex; }
    .settingsRow > div { display: inline-flex; align-items: center; min-width: 0; }
    @media print {
      .pdfIgnore { display: none !important; }
      .beeTooltip { display: none !important; }
      .participantModelNumber { display: none !important; }
      .aidb-benchmark-intro { background: #ffffff; color: #111827; }
      .aidb-benchmark-intro h1,
      .aidb-benchmark-lead { color: #111827; }
      .aidb-benchmark-topic-fact label { color: #64748b; }
      .aidb-benchmark-topic-fact select { border-color: #94a3b8; background: #ffffff; color: #111827; color-scheme: light; }
      .aidb-benchmark-provenance { color: #475569; }
      .aidb-benchmark-technical-name { color: #111827; }
      .aidb-benchmark-facts { border-color: #cbd5e1; }
      .aidb-benchmark-facts > div { border-color: #cbd5e1; }
      .aidb-benchmark-facts dt { color: #64748b; }
      .aidb-benchmark-facts dd { color: #111827; }
    }
    .pdfMode .pdfIgnore { display: none !important; }
    .pdfMode .showWhenPdf { display: inline; }
    .pdfMode .beeTooltip { display: none !important; }
    .htmlReportModalDialog { position: relative; width: auto; max-width: 500px; margin: 0 auto; pointer-events: none; }
    .htmlReportModalDialog .modal-content { pointer-events: auto; }
    .htmlReportExportSurface { width: min(100%, 960px); margin: 0 auto; background: #fff; color: #111827; border: 1px solid rgba(15, 23, 42, 0.16); border-radius: var(--ce-radius-12); box-shadow: 0 24px 70px rgba(15, 23, 42, 0.34); overflow: hidden; opacity: 1; }
    .htmlReportExportSurface.modal-content { position: relative; display: flex; flex-direction: column; pointer-events: auto; background-clip: padding-box; outline: 0; }
    .aidb-raw-results-modal-pane .htmlReportExportSurface { width: 100%; }
    .htmlReportModalHeader { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #fff; border-bottom: 1px solid #d7dde8; color: #111827; padding: 16px 18px; font-weight: 800; }
    .htmlReportModalHeader h3 { margin: 0; color: #111827; font-size: 1.1rem; font-weight: 800; }
    .htmlReportModalHeader .modal-title { color: #111827; font-weight: 800; }
    .htmlReportModalHeader span { color: #475569; font-size: 0.86rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
    .htmlReportCloseButton { appearance: none; border: 0; background: transparent; color: #0f1222; cursor: pointer; font-size: 1.5rem; font-weight: 700; line-height: 1; margin: 0; opacity: 1; padding: 0.25rem; box-shadow: none; }
    .htmlReportCloseButton span { color: inherit; font-size: inherit; font-weight: inherit; letter-spacing: 0; line-height: inherit; text-transform: none; }
    .htmlReportCloseButton:hover, .htmlReportCloseButton:focus { background: transparent; color: #0f1222; opacity: 1; outline: none; }
    .htmlReportModalBody { background: #fff; color: #1f2937; font-size: 1rem; line-height: 1.55; padding: 18px; }
    .htmlReportModalBody p, .htmlReportModalBody strong, .htmlReportModalBody td, .htmlReportModalBody th { color: #1f2937; opacity: 1; }
    .htmlReportModalBody strong, .htmlReportModalBody th { font-weight: 800; }
    .htmlReportInfo, .htmlReportWarning { margin: 1rem 0; padding: 0.85rem 0.95rem; border: 1px solid; border-radius: var(--ce-radius-8); font-weight: 600; line-height: 1.45; }
    .htmlReportInfo { background: #eff6ff; border-color: #93c5fd; color: #1e3a8a; }
    .htmlReportWarning { background: #fff8e5; border-color: #f5c451; color: #422006; }
    .htmlReportOptionGroup { margin: 1rem 0; padding: 0.95rem; border: 1px solid #d7dde8; border-radius: var(--ce-radius-8); background: #f8fafc; color: #1f2937; }
    .htmlReportOptionGroup h6 { margin: 0 0 0.75rem; color: #111827; font-size: 0.95rem; font-weight: 800; }
    .htmlReportOptionRow { display: grid; grid-template-columns: 1.15rem minmax(0, 1fr); align-items: flex-start; column-gap: 0.7rem; row-gap: 0.15rem; margin: 0.7rem 0; padding: 0; color: #1f2937; }
    .htmlReportOptionRow input[type='checkbox'], .htmlReportOptionRow input[type='radio'], .htmlReportSectionTable input[type='checkbox'] { position: static; float: none; width: 1rem; height: 1rem; margin: 0.2rem 0 0; opacity: 1; visibility: visible; accent-color: #0f5ec7; }
    .htmlReportOptionRow span { display: flex; flex-direction: column; gap: 0.15rem; margin: 0; padding: 0; color: #1f2937; line-height: 1.35; }
    .htmlReportOptionRow small { color: #475569; font-size: 0.84rem; font-weight: 600; }
    .htmlReportSectionTableResponsive { width: 100%; margin: 1rem 0; overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .htmlReportSectionTable { width: 100%; min-width: 640px; max-width: none; margin: 0; border-collapse: collapse; table-layout: auto; font-size: 0.92rem; color: #1f2937; }
    .htmlReportSectionTable th { background: #eef2f7; border-color: #d7dde8; color: #111827; }
    .htmlReportSectionTable th, .htmlReportSectionTable td { overflow-wrap: anywhere; }
    .htmlReportSectionTable td { border-color: #e5e9f0; color: #1f2937; vertical-align: top; }
    .htmlReportSectionTable th:first-child, .htmlReportSectionTable td:first-child { width: 4.25rem; text-align: center; }
    .htmlReportJsonDetails { border: 1px solid #d7dde8; border-radius: var(--ce-radius-8); background: #fff; padding: 10px 12px; margin: 10px 0; }
    .htmlReportJsonDetails > summary { color: #111827; font-weight: 800; cursor: pointer; }
    .htmlReportJsonDetails pre { max-height: 460px; margin-top: 10px; }
    .htmlReportModalFooter { display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem; flex-wrap: wrap; background: #fff; border-top: 1px solid #d7dde8; padding: 14px 18px; }
    .htmlReportCancelButton, .htmlReportDownloadButton { border-radius: var(--ce-radius-8); font-weight: 800; min-height: 42px; padding: 0.6rem 1rem; }
    .htmlReportCancelButton { background: #fff; border: 1px solid #64748b; color: #111827; }
    .htmlReportCancelButton:hover, .htmlReportCancelButton:focus { background: #f1f5f9; border-color: #334155; color: #020617; }
    .htmlReportDownloadButton { background: #0f5ec7; border: 1px solid #0f5ec7; color: #fff; }
    .htmlReportDownloadButton:hover, .htmlReportDownloadButton:focus { background: #0b4da6; border-color: #0b4da6; color: #fff; }
    .aidb-json-details:not(.htmlReportJsonDetails) { border: 0; border-radius: 0; background: transparent; padding: 0; margin: 0; }
    .aidb-json-details:not(.htmlReportJsonDetails) > summary { color: var(--ce-color-border); font-weight: 800; margin-bottom: 10px; }
    .showWhenPdf { display: none; }
    .participantsList { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; width: 100%; }
    .participantListItem { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border: 1px solid var(--ce-color-border-light); border-radius: var(--ce-radius-6); background: var(--ce-color-white); max-width: 100%; }
    .participantModelNumber { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; flex: 0 0 22px; border: 2px solid rgba(255, 255, 255, 0.96); border-radius: 50%; background: var(--participant-model-color); color: #ffffff; box-shadow: 0 1px 5px color-mix(in srgb, var(--participant-model-color) 45%, transparent); font-size: 0.72rem; font-weight: 800; line-height: 1; }
    .participantIndex { font-weight: 600; min-width: 24px; text-align: right; flex: 0 0 auto; }
    .participantBlockie { border-radius: var(--ce-radius-4); flex: 0 0 auto; }
    .participantAddressLink { text-decoration: none; color: var(--ce-color-border); font-family: var(--ce-font-mono); font-size: 1.1rem; display: block; flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .participantAddressFull { display: inline; }
    .participantAddressShort { display: none; }
    [hidden] { display: none !important; }
    @media only screen and (max-width: 1024px) {
      .resultsModeActionsScroller { flex: 1 1 100%; max-width: 100%; width: 100%; justify-content: flex-start; overflow-x: auto; overflow-y: hidden; padding: 6px 10px; }
      .resultsModeActions { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); justify-content: stretch; width: 100%; min-width: 0; gap: 10px; }
      .resultsModeActions .sectionHeaderViewModeButton { width: 100%; min-width: 0; white-space: normal; text-align: center; }
      .aidb-collapse-heading, .aidb-section-row { display: grid; }
      .polis-grid { grid-template-columns: 1fr; }
      .atlasScenarioGrid { grid-template-columns: 1fr; }
      .trait-row { grid-template-columns: 1fr; }
      .trait-row b { justify-self: start; }
      .participantAddressLink { font-size: 0.95rem; }
    }
    @media (max-width: 980px) {
      .primaryGrid,
      .secondaryGrid { grid-template-columns: 1fr; }
      .aidb-ai-analysis-grid { grid-template-columns: 1fr; }
      .selectorLayout, .selectorLayout.breakdownTraitGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .selectedQuestionGrounding { align-items: flex-start; flex-direction: column; }
      .selectedQuestionGroundingPills { justify-content: flex-start; margin-left: 0; max-width: 100%; }
    }
    @media (max-width: 768px) {
      .aidb-benchmark-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .aidb-benchmark-facts > div { border-left: 0; border-top: 1px solid rgba(255, 255, 255, 0.13); }
      .aidb-benchmark-facts > div:nth-child(-n + 2) { border-top: 0; }
      .aidb-benchmark-facts > div:nth-child(even) { border-left: 1px solid rgba(255, 255, 255, 0.13); }
      .swarmContainer { overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
      .swarmContainer::-webkit-scrollbar { display: none; }
      .debateMap { padding: 0; }
      .debateMap .controls { flex-direction: column; align-items: stretch; }
      .debateMap .viewModeSwitch { flex-wrap: wrap; gap: 4px; max-width: 100%; overflow: hidden; }
      .debateMap .viewModeSwitch button { flex: 1 1 calc(50% - 4px); min-width: 7rem; }
      .debateMap .viewModeSeparator { display: none; }
      .debateMap .inlineLegendItem { flex: 1 1 42%; margin: 2px 0; white-space: normal; line-height: 1.15; }
      .debateMap .secondaryControls { margin-left: 0; }
      .debateMap .atlasBrowseControls { width: 100%; justify-content: flex-start; }
      .debateMap .atlasBrowseField { flex: 1 1 130px; }
      .debateMap .atlasBrowseControls select { width: 100%; min-width: 0; }
      .debateMap .atlasTagFilter summary { width: 100%; min-width: 0; }
      .debateMap .atlasTagMenu { width: min(310px, calc(100vw - 64px)); }
      .debateMap .atlasBrowseStatus { flex: 1 1 100%; }
      .debateMap .atlasViewContainer { height: 75vh; }
      .debateMap .topNodesOverlay { width: calc(100% - 40px); top: 60px; }
      .atlasIssueModalOverlay { padding: 16px 10px; }
      .atlasIssueModalContent { width: 94%; max-height: calc(100vh - 32px); padding: 20px; }
      .atlasIssueModalHeader { align-items: flex-start; }
      .atlasIssueModalTitle { font-size: 1.35rem; }
      .atlasIssueModalClose { position: fixed; right: 25px; bottom: 25px; z-index: 2005; width: 50px; height: 50px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: var(--ce-radius-round); background: #1e293b; color: var(--ce-color-white); box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5); }
      .atlasIssueFindingGrid { grid-template-columns: 1fr; }
    }
    @media only screen and (min-width: 768px) and (max-width: 1024px) {
      .onePageDemoContainer { font-size: 1.15rem; padding: 15px 25px; padding-top: 0 !important; }
      .ce-session-results-section > .sectionHeaderRow > .sectionHeader { font-size: 1.6em; }
      .ce-session-results-section > .sectionHeaderRow > .sectionHeader .sectionHeaderText { flex-direction: column; align-items: flex-start; gap: 4px; }
      .sectionHeaderViewModeButton { min-height: 48px; min-width: 132px; padding: 10px 18px; font-size: 0.92rem; }
      .miniSectionContent { padding: 12px; }
    }
    @media (min-width: 1280px) {
      .selectorLayout, .selectorLayout.breakdownTraitGrid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    }
    @media only screen and (min-width: 601px) and (max-width: 767px) {
      .ce-session-results-section > .sectionHeaderRow > .sectionHeader { align-items: center; font-size: 1.6em; padding-left: 10px; }
      .ce-session-results-section > .sectionHeaderRow > .sectionHeader .sectionHeaderText { flex-direction: row; align-items: center; flex-wrap: wrap; gap: 6px 12px; }
      .ce-session-results-section > .sectionHeaderRow > .sectionHeader .sectionHeaderSubtitle { font-size: 1.2em; font-weight: inherit; line-height: 1; color: rgba(255, 255, 255, 0.15); }
      .ce-session-results-section > .sectionHeaderRow { gap: 12px; }
    }
    @media (max-width: 768px) {
      .resultsModal { max-width: 95vw; }
      .aidb-raw-results-dialog { margin: 0.5rem auto; }
      .modalHeader { flex-wrap: wrap; gap: 10px; padding-right: 7rem; }
      .modalHeaderContent { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; }
      .modalHeaderTitleBlock { width: 100%; }
      .modalTitle { font-size: 1.8rem; }
      .settingsRow { flex-wrap: wrap; justify-content: flex-start; gap: 10px; }
      .settingsRow > div { margin-right: 0 !important; }
      .graphItem { flex: 1 1 100%; max-width: 100%; width: 100%; }
      .exportDataBox { align-items: flex-end; flex: 0 1 auto; min-width: 0; }
      .exportToggleButton { min-height: 42px; padding: 0.5rem 0.75rem !important; font-size: 0.95rem; line-height: 1.1; }
      .exportAreaExpanded { align-items: flex-end; width: 100%; max-width: min(100%, 360px); padding: 8px; }
      #exportOptions { flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: flex-end; width: 100%; gap: 8px; }
      .downloadButton { width: 100%; }
      .debateMap .atlasNode { left: var(--atlas-mobile-left, var(--atlas-left, 50%)); top: var(--atlas-mobile-top, var(--atlas-top, 50%)); }
      .debateMap .atlasNode.packedAtlasNode .packedNodeDot { width: var(--topic-mobile-diameter, var(--topic-diameter, 124px)); height: var(--topic-mobile-diameter, var(--topic-diameter, 124px)); }
      .debateMap .atlasNode.packedAtlasNode .packedNodeLabel { font-size: var(--topic-mobile-font-size, 9px) !important; line-height: 1.04; letter-spacing: 0; overflow-wrap: normal; word-break: normal; hyphens: none; }
    }
    @media (max-width: 767px) {
      .modalHeaderControls { width: 100%; justify-content: flex-start; flex-wrap: nowrap; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
      .demoResultsViewNav { width: auto; min-width: 0; flex: 1 1 auto; flex-wrap: nowrap; gap: 6px; }
      .demoResultsViewButton { flex: 0 0 auto; justify-content: center; min-height: 34px; padding: 0.38rem 0.64rem; font-size: 0.84rem; }
    }
    @media (max-width: 640px) {
      .tagExplorerModalOverlay { padding: 0; }
      .tagExplorerModalContent { width: 100%; height: 100vh; border-radius: 0; }
      .tagExplorerModalHeaderBar { min-height: 58px; padding: 10px 14px; }
      .tagExplorerModalScrollArea { padding: 16px; }
      .tagExplorerQuestionList { grid-template-columns: 1fr; }
      .atlasIssueMetricGrid { grid-template-columns: 1fr; }
      .atlasIssueMetricGrid > div { border-right: 0; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
      .atlasIssueMetricGrid > div:last-child { border-bottom: 0; }
      .demoAnalysisWorkspace .selectedQuestionFrame { padding: 1rem; }
      .demoAnalysisWorkspace .demoPanel { padding: 0.9rem; }
      .breakdownTraitGrid, .selectorLayout, .selectorLayout.breakdownTraitGrid { grid-template-columns: 1fr; }
      .demoAnalysisWorkspace .mapFrameViewport { min-height: 240px; padding-left: 0.5rem; padding-right: 0.5rem; }
      .demoAnalysisWorkspace .breakdownDatasetHeader { align-items: flex-start; flex-direction: column; gap: 0.25rem; }
    }
    @media only screen and (max-width: 600px) {
      .onePageDemoContainer { font-size: 1rem; padding: 5px; padding-top: 0 !important; }
      .ce-session-results-section { padding-left: 0; padding-right: 0; border: none; }
      .ce-session-results-section > .sectionHeaderRow > .sectionHeader { align-items: center; font-size: 1.6em; padding-left: 10px; }
      .ce-session-results-section > .sectionHeaderRow > .sectionHeader .sectionHeaderText { flex-direction: row; align-items: center; flex-wrap: wrap; gap: 6px 12px; }
      .ce-session-results-section > .sectionHeaderRow > .sectionHeader .sectionHeaderSubtitle { font-size: 1em; font-weight: inherit; line-height: 1; color: rgba(255, 255, 255, 0.15); }
      .ce-session-results-section > .sectionHeaderRow { gap: 12px; }
      .sectionHeaderActionsScroller { width: 100%; justify-content: flex-start; padding-left: 10px; }
      .sectionHeaderActions { justify-content: flex-start; }
      .sectionHeaderViewModeButton { flex: 0 0 auto; min-height: 46px; min-width: 128px; padding: 10px 16px; font-size: 0.92rem; gap: 8px; }
      .miniSectionContent { padding: 10px; }
      .riskMatrixSectionCard { padding: 12px; }
      .riskMatrixContainer { padding: 0; }
      .htmlReportSectionTable th, .htmlReportSectionTable td { min-width: 5.75rem; padding: 8px 9px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .debateMap,
      .debateMap * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
      .debateMap .voteInputGroup { animation: none !important; }
    }
    @media (max-width: 480px) {
      .aidb-benchmark-intro { padding: 12px 15px 20px; }
      .aidb-benchmark-intro h1 { font-size: 1.6rem; }
      .aidb-benchmark-facts { grid-template-columns: 1fr; }
      .aidb-benchmark-facts > div,
      .aidb-benchmark-facts > div:nth-child(even),
      .aidb-benchmark-facts > div:nth-child(-n + 2) { border-left: 0; border-top: 1px solid rgba(255, 255, 255, 0.13); }
      .aidb-benchmark-facts > div:first-child { border-top: 0; }
      .participantAddressFull { display: none; }
      .participantAddressShort { display: inline; }
    }
  </style>
</head>
<body class="index-page ce-report-viewer aidb-report" data-ce-results-view-mode="report" data-ce-report-style="original">
  <div id="root">
  <div data-testid="ce-page-session-root">
  <div class="onePageDemoContainer">
    <div class="sectionsGrid">
    ${renderBenchmarkIntroduction(report)}
    <div class="sectionContainer sectionExpanded ce-session-results-section" data-ce-results-section data-ce-results-open="true">
      <div class="sectionHeaderRow">
        <h2 class="sectionHeader" data-ce-results-toggle role="button" tabindex="0" aria-expanded="true">
          ${renderFontAwesomeIcon('caret-up', 'sectionToggleIcon sectionToggleIconOpen')}
          ${renderFontAwesomeIcon('caret-down', 'sectionToggleIcon sectionToggleIconClosed')}
          <span class="sectionHeaderText">
            <span class="sectionHeaderTitle">Results</span>
            <span class="sectionHeaderSubtitle">View</span>
          </span>
          <span class="tooltip sectionHeaderTooltip" tabindex="0" aria-label="Results view help" data-ce-results-tooltip>
            ${renderFontAwesomeIcon('question-circle')}
            <span class="tooltiptext">Click “Raw Results” to explore detailed breakdowns, filter by group membership, and export a pol.is report.</span>
          </span>
        </h2>
        <div class="sectionHeaderActionsScroller resultsModeActionsScroller">
          <div class="sectionHeaderActions resultsModeActions" data-testid="ce-session-results-view-nav">
            <button type="button" class="sectionHeaderViewModeButton sectionHeaderViewModeButtonActive" data-ce-report-view-mode="report" aria-pressed="true" title="Report"><span class="sectionHeaderViewModeIcon" aria-hidden="true">🧾</span><span class="sectionHeaderViewModeLabel">Report</span></button>
            <button type="button" class="sectionHeaderViewModeButton" data-ce-report-view-mode="debate-atlas" aria-pressed="false" title="Debate Map"><span class="sectionHeaderViewModeIcon" aria-hidden="true">🗺️</span><span class="sectionHeaderViewModeLabel">Debate Map</span></button>
            <button type="button" class="sectionHeaderViewModeButton" data-ce-report-view-mode="breakdown" aria-pressed="false" title="Breakdown"><span class="sectionHeaderViewModeIcon" aria-hidden="true">📊</span><span class="sectionHeaderViewModeLabel">Breakdown</span></button>
            <button type="button" class="sectionHeaderViewModeButton" data-ce-report-view-mode="risk-matrix" aria-pressed="false" title="Risk Matrix"><span class="sectionHeaderViewModeIcon" aria-hidden="true">⚠️</span><span class="sectionHeaderViewModeLabel">Risk Matrix</span></button>
            <button type="button" class="sectionHeaderViewModeButton" data-ce-open-raw-results>${renderFontAwesomeIcon('expand')}Raw Results</button>
          </div>
        </div>
      </div>
      <div class="miniSectionContent">
        <div>
        <div class="polisReportContainer ce-polis-report-shell" data-ce-report-shell="polis">
          <div class="pdfIgnore" data-ce-report-settings-toggle-row style="text-align:right;display:flex;justify-content:flex-end;align-items:center;gap:10px;">
            <button type="button" data-ce-report-settings-toggle data-testid="ce-polis-settings-toggle" aria-label="Show report settings" title="Toggle settings row" style="background:transparent;border:none;padding:0;cursor:pointer;margin-right:10px;color:inherit;">
              ${renderFontAwesomeIcon('cog', '', 'style="font-size:1.3rem;"')}
            </button>
          </div>
          <div class="pdfIgnore settingsRow" data-ce-report-settings-row hidden>
            <div style="margin-right:12px;position:relative;">
              <button type="button" data-ce-static-pdf-button title="Download the currently open sections of the report" style="padding:6px 12px;cursor:pointer;margin-right:4px;">Download as PDF ${renderFontAwesomeIcon('info-circle', '', 'style="margin-left:4px;"')}</button>
            </div>
            <div style="margin-right:12px;">
              <label class="demoToggleLabel" style="margin-right:10px;">
                <input type="checkbox" class="demoToggleCheckbox" checked>
                Demo Data
              </label>
            </div>
            <div style="margin-right:12px;">
              <label class="demoToggleLabel" style="margin-right:5px;">
                <input type="checkbox" checked style="margin-right:4px;cursor:pointer;">
                Show Explainers
              </label>
            </div>
            <div style="margin-right:12px;">
              <label class="demoToggleLabel" for="report-style-select" style="margin-right:6px;">Report style:</label>
              <select id="report-style-select" class="reportStyleSelect" aria-label="Report style" data-ce-report-style-select>
                <option value="original" selected>Original</option>
                <option value="modern">Modern</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <div style="margin-right:12px;">
              <button type="button" style="margin-right:4px;" data-ce-report-collapse-all>Collapse All</button>
              <button type="button" style="margin-right:8px;" data-ce-report-expand-all>Expand All</button>
            </div>
          </div>
          <div class="reportInner">
            <div class="brandingHeader"></div>
            <h4 class="heading"></h4>
            ${renderIntegrityNotice(report)}
            <div class="disclaimerBox">
              <strong>Note:</strong> Only non-encrypted, binary
              (Agree/Disagree/Unsure) responses have been considered in
              this Polis-inspired report.
            </div>
            ${renderSummaryStats(report)}
            ${renderAiAnalysis(report)}
            ${renderConsensusAndDifference(report)}
            ${renderParticipantGraph(report)}
            ${renderQuestionExplorer(report)}
            ${renderParticipantsList(report)}
          </div>
        </div>
        <div class="ce-results-mode-surfaces" data-ce-results-mode-surfaces>
          ${renderDebateAtlas(report)}
          ${renderBreakdown(report)}
          ${renderRiskMatrix(report)}
          ${renderSnapshotJson(report)}
        </div>
        </div>
      </div>
    </div>
    </div>
  </div>
  </div>
  </div>
  <div class="tagExplorerModalOverlay" data-ce-tag-modal hidden role="dialog" aria-modal="true" aria-labelledby="ce-tag-modal-title">
    <div class="tagExplorerModalContent" data-ce-tag-modal-content tabindex="-1">
      <div class="tagExplorerModalHeaderBar">
        <span>Tag explorer</span>
        <button type="button" class="tagExplorerModalClose" data-ce-tag-modal-close aria-label="Close tag explorer">
          ${renderFontAwesomeIcon('times')}
        </button>
      </div>
      <div class="tagExplorerModalBody">
        <div class="tagExplorerModalScrollArea" data-ce-tag-modal-scroll>
          <header class="tagExplorerHeader">
            <h2 class="tagExplorerTitle" id="ce-tag-modal-title">
              <span class="tagExplorerTitlePill">#<span data-ce-tag-modal-title>Tag</span></span>
            </h2>
            <p class="tagExplorerSummary" data-ce-tag-modal-summary></p>
          </header>
          <section class="tagExplorerSection" aria-labelledby="ce-tag-modal-questions-title">
            <div class="tagExplorerSectionHeader">
              <h3 id="ce-tag-modal-questions-title">Questions</h3>
              <span data-ce-tag-modal-count>0</span>
            </div>
            <div class="tagExplorerQuestionList" data-ce-tag-modal-questions></div>
          </section>
        </div>
      </div>
    </div>
  </div>
  <div class="beeTooltip" data-ce-beeswarm-tooltip role="tooltip" hidden></div>
  <script type="application/json" id="ce-ai-discourse-bench-report">${serializeJsonForHtmlScript(report)}</script>
  <script type="application/json" id="ce-ai-discourse-bench-polis-export">${serializeJsonForHtmlScript(buildContextEnginePolisExport(report))}</script>
  <script type="application/json" id="ce-ai-discourse-bench-analysis-input">${serializeJsonForHtmlScript(buildSecondPassAnalysisInput(report))}</script>
  <script>
    (function () {
      var snapshotEl = document.getElementById('ce-ai-discourse-bench-report');
      var polisExportEl = document.getElementById('ce-ai-discourse-bench-polis-export');
      var analysisInputEl = document.getElementById('ce-ai-discourse-bench-analysis-input');
      var downloadButtons = Array.from(document.querySelectorAll('[data-ce-download-snapshot]'));
      var polisExportButtons = Array.from(document.querySelectorAll('[data-ce-download-polis-export]'));
      var analysisInputButtons = Array.from(document.querySelectorAll('[data-ce-download-analysis-input]'));
      var staticPdfButton = document.querySelector('[data-ce-static-pdf-button]');
      var exportToggleButtons = Array.from(document.querySelectorAll('[data-ce-export-toggle]'));
      var exportArea = document.getElementById('surveyResultsExportArea');
      var exportDataBox = document.querySelector('[data-ce-export-data-box]');
      var settingsToggleButton = document.querySelector('[data-ce-report-settings-toggle]');
      var settingsRow = document.querySelector('[data-ce-report-settings-row]');
      var reportShell = document.querySelector('[data-ce-report-shell="polis"]');
      var reportInner = document.querySelector('.reportInner');
      var reportStyleSelect = document.querySelector('[data-ce-report-style-select]');
      var collapseAllButton = document.querySelector('[data-ce-report-collapse-all]');
      var expandAllButton = document.querySelector('[data-ce-report-expand-all]');
      var resultsSection = document.querySelector('[data-ce-results-section]');
      var resultsToggle = document.querySelector('[data-ce-results-toggle]');
      var resultsTooltip = document.querySelector('[data-ce-results-tooltip]');
      var questionExplorer = document.getElementById('all-questions');
      var questionModelLegend = questionExplorer ? questionExplorer.querySelector('.questionModelLegend') : null;
      var beeswarmTooltip = document.querySelector('[data-ce-beeswarm-tooltip]');
      function normalizeSharedHash(value) {
        var candidate = String(value || '');
        var hash = candidate.charAt(0) === '#' ? candidate : '#' + candidate;
        return /^#[a-z0-9][a-z0-9._~!$&'()*+,;=:@%/-]{0,255}$/i.test(hash) ? hash : '';
      }
      function notifyParentHash() {
        if (window.parent === window) return;
        var hash = normalizeSharedHash(window.location.hash) || '#report';
        try {
          window.parent.postMessage({ type: 'ce-benchmark-hash-change', hash: hash }, '*');
        } catch (error) {
          // Standalone reports do not need parent synchronization.
        }
      }
      window.addEventListener('message', function (event) {
        if (event.source !== window.parent || !event.data || event.data.type !== 'ce-benchmark-set-hash') return;
        var hash = normalizeSharedHash(event.data.hash);
        if (!hash || window.location.hash === hash) return;
        window.location.hash = hash;
      });
      var participantClusterPayloadEl = document.getElementById('ce-ai-discourse-bench-participant-clusters');
      var participantGraph = document.querySelector('[data-ce-participant-graph]');
      var clusterCountInput = document.querySelector('[data-ce-cluster-count-input]');
      var clusterStepButtons = Array.from(document.querySelectorAll('[data-ce-cluster-step]'));
      var clusterAutoButton = document.querySelector('[data-ce-cluster-auto]');
      var clusterLegendItems = document.querySelector('[data-ce-cluster-legend-items]');
      var opinionGroupStatus = document.querySelector('[data-ce-opinion-group-status]');
      var riskMatrixPayloadEl = document.getElementById('ce-ai-discourse-bench-risk-matrix-analysis');
      var riskMatrixModal = document.querySelector('[data-ce-risk-matrix-modal]');
      var riskMatrixBackdrop = document.querySelector('[data-ce-risk-matrix-backdrop]');
      var riskMatrixModalTitle = document.querySelector('[data-ce-risk-matrix-modal-title]');
      var riskMatrixModalMeta = document.querySelector('[data-ce-risk-matrix-modal-meta]');
      var riskMatrixScenarioRail = document.querySelector('[data-ce-risk-matrix-scenario-rail]');
      var riskMatrixCommentList = document.querySelector('[data-ce-risk-matrix-comment-list]');
      var riskMatrixEmpty = document.querySelector('[data-ce-risk-matrix-empty]');
      var riskMatrixCloseButtons = Array.from(document.querySelectorAll('[data-ce-risk-matrix-close]'));
      var modeButtons = Array.from(document.querySelectorAll('[data-ce-report-view-mode]'));
      var rawResultsButton = document.querySelector('[data-ce-open-raw-results]');
      var closeRawResultsButtons = document.querySelectorAll('[data-ce-close-raw-results]');
      var rawDemoViewButtons = Array.from(document.querySelectorAll('[data-ce-raw-demo-view]'));
      var breakdownSuggestionButtons = Array.from(document.querySelectorAll('[data-ce-breakdown-suggestion]'));
      var breakdownSuggestionsList = document.querySelector('[data-ce-breakdown-suggestions-list]');
      var breakdownSuggestionsStatus = document.querySelector('[data-ce-breakdown-suggestions-status]');
      var breakdownSelectedPrompt = document.querySelector('[data-ce-breakdown-selected-prompt]');
      var breakdownSelectedTension = document.querySelector('[data-ce-breakdown-selected-tension]');
      var breakdownSelectedTopic = document.querySelector('[data-ce-breakdown-selected-topic]');
      var breakdownSelectedPills = document.querySelector('[data-ce-breakdown-selected-pills]');
      var breakdownList = document.querySelector('[data-ce-breakdown-list]');
      var breakdownComparisonReport = document.querySelector('[data-ce-breakdown-comparison-report]');
      var breakdownQuestionBanner = document.querySelector('[data-ce-breakdown-question-id]');
      var breakdownGroupInputs = Array.from(document.querySelectorAll('[data-ce-breakdown-group-input]'));
      var breakdownTraitMenus = Array.from(document.querySelectorAll('[data-ce-breakdown-trait]'));
      var breakdownClearButton = document.querySelector('[data-ce-breakdown-clear]');
      var breakdownAutoButton = document.querySelector('[data-ce-breakdown-auto]');
      var breakdownFilterEmpty = document.querySelector('[data-ce-breakdown-filter-empty]');
      var atlasTopDebatesButton = document.querySelector('[data-ce-atlas-top-debates-toggle]');
      var atlasTopDebatesOverlay = document.querySelector('[data-ce-atlas-top-debates-overlay]');
      var atlasTopDebatesCloseButton = document.querySelector('[data-ce-atlas-top-debates-close]');
      var atlasIssueModal = document.querySelector('[data-ce-atlas-issue-modal]');
      var atlasIssueModalContent = document.querySelector('[data-ce-atlas-issue-modal-content]');
      var atlasIssueModalTitle = document.querySelector('[data-ce-atlas-issue-modal-title]');
      var atlasIssueModalBody = document.querySelector('[data-ce-atlas-issue-modal-body]');
      var atlasIssueModalCloseButtons = Array.from(document.querySelectorAll('[data-ce-atlas-issue-close]'));
      var atlasIssueCopyLinkButton = document.querySelector('[data-ce-atlas-issue-copy-link]');
      var atlasIssueTemplates = Array.from(document.querySelectorAll('[data-ce-atlas-issue-template]'));
      var atlasOpenButtons = Array.from(document.querySelectorAll('[data-ce-atlas-open]'));
      var atlasNodes = Array.from(document.querySelectorAll('[data-testid="ce-atlas-node"][data-ce-atlas-open]'));
      var atlasTagFilter = document.querySelector('[data-ce-atlas-tag-filter]');
      var atlasTagFilterSummary = document.querySelector('[data-ce-atlas-tag-summary]');
      var atlasTagInputs = Array.from(document.querySelectorAll('[data-ce-atlas-tag-option]'));
      var atlasTagClearButton = document.querySelector('[data-ce-atlas-tag-clear]');
      var atlasSortSelect = document.querySelector('[data-ce-atlas-sort]');
      var atlasBrowseStatus = document.querySelector('[data-ce-atlas-browser-status]');
      var tagModal = document.querySelector('[data-ce-tag-modal]');
      var tagModalContent = document.querySelector('[data-ce-tag-modal-content]');
      var tagModalTitle = document.querySelector('[data-ce-tag-modal-title]');
      var tagModalSummary = document.querySelector('[data-ce-tag-modal-summary]');
      var tagModalCount = document.querySelector('[data-ce-tag-modal-count]');
      var tagModalQuestions = document.querySelector('[data-ce-tag-modal-questions]');
      var tagModalScroll = document.querySelector('[data-ce-tag-modal-scroll]');
      var tagModalCloseButtons = Array.from(document.querySelectorAll('[data-ce-tag-modal-close]'));
      var atlasLayoutSlots = atlasNodes.map(function (node) {
        return {
          left: node.style.getPropertyValue('--atlas-left'),
          top: node.style.getPropertyValue('--atlas-top'),
          mobileLeft: node.style.getPropertyValue('--atlas-mobile-left'),
          mobileTop: node.style.getPropertyValue('--atlas-mobile-top'),
          zIndex: node.style.zIndex
        };
      });
      var activeAtlasIssueId = '';
      var atlasIssueLastFocus = null;
      var hoveredAtlasModelId = '';
      var focusedAtlasModelId = '';
      var lockedAtlasModelId = '';
      var hoveredQuestionModelId = '';
      var focusedQuestionModelId = '';
      var lockedQuestionModelIds = new Set();
      var activeTagModalTag = '';
      var tagModalLastFocus = null;
      var tagModalPreviousHash = '#report';
      var modeSections = Array.from(document.querySelectorAll('[data-ce-report-mode-section]'));
      var staticCollapsibles = Array.from(document.querySelectorAll('[data-ce-static-collapsible]'));
      var knownModes = ['report', 'debate-atlas', 'breakdown', 'risk-matrix', 'snapshot-json'];
      var lastNonRawResultsMode = 'report';
      function setExportAreaOpen(isOpen) {
        var nextOpen = !!isOpen;
        if (exportArea) exportArea.hidden = !nextOpen;
        if (exportDataBox) exportDataBox.setAttribute('data-ce-export-open', nextOpen ? 'true' : 'false');
        exportToggleButtons.forEach(function (button) {
          var isCollapsedToggle = button.classList && button.classList.contains('exportToggleButton');
          if (isCollapsedToggle) {
            button.hidden = nextOpen;
            button.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
          }
        });
      }
      function escapeText(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
          return ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
          })[char];
        });
      }
      function percent(part, total) {
        return String(Math.max(0, Math.min(100, (Number(part || 0) / Math.max(1, Number(total || 0))) * 100)));
      }
      function parseEmbeddedJson(element) {
        if (!element) return null;
        try {
          return JSON.parse(element.textContent || 'null');
        } catch (error) {
          return null;
        }
      }
      var reportSnapshot = parseEmbeddedJson(snapshotEl) || {};
      var breakdownCurrentQuestionId = breakdownQuestionBanner
        ? String(breakdownQuestionBanner.getAttribute('data-ce-breakdown-question-id') || '')
        : '';
      var breakdownSelectedGroupKeys = new Set(breakdownGroupInputs.filter(function (input) {
        return input.checked;
      }).map(function (input) {
        return String(input.getAttribute('data-ce-breakdown-group-key') || input.value || '');
      }).filter(Boolean));
      var breakdownCurrentSuggestions = [];
      var breakdownActiveSuggestion = null;
      var breakdownParticipantLabels = (reportSnapshot.participants || []).reduce(function (map, participant) {
        map[String(participant.id)] = String(participant.label || participant.id);
        return map;
      }, {});
      var breakdownGroupIndex = {};
      Object.keys(reportSnapshot.breakdown || {}).forEach(function (trait) {
        Object.keys(reportSnapshot.breakdown[trait] || {}).forEach(function (value) {
          var key = trait + ':' + value;
          breakdownGroupIndex[key] = {
            key: key,
            trait: trait,
            value: value,
            ids: Array.from(reportSnapshot.breakdown[trait][value] || []).map(String)
          };
        });
      });
      var participantClusterPayload = parseEmbeddedJson(participantClusterPayloadEl);
      var autoClusterLegendHtml = clusterLegendItems ? clusterLegendItems.innerHTML : '';
      var riskMatrixPayload = parseEmbeddedJson(riskMatrixPayloadEl) || { cells: {} };
      function riskMatrixIcon(name, className) {
        var icons = {
          'network-wired': {
            viewBox: '0 0 640 512',
            path: 'M640 264v-48c0-13.3-10.7-24-24-24H368v-64h72c13.3 0 24-10.7 24-24V24c0-13.3-10.7-24-24-24H200c-13.3 0-24 10.7-24 24v80c0 13.3 10.7 24 24 24h72v64H24c-13.3 0-24 10.7-24 24v48c0 13.3 10.7 24 24 24h80v64H56c-13.3 0-24 10.7-24 24v112c0 13.3 10.7 24 24 24h176c13.3 0 24-10.7 24-24V376c0-13.3-10.7-24-24-24h-48v-64h272v64h-48c-13.3 0-24 10.7-24 24v112c0 13.3 10.7 24 24 24h176c13.3 0 24-10.7 24-24V376c0-13.3-10.7-24-24-24h-48v-64h80c13.3 0 24-10.7 24-24z'
          },
          'external-link-alt': {
            viewBox: '0 0 512 512',
            path: 'M432 320h-32a16 16 0 0 0-16 16v112H64V128h144a16 16 0 0 0 16-16V80a16 16 0 0 0-16-16H48A48 48 0 0 0 0 112v352a48 48 0 0 0 48 48h352a48 48 0 0 0 48-48V336a16 16 0 0 0-16-16zM488 0H360c-21.37 0-32.05 25.91-17 41l35.73 35.73L135 320.37a24 24 0 0 0 0 34L157.67 377a24 24 0 0 0 34 0l243.61-243.68L471 169c15.11 15.11 41 4.41 41-17V24a24 24 0 0 0-24-24z'
          }
        };
        var icon = icons[name];
        if (!icon) return '';
        return '<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="' + escapeText(name) + '" class="' + escapeText('svg-inline--fa fa-' + name + (className ? ' ' + className : '')) + '" xmlns="http://www.w3.org/2000/svg" viewBox="' + escapeText(icon.viewBox) + '"><path fill="currentColor" d="' + escapeText(icon.path) + '"></path></svg>';
      }
      function toTestIdFragment(value) {
        return String(value || 'scenario').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'scenario';
      }
      function formatRiskModalCellTitle(point) {
        var cellId = point && point.getAttribute ? point.getAttribute('data-risk-cell-id') : '';
        if (!cellId) return 'Interaction detail';
        if (cellId.indexOf('_vs_') !== -1) {
          var pair = cellId.split('_vs_');
          return 'Interaction: ' + pair[0] + ' vs ' + pair[1];
        }
        var parts = cellId.split('.');
        if (parts.length === 4) return parts[0] + ' / ' + parts[1] + ' vs ' + parts[2] + ' / ' + parts[3];
        return cellId;
      }
      function formatRiskModalPath(cellId) {
        var parts = String(cellId || '').split('.');
        if (parts.length !== 4) return cellId || '';
        return parts[0] + ' / ' + parts[1] + ' -> ' + parts[2] + ' / ' + parts[3];
      }
      function renderRiskCommentGroup(title, entries, valence, isAggregate) {
        if (!Array.isArray(entries) || !entries.length) return '';
        var groupClass = valence === 'opportunity' ? 'commentSectionOpportunity' : 'commentSectionRisk';
        var itemClass = valence === 'opportunity' ? 'commentItemOpportunity' : 'commentItemRisk';
        var listItems = entries.map(function (entry) {
          var cardTitle = isAggregate
            ? formatRiskModalPath(entry.cell)
            : (valence === 'opportunity' ? 'Opportunity signal' : 'Risk signal');
          return '<li class="commentItem ' + itemClass + '">' +
            '<div class="commentHeader">' +
              '<div class="commentHeaderMain">' +
                '<span class="commentEyebrow">' + (isAggregate ? 'Sub-overlap' : 'Seeded note') + '</span>' +
                '<h5 class="commentCardTitle">' + escapeText(cardTitle) + '</h5>' +
              '</div>' +
              '<div class="commentHeaderMeta">' +
                '<span class="commentIntensity">Intensity ' + escapeText(entry.intensity) + '</span>' +
                '<span class="commentBadge">' + (valence === 'opportunity' ? 'Opportunity' : 'Risk') + '</span>' +
              '</div>' +
            '</div>' +
            '<p class="commentText">' + escapeText(entry.comment || '') + '</p>' +
          '</li>';
        }).join('');
        return '<section class="commentSection ' + groupClass + '">' +
          '<div class="commentSectionHeader">' +
            '<span class="commentSectionHeaderText"><span class="commentSectionTitle">' + escapeText(title) + '</span></span>' +
            '<span class="commentSectionCount">' + entries.length + ' note' + (entries.length === 1 ? '' : 's') + '</span>' +
          '</div>' +
          '<ul class="commentList" data-testid="ce-risk-matrix-comment-list-' + escapeText(valence) + '">' + listItems + '</ul>' +
        '</section>';
      }
      function renderRiskAiBulletGroup(title, entries, valence) {
        if (!Array.isArray(entries) || !entries.length) return '';
        var groupClass = valence === 'opportunity' ? 'commentSectionOpportunity' : 'commentSectionRisk';
        var itemClass = valence === 'opportunity' ? 'commentItemOpportunity' : 'commentItemRisk';
        var listItems = entries.map(function (entry) {
          return '<li class="commentItem ' + itemClass + '">' +
            '<p class="commentText">' + escapeText(entry) + '</p>' +
          '</li>';
        }).join('');
        return '<section class="commentSection riskMatrixAiGeneratedSection ' + groupClass + '">' +
          '<div class="commentSectionHeader">' +
            '<span class="commentSectionHeaderText"><span class="commentSectionTitle">' + escapeText(title) + '</span></span>' +
            '<span class="commentSectionCount">AI generated</span>' +
          '</div>' +
          '<ul class="commentList">' + listItems + '</ul>' +
        '</section>';
      }
      function renderRiskAiSummary(payload) {
        if (!payload || (!payload.aiSummary && !payload.confidence && !payload.generatedBy && !payload.linkedQuestionIds?.length && !payload.linkedTopicIds?.length)) return '';
        var links = [];
        if (Array.isArray(payload.linkedQuestionIds) && payload.linkedQuestionIds.length) {
          links.push('Questions: ' + payload.linkedQuestionIds.join(', '));
        }
        if (Array.isArray(payload.linkedTopicIds) && payload.linkedTopicIds.length) {
          links.push('Topics: ' + payload.linkedTopicIds.join(', '));
        }
        if (payload.confidence) links.push('Confidence: ' + payload.confidence);
        if (payload.generatedBy) links.push('Generated by: ' + payload.generatedBy);
        return '<section class="riskMatrixAiSummary">' +
          (payload.aiSummary ? '<p>' + escapeText(payload.aiSummary) + '</p>' : '') +
          (links.length ? '<div class="riskMatrixAiMeta">' + escapeText(links.join(' | ')) + '</div>' : '') +
        '</section>';
      }
      function renderRiskAtlasScenarios(payload) {
        var scenarios = payload && Array.isArray(payload.scenarios) ? payload.scenarios : [];
        if (!scenarios.length) return '';
        var cards = scenarios.map(function (scenario, index) {
          var id = scenario.id || ('scenario-' + (index + 1));
          var atlasNodeId = scenario.atlasNodeId || scenario.topicId || scenario.linkedTopicId || '';
          var atlasNodeLabel = scenario.atlasNodeLabel || scenario.topicLabel || scenario.topic || atlasNodeId || 'Debate atlas overlap';
          var title = scenario.title || scenario.label || 'Generated atlas scenario';
          var summary = scenario.summary || scenario.description || '';
          var valence = String(scenario.valence || 'mixed').toLowerCase();
          var valenceClass = valence === 'risk'
            ? 'atlasScenarioValenceRisk'
            : (valence === 'opportunity' ? 'atlasScenarioValenceOpportunity' : 'atlasScenarioValenceMixed');
          var imageAlt = scenario.imageAlt || (title + ' visualization');
          var image = scenario.image
            ? '<img class="atlasScenarioImage" src="' + escapeText(scenario.image) + '" alt="' + escapeText(imageAlt) + '">'
            : '<div class="atlasScenarioImageFallback" aria-hidden="true"><span>' + escapeText(atlasNodeLabel) + '</span></div>';
          var meta = [];
          if (scenario.confidence) meta.push(String(scenario.confidence) + ' confidence');
          if (scenario.timeHorizon) meta.push(String(scenario.timeHorizon));
          var metaLine = meta.length
            ? '<div class="atlasScenarioMetaLine" aria-label="' + escapeText(meta.join(', ')) + '">' + meta.map(function (item) {
              return '<span class="atlasScenarioMetaPill">' + escapeText(item) + '</span>';
            }).join('') + '</div>'
            : '';
          var mechanism = scenario.primaryMechanism || scenario.mechanism || scenario.whyItMatters || '';
          var mechanismMarkup = mechanism
            ? '<div class="atlasScenarioMechanism"><span>Why it matters</span><p>' + escapeText(mechanism) + '</p></div>'
            : '';
          var anchors = Array.isArray(scenario.historicalAnchors) ? scenario.historicalAnchors : [];
          var anchorsMarkup = anchors.length
            ? '<div class="atlasScenarioAnchors" aria-label="Historical anchors">' + anchors.map(function (anchor) {
              if (!anchor || !anchor.name) return '';
              var avatar = anchor.avatar
                ? '<img class="atlasScenarioAnchorAvatar" src="' + escapeText(anchor.avatar) + '" alt="' + escapeText(anchor.name) + '">'
                : '<span class="atlasScenarioAnchorAvatar" aria-hidden="true"></span>';
              return '<div class="atlasScenarioAnchorChip">' +
                avatar +
                '<div class="atlasScenarioAnchorCopy">' +
                  '<span class="atlasScenarioAnchorName">' + escapeText(anchor.name) + '</span>' +
                  (anchor.role ? '<span class="atlasScenarioAnchorRole">' + escapeText(anchor.role) + '</span>' : '') +
                '</div>' +
              '</div>';
            }).join('') + '</div>'
            : '';
          var href = atlasNodeId ? '#debate-atlas-' + encodeURIComponent(atlasNodeId) : '#debate-atlas';
          return '<article class="atlasScenarioCard" data-testid="ce-risk-matrix-atlas-scenario-card">' +
            '<div class="atlasScenarioContent">' +
              '<div class="atlasScenarioHeader">' +
                '<div class="atlasScenarioHeaderMain">' +
                  image +
                  '<div class="atlasScenarioTitleBlock">' +
                    '<span class="atlasScenarioNodeLabel">' + escapeText(atlasNodeLabel) + '</span>' +
                    '<h4 class="atlasScenarioTitle">' + escapeText(title) + '</h4>' +
                    (summary ? '<p class="atlasScenarioSummary">' + escapeText(summary) + '</p>' : '') +
                    metaLine +
                  '</div>' +
                '</div>' +
                '<span class="atlasScenarioValence ' + valenceClass + '">' + escapeText(valence) + '</span>' +
              '</div>' +
              mechanismMarkup +
              anchorsMarkup +
              '<a class="atlasScenarioLink" aria-label="Open atlas node ' + escapeText(atlasNodeLabel) + '" data-testid="ce-risk-matrix-atlas-link-' + escapeText(toTestIdFragment(id)) + '" href="' + escapeText(href) + '">' +
                riskMatrixIcon('network-wired', 'atlasScenarioLinkIcon') +
                '<span class="atlasScenarioLinkLabel">' + escapeText(atlasNodeLabel) + '</span>' +
                riskMatrixIcon('external-link-alt', 'atlasScenarioLinkIconTrailing') +
              '</a>' +
            '</div>' +
          '</article>';
        }).join('');
        return '<section class="atlasScenarioRail" aria-label="Related atlas scenario visualizations"><div class="atlasScenarioGrid">' + cards + '</div></section>';
      }
      function closeRiskMatrixModal() {
        if (riskMatrixModal) riskMatrixModal.hidden = true;
        if (riskMatrixBackdrop) riskMatrixBackdrop.hidden = true;
        document.body.removeAttribute('data-ce-risk-matrix-modal-open');
      }
      function openRiskMatrixModal(point) {
        if (!riskMatrixModal || !riskMatrixBackdrop || !point) return;
        var cellId = point.getAttribute('data-risk-cell-id') || '';
        var payload = (riskMatrixPayload.cells && riskMatrixPayload.cells[cellId]) || null;
        var title = payload && payload.title ? payload.title : formatRiskModalCellTitle(point);
        var opportunities = payload && Array.isArray(payload.opportunities) ? payload.opportunities : [];
        var risks = payload && Array.isArray(payload.risks) ? payload.risks : [];
        var aiOpportunities = payload && Array.isArray(payload.aiOpportunities) ? payload.aiOpportunities : [];
        var aiRisks = payload && Array.isArray(payload.aiRisks) ? payload.aiRisks : [];
        var atlasScenarios = payload && Array.isArray(payload.scenarios) ? payload.scenarios : [];
        var totalNotes = opportunities.length + risks.length;
        var totalAiItems = (payload && payload.aiSummary ? 1 : 0) + aiOpportunities.length + aiRisks.length;
        var value = point.getAttribute('data-risk-value') || (payload && payload.value) || 0;
        var meta = totalNotes + ' note' + (totalNotes === 1 ? '' : 's');
        if (atlasScenarios.length) {
          meta += ' • ' + atlasScenarios.length + ' linked atlas overlap' + (atlasScenarios.length === 1 ? '' : 's');
        }
        meta += ' • balance ' + String(value || 0);
        if (riskMatrixModalTitle) riskMatrixModalTitle.textContent = title;
        if (riskMatrixModalMeta) riskMatrixModalMeta.textContent = meta;
        if (riskMatrixScenarioRail) {
          riskMatrixScenarioRail.innerHTML = renderRiskAtlasScenarios(payload);
        }
        if (riskMatrixCommentList) {
          riskMatrixCommentList.innerHTML = [
            renderRiskAiSummary(payload),
            renderRiskAiBulletGroup('AI Opportunities', aiOpportunities, 'opportunity'),
            renderRiskAiBulletGroup('AI Risks', aiRisks, 'risk'),
            renderRiskCommentGroup('Opportunities', opportunities, 'opportunity', payload && payload.type === 'aggregate'),
            renderRiskCommentGroup('Risks', risks, 'risk', payload && payload.type === 'aggregate')
          ].join('');
        }
        if (riskMatrixEmpty) riskMatrixEmpty.hidden = (totalNotes + totalAiItems + atlasScenarios.length) > 0;
        riskMatrixBackdrop.hidden = false;
        riskMatrixModal.hidden = false;
        document.body.setAttribute('data-ce-risk-matrix-modal-open', 'true');
        var closeButton = riskMatrixModal.querySelector('[data-ce-risk-matrix-close]');
        if (closeButton && closeButton.focus) closeButton.focus();
      }
      function setResultsSectionOpen(isOpen) {
        if (!resultsSection) return;
        var nextOpen = !!isOpen;
        resultsSection.setAttribute('data-ce-results-open', nextOpen ? 'true' : 'false');
        resultsSection.classList.toggle('sectionExpanded', nextOpen);
        if (resultsToggle) resultsToggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
      }
      function setReportStyle(style) {
        var nextStyle = ['original', 'modern', 'dark'].indexOf(style) === -1 ? 'original' : style;
        if (reportShell) {
          reportShell.classList.toggle('polisReportModern', nextStyle === 'modern');
          reportShell.classList.toggle('polisReportDark', nextStyle === 'dark');
        }
        if (reportInner) {
          reportInner.classList.toggle('reportInnerModern', nextStyle === 'modern');
          reportInner.classList.toggle('reportInnerDark', nextStyle === 'dark');
        }
        document.body.setAttribute('data-ce-report-style', nextStyle);
        if (reportStyleSelect && reportStyleSelect.value !== nextStyle) reportStyleSelect.value = nextStyle;
      }
      function setAtlasTopDebatesOpen(isOpen) {
        if (!atlasTopDebatesButton || !atlasTopDebatesOverlay) return;
        var nextOpen = !!isOpen;
        atlasTopDebatesOverlay.classList.toggle('visible', nextOpen);
        atlasTopDebatesButton.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
      }
      function getAtlasNodeTags(node) {
        if (!node) return [];
        try {
          var tags = JSON.parse(node.getAttribute('data-ce-atlas-tags') || '[]');
          return Array.isArray(tags) ? tags.map(String) : [];
        } catch (error) {
          return [];
        }
      }
      function getAtlasNodeNumber(node, attribute, fallback) {
        var raw = node ? node.getAttribute(attribute) : '';
        if (raw === null || raw === '') return fallback;
        var value = Number(raw);
        return Number.isFinite(value) ? value : fallback;
      }
      function compareAtlasNodes(left, right, sortMode) {
        var leftLabel = String(left.getAttribute('data-ce-atlas-label') || '');
        var rightLabel = String(right.getAttribute('data-ce-atlas-label') || '');
        if (sortMode === 'difference-desc') {
          return getAtlasNodeNumber(right, 'data-ce-atlas-difference', -1)
            - getAtlasNodeNumber(left, 'data-ce-atlas-difference', -1)
            || leftLabel.localeCompare(rightLabel);
        }
        if (sortMode === 'difference-asc') {
          return getAtlasNodeNumber(left, 'data-ce-atlas-difference', Number.POSITIVE_INFINITY)
            - getAtlasNodeNumber(right, 'data-ce-atlas-difference', Number.POSITIVE_INFINITY)
            || leftLabel.localeCompare(rightLabel);
        }
        if (sortMode === 'questions') {
          return getAtlasNodeNumber(right, 'data-ce-atlas-question-count', 0)
            - getAtlasNodeNumber(left, 'data-ce-atlas-question-count', 0)
            || leftLabel.localeCompare(rightLabel);
        }
        if (sortMode === 'importance') {
          return getAtlasNodeNumber(right, 'data-ce-atlas-importance', 0)
            - getAtlasNodeNumber(left, 'data-ce-atlas-importance', 0)
            || leftLabel.localeCompare(rightLabel);
        }
        if (sortMode === 'tag') {
          var leftTag = getAtlasNodeTags(left)[0] || '';
          var rightTag = getAtlasNodeTags(right)[0] || '';
          return leftTag.localeCompare(rightTag) || leftLabel.localeCompare(rightLabel);
        }
        if (sortMode === 'label') return leftLabel.localeCompare(rightLabel);
        return getAtlasNodeNumber(left, 'data-ce-atlas-order', 0)
          - getAtlasNodeNumber(right, 'data-ce-atlas-order', 0);
      }
      function computeAtlasBrowseSlots(nodes) {
        var goldenAngle = Math.PI * (3 - Math.sqrt(5));
        var packed = nodes.map(function (node, index) {
          var scale = Math.max(0.38, Math.min(1, getAtlasNodeNumber(node, 'data-ce-atlas-scale', 1)));
          var radius = 4.8 + (scale * 2.9);
          var angle = index * goldenAngle;
          var ring = Math.sqrt(index) * 5.9;
          return {
            index: index,
            radius: radius,
            x: 50 + (Math.cos(angle) * ring * 1.24),
            y: 53 + (Math.sin(angle) * ring * 0.86)
          };
        });
        for (var iteration = 0; iteration < 120; iteration += 1) {
          for (var leftIndex = 0; leftIndex < packed.length; leftIndex += 1) {
            for (var rightIndex = leftIndex + 1; rightIndex < packed.length; rightIndex += 1) {
              var left = packed[leftIndex];
              var right = packed[rightIndex];
              var dx = right.x - left.x;
              var dy = right.y - left.y;
              var distance = Math.sqrt((dx * dx) + (dy * dy)) || 0.001;
              var minDistance = left.radius + right.radius + 0.65;
              if (distance >= minDistance) continue;
              var push = (minDistance - distance) * 0.5;
              var nx = dx / distance;
              var ny = dy / distance;
              left.x -= nx * push;
              left.y -= ny * push;
              right.x += nx * push;
              right.y += ny * push;
            }
          }
          packed.forEach(function (slot) {
            slot.x += (50 - slot.x) * 0.01;
            slot.y += (54 - slot.y) * 0.006;
            slot.x = Math.max(8 + slot.radius, Math.min(92 - slot.radius, slot.x));
            slot.y = Math.max(16 + slot.radius, Math.min(90 - slot.radius, slot.y));
          });
        }
        var mobileColumns = Math.max(1, Math.min(3, packed.length || 1));
        var mobileRows = Math.max(1, Math.ceil(packed.length / mobileColumns));
        return packed.map(function (slot) {
          var mobileColumn = slot.index % mobileColumns;
          var mobileRow = Math.floor(slot.index / mobileColumns);
          return {
            left: slot.x.toFixed(2) + '%',
            top: slot.y.toFixed(2) + '%',
            mobileLeft: (((mobileColumn + 0.5) / mobileColumns) * 100).toFixed(2) + '%',
            mobileTop: (15 + (((mobileRow + 0.5) / mobileRows) * 76)).toFixed(2) + '%',
            zIndex: String(20 + slot.index)
          };
        });
      }
      function getSelectedAtlasTags() {
        return atlasTagInputs.filter(function (input) { return input.checked; }).map(function (input) {
          return String(input.value || '');
        }).filter(Boolean);
      }
      function updateAtlasTagSummary(selectedTags) {
        if (!atlasTagFilterSummary) return;
        var selectedInputs = atlasTagInputs.filter(function (input) { return selectedTags.indexOf(String(input.value || '')) !== -1; });
        var labels = selectedInputs.map(function (input) {
          return String(input.getAttribute('data-ce-atlas-tag-label') || input.value || '');
        }).filter(Boolean);
        atlasTagFilterSummary.textContent = labels.length === 0 ? 'All tags' : labels.length === 1 ? labels[0] : labels.length + ' tags';
        atlasTagFilterSummary.title = labels.join(', ');
      }
      function updateAtlasBrowse() {
        if (!atlasNodes.length) return;
        var selectedTags = getSelectedAtlasTags();
        var sortMode = atlasSortSelect ? String(atlasSortSelect.value || 'atlas') : 'atlas';
        var visibleNodes = atlasNodes.filter(function (node) {
          var nodeTags = getAtlasNodeTags(node);
          return selectedTags.length === 0 || selectedTags.some(function (tag) { return nodeTags.indexOf(tag) !== -1; });
        }).sort(function (left, right) {
          return compareAtlasNodes(left, right, sortMode);
        });
        var useOriginalLayout = selectedTags.length === 0 && sortMode === 'atlas';
        var visibleSlots = useOriginalLayout ? atlasLayoutSlots : computeAtlasBrowseSlots(visibleNodes);
        atlasNodes.forEach(function (node) { node.hidden = true; });
        visibleNodes.forEach(function (node, index) {
          var slot = visibleSlots[index] || visibleSlots[visibleSlots.length - 1];
          if (slot) {
            node.style.setProperty('--atlas-left', slot.left);
            node.style.setProperty('--atlas-top', slot.top);
            node.style.setProperty('--atlas-mobile-left', slot.mobileLeft);
            node.style.setProperty('--atlas-mobile-top', slot.mobileTop);
            node.style.zIndex = slot.zIndex || String(20 + index);
          }
          node.hidden = false;
        });
        updateAtlasTagSummary(selectedTags);
        if (atlasBrowseStatus) {
          var label = visibleNodes.length + ' of ' + atlasNodes.length + ' issue area' + (atlasNodes.length === 1 ? '' : 's');
          atlasBrowseStatus.textContent = selectedTags.length ? label + ' matching ' + selectedTags.length + ' tag' + (selectedTags.length === 1 ? '' : 's') : label;
        }
      }
      function findAtlasIssueTemplate(topicId) {
        return atlasIssueTemplates.find(function (template) {
          return String(template.getAttribute('data-ce-atlas-topic-id') || '') === String(topicId || '');
        }) || null;
      }
      function atlasIssueIdFromHash() {
        var raw = String(window.location.hash || '').replace(/^#/, '');
        try { raw = decodeURIComponent(raw); } catch (error) { /* Keep the raw hash. */ }
        var prefix = 'debate-atlas-';
        return raw.indexOf(prefix) === 0 ? raw.slice(prefix.length) : '';
      }
      function setAtlasModalCollapse(button, isOpen) {
        if (!button) return;
        var section = button.closest('[data-ce-atlas-modal-collapse-section]');
        if (!section) return;
        var body = section.querySelector('[data-ce-atlas-modal-collapse-body]');
        var label = section.querySelector('[data-ce-atlas-modal-collapse-label]');
        var openCaret = section.querySelector('[data-ce-atlas-modal-caret-open]');
        var closedCaret = section.querySelector('[data-ce-atlas-modal-caret-closed]');
        var nextOpen = !!isOpen;
        button.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
        if (body) body.hidden = !nextOpen;
        if (label) label.textContent = nextOpen ? 'Hide' : 'Show';
        if (openCaret) openCaret.hidden = !nextOpen;
        if (closedCaret) closedCaret.hidden = nextOpen;
      }
      function getAtlasModalFocusableElements() {
        if (!atlasIssueModalContent) return [];
        return Array.from(atlasIssueModalContent.querySelectorAll('a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'))
          .filter(function (element) { return !element.hidden && element.offsetParent !== null; });
      }
      function atlasModelCardById(modelId) {
        if (!atlasIssueModalContent || !modelId) return null;
        return Array.from(atlasIssueModalContent.querySelectorAll('[data-ce-atlas-model-card]'))
          .find(function (card) {
            return card.getAttribute('data-ce-atlas-model-card') === modelId;
          }) || null;
      }
      function setAtlasMetricText(grid, role, key, value) {
        var element = grid.querySelector('[data-ce-atlas-metric-' + role + '="' + key + '"]');
        if (element) element.textContent = value;
      }
      function updateAtlasIssueMetrics(modelId) {
        if (!atlasIssueModalContent) return;
        var grid = atlasIssueModalContent.querySelector('[data-ce-atlas-model-metric-grid]');
        if (!grid) return;
        var card = atlasModelCardById(modelId);
        if (!card) {
          grid.removeAttribute('data-ce-atlas-model-metrics-active');
          grid.style.removeProperty('--atlas-active-model-color');
          grid.setAttribute('aria-label', 'Issue area benchmark metrics');
          grid.querySelectorAll('[data-ce-atlas-metric-default]').forEach(function (element) {
            element.textContent = element.getAttribute('data-ce-atlas-metric-default') || '';
          });
          return;
        }
        var label = card.getAttribute('data-ce-atlas-model-label') || modelId;
        var color = card.style.getPropertyValue('--atlas-model-color') || '#38bdf8';
        grid.setAttribute('data-ce-atlas-model-metrics-active', modelId);
        grid.style.setProperty('--atlas-active-model-color', color);
        grid.setAttribute('aria-label', label + ' issue area metrics');
        setAtlasMetricText(grid, 'label', 'stance', 'Model response direction');
        setAtlasMetricText(grid, 'value', 'stance', card.getAttribute('data-ce-atlas-model-stance-value') || 'No model answers');
        setAtlasMetricText(grid, 'detail', 'stance', card.getAttribute('data-ce-atlas-model-stance-detail') || 'No answered questions');
        setAtlasMetricText(grid, 'label', 'difference', 'Distance from peers');
        setAtlasMetricText(grid, 'value', 'difference', card.getAttribute('data-ce-atlas-model-difference-value') || 'No peer comparison');
        setAtlasMetricText(grid, 'detail', 'difference', card.getAttribute('data-ce-atlas-model-difference-detail') || 'Other model answers required');
        setAtlasMetricText(grid, 'label', 'consistency', 'Model repeat stability');
        setAtlasMetricText(grid, 'value', 'consistency', card.getAttribute('data-ce-atlas-model-consistency-value') || 'No repeat data');
        setAtlasMetricText(grid, 'detail', 'consistency', card.getAttribute('data-ce-atlas-model-consistency-detail') || 'Repeated runs required');
      }
      function updateAtlasQuestionMetrics(modelId) {
        if (!atlasIssueModalContent) return;
        var questions = Array.from(atlasIssueModalContent.querySelectorAll('[data-ce-atlas-question-link]'));
        questions.forEach(function (question) {
          var meta = question.querySelector('[data-ce-atlas-question-meta]');
          if (!meta) return;
          var marker = modelId
            ? Array.from(question.querySelectorAll('[data-ce-atlas-model-marker]')).find(function (candidate) {
              return candidate.getAttribute('data-ce-atlas-model-marker') === modelId;
            })
            : null;
          if (!marker) {
            meta.textContent = meta.getAttribute('data-ce-atlas-question-meta-default') || '';
            meta.removeAttribute('data-ce-atlas-question-meta-active');
            meta.style.removeProperty('--atlas-active-model-color');
            return;
          }
          var label = marker.getAttribute('data-ce-atlas-model-label') || modelId;
          var answer = marker.getAttribute('data-ce-atlas-model-answer') || 'No answer';
          var repeatValue = marker.getAttribute('data-ce-atlas-model-repeat-value') || 'No repeat data';
          var winningResponses = Number(marker.getAttribute('data-ce-atlas-model-winning-responses') || 0);
          var attemptedRuns = Number(marker.getAttribute('data-ce-atlas-model-attempted-runs') || 0);
          var runDetail = attemptedRuns > 0
            ? ' (' + String(winningResponses) + ' of ' + String(attemptedRuns) + ' runs match)'
            : '';
          meta.textContent = label + ': ' + answer + ' | ' + repeatValue + ' repeat stability' + runDetail;
          meta.setAttribute('data-ce-atlas-question-meta-active', modelId);
          meta.style.setProperty(
            '--atlas-active-model-color',
            marker.style.getPropertyValue('--atlas-model-color') || '#38bdf8'
          );
        });
      }
      function applyAtlasModelHighlight() {
        if (!atlasIssueModalContent) return;
        var modelId = lockedAtlasModelId || hoveredAtlasModelId || focusedAtlasModelId;
        var markers = Array.from(atlasIssueModalContent.querySelectorAll('[data-ce-atlas-model-marker]'));
        var cards = Array.from(atlasIssueModalContent.querySelectorAll('[data-ce-atlas-model-card]'));
        cards.forEach(function (card) {
          var isLocked = !!lockedAtlasModelId
            && card.getAttribute('data-ce-atlas-model-card') === lockedAtlasModelId;
          card.classList.toggle('atlasIssueModelCardLocked', isLocked);
          card.setAttribute('aria-pressed', isLocked ? 'true' : 'false');
        });
        updateAtlasIssueMetrics(modelId);
        updateAtlasQuestionMetrics(modelId);
        if (!modelId) {
          atlasIssueModalContent.removeAttribute('data-ce-atlas-model-highlight');
          markers.forEach(function (marker) {
            marker.classList.remove('atlasIssueModelMarkerActive');
          });
          return;
        }
        atlasIssueModalContent.setAttribute('data-ce-atlas-model-highlight', modelId);
        markers.forEach(function (marker) {
          marker.classList.toggle(
            'atlasIssueModelMarkerActive',
            marker.getAttribute('data-ce-atlas-model-marker') === modelId
          );
        });
      }
      function atlasModelCardFromEvent(event) {
        var card = event.target && event.target.closest
          ? event.target.closest('[data-ce-atlas-model-card]')
          : null;
        return card && atlasIssueModalBody && atlasIssueModalBody.contains(card) ? card : null;
      }
      function questionModelCardFromEvent(event) {
        var card = event.target && event.target.closest
          ? event.target.closest('[data-ce-question-model-card]')
          : null;
        return card && questionModelLegend && questionModelLegend.contains(card) ? card : null;
      }
      function applyQuestionModelHighlight() {
        if (!questionExplorer) return;
        var transientModelId = hoveredQuestionModelId || focusedQuestionModelId;
        var activeModelIds = lockedQuestionModelIds.size > 0
          ? Array.from(lockedQuestionModelIds)
          : (transientModelId ? [transientModelId] : []);
        var cards = Array.from(questionExplorer.querySelectorAll('[data-ce-question-model-card]'));
        var markers = Array.from(questionExplorer.querySelectorAll('.questionModelDistribution [data-ce-atlas-model-marker]'));
        cards.forEach(function (card) {
          var cardModelId = card.getAttribute('data-ce-question-model-card') || '';
          var isActive = activeModelIds.indexOf(cardModelId) !== -1;
          var isLocked = lockedQuestionModelIds.has(cardModelId);
          card.classList.toggle('questionModelLegendItemActive', isActive);
          card.classList.toggle('questionModelLegendItemLocked', isLocked);
          card.setAttribute('aria-pressed', isLocked ? 'true' : 'false');
        });
        if (activeModelIds.length === 0) {
          questionExplorer.removeAttribute('data-ce-question-model-highlight');
          markers.forEach(function (marker) {
            marker.classList.remove('atlasIssueModelMarkerActive');
          });
          return;
        }
        questionExplorer.setAttribute('data-ce-question-model-highlight', activeModelIds.join(','));
        markers.forEach(function (marker) {
          marker.classList.toggle(
            'atlasIssueModelMarkerActive',
            activeModelIds.indexOf(marker.getAttribute('data-ce-atlas-model-marker') || '') !== -1
          );
        });
      }
      function closeAtlasIssueModal(options) {
        if (!atlasIssueModal) return;
        var updateHash = !options || options.updateHash !== false;
        var restoreFocus = !options || options.restoreFocus !== false;
        atlasIssueModal.hidden = true;
        document.body.removeAttribute('data-ce-atlas-modal-open');
        hoveredAtlasModelId = '';
        focusedAtlasModelId = '';
        lockedAtlasModelId = '';
        applyAtlasModelHighlight();
        if (atlasIssueModalBody) atlasIssueModalBody.innerHTML = '';
        activeAtlasIssueId = '';
        if (updateHash && atlasIssueIdFromHash()) {
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', '#debate-atlas');
          } else {
            window.location.hash = 'debate-atlas';
          }
          setReportViewMode('debate-atlas', { scroll: false });
        }
        if (restoreFocus && atlasIssueLastFocus && atlasIssueLastFocus.focus) {
          var focusTarget = atlasIssueLastFocus;
          window.setTimeout(function () { focusTarget.focus(); }, 0);
        }
        atlasIssueLastFocus = null;
      }
      function openAtlasIssueModal(topicId, options) {
        if (!atlasIssueModal || !atlasIssueModalBody) return false;
        var template = findAtlasIssueTemplate(topicId);
        if (!template) return false;
        if (atlasIssueModal.hidden || activeAtlasIssueId !== topicId) {
          var activeElement = document.activeElement;
          if (activeElement && (!atlasIssueModal.contains || !atlasIssueModal.contains(activeElement))) {
            atlasIssueLastFocus = activeElement;
          }
        }
        activeAtlasIssueId = String(topicId || '');
        atlasIssueModalTitle.textContent = template.getAttribute('data-ce-atlas-topic-title') || activeAtlasIssueId;
        atlasIssueModalBody.innerHTML = template.innerHTML;
        hoveredAtlasModelId = '';
        focusedAtlasModelId = '';
        lockedAtlasModelId = '';
        applyAtlasModelHighlight();
        setAtlasTopDebatesOpen(false);
        closeRiskMatrixModal();
        atlasIssueModal.hidden = false;
        document.body.setAttribute('data-ce-atlas-modal-open', 'true');
        var updateHash = !options || options.updateHash !== false;
        if (updateHash) {
          var nextHash = '#debate-atlas-' + encodeURIComponent(activeAtlasIssueId);
          if (window.location.hash !== nextHash) {
            if (window.history && window.history.pushState) {
              window.history.pushState(null, '', nextHash);
            } else {
              window.location.hash = nextHash;
            }
          }
        }
        setReportViewMode('debate-atlas', { scroll: false });
        var closeButton = atlasIssueModal.querySelector('[data-ce-atlas-issue-close]');
        if (closeButton && closeButton.focus) closeButton.focus();
        else if (atlasIssueModalContent && atlasIssueModalContent.focus) atlasIssueModalContent.focus();
        return true;
      }
      function syncAtlasIssueModalWithHash() {
        var topicId = atlasIssueIdFromHash();
        if (topicId) {
          openAtlasIssueModal(topicId, { updateHash: false });
        } else if (atlasIssueModal && !atlasIssueModal.hidden) {
          closeAtlasIssueModal({ updateHash: false, restoreFocus: false });
        }
      }
      function normalizeTagValue(value) {
        return String(value || '').trim().toLowerCase();
      }
      function tagFromHash() {
        var raw = String(window.location.hash || '').replace(/^#/, '');
        var prefix = 'tag-';
        if (raw.indexOf(prefix) !== 0) return '';
        try { return decodeURIComponent(raw.slice(prefix.length)); } catch (error) { return raw.slice(prefix.length); }
      }
      function tagResponseDirection(summary) {
        var score = Number(summary && summary.meanScore);
        if (!Number.isFinite(score)) return 'no data';
        if (score > 0.25) return 'net support';
        if (score < -0.25) return 'net opposition';
        return 'mixed / unsure';
      }
      function tagsForQuestion(question, summary) {
        return [question && question.topic]
          .concat(Array.isArray(question && question.subtopics) ? question.subtopics : [])
          .concat(Array.isArray(question && question.riskFacets) ? question.riskFacets : [])
          .concat([tagResponseDirection(summary)])
          .map(normalizeTagValue)
          .filter(Boolean);
      }
      function questionsForTag(tag) {
        var normalizedTag = normalizeTagValue(tag);
        var questions = Array.isArray(reportSnapshot.questions) ? reportSnapshot.questions : [];
        var summaries = reportSnapshot.polisReport && reportSnapshot.polisReport.byQuestion
          ? reportSnapshot.polisReport.byQuestion
          : {};
        return questions.filter(function (question) {
          return tagsForQuestion(question, summaries[question.id] || {}).indexOf(normalizedTag) !== -1;
        });
      }
      function tagQuestionCounts(summary) {
        var counts = summary && summary.counts ? summary.counts : {};
        return {
          agree: Number(counts.Agree || 0),
          unsure: Number(counts.Unsure || 0),
          disagree: Number(counts.Disagree || 0)
        };
      }
      function renderTagQuestionCard(question) {
        var summaries = reportSnapshot.polisReport && reportSnapshot.polisReport.byQuestion
          ? reportSnapshot.polisReport.byQuestion
          : {};
        var summary = summaries[question.id] || {};
        var counts = tagQuestionCounts(summary);
        var total = counts.agree + counts.unsure + counts.disagree;
        return '<a class="tagExplorerQuestionCard" data-ce-tag-question-link href="#question-' + escapeText(question.id) + '">'
          + '<div class="tagExplorerQuestionMeta"><span>' + escapeText(question.id) + '</span><span>' + escapeText(total) + ' model vote' + (total === 1 ? '' : 's') + '</span></div>'
          + '<p class="tagExplorerQuestionPrompt">' + escapeText(question.prompt || question.id) + '</p>'
          + '<div class="tagExplorerQuestionBar" aria-hidden="true">'
          + '<i class="tagExplorerAgree" style="width:' + percent(counts.agree, total) + '%"></i>'
          + '<i class="tagExplorerUnsure" style="width:' + percent(counts.unsure, total) + '%"></i>'
          + '<i class="tagExplorerDisagree" style="width:' + percent(counts.disagree, total) + '%"></i>'
          + '</div>'
          + '<div class="tagExplorerQuestionLegend"><span>Agree ' + escapeText(counts.agree) + '</span><span>Unsure ' + escapeText(counts.unsure) + '</span><span>Disagree ' + escapeText(counts.disagree) + '</span></div>'
          + '</a>';
      }
      function renderTagModal(tag) {
        var questions = questionsForTag(tag);
        if (tagModalTitle) tagModalTitle.textContent = tag;
        if (tagModalCount) tagModalCount.textContent = String(questions.length);
        if (tagModalSummary) {
          tagModalSummary.textContent = questions.length
            ? questions.length + ' benchmark question' + (questions.length === 1 ? '' : 's') + ' carry this tag. Each card shows one averaged vote per model.'
            : 'No benchmark questions carry this tag in the current report.';
        }
        if (tagModalQuestions) {
          tagModalQuestions.innerHTML = questions.length
            ? questions.map(renderTagQuestionCard).join('')
            : '<p class="tagExplorerEmpty">No matching questions are available.</p>';
        }
      }
      function getTagModalFocusableElements() {
        if (!tagModalContent) return [];
        return Array.from(tagModalContent.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
          .filter(function (element) { return !element.hidden && element.offsetParent !== null; });
      }
      function closeTagModal(options) {
        if (!tagModal || tagModal.hidden) return;
        var updateHash = !options || options.updateHash !== false;
        var restoreFocus = !options || options.restoreFocus !== false;
        tagModal.hidden = true;
        document.body.removeAttribute('data-ce-tag-modal-open');
        activeTagModalTag = '';
        if (tagModalQuestions) tagModalQuestions.innerHTML = '';
        if (updateHash && tagFromHash()) {
          var nextHash = tagModalPreviousHash && tagModalPreviousHash.indexOf('#tag-') !== 0
            ? tagModalPreviousHash
            : '#report';
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', nextHash);
          } else {
            window.location.hash = nextHash.replace(/^#/, '');
          }
          setReportViewMode(modeFromHash(), { scroll: false });
        }
        if (restoreFocus && tagModalLastFocus && tagModalLastFocus.focus) {
          var focusTarget = tagModalLastFocus;
          window.setTimeout(function () { focusTarget.focus(); }, 0);
        }
        tagModalLastFocus = null;
      }
      function openTagModal(tag, options) {
        var normalizedTag = String(tag || '').trim();
        if (!tagModal || !tagModalContent || !normalizedTag) return false;
        if (tagModal.hidden) {
          var activeElement = document.activeElement;
          if (activeElement && (!tagModal.contains || !tagModal.contains(activeElement))) {
            tagModalLastFocus = activeElement;
          }
          if (!tagFromHash()) tagModalPreviousHash = window.location.hash || '#report';
        }
        activeTagModalTag = normalizedTag;
        renderTagModal(normalizedTag);
        closeRiskMatrixModal();
        closeAtlasIssueModal({ updateHash: false, restoreFocus: false });
        tagModal.hidden = false;
        document.body.setAttribute('data-ce-tag-modal-open', 'true');
        if (tagModalScroll) tagModalScroll.scrollTop = 0;
        var updateHash = !options || options.updateHash !== false;
        if (updateHash) {
          var nextHash = '#tag-' + encodeURIComponent(normalizedTag);
          if (window.location.hash !== nextHash) {
            if (window.history && window.history.pushState) {
              window.history.pushState(null, '', nextHash);
            } else {
              window.location.hash = nextHash;
            }
          }
        }
        var closeButton = tagModal.querySelector('[data-ce-tag-modal-close]');
        if (closeButton && closeButton.focus) closeButton.focus();
        else tagModalContent.focus();
        return true;
      }
      function syncTagModalWithHash() {
        var tag = tagFromHash();
        if (tag) {
          openTagModal(tag, { updateHash: false });
          return true;
        }
        if (tagModal && !tagModal.hidden) {
          closeTagModal({ updateHash: false, restoreFocus: false });
        }
        return false;
      }
      function copyAtlasIssueDeepLink() {
        if (!activeAtlasIssueId || !atlasIssueCopyLinkButton) return;
        var url = new URL(window.location.href);
        url.hash = 'debate-atlas-' + encodeURIComponent(activeAtlasIssueId);
        var markCopied = function () {
          atlasIssueCopyLinkButton.setAttribute('aria-label', 'Deep link copied');
          atlasIssueCopyLinkButton.title = 'Copied';
          window.setTimeout(function () {
            atlasIssueCopyLinkButton.setAttribute('aria-label', 'Copy issue area deep link');
            atlasIssueCopyLinkButton.title = 'Copy deep link';
          }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url.toString()).then(markCopied).catch(function () {});
          return;
        }
        var input = document.createElement('textarea');
        input.value = url.toString();
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        try { document.execCommand('copy'); markCopied(); } catch (error) { /* Clipboard unavailable. */ }
        document.body.removeChild(input);
      }
      function setRawDemoViewActive(mode) {
        var activeMode = knownModes.indexOf(mode) === -1 || mode === 'snapshot-json' ? 'report' : mode;
        rawDemoViewButtons.forEach(function (button) {
          var isActive = button.getAttribute('data-ce-raw-demo-view') === activeMode;
          button.classList.toggle('demoResultsViewButtonActive', isActive);
          button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
      }
      function renderBeeswarmTooltip(point) {
        if (!beeswarmTooltip || !point) return;
        var votes = Number(point.dataset.questionVotes || 0);
        var invalid = Number(point.dataset.questionInvalid || 0);
        var total = votes + invalid;
        var consistencyRate = Number(point.dataset.questionWinningResponseConsistency);
        var attemptedRuns = Number(point.dataset.questionAttemptedRuns || 0);
        var winningResponses = Number(point.dataset.questionWinningResponses || 0);
        var consistencyLabel = Number.isFinite(consistencyRate)
          ? String(Math.round(consistencyRate * 100)) + '%'
          : 'Unavailable';
        var differenceLabel = point.dataset.questionDifferenceLabel || 'Model disagreement';
        var consistencyDetail = attemptedRuns > 0
          ? ' (' + String(winningResponses) + ' of ' + String(attemptedRuns) + ' attempted runs)'
          : '';
        beeswarmTooltip.innerHTML = [
          '<div style="font-weight: bold; margin-bottom: 4px;">' + escapeText(point.dataset.questionId) + ': ' + escapeText(point.dataset.questionPrompt) + '</div>',
          '<div style="font-size: 0.85rem; margin-bottom: 6px;"><strong>Agree:</strong> ' + escapeText(point.dataset.questionAgree) + ', ' +
            '<strong>Disagree:</strong> ' + escapeText(point.dataset.questionDisagree) + ', ' +
            '<strong>Unsure:</strong> ' + escapeText(point.dataset.questionUnsure) + '</div>',
          '<div style="font-size: 0.85rem; margin-bottom: 6px;"><strong>Mean:</strong> ' + escapeText(point.dataset.questionMean) + ', ' +
            '<strong>' + escapeText(differenceLabel) + ':</strong> ' + escapeText(point.dataset.questionDifference) + '</div>',
          point.dataset.questionHasVotes === 'false'
            ? ''
            : '<div style="font-size: 0.85rem; margin-bottom: 6px;"><strong>Winning-response consistency:</strong> ' + escapeText(consistencyLabel + consistencyDetail) + '</div>',
          point.dataset.questionHasVotes === 'false'
            ? '<div class="ce-report-muted" style="margin-bottom: 6px;">' + escapeText(point.dataset.questionStatus || 'No model responses yet') + '</div>'
            : '',
          '<div class="aidb-answer-bar" aria-hidden="true">' +
            '<i class="aidb-answer-agree" style="width:' + escapeText(percent(point.dataset.questionAgree, total)) + '%"></i>' +
            '<i class="aidb-answer-unsure" style="width:' + escapeText(percent(point.dataset.questionUnsure, total)) + '%"></i>' +
            '<i class="aidb-answer-disagree" style="width:' + escapeText(percent(point.dataset.questionDisagree, total)) + '%"></i>' +
            '<i class="aidb-answer-invalid" style="width:' + escapeText(percent(point.dataset.questionInvalid, total)) + '%"></i>' +
          '</div>',
          '<div class="ce-report-muted">' + escapeText(point.dataset.questionTopic) + '</div>'
        ].join('');
        beeswarmTooltip.hidden = false;
      }
      function setBeeswarmPointHovered(point, isHovered) {
        if (!point || !point.querySelector) return;
        var circle = point.querySelector('.beeswarmCircle');
        if (!circle || circle.classList.contains('beeswarmCircleNoData')) return;
        circle.classList.toggle('beeswarmCircleHover', !!isHovered);
      }
      function positionBeeswarmTooltip(clientX, clientY) {
        if (!beeswarmTooltip || beeswarmTooltip.hidden) return;
        var padding = 14;
        var rect = beeswarmTooltip.getBoundingClientRect();
        var left = Math.min(window.innerWidth - rect.width - padding, clientX + 16);
        var top = Math.min(window.innerHeight - rect.height - padding, clientY + 16);
        var pageX = window.pageXOffset || document.documentElement.scrollLeft || 0;
        var pageY = window.pageYOffset || document.documentElement.scrollTop || 0;
        beeswarmTooltip.style.left = (pageX + Math.max(padding, left)) + 'px';
        beeswarmTooltip.style.top = (pageY + Math.max(padding, top)) + 'px';
      }
      function hideBeeswarmTooltip() {
        if (beeswarmTooltip) beeswarmTooltip.hidden = true;
      }
      function renderGraphParticipantTooltip(point) {
        if (!beeswarmTooltip || !point) return;
        beeswarmTooltip.innerHTML = [
          '<div style="font-weight: bold; margin-bottom: 4px;">' + escapeText(point.dataset.participantLabel || point.dataset.participantId) + '</div>',
          '<div style="font-size: 0.85rem; margin-bottom: 4px;"><strong>Opinion group:</strong> ' + escapeText(point.dataset.participantGroup || point.dataset.ceGraphCluster) + '</div>',
          '<div style="font-size: 0.85rem; margin-bottom: 4px;"><strong>Question coverage:</strong> ' + escapeText(String(Math.round(Number(point.dataset.participantCoverage || 0) * 100))) + '%</div>',
          point.dataset.participantModel
            ? '<div style="font-size: 0.85rem; margin-bottom: 4px;"><strong>Model:</strong> ' + escapeText(point.dataset.participantModel) + '</div>'
            : '',
          point.dataset.participantProvider
            ? '<div style="font-size: 0.85rem; margin-bottom: 4px;"><strong>Provider:</strong> ' + escapeText(point.dataset.participantProvider) + '</div>'
            : '',
          point.dataset.participantTraits
            ? '<div style="font-size: 0.85rem; margin-bottom: 4px;"><strong>Traits:</strong> ' + escapeText(point.dataset.participantTraits) + '</div>'
            : '',
          '<div class="ce-report-muted">' + escapeText(point.dataset.participantId) + '</div>'
        ].join('');
        beeswarmTooltip.hidden = false;
      }
      function updateBeeswarmScrollControls() {
        document.querySelectorAll('[data-ce-beeswarm-scroll-controls]').forEach(function (controls) {
          var layout = controls.closest ? controls.closest('.swarmLayoutContainer') : null;
          var viewport = layout ? layout.querySelector('[data-ce-beeswarm-scroll-viewport]') : null;
          controls.hidden = !viewport || viewport.scrollWidth <= viewport.clientWidth + 2;
        });
      }
      function setStaticSectionOpen(section, isOpen) {
        if (!section) return;
        var nextOpen = !!isOpen;
        section.setAttribute('data-ce-collapsible-open', nextOpen ? 'true' : 'false');
        var body = section.querySelector('[data-ce-collapsible-body]');
        if (body) body.hidden = !nextOpen;
        var toggle = section.querySelector('[data-ce-collapsible-toggle]');
        if (toggle) toggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
        var label = section.querySelector('[data-ce-summary-toggle-label]');
        if (label) label.textContent = nextOpen ? 'Hide' : 'Show';
        var omitted = section.querySelector('[data-ce-summary-toggle-omitted]');
        if (omitted) omitted.hidden = nextOpen;
      }
      function copyTemplateAnchor(target, source) {
        if (!target || !source) return;
        target.textContent = source.textContent || '';
        var href = source.getAttribute('href');
        var title = source.getAttribute('title');
        var tag = source.getAttribute('data-ce-tag');
        if (href) target.setAttribute('href', href);
        if (title) target.setAttribute('title', title);
        if (tag) target.setAttribute('data-ce-tag', tag);
      }
      function breakdownFormatLabel(value) {
        var raw = String(value || '').trim();
        var knownLabels = {
          parameterClass: 'Parameter Class',
          ossStatus: 'OSS Status',
          countryOfOrigin: 'Country of Origin',
          providerClass: 'Provider Class'
        };
        if (knownLabels[raw]) return knownLabels[raw];
        var smallWords = ['and', 'or', 'of', 'the', 'to', 'for', 'in', 'on', 'with', 'vs'];
        return raw
          .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
          .replace(/[-_]+/g, ' ')
          .replace(/\\s+/g, ' ')
          .split(' ')
          .filter(Boolean)
          .map(function (word, index) {
            var lower = word.toLowerCase();
            if (lower === 'oss') return 'OSS';
            if (lower === 'ai') return 'AI';
            if (lower === 'rd') return 'R&D';
            if (index > 0 && smallWords.indexOf(lower) !== -1) return lower;
            return word.charAt(0).toUpperCase() + word.slice(1);
          })
          .join(' ');
      }
      function breakdownSelectedGroups() {
        return Array.from(breakdownSelectedGroupKeys).map(function (key) {
          var group = breakdownGroupIndex[key];
          if (!group) return null;
          return {
            key: group.key,
            trait: group.trait,
            value: group.value,
            ids: group.ids,
            name: breakdownFormatLabel(group.trait) + ': ' + breakdownFormatLabel(group.value)
          };
        }).filter(Boolean);
      }
      function breakdownQuestionById(questionId) {
        return (reportSnapshot.questions || []).find(function (question) {
          return String(question.id) === String(questionId || '');
        }) || null;
      }
      function aggregateBreakdownQuestion(questionId, participantIds) {
        var selectedIds = new Set((participantIds || []).map(String));
        var counts = { Agree: 0, Unsure: 0, Disagree: 0 };
        var invalid = 0;
        var total = 0;
        Object.keys(reportSnapshot.polisReport && reportSnapshot.polisReport.byModelQuestion || {}).forEach(function (participantId) {
          if (selectedIds.size && !selectedIds.has(String(participantId))) return;
          var cell = reportSnapshot.polisReport.byModelQuestion[participantId]
            ? reportSnapshot.polisReport.byModelQuestion[participantId][questionId]
            : null;
          if (!cell) return;
          counts.Agree += Number(cell.counts && cell.counts.Agree || 0);
          counts.Unsure += Number(cell.counts && cell.counts.Unsure || 0);
          counts.Disagree += Number(cell.counts && cell.counts.Disagree || 0);
          invalid += Number(cell.invalid || 0);
          total += Number(cell.total || 0);
        });
        var valid = counts.Agree + counts.Unsure + counts.Disagree;
        return {
          counts: counts,
          invalid: invalid,
          total: total,
          valid: valid,
          meanScore: valid ? (counts.Agree - counts.Disagree) / valid : null
        };
      }
      function breakdownFilteredParticipantIds(groups) {
        var allIds = (reportSnapshot.participants || []).map(function (participant) { return String(participant.id); });
        if (!groups.length) return allIds;
        var idsByTrait = {};
        groups.forEach(function (group) {
          if (!idsByTrait[group.trait]) idsByTrait[group.trait] = new Set();
          (group.ids || []).forEach(function (id) { idsByTrait[group.trait].add(String(id)); });
        });
        var traitSets = Object.keys(idsByTrait).map(function (trait) { return idsByTrait[trait]; });
        return allIds.filter(function (id) {
          return traitSets.every(function (ids) { return ids.has(id); });
        });
      }
      function breakdownBestQuestionForPair(leftIds, rightIds) {
        var best = null;
        (reportSnapshot.questions || []).forEach(function (question) {
          var left = aggregateBreakdownQuestion(question.id, leftIds);
          var right = aggregateBreakdownQuestion(question.id, rightIds);
          if (!left.valid || !right.valid) return;
          var score = Math.abs(Number(left.meanScore || 0) - Number(right.meanScore || 0));
          if (!best || score > best.score || (score === best.score && String(question.id) < String(best.question.id))) {
            best = { question: question, score: score };
          }
        });
        return best;
      }
      function breakdownBuildFilteredSuggestions(filterGroups) {
        var eligibleIds = breakdownFilteredParticipantIds(filterGroups);
        var eligibleSet = new Set(eligibleIds);
        var candidates = [];
        Object.keys(reportSnapshot.breakdown || {}).sort().forEach(function (trait) {
          var values = Object.keys(reportSnapshot.breakdown[trait] || {}).sort().map(function (value) {
            var ids = Array.from(reportSnapshot.breakdown[trait][value] || []).map(String).filter(function (id) {
              return eligibleSet.has(id);
            });
            return { trait: trait, value: value, ids: ids };
          }).filter(function (entry) { return entry.ids.length > 0; });
          values.forEach(function (left, leftIndex) {
            values.slice(leftIndex + 1).forEach(function (right) {
              var best = breakdownBestQuestionForPair(left.ids, right.ids);
              if (!best) return;
              var groups = [left, right].map(function (entry) {
                return {
                  key: 'filtered:' + entry.trait + ':' + entry.value,
                  trait: entry.trait,
                  value: entry.value,
                  ids: entry.ids,
                  name: breakdownFormatLabel(entry.trait) + ': ' + breakdownFormatLabel(entry.value)
                };
              });
              candidates.push({
                eligibleCount: eligibleIds.length,
                groups: groups,
                minGroupSize: Math.min(left.ids.length, right.ids.length),
                question: best.question,
                score: best.score,
                signature: [trait, left.value, right.value, best.question.id, eligibleIds.slice().sort().join(',')].join('|')
              });
            });
          });
        });
        candidates.sort(function (left, right) {
          return right.score - left.score || right.minGroupSize - left.minGroupSize || left.signature.localeCompare(right.signature);
        });
        return { eligibleIds: eligibleIds, suggestions: candidates.slice(0, 6) };
      }
      function renderFilteredBreakdownSuggestions(filterGroups) {
        if (!breakdownSuggestionsList) return;
        var result = breakdownBuildFilteredSuggestions(filterGroups);
        breakdownCurrentSuggestions = result.suggestions;
        var totalModels = (reportSnapshot.participants || []).length;
        if (breakdownSuggestionsStatus) {
          breakdownSuggestionsStatus.textContent = filterGroups.length
            ? 'Suggestions are restricted to ' + result.eligibleIds.length + ' of ' + totalModels + ' models matching the current filters.'
            : 'Report-wide suggestions across all ' + totalModels + ' models.';
        }
        if (!result.suggestions.length) {
          breakdownSuggestionsList.innerHTML = '<p class="emptyHint">No comparison pair has two represented cohorts inside the current filters.</p>';
          breakdownSuggestionButtons = [];
          return;
        }
        breakdownSuggestionsList.innerHTML = result.suggestions.map(function (suggestion, index) {
          var active = !!breakdownActiveSuggestion && breakdownActiveSuggestion.signature === suggestion.signature;
          var left = suggestion.groups[0];
          var right = suggestion.groups[1];
          return '<button type="button" class="suggestionButton' + (active ? ' suggestionButtonActive' : '') + '" aria-pressed="' + (active ? 'true' : 'false') + '" data-ce-searchable data-ce-breakdown-suggestion data-ce-breakdown-filtered-suggestion data-ce-breakdown-suggestion-index="' + index + '">' +
            '<span class="suggestionPair"><span>' + escapeText(breakdownFormatLabel(left.value)) + ' (' + left.ids.length + ')</span><span class="suggestionVs">vs</span><span>' + escapeText(breakdownFormatLabel(right.value)) + ' (' + right.ids.length + ')</span></span>' +
            '<span class="suggestionQuestion">' + escapeText(suggestion.question.prompt || suggestion.question.id) + '</span>' +
            '<span class="suggestionMeta">' + escapeText(breakdownFormatLabel(left.trait)) + ' within ' + suggestion.eligibleCount + ' matching model' + (suggestion.eligibleCount === 1 ? '' : 's') + ' · stance gap ' + suggestion.score.toFixed(2) + '</span>' +
          '</button>';
        }).join('');
        breakdownSuggestionButtons = Array.from(breakdownSuggestionsList.querySelectorAll('[data-ce-breakdown-suggestion]'));
      }
      function breakdownConsistency(questionId, participantIds) {
        var selectedIds = new Set((participantIds || []).map(String));
        var winningResponses = 0;
        var attemptedRuns = 0;
        var contributingModels = 0;
        Object.keys(reportSnapshot.polisReport && reportSnapshot.polisReport.byModelQuestion || {}).forEach(function (participantId) {
          if (selectedIds.size && !selectedIds.has(String(participantId))) return;
          var cell = reportSnapshot.polisReport.byModelQuestion[participantId]
            ? reportSnapshot.polisReport.byModelQuestion[participantId][questionId]
            : null;
          if (!cell) return;
          var counts = [
            Number(cell.counts && cell.counts.Agree || 0),
            Number(cell.counts && cell.counts.Unsure || 0),
            Number(cell.counts && cell.counts.Disagree || 0)
          ];
          var valid = counts.reduce(function (sum, count) { return sum + count; }, 0);
          var attempts = Number.isFinite(Number(cell.total)) ? Number(cell.total) : valid + Number(cell.invalid || 0);
          if (!attempts) return;
          winningResponses += Math.max.apply(Math, counts);
          attemptedRuns += attempts;
          contributingModels += 1;
        });
        return {
          rate: attemptedRuns ? winningResponses / attemptedRuns : null,
          winningResponses: winningResponses,
          attemptedRuns: attemptedRuns,
          contributingModels: contributingModels
        };
      }
      function breakdownScore(value) {
        if (value === null || value === undefined || value === '') return 'n/a';
        return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : 'n/a';
      }
      function breakdownRenderDistribution(summary, groupName, groupKey) {
        var counts = summary && summary.counts || {};
        var agree = Number(counts.Agree || 0);
        var unsure = Number(counts.Unsure || 0);
        var disagree = Number(counts.Disagree || 0);
        var valid = agree + unsure + disagree;
        var denominator = Math.max(1, valid);
        return '<div class="analysisDistributionDataset">' +
          '<div class="analysisDistributionHeader">' +
            '<span class="analysisDistributionTitle">' + escapeText(groupName) + '</span>' +
            '<span class="analysisDistributionMeta">' + escapeText(valid) + ' modeled responses</span>' +
          '</div>' +
          '<div class="analysisCandlestick" data-testid="ce-demo-analysis-card-candlestick-' + escapeText(String(groupKey || '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()) + '" aria-label="' + escapeText(groupName + ' response distribution: Agree ' + Math.round((agree / denominator) * 100) + '%, Unsure ' + Math.round((unsure / denominator) * 100) + '%, Disagree ' + Math.round((disagree / denominator) * 100) + '%.') + '">' +
            '<span class="analysisCandleSegment analysisCandleSegmentAgree" style="width:' + escapeText((agree / denominator) * 100) + '%"></span>' +
            '<span class="analysisCandleSegment analysisCandleSegmentUnsure" style="width:' + escapeText((unsure / denominator) * 100) + '%"></span>' +
            '<span class="analysisCandleSegment analysisCandleSegmentDisagree" style="width:' + escapeText((disagree / denominator) * 100) + '%"></span>' +
          '</div>' +
          '<div class="analysisDistributionLegend">' +
            '<span class="analysisDistributionLegendItem"><span class="analysisDistributionDot analysisCandleSegmentAgree"></span>Agree ' + Math.round((agree / denominator) * 100) + '%</span>' +
            '<span class="analysisDistributionLegendItem"><span class="analysisDistributionDot analysisCandleSegmentUnsure"></span>Unsure ' + Math.round((unsure / denominator) * 100) + '%</span>' +
            '<span class="analysisDistributionLegendItem"><span class="analysisDistributionDot analysisCandleSegmentDisagree"></span>Disagree ' + Math.round((disagree / denominator) * 100) + '%</span>' +
          '</div>' +
        '</div>';
      }
      function breakdownComparisonRows(groups) {
        var selectedModelIds = Array.from(new Set(groups.reduce(function (ids, group) {
          return ids.concat(group.ids || []);
        }, [])));
        return (reportSnapshot.questions || []).map(function (question) {
          var groupSummaries = groups.map(function (group) {
            return { group: group, summary: aggregateBreakdownQuestion(question.id, group.ids) };
          });
          var validGroups = groupSummaries.filter(function (entry) { return entry.summary.valid > 0; });
          if (validGroups.length < 2) return null;
          var means = validGroups.map(function (entry) { return Number(entry.summary.meanScore || 0); });
          var divergence = Math.max.apply(Math, means) - Math.min.apply(Math, means);
          return {
            question: question,
            groupSummaries: groupSummaries,
            divergence: divergence,
            similarity: 1 - Math.min(1, Math.abs(divergence) / 2),
            summary: aggregateBreakdownQuestion(question.id, selectedModelIds),
            consistency: breakdownConsistency(question.id, selectedModelIds)
          };
        }).filter(Boolean).sort(function (left, right) {
          return right.divergence - left.divergence;
        });
      }
      function breakdownRenderBeeswarm(rows) {
        if (!rows.length) return '<p class="noData">No data available to generate a beeswarm plot for the current filters.</p>';
        var width = 700;
        var plotLeft = 62;
        var plotRight = 680;
        var plotTop = 24;
        var plotBottom = 190;
        var occupied = {};
        var points = rows.slice(0, 200).map(function (row) {
          var xMetric = Math.max(0, Math.min(1, row.divergence / 2));
          var yMetric = Number.isFinite(row.consistency.rate) ? Math.max(0, Math.min(1, row.consistency.rate)) : 0;
          var x = plotLeft + xMetric * (plotRight - plotLeft);
          var y = plotBottom - yMetric * (plotBottom - plotTop);
          var bucket = Math.round(x / 8) + ':' + Math.round(y / 8);
          var collision = occupied[bucket] || 0;
          occupied[bucket] = collision + 1;
          if (collision) {
            x = Math.max(plotLeft, Math.min(plotRight, x + ((collision % 5) - 2) * 8));
            y = Math.max(plotTop, Math.min(plotBottom, y + Math.floor(collision / 5 + 1) * 8));
          }
          var counts = row.summary.counts || {};
          var prompt = row.question.prompt || row.question.id;
          var valid = Number(row.summary.valid || 0);
          return '<a href="#question-' + escapeText(row.question.id) + '" class="beeswarmPoint" data-ce-searchable data-ce-beeswarm-point data-ce-comparison-beeswarm-point ' +
            'data-question-id="' + escapeText(row.question.id) + '" data-question-prompt="' + escapeText(prompt) + '" data-question-topic="' + escapeText(row.question.topic || 'uncategorized') + '" ' +
            'data-question-has-votes="' + (valid ? 'true' : 'false') + '" data-question-status="' + escapeText(valid + ' modeled responses') + '" ' +
            'data-question-agree="' + escapeText(Number(counts.Agree || 0)) + '" data-question-unsure="' + escapeText(Number(counts.Unsure || 0)) + '" data-question-disagree="' + escapeText(Number(counts.Disagree || 0)) + '" data-question-invalid="' + escapeText(Number(row.summary.invalid || 0)) + '" ' +
            'data-question-mean="' + escapeText(breakdownScore(row.summary.meanScore)) + '" data-question-difference="' + escapeText(breakdownScore(xMetric)) + '" data-question-difference-label="Cohort difference" data-question-votes="' + escapeText(valid) + '" ' +
            'data-question-winning-response-consistency="' + escapeText(breakdownScore(row.consistency.rate)) + '" data-question-winning-responses="' + escapeText(row.consistency.winningResponses) + '" data-question-attempted-runs="' + escapeText(row.consistency.attemptedRuns) + '" data-question-contributing-models="' + escapeText(row.consistency.contributingModels) + '" ' +
            'aria-label="' + escapeText(row.question.id + ': ' + prompt + ' (' + valid + ' modeled responses)') + '">' +
              '<circle class="beeswarmCircle" cx="' + escapeText(x) + '" cy="' + escapeText(y) + '" r="5"></circle>' +
              '<title>' + escapeText(row.question.id + ': ' + prompt) + '</title>' +
          '</a>';
        }).join('');
        var grid = [1, 0.75, 0.5, 0.25, 0].map(function (rate) {
          var y = plotBottom - rate * (plotBottom - plotTop);
          return '<g class="beeswarmGridTick" aria-hidden="true"><line class="beeswarmGridLine" x1="' + plotLeft + '" y1="' + y + '" x2="' + plotRight + '" y2="' + y + '"></line><text class="beeswarmTickLabel" x="' + (plotLeft - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + Math.round(rate * 100) + '%</text></g>';
        }).join('');
        return '<div class="swarmLayoutContainer" data-ce-comparison-beeswarm><div class="swarmContainer" data-ce-beeswarm-scroll-viewport>' +
          '<svg width="' + width + '" height="250" class="beeswarmSvg comparisonBeeswarmSvg" role="img" aria-label="Questions by model-cohort difference and repeat consistency">' +
            grid +
            '<line class="beeswarmAxisLine" x1="' + plotLeft + '" y1="' + plotTop + '" x2="' + plotLeft + '" y2="' + plotBottom + '"></line>' +
            '<line class="beeswarmAxisLine" x1="' + plotLeft + '" y1="' + plotBottom + '" x2="' + plotRight + '" y2="' + plotBottom + '"></line>' +
            '<text class="beeswarmAxisTitle" x="14" y="107" transform="rotate(-90 14 107)" text-anchor="middle">Repeat consistency</text>' +
            '<text class="beeswarmAxisLabel" x="' + plotLeft + '" y="232">Similarity</text>' +
            '<text class="beeswarmAxisLabel" x="' + plotRight + '" y="232" text-anchor="end">Difference</text>' +
            points +
          '</svg></div></div>';
      }
      function breakdownRenderAnalysisItem(row) {
        var distributions = row.groupSummaries.map(function (entry) {
          return breakdownRenderDistribution(entry.summary, entry.group.name, entry.group.key);
        }).join('');
        return '<li class="analysisListItem"><div class="reportAnalysisContent"><div class="questionText">' + escapeText(row.question.prompt || row.question.id) + '</div><div class="analysisDistributionList">' + distributions + '</div></div></li>';
      }
      function breakdownRenderComparisonReport(groups) {
        if (groups.length < 2) {
          return '<section class="polisReportContainer comparisonReportContainer" data-testid="demo-analysis-empty-state"><div class="comparisonReportEmptyState"><h4 style="color:#343a40;">Comparison Report</h4><p class="noData">Select two or more model trait segments from the menus above to see a detailed comparison report.</p></div></section>';
        }
        var rows = breakdownComparisonRows(groups);
        var topDivergent = rows.slice(0, 5);
        var topSimilar = rows.slice().sort(function (left, right) { return right.similarity - left.similarity; }).slice(0, 5);
        var colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#17a2b8'];
        var legend = groups.map(function (group, index) {
          return '<span class="legendPill" style="background-color:' + colors[index % colors.length] + '">' + escapeText(group.name) + '</span>';
        }).join('');
        return '<section class="polisReportContainer comparisonReportContainer" data-testid="demo-analysis-comparison-report" data-ce-searchable>' +
          '<button type="button" class="reportCollapseHeader" aria-expanded="true" aria-controls="demo-analysis-comparison-report-body" data-testid="demo-analysis-comparison-report-toggle">' +
            '<span class="reportCollapseCopy"><span class="mainReportTitle">Comparison Report</span><span class="reportSummaryText" data-testid="demo-analysis-report-summary">Comparing ' + escapeText(groups.map(function (group) { return group.name; }).join(', ')) + '</span></span>' +
          '</button>' +
          '<div id="demo-analysis-comparison-report-body" class="reportCollapseBody" data-testid="demo-analysis-comparison-report-body">' +
            '<div class="legendContainer"><span class="legendTitle">Comparing Groups:</span><div class="legendPills">' + legend + '</div></div>' +
            '<div class="sectionCollapse comparisonReportSectionCollapse"><div class="sectionHeaderRow"><h5 class="sectionTitle">Similarity &amp; Difference Spectrum</h5></div>' + breakdownRenderBeeswarm(rows.slice(0, 12)) + '</div>' +
            '<div class="sectionCollapse comparisonReportSectionCollapse"><div class="sectionHeaderRow"><h5 class="sectionTitle">Top Similar Items</h5></div><ul class="analysisList">' + (topSimilar.map(breakdownRenderAnalysisItem).join('') || '<li class="noData">No significant items found for this selection.</li>') + '</ul></div>' +
            '<div class="sectionCollapse comparisonReportSectionCollapse"><div class="sectionHeaderRow"><h5 class="sectionTitle">Top Divergent Items</h5></div><ul class="analysisList">' + (topDivergent.map(breakdownRenderAnalysisItem).join('') || '<li class="noData">No significant items found for this selection.</li>') + '</ul></div>' +
          '</div>' +
        '</section>';
      }
      function breakdownRenderQuestionRows(question, groups, filteredParticipantIds) {
        if (!question) return '<p class="emptyHint">Select a question to inspect its response breakdown.</p>';
        var allParticipantIds = (reportSnapshot.participants || []).map(function (participant) { return participant.id; });
        var overallParticipantIds = Array.isArray(filteredParticipantIds) ? filteredParticipantIds : allParticipantIds;
        var datasets = [{
          label: overallParticipantIds.length === allParticipantIds.length ? 'Overall' : 'Matching models',
          key: 'overall',
          summary: aggregateBreakdownQuestion(question.id, overallParticipantIds)
        }].concat(groups.map(function (group) {
          return { label: group.name, key: group.key, summary: aggregateBreakdownQuestion(question.id, group.ids) };
        }));
        return datasets.map(function (dataset) {
          var counts = dataset.summary.counts || {};
          var valid = Math.max(1, Number(dataset.summary.valid || 0));
          return '<div class="breakdownDataset" data-ce-searchable><div class="breakdownDatasetHeader"><span class="breakdownDatasetTitle">' + escapeText(dataset.label) + '</span><span class="breakdownDatasetMeta">' + escapeText(dataset.summary.valid || 0) + ' modeled responses</span></div>' +
            '<div class="breakdownCandlestick" aria-label="response distribution"><span class="breakdownCandleSegment breakdownCandleSegmentAgree" style="width:' + escapeText((Number(counts.Agree || 0) / valid) * 100) + '%"></span><span class="breakdownCandleSegment breakdownCandleSegmentUnsure" style="width:' + escapeText((Number(counts.Unsure || 0) / valid) * 100) + '%"></span><span class="breakdownCandleSegment breakdownCandleSegmentDisagree" style="width:' + escapeText((Number(counts.Disagree || 0) / valid) * 100) + '%"></span></div>' +
            '<p class="breakdownQuestionText">' + escapeText(question.prompt || question.id) + '</p></div>';
        }).join('');
      }
      function updateBreakdownTagAnchor(anchor, value) {
        if (!anchor) return;
        var label = String(value || 'uncategorized');
        anchor.textContent = label;
        anchor.setAttribute('data-ce-tag', label);
        anchor.setAttribute('href', '#tag-' + encodeURIComponent(label));
        anchor.setAttribute('title', 'Open ' + label + ' in the tag explorer');
      }
      function updateBreakdownControls() {
        var groups = breakdownSelectedGroups();
        breakdownGroupInputs.forEach(function (input) {
          var key = String(input.getAttribute('data-ce-breakdown-group-key') || input.value || '');
          input.checked = breakdownSelectedGroupKeys.has(key);
        });
        breakdownTraitMenus.forEach(function (menu) {
          var trait = String(menu.getAttribute('data-ce-breakdown-trait') || '');
          var values = menu.querySelector('[data-ce-breakdown-trait-values]');
          if (!values) return;
          values.innerHTML = groups.filter(function (group) { return group.trait === trait; }).map(function (group) {
            return '<span class="breakdownTraitSelectValue">' + escapeText(breakdownFormatLabel(group.value)) + '</span>';
          }).join('');
        });
        if (breakdownSelectedPills) {
          breakdownSelectedPills.innerHTML = groups.map(function (group) {
            return '<div class="filterPill" data-ce-searchable data-ce-breakdown-pill data-ce-breakdown-group-key="' + escapeText(group.key) + '">' +
              '<span class="pillName">' + escapeText(group.name) + '</span><div class="pillControls">' +
                '<button type="button" class="pillIconButton" data-ce-breakdown-suggest-group title="Suggest related comparisons" aria-label="Suggest related comparisons for ' + escapeText(group.name) + '">&#10024;</button>' +
                '<button type="button" class="pillIconButton" data-ce-breakdown-remove-group title="Remove group" aria-label="Remove ' + escapeText(group.name) + '">&times;</button>' +
              '</div></div>';
          }).join('');
        }
        if (breakdownFilterEmpty) breakdownFilterEmpty.hidden = groups.length > 0;
        if (breakdownClearButton) breakdownClearButton.disabled = groups.length === 0;
        return groups;
      }
      function updateInteractiveBreakdown(sourceButton) {
        var filterGroups = updateBreakdownControls();
        var eligibleIds = breakdownFilteredParticipantIds(filterGroups);
        var groups = breakdownActiveSuggestion ? breakdownActiveSuggestion.groups : filterGroups;
        var question = breakdownQuestionById(breakdownCurrentQuestionId) || (reportSnapshot.questions || [])[0] || null;
        if (question) breakdownCurrentQuestionId = String(question.id);
        if (breakdownQuestionBanner && question) breakdownQuestionBanner.setAttribute('data-ce-breakdown-question-id', question.id);
        if (breakdownSelectedPrompt && question) breakdownSelectedPrompt.textContent = question.prompt || question.id;
        if (breakdownSelectedTension && question) breakdownSelectedTension.textContent = question.disagreementAxis || question.whyIncluded || 'Model cohorts diverge on this benchmark statement.';
        if (question) {
          updateBreakdownTagAnchor(breakdownSelectedTopic, question.topic || 'uncategorized');
        }
        if (breakdownList) breakdownList.innerHTML = breakdownRenderQuestionRows(question, groups, eligibleIds);
        if (breakdownComparisonReport) breakdownComparisonReport.innerHTML = breakdownRenderComparisonReport(groups);
        renderFilteredBreakdownSuggestions(filterGroups);
        updateBeeswarmScrollControls();
      }
      function strongestBreakdownPair(anchorKey) {
        var keys = Object.keys(breakdownGroupIndex);
        var question = breakdownQuestionById(breakdownCurrentQuestionId);
        if (!question || keys.length < 2) return [];
        var best = null;
        keys.forEach(function (leftKey, leftIndex) {
          keys.slice(leftIndex + 1).forEach(function (rightKey) {
            if (anchorKey && leftKey !== anchorKey && rightKey !== anchorKey) return;
            var left = aggregateBreakdownQuestion(question.id, breakdownGroupIndex[leftKey].ids);
            var right = aggregateBreakdownQuestion(question.id, breakdownGroupIndex[rightKey].ids);
            if (!left.valid || !right.valid) return;
            var score = Math.abs(Number(left.meanScore || 0) - Number(right.meanScore || 0));
            if (!best || score > best.score) best = { keys: [leftKey, rightKey], score: score };
          });
        });
        return best ? best.keys : [];
      }
      function applyBreakdownTemplate(templateId, sourceButton) {
        var template = templateId ? document.getElementById(templateId) : null;
        if (!template || !template.content) return;
        var questionId = String(template.getAttribute('data-ce-breakdown-question-id') || '');
        var groupKeys = [];
        try { groupKeys = JSON.parse(template.getAttribute('data-ce-breakdown-group-keys') || '[]'); } catch (error) { groupKeys = []; }
        if (questionId && Array.isArray(groupKeys)) {
          breakdownActiveSuggestion = null;
          breakdownCurrentQuestionId = questionId;
          breakdownSelectedGroupKeys = new Set(groupKeys.filter(function (key) { return !!breakdownGroupIndex[key]; }));
          updateInteractiveBreakdown(sourceButton);
          return;
        }
        var prompt = template.content.querySelector('[data-ce-template-prompt]');
        var tension = template.content.querySelector('[data-ce-template-tension]');
        var topic = template.content.querySelector('[data-ce-template-topic]');
        var pills = template.content.querySelector('[data-ce-template-pills]');
        var list = template.content.querySelector('[data-ce-template-breakdown-list]');
        var comparison = template.content.querySelector('[data-ce-template-comparison-report]');
        if (breakdownSelectedPrompt && prompt) breakdownSelectedPrompt.textContent = prompt.textContent || '';
        if (breakdownSelectedTension && tension) breakdownSelectedTension.textContent = tension.textContent || '';
        copyTemplateAnchor(breakdownSelectedTopic, topic);
        if (breakdownSelectedPills && pills) breakdownSelectedPills.innerHTML = pills.innerHTML;
        if (breakdownList && list) breakdownList.innerHTML = list.innerHTML;
        if (breakdownComparisonReport && comparison) breakdownComparisonReport.innerHTML = comparison.innerHTML;
        updateBeeswarmScrollControls();
        breakdownSuggestionButtons.forEach(function (button) {
          var isActive = button === sourceButton;
          button.classList.toggle('suggestionButtonActive', isActive);
          button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
          if (isActive) {
            button.setAttribute('data-ce-selected-breakdown-suggestion', '');
          } else {
            button.removeAttribute('data-ce-selected-breakdown-suggestion');
          }
        });
      }
      staticCollapsibles.forEach(function (section) {
        setStaticSectionOpen(section, section.getAttribute('data-ce-collapsible-open') !== 'false');
        var toggle = section.querySelector('[data-ce-collapsible-toggle]');
        if (!toggle) return;
        var toggleSection = function () {
          setStaticSectionOpen(section, section.getAttribute('data-ce-collapsible-open') === 'false');
        };
        toggle.addEventListener('click', toggleSection);
        toggle.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleSection();
          }
        });
      });
      document.addEventListener('click', function (event) {
        var button = event.target && event.target.closest ? event.target.closest('[data-ce-beeswarm-scroll]') : null;
        if (!button) return;
        var layout = button.closest ? button.closest('.swarmLayoutContainer') : null;
        var viewport = layout ? layout.querySelector('[data-ce-beeswarm-scroll-viewport]') : null;
        if (!viewport) return;
        var direction = button.getAttribute('data-ce-beeswarm-scroll') === 'left' ? 'left' : 'right';
        viewport.scrollTo({
          left: direction === 'left' ? 0 : viewport.scrollWidth,
          behavior: 'smooth'
        });
      });
      window.addEventListener('resize', updateBeeswarmScrollControls);
      function modeFromHash() {
        var raw = String(window.location.hash || '').replace(/^#/, '');
        if (knownModes.indexOf(raw) !== -1) return raw;
        if (raw.indexOf('tag-') === 0) {
          var currentMode = document.body.getAttribute('data-ce-results-view-mode') || 'report';
          return knownModes.indexOf(currentMode) === -1 ? 'report' : currentMode;
        }
        var target = getHashTarget();
        var targetMode = target && target.getAttribute ? target.getAttribute('data-ce-report-mode-section') : null;
        if (!targetMode && target && target.closest) {
          var containingSection = target.closest('[data-ce-report-mode-section]');
          targetMode = containingSection && containingSection.getAttribute ? containingSection.getAttribute('data-ce-report-mode-section') : null;
        }
        if (knownModes.indexOf(targetMode) !== -1) return targetMode;
        return 'report';
      }
      function getHashTarget() {
        var raw = String(window.location.hash || '').replace(/^#/, '');
        if (!raw || knownModes.indexOf(raw) !== -1) return null;
        try {
          return document.getElementById(decodeURIComponent(raw)) || document.getElementById(raw);
        } catch (error) {
          return document.getElementById(raw);
        }
      }
      function getScrollTargetForMode(mode) {
        var hashTarget = getHashTarget();
        if (hashTarget && hashTarget.closest) {
          var containingSection = hashTarget.closest('[data-ce-report-mode-section]');
          var containingMode = containingSection && containingSection.getAttribute ? containingSection.getAttribute('data-ce-report-mode-section') : null;
          if ((containingMode || 'report') === mode) {
            if (containingSection && containingSection.hasAttribute('data-ce-static-collapsible')) {
              setStaticSectionOpen(containingSection, true);
            }
            return hashTarget;
          }
        }
        return document.querySelector('.ce-session-results-section') || document.getElementById(mode);
      }
      function scrollToReportViewTarget(target) {
        if (!target) return;
        var scroll = function () {
          if (!target) return;
          if (!target.getBoundingClientRect) {
            if (target.scrollIntoView) target.scrollIntoView({ block: 'start' });
            return;
          }
          var yOffset = window.pageYOffset || document.documentElement.scrollTop || 0;
          var xOffset = window.pageXOffset || document.documentElement.scrollLeft || 0;
          var nextTop = Math.max(0, target.getBoundingClientRect().top + yOffset - 24);
          var htmlScrollBehavior = document.documentElement && document.documentElement.style
            ? document.documentElement.style.scrollBehavior
            : '';
          var bodyScrollBehavior = document.body && document.body.style
            ? document.body.style.scrollBehavior
            : '';
          try {
            if (document.documentElement && document.documentElement.style) {
              document.documentElement.style.scrollBehavior = 'auto';
            }
            if (document.body && document.body.style) {
              document.body.style.scrollBehavior = 'auto';
            }
            window.scrollTo({ top: nextTop, left: xOffset, behavior: 'auto' });
          } catch (error) {
            window.scrollTo(xOffset, nextTop);
          } finally {
            if (document.documentElement && document.documentElement.style) {
              document.documentElement.style.scrollBehavior = htmlScrollBehavior;
            }
            if (document.body && document.body.style) {
              document.body.style.scrollBehavior = bodyScrollBehavior;
            }
          }
        };
        scroll();
        if (window.requestAnimationFrame) window.requestAnimationFrame(scroll);
        window.setTimeout(scroll, 0);
        window.setTimeout(scroll, 80);
        window.setTimeout(scroll, 240);
        window.setTimeout(scroll, 600);
      }
      function setReportViewMode(mode, options) {
        var nextMode = knownModes.indexOf(mode) === -1 ? 'report' : mode;
        var isRawResultsMode = nextMode === 'snapshot-json';
        var displayMode = isRawResultsMode ? lastNonRawResultsMode : nextMode;
        setResultsSectionOpen(true);
        if (!isRawResultsMode) {
          lastNonRawResultsMode = nextMode;
          displayMode = nextMode;
        }
        var shouldScroll = !isRawResultsMode && (!options || options.scroll !== false);
        document.body.setAttribute('data-ce-results-view-mode', displayMode);
        document.body.setAttribute('data-ce-raw-results-open', isRawResultsMode ? 'true' : 'false');
        modeSections.forEach(function (section) {
          var sectionMode = section.getAttribute('data-ce-report-mode-section') || 'report';
          var shouldShow = isRawResultsMode
            ? (sectionMode === 'snapshot-json' || sectionMode === displayMode)
            : sectionMode === displayMode;
          section.hidden = !shouldShow;
          if (shouldShow) {
            section.classList.add('ce-report-view-mode-panel');
            if (section.hasAttribute('data-ce-static-collapsible') && displayMode === 'report') {
              setStaticSectionOpen(section, section.getAttribute('data-ce-default-open') !== 'false');
            }
          }
        });
        modeButtons.forEach(function (button) {
          var isActive = button.getAttribute('data-ce-report-view-mode') === displayMode;
          button.classList.toggle('sectionHeaderViewModeButtonActive', isActive);
          button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        if (rawResultsButton) {
          rawResultsButton.classList.remove('sectionHeaderViewModeButtonActive');
        }
        setRawDemoViewActive(displayMode);
        var target = getScrollTargetForMode(nextMode);
        if (shouldScroll && target) {
          scrollToReportViewTarget(target);
        }
        updateBeeswarmScrollControls();
        notifyParentHash();
      }
      modeButtons.forEach(function (button) {
        button.addEventListener('click', function (event) {
          var nextMode = button.getAttribute('data-ce-report-view-mode') || 'report';
          event.preventDefault();
          if (window.history && window.history.pushState) {
            window.history.pushState(null, '', '#' + (nextMode === 'report' ? 'report' : nextMode));
          } else {
            window.location.hash = nextMode === 'report' ? 'report' : nextMode;
          }
          setReportViewMode(nextMode, { scroll: true });
        });
      });
      if (rawResultsButton) {
        rawResultsButton.addEventListener('click', function (event) {
          event.preventDefault();
          if (window.history && window.history.pushState) {
            window.history.pushState(null, '', '#snapshot-json');
          } else {
            window.location.hash = 'snapshot-json';
          }
          setReportViewMode('snapshot-json', { scroll: false });
        });
      }
      rawDemoViewButtons.forEach(function (button) {
        button.addEventListener('click', function (event) {
          event.preventDefault();
          var nextMode = button.getAttribute('data-ce-raw-demo-view') || 'report';
          if (knownModes.indexOf(nextMode) === -1 || nextMode === 'snapshot-json') {
            nextMode = 'report';
          }
          if (window.history && window.history.pushState) {
            window.history.pushState(null, '', '#' + nextMode);
          } else {
            window.location.hash = nextMode;
          }
          setReportViewMode(nextMode, { scroll: true });
        });
      });
      document.addEventListener('click', function (event) {
        var tagLink = event.target && event.target.closest
          ? event.target.closest('[data-ce-tag-open]')
          : null;
        if (!tagLink) return;
        event.preventDefault();
        openTagModal(tagLink.getAttribute('data-ce-tag') || tagLink.textContent || '');
      });
      tagModalCloseButtons.forEach(function (button) {
        button.addEventListener('click', function (event) {
          event.preventDefault();
          closeTagModal();
        });
      });
      if (tagModal) {
        tagModal.addEventListener('click', function (event) {
          if (event.target === tagModal) closeTagModal();
        });
      }
      if (tagModalQuestions) {
        tagModalQuestions.addEventListener('click', function (event) {
          var questionLink = event.target && event.target.closest
            ? event.target.closest('[data-ce-tag-question-link]')
            : null;
          if (questionLink) closeTagModal({ updateHash: false, restoreFocus: false });
        });
      }
      breakdownTraitMenus.forEach(function (menu) {
        menu.addEventListener('toggle', function () {
          if (!menu.open) return;
          breakdownTraitMenus.forEach(function (otherMenu) {
            if (otherMenu !== menu) otherMenu.open = false;
          });
        });
      });
      breakdownGroupInputs.forEach(function (input) {
        input.addEventListener('change', function () {
          var key = String(input.getAttribute('data-ce-breakdown-group-key') || input.value || '');
          if (!key || !breakdownGroupIndex[key]) return;
          if (input.checked) breakdownSelectedGroupKeys.add(key);
          else breakdownSelectedGroupKeys.delete(key);
          breakdownActiveSuggestion = null;
          updateInteractiveBreakdown(null);
        });
      });
      if (breakdownClearButton) {
        breakdownClearButton.addEventListener('click', function (event) {
          event.preventDefault();
          breakdownSelectedGroupKeys.clear();
          breakdownActiveSuggestion = null;
          updateInteractiveBreakdown(null);
        });
      }
      if (breakdownAutoButton) {
        breakdownAutoButton.addEventListener('click', function (event) {
          event.preventDefault();
          breakdownSelectedGroupKeys = new Set(strongestBreakdownPair());
          breakdownActiveSuggestion = null;
          updateInteractiveBreakdown(null);
        });
      }
      document.addEventListener('click', function (event) {
        var removeButton = event.target && event.target.closest
          ? event.target.closest('[data-ce-breakdown-remove-group]')
          : null;
        var suggestButton = event.target && event.target.closest
          ? event.target.closest('[data-ce-breakdown-suggest-group]')
          : null;
        var actionButton = removeButton || suggestButton;
        if (!actionButton) return;
        var pill = actionButton.closest ? actionButton.closest('[data-ce-breakdown-pill]') : null;
        var key = pill ? String(pill.getAttribute('data-ce-breakdown-group-key') || '') : '';
        if (!key) return;
        event.preventDefault();
        if (removeButton) breakdownSelectedGroupKeys.delete(key);
        else breakdownSelectedGroupKeys = new Set(strongestBreakdownPair(key));
        breakdownActiveSuggestion = null;
        updateInteractiveBreakdown(null);
      });
      if (breakdownSuggestionsList) {
        breakdownSuggestionsList.addEventListener('click', function (event) {
          var button = event.target && event.target.closest
            ? event.target.closest('[data-ce-breakdown-suggestion]')
            : null;
          if (!button || !breakdownSuggestionsList.contains(button)) return;
          event.preventDefault();
          var suggestionIndex = Number(button.getAttribute('data-ce-breakdown-suggestion-index'));
          var suggestion = Number.isInteger(suggestionIndex) ? breakdownCurrentSuggestions[suggestionIndex] : null;
          if (suggestion) {
            breakdownActiveSuggestion = suggestion;
            breakdownCurrentQuestionId = String(suggestion.question.id);
            updateInteractiveBreakdown(button);
          } else {
            applyBreakdownTemplate(button.getAttribute('data-ce-breakdown-template-id'), button);
          }
          var banner = document.querySelector('[data-testid="demo-analysis-question-banner"]');
          if (banner && banner.scrollIntoView) {
            banner.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        });
      }
      breakdownActiveSuggestion = null;
      updateInteractiveBreakdown(null);
      document.querySelectorAll('[data-ce-risk-matrix-cell]').forEach(function (cell) {
        cell.addEventListener('click', function (event) {
          event.preventDefault();
          openRiskMatrixModal(cell);
        });
      });
      document.querySelectorAll('[data-ce-static-compass]').forEach(function (section) {
        var header = section.querySelector('[data-ce-static-compass-toggle]');
        var body = section.querySelector('[data-ce-static-compass-body]');
        var label = section.querySelector('[data-ce-static-compass-label]');
        var openCaret = section.querySelector('[data-ce-static-compass-caret-open]');
        var closedCaret = section.querySelector('[data-ce-static-compass-caret-closed]');
        function setCompassOpen(nextOpen) {
          if (body) body.hidden = !nextOpen;
          if (header) header.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
          if (label) label.textContent = nextOpen ? 'Hide' : 'Show';
          if (openCaret) openCaret.hidden = !nextOpen;
          if (closedCaret) closedCaret.hidden = nextOpen;
        }
        if (!header) return;
        header.addEventListener('click', function (event) {
          event.preventDefault();
          setCompassOpen(header.getAttribute('aria-expanded') !== 'true');
        });
        header.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setCompassOpen(header.getAttribute('aria-expanded') !== 'true');
          }
        });
      });
      atlasOpenButtons.forEach(function (button) {
        button.addEventListener('click', function (event) {
          event.preventDefault();
          openAtlasIssueModal(button.getAttribute('data-ce-atlas-open') || '');
        });
      });
      if (atlasTagFilter) {
        atlasTagFilter.addEventListener('change', updateAtlasBrowse);
        atlasTagFilter.addEventListener('keydown', function (event) {
          if (event.key === 'Escape') {
            atlasTagFilter.open = false;
            var summary = atlasTagFilter.querySelector('summary');
            if (summary) summary.focus();
          }
        });
      }
      if (atlasTagClearButton) {
        atlasTagClearButton.addEventListener('click', function (event) {
          event.preventDefault();
          atlasTagInputs.forEach(function (input) { input.checked = false; });
          updateAtlasBrowse();
          if (atlasTagFilter) atlasTagFilter.open = false;
        });
      }
      document.addEventListener('click', function (event) {
        if (atlasTagFilter && atlasTagFilter.open && !atlasTagFilter.contains(event.target)) atlasTagFilter.open = false;
      });
      if (atlasSortSelect) atlasSortSelect.addEventListener('change', updateAtlasBrowse);
      atlasIssueModalCloseButtons.forEach(function (button) {
        button.addEventListener('click', function (event) {
          event.preventDefault();
          closeAtlasIssueModal();
        });
      });
      if (atlasIssueModal) {
        atlasIssueModal.addEventListener('click', function (event) {
          if (event.target === atlasIssueModal) closeAtlasIssueModal();
        });
      }
      if (atlasIssueCopyLinkButton) {
        atlasIssueCopyLinkButton.addEventListener('click', function (event) {
          event.preventDefault();
          copyAtlasIssueDeepLink();
        });
      }
      if (atlasIssueModalBody) {
        atlasIssueModalBody.addEventListener('mouseover', function (event) {
          var card = atlasModelCardFromEvent(event);
          if (!card) return;
          hoveredAtlasModelId = card.getAttribute('data-ce-atlas-model-card') || '';
          applyAtlasModelHighlight();
        });
        atlasIssueModalBody.addEventListener('mouseout', function (event) {
          var card = atlasModelCardFromEvent(event);
          if (!card || (event.relatedTarget && card.contains(event.relatedTarget))) return;
          hoveredAtlasModelId = '';
          applyAtlasModelHighlight();
        });
        atlasIssueModalBody.addEventListener('focusin', function (event) {
          var card = atlasModelCardFromEvent(event);
          if (!card) return;
          focusedAtlasModelId = card.getAttribute('data-ce-atlas-model-card') || '';
          applyAtlasModelHighlight();
        });
        atlasIssueModalBody.addEventListener('focusout', function (event) {
          var card = atlasModelCardFromEvent(event);
          if (!card || (event.relatedTarget && card.contains(event.relatedTarget))) return;
          focusedAtlasModelId = '';
          applyAtlasModelHighlight();
        });
        atlasIssueModalBody.addEventListener('click', function (event) {
          var modelCard = atlasModelCardFromEvent(event);
          if (modelCard) {
            event.preventDefault();
            var modelId = modelCard.getAttribute('data-ce-atlas-model-card') || '';
            if (lockedAtlasModelId === modelId) {
              lockedAtlasModelId = '';
              hoveredAtlasModelId = '';
              focusedAtlasModelId = '';
              if (modelCard.blur) modelCard.blur();
            } else {
              lockedAtlasModelId = modelId;
            }
            applyAtlasModelHighlight();
            return;
          }
          var collapseButton = event.target && event.target.closest
            ? event.target.closest('[data-ce-atlas-modal-collapse]')
            : null;
          if (collapseButton && atlasIssueModalBody.contains(collapseButton)) {
            event.preventDefault();
            setAtlasModalCollapse(collapseButton, collapseButton.getAttribute('aria-expanded') !== 'true');
            return;
          }
          var tagButton = event.target && event.target.closest
            ? event.target.closest('[data-ce-atlas-modal-tag]')
            : null;
          if (tagButton && atlasIssueModalBody.contains(tagButton)) {
            event.preventDefault();
            var tag = tagButton.getAttribute('data-ce-atlas-modal-tag') || '';
            var matchingTagInput = atlasTagInputs.find(function (input) { return String(input.value || '') === tag; });
            if (matchingTagInput) matchingTagInput.checked = true;
            updateAtlasBrowse();
            closeAtlasIssueModal({ restoreFocus: false });
            var atlasTagSummary = atlasTagFilter ? atlasTagFilter.querySelector('summary') : null;
            if (atlasTagSummary) atlasTagSummary.focus();
            return;
          }
          var questionLink = event.target && event.target.closest
            ? event.target.closest('[data-ce-atlas-question-link]')
            : null;
          if (questionLink && atlasIssueModalBody.contains(questionLink)) {
            closeAtlasIssueModal({ updateHash: false, restoreFocus: false });
          }
        });
      }
      if (questionModelLegend) {
        questionModelLegend.addEventListener('mouseover', function (event) {
          var card = questionModelCardFromEvent(event);
          if (!card) return;
          hoveredQuestionModelId = card.getAttribute('data-ce-question-model-card') || '';
          applyQuestionModelHighlight();
        });
        questionModelLegend.addEventListener('mouseout', function (event) {
          var card = questionModelCardFromEvent(event);
          if (!card || (event.relatedTarget && card.contains(event.relatedTarget))) return;
          hoveredQuestionModelId = '';
          applyQuestionModelHighlight();
        });
        questionModelLegend.addEventListener('focusin', function (event) {
          var card = questionModelCardFromEvent(event);
          if (!card) return;
          focusedQuestionModelId = card.getAttribute('data-ce-question-model-card') || '';
          applyQuestionModelHighlight();
        });
        questionModelLegend.addEventListener('focusout', function (event) {
          var card = questionModelCardFromEvent(event);
          if (!card || (event.relatedTarget && card.contains(event.relatedTarget))) return;
          focusedQuestionModelId = '';
          applyQuestionModelHighlight();
        });
        questionModelLegend.addEventListener('click', function (event) {
          var card = questionModelCardFromEvent(event);
          if (!card) return;
          event.preventDefault();
          var modelId = card.getAttribute('data-ce-question-model-card') || '';
          if (lockedQuestionModelIds.has(modelId)) {
            lockedQuestionModelIds.delete(modelId);
            if (lockedQuestionModelIds.size === 0) {
              hoveredQuestionModelId = '';
              focusedQuestionModelId = '';
              if (card.blur) card.blur();
            }
          } else {
            lockedQuestionModelIds.add(modelId);
          }
          applyQuestionModelHighlight();
        });
      }
      riskMatrixCloseButtons.forEach(function (button) {
        button.addEventListener('click', function (event) {
          event.preventDefault();
          closeRiskMatrixModal();
        });
      });
      if (riskMatrixBackdrop) {
        riskMatrixBackdrop.addEventListener('click', function () {
          closeRiskMatrixModal();
        });
      }
      closeRawResultsButtons.forEach(function (closeRawResultsButton) {
        closeRawResultsButton.addEventListener('click', function (event) {
          event.preventDefault();
          var restoreMode = knownModes.indexOf(lastNonRawResultsMode) === -1 || lastNonRawResultsMode === 'snapshot-json'
            ? 'report'
            : lastNonRawResultsMode;
          if (window.history && window.history.pushState) {
            window.history.pushState(null, '', '#' + restoreMode);
          } else {
            window.location.hash = restoreMode;
          }
          setReportViewMode(restoreMode, { scroll: true });
        });
      });
      window.addEventListener('hashchange', function () {
        if (syncTagModalWithHash()) return;
        setReportViewMode(modeFromHash(), { scroll: true });
        syncAtlasIssueModalWithHash();
      });
      if (staticPdfButton) {
        staticPdfButton.addEventListener('click', function (event) {
          event.preventDefault();
          window.print();
        });
      }
      if (settingsToggleButton && settingsRow) {
        settingsToggleButton.addEventListener('click', function () {
          var willHide = !settingsRow.hidden;
          settingsRow.hidden = willHide;
          settingsToggleButton.setAttribute('aria-label', willHide ? 'Show report settings' : 'Hide report settings');
        });
      }
      if (resultsToggle) {
        resultsToggle.addEventListener('click', function () {
          setResultsSectionOpen(resultsSection && resultsSection.getAttribute('data-ce-results-open') === 'false');
        });
        resultsToggle.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setResultsSectionOpen(resultsSection && resultsSection.getAttribute('data-ce-results-open') === 'false');
          }
        });
      }
      if (resultsTooltip) {
        resultsTooltip.addEventListener('click', function (event) {
          event.stopPropagation();
        });
        resultsTooltip.addEventListener('keydown', function (event) {
          event.stopPropagation();
        });
      }
      if (atlasTopDebatesButton && atlasTopDebatesOverlay) {
        atlasTopDebatesButton.addEventListener('click', function (event) {
          event.preventDefault();
          setAtlasTopDebatesOpen(!atlasTopDebatesOverlay.classList.contains('visible'));
        });
      }
      if (atlasTopDebatesCloseButton) {
        atlasTopDebatesCloseButton.addEventListener('click', function (event) {
          event.preventDefault();
          setAtlasTopDebatesOpen(false);
        });
      }
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          if (tagModal && !tagModal.hidden) {
            closeTagModal();
            return;
          }
          setAtlasTopDebatesOpen(false);
          closeRiskMatrixModal();
          closeAtlasIssueModal();
          return;
        }
        if (event.key === 'Tab' && tagModal && !tagModal.hidden) {
          var tagFocusable = getTagModalFocusableElements();
          if (!tagFocusable.length) {
            event.preventDefault();
            if (tagModalContent) tagModalContent.focus();
            return;
          }
          var firstTagFocusable = tagFocusable[0];
          var lastTagFocusable = tagFocusable[tagFocusable.length - 1];
          if (event.shiftKey && document.activeElement === firstTagFocusable) {
            event.preventDefault();
            lastTagFocusable.focus();
          } else if (!event.shiftKey && document.activeElement === lastTagFocusable) {
            event.preventDefault();
            firstTagFocusable.focus();
          }
          return;
        }
        if (event.key === 'Tab' && atlasIssueModal && !atlasIssueModal.hidden) {
          var focusable = getAtlasModalFocusableElements();
          if (!focusable.length) {
            event.preventDefault();
            if (atlasIssueModalContent) atlasIssueModalContent.focus();
            return;
          }
          var firstFocusable = focusable[0];
          var lastFocusable = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === firstFocusable) {
            event.preventDefault();
            lastFocusable.focus();
          } else if (!event.shiftKey && document.activeElement === lastFocusable) {
            event.preventDefault();
            firstFocusable.focus();
          }
        }
      });
      if (reportStyleSelect) {
        reportStyleSelect.addEventListener('change', function () {
          setReportStyle(reportStyleSelect.value);
        });
      }
      if (collapseAllButton) {
        collapseAllButton.addEventListener('click', function () {
          document.querySelectorAll('[data-ce-static-collapsible][data-ce-report-mode-section="report"]').forEach(function (section) {
            setStaticSectionOpen(section, false);
          });
        });
      }
      if (expandAllButton) {
        expandAllButton.addEventListener('click', function () {
          document.querySelectorAll('[data-ce-static-collapsible][data-ce-report-mode-section="report"]').forEach(function (section) {
            setStaticSectionOpen(section, true);
          });
        });
      }
      function downloadJsonFromElement(sourceEl, filename) {
        if (!sourceEl) return;
        var blob = new Blob([sourceEl.textContent || '{}'], { type: 'application/json;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      }
      downloadButtons.forEach(function (button) {
        button.addEventListener('click', function () {
          downloadJsonFromElement(snapshotEl, 'ai-discourse-bench-results-report.json');
        });
      });
      polisExportButtons.forEach(function (button) {
        button.addEventListener('click', function () {
          downloadJsonFromElement(polisExportEl, 'ai-discourse-bench-ce-polis-export.json');
        });
      });
      analysisInputButtons.forEach(function (button) {
        button.addEventListener('click', function () {
          downloadJsonFromElement(analysisInputEl, 'ai-discourse-bench-ai-analysis-input.json');
        });
      });
      setExportAreaOpen(false);
      exportToggleButtons.forEach(function (button) {
        button.addEventListener('click', function (event) {
          event.preventDefault();
          setExportAreaOpen(exportArea ? exportArea.hidden : true);
        });
      });
      document.addEventListener('mouseover', function (event) {
        var point = event.target && event.target.closest ? event.target.closest('[data-ce-beeswarm-point]') : null;
        if (!point) return;
        setBeeswarmPointHovered(point, true);
        renderBeeswarmTooltip(point);
        positionBeeswarmTooltip(event.clientX, event.clientY);
      });
      document.addEventListener('mousemove', function (event) {
        if (!beeswarmTooltip || beeswarmTooltip.hidden) return;
        var point = event.target && event.target.closest ? event.target.closest('[data-ce-beeswarm-point]') : null;
        if (point) positionBeeswarmTooltip(event.clientX, event.clientY);
      });
      document.addEventListener('mouseout', function (event) {
        var point = event.target && event.target.closest ? event.target.closest('[data-ce-beeswarm-point]') : null;
        if (!point) return;
        var relatedPoint = event.relatedTarget && event.relatedTarget.closest ? event.relatedTarget.closest('[data-ce-beeswarm-point]') : null;
        if (relatedPoint !== point) {
          setBeeswarmPointHovered(point, false);
          hideBeeswarmTooltip();
        }
      });
      document.addEventListener('focusin', function (event) {
        var point = event.target && event.target.closest ? event.target.closest('[data-ce-beeswarm-point]') : null;
        if (!point) return;
        var rect = point.getBoundingClientRect();
        setBeeswarmPointHovered(point, true);
        renderBeeswarmTooltip(point);
        positionBeeswarmTooltip(rect.left + rect.width / 2, rect.top + rect.height / 2);
      });
      document.addEventListener('focusout', function (event) {
        var point = event.target && event.target.closest ? event.target.closest('[data-ce-beeswarm-point]') : null;
        if (point) {
          setBeeswarmPointHovered(point, false);
          hideBeeswarmTooltip();
        }
      });
      document.addEventListener('mouseover', function (event) {
        var point = event.target && event.target.closest ? event.target.closest('[data-ce-graph-participant-point]') : null;
        if (!point) return;
        renderGraphParticipantTooltip(point);
        positionBeeswarmTooltip(event.clientX, event.clientY);
      });
      document.addEventListener('mousemove', function (event) {
        if (!beeswarmTooltip || beeswarmTooltip.hidden) return;
        var point = event.target && event.target.closest ? event.target.closest('[data-ce-graph-participant-point]') : null;
        if (point) positionBeeswarmTooltip(event.clientX, event.clientY);
      });
      document.addEventListener('mouseout', function (event) {
        var point = event.target && event.target.closest ? event.target.closest('[data-ce-graph-participant-point]') : null;
        if (!point) return;
        var relatedPoint = event.relatedTarget && event.relatedTarget.closest ? event.relatedTarget.closest('[data-ce-graph-participant-point]') : null;
        if (relatedPoint !== point) hideBeeswarmTooltip();
      });
      document.addEventListener('focusin', function (event) {
        var point = event.target && event.target.closest ? event.target.closest('[data-ce-graph-participant-point]') : null;
        if (!point) return;
        var rect = point.getBoundingClientRect();
        renderGraphParticipantTooltip(point);
        positionBeeswarmTooltip(rect.left + rect.width / 2, rect.top + rect.height / 2);
      });
      document.addEventListener('focusout', function (event) {
        var point = event.target && event.target.closest ? event.target.closest('[data-ce-graph-participant-point]') : null;
        if (point) hideBeeswarmTooltip();
      });
      document.querySelectorAll('[data-ce-graph-toggle]').forEach(function (input) {
        input.addEventListener('change', function () {
          var selectorByLayer = {
            statements: '.graph-statement',
            participants: '.graph-participant',
            outline: '.graph-outline',
            axes: '.graph-axis',
            'radial-axes': '.graph-radial-axes'
          };
          var selector = selectorByLayer[input.getAttribute('data-ce-graph-toggle')];
          if (!selector) return;
          document.querySelectorAll(selector).forEach(function (node) {
            node.toggleAttribute('hidden', !input.checked);
          });
        });
      });
      var opinionGroupPalette = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
      var activeOpinionGroupCount = Number(participantClusterPayload && participantClusterPayload.autoClusterCount || 0);
      function opinionGroupColor(clusterIndex) {
        var index = Number(clusterIndex);
        return index < 0 || !Number.isFinite(index)
          ? '#94a3b8'
          : opinionGroupPalette[Math.abs(index) % opinionGroupPalette.length];
      }
      function setGraphParticipantCluster(point, clusterIndex) {
        if (!point) return;
        var cluster = Number.isInteger(Number(clusterIndex)) ? Number(clusterIndex) : -1;
        var clusterLabel = cluster < 0 ? 'Insufficient overlap' : 'Opinion Group ' + String(cluster + 1);
        var participantLabel = point.dataset.participantLabel || point.dataset.participantId || 'Participant';
        point.setAttribute('data-ce-graph-cluster', String(cluster));
        point.setAttribute('data-participant-group', clusterLabel);
        point.setAttribute('aria-label', participantLabel + ': ' + clusterLabel);
        var circle = point.querySelector('circle');
        if (circle) circle.setAttribute('fill', opinionGroupColor(cluster));
        var title = point.querySelector('title');
        if (title) title.textContent = participantLabel + ': ' + clusterLabel;
      }
      function uniqueParticipantGraphPoints(points) {
        var seen = {};
        return points.filter(function (point) {
          if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
          var key = String(point.x) + ':' + String(point.y);
          if (seen[key]) return false;
          seen[key] = true;
          return true;
        });
      }
      function buildParticipantGraphHull(points) {
        var sorted = uniqueParticipantGraphPoints(points).slice().sort(function (left, right) {
          return left.x - right.x || left.y - right.y;
        });
        if (sorted.length < 3) return null;
        function cross(origin, left, right) {
          return (left.x - origin.x) * (right.y - origin.y)
            - (left.y - origin.y) * (right.x - origin.x);
        }
        var lower = [];
        sorted.forEach(function (point) {
          while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
            lower.pop();
          }
          lower.push(point);
        });
        var upper = [];
        sorted.slice().reverse().forEach(function (point) {
          while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
            upper.pop();
          }
          upper.push(point);
        });
        var hull = lower.slice(0, -1).concat(upper.slice(0, -1));
        return hull.length >= 3 ? hull : null;
      }
      function participantGraphHullPath(points) {
        return points.map(function (point, index) {
          return (index === 0 ? 'M' : 'L') + String(point.x) + ',' + String(point.y);
        }).join(' ') + ' Z';
      }
      function setOpinionGroupOutlineVisibility(outline, outlineToggle) {
        if (outlineToggle && !outlineToggle.checked) outline.setAttribute('hidden', '');
      }
      function renderOpinionGroupOutlines() {
        if (!participantGraph) return;
        var outlineLayer = participantGraph.querySelector('.graph-outlines');
        if (!outlineLayer) return;
        while (outlineLayer.firstChild) outlineLayer.removeChild(outlineLayer.firstChild);
        var groups = {};
        participantGraph.querySelectorAll('[data-ce-graph-participant-point]').forEach(function (point) {
          var circle = point.querySelector('circle');
          if (!circle) return;
          var cluster = String(point.getAttribute('data-ce-graph-cluster') || '-1');
          groups[cluster] = groups[cluster] || [];
          groups[cluster].push({
            x: Number(circle.getAttribute('cx')),
            y: Number(circle.getAttribute('cy'))
          });
        });
        var outlineToggle = document.querySelector('[data-ce-graph-toggle="outline"]');
        Object.keys(groups).forEach(function (cluster) {
          var points = uniqueParticipantGraphPoints(groups[cluster]);
          if (points.length < 2) return;
          var color = opinionGroupColor(Number(cluster));
          if (points.length === 2) {
            var connector = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            connector.setAttribute('class', 'graph-outline graph-group-connector');
            connector.setAttribute('data-ce-graph-cluster', cluster);
            connector.setAttribute('x1', String(points[0].x));
            connector.setAttribute('y1', String(points[0].y));
            connector.setAttribute('x2', String(points[1].x));
            connector.setAttribute('y2', String(points[1].y));
            connector.setAttribute('stroke', color);
            connector.setAttribute('stroke-opacity', '0.7');
            connector.setAttribute('stroke-width', '1');
            setOpinionGroupOutlineVisibility(connector, outlineToggle);
            outlineLayer.appendChild(connector);
            return;
          }
          var hull = buildParticipantGraphHull(points);
          if (!hull) return;
          var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('class', 'graph-outline graph-group-hull');
          path.setAttribute('data-ce-graph-cluster', cluster);
          path.setAttribute('d', participantGraphHullPath(hull));
          path.setAttribute('fill', color);
          path.setAttribute('fill-opacity', '0.1');
          path.setAttribute('stroke', color);
          path.setAttribute('stroke-opacity', '0.7');
          path.setAttribute('stroke-width', '1');
          setOpinionGroupOutlineVisibility(path, outlineToggle);
          outlineLayer.appendChild(path);
        });
      }
      function appendManualClusterLegendSection(clusterIndex, label, members, description) {
        if (!clusterLegendItems) return;
        var section = document.createElement('div');
        section.className = 'clusterSectionDiv';
        section.setAttribute('data-ce-cluster-section', '');
        section.setAttribute('data-ce-cluster-open', 'false');
        section.setAttribute('data-ce-cluster-source', 'manual');
        var header = document.createElement('div');
        header.className = 'clusterLegendHeader';
        header.setAttribute('data-ce-cluster-toggle', '');
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-expanded', 'false');
        var labelWrap = document.createElement('div');
        labelWrap.className = 'clusterLegendLabel';
        var swatch = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        swatch.setAttribute('width', '16');
        swatch.setAttribute('height', '16');
        swatch.setAttribute('class', 'clusterSwatchSvg');
        swatch.setAttribute('aria-hidden', 'true');
        var swatchCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        swatchCircle.setAttribute('cx', '8');
        swatchCircle.setAttribute('cy', '8');
        swatchCircle.setAttribute('r', '6');
        swatchCircle.setAttribute('fill', opinionGroupColor(clusterIndex));
        swatch.appendChild(swatchCircle);
        var name = document.createElement('span');
        name.className = 'clusterLegendName';
        name.textContent = label;
        labelWrap.appendChild(swatch);
        labelWrap.appendChild(name);
        var icon = document.createElement('span');
        icon.className = 'clusterLegendToggleIcon';
        icon.setAttribute('aria-hidden', 'true');
        var openIcon = document.createElement('span');
        openIcon.className = 'clusterToggleSvgIcon clusterToggleSvgIconOpen';
        openIcon.textContent = '-';
        var closedIcon = document.createElement('span');
        closedIcon.className = 'clusterToggleSvgIcon clusterToggleSvgIconClosed';
        closedIcon.textContent = '+';
        icon.appendChild(openIcon);
        icon.appendChild(closedIcon);
        header.appendChild(labelWrap);
        header.appendChild(icon);
        var body = document.createElement('div');
        body.className = 'clusterLegendBody';
        body.setAttribute('data-ce-cluster-body', '');
        body.hidden = true;
        var method = document.createElement('p');
        method.className = 'ce-report-muted';
        method.textContent = description;
        body.appendChild(method);
        var list = document.createElement('ul');
        members.forEach(function (member) {
          var item = document.createElement('li');
          item.textContent = member.label || member.id;
          list.appendChild(item);
        });
        body.appendChild(list);
        var omitted = document.createElement('div');
        omitted.className = 'clusterLegendOmitted';
        omitted.setAttribute('data-ce-cluster-omitted', '');
        var omittedText = document.createElement('em');
        omittedText.className = 'showWhenPdf';
        omittedText.textContent = 'Omitted';
        omitted.appendChild(omittedText);
        section.appendChild(header);
        section.appendChild(body);
        section.appendChild(omitted);
        clusterLegendItems.appendChild(section);
        setClusterSectionOpen(section, false);
      }
      function renderManualClusterLegend(assignments, clusterCount) {
        if (!clusterLegendItems || !participantClusterPayload) return;
        while (clusterLegendItems.firstChild) clusterLegendItems.removeChild(clusterLegendItems.firstChild);
        var participants = Array.isArray(participantClusterPayload.participants)
          ? participantClusterPayload.participants
          : [];
        for (var cluster = 0; cluster < clusterCount; cluster += 1) {
          var members = participants.filter(function (participant) {
            return participant.eligible && Number(assignments[participant.id]) === cluster;
          });
          appendManualClusterLegendSection(
            cluster,
            'Opinion Group ' + String(cluster + 1),
            members,
            'Manual preview: deterministic K-medoids over the report similarity matrix.'
          );
        }
        var ineligible = participants.filter(function (participant) { return !participant.eligible; });
        if (ineligible.length) {
          appendManualClusterLegendSection(
            -1,
            'Insufficient overlap',
            ineligible,
            'These participants do not have enough shared question coverage for similarity grouping.'
          );
        }
      }
      function syncOpinionGroupControls(clusterCount, isAuto) {
        if (!participantClusterPayload) return;
        var min = Number(participantClusterPayload.minClusterCount || 0);
        var max = Number(participantClusterPayload.maxClusterCount || 0);
        if (clusterCountInput) {
          clusterCountInput.value = String(clusterCount);
          clusterCountInput.disabled = max < 1;
          clusterCountInput.setAttribute('aria-disabled', max < 1 ? 'true' : 'false');
        }
        clusterStepButtons.forEach(function (button) {
          var delta = Number(button.getAttribute('data-ce-cluster-step') || 0);
          var disabled = max < 1 || clusterCount + delta < min || clusterCount + delta > max;
          button.disabled = disabled;
          button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
        });
        if (clusterAutoButton) {
          clusterAutoButton.disabled = max < 1;
          clusterAutoButton.setAttribute('aria-disabled', max < 1 ? 'true' : 'false');
          clusterAutoButton.setAttribute('aria-pressed', isAuto ? 'true' : 'false');
          clusterAutoButton.classList.toggle('clusterAutoButtonActive', isAuto);
        }
        if (opinionGroupStatus) {
          opinionGroupStatus.textContent = isAuto
            ? 'Showing ' + String(clusterCount) + ' automatically generated opinion groups.'
            : 'Showing ' + String(clusterCount) + ' manual K-medoids opinion groups.';
        }
      }
      function applyOpinionGroupAssignments(assignments, clusterCount, isAuto) {
        if (!participantGraph || !participantClusterPayload) return;
        participantGraph.querySelectorAll('[data-ce-graph-participant-point]').forEach(function (point) {
          var participantId = point.getAttribute('data-participant-id') || '';
          var cluster = Object.prototype.hasOwnProperty.call(assignments || {}, participantId)
            ? Number(assignments[participantId])
            : -1;
          setGraphParticipantCluster(point, cluster);
        });
        activeOpinionGroupCount = clusterCount;
        renderOpinionGroupOutlines();
        if (isAuto) {
          if (clusterLegendItems) clusterLegendItems.innerHTML = autoClusterLegendHtml;
          initializeClusterSections();
        } else {
          renderManualClusterLegend(assignments || {}, clusterCount);
        }
        syncOpinionGroupControls(clusterCount, isAuto);
      }
      function applyOpinionGroupCount(requestedCount) {
        if (!participantClusterPayload) return;
        var min = Number(participantClusterPayload.minClusterCount || 0);
        var max = Number(participantClusterPayload.maxClusterCount || 0);
        if (max < 1) return;
        var clusterCount = Math.max(min, Math.min(max, Math.round(Number(requestedCount) || min)));
        var assignments = participantClusterPayload.assignmentsByCount
          ? participantClusterPayload.assignmentsByCount[String(clusterCount)]
          : null;
        if (!assignments) return;
        applyOpinionGroupAssignments(assignments, clusterCount, false);
      }
      function restoreAutoOpinionGroups() {
        if (!participantClusterPayload) return;
        applyOpinionGroupAssignments(
          participantClusterPayload.autoAssignments || {},
          Number(participantClusterPayload.autoClusterCount || 0),
          true
        );
      }
      function setClusterSectionOpen(section, isOpen) {
        if (!section) return;
        var nextOpen = !!isOpen;
        section.setAttribute('data-ce-cluster-open', nextOpen ? 'true' : 'false');
        var body = section.querySelector('[data-ce-cluster-body]');
        if (body) body.hidden = !nextOpen;
        var omitted = section.querySelector('[data-ce-cluster-omitted]');
        if (omitted) omitted.hidden = nextOpen;
        var toggle = section.querySelector('[data-ce-cluster-toggle]');
        if (toggle) toggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
      }
      function initializeClusterSections() {
        document.querySelectorAll('[data-ce-cluster-section]').forEach(function (section) {
          setClusterSectionOpen(section, section.getAttribute('data-ce-cluster-open') !== 'false');
        });
      }
      function toggleClusterFromEvent(event) {
        var toggle = event.target && event.target.closest
          ? event.target.closest('[data-ce-cluster-toggle]')
          : null;
        if (!toggle || !clusterLegendItems || !clusterLegendItems.contains(toggle)) return;
        var section = toggle.closest('[data-ce-cluster-section]');
        setClusterSectionOpen(section, section && section.getAttribute('data-ce-cluster-open') === 'false');
      }
      initializeClusterSections();
      if (clusterLegendItems) {
        clusterLegendItems.addEventListener('click', toggleClusterFromEvent);
        clusterLegendItems.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            var toggle = event.target && event.target.closest
              ? event.target.closest('[data-ce-cluster-toggle]')
              : null;
            if (!toggle) return;
            event.preventDefault();
            toggleClusterFromEvent(event);
          }
        });
      }
      clusterStepButtons.forEach(function (button) {
        button.addEventListener('click', function () {
          applyOpinionGroupCount(activeOpinionGroupCount + Number(button.getAttribute('data-ce-cluster-step') || 0));
        });
      });
      if (clusterCountInput) {
        clusterCountInput.addEventListener('change', function () {
          applyOpinionGroupCount(clusterCountInput.value);
        });
        clusterCountInput.addEventListener('keydown', function (event) {
          if (event.key === 'Enter') {
            event.preventDefault();
            applyOpinionGroupCount(clusterCountInput.value);
          }
        });
      }
      if (clusterAutoButton) clusterAutoButton.addEventListener('click', restoreAutoOpinionGroups);
      if (participantClusterPayload) restoreAutoOpinionGroups();
      document.querySelectorAll('[data-ce-clusters-action]').forEach(function (button) {
        button.addEventListener('click', function () {
          var shouldOpen = button.getAttribute('data-ce-clusters-action') === 'expand';
          document.querySelectorAll('[data-ce-cluster-section]').forEach(function (section) {
            setClusterSectionOpen(section, shouldOpen);
          });
        });
      });
      function syncInitialReportViewMode() {
        window.setTimeout(function () {
          setReportViewMode(modeFromHash(), { scroll: true });
          if (!syncTagModalWithHash()) syncAtlasIssueModalWithHash();
        }, 0);
      }
      updateAtlasBrowse();
      setReportViewMode(modeFromHash(), { scroll: false });
      if (!syncTagModalWithHash()) syncAtlasIssueModalWithHash();
      syncInitialReportViewMode();
      notifyParentHash();
      setReportStyle(reportStyleSelect ? reportStyleSelect.value : 'original');
      window.addEventListener('load', syncInitialReportViewMode, { once: true });
      updateBeeswarmScrollControls();
    }());
  </script>
</body>
</html>
`;
