export const normalizeThemeIdForHtml = (raw, registry) => {
  const themeIds = Array.isArray(registry?.themes) ? registry.themes.map(({ id }) => String(id)) : [];
  const fallback = String(registry?.defaultThemeId || 'context-engine');
  const candidate = String(raw || '')
    .trim()
    .toLowerCase();
  return themeIds.includes(candidate) ? candidate : fallback;
};
