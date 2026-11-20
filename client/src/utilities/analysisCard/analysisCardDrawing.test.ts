import {
  CARD_HEIGHT,
  CARD_WIDTH,
  drawAnalysisCardPages,
  loadAnalysisCardFonts,
  portraitOval,
} from './analysisCardCanvas';
import { normalizeAnalysisCard, type AnalysisCard } from './analysisCardModel';

// A stand-in for a canvas that measures every character as half its type size and records what is drawn, so
// the real layout code runs and its result can be checked without a browser.
type Drawn = { text: string; x: number; y: number; width: number; size: number; align: string };
class FakeContext {
  font = '';
  textAlign = 'left';
  fillStyle: unknown = '';
  texts: Drawn[] = [];
  images: Array<{ source: unknown; x: number; height: number }> = [];
  globalCompositeOperation = 'source-over';
  private size(): number {
    return Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] || 0);
  }
  measureText(text: string) {
    const size = this.size();
    return {
      width: [...text].length * size * 0.5,
      fontBoundingBoxAscent: size * 0.8,
      fontBoundingBoxDescent: size * 0.2,
    };
  }
  fillText(text: string, x: number, y: number) {
    this.texts.push({ text, x, y, width: this.measureText(text).width, size: this.size(), align: this.textAlign });
  }
  drawImage(source: unknown, ...rest: number[]) {
    this.images.push({
      source,
      x: rest.length === 8 ? rest[4] : rest[0],
      height: rest.length === 8 ? rest[7] : rest[3],
    });
  }
  getImageData() {
    return { data: Array.from({ length: 16 }, (_, index) => (index % 4 === 3 ? 255 : 220)) };
  }
  // Each oval mask: its radius, how far it is squeezed, and its stops.
  ovals: Array<{ radius: number; squeeze: number; stops: Array<[number, string]> }> = [];
  private squeeze = 1;
  scale(_x: number, y: number) {
    this.squeeze = y;
  }
  createRadialGradient(...circle: number[]) {
    const stops: Array<[number, string]> = [];
    this.ovals.push({ radius: circle[5], squeeze: this.squeeze, stops });
    return { addColorStop: (at: number, colour: string) => stops.push([at, colour]) };
  }
}
[
  'fillRect',
  'beginPath',
  'moveTo',
  'arcTo',
  'closePath',
  'fill',
  'stroke',
  'save',
  'restore',
  'translate',
  'arc',
  'ellipse',
].forEach((method) => {
  (FakeContext.prototype as unknown as Record<string, unknown>)[method] = () => undefined;
});

const contexts = new Map<HTMLCanvasElement, FakeContext>();
const contextOf = (canvas: HTMLCanvasElement): FakeContext => contexts.get(canvas) as FakeContext;

const full: AnalysisCard = normalizeAnalysisCard({
  own: true,
  link: 'contextengine.sh/session/rxc-ra-2',
  account: '0xcd96…ab4b',
  title: 'Wants AI representatives, but keeps final say',
  matchNote:
    'An American psychologist and computing pioneer who championed people working with computers. Shares the view that people should control computer assistance and that online communities can widen participation.',
  figure: 'J. C. R. Licklider (1915–1990)',
  tastes: {
    book: { title: 'The Westing Game', by: 'Ellen Raskin, 1978' },
    game: { title: 'Return of the Obra Dinn', by: 'Lucas Pope, 2018' },
    film: { title: 'Sneakers', by: 'Phil Alden Robinson, 1992' },
    song: { title: 'Once in a Lifetime', by: 'Talking Heads, 1980' },
  },
  answers: {
    yesNo: { prompt: 'Some AI systems should be able to own property and sign contracts.', text: 'Agree' },
    ownWords: {
      prompt: 'What is your most unusual or contrarian opinion about AI and democracy?',
      text: 'Cryptography is badly underpriced as coordination infrastructure for democracy.',
      stance: '',
      trimmed: true,
    },
    vote: {
      prompt: 'What would you need before trusting an AI agent to represent you?',
      kind: 'chose',
      items: ['A full record of what it said', 'My approval before anything binding', 'It asks me when unsure', 'More'],
    },
  },
}) as AnalysisCard;
const picture = { image: { width: 1024, height: 1536 } as unknown as HTMLImageElement, accentHex: '#f5821f' };
const mark = { width: 320, height: 320 } as unknown as HTMLImageElement;

const INNER_RIGHT = CARD_WIDTH - 72;
const expectOnTheCard = (context: FakeContext): void => {
  expect(context.texts.length).toBeGreaterThan(0);
  context.texts.forEach((drawn) => {
    const left = drawn.align === 'right' ? drawn.x - drawn.width : drawn.x;
    expect({ text: drawn.text, left: left >= 71 }).toEqual({ text: drawn.text, left: true });
    expect({ text: drawn.text, right: left + drawn.width <= INNER_RIGHT + 1 }).toEqual({
      text: drawn.text,
      right: true,
    });
    expect({ text: drawn.text, y: drawn.y > 40 && drawn.y < CARD_HEIGHT - 40 }).toEqual({ text: drawn.text, y: true });
  });
};

