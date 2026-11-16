# Research data in interviews

When your own AI drafts your answers, a session can measure how well it knows
you. The comparison is kept only if **Share for research** is ticked when you
submit.

![How the measure works: your AI drafts your answers from what it already knows about you. Shown drafts you keep or change. If a session hides some drafts, you answer those first, then see its guess. Each answer is compared with the guess: a match scores 1, and close ratings, votes and multiple choices score part. The result is the Mirror Score, how well your AI predicts you.](assets/research-data/how-the-measure-works.svg)

This page is the plain-language summary. The details are in
[agent fidelity](agent-fidelity.md) (how the score is calculated) and
[session interview research metadata](session-interview-research.md) (the
exact record).

## What is kept

With each answer: the AI's guess and how sure it was, which parts you changed,
and for a hidden draft, your answer before you saw the guess.

- Usually, for written answers, only whether you changed the draft. At full
  detail, the drafted text (unless the answer is encrypted) and drafts you
  didn't select too.
- A separate box under **AI submission info** adds the platform, model and
  amount of context your AI reports.

## What is not kept

Your chats with your AI and interview transcripts. Usually, the AI's notes and
drafted text too.

- A session set to full detail also keeps the AI's notes and drafted comments;
  the **?** beside **Share for research** says which applies.
- If a session keeps the AI's drafted text for its admins only, it has its own
  switch, which you can turn off.

## How it is measured

Hidden drafts give the fairest score: you answered before seeing the guess, so
it couldn't sway you.

- Only some sessions hide drafts, and only those your own AI drafted.
- Each person counts once: their average, then the average over people.
- Written answers aren't scored.
- Shown drafts score higher when seeing a guess sways answers; comparing the
  two measures that sway.

This is the Agent Mirror Test from the
[Agent Village Wrapped post](../posts/agent-village-wrapped/agent-village-wrapped.md#the-agent-mirror-test).

## Who sees it

It is stored with your answer, so whoever can read the session's answers can
read it.

- If a session shows AI results, they are group figures, overall and by
  platform, hiding any from fewer people than its minimum (5 unless an admin
  changes it).
- The score you see after submitting is shown only to you.

## How to stop

Untick **Share for research** before you submit: every draft is shown and no
draft comparison is kept.

- Untick **Include platform/model provenance** to leave those out too.
- To withdraw later, submit your answer again with it unticked. Earlier saved
  versions, and copies others already downloaded, aren't erased.
