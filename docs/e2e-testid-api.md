# E2E TestID API

This repo treats a subset of UI `data-testid` hooks as a stable **TestID API** for Playwright E2E runners.

Guidelines:
- Do not rename/remove TestID API hooks without updating `scripts/lib/e2e/locators.js` and this doc.
- Prefer adding optional disambiguators as `data-ce-*` attributes instead of encoding runtime IDs into the `data-testid` string.

## Navigation (Dev/E2E Overlay)

The Dev/E2E nav overlay is a dev-only UI (`process.env.NODE_ENV !== 'production'`) that provides deterministic route navigation for Playwright via the TestID API.

Component: `client/src/components/E2E/DevE2eNav.tsx`

| `data-testid` | Meaning / When Present | TestID API |
| --- | --- | --- |
| `ce-nav-home` | Navigate to `/` | yes |
| `ce-nav-surveys` | Navigate to `/surveys` | yes |
| `ce-nav-questions` | Navigate to `/questions` | yes |
| `ce-nav-sbts` | Navigate to `/sbts` | yes |
| `ce-nav-compare` | Navigate to `/compare/` | yes |
| `ce-nav-bookmarks` | Navigate to `/bookmarks` | yes |
| `ce-nav-contracts` | Navigate to `/contracts` | yes |
| `ce-nav-about` | Navigate to `/about` | yes |
| `ce-nav-admin` | Navigate to `/admin` | yes |
| `ce-nav-session` | Navigate to `/session/:slug` (slug resolved from query/localStorage) | yes |
| `ce-nav-session-docs` | Navigate to `/session/:slug/docs` | yes |
| `ce-nav-session-wizard` | Navigate to `/session/new` | yes |
| `ce-nav-atlas` | Navigate to `/atlas` | yes |
| `ce-nav-matrix` | Navigate to `/matrix` | yes |
| `ce-nav-agent` | Navigate to `/agent` (only shown when Agent Mode is enabled) | yes |

## Page Roots (Route Readiness)

Route branches in `client/src/components/MainSite/AppShell.tsx` wrap their rendered output with a stable page-root TestID. E2E should prefer waiting on these roots instead of `networkidle`.
The `/about` route renders `client/src/components/About/AboutPage.tsx`.
The `/` home route renders `client/src/components/MainContent/MainAreaTabs.tsx`, which now mounts `ToolExplorer.tsx` as the tool-launcher tab and `OnboardingWalkthrough.tsx` as the welcome tab.

| `data-testid` | Route(s) | Meaning / When Present | TestID API |
| --- | --- | --- | --- |
| `ce-page-home-root` | `/` | Home page root | yes |
| `ce-page-surveys-root` | `/surveys`, `/survey/:id`, `/survey/:id/results` | Surveys page root | yes |
| `ce-page-questions-root` | `/questions`, `/question/:id` | Questions page root | yes |
| `ce-page-sbts-root` | `/sbts` | SBT groups listing root | yes |
| `ce-page-sbt-root` | `/sbt/:address` | Single SBT group page root | yes |
| `ce-page-compare-root` | `/compare/*` | CompareAddresses page root | yes |
| `ce-page-bookmarks-root` | `/bookmarks` | Bookmarks page root | yes |
| `ce-page-contracts-root` | `/contracts` | Contracts page root | yes |
| `ce-page-about-root` | `/about` | About page root | yes |
| `ce-page-admin-root` | `/admin` | Admin page root | yes |
| `ce-page-sponsor-root` | `/sponsor` | Sponsored session URL page root | yes |
| `ce-page-session-wizard-root` | `/session/new` | Session Wizard page root | yes |
| `ce-page-session-root` | `/session/:slug` | Session page root | yes |
| `ce-page-session-docs-root` | `/session/:slug/docs` | Session docs page root | yes |
| `ce-page-atlas-root` | `/atlas`, `/tag/*` | Atlas page root | yes |
| `ce-page-matrix-root` | `/matrix` | Matrix demo page root | yes |
| `ce-page-agent-root` | `/agent` (dev-only) | Agent page root | yes |

## DebateMap / Atlas

Component: `client/src/components/DebateMap/DebateMap.tsx`

| `data-testid` | Meaning / When Present | TestID API | Disambiguators |
| --- | --- | --- | --- |
| `ce-debate-view-mode` | Primary DebateMap mode button for `Circles`, `Atlas`, `Tree`, or `List`. | yes | `data-ce-view-mode` (`circles`, `atlas`, `tree`, `list`) |
| `ce-atlas-node` | Clickable atlas node in either orbital or packed layout. | yes | `data-ce-node-id`, `data-ce-node-layout` (`orbital` or `packed`) |
| `ce-atlas-title-action` | Clickable packed-view root title that opens the current drilled node. | yes | `data-ce-node-id` |
| `ce-atlas-historical-case-card` | Historical-case card shown in the atlas modal when demo mode attaches Loophole case data to a leaf node. | yes | `data-ce-case-id` |
| `ce-atlas-historical-case-expand` | Expand/collapse button for a historical-case brief. | yes | `data-ce-case-id` |
| `ce-atlas-historical-case-detail` | Expanded brief container with the enriched case sections. | yes | `data-ce-case-id` |
| `ce-atlas-historical-case-patch-card` | Patch-option card inside the expanded brief. | yes | `data-ce-case-id`, `data-ce-patch-kind` (`best` or `option`) |

