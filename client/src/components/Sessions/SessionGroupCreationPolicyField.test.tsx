import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SessionGroupCreationPolicyField from './SessionGroupCreationPolicyField';

describe('SessionGroupCreationPolicyField', () => {
  it('uses a labelled dropdown and preserves the participant default', () => {
    const onChange = jest.fn();
    render(<SessionGroupCreationPolicyField isWorkerCanonical value={undefined} onChange={onChange} />);

    const policy = screen.getByTestId(E2E_TESTIDS.WIZARD_GROUP_CREATION_POLICY);
    expect(policy).toHaveAccessibleName('Who can create groups?');
    expect(policy).toHaveValue('participants');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'All participants',
      'Admins only',
    ]);
    expect(screen.queryByRole('textbox', { name: 'Who can create groups?' })).not.toBeInTheDocument();

    fireEvent.change(policy, { target: { value: 'admin_only' } });
    expect(onChange).toHaveBeenCalledWith('admin_only');
    expect(screen.getByText(/Updating groups and managing membership remain admin-only/i)).toBeInTheDocument();
  });

  it('explains the public-factory limit for on-chain sessions', () => {
    render(<SessionGroupCreationPolicyField isWorkerCanonical={false} value="admin_only" onChange={jest.fn()} />);

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_GROUP_CREATION_POLICY)).toHaveValue('admin_only');
    expect(screen.getByText(/Public SBT factories remain callable directly on-chain/i)).toBeInTheDocument();
  });
});