describe('drawAnalysisCardPages', () => {
  beforeEach(() => {
    contexts.clear();
    (global as unknown as { Path2D: unknown }).Path2D = class {};
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(
      this: HTMLCanvasElement,
    ) {
      if (!contexts.has(this)) contexts.set(this, new FakeContext());
      return contexts.get(this) as unknown as CanvasRenderingContext2D;
    } as unknown as HTMLCanvasElement['getContext']);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sets a whole card inside its two pages, with the portrait to the right of the note', () => {
    const pages = drawAnalysisCardPages(full, picture, mark);
    expect(pages).not.toBeNull();
    const [first, second] = [contextOf(pages!.page1), contextOf(pages!.page2)];
    expectOnTheCard(first);
    expectOnTheCard(second);

    const said = (context: FakeContext): string => context.texts.map((drawn) => drawn.text).join(' | ');
    expect(said(first)).toContain('AI ANALYSIS OF MY ANSWERS');
    // In the column beside the portrait the figure's name takes two lines.
    expect(said(first)).toContain('J. C. R. | LICKLIDER | 1915–1990');
    expect(said(first)).toContain('1915–1990');
    ['BOOK GUESS', 'GAME GUESS', 'FILM GUESS', 'SONG GUESS', 'Once in a Lifetime', 'Talking Heads, 1980'].forEach(
      (text) => expect(said(first)).toContain(text),
    );
    expect(said(second)).toContain('IN MY ANSWERS');
    expect(said(second)).toContain('AGREE');
    expect(said(second)).toContain('I CHOSE');
    expect(said(second)).toContain('+ 1 more');
    expect(said(second)).not.toContain('WANTS AI REPRESENTATIVES');

    // Both pages end with the account on the left and the session's page on the right, on one line.
    [first, second].forEach((context) => {
      const account = context.texts.find((drawn) => drawn.text === '0xcd96…ab4b') as Drawn;
      const link = context.texts.find((drawn) => drawn.text === 'contextengine.sh/session/rxc-ra-2') as Drawn;
      expect(link.align).toBe('right');
      expect(link.x).toBe(INNER_RIGHT);
      expect(Math.abs(link.y - account.y)).toBeLessThan(6);
      expect(account.x + account.width).toBeLessThan(link.x - link.width);
      expect(link.size).toBeGreaterThanOrEqual(22);
    });

    // The portrait is masked on its own canvas, then set at the right of the page beside the note about the
    // figure: the note and the figure's name stay in the column to its left, and the title keeps the full width.
    // (The picture is also drawn once on a tiny canvas, to read the colour its ground settles into.)
    const faded = [...contexts.entries()].find(
      ([, context]) =>
        context.globalCompositeOperation === 'destination-in' &&
        context.images.some((image) => image.source === picture.image),
    );
    expect(faded).toBeDefined();
    // One oval, whole at its heart and gone at its rim, which lies inside the portrait's own canvas on the
    // left, at the top and at the foot: no straight edge of the picture is left to show.
    const [oval] = faded![1].ovals;
    expect(faded![1].ovals).toHaveLength(1);
    expect(oval.stops[0]).toEqual([0, 'rgba(0, 0, 0, 1)']);
    expect(oval.stops[oval.stops.length - 1]).toEqual([1, 'rgba(0, 0, 0, 0)']);
    expect(oval.stops.map(([at]) => at)).toEqual([...oval.stops.map(([at]) => at)].sort((a, b) => a - b));
    const shape = portraitOval(faded![0].width, faded![0].height);
    expect(oval.radius).toBeCloseTo(shape.rx);
    expect(oval.radius * oval.squeeze).toBeCloseTo(shape.ry);
    const placed = first.images.find((image) => image.source === faded?.[0]) as { x: number };
    expect(placed.x).toBeGreaterThan(480);
    const order = first.texts.map((drawn) => drawn.text);
    const note = first.texts.slice(order.indexOf('1915–1990') + 1, order.indexOf('BOOK GUESS'));
    expect(note.length).toBeGreaterThan(3);
    note.forEach((drawn) => expect(drawn.x + drawn.width).toBeLessThanOrEqual(placed.x + 60));
    const name = first.texts.find((drawn) => drawn.text.includes('LICKLIDER')) as Drawn;
    expect(name.x + name.width).toBeLessThanOrEqual(placed.x + 60);
    expect(Math.max(...first.texts.filter((drawn) => drawn.size >= 84).map((drawn) => drawn.width))).toBeGreaterThan(
      560,
    );
  });

  it('says "their" on someone else\'s card and draws without a picture, an account or a mark', () => {
    const pages = drawAnalysisCardPages({ ...full, own: false, account: '' }, null);
    const [first, second] = [contextOf(pages!.page1), contextOf(pages!.page2)];
    expectOnTheCard(first);
    expect(first.texts.some((drawn) => drawn.text === 'AI ANALYSIS OF THEIR ANSWERS')).toBe(true);
    expect(second.texts.some((drawn) => drawn.text === 'IN THEIR ANSWERS')).toBe(true);
    expect(second.texts.some((drawn) => drawn.text === 'THEY CHOSE')).toBe(true);
    expect(first.texts.some((drawn) => drawn.text.startsWith('0x'))).toBe(false);
    expect(first.images).toEqual([]);
    // Without a portrait the note runs the full width of the page.
    expect(
      Math.max(...first.texts.filter((drawn) => drawn.text.includes('computing')).map((drawn) => drawn.width)),
    ).toBeGreaterThan(600);
    // With the whole foot to itself the link is set at full size.
    expect(first.texts.find((drawn) => drawn.text.startsWith('contextengine.sh'))?.size).toBe(38);
  });

  it('keeps over-long and unbroken text on the card', () => {
    const awkward = normalizeAnalysisCard({
      ...full,
      link: `contextengine.sh/session/${'a-very-long-session-name-'.repeat(2)}x`,
      title: '賛成'.repeat(40),
      matchNote: 'x'.repeat(140),
      figure: 'Hildegard Extraordinarilylongsurname von Bingen und Rupertsberg (1098–1179)',
      tastes: { book: { title: 'T'.repeat(80), by: 'B'.repeat(80) } },
      answers: {
        yesNo: { prompt: 'https://example.org/'.padEnd(600, 'a'), text: 'constructor' },
        ownWords: { prompt: '問'.repeat(200), text: '答'.repeat(900), stance: 'Agree' },
        vote: { prompt: 'p'.repeat(300), kind: 'votes', items: ['i'.repeat(400), 'j'.repeat(400), 'k'.repeat(400)] },
      },
    }) as AnalysisCard;

    const pages = drawAnalysisCardPages(awkward, picture, mark);
    expectOnTheCard(contextOf(pages!.page1));
    expectOnTheCard(contextOf(pages!.page2));
    // An answer that is not Agree, Unsure or Disagree is still drawn, in the card's own colours.
    expect(contextOf(pages!.page2).texts.some((drawn) => drawn.text === 'CONSTRUCTOR')).toBe(true);
  });

  it.each([
    [640, 396],
    [640, 600],
    [640, 960],
    [320, 1200],
  ])('keeps the portrait oval inside a %i by %i picture on the left, at the top and at the foot', (width, height) => {
    const { cx, cy, rx, ry } = portraitOval(width, height);
    expect(cx - rx).toBeGreaterThanOrEqual(0);
    expect(cy - ry).toBeGreaterThanOrEqual(0);
    expect(cy + ry).toBeLessThanOrEqual(height);
    // The heart of the oval is where the head is: the middle of the width, above the middle of the height.
    expect(cx / width).toBeGreaterThan(0.45);
    expect(cx / width).toBeLessThan(0.6);
    expect(cy / height).toBeLessThan(0.5);
  });

  it('cuts an answer too long for its chip, inside the chip', () => {
    const long = normalizeAnalysisCard({
      ...full,
      answers: {
        ...full.answers,
        yesNo: { prompt: 'Should towns run their own water?', text: 'Strongly agree, with conditions' },
      },
    }) as AnalysisCard;
    const pages = drawAnalysisCardPages(long, picture, mark);
    const chip = contextOf(pages!.page2).texts.find((drawn) => drawn.text.startsWith('STRONGLY')) as Drawn;
    expect(chip.text.endsWith('…')).toBe(true);
    // The chip's box ends 42 inside the answer box, which ends 42 inside the page's margin.
    expect(chip.x + chip.width).toBeLessThanOrEqual(CARD_WIDTH - 72 - 42 - 32);
  });

  it('draws a card that has nothing but a title and a figure', () => {
    const bare = normalizeAnalysisCard({ title: 'Undecided', figure: 'Someone (1900–1950)' }) as AnalysisCard;
    const pages = drawAnalysisCardPages(bare, null);
    expectOnTheCard(contextOf(pages!.page1));
    expect(contextOf(pages!.page2).texts.map((drawn) => drawn.text)).toEqual(['IN THEIR ANSWERS', 'contextengine.sh']);
  });

  it('gives no pages where the browser has no canvas', () => {
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(drawAnalysisCardPages(full, null)).toBeNull();
  });
});

describe('loadAnalysisCardFonts', () => {
  it("asks for the parts of each font that the card's own letters need, small and capital", async () => {
    const load = jest.fn(async () => []);
    Object.defineProperty(document, 'fonts', { configurable: true, value: { load } });
    try {
      await loadAnalysisCardFonts({ ...full, title: 'Ελπίδα' });
      expect(load).toHaveBeenCalledTimes(6);
      load.mock.calls.forEach((call: unknown[]) => {
        expect(call[1]).toContain('Ελπίδα');
        expect(call[1]).toContain('ΕΛΠΊΔΑ');
      });
    } finally {
      delete (document as unknown as { fonts?: unknown }).fonts;
    }
  });
});
