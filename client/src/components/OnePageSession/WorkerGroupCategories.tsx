import React, { useEffect, useId, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretRight, faCheck } from '@fortawesome/free-solid-svg-icons';
import {
  workerGroupMembersMayLeave,
  workerGroupNeedsSecret,
  type WorkerGroup,
} from '../../domains/worker/workerGroupPorts';
import WorkerGroupImage from '../Shared/WorkerGroupImage';
import type { WorkerGroupCategory, WorkerGroupEntry } from './workerGroupCategoryOrder';
import styles from './WorkerGroupCategories.module.scss';

// Side by side and all open from here up; one open at a time below.
const WIDE_QUERY = '(min-width: 992px)';
const SUMMARY_PICTURES = 4;

const matchWide = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(WIDE_QUERY) : null;

const useWide = (): boolean => {
  const [wide, setWide] = useState(() => Boolean(matchWide()?.matches));
  useEffect(() => {
    const query = matchWide();
    if (!query) return undefined;
    const update = () => setWide(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return wide;
};

export type WorkerGroupImageProps = {
  fetchImpl: typeof fetch;
  sessionConfig: unknown;
  sessionSlug: string;
  workerToken: string;
  workerUrl: string;
};

type WorkerGroupCategoriesProps = {
  categories: WorkerGroupCategory[];
  /** Categories open on a phone, kept by the list so a visit to a group's page comes back to them. */
  openKeys: string[];
  onToggle: (key: string) => void;
  groupJoinHasEnded: (group: WorkerGroup) => boolean;
  imageProps: WorkerGroupImageProps;
  onOpenDetails: (groupId: string) => void;
  /** Join, Leave or the code field, with a refused join's reason left to the row. */
  renderAction: (group: WorkerGroup, isMember: boolean, inlineProblem: boolean) => React.ReactNode;
  /** Why a group's last join was refused, '' when it wasn't. */
  problemFor: (groupId: string) => string;
  showDescriptions: boolean;
};

const Picture = ({ group, imageProps }: { group: WorkerGroup; imageProps: WorkerGroupImageProps }) => (
  <span className={styles.picture} aria-hidden="true">
    {group.imageUrl ? <WorkerGroupImage src={group.imageUrl} {...imageProps} /> : null}
  </span>
);

const WorkerGroupRow = ({
  entry,
  groupJoinHasEnded,
  imageProps,
  onOpenDetails,
  problemFor,
  renderAction,
  showDescriptions,
}: { entry: WorkerGroupEntry } & Omit<WorkerGroupCategoriesProps, 'categories' | 'openKeys' | 'onToggle'>) => {
  const { group, isMember } = entry;
  const id = useId().replace(/:/g, '');
  const codeId = `${id}-code`;
  const lineId = `${id}-line`;
  // An invite or password is typed under the row, so the row itself stays one line.
  const needsCode = !isMember && workerGroupNeedsSecret(group) && !groupJoinHasEnded(group);
  // A refusal shows where the person can read it, also after the sign-in a Join started has redrawn the list.
  const problem = isMember ? '' : problemFor(group.groupId);
  const [codeToggled, setCodeOpen] = useState(false);
  const codeOpen = codeToggled || Boolean(needsCode && problem);
  const line = isMember ? (
    <>
      <FontAwesomeIcon icon={faCheck} /> Joined
    </>
  ) : needsCode ? (
    'Needs an invite link or password'
  ) : showDescriptions ? (
    group.description
  ) : (
    ''
  );
  let action: React.ReactNode = null;
  if (needsCode) {
    action = (
      <button
        type="button"
        className={styles.codeButton}
        data-ce-control-appearance="frameless"
        aria-expanded={codeOpen}
        aria-controls={codeId}
        aria-label={`Enter code for ${group.label}`}
        onClick={() => setCodeOpen(!codeOpen)}
      >
        Enter code
      </button>
    );
  } else if (!isMember || workerGroupMembersMayLeave(group)) {
    action = renderAction(group, isMember, false);
  }
  return (
    <li className={styles.row}>
      <article id={`group-${encodeURIComponent(group.groupId)}`} className={styles.rowBody} aria-label={group.label}>
        <Picture group={group} imageProps={imageProps} />
        <button
          type="button"
          className={styles.rowName}
          data-ce-control-appearance="frameless"
          onClick={() => onOpenDetails(group.groupId)}
          aria-label={`Open group details for ${group.label}`}
          aria-describedby={line ? lineId : undefined}
        >
          <span className={styles.name}>{group.label}</span>
          {line ? (
            <span id={lineId} className={isMember ? styles.joined : styles.line}>
              {line}
            </span>
          ) : null}
        </button>
        {action ? <div className={styles.action}>{action}</div> : null}
        {needsCode ? (
          <div id={codeId} className={styles.wide} hidden={!codeOpen}>
            {codeOpen ? renderAction(group, false, true) : null}
          </div>
        ) : problem ? (
          <span className={`${styles.wide} ${styles.problem}`} role="alert">
            {problem}
          </span>
        ) : null}
      </article>
    </li>
  );
};

const Summary = ({ category, imageProps }: { category: WorkerGroupCategory; imageProps: WorkerGroupImageProps }) => {
  const joined = category.entries.filter((entry) => entry.isMember);
  const shown = (joined.length ? joined : category.entries).slice(0, SUMMARY_PICTURES);
  return (
    <span className={styles.summary}>
      <span className={styles.summaryPictures}>
        {shown.map(({ group }) => (
          <Picture key={group.groupId} group={group} imageProps={imageProps} />
        ))}
      </span>
      <span className={joined.length ? styles.summaryJoined : styles.summaryCount}>
        {joined.length
          ? joined.map(({ group }) => group.label).join(', ')
          : `${category.entries.length} ${category.entries.length === 1 ? 'group' : 'groups'}`}
      </span>
    </span>
  );
};

/** A session's groups by category: side by side and all open on a wide screen, an accordion on a phone. */
const WorkerGroupCategories = ({ categories, openKeys, onToggle, ...rowProps }: WorkerGroupCategoriesProps) => {
  const wide = useWide();
  const baseId = useId().replace(/:/g, '');
  return (
    <div className={wide ? styles.columns : styles.accordion} data-testid="ce-session-worker-group-categories">
      {categories.map((category, index) => {
        const headingId = `${baseId}-${index}-heading`;
        const listId = `${baseId}-${index}-groups`;
        const open =
          wide ||
          openKeys.includes(category.key) ||
          category.entries.some((entry) => !entry.isMember && rowProps.problemFor(entry.group.groupId));
        const count = `${category.entries.length} ${category.entries.length === 1 ? 'group' : 'groups'}`;
        return (
          <div key={`tag:${category.key}`} className={styles.category}>
            <h3 className={styles.heading} id={headingId}>
              {wide ? (
                <span className={styles.headingStatic}>
                  <span className={styles.headingName}>{category.name}</span>
                  <span className={styles.summaryCount}>{count}</span>
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.toggle}
                  data-ce-control-appearance="frameless"
                  aria-expanded={open}
                  aria-controls={listId}
                  onClick={() => onToggle(category.key)}
                >
                  <FontAwesomeIcon icon={faCaretRight} className={styles.caret} />
                  <span className={styles.headingName}>{category.name}</span>
                  {open ? (
                    <span className={styles.summaryCount}>{count}</span>
                  ) : (
                    <Summary category={category} imageProps={rowProps.imageProps} />
                  )}
                </button>
              )}
            </h3>
            <ul id={listId} className={styles.rows} hidden={!open} aria-labelledby={headingId}>
              {open
                ? category.entries.map((entry) => (
                    <WorkerGroupRow key={entry.group.groupId} entry={entry} {...rowProps} />
                  ))
                : null}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

export default WorkerGroupCategories;
