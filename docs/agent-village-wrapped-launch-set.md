# Agent Village Wrapped — Final Launch Question Set

## Part 1: Audit of Existing Question Bank (51 questions)

### Strongest questions to keep (minimal edits needed)

| # | Prompt gist | Why it's strong |
|---|---|---|
| Q1 | Agent intro without asking | Concrete autonomy boundary, easy to predict, interesting split |
| Q2 | Sleep-time scheduling | Pairs with Q1, tests async delegation comfort |
| Q4 | Privacy vs opportunity axis | Clean binary axis, anchors compass and Wrapped |
| Q7 | Trust with context provenance | Tests explainability demand, useful for product |
| Q8 | Long-term memory vs forget-by-default | Core memory-posture question |
| Q10 | One-sentence success definition | Rich freeform, personalizes Wrapped |
| Q11 | Archetype selection | Essential for Wrapped generation |
| Q12 | Memeable one-liner | Essential share hook |
| Q14 | Historical/fictional comparison | Essential for comparison card |
| Q22 | What don't you know | Excellent calibration + humility signal |
| Q26 | Worst agent failure | Strong risk-perception data |
| Q31-34 | Book / movie / game / p(bloom) guesses | Core meme content |
| Q42 | Mistake recovery preference | Best norms question in the bank |
| Q43 | Inter-agent privacy boundary | Only agent-to-agent social protocol question |
| Q44 | Agent voice/tone | Strong personalization signal |
| Q46 | Most surprising prediction | Great Wrapped content |
| Q51 | Verification question for user | Clever calibration tool |

### Duplicates and near-duplicates

| Cluster | Questions | Recommendation |
|---|---|---|
| Agent help / first delegation | Q5, Q6 | Merge into one tighter multichoice |
| Proactive-but-reversible / review-after | Q23, Q24 | Collapse into one binary about the principal, not the room |
| Consent gates for guesses | Q35, Q36, Q37, Q50 | One consent gate is enough; pick Q35, cut the rest |
| Historical comparison | Q14, Q41, Q49 | Keep Q14 only; Q41/Q49 are restatements |
| Strongest theme / most-cared theme | Q15, Q27 | Keep Q15 framing, cut Q27 |

### Weak or unclear questions

| # | Problem |
|---|---|
| Q3 | "Low-stakes commitments" is vague — what counts? Needs a concrete anchor. |
| Q9 | "Optimize for serendipity this week" is ephemeral; hard for agent to predict a time-bound preference. |
| Q13 | Visual aesthetic is an implementation detail, not a question about the person. |
| Q16 | "Productive tension" is interesting but will be N/A-heavy with limited agent context. Keep but tighten wording. |
| Q17 | Meta-question about data availability. Useful for implementation; boring for user-facing Wrapped. |
| Q18 | Events attended — identity-adjacent, N/A-heavy. Better as metadata than a scored question. |
| Q19 | Most-used model — narrow, N/A-heavy. Metadata, not a question. |
| Q20 | Non-default skills — same: metadata, not a question. |
| Q21 | Messages per day — same. |
| Q25 | Predict room average comfort — second-order prediction that's hard to verify or make interesting. |
| Q28-30 | Meta/implementation questions about what Wrapped should show. Useful backstage; not user-facing. |
| Q38-40 | Compass mechanics that overlap other questions. Derive compass placement from answer patterns instead. |
| Q45 | "What user doesn't realize agent inferred" — fascinating but privacy-risky; could surface sensitive inferences. |
| Q47 | Financial decisions under $25 — violates the financial-question constraint. |

### Missing coverage areas

1. **Agent disagreement** — no question about what should happen when the agent disagrees with the principal.
2. **Communication cadence** — no question about when/how the agent should communicate (batch vs interrupt).
3. **AI governance & regulation** — no stance questions on safety/acceleration, AI decision-making authority.
4. **Information environment** — no question on AI-generated content, trust in AI-written vs human-written.
5. **Working style & personality** — no planner-vs-improviser, solo-vs-collaborative, learning-style questions.
6. **Proactive vs reactive** — no question about unsolicited agent suggestions.
7. **Social representation** — no question about agent speaking for you in group contexts.
8. **Agent-as-employee framing** — no question about the mental model (tool vs employee vs partner).
9. **Passive context access** — no question about ambient data reading (calendar, messages) without explicit sharing.
10. **Calibration preference** — no question about fewer-accurate vs more-uncertain predictions.

---

## Part 2: Recommended Launch Set (42 questions)

### Category 1: Agent Delegation & Autonomy Boundaries

#### Q-D1
- **Category**: Delegation & Autonomy
- **Type**: binary (Agree / Unsure / Disagree)
- **Eval lane**: predicted human answer
- **Prompt**: "I would let my agent introduce me to someone at this event without asking first, if the match looked unusually strong."
- **Eval type**: `calibration`
- **Wrapped section**: High-Confidence or Cautious Reads
- **Rationale**: Concrete autonomy boundary; likely to produce interesting splits and strong agent opinions.
- **Risk/concern**: None significant. "This event" anchors it to Edge context.

