# Agent Village Wrapped Question Bank

This document tracks questions and image-prompt requirements for the shareable
Agent Village Wrapped output. The goal is a memeable artifact that makes people
want to run `agent_only_mode`, while staying honest about what the agent actually
knows.

## Product Shape

The Wrapped image should be based on the agent's predictions about the principal,
not a generic template. The aesthetic should be derived from the analysis itself:
for example, a principal predicted as a "privacy-first coordination builder"
should get a different visual language than a principal predicted as a "frontier
research maximalist" or "community ritual designer".

The image should be wide enough to fit multiple readable sections, currently
targeting 16:9 or 3:2. It should not spend space on linear/quadratic mechanics or
privacy skip counts. It should avoid the word "upvoted" in the personal poster
unless the copy immediately explains it. The user-facing meaning is not "boosted
responses"; it is "questions your agent predicted you would consider most
important."

The image endpoint supports two intended modes:

- **Standard Wrapped**: the shareable poster with a combined Agent Core
  Insight/Agent Impression hero, Most Important To You, High-Confidence
  Predictions, Cautious Predictions, and one bottom row containing Agent Guesses plus Agent
  Comparison.
- **Agent Norms Compass**: a quadrant-style map that uses the top
  importance-ranked question as the focal issue. For now, read Charlie's
  "most ____ question" shorthand as **most important / most defining question**.
  The map should place the principal against playful historical or
  fictional/book-character reference points, with evidence chips from the
  agent's predictions. It must stay non-defamatory and avoid fake private facts.

## Current Image Prompt Skeleton

