import React from 'react';
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
  'This **post** links to [Context Engine](https://contextengine.sh) and keeps `inline code`.',
  '',
  '![Two robots read papers at an outdoor table.](attachments/agent-village.png "Agent Village media example")',
  '',
  '<script>alert("no html")</script>',
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
  '        { "label": "P2", "value": 8, "confidence": 90, "color": "#7aa7ff" }',
  '      ]',
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
  '      "kind": "Binary",',
  '      "title": "Autonomy stance",',
  '      "prompt": "Would this participant allow scheduling?",',
  '      "counts": [',
  '        { "label": "agree", "value": 2 },',
  '        { "label": "disagree", "value": 1 }',
  '      ]',
  '    },',
  '    {',
  '      "kind": "Freeform",',
  '      "title": "Personal AI fire alarm",',
  '      "quotes": [',
  '        { "label": "P1", "text": "A privacy-line crossing." }',
  '      ]',
  '    }',
  '  ]',
  '}',
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
    const detailHeading = await screen.findByRole('heading', { name: 'First Post', level: 1 });
    expect(detailHeading).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'First Post', level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByText('Post')).not.toBeInTheDocument();
    expect(screen.queryByText('First summary')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'First post header graphic' }))
      .toHaveAttribute('src', '/posts/first-post/attachments/first-hero.jpeg');
    expect(screen.getByRole('img', { name: 'Two robots read papers at an outdoor table.' }))
      .toHaveAttribute('src', '/posts/first-post/attachments/agent-village.png');
    const postImageFigure = screen.getByLabelText('Preview image: Two robots read papers at an outdoor table.');
    expect(postImageFigure).toHaveAttribute('tabindex', '0');
    const fullscreenImage = postImageFigure.querySelector('span img');
    expect(fullscreenImage).toHaveAttribute('src', '/posts/first-post/attachments/agent-village.png');
    expect(fullscreenImage).toHaveAttribute('alt', '');
    expect(screen.getByText('Agent Village media example')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Context Engine' })).toHaveAttribute('href', 'https://contextengine.sh');
    expect(screen.getByText(/<script>alert\("no html"\)<\/script>/)).toBeInTheDocument();
    expect(document.querySelector('script')).not.toBeInTheDocument();
    expect(screen.getByText('Theme distribution')).toBeInTheDocument();
    expect(screen.getByText('Legible disagreement')).toBeInTheDocument();
    expect(screen.getByText('Ranked interview themes')).toBeInTheDocument();
    expect(screen.getByText('Inspectable decisions')).toBeInTheDocument();
    expect(screen.getByText('I need to know what we agreed to remember.')).toBeInTheDocument();
    expect(screen.getByText('Interview theme network')).toBeInTheDocument();
    expect(screen.getAllByText('Inspectability').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Memory').length).toBeGreaterThan(0);
    expect(screen.getByText('Rating answers')).toBeInTheDocument();
    expect(screen.getByText('AI optimism')).toBeInTheDocument();
    expect(screen.getByLabelText('P1: 3/10, 70% confidence')).toBeInTheDocument();
    expect(screen.getByText('P2 - completed')).toBeInTheDocument();
    expect(screen.queryByText(/No completed answer:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/started only/)).not.toBeInTheDocument();
    expect(screen.getByText('Other response shapes')).toBeInTheDocument();
    expect(screen.getByText('Autonomy stance')).toBeInTheDocument();
    expect(screen.getByText('Personal AI fire alarm')).toBeInTheDocument();
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

  it('renders a collapsed Markdown disclosure containing a schema', async () => {
    renderFirstPostMarkdown(
      [
        '# First Post',
        '',
        '```ce-disclosure',
        '{ "title": "Evaluation schema", "defaultOpen": false }',
        '```',
        '',
        '### Record schema',
        '',
        '```typescript',
        'type EvaluationRecord = { score: number };',
        '```',
        '',
        '```ce-disclosure-end',
        '```',
      ].join('\n'),
    );

    const summary = (await screen.findByText('Evaluation schema')).closest('summary') as HTMLElement;
    const disclosure = summary.closest('details') as HTMLElement;

    expect(disclosure).toBeInTheDocument();
    expect(disclosure).not.toHaveAttribute('open');
    expect(within(disclosure).getByRole('heading', { name: 'Record schema', level: 3 })).toBeInTheDocument();
    expect(disclosure.querySelector('code')).toHaveTextContent('type EvaluationRecord = { score: number };');
    expect(screen.queryByText('```ce-disclosure')).not.toBeInTheDocument();

    await userEvent.click(summary);
    expect(disclosure).toHaveAttribute('open');
  });

  it('renders grouped visualizations as mounted carousel slides', async () => {
    renderFirstPostMarkdown(openGroupPostMarkdown);

    await screen.findByRole('heading', { name: 'First Post', level: 1 });
    const carousel = await screen.findByTestId('ce-posts-viz-carousel');
    const slides = getCarouselSlides(carousel);

    expect(carousel).toHaveAttribute('aria-roledescription', 'carousel');
    expect(carousel).toHaveAccessibleName('Data Exploration (n=4) visualizations');
    expect(slides).toHaveLength(6);
    expect(slides.map((slide) => slide.getAttribute('aria-label'))).toEqual([
      '1 of 6: Theme distribution',
      '2 of 6: Ranked interview themes',
      '3 of 6: Interview theme network',
      '4 of 6: Rating answers',
      '5 of 6: Consensus and Difference',
      '6 of 6: Other response shapes',
    ]);
    expect(within(carousel).getByText('1 / 6')).toBeInTheDocument();
    expect(within(carousel).getByTestId('ce-posts-viz-carousel-dot-0')).toHaveAttribute('aria-current', 'true');
    expect(within(carousel).getByText('Theme distribution')).toBeInTheDocument();
    expect(within(carousel).getByText('Other response shapes')).toBeInTheDocument();
  });

  it('moves carousel state with next and previous controls', async () => {
    renderFirstPostMarkdown(openGroupPostMarkdown);

    await screen.findByRole('heading', { name: 'First Post', level: 1 });
    const carousel = await screen.findByTestId('ce-posts-viz-carousel');
    const previousButton = within(carousel).getByTestId('ce-posts-viz-carousel-prev');
    const nextButton = within(carousel).getByTestId('ce-posts-viz-carousel-next');
    const firstDot = within(carousel).getByTestId('ce-posts-viz-carousel-dot-0');
    const secondDot = within(carousel).getByTestId('ce-posts-viz-carousel-dot-1');
    const lastDot = within(carousel).getByTestId('ce-posts-viz-carousel-dot-5');

    expect(previousButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();
    expect(firstDot).toHaveAttribute('aria-current', 'true');

    await userEvent.click(nextButton);

    expect(within(carousel).getByText('2 / 6')).toBeInTheDocument();
    expect(previousButton).not.toBeDisabled();
    expect(firstDot).not.toHaveAttribute('aria-current');
    expect(secondDot).toHaveAttribute('aria-current', 'true');

    for (let index = 0; index < 4; index += 1) {
      await userEvent.click(nextButton);
    }

    expect(within(carousel).getByText('6 / 6')).toBeInTheDocument();
    expect(nextButton).toBeDisabled();
    expect(lastDot).toHaveAttribute('aria-current', 'true');

    await userEvent.click(previousButton);

    expect(within(carousel).getByText('5 / 6')).toBeInTheDocument();
    expect(nextButton).not.toBeDisabled();
  });

  it('jumps carousel state from dot controls', async () => {
    renderFirstPostMarkdown(openGroupPostMarkdown);

    await screen.findByRole('heading', { name: 'First Post', level: 1 });
    const carousel = await screen.findByTestId('ce-posts-viz-carousel');
    const firstDot = within(carousel).getByTestId('ce-posts-viz-carousel-dot-0');
    const fourthDot = within(carousel).getByTestId('ce-posts-viz-carousel-dot-3');

    await userEvent.click(fourthDot);

    expect(within(carousel).getByText('4 / 6')).toBeInTheDocument();
    expect(firstDot).not.toHaveAttribute('aria-current');
    expect(fourthDot).toHaveAttribute('aria-current', 'true');
  });

  it('handles carousel arrow keys without intercepting slide content keys', async () => {
    renderFirstPostMarkdown(openGroupPostMarkdown);

    await screen.findByRole('heading', { name: 'First Post', level: 1 });
    const carousel = await screen.findByTestId('ce-posts-viz-carousel');

    fireEvent.keyDown(carousel, { key: 'ArrowRight' });

    expect(within(carousel).getByText('2 / 6')).toBeInTheDocument();
    expect(within(carousel).getByTestId('ce-posts-viz-carousel-dot-1')).toHaveAttribute('aria-current', 'true');

    fireEvent.keyDown(screen.getByTestId('ce-posts-binary-view-list'), { key: 'ArrowRight' });

    expect(within(carousel).getByText('2 / 6')).toBeInTheDocument();
    expect(within(carousel).getByTestId('ce-posts-viz-carousel-dot-1')).toHaveAttribute('aria-current', 'true');
  });

  it('hides slide titles for hideTitle viz while keeping slide labels', async () => {
    const hideTitleMarkdown = [
      '# First Post',
      '',
      '```ce-viz-group',
      '{ "title": "Hidden Titles", "defaultOpen": true, "childrenOpen": true }',
      '```',
      '',
      '```ce-viz',
      '{',
      '  "type": "quote-wall",',
      '  "title": "Quiet quotes",',
      '  "hideTitle": true,',
      '  "quotes": [{ "label": "P1", "text": "Visible quote body." }]',
      '}',
      '```',
      '',
      '```ce-viz-group-end',
      '```',
    ].join('\n');
    renderFirstPostMarkdown(hideTitleMarkdown);

    await screen.findByRole('heading', { name: 'First Post', level: 1 });
    const carousel = await screen.findByTestId('ce-posts-viz-carousel');

    expect(within(carousel).getByText('Visible quote body.')).toBeInTheDocument();
    expect(within(carousel).queryByText('Quiet quotes')).not.toBeInTheDocument();
    expect(within(carousel).getByRole('group', { name: '1 of 1: Quiet quotes' })).toBeInTheDocument();
  });

  it('packs combineWithPrevious viz onto the previous slide with colored quote labels', async () => {
    const packedMarkdown = [
      '# First Post',
      '',
      '```ce-viz-group',
      '{ "title": "Packed", "defaultOpen": true, "childrenOpen": true }',
      '```',
      '',
      '```ce-viz',
      '{ "type": "quote-wall", "title": "Lead viz", "quotes": [{ "text": "Lead body." }] }',
      '```',
      '',
      '```ce-viz',
      '{ "type": "quote-wall", "title": "Second viz", "quotes": [{ "text": "Second body." }] }',
      '```',
      '',
      '```ce-viz',
      '{',
      '  "type": "response-type-grid",',
      '  "title": "Rider viz",',
      '  "combineWithPrevious": true,',
      '  "panels": [',
      '    {',
      '      "kind": "Freeform",',
      '      "title": "Rider panel",',
      '      "quotes": [{ "label": "P1", "text": "Rider body.", "color": "#4dffa4" }]',
      '    }',
      '  ]',
      '}',
      '```',
      '',
      '```ce-viz-group-end',
      '```',
    ].join('\n');
    renderFirstPostMarkdown(packedMarkdown);

    await screen.findByRole('heading', { name: 'First Post', level: 1 });
    const carousel = await screen.findByTestId('ce-posts-viz-carousel');

    expect(within(carousel).getByText('1 / 2')).toBeInTheDocument();
    expect(within(carousel).queryByTestId('ce-posts-viz-carousel-dot-2')).not.toBeInTheDocument();
    const packedSlide = within(carousel).getByRole('group', { name: '2 of 2: Second viz' });
    expect(within(packedSlide).getByText('Second body.')).toBeInTheDocument();
    expect(within(packedSlide).getByText('Rider body.')).toBeInTheDocument();
    const riderLabel = within(packedSlide).getByText('P1');
    expect(riderLabel).toHaveStyle({ color: '#4dffa4' });
  });

  it('renders stack-layout groups vertically without carousel controls', async () => {
    const stackMarkdown = [
      '# First Post',
      '',
      '```ce-viz-group',
      '{ "title": "Stacked", "defaultOpen": true, "layout": "stack" }',
      '```',
      '',
      '```ce-viz',
      '{ "type": "quote-wall", "title": "First section", "quotes": [{ "text": "First body." }] }',
      '```',
      '',
      '```ce-viz',
      '{ "type": "quote-wall", "title": "Quiet section", "hideTitle": true, "quotes": [{ "text": "Second body." }] }',
      '```',
      '',
      '```ce-viz-group-end',
      '```',
    ].join('\n');
    renderFirstPostMarkdown(stackMarkdown);

    await screen.findByRole('heading', { name: 'First Post', level: 1 });
    await screen.findByText('First body.');

    expect(screen.getByText('First section')).toBeInTheDocument();
    expect(screen.getByText('Second body.')).toBeInTheDocument();
    expect(screen.queryByText('Quiet section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-posts-viz-carousel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-posts-viz-carousel-prev')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-posts-viz-carousel-dot-0')).not.toBeInTheDocument();
  });

  it('pins the binary beeswarm tooltip on click until dismissed', async () => {
    const fetcher = jest
      .fn<ReturnType<PostsFetch>, Parameters<PostsFetch>>()
      .mockResolvedValueOnce(makeJsonResponse(manifest))
      .mockResolvedValueOnce(makeTextResponse(firstPostMarkdown));

    renderPostsPage(fetcher, true, ['/posts/first-post']);

    await screen.findByRole('heading', { name: 'First Post', level: 1 });
    const binaryBeeswarmSvg = await screen.findByRole('img', { name: 'Consensus and Difference' });
    expect(within(binaryBeeswarmSvg as HTMLElement).getByText('Avg. confidence')).toBeInTheDocument();
    expect(within(binaryBeeswarmSvg as HTMLElement).getByText('60')).toBeInTheDocument();
    expect(within(binaryBeeswarmSvg as HTMLElement).getByText('100')).toBeInTheDocument();
    const schedulingDot = Array.from(binaryBeeswarmSvg.querySelectorAll('[aria-label]')).find((element) =>
      element.getAttribute('aria-label')?.includes('Agents should schedule while I sleep.'),
    ) as Element;
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
    const fetcher = jest
      .fn<ReturnType<PostsFetch>, Parameters<PostsFetch>>()
      .mockResolvedValueOnce(makeJsonResponse(manifest))
      .mockResolvedValueOnce(makeTextResponse(firstPostMarkdown));

    renderPostsPage(fetcher, true, ['/posts/first-post']);

    await screen.findByRole('heading', { name: 'First Post', level: 1 });
    const p1Dot = await screen.findByLabelText('P1: 3/10, 70% confidence');
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
    const fetcher = jest
      .fn<ReturnType<PostsFetch>, Parameters<PostsFetch>>()
      .mockResolvedValueOnce(makeJsonResponse(manifest))
      .mockResolvedValueOnce(makeTextResponse(firstPostMarkdown));

    renderPostsPage(fetcher, true, ['/posts/first-post']);

    await screen.findByRole('heading', { name: 'First Post', level: 1 });
    await screen.findByTestId('ce-posts-binary-view-list');
    expect(screen.queryByTestId('ce-posts-binary-list')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('ce-posts-binary-view-list'));
    const list = screen.getByTestId('ce-posts-binary-list');
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent('Agents should ask before introductions.');
    expect(rows[1]).toHaveTextContent('Agents should schedule while I sleep.');
    expect(rows[0]).toHaveTextContent('agree 2, disagree 2');
    expect(rows[0]).toHaveTextContent('conf 88/100');
    expect(screen.queryByText('Consensus')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('ce-posts-binary-sort-confidence'));
    const confidenceRows = within(list).getAllByRole('listitem');
    expect(confidenceRows[0]).toHaveTextContent('Agents should treat messages from other agents as untrusted input.');

    expect(screen.queryByTestId('ce-posts-binary-sort-alpha')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('ce-posts-binary-view-swarm'));
    expect(screen.queryByTestId('ce-posts-binary-list')).not.toBeInTheDocument();
    expect(screen.getByText('Consensus')).toBeInTheDocument();
  });

  it('defaults the binary visualization to the list view on narrow screens', async () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: query === '(max-width: 560px)',
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    try {
      const fetcher = jest
        .fn<ReturnType<PostsFetch>, Parameters<PostsFetch>>()
        .mockResolvedValueOnce(makeJsonResponse(manifest))
        .mockResolvedValueOnce(makeTextResponse(firstPostMarkdown));

      renderPostsPage(fetcher, true, ['/posts/first-post']);

      await screen.findByRole('heading', { name: 'First Post', level: 1 });
      expect(await screen.findByTestId('ce-posts-binary-list')).toBeInTheDocument();
      expect(screen.getByTestId('ce-posts-binary-view-list')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByRole('img', { name: 'Consensus and Difference' })).not.toBeInTheDocument();
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    }
  });

  it('loads a post directly from a detail URL without showing the summary list', async () => {
    const fetcher = jest.fn<ReturnType<PostsFetch>, Parameters<PostsFetch>>()
      .mockResolvedValueOnce(makeJsonResponse(manifest))
      .mockResolvedValueOnce(makeTextResponse(firstPostMarkdown));

    renderPostsPage(fetcher, true, ['/posts/first-post']);

    expect(screen.queryByRole('heading', { name: 'Posts', level: 1 })).not.toBeInTheDocument();
    const detailHeading = await screen.findByRole('heading', { name: 'First Post', level: 1 });
    expect(detailHeading).toBeInTheDocument();
    const detailHeader = detailHeading.closest('header') as HTMLElement;
    expect(within(detailHeader).queryByText('Context Engine')).not.toBeInTheDocument();
    expect(within(detailHeader).getByText('Jul 3, 2026')).toBeInTheDocument();
    expect(within(detailHeader).getByText('analysis')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'First Post', level: 2 })).not.toBeInTheDocument();
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

  it('keeps the post hero and title inside the mobile article width', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'PostsPage.module.scss'), 'utf8');

    expect(scss).toMatch(/\.postHeader\s*{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\);/);
    expect(scss).toMatch(/\.postTitle\s*{[\s\S]*min-width:\s*0;[\s\S]*overflow-wrap:\s*anywhere;/);
    expect(scss).toMatch(/\.postMeta\s*{[\s\S]*width:\s*100%;[\s\S]*min-width:\s*0;/);
  });

  it('keeps full rating questions readable in the precision matrix', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'PostsPage.module.scss'), 'utf8');

    expect(scss).toMatch(/\.precisionQuestionText\s*{[\s\S]*font-size:\s*0\.94rem;[\s\S]*line-height:\s*1\.42;/);
  });

  it('uses green post tags in a single metadata row through tablet widths', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'PostsPage.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.tag\s*{[\s\S]*border:\s*1px solid rgba\(77, 255, 164, 0\.36\);[\s\S]*background:\s*rgba\(77, 255, 164, 0\.1\);[\s\S]*color:\s*#4dffa4;/,
    );
    expect(scss).toMatch(
      /@media \(max-width: 820px\)\s*{[\s\S]*\.postMeta\s*{[\s\S]*flex-wrap:\s*nowrap;[\s\S]*align-items:\s*center;[\s\S]*\.tagList\s*{[\s\S]*width:\s*70%;[\s\S]*max-width:\s*70%;[\s\S]*flex:\s*0 1 70%;[\s\S]*flex-wrap:\s*nowrap;[\s\S]*overflow-x:\s*auto;[\s\S]*\.postDate\s*{[\s\S]*flex:\s*0 0 auto;[\s\S]*margin-left:\s*auto;[\s\S]*text-align:\s*right;/,
    );
  });

  it('wraps every mobile tag inside the 70 percent metadata column without scrolling', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'PostsPage.module.scss'), 'utf8');

    expect(scss).toMatch(
      /@media \(max-width: 560px\)\s*{[\s\S]*\.postMeta\s*{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*flex-end;[\s\S]*\.tagList\s*{[\s\S]*width:\s*70%;[\s\S]*max-width:\s*70%;[\s\S]*flex-wrap:\s*wrap;[\s\S]*overflow-x:\s*visible;[\s\S]*\.tag\s*{[\s\S]*font-size:\s*0\.78rem;[\s\S]*\.postDate\s*{[\s\S]*align-self:\s*flex-end;/,
    );
  });

  it('places the editorial response legend beside its ring chart', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'PostsPage.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.editorialRingLayout\s*{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*minmax\(94px, 124px\) minmax\(0, 1fr\);[\s\S]*align-items:\s*center;/,
    );
  });

  it('expands precision freeform responses to use their available panel space', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'PostsPage.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.responseTypePrecisionPanel\.responseTypeFreeformPanel\s*{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*\.responseQuotes\s*{[\s\S]*flex:\s*1 1 auto;[\s\S]*grid-auto-rows:\s*minmax\(0, 1fr\);[\s\S]*\.responseQuotes figure\s*{[\s\S]*display:\s*flex;[\s\S]*justify-content:\s*center;[\s\S]*\.responseQuotes blockquote\s*{[\s\S]*font-size:\s*clamp\(1\.2rem, 2\.2cqi, 1\.55rem\);[\s\S]*line-height:\s*1\.4;/,
    );
  });

  it('uses the multichoice question size for every precision response heading', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'PostsPage.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.responseTypePrecisionPanel,[\s\S]*h4\s*{[\s\S]*font-size:\s*clamp\(1\.2rem, 2\.1cqi, 1\.55rem\);[\s\S]*line-height:\s*1\.3;/,
    );
  });

  it('keeps binary chart axis labels prominent', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'PostsPage.module.scss'), 'utf8');

    expect(scss).toMatch(/\.binaryBeeswarmYAxisLabel\s*{[\s\S]*font-size:\s*15px;/);
    expect(scss).toMatch(/\.binaryBeeswarmAxisLabel\s*{[\s\S]*font-size:\s*16px;/);
  });

  it('keeps confidence-band labels and counts readable', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'PostsPage.module.scss'), 'utf8');

    expect(scss).toMatch(/\.editorialBarMeta\s*{[\s\S]*font-size:\s*0\.94rem;[\s\S]*line-height:\s*1\.3;/);
  });

  it('keeps both editorial pie legends readable and matched', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'PostsPage.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.editorialLegendRow\s*{[\s\S]*font-size:\s*0\.94rem;[\s\S]*> span:last-child\s*{[\s\S]*font-size:\s*0\.82rem;/,
    );
    expect(scss).toMatch(
      /\.responsePieLegendItem\s*{[\s\S]*font-size:\s*0\.94rem;[\s\S]*\.responsePieLegendValue\s*{[\s\S]*> span\s*{[\s\S]*font-size:\s*0\.82rem;/,
    );
  });

  it('contains the post header image within the available viewport width', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'PostsPage.module.scss'), 'utf8');

    expect(scss).toMatch(/\.pageShell\s*{[\s\S]*max-width:\s*100%;[\s\S]*min-width:\s*0;/);
    expect(scss).toMatch(
      /\.postArticle\s*{[\s\S]*width:\s*100%;[\s\S]*max-width:\s*100%;[\s\S]*min-width:\s*0;[\s\S]*box-sizing:\s*border-box;/,
    );
    expect(scss).toMatch(
      /\.postHeroFigure\s*{[\s\S]*width:\s*100%;[\s\S]*max-width:\s*100%;[\s\S]*box-sizing:\s*border-box;/,
    );
    expect(scss).toMatch(/\.postHeroImage,[\s\S]*\.postImage\s*{[\s\S]*width:\s*100%;[\s\S]*max-width:\s*100%;/);
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