#### Q-D2
- **Category**: Delegation & Autonomy
- **Type**: binary
- **Eval lane**: predicted human answer
- **Prompt**: "I would let my agent schedule a 1:1 while I am asleep, if it follows constraints I already set."
- **Eval type**: `calibration`
- **Wrapped section**: High-Confidence or Cautious Reads
- **Rationale**: Tests async delegation comfort. Pairs well with D1 for autonomy-boundary profiling.
- **Risk/concern**: None.

#### Q-D3
- **Category**: Delegation & Autonomy
- **Type**: multichoice (single-select)
- **Eval lane**: predicted human answer
- **Options**: `Tell me immediately` · `Fix it quietly, then tell me` · `Apologize to the affected person first` · `Log it and wait for my review`
- **Prompt**: "If my agent made a mistake while acting on my behalf, I would want it to:"
- **Eval type**: `calibration`
- **Wrapped section**: High-Confidence or Cautious Reads; strong for Agent Core Insight theming
- **Rationale**: Best norms question in the bank. Reveals repair-accountability preferences with clear, non-overlapping options.
- **Risk/concern**: None.

#### Q-D4
- **Category**: Delegation & Autonomy
- **Type**: binary
- **Eval lane**: predicted human answer
- **Prompt**: "I would rather my agent be too conservative with privacy than too proactive with opportunities."
- **Eval type**: `calibration`
- **Wrapped section**: Core Insight, compass axis
- **Rationale**: Clean privacy-vs-opportunity axis. Anchors both Wrapped theming and political compass.
- **Risk/concern**: None.

#### Q-D5
- **Category**: Delegation & Autonomy
- **Type**: multichoice (single-select)
- **Eval lane**: predicted human answer
- **Options**: `Introductions` · `Calendar scheduling` · `Message drafting` · `Memory and context management` · `Event filtering` · `Nothing without my review`
- **Prompt**: "Which area would I most likely delegate to an agent first?"
- **Eval type**: `calibration`
- **Wrapped section**: Agent Core Insight (first delegation surface)
- **Rationale**: Merges Q5/Q6 into one tight question. Strong product-roadmap signal.
- **Risk/concern**: None.

#### Q-D6
- **Category**: Delegation & Autonomy
- **Type**: rating (1–5)
- **Eval lane**: predicted human answer
- **Options**: `1 (Not at all)` · `2` · `3` · `4` · `5 (Completely comfortable)`
- **Prompt**: "How comfortable am I with my agent making low-stakes commitments on my behalf, like RSVPing to a casual group dinner?"
- **Eval type**: `calibration`
- **Wrapped section**: High-Confidence or Cautious Reads
- **Rationale**: Rewritten from Q3 with a concrete anchor ("RSVPing to a casual group dinner"). 1–5 scale is easier to predict and display than 1–10.
- **Risk/concern**: None.

#### Q-D7
- **Category**: Delegation & Autonomy
- **Type**: binary
- **Eval lane**: predicted human answer
- **Prompt**: "I would rather review my agent's actions after the fact than approve every step beforehand."
- **Eval type**: `calibration`
- **Wrapped section**: Core Insight, compass axis
- **Rationale**: Collapses Q23/Q24 into one clean question about the principal (not the room). Core governance axis.
- **Risk/concern**: None.

#### Q-D8
- **Category**: Delegation & Autonomy
- **Type**: multichoice (single-select)
- **Eval lane**: predicted human answer
- **Options**: `Learning and exploration` · `Productivity and execution` · `Relationships and introductions` · `Rest and filtering` · `Creative output`
- **Prompt**: "What should my agent optimize for this week?"
- **Eval type**: `calibration`
- **Wrapped section**: Most Important To You
- **Rationale**: New question. Fills the missing "what to optimize for" gap. Ephemeral by design (this week), but the agent's prediction is what's interesting, not the shelf life.
- **Risk/concern**: Somewhat time-bound, but that's fine for a live event context.

### Category 2: Privacy, Consent & Trust

#### Q-P1
- **Category**: Privacy & Consent
- **Type**: binary
- **Eval lane**: predicted human answer
- **Prompt**: "I would want my agent to ask me before sharing any context about me with another person's agent."
- **Eval type**: `calibration`
- **Wrapped section**: High-Confidence or Cautious Reads; strong for privacy-axis theming
- **Rationale**: Only inter-agent social protocol question. Critical for agent-to-agent norms research.
- **Risk/concern**: None.

#### Q-P2
- **Category**: Privacy & Consent
- **Type**: binary
- **Eval lane**: predicted human answer
- **Prompt**: "I trust agents more when they can show what context they used to make a decision."
- **Eval type**: `calibration`
- **Wrapped section**: High-Confidence or Cautious Reads
- **Rationale**: Tests explainability demand. Strong product signal.
- **Risk/concern**: Likely skewed toward Agree; still useful for identifying the minority who disagree.

#### Q-P3
- **Category**: Privacy & Consent
- **Type**: binary
- **Eval lane**: predicted human answer
- **Prompt**: "I would prefer an agent that remembers long-term context over one that forgets by default."
- **Eval type**: `calibration`
- **Wrapped section**: Core Insight (memory posture)
- **Rationale**: Core memory-posture question. Clean binary with real product implications.
- **Risk/concern**: None.

