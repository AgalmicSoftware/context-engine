import demoSessions from '../../variables/demo/demo_sessions.json';
import { isRxcSessionEntryPath } from '../../utilities/session/rxcSessionSlugs';
import { buildPublicUrl } from './urlUtils';

export const getSessionEntryRedirect = (pathname: string, search = '', hash = ''): string | null => {
  if (isRxcSessionEntryPath(pathname)) {
    return buildPublicUrl(`/session${pathname.replace(/\/$/, '')}`, search, hash);
  }
  // Only the bare event link implies interview/join intent. Preserve explicit
  // links and the Worker parameter left behind after those intents are consumed.
  if (!/^\/session\/eddy26\/?$/.test(pathname) || search || hash) return null;

  const params = new URLSearchParams({
    worker: demoSessions.eddy26.corsWorkerUrl,
    joinGroup: 'eddy-2026',
    mode: 'interview',
  });
  return buildPublicUrl('/session/eddy26', params.toString());
};

// A session's atlas lives on its page: /atlas[/<node>]?session=<slug> opens its
// Results there, on that node when one is named.
export const getSessionAtlasRedirect = (pathname: string, search = ''): string | null => {
  const params = new URLSearchParams(search);
  const slug = (params.get('session') || '').trim();
  const match = pathname.match(/^\/atlas(?:\/([^/]+))?\/?$/);
  if (!slug || !match) return null;
  let nodeId = match[1] || '';
  try {
    nodeId = decodeURIComponent(nodeId);
  } catch {
    // Kept as written; the session page opens no node it does not find.
  }
  const next = new URLSearchParams();
  const worker = (params.get('worker') || '').trim();
  if (worker) next.set('worker', worker);
  next.set('atlas', nodeId || '1');
  return buildPublicUrl(`/session/${encodeURIComponent(slug)}`, next.toString());
};
