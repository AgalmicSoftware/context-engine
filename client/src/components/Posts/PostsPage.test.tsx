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
  'This **post** links to [Context Engine](https://contextengine.xyz) and keeps `inline code`.',
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
    expect(await screen.findByRole('heading', { name: 'First Post', level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'First Post', level: 1 })).not.toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: 'Context Engine' })).toHaveAttribute('href', 'https://contextengine.xyz');
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

  it('loads a post directly from a detail URL without showing the summary list', async () => {
    const fetcher = jest.fn<ReturnType<PostsFetch>, Parameters<PostsFetch>>()
      .mockResolvedValueOnce(makeJsonResponse(manifest))
      .mockResolvedValueOnce(makeTextResponse(firstPostMarkdown));

    renderPostsPage(fetcher, true, ['/posts/first-post']);

    expect(screen.queryByRole('heading', { name: 'Posts', level: 1 })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'First Post', level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'First Post', level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByText('Post')).not.toBeInTheDocument();
    expect(screen.queryByText('First summary')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Posts/i })).toHaveAttribute('href', '/posts');
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
