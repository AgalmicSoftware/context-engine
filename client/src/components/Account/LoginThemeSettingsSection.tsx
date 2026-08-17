import React from 'react';
import { CE_THEME_SELECTOR_ENABLED } from '../../variables/appConfig.js';
import AppThemeSelector from './AppThemeSelector';
import LoginSettingsSectionCard from './LoginSettingsSectionCard';

type LoginThemeSettingsSectionProps = {
  isOpen: boolean;
  onToggle: () => void;
};

const LoginThemeSettingsSection = ({ isOpen, onToggle }: LoginThemeSettingsSectionProps) =>
  CE_THEME_SELECTOR_ENABLED ? (
    <LoginSettingsSectionCard title="Appearance & colors" isOpen={isOpen} onToggle={onToggle}>
      <AppThemeSelector />
    </LoginSettingsSectionCard>
  ) : null;

export default LoginThemeSettingsSection;
