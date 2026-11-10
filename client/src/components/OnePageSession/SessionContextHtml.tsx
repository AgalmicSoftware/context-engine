import React from 'react';
import { cleanContextHtml } from '../../utilities/session/contextHtml';
import styles from './SessionContextHtml.module.scss';

type Props = {
  html: string;
  testId?: string;
  /** In the context section's own frame and colour scheme, as the setup page's preview needs. */
  framed?: boolean;
  colorSchemeId?: string;
};

/**
 * An admin's uploaded context page. It is cleaned again on every render,
 * because stored HTML is untrusted: set-config and MCP can write it directly.
 */
const SessionContextHtml = ({ html, testId = 'ce-session-context-html', framed = false, colorSchemeId }: Props) => {
  const clean = React.useMemo(() => cleanContextHtml(html).html, [html]);
  const page = <div className={styles.contextHtml} data-testid={testId} dangerouslySetInnerHTML={{ __html: clean }} />;
  return framed ? (
    <div className={styles.frame} data-ce-session-color-scheme={colorSchemeId}>
      {page}
    </div>
  ) : (
    page
  );
};

export default SessionContextHtml;
