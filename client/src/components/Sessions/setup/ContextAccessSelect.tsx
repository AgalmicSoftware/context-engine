import { Input } from 'reactstrap';

import type { ContextFileAccess } from '../../../utilities/docLibrary/contextSources';
import type { ContextGroup } from '../../../utilities/docLibrary/useContextGroups';

const GROUP_PREFIX = 'group:';
export const SESSION_WIDE_ACCESS = 'session';

export const contextGroupChoice = (groupId: string) => `${GROUP_PREFIX}${groupId}`;

/** What upload takes for a choice in the list below. */
export const contextAccessOf = (choice: string): ContextFileAccess =>
  choice === 'admins'
    ? { adminsOnly: true }
    : choice.startsWith(GROUP_PREFIX)
      ? { groupId: choice.slice(GROUP_PREFIX.length) }
      : {};

type Props = {
  id: string;
  value: string;
  groups: ContextGroup[];
  /** Only admins see this one: nobody else could open what they had added. */
  allowAdminsOnly?: boolean;
  disabled?: boolean;
  className?: string;
  onChange: (choice: string) => void;
  'aria-label'?: string;
  'data-testid'?: string;
};

// Who may read a file being added. A group's members and the session's admins read a locked file.
const ContextAccessSelect = ({ id, value, groups, allowAdminsOnly, onChange, ...rest }: Props) => (
  <Input id={id} type="select" value={value} onChange={(event) => onChange(event.target.value)} {...rest}>
    <option value={SESSION_WIDE_ACCESS}>Anyone who can see the session</option>
    {groups.map(({ groupId, label }) => (
      <option key={groupId} value={contextGroupChoice(groupId)}>
        {label}
      </option>
    ))}
    {allowAdminsOnly ? <option value="admins">Admins only</option> : null}
  </Input>
);

export default ContextAccessSelect;
