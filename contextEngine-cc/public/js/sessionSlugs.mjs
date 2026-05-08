export function normalizeSessionSlugList(values = []) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => (value == null ? null : String(value).trim()))
    .filter((slug) => slug !== null);
}

export function collectSelectedSessionSlugs(elements = []) {
  return normalizeSessionSlugList(
    Array.from(elements).map((el) => (
      Object.prototype.hasOwnProperty.call(el?.dataset || {}, 'slug')
        ? el.dataset.slug
        : null
    ))
  );
}

export function normalizeConfiguredSessions(config = {}) {
  const {
    selectedSessions,
    defaultSession = null,
  } = config || {};
  if (Array.isArray(selectedSessions)) {
    const normalizedSelected = normalizeSessionSlugList(selectedSessions);
    if (normalizedSelected.length > 0) {
      return normalizedSelected;
    }
  }
  if (
    config &&
    typeof config === 'object' &&
    Object.prototype.hasOwnProperty.call(config, 'defaultSession') &&
    defaultSession != null
  ) {
    return [String(defaultSession).trim()];
  }
  const fallback = defaultSession == null ? '' : String(defaultSession).trim();
  return fallback ? [fallback] : [];
}

export function normalizeActiveSessions({
  selectedSessions = [],
  currentSession = null,
} = {}) {
  const normalizedSelected = normalizeSessionSlugList(selectedSessions);
  if (Array.isArray(selectedSessions) && normalizedSelected.length > 0) {
    return normalizedSelected;
  }
  if (currentSession == null) return [];
  return [String(currentSession).trim()];
}
