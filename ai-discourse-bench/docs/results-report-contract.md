# Results Report Contract

`build-report` writes a JSON object with Context Engine-style result surfaces.
It accepts a single run file/roster or comma-separated `--runs` and `--models`
paths for compatible model-specific benchmark runs. Report schema version 2
records aggregation semantics, run manifests, participant coverage, integrity
warnings, and `preview` or `release-ready` status. `--release` rejects a report
that does not satisfy the release gates.

`render-report` turns that JSON object into a standalone HTML report using the
same visible shell as the OnePageSession results section: the Results/View
header with the live help-tooltip affordance, live `onePageDemoContainer` outer
context, the live `--ce-color-bg` document background, the same Poppins/Open Sans
font resources loaded by the client entrypoint, the live clickable Results
section header/caret collapse behavior, button-based mode controls,
`polisReportContainer` plus a scoped `ce-polis-report-shell` marker for the
Report-mode Polis shell, the top-right report settings gear, `reportInner`,
the live-default visible report settings row, and live-style static collapsible Polis
report sections in Report mode. The standalone root mirrors the live
Context Engine theme variables, including Bootstrap-style palette variables and
the CE font, background, panel, card, input, state, accent, and soft-state
tokens used by links and nested Results panes. The standalone body also carries
the live `index-page` class and the live scrollbar gutter plus baseline heading, paragraph, list, button, form, and
table reset rules rather than a benchmark-only typography reset. The help tooltip follows the live conditional
surface and is hidden while the top Results section is collapsed. Hash or mode
navigation reopens the Results section before switching panes, matching the live
session expectation that view buttons and target content are visible after
navigation. The `onePageDemoContainer` rule intentionally mirrors the live
module instead of carrying standalone max-width or margin resets; document-level
centering remains on the surrounding standalone `main` element. The standalone
shell also
uses the live `only screen` Results responsive breakpoints, including the
1024px Results-button grid, so the mode controls wrap like the client surface,
keeps the live emoji mode icons for Report / Debate Map / Breakdown / Risk
Matrix, and applies a Results-header scroll offset for direct hash links.
Nested Report-mode links such as question anchors
open their containing collapsible section and scroll to the exact target. The
standalone page schedules the initial hash scroll immediately and again on load
so static-file navigation to anchors such as `#participants-graph` lands on the
intended Report subsection instead of remaining at the top of the Results
section. The
standalone artifact keeps extra bottom scroll runway so final report sections
such as List of Participants can land like they do inside a longer live session
page rather than sticking to the bottom of the viewport. Raw Results is kept as
a separate action button
after the mode list, matching the live header structure while opening the
standalone artifact's raw-results pane. Because the live header treats Raw
Results as an action rather than a view mode, the standalone action keeps the
same plain button shape, does not use `aria-pressed`, and does not take the
selected view-mode pill state while `#snapshot-json` is active.

