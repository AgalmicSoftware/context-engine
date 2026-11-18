import React, { useEffect, useState } from 'react';

import { fetchAnalysisCardPicture } from 'utilities/ai/aiClient.js';
import { normalizeAnalysisCard, type AnalysisCard } from 'utilities/analysisCard/analysisCardModel';
import {
  formatSavedAnalysisCardDate,
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
// while it loads, when there is none, when it was withdrawn, or when it cannot be read.
const UserPageSavedAnalysisCard = ({
  viewAddress,
  account,
  pageSlug,
  profileKey,
  loadOptions,
}: UserPageSavedAnalysisCardProps): React.ReactElement | null => {
  const [shown, setShown] = useState<{ card: AnalysisCard; savedAt: number } | null>(null);
  const [picture, setPicture] = useState<UserPageAnalysisCardPicture | null>(null);
  const person = String(viewAddress || '')
    .trim()
    .toLowerCase();
  const own =
    !!person &&
    String(account || '')
      .trim()
      .toLowerCase() === person;

  useEffect(() => {
    let current = true;
    let figure = '';
    const show = async (): Promise<void> => {
      const options = person ? await loadOptions().catch(() => null) : null;
      const saved = options ? await readSavedAnalysisCard(person, options) : null;
      if (!current) return;
      const card =
        saved?.status === 'ready'
          ? normalizeAnalysisCard({
              ...saved.card,
              ...buildAnalysisCardPlace({ own, account: person, sessionSlug: pageSlug || options?.sessionSlug }),
            })
          : null;
      setShown(card && saved?.status === 'ready' ? { card, savedAt: saved.savedAt } : null);
      if (!card || !options || card.figure === figure) return;
      figure = card.figure;
      setPicture({ status: 'loading' });
      fetchAnalysisCardPicture(card.figure, options)
        .then((drawn) => current && setPicture({ status: 'ready', ...drawn }))
        .catch(() => current && setPicture({ status: 'none' }));
    };
    void show();
    // A save or withdrawal on this page shows here at once.
    const unsubscribe = subscribeSavedAnalysisCards(() => void show());
    return () => {
      current = false;
      unsubscribe();
    };
  }, [person, own, pageSlug, profileKey, loadOptions]);

  if (!shown) return null;
  return (
    <section className={styles.saved} aria-label="Picture card">
      <h4>Picture card</h4>
      <UserPageAnalysisCard card={shown.card} picture={picture} />
      <p className={styles.savedDate}>
        {own ? 'Your card, shown on your page' : 'Their card'}, saved {formatSavedAnalysisCardDate(shown.savedAt)}
      </p>
    </section>
  );
};

export default UserPageSavedAnalysisCard;
