import SessionWizardStorageProfileField from './SessionWizardStorageProfileField';

export type SessionWizardStorageProfileMetadataFieldProps = {
  isCollapsed: boolean;
  title: string;
  value: unknown;
  onStorageProfileChange: (nextProfile: unknown) => void;
  onToggleCollapsed: () => void;
};

const SessionWizardStorageProfileMetadataField = ({
  isCollapsed,
  title,
  value,
  onStorageProfileChange,
  onToggleCollapsed,
}: SessionWizardStorageProfileMetadataFieldProps) => (
  <SessionWizardStorageProfileField
    title={title}
    value={value}
    isCollapsed={isCollapsed}
    onToggleCollapsed={onToggleCollapsed}
    onStorageProfileChange={onStorageProfileChange}
  />
);

export default SessionWizardStorageProfileMetadataField;
