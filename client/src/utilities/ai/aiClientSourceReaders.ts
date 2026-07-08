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

export const readFileContent = (file: File): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const name = file.name.toLowerCase();
    // Basic text-like extensions
    const isText =
      name.endsWith('.txt') ||
      name.endsWith('.md') ||
      name.endsWith('.csv') ||
      name.endsWith('.json') ||
      name.endsWith('.xml') ||
      file.type.startsWith('text/');

    // Known binaries that we explicitly don't parse client-side yet
    const isBinary =
      name.endsWith('.pdf') ||
      name.endsWith('.ppt') ||
      name.endsWith('.pptx') ||
      name.endsWith('.doc') ||
      name.endsWith('.docx') ||
      name.endsWith('.xls') ||
      name.endsWith('.xlsx');

    if (isBinary) {
      resolve(`[Binary content parsing not currently supported client-side for file: ${file.name}]`);
      return;
    }

    if (!isText) {
      // Fallback: try reading as text, but might be garbage if unknown binary.
      // Given constraints, we attempt reading.
    }

    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsText(file);
  });
