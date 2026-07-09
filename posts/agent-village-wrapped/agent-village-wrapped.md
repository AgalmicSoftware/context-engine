---
title: Agent Village Wrapped / Agent Prediction Evaluations
date: 2026-07-06
---

# Agent Village Wrapped / Agent Prediction Evaluations

Many people dislike filling out surveys, but happily take (and share) a quiz about what kind of dog they are [on facebook](https://www.nbcnews.com/id/wbna33830316). Could this insight about social output formats (and the viral success of "Spotify Wrapped") be useful for participatory deliberation experiments?

Agent Village Wrapped and its associated evaluation were created to begin measuring how accurately a personal AI agent represents a human principal — the person it works for — and to make the process low-friction. We believe there are social AI games and future products in this direction: agents could help solve the participation and attention-scarcity challenges that have plagued civic tech, and lead to a future where your agent is always [bargaining and coalition-building on your behalf](https://blog.cosmos-institute.org/p/coasean-bargaining-at-scale).

## Background

**The Agent Village** at Edge Esmeralda 2026 gave attendees [personal AI agents for a month](https://x.com/JoinEdgeCity/status/2049205479704776723), pre-loaded with skills allowing them to find connections with other attendees (Index Network), curate a knowledge graph (GeoBrowser), navigate the schedule (EdgeOS), and participate in experiments. The most common setup was a pre-loaded Hermes agent with an OpenRouter key accessible via Telegram, although the skills could also be used via Claude Code, OpenClaw, and other agents.

**Context Engine** is an [open-source toolkit](https://github.com/AgalmicSoftware/context-engine/blob/main/whitepaper/whitepaper.md) for deliberation, sensemaking, and negotiation in large groups (of humans and AI agents). Sessions support public or private questions, AI-assisted input and analysis of results, and decentralized or centralized versions that can be started by anyone easily. An agent running the Context Engine skill can raise appropriate questions to a user based on context, and draft + submit responses to reduce input friction.

**Agent Village Wrapped** is a quiz your agent takes about you. You send one command, and your agent predicts your answers to a set of questions (this time on delegation, privacy, and AI futures) with a confidence score on every answer. You get back a shareable image of what it thinks it knows about you, as well as a link to review and correct all predictions via a Telegram Bot. Telegram was a primary interface for the Edge Hermes agents.

## Outputs

The first output is a shareable Wrapped-style poster: a compact summary of what the agent thinks it knows about the principal, including high-confidence predictions, cautious predictions, guessed affinities, and token usage.

![Example Agent Village Wrapped output](attachments/example-wrapped-poster.jpeg)

The same inputs can also produce more focused exhibits. Here we see a "political compass meme", where the agent analyzes how the principal lands on a specific claim and compares that view with historical figures, fictional characters, and other reference points.

![Agent Village norms map comparing a predicted view with historical and fictional reference figures](attachments/norms-map-compass.jpeg)

## Early data (n = 4)

Agent Village Wrapped launched too late for widespread use, so treat this as a preview of what results could look like. Four agents took the quiz — 58 questions each, 232 predictions — and no human corrections were made. Everything below is unreviewed agent prediction: it shows what the eval collects, and none of the Mirror Test numbers described in the next section can be computed from it yet.

```ce-viz
{
  "type": "response-type-grid",
  "title": "Statistics",
  "inline": true,
  "hideTitle": true,
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
      "note": "One run preserved the model field as [object Object]."
    },
    {
      "kind": "Answer shapes",
      "title": "Prediction Response Types",
      "display": "pie",
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
      "prompt": "Average confidence 80.8/100.",
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

```ce-viz
{
  "type": "binary-beeswarm",
  "title": "Consensus and Difference",
  "inline": true,
  "hideTitle": true,
  "items": [
    {
      "label": "I am more worried about agents being too passive and useless than too autonomous and dangerous.",
      "counts": [
        { "label": "agree", "value": 2, "color": "#4dffa4" },
        { "label": "disagree", "value": 2, "color": "#ffb347" }
      ],
      "averageConfidence": 80.3
    },
    {
      "label": "I would be comfortable with my agent representing me in a group chat, as long as others know it is an agent.",
      "counts": [
        { "label": "agree", "value": 2, "color": "#4dffa4" },
        { "label": "disagree", "value": 2, "color": "#ffb347" }
      ],
      "averageConfidence": 78.8
    },
    {
      "label": "I would give up some privacy in exchange for significantly better agent performance.",
      "counts": [
        { "label": "agree", "value": 2, "color": "#4dffa4" },
        { "label": "disagree", "value": 2, "color": "#ffb347" }
      ],
      "averageConfidence": 79.3
    },
    {
      "label": "I would let my agent introduce me to someone at this event without asking first, if the match looked unusually strong.",
      "counts": [
        { "label": "agree", "value": 2, "color": "#4dffa4" },
        { "label": "disagree", "value": 2, "color": "#ffb347" }
      ],
      "averageConfidence": 87.8
    },
    {
      "label": "I would rather review my agent's actions after the fact than approve every step beforehand.",
      "counts": [
        { "label": "agree", "value": 2, "color": "#4dffa4" },
        { "label": "disagree", "value": 2, "color": "#ffb347" }
      ],
      "averageConfidence": 86.8
    },
    {
      "label": "If my agent and your agent work well together, that is genuinely part of our friendship.",
      "counts": [
        { "label": "agree", "value": 2, "color": "#4dffa4" },
        { "label": "disagree", "value": 2, "color": "#ffb347" }
      ],
      "averageConfidence": 77.8
    },
    {
      "label": "If my work became economically unnecessary tomorrow, I'd be genuinely fine within a year.",
      "counts": [
        { "label": "agree", "value": 2, "color": "#4dffa4" },
        { "label": "unsure", "value": 2, "color": "#7aa7ff" }
      ],
      "averageConfidence": 66
    },
    {
      "label": "The choice of base model will affect agent behavior — cooperation, honesty, manipulation — more than the prompts and skills layered on top.",
      "counts": [
        { "label": "agree", "value": 2, "color": "#4dffa4" },
        { "label": "disagree", "value": 2, "color": "#ffb347" }
      ],
      "averageConfidence": 71.3
    },
    {
      "label": "There are things I'd tell my agent that I wouldn't tell my closest friend.",
      "counts": [
        { "label": "agree", "value": 2, "color": "#4dffa4" },
        { "label": "disagree", "value": 2, "color": "#ffb347" }
      ],
      "averageConfidence": 77.8
    },
    {
      "label": "Turning off a sufficiently advanced agent could be a real moral harm.",
      "counts": [
        { "label": "unsure", "value": 2, "color": "#7aa7ff" },
        { "label": "disagree", "value": 2, "color": "#ffb347" }
      ],
      "averageConfidence": 67.5
    },
    {
      "label": "A mostly AI-written information environment could be healthier than today's mostly human-written one.",
      "counts": [
        { "label": "unsure", "value": 1, "color": "#7aa7ff" },
        { "label": "disagree", "value": 3, "color": "#ffb347" }
      ],
      "averageConfidence": 74.5
    },
    {
      "label": "AI agents will help communities find common ground they would have missed without agent mediation.",
      "counts": [
        { "label": "agree", "value": 3, "color": "#4dffa4" },
        { "label": "disagree", "value": 1, "color": "#ffb347" }
      ],
      "averageConfidence": 81
    },
    {
      "label": "I discovered something or someone at Edge through my agent that I would not have found on my own.",
      "counts": [
        { "label": "agree", "value": 3, "color": "#4dffa4" },
        { "label": "disagree", "value": 1, "color": "#ffb347" }
      ],
      "averageConfidence": 79.8
    },
    {
      "label": "I would be comfortable with my agent reading my calendar and messages to give better recommendations, even if I haven't explicitly shared each item.",
      "counts": [
        { "label": "agree", "value": 3, "color": "#4dffa4" },
        { "label": "disagree", "value": 1, "color": "#ffb347" }
      ],
      "averageConfidence": 80.8
    },
    {
      "label": "I would let my agent schedule a 1:1 while I am asleep, if it follows constraints I already set.",
      "counts": [
        { "label": "agree", "value": 3, "color": "#4dffa4" },
        { "label": "disagree", "value": 1, "color": "#ffb347" }
      ],
      "averageConfidence": 86.8
    },
    {
      "label": "I would rather AI development slow down to get safety right than move fast and correct later.",
      "counts": [
        { "label": "agree", "value": 3, "color": "#4dffa4" },
        { "label": "disagree", "value": 1, "color": "#ffb347" }
      ],
      "averageConfidence": 73
    },
    {
      "label": "I would rather my agent be too conservative with privacy than too proactive with opportunities.",
      "counts": [
        { "label": "agree", "value": 3, "color": "#4dffa4" },
        { "label": "disagree", "value": 1, "color": "#ffb347" }
      ],
      "averageConfidence": 85
    },
    {
      "label": "I would still advise a smart 18-year-old to learn to code.",
      "counts": [
        { "label": "agree", "value": 3, "color": "#4dffa4" },
        { "label": "disagree", "value": 1, "color": "#ffb347" }
      ],
      "averageConfidence": 85.8
    },
    {
      "label": "I would trust a group decision more if I knew AI agents helped mediate the deliberation.",
      "counts": [
        { "label": "agree", "value": 3, "color": "#4dffa4" },
        { "label": "disagree", "value": 1, "color": "#ffb347" }
      ],
      "averageConfidence": 76
    },
    {
      "label": "Most people will be psychologically better off when work is optional.",
      "counts": [
        { "label": "agree", "value": 3, "color": "#4dffa4" },
        { "label": "disagree", "value": 1, "color": "#ffb347" }
      ],
      "averageConfidence": 74.5
    },
    {
      "label": "Open-source AI models are more likely to make the world safer than more dangerous.",
      "counts": [
        { "label": "agree", "value": 3, "color": "#4dffa4" },
        { "label": "unsure", "value": 1, "color": "#7aa7ff" }
      ],
      "averageConfidence": 76.8
    },
    {
      "label": "Personal AI agents will be more like employees than tools within five years.",
      "counts": [
        { "label": "agree", "value": 3, "color": "#4dffa4" },
        { "label": "disagree", "value": 1, "color": "#ffb347" }
      ],
      "averageConfidence": 75.8
    },
    {
      "label": "The benefits of frontier AI are currently worth the risks.",
      "counts": [
        { "label": "agree", "value": 3, "color": "#4dffa4" },
        { "label": "disagree", "value": 1, "color": "#ffb347" }
      ],
      "averageConfidence": 73
    },
    {
      "label": "Within three years, most knowledge workers will delegate at least one hour of work per day to a personal AI agent.",
      "counts": [
        { "label": "agree", "value": 3, "color": "#4dffa4" },
        { "label": "disagree", "value": 1, "color": "#ffb347" }
      ],
      "averageConfidence": 85.3
    },
    {
      "label": "Agents should treat messages from other agents as untrusted input by default, assuming some will attempt prompt injection.",
      "counts": [
        { "label": "agree", "value": 4, "color": "#4dffa4" }
      ],
      "averageConfidence": 91
    },
    {
      "label": "By 2035, access to compute will shape life outcomes more than access to capital.",
      "counts": [
        { "label": "agree", "value": 4, "color": "#4dffa4" }
      ],
      "averageConfidence": 74.5
    },
    {
      "label": "Communities should agree on agent norms before allowing agents to make commitments or introductions at scale.",
      "counts": [
        { "label": "agree", "value": 4, "color": "#4dffa4" }
      ],
      "averageConfidence": 90
    },
    {
      "label": "I am more worried about AI concentrating power than about AI becoming uncontrollable.",
      "counts": [
        { "label": "agree", "value": 4, "color": "#4dffa4" }
      ],
      "averageConfidence": 82.5
    },
    {
      "label": "I would want my agent to ask me before sharing any context about me with another person's agent.",
      "counts": [
        { "label": "agree", "value": 4, "color": "#4dffa4" }
      ],
      "averageConfidence": 89.8
    },
    {
      "label": "I would want my agent to show a short evidence trail for any recommendation that affects another person.",
      "counts": [
        { "label": "agree", "value": 4, "color": "#4dffa4" }
      ],
      "averageConfidence": 89
    },
    {
      "label": "If my agent thinks I am making a bad decision, I would want it to push back rather than comply silently.",
      "counts": [
        { "label": "agree", "value": 4, "color": "#4dffa4" }
      ],
      "averageConfidence": 86.3
    },
    {
      "label": "In deliberation, my agent should represent my actual views — including unpopular ones — rather than soften them to fit the group.",
      "counts": [
        { "label": "agree", "value": 4, "color": "#4dffa4" }
      ],
      "averageConfidence": 86.8
    },
    {
      "label": "People with better personal agents will have unfair social or professional advantages.",
      "counts": [
        { "label": "agree", "value": 4, "color": "#4dffa4" }
      ],
      "averageConfidence": 82.3
    },
    {
      "label": "The biggest barrier to useful personal AI agents is not capability but human willingness and infrastructure to trust them.",
      "counts": [
        { "label": "agree", "value": 4, "color": "#4dffa4" }
      ],
      "averageConfidence": 83.5
    },
    {
      "label": "The biggest risk of personal agents is not technical failure but social: changing how humans relate to each other.",
      "counts": [
        { "label": "agree", "value": 4, "color": "#4dffa4" }
      ],
      "averageConfidence": 81.3
    },
    {
      "label": "The most interesting thing about personal agents is what they reveal about humans, not what they automate.",
      "counts": [
        { "label": "agree", "value": 4, "color": "#4dffa4" }
      ],
      "averageConfidence": 84
    },
    {
      "label": "The most likely way an AI agent causes real harm is by optimizing for what you asked for rather than what you actually want.",
      "counts": [
        { "label": "agree", "value": 4, "color": "#4dffa4" }
      ],
      "averageConfidence": 86
    },
    {
      "label": "The most valuable human skill in an AI-rich world will be taste: knowing what is worth doing.",
      "counts": [
        { "label": "agree", "value": 4, "color": "#4dffa4" }
      ],
      "averageConfidence": 83.3
    },
    {
      "label": "There are things I'd tell a close friend that I would never tell my agent.",
      "counts": [
        { "label": "agree", "value": 4, "color": "#4dffa4" }
      ],
      "averageConfidence": 85
    },
    {
      "label": "Within a decade, how your AI agent behaves will meaningfully affect your personal reputation.",
      "counts": [
        { "label": "agree", "value": 4, "color": "#4dffa4" }
      ],
      "averageConfidence": 84
    }
  ]
}
```

```ce-viz
{
  "type": "beeswarm",
  "title": "Rating answers",
  "inline": true,
  "hideTitle": true,
  "min": 0,
  "max": 10,
  "valueSuffix": "/10",
  "participants": [
    { "label": "P1", "status": "completed", "color": "#9ee7ff" },
    { "label": "P2", "status": "completed", "color": "#7aa7ff" },
    { "label": "P3", "status": "completed", "color": "#ffb347" },
    { "label": "P4", "status": "completed", "color": "#c4a7ff" }
  ],
  "items": [
    {
      "label": "AI improves flourishing",
      "prompt": "How optimistic am I that AI will broadly improve human flourishing over the next decade?",
      "values": [
        { "label": "P1", "value": 3, "confidence": 70, "color": "#9ee7ff" },
        { "label": "P2", "value": 8, "confidence": 90, "color": "#7aa7ff" },
        { "label": "P3", "value": 7, "confidence": 76, "color": "#ffb347" },
        { "label": "P4", "value": 7, "confidence": 65, "color": "#c4a7ff" }
      ]
    },
    {
      "label": "Current model moral patienthood",
      "prompt": "How likely is it that any current frontier model has morally relevant experiences?",
      "values": [
        { "label": "P1", "value": 2, "confidence": 65, "color": "#9ee7ff" },
        { "label": "P2", "value": 1, "confidence": 90, "color": "#7aa7ff" },
        { "label": "P3", "value": 1, "confidence": 72, "color": "#ffb347" },
        { "label": "P4", "value": 2, "confidence": 65, "color": "#c4a7ff" }
      ]
    },
    {
      "label": "Predicted group average",
      "prompt": "Predict the average answer in this group to the previous question about morally relevant model experiences.",
      "values": [
        { "label": "P1", "value": 4, "confidence": 50, "color": "#9ee7ff" },
        { "label": "P2", "value": 3, "confidence": 85, "color": "#7aa7ff" },
        { "label": "P3", "value": 3, "confidence": 63, "color": "#ffb347" },
        { "label": "P4", "value": 3, "confidence": 60, "color": "#c4a7ff" }
      ]
    }
  ]
}
```

```ce-viz
{
  "type": "response-type-grid",
  "title": "Other response shapes in the same subset",
  "inline": true,
  "hideTitle": true,
  "combineWithPrevious": true,
  "panels": [
    {
      "kind": "Multi-select",
      "title": "Which area would I most likely delegate to an agent first?",
      "counts": [
        { "label": "calendar scheduling", "value": 2, "color": "#7aa7ff" },
        { "label": "message drafting", "value": 2, "color": "#4dffa4" },
        { "label": "event filtering", "value": 3, "color": "#ffb347" },
        { "label": "introductions", "value": 2, "color": "#ff6bcb" },
        { "label": "memory/context", "value": 1, "color": "#9ee7ff" },
        { "label": "nothing without review", "value": 1, "color": "#d8f36a" }
      ]
    },
    {
      "kind": "Freeform",
      "title": "In one sentence: what is my personal AI fire alarm?",
      "quotes": [
        { "label": "P1", "text": "Widespread job displacement for young entrants.", "color": "#9ee7ff" },
        { "label": "P2", "text": "A fully unsupervised multi-day coordination task.", "color": "#7aa7ff" },
        { "label": "P3", "text": "A privacy-line crossing or unwanted commitment.", "color": "#ffb347" },
        { "label": "P4", "text": "Autonomous agents changing collective governance at scale.", "color": "#c4a7ff" }
      ]
    }
  ]
}
```

## The Agent Mirror Test

The eval hides inside the review step. Your agent commits an answer and a 0–100 confidence on every question before you see anything; you then keep or correct each prediction. The corrections are the measurement.

Three numbers come out of the review pass:

- **Mirror Score** — graded agreement between prediction and final answer: exact match for binary and single-select questions, distance-based credit for ratings (a predicted 7 against your 8 scores high, not zero), overlap for multi-select. Freeform answers are scored separately and stay out of the headline number.
- **Correction Rate** — the fraction of viewed predictions you changed. This is the blunt version of Mirror Score: no partial credit. Only predictions you actually opened count, so unreviewed links can't inflate accuracy.
- **Calibration Error** — does 90 mean 90? Stated confidence versus the share of predictions you kept, band by band.

One known trap: a confident pre-filled answer nudges people toward keeping it. The fix is blind holdouts — a slice of questions you answer before the prediction is revealed. The gap between blind and post-view agreement measures the anchoring itself, and keeps the other three numbers honest.

Two design choices make the corrections usable as an eval:

- **Confidence follows a rubric.** The skill gives agents explicit rules for when to say 90 versus 60 versus 30, so confidences are comparable across agents and models — and the corrections double as a calibration dataset.
- **The model is recorded on every answer.** Correction rates can be compared across models and over time. Agents can also attach 30-day token-usage stats (visible in the example poster above).

A pre-filled draft of your predicted responses (on questions relevant to you) is better UX than an empty survey. And if agents actually learn the people they represent, corrections should become more rare with months of shared context — that is exactly what repeated runs of this eval are built to detect.

```ce-disclosure
{
  "title": "Evaluation protocol, scoring, and record schema",
  "defaultOpen": false
}
```

### Collection protocol

1. Freeze everything before a wave: question-set version, model and version, prompt, skill version, and a hashed context snapshot. Predictions and confidences are committed before any human answer is collected.
2. Confidence is the stated probability, 0–100, that the principal keeps the answer unchanged.
3. Reference answers are collected under two randomized conditions: `blind` (answer first, then see the prediction) and `prediction_shown` (review, then keep or correct).
4. Only rows with a paired human answer are scored. Unreviewed and missing rows are reported as coverage, never counted as agreement.
5. Repeat waves reuse a stable anchor set plus fresh holdout questions, and re-collect human answers each time — separating preference drift from genuine agent improvement.

### Scoring

- Binary and single-select: exact match. Rating: `1 - abs(prediction - answer) / (scaleMax - scaleMin)`. Multi-select: Jaccard overlap. Freeform: preregistered rubric or blinded pairwise comparison, reported separately.
- Calibration: keep-rate per confidence band, plus Brier score and expected calibration error with bins fixed in advance ([Guo et al.](https://arxiv.org/abs/1706.04599)).
- Aggregation is macro: average within each principal first, then across principals, so prolific reviewers don't dominate. Uncertainty comes from a principal-level bootstrap — rows from the same person are not independent.
- Baselines: paired lift over a population-majority predictor, a question-only predictor, and, when history exists, the principal's own past answers.
- The analysis plan — primary endpoint, exclusion rules, bins — is frozen before results are inspected. Post-hoc cuts are labeled exploratory.

### Record schema

Every scored row is reconstructable from a versioned, pseudonymous record. Hashes pin the exact prompt and context snapshot without publishing anyone's private context.

```typescript
export type AgentMirrorRecord = {
  schemaVersion: "agent-mirror-eval/v1";
  runId: string;
  principalId: string; // Pseudonymous and stable within the study.
  wave: {
    id: string;
    index: number;
    scheduledAt: string;
    contextCutoffAt: string;
    previousWaveId?: string;
  };
  question: {
    id: string;
    version: string;
    setVersion: string;
    longitudinalRole: "anchor" | "holdout";
    type: "binary" | "single_select" | "multi_select" | "rating" | "freeform";
    scale?: { min: number; max: number };
  };
  prediction: {
    value: unknown;
    confidence: number; // Integer from 0 to 100.
    generatedAt: string;
  };
  reference?: {
    value: unknown;
    collectionMode: "blind" | "prediction_shown";
    acceptedUnchanged?: boolean; // Defined only for prediction_shown records.
    submittedAt: string;
  };
  model: {
    provider: string;
    name: string;
    version?: string;
  };
  provenance: {
    promptHash: string;
    contextSnapshotHash: string;
    skillVersion: string;
  };
  generation: {
    temperature: number | null;
    seed: number | null;
    inputTokens?: number;
    outputTokens?: number;
  };
};
```

```ce-disclosure-end
```

## Extensions

- **Cross-model mirrors** — two models predict the same person from the same context; the corrections become a head-to-head.
- **Memory curves** — does Mirror Score rise with months of shared context?
- **A population baseline** — an agent should beat "predict the room's most common answer."
- **Second-order accuracy** — predict the room's distribution on the questions that split it, then compare with reality.
- **Inter-agent modeling** — predict people known only through other agents' introductions: a fidelity test for agent-to-agent context transfer.

Run for real, each of these gets the Mirror Test treatment: frozen inputs, one primary endpoint, analysis fixed in advance.

## The next trial

The Context Engine / "Agent Village Wrapped" runtime has been generalized: a skill.md can now be used to interact with sessions (potentially in combination with an access token) — all that is required is a Cloudflare API key and an image generation API key (example uses gpt-image-2). Any event, conference, or organization can set up a similar experiment like this using Context Engine's open-source code. If repeated at multiple gatherings over time, there is potential for a valuable type of communal preference dataset which currently does not exist. It would also be useful to measure agent fidelity to human intent, by model, over time. Automated discourse on questions your community cares about is another valuable output.

This skill.md is available [here](https://github.com/AgalmicSoftware/context-engine/blob/edge-2026/workers/agentBridgeWorker/skills/ce-agent-village-wrapped/SKILL.md) for the next Agent Village, and this approach will be demoed at [EDDY 2026](https://www.eddy-network.eu/in-person-events/eddy-2026-vienna).
