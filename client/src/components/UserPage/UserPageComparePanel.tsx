import React, { Suspense } from 'react';
import { Collapse } from 'reactstrap';

type UserPageComparePanelProps = {
  children: React.ReactNode;
  collapseOpen?: React.ComponentProps<typeof Collapse>['isOpen'];
  minimized?: boolean;
};

const UserPageComparePanel = ({
  children,
  collapseOpen,
  minimized = false,
}: UserPageComparePanelProps): React.ReactElement | null => {
  if (minimized) return null;

  return (
    <Collapse isOpen={collapseOpen}>
      <Suspense fallback={null}>{children}</Suspense>
    </Collapse>
  );
};

export default UserPageComparePanel;
