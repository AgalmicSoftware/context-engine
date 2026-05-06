import { combineReducers } from 'redux';
import accountReducer from './accountReducer.js';
import sessionStateReducer from './sessionStateReducer.js';

const rootReducer = combineReducers({
  profile: accountReducer,
  sessionState: sessionStateReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer;
