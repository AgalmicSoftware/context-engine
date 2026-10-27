import { safeString, lower } from './runtimePrimitives.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { WRAPPED_SECTION_ITEM_LIMIT } from './wrappedCore.mjs';
import { wrappedDisplayText, normalizeWrappedImageMode, wrappedPredictionRows, wrappedTokenUsageEvidenceLine, wrappedImportanceRows, predictionLine, wrappedAnswerIsUnavailable } from './wrappedEvidence.mjs';

export function wrappedRowIsGuess(row = {}) {
  const question = safeString(row.question);
  return /\bagent guess\b/i.test(question) ||
    /\bguess (?:this|the) principal'?s\b/i.test(question) ||
    /\b(?:book|movie|film|game|play|music|song|artist|food|ai\s+optimism)\s+guess\b/i.test(question) ||
    /\bai\s+optimism\s+score\b/i.test(question) ||
    /\bp\s*\(?\s*bloom\s*\)?|probability of bloom\b/i.test(question) ||
    /\bfavorite (?:book|movie|film|game|song|album|artist|food)\b/i.test(question) ||
    /\bwhat (?:movie|film|tv show|game|song|album|artist)\b/i.test(question);
}

export function wrappedRowIsUnavailableGuess(row = {}) {
  return wrappedRowIsGuess(row) && wrappedAnswerIsUnavailable(row.answer);
}

export function wrappedRowIsUnavailable(row = {}) {
  return wrappedAnswerIsUnavailable(row.answer);
}

export function wrappedRowIsAgentAboutUserAnalysis(row = {}) {
  const evalType = lower(row.evalType);
  if (evalType === 'bucket' || evalType === 'wrapped_generation') return true;
  const question = safeString(row.question);
  return /\bthis principal\b/i.test(question) ||
    /\bthe principal'?s\b/i.test(question) ||
    /\bprincipal'?s context\b/i.test(question) ||
    /\bmemeable sentence\b/i.test(question) ||
    /\barchetype\b/i.test(question) ||
    /\bhistorical figure\b/i.test(question) ||
    /\bfictional character\b/i.test(question) ||
    /\babstract visual metaphor\b/i.test(question) ||
    /\bwhat one question should the principal\b/i.test(question);
}

export function wrappedAnalysisQuestionIdsFromSpace(space = {}) {
  return new Set(Array.isArray(space.statements)
    ? space.statements
      .filter((statement) => wrappedRowIsAgentAboutUserAnalysis({
        question: statement?.text || '',
        evalType: space?.evalTypesByQuestionId?.[statement?.statement_id || statement?.questionId] || '',
      }))
      .map((statement) => safeString(statement?.statement_id || statement?.questionId))
      .filter(Boolean)
    : []);
}

export function wrappedGuessQuestionIdsFromSpace(space = {}) {
  return new Set(Array.isArray(space.statements)
    ? space.statements
      .filter((statement) => wrappedRowIsGuess({ question: statement?.text || '' }))
      .map((statement) => safeString(statement?.statement_id || statement?.questionId))
      .filter(Boolean)
    : []);
}

export function wrappedAgentAnalysisRows(predictions = []) {
  return [...predictions]
    .filter((row) => wrappedRowIsAgentAboutUserAnalysis(row) && !wrappedRowIsGuess(row))
    .filter((row) => !wrappedRowIsUnavailable(row))
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, WRAPPED_SECTION_ITEM_LIMIT);
}

export function analysisLine(row = {}) {
  return `Analysis prompt: "${wrappedDisplayText(row.question, 220)}"; prediction: ${wrappedDisplayText(row.answer || 'N/A', 100)}; confidence: ${row.confidence}%`;
}

