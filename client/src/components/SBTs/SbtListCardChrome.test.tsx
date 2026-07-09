import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { SbtListDetailsPanel, SbtListMetaRow } from './SbtListCardChrome';

const styles = {
  sbtDetailsHeading: 'sbtDetailsHeading',
  sbtDetailsPanel: 'sbtDetailsPanel',
  sbtDetailsSection: 'sbtDetailsSection',
  sbtDetailsToggle: 'sbtDetailsToggle',
  sbtDetailsToggleIcon: 'sbtDetailsToggleIcon',
  sbtDocumentLink: 'sbtDocumentLink',
  sbtDocumentList: 'sbtDocumentList',
  sbtMetaRow: 'sbtMetaRow',
  sbtMetaRowToggleOnly: 'sbtMetaRowToggleOnly',
  sbtMetaRowWithTags: 'sbtMetaRowWithTags',
  sbtTagChip: 'sbtTagChip',
  sbtTagList: 'sbtTagList',
};

describe('SbtListCardChrome', () => {
  it('renders document details only when details are available', () => {
    const { rerender } = render(
      <SbtListDetailsPanel
        details={{
          documentUrls: [{ href: 'https://docs.example/alpha', label: 'Alpha doc' }],
          hasDetails: true,
          tags: [],
        }}
        detailsId="sbt-details-alpha"
        styles={styles}
      />,
    );

    const link = screen.getByRole('link', { name: 'Alpha doc' });
    expect(link).toHaveAttribute('href', 'https://docs.example/alpha');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    rerender(
      <SbtListDetailsPanel
        details={{ documentUrls: [], hasDetails: false, tags: [] }}
        detailsId="sbt-details-alpha"
        styles={styles}
      />,
    );
    expect(screen.queryByRole('link', { name: 'Alpha doc' })).not.toBeInTheDocument();
  });

  it('renders tag chips and details toggle wiring from the meta row model', () => {
    const onTagClick = jest.fn((event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
    });
    const onToggleDetails = jest.fn();

    render(
      <SbtListMetaRow
        buttonLabel="Alpha SBT"
        detailsId="sbt-details-alpha"
        model={{
          hasDetailsToggle: true,
          hasTags: true,
          isExpanded: false,
          sbtAddressLower: '0xabc',
          tags: ['alpha'],
        }}
        onTagClick={onTagClick}
        onToggleDetails={onToggleDetails}
        styles={styles}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open tag explorer for alpha' }));
    expect(onTagClick).toHaveBeenCalledWith(expect.any(Object), 'alpha');

    const toggle = screen.getByRole('button', { name: 'Show details for Alpha SBT' });
    expect(toggle).toHaveAttribute('aria-controls', 'sbt-details-alpha');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(onToggleDetails).toHaveBeenCalledTimes(1);
  });
});
