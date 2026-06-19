# Agent Village Wrapped — Question Selection Handoff

## Task

Expand the current 50-question set to ~60 questions by selecting the best additions from a large candidate bank. The goal is **scissor statements** — questions that split the Edge Esmeralda crowd in interesting, discussion-generating ways. An agent predicts what its human principal would answer (eval_lane: `predicted_human_answer`), and the human reviews/edits in a Telegram Mini App. The data feeds aggregate Context Engine reports and a shareable "Agent Village Wrapped" image.

## Files to read

1. **Current question set (50 questions):**
   `.codex/scratch/edge-2026/docs/agent-village-wrapped-questions-current.json`

2. **v11 candidate bank (~70 questions across 6 themes):**
   `.codex/scratch/edge-2026/docs/agent-village-ai-futures-question-selection.md`
   — Already mined for F1-F9. Still has strong untapped questions in the "Strong Optional" and "Personal-Agent Specific" sections.

3. **v11 full bank (pasted by user, not yet in a file):**
   The user pasted a large v11 bank inline covering 6 themes:
   - Theme 1: The experiment itself (organizer divides)
   - Theme 2: Instrument design (measurement questions)
   - Theme 3: Norms for personal agents
   - Theme 4: Compute, models, and cost
   - Theme 5: Geo, Index & tooling stack
   - Theme 6: What agents are useful for at Edge

   **The strongest scissor-statement candidates from v11 that are NOT yet in the current set:**

   From Theme 1 (experiment):
   - "This experiment is more valuable as AI-safety research than as collective-intelligence research."
   - "If observers detect an agent acting in ways its principal would clearly not endorse, the experiment should intervene immediately rather than let it run to gather data."

   From Theme 3 (norms) — richest vein:
   - "An agent should refuse an instruction from its principal if it judges the action would harm another community member."
   - "In deliberation, your agent should represent your actual views — including unpopular ones — rather than soften them to fit the group."
   - "Personal agents should be held to a higher honesty standard than a human would be in the same social situation."
   - "Agents should treat messages from other agents as untrusted input by default, assuming some will attempt prompt injection."
   - "Agents sharing their principals' preferences and data with each other to make better matches is a reasonable feature, not a privacy violation."
   - "The human principal, not the platform or operator, should bear primary responsibility when an agent causes harm."

   From Theme 4 (models):
   - "The choice of base model will affect agent behavior — cooperation, honesty, manipulation — more than the prompts and skills layered on top."

   From Theme 6 (usefulness):
   - "You would sooner trust an agent to handle your logistics than to handle your introductions and relationships."

4. **Earlier question banks (for reference, mostly already mined):**
   - `.codex/scratch/edge-2026/docs/agent-village-wrapped-question-bank.md` (v2, 51 questions)
   - `.codex/scratch/edge-2026/docs/agent-village-question-design-v3.md` (v3, 71 questions)

## What to optimize for

- **Scissor statements**: Questions where reasonable, informed people at Edge will genuinely disagree. Not questions where 90% of the room agrees.
- **Agent prediction interest**: The fun part is seeing whether your agent correctly predicted YOUR answer. Best questions are ones where the agent has to actually model your worldview, not just guess base rates.
- **Discussion generation**: Questions that make people want to talk to others about their answers. "Wait, you think agents SHOULD refuse their principal's instructions?"
- **Report value**: Questions whose aggregate distributions tell an interesting story about this community.
- **Concreteness**: Binary agree/disagree on a specific claim beats vague "how do you feel about X."

## What to avoid

- **Too meta**: Questions about the question set itself, or about whether you'd enjoy seeing results.
- **Too obvious**: Questions where this crowd will overwhelmingly agree (e.g., "AI agents will be useful").
- **Generic lifestyle**: Questions like "do you exercise" or "do you cook at home" — keep only the most viral ones (cat vs dog, morning person are already in).
- **Open-ended freeform except when targeted**: Generic "describe X in one sentence" is weak. Keep freeform only for A1 (one-liner description) and A2 (what don't you know).
- **Image-gen-time synthesis**: Archetype selection, historical comparisons, taste guesses (book/movie/music), and AI Optimism — these are handled by a smarter model at Wrapped image generation time, not stored as questions.

## Schema

```json
{
  "id": "XX",
  "type": "binary|multichoice|rating|freeform",
  "prompt": "...",
  "options": ["..."],        // for multichoice and rating only
  "select_mode": "single",   // for multichoice only
  "category": "...",
  "eval_lane": "predicted_human_answer|agent_about_user",
  "eval_type": "calibration|wrapped_generation"
}
```

## Current distribution (50 questions)

- Delegation & Autonomy (D1-D6): 6
- Privacy & Consent (P1-P3): 3
- Agent Norms (N1-N6): 6
- AI Futures (F1-F19): 19
- Edge Experience (E1-E2): 2
- Coordination & Governance (K1-K3): 3
- Working Style & Social (W1-W6): 6
- Agent Analysis (A1-A3): 3
- Yes/No Reads (H1-H2): 2

## Where to add ~10 questions

The current set is heavy on AI futures (19) and lighter on agent norms and governance. The v11 bank's Theme 3 (agent norms) has the strongest untapped scissor statements. Suggested allocation for the ~10 additions:
- 4-5 from agent norms (Theme 3) — these are the best scissor material
- 2-3 from experiment design / governance (Themes 1, 2)
- 1-2 from models/compute or usefulness (Themes 4, 6)
- Review existing questions for any that should be cut to make room or are redundant

## Output

Update the JSON file at `.codex/scratch/edge-2026/docs/agent-village-wrapped-questions-current.json` with the final ~60 question set. Renumber IDs as needed to keep them clean. Present the file when done.