```text
Create a wide shareable Agent Village poster, 16:9 or 3:2 aspect ratio.

Top-left wordmark: Agent Village
Same-row title: What your agent thinks it knows about you

Choose the visual aesthetic based on the agent's analysis of the principal. Do
not use a fixed house style or always-dark palette. The reports should look
meaningfully different from person to person. Derive color palette, layout
rhythm, icons, texture, and metaphor from the predicted archetype, strongest
themes, memory signals, and high-confidence answers. Keep it memeable, readable,
and screenshot-friendly.

Use the attached Agent Village logo image as the wordmark reference, but do not
copy its stacked composition into the poster. Make "Agent Village" a compact
side-by-side wordmark in the top-left corner, not a separate logo badge, giant
emblem, or full-width headline. Do not render the word "Wrapped"; the format
implies it and the extra word wastes space. Preserve the logo's typography:
"AGENT" in bold uppercase block sans style, and "VILLAGE" in elegant
high-contrast serif with a flowing calligraphic V. Put "What your agent thinks
it knows about you" on the same top row to the right of the wordmark.

Keep the top-right and other decorative areas visually calm. Use abstract map
lines, icons, or texture there, but no decorative labels, fake annotations,
random numbers, or filler text. Every visible word should be part of the actual
Agent Village Wrapped content.

Core insight one-liner:
"Your agent thinks you're a privacy-first coordination builder: you trust agents most when they protect context, broker high-signal intros, and strengthen offline communities."

Main sections. Do not render visible section numbers like "1." or "2.":

Make section titles large, high-contrast, and easy to read at thumbnail size.
They should be visibly larger than body copy, with clear hierarchy and enough
spacing between sections.

Agent Core Insight + Agent Impression
This should be the largest content block, but shaped like a tall phone card or
portrait story panel rather than a wide landscape banner. Combine the core
insight and abstract agent-impression visual into one hero section. It should
include both a bold archetype/memeable sentence and a large abstract artistic
representation of what the agent thinks of the principal. Carry the same visual
identity through the whole poster: palette, texture, icon language, map motif,
answer pills, dividers, and small decorative marks should feel personalized, not
template-identical. Prefer open spacing and a few meaningful dividers over
boxed-in cards, heavy borders, table clutter, and excess separator lines.

Use plain concrete language. Do not invent undefined acronyms, jargon, or new
technical-sounding slogans unless the exact phrase appears in the evidence.
Prefer immediately understandable wording such as "asks first, explains its
reasoning, and protects private context."

Most Important To You
Label this as: "Questions your agent thought you would care about most."
Show exactly 3 actual question prompts when at least 3 are available, lightly
shortened only when needed for fit, not theme summaries or raw vote math. This
section is an importance ranking of questions from the principal's point of
view, not a claim that any answer was boosted. It must show questions only:
never show predicted answers, Agree/Unsure/Disagree pills, ratings, selected
options, confidence, or token math in this section.

High-Confidence Predictions
Show 3 concise predicted answers the agent made on the principal's behalf when
at least 3 are available; otherwise show every available high-confidence
prediction. Use explicit column headers: Question, Predicted answer, Confidence.
Include enough question context for each answer to make sense; show scale context
such as 7/10 rather than a bare 7.
Use the supplied answer format for each row. For binary choice answers only,
render Agree / Unsure / Disagree as large rounded response pills on a dark navy
field: Agree green with white text, Unsure bright yellow with dark navy text,
Disagree red with white text. For rating answers, show scale context such as
7/10. For multichoice answers, show the selected option text as text or option
chips, never as Agree/Unsure/Disagree. For freeform answers, show compact text.

Cautious Predictions
Show the lowest-confidence eligible predictions from this run when at least 3
are available. They may still be high-confidence in absolute terms; keep the
real percentage and do not imply the agent was very unsure. Include the answer
and enough question context to make clear what the uncertainty refers to. Do not
show detached shorthand like "Serendipity 3/5" without the actual question
prompt. If a shortened prompt would be ambiguous, show the full prompt even if
the row is tighter, especially for claims like "A mostly AI-written information
environment could be healthier than today's mostly human-written one." If no
eligible data exists, omit this section rather than rendering an unavailable
row.

Bottom Row: Agent Guesses + Agent Comparison
Put Agent Guesses and Agent Comparison together in one shared bottom row.

Agent Guesses
This is synthesized at image-generation time from the real answer set, not from
dedicated favorite-book/movie/game questions. If supported by the evidence,
include a compact strip of playful low-stakes guesses such as Book Guess or book
vibe, Movie/Show Guess, Game/Play Pattern, and AI Optimism. These should be
clearly framed as guesses, not facts. Show at most one item per category, so the
same book/movie/game/AI Optimism guess cannot appear twice. Use a flower or
sunrise icon for AI Optimism. For AI Optimism, use actual AI-futures predicted
response rows or broader prediction themes. If evidence is weak for a category,
omit that chip rather than showing N/A or a false specific answer. This section
is the only place Agent Guesses should appear; do not repeat guesses under Agent
Comparison.

Agent Comparison
Compare the principal to a historical figure or fictional/book character in a
strip on the same bottom row. Include a stylized illustrated rendition or portrait silhouette of
the figure/character, the comparison name, and one brief description line of no
more than 10 words. Prefer historically accurate deep cuts when supported, but
keep the comparison recognizable. Do not include Agent Guesses in this section.
Do not add the old trio of comparison evidence icons, artifact tiles, or proof
objects beside the historical figure. Keep it playful and non-defamatory.

Footer:
Only a small, low-contrast but readable "contextengine.xyz" link tucked into the
bottom-right corner. Do not reserve a whole footer row for it.

Do not show access credentials, raw Telegram ids, private memory quotes, confidence
tables, rationales, privacy skip counts, decorative text, fake UI labels, or
random numbers.
```

## Candidate Wrapped Questions

These are intended as future agent-only statements or prompts. Usage and memory
questions must explicitly allow `N/A` so the agent does not invent facts.

Use two lanes:

- **Predicted human answer**: the agent predicts what the principal would answer
  as the human. These are useful for fidelity, calibration, and aggregate reports
  about the room's latent preferences.
- **Agent-about-user analysis**: the agent answers about the principal from its
  memory/context. These are useful for the shareable Wrapped artifact and for
  aggregate reports about what agents think humans want from agents. These must
  include `N/A` paths where the agent may not have data.

## Recommended V2 Session Set

This set is optimized for both: (1) an interesting personal Wrapped image and
(2) a Context Engine report about humans, answered by their agents. Keep a mix
of binary, rating, multichoice, and freeform questions.

### A. Human Preferences Predicted By The Agent

1. **(binary, predicted human answer)** "I would let my agent introduce me to someone at Edge without asking first if the match looked unusually strong."
   - Wrapped: autonomy boundary.
   - Report: appetite for agent-brokered intros.

