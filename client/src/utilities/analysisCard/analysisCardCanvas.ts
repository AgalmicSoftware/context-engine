// Draws the two pages of a personal analysis card on a canvas, so the page can show them and save them as a
// picture, a GIF or a video without a server. Page 1: the picture, a description of the person, the matched
// figure and three guesses. Page 2: one answer of each kind. Every word is drawn here as text; the picture is
// only ever an illustration of the figure.
import { ANALYSIS_CARD_TASTES, type AnalysisCard, type AnalysisCardTaste } from './analysisCardModel';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

// The site's own faces come first, so a card is drawn alike on every device: Barlow Condensed for headlines and
// Poppins for everything else. The rest are fallbacks for text those faces have no letters for.
const DISPLAY = '"Barlow Condensed", "Avenir Next Condensed", "Arial Narrow", Poppins, sans-serif';
const BODY = 'Poppins, "Avenir Next", "Helvetica Neue", Arial, sans-serif';
const MARGIN = 72;
const INNER = CARD_WIDTH - 2 * MARGIN;
const MIN_FIT = 0.66;
// The portrait on page 1 sits to the right of the note about the figure: how wide it is drawn, how much of the
// page's width it keeps clear of words, and the least height it is given.
const PORTRAIT_WIDTH = 640;
const PORTRAIT_CLEAR = 450;
const PORTRAIT_MIN_HEIGHT = 600;
// How much of the portrait shows, from the heart of its oval (0) to the oval's rim (1).
const PORTRAIT_OVAL_STOPS: ReadonlyArray<[number, number]> = [
  [0, 1],
  [0.5, 1],
  [0.68, 0.8],
  [0.84, 0.32],
  [0.94, 0.07],
  [1, 0],
];
// The site's own colours for these answers (binary-choice-*-bg in the themes), the same on every card.
const STANCE_COLOURS = new Map<string, [string, string]>([
  ['agree', ['#2e7d32', '#ffffff']],
  ['unsure', ['#ffeb3b', '#000000']],
  ['disagree', ['#c62828', '#ffffff']],
]);

type Rgb = [number, number, number];
export type AnalysisCardTheme = {
  ground: string;
  ink: string;
  accent: string;
  soft: string;
  chip: string;
  panel: string;
};
type Drawable = CanvasImageSource & { width: number; height: number };
export type AnalysisCardPicture = { image: Drawable; accentHex: string };
// The site's mark, drawn beside the account at the foot of each page. Any single-colour picture with a clear
// background works: it is recoloured to the card's ink.
export type AnalysisCardMark = Drawable;
type Measure = (text: string) => number;
type Style = { weight: number; size: number; family: string; spacing?: number; upper?: boolean };
type Row = { gap: number; height: number; paint: (top: number) => void };
type Ctx = CanvasRenderingContext2D;

/* ---------- colour ---------- */

