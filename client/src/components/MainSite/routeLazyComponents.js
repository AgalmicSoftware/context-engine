/** @module routeLazyComponents */

import React from "react";

export const SurveyPage = React.lazy(() => import("../SurveyTool/SurveyPage.jsx"));
export const SurveyTool = React.lazy(() => import("../SurveyTool/SurveyTool.jsx"));
export const SBTPage = React.lazy(() => import("../SBTs/SBTPage.jsx"));
export const SBTsPage = React.lazy(() => import("../SBTs/SBTsList.jsx")); // SBTsList.jsx, often referred to as SBTsPage in comments
export const DebateMap = React.lazy(() => import("../DebateMap/DebateMap.jsx"));
export const AdminPage = React.lazy(() => import("../Admin/AdminPage.jsx"));
export const SponsorPage = React.lazy(() => import("../Sponsor/SponsorPage.jsx"));
export const SessionWizard = React.lazy(() => import("../Sessions/SessionWizard.jsx"));
export const OnePageSession = React.lazy(() => import("../OnePageSession/OnePageSession.jsx"));
export const DemosIndex = React.lazy(() => import("../DemoViews/DemosIndex.jsx"));
export const SessionDocumentsPage = React.lazy(() => import("../DocumentLibrary/SessionDocumentsPage.jsx"));
export const SimulatedUserPage = React.lazy(() => import("../UserPage/SimUserPage.jsx"));
export const UserPage = React.lazy(() => import("../UserPage/UserPage.jsx"));
export const CompareAddresses = React.lazy(() => import("../UserPage/CompareAddresses.jsx"));
export const ContractPage = React.lazy(() => import("../ContractPage/ContractPage.jsx"));
export const BookmarksPage = React.lazy(() => import("../Bookmarks/BookmarksPage.jsx"));
export const RiskMatrixDemo = React.lazy(() => import("../DemoViews/RiskMatrixDemo.jsx"));
export const AboutPage = React.lazy(() => import("../About/AboutPage.jsx"));
export const AgentPage = React.lazy(() => import("../Agent/AgentPage.jsx"));
export const TagPage = React.lazy(() => import("../TagPage/TagPage.jsx"));
