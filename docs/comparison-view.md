# Comparing participants

A comparison keeps the selected session and loads its visible answers before
analysis. The default result shows a short explanation of shared ground and key
differences alongside a perspective map. On narrow screens these stack vertically.
Participant letters and shapes connect the single results legend to the map and
answer details.

The model attribution distinguishes a provider-reported model from a requested
model when an older Worker does not report the resolved model. Mock previews and
local fallbacks are labelled separately. No Worker upgrade is required.

AI-generated axes include names, descriptions, and negative/positive endpoint
labels. **Why these axes?** exposes their explanations and evidence. When AI
placement is unavailable, the map is labelled as a statistical projection; its
coordinates are not agreement scores. Maps require shared canonical question IDs.

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
