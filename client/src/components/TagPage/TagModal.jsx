import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';

import styles from '../DemoViews/CorpusViewer.module.scss';
import TagPage from './TagPage.jsx';

const buildEmptyQuestionsText = (selectedTags = []) => {
  if (selectedTags.length === 1) {
    return `No questions tagged ${selectedTags[0]} in this session yet.`;
  }

  return 'No questions found for this tag comparison yet.';
};

const TagModal = ({ isOpen, toggle, activeTag }) => {
  const normalizedActiveTag = String(activeTag || '').trim();
  const [selectedTags, setSelectedTags] = useState([]);

  useEffect(() => {
    setSelectedTags(normalizedActiveTag ? [normalizedActiveTag] : []);
  }, [normalizedActiveTag]);

  const modalTitle = useMemo(() => {
    if (!selectedTags.length) return 'Tag explorer';
    return selectedTags.map((tag) => `#${tag}`).join(' + ');
  }, [selectedTags]);

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

  return (
    <Modal
      isOpen={isOpen}
      toggle={toggle}
      centered
      scrollable
      size="xl"
      modalClassName={styles.tagModal}
    >
      <ModalHeader toggle={toggle}>{modalTitle}</ModalHeader>
      <ModalBody>
        {isOpen && selectedTags.length ? (
          <TagPage
            embedded={true}
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
