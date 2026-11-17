/** @file WorkerGroupsLoading.tsx */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import styles from './OnePageSession.module.scss';

/** The groups' loading state: the report's centred spinner. Its title names it for screen readers; an aria-label
 * alone would sit under the aria-hidden that Font Awesome adds. Kept apart from the
 * group panels so their lazy chunks stay out of the fallback. */
export default function WorkerGroupsLoading({ label = 'Loading groups' }: { label?: string }) {
  return (
    <div className={styles.workerGroupsLoadingState} role="status">
      <FontAwesomeIcon icon={faSpinner} spin size="4x" title={label} />
    </div>
  );
}
