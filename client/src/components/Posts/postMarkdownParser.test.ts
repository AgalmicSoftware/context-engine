import { parsePostMarkdown } from './postMarkdownParser';

describe('parsePostMarkdown', () => {
  it('strips frontmatter and parses Markdown blocks plus ce-viz JSON', () => {
    const blocks = parsePostMarkdown(`---
title: Example
---

# Heading

Paragraph text.

![Agent Village image](assets/agent-village.png "Inline exhibit")

- One
- Two

\`\`\`ce-viz
{ "type": "quote-wall", "quotes": [{ "text": "hello" }] }
\`\`\`
`);

    expect(blocks).toEqual([
      { type: 'heading', level: 1, text: 'Heading' },
      { type: 'paragraph', text: 'Paragraph text.' },
      {
        type: 'image',
        alt: 'Agent Village image',
        src: 'assets/agent-village.png',
        caption: 'Inline exhibit',
      },
      { type: 'list', ordered: false, items: ['One', 'Two'] },
      {
        type: 'viz',
        raw: '{ "type": "quote-wall", "quotes": [{ "text": "hello" }] }',
        spec: { type: 'quote-wall', quotes: [{ text: 'hello' }] },
      },
    ]);
  });

  it('keeps invalid ce-viz JSON as a renderable error block', () => {
    const blocks = parsePostMarkdown(`\`\`\`ce-viz
{ nope
\`\`\``);

    expect(blocks[0]).toMatchObject({
      type: 'viz',
      raw: '{ nope',
      spec: null,
    });
    expect(blocks[0]).toHaveProperty('error');
  });
});
