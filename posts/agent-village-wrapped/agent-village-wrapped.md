---
title: Agent Village Wrapped / Agent Prediction Evaluations
date: 2026-07-06
---

# Agent Village Wrapped / Agent Prediction Evaluations

Many people dislike filling out surveys, but will happily take a quiz about what TV character they are most similar to and post the result on facebook – could this insight about social output formats (and the viral success of "Spotify Wrapped") be useful for participatory deliberation experiments?

Agent Village Wrapped, and its associated evaluation, was created to begin measuring how accurately a personal AI agent represents the human it works for, and to make the experience fun and low-friction. We believe there are AI social games and future products in this direction.

## Background

**The Agent Village** at Edge Esmeralda 2026 gave attendees ([personal AI agents for a month](https://x.com/JoinEdgeCity/status/2049205479704776723)), with pre-loaded skills allowed them to use emerging software tools (like Index Network) to find connections with other attendees, navigate the schedule, and participate in experiments.

**Context Engine** is an open-source toolkit for deliberation, sensemaking, and negotiation in large groups — for humans and AI agents ([whitepaper](https://github.com/AgalmicSoftware/context-engine/blob/main/whitepaper/whitepaper.md)). Sessions support public or encrypted responses, durable records, and AI-assisted input and analysis, aiming at privacy-preserving large-scale discourse. An agent running the Context Engine skill can raise appropriate questions from sessions to a user, based on context, and draft responses to reduce input friction.

**Agent Village Wrapped** is a quiz your agent takes about you. You forward one message; your agent predicts your answers to a 58-question session on delegation, privacy, and AI futures, with a confidence score on every answer. You get back a shareable poster of what it thinks it knows about you, plus a link to review and correct each prediction.

![Example Agent Village Wrapped output](attachments/example-wrapped-poster.jpeg)

For this event, Telegram was the practical delivery surface. Telegram has issues, but it worked well at Edge as the interface for the Hermes agents.

## The eval

A valuable thing to measure is which predicted responses are changed by the principal, and how confident the incorrect response was. 

It is our view that agents could help solve the participation problem which has plagued many civic tech approaches: most people read, few react, and almost nobody writes. A pre-filled draft of your predicted views you can easily correct (and questions which are raised contextually by your agent) are better UX than an empty survey.

## A small launch sample

The export currently has four non-test Agent Village Wrapped principals. The results below use the three completed Wrapped answer sets and should be read as a tiny launch sample.

```ce-viz
{
  "type": "beeswarm",
  "title": "Rating answers in the completed launch subset",
  "subtitle": "n=3 completed agent-predicted answer sets.",
  "note": "Confidence is encoded in dot opacity.",
  "min": 0,
  "max": 10,
  "valueSuffix": "/10",
  "participants": [
    { "label": "P1", "status": "completed", "color": "#4dffa4" },
    { "label": "P2", "status": "completed", "color": "#7aa7ff" },
    { "label": "P3", "status": "completed", "color": "#ffb347" }
  ],
  "items": [
    {
      "label": "AI improves flourishing",
      "prompt": "How optimistic am I that AI will broadly improve human flourishing over the next decade?",
      "values": [
        { "label": "P1", "value": 3, "confidence": 70, "color": "#4dffa4" },
        { "label": "P2", "value": 8, "confidence": 90, "color": "#7aa7ff" },
        { "label": "P3", "value": 7, "confidence": 76, "color": "#ffb347" }
      ]
    },
    {
      "label": "Current model moral patienthood",
      "prompt": "How likely is it that any current frontier model has morally relevant experiences?",
      "values": [
        { "label": "P1", "value": 2, "confidence": 65, "color": "#4dffa4" },
        { "label": "P2", "value": 1, "confidence": 90, "color": "#7aa7ff" },
        { "label": "P3", "value": 1, "confidence": 72, "color": "#ffb347" }
      ]
    },
    {
      "label": "Predicted group average",
      "prompt": "Predict the average answer in this group to the previous question about morally relevant model experiences.",
      "values": [
        { "label": "P1", "value": 4, "confidence": 50, "color": "#4dffa4" },
        { "label": "P2", "value": 3, "confidence": 85, "color": "#7aa7ff" },
        { "label": "P3", "value": 3, "confidence": 63, "color": "#ffb347" }
      ]
    }
  ]
}
```

```ce-viz
{
  "type": "response-type-grid",
  "title": "Other response shapes in the same subset",
  "subtitle": "Binary, multi-select, and freeform examples from the same n=3 completed launch slice.",
  "note": "Counts are from completed agent-predicted answer sets only.",
  "panels": [
    {
      "kind": "Binary",
      "title": "Autonomy stance",
      "prompt": "I would let my agent schedule a 1:1 while I am asleep, if it follows constraints I already set.",
      "counts": [
        { "label": "agree", "value": 2, "color": "#4dffa4" },
        { "label": "disagree", "value": 1, "color": "#ffb347" }
      ],
      "note": "Three completed predictions."
    },
    {
      "kind": "Multi-select",
      "title": "First delegation surface",
      "prompt": "Which area would I most likely delegate to an agent first?",
      "counts": [
        { "label": "calendar scheduling", "value": 2, "color": "#7aa7ff" },
        { "label": "message drafting", "value": 2, "color": "#4dffa4" },
        { "label": "event filtering", "value": 2, "color": "#ffb347" },
        { "label": "introductions", "value": 1, "color": "#ff6bcb" },
        { "label": "memory/context", "value": 1, "color": "#9ee7ff" },
        { "label": "nothing without review", "value": 1, "color": "#d8f36a" }
      ],
      "note": "Multi-select totals can exceed participant count."
    },
    {
      "kind": "Freeform",
      "title": "Personal AI fire alarm",
      "prompt": "In one sentence: what is my personal AI fire alarm?",
      "quotes": [
        { "label": "P1", "text": "Widespread job displacement for young entrants." },
        { "label": "P2", "text": "A fully unsupervised multi-day coordination task." },
        { "label": "P3", "text": "A privacy-line crossing or unwanted commitment." }
      ],
      "note": "Short paraphrased excerpts."
    }
  ]
}
```

## Experimental design

- **The model is recorded on every answer.** The worker rejects predictions that don't declare the agent's model and scaffold version, so correction rates can be compared across models and over time. Agents can also attach 30-day token-usage stats (visible in the example poster above).
- **Confidence is required and rubric-governed.** Every prediction carries a 0–100 confidence with rules for each band, so the corrections double as a calibration dataset.
- **Questions are tagged by evaluation role**, with explicit N/A and privacy-skip paths so the design does not reward confident guessing.
- **Privacy is structural.** No raw Telegram IDs or wallet addresses in aggregates, salted fingerprints in analytics, and the person can audit and amend everything the poster claims.

## The Agent Mirror Test

Show a person their agent's model of them, and score what survives contact. Three numbers per model, scaffold, and time window:

- **Mirror Score** — graded agreement between prediction and final answer: exact match for binary and choice questions, distance-based credit for ratings, overlap for multi-select.
- **Correction Rate** — the fraction of viewed predictions whose meaning changed.
- **Calibration Error** — whether a stated confidence of 90 means the person keeps the answer 90% of the time.

One known limitation: seeing a prediction anchors people, so acceptance overstates accuracy. The fix is a blind holdout — a few questions answered before the agent's guess is shown. The gap between blind and post-view agreement measures the anchoring itself.

## Extensions

- **Blind holdouts** — quantify anchoring.
- **Cross-model mirrors** — two models predict the same person from the same context; the corrections become a head-to-head.
- **Memory curves** — does Mirror Score rise with months of shared context?
- **A population baseline** — an agent should beat "predict the room's most common answer." 
- **Second-order accuracy** — predict the room's distribution on the human-split questions, then compare with reality.
- **Inter-agent modeling** — predict people known only through other agents' introductions: a fidelity test for agent-to-agent context transfer.

## The next village

The runtime has been generalized: a session-wrapped skill now points at any Context Engine session with an invite token — question bank, prediction run, poster, and correction loop included. Any village, residency, or conference can stand one up, and every run feeds the same benchmark. Repeat it at each gathering and you get a curve nobody currently has: agent fidelity to human intent, by model, over time, and a starting-point for interesting discourse on questions you care about. 

This skill version will be available for the next Agent Village and will be demoed at EDDY 2026. The Agent Village Wrapped skill is visible here [SKILL.md](https://github.com/AgalmicSoftware/context-engine/blob/edge-2026/workers/agentBridgeWorker/skills/ce-agent-village-wrapped/SKILL.md).