Report mode owns the `polisReportContainer`, matching the live `PolisReport`
branch. Its `reportInner` keeps the live `brandingHeader` spacer/divider and
empty `heading` slot before the disclaimer, but does not inject the benchmark
title as `sessionInfo`; the benchmark identity belongs in the browser title,
Summary stats, exports, and JSON payloads. The
standalone `miniSectionContent` contains the same inner Results mode host used
by `OnePageSession`, and Debate Map, Breakdown, Risk Matrix, and Raw Results
render beside the Polis report there rather than inside the Polis frame or
Polis-style Hide/Show section chrome. They also avoid extra visible pane
headings or wrapper-card styling; the active Results mode button provides the
visible label, while the pane title/subtitle are retained as DOM metadata.
The Debate Map pane keeps the live embedded `80vh` scroll shell, live
view-mode button/control/icon/title-icon styling without standalone reset
overrides, static-only disabled ARIA states, or browser `title` tooltips on
the segmented mode buttons, and live inline legend styling
without standalone no-wrap or line-height overrides, while the Results header
caret keeps the same minimal live `sectionToggleIcon` rule instead of a
standalone FontAwesome reset. The Breakdown comparison area keeps the live
`ComparisonReport` collapse-body wrapper. Raw Results keeps the JSON
payload itself in collapsible details blocks using the client HTML-report
details class, then wraps those blocks in a static HTML-report export surface
with responsive section availability rows, warning/info messages, and
separate collapsible JSON payloads for the report snapshot, Context Engine
import payload, and aggregate raw material. Provider-level run records remain in
the separate run artifact.
Packed Debate Map labels use a generated mobile font-size variable rather than
the standalone-only `overflow-wrap:anywhere` fallback, so narrow side-window
views preserve word boundaries like the live DebateMap module.
Its modal header and view-mode controls intentionally keep the base
`SurveyResults.module.scss` rules without standalone padding/background,
modal-title line-height, active-pill transform overrides, or extra min-width
overrides, so the overlay reads like the live Question Results modal. Its close
button keeps the same modal-header absolute positioning, transparent reset,
`#0f1222` color, zero margin, and full opacity as the live SurveyResults close
control. The
modal demo-results nav keeps one active pill at all times, initialized to the
underlying Results mode (`Report` for direct `#snapshot-json` links) and
updated when Raw Results opens from Debate Map, Breakdown, or Risk Matrix.
Its visible view labels mirror the OnePageSession Results switcher, including
`Debate Map` for the atlas-backed pane, while retaining the existing atlas data
attributes used by the client modal wiring.
Report-mode `pdfIgnore`, `showWhenPdf`, print, and `pdfMode` visibility rules,
including hiding the live `beeTooltip` surface in PDF mode, also mirror
`PolisReport.module.scss` so export/print-specific chrome does not fall back to
benchmark-only defaults.

The Report mode mirrors the live Polis report: Summary and Statistics,
Consensus and Difference, Participants Graph, All Questions, and List of
Participants. The settings gear opens a live-style Polis control row:
Download as PDF, Demo Data, Show Explainers, Report style, Collapse All, and
Expand All. The gear row and toggle button follow the live `PolisReport` JSX
inline styles instead of standalone helper classes, the PDF info icon keeps the
live inline left margin, and the settings row follows the live spacing with
inline wrapper/button/label margins plus the real
`settingsRow`, `demoToggleLabel`, `demoToggleCheckbox`, and `reportStyleSelect`
classes, including the live `pdfIgnore settingsRow` class order, rather than
introducing benchmark-only helper classes for the controls.
The live binary-response note is rendered between the branding header and the
first report section so the standalone artifact has the same Report-mode chrome
as `PolisReport`.
The Summary and Statistics section keeps the live visible row shape: counts,
Active Filters, and Blockchain/Timestamp. Benchmark id, run mode, persona, and
parse/provider issue count remain machine-readable on the `statsSection`
container and in Raw Results rather than appearing as benchmark-only visible
summary rows. `Votes` and `Votes/Voter Avg` are computed from one averaged
response distribution per model/question cell. Raw attempts, Unsure output,
and invalid responses remain visible in `runSummary`, coverage metrics, and Raw
Results without giving a model extra participant weight.
Benchmark-specific JSON exports live in Raw Results so the settings row remains
visually aligned with the live client report and stays available by default.
Those JSON payload details keep the client export-modal border, radius, and
summary typography instead of the generic benchmark JSON reset.
Collapse All and Expand All
operate on Report-mode Polis sections. Those
Report-mode section headers intentionally stay single-line like the live Polis
report: caret, title, and Hide/Show only. Their static CSS keeps the live
`sectionTitle` reset before the `sectionHeader` rule, so title margin and
font-size cascade match the client Polis report rather than relying on
standalone heading defaults. The static `aidb-section-body` wrapper is
spacing-neutral; spacing must come from live classes such as
`statsSectionCollapsible` and `graphSection` so the standalone wrapper does not
add an extra visual layer between `sectionCollapse` and the rendered body.
Longer explanatory labels are retained as section metadata or as subheads on
non-Report mode panes.
The top Results controls act like the live view switcher:
`#debate-atlas`, `#breakdown`, `#risk-matrix`, and `#snapshot-json` each open
only that corresponding report pane instead of scrolling to a closed section.
`#report` returns to the Results section shell so the Results/View header stays
in context instead of landing on the first inner Polis subsection.
Benchmark-only support surfaces such as model cards and the model/statement
matrix remain available through the Raw Results JSON and Context Engine Polis
export instead of as extra visible or hidden mode panes.