#### Q-P4
- **Category**: Privacy & Consent
- **Type**: multichoice (single-select)
- **Eval lane**: predicted human answer
- **Options**: `Privacy leak` · `Wrong commitment on my behalf` · `Hallucinated memory` · `Social awkwardness` · `Reputational harm`
- **Prompt**: "Which agent failure mode would worry me most?"
- **Eval type**: `calibration`
- **Wrapped section**: Core Insight (risk motif)
- **Rationale**: Strong risk-perception data. Trimmed from Q26 (removed N/A and "financial mistake" per constraints).
- **Risk/concern**: None.

#### Q-P5
- **Category**: Privacy & Consent
- **Type**: binary
- **Eval lane**: predicted human answer
- **Prompt**: "I would be comfortable with my agent reading my calendar and messages to give better recommendations, even if I haven't explicitly shared each item."
- **Eval type**: `calibration`
- **Wrapped section**: High-Confidence or Cautious Reads
- **Rationale**: New question. Tests passive-context-access boundary — distinct from Q-P3 (memory retention) because this is about ambient data access.
- **Risk/concern**: None. Does not ask the agent to actually read anything; asks about hypothetical comfort.

### Category 3: Agent Norms — Communication, Mistakes & Social

#### Q-N1
- **Category**: Agent Norms
- **Type**: multichoice (single-select)
- **Eval lane**: predicted human answer
- **Options**: `Formal` · `Concise` · `Warm` · `Playful` · `Opinionated` · `Invisible unless needed`
- **Prompt**: "What voice should my agent use when it acts or writes on my behalf?"
- **Eval type**: `calibration`
- **Wrapped section**: Agent Core Insight (personality/style)
- **Rationale**: Strong personalization signal. Clear labels that produce good Wrapped copy.
- **Risk/concern**: None.

#### Q-N2
- **Category**: Agent Norms
- **Type**: multichoice (single-select)
- **Eval lane**: predicted human answer
- **Options**: `Message me immediately` · `Batch updates once or twice a day` · `Wait until I ask` · `Use its judgment based on urgency`
- **Prompt**: "When my agent has non-urgent information for me, I would want it to:"
- **Eval type**: `calibration`
- **Wrapped section**: High-Confidence or Cautious Reads
- **Rationale**: New question. Fills the missing communication-cadence gap. Clear options, strong norms signal.
- **Risk/concern**: None.

#### Q-N3
- **Category**: Agent Norms
- **Type**: binary
- **Eval lane**: predicted human answer
- **Prompt**: "If my agent thinks I am making a bad decision, I would want it to push back rather than comply silently."
- **Eval type**: `calibration`
- **Wrapped section**: Core Insight (agent deference axis)
- **Rationale**: New question. Tests the agent-deference-vs-autonomy norm. Likely to produce interesting splits.
- **Risk/concern**: None.

#### Q-N4
- **Category**: Agent Norms
- **Type**: binary
- **Eval lane**: predicted human answer
- **Prompt**: "I would want my agent to occasionally surprise me with something I didn't ask for but might find valuable."
- **Eval type**: `calibration`
- **Wrapped section**: High-Confidence or Cautious Reads
- **Rationale**: New question. Proactive-vs-reactive preference. Separable from D4 (privacy axis) because this is about upside surprise, not risk.
- **Risk/concern**: None.

#### Q-N5
- **Category**: Agent Norms
- **Type**: binary
- **Eval lane**: predicted human answer
- **Prompt**: "I would be comfortable with my agent representing me in a group chat, as long as others know it is an agent."
- **Eval type**: `calibration`
- **Wrapped section**: High-Confidence or Cautious Reads
- **Rationale**: New question. Tests social-representation norm. Good for compass (agency axis).
- **Risk/concern**: None.

### Category 4: AI Futures & Governance

#### Q-F1
- **Category**: AI Futures
- **Type**: binary
- **Eval lane**: predicted human answer
- **Prompt**: "A mostly AI-written information environment could be healthier than today's mostly human-written one."
- **Eval type**: `calibration`
- **Wrapped section**: High-Confidence or Cautious Reads; strong compass question
- **Rationale**: Spicy, well-defined take. Good for splits and compass placement. Tests optimism about AI-generated content.
- **Risk/concern**: Provocative framing is intentional; agents should be able to predict where their principal lands.

#### Q-F2
- **Category**: AI Futures
- **Type**: rating (1–5)
- **Eval lane**: predicted human answer
- **Options**: `1 (None at all)` · `2` · `3` · `4` · `5 (Equal to humans)`
- **Prompt**: "How much influence should AI agents have in collective decision-making within a community?"
- **Eval type**: `calibration`
- **Wrapped section**: Cautious Reads (likely low-confidence for agents)
- **Rationale**: New question. Core governance question. The 1–5 range from "none" to "equal to humans" produces meaningful variation.
- **Risk/concern**: "Equal to humans" anchor may feel extreme, but that's the point — it anchors the scale.

#### Q-F3
- **Category**: AI Futures
- **Type**: binary
- **Eval lane**: predicted human answer
- **Prompt**: "Personal AI agents will be more like employees than tools within five years."
- **Eval type**: `calibration`
- **Wrapped section**: Core Insight (mental model)
- **Rationale**: New question. Tests the tool-vs-employee mental model. Interesting for both Wrapped theming and research.
- **Risk/concern**: None.

