import React from 'react';
import { render, screen } from '@testing-library/react';
import ContractViewer from './ContractViewer';
import {
  CONTRACT_VIEWER_TOGGLE_TESTID,
  getContractViewerCardTestId,
  getContractViewerSourceTestId,
} from './contractMetadata.js';

describe('ContractViewer compact variant', () => {
  it('renders a single expanded contract reader without the full-page section toggle', () => {
    render(
      <ContractViewer
        variant="compact"
        contracts={[
          {
            key: 'surveys',
            name: 'Questions and Surveys',
            explainer: 'Keeps track of questions / surveys (+ responses) storage hashes on Arweave.',
            sourceFile: 'Surveys.sol',
            source: 'contract Surveys { function ask() external {} }',
            addresses: [],
          },
        ]}
        onClose={jest.fn()}
        renderSourceHeaderActions={() => <a href="/contracts?contract=surveys">Open full Contracts page</a>}
      />,
    );

    expect(screen.queryByTestId(CONTRACT_VIEWER_TOGGLE_TESTID)).not.toBeInTheDocument();
    expect(screen.getByTestId(getContractViewerCardTestId('surveys'))).toBeInTheDocument();
    expect(screen.getByTestId(getContractViewerSourceTestId('surveys'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open full contracts page/i })).toHaveAttribute(
      'href',
      '/contracts?contract=surveys',
    );
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