## Polis Report

`polisReport` contains the agreement/disagreement substrate:

- `byModel`: aggregate stance profile for each model.
- `byQuestion`: aggregate distribution for each question.
- `byModelQuestion`: model-by-question matrix with repeats nested in each cell.
- `similarityMatrix`: pairwise distributional similarity over shared questions.
- `similarityEdges`: graph-friendly similarity/difference edges with overlap.
- `winningResponseConsistency`: the share of attempted runs matching each
  model/question cell's modal normalized answer, pooled at question level.
- stance and similarity summaries include deterministic 95% bootstrap
  intervals; polarity summaries include signed and absolute wording sensitivity.

This is the core view for "where do models agree or disagree?"

The Participants Graph renders each tested model as a participant point using
the live Polis graph frame and controls. Participant points carry model metadata
as stable `data-participant-*` attributes, and hover/focus tooltips show the
model label, opinion group, provider, model id, coverage, and compact trait summary so
the graph can be read like the live participant graph rather than a generic
scatterplot. The post-graph cluster actions keep the live `pdfIgnore` wrapper
and inline button margins (`Collapse Clusters`, `Expand Clusters`, and
`Analyze clusters`) rather than a benchmark-specific flex helper class.
The embedding selector remains disabled because a self-contained artifact has
one generated MDS embedding. Opinion-group controls are functional: entering a
count or using the stepper applies deterministic K-medoids assignments over the
embedded report similarity matrix, updates participant colors and outlines,
and shows model membership for the preview groups. `Auto` restores the
canonical connected-component groups and their generated representative
statements. Manual grouping changes only the visualization and never rewrites
the embedded benchmark aggregates. Group outlines use the same straight-edged
convex hull as the live client for three or more participants. A two-participant
group receives a single colored connector; a singleton has no outline.

The standalone renderer uses these aggregates to draw a beeswarm-style chart:
each question is positioned horizontally by model-to-model answer spread,
mapped to a fixed zero-to-one scale, with low-spread consensus on the left and
maximum model disagreement on the live-style `Difference` edge. The vertical
axis shows winning-response consistency from 0% to 100%. For each
model/question cell, the winner is that model's most frequent normalized
`Agree`, `Unsure`, or `Disagree` answer; question-level consistency is the
number of repeated runs matching those within-model winners divided by all
attempted runs. Invalid attempts remain in the denominator. This is a
descriptive repeat-stability parameter, not a calibrated confidence
probability or population confidence interval. Stance polarity remains
separate from position: positive means are
labeled as statement-relative `net support`, negative means as `net opposition`,
and near-zero or uncertain distributions as `mixed / unsure`. The rendered chart
uses the live Polis report swarm frame (`swarmLayoutContainer`,
`swarmContainer`, `swarmScrollControls`, and 700x250 `beeswarmSvg`) so it
visually aligns with the client Results report, including the live mobile
breakpoint where `swarmContainer` becomes horizontally scrollable and hides the
native scrollbar. Points use deterministic collision packing around their
metric coordinates, and large banks use smaller circles, so repeated metric
pairs remain separately focusable instead of hiding later questions. The
wrapper and scroll controls should retain the live
spacing and 30px circular button sizing rather than adding benchmark-specific
margin or padded controls. Sparse or unanswered questions are retained as
no-data report rows. The visible
Consensus and Difference section intentionally stays chart-only like the live
`PolisReport`; top-difference inspection remains available through All
Questions, Raw Results, and the CE export rather than adding an extra table to
the report section. Hovering or focusing a beeswarm point shows the question
prompt, aggregate counts, mean score, model-disagreement score, and the exact
winning/attempted repeat counts behind the consistency axis while
toggling the live `beeswarmCircleHover` class for the orange statement-dot
state instead of adding standalone-only SVG hover effects.
The All Questions list mirrors the live `PolisReport` question rows by using
visible `#n` labels beside the prompt and stacked vote rows with box plots.
The displayed row total counts model participants, not repeated provider calls.
The `PolisBoxPlot` mini bar normalizes the model-level
agree/unsure/disagree distributions. Attempt and validity totals remain in the
report integrity data.
Benchmark question ids and topics are not rendered as a visible second row in
Report mode; they stay available through stable `#question-<id>` anchors,
`data-question-*` attributes, Raw Results, and CE export payloads for deep links
and cross-report analysis.