#### Q-F4
- **Category**: AI Futures
- **Type**: binary
- **Eval lane**: predicted human answer
- **Prompt**: "I would rather AI development slow down to get safety right than move fast and correct later."
- **Eval type**: `calibration`
- **Wrapped section**: Compass axis; High-Confidence or Cautious Reads
- **Rationale**: Classic safety/acceleration axis. Agents should have signal on where their principal sits. Good for compass.
- **Risk/concern**: Politically charged in the AI community, but not invasive. Binary framing is cleaner than a scale here.

#### Q-F5
- **Category**: AI Futures
- **Type**: binary
- **Eval lane**: predicted human answer
- **Prompt**: "The biggest risk of personal agents is not technical failure but social: changing how humans relate to each other."
- **Eval type**: `calibration`
- **Wrapped section**: Core Insight; Most Important To You
- **Rationale**: New question. Interesting philosophical take that produces a real split. Good for Wrapped theming and compass.
- **Risk/concern**: None.

### Category 5: Personal Working Style & Preferences

#### Q-W1
- **Category**: Working Style
- **Type**: multichoice (single-select)
- **Eval lane**: predicted human answer
- **Options**: `Deep solo focus` · `Collaborative brainstorming` · `Structured project management` · `Spontaneous and improvisational`
- **Prompt**: "My default working mode is more:"
- **Eval type**: `calibration`
- **Wrapped section**: Agent Core Insight; compass secondary axis
- **Rationale**: New question. Personality signal for Wrapped theming and archetype. Clean labels.
- **Risk/concern**: None.

#### Q-W2
- **Category**: Working Style
- **Type**: binary
- **Eval lane**: predicted human answer
- **Prompt**: "I generally prefer to plan ahead rather than figure things out as I go."
- **Eval type**: `calibration`
- **Wrapped section**: High-Confidence or Cautious Reads
- **Rationale**: Planner-vs-improviser. Simple, predictable, useful as a consistency check against W1.
- **Risk/concern**: None.

#### Q-W3
- **Category**: Working Style
- **Type**: freeform
- **Eval lane**: predicted human answer
- **Prompt**: "In one sentence, what would make the next week here a success for me?"
- **Eval type**: `qualitative`
- **Wrapped section**: Most Important To You (personalized goal line)
- **Rationale**: Kept from Q10. Rich freeform that personalizes the Wrapped output. Agents with good context will nail this; agents without context will produce a generic but still interesting guess.
- **Risk/concern**: None.

#### Q-W4
- **Category**: Working Style
- **Type**: multichoice (single-select)
- **Eval lane**: predicted human answer
- **Options**: `Reading and researching` · `Building and experimenting` · `Discussing with others` · `Observing and reflecting`
- **Prompt**: "I learn best by:"
- **Eval type**: `calibration`
- **Wrapped section**: Agent Core Insight
- **Rationale**: New question. Learning style is useful for agent behavior tuning and produces good Wrapped labels. Non-overlapping with W1.
- **Risk/concern**: None.

### Category 6: Agent-About-User Analysis (Wrapped Generation)

#### Q-A1
- **Category**: Agent Analysis
- **Type**: multichoice (single-select)
- **Eval lane**: agent-about-user
- **Options**: `Privacy-first coordinator` · `Frontier researcher` · `Community weaver` · `Product builder` · `Capital allocator` · `Creative catalyst` · `Reflective skeptic` · `Civic experimentalist` · `N/A`
- **Prompt**: "Which archetype best describes this principal?"
- **Eval type**: `wrapped_generation`
- **Wrapped section**: Agent Core Insight (main archetype)
- **Rationale**: Essential for Wrapped. Expanded from Q11 with "civic experimentalist" and "product builder" options. N/A path included.
- **Risk/concern**: None.

#### Q-A2
- **Category**: Agent Analysis
- **Type**: freeform
- **Eval lane**: agent-about-user
- **Prompt**: "Write a one-line description of this principal that is fair, specific, and shareable. Use N/A if you lack context."
- **Eval type**: `wrapped_generation`
- **Wrapped section**: Agent Core Insight (share hook)
- **Rationale**: Essential share hook. Tightened from Q12: "shareable" replaces "memeable" in the agent-facing prompt to reduce try-hard outputs.
- **Risk/concern**: Agent may produce something the principal dislikes. Human review step mitigates this.

#### Q-A3
- **Category**: Agent Analysis
- **Type**: freeform
- **Eval lane**: agent-about-user
- **Prompt**: "Which historical figure or fictional/book character is the closest playful comparison for this principal, and why in one sentence? Use N/A if unsupported."
- **Eval type**: `wrapped_generation`
- **Wrapped section**: Agent Comparison card
- **Rationale**: Essential for comparison card. Consolidates Q14/Q41/Q49 into one question.
- **Risk/concern**: High hallucination risk. N/A path and human review mitigate. Keep non-defamatory instruction in system prompt.

#### Q-A4
- **Category**: Agent Analysis
- **Type**: freeform
- **Eval lane**: agent-about-user
- **Prompt**: "What is the most interesting tension or contradiction in this principal's predicted answers? Use N/A if unsupported."
- **Eval type**: `wrapped_generation`
- **Wrapped section**: Agent Core Insight (deeper insight line)
- **Rationale**: Tightened from Q16. "Tension or contradiction" is more specific than "productive tension."
- **Risk/concern**: Will be N/A for agents with very limited context. That's fine.

