# Polis report answer sections

The Polis-style report groups **Binary**, **Freeform**,
**Ratings**, **Multiple choice**, and **Quadratic allocation** under **All
Questions**, below the Participants Graph. Each type has a collapsible heading. These sections use a white, print-friendly layout.
The report settings toolbar uses blue actions, white controls, and one pale
gray surface across report styles; controls wrap on narrow screens. Graph scroll
arrows use light-blue buttons with dark-blue icons. The cluster count input,
stepper buttons, and Auto button use explicit dark text on light surfaces; Auto
retains readable hover text and a visible keyboard focus outline. The Opinion Clusters heading
shares a row with Analyze clusters and compact minus/plus controls for collapsing
and expanding all clusters. These icon controls use 50% opacity and accessible
labels; all header actions are omitted from PDF exports. Representative statements
show the percentage agreeing (or disagreeing) in the cluster alongside the overall
percentage. Both use responses to that question, including Unsure and excluding
missing answers, within the current report filters; overall includes the cluster.

**Summary and Statistics** counts participants, answered questions, responses,
and average responses per participant across all five question types. Each value
shows its binary subset in parentheses, such as `42 (18 Binary)`. One participant's
answer to one question counts once: editing replaces that answer, and selecting
several options or allocating across several choices still counts as one response.
Binary includes Agree, Unsure, and Disagree. The binary average uses participants
with binary answers; the overall average uses all participants with readable
answers. The summary follows the same filters as the answer sections, updates when
new responses reach the report, and remains visible for nonbinary-only results.
Polis clustering and participant graphs continue to use binary answers only.

A section appears only when at least one of its questions has a valid readable
answer after filtering. All Questions starts open with each type’s preview visible.
Collapsing the parent hides every type; reopening it opens all type previews,
while preserving any View more selections. Individual types can still be collapsed.
Binary questions preview the top five by the graph’s difference (extremity) score,
with response count and original question order breaking ties. **View more (n)**
reveals all remaining binary questions in the same order. Their original question
labels and vote bars are preserved. Opening another type previews its most-answered
question (up to three written responses). One rounded **View more (n)** control
reveals the rest: for written sections, n counts hidden responses across all
questions; for other sections, n counts hidden questions. Questions appear in
descending response count order, with question ID breaking ties. **View less**
restores the preview. The report-wide collapse and expand controls include these
sections.

Question-tag matching uses the tags attached to the question, with trimmed,
case-insensitive matching and the existing any-selected-tag semantics. Questions
without matching metadata are excluded when a tag filter is active. Question
type, creator/responder group, and top-question filters are applied before
summary counts, averages, and signed totals. Worker metadata remains scoped to
the session's canonical Worker identity; contract sessions use their chain cache.
Demo reports apply the active filters to their own fixture metadata and answers.

Built-in demo reports include nine additional simulated questions: two written,
three rating, two multiple-choice, and two quadratic examples. Their varied
response counts demonstrate **View more**; the `ai-governance` and `education`
tags demonstrate filtering. Examples include neutral allocations, positive and
negative totals, 99- and 49-credit budgets, and different rating scales. These
report-only examples live in `polis_report_answer_examples.json`. They do not
alter published question IDs, Worker data, or the original binary opinion clusters.
Custom report datasets and live-response mode do not receive these examples.

Blank, malformed, still-encrypted, and out-of-session answers are excluded. A
zero rating and an explicit all-zero quadratic allocation remain valid answers.
Repeated rows for the same respondent count once within the new sections.
Multiple-choice percentages use respondents as the denominator, so a question
allowing several choices can exceed 100% across its options. Quadratic bars show
positive and negative vote totals on a common scale, with a separate signed net;
credit costs are omitted. Canonical option labels and custom budgets are used to
validate allocations.

Binary counts read Agree, Unsure, Disagree to match the bar order, including
tooltips and comparison cards. Response bars share the pile's green/yellow/red palette. Settings → Theme →
Color-blind mode switches semantic response colors site-wide to blue/gray/orange,
including quadratic totals and report charts. PDF exports retain that palette.

PDF export expands every answered question in these sections, includes all
readable written responses, and omits the expansion controls. It keeps a question
and its chart together when they fit on one A4 page. Oversize text questions can
continue across pages; individual response paragraphs are kept together when
possible. Export measures the desktop capture layout even when initiated from a
mobile screen, normalizes modern theme colors for the canvas renderer, and
restores the previous interactive expansion state when finished.

Regression coverage lives beside `PolisReport` and `browserPdfExport`. The
credential-free browser smoke is covered by the repository E2E command notes.
