import React from 'react';
import { render } from '@testing-library/react';

import UserPageAnalysisCardSkeleton from './UserPageAnalysisCardSkeleton';
import styles from './UserPageAnalysisCard.module.scss';

it('outlines the historical match as its name, a paragraph of full lines and a short last line', () => {
  const { container } = render(<UserPageAnalysisCardSkeleton />);
  const match = container.querySelector(`.${styles.skeletonMatch}`);
  const bars = Array.from(match?.querySelectorAll(`.${styles.skeletonBar}`) || []);
  expect(bars[0].classList.contains(styles.skeletonName)).toBe(true);
  expect(bars.at(-1)?.classList.contains(styles.skeletonShort)).toBe(true);
  expect(bars.slice(1, -1)).toHaveLength(4);
  expect(bars.slice(1, -1).every((bar) => bar.className === styles.skeletonBar)).toBe(true);
});
