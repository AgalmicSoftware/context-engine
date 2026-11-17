/** @file SessionLoadStatus.tsx: the wait for a session's config, which ends in a message with a way back. */
import React, { useEffect, useState } from 'react';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';

export const SESSION_LOAD_GIVE_UP_MS = 15_000;
const SESSION_NOT_LOADED =
  "This session hasn't loaded. The link may be incomplete: a session that isn't listed on this site opens only from the full link its admin shared.";

/** "Loading session..." until the config arrives; after a while, says it has not and links back to session selection. */
export const SessionLoadStatus = () => {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SESSION_LOAD_GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!slow) return <p role="status">Loading session...</p>;
  return (
    <div role="status">
      <p>{SESSION_NOT_LOADED}</p>
      <a href={buildPublicRoute('/new')}>Return to session selection</a>
    </div>
  );
};
