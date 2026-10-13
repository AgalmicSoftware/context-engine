// The demo-session data read from the checked-in fixture JSON. Session routes
// reach it only through demoSessionFixtureLoader, and only for demo sessions.
export { getPolisDemoQuestionPool } from './surveyPolisDemoQuestionPool';
export { buildPolisDemoSurveyResultsAggregatorData } from './surveyPolisDemoResultsData';
export { resolveDemoPolisDataset } from '../../utilities/demo/demoPolisDatasets';
export {
  getDemoFixtureQuestionIdsByIndex,
  getTemporaryDemoSessionQuestionFixtures,
} from '../../utilities/session/demoSessionQuestionFixtures';
