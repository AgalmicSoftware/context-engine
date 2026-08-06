/** @module routeLazyComponents */

import React from 'react';

export const SurveyPage = React.lazy(() => import('../SurveyTool/SurveyPage'));
export const SurveyTool = React.lazy(() => import('../SurveyTool/SurveyTool'));
export const SBTPage = React.lazy(() => import('../SBTs/SBTPage'));
export const SBTsPage = React.lazy(() => import('../SBTs/SBTsList')); // SBTsList, often referred to as SBTsPage in comments
export const SBTsOverviewPage = React.lazy(() => import('../SBTs/SBTsPage'));
export const DebateMap = React.lazy(() => import('../DebateMap/DebateMap'));
export const AdminPage = React.lazy(() => import('../Admin/AdminPage'));
export const SponsorPage = React.lazy(() => import('../Sponsor/SponsorPage'));
export const SessionWizard = React.lazy(() => import('../Sessions/SessionWizard'));
export const OnePageSession = React.lazy(() => import('../OnePageSession/OnePageSession'));
export const DemosIndex = React.lazy(() => import('../DemoViews/DemosIndex'));
export const SessionDocumentsPage = React.lazy(() => import('../DocumentLibrary/SessionDocumentsPage'));
export const SimulatedUserPage = React.lazy(() => import('../UserPage/SimUserPage'));
export const UserPage = React.lazy(() => import('../UserPage/UserPage'));
export const CompareAddresses = React.lazy(() => import('../UserPage/CompareAddresses'));
export const DocsPage = React.lazy(() => import('../DocsPage/DocsPage'));
export const BookmarksPage = React.lazy(() => import('../Bookmarks/BookmarksPage'));
export const RiskMatrixDemo = React.lazy(() => import('../DemoViews/RiskMatrixDemo'));
export const AboutPage = React.lazy(() => import('../About/AboutPage'));
export const PostsPage = React.lazy(() => import('../Posts/PostsPage'));
export const AgentPage = React.lazy(() => import('../Agent/AgentPage'));
export const TagPage = React.lazy(() => import('../TagPage/TagPage'));
