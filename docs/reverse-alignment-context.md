# Reverse Alignment context

The RxC session Context section combines its saved introduction and the twelve
focus areas from [Reverse Alignment](https://reversealignment.ai/) in one compact
explorer. It shows only the opening introduction paragraph and source links;
the topic circles replace the longer summary of the three areas.
There is no separate field-guide banner or decorative image. The outer Context
View dropdown uses the same heading style as Groups and Results.

The overview shows three area circles: **Trust and agency**, **Collective
decisions**, and **Learning and work**. Selecting one replaces the overview with
that area's four topics. Selecting a topic replaces the group with its overview,
discussion prompt, sources, and related topics. **Back** returns one level and
restores keyboard focus. Related topics appear as compact links without an extra
heading. The related links and the twelve-topic Previous/Next tour
can cross areas; Back then returns to the current topic's group. Group arrows
also wrap through the three areas. Navigation stays at the top, and opening a
new group or topic brings its heading and controls into view. New topics always
start on the Overview tab.

Only one navigation level is shown at a time. The layout adapts to the available
container width, including narrow mobile panels, and keeps controls accessible
in both themes. The guide has no search field or promotional footer.

The three regions and their connections are editorial navigation. Discussion
prompts are invitations for the session, not quotes from the source or submitted
participant responses. Text and controls remain accessible HTML.

`rxc-ra-test` currently offers **Report** and **Raw Results**. Its Debate Map is
hidden until it is ready to return; a previously selected map falls back to
Report. Context navigation remains available. The report omits the retired
answer-or-skip/voice-interview and endorsement instructions from this session’s
description, including older Worker and cached metadata. The remaining description
is preserved in the report and its PDF capture. This display correction does not
rewrite the saved Worker configuration.

`rxc-test` still offers **Report**, **Debate Map**, and **Raw Results**. Report opens
by default. Debate Map uses the shared Debate Atlas **Circles** view: open one of
the three topic groups, then select a topic to inspect its assignments. This
preview appears only in Debate Map and shows **Waiting for more data**. Its
circles have no question or response assignments, votes, or sample responses.
The preview keeps its header, data status, and circles, with assignment details
shown only after selecting a topic. Source links remain in the Context guide.
There is no classification action yet; a future administrator workflow can
populate those assignments. The Context atlas does not imply that classification
has happened. Raw Results continues to open the detailed results view.

The Context atlas applies to `rxc-test` and `rxc-ra-test`; the Debate Map preview
is currently enabled only for `rxc-test`. This is client
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
requests. The automated probe checks area/group/detail replacement, compact overview height, keyboard
focus, Back, tabs, related topics, both wrapping tours, and viewport fit in both
themes at desktop and mobile widths down to 320px. From the repository root:

```bash
node --input-type=module -e "import('./scripts/reverse-alignment-atlas-smoke.mjs').then(m => m.runSmoke())"
```
