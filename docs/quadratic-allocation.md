# Quadratic allocation questions

Choose **Quadratic allocation** when creating a standalone question or adding a
question to a survey. Provide at least two distinct, nonblank option labels and
use **Credits: 99** beside **Add Option** to reveal the custom-budget slider.
The default is 99 credits per respondent for each question, independently of every
other question. The slider selects whole numbers from 1 to 999; existing larger
budgets extend that range. Click the credits control again to hide the slider.
The question-type picker previews a compact − / 2 / + stepper with the + button
highlighted and a 2×2 block showing its four-credit cost. Existing drafts and
generated questions retain custom budgets.

Respondents assign signed whole-number votes to each option. Positive votes
support an option; negative votes oppose it; zero is neutral. An option costs the
square of its votes, so both +3 and −3 cost 9 credits. The sum of these costs must
not exceed the question's budget. Unused credits are allowed, including an
explicit all-neutral response. An unanswered question stays distinct from that
all-neutral response.

For example, `[7, -7]` costs 98 credits and is valid under the default budget.
`[8, -6]` costs 100 and is rejected. With a 25-credit budget, `[3, -4]` is valid.

The pile editor keeps the same fixed card height as other question types. Labels
and steppers share a row where space permits; containers at most 360px wide put
the label above the controls. Options
scroll vertically while the remaining-credit budget stays visible, with part of
the next label showing when there are more options. A down-arrow button advances
to the next options. An up arrow appears below the top; only up remains at the bottom.
Remaining credits, help and reset share the header. Hover or focus the help
button for the squared-cost explanation.
Reset is inactive when the
answer matches the saved baseline, including when both are unanswered, so it cannot
create an accidental draft. An edited neutral allocation can still be reset to a
previously saved nonzero answer.
The Questions toolbar's **Clear pending changes** button restores the saved
response baseline, just like the pile's X control.

## Data format and identity

```json
{
  "type": "quadratic",
  "prompt": "Allocate support or opposition across projects",
  "options": ["Parks", "Transit"],
  "voiceCredits": 99
}
```

A response stores `answer.value` as an array, such as `[3, -4]`, with exactly one
signed integer per option in the question's order. Missing `voiceCredits` uses
99; invalid budgets, fractions, nonnumeric entries, incomplete arrays, and
overspent allocations are rejected. Budgets and votes must be JavaScript safe
integers. Option labels are unique after trimming and ignoring case.

Quadratic question IDs include the ordered option labels and budget as well as
the type and prompt. Changing the option order, labels, or budget produces a
new question identity. Existing question types retain their previous ID format.
Saved drafts, response uploads, encrypted envelopes, and JSON exports preserve
the numeric array's signs, order, and zeros. CSV question and response exports
append a `voiceCredits` column; existing types leave that column blank. Response
CSV arrays retain the question's option order. Filtered exports, HTML/PDF reports,
and report JSON snapshots retain the custom budget. AI result-analysis inputs
label every signed vote with its option and retain explicit neutral answers;
invalid or still-encrypted allocations are excluded from answer analysis.

## Results and integrations

On a session page, open **Results → Raw Results** and expand a quadratic question
to see its allocation table. The Polis-style report also includes a quadratic
allocation section with signed bars and net totals. See [Polis answer sections](polis-answer-sections.md)
for report filters, expansion, and PDF behavior.
The compact table uses **Positive**, **Negative**, and **Net** columns. Positive
votes are green, negative votes are red, and zeros keep the normal text color.

Profile and individual-response cards show named options and signed votes in a
compact diverging bar chart. Green positive bars extend right from zero, red
negative bars extend left, and neutral options show zero without a bar. Bar
lengths share the question’s maximum whole-vote scale (the square root of its
credit budget, rounded down). Credit costs stay in the allocation input rather
than the saved-response chart. Custom budgets are retained in profile cards.

Results sum the latest available response per respondent for each option and
show positive votes, negative votes (as signed totals), and net votes. For
responses `[3, -4]` and `[-2, 5]`, Parks has positive 3, negative −2, and net 1;
Transit has positive 5, negative −4, and net 1. Results count valid all-neutral
responses. Encrypted answers that have not been decrypted and invalid answers
are excluded from arithmetic and counted separately.