## Wallet Display

| `data-testid` | Component path(s) | Meaning / When Present | TestID API | Disambiguators |
| --- | --- | --- | --- | --- |
| `ce-wallet-display` | `client/src/components/Navbar/AccountDisplay.tsx` | Logged-in account display button. | yes | `data-ce-wallet-address` |

The navbar-mounted account/login/settings surface that owns the shared modal lives in `client/src/components/Account/LoginAndSettingsModal.tsx`; `client/src/components/Navbar/AccountSection.tsx` mounts it.

## AdminPage (`/admin`)

| `data-testid` | Component path(s) | Meaning / When Present | TestID API |
| --- | --- | --- | --- |
| `ce-admin-session-select` | `client/src/components/Admin/AdminPage.tsx` | Session dropdown selector. | yes |
| `ce-admin-gate-mode-select` | `client/src/components/Admin/AdminPage.tsx` | Default gate mode selector (ANY/ALL). | yes |
| `ce-admin-gate-update-button` | `client/src/components/Admin/AdminPage.tsx` | "Update default gate on-chain" button. | yes |
| `ce-admin-gate-status` | `client/src/components/Admin/AdminPage.tsx` | Status note for default-gate sync (contains success/error text). | yes |
| `ce-admin-not-admin-warning` | `client/src/components/Admin/AdminPage.tsx` | Warning note shown when the connected wallet is not the session admin. | yes |

## SessionWizard (`/session/new`)

| `data-testid` | Component path(s) | Meaning / When Present | TestID API | Disambiguators |
| --- | --- | --- | --- | --- |
| `ce-wizard-mode-normal` | `client/src/components/Sessions/SessionWizardHeader.tsx` | Wizard mode toggle button for Normal mode. | yes |  |
| `ce-wizard-mode-advanced` | `client/src/components/Sessions/SessionWizardHeader.tsx` | Wizard mode toggle button for Advanced mode. | yes |  |
| `ce-wizard-metadata-panel-toggle` | `client/src/components/Sessions/SessionWizard.tsx` | Collapsible panel toggle for the advanced-mode "Session Information" section. | yes |  |
| `ce-wizard-session-header-url-toggle` | `client/src/components/Sessions/SessionWizard.tsx` | Compact Image field `URL` toggle used in Normal mode to reveal the header URL input. | yes |  |
| `ce-wizard-session-header-paste` | `client/src/components/Sessions/SessionWizard.tsx` | Compact Image field `Paste` button used in Normal mode to pull an image blob or URL from the clipboard. | yes |  |
| `ce-wizard-worker-mode-toggle` | `client/src/components/Sessions/SessionWizard.tsx` | Wrapper around the default/custom worker mode pills in the worker panel. | yes |  |
| `ce-wizard-worker-mode-button` | `client/src/components/Sessions/SessionWizard.tsx` | Individual worker mode pill button. | yes | `data-ce-worker-mode` (`default` or `custom`) |
| `ce-wizard-worker-panel-toggle` | `client/src/components/Sessions/SessionWizard.tsx` | Collapsible panel toggle for "Worker deployment & secrets". | yes |  |
| `ce-wizard-bundle-mode-upload` | `client/src/components/Sessions/SessionWizard.tsx` | Advanced-mode radio that switches worker deployment to local file upload. | yes |  |
| `ce-wizard-bundle-mode-url` | `client/src/components/Sessions/SessionWizard.tsx` | Advanced-mode radio that switches worker deployment to remote bundle URL mode. | yes |  |
| `ce-wizard-bundle-file-input` | `client/src/components/Sessions/SessionWizard.tsx` | Worker bundle file input used in both normal-mode upload and advanced upload-mode deploys. | yes |  |
| `ce-wizard-add-gate` | `client/src/components/Sessions/SessionWizard.tsx` | Add-encryption-gate button in the Encryption panel (main button and ghost card variant). | yes | `data-ce-gate-add-kind` (`panel` or `ghost`) |
| `ce-wizard-create-sbt` | `client/src/components/Sessions/SessionWizard.tsx` | Opens the inline CreateSBTGroup modal from `/session/new`. | yes | `data-ce-sbt-target` (`defaultFeaturedSBTs` or gate id) |
| `ce-wizard-pending-sbt` | `client/src/components/Sessions/SessionWizard.tsx` | Pending SBT draft card shown in the Privacy panel before Publish. | yes | `data-ce-sbt-address` |
| `ce-wizard-resource-card` | `client/src/components/Sessions/SessionWizard.tsx` | Resource-gate card container used for per-resource lock selection. | yes | `data-ce-resource-key` (for example `ai`, `docUploads`) |
| `ce-wizard-sponsored-status` | `client/src/components/Sessions/SessionWizardSponsoredStatus.tsx` | Sponsored-bundle status note shown while `/new?sponsored=...#k=...` loads, applies, or fails. | yes |  |

