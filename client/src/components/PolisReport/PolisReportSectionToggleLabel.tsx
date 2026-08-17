import React from 'react';
import styles from './PolisReport.module.scss';

const PolisReportSectionToggleLabel = ({ open }: { open: boolean }) => (
  <>
    {open ? 'Hide' : 'Show'}
    {!open ? (
      <span className={styles.showWhenPdf} style={{ marginLeft: '10px', color: 'var(--ce-document-text-muted)' }}>
        (Omitted)
      </span>
    ) : null}
  </>
);

export default PolisReportSectionToggleLabel;
