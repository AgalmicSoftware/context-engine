import React, { useEffect, useState } from 'react';
import { getAllSessionSlugs, getSessionConfigBySlug } from '../../utilities/web3/chainGateway.js';
import { SESSION_REGISTRY_CACHE_UPDATED_EVENT } from '../../utilities/web3/sessionRegistry.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import accountStyles from '../Account/Account.module.scss';
import styles from './ToolExplorer.module.scss';

export const resolveToolSessionConfig = (slug: string, supplied: unknown): Record<string, unknown> | null => {
  if (supplied && typeof supplied === 'object' && 'slug' in supplied && normalizeSessionSlug(supplied.slug) === slug) {
    return supplied as Record<string, unknown>;
  }
  return getSessionConfigBySlug(slug) || null;
};

const ToolExplorerSessionControl = ({
  activeSessionSlug,
  sessionConfig,
  inheritedSessionSlug,
  onUseInheritedSession,
  onChange,
}: {
  activeSessionSlug: string;
  sessionConfig: unknown;
  inheritedSessionSlug?: string;
  onUseInheritedSession?: () => void;
  onChange: (slug: string) => void;
}) => {
  const [, refreshCatalog] = useState(0);
  const refresh = () => refreshCatalog((revision) => revision + 1);
  useEffect(() => {
    window.addEventListener(SESSION_REGISTRY_CACHE_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(SESSION_REGISTRY_CACHE_UPDATED_EVENT, refresh);
  }, []);

  const slugs = Array.from(
    new Set(
      [activeSessionSlug, inheritedSessionSlug ?? '', '', ...(getAllSessionSlugs({ includeEmpty: true }) || [])].map(
        normalizeSessionSlug,
      ),
    ),
  );
  const options = slugs.map((slug) => {
    const config = resolveToolSessionConfig(slug, slug === activeSessionSlug ? sessionConfig : null);
    const name = slug ? toStr(config?.sessionName).trim() || slug : 'General';
    const description = slug && name.toLowerCase() !== slug ? `${name} (${slug})` : name;
    return { slug, name, description };
  });

  let inheritedOptionValue = '__ce_inherited_session__';
  while (slugs.includes(inheritedOptionValue)) inheritedOptionValue += '_';
  const inheritedSessionName = options.find((option) => option.slug === inheritedSessionSlug)?.name;

  return (
    <label className={`${accountStyles.settingsSessionRoute} ${styles.activeSessionControl}`}>
      <span className={accountStyles.settingsSessionLabel}>SESSION</span>
      <select
        className={`${accountStyles.settingsSessionName} ${styles.activeSessionSelect}`}
        aria-label="Active session"
        data-testid={E2E_TESTIDS.TOOL_EXPLORER_ACTIVE_SESSION}
        value={activeSessionSlug}
        title={options.find((option) => option.slug === activeSessionSlug)?.description}
        onFocus={refresh}
        onChange={(event) => {
          if (onUseInheritedSession && event.target.value === inheritedOptionValue) onUseInheritedSession();
          else onChange(event.target.value);
        }}
      >
        {onUseInheritedSession && (
          <option value={inheritedOptionValue}>Use global default ({inheritedSessionName})</option>
        )}
        {options.map((option) => (
          <option key={option.slug || 'general'} value={option.slug}>
            {option.slug === activeSessionSlug ? option.name : option.description}
          </option>
        ))}
      </select>
    </label>
  );
};

export default ToolExplorerSessionControl;