## SponsorPage (`/sponsor`)

| `data-testid` | Component path(s) | Meaning / When Present | TestID API |
| --- | --- | --- | --- |
| `ce-sponsor-worker-url-toggle` | `client/src/components/Sponsor/SponsorPage.tsx` | Toggle that unlocks or hides the manual source-worker URL override field. | yes |
| `ce-sponsor-worker-url` | `client/src/components/Sponsor/SponsorPage.tsx` | Manual source-worker URL override input shown after the worker URL toggle is opened. | yes |
| `ce-sponsor-create` | `client/src/components/Sponsor/SponsorPage.tsx` | Primary button that issues grants, uploads the encrypted bundle, and generates the share URL. | yes |
| `ce-sponsor-status` | `client/src/components/Sponsor/SponsorPage.tsx` | Status note for sponsor bundle creation progress/success/error text. | yes |
| `ce-sponsor-share-url` | `client/src/components/Sponsor/SponsorPage.tsx` | Read-only generated `/new?sponsored=...#k=...` share URL input. | yes |
| `ce-sponsor-tx-id` | `client/src/components/Sponsor/SponsorPage.tsx` | Read-only Arweave transaction id status line for the generated sponsor bundle. | yes |

## CompareAddresses

| `data-testid` | Component path(s) | Meaning / When Present | TestID API |
| --- | --- | --- | --- |
| `ce-compare-address-a` | `client/src/components/UserPage/CompareAddresses.tsx` | Primary compare address input A (index 0). | yes |
| `ce-compare-address-b` | `client/src/components/UserPage/CompareAddresses.tsx` | Primary compare address input B (index 1). | yes |
| `ce-compare-add-address` | `client/src/components/UserPage/CompareAddresses.tsx` | Adds an additional address input row. | yes |
| `ce-compare-run` | `client/src/components/UserPage/CompareAddresses.tsx` | Runs the comparison. | yes |
| `ce-compare-result` | `client/src/components/UserPage/CompareAddresses.tsx` | Root wrapper for the results section (Collapse). | yes |
| `ce-compare-agreements` | `client/src/components/UserPage/CompareAddresses.tsx` | Agreements list container. | yes |
| `ce-compare-disagreements` | `client/src/components/UserPage/CompareAddresses.tsx` | Disagreements list container. | yes |

## PolisReport

| `data-testid` | Component path(s) | Meaning / When Present | TestID API | Disambiguators |
| --- | --- | --- | --- | --- |
| `ce-polis-report-root` | `client/src/components/PolisReport/PolisReport.tsx` | Root wrapper of the PolisReport component. | yes |  |
| `ce-polis-settings-toggle` | `client/src/components/PolisReport/PolisReport.tsx` | Settings (cog) toggle button that opens the settings row. | yes |  |
| `ce-polis-demo-data-toggle` | `client/src/components/PolisReport/PolisReport.tsx` | "Demo Data" checkbox input. | yes |  |
| `ce-polis-analyze-clusters` | `client/src/components/PolisReport/PolisReport.tsx` | "Analyze clusters" button. | yes |  |
| `ce-polis-cluster-analysis` | `client/src/components/PolisReport/PolisReport.tsx` | Cluster analysis summary container. | yes | `data-ce-cluster-index`, `data-ce-analysis-state` |

## OnePageSession (Session Results Toggle)

| `data-testid` | Component path(s) | Meaning / When Present | TestID API |
| --- | --- | --- | --- |
| `ce-session-results-toggle` | `client/src/components/OnePageSession/OnePageSessionStandardShell.tsx` | Header/toggle that expands the "Results" section on a session page. | yes |
| `ce-session-pile-back` | `client/src/components/OnePageSession/OnePageSessionStandardShell.tsx` | Back control shown while full questions view is open; returns to pile mode. | yes |
| `ce-session-auto-mint-login-banner` | `client/src/components/OnePageSession/OnePageSessionAutoMintAlerts.tsx` | Sticky warning banner shown when an auto-mint URL is present but the viewer must log in first. | yes |
| `ce-session-auto-mint-countdown` | `client/src/components/OnePageSession/OnePageSessionAutoMintAlerts.tsx` | Countdown banner shown immediately before the session page runs the auto-mint queue. | yes |
| `ce-session-auto-mint-status` | `client/src/components/OnePageSession/OnePageSessionAutoMintAlerts.tsx` | Per-SBT status alert for session auto-mint progress/results (`data-ce-sbt-address`, `data-ce-status`). | yes |

