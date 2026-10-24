const WIDTH = 1080;
const HEIGHT = 720;
const TEXT = [248, 250, 255, 255];
const BLUE = [44, 195, 255, 255];
const WHITE = [255, 255, 255, 255];
const BLACK = [20, 24, 35, 255];
const GRID = [220, 224, 235, 255];
const SLATE = [86, 96, 118, 255];
const ORANGE = [255, 153, 0, 255];
const LIGHT_BG = [247, 249, 252, 255];
const CARD_BORDER = [225, 230, 238, 255];
const PILL_BG = [249, 251, 255, 255];
const SOFT_GREEN = [229, 248, 236, 255];
const SOFT_BLUE = [232, 243, 255, 255];
const SOFT_YELLOW = [255, 247, 226, 255];
const SOFT_PURPLE = [243, 236, 255, 255];
const SOFT_RED = [255, 238, 236, 255];
const AGREE_GREEN = [18, 181, 105, 255];
const UNSURE_YELLOW = [245, 181, 0, 255];
const DISAGREE_RED = [255, 68, 61, 255];
const GROUP_COLORS = Object.freeze([
  [31, 119, 214, 255],
  [255, 159, 28, 255],
  [22, 163, 74, 255],
  [168, 85, 247, 255],
]);
const TOPIC_COLORS = Object.freeze([
  { fill: SOFT_GREEN, stroke: AGREE_GREEN },
  { fill: SOFT_BLUE, stroke: BLUE },
  { fill: SOFT_YELLOW, stroke: ORANGE },
  { fill: SOFT_PURPLE, stroke: GROUP_COLORS[3] },
  { fill: SOFT_RED, stroke: DISAGREE_RED },
]);

