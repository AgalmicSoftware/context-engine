export type PostMarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'image'; src: string; alt: string; caption?: string }
  | { type: 'blockquote'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; language: string; code: string }
  | { type: 'viz'; raw: string; spec: unknown; error?: string }
  | { type: 'vizGroupStart'; raw: string; title: string; defaultOpen: boolean; childrenOpen: boolean; error?: string }
  | { type: 'vizGroupEnd' }
  | { type: 'rule' };

const stripFrontmatter = (markdown: string): string => {
  const text = String(markdown || '').replace(/\r\n?/g, '\n');
  if (!text.startsWith('---\n')) return text;
  const endIndex = text.indexOf('\n---', 4);
  if (endIndex < 0) return text;
  const afterFence = text.indexOf('\n', endIndex + 4);
  return afterFence >= 0 ? text.slice(afterFence + 1) : '';
};

const parseVizSpec = (raw: string): { spec: unknown; error?: string } => {
  try {
    return { spec: JSON.parse(raw) };
  } catch (error) {
    return {
      spec: null,
      error: error instanceof Error ? error.message : 'Invalid visualization JSON',
    };
  }
};

const isBlank = (line: string): boolean => line.trim() === '';

const pushParagraph = (blocks: PostMarkdownBlock[], lines: string[]) => {
  const text = lines.join(' ').replace(/\s+/g, ' ').trim();
  if (text) blocks.push({ type: 'paragraph', text });
  lines.length = 0;
};

export const parsePostMarkdown = (markdown: string): PostMarkdownBlock[] => {
  const lines = stripFrontmatter(markdown).split('\n');
  const blocks: PostMarkdownBlock[] = [];
  const paragraphLines: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] || '';
    const trimmed = line.trim();

    if (isBlank(line)) {
      pushParagraph(blocks, paragraphLines);
      index += 1;
      continue;
    }

    const fenceMatch = trimmed.match(/^```([A-Za-z0-9_-]*)\s*$/);
    if (fenceMatch) {
      pushParagraph(blocks, paragraphLines);
      const language = fenceMatch[1] || '';
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !String(lines[index] || '').trim().startsWith('```')) {
        codeLines.push(lines[index] || '');
        index += 1;
      }
      if (index < lines.length) index += 1;
      const code = codeLines.join('\n');
      if (language.toLowerCase() === 'ce-viz') {
        const parsed = parseVizSpec(code);
        blocks.push({ type: 'viz', raw: code, spec: parsed.spec, ...(parsed.error ? { error: parsed.error } : {}) });
      } else if (language.toLowerCase() === 'ce-viz-group') {
        const parsed = parseVizSpec(code);
        const record = parsed.spec && typeof parsed.spec === 'object' && !Array.isArray(parsed.spec)
          ? parsed.spec as Record<string, unknown>
          : {};
        const title = typeof record.title === 'string' && record.title.trim()
          ? record.title.trim()
          : 'Data Exploration';
        blocks.push({
          type: 'vizGroupStart',
          raw: code,
          title,
          defaultOpen: record.defaultOpen === true,
          childrenOpen: record.childrenOpen === true,
          ...(parsed.error ? { error: parsed.error } : {}),
        });
      } else if (language.toLowerCase() === 'ce-viz-group-end') {
        blocks.push({ type: 'vizGroupEnd' });
      } else {
        blocks.push({ type: 'code', language, code });
      }
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      pushParagraph(blocks, paragraphLines);
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      pushParagraph(blocks, paragraphLines);
      blocks.push({ type: 'rule' });
      index += 1;
      continue;
    }

    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]+)")?\)$/);
    if (imageMatch) {
      pushParagraph(blocks, paragraphLines);
      const caption = imageMatch[3]?.trim();
      blocks.push({
        type: 'image',
        alt: imageMatch[1].trim(),
        src: imageMatch[2].trim(),
        ...(caption ? { caption } : {}),
      });
      index += 1;
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (unorderedMatch || orderedMatch) {
      pushParagraph(blocks, paragraphLines);
      const ordered = !!orderedMatch;
      const items: string[] = [];
      while (index < lines.length) {
        const itemLine = String(lines[index] || '').trim();
        const itemMatch = ordered
          ? itemLine.match(/^\d+\.\s+(.+)$/)
          : itemLine.match(/^[-*]\s+(.+)$/);
        if (!itemMatch) break;
        items.push(itemMatch[1].trim());
        index += 1;
      }
      if (items.length) blocks.push({ type: 'list', ordered, items });
      continue;
    }

    if (trimmed.startsWith('>')) {
      pushParagraph(blocks, paragraphLines);
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const quoteLine = String(lines[index] || '').trim();
        if (!quoteLine.startsWith('>')) break;
        quoteLines.push(quoteLine.replace(/^>\s?/, '').trim());
        index += 1;
      }
      const text = quoteLines.join(' ').replace(/\s+/g, ' ').trim();
      if (text) blocks.push({ type: 'blockquote', text });
      continue;
    }

    paragraphLines.push(trimmed);
    index += 1;
  }

  pushParagraph(blocks, paragraphLines);
  return blocks;
};