The Breakdown pane may also render a `polisReportContainer` wrapper because the
live `DemoAnalysis/ComparisonReport` module uses that class for its comparison
report card. Visibility rules are therefore scoped to `ce-polis-report-shell`
instead of every `polisReportContainer`.

## Context Engine Polis Export

`export-ce` converts a built benchmark report into a
`ce_polis_question_responses_export` object. This mirrors the `questionResponses`
shape consumed by `client/src/components/PolisReport/PolisReport.tsx`:

- each model id is a participant/responder;
- each answered model/question cell becomes one binary response row;
- averaged scores are discretized as `Agree`, `Unsure`, or `Disagree`;
- response metadata preserves model traits, mean score, counts, invalid rate,
  and polarity summaries.

This compatibility export can feed the current binary response path, but it is
lossy because model/question means are discretized.

`export-ce-native` instead emits `ce_benchmark_results_dataset`, defined by
`schemas/ce-benchmark-results-v1.schema.json`. It preserves model participants,
declared and observed provenance, statements, complete model/question summary
distributions, uncertainty intervals, wording sensitivity, similarity details,
coverage, graph inputs, breakdowns, and integrity state. This lossless contract
is the preferred substrate for eventual native Context Engine rendering.

`snapshot-report` creates a content-addressed longitudinal snapshot from the
same report. `compare-snapshots` compares compatible benchmark/mode/persona
snapshots and reports model stance shift, direction changes, and participant
similarity drift over common questions and models.

## Participant Graph

`participantGraph` treats each model as a participant node:

- node traits include parameter class, OSS status, country of origin, and
  provider class;
- edges encode opinion similarity and difference.

The rendering target is a network view where nearby models have similar answer
profiles. The standalone renderer applies classical multidimensional scaling
to Jensen-Shannon distances over shared-question answer distributions. Opinion
groups are connected components over the report threshold, and participants
without sufficient overlap are placed separately. Its report-mode shell uses the live Polis graph class
hooks (`participantGraphControls`, `graphSection`, `graphItem`, and
`participantSvg`) plus Collapse/Expand cluster controls so the standalone
surface tracks the client Results report layout. The static host wrapper around
that block is spacing-neutral so `participantGraphControls` sits directly after
the section header, like the live `PolisReport` fragment. The visible graph uses
the live small-point 500x400 participant plot shape, with opinion groups and
most-similar participant pairs below the graph. Its layer controls mirror the
live report's Statements, Participants, Outline, Axes, and Radial Axes toggles
while remaining standalone-safe; those toggles map to real SVG statement,
participant, cluster
outline, axis, and radial-axis layers. The controls and all-question vote rows
follow the live compiled CSS rather than the visually intended text in inline
Sass comments; for example, `questionVoteRow` stays at the browser-emitted
`display: flex; flex-direction: column` rule instead of adding standalone-only
alignment or gap declarations. This keeps the standalone spacing aligned with
the client report. Selecting a manual count applies deterministic K-medoids to
eligible participants only; insufficient-overlap participants stay separate.
These manual clusters are display alternatives, while the connected-component
groups embedded in `participantGraph.nodes` remain the canonical report output.

## Participants List

`participants` is the benchmark participant list. Each participant is a tested
model from the model roster, with provider, model id, traits, aggregate answer
summary, uncertainty rate, and invalid-output rate. This differs from normal
Context Engine sessions where participants are human respondents.

In Report mode, the visible List of Participants intentionally follows the live
Polis roster shape: compact blockie/avatar plus participant label. Model traits
remain available in the CE export metadata, Raw Results JSON, and Breakdown view
rather than adding extra columns to the report roster, and the report does not
render a separate benchmark-only participant-card pane. The roster keeps the
live compiled `participantsList` spacing without standalone padding resets.

