# Enriched historical-case schema

Each case is a JSON object with these fields. Fields marked **NEW** did not exist in the previous Context Engine schema.

| field | type | source | notes |
|---|---|---|---|
| `id` | string | existing | stable slug, `loophole_historical_<key>` |
| `title` | string | existing | `"Figure A vs Figure B: The <Scenario>"` |
| `authors` | string[] | existing | exactly two historical figures |
| `year` | int | existing | always 2026 (venue is fictional) |
| `venue` | string | existing | `"Loophole historical council"` |
| `category` | string | existing | one of `Loophole Finder`, `Overreach Finder`, `Judge Precedent`, `Escalated Case` |
| `debate_map_issues` | string[] | existing | atlas leaf node IDs |
| `summary` | string | existing | 2-sentence hook for the card header |
| `tags` | string[] | existing | kept for filter chips |
| `source_label` | string | existing | `"Loophole methodology"` |
| `url` | string | existing | `https://github.com/brendanhogan/loophole` |
| **`domain`** | string | **NEW** | the legal code's policy domain, e.g. `"biometric surveillance in municipal services"` |
| **`principles_by_figure`** | object | **NEW** | `{figure: string[]}` — copies the two principles each figure brings in, so the card is self-contained |
| **`draft_legal_code`** | object | **NEW** | `{version, articles[]}` — the code each figure's principles would produce as a starting point |
| **`loophole_exploit`** | object | **NEW** | `{institution, actor, action, victims, why_legal, why_immoral}` — the specific exploit path |
| **`overreach_variant`** | object | **NEW** | `{institution, actor, blocked_action, who_gets_harmed, why_illegal, why_moral}` — the paired overreach attack on the same code |
| **`why_the_case_is_hard`** | string | **NEW** | 2-3 sentences naming the specific principle conflict |
| **`judge_tension`** | string | **NEW** | where the judge cannot simply patch without breaking something the figures care about |
| **`precedent_pressure`** | object | **NEW** | `{prior_ruling, future_case_at_risk}` — what prior commitment a naive patch would collide with |
| **`concrete_patch_options`** | array | **NEW** | 2-4 `{name, summary, favored_by}` patch proposals |
| **`best_patch`** | string | **NEW** | the patch the judge would recommend and why |
| **`why_other_patch_fails`** | string | **NEW** | why the runner-up patch is rejected |
| **`open_question`** | string | **NEW** | the question the user should actually vote on in Debate Map |

## Why this shape

- Current CE cards render 5 sections (`Moral principles`, `Draft legal code`, `Adversarial attack`, `Judge tension`, `Decision prompt`) from a template over `summary`. That template produces filler prose ("A legislator starting from these principles would likely…") because the real data isn't there.
- The enriched schema moves every templated section into **data** so the UI reads real content instead of synthesizing it.
- `loophole_exploit` and `overreach_variant` are both present so a single case shows both adversarial angles — the primary attack (matches `category`) and the foil attack someone else could have made on the same code.
- `concrete_patch_options` + `best_patch` + `why_other_patch_fails` is where the two historical figures *actually disagree*. This is the richest field; the figures' principles should determine who favors which patch.
- `precedent_pressure` makes the Judge role meaningful. Without it, a case has no reason to reach the `Judge Precedent` or `Escalated Case` category.

## Rendering contract

`DebateMap.tsx` must:
1. If `draft_legal_code` is present → render its articles as a numbered list.
2. If `loophole_exploit` is present → render institution/actor/action/victims/why_legal/why_immoral as a grid.
3. If `overreach_variant` is present → render the foil in a secondary panel.
4. If `concrete_patch_options` is present → render the patch comparison with "favored by" chips per figure.
5. Fall back to the current templated prose only when a field is missing (preserves compatibility for un-upgraded cases).