## Agent Mode (Dev/E2E)

Agent Mode is a dev/e2e-only global interface `window.__ceAgent` (installed from `client/src/components/App.tsx` and implemented in `client/src/utilities/ceAgent.js`).
Use `window.__ceAgent.describe()` when you want the current supported action/tool contract and canonical doc paths for this surface.

Agent page UI: `client/src/components/Agent/AgentPage.tsx`

| `data-testid` | Meaning / When Present | TestID API |
| --- | --- | --- |
| `ce-agent-actions` | JSON textarea containing action list. | yes |
| `ce-agent-run` | Runs all actions. | yes |
| `ce-agent-step` | Runs a single action (step). | yes |
| `ce-agent-log` | Log output container. | yes |

## SurveyTool (Answering)

| `data-testid` | Component path(s) | Meaning / When Present | TestID API | Disambiguators |
| --- | --- | --- | --- | --- |
| `ce-survey-decrypt-prompt` | `client/src/components/SurveyTool/SurveyTool.tsx` | Button that triggers prompt decrypt/reload when the prompt is masked (`[encrypted]`). | yes | `data-ce-question-id` |
| `ce-survey-gated-prompt-notice` | `client/src/components/SurveyTool/SurveyTool.tsx` | Notice shown when a question prompt is gated/masked and must be decrypted before answering. | yes | `data-ce-question-id` |
| `ce-survey-locked-banner` | `client/src/components/SurveyTool/SurveyTool.tsx` | Locked-questions banner shown when masked gated questions exist in full mode. | yes |  |
| `ce-survey-locked-banner-caret` | `client/src/components/SurveyTool/SurveyTool.tsx` | Caret toggle at the bottom-right of the locked banner that expands/collapses gate/SBT requirements. | yes |  |
| `ce-survey-locked-decrypt` | `client/src/components/SurveyTool/SurveyTool.tsx` | Locked-banner decrypt action button (manual gated prompt retry). | yes |  |
| `ce-survey-answer-input` | `client/src/components/Shared/AudioInput/AudioInput.tsx` (wired from `SurveyTool.tsx`) | Textarea used for a freeform question answer. | yes | `data-ce-question-id` |
| `ce-survey-submit` | `client/src/components/SurveyTool/SurveyQuestionsSubmitFooter.tsx`; `client/src/components/SurveyTool/SurveySelector.tsx`; `client/src/components/SurveyTool/surveyPileInteractionSurface.tsx` | Primary submit button (header, footer, or pile view). | yes |  |
| `ce-survey-create-toggle` | `client/src/components/SurveyTool/SurveyTool.tsx` | Header create icon toggle (open/close CreateQuestionsAndSurveys panel). | yes |  |
| `ce-survey-create-toggle-pile` | `client/src/components/SurveyTool/SurveyTool.tsx` | Pile view create icon toggle (open/close create interface). | yes |  |
| `ce-survey-view-all` | `client/src/components/SurveyTool/SurveyTool.tsx` | Pile view "View All Questions" control. | yes |  |
| `ce-survey-pile-hologram-toggle` | `client/src/components/SurveyTool/SurveyTool.tsx` | Reserved top-right pile-view hologram toggle for the future voice-only avatar mode. The test ID remains stable, but the button is currently hidden in the UI. | yes |  |
| `ce-survey-pile-hologram-panel` | `client/src/components/SurveyTool/PileHologramAssistant.tsx` | Full-card light-blue hologram face takeover rendered while the pile hologram toggle is active. | yes |  |
| `ce-session-listening-toggle` | `client/src/components/SurveyTool/surveyPileInteractionSurface.tsx` | Pile action microphone toggle that opens/closes the session listening panel. | yes |  |
| `ce-session-listening-panel` | `client/src/components/SurveyTool/SessionListeningPanel.tsx` | Pile-adjacent listening panel opened by the microphone toggle or `?mode=listening`. | yes |  |
| `ce-session-listening-start` | `client/src/components/SurveyTool/SessionListeningPanel.tsx` | Starts the rolling microphone recording after a user gesture. | yes |  |
| `ce-session-listening-stop` | `client/src/components/SurveyTool/SessionListeningPanel.tsx` | Stops the active rolling recording session. | yes |  |
| `ce-session-listening-clear` | `client/src/components/SurveyTool/SessionListeningPanel.tsx` | Clears the current listening transcript/draft from the transcript overlay control. | yes |  |
| `ce-session-listening-transcript-details` | `client/src/components/SurveyTool/SessionListeningPanel.tsx` | Compact transcript character-count button that opens/closes the stitched transcript. | yes |  |
| `ce-session-listening-transcript` | `client/src/components/SurveyTool/SessionListeningPanel.tsx` | Read-only stitched transcript textarea. | yes |  |
| `ce-session-listening-generate` | `client/src/components/SurveyTool/SessionListeningPanel.tsx` | Generates draft questions from the stitched transcript. Hidden until transcript/audio content exists. | yes |  |
| `ce-session-listening-suggestions` | `client/src/components/SurveyTool/SessionListeningPanel.tsx` | Wrapper around the generated-question review surface. | yes |  |
| `ce-survey-additional-toggle` | `client/src/components/SurveyTool/SurveyTool.tsx` | Toggle that opens/closes the "Additional comments" section for a question. | yes | `data-ce-question-id` |
| `ce-survey-additional-input` | `client/src/components/Shared/AudioInput/AudioInput.tsx` (wired from `SurveyTool.tsx`) | Textarea used for additional comments. | yes | `data-ce-question-id` |
| `ce-survey-existing-response-notice` | `client/src/components/SurveyTool/SurveyQuestionsUserResponseNotice.tsx` | Wrapper shown when the connected wallet already has a submitted response (single-question mode or answer view). Contains Start Fresh / Decrypt-Edit / Exit Editing controls. | yes |  |
| `ce-survey-submitted-indicator` | `client/src/components/SurveyTool/SurveyQuestionsSubmitFooter.tsx`; `client/src/components/SurveyTool/surveyPileInteractionSurface.tsx` | Submitted-state indicator shown after a successful submit (full + pile views) until any new edit is made. | yes |  |
| `ce-survey-start-fresh` | `client/src/components/SurveyTool/SurveyQuestionsUserResponseNotice.tsx` | Clears the current draft and lets the user submit a new response even when one already exists. | yes |  |
| `ce-survey-decrypt-edit-all` | `client/src/components/SurveyTool/SurveyQuestionsUserResponseNotice.tsx` | Decrypts all encrypted fields in the existing response and enters editing mode (when supported). | yes |  |
| `ce-survey-exit-editing` | `client/src/components/SurveyTool/SurveyQuestionsUserResponseNotice.tsx` | Exits editing mode and returns to viewing the existing submitted response. | yes |  |
| `ce-survey-filter-toggle` | `client/src/components/SurveyTool/SurveyTool.tsx` | Opens/closes the QuestionFilter panel (header + pile action bar). | yes |  |
| `ce-question-filter-modal` | `client/src/components/SurveyTool/QuestionFilter.tsx` | Root wrapper for the QuestionFilter panel (inline and modal variants). | yes |  |
| `ce-question-filter-section-ai` | `client/src/components/SurveyTool/QuestionFilter.tsx` | Collapsible section header for AI filter controls. | yes |  |
| `ce-question-filter-section-sbt` | `client/src/components/SurveyTool/QuestionFilter.tsx` | Collapsible section header for SBT filter controls. | yes |  |
| `ce-question-filter-ai-query` | `client/src/components/SurveyTool/QuestionFilter.tsx` (via `AudioInput.tsx`) | AI filter query textarea. | yes |  |
| `ce-question-filter-ai-top-n` | `client/src/components/SurveyTool/QuestionFilter.tsx` | Top-N numeric input for AI question ranking. | yes |  |
| `ce-question-filter-ai-apply` | `client/src/components/SurveyTool/QuestionFilter.tsx` | Apply button for AI filter ranking. | yes |  |
| `ce-question-filter-clear-all` | `client/src/components/SurveyTool/QuestionFilter.tsx` | Clears all active question filters. | yes |  |