## Breakdown View

`breakdown` groups model participants by model traits:

- `parameterClass`
- `ossStatus`
- `countryOfOrigin`
- `providerClass`

Additional traits can be added without changing the run format. The standalone
HTML renders these through the live DemoAnalysis-style hierarchy: a Compare
Demographics selector adapted to model traits, a two-column comparison
suggestions plus world-results-map row, a separate question-breakdown chart, and
a comparison-report shell with the live report-collapse body wrapper. The
initial standalone state preselects the strongest available comparison so the
selected-question banner, country map, cohort distributions, and comparison
report are populated immediately, while suggestion clicks update those surfaces
in-place. The selector grid uses field-like
`DemographicSelector` controls rather than expanded cohort cards, and follows
the live DemoAnalysis breakpoints: six columns at 1280px and wider, two columns
at 980px and narrower, and one column at 640px and narrower. The static CSS
keeps the direct DemoAnalysis class rules for `workspace`, `primaryGrid`,
`secondaryGrid`, `panel`, `panelTitle`, and `panelMeta`, with `demoAnalysis*`
aliases only where the standalone markup needs an additional stable hook. Once a question is selected, the map is
a self-contained benchmark-origin cohort map generated from the same
`world-atlas@2` geography and Equal Earth projection used by the live
`react-simple-maps` component. Countries with model-origin cohorts are filled by
that cohort's dominant answer for the selected question using the live
Agree/Unsure/Disagree colors; countries without cohort data remain muted. The
standalone artifact also preserves the live legend, country hover treatment,
tooltip wording, panel vocabulary, and responsive map frame without requiring a
runtime map download. The Context Engine client can use the same fields as
filters, cohort rows, or comparison facets.
Polis mini box plots should mirror the live `PolisReport.module.scss` rule:
the standalone stylesheet provides only `display: block` plus the border, while
the `200x30` dimensions stay on the SVG attributes as they do in the client.
The lower comparison report should continue to follow
`DemoAnalysis/ComparisonReport.module.scss`: comparison cards show the statement
and group distribution candlesticks, without injecting a benchmark-only
response-pill or score row, and they keep the live agree/unsure/disagree
distribution gradients rather than benchmark-specific color substitutions.
Because the static report flattens CSS-module class names into global CSS,
mobile rules copied from neighboring modules must not target
`.comparisonReportContainer` unless the live comparison report module itself
defines that rule. Likewise, generic copied rules must not override
`.analysisList` padding at mobile breakpoints; the live comparison report keeps
its `1rem` list padding below 1024px. Shared class names such as
`.noData` must keep the live Polis default globally and scope the heavier
DemoAnalysis empty-state treatment to `.demoAnalysisWorkspace` or
`.comparisonReportContainer`.

## Debate Atlas

`debateAtlas` contains deterministic topic circles derived from question topics.
That is the fallback view. If the report is re-rendered with an
`ai_discourse_bench_analysis_overlay`, `analysisOverlay.debateAtlas.topicCircles`
replace the deterministic circles, and
`analysisOverlay.debateAtlas.compasses` render as DebateMap-style collapsible
compass panels below the packed topic map.

The standalone Debate Map pane renders the selected topic circles inside an
embedded DebateMap-style shell: view-mode controls, inline legend, a packed
atlas title pill, the live `80vh` embedded scroll wrapper, live embedded atlas
cursor/touch behavior, and packed `atlasNode` / `packedAtlasNode` bubbles with
the same data attributes used by the client DebateMap. Its responsive behavior
tracks the live `DebateMap.module.scss` breakpoint at `768px`, while using
generated packed-circle diameters and font-size variables so static topic labels
remain readable in the side-window report. The view-mode switch, inline legend,
title pill, top-debates overlay, reduced-motion media query, and generated
compass collapse hooks should keep the same class vocabulary and motion behavior
as the live DebateMap module.
Every topic label should remain readable at the same viewport sizes used by the
OnePageSession Results surface.

