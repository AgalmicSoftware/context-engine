import React from 'react';
import { render, screen } from '@testing-library/react';

import {
  SbtListCompactLinkCard,
  SbtListStandardCard,
} from './SbtListDisplayCards';

const styles = {
  lockIcon: 'lockIcon',
  sbtDescription: 'sbtDescription',
  sbtImage: 'sbtImage',
  sbtInfo: 'sbtInfo',
  sbtName: 'sbtName',
  standardCardBodyLink: 'standardCardBodyLink',
  standardCardDescription: 'standardCardDescription',
  standardCardImage: 'standardCardImage',
  standardCardInfo: 'standardCardInfo',
  standardCardName: 'standardCardName',
};

const model = {
  description: 'Badge description',
  imageSrc: 'https://example.test/badge.png',
  key: 'sbt-0xabc',
  locked: true,
  name: 'Badge',
  sbtAddress: '0xabc',
  sbtAddressLower: '0xabc',
  sessionSlug: 'alpha',
};

describe('SbtListDisplayCards', () => {
  it('renders compact link card contents from the display model', () => {
    render(
      <SbtListCompactLinkCard
        className="compact"
        href="/groups/0xabc"
        model={model}
        onClick={jest.fn()}
        sbtLabel="Group"
        styles={styles}
      />
    );

    expect(screen.getByRole('link', { name: /Badge/ })).toHaveAttribute('href', '/groups/0xabc');
    expect(screen.getByRole('img', { name: 'Group Thumbnail' })).toHaveAttribute('src', model.imageSrc);
    expect(screen.getByText('Badge description')).toBeInTheDocument();
  });

  it('renders standard card meta row and expanded details', () => {
    const { rerender } = render(
      <SbtListStandardCard
        href="/groups/0xabc"
        isExpanded
        metaRow={<div>Meta row</div>}
        detailsPanel={<div>Details panel</div>}
        model={model}
        onClick={jest.fn()}
        sbtLabel="Group"
        shellClassName="standard"
        styles={styles}
      />
    );

    expect(screen.getByRole('link', { name: /Badge/ })).toHaveAttribute('href', '/groups/0xabc');
    expect(screen.getByText('Meta row')).toBeInTheDocument();
    expect(screen.getByText('Details panel')).toBeInTheDocument();

    rerender(
      <SbtListStandardCard
        href="/groups/0xabc"
        isExpanded={false}
        metaRow={<div>Meta row</div>}
        detailsPanel={<div>Details panel</div>}
        model={model}
        onClick={jest.fn()}
        sbtLabel="Group"
        shellClassName="standard"
        styles={styles}
      />
    );

    expect(screen.getByText('Meta row')).toBeInTheDocument();
    expect(screen.queryByText('Details panel')).not.toBeInTheDocument();
  });
});
