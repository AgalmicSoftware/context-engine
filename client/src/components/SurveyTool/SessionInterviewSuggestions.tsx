import React from 'react';
import CreateQuestionsAndSurveys from './CreateQuestionsAndSurveys';
import SessionInterviewReviewSection from './SessionInterviewReviewSection';
import styles from './SurveyTool.module.scss';
import type { GeneratedSurveyStatement } from './SurveyGenerator/surveyGeneratorHelpers';

type CreatorProps = React.ComponentProps<typeof CreateQuestionsAndSurveys>;
export default function SessionInterviewSuggestions({
  questions,
  creatorProps,
  hidden,
}: {
  questions: GeneratedSurveyStatement[];
  hidden?: boolean;
  creatorProps: Partial<CreatorProps>;
}) {
  return (
    <SessionInterviewReviewSection
      hidden={hidden}
      title={`Suggested new questions (${questions.length})`}
      className={styles.sessionInterviewSuggestions}
      helpId="ce-interview-suggestions-help"
      help="Review and edit these question drafts and tags before uploading them. They have not been added to the session."
    >
      <CreateQuestionsAndSurveys
        {...creatorProps}
        preformedQuestions={questions}
        preformedMode="questions"
        interviewQuestionReview
        questionSubmitLabel="Upload Questions"
        submitClassName={styles.sessionInterviewSubmitButton}
        documentURLs={[]}
      />
    </SessionInterviewReviewSection>
  );
}
