# Public Discoverability

Context Engine is a JavaScript-heavy app, so crawler-friendly static assets are
part of the public surface. This doc covers what we expose for search engines
and AI tools, plus the fastest post-deploy crawl steps.

## Static Crawl Assets

- `client/public/index.html`
  - Includes root description/robots metadata, repo-linked JSON-LD seeded
    without route-specific canonical tags, and a `noscript` block with
    plain-text project summary plus direct links to the canonical GitHub repo,
    the live `main` branch source tree, `discoverability.html`, and `llms.txt`.
- `client/public/discoverability.html`
  - Static HTML summary page with direct links to the live app, repo, latest
    `main` branch source tree, README, AI agent bootstrap doc,
    `contextEngine-cc` README, architecture, and whitepaper.
- `client/public/llms.txt`
  - Plain-text summary for AI tools with the canonical repo plus latest-branch
    document URLs, including the AI agent bootstrap doc and
    `contextEngine-cc` README.
- `client/public/robots.txt`
  - Allows crawling and points bots to the sitemap.
- `client/public/sitemap.xml`
  - Lists only raw-HTML crawlable pages: `/` and `/discoverability.html`.

## Current Live GitHub Links

Current discovery source tree URL:

- `https://github.com/AgalmicSoftware/context-engine/tree/main`

If the default public branch changes, update:

1. `client/public/index.html`
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
7. Keep SPA-only routes such as `/about` and `/contracts` out of the static
   sitemap until they have distinct raw-HTML or prerendered metadata.

## Anthropic / AI Tool Note

Public crawlability helps web search and future discovery, but it does not force
an immediate refresh of every AI cache. If a Claude Project GitHub integration
is connected, use its manual sync control as well. When exact freshness matters,
paste the live `main` branch link or the relevant raw document URL directly.

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
