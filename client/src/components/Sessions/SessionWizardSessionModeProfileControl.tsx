import type {
  CompiledSessionModeProfile,
  SessionModeProfile,
} from '../../utilities/session/sessionModeProfile';
import SessionModeProfileField from './SessionModeProfileField';

export type SessionWizardSessionModeProfileControlProps = {
  registryChainId?: number | null;
  value?: unknown;
  onChange: (profile: SessionModeProfile, compiled: { storageProfile: UnknownRecord }) => void;
  onContinue?: () => void;
  onCustomize?: () => void;
  onSelectPreset?: () => void;
  customizing?: boolean;
  entryOnly?: boolean;
  showContinue?: boolean;
};

const SessionWizardSessionModeProfileControl = ({
  registryChainId,
  value,
  onChange,
  onContinue,
  onCustomize,
  onSelectPreset,
  customizing,
  entryOnly,
  showContinue,
}: SessionWizardSessionModeProfileControlProps) => (
  <SessionModeProfileField
    registryChainId={registryChainId}
    value={value}
    onChange={onChange}
    onContinue={onContinue}
    onCustomize={onCustomize}
    onSelectPreset={onSelectPreset}
    customizing={customizing}
    entryOnly={entryOnly}
    showContinue={showContinue}
  />
);

export default SessionWizardSessionModeProfileControl;
