# Public Discoverability

Context Engine is a JavaScript-heavy app, so crawler-friendly static assets are
part of the public surface. This doc covers what we expose for search engines
and AI tools, plus the fastest post-deploy crawl steps.

## Static Crawl Assets

- `client/index.html`
  - Includes root description/robots metadata, repo-linked JSON-LD seeded
    without route-specific canonical tags, and a `noscript` block with
    plain-text project summary plus direct links to the canonical GitHub repo,
    the live `main` branch source tree, `discoverability.html`, and `llms.txt`.
- `client/public/discoverability.html`
  - Static HTML summary page with direct links to the live app, repo, latest
    `main` branch source tree, README, AI agent bootstrap doc,
    architecture, and whitepaper.
- `client/public/llms.txt`
  - Plain-text summary for AI tools with the current deployment-profile model,
    the interactive `/docs` page, the canonical repo, latest-branch reference
    URLs, and safe automation guidance.
- `client/public/robots.txt`
  - Allows crawling and points bots to the sitemap.
- `client/public/sitemap.xml`
  - Lists only raw-HTML crawlable pages: `/` and `/discoverability.html`.

## Current Live GitHub Links

Current discovery source tree URL:

- `https://github.com/AgalmicSoftware/context-engine/tree/main`

If the default public branch changes, update:

1. `client/index.html`
2. `client/public/discoverability.html`
3. `client/public/llms.txt`
4. `client/src/variables/publicRepoMetadata.ts`
5. `scripts/public-discovery.test.js`

## Google Crawl Checklist

1. Deploy the updated client build so the new public files are live at `https://contextengine.sh/`.
2. In Google Search Console, add the `https://contextengine.sh/` property if it is not already verified.
3. Submit `https://contextengine.sh/sitemap.xml`.
4. Use URL Inspection and request indexing for:
   - `https://contextengine.sh/`
   - `https://contextengine.sh/discoverability.html`
5. Confirm the live raw HTML really contains the repo links:
   - `curl -s https://contextengine.sh/ | rg "AgalmicSoftware/context-engine|discoverability.html|llms.txt"`
6. Confirm the sitemap is live:
   - `curl -s https://contextengine.sh/sitemap.xml`
7. Keep SPA-only routes such as `/about` and `/docs` out of the static sitemap
   until they have distinct raw-HTML or prerendered metadata. The legacy
   `/contracts` alias redirects to `/docs` and is not a separate crawl target.

## Anthropic / AI Tool Note

Public crawlability helps web search and future discovery, but it does not force
an immediate refresh of every AI cache. If a Claude Project GitHub integration
is connected, use its manual sync control as well. When exact freshness matters,
paste the live `main` branch link or the relevant raw document URL directly.

## `llms.txt`, `agents.txt`, and `AGENTS.md`

The production website publishes `/llms.txt` as its concise orientation file
for language models and browsing agents. That file describes the product,
current architecture, authoritative references, and safe automation surfaces.

Context Engine does not currently publish `/agents.txt`. Multiple incompatible
proposals use that filename for action discovery or automated-client policy,
and the strict-policy IETF Internet-Draft expired in April 2026. Adding an
ambiguous alias would create a second contract with unclear semantics. Revisit
this decision if a stable, broadly adopted specification emerges. See the
[llms.txt proposal](https://llmstxt.org/) and the expired
[AGENTS.TXT Internet-Draft](https://datatracker.ietf.org/doc/draft-srijal-agents-policy/)
for the distinction.

Repository `AGENTS.md` files are different again: they contain contributor and
coding-agent instructions for a checked-out source tree. They are not a website
discovery manifest and should not be substituted for `/llms.txt`.

## Runtime vs canonical URLs

Canonical production-site discovery URLs stay fixed at:

- `https://contextengine.sh/discoverability.html`
- `https://contextengine.sh/llms.txt`

Use those canonical URLs when an external reference explicitly needs to point at
the production site.

Deployment-relative discovery asset URLs are emitted by `syncPublicPageHead()`
at runtime for the current deployment origin plus the configured `PUBLIC_URL`
base path. On `https://contextengine.sh/` they match the canonical URLs. On
preview hosts or subpath deployments, they resolve to that deployment instead.