## SBTSelector (QuestionFilter + Other SBT Flows)

| `data-testid` | Component path(s) | Meaning / When Present | TestID API | Disambiguators |
| --- | --- | --- | --- | --- |
| `ce-sbt-selector-root` | `client/src/components/SBTs/SBTSelector.tsx` | Root wrapper for a selector instance. | yes | `data-ce-sbt-selector-id` |
| `ce-sbt-selector-manual-toggle` | `client/src/components/SBTs/SBTSelector.tsx` | Toggle button that shows/hides manual-by-address input mode. | yes |  |
| `ce-sbt-selector-manual-input` | `client/src/components/SBTs/SBTSelector.tsx` | Manual SBT address input field. | yes |  |
| `ce-sbt-selector-manual-add` | `client/src/components/SBTs/SBTSelector.tsx` | Manual SBT add button. | yes |  |
| `ce-sbt-selector-selected` | `client/src/components/SBTs/SBTSelector.tsx` | A selected SBT chip rendered in the selector. | yes | `data-ce-sbt-address` |

## SingleQuestionResponse (Decrypting Existing Responses)

| `data-testid` | Component path(s) | Meaning / When Present | TestID API | Disambiguators |
| --- | --- | --- | --- | --- |
| `ce-encrypted-answer-notice` | `client/src/components/SurveyTool/SingleQuestionResponse.tsx` | "Answer is encrypted" notice for a response field. | yes | `data-ce-question-id` |
| `ce-decrypt-answer` | `client/src/components/SurveyTool/SingleQuestionResponse.tsx` | Button that decrypts an encrypted answer. | yes | `data-ce-question-id` |
| `ce-encrypted-additional-notice` | `client/src/components/SurveyTool/SingleQuestionResponse.tsx` | "Additional comments are encrypted" notice. | yes | `data-ce-question-id` |
| `ce-decrypt-additional` | `client/src/components/SurveyTool/SingleQuestionResponse.tsx` | Button that decrypts encrypted additional comments. | yes | `data-ce-question-id` |

