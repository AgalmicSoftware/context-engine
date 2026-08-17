import type { ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './UserPage.module.scss';

type CompareSubjectInputListProps = {
  onAddSubject: () => void;
  renderSubjectInput: (subjectValue: string, index: number) => ReactNode;
  subjectValues: string[];
};

const CompareSubjectInputList = ({ onAddSubject, renderSubjectInput, subjectValues }: CompareSubjectInputListProps) => (
  <>
    <div className={styles.addrInputsContainer}>
      {subjectValues.map((subjectValue, index) => (
        <div key={index} className={styles.addressInput}>
          {renderSubjectInput(subjectValue, index)}
        </div>
      ))}
    </div>
    <div className={styles.addAddressRow}>
      <button
        type="button"
        className={styles.addAddressBtn}
        onClick={onAddSubject}
        data-testid={E2E_TESTIDS.COMPARE_ADD_ADDRESS}
      >
        <FontAwesomeIcon icon={faPlus} /> Add Subject
      </button>
    </div>
  </>
);

export default CompareSubjectInputList;
