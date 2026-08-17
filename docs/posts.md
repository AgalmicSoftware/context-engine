# Public Posts

The `/posts` route renders public Markdown post summaries from the repository
root `posts/` directory. Each summary opens its post at `/posts/:slug`; detail
pages include a back link to the `/posts` index. The route is enabled by default
and can be disabled at build time with:

```bash
REACT_APP_CE_ABOUT_POSTS_ENABLED=false
```

The footer is the persistent navigation entry for Posts; the About hero does
not duplicate that link. If `posts/manifest.json` cannot be loaded, `/posts`
shows a quiet unavailable state and the rest of the app continues normally.

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
`ce-disclosure` and `ce-viz` fenced blocks. Raw HTML is not rendered as HTML;
it appears as text.

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
![Agent Village example](attachments/example-wrapped-poster.jpeg 'Optional caption')
```

`headerImage` is optional and renders above the post title on `/posts/:slug`.
`attachments` is optional metadata for the post asset directory. Markdown image
title text renders as the figure caption.

## Social Link Previews

Production builds generate crawler-facing HTML at both
`/posts/:slug.html` and `/posts/:slug/index.html`. These static entry points let
link-preview services read post metadata without executing the React app. The
preview uses the manifest `title` and `summary`, sets the Open Graph type to
`article`, and uses `headerImage.src` for the Open Graph and Twitter image with
a `summary_large_image` card.

Header images should therefore be compressed web assets, preferably JPEG or
WebP, rather than full-resolution working files. The Agent Village post keeps
its PNG source alongside a compressed JPEG selected by the manifest.

Non-post routes use the square Context Engine mark at
`/assets/img/context-engine-social-preview-square.png`. Individual posts replace
that default with their manifest header image.

## Disclosure Blocks

Wrap Markdown content in `ce-disclosure` markers when detailed methods, schemas,
or supporting material should remain available without dominating the article.
The opening fence accepts a JSON title and an optional `defaultOpen` boolean.
Content between the markers is parsed as normal post Markdown, including code
fences:

````markdown
```ce-disclosure
{
  "title": "Evaluation protocol and record schema",
  "defaultOpen": false
}
```

### Record schema

```typescript
type EvaluationRecord = {
  runId: string;
  score: number;
};
```

```ce-disclosure-end

```
````

Disclosure blocks cannot be nested. An opening marker without a matching end
marker contains the remaining post blocks so incomplete authoring still renders
deterministically.

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
- `beeswarm`: renders rating-scale rows from `items`; each dot carries a
  styled tooltip (hover, focus, or click to pin) and a white ring whose
  thickness scales with the prediction confidence.
- `binary-beeswarm`: renders a consensus/difference scatter from `items`
  where the y-axis maps to average confidence. All dots use one neutral color;
  the hover, focus, or pinned detail card shows the question and response
  breakdown. Dots pin their detail card on click or tap (Escape or the close
  control dismisses). A `Swarm | List` toggle switches to a sortable question
  list (most split, confidence), and narrow screens start in the List view.
- `response-type-grid`: renders mixed panels (`numbers`, `pie`, split bars,
  quote lists) from `panels`.

Visualization blocks can opt into two report-style presentations used by the
Agent Village results post:

- A `response-type-grid` with `"presentation": "editorial"` uses a restrained
  report layout. Panel `display` values can be `distribution`, `pie`, `ring`, or
  `bars`; `pie` keeps the full chart-and-legend treatment, while `ring` is the
  compact summary treatment. Bar panels may add `summaryValue` and
  `summarySuffix` for a headline statistic such as average confidence.
- A `beeswarm` with `"presentation": "precision"` uses a compact matrix with a
  full question-text column, shared response scale, participant markers, and a
  median column. Participant metadata may remain in the source JSON, but this
  presentation intentionally has no separate participant footer. A companion
  `response-type-grid` may use the same presentation to align ranked bars and
  freeform responses beneath the matrix. Precision freeform panels fill the
  available matched-column height and scale response text responsively.

Wrap related `ce-viz` blocks in a `ce-viz-group` fenced JSON block to render
them as one disclosure. `"layout"` picks the body: `"carousel"` (default) is a
left-to-right click-through carousel; `"stack"` renders the same compact
cards as a single vertical stack with no scrolling controls. `defaultOpen`
still controls whether the group disclosure starts open. `childrenOpen` is
retained for older posts and parser compatibility, but grouped child
visualizations are always visible in either layout.

A grouped `ce-viz` block may set `"hideTitle": true` to suppress its visible
header on the slide (useful when panel headings already carry the meaning).
The `title` is still required: it names the slide and its dot for assistive
technology and tooltips.

A grouped `ce-viz` block may set `"combineWithPrevious": true` to render on
the same carousel slide as the block before it (stacked below it) instead of
getting its own slide. The slide keeps the first block's title for its dot
and accessible label. The first block in a group cannot combine. The flag
only affects the carousel layout; a stack layout already renders everything
in order.

`response-type-grid` freeform quotes accept an optional `"color"` per quote;
it tints the attribution label (use participant colors to match other
visualizations).

Keep post data non-identifying unless the source material is intentionally
public and licensed for publication.
