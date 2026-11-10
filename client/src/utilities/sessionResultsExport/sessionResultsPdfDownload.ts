import {
  createPagedPdf,
  loadBrowserModuleWithRetry,
  planCanvasPdfPages,
  resolveDefaultExport,
  resolveJsPdfConstructor,
} from '../ui/browserPdfExport';
import { FIXED_MEDIA_LIGHT } from '../ui/fixedMediaColors';

export type SessionResultsPdfDownloadOptions = {
  documentRef?: Document;
  exporterAddress?: string;
  filename: string;
  html: string;
  html2canvasLoader?: () => Promise<unknown>;
  jsPdfLoader?: () => Promise<unknown>;
};

// Captured at double scale this stays under the 16.7 million pixels a phone's canvas can hold.
const PDF_CAPTURE_HEIGHT = 3500;

export const downloadSessionResultsPdfReport = async ({
  documentRef = document,
  exporterAddress = '',
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
    const pdf = createPagedPdf({ JsPdf, exporter: exporterAddress, title: iframeDoc.title });
    const capture = async (element: HTMLElement) => {
      const bounds = element.getBoundingClientRect();
      const options = {
        backgroundColor: FIXED_MEDIA_LIGHT,
        scale: 2,
        scrollX: 0,
        scrollY: 0,
        useCORS: true,
        windowHeight: Math.max(iframeDoc.documentElement.scrollHeight, bounds.height),
        windowWidth: iframeDoc.documentElement.scrollWidth,
      };
      // Neither the end of a capture nor a page break cuts through a row that fits. Adjacent rows round alike, as an
      // overlap of one pixel would make every earlier row look cut too.
      const rows = Array.from(element.querySelectorAll('tr')).map((row) => {
        const { top, bottom } = row.getBoundingClientRect();
        return { top: Math.round(top - bounds.top), bottom: Math.round(bottom - bounds.top) };
      });
      const windows =
        bounds.height > PDF_CAPTURE_HEIGHT
          ? planCanvasPdfPages(Math.ceil(bounds.height), PDF_CAPTURE_HEIGHT, rows)
          : [{ top: 0, bottom: bounds.height }];
      for (const { top, bottom } of windows) {
        const canvas = await html2canvas(
          element,
          windows.length > 1 ? { ...options, y: top, height: bottom - top } : options,
        );
        const toPixels = canvas.height / (bottom - top || 1);
        const keepTogether = rows
          .filter((row) => row.top >= top && row.bottom <= bottom)
          .map((row) => ({
            top: Math.round((row.top - top) * toPixels),
            bottom: Math.round((row.bottom - top) * toPixels),
          }));
        pdf.addCanvas(canvas, keepTogether);
        // Phones run out of canvas memory long before a report's end if these wait for garbage collection.
        canvas.width = 0;
        canvas.height = 0;
      }
    };
    // One canvas can't hold a long report, and html2canvas copies whatever the document holds on every capture, so
    // each block is alone in the document while it is captured.
    const main = iframeDoc.querySelector('main');
    const blocks = Array.from(main?.children || []) as HTMLElement[];
    main?.replaceChildren();
    const header = iframeDoc.querySelector('header');
    if (header) await capture(header);
    for (const block of blocks) {
      main?.replaceChildren(block);
      await capture(block);
    }
    pdf.save(filename);
  } finally {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }
};
