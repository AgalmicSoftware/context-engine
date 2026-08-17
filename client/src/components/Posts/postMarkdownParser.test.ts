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
      layout: 'carousel',
    });
    expect(blocks[1]).toMatchObject({
      type: 'viz',
      spec: { type: 'quote-wall', quotes: [{ text: 'hello' }] },
    });
    expect(blocks[2]).toEqual({ type: 'vizGroupEnd' });
  });

  it('parses the stack layout for ce-viz groups', () => {
    const blocks = parsePostMarkdown(`\`\`\`ce-viz-group
{ "title": "Stacked", "defaultOpen": true, "layout": "stack" }
\`\`\`

\`\`\`ce-viz-group-end
\`\`\`
`);

    expect(blocks[0]).toMatchObject({ type: 'vizGroupStart', title: 'Stacked', layout: 'stack' });
  });

  it('parses disclosure markers around Markdown and code blocks', () => {
    const blocks = parsePostMarkdown(`\`\`\`ce-disclosure
{ "title": "Evaluation schema", "defaultOpen": true }
\`\`\`

### Record schema

\`\`\`typescript
type Record = { score: number };
\`\`\`

\`\`\`ce-disclosure-end
\`\`\`
`);

    expect(blocks).toEqual([
      {
        type: 'disclosureStart',
        raw: '{ "title": "Evaluation schema", "defaultOpen": true }',
        title: 'Evaluation schema',
        defaultOpen: true,
      },
      { type: 'heading', level: 3, text: 'Record schema' },
      { type: 'code', language: 'typescript', code: 'type Record = { score: number };' },
      { type: 'disclosureEnd' },
    ]);
  });

  it('keeps the Agent Village P4 ratings from a completed replacement run', () => {
    const markdown = readAgentVillageWrappedPost();
    const specs = actualAgentVillageVizSpecs();

    expect(markdown).toContain('## Example data (n = 4)');
    expect(markdown).not.toContain('"title": "Data Exploration (n=4)"');
    expect(markdown).not.toContain('```ce-viz-group');
    expect(markdown).not.toContain('```ce-viz-group-end');
    expect(markdown).toContain('Telegram was a primary interface for the Edge Hermes agents.');
    expect(markdown).not.toContain(
      'Telegram was the interface users interacted with their Hermes agents through at Edge.',
    );
    expect(markdown).toContain(
      'Four agents took the quiz — 58 questions each, 232 predictions — but no human corrections were made this time.',
    );
    expect(markdown).not.toContain(
      'Everything below consists of unreviewed agent predictions, so it demonstrates what the eval collects rather than how accurately the agents represented their principals.',
    );
    expect(markdown).toContain('"title": "Evaluation protocol, scoring, and record schema"');
    expect(markdown).toContain('schemaVersion: "agent-mirror-eval/v1"');
    expect(markdown).toContain(
      'If the agent says it is 90% confident, about 90% of those reviewed predictions should remain unchanged.',
    );
    expect(markdown).toContain(
      "To measure that bias, participants answer some questions before seeing the agent's prediction.",
    );
    expect(markdown).not.toContain('The gap between blind and post-view agreement measures the anchoring itself');
    expect(markdown).toContain(
      'Self-service event setup is a work in progress, and we can set up an instance for events today.',
    );
    expect(markdown).not.toContain('does 90 mean 90?');
    expect(markdown).toContain('longitudinalRole: "anchor" | "holdout";');
    expect(markdown).toContain(
      '**Cross-model mirrors** — give two models the same questions and context, then compare paired Mirror Score and calibration.',
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
    expect(displayedSummary?.presentation).toBe('editorial');
    expect(markdown).not.toContain('completed non-test human correction rows');
    expect(displayedSummary?.panels.map((panel: any) => panel.title)).toEqual([
      'Responding Model Type',
      'Prediction Response Types',
      'Agent confidence',
    ]);
    const modelsPanel = displayedSummary?.panels.find((panel: any) => panel.title === 'Responding Model Type');
    expect(modelsPanel?.display).toBe('pie');
    expect(modelsPanel?.counts).toContainEqual({
      label: '[object Object] record (Hermes v.0.14.0)',
      value: 1,
      color: '#ffb347',
    });
    expect(modelsPanel?.note).toBeUndefined();
    expect(markdown).not.toContain('One run stored its model metadata as [object Object]');
    const answerShapesPanel = displayedSummary?.panels.find(
      (panel: any) => panel.title === 'Prediction Response Types',
    );
    expect(answerShapesPanel?.display).toBe('ring');
    const confidencePanel = displayedSummary?.panels.find((panel: any) => panel.title === 'Agent confidence');
    expect(confidencePanel?.prompt).toContain('80.8/100');
    expect(confidencePanel?.summaryValue).toBe(80.8);
    expect(confidencePanel?.counts).toHaveLength(4);

    const binaryBeeswarm = specs.find((spec) => spec.type === 'binary-beeswarm');
    expect(binaryBeeswarm?.title).toBe('Consensus and Difference');
    expect(binaryBeeswarm?.subtitle).toBeUndefined();
    expect(binaryBeeswarm?.inline).toBe(true);
    expect(binaryBeeswarm?.hideTitle).toBe(true);
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
    expect(beeswarm?.inline).toBe(true);
    expect(beeswarm?.hideTitle).toBe(true);
    expect(beeswarm?.presentation).toBe('precision');
    expect(p4RatingValues).toEqual([7, 2, 3]);

    expect(specs.find((spec) => spec.title === 'Top Difference Questions')).toBeUndefined();
    expect(markdown).not.toContain('Top Difference Questions');
    const otherShapes = specs.find((spec) => spec.title === 'Other response shapes in the same subset');
    expect(otherShapes?.hideTitle).toBe(true);
    expect(otherShapes?.combineWithPrevious).toBe(true);
    expect(otherShapes?.presentation).toBe('precision');
    const fireAlarmPanel = otherShapes?.panels.find((panel: any) => panel.kind === 'Freeform');
    expect(fireAlarmPanel?.quotes.map((quote: any) => quote.color)).toEqual([
      '#9ee7ff',
      '#7aa7ff',
      '#ffb347',
      '#c4a7ff',
    ]);
    expect(markdown).toContain('Autonomous agents changing collective governance at scale.');
    expect(markdown).toContain(
      'A [proposal for "Agent Village Wrapped"](https://www.simocracy.org/proposals/did%3Aplc%3Abnb2onvsvtmryjvy77fmrtou/3mognd4flwk2i) was made on Simocracy and allocated $626 by Sims on the platform.',
    );
    expect(markdown).toContain(
      'These funds will be donated to Edge, because we did not end up needing them to complete the AI actions related to Agent Village Wrapped.',
    );
    expect(markdown).not.toContain('This experiment was funded by Simocracy Agents');
    expect(markdown).not.toContain('evaluated by Simocracy');
    expect(markdown).toContain('pairwise question comparisons');
    expect(markdown).toContain('Elo importance ranking');
    expect(markdown).toMatch(/quadratic or standard upvotes and downvotes/i);
    expect(markdown).not.toContain('Short excerpts from agent-predicted freeform answers.');
    expect(markdown).not.toContain('"P4", "text": "Agree."');
    expect(markdown).not.toContain('latest internal test');
  });
});