The type is supported by manual and AI authoring, full and pile response views,
question filters, saved-response displays, aggregate results, exports, interview
prefills, user comparison, Telegram Mini App forms, and the local companion.
AI answer formats use the same signed array and budget checks. Telegram chat
opens the Mini App for allocation entry; `/add_question quadratic: Prompt | A | B`
authors a question with the default budget, while the Mini App exposes the budget
field. Telegram aggregates respect the session's existing results exposure and
participant-filter settings.

AI-generated custom budgets remain editable in the authoring form.
Interview prediction accepts budget-valid signed vote arrays, including neutral
allocations. Review uses the same allocation steppers as the question pile and
preserves numeric votes and the original prediction when the respondent edits and
submits. When interview question suggestions are enabled, the model can propose
quadratic questions for competing priorities, with distinct options, tags, and a
99-credit default (or a requested custom budget). Invalid predicted allocations
or question budgets are rejected before review.
Questions discovered during an ongoing interview retain their option order and
budget in the voice context and review controls, even before the pile cache refreshes.

Tag generation includes the allocation's option labels. Listening-mode generation includes custom
budgets in question identity. Tag previews, simulated profiles, and demo question
and response adapters retain ordered options and custom budgets. Telegram draft
and submitted-answer history restore numeric allocations without converting them
to text; edit provenance tracks which option votes changed. Question-only previews show those options
and the budget without introducing answer controls inside the navigation card.

Credential-free respondent smoke coverage is part of the repository E2E command
notes. Live storage, wallet, and gated-decryption suites require the
operator-local harness described there.

### Respondent controls

Each option has aligned − and + buttons around a bold, unsigned vote count.
The highlighted button shows the current direction: − for opposition, + for
support; neither is highlighted at zero. A selected direction stays highlighted
even when its next step is disabled. All rows share a count-column width sized
for the question's largest possible vote (including existing larger budgets); larger
option labels wrap as needed, and the button symbols stay centered.

For nonzero votes, an n×n block of small squares shows the n² credit cost beside
its text label (for example, **7**, highlighted +, a 7×7 block, **49 credits**).
Above 12 votes, the block becomes one solid square. Cost text can wrap in narrow
containers and disappears at zero. The header reads **99 credits left** (or
**1 credit left**). The help tooltip explains **Votes cost their square** on hover
or keyboard focus. A bar beneath the header shows one
segment for each nonzero option, green for support and red for opposition;
the grey remainder represents unused credits. Colour-vision mode uses the
theme's alternative support and opposition palette.

Buttons disable when the next signed vote would exceed the shared budget or
the question's limit. Moving toward zero releases credits. The help control
explains the squared cost, shared budget and permission to leave credits unused.

The native range input remains invisible but labelled and keyboard-accessible.
Tab reaches each option; arrow keys adjust signed votes and show a focus ring
around its stepper. Screen readers receive the option name and a value such as
“+3 votes, 9 credits, support.” The pointer buttons are excluded from the tab order
and accessibility tree. The stored answer remains signed even though its visible
count is unsigned. Keyboard and button changes update the answer immediately.
In pile cards and full question views, the Reset undo-arrow restores the saved answer, or clears the pending answer when none was saved.
In interview draft editors it restores the AI's drafted allocation, including an all-neutral one, and clears that answer's edited marker.
Reset stays disabled until the allocation differs from its undo target, so an untouched answer never gains a pending change.
Surfaces without an undo target keep a separate "Reset all votes to neutral" action.
Pile cards keep a fixed height and scroll their options; progress
and submission remain in the pile's shared controls outside the question card.
If signing or saving fails, the pile shows the error beneath the question
and keeps the pending allocation available for retry.

The main React client, including its Telegram pile, uses these steppers. The
separate AgentBridge Telegram mini-app and companion browser retain their own
slider UI. Both Cloudflare and smart-contract storage modes use the same ordered numeric arrays, definition validation,
per-question budget, encryption encoding, and signed vote analysis. No Solidity interface change
is required: question metadata and response payloads carry the new type through existing storage.

The overflow scroll arrow sits below the options viewport in a yellow button, keeping it visible while the options scroll.

Run the local respondent smoke with a client dev server and
`BASE_URL=http://127.0.0.1:3000 npm run test:e2e:quadratic`. It exercises both
themes at wide and narrow viewports, keyboard and pointer controls, alignment,
direction highlighting, undo, many-option scrolling, 999-credit budgets and
existing budgets above the current authoring slider's range.
