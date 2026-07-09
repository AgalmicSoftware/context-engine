import type { SurveyQuestionsLegacyRecord, SurveyQuestionsLegacyValue } from './surveyQuestionsTypes.js';

export type SurveyQuestionsRenderRuntime = SurveyQuestionsLegacyRecord;

export const createSurveyQuestionsRenderRuntime = (
  context: SurveyQuestionsLegacyRecord,
): SurveyQuestionsRenderRuntime => {
  const {
    SingleQuestionResponse,
    SurveyQuestionsSurveyAnswersView,
    getActiveSessionSlugFromProps,
    getCommentsOpen,
    getQuestionRenderDisplayState,
    handleDecryptQuestionAnswer,
    handleReloadMaskedPrompt,
    inst,
    isQuestionFieldBusy,
    isQuestionPromptMasked,
    propsRef,
    renderFullQuestionAdditionalInput,
    renderFullQuestionCardIcons,
    renderFullQuestionCardShell,
    renderFullQuestionFooterIcons,
    renderFullQuestionResponseInput,
    renderFullQuestionSliderSection,
    renderQuestionAdditionalLockControl,
    renderQuestionAnswerLockControl,
    renderQuestionFieldDecryptControl,
    renderQuestionMaskedPromptCard,
    renderSurveyQuestionsFullQuestionDisplay,
    resolveEffectiveSlug,
    shouldShowSingleQuestionResponseLookupSpinner,
    stateRef,
    surveyLog,
    toggleComments,
  } = context;

  const renderQuestion = (
    question: SurveyQuestionsLegacyValue,
    qIndex: SurveyQuestionsLegacyValue,
    currentSurveyResponseState: SurveyQuestionsLegacyValue,
  ) => {
    if (!currentSurveyResponseState || !currentSurveyResponseState.answers) {
      surveyLog.warn(
        'renderQuestion: currentSurveyResponseState or its answers property is undefined/null. Question ID:',
        question?.id,
      );
      return null;
    }

    if (!question || !question.id || !question.type) {
      surveyLog.error('Invalid question data at index:', qIndex, question);
      return null;
    }

    const surveyIndex: SurveyQuestionsLegacyValue =
      propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : propsRef.current.surveyIndex;
    const displayState: SurveyQuestionsLegacyValue = getQuestionRenderDisplayState({
      questionId: question.id,
      responseSlice: currentSurveyResponseState,
    });
    const sliderOpen: SurveyQuestionsLegacyValue = !!stateRef.current.sliderToggleExpandedByQuestion?.[question.id];

    const cardKey: SurveyQuestionsLegacyValue = String(question.id || '');
    const showResponseLookupSpinner: SurveyQuestionsLegacyValue = shouldShowSingleQuestionResponseLookupSpinner({
      singleQuestionMode: propsRef.current.singleQuestionMode,
      isLoadingResponse: stateRef.current.isLoadingResponse,
      account: propsRef.current.account,
      viewAddress: propsRef.current.viewAddress,
      responderAddress: propsRef.current.responderAddress,
    });
    const isQuestionBookmarked: SurveyQuestionsLegacyValue = stateRef.current.bookmarkedQuestions.has(question.id);

    const cardIcons: SurveyQuestionsLegacyValue = renderFullQuestionCardIcons({
      question,
      showResponseLookupSpinner,
      isQuestionBookmarked,
    });

    // If the prompt is still masked, do not allow answering (prevents nonsense submits).
    // This primarily affects direct-link `/question/:id?...` flows; list views filter these out.
    const promptMasked: SurveyQuestionsLegacyValue = isQuestionPromptMasked(question);
    if (promptMasked) {
      return renderQuestionMaskedPromptCard({
        mode: 'full',
        cardKey,
        question,
        cardIcons,
      });
    }

    return renderSurveyQuestionsFullQuestionDisplay({
      cardKey,
      question,
      cardIcons,
      commentsOpen: getCommentsOpen(question.id, displayState.hasAdditionalContent),
      displayState,
      onToggleComments: toggleComments,
      qIndex,
      renderAdditionalDecryptControl: renderQuestionFieldDecryptControl,
      renderAdditionalInput: renderFullQuestionAdditionalInput,
      renderAdditionalLockControl: renderQuestionAdditionalLockControl,
      renderAnswerDecryptControl: renderQuestionFieldDecryptControl,
      renderFullQuestionCardShell: renderFullQuestionCardShell,
      renderFullQuestionFooterIcons: renderFullQuestionFooterIcons,
      renderFullQuestionSliderSection: renderFullQuestionSliderSection,
      renderResponseInput: renderFullQuestionResponseInput,
      sliderOpen,
      surveyIndex,
    });
  };

  const renderQuestionAnswer = (
    question: SurveyQuestionsLegacyValue,
    response: SurveyQuestionsLegacyValue,
    index: SurveyQuestionsLegacyValue,
    isOwnResponse: SurveyQuestionsLegacyValue,
  ) => {
    if (!question || !response) {
      surveyLog.warn('renderQuestionAnswer: question or response is undefined');
      return null;
    }
    const promptReloading: SurveyQuestionsLegacyValue = isQuestionFieldBusy(question.id, 'prompt');
    return (
      <SingleQuestionResponse
        key={`fullQ-${question.id}-${index}`}
        question={question}
        response={response}
        isOwnResponse={isOwnResponse}
        canDecryptOtherResponses={stateRef.current.canDecryptOtherResponses}
        mode="fullscreen"
        sessionSlug={inst._getEffectiveDraftSlug() || resolveEffectiveSlug(propsRef.current)}
        activeSessionSlug={getActiveSessionSlugFromProps(propsRef.current)}
        onDecryptQuestion={handleDecryptQuestionAnswer}
        onReloadQuestionPrompt={handleReloadMaskedPrompt}
        promptReloading={promptReloading}
        showImportance={true}
        provider={propsRef.current.provider}
        questionResponsesNonce={propsRef.current.questionResponsesNonce}
        questionsCacheNonce={propsRef.current.questionsCacheNonce || stateRef.current.questionsCacheNonce}
        sbtCacheRevision={propsRef.current.sbtCacheRevision}
      />
    );
  };

  const renderSurveyAnswers = (responses: SurveyQuestionsLegacyValue, isOwnResponse: SurveyQuestionsLegacyValue) => {
    return (
      <SurveyQuestionsSurveyAnswersView
        isOwnResponse={isOwnResponse}
        onWarning={(...args: SurveyQuestionsLegacyValue[]) => surveyLog.warn(...args)}
        questionPool={stateRef.current.questionPool}
        renderQuestionAnswer={renderQuestionAnswer}
        responses={responses}
      />
    );
  };

  return {
    renderQuestion,
    renderQuestionAnswer,
    renderSurveyAnswers,
  };
};
