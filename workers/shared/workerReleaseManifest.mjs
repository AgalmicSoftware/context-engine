const SHA_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const RELEASE_MANIFEST_FILE = 'worker-release-manifest.json';
const ARTIFACT_SET = 'context-engine-worker-bundles';

const toStr = (value) => String(value ?? '').trim();

export const normalizeWorkerBundleSha256 = (value) => {
  const normalized = toStr(value).toLowerCase();
  return SHA256_PATTERN.test(normalized) ? normalized : '';
};

export const deriveWorkerReleaseManifestUrl = (bundleUrl) => {
  try {
    const parsed = new URL(toStr(bundleUrl));
    if (parsed.protocol !== 'https:' || !parsed.pathname.includes('/')) return '';
    parsed.pathname = `${parsed.pathname.slice(0, parsed.pathname.lastIndexOf('/') + 1)}${RELEASE_MANIFEST_FILE}`;
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch (_) {
    return '';
  }
};

export const readWorkerBundleDigestFromManifest = (manifest, { artifactFile, artifactKind }) => {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, error: 'Worker release manifest must be an object.' };
  }
  if (manifest.schemaVersion !== 1 || manifest.artifactSet !== ARTIFACT_SET) {
    return { ok: false, error: 'Worker release manifest schema or artifact set is unsupported.' };
  }
  if (
    !SHA_PATTERN.test(toStr(manifest.source?.commit)) ||
    !SHA_PATTERN.test(toStr(manifest.source?.tree)) ||
    !toStr(manifest.source?.ref).startsWith('refs/heads/') ||
    !SHA_PATTERN.test(toStr(manifest.replay?.privateSourceCommit)) ||
    !SHA_PATTERN.test(toStr(manifest.replay?.publicReplayCommit)) ||
    toStr(manifest.replay?.publicCommit) !== toStr(manifest.source?.commit) ||
    toStr(manifest.replay?.publicTree) !== toStr(manifest.source?.tree) ||
    toStr(manifest.builder?.workflow) !== 'CI' ||
    !/^[1-9][0-9]*$/.test(toStr(manifest.builder?.runId))
  ) {
    return { ok: false, error: 'Worker release manifest provenance is incomplete or inconsistent.' };
  }
  const matches = (Array.isArray(manifest.artifacts) ? manifest.artifacts : []).filter((entry) => (
    toStr(entry?.file) === artifactFile && toStr(entry?.kind) === artifactKind
  ));
  if (matches.length !== 1) {
    return { ok: false, error: `Worker release manifest must contain exactly one ${artifactKind} artifact.` };
  }
  const digest = normalizeWorkerBundleSha256(matches[0]?.sha256);
  if (!digest || !Number.isSafeInteger(matches[0]?.bytes) || matches[0].bytes <= 0) {
    return { ok: false, error: `Worker release manifest has invalid ${artifactKind} digest metadata.` };
  }
  return { ok: true, digest };
};

export const fetchExpectedWorkerBundleDigest = async ({
  manifestUrl,
  artifactFile,
  artifactKind,
  fetchImpl = globalThis.fetch,
}) => {
  const normalizedUrl = deriveWorkerReleaseManifestUrl(manifestUrl);
  if (!normalizedUrl || normalizedUrl !== toStr(manifestUrl)) {
    return { ok: false, error: 'Worker release manifest URL must be an explicit HTTPS manifest asset URL.' };
  }
  try {
    const response = await fetchImpl(normalizedUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      return { ok: false, error: `Failed to fetch Worker release manifest (${response.status}).` };
    }
    const manifest = await response.json();
    return readWorkerBundleDigestFromManifest(manifest, { artifactFile, artifactKind });
  } catch (error) {
    return { ok: false, error: `Failed to read Worker release manifest: ${toStr(error?.message || error)}` };
  }
};

export const __test__workerReleaseManifest = {
  ARTIFACT_SET,
  RELEASE_MANIFEST_FILE,
};
