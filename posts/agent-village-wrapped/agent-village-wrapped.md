---
title: Agent Village Wrapped: Does Your Agent Know You? (Experiment + Eval)
date: 2026-07-06
---

# Agent Village Wrapped: Does Your Agent Know You? (Experiment + Eval)

Many people dislike filling out surveys, but would happily take (and share) a quiz about what kind of dog they are [on Facebook](https://www.nbcnews.com/id/wbna33830316). Could this insight about social output formats (and the viral success of "Spotify Wrapped") be useful for participatory deliberation experiments?

Agent Village Wrapped, and its associated evaluation, was created to begin measuring how accurately a personal AI agent represents the human it works for, and to make the experience fun and low-friction. We believe there are AI social games and future products in this direction.

A [proposal for "Agent Village Wrapped"](https://www.simocracy.org/proposals/did%3Aplc%3Abnb2onvsvtmryjvy77fmrtou/3mognd4flwk2i) was made on Simocracy and allocated $626 by Sims on the platform. These funds will be donated to Edge, because we did not end up needing them to complete the AI actions related to Agent Village Wrapped.

## Background

**The Agent Village** at Edge Esmeralda 2026 gave attendees ([personal AI agents for a month](https://x.com/JoinEdgeCity/status/2049205479704776723)), with pre-loaded skills allowed them to use emerging software tools (like Index Network) to find connections with other attendees, navigate the schedule, and participate in experiments.

**Context Engine** is an open-source toolkit for deliberation, sensemaking, and negotiation in large groups — for humans and AI agents ([whitepaper](https://github.com/AgalmicSoftware/context-engine/blob/main/whitepaper/whitepaper.md)). Sessions support public or encrypted responses, durable records, and AI-assisted input and analysis, aiming at privacy-preserving large-scale discourse. An agent running the Context Engine skill can raise appropriate questions from sessions to a user, based on context, and draft responses to reduce input friction.

**Agent Village Wrapped** is a quiz your agent takes about you. You forward one message; your agent predicts your answers to a 58-question session on delegation, privacy, and AI futures, with a confidence score on every answer. You get back a shareable poster of what it thinks it knows about you, plus a link to review and correct each prediction.

![Example Agent Village Wrapped output](attachments/example-wrapped-poster.jpeg)

For this event, Telegram was the practical delivery surface. Telegram has issues, but it worked well at Edge as the interface for the Hermes agents.

## The eval

A valuable thing to measure is which predicted responses are changed by the principal, and how confident the incorrect response was. 

It is our view that agents could help solve the participation problem which has plagued many civic tech approaches: most people read, few react, and almost nobody writes. A pre-filled draft of your predicted views you can easily correct (and questions which are raised contextually by your agent) are better UX than an empty survey.

```ce-viz
{
  "type": "response-type-grid",
  "title": "Statistics",
  "inline": true,
  "hideTitle": true,
  "presentation": "editorial",
  "panels": [
    {
      "kind": "Models",
      "title": "Responding Model Type",
      "display": "pie",
      "counts": [
        { "label": "google/gemini-3.5-flash", "value": 2, "color": "#7aa7ff" },
        { "label": "z-ai/glm-5.2", "value": 1, "color": "#ff6bcb" },
        { "label": "unserialized model record (Hermes Agent v0.14.0)", "value": 1, "color": "#ffb347" }
      ],
      "note": "One run stored its model metadata as [object Object], so it appears here as an unserialized model record."
    },
    {
      "kind": "Answer shapes",
      "title": "Prediction Response Types",
      "display": "ring",
      "counts": [
        { "label": "binary", "value": 160, "color": "#7aa7ff" },
        { "label": "multi-select", "value": 52, "color": "#4dffa4" },
        { "label": "rating", "value": 12, "color": "#ffb347" },
        { "label": "freeform", "value": 8, "color": "#ff6bcb" }
      ]
    },
    {
      "kind": "Confidence",
      "title": "Agent confidence",
      "display": "bars",
      "prompt": "Average confidence 80.8/100.",
      "summaryValue": 80.8,
      "summarySuffix": "/100",
      "counts": [
        { "label": "90-100", "value": 69, "color": "#4dffa4" },
        { "label": "75-89", "value": 108, "color": "#7aa7ff" },
        { "label": "50-74", "value": 54, "color": "#ffb347" },
        { "label": "25-49", "value": 1, "color": "#ff6bcb" }
      ]
    }
  ]
}
```

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

A few choices make this a benchmark rather than a party trick:

- **The model is recorded on every answer.** The worker rejects any prediction that does not declare the agent's model and scaffold version. Every correction is attributable, so correction rates can be compared across models, scaffolds, and time. Agents can also attach 30-day token-usage figures, so accuracy can be related to how heavily the person actually uses their agent.
- **Confidence is required and rubric-governed.** Every prediction carries a 0–100 confidence, with rules for assigning it: 90–95 only for direct memory evidence, 70–89 for supported inference, 40–69 for population priors. The correction data therefore doubles as a calibration dataset.
- **Questions are tagged by evaluation role.** Each of the 58 questions is labeled with an evaluation lane (agent predicting the human's answer vs. agent analyzing its human from context) and type, as shown above. Questions the agent lacks evidence for have explicit N/A and privacy-skip paths, so the design does not reward confident guessing.
- **Privacy is structural.** Aggregates never include raw Telegram IDs or wallet addresses; analytics identify participants only by a salted fingerprint; and the poster is generated from predictions the person can immediately audit and amend.

## The Agent Mirror Test

We call the benchmark the Agent Mirror Test: show a person their agent's model of them, and score what survives contact.

For each person and question, the agent submits a prediction with a confidence. After the person has viewed it, they submit a final answer. From this we compute:

- **Mirror Score** — graded agreement between prediction and final answer, averaged over viewed predictions. Exact match for binary and single-choice questions, distance-based credit for ratings, overlap for multi-select. This is the headline number for a given model, scaffold, and time window.
- **Correction Rate** — the fraction of viewed predictions whose meaning changed.
- **Calibration Error** — whether a stated confidence of 90 actually means the person keeps the answer 90% of the time.

One known limitation: seeing a prediction anchors people, so acceptance overstates accuracy. The fix is a blind holdout — a few questions answered before the agent's guess is shown. The gap between blind and post-view agreement measures the anchoring itself.

## Extensions

- **Cross-model mirrors** — give two models the same questions and context, then compare paired Mirror Score and calibration.
- **Memory improvement over time** — ask the same model the same questions after it has learned more about you, then measure whether its predictions become more accurate.
- **Question-importance ranking** — have agents make pairwise question comparisons, convert them into an Elo importance ranking, and let each principal review and correct the result. Quadratic or standard upvotes and downvotes could provide a lower-friction variation for estimating the same ranking.
- **Second-order accuracy** — predict the room's answer distribution on questions that split it, then score the forecast with Brier or log score.
- **Inter-agent modeling** — compare predictions from direct principal context with predictions based only on another agent's introduction; the endpoint is the resulting transfer loss.

## The next village

The runtime has been generalized: a session-wrapped skill now points at any Context Engine session with an invite token — question bank, prediction run, poster, and correction loop included. Any village, residency, or conference can stand one up, and every run feeds the same benchmark. Repeat it at each gathering and you get a curve nobody currently has: agent fidelity to human intent, by model, over time, and a starting-point for interesting discourse on questions you care about. 

The Context Engine / "Agent Village Wrapped" runtime has been generalized so a `SKILL.md` can interact with sessions using an invite or agent access token. We are working toward a turnkey event setup in which organizers provide only a question bank, a Cloudflare API token, and an AI key, while reusing the Context Engine Telegram bot. The current hosted flow is the prototype for that setup; clean event self-service is not available yet. Once complete, events, conferences, and organizations will be able to launch similar experiments from Context Engine's open-source code. Repeated gatherings could produce a valuable longitudinal dataset of communal preferences and agent fidelity to human intent, while also supporting automated discourse on questions each community cares about.

A reusable version of the event skill will be published with the turnkey event workflow. This approach will also be demoed at [EDDY 2026](https://www.eddy-network.eu/in-person-events/eddy-2026-vienna).
