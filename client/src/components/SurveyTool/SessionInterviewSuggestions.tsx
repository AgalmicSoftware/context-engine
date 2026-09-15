import React from 'react';
import CreateQuestionsAndSurveys from './CreateQuestionsAndSurveys';
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
    <details open className={`${styles.sessionInterviewReview} ${styles.sessionInterviewSuggestions}`}>
      <summary>
        <strong>Suggested new questions ({questions.length})</strong>
      </summary>
      <p>Review and edit these question drafts before creating them. They have not been added to the session.</p>
      <CreateQuestionsAndSurveys
        {...creatorProps}
        preformedQuestions={questions}
        preformedMode="questions"
        documentURLs={[]}
      />
    </details>
  );
}
