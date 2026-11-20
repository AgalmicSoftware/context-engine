/** @file ShowSessionNames.tsx: offers a connected person the session sign-in that names are read with. */
import { useState } from 'react';
import styles from './ShowSessionNames.module.scss';

type ShowSessionNamesProps = {
  /** From useSessionNames: set only when the person is connected and this tab holds no session sign-in. */
  signIn: (() => Promise<void>) | null;
};

/**
 * A new tab starts without the session sign-in, so a connected person is shown addresses there. The page never
 * opens a wallet or passkey unasked; this is the asking.
 */
const ShowSessionNames = ({ signIn }: ShowSessionNamesProps) => {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!signIn) return null;
  return (
    <p className={styles.showNames}>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setFailed(false);
          // On success the names reload and this notice goes with the sign-in it offered.
          signIn()
            .catch(() => setFailed(true))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? 'Signing in…' : 'Show names'}
      </button>
      <span role="status">
        {failed ? 'The sign-in didn’t finish. Try again.' : 'Sign in to this session to see the names people have set.'}
      </span>
    </p>
  );
};

export default ShowSessionNames;
