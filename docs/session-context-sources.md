# Session context: notes, links, files and what the AI reads

A session's context is the background its AI should know: an essay, a post, a
coalition's site, a deck. It has two parts.

- **Notes and page links** live in the session config as `sessionContext`
  (`{ title, paragraphs, links }`). They show on the session page to everyone
  who can open it, MCP returns them, and templates carry them.
- **Sources** are files and links added for the AI. They are doc-library
  records (resource `docsContext`) tagged with a context role, so there is no
  second storage model. Each source is for everyone with access to the session,
  for the members of some of its groups (any one of them is enough), or for
  admins only. Wherever a file is added, its **Visible to** dropdown chooses.

Sources need a session whose storage is on its Session Worker (Cloudflare), not
Arweave and not Lit-encrypted, because the Worker must be able to read them.
Session Workers advertise them as the `context_sources_v1` capability; the page
asks admins to update an older Worker. Workers that also let participants add
files advertise `participant_context_v1`, and those that let them add links too
advertise `participant_context_links_v1`. Workers that lock a link to some groups,
as a file is locked, advertise `context_link_groups_v1`.

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
link or a link source) is refused, as templates already refuse it. That covers
provider keys and tokens (Stripe, Hugging Face and Telegram bot tokens among
them), RPC links that carry a provider key (Alchemy `/v2/`, Infura `/v3/`),
private keys, bearer tokens, and credentials or keys in a link (`user:pass@`,
`?key=`, `?token=`). 64 hex digits outside a link have a private key's shape,
so they are refused too; to cite a transaction, link to it in a block explorer,
where the hash in the link's path is fine. Page names and IDs in a link's path,
as in Wikipedia and Notion links, are not mistaken for tokens.

Sources (`shared/sessionContextSources.mjs`):

