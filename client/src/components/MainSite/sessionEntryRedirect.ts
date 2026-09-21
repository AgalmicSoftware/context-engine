import demoSessions from '../../variables/demo/demo_sessions.json';
import { buildPublicUrl } from './urlUtils';

export const getSessionEntryRedirect = (pathname: string, search = '', hash = ''): string | null => {
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
