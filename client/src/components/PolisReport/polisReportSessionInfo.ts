const retiredRxcInstructions =
  'Answer any you like, skip the rest, or take the short voice interview. Critique is welcome; answering implies no endorsement of the coalition or RadicalxChange.';

export const formatPolisReportSessionInfo = (sessionInfo: unknown, sessionSlug: string): string => {
  const text = typeof sessionInfo === 'string' ? sessionInfo : JSON.stringify(sessionInfo) || '';
  if (sessionSlug !== 'rxc-ra-test' || typeof sessionInfo !== 'string') return text;

  // Older Worker metadata and cached descriptions still contain this retired copy.
  // Apply the display correction only to this session's report description.
  return text.replaceAll(`**${retiredRxcInstructions}**`, '').replaceAll(retiredRxcInstructions, '').trim();
};