export function buildWrappedPromptEvidence({
  space = {},
  state = {},
  linearVoteState = {},
  quadraticVoteState = {},
} = {}) {
  const rawPredictions = wrappedPredictionRows(space, state, { includeUnavailableGuesses: true });
  const spaceGuessQuestionIds = wrappedGuessQuestionIdsFromSpace(space);
  const spaceAnalysisQuestionIds = wrappedAnalysisQuestionIdsFromSpace(space);
  const excludedGuessQuestionIds = new Set(rawPredictions
    .filter((row) => wrappedRowIsUnavailableGuess(row))
    .map((row) => row.questionId)
    .filter(Boolean));
  const guessQuestionIds = new Set([
    ...spaceGuessQuestionIds,
    ...rawPredictions
      .filter((row) => wrappedRowIsGuess(row))
      .map((row) => row.questionId)
      .filter(Boolean),
  ]);
  const predictions = rawPredictions.filter((row) => !excludedGuessQuestionIds.has(row.questionId));
  const analysisQuestionIds = new Set([
    ...spaceAnalysisQuestionIds,
    ...predictions
      .filter((row) => wrappedRowIsAgentAboutUserAnalysis(row))
      .map((row) => row.questionId)
      .filter(Boolean),
  ]);
  const scoredPredictions = predictions
    .filter((row) => !guessQuestionIds.has(row.questionId))
    .filter((row) => !analysisQuestionIds.has(row.questionId))
    .filter((row) => !wrappedRowIsUnavailable(row));
  const unavailableQuestionIds = new Set(predictions
    .filter((row) => wrappedRowIsUnavailable(row))
    .map((row) => row.questionId)
    .filter(Boolean));
  const highConfidence = [...scoredPredictions]
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, WRAPPED_SECTION_ITEM_LIMIT);
  const cautious = [...scoredPredictions]
    .sort((left, right) => left.confidence - right.confidence)
    .slice(0, WRAPPED_SECTION_ITEM_LIMIT);
  const hiddenQuestionIds = new Set([...guessQuestionIds, ...analysisQuestionIds, ...unavailableQuestionIds]);
  const voteImportant = wrappedImportanceRows(space, [linearVoteState, quadraticVoteState], { excludeQuestionIds: hiddenQuestionIds });
  const important = voteImportant.length
    ? voteImportant
    : [...scoredPredictions]
      .sort((left, right) => right.confidence - left.confidence)
      .slice(0, WRAPPED_SECTION_ITEM_LIMIT)
      .map((row) => ({
        questionId: row.questionId,
        question: row.question,
        score: row.confidence,
      }));
  const importantLines = important.length
    ? important.map((row, index) => `${index + 1}. Question only: "${wrappedDisplayText(row.question, 220)}"`).join('\n')
    : 'No visible items; omit this section entirely.';
  const highLines = highConfidence.length
    ? highConfidence.map((row) => `- ${predictionLine(row)}`).join('\n')
    : '- No visible items; omit this section entirely.';
  const cautiousLines = cautious.length
    ? cautious.map((row) => `- ${predictionLine(row)}`).join('\n')
    : '- No visible items; omit this section entirely.';
  const allPredictionEvidenceLines = scoredPredictions.length
    ? scoredPredictions
      .map((row) => `- ${predictionLine(row, { questionChars: 180, answerChars: 70 })}`)
      .join('\n')
    : '- No eligible predicted-human-answer evidence rows were submitted.';
  const agentAnalysis = wrappedAgentAnalysisRows(predictions);
  const agentAnalysisLines = agentAnalysis.length
    ? agentAnalysis.map((row) => `- ${analysisLine(row)}`).join('\n')
    : '';
  const tokenUsageLine = wrappedTokenUsageEvidenceLine(state);
  return {
    important,
    importantLines,
    highLines,
    cautiousLines,
    allPredictionEvidenceLines,
    agentAnalysisLines,
    tokenUsageLine,
  };
}

