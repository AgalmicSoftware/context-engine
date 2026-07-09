/**
 * Cluster Analysis Prompt (LLM)
 *
 * Requested output:
 *   {
 *     "name": "2–4 words, neutral, non-pejorative label",
 *     "short": "One-sentence, punchy tagline of what unites this cluster.",
 *     "long": "2–4 sentences that summarize the group's distinctive positions using plain language."
 *   }
 *
 * Notes:
 * - Keep names neutral (e.g., "Market Optimists", "Risk-Focused Skeptics").
 * - Avoid jargon, slurs, or political labeling beyond broad, descriptive terms.
 * - Prefer themes expressed by the statements/votes instead of demographics.
 */

/** System instruction for the assistant */
export const CLUSTER_ANALYSIS_SYSTEM_PROMPT =
  'You are an expert survey analyst. You write neutral, helpful summaries of opinion clusters.';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null;

/**
 * Build a user prompt for the model.
 * @param {object} clusterData - { clusterIndex, clusterSize, totalClusters, topStatements: [ {label, questionIndex, prompt, cluster:{agree,disagree,unsure,responded,agreeRate,disagreeRate,unsureRate}, overall:{...}, differenceScore} ] }
 * @param {object} allClustersData - { clusterCount, sizes: { [idx]: size } }
 */
export default function buildClusterAnalysisPrompt(clusterData: unknown, allClustersData: unknown = null): string {
  const safe = (obj: unknown): string => JSON.stringify(obj ?? {}, null, 2);
  const clusterRecord = isRecord(clusterData) ? clusterData : {};
  const allClustersRecord = isRecord(allClustersData) ? allClustersData : {};

  return `
We have grouped participants into ${allClustersRecord.clusterCount ?? 'N'} opinion clusters.
Each cluster represents people whose voting patterns on statements are similar.

You are analyzing cluster #${clusterRecord.clusterIndex ?? '?'} of size ${clusterRecord.clusterSize ?? '?'}.
For this cluster, here are the most representative statements (with per-cluster vs overall agreement):

Top statements (JSON):
${safe(clusterRecord.topStatements)}

All-clusters context (JSON, optional):
${safe(allClustersData)}

TASK:
1) Give this cluster a **brief, neutral NAME** (2–4 words). No slurs or niche jargon.
2) Write a **SHORT** one-sentence tagline about what unites the cluster.
3) Write a **LONG** 2–4 sentence overview explaining what distinguishes them from others (plain language).

STRICT OUTPUT (JSON only, no extra text):
{
  "name": "<2-4 words label>",
  "short": "<single-sentence tagline>",
  "long": "<2-4 sentences>"
}
`.trim();
}
