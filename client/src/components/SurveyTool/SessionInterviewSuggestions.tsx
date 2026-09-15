import React from 'react';
import CreateQuestionsAndSurveys from './CreateQuestionsAndSurveys';
import SessionInterviewReviewSection from './SessionInterviewReviewSection';
import styles from './SurveyTool.module.scss';
import type { GeneratedSurveyStatement } from './SurveyGenerator/surveyGeneratorHelpers';

type CreatorProps = React.ComponentProps<typeof CreateQuestionsAndSurveys>;
export default function SessionInterviewSuggestions({
  questions,
  creatorProps,
}: {
  questions: GeneratedSurveyStatement[];
  creatorProps: Partial<CreatorProps>;
}) {
  return (
    <SessionInterviewReviewSection
      title={`Suggested new questions (${questions.length})`}
      className={styles.sessionInterviewSuggestions}
    >
      <p>Review and edit these question drafts before uploading them. They have not been added to the session.</p>
      <CreateQuestionsAndSurveys
        {...creatorProps}
        preformedQuestions={questions}
        preformedMode="questions"
        questionSubmitLabel="Upload Questions"
        submitClassName={styles.sessionInterviewSubmitButton}
        documentURLs={[]}
      />
    </SessionInterviewReviewSection>
  );
}
