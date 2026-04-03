import { createStore, applyMiddleware } from 'redux';
// import { persistReducer, persistStore } from 'redux-persist';
import { composeWithDevTools } from 'redux-devtools-extension/developmentOnly';
import thunk from 'redux-thunk';
import rootReducer from './reducers';
// import storage from 'redux-persist/lib/storage';

// const persistConfig = {
//   key: 'reducer',
//   storage: storage,
//   whitelist: ['reducer'] // or blacklist to exclude specific reducers
// };
// const presistedReducer = persistReducer(persistConfig, reducer);

const initialState = {};

const middleware = [thunk];

const store = createStore(
  rootReducer,
  initialState,
  composeWithDevTools(
    applyMiddleware(...middleware),
    // window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__()
  )
);

export default store;