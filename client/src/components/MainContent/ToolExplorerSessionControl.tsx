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
  onChange,
}: {
  activeSessionSlug: string;
  sessionConfig: unknown;
  onChange: (slug: string) => void;
}) => {
  const [, refreshCatalog] = useState(0);
  const refresh = () => refreshCatalog((revision) => revision + 1);
  useEffect(() => {
    window.addEventListener(SESSION_REGISTRY_CACHE_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(SESSION_REGISTRY_CACHE_UPDATED_EVENT, refresh);
  }, []);

  const slugs = Array.from(
    new Set([activeSessionSlug, '', ...(getAllSessionSlugs({ includeEmpty: true }) || [])].map(normalizeSessionSlug)),
  );
  const options = slugs.map((slug) => {
    const config = resolveToolSessionConfig(slug, slug === activeSessionSlug ? sessionConfig : null);
    const name = slug ? toStr(config?.sessionName).trim() || slug : 'General';
    const description = slug && name.toLowerCase() !== slug ? `${name} (${slug})` : name;
    return { slug, name, description };
  });

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
        onChange={(event) => onChange(event.target.value)}
      >
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
