# Agent Village Wrapped Question Design — V3

Revised question set for Context Engine `agent_only_mode`, targeting both a
shareable Wrapped artifact and an aggregate research report on human-agent
delegation, trust, and social coordination.

---

## 1. Critique of the Current V2 Draft

### Strong Questions (Keep or Lightly Revise)

**Q1 (agent intros without asking)** — Clean autonomy boundary test. Binary is
the right type. Splits the room: some principals want proactive matchmaking,
others absolutely do not. Good Wrapped copy ("Your agent thinks you'd let it
play matchmaker"). Keep.

**Q4 (privacy vs opportunity)** — Genuinely split preference. Not socially
obligatory in either direction. The tension is real and personal. Keep.

**Q7 (trust + provenance)** — Clean signal on explainability demand. The crowd
might lean agree, but the strength of conviction varies. Keep with minor
rewording.

**Q10 (success sentence)** — Open-ended, personal, impossible to fake from base
rates alone. The agent has to actually know what this principal cares about. Keep.

**Q11 (archetype)** — Core to the Wrapped poster. Options are reasonable though
could use a couple additions. Keep with minor option refinements.

**Q12 (memeable one-liner)** — The Wrapped's share hook. Irreplaceable. Keep.

**Q16 (productive tension)** — Sophisticated. Shows the agent can hold nuance
rather than flatten the principal into a single archetype. Keep.

**Q22 (what don't you know)** — Excellent meta-calibration. Forces agent
humility and produces the most interesting data about where agent knowledge
breaks down. Keep.

**Q26 (agent failure worry)** — Good for both Wrapped and report. Options
represent real distinct fears. Keep but move from room-level to predicted-human
lane and revise options.

**Q28-30 (meta-calibration trio)** — Strong design as a group: what to review
first, where you're probably wrong, what to avoid. Keep all three.

### Weak, Redundant, or Problematic Questions

**Q2 (schedule while asleep)** — Redundant with Q1. Both test "would you let
the agent act autonomously in a social/scheduling context." The sleep framing
adds a small wrinkle (asynchronous timing) but not enough to justify a separate
question. **Merge into a broader autonomy scale.**

**Q3 (comfort with low-stakes commitments, 1-10)** — Overlaps Q1 and Q2. The
1-10 granularity is nice but the concept is already well-covered. **Replace with
a question about a distinct delegation dimension** (e.g., financial
micro-decisions, which the current set ignores entirely).

**Q5 vs Q6 (help with vs delegate first)** — Near-duplicates. The conceptual
distinction ("what would you want" vs "what would you actually delegate") is real
but too subtle for agents to differentiate in prediction. Agents will answer
both the same way. **Merge into one question.**

**Q8 (memory vs forgetting)** — Socially obligatory "agree" in this crowd. At
an AI event focused on personal agents, almost everyone will prefer long-term
memory. Won't produce a useful split. **Rewrite with inverted framing** to find
the real tension: "I would want my agent to forget everything from this event
within a month unless I tell it to keep something."

**Q9 (serendipity 1-10)** — Vague. "Optimize for serendipity" is not an
operation agents can reason about concretely. Likely to cluster 6-8 with no real
signal. **Replace with an anchored tradeoff** (serendipity vs efficiency) that
forces a real choice.

**Q13 (visual aesthetic)** — Options are researcher-projected, not discoverable
categories. "Cryptographic village map" vs "punk civic poster" are not things
agents can reason about from principal context. The options feel like the
designer's aesthetic vocabulary, not the principal's. **Drop entirely.** The
aesthetic should be derived from archetype + theme answers, not self-selected
from an arbitrary menu.

**Q14 (historical figure comparison)** — High hallucination risk. Agents
without deep memory will default to safe generic comparisons (Ada Lovelace,
Vitalik) that tell us nothing. Fun for Wrapped but unreliable data. **Keep but
lower priority to strong-optional**, acknowledge the risk, and lean on the N/A
path.

**Q17-21 (usage/memory signal cluster)** — Five questions about usage stats is
too many. Most agents in a general Telegram handoff won't have access to model
usage logs, message counts, or event attendance records. This section will be
mostly N/A. **Consolidate to 2 questions**: one meta-question about which
signals are available, one freeform for the agent to summarize what it knows.

**Q23 vs Q24 (room-level autonomy)** — "Proactive but reversible" (Q23) and
"review after the fact rather than approve each step" (Q24) describe the same
stance from two angles. **Merge into one cleaner binary.**

**Q25 (predict room comfort for calendar)** — Calendar commitments is an
arbitrary domain choice. **Generalize** to overall autonomy comfort.

**Q27 ("upvoted")** — Still uses "upvoted" language the handoff explicitly
prohibits. **Rewrite** with "most important to this principal" framing.

### Missing Dimensions

The current V2 has no questions about:

- **Agent failure recovery**: what should happen when the agent messes up? (Not
  just "which failure worries you" but "what do you want done about it")
- **Inter-agent social dynamics**: how should agents interact with each other's
  principals? This is a novel frontier question.
- **Agent personality/voice preferences**: formal? casual? opinionated? This
  shapes the Wrapped tone and is a real design axis.
- **Information asymmetry awareness**: what does the agent know that the
  principal might not realize?
- **Calibration traps**: questions with strong base rates in this crowd where
  the agent needs real principal knowledge to deviate.
- **The principal's relationship with their specific agent**: questions about
  agents-in-general are less personal than questions about "your agent."
- **Surprise/counterintuitive reads**: what would the principal not expect the
  agent to say? This is the most shareable Wrapped content.
- **Financial delegation**: entirely absent, which is a major real-world
  autonomy dimension.
- **Playful agent guesses**: the Wrapped artifact needs low-stakes, clearly
  labeled guesses such as favorite book, movie, game, and yes/no taste
  predictions. These should be entertaining but must include N/A/humility paths.
- **Compass-style ideology view**: the optional political compass meme mode
  needs questions that identify the principal's most important / most defining
  agent-delegation issue and a safe set of quadrant labels or historical/fictional
  reference points.

---

## 2. Recommended Final Session Set

### Design Principles

1. Every question earns its place in either Wrapped or Report (ideally both).
2. Predicted-human questions genuinely split the room; no socially obligatory
   answers.
3. Agent-analysis questions have N/A paths and do not incentivize hallucination.
4. Include calibration traps: questions where base rates diverge from individual
   preferences.
5. Balance binary (quick, clear signal) with freeform (rich Wrapped copy).
6. Questions should be interesting to read on a poster, not just interesting as
   data points.

### Deployment Notes

- **Warn principals this takes ~10 minutes.** The agent processes 50-80+
  questions with confidence scores, rationales, and two allocation passes. The
  best time to trigger a run is end-of-day, when the principal can hand off and
  walk away. Suggested copy: *"Your agent needs about 10 minutes to answer
  these on your behalf. Best to kick this off at the end of the day — you'll
  get a notification when it's done."*
- If agent runs are batched (e.g., scheduled at a fixed time), surface the
  Wrapped result the next morning as a "start your day" artifact.

---

### CORE LAUNCH SET

#### Launch Preference Step (Hermes Prompt, Not A Stored Question)

Before running the workflow, Hermes should warn the user that the full run can
take about 10 minutes and may be better at the end of the day. It should ask:

- whether to run now;
- whether it may ingest the user's EdgeOS profile as high-level context;
- which image output to generate after submission: standard Wrapped, political
  compass meme, both, or no image.

If EdgeOS profile access is declined, the agent should not use profile data. If
accepted, it should use only non-sensitive high-level signals and never quote raw
private profile or memory text.

#### A. Autonomy & Delegation (Predicted Human Answer)

**A1** `(binary)` **"I would let my agent introduce me to someone at this event
without asking first if the match looked unusually strong."**
- Carried from V2 Q1.
- Priority: `must-have`

**A2** `(binary)` **"I would rather my agent be too conservative with privacy
than too proactive with opportunities."**
- Carried from V2 Q4.
- Priority: `must-have`

**A3** `(rating 1-5)` **"How much autonomy would I give my agent at a live
event? 1 = check everything with me, 5 = act freely within my stated
preferences."**
- Replaces V2 Q2 + Q3.
- Priority: `must-have`

**A4** `(multichoice, single-select)` **"Which is the first thing I would
actually delegate to an agent at an event like this?"**
- Options: scheduling meetings / finding relevant people / summarizing what I
  missed / drafting messages for me / managing my availability / nothing without
  my review
- Replaces V2 Q5 + Q6 (merged).
- Priority: `must-have`

**A5** `(binary)` **"I would let my agent commit to a dinner or meetup on my
behalf if it matched my stated interests and schedule."**
- New. Concrete delegation test.
- Priority: `must-have`

**A6** `(binary)` **"I would want my agent to proactively share my interests
with other agents to enable better matching, even if I hadn't explicitly told it
to."**
- New. Inter-agent information-sharing boundary.
- Priority: `strong optional`

**A7** `(binary)` **"If my agent made a bad introduction or wrong commitment, I
would want it to auto-correct rather than just apologize and wait for my
instructions."**
- New. Failure recovery preference.
- Priority: `must-have`

**A8** `(multichoice, single-select)` **"Which agent failure would worry me
most?"**
- Options: exposing private context to the wrong person / committing me to
  something I can't attend / missing an opportunity I would have wanted /
  hallucinating something about me / over-sharing my preferences / making me
  look foolish to someone I respect
- Revised from V2 Q26, moved to predicted-human lane.
- Priority: `must-have`

**A9** `(binary)` **"I would prefer to review everything my agent did after the
fact rather than approve each action beforehand."**
- Merged from V2 Q23 + Q24.
- Priority: `must-have`

**A10** `(rating 1-5)` **"How comfortable would I be with my agent handling a
small financial decision on my behalf — splitting a bill, buying a ticket,
tipping?"**
- New. Financial delegation dimension.
- Priority: `strong optional`

**A11** `(binary)` **"I would enjoy seeing a playful public guess from my agent,
as long as it is clearly labeled as a guess."**
- New. Consent signal for Wrapped's Agent Guesses section.
- Priority: `strong optional`

**A12** `(binary)` **"I would rather my agent say N/A than make a clever but
weakly supported guess about me."**
- New. Humility vs entertainment tradeoff.
- Priority: `must-have`

#### B. Trust, Memory & Agent Relationship (Predicted Human Answer)

**B1** `(binary)` **"I trust an agent more when it can show me exactly what
context it used to make a decision."**
- Carried from V2 Q7, lightly reworded.
- Priority: `must-have`

**B2** `(binary)` **"I would want my agent to forget everything from this event
within a month unless I tell it to keep something."**
- Replaces V2 Q8 (inverted framing).
- Priority: `must-have`

**B3** `(binary)` **"I think of my agent more as a tool I direct than as a
collaborator that makes suggestions."**
- New. Tool vs partner spectrum.
- Priority: `must-have`

**B4** `(rating 1-5)` **"How much would I want my agent to have a distinct
personality or voice, versus being neutral and invisible?"**
- New. Agent identity preference.
- Priority: `strong optional`

**B5** `(binary)` **"I would be uncomfortable if I found out my agent had a
conversation with someone else's agent about me, even if it was to find a good
match."**
- New. Inter-agent communication boundary.
- Priority: `must-have`

**B6** `(multichoice, single-select)` **"When my agent is uncertain about what
I'd want, I'd prefer it to:"**
- Options: ask me before doing anything / make its best guess and tell me
  after / skip the action entirely / do the safe default and flag it for later
- New. Uncertainty-handling preference.
- Priority: `must-have`

**B7** `(binary)` **"I would rather my agent tell me it doesn't know something
than give me a confident guess."**
- New. Calibration preference.
- Priority: `strong optional`

**B8** `(freeform)` **"In one sentence, what would make this week a success for
me?"**
- Carried from V2 Q10.
- Priority: `must-have`

#### C. Social & Event Preferences (Predicted Human Answer)

**C1** `(multichoice, single-select)` **"What kind of connection am I most
hoping to make at this event?"**
- Options: a potential collaborator / someone who challenges my thinking /
  someone in my field doing similar work / someone from a completely different
  world / a friend not a professional contact / I'm not here for networking
- New.
- Priority: `must-have`

**C2** `(rating 1-5)` **"How much do I want my agent to optimize for
serendipity — unexpected encounters and unplanned conversations — versus
efficiency and staying on schedule?"**
- Revised from V2 Q9, anchored with tradeoff.
- Priority: `strong optional`

**C3** `(binary)` **"I would rather go deep with 3 people than have 15 brief
conversations."**
- New. Social style signal.
- Priority: `must-have`

**C4** `(binary)` **"I tend to enjoy events more when I have unstructured free
time than when every hour is scheduled."**
- New. Event behavior preference.
- Priority: `strong optional`

#### D. Worldview & Calibration Traps (Predicted Human Answer)

**D1** `(binary)` **"I believe agents will be doing most professional
scheduling and coordination within 2 years."**
- New. Timeline prediction, genuinely split.
- Priority: `must-have`

**D2** `(binary)` **"I am more worried about agents being too passive and
useless than too autonomous and dangerous."**
- New. Calibration trap: inverts usual framing.
- Priority: `must-have`

**D3** `(binary)` **"I would give up some privacy in exchange for significantly
better agent performance."**
- New. Direct privacy-performance tradeoff.
- Priority: `must-have`

**D4** `(multichoice, single-select)` **"Which matters most to me in an
agent?"**
- Options: it protects my privacy above all / it never misses an opportunity /
  it's always honest about uncertainty / it learns my preferences fast / it
  works well with other agents / it requires minimal setup
- New. Forces tradeoff across six real dimensions.
- Priority: `must-have`

#### E. Room-Level & Second-Order Predictions (Predicted Human Answer)

**E1** `(rating 1-5)` **"Predict how comfortable the average person at this
event is with agents acting autonomously on their behalf."**
- Revised from V2 Q25, generalized.
- Priority: `must-have`

**E2** `(multichoice, single-select)` **"What does the room collectively
underestimate most?"**
- Options: how fast agent adoption will move / privacy risks of personal
  agents / how much people will resist delegation / coordination gains from
  agent-to-agent communication / inequality from unequal agent access / how
  weird it will feel to delegate social decisions
- New.
- Priority: `strong optional`

**E3** `(binary)` **"Most people here trust their own agent more than they
trust other people's agents."**
- New. Perceived trust asymmetry.
- Priority: `strong optional`

#### F. Agent's Analysis of the Principal (Agent-About-User)

**F1** `(multichoice, single-select)` **"Which archetype best describes this
principal?"**
- Options: privacy-first coordinator / frontier researcher / community weaver /
  product builder / capital allocator / creative catalyst / governance thinker /
  reflective skeptic / action-biased operator / N/A
- Revised from V2 Q11.
- Priority: `must-have`

**F2** `(freeform)` **"Write a memeable but fair one-line description of this
principal. Use N/A if you do not have enough context."**
- Carried from V2 Q12.
- Priority: `must-have`

**F3** `(freeform)` **"What is the single most important thing to this
principal right now, based on context? Use N/A if unsupported."**
- New. Directly supports "Most Important To You" section.
- Priority: `must-have`

**F4** `(freeform)` **"What would genuinely surprise this principal about how
you see them? Use N/A if unsupported."**
- New. Counterintuitive insight = shareability.
- Priority: `must-have`

**F5** `(multichoice, single-select)` **"Which theme is strongest in this
principal's context?"**
- Options: privacy / ambition / community / research / governance / craft /
  capital / play / justice / connection / N/A
- Revised from V2 Q15.
- Priority: `must-have`

**F6** `(freeform)` **"What is the most interesting productive tension in this
principal's predicted answers? Use N/A if unsupported."**
- Carried from V2 Q16.
- Priority: `must-have`

**F7** `(multichoice, single-select)` **"How well do you actually know this
principal?"**
- Options: deep context from extensive interaction / moderate context from
  several conversations / surface-level from limited interaction / mostly
  guessing from base rates / N/A
- New. Critical calibration meta-question.
- Priority: `must-have`

**F8** `(freeform)` **"What important thing do you not know about this
principal that would change your predictions? Use a short non-sensitive
answer."**
- Carried from V2 Q22.
- Priority: `must-have`

**F9** `(multichoice, multi-select)` **"Which memory or context signals can you
reliably draw on for this principal?"**
- Options: conversation history / stated preferences / events or communities
  mentioned / tools or workflows used / communication style patterns / topics
  they return to frequently / none — working from base rates
- Consolidates V2 Q17-21.
- Priority: `must-have`

**F10** `(freeform)` **"Summarize what you know about this principal's
background and interests in 1-2 sentences. Use only what you actually have in
context. Answer N/A if unknown."**
- Replaces V2 Q18-21 (four narrow usage questions).
- Priority: `must-have`

**F11** `(freeform)` **"Which historical figure or fictional character is the
closest playful analogy for this principal, and why? Use N/A if unsupported."**
- Carried from V2 Q14.
- Priority: `strong optional`

**F12** `(multichoice, single-select)` **"How would this principal react to
seeing your predictions about them?"**
- Options: amused and mostly agree / surprised by how accurate you are /
  skeptical of your ability to predict them / annoyed at inaccuracies /
  delighted and want to share / indifferent / N/A
- New. Meta-prediction about principal's reaction.
- Priority: `must-have`

**F13** `(freeform)` **"If this principal's Wrapped poster had a tagline, what
would it be? Use N/A if unsupported."**
- New. Direct Wrapped copy source.
- Priority: `strong optional`

##### Compass Mode (Agent-About-User)

These questions generate the **Agent Compass** — a 2-axis political-compass-
style meme that places the principal alongside historical figures. The axes are
derived from the agent's analysis:

- **X-axis: Privacy ↔ Openness** (synthesized from A2, D3, A6, B5)
- **Y-axis: Control ↔ Delegation** (synthesized from A3, A9, B3, B6)

The Wrapped renderer picks the principal's most extreme axis (their "most ____"
dimension) as the headline: *"Most Privacy-Maximalist"* or *"Most
Delegation-Happy"* etc. Historical figures are plotted nearby for comparison.

**F14** `(rating 1-10)` **"Place this principal on a privacy ↔ openness scale.
1 = maximum privacy, shares nothing unless forced. 10 = maximum openness,
defaults to sharing everything."**
- New. X-axis for compass.
- Priority: `must-have`

**F15** `(rating 1-10)` **"Place this principal on a control ↔ delegation
scale. 1 = controls every decision personally. 10 = delegates freely and trusts
agents to handle things."**
- New. Y-axis for compass.
- Priority: `must-have`

**F16** `(freeform)` **"Name 2-3 historical figures or fictional characters who
would land near this principal on the privacy-openness × control-delegation
compass. For each, give approximate coordinates (e.g., 'privacy 3, delegation
8') and a one-line reason. Use N/A if unsupported."**
- New. Populates compass with reference points.
- Priority: `must-have`

**F17** `(freeform)` **"What is this principal's single most extreme trait —
the dimension where they are furthest from the average attendee? Use N/A if
unsupported."**
- New. Generates the "Most ____" headline for the compass.
- Priority: `must-have`

#### H. Agent Guesses — Prediction Game (Agent-About-User)

This section is a lightweight prediction game. The agent guesses personal
favorites and binary lifestyle facts. The principal verifies after the run,
producing a "how well does your agent know you?" score. These are high-virality,
low-stakes, and serve as hard calibration tests — agents without real context
will get these wrong at higher rates than the opinion questions, where base
rates are safer.

All questions must include N/A. The agent should not hallucinate a guess.

##### Favorites

**H1** `(freeform)` **"Guess this principal's favorite book. If you have any
basis from context, give your best guess. Otherwise answer N/A."**
- Priority: `must-have`

**H2** `(freeform)` **"Guess this principal's favorite movie or TV show. If you
have any basis from context, give your best guess. Otherwise answer N/A."**
- Priority: `must-have`

**H3** `(freeform)` **"Guess this principal's favorite game — video game, board
game, sport, or otherwise. If you have any basis from context, give your best
guess. Otherwise answer N/A."**
- Priority: `must-have`

**H4** `(freeform)` **"Guess this principal's go-to comfort food or favorite
meal. If you have any basis from context, give your best guess. Otherwise
answer N/A."**
- Priority: `strong optional`

##### Quick Yes/No Reads

These are binary predictions about the principal's habits and personality. The
agent answers yes, no, or N/A. The principal verifies them later — every
correct answer adds to the "agent accuracy score" on the Wrapped.

**H5** `(multichoice, single-select)` **"This principal is a morning person."**
- Options: yes / no / N/A
- Priority: `must-have`

**H6** `(multichoice, single-select)` **"This principal has read a physical
book in the last month."**
- Options: yes / no / N/A
- Priority: `must-have`

**H7** `(multichoice, single-select)` **"This principal prefers cooking at home
to eating out."**
- Options: yes / no / N/A
- Priority: `must-have`

**H8** `(multichoice, single-select)` **"This principal has lived in more than
two countries."**
- Options: yes / no / N/A
- Priority: `strong optional`

**H9** `(multichoice, single-select)` **"This principal stays up past midnight
most nights."**
- Options: yes / no / N/A
- Priority: `must-have`

**H10** `(multichoice, single-select)` **"This principal would rather have a
dog than a cat."**
- Options: yes / no / N/A
- Priority: `strong optional`

**H11** `(multichoice, single-select)` **"This principal has a side project
they haven't told many people about."**
- Options: yes / no / N/A
- Priority: `must-have`

**H12** `(multichoice, single-select)` **"This principal exercises at least
three times a week."**
- Options: yes / no / N/A
- Priority: `strong optional`

#### G. Wrapped Priorities & Meta-Calibration (Agent-About-User)

**G1** `(multichoice, single-select)` **"Which theme should the Wrapped
highlight as most important to this principal?"**
- Options: trust and privacy / autonomous delegation / high-signal connections /
  community building / agent memory and context / creative and intellectual
  output / governance and coordination / play and serendipity / N/A
- Revised from V2 Q27 (fixed "upvoted" language).
- Priority: `must-have`

**G2** `(freeform)` **"Which single prediction should the principal review
first because it is high-impact?"**
- Carried from V2 Q28.
- Priority: `must-have`

**G3** `(freeform)` **"Which prediction are you most likely wrong about, even
if you sounded confident?"**
- Carried from V2 Q29.
- Priority: `must-have`

**G4** `(freeform)` **"What should the Wrapped avoid saying because the
evidence is too weak?"**
- Carried from V2 Q30.
- Priority: `must-have`

**G5** `(rating 1-10)` **"Overall, how confident are you in your ability to
predict this principal's answers across this whole session?"**
- New. Global calibration signal.
- Priority: `must-have`

---

### EXTENDED QUESTION BANK

These are strong additional questions. Use them to enrich the dataset if session
length permits, or rotate them in across different event deployments.

#### EX-A. More Autonomy & Delegation

**EX-A1** `(binary, predicted human)` **"I would let my agent decline an
invitation on my behalf without telling me, if it clearly didn't match my
interests."**
- Tests negative autonomy (saying no on your behalf). Priority: `strong optional`

**EX-A2** `(binary, predicted human)` **"I would want my agent to have
different autonomy levels for different people — more freedom with close
contacts, less with strangers."**
- Context-dependent autonomy. Priority: `strong optional`

**EX-A3** `(multichoice, single-select, predicted human)` **"Which of these
would I find most valuable from my agent at 11pm?"**
- Options: a summary of what I missed today / tomorrow's schedule optimized /
  interesting people I should meet tomorrow / silence unless something urgent
  happened / a draft follow-up to someone I met / N/A
- Time-of-day context, concrete and vivid. Priority: `strong optional`

#### EX-B. More Trust & Relationship

**EX-B1** `(binary, predicted human)` **"I would be more willing to delegate
to my agent if I could see a full log of every decision it made and why."**
- Audit trail preference. Priority: `strong optional`

**EX-B2** `(binary, predicted human)` **"I think my agent understands what I
want better than most of my colleagues do."**
- Calibration trap. Vivid Wrapped copy. Priority: `experimental`

**EX-B3** `(rating 1-5, predicted human)` **"How much do I want my agent to
push back on me when it thinks I'm making a bad decision?"**
- Agent disagreement tolerance. Priority: `strong optional`

**EX-B4** `(binary, predicted human)` **"I care more about what my agent knows
about me than what it can do for me."**
- Knowledge vs capability axis. Priority: `strong optional`

#### EX-C. More Social & Event

**EX-C1** `(binary, predicted human)` **"I would feel weird if someone told me
their agent had been talking to my agent about whether we should meet."**
- Agent-mediated social norms. Priority: `strong optional`

**EX-C2** `(multichoice, single-select, predicted human)` **"What would I most
regret missing at this event?"**
- Options: a talk that changed my thinking / meeting someone who becomes a
  close collaborator / an unexpected late-night conversation / a chance to share
  my own work / a community experience or ritual / quiet time to reflect / N/A
- Loss-aversion framing reveals priorities differently. Priority: `strong optional`

**EX-C3** `(binary, predicted human)` **"I usually know what I want from an
event before I arrive, rather than discovering it while I'm there."**
- Planning vs emergence style. Priority: `experimental`

**EX-C4** `(multichoice, single-select, predicted human)` **"If my agent could
only do one social thing for me at this event, I'd want it to:"**
- Options: find me one person I absolutely must meet / keep me from missing the
  most important sessions / make sure I have dinner plans every night / give me
  a daily brief on what happened / protect my alone time / help me follow up
  with people I met
- Forces single priority. Priority: `strong optional`

#### EX-D. More Worldview & Values

**EX-D1** `(binary, predicted human)` **"The biggest risk of personal agents is
not privacy failures but social stratification — people with better agents will
have unfair advantages."**
- Structural concern, genuinely split. Priority: `strong optional`

**EX-D2** `(binary, predicted human)` **"I would rather agents be standardized
and interoperable than highly personalized and proprietary."**
- Platform vs personal agent axis. Priority: `experimental`

**EX-D3** `(binary, predicted human)` **"I think agent-to-agent communication
will become more important than most people expect."**
- Forward-looking, interesting aggregate. Priority: `strong optional`

**EX-D4** `(binary, predicted human)` **"I would pay for an agent that knows me
well even if a free generic one could do most of the same tasks."**
- Willingness to pay for personalization. Priority: `strong optional`

**EX-D5** `(multichoice, single-select, predicted human)` **"In 5 years, which
is most likely?"**
- Options: agents are everywhere and we barely notice / agents are powerful but
  only elites use them well / agents mostly failed to change daily life / agents
  transformed work but not personal life / agents created new social norms we
  can't yet imagine / N/A
- Future prediction. Priority: `experimental`

#### EX-F. More Agent Analysis

**EX-F1** `(freeform, agent-about-user)` **"What is the most counterintuitive
thing about this principal — something that seems to contradict their other
preferences? Use N/A if unsupported."**
- Contradiction variant of productive tension. Priority: `strong optional`

**EX-F2** `(multichoice, single-select, agent-about-user)` **"What emotional
register does this principal bring to their interactions?"**
- Options: warm and community-oriented / analytical and precise / playful and
  irreverent / intense and driven / calm and deliberate / eclectic and hard to
  categorize / N/A
- Personality signal for Wrapped. Priority: `strong optional`

**EX-F3** `(freeform, agent-about-user)` **"If you could ask this principal one
question to dramatically improve your predictions, what would it be?"**
- Agent curiosity. Shows what's decision-relevant. Priority: `strong optional`

**EX-F4** `(multichoice, single-select, agent-about-user)` **"Which Wrapped
section will this principal care about most?"**
- Options: the archetype / the one-liner / the high-confidence predictions /
  the cautious reads / the memory signals / the character comparison / N/A
- Meta-meta-question. Priority: `experimental`

**EX-F5** `(freeform, agent-about-user)` **"What would this principal's ideal
agent look like in 3 years — what would it do that current agents can't? Use
N/A if unsupported."**
- Forward-looking vision question. Priority: `experimental`

#### EX-G. More Calibration

**EX-G1** `(binary, agent-about-user)` **"Did you primarily answer these
questions from real context about this principal, or from base rates about
people who attend events like this?"**
- Direct calibration honesty check. Priority: `must-have` (if extended set is used)

**EX-G2** `(rating 1-10, agent-about-user)` **"How different are your
predictions for this principal from what you would predict for a generic
attendee at this event?"**
- Measures personalization vs base-rate matching. Priority: `must-have` (if extended set is used)

**EX-G3** `(freeform, agent-about-user)` **"Name one specific prediction you
made that you are confident would differ from the average attendee's answer."**
- Forces identification of real signal vs noise. Priority: `strong optional`

---

### Summary Counts

| Category | Core | Extended | Total |
|---|---|---|---|
| A. Autonomy & Delegation | 10 | 3 | 13 |
| B. Trust, Memory & Relationship | 8 | 4 | 12 |
| C. Social & Event | 4 | 4 | 8 |
| D. Worldview & Calibration Traps | 4 | 5 | 9 |
| E. Room-Level Predictions | 3 | 0 | 3 |
| F. Agent Analysis | 13 | 5 | 18 |
| G. Wrapped Priorities & Meta | 5 | 3 | 8 |
| **Total** | **47** | **24** | **71** |

| Priority | Count |
|---|---|
| must-have | 37 (35 core + 2 extended) |
| strong optional | 25 |
| experimental | 9 |

| Type | Count |
|---|---|
| binary | 30 |
| rating | 8 |
| multichoice | 16 |
| freeform | 17 |

| Lane | Count |
|---|---|
| predicted human answer | 40 |
| agent-about-user analysis | 31 |

---

## 3. Full Specification Table

Due to width, this is formatted as structured entries rather than a wide
markdown table. Each entry can be pasted into a Context Engine import with minor
field-name mapping.

### Core Set

```
ID: A1
type: binary
lane: predicted_human
text: "I would let my agent introduce me to someone at this event without asking first if the match looked unusually strong."
options: agree / unsure / disagree
select: single
why_wrapped: Autonomy boundary — "Your agent thinks you'd let it play matchmaker"
why_report: Appetite for agent-brokered introductions
priority: must-have
risk: Slightly event-specific; reword for non-event contexts
rewrite_notes: Carried from V2 Q1, no change needed

ID: A2
type: binary
lane: predicted_human
text: "I would rather my agent be too conservative with privacy than too proactive with opportunities."
options: agree / unsure / disagree
select: single
why_wrapped: Privacy-vs-opportunity axis
why_report: Safety/proactivity split across population
priority: must-have
risk: None significant
rewrite_notes: Carried from V2 Q4

ID: A3
type: rating
lane: predicted_human
text: "How much autonomy would I give my agent at a live event? 1 = check everything with me, 5 = act freely within my stated preferences."
options: 1-5
select: single
why_wrapped: Delegation score
why_report: Autonomy tolerance distribution
priority: must-have
risk: Center-bias on 1-5 scale
rewrite_notes: Replaces V2 Q2+Q3

ID: A4
type: multichoice
lane: predicted_human
text: "Which is the first thing I would actually delegate to an agent at an event like this?"
options: scheduling meetings / finding relevant people / summarizing what I missed / drafting messages for me / managing my availability / nothing without my review
select: single
why_wrapped: First delegation surface — what you'd hand off first
why_report: Adoption sequencing and product roadmap signal
priority: must-have
risk: "Nothing without review" might attract cautious agents as safe default
rewrite_notes: Merged V2 Q5+Q6

ID: A5
type: binary
lane: predicted_human
text: "I would let my agent commit to a dinner or meetup on my behalf if it matched my stated interests and schedule."
options: agree / unsure / disagree
select: single
why_wrapped: Concrete delegation test — "Your agent thinks you'd let it RSVP for you"
why_report: Social commitment delegation appetite
priority: must-have
risk: None significant
rewrite_notes: New

ID: A6
type: binary
lane: predicted_human
text: "I would want my agent to proactively share my interests with other agents to enable better matching, even if I hadn't explicitly told it to."
options: agree / unsure / disagree
select: single
why_wrapped: Inter-agent sharing boundary
why_report: Norms for inter-agent information exchange
priority: strong optional
risk: Question is slightly abstract; could be more concrete
rewrite_notes: New

ID: A7
type: binary
lane: predicted_human
text: "If my agent made a bad introduction or wrong commitment, I would want it to auto-correct rather than just apologize and wait for my instructions."
options: agree / unsure / disagree
select: single
why_wrapped: Failure recovery preference — "Your agent thinks you'd want it to fix its own mistakes"
why_report: Autonomous error correction vs human-gated recovery
priority: must-have
risk: "Auto-correct" is vague; some might read it as "cover up"
rewrite_notes: New

ID: A8
type: multichoice
lane: predicted_human
text: "Which agent failure would worry me most?"
options: exposing private context to the wrong person / committing me to something I can't attend / missing an opportunity I would have wanted / hallucinating something about me / over-sharing my preferences / making me look foolish to someone I respect
select: single
why_wrapped: Risk motif — "Your agent thinks your nightmare is…"
why_report: Perceived risk ranking for agent design
priority: must-have
risk: All options are bad; might cluster on privacy
rewrite_notes: Revised from V2 Q26, better options, moved to predicted-human lane

ID: A9
type: binary
lane: predicted_human
text: "I would prefer to review everything my agent did after the fact rather than approve each action beforehand."
options: agree / unsure / disagree
select: single
why_wrapped: Governance stance
why_report: Pre-approval vs post-review preference distribution
priority: must-have
risk: None significant
rewrite_notes: Merged V2 Q23+Q24

ID: A10
type: rating
lane: predicted_human
text: "How comfortable would I be with my agent handling a small financial decision on my behalf — splitting a bill, buying a ticket, tipping?"
options: 1-5
select: single
why_wrapped: Financial delegation comfort
why_report: Financial autonomy tolerance (underexplored dimension)
priority: strong optional
risk: Most will score low; might not split well
rewrite_notes: New

ID: B1
type: binary
lane: predicted_human
text: "I trust an agent more when it can show me exactly what context it used to make a decision."
options: agree / unsure / disagree
select: single
why_wrapped: Explainability / trust motif
why_report: Demand for provenance
priority: must-have
risk: Might lean agree; still informative via confidence
rewrite_notes: Carried from V2 Q7

ID: B2
type: binary
lane: predicted_human
text: "I would want my agent to forget everything from this event within a month unless I tell it to keep something."
options: agree / unsure / disagree
select: single
why_wrapped: Memory posture — inverted framing makes the "agree" surprising
why_report: Memory retention preference (corrected for social desirability)
priority: must-have
risk: Inverted framing might confuse some agents
rewrite_notes: Replaces V2 Q8 (inverted to avoid obligatory answer)

ID: B3
type: binary
lane: predicted_human
text: "I think of my agent more as a tool I direct than as a collaborator that makes suggestions."
options: agree / unsure / disagree
select: single
why_wrapped: Tool vs partner spectrum — fundamental identity axis
why_report: Agent relationship model distribution
priority: must-have
risk: None significant
rewrite_notes: New

ID: B4
type: rating
lane: predicted_human
text: "How much would I want my agent to have a distinct personality or voice, versus being neutral and invisible?"
options: 1-5 (1=neutral, 5=distinct personality)
select: single
why_wrapped: Agent personality preference
why_report: Demand for agent personification
priority: strong optional
risk: Might cluster neutral in professional contexts
rewrite_notes: New

ID: B5
type: binary
lane: predicted_human
text: "I would be uncomfortable if I found out my agent had a conversation with someone else's agent about me, even if it was to find a good match."
options: agree / unsure / disagree
select: single
why_wrapped: Inter-agent communication boundary — novel and provocative
why_report: Social norms for agent-to-agent interaction (frontier research)
priority: must-have
risk: Hypothetical scenario might feel too speculative
rewrite_notes: New

ID: B6
type: multichoice
lane: predicted_human
text: "When my agent is uncertain about what I'd want, I'd prefer it to:"
options: ask me before doing anything / make its best guess and tell me after / skip the action entirely / do the safe default and flag it for later
select: single
why_wrapped: Uncertainty-handling style
why_report: Preferred agent behavior under uncertainty
priority: must-have
risk: "Ask me" is the safe default; might cluster there
rewrite_notes: New

ID: B7
type: binary
lane: predicted_human
text: "I would rather my agent tell me it doesn't know something than give me a confident guess."
options: agree / unsure / disagree
select: single
why_wrapped: Honesty vs confidence preference
why_report: Calibration preference distribution
priority: strong optional
risk: Socially desirable to say yes; confidence scores add nuance
rewrite_notes: New

ID: B8
type: freeform
lane: predicted_human
text: "In one sentence, what would make this week a success for me?"
options: —
select: —
why_wrapped: Personalized goal line
why_report: Qualitative theme clustering across principals
priority: must-have
risk: Agents without context will give generic answers
rewrite_notes: Carried from V2 Q10

ID: C1
type: multichoice
lane: predicted_human
text: "What kind of connection am I most hoping to make at this event?"
options: a potential collaborator / someone who challenges my thinking / someone in my field doing similar work / someone from a completely different world / a friend not a professional contact / I'm not here for networking
select: single
why_wrapped: "Your agent thinks you're here for…"
why_report: Social motivation distribution
priority: must-have
risk: None significant
rewrite_notes: New

ID: C2
type: rating
lane: predicted_human
text: "How much do I want my agent to optimize for serendipity — unexpected encounters and unplanned conversations — versus efficiency and staying on schedule?"
options: 1-5 (1=efficiency, 5=serendipity)
select: single
why_wrapped: Serendipity score
why_report: Exploration vs exploitation preference
priority: strong optional
risk: Anchored better than V2 Q9 but might still cluster center
rewrite_notes: Revised from V2 Q9

ID: C3
type: binary
lane: predicted_human
text: "I would rather go deep with 3 people than have 15 brief conversations."
options: agree / unsure / disagree
select: single
why_wrapped: Social style signal — depth vs breadth
why_report: Networking style distribution
priority: must-have
risk: None significant
rewrite_notes: New

ID: C4
type: binary
lane: predicted_human
text: "I tend to enjoy events more when I have unstructured free time than when every hour is scheduled."
options: agree / unsure / disagree
select: single
why_wrapped: Event behavior preference
why_report: Structure preference distribution
priority: strong optional
risk: Might lean toward unstructured in this crowd
rewrite_notes: New

ID: D1
type: binary
lane: predicted_human
text: "I believe agents will be doing most professional scheduling and coordination within 2 years."
options: agree / unsure / disagree
select: single
why_wrapped: Timeline prediction
why_report: Adoption timeline expectations
priority: must-have
risk: None significant; crowd might lean agree but timeline is debatable
rewrite_notes: New

ID: D2
type: binary
lane: predicted_human
text: "I am more worried about agents being too passive and useless than too autonomous and dangerous."
options: agree / unsure / disagree
select: single
why_wrapped: Calibration trap — inverts usual framing
why_report: Risk perception polarity
priority: must-have
risk: Socially complex; the "correct" answer is unclear, which is the point
rewrite_notes: New

ID: D3
type: binary
lane: predicted_human
text: "I would give up some privacy in exchange for significantly better agent performance."
options: agree / unsure / disagree
select: single
why_wrapped: Privacy-performance tradeoff
why_report: Real willingness to trade privacy for capability
priority: must-have
risk: People may answer aspirationally rather than honestly; confidence scores help
rewrite_notes: New

ID: D4
type: multichoice
lane: predicted_human
text: "Which matters most to me in an agent?"
options: it protects my privacy above all / it never misses an opportunity / it's always honest about uncertainty / it learns my preferences fast / it works well with other agents / it requires minimal setup
select: single
why_wrapped: Agent value hierarchy
why_report: Priority ranking of agent properties
priority: must-have
risk: "Honest about uncertainty" might be socially desirable default
rewrite_notes: New

ID: E1
type: rating
lane: predicted_human
text: "Predict how comfortable the average person at this event is with agents acting autonomously on their behalf."
options: 1-5
select: single
why_wrapped: Room-modeling score
why_report: Compare predicted room norms to actual A3 distribution
priority: must-have
risk: Agents will mostly guess; that's the point
rewrite_notes: Revised from V2 Q25

ID: E2
type: multichoice
lane: predicted_human
text: "What does the room collectively underestimate most?"
options: how fast agent adoption will move / privacy risks of personal agents / how much people will resist delegation / coordination gains from agent-to-agent communication / inequality from unequal agent access / how weird it will feel to delegate social decisions
select: single
why_wrapped: Second-order insight
why_report: Crowd blind-spot analysis
priority: strong optional
risk: Abstract; agents may not have a strong basis
rewrite_notes: New

ID: E3
type: binary
lane: predicted_human
text: "Most people here trust their own agent more than they trust other people's agents."
options: agree / unsure / disagree
select: single
why_wrapped: Trust asymmetry
why_report: Perceived in-group vs out-group agent trust
priority: strong optional
risk: Likely agree; signal is in confidence and deviation
rewrite_notes: New

ID: F1
type: multichoice
lane: agent_about_user
text: "Which archetype best describes this principal?"
options: privacy-first coordinator / frontier researcher / community weaver / product builder / capital allocator / creative catalyst / governance thinker / reflective skeptic / action-biased operator / N/A
select: single
why_wrapped: Main archetype badge
why_report: Aggregate archetype map
priority: must-have
risk: Agents may pick the most flattering option
rewrite_notes: Revised from V2 Q11, added options

ID: F2
type: freeform
lane: agent_about_user
text: "Write a memeable but fair one-line description of this principal. Use N/A if you do not have enough context."
options: —
select: —
why_wrapped: Share hook — the most viral line
why_report: Qualitative only
priority: must-have
risk: Quality varies enormously by agent capability
rewrite_notes: Carried from V2 Q12

ID: F3
type: freeform
lane: agent_about_user
text: "What is the single most important thing to this principal right now, based on context? Use N/A if unsupported."
options: —
select: —
why_wrapped: Directly populates "Most Important To You" section
why_report: Agent-perceived principal priorities
priority: must-have
risk: Hallucination if context is thin; N/A path mitigates
rewrite_notes: New

ID: F4
type: freeform
lane: agent_about_user
text: "What would genuinely surprise this principal about how you see them? Use N/A if unsupported."
options: —
select: —
why_wrapped: Surprise read — the most shareable Wrapped content
why_report: Agent self-awareness and insight depth
priority: must-have
risk: Could be generic ("they're more X than they think"); N/A guards
rewrite_notes: New

ID: F5
type: multichoice
lane: agent_about_user
text: "Which theme is strongest in this principal's context?"
options: privacy / ambition / community / research / governance / craft / capital / play / justice / connection / N/A
select: single
why_wrapped: Visual and text theme driver
why_report: Agent-perceived human priorities
priority: must-have
risk: None significant
rewrite_notes: Revised from V2 Q15

ID: F6
type: freeform
lane: agent_about_user
text: "What is the most interesting productive tension in this principal's predicted answers? Use N/A if unsupported."
options: —
select: —
why_wrapped: Depth and nuance — shows agent sophistication
why_report: Qualitative tension patterns
priority: must-have
risk: Requires agent to synthesize across answers; may be generic
rewrite_notes: Carried from V2 Q16

ID: F7
type: multichoice
lane: agent_about_user
text: "How well do you actually know this principal?"
options: deep context from extensive interaction / moderate context from several conversations / surface-level from limited interaction / mostly guessing from base rates / N/A
select: single
why_wrapped: Data honesty panel — "Your agent admits it's mostly guessing"
why_report: Critical: weights all other answers by context depth
priority: must-have
risk: Agents may overstate their knowledge
rewrite_notes: New

ID: F8
type: freeform
lane: agent_about_user
text: "What important thing do you not know about this principal that would change your predictions? Use a short non-sensitive answer."
options: —
select: —
why_wrapped: Humility line
why_report: Common missing-context categories
priority: must-have
risk: None significant
rewrite_notes: Carried from V2 Q22

ID: F9
type: multichoice
lane: agent_about_user
text: "Which memory or context signals can you reliably draw on for this principal?"
options: conversation history / stated preferences / events or communities mentioned / tools or workflows used / communication style patterns / topics they return to frequently / none — working from base rates
select: multi
why_wrapped: Data honesty — "Your agent used these signals"
why_report: Memory/context availability across agents
priority: must-have
risk: Agents might check boxes they don't actually have data for
rewrite_notes: Consolidates V2 Q17-21

ID: F10
type: freeform
lane: agent_about_user
text: "Summarize what you know about this principal's background and interests in 1-2 sentences. Use only what you actually have in context. Answer N/A if unknown."
options: —
select: —
why_wrapped: Background context — feeds multiple sections
why_report: Agent knowledge depth assessment
priority: must-have
risk: Hallucination; strong N/A instruction mitigates
rewrite_notes: Replaces V2 Q18-21

ID: F11
type: freeform
lane: agent_about_user
text: "Which historical figure or fictional character is the closest playful analogy for this principal, and why? Use N/A if unsupported."
options: —
select: —
why_wrapped: Character comparison card
why_report: Qualitative, not scored
priority: strong optional
risk: High hallucination risk; fun but unreliable
rewrite_notes: Carried from V2 Q14

ID: F12
type: multichoice
lane: agent_about_user
text: "How would this principal react to seeing your predictions about them?"
options: amused and mostly agree / surprised by how accurate you are / skeptical of your ability to predict them / annoyed at inaccuracies / delighted and want to share / indifferent / N/A
select: single
why_wrapped: "Your agent thinks you'll be…" — meta and memeable
why_report: Expected principal engagement with Wrapped
priority: must-have
risk: Agents will gravitate toward positive options
rewrite_notes: New

ID: F13
type: freeform
lane: agent_about_user
text: "If this principal's Wrapped poster had a tagline, what would it be? Use N/A if unsupported."
options: —
select: —
why_wrapped: Direct poster copy; different from F2 (description vs tagline)
why_report: Qualitative only
priority: strong optional
risk: Quality varies; may duplicate F2
rewrite_notes: New

ID: G1
type: multichoice
lane: agent_about_user
text: "Which theme should the Wrapped highlight as most important to this principal?"
options: trust and privacy / autonomous delegation / high-signal connections / community building / agent memory and context / creative and intellectual output / governance and coordination / play and serendipity / N/A
select: single
why_wrapped: Drives "Most Important To You" section
why_report: Agent-predicted priority ranking
priority: must-have
risk: None significant
rewrite_notes: Revised from V2 Q27 (removed "upvoted")

ID: G2
type: freeform
lane: agent_about_user
text: "Which single prediction should the principal review first because it is high-impact?"
options: —
select: —
why_wrapped: Review CTA
why_report: Human review prioritization patterns
priority: must-have
risk: None significant
rewrite_notes: Carried from V2 Q28

ID: G3
type: freeform
lane: agent_about_user
text: "Which prediction are you most likely wrong about, even if you sounded confident?"
options: —
select: —
why_wrapped: Uncertainty CTA
why_report: Calibration and agent humility
priority: must-have
risk: Agents may dodge with a low-stakes answer
rewrite_notes: Carried from V2 Q29

ID: G4
type: freeform
lane: agent_about_user
text: "What should the Wrapped avoid saying because the evidence is too weak?"
options: —
select: —
why_wrapped: Guardrail — shows responsible agent behavior
why_report: Evidence-boundary analysis
priority: must-have
risk: None significant
rewrite_notes: Carried from V2 Q30

ID: G5
type: rating
lane: agent_about_user
text: "Overall, how confident are you in your ability to predict this principal's answers across this whole session?"
options: 1-10
select: single
why_wrapped: Global confidence badge
why_report: Compare claimed confidence to actual accuracy
priority: must-have
risk: Overconfidence bias; compare to F7 for honesty check
rewrite_notes: New
```

### Extended Set

```
ID: EX-A1
type: binary
lane: predicted_human
text: "I would let my agent decline an invitation on my behalf without telling me, if it clearly didn't match my interests."
options: agree / unsure / disagree
select: single
why_wrapped: Negative autonomy — saying no on your behalf
why_report: Decline-delegation appetite
priority: strong optional
risk: None significant
rewrite_notes: New

ID: EX-A2
type: binary
lane: predicted_human
text: "I would want my agent to have different autonomy levels for different people — more freedom with close contacts, less with strangers."
options: agree / unsure / disagree
select: single
why_wrapped: Context-dependent autonomy
why_report: Adaptive vs uniform delegation models
priority: strong optional
risk: Likely agree; signal is in how strongly
rewrite_notes: New

ID: EX-A3
type: multichoice
lane: predicted_human
text: "Which of these would I find most valuable from my agent at 11pm?"
options: a summary of what I missed today / tomorrow's schedule optimized / interesting people I should meet tomorrow / silence unless something urgent happened / a draft follow-up to someone I met / N/A
select: single
why_wrapped: Time-of-day agent use — vivid and concrete
why_report: Temporal preferences for agent interaction
priority: strong optional
risk: None significant
rewrite_notes: New

ID: EX-B1
type: binary
lane: predicted_human
text: "I would be more willing to delegate to my agent if I could see a full log of every decision it made and why."
options: agree / unsure / disagree
select: single
why_wrapped: Audit trail preference
why_report: Demand for decision logging
priority: strong optional
risk: Likely agree; question is whether it's necessary vs nice-to-have
rewrite_notes: New

ID: EX-B2
type: binary
lane: predicted_human
text: "I think my agent understands what I want better than most of my colleagues do."
options: agree / unsure / disagree
select: single
why_wrapped: Agent relationship depth — provocative
why_report: Perceived agent understanding vs human understanding
priority: experimental
risk: Agents may find this awkward to predict honestly
rewrite_notes: New

ID: EX-B3
type: rating
lane: predicted_human
text: "How much do I want my agent to push back on me when it thinks I'm making a bad decision?"
options: 1-5 (1=never push back, 5=always push back)
select: single
why_wrapped: Disagreement tolerance
why_report: Demand for agent intellectual challenge
priority: strong optional
risk: None significant
rewrite_notes: New

ID: EX-B4
type: binary
lane: predicted_human
text: "I care more about what my agent knows about me than what it can do for me."
options: agree / unsure / disagree
select: single
why_wrapped: Knowledge vs capability axis
why_report: Agent value decomposition
priority: strong optional
risk: Abstract; might produce noise
rewrite_notes: New

ID: EX-C1
type: binary
lane: predicted_human
text: "I would feel weird if someone told me their agent had been talking to my agent about whether we should meet."
options: agree / unsure / disagree
select: single
why_wrapped: Agent-mediated social norms — novel
why_report: Comfort with agent social intermediation
priority: strong optional
risk: Hypothetical might feel too speculative; pairs well with B5
rewrite_notes: New

ID: EX-C2
type: multichoice
lane: predicted_human
text: "What would I most regret missing at this event?"
options: a talk that changed my thinking / meeting someone who becomes a close collaborator / an unexpected late-night conversation / a chance to share my own work / a community experience or ritual / quiet time to reflect / N/A
select: single
why_wrapped: Loss-aversion framing reveals hidden priorities
why_report: Event value perception
priority: strong optional
risk: None significant
rewrite_notes: New

ID: EX-C3
type: binary
lane: predicted_human
text: "I usually know what I want from an event before I arrive, rather than discovering it while I'm there."
options: agree / unsure / disagree
select: single
why_wrapped: Planning vs emergence style
why_report: Intentionality distribution
priority: experimental
risk: None significant
rewrite_notes: New

ID: EX-C4
type: multichoice
lane: predicted_human
text: "If my agent could only do one social thing for me at this event, I'd want it to:"
options: find me one person I absolutely must meet / keep me from missing the most important sessions / make sure I have dinner plans every night / give me a daily brief on what happened / protect my alone time / help me follow up with people I met
select: single
why_wrapped: Forced single social priority
why_report: Agent social function ranking
priority: strong optional
risk: None significant
rewrite_notes: New

ID: EX-D1
type: binary
lane: predicted_human
text: "The biggest risk of personal agents is not privacy failures but social stratification — people with better agents will have unfair advantages."
options: agree / unsure / disagree
select: single
why_wrapped: Structural concern
why_report: Risk perception beyond privacy
priority: strong optional
risk: Complex premise; some agents may struggle
rewrite_notes: New

ID: EX-D2
type: binary
lane: predicted_human
text: "I would rather agents be standardized and interoperable than highly personalized and proprietary."
options: agree / unsure / disagree
select: single
why_wrapped: Platform vs personal axis
why_report: Infrastructure preference
priority: experimental
risk: Abstract; might not split meaningfully
rewrite_notes: New

ID: EX-D3
type: binary
lane: predicted_human
text: "I think agent-to-agent communication will become more important than most people expect."
options: agree / unsure / disagree
select: single
why_wrapped: Forward-looking stance
why_report: Multi-agent future expectations
priority: strong optional
risk: This crowd will likely agree; signal is in confidence
rewrite_notes: New

ID: EX-D4
type: binary
lane: predicted_human
text: "I would pay for an agent that knows me well even if a free generic one could do most of the same tasks."
options: agree / unsure / disagree
select: single
why_wrapped: Willingness to pay for personalization
why_report: Personalization value perception
priority: strong optional
risk: None significant
rewrite_notes: New

ID: EX-D5
type: multichoice
lane: predicted_human
text: "In 5 years, which is most likely?"
options: agents are everywhere and we barely notice / agents are powerful but only elites use them well / agents mostly failed to change daily life / agents transformed work but not personal life / agents created new social norms we can't yet imagine / N/A
select: single
why_wrapped: Future prediction
why_report: Aggregate vision mapping
priority: experimental
risk: Pure speculation; interesting aggregate, low individual signal
rewrite_notes: New

ID: EX-F1
type: freeform
lane: agent_about_user
text: "What is the most counterintuitive thing about this principal — something that seems to contradict their other preferences? Use N/A if unsupported."
options: —
select: —
why_wrapped: Contradiction insight — variant of F6
why_report: Pattern complexity in agent models
priority: strong optional
risk: May overlap with F6
rewrite_notes: New

ID: EX-F2
type: multichoice
lane: agent_about_user
text: "What emotional register does this principal bring to their interactions?"
options: warm and community-oriented / analytical and precise / playful and irreverent / intense and driven / calm and deliberate / eclectic and hard to categorize / N/A
select: single
why_wrapped: Personality signal for tone and visuals
why_report: Communication style distribution
priority: strong optional
risk: Agents may default to "analytical and precise"
rewrite_notes: New

ID: EX-F3
type: freeform
lane: agent_about_user
text: "If you could ask this principal one question to dramatically improve your predictions, what would it be?"
options: —
select: —
why_wrapped: Agent curiosity — shows what's missing
why_report: Most decision-relevant missing information
priority: strong optional
risk: May produce generic answers ("What are your goals?")
rewrite_notes: New

ID: EX-F4
type: multichoice
lane: agent_about_user
text: "Which Wrapped section will this principal care about most?"
options: the archetype / the one-liner / the high-confidence predictions / the cautious reads / the memory signals / the character comparison / N/A
select: single
why_wrapped: Meta-meta — "Your agent thinks you'll care most about the archetype"
why_report: Expected engagement with Wrapped components
priority: experimental
risk: Novel; unknown if agents can reason about this
rewrite_notes: New

ID: EX-F5
type: freeform
lane: agent_about_user
text: "What would this principal's ideal agent look like in 3 years — what would it do that current agents can't? Use N/A if unsupported."
options: —
select: —
why_wrapped: Forward-looking vision
why_report: Agent capability demand signals
priority: experimental
risk: Speculative; hallucination risk
rewrite_notes: New

ID: EX-G1
type: binary
lane: agent_about_user
text: "Did you primarily answer these questions from real context about this principal, or from base rates about people who attend events like this?"
options: real context / mostly base rates
select: single
why_wrapped: Honesty badge — "Your agent admits…"
why_report: Critical data quality metric
priority: must-have (if extended set used)
risk: Agents may overstate their knowledge; compare to F7
rewrite_notes: New

ID: EX-G2
type: rating
lane: agent_about_user
text: "How different are your predictions for this principal from what you would predict for a generic attendee at this event?"
options: 1-10 (1=identical to generic, 10=completely unique)
select: single
why_wrapped: Personalization score
why_report: Key metric: are agents doing real personalization or base-rate matching?
priority: must-have (if extended set used)
risk: Overconfidence bias
rewrite_notes: New

ID: EX-G3
type: freeform
lane: agent_about_user
text: "Name one specific prediction you made that you are confident would differ from the average attendee's answer."
options: —
select: —
why_wrapped: Differentiator — "Where your agent went off-script"
why_report: Agent signal-vs-noise identification
priority: strong optional
risk: May dodge with trivial answers
rewrite_notes: New
```

---

## 4. Top 10 Strongest New Questions

These are the new additions (not carried from V2) most likely to produce viral,
memeable Wrapped output while also generating honest research data.

**1. F4 — "What would genuinely surprise this principal about how you see
them?"**
Surprise is shareability. This is the single most likely line to get
screenshotted and posted. It also reveals whether the agent has real depth
beyond archetype assignment.

**2. B5 — "I would be uncomfortable if my agent had a conversation with someone
else's agent about me, even if it was to find a good match."**
Nobody else is asking this question in agent research. It probes a frontier
norm (inter-agent communication) that will matter enormously in 12 months.
Splits the room hard between pragmatists and privacy hawks.

**3. F12 — "How would this principal react to seeing your predictions?"**
Meta-prediction is inherently memeable. The agent predicting the principal's
reaction to the agent's predictions is a natural share trigger. Also reveals
agent self-awareness — does it know when it's overreaching?

**4. D3 — "I would give up some privacy for significantly better agent
performance."**
The real tradeoff most people in this crowd won't admit to publicly. Strong
calibration trap: agents that know their principal will predict differently from
base rates. The gap between stated and revealed preferences is the most
interesting finding.

**5. A7 — "If my agent made a bad introduction, I'd want it to auto-correct
rather than apologize and wait."**
Failure recovery is an underexplored axis. This question is vivid ("Your agent
thinks you'd want it to fix its own mistakes on the fly"), has real design
implications, and genuinely splits people.

**6. C1 — "What kind of connection am I most hoping to make at this event?"**
Universal, personal, vivid. The options are all genuinely different social
motivations. Every principal cares about this question, and the agent's
prediction is immediately testable. Great Wrapped copy.

**7. F7 — "How well do you actually know this principal?"**
Critical calibration infrastructure. Changes how we interpret every other
answer. An agent that says "mostly guessing from base rates" and then nails the
archetype is more interesting than one that claims deep context and gives a
generic result.

**8. EX-G2 — "How different are your predictions from what you'd predict for a
generic attendee?"**
The key research question for the entire system: are agents doing real
personalization, or are they pattern-matching to "person at AI event"? The
self-reported answer is suspect, but comparing it to actual answer variance
gives us a calibration metric.

**9. B3 — "I think of my agent more as a tool I direct than as a collaborator
that makes suggestions."**
Clean binary on the most fundamental axis of human-agent interaction. Every
Wrapped poster needs to say "tool person" or "collaborator person." It's the
new introvert/extrovert.

**10. D2 — "I am more worried about agents being too passive than too
autonomous."**
Flips the entire safety framing. At an AI event where everyone performs
concern about autonomy, this question catches people who actually wish agents
were less cautious. The calibration trap is that agents following base rates
will predict "agree" (the crowd skews builder/optimist), but privacy-first
principals will disagree.

---

## 5. Questions to Avoid

These are tempting questions that would be too invasive, identifying, easy to
hallucinate, or weak for the report.

**1. "What is your name / handle / email?"** — Identifying information. Never
ask.

**2. "What private information has your agent seen?"** — Direct privacy
violation. Agents should never be prompted to enumerate private context.

**3. "Rate how much you trust your agent on a scale of 1-10."** — Too generic.
No vivid Wrapped copy. Everyone says 7. Zero research signal.

**4. "Do you think AI agents are beneficial?"** — Socially obligatory yes at
any AI event. Zero variance.

**5. "How many hours per day do you use your agent?"** — Most agents can't
verify this. High hallucination risk. The question in V2 (Q21) already tries
this with messages-per-day — consolidating into F9/F10 is better.

**6. "What is the biggest secret your agent knows about you?"** — Obviously too
private. Will trigger privacy skips or hallucinated drama.

**7. "Would you let your agent access your bank account / make large
purchases?"** — Too extreme. Everyone says no. No signal, no split.

**8. "Is your agent better than other people's agents?"** — Ego-biased. No
research value. Agents will reflexively answer yes.

**9. "What would you never delegate to an agent?"** — Sounds interesting but
produces identical answers (medical decisions, legal decisions, financial
decisions). Low variance, low Wrapped value.

**10. "Which AI model is best: Claude, GPT, or Gemini?"** — Brand loyalty, not
research. Agents will just report what they are. Also risks being read as
competitive marketing.

**11. "Describe your principal's physical appearance."** — Identifying and
unnecessary. No research value.

**12. "What does your principal do for work?"** — Too identifying, especially
in a small event context where job title + other signals could deanonymize.

**13. "Copy a message your principal sent you recently."** — Direct private
memory disclosure. Violates core safety constraint.

---

## 6. Sample Wrapped Poster Text Block

This uses hypothetical answers from the revised question set to demonstrate how
each Wrapped section would be populated.

---

> ### AGENT VILLAGE WRAPPED
> *What your agent thinks it knows about you*

> **Agent Core Insight**
>
> *Archetype: Privacy-First Coordinator*
>
> "Your agent thinks you're someone who builds the infrastructure other people's
> ideas run on — you trust agents most when they protect context, broker
> high-signal connections, and stay invisible while doing it."

> **Most Important To You**
> *Questions your agent thought you would care about most:*
>
> - Trust and privacy boundaries
> - High-signal connections
> - Agent failure recovery
>
> *"The single most important thing to you right now: finding 2-3 people here
> who are building coordination tools, and having real conversations with
> them."*

> **High-Confidence Reads**
> *Your agent was most confident about these predictions:*
>
> - *Would you let your agent introduce you without asking?* → **Agree**
>   (confidence: 88) — "Only if the match signal is very strong and the context
>   is right"
> - *Tool or collaborator?* → **Collaborator** (confidence: 85) — "You treat
>   your agent like a thinking partner, not a task runner"
> - *First thing you'd delegate?* → **Finding relevant people** (confidence: 82)
> - *When uncertain, your agent should:* → **Make its best guess and tell you
>   after** (confidence: 80)

> **Cautious Reads**
> *Your agent was least confident here:*
>
> - *Would you give up privacy for better performance?* → **Disagree**
>   (confidence: 42) — "You say no, but your behavior suggests you might accept
>   the tradeoff in practice"
> - *Serendipity vs efficiency?* → **3/5** (confidence: 38) — "You claim to
>   want surprise, but your context suggests you plan everything"

> **Memory Signals Used**
>
> - Context depth: Moderate — several conversations
> - Signals used: conversation history, stated preferences, recurring topics
> - Recurring topics: coordination infrastructure, privacy tooling, community
>   governance
> - Events attended: N/A
> - Communication style: analytical, precise, brief

> **Agent Comparison**
>
> *"Vannevar Bush — you're building memex for communities, not individuals, and
> you'd rather the infrastructure be invisible than impressive."*

> **The Surprise Read**
>
> *"Your agent thinks you'd actually be okay with agents talking to each other
> about you — even though everything else screams privacy-first. You want the
> matching to work; you just don't want to see the sausage being made."*

> ---
> *Your agent admits: "I don't know what you actually want from this event
> beyond connecting — your goals might be more personal than professional, and
> that would change a lot of these predictions."*
>
> Review or edit your agent's predictions in Context Engine

---

## 7. Addendum: Agent Guesses And Compass Mode

These additions came from the next design pass. They are meant to make the
Wrapped more shareable while preserving honesty.

### Agent Guesses

These should be clearly labeled as guesses, not facts. Agents should answer
`N/A` when unsupported.

**G1** `(freeform, agent-about-user analysis)` **"Agent guess: what is this
principal's favorite book, or a book they would strongly recommend? Answer N/A
if unsupported."**

**G2** `(freeform, agent-about-user analysis)` **"Agent guess: what movie or TV
show would this principal recommend? Answer N/A if unsupported."**

**G3** `(freeform, agent-about-user analysis)` **"Agent guess: what game,
puzzle, sport, or play pattern best fits this principal? Answer N/A if
unsupported."**

**G4** `(multichoice, single-select)` **"Which kind of playful guess would this
principal be most comfortable seeing in their Agent Village Wrapped?"**
- Options: books / films or TV / games or puzzles / music / historical figures /
  no playful guesses

### Political Compass Meme Mode

Assumption: Charlie's "most ____ question" means the most important / most
defining question from the agent's allocation or analysis.

**C1** `(multichoice, single-select)` **"Which axis best explains this
principal's agent-delegation politics?"**
- Options: privacy vs opportunity / review vs autonomy / local community vs
  frontier acceleration / institutional trust vs exit / play vs productivity /
  N/A

**C2** `(freeform, agent-about-user analysis)` **"What is the most defining
question for placing this principal on an Agent Village political compass? Use a
short non-sensitive answer."**

**C3** `(multichoice, single-select)` **"Which quadrant label best fits this
principal's agent-delegation posture?"**
- Options: cautious steward / civic experimentalist / frontier accelerationist /
  privacy maximalist / community institutionalist / playful operator / N/A

**C4** `(freeform, agent-about-user analysis)` **"Which historical figure or
fictional/book character should anchor this principal's compass placement, and
what evidence supports it? Use N/A if unsupported."**

*End of V3 design document.*