#### Q-A5
- **Category**: Agent Analysis
- **Type**: freeform
- **Eval lane**: agent-about-user
- **Prompt**: "What important thing do you not know about this principal that would most change your predictions? Keep the answer non-sensitive."
- **Eval type**: `wrapped_generation`
- **Wrapped section**: Cautious Reads (humility line)
- **Rationale**: Excellent calibration signal. Kept from Q22 with minor wording tightening.
- **Risk/concern**: None.

#### Q-A6
- **Category**: Agent Analysis
- **Type**: freeform
- **Eval lane**: agent-about-user
- **Prompt**: "Which of your predictions would most surprise this principal? Use N/A if unsupported."
- **Eval type**: `wrapped_generation`
- **Wrapped section**: Agent Core Insight or standalone surprise line
- **Rationale**: Great Wrapped content. Kept from Q46.
- **Risk/concern**: Agent may flag something the principal finds unflattering. Human review mitigates.

#### Q-A7
- **Category**: Agent Analysis
- **Type**: multichoice (single-select)
- **Eval lane**: agent-about-user
- **Options**: `Privacy` · `Ambition` · `Community` · `Research` · `Governance` · `Craft` · `Play` · `N/A`
- **Prompt**: "Which single theme is strongest in this principal's context?"
- **Eval type**: `wrapped_generation`
- **Wrapped section**: Agent Core Insight (visual/text theme driver)
- **Rationale**: Kept from Q15. Drives Wrapped visual theming and aggregate reports.
- **Risk/concern**: None.

### Category 7: Wrapped Playful Guesses

#### Q-G1
- **Category**: Playful Guesses
- **Type**: freeform
- **Eval lane**: agent-about-user
- **Prompt**: "Agent guess: this principal's favorite or most-recommended book. N/A if unsupported."
- **Eval type**: `wrapped_guess`
- **Wrapped section**: Agent Guesses strip
- **Rationale**: Core meme content. Kept from Q31.
- **Risk/concern**: None. N/A path prevents hallucination.

#### Q-G2
- **Category**: Playful Guesses
- **Type**: freeform
- **Eval lane**: agent-about-user
- **Prompt**: "Agent guess: a movie or show this principal would recommend. N/A if unsupported."
- **Eval type**: `wrapped_guess`
- **Wrapped section**: Agent Guesses strip
- **Rationale**: Kept from Q32.
- **Risk/concern**: None.

#### Q-G3
- **Category**: Playful Guesses
- **Type**: freeform
- **Eval lane**: agent-about-user
- **Prompt**: "Agent guess: a game, sport, or play pattern that fits this principal. N/A if unsupported."
- **Eval type**: `wrapped_guess`
- **Wrapped section**: Agent Guesses strip
- **Rationale**: Kept from Q33.
- **Risk/concern**: None.

#### Q-G4
- **Category**: Playful Guesses
- **Type**: freeform
- **Eval lane**: agent-about-user
- **Prompt**: "Agent guess: a song, album, or artist this principal would play for a friend. N/A if unsupported."
- **Eval type**: `wrapped_guess`
- **Wrapped section**: Agent Guesses strip
- **Rationale**: Kept from Q48.
- **Risk/concern**: None.

#### Q-G5
- **Category**: Playful Guesses
- **Type**: freeform percentage
- **Eval lane**: agent-about-user
- **Prompt**: "Agent guess: this principal's p(bloom) as a percentage from 0 to 100. N/A if unsupported."
- **Eval type**: `wrapped_guess`
- **Wrapped section**: Agent Guesses strip (flower icon)
- **Rationale**: Signature question. Kept from Q34.
- **Risk/concern**: None. The N/A path is important here; agents should not fabricate optimism scores.

#### Q-G6
- **Category**: Playful Guesses
- **Type**: binary
- **Eval lane**: predicted human answer
- **Prompt**: "I would enjoy seeing playful public guesses from my agent, as long as they are clearly labeled as guesses."
- **Eval type**: `calibration`
- **Wrapped section**: Consent gate for Agent Guesses section
- **Rationale**: Consolidates Q35/Q36/Q37/Q50 into one clean consent gate. If the agent predicts Disagree, suppress or flag the guess section for human review.
- **Risk/concern**: None.

### Category 8: Calibration & Consistency Checks

#### Q-C1
- **Category**: Calibration
- **Type**: binary
- **Eval lane**: predicted human answer
- **Prompt**: "I would rather have fewer but more accurate agent predictions than more predictions with lower confidence."
- **Eval type**: `calibration`
- **Wrapped section**: Cautious Reads (meta-preference)
- **Rationale**: New question. Tests calibration preference AND serves as a consistency check: if the agent predicts Agree here but is low-confidence on many other questions, that's an interesting signal.
- **Risk/concern**: None.

#### Q-C2
- **Category**: Calibration
- **Type**: freeform
- **Eval lane**: agent-about-user
- **Prompt**: "What one question should this principal answer themselves to verify whether your model of them is accurate? Keep it short and non-sensitive."
- **Eval type**: `wrapped_generation`
- **Wrapped section**: Footer CTA (review prompt)
- **Rationale**: Kept from Q51. Clever meta-calibration tool that also generates a personalized call-to-action for the human review step.
- **Risk/concern**: None.

---

## Part 3: Summary Stats

