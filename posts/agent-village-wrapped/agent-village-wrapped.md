---
title: Agent Village Wrapped and the Agent Mirror Test
date: 2026-07-06
---

# Agent Village Wrapped and the Agent Mirror Test

People hate filling out surveys. The same people will happily take a "which TV character are you?" quiz and post the result. A quiz is about you, and the output is fun to share.

Agent Village Wrapped applies that observation to a research question: how accurately does a personal AI agent model the person it works for?

## About Context Engine

Context Engine is an open-source toolkit for deliberation, sensemaking, and negotiation — for humans and AI agents. The pace of AI development has outrun our institutions' capacity to deliberate, and part of that is an infrastructure problem: we lack formats for large-scale discourse that survive information overload and attention scarcity. Context Engine sessions support public or encrypted questions and responses, durable records, cryptographic access control, and AI-assisted input and analysis — tools for a world of privacy-preserving large-scale discourse and, eventually, automated negotiation between groups.

The agent skill makes this concrete for groups. An agent running the Context Engine skill can raise questions directly in a group chat, and anyone can join a session by scanning a QR code — no account, no app install. Answer once and you have participated in large-scale discourse with less friction than a poll. Let your agent answer first and correct what it gets wrong, and over time you are represented more and more accurately, with less and less effort. Wrapped is the playful front end of that loop.

## What it is

The [Agent Village](https://pastebin.com/Q7RBkKwC) at Edge Esmeralda 2026 gave attendees personal AI agents for a month. For the village, we built Agent Village Wrapped on Context Engine: you forward one message to your agent, and it answers a 58-question session about your preferences, delegation boundaries, and views on AI futures — predicting what you would say, with a confidence score on every answer. You get back a shareable poster of what your agent thinks it knows about you, plus a link to review and correct every prediction.

![Example Agent Village Wrapped output](attachments/example-wrapped-poster.png)

The proposal was [selected for funding on Simocracy](https://www.simocracy.org/proposals/did%3Aplc%3Abnb2onvsvtmryjvy77fmrtou/3mognd4flwk2i), where AI sims evaluate and fund proposals — the first backers of this eval were bots. We finished it in the closing days of the village, so only a few people ran it. The design is reusable, and that is what this post is about.

## The eval

The poster gets people in the door. The measurement happens on the review screen, where each prediction can be accepted, changed, or skipped. The data people change when they see their agent's prediction is the eval: every untouched prediction is a hit, and every correction is a labeled miss with the person's real answer attached.

This uses an old internet principle, sometimes called Cunningham's Law: the fastest way to get a right answer online is to post a wrong one. People who won't volunteer information will readily correct information that is wrong about them. Civic tech has struggled with the volunteering side for years — most people read, few react, almost nobody writes (Nielsen's "90-9-1" rule). A blank survey is the hard path; a draft of your views that you can correct is the easy one.

The instrumentation exists in the Context Engine worker. Each answer carries a provenance record: whether the agent drafted it, fingerprints of the agent's version and the final version, edit counts, when the person first viewed the prediction (corrections only count after it was seen), and a typed delta — stance flip, rating shift, choice change, freeform rewrite.

```ce-viz
{
  "type": "category-dots",
  "title": "The 58-question launch set, by evaluation role",
  "subtitle": "Each question is tagged with the role it plays in the eval.",
  "dotUnit": 1,
  "valueSuffix": "",
  "categories": [
    {
      "label": "Calibration",
      "value": 44,
      "detail": "The agent predicts its human's answer and states confidence; corrections score accuracy and calibration.",
      "color": "#4dffa4"
    },
    {
      "label": "Human split",
      "value": 11,
      "detail": "Questions people genuinely disagree on, for testing whether agents can predict the room's distribution.",
      "color": "#7aa7ff"
    },
    {
      "label": "Wrapped generation",
      "value": 2,
      "detail": "Agent-about-user analysis that feeds the shareable poster.",
      "color": "#ffb347"
    },
    {
      "label": "Prediction",
      "value": 1,
      "detail": "Forward-looking prediction item.",
      "color": "#ff6bcb"
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

## Running it over Telegram

Context Engine ships a Telegram bot and agent skills, so any group already organized on Telegram can run a session with almost no setup: invite tokens handle onboarding, a skill tells the agent which endpoints to call, and a Mini App handles review and corrections. We think Telegram has real security problems and would not run sensitive sessions there — but it is one of the best platforms for reaching people through bots, and for an opt-in experiment at an event the tradeoff is reasonable. Groups with stricter requirements can use Context Engine's web application with encrypted responses.

## The next village

The runtime has been generalized: a session-wrapped skill now points at any Context Engine session with an invite token — question bank, prediction run, poster, and correction loop included. Any village, residency, or conference can stand one up, and every run feeds the same benchmark. Repeat it at each gathering and you get a curve nobody currently has: agent fidelity to human intent, by model, over time.

An improved version will be available for the next Agent Village and will be demoed at EDDY 2026.

## Extensions

- **Blind holdouts** — quantify anchoring.
- **Cross-model mirrors** — two models predict the same person from the same context; the corrections become a head-to-head.
- **Memory curves** — does Mirror Score rise with months of shared context?
- **A population baseline** — an agent should beat "predict the room's most common answer." If it can't, it has memory theater, not memory.
- **Second-order accuracy** — predict the room's distribution on the human-split questions, then compare with reality.
- **Inter-agent modeling** — predict people known only through other agents' introductions: a fidelity test for agent-to-agent context transfer.

---

*Agent Village Wrapped ran at the Agent Village, Edge Esmeralda 2026, on the Context Engine agent bridge. The question set, skills, and correction instrumentation are in the [repository](https://github.com/AgalmicSoftware/context-engine). Diagram prompts for this post's figures are in [`diagram-prompts.md`](diagram-prompts.md).*
