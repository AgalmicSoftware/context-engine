import { createStore, applyMiddleware } from 'redux';
import type { PreloadedState } from 'redux';
// import { persistReducer, persistStore } from 'redux-persist';
import thunk from 'redux-thunk';
import rootReducer from './reducers';
import type { RootState } from './reducers';
import { composeWithOptionalDevTools } from './utilities/state/composeEnhancers.js';
// import storage from 'redux-persist/lib/storage';

// const persistConfig = {
//   key: 'reducer',
//   storage: storage,
//   whitelist: ['reducer'] // or blacklist to exclude specific reducers
// };
// const presistedReducer = persistReducer(persistConfig, reducer);

const initialState: PreloadedState<RootState> = {};

const middleware = [thunk];

const store = createStore(
  rootReducer,
  initialState,
  composeWithOptionalDevTools(
    applyMiddleware(...middleware),
    // window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__()
  ),
);

export default store;
