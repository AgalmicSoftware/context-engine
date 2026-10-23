const normalize = (value) => typeof value === 'string' ? value.trim().toLowerCase() : '';
export const registryIdentities = (record) => [record?.sessionSlug, record?.slug, record?.sessionName, record?.name, record?.title].map(normalize).filter(Boolean);

export const registryQuestionMatchesSession = (payload, config) => {
  const explicit = payload.sessionSlugExplicit === false ? '' : normalize(payload.sessionSlug) || normalize(payload.slug);
  const canonical = (slug) => slug === 'general' ? '' : slug;
  if (explicit) return canonical(explicit) === canonical(normalize(config.slug));
  const name = normalize(payload.sessionName);
  return name ? registryIdentities(config).includes(name) : canonical(normalize(config.slug)) === '';
};

// Registry web answers often have no identity at all; scope them by the known question id first.
export const registryResponseMatchesSession = (payload, config) => {
  const allowed = new Set(registryIdentities(config));
  const actual = new Set();
  const collect = (record, depth = 0) => {
    if (!record || typeof record !== 'object' || depth > 8) return;
    for (const field of ['sessionSlug', 'slug', 'sessionName', 'name', 'groupName', 'group']) {
      const value = normalize(record[field]);
      if (value) actual.add(value);
    }
    for (const key of ['metadata', 'meta', 'session', 'sessionMetadata', 'context']) {
      const value = normalize(record[key]);
      if (value) actual.add(value);
      else collect(record[key], depth + 1);
    }
  };
  collect(payload);
  return !actual.size || [...actual].some((value) => allowed.has(value));
};
