# Enriched historical-case schema

Each case in `loophole_historical_cases.json` is a JSON object with these fields.

| field | type | notes |
|---|---|---|
| `id` | string | stable slug, `loophole_historical_<key>` |
| `title` | string | `"Figure A vs Figure B: The <Scenario>"` |
| `authors` | string[] | exactly two historical figures |
| `year` | int | always 2026 (venue is fictional) |
| `venue` | string | `"Loophole historical council"` |
| `category` | string | one of `Loophole Finder`, `Overreach Finder`, `Judge Precedent`, `Escalated Case` |
| `debate_map_issues` | string[] | atlas leaf node IDs |
| `summary` | string | 2-sentence hook for the card header |
| `tags` | string[] | kept for filter chips |
| `source_label` | string | `"Loophole methodology"` |
| `url` | string | `https://github.com/brendanhogan/loophole` |
| `domain` | string | the legal code's policy domain, e.g. `"biometric surveillance in municipal services"` |
| `principles_by_figure` | object | `{figure: string[]}` — copies the two principles each figure brings in, so the card is self-contained |
| `draft_legal_code` | object | `{version, articles[]}` — the code each figure's principles would produce as a starting point |
| `loophole_exploit` | object | `{institution, actor, action, victims, why_legal, why_immoral}` — the specific exploit path |
| `overreach_variant` | object | `{institution, actor, blocked_action, who_gets_harmed, why_illegal, why_moral}` — the paired overreach attack on the same code |
| `why_the_case_is_hard` | string | 2-3 sentences naming the specific principle conflict |
| `judge_tension` | string | where the judge cannot simply patch without breaking something the figures care about |
| `precedent_pressure` | object | `{prior_ruling, future_case_at_risk}` — what prior commitment a naive patch would collide with |
| `concrete_patch_options` | array | 2-4 `{name, summary, favored_by}` patch proposals |
| `best_patch` | string | the patch the judge would recommend and why |
| `why_other_patch_fails` | string | why the runner-up patch is rejected |
| `open_question` | string | the question the user should actually vote on in Debate Atlas |

## Field notes

- `loophole_exploit` and `overreach_variant` are both present so one case shows both adversarial angles: the primary attack (matches `category`) and the foil attack someone else could make on the same code.
- `concrete_patch_options`, `best_patch` and `why_other_patch_fails` carry the real disagreement between the two figures. Their principles should determine who favors which patch.
- `precedent_pressure` gives the Judge role something to weigh, which `Judge Precedent` and `Escalated Case` cases need.

## Rendering contract

The Debate Atlas case panel reads these fields through `debateMapHistoricalData.ts`:
1. `draft_legal_code` renders its articles as a numbered list.
2. `loophole_exploit` renders institution, actor, action, victims, why_legal and why_immoral as a grid.
3. `overreach_variant` renders the foil in a secondary panel.
4. `concrete_patch_options` renders the patch comparison with "favored by" chips per figure.
5. A missing field falls back to prose templated from the case category and the atlas node.
