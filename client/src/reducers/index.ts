import { combineReducers } from 'redux';
import accountReducer from './accountReducer.js';
import sessionStateReducer from './sessionStateReducer.js';

export default combineReducers({
  profile: accountReducer,
  sessionState: sessionStateReducer,
});