## CreateQuestionsAndSurveys (Authoring)

| `data-testid` | Component path(s) | Meaning / When Present | TestID API | Disambiguators |
| --- | --- | --- | --- | --- |
| `ce-create-panel` | `client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx` | Root element of the CreateQuestionsAndSurveys panel. | yes |  |
| `ce-create-mode-switch` | `client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx` | Switch between Manual and "from URL / Content" modes (when available). | yes |  |
| `ce-create-clear` | `client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx` | Clear form button (when visible). | yes |  |
| `ce-create-title` | `client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx` | Title input for Survey mode. | yes |  |
| `ce-create-question` | `client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx` | Per-question container in the authoring form. | yes | `data-ce-question-index` |
| `ce-create-question-prompt` | `client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx` | Question prompt textarea within a question container. | yes |  |
| `ce-create-question-tag-input` | `client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx` | Tag input within a question container. | yes |  |
| `ce-create-question-add-tag` | `client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx` | "Add Tag" control (checkmark) within a question container (only visible when input is non-empty). | yes |  |
| `ce-create-question-add-option` | `client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx` | "Add Option" control for multichoice questions. | yes |  |
| `ce-create-question-single-select` | `client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx` | Checkbox that enables single-select multichoice mode. | yes |  |
| `ce-create-submit` | `client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx` | Primary submit button for Create Questions / Create Survey. | yes |  |
| `ce-create-success` | `client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx` | Success confirmation wrapper shown after authoring submit completes. | yes |  |
| `ce-create-uploaded-questions` | `client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx` | Wrapper around the list of uploaded questions (when present). | yes |  |
| `ce-create-uploaded-question` | `client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx` | Per-uploaded-question list item in the success UI (when present). | yes | `data-ce-question-id` |

## SBT Create / View

