import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { TestMemoryRouter as MemoryRouter } from 'testUtils/TestMemoryRouter';
import PostsPage from './PostsPage';
import type { PostsFetch } from './postsContent';

const makeJsonResponse = (body: unknown): Response => ({
  ok: true,
  status: 200,
  json: async () => body,
} as Response);

const makeTextResponse = (body: string): Response => ({
  ok: true,
  status: 200,
  text: async () => body,
} as Response);

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="test-location">{location.pathname}</output>;
};

const renderPostsPage = (
  fetcher: PostsFetch,
  enabled = true,
  initialEntries = ['/posts']
) => render(
  <MemoryRouter initialEntries={initialEntries}>
    <PostsPage fetcher={fetcher} enabled={enabled} />
    <LocationProbe />
  </MemoryRouter>
);

const manifest = {
  posts: [
    {
      slug: 'first-post',
      title: 'First Post',
      date: '2026-07-03',
      summary: 'First summary',
      author: 'Context Engine',
      tags: ['analysis', 'viz'],
      headerImage: {
        src: 'first-post/attachments/first-hero.jpeg',
        alt: 'First post header graphic',
      },
      file: 'first-post/index.md',
    },
    {
      slug: 'second-post',
      title: 'Second Post',
      date: '2026-07-01',
      summary: 'Second summary',
      file: 'second-post.md',
    },
  ],
};

