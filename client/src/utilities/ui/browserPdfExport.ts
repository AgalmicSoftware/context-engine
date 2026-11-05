import { FIXED_MEDIA_LIGHT, formatFixedMediaRgba } from './fixedMediaColors';

export type JsPdfDocument = {
  internal: {
    pageSize: {
      getWidth(): number;
      getHeight(): number;
    };
  };
  addImage(...args: unknown[]): void;
  addPage(): void;
  save(filename: string): void;
  setFontSize(size: number): unknown;
  setProperties(properties: Record<string, string>): unknown;
  setTextColor(red: number, green: number, blue: number): unknown;
  text(text: string, x: number, y: number): unknown;
};

export type JsPdfConstructor = new (...args: unknown[]) => JsPdfDocument;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

export const loadBrowserModuleWithRetry = async <T>(
  loader: () => Promise<T>,
  { attempts = 3, delayMs = 250 }: { attempts?: number; delayMs?: number } = {},
): Promise<T> => {
  const totalAttempts = Math.max(1, Math.floor(Number(attempts) || 1));
  let lastError: unknown;

  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    try {
      return await loader();
    } catch (error) {
      lastError = error;
      if (attempt < totalAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
};

export const resolveDefaultExport = <T>(moduleValue: unknown): T => {
  const record = asRecord(moduleValue);
  return (record.default || moduleValue) as T;
};

export const resolveJsPdfConstructor = (moduleValue: unknown): JsPdfConstructor => {
  const record = asRecord(moduleValue);
  const defaultExport = record.default;
  if (typeof defaultExport === 'function') return defaultExport as JsPdfConstructor;
  if (typeof record.jsPDF === 'function') return record.jsPDF as JsPdfConstructor;
  if (typeof asRecord(defaultExport).jsPDF === 'function') {
    return asRecord(defaultExport).jsPDF as JsPdfConstructor;
  }
  if (typeof moduleValue === 'function') return moduleValue as JsPdfConstructor;
  throw new Error('jsPDF constructor is unavailable');
};

export type PdfKeepTogetherRange = { top: number; bottom: number };

// Move a page boundary before any fitting question it would cut through. Oversize
// blocks fall back to their smaller marked children, then ordinary page slicing.
export function planCanvasPdfPages(height: number, pageHeight: number, ranges: PdfKeepTogetherRange[] = []) {
  if (!(height > 0) || !(pageHeight > 0)) throw new Error('Invalid PDF page dimensions.');
  const pages: PdfKeepTogetherRange[] = [];
  let top = 0;
  while (top < height) {
    let bottom = Math.min(height, top + pageHeight);
    let moved = true;
    while (moved) {
      moved = false;
      for (const block of ranges) {
        if (block.top > top && block.top < bottom && block.bottom > bottom && block.bottom - block.top <= pageHeight) {
          bottom = block.top;
          moved = true;
        }
      }
    }
    pages.push({ top, bottom });
    top = bottom;
  }
  return pages;
}

type PdfCanvas = Pick<HTMLCanvasElement, 'height' | 'width'>;

const assertUsableCanvas = (canvas: PdfCanvas) => {
  if (!canvas.width || !canvas.height) {
    throw new Error('PDF export capture did not produce a usable canvas.');
  }
};

const PDF_MARGIN = 20;
const PDF_BLOCK_GAP = 6;

/**
 * An A4 PDF built from captures, each placed below the last. A capture that doesn't fit the space left starts a new
 * page. Who exported the file goes in its properties and, as real text, in the margin of every page.
 */
export const createPagedPdf = ({
  JsPdf,
  exporter = '',
  title = '',
  jpegQuality = 0.82,
}: {
  JsPdf: JsPdfConstructor;
  exporter?: string;
  title?: string;
  jpegQuality?: number;
}) => {
  const pdf = new JsPdf({ compress: true, format: 'a4', orientation: 'p', unit: 'pt' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imageWidth = pageWidth - PDF_MARGIN * 2;
  const stampPage = () => {
    if (!exporter) return;
    pdf.setFontSize(8);
    pdf.setTextColor(51, 65, 85);
    pdf.text(`Downloaded by ${exporter}`, PDF_MARGIN, pageHeight - 8);
  };
  if (exporter) {
    pdf.setProperties({
      ...(title ? { title } : {}),
      author: exporter,
      subject: `Downloaded by ${exporter}`,
      creator: 'Context Engine',
    });
  }
  stampPage();
  let y = PDF_MARGIN;
  const newPage = () => {
    pdf.addPage();
    stampPage();
    y = PDF_MARGIN;
  };
  return {
    addCanvas(canvas: PdfCanvas, keepTogether: PdfKeepTogetherRange[] = []) {
      assertUsableCanvas(canvas);
      const scale = imageWidth / canvas.width;
      if (y > PDF_MARGIN && y + canvas.height * scale > pageHeight - PDF_MARGIN) newPage();
      const pageSpace = Math.floor((pageHeight - PDF_MARGIN * 2) / scale);
      planCanvasPdfPages(canvas.height, pageSpace, keepTogether).forEach(({ top, bottom }, index) => {
        if (index) newPage();
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = bottom - top;
        const context = pageCanvas.getContext('2d');
        if (!context) throw new Error('PDF page canvas is unavailable.');
        context.fillStyle = FIXED_MEDIA_LIGHT;
        context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        context.drawImage(
          canvas as HTMLCanvasElement,
          0,
          top,
          canvas.width,
          bottom - top,
          0,
          0,
          canvas.width,
          bottom - top,
        );
        pdf.addImage(
          pageCanvas.toDataURL('image/jpeg', jpegQuality),
          'JPEG',
          PDF_MARGIN,
          y,
          imageWidth,
          (bottom - top) * scale,
          undefined,
          'FAST',
        );
        y += (bottom - top) * scale;
        // Release temporary page bitmaps promptly for large reports.
        pageCanvas.width = 0;
        pageCanvas.height = 0;
      });
      y += PDF_BLOCK_GAP;
    },
    save: (filename: string) => pdf.save(filename),
  };
};

export const saveCanvasAsPagedPdf = ({
  canvas,
  filename,
  JsPdf,
  exporter,
  title,
  jpegQuality,
  keepTogether,
}: {
  canvas: PdfCanvas;
  filename: string;
  JsPdf: JsPdfConstructor;
  exporter?: string;
  title?: string;
  jpegQuality?: number;
  keepTogether?: PdfKeepTogetherRange[];
}): void => {
  assertUsableCanvas(canvas);
  const pdf = createPagedPdf({ JsPdf, exporter, title, jpegQuality });
  pdf.addCanvas(canvas, keepTogether);
  pdf.save(filename);
};

// html2canvas 1.x cannot parse modern computed colors (including the color()
// produced by color-mix). Convert only the capture clone to sRGB; live themes
// and the dimensions used to choose page breaks remain untouched.
export function prepareReportCanvasClone(root: HTMLElement): void {
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  const canvas = doc.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!view || !context) return;
  const cache = new Map<string, string>();
  const properties = [
    'color',
    'background-color',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'outline-color',
    'text-decoration-color',
    'fill',
    'stroke',
  ];
  [root, ...root.querySelectorAll<HTMLElement>('*')].forEach((element) => {
    const computed = view.getComputedStyle(element);
    properties.forEach((property) => {
      const value = computed.getPropertyValue(property);
      if (!/(?:color(?:-mix)?|oklch|oklab|lch|lab)\(/i.test(value)) {
        // html2canvas serializes SVG separately from the document. Resolve its
        // inherited palette before that serialization loses root CSS variables.
        if (
          element.namespaceURI === 'http://www.w3.org/2000/svg' &&
          ['fill', 'stroke', 'color'].includes(property) &&
          value
        ) {
          element.style.setProperty(property, value, 'important');
        }
        return;
      }
      let rgb = cache.get(value);
      if (!rgb) {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
        const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
        rgb = formatFixedMediaRgba(red, green, blue, alpha);
        cache.set(value, rgb);
      }
      element.style.setProperty(property, rgb, 'important');
    });
    element.style.setProperty('box-shadow', 'none', 'important');
    element.style.setProperty('text-shadow', 'none', 'important');
    element.style.setProperty('background-image', 'none', 'important');
  });
}