| `data-testid` | Component path(s) | Meaning / When Present | TestID API | Disambiguators |
| --- | --- | --- | --- | --- |
| `ce-sbts-create-toggle` | `client/src/components/SBTs/SBTsPage.tsx` | Button that toggles the inline Create Group panel on `/sbts/:slug`. | yes |  |
| `ce-sbt-create-name-lock-row` | `client/src/components/SBTs/CreateSBTGroup.tsx` | Lockable row containing the SBT name input and gate lock. | yes |  |
| `ce-sbt-create-description-lock-row` | `client/src/components/SBTs/CreateSBTGroup.tsx` | Lockable row containing the SBT description textarea and gate lock. | yes |  |
| `ce-sbt-create-image-lock-row` | `client/src/components/SBTs/CreateSBTGroup.tsx` | Lockable section for the SBT image controls and image gate lock. | yes |  |
| `ce-sbt-create-docs-lock-row` | `client/src/components/SBTs/CreateSBTGroup.tsx` | Lockable row containing the document URL input/add button and gate lock. | yes |  |
| `ce-sbt-create-tags-lock-row` | `client/src/components/SBTs/CreateSBTGroup.tsx` | Lockable section for tags and the tags gate lock. | yes |  |
| `ce-sbt-create-name-input` | `client/src/components/SBTs/CreateSBTGroup.tsx` | SBT name input in the Create Group form. | yes |  |
| `ce-sbt-create-description-input` | `client/src/components/SBTs/CreateSBTGroup.tsx` | SBT description textarea in the Create Group form. | yes |  |
| `ce-sbt-create-image-file-input` | `client/src/components/SBTs/CreateSBTGroup.tsx` | Hidden file input used for image upload mode. | yes |  |
| `ce-sbt-create-image-paste` | `client/src/components/SBTs/CreateSBTGroup.tsx` | Compact Image field `Paste` button used to pull an SBT image blob or URL from the clipboard. | yes |  |
| `ce-sbt-create-image-url-input` | `client/src/components/SBTs/CreateSBTGroup.tsx` | URL input used when image URL mode is selected. | yes |  |
| `ce-sbt-create-doc-url-input` | `client/src/components/SBTs/CreateSBTGroup.tsx` | Pending document URL input. | yes |  |
| `ce-sbt-create-doc-url-add` | `client/src/components/SBTs/CreateSBTGroup.tsx` | Button that appends the pending document URL to the list. | yes |  |
| `ce-sbt-create-tag-input` | `client/src/components/SBTs/CreateSBTGroup.tsx` | Pending tag input. | yes |  |
| `ce-sbt-create-tag-add` | `client/src/components/SBTs/CreateSBTGroup.tsx` | Button that appends the pending tag to the tag list. | yes |  |
| `ce-sbt-create-section-header` | `client/src/components/SBTs/CreateSBTGroup.tsx` | Collapsible section header button inside the Create SBT modal/form. | yes | `data-ce-section-key` (`tokenInfoCollapsed`, `mintOptionsCollapsed`, `distributionOptionsCollapsed`) |
| `ce-sbt-create-error` | `client/src/components/SBTs/CreateSBTGroup.tsx` | Visible error banner for deferred-draft, upload, or mint validation failures. | yes |  |
| `ce-sbt-create-predictable-toggle` | `client/src/components/SBTs/CreateSBTGroup.tsx` | Toggle that enables predictable-before-deploy CREATE2 planning (forced on in deferred session mode). | yes |  |
| `ce-sbt-create-predicted-address` | `client/src/components/SBTs/CreateSBTGroup.tsx` | Predicted deterministic SBT address preview. | yes |  |
| `ce-sbt-create-salt-input` | `client/src/components/SBTs/CreateSBTGroup.tsx` | Advanced/custom salt input shown when the predictable-address card is expanded. | yes |  |
| `ce-sbt-create-submit` | `client/src/components/SBTs/CreateSBTGroup.tsx` | Primary create/mint button for the Create Group flow. | yes |  |
| `ce-sbt-create-success` | `client/src/components/SBTs/CreateSBTGroup.tsx` | Success confirmation wrapper shown after the SBT contract is created. | yes |  |
| `ce-sbt-create-success-page-link` | `client/src/components/SBTs/CreateSBTGroup.tsx` | Success action link that opens `/sbt/:address`. | yes |  |
| `ce-sbt-create-success-arweave-link` | `client/src/components/SBTs/CreateSBTGroup.tsx` | Success action link that opens the tokenURI metadata on Arweave. | yes |  |
| `ce-sbt-create-open-mint-url` | `client/src/components/SBTs/CreateSBTGroup.tsx` | Open-mint success card showing the `/session/:slug?sbt=:address&auto=1` URL for public no-password SBTs. | yes |  |
| `ce-sbt-page-name` | `client/src/components/SBTs/SbtPageIdentityPanel.tsx` | Primary SBT display name heading on the detail page. | yes |  |
| `ce-sbt-page-description` | `client/src/components/SBTs/SbtPageIdentityPanel.tsx` | Primary SBT description text on the detail page, including masked locked copy. | yes |  |
| `ce-sbt-page-image` | `client/src/components/SBTs/SbtPageIdentityPanel.tsx`; `client/src/components/SBTs/SbtPageMiniCard.tsx` | SBT detail and mini-card image element used for placeholder/decrypted image assertions. | yes |  |
| `ce-sbt-page-open-mint-url` | `client/src/components/SBTs/SbtPageOpenMintUrlCard.tsx` | Admin-only info card showing the open-mint auto-join URL for eligible public no-password SBTs. | yes |  |

## Gate Lock Popover

| `data-testid` | Component path(s) | Meaning / When Present | TestID API | Disambiguators |
| --- | --- | --- | --- | --- |
| `ce-gate-lock` | `client/src/components/Gates/GateMultiSelectLock.tsx` | Root element for the multi-select gate lock UI. | yes |  |
| `ce-gate-lock-button` | `client/src/components/Gates/GateMultiSelectLock.tsx` | Lock/unlock button that opens the gate picker popover. | yes |  |
| `ce-gate-lock-popover` | `client/src/components/Gates/GateMultiSelectLock.tsx` | Popover/dialog that lists available gates. | yes |  |
| `ce-gate-lock-row` | `client/src/components/Gates/GateMultiSelectLock.tsx` | A single gate row within the popover. | yes | `data-ce-gate-id` |

## Tool Explorer Data View

