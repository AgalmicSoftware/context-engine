import type { SessionModeProfile } from '../../utilities/session/sessionModeProfile';
import type { UnknownRecord } from '../../utilities/session/sessionTypes';
import SessionModeProfileField from './SessionModeProfileField';

export type SessionWizardSessionModeProfileControlProps = {
  registryChainId?: number | null;
  value?: unknown;
  onChange: (profile: SessionModeProfile, compiled: { storageProfile: UnknownRecord }) => void;
  onContinue?: () => void;
};

const SessionWizardSessionModeProfileControl = ({
  registryChainId,
  value,
  onChange,
  onContinue,
}: SessionWizardSessionModeProfileControlProps) => (
  <SessionModeProfileField
    registryChainId={registryChainId}
    value={value}
    onChange={onChange}
    onContinue={onContinue}
  />
);

export default SessionWizardSessionModeProfileControl;