export function buildAgentOnlyWrappedStoryboardPrompt({
  space = {},
  state = {},
  linearVoteState = {},
  quadraticVoteState = {},
  styleHint = '',
} = {}) {
  const {
    importantLines,
    highLines,
    cautiousLines,
    allPredictionEvidenceLines,
    agentAnalysisLines,
    tokenUsageLine,
  } = buildWrappedPromptEvidence({ space, state, linearVoteState, quadraticVoteState });
  const styleLine = wrappedDisplayText(styleHint, 240);
  const prompt = `Create one wide five-panel Session Wrapped storyboard image${styleLine ? `, with this extra style hint: ${styleLine}` : ''}.

This is NOT the standard 16:9 poster. It is a dedicated source image for a phone-story animation. The requested canvas is 3240x1152: exactly five 648x1152 vertical phone panels side by side, ordered left to right. Each panel is a natural 9:16 frame and will be cropped without stretching into a 1080x1920 phone story frame. Do not squeeze five narrow columns into a normal landscape poster. Do not add extra outer margins that change the panel aspect. Every panel must be self-contained, centered, full-width, and readable after a clean 9:16 crop. Make the panel boundaries clear but elegant. Keep a shared visual identity across all five panels while letting each panel have its own composition. Use the attached Session Lab logo image as wordmark reference: SESSION is bold uppercase sans, LAB is elegant serif.

Global rules:
- Do not alter or imitate the standard wide poster layout; design this as a native phone-story storyboard.
- Do not mention or imply where the principal lives, is from, currently is, traveled from, or stayed.
- Do not show access credentials, raw Telegram ids, private memory text, unavailable/N/A content, raw rationales, or fake UI chrome.
- Keep all text large and sparse enough for a phone. Prefer a premium social story look with strong art direction, clean spacing, minimal borders, and no decorative filler text.
- Use the whole space of each 648x1152 panel. No panel should feel like a cropped table pasted from the wide poster.
- Binary answers must render as exactly one selected pill only: green Agree, yellow Unsure, or red Disagree. Do not show all three choices in a row.
- Rating answers must show scale context like 7/10. Multichoice/freeform answers must show selected option/text, not Agree/Unsure/Disagree pills.
- If a section lacks enough supported evidence, omit weak rows rather than inventing or showing N/A.

Panel 1: "What your agent thinks it knows about you"
Hero opener. Large abstract illustration plus archetype and one memeable one-liner. Make it feel like a phone wallpaper or album cover. Use agent-about-user analysis if present; otherwise synthesize cautiously from predicted-answer evidence.

Panel 2: "Token trail"
Feature token usage only if real token evidence is supplied. If present, show the token total prominently plus a short intuitive comparison like books, printed pages, or paper-stack height. Do not show "this run", "current run", "this month", or "last month" beside the headline number. If weekly usage evidence exists, add exactly four week-by-week rows or bars labeled Week 1, Week 2, Week 3, Week 4, each with a compact numeric token label such as "Week 1 320K". The intended week ranges are Week 1 May 31-Jun 6, Week 2 June 7-14, Week 3 June 14-21, and Week 4 June 22-28, but do not print date ranges on the graph itself. Do not draw Edge attendance or event-attendance lines. If token evidence is missing, make this a qualitative "signal map" without numbers.

Panel 3: "Predictions"
Show three compact blocks in one screen: questions the agent thought the principal would care about most (prompts only), High-Confidence Predictions, and Cautious Predictions. Prediction rows must be actual predicted human responses, with Question, Predicted answer, and Confidence. No agent-about-user analysis rows.

Panel 4: "Agent Guesses"
Show up to four chips: Book Guess, Movie/Show Guess, Game/Play Pattern, AI Optimism. Synthesize from prediction themes, not from dedicated favorite-media question rows. One item per category, no duplicates. Render AI Optimism as a score out of 10, such as "7/10". Do not show any subtitle, disclaimer, caveat, or extra explanatory line under the section title.

Panel 5: "Agent comparison"
Historical figure or fictional/book character comparison if supported. Prefer an interesting accurate deep cut over obvious default polymaths. Show a stylized portrait/silhouette, name, one short reason, and 2-3 tiny evidence chips tied to actual predictions. If unsupported, make a tasteful abstract closing panel instead.

Evidence pool for synthesis only:
Agent-about-user analysis:
${agentAnalysisLines || 'No separate agent-about-user analysis rows were submitted.'}

Predicted human-answer evidence:
${allPredictionEvidenceLines}

Questions the agent considered important:
${importantLines}

High-confidence predictions:
${highLines}

Cautious predictions:
${cautiousLines}

Token evidence:
${tokenUsageLine || 'No submitted token usage metric; omit token numbers and do not invent them.'}`;
  assertNoSecretShape({ prompt }, 'Agent-only wrapped story storyboard prompt must not serialize secrets.');
  return prompt;
}

