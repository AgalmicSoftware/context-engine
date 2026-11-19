import { useState } from 'react';
import { Input } from 'reactstrap';

import { CONTEXT_CARD_LIMITS, contextCardContent } from '@ce-shared/contextCards.mjs';
import { SetupField } from '../Sessions/setup/SetupPrimitives';
import setupStyles from '../Sessions/setup/SessionSetup.module.scss';
import {
  setContextCard,
  type ContextSource,
  type ContextSourceOptions,
} from '../../utilities/docLibrary/contextSources';

export const CONTEXT_CARD_HELP =
  'A card says what a file or link is about: a short summary, a few topic tags and the names it is chiefly about. ' +
  'People see the tags, and when the session’s AI can’t read every file it is shown the cards of the ones it didn’t read. ' +
  'A card goes only to people who can open the file or link itself.';
const LIST_HELP = 'Separate with commas.';

const splitList = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

type Props = {
  source: Pick<ContextSource, 'id' | 'title' | 'card'>;
  options: ContextSourceOptions;
  onSaved: () => void;
  onClose: () => void;
};

// One source's card as a person writes it. What is saved is cut to the card's
// limits, as the Worker cuts it; a card with nothing in it is taken off.
const ContextCardEditor = ({ source, options, onSaved, onClose }: Props) => {
  const [summary, setSummary] = useState(source.card?.summary || '');
  const [tags, setTags] = useState((source.card?.tags || []).join(', '));
  const [names, setNames] = useState((source.card?.names || []).join(', '));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = `ce-context-card-edit-${source.id}`;
  const save = async (card: ReturnType<typeof contextCardContent>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await setContextCard(source.id, card, options);
      onSaved();
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'That did not work. Try again.');
      setBusy(false);
    }
  };
  return (
    <div className={setupStyles.listRowBody} data-testid="ce-context-card-editor">
      <SetupField id={`${id}-summary`} label="Summary" help={CONTEXT_CARD_HELP}>
        <Input
          id={`${id}-summary`}
          type="textarea"
          rows={3}
          value={summary}
          maxLength={CONTEXT_CARD_LIMITS.summaryChars}
          onChange={(event) => setSummary(event.target.value)}
        />
      </SetupField>
      <SetupField id={`${id}-tags`} label={`Topic tags (up to ${CONTEXT_CARD_LIMITS.tags})`} help={LIST_HELP}>
        <Input id={`${id}-tags`} value={tags} onChange={(event) => setTags(event.target.value)} />
      </SetupField>
      <SetupField id={`${id}-names`} label={`Key names (up to ${CONTEXT_CARD_LIMITS.names})`} help={LIST_HELP}>
        <Input id={`${id}-names`} value={names} onChange={(event) => setNames(event.target.value)} />
      </SetupField>
      <div className={setupStyles.buttonRow}>
        <button
          type="button"
          className={setupStyles.button}
          disabled={busy}
          onClick={() => void save(contextCardContent({ summary, tags: splitList(tags), names: splitList(names) }))}
        >
          Save card
        </button>
        {source.card ? (
          <button type="button" className={setupStyles.button} disabled={busy} onClick={() => void save(null)}>
            Remove card
          </button>
        ) : null}
        <button type="button" className={setupStyles.button} disabled={busy} onClick={onClose}>
          Cancel
        </button>
      </div>
      {error ? (
        <p className={setupStyles.errorText} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export default ContextCardEditor;