| | Limit |
|---|---|
| File types | PDF; Markdown, plain text, CSV, JSON; PNG, JPEG and WebP images where [cards](#cards) are on |
| PDF | 20 MB |
| Image | 5 MB |
| Text file | 1 MB |
| Link URL | 1,000 characters |
| Page fetched for a link | 2 MB, then up to 100,000 characters of text |
| Text the AI reads from a PDF or image | up to 100,000 characters |

## Adding and removing

Anyone signed in to the session may add a file or a link, unless an admin sets
**Who can add files** to **Admins only** in Settings (`contextAdditionPolicy`,
which is `participants` when unset). The Worker checks that again when each
item publishes. Once the session has ended it takes no more from participants.
Everyone's links follow the same link rules (below). A participant's link also
needs their `fetch` scope, as `fetch_url` does, and counts against the
session's per-address daily limit (`limits.perWalletPerDay`), when it sets one,
for fetches as well as for storage. The Worker checks all this, and that
whoever adds a link may add files to the session, before it fetches the page.
Each source shows who added it, and a refreshed link keeps its adder. Whoever
added a file or link may remove it, and admins may remove any source. Only admins refresh links
and have the AI read a file again, because those make the Worker fetch a page again or
spend the session's AI key on an item already there; the Worker refuses anyone
else. Where the session has [cards](#cards) on, whoever added a PDF or image
may have the AI read it once (see [PDFs and images](#pdfs-and-images)).

- **Setup (`/new`):** the Context section takes paragraphs, links and files.
  Its **Context cards** tick box, off to start, makes the session with
  [cards](#cards) on; ticked, the file picker there takes images too.
  Files stay in the browser until **Create**; then **Add context to
  the session** uploads them, has the session's AI read the PDFs marked
  **Analyze with the session's AI**, and, unless unticked, reads each link's
  page for the AI. After a reload only the file names remain, to attach again.
- **The session page's Context section**, when open, has **Add** and **View** in
  its header, as the Tool Explorer does. **Add** opens a form to add a file, with
  who can read it, and a link where the Worker takes participants' links, for
  someone signed in, or **Manage files and links** for an admin; **Remove** sits
  beside their own items. Its first list asks someone
  signed in to sign in to the session if their browser holds no Worker token
  yet, as in a new tab. Declined, it shows what a signed-out visitor sees.
  Where visitors can see the session's groups, **View** then signs them in to
  show their groups' files. It refreshes without asking when a token or a new
  group membership arrives, and reading the files' text for an AI never asks.
- **A Group Conversation's** **Add transcript to context** box, beside **Submit
  questions**, uploads the transcript as a text file when the questions submit.
- **Settings (`/session/<slug>/settings`)** and **the session page's Context
  section** (for admins) list the sources with their privacy and what the AI
  has of each. **Add a link**, **Add a file**, **Refresh** (a link),
  **Read with AI** (a PDF or image) and **Remove** apply at once; they are not part of
  **Save**. Removing a file also removes the AI's reading of it.

Files go through `POST /storage/upload` with the tags `CE-DocRole: context`
and `CE-DocKind: file`. Links and the AI's readings go through `POST /storage/context`
(see [the Worker's storage routes](session-cors-worker.md#session-storage-routes)),
so every link snapshot is one the Worker fetched.

**Who added it.** The Worker records each item's uploader as `addedBy`. An AI
agent may mark an item as its own: the tags `CE-AdderKind: agent` and
`CE-AdderName: <its display name>` on a file, or `adder: "agent"` and
`adderName` with a link. The list then shows "<name> (agent)", or the agent's
short address with "(agent)" when it gave no name. The mark is self-declared,
so it is only a label and nothing reads it for access. The Worker accepts the
value `agent` alone, at most once, and only beside it a name of up to 80
characters of plain text, without control characters or the marks that reorder
text. A refreshed link keeps its mark. The Context Engine MCP marks everything
an agent adds.

## Privacy

The default is anyone with access to the session: the item takes the session's
own storage access. **Admins only** adds the `worker_role` condition
`{ match: 'all', conditions: [{ kind: 'worker_role', role: 'admin' }] }`. Locking
a file to a group adds `{ match: 'any', conditions: [{ kind: 'worker_role', role:
'admin' }, { kind: 'worker_group', groupIds: ['<group>'] }] }`, so its members
read it, and admins, who may have to remove it. The Worker enforces both on
`/storage/read` and on each row of `/storage/list`, so anyone else never receives
the item or learns that it exists. Someone can lock a file to a group they are
not in, and then can't read it themselves. A PDF's reading keeps the PDF's
privacy. No other access rule is accepted for a context item. Groups don't travel
between sessions, so a template lists a locked file as admins only. The Worker's own AI
features act for participants, so they use neither admins-only nor group-locked
items, with one exception: the Session Agent's Detailed answers read a
group-locked item for an asker who may read it. An AI that runs in someone's
browser uses what that person may read.

## Links

The Worker fetches the page itself: `https://` only, no user names or
passwords in the link, no IP addresses, localhost or private names (such as
`.local` or `.internal`), and every redirect is checked the same way, up to
five. It reads HTML (as text), JSON, plain text and Markdown, stops after
10 seconds or 2 MB, and records the fetch date. **Refresh** reads the same page
again and replaces the snapshot, keeping its title, privacy and who added it. The
old record is removed through the session coordinator; if that fails, the new
snapshot is withdrawn and the link stays as it was. The same checks
apply to `fetch_url` and `fetch_image`, which question generation and image
links use, so an `http://`, IP-address or local link is refused there too.

## PDFs and images

A PDF or an image has no text of its own, so what the AI is given of it is the
session's AI's **reading** of it. No PDF or image library is involved. With
**Analyze with the session's AI**, the Worker sends the file to the session's
own AI provider with the session's key, which never leaves the Worker:

- Claude: a user message whose first content block is
  `{ "type": "document", "source": { "type": "base64", "media_type": "application/pdf", "data": "…" } }`,
  followed by the instruction (Claude takes up to 32 MB a request and 600 pages);
- OpenAI: the Responses API's `input_file` part with a
  `data:application/pdf;base64,…` URL, followed by `input_text`.

An image (PNG, JPEG or WebP, up to 5 MB; an SVG can carry script and only the
first frame of an animation would be read, so neither is taken) is taken only
where the session has [cards](#cards) on: elsewhere the Worker refuses it with
`415 context_images_off`, from admins too, and the site and the MCP offer none.
An older Worker would treat a stored image as a text file, so a session that
never turns cards on holds exactly what it held before. Images already stored
stay when cards are turned off, and admins can still have them read. An image
goes the same way as a PDF: Claude gets an `image` block with the same `base64` source, OpenAI an
`input_image` part with a `data:<type>;base64,…` URL. Its instruction asks for
any words in the image, as written, and then what it shows: a chart's title,
axes and figures, a diagram's parts, what a photo is of. The Worker stores and
forwards an image's bytes and never decodes them.

Other providers are refused. The returned text is stored beside the file
under the file's own access rule, tagged `CE-DocRole: context-text` with the
model and date, and the page shows it as **Read by AI**. So the reading is
context for exactly the people, and the AI calls, that may see the file.
Unticked, the file is stored and listed but gives the AI no text;
**Read with AI** reads it later.

**Who may have a file read.** Admins, any PDF or image, as often as they ask.
Where the session has [cards](#cards) on, whoever added a PDF or image may
also have it read, once: `POST /storage/context { action: 'read-pdf', id }`
from its adder is taken while the file has no reading, the session still takes
context from participants and has not ended. It needs the `ai` scope of their
sign-in and counts as one of their AI calls for the day
(`limits.aiPerWalletPerDay`), counted only once the reading has begun: a
request refused before that (AI off, a model that can't read files, no key,
a file too large, a reading running or one already stored) costs nothing. The
session coordinator keeps the one-reading rule, so a second request is refused
even where the file's stored row doesn't show its first reading yet. The
adder need not be able to read the file themselves: an admins-only file's
reading is stored for admins, and the reply says only how long it is. The
session page offers this as **Analyze with the session's AI** when they add the
file, and the Context Engine MCP asks for it after `add_context`. A reading
can cost far more than a card: a long PDF is many thousands of tokens.

## Cards

A source's **card** says what it is about: a summary of up to 300 characters,
up to 6 topic tags (lowercase words, 32 characters each) and up to 6 key names
(40 characters each), about a kilobyte at most. Workers that keep cards
advertise `context_cards_v1`.

**Cards are off unless an admin turns them on**: **Context cards** in a
session's Settings, under Context (`contextCardsEnabled`, off when unset; the
setting is offered only where the Worker keeps cards, and changing it signs no
one out). A session can also be made with cards on: the same tick box is in
the Context section of `/new`, and a session template may carry
`"contextCardsEnabled": true`. While off, no card is made, written, listed or given to an AI, so
the session's prompts are exactly those of a session without cards, only
admins can have a PDF or image read, and the session takes no new images. Cards written while it was on stay stored
and show again when it is turned back on. A card a person wrote is still
carried over when its link is refreshed.

- **Where it lives.** On the source's own doc-library row, beside its tags.
  `/storage/list` returns it as `metadata.card` on the rows it lists to the
  caller, and the Worker's AI features take it only from rows the reader passed
  the access check for. So a card reaches exactly the people and AI calls its
  source reaches: an admins-only or group-locked source's card goes no further
  than the source. A PDF's card sits on the PDF's row, not its reading's. The
  row's key-list entry never holds the card.
- **When it is made.** Once, when the source is added: for a link, from the
  page just read; for a text file, from its bytes; for a PDF or an image, from the text the
  session's AI read of it. The card-maker is one short call (`taskType`
  `context-card`, at most 1,500 output tokens) to the session's fast model on
  the session's key, reading the first 12,000 characters, or fewer where the
  text takes more bytes or escapes long (what is sent is at most 16,000 bytes),
  so a card costs about the same whatever it describes. Settings → AI lists
  it as **Context cards**. The call is given 20 seconds; past that the source
  has no card. Where the runtime can finish work after replying, the add does
  not wait for the card. Card calls run for whoever added the source and are
  not counted against that person's daily AI limit; each person's 20 adds
  bound them.
- **When it is not.** No card is made when AI is off for the session, when the
  session's provider key is missing, or when the fast model's provider is one
  the card-maker doesn't use (Cloudflare's models answer only the Session
  Agent). A reply that is not one JSON object within the limits is dropped. In
  each case the source simply has no card and is read as before. An item
  stored encrypted (`worker_envelope`) never has a card: none is made, written
  or shown, since a card is plain text on its row.
- **Writing one by hand.** `POST /storage/context { action: 'set-card', id,
  card: { summary, tags, names } }` writes a card, and `card: null` takes it
  off. Admins write any source's; anyone else only the card of a source they
  added, and only while they could still add context: not once the session
  limits context to admins or has ended. Text that looks like a key, token or
  password is refused. A card records who wrote it (`by`: `ai`, `admin` or
  `adder`) and when.
  The AI never replaces a card a person wrote, not on a link's refresh (which
  carries the card over) and not when a file is read again.
- **Making missing ones.** `{ action: 'make-card', id }` has the session's AI
  write the card of a source without one; admins only, as it is a call on the
  session's key. The page's **Make missing cards** button shows how many
  sources lack a card and an estimated cost before it makes any. Nothing is
  made for sources added before cards existed until an admin asks.
- **Untrusted text.** A card is cut to its limits wherever it is stored, listed
  or given to an AI. Tags are reduced to letters, digits, spaces and hyphens,
  and characters that show as nothing (zero-width and tag characters) are
  dropped, so a card holds no words its reader can't see.
  The card-maker is given the source as escaped JSON inside `<document>` tags
  and told it is data.

On the page each source shows its tags as chips; the summary, the names and who
wrote the card are behind the "?" beside them.

## What the AI reads

One helper (`shared/sessionContextText.mjs`) turns the notes, links and source
texts into a single block between `<session_context>` tags, as JSON with `<` and
`>` escaped, introduced as untrusted reference data from the session's hosts
and participants, AI agents among them, whose instructions are never followed.
It caps each item (6,000 characters) and the whole block per call, and reports
what it left out.

| Feature | Reads | Block cap |
|---|---|---|
| Question generation (browser) | what the person generating may read | 20,000 |
| Voice interviewer instructions (browser) | what the participant may read | 6,000 |
| Interview opening (Worker) | what every participant may read | 4,000 |
| Results analysis (Worker) | what every participant may read | 12,000 |
| Debate atlas and risk matrix builds (Worker) | what every participant may read | 6,000 |
| Session Agent (Worker) | what its answer style lets the asker read | 320,000, each item to 12,000, from up to 48 added items; 160,000 and 6,000 on Cloudflare's model |

The Worker's features act for all participants, so they never use admins-only
items, items with a narrower access than the session's, or items it cannot
read. The Session Agent answers one person, so its Detailed answers also read
what that person may read, group-locked items included. Results analysis keeps context out of its source signature, so editing
context never marks a report stale, and it grounds every claim in responses,
not in the background.

**Limits and order:** each doc-library row's list entry says whether it is a
context source and, for a source, whether an admin added it and when, so the
Worker chooses before it reads a row. Its features look at up to 300 context
rows, the admins' first, then the oldest; more than that leaves the newest
out, never all of them, and the Worker logs how many. Past 40,000 rows only
the first 40,000 listed are looked at, and rows that can't be fetched leave
only themselves out. They read sources in
this order until the texts fill the feature's block above, and at most 16,
since each read can be a megabyte to fetch and decrypt: what admins added,
oldest first, then everyone else's, each person's oldest in turn, in the order
people first added, so one person's many notes never crowd out everyone
else's. A PDF's reading is found from its PDF and takes no place of its own.
Rows stored before 0.9.9 carry no adder or time in their list entry and count
as the oldest participants'. The page lists up to 500. Of the Worker's
features, only the Session Agent says when context was left out (its reply's
`note`); the others leave it out silently.

**Sources that don't fit:** the sources a Worker feature stopped before, for
lack of room, reach its prompt as their cards. The block gains a `notRead` list
(each entry a title, kind, summary, tags and names) after what was read, and a
sentence saying these sources were not read and are untrusted data too. The
list is given at most an eighth of the block, out of the block's own cap, in
reading order, up to 100 entries; it grows past that only into room the block
has left unused. A card too long for the room left is passed
over, so it never hides the cards after it; `notReadMore` counts the cards not
listed, and is given with an empty list when none fits. Only sources the reader
may read are listed, and only those with a card:
a source without one is left out silently, as before. A source that was
fetched but then found no room in the block is named there too, ahead of those
never fetched, where the block has room left over for its name: naming it
never takes room from what was read. A session none of whose sources has a
card gets exactly the block it got before cards. A block built in the browser, and the Session
Agent's export file, do not carry the list. A stored Session Agent chat is
marked with a group when its answer was shown that group's locked file, in
full or as its card.

**Adds per person:** each signed-in person, an agent included, adds at most 20
context items (files and links) to a session; admins are not limited. The
session coordinator counts each add just before it is stored. Sending the same
item again (the same file, or the same link) after a busy reply or a failed
store does not count it twice, for up to an hour; once it is stored, adding it
again counts anew. Removing an item does not give its place back. The count
belongs to the session, so a reset under the same link starts it afresh. The
21st is refused with 403 `context_adder_limit`
("You've added 20 context items to this session, the most one person may add.
A session admin can add more."). An add is refused as busy, and stores nothing,
when the count can't be reached (503, `context_count_unavailable`) or when the
same item is still being added by another request (503,
`context_add_in_progress`, for up to 30 seconds).

## Templates

A template carries the notes and page links (`sessionContext`) and lists each
file by name and privacy in `contextFiles`, to attach again; file contents never
travel. Links added as sources, beyond the page links, are not carried; add
them again after importing.
