import React from 'react';
import { faUsers } from '@fortawesome/free-solid-svg-icons';
import { QuestionFilterCollapsibleSection } from './QuestionFilterSections';
import { useWorkerGroupResultsFilter } from '../../domains/worker/useWorkerGroupResultsFilter';
import {
  asGroupRecord,
  hasWorkerGroupSelection,
  GROUP_FILTER_ROLES,
  type GroupFilterRole,
  type GroupSelection,
} from '../../domains/worker/workerGroupResultsFilter';
import styles from './WorkerGroupResultsFilterControls.module.scss';

const labels: Record<GroupFilterRole, string> = {
  creatorInclude: 'Include question creators',
  creatorExclude: 'Exclude question creators',
  responderInclude: 'Include responders',
  responderExclude: 'Exclude responders',
};
export default function WorkerGroupResultsFilterControls({
  sessionConfig,
  sessionSlug,
  account,
  provider,
  value,
  onChange,
  expandedSections,
  onToggleSection,
  discover,
}: {
  sessionConfig: unknown;
  sessionSlug: string;
  account: unknown;
  provider: unknown;
  value: unknown;
  onChange: (value: unknown) => void;
  expandedSections: Record<string, unknown>;
  onToggleSection: (section: string) => void;
  discover: boolean;
}) {
  const { enabled, scope, cohort, groups, refresh } = useWorkerGroupResultsFilter({
    sessionConfig,
    sessionSlug,
    account,
    provider,
    selection: value,
    discover,
  });
  if (!enabled) return null;
  const selected = asGroupRecord(value);
  const update = (role: GroupFilterRole, entries: GroupSelection[]) => {
    if (!scope) return;
    const next = {
      // Removing one saved selection must not rebind the remaining Groups to a new session.
      ...(hasWorkerGroupSelection(value)
        ? { sessionId: selected.sessionId, sessionSlug: selected.sessionSlug, workerUrl: selected.workerUrl }
        : scope),
      ...Object.fromEntries(GROUP_FILTER_ROLES.map((key) => [key, selected[key] || []])),
      [role]: entries,
    };
    onChange(hasWorkerGroupSelection(next) ? next : null);
  };
  return (
    <QuestionFilterCollapsibleSection
      title="Groups"
      sectionKey="workerGroups"
      icon={faUsers}
      expandedSections={expandedSections}
      onToggleSection={onToggleSection}
      headerTestId="ce-results-group-filter-toggle"
      content={
        <div className={styles.controls} data-testid="ce-results-group-filter">
          <p>Match any included Group. Excluded Groups take priority.</p>
          {cohort.message && <p role={cohort.status === 'error' ? 'alert' : 'status'}>{cohort.message}</p>}
          <div className={styles.fields}>
            {GROUP_FILTER_ROLES.map((role) => {
              const entries: GroupSelection[] = (Array.isArray(selected[role]) ? selected[role] : [])
                .map(asGroupRecord)
                .filter((entry) => typeof entry.groupId === 'string')
                .map((entry) => ({ groupId: String(entry.groupId), label: String(entry.label || entry.groupId) }));
              return (
                <div key={role} className={styles.field}>
                  <label>
                    <span>{labels[role]}</span>
                    <select
                      aria-label={labels[role]}
                      value=""
                      disabled={!scope || !account || cohort.status === 'loading'}
                      onChange={(event) => {
                        const group = groups.find((item) => item.groupId === event.target.value);
                        if (group) update(role, [...entries, { groupId: group.groupId, label: group.label }]);
                      }}
                    >
                      <option value="">Choose a Group…</option>
                      {groups
                        .filter((group) => !entries.some((entry) => entry.groupId === group.groupId))
                        .map((group) => (
                          <option key={group.groupId} value={group.groupId}>
                            {group.label}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className={styles.selections}>
                    {entries.map((entry) => (
                      <button
                        type="button"
                        key={entry.groupId}
                        onClick={() =>
                          update(
                            role,
                            entries.filter((item) => item.groupId !== entry.groupId),
                          )
                        }
                        aria-label={`Remove ${entry.label} from ${labels[role].toLowerCase()}`}
                      >
                        {entry.label} ×
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {cohort.status === 'ready' && discover && groups.length === 0 && <p>No readable Groups in this session.</p>}
          <div className={styles.actions}>
            <button type="button" onClick={refresh} disabled={!account}>
              Refresh Groups
            </button>
            {value != null && (
              <button type="button" onClick={() => onChange(null)}>
                Clear Group filters
              </button>
            )}
          </div>
        </div>
      }
    />
  );
}