const rgb = (value: unknown): Rgb | null => {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(value || '').trim());
  return match ? ([0, 2, 4].map((index) => parseInt(match[1].slice(index, index + 2), 16)) as Rgb) : null;
};
const hex = (colour: Rgb): string =>
  `#${colour
    .map((value) =>
      Math.round(Math.max(0, Math.min(255, value)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
const luminance = (colour: Rgb): number => {
  const [r, g, b] = colour.map((value) => {
    const unit = value / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: Rgb, b: Rgb): number => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};
const mix = (a: Rgb, b: Rgb, share: number): Rgb => a.map((value, index) => value + (b[index] - value) * share) as Rgb;
// Moves a colour toward the ink until it reads against the ground.
const toward = (colour: Rgb, target: Rgb, ground: Rgb, need: number): Rgb => {
  let result = colour;
  for (let share = 0.1; contrast(result, ground) < need && share <= 1; share += 0.1)
    result = mix(colour, target, share);
  return result;
};

// The page continues the colour the picture settles into; ink, accent and quiet text are checked against it.
export const resolveAnalysisCardTheme = (groundHex?: string | null, accentHex?: string | null): AnalysisCardTheme => {
  const ground = rgb(groundHex) || (rgb('#173e4b') as Rgb);
  const ink = (luminance(ground) < 0.3 ? rgb('#f6ecd8') : rgb('#1c1a17')) as Rgb;
  const accent = toward(rgb(accentHex) || (rgb('#f15a2c') as Rgb), ink, ground, 5.5);
  const soft = toward(mix(ink, ground, 0.26), ink, ground, 6);
  const chip = [ground, ink, [17, 17, 17] as Rgb, [255, 255, 255] as Rgb].sort(
    (a, b) => contrast(b, accent) - contrast(a, accent),
  )[0];
  return {
    ground: hex(ground),
    ink: hex(ink),
    accent: hex(accent),
    soft: hex(soft),
    chip: hex(chip),
    panel: `rgba(${ink.join(', ')}, 0.09)`,
  };
};

const sampleGround = (picture: AnalysisCardPicture): string | null => {
  try {
    const probe = document.createElement('canvas');
    probe.width = 4;
    probe.height = 1;
    const context = probe.getContext('2d');
    if (!context) return null;
    const { image } = picture;
    context.drawImage(image, 0, image.height * 0.92, image.width, image.height * 0.055, 0, 0, 4, 1);
    const { data } = context.getImageData(0, 0, 4, 1);
    const mean = [0, 1, 2].map(
      (channel) => (data[channel] + data[4 + channel] + data[8 + channel] + data[12 + channel]) / 4,
    );
    return hex(mean as Rgb);
  } catch {
    return null;
  }
};

/* ---------- text ---------- */

// Wraps on spaces. A word wider than the line (a long address, or text in a script written without spaces) is
// broken by characters, so nothing runs off the card.
export const wrapLines = (measure: Measure, text: string, maxWidth: number): string[] => {
  const lines: string[] = [];
  let line = '';
  const place = (word: string): void => {
    const next = line ? `${line} ${word}` : word;
    if (measure(next) <= maxWidth) {
      line = next;
      return;
    }
    if (line) {
      lines.push(line);
      line = '';
    }
    if (measure(word) <= maxWidth) {
      line = word;
      return;
    }
    let part = '';
    [...word].forEach((char) => {
      if (part && measure(part + char) > maxWidth) {
        lines.push(part);
        part = '';
      }
      part += char;
    });
    line = part;
  };
  text.split(/\s+/).filter(Boolean).forEach(place);
  if (line) lines.push(line);
  return lines;
};

// The same number of lines as a plain wrap, with their lengths evened out.
export const balanceLines = (measure: Measure, text: string, maxWidth: number): string[] => {
  const plainWrap = wrapLines(measure, text, maxWidth);
  if (plainWrap.length < 2) return plainWrap;
  // Never narrower than the longest word that fits, or evening the lines out would start breaking words.
  const words = text.split(/\s+/).map(measure);
  let low = Math.max(0, ...words.filter((width) => width <= maxWidth));
  let high = maxWidth;
  if (wrapLines(measure, text, low).length <= plainWrap.length) return wrapLines(measure, text, low);
  for (let step = 0; step < 12; step += 1) {
    const middle = (low + high) / 2;
    if (wrapLines(measure, text, middle).length <= plainWrap.length) high = middle;
    else low = middle;
  }
  return wrapLines(measure, text, high);
};

export const clampLines = (measure: Measure, lines: string[], maxLines: number, maxWidth: number): string[] => {
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && measure(`${last}…`) > maxWidth) last = last.slice(0, -1).trimEnd();
  kept[maxLines - 1] = `${last.replace(/[\s.,;:!?]+$/, '')}…`;
  return kept;
};

// One line, cut short with an ellipsis when it is wider than the space.
export const fitLine = (measure: Measure, text: string, maxWidth: number): string =>
  measure(text) <= maxWidth ? text : clampLines(measure, [text, ''], 1, maxWidth)[0];

// A description of a few words is set very large; a longer one steps down so it stays about three lines.
export const titleStep = (title: string): { size: number; lead: number } => {
  const step = title.length > 48 ? 3 : title.length > 36 ? 2 : title.length > 24 ? 1 : 0;
  return { size: [168, 130, 112, 94][step], lead: [0.92, 0.94, 0.96, 0.98][step] };
};

const apply = (context: Ctx, style: Style): void => {
  context.font = `${style.weight} ${style.size}px ${style.family}`;
  // Ignored where the canvas has no letter spacing; measuring and drawing stay consistent either way.
  (context as Ctx & { letterSpacing: string }).letterSpacing = `${(style.spacing || 0) * style.size}px`;
};
const shown = (text: string, style: Style): string => (style.upper ? text.toUpperCase() : text);
const widthOf = (context: Ctx, text: string, style: Style): number => {
  apply(context, style);
  return context.measureText(shown(text, style)).width;
};
// Where the baseline sits in a line box of the given height, as a browser would place it.
const baseline = (context: Ctx, style: Style, lineHeight: number): number => {
  apply(context, style);
  const metrics = context.measureText('Hg');
  const ascent = metrics.fontBoundingBoxAscent || style.size * 0.8;
  const descent = metrics.fontBoundingBoxDescent || style.size * 0.2;
  return (lineHeight - (ascent + descent)) / 2 + ascent;
};

type TextBox = {
  x: number;
  width: number;
  lead: number;
  colour: string;
  gap?: number;
  balance?: boolean;
  maxLines?: number;
  right?: boolean;
};

const textRow = (context: Ctx, text: string, style: Style, box: TextBox): Row => {
  apply(context, style);
  const measure: Measure = (value) => context.measureText(value).width;
  let lines = (box.balance ? balanceLines : wrapLines)(measure, shown(text, style), box.width);
  if (box.maxLines) lines = clampLines(measure, lines, box.maxLines, box.width);
  const lineHeight = style.size * box.lead;
  return {
    gap: box.gap || 0,
    height: lines.length * lineHeight,
    paint: (top) => {
      const base = baseline(context, style, lineHeight);
      context.fillStyle = box.colour;
      context.textAlign = box.right ? 'right' : 'left';
      context.textBaseline = 'alphabetic';
      lines.forEach((line, index) =>
        context.fillText(line, box.right ? box.x + box.width : box.x, top + index * lineHeight + base),
      );
      context.textAlign = 'left';
    },
  };
};

const stackHeight = (rows: Row[]): number => rows.reduce((sum, row) => sum + row.gap + row.height, 0);
const paintStack = (rows: Row[], top: number): void => {
  let y = top;
  rows.forEach((row) => {
    y += row.gap;
    row.paint(y);
    y += row.height;
  });
};

const roundRect = (context: Ctx, x: number, y: number, width: number, height: number, radius: number): void => {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
};

const label = (
  context: Ctx,
  text: string,
  size: number,
  theme: AnalysisCardTheme,
  x: number,
  width: number,
  gap = 0,
): Row =>
  textRow(
    context,
    text,
    { weight: 800, size, family: BODY, spacing: 0.1, upper: true },
    { x, width, lead: 1.25, colour: theme.accent, gap },
  );

// The mark in the card's ink colour.
const inked = (mark: AnalysisCardMark, colour: string, size: number): CanvasImageSource => {
  const canvas = document.createElement('canvas');
  canvas.width = size * 2;
  canvas.height = size * 2;
  const context = canvas.getContext('2d');
  if (!context) return mark;
  context.drawImage(mark, 0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'source-in';
  context.fillStyle = colour;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
};

// The foot of each page. Left: the site's mark and the account the answers belong to. Right: the session's
// page as an address to type, set smaller when a long session name would not fit beside the account and cut
// short only as a last resort. The row keeps one height, so the pages do not shift with what it holds.
const footer = (
  context: Ctx,
  card: AnalysisCard,
  theme: AnalysisCardTheme,
  mark: AnalysisCardMark | null,
  gap = 0,
): Row => {
  const height = 38 * 1.25;
  const markSize = 44;
  const accountStyle: Style = { weight: 700, size: 34, family: BODY, spacing: 0.02 };
  const accountX = MARGIN + (mark ? markSize + 14 : 0);
  const room = card.account ? MARGIN + INNER - (accountX + widthOf(context, card.account, accountStyle) + 36) : INNER;
  const linkStyle: Style = { weight: 700, size: 38, family: BODY, spacing: 0.01 };
  const natural = widthOf(context, card.link, linkStyle);
  if (natural > room) linkStyle.size = Math.max(22, (38 * room) / natural);
  apply(context, linkStyle);
  const link = fitLine((value) => context.measureText(value).width, card.link, room);
  return {
    gap,
    height,
    paint: (top) => {
      context.textBaseline = 'alphabetic';
      context.fillStyle = theme.ink;
      if (card.account) {
        if (mark)
          context.drawImage(
            inked(mark, theme.ink, markSize),
            MARGIN,
            top + (height - markSize) / 2,
            markSize,
            markSize,
          );
        apply(context, accountStyle);
        context.fillText(card.account, accountX, top + baseline(context, accountStyle, height));
      }
      if (!link) return;
      const base = top + baseline(context, linkStyle, height);
      context.textAlign = 'right';
      context.fillText(link, MARGIN + INNER, base);
      context.textAlign = 'left';
    },
  };
};

/* ---------- page 1 ---------- */

const ICONS: Record<AnalysisCardTaste, (context: Ctx) => void> = {
  book: (context) => {
    context.lineJoin = 'round';
    context.stroke(new Path2D('M8 12c8-3 16-3 24 2v38c-8-5-16-5-24-2z M56 12c-8-3-16-3-24 2v38c8-5 16-5 24-2z'));
  },
  game: (context) => {
    roundRect(context, 9, 9, 46, 46, 10);
    context.stroke();
    [
      [22, 22],
      [42, 42],
      [32, 32],
      [42, 22],
      [22, 42],
    ].forEach(([x, y]) => {
      context.beginPath();
      context.arc(x, y, 4.5, 0, Math.PI * 2);
      context.fill();
    });
  },
  film: (context) => {
    roundRect(context, 7, 13, 50, 38, 5);
    context.stroke();
    context.fill(new Path2D('M27 23v18l15-9z'));
  },
  // Two joined notes.
  song: (context) => {
    [
      [19, 47],
      [45, 41],
    ].forEach(([x, y]) => {
      context.beginPath();
      context.ellipse(x, y, 8, 6, -0.35, 0, Math.PI * 2);
      context.fill();
    });
    context.lineJoin = 'round';
    context.stroke(new Path2D('M26 46V16l26-6v30'));
    context.fill(new Path2D('M26 14l26-6v9l-26 6z'));
  },
};

const nameRow = (context: Ctx, card: AnalysisCard, theme: AnalysisCardTheme, fit: number, width: number): Row => {
  const nameStyle: Style = { weight: 800, size: 78 * fit, family: DISPLAY, upper: true };
  const yearsStyle: Style = { weight: 600, size: 44 * fit, family: BODY, spacing: 0.02 };
  const lineHeight = nameStyle.size;
  apply(context, nameStyle);
  const lines = wrapLines((value) => context.measureText(value).width, shown(card.figureName, nameStyle), width);
  const lastWidth = widthOf(context, lines[lines.length - 1] || '', nameStyle);
  const yearsGap = yearsStyle.size * 0.25;
  const yearsBelow = !!card.years && lastWidth + yearsGap + widthOf(context, card.years, yearsStyle) > width;
  return {
    gap: 12,
    height: (lines.length + (yearsBelow ? 1 : 0)) * lineHeight,
    paint: (top) => {
      const base = baseline(context, nameStyle, lineHeight);
      context.textBaseline = 'alphabetic';
      context.fillStyle = theme.ink;
      apply(context, nameStyle);
      lines.forEach((line, index) => context.fillText(line, MARGIN, top + index * lineHeight + base));
      if (!card.years) return;
      apply(context, yearsStyle);
      context.fillStyle = theme.soft;
      const row = lines.length - 1 + (yearsBelow ? 1 : 0);
      context.fillText(card.years, yearsBelow ? MARGIN : MARGIN + lastWidth + yearsGap, top + row * lineHeight + base);
    },
  };
};

const pickRow = (
  context: Ctx,
  kind: AnalysisCardTaste,
  card: AnalysisCard,
  theme: AnalysisCardTheme,
  fit: number,
  gap: number,
): Row | null => {
  const pick = card.tastes[kind];
  if (!pick) return null;
  const pad = 11 * fit;
  const icon = 64 * fit;
  const textX = MARGIN + 26 + icon + 26;
  const textWidth = INNER - (textX - MARGIN) - 26;
  const kindStyle: Style = { weight: 800, size: 32 * fit, family: BODY, spacing: 0.1, upper: true };
  const byStyle: Style = { weight: 500, size: 40 * fit, family: BODY, spacing: 0.03 };
  const kindText = `${kind} guess`;
  const kindLine = byStyle.size * 1.2;
  const kindWidth = widthOf(context, kindText, kindStyle);
  apply(context, byStyle);
  const by = fitLine((value) => context.measureText(value).width, pick.by, textWidth - kindWidth - 16);
  const work = textRow(
    context,
    pick.title,
    { weight: 700, size: 50 * fit, family: BODY },
    { x: textX, width: textWidth, lead: 1.08, colour: theme.ink, maxLines: 2 },
  );
  const height = pad * 2 + kindLine + 2 + work.height;
  return {
    gap,
    height,
    paint: (top) => {
      roundRect(context, MARGIN, top, INNER, height, 22);
      context.fillStyle = theme.panel;
      context.fill();
      context.save();
      context.translate(MARGIN + 26, top + (height - icon) / 2);
      context.scale(icon / 64, icon / 64);
      context.strokeStyle = theme.accent;
      context.fillStyle = theme.accent;
      context.lineWidth = 4;
      ICONS[kind](context);
      context.restore();
      const base = top + pad + baseline(context, byStyle, kindLine);
      context.textBaseline = 'alphabetic';
      apply(context, kindStyle);
      context.fillStyle = theme.accent;
      context.fillText(shown(kindText, kindStyle), textX, base);
      if (pick.by) {
        apply(context, byStyle);
        context.fillStyle = theme.ink;
        context.globalAlpha = 0.78;
        context.fillText(by, textX + kindWidth + 16, base);
        context.globalAlpha = 1;
      }
      work.paint(top + pad + kindLine + 2);
    },
  };
};

// Page 1 reads from the top: the description of the person; then the matched figure, with the note about them in
// a column on the left and their portrait in the space on the right; then the guesses; then the foot.
type PageOne = { head: Row[]; match: Row[]; picks: Row[]; foot: Row };

const pageOne = (
  context: Ctx,
  card: AnalysisCard,
  theme: AnalysisCardTheme,
  mark: AnalysisCardMark | null,
  fit: number,
  pictured: boolean,
): PageOne => {
  const step = titleStep(card.title);
  const titleStyle: Style = { weight: 800, size: step.size * fit, family: DISPLAY, spacing: -0.01, upper: true };
  // A single word wider than the page narrows the title until it fits.
  const widest = Math.max(...card.title.split(/\s+/).map((word) => widthOf(context, word, titleStyle)));
  if (widest > INNER) titleStyle.size *= Math.max(0.5, INNER / widest);
  const column = pictured ? INNER - PORTRAIT_CLEAR : INNER;
  const match: Array<Row | null> = [
    label(context, 'Historical match', 36, theme, MARGIN, column),
    nameRow(context, card, theme, fit, column),
    card.matchNote
      ? textRow(
          context,
          card.matchNote,
          { weight: 500, size: 40 * fit, family: BODY },
          { x: MARGIN, width: column, lead: 1.28, colour: theme.ink, gap: 16, maxLines: 13 },
        )
      : null,
  ];
  return {
    head: [
      label(context, card.own ? 'AI analysis of my answers' : 'AI analysis of their answers', 36, theme, MARGIN, INNER),
      textRow(context, card.title, titleStyle, {
        x: MARGIN,
        width: INNER,
        lead: step.lead,
        colour: theme.ink,
        gap: 14,
        balance: true,
        maxLines: 4,
      }),
    ],
    match: match.filter(Boolean) as Row[],
    picks: ANALYSIS_CARD_TASTES.filter((kind) => card.tastes[kind]).map((kind, index) =>
      pickRow(context, kind, card, theme, fit, index ? 12 * fit : 0),
    ) as Row[],
    foot: footer(context, card, theme, mark),
  };
};

/**
 * The oval a portrait of this size is kept inside. The picture is whole at the oval's heart, where the head is,
 * and gone at its rim, which touches the picture's left and top edges and stops short of its foot. So whatever
 * the picture has behind the figure (a block of colour, a circle its own edges cut off) melts into the page's
 * ground with no straight edge. On the right the page's own edge ends the picture.
 */
export const portraitOval = (width: number, height: number): { cx: number; cy: number; rx: number; ry: number } => {
  const cx = width * 0.52;
  const cy = height * 0.46;
  return { cx, cy, rx: cx, ry: cy };
};

// The portrait inside its oval, so it sits in the page's ground with no frame.
const fadedPortrait = (picture: AnalysisCardPicture, height: number): CanvasImageSource | null => {
  const scale = PORTRAIT_WIDTH / picture.image.width;
  if (!(scale > 0)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = PORTRAIT_WIDTH;
  // Never taller than the picture itself, so the oval is never stretched past the picture's foot.
  canvas.height = Math.round(Math.min(height, picture.image.height * scale));
  const context = canvas.getContext('2d');
  if (!context || canvas.height < PORTRAIT_MIN_HEIGHT * MIN_FIT * 0.5) return null;
  context.drawImage(picture.image, 0, 0, picture.image.width, canvas.height / scale, 0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'destination-in';
  const { cx, cy, rx, ry } = portraitOval(canvas.width, canvas.height);
  // A circle of radius rx, squeezed to the oval's height.
  const squeeze = ry / rx;
  context.save();
  context.translate(cx, cy);
  context.scale(1, squeeze);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, rx);
  PORTRAIT_OVAL_STOPS.forEach(([at, shown]) => gradient.addColorStop(at, `rgba(0, 0, 0, ${shown})`));
  context.fillStyle = gradient;
  context.fillRect(-cx, -cy / squeeze, canvas.width, canvas.height / squeeze);
  context.restore();
  return canvas;
};

const drawPageOne = (
  context: Ctx,
  card: AnalysisCard,
  theme: AnalysisCardTheme,
  picture: AnalysisCardPicture | null,
  mark: AnalysisCardMark | null,
): void => {
  const top = 84;
  const bottom = CARD_HEIGHT - 46;
  const measure = (fit: number) => {
    const page = pageOne(context, card, theme, mark, fit, !!picture);
    const matchHeight = Math.max(stackHeight(page.match), picture ? PORTRAIT_MIN_HEIGHT * fit : 0);
    const gap = 40 * fit;
    const needed =
      stackHeight(page.head) + gap + matchHeight + gap + stackHeight(page.picks) + 26 * fit + page.foot.height;
    return { page, matchHeight, gap, needed };
  };
  let fit = 1;
  let layout = measure(fit);
  while (layout.needed > bottom - top && fit > MIN_FIT) {
    fit -= 0.02;
    layout = measure(fit);
  }
  const { page, matchHeight } = layout;
  // Room left over is shared by the two gaps around the figure.
  const gap = layout.gap + Math.max(0, bottom - top - layout.needed) / 2;
  const matchTop = top + stackHeight(page.head) + gap;

  context.fillStyle = theme.ground;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  if (picture) {
    const portrait = fadedPortrait(picture, matchHeight + gap * 0.9);
    // Drawn a little past the right edge, so the face sits clear of the note.
    if (portrait) context.drawImage(portrait, CARD_WIDTH - PORTRAIT_WIDTH + 76, matchTop - gap * 0.45);
  }
  paintStack(page.head, top);
  paintStack(page.match, matchTop);
  paintStack(page.picks, matchTop + matchHeight + gap);
  page.foot.paint(bottom - page.foot.height);
};

/* ---------- page 2 ---------- */

const boxed = (context: Ctx, theme: AnalysisCardTheme, fit: number, rows: Row[]): Row => {
  const pad = 38 * fit;
  const height = stackHeight(rows) + pad * 2;
  return {
    gap: 0,
    height,
    paint: (top) => {
      roundRect(context, MARGIN, top, INNER, height, 28);
      context.fillStyle = theme.panel;
      context.fill();
      paintStack(rows, top + pad);
    },
  };
};

// An answer chip; an answer too long for the box is cut short with an ellipsis rather than run past its edge.
const chipRow = (
  context: Ctx,
  answer: string,
  theme: AnalysisCardTheme,
  fit: number,
  x: number,
  width: number,
): Row => {
  const style: Style = { weight: 800, size: 80 * fit, family: DISPLAY, upper: true };
  const lineHeight = style.size * 1.1;
  const [fill, ink] = STANCE_COLOURS.get(answer.trim().toLowerCase()) || [theme.accent, theme.chip];
  const height = lineHeight + 14;
  const text = fitLine((value) => widthOf(context, value, style), answer, width - 64);
  return {
    gap: 24,
    height,
    paint: (top) => {
      roundRect(context, x, top, widthOf(context, text, style) + 64, height, 14);
      context.fillStyle = fill;
      context.fill();
      context.fillStyle = ink;
      context.textBaseline = 'alphabetic';
      context.fillText(shown(text, style), x + 32, top + 8 + baseline(context, style, lineHeight));
    },
  };
};

// `tight` halves how many lines each answer may take: used only when very long answers would not fit the page
// even at the smallest type.
const pageTwoBoxes = (
  context: Ctx,
  card: AnalysisCard,
  theme: AnalysisCardTheme,
  fit: number,
  tight: boolean,
): Row[] => {
  const lines = (count: number): number => (tight ? Math.ceil(count / 2) : count);
  const x = MARGIN + 42;
  const width = INNER - 84;
  // The page's sizes sit close together: an answer is the largest text, and the question it answers is small
  // beside it but still read at a glance, where a wide gap made the page look lopsided.
  const big: Style = { weight: 600, size: 62 * fit, family: BODY };
  const about = (text: string, gap: number): Row =>
    textRow(
      context,
      text,
      { weight: 400, size: 48 * fit, family: BODY },
      { x, width, lead: 1.26, colour: theme.soft, gap, maxLines: 2 },
    );
  const boxes: Row[] = [];
  const { yesNo, ownWords, vote } = card.answers;
  if (yesNo) {
    boxes.push(
      boxed(context, theme, fit, [
        textRow(context, yesNo.prompt, big, { x, width, lead: 1.14, colour: theme.ink, maxLines: lines(6) }),
        chipRow(context, yesNo.text, theme, fit, x, width),
      ]),
    );
  }
  if (ownWords) {
    boxes.push(
      boxed(context, theme, fit, [
        label(context, card.own ? 'In my words' : 'In their words', 42 * fit, theme, x, width),
        textRow(context, `“${ownWords.text}”`, big, {
          x,
          width,
          lead: 1.14,
          colour: theme.ink,
          gap: 16,
          maxLines: lines(ownWords.trimmed ? 8 : 6),
        }),
        about(`${ownWords.stance ? `${ownWords.stance}: ` : 'On: '}${ownWords.prompt}`, 14),
      ]),
    );
  }
  if (vote) {
    const whose = card.own ? ['I chose', 'Most of my votes went to'] : ['They chose', 'Most of their votes went to'];
    const item: Style = { weight: 700, size: 60 * fit, family: BODY };
    const items = vote.items.slice(0, 3).map((text, index): Row => {
      const row = textRow(context, text, item, {
        x: x + 44,
        width: width - 44,
        lead: 1.1,
        colour: theme.ink,
        gap: index ? 12 : 16,
        balance: true,
        maxLines: lines(3),
      });
      return {
        ...row,
        paint: (top) => {
          roundRect(context, x, top + item.size * 0.28, 22, 22, 4);
          context.fillStyle = theme.accent;
          context.fill();
          row.paint(top);
        },
      };
    });
    if (vote.items.length > 3) {
      items.push(
        textRow(
          context,
          `+ ${vote.items.length - 3} more`,
          { weight: 500, size: 48 * fit, family: BODY },
          { x: x + 44, width: width - 44, lead: 1.1, colour: theme.soft, gap: 12 },
        ),
      );
    }
    boxes.push(
      boxed(context, theme, fit, [
        label(context, whose[vote.kind === 'votes' ? 1 : 0], 42 * fit, theme, x, width),
        about(vote.prompt, 14),
        ...items,
      ]),
    );
  }
  return boxes;
};

const drawPageTwo = (
  context: Ctx,
  card: AnalysisCard,
  theme: AnalysisCardTheme,
  mark: AnalysisCardMark | null,
): void => {
  context.fillStyle = theme.ground;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  const head = textRow(
    context,
    card.own ? 'In my answers' : 'In their answers',
    { weight: 800, size: 116, family: DISPLAY, spacing: -0.01, upper: true },
    { x: MARGIN, width: INNER, lead: 0.98, colour: theme.ink, balance: true },
  );
  head.paint(84);
  const ruleTop = 84 + head.height + 34;
  context.fillStyle = theme.accent;
  context.fillRect(MARGIN, ruleTop, INNER, 6);
  const foot = footer(context, card, theme, mark);
  const footTop = CARD_HEIGHT - 50 - foot.height;
  foot.paint(footTop);

  // The answers share the space between the rule and the footer, shrinking a step at a time until they fit.
  const top = ruleTop + 6;
  const needed = (boxes: Row[], fit: number): number =>
    boxes.reduce((sum, box) => sum + box.height, 0) + Math.max(0, boxes.length - 1) * 26 * fit + 60 * fit;
  let fit = 1;
  let tight = false;
  let boxes = pageTwoBoxes(context, card, theme, fit, tight);
  while (needed(boxes, fit) > footTop - top && (fit > MIN_FIT || !tight)) {
    // At the smallest type, start again with fewer lines an answer.
    if (fit > MIN_FIT) fit -= 0.02;
    else [fit, tight] = [1, true];
    boxes = pageTwoBoxes(context, card, theme, fit, tight);
  }
  const spare = Math.max(0, footTop - top - needed(boxes, fit)) / (boxes.length + 1);
  let y = top + 30 * fit + spare;
  boxes.forEach((box) => {
    box.paint(y);
    y += box.height + 26 * fit + spare;
  });
};

/* ---------- pages ---------- */

export type AnalysisCardPages = { page1: HTMLCanvasElement; page2: HTMLCanvasElement; theme: AnalysisCardTheme };

// The fonts the card is drawn with must be loaded before a canvas can use them. A font split by script loads only
// the parts the text asks for, so the card's own text is named, as written and in capitals (labels and chips are
// set in capitals, and a capital can sit in another part than its small letter).
export const loadAnalysisCardFonts = async (card?: AnalysisCard): Promise<void> => {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  const words = card ? JSON.stringify(card) : '';
  const text = `${words}${words.toUpperCase()}` || undefined;
  const faces = [`800 40px ${DISPLAY}`, ...[400, 500, 600, 700, 800].map((weight) => `${weight} 40px ${BODY}`)];
  await Promise.all(faces.map((face) => document.fonts.load(face, text).catch(() => []))).catch(() => undefined);
};

// Draws both pages at full size. Returns null where the browser gives no canvas to draw on.
export const drawAnalysisCardPages = (
  card: AnalysisCard,
  picture: AnalysisCardPicture | null,
  mark: AnalysisCardMark | null = null,
): AnalysisCardPages | null => {
  const page = (): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    return canvas;
  };
  const page1 = page();
  const page2 = page();
  const first = page1.getContext('2d');
  const second = page2.getContext('2d');
  if (!first || !second) return null;
  const theme = resolveAnalysisCardTheme(picture ? sampleGround(picture) : null, picture?.accentHex);
  drawPageOne(first, card, theme, picture, mark);
  drawPageTwo(second, card, theme, mark);
  return { page1, page2, theme };
};