const firstPostMarkdown = [
  '# First Post',
  '',
  'This **post** links to [Context Engine](https://contextengine.xyz) and keeps `inline code`.',
  '',
  '![Two robots read papers at an outdoor table.](attachments/agent-village.png "Agent Village media example")',
  '',
  '<script>alert("no html")</script>',
  '',
  '```ce-viz-group',
  '{',
  '  "title": "Data Exploration (n=4)",',
  '  "defaultOpen": false,',
  '  "childrenOpen": false',
  '}',
  '```',
  '',
  '```ce-viz',
  '{',
  '  "type": "category-dots",',
  '  "title": "Theme distribution",',
  '  "dotUnit": 2,',
  '  "categories": [',
  '    { "label": "Legible disagreement", "value": 4, "detail": "Two visible dots." },',
  '    { "label": "Source-grounded summaries", "value": 2 }',
  '  ]',
  '}',
  '```',
  '',
  '```ce-viz',
  '{',
  '  "type": "ranked-themes",',
  '  "title": "Ranked interview themes",',
  '  "items": [',
  '    {',
  '      "rank": "01",',
  '      "label": "Inspectable decisions",',
  '      "value": 28.4,',
  '      "summary": "Decision records should keep evidence visible.",',
  '      "quote": "I need to know what we agreed to remember.",',
  '      "source": "Participant C"',
  '    }',
  '  ]',
  '}',
  '```',
  '',
  '```ce-viz',
  '{',
  '  "type": "theme-network",',
  '  "title": "Interview theme network",',
  '  "nodes": [',
  '    { "id": "inspect", "label": "Inspectability", "value": 32, "x": 24, "y": 28 },',
  '    { "id": "memory", "label": "Memory", "value": 18, "x": 64, "y": 36 }',
  '  ],',
  '  "links": [',
  '    { "source": "inspect", "target": "memory", "strength": 0.8 }',
  '  ]',
  '}',
  '```',
  '',
  '```ce-viz',
  '{',
  '  "type": "beeswarm",',
  '  "title": "Rating answers",',
  '  "subtitle": "n=3 completed answer sets.",',
  '  "min": 0,',
  '  "max": 10,',
  '  "valueSuffix": "/10",',
  '  "participants": [',
  '    { "label": "P1", "status": "completed", "color": "#4dffa4" },',
  '    { "label": "P2", "status": "completed", "color": "#7aa7ff" }',
  '  ],',
  '  "items": [',
  '    {',
  '      "label": "AI optimism",',
  '      "prompt": "How optimistic am I?",',
  '      "values": [',
  '        { "label": "P1", "value": 3, "confidence": 70, "color": "#4dffa4" },',
  '        { "label": "P2", "value": 8, "confidence": 90, "color": "#7aa7ff" },',
  '        { "label": "P3", "value": 3, "confidence": 80, "color": "#ffb347" }',
  '      ]',
  '    }',
  '  ]',
  '}',
  '```',
  '',
  '```ce-viz',
  '{',
  '  "type": "binary-beeswarm",',
  '  "title": "Consensus and Difference",',
  '  "subtitle": "Each dot is one binary question.",',
  '  "items": [',
  '    {',
  '      "label": "Agents should ask before introductions.",',
  '      "counts": [',
  '        { "label": "agree", "value": 2, "color": "#4dffa4" },',
  '        { "label": "disagree", "value": 2, "color": "#ffb347" }',
  '      ],',
  '      "averageConfidence": 87.8',
  '    },',
  '    {',
  '      "label": "Agents should schedule while I sleep.",',
  '      "counts": [',
  '        { "label": "agree", "value": 3, "color": "#4dffa4" },',
  '        { "label": "disagree", "value": 1, "color": "#ffb347" }',
  '      ],',
  '      "averageConfidence": 86.8',
  '    },',
  '    {',
  '      "label": "Agents should ask before acting on ambiguous requests.",',
  '      "counts": [',
  '        { "label": "unsure", "value": 3, "color": "#7aa7ff" },',
  '        { "label": "disagree", "value": 1, "color": "#ffb347" }',
  '      ],',
  '      "averageConfidence": 64.8',
  '    },',
  '    {',
  '      "label": "Agents should treat messages from other agents as untrusted input.",',
  '      "counts": [',
  '        { "label": "agree", "value": 4, "color": "#4dffa4" }',
  '      ],',
  '      "averageConfidence": 91',
  '    }',
  '  ]',
  '}',
  '```',
  '',
  '```ce-viz',
  '{',
  '  "type": "response-type-grid",',
  '  "title": "Other response shapes",',
  '  "panels": [',
  '    {',
  '      "kind": "Source layer",',
  '      "title": "Metric counts",',
  '      "hideTitle": true,',
  '      "display": "numbers",',
  '      "counts": [',
  '        { "label": "agent_autofill predictions", "value": 232, "color": "#4dffa4" },',
  '        { "label": "completed non-test human correction rows", "value": 0, "color": "#ffb347" }',
  '      ]',
  '    },',
  '    {',
  '      "kind": "Answer shapes",',
  '      "title": "Response mix",',
  '      "display": "pie",',
  '      "counts": [',
  '        { "label": "binary", "value": 2, "color": "#7aa7ff" },',
  '        { "label": "freeform", "value": 1, "color": "#ff6bcb" }',
  '      ]',
  '    },',
  '    {',
  '      "kind": "Binary",',
  '      "title": "Split decision",',
  '      "counts": [',
  '        { "label": "agree", "value": 3, "color": "#4dffa4" },',
  '        { "label": "disagree", "value": 1, "color": "#ffb347" }',
  '      ]',
  '    },',
  '    {',
  '      "kind": "Binary",',
  '      "title": "Open-source AI safety",',
  '      "prompt": "Open-source AI models are more likely to make the world safer than more dangerous.",',
  '      "counts": [',
  '        { "label": "agree", "value": 3, "color": "#4dffa4" },',
  '        { "label": "unsure", "value": 1, "color": "#7aa7ff" }',
  '      ]',
  '    },',
  '    {',
  '      "kind": "Binary",',
  '      "title": "Would this participant allow scheduling?",',
  '      "counts": [',
  '        { "label": "agree", "value": 2 },',
  '        { "label": "disagree", "value": 1 },',
  '        { "label": "human corrections", "value": 0 }',
  '      ]',
  '    },',
  '    {',
  '      "kind": "Freeform",',
  '      "title": "In one sentence: what is my personal AI fire alarm?",',
  '      "quotes": [',
  '        { "label": "P1", "text": "A privacy-line crossing." }',
  '      ]',
  '    }',
  '  ]',
  '}',
  '```',
  '',
  '```ce-viz-group-end',
  '```',
  '',
  '```ce-viz',
  '{',
  '  "type": "quote-wall",',
  '  "title": "Respondent notes",',
  '  "quotes": [',
  '    { "text": "Show the structure without hiding the source.", "label": "Participant A" }',
  '  ]',
  '}',
  '```',
].join('\n');

