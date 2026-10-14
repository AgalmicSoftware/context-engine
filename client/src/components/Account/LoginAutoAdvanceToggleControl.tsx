import { Button } from 'reactstrap';
import styles from './Account.module.scss';

const LoginAutoAdvanceToggleControl = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
  <div className={styles.autoAdvanceSetting}>
    <Button
      type="button"
      onClick={onToggle}
      className={`${styles.sendTestnetFundsButton} ${styles.aiSettingsToggleButton} ${styles.preferenceToggleButton}`}
      aria-pressed={enabled}
      aria-label={`Auto-advance ${enabled ? 'On' : 'Off'}`}
      data-testid="ce-settings-auto-advance"
    >
      <span className={styles.preferenceToggleLabel}>Auto-advance</span>
      <span className={styles.preferenceToggleTrack} aria-hidden="true">
        <span className={styles.preferenceToggleThumb} />
      </span>
      <span className={styles.preferenceToggleState} aria-hidden="true">
        {enabled ? 'On' : 'Off'}
      </span>
    </Button>
    <span>Move to the next question after a binary or single-choice answer.</span>
  </div>
);

export default LoginAutoAdvanceToggleControl;
