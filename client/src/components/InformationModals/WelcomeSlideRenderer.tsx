import React from 'react';
import { getWelcomeSlide } from '../MainContent/welcomeSlides.js';
import styles from './Modals.module.scss';

type WelcomeSlideRendererProps = {
  slideIndex?: number;
  onSlideClick?: (() => void) | null;
  leadingContent?: React.ReactNode;
  className?: string;
};

const EXPLAINER_BUTTON_STYLE: React.CSSProperties = {
  marginTop: '0px',
  backgroundSize: 'contain',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center',
  padding: '0px',
};

const WelcomeSlideRenderer = ({
  slideIndex = 0,
  onSlideClick = null,
  leadingContent = null,
  className = '',
}: WelcomeSlideRendererProps) => {
  const currentSlide = getWelcomeSlide(slideIndex) as any;

  if (!currentSlide) {
    return null;
  }

  const bulletPoints = Array.isArray(currentSlide?.bulletPoints)
    ? currentSlide.bulletPoints
    : [];
  const isTitlelessSlide = !String(currentSlide?.title || '').trim();
  const hasVisibleBulletPoints = bulletPoints.some((point: any) => (
    Boolean(point?.bold || point?.text)
  ));
  const slideLayout = currentSlide?.mediaLayout || 'default';
  const containerClassName = [className].filter(Boolean).join(' ');

  return (
    <div id={styles.explainerAndUpdates} className={containerClassName}>
      {leadingContent}

      <button
        type='button'
        id={styles[currentSlide.buttonStyleId]}
        style={EXPLAINER_BUTTON_STYLE}
        data-slide-key={currentSlide.key}
        data-slide-layout={slideLayout}
        onClick={onSlideClick || undefined}
      >
        <img
          src={currentSlide.image}
          alt={currentSlide.imageAlt || currentSlide.overlayTitle || currentSlide.title || 'Welcome slide'}
          id={styles[currentSlide.imageStyleId]}
          data-slide-layout={slideLayout}
        />
      </button>

      <div
        id={styles.betaExaplainerList}
        className={isTitlelessSlide ? styles.titlelessBulletListContainer : ''}
        style={{ display: hasVisibleBulletPoints ? 'flex' : 'none' }}
      >
        <ul id={styles.betaExplainerBulletpoint}>
          {bulletPoints.map((point: any, index: number) => {
            const bold = String(point?.bold || '');
            const text = String(point?.text || '');

            return (
              <li key={`${currentSlide.key}-${index}`} style={{ display: bold || text ? 'list-item' : 'none' }}>
                <h4 id={styles.betaExplainerBulletText}>
                  {bold ? <strong>{bold}</strong> : null}
                  {bold && text ? ' ' : null}
                  {text ? (
                    <span className={styles.betaExplainerBulletTrailingText}>
                      {text}
                    </span>
                  ) : null}
                </h4>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default WelcomeSlideRenderer;
