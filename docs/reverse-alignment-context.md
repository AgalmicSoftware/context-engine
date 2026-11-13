# Reverse Alignment context

A Reverse Alignment session shows its atlas as its context: an HTML page with
the session's introduction and links, then three areas, **Trust and agency**,
**Collective decisions** and **Learning and work**, of four topics each. Areas
and topics are cards in the area colours that open in place. Each topic has its summary, a question to carry into
the session, a prompt to consider who benefits, who decides and how someone
could contest the outcome, its related topics, and a note on the sources.

An admin sets the page in the Context section of `/new` or the settings page,
with **Format** set to **HTML file**; see the
[session creation guide](session-creation-guide.md). The page belongs to the
session: the client has no Reverse Alignment code, and the twelve topics live
only in each session's context. A session whose Worker predates HTML context,
such as `rxc-ra-test-3`, can't hold the page, so it shows its typed context.

The three areas and their connections are editorial navigation. Discussion
prompts are invitations for the session, not quotes from the source or
submitted participant responses.

`rxc-ra-test` currently offers **Report** and **Raw Results**. Its Debate Atlas is
hidden until it is ready to return; a previously selected atlas falls back to
Report. Context navigation remains available. The report omits the retired
answer-or-skip/voice-interview and endorsement instructions from this session’s
description, including older Worker and cached metadata. The remaining description
is preserved in the report and its PDF capture. This display correction does not
rewrite the saved Worker configuration.

`rxc-test` offers **Report** and **Raw Results**, and Report opens by default.
Like the other sessions here, it shows **Debate Atlas** only once a debate atlas
has been built for it, and **Risk Matrix** only once a risk matrix has. Raw Results continues to open the detailed results view.

These test sessions open only from their Worker links,
`/session/<slug>?worker=<origin>`; the hosted site no longer opens them from a
normal or short link. Each link fetches and validates the Worker's live
configuration before opening the session. A session opens from a normal link
only when `known-sessions.json` lists it; see the
[session creation guide](session-creation-guide.md#normal-links-on-the-hosted-site).

See [interview research](session-interview-research.md)
for submission controls and [Worker encryption](session-cors-worker.md) for
response-audience behavior.