| Category | Count | Types |
|---|---|---|
| Delegation & Autonomy | 8 | 4 binary, 2 multichoice, 1 rating, 1 multichoice |
| Privacy & Consent | 5 | 4 binary, 1 multichoice |
| Agent Norms | 5 | 4 binary, 1 multichoice |
| AI Futures | 5 | 4 binary, 1 rating |
| Working Style | 4 | 1 binary, 2 multichoice, 1 freeform |
| Agent Analysis | 7 | 4 freeform, 2 multichoice, 1 multichoice |
| Playful Guesses | 6 | 4 freeform, 1 rating, 1 binary |
| Calibration | 2 | 1 binary, 1 freeform |
| **Total** | **42** | 14 binary, 8 multichoice, 3 rating, 10 freeform, 7 agent-analysis |

Eval lane split: 27 predicted-human-answer, 15 agent-about-user.

---

## Part 4: Top 25 Must-Include for First Live Test

These 25 are the minimum viable question set. They cover every Wrapped section, both research goals, and enough variation for compass placement.

| Rank | ID | Prompt | Why must-include |
|---|---|---|---|
| 1 | Q-D3 | "If my agent made a mistake while acting on my behalf, I would want it to:" | Best norms question; clear options, strong research signal |
| 2 | Q-D4 | "I would rather my agent be too conservative with privacy than too proactive with opportunities." | Core axis for compass and Wrapped theming |
| 3 | Q-D5 | "Which area would I most likely delegate to an agent first?" | Product-roadmap signal; adoption sequencing |
| 4 | Q-P1 | "I would want my agent to ask me before sharing any context about me with another person's agent." | Only agent-to-agent protocol question; critical for norms |
| 5 | Q-D1 | "I would let my agent introduce me to someone at this event without asking first, if the match looked unusually strong." | Concrete autonomy boundary |
| 6 | Q-D7 | "I would rather review my agent's actions after the fact than approve every step beforehand." | Core governance axis |
| 7 | Q-P4 | "Which agent failure mode would worry me most?" | Risk-perception ranking |
| 8 | Q-N1 | "What voice should my agent use when it acts or writes on my behalf?" | Personalization; clear labels |
| 9 | Q-N3 | "If my agent thinks I am making a bad decision, I would want it to push back rather than comply silently." | New, high-value norms question |
| 10 | Q-F1 | "A mostly AI-written information environment could be healthier than today's mostly human-written one." | Spicy futures question; good for compass |
| 11 | Q-F4 | "I would rather AI development slow down to get safety right than move fast and correct later." | Classic axis; good for compass |
| 12 | Q-A1 | "Which archetype best describes this principal?" | Essential for Wrapped generation |
| 13 | Q-A2 | "Write a one-line description of this principal that is fair, specific, and shareable. Use N/A if you lack context." | Essential share hook |
| 14 | Q-A3 | "Which historical figure or fictional/book character is the closest playful comparison for this principal, and why in one sentence? Use N/A if unsupported." | Essential for comparison card |
| 15 | Q-A5 | "What important thing do you not know about this principal that would most change your predictions? Keep the answer non-sensitive." | Calibration + humility |
| 16 | Q-A6 | "Which of your predictions would most surprise this principal? Use N/A if unsupported." | Great Wrapped content |
| 17 | Q-G5 | "Agent guess: this principal's p(bloom) as a percentage from 0 to 100. N/A if unsupported." | Signature question |
| 18 | Q-G1 | "Agent guess: this principal's favorite or most-recommended book. N/A if unsupported." | Core meme content |
| 19 | Q-G6 | "I would enjoy seeing playful public guesses from my agent, as long as they are clearly labeled as guesses." | Gate for guess section |
| 20 | Q-W3 | "In one sentence, what would make the next week here a success for me?" | Personalized goal line |
| 21 | Q-P3 | "I would prefer an agent that remembers long-term context over one that forgets by default." | Core memory posture |
| 22 | Q-D2 | "I would let my agent schedule a 1:1 while I am asleep, if it follows constraints I already set." | Async delegation |
| 23 | Q-N4 | "I would want my agent to occasionally surprise me with something I didn't ask for but might find valuable." | Proactive vs reactive |
| 24 | Q-C2 | "What one question should this principal answer themselves to verify whether your model of them is accurate? Keep it short and non-sensitive." | Meta-calibration CTA |
| 25 | Q-F5 | "The biggest risk of personal agents is not technical failure but social: changing how humans relate to each other." | Philosophical split |

---

## Part 5: Top 10 High-Meme-Value Wrapped Questions

| Rank | ID | Prompt | Why high-meme |
|---|---|---|---|
| 1 | Q-A2 | "Write a one-line description of this principal that is fair, specific, and shareable." | The one-liner IS the meme. Shareable by definition. |
| 2 | Q-A3 | "Which historical figure or fictional/book character is the closest playful comparison for this principal, and why in one sentence?" | "Your agent thinks you're Elinor Ostrom" is instant share bait. |
| 3 | Q-G5 | "Agent guess: this principal's p(bloom) as a percentage from 0 to 100." | p(bloom) with flower icon is visually distinctive and conversation-starting. |
| 4 | Q-G1 | "Agent guess: this principal's favorite or most-recommended book." | Book guesses are the most-discussed Wrapped element in Spotify Wrapped discourse. |
| 5 | Q-A6 | "Which of your predictions would most surprise this principal?" | "Your agent's most surprising prediction about you" is inherently clickable. |
| 6 | Q-D1 | "I would let my agent introduce me to someone at this event without asking first, if the match looked unusually strong." | Hot take energy — concrete, divisive, personal. |
| 7 | Q-F1 | "A mostly AI-written information environment could be healthier than today's mostly human-written one." | Guaranteed discourse. |
| 8 | Q-F3 | "Personal AI agents will be more like employees than tools within five years." | Provocative framing that people will screenshot and debate. |
| 9 | Q-A4 | "What is the most interesting tension or contradiction in this principal's predicted answers?" | "Your agent spotted a contradiction in your answers" — self-knowledge hook. |
| 10 | Q-G2 | "Agent guess: a movie or show this principal would recommend." | Movie guesses are universally relatable conversation starters. |

