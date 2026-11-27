import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock } from '@fortawesome/free-solid-svg-icons';

import type { SbtListDisplayCardModel } from './sbtListHelpers';
import defaultSbtImage from '../../assets/img/ce_circuit_logo.png';

type SbtListDisplayCardStyles = Record<string, string>;

type SbtListAnchorClickHandler = React.MouseEventHandler<HTMLAnchorElement>;

type SbtListStandardCardProps = {
  detailsPanel?: React.ReactNode;
  href: string;
  imageStyle?: React.CSSProperties;
  isExpanded?: boolean;
  metaRow?: React.ReactNode;
  model: SbtListDisplayCardModel;
  onClick: SbtListAnchorClickHandler;
  sbtLabel: string;
  shellClassName: string;
  styles: SbtListDisplayCardStyles;
};

const resolveSbtListCardImageSrc = (imageSrc: string | null | undefined): string => imageSrc || defaultSbtImage;

const handleSbtListCardImageError: React.ReactEventHandler<HTMLImageElement> = (event) => {
  const image = event.currentTarget;
  if (image.src.endsWith(defaultSbtImage)) return;
  image.src = defaultSbtImage;
};

export const SbtListStandardCard = ({
  detailsPanel = null,
  href,
  imageStyle,
  isExpanded = false,
  metaRow = null,
  model,
  onClick,
  sbtLabel,
  shellClassName,
  styles,
}: SbtListStandardCardProps): React.ReactElement => {
  const { description, imageSrc, locked, name, sbtAddress, sessionSlug } = model;

  return (
    <article key={`${sessionSlug}|${sbtAddress}`} className={shellClassName}>
      <a className={styles.standardCardBodyLink} href={href} onClick={onClick}>
        <div className={styles.standardCardImage} style={imageStyle}>
          <img
            src={resolveSbtListCardImageSrc(imageSrc)}
            alt={`${sbtLabel} Thumbnail`}
            onError={handleSbtListCardImageError}
          />
        </div>
        <div className={styles.standardCardInfo}>
          <p className={styles.standardCardName}>
            {name}
            {locked && <FontAwesomeIcon icon={faLock} className={styles.lockIcon} />}
          </p>
          <p className={styles.standardCardDescription}>{description || 'No description.'}</p>
        </div>
      </a>
      {metaRow}
      {isExpanded && detailsPanel}
    </article>
  );
};
