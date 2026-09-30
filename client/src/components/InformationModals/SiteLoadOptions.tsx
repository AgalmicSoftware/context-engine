/** @file SiteLoadOptions.tsx */
import React from 'react';
import 'assets/css/contextEngine.scss';
import styles from './Modals.module.scss';
import { CardFooter } from 'reactstrap';
import WelcomeSlideRenderer from './WelcomeSlideRenderer';

type SiteLoadOptionsProps = {
  arrowIndex: number;
  clickRightArrow: () => void;
  clickLeftArrow?: () => void;
};

export default function SiteLoadOptions({ arrowIndex, clickRightArrow }: SiteLoadOptionsProps) {
  return (
    <div className={styles.welcomeSlideEmbed}>
      <CardFooter className={styles.welcomeSlideFooter}>
        <WelcomeSlideRenderer slideIndex={arrowIndex} onSlideClick={arrowIndex === 0 ? clickRightArrow : undefined} />
      </CardFooter>
    </div>
  );
}