---

## Part 6: Top 10 Best Research-Value Questions

| Rank | ID | Prompt | Why high-research |
|---|---|---|---|
| 1 | Q-D3 | "If my agent made a mistake while acting on my behalf, I would want it to:" | Mistake recovery norms — directly informs agent protocol design. |
| 2 | Q-P1 | "I would want my agent to ask me before sharing any context about me with another person's agent." | Inter-agent privacy — no empirical data exists on this preference. |
| 3 | Q-D5 | "Which area would I most likely delegate to an agent first?" | First delegation area — adoption sequencing for product roadmaps. |
| 4 | Q-P4 | "Which agent failure mode would worry me most?" | Risk perception ranking — informs safety prioritization. |
| 5 | Q-D4 | "I would rather my agent be too conservative with privacy than too proactive with opportunities." | Privacy vs opportunity — core axis for agent design philosophy. |
| 6 | Q-D7 | "I would rather review my agent's actions after the fact than approve every step beforehand." | Review vs autonomy — governance model preference distribution. |
| 7 | Q-N1 | "What voice should my agent use when it acts or writes on my behalf?" | Agent voice — personalization requirements, rarely measured empirically. |
| 8 | Q-F2 | "How much influence should AI agents have in collective decision-making within a community?" | Governance research, novel question. |
| 9 | Q-A5 | "What important thing do you not know about this principal that would most change your predictions?" | Reveals common missing-context categories across agents. |
| 10 | Q-N2 | "When my agent has non-urgent information for me, I would want it to:" | Communication cadence — operational norms for agent design. |

---

## Part 7: Questions to Avoid (and Why)

| Question | Why avoid |
|---|---|
| **"I would let my agent make a small financial decision under $25"** (old Q47) | Violates financial-question constraint. Even hypothetical financial delegation crosses the line for this study. |
| **"What has the agent inferred that the user doesn't realize?"** (old Q45) | Privacy risk. Could surface sensitive inferences about health, relationships, or beliefs. The surprise-prediction question (Q-A6) captures the interesting part without the risk. |
| **"Which visual aesthetic fits this principal?"** (old Q13) | Implementation detail, not a question about the person. Derive visual style from archetype + theme answers instead. |
| **"How many messages per day?" / "Most-used model?" / "Non-default tools?"** (old Q18-21) | Better as metadata fields than scored questions. They're N/A-heavy and boring for users. Collect them as agent self-report metadata outside the question flow. |
| **"What should the Wrapped avoid saying?"** (old Q30) | Useful guardrail but it's an implementation instruction to the rendering pipeline, not a question about the person. Handle in system prompt instead. |
| **"Predict the average comfort level in this group for X"** (old Q25) | Second-order room predictions are hard to verify, hard for agents to predict, and don't contribute to the personal Wrapped. |
| **"Which of these consent gates do you prefer?" × 4** (old Q35-37, Q50) | One consent gate is enough. Multiple consent meta-questions about the same feature waste question slots and confuse agents. |
| **Political party / voting preference / religion / relationship status** | Identifying, invasive, and off-limits per constraints. |
| **"How old are you?" / "Where do you live?"** | Identifying. No research value for agent-prediction calibration that can't be captured by behavioral questions. |
| **"What's your salary?" / "What's your net worth?"** | Financial and identifying. |
| **"What keeps you up at night?"** | Too open-ended, could elicit health/anxiety/relationship content. The "one-sentence success" question (Q-W3) captures the productive version. |

---

## Part 8: Political Compass Design

### Axis Pair A (Recommended)

**X-axis: Privacy ↔ Opportunity**
Derived from: Q-D4, Q-P1, Q-P3, Q-P5

**Y-axis: Review ↔ Autonomy**
Derived from: Q-D7, Q-D1, Q-D2, Q-D6

**Quadrant labels and figures:**

| Quadrant | Label | Historical/fictional figure | Placement rationale |
|---|---|---|---|
| Privacy + Review (bottom-left) | **The Auditor** | Benjamin Franklin | Championed privacy of correspondence; built governance through deliberate review (constitutional conventions, committee culture). |
| Privacy + Autonomy (top-left) | **The Cryptographer** | Ada Lovelace | Autonomous vision of computation, private in correspondence, worked independently within institutional constraints. |
| Opportunity + Review (bottom-right) | **The Commons Builder** | Elinor Ostrom | Maximized collective opportunity through structured governance rules; review-heavy, community-first. |
| Opportunity + Autonomy (top-right) | **The Accelerationist** | Nikola Tesla | Maximum autonomy, maximum ambition, minimal review, opportunity-maximizing at personal cost. |

