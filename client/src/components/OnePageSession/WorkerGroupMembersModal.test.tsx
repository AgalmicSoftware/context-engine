import React from 'react';
import { render, screen } from '@testing-library/react';
import WorkerGroupMembersModal from './WorkerGroupMembersModal';

const A = '0x00000000000000000000000000000000000000aA';
const B = '0x00000000000000000000000000000000000000bb';

it("shows a member's session name in place of their address, and the address otherwise", () => {
  render(
    <WorkerGroupMembersModal
      error=""
      group={{ groupId: 'g', sessionSlug: 'alpha', label: 'Reviewers' } as never}
      isOpen
      members={[
        { principal: { kind: 'evm_address', address: A } },
        { principal: { kind: 'passkey_account', address: B } },
      ]}
      nextCursor=""
      onClose={() => {}}
      onLoadMore={() => {}}
      nameLabels={{ [A.toLowerCase()]: 'Sam' }}
      sessionSlug="alpha"
      status="ready"
    />,
  );

  expect(screen.getByRole('link', { name: 'Sam' })).toHaveAttribute('title', A);
  expect(screen.getByRole('link', { name: /^Passkey · 0x/ })).toHaveAttribute('title', B);
});
