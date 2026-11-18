import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DropdownItem, DropdownMenu, DropdownToggle, UncontrolledDropdown } from 'reactstrap';

import siteMark from 'assets/img/context_engine_logo.svg';

import {
  CARD_HEIGHT,
  CARD_WIDTH,
  drawAnalysisCardPages,
  loadAnalysisCardFonts,
  type AnalysisCardPages,
  type AnalysisCardPicture,
} from 'utilities/analysisCard/analysisCardCanvas';
import type { AnalysisCardDownload } from 'utilities/analysisCard/analysisCardExport';
import type { AnalysisCard } from 'utilities/analysisCard/analysisCardModel';
import { analysisCardVideoType } from 'utilities/analysisCard/analysisCardVideoType';

import styles from './UserPageAnalysisCard.module.scss';

// The illustration of the matched figure: asked for when the analysis arrives, and absent ("none") when the
// session cannot make one. The card is complete without it.
export type UserPageAnalysisCardPicture = {
  status: 'loading' | 'ready' | 'none';
  dataUrl?: string;
  accentHex?: string;
};

type UserPageAnalysisCardProps = {
  card: AnalysisCard;
  picture?: UserPageAnalysisCardPicture | null;
};

const loadImage = (source: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The picture could not be read.'));
    image.src = source;
  });

const UserPageAnalysisCard = ({ card, picture = null }: UserPageAnalysisCardProps): React.ReactElement => {
  const preview = useRef<HTMLCanvasElement>(null);
  // The drawn pages, with the picture they were drawn with: a file is saved only from pages that are current.
  const [drawn, setDrawn] = useState<{ pages: AnalysisCardPages; card: AnalysisCard; pictureUrl: string } | null>(null);
  const [page, setPage] = useState<1 | 2>(1);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const video = useMemo(analysisCardVideoType, []);
  const pictureUrl = picture?.status === 'ready' ? picture.dataUrl || '' : '';
  const accentHex = picture?.accentHex || '';
  const waiting = picture?.status === 'loading';

  const pages = drawn?.pages || null;
  const ready = !!drawn && drawn.card === card && drawn.pictureUrl === pictureUrl && !waiting;

  useEffect(() => {
    let current = true;
    void (async () => {
      try {
        await loadAnalysisCardFonts();
        const [image, mark] = await Promise.all([
          pictureUrl ? loadImage(pictureUrl).catch(() => null) : null,
          loadImage(siteMark).catch(() => null),
        ]);
        const illustration: AnalysisCardPicture | null = image ? { image, accentHex } : null;
        const next = drawAnalysisCardPages(card, illustration, mark);
        if (!next) throw new Error('no canvas');
        if (!current) return;
        setDrawn({ pages: next, card, pictureUrl });
        setError('');
      } catch {
        if (current) setError('The card could not be drawn in this browser.');
      }
    })();
    return () => {
      current = false;
    };
  }, [card, pictureUrl, accentHex]);

  useEffect(() => {
    const context = preview.current?.getContext('2d');
    if (!context || !pages) return;
    context.drawImage(page === 1 ? pages.page1 : pages.page2, 0, 0, CARD_WIDTH / 2, CARD_HEIGHT / 2);
  }, [pages, page]);

  const download = async (kind: AnalysisCardDownload): Promise<void> => {
    if (!pages || !ready || busy) return;
    setError('');
    setBusy(kind === 'video' ? 'Recording the video. This takes a few seconds…' : 'Making the file…');
    try {
      const { downloadAnalysisCard } = await import('utilities/analysisCard/analysisCardExport');
      await downloadAnalysisCard(pages, kind);
    } catch {
      setError('The file could not be made. Try again, or choose another kind.');
    } finally {
      setBusy('');
    }
  };

  const choices: Array<[AnalysisCardDownload, string]> = [
    ['both', 'Picture, both pages'],
    ['page1', 'Picture, page 1'],
    ['page2', 'Picture, page 2'],
    ['gif', 'GIF, moving between the pages'],
  ];
  if (video) choices.push(['video', `Video (${video.extension.toUpperCase()}), moving between the pages`]);

  return (
    <div className={styles.card}>
      <div className={styles.stage}>
        <button
          type="button"
          className={styles.turn}
          onClick={() => setPage(1)}
          disabled={page === 1}
          aria-label="Show page 1 of the card"
        >
          ‹
        </button>
        <canvas
          ref={preview}
          className={styles.preview}
          width={CARD_WIDTH / 2}
          height={CARD_HEIGHT / 2}
          role="img"
          aria-label={`Picture card, page ${page} of 2: ${card.title}. Closest historical match: ${card.figure}.`}
        />
        <button
          type="button"
          className={styles.turn}
          onClick={() => setPage(2)}
          disabled={page === 2}
          aria-label="Show page 2 of the card"
        >
          ›
        </button>
      </div>
      <div className={styles.actions}>
        <UncontrolledDropdown direction="up">
          <DropdownToggle caret className={styles.download} disabled={!ready || !!busy}>
            Download
          </DropdownToggle>
          <DropdownMenu>
            {choices.map(([kind, text]) => (
              <DropdownItem key={kind} onClick={() => void download(kind)}>
                {text}
              </DropdownItem>
            ))}
          </DropdownMenu>
        </UncontrolledDropdown>
        <p className={styles.status} role="status">
          {error || busy || (waiting ? 'Drawing the picture. The card can be saved when it is ready…' : '')}
        </p>
      </div>
    </div>
  );
};

export default UserPageAnalysisCard;
