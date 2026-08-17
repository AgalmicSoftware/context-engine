import React from 'react';
import { normalizeSessionColorSchemeId } from '../../utilities/ui/sessionColorSchemes';
import {
  getResolvedTheme,
  hasExplicitUserThemePreference,
  subscribeThemeChanges,
} from '../../utilities/ui/themeRuntime';
import styles from './SessionColorSchemeScope.module.scss';

type SessionColorSchemeScopeProps = {
  active: boolean;
  children: React.ReactNode;
  sessionConfig?: unknown;
};

const readAppearanceColorSchemeId = (sessionConfig: unknown): unknown => {
  if (!sessionConfig || typeof sessionConfig !== 'object' || Array.isArray(sessionConfig)) return null;
  const appearance = (sessionConfig as Record<string, unknown>).appearance;
  if (!appearance || typeof appearance !== 'object' || Array.isArray(appearance)) return null;
  return (appearance as Record<string, unknown>).colorSchemeId;
};

const SessionColorSchemeScope = ({
  active,
  children,
  sessionConfig = null,
}: SessionColorSchemeScopeProps): React.ReactElement => {
  const [themeSource, setThemeSource] = React.useState(() => {
    if (typeof document !== 'undefined' && document.documentElement.dataset.ceThemeSource) {
      return document.documentElement.dataset.ceThemeSource;
    }
    return getResolvedTheme().source;
  });

  React.useEffect(
    () =>
      subscribeThemeChanges((selection) => {
        setThemeSource(selection.source);
      }),
    [],
  );

  const suppressForUserTheme = themeSource === 'user' || hasExplicitUserThemePreference();
  const colorSchemeId =
    active && sessionConfig && !suppressForUserTheme
      ? normalizeSessionColorSchemeId(readAppearanceColorSchemeId(sessionConfig))
      : null;

  return (
    <div
      className={styles.scope}
      data-ce-session-color-scheme={colorSchemeId || undefined}
      data-ce-session-color-scope={colorSchemeId ? 'active' : undefined}
    >
      {children}
    </div>
  );
};

export default SessionColorSchemeScope;
