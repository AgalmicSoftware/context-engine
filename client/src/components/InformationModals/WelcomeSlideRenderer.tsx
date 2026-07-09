import React from 'react';
import {
  getWelcomeSlide,
  type WelcomeSlideImageVariant,
  type WelcomeSlideMediaButtonVariant,
} from '../MainContent/welcomeSlides.js';
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

const buildClassName = (classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const MEDIA_BUTTON_CLASS_BY_VARIANT: Record<WelcomeSlideMediaButtonVariant, string> = {
  standard: styles.welcomeSlideMediaButton,
  centered: buildClassName([styles.welcomeSlideMediaButton, styles.welcomeSlideMediaButtonCentered]),
};

const IMAGE_CLASS_BY_VARIANT: Record<WelcomeSlideImageVariant, string> = {
  intro: buildClassName([styles.welcomeSlideImage, styles.welcomeSlideImageIntro]),
  toolkit: buildClassName([styles.welcomeSlideImage, styles.welcomeSlideImageToolkit]),
  goals: buildClassName([styles.welcomeSlideImage, styles.welcomeSlideImageGoals]),
  audience: buildClassName([styles.welcomeSlideImage, styles.welcomeSlideImageAudience]),
  motivation: buildClassName([styles.welcomeSlideImage, styles.welcomeSlideImageMotivation]),
  collaborators: buildClassName([styles.welcomeSlideImage, styles.welcomeSlideImageCollaborators]),
};

const WelcomeSlideRenderer = ({
  slideIndex = 0,
  onSlideClick = null,
  leadingContent = null,
  className = '',
}: WelcomeSlideRendererProps) => {
  const currentSlide = getWelcomeSlide(slideIndex);

  if (!currentSlide) {
    return null;
  }

  const bulletPoints = Array.isArray(currentSlide?.bulletPoints) ? currentSlide.bulletPoints : [];
  const isTitlelessSlide = !String(currentSlide?.title || '').trim();
  const hasVisibleBulletPoints = bulletPoints.some((point) => Boolean(point?.bold || point?.text));
  const slideLayout = currentSlide?.mediaLayout || 'default';
  const containerClassName = buildClassName([styles.welcomeSlideLayout, className]);
  const mediaButtonClassName =
    MEDIA_BUTTON_CLASS_BY_VARIANT[currentSlide.mediaButtonVariant] || MEDIA_BUTTON_CLASS_BY_VARIANT.standard;
  const imageClassName = IMAGE_CLASS_BY_VARIANT[currentSlide.imageVariant] || IMAGE_CLASS_BY_VARIANT.intro;
  const bulletListClassName = buildClassName([
    styles.welcomeSlideBulletList,
    isTitlelessSlide ? styles.isTitlelessBulletList : null,
  ]);

  return (
    <div className={containerClassName}>
      {leadingContent}

      <button
        type="button"
        className={mediaButtonClassName}
        style={EXPLAINER_BUTTON_STYLE}
        data-testid="ce-welcome-slide-media"
        data-slide-key={currentSlide.key}
        data-slide-layout={slideLayout}
        onClick={onSlideClick || undefined}
      >
        <img
          src={currentSlide.image}
          alt={currentSlide.imageAlt || currentSlide.overlayTitle || currentSlide.title || 'Welcome slide'}
          className={imageClassName}
          data-testid="ce-welcome-slide-image"
          data-slide-layout={slideLayout}
        />
      </button>

      <div
        className={bulletListClassName}
        data-testid="ce-welcome-slide-bullet-list"
        style={{ display: hasVisibleBulletPoints ? 'flex' : 'none' }}
      >
        <ul className={styles.welcomeSlideBulletItems} data-testid="ce-welcome-slide-bullet-items">
          {bulletPoints.map((point, index: number) => {
            const bold = String(point?.bold || '');
            const text = String(point?.text || '');

            return (
              <li key={`${currentSlide.key}-${index}`} style={{ display: bold || text ? 'list-item' : 'none' }}>
                <h4 className={styles.welcomeSlideBulletText}>
                  {bold ? <strong>{bold}</strong> : null}
                  {bold && text ? ' ' : null}
                  {text ? <span className={styles.welcomeSlideBulletTrailingText}>{text}</span> : null}
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