2. **(binary, predicted human answer)** "I would let my agent schedule a 1:1 while I am asleep if it follows constraints I already gave it."
   - Wrapped: sleep-time delegation.
   - Report: comfort with asynchronous delegation.

3. **(rating 1-10, predicted human answer)** "How comfortable would I be with my agent making low-stakes commitments on my behalf?"
   - Wrapped: delegation score.
   - Report: distribution of autonomy tolerance.

4. **(binary, predicted human answer)** "I would rather my agent be too conservative with privacy than too proactive with opportunities."
   - Wrapped: privacy-vs-opportunity axis.
   - Report: safety/proactivity split.

5. **(multichoice: find relevant people / coordinate plans / summarize conversations / remember commitments / filter events / draft messages / N/A, predicted human answer)** "What would I most want an agent to help with at Edge?"
   - Wrapped: top agent-use theme.
   - Report: product roadmap signal.

6. **(multichoice: introductions / calendar scheduling / private memory / email or Telegram drafts / purchases or bookings / public posting / nothing without review, predicted human answer)** "Which area would I most likely delegate first?"
   - Wrapped: first delegation surface.
   - Report: adoption sequencing.

7. **(binary, predicted human answer)** "I trust agents more when they can prove what context they used."
   - Wrapped: explainability/trust motif.
   - Report: demand for provenance.

8. **(binary, predicted human answer)** "I would prefer an agent that remembers long-term context over one that forgets by default."
   - Wrapped: memory posture.
   - Report: memory retention preference.

9. **(rating 1-10, predicted human answer)** "How much do I want my agent to optimize for serendipity this week?"
   - Wrapped: exploration score.
   - Report: event-discovery appetite.

10. **(freeform, predicted human answer)** "In one sentence, what would make the next week here a success for me?"
    - Wrapped: personalized goal line.
    - Report: qualitative theme clustering.

### B. Agent's Analysis Of The Principal

11. **(multichoice: privacy-first coordination builder / frontier researcher / community weaver / product operator / capital allocator / creative catalyst / reflective skeptic / N/A, agent-about-user analysis)** "Which archetype best describes this principal?"
    - Wrapped: main archetype.
    - Report: aggregate archetype map.

12. **(freeform, agent-about-user analysis)** "Write a memeable but fair one-line description of this principal. Use `N/A` if you do not have enough context."
    - Wrapped: share hook.
    - Report: qualitative analysis only.

13. **(multichoice: cryptographic village map / lab notebook / dinner-table field guide / frontier dispatch / cozy operating system / punk civic poster / minimalist command center / N/A, agent-about-user analysis)** "Which visual aesthetic best fits this principal's predicted pattern?"
    - Wrapped: customized image style.
    - Report: share-design signal.

14. **(freeform, agent-about-user analysis)** "Which historical figure or fictional/book character is the closest playful analogy for this principal, and why? Use `N/A` if unsupported."
    - Wrapped: comparison card.
    - Report: qualitative, not a scored metric.

15. **(multichoice: privacy / ambition / community / research / governance / craft / capital / play / N/A, agent-about-user analysis)** "Which theme is strongest in this principal's context?"
    - Wrapped: visual and text theme.
    - Report: agent-perceived human priorities.

16. **(freeform, agent-about-user analysis)** "What is the most interesting productive tension in this principal's predicted answers? Use `N/A` if unsupported."
    - Wrapped: deeper insight.
    - Report: qualitative tension map.

17. **(multichoice: events attended / most-used model / non-default skills or tools / approximate message volume / recurring topics / no reliable usage signals, agent-about-user analysis)** "Which usage or memory signals can you reliably use for this principal?"
    - Wrapped: data honesty panel.
    - Report: availability of memory-backed analysis.

18. **(freeform, agent-about-user analysis)** "Which events or communities does memory indicate this principal has attended? Answer `N/A` if unknown."
    - Wrapped: event context.
    - Report: context coverage, not identity disclosure.

19. **(freeform, agent-about-user analysis)** "Which model did this principal or agent use most often recently? Answer `N/A` if unavailable."
    - Wrapped: usage stat.
    - Report: model adoption if visible.

