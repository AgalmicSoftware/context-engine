# Reverse Alignment context

The RxC session Context section includes a field guide to the twelve
focus areas on [Reverse Alignment](https://reversealignment.ai/). All twelve
topic buttons are available directly; selecting one replaces the grid and atlas
header with a compact reading view containing an overview, discussion prompt,
source link, and related focus areas. **Back** restores the grid and keyboard
focus to the last viewed topic. Back and the arrow-only Previous/Next controls
sit at the top of the reading view, so navigation does not require scrolling
past the content. Opening another topic resets the reading tab to Overview and
brings its heading into focus and its controls into view.
The topic groups follow the header directly, without a decorative image or space
reserved for one. Their layout grows with wrapped labels; the grid and reading
view are never stacked on mobile. The guide has no search field or closing
promotional footer.

The three regions and their connections are editorial navigation. Discussion
prompts are invitations for the session, not quotes from the source or submitted
participant responses. Text and controls remain accessible HTML.

Results offers **Report**, **Debate Map**, and **Raw Results**. Report opens by
default. Debate Map uses the shared Debate Atlas **Circles** view: open one of
the three topic groups, then select a topic to inspect its assignments. This
preview appears only in Debate Map and shows **Waiting for more data**. Its
circles have no question or response assignments, votes, or sample responses.
The preview keeps its header, data status, and circles, with assignment details
shown only after selecting a topic. Source links remain in the Context guide.
There is no classification action yet; a future administrator workflow can
populate those assignments. The Context atlas does not imply that classification
has happened. Raw Results continues to open the detailed results view.

The atlas and preview apply to `rxc-test` and `rxc-ra-test`. This is client
presentation, not session provisioning: each session still needs its own valid
Worker configuration and question bank. The bundled discovery entries support fresh visits to `/rxc-test` and
`/rxc-ra-test`; each fetches and validates the
Worker's live configuration before opening the session.

See [interview research](session-interview-research.md)
for submission controls and [Worker encryption](session-cors-worker.md) for
response-audience behavior.

## Local navigation smoke check

With the client dev server running, open
`/tests/fixtures/reverse-alignment-atlas.html` for an isolated guide with no Worker
requests. The automated probe checks grid/detail replacement, keyboard focus,
Back, tabs, related topics, all twelve topics, and viewport fit in both themes at
desktop and mobile widths. From the repository root:

```bash
node --input-type=module -e "import('./scripts/reverse-alignment-atlas-smoke.mjs').then(m => m.runSmoke())"
```