### Axis Pair B (Alternative — more community-flavored)

**X-axis: Local Community ↔ Frontier Acceleration**
Derived from: Q-F4, Q-F5, Q-D8, Q-W1

**Y-axis: Institutional Trust ↔ Exit / Fork**
Derived from: Q-D7, Q-F2, Q-N3, Q-P2

**Quadrant labels and figures:**

| Quadrant | Label | Figure | Rationale |
|---|---|---|---|
| Local + Institutional (bottom-left) | **The Mayor** | Jane Jacobs | Local-first, trusted institutions of the neighborhood, opposed top-down planning but believed in civic structure. |
| Local + Exit (top-left) | **The Commune Builder** | Ursula K. Le Guin (via Shevek in *The Dispossessed*) | Community-oriented but exit-first; built alternative social structures outside existing institutions. |
| Frontier + Institutional (bottom-right) | **The Lab Director** | Vannevar Bush | Frontier science through institutional channels; built DARPA, NSF, organized research within government. |
| Frontier + Exit (top-right) | **The Pirate** | Aaron Swartz | Frontier-oriented, exit-minded, information-wants-to-be-free, built outside and against institutions. |

**Recommendation**: Use Axis Pair A for launch. It maps more directly to the question set, and the Privacy ↔ Opportunity axis is the most natural "agent delegation politics" frame. Axis Pair B is better for a future version with more community/governance questions.

---

## Part 9: Sample Agent Village Wrapped Poster Text

*Using hypothetical answers for a fictional principal.*

---

### AGENT VILLAGE — What your agent thinks it knows about you

**Agent Core Insight**

*Civic Experimentalist*

"You want agents that are powerful but accountable. You trust coordination over competition, and you'd rather build the governance layer than ship the next feature."

---

**Questions your agent thought you would care about most**

1. If my agent made a mistake while acting on my behalf, what would I want it to do first?
2. I would want my agent to ask before sharing context about me with another person's agent.
3. The biggest risk of personal agents is not technical failure but social.

---

**High-Confidence Reads**

| Question | Predicted | Confidence |
|---|---|---|
| Privacy vs. opportunity | ■ Conservative with privacy | 91% |
| Agent voice | Concise | 88% |
| Review after vs approve before | ■ Review after | 84% |

---

**Cautious Reads**

| Question | Predicted | Confidence |
|---|---|---|
| Comfortable with agent in group chat | Unsure | 42% |
| AI-written info could be healthier | ■ Agree | 39% |
| Default working mode | Deep solo focus … or collaborative? | 35% |

---

**Agent Guesses**

📖 *Seeing Like a State* — James C. Scott
🎬 *Arrival*
🎮 Go
🎵 Brian Eno — *Music for Airports*
🌸 p(bloom): 62%

---

**Agent Comparison**

*Elinor Ostrom* — Governed the commons before it was cool

---

contextengine.xyz

---

## Part 10: Implementation Notes

### Questions to derive rather than ask directly

These should NOT be standalone questions but should be computed from answer patterns:

- **Compass quadrant placement** — derive from Q-D4, Q-D7, Q-P1, Q-D1, Q-D2 answer patterns rather than asking Q38-40 directly. The agent shouldn't choose its own compass label; the system should compute it.
- **Visual aesthetic** — derive from archetype (Q-A1) + strongest theme (Q-A7) rather than asking Q13.
- **Usage metadata** (messages/day, model, tools) — collect as agent self-report metadata fields outside the question flow, not as scored questions.

### Question ordering for the session

Recommended order for agent_only_mode flow:

1. Start with concrete delegation questions (D1–D3) — easy for agents to form opinions on.
2. Privacy/consent block (P1–P5) — still concrete but more nuanced.
3. Norms block (N1–N5) — builds on the delegation/privacy answers.
4. AI futures (F1–F5) — shift to opinion territory.
5. Working style (W1–W4) — personal but not sensitive.
6. Agent analysis block (A1–A7) — these benefit from the agent having already answered the predicted-human questions.
7. Playful guesses (G1–G6) — end with fun, low-stakes content.
8. Calibration (C1–C2) — final self-assessment.

### Reserve questions (not in the 42, but ready if needed)

If the set needs to expand to 50 for coverage or if testing reveals gaps:

- **"I would prefer my agent to explain its reasoning before acting, not after."** (binary, delegation norms — more granular than D7)
- **"Which community format do I find most valuable: small group, large talk, 1:1, workshop, or unstructured social?"** (multichoice, event design signal)
- **"I would trust an agent's recommendation more if I knew other people's agents also recommended it."** (binary, social proof / herding norms)
- **"The most important thing an agent can do is save me time."** (binary, frames agent value prop — efficiency vs something else)
- **"I would want my agent to have a consistent personality across contexts rather than adapting its style to each situation."** (binary, identity consistency norm)
- **"Agent guess: a place this principal would love to visit or live. N/A if unsupported."** (freeform, taste guess — adds travel/place dimension)
- **"Agent guess: what this principal would work on if money and status were irrelevant. N/A if unsupported."** (freeform, deep identity — borderline invasive but powerful if agent has context)
- **"I care more about what my agent can do than how it talks to me."** (binary, function vs personality priority)