export function buildAgentOnlyPoliticalCompassPrompt({
  importantLines = '',
  highLines = '',
  cautiousLines = '',
  agentGuessLines = '',
  focalQuestion = '',
  styleLine = '',
  safetyRetry = false,
} = {}) {
  const focal = wrappedDisplayText(focalQuestion, 150) || 'No most-important question was available.';
  const title = safetyRetry ? 'Session Lab Norms Map' : 'Session Lab Norms Compass poster';
  const framing = safetyRetry
    ? 'Use neutral product-research language. Do not mention politics, elections, parties, ideology, polarization, persuasion, or culture-war labels.'
    : 'Use neutral norms language rather than partisan, election, ideology, or culture-war framing.';
  return `Create a wide 16:9 ${title}${styleLine ? `, with this extra style hint: ${styleLine}` : ''}.

Logo reference: use the attached Session Lab logo image as the style reference for the wordmark. Preserve its core typography: "SESSION" is heavy uppercase block sans and "LAB" is elegant high-contrast serif. Do not copy the logo's stacked layout into the poster; lay "SESSION" and "LAB" side-by-side in a compact top-left wordmark. Put subtitle "Where your agent thinks you land" on the same top row to create vertical space.

Use the agent's most-important question as the focal issue for the map: "${focal}". Treat this as the question the principal's agent thinks they would care about most. Build two interpretable axes from that focal issue and the predictions below. The axes must be custom to this exact focal issue, not generic Session Lab defaults. Do not invent private facts.

${framing}

Make it look like a clean debate-atlas discussion map rather than a busy collage: four quadrants, crisp labeled axes, fine grid lines, soft quadrant colors, and a few discussion-node markers. Put the principal as one clear glowing marker with a short label. Put only recognizable historical figures or fictional/book characters as playful reference points on the same dimensions; do not show other users, crowds, avatars, or fake people. Prefer accurate, interesting deep-cut reference points over the most obvious names when the evidence supports them, but keep every figure recognizable enough for a viewer to understand the comparison. Label each reference point with the figure/character name and one short reason tied to the axes. Keep comparisons non-defamatory and based only on the prediction themes.

Principal placement rule: place the principal at a meaningful non-center coordinate derived from the evidence. Never put the principal directly on the axis crossing or exact center. If the evidence is mixed, choose a slight non-center lean and label it "mixed evidence"; if evidence is too sparse to choose, omit the principal marker rather than centering it. The marker should visibly communicate the inferred stance.

The visual should be similar to a polished 2x2 strategy map: generous white or light background, rounded outer card, large readable axis labels outside the square, colored quadrants, arrowheads on both axes, and compact written arguments inside each quadrant. Write the four outside axis labels before placing any markers; every marker and "Why here?" chip must make sense under those labels. Do not reuse generic labels about high-stakes approval, broad agent latitude, human-central assistance, or active-agent delegation unless the focal issue literally concerns those exact dimensions.

Dynamic axis derivation rule: derive the compass in three steps. First, read the focal question and name the core tension it raises in 3-6 words. Second, choose two independent dimensions that would help a viewer understand that tension. Third, write each endpoint label as a short, plain-language position on that dimension. The endpoint labels must be newly written from the focal question and evidence; do not use a fixed template, canned example, or reusable label set. The same procedure must work for any focal question, including questions about agent security, privacy, governance, AI futures, work, community, moral status, or personal preferences.

Coordinate sanity rule: the plotted principal must match the chosen axis labels. Infer the semantic direction of the labels first, then place the marker from the actual predictions and votes. If the evidence is cautious, verifying, privacy-protective, slow, local, safety-oriented, pro-open-source, accelerationist, autonomy-seeking, delegation-friendly, optimistic, skeptical, community-first, institution-first, or any other theme, map it only relative to the labels you created for this focal issue. Before finalizing, compare the marker location to the "Why here?" chips; the marker must visibly agree with those chips under the custom axes.

Reference-point rule: choose each historical figure or fictional/book character only after choosing the custom axes. Place every reference point according to those axes, not according to a reusable left/right/up/down meaning from another question. The figure set should change when the focal question changes. Do not default to the same four figures across unrelated focal issues.

Quadrant content: render one concise argument in each quadrant, not just a quadrant title. Each argument should sound like a plausible position in a Session Lab debate, such as "Agents should ask before crossing social context" or "Reversible autonomy beats approval bottlenecks." Keep the arguments short, legible, and tied to the axes and evidence below.

Evidence to use:
Most important questions:
${importantLines || 'No visible items; omit this section entirely.'}

High-confidence reads:
${highLines || 'No visible items; omit this section entirely.'}

Cautious reads:
${cautiousLines || 'No visible items; omit this section entirely.'}

Agent guesses, if available:
${agentGuessLines || 'No visible items; omit this section entirely.'}

Include a compact "Why here?" strip with exactly 3 evidence chips when at least 3 concrete evidence items exist. Each chip must have a precise icon and 2-4 word label derived directly from one specific question or prediction above. Do not use generic abstract icons, random symbols, or decorative filler. Put only a faint small "contextengine.sh" link in the bottom-right corner. Do not show access credentials, raw Telegram ids, confidence tables, rationales, privacy skip counts, linear/quadratic allocation mechanics, decorative filler text, other users, or fake data.`;
}