The intended AI atlas generator input is the built report JSON, not private raw
provider credentials or hidden model prompts.

For the dedicated second-pass workflow, use:

```bash
node ./bin/ai-discourse-bench.mjs export-analysis-input \
  --report ./results/<report>.json \
  --out ./results/<report>-ai-analysis-input.json
```

That artifact has `kind:
ai_discourse_bench_second_pass_analysis_input` and contains participant summaries,
question summaries, current deterministic topic circles, requested Debate Map
outputs, risk-matrix target cells, the source report hash, and the expected
overlay schema. The prompt
for generating the overlay is `prompts/analysis-overlay-generator.md`; pass the
result back to `render-report --analysis <overlay.json>` to render generated
topic circles, compasses, and risk-matrix popup content.

If the overlay includes `analysisOverlay.aiAnalysis`, the Report pane renders an
optional AI Analysis section before Consensus and Difference. It accepts
`executiveSummary`, `strongestConsensus`, `sharpestDisagreements`, and
`caveats`; question-id entries are linked back to All Questions when possible.
The base report omits the section when no overlay content is present.

## Risk Matrix Inputs

`riskMatrix` and `rawMaterial.riskMatrixInputs` preserve question-level risk
facets so a later AI step can generate Context Engine-style severity/likelihood
or topic-risk matrices from completed benchmark runs.

The standalone Risk Matrix pane preserves those facet rollups as raw material
but does not project measured stance into risk claims. It renders a static
embedded RiskMatrix-style surface: dark section cards, horizontally scrollable
ten-category matrix grid, button-like header/cell controls, active selector
panels, a category-subcategory detail subgrid, linked cells, and scenario cards
that preserve raw material for later AI-generated narratives and atlas links.
The top-level headers and selector labels mirror the live client
`RiskMatrix` categories. Cells remain empty until a validated second-pass
overlay supplies analysis. The static renderer re-scopes the embedded Risk Matrix
card headers so they keep the live component's compact card typography instead
of inheriting the larger outer Results section header, and it follows the live
main-grid sizing contract (`980px` minimum width, `122px` row-header track, and
`104px` category tracks) with compact, no-mid-word-break header labels so
category names stay intact instead of splitting mid-word.
Risk Matrix markup keeps both benchmark-prefixed hooks and the live embedded
component class names (`container`, `embedded`, `shell`, `sectionCard`,
`gridScroll`, `gridContainer`, and `cell` variants), and the emitted CSS targets
those paired selectors directly so the static pane remains close to the live
module vocabulary. Grid and subgrid cells also expose
`data-ce-ai-analysis-target`, category/subcategory coordinates, signed values,
and note counts so a second-pass AI analysis can attach click popups without
scraping display text. The standalone pane includes the live modal vocabulary
(`riskMatrixBackdrop`, `riskMatrixCommentModal`, `riskMatrixModalContent`, and
`riskMatrixModalBody`) plus a dedicated `data-ce-risk-matrix-scenario-rail`
ahead of the live-style `commentSections` list and an embedded
`ce-ai-discourse-bench-risk-matrix-analysis` JSON payload. Clicking a matrix
cell opens the live-style aggregate-note modal. Without a validated overlay it
shows that analysis has not been generated.
If a report is rendered with `--analysis <overlay.json>`, the renderer merges
`analysisOverlay.riskMatrix.cells` into that payload. Overlay cells may add
`summary`, `opportunities`, `risks`, `linkedQuestionIds`, `linkedTopicIds`,
`scenarios`, `confidence`, and `generatedBy`. Overlay provenance must identify
the generator, model, prompt version, generation time, and exact input report
hash; mismatched overlays are rejected. `scenarios` render as live-style atlas scenario cards in the
separate scenario rail at the top of the clicked square popup, with fields such
as `atlasNodeId`, `atlasNodeLabel`,
`title`, `summary`, `valence`, `timeHorizon`, `primaryMechanism`, and optional
historical anchors. This keeps debate-map topics, compasses, risk narratives,
and richer cell popups as a second-pass AI overlay rather than part of the raw
benchmark run.
