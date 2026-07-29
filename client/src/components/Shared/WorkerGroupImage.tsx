import React, { useEffect, useMemo, useState } from 'react';
import { usesPublicReadCloudflareStorage } from '../../utilities/storage/sessionStorageConfig';
import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext';
import { fetchWorkerWithAuth } from '../../utilities/worker/workerAuth';
import { normalizeWorkerUrl } from '../../utilities/worker/workerUrl';

type WorkerGroupImageProps = {
  alt?: string;
  className?: string;
  context?: unknown;
  fetchImpl?: typeof fetch;
  sessionConfig?: unknown;
  sessionSlug?: unknown;
  src: unknown;
  testId?: string;
  workerToken?: unknown;
  workerUrl?: unknown;
};

const toText = (value: unknown): string => String(value ?? '').trim();

const resolveProtectedWorkerImage = ({
  sessionConfig,
  src,
  workerUrl,
}: Pick<WorkerGroupImageProps, 'sessionConfig' | 'src' | 'workerUrl'>): boolean => {
  const source = toText(src);
  const baseUrl = normalizeWorkerUrl(workerUrl);
  if (!source || !baseUrl || usesPublicReadCloudflareStorage(sessionConfig, { resource: 'images' })) return false;
  try {
    const sourceUrl = new URL(source);
    return sourceUrl.origin === new URL(baseUrl).origin && sourceUrl.pathname === '/storage/read';
  } catch {
    return false;
  }
};

const WorkerGroupImage = ({
  alt = '',
  className,
  context = null,
  fetchImpl = fetch,
  sessionConfig = null,
  sessionSlug = '',
  src,
  testId,
  workerToken = '',
  workerUrl = '',
}: WorkerGroupImageProps) => {
  const source = toText(src);
  const normalizedWorkerUrl = normalizeWorkerUrl(workerUrl);
  const normalizedSessionSlug = canonicalizeSessionSlug(sessionSlug);
  const protectedWorkerImage = resolveProtectedWorkerImage({
    sessionConfig,
    src: source,
    workerUrl: normalizedWorkerUrl,
  });
  const [resolvedSrc, setResolvedSrc] = useState(protectedWorkerImage ? '' : source);
  const contextKey = useMemo(() => {
    const record =
      context && typeof context === 'object' && !Array.isArray(context) ? (context as Record<string, unknown>) : {};
    return `${toText(record.account).toLowerCase()}\n${toText(record.chainId)}`;
  }, [context]);

  useEffect(() => {
    if (!source || !protectedWorkerImage) {
      setResolvedSrc(source);
      return undefined;
    }

    const abortController = new AbortController();
    let objectUrl = '';
    setResolvedSrc('');
    const load = async () => {
      const token = toText(workerToken);
      const response = token
        ? await fetchImpl(source, {
            headers: {
              Authorization: `Bearer ${token}`,
              ...(normalizedSessionSlug ? { 'X-Group-Slug': normalizedSessionSlug } : {}),
            },
            signal: abortController.signal,
          })
        : await fetchWorkerWithAuth(
            source,
            { signal: abortController.signal },
            {
              sessionSlug: normalizedSessionSlug,
              sessionConfig,
              context,
              workerUrl: normalizedWorkerUrl,
            },
          );
      if (!response.ok) throw new Error(`Group image request failed (${response.status}).`);
      const imageBlob = await response.blob();
      if (abortController.signal.aborted) return;
      objectUrl = URL.createObjectURL(imageBlob);
      setResolvedSrc(objectUrl);
    };
    void load().catch(() => {
      if (!abortController.signal.aborted) setResolvedSrc('');
    });

    return () => {
      abortController.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    context,
    contextKey,
    fetchImpl,
    normalizedSessionSlug,
    normalizedWorkerUrl,
    protectedWorkerImage,
    sessionConfig,
    source,
    workerToken,
  ]);

  if (!resolvedSrc) return null;
  return <img src={resolvedSrc} alt={alt} className={className} {...(testId ? { 'data-testid': testId } : {})} />;
};

export default WorkerGroupImage;