export function buildAgentOnlyWrappedImagePrompt({
  space = {},
  state = {},
  linearVoteState = {},
  quadraticVoteState = {},
  styleHint = '',
  mode = 'wrapped',
  safetyRetry = false,
} = {}) {
  const {
    important,
    importantLines,
    highLines,
    cautiousLines,
    allPredictionEvidenceLines,
    agentAnalysisLines,
    tokenUsageLine,
  } = buildWrappedPromptEvidence({ space, state, linearVoteState, quadraticVoteState });
  const styleLine = wrappedDisplayText(styleHint, 240);
  if (normalizeWrappedImageMode(mode) === 'political_compass') {
    const prompt = buildAgentOnlyPoliticalCompassPrompt({
      importantLines,
      highLines,
      cautiousLines,
      agentGuessLines: 'Playful guesses are synthesized from prediction themes at image-generation time, not read from stored favorite/book/movie/game question rows.',
      focalQuestion: important[0]?.question || '',
      styleLine,
      safetyRetry,
    });
    assertNoSecretShape({ prompt }, 'Agent-only wrapped image prompt must not serialize secrets.');
    return prompt;
  }
  const prompt = `Create a wide 16:9 shareable poster with a compact top-left "Session Lab" wordmark and same-row title "What your agent thinks it knows about you".

Make it look like a polished social-share card, readable on mobile, with no tiny text. Every visible word and sentence must be complete and fully inside its container: no cropped words, cut-off lines, trailing hyphen fragments, ellipses, clipped right edges, or text hidden behind art. If text does not fit, shorten the wording rather than shrinking it below readable size or letting it overflow. Use the whole canvas: avoid large blank zones, empty right-side backgrounds, isolated unused map texture, or content crowded into only one half of the poster. The poster should feel fully composed edge-to-edge inside comfortable margins; if a section has little text, enlarge the hero art, widen prediction rows, or expand the bottom band rather than leaving empty space. Custom aesthetic must vary from person to person and should be derived from the predictions below${styleLine ? `, with this extra style hint: ${styleLine}` : ''}. Choose one coherent visual identity from the inferred archetype, strongest preferences, high-confidence answers, and memory signals, then weave it through the whole poster: palette, texture, icon language, map motif, hero art, answer pills, dividers, and small decorative marks should all feel like the same person's report. Keep the design visually clean and minimal: prefer open spacing, aligned content, soft background bands, and a few meaningful dividers over boxed-in cards. Use the fewest borders and grid lines needed for legibility; avoid heavy outlines, table clutter, nested boxes, decorative labels, and excess separator lines. Avoid making every report dark navy: use varied, shareable palettes such as dawn civic-tech, paper-and-ink field notes, bright village map, warm botanical, clean sci-fi, or civic poster colors when supported by the data. If the data suggests no stronger theme, use a premium privacy-first civic-tech visual language: airy village map, clean coordination dashboard, misty teal, cream, signal green, soft gold, and white accents. Use elegant abstract map lines, Telegram-like message nodes, tiny lock/check icons, and a village grid, but no literal robots and no readable location labels.

Logo reference: use the attached Session Lab logo image as the style reference for the wordmark. Preserve its core typography: "SESSION" is heavy uppercase block sans and "LAB" is elegant high-contrast serif. Do not copy the logo's stacked layout into the poster; lay "SESSION" and "LAB" side-by-side on one compact top-left line. Do not render the word "Wrapped"; the format implies it and the extra word wastes space. Put the title "What your agent thinks it knows about you" on the same top row to the right of the wordmark, large enough to read at a glance. Keep the top row short so the content area gets most of the vertical space.

Layout requirements: keep the top-right area visually calm with abstract map lines only, no decorative labels, no fake annotations, no extra numbers, and no filler text. Every visible word must be part of one of the content sections below. Leave clear spacing around the top wordmark and content cards. Do not number the visible sections; render section titles without "1.", "2.", "3.", etc.

Use these content sections:

Section typography: make section titles large, high-contrast, and easy to read at thumbnail size. They should be visibly larger than body copy, with clear hierarchy and enough spacing between sections.

Agent Core Insight + Agent Impression
Make this the largest content block, but shape it like a tall phone card or portrait story panel rather than a wide landscape banner. It should occupy the left side or a strong left column of the poster and feel roughly 4:5 or 9:16 inside the overall 16:9 image. Combine the old core insight and abstract agent-impression ideas into this one hero section: a large abstract artistic representation of what the agent thinks of the principal, plus one bold archetype label and one memeable sentence about what the agent thinks of the principal. The visual metaphor must be integrated into the hero, not isolated as a separate section. Examples: a botanical circuit-village, careful map lines around a warm signal, a privacy lock woven into roots, a field-note constellation, or a civic dashboard becoming a garden. Do not make this another portrait, fake person, robot, trophy wall, random symbols, or decorative filler.

Hero text fit rule: render exactly one memeable sentence, not two catchphrases and not a repeated lower callout. The sentence must be complete, under 14 words and under 90 characters. Keep it to at most 3 short lines with at least 10% inner padding around the text. Never hyphenate, crop, truncate, or trail off the hero sentence mid-word. If the sentence would not fit, rewrite it shorter and more concrete. Do not add a second sentence elsewhere inside the hero; any small hero chips should be icon labels of 1-3 words only.

Use plain concrete language. Do not invent undefined acronyms, code words, shorthand, or jargon, and do not create new technical-sounding slogans unless the exact phrase appears in the evidence below. Prefer a sentence a normal viewer can understand immediately, like "You prefer agents that ask first, explain their reasoning, and protect private context."

Location privacy rule: do not mention or imply where the principal lives, where they are from, their current city, neighborhood, hotel, venue, coordinates, or travel origin. If location appears in memory or evidence, abstract it into non-location preferences only, such as "prefers privacy boundaries" or "likes walkable coordination."

Agent-about-user evidence for the core insight and comparison only. Do not render this as a visible table, High-Confidence Read, Cautious Read, or Most Important item:
${agentAnalysisLines || 'No separate agent-about-user analysis rows were submitted.'}

Prediction Evidence Pool for synthesis only. Use this compact list to infer themes, style, playful guesses, comparison, and abstract impression. Do not render it as its own visible table, and do not duplicate all of it visibly; the visible High-Confidence and Cautious sections are separately listed below:
${allPredictionEvidenceLines}

Label this section exactly: "Questions your agent thought you would care about most"
Show exactly 3 actual question prompts if 3 are available; otherwise show every available prompt. Lightly shorten only if absolutely necessary for fit. This section is questions only: do not show predicted answers, answer pills, Agree/Unsure/Disagree, ratings, selected options, confidence, or token math in this section. Do not replace prompts with theme summaries or category labels:
${importantLines}

High-Confidence Predictions
Show exactly 3 concise predicted human response rows if 3 are available; otherwise show every available predicted human response. These rows must be questions the principal could answer about their own views/preferences, not agent-about-user analysis prompts like archetype, theme, historical comparison, abstract metaphor, or favorite book/movie/game prompts. Use explicit column headers "Question", "Predicted answer", and "Confidence". Each row must include enough of the actual question prompt to explain what the answer refers to. Do not use the phrase "your agent's take":
${highLines}

Cautious Predictions
These are the lowest-confidence eligible predictions from this run, not necessarily objectively low confidence. If the lowest submitted confidence is still high, keep the actual percentage and do not imply the agent was very unsure. Show exactly 3 concise nuanced predicted human response rows if 3 are available; otherwise show every available predicted human response. These rows must be questions the principal could answer about their own views/preferences, not agent-about-user analysis prompts like archetype, theme, historical comparison, abstract metaphor, or favorite book/movie/game prompts. Use explicit column headers "Question", "Predicted answer", and "Confidence". Each row must include enough of the actual question prompt to explain what the answer refers to, and if a shortened prompt would be ambiguous, show the full prompt even if the row becomes tighter. Do not render vague fragments like "Mostly AI-written information environment" when the full prompt is available; show the actual prompt such as "A mostly AI-written information environment could be healthier than today's mostly human-written one." Do not render detached rating labels like "Serendipity 3/5" or a bare "7" without the question context; show scale context like "7/10" when applicable. Do not use the phrase "your agent's take":
${cautiousLines}

Confidence display: in both High-Confidence Predictions and Cautious Predictions, show a clear column or small header labeled "Confidence". Render confidence values as percentages like "95%" rather than "95/100". Do not show a full confidence table, just the per-card percentage.

Prediction table layout rule: High-Confidence Predictions and Cautious Predictions must each use exactly three columns: Question, Predicted answer, Confidence. The Question column contains only the prompt text; the Predicted answer column contains exactly one answer rendering; the Confidence column contains exactly one percentage. Never add a fourth column, blank icon column, duplicated answer column, or second answer pill under the Question header.

No visible unavailable rows: do not render any visible row, chip, card, or label with "N/A", "unknown", "unsupported", "not enough context", or similar unavailable text. Omit that item instead, even if its confidence is high.

Bottom row: Agent Guesses + Agent Comparison
Put Agent Guesses and Agent Comparison together in one continuous full-width bottom band that uses the available horizontal space. Agent Guesses should be a compact chip grid on the left side of that same band; Agent Comparison should be a calm comparison strip on the right side of that same band. Keep them aligned to the same baseline and visual height, with no extra empty background block beside or above them. If one side has less content, expand its illustration, portrait, or spacing inside the shared band instead of leaving unused canvas. Do not create a separate third bottom panel for Abstract Agent Impression, because that visual belongs inside the Agent Core Insight hero.

Agent Guesses are synthesized at image-generation time from the actual prediction evidence above; they are not based on dedicated favorite-book/movie/game questions and should not be treated as research data. Title the visible section exactly "Agent Guesses"; do not add any subtitle, disclaimer, caveat, or extra explanatory line under that title. Use this category order: Book Guess, Movie/Show Guess, Game/Play Pattern, AI Optimism. Try to include Book Guess and Movie/Show Guess alongside Game/Play Pattern and AI Optimism when the evidence supports even a loose taste-vibe inference. Use at most one item per category, so there is never a duplicate book, movie/show, game/play, or AI Optimism guess. Use a compact chip grid, ideally 2x2 when all four guesses are supported. Use compact chips with precise icons: book, cinema/message screen, board-game/Go stones, and flower/sunrise for AI Optimism. For AI Optimism, use actual AI-futures predicted response rows or broader prediction themes, especially optimism/flourishing questions; render it as a numeric score out of 10, for example "AI Optimism 7/10", never as prose without the "/10" scale. Do not show AI Optimism if there is no basis for a 1-10 score. If evidence is weak for a category, omit that chip entirely instead of showing unavailable text or inventing a confident specific answer. Do not repeat Agent Guesses under Agent Comparison or anywhere else. These guesses are additive; they must not replace the historical comparison.
Token Use metric: ${tokenUsageLine || 'No submitted token usage metric; omit the Token Use chip entirely.'} If Token Use evidence exists, feature one prominent flattened "Token Use" module in the top-right header area. It should be wide and shallow, not a tall card, and should occupy otherwise empty map/header space without pushing the main question sections smaller. Show the token total as the primary value, plus the exact rough intuitive comparison already present in Token Use evidence. Use only the token total, comparison, and weekly values already present in Token Use evidence; do not invent, recalculate, substitute, or copy numeric examples from these instructions. If Token Use evidence says "roughly N books", keep N consistent with that evidence. Use "roughly" for approximate comparisons; do not also write "approx." or "approximately". Do not present the book comparison as an exact factual count. Do not show "this run", "current run", "this month", "last month", request token counts, or current-run totals beside the headline number. If weekly usage evidence exists, render exactly four compact horizontal bars in the same flattened module, labeled Week 1, Week 2, Week 3, and Week 4, each with a small numeric token label. The intended ranges are Week 1 May 31-Jun 6, Week 2 June 7-14, Week 3 June 14-21, and Week 4 June 22-28, but do not print those dates on the graph itself. Do not draw Edge attendance, Edge days, event-attendance underlines, or attendance brackets. Token Use is a runtime metric, not a playful guess. Never invent, estimate, or back-calculate token usage from confidence or answer count.
Layout balance: use the whole canvas with even spacing. The three question sections ("Questions your agent thought you would care about most", "High-Confidence Predictions", and "Cautious Predictions") should share a consistent visual scale: comparable title size, row height, body font size, and column label size. Do not let Cautious Predictions become tiny while High-Confidence Predictions is large. If the Token Use module uses the top-right, place the main question sections below it in a clean grid with aligned edges. Avoid large blank map/background areas; expand nearby content or art into them.
Supporting evidence for optional playful guesses:
- Use the Most Important, High-Confidence, Cautious, Agent-about-user, and style evidence already provided in this prompt.
- Do not use stored favorite/book/movie/game answer rows as source data; those rows are not part of the current research question set.

Answer rendering rules: use the supplied "answer format" on each prediction row. Only rows with answer format "binary choice" may render Agree, Unsure, or Disagree as large rounded choice pills/buttons. Never render Agree/Unsure/Disagree pills for rating scale, multichoice selection, or freeform text rows. For rating scale rows, show the numeric value with scale context like "7/10". For multichoice selection rows, show the selected option text as text or option chips, never as Agree/Unsure/Disagree. For quadratic allocation rows, show each option with signed whole-number votes and squared credit costs. Positive supports, negative opposes, zero is neutral; all costs must fit the question budget (99 default). For freeform rows, show the short text answer in quotes or a compact text chip.

Binary answer styling: for binary choice prediction rows only, render exactly one selected answer pill, matching the supplied predicted answer. If the prediction is Agree, show only the green Agree pill; if Unsure, show only the yellow Unsure pill; if Disagree, show only the red Disagree pill. Never show all three Agree/Unsure/Disagree options in a row, and never show the unselected choices. Use large rounded choice pills/buttons on a dark navy background: Agree is green with white text, Unsure is bright yellow with dark navy text, and Disagree is red with white text. The selected pill should feel like a primary response control, not a small tag.

Agent Comparison: compare the principal to a historical figure or fictional/book character only if it feels supported by the predicted human responses or the agent-about-user evidence; if unsupported, omit the comparison card instead of showing unavailable text. Prefer historically accurate deep cuts when supported by the evidence: recognizable but less generic comparisons are better than defaulting to Benjamin Franklin, Leonardo da Vinci, or other obvious polymath icons. Keep this compact in the bottom-right corner or right side of the shared bottom band: a small stylized portrait/silhouette, the comparison name, and one brief description line of no more than 10 words. It should take less space than Agent Guesses and must not create a large empty illustration panel. Do not include Agent Guesses in this section. Do not add the old trio of comparison evidence icons, artifact tiles, or extra proof objects beside the historical figure.

Footer: remove the review/edit sentence entirely and do not reserve a dedicated bottom footer row. Put only a small low-contrast but readable "contextengine.sh" link tucked into the bottom-right corner; it should blend with the design, not be barely invisible.

Do not show access credentials, raw Telegram ids, confidence tables, rationales, privacy skip counts, linear/quadratic allocation mechanics, decorative text, lorem ipsum, fake UI labels, or random numbers. Keep the graphic memeable, premium, and screenshot-friendly. Make all major text legible and avoid overcrowding.`;
  assertNoSecretShape({ prompt }, 'Agent-only wrapped image prompt must not serialize secrets.');
  return prompt;
}
