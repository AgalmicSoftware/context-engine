import { useState } from 'react';
import { Button, FormGroup, FormText, Input, Label } from 'reactstrap';
import styles from './AdminPage.module.scss';

type StorageVisibilityResource = 'questions' | 'surveys';

export type AdminStorageVisibilityPanelProps = {
  canAdminWorker: boolean;
  sessionSlug: string;
  postSignedRequest: (args: {
    action: string;
    path: string;
    body: Record<string, unknown>;
  }) => Promise<{ data?: unknown }>;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

// Admins usually copy a /question/<id> or /survey/<id> link; accept either a
// link or a bare id.
const parseTarget = (
  value: string,
  fallbackResource: StorageVisibilityResource,
): { id: string; resource: StorageVisibilityResource } => {
  const match = value.trim().match(/\/(question|survey)\/([^/?#\s]+)/i);
  if (!match) return { id: value.trim().toLowerCase(), resource: fallbackResource };
  let id = match[2];
  try {
    id = decodeURIComponent(id);
  } catch {
    // A malformed escape is left as typed; the Worker rejects an invalid id.
  }
  return {
    id: id.toLowerCase(),
    resource: match[1].toLowerCase() === 'survey' ? 'surveys' : 'questions',
  };
};

const AdminStorageVisibilityPanel = ({
  canAdminWorker,
  sessionSlug,
  postSignedRequest,
}: AdminStorageVisibilityPanelProps) => {
  const [resource, setResource] = useState<StorageVisibilityResource>('questions');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  const submit = async (hidden: boolean) => {
    const parsed = parseTarget(target, resource);
    if (!parsed.id) return;
    setResource(parsed.resource);
    setBusy(true);
    setStatus('');
    setError('');
    try {
      const { data } = await postSignedRequest({
        action: 'storage/set-hidden',
        path: '/admin/storage/set-hidden',
        body: { sessionSlug, resource: parsed.resource, id: parsed.id, hidden },
      });
      const result = asRecord(data);
      const label = parsed.resource === 'questions' ? 'Question' : 'Survey';
      setHiddenIds(Array.isArray(result.hiddenIds) ? result.hiddenIds.map(String) : []);
      setStatus(
        `${label} ${parsed.id} is ${hidden ? 'hidden' : 'visible again'}. Updated ${Number(result.matchedRows || 0)} stored version(s).`,
      );
    } catch (failure: unknown) {
      const message = failure instanceof Error ? failure.message : String(failure || '');
      setError(
        /unknown admin action/i.test(message)
          ? 'This session Worker cannot hide questions or surveys yet. Update the session Worker first.'
          : message || 'Could not change visibility.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.panel} data-testid="ce-admin-storage-visibility">
      <div className={styles.panelTitle}>Hide questions or surveys</div>
      <div className={styles.panelSubtitle}>
        Hidden questions and surveys leave the session lists, the interview catalog, and generated results. The stored
        records stay, so you can unhide them later.
      </div>
      {!canAdminWorker ? (
        <div className={styles.statusNote}>
          Connect the configured worker admin wallet to hide questions or surveys.
        </div>
      ) : (
        <>
          <FormGroup>
            <Label for="admin-storage-visibility-resource">Type</Label>
            <Input
              id="admin-storage-visibility-resource"
              type="select"
              value={resource}
              onChange={(event) => setResource(event.target.value === 'surveys' ? 'surveys' : 'questions')}
              disabled={busy}
            >
              <option value="questions">Question</option>
              <option value="surveys">Survey</option>
            </Input>
          </FormGroup>
          <FormGroup>
            <Label for="admin-storage-visibility-id">Id or link</Label>
            <Input
              id="admin-storage-visibility-id"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="0x… or a /question/… or /survey/… link"
              autoComplete="off"
              disabled={busy}
            />
            <FormText>Paste the question or survey link, or just its id.</FormText>
          </FormGroup>
          <div className={styles.formRow}>
            <Button
              color="danger"
              outline
              className={styles.actionButton}
              disabled={busy || !target.trim()}
              onClick={() => void submit(true)}
              data-testid="ce-admin-storage-visibility-hide"
            >
              Hide
            </Button>
            <Button
              color="secondary"
              outline
              className={styles.actionButton}
              disabled={busy || !target.trim()}
              onClick={() => void submit(false)}
              data-testid="ce-admin-storage-visibility-unhide"
            >
              Unhide
            </Button>
          </div>
          {status && (
            <div className={styles.statusNote} role="status">
              {status}
            </div>
          )}
          {error && (
            <div className={styles.warningNote} role="alert">
              {error}
            </div>
          )}
          {hiddenIds.length > 0 && (
            <div className={styles.statusNote}>
              Hidden {resource === 'questions' ? 'questions' : 'surveys'}: {hiddenIds.join(', ')}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default AdminStorageVisibilityPanel;