describe('PostsPage', () => {
  it('loads the root posts manifest as summary links without rendering a post body', async () => {
    const fetcher = jest.fn<ReturnType<PostsFetch>, Parameters<PostsFetch>>()
      .mockResolvedValueOnce(makeJsonResponse(manifest));

    renderPostsPage(fetcher);

    const pageHeading = await screen.findByRole('heading', { name: 'Posts', level: 1 });
    const pageHeader = pageHeading.closest('header') as HTMLElement;
    expect(pageHeader).toBeInTheDocument();
    expect(within(pageHeader).queryByText('Context Engine')).not.toBeInTheDocument();
    expect(within(pageHeader).queryByText(/Notes and public exhibits/i)).not.toBeInTheDocument();
    expect(within(pageHeader).queryByRole('link', { name: 'About' })).not.toBeInTheDocument();
    const firstPostLink = await screen.findByRole('link', { name: /First Post/i });
    expect(firstPostLink).toHaveAttribute('href', '/posts/first-post');
    expect(firstPostLink.querySelector('img')).toHaveAttribute('src', '/posts/first-post/attachments/first-hero.jpeg');
    expect(screen.getByText('First summary')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'First Post', level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByText('Theme distribution')).not.toBeInTheDocument();
    expect(screen.getByTestId('test-location')).toHaveTextContent('/posts');
    expect(fetcher).toHaveBeenCalledWith('/posts/manifest.json', expect.objectContaining({
      headers: { accept: 'application/json' },
      cache: 'no-store',
    }));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('opens a post URL from the summary list and returns to the posts index', async () => {
    const fetcher = jest.fn<ReturnType<PostsFetch>, Parameters<PostsFetch>>()
      .mockResolvedValueOnce(makeJsonResponse(manifest))
      .mockResolvedValueOnce(makeTextResponse(firstPostMarkdown));

    renderPostsPage(fetcher);

    await userEvent.click(await screen.findByRole('link', { name: /First Post/i }));

    expect(screen.getByTestId('test-location')).toHaveTextContent('/posts/first-post');
    expect(screen.queryByRole('heading', { name: 'Posts', level: 1 })).not.toBeInTheDocument();
    const detailHeading = await screen.findByRole('heading', { name: 'First Post', level: 2 });
    expect(detailHeading).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'First Post', level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByText('Post')).not.toBeInTheDocument();
    expect(screen.queryByText('First summary')).not.toBeInTheDocument();
    const detailHeader = detailHeading.closest('header') as HTMLElement;
    expect(within(detailHeader).queryByText('Context Engine')).not.toBeInTheDocument();
    const detailDate = within(detailHeader).getByText('Jul 3, 2026');
    const tagAnalysis = within(detailHeader).getByText('analysis');
    const tagViz = within(detailHeader).getByText('viz');
    const metaRow = detailDate.parentElement as HTMLElement;
    expect(metaRow).toContainElement(tagAnalysis);
    expect(metaRow).toContainElement(tagViz);
    expect(tagAnalysis.compareDocumentPosition(detailDate) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tagViz.compareDocumentPosition(detailDate) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('img', { name: 'First post header graphic' }))
      .toHaveAttribute('src', '/posts/first-post/attachments/first-hero.jpeg');
    expect(screen.getByRole('img', { name: 'Two robots read papers at an outdoor table.' }))
      .toHaveAttribute('src', '/posts/first-post/attachments/agent-village.png');
    const postImageButton = screen.getByRole('button', {
      name: 'Open image preview: Two robots read papers at an outdoor table.',
    });
    expect(screen.queryByRole('button', { name: 'Close image preview' })).not.toBeInTheDocument();
    await userEvent.click(postImageButton);
    const closePreviewButton = screen.getByRole('button', { name: 'Close image preview' });
    const fullscreenImage = closePreviewButton.querySelector('img');
    expect(fullscreenImage).toHaveAttribute('src', '/posts/first-post/attachments/agent-village.png');
    expect(fullscreenImage).toHaveAttribute('alt', '');
    await userEvent.click(closePreviewButton);
    expect(screen.queryByRole('button', { name: 'Close image preview' })).not.toBeInTheDocument();
    expect(screen.getByText('Agent Village media example')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Context Engine' })).toHaveAttribute('href', 'https://contextengine.xyz');
    expect(screen.getByText(/<script>alert\("no html"\)<\/script>/)).toBeInTheDocument();
    expect(document.querySelector('script')).not.toBeInTheDocument();
    const dataExploration = screen.getByText('Data Exploration (n=4)').closest('details') as HTMLElement;
    expect(dataExploration).toBeInTheDocument();
    expect(dataExploration).not.toHaveAttribute('open');
    expect(within(dataExploration).getByText('Theme distribution')).toBeInTheDocument();
    expect(within(dataExploration).getByText('Other response shapes')).toBeInTheDocument();
    expect(within(dataExploration).queryByText('Respondent notes')).not.toBeInTheDocument();
    const nestedBinaryBeeswarm = within(dataExploration).getByText('Consensus and Difference').closest('details') as HTMLElement;
    expect(nestedBinaryBeeswarm).toBeInTheDocument();
    expect(nestedBinaryBeeswarm).not.toHaveAttribute('open');
    expect(screen.getByText('Theme distribution')).toBeInTheDocument();
    const themeSummary = screen.getByText('Theme distribution').closest('summary') as HTMLElement;
    expect(themeSummary).toBeInTheDocument();
    expect(themeSummary.querySelector('[data-icon="caret-up"]')).toBeInTheDocument();
    expect(screen.queryByText('Toggle')).not.toBeInTheDocument();
    expect(screen.getByText('Legible disagreement')).toBeInTheDocument();
    expect(screen.getByText('4')).toHaveStyle({ color: '#4dffa4' });
    expect(screen.getByText('Ranked interview themes')).toBeInTheDocument();
    expect(screen.getByText('Inspectable decisions')).toBeInTheDocument();
    expect(screen.getByText('I need to know what we agreed to remember.')).toBeInTheDocument();
    expect(screen.getByText('Interview theme network')).toBeInTheDocument();
    expect(screen.getAllByText('Inspectability').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Memory').length).toBeGreaterThan(0);
    expect(screen.getByText('Rating answers')).toBeInTheDocument();
    expect(screen.getByText('AI optimism')).toBeInTheDocument();
    const p1Rating = screen.getByLabelText('P1: 3/10, 70% confidence');
    const p3Rating = screen.getByLabelText('P3: 3/10, 80% confidence');
    expect(p1Rating).toBeInTheDocument();
    expect(p3Rating).toBeInTheDocument();
    expect(p1Rating.style.left).not.toEqual(p3Rating.style.left);
    expect(p1Rating.style.top).not.toEqual(p3Rating.style.top);
    expect(screen.queryByLabelText('Participant legend')).not.toBeInTheDocument();
    expect(screen.queryByText('P2 - completed')).not.toBeInTheDocument();
    expect(screen.queryByText(/No completed answer:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/started only/)).not.toBeInTheDocument();
    expect(screen.getByText('Consensus and Difference')).toBeInTheDocument();
    const binaryBeeswarmSvg = screen.getByRole('img', { name: 'Consensus and Difference' });
    expect(binaryBeeswarmSvg).toBeInTheDocument();
    expect(screen.getByText('Consensus')).toBeInTheDocument();
    expect(screen.getByText('Difference')).toBeInTheDocument();
    expect(screen.queryByText('2-2 split')).not.toBeInTheDocument();
    expect(screen.queryByText('3-1 split')).not.toBeInTheDocument();
    expect(binaryBeeswarmSvg.querySelector('circle[fill="#ff6bcb"]')).toBeInTheDocument();
    expect(binaryBeeswarmSvg.querySelector('circle[fill="#4dffa4"]')).toBeInTheDocument();
    expect(binaryBeeswarmSvg.querySelector('circle[fill="#ffd166"]')).toBeInTheDocument();
    const schedulingDot = Array.from(binaryBeeswarmSvg.querySelectorAll('[aria-label]')).find((element) => (
      element.getAttribute('aria-label')?.includes('Agents should schedule while I sleep.')
    )) as Element;
    expect(schedulingDot).toBeInTheDocument();
    await userEvent.hover(schedulingDot);
    const binaryTooltip = await screen.findByRole('tooltip');
    expect(within(binaryTooltip).getByText('Agents should schedule while I sleep.')).toBeInTheDocument();
    expect(within(binaryTooltip).getByText('agree 3, disagree 1')).toBeInTheDocument();
    expect(within(binaryTooltip).getByText('Average confidence: 87/100')).toBeInTheDocument();
    await userEvent.unhover(schedulingDot);
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    expect(screen.getByText('Other response shapes')).toBeInTheDocument();
    expect(screen.queryByText('Source layer')).not.toBeInTheDocument();
    expect(screen.queryByText('Binary')).not.toBeInTheDocument();
    expect(screen.queryByText('Freeform')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Metric counts', level: 4 })).not.toBeInTheDocument();
    const metricPanel = screen.getByText('agent_autofill predictions').closest('article') as HTMLElement;
    expect(within(metricPanel).getByText('agent_autofill predictions')).toBeInTheDocument();
    expect(within(metricPanel).getByText('232')).toHaveStyle({ color: '#4dffa4' });
    expect(screen.queryByLabelText('agent_autofill predictions: 232')).not.toBeInTheDocument();
    const responseMixPanel = screen.getByText('Response mix').closest('article') as HTMLElement;
    expect(within(responseMixPanel).getByRole('img', { name: 'Response mix: binary 2, freeform 1' }))
      .toBeInTheDocument();
    expect(within(responseMixPanel).getByText('3 total')).toBeInTheDocument();
    expect(screen.queryByLabelText('binary: 2')).not.toBeInTheDocument();
    const splitPanel = screen.getByText('Split decision').closest('article') as HTMLElement;
    const splitBar = within(splitPanel).getByRole('img', { name: 'Split decision: agree 3, disagree 1' });
    expect(splitBar).toBeInTheDocument();
    const splitSegments = splitBar.querySelectorAll('span');
    expect(splitSegments[0]).toHaveStyle({ width: '75%', backgroundColor: '#4dffa4' });
    expect(splitSegments[1]).toHaveStyle({ width: '25%', backgroundColor: '#ff6b6b' });
    expect(within(splitPanel).queryByLabelText('agree: 3')).not.toBeInTheDocument();
    expect(screen.queryByText('Open-source AI safety')).not.toBeInTheDocument();
    const questionTitle = screen.getByText('Open-source AI models are more likely to make the world safer than more dangerous.');
    expect(questionTitle.tagName).toBe('H4');
    const unsureSplitPanel = questionTitle.closest('article') as HTMLElement;
    expect(within(unsureSplitPanel).queryByText('Open-source AI safety')).not.toBeInTheDocument();
    expect(within(unsureSplitPanel).queryByText('Open-source AI models are more likely to make the world safer than more dangerous.', {
      selector: 'p',
    })).not.toBeInTheDocument();
    const unsureSplitBar = within(unsureSplitPanel).getByRole('img', {
      name: 'Open-source AI models are more likely to make the world safer than more dangerous.: agree 3, unsure 1',
    });
    const unsureSplitSegments = unsureSplitBar.querySelectorAll('span');
    expect(unsureSplitSegments[0]).toHaveStyle({ width: '75%', backgroundColor: '#4dffa4' });
    expect(unsureSplitSegments[1]).toHaveStyle({ width: '25%', backgroundColor: '#ffd166' });
    expect(screen.getByText('Would this participant allow scheduling?')).toBeInTheDocument();
    expect(screen.getByLabelText('human corrections: 0').querySelector('span')).toHaveStyle({ width: '0%' });
    expect(screen.getByText('In one sentence: what is my personal AI fire alarm?')).toBeInTheDocument();
    expect(screen.getByText('A privacy-line crossing.')).toBeInTheDocument();
    expect(screen.getByText('Respondent notes')).toBeInTheDocument();
    expect(screen.getByText('Show the structure without hiding the source.')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith('/posts/first-post/index.md', expect.objectContaining({
      headers: { accept: 'text/markdown,text/plain' },
      cache: 'no-store',
    }));

    await userEvent.click(screen.getByRole('link', { name: /Posts/i }));

    expect(screen.getByTestId('test-location')).toHaveTextContent('/posts');
    expect(await screen.findByRole('heading', { name: 'Posts', level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /First Post/i })).toBeInTheDocument();
    expect(screen.getByText('First summary')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'First Post', level: 2 })).not.toBeInTheDocument();
  });

  it('pins the binary beeswarm tooltip on click until dismissed', async () => {
    const fetcher = jest.fn<ReturnType<PostsFetch>, Parameters<PostsFetch>>()
      .mockResolvedValueOnce(makeJsonResponse(manifest))
      .mockResolvedValueOnce(makeTextResponse(firstPostMarkdown));

    renderPostsPage(fetcher, true, ['/posts/first-post']);

    await screen.findByRole('heading', { name: 'First Post', level: 2 });
    const binaryBeeswarmSvg = screen.getByRole('img', { name: 'Consensus and Difference' });
    expect(within(binaryBeeswarmSvg as HTMLElement).getByText('Avg. confidence')).toBeInTheDocument();
    expect(within(binaryBeeswarmSvg as HTMLElement).getByText('60')).toBeInTheDocument();
    expect(within(binaryBeeswarmSvg as HTMLElement).getByText('100')).toBeInTheDocument();
    const schedulingDot = Array.from(binaryBeeswarmSvg.querySelectorAll('[aria-label]')).find((element) => (
      element.getAttribute('aria-label')?.includes('Agents should schedule while I sleep.')
    )) as Element;
    expect(schedulingDot).toBeInTheDocument();

    await userEvent.click(schedulingDot);
    await userEvent.unhover(schedulingDot);
    const pinnedTooltip = await screen.findByRole('tooltip');
    expect(within(pinnedTooltip).getByText('Agents should schedule while I sleep.')).toBeInTheDocument();
    expect(within(pinnedTooltip).getByText('agree 3, disagree 1')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());

    await userEvent.click(schedulingDot);
    await userEvent.unhover(schedulingDot);
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close question details' }));
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });

  it('pins rating beeswarm dot details on click', async () => {
    const fetcher = jest.fn<ReturnType<PostsFetch>, Parameters<PostsFetch>>()
      .mockResolvedValueOnce(makeJsonResponse(manifest))
      .mockResolvedValueOnce(makeTextResponse(firstPostMarkdown));

    renderPostsPage(fetcher, true, ['/posts/first-post']);

    await screen.findByRole('heading', { name: 'First Post', level: 2 });
    const p1Dot = screen.getByLabelText('P1: 3/10, 70% confidence');
    const ratingCard = p1Dot.closest('section') as HTMLElement;

    await userEvent.click(p1Dot);
    await userEvent.unhover(p1Dot);
    const tooltip = await within(ratingCard).findByRole('tooltip');
    expect(within(tooltip).getByText('P1: 3/10')).toBeInTheDocument();
    expect(within(tooltip).getByText('Confidence: 70/100')).toBeInTheDocument();

    await userEvent.click(within(tooltip).getByRole('button', { name: 'Close rating details' }));
    await waitFor(() => expect(within(ratingCard).queryByRole('tooltip')).not.toBeInTheDocument());
  });

  it('switches the binary beeswarm to a sortable list view', async () => {
    const fetcher = jest.fn<ReturnType<PostsFetch>, Parameters<PostsFetch>>()
      .mockResolvedValueOnce(makeJsonResponse(manifest))
      .mockResolvedValueOnce(makeTextResponse(firstPostMarkdown));

    renderPostsPage(fetcher, true, ['/posts/first-post']);

    await screen.findByRole('heading', { name: 'First Post', level: 2 });
    expect(screen.queryByTestId('ce-posts-binary-list')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('ce-posts-binary-view-list'));
    const list = screen.getByTestId('ce-posts-binary-list');
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('Agents should ask before introductions.');
    expect(rows[1]).toHaveTextContent('Agents should schedule while I sleep.');
    expect(rows[0]).toHaveTextContent('agree 2, disagree 2');
    expect(rows[0]).toHaveTextContent('conf 88/100');
    expect(screen.queryByText('Consensus')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('ce-posts-binary-sort-confidence'));
    const confidenceRows = within(list).getAllByRole('listitem');
    expect(confidenceRows[0]).toHaveTextContent(
      'Agents should treat messages from other agents as untrusted input.'
    );

    await userEvent.click(screen.getByTestId('ce-posts-binary-sort-alpha'));
    const alphaRows = within(list).getAllByRole('listitem');
    expect(alphaRows[0]).toHaveTextContent('Agents should ask before acting on ambiguous requests.');

    await userEvent.click(screen.getByTestId('ce-posts-binary-view-swarm'));
    expect(screen.queryByTestId('ce-posts-binary-list')).not.toBeInTheDocument();
    expect(screen.getByText('Consensus')).toBeInTheDocument();
  });

  it('loads a post directly from a detail URL without showing the summary list', async () => {
    const fetcher = jest.fn<ReturnType<PostsFetch>, Parameters<PostsFetch>>()
      .mockResolvedValueOnce(makeJsonResponse(manifest))
      .mockResolvedValueOnce(makeTextResponse(firstPostMarkdown));

    renderPostsPage(fetcher, true, ['/posts/first-post']);

    expect(screen.queryByRole('heading', { name: 'Posts', level: 1 })).not.toBeInTheDocument();
    const detailHeading = await screen.findByRole('heading', { name: 'First Post', level: 2 });
    expect(detailHeading).toBeInTheDocument();
    const detailHeader = detailHeading.closest('header') as HTMLElement;
    expect(within(detailHeader).queryByText('Context Engine')).not.toBeInTheDocument();
    expect(within(detailHeader).getByText('Jul 3, 2026')).toBeInTheDocument();
    expect(within(detailHeader).getByText('analysis')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'First Post', level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByText('Post')).not.toBeInTheDocument();
    expect(screen.queryByText('First summary')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Posts/i })).toHaveAttribute('href', '/posts');
  });

  it('keeps the detail back link 50 percent larger than the prior post scale', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'PostsPage.module.scss'), 'utf8');

    expect(scss).toMatch(/\.backLink\s*{[\s\S]*font-size:\s*1\.74rem;/);
  });

  it('keeps markdown bold callouts brighter than body copy', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'PostsPage.module.scss'), 'utf8');

    expect(scss).toMatch(/\.postParagraph\s*{[\s\S]*strong\s*{[\s\S]*color:\s*\$text;/);
  });

  it('keeps the post date aligned to the right of post tags', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'PostsPage.module.scss'), 'utf8');

    expect(scss).toMatch(/\.postDate\s*{[\s\S]*margin-left:\s*auto;/);
    expect(scss).toMatch(/\.tagList\s*{[\s\S]*flex:\s*1 1 auto;/);
  });

  it('does not fetch posts when the config disables the page', async () => {
    const fetcher = jest.fn<ReturnType<PostsFetch>, Parameters<PostsFetch>>();

    renderPostsPage(fetcher, false);

    expect(screen.getByText(/Posts are disabled for this deployment/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(fetcher).not.toHaveBeenCalled();
    });
  });

  it('shows a quiet unavailable state when the manifest fetch fails', async () => {
    const fetcher = jest.fn<ReturnType<PostsFetch>, Parameters<PostsFetch>>()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) } as Response);

    renderPostsPage(fetcher);

    const status = await screen.findByText('Posts unavailable');
    expect(status).toBeInTheDocument();
    expect(within(status.closest('section') as HTMLElement).getByText(/rest of Context Engine is unaffected/i))
      .toBeInTheDocument();
  });
});
