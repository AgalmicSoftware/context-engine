import {
  createPagedPdf,
  loadBrowserModuleWithRetry,
  resolveDefaultExport,
  resolveJsPdfConstructor,
  saveCanvasAsPagedPdf,
  planCanvasPdfPages,
  prepareReportCanvasClone,
} from './browserPdfExport';
import { formatFixedMediaRgba } from './fixedMediaColors';

describe('browser PDF export primitives', () => {
  it('retries transient module loading failures', async () => {
    const loader = jest.fn().mockRejectedValueOnce(new Error('chunk unavailable')).mockResolvedValue({ default: 'ok' });

    await expect(loadBrowserModuleWithRetry(loader, { attempts: 2, delayMs: 0 })).resolves.toEqual({ default: 'ok' });
    expect(loader).toHaveBeenCalledTimes(2);
    expect(resolveDefaultExport({ default: 'ok' })).toBe('ok');
  });

  it('resolves supported jsPDF module shapes', () => {
    function DefaultJsPdf() {}
    function NamedJsPdf() {}
    function NamespacedJsPdf() {}

    expect(resolveJsPdfConstructor({ default: DefaultJsPdf })).toBe(DefaultJsPdf);
    expect(resolveJsPdfConstructor({ jsPDF: NamedJsPdf })).toBe(NamedJsPdf);
    expect(resolveJsPdfConstructor({ default: { jsPDF: NamespacedJsPdf } })).toBe(NamespacedJsPdf);
    expect(() => resolveJsPdfConstructor({ default: {} })).toThrow('jsPDF constructor is unavailable');
  });

  it('rejects unusable captures before constructing a PDF', () => {
    const JsPdf = jest.fn();
    const canvas = { height: 10, toDataURL: jest.fn(), width: 0 } as unknown as HTMLCanvasElement;

    expect(() => saveCanvasAsPagedPdf({ canvas, filename: 'report.pdf', JsPdf })).toThrow(
      'PDF export capture did not produce a usable canvas.',
    );
    expect(JsPdf).not.toHaveBeenCalled();
  });
});

it('moves page breaks before complete questions and covers all pixels once', () => {
  expect(
    planCanvasPdfPages(2500, 1000, [
      { top: 800, bottom: 1200 },
      { top: 1700, bottom: 1950 },
    ]),
  ).toEqual([
    { top: 0, bottom: 800 },
    { top: 800, bottom: 1700 },
    { top: 1700, bottom: 2500 },
  ]);
});
it('paginates oversized questions using smaller blocks without blank pages or loops', () => {
  expect(
    planCanvasPdfPages(2500, 1000, [
      { top: 0, bottom: 2500 },
      { top: 900, bottom: 1100 },
    ]),
  ).toEqual([
    { top: 0, bottom: 900 },
    { top: 900, bottom: 1900 },
    { top: 1900, bottom: 2500 },
  ]);
});
it('crops separate page images instead of drawing content into the page margins', () => {
  const drawImage = jest.fn();
  const getContext = jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({ fillRect: jest.fn(), drawImage } as unknown as CanvasRenderingContext2D);
  const toDataURL = jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,page');
  const addImage = jest.fn(),
    addPage = jest.fn(),
    save = jest.fn();
  const JsPdf = jest.fn().mockImplementation(() => ({
    addImage,
    addPage,
    save,
    internal: { pageSize: { getWidth: () => 540, getHeight: () => 1040 } },
  }));
  const canvas = document.createElement('canvas');
  canvas.width = 500;
  canvas.height = 1500;
  saveCanvasAsPagedPdf({ canvas, filename: 'mixed.pdf', JsPdf, keepTogether: [{ top: 900, bottom: 1200 }] });
  expect(drawImage.mock.calls.map((call) => [call[2], call[4]])).toEqual([
    [0, 900],
    [900, 600],
  ]);
  expect(addImage.mock.calls.map((call) => [call[2], call[3], call[5]])).toEqual([
    [20, 20, 900],
    [20, 20, 600],
  ]);
  expect(save).toHaveBeenCalledWith('mixed.pdf');
  getContext.mockRestore();
  toDataURL.mockRestore();
});

