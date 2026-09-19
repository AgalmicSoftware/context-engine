# Interview Research Diagram Provenance

Both diagrams were generated on September 19, 2026 with the built-in image generation tool for use in public Context Engine documentation. The diagrams were then checked visually for legibility and consistency with `docs/session-interview-research.md`, `client/src/components/SurveyTool/SessionInterviewResearchConsent.tsx`, `client/src/components/SurveyTool/sessionInterviewResearch.ts`, and `client/src/components/SurveyTool/surveyToolResponsePayloadController.ts`.

## `session-interview-overview.png`

Initial generation prompt:

```text
Use case: infographic-diagram
Asset type: an intuitive, polished explanatory diagram for Context Engine interview research, readable as a presentation slide and downloadable image.
Primary request: Show what data the implemented interview mode processes and what optional research data is saved. This is an explanation of existing software, not a proposed feature.
Style: clean editorial information design, friendly simple line icons, generous whitespace, very readable sans-serif typography, navy text and teal accents inspired by the existing Context Engine interface. Light neutral background. Landscape, approximately 3:2, high resolution. No decorative mock UI, no photos, no fabricated charts.

Layout and exact content:
Title at top: "What does Interview mode collect?"
Subtitle: "You review the AI drafts. You choose whether to share the comparison."

Top process row, four numbered cards with simple arrows:
1. microphone + chat icon, "Interview or import", smaller "Audio / transcript or agent prefill"
2. robot + document icon, "AI drafts", smaller "Answers, comments and suggested ratings"
3. person + pencil icon, "You review", smaller "Keep, edit or exclude drafts"
4. submit arrow icon, "Submit", smaller "Your chosen final responses"

A short note below the first two steps: "AI services process the input to create drafts."
A short note below the final step: "Normal responses follow the session's storage and visibility rules."

Central branching flow from Submit to two destination cards; branch label "Share AI draft changes for research" with an UNCHECKED checkbox and a visible badge "OFF by default". The destination cards:
Left, muted neutral border: "Unchecked" / "Final responses" / "No draft-comparison record" / "AI source details are a separate option."
Right, teal border: "Checked" / "Final responses + research record" and beneath this three horizontally aligned subcards:
"AI proposed" / "Original draft + saved AI revisions" / "Answer, comments, importance, conviction, confidence and basis"
"You changed" / "Fields changed in the final value" / "Fields touched, even if restored"
"You submitted" / "Final reviewed values" / "Selected and excluded draft status"
Keep the right destination wider to accommodate the detail. Include a short line inside the right card: "Also: saved revision model IDs and draft-applied time."
Add a small document/database icon at the right-card footer and text "Saved with each submitted response as interviewProvenance".
A line under the two destinations: "Source platform/model, prompt version and question-bank hash are separately optional."

Bottom panel with shield icon and heading "Boundaries of this research record". Four concise points, comfortably sized:
"Encrypted answer/comment text and its basis are redacted."
"Full transcripts and imported conversation history are not attached."
"No keystrokes, edit timing or automatic agreement score."
"Follows response visibility; not an anonymous research database."

Small footer: "Unchanged does not prove agreement. Excluded drafts are metadata, not submitted answers."
Constraints: Render all labels correctly with no pseudo-text. Draw connections accurately: both checkbox branches produce final responses; only checked adds the research record. Avoid implying the checkbox controls AI processing itself. Do not imply all data is anonymous or local-only. Do not show unselected drafts as public submitted answers. Do not include real names, wallet addresses, session secrets, quotes from real participants, or API keys. No additional claims, metrics or retention promises.
```

Final legibility edit prompt:

```text
Revise this infographic for GitHub README readability while preserving the exact conceptual content and data-flow truth.

Primary changes:
- Replace the dark navy background with a white or very pale blue background.
- Use dark navy text and high-contrast labels throughout.
- Remove heavy shadows and glossy effects; use flat, crisp, technical documentation style.
- Increase font sizes for every label, especially all card body text and footer notes.
- Increase spacing around the central branching cards so labels do not crowd each other.
- Keep every existing factual claim and relationship the same.
- Preserve the title "What does Interview mode collect?"
- Preserve the checkbox branch: unchecked means final responses only, checked means final responses plus research record.
- Preserve the warning that AI services process input to create drafts before the research checkbox.
- Preserve the boundary notes: encrypted text and basis redacted; transcripts/history not attached; no keystrokes/timing/agreement score; follows response visibility and is not anonymous.

Do not add new claims, fields, metrics, names, addresses, screenshots, logos, or fake pseudo-text. The final image should feel like a clean public technical README diagram, not a marketing poster.
```

## `interview-research-record.png`

Generation prompt:

```text
Use case: infographic-diagram
Asset type: public GitHub README illustration for Context Engine interview research.
Primary request: Create one polished, intuitive educational diagram explaining ONLY the optional research record, grounded in the exact text below. A wide landscape, high-resolution image (approximately 2048 by 1536), legible when opened full size. Flat white / very pale blue background, dark navy readable text, teal connectors, restrained pale-blue card fills, simple document/robot/pencil/lock icons. Match a clear technical explainer rather than a dashboard. Use generous spacing and strong visual hierarchy. No dark background, gradients, photographic objects, watermark, invented fields, tiny footnotes, or extra copy.

Layout and exact visible text:
Large title: "Inside the optional research record"
Subtitle: "What was proposed, what you reviewed, and what you submitted"

Top thin consent ribbon with an unchecked checkbox:
"Share AI draft changes for research"
Small badge: "OFF by default"
Under ribbon, centered:
"Attached on submission at responses[].interviewProvenance"

Main row: three equal cards, connected left to right with thin teal arrows, readable headings:
Card 1 heading: "1  AI proposed"
Body as short lines:
"Original answer and comments"
"Importance and conviction"
"AI confidence and evidence"
"Saved AI versions + model IDs"
Card 2 heading: "2  You reviewed"
Body:
"Keep, edit or exclude drafts"
"Fields whose final values changed"
"Fields touched, even if restored"
"Excluded drafts remain metadata"
Card 3 heading: "3  You submitted"
Body:
"Final answer and comments"
"Final importance and conviction"
"Draft-applied timestamp"
"Saved with the normal response"

Below main row, a prominent light-blue worked-example panel:
Heading: "Changed is different from touched"
Large centered sequence with clear arrows:
"Unsure" -> "Agree" -> "Unsure"
Small labels directly above each value respectively:
"AI draft"   "Your edit"   "Final value"
Two side-by-side result labels below:
"changedFields: empty"    "userEditedFields: answer"
Then readable bold note:
"An unchanged answer does not prove agreement."

Bottom row two wide panels:
Left panel heading with shield icon: "Protection and limits"
Body:
"Encrypted answer/comment text is redacted."
"Associated evidence is removed."
"Field names and numeric ratings can remain."
"No full transcript or imported chat history."
"No keystrokes, edit timing or agreement score."
Right panel heading with document icon: "Context and visibility"
Body:
"Wallet and question IDs accompany responses."
"Normal session storage and visibility apply."
"Not automatically anonymous."
"AI source details are a separate option."
"No automatic Edge2026 research export."

Small but readable caption at very bottom:
"These boundaries describe the submitted research record, not all AI-provider processing."

Composition constraints: Keep all content within safe margins. Use concise lines verbatim. Every arrow must clarify the flow. Consent does not gate AI provider processing. Excluded drafts are never portrayed as submitted answers. Do not claim encryption hides the entire record. This is an explanatory diagram, not a form screenshot.
```
