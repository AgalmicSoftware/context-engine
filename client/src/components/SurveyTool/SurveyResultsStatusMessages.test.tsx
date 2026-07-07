import React from 'react';
import { render, screen } from '@testing-library/react';

import SurveyResultsStatusMessages from './SurveyResultsStatusMessages';

const styleMap = {
  alertMessage: 'alertMessage',
  loadingContainer: 'loadingContainer',
};

describe('SurveyResultsStatusMessages', () => {
  it('renders an informational alert when not filtering', () => {
    render(<SurveyResultsStatusMessages alertMessage="Export complete." filterLoading={false} styleMap={styleMap} />);

    expect(screen.getByText('Export complete.')).toBeInTheDocument();
    expect(screen.queryByText('Applying filter...')).not.toBeInTheDocument();
  });

  it('renders the filter loading state instead of the alert', () => {
    render(
      <SurveyResultsStatusMessages alertMessage="Hidden while loading." filterLoading={true} styleMap={styleMap} />,
    );

    expect(screen.getByText('Applying filter...')).toBeInTheDocument();
    expect(screen.queryByText('Hidden while loading.')).not.toBeInTheDocument();
  });

  it('renders no status UI when idle', () => {
    const { container } = render(
      <SurveyResultsStatusMessages alertMessage="" filterLoading={false} styleMap={styleMap} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