describe('paged PDF', () => {
  const stubPdf = () => {
    const doc = {
      addImage: jest.fn(),
      addPage: jest.fn(),
      save: jest.fn(),
      setFontSize: jest.fn(),
      setProperties: jest.fn(),
      setTextColor: jest.fn(),
      text: jest.fn(),
      internal: { pageSize: { getWidth: () => 540, getHeight: () => 1040 } },
    };
    return { doc, JsPdf: jest.fn().mockImplementation(() => doc) };
  };
  const captured = (height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = height;
    return canvas;
  };
  let mocks: Array<{ mockRestore: () => void }>;
  beforeEach(() => {
    mocks = [
      jest
        .spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockReturnValue({ fillRect: jest.fn(), drawImage: jest.fn() } as unknown as CanvasRenderingContext2D),
      jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,page'),
    ];
  });
  afterEach(() => mocks.forEach((mock) => mock.mockRestore()));

  it('names the exporter in the file and on every page, inside the margin', () => {
    const { doc, JsPdf } = stubPdf();
    const exporter = '0x9999999999999999999999999999999999999999';
    saveCanvasAsPagedPdf({ canvas: captured(2500), filename: 'report.pdf', JsPdf, exporter, title: 'Results' });
    expect(doc.setProperties).toHaveBeenCalledWith(
      expect.objectContaining({ author: exporter, subject: expect.stringContaining(exporter), title: 'Results' }),
    );
    // 2,500 pixels at a page of 1,000 is three pages, each stamped.
    expect(doc.addPage).toHaveBeenCalledTimes(2);
    expect(doc.text).toHaveBeenCalledTimes(3);
    doc.text.mock.calls.forEach(([text, x, y]) => {
      expect(text).toBe(`Downloaded by ${exporter}`);
      expect(x).toBe(20);
      expect(y).toBeGreaterThan(1040 - 20);
    });
    expect(doc.save).toHaveBeenCalledWith('report.pdf');
  });

  it('adds no stamp without an exporter', () => {
    const { doc, JsPdf } = stubPdf();
    saveCanvasAsPagedPdf({ canvas: captured(100), filename: 'report.pdf', JsPdf });
    expect(doc.text).not.toHaveBeenCalled();
    expect(doc.setProperties).not.toHaveBeenCalled();
  });

  it('adds captures one below another and moves one that no longer fits to a new page', () => {
    const { doc, JsPdf } = stubPdf();
    const pdf = createPagedPdf({ JsPdf, exporter: '0xabc' });
    [400, 400, 400].forEach((height) => pdf.addCanvas(captured(height)));
    expect(doc.addPage).toHaveBeenCalledTimes(1);
    expect(doc.text).toHaveBeenCalledTimes(2);
    // Each capture sits below the last with a small gap; the third starts page two at the top margin.
    expect(doc.addImage.mock.calls.map((call) => [call[3], call[5]])).toEqual([
      [20, 400],
      [426, 400],
      [20, 400],
    ]);
  });

  it('splits only a capture taller than a page, and loses none of it', () => {
    const { doc, JsPdf } = stubPdf();
    const pdf = createPagedPdf({ JsPdf });
    pdf.addCanvas(captured(100));
    pdf.addCanvas(captured(2300));
    pdf.addCanvas(captured(100));
    // The tall one starts on its own page: 1,000 + 1,000 + 300, then the last fits below it.
    expect(doc.addPage).toHaveBeenCalledTimes(3);
    expect(doc.addImage.mock.calls.map((call) => call[5])).toEqual([100, 1000, 1000, 300, 100]);
    expect(doc.addImage.mock.calls.map((call) => call[3])).toEqual([20, 20, 20, 20, 326]);
  });
});

it('normalizes modern theme colors on the capture clone for html2canvas', () => {
  const root = document.createElement('div');
  root.innerHTML = '<svg><rect fill="var(--ce-binary-choice-agree-bg)" /></svg>';
  const computed = jest.spyOn(window, 'getComputedStyle').mockReturnValue({
    getPropertyValue: (key: string) =>
      key === 'color' ? 'color(srgb 0.1 0.2 0.3)' : key === 'fill' ? 'rgb(86, 180, 233)' : 'rgb(0, 0, 0)',
  } as CSSStyleDeclaration);
  const context = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    getImageData: () => ({ data: [26, 51, 77, 255] }),
  } as unknown as CanvasRenderingContext2D);
  prepareReportCanvasClone(root);
  expect(root.style.color).toBe('rgb(26, 51, 77)');
  expect(root.style.boxShadow).toBe('none');
  expect(root.style.backgroundImage).toBe('none');
  expect(root.querySelector('rect')?.style.fill).toBe('rgb(86, 180, 233)');
  computed.mockRestore();
  context.mockRestore();
});

it('formats sampled canvas pixels through the fixed-media color owner', () => {
  expect(formatFixedMediaRgba(26, 51, 77, 128)).toBe('rgba(26, 51, 77, 0.5019607843137255)');
});
