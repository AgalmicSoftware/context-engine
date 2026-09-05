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

export const saveCanvasAsPagedPdf = ({
  canvas,
  filename,
  JsPdf,
  jpegQuality = 0.82,
}: {
  canvas: Pick<HTMLCanvasElement, 'height' | 'toDataURL' | 'width'>;
  filename: string;
  JsPdf: JsPdfConstructor;
  jpegQuality?: number;
}): void => {
  if (!canvas.width || !canvas.height) {
    throw new Error('PDF export capture did not produce a usable canvas.');
  }

  const pdf = new JsPdf({ compress: true, format: 'a4', orientation: 'p', unit: 'pt' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
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
