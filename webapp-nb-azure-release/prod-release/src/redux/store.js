import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from "redux-persist";
import storage from "redux-persist/lib/storage/session";

//Slices
import loginReducer from "./login/loginSlice";
import dashboardReducer from "./dashboard/dashboardSlice";
import createCaseReducer from "./caseManagement/createCase/createCaseSlice";
import caseInboxReducer from "./caseManagement/caseInbox/caseInboxSlice";
import caseOutboxReducer from "./caseManagement/caseOutbox/caseOutboxSlice";
import searchCaseReducer from "./caseManagement/searchCase/searchCaseSlice";
import viewCases from "./caseManagement/viewCase/viewCaseSlice";
import caseDetailsReducer from "./caseManagement/caseDetails/caseDetailsSlice";
import documentsReducer from "./caseManagement/documents/documentSlice";
import publicationReducer from "./caseManagement/ivPublication/publicationSlice";
import notificationReducer from "./notification/notificationSlice";
import digidakDropdownReducer from "./digidak/dropdowns/digidakDropdownSlice";
import digidakInwardReducer from "./digidak/inward/digidakInwardSlice";
import digidakOutwardReducer from "./digidak/outward/digidakOutwardSlice";
import digidakInboxReducer from "./digidak/inbox/digidakInboxSlice";
import digidakOutboxReducer from "./digidak/outbox/digidakOutboxSlice";
import digidakCorrespondenceReducer from "./digidak/correspondence/digidakCorrespondenceSlice";
import digidakDraftReducer from "./digidak/draft/digidakDraftSlice";
import digidakDDMReducer from "./digidak/ddm/digidakDDMSlice";
import digidakFolderReducer from "./digidak/folder/digidakFolderSlice";
export const LOGOUT_ACTION = "user/logout";

const appReducer = combineReducers({
  login: loginReducer,
  dashboard: dashboardReducer,
  createCase: createCaseReducer,
  caseInbox: caseInboxReducer,
  caseOutbox: caseOutboxReducer,
  searchCases: searchCaseReducer,
  viewCases: viewCases,
  caseDetails: caseDetailsReducer,
  documents: documentsReducer,
  notification: notificationReducer,
  publication: publicationReducer,
  digidakDropdown: digidakDropdownReducer,
  digidakInward: digidakInwardReducer,
  digidakOutward: digidakOutwardReducer,
  digidakInbox: digidakInboxReducer,
  digidakOutbox: digidakOutboxReducer,
  digidakCorrespondence: digidakCorrespondenceReducer,
  digidakDraft: digidakDraftReducer,
  digidakDDM: digidakDDMReducer,
  digidakFolder: digidakFolderReducer,
});

const rootReducer = (state, action) => {
  if (action.type === LOGOUT_ACTION) {
    return appReducer(undefined, action);
  }
  return appReducer(state, action);
};

const persistConfig = {
  key: "root",
  storage,
  whitelist: ["login", "dashboard", "digidakDropdown", "digidakCorrespondence"],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);
