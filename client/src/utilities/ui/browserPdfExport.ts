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

export const saveCanvasAsPagedPdf = ({
  canvas,
  filename,
  JsPdf,
  jpegQuality = 0.82,
  keepTogether,
}: {
  canvas: Pick<HTMLCanvasElement, 'height' | 'toDataURL' | 'width'>;
  filename: string;
  JsPdf: JsPdfConstructor;
  jpegQuality?: number;
  keepTogether?: PdfKeepTogetherRange[];
}): void => {
  if (!canvas.width || !canvas.height) {
    throw new Error('PDF export capture did not produce a usable canvas.');
  }

  const pdf = new JsPdf({ compress: true, format: 'a4', orientation: 'p', unit: 'pt' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  if (keepTogether) {
    const margin = 20;
    const imageWidth = pageWidth - margin * 2;
    const scale = imageWidth / canvas.width;
    const pages = planCanvasPdfPages(canvas.height, Math.floor((pageHeight - margin * 2) / scale), keepTogether);
    pages.forEach(({ top, bottom }, index) => {
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = bottom - top;
      const context = pageCanvas.getContext('2d');
      if (!context) throw new Error('PDF page canvas is unavailable.');
      context.fillStyle = '#fff';
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
      if (index) pdf.addPage();
      pdf.addImage(
        pageCanvas.toDataURL('image/jpeg', jpegQuality),
        'JPEG',
        margin,
        margin,
        imageWidth,
        (bottom - top) * scale,
        undefined,
        'FAST',
      );
      // Release temporary page bitmaps promptly for large reports.
      pageCanvas.width = 0;
      pageCanvas.height = 0;
    });
    pdf.save(filename);
    return;
  }
  const imgData = canvas.toDataURL('image/jpeg', jpegQuality);
  const imgHeight = (canvas.height * pageWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight, undefined, 'FAST');
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    pdf.addPage();
    position = heightLeft - imgHeight;
    pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;
  }

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
        rgb = `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`;
        cache.set(value, rgb);
      }
      element.style.setProperty(property, rgb, 'important');
    });
    element.style.setProperty('box-shadow', 'none', 'important');
    element.style.setProperty('text-shadow', 'none', 'important');
    element.style.setProperty('background-image', 'none', 'important');
  });
}
