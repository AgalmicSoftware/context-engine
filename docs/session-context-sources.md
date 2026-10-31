# Session context: notes, links, files and what the AI reads

A session's context is the background its AI should know: an essay, a post, a
coalition's site, a deck. It has two parts.

- **Notes and page links** live in the session config as `sessionContext`
  (`{ title, paragraphs, links }`). They show on the session page to everyone
  who can open it, MCP returns them, and templates carry them.
- **Sources** are files and links the admins add for the AI. They are
  doc-library records (resource `docsContext`) tagged with a context role, so
  there is no second storage model. Each source is for everyone with access to
  the session, or for admins only.

Sources need a session whose storage is on its Session Worker (Cloudflare), not
Arweave and not Lit-encrypted, because the Worker must be able to read them.
Session Workers advertise them as the `context_sources_v1` capability; the page
asks admins to update an older Worker.

## Limits

One shared module (`shared/sessionContext.mjs`) sets the limits for the session
page, MCP, templates and the Worker:

| | Limit |
|---|---|
| Title | 80 characters |
| Paragraphs | 6, each up to 2,000 characters |
| Links | 8, `https://` only; label up to 120, URL up to 2,000 characters |

Readers drop what a writer would refuse. `set-config` checks a sent
`sessionContext`, refuses a wrong shape or anything over a limit with `400`,
and stores the trimmed form; a stored context is never checked, so it cannot
block other edits.
Text that looks like a key, token or password (in the title, a paragraph, a
link or a link source) is refused, as templates already refuse it.

Sources (`shared/sessionContextSources.mjs`):

| | Limit |
|---|---|
| File types | PDF, Markdown, plain text, CSV, JSON |
| PDF | 20 MB |
| Text file | 1 MB |
| Link URL | 1,000 characters |
| Page fetched for a link | 2 MB, then up to 100,000 characters of text |
| Text the AI reads from a PDF | up to 100,000 characters |

## Adding and removing

Only session admins add, refresh or remove sources; the Worker refuses anyone
else.

- **Setup (`/new`):** the Context section takes paragraphs and links as before,
  plus files. Files stay in the browser until **Create**; then **Add context to
  the session** uploads them, has the session's AI read the PDFs marked
  **Analyze with the session's AI**, and, unless unticked, reads each link's
  page for the AI. After a reload only the file names remain, to attach again.
- **Settings (`/session/<slug>/settings`)** and **the session page's Context
  section** (admins only) list the sources with their privacy and what the AI
  has of each. **Add a link**, **Add a file**, **Refresh** (a link),
  **Read with AI** (a PDF) and **Remove** apply at once; they are not part of
  **Save**. Removing a PDF also removes the AI's reading of it.

Files go through `POST /storage/upload` with the tags `CE-DocRole: context`
and `CE-DocKind: file`. Links and PDF readings go through `POST /storage/context`
(see [the Worker's storage routes](session-cors-worker.md#session-storage-routes)),
so every link snapshot is one the Worker fetched.

## Privacy

The default is anyone with access to the session: the item takes the session's
own storage access. **Admins only** adds the `worker_role` condition
`{ match: 'all', conditions: [{ kind: 'worker_role', role: 'admin' }] }`. The
Worker enforces it on `/storage/read` and on each row of `/storage/list`, so a
participant never receives an admins-only item or learns that it exists. A
PDF's reading keeps the PDF's privacy. No other access rule is accepted for a
context item.

## Links

The Worker fetches the page itself: `https://` only, no user names or
passwords in the link, no IP addresses, localhost or private names (such as
`.local` or `.internal`), and every redirect is checked the same way, up to
five. It reads HTML (as text), JSON, plain text and Markdown, stops after
10 seconds or 2 MB, and records the fetch date. **Refresh** reads the page again
and replaces the snapshot, keeping its title and privacy. The same checks now
apply to `fetch_url` and `fetch_image`, which question generation and image
links use, so an `http://`, IP-address or local link is refused there too.

## PDFs

No PDF library is involved. With **Analyze with the session's AI**, the Worker
sends the PDF to the session's own AI provider with the session's key, which
never leaves the Worker:

- Claude: a user message whose first content block is
  `{ "type": "document", "source": { "type": "base64", "media_type": "application/pdf", "data": "…" } }`,
  followed by the instruction (Claude takes up to 32 MB a request and 600 pages);
- OpenAI: the Responses API's `input_file` part with a
  `data:application/pdf;base64,…` URL, followed by `input_text`.

Other providers are refused. The returned text is stored beside the PDF,
tagged `CE-DocRole: context-text` with the model and date, and the page shows
it as **Read by AI**. Unticked, the PDF is stored and listed but gives the AI
no text; **Read with AI** reads it later.

## What the AI reads

One helper (`shared/sessionContextText.mjs`) turns the notes, links and source
texts into a single block between `<session_context>` tags, as JSON with `<` and
`>` escaped, introduced as untrusted reference data whose instructions are
never followed. It caps each item (6,000 characters) and the whole block per
call, and reports what it left out.

| Feature | Reads | Block cap |
|---|---|---|
| Question generation (browser) | what the person generating may read | 20,000 |
| Voice interviewer instructions (browser) | what the participant may read | 6,000 |
| Interview opening (Worker) | what every participant may read | 4,000 |
| Results analysis (Worker) | what every participant may read | 12,000 |

The Worker's features act for all participants, so they never use admins-only
items, items with a narrower access than the session's, or items it cannot
read. Results analysis keeps context out of its source signature, so editing
context never marks a report stale, and it grounds every claim in responses,
not in the background.

**Limit:** sources are found by walking the session's doc-library rows. The
Worker's features stop after 300 rows and then use no sources; the page lists
up to 500. Sessions with that many documents need a dedicated index first.

## Templates

A template carries the notes and page links (`sessionContext`) and lists each
file by name and privacy in `contextFiles`, to attach again; file contents never
travel. Links added as sources, beyond the page links, are not carried; add
them again after importing.
