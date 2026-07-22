const BROWSER_LOADING_VISUAL_GIF = 'gif';

function normalizeBrowserLoadingVisual(value = '') {
  return String(value || '').trim().toLowerCase() === 'spinner' ? 'spinner' : BROWSER_LOADING_VISUAL_GIF;
}

function miniAppLoadingVisualHtml(mode = BROWSER_LOADING_VISUAL_GIF) {
  return normalizeBrowserLoadingVisual(mode) === BROWSER_LOADING_VISUAL_GIF
    ? '<img class="loadingGif" src="/telegram/mini-app/loading.gif" alt="" aria-hidden="true">'
    : '<span class="loadingSpinner" aria-hidden="true"></span>';
}

export function renderTelegramMiniAppBrowserAsset({
  loadingVisual = BROWSER_LOADING_VISUAL_GIF,
  launchRecoveryMessage = '',
  fastInitialQuestionLimit = 1,
  fastFollowupQuestionCount = 5,
  fastFollowupDelayMs = 220,
  backgroundPageDelayMs = 650,
  maxQuestionLimit = 500,
} = {}) {
  const normalizedLoadingVisual = normalizeBrowserLoadingVisual(loadingVisual);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Context Engine</title>
  <script src="https://telegram.org/js/telegram-web-app.js?62"></script>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #171936;
      --surface: #202458;
      --surface-soft: #262b66;
      --text: #f6f8ff;
      --muted: #b8c0d8;
      --line: rgba(255, 255, 255, 0.16);
      --accent: #62ffbf;
      --accent-2: #2cc3ff;
      --results-accent: #62ffbf;
      --groups-accent: #b8a2ff;
      --filter-accent: #2cc3ff;
      --settings-accent: #ffd166;
      --accent-text: #11142f;
      --danger: #ff8a7a;
      --ok: #62ffbf;
      --shadow-dark: #10122c;
      --shadow-light: #2d3274;
      --pile-shadow-dark: #131532;
      --question-card-shadow: 7px 7px 14px var(--pile-shadow-dark);
    }
    * { box-sizing: border-box; }
    html {
      min-height: 100%;
      overflow-y: auto;
      overscroll-behavior-y: auto;
    }
    body {
      margin: 0;
      min-height: 100%;
      font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--text);
      background: var(--bg);
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-y: auto;
    }
    button, input, textarea { font: inherit; }
    button { cursor: pointer; }
    .app {
      min-height: var(--tg-viewport-height, 100dvh);
      display: grid;
      grid-template-rows: auto auto;
      align-content: start;
      padding: max(16px, env(safe-area-inset-top)) 14px max(14px, env(safe-area-inset-bottom));
      gap: 14px;
      overflow-x: hidden;
      overflow-y: visible;
      overscroll-behavior-y: auto;
    }
    header { display: grid; gap: 8px; }
    .headerBar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      gap: 12px;
    }
    .headerMain {
      display: grid;
      gap: 5px;
      min-width: 0;
    }
    .questionHeaderRow {
      display: flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
    }
    .questionHeaderRow .meta {
      min-width: 0;
      flex: 0 1 auto;
    }
    .questionHeaderRow .headerIconButton {
      width: 36px;
      height: 36px;
      min-width: 36px;
      min-height: 36px;
    }
    .questionHeaderRow .headerIconButton svg {
      width: 22px;
      height: 22px;
    }
    .headerIconButton,
    .sessionEditButton {
      width: 30px;
      height: 30px;
      min-width: 30px;
      min-height: 30px;
      border: 0;
      background: transparent;
      color: var(--muted);
      padding: 0;
      box-shadow: none;
    }
    .headerIconButton svg,
    .sessionEditButton svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .headerIconButton.active,
    .sessionEditButton.active,
    .headerIconButton:active,
    .sessionEditButton:active {
      color: var(--accent);
      background: transparent;
      border-color: transparent;
      box-shadow: none;
    }
    .headerResultsLink {
      justify-self: start;
      border: 0;
      background: transparent;
      color: var(--results-accent);
      padding: 0;
      min-height: 24px;
      font-size: 19px;
      font-weight: 700;
      line-height: 1.15;
      text-align: left;
    }
    .headerResultsLink.active,
    .headerResultsLink:active {
      color: var(--results-accent);
      background: transparent;
      border-color: transparent;
      box-shadow: none;
    }
    .headerActions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
    }
    .iconButton {
      width: 40px;
      height: 40px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .iconButton.active {
      color: var(--accent-text);
      box-shadow: 0 0 14px rgba(255, 255, 255, 0.16);
    }
    .menuButton.active {
      color: var(--accent);
      background: rgba(98, 255, 191, 0.12);
      border-color: rgba(98, 255, 191, 0.62);
    }
    .sessionsButton {
      border-color: rgba(44, 195, 255, 0.45);
      color: var(--accent-2);
    }
    .sessionsButton.active {
      background: rgba(44, 195, 255, 0.16);
      border-color: var(--accent-2);
      color: var(--accent-2);
    }
    .documentsButton {
      border-color: rgba(255, 209, 102, 0.45);
      color: var(--settings-accent);
    }
    .documentsButton.active {
      background: var(--settings-accent);
      border-color: var(--settings-accent);
    }
    .adminButton {
      border-color: rgba(255, 138, 122, 0.5);
      color: var(--danger);
    }
    .adminButton.active {
      background: var(--danger);
      border-color: var(--danger);
    }
    .filterButton {
      border-color: rgba(44, 195, 255, 0.45);
      color: var(--filter-accent);
    }
    .filterButton.active {
      background: var(--filter-accent);
      border-color: var(--filter-accent);
    }
    .resultsButton {
      border-color: rgba(98, 255, 191, 0.45);
      color: var(--results-accent);
    }
    .resultsButton.active {
      background: var(--results-accent);
      border-color: var(--results-accent);
    }
    .headerResultsLink.resultsButton.active {
      background: transparent;
      border-color: transparent;
      color: var(--results-accent);
      box-shadow: none;
    }
    .groupsButton {
      border-color: rgba(184, 162, 255, 0.45);
      color: var(--groups-accent);
    }
    .groupsButton.active {
      background: var(--groups-accent);
      border-color: var(--groups-accent);
    }
    .addQuestionButton {
      border-color: rgba(98, 255, 191, 0.45);
      color: var(--accent);
    }
    .addQuestionButton.active {
      background: var(--accent);
      border-color: var(--accent);
    }
    .settingsButton {
      border-color: rgba(255, 209, 102, 0.45);
      color: var(--settings-accent);
    }
    .settingsButton.active {
      background: var(--settings-accent);
      border-color: var(--settings-accent);
    }
    .draftsButton {
      border-color: rgba(98, 255, 191, 0.45);
      color: var(--accent);
    }
    .draftsButton.active {
      background: var(--accent);
      border-color: var(--accent);
    }
    .headerIconButton.filterButton.active,
    .headerIconButton.addQuestionButton.active,
    .sessionEditButton.sessionsButton.active {
      background: transparent;
      border-color: transparent;
      box-shadow: none;
    }
    .headerIconButton.filterButton.active {
      color: var(--filter-accent);
    }
    .headerIconButton.addQuestionButton.active,
    .sessionEditButton.sessionsButton.active {
      color: var(--accent);
    }
    .questionHeaderRow .headerIconButton,
    .questionHeaderRow .headerIconButton.active,
    .questionHeaderRow .headerIconButton:active {
      border: 0;
      background: transparent;
      box-shadow: none;
    }
    .iconButton svg {
      width: 17px;
      height: 17px;
      fill: currentColor;
      display: block;
    }
    .toolMenu {
      display: none;
      grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
      gap: 8px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px;
      background: var(--surface);
    }
    .toolMenu.open { display: grid; }
    .toolMenu .iconButton {
      width: 100%;
      min-height: 64px;
      flex-direction: column;
      gap: 6px;
      font-size: 14px;
      line-height: 1.15;
      text-align: center;
      padding: 8px 6px;
    }
    .toolMenu .iconButton span {
      display: block;
      color: currentColor;
    }
    .toolMenu .menuCheckbox {
      cursor: pointer;
    }
    .toolMenu .menuCheckbox input {
      width: 18px;
      height: 18px;
      margin: 0;
      accent-color: var(--results-accent);
    }
    .panelIconButton {
      flex: 0 0 auto;
    }
    .panelCloseButton {
      flex: 0 0 auto;
      min-width: 34px;
      min-height: 34px;
      border: 0;
      background: transparent;
      color: var(--muted);
      padding: 0;
    }
    .panelCloseButton svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.4;
      stroke-linecap: round;
    }
    .panelCloseButton:active,
    .panelCloseButton:hover {
      color: var(--text);
    }
    .iconButton svg.filterIcon {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .resultsButton svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .addQuestionButton svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .meta {
      color: var(--text);
      font-size: 19px;
      line-height: 1.15;
      font-weight: 800;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .metaClearFilter {
      min-width: 28px;
      min-height: 28px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--muted);
      padding: 0;
      font-weight: 700;
      line-height: 1;
    }
    .status { min-height: 20px; color: var(--muted); font-size: 13px; }
    .settingsPanel select,
    .settingsPanel textarea,
    .documentsPanel select,
    .addQuestionPanel select,
    .groupCountrySelect {
      min-height: 38px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface-soft);
      color: var(--text);
      padding: 8px 10px;
    }
    .settingsPanel,
    .adminPanel,
    .activityPanel,
    .draftsPanel,
    .documentsPanel,
    .addQuestionPanel,
    .groupsPanel,
    .filterPanel,
    .resultsPanel {
      display: none;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      gap: 10px;
      align-items: end;
    }
    .settingsPanel {
      grid-template-columns: minmax(0, 1fr);
      align-items: stretch;
      border-color: rgba(255, 209, 102, 0.52);
      background: rgba(92, 71, 31, 0.36);
    }
    .adminPanel {
      grid-template-columns: minmax(0, 1fr);
      align-items: stretch;
      border-color: rgba(255, 138, 122, 0.52);
      background: rgba(120, 42, 52, 0.26);
    }
    .activityPanel {
      grid-template-columns: minmax(0, 1fr);
      align-items: stretch;
      border-color: rgba(44, 195, 255, 0.52);
      background: rgba(20, 70, 104, 0.28);
    }
    .draftsPanel {
      grid-template-columns: minmax(0, 1fr);
      align-items: stretch;
      border-color: rgba(98, 255, 191, 0.52);
      background: rgba(24, 92, 71, 0.24);
    }
    .documentsPanel {
      grid-template-columns: minmax(0, 1fr);
      align-items: stretch;
      border-color: rgba(255, 209, 102, 0.52);
      background: rgba(92, 71, 31, 0.24);
    }
    .filterPanel {
      grid-template-columns: minmax(0, 1fr);
      align-items: center;
      border-color: rgba(44, 195, 255, 0.52);
      background: rgba(20, 70, 104, 0.36);
    }
    .groupsPanel {
      grid-template-columns: minmax(0, 1fr);
      align-items: stretch;
      border-color: rgba(184, 162, 255, 0.52);
      background: rgba(73, 55, 132, 0.34);
    }
    .addQuestionPanel {
      grid-template-columns: minmax(0, 1fr);
      align-items: stretch;
      border-color: rgba(98, 255, 191, 0.52);
      background: rgba(24, 92, 71, 0.24);
    }
    .resultsPanel {
      grid-template-columns: minmax(0, 1fr);
      align-items: stretch;
      border-color: rgba(98, 255, 191, 0.52);
      background: rgba(24, 92, 71, 0.28);
    }
    .settingsPanel.open, .adminPanel.open, .activityPanel.open, .draftsPanel.open, .documentsPanel.open, .addQuestionPanel.open, .groupsPanel.open, .filterPanel.open, .resultsPanel.open { display: grid; }
    .resultsHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .settingsPanel > .resultsHeader {
      grid-column: 1 / -1;
    }
    .resultsPanelToggle {
      min-height: 34px;
      flex: 1 1 auto;
    }
    .documentsPanel.documentsCollapsed .documentsPanelBody {
      display: none;
    }
    .documentsPanelBody,
    .resultsPanelBody {
      display: grid;
      gap: 10px;
    }
    .resultGroups, .documentsSessionOptions, .documentList, .adminActions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .activityList {
      display: grid;
      gap: 8px;
    }
    .documentUploadControls {
      display: grid;
      gap: 8px;
    }
    .documentUploadControls input[type="file"],
    .documentUploadControls input[type="text"],
    .documentUploadControls input[type="url"] {
      min-height: 38px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface-soft);
      color: var(--text);
      padding: 8px 10px;
    }
    .resultActions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .groupCategories, .groupProposals {
      display: grid;
      gap: 10px;
    }
    .questionTypeButtons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .addQuestionControls {
      display: grid;
      gap: 10px;
    }
    .addQuestionControls textarea,
    .addQuestionControls input[type="text"],
    .addQuestionControls input[type="url"] {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface-soft);
      color: var(--text);
      padding: 8px 10px;
    }
    .addQuestionControls textarea {
      min-height: 76px;
    }
    .addQuestionPromptBox textarea,
    .addQuestionPromptBox .micButton {
      min-height: 76px;
    }
    .groupCategory {
      display: grid;
      gap: 8px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.06);
    }
    .groupsTitle {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 8px;
      min-width: 0;
    }
    .groupsTitleSession {
      opacity: 0.5;
      font-size: 12px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .addQuestionTitle {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 8px;
      min-width: 0;
    }
    .addQuestionTitleSession {
      opacity: 0.5;
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      overflow-wrap: anywhere;
    }
    .addQuestionFromUrlToggle {
      border: 0;
      background: transparent;
      color: var(--accent);
      font: inherit;
      font-size: 14px;
      font-weight: 700;
      padding: 0 2px;
    }
    .addQuestionFromUrlToggle.active {
      color: var(--accent-strong);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .addQuestionUrlControls {
      display: grid;
      gap: 10px;
      padding: 10px;
      border: 1px solid rgba(92, 245, 180, 0.28);
      border-radius: 8px;
      background: rgba(92, 245, 180, 0.08);
    }
    .addQuestionUrlControls[hidden] { display: none; }
    .addQuestionUrlRow {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
    }
    .urlQuestionCandidates {
      display: grid;
      gap: 8px;
    }
    .urlQuestionCandidate {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: start;
      padding: 8px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.07);
    }
    .urlQuestionCandidatePrompt {
      color: var(--text);
      font-weight: 700;
      line-height: 1.25;
    }
    .urlQuestionCandidateMeta {
      margin-top: 4px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.3;
    }
    .urlQuestionCandidateRemove {
      border: 0;
      background: transparent;
      color: var(--muted);
      font-size: 18px;
      line-height: 1;
      padding: 0 4px;
    }
    .resultsTitle {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 8px;
      min-width: 0;
    }
    .resultsTitleRow {
      display: flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
    }
    .resultsTitleSession {
      opacity: 0.5;
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      overflow-wrap: anywhere;
    }
    .resultsLoadingSpinner[hidden] { display: none; }
    .resultsTitleRow .headerIconButton,
    .resultsTitleRow .headerIconButton.active,
    .resultsTitleRow .headerIconButton:active {
      width: 36px;
      height: 36px;
      min-width: 36px;
      min-height: 36px;
      border: 0;
      background: transparent;
      box-shadow: none;
    }
    .resultsTitleRow .headerIconButton svg {
      width: 22px;
      height: 22px;
    }
    .groupCategoryHeader {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      width: 100%;
      border: 0;
      background: transparent;
      color: inherit;
      padding: 0;
      text-align: left;
    }
    .groupCategoryHeaderText { display: grid; gap: 2px; }
    .groupCategoryHeader strong { color: var(--text); }
    .groupCategoryHeader span, .groupProposal { color: var(--muted); font-size: 12px; }
    .groupCategoryHeader svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .groupOptions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .groupCategory.collapsed .groupOptions { display: none; }
    .groupOption {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 34px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 6px 8px;
      background: rgba(255, 255, 255, 0.06);
    }
    .groupActions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .groupActionsTop {
      justify-content: flex-start;
    }
    .groupCountryDetails,
    .groupOtherDetails {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 8px;
      margin-top: 8px;
    }
    .resultColumns {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .resultFilters {
      display: grid;
      gap: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.05);
    }
    .resultFilters[hidden] {
      display: none !important;
    }
    .resultFilterHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .resultFilterHeader .collapsibleHeader {
      flex: 1 1 auto;
    }
    .resultFilterHeader .secondary {
      flex: 0 0 auto;
    }
    .resultFilterOptions, .resultClusterControls {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .collapsibleHeader {
      width: 100%;
      min-height: 38px;
      border: 0;
      background: transparent;
      color: var(--text);
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      text-align: left;
      font-weight: 700;
    }
    .collapsibleHeader svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      flex: 0 0 auto;
    }
    .resultSection.collapsed .collapsibleBody,
    .resultFilters.collapsed .collapsibleBody {
      display: none;
    }
    .resultSection[hidden] {
      display: none;
    }
    .resultSection, .groupAnalysis {
      display: grid;
      gap: 8px;
      min-width: 0;
    }
    .resultList {
      display: grid;
      gap: 8px;
    }
    .resultRow {
      display: grid;
      gap: 3px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 9px 10px;
      background: rgba(255, 255, 255, 0.06);
      overflow-wrap: anywhere;
    }
    .resultRow strong { color: var(--text); font-size: 13px; }
    .resultRow span { color: var(--muted); font-size: 12px; }
    .moreResultsButton[hidden] { display: none; }
    .distributionBar {
      display: grid;
      grid-template-columns: var(--agree, 0fr) var(--unsure, 0fr) var(--disagree, 0fr);
      min-height: 16px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
    .distributionBar span:nth-child(1) { background: #12b569; }
    .distributionBar span:nth-child(2) { background: #f5b500; }
    .distributionBar span:nth-child(3) { background: #ff443d; }
    .distributionRow {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
    }
    .distributionTotal {
      min-width: 1.5rem;
      text-align: right;
      color: var(--text);
      font-size: 13px;
      font-weight: 700;
    }
    .resultGroup {
      display: grid;
      gap: 6px;
      min-width: min(100%, 180px);
      flex: 1 1 180px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.06);
    }
    .resultGroup strong { color: var(--text); }
    .resultGroup span { color: var(--muted); font-size: 12px; }
    .groupAnalysisResult {
      gap: 6px;
    }
    .groupAnalysisResult strong {
      font-size: 15px;
    }
    .groupAnalysisResult span {
      color: var(--text);
      font-size: 14px;
      line-height: 1.45;
    }
    .resultGroupChart {
      display: grid;
      min-height: 180px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.08);
      overflow: hidden;
    }
    .resultGroupChart svg {
      width: 100%;
      height: auto;
      min-height: 180px;
      display: block;
    }
    .resultGroupChart text {
      font: 600 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .resultTopicMap {
      display: grid;
      min-height: 240px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.08);
      overflow: hidden;
    }
    .resultTopicMap svg {
      width: 100%;
      height: auto;
      min-height: 240px;
      display: block;
    }
    .resultTopicMap text {
      font: 650 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .documentItem, .adminCard, .activityCard {
      display: grid;
      gap: 4px;
      min-width: min(100%, 190px);
      flex: 1 1 190px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.06);
    }
    .documentItem strong, .adminCard strong, .activityCard strong { color: var(--text); }
    .documentItem span, .adminCard span, .activityCard span { color: var(--muted); font-size: 12px; overflow-wrap: anywhere; }
    .adminForm {
      display: grid;
      gap: 8px;
      width: 100%;
    }
    .adminForm input[type="text"],
    .adminForm input[type="number"],
    .adminForm textarea {
      min-height: 38px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface-soft);
      color: var(--text);
      padding: 8px 10px;
    }
    .adminForm textarea {
      min-height: 76px;
      resize: vertical;
    }
    .adminForm label {
      display: grid;
      gap: 5px;
      color: var(--muted);
      font-size: 12px;
    }
    .adminToggleRow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-height: 34px;
      color: var(--text);
      font-size: 14px;
    }
    .adminCommand {
      padding: 8px;
      border: 1px solid var(--line);
      border-radius: 8px;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.06);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .adminAddressList {
      display: grid;
      gap: 5px;
    }
    .adminAddressButton {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 11px;
      line-height: 1.35;
      min-height: 34px;
      padding: 7px 8px;
      text-align: left;
      overflow-wrap: anywhere;
    }
    .documentPreviewButton {
      min-height: 0;
      border: 0;
      background: transparent;
      color: var(--accent-2);
      padding: 0;
      text-align: left;
      font: inherit;
      font-weight: 800;
      overflow-wrap: anywhere;
    }
    .documentPreview {
      display: grid;
      gap: 8px;
      margin-top: 4px;
    }
    .documentPreview img,
    .documentPreview iframe {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.06);
    }
    .documentPreview img {
      max-height: 260px;
      object-fit: contain;
    }
    .documentPreview iframe {
      min-height: 320px;
    }
    .savedDrafts {
      grid-column: 1 / -1;
      display: grid;
      gap: 6px;
      color: var(--muted);
      font-size: 12px;
      border-top: 1px solid var(--line);
      padding-top: 10px;
      max-height: 24vh;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    .savedDrafts strong { color: var(--text); font-size: 13px; }
    .savedDrafts div { overflow-wrap: anywhere; }
    .savedDraftsSection {
      display: grid;
      gap: 5px;
      padding-bottom: 4px;
    }
    .savedDraftsSection + .savedDraftsSection {
      border-top: 1px solid var(--line);
      padding-top: 8px;
    }
    .savedDraftsHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .savedDraftsHeader strong { min-width: 0; }
    .draftActions {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 8px;
    }
    .field { display: grid; gap: 5px; }
    .field label { color: var(--muted); font-size: 12px; }
    .toggle { display: flex; align-items: center; gap: 8px; min-height: 38px; color: var(--text); }
    .filterControls { display: grid; gap: 10px; }
    .topPopularFilter {
      display: grid;
      gap: 6px;
    }
    .topPopularInline {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .topPopularStepper {
      display: inline-grid;
      grid-template-columns: 38px minmax(64px, 86px) 38px;
      gap: 6px;
      align-items: center;
    }
    .topPopularStepper input {
      width: 100%;
      min-height: 38px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface-soft);
      color: var(--text);
      padding: 8px 10px;
      text-align: center;
      font-weight: 700;
    }
    .topPopularStepper button {
      min-height: 38px;
      padding: 0;
      font-size: 20px;
      font-weight: 800;
      line-height: 1;
    }
    .filterSearchRow { display: grid; grid-template-columns: minmax(0, 1fr) 44px auto; gap: 8px; }
    .filterSearchRow input {
      min-height: 38px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface-soft);
      color: var(--text);
      padding: 8px 10px;
    }
    .typeFilters { display: flex; flex-wrap: wrap; gap: 8px; }
    .filterSubsection {
      display: grid;
      gap: 8px;
    }
    .filterSubsection.collapsed .collapsibleBody {
      display: none;
    }
    .filterSubsection .collapsibleHeader {
      min-height: 34px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
    }
    .typeFilter {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 34px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 6px 8px;
      background: rgba(255, 255, 255, 0.06);
    }
    .filterSummary { color: var(--muted); font-size: 12px; min-height: 18px; }
    .tagFilterField .collapsibleHeader {
      min-height: 30px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
    }
    .tagFilterHeading {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .tagFilterHint {
      color: var(--muted);
      font-weight: 500;
    }
    .questionTags {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 6px;
    }
    .questionTags.expandedOnly {
      margin-top: 8px;
      margin-bottom: 4px;
    }
    .questionTag {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 999px;
      padding: 2px 8px;
      color: var(--muted);
      font-size: 11px;
      line-height: 1.2;
      background: rgba(255, 255, 255, 0.05);
    }
    .sectionTitle { color: var(--text); font-size: 19.5px; font-weight: 700; }
    .layout {
      display: grid;
      gap: 12px;
      min-height: 0;
      overflow-y: visible;
      overflow-x: hidden;
      touch-action: auto;
    }
    .sessionPicker {
      display: none;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      padding: 14px;
      gap: 10px;
    }
    .sessionPicker.open { display: grid; }
    .sessionPickerHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .sessionSummary {
      margin-top: 3px;
      color: var(--muted);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .sessionPickerBody { display: grid; gap: 10px; }
    .sessionOptions { display: grid; gap: 8px; }
    .sessionOption {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 9px 10px;
      background: rgba(255, 255, 255, 0.06);
    }
    .sessionOption input { width: 18px; height: 18px; accent-color: var(--accent); }
    .sessionActions { display: flex; justify-content: flex-end; }
    .questionStack {
      display: grid;
      gap: 18px;
      min-height: 0;
      min-width: 0;
      max-width: 100%;
      overflow-x: hidden;
      padding: 2px 0 8px;
    }
    .loadMoreQuestions { justify-self: center; min-width: min(100%, 280px); }
    .questionLoadingRow {
      justify-self: center;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      min-width: min(100%, 280px);
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 10px 14px;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.07);
      font-size: 13px;
    }
    .questionVotes {
      display: grid;
      grid-template-columns: 30px minmax(28px, auto) 30px;
      align-items: center;
      justify-content: end;
      gap: 6px;
    }
    .questionVoteRow {
      display: flex;
      justify-content: flex-end;
    }
    .agentOnlyBadgeRow {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    .agentOnlyBadgeRow.stackedPredictionRow {
      display: block;
      width: 100%;
    }
    .agentPredictionBadge, .agentVoteMarker {
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      background: rgba(255,255,255,0.07);
      font-size: 15px;
      font-weight: 800;
      line-height: 1.25;
      padding: 8px 10px;
      overflow-wrap: anywhere;
    }
    .agentPredictionBadge {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      max-width: 100%;
    }
    .agentPredictionBadge.stackedPrediction {
      display: grid;
      width: min(100%, 560px);
      gap: 7px;
      justify-items: start;
      align-items: start;
      padding: 12px 14px;
    }
    .agentPredictionBadge.choicePrediction {
      gap: 10px;
      border-color: rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.07);
      color: var(--text);
      padding: 7px;
    }
    .agentPredictionLabel {
      color: var(--muted);
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .agentPredictionValue {
      color: var(--text);
      font-size: 17px;
      font-weight: 850;
    }
    .agentPredictionChoice {
      min-width: 112px;
      min-height: 42px;
      border-radius: 8px;
      padding: 9px 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 850;
      line-height: 1;
    }
    .agentPredictionChoice.agree {
      background: #4caf50;
      color: #ffffff;
    }
    .agentPredictionChoice.unsure {
      background: #ffeb3b;
      color: #202458;
    }
    .agentPredictionChoice.disagree {
      background: #f44336;
      color: #ffffff;
    }
    .voteButton {
      min-height: 30px;
      min-width: 30px;
      width: 30px;
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--text);
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .voteButton.up {
      color: var(--ok);
    }
    .voteButton.down {
      color: var(--danger);
    }
    .voteButton svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.4;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .voteGlyph {
      font-size: 22px;
      font-weight: 900;
      line-height: 1;
    }
    .voteButton.active {
      background: transparent;
    }
    .voteScore {
      color: var(--text);
      font-size: 14px;
      font-weight: 800;
      line-height: 1;
      text-align: center;
    }
    .voteScore.positive { color: var(--ok); }
    .voteScore.negative { color: var(--danger); }
    .secondary {
      min-height: 36px;
      border: 1px solid var(--line);
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text);
      padding: 7px 10px;
    }
    .secondary.active {
      border-color: var(--accent);
      color: var(--accent);
      box-shadow: 0 0 10px rgba(98, 255, 191, 0.18);
    }
    .card {
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      background: var(--surface);
      display: grid;
      grid-template-rows: auto auto;
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
      box-shadow: var(--question-card-shadow);
    }
    .card[data-active="true"] {
      border-color: rgba(98, 255, 191, 0.75);
      box-shadow: inset 4px 0 0 var(--accent), var(--question-card-shadow);
    }
    .card[data-highlight="true"] {
      border-color: rgba(255, 209, 102, 0.85);
      box-shadow: inset 4px 0 0 var(--settings-accent), var(--question-card-shadow);
    }
    .cardHead {
      padding: 16px;
      border-bottom: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: start;
    }
    .cardHeadText { min-width: 0; max-width: 100%; }
    .cardToggle {
      min-width: 36px;
      min-height: 36px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--text);
      padding: 0;
      font-size: 18px;
      line-height: 1;
    }
    .cardToggle svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .prompt {
      margin: 0;
      font-size: 19px;
      line-height: 1.28;
      letter-spacing: 0;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .cardBody { padding: 16px; display: grid; align-content: start; gap: 14px; min-width: 0; max-width: 100%; }
    .card.collapsed .expandedOnly { display: none; }
    .cardActions { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
    .cardActions[hidden] { display: none; }
    .segmented, .choices, .ratingTicks { display: grid; gap: 8px; min-width: 0; max-width: 100%; }
    .segmented { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .choices { grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); }
    .choice, .segment {
      min-height: 42px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 9px 10px;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text);
      text-align: center;
      min-width: 0;
      max-width: 100%;
      overflow-wrap: anywhere;
    }
    .choice.selected {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--accent-text);
      box-shadow: 0 0 14px rgba(98, 255, 191, 0.28);
    }
    .segment.agree {
      background: rgba(76, 175, 80, 0.3);
      border-color: #4caf50;
      color: #81c784;
    }
    .segment.unsure {
      background: rgba(255, 235, 59, 0.2);
      border-color: #fdd835;
      color: #fff176;
    }
    .segment.disagree {
      background: rgba(244, 67, 54, 0.3);
      border-color: #f44336;
      color: #e57373;
    }
    .segment.selected {
      font-weight: 800;
      box-shadow: 0 0 14px rgba(255, 255, 255, 0.18);
    }
    .segment.agree.selected {
      background: #4caf50;
      border-color: #4caf50;
      color: #ffffff;
    }
    .segment.unsure.selected {
      background: #ffeb3b;
      border-color: #fdd835;
      color: #202458;
    }
    .segment.disagree.selected {
      background: #f44336;
      border-color: #f44336;
      color: #ffffff;
    }
    .ratingValue { font-size: 34px; font-weight: 700; letter-spacing: 0; color: var(--accent); overflow-wrap: anywhere; }
    input[type="range"] { width: 100%; min-width: 0; max-width: 100%; accent-color: var(--accent); }
    textarea {
      width: 100%;
      min-height: 104px;
      resize: vertical;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text);
    }
    .commentBox {
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(56px, 1fr);
      gap: 8px;
      align-items: stretch;
      min-width: 0;
      max-width: 100%;
    }
    .freeformAnswerBox textarea,
    .freeformAnswerBox .micButton {
      min-height: 52px;
    }
    .commentsSection {
      border-top: 1px solid var(--line);
      padding-top: 12px;
      margin-top: 12px;
    }
    .commentActions { display: grid; align-items: stretch; }
    .micButton {
      width: 100%;
      min-width: 44px;
      min-height: 44px;
      border: 0;
      border-radius: 0;
      background: transparent;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .micButton svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
      display: block;
    }
    .commentActions .micButton {
      height: 100%;
      min-height: 104px;
    }
    .commentActions .micButton svg {
      width: 30px;
      height: 30px;
    }
    textarea.micFeedback,
    .filterSearchRow input.micFeedback {
      border-color: var(--accent-2);
      color: var(--muted);
    }
    .micButton[aria-pressed="true"] {
      border-color: transparent;
      background: transparent;
      color: var(--accent-2);
      box-shadow: none;
    }
    .locked { color: var(--muted); border: 1px dashed var(--line); border-radius: 8px; padding: 12px; background: rgba(255, 255, 255, 0.04); }
    .primary {
      min-height: 44px;
      border: 1px solid var(--accent);
      border-radius: 8px;
      background: var(--accent);
      color: var(--accent-text);
      padding: 10px;
      text-align: center;
      font-weight: 700;
    }
    .submitButton {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border-color: rgba(255, 255, 255, 0.82);
      background: transparent;
      color: var(--text);
    }
    .submitButton svg {
      width: 24px;
      height: 24px;
      fill: none;
      stroke: currentColor;
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .submitButton.submittedCheck {
      border-color: var(--ok);
      background: transparent;
      color: var(--ok);
    }
    .submitButton.submittedCheck:disabled {
      opacity: 1;
      cursor: default;
    }
    .primary:disabled, .secondary:disabled { opacity: 0.58; cursor: default; }
    .submitButton.submittedCheck:disabled { opacity: 1; }
    .ok { color: var(--ok); }
    .error { color: var(--danger); white-space: pre-wrap; }
    .loadingStatus {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      min-height: 280px;
      padding: 26px 0;
      text-align: center;
    }
    .loadingStatus span {
      display: block;
      font-size: clamp(22px, 5vw, 28px);
      line-height: 1.1;
      font-weight: 800;
      color: var(--text);
    }
    .loadingProgress {
      width: min(72vw, 340px);
      height: 10px;
      overflow: hidden;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      background: rgba(255, 255, 255, 0.08);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
    }
    .loadingProgressBar {
      width: var(--progress, 18%);
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--accent), var(--ok));
      transition: width 260ms ease;
    }
    .inlineSpinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.24);
      border-top-color: var(--accent);
      border-radius: 50%;
      display: inline-block;
      animation: ceSpin 0.8s linear infinite;
      vertical-align: -3px;
    }
    @keyframes ceSpin {
      to { transform: rotate(360deg); }
    }
    .loadingSpinner {
      width: min(34vw, 112px);
      height: min(34vw, 112px);
      border: 8px solid rgba(255, 255, 255, 0.15);
      border-top-color: var(--accent);
      border-right-color: var(--ok);
      border-radius: 50%;
      animation: ceSpin 0.9s linear infinite;
      flex: 0 0 auto;
      box-shadow: 0 0 28px rgba(98, 255, 191, 0.14);
    }
    .loadingGif {
      width: min(68vw, 240px);
      height: min(68vw, 240px);
      object-fit: contain;
      border-radius: 0;
      background: transparent;
      flex: 0 0 auto;
    }
    @media (max-width: 760px) {
      .toolMenu { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .settingsPanel, .adminPanel, .activityPanel, .draftsPanel, .documentsPanel, .addQuestionPanel, .groupsPanel, .filterPanel { grid-template-columns: 1fr; }
      .resultColumns { grid-template-columns: 1fr; }
      .filterSearchRow { grid-template-columns: minmax(0, 1fr) 44px auto; }
    }
  </style>
</head>
<body>
  <main class="app">
    <header>
      <div class="headerBar">
        <div class="headerMain">
          <div class="questionHeaderRow">
            <div class="meta" id="meta"><span>Questions:</span><span class="inlineSpinner" aria-label="Loading questions"></span></div>
            <button class="iconButton headerIconButton filterButton" id="showFilter" type="button" aria-label="Filter" aria-expanded="false" title="Filter">
              <svg class="filterIcon" aria-hidden="true" focusable="false" viewBox="0 0 24 24">
                <path d="M3 5h18l-7 8v5l-4 2v-7L3 5z"></path>
              </svg>
            </button>
            <button class="iconButton headerIconButton addQuestionButton" id="showAddQuestion" type="button" aria-label="Add question" aria-expanded="false" title="Add question">
              <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
                <path d="M12 5v14"></path><path d="M5 12h14"></path>
              </svg>
            </button>
          </div>
          <button class="headerResultsLink resultsButton" id="showResults" type="button" aria-label="Results" aria-expanded="false">Results</button>
        </div>
        <div class="headerActions">
          <button class="iconButton menuButton" id="showToolMenu" type="button" aria-label="Open tools menu" aria-expanded="false" title="Menu">
            <svg class="filterIcon" aria-hidden="true" focusable="false" viewBox="0 0 24 24">
              <path d="M4 6h16"></path><path d="M4 12h16"></path><path d="M4 18h16"></path>
            </svg>
          </button>
        </div>
      </div>
      <section class="toolMenu" id="toolMenu" aria-label="Mini App tools">
          <button class="iconButton sessionsButton" id="showSessions" type="button" aria-label="Sessions" aria-expanded="false" title="Sessions">
            <svg class="filterIcon" aria-hidden="true" focusable="false" viewBox="0 0 24 24">
              <path d="M4 7h16"></path><path d="M4 12h16"></path><path d="M4 17h16"></path><path d="M8 4v16"></path>
            </svg>
            <span>Sessions</span>
          </button>
          <button class="iconButton groupsButton" id="showGroups" type="button" aria-label="Groups" aria-expanded="false" title="Groups">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
              <path d="M7.5 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"></path><path d="M16.5 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"></path><path d="M3 20a4.5 4.5 0 0 1 9 0"></path><path d="M12 20a4.5 4.5 0 0 1 9 0"></path>
            </svg>
            <span>Groups</span>
          </button>
          <button class="iconButton settingsButton" id="showSettings" type="button" aria-label="Settings" aria-expanded="false" title="Settings">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 512 512">
              <path d="M487.4 315.7l-42.6-24.6c4.3-23.2 4.3-47 0-70.2l42.6-24.6c4.9-2.8 7.1-8.6 5.5-14-11.1-35.6-30-67.8-54.7-94.6-3.8-4.1-10-5.1-14.8-2.3L380.8 110c-17.9-15.4-38.5-27.3-60.8-35.1V25.8c0-5.6-3.9-10.5-9.4-11.7-36.7-8.2-74.3-7.8-109.2 0-5.5 1.2-9.4 6.1-9.4 11.7V75c-22.2 7.9-42.8 19.8-60.8 35.1L88.7 85.5c-4.9-2.8-11-1.9-14.8 2.3-24.7 26.7-43.6 58.9-54.7 94.6-1.7 5.4.6 11.2 5.5 14L67.3 221c-4.3 23.2-4.3 47 0 70.2l-42.6 24.6c-4.9 2.8-7.1 8.6-5.5 14 11.1 35.6 30 67.8 54.7 94.6 3.8 4.1 10 5.1 14.8 2.3l42.6-24.6c17.9 15.4 38.5 27.3 60.8 35.1v49.2c0 5.6 3.9 10.5 9.4 11.7 36.7 8.2 74.3 7.8 109.2 0 5.5-1.2 9.4-6.1 9.4-11.7v-49.2c22.2-7.9 42.8-19.8 60.8-35.1l42.6 24.6c4.9 2.8 11 1.9 14.8-2.3 24.7-26.7 43.6-58.9 54.7-94.6 1.5-5.5-.7-11.3-5.6-14.1zM256 336c-44.1 0-80-35.9-80-80s35.9-80 80-80 80 35.9 80 80-35.9 80-80 80z"></path>
            </svg>
            <span>Settings</span>
          </button>
          <button class="iconButton draftsButton" id="showDrafts" type="button" aria-label="Drafts" aria-expanded="false" title="Drafts">
            <svg class="filterIcon" aria-hidden="true" focusable="false" viewBox="0 0 24 24">
              <path d="M4 5h16"></path><path d="M4 12h16"></path><path d="M4 19h10"></path><path d="M17 17l2 2 3-5"></path>
            </svg>
            <span>Drafts</span>
          </button>
          <label class="iconButton resultsButton menuCheckbox" title="Demo data">
            <input id="demoDataResults" type="checkbox" aria-label="Demo data">
            <span>Demo data</span>
          </label>
          <label class="iconButton settingsButton menuCheckbox" title="Agent predictions">
            <input id="showAgentResponses" type="checkbox" aria-label="Agent predictions">
            <span>Agent predictions</span>
          </label>
          <button class="iconButton activityButton" id="showActivity" type="button" aria-label="Activity" aria-expanded="false" title="Activity">
            <svg class="filterIcon" aria-hidden="true" focusable="false" viewBox="0 0 24 24">
              <path d="M4 6h16"></path><path d="M4 12h10"></path><path d="M4 18h7"></path><path d="M17 16l2 2 3-5"></path>
            </svg>
            <span>Activity</span>
          </button>
          <button class="iconButton adminButton" id="showAdmin" type="button" aria-label="Admin actions" aria-expanded="false" title="Admin actions" hidden>
            <svg class="filterIcon" aria-hidden="true" focusable="false" viewBox="0 0 24 24">
              <path d="M12 3l7 4v5c0 4.5-2.8 7.5-7 9-4.2-1.5-7-4.5-7-9V7z"></path><path d="M9 12l2 2 4-5"></path>
            </svg>
            <span>Admin</span>
          </button>
      </section>
      <section class="sessionPicker" id="sessionPicker" aria-label="Sessions">
        <div class="sessionPickerHeader">
          <div>
            <div class="sectionTitle">Sessions</div>
            <div class="sessionSummary" id="sessionSummary"></div>
          </div>
          <button class="iconButton panelCloseButton" id="closeSessions" type="button" aria-label="Close sessions" title="Close sessions">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>
          </button>
        </div>
        <div class="sessionPickerBody" id="sessionPickerBody">
          <div class="sessionOptions" id="sessionOptions"></div>
          <div class="sessionActions">
            <button class="primary" id="continueSessions" type="button">Save</button>
          </div>
        </div>
      </section>
      <div class="status loadingStatus" id="status">
        ${miniAppLoadingVisualHtml(normalizedLoadingVisual)}
        <span>Loading questions and agent predictions</span>
        <div class="loadingProgress" aria-hidden="true"><div class="loadingProgressBar" style="--progress: 18%"></div></div>
      </div>
      <section class="adminPanel" id="adminPanel" aria-label="Admin actions">
        <div class="resultsHeader">
          <div class="sectionTitle">Admin Actions</div>
          <button class="iconButton panelCloseButton" id="closeAdmin" type="button" aria-label="Close admin actions" title="Close admin actions">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>
          </button>
        </div>
        <div class="filterSummary" id="adminSummary"></div>
        <div class="adminActions" id="adminActions"></div>
      </section>
      <section class="activityPanel" id="activityPanel" aria-label="Activity">
        <div class="resultsHeader">
          <div class="sectionTitle">Activity</div>
          <button class="iconButton panelCloseButton" id="closeActivity" type="button" aria-label="Close activity" title="Close activity">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>
          </button>
        </div>
        <div class="filterSummary" id="activitySummary"></div>
        <div class="activityList" id="activityList"></div>
      </section>
      <section class="draftsPanel" id="draftsPanel" aria-label="Drafts">
        <div class="resultsHeader">
          <div class="sectionTitle">Drafts</div>
          <button class="iconButton panelCloseButton" id="closeDrafts" type="button" aria-label="Close drafts" title="Close drafts">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>
          </button>
        </div>
        <div class="savedDrafts" id="savedDrafts"></div>
        <div class="draftActions">
          <button class="primary" id="submitDrafts" type="button">Submit drafts</button>
          <button class="secondary" id="clearDrafts" type="button">Clear drafts</button>
        </div>
      </section>
      <section class="documentsPanel" id="documentsPanel" aria-label="Documents">
        <div class="resultsHeader">
          <button class="collapsibleHeader resultsPanelToggle" id="toggleDocumentsPanelBody" type="button" aria-expanded="true">
            <span class="sectionTitle">Documents</span>
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"></path></svg>
          </button>
          <button class="iconButton panelIconButton" id="refreshDocuments" type="button" aria-label="Refresh documents" title="Refresh documents">
            <svg class="filterIcon" aria-hidden="true" focusable="false" viewBox="0 0 24 24">
              <path d="M21 12a9 9 0 0 1-15.4 6.4L3 16"></path><path d="M3 16v5h5"></path><path d="M3 12a9 9 0 0 1 15.4-6.4L21 8"></path><path d="M21 8V3h-5"></path>
            </svg>
          </button>
          <button class="iconButton panelCloseButton" id="closeDocuments" type="button" aria-label="Close documents" title="Close documents">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>
          </button>
        </div>
        <div class="documentsPanelBody" id="documentsPanelBody">
          <div class="documentsSessionOptions" id="documentsSessionOptions"></div>
          <div class="filterSummary" id="documentsSummary"></div>
          <div class="documentUploadControls">
            <input id="documentTitle" type="text" placeholder="Document title">
            <input id="documentFile" type="file" accept=".md,.pdf,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp,application/pdf,text/markdown,text/plain">
            <button class="primary" id="uploadDocument" type="button">Upload document</button>
            <input id="documentUrl" type="url" inputmode="url" placeholder="Add document URL">
            <button class="secondary" id="addDocumentUrl" type="button">Add URL</button>
          </div>
          <div class="documentList" id="documentList"></div>
        </div>
      </section>
      <section class="resultsPanel" id="resultsPanel" aria-label="Results">
        <div class="resultsHeader">
          <div class="resultsTitleRow">
            <div class="sectionTitle resultsTitle">Results <span class="inlineSpinner resultsLoadingSpinner" id="resultsLoadingSpinner" aria-label="Loading results" hidden></span><span class="resultsTitleSession" id="resultsTitleSession"></span></div>
            <button class="iconButton headerIconButton filterButton" id="showResultFilters" type="button" aria-label="Filter results" aria-expanded="false" title="Filter results">
              <svg class="filterIcon" aria-hidden="true" focusable="false" viewBox="0 0 24 24">
                <path d="M3 5h18l-7 8v5l-4 2v-7L3 5z"></path>
              </svg>
            </button>
          </div>
          <button class="iconButton panelCloseButton" id="closeResults" type="button" aria-label="Close results" title="Close results">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>
          </button>
        </div>
        <div class="resultsPanelBody" id="resultsPanelBody">
          <div class="filterSummary" id="resultsSummary"></div>
          <section class="resultFilters collapsed" id="resultFilters" aria-label="Result filters" hidden>
            <div class="resultFilterHeader">
              <button class="collapsibleHeader" id="toggleResultFilters" type="button" aria-expanded="false">
                <span>Filter Results</span>
                <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"></path></svg>
              </button>
              <button class="secondary" id="clearResultFilters" type="button">Clear</button>
            </div>
            <div class="collapsibleBody">
              <div class="filterSummary" id="resultFilterSummary"></div>
              <div class="resultFilterOptions" id="resultFilterOptions"></div>
            </div>
          </section>
          <div class="resultColumns">
            <section class="resultSection collapsed" id="divisiveSection" aria-label="Most difference questions">
              <button class="collapsibleHeader" id="toggleDivisiveSection" type="button" aria-expanded="false">
                <span>Most difference</span>
                <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"></path></svg>
              </button>
              <div class="collapsibleBody">
                <div class="resultList" id="divisiveResults"></div>
                <button class="secondary moreResultsButton" id="moreDivisiveResults" type="button">More</button>
              </div>
            </section>
            <section class="resultSection collapsed" id="consensusSection" aria-label="Most consensus questions">
              <button class="collapsibleHeader" id="toggleConsensusSection" type="button" aria-expanded="false">
                <span>Most consensus</span>
                <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"></path></svg>
              </button>
              <div class="collapsibleBody">
                <div class="resultList" id="consensusResults"></div>
                <button class="secondary moreResultsButton" id="moreConsensusResults" type="button">More</button>
              </div>
            </section>
          </div>
          <section class="resultSection collapsed" id="resultGroupsSection" aria-label="Groups">
            <button class="collapsibleHeader" id="toggleResultGroupsSection" type="button" aria-expanded="false">
              <span>Groups</span>
              <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"></path></svg>
            </button>
            <div class="collapsibleBody">
              <div class="resultClusterControls" id="resultClusterControls"></div>
              <div class="resultGroupChart" id="resultGroupChart"></div>
              <div class="resultGroups" id="resultGroups"></div>
              <section class="resultSection collapsed groupAnalysis" id="groupAnalysisSection" aria-label="Group analysis">
                <button class="collapsibleHeader" id="toggleGroupAnalysisSection" type="button" aria-expanded="false">
                  <span>Group analysis</span>
                  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"></path></svg>
                </button>
                <div class="collapsibleBody groupAnalysis" id="groupAnalysis"></div>
              </section>
            </div>
          </section>
          <section class="resultSection collapsed" id="topicMapSection" aria-label="Topic map">
            <button class="collapsibleHeader" id="toggleTopicMapSection" type="button" aria-expanded="false">
              <span>Topic map</span>
              <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"></path></svg>
            </button>
            <div class="collapsibleBody">
              <div class="resultTopicMap" id="topicMapChart"></div>
              <div class="filterSummary" id="topicMapSummary"></div>
            </div>
          </section>
        </div>
      </section>
      <section class="groupsPanel" id="groupsPanel" aria-label="Groups">
        <div class="resultsHeader">
          <div class="sectionTitle groupsTitle">Groups <span class="groupsTitleSession" id="groupsTitleSession"></span></div>
          <button class="iconButton panelCloseButton" id="closeGroups" type="button" aria-label="Close groups" title="Close groups">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>
          </button>
        </div>
        <div class="filterSummary" id="groupsSummary"></div>
        <div class="groupProposals" id="groupProposals"></div>
        <div class="groupCategories" id="groupCategories"></div>
        <div class="groupActions">
          <button class="primary" id="saveGroups" type="button">Save groups</button>
        </div>
      </section>
      <section class="addQuestionPanel" id="addQuestionPanel" aria-label="Add question">
        <div class="resultsHeader">
          <div class="sectionTitle addQuestionTitle">
            <span>Add question</span>
            <button class="addQuestionFromUrlToggle" id="toggleAddQuestionUrl" type="button">from URL</button>
            <span class="addQuestionTitleSession" id="addQuestionTitleSession"></span>
          </div>
          <button class="iconButton panelCloseButton" id="closeAddQuestion" type="button" aria-label="Close add question" title="Close add question">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>
          </button>
        </div>
        <div class="questionTypeButtons" id="addQuestionTypes"></div>
        <div class="addQuestionControls">
          <div class="addQuestionUrlControls" id="addQuestionUrlControls" hidden>
            <div class="addQuestionUrlRow">
              <input id="addQuestionUrl" type="url" placeholder="https://example.com/source">
              <button class="secondary" id="generateUrlQuestions" type="button">Generate</button>
            </div>
            <div class="urlQuestionCandidates" id="urlQuestionCandidates"></div>
            <button class="primary" id="submitUrlQuestions" type="button" hidden>Add generated questions</button>
          </div>
          <div class="commentBox addQuestionPromptBox">
            <textarea id="addQuestionPrompt" placeholder="Question prompt"></textarea>
            <div class="commentActions">
              <button class="secondary micButton" id="addQuestionMic" type="button" aria-label="Dictate question" aria-pressed="false"></button>
            </div>
          </div>
          <textarea id="addQuestionOptions" placeholder="Choices, one per line or separated by commas" hidden></textarea>
          <button class="primary" id="submitAddQuestion" type="button">Add question</button>
        </div>
        <div class="filterSummary" id="addQuestionSummary"></div>
      </section>
      <section class="filterPanel" id="filterPanel" aria-label="Question filters">
        <div class="resultsHeader">
          <div class="sectionTitle">Filter</div>
          <button class="iconButton panelCloseButton" id="closeFilter" type="button" aria-label="Close filters" title="Close filters">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>
          </button>
        </div>
        <div class="filterControls">
          <label class="toggle">
            <input id="filterUnansweredFirst" type="checkbox" checked>
            <span>Show un-answered questions first</span>
          </label>
          <label class="toggle">
            <input id="filterAnsweredOnly" type="checkbox">
            <span>Only answered questions</span>
          </label>
          <div class="topPopularFilter" aria-label="Top popular questions">
            <div class="topPopularInline">
              <label class="toggle">
                <input id="filterTopPopular" type="checkbox">
                <span>Top popular questions</span>
              </label>
              <div class="topPopularStepper">
                <button class="secondary" id="decrementTopPopular" type="button" aria-label="Show two fewer popular questions">-</button>
                <input id="filterTopPopularLimit" type="number" inputmode="numeric" min="2" max="50" step="2" value="10" aria-label="Top popular question count">
                <button class="secondary" id="incrementTopPopular" type="button" aria-label="Show two more popular questions">+</button>
              </div>
            </div>
          </div>
          <section class="filterSubsection collapsed" id="questionTypeFilterSection" aria-label="Question type filters">
            <button class="collapsibleHeader" id="toggleQuestionTypeFilters" type="button" aria-expanded="false">
              <span>Question type</span>
              <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"></path></svg>
            </button>
            <div class="collapsibleBody">
              <div class="typeFilters" id="questionTypeFilters"></div>
            </div>
          </section>
          <div class="field tagFilterField">
            <button class="collapsibleHeader" id="toggleQuestionTagFilters" type="button" aria-expanded="false">
              <span class="tagFilterHeading">
                <span>Tags</span>
                <span class="tagFilterHint" id="questionTagFilterHint"></span>
              </span>
              <span class="tagFilterCaret" aria-hidden="true"></span>
            </button>
            <div class="typeFilters" id="questionTagFilters"></div>
          </div>
          <section class="filterSubsection collapsed" id="aiSearchFilterSection" aria-label="AI search filter">
            <button class="collapsibleHeader" id="toggleAiSearchFilter" type="button" aria-expanded="false">
              <span>AI search</span>
              <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"></path></svg>
            </button>
            <div class="collapsibleBody">
              <div class="filterSearchRow">
                <input id="filterAiSearch" type="search" placeholder="Describe questions to find">
                <button class="secondary micButton" id="filterAiSearchMic" type="button" aria-label="Dictate AI search" aria-pressed="false"></button>
                <button class="secondary" id="clearAiSearch" type="button" hidden>Clear</button>
              </div>
            </div>
          </section>
          <div class="filterSummary" id="filterSummary"></div>
        </div>
      </section>
      <section class="settingsPanel" id="settingsPanel" aria-label="Agent settings">
        <div class="resultsHeader">
          <div class="sectionTitle">Settings</div>
          <button class="iconButton panelCloseButton" id="closeSettings" type="button" aria-label="Close settings" title="Close settings">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>
          </button>
        </div>
        <div class="field">
          <label for="draftStyle">Draft style</label>
          <select id="draftStyle"></select>
        </div>
        <div class="field">
          <label for="topicPreferences">Topics</label>
          <textarea id="topicPreferences" rows="2" placeholder="AI futures, governance, Edge City"></textarea>
        </div>
        <label class="toggle">
          <input id="demographicLinkOptIn" type="checkbox">
          <span>Link demographics</span>
        </label>
        <label class="toggle">
          <input id="attendanceLinkOptIn" type="checkbox">
          <span>Ask about Edge events</span>
        </label>
        <label class="toggle">
          <input id="draftDivergenceOptIn" type="checkbox">
          <span>Draft edit research</span>
        </label>
        <label class="toggle">
          <input id="agentAutoApplyQuestionVotes" type="checkbox">
          <span>Agent auto-votes</span>
        </label>
        <button class="primary" id="saveSettings" type="button">Save</button>
      </section>
    </header>
    <section class="layout">
      <section class="questionStack" id="questionStack" aria-label="Questions"></section>
    </section>
  </main>
  <script>
    const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
    if (tg) {
      tg.ready();
      if (typeof tg.expand === 'function') tg.expand();
    }
    function syncTelegramViewportHeight() {
      const height = tg && Number(tg.viewportStableHeight || tg.viewportHeight);
      if (Number.isFinite(height) && height > 0) {
        document.documentElement.style.setProperty('--tg-viewport-height', height + 'px');
      }
    }
    syncTelegramViewportHeight();
    if (tg && typeof tg.onEvent === 'function') tg.onEvent('viewportChanged', syncTelegramViewportHeight);
    const params = new URLSearchParams(location.search);
    const launch = params.get('launch') || params.get('tgWebAppStartParam') || (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || '';
    const QUESTION_RETRY_DELAY_MS = 4000;
    const DRAFT_AUTOSAVE_DELAY_MS = 700;
    const ANSWER_CHANGE_SUBMIT_GUARD_MS = 900;
    const RESULT_GROUP_COUNT = 2;
    const SHOW_UNANSWERED_STORAGE_KEY = 'ce:telegram-mini-app:show-unanswered-first';
    const DEMO_RESULTS_STORAGE_KEY = 'ce:telegram-mini-app:demo-results:v2';
    const LOADING_VISUAL_MODE = ${JSON.stringify(normalizedLoadingVisual)};
    const MINI_APP_LAUNCH_RECOVERY_MESSAGE = ${JSON.stringify(launchRecoveryMessage)};
    const readShowUnansweredFirst = () => {
      try { return window.localStorage.getItem(SHOW_UNANSWERED_STORAGE_KEY) !== 'false'; } catch { return true; }
    };
    const writeShowUnansweredFirst = (value) => {
      try { window.localStorage.setItem(SHOW_UNANSWERED_STORAGE_KEY, value ? 'true' : 'false'); } catch {}
    };
    const readDemoResults = () => {
      try { return window.localStorage.getItem(DEMO_RESULTS_STORAGE_KEY) === 'true'; } catch { return false; }
    };
    const writeDemoResults = (value) => {
      try { window.localStorage.setItem(DEMO_RESULTS_STORAGE_KEY, value ? 'true' : 'false'); } catch {}
    };
    const POPULAR_QUESTION_LIMIT_DEFAULT = 10;
    const POPULAR_QUESTION_LIMIT_MIN = 2;
    const POPULAR_QUESTION_LIMIT_MAX = 50;
    const POPULAR_QUESTION_LIMIT_STEP = 2;
    const FAST_INITIAL_QUESTION_LIMIT = ${fastInitialQuestionLimit};
    const FAST_FOLLOWUP_QUESTION_COUNT = ${fastFollowupQuestionCount};
    const FAST_FOLLOWUP_DELAY_MS = ${fastFollowupDelayMs};
    const BACKGROUND_PAGE_DELAY_MS = ${backgroundPageDelayMs};
    const MAX_QUESTION_LIMIT = ${maxQuestionLimit};
    const QUESTION_TAG_LIMIT = 10;
    const QUESTION_TAG_FILTER_COLLAPSED_LIMIT = 5;
    const state = {
      data: null,
      activeKey: '',
      drafts: {},
      draftAutosaveTimers: new Map(),
      draftAutosaveVersions: new Map(),
      retryTimer: null,
      autoQuestionLoadTimer: null,
      aiSearchTimer: null,
      aiSearchResultQuery: '',
      aiSearchResultScores: new Map(),
      aiSearchSource: '',
      submitting: false,
      selectedSessionSlugs: new Set(),
      savedDraftKeys: new Set(),
      submittedAnswerKeys: new Set(),
      submittedAnswersByQuestionKey: new Map(),
      answerChangedAtByQuestionKey: new Map(),
      answerSubmitGuardTimers: new Map(),
      submitDraftsBusy: false,
      submitDraftsMessage: '',
      showUnansweredFirst: readShowUnansweredFirst(),
      answeredQuestionsOnly: false,
      popularQuestionsOnly: false,
      popularQuestionLimit: POPULAR_QUESTION_LIMIT_DEFAULT,
      selectedQuestionTypes: new Set(),
      selectedQuestionTags: new Set(),
      questionTypeFiltersExpanded: false,
      questionTagFiltersExpanded: false,
      aiSearchFilterExpanded: false,
      aiDraftQuery: '',
      aiSearchQuery: '',
      resultsData: null,
      resultsLoading: false,
      resultsSessionSlug: '',
      resultsDemoData: readDemoResults(),
      resultVisibleCounts: { consensus: 5, divisive: 5 },
      resultClusterCount: RESULT_GROUP_COUNT,
      resultSectionsOpen: {
        filters: false,
        consensus: false,
        divisive: true,
        groups: false,
        topicMap: false,
        groupAnalysis: false,
      },
      resultFilters: { selections: {}, details: {} },
      resultFilterCategoryOpen: {},
      resultsCache: new Map(),
      resultsCacheKey: '',
      resultsLoadError: '',
      resultsRequestId: 0,
      groupAnalysisById: {},
      groupAnalysisProgressTimer: null,
      documentsData: null,
      documentsLoading: false,
      documentsUploading: false,
      documentsSessionSlug: '',
      documentsMessage: '',
      documentsSectionOpen: true,
      adminPanelMessage: '',
      adminActiveAction: '',
      adminAddress: '',
      adminBusy: false,
      adminData: null,
      adminExportUrl: '',
      activityData: null,
      activityLoading: false,
      activityMessage: '',
      groupsData: null,
      groupsLoading: false,
      groupsSaving: false,
      groupsSaveMessage: '',
      groupsSaveMessageTimer: null,
      groupsSessionSlug: '',
      groupCategoryOpen: {},
      groupSelections: {},
      groupDetails: {},
      addQuestionSessionSlug: '',
      addQuestionType: 'agree_unsure_disagree',
      addQuestionSessionContext: '',
      addQuestionPrompt: '',
      addQuestionOptions: '',
      addQuestionTags: '',
      addQuestionUrlOpen: false,
      addQuestionUrl: '',
      addQuestionUrlCandidates: [],
      addQuestionUrlGenerating: false,
      addQuestionUrlSubmitting: false,
      addQuestionSaving: false,
      addQuestionMessage: '',
      expandedQuestionKeys: new Set(),
      highlightedQuestionKey: '',
      highlightScrollDone: false,
      seriesActiveIndex: 0,
      seriesSkippedKeys: new Set(),
      sessionsPanelOpen: false,
      questionLimit: FAST_INITIAL_QUESTION_LIMIT,
      loadedOnce: false,
      questionsLoading: false,
      loadingMoreQuestions: false,
      backgroundQuestionLoadPending: false,
      loadingProgressTimer: null,
      loadingProgressPercent: 18,
    };
    const el = {
      meta: document.getElementById('meta'),
      status: document.getElementById('status'),
      showToolMenu: document.getElementById('showToolMenu'),
      toolMenu: document.getElementById('toolMenu'),
      showSessions: document.getElementById('showSessions'),
      showDocuments: document.getElementById('showDocuments'),
      documentsPanel: document.getElementById('documentsPanel'),
      toggleDocumentsPanelBody: document.getElementById('toggleDocumentsPanelBody'),
      documentsPanelBody: document.getElementById('documentsPanelBody'),
      refreshDocuments: document.getElementById('refreshDocuments'),
      closeDocuments: document.getElementById('closeDocuments'),
      documentsSessionOptions: document.getElementById('documentsSessionOptions'),
      documentsSummary: document.getElementById('documentsSummary'),
      documentTitle: document.getElementById('documentTitle'),
      documentFile: document.getElementById('documentFile'),
      uploadDocument: document.getElementById('uploadDocument'),
      documentUrl: document.getElementById('documentUrl'),
      addDocumentUrl: document.getElementById('addDocumentUrl'),
      documentList: document.getElementById('documentList'),
      showAdmin: document.getElementById('showAdmin'),
      adminPanel: document.getElementById('adminPanel'),
      adminSummary: document.getElementById('adminSummary'),
      adminActions: document.getElementById('adminActions'),
      closeAdmin: document.getElementById('closeAdmin'),
      showActivity: document.getElementById('showActivity'),
      activityPanel: document.getElementById('activityPanel'),
      activitySummary: document.getElementById('activitySummary'),
      activityList: document.getElementById('activityList'),
      closeActivity: document.getElementById('closeActivity'),
      showDrafts: document.getElementById('showDrafts'),
      draftsPanel: document.getElementById('draftsPanel'),
      closeDrafts: document.getElementById('closeDrafts'),
      sessionPicker: document.getElementById('sessionPicker'),
      sessionSummary: document.getElementById('sessionSummary'),
      sessionPickerBody: document.getElementById('sessionPickerBody'),
      sessionOptions: document.getElementById('sessionOptions'),
      continueSessions: document.getElementById('continueSessions'),
      closeSessions: document.getElementById('closeSessions'),
      questionStack: document.getElementById('questionStack'),
      showResults: document.getElementById('showResults'),
      resultsPanel: document.getElementById('resultsPanel'),
      resultsPanelBody: document.getElementById('resultsPanelBody'),
      closeResults: document.getElementById('closeResults'),
      resultsTitleSession: document.getElementById('resultsTitleSession'),
      resultsLoadingSpinner: document.getElementById('resultsLoadingSpinner'),
      showResultFilters: document.getElementById('showResultFilters'),
      resultFilters: document.getElementById('resultFilters'),
      toggleResultFilters: document.getElementById('toggleResultFilters'),
      resultFilterSummary: document.getElementById('resultFilterSummary'),
      resultFilterOptions: document.getElementById('resultFilterOptions'),
      clearResultFilters: document.getElementById('clearResultFilters'),
      consensusSection: document.getElementById('consensusSection'),
      toggleConsensusSection: document.getElementById('toggleConsensusSection'),
      moreConsensusResults: document.getElementById('moreConsensusResults'),
      divisiveSection: document.getElementById('divisiveSection'),
      toggleDivisiveSection: document.getElementById('toggleDivisiveSection'),
      moreDivisiveResults: document.getElementById('moreDivisiveResults'),
      resultGroupsSection: document.getElementById('resultGroupsSection'),
      toggleResultGroupsSection: document.getElementById('toggleResultGroupsSection'),
      resultClusterControls: document.getElementById('resultClusterControls'),
      resultGroupChart: document.getElementById('resultGroupChart'),
      topicMapSection: document.getElementById('topicMapSection'),
      toggleTopicMapSection: document.getElementById('toggleTopicMapSection'),
      topicMapChart: document.getElementById('topicMapChart'),
      topicMapSummary: document.getElementById('topicMapSummary'),
      groupAnalysisSection: document.getElementById('groupAnalysisSection'),
      toggleGroupAnalysisSection: document.getElementById('toggleGroupAnalysisSection'),
      resultsSummary: document.getElementById('resultsSummary'),
      consensusResults: document.getElementById('consensusResults'),
      divisiveResults: document.getElementById('divisiveResults'),
      resultGroups: document.getElementById('resultGroups'),
      groupAnalysis: document.getElementById('groupAnalysis'),
      showGroups: document.getElementById('showGroups'),
      groupsPanel: document.getElementById('groupsPanel'),
      closeGroups: document.getElementById('closeGroups'),
      groupsTitleSession: document.getElementById('groupsTitleSession'),
      groupsSummary: document.getElementById('groupsSummary'),
      groupProposals: document.getElementById('groupProposals'),
      groupCategories: document.getElementById('groupCategories'),
      saveGroups: document.getElementById('saveGroups'),
      showAddQuestion: document.getElementById('showAddQuestion'),
      addQuestionPanel: document.getElementById('addQuestionPanel'),
      closeAddQuestion: document.getElementById('closeAddQuestion'),
      addQuestionTitleSession: document.getElementById('addQuestionTitleSession'),
      addQuestionTypes: document.getElementById('addQuestionTypes'),
      toggleAddQuestionUrl: document.getElementById('toggleAddQuestionUrl'),
      addQuestionUrlControls: document.getElementById('addQuestionUrlControls'),
      addQuestionUrl: document.getElementById('addQuestionUrl'),
      generateUrlQuestions: document.getElementById('generateUrlQuestions'),
      urlQuestionCandidates: document.getElementById('urlQuestionCandidates'),
      submitUrlQuestions: document.getElementById('submitUrlQuestions'),
      addQuestionPrompt: document.getElementById('addQuestionPrompt'),
      addQuestionMic: document.getElementById('addQuestionMic'),
      addQuestionOptions: document.getElementById('addQuestionOptions'),
      submitAddQuestion: document.getElementById('submitAddQuestion'),
      addQuestionSummary: document.getElementById('addQuestionSummary'),
      showFilter: document.getElementById('showFilter'),
      filterPanel: document.getElementById('filterPanel'),
      closeFilter: document.getElementById('closeFilter'),
      filterUnansweredFirst: document.getElementById('filterUnansweredFirst'),
      filterAnsweredOnly: document.getElementById('filterAnsweredOnly'),
      filterTopPopular: document.getElementById('filterTopPopular'),
      filterTopPopularLimit: document.getElementById('filterTopPopularLimit'),
      decrementTopPopular: document.getElementById('decrementTopPopular'),
      incrementTopPopular: document.getElementById('incrementTopPopular'),
      questionTypeFilterSection: document.getElementById('questionTypeFilterSection'),
      toggleQuestionTypeFilters: document.getElementById('toggleQuestionTypeFilters'),
      questionTypeFilters: document.getElementById('questionTypeFilters'),
      toggleQuestionTagFilters: document.getElementById('toggleQuestionTagFilters'),
      questionTagFilterHint: document.getElementById('questionTagFilterHint'),
      questionTagFilters: document.getElementById('questionTagFilters'),
      aiSearchFilterSection: document.getElementById('aiSearchFilterSection'),
      toggleAiSearchFilter: document.getElementById('toggleAiSearchFilter'),
      filterAiSearch: document.getElementById('filterAiSearch'),
      filterAiSearchMic: document.getElementById('filterAiSearchMic'),
      clearAiSearch: document.getElementById('clearAiSearch'),
      filterSummary: document.getElementById('filterSummary'),
      showSettings: document.getElementById('showSettings'),
      settingsPanel: document.getElementById('settingsPanel'),
      closeSettings: document.getElementById('closeSettings'),
      draftStyle: document.getElementById('draftStyle'),
      topicPreferences: document.getElementById('topicPreferences'),
      demographicLinkOptIn: document.getElementById('demographicLinkOptIn'),
      attendanceLinkOptIn: document.getElementById('attendanceLinkOptIn'),
      draftDivergenceOptIn: document.getElementById('draftDivergenceOptIn'),
      showAgentResponses: document.getElementById('showAgentResponses'),
      demoDataResults: document.getElementById('demoDataResults'),
      agentAutoApplyQuestionVotes: document.getElementById('agentAutoApplyQuestionVotes'),
      saveSettings: document.getElementById('saveSettings'),
      savedDrafts: document.getElementById('savedDrafts'),
      submitDrafts: document.getElementById('submitDrafts'),
      clearDrafts: document.getElementById('clearDrafts'),
    };
    const MIC_ICON = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z"></path><path d="M17 11a1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V21a1 1 0 1 1-2 0v-3.07A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0z"></path></svg>';
    const STOP_ICON = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M7 7h10v10H7z"></path></svg>';
    const CHECK_ICON = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"></path></svg>';
    const CARET_DOWN_ICON = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"></path></svg>';
    const CARET_UP_ICON = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"></path></svg>';
    const VOTE_UP_ICON = '<span class="voteGlyph" aria-hidden="true">+</span>';
    const VOTE_DOWN_ICON = '<span class="voteGlyph" aria-hidden="true">-</span>';
    const QUESTION_TYPES = [
      ['agree_unsure_disagree', 'Agree'],
      ['rating', 'Rating'],
      ['multichoice', 'Multi-choice'],
      ['freeform', 'Freeform'],
    ];
    const URL_GENERATED_QUESTION_COUNT = 5;
    const COUNTRY_OPTIONS = [
      ['', 'Select country'],
      ['United States', 'United States'],
      ['Canada', 'Canada'],
      ['Mexico', 'Mexico'],
      ['United Kingdom', 'United Kingdom'],
      ['Germany', 'Germany'],
      ['France', 'France'],
      ['Netherlands', 'Netherlands'],
      ['Portugal', 'Portugal'],
      ['Brazil', 'Brazil'],
      ['Argentina', 'Argentina'],
      ['India', 'India'],
      ['Japan', 'Japan'],
      ['Singapore', 'Singapore'],
      ['Australia', 'Australia'],
      ['Other', 'Other'],
    ];
    const ADMIN_ACTION_LABELS = {
      export_all: 'Export data',
      export_access: 'Manage permissions',
      results_settings: 'Results settings',
      question_queue: 'Question queue',
      group_link: 'Add group link',
      export_allow: 'Add admin',
      export_revoke: 'Remove admin',
    };
    const DEFAULT_ADMIN_ACTION_IDS = ['export_all', 'export_access', 'results_settings', 'question_queue', 'group_link'];
    const DEFAULT_ADMIN_ACTIONS = DEFAULT_ADMIN_ACTION_IDS.map((action) => ({
      action,
      label: ADMIN_ACTION_LABELS[action],
    }));
    el.filterAiSearchMic.dataset.idleLabel = 'Dictate AI search';
    el.filterAiSearchMic.dataset.stopLabel = 'Stop recording AI search';
    el.filterAiSearchMic.innerHTML = MIC_ICON;
    const headers = ({ json = true } = {}) => {
      const out = json ? { 'content-type': 'application/json' } : {};
      if (tg && tg.initData) out['x-telegram-init-data'] = tg.initData;
      return out;
    };
    const userFacingErrorMessage = (body = {}, fallback = 'Something went wrong.') => {
      if (body?.error === 'mini_app_launch_invalid') {
        return body.message || body.launchRecovery?.message || MINI_APP_LAUNCH_RECOVERY_MESSAGE;
      }
      return body?.message || body?.error || fallback;
    };
    const selectedSessionQuery = () => Array.from(state.selectedSessionSlugs).filter(Boolean).join(',');
    const selectedResultsSessions = () => {
      const pickerSessions = Array.isArray(state.data?.sessionPicker?.sessions) ? state.data.sessionPicker.sessions : [];
      const selected = Array.from(state.selectedSessionSlugs).filter(Boolean);
      return selected.map((slug) => {
        const session = pickerSessions.find((item) => item.sessionSlug === slug) || {};
        return { sessionSlug: slug, sessionName: session.sessionName || slug };
      });
    };
    const ensureResultsSessionSlug = () => {
      const sessions = selectedResultsSessions();
      if (!state.resultsSessionSlug || !sessions.some((session) => session.sessionSlug === state.resultsSessionSlug)) {
        state.resultsSessionSlug = sessions[0]?.sessionSlug || state.data?.session?.sessionSlug || '';
      }
      return sessions;
    };
    const resultFilterCacheKey = () => JSON.stringify(resultFilterPayload());
    const currentResultsCacheKey = () => [
      state.resultsDemoData ? 'demo' : 'live',
      state.resultsSessionSlug || '',
      String(RESULT_GROUP_COUNT),
      state.resultsDemoData ? '' : resultFilterCacheKey(),
    ].join('|');
    const restoreCachedResults = () => {
      ensureResultsSessionSlug();
      const key = currentResultsCacheKey();
      state.resultsCacheKey = key;
      state.resultsLoadError = '';
      state.resultsData = state.resultsCache.get(key) || null;
    };
    const resetResultsForSelection = () => {
      state.resultsData = null;
      state.resultsSessionSlug = '';
      state.groupAnalysisById = {};
      stopGroupAnalysisProgressTimer();
      state.resultVisibleCounts = { consensus: 5, divisive: 5 };
      state.resultFilterCategoryOpen = {};
      state.resultsCacheKey = '';
      state.resultsLoadError = '';
    };
    const resetGroupsForSelection = () => {
      state.groupsData = null;
      state.groupsSessionSlug = '';
      state.groupCategoryOpen = {};
      state.groupSelections = {};
      state.groupDetails = {};
      state.groupsSaveMessage = '';
    };
    const resetDocumentsForSelection = () => {
      state.documentsData = null;
      state.documentsSessionSlug = '';
      state.documentsMessage = '';
    };
    const resetActivityForSelection = () => {
      state.activityData = null;
      state.activityMessage = '';
      state.activityLoading = false;
    };
    const resetAddQuestionForSelection = () => {
      state.addQuestionSessionSlug = '';
      state.addQuestionSessionContext = '';
      state.addQuestionTags = '';
      state.addQuestionUrl = '';
      state.addQuestionUrlCandidates = [];
      state.addQuestionUrlGenerating = false;
      state.addQuestionUrlSubmitting = false;
      state.addQuestionMessage = '';
    };
    const activeQuestion = () => (state.data?.questions || []).find((question) => question.questionKey === state.activeKey) || null;
    const draftFor = (question) => {
      if (!question) return {};
      state.drafts[question.questionKey] = state.drafts[question.questionKey] || {};
      return state.drafts[question.questionKey];
    };
    const answerHasContent = (answer) => {
      if (!answer || typeof answer !== 'object') return false;
      if (Array.isArray(answer.values) && answer.values.length > 0) return true;
      return ['value', 'text', 'comments'].some((key) => {
        const value = answer[key];
        return value !== undefined && value !== null && String(value).trim() !== '';
      });
    };
    const submittedAnswerFor = (question) => state.submittedAnswersByQuestionKey.get(question?.questionKey) || null;
    const answerLabelForQuestion = (question, answer = {}) => {
      if (question?.questionType === 'agree_unsure_disagree') {
        return ({ agree: 'Agree', unsure: 'Unsure', disagree: 'Disagree' })[String(answer.value || '')] || String(answer.value || '');
      }
      if (question?.questionType === 'rating') {
        return answer.value === undefined || answer.value === null ? '' : String(answer.value);
      }
      if (question?.questionType === 'multichoice') {
        return Array.isArray(answer.values) ? answer.values.join(', ') : '';
      }
      return String(answer.text || answer.value || '').trim();
    };
    const normalizeAnswerForCompare = (answer = {}) => JSON.stringify({
      value: answer.value === undefined || answer.value === null ? '' : String(answer.value).trim(),
      text: String(answer.text || '').trim(),
      comments: String(answer.comments || '').trim(),
      values: Array.isArray(answer.values) ? answer.values.map((value) => String(value).trim()).filter(Boolean).sort() : [],
    });
    const currentAnswerMatchesSubmitted = (question) => {
      const submittedAnswer = submittedAnswerFor(question);
      if (!submittedAnswer?.answer) return false;
      return normalizeAnswerForCompare(answerPayload(question)) === normalizeAnswerForCompare(submittedAnswer.answer);
    };
    const answerChangeGuardActive = (question) => {
      const changedAt = Number(state.answerChangedAtByQuestionKey.get(question?.questionKey) || 0);
      return changedAt > 0 && Date.now() - changedAt < ANSWER_CHANGE_SUBMIT_GUARD_MS;
    };
    const cardsForQuestion = (question, sourceElement = null) => {
      const sourceCard = sourceElement?.closest?.('.card');
      if (sourceCard) return [sourceCard];
      const key = question?.questionKey || '';
      if (!key) return [];
      return Array.from(el.questionStack?.querySelectorAll?.('.card') || [])
        .filter((card) => card.dataset?.questionKey === key);
    };
    const applySubmitButtonState = (button, question, { busy = false } = {}) => {
      if (!button) return;
      const submittedCurrentAnswer = !busy && currentAnswerMatchesSubmitted(question);
      const guarded = !busy && !submittedCurrentAnswer && answerChangeGuardActive(question);
      button.classList.toggle('submittedCheck', submittedCurrentAnswer);
      button.disabled = busy || !question?.canAnswer || submittedCurrentAnswer || guarded;
      button.setAttribute('aria-busy', busy ? 'true' : 'false');
      if (submittedCurrentAnswer) {
        button.innerHTML = CHECK_ICON;
        button.setAttribute('aria-label', 'Submitted');
        button.title = 'Submitted';
        return;
      }
      if (guarded) {
        button.textContent = 'Review';
        button.setAttribute('aria-label', 'Review answer before submitting');
        button.title = 'Review answer before submitting';
        return;
      }
      button.textContent = busy ? 'Submitting...' : 'Submit';
      button.setAttribute('aria-label', busy ? 'Submitting answer' : 'Submit answer');
      button.title = busy ? 'Submitting answer' : 'Submit answer';
    };
    const shouldShowAnswerActions = (question) => {
      if (!question?.canAnswer || question.locked) return false;
      const payload = answerPayload(question);
      if (!answerHasContent(payload)) return false;
      return !currentAnswerMatchesSubmitted(question);
    };
    const refreshQuestionActionControls = (question, sourceElement) => {
      const visible = shouldShowAnswerActions(question) || seriesModeEnabled();
      cardsForQuestion(question, sourceElement).forEach((card) => {
        const actions = card?.querySelector?.('.cardActions');
        if (actions) actions.hidden = !visible;
        const button = card?.querySelector?.('.submitButton');
        applySubmitButtonState(button, question);
      });
    };
    const refreshQuestionSubmitButton = refreshQuestionActionControls;
    function markAnswerChanged(question) {
      const key = question?.questionKey || '';
      if (!key) return;
      state.answerChangedAtByQuestionKey.set(key, Date.now());
      const existing = state.answerSubmitGuardTimers.get(key);
      if (existing) window.clearTimeout(existing);
      const timer = window.setTimeout(() => {
        state.answerSubmitGuardTimers.delete(key);
        refreshQuestionActionControls(question);
      }, ANSWER_CHANGE_SUBMIT_GUARD_MS);
      state.answerSubmitGuardTimers.set(key, timer);
    }
    const bumpDraftAutosaveVersion = (question) => {
      const key = question?.questionKey || '';
      if (!key) return 0;
      const next = Number(state.draftAutosaveVersions.get(key) || 0) + 1;
      state.draftAutosaveVersions.set(key, next);
      return next;
    };
    const clearDraftAutosave = (question) => {
      const key = question?.questionKey || '';
      if (!key) return;
      const timer = state.draftAutosaveTimers.get(key);
      if (timer) window.clearTimeout(timer);
      state.draftAutosaveTimers.delete(key);
    };
    const scheduleDraftAutosave = (question) => {
      if (!question?.questionKey) return;
      clearDraftAutosave(question);
      if (!shouldShowAnswerActions(question)) return;
      const version = bumpDraftAutosaveVersion(question);
      const key = question.questionKey;
      const timer = window.setTimeout(() => {
        state.draftAutosaveTimers.delete(key);
        sendAnswer(false, question, null, {
          suppressStatus: true,
          autoSave: true,
          autoSaveVersion: version,
        });
      }, DRAFT_AUTOSAVE_DELAY_MS);
      state.draftAutosaveTimers.set(key, timer);
    };
    const questionAnswered = (question) => {
      if (state.submittedAnswerKeys.has(question?.questionKey)) return true;
      return false;
    };
    const questionSeriesState = () => state.data?.questionSeries || {};
    const questionSeriesKeys = () => {
      const series = questionSeriesState();
      return Array.isArray(series.questionKeys) ? series.questionKeys.filter(Boolean) : [];
    };
    const seriesModeEnabled = () => questionSeriesState().enabled === true && questionSeriesKeys().length > 0;
    const currentSeriesQuestionKey = () => {
      const keys = questionSeriesKeys();
      if (!keys.length) return '';
      let index = Math.max(0, Math.min(keys.length - 1, Number(state.seriesActiveIndex || 0)));
      while (
        index < keys.length - 1 &&
        (state.seriesSkippedKeys.has(keys[index]) || state.submittedAnswerKeys.has(keys[index]))
      ) {
        index += 1;
      }
      state.seriesActiveIndex = index;
      return keys[index] || '';
    };
    const advanceSeriesQuestion = (question, { skip = false, renderNow = true } = {}) => {
      if (!seriesModeEnabled() || !question?.questionKey) return false;
      const keys = questionSeriesKeys();
      const currentIndex = Math.max(0, keys.indexOf(question.questionKey));
      if (skip) state.seriesSkippedKeys.add(question.questionKey);
      const nextIndex = keys.findIndex((key, index) => (
        index > currentIndex &&
        !state.seriesSkippedKeys.has(key) &&
        !state.submittedAnswerKeys.has(key)
      ));
      if (nextIndex >= 0) {
        state.seriesActiveIndex = nextIndex;
        state.activeKey = keys[nextIndex];
        const nextQuestion = (state.data?.questions || []).find((entry) => entry.questionKey === keys[nextIndex]);
        if (nextQuestion) expandQuestion(nextQuestion);
      }
      if (renderNow) render();
      return nextIndex >= 0;
    };
    const normalizePopularQuestionLimit = (value) => {
      const parsed = Number.parseInt(String(value || ''), 10);
      if (!Number.isFinite(parsed)) return POPULAR_QUESTION_LIMIT_DEFAULT;
      const bounded = Math.min(POPULAR_QUESTION_LIMIT_MAX, Math.max(POPULAR_QUESTION_LIMIT_MIN, parsed));
      return Math.min(
        POPULAR_QUESTION_LIMIT_MAX,
        Math.max(POPULAR_QUESTION_LIMIT_MIN, Math.round(bounded / POPULAR_QUESTION_LIMIT_STEP) * POPULAR_QUESTION_LIMIT_STEP),
      );
    };
    const setPopularQuestionLimit = (value, { enable = true } = {}) => {
      state.popularQuestionLimit = normalizePopularQuestionLimit(value);
      if (enable) state.popularQuestionsOnly = true;
      render();
    };
    const voteSummaryForQuestion = (question) => {
      const summary = question?.voteSummary || {};
      const up = Number(summary.up || 0);
      const down = Number(summary.down || 0);
      return {
        up,
        down,
        score: Number.isFinite(Number(summary.score)) ? Number(summary.score) : up - down,
        total: Number.isFinite(Number(summary.total)) ? Number(summary.total) : up + down,
        userVote: String(summary.userVote || ''),
      };
    };
    const responseCountForQuestion = (question) => {
      const count = Number(question?.responseCount || 0);
      return Number.isFinite(count) && count > 0 ? count : 0;
    };
    const popularityScoreForQuestion = (question) => {
      // Temporary linear popularity score; replace with weighted/decayed scoring once we have enough signal.
      return voteSummaryForQuestion(question).score + responseCountForQuestion(question);
    };
    const popularitySort = (left, right) => {
      const leftSummary = voteSummaryForQuestion(left.question);
      const rightSummary = voteSummaryForQuestion(right.question);
      return popularityScoreForQuestion(right.question) - popularityScoreForQuestion(left.question) ||
        responseCountForQuestion(right.question) - responseCountForQuestion(left.question) ||
        rightSummary.score - leftSummary.score ||
        rightSummary.total - leftSummary.total ||
        rightSummary.up - leftSummary.up ||
        left.index - right.index;
    };
    const questionTypeLabel = (type) => ({
      agree_unsure_disagree: 'Agree / Unsure / Disagree',
      freeform: 'Freeform input',
      rating: 'Rating',
      multichoice: 'Multiple choice',
    })[String(type || '')] || String(type || 'Question');
    const questionTypeFilterValue = (question) => {
      const type = String(question?.questionType || '').trim();
      if (type) return type;
      if (Array.isArray(question?.options) && question.options.length) return 'multichoice';
      return 'freeform';
    };
    const normalizeQuestionTag = (value) => String(value || '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
    const normalizeQuestionTags = (value) => {
      const source = Array.isArray(value) ? value : String(value || '').split(/[\\n,;|#]+/);
      return source
        .map((tag) => normalizeQuestionTag(tag && typeof tag === 'object' ? (tag.tag || tag.id || tag.label || tag.name) : tag))
        .filter(Boolean)
        .filter((tag, index, values) => values.indexOf(tag) === index)
        .slice(0, QUESTION_TAG_LIMIT);
    };
    const questionTags = (question) => normalizeQuestionTags(question?.tags || []);
    const questionTagLabel = (tag) => String(tag || '')
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    const questionSearchText = (question) => [
      question.prompt,
      question.title,
      question.questionType,
      question.sessionName,
      questionTags(question).join(' '),
      Array.isArray(question.options) ? question.options.join(' ') : '',
    ].map((value) => String(value || '').toLowerCase()).join(' ');
    const QUESTION_SEARCH_SYNONYMS = {
      food: ['pizza', 'meal', 'meals', 'restaurant', 'lunch', 'dinner', 'snack', 'drink', 'coffee'],
      foods: ['pizza', 'meal', 'meals', 'restaurant', 'lunch', 'dinner', 'snack', 'drink', 'coffee'],
      eat: ['pizza', 'meal', 'restaurant', 'lunch', 'dinner', 'snack'],
      eating: ['pizza', 'meal', 'restaurant', 'lunch', 'dinner', 'snack'],
      preference: ['prefer', 'favorite', 'favourite', 'like', 'choice', 'choose'],
      preferences: ['prefer', 'favorite', 'favourite', 'like', 'choice', 'choose'],
      pets: ['pet', 'cat', 'dog', 'animal'],
      animal: ['pet', 'pets', 'cat', 'dog'],
      animals: ['pet', 'pets', 'cat', 'dog'],
      office: ['work', 'workplace', 'company'],
      work: ['office', 'workplace', 'job'],
      risk: ['concern', 'concerns', 'danger', 'safe', 'safety', 'uncertain', 'uncertainty'],
    };
    const searchTokens = (query) => String(query || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1)
      .flatMap((token) => [
        token,
        ...(QUESTION_SEARCH_SYNONYMS[token] || []),
        ...(token.endsWith('s') && token.length > 3 ? [token.slice(0, -1)] : []),
      ])
      .filter((token, index, values) => values.indexOf(token) === index);
    const aiSearchScore = (question, query) => {
      const normalizedQuery = String(query || '').trim();
      if (
        normalizedQuery &&
        state.aiSearchResultQuery === normalizedQuery &&
        state.aiSearchResultScores instanceof Map
      ) {
        if (state.aiSearchResultScores.has(question.questionKey)) {
          return Number(state.aiSearchResultScores.get(question.questionKey) || 0);
        }
        if (state.aiSearchSource === 'ai') return 0;
      }
      const tokens = searchTokens(query);
      if (!tokens.length) return 0;
      const text = questionSearchText(question);
      let score = 0;
      tokens.forEach((token) => {
        if (text.includes(token)) score += token.length + 2;
        else if (token.length > 4 && text.includes(token.slice(0, -1))) score += 2;
      });
      return score;
    };
    const questionMatchesFilters = (question) => {
      if (state.answeredQuestionsOnly && !questionAnswered(question)) return false;
      if (state.selectedQuestionTypes.size && !state.selectedQuestionTypes.has(questionTypeFilterValue(question))) return false;
      if (state.selectedQuestionTags.size) {
        const tags = new Set(questionTags(question));
        if (!Array.from(state.selectedQuestionTags).some((tag) => tags.has(tag))) return false;
      }
      if (state.aiSearchQuery && aiSearchScore(question, state.aiSearchQuery) <= 0) return false;
      return true;
    };
    const filteredQuestionEntries = () => {
      const entries = (state.data?.questions || [])
        .map((question, index) => ({ question, index, score: aiSearchScore(question, state.aiSearchQuery) }))
        .filter(({ question }) => questionMatchesFilters(question));
      if (!state.popularQuestionsOnly) return entries;
      return entries.sort(popularitySort).slice(0, normalizePopularQuestionLimit(state.popularQuestionLimit));
    };
    const questionHasAgentPrediction = (question) => {
      if (!question?.questionKey || state.data?.agentOnly?.showAgentResponses === false) return false;
      return Boolean(state.data?.agentOnly?.predictions?.[question.questionKey]);
    };
    const predictionPrioritySort = (left, right) => (
      Number(questionHasAgentPrediction(right.question)) - Number(questionHasAgentPrediction(left.question))
    );
    const orderedQuestions = () => {
      const questions = filteredQuestionEntries();
      if (seriesModeEnabled()) {
        const activeSeriesKey = currentSeriesQuestionKey();
        return questions
          .map((entry) => entry.question)
          .filter((question) => question.questionKey === activeSeriesKey);
      }
      if (state.popularQuestionsOnly) {
        return questions.map((entry) => entry.question);
      }
      if (state.aiSearchQuery) {
        questions.sort((left, right) => (
          right.score - left.score ||
          predictionPrioritySort(left, right) ||
          Number(questionAnswered(left.question)) - Number(questionAnswered(right.question)) ||
          left.index - right.index
        ));
        return questions.map((entry) => entry.question);
      }
      if (state.showUnansweredFirst || questions.some((entry) => questionHasAgentPrediction(entry.question))) {
        questions.sort((left, right) => (
          predictionPrioritySort(left, right) ||
          (state.showUnansweredFirst
            ? Number(questionAnswered(left.question)) - Number(questionAnswered(right.question))
            : 0) ||
          left.index - right.index
        ));
      }
      return questions.map((entry) => entry.question);
    };
    const firstPreferredQuestionKey = () => {
      const questions = orderedQuestions();
      return questions.find((question) => question.canAnswer && !questionAnswered(question))?.questionKey ||
        questions.find((question) => question.canAnswer)?.questionKey ||
        questions[0]?.questionKey ||
        '';
    };
    const activate = (question) => {
      if (question?.questionKey) state.activeKey = question.questionKey;
    };
    const expandQuestion = (question) => {
      if (question?.questionKey) state.expandedQuestionKeys.add(question.questionKey);
    };
    const syncQuestionCardExpanded = (question, expanded) => {
      const card = Array.from(el.questionStack.querySelectorAll('.card'))
        .find((entry) => entry.dataset.questionKey === question.questionKey);
      if (!card) return false;
      Array.from(el.questionStack.querySelectorAll('.card')).forEach((entry) => {
        entry.dataset.active = entry.dataset.questionKey === question.questionKey ? 'true' : 'false';
      });
      card.classList.toggle('collapsed', !expanded);
      card.dataset.expanded = expanded ? 'true' : 'false';
      const toggle = card.querySelector('.cardToggle');
      if (toggle) {
        toggle.setAttribute('aria-label', expanded ? 'Collapse question' : 'Expand question');
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        toggle.innerHTML = expanded ? CARET_UP_ICON : CARET_DOWN_ICON;
      }
      return true;
    };
    const toggleQuestionExpanded = (question) => {
      if (!question?.questionKey) return;
      activate(question);
      const expanded = !state.expandedQuestionKeys.has(question.questionKey);
      if (expanded) state.expandedQuestionKeys.add(question.questionKey);
      else state.expandedQuestionKeys.delete(question.questionKey);
      if (!syncQuestionCardExpanded(question, expanded)) renderQuestionStack();
    };
    function stopLoadingProgressTimer() {
      if (state.loadingProgressTimer && typeof window.clearInterval === 'function') {
        window.clearInterval(state.loadingProgressTimer);
      }
      state.loadingProgressTimer = null;
    }
    const setStatus = (message, kind = '') => {
      stopLoadingProgressTimer();
      el.status.className = 'status ' + kind;
      el.status.textContent = message || '';
    };
    const setLoadingProgress = (message, percent = 18) => {
      el.status.className = 'status loadingStatus';
      el.status.innerHTML = '';
      const visual = document.createElement(LOADING_VISUAL_MODE === 'gif' ? 'img' : 'span');
      if (LOADING_VISUAL_MODE === 'gif') {
        visual.className = 'loadingGif';
        visual.src = '/telegram/mini-app/loading.gif';
        visual.alt = '';
      } else {
        visual.className = 'loadingSpinner';
      }
      visual.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = message || 'Loading questions and agent predictions';
      const track = document.createElement('div');
      track.className = 'loadingProgress';
      track.setAttribute('aria-hidden', 'true');
      const bar = document.createElement('div');
      bar.className = 'loadingProgressBar';
      const boundedPercent = Math.max(8, Math.min(96, Number(percent) || 18));
      bar.style.setProperty('--progress', boundedPercent + '%');
      track.appendChild(bar);
      el.status.appendChild(visual);
      el.status.appendChild(label);
      el.status.appendChild(track);
    };
    function startLoadingProgress({
      message = 'Loading questions and agent predictions',
      initialPercent = 22,
      maxPercent = 72,
    } = {}) {
      stopLoadingProgressTimer();
      state.loadingProgressPercent = Math.max(8, Math.min(96, Number(initialPercent) || 22));
      setLoadingProgress(message, state.loadingProgressPercent);
      if (typeof window.setInterval !== 'function' || typeof window.clearInterval !== 'function') return;
      state.loadingProgressTimer = window.setInterval(() => {
        const current = Number(state.loadingProgressPercent || initialPercent) || initialPercent;
        const step = current < 42 ? 5 : current < 60 ? 3 : 1.5;
        state.loadingProgressPercent = Math.min(Number(maxPercent) || 72, current + step);
        setLoadingProgress(message, state.loadingProgressPercent);
        if (state.loadingProgressPercent >= (Number(maxPercent) || 72)) {
          stopLoadingProgressTimer();
        }
      }, 420);
    }
    function shouldRetryQuestions(data) {
      if (data?.sessionPicker?.required === true) return false;
      const questions = Array.isArray(data?.questions) ? data.questions : [];
      const answerableCount = questions.filter((question) => question?.canAnswer).length;
      const unavailableCount = questions.filter((question) => question?.payloadUnavailable === true).length;
      return answerableCount === 0 && (
        data?.sourceOk === false ||
        Number(data?.questionCount || 0) === 0 ||
        unavailableCount > 0
      );
    }
    function clearQuestionRetry() {
      if (state.retryTimer) window.clearTimeout(state.retryTimer);
      state.retryTimer = null;
    }
    function clearAutoQuestionLoadTimer() {
      if (state.autoQuestionLoadTimer) window.clearTimeout(state.autoQuestionLoadTimer);
      state.autoQuestionLoadTimer = null;
    }
    function scheduleQuestionRetry() {
      clearQuestionRetry();
      state.retryTimer = window.setTimeout(() => {
        state.retryTimer = null;
        load({ retry: true });
      }, QUESTION_RETRY_DELAY_MS);
    }
    function setSubmitBusy(isBusy, triggerButton = null, question = activeQuestion()) {
      state.submitting = isBusy;
      [triggerButton].filter(Boolean).forEach((button) => {
        applySubmitButtonState(button, question, { busy: isBusy });
      });
      if (!isBusy) updateFooterControls();
    }
    function renderSessionPicker() {
      const picker = state.data?.sessionPicker || {};
      if (picker.required === true) state.sessionsPanelOpen = true;
      const pickerSessions = Array.isArray(picker.sessions) ? picker.sessions : [];
      const fallbackSession = state.data?.session?.sessionSlug
        ? [{
            sessionSlug: state.data.session.sessionSlug,
            sessionName: state.data.session.title || state.data.session.sessionSlug,
            selected: true,
          }]
        : [];
      const sessions = pickerSessions.length ? pickerSessions : fallbackSession;
      const hasPicker = picker.enabled === true || sessions.length > 0 || state.sessionsPanelOpen === true;
      const open = hasPicker && (picker.required === true || state.sessionsPanelOpen === true);
      el.sessionPicker.classList.toggle('open', open);
      el.showSessions.classList.toggle('active', open);
      el.showSessions.setAttribute('aria-expanded', open ? 'true' : 'false');
      el.sessionOptions.innerHTML = '';
      if (!open) return;
      const selectedSessions = sessions.filter((session) => (
        state.selectedSessionSlugs.has(session.sessionSlug) || session.selected === true
      ));
      const selectedNames = selectedSessions.map((session) => session.sessionName || session.sessionSlug);
      el.sessionSummary.textContent = selectedNames.length
        ? selectedNames.slice(0, 2).join(', ') + (selectedNames.length > 2 ? ' +' + (selectedNames.length - 2) : '')
        : 'No sessions selected';
      if (!sessions.length) {
        const empty = document.createElement('div');
        empty.className = 'emptyState';
        empty.textContent = state.loadedOnce ? 'No selectable Telegram sessions are available.' : 'Sessions are loading...';
        el.sessionOptions.appendChild(empty);
      }
      sessions.forEach((session) => {
        const label = document.createElement('label');
        label.className = 'sessionOption';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = session.sessionSlug;
        input.checked = state.selectedSessionSlugs.has(session.sessionSlug) || session.selected === true;
        input.onchange = () => {
          if (input.checked) state.selectedSessionSlugs.add(session.sessionSlug);
          else state.selectedSessionSlugs.delete(session.sessionSlug);
          resetResultsForSelection();
          resetGroupsForSelection();
          resetDocumentsForSelection();
          el.continueSessions.disabled = state.selectedSessionSlugs.size === 0;
          renderSessionPicker();
          renderResults();
          renderGroups();
          renderDocuments();
          renderAddQuestion();
        };
        const name = document.createElement('span');
        name.textContent = session.sessionName || session.sessionSlug;
        label.append(input, name);
        el.sessionOptions.appendChild(label);
      });
      el.continueSessions.disabled = state.selectedSessionSlugs.size === 0;
    }
    function scrollHighlightedQuestionIntoView() {
      if (!state.highlightedQuestionKey || state.highlightScrollDone) return;
      const target = Array.from(el.questionStack.querySelectorAll('.card'))
        .find((card) => card.dataset.questionKey === state.highlightedQuestionKey);
      if (!target) return;
      state.highlightScrollDone = true;
      window.requestAnimationFrame(() => {
        target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    }
    function renderQuestionVoteControls(question) {
      const summary = voteSummaryForQuestion(question);
      const wrap = document.createElement('div');
      wrap.className = 'questionVotes';
      const makeButton = (vote, icon, label) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'voteButton ' + vote + (summary.userVote === vote ? ' active' : '');
        button.innerHTML = icon;
        button.disabled = !question?.questionKey;
        button.setAttribute('aria-label', label);
        button.setAttribute('aria-pressed', summary.userVote === vote ? 'true' : 'false');
        button.onclick = (event) => {
          event.stopPropagation();
          submitQuestionVote(question, vote, button);
        };
        return button;
      };
      const score = document.createElement('span');
      score.className = 'voteScore' + (summary.score > 0 ? ' positive' : (summary.score < 0 ? ' negative' : ''));
      score.textContent = String(summary.score);
      wrap.append(makeButton('down', VOTE_DOWN_ICON, 'Downvote question'), score, makeButton('up', VOTE_UP_ICON, 'Upvote question'));
      return wrap;
    }
    const agentOnlyState = () => state.data?.agentOnly || {};
    const agentOnlyPredictionFor = (question) => {
      if (!question?.questionKey || agentOnlyState().showAgentResponses === false) return null;
      return agentOnlyState().predictions?.[question.questionKey] || null;
    };
    async function confirmAgentPrediction(question, button) {
      if (!question?.questionKey) return;
      if (button) button.disabled = true;
      try {
        const response = await fetch('/telegram/mini-app/api/agent-only/confirm', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ launch, questionKey: question.questionKey }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body.ok === false) throw new Error(body.error || body.reason || 'agent_only_confirm_failed');
        const prediction = agentOnlyPredictionFor(question);
        if (prediction) prediction.confirmed = true;
        renderQuestionStack();
      } catch (error) {
        setStatus(String(error?.message || error || 'Could not confirm agent prediction.'), 'error');
        if (button) button.disabled = false;
      }
    }
    function renderAgentOnlyPredictionBadge(question) {
      const prediction = agentOnlyPredictionFor(question);
      if (!prediction?.valueLabel) return null;
      const questionType = questionTypeFilterValue(question);
      const stacked = questionType === 'freeform' || questionType === 'multichoice';
      const row = document.createElement('div');
      row.className = 'agentOnlyBadgeRow' + (stacked ? ' stackedPredictionRow' : '');
      const badge = document.createElement('span');
      const answerKind = ['agree', 'unsure', 'disagree'].includes(String(prediction.answerKind || ''))
        ? String(prediction.answerKind)
        : '';
      if (stacked) {
        badge.className = 'agentPredictionBadge stackedPrediction';
        const label = document.createElement('span');
        label.className = 'agentPredictionLabel';
        label.textContent = 'Agent prediction';
        const value = document.createElement('span');
        value.className = 'agentPredictionValue';
        value.textContent = prediction.valueLabel;
        badge.append(label, value);
      } else if (answerKind) {
        badge.className = 'agentPredictionBadge choicePrediction';
        const label = document.createElement('span');
        label.className = 'agentPredictionLabel';
        label.textContent = 'Agent prediction';
        const choice = document.createElement('span');
        choice.className = 'agentPredictionChoice ' + answerKind;
        choice.textContent = prediction.valueLabel;
        badge.append(label, choice);
      } else {
        badge.className = 'agentPredictionBadge';
        const label = document.createElement('span');
        label.className = 'agentPredictionLabel';
        label.textContent = 'Agent prediction';
        const value = document.createElement('span');
        value.className = 'agentPredictionValue';
        value.textContent = prediction.valueLabel;
        badge.append(label, value);
      }
      row.appendChild(badge);
      return row;
    }
    function renderQuestionStack() {
      const questions = orderedQuestions();
      el.questionStack.innerHTML = '';
      if (!questions.length) {
        const empty = document.createElement('div');
        empty.className = 'locked';
        empty.textContent = 'No questions match the current filters.';
        el.questionStack.appendChild(empty);
        updateFooterControls();
        return;
      }
      questions.forEach((question) => {
        const expanded = state.expandedQuestionKeys.has(question.questionKey);
        const card = document.createElement('article');
        card.className = 'card' + (expanded ? '' : ' collapsed');
        card.dataset.active = question.questionKey === state.activeKey ? 'true' : 'false';
        card.dataset.questionKey = question.questionKey || '';
        card.dataset.expanded = expanded ? 'true' : 'false';
        card.dataset.highlight = question.questionKey && question.questionKey === state.highlightedQuestionKey ? 'true' : 'false';
        const head = document.createElement('div');
        head.className = 'cardHead';
        head.onclick = () => toggleQuestionExpanded(question);
        const headText = document.createElement('div');
        headText.className = 'cardHeadText';
        const prompt = document.createElement('p');
        prompt.className = 'prompt';
        prompt.textContent = question.prompt || question.title || '';
        headText.appendChild(prompt);
        const predictionBadge = renderAgentOnlyPredictionBadge(question);
        if (predictionBadge) headText.appendChild(predictionBadge);
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'cardToggle';
        toggle.setAttribute('aria-label', expanded ? 'Collapse question' : 'Expand question');
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        toggle.innerHTML = expanded ? CARET_UP_ICON : CARET_DOWN_ICON;
        toggle.onclick = (event) => {
          event.stopPropagation();
          toggleQuestionExpanded(question);
        };
        head.append(headText, toggle);
        const body = document.createElement('div');
        body.className = 'cardBody';
        renderAnswerControls(question, body, { showComments: true });
        const voteRow = document.createElement('div');
        voteRow.className = 'questionVoteRow expandedOnly';
        voteRow.appendChild(renderQuestionVoteControls(question));
        body.appendChild(voteRow);
        card.append(head, body);
        el.questionStack.appendChild(card);
      });
      updateFooterControls();
      scrollHighlightedQuestionIntoView();
      const isLoadingMore = state.loadingMoreQuestions === true || state.backgroundQuestionLoadPending === true;
      if (isLoadingMore) {
        const loading = document.createElement('div');
        loading.className = 'questionLoadingRow';
        const spinner = document.createElement('span');
        spinner.className = 'inlineSpinner';
        spinner.setAttribute('aria-label', 'Loading more questions');
        const label = document.createElement('span');
        label.textContent = state.backgroundQuestionLoadPending
          ? backgroundQuestionLoadMessage()
          : 'Loading more questions...';
        loading.append(spinner, label);
        el.questionStack.appendChild(loading);
      }
      if (state.data?.hasMoreQuestions === true && !isLoadingMore) {
        const loadMore = document.createElement('button');
        loadMore.type = 'button';
        loadMore.className = 'secondary loadMoreQuestions';
        const loaded = Number(state.data?.loadedQuestionCount || questions.length) || questions.length;
        const total = Number(state.data?.questionCount || loaded) || loaded;
        loadMore.textContent = 'Load more questions (' + loaded + '/' + total + ')';
        loadMore.onclick = () => loadMoreQuestions();
        el.questionStack.appendChild(loadMore);
      }
    }
    function backgroundQuestionLoadMessage() {
      const loaded = Number(state.data?.loadedQuestionLimit || state.data?.loadedQuestionCount || 0) || 0;
      return loaded <= FAST_INITIAL_QUESTION_LIMIT
        ? 'Loading the next questions...'
        : 'Loading the rest in the background...';
    }
    function selectValue(question, value) {
      activate(question);
      const draft = draftFor(question);
      draft.value = value;
      markAnswerChanged(question);
      renderQuestionStack();
      scheduleDraftAutosave(question);
    }
    function toggleChoice(question, option, single) {
      activate(question);
      const draft = draftFor(question);
      const values = Array.isArray(draft.values) ? draft.values.slice() : [];
      const next = single
        ? (values.includes(option) ? [] : [option])
        : (values.includes(option) ? values.filter((value) => value !== option) : values.concat(option));
      draft.values = next;
      markAnswerChanged(question);
      renderQuestionStack();
      scheduleDraftAutosave(question);
    }
    function renderAnswerControls(question, mount, { showComments = true } = {}) {
      if (question.locked || !question.canAnswer) {
        const locked = document.createElement('div');
        locked.className = 'locked';
        locked.textContent = question.lockMessage || (
          question.payloadUnavailable
            ? 'Question payload is not available yet. Retrying...'
            : question.encrypted
              ? 'This question is encrypted.'
              : 'This question is locked in Telegram.'
        );
        mount.appendChild(locked);
        return;
      }
      const draft = draftFor(question);
      if (question.questionType === 'agree_unsure_disagree') {
        const row = document.createElement('div');
        row.className = 'segmented';
        [['agree', 'Agree'], ['unsure', 'Unsure'], ['disagree', 'Disagree']].forEach(([value, label]) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'segment ' + value + (draft.value === value ? ' selected' : '');
          button.setAttribute('aria-pressed', draft.value === value ? 'true' : 'false');
          button.textContent = label;
          button.onclick = () => selectValue(question, value);
          row.appendChild(button);
        });
        mount.appendChild(row);
      } else if (question.questionType === 'rating') {
        const label = document.createElement('div');
        label.className = 'ratingValue';
        label.textContent = draft.value ?? 5;
        const input = document.createElement('input');
        input.type = 'range';
        input.min = '0';
        input.max = '10';
        input.step = '1';
        input.value = draft.value ?? 5;
        input.oninput = () => {
          activate(question);
          draft.value = Number(input.value);
          label.textContent = input.value;
          markAnswerChanged(question);
          refreshQuestionSubmitButton(question, input);
          scheduleDraftAutosave(question);
          updateFooterControls();
        };
        mount.append(label, input);
      } else if (question.questionType === 'multichoice') {
        const wrap = document.createElement('div');
        wrap.className = 'choices';
        const single = question.selectionMode === 'single';
        const values = Array.isArray(draft.values) ? draft.values : [];
        question.options.forEach((option) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'choice' + (values.includes(option) ? ' selected' : '');
          button.textContent = option;
          button.onclick = () => toggleChoice(question, option, single);
          wrap.appendChild(button);
        });
        mount.appendChild(wrap);
      } else {
        const answerBox = document.createElement('div');
        answerBox.className = 'commentBox freeformAnswerBox';
        const input = document.createElement('textarea');
        input.placeholder = 'Response here';
        input.value = draft.text || '';
        input.oninput = () => {
          if (input.dataset.micFeedbackActive === 'true') {
            input.classList.remove('micFeedback');
            delete input.dataset.micFeedbackActive;
            input.placeholder = input.dataset.originalPlaceholder || 'Response here';
          }
          activate(question);
          draft.text = input.value;
          markAnswerChanged(question);
          refreshQuestionSubmitButton(question, input);
          scheduleDraftAutosave(question);
          updateFooterControls();
        };
        const answerActions = document.createElement('div');
        answerActions.className = 'commentActions';
        const answerMic = document.createElement('button');
        answerMic.type = 'button';
        answerMic.className = 'secondary micButton';
        answerMic.innerHTML = MIC_ICON;
        answerMic.dataset.idleLabel = 'Dictate answer';
        answerMic.dataset.stopLabel = 'Stop recording answer';
        answerMic.setAttribute('aria-label', 'Dictate answer');
        answerMic.setAttribute('aria-pressed', 'false');
        answerMic.onclick = (event) => {
          event.stopPropagation();
          startAnswerDictation(question, input, answerMic);
        };
        answerActions.appendChild(answerMic);
        answerBox.append(input, answerActions);
        mount.appendChild(answerBox);
      }
      const commentBox = document.createElement('div');
      commentBox.className = 'commentBox commentsSection expandedOnly';
      const comments = document.createElement('textarea');
      comments.placeholder = 'Additional comments';
      comments.value = draft.comments || '';
      comments.oninput = () => {
        if (comments.dataset.micFeedbackActive === 'true') {
          comments.classList.remove('micFeedback');
          delete comments.dataset.micFeedbackActive;
          comments.placeholder = comments.dataset.originalPlaceholder || 'Additional comments';
        }
        activate(question);
        draft.comments = comments.value;
        markAnswerChanged(question);
        refreshQuestionSubmitButton(question, comments);
        scheduleDraftAutosave(question);
        updateFooterControls();
      };
      const commentActions = document.createElement('div');
      commentActions.className = 'commentActions';
      const mic = document.createElement('button');
      mic.type = 'button';
      mic.className = 'secondary micButton';
      mic.innerHTML = MIC_ICON;
      mic.dataset.idleLabel = 'Dictate additional comments';
      mic.dataset.stopLabel = 'Stop recording additional comments';
      mic.setAttribute('aria-label', 'Dictate additional comments');
      mic.setAttribute('aria-pressed', 'false');
      mic.onclick = (event) => {
        event.stopPropagation();
        startCommentDictation(question, comments, mic);
      };
      commentActions.appendChild(mic);
      commentBox.append(comments, commentActions);
      if (showComments) {
        mount.appendChild(commentBox);
        const tags = questionTags(question);
        if (tags.length) {
          const tagRow = document.createElement('div');
          tagRow.className = 'questionTags expandedOnly';
          tags.slice(0, QUESTION_TAG_LIMIT).forEach((tag) => {
            const chip = document.createElement('span');
            chip.className = 'questionTag';
            chip.textContent = questionTagLabel(tag);
            tagRow.appendChild(chip);
          });
          mount.appendChild(tagRow);
        }
      }
      const actions = document.createElement('div');
      actions.className = 'cardActions';
      actions.hidden = !(shouldShowAnswerActions(question) || seriesModeEnabled());
      if (seriesModeEnabled()) {
        const skip = document.createElement('button');
        skip.type = 'button';
        skip.className = 'secondary';
        skip.textContent = 'Skip';
        skip.onclick = (event) => {
          event.stopPropagation();
          advanceSeriesQuestion(question, { skip: true });
        };
        actions.appendChild(skip);
      }
      const submit = document.createElement('button');
      submit.type = 'button';
      submit.className = 'primary submitButton';
      applySubmitButtonState(submit, question);
      submit.onclick = (event) => {
        event.stopPropagation();
        if (currentAnswerMatchesSubmitted(question)) return;
        if (answerChangeGuardActive(question)) return;
        sendAnswer(true, question, submit);
      };
      actions.appendChild(submit);
      mount.appendChild(actions);
    }
    let activeDictation = null;
    let activeMicProgressTimer = null;
    function stopMicProgressTimer() {
      if (activeMicProgressTimer) window.clearInterval(activeMicProgressTimer);
      activeMicProgressTimer = null;
    }
    function startMicProgressTimer(baseMessage, setFeedback) {
      stopMicProgressTimer();
      const startedAt = Date.now();
      const update = () => {
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
        setFeedback(baseMessage + ' ' + elapsedSeconds + 's elapsed');
      };
      update();
      activeMicProgressTimer = window.setInterval(update, 1000);
    }
    function startAnswerTranscriptionProgress(question, textarea) {
      startMicProgressTimer('Transcribing microphone audio...', (message) => setAnswerMicFeedback(question, textarea, message));
    }
    function startCommentTranscriptionProgress(question, textarea) {
      startMicProgressTimer('Transcribing microphone audio...', (message) => setCommentMicFeedback(question, textarea, message));
    }
    function startSearchTranscriptionProgress() {
      startMicProgressTimer('Transcribing search audio...', (message) => setSearchMicFeedback(message));
    }
    function setAnswerMicFeedback(question, textarea, message) {
      const draft = draftFor(question);
      if (!textarea.dataset.originalPlaceholder) {
        textarea.dataset.originalPlaceholder = textarea.placeholder || 'Response here';
      }
      textarea.placeholder = message;
      if (!String(draft.text || textarea.value || '').trim() || textarea.dataset.micFeedbackActive === 'true') {
        textarea.dataset.micFeedbackActive = 'true';
        textarea.classList.add('micFeedback');
        textarea.value = message;
      }
    }
    function clearAnswerMicFeedback(question, textarea) {
      stopMicProgressTimer();
      if (textarea.dataset.micFeedbackActive === 'true') {
        textarea.value = draftFor(question).text || '';
      }
      textarea.classList.remove('micFeedback');
      delete textarea.dataset.micFeedbackActive;
      textarea.placeholder = textarea.dataset.originalPlaceholder || 'Response here';
    }
    function appendAnswerTranscript(question, textarea, transcript) {
      const text = String(transcript || '').trim();
      if (!text) return;
      const draft = draftFor(question);
      const base = textarea.dataset.micFeedbackActive === 'true' ? (draft.text || '') : textarea.value;
      clearAnswerMicFeedback(question, textarea);
      const prefix = base && !base.endsWith(' ') ? ' ' : '';
      textarea.value = base + prefix + text;
      draft.text = textarea.value;
      activate(question);
      markAnswerChanged(question);
      refreshQuestionSubmitButton(question, textarea);
      scheduleDraftAutosave(question);
      updateFooterControls();
    }
    function showAnswerMicError(question, textarea, error) {
      stopMicProgressTimer();
      const message = 'Could not transcribe: ' + String(error || 'transcription_failed');
      setAnswerMicFeedback(question, textarea, message);
    }
    function setCommentMicFeedback(question, textarea, message) {
      const draft = draftFor(question);
      if (!textarea.dataset.originalPlaceholder) {
        textarea.dataset.originalPlaceholder = textarea.placeholder || 'Additional comments';
      }
      textarea.placeholder = message;
      if (!String(draft.comments || textarea.value || '').trim() || textarea.dataset.micFeedbackActive === 'true') {
        textarea.dataset.micFeedbackActive = 'true';
        textarea.classList.add('micFeedback');
        textarea.value = message;
      }
    }
    function clearCommentMicFeedback(question, textarea) {
      stopMicProgressTimer();
      if (textarea.dataset.micFeedbackActive === 'true') {
        textarea.value = draftFor(question).comments || '';
      }
      textarea.classList.remove('micFeedback');
      delete textarea.dataset.micFeedbackActive;
      textarea.placeholder = textarea.dataset.originalPlaceholder || 'Additional comments';
    }
    function appendCommentTranscript(question, textarea, transcript) {
      const text = String(transcript || '').trim();
      if (!text) return;
      const draft = draftFor(question);
      const base = textarea.dataset.micFeedbackActive === 'true' ? (draft.comments || '') : textarea.value;
      clearCommentMicFeedback(question, textarea);
      const prefix = base && !base.endsWith(' ') ? ' ' : '';
      textarea.value = base + prefix + text;
      draft.comments = textarea.value;
      activate(question);
      markAnswerChanged(question);
      refreshQuestionSubmitButton(question, textarea);
      scheduleDraftAutosave(question);
      updateFooterControls();
    }
    function showCommentMicError(question, textarea, error) {
      stopMicProgressTimer();
      const message = 'Could not transcribe: ' + String(error || 'transcription_failed');
      setCommentMicFeedback(question, textarea, message);
    }
    function setMicIcon(button, recording = false) {
      if (!button) return;
      button.innerHTML = recording ? STOP_ICON : MIC_ICON;
      button.setAttribute('aria-label', recording
        ? (button.dataset.stopLabel || 'Stop recording')
        : (button.dataset.idleLabel || 'Dictate'));
    }
    function resetMicButton(button) {
      if (!button) return;
      button.disabled = false;
      setMicIcon(button, false);
      button.setAttribute('aria-pressed', 'false');
    }
    function supportedAudioMimeType() {
      const recorder = window.MediaRecorder;
      if (!recorder || typeof recorder.isTypeSupported !== 'function') return '';
      return [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ].find((type) => recorder.isTypeSupported(type)) || '';
    }
    function selectedTranscribeSessionSlug() {
      return Array.from(state.selectedSessionSlugs).find(Boolean) ||
        (Array.isArray(state.data?.selectedSessionSlugs) ? state.data.selectedSessionSlugs.find(Boolean) : '') ||
        state.data?.session?.sessionSlug ||
        '';
    }
    async function transcribeAudio({ questionKey = '', sessionSlug = '', blob } = {}) {
      const form = new FormData();
      form.append('launch', launch);
      if (questionKey) form.append('questionKey', questionKey);
      if (sessionSlug) form.append('sessionSlug', sessionSlug);
      form.append('audio', blob, blob.type && blob.type.includes('ogg') ? 'comment.ogg' : 'comment.webm');
      const response = await fetch('/telegram/mini-app/api/transcribe', {
        method: 'POST',
        headers: headers({ json: false }),
        body: form,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        throw new Error(body.error || 'transcription_failed');
      }
      if (!String(body.text || '').trim()) {
        throw new Error('empty_transcript');
      }
      return String(body.text || '').trim();
    }
    async function transcribeCommentAudio(question, textarea, blob) {
      const text = await transcribeAudio({
        questionKey: question.questionKey,
        sessionSlug: question.sessionSlug || selectedTranscribeSessionSlug(),
        blob,
      });
      appendCommentTranscript(question, textarea, text);
    }
    async function transcribeAnswerAudio(question, textarea, blob) {
      const text = await transcribeAudio({
        questionKey: question.questionKey,
        sessionSlug: question.sessionSlug || selectedTranscribeSessionSlug(),
        blob,
      });
      appendAnswerTranscript(question, textarea, text);
    }
    function setSearchMicFeedback(message) {
      if (!el.filterAiSearch.dataset.originalPlaceholder) {
        el.filterAiSearch.dataset.originalPlaceholder = el.filterAiSearch.placeholder || 'Describe questions to find';
      }
      el.filterAiSearch.placeholder = message;
      if (!String(state.aiDraftQuery || el.filterAiSearch.value || '').trim() || el.filterAiSearch.dataset.micFeedbackActive === 'true') {
        el.filterAiSearch.dataset.micFeedbackActive = 'true';
        el.filterAiSearch.classList.add('micFeedback');
        el.filterAiSearch.value = message;
        state.aiDraftQuery = message;
      }
    }
    function clearSearchMicFeedback() {
      stopMicProgressTimer();
      if (el.filterAiSearch.dataset.micFeedbackActive === 'true') {
        el.filterAiSearch.value = '';
        state.aiDraftQuery = '';
      }
      el.filterAiSearch.classList.remove('micFeedback');
      delete el.filterAiSearch.dataset.micFeedbackActive;
      el.filterAiSearch.placeholder = el.filterAiSearch.dataset.originalPlaceholder || 'Describe questions to find';
    }
    function applySearchTranscript(transcript) {
      const text = String(transcript || '').trim();
      if (!text) return;
      clearSearchMicFeedback();
      el.filterAiSearch.value = text;
      state.aiDraftQuery = text;
      state.aiSearchQuery = text;
      scheduleAiSearch(0);
      render();
    }
    function showSearchMicError(error) {
      stopMicProgressTimer();
      setSearchMicFeedback('Could not transcribe: ' + String(error || 'transcription_failed'));
    }
    async function transcribeSearchAudio(blob) {
      const text = await transcribeAudio({
        sessionSlug: selectedTranscribeSessionSlug(),
        blob,
      });
      applySearchTranscript(text);
    }
    function setAddQuestionMicFeedback(message) {
      if (!el.addQuestionPrompt.dataset.originalPlaceholder) {
        el.addQuestionPrompt.dataset.originalPlaceholder = el.addQuestionPrompt.placeholder || 'Question prompt';
      }
      el.addQuestionPrompt.placeholder = message;
      if (!String(state.addQuestionPrompt || el.addQuestionPrompt.value || '').trim() || el.addQuestionPrompt.dataset.micFeedbackActive === 'true') {
        el.addQuestionPrompt.dataset.micFeedbackActive = 'true';
        el.addQuestionPrompt.classList.add('micFeedback');
        el.addQuestionPrompt.value = message;
        state.addQuestionPrompt = message;
      }
    }
    function clearAddQuestionMicFeedback() {
      stopMicProgressTimer();
      if (el.addQuestionPrompt.dataset.micFeedbackActive === 'true') {
        el.addQuestionPrompt.value = '';
        state.addQuestionPrompt = '';
      }
      el.addQuestionPrompt.classList.remove('micFeedback');
      delete el.addQuestionPrompt.dataset.micFeedbackActive;
      el.addQuestionPrompt.placeholder = el.addQuestionPrompt.dataset.originalPlaceholder || 'Question prompt';
    }
    function startAddQuestionTranscriptionProgress() {
      startMicProgressTimer('Transcribing question audio...', (message) => setAddQuestionMicFeedback(message));
    }
    function showAddQuestionMicError(error) {
      stopMicProgressTimer();
      setAddQuestionMicFeedback('Could not transcribe: ' + String(error || 'transcription_failed'));
    }
    async function formatAddQuestionDraft(text, options = {}) {
      const raw = String(text || '').trim();
      if (!raw) return;
      const inferQuestionType = options.inferQuestionType === true;
      state.addQuestionPrompt = raw;
      state.addQuestionMessage = 'Formatting question...';
      renderAddQuestion();
      let response;
      let body;
      try {
        response = await fetch('/telegram/mini-app/api/questions/format', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            launch,
            sessionSlug: state.addQuestionSessionSlug || selectedTranscribeSessionSlug(),
            questionType: inferQuestionType ? 'auto' : state.addQuestionType,
            inferQuestionType,
            text: raw,
            sessionContext: state.addQuestionSessionContext,
            tags: normalizeQuestionTags(state.addQuestionTags),
          }),
        });
        body = await response.json().catch(() => ({}));
      } catch {
        state.addQuestionPrompt = raw;
        state.addQuestionMessage = '';
        renderAddQuestion();
        return;
      }
      const formatted = response.ok && body.ok && body.question ? body.question : null;
      const nextQuestionType = formatted?.questionType || state.addQuestionType;
      if (formatted?.questionType) state.addQuestionType = formatted.questionType;
      state.addQuestionPrompt = formatted?.prompt || raw;
      state.addQuestionOptions = nextQuestionType === 'multichoice'
        ? (Array.isArray(formatted?.options) ? formatted.options.join('\\n') : state.addQuestionOptions)
        : '';
      if (Array.isArray(formatted?.tags) && formatted.tags.length) {
        state.addQuestionTags = formatted.tags.join(', ');
      }
      state.addQuestionMessage = body?.source === 'ai'
        ? 'Formatted with AI.'
        : (body?.source ? 'Formatted locally.' : '');
      renderAddQuestion();
    }
    async function applyAddQuestionTranscript(transcript) {
      const text = String(transcript || '').trim();
      if (!text) return;
      clearAddQuestionMicFeedback();
      await formatAddQuestionDraft(text, { inferQuestionType: true });
    }
    async function transcribeAddQuestionAudio(blob) {
      const text = await transcribeAudio({
        sessionSlug: state.addQuestionSessionSlug || selectedTranscribeSessionSlug(),
        blob,
      });
      await applyAddQuestionTranscript(text);
    }
    function compactSearchQuestions() {
      return (state.data?.questions || []).map((question) => ({
        questionKey: question.questionKey,
        prompt: question.prompt,
        title: question.title,
        questionType: question.questionType,
        sessionName: question.sessionName,
        tags: questionTags(question),
        options: question.options || [],
      }));
    }
    function clearAiSearchResults() {
      if (state.aiSearchTimer) window.clearTimeout(state.aiSearchTimer);
      state.aiSearchTimer = null;
      state.aiSearchResultQuery = '';
      state.aiSearchResultScores = new Map();
      state.aiSearchSource = '';
    }
    function applyAiSearchResults(query, body) {
      if (String(state.aiSearchQuery || '').trim() !== query) return;
      const scores = new Map();
      (Array.isArray(body?.results) ? body.results : []).forEach((result) => {
        if (result?.key) scores.set(result.key, Number(result.score || 1));
      });
      state.aiSearchResultQuery = query;
      state.aiSearchResultScores = scores;
      state.aiSearchSource = body?.source || 'local';
      render();
    }
    async function runAiSearch(query) {
      if (!query) return;
      let response;
      let body;
      try {
        response = await fetch('/telegram/mini-app/api/search', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            launch,
            sessionSlug: selectedTranscribeSessionSlug(),
            query,
            questions: compactSearchQuestions(),
          }),
        });
        body = await response.json().catch(() => ({}));
      } catch {
        if (String(state.aiSearchQuery || '').trim() === query) {
          state.aiSearchSource = 'local';
          render();
        }
        return;
      }
      if (!response.ok || !body.ok) {
        if (String(state.aiSearchQuery || '').trim() === query) {
          state.aiSearchSource = 'local';
          render();
        }
        return;
      }
      applyAiSearchResults(query, body);
    }
    function scheduleAiSearch(delay = 260) {
      if (state.aiSearchTimer) window.clearTimeout(state.aiSearchTimer);
      state.aiSearchTimer = null;
      const query = String(state.aiSearchQuery || '').trim();
      if (!query) {
        clearAiSearchResults();
        return;
      }
      state.aiSearchSource = 'loading';
      state.aiSearchTimer = window.setTimeout(() => {
        state.aiSearchTimer = null;
        runAiSearch(query);
      }, delay);
    }
    function startSpeechRecognitionFallback(question, textarea, button) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        showCommentMicError(question, textarea, 'Microphone dictation is not available in this Telegram webview.');
        return false;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      button.disabled = true;
      setMicIcon(button, true);
      button.setAttribute('aria-pressed', 'true');
      setCommentMicFeedback(question, textarea, 'Listening...');
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results || [])
          .map((result) => result?.[0]?.transcript || '')
          .join(' ')
          .trim();
        appendCommentTranscript(question, textarea, transcript);
      };
      recognition.onerror = () => {
        showCommentMicError(question, textarea, 'Could not capture microphone input.');
      };
      recognition.onend = () => resetMicButton(button);
      try {
        recognition.start();
        return true;
      } catch {
        resetMicButton(button);
        return false;
      }
    }
    function startAnswerSpeechRecognitionFallback(question, textarea, button) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        showAnswerMicError(question, textarea, 'Microphone dictation is not available in this Telegram webview.');
        return false;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      button.disabled = true;
      setMicIcon(button, true);
      button.setAttribute('aria-pressed', 'true');
      setAnswerMicFeedback(question, textarea, 'Listening...');
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results || [])
          .map((result) => result?.[0]?.transcript || '')
          .join(' ')
          .trim();
        appendAnswerTranscript(question, textarea, transcript);
      };
      recognition.onerror = () => {
        showAnswerMicError(question, textarea, 'Could not capture microphone input.');
      };
      recognition.onend = () => resetMicButton(button);
      try {
        recognition.start();
        return true;
      } catch {
        resetMicButton(button);
        return false;
      }
    }
    async function startAnswerDictation(question, textarea, button) {
      if (activeDictation) {
        const current = activeDictation;
        activeDictation = null;
        current.recorder?.state === 'recording' && current.recorder.stop();
        resetMicButton(current.button);
        if (typeof current.setTranscribing === 'function') current.setTranscribing();
        else startAnswerTranscriptionProgress(current.question || question, current.textarea || textarea);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        startAnswerSpeechRecognitionFallback(question, textarea, button);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks = [];
        const mimeType = supportedAudioMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        activeDictation = {
          recorder,
          stream,
          button,
          question,
          textarea,
          questionKey: question.questionKey,
          setTranscribing: () => startAnswerTranscriptionProgress(question, textarea),
        };
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => {
          showAnswerMicError(question, textarea, 'Could not capture microphone input.');
          stream.getTracks().forEach((track) => track.stop());
          activeDictation = null;
          resetMicButton(button);
        };
        recorder.onstop = async () => {
          activeDictation = null;
          stream.getTracks().forEach((track) => track.stop());
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
          resetMicButton(button);
          if (!blob.size) {
            showAnswerMicError(question, textarea, 'No microphone audio captured.');
            return;
          }
          try {
            startAnswerTranscriptionProgress(question, textarea);
            await transcribeAnswerAudio(question, textarea, blob);
          } catch (error) {
            showAnswerMicError(question, textarea, error.message || error);
          }
        };
        button.disabled = false;
        setMicIcon(button, true);
        button.setAttribute('aria-pressed', 'true');
        recorder.start();
        setAnswerMicFeedback(question, textarea, 'Recording answer. Tap stop when finished.');
      } catch (error) {
        resetMicButton(button);
        showAnswerMicError(question, textarea, error.message || error);
      }
    }
    async function startCommentDictation(question, textarea, button) {
      if (activeDictation) {
        const current = activeDictation;
        activeDictation = null;
        current.recorder?.state === 'recording' && current.recorder.stop();
        resetMicButton(current.button);
        if (typeof current.setTranscribing === 'function') current.setTranscribing();
        else startCommentTranscriptionProgress(current.question || question, current.textarea || textarea);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        startSpeechRecognitionFallback(question, textarea, button);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks = [];
        const mimeType = supportedAudioMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        activeDictation = {
          recorder,
          stream,
          button,
          question,
          textarea,
          questionKey: question.questionKey,
          setTranscribing: () => startCommentTranscriptionProgress(question, textarea),
        };
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => {
          showCommentMicError(question, textarea, 'Could not capture microphone input.');
          stream.getTracks().forEach((track) => track.stop());
          activeDictation = null;
          resetMicButton(button);
        };
        recorder.onstop = async () => {
          activeDictation = null;
          stream.getTracks().forEach((track) => track.stop());
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
          resetMicButton(button);
          if (!blob.size) {
            showCommentMicError(question, textarea, 'No microphone audio captured.');
            return;
          }
          try {
            startCommentTranscriptionProgress(question, textarea);
            await transcribeCommentAudio(question, textarea, blob);
          } catch (error) {
            showCommentMicError(question, textarea, error.message || error);
          }
        };
        button.disabled = false;
        setMicIcon(button, true);
        button.setAttribute('aria-pressed', 'true');
        recorder.start();
        setCommentMicFeedback(question, textarea, 'Recording comment. Tap stop when finished.');
      } catch (error) {
        resetMicButton(button);
        showCommentMicError(question, textarea, error.message || error);
      }
    }
    function startSearchSpeechRecognitionFallback(button) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        showSearchMicError('Microphone dictation is not available in this Telegram webview.');
        return false;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      button.disabled = true;
      setMicIcon(button, true);
      button.setAttribute('aria-pressed', 'true');
      setSearchMicFeedback('Listening...');
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results || [])
          .map((result) => result?.[0]?.transcript || '')
          .join(' ')
          .trim();
        applySearchTranscript(transcript);
      };
      recognition.onerror = () => {
        showSearchMicError('Could not capture microphone input.');
      };
      recognition.onend = () => resetMicButton(button);
      try {
        recognition.start();
        return true;
      } catch {
        resetMicButton(button);
        return false;
      }
    }
    function startAddQuestionSpeechRecognitionFallback(button) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        showAddQuestionMicError('Microphone dictation is not available in this Telegram webview.');
        return false;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      button.disabled = true;
      setMicIcon(button, true);
      button.setAttribute('aria-pressed', 'true');
      setAddQuestionMicFeedback('Listening...');
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results || [])
          .map((result) => result?.[0]?.transcript || '')
          .join(' ')
          .trim();
        applyAddQuestionTranscript(transcript);
      };
      recognition.onerror = () => {
        showAddQuestionMicError('Could not capture microphone input.');
      };
      recognition.onend = () => resetMicButton(button);
      try {
        recognition.start();
        return true;
      } catch {
        resetMicButton(button);
        return false;
      }
    }
    async function startAddQuestionDictation(button) {
      if (activeDictation) {
        const current = activeDictation;
        activeDictation = null;
        current.recorder?.state === 'recording' && current.recorder.stop();
        resetMicButton(current.button);
        if (typeof current.setTranscribing === 'function') current.setTranscribing();
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        startAddQuestionSpeechRecognitionFallback(button);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks = [];
        const mimeType = supportedAudioMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        activeDictation = {
          recorder,
          stream,
          button,
          setTranscribing: () => startAddQuestionTranscriptionProgress(),
        };
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => {
          showAddQuestionMicError('Could not capture microphone input.');
          stream.getTracks().forEach((track) => track.stop());
          activeDictation = null;
          resetMicButton(button);
        };
        recorder.onstop = async () => {
          activeDictation = null;
          stream.getTracks().forEach((track) => track.stop());
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
          resetMicButton(button);
          if (!blob.size) {
            showAddQuestionMicError('No microphone audio captured.');
            return;
          }
          try {
            startAddQuestionTranscriptionProgress();
            await transcribeAddQuestionAudio(blob);
          } catch (error) {
            showAddQuestionMicError(error.message || error);
          }
        };
        button.disabled = false;
        setMicIcon(button, true);
        button.setAttribute('aria-pressed', 'true');
        recorder.start();
        setAddQuestionMicFeedback('Recording question. Tap stop when finished.');
      } catch (error) {
        resetMicButton(button);
        showAddQuestionMicError(error.message || error);
      }
    }
    async function startSearchDictation(button) {
      if (activeDictation) {
        const current = activeDictation;
        activeDictation = null;
        current.recorder?.state === 'recording' && current.recorder.stop();
        resetMicButton(current.button);
        if (typeof current.setTranscribing === 'function') current.setTranscribing();
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        startSearchSpeechRecognitionFallback(button);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks = [];
        const mimeType = supportedAudioMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        activeDictation = {
          recorder,
          stream,
          button,
          setTranscribing: () => startSearchTranscriptionProgress(),
        };
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => {
          showSearchMicError('Could not capture microphone input.');
          stream.getTracks().forEach((track) => track.stop());
          activeDictation = null;
          resetMicButton(button);
        };
        recorder.onstop = async () => {
          activeDictation = null;
          stream.getTracks().forEach((track) => track.stop());
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
          resetMicButton(button);
          if (!blob.size) {
            showSearchMicError('No microphone audio captured.');
            return;
          }
          try {
            startSearchTranscriptionProgress();
            await transcribeSearchAudio(blob);
          } catch (error) {
            showSearchMicError(error.message || error);
          }
        };
        button.disabled = false;
        setMicIcon(button, true);
        button.setAttribute('aria-pressed', 'true');
        recorder.start();
        setSearchMicFeedback('Recording search. Tap stop when finished.');
      } catch (error) {
        resetMicButton(button);
        showSearchMicError(error.message || error);
      }
    }
    function updateFooterControls() {
      return null;
    }
    function questionCountText(data) {
      const total = Number(data?.questionCount ?? data?.availableQuestionCount ?? 0) || 0;
      const loaded = Number(data?.loadedQuestionCount || data?.questions?.length || 0) || 0;
      const activeFilters = activeQuestionFilterCount();
      if (activeFilters > 0) {
        return 'Questions: ' + filteredQuestionEntries().length + '/' + total;
      }
      if (data?.hasMoreQuestions === true && total > loaded) {
        return 'Questions: ' + loaded + '/' + total;
      }
      return 'Questions: ' + total;
    }
    function activeQuestionFilterCount() {
      return state.selectedQuestionTypes.size +
        state.selectedQuestionTags.size +
        (String(state.aiSearchQuery || '').trim() ? 1 : 0) +
        (state.answeredQuestionsOnly ? 1 : 0) +
        (state.popularQuestionsOnly ? 1 : 0);
    }
    function clearQuestionFilters() {
      state.selectedQuestionTypes.clear();
      state.selectedQuestionTags.clear();
      state.answeredQuestionsOnly = false;
      state.popularQuestionsOnly = false;
      state.popularQuestionLimit = POPULAR_QUESTION_LIMIT_DEFAULT;
      state.aiDraftQuery = '';
      state.aiSearchQuery = '';
      clearSearchMicFeedback();
      clearAiSearchResults();
      render();
    }
    function renderFilterSubsection(section, toggle, expanded) {
      if (!section || !toggle) return;
      section.classList.toggle('collapsed', !expanded);
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      const icon = toggle.querySelector('svg path');
      if (icon) icon.setAttribute('d', expanded ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6');
    }
    function renderMeta(data) {
      el.meta.innerHTML = '';
      if (!data) {
        return;
      }
      const text = document.createElement('span');
      text.textContent = questionCountText(data);
      el.meta.appendChild(text);
      if (activeQuestionFilterCount() > 0) {
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'metaClearFilter';
        clear.textContent = 'X';
        clear.setAttribute('aria-label', 'Clear question filters');
        clear.onclick = () => clearQuestionFilters();
        el.meta.appendChild(clear);
      }
    }
    function render() {
      const data = state.data;
      renderMeta(data);
      renderSessionPicker();
      renderAdmin();
      renderActivity();
      renderDocuments();
      renderResults();
      renderGroups();
      renderAddQuestion();
      renderFilters();
      renderAgentSettings();
      renderQuestionStack();
    }
    function appendEmptyResult(mount, message) {
      const empty = document.createElement('div');
      empty.className = 'resultRow';
      const text = document.createElement('span');
      text.textContent = message;
      empty.appendChild(text);
      mount.appendChild(empty);
    }
    function appendLoadingResult(mount, message) {
      const row = document.createElement('div');
      row.className = 'resultRow';
      const spinner = document.createElement('span');
      spinner.className = 'inlineSpinner';
      spinner.setAttribute('aria-label', 'Loading');
      const text = document.createElement('span');
      text.textContent = message;
      row.append(spinner, text);
      mount.appendChild(row);
    }
    function renderResultRows(mount, rows, emptyText, scoreKind, visibleCount = 5, moreButton = null) {
      mount.innerHTML = '';
      if (!rows.length) {
        appendEmptyResult(mount, emptyText);
        if (moreButton) moreButton.hidden = true;
        return;
      }
      const visibleRows = rows.slice(0, Math.max(1, Number(visibleCount || 5)));
      visibleRows.forEach((row, index) => {
        const item = document.createElement('div');
        item.className = 'resultRow';
        const prompt = document.createElement('strong');
        prompt.textContent = (index + 1) + '. ' + (row.prompt || 'Untitled question');
        const distribution = document.createElement('div');
        distribution.className = 'distributionBar';
        const counts = row.counts || {};
        const total = Math.max(1, Number(row.total || 0));
        distribution.style.setProperty('--agree', String(Math.max(0.001, Number(counts.Agree || counts.agree || 0) / total)) + 'fr');
        distribution.style.setProperty('--unsure', String(Math.max(0.001, Number(counts.Unsure || counts.unsure || 0) / total)) + 'fr');
        distribution.style.setProperty('--disagree', String(Math.max(0.001, Number(counts.Disagree || counts.disagree || 0) / total)) + 'fr');
        distribution.setAttribute('aria-label', row.countsText || (Number(row.total || 0) + ' responses'));
        distribution.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));
        const distributionRow = document.createElement('div');
        distributionRow.className = 'distributionRow';
        const totalLabel = document.createElement('span');
        totalLabel.className = 'distributionTotal';
        totalLabel.textContent = String(Number(row.total || 0));
        totalLabel.setAttribute('aria-label', Number(row.total || 0) + ' total responses');
        distributionRow.append(distribution, totalLabel);
        item.append(prompt, distributionRow);
        mount.appendChild(item);
      });
      if (moreButton) {
        moreButton.hidden = visibleRows.length >= rows.length;
        moreButton.textContent = visibleRows.length >= rows.length ? 'No more questions' : 'More';
      }
      void scoreKind;
    }
    function setResultSectionOpen(key, section, toggle) {
      const open = state.resultSectionsOpen[key] === true;
      if (key === 'filters') section.hidden = !open;
      section.classList.toggle('collapsed', !open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      const path = toggle.querySelector('path');
      if (path) path.setAttribute('d', open ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6');
    }
    function autoApplyResultFilters() {
      state.groupAnalysisById = {};
      stopGroupAnalysisProgressTimer();
      state.resultVisibleCounts = { consensus: 5, divisive: 5 };
      restoreCachedResults();
      if (el.resultsPanel.classList.contains('open')) loadResults({ force: true });
      renderResults();
    }
    function renderResultGroups(groups) {
      el.resultGroups.innerHTML = '';
      el.groupAnalysis.innerHTML = '';
      el.resultClusterControls.innerHTML = '';
      el.resultGroupChart.innerHTML = '';
      el.groupAnalysisSection.hidden = true;
      if (state.resultsData?.groupView?.enabled === false) {
        el.resultGroupsSection.hidden = true;
        return;
      }
      el.resultGroupsSection.hidden = false;
      state.resultClusterCount = RESULT_GROUP_COUNT;
      const visibleGroups = groups.slice(0, RESULT_GROUP_COUNT);
      if (!visibleGroups.length) {
        appendEmptyResult(el.resultGroups, 'Not enough participant response data for groups yet.');
        return;
      }
      renderResultGroupChart(visibleGroups);
      el.groupAnalysisSection.hidden = false;
      visibleGroups.forEach((group) => {
        const analyze = document.createElement('button');
        analyze.type = 'button';
        analyze.className = 'secondary';
        const analysisState = state.groupAnalysisById[group.groupId] || {};
        const elapsedSeconds = analysisState.loading && analysisState.startedAt
          ? Math.max(0, Math.floor((Date.now() - Number(analysisState.startedAt)) / 1000))
          : 0;
        analyze.textContent = analysisState.loading
          ? 'Analyzing ' + group.label + '... ' + elapsedSeconds + 's elapsed'
          : 'Analyze ' + group.label;
        analyze.disabled = analysisState.loading === true;
        analyze.onclick = () => analyzeResultGroup(group.groupId);
        el.resultGroups.appendChild(analyze);
        if (analysisState.analysis || analysisState.error) {
          const detail = document.createElement('div');
          detail.className = 'resultRow groupAnalysisResult';
          const heading = document.createElement('strong');
          const analysisName = String(analysisState.analysis?.name || '').trim();
          heading.textContent = analysisName && analysisName !== group.label
            ? group.label + ': ' + analysisName
            : (analysisName || group.label);
          const short = document.createElement('span');
          short.textContent = analysisState.error || analysisState.analysis?.short || '';
          const long = document.createElement('span');
          long.textContent = analysisState.analysis?.long || '';
          detail.append(heading, short, long);
          el.groupAnalysis.appendChild(detail);
        }
      });
    }
    function resultFilterPayload() {
      return {
        selections: state.resultFilters?.selections || {},
        details: state.resultFilters?.details || {},
      };
    }
    function activeResultFilterCount() {
      const selections = state.resultFilters?.selections || {};
      const detailCountry = state.resultFilters?.details?.country_relationship || {};
      return Object.values(selections).reduce((sum, values) => sum + (Array.isArray(values) ? values.length : 0), 0) +
        Object.values(detailCountry).filter(Boolean).length;
    }
    function renderResultFilterControls() {
      const groups = state.groupsData?.groups || state.data?.groups || null;
      const categories = Array.isArray(groups?.categories) ? groups.categories : [];
      const filtersDisabled = state.resultsDemoData === true || !categories.length;
      const activeCount = activeResultFilterCount();
      el.resultFilterOptions.innerHTML = '';
      el.resultFilters.classList.toggle('disabled', filtersDisabled);
      el.clearResultFilters.disabled = filtersDisabled || activeCount === 0;
      if (state.resultsDemoData === true) {
        el.resultFilterSummary.textContent = 'Filters apply to live results only.';
        return;
      }
      if (!categories.length) {
        el.resultFilterSummary.textContent = 'No demographic groups are configured for filtering.';
        return;
      }
      const resultFilters = state.resultFilters || { selections: {}, details: {} };
      el.resultFilterSummary.textContent = activeCount
        ? activeCount + ' live result filter' + (activeCount === 1 ? '' : 's') + ' selected'
        : 'Optionally filter live results by saved demographic details.';
      categories.forEach((category) => {
        const selected = new Set(Array.isArray(resultFilters.selections?.[category.categoryId])
          ? resultFilters.selections[category.categoryId]
          : []);
        const categoryId = String(category.categoryId || '');
        const expanded = state.resultFilterCategoryOpen[categoryId] === true;
        const section = document.createElement('section');
        section.className = 'groupCategory' + (expanded ? '' : ' collapsed');
        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'groupCategoryHeader';
        header.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        header.onclick = () => {
          state.resultFilterCategoryOpen[categoryId] = !expanded;
          renderResults();
        };
        const headerText = document.createElement('span');
        headerText.className = 'groupCategoryHeaderText';
        const title = document.createElement('strong');
        title.textContent = category.label;
        const description = document.createElement('span');
        description.textContent = category.selectionMode === 'multi' ? 'Match any selected option.' : 'Match this option.';
        headerText.append(title, description);
        const caret = document.createElement('span');
        caret.innerHTML = expanded ? CARET_UP_ICON : CARET_DOWN_ICON;
        header.append(headerText, caret);
        const options = document.createElement('div');
        options.className = 'groupOptions';
        (category.options || []).forEach((option) => {
          const label = document.createElement('label');
          label.className = 'groupOption';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.value = option.optionId;
          input.checked = selected.has(option.optionId);
          input.onchange = () => {
            const next = new Set(Array.isArray(state.resultFilters.selections[category.categoryId])
              ? state.resultFilters.selections[category.categoryId]
              : Array.from(selected));
            if (input.checked) next.add(option.optionId);
            else next.delete(option.optionId);
            if (next.size) state.resultFilters.selections[category.categoryId] = Array.from(next);
            else delete state.resultFilters.selections[category.categoryId];
            autoApplyResultFilters();
          };
          const text = document.createElement('span');
          text.textContent = option.label;
          label.append(input, text);
          options.appendChild(label);
        });
        if (category.categoryId === 'country_relationship' && (selected.has('live_in') || selected.has('citizen_of'))) {
          const countryDetails = document.createElement('div');
          countryDetails.className = 'groupCountryDetails';
          const renderCountrySelect = (field, labelText) => {
            const fieldWrap = document.createElement('label');
            fieldWrap.className = 'field';
            const fieldLabel = document.createElement('span');
            fieldLabel.textContent = labelText;
            const select = document.createElement('select');
            select.className = 'groupCountrySelect';
            COUNTRY_OPTIONS.forEach(([value, label]) => {
              const option = document.createElement('option');
              option.value = value;
              option.textContent = label;
              select.appendChild(option);
            });
            select.value = resultFilters.details?.country_relationship?.[field] || '';
            select.onchange = () => {
              state.resultFilters.details.country_relationship = state.resultFilters.details.country_relationship || {};
              if (select.value) state.resultFilters.details.country_relationship[field] = select.value;
              else delete state.resultFilters.details.country_relationship[field];
              if (!Object.keys(state.resultFilters.details.country_relationship).length) {
                delete state.resultFilters.details.country_relationship;
              }
              autoApplyResultFilters();
            };
            fieldWrap.append(fieldLabel, select);
            countryDetails.appendChild(fieldWrap);
          };
          if (selected.has('live_in')) renderCountrySelect('live_in_country', 'Live in country');
          if (selected.has('citizen_of')) renderCountrySelect('citizen_of_country', 'Citizen of country');
          options.appendChild(countryDetails);
        }
        section.append(header, options);
        el.resultFilterOptions.appendChild(section);
      });
    }
    function resultGroupColor(index) {
      return ['#1f7ae0', '#f59e0b', '#12b569', '#b8a2ff', '#ff443d', '#2cc3ff'][index % 6];
    }
    function resultClusterOptionCounts() {
      state.resultClusterCount = RESULT_GROUP_COUNT;
      return [];
    }
    function renderResultClusterControls() {
      el.resultClusterControls.innerHTML = '';
      resultClusterOptionCounts();
    }
    function renderResultGroupChart(groups) {
      el.resultGroupChart.innerHTML = '';
      if (!groups.length) return;
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 360 220');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Participant group chart');
      const make = (tag, attrs = {}) => {
        const node = document.createElementNS(ns, tag);
        Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
        return node;
      };
      svg.appendChild(make('line', { x1: 40, y1: 110, x2: 320, y2: 110, stroke: 'rgba(255,255,255,0.28)', 'stroke-width': 1 }));
      svg.appendChild(make('line', { x1: 180, y1: 28, x2: 180, y2: 192, stroke: 'rgba(255,255,255,0.20)', 'stroke-width': 1 }));
      svg.appendChild(make('circle', { cx: 180, cy: 110, r: 58, fill: 'none', stroke: 'rgba(255,255,255,0.20)', 'stroke-width': 1 }));
      svg.appendChild(make('circle', { cx: 180, cy: 110, r: 92, fill: 'none', stroke: 'rgba(255,255,255,0.14)', 'stroke-width': 1, 'stroke-dasharray': '4 5' }));
      const statements = [];
      groups.forEach((group) => (group.topStatements || []).forEach((statement) => {
        if (statement.label && !statements.some((item) => item.label === statement.label)) statements.push(statement);
      }));
      statements.slice(0, 6).forEach((statement, index) => {
        const angle = (-Math.PI / 2) + (index * Math.PI * 2 / Math.max(1, Math.min(6, statements.length)));
        const x = 180 + Math.cos(angle) * 95;
        const y = 110 + Math.sin(angle) * 72;
        svg.appendChild(make('circle', { cx: x, cy: y, r: 4, fill: '#07101f' }));
        const text = make('text', { x: x + 7, y: y + 4, fill: '#eaf1ff' });
        text.textContent = statement.label || ('Q' + (index + 1));
        svg.appendChild(text);
      });
      const groupPoints = groups.map((group, index) => {
        const score = Math.max(-1, Math.min(1, Number(group.averageScore || 0)));
        const y = 64 + (index * (112 / Math.max(1, groups.length - 1 || 1)));
        return {
          group,
          color: resultGroupColor(index),
          x: 180 + score * 118,
          y: groups.length === 1 ? 110 : y,
        };
      });
      if (groupPoints.length > 1) {
        svg.appendChild(make('polyline', {
          points: groupPoints.map((point) => point.x.toFixed(1) + ',' + point.y.toFixed(1)).join(' '),
          fill: 'none',
          stroke: 'rgba(234,241,255,0.35)',
          'stroke-width': 2,
        }));
      }
      groupPoints.forEach((point, index) => {
        svg.appendChild(make('circle', { cx: point.x, cy: point.y, r: 11, fill: point.color, stroke: '#ffffff', 'stroke-width': 2 }));
        const text = make('text', { x: Math.min(300, point.x + 16), y: point.y + 4, fill: '#eaf1ff' });
        text.textContent = (point.group.label || ('Group ' + (index + 1))) + ' (' + point.group.size + ')';
        svg.appendChild(text);
      });
      el.resultGroupChart.appendChild(svg);
    }
    function renderTopicMap(topicMap) {
      el.topicMapChart.innerHTML = '';
      el.topicMapSummary.textContent = '';
      if (state.resultsLoading === true && !topicMap) {
        appendLoadingResult(el.topicMapChart, 'Loading topic map...');
        return;
      }
      const available = topicMap?.availability?.available === true;
      if (!available) {
        const reason = topicMap?.availability?.reason || 'not_enough_data';
        appendEmptyResult(el.topicMapChart, reason === 'not_enough_responses'
          ? 'Not enough responses for a topic map yet.'
          : 'Not enough answered questions for a topic map yet.');
        return;
      }
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      const viewBox = topicMap.viewBox || { width: 720, height: 420 };
      svg.setAttribute('viewBox', '0 0 ' + (viewBox.width || 720) + ' ' + (viewBox.height || 420));
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Topic map');
      const make = (tag, attrs = {}) => {
        const node = document.createElementNS(ns, tag);
        Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
        return node;
      };
      const colors = [
        ['rgba(92, 245, 180, 0.24)', '#5cf5b4'],
        ['rgba(44, 195, 255, 0.22)', '#2cc3ff'],
        ['rgba(255, 209, 102, 0.23)', '#ffd166'],
        ['rgba(184, 162, 255, 0.22)', '#b8a2ff'],
        ['rgba(255, 117, 102, 0.18)', '#ff7566'],
      ];
      svg.appendChild(make('rect', { x: 12, y: 12, width: (viewBox.width || 720) - 24, height: (viewBox.height || 420) - 24, rx: 16, fill: 'rgba(255,255,255,0.04)', stroke: 'rgba(255,255,255,0.12)' }));
      (topicMap.topics || []).forEach((topic, index) => {
        const color = colors[index % colors.length];
        svg.appendChild(make('circle', {
          cx: topic.x,
          cy: topic.y,
          r: topic.r,
          fill: color[0],
          stroke: color[1],
          'stroke-width': 2,
        }));
        const label = make('text', {
          x: topic.x,
          y: topic.y - 8,
          fill: '#eaf1ff',
          'text-anchor': 'middle',
        });
        label.textContent = topic.label || ('Topic ' + (index + 1));
        svg.appendChild(label);
        const counts = make('text', {
          x: topic.x,
          y: topic.y + 14,
          fill: 'rgba(234,241,255,0.68)',
          'text-anchor': 'middle',
        });
        counts.textContent = (topic.questionCount || 0) + ' q / ' + (topic.responseCount || 0) + ' r';
        svg.appendChild(counts);
        (topic.questions || []).forEach((question) => {
          svg.appendChild(make('circle', {
            cx: question.x,
            cy: question.y,
            r: question.r || 8,
            fill: '#f8faff',
            stroke: color[1],
            'stroke-width': 1.5,
          }));
          const qLabel = make('text', {
            x: question.x,
            y: question.y + 4,
            fill: '#07101f',
            'text-anchor': 'middle',
          });
          qLabel.textContent = question.label || '';
          svg.appendChild(qLabel);
        });
      });
      el.topicMapChart.appendChild(svg);
      const cache = topicMap.cache?.status ? ' | ' + topicMap.cache.status : '';
      el.topicMapSummary.textContent = (topicMap.counts?.topics || 0) + ' topics | ' +
        (topicMap.counts?.answeredQuestions || 0) + ' answered questions | ' +
        (topicMap.counts?.responses || 0) + ' responses' + cache;
    }
    function renderResults() {
      const sessions = ensureResultsSessionSlug();
      const currentSession = sessions.find((session) => session.sessionSlug === state.resultsSessionSlug) || {};
      el.resultsTitleSession.textContent = currentSession.sessionName || state.resultsSessionSlug || '';
      if (el.resultsLoadingSpinner) el.resultsLoadingSpinner.hidden = state.resultsLoading !== true;
      if (!state.resultsSessionSlug) {
        el.resultsSummary.textContent = 'Select a session to view results.';
      } else if (state.resultsData?.ok === false) {
        el.resultsSummary.textContent = 'Could not load results: ' + (state.resultsData.error || 'results_unavailable');
      } else if (state.resultsData) {
        const filterText = state.resultsData.filters?.applied
          ? ' (Filtered: ' + state.resultsData.filters.matchedParticipants +
            (state.resultsData.filters.suppressed ? ', hidden below minimum group size' : '') + ')'
          : '';
        const demoQuestionText = state.resultsData.demo ? ' (Demo Data)' : '';
        el.resultsSummary.textContent = state.resultsData.responseCount + ' responses | ' +
          state.resultsData.participantCount + ' participants' + filterText + ' | ' +
          state.resultsData.binaryQuestionCount + ' binary questions' + demoQuestionText +
          (state.resultsLoadError ? ' | refresh failed: ' + state.resultsLoadError : '');
      } else if (state.resultsLoading) {
        el.resultsSummary.textContent = '';
      } else {
        el.resultsSummary.textContent = 'Open results for the selected session.';
      }
      const consensusRows = state.resultsData?.questions?.consensus || [];
      const divisiveRows = state.resultsData?.questions?.divisive || [];
      setResultSectionOpen('filters', el.resultFilters, el.toggleResultFilters);
      el.showResultFilters.setAttribute('aria-expanded', state.resultSectionsOpen.filters ? 'true' : 'false');
      el.showResultFilters.classList.toggle('active', state.resultSectionsOpen.filters === true);
      setResultSectionOpen('consensus', el.consensusSection, el.toggleConsensusSection);
      setResultSectionOpen('divisive', el.divisiveSection, el.toggleDivisiveSection);
      setResultSectionOpen('groups', el.resultGroupsSection, el.toggleResultGroupsSection);
      setResultSectionOpen('topicMap', el.topicMapSection, el.toggleTopicMapSection);
      setResultSectionOpen('groupAnalysis', el.groupAnalysisSection, el.toggleGroupAnalysisSection);
      renderResultFilterControls();
      renderResultRows(el.consensusResults, consensusRows, 'No binary question responses yet.', 'consensus', state.resultVisibleCounts.consensus, el.moreConsensusResults);
      renderResultRows(el.divisiveResults, divisiveRows, 'No divisive binary question responses yet.', 'divisive', state.resultVisibleCounts.divisive, el.moreDivisiveResults);
      renderResultGroups(state.resultsData?.groups || []);
      renderTopicMap(state.resultsData?.topicMap || null);
    }
    function normalizeAdminActions(adminActions = []) {
      const source = Array.isArray(adminActions) && adminActions.length ? adminActions : DEFAULT_ADMIN_ACTIONS;
      const seen = new Set();
      const normalized = source.map((action) => {
        const actionId = typeof action === 'string'
          ? action
          : String(action?.action || action?.id || '').trim();
        if (!actionId) return null;
        const remappedAccessAction = ['export_allow', 'export_revoke'].includes(actionId);
        const canonicalAction = remappedAccessAction ? 'export_access' : actionId;
        if (seen.has(canonicalAction)) return null;
        seen.add(canonicalAction);
        const label = typeof action === 'string'
          ? ADMIN_ACTION_LABELS[canonicalAction]
          : ((remappedAccessAction ? '' : String(action?.label || '').trim()) || ADMIN_ACTION_LABELS[canonicalAction]);
        return {
          action: canonicalAction,
          label: label || canonicalAction.replace(/_/g, ' '),
        };
      }).filter(Boolean);
      return normalized.length ? normalized : DEFAULT_ADMIN_ACTIONS;
    }
    function activeAdminSessionSlug() {
      return state.data?.admin?.sessionSlug || state.data?.session?.sessionSlug || state.resultsSessionSlug || '';
    }
    async function loadAdminData(action, { force = false } = {}) {
      const sessionSlug = activeAdminSessionSlug();
      if (!sessionSlug || (state.adminBusy && !force)) return;
      state.adminBusy = true;
      state.adminPanelMessage = '';
      renderAdmin();
      let path = '';
      if (action === 'export_access' || action === 'export_allow' || action === 'export_revoke') path = '/telegram/mini-app/api/admin/access';
      else if (action === 'results_settings') path = '/telegram/mini-app/api/admin/results-settings';
      else if (action === 'question_queue') path = '/telegram/mini-app/api/admin/question-queue';
      else if (action === 'group_link') path = '/telegram/mini-app/api/admin/group-link';
      if (!path) {
        state.adminBusy = false;
        renderAdmin();
        return;
      }
      try {
        const url = new URL(path, location.origin);
        url.searchParams.set('launch', launch);
        url.searchParams.set('sessionSlug', sessionSlug);
        const response = await fetch(url.pathname + url.search, { headers: headers() });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body.ok === false) {
          state.adminPanelMessage = 'Could not load admin action: ' + (body.error || 'admin_action_failed');
        } else {
          state.adminData = body;
        }
      } catch {
        state.adminPanelMessage = 'Could not load admin action. Check connection and try again.';
      }
      state.adminBusy = false;
      renderAdmin();
    }
    async function submitAdminAccess(operation) {
      const sessionSlug = activeAdminSessionSlug();
      const address = String(state.adminAddress || '').trim();
      if (!sessionSlug || !address) {
        state.adminPanelMessage = 'Paste an address first.';
        renderAdmin();
        return;
      }
      state.adminBusy = true;
      state.adminPanelMessage = '';
      renderAdmin();
      try {
        const response = await fetch('/telegram/mini-app/api/admin/access', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ launch, sessionSlug, operation, address }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body.ok === false) {
          state.adminPanelMessage = 'Could not update permissions: ' + (body.error || 'admin_access_update_failed');
        } else {
          state.adminData = body;
          state.adminPanelMessage = operation === 'remove' ? 'Admin removed.' : 'Admin added.';
        }
      } catch {
        state.adminPanelMessage = 'Could not update permissions. Check connection and try again.';
      }
      state.adminBusy = false;
      renderAdmin();
    }
    async function submitAdminResultsSettings() {
      const sessionSlug = activeAdminSessionSlug();
      const settings = state.adminData?.resultsExposure || {};
      if (!sessionSlug) return;
      state.adminBusy = true;
      state.adminPanelMessage = '';
      renderAdmin();
      try {
        const response = await fetch('/telegram/mini-app/api/admin/results-settings', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ launch, sessionSlug, resultsExposure: settings }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body.ok === false) {
          state.adminPanelMessage = 'Could not save results settings: ' + (body.error || 'results_settings_save_failed');
        } else {
          state.adminData = body;
          state.adminPanelMessage = 'Results settings saved.';
        }
      } catch {
        state.adminPanelMessage = 'Could not save results settings. Check connection and try again.';
      }
      state.adminBusy = false;
      renderAdmin();
    }
    async function submitAdminQuestionQueue(clear = false) {
      const sessionSlug = activeAdminSessionSlug();
      if (!sessionSlug) return;
      state.adminBusy = true;
      state.adminPanelMessage = '';
      renderAdmin();
      try {
        const response = await fetch('/telegram/mini-app/api/admin/question-queue', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            launch,
            sessionSlug,
            operation: clear ? 'clear' : 'set',
            refs: clear ? [] : state.adminQuestionQueueRefs,
          }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body.ok === false) {
          state.adminPanelMessage = 'Could not save question queue: ' + (body.error || 'question_queue_save_failed');
        } else {
          state.adminData = body;
          state.adminQuestionQueueRefs = (body.questionQueue?.sponsoredQuestionIds || []).join(' ');
          state.adminPanelMessage = clear ? 'Question queue cleared.' : 'Question queue saved.';
        }
      } catch {
        state.adminPanelMessage = 'Could not save question queue. Check connection and try again.';
      }
      state.adminBusy = false;
      renderAdmin();
    }
    async function copyTextToClipboard(text) {
      const value = String(text || '');
      const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : null;
      if (!value || !clipboard || typeof clipboard.writeText !== 'function') return false;
      try {
        await clipboard.writeText(value);
        return true;
      } catch {
        return false;
      }
    }
    async function copyAdminCommand(command, message) {
      const copied = await copyTextToClipboard(command);
      state.adminPanelMessage = copied
        ? message
        : 'Copy this command in the CE bot: ' + command;
      renderAdmin();
    }
    async function copyAdminAddress(address) {
      const value = String(address || '').trim();
      if (!value) return;
      state.adminAddress = value;
      const copied = await copyTextToClipboard(value);
      state.adminPanelMessage = copied
        ? 'Address copied and pasted into the wallet address field.'
        : 'Address pasted into the wallet address field.';
      renderAdmin();
    }
    function adminAddressValue(entry) {
      return String((entry && typeof entry === 'object' ? entry.address : entry) || '').trim();
    }
    function appendAdminAddressList(panel, title, entries = []) {
      const values = (Array.isArray(entries) ? entries : []).map(adminAddressValue).filter(Boolean);
      const list = document.createElement('div');
      list.className = 'adminAddressList';
      const heading = document.createElement('span');
      heading.textContent = title + ': ' + (values.length ? 'tap an address to copy/fill' : 'None');
      list.appendChild(heading);
      values.forEach((value) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'adminAddressButton';
        button.textContent = value;
        button.title = value;
        button.onclick = () => copyAdminAddress(value);
        list.appendChild(button);
      });
      panel.appendChild(list);
    }
    async function downloadAdminExport() {
      const sessionSlug = activeAdminSessionSlug();
      if (!sessionSlug) return;
      await copyAdminCommand('/export_all ' + sessionSlug, 'Export command copied. Paste it in the CE bot.');
    }
    async function createAdminGroupLink() {
      const sessionSlug = activeAdminSessionSlug();
      if (!sessionSlug) return;
      state.adminBusy = true;
      state.adminPanelMessage = '';
      renderAdmin();
      try {
        const response = await fetch('/telegram/mini-app/api/admin/group-link', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ launch, sessionSlug }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body.ok === false) {
          state.adminPanelMessage = 'Could not create group link: ' + (body.error || 'group_link_failed');
        } else {
          state.adminData = body;
          state.adminPanelMessage = 'Group invite link created.';
        }
      } catch {
        state.adminPanelMessage = 'Could not create group link. Check connection and try again.';
      }
      state.adminBusy = false;
      renderAdmin();
    }
    function appendAdminActionPanel(sessionSlug) {
      const action = state.adminActiveAction;
      if (!action) return;
      const panel = document.createElement('div');
      panel.className = 'adminCard adminForm';
      const heading = document.createElement('strong');
      heading.textContent = ADMIN_ACTION_LABELS[action] || action;
      panel.appendChild(heading);
      if (state.adminBusy) {
        const busy = document.createElement('span');
        busy.textContent = 'Loading...';
        panel.appendChild(busy);
      }
      if (action === 'export_all') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary';
        button.disabled = state.adminBusy;
        button.textContent = 'Copy export command';
        button.onclick = downloadAdminExport;
        const command = document.createElement('div');
        command.className = 'adminCommand';
        command.textContent = 'Bot command: /export_all ' + sessionSlug;
        panel.append(button, command);
      } else if (['export_access', 'export_allow', 'export_revoke'].includes(action)) {
        const access = state.adminData?.access || {};
        const inputLabel = document.createElement('label');
        const inputText = document.createElement('span');
        inputText.textContent = 'Wallet address';
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = '0x...';
        input.value = state.adminAddress || '';
        input.oninput = () => {
          state.adminAddress = input.value;
        };
        inputLabel.append(inputText, input);
        const row = document.createElement('div');
        row.className = 'resultActions';
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'secondary';
        add.disabled = state.adminBusy;
        add.textContent = 'Add admin';
        add.onclick = () => submitAdminAccess('add');
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'secondary';
        remove.disabled = state.adminBusy;
        remove.textContent = 'Remove admin';
        remove.onclick = () => submitAdminAccess('remove');
        row.append(add, remove);
        const commands = document.createElement('div');
        commands.className = 'adminCommand';
        const address = state.adminAddress || '0x...';
        commands.textContent = 'Bot commands: /export_allow ' + address + ' ' + sessionSlug + ' | /export_revoke ' + address + ' ' + sessionSlug;
        panel.append(inputLabel, row);
        appendAdminAddressList(panel, 'Configured admins', access.configuredAdmins || []);
        appendAdminAddressList(panel, 'Added admins', access.additionalAdmins || []);
        panel.appendChild(commands);
      } else if (action === 'results_settings') {
        const settings = state.adminData?.resultsExposure || {};
        [
          ['publishedQuestionsEnabled', 'Published questions visible'],
          ['aggregateResultsEnabled', 'Aggregate results visible'],
          ['anonymizedGroupsEnabled', 'Anonymized groups visible'],
        ].forEach(([key, labelText]) => {
          const row = document.createElement('label');
          row.className = 'adminToggleRow';
          const label = document.createElement('span');
          label.textContent = labelText;
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = settings[key] === true;
          input.onchange = () => {
            state.adminData.resultsExposure = state.adminData.resultsExposure || {};
            state.adminData.resultsExposure[key] = input.checked;
          };
          row.append(label, input);
          panel.appendChild(row);
        });
        const minLabel = document.createElement('label');
        const minText = document.createElement('span');
        minText.textContent = 'Minimum group size';
        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.min = '1';
        minInput.max = '50';
        minInput.value = String(settings.minGroupSize || 2);
        minInput.oninput = () => {
          state.adminData.resultsExposure = state.adminData.resultsExposure || {};
          state.adminData.resultsExposure.minGroupSize = minInput.value;
        };
        minLabel.append(minText, minInput);
        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'secondary';
        save.disabled = state.adminBusy;
        save.textContent = 'Save results settings';
        save.onclick = submitAdminResultsSettings;
        panel.append(minLabel, save);
      } else if (action === 'question_queue') {
        const queue = state.adminData?.questionQueue || {};
        if (state.adminQuestionQueueRefs === undefined) {
          state.adminQuestionQueueRefs = (queue.sponsoredQuestionIds || []).join(' ');
        }
        const label = document.createElement('label');
        const labelText = document.createElement('span');
        labelText.textContent = 'Sponsored question refs';
        const input = document.createElement('textarea');
        input.placeholder = '1 3 4';
        input.value = state.adminQuestionQueueRefs || '';
        input.oninput = () => {
          state.adminQuestionQueueRefs = input.value;
        };
        label.append(labelText, input);
        const row = document.createElement('div');
        row.className = 'resultActions';
        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'secondary';
        save.disabled = state.adminBusy;
        save.textContent = 'Save queue';
        save.onclick = () => submitAdminQuestionQueue(false);
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'secondary';
        clear.disabled = state.adminBusy;
        clear.textContent = 'Clear queue';
        clear.onclick = () => submitAdminQuestionQueue(true);
        row.append(save, clear);
        const candidates = document.createElement('span');
        candidates.textContent = (state.adminData?.candidates || []).slice(0, 8)
          .map((candidate) => candidate.ref + '. ' + candidate.prompt)
          .join(' | ') || 'No questions loaded yet.';
        const command = document.createElement('div');
        command.className = 'adminCommand';
        command.textContent = 'Bot command: /question_queue 1 3 4';
        panel.append(label, row, candidates, command);
      } else if (action === 'group_link') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary';
        button.disabled = state.adminBusy;
        button.textContent = state.adminData?.link ? 'Create another link' : 'Create add-bot-to-group link';
        button.onclick = createAdminGroupLink;
        panel.appendChild(button);
        if (state.adminData?.link) {
          const link = document.createElement('a');
          link.href = state.adminData.link;
          link.textContent = state.adminData.link;
          link.target = '_blank';
          link.rel = 'noreferrer';
          panel.appendChild(link);
        }
      }
      if (state.adminPanelMessage) {
        const note = document.createElement('span');
        note.textContent = state.adminPanelMessage;
        panel.appendChild(note);
      }
      el.adminActions.appendChild(panel);
    }
    function renderAdmin() {
      const admin = state.data?.admin || {};
      const available = admin.available === true;
      el.showAdmin.hidden = !available;
      if (!available) {
        el.adminSummary.textContent = admin.reason
          ? 'Admin access unavailable: ' + admin.reason
          : 'Admin access is not available for this account.';
        el.adminActions.innerHTML = '';
        el.adminPanel.classList.remove('open');
        el.showAdmin.classList.remove('active');
        el.showAdmin.setAttribute('aria-expanded', 'false');
        return;
      }
      el.adminSummary.textContent = admin.accountAddressShort
        ? 'Authorized as ' + admin.accountAddressShort + ' for ' + (admin.sessionSlug || 'selected session') + (admin.canManage === false ? ' export' : '')
        : 'Authorized for ' + (admin.sessionSlug || 'selected session') + (admin.canManage === false ? ' export' : '');
      el.adminActions.innerHTML = '';
      const sessionSlug = admin.sessionSlug || state.data?.session?.sessionSlug || '';
      const adminActions = normalizeAdminActions(admin.actions);
      adminActions.forEach((action) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary';
        if (state.adminActiveAction === action.action) button.classList.add('active');
        button.dataset.action = action.action;
        button.textContent = action.label || action.action;
        button.setAttribute('aria-label', action.label || action.action);
        button.onclick = () => {
          const nextAction = ['export_allow', 'export_revoke'].includes(action.action) ? 'export_access' : action.action;
          if (state.adminActiveAction !== nextAction) state.adminQuestionQueueRefs = undefined;
          state.adminActiveAction = nextAction;
          state.adminData = null;
          state.adminPanelMessage = '';
          if (state.adminActiveAction === 'export_all') {
            renderAdmin();
          } else {
            loadAdminData(state.adminActiveAction, { force: true });
          }
          renderAdmin();
        };
        el.adminActions.appendChild(button);
      });
      appendAdminActionPanel(sessionSlug);
    }
    function shortQuestionLabel(value) {
      const text = String(value || '').trim();
      return text.length > 14 ? text.slice(0, 8) + '...' + text.slice(-4) : text;
    }
    function renderActivity() {
      if (!el.activitySummary || !el.activityList) return;
      el.activityList.innerHTML = '';
      if (state.activityLoading) {
        el.activitySummary.textContent = 'Loading activity...';
        return;
      }
      if (state.activityMessage) {
        el.activitySummary.textContent = state.activityMessage;
      } else if (!state.activityData) {
        el.activitySummary.textContent = 'Open Activity to review agent drafts, votes, and suggestions.';
      } else {
        const sessions = Array.isArray(state.activityData.sessionSlugs) && state.activityData.sessionSlugs.length
          ? state.activityData.sessionSlugs.join(', ')
          : 'selected sessions';
        const count = Array.isArray(state.activityData.actions) ? state.activityData.actions.length : 0;
        el.activitySummary.textContent = count + ' activity item' + (count === 1 ? '' : 's') + ' for ' + sessions + '.';
      }
      const items = Array.isArray(state.activityData?.actions) ? state.activityData.actions : [];
      if (state.activityData && !items.length) {
        const empty = document.createElement('div');
        empty.className = 'activityCard';
        const text = document.createElement('span');
        text.textContent = 'No agent activity yet.';
        empty.appendChild(text);
        el.activityList.appendChild(empty);
        return;
      }
      items.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'activityCard';
        const title = document.createElement('strong');
        title.textContent = item.summary || item.type || 'Activity';
        const meta = document.createElement('span');
        const parts = [
          item.sessionSlug || '',
          item.questionId ? shortQuestionLabel(item.questionId) : '',
          String(item.status || '').replace(/_/g, ' '),
        ].filter(Boolean);
        meta.textContent = parts.join(' | ');
        card.append(title, meta);
        if (item.pendingAction) {
          const pending = document.createElement('span');
          pending.textContent = 'Pending: ' + String(item.pendingAction).replace(/_/g, ' ');
          card.appendChild(pending);
        }
        if (item.content?.reason) {
          const reason = document.createElement('span');
          reason.textContent = item.content.reason;
          card.appendChild(reason);
        }
        el.activityList.appendChild(card);
      });
    }
    async function previewDocument(doc, item) {
      const existing = item.querySelector('.documentPreview');
      if (existing) {
        existing.remove();
        return;
      }
      const preview = document.createElement('div');
      preview.className = 'documentPreview';
      const status = document.createElement('span');
      status.textContent = 'Loading preview...';
      preview.appendChild(status);
      item.appendChild(preview);
      let sourceUrl = doc.externalUrl || '';
      let objectUrl = '';
      if (!sourceUrl && doc.previewAvailable) {
        try {
          const previewUrl = new URL('/telegram/mini-app/api/documents/preview', location.origin);
          previewUrl.searchParams.set('launch', launch);
          previewUrl.searchParams.set('sessionSlug', state.documentsSessionSlug);
          previewUrl.searchParams.set('docId', doc.docId);
          const response = await fetch(previewUrl.pathname + previewUrl.search, { headers: headers({ json: false }) });
          if (!response.ok) throw new Error('preview_unavailable');
          const blob = await response.blob();
          objectUrl = URL.createObjectURL(blob);
          sourceUrl = objectUrl;
        } catch {
          status.textContent = 'Preview unavailable.';
          return;
        }
      }
      preview.innerHTML = '';
      if (doc.previewKind === 'image' && sourceUrl) {
        const image = document.createElement('img');
        image.src = sourceUrl;
        image.alt = 'Preview of ' + (doc.title || 'document');
        preview.appendChild(image);
      } else if (doc.previewKind === 'pdf' && sourceUrl) {
        const frame = document.createElement('iframe');
        frame.src = sourceUrl;
        frame.title = 'Preview of ' + (doc.title || 'document');
        preview.appendChild(frame);
      }
      if (sourceUrl) {
        const link = document.createElement('a');
        link.href = sourceUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = doc.previewKind === 'pdf' ? 'Open PDF' : 'Open document';
        preview.appendChild(link);
      } else {
        status.textContent = 'Preview unavailable.';
        preview.appendChild(status);
      }
    }
    function renderDocuments() {
      const sessions = selectedResultsSessions();
      if (!state.documentsSessionSlug || !sessions.some((session) => session.sessionSlug === state.documentsSessionSlug)) {
        state.documentsSessionSlug = sessions[0]?.sessionSlug || state.data?.session?.sessionSlug || '';
      }
      el.documentsSessionOptions.innerHTML = '';
      sessions.forEach((session) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary' + (session.sessionSlug === state.documentsSessionSlug ? ' active' : '');
        button.textContent = session.sessionName || session.sessionSlug;
        button.onclick = () => {
          state.documentsSessionSlug = session.sessionSlug;
          state.documentsData = null;
          state.documentsMessage = '';
          loadDocuments({ force: true });
        };
        el.documentsSessionOptions.appendChild(button);
      });
      el.refreshDocuments.disabled = state.documentsLoading || !state.documentsSessionSlug;
      el.uploadDocument.disabled = state.documentsUploading || state.documentsLoading || !state.documentsSessionSlug || !el.documentFile.files?.length;
      el.addDocumentUrl.disabled = state.documentsUploading || state.documentsLoading || !state.documentsSessionSlug || !el.documentUrl.value.trim();
      el.uploadDocument.textContent = state.documentsUploading ? 'Uploading...' : 'Upload document';
      el.addDocumentUrl.textContent = state.documentsUploading ? 'Adding URL...' : 'Add URL';
      el.documentsPanel.classList.toggle('documentsCollapsed', state.documentsSectionOpen !== true);
      el.toggleDocumentsPanelBody.setAttribute('aria-expanded', state.documentsSectionOpen === true ? 'true' : 'false');
      const panelPath = el.toggleDocumentsPanelBody.querySelector('path');
      if (panelPath) panelPath.setAttribute('d', state.documentsSectionOpen === true ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6');
      el.documentList.innerHTML = '';
      if (state.documentsLoading) {
        el.documentsSummary.textContent = 'Loading documents...';
      } else if (!state.documentsSessionSlug) {
        el.documentsSummary.textContent = 'Select a session to view documents.';
      } else if (state.documentsData?.ok === false) {
        el.documentsSummary.textContent = state.documentsMessage || ('Could not load documents: ' + (state.documentsData.error || 'documents_unavailable'));
      } else {
        const documents = state.documentsData?.documents?.documents || [];
        const maxBytes = state.documentsData?.documents?.upload?.maxBytes || 0;
        const countText = documents.length + ' documents' + (maxBytes ? ' | upload limit ' + Math.round(maxBytes / 1024) + ' KB' : '');
        el.documentsSummary.textContent = state.documentsMessage
          ? state.documentsMessage + ' ' + countText
          : countText;
        if (!documents.length) {
          appendEmptyResult(el.documentList, 'No documents linked to this session yet.');
        } else {
          documents.forEach((doc) => {
            const item = document.createElement('div');
            item.className = 'documentItem';
            const canOpen = doc.previewAvailable || doc.externalUrl;
            const title = document.createElement(canOpen ? 'button' : 'strong');
            if (canOpen) {
              title.type = 'button';
              title.className = 'documentPreviewButton';
              title.onclick = () => previewDocument(doc, item);
            }
            title.textContent = doc.title || 'Untitled document';
            const meta = document.createElement('span');
            meta.textContent = [
              doc.fileType,
              doc.visibility,
              doc.byteLength ? doc.byteLength + ' bytes' : '',
              canOpen ? (doc.previewAvailable ? 'click to preview' : 'click to open') : '',
            ].filter(Boolean).join(' | ');
            item.append(title, meta);
            if (doc.contentPreview) {
              const preview = document.createElement('span');
              preview.textContent = doc.contentPreview;
              item.appendChild(preview);
            }
            if (doc.previewKind && !canOpen) {
              const note = document.createElement('span');
              note.textContent = 'Preview unavailable for this older record. Re-upload the file to preview it here.';
              item.appendChild(note);
            }
            el.documentList.appendChild(item);
          });
        }
      }
    }
    function documentUploadErrorMessage(body, status) {
      const error = body?.error || 'documents_upload_failed';
      if (error === 'document_file_too_large') {
        const maxBytes = Number(body?.maxBytes || 0) || 0;
        const maxLabel = maxBytes ? Math.round(maxBytes / 1024) + ' KB' : 'the current upload limit';
        return 'Could not upload document: file is larger than ' + maxLabel + '.';
      }
      if (error === 'document_type_unsupported') {
        const supported = Array.isArray(body?.supportedTypes) && body.supportedTypes.length
          ? body.supportedTypes.join(', ')
          : 'Markdown, text, PDF, PNG, JPEG, and WebP';
        return 'Could not upload document: unsupported file type. Supported types: ' + supported + '.';
      }
      if (error === 'document_file_empty') return 'Could not upload document: the file is empty.';
      if (error === 'document_url_required') return 'Could not add URL: enter a URL first.';
      if (error === 'document_url_invalid') return 'Could not add URL: use a valid http or https URL without embedded credentials.';
      if (error === 'document_url_too_long') return 'Could not add URL: the URL is too long.';
      if (error === 'telegram_only_session_required') return 'Could not upload document: uploads are only enabled for Telegram-only sessions.';
      if (error === 'action_kv_unavailable') return 'Could not upload document: document storage is unavailable.';
      return 'Could not upload document' + (status ? ' (' + status + ')' : '') + ': ' + error + '.';
    }
    function renderGroups() {
      const sessions = selectedResultsSessions();
      if (!state.groupsSessionSlug || !sessions.some((session) => session.sessionSlug === state.groupsSessionSlug)) {
        state.groupsSessionSlug = sessions[0]?.sessionSlug || state.data?.session?.sessionSlug || '';
      }
      const currentSession = sessions.find((session) => session.sessionSlug === state.groupsSessionSlug) || {};
      el.groupsTitleSession.textContent = currentSession.sessionName || state.groupsSessionSlug || '';
      const groups = state.groupsData?.groups || state.data?.groups || null;
      const categories = Array.isArray(groups?.categories) ? groups.categories : [];
      const selections = Object.keys(state.groupSelections || {}).length
        ? state.groupSelections
        : (groups?.selections || {});
      const details = Object.keys(state.groupDetails || {}).length
        ? state.groupDetails
        : (groups?.details || {});
      el.saveGroups.disabled = state.groupsSaving || state.groupsLoading || !state.groupsSessionSlug || !categories.length;
      const saveText = state.groupsSaving ? 'Saving groups...' : (state.groupsSaveMessage || 'Save groups');
      el.saveGroups.textContent = saveText;
      if (state.groupsLoading) {
        el.groupsSummary.textContent = 'Loading groups...';
      } else if (!state.groupsSessionSlug) {
        el.groupsSummary.textContent = 'Select a session to manage groups.';
      } else if (state.groupsData?.ok === false) {
        el.groupsSummary.textContent = 'Could not load groups: ' + (state.groupsData.error || 'groups_unavailable');
      } else {
        el.groupsSummary.textContent = categories.length ? '' : 'No groups are configured for this session.';
      }
      el.groupProposals.innerHTML = '';
      const proposals = Array.isArray(groups?.proposals) ? groups.proposals : [];
      proposals.forEach((proposal) => {
        const item = document.createElement('div');
        item.className = 'groupProposal';
        item.textContent = proposal.message || 'An agent suggested a group choice for your review.';
        el.groupProposals.appendChild(item);
      });
      el.groupCategories.innerHTML = '';
      categories.forEach((category) => {
        const categoryId = String(category.categoryId || category.label || '').trim();
        const expanded = state.groupCategoryOpen[categoryId] === true;
        const section = document.createElement('section');
        section.className = 'groupCategory' + (expanded ? '' : ' collapsed');
        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'groupCategoryHeader';
        header.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        const headerText = document.createElement('div');
        headerText.className = 'groupCategoryHeaderText';
        const title = document.createElement('strong');
        title.textContent = category.label;
        const description = document.createElement('span');
        description.textContent = category.description || (category.selectionMode === 'multi' ? 'Choose any that apply.' : 'Choose one.');
        const caret = document.createElement('span');
        caret.innerHTML = expanded ? CARET_UP_ICON : CARET_DOWN_ICON;
        header.onclick = () => {
          state.groupCategoryOpen[categoryId] = !expanded;
          renderGroups();
        };
        headerText.append(title, description);
        header.append(headerText, caret);
        const options = document.createElement('div');
        options.className = 'groupOptions';
        const selected = new Set(Array.isArray(selections[categoryId]) ? selections[categoryId] : []);
        (category.options || []).forEach((option) => {
          const label = document.createElement('label');
          label.className = 'groupOption';
          const input = document.createElement('input');
          input.type = category.selectionMode === 'multi' ? 'checkbox' : 'radio';
          input.name = 'group-' + categoryId;
          input.value = option.optionId;
          input.checked = selected.has(option.optionId);
          input.onchange = () => {
            state.groupsSaveMessage = '';
            const next = new Set(Array.isArray(state.groupSelections[categoryId])
              ? state.groupSelections[categoryId]
              : Array.from(selected));
            if (category.selectionMode === 'single') {
              state.groupSelections[categoryId] = input.checked ? [option.optionId] : [];
            } else {
              if (input.checked) next.add(option.optionId);
              else next.delete(option.optionId);
              state.groupSelections[categoryId] = Array.from(next);
            }
            renderGroups();
          };
          const text = document.createElement('span');
          text.textContent = option.label;
          label.append(input, text);
          options.appendChild(label);
        });
        if (categoryId === 'country_relationship' && (selected.has('live_in') || selected.has('citizen_of'))) {
          const countryDetails = document.createElement('div');
          countryDetails.className = 'groupCountryDetails';
          const renderCountrySelect = (field, labelText) => {
            const fieldWrap = document.createElement('label');
            fieldWrap.className = 'field';
            const fieldLabel = document.createElement('span');
            fieldLabel.textContent = labelText;
            const select = document.createElement('select');
            select.className = 'groupCountrySelect';
            COUNTRY_OPTIONS.forEach(([value, label]) => {
              const option = document.createElement('option');
              option.value = value;
              option.textContent = label;
              select.appendChild(option);
            });
            select.value = details.country_relationship?.[field] || '';
            select.onchange = () => {
              state.groupsSaveMessage = '';
              state.groupDetails.country_relationship = state.groupDetails.country_relationship || { ...(details.country_relationship || {}) };
              state.groupDetails.country_relationship[field] = select.value;
            };
            fieldWrap.append(fieldLabel, select);
            countryDetails.appendChild(fieldWrap);
          };
          if (selected.has('live_in')) renderCountrySelect('live_in_country', 'Live in country');
          if (selected.has('citizen_of')) renderCountrySelect('citizen_of_country', 'Citizen of country');
          options.appendChild(countryDetails);
        }
        if (categoryId === 'contribution_role' && selected.has('other')) {
          const otherDetails = document.createElement('div');
          otherDetails.className = 'groupOtherDetails';
          const fieldWrap = document.createElement('label');
          fieldWrap.className = 'field';
          const fieldLabel = document.createElement('span');
          fieldLabel.textContent = 'Other role';
          const input = document.createElement('input');
          input.type = 'text';
          input.value = details.contribution_role?.other_text || '';
          input.placeholder = 'Describe your role';
          input.oninput = () => {
            state.groupsSaveMessage = '';
            state.groupDetails.contribution_role = state.groupDetails.contribution_role || { ...(details.contribution_role || {}) };
            state.groupDetails.contribution_role.other_text = input.value;
          };
          const save = document.createElement('button');
          save.type = 'button';
          save.className = 'secondary';
          save.textContent = 'Save';
          save.disabled = state.groupsSaving || state.groupsLoading || !state.groupsSessionSlug;
          save.onclick = () => saveGroups();
          fieldWrap.append(fieldLabel, input);
          otherDetails.append(fieldWrap, save);
          options.appendChild(otherDetails);
        }
        section.append(header, options);
        el.groupCategories.appendChild(section);
      });
    }
    function renderUrlQuestionCandidates() {
      el.urlQuestionCandidates.innerHTML = '';
      const candidates = Array.isArray(state.addQuestionUrlCandidates) ? state.addQuestionUrlCandidates : [];
      candidates.forEach((candidate, index) => {
        const row = document.createElement('div');
        row.className = 'urlQuestionCandidate';
        const body = document.createElement('div');
        const prompt = document.createElement('div');
        prompt.className = 'urlQuestionCandidatePrompt';
        prompt.textContent = candidate.prompt || 'Untitled question';
        const meta = document.createElement('div');
        meta.className = 'urlQuestionCandidateMeta';
        const options = Array.isArray(candidate.options) && candidate.options.length
          ? ' | ' + candidate.options.join(' / ')
          : '';
        meta.textContent = questionTypeLabel(candidate.questionType || state.addQuestionType) + options;
        body.append(prompt, meta);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'urlQuestionCandidateRemove';
        remove.setAttribute('aria-label', 'Remove generated question');
        remove.textContent = 'X';
        remove.onclick = () => {
          state.addQuestionUrlCandidates = candidates.filter((_, candidateIndex) => candidateIndex !== index);
          state.addQuestionMessage = state.addQuestionUrlCandidates.length
            ? state.addQuestionUrlCandidates.length + ' generated questions ready.'
            : '';
          renderAddQuestion();
        };
        row.append(body, remove);
        el.urlQuestionCandidates.appendChild(row);
      });
    }
    function renderAddQuestion() {
      const sessions = selectedResultsSessions();
      if (!state.addQuestionSessionSlug || !sessions.some((session) => session.sessionSlug === state.addQuestionSessionSlug)) {
        state.addQuestionSessionSlug = sessions[0]?.sessionSlug || state.data?.session?.sessionSlug || '';
      }
      const currentSession = sessions.find((session) => session.sessionSlug === state.addQuestionSessionSlug) || {};
      if (!String(state.addQuestionSessionContext || '').trim() && currentSession.sessionContext) {
        state.addQuestionSessionContext = currentSession.sessionContext;
      }
      el.addQuestionTitleSession.textContent = currentSession.sessionName || state.addQuestionSessionSlug || 'No session selected';
      el.addQuestionTypes.innerHTML = '';
      QUESTION_TYPES.forEach(([value, label]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary' + (state.addQuestionType === value ? ' active' : '');
        button.textContent = label;
        button.onclick = () => {
          state.addQuestionType = value;
          state.addQuestionMessage = '';
          renderAddQuestion();
        };
        el.addQuestionTypes.appendChild(button);
      });
      el.toggleAddQuestionUrl.className = 'addQuestionFromUrlToggle' + (state.addQuestionUrlOpen ? ' active' : '');
      el.toggleAddQuestionUrl.setAttribute('aria-expanded', state.addQuestionUrlOpen ? 'true' : 'false');
      el.addQuestionUrlControls.hidden = !state.addQuestionUrlOpen;
      el.addQuestionUrl.value = state.addQuestionUrl;
      el.generateUrlQuestions.disabled = state.addQuestionUrlGenerating || !state.addQuestionSessionSlug || !state.addQuestionUrl.trim();
      el.generateUrlQuestions.textContent = state.addQuestionUrlGenerating ? 'Generating...' : 'Generate';
      el.submitUrlQuestions.hidden = !state.addQuestionUrlCandidates.length;
      el.submitUrlQuestions.disabled = state.addQuestionUrlSubmitting || !state.addQuestionUrlCandidates.length;
      el.submitUrlQuestions.textContent = state.addQuestionUrlSubmitting ? 'Adding...' : 'Add generated questions';
      renderUrlQuestionCandidates();
      el.addQuestionPrompt.value = state.addQuestionPrompt;
      if (el.addQuestionMic.getAttribute('aria-pressed') !== 'true') {
        el.addQuestionMic.innerHTML = MIC_ICON;
        el.addQuestionMic.dataset.idleLabel = 'Dictate question';
        el.addQuestionMic.dataset.stopLabel = 'Stop recording question';
        el.addQuestionMic.setAttribute('aria-label', 'Dictate question');
      }
      el.addQuestionOptions.value = state.addQuestionOptions;
      el.addQuestionOptions.hidden = state.addQuestionType !== 'multichoice';
      el.submitAddQuestion.disabled = state.addQuestionSaving || !state.addQuestionSessionSlug || !state.addQuestionPrompt.trim();
      el.addQuestionSummary.textContent = state.addQuestionSaving
        ? 'Adding question...'
        : (state.addQuestionUrlGenerating
          ? 'Generating questions from URL...'
          : (state.addQuestionUrlSubmitting
            ? 'Adding generated questions...'
            : (state.addQuestionMessage || (state.addQuestionType === 'multichoice'
              ? 'Add at least two choices, one per line or separated by commas.'
              : ''))));
    }
    function renderFilters() {
      el.filterUnansweredFirst.checked = state.showUnansweredFirst;
      el.filterAnsweredOnly.checked = state.answeredQuestionsOnly === true;
      el.filterTopPopular.checked = state.popularQuestionsOnly === true;
      state.popularQuestionLimit = normalizePopularQuestionLimit(state.popularQuestionLimit);
      el.filterTopPopularLimit.value = String(state.popularQuestionLimit);
      el.decrementTopPopular.disabled = state.popularQuestionLimit <= POPULAR_QUESTION_LIMIT_MIN;
      el.incrementTopPopular.disabled = state.popularQuestionLimit >= POPULAR_QUESTION_LIMIT_MAX;
      el.filterAiSearch.value = state.aiDraftQuery;
      el.clearAiSearch.hidden = !String(state.aiDraftQuery || state.aiSearchQuery || '').trim();
      renderFilterSubsection(el.questionTypeFilterSection, el.toggleQuestionTypeFilters, state.questionTypeFiltersExpanded);
      renderFilterSubsection(el.aiSearchFilterSection, el.toggleAiSearchFilter, state.aiSearchFilterExpanded);
      const questions = Array.isArray(state.data?.questions) ? state.data.questions : [];
      const typeEntries = [...new Set(questions.map(questionTypeFilterValue).filter(Boolean))]
        .sort((left, right) => questionTypeLabel(left).localeCompare(questionTypeLabel(right)));
      el.questionTypeFilters.innerHTML = '';
      if (!typeEntries.length) {
        const empty = document.createElement('span');
        empty.className = 'filterSummary';
        empty.textContent = 'No question types loaded.';
        el.questionTypeFilters.appendChild(empty);
      } else {
        typeEntries.forEach((type) => {
          const label = document.createElement('label');
          label.className = 'typeFilter';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.value = type;
          input.checked = state.selectedQuestionTypes.has(type);
          input.onchange = () => {
            if (input.checked) state.selectedQuestionTypes.add(type);
            else state.selectedQuestionTypes.delete(type);
            render();
          };
          const text = document.createElement('span');
          text.textContent = questionTypeLabel(type);
          label.append(input, text);
          el.questionTypeFilters.appendChild(label);
        });
      }
      const tagCounts = new Map();
      questions.forEach((question) => {
        questionTags(question).forEach((tag) => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      });
      const tagEntries = Array.from(tagCounts.entries())
        .sort((left, right) => right[1] - left[1] || questionTagLabel(left[0]).localeCompare(questionTagLabel(right[0])))
        .slice(0, 30);
      const visibleTagEntries = state.questionTagFiltersExpanded
        ? tagEntries
        : tagEntries.slice(0, QUESTION_TAG_FILTER_COLLAPSED_LIMIT);
      if (el.toggleQuestionTagFilters) {
        el.toggleQuestionTagFilters.setAttribute('aria-expanded', state.questionTagFiltersExpanded ? 'true' : 'false');
        const caret = el.toggleQuestionTagFilters.querySelector('.tagFilterCaret');
        if (caret) caret.innerHTML = state.questionTagFiltersExpanded ? CARET_UP_ICON : CARET_DOWN_ICON;
      }
      if (el.questionTagFilterHint) {
        el.questionTagFilterHint.textContent = tagEntries.length > QUESTION_TAG_FILTER_COLLAPSED_LIMIT
          ? (state.questionTagFiltersExpanded ? 'showing all ' + tagEntries.length : 'top ' + QUESTION_TAG_FILTER_COLLAPSED_LIMIT + ' of ' + tagEntries.length)
          : '';
      }
      el.questionTagFilters.innerHTML = '';
      if (!tagEntries.length) {
        const empty = document.createElement('span');
        empty.className = 'filterSummary';
        empty.textContent = 'No tags loaded yet.';
        el.questionTagFilters.appendChild(empty);
      } else {
        visibleTagEntries.forEach(([tag, count]) => {
          const label = document.createElement('label');
          label.className = 'typeFilter';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.value = tag;
          input.checked = state.selectedQuestionTags.has(tag);
          input.onchange = () => {
            if (input.checked) state.selectedQuestionTags.add(tag);
            else state.selectedQuestionTags.delete(tag);
            render();
          };
          const text = document.createElement('span');
          text.textContent = questionTagLabel(tag) + ' (' + count + ')';
          label.append(input, text);
          el.questionTagFilters.appendChild(label);
        });
      }
      const total = questions.length;
      const shown = filteredQuestionEntries().length;
      const active = [];
      if (state.answeredQuestionsOnly) active.push('answered only');
      if (state.popularQuestionsOnly) active.push('top ' + state.popularQuestionLimit + ' popular');
      if (state.selectedQuestionTypes.size) active.push(Array.from(state.selectedQuestionTypes).map(questionTypeLabel).join(', '));
      if (state.selectedQuestionTags.size) active.push(Array.from(state.selectedQuestionTags).map(questionTagLabel).join(', '));
      if (state.aiSearchQuery) active.push('AI "' + state.aiSearchQuery + '"' + (state.aiSearchSource ? ' via ' + state.aiSearchSource : ''));
      el.filterSummary.textContent = active.length
        ? shown + ' of ' + total + ' questions match: ' + active.join(' | ')
        : total + ' questions loaded.';
    }
    function renderAgentSettings() {
      const settings = state.data?.agent?.settings || {};
      const values = settings.values || {};
      const draftField = (settings.editableFields || []).find((field) => field.field === 'draftStyle') || {};
      const options = Array.isArray(draftField.options) && draftField.options.length
        ? draftField.options
        : ['concise', 'balanced', 'detailed'];
      el.draftStyle.innerHTML = '';
      options.forEach((option) => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        if ((values.draftStyle || 'balanced') === option) opt.selected = true;
        el.draftStyle.appendChild(opt);
      });
      el.demoDataResults.checked = state.resultsDemoData === true;
      const demoMenuButton = typeof el.demoDataResults.closest === 'function'
        ? el.demoDataResults.closest('.menuCheckbox')
        : null;
      if (demoMenuButton) demoMenuButton.classList.toggle('active', state.resultsDemoData === true);
      if (el.agentAutoApplyQuestionVotes) {
        el.agentAutoApplyQuestionVotes.checked = values.agentAutoApplyQuestionVotes === true;
      }
      if (el.topicPreferences) {
        el.topicPreferences.value = Array.isArray(values.topicPreferences) ? values.topicPreferences.join(', ') : '';
      }
      if (el.demographicLinkOptIn) {
        el.demographicLinkOptIn.checked = values.demographicLinkOptIn === true;
      }
      if (el.attendanceLinkOptIn) {
        el.attendanceLinkOptIn.checked = values.attendanceLinkOptIn === true;
      }
      if (el.draftDivergenceOptIn) {
        el.draftDivergenceOptIn.checked = values.draftDivergenceOptIn === true;
      }
      if (el.showAgentResponses) {
        el.showAgentResponses.checked = values.showAgentResponses !== false;
        const agentPredictionsMenuButton = typeof el.showAgentResponses.closest === 'function'
          ? el.showAgentResponses.closest('.menuCheckbox')
          : null;
        if (agentPredictionsMenuButton) agentPredictionsMenuButton.classList.toggle('active', values.showAgentResponses !== false);
      }
      const submittedAnswers = Array.isArray(state.data?.submittedAnswers) ? state.data.submittedAnswers : [];
      const savedDrafts = Array.isArray(state.data?.savedDrafts) ? state.data.savedDrafts : [];
      el.savedDrafts.innerHTML = '';
      const appendResponseSection = (titleText, rows, emptyText) => {
        const section = document.createElement('div');
        section.className = 'savedDraftsSection';
        const header = document.createElement('div');
        header.className = 'savedDraftsHeader';
        const title = document.createElement('strong');
        title.textContent = titleText;
        header.appendChild(title);
        section.appendChild(header);
        if (!rows.length) {
          const empty = document.createElement('div');
          empty.textContent = emptyText;
          section.appendChild(empty);
        } else {
          rows.forEach((answer) => {
            const row = document.createElement('div');
            row.className = 'agentOnlyBadgeRow';
            const text = document.createElement('span');
            text.textContent = 'Q' + answer.displayIndex + ': ' + answer.answerLabel;
            row.appendChild(text);
            const prediction = agentOnlyPredictionFor({ questionKey: answer.questionKey });
            if (prediction?.valueLabel) {
              const badge = document.createElement('span');
              const answerKind = ['agree', 'unsure', 'disagree'].includes(String(prediction.answerKind || ''))
                ? String(prediction.answerKind)
                : '';
              if (answerKind) {
                badge.className = 'agentPredictionBadge choicePrediction';
                const label = document.createElement('span');
                label.className = 'agentPredictionLabel';
                label.textContent = 'Agent prediction';
                const choice = document.createElement('span');
                choice.className = 'agentPredictionChoice ' + answerKind;
                choice.textContent = prediction.valueLabel;
                badge.append(label, choice);
              } else {
                badge.className = 'agentPredictionBadge';
                const label = document.createElement('span');
                label.className = 'agentPredictionLabel';
                label.textContent = 'Agent prediction';
                const value = document.createElement('span');
                value.className = 'agentPredictionValue';
                value.textContent = prediction.valueLabel;
                badge.append(label, value);
              }
              row.appendChild(badge);
            }
            section.appendChild(row);
          });
        }
        el.savedDrafts.appendChild(section);
      };
      appendResponseSection('Submitted responses', submittedAnswers, 'No submitted responses yet.');
      appendResponseSection('Saved draft responses', savedDrafts, 'No saved drafts yet.');
      el.submitDrafts.disabled = savedDrafts.length === 0 || state.submitDraftsBusy;
      el.submitDrafts.textContent = state.submitDraftsBusy
        ? 'Submitting drafts...'
        : (state.submitDraftsMessage || 'Submit drafts');
      el.clearDrafts.disabled = savedDrafts.length === 0;
    }
    function answerPayload(question) {
      const draft = draftFor(question);
      if (question.questionType === 'multichoice') return { values: draft.values || [], comments: draft.comments || '' };
      if (question.questionType === 'freeform') return { text: draft.text || '', comments: draft.comments || '' };
      return { value: draft.value, comments: draft.comments || '' };
    }
    async function submitQuestionVote(question, vote, triggerButton = null) {
      if (!question?.questionKey) return;
      activate(question);
      if (triggerButton) triggerButton.disabled = true;
      let response;
      let body;
      try {
        response = await fetch('/telegram/mini-app/api/question-vote', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            launch,
            questionKey: question.questionKey,
            vote,
          }),
        });
        body = await response.json().catch(() => ({}));
      } catch {
        if (triggerButton) triggerButton.disabled = false;
        setStatus('Could not save vote.', 'error');
        return;
      }
      if (triggerButton) triggerButton.disabled = false;
      if (!response.ok || !body.ok) {
        setStatus(body.error || 'Could not save vote.', 'error');
        renderQuestionStack();
        return;
      }
      const current = (state.data?.questions || []).find((entry) => entry.questionKey === question.questionKey);
      if (current) current.voteSummary = body.voteSummary || current.voteSummary || {};
      renderMeta(state.data);
      renderFilters();
      renderQuestionStack();
    }
    async function sendAnswer(submit, question = activeQuestion(), triggerButton = null, {
      suppressStatus = false,
      autoSave = false,
      autoSaveVersion = 0,
    } = {}) {
      if (!question) return false;
      activate(question);
      updateFooterControls();
      if (submit) {
        clearDraftAutosave(question);
        bumpDraftAutosaveVersion(question);
        if (!suppressStatus) setStatus('');
        setSubmitBusy(true, triggerButton, question);
      } else {
        if (!suppressStatus) setStatus('Saving draft...');
      }
      const payload = answerPayload(question);
      let response;
      let body;
      try {
        response = await fetch('/telegram/mini-app/api/draft', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            launch,
            questionKey: question.questionKey,
            answer: payload,
            submit,
          }),
        });
        body = await response.json().catch(() => ({}));
      } catch (error) {
        if (submit) setSubmitBusy(false, triggerButton, question);
        if (!suppressStatus) setStatus('Could not save answer.', 'error');
        return false;
      }
      if (submit) setSubmitBusy(false, triggerButton, question);
      if (!response.ok || !body.ok) {
        if (!suppressStatus) setStatus(userFacingErrorMessage(body, 'Could not save answer.'), 'error');
        return false;
      }
      if (
        autoSave &&
        autoSaveVersion &&
        state.draftAutosaveVersions.get(question.questionKey) !== autoSaveVersion
      ) {
        return true;
      }
      if (['submit_request_created', 'direct_submitted'].includes(body.status)) {
        if (!suppressStatus) setStatus('');
        state.submittedAnswerKeys.add(question.questionKey);
        state.savedDraftKeys.delete(question.questionKey);
        const submittedAnswer = {
          questionKey: question.questionKey,
          displayIndex: question.displayIndex,
          sessionSlug: question.sessionSlug,
          prompt: question.prompt || question.title || '',
          answerLabel: answerLabelForQuestion(question, payload),
          answer: { ...payload },
        };
        state.submittedAnswersByQuestionKey.set(question.questionKey, submittedAnswer);
        if (state.data) {
          const answers = Array.isArray(state.data.submittedAnswers) ? state.data.submittedAnswers : [];
          state.data.submittedAnswers = answers
            .filter((answer) => answer.questionKey !== question.questionKey)
            .concat(submittedAnswer);
        }
        if (Array.isArray(state.data?.savedDrafts)) {
          state.data.savedDrafts = state.data.savedDrafts.filter((draft) => draft.questionKey !== question.questionKey);
        }
        if (state.data?.draftAnswersByQuestionKey) delete state.data.draftAnswersByQuestionKey[question.questionKey];
        advanceSeriesQuestion(question, { renderNow: false });
      } else {
        if (!suppressStatus) setStatus('Draft saved.', 'ok');
        state.submitDraftsMessage = '';
        state.savedDraftKeys.add(question.questionKey);
        const savedDraftEntry = {
          questionKey: question.questionKey,
          displayIndex: question.displayIndex,
          sessionSlug: question.sessionSlug,
          prompt: question.prompt || question.title || '',
          answerLabel: body.draft?.answerLabel || answerLabelForQuestion(question, payload),
          selectedAt: body.draft?.selectedAt || new Date().toISOString(),
        };
        if (state.data) {
          const drafts = Array.isArray(state.data.savedDrafts) ? state.data.savedDrafts : [];
          state.data.savedDrafts = drafts
            .filter((draft) => draft.questionKey !== question.questionKey)
            .concat(savedDraftEntry);
          state.data.draftAnswersByQuestionKey = {
            ...(state.data.draftAnswersByQuestionKey || {}),
            [question.questionKey]: { ...payload },
          };
        }
      }
      if (autoSave) {
        refreshQuestionActionControls(question, triggerButton);
        renderAgentSettings();
      } else {
        render();
      }
      if (submit && tg?.HapticFeedback?.notificationOccurred) tg.HapticFeedback.notificationOccurred('success');
      return true;
    }
    async function sendSettings() {
      setStatus('Saving settings...');
      const response = await fetch('/telegram/mini-app/api/settings', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          launch,
          sessionSlug: state.data?.session?.sessionSlug || '',
          settings: {
            draftStyle: el.draftStyle.value,
            topicPreferences: el.topicPreferences ? el.topicPreferences.value : '',
            demographicLinkOptIn: el.demographicLinkOptIn ? el.demographicLinkOptIn.checked : false,
            attendanceLinkOptIn: el.attendanceLinkOptIn ? el.attendanceLinkOptIn.checked : false,
            draftDivergenceOptIn: el.draftDivergenceOptIn ? el.draftDivergenceOptIn.checked : false,
            showAgentResponses: el.showAgentResponses ? el.showAgentResponses.checked : true,
            agentAutoApplyQuestionVotes: el.agentAutoApplyQuestionVotes ? el.agentAutoApplyQuestionVotes.checked : false,
          },
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        setStatus(body.error || 'Could not save settings.', 'error');
        return;
      }
      state.data.agent.settings.values = {
        ...state.data.agent.settings.values,
        ...body.settings,
      };
      setStatus('Settings saved.', 'ok');
      if (tg?.HapticFeedback?.notificationOccurred) tg.HapticFeedback.notificationOccurred('success');
    }
    async function submitSavedDrafts() {
      const savedDrafts = Array.isArray(state.data?.savedDrafts) ? state.data.savedDrafts : [];
      const draftKeys = new Set(savedDrafts.map((draft) => draft.questionKey).filter(Boolean));
      const questions = (state.data?.questions || []).filter((question) => draftKeys.has(question.questionKey));
      if (!questions.length) return;
      state.submitDraftsBusy = true;
      state.submitDraftsMessage = '';
      renderAgentSettings();
      let submittedCount = 0;
      let failedCount = 0;
      for (const question of questions) {
        const submitted = await sendAnswer(true, question, null, { suppressStatus: true });
        if (submitted) submittedCount += 1;
        else failedCount += 1;
      }
      state.submitDraftsBusy = false;
      if (failedCount > 0) {
        state.submitDraftsMessage = submittedCount
          ? submittedCount + ' draft' + (submittedCount === 1 ? '' : 's') + ' submitted. ' + failedCount + ' failed.'
          : 'Could not submit drafts';
      } else {
        state.submitDraftsMessage = submittedCount + ' draft' + (submittedCount === 1 ? '' : 's') + ' submitted';
      }
      render();
    }
    async function clearSavedDrafts() {
      const savedDrafts = Array.isArray(state.data?.savedDrafts) ? state.data.savedDrafts : [];
      const questionKeys = savedDrafts.map((draft) => draft.questionKey).filter(Boolean);
      if (!questionKeys.length) return;
      el.clearDrafts.disabled = true;
      setStatus('Clearing drafts...');
      let response;
      let body;
      try {
        response = await fetch('/telegram/mini-app/api/clear-drafts', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ launch, questionKeys }),
        });
        body = await response.json().catch(() => ({}));
      } catch (error) {
        setStatus('Could not clear drafts.', 'error');
        el.clearDrafts.disabled = false;
        return;
      }
      if (!response.ok || !body.ok) {
        setStatus(userFacingErrorMessage(body, 'Could not clear drafts.'), 'error');
        el.clearDrafts.disabled = false;
        return;
      }
      (body.clearedQuestionKeys || questionKeys).forEach((questionKey) => {
        state.savedDraftKeys.delete(questionKey);
        delete state.drafts[questionKey];
      });
      state.submitDraftsMessage = '';
      if (Array.isArray(state.data?.savedDrafts)) {
        const cleared = new Set(body.clearedQuestionKeys || questionKeys);
        state.data.savedDrafts = state.data.savedDrafts.filter((draft) => !cleared.has(draft.questionKey));
      }
      if (state.data?.draftAnswersByQuestionKey) state.data.draftAnswersByQuestionKey = {};
      state.activeKey = firstPreferredQuestionKey();
      setStatus('Drafts cleared.', 'ok');
      render();
      if (tg?.HapticFeedback?.notificationOccurred) tg.HapticFeedback.notificationOccurred('success');
    }
    async function loadResults({ force = false } = {}) {
      if (!state.resultsSessionSlug || (state.resultsLoading && !force)) return;
      const requestId = state.resultsRequestId + 1;
      state.resultsRequestId = requestId;
      const cacheKey = currentResultsCacheKey();
      const cached = state.resultsCache.get(cacheKey);
      if (cached && state.resultsCacheKey !== cacheKey) {
        state.resultsData = cached;
        state.resultsCacheKey = cacheKey;
      }
      state.resultsLoadError = '';
      state.resultsLoading = true;
      renderResults();
      let response;
      let body;
      try {
        const resultsUrl = new URL('/telegram/mini-app/api/results', location.origin);
        resultsUrl.searchParams.set('launch', launch);
        resultsUrl.searchParams.set('sessionSlug', state.resultsSessionSlug);
        state.resultClusterCount = RESULT_GROUP_COUNT;
        resultsUrl.searchParams.set('clusters', String(RESULT_GROUP_COUNT));
        if (state.resultsDemoData) resultsUrl.searchParams.set('demo', '1');
        if (!state.resultsDemoData && activeResultFilterCount() > 0) {
          resultsUrl.searchParams.set('filters', JSON.stringify(resultFilterPayload()));
        }
        response = await fetch(resultsUrl.pathname + resultsUrl.search, { headers: headers() });
        body = await response.json().catch(() => ({}));
      } catch (error) {
        if (state.resultsRequestId !== requestId) return;
        const errorData = { ok: false, error: 'results_load_failed' };
        state.resultsLoadError = errorData.error;
        if (!state.resultsCache.has(cacheKey)) state.resultsData = errorData;
        state.resultsLoading = false;
        renderResults();
        return;
      }
      if (state.resultsRequestId !== requestId) return;
      const nextData = response.ok && body.ok !== false
        ? body
        : { ok: false, error: body.error || 'results_load_failed' };
      if (nextData.ok !== false) {
        state.resultsCache.set(cacheKey, nextData);
        state.resultsCacheKey = cacheKey;
        state.resultsData = nextData;
        state.resultsLoadError = '';
      } else {
        state.resultsLoadError = nextData.error || 'results_load_failed';
        if (!state.resultsCache.has(cacheKey)) state.resultsData = nextData;
      }
      state.resultsLoading = false;
      renderResults();
    }
    async function loadActivity({ force = false } = {}) {
      if (state.activityLoading && !force) return;
      state.activityLoading = true;
      state.activityMessage = '';
      renderActivity();
      let response;
      let body;
      try {
        const activityUrl = new URL('/telegram/mini-app/api/activity', location.origin);
        activityUrl.searchParams.set('launch', launch);
        const sessions = selectedSessionQuery();
        if (sessions) activityUrl.searchParams.set('sessions', sessions);
        response = await fetch(activityUrl.pathname + activityUrl.search, { headers: headers() });
        body = await response.json().catch(() => ({}));
      } catch {
        state.activityData = null;
        state.activityMessage = 'Could not load activity. Check connection and try again.';
        state.activityLoading = false;
        renderActivity();
        return;
      }
      state.activityData = response.ok && body.ok !== false
        ? body
        : null;
      state.activityMessage = response.ok && body.ok !== false
        ? ''
        : 'Could not load activity: ' + (body.error || 'activity_load_failed') + '.';
      state.activityLoading = false;
      renderActivity();
    }
    async function loadDocuments({ force = false } = {}) {
      if (!state.documentsSessionSlug || (state.documentsLoading && !force)) return;
      state.documentsLoading = true;
      if (force) state.documentsMessage = '';
      renderDocuments();
      let response;
      let body;
      try {
        const documentsUrl = new URL('/telegram/mini-app/api/documents', location.origin);
        documentsUrl.searchParams.set('launch', launch);
        documentsUrl.searchParams.set('sessionSlug', state.documentsSessionSlug);
        response = await fetch(documentsUrl.pathname + documentsUrl.search, { headers: headers() });
        body = await response.json().catch(() => ({}));
      } catch {
        state.documentsData = { ok: false, error: 'documents_load_failed' };
        state.documentsMessage = 'Could not load documents. Check connection and try again.';
        state.documentsLoading = false;
        renderDocuments();
        return;
      }
      state.documentsData = response.ok && body.ok !== false
        ? body
        : { ok: false, error: body.error || 'documents_load_failed' };
      state.documentsMessage = response.ok && body.ok !== false
        ? state.documentsMessage
        : 'Could not load documents: ' + (body.error || 'documents_load_failed') + '.';
      state.documentsLoading = false;
      renderDocuments();
    }
    async function uploadDocument() {
      if (!state.documentsSessionSlug || !el.documentFile.files?.length) return;
      const file = el.documentFile.files[0];
      const form = new FormData();
      form.append('launch', launch);
      form.append('sessionSlug', state.documentsSessionSlug);
      form.append('title', el.documentTitle.value || file.name || '');
      form.append('visibility', 'session');
      form.append('file', file, file.name || 'document.md');
      state.documentsUploading = true;
      state.documentsMessage = 'Uploading ' + (file.name || 'document') + '...';
      renderDocuments();
      let response;
      let body;
      try {
        const uploadUrl = new URL('/telegram/mini-app/api/documents', location.origin);
        uploadUrl.searchParams.set('launch', launch);
        uploadUrl.searchParams.set('sessionSlug', state.documentsSessionSlug);
        response = await fetch(uploadUrl.pathname + uploadUrl.search, {
          method: 'POST',
          headers: headers({ json: false }),
          body: form,
        });
        body = await response.json().catch(() => ({}));
      } catch {
        state.documentsMessage = 'Could not upload document. Check connection and try again.';
        state.documentsUploading = false;
        renderDocuments();
        return;
      }
      state.documentsUploading = false;
      if (!response.ok || !body.ok) {
        state.documentsMessage = documentUploadErrorMessage(body, response.status);
        renderDocuments();
        return;
      }
      state.documentsData = body;
      state.documentsMessage = 'Uploaded ' + (body.document?.title || file.name || 'document') + '.';
      el.documentFile.value = '';
      el.documentTitle.value = '';
      renderDocuments();
      if (tg?.HapticFeedback?.notificationOccurred) tg.HapticFeedback.notificationOccurred('success');
    }
    async function addDocumentUrl() {
      const urlValue = el.documentUrl.value.trim();
      if (!state.documentsSessionSlug || !urlValue) return;
      state.documentsUploading = true;
      state.documentsMessage = 'Adding URL...';
      renderDocuments();
      let response;
      let body;
      try {
        response = await fetch('/telegram/mini-app/api/documents', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            launch,
            sessionSlug: state.documentsSessionSlug,
            title: el.documentTitle.value || '',
            url: urlValue,
          }),
        });
        body = await response.json().catch(() => ({}));
      } catch {
        state.documentsMessage = 'Could not add URL. Check connection and try again.';
        state.documentsUploading = false;
        renderDocuments();
        return;
      }
      state.documentsUploading = false;
      if (!response.ok || !body.ok) {
        state.documentsMessage = documentUploadErrorMessage(body, response.status);
        renderDocuments();
        return;
      }
      state.documentsData = body;
      state.documentsMessage = 'Added ' + (body.document?.title || 'URL') + '.';
      el.documentUrl.value = '';
      el.documentTitle.value = '';
      renderDocuments();
      if (tg?.HapticFeedback?.notificationOccurred) tg.HapticFeedback.notificationOccurred('success');
    }
    async function loadGroups({ force = false } = {}) {
      if (!state.groupsSessionSlug || (state.groupsLoading && !force)) return;
      state.groupsLoading = true;
      renderGroups();
      let response;
      let body;
      try {
        const groupsUrl = new URL('/telegram/mini-app/api/groups', location.origin);
        groupsUrl.searchParams.set('launch', launch);
        groupsUrl.searchParams.set('sessionSlug', state.groupsSessionSlug);
        response = await fetch(groupsUrl.pathname + groupsUrl.search, { headers: headers() });
        body = await response.json().catch(() => ({}));
      } catch {
        state.groupsData = { ok: false, error: 'groups_load_failed' };
        state.groupsLoading = false;
        renderGroups();
        return;
      }
      state.groupsData = response.ok && body.ok !== false
        ? body
        : { ok: false, error: body.error || 'groups_load_failed' };
      state.groupSelections = { ...((state.groupsData.groups && state.groupsData.groups.selections) || {}) };
      state.groupDetails = { ...((state.groupsData.groups && state.groupsData.groups.details) || {}) };
      state.groupsLoading = false;
      renderGroups();
    }
    async function saveGroups() {
      if (!state.groupsSessionSlug) return;
      state.groupsSaving = true;
      renderGroups();
      let response;
      let body;
      try {
        response = await fetch('/telegram/mini-app/api/groups', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            launch,
            sessionSlug: state.groupsSessionSlug,
            selections: state.groupSelections || {},
            details: state.groupDetails || {},
          }),
        });
        body = await response.json().catch(() => ({}));
      } catch {
        setStatus('Could not save groups.', 'error');
        state.groupsSaving = false;
        renderGroups();
        return;
      }
      state.groupsSaving = false;
      if (!response.ok || !body.ok) {
        setStatus(body.error || 'Could not save groups.', 'error');
        renderGroups();
        return;
      }
      state.groupsData = body;
      state.groupSelections = { ...((body.groups && body.groups.selections) || {}) };
      state.groupDetails = { ...((body.groups && body.groups.details) || {}) };
      state.groupsSaveMessage = 'Groups saved';
      if (state.groupsSaveMessageTimer) window.clearTimeout(state.groupsSaveMessageTimer);
      state.groupsSaveMessageTimer = window.setTimeout(() => {
        state.groupsSaveMessage = '';
        state.groupsSaveMessageTimer = null;
        renderGroups();
      }, 2500);
      renderGroups();
      if (tg?.HapticFeedback?.notificationOccurred) tg.HapticFeedback.notificationOccurred('success');
    }
    async function submitAddQuestion() {
      if (!state.addQuestionSessionSlug || !state.addQuestionPrompt.trim()) return;
      state.addQuestionSaving = true;
      state.addQuestionMessage = '';
      renderAddQuestion();
      const options = state.addQuestionOptions
        .split(/[\\n,;|]+/)
        .map((value) => value.trim())
        .filter(Boolean);
      let response;
      let body;
      try {
        response = await fetch('/telegram/mini-app/api/questions/add', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            launch,
            sessionSlug: state.addQuestionSessionSlug,
            questionType: state.addQuestionType,
            prompt: state.addQuestionPrompt,
            options,
            sessionContext: state.addQuestionSessionContext,
            tags: normalizeQuestionTags(state.addQuestionTags),
          }),
        });
        body = await response.json().catch(() => ({}));
      } catch {
        state.addQuestionSaving = false;
        state.addQuestionMessage = 'Could not add question.';
        renderAddQuestion();
        return;
      }
      state.addQuestionSaving = false;
      if (!response.ok || !body.ok) {
        state.addQuestionMessage = 'Could not add question: ' + (body.error || 'question_save_failed');
        renderAddQuestion();
        return;
      }
      state.addQuestionPrompt = '';
      state.addQuestionOptions = '';
      state.addQuestionTags = '';
      state.addQuestionMessage = 'Question added.';
      state.loadedOnce = false;
      await load();
      if (tg?.HapticFeedback?.notificationOccurred) tg.HapticFeedback.notificationOccurred('success');
    }
    async function generateQuestionsFromUrl() {
      const url = String(state.addQuestionUrl || '').trim();
      if (!state.addQuestionSessionSlug || !url) return;
      state.addQuestionUrlGenerating = true;
      state.addQuestionMessage = '';
      renderAddQuestion();
      let response;
      let body;
      try {
        response = await fetch('/telegram/mini-app/api/questions/generate-from-url', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            launch,
            sessionSlug: state.addQuestionSessionSlug,
            url,
            count: URL_GENERATED_QUESTION_COUNT,
            questionType: state.addQuestionType,
          }),
        });
        body = await response.json().catch(() => ({}));
      } catch {
        state.addQuestionUrlGenerating = false;
        state.addQuestionMessage = 'Could not generate questions from URL.';
        renderAddQuestion();
        return;
      }
      state.addQuestionUrlGenerating = false;
      if (!response.ok || !body.ok) {
        state.addQuestionMessage = 'Could not generate questions from URL: ' + (body.error || 'question_generation_failed');
        renderAddQuestion();
        return;
      }
      state.addQuestionUrlCandidates = Array.isArray(body.candidates) ? body.candidates.slice(0, URL_GENERATED_QUESTION_COUNT) : [];
      state.addQuestionMessage = state.addQuestionUrlCandidates.length
        ? state.addQuestionUrlCandidates.length + ' generated questions ready.'
        : 'No question candidates were generated.';
      if (body.source === 'local_fallback' && state.addQuestionUrlCandidates.length) {
        state.addQuestionMessage = state.addQuestionUrlCandidates.length + ' generated questions ready.';
      }
      renderAddQuestion();
      if (tg?.HapticFeedback?.notificationOccurred && state.addQuestionUrlCandidates.length) {
        tg.HapticFeedback.notificationOccurred('success');
      }
    }
    async function submitGeneratedUrlQuestions() {
      const candidates = (Array.isArray(state.addQuestionUrlCandidates) ? state.addQuestionUrlCandidates : [])
        .filter((candidate) => String(candidate?.prompt || '').trim());
      if (!state.addQuestionSessionSlug || !candidates.length) return;
      state.addQuestionUrlSubmitting = true;
      state.addQuestionMessage = '';
      renderAddQuestion();
      let added = 0;
      let firstError = '';
      for (const candidate of candidates) {
        const candidateType = candidate.questionType || state.addQuestionType;
        const candidateOptions = Array.isArray(candidate.options) ? candidate.options : [];
        let response;
        let body;
        try {
          response = await fetch('/telegram/mini-app/api/questions/add', {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({
              launch,
              sessionSlug: state.addQuestionSessionSlug,
              questionType: candidateType,
              prompt: candidate.prompt,
              options: candidateOptions,
              sessionContext: state.addQuestionSessionContext,
              tags: normalizeQuestionTags(candidate.tags || state.addQuestionTags),
            }),
          });
          body = await response.json().catch(() => ({}));
        } catch {
          firstError = firstError || 'question_save_failed';
          continue;
        }
        if (!response.ok || !body.ok) {
          firstError = firstError || body.error || 'question_save_failed';
          continue;
        }
        added += 1;
      }
      state.addQuestionUrlSubmitting = false;
      if (!added) {
        state.addQuestionMessage = 'Could not add generated questions: ' + (firstError || 'question_save_failed');
        renderAddQuestion();
        return;
      }
      state.addQuestionUrlCandidates = [];
      state.addQuestionUrl = '';
      state.addQuestionMessage = firstError
        ? 'Added ' + added + ' questions. Some could not be added.'
        : 'Added ' + added + ' questions.';
      state.loadedOnce = false;
      await load();
      if (tg?.HapticFeedback?.notificationOccurred) tg.HapticFeedback.notificationOccurred('success');
    }
    async function analyzeResultGroup(groupId) {
      if (!state.resultsSessionSlug || !groupId) return;
      state.groupAnalysisById[groupId] = { loading: true, startedAt: Date.now() };
      state.resultSectionsOpen.groups = true;
      state.resultSectionsOpen.groupAnalysis = true;
      startGroupAnalysisProgressTimer();
      renderResults();
      let response;
      let body;
      try {
        response = await fetch('/telegram/mini-app/api/results', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            launch,
            action: 'analyze_group',
            sessionSlug: state.resultsSessionSlug,
            groupId,
            demo: state.resultsDemoData,
            clusterCount: RESULT_GROUP_COUNT,
            filters: state.resultsDemoData ? {} : resultFilterPayload(),
          }),
        });
        body = await response.json().catch(() => ({}));
      } catch (error) {
        state.groupAnalysisById[groupId] = { loading: false, error: 'Could not analyze group.' };
        if (!hasActiveGroupAnalysis()) stopGroupAnalysisProgressTimer();
        state.resultSectionsOpen.groups = true;
        state.resultSectionsOpen.groupAnalysis = true;
        renderResults();
        scrollPanelIntoView(el.groupAnalysisSection);
        return;
      }
      if (!response.ok || !body.ok) {
        state.groupAnalysisById[groupId] = { loading: false, error: body.error || 'Could not analyze group.' };
      } else {
        state.groupAnalysisById[groupId] = {
          loading: false,
          analysis: body.analysis,
          aiOk: body.aiOk === true,
          reason: body.reason || '',
        };
        if (body.summary) state.resultsData = body.summary;
      }
      if (!hasActiveGroupAnalysis()) stopGroupAnalysisProgressTimer();
      state.resultSectionsOpen.groups = true;
      state.resultSectionsOpen.groupAnalysis = true;
      renderResults();
      scrollPanelIntoView(el.groupAnalysisSection);
    }
    async function load({ retry = false, backgroundAuto = false } = {}) {
      let response;
      let body;
      const backgroundLoad = state.loadedOnce && state.data?.hasMoreQuestions === true;
      if (!state.loadedOnce) {
        state.questionsLoading = true;
        state.loadingMoreQuestions = false;
        state.backgroundQuestionLoadPending = false;
        startLoadingProgress({
          message: 'Loading questions and agent predictions',
          initialPercent: retry ? 34 : 22,
          maxPercent: retry ? 74 : 72,
        });
      } else if (backgroundLoad) {
        state.questionsLoading = true;
        state.loadingMoreQuestions = !backgroundAuto;
        state.backgroundQuestionLoadPending = backgroundAuto;
        renderQuestionStack();
      }
      try {
        const stateUrl = new URL('/telegram/mini-app/api/state', location.origin);
        stateUrl.searchParams.set('launch', launch);
        const sessions = selectedSessionQuery();
        if (sessions) stateUrl.searchParams.set('sessions', sessions);
        if (state.questionLimit > 0) stateUrl.searchParams.set('questionLimit', String(state.questionLimit));
        response = await fetch(stateUrl.pathname + stateUrl.search, {
          headers: headers(),
        });
        body = await response.json().catch(() => ({}));
      } catch (error) {
        state.questionsLoading = false;
        state.loadingMoreQuestions = false;
        state.backgroundQuestionLoadPending = false;
        clearAutoQuestionLoadTimer();
        if (state.loadedOnce) renderQuestionStack();
        setStatus('Could not load Mini App. Retrying...', 'error');
        scheduleQuestionRetry();
        return;
      }
      if (!response.ok || !body.ok) {
        state.questionsLoading = false;
        state.loadingMoreQuestions = false;
        state.backgroundQuestionLoadPending = false;
        clearAutoQuestionLoadTimer();
        if (state.loadedOnce) renderQuestionStack();
        setStatus(userFacingErrorMessage(body, 'Could not load Mini App.'), 'error');
        clearQuestionRetry();
        return;
      }
      if (!state.loadedOnce) {
        stopLoadingProgressTimer();
        setLoadingProgress('Loading questions and agent predictions', 86);
      }
      state.data = body;
      const loadedLimit = Number(body.loadedQuestionLimit || body.loadedQuestionCount || body.pageSize || 0);
      if (loadedLimit > 0) state.questionLimit = loadedLimit;
      if (body.sessionPicker?.enabled === true && !state.selectedSessionSlugs.size) {
        (body.sessionPicker.selectedSessionSlugs || []).forEach((slug) => state.selectedSessionSlugs.add(slug));
      }
      state.submittedAnswerKeys = new Set((body.submittedAnswerKeys || []).filter(Boolean));
      state.submittedAnswersByQuestionKey = new Map();
      const serverSubmittedAnswers = Array.isArray(body.submittedAnswers) ? body.submittedAnswers : [];
      serverSubmittedAnswers.forEach((entry) => {
        const questionKey = String(entry?.questionKey || '').trim();
        if (!questionKey) return;
        state.submittedAnswersByQuestionKey.set(questionKey, entry);
        if (entry.answer && !answerHasContent(state.drafts[questionKey])) {
          state.drafts[questionKey] = { ...entry.answer };
        }
      });
      state.savedDraftKeys = new Set();
      const serverDrafts = body.draftAnswersByQuestionKey || {};
      Object.entries(serverDrafts).forEach(([questionKey, draft]) => {
        state.savedDraftKeys.add(questionKey);
        if (!state.drafts[questionKey] || Object.keys(state.drafts[questionKey]).length === 0) {
          state.drafts[questionKey] = { ...(draft || {}) };
        }
      });
      const prefilledDrafts = body.prefilledDraftAnswersByQuestionKey || {};
      Object.entries(prefilledDrafts).forEach(([questionKey, draft]) => {
        if (!answerHasContent(state.drafts[questionKey])) {
          state.drafts[questionKey] = { ...(draft || {}) };
        }
      });
      const questions = Array.isArray(body.questions) ? body.questions : [];
      if (body.questionSeries?.enabled === true && !state.loadedOnce) {
        state.seriesActiveIndex = Number(body.questionSeries.activeIndex || 0) || 0;
        state.seriesSkippedKeys = new Set((body.questionSeries.skippedQuestionKeys || []).filter(Boolean));
      }
      const launchQuestion = questions.find((question) => question.activeFromLaunch === true && question.questionKey);
      if (launchQuestion && !state.loadedOnce) {
        state.highlightedQuestionKey = launchQuestion.questionKey;
        state.highlightScrollDone = false;
        expandQuestion(launchQuestion);
        state.activeKey = launchQuestion.questionKey;
      }
      if (!questions.some((question) => question.questionKey === state.activeKey)) {
        state.activeKey = firstPreferredQuestionKey() || body.activeQuestionKey || '';
      } else if (!state.loadedOnce && state.showUnansweredFirst) {
        state.activeKey = state.highlightedQuestionKey || firstPreferredQuestionKey() || body.activeQuestionKey || state.activeKey;
      }
      if (shouldRetryQuestions(body)) {
        setStatus(body.sourceError || (retry ? 'Questions are still loading. Retrying...' : 'Questions are loading. Retrying...'), body.sourceOk ? '' : 'error');
        scheduleQuestionRetry();
      } else {
        clearQuestionRetry();
        setStatus('');
      }
      const willAutoExpand = shouldAutoExpandQuestions(body);
      state.questionsLoading = false;
      state.loadingMoreQuestions = false;
      state.backgroundQuestionLoadPending = willAutoExpand;
      render();
      state.loadedOnce = true;
      if (willAutoExpand) scheduleAutoQuestionLoad(body);
      if (state.aiSearchQuery) scheduleAiSearch(0);
    }
    function loadMoreQuestions() {
      if (state.loadingMoreQuestions === true) return;
      clearAutoQuestionLoadTimer();
      const current = Number(state.data?.loadedQuestionLimit || state.questionLimit || state.data?.loadedQuestionCount || state.data?.pageSize || 0);
      const increment = Number(state.data?.pageSize || 50) || 50;
      state.questionLimit = current < increment ? increment : current + increment;
      state.loadingMoreQuestions = true;
      state.backgroundQuestionLoadPending = false;
      renderQuestionStack();
      load();
    }
    function shouldAutoExpandQuestions(data) {
      const loaded = Number(data?.loadedQuestionLimit || data?.loadedQuestionCount || 0) || 0;
      return data?.hasMoreQuestions === true && loaded > 0 && loaded < MAX_QUESTION_LIMIT;
    }
    function nextQuestionLimit(data) {
      const loadedLimit = Number(data?.loadedQuestionLimit || 0) || 0;
      const loadedCount = Number(data?.loadedQuestionCount || 0) || 0;
      const pageSize = Number(data?.pageSize || 50) || 50;
      const current = Math.max(loadedLimit, loadedCount, Number(state.questionLimit || 0) || 0);
      const fastFollowupLimit = FAST_INITIAL_QUESTION_LIMIT + FAST_FOLLOWUP_QUESTION_COUNT;
      if (current <= FAST_INITIAL_QUESTION_LIMIT && fastFollowupLimit > current) return Math.min(MAX_QUESTION_LIMIT, fastFollowupLimit);
      if (current < pageSize) return Math.min(MAX_QUESTION_LIMIT, pageSize);
      return Math.min(MAX_QUESTION_LIMIT, Math.max(current + 1, current + pageSize));
    }
    function autoQuestionLoadDelay(data) {
      const loaded = Number(data?.loadedQuestionLimit || data?.loadedQuestionCount || 0) || 0;
      return loaded <= FAST_INITIAL_QUESTION_LIMIT ? FAST_FOLLOWUP_DELAY_MS : BACKGROUND_PAGE_DELAY_MS;
    }
    function scheduleAutoQuestionLoad(data) {
      clearAutoQuestionLoadTimer();
      state.questionLimit = nextQuestionLimit(data);
      state.autoQuestionLoadTimer = window.setTimeout(() => {
        state.autoQuestionLoadTimer = null;
        load({ backgroundAuto: true });
      }, autoQuestionLoadDelay(data));
    }
    el.continueSessions.onclick = () => {
      if (!state.selectedSessionSlugs.size) return;
      clearAutoQuestionLoadTimer();
      state.activeKey = '';
      state.loadedOnce = false;
      resetResultsForSelection();
      resetGroupsForSelection();
      resetDocumentsForSelection();
      resetActivityForSelection();
      resetAddQuestionForSelection();
      state.expandedQuestionKeys = new Set();
      state.highlightedQuestionKey = '';
      state.highlightScrollDone = false;
      state.questionLimit = FAST_INITIAL_QUESTION_LIMIT;
      state.sessionsPanelOpen = false;
      load();
    };
    function setPanelOpen(panel, button, open) {
      if (!panel) return;
      panel.classList.toggle('open', open);
      if (!button) return;
      button.classList.toggle('active', open);
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    function bindPanelClose(closeButton, panel, button) {
      if (!closeButton || !panel) return;
      closeButton.onclick = () => setPanelOpen(panel, button, false);
    }
    function scrollPanelIntoView(panel) {
      if (!panel || typeof panel.scrollIntoView !== 'function') return;
      setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    }
    function hasActiveGroupAnalysis() {
      return Object.values(state.groupAnalysisById || {}).some((entry) => entry?.loading === true);
    }
    function stopGroupAnalysisProgressTimer() {
      if (state.groupAnalysisProgressTimer) window.clearInterval(state.groupAnalysisProgressTimer);
      state.groupAnalysisProgressTimer = null;
    }
    function startGroupAnalysisProgressTimer() {
      if (state.groupAnalysisProgressTimer) return;
      state.groupAnalysisProgressTimer = window.setInterval(() => {
        if (!hasActiveGroupAnalysis()) {
          stopGroupAnalysisProgressTimer();
          return;
        }
        renderResults();
      }, 1000);
    }
    function setToolMenuOpen(open) {
      el.toolMenu.classList.toggle('open', open);
      el.showToolMenu.classList.toggle('active', open);
      el.showToolMenu.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    el.showToolMenu.onclick = () => setToolMenuOpen(!el.toolMenu.classList.contains('open'));
    el.showSessions.onclick = () => {
      state.sessionsPanelOpen = true;
      renderSessionPicker();
      setToolMenuOpen(false);
      scrollPanelIntoView(el.sessionPicker);
    };
    if (el.showDocuments) {
      el.showDocuments.onclick = () => {
        setPanelOpen(el.documentsPanel, el.showDocuments, true);
        state.documentsSectionOpen = true;
        renderDocuments();
        setToolMenuOpen(false);
        scrollPanelIntoView(el.documentsPanel);
        if (!state.documentsData && state.documentsSessionSlug) loadDocuments();
      };
    }
    el.showAdmin.onclick = () => {
      state.sessionsPanelOpen = false;
      renderSessionPicker();
      renderAdmin();
      setPanelOpen(el.adminPanel, el.showAdmin, true);
      setToolMenuOpen(false);
      scrollPanelIntoView(el.adminPanel);
    };
    el.showActivity.onclick = () => {
      setPanelOpen(el.activityPanel, el.showActivity, true);
      setToolMenuOpen(false);
      scrollPanelIntoView(el.activityPanel);
      loadActivity({ force: true });
    };
    el.showDrafts.onclick = () => {
      setPanelOpen(el.draftsPanel, el.showDrafts, true);
      setToolMenuOpen(false);
      scrollPanelIntoView(el.draftsPanel);
    };
    el.showFilter.onclick = () => {
      setPanelOpen(el.filterPanel, el.showFilter, true);
      setToolMenuOpen(false);
      scrollPanelIntoView(el.filterPanel);
    };
    el.showSettings.onclick = () => {
      setPanelOpen(el.settingsPanel, el.showSettings, true);
      setToolMenuOpen(false);
      scrollPanelIntoView(el.settingsPanel);
    };
    el.showGroups.onclick = () => {
      setPanelOpen(el.groupsPanel, el.showGroups, true);
      setToolMenuOpen(false);
      scrollPanelIntoView(el.groupsPanel);
      if (!state.groupsData && state.groupsSessionSlug) loadGroups();
    };
    el.showAddQuestion.onclick = () => {
      setPanelOpen(el.addQuestionPanel, el.showAddQuestion, true);
      setToolMenuOpen(false);
      scrollPanelIntoView(el.addQuestionPanel);
      renderAddQuestion();
    };
    el.showResults.onclick = () => {
      setPanelOpen(el.resultsPanel, el.showResults, true);
      renderResults();
      setToolMenuOpen(false);
      scrollPanelIntoView(el.resultsPanel);
      if (!state.resultsData && state.resultsSessionSlug) loadResults();
    };
    el.closeSessions.onclick = () => {
      state.sessionsPanelOpen = false;
      renderSessionPicker();
    };
    bindPanelClose(el.closeDocuments, el.documentsPanel, el.showDocuments);
    bindPanelClose(el.closeAdmin, el.adminPanel, el.showAdmin);
    bindPanelClose(el.closeActivity, el.activityPanel, el.showActivity);
    bindPanelClose(el.closeDrafts, el.draftsPanel, el.showDrafts);
    bindPanelClose(el.closeFilter, el.filterPanel, el.showFilter);
    bindPanelClose(el.closeSettings, el.settingsPanel, el.showSettings);
    bindPanelClose(el.closeGroups, el.groupsPanel, el.showGroups);
    bindPanelClose(el.closeAddQuestion, el.addQuestionPanel, el.showAddQuestion);
    bindPanelClose(el.closeResults, el.resultsPanel, el.showResults);
    el.clearResultFilters.onclick = () => {
      state.resultFilters = { selections: {}, details: {} };
      state.groupAnalysisById = {};
      stopGroupAnalysisProgressTimer();
      state.resultVisibleCounts = { consensus: 5, divisive: 5 };
      state.resultFilterCategoryOpen = {};
      restoreCachedResults();
      loadResults({ force: true });
    };
    el.toggleResultFilters.onclick = () => {
      state.resultSectionsOpen.filters = !state.resultSectionsOpen.filters;
      renderResults();
    };
    el.showResultFilters.onclick = () => {
      const open = state.resultSectionsOpen.filters !== true;
      state.resultSectionsOpen.filters = open;
      renderResults();
      if (open) scrollPanelIntoView(el.resultFilters);
    };
    el.toggleConsensusSection.onclick = () => {
      state.resultSectionsOpen.consensus = !state.resultSectionsOpen.consensus;
      renderResults();
    };
    el.toggleDivisiveSection.onclick = () => {
      state.resultSectionsOpen.divisive = !state.resultSectionsOpen.divisive;
      renderResults();
    };
    el.toggleResultGroupsSection.onclick = () => {
      state.resultSectionsOpen.groups = !state.resultSectionsOpen.groups;
      renderResults();
    };
    el.toggleTopicMapSection.onclick = () => {
      state.resultSectionsOpen.topicMap = !state.resultSectionsOpen.topicMap;
      renderResults();
    };
    el.toggleGroupAnalysisSection.onclick = () => {
      state.resultSectionsOpen.groupAnalysis = !state.resultSectionsOpen.groupAnalysis;
      renderResults();
    };
    el.moreConsensusResults.onclick = () => {
      state.resultVisibleCounts.consensus += 5;
      renderResults();
    };
    el.moreDivisiveResults.onclick = () => {
      state.resultVisibleCounts.divisive += 5;
      renderResults();
    };
    el.toggleDocumentsPanelBody.onclick = () => {
      state.documentsSectionOpen = !state.documentsSectionOpen;
      renderDocuments();
    };
    el.refreshDocuments.onclick = () => loadDocuments({ force: true });
    el.documentFile.onchange = () => {
      state.documentsMessage = '';
      renderDocuments();
    };
    el.documentTitle.oninput = () => {
      state.documentsMessage = '';
      renderDocuments();
    };
    el.documentUrl.oninput = () => {
      state.documentsMessage = '';
      renderDocuments();
    };
    el.uploadDocument.onclick = () => uploadDocument();
    el.addDocumentUrl.onclick = () => addDocumentUrl();
    el.saveGroups.onclick = () => saveGroups();
    el.addQuestionPrompt.oninput = () => {
      if (el.addQuestionPrompt.dataset.micFeedbackActive === 'true') {
        el.addQuestionPrompt.classList.remove('micFeedback');
        delete el.addQuestionPrompt.dataset.micFeedbackActive;
        el.addQuestionPrompt.placeholder = el.addQuestionPrompt.dataset.originalPlaceholder || 'Question prompt';
      }
      state.addQuestionPrompt = el.addQuestionPrompt.value;
      state.addQuestionMessage = '';
      renderAddQuestion();
    };
    el.addQuestionMic.onclick = () => startAddQuestionDictation(el.addQuestionMic);
    el.toggleAddQuestionUrl.onclick = () => {
      state.addQuestionUrlOpen = !state.addQuestionUrlOpen;
      state.addQuestionMessage = '';
      renderAddQuestion();
    };
    el.addQuestionUrl.oninput = () => {
      state.addQuestionUrl = el.addQuestionUrl.value;
      state.addQuestionMessage = '';
      renderAddQuestion();
    };
    el.generateUrlQuestions.onclick = () => generateQuestionsFromUrl();
    el.submitUrlQuestions.onclick = () => submitGeneratedUrlQuestions();
    el.addQuestionOptions.oninput = () => {
      state.addQuestionOptions = el.addQuestionOptions.value;
      state.addQuestionMessage = '';
      renderAddQuestion();
    };
    el.submitAddQuestion.onclick = () => submitAddQuestion();
    el.filterUnansweredFirst.onchange = () => {
      state.showUnansweredFirst = el.filterUnansweredFirst.checked;
      writeShowUnansweredFirst(state.showUnansweredFirst);
      render();
    };
    el.filterAnsweredOnly.onchange = () => {
      state.answeredQuestionsOnly = el.filterAnsweredOnly.checked;
      render();
    };
    el.filterTopPopular.onchange = () => {
      state.popularQuestionsOnly = el.filterTopPopular.checked;
      render();
    };
    el.filterTopPopularLimit.onchange = () => setPopularQuestionLimit(el.filterTopPopularLimit.value, { enable: true });
    el.decrementTopPopular.onclick = () => setPopularQuestionLimit(state.popularQuestionLimit - POPULAR_QUESTION_LIMIT_STEP, { enable: true });
    el.incrementTopPopular.onclick = () => setPopularQuestionLimit(state.popularQuestionLimit + POPULAR_QUESTION_LIMIT_STEP, { enable: true });
    el.toggleQuestionTypeFilters.onclick = () => {
      state.questionTypeFiltersExpanded = !state.questionTypeFiltersExpanded;
      renderFilters();
    };
    el.toggleQuestionTagFilters.onclick = () => {
      state.questionTagFiltersExpanded = !state.questionTagFiltersExpanded;
      renderFilters();
    };
    el.toggleAiSearchFilter.onclick = () => {
      state.aiSearchFilterExpanded = !state.aiSearchFilterExpanded;
      renderFilters();
    };
    el.filterAiSearch.oninput = () => {
      if (el.filterAiSearch.dataset.micFeedbackActive === 'true') {
        el.filterAiSearch.classList.remove('micFeedback');
        delete el.filterAiSearch.dataset.micFeedbackActive;
        el.filterAiSearch.placeholder = el.filterAiSearch.dataset.originalPlaceholder || 'Describe questions to find';
      }
      state.aiDraftQuery = el.filterAiSearch.value;
      state.aiSearchQuery = state.aiDraftQuery.trim();
      clearAiSearchResults();
      scheduleAiSearch();
      render();
    };
    el.filterAiSearch.onkeydown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
      }
    };
    el.clearAiSearch.onclick = () => {
      state.aiDraftQuery = '';
      state.aiSearchQuery = '';
      clearSearchMicFeedback();
      clearAiSearchResults();
      render();
    };
    el.filterAiSearchMic.onclick = () => startSearchDictation(el.filterAiSearchMic);
    function setResultsDemoData(value) {
      state.resultsDemoData = value === true;
      writeDemoResults(state.resultsDemoData);
      state.groupAnalysisById = {};
      stopGroupAnalysisProgressTimer();
      state.resultVisibleCounts = { consensus: 5, divisive: 5 };
      restoreCachedResults();
      if (el.resultsPanel.classList.contains('open')) loadResults({ force: true });
      render();
    }
    el.demoDataResults.onchange = () => setResultsDemoData(el.demoDataResults.checked);
    if (el.showAgentResponses) {
      el.showAgentResponses.onchange = () => {
        if (state.data?.agent?.settings?.values) {
          state.data.agent.settings.values.showAgentResponses = el.showAgentResponses.checked;
        }
        render();
        sendSettings();
      };
    }
    el.saveSettings.onclick = () => sendSettings();
    el.submitDrafts.onclick = () => submitSavedDrafts();
    el.clearDrafts.onclick = () => clearSavedDrafts();
    load();
  </script>
</body>
</html>`;
}
