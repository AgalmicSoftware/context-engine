import {
  createPagedPdf,
  loadBrowserModuleWithRetry,
  resolveDefaultExport,
  resolveJsPdfConstructor,
} from '../ui/browserPdfExport';

export type SessionResultsPdfDownloadOptions = {
  documentRef?: Document;
  exporterAddress?: string;
  filename: string;
  html: string;
  html2canvasLoader?: () => Promise<unknown>;
  jsPdfLoader?: () => Promise<unknown>;
};

// Below the 32,767 pixels a canvas can hold at twice this height, and well above a normal block.
const PDF_CAPTURE_HEIGHT = 12000;

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
      const height = element.getBoundingClientRect().height;
      const options = {
        backgroundColor: '#ffffff',
        scale: 2,
        scrollX: 0,
        scrollY: 0,
        useCORS: true,
        windowHeight: Math.max(iframeDoc.documentElement.scrollHeight, height),
        windowWidth: iframeDoc.documentElement.scrollWidth,
      };
      if (height <= PDF_CAPTURE_HEIGHT) {
        pdf.addCanvas(await html2canvas(element, options));
        return;
      }
      for (let y = 0; y < height; y += PDF_CAPTURE_HEIGHT) {
        pdf.addCanvas(await html2canvas(element, { ...options, y, height: Math.min(PDF_CAPTURE_HEIGHT, height - y) }));
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
