const WIDTH = 1080;
const HEIGHT = 720;
const BG = [20, 24, 58, 255];
const PANEL = [38, 43, 96, 255];
const TEXT = [248, 250, 255, 255];
const MUTED = [166, 174, 210, 255];
const ACCENT = [98, 255, 191, 255];
const LINE = [78, 85, 150, 255];
const BLUE = [44, 195, 255, 255];
const YELLOW = [255, 225, 108, 255];
const RED = [255, 138, 122, 255];
const GREEN = [129, 199, 132, 255];
const SOFT = [30, 35, 82, 255];
const WHITE = [255, 255, 255, 255];
const BLACK = [20, 24, 35, 255];
const GRID = [220, 224, 235, 255];
const SLATE = [86, 96, 118, 255];
const STEEL = [70, 130, 180, 255];
const ORANGE = [255, 153, 0, 255];
const PURPLE = [148, 103, 189, 255];

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

function answerColor(label = '') {
  const normalized = String(label || '').toLowerCase();
  if (/disagree|no|against|block|low/.test(normalized)) return RED;
  if (/unsure|maybe|neutral|mixed|unknown/.test(normalized)) return YELLOW;
  if (/agree|yes|for|support|high/.test(normalized)) return GREEN;
  return BLUE;
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

function drawBeeswarm(pixels, width, rows = []) {
  const sourceRows = Array.isArray(rows) && rows.length ? rows : demoBeeswarmRows();
  const chartX = 82;
  const chartY = 214;
  const chartW = WIDTH - 164;
  const chartH = 394;
  const axisY = chartY + chartH - 54;
  const left = chartX + 52;
  const right = chartX + chartW - 52;
  fillRect(pixels, width, chartX, chartY, chartW, chartH, WHITE);
  strokeRect(pixels, width, chartX, chartY, chartW, chartH, GRID);
  drawText(pixels, width, 'COMMUNITY QUESTION BEESWARM', chartX + 24, chartY + 20, 3, BLACK);
  drawLine(pixels, width, left, axisY, right, axisY, GRID);
  drawText(pixels, width, 'CONSENSUS', left, axisY + 18, 2, SLATE);
  drawText(pixels, width, 'DIFFERENCE', right - 108, axisY + 18, 2, SLATE);
  const points = sourceRows.slice(0, 9).map((row, index) => {
    const answers = Array.isArray(row.answers) ? row.answers : [];
    const agree = answers.filter((answer) => /agree|yes|support|high/i.test(typeof answer === 'string' ? answer : answer?.label)).length;
    const disagree = answers.filter((answer) => /disagree|no|against|low/i.test(typeof answer === 'string' ? answer : answer?.label)).length;
    const unsure = Math.max(0, answers.length - agree - disagree);
    const total = Math.max(1, answers.length);
    const extremity = Math.min(1, Math.abs(agree - disagree) / total);
    return {
      row,
      agree,
      disagree,
      unsure,
      total,
      x: left + Math.round((right - left) * extremity),
      y: chartY + 92 + ((index * 47) % 210),
      label: row.label || `Q${index + 1}`,
    };
  });
  points.forEach((point, index) => {
    const active = index === 0;
    fillCircle(pixels, width, point.x, point.y, active ? 13 : 10, active ? ORANGE : STEEL);
    fillCircle(pixels, width, point.x, point.y, 4, WHITE);
    drawText(pixels, width, point.label, point.x + 15, point.y - 9, 2, BLACK);
    const barX = Math.min(right - 120, point.x + 15);
    const barY = point.y + 13;
    const barW = 96;
    const agreeW = Math.round((point.agree / point.total) * barW);
    const unsureW = Math.round((point.unsure / point.total) * barW);
    fillRect(pixels, width, barX, barY, barW, 5, GRID);
    fillRect(pixels, width, barX, barY, agreeW, 5, GREEN);
    fillRect(pixels, width, barX + agreeW, barY, unsureW, 5, YELLOW);
    fillRect(pixels, width, barX + agreeW + unsureW, barY, Math.max(0, barW - agreeW - unsureW), 5, RED);
  });
  points.slice(0, 3).forEach((point, index) => {
    const label = wrapText(`${point.label}: ${point.row.prompt || ''}`, 52)[0];
    drawText(pixels, width, label, chartX + 24, chartY + 286 + index * 26, 2, BLACK);
  });
}

function drawParticipantGraph(pixels, width, participants = []) {
  const sourceParticipants = Array.isArray(participants) && participants.length ? participants : demoParticipants();
  const questions = Array.from(new Set(sourceParticipants.flatMap((participant) => (
    (participant.answers || []).map((answer) => answer.question).filter(Boolean)
  )))).slice(0, 5);
  const chartX = 82;
  const chartY = 214;
  const chartW = WIDTH - 164;
  const chartH = 394;
  const centerX = chartX + Math.round(chartW / 2);
  const centerY = chartY + Math.round(chartH / 2) + 10;
  const radius = 150;
  fillRect(pixels, width, chartX, chartY, chartW, chartH, WHITE);
  strokeRect(pixels, width, chartX, chartY, chartW, chartH, GRID);
  drawText(pixels, width, 'PARTICIPANTS GRAPH', chartX + 24, chartY + 20, 3, BLACK);
  strokeCircle(pixels, width, centerX, centerY, radius, GRID);
  strokeCircle(pixels, width, centerX, centerY, Math.round(radius / 2), GRID);
  drawLine(pixels, width, centerX - radius - 32, centerY, centerX + radius + 32, centerY, GRID);
  drawLine(pixels, width, centerX, centerY - radius - 24, centerX, centerY + radius + 24, GRID);
  const colors = [STEEL, ORANGE, GREEN, PURPLE, RED];
  sourceParticipants.slice(0, 8).forEach((participant, index) => {
    const answers = Array.isArray(participant.answers) ? participant.answers : [];
    const avg = answers.reduce((sum, answer) => sum + answerPosition(answer.label), 0) / Math.max(1, answers.length);
    const angle = ((index / Math.max(1, sourceParticipants.length)) * Math.PI * 2) + (avg * Math.PI);
    const distance = 42 + Math.round(avg * 104);
    const px = centerX + Math.round(Math.cos(angle) * distance);
    const py = centerY + Math.round(Math.sin(angle) * distance);
    const label = participant.participant || `P${index + 1}`;
    fillCircle(pixels, width, px, py, 9, colors[index % colors.length]);
    drawText(pixels, width, label, px + 12, py - 8, 2, BLACK);
  });
  questions.slice(0, 5).forEach((question, index) => {
    const angle = ((index / Math.max(1, questions.length)) * Math.PI * 2) - Math.PI / 2;
    const px = centerX + Math.round(Math.cos(angle) * (radius - 18));
    const py = centerY + Math.round(Math.sin(angle) * (radius - 18));
    fillCircle(pixels, width, px, py, 5, BLACK);
    drawText(pixels, width, question, px + 9, py - 7, 2, BLACK);
  });
  drawText(pixels, width, 'COLORED POINTS = PARTICIPANTS', chartX + 24, chartY + 318, 2, BLACK);
  drawText(pixels, width, 'BLACK POINTS = QUESTIONS', chartX + 24, chartY + 344, 2, BLACK);
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

export function buildResultsImage({
  mode = 'consensus',
  sessionTitle = '',
  responseCount = 0,
  demo = false,
  lines = [],
  beeswarmRows = [],
  participants = [],
} = {}) {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
  fillRect(pixels, WIDTH, 0, 0, WIDTH, HEIGHT, BG);
  fillRect(pixels, WIDTH, 34, 34, WIDTH - 68, HEIGHT - 68, PANEL);
  strokeRect(pixels, WIDTH, 34, 34, WIDTH - 68, HEIGHT - 68, LINE);
  fillRect(pixels, WIDTH, 34, 34, 10, HEIGHT - 68, ACCENT);

  drawText(pixels, WIDTH, mode === 'group' ? 'PARTICIPANT RESULTS' : 'BEESWARM RESULTS', 72, 72, 5, TEXT);
  drawText(pixels, WIDTH, sessionTitle || 'SESSION RESULTS', 74, 126, 3, MUTED);
  drawText(
    pixels,
    WIDTH,
    `${demo ? 'DEMO' : 'LIVE'} / RESPONSES ${Number(responseCount || 0)}`,
    74,
    164,
    3,
    demo ? [255, 225, 108, 255] : ACCENT
  );

  if (mode === 'group') {
    drawParticipantGraph(pixels, WIDTH, participants);
  } else {
    drawBeeswarm(pixels, WIDTH, beeswarmRows);
  }

  const captionLines = lines
    .slice(0, 3)
    .flatMap((line) => wrapText(line, 44))
    .slice(0, 3);
  captionLines.forEach((line, index) => {
    drawText(pixels, WIDTH, line, 74, 628 + index * 24, 2, index === 0 ? TEXT : MUTED);
  });

  return {
    bytes: encodePng(pixels, WIDTH, HEIGHT),
    filename: `context-engine-${mode === 'group' ? 'group' : 'consensus'}-results.png`,
    contentType: 'image/png',
  };
}
