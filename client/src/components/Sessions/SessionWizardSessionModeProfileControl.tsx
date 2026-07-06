import type {
  CompiledSessionModeProfile,
  SessionModeProfile,
} from '../../utilities/session/sessionModeProfile';
import SessionModeProfileField from './SessionModeProfileField';

export type SessionWizardSessionModeProfileControlProps = {
  registryChainId?: number | null;
  value?: unknown;
  onChange: (profile: SessionModeProfile, compiled: CompiledSessionModeProfile) => void;
};

const SessionWizardSessionModeProfileControl = ({
  registryChainId,
  value,
  onChange,
}: SessionWizardSessionModeProfileControlProps) => (
  <SessionModeProfileField
    registryChainId={registryChainId}
    value={value}
    onChange={onChange}
  />
);

export default SessionWizardSessionModeProfileControl;