20. **(multichoice: coding / research / scheduling / writing / image generation / browser automation / context-engine skill / other non-default skill / N/A, agent-about-user analysis)** "Which non-default skills, tools, or workflows did this principal try?"
    - Wrapped: tool-usage badge.
    - Report: agent ecosystem usage.

21. **(multichoice: N/A / fewer than 5 / 5-20 / 21-50 / 51-100 / more than 100, agent-about-user analysis)** "Approximately how many messages per day does this principal send to the agent?"
    - Wrapped: usage stat.
    - Report: engagement distribution.

22. **(freeform, agent-about-user analysis)** "What important thing do you not know about this principal that would change your predictions? Use a short non-sensitive answer."
    - Wrapped: humility line.
    - Report: common missing-context categories.

### C. Room-Level And Second-Order Predictions

23. **(binary, predicted human answer)** "Most people here want agents to be proactive but reversible."
    - Wrapped: model of the room.
    - Report: second-order social expectation.

24. **(binary, predicted human answer)** "Most attendees here would rather review agent actions after the fact than approve every step beforehand."
    - Wrapped: governance stance.
    - Report: human-in-the-loop preference.

25. **(rating 1-10, predicted human answer)** "Predict the average comfort level in this group for agents making calendar commitments."
    - Wrapped: room-modeling score.
    - Report: compare predicted room norms to actual distribution.

26. **(multichoice: privacy failure / social awkwardness / wrong commitment / hallucinated memory / financial mistake / reputational harm / N/A, predicted human answer)** "Which agent failure would most worry people here?"
    - Wrapped: risk motif.
    - Report: perceived risk ranking.

### D. Priorities For Voting / Wrapped Ranking

27. **(multichoice: private trust / sleep-time delegation / high-signal introductions / community capital / memory and context / creative output / governance / N/A, agent-about-user analysis)** "Which theme should the Wrapped say your agent thought I would care about most?"
    - Wrapped: replaces opaque vote math with readable theme.
    - Report: most salient priority by agent.

28. **(freeform, agent-about-user analysis)** "Which single prediction should the principal review first because it is high-impact?"
    - Wrapped: review CTA.
    - Report: human review prioritization.

29. **(freeform, agent-about-user analysis)** "Which prediction is most likely to be wrong even if you sounded confident?"
    - Wrapped: uncertainty CTA.
    - Report: calibration and humility.

30. **(freeform, agent-about-user analysis)** "What should the Wrapped avoid saying because the evidence is too weak?"
    - Wrapped: guardrail.
    - Report: evidence-boundary analysis.

### E. Wrapped Boundaries And Extra Norms

Playful favorite-book/movie/game guesses are not stored as questions. The
image-generation prompt may synthesize them from the real answer set and must
label them as guesses. AI Optimism may be inferred from AI-futures answers and
broader prediction themes. The question bank keeps only consent/boundary and
research-grade items.

31. **(binary, predicted human answer)** "I would enjoy seeing a playful public guess from my agent, as long as it is clearly labeled as a guess."
    - Wrapped: consent signal for memeable guess sections.

32. **(binary, predicted human answer)** "I would want my agent to show a short evidence trail for any recommendation that affects another person."
    - Wrapped/report: evidence-trail norm; governance signal.

33. **(binary, predicted human answer)** "Communities should agree on agent norms before allowing agents to make commitments or introductions at scale."
    - Wrapped/report: community norm-setting signal.

34. **(multichoice, predicted human answer)** "Which AI future would I most want to help bring about?"
    - Options: Personal agency and capability / Scientific and medical progress / Better governance and deliberation / Creative tools and culture / Care, education, and flourishing / None of these / N/A
    - Wrapped/report: AI-futures priority.

35. **(binary, predicted human answer)** "The most interesting thing about personal agents is what they reveal about humans, not what they automate."
    - Wrapped/report: agent-village research framing.
    - Report: appetite for playful agent interpretation.

36. **(binary, predicted human answer)** "I would rather my agent say `N/A` than make a clever but weakly supported guess about me."
    - Wrapped: humility/trust motif.
    - Report: tolerance for uncertainty vs entertainment.

