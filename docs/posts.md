# Public Posts

The `/posts` route renders public Markdown post summaries from the repository
root `posts/` directory. Each summary opens its post at `/posts/:slug`; detail
pages include a back link to the `/posts` index. The route is enabled by default
and can be disabled at build time with:

```bash
REACT_APP_CE_ABOUT_POSTS_ENABLED=false
```

When enabled, `/about` shows a `Posts` header link. If `posts/manifest.json`
cannot be loaded, `/posts` shows a quiet unavailable state and the rest of the
app continues normally.

## Authoring

Add a Markdown file under root `posts/`, then add it to
`posts/manifest.json`:

```json
{
  "posts": [
    {
      "slug": "agent-village-wrapped",
      "title": "Agent Village Wrapped",
      "date": "2026-07-03",
      "summary": "Short listing copy.",
      "author": "Context Engine",
      "tags": ["agent evals"],
      "headerImage": {
        "src": "agent-village-wrapped/attachments/header.png",
        "alt": "Descriptive header image alt text."
      },
      "attachments": "agent-village-wrapped/attachments",
      "file": "agent-village-wrapped/agent-village-wrapped.md"
    }
  ]
}
```

The Markdown renderer supports headings, paragraphs, links, bold text, inline
code, standalone images, lists, blockquotes, code fences, horizontal rules, and
`ce-viz` fenced JSON blocks. Raw HTML is not rendered as HTML; it appears as
text.

Posts can be a single Markdown file directly under `posts/`, or a directory
with its own Markdown file, attachments, data, and supporting prompts:

```text
posts/
  agent-village-wrapped/
    agent-village-wrapped.md
    attachments/
      header.png
      example-wrapped-poster.jpeg
    diagram-prompts.md
```

Manifest paths are relative to `posts/`. Markdown image paths are relative to
the Markdown file's directory, so a post at
`posts/agent-village-wrapped/agent-village-wrapped.md` can reference its own
attachments naturally:

```markdown
![Agent Village example](attachments/example-wrapped-poster.jpeg "Optional caption")
```

`headerImage` is optional and renders above the post title on `/posts/:slug`.
`attachments` is optional metadata for the post asset directory. Markdown image
title text renders as the figure caption.

## Visualization Blocks

Posts can include visualization exhibits with fenced JSON:

````markdown
```ce-viz
{
  "type": "category-dots",
  "title": "Example themes",
  "subtitle": "Each dot represents one response.",
  "dotUnit": 1,
  "categories": [
    { "label": "Legible disagreement", "value": 18, "color": "#4dffa4" }
  ]
}
```
````

Supported types:

- `category-dots`: renders labeled dot grids from `categories`.
- `ranked-themes`: renders ordered qualitative theme cards from `items` with
  values, summaries, and optional representative quotes.
- `theme-network`: renders a compact node-link theme map from `nodes` and
  `links`.
- `quote-wall`: renders short attributed quote cards from `quotes`.

Keep post data non-identifying unless the source material is intentionally
public and licensed for publication.
