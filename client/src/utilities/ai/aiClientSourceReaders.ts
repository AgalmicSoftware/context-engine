export const extractMainContent = (htmlString: unknown): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(htmlString || ''), 'text/html');

  const elementsToRemove = ['script', 'style', 'iframe', 'nav', 'footer', 'header', 'aside'];
  elementsToRemove.forEach((tag) => {
    doc.querySelectorAll(tag).forEach((el) => el.remove());
  });

  const contentSelectors = ['main', 'article', '.content', '#content', '.main-content', '#main-content', 'body'];

  for (const selector of contentSelectors) {
    const element = doc.querySelector(selector);
    if (element) {
      const text = String(element.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (text.length > 100) {
        return text;
      }
    }
  }

  return String(doc.body.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();
};

export type SourceExtractionOutcome =
  { status: 'text'; text: string } | { status: 'unsupported' | 'failed'; reason: string };

export const readFileContent = (file: File): Promise<SourceExtractionOutcome> =>
  new Promise((resolve) => {
    const name = file.name.toLowerCase();
    const isBinary = /\.(pdf|ppt|pptx|doc|docx|xls|xlsx)$/.test(name);
    const isText =
      /\.(txt|md|csv|json|xml|html?)$/.test(name) || file.type.startsWith('text/') || file.type === 'application/json';
    if (isBinary || !isText) {
      resolve({
        status: 'unsupported',
        reason: 'Cannot extract this file type. Paste its text or upload TXT, Markdown, CSV, or JSON.',
      });
      return;
    }

    const reader = new FileReader();
    const failed = () =>
      resolve({ status: 'failed', reason: `Failed to read ${file.name}. Try uploading it again or paste its text.` });
    reader.onload = () => {
      const raw = typeof reader.result === 'string' ? reader.result : '';
      const text = (/\.html?$/.test(name) || file.type === 'text/html' ? extractMainContent(raw) : raw).trim();
      resolve(
        text
          ? { status: 'text', text }
          : { status: 'failed', reason: 'No text was extracted. Paste the source text instead.' },
      );
    };
    reader.onerror = failed;
    reader.onabort = failed;
    try {
      reader.readAsText(file);
    } catch {
      failed();
    }
  });
