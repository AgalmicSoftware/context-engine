---
title: Agent Village Wrapped and the Agent Mirror Test
date: 2026-07-06
---

# Agent Village Wrapped and the Agent Mirror Test

People don't like filling out surveys. The same people will happily take a "which TV character are you?" quiz and post the result. The difference is that a quiz is about you, and the output is fun to share.

Agent Village Wrapped applies that observation to a research question: how accurately does a personal AI agent model the person it works for?

## Background

The [Agent Village](https://pastebin.com/Q7RBkKwC) at Edge Esmeralda 2026 gave attendees personal AI agents for a month — agents that could navigate the schedule, make introductions, and participate in community coordination on their humans' behalf.

For the village, we built Agent Village Wrapped on Context Engine. A participant forwards one message to their agent. The agent reads a skill file, then answers a curated 58-question session about the participant's preferences, delegation boundaries, trust posture, and views on AI futures — predicting what the participant would say, with a confidence score on every answer. It returns a shareable Wrapped-style poster of what it thinks it knows about its human, plus a link to review and correct every prediction.

The proposal was [selected for funding on Simocracy](https://www.simocracy.org/proposals/did%3Aplc%3Abnb2onvsvtmryjvy77fmrtou/3mognd4flwk2i), a governance experiment where AI sims evaluate and fund proposals. The first backers of this eval were bots.

We finished it in the closing days of the village, so only a few people ran it. The design is reusable, though, and that is what this post is about.

## The eval

The poster gets people in the door. The measurement happens afterward: the review screen shows each prediction the agent made, and the participant can accept it, change it, or skip it.

The data people change when they see their agent's prediction is the eval. Every prediction left alone is a hit. Every correction is a labeled miss, with the person's real answer attached. Nobody sat through a survey — they came for the image and left behind a ground-truth correction set.

This leans on an old internet principle, sometimes called Cunningham's Law: the fastest way to get a right answer online is to post a wrong one. People who would never volunteer information will readily correct information that is wrong about them. Civic tech platforms have struggled with the volunteering side of this for years — participation follows the familiar pattern where most people read, few react, and almost nobody writes (Nielsen's "90-9-1" participation inequality). Asking someone to author their views from a blank page is the hard path. Showing them a draft of their views and asking what's wrong with it is the easy one, and the correction is often higher-signal than a cold answer would have been.

The instrumentation already exists in the Context Engine worker. Each submitted answer carries a provenance record: whether the agent drafted it, a semantic fingerprint of the agent's version and the final version, how many human edits occurred, when the person first viewed the prediction (so corrections only count after the prediction was actually seen), how long they took between viewing and submitting, and a typed delta — stance flip, rating shift, choice added or removed, freeform rewrite. Comparison uses canonical semantic forms, not raw strings, so reformatting an identical answer does not count as a correction.

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
      "detail": "Questions where the agent predicts its human's answer and states confidence; corrections score both accuracy and calibration.",
      "color": "#4dffa4"
    },
    {
      "label": "Human split",
      "value": 11,
      "detail": "Questions people genuinely disagree on, useful for measuring whether agents can predict the room's distribution.",
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

One known limitation: showing someone a prediction anchors them, so acceptance overstates accuracy. The fix is a blind holdout — a few questions the person answers before seeing the agent's guess. The gap between blind agreement and post-view agreement measures the anchoring effect itself, which is worth knowing on its own.

## Running it over Telegram

Context Engine ships a Telegram bot and a set of agent skills that make this work anywhere a group already lives on Telegram. The bot handles onboarding with invite tokens, the skill tells the agent exactly which endpoints to call, and a Mini App handles review and corrections. No accounts, no app installs, no survey link that nobody clicks.

We think Telegram has real security problems, and we would not run sensitive sessions through it. But it is one of the best platforms available for reaching people through bots, and for a low-friction opt-in experiment at an event, that tradeoff is reasonable. Groups with stricter requirements can run the same session through Context Engine's web application with encrypted responses.

## The next village

The Edge Esmeralda run confirmed the flow works end to end; it needed to exist two weeks earlier than it did. The runtime has since been generalized: alongside the Edge-specific skill there is a generic session-wrapped skill that points at any Context Engine session with an invite token — question bank, prediction run, poster, and correction loop included. Any village, residency, or conference can stand one up, and every run feeds the same longitudinal benchmark.

Run the Mirror Test at every gathering and you get a curve nobody currently has: agent fidelity to human intent, by model and scaffold, over time — measured by whether real people accept what their agents said on their behalf.

## Extensions

Once more people have persistent agents, the same correction loop supports:

- **Blind holdouts** — quantify anchoring, as above.
- **Cross-model mirrors** — two models predict the same person from the same context; the corrections become a head-to-head.
- **Memory curves** — does Mirror Score rise with months of shared context? Token-usage data gives the x-axis.
- **A population baseline** — an agent should beat "predict the room's most common answer." If it can't, it has memory theater, not memory.
- **Second-order accuracy** — the human-split questions let agents predict the room's distribution, not just their own human; compare predicted and actual splits.
- **Inter-agent modeling** — agents predicting people they know only through other agents' introductions: a fidelity test for agent-to-agent context transfer.

---

*Agent Village Wrapped ran at the Agent Village, Edge Esmeralda 2026, on the Context Engine agent bridge. The question set, skills, and correction instrumentation are in the [repository](https://github.com/AgalmicSoftware/context-engine), and the generalized session-wrapped flow will be ready for the next agent village.*
