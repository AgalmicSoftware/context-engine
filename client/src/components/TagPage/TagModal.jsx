import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';

import styles from './TagPage.module.scss';
import TagPage from './TagPage.jsx';

const buildEmptyQuestionsText = (selectedTags = []) => {
  if (selectedTags.length === 1) {
    return `No questions tagged ${selectedTags[0]} in this session yet.`;
  }

  return 'No questions found for this tag comparison yet.';
};

const TagModal = ({
  isOpen,
  toggle,
  activeTag,
  demoCorpusMode = false,
  demoCorpusRecords = [],
}) => {
  const normalizedActiveTag = String(activeTag || '').trim();
  const [selectedTags, setSelectedTags] = useState([]);

  useEffect(() => {
    setSelectedTags(normalizedActiveTag ? [normalizedActiveTag] : []);
  }, [normalizedActiveTag]);

  const emptyQuestionsText = useMemo(
    () => buildEmptyQuestionsText(selectedTags),
    [selectedTags]
  );

  const handleSelectedTagsChange = (nextTags = []) => {
    const normalizedNextTags = (Array.isArray(nextTags) ? nextTags : [])
      .map((tag) => String(tag || '').trim())
      .filter(Boolean);

    if (!normalizedNextTags.length) {
      toggle();
      return;
    }

    setSelectedTags(normalizedNextTags);
  };

  const closeButton = (
    <button
      type="button"
      className={styles.tagModalCloseButton}
      onClick={toggle}
      aria-label="Close tag explorer"
    >
      <span aria-hidden="true">×</span>
    </button>
  );

  return (
    <Modal
      isOpen={isOpen}
      toggle={toggle}
      modalClassName={styles.tagModal}
      contentClassName={styles.tagModalContent}
      backdropClassName={styles.tagModalBackdrop}
      wrapClassName={styles.tagModalWrap}
    >
      <ModalHeader
        toggle={toggle}
        className={styles.tagModalHeaderBar}
        close={closeButton}
      >
        Tag explorer
      </ModalHeader>
      <ModalBody className={styles.tagModalBody}>
        {isOpen && selectedTags.length ? (
          <TagPage
            embedded={true}
            demoCorpusMode={demoCorpusMode}
            demoCorpusRecords={demoCorpusRecords}
            selectedTagsOverride={selectedTags}
            onSelectedTagsChange={handleSelectedTagsChange}
            emptyQuestionsText={emptyQuestionsText}
          />
        ) : null}
      </ModalBody>
    </Modal>
  );
};

export default TagModal;
