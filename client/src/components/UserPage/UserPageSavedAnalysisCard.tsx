import React, { useEffect, useRef, useState } from 'react';

import { fetchAnalysisCardPicture } from 'utilities/ai/aiClient.js';
import { normalizeAnalysisCard, type AnalysisCard } from 'utilities/analysisCard/analysisCardModel';
import {
  formatSavedAnalysisCardDate,
  publishSavedAnalysisCard,
  readSavedAnalysisCard,
  subscribeSavedAnalysisCards,
} from 'utilities/analysisCard/analysisCardSaved';

import UserPageAnalysisCard, { type UserPageAnalysisCardPicture } from './UserPageAnalysisCard';
import styles from './UserPageAnalysisCard.module.scss';
import { buildAnalysisCardPlace } from './userPageAnalysisActions';

type UserPageSavedAnalysisCardProps = {
  // Whose page this is, and who is looking.
  viewAddress: string;
  account: string;
  pageSlug: string;
  // Changes whenever the page's person or session does, so the card is looked up again.
  profileKey: string;
  // The session and sign-in to ask with, or null when this page has no session to ask.
  loadOptions: () => Promise<Record<string, unknown> | null>;
};

// The card a person saved on their page, shown to every signed-in visitor without pressing Analyze. Nothing shows
// while it loads, when there is none, when it was withdrawn, or when it cannot be read. On my own page the card
// itself shows only in the Analyze box; here there is one line saying it is on my page, with the button that
// takes it off without making a new card first: Analyze can fail, or make a new card, before its own box shows.
const UserPageSavedAnalysisCard = ({
  viewAddress,
  account,
  pageSlug,
  profileKey,
  loadOptions,
}: UserPageSavedAnalysisCardProps): React.ReactElement | null => {
  const [shown, setShown] = useState<{ card: AnalysisCard; savedAt: number } | null>(null);
  const [picture, setPicture] = useState<UserPageAnalysisCardPicture | null>(null);
  const [removing, setRemoving] = useState(false);
  const [note, setNote] = useState('');
  const asked = useRef<Record<string, unknown> | null>(null);
  const person = String(viewAddress || '')
    .trim()
    .toLowerCase();
  const viewer = String(account || '')
    .trim()
    .toLowerCase();
  const own = !!person && viewer === person;

  useEffect(() => {
    let current = true;
    let figure = '';
    // Another person, session or sign-in: nothing from the last one stays on screen.
    setShown(null);
    setPicture(null);
    setRemoving(false);
    setNote('');
    asked.current = null;
    const show = async (): Promise<void> => {
      const options = person ? await loadOptions().catch(() => null) : null;
      const saved = options ? await readSavedAnalysisCard(person, options) : null;
      if (!current) return;
      asked.current = options;
      const card =
        saved?.status === 'ready'
          ? normalizeAnalysisCard({
              ...saved.card,
              ...buildAnalysisCardPlace({ own, account: person, sessionSlug: pageSlug || options?.sessionSlug }),
            })
          : null;
      setShown(card && saved?.status === 'ready' ? { card, savedAt: saved.savedAt } : null);
      // My own page draws no card here, so it asks for no picture.
      if (own || !card || !options || card.figure === figure) return;
      const drawing = card.figure;
      figure = drawing;
      setPicture({ status: 'loading' });
      // Only the picture of the card on screen now: an earlier figure's picture that comes back late is dropped.
      const still = (): boolean => current && figure === drawing;
      fetchAnalysisCardPicture(drawing, options)
        .then((drawn) => still() && setPicture({ status: 'ready', ...drawn }))
        .catch(() => still() && setPicture({ status: 'none' }));
    };
    void show();
    // A save or withdrawal on this page shows here at once.
    const unsubscribe = subscribeSavedAnalysisCards(() => void show());
    return () => {
      current = false;
      unsubscribe();
    };
  }, [person, viewer, own, pageSlug, profileKey, loadOptions]);

  const takeOff = (): void => {
    const options = asked.current;
    if (!own || !options || removing) return;
    setRemoving(true);
    setNote('');
    // On success every view of this card hears of it and this section empties.
    publishSavedAnalysisCard(person, false, null, options)
      .catch(() => {
        if (asked.current === options) setNote('The card could not be taken off your page. Try again.');
      })
      .finally(() => {
        if (asked.current === options) setRemoving(false);
      });
  };

  if (!shown) return null;
  if (own) {
    return (
      <section className={styles.savedLine} aria-label="Picture card">
        <p>Your picture card is shown on your page, saved {formatSavedAnalysisCardDate(shown.savedAt)}.</p>
        <div className={styles.takeOff}>
          <button type="button" onClick={takeOff} disabled={removing}>
            {removing ? 'Taking it off…' : 'Take it off my page'}
          </button>
          {note && <p role="status">{note}</p>}
        </div>
      </section>
    );
  }
  return (
    <section className={styles.saved} aria-label="Picture card">
      <h4>Picture card</h4>
      <UserPageAnalysisCard card={shown.card} picture={picture} />
      <p className={styles.savedDate}>Their card, saved {formatSavedAnalysisCardDate(shown.savedAt)}</p>
    </section>
  );
};

export default UserPageSavedAnalysisCard;
