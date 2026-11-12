import { useState } from 'react';
import { Input } from 'reactstrap';

import { CONTEXT_SOURCE_LIMITS } from '@ce-shared/sessionContextSources.mjs';
import { SetupField } from '../Sessions/setup/SetupPrimitives';
import setupStyles from '../Sessions/setup/SessionSetup.module.scss';
import { addContextLink } from '../../utilities/docLibrary/contextSources';

type Props = {
  sessionSlug: string;
  sessionConfig: Record<string, unknown> | null;
  account: string;
  onAdded: () => void;
};

const ABOUT_LINK =
  'The Session Worker reads the page now and keeps its text for the session’s AI. Everyone in the session sees the link. Use https:// links to public pages.';

// A participant's link for the session's context, which everyone in the session sees.
const SessionContextAddLink = ({ sessionSlug, sessionConfig, account, onAdded }: Props) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const add = async () => {
    if (!url.trim() || busy) return;
    setBusy(true);
    setStatus('Reading the page…');
    try {
      await addContextLink(
        { url: url.trim(), title: title.trim() },
        { sessionSlug, sessionConfig, context: { account } },
      );
      setUrl('');
      setTitle('');
      setStatus('Link added.');
      onAdded();
    } catch (failure) {
      setStatus(failure instanceof Error ? failure.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={setupStyles.listRowBody} data-testid="ce-session-context-add-link">
      <SetupField id="ce-session-context-link-url" label="Link" help={ABOUT_LINK}>
        <Input
          id="ce-session-context-link-url"
          type="url"
          value={url}
          maxLength={CONTEXT_SOURCE_LIMITS.urlChars}
          placeholder="https://"
          onChange={(event) => setUrl(event.target.value)}
        />
      </SetupField>
      <SetupField id="ce-session-context-link-title" label="Link title">
        <Input
          id="ce-session-context-link-title"
          value={title}
          maxLength={CONTEXT_SOURCE_LIMITS.titleChars}
          placeholder="The page’s own title"
          onChange={(event) => setTitle(event.target.value)}
        />
      </SetupField>
      <div className={setupStyles.buttonRow}>
        <button type="button" className={setupStyles.button} disabled={busy || !url.trim()} onClick={() => void add()}>
          Add link
        </button>
      </div>
      {status ? (
        <p className={setupStyles.statusText} role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
};

export default SessionContextAddLink;