const FONT = Object.freeze({
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  6: ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '01100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '01100', '01000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  '-': ['00000', '00000', '00000', '11110', '00000', '00000', '00000'],
  '_': ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '|': ['00100', '00100', '00100', '00100', '00100', '00100', '00100'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '[': ['01110', '01000', '01000', '01000', '01000', '01000', '01110'],
  ']': ['01110', '00010', '00010', '00010', '00010', '00010', '01110'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '*': ['00000', '10101', '01110', '11111', '01110', '10101', '00000'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
});

function putPixel(pixels, width, x, y, color) {
  if (x < 0 || y < 0 || x >= width || y >= HEIGHT) return;
  const offset = (y * width + x) * 4;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
  pixels[offset + 3] = color[3];
}

function fillRect(pixels, width, x, y, w, h, color) {
  for (let yy = Math.max(0, y); yy < Math.min(HEIGHT, y + h); yy += 1) {
    for (let xx = Math.max(0, x); xx < Math.min(width, x + w); xx += 1) {
      putPixel(pixels, width, xx, yy, color);
    }
  }
}

function strokeRect(pixels, width, x, y, w, h, color) {
  fillRect(pixels, width, x, y, w, 2, color);
  fillRect(pixels, width, x, y + h - 2, w, 2, color);
  fillRect(pixels, width, x, y, 2, h, color);
  fillRect(pixels, width, x + w - 2, y, 2, h, color);
}

function fillRoundRect(pixels, width, x, y, w, h, radius, color) {
  const r = Math.max(0, Math.round(radius));
  fillRect(pixels, width, x + r, y, w - 2 * r, h, color);
  fillRect(pixels, width, x, y + r, w, h - 2 * r, color);
  fillCircle(pixels, width, x + r, y + r, r, color);
  fillCircle(pixels, width, x + w - r - 1, y + r, r, color);
  fillCircle(pixels, width, x + r, y + h - r - 1, r, color);
  fillCircle(pixels, width, x + w - r - 1, y + h - r - 1, r, color);
}

function drawLine(pixels, width, x1, y1, x2, y2, color) {
  let x = Math.round(x1);
  let y = Math.round(y1);
  const endX = Math.round(x2);
  const endY = Math.round(y2);
  const dx = Math.abs(endX - x);
  const sx = x < endX ? 1 : -1;
  const dy = -Math.abs(endY - y);
  const sy = y < endY ? 1 : -1;
  let err = dx + dy;
  while (true) {
    fillRect(pixels, width, x - 1, y - 1, 3, 3, color);
    if (x === endX && y === endY) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function fillCircle(pixels, width, cx, cy, radius, color) {
  const r = Math.max(1, Math.round(radius));
  for (let y = -r; y <= r; y += 1) {
    for (let x = -r; x <= r; x += 1) {
      if ((x * x) + (y * y) <= r * r) {
        putPixel(pixels, width, Math.round(cx) + x, Math.round(cy) + y, color);
      }
    }
  }
}

function strokeCircle(pixels, width, cx, cy, radius, color) {
  const r = Math.max(2, Math.round(radius));
  for (let angle = 0; angle < 360; angle += 2) {
    const radians = (angle * Math.PI) / 180;
    const x = Math.round(cx + Math.cos(radians) * r);
    const y = Math.round(cy + Math.sin(radians) * r);
    fillRect(pixels, width, x - 1, y - 1, 3, 3, color);
  }
}

function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, ' ')
    .replace(/[●•]/g, '*')
    .toUpperCase();
}

function drawText(pixels, width, text, x, y, scale = 3, color = TEXT) {
  let cursor = x;
  for (const char of normalizeText(text)) {
    const glyph = FONT[char] || FONT['?'];
    glyph.forEach((row, rowIndex) => {
      for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
        if (row[colIndex] !== '1') continue;
        fillRect(
          pixels,
          width,
          cursor + colIndex * scale,
          y + rowIndex * scale,
          scale,
          scale,
          color
        );
      }
    });
    cursor += 6 * scale;
  }
  return cursor;
}

function textPixelWidth(text = '', scale = 3) {
  return normalizeText(text).length * 6 * scale;
}

function drawPill(pixels, width, text, x, y, {
  scale = 2,
  color = BLACK,
  fill = PILL_BG,
  border = CARD_BORDER,
  dot = null,
  padX = 14,
  h = 38,
} = {}) {
  const dotW = dot ? 24 : 0;
  const pillW = padX * 2 + dotW + textPixelWidth(text, scale);
  fillRoundRect(pixels, width, x, y, pillW, h, 8, fill);
  strokeRect(pixels, width, x, y, pillW, h, border);
  let textX = x + padX;
  if (dot) {
    fillCircle(pixels, width, x + padX + 7, y + Math.round(h / 2), 7, dot);
    textX += dotW;
  }
  drawText(pixels, width, text, textX, y + Math.round((h - 7 * scale) / 2), scale, color);
  return pillW;
}

function answerKind(label = '') {
  const normalized = String(label || '').toLowerCase();
  if (/disagree|no|against|block|low|false|oppose|reject/.test(normalized)) return 'disagree';
  if (/unsure|maybe|neutral|mixed|unknown|abstain/.test(normalized)) return 'unsure';
  if (/agree|yes|for|support|high|true|approve/.test(normalized)) return 'agree';
  return 'unsure';
}

function answerCounts(answers = []) {
  const counts = { agree: 0, unsure: 0, disagree: 0 };
  for (const answer of answers || []) {
    const label = typeof answer === 'string' ? answer : answer?.label;
    counts[answerKind(label)] += 1;
  }
  return { ...counts, total: counts.agree + counts.unsure + counts.disagree };
}

function wrapText(value = '', maxChars = 52) {
  const words = normalizeText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    if (!line) {
      line = word;
    } else if ((line.length + word.length + 1) <= maxChars) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function hashText(value = '') {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function answerPosition(label = '') {
  const normalized = String(label || '').toLowerCase();
  if (/disagree|no|against|block|low|0|1|2|3/.test(normalized)) return 0.12;
  if (/unsure|maybe|neutral|mixed|unknown|4|5|6/.test(normalized)) return 0.5;
  if (/agree|yes|for|support|high|7|8|9|10/.test(normalized)) return 0.88;
  return 0.22 + ((hashText(normalized) % 560) / 1000);
}

function demoBeeswarmRows() {
  return [
    { label: 'Q1', prompt: 'Office pets', answers: ['Agree', 'Agree', 'Agree', 'Unsure', 'Disagree', 'Disagree', 'Agree', 'Unsure'] },
    { label: 'Q2', prompt: 'Launch risk', answers: ['Disagree', 'Disagree', 'Unsure', 'Agree', 'Unsure', 'Disagree', 'Agree'] },
    { label: 'Q3', prompt: 'Explain uncertainty', answers: ['Agree', 'Agree', 'Agree', 'Agree', 'Unsure', 'Agree'] },
  ];
}

function demoParticipants() {
  return [
    { participant: 'P1', answers: [{ question: 'Q1', label: 'Agree' }, { question: 'Q2', label: 'Unsure' }, { question: 'Q3', label: 'Agree' }] },
    { participant: 'P2', answers: [{ question: 'Q1', label: 'Disagree' }, { question: 'Q2', label: 'Disagree' }, { question: 'Q3', label: 'Unsure' }] },
    { participant: 'P3', answers: [{ question: 'Q1', label: 'Agree' }, { question: 'Q2', label: 'Agree' }, { question: 'Q3', label: 'Agree' }] },
    { participant: 'P4', answers: [{ question: 'Q1', label: 'Unsure' }, { question: 'Q2', label: 'Disagree' }, { question: 'Q3', label: 'Agree' }] },
  ];
}

function drawResultsHeader(pixels, width, {
  title = 'Consensus',
  sessionTitle = '',
  responseCount = 0,
  demo = false,
} = {}) {
  drawText(pixels, width, title, 58, 50, 4, BLACK);
  const demoX = 58 + textPixelWidth(title, 4) + 30;
  const demoW = drawPill(pixels, width, demo ? 'DEMO DATA' : 'LIVE', demoX, 42, {
    dot: demo ? AGREE_GREEN : BLUE,
    color: SLATE,
  });
  drawPill(pixels, width, `${Number(responseCount || 0)} RESPONSES`, demoX + demoW + 22, 42, {
    fill: PILL_BG,
    color: SLATE,
  });
  const session = sessionTitle || 'SESSION';
  const sessionLabel = session.length > 16 ? `${session.slice(0, 13)}...` : session;
  const sessionW = textPixelWidth(sessionLabel, 2) + 34;
  drawPill(pixels, width, sessionLabel, WIDTH - 58 - sessionW, 42, {
    fill: PILL_BG,
    color: SLATE,
    padX: 14,
  });
  drawLine(pixels, width, 40, 112, WIDTH - 40, 112, CARD_BORDER);
}

function drawLegend(pixels, width, x, y) {
  fillCircle(pixels, width, x, y + 8, 7, AGREE_GREEN);
  drawText(pixels, width, 'AGREE', x + 18, y, 2, SLATE);
  fillCircle(pixels, width, x + 138, y + 8, 7, UNSURE_YELLOW);
  drawText(pixels, width, 'UNSURE', x + 156, y, 2, SLATE);
  fillCircle(pixels, width, x + 294, y + 8, 7, DISAGREE_RED);
  drawText(pixels, width, 'DISAGREE', x + 312, y, 2, SLATE);
}

function drawDistributionBar(pixels, width, x, y, w, h, counts = {}) {
  const total = Math.max(1, counts.total || counts.agree + counts.unsure + counts.disagree || 0);
  const agreeW = Math.round((counts.agree / total) * w);
  const unsureW = Math.round((counts.unsure / total) * w);
  const disagreeW = Math.max(0, w - agreeW - unsureW);
  fillRoundRect(pixels, width, x, y, w, h, 7, GRID);
  if (agreeW > 0) fillRect(pixels, width, x, y, agreeW, h, AGREE_GREEN);
  if (unsureW > 0) fillRect(pixels, width, x + agreeW, y, unsureW, h, UNSURE_YELLOW);
  if (disagreeW > 0) fillRect(pixels, width, x + agreeW + unsureW, y, disagreeW, h, DISAGREE_RED);
  strokeRect(pixels, width, x, y, w, h, WHITE);
  const segments = [
    { label: `${Math.round((counts.agree / total) * 100)}%`, x, w: agreeW, color: WHITE },
    { label: `${Math.round((counts.unsure / total) * 100)}%`, x: x + agreeW, w: unsureW, color: BLACK },
    { label: `${Math.round((counts.disagree / total) * 100)}%`, x: x + agreeW + unsureW, w: disagreeW, color: WHITE },
  ];
  for (const segment of segments) {
    if (segment.w < 58) continue;
    drawText(
      pixels,
      width,
      segment.label,
      segment.x + Math.round((segment.w - textPixelWidth(segment.label, 2)) / 2),
      y + Math.round((h - 14) / 2),
      2,
      segment.color
    );
  }
}

function drawBeeswarm(pixels, width, rows = []) {
  const sourceRows = Array.isArray(rows) && rows.length ? rows : demoBeeswarmRows();
  const tableX = 40;
  const headerY = 138;
  drawText(pixels, width, 'QUESTION', tableX + 22, headerY, 2, SLATE);
  drawText(pixels, width, 'RESPONSE DISTRIBUTION', tableX + 360, headerY, 2, SLATE);
  drawLine(pixels, width, tableX, 176, WIDTH - 40, 176, CARD_BORDER);

  sourceRows.slice(0, 3).forEach((row, index) => {
    const y = 202 + index * 136;
    const label = row.label || `Q${index + 1}`;
    const badgeFill = index === 0 ? SOFT_GREEN : index === 1 ? SOFT_BLUE : SOFT_YELLOW;
    const badgeText = index === 0 ? AGREE_GREEN : index === 1 ? BLUE : ORANGE;
    fillRoundRect(pixels, width, tableX + 8, y + 16, 58, 50, 8, badgeFill);
    strokeRect(pixels, width, tableX + 8, y + 16, 58, 50, CARD_BORDER);
    drawText(pixels, width, label, tableX + 20, y + 30, 3, badgeText);
    wrapText(row.prompt || '', 24).slice(0, 3).forEach((line, lineIndex) => {
      drawText(pixels, width, line, tableX + 88, y + 6 + lineIndex * 26, 2, BLACK);
    });
    const counts = answerCounts(row.answers || []);
    const barX = tableX + 360;
    drawDistributionBar(pixels, width, barX, y + 10, 610, 38, counts);
    const countY = y + 64;
    fillCircle(pixels, width, barX + 38, countY + 8, 7, AGREE_GREEN);
    drawText(pixels, width, String(counts.agree), barX + 58, countY, 2, BLACK);
    fillCircle(pixels, width, barX + 178, countY + 8, 7, UNSURE_YELLOW);
    drawText(pixels, width, String(counts.unsure), barX + 198, countY, 2, BLACK);
    fillCircle(pixels, width, barX + 318, countY + 8, 7, DISAGREE_RED);
    drawText(pixels, width, String(counts.disagree), barX + 338, countY, 2, BLACK);
    if (index < 2) drawLine(pixels, width, tableX, y + 112, WIDTH - 40, y + 112, CARD_BORDER);
  });
  drawLegend(pixels, width, 330, 650);
}

function groupForParticipant(participant = {}, groups = [], index = 0) {
  const alias = String(participant.participant || `P${index + 1}`);
  const groupIndex = groups.findIndex((group) => Array.isArray(group.aliases) && group.aliases.includes(alias));
  return groupIndex >= 0 ? groupIndex : index % Math.max(1, groups.length || 1);
}

function participantGraphLayout(participants = [], groups = [], centerX = 0, centerY = 0) {
  const groupCount = Math.max(1, groups.length || 2);
  const groupCenters = Array.from({ length: groupCount }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / groupCount;
    return {
      x: centerX + Math.round(Math.cos(angle) * 86),
      y: centerY + Math.round(Math.sin(angle) * 70),
    };
  });
  return participants.slice(0, 10).map((participant, index) => {
    const groupIndex = groupForParticipant(participant, groups, index);
    const answers = Array.isArray(participant.answers) ? participant.answers : [];
    const avg = answers.reduce((sum, answer) => sum + answerPosition(answer.label), 0) / Math.max(1, answers.length);
    const localAngle = (index * 2.35) + (avg * Math.PI);
    const localDistance = 18 + Math.round(avg * 34);
    return {
      participant,
      groupIndex,
      x: groupCenters[groupIndex % groupCenters.length].x + Math.round(Math.cos(localAngle) * localDistance),
      y: groupCenters[groupIndex % groupCenters.length].y + Math.round(Math.sin(localAngle) * localDistance),
    };
  });
}

function drawParticipantGroupLines(pixels, width, layout = []) {
  const byGroup = new Map();
  for (const point of layout) {
    if (!byGroup.has(point.groupIndex)) byGroup.set(point.groupIndex, []);
    byGroup.get(point.groupIndex).push(point);
  }
  for (const [groupIndex, points] of byGroup.entries()) {
    const color = GROUP_COLORS[groupIndex % GROUP_COLORS.length];
    if (points.length === 1) {
      strokeCircle(pixels, width, points[0].x, points[0].y, 22, color);
      continue;
    }
    const sorted = [...points].sort((left, right) => (
      Math.atan2(left.y, left.x) - Math.atan2(right.y, right.x)
    ));
    for (let index = 0; index < sorted.length; index += 1) {
      const current = sorted[index];
      const next = sorted[(index + 1) % sorted.length];
      if (sorted.length < 3 && index > 0) continue;
      drawLine(pixels, width, current.x, current.y, next.x, next.y, color);
    }
  }
}

function drawParticipantGraph(pixels, width, participants = [], groups = []) {
  const sourceParticipants = Array.isArray(participants) && participants.length ? participants : demoParticipants();
  const questions = Array.from(new Set(sourceParticipants.flatMap((participant) => (
    (participant.answers || []).map((answer) => answer.question).filter(Boolean)
  )))).slice(0, 5);
  const chartX = 58;
  const chartY = 130;
  const chartW = WIDTH - 116;
  const chartH = 410;
  const centerX = chartX + Math.round(chartW / 2);
  const centerY = chartY + Math.round(chartH / 2) - 8;
  const radius = 172;
  strokeCircle(pixels, width, centerX, centerY, radius, CARD_BORDER);
  strokeCircle(pixels, width, centerX, centerY, Math.round(radius / 2), CARD_BORDER);
  drawLine(pixels, width, centerX - radius - 30, centerY, centerX + radius + 30, centerY, CARD_BORDER);
  drawLine(pixels, width, centerX, centerY - radius - 20, centerX, centerY + radius + 20, CARD_BORDER);
  const layout = participantGraphLayout(sourceParticipants, groups, centerX, centerY);
  drawParticipantGroupLines(pixels, width, layout);
  layout.forEach((point, index) => {
    const participant = point.participant;
    const label = participant.participant || `P${index + 1}`;
    const color = GROUP_COLORS[point.groupIndex % GROUP_COLORS.length];
    fillCircle(pixels, width, point.x, point.y, 12, color);
    fillCircle(pixels, width, point.x, point.y, 4, WHITE);
    drawText(pixels, width, label, point.x + 15, point.y - 8, 2, BLACK);
  });
  questions.slice(0, 5).forEach((question, index) => {
    const angle = ((index / Math.max(1, questions.length)) * Math.PI * 2) - Math.PI / 2;
    const px = centerX + Math.round(Math.cos(angle) * (radius - 18));
    const py = centerY + Math.round(Math.sin(angle) * (radius - 18));
    fillCircle(pixels, width, px, py, 7, BLACK);
    drawText(pixels, width, question, px + 12, py - 8, 2, BLACK);
  });
  fillCircle(pixels, width, 76, 512, 7, GROUP_COLORS[0]);
  drawText(pixels, width, 'PARTICIPANTS', 96, 503, 2, SLATE);
  fillCircle(pixels, width, 252, 512, 7, BLACK);
  drawText(pixels, width, 'QUESTIONS', 272, 503, 2, SLATE);

  const summaryGroups = (Array.isArray(groups) && groups.length ? groups : [
    { label: 'Group 1', theme: 'similar answer pattern', aliases: ['P1', 'P3'] },
    { label: 'Group 2', theme: 'contrasting answer pattern', aliases: ['P2'] },
  ]).slice(0, 3);
  summaryGroups.forEach((group, index) => {
    const cardW = summaryGroups.length > 2 ? 300 : 430;
    const x = 58 + index * (cardW + 24);
    const y = 570;
    const color = GROUP_COLORS[index % GROUP_COLORS.length];
    fillRoundRect(pixels, width, x, y, cardW, 104, 10, WHITE);
    strokeRect(pixels, width, x, y, cardW, 104, CARD_BORDER);
    fillCircle(pixels, width, x + 24, y + 28, 10, color);
    drawText(pixels, width, group.label || `GROUP ${index + 1}`, x + 42, y + 18, 2, color);
    const aliases = Array.isArray(group.aliases) ? group.aliases.slice(0, 4).join(' ') : '';
    drawText(pixels, width, aliases || 'PARTICIPANTS', x + 24, y + 54, 2, BLACK);
    const sizeText = group.size ? `${group.size} PARTICIPANTS` : 'ANSWER PATTERN CLUSTER';
    wrapText(sizeText, 30).slice(0, 1).forEach((line) => {
      drawText(pixels, width, line, x + 24, y + 78, 2, SLATE);
    });
  });
}

function demoTopicMap() {
  return {
    availability: { available: true },
    counts: { responses: 24, topics: 4 },
    topics: [
      {
        label: 'Onboarding',
        x: 360,
        y: 210,
        r: 96,
        questionCount: 3,
        responseCount: 8,
        questions: [
          { label: 'Q1', x: 350, y: 154, r: 13, responseCount: 4 },
          { label: 'Q2', x: 416, y: 213, r: 12, responseCount: 3 },
          { label: 'Q3', x: 331, y: 261, r: 10, responseCount: 1 },
        ],
      },
      {
        label: 'Privacy',
        x: 205,
        y: 165,
        r: 82,
        questionCount: 2,
        responseCount: 6,
        questions: [
          { label: 'Q4', x: 188, y: 118, r: 12, responseCount: 3 },
          { label: 'Q5', x: 243, y: 190, r: 12, responseCount: 3 },
        ],
      },
      {
        label: 'Agent UX',
        x: 515,
        y: 165,
        r: 78,
        questionCount: 2,
        responseCount: 5,
        questions: [
          { label: 'Q6', x: 500, y: 120, r: 12, responseCount: 3 },
          { label: 'Q7', x: 553, y: 188, r: 10, responseCount: 2 },
        ],
      },
      {
        label: 'Results',
        x: 360,
        y: 325,
        r: 74,
        questionCount: 2,
        responseCount: 5,
        questions: [
          { label: 'Q8', x: 335, y: 283, r: 11, responseCount: 2 },
          { label: 'Q9', x: 399, y: 342, r: 12, responseCount: 3 },
        ],
      },
    ],
  };
}

function drawTopicCircle(pixels, width, topic = {}, index = 0) {
  const palette = TOPIC_COLORS[index % TOPIC_COLORS.length];
  const x = Math.round(Number(topic.x || 0));
  const y = Math.round(Number(topic.y || 0));
  const r = Math.max(30, Math.round(Number(topic.r || 60)));
  fillCircle(pixels, width, x, y, r, palette.fill);
  strokeCircle(pixels, width, x, y, r, palette.stroke);
  const label = String(topic.label || `Topic ${index + 1}`).slice(0, 18);
  const labelScale = label.length > 12 ? 2 : 3;
  drawText(
    pixels,
    width,
    label,
    x - Math.round(textPixelWidth(label, labelScale) / 2),
    y - 18,
    labelScale,
    BLACK
  );
  const countText = `${Number(topic.questionCount || 0)} Q / ${Number(topic.responseCount || 0)} R`;
  drawText(pixels, width, countText, x - Math.round(textPixelWidth(countText, 2) / 2), y + 12, 2, SLATE);
  (Array.isArray(topic.questions) ? topic.questions : []).slice(0, 6).forEach((question) => {
    const qx = Math.round(Number(question.x || x));
    const qy = Math.round(Number(question.y || y));
    const qr = Math.max(6, Math.round(Number(question.r || 9)));
    fillCircle(pixels, width, qx, qy, qr, WHITE);
    strokeCircle(pixels, width, qx, qy, qr, palette.stroke);
    const qLabel = String(question.label || '').slice(0, 3);
    if (qLabel) drawText(pixels, width, qLabel, qx - 11, qy - 7, 1, BLACK);
  });
}

function drawTopicMap(pixels, width, topicMap = {}) {
  const source = topicMap?.availability?.available ? topicMap : demoTopicMap();
  if (topicMap?.availability && topicMap.availability.available === false) {
    drawText(pixels, width, 'NOT ENOUGH DATA FOR TOPIC MAP', 80, 260, 3, BLACK);
    drawText(pixels, width, 'NEEDS ANSWERED QUESTIONS AND RESPONSES', 80, 304, 2, SLATE);
    return;
  }
  drawText(pixels, width, 'ANSWERED QUESTION TOPICS', 58, 140, 2, SLATE);
  const frameX = 58;
  const frameY = 172;
  const frameW = WIDTH - 116;
  const frameH = 430;
  fillRoundRect(pixels, width, frameX, frameY, frameW, frameH, 12, WHITE);
  strokeRect(pixels, width, frameX, frameY, frameW, frameH, CARD_BORDER);
  const sx = frameW / 720;
  const sy = frameH / 420;
  const scaledTopics = (Array.isArray(source.topics) ? source.topics : []).slice(0, 8).map((topic) => ({
    ...topic,
    x: frameX + Math.round(Number(topic.x || 0) * sx),
    y: frameY + Math.round(Number(topic.y || 0) * sy),
    r: Math.round(Number(topic.r || 60) * Math.min(sx, sy) * 0.88),
    questions: (Array.isArray(topic.questions) ? topic.questions : []).map((question) => ({
      ...question,
      x: frameX + Math.round(Number(question.x || topic.x || 0) * sx),
      y: frameY + Math.round(Number(question.y || topic.y || 0) * sy),
      r: Math.round(Number(question.r || 9) * Math.min(sx, sy)),
    })),
  }));
  scaledTopics.forEach((topic, index) => drawTopicCircle(pixels, width, topic, index));
}

function adler32(bytes) {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u32be(value) {
  return new Uint8Array([
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ]);
}

function chunk(type, data = new Uint8Array()) {
  const typeBytes = new TextEncoder().encode(type);
  const out = new Uint8Array(12 + data.length);
  out.set(u32be(data.length), 0);
  out.set(typeBytes, 4);
  out.set(data, 8);
  out.set(u32be(crc32(concat([typeBytes, data]))), 8 + data.length);
  return out;
}

function zlibStore(bytes) {
  const blocks = [];
  for (let offset = 0; offset < bytes.length; offset += 65535) {
    const block = bytes.subarray(offset, Math.min(bytes.length, offset + 65535));
    const final = offset + block.length >= bytes.length ? 1 : 0;
    const header = new Uint8Array(5);
    header[0] = final;
    header[1] = block.length & 255;
    header[2] = (block.length >>> 8) & 255;
    const nlen = (~block.length) & 0xffff;
    header[3] = nlen & 255;
    header[4] = (nlen >>> 8) & 255;
    blocks.push(header, block);
  }
  const checksum = adler32(bytes);
  const total = 2 + blocks.reduce((sum, block) => sum + block.length, 0) + 4;
  const out = new Uint8Array(total);
  out.set([0x78, 0x01], 0);
  let cursor = 2;
  blocks.forEach((block) => {
    out.set(block, cursor);
    cursor += block.length;
  });
  out.set(u32be(checksum), cursor);
  return out;
}

function concat(parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  parts.forEach((part) => {
    out.set(part, cursor);
    cursor += part.length;
  });
  return out;
}

function encodePng(rgba, width, height) {
  const indexed = encodeIndexedPng(rgba, width, height);
  if (indexed) return indexed;

  const stride = width * 4;
  const scanlines = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const lineOffset = y * (stride + 1);
    scanlines[lineOffset] = 0;
    scanlines.set(rgba.subarray(y * stride, y * stride + stride), lineOffset + 1);
  }
  const ihdr = new Uint8Array(13);
  ihdr.set(u32be(width), 0);
  ihdr.set(u32be(height), 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return concat([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibStore(scanlines)),
    chunk('IEND'),
  ]);
}

function encodeIndexedPng(rgba, width, height) {
  const pixelCount = width * height;
  const palette = [];
  const paletteIndex = new Map();
  const indexed = new Uint8Array(pixelCount);

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4;
    if (rgba[offset + 3] !== 255) return null;
    const key = (rgba[offset] << 16) | (rgba[offset + 1] << 8) | rgba[offset + 2];
    let index = paletteIndex.get(key);
    if (index === undefined) {
      if (palette.length >= 256) return null;
      index = palette.length;
      palette.push([rgba[offset], rgba[offset + 1], rgba[offset + 2]]);
      paletteIndex.set(key, index);
    }
    indexed[pixel] = index;
  }

  const scanlines = new Uint8Array((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const lineOffset = y * (width + 1);
    scanlines[lineOffset] = 0;
    scanlines.set(indexed.subarray(y * width, (y + 1) * width), lineOffset + 1);
  }

  const paletteBytes = new Uint8Array(palette.length * 3);
  palette.forEach((color, index) => {
    paletteBytes[index * 3] = color[0];
    paletteBytes[index * 3 + 1] = color[1];
    paletteBytes[index * 3 + 2] = color[2];
  });

  const ihdr = new Uint8Array(13);
  ihdr.set(u32be(width), 0);
  ihdr.set(u32be(height), 4);
  ihdr[8] = 8;
  ihdr[9] = 3;
  return concat([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('PLTE', paletteBytes),
    chunk('IDAT', zlibStore(scanlines)),
    chunk('IEND'),
  ]);
}

export function buildResultsImage({
  mode = 'consensus',
  title = '',
  sessionTitle = '',
  responseCount = 0,
  demo = false,
  lines = [],
  beeswarmRows = [],
  participants = [],
  groups = [],
  topicMap = null,
} = {}) {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
  fillRect(pixels, WIDTH, 0, 0, WIDTH, HEIGHT, LIGHT_BG);
  fillRoundRect(pixels, WIDTH, 18, 18, WIDTH - 36, HEIGHT - 36, 14, WHITE);
  strokeRect(pixels, WIDTH, 18, 18, WIDTH - 36, HEIGHT - 36, CARD_BORDER);
  drawResultsHeader(pixels, WIDTH, {
    title: title || (mode === 'group' ? 'PARTICIPANTS' : (mode === 'topic-map' ? 'TOPIC MAP' : 'CONSENSUS')),
    sessionTitle,
    responseCount,
    demo,
  });

  if (mode === 'group') {
    drawParticipantGraph(pixels, WIDTH, participants, groups);
  } else if (mode === 'topic-map') {
    drawTopicMap(pixels, WIDTH, topicMap || {});
  } else {
    drawBeeswarm(pixels, WIDTH, beeswarmRows);
  }
  void lines;

  return {
    bytes: encodePng(pixels, WIDTH, HEIGHT),
    filename: `context-engine-${mode === 'group' ? 'group' : (mode === 'topic-map' ? 'topic-map' : 'consensus')}-results.png`,
    contentType: 'image/png',
  };
}
