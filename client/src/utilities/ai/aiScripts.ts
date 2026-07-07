/** naming-migration alias, remove per PRD 653/654. */
import * as aiClientModule from './aiClient.js';

export const TRANSCRIBE_MAX_UPLOAD_BYTES = aiClientModule.TRANSCRIBE_MAX_UPLOAD_BYTES;
export const isE2eAiMockEnabled = aiClientModule.isE2eAiMockEnabled;
export const analyzePhotoForQuestionGeneration = aiClientModule.analyzePhotoForQuestionGeneration;
export const setVadTrimEnabled = aiClientModule.setVadTrimEnabled;
export const setVadTrimConfig = aiClientModule.setVadTrimConfig;
export const callAI = aiClientModule.callAI;
export const callAIQueued = aiClientModule.callAIQueued;
export const fetchContentFromURL = aiClientModule.fetchContentFromURL;
export const processAdditionalSources = aiClientModule.processAdditionalSources;
export const analyzeSurveyResponses = aiClientModule.analyzeSurveyResponses;
export const rankQuestionsAI = aiClientModule.rankQuestionsAI;
export const requestAiRewrite = aiClientModule.requestAiRewrite;
export const transcribeAudio = aiClientModule.transcribeAudio;
export const analyzeClusterOpinions = aiClientModule.analyzeClusterOpinions;
export const analyzeUserOpinions = aiClientModule.analyzeUserOpinions;
export const drillDownComparisonPoint = aiClientModule.drillDownComparisonPoint;
export const drillDownComparisonTree = aiClientModule.drillDownComparisonTree;
export const runCompareToolkit = aiClientModule.runCompareToolkit;
export const getComparisonBundle = aiClientModule.getComparisonBundle;
export const generateAudioDiscussionSummary = aiClientModule.generateAudioDiscussionSummary;
export const uploadMarkdownSummaryToArweave = aiClientModule.uploadMarkdownSummaryToArweave;
export const extractSpeechAudio = aiClientModule.extractSpeechAudio;
