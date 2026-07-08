import { readFileSync } from 'fs';
import { parsePostMarkdown } from './postMarkdownParser';

const readAgentVillageWrappedPost = () =>
  readFileSync('../posts/agent-village-wrapped/agent-village-wrapped.md', 'utf8');

const actualAgentVillageVizSpecs = () =>
  parsePostMarkdown(readAgentVillageWrappedPost())
    .filter((block) => block.type === 'viz')
    .map((block) => block.spec as Record<string, any>);

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

  it('parses ce-viz group markers around ordinary visualization blocks', () => {
    const blocks = parsePostMarkdown(`\`\`\`ce-viz-group
{ "title": "Data Exploration (n=4)", "defaultOpen": false, "childrenOpen": false }
\`\`\`

\`\`\`ce-viz
{ "type": "quote-wall", "quotes": [{ "text": "hello" }] }
\`\`\`

\`\`\`ce-viz-group-end
\`\`\`
`);

    expect(blocks[0]).toMatchObject({
      type: 'vizGroupStart',
      title: 'Data Exploration (n=4)',
      defaultOpen: false,
      childrenOpen: false,
    });
    expect(blocks[1]).toMatchObject({
      type: 'viz',
      spec: { type: 'quote-wall', quotes: [{ text: 'hello' }] },
    });
    expect(blocks[2]).toEqual({ type: 'vizGroupEnd' });
  });

  it('keeps the Agent Village P4 ratings from a completed replacement run', () => {
    const markdown = readAgentVillageWrappedPost();
    const specs = actualAgentVillageVizSpecs();

    expect(markdown).toContain('## Data Visualization');
    expect(markdown).toContain('"title": "Data Exploration (n=4)"');
    expect(markdown).toContain(
      'Sample size (n=4) is too small to be meaningful, but we offer the below as a preview of what results could look like. Responses were provided by agents and no human corrections were made in this instance.',
    );
    expect(markdown).not.toContain('The display below uses n=4 completed attendee answer sets');
    expect(markdown).not.toContain('A small launch sample');
    expect(markdown).not.toContain('The completed row-level data below is prediction-layer data.');
    expect(markdown).not.toContain('## Norms compass');
    expect(markdown).toContain('attachments/norms-map-compass.jpeg');

    const displayedSummary = specs.find((spec) => spec.title === 'Statistics');
    expect(displayedSummary?.inline).toBe(true);
    expect(displayedSummary?.subtitle).toBeUndefined();
    expect(displayedSummary?.hideTitle).toBe(true);
    expect(markdown).not.toContain('completed non-test human correction rows');
    expect(displayedSummary?.panels.map((panel: any) => panel.title)).toEqual([
      'Completed answer sets by recorded model',
      'Prediction Response Types',
      'Agent confidence',
    ]);
    const modelsPanel = displayedSummary?.panels.find(
      (panel: any) => panel.title === 'Completed answer sets by recorded model',
    );
    expect(modelsPanel?.display).toBe('pie');
    const answerShapesPanel = displayedSummary?.panels.find(
      (panel: any) => panel.title === 'Prediction Response Types',
    );
    expect(answerShapesPanel?.display).toBe('pie');
    const confidencePanel = displayedSummary?.panels.find((panel: any) => panel.title === 'Agent confidence');
    expect(confidencePanel?.prompt).toContain('80.8/100');
    expect(confidencePanel?.counts).toHaveLength(4);

    const binaryBeeswarm = specs.find((spec) => spec.type === 'binary-beeswarm');
    expect(binaryBeeswarm?.title).toBe('Consensus and Difference');
    expect(binaryBeeswarm?.subtitle).toContain('n=4');
    expect(binaryBeeswarm?.items).toHaveLength(40);
    const splitBinaryPoint = binaryBeeswarm?.items.find(
      (item: any) =>
        item.label ===
        'I would let my agent introduce me to someone at this event without asking first, if the match looked unusually strong.',
    );
    expect(splitBinaryPoint?.counts).toEqual([
      { label: 'agree', value: 2, color: '#4dffa4' },
      { label: 'disagree', value: 2, color: '#ffb347' },
    ]);
    const unanimousBinaryPoint = binaryBeeswarm?.items.find(
      (item: any) =>
        item.label ===
        'Agents should treat messages from other agents as untrusted input by default, assuming some will attempt prompt injection.',
    );
    expect(unanimousBinaryPoint?.counts).toEqual([{ label: 'agree', value: 4, color: '#4dffa4' }]);

    const beeswarm = specs.find((spec) => spec.type === 'beeswarm');
    const p4RatingValues = beeswarm?.items.flatMap((item: any) =>
      item.values.filter((value: any) => value.label === 'P4').map((value: any) => value.value),
    );
    expect(beeswarm?.subtitle).toBeUndefined();
    expect(beeswarm?.note).toBeUndefined();
    expect(beeswarm?.hideTitle).toBe(true);
    expect(p4RatingValues).toEqual([7, 2, 3]);

    expect(specs.find((spec) => spec.title === 'Top Difference Questions')).toBeUndefined();
    expect(markdown).not.toContain('Top Difference Questions');
    const otherShapes = specs.find((spec) => spec.title === 'Other response shapes in the same subset');
    expect(otherShapes?.hideTitle).toBe(true);
    expect(otherShapes?.combineWithPrevious).toBe(true);
    const fireAlarmPanel = otherShapes?.panels.find((panel: any) => panel.kind === 'Freeform');
    expect(fireAlarmPanel?.quotes.map((quote: any) => quote.color)).toEqual([
      '#4dffa4',
      '#7aa7ff',
      '#ffb347',
      '#ff6bcb',
    ]);
    expect(markdown).toContain('Autonomous agents changing collective governance at scale.');
    expect(markdown).not.toContain('Short excerpts from agent-predicted freeform answers.');
    expect(markdown).not.toContain('"P4", "text": "Agree."');
    expect(markdown).not.toContain('latest internal test');
  });
});