| `data-testid` | Component path(s) | Meaning / When Present | TestID API | Disambiguators |
| --- | --- | --- | --- | --- |
| `ce-tool-explorer-data-add` | `client/src/components/MainContent/ToolExplorer.tsx` | Header action that switches the expanded Tool Explorer `Data` card into add/create mode. | yes |  |
| `ce-tool-explorer-data-view` | `client/src/components/MainContent/ToolExplorer.tsx` | Header action that switches the expanded Tool Explorer `Data` card into view/library mode. | yes |  |
| `ce-database-view-demo-toggle` | `client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.tsx` | Local checkbox inside Tool Explorer `Data` view mode that toggles between demo corpus and real session docs when demo surfaces are enabled. | yes |  |
| `ce-database-view-panel` | `client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.tsx` | Root wrapper for the Tool Explorer `Data` view-mode content shell. | yes |  |
| `ce-database-photo-source-card` | `client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.tsx` | Compact queued-photo card shown in Tool Explorer `Data` add mode for each uploaded image. | yes | `data-ce-source-id` |
| `ce-database-photo-source-preview` | `client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.tsx` | Thumbnail preview image rendered inside a queued photo card. | yes | `data-ce-source-id` |
| `ce-database-photo-source-analysis-toggle` | `client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.tsx` | Ready-state `Analysis complete` toggle button that expands or collapses inline photo analysis beneath a queued photo card. | yes | `data-ce-source-id` |
| `ce-database-photo-source-analysis-body` | `client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.tsx` | Expanded inline analysis body for a queued photo card after photo analysis completes. | yes | `data-ce-source-id` |
| `ce-database-save-docs-toggle` | `client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.tsx` | `Add to session context` checkbox shown in Tool Explorer `Data` add mode once URL/file/photo sources exist; enables saving those sources during Generate. | yes |  |
| `ce-database-save-docs-audience-button` | `client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.tsx` | Icon-only lock/audience button shown with the session-context checkbox. | yes | `data-ce-doc-save-audience` (`self` or `session`) |
| `ce-database-save-docs-audience-menu` | `client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.tsx` | Audience popover for Tool Explorer saved extra sources. | yes |  |
| `ce-database-save-docs-audience-self` | `client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.tsx` | Audience option that saves queued extra sources as private `only me` context entries. | yes |  |
| `ce-database-save-docs-audience-session` | `client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.tsx` | Audience option that saves queued extra sources with the session `docUploads` gate when available. | yes |  |

## Doc Library

| `data-testid` | Component path(s) | Meaning / When Present | TestID API | Disambiguators |
| --- | --- | --- | --- | --- |
| `ce-doc-panel` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Root element for the Doc Library panel. | yes |  |
| `ce-doc-title` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Panel title. | yes |  |
| `ce-doc-refresh` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Refresh button for listing docs. | yes |  |
| `ce-doc-upload-file-input` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | File input used to select a file for upload. | yes |  |
| `ce-doc-upload-file-button` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Upload button for file uploads. | yes |  |
| `ce-doc-url-input` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | URL input for uploading a link record. | yes |  |
| `ce-doc-url-title-input` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Optional title input for link record uploads. | yes |  |
| `ce-doc-url-add-button` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Button that uploads a link record. | yes |  |
| `ce-doc-lock-toggle` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Lock/unlock toggle for plaintext vs Lit-encrypted upload mode. | yes | `data-ce-locked` |
| `ce-doc-audience-session-gate` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Radio input selecting the session `docUploads` gate as the Lit audience. | yes |  |
| `ce-doc-audience-custom` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Radio input selecting custom SBT audience. | yes |  |
| `ce-doc-custom-sbt-input` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Input for adding custom SBT addresses to the audience. | yes |  |
| `ce-doc-custom-sbt-add` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Button that adds a custom SBT address to the audience list. | yes |  |
| `ce-doc-custom-mode-any` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Radio input selecting "Any" (OR) mode for custom audience list. | yes |  |
| `ce-doc-custom-mode-all` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Radio input selecting "All" (AND) mode for custom audience list. | yes |  |
| `ce-doc-row` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Row wrapper for a single doc entry in the list. | yes | `data-ce-doc-txid`, `data-ce-doc-storage`, `data-ce-doc-kind`, `data-ce-index-status` |
| `ce-doc-row-view` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Row action that opens the viewer modal for a doc entry. | yes |  |
| `ce-doc-row-open-arweave` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Row action link that opens the Arweave gateway URL. | yes |  |
| `ce-doc-viewer` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Viewer modal root. | yes |  |
| `ce-doc-viewer-title` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Viewer modal header/title area. | yes |  |
| `ce-doc-viewer-error` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Viewer modal error text wrapper (when present). | yes |  |
| `ce-doc-viewer-download` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Download link shown for blob-backed previews (when present). | yes |  |
| `ce-doc-viewer-pdf` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | PDF iframe preview (when present). | yes |  |
| `ce-doc-viewer-image` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Image preview `<img>` (when present). | yes |  |
| `ce-doc-viewer-text` | `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx` | Text/JSON `<pre>` content preview (when present). | yes |  |
