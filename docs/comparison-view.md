# Comparing participants

A comparison keeps the selected session and loads its visible answers before
analysis. General is an explicit session: its comparisons include only General
cache entries and use General for provenance and AI requests. Comparison URLs
record `session=general` so an empty internal slug cannot select other sessions.
The result opens with a one-sentence headline, then shared ground and key
differences as short titled cards; a difference shows who is on which side by
letter. **Where they stand** places each person on the AI-named dimensions, as
one slider per dimension or as a two-axis map (a Sliders / Map switch). **Where
they agree, where they split** draws one strip per shared yes/no statement from
the visible answers themselves, with no AI. On narrow screens these stack
vertically. Each person's letter and colour connect the legend, the cards, the
dots and the answer details.

The model attribution distinguishes a provider-reported model from a requested
model, which it shows when the Worker does not report the resolved model. Mock
previews and local fallbacks are labelled separately.

AI-generated dimensions include names, descriptions, and negative/positive
endpoint labels. **Why these dimensions?** exposes their explanations and
evidence; positions are the AI's reading, not agreement scores. When AI placement
is unavailable no sliders or map are drawn, and the strips carry the comparison.
Positions require shared canonical question IDs. People at the same spot on the
map are drawn as one cluster there.

**Explore answers** is collapsed initially. It provides filters for binary,
multi-choice, rating, freeform, and quadratic answers. Binary responses use text
pills; multi-choice rows show each participant's selected options; ratings use
the question's scale; freeform answers remain readable in full; quadratic bars
show signed votes around zero, not squared credit costs. Missing visible answers
are not treated as disagreement or as zero votes.

**Change participants** opens the subject controls without repeating their wallet
addresses throughout the results. Existing session-read permissions still govern
which answers are available. Loading states retain elapsed seconds, and failed
session hydration offers Retry.