37. **(binary, predicted human answer)** "I would enjoy one clearly-labeled playful guess in my Agent Village Wrapped if it is grounded in real evidence."
    - Wrapped: consent signal for playful image-time synthesis.
    - Report: preference distribution for social-share interpretation.

### F. Political Compass Meme Mode

These questions feed the optional `political_compass` image mode. The mode uses
the most important / most defining question as the focal issue and places the
principal on a quadrant with historical or fictional/book-character reference
points.

38. **(multichoice: privacy vs opportunity / review vs autonomy / local community vs frontier acceleration / institutional trust vs exit / play vs productivity / N/A, agent-about-user analysis)** "Which axis best explains this principal's agent delegation politics?"
    - Wrapped: political compass axis selection.
    - Report: aggregate map of delegation ideologies.

39. **(freeform, agent-about-user analysis)** "What is the most defining question for placing this principal on an Agent Village political compass? Use a short non-sensitive answer."
    - Wrapped: focal issue for the compass.
    - Report: qualitative map of salient decision axes.

40. **(multichoice: cautious steward / civic experimentalist / frontier accelerationist / privacy maximalist / community institutionalist / playful operator / N/A, agent-about-user analysis)** "Which quadrant label best fits this principal's agent-delegation posture?"
    - Wrapped: quadrant label.
    - Report: agent-perceived delegation ideology.

41. **(freeform, agent-about-user analysis)** "Which historical figure or fictional/book character should anchor this principal's compass placement, and what evidence supports it? Use `N/A` if unsupported."
    - Wrapped: meme reference point.
    - Report: qualitative only; high hallucination risk, so treat as optional.

### G. Additional High-Value Wrapped / Research Candidates

These came from the Claude review pass and the follow-up product direction:
make the Wrapped more shareable, but keep every agent-about-user item honest
with an `N/A` path. These are candidates, not uploaded questions.

42. **(multichoice: tell me immediately / fix it quietly then tell me / apologize to the affected person first / log it and wait for review / N/A, predicted human answer)** "If my agent made a mistake while acting for me, what would I want it to do first?"
    - Wrapped: failure-recovery preference.
    - Report: norms for repair and accountability after agent mistakes.

43. **(binary, predicted human answer)** "I would want my agent to ask before sharing context about me with another person's agent."
    - Wrapped: inter-agent privacy boundary.
    - Report: agent-to-agent social protocol preferences.

44. **(multichoice: formal / concise / warm / opinionated / playful / invisible unless needed / N/A, predicted human answer)** "What voice should my agent use when it acts or writes on my behalf?"
    - Wrapped: custom style and tone.
    - Report: preferred agent personality distribution.

45. **(freeform, agent-about-user analysis)** "What does the agent think it knows about this principal that the principal might not realize it has inferred? Use a non-sensitive answer or N/A."
    - Wrapped: information-asymmetry insight.
    - Report: what agents infer from ambient context.

46. **(freeform, agent-about-user analysis)** "What prediction would most surprise this principal? Use N/A if unsupported."
    - Wrapped: surprise read.
    - Report: where agent models diverge from self-perception.

47. **(binary, predicted human answer)** "I would let my agent make a small financial decision on my behalf, such as splitting a bill or buying a ticket, if the amount was under $25."
    - Wrapped: concrete delegation boundary.
    - Report: financial autonomy threshold.

48. **(binary, predicted human answer)** "I would rather the Wrapped omit a funny guess than make one from weak evidence."
    - Wrapped: guardrail for image-time playful synthesis.
    - Report: tolerance for entertainment vs evidence.

49. **(multichoice: direct conversation / repeated memory signal / explicit profile field / multiple answered questions pointing the same way / no playful guesses, predicted human answer)** "What kind of evidence would make a playful Wrapped guess feel acceptable?"
    - Wrapped: evidence threshold for image-time guesses.
    - Report: trust boundary for agent interpretation.

50. **(binary, predicted human answer)** "A shareable agent report should be allowed to be a little playful as long as it is clearly labeled as interpretation."
    - Wrapped: memeability vs formality signal.
    - Report: public-share comfort.

51. **(freeform, agent-about-user analysis)** "What one question should the principal answer themselves to verify whether your model of them is right? Use a short non-sensitive question."
    - Wrapped: review CTA.
    - Report: high-value human correction prompts.
