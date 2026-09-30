# Reverse Alignment context

The RxC session Context section includes an illustrated field guide to the twelve
focus areas on [Reverse Alignment](https://reversealignment.ai/). All twelve
topic buttons are available directly; selecting one opens a reading panel with
an overview, discussion prompt, source link, and related focus areas. Larger,
borderless reading tabs and arrow-only Previous/Next controls provide navigation.
The map grows with its controls so they stay clear of the reading panel; mobile
layouts present the same controls below the map artwork. The guide has no search
field or closing promotional footer.

The three regions and their connections are editorial navigation. Discussion
prompts are invitations for the session, not quotes from the source or submitted
participant responses. The illustration is decorative; text and controls remain
accessible HTML. The artwork loads only when the Context section opens.

Results offers **Report**, **Debate Map**, and **Raw Results**. Report opens by
default. Debate Map uses the shared Debate Atlas **Circles** view: open one of
the three topic groups, then select a topic to inspect its assignments. This
preview appears only in Debate Map and shows **Waiting for more data**. Its
circles have no question or response assignments, votes, or sample responses.
There is no classification action yet; a future administrator workflow can
populate those assignments. The Context atlas does not imply that classification
has happened. Raw Results continues to open the detailed results view.

The atlas and preview apply to `rxc-test` and `rxc-ra-test`. This is client
presentation, not session provisioning: each session still needs its own valid
Worker configuration and question bank. The bundled discovery entries support fresh visits to `/rxc-test` and
`/rxc-ra-test`; each fetches and validates the
Worker's live configuration before opening the session.

The base illustration was generated with OpenAI image generation and exported
as `client/src/assets/img/reverse-alignment-atlas-v1.jpg`. It contains no topic
labels, participant data, or analysis. See [interview research](session-interview-research.md)
for submission controls and [Worker encryption](session-cors-worker.md) for
response-audience behavior.
