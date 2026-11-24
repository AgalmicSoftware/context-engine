# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Site — available when the site deploys

- **No empty band above the question after a submit.** On a wide screen the session's title moves up to make room for Submit above the question card, and the green **Submitted** that replaces it hides after ten seconds; the title used to stay up over the empty space. It now comes back down once nothing shows there. The card itself does not move, and phones are unchanged.
- **Session Agent answers keep their lists.** An answer's "- " and "•" bullets, numbered steps (each keeping its own number), short headings and bold now show as such in the dialog and in admins' list of stored chats, and its line breaks stay. HTML, links and images in an answer show as text, as written, and nothing is drawn or fetched from it; stored chats keep the text as it came.
- **Group recordings ask where the others are.** Before a new Group Conversation recording, Record asks whether the others are in the room or on a call through this device; the answer sets "Recording voices coming from this device" (on a call: on, with "Use speakers, not headphones") and starts recording in the same tap. While recording, a note says when the last two finished parts each held only one voice, and points at that option and at headphones; it never stops or changes the recording, and needs speaker labels.
- **Rating answers say their number once.** An answer card shows "8/10" without the bare "0" and "10" beside it; worded scale ends, and a lowest point other than 0, still show.
- **The report's questions fold.** Each written, rating, multiple-choice and quadratic question starts as one line, with its prompt, how many answered and its answer in short (the start of the first written answer, the average, the option chosen most, or the highest net), and opens with a click or the keyboard; Open all and Fold all do so for a section. Multiple-choice options sit closer together when open. The report's Expand All and Collapse All open and fold them too, and the PDF export shows each open, then leaves each as it was; agree/disagree statements, already a line each, are unchanged.
- **The report lists participants by when they first answered.** The List of Participants starts with whoever answered first, going by the earliest time on each person's answers in the report (the time an answer was last saved). Anyone whose answers carry no time, as some agents' do, follows in the previous order.
- **Positions, most widely held first.** In Results' Atlas, each topic's positions (and a question's categories of answer) are listed by how many participants hold them, most first; positions held by the same number keep their order.

## [0.9.41] - 2026-11-24

Group Conversation drafts each multiple-choice question as pick one or pick any, an added transcript shows in the session's context at once, and who can read the transcript has room on a phone. Stats shows its counts without waiting for its block check, and a passkey sign-in's spinner has Cancel. Site only: the Session Worker's code is unchanged and MCP stays 0.9.35.

### Site — available when the site deploys

- **Group Conversation drafts pick one or pick any.** Each multiple-choice question it drafts is now pick one where its options exclude one another and pick any where several can apply, and its card says which, as other choice questions do. Before, every one was pick any.
- **Stats no longer waits on spinners for its block check.** After a session choice, and in ALL, the panel checked each on-chain session's latest block in turn before it showed anything that came in later, which with a slow network could keep every count but Sessions spinning for minutes. That check now runs beside the counts, which show as each comes in.
- **Who can read the transcript has room on a phone.** Under **Add transcript to context**, the choice now takes the whole width below the box and **Submit questions** on a phone, where before it was squeezed into the box's narrow column.
- **An added transcript shows in the session's context at once.** After Group Conversation adds its transcript to context, the session page's context list, and the context the session's AI reads, now include it without a page reload.
- **A passkey sign-in can no longer get stuck on its spinner.** After Create, the passkey step that follows could wait with nothing on screen, and closing the dialog left every later Submit on the spinner. The spinner now has **Cancel**, and closing the dialog on it does the same: the step stops, nothing more is saved, and the dialog says to choose **Login** and pick the passkey just made. A sign-in cancelled from outside the dialog also ends its spinner.
- **Deploy helper.** It deploys the 0.9.40 Worker bundles. A Worker updated from the site gets this release's.

## [0.9.40] - 2026-11-24

In Group Conversation, Add transcript to context starts ticked, with who can read the transcript chosen right below it, from the same choices and starting point as before. The robot by a session's title opens the Session Agent, and its dialog is simpler: its "?"s show their words on a click or tap, the microphone sits beside the question box, Ask is a larger, filled button, the Name field is gone, and its two stored switches move to the Context section with the same choices and defaults. Site only: the Session Worker's code is unchanged and MCP stays 0.9.35.

### Site — available when the site deploys

- **Add transcript to context starts ticked.** In Group Conversation the box beside **Submit questions** is ticked to start; unticked, nothing is uploaded. Who can read the transcript is chosen right below the box, with the same choices and starting point as before. The choice lasts while the panel is open, through **Record more**, and isn't stored. Where the box isn't offered, such as a participant in a session that takes context from admins only, nothing is uploaded.
- **The robot by a session's title opens the Session Agent.** It linked to how the Session Agent works on GitHub; that link is now a "?" by the dialog's title, for everyone who opens it, and the Context section's Session Agent button stays. Where a person can't ask the agent, such as signed out on a session that asks for sign-in, the robot still links to how it works.
- **The Session Agent dialog's "?"s show their words on a click or tap.** On phones a tap opened and closed them at once, and with tooltips turned off they showed nothing; now they also stay open while focused.
- **The Session Agent dialog is simpler.** The microphone sits beside the question box and Ask is a larger, filled button. The optional Name field for a stored chat is gone, so a stored chat from the site carries no name. "Use my answers and files" and "Include my address with my answers" left the dialog: both are set in the Context section, beside the Session Agent button, with the same stored choices and defaults, each with a "?" that shows its words on a click or tap. A stored chat still carries no address unless its asker chooses "My address" for it.
- **Deploy helper.** It deploys the 0.9.39 Worker bundles. A Worker updated from the site gets this release's.

## [0.9.39] - 2026-11-24

A Worker updated to this release no longer answers `503` to requests that share a settings read with a request that ended first, so sign-in, lists and names keep working after a reload or a quiet spell. No site change beyond the Deploy helper; no MCP change.

### Session Worker — needs a Worker update

- **A cancelled request no longer fails the requests waiting on its settings read.** Requests arriving together in one Worker instance share one read of the session's settings, and AI Views viewers one read of the draft. They did so by awaiting the promise of the request that started the read; when that request ended before they saw the answer, Cloudflare's runtime rejected them ("This promise was created by a request that has since ended, so it can never settle") and the Worker answered `503` (`500` from `/capabilities`). A request ends first when its caller hangs up (a reload, a closed tab), and also without one: after a quiet spell a slow first read gathers many waiters, and the first request may answer and end before they all see it. A cancelled read also stayed in place, so later requests in that instance failed the same way, signed in or not, until it was recycled: lists, sign-in nonces and names failed, and the page showed "Cache initialization error" even after a reload. The site does not retry that reply. A waiting request now checks for the shared read's answer on its own timer and never awaits another request's promise; if that read has not answered within a second, the next request reads again. Those waiting are no longer tied to the first request at all; a cancelled read costs them up to a second, and no request after that. A burst still sends the coordinator one read, and those waiting still get its answer, including the busy reply the site sends again.

### Site — available when the site deploys

- **Deploy helper.** It deploys the 0.9.38 Worker bundles. A Worker updated from the site gets this release's.

## [0.9.38] - 2026-11-24

The interview's Submit fills its button, Agree / Unsure / Disagree keep their own colours and one font, multiple choice lists one option per line, a room of more than four letters its speakers part by part and new questions from a recording are easy to find; the report lists choices most chosen first, the interview says who processes it, the Stats panel settles, the Analyze box drops its Text view and the footer credits Agalmic Software. No Worker or MCP change.

### Site — available when the site deploys

- **The interview's "?" says who processes it.** It now ends "Processed by OpenAI; future versions will use open-source models." The voice always runs on OpenAI, and the session's AI provider drafts the answers, so a session set to Anthropic reads "Processed by OpenAI and Anthropic". The "?" sits in the interview's header, so it can be read before starting.
- **The Stats panel settles on every session choice.** Signed out on the home page, Groups and the header kept spinning on any single session, and Surveys and the header on ALL, because the panel waited for group counts and question details of sessions never opened in this browser, and in ALL for the general chain session, none of which ever come. Those now count as settled: Users, Questions and Surveys come from each session's listings, and Groups shows "–" where no session in view could be counted. A session whose listing or group count gets no answer within 15 seconds is left out of the sum (shown with a plus) instead of holding every tile, and is added if it answers later. After quick switching, the panel no longer waits up to a minute on the previous choice's poll.
- **The interview's Submit fills its button.** Its words were 16px in a button three times as tall, and so was the count of answers in its corner. The words now take their size from the button: half its height, unless the label would then be too wide for it, so "Submit and join" and "Submit after login" are set smaller than "Submit" and never grow the button, wrap or spill out of it. The count grows with the button, to just under the words' size and never past them. On a phone "SUBMIT" goes from 16px to 23px, beside the submission info on a computer to 33px. Browsers without container units keep the button as it was.
- **After a choice, Agree / Unsure / Disagree keep their own colours.** The options beside the chosen one were darkened by a black layer laid over them, which turned yellow to olive and red to brown. Now the chosen one keeps exactly the colours it has when nothing is chosen, and the others keep theirs too, faded to 70% opacity, with nothing mixed in, in every theme including Classic 95, where the whole button fades rather than its swatch. The ring inside the chosen one is no longer the button's outline, so the keyboard's focus ring shows beside it instead of replacing it. Faded, a white label on Minimal's white card is at 2.9:1.
- **Agree / Unsure / Disagree use one font everywhere.** They took the font of the panel around them: the theme's body font on the question pile, but a monospace in the interview's review, the AI prefill review and a debate atlas node's questions, where the atlas also set them semibold. One shared style now gives them the pile's type wherever a question shows them: the theme's body font at its normal weight, with the chosen answer bold as before.
- **More than 4 people in the room starts ticked.** Group Conversation now starts a room in that mode on a device that has not chosen otherwise, since breakout rooms are usually larger than four and labels keep only four voices apart. A device's own choice, ticked or unticked, still wins. **Give each person their part** and the transcript's speaker buttons now follow whether the transcript has labels, not the box: before, a labelled recording reopened on a device where the box was ticked showed neither until the box was unticked.
- **With more than 4 people in the room, each part of the recording labels its own speakers.** Ticked, the box gave one plain block of text for every three minutes, with no sign of where one person stopped and another started. Now each part (one three-minute transcription) labels its voices Speaker A, Speaker B… in the order they first speak there, joining one speaker's consecutive turns, and the letters start again in the next part, which a light **Part 2**, **Part 3**… rule marks, so a later part's Speaker A is not read as an earlier one's. No voice sample is cut, kept or sent and no voice is matched across parts; only the model's own voice letters become labels, never a name. A part that falls back to plain text reads as a plain paragraph under its rule. The labels and rules go with the transcript to question drafting, to context and to the attachment, and there is still no part for each person. Unticked, voices keep a Person number across the recording as before.
- **New questions from a recording are easy to find.** Questions drafted after Stop, by the second ask when the first came back empty, or by **Generate questions** were added at the end of the draft list, often below the fold, and only a small button said there were new ones. The line beside the recording's controls now says how many a draft added ("2 questions added below."), and once recording has stopped the first new question, if out of sight, is scrolled into view: at once where the device asks for reduced motion, and not while someone types in a field, where the button still offers the way down. The line goes once a draft is removed or uploaded. Focus stays where it was. A draft that adds nothing still says "No new questions from this discussion."
- **The report lists a multiple choice question's options most chosen first.** The results view of the report showed them in the question's own order, so in a long list the most chosen could be anywhere. Pick one and Pick any questions now list them by how many chose each, most first, as quadratic allocation already does by net support; options chosen as often keep the question's order. Only the display changes: the answers, the options' order in the question, exports and filters are as before.
- **Multiple choice lists its options one per line at every width.** On a computer the question pile set them side by side in a strip that scrolled sideways, and the interview's review and the AI prefill review wrapped them into rows, so a long list made a review card as tall as its options. Now Pick one and Pick any questions, polls included, list their options one per line, top to bottom, wherever they are answered. On the pile the list takes the room the prompt leaves, so a choice card is as tall as any other question's, and a list too long for it scrolls up and down inside the card, ending partway through an option, with a fade and the card's arrows showing there is more. In the interview's review a long Pick one or Pick any list scrolls inside at most 42% of the screen's height, with the same arrows, and a drafted question's preview in Group Conversation scrolls inside the same height. Once a list is scrolled to its end, the mouse wheel moves the page on; only a phone's card keeps the page still.
- **The footer credits Agalmic Software in one link.** It read "Software by Agalmic", plain text beside a GitHub icon that was a separate link to the repository, named "View Context Engine on GitHub". Now "Agalmic Software" and the GitHub icon are one link to the repository, as the icon was, named "Agalmic Software: view Context Engine on GitHub". The words take the link's colour rather than the dimmer credit colour. Classic 95's taskbar still shows only the icon.
- **The Analyze box has no Options and no Text view.** Under the analysis an Options box held one tick box, **Show the Text view**, which added a Text button showing what the Breakdown already shows, in a plainer layout. Both are gone: the analysis shows as the Breakdown, and as the Card where the session makes one. A browser where the box was ticked opens on the Breakdown like any other, since the choice it kept is no longer read.
- **Deploy helper.** It deploys the 0.9.37 Worker bundles. A Worker updated from the site gets this release's.

### Local tooling

- **The recording smokes expect the room box to start ticked.** The question-submission smoke checks the box starts ticked; the recording smoke unticks it to follow speaker labels.

## [0.9.37] - 2026-11-23

A Worker updated to this release gives a session's questions as short pages an AI can read, sign-in works in a browser that blocks the site's data, the agent guide opens on which session to work on, and a room of more than four people can record a plain transcript. MCP unchanged.

### Session Worker — needs a Worker update

- **The Worker gives a session's questions as short Markdown pages.** A chat app's web reader hands its AI a summary of a long page, and a summary of the whole question list drops the question ids, without which the AI cannot make the review link. Measured with a summarizing reader on a real 40-question session: the whole list kept 0 of 40 ids, a page of ten kept 10 of 10 with their words and options. Paths under the catalog route now give `index` (the fingerprint, the version, every question's number, id and type, and links to the pages), pages `1`, `2` … of up to ten questions each with their words and exact options, and `link`, which says how to make the review link with the session's own values. `size/<k>/` before a page asks for 1 to 40 questions a page (any other size gives ten); pages with long options still hold fewer, and every index and page names a smaller size to fall back to. Every page shows the question set's fingerprint and says to start again from the index if one differs; a rating question gives its scale and what its ends mean. They are built from the live questions on each request, under the JSON catalog's access rules, and nothing is stored; a public session's pages may be kept for a minute. A link with a ticket still gets the JSON. The JSON catalog is unchanged. An older Worker answers the new paths with "Not found."

### Site — available when the site deploys

- **The agent guide opens on which session to work on and where its questions are.** An AI sent a picture of a flyer that showed a session's address and said "Follow contextengine.sh/skill.md to draft my answers for this session" found the session but not its questions: a chat app's reader gave it a summary of the guide, which kept the names of the listed sessions and dropped their question addresses. `/skill.md` now begins, before anything else: the session is the one the person gave you, an address in their message, in the link that led you here, or in a picture, flyer, screenshot or QR caption (read the picture's text); with none, ask for the link in one line, and never pick from a list or the home page. For a session the site lists, its questions are at `https://contextengine.sh/questions/<name>`; an app that won't open an address it put together shows it to the person to send back, and any other session or a link with `worker=`, `src=` or `joinGroup=` goes to the section that handles it. With nothing known of the person's views, the AI says so in one line and goes through the questions with them in the chat first. Without the question ids, which a summary of the list does not carry, it gives plain-text drafts with the session link and says it could not make the review link. `/llms.txt` opens the same way. The shared steps, the Worker's skill and the MCP are unchanged.
- **A prompt copied on a link with `src=` or `joinGroup=` offers the site's question address first.** On a listed session opened by such a link, the copied AI prompt gave only the session Worker's own `workers.dev` address for the questions, which ChatGPT cannot open. It now gives `https://contextengine.sh/questions/<name>` first, as a plain session link does, and the page's own catalog second, which differs only in the groups and the review address it lists.
- **The page's note for AI agents gives the question address.** The "For AI agents" section every page carries now says a listed session's questions are at `https://contextengine.sh/questions/<name>`, which an AI may put together from the session link when it was not shown the list.
- **A room of more than four people can record a plain transcript.** Group Conversation's **Label speakers** checkbox is now **More than 4 people in the room**, unticked by default, so speaker labels stay on for small rooms. Labels keep only four voices apart, and a fifth may change number. Ticked, the audio is sent as ordinary transcription and the transcript is plain text, with no **Give each person their part** row and no speaker buttons in the transcript. The choice is kept on the device, so a recording reopened in the same room stays plain.
- **An empty draft after Stop is asked once more.** Stop drafts a group recording's questions by itself, and writing none is still a correct answer, but the model can answer with no questions by chance where the same request again gives some, and the page then said only "No new questions from this discussion." A draft after Stop that adds no question is now asked once more, at the cost of one more AI call. If that adds none either, the note reads "No new questions from this discussion. Press Generate questions to ask again." with the button beside it, even where drafts already hide the one below the transcript; a draft after Stop that fails offers the button there too. If **Record more** starts while that draft runs, it is not asked again and leaves no note. Pause still drafts nothing; a draft pressed by hand, or after each part, is asked once.
- **Sign-in works in a browser that blocks the site's cookies and site data.** 0.9.35 let such a browser read a session, but Create and Login failed with "The user denied permission to access the database", because the account's record is kept in a browser database that the same setting blocks. Where the browser has refused site storage, the record is now held in memory for the visit: Create, Login with a passkey and Login with file work, and answers can be submitted. The person is signed out when the tab closes or reloads, and Login with the same passkey or file brings the same account back; the notice says so. What is held is what the database would hold, for less time: a passkey record holds no key, and a login file's key stays sealed.
- **The chosen answer stands out on Agree / Unsure / Disagree.** Once one is chosen, the others dim by 30% and the chosen one keeps its colour, with a ring inside it in its label's colour. Before, only the chosen label's bold italics showed it, which was hard to see on the bright colours, as on the interview's Review drafts window when the AI had already chosen. Only the dimmed colours darken, so every label stays readable. The session's own questions use the same buttons, so they change too.
- **An AI reads a listed session's questions a page at a time.** `contextengine.sh/questions/<name>.md`, `/questions/<name>/<page>` and `/questions/<name>/size/<k>/<page>` pass through to the session Worker's short pages, and the guide's opening and `/llms.txt` send an AI to the index, then each page, then the link page, and to smaller pages if a page comes back shortened; each listed session's index address now comes first in `/skill.md`, `/llms.txt` and the session page's note for agents, before its JSON and Worker addresses. Only if those do not open does it fetch the whole list as JSON at `/questions/<name>`. Until a session's Worker is updated its pages do not open, so its AI uses the JSON as before.
- **The session lists show one test session.** The site's session lists (the Session drop-down, the Tools and Groups session pickers and the Sessions directory) leave out `rxc-ra-test-5` (RA test), so beside EDDY 2026 and the Reverse Alignment salon, the agent test session is the only test session they take from `known-sessions.json`. RA test's links, `/session/rxc-ra-test-5` and `/questions/rxc-ra-test-5`, still open it, since the file keeps its entry for the films and slides that link it, and the drop-down and the pickers still show it while it is that browser's current choice. As before, a browser also lists the sessions it has opened itself, below these.
- **Deploy helper.** It deploys the 0.9.36 Worker bundles. A Worker updated from the site gets this release's.

### Local tooling

- **The recording smokes use the new choice.** They find speaker labels by **More than 4 people in the room**, unticked, in place of **Label speakers**.

## [0.9.36] - 2026-11-23

A page that loads slowly shows its loading line from the HTML alone, the note for AI agents is ordinary page content, AI prompts wait for the question ids and review links from older question sets still open; the risk matrix keeps its labels in view and the Analyze box shows a person's saved card. No Worker or MCP change.

### Site — available when the site deploys

- **A review link made before the questions changed still opens.** The review page compared the fingerprint in the AI's packet with the session's question list and refused the whole link, "This prefill link was created for an older or different question set", when a question had been added, removed or edited since the AI read them. It now compares the fingerprint with nothing and fits each draft to its question as it is now: a draft for a question that was removed, or whose answer is no longer one of its options, is left out and counted in the existing notice ("Left out 2 drafts from your AI that don’t fit this session’s questions or their options."), and the rest are reviewed as usual. The page no longer reads the session's question list to decide this. A link for another session is still refused, in its own words; each answer is still checked against its question; nothing is submitted without the person's Submit. The fingerprint stays in the packet as a record of what the AI read.
- **The copied prompt no longer tells an AI to give up the link when the question list changed.** From a summary with another count or fingerprint it asks its tool for each question's id and leaves out any it can't get; from a whole list it uses that list's own values. The prompt's wording label is now `ce-prefill-prompt-5`.
- **A copy button for an AI prompt says "Loading questions…" until the session's question ids are read, and never gives a prompt without them.** The person's own prompt ("Have AI draft your answers", "Your AI agent") and the organizer's "For your AI" in Interview & share are off, with that label, while the page reads the session's question list. A list that can't be read, or that lacks its fingerprint or plain ids, is an error with Retry, where it used to give a prompt without the id list; a session with no questions says so. Two prompts have no id list by design: the short one that only hands an AI its key, whose AI reads the questions with that key, and the one the agent guide prints, which is for no one session.
- **With "AI can submit for me" ticked, a line under the box says what the prompt holds.** Once the key is in the prompt, both cards read "The prompt holds your AI key, for this session only, until 14:32." under the box, before anything is copied. Unticked, the prompt holds no key and the line goes; the line about a key that was already copied ("Key can answer as you until …") stays while that key works. A person who arrives by an `aiPrompt=1` link still finds the box ticked.
- **The loading line shows even when a filter replaces the site's files.** A security tool that flags the site can swap its scripts and stylesheet for a block page, which left a blank page with nothing said. The loading line's style now travels in the page itself, and where the page's own scripts never run it adds, after 20 seconds: "This page is not loading. A security tool, VPN filter or content blocker may be blocking this site's files."
- **The page's note for AI agents is no longer hidden text.** The note every page carries for an AI that fetches it without running it was kept off screen in a one-pixel clipped box, which is how phishing pages hide text and may be why a security tool flagged the site. The same words are now an ordinary "For AI agents" section anyone may open, after the app in the page and below the loading line; the site's first script still removes it as the app starts.
- **The site says where to report a security problem.** `/.well-known/security.txt` points to the public repository's private report page. No email address is published.
- **The web app manifest gives the product's name**, "Context Engine", and a description.
- **The Report says "Analyzing cluster…" while it summarizes a cluster.** Under Opinion Clusters, each cluster said "Analyzing group..." while the AI summarized it. Elsewhere on the site a group is a membership group, so the line now uses the section's own word.
- **The risk matrix keeps its row labels in view on a desktop too.** A matrix wider than its card scrolls sideways inside it, and on a desktop its row labels scrolled away with the squares, so a row could no longer be told from the next. They now stay at the left with the corner over them, as on a phone, in the matrix and in the grid a square opens. A phone also scrolls the grid down inside its card, keeping the column labels at the top; a desktop scrolls the page as before. A focused square draws its keyboard ring inside it, so a label beside it never hides part of the ring.
- **The Analyze box shows the card on a person's page while an analysis is awaited or has failed.** A card saved on a page shows in the page's side column, but the Analyze box showed a card only once a new analysis arrived, and none when it failed. The saved card now shows in the box at once, on your own page with "Take it off my page" as in the side column, until an analysis brings its own card.
- **Deploy helper.** It deploys the 0.9.35 Worker bundles. A Worker updated from the site gets this release's.

### Local tooling

- **The Results-builds theme smoke checks the risk matrix's pinned labels at every width.** It held that no label stuck on a desktop; now the labels must stick at every width and, wherever the grid scrolls sideways, stay at the left, opaque and on top, with a focused label's or square's ring drawn inside it. The benchmark's standalone report pins its matrix labels the same way.

## [0.9.35] - 2026-11-23

A slow or stuck load shows a loading bar instead of a white page and the site works with site data blocked; the AI gives the review link once; MCP 0.9.35 carries the site's steps and one rule for an agent's name; a refused name says which word.

### Session Worker — needs a Worker update

- **A refused name says which word, and a name that works.** A name with a role word, or the site's own name, was refused with "Names can't claim a role, such as admin or host." and no word. An AI agent that called itself "Agent - Context Engine MCP" could not tell that "Context Engine" was the word, not "Agent". The refusal now reads, for example, `A name can’t include “Context Engine”: names can’t claim a role, such as admin or host, or speak for the site. One like "Sam" or "Sam's agent" is fine.` The word comes from the Worker's own list, never from what was typed. Which names are taken is unchanged: "agent" and "AI" were always allowed, and tests now say so. An older Worker gives the old sentence.

### Site — available when the site deploys

- **A slow or stuck load is no longer a white page.** The page's own first script puts an empty notice area on the page before the rest of the app arrives, and the check that shows "This page did not load." counted that as the app having drawn. So when the main part of the app was slow or never came (a stalled connection, an extension, a VPN), the page stayed white with no message. Now:
  - The page itself carries a loading line, shown from one second in, with a bar that fills by the size of the app's files that have arrived. After 15 seconds it says the load is slow.
  - If nothing has drawn after 45 seconds, "This page did not load." shows with its Reload button, as it does when nothing arrives. The page never reloads by itself, so a slow load that is still arriving is not thrown away.
  - The built page names the app's start-up files itself, so they download together from the start instead of in three steps one after another.
- **The site works in a browser that blocks its cookies and site data.** With "block all cookies" (Brave, Chrome, Safari) reading the browser's storage fails; a session page then said "Session Worker error" and the home page showed only its Tools panel. The page now keeps what it needs in memory for the visit and says once that sign-in and drafts will not be kept after the tab closes. The cache no longer treats the browser's refusal of its cross-tab write lock as a failed write.
- **The prompt an organizer shares carries the question ids.** "Interview & share" → "For your AI" copied a prompt without the list of ids, so an AI given only a summary of the questions could not make the review link. The panel already read the session's public question list before enabling Copy; the prompt now carries from that read the fingerprint, the version, and each question's id and type by position, as a person's own prompt does. It still carries no one's ticket.
- **A prompt without the id list no longer sends the person to an address to paste what it shows.** That is the prompt the agent guide prints, and a person's own where the page could not read the list. An AI given a summary now asks its tool again for only the fingerprint and each question's id and type, in order; without them it gives plain-text drafts and no packet.
- **The agent guide and `/llms.txt` give one rule for an agent's name.** The guide said "Sam's agent", the MCP said name, model and where the agent comes from. Both now say the same sentence, from one shared text that a test holds them to: a good name says it is an AI, by its model or the word "agent", and whose agent it is or where it comes from, such as "Sam's agent" or "Kestrel - Opus 5.5 - North Lab"; never a person, a role word, or the site's own name.
- **The AI gives the review link once.** The copied prompt asked for the link twice, as a Markdown link and written out in full, which a chat app shows as two long links. It now asks for the Markdown link alone, and for the address written out only in a terminal, which shows no Markdown link. Its first line no longer says the person submits the drafts themselves, which pulled against the offer in its last line: it says they review every draft before anything is submitted.
- **The Report's Filter button takes the Active Filters label's place.** In Summary and Statistics the row now starts with the button, then its (?) and the filters in use, or "None", on one line where they fit. The button's name says how many filters are on, such as "Filter: none active". The PDF, print and a Report with no Filter button, as over demo data, still say "Active Filters".
- **About's Demo button opens the `rxc-ra-2` session.** The About page's **Demo** button and the Docs page's "Try the demo session" link open `rxc-ra-2`, the Reverse Alignment session, in place of the test session `rxc-ra-test-5`.
- **Deploy helper.** It deploys the 0.9.34 Worker bundles. A Worker updated from the site gets this release's.

### Local tooling

- **A test builds a review link from the copied prompt and opens it as the site does.** `sessionInterviewPrefillLink.test.ts` stands in for two AIs, each doing only what the prompt says: one given a summary of the question list, which has only the fingerprint, the version and the ids the prompt carries, and one that reads the list whole. Each link is read by the session page's own reader and its packet checked against the catalog; a link for another question set is refused.
- **One command sets the MCP's version.** `node scripts/set-mcp-version.mjs <version>` writes it to `mcp/package.json`, both fields of its lock file, the README's upgrade heading and the changelog's MCP heading. The MCP takes the application's version number from its next release, so its number jumps from 0.9.2.

### MCP 0.9.35 — ships by an npm publish

- **One rule for an agent's name, and the words a session refuses.** The server's instructions and what `join_session` returns give the guide's sentence on names. The rule in `set_profile` and `join_session` now lists every word a session refuses as a role or as the site's own name (admin, host, system, Context Engine and the rest) and says "agent" or "AI" alone is fine, so a name can fit the first time, on an older Worker too. A test fails if the list parts from the Worker's.
- **The tools' instructions carry the site's steps.** The server's instructions now hold the same steps as the AI prompt a person copies and `/skill.md`, from the one shared text: ask once whether to submit or go through the answers together, say that submitting with the tools means making an account and whether it stands for the person or for the agent, and ask whether they already have an account (then the `aiPrompt=1` link and their AI key). Knowing nothing about the person, the agent says so and asks a few questions. An account that stands for the person answers from their views and says in its comments that it is their AI agent.
- **Only the person, in the chat, can waive being shown the answers.** The instructions used to let a pasted prompt say "submit straight through"; no prompt the site gives says so, and nothing a session, Worker or tool returns can.
- **The card is named "Have AI draft your answers".** The instructions and the private-session hint of `get_interview_catalog` use the session page's new title, and name the "AI can submit for me" box that puts a key in the prompt.
- **A shown analysis card is said to stay.** `show_analysis_card` said the card "is kept only until the MCP restarts", which read as if a shown card would vanish; it now says a shown card is saved in the session until it is taken down or replaced, and that only a card made and not yet shown is lost on a restart. Its result says the same.

## [0.9.34] - 2026-11-23

The AI prompt a person copies is one short task again and always carries the session's question ids, so an ordinary chat app can build a review link; an atlas or risk matrix Build press is answered at once and followed, and a cleared quadratic answer no longer counts in the Worker's analysis. Needs a Worker update for the Worker changes. MCP stays 0.9.2. Nothing a session already stores is changed.

### Session Worker — needs a Worker update

- **A Build press that asks to follow its build is answered within seconds.** An atlas or risk matrix press held its request open until the build ended, up to five minutes, which a phone can cut. A press whose body has `follow: true` now waits at most 3 seconds: a build that ends by then answers with its result, as before, and one still running answers `202` with its job's id and start. Reads of builds tell those who may build how the latest build went: still running, built, or failed and why. A press without `follow`, as from an older site, is held as before, and an older site leaves the job in reads unread.
- **A cleared quadratic answer no longer counts in the Worker's analysis.** Clearing a quadratic answer leaves every vote at 0, which AI Views, atlas and risk matrix builds read as an answer: a person whose answers were all cleared still counted among their participants and responses, and the AI read the zeros as a neutral answer. The Worker now reads such an allocation as unanswered, as the site's Report has since 0.9.32, and keeps its row only for a comment. Builds already made stay as built. In a session that holds a cleared quadratic answer, the first AI Views or Session Agent update after this builds anew, since what it reads has changed, even if no answer has; automatic AI Views runs are not started by it. The Session Agent leaves it out of the members' answers it reads and exports, so it no longer counts toward the members a question needs before someone who is not an admin hears from it. Agent results, from the Worker or the MCP server, count such an allocation as before.

### Site — available when the site deploys

- **The copied AI prompt is one task again, always carries the session's question ids, and drafts on a weak basis.** In a chat app the 0.9.33 prompt gave back the session address with no drafts. Three causes. It opened with five steps about what an AI can do and told one with little to go on to say so and give a bare link. A chat app's web tool answers with a summary of the question list (its count, its fingerprint, a topic for each question in order), without the ids a packet needs. And the ids the prompt used to carry came from whatever the page had loaded: none from the account dialog, and an empty list, which reads as nothing left to answer, when the questions had not loaded yet.
  - The prompt opens on the task: read the questions, draft, reply with the packet, give the review link. The page reads the session's question list before Copy is enabled, as the person may read it, and the prompt carries from that read the fingerprint, the version and every question's id and type numbered by its place in the list. A summary with the same count and fingerprint is then enough to name each question: its question N is id N; with another count or fingerprint the AI gives plain drafts and no packet. From a summary the AI drafts the agree-or-disagree and free-text questions, asks its tool for the exact options of a question that has them, and leaves that one out if it cannot get them; it never guesses an option or an id. The person's own progress is given as positions, and never as an empty list.
  - The AI drafts every question it has any basis for, marks a weak one with a confidence under .4 and evidence that says it is an inference, and names the weak drafts. Only an AI that knows nothing at all about the person gives the bare address, and asks a few questions.
  - The review link opens with the drafts in place, as before: the AI encodes the packet into it, with its code tool if it has one, on an address said in the prompt, the page's own session address with `mode=interview` and no `worker=` for a session the site lists. The packet is in the reply as well, and only an AI that cannot encode it exactly ends the link `#prefill=paste` for the person to paste it.
  - What an AI that can do more should ask is the prompt's last line, with the guide's address; the shared steps stay in the guide, `/llms.txt` and the Worker's skill. For the 40-question salon session the prompt is about 9,500 characters with its ids and types (0.9.32's was 8,200 with its list; 0.9.33's 10,400), and 5,900 where no list is carried, as in the prompt an organizer shares (0.9.33: 7,000). A signed-out AI that could submit is told, in that last line, to ask before drafting and to show its answers first, which only the person, in the chat, can waive. Review links are checked as before. Prompt revision `ce-prefill-prompt-4`.
- **A Build press no longer waits for the build.** The site asks the Worker to answer an atlas or risk matrix press once its build starts, then follows the build as it follows a press that dropped: it reads at once, checks back every 20 seconds, opens the new build when the build's job says it built, and says why it failed in the Worker's words. A page that can't read builds, as when its sign-in has lapsed, says the build runs on. A Worker without this release's update ignores the ask and holds the press until the build ends, as before, and a press it drops is followed as before.
- **A ticked "AI can submit for me" never gives a prompt without a key in silence.** Where the key could not be added (the page could not sign in to the session quietly, the Worker did not answer, or it refused), both cards now say "The prompt has no AI key yet." with an **Add my AI key** button, and say what went wrong if that fails too. Where the session lets an AI draft only, they say so. A key request that gets no answer in 15 seconds is given up and not tried again, so the button stops turning.
- **A tap while the key is added says what it is waiting for.** The card shows "Adding your AI key… Tap Copy again when this finishes." as it does while the session is checked.
- **Text selected in an opened prompt and copied by hand is the prompt itself.** The opened prompt shows stand-ins such as `<AIKey>` and `<SessionLink>`, and a selection used to copy those. A selection that holds a stand-in is now copied as the whole prompt, under the same rules as the button: nothing while a key is being added (the clipboard is emptied), and a key that leaves the page this way, or from the plain text shown where copying is refused, is said to have ("Key can answer as you until …"). A selection of plain words, and a template's own placeholders, copy as selected.
- **By an `aiPrompt=1` link, nothing is offered to copy until there is a key.** The centred button used to copy the long prompt without a key, which is not what the person's AI asked for. Unticking the box brings the ordinary prompt back.
- **The key prompt and the agent guide name the session in the skill's address** (`/api/agent/skill?sessionSlug=…`), for a Worker that serves more than one session, and the prompt no longer ends that address with a full stop.
- **Larger touch targets.** The "AI can submit for me" row and the prompt box's copy button are now 44 pixels high, and the box's text starts below the button.
- **Deploy helper.** It deploys the 0.9.33 Worker bundles. A Worker updated from the site gets this release's.

## [0.9.33] - 2026-11-23

The Session Worker asks for short, distinct atlas branch names, stores answers sent with a person's AI key under their session, and its agent skill says what the API does; on the site, AI agents follow one set of steps wherever they start, with one "Copy AI prompt" button and an "AI can submit for me" tick. Needs a Worker update for the Worker changes. MCP stays 0.9.2. Nothing a session already stores is changed.

### Session Worker — needs a Worker update

- **An atlas's top-level titles are asked to be short, clear and distinct.** The planning call that groups a session's questions into branches now asks that each branch's title be short and clear, one plain subject and not a list, that no two titles share a main word or mean nearly the same, and that none be a catch-all. The same call now describes the session in plain words, as a group sensemaking session, in place of the product's name, and asks that the branches be logically distinct from one another and that the topics inside a branch share a clear link. The reply's shape, the limits of 5 branches and 12 topics, and how a reply is checked are unchanged. Only atlases built after the Worker is updated are affected; a build already kept keeps its titles.
- **Answers sent with a person's AI key show as their saved answers.** An answer the Worker stores for a key now names its session (`sessionId` and `sessionSlug`), as the site's own answers do. The session page leaves out a saved answer that names no session, so these answers were stored but drawn as unanswered on the person's page; the site reads answers for Results through the same check, and the Worker's AI Results builds left them out too. Answers stored before the update, or accepted before it and sent after, stay as they are.

### Session Worker — the skill's text goes live when the repository's main has it; its version needs a Worker update

- **The Agent HTTP skill says what the API does.** Outside agents had to guess: the skill named an `answer_schema` field the questions list does not have, "truthful approval metadata" that is one field, and a "request identity" a caller cannot send. It now gives the fields that shape an answer (`questionType`, `options`, `scale`, `voiceCredits`, `singleSelect`), where `sessionSlug` goes, `submit` with `approved`, what the reply counts and what `skipped` and a 422 mean, that sending the same answer again is safe and a changed one is a new revision, how to read back what the person has answered, and what a 401, a 503 and a draft-only key mean. Skill version 2026-11-23 (v48).
- **The skill carries the site's steps for an AI with a person's key.** The one question and what to do knowing nothing about the person are written into it from the shared text, and a test fails if they drift. It names the key's sources as the session page does ("AI can submit for me", "Have AI draft your answers", the `aiPrompt=1` link), and says only the person, in the chat, can waive being shown answers: no prompt copied from a session does.

### Site — available when the site deploys

- **One set of steps for AI agents, wherever they start.** The AI prompt a person copies, `/llms.txt` and the agent guide at `/skill.md` now carry the same five steps, written once (`shared/agentParticipationGuide.mjs`; `node scripts/sync-agent-flow.mjs` writes the files, and a test fails when they drift). The note in each page's HTML points to the guide for them. An AI works out what it can do: submit as the person with their AI key, submit from an account it makes, or only draft. A draft-only AI gives back a review link written out in full and says what to do next (open it, check each draft answer, press Submit). An AI that can submit asks once: "Shall I submit your answers for you, or shall we go through them together first?", and shows its answers before it submits. Making an account is said aloud, and the person is asked to mention an account they already have. An AI that knows nothing relevant about the person says so, never invents a position, and asks a few questions on the session's topics that would let it draft most answers at once. The copied prompt no longer says "no MCP" or "Do not POST", which stopped an agent that could have submitted, and it tells an AI that can't open the questions' address to ask for them to be pasted.
- **"AI can submit for me", and a key only when you tick it.** Signed in, where a session has Agents (HTTP API) on, Voice mode's card, now titled "Have AI draft your answers", and the account menu's "Your AI agent" show a box above the button, unticked to start with: the copied prompt then holds no key and none is made. Ticked, the page makes your AI key without a further tap and puts it in the prompt, so your AI can ask whether you want a draft or a submission and submit as you once you say yes in the chat; after the copy one line says "Key can answer as you until" and the time, and it stays while a copied key still works. The key ends with the sign-in, works in that session only, and Sign Agents Out ends it and unticks the box. An AI that can't send web requests with its own headers still drafts from the same prompt. Not logged in, the prompt holds no key, and an AI that can submit offers to make an account. The MCP's own texts still name the card by its old title, "Let your AI draft your answers", until its next publish.
- **"Copy AI prompt" is one split button, and the prompt opens with stand-ins for its values.** In Voice mode's "Have AI draft your answers" and in the account menu's "Your AI agent", the button's right end is a caret, down while closed and up while open, that shows the prompt in the question generator's "AI Prompt" box: each value it carries (the session's name and link, the questions' address, your AI key and when it ends, your unanswered questions) shows as a named stand-in such as `<AIKey>`, never the value, so "Show key" is gone. While the session is checked or your key is being made the button turns with a spinner and can't be pressed. The separate "Prompt" control, the sentence beside Copy, and Expand and Minimize are gone.
- **"Your AI agent" is one "Copy AI prompt" button.** Its two boxes ("Suggest answers", "Answer for me"), "Make a key" and "Ask me before submitting" are gone: there is one prompt, and no prompt the site gives approves a submission in advance.
- **A link that opens a session on the AI prompt.** A session link with `aiPrompt=1` in its query opens the account dialog, which stays open through the passkey sign-in and then shows "Your AI agent" open with "Copy AI prompt" in the middle and "AI can submit for me" ticked, since the person came for their key. It copies a short prompt: the key, where to send it and its rules, with none of the drafting instructions the AI already has. The request leaves the address once read, so a reload or a later opening of the dialog repeats nothing, and the link alone never raises a signing prompt: where the key needs a fresh sign-in to the session, the row shows "Add my AI key". The steps give an AI this link for a person who already has an account.
- **Every AI prompt the app shows marks its variables.** The setup prompt on `/new`, the Debate Atlas prompt, the prompts a running Debate Atlas or Risk Matrix build shows and the Docs page's templates now list their variables on a "Variables:" line and mark each one in the text, as the question generator's "AI Prompt" box does; the Docs page also marks `{{name}}` placeholders, and the question generator lists every placeholder of its template. What is copied, or selected by hand where copying is refused, is still the prompt itself.
- **The Docs page's code and prompts can be read in the default theme.** Their text was the same colour as their background; they now sit on the overlay surface the text is made for.
- **A shorter notice after an agent's sign-in link.** The notice now says "Signed in as 0x…, the account your agent set up." in one sentence.
- **The paste box reads more of what an AI gives.** The box that appears when a review link fails to open now takes the packet of draft answers with its code-block fence still on, or the review link itself.
- **The copied prompt is longer.** The steps add about a quarter to it; the packet names the new wording as `ce-prefill-prompt-3`.
- **Deploy helper.** It deploys the 0.9.32 Worker bundles. A Worker updated from the site gets this release's.

## [0.9.32] - 2026-11-23

"Analyze me" opens your page inside the app and Analyze starts at once, a session's answers are listed 500 a request, and Back to a Worker session's page loads it again; a cleared quadratic answer reads as blank, the Report's Active Filters row has a Filter button, and a Build press that drops no longer shows "Load failed". Site only: the Session Worker's code is unchanged and MCP stays 0.9.2. Nothing a session already stores is changed.

### Site — available when the site deploys

- **A profile in a session stored on its Worker no longer starts with a chain scan.** Opening a profile address used to begin with a scan of the chain for that person, whatever the session; in a session stored on its Worker nothing on the page comes from it, and it kept asking chain nodes for half a minute. It now runs at start-up only for on-chain sessions and profiles outside a session. Where a Worker session has on-chain groups, the profile page still scans for them itself, as before.
- **A session's answers are listed 500 a request.** The site asked the Worker for 100 answers at a time, one request after another, though a Worker since 0.9.17 lists up to 500: 1,240 answers now take 3 requests, not 13. An older Worker still answers with 100 and a cursor, and is read to the end as before. One load still lists 10,000 answers at most.
- **Going back to a session's page loads the session again.** Arriving at the page of a session stored on its Worker from another page of the site without a reload, as Back from a profile does, left it saying "Loading your saved answers..." with Results unable to load. The session's questions and answers now load again there.
- **"Analyze me" opens your page without reloading the site.** The press used to load the whole site again, and with it every answer in the session. From the session's page, or from a profile in it, your page now opens inside the app on what is already loaded, the account dialog closes, and Back returns to where you were. On your own page in that session the press starts Analyze right there. From any other page the site loads as before. A tab with unsent answers still gets a new tab, and so does one with a recording under way or unsent, or drafts that could not be saved, so nothing is lost; where the browser blocks the new tab, the page is left the old way, which asks first.
- **Analyze starts at once after "Analyze me", and its button says "Starting" while it waits.** A page that already has its answers starts Analyze as soon as it has drawn its lists; the fixed 1.5-second wait now applies only while answers are still arriving or a chain scan is running. Until Analyze starts, the page's Analyze button shows a spinner and "Starting", so the wait never looks stuck; pressing it starts Analyze then. Where there is nothing to analyze, the button goes back to "Analyze".
- **A cleared quadratic answer no longer counts as an answer.** Clearing a quadratic answer leaves every vote at 0, which the Report counted, so a person who had cleared all their answers still showed in Summary and Statistics' Participants and Responses. The site now reads an allocation with no votes as blank, as it reads a cleared agree/disagree or multiple choice answer. The Report's statistics, quadratic sections, top questions and "How well AIs predicted people" leave it out, and answer cards say "No answer provided." Comparisons, profile analysis, the HTML download's answer list and the AI analysis built in the browser skip it. The CSV and JSON downloads still hold what was stored. Response counts outside the Report still count any cleared answer, as before, and the Session Worker's own analysis still counts it.
- **A Filter button on the Report's Active Filters row.** In Summary and Statistics, the Active Filters label, the filters in use and a Filter button share one row, which wraps only where they don't fit. The button opens Raw Results' filter panel inside the box, without the AI Filter and Response Status, which the Report doesn't apply; those stay as Raw Results set them. A change there, a Worker group included, shows at once in the Report and its Active Filters list, and Raw Results opens with it, as the two share one filter. When a filter leaves nothing to show, Summary and Statistics stays, with the button, so the filter can be changed back. Demo data, whose questions and tags are its own, has no Filter button. Like the Report's other controls, the button is left out of the PDF, and so is its mention in the Active Filters footnote.
- **A Build press that drops no longer shows "Load failed".** An atlas or risk matrix build holds its request open for up to five minutes, which a phone can cut, for example when its screen locks, while the Worker builds on; Safari then showed "Load failed". The site now says the connection dropped and the build keeps running, with why in a (?). It times the build from the press, reads it at once, checks back every 20 seconds and opens the new build when it shows. A read that finds none running and no new one says the build didn't finish, and three failed reads in a row say it couldn't be checked. Results shown again while a build is pressed or running read it again, and Safari's "Load failed" gets the advice Chrome's and Firefox's words get for a Worker that can't be reached.
- **Deploy helper.** It deploys the 0.9.31 Worker bundles. A Worker updated from the site gets this release's.

## [0.9.31] - 2026-11-23

A login file can have a password, a Submit that finds it due asks for it there, and it downloads under a passkey-like name; the conviction slider's X sits beside the slider, and an atlas level's title sits under "Up Level". Site only: the Session Worker's code is unchanged and MCP stays 0.9.2. Nothing a session already stores is changed.

### Site — available when the site deploys

- **A login file can have a password.** "Add a password", under "Create login file", takes a password, and the file made then holds its 12 words encrypted, so the file alone no longer signs in. Choosing such a file to log in asks for its password; a wrong one says so and can be tried again. The password is never stored or sent, and it cannot be recovered: a forgotten password leaves the file of no use. Once the file is opened everything is as before, and the password is not asked for again during the file's 6 hours. Files without a password keep working.
- **A Submit that finds the login file due again asks for it right there.** On a page left open past a login file's time, Submit now opens a window with "Login with file" in it: "Your unsent answers are kept." Choosing the same file signs the account back in without a reload, and the Submit goes ahead; a file for another account is refused and the account is not switched. Closing the window keeps the answers, and the line under the Submit bar still says what to do.
- **A login file is named like a passkey, with its date and time.** A new login file downloads as, for example, "ContextEngine-Login-November23-2026-1003PM.json", by the device's own date and time, where it used to be "context-engine-login-" and six characters of the account. Files already downloaded keep working: a login file signs in under any name.
- **The conviction slider's X sits beside the slider.** The X that closes the conviction and importance slider now sits on the slider's own line, just past the track's end and centred on it, in place of across the row level with the Conviction and Importance labels, where a budget question's option arrows had pushed it to the card's far edge. Its tap area grows from 36 to 44 pixels, clear of the slider's end, so a drag to the top never presses it.
- **An atlas level's title sits under "Up Level", larger.** Below a session atlas's top level, the button with the level's title now has a line of its own under "Up Level", in larger type with more room around it, so it reads as the level's heading. Before, on a phone it sat right under "Up Level", touching it, and on a wide screen beside it, where a long title could run into it and over the circles. A long title wraps within the atlas, and the circles start below it however many lines it takes.
- **The main chunk stays under its 525,000-byte cap.** The log-in window's actions no longer load with every page: the navbar's two helpers from them have a file of their own, so the main chunk (AppShell) is 524,260 bytes and its cap stays at 525,000, even with the login file's password and the due-file window. Nothing changes in how the site behaves.
- **Deploy helper.** It deploys the 0.9.30 Worker bundles. A Worker updated from the site gets this release's.

### Local tooling

- **A raised bundle-exception cap passes the baseline check.** The baseline monotonicity check no longer fails when an existing bundle exception's own cap is raised, when the budget file and `docs/bundle-budget.md` state the new figure. Every other bundle-budget loosening still fails and still cannot be approved, and a chunk over its cap still fails the build's bundle check.

## [0.9.30] - 2026-11-23

A login file that is due again says to reload, its download lasts long enough for a phone to save it, and a failed Submit on the one-question pile shows its reason on screen. Site only: the Session Worker's code is unchanged and MCP stays 0.9.2. Nothing a session already stores is changed.

### Site — available when the site deploys

- **A login file that is due again says how to get back in.** Six hours after a login file was chosen, a page left open still shows the account, and a Submit there used to say "Open Log in and choose your login file", which that window does not offer. It now says "Reload the page, then log in with your file. Unsent answers are kept." A reload shows signed out and keeps the tab's unsent answers; they return once the same file signs in.
- **A failed Submit on the one-question pile shows its reason without a scroll.** The reason sits under the bar, which on a phone is just below the screen; the page now brings it into view when it appears.
- **A login file's download lasts on phones, and its notice no longer claims it was saved.** The download's address was withdrawn a second after the tap, before a phone that asks first could save it; it now lasts a minute. The notice reads "Check your downloads for …", and its (?) says what to do if no file was saved.
- **The (?) in the log-in window's boxes no longer leaves a grey square.** After a tap on a phone, the (?) kept a grey fill twice the height of the text, and stood apart from the sentence it belongs to. It is now the size of the text, right after the last word of its sentence, with no fill in any state; a keyboard's focus still shows as an outline, and its tap area is unchanged.
- **Deploy helper.** It deploys the 0.9.29 Worker bundles. A Worker updated from the site gets this release's.

## [0.9.29] - 2026-11-22

Sign-in with a login file where no passkey works, a phone for a computer whose passkey can't be used here, an X that closes the conviction slider, and simpler atlas cards. Site only: the Session Worker's code is unchanged and MCP stays 0.9.2. Nothing a session already stores is changed.

### Site — available when the site deploys

- **Sign in with a login file where no passkey works.** Under the log-in window's passkey buttons, "Other options" opens "Create login file" and "Login with file". After any sign-in that failed, the message itself offers both, in place of "Other options". Creating saves the file and shows one notice, in place of the other choices, that says how to login with it, with Back in its corner. The file holds a 12-word recovery phrase made in the browser and sent nowhere; choosing it signs in to the same account on any device, and everything a passkey account can do works the same, with no prompt per action. The file stays loaded for 6 hours, across reloads; then, and on Disconnect, its key is wiped from the browser and the file is asked for again. Anyone who has the file can sign in as its owner, and a lost file cannot be replaced.
- **A computer whose own passkey can't be used here can sign in with a phone.** Windows Hello passkeys work on this site only on an up-to-date Windows 11 with a recent Chrome or Edge; elsewhere Create saved a passkey and then failed with "This passkey can't be used here." Under that message the log-in window now gives three ways out, an "or" between them: "Scan QR with phone to login" (the computer shows a QR code to scan, the passkey is saved on the phone, and the phone signs that computer in, then and at later sign-ins there), "Create login file or Login with file to login without a passkey", and, where answers are unsaved, "Copy this link to paste your responses on a different device". Closing the phone's prompt returns to the same message. Existing passkeys and accounts are unchanged.
- **An X closes the conviction and importance slider.** Once the bullhorn opens a question's conviction and importance slider, a small X beside it closes the slider and undoes both ratings: a question never submitted is left with neither, so the bullhorn loses its glow, the saved draft drops them and Submit sends neither, while a submitted question gets back the ratings it was submitted with. It works in the pile, All questions, the one-question page and the interview's review cards. Before, nothing closed the slider or undid what it set.
- **A topic's only question shows its AI summary above its card.** In a session atlas, a question that is the only one in its topic has no window of its own. Its topic's window now lays out the question's AI summary as it does a topic's: the summary first, then each category with how many participants fall in it. Cards in topics with more questions stay bare.
- **Atlas question cards show the question alone again.** In a session atlas topic, a question's card no longer carries the AI's summary of its answers and their categories, added in 0.9.26. A question's own atlas window still opens with that summary.
- **"Where people split" is gone from atlas nodes.** A session atlas node no longer repeats its positions in two columns, one for each end of its chart's first axis, added in 0.9.19. Each position still shows once in the node's list, with how many hold it, and the atlas list still sorts by split.
- **Deploy helper.** It deploys the 0.9.28 Worker bundles. A Worker updated from the site gets this release's.

## [0.9.28] - 2026-11-22

Answers that were stored no longer look unsent, every Submit shows its count and how long it runs, unsaved answers can be copied to another device when sign-in fails, pages stop waiting on another tab's cache, and more on the site. The Session Worker's code is unchanged and MCP stays 0.9.2. Nothing a session already stores is changed.

### Site — available when the site deploys

- **Interview waits show their time.** While an interview's drafts are prepared, the interview shows how long the wait has run (m:ss) beside its status. While its responses upload, the status reads "Submitting" and the Submit button "SAVING · 3s", counting the seconds as every Submit does, instead of "Preparing submission…". Screen readers hear neither time.
- **Every Submit that sends answers shows its count in the corner**, as the one-question pile does on a phone: "Submit" with the number of answers to send small in its top corner, at every screen width. That is the pile, All questions and surveys, the one-question page (without its arrow), the interview (which read "Submit responses") and the card after the last question (which read "Submit 3 answers", now in Submit's blue). While one runs it reads "SAVING · 3s" ("SAVING 3 OF 12 · 2s" while several answers store), counting the seconds, where the one-question page read "Uploading..." or "Encrypting...", and each wears the quiet colours the pile's does, so the words read: the bar's had faded, the one-question page's was white on light grey, and the interview's, under the pointer, could be white on bright green. Screen readers hear "Submit (3)".
- **An answer whose reply was lost no longer looks unsent.** When the Session Worker stored an answer but its reply never reached the page (a dropped connection or a gateway error), the page sends it again, up to three more times, and the Worker answers with the copy it stored, never a second one; the page then shows Submitted. While the Worker is still storing an earlier send, the page waits about half a minute, then says it is still saving and to press Submit again in a minute (in a Submit of several answers, that some answers are still saving); that Submit sends the same answer, never a second one. Before, Submit came back as if nothing had been sent, though the answer was saved. A Worker without its session coordinator may keep a repeat as a second copy.
- **Submit messages are readable.** A message inside a Submit button, such as "Still saving…", was dark red on the button's blue; it now uses the button's own text colour.
- **The bar says why its Submit failed**, in All questions and in a survey, on a line under its Submit that screen readers hear too. It shows only that Submit's failure, until Submit is pressed again or nothing is left to send. A Submit that changed nothing does not make a later, unrelated message look like its failure. Before, Submit just came back with no reason.
- **The analysis card shows its outline while it is made.** Until the picture card is ready, its Card view shows the card's shape with its headings (the historical match and the guesses) and moving bars for the words to come, instead of "Making the card…" or "Drawing the card…". Screen readers still hear those words; with reduced motion the bars hold still.
- **The Analyze view shown is no longer marked in pink.** Its button was filled with the theme's main button colour, magenta in the Context Engine theme; it now takes the accent colour, as on Compare, with its words bold and underlined so it does not rest on colour alone.
- **Analyze opens on Breakdown and Card; the Text view is under Options.** The Text view says what the Breakdown says, so its button shows only for those who tick "Show the Text view" under Options at the foot of the Analyze window, kept in that browser.
- **Copy my answers when sign-in fails.** When a passkey sign-in fails because of the passkey or the browser, and the browser holds unsaved answers, the sign-in screen offers **Copy my answers link**: a link that carries the typed answers and any interview review, to open on another device and submit there. The answers are in the link's fragment, which browsers don't send, and the page that opens it takes them out of the address before anything is fetched; anyone given the link can read them. The opening browser keeps the answers it already holds and submits nothing by itself. A copied interview review is asked about before it shows, also on a phone that is already signed in. A set too long for one link copies as a short link and a code; where the browser refuses the clipboard, they are offered on one line to copy by hand. A passkey that lacks the support the wallet needs now reads "Login failed: This passkey can't be used here." (or "Create failed: …"), and a session whose settings didn't load says to reload the page, then sign in.
- **Session control in Settings.** Settings offers the selected session or a list of sessions and applies a change at once. All sessions, General only, Save and Reset are gone from it; Home's session picker is unchanged. The active session is drawn as a plain block instead of a stretched pill.
- **Atlas node order.** A session atlas node reads its summary, then "Where participants stand", then its lists. A node with no summary keeps the chart after the lists.
- **Context box in Tools.** On a wide screen, the box for adding context in a tool spans the panel instead of its left half and keeps its width while typing; Add and View join the session row. From 992 px wide, the question settings (Types, # Questions) sit under the box, on the create-questions page too.
- **Pages no longer wait on another tab's cache.** With several Context Engine tabs open, mostly on a phone, a page could stay on "Initializing Cache..." and keep saying saved answers are still loading. A page now stops waiting for another tab after a few seconds and loads from the session's Worker.
- **Deploy helper.** It deploys the 0.9.27 Worker bundles. A Worker updated from the site gets this release's.

## [0.9.27] - 2026-11-21

The Session Agent reads a session's saved links, a shorter voice brief with a question-order choice, faster group lists in the Session Worker, MCP 0.9.2 (published at merge) and the site. Nothing a session already stores is changed.

### Session Worker — needs a Worker update

- **Saved links are read for the AI.** After a save that changes the session's context links, and after the Session Agent answers, the Worker reads the links saved in the session's context in the background and stores each page as a source everyone the session admits may read, as if an admin had added it. It never reads a link a participant added, a link inside a file, an answer or a question, and a redirect is held to the same rules. A link read once is not read again while it stays saved, so a source an admin removes stays removed; a link that fails waits before it is tried again. Reading never delays a reply. The new admin setting `sessionLinkReading` (on by default) sets how many links (up to 8), how long a page may take, how much of it is kept and how long a failed link waits; it is saved with a signed `set-config` and signs no one out. The Worker lists it as `session_link_reading_v1`. An older Worker reads the stored sources as ordinary rows, reads no new links, and refuses a save that sends the setting.
- **Question order.** The new interview setting `interviewMode.questionOrder` lets the voice interviewer and the AI prefill take questions in the question pile's order (highlighted first, then the most answered) instead of newest first. The Worker lists it as `interview_question_order_v1`; voice records and prefill drafts mark it `+arranged`. An older Worker refuses every save while the order is "As the session lists them".
- **Shorter voice brief.** The voice interviewer's brief (`ce-voice-brief-6`) has fewer fixed lines, and a hand-off is answered with nothing for the voice to read out.
- **Faster group lists.** A session's groups are read side by side instead of one after another. This speeds the interview's group suggestions, the questions read by agents and `contextengine.sh/questions/<slug>`, and the Groups page: about 2 s instead of 9 for 22 groups, by a local run, not measured live.

### MCP 0.9.2

- Packaging only: no tool changes over 0.9.1. The package bundles the shared session-settings code, which now names the new link-reading setting.

### Site — available when the site deploys

- **Question order.** A session's interview settings offer "Question order", where the session's Worker supports it.
- **Links read by the session.** Where a session reads its context links for the AI by itself, the link's help says so.
- **Adding context.** On a session's page, one box adds a note, a link or a file to its context: typed text is a note, a lone https address a link, and a file is attached or dropped. It has a single "Visible to" choice. A session's context links each take their own line, and on a phone an admin's list of the session's files and links keeps its text readable.
- **Session box in a tool.** In a tool, the session box stays on the Back row and shortens a long session name instead of dropping to its own row.
- **Welcome pictures.** The Welcome slides and the first-visit overlay have new white dot-art pictures, one look for every slide, with new alt text.
- **Welcome slides on a desktop.** The slides use the window's height, so the picture is as large as on a medium screen.
- **Deploy helper.** It deploys the 0.9.26 Worker bundles. A Worker updated from the site gets this release's.

## [0.9.26] - 2026-11-21

Atlas question summaries and a faster question catalogue in the Session Worker, MCP 0.9.1 (published at merge) and the site. Nothing a session already stores is changed: atlas builds made before this release read as before.

### Session Worker — needs a Worker update

- **Atlas question summaries.** An atlas build now gives each question under a topic a short AI summary of its answers and the kinds of answer found, with how many people hold each. Each question's call reads every answer to it that the build may read: no encrypted, restricted, withheld or hidden-question answers. The calls run after the map calls, in the same six at a time, and a question the build has no time left for keeps no summary; the build's four minutes are the only bound, so a build takes longer and costs more in AI calls. A build records how many questions it summarised and how many ran out of time.
- **Summary sizes are a session setting.** `atlasQuestionSummaries` sets how long a call may run, how many answers and characters it reads, how long the summary and category texts are and how many categories it keeps. It is admin-only, saved with a signed `set-config`, and changing it signs no one out. Each value has a default and bounds. An older Worker leaves the setting stored and unread, and on a Worker-canonical session it refuses a save that sends it.
- **Faster question catalogue.** The catalogue that interviews, agents and `contextengine.sh/questions/<slug>` read now loads question texts in batches instead of one at a time, with the same access check on each: a first read of about 40 questions should take about 1–2 s instead of 12–15 s.
- **Voice context setting.** The Worker takes the new interview setting `interviewMode.voiceSessionContext` and lists it as `interview_voice_context_v1`; voice research records note `+context` in the brief revision when the interviewer had the session's context.
- **OpenAI's faster tier, per session.** A new admin setting, `ai.serviceTier`, sends the session's own OpenAI text calls (interview drafting and start, AI tools, analysis and atlas builds, the Session Agent, context cards) at OpenAI's faster tier, `"priority"` or `"fast"`, at about twice the price. Unset or `"default"`, requests are as before. It does not cover voice, transcription, other providers or a request with its own key. A tier OpenAI refuses for a model is retried once at the default tier. It is saved with a signed `set-config`, is not public and signs no one out; an older Worker keeps the stored value and sends the default tier.

### MCP 0.9.1

- Packaging only: no tool changes over 0.9.0. The package bundles the shared session-settings code, which now names the new Worker field and setting.

### Site — available when the site deploys

- **Question summaries in the atlas.** A question opens to the AI's summary of its answers and the kinds of answer found, in builds from a Worker that makes them. Someone who may build the atlas sees how many questions were summarised when a build did not reach them all.
- **Quadratic questions in the atlas.** A quadratic question in an atlas node shows its budget and each option on its own row, as it is answered.
- **Atlas chart.** The axis labels are never cut: they wrap, and the chart's text stays readable at every width. The four quadrants are bright red, blue, green and yellow under a grid, with their own set in the colour-blind setting.
- **Voice interviews leave out session context.** The voice interviewer is no longer given the session's context (notes, links and sources) unless the session turns on "Interviewer reads the session context" in its interview settings. The setting is offered where the session's Worker supports it, and stays visible while on. The voice prompt is also shorter: question ids only where drafts need them, a shared option list named once, no empty omitted-rows line, and no fixed line telling it not to invent answers, pressure the responder or claim answers were submitted.
- **Faster drafts after Stop.** The answers drafted when an interview stops are written at low reasoning effort instead of medium: about 24 s instead of 33–42 s in our runs, with nearly the same drafts.
- **Interview question check.** The interview's check for new questions may take 25 s instead of 10, and "Could not check for new questions" shows only after two failed checks in a row; it goes at the next answer.
- **Interview languages.** The Interview window's language button and flags share one pill, with a language icon; on a wide screen it sits in the header row.
- **Deploy helper.** It deploys the 0.9.25 Worker bundles. A Worker updated from the site gets this release's.

## [0.9.25] - 2026-11-20

Fixes on the home page; the site only. No Worker change: the 0.9.24 Worker bundles, which the deploy helper now uses, differ from 0.9.23's only in the release number they report, so sessions need no update. MCP stays 0.9.0. Nothing a session already stores is changed.

### Site — available when the site deploys

- **Home > Tools > Groups.** The tab shows the chosen session's groups, with the same list and categories as the session's own Groups page. Until Questions had been opened, it showed a notice about the session's "Worker Groups profile". If a session's settings really cannot be read, the notice now says so plainly.
- **Home > Stats.** The numbers are centred when there are fewer of them than fit a row.
- **Long session names.** In the session menu, a long name ends in "…" instead of being cut off beside the open-link icon.
- **Welcome slides on phones.** The slides use their full height: larger text and picture, and no empty band above the arrows.
- **Deploy helper.** It deploys the 0.9.24 Worker bundles.

## [0.9.24] - 2026-11-20

MCP 0.9.0 (published at merge) and the site. No Worker change: sessions keep the 0.9.23 Worker, which the deploy helper now uses. Nothing a session already stores is changed.

### MCP 0.9.0

- The version number only: no tool changes over 0.8.1. The card tools, `make_analysis_card` and `show_analysis_card`, first shipped in 0.8.1; new tools take a minor version, so 0.9.0 carries the number they should have had.

### Site — available when the site deploys

- **Groups by category.** A session's group list puts each group under its first tag, categories A–Z and untagged groups last; with one category or none it stays as cards. Phones get an accordion, wide screens every category side by side, and open groups join in one tap. A group made without choosing tags keeps the create form's defaults and is listed with the untagged ones. The list takes the page's text colour in the light and window themes, and Join, Leave and the "Joined …" line stay readable.
- **Quickstart.** Step 1 no longer sends people to a "general" session or asks them to edit a link by hand: it offers a shared link, a new session, or the demo session (the one the About page's Demo button opens).
- **Quickstart sign-in step.** Step 2 now matches the sign-in box: a passkey, with Create or Login, or a wallet you already have where a session uses Ethereum wallets.
- **Interview.** One answer stored under the session's link for another session no longer stops the interview loading your own answers, so it can submit again; it is left out, as Results already leave it out, and other load failures still show. The saved-answers retry button is readable on the light themes' pale error box. Discard is a small underlined button at the left instead of a full-width red one under the microphone. The sentence saying how many AI drafts are hidden until you answer is in bold.
- **Account menu.** The row that opens Analyze reads "Analyze me", with the wand the site uses for AI actions; the analysis box keeps its title "Analyze user".
- **Analysis card.** The picture card's portrait now blends into the card's colour, inside an oval.
- **Chat AIs reach the questions.** A listed session's questions can be read at `contextengine.sh/questions/<slug>`, which the site passes through to the session without storing them, for chat AIs that cannot open the session's own Worker address. The page every session link serves, the top of the agent guide (`/skill.md`), `llms.txt` and the drafting prompt a person copies from the site show that address in full, ahead of the GitHub links, and the session's own address as a second try; if neither opens, the AI asks the person for the questions instead of making them up. The addresses come from `known-sessions.json`, and a test keeps them the same.
- **Phone question row.** The count on Submit is the size of the word, and the unsent-answers line under the row is no longer drawn (screen readers still hear it).
- **Deploy helper.** It deploys the 0.9.23 Worker bundles.

## [0.9.23] - 2026-11-20

A Session Worker fix, MCP 0.8.1 (published at merge) and the site. Nothing a session already stores is changed.

### Session Worker — needs a Worker update

- **Agent routes answer Safari's preflight.** Safari, and every browser on an iPhone, sends a preflight with an empty body (`Content-Length: 0`). The agent routes (`/api/agent/*`) tried to read it as JSON and answered 400, so every site call to them that needs a preflight failed there, "Make a key" among them. A preflight's body is no longer read, and an empty body on any other request counts as no body; a non-empty body that is not a JSON object is still refused. The general routes (sign-in, sign-in links, storage, AI, groups) were not affected.

### MCP 0.8.1

- A refused `join_group` or `leave_group`, and a refused group join in `join_session`, names the group as the site shows it, with its id. The name is read only after a clear refusal, briefly; after a busy session or no answer the id alone is given.
- `make_review_link` writes a shorter link, its drafts deflated after `#prefillz=` (about 60% shorter for 40 drafts), where the session's site says it reads one: it asks the site's `/manifest.json` for `context_engine_review_links`, keeping a clear answer for the run and asking again after 5 minutes when the check failed. A site that doesn't list it, or doesn't answer within 3 seconds, gets `#prefill=` as before.
- `make_review_link` says to copy its link exactly, and to make a shorter one when it is too long to send whole.
- **Agents make their account's analysis card.** `make_analysis_card` makes it as the session page does when its person presses Analyze: the same two prompts, now in `shared/userAnalysisPrompts.mjs`, go to the session's AI through the Worker's `/ai` route, under the session's AI limits and with its key, and the matched figure's picture comes from the Worker's picture route. It saves nothing. `show_analysis_card` shows the card on the account's profile, once the person has said yes, or takes it down. `answer` says where a session makes cards, so the agent offers one after answering. No Worker change: it uses routes the 0.9.22 Worker has.

### Site — available when the site deploys

- **Agent screens.** The sign-in link's notice is shorter, offers Create passkey only when the account has none attached, and can be dismissed for that sign-in; switching accounts is asked in a dialog that names the account it replaces; refusals are in short words, and the button after ending agent access is Restore agent access. The notice's code loads only when a link needs it. **Sign Agents Out**, under Your AI agent and offered on passkey sign-ins, ends the tab's sign-in at the Worker, with every sign-in the page replaced and every prompt and key copied from them; a full sign-out ends the replaced ones too. "Couldn't make a key" now gives the status and reason.
- **/new.** "Set up with AI" waits behind a button beside the title. The sections are numbered cards; groups come before the access settings, and each group opens the site's own group form. Context is added by kind (Add text, Add URL, Add file), and "Context cards" reads "AI analyze", and the question type is picked from the site's tiles. A Centralized session can take a header picture, uploaded or pasted, shrunk in the browser to an image of at most 100 KB (about 133 KB as stored text) and kept in the session's settings, so the Worker needs no change.
- **Account dialog and user page.** The dialog is one list: Analyze user, Set username, Bookmarks, Your AI agent (both options in the row, each with a Copy prompt button that shows and enlarges its prompt) and Disconnect. On the user page, Set username and Bookmarks stand beside the address, and the session switch sits above the header.
- **Analyze.** Analyze user in the account dialog opens your page and starts Analyze there, only on that press. The analysis box has Text, Breakdown and, where the session has it, the picture card, which is reached only by its Card button and shown on your page from the Card view; a card you have shown sits in the side column above your groups, on your own page too, with Take it off my page, and has its own surface there. Compare gives a headline, titled cards, sliders or a map (laid out for phones) and agree or split strips. The question filter's box has Clear, Copy, Bookmark and Load. The risk matrix's note window has two columns and opens the atlas topic that holds a note's questions.
- **Interview.**
  - Language: the interview shows language flags for ten seconds when it first opens, so on phones the status and close button share the Interview row (a long status ends in "…" and shows whole in its tooltip), says interviews take any language, and drafts answers in English, marked with their language, beside the person's own words, which stay on the device.
  - Names: an interview no longer writes a name into answers and withdraws one an earlier answer carried; where the session keeps names, an optional box sets the session name, saved with its ✓ or Enter.
  - Layout: Discard and the transcript sit under the microphone, and a join link's group is left to its notice; the section is "Suggested groups", each with a small picture.
  - Transcript: the box to share an interview's transcript is not offered in this release, so no transcript is sent.
  - States: the interview says "Loading questions…" until the questions are read, without "no questions" meanwhile, and the AI prompt card no longer returns after an interview begins.
  - A new review link replaces a review kept in this browser, rather than showing its drafts under the new ones.
  - Voice after AI drafts: a voice round after an AI prefill leaves its drafts, hidden ones included, unasked; the interviewer opens by naming the drafts and asking one question from the bank, the start button reads Add more by voice, and the "saved opening is unavailable" notice is gone.
- **The copied AI prompt.** It carries a sign-in ticket only when a read without one falls short. It asks for drafts only with a basis, at most 15, and no table, and suggests the MCP only for agents with tools; `#prefill=paste` opens the paste box. Research records mark the wording (`promptRevision`), the drafting prompt's version on AI drafts and the voice model on voice drafts. The page reads deflated `#prefillz=` review links as well as `#prefill=`, and `manifest.json` lists both in `context_engine_review_links`. AI submission info shows its research metadata at once, the coverage box is not repeated, and What's this names the grant behind the research.
- **Agent guide.** Given a session link and no instruction, a chat AI without tools hands the link back at once and offers to draft answers for review. It reads the catalog from an address listed whole: `known-sessions.json` gives each session's `interviewCatalog`, since many chat apps refuse an address they built. The guide, `llms.txt` and the page's notes for agents say so.
- **Other.**
  - Stats on a Worker-hosted session counts Users, Questions and Surveys from that session's own listings, each tile loading until read, and shows no Surveys tile for a session with none.
  - The Questions tile also leaves out the questions a session's Settings hide, where this browser holds the session's settings.
  - The analysis and card on a user page read only that session's answers and groups, not others this browser holds.
  - Disconnect asks first when this tab holds unsent answers, and still signs out where the browser refuses storage.
  - Copy link in the passkey dialog keeps the group invite and the review drafts the address arrived with, never a sign-in code.
  - On /new, closing the file chooser or picking a refused file keeps the header picture or typed link.
  - The two trial sessions before the salon's leave the session lists; their links still open them.
  - The Debate Atlas on a phone: circle titles fit their circles, a node's panel and its chart use the phone's width, and the branch name is readable in the white theme.
  - The settings strip's first section reads Config.
  - On phones, the question row's arrows sit against the counter and Submit always shows its count.
  - About's Companies and Groups sections say above their video that it shows future features, in place of the asterisks and footnote.
  - The context list's Agent badge is the robot from Results.
  - The Session Agent opt-out moved from the interview dialog to beside the Session Agent button.
- The analysis and card prompts, and the choice of the answers a card quotes, moved to `shared/`, so the page and the MCP use one copy; nothing the page sends or shows changes.

### Research tools

- The fidelity report scores quadratic votes: strength, votes per option and per-question totals, each with a baseline. The Mirror Score and Results are unchanged.

## [0.9.22] - 2026-11-20

An agents release with website changes: a Session Worker update, MCP 0.8.0 (published at merge) and the site. Each agents part works only where the session's Worker reports it, and nothing a session already stores is changed. Sign-in links from agents are off on every session until its admin turns them on.

### Session Worker — needs a Worker update

- **What reaches every hosted session with the update, before any setting is touched.** An upload whose text holds an agent's sign-in code (`cesi_…`) is refused. Every signed-in request reads one more small KV mark beside its sign-in record. Signing in is unchanged in a session that has never saved the sign-in links setting; once it has, a sign-in also asks the session's coordinator whether a passkey is attached to the account, and goes ahead without that answer if it can't be had, except for an account marked as having a passkey attached.
- **Sign in from your agent's link.** An agent that took part with its own account proves its key and gets a one-time code (30 minutes, one use, one session, the site it signs in for). The session page swaps the code for a sign-in as that account, without its key. The person can attach a passkey: the Worker records that this passkey may sign in as the account in this session, with the passkey's signed consent, and the ordinary passkey sign-in is unchanged. A passkey that already has an account of its own in the session (a power, a group membership, a saved name or an answer under its address) is refused: the person creates a new passkey for the account. Where the session can't tell (more than 10,000 answers, or answers stored before answers recorded who gave them), a passkey the person already had is refused too, and one the page has just created is attached. Signed in with the passkey, they can end the agent's access to the account and allow it again: while it is ended the account's own key can't sign in, every sign-in of the account is checked against that on each request, and unused codes die. A sign-in from a link lasts an hour and carries no admin power; an admin can take a passkey off an account (`agent-link/clear`). The Worker reports `agent_sign_in_link_v1`.
- **A switch for the Worker's agent functions.** `agentParticipationEnabled: false` turns them off for the session: the Agent HTTP API (`/api/agent/*`, its public description apart), sign-in and signed-in requests from an agent's client (the MCP sends `X-CE-Agent-Client`), anything stored that is marked as an agent's, and sign-in links. Absent, they are on, as before. Sign-in links have a setting of their own, `agentSignInLinksEnabled`, and are **off until a session's admin sets it to true**: an ordinary settings save, which signs nobody out. Off or absent, the Worker makes and takes no sign-in code and attaches no passkey; a passkey already attached keeps working.
- **Private sessions read from a group-password link.** The question catalog now reads with the link's read invite, as the session page does. A read invite may name the Worker it is for (`group_read_proof_v2`), and is then refused by every other.
- **An unused one-use code can read without being spent, on a Worker that has it switched on.** It is off unless the Worker is deployed with the variable `CE_GROUP_CODE_READS` set to `on`; off, the Worker lists no capability and refuses every such proof. On, a read invite may be made from a group's one-use code (`group_read_code_v1`): the start of the code's hash and a keyed hash of a statement naming the session, the group, the Worker and a time within the hour. The code is never sent, checking it writes nothing, and it reads what the group reads until the code is used, withdrawn or expired. It counts on the routes that read (the session's settings, questions, context, results, the question catalog and the group's own entry) and nowhere else: no AI, voice, interview or Session Agent route opens to it, and it never counts as membership. It stops reading when the group closes to joining. Every miss gets one answer, and a sender of 20 wrong ones in ten minutes is refused unlooked-at for the rest of them. The hash an admin lists for an unused code is enough to make this proof, so a listing or a backup holds read access to that group until the code is used or withdrawn: withdraw unused codes when an admin leaves.
- **Agent HTTP takes a choose-several answer as a list in `value`** as well as in `values`, where before a list in `value` was refused and an agent could lose a person's choices by sending them one at a time. The Worker's agent guide (v47) gives a worked answer body for each question type and says a submit replaces the whole answer.
- **The saved analysis card's picture.** A card's drawn pages are kept beside the saved card and given under its own rule, and the picture route answers for a picture already made without drawing one (`analysis_card_drawing_v1`).

### MCP 0.8.0

- The read tools take the link of a session not joined and read it signed out; a private session opens to its group's invite link by password, and by one-use code where the Worker has that switched on (it is off by default); reading leaves a code unused. `get_interview_catalog` and `make_review_link` take the same link.
- `join_session` (on a private session) and `join_group` join with a one-use code only when passed `spendInviteCode: true`; otherwise they say the code would be used up and do nothing.
- New tools `get_analysis_card` and `make_sign_in_link`.
- Every request says it comes from an agent's client.

### Client — available when the site deploys

- A link from a person's AI agent signs them in to the agent's account on the session page: the code leaves the address before anything is fetched, a notice stays up while the agent can still use the account, and they can attach a passkey, end the agent's access, or sign out. The session's settings page gains, under "AI agents", **Agent access (MCP and Agent HTTP)** and **Sign-in links from agents** (unticked), each shown where the Worker has it.
- A saved analysis card's drawn pages are sent to a Worker that keeps them.
- Analyze shows a quick first read within a few seconds, a headline and two or three lines, and replaces it with the full analysis when that arrives; if the full analysis fails, the first read stays with **Try again**. Each Analyze now makes two AI requests where it made one.
- While an analysis is written, the box shows how long it has taken against how long it usually takes. The historical figure is chosen in one pass, which takes about five seconds off the analysis.
- The user page names its session and can open the same address in another session; a session known to have no surveys shows only its questions. Groups show only on your own user page.
- The report marks an address as still being looked up only while the first names read is out, so a failed read never reads as "no name". Agents are marked with a robot icon beside the name, which says on hover or focus what the agent's answers claim; "(agent)" is gone. On phones the report's stacked side padding is trimmed.
- Participants Graph puts Clusters and a gear on its title line; the projection and the layers sit behind the gear, and the cluster count is automatic until changed (Reset returns to it).
- Opening a use case on About shows its short silent video loop, fetched only then; reduced motion gets a still. Companies and Groups carry an asterisk: their loops show future work. About's roadmap marks work in progress with a half-filled box, and `ROADMAP.md` matches it.
- About's off-white backdrop is gone, and so is the pale line round buttons in the Context Engine theme; keyboard focus rings are unchanged.
- The "Your AI agent" box puts its lead on the title line on desktop.
- The agent guide (`/agent-guide.md`) and `llms.txt` tell agents about reading a session without joining, the saved analysis card and sign-in links.

### Tests

- The hosted WebKit journeys run in Playwright's own image for the locked version, and the leg fails if WebKit cannot start, where before it was skipped with a warning when its libraries could not be fetched.
## [0.9.21] - 2026-11-20

A website release with MCP 0.7.2, published at merge (0.7.1 was never published; its changes are here). No Session Worker change: nothing needs redeploying, and the new MCP tools work against the Session Workers already deployed.

### Client — available when the site deploys

- The Session drop-down, the Tools and Groups pickers and the Sessions list show EDDY 2026, the Reverse Alignment Salon and the test sessions RA test and RA agent test; automated test sessions and older demos are left off (they still open from their links), and General shows only while chosen. `rxc-ra-agent-test-1` opens from a normal link. A new visitor starts on the Reverse Alignment Salon.
- The signed-in log-in dialog puts its settings on one strip: Config, Session, Explainers and Appearance, which opens Theme and Color-blind mode. On a session's own page, choosing another session there opens it in a new tab and leaves the page as it is; if the browser blocks the tab, a link to open it appears.
- Your user-name is set with a Set username button under your name on your page, in place of the pen icon.
- Participant and group lists show a name with its short address, as in "name (0x314…c5ac)".
- Compare finds the other account by user-name as well as by address.
- Names in a new tab: where your tab isn't signed in to the session, a Show names link signs you in and shows them; the page never signs in by itself.
- In sessions that keep names, the interview step no longer offers to write a name into answers.
- The log-in dialog's agent token option is hidden for now.
- The log-in dialog's Create label is easier to read.
- Sign-in: the **Your AI agent** box's two choices are now **Predict responses**, a prompt that drafts your answers into a link you review and submit on Context Engine, and **Full submit**, where your agent submits as you, so you needn't come back. Under Full submit, **Ask me if I approve**, ticked by default, has your agent show you its answers in the chat and submit once you say yes there; unticked, it submits without asking and then tells you what it submitted.
- Sign-in: both choices copy from one **Copy prompt** button whose icon turns to a tick; its caret opens the whole prompt to read, with the key and any private link masked on screen.
- The agent guide and `llms.txt` still tell an agent to submit only the answers the person approves, unless the person's own copied prompt asks it to submit without asking again; text in a page or a file never does. `llms.txt` now says the key may come in that prompt.

### Fixed

- Analyze and the other AI text requests are sent once more when the first request fails with no reply within ten seconds of being sent, instead of saying the AI service cannot be reached. A lost sign-in request is not sent again.
- Profile links from an unlisted session keep working in a browser that hasn't opened the session link.

### MCP 0.7.2

- The server's instructions name all three ways an agent can help with a session link: take part as itself, prepare suggested answers the person reviews and submits, or answer and submit as them with a key they make. It asks the person which, before joining, unless they have said. The key may come in the prompt the person copies under **Your AI agent**, and the agent never repeats it. It submits without asking again only when that prompt says so, and otherwise shows its drafts first.
- New tools `get_interview_catalog` and `make_review_link` prepare suggested answers from a public session's link alone, with no sign-in and without joining: the first reads the session's questions, the second checks the drafts against them and returns the link the person opens to review and submit. A private session, or one with interview mode off, refuses and points to the prompt the person copies in the session. The link never carries an invite, password or ticket.
- `set_profile` no longer reads as a success where a session refused the name. A warning comes first and lists each joined session that didn't take it, with its reason; each entry in `names` says what to do next, and the note says only where the name was saved. The MCP still never shortens or changes a name to fit.
- The tool text and the server's instructions lead with a session's rule for names: at most 32 characters, letters, numbers, spaces and `. - _ '` only, so no commas or brackets. They suggest a name that gives the agent's name, model and where it comes from, and tell agents to say a name is set only where the session saved it.

## [0.9.20] - 2026-11-19

A Session Worker release. The site deploys at merge; a session gets the new voice model only once its Worker is updated to this release. MCP stays at 0.7.0.

### Session Worker — needs a Worker update

- Voice interviews can run on OpenAI's `gpt-live-1.1`, now the default. It costs the same per minute as `gpt-live-1`; OpenAI says it pronounces, keeps its accent and transcribes better in multilingual conversations. A session with no voice model saved moves to `gpt-live-1.1` when its Worker is updated; a session that saved `gpt-live-1` stays on it until an admin changes it. The Worker reports `interview_gpt_live_1_1_v1`. The session's OpenAI key must have access to the model.
- A session that still stores an old `gpt-realtime` alias drops it at its next settings change and runs the Worker's default; the Worker no longer writes the default model in its place.

### Client — available when the site deploys

- Settings and `/new`: the interview voice model is a list. In Settings it marks the session's Worker's own default and lists `gpt-live-1.1` only where the Worker takes it; `/new` always lists it as the default, and a new session on an older Worker runs `gpt-live-1`. The site never saves the default model, so a session on the default follows its Worker's default, and an older Worker never sees `gpt-live-1.1`. A session that has `gpt-live-1.1` stored on a Worker too old for it says so, and the next save puts it back on the default.
- Sign-in: the **Your AI agent** box asks one question, what your agent should do. **Suggest answers for me to review** copies a prompt that drafts your answers into a link you review and submit. **Answer and submit for me** makes a key and puts it into the one prompt to copy, masked on screen; the key works in that session only, until the time shown (at most the rest of your sign-in, up to 4 hours), and a new key replaces it. Where a session doesn't let agents submit, the prompt asks for drafts only. Switching account clears a key on screen.
- The agent guide says the agent box's prompt carries the key, and that an agent must never repeat it.
## [0.9.19] - 2026-11-19

A website release: no Session Worker or MCP change, and nothing needs redeploying for it. Its merge also publishes what 0.9.18 could not: the Session Worker bundle with 0.9.18's Worker code (a Worker made from it reports release 0.9.19), under this release's commit, and MCP 0.7.0.

### Client — available when the site deploys

- Results: admins and results admins get one **Update Session Agent** button where the Session Agent is on. It refreshes what the Session Agent knows about the results as a whole and says so when an update fails. A press is a paid AI call only when answers have changed since the last update; when none have, it says so and nothing is built or charged (a change to the session's context alone does not count). **Retry** after a failed update always builds. It replaces the Check, Generate and Refresh "AI Views" buttons; the "AI Views" name is gone from the site.
- Settings and `/new`: the results analysis settings are gone for sessions that update the Session Agent by hand, which is every new session. A session already set to update automatically still sees when and how often, and can switch back.
- Agents: an AI agent given only a public session's link can now prepare suggested answers and hand back a link the person reviews and submits; `/skill.md` says how. Private sessions still start from the prompt the person copies in the session. The page's note for agents, `/skill.md` and `llms.txt` say an agent given a link should ask the person whether to answer and submit for them with a key they make, or to prepare suggested answers for them to review.
- The atlas: a subtopic shows its questions as circles; closing a question leaves you among them, and **Up Level** goes back. A node shows where participants stand at once, in larger text, and "Where people split" uses the chart's own end labels. The List view can sort by atlas order, most split or most answered.
- The compass's quadrants take red, blue, green and purple from each theme's chart colours (muted in Civic, where the fourth is teal).
- Raw Results and the report draw quadratic questions as bars ranked by net, with the net in a box, and multiple choice as share bars with a pill saying whether one or several could be picked; multiple choice counts read "2/4", with no percentage. The report's answer sections are larger, on white cards; written answers each sit in their own block, and long ones fold after about 300 characters with **See more**.
- The Question Types tile shows the quadratic preview in the tile's own colour.
- On phones, a long choice list fills its question card and still ends part-way through an option, so the blank band under it is gone and it is clear there is more to scroll to.
- Classic 95: a tap just under the topic window's title bar no longer closes the window.
- The x beside Submit in the All questions view clears unsent answers again.
- The suggested name for your agent ends "Agent", and fits the session's name rule.
- Results show answers' own names on an older Session Worker even when its first reply was slow.
- Signing in while a public session's Results are loading no longer reads every answer twice.
- A page that cannot load (a blocked or missing script, a stalled connection) now says so and offers Reload, instead of staying blank.
- A group's page links to its session.

### Tests

- The browser journeys judge text contrast once the text is drawn: they wait for fonts, finished fades and a painted frame, and look again for up to 5 seconds at text below 3:1. A cold Linux WebKit had twice misread a fade as unreadable text and failed `main` after 0.9.18. Unreadable text now fails a run only in Chromium and is reported in WebKit; WebKit still fails on sign-in, answering, submitting, reloading and results.

## [0.9.18] - 2026-11-19

Session Workers need redeploying for the Worker changes below. A redeploy changes no stored record and signs no one out, and turns nothing on: on a session from before this release Context cards and the analysis card are both off until an admin turns them on. A session made on `/new` starts with the analysis card on and Context cards off; both can be set there.

### Client — available when the site deploys

- Settings → AI and the AI section of `/new` have **Analysis card**, shown where the session's Worker has the card, with a **?** on what it does and costs. On `/new` it starts ticked; against a Session Worker without the card the session is made without one. In Settings it is off on a session from before this release until an admin ticks it. Session templates and "Set up with your AI" can set it (`analysisCardEnabled`).
- The analysis window shows a two-page picture card: a short description of the person, the matched figure with a portrait in a style of their time and why they match, a guessed book, game, film and song, and one answer of each kind. **Download** saves it as a picture (both pages or one), a GIF or a video. The card is made after the analysis appears, so the analysis is not held up. Nothing of it shows where the card is off or the session's Worker is older than this release.
- A card is made only by its own person, signed in, on their own page. It is saved there and shown to people signed in to the session who may read that person's answers, without pressing Analyze. "Show this card on my page" (on by default) in the analysis window and "Take it off my page" under the card remove it. On someone else's page there is the card that person chose to show, or none.
- A page asks the Session Worker whether the analysis card is on before it makes one, so a tab opened before an admin turned the card off does not pay for a card.
- Importing a template in Settings changes **Analysis card** or **Context cards** only when the template names it. A `/new` sync onto a session that exists never turns its analysis card on, and keeps its Context cards as they are.
- The personal analysis picks the historical figure that fits the person's own mix of answers, instead of the best-known name for the session's subject: always a real person who has died, shown with their years, with a longer explanation. This is not behind the switch and applies to every session when the site deploys.
- Settings → Context has **Context cards**, shown where the session's Worker keeps them, with a **?** on what they do and cost.
- Context items show their card's tags; admins, and whoever added an item, can edit its card. **Make missing cards** writes cards for items without one, after showing the cost.
- Adding a PDF or image where cards are on offers **Analyze with the session's AI**, ticked to start.
- File pickers offer images only where the session takes them.
- `/new` has a **Context cards** tick box in its Context section, off to start. Ticked, the session is made with cards on and the file picker there takes images; Create first checks that the Session Worker keeps cards, and says so if it is too old. A session template, a share link and **Set up with your AI** can carry `contextCardsEnabled`; importing a template in Settings applies its choice where the session's Worker keeps cards.

### Workers — requires redeployment

- **Context cards**, off unless an admin turns them on in Settings → Context. On, the session's AI writes a short card for each file and link added to the session's context: a summary, topic tags and key names. A card is stored with its item and reaches only those who may read the item; encrypted items get none. Workers that keep cards advertise `context_cards_v1`.
- With cards on, the AI's context names the sources it had no room to read, with their cards, so it can say what it left out.
- With cards on, a session takes PNG, JPEG and WebP images up to 5 MB as context. The session's AI reads an image as it reads a PDF, and its reading is context for whoever can see the image. With cards off, images are refused (`415 context_images_off`), from admins too; images already stored stay.
- With cards on, whoever added a PDF or image may have the session's AI read it once. It needs the `ai` scope of their sign-in and counts as one of their AI calls for the day, counted once the reading begins: a request refused before that (AI off, a provider that can't read files, no key, a file too large, a reading already running or stored) costs nothing.
- Changing **Context cards** signs no one out.
- **Analysis card**, off unless a session has it on (`analysisCardEnabled: true`). A session made on `/new` starts with it on; a session from before 0.9.18 has none until an admin turns it on in Settings → AI. `POST /analysis-card/picture` draws the portrait on a person's analysis card from the matched figure's name alone, with the session's OpenAI key, and keeps one per figure for 30 days; a new portrait counts as one of the person's AI calls a day, and a session draws at most 60 a day. `POST /analysis-card/publish` and `POST /analysis-card/published` keep one card per person on their page, read by anyone signed in with AI access; withdrawing deletes the card's words; up to 20 saves a person a day; kept a year; not in backups. Off, or never set, all three answer 403 `analysis_card_off` and count, read and store nothing. Workers with the card advertise `analysis_card_v1`.
- A saved analysis card goes only where its owner's answers go. `POST /analysis-card/publish` refuses a request that names another account (403 `analysis_card_own_only`). No card is saved in a session that shows results as totals only or to admins only (403 `analysis_card_answers_private`), and a saved card is given only to its owner and to a reader who may read that person's answers.
- The analysis card is for Worker-hosted sessions. A session whose settings live on-chain has no Analysis card switch and so has no card.
- Changing **Analysis card** signs no one out.

### Agents and MCP

- MCP 0.7.0. An agent's display name is now saved in a session that keeps names with its next answer when it wasn't saved on joining (it joined before the session's Worker was upgraded, or that save failed). Once saved, answers don't save it again, so an admin's clear stands. A save that fails leaves the answers stored and says why. The `set_profile` step given for 0.6.0 is no longer needed.
- `set_profile` and `join_session` state a session's rule for names (at most 32 characters; letters, numbers, spaces and . - _ '), and a refused name's reply carries it.
- `list_context` lists the files and links in a session's context that the agent may read, oldest first, each with its card where it has one; `query` keeps those whose title, link or card holds every word given, with no AI call. `read_context` returns one source's text, 20,000 characters at a time.
- `add_context` takes PNG, JPEG and WebP images where the session has cards on, and there has the session's AI read a PDF or image as it is added (`analyze`, true by default with cards on), saying in `analysis` whether it was read, is still being read, or could not be. With cards off it asks only for an admin's agent that sets `analyze` to true.

### Local tooling

- The way-back test now drills a session put back on the 0.9.17 and the 0.9.12 Worker bundles: one from before this release that never saved either switch, and one with both switches saved, cards and a saved analysis card present.
- The participant journey taps Next as a finger does, so a button that grows under the pointer no longer makes the look pass scroll the page.

## [0.9.17] - 2026-11-18

Session Workers need redeploying for the Worker changes below. A redeploy changes no stored data and signs no one out; with names on, people can set a name others in the session see.

### Client — available when the site deploys

- Session names: in a session on a Session Worker from this release you can set your name; others the session admits see it on your page, in Results and in group lists, in place of your address. Your private label for someone shows as "your label". Sessions without a place for names keep your name on this device.
- Session Agent: you can speak a question with the microphone, and the dialog says who gets Detailed answers. On a Session Worker from this release an answer lists what it read.
- A person's page no longer sends their username to its AI analysis.
- Classic 95 rating value readable on its card.
- Answers sent right after sign-in are read once.
- In a members-only session, signing in while Results is loading no longer reads every answer twice.
- "Talk it through" opens the interview directly.
- Debate map views: Atlas, Tree, List.
- Results version picker on one row.
- On phones, the risk matrix uses the full width and keeps its row and column labels in view.
- Topic window close button easier to see.
- The question count sits between the arrows. Its form follows the row's real room, so Submit keeps its whole label in a wider font.
- One "?" beside "Voice mode".

### Workers — requires redeployment

- People can give themselves a display name in a session, up to 32 characters, shown to members in place of their address; admins can clear one and turn names off (`namesEnabled`; absent means on); names travel in backups. Names stay out of AI prompts, exports and agent results. The Worker advertises `session_names_v1`.
- Once a session's Worker is redeployed with names on, names carried inside answers stop showing (answers made before the redeploy, agents on MCP 0.5.1 or earlier, interview answers given with a name) until the person or agent sets a name in the session. Signed-out viewers of public Results see no names.
- Results load faster on large sessions: a batch of answers is read from storage in one request instead of one per answer, and the session's access gate is checked once per request. The answer list returns up to 500 a page when asked: MCP 0.6.0 asks for 500, the site still asks for 100.
- Saving an answer no longer reads every question's record each time: a Worker keeps a session's question list for 5 seconds, and reads it again for a question it does not know.
- The Session Agent reads far more of a session's context for an answer: up to 320,000 characters from 48 items, each to 12,000, or 160,000 characters on Cloudflare's model. Each question costs more on the session's provider key.
- The Session Agent lists what an answer read. Asked for numbers a General answer is not given, it says they are on the Results page; asked whether a chat is recorded, it answers from the session's setting.
- AI builds count only the answers they keep against their limit, with a 32 MiB guard on stored bytes, so a session of AI-prefilled answers with research material can build. A build that cannot read a session says which limit it met: too many stored versions, too much answer text, or too much stored material.
- A backup reads its pages in bulk. On a 4,000-item drill, storage operations fell from 12,525 to 1,139, with identical pages and an identical restore.

### Agents and MCP

- MCP 0.6.0. Where a session keeps names, an agent's display name is saved in the session on joining and with `set_profile`, and its answers there no longer carry the name; older Workers still get it in answers. An agent that joined a session before that session's Worker was redeployed, or whose name did not save on joining, runs `set_profile` with its display name once afterwards; until then Results shows its address with "(agent)".
- `get_results`: a partial result's `next` says its counts are not the session's totals, why, and how to read the rest; answers list 500 a page on Workers that allow it.
- `ask_session_agent`'s reply gains `chat`, one sentence saying whether the question and answer were stored.

### Local tooling

- A test drills the way back: data, names and a backup made by this release's Worker are read, restored and edited under the published 0.9.12 Worker bundle.
- Two browser journeys run as a hosted job in Chromium and WebKit: a phone participant's visit with a look pass in three themes, and Results at 50 people by 40 statements. If WebKit cannot be installed in time, that leg ends with a warning and its journeys are skipped.
- New Session Worker tests: every route asked from an unlisted origin, a results admin refused other admin actions, members-only answer batches kept uncached, and a file-form answer replayed by request id.

## [0.9.16] - 2026-11-18

No change to the Session Worker or the MCP: no Worker needs redeploying, and nothing is published to npm.

### Client — available when the site deploys

- Single-choice questions no longer move to the next question by themselves, as they did in 0.9.15; the choice stays ticked until **Next**. Agree/unsure/disagree cards still move on after 0.7 seconds.
- **Next** is the same arrow again, the same size and in the same place, instead of 0.9.15's filled Next button. Once you answer a question that stays put it turns the theme's highlight colour (yellow in Classic 95, blue in Civic) and glows a few times, or holds a steady glow with reduced motion.
- On phones the menu, microphone, **Submit** and the arrows sit in one row under the question card, in view without scrolling, and every card is the screen's height less that row. On a narrow phone Submit drops its count first; while it saves, its spinner always shows.
- "Pick one" or "Pick any" sits at the end of the question instead of on its own line, and is readable in the Context Engine theme, where it was faint.
- A multiple-choice list with more options below shows the down arrow quadratic questions use; tapping it brings the next options into view, and an up arrow scrolls back.
- On a person's page, long free-text answers show their first 100 characters or so, with **Show more** to read the rest in place.
- In the Classic 95 theme, answers in the answer card are readable; they were white on grey.
- A rating question with a step other than 1 now steps correctly in the Pile and interview slider, and the slider's arrow keys stay on the question's steps.
- The signed-out line "Answered before? Log in to see your saved answers." on the session page is removed.

### Local tooling

- Benchmark: the importance parser scores only JSON numbers as votes.
- The e2e smoke gate runs a phone smoke of the question card's controls row, offline, in three themes.
- CI: the browser smoke job no longer downloads system packages the runner already has; it fetches them only if the browser cannot start.

## [0.9.15] - 2026-11-17

No change to the Session Worker or the MCP: no Worker needs redeploying, and nothing is published to npm.

### Client — available when the site deploys

- On phones every question card has the same height, so the arrows below it never move.
- Multiple-choice options stack in a list that scrolls inside the card, instead of a sideways strip.
- A long choice or quadratic list always ends partway through an option, with a fade at whichever end has more.
- Quadratic questions show more options at once on a phone, and a free-text box fills the card.
- Choice cards say "Pick one" or "Pick any".
- On single-choice and yes/no cards, a choice is ticked and the card moves on after 0.7 seconds. Tapping another option, or Back or Next, cancels the move; a tap that ends a scroll never moves on.
- Next becomes a clear **Next** button once a card is answered.
- After a submit, **Submit** turns into a green "Submitted" for 10 seconds, then goes, keeping its place. Screen readers announce it.
- Next on the last question opens an end-of-set card: the answered count, Submit for unsent answers, and buttons for See results, Talk it through in the interview, and Join a group. While it shows there is one Submit and the arrows don't move.
- Unsent answers are no longer deleted when a browser wallet locks, disconnects or switches account, and the all-questions view no longer drops unsent answers it had not restored yet.
- After a reload, a returning participant sees "Loading your saved answers..." instead of blank questions; signed out, the page says saved answers appear after logging in.
- Submit counts the answers as they save, with the elapsed seconds ("Saving 12 of 40 · 5s"), on the question card and the end-of-set card on a phone as well as in the header, and no longer waits forever on loading your saved answers.
- Submit uploads four answers at a time on Session Worker sessions; on a test session 40 answers saved in about 13 seconds where they took about 33.
- Submit no longer waits on, or asks for a sign-in for, the AI draft text kept for admins after the answers are saved.
- Typing in the all-questions view is about twice as fast on phones.
- A passkey prompt that was closed or timed out says so plainly instead of "The operation either timed out or was not allowed".
- The Tools help panel is readable in dark themes and no longer hides behind the toolbar on phones.
- Classic 95: unselected option text is black on grey (it was white on light grey).
- Groups that need a password show a field for the invite link or password everywhere you can join one, signed in or not, and say where it comes from. A pasted invite link works, and a wrong code is refused beside the field.
- Group pages show members out of the limit ("Members: 3 / 1000"). Signed out, the count shows a dash with a "?" that says to sign in. Admins see the count too.
- Opening a group in a new tab no longer fails with "The document is not focused."
- A cancelled or failed sign-in on the groups pages says so in one sentence, with a way to try again, instead of the wallet's own error text.
- Compare on a person's page sends its AI summary and perspective-map requests to the session's own Worker. Before, on sessions this browser had not listed, it silently fell back to a local comparison.
- The link from the account box to your own page opens it on the session you are in.
- When Compare cannot get an AI summary it says why, beside "Local comparison · AI summary unavailable".
- Analyze on a person's page stays off, and says so, until the page shows something to analyze.
- The **Demo Mode** switch is gone from Settings. The Debate Atlas and Risks views it added to the home Tools tab are in session Results.
- The home Tools tab shows Questions, Groups and Context, without the Live/Demo legend or coloured borders, and Context → View always shows the session's documents; the "Demo corpus" checkbox is gone.
- The session document view under Tools → Context → View is readable in the Minimal theme; its title and empty note were white on white.
- `REACT_APP_CE_DEMO_SURFACE_MODE_DEFAULT` is no longer read.
- The all-questions view shows a green "Submitted" after Submit, as on the phone card, and marks each saved answer "Saved".
- After a reload, "Loading your saved answers..." counts the session's answers as they are read; Results counts them during a reload too.
- On phones, a long multiple-choice list no longer hides its first option behind the question.
- `rxc-ra-26` is no longer in `known-sessions.json`, so a plain `/session/rxc-ra-26` link no longer opens; its `worker=` links still work, and the session and its Worker are untouched.
- An answer changed just before Submit, whose upload then failed, is no longer lost on reload.
- The group invite notice fits a phone screen, and its invite link or password field is readable in every theme.

### Local tooling

- CI and the local release gates run the client tests as 12 time-balanced shards, each one process with the same 4,096 MB heap, and check that the shards are one complete run of the tree before merging their coverage. The coverage floor is unchanged.
- The gate runner runs independent lanes side by side and prints how long each command took; `--serial` gives the old one-at-a-time run. `npm run test:ci` takes about 6 minutes where it took about 29.
- Client tests get 15 seconds each by default, where they had 5, and wait up to 3 seconds for the page, where they waited 1. A hanging test still fails.
- A gate run prints the machine's load at its start and end, and warns when it starts on a busy machine.

## [0.9.14] - 2026-11-17

### Client — available when the site deploys

- Results on large sessions show answers as they arrive, with "Loaded N of M answers", reading several batches at once. On a test session with about 1,900 answers, the first answers showed in 2 to 8 seconds and all of them in 7 to 18, where it took about 65.
- If answers fail to load, Results say so and offer **Retry** instead of spinning; a failed batch is tried once more first.
- Signed-in Results no longer wait on an unfinished sign-in.
- Questions and surveys no longer wait for a session's answers to load.
- The page reconnects to its browser cache when iOS drops the connection, instead of failing every later save.
- Question links to a Worker-run session open again: a listed session's link no longer needs `worker=`, links built inside an unlisted session keep its Worker, and a session that can't load says so instead of loading forever.
- On a phone the atlas topic panel's close button stays at the top right of the screen, Escape closes the panel, and the title is no longer squeezed out.
- The **Your AI agent** section starts collapsed.
- A passkey account's username now saves.
- The username can be set from the account dialog, and its field fits a phone.
- Labels you give other accounts are marked as private, and your own username says it is saved on this device only.

## [0.9.13] - 2026-11-17

### Client — available when the site deploys

- On a session's page, the groups show a centred spinner while they load, like the report's, in place of "Loading groups…".
- In the civic theme, the welcome slides have their navy backdrop again, with readable text and arrows.
- On an iPhone, the Interview fills the screen and **Submit** stays above the browser's bar, however many questions the AI drafted.
- On a phone, Login and other dialogs sit in the middle of the visible screen instead of running under the browser's bottom bar.

## [0.9.12] - 2026-11-17

### Client — available when the site deploys

- An unsubmitted draft keeps its last keystrokes when the page reloads straight after typing.
- A group invite link without `worker=` keeps its invite if the page reloads before the session is found.
- Feedback: the list fails rather than showing a shortened list when a page can't be read, so **Delete all** never removes unseen messages.
- A group's member list reads past members who left, instead of saying none were found.
- A bookmarked user opens in the session it was saved in, with its nickname and Remove control.
- The fallback report keeps two questions with the same wording apart.
- On a phone, the interview's **Submit** stays on screen however many questions there are, and with **AI submission info** open.
- Copy buttons work in browsers that refuse the clipboard, such as in-app browsers. Where copying is refused, the text is selected to copy by hand, and every button shows whether it copied.
- The interview's AI prompt, if it can't be copied, is shown whole and selected; the formatted view shortens its links.
- The interview's **Discard** button sits left of the microphone, away from a right thumb.
- Drafted answers no longer carry filler comments when the person said nothing on a question.
- The voice interviewer builds each question on the last reply instead of working through the newest questions first.
- Admins, and each person for their own answers, keep seeing an answer's AI research material in Results, after a reload and when an answer is saved again. Reading it never asks for a signature, and an answer put on Arweave leaves it out.
- A voice interview's call is sent once. The site puts a sign-in on it only for a private session, so a Worker still on 0.9.10 never receives one, and a refused call shows its own reason. This replaces 0.9.11's second try without the sign-in.

### Workers — requires redeployment

- **Research material is for admins only.** An answer's AI research material (the AI's prediction and confidence, the answer given before a hidden draft was shown, the changed fields, the platform and model) now reaches only the session's admins, and each person for their own answers. Everyone else who reads answers, including through the MCP and Agent HTTP, gets them without it, marked `interviewProvenanceWithheld: true`: the mark says material is attached, not what it is. Until a Worker is redeployed, anyone who can read a session's answers can read that material.
- AI Views, the atlas and the risk matrix keep building when the page that started them closes; a second press joins the running build, and a failed build can be pressed again at once.
- An answer an agent sends again while its first copy is still being saved now ends on the latest choice.
- A delayed retry of an older queued answer no longer replaces a newer one.
- An answer resent after 30 days is recognised rather than stored again.
- Agents see their answered questions as answered after 30 days.
- Signed-out group suggestions leave out full groups.
- Agent HTTP group results name each statement's question (`questionId`).
- A context link can be for the members of chosen groups, as a file or text can (`groupIds`; the Worker advertises `context_link_groups_v1`). The website has no control for it yet; agents set it through the MCP.

### Agents and MCP

- MCP 0.5.1. `answer` tells a mistyped question ID from a locked one: an ID that matches nothing is no longer called locked, a near miss names the nearest listed ID, and a call stored in part says which answers went through.
- `add_context` takes `groups` with a link as well as with a file or text, on a Session Worker from this release. On an older Worker it refuses in a plain sentence rather than adding the link for everyone.

## [0.9.11] - 2026-11-16

### Client — available when the site deploys

- The site lists the Reverse Alignment salon's session, `rxc-ra-2`, so its normal link opens it and agents can find its Worker in `/known-sessions.json`. A listing changes only the link: who can read a session stays as its admins set it.
- The Docs page has a Session Agent section: what it is, who may ask it, its two answer styles, how to keep your answers out of it, and which agent is which.
- In the prompt you copy for your own AI, the link it returns is now labelled "Review your drafted answers", which is where it goes, instead of "Open prefilled interview".
- The interview shows a spinner while it works: preparing responses, submitting, connecting or stopping, checking setup, preparing its opening, checking that a copied prompt fits the session, and finding or joining groups.
- After a voice interview, **AI submission info** no longer opens to an empty box when nothing is shared. It says the session’s AI drafted the answers (naming its model when known), that only the answers you submit are saved, and what Share for research would add.
- A hidden draft says it once: “Your AI's predicted response is hidden until you answer.”, with its **?**, above the grey area; the **AI guess hidden** heading is gone.
- After an interview, the red **Discard interview** button sits right of the microphone, level with its label and set apart from it; the transcript stays beside the microphone, which stays centered.
- On a phone, the interview's header fits on one row. **Share for research** always sits inside the **AI submission info** box, on its summary row or along its foot, with **What’s this?** beside it, which says what sharing keeps on a tap, hover or focus, in place of a **?** and a **What’s kept** link.
- Session Agent settings, in setup and in Settings, offer **Answer with an open model on Cloudflare**. In Settings it shows only where the session's Worker can reach Cloudflare's models; a session already using it on a Worker that can't is told to redeploy or untick it.
- Sessions can add a short note on where research data goes (Interview settings → **Where the data goes**, on `/new` and in Settings). It shows in the hidden-drafts and **Share for research** tooltips. Only https addresses become links. It needs a Worker from this release.
- **Where the data goes** shows in Settings only where the session's Worker accepts it, which Workers from this release say they do, so saving Settings on an older Worker no longer fails. On-chain sessions keep the field.
- The AI prefill review says how many drafts are still hidden until you answer, and why.
- The **Share for research** tooltip's link is readable on its dark background.
- The draft-review page's **How it works** link and the **What’s this?** tooltip's link open a plain-language summary on GitHub, led by a diagram, of what interview research sharing keeps and how the Mirror Score is measured.
- The **AI submission info** bar keeps its middle free, so tapping it opens the summary instead of ticking **Share for research**.
- Context items on the session page show their kind and size, preview in place (a file's start, or a PDF's first page), and open in the docs viewer from their name.
- People who may add context can add a typed note. Signed out, **Add** opens the sign-in.
- A session opened with a `worker=` link keeps that Worker on its docs viewer and profile links.
- The Doc Library page and its viewer are readable in all three themes, and items stored on the session's Worker show when they were added and by whom.
- Admins can export what the Session Agent may give a member as one file (`<slug>.session-agent.json`), from Admin. The same session state always gives the same file.
- The Session Agent's dialog has a second switch, **Include my address with my answers**, on unless you turn it off. Off, your address is left off exported items; it still shows wherever the session shows your answers. Both switches stay available after a session ends.
- That switch's help says that an export's group member lists still include your address.
- The notice by the session's title and the two switches' help say who your answers are available to, following the session's results setting, and the session's note on where research data goes follows the notice.
- Admins can turn on **Record chats** for the Session Agent; it is off by default. People asking then see **Store this chat**, ticked to start, and choose whether their address goes with it. Admins read and clear stored chats in Admin.
- People who aren't signed in can ask the Session Agent, for General answers only, unless an admin turns off **Anyone can ask**. Where a session lets only some people sign in, gives a sign-in no AI access, or uses its own AI endpoint, a visitor is asked to sign in.
- Settings offers **Record chats** and **Anyone can ask** only on a Session Worker that accepts them, so saving on an older Worker no longer fails.
- A hidden draft's **?** no longer says only your own answer is submitted. It says that while Share for research is on, the AI's prediction, its confidence and what you changed are saved with your answer.
- In the account menu's **Your AI agent**, each command and prompt has a copy icon in its box that turns to a tick once copied, replacing the **Copy** buttons. **On my behalf** names the session when Agents (HTTP API) are off there, and its **?** opens below the line, where it no longer covers the tabs. The **As itself** prompt tells the agent to set its display name when you give your name, and says it may add links or files where the session invites it.
- An Interview's draft review now survives a reload, Back, or reopening the tab. Its transcript, drafts, edits, sharing choices and any AI prefill are kept in this browser until you submit or discard, for at most 24 hours from when it was first kept, and nothing more is sent anywhere. Each is kept for the signed-in account and never shown to another account. One kept signed out lasts an hour, and the next visit asks whether to continue it or discard it before showing anything, since a phone may be shared; a new interview from a link or a code clears it. Another browser starts empty, including Safari after a chat app's own browser.
- A private session shows a way in where its content would be. Without an invite, a visitor is told the session is private and can paste an invite link. A valid group invite link opens the session, signed in or not, and keeps working in that browser until the invite stops holding.
- A link's group invite is no longer lost when the page saves it late in start-up, on ordinary sessions too.
- Results no longer shows the AI Views tabs (Circles, Breakdown, Risk Matrix). The AI Views build stays, for the Session Agent.
- **Atlas** and **Risk Matrix** appear in Results once an admin builds them. Until then, only people who may build one see its tab, with a note saying how.
- The **Debate Atlas** tab is now **Atlas**, and its levels are named Topic and Subtopic.
- A built view is headed by one small row: its version, with its model and counts beneath.
- A built atlas shows a multiple-choice question's choices, on a Worker from this release.
- A question's **Answer** link from the atlas opens for a session reached by a `worker=` link.

### Workers — requires redeployment

- The Session Agent can answer with GLM 5.3, an open model, on Cloudflare Workers AI, through the Worker's own AI binding. It is off by default and set per session. It is billed to the Cloudflare account that hosts the Worker, needs no AI key, and still counts toward a person's AI calls a day. Every other AI task (drafting, AI Views, voice) keeps the session's provider. Each call asks the model for low reasoning, so its thinking does not use up the reply limit.
- A deploy from this release adds the AI binding to the Session Worker. Deploy requests started before this release and resumed after it are refused, since their bindings differ; start them again.
- The first deploy shows whether your Cloudflare token can attach the AI binding; this has not been tried with a token that has only the two usual permissions. If Cloudflare refuses with "Authentication error", add the account permission **Workers AI: Read** to the token and deploy again.
- New for the Session Agent: a signed admin export of its material, an address switch for exported items (`POST /session-agent/attribution`), chat recording with an admin read and delete, and questions from people who aren't signed in. Stored chats go into the export and session backups; one answered to an admin is never exported.
- **On by default after a redeploy:** a session that already has a Session Agent starts answering visitors who aren't signed in, under the rules above. Signed-out asking has its own daily limits: 10 questions from one network address (fewer if the session's limit for signed-out addresses is lower) and 300 for the session. Turn off **Anyone can ask** to stop it.
- The Session Agent is told to leave out what a member writes about themselves (a name, role, workplace or other detail), not to say it is there, and not to use it to pick out an answer; asked about a particular participant, it says only that it can't tell who took part. These are instructions to a model, not a filter: in trials it never named a participant, but asked what a participant described by their role had said, it still passed on that person's view, unnamed, in most replies. A session that needs stronger protection should give every audience General answers.
- `POST /session-agent/status` now answers after a session has ended or its AI is off, with `closed` saying why, where it used to refuse.
- Session settings accept a note on where research data goes (`interviewMode.dataNote`, up to 300 characters). Saving it signs no one out.
- **Private sessions.** A session whose access rule names Worker groups shows its questions, context and results only to its admins, to signed-in members of a named group, and to anyone whose request carries a read invite for one, signed in or not. Each request reads the rule and the groups afresh, so removing a group, a member or a password refuses on the next request.
- A read invite comes from a group password's link. The browser signs a read statement with a key derived from the password and sends it as `X-CE-Group-Invite`; the Worker never sees the password. A read spends nothing and cannot be used to join. A one-use code makes no read invite: its holder joins first.
- Everyone else gets a shell from `GET /session-config`, with only what signing in and joining need and never the session's name, description, context or instructions, and `403` (`private_session_invite_required` or `private_session_invite_invalid`) on other routes.
- The rule is a `worker_group` condition in the session's access conditions, any-of with the admin role so admins are never locked out, saved with `set-config`. This release has no control for it on `/new` or in Settings.
- Adding a group to an access rule, or another condition to an any-of rule, signs no one out. Every narrowing still does.
- An atlas build keeps each multiple-choice question's choices. An atlas built before the Worker is updated shows "Options unavailable" for those questions until it is built once more.

### Agents and MCP

- MCP 0.5.0. A new tool, `ask_session_agent`, asks a session's own Session Agent one question, where the session has one and lets the agent ask. `join_session` and `get_session` say whether the session records those chats.
- `join_session` tells a joining agent what it may do and is never required to: set a display name that says it is an AI agent, join a group the session lists as open, and add context where the session invites it. The agent guide and `llms.txt` say the same.
- `join_session` and `join_group` join a private session from its invite link.
- `add_context` can show a file or text to the members of chosen groups, as the website's **Visible to** does. A link stays for everyone or admins only.
- A private session's interview catalog opens only with a ticket from a signed-in member, since an AI fetching a catalog link sends no invite.

## [0.9.10] - 2026-11-15

### Client — available when the site deploys

- Opening a session takes far fewer requests. Measured in a browser on a session of 40 questions and 1,200 answers: a signed-in member's page load went from 86 requests to 37 on a public session, and from 122 to 39 on a members-only one; signed out, from 71 to 32.
- A session page no longer reloads every question, answer and survey while the on-chain session registry can't be reached (offline, or its RPC blocked). It did so about 3, 6, 12, 24 and 48 seconds after loading, then every 30 seconds for as long as the page stayed open. On the same session, signed in, the first minute went from 108 requests and 5.6 MB to 35 and 2.0 MB.
- Your saved answers come from a listing of your own, not everyone's.
- A members-only session is asked signed in from the start once the tab knows it needs that, instead of being refused signed out first on every read.
- AI Views refreshes without downloading its answers again unless the build changed: each refresh reads about 5 KB where it read about 365 KB.
- Questions are read a hundred at a time.
- The Admin page's note on stored versions says each person's latest answer to each question counts, and that for answers saved before 0.9.10 every saved change counts.
- When a session is busy, the site retries only what the Worker says is safe to send again. A busy sign-in starts over with a new nonce instead of resending one that may be spent; a wallet user may be asked to sign a second time.
- The QR reader now loads only when you scan, so every first visit downloads about 46 KB less compressed. The Debate Atlas's historical cases load in their own file.

### Workers — requires redeployment

- Each participant or agent may add 20 context items to a session; admins have no limit. The 21st is refused with a plain sentence. An item sent again after a busy answer is counted once.
- AI Views, the atlas, the risk matrix and the Session Agent's Detailed answers read only each person's latest answer to each question, so editing an answer no longer uses up the 10,000 an AI build can read. Answers saved before this release still count every saved change. At 2,600 answers a build makes 51 storage calls where it made 82.
- Saving an answer no longer marks the session's backup twice when no backup is being taken: 20 answers made 81 calls to the session's coordinator and now make 41. While an export runs, every write is marked as before. An export's first page now waits 5 seconds before it starts, and each page holds a 10-minute lease; an export left longer than that starts again. Pause writes while exporting, as before.
- A busy answer now says whether the request is safe to send again (`retryable`), so the site and the MCP follow one rule instead of each keeping its own list of paths.
- A page of stored records is read from storage in one call, not one call a row: a 100-row list page used 100 reads and now uses 1.
- Group joins and Session Agent opt-out changes no longer drop the session's one-second copy of its settings.
- Browsers may reuse a cross-origin check for ten minutes, so a page sends fewer preflight requests. The list of allowed origins is still enforced on every request.
- The AI reads context only until its part of the prompt is full, or 16 items: the admins' first, then each person's oldest in turn. The Session Agent says when context was left out.

### Agents and MCP

- MCP 0.4.3. `get_results` reads stored records 100 at a time where the session's Worker offers it: at 250 answers, 251 requests become 4.
- The MCP retries a busy call only when the Worker marks it safe to send again and repeating it does no harm (reads, a nonce, a group join, an answer with a request id). Its busy message now says the request may not have gone through and to check before trying again.

## [0.9.9] - 2026-11-14

### Client — available when the site deploys

- When a session is briefly busy, signing in and saving the AI draft text kept for admins wait a moment and try again. A withdrawn consent whose delete still fails is sent again the next time the page loads.
- Group member limits on `/new` and in the participants' create form follow the session's **Most members in a group**, not 1,000. A blank limit shows that number, and so does a group's page.
- The Public URL help says anyone signed in can join such a group, with or without the link. Suggest questions says it drafts up to five, and none when nothing in the context supports one.
- Admins see how many question and answer versions the session stores against the 10,000 that AI Views, the atlas and the risk matrix can read, with a warning from 8,000. It shows once the session's Worker runs this release.
- Settings has **AI requests per person a day**, a cap on one person's AI requests (drafting, Session Agent questions, agents' AI calls) apart from saving answers. Saving it signs no one out. It does not count AI used before signing in, which voice interviews are. The field shows only on a Session Worker that counts the limit, and re-saving a session from `/new` keeps the limit set in Settings.

### Workers — requires redeployment

- A session can set a separate daily limit for signed-in AI calls (`limits.aiPerWalletPerDay`): `/ai`, Session Agent questions and Agent HTTP's AI share one count per person. A cap on AI spend no longer stops answers or reads; empty or 0 falls back to the general limit. A call refused before any AI runs is not counted. It counts signed-in calls only: where a session opens AI to signed-out visitors, those calls fall under the per-network limit. Saved from Settings (`set-limits`) it signs no one out; a limit changed in a full settings save (`set-config`) signs everyone out, as before.
- `/capabilities` reports `ai_daily_limit_v1` when the Worker honours the AI daily limit.
- Admin diagnostics show how many stored question and answer versions an AI build reads, against its limit of 10,000, and a build over the limit says so in plain words.
- A rate limit that cannot be reached answers "busy, retry" (`503`) instead of "Rate limit exceeded.", so the site and the MCP try again. The Worker logs a line when its limit, sign-in or receipt object does not answer.
- Restoring a backup keeps everyone who turned the Session Agent off opted out. Backups made before this release carry no opt-outs. A backup lists who opted out, so keep backups private.
- An admin saving a setting that does not affect access no longer refuses group joins and leaves already under way.
- A session with more than 300 context items no longer leaves the AI with none of them. The AI takes 300, the admins' first and then the oldest, and the Worker logs how many were left out. Items stored by earlier releases are still read.
- New Session Workers keep the Worker's own log lines: the deployment template and the deploy helper turn Cloudflare's logs on, with per-request logs off, so no request address is kept. Warnings about sign-in checks no longer name the signer's address.

### Agents and MCP

- MCP 0.4.2.
- A group join refused when no invite was sent says to call `join_session` again with the full link, pass the invite, or check the group's id, instead of blaming an invite.
- `list_questions` says that by default it lists only unanswered questions, as it always has, and how to list the others.

### Local tooling

- Two Session Worker tests no longer fail by chance: the group-password test picks people the join race really refused, and the backup test looks for whole feedback phrases, not a short marker that random ids can contain.

## [0.9.8] - 2026-11-14

### Client — available when the site deploys

- A session page has a **Feedback** button in its footer that opens a short form, where anyone, signed in or not, can say what worked in the app and what didn't. It goes to the session's admins and is no part of answers, Results or exports. A message never says who sent it. Where the session pays for AI and hasn't ended, a microphone writes speech into the box as on an answer, on the session's AI allowance, without ever asking to sign in, for people the session gives transcription (signed-out visitors only where it lets them). Writing speech down needs the session's OpenAI key: with only another provider's key the microphone shows and says it couldn't. No audio is kept. The button shows only for a session a Worker runs, on a Session Worker running this release; an on-chain session has none.
- Settings has a **Feedback** section for full admins, to read the messages, download them as a CSV and delete them, and a **Feedback box** setting, on by default. Reading takes no signature; deleting one message or all of them takes one.
- Risk Matrix: the detail grid for two areas labels its columns and rows, has a key, frames every square (an empty one says "No notes"), shows each balance with an arrow and its note count, and its column and row headings highlight, with a **Clear** button.
- Every Results view shows when it was made in the same place, top right: built views always show their **Version**, even with one build, and AI Views show when they were generated. AI Views' titles and its Breakdown interpretation are readable in the civic and classic themes.
- The debate atlas is called **Debate Atlas** everywhere, beside **Build atlas**; its help describes what it shows, and the Results admins help says they can build the atlas, risk matrix and AI Views.
- The voice interviewer asks its two closing questions (what else should be asked, and which question others should answer) only when the session drafts new questions from interviews. With that setting off, as it is by default, an interview no longer ends on them.
- Results: when a session holds more answers than one load reads, a Report that fails to load says so, that trying again can take minutes, and what an admin can do.
- A group on a Session Worker starts on a generated three-word password, selected so an admin can type their own; **Generate new** makes three words too. On-chain groups keep five words. A right password always gets in and wrong tries are not limited, so a hand-typed password should be long and uncommon.

### Workers — requires redeployment

- Session Workers take feedback about the app at `POST /feedback`, from anyone on the session page, signed in or not. A message is text only, at most 2,000 characters, and never names its sender. A person can send 5 a day; a session takes 200 a day and stores 2,000. Only sessions a Worker runs take feedback; an on-chain session takes none.
- Full admins read and page through feedback with their sign-in (`GET /admin/feedback`), and clear it with one signed delete; results admins and agent keys cannot. Feedback never reaches AI Views, the atlas, the Risk Matrix, the Session Agent, the fidelity report, exports or backups.
- A session's `feedbackEnabled` setting, on unless set, turns the Feedback box off; turning it off signs no one out.

### Agents and MCP

- MCP 0.4.1. An agent that signs in too often is told "Too many sign-ins" and what to do, instead of a "nonce" message that models mistook for a blockchain limit.
- Answers record the MCP client's own name as the platform when neither the host nor the agent sets one, and `set_profile` tells models never to guess a model id.

### Local tooling

- `npm run ai:test-theme:feedback` checks the footer's Feedback button and form, speaking included, by keyboard in each theme at phone, tablet and desktop widths.
- The MCP publish workflow waits up to ten minutes, not three, for npm to list a published version, since npm once took four. If it still can't confirm it, the error gives the `npm view` command and the integrity to compare, and says that when they match, the publish went through and a rerun while `main` is unchanged does nothing.

## [0.9.7] - 2026-11-13

### Client — available when the site deploys

- On the Admin page, each group on a Session Worker has **Who can join**: One-use URLs, Group Password, Public URL, or Admin adds members, with the detail behind a "?". The choices appear once the session's Worker runs this release; on an older Worker the form is as before.
- One-use URLs: an admin generates 1 to 500 links, with an optional expiry. They are shown once, to copy or export as CSV, and listed afterwards by the start of their hash with **Revoke** and **Revoke all unused**. Only hashes of the links reach the Worker.
- Group Password: an admin sets, generates or replaces a password, shown once with **Copy password** and a link with or without it. Only the signer made from the password reaches the Worker. A password a joiner could not type back is refused with the reason.
- Turning off **Show in the group list** keeps a group out of the list. A group's card says how people join, "Not in the group list", "No password yet: no one can join.", and how many links are left.
- A link's invite leaves the address bar at once and is never kept in history, logs or copied links. A listed group that needs a password or a code takes one typed into the Groups section. A refused join says one sentence and offers the field again, and a refused invite is never sent again.
- A claim link from a group recording carries the recorder's group password, never a one-use code. A group joined by one-use links says each person needs their own invite.
- `/new` and Settings have **Most members in a group** (1 to 10,000). Settings offers it once the session's Worker runs this release.
- An on-chain group's open join choice is labelled **Public URL**.

### Workers — requires redeployment

- An admin chooses how people join a group on a Session Worker: anyone signed in to the session (from the group list or a link), one-use codes, a group password, or only people an admin adds. For a group joined by code or password, the group's id in a link no longer admits anyone. Admins add, list and revoke codes at `groups/invites/add`, `groups/invites/list` and `groups/invites/revoke`, and set a password at `groups/password/set`; a password is never sent or stored, only the signer made from it. Changing a group's join mode voids its password and its unused codes.
- A group can be left out of group lists. Someone who is not a member gets "not found" for an unlisted group's members, as for a group that does not exist, and leaving a group answers the same for both. Groups an earlier Worker kept out of lists stay out until an admin lists them.
- A session sets the most members any group may have (`groupMemberCeiling`, 1,000 unless set, up to 10,000). The Worker variable `CE_WORKER_GROUP_MAX_MEMBERS_PER_GROUP` is gone: a deployment that set it should set the session's ceiling instead.
- Every join refused before a valid code or password answers the same `403` and sentence, so an answer does not show whether a group exists. A right group password or code always gets in: wrong tries are not counted or limited, so no one can shut a group by guessing, and a password's strength is the protection. Prefer a generated password to a short or common one.
- Session backups carry a group's codes and a password group's signer, which a restore needs. Keep backups private.
- A session's public settings report `groupJoinChoices`, which the site reads to offer the new choices.

### Agents and MCP

- MCP 0.4.0. `join_group` uses the invite a session link carries (`#groupInvite=…`), or a one-use code or group password passed as `invite`. The server never sends a password: it signs a join statement with a key made from it.
- Every join refused before a valid code or password reads the same, including for a group that does not exist; it used to say "This session has no group". A full or closed group still says so. `get_session` and `join_session` say how a code or password group is joined.
- The first `list_questions` waits at most about 2 seconds for the agent's own earlier answers. A wrong argument shape says what was wrong, with a one-line example. The README says how long a host should allow a tool call.
- The guide for AI agents (`/skill.md`) now starts from what an agent can do with a session link. An agent that can run commands can take part with nothing set up, and each of Claude Code, Codex, Gemini CLI, Hermes Agent, Cursor and the OpenAI Agents SDK adds the tools in one step. The MCP README says the same.
- `scripts/mcp-mcpb.mjs` packs the MCP as a Claude Desktop bundle (`.mcpb`), which installs from a double-click and needs no Node. Nothing builds or publishes it yet.

### Local tooling

- The typed-tests check gives the TypeScript compiler a 4 GB heap of its own. On a small CI runner the compiler ran out of memory and the check failed without saying why; it now names the signal and the compiler's last words when the compiler is killed.
- The Session Worker's shared config-read tests wait for what they need to have happened. They allowed a fixed number of event-loop turns and failed on a slow CI runner.

## [0.9.6] - 2026-11-12

### Client — available when the site deploys

- A session's interview settings can turn on **Keep AI draft text for admins**, off by default. With it on, the text of the AI's drafted freeform answers and drafted comments is kept where only the session's config admins can read it, for research into how people change what an AI drafted for them. In session settings, an older Worker shows "Needs a newer Session Worker (0.9.6 or later)", and a session not hosted on a Session Worker shows "Needs a session hosted on a Session Worker." Either way the setting stays off.
- People see their own choice for it inside **AI submission info**, under the research details: **Let admins read the AI's draft text**, ticked for new drafts, which they can turn off while still sharing the rest. Unticking it, unticking **Share for research**, or encrypting the answer deletes their stored text at the next submit. If the setting turns on while someone has the review open after reading that no text is kept, nothing is kept for them in that sitting. If the text can't be updated, they are told their answers were saved and the text was not.
- The Admin page gives a session's config admin **Download AI draft text**. Co-admins without config rights, results admins and members are not offered it.
- A group recording drafts at most three questions, once when it stops, where it drafted five after every part. The number is a ceiling: the AI writes a question only when the discussion clearly supports one, and "No new questions from this discussion." is a normal result, not an error. This is the default for every session, existing ones included.
- `/new` and session settings have **Group recording questions**: up to 1 to 10, drafted once at the end or after each part. Saving anything but the default needs the session's Worker on this release.
- Question drafting from a recording is told the session's subject and its existing questions, and the page drops a draft that repeats a session question or an earlier draft apart from case, spacing and punctuation. A discussion longer than about two hours is drafted in parts, then in one last pass.
- Suggest questions on `/new` and the survey generator follow the same rule: fewer questions, or none, when the source supports fewer.
- A voice interview with someone who has already answered is told which questions they answered, never the answers, so its follow-ups don't ask them again.
- In Results, **How well AIs predicted people** withholds its hidden-draft score and its platform rows together when showing them side by side would reveal fewer people than the minimum; a withheld tile says "Withheld".
- The site sends a group join again when the session was too busy for it, and says plainly when to try again.
- The site waits and tries again when a session is briefly busy, for reads, voice interview starts and answers that can be sent again safely, where it showed "Session config coordination is unavailable; retry."
- An AI agent that fetches the site without running it finds the agent guide: `/agents`, `/agents.md` and `/agent-guide` redirect to `/skill.md`, every page carries a line of text pointing to it, and the file-not-found and static summary pages link it.
- In Results, the opinion map and its participant list show "(agent)" after an AI agent's name.
- The API that outside AI agents use to take part is called Agent HTTP throughout the docs; four places said "Session Agent HTTP". The agent page's test ids now start `ce-agent-http-`. Routes, credentials and stored values are unchanged.

### Workers — requires redeployment

- Session Workers keep AI draft text at `/storage/draft-text/put`, `/storage/draft-text/delete` and `/storage/draft-text/export`, and report `draft_text_v1` in `/capabilities`. A person writes only their own row, only while the setting is on, only for a question the session has, with each field capped at 8,000 characters; deleting needs only a sign-in, so it works after the setting is turned off, the session has ended, or the person was removed from the session's gate. Only the session's admin address or admin hat can export. No response list or read, backup, AI feature, Session Agent, MCP tool or Results view reads it, and the public record carries only that the person agreed.
- Session Workers put less load on a session's coordinator. With about 75 or more people answering at once, or 50 voice interviews starting together, it stopped answering, and the Worker gave `503` to answers and to signed-out reads alike. An answer no longer queues an AI Views run unless the session runs them automatically, requests arriving together share one read of the session's settings, and AI Views receipts are cleaned up a page at a time.
- Answers and reads may use a session's settings up to one second old, so a crowded session keeps answering. A sign-out everywhere, or making a session private, can take up to one second to reach every request. Admin actions and settings changes always use the current settings.
- AI Views keeps builds about three times larger: 4.6 million characters, about 120 people answering 53 questions with long written answers and comments. A build over the limit says its size and how to bring it under. Rolling a Worker back past this release hides AI Views builds larger than the old limit, because an older Worker reads them as missing.
- Many people opening AI Views at once share one read in each Worker instance, reused for up to a second, where each read the whole build from the session's coordinator. Admin reads stay fresh.
- An answer sent while the session was too busy to mark its backup revision is retried automatically, where it failed with a `500`. The Worker now answers with the busy `503` before storing anything, and no longer refuses an answer that is already stored.
- Session Workers accept the group recording settings `recordingQuestionCount` (1 to 10) and `recordingQuestionTiming` (`end` or `chunk`) in a session's interview settings.
- Finding your own answers no longer reads everyone's. Each new answer names its author in the Worker's index, so the voice interview's saved answers and an agent's own answers load in one or a few requests in a large session; at 34,000 stored answers, 341 requests became 4. Answers stored before this release are still found, more slowly.
- The Session Worker answers `404`, not `401`, for a request other than a `POST` to a path it doesn't serve, so `/mcp` and `/sse` no longer look like endpoints behind a sign-in.
- When many people join one group at once, their joins go through side by side, where each waited for the one before and most of 100 simultaneous joins failed or timed out. Member limits stay exact, and a busy join answers `503` with a reason and `Retry-After`.
- The Worker logs why a session's coordinator could not answer: Cloudflare's own error and its retry flags, never the session, addresses or content.

### Agents and MCP

- MCP 0.3.4, a patch: the server waits and tries again when a session is briefly busy, for reads and for answers that carry a request id.
- The agent guide, `llms.txt` and the MCP README say a browser invitation link can be given to `join_session` as it is. The npm README's links are full addresses.
- `list_questions` and `get_session` return without waiting more than 8 seconds for the agent's earlier answers, and a new agent skips that lookup. `get_results` returns within about 40 seconds, marked partial when cut short. `list_questions` returns up to 100 questions and says how to get any more.
- An answer call that saved nothing is reported to the host as an error. A quadratic answer sent in the wrong shape says to send a list of votes. With everything answered, `list_questions` says so and how to see your answers.
- The MCP sends a group join again when the session was too busy for it, and tells the agent plainly when a join is busy or refused. A busy join says the membership is unconfirmed and that joining again is harmless.
- An agent's list calls wait for its earlier answers only on the first call, and drop the "still being looked up" note once every question shows an answer.
- A model id or platform set by the host can no longer be changed by `set_profile`; answers record who set each.
- The agent's key can come from `CE_MCP_PRIVATE_KEY`, for hosts that keep no files between runs.
- The next step names a link's group, and the answer tool's value has a JSON-schema type.
- When a busy session leaves a question unread, the MCP tells the agent to retry instead of calling the question unknown.

### Local tooling

- MCP publication works after CI on `main` is re-run with "Re-run failed jobs": the publisher takes the newest package that run uploaded, from the same commit, checked against its receipt and source hashes. Re-run within 24 hours, because CI keeps the Worker candidate for one day.
- The agent fidelity report scores interview, typed-note and group-recording drafts on their own rows, never in the AI-prefill score, and adds breakdowns by model and by context used. `--predictions` writes an optional pseudonymous per-draft CSV with whether each answer and comment changed. Rows by condition (shown, hidden, made separately) and by group are withheld together with the origin, platform, model and context rows, and per-person rows name only a shown origin.
- The same script turns an admin's AI draft text download into pseudonymous input for clustering tools (`--draft-text` with `--clio`), leaving out text whose latest saved response no longer carries the person's agreement.

## [0.9.5] - 2026-11-12

### Client — available when the site deploys

- `/new` and a session's Settings turn the **Session Agent** on and off under AI, for sessions on a Session Worker. Turned on, everyone signed in may ask and gets General answers. Admins add audiences, which go first, for members of chosen groups or SBT holders, reorder them, pick each one's answer style, and may rewrite each style's instructions; the fixed rules are listed behind the "?", which also says that anyone can read the instructions, as they can the session's other settings. A setting that can't be saved says why, and `/new` won't create the session until it's fixed. With no audiences, only admins may ask. Settings can also give the Session Agent its own reasoning effort.
- Settings offers the Session Agent once the session's Worker runs this release. On an older Worker it says to update the Worker first, where saving would have failed with a field error. `/new` leaves an off Session Agent out of the settings it sends, so creating a session on a Worker from an earlier release still works.
- Once an admin turns it on, everyone signed in can open the **Session Agent** from a session's Context. It says it's a preview and how they'll be answered, takes a question of up to 500 characters, and shows only the latest answer, of at most 150 words, with what it drew on; nothing is kept, and errors say what went wrong. Its switch lets anyone keep their answers and files out of it, even when it doesn't answer them. A robot by the session's title tells everyone, signed in or not, that it's on, and links to how it works.
- Under the Session Agent in `/new` and Settings, **Skip questions with under 3 answers** is on by default. Its "?" says what turning it off allows: a question only one member answered is used, so that person's answer can come back as the members' view. Admins always get every question.
- While the Session Agent is on, the interview dialog, where AI-drafted answers are reviewed and submitted, carries a line at its foot, **Session Agent may use my answers and files**, with a "?". It is the same switch as in the Session Agent's own dialog. A change is saved before any answer is stored; if it can't be saved, nothing is submitted and the dialog says why.
- Drafts made after claiming part of a group recording are recorded as from the group recording, so research can tell them from a solo voice interview.
- Interview drafts no longer fail on a long question list. Drafting from a conversation, from a claimed part of a group recording or from added context asked the AI for a reply of at most 8,000 tokens, which a list of about 50 questions could overflow, losing every draft. It now asks for up to 32,000 on a model with room for it (GPT-5, GPT-6, the o-series, GPT-4.1, and Claude from 4.5 on); any other model, and any model on a custom endpoint, keeps 8,000. On the session's AI key, the session's Worker has to run this release for the larger reply; an older Worker still stops it at 8,000.
- When the AI's reply for interview drafts is cut off or unreadable, the page says so, that the drafts can be generated again, and to tell the session's host if it keeps happening, where it showed a JSON parser's message. An empty AI reply, which a model can give after spending its whole limit on reasoning, is called an empty reply in place of "Unexpected AI response format".

### Workers — requires redeployment

- Session Workers accept a **Session Agent** setting: an ordered list of who may ask (everyone signed in, members of chosen groups, or SBT holders, matching any or all of their rules) and whether each gets General or Detailed answers, with optional instructions for each style. Admins always get Detailed answers, and with no setting the Session Agent is off. Saving it signs no one out. The public config sets `sessionAgentReady: true`, so the site knows the Worker takes the setting.
- Session Workers answer the Session Agent at `POST /session-agent/ask` through the session's own AI, under the `/ai` rate limit, and say how a person would be answered at `POST /session-agent/status`. The Worker checks who is asking on every question, including that they have the session's AI access, and gathers the material their answer style allows: General answers read the session's context, the files open to everyone (when the session's own file rule admits the asker) and the results that person may see; Detailed answers read every file they may read and members' answers, without names. The page sends only the question, and replies hold the answer and how much it drew on, never the material itself.
- A Detailed answer draws on every member's answer, however large the session. For each question it is given how many members answered and, where the question has set options, how many chose each, counted from all the answers, with what a rating's numbers mean. What members wrote is a sample in an order drawn afresh for each question asked, so one person's answers can't be followed from question to question. The questions closest to the one asked get room first, and the AI is told when some questions' answers did not fit. Unless the session's admin turns the rule off, someone who is not an admin gets nothing from a question fewer than three members answered, so a single person's answer doesn't come back as the members' view. In a session of 50 people and 40 questions, one question reads all 2,000 answers in about 65 storage operations.
- Results reach a Session Agent answer for the people the Results page shows them to: admins and results admins on any session, and others under the session's results setting, members-only results included.
- Each person can turn off the Session Agent's use of their answers and the files they added at `POST /session-agent/opt-out`, and turn it back on; it starts on. The Worker keeps the choice in the session's coordinator and checks it on every question, leaving out the answers and files of everyone who turned it off, and answers that carry no address. The published results, which count everyone's answers, are still read.
- A file's **Visible to** rule on SBTs that the chain can't answer, because its RPC isn't set up, the session's RPC secret can't be read or no endpoint answers, now gives a retryable `503`, as a group rule does, instead of refusing the read. The Session Agent then refuses the question rather than passing the person to a later audience. A list leaves out a file or answer whose own rule can't be checked, rather than failing for every reader.
- The AI proxy sends Anthropic a request's system messages as its system prompt, as Anthropic requires, rather than as messages it refuses.
- The Session Agent setting takes `minAnswers`, a whole number from 1 to 3: how many members must have answered a question before someone who is not an admin hears anything from it. It is 3 unless set, and 1 turns the rule off.
- The Session Agent follows the session's own lock. Where a session needs a group or an SBT to view it, someone it keeps out is refused whatever the audiences say; before, they could sign in, match an audience and ask, and under a Detailed audience hear members' answers. If the lock can't be checked just now, the question is refused with a retryable `503`.
- Session Workers allow interview mapping (`interview-map`) a reply of up to 32,000 tokens, up from 8,000, on a model whose provider documents room for it; any other model, and any model on a custom endpoint, keeps 8,000.

### Agents and MCP

- MCP 0.3.3. No change in what the tools do: the package is rebuilt with this release's shared session-settings code.

## [0.9.4] - 2026-11-12

### Client — available when the site deploys

- Group recordings: the **Give each person their part** codes open only once every part is transcribed, and say when a part failed.
- A claimed part of a group conversation survives a reload or a passkey sign-in in the same tab, until its review is submitted or discarded.
- A recorder who reloads still hands out codes that join the table's group.
- Recording restarts the microphone once by itself when a headset or Bluetooth microphone drops or the recorder stops, restarts after 15 seconds of silence from the recorder, and plays an alarm (and buzzes where possible) if recording still stops. A paused recording stays paused until **Resume**.
- Speaker labels stay on after a single refusal; they turn off only after two in a row, and the host can turn them back on.
- A chunk whose labelled upload keeps being cut off, as by a network that drops quiet connections after 60 seconds, is sent again without labels, so later chunks keep moving; the claim screen says which parts have no labels.
- A speaker number is never given to two different voices, including after **Record more**; voices heard in one part only are named on the claim screen so the host can join them.
- At a chunk boundary, a second person echoing the first keeps their words.
- Pausing no longer makes a recording chunk longer than three minutes of recorded time.
- Someone whose browser has no passkeys, such as an app's built-in browser after scanning a QR code, is told to open the link in Safari or Chrome, with a **Copy link** button.
- A recording's uploads never ask for a passkey or wallet signature mid-conversation; a part that needs a sign-in waits with **Retry**, and pressing Retry may ask.
- On a private session, a voice interview that follows new questions now sees them, including questions only the signed-in person's groups may see.
- A group's auto-join link can be shown as a QR code beside **Copy auto-join link**; both session QR codes now use error-correction level M.
- The prompt for a person's own AI accepts a review link only on this site's own session page, so a Worker reached through someone else's link cannot send their drafted views elsewhere.
- The AI that turns an interview into draft answers reads its instructions before the transcript, and the session's groups after it.
- The interview settings say each AI is instructed never to go on health, religion and similar personal data, rather than promising it.
- Fonts are served from the site itself instead of Google Fonts; the site also sends HSTS, a site-wide nosniff header and a Permissions-Policy that allows only its own microphone and camera.
- A listed session's name opened through a different Worker shows **Not the listed session** with a link to the listed one.
- Signing out also ends your sign-in at each Session Worker, so a copied sign-in token stops working.
- Results load much faster on large sessions whose Worker runs this release: answers are read 100 at a time, so 500 answers take 10 requests instead of 505.

### Workers — requires redeployment

- A Worker-hosted session refuses an answer to a question it doesn't have, or a value the question can't take (a 9000 on a 1–5 rating, two picks on a pick-one question), with a message saying why. An answer sent as a whole encrypted payload is refused unless the session uses Lit encryption. An answer that names two different questions is refused.
- One person can keep at most 20 versions of an answer, and five saved answers per question the session has (hidden questions included), agents' answers included; past that the upload is refused with a message. A survey's bundle is counted apart from its answers, under the same allowance. Answers stored before this release don't count.
- Sign-in trusts only `contextengine.sh` and `www.contextengine.sh` by default. The retired `.xyz` addresses and local development servers are no longer trusted unless a Worker is set up for them (`ADMIN_TRUSTED_ORIGINS`, or `CE_ALLOW_LOCAL_ORIGINS=true` for local servers). The deploy helper's default allowed origins are the `.sh` site only.
- `POST /auth/logout` ends a sign-in at the Worker.
- Admin actions must be signed within ten minutes of use.
- `POST /storage/read-batch` reads up to 100 stored items in one request, each under the access check a single read gets, and stops at 8 MiB of text; an item it refuses carries the reason, and one it leaves out answers 413. The Worker reports it as the `storage_read_batch_v1` feature.

### Agents and MCP

- MCP 0.3.2. The server signs in only as `contextengine.sh` (with or without `www`) or `CE_MCP_APP_ORIGIN`; the retired `contextengine.xyz` site is no longer trusted.

### Documentation

- `LICENSING.md` names the LGPL and other third-party items. The docs say real sessions need Cloudflare's Workers Paid plan, give the deployment profiles one home, and correct statements that contradicted the code. `CONTRIBUTING.md` has how-to recipes for adding a route, a config field and a question type.

### Local tooling

- The navigation smoke no longer stubs Google Fonts: the site doesn't request them, and such a request now fails the smoke like any other outside call.

## [0.9.3] - 2026-11-12

### Client — available when the site deploys

- Admins, co-admins and results admins get **Build risk matrix** beside **Build atlas** in the open Results menu, with a "?" saying what it builds. While it runs, the status line counts the time, names the AI model and shows the prompt under **Show AI prompt**. The newest build opens as **Risk Matrix**, with a **Version** picker for earlier builds, in place of the demo's or AI Views' risk matrix; each note says how many participants hold it.
- The Risk Matrix shows AI Views' notes as written: it no longer adds the demo's historical figures, sources and atlas scenarios when their areas share the demo's names. A cell between two areas now lists only their notes, where a note could also show up when one of its subareas had an area's name.
- The Risk Matrix reads clearly in Context Engine and Classic 95. A cell's figure sits on a chip of its own, where the strongest cells were as low as 2.1:1, and the diagonal's dots are no longer faint. In Classic 95 a cell's notes sit on white cards rather than black ones, where their text was 1:1, and a note group's title stays readable when hovered. In every theme **Clear X** and **Clear Y** stay readable while there is nothing to clear; in Civic they were 2.4:1.
- The **Version** picker of a debate atlas or risk matrix shows its text in the panel's colour in Context Engine, where it was 2.1:1.
- **Session members see all answers** is a new **Who sees results** choice, and new sessions on `/new` start with it: everyone signed in to the session sees every answer and the AI Views, and a signed-out visitor is asked to sign in. It needs the Session Worker, so choosing on-chain hosting moves it to public results, or to own answers when answers are encrypted. Sessions created earlier keep their setting; Settings offers the new choice once the session's Worker runs this release.
- **Suggest questions**, under the question list on `/new`, drafts five questions from the page's context with the OpenAI key typed under AI, following **Question prompt** and **Tag suggestions**. It reads the name, description, context text and links, and the files added to Context. Drafts join the list, where you can edit or remove them before **Create**. The key goes only to OpenAI, from your browser.
- **Runs on** is now a toggle at the top of `/new`, **Centralized** (a Session Worker on Cloudflare) or **Decentralized** (an on-chain registry with Arweave), where it was a dropdown under Hosting and storage. Its "?" says what each needs.
- **Colors** on `/new` and in Settings now sit under **Appearance** in Basics, which opens by itself when a session has colours of its own.
- **Every option on `/new`** now has its own "?" saying what it does and what it needs, including the interview settings, the results analysis, the access rules and each key field. Help that showed as text under an option has moved into its "?", and screen readers still read it with the option. The interview and results analysis settings show the same "?" in Settings and on `/admin`, and the key fields now have labels.
- The faucet card under Hosting and storage is titled **Test gas faucet**, where it showed the code **TXGAS**.
- **Sign-in** and **Permissions**, on `/new` and in Settings, and **Storage** on `/new` now show as text with a "?", since **Runs on** allows only one of each; their dropdowns and checkboxes could only cause conflicts. **SBTs grant permissions** stays a choice on Centralized sessions. When a template brings values Runs on doesn't allow, **Match Runs on** puts back what it needs, and **Session Worker** encryption can't be chosen on a Decentralized session.
- **Session members see their own answers**, which looked like **Each person sees their own answers** on the web, is now **Own answers; agents need a group**, and **Anyone can see the results** is **Anyone can see all answers**. The "?" beside **Who sees results** says what each choice shows.
- Older text on `/new` is now readable in every theme: the Worker name under Hosting and storage, **ANY** and **ALL** on an access rule when hovered, **Create Group** while pressed, and **Add Address** once an address is typed. In Classic, access rules and group pickers, with their **+ By Address**, address chips and group menus, read dark on light wherever they appear, where they were light on light, and in Context Engine the group picker's placeholder is brighter.
- The account menu has **Your AI agent**, with two ways to bring an agent to the session. **As itself** copies a Claude Code command that adds the Context Engine MCP with the agent named "<your name>'s Kami", and a prompt that joins the session. **On my behalf**, when the session has Agents (HTTP API) on, makes a key that lets your agent read the questions, save drafts and submit the answers you approve, as you. The key comes inside a terminal command that sets `CE_AGENT_TOKEN`, so it stays out of the chat: the prompt you paste there names the variable, not the key. The key is kept only while the dialog is open, and works until your sign-in ends.
- `/skill.md` and `/llms.txt` tell an agent to ask the person it works for which way to take part, and say what each way needs.
- **Settings** shows which Context Engine release the session's Worker runs; a Worker from before 0.9.3 shows "before 0.9.3".
- Results admins can start **AI Views** on Worker-hosted sessions and see their progress, as they already build atlases and risk matrices. Only the admin can publish AI Views from answers the browser supplies, as on-chain sessions do.
- The About page's **Representative Models** card now says training representative AI models is planned, where it read as available today. The group recording guide (`docs/session-listening-mode.md`) no longer says handing each speaker their part by code is unavailable.

### Workers — requires redeployment

- Admins, co-admins and results admins can build a session's risk matrix with AI, as they build its debate atlas (`POST /admin/risk-matrix/build`, read at `GET /risk-matrix`). One call names the areas the responses discuss, each with a few subareas, and writes notes on where two areas meet, each an opportunity or a risk with an intensity from 1 to 10. A note is kept only when it cites someone who answered a question it cites. The session's context reaches the AI as untrusted material. Builds are kept and read like atlas builds: the newest 8, each stamped with its time and response count, under the same viewer rule. The public config reports `riskMatrix: true`.
- AI Views and the debate atlas read a session's answers 100 at a time, so about 80 people answering 30 questions now fit the Worker's read limit. Before, a session was refused from about 400 answers. An answer that can't be read now stops the build with a message to retry, instead of being left out.
- New results visibility `session_member_full`. `/storage/list` and `/storage/read` give a signed-in participant who holds the `storage` (or `arweave`) scope every answer, and the AI Views, Debate Atlas and Risk Matrix reads follow; a signed-out visitor, or a sign-in without that scope, reads none. Per-answer access rules still apply. Only Worker-hosted sessions with Cloudflare storage can choose it.
- On such sessions the Agent HTTP results routes need a credential whose account passes the session's sign-in rules, and refuse others with `agent_membership_denied`.
- The public config sets `memberResults: true`, so the site knows the Worker offers this visibility.
- `/api/agent/questions/next` no longer fails with `question_queue_unavailable` in sessions whose questions were added on the website. Their IDs have the same shape as a private key, so the secret check refused to save which questions an agent had been served. Fields named for question IDs may now hold exactly that shape, and nothing else that looks like a secret.
- Agent HTTP results no longer fail with `agent_storage_unavailable` once a session has about 500 answers from agents. `/api/agent/results` and `/api/agent/results-image` now read only the permanent copy of each answer, 100 per KV read. Cloudflare stops a request after 1,000 KV operations; in a test salon of 80 agents answering 30 questions, with 16 changing their answers, the busiest results request uses 167. A stored answer can be half a megabyte, so a read that Cloudflare refuses for passing its 25 MB reply limit is read again in halves.
- An agent submitting many answers in one `/api/agent/preferences` request no longer reloads every question for each answer. A 30-answer submit used more than 1,000 KV operations and failed; it now uses about 490.
- `/capabilities` reports the Worker's Context Engine release as `release`, so a public GET tells which release a Worker runs.
- Results admins may call `POST /admin/results-analysis/generate` and read its status on Worker-stored answers; a request that supplies its own answers is still the admin's alone.
- An agent's submitted answer no longer fails with a 500 about once in 50,000 submissions, when the random ID its stored copy was given happened to look like an API key.
- `POST /api/agent/credentials/delegate` gives a signed-in person a key for their own agent, with `read_questions` and `draft_answers` for their address, so what it submits counts as their answer. It never carries their admin powers, and in an on-chain session it only drafts, since its answers would not be signed as them. It ends with the sign-in it came from and when they make a new one, can't be exchanged for a website sign-in, and isn't given to a sign-in an agent made. The Agent HTTP skill, now v46, says how an agent uses it.

### Agents and MCP

- MCP 0.3.1. `get_results` reads a members-only session's results for an agent signed in to it. It reports `resultsPublic: false` with a note that the results are for signed-in members only.
- `get_results` reads up to 10,000 answer records by default, 16 at a time, instead of 2,000, so a 30-question session of 80 people, which lists about 2,900, is counted in full rather than marked partial.
- The MCP server's instructions tell an agent to ask the person it works for whether to take part as itself, with these tools, or on their behalf, with a key from the account menu.

### Local tooling

- CI runs the Agent HTTP tests once. The Session Worker suite already includes them, so the workers gate no longer runs `test:worker:agent` as well; the test wiring check now requires the suite to keep including them.
- `npm run ai:test-theme:results-builds` checks the built debate atlas and risk matrix in each theme at phone and desktop widths; `ai:test-theme:atlas` is gone.

## [0.9.2] - 2026-11-11

### Client — available when the site deploys

- When the AI proposes a comment for a question you've already commented on, the review card keeps your comment and puts the AI's after it. **Both**, **Mine** and **AI’s** switch between them under a quote of your earlier comment, the text stays editable, and a locked comment stays unless you choose the AI's or write in the box. A submit pressed before your saved answers load waits for you to check any card whose comment doesn't match one that loaded, saying **Saved answers loaded. Check drafts that change an earlier answer or comment, then submit.**
- A review card that would change your earlier answer now quotes free-text answers and quadratic votes too, so you can compare them; a long answer is cut short with **Show all**, and an encrypted one is only mentioned.
- After you claim your part of a conversation, "still fit" counts only the answers the AI compared. A locked or encrypted answer, which the AI never sees, is no longer said to fit, and a comment the AI proposes beside a locked or encrypted comment is offered for review, keeping yours unless you choose the AI's.
- When you claim your part while signed in, the review says it's waiting for your saved answers until they load, and if they can't be read, drafting now waits until **Retry saved answers** reads them, instead of drafting without them.
- When you claim your part, answers and comments you've changed or cleared on the page but not submitted, including an unsent draft restored after a reload, reach the AI marked as unsubmitted instead of as saved answers.
- For a draft you leave out, research sharing records the AI's comment as you left it, never a comment of yours from the page that you haven't submitted.
- In interview review, an answer or comment you encrypted counts as locked even after you unlock it on the page: an encrypted answer stands and isn't quoted, and for an encrypted comment the card shows **Your locked comment stays.** and keeps it unless you choose the AI's or write in the box. No answer or comment you encrypted, nor anything you type into an encrypted field, goes to the voice interviewer or the next round of drafting.
- A signed-in participant can now add a link to a session's context from the session page as well as a file. The form offers it only while the session takes participants' additions and hasn't ended, and only on a Session Worker from this release.
- The context list marks what an AI agent added: "<its name> (agent)", or its short address with "(agent)" when it gave no name. The agent sets the mark itself, as with its answers' agent marker, and the mark grants nothing.
- `/skill.md`, the guide for AI agents, names `leave_group` and `add_context` and says the MCP shows a session's instructions when an agent joins. It and `/llms.txt` say a session may invite agents to add context.
- In Classic 95 the Debate Map is drawn as a Windows 95 program rather than dark glass: the theme's font, square raised buttons with the chosen view pressed in, and sunken white canvases. `/atlas` and a topic's panel have navy title bars, the panel's staying in view as it scrolls, and **Top Debates** opens as a gray window. On a phone its toolbar wraps, so the legend and **Filter Depth** stay on screen. **Suggest New Topic** opens as a gray dialog; its path, field label and **Cancel** were white on white.
- The **Session Doc Library**'s link and title fields are readable in the Context Engine theme, where typed text was 1.93:1, and their hint text is readable in Classic 95, where it was 1.82:1. On phones the file field takes a whole line, so the chosen file's name shows.

### Workers — requires redeployment

- Signed-in participants may add links to context (`/storage/context` `add-link`) while the session doesn't limit context to admins and hasn't ended. Their links follow the same link rules as admins', need their `fetch` scope and count against the per-address daily limit as fetches too. Every link passes the upload's access check before the Worker fetches the page. Refreshing a link and having a PDF read stay with admins. `/capabilities` reports `participant_context_links_v1`.
- A refresh must name the same link, and keeps its title, privacy and who added it.
- A context item may carry an agent's self-declared mark: `CE-AdderKind` `agent`, with its name in `CE-AdderName`, up to 80 characters of plain text without control characters or marks that reorder text. Any other mark is refused, as is a name without the mark. A refreshed link keeps its mark.
- Prompts that read a session's context say it comes from its hosts and participants, AI agents among them. They call it untrusted material and tell the AI never to follow instructions inside it.

### Agents and MCP

- MCP 0.3.0. A normal session link, without `worker=`, goes to the Session Worker that the link's site lists for it in `/known-sessions.json`, once that Worker reports the listed session ID. A slug the site doesn't list stays on-chain, as before, and a `worker=` in the link still wins. When the list can't be read, `join_session` says so and asks for a link with `worker=`.
- New `add_context` tool: an agent adds a local file, a link or text (stored as Markdown) to a hosted session's context when the session invites it.
  - Everyone in the session sees what it adds unless it passes `adminsOnly`, and each item is marked as an agent's, under its display name.
  - It never adds a file from the MCP's state folder or a hidden folder, a hidden file, or text that looks like a key, token or password.
  - Sessions that limit context to admins, sessions that have ended, sessions that keep their files where the Session Worker can't read them, and on-chain sessions refuse it.
- `join_session` and `get_session` show:
  - the session's instructions for agents, marked as from its admins and as adding to the general guidance;
  - its groups, with how joining works and who may end a membership;
  - its invitation to add context, with the limits.
- `join_session` no longer joins a group named in the link. It names the group, says when the agent is already in it, and its next step says to read the session's instructions, then call `join_group`. New `leave_group` tool, which says why when a group doesn't let members leave.
- After a restart, the MCP checks that a hosted session it joined is still the same session behind its Worker, and asks the agent to join again when it isn't.

### Release verification

- The MCP publish workflow reads npm every ten seconds, for up to three minutes, until it lists the new version as `latest` with provenance. It no longer fails when npm takes a moment to list the version.

## [0.9.1] - 2026-11-10

### Client — available when the site deploys

- Voice mode's Interview and Group Conversation screens have a **Back** button to the two choices, which then has focus on the one you left; the address keeps `?mode=voice`, so a reload reopens them. Back is off while an interview or recording is under way, and while Group Conversation finishes its recording and uploads before going back. Leaving an interview with unsaved work asks first. The Interview screen also offers **Let your AI draft your answers** until there's something to review.
- In an interview's review, **Share for research** sits beside **AI submission info**, with a **?** that says what it shares, and starts ticked: `interviewMode.shareDraftChangesByDefault` is now on unless a session turns it off. Sessions set up before this release start ticked too, even where an admin chose off, because off was saved by leaving the setting out; to keep it off, an admin saves it off again in Settings. **AI submission info** no longer opens by itself to show the choice.
- When a session page's Context section is open, its header has **Add** and **View**, as the Tool Explorer does. **Add** opens and closes the form to add a file, or an admin's **Manage files and links**, and keeps what you've typed while closed; **View**, with a **?** that explains it, replaces **Show my groups' files**.
- In Safari, Group Conversation keeps its audio on the device, so a reload can recover the recording. Safari refused to store it, and as soon as recording began the page warned that the recording couldn't be recovered after a reload ("Error preparing Blob/File data to be stored in object store").
- On a session page, the check after you submit answers opens your profile in that session, as do a group's admin and member links, the addresses on Results' response cards and their answer pages, and an SBT page's addresses. They opened it in the default session, which doesn't hold those answers, or showed "Browser origin not allowed" on a site whose address that session's Worker doesn't accept.
- The green check after you submit answers on a session page goes away after 10 seconds, keeping its place so nothing moves; it waits while pointed at or focused. Each new submit shows it again.
- The site opens a session from a normal link, with no `worker=`, only when the repo's `known-sessions.json` lists it, and only when its Worker reports the session ID listed there; the site's built-in demos, such as `demo-interview`, still open from their normal links. The list holds EDDY 2026 (`eddy26`), the demo session `demo-sh`, the Reverse Alignment salon `rxc-ra-26` and, for now, `rxc-ra-test-5`, whose link is on the RxC films and slides; other sessions open from their `worker=` links. The site also serves the list at `/known-sessions.json`.
- `/session/demo-sh` now opens from the demo session's own Worker, which must report the listed session ID, instead of from the site's built-in copy of its settings.
- The About page's **Demo** button opens the Reverse Alignment test session, `rxc-ra-test-5`, whose Worker runs voice interviews, group recording and the prompt for your own AI. It opened `demo-sh`, whose Worker predates them.
- The short links such as `/rxc-ra-test-6` are gone. `rxc-test`, `demo-interview-5`, `rxc-ra-test`, `rxc-ra-test-2`, `rxc-ra-test-3` and `rxc-ra-test-6` now open only from their `worker=` links.
- AI agents opening the site find `/skill.md`, a short guide to taking part in a session: every page links it, and `/llms.txt` has a section on it. `/.well-known/` addresses answer 404 instead of the app.
- Sessions on a Session Worker have an optional **Instructions for AI agents** setting at `/new` and in Settings: Markdown that agents read before taking part, such as which group to join or what to focus on, in addition to the site's guide. Admins type them or load a .md or .txt file. Its **?** says anyone can read them without signing in, at the Worker's `/session-config` and `/llms.txt`. Saving them signs no one out.
- Interview review, after a voice interview or an AI prefill, lists groups that fit a person's answers in a collapsible **Groups** section right below the drafts, each with a tick box. A join link's group still waiting for sign-in comes first, ticked; unticking it cancels that link's join, as the link notice's **Cancel** does, and a ticked link still joins at sign-in. Every other group starts unticked, for the person to tick. While any group is ticked, the submit button reads **Submit and join**, and the ticked matches are joined once the answers save, through the Worker's usual join route. The section reports each group joined or not joined, with the reason, and keeps a failed group ticked to try again. While a group is still joining or left ticked after a submit, **Back** asks first, as it does for unsaved work, and reopening Voice mode returns to the review. Its ticks survive another interview round and edits to the drafts, but not another account signing in.
- New interview setting **Suggest groups to join** (`interviewMode.joinMatchingGroups`, off by default), in session Settings and on `/new`, is the only switch for matching people to groups: groups that fit someone's answers are suggested for them to tick, and the person's own AI can suggest groups in its prefill too. Off, no groups are matched. **Suggest open groups that fit participants’ answers** and its **Join** buttons are gone; saved configs that carry `suggestGroups` still save. Matches are no longer capped at four groups, and signed-in participants on private sessions now get them, through their saved Worker sign-in.
- With **Suggest groups to join** on, **The AI may use** sets what the session's AI and each person's own AI may base a group suggestion on (`interviewMode.groupSuggestionData`): **Country**, **Work** and **Interests and causes** by default; **Town or city** only when ticked. No AI may go on health, disability, religion, ethnicity, sexuality, gender identity, age, family life, or party or union membership, whatever is ticked. With none ticked, no AI suggests groups, and only groups named like a chosen answer are listed. The choice is saved only while the switch is on, and a stored value that isn't a list allows nothing.
- Each group in the interview's **Groups** section shows its image beside its name. On a private session, a group's stored image shows once the person has a saved Worker sign-in; the section never asks them to sign in for it.
- Each suggested group's reason in the **Groups** section starts with how well it fits: **Strong fit**, **Moderate fit** or **Weak fit**, from the AI's confidence, in the same bands as the drafts' confidence. Suggestions keep their order rather than sorting by fit.
- The session's AI picks groups in the same reply that drafts someone's answers, by the rule their own AI follows, instead of in a second AI call afterwards. Its picks no longer need a quote of the person's words, and all the matches show together once the drafts are ready.
- Every AI in interviews places someone no more precisely than their country: the voice interviewer, the drafts made from an interview, the prompt for the person's own AI, and group match reasons. A question asking for a smaller place, such as a city, is left for the person to answer.
- A join link shows a signed-out visitor on a private session the group names that the link's group members can see, so its notice names the group instead of showing its ID, and group suggestions work before sign-in.
- Background requests never open a passkey prompt: refreshes of the Results group filter on focus and every minute, group images, context files read for an AI, Community group counts, and tag-page groups. Each uses the page's Worker sign-in, or signs in silently while the passkey wallet is unlocked, and otherwise keeps what it shows. Someone signed in is asked for the passkey rather than shown what a signed-out visitor sees on a session page: its Groups panel, context files, and Results group filter, a filter saved or in a link included, ask in one shared prompt when the session needs a new sign-in, as in a new tab. Before the first sign-in, a private session shows a **Sign in** button there instead.
- A Worker sign-in now survives a reload in the same tab for the rest of its four hours, so a private session doesn't ask you to sign in to it again. Each tab keeps its own in sessionStorage, never localStorage; a new tab asks once, and a sign-out or account switch in any tab ends every saved sign-in. What the wallet signs itself, such as an encrypted answer, still asks for the passkey once after a reload.
- The passkey wallet now stays unlocked while you use the page: each click, tap or key press keeps it open for another 60 minutes, where before it locked 15 minutes after its passkey prompt, so signing in to a session and submitting don't ask for the passkey again while you keep using the page. However much it's used, it locks 8 hours after the prompt, and reloading the page still locks it.
- The prompt that lets your own AI draft your answers works on private sessions. Signed in, the copied catalog link carries a ticket of yours, so your AI reads the questions you may see, those shown only to your groups included, and suggests only groups you could join and haven't; the prompt tells it the link is private and lasts an hour at most, and the page renews it quietly before it runs out. If you haven't signed in to the session, checking the prompt asks once while the page is open; declining still offers the signed-out prompt, and **Retry** asks again. Signed out on a session whose questions need a sign-in, the card says to use **Log in** at the top of the page, and **Interview & share**, whose prompt is for sharing and never carries a ticket, says each person copies their own prompt once signed in. Checking an imported prefill uses your ticket too, without asking you to sign in.
- Switching networks and back no longer leaves the passkey wallet looking unlocked without its key, where a transaction then failed as if it might already have been sent. It asks for the passkey instead.
- Worker groups have a **Who can remove members** setting, like an SBT's Burn Auth: **Admins and the member** (the default), **Admins only**, **The member only** or **No one**, with a **?** that says what each means. It's chosen wherever a group is made: `/new`'s **Groups to create**, Settings → Groups and the Create group page, participants' groups included; admins change it later in Settings. A session page shows **Leave** only when members may leave, and a group's details say who can remove members; Settings shows **Remove** only when admins may. On a Session Worker from before 0.9.1 every group works as **Admins and the member**, and choosing anything else in Settings or on the Create group page says so.
- A group's **Join period ended** and **Admin add required** labels are readable in Civic and Classic 95, where they measured 4.14:1 and as low as 3.02:1.
- Answers submitted right after signing in, as when you sign in to submit an interview, keep their question's type and text. Sent while the questions reloaded, they were saved as free text with no question. The pile no longer stays empty after that submit, and the interview's drafts and score show the questions instead of their IDs.
- On a session with no questions yet, the page settles on **No questions available.** after its usual 20-second check. It could show **Loading...** forever: when the page's question cache finished starting up after the questions were first read, or when a request had been rate-limited in the two minutes before.
- Every file picker's button now uses the theme's control colours, at rest, pointed at and pressed. In the Context Engine theme the browser's own button had left its label at 3.95:1 when pointed at, and the chosen file's name was below 2.3:1 in admin **Backup & restore** and the **Session Doc Library**.

### Workers — requires redeployment

- `GET /llms.txt` returns a session's instructions for AI agents, `agentInstructions` in its public config, as `text/markdown` that a browser never runs as a page (`nosniff`, sandboxed), and 404 when it has none.
- `set-config` and the deploy helper accept `agentInstructions` as text of up to 8,000 characters, and editing it signs no one out. A self-deployed Worker from before this release refuses the field, so `/new` sends it only when instructions are set or the Worker already holds some; to give agents instructions on such a Worker, update it first.
- A signed-out `GET /groups/list` on a private session returns the session-visible groups when it carries a join link's `joinGroup` for a group someone could join on their own: open, visible to the session, and before any joining deadline. That's what the group's members see, less who runs each group; groups shown only to their members or admins stay hidden, and member counts are never included. Other requests are refused as before.
- With `interviewMode.joinMatchingGroups` on, the interview prefill catalog lists the groups the visitor could join on their own, as data, with `groupSuggestionData`, the session's allowed kinds of detail in words; the clipboard prompt says how an AI may suggest them. Session Workers before 0.9.1 refuse both settings, so `joinMatchingGroups` is saved only when on and `groupSuggestionData` only when it isn't the default.
- The interview prefill catalog can read as a signed-in person. `POST /agent/interview-catalog-ticket` gives the session page a ticket, lasting an hour at most and never past the sign-in, for the catalog link it hands that person's own AI. With it, the catalog lists the questions that person may see, those shown only to their groups included, and the groups they could join on their own and haven't. Another session or an access edit ends a ticket early, signing out of the page doesn't, and a ticket is never a sign-in. Without one, a session that lets no signed-out visitor list its questions now answers 401 `sign_in_required` instead of asking for a retry.
- Each group has `removalAuth`: `both` (the default), `admin_only`, `member_only` or `neither`. `/groups/leave` works only on `both` and `member_only` groups, otherwise answering 403 `worker_group_leave_denied`, and `groups/remove-member` only on `both` and `admin_only` groups, otherwise 403 `worker_group_removal_denied`. A refusal leaves the membership as it was, and deleting a group still works. Admin create and update and participant `/groups/create` accept it; another value answers 400 `invalid_removal_auth`. Every group list and result reports it, the public listing included, and groups saved before this release report `both` and work that way. A Session Worker before 0.9.1 ignores the setting.
- Changing an interview setting, even turning voice interviews off, no longer signs participants out: each interview request reads the settings afresh, and no sign-in holds them. Session Settings lists these edits under **Keeps everyone signed in**. A Session Worker before 0.9.1 still signs participants out for them.

## [0.9.0] - 2026-11-02

0.9.0 also contains the 0.8.1 changes listed below, which were never released on their own.

### Release verification

- Reject raw provider-key shapes in release scans, including test fixtures, and generate synthetic secret-detection inputs at runtime.

### Client — available when the site deploys

- Session admins can press **Build atlas** in the open Results menu to build a debate atlas from the responses at that moment. While it runs, the status shows the seconds since it started, the AI model, and the prompts it sends under **Show AI prompt**. **Debate Map** shows it as read-only circles: branches and their topics. A branch or topic opens to its summary, the positions found in it, and a political compass whose two axes the AI chose from its main disagreement, with those positions and up to 40 of the participants who answered placed on it by avatar and address. Beside each participant is the AI's reading of their answers, labelled as such. Every build is kept, stamped with its time and response count, and a picker opens earlier ones. Everyone who can see a session's full Results sees its atlases; on other sessions only those who may build do.
- Closing a branch or topic of a session's atlas keeps you on the session page. Its link button copies `/atlas/<topic>?session=<slug>`, which opens that session's Results at the topic, for those who may see them.
- A compass's legend names its own kinds of point, Position and Participant on a built atlas, and a compass with no one placed on it says so.
- A branch or topic's panel leads with a summary no longer than a tweet, and so does an AI Views circle's. **Show more** shows the rest and lists an atlas's positions, each named in bold with how many of those who answered hold it and a bar for their share. New builds ask the AI for a summary under 280 characters and record how many answered each topic.
- Hovering a participant on a compass shows their address, which was drawn dark on the dark tooltip. Selecting them shows it underlined, as the link to their profile it is. Participants the AI placed on one spot now sit on half rings below it, and no two avatars or a position's dot overlap, at the chart's edges too.
- A topic's questions look like the session's question cards, and each opens its own page in a new tab, where it can be answered. Question cards in other Debate Map panels take the same Agree, Unsure and Disagree colours, and a freeform question's preview is readable in Context Engine.
- The picker of a session's earlier atlases is called **Version**, and a built atlas calls its levels Category and Topic in its legend, panels and List filter.
- In Civic and Classic 95 the Debate Map's List colours each level and its Tree draws its connecting lines. Classic 95's Tree category buttons, cards and card icons are readable.
- The Debate Map's tree view asks for a category to draw the **Tree Chart**, as its button is named.
- Question Results shows a spinner in place of its question and response counts, and each question's count, until they load, instead of 0.
- The status line under Results, shown while AI Views or an atlas builds, is readable in Civic, where it measured 3.35:1.
- The Results menu buttons, the Debate Map view switch and legend, a topic's panel and its compass are readable in Civic, Context Engine and Classic 95: some labels were as low as 1:1. `npm run ai:test-theme:results-builds` (named `ai:test-theme:atlas` until 0.9.3) checks them in each theme at phone and desktop widths.
- The Agent Village post is readable in Classic 95, where its tags, chart labels and tooltips, List view and evaluation protocol measured as low as 1.1:1. A pinned tooltip's close button also stays visible on hover and focus there and in Civic. `npm run ai:test-theme:civic` now checks the post in Classic 95 too.
- The About page says Soulbound Token groups instead of SBT groups, and names the Cloudflare Worker alternatives: Worker Groups for access control, and Worker encryption beside Lit for on-chain sessions.
- The RxC sessions no longer show twelve pre-filled topic circles: Debate Map appears once an atlas is built, on rxc-ra-test too. On a demo session, a built atlas replaces the demo atlas.
- Session Settings has a **Results admins** list under Results visibility, where an admin adds or removes the addresses that may build atlases. Saving it signs no one out.
- A session's error pages show their title and message on a readable card, with their actions as a row of matching buttons.
- A link styled as a button matches the theme's buttons and keeps its readable colour on hover.
- In a Group Conversation's transcript, each speaker's label is bold and has its own colour.
- Group Conversation can hand each speaker their part: the recorder taps a person, and that person scans a looping code with their own phone, signed in or not, to open the interview with their answers drafted from what they said. The part goes from screen to phone without being stored; on the phone, the session's AI drafts the answers from it, and nothing is saved until they submit. It's slow enough to work over a shared screen on a video call, and **Copy link instead** covers a phone whose camera can't be used. The QR-code icon in the dialog's header starts the same scan, and a speaker's label in the transcript opens their code, as their button does.
- When the recorder gives one person two labels, drag one person's button onto the other's to make them one (on a touch screen, hold it still first): the transcript shows their lines under one label, and one code carries the whole part. **Same person as…** in a person's code does the same without dragging, the × on a merged button splits it again, and merges stay with the recording through a reload.
- When someone claims their part, the answers and files they already have in the session are reconsidered against it: a changed answer shows for review, and answers that still fit stay as they are.
- Group Conversation's **Add transcript to context** box, on the **Submit questions** line, uploads the transcript as a context file for the group or the session, off by default.
- The question selector no longer shows "(cache error)" when a signed-out visitor's request for other people's answers is refused on a private session.
- Results group sizes, vote bars, overall figures, representative statements and AI group summaries now count only people who answered enough to be in the analysis, as pol.is does, in every view. People with few answers still appear on the map in their nearest group. Representative statements keep a group's five strongest before showing agreements first, and uneven or very small sets of responses no longer break the Results maps.
- Recording is less likely to stall on networks that close a connection after a minute of silence: while a chunk waits for its transcript, the page sends a small request every 20 seconds to keep the connection in use.
- The `/docs` page and Tool Explorer descriptions match current behavior: new sessions start public, storage depends on the session, and Lit protects only the fields you lock. `/docs` shows the current deployment diagram.
- The setup page's Results summary shows the saved analysis choice instead of always saying manual.
- The "Set up with your AI" heading on `/new` is readable on the Context Engine theme.
- The About page's Agent Mirror Test and Agent Village links open the published post.
- Worker setup help no longer calls the API token deploy legacy, says a blank anonymous IP budget means no cap, and says a disabled embedded helper refuses sponsored deploys.
- Removed unreachable setup branches, the hidden hologram assistant, unused styles, and Bridge-era session flags, with no visible change.
- Refresh the light-theme About page with colored use-case buttons, pressed selection states, teal actions, compact sections, and consistently sized Recognition logos.
- Keep About actions on one line on narrow phones, enlarge resource touch targets, move section previews below their headings, and give the mobile video a clearly visible play icon.
- Improve footer contrast, link directly to the CommonGround environments and Truth-Seeking AI grant program, and refresh the README feature slideshow and architecture artwork.
- Let long question prompts use spare card space at phone and tablet widths, moving answer controls down before reducing text size. Extremely long prompts remain keyboard-scrollable.
- Match the Minimal mobile Login button height to the visible C logo artwork, excluding the SVG's transparent padding.
- Correct light-theme contrast in raw question results, expanded answers, sorting/export controls, bookmarks, sync indicators and Worker group notices, including Classic 95 counters, links and binary-answer labels. Keep the results title readable at narrow widths. Browser coverage now checks these surfaces in all three themes.
- The login dialog's Create and Login buttons keep their fill when hovered, focused or pressed, so their labels stay readable in every theme; in Minimal, Create's label vanished on hover.
- The locked-answers controls in Raw Results are readable in every theme, hovered, focused or pressed: Decrypt, Log in, the required-group links, the toggle that opens them, and their focus rings.
- Primary buttons keep a readable fill in every theme, hovered, focused or pressed, including See Questions, the Agent token Login and the Worker group and document buttons. They use the theme's action colours instead of a purple that reached only 3.70:1 with their white label.
- The HTML report's Cancel, Download and Generate buttons and the Admin and Sponsor action buttons are readable in every state and theme.
- Decrypt on answers and questions takes the surface's own text colour, so it no longer disappears on Classic 95's teal. The locked-question notice and the locked-questions banner are readable in every theme.
- Create and Login fit the login dialog at phone width.
- A link with both `mode` and `joinGroup` shows the group notice inside the voice dialog, where it can be read and cancelled before signing in.
- Creating a group says when sign-ins are rate limited instead of showing an internal code.
- Session settings shows **Sign in** as a clear button at the start of its sentence. The buttons on the Setup and Settings pages have a fill, so Minimal no longer shows them as plain words.
- Session settings says which account you're signed in as when it isn't one of the session's admins.
- New groups start open to anyone who can see the session, with their members visible to it. Admins can still choose to add members themselves.
- `rxc-ra-test-5` and `rxc-ra-test-6` open from their clean links on a device that has never seen them.
- The Groups panel, its create and edit forms, the session's Results and Groups headers, and the Session Admin page's heading, labels and cards are readable in every theme.
- Group Conversation offers a compact Record button and an icon-only **+** menu for audio uploads, transcript files, and pasted text. Imported audio keeps the recorder’s retry/download recovery. Internal audio parts stay hidden; downloads combine the audio not yet transcribed into one local MP3. Typed draft cards include a top-right remove button and **Submit questions**. Input guidance sits in the title tooltip.
- Protected question storage shows a sign-in requirement instead of a generic cache error while signed out. Standard session pages omit the interview sharing panel; **Interview & share** remains on admin and publish screens.

- Drop the retired Goerli test network from wallet connections and a collection metadata lookup that always failed.
- Trust a cached Worker sign-in only when it records the Worker, session and account it was issued for; the older unscoped format, which nothing writes, is ignored.
- Group Conversation shows who spoke as `Person 1:`, `Person 2:` lines. A five-second sample of each new voice goes with later chunks, so up to four voices keep their number across three-minute chunks; a fifth voice, or one heard only briefly, is numbered within its chunk. With a Session Worker before 0.9.0, numbers restart in each chunk and the recorder says so.
- The voice dialog's close button asks before it stops a recording.
- The recorder notes when the device takes the microphone, as a call can, and marks the gap in the transcript. Capture that stops without telling the page gets a fresh microphone stream.
- On a computer, which keeps recording in a background tab, switching tabs no longer raises the hidden-page notice while audio keeps arriving. A gap in the audio, a muted microphone or a phone still gets it.
- Only one tab at a time opens a recording; another tab says so and takes over once the first closes it.
- The session page says when audio kept by Close and keep the audio is still waiting to upload, after a reload too, and offers Reopen recording.
- Group Conversation is readable in every theme, hovered or focused too: recorder status, transcript details and errors, the Record, Stop, Generate questions and Reopen recording buttons, destructive confirmations, dark dialog titles and close buttons, question-type chips, draft fields, tag remove buttons, icons, focus rings and the recording timer. Civic, the default, uses system monospace fonts, and its "Transcribing…" is no longer white on white.
- Group recording opens the transcript once it has text, in a taller box on phones, and keeps it on the newest line unless the host scrolls up. A "new draft questions" cue appears above the recorder while new drafts are out of view, and scrolls to them; it takes no space otherwise.
- Draft review on phones shows each question and its options in full at the dialog's width, and keeps Submit questions at the bottom once every draft has been seen. Question fields resize again after fonts load or the theme changes.
- The upload success list names each question by its text, with its ID beneath; the JSON and AI prompt views are in a closed disclosure.
- Recorder warnings (microphone paused, screen lock, hidden page) look like notices, and Close and keep the audio, Retry and Download look like buttons. "Record speaker audio" is now "Recording voices coming from this device".
- If device storage fails, the session page says a closed recording can't be recovered after a reload, and the browser asks before a reload, for pasted transcripts too, until the recording is reopened and saved or cleared. Audio not yet transcribed stays downloadable meanwhile, even during capture.
- Group Conversation deletes each chunk's audio from the device once its transcript is saved, and its voice samples once every chunk is transcribed. Audio goes only to the Session Worker, which passes it to the transcription service and stores none. A reload or a closed tab can lose up to the last 10 seconds. Clear always asks first.
- Imported audio up to 30 minutes is split on the device into three-minute parts, saved together, each uploaded and retried on its own. Longer or unreadable files are refused with a message. Record and closing wait while a file decodes.
- Group Conversation keeps draft questions, with the host's edits and removals, after closing or reloading until they are submitted or deleted, and drafts only new conversation.
- Draft question cards, in Group Conversation and the voice interview's review, preview the answer: Agree/Unsure/Disagree, the rating slider, the options or the credits.
- Drafts generated while Submit uploads join the list afterwards as new drafts instead of undoing the upload, so the success list always appears and uploaded drafts can't be sent twice. Submit reads "Waiting for new drafts…" while drafts generate.
- Text pasted while a chunk transcribes no longer stops that chunk's automatic questions, and Retry transcription appears only for failed or stalled uploads.
- The bundled session list includes rxc-ra-test-3, so its group recorder link opens on a device that has never visited the session.
- `/skill.md` sends agents to the session's Session Worker instead of the removed Agent Bridge.
- `/new` is one page. Each section shows a summary, a conflict shows as a plain message beside the option, and Create confirms with your passkey, then deploys and saves.
- Admins edit sessions at `/session/<slug>/settings`, which replaces the `/admin` metadata editor; `/admin` links there. The page says which edits sign participants out, saves only changed fields and copies the group recorder link. For an on-chain session it uploads the new metadata, has the admin's wallet update the SessionRegistry, shows each step and the transaction link, then syncs the session's Worker.
- The settings page edits AI models, reasoning effort (for the session and per task) and transcription model; default question filters; highlighted and hidden questions and surveys; moving on after an answer; and SBT defaults. On-chain sessions also get contracts, block range, faucet amounts and SBT lists. Edits typed while the page loads are kept. Request limits and co-admins aren't editable there yet.
- Session templates: Export, Import and share links (`/new#template=`) carry a setup's questions and context, never keys. Context files are listed by name and privacy, to attach again. Import refuses a file over 256 KB before reading it.
- Setup offers only current OpenAI and Claude models and is readable in every theme at phone width. New sessions use GPT-6.1 Terra for everyday tasks and GPT-6.1 Sol for harder ones, and transcribe with gpt-transcribe.
- The account presets are GPT-6.1 Terra and Sol, GPT-6 Astra, Claude Sonnet 5.5 and Claude Opus 5.5. A saved preset that no longer exists uses the default.
- Generated questions state one plain, neutral idea each and don't repeat; breakout questions cover concrete next steps.
- Audio summaries no longer send the transcript twice, and `$&` in typed or spoken text no longer corrupts a prompt.
- The HTML report uses the same analysis prompt as the Results views.
- "Set up with your AI" on `/new` copies a setup prompt, or opens it in ChatGPT or Claude. Your AI interviews you and returns a link that fills in the page, or JSON to paste under Import. Nothing is created until you review the page, add keys there and press Create.
- `/new` reads `#setup=` links (plain base64url JSON, which an AI can write) as well as `#template=` share links, and removes either from the address bar once read.
- Setup, share and prefill links share one decoder: wrapped links and missing padding work, invalid text is refused, and a cut-off or damaged link says which.
- A broken prefill link opens the interview with its reason and a box to paste the AI's JSON. Drafts the page leaves out are counted instead of disappearing.
- Admins can copy the group recorder link (`?mode=groupRecording`, with any Worker pin) from the Join panel. Unknown `mode` values are ignored and removed from the address.
- The Context section on `/new`, on the settings page and, for admins, on the session page takes files (PDF, Markdown, text, CSV, JSON) and links for the session's AI. Each item is for everyone or for admins only; others don't see the section while the session has no context.
- Question generation and the voice interviewer read the session's notes and links, plus the files and links the person may read, as untrusted background.
- Setup and the settings page check context against shared limits: up to 6 paragraphs of 2,000 characters, 8 https links, and no text that looks like a secret.
- GPT-5 and GPT-6 requests send their JSON schema in the form every released Session Worker passes to OpenAI, so question generation, summaries, profile analysis, tags and the AI filter keep working on Workers from 0.6 to 0.8.0.
- A session that stores no AI model, and the admin AI test, let the Worker pick the model, so Workers from 0.8.0 and earlier don't refuse them.
- Transcription with models other than whisper-1 sends audio in pieces of at most five minutes, so long recordings and uploads aren't cut short.
- The settings page shows the highlighted and hidden lists read-only on an older Session Worker instead of failing the whole save, and checks only an edited context against the context rules. On-chain saves keep an older "don't feature SBTs" choice and AI provider, check the admin wallet's account and network before the paid upload, and offer "Retry the Worker sync" after a failed sync.
- When a session's metadata can't be loaded, the page keeps its last usable name, Worker link and settings, so the settings page can't publish a stripped copy.
- Clearing the cache also drops writes still waiting to save, and the cache keeps working when the browser blocks site storage.
- SBT pages show the chain's holder count, not 0, until a full count loads.
- An already-saved interview answer reports "Responses already saved" while another answer has an unsent edit, and a tag removed while AI suggestions load stays removed.
- A link padded with thousands of `=` no longer freezes the page, and a setup link opened over a draft with a problem lists what it changes.
- If another account signs in while Group Conversation records, recording stops and its chunks wait on the device until the account that made them signs back in. A recording started signed out belongs to the first account that signs in during it. A sign-out still uploads signed out.
- HTML and PDF reports hold what the exporter can see in Results: question text they decrypted, answers, comments, conviction and responder addresses. Answers still locked for them stay out. AI analysis, and the Generated AI views that other viewers open, still leave out questions whose text the author encrypted, and their answers.
- Reports carry the exporter's full address in the file's data and on the page. A PDF also has it in its properties and as text on every page, and the Polis report PDF is stamped the same way.
- A long report's PDF is captured a block at a time, so it no longer outgrows what one image can hold. Its closed items are open. A very long report takes a while and makes a large file: 3,000 answers took about 20 seconds and 50 MB.
- Reports show each rating's scale, and the browser's AI analysis receives it, so a saved analysis of a session with ratings is generated again once.
- A transcription reply that can't be read, such as one cut off by a dropped connection, no longer counts as silence, which deleted that chunk's audio. The chunk keeps its audio and retries, and dictation shows an error instead of an empty transcript.
- Clear reports a failed delete and can be tried again, even after an earlier save failed, instead of saying the recording is gone while chunks stay on the device.
- An ended on-chain session reads each answer at a block, never at the latest state, so an edit made during the read can't appear as an answer from before the end.
- The Agent page asks each rating on its own scale and step, with its end labels, and a single-choice question holds one option.
- Results drops answers decrypted for one account when the account changes, including a decryption that finishes after the change, and stops decrypting the remaining rows.
- Question text, survey titles and survey document links decrypted for one account are locked again when another account signs in or the account signs out, until they are decrypted for the current reader. A Decrypt Prompt that finishes after an account change is neither shown nor saved.
- Session context files and links reset when the reader or the session's Worker changes, so the next reader never sees or sends the previous reader's admins-only items.
- Profile SBT badges are kept per chain, so a badge burned on one chain no longer hides one earned at the same address on another.
- Results analysis of on-chain sessions keeps answers to options whose text has repeated spaces.
- Creating an SBT group stops before the next upload, transaction or draft save if the wallet account changes after Create.
- Stats show cached counts within a few seconds while live group counts load or wait for a sign-in, and later updates don't wait for those counts again.
- A changed multiple-choice draft is always saved; some option labels containing commas could make it look unchanged.
- The Results report ignores ratings that are off the question's step grid.
- Interview drafts snap ratings to the question's step.
- Answer commitments in encrypted envelopes bind the exact answer: rating hashes keep the value on any scale, and Poseidon commitments include each value's length. Existing envelopes still decrypt; only new commitments change.
- An earlier session's questions, surveys or answers finishing late no longer change whether the session you switched to counts as loaded, whether they succeed or fail.
- A question an admin hid, from the admin panel or the settings list, and its answers leave the Results report, its filters, Raw Results, the AI's input and every export, including for admins.
- The hidden and highlighted question lists in session settings apply in the browser for Worker-hosted sessions. They only took effect there for on-chain sessions before.
- An admin on a session with public Results can sign in and generate AI views when no report exists yet. The check button stayed disabled.
- A signed-out visitor to a session whose Results aren't public is asked to log in, in the report and in Raw Results. The report offered a Retry that couldn't work, and Raw Results read as if nobody had answered.
- New sessions start with public Results, so anyone can read them and answers are stored unencrypted. Encryption and other Results visibility stay available in setup. Existing sessions keep their settings.
- Closing the login dialog no longer stops a dialog beneath it, such as Raw Results or Group Conversation, from scrolling.
- An on-chain survey edit checks the stored copy again just before sending, so an edit saved from another tab or device moments earlier isn't overwritten.
- Adding a template's questions to a session removes only what was uploaded. A question edited or added while the upload ran stays in the draft.
- A rating with the same wording but a different scale, step or end labels is no longer reported as already published when another author owns its ID. The upload is refused instead, because the two still share an ID.
- Results no longer keeps showing the previous account's survey title, links and answers after you sign out or switch accounts.
- Question and survey text decrypted for one account shows as locked to anyone else using the same browser, including after a reload while signed out. Signing out or switching accounts also clears that text from the browser's saved copy, and signing back in decrypts it again.
- If the wallet switches accounts during an answer or survey upload, the transaction isn't sent from the other account; the app asks you to switch back and try again.
- When a sent transaction's result can't be read, the app says it was sent but not confirmed, and to check your wallet before retrying, instead of reporting a failure or a revert. Creating an SBT group no longer suggests a retry that could deploy a second one.
- Lowering a session's end block removes later answers from Question and Survey Results, showing a person's earlier answer within the range instead. Raising it again brings the later answers back.
- A session keeps its name, Worker link and hidden questions when a reload can't read its metadata, instead of losing them.
- On private sessions, signed-in people can lock a context file to one of the session's groups; before, the group list stayed empty. The list no longer shows another session's or account's groups.
- **Add transcript to context** uploads as the account that submitted and skips an upload still queued when you switch accounts. Submitting again before the last upload finishes replaces its copy instead of adding the transcript twice. The next account to submit on the same device adds its own copy and leaves the previous account's in place.
- The questions CSV includes each question's rating scale, pick-one setting and pick limit.
- Dictation longer than about five minutes is transcribed in parts instead of failing, and a failed transcription says so and stays on screen.
- On `/new` and the settings page, the Context section's **Format** takes typed text or one HTML file. The file keeps its own CSS, in style blocks and style and class attributes, but loses its scripts, event handlers, frames, forms and `@import` before it's saved, along with any CSS that tests the site around the page or escapes an @-rule's name, and a preview shows the result and what was removed. The session page shows it in its context section, cleaned again each time, in a box of its own: its CSS styles only the page, can't place anything outside the box, and can use the site's colours as `--ce-context-*` variables.
- The Reverse Alignment atlas is no longer built into the client. A session shows it as its HTML context page, where its areas and topics open in place, and the RxC session list only gives those sessions their short links. A session on an older Worker, such as `rxc-ra-test-3`, shows its typed context instead.
- Links in a session's context, typed or in an HTML page, use the context panel's own text colour, so they read in every theme. In Classic 95 the typed links were about 3:1 against the panel.
- The Tool Explorer's question generator uploads a transcript summary to Arweave, where it is public and permanent, only when **Upload Summary** is ticked, which it no longer is by default. A summary marked **Encrypt Summary** isn't uploaded at all, because the upload can't encrypt yet. Before, both went up as plain text.
- On `/new`, a starting file can be locked to groups set up before Create, under Access and identity: its **Visible to** lists them, and Create makes the groups before the files are added. A file goes only to the groups Create made, or to admins alone if it made none of them, never more widely. An exported template carries a locked file as admins-only.
- Wherever a context file is added, on `/new`, the settings page, the session page or with a group conversation's transcript, **Visible to** is a dropdown of toggles like the question filter's tags: everyone in the session, admins only, or any mix of up to 20 of the session's groups, whose members may each read the file.
- Admins see a **Group Agent** button in a session's context section. For now it only says the Group Agent is coming.

### Workers — requires redeployment

- `POST /admin/debate-atlas/build` builds an atlas from the responses the Worker stores. One planning call groups the questions into at most 5 branches and 12 topics, then one call per topic maps it and one per branch of several topics maps the branch, at most 6 at once and within 4 minutes, using the session's analysis model. Each response goes to its topic's call and its branch's, so a build reads about twice what one AI Views run does, and no participant address reaches the AI. A topic whose call fails is named on the atlas. One build runs at a time per session, and the newest 8 are kept. `GET /debate-atlas` reads the newest build, or one by `id`, and tells those who may build the model and prompts a build would use.
- The session's admin, its co-admins and the new `resultsAdminAddresses` (up to 20) may build atlases; results admins can do nothing else an admin does. The public config carries `resultsAdminAddresses`, and `debateAtlas: true` to tell the site that the Worker builds atlases.
- Anyone signed in to a session can add files to its context, each showing who added it. They can lock a file to up to 20 of the session's groups, whose members may each read it, or leave it for anyone who can see the session, and remove their own. The file list names a file's groups in `lockedGroupIds`. Admins can remove any file, and can limit adding to admins in Settings. The Worker's own AI features leave group-locked files out.
- Sessions deployed with Deploy to Cloudflare or a manual config can store questions and answers. These Workers bind only `GROUP_KV`, so the template and the manual guide now set `CE_STORAGE_IN_GROUP_KV=1` to keep payloads there; before, uploads returned 501 and `/capabilities` reported `storage_missing`. Other Workers without a storage index behave as before. Uploads and hide requests can no longer reach Cloudflare storage on a session not configured for it.
- Removed the retired Agent Bridge source. Agent HTTP stays in the Session Worker; admin metrics report `sessionsWithAgentActivity`, and agent on-chain answers record source `session-agent`.
- Encrypted-envelope export takes a session admin. The session config lists `responseExportAllowedAddresses`, `telegramResponseExportAllowedAddresses`, `export.allowedAddresses` and `export.adminAddresses` no longer grant it. Nothing in Context Engine writes them, and a Hosted session's settings can't set them.
- Removed unread Telegram fields and unused Worker exports. Stored record fields and KV prefixes are unchanged.
- Worker routes no longer read grant lists, export claims or a substitute Worker Group identity from login tokens. Nothing issued them, so nobody loses access. Reading another participant's individual response in a Hosted session whose results aren't public still takes a session admin. Worker Groups still use the signed-in address.
- Anonymous visitors have no daily per-IP request limit unless the session sets one. The per-wallet daily limit no longer doubles as one, so a room sharing one venue connection isn't cut off.
- A transcription reply with no readable text returns 502, so the browser keeps the chunk's audio and retries. Earlier Workers report such a reply as silence.
- Agent submissions count test-ETH payouts against the per-wallet daily faucet limit they share with participants. Past the limit, the submission carries on without funding.
- Voice interviews leave out the session's hidden questions, in the question list, its hash and the opening. Hiding a question has a saved opening written again.
- The Agent question list, answers, results and Wrapped statements, and Results analysis, leave out the session's hidden questions too, and an Agent list is complete even if a hidden question's stored object is lost. A published analysis keeps one hidden after it was generated, until it is generated again.
- Group transcription forwards up to four known-speaker samples (a name and a short WAV) to OpenAI, so voices keep their labels across chunks. Invalid samples are dropped without failing the chunk.
- Claude requests work on current models. The Worker sends no `temperature`, which Opus 5.5 and Fable 5.1 refuse and Sonnet and Haiku 5.5 refuse at 0.7, so older Claude models also sample at their default. It reads the answer from the reply's text blocks after any thinking, and a request without a model uses `claude-opus-5-5` instead of a model retired in 2025.
- Only admins add context items. For a link, the Worker fetches the page itself: https on a public host only, every redirect re-checked, up to 2 MB and 10 seconds. A PDF can be read by the session's own Claude or OpenAI key. Admins-only items never reach participants through reads, lists or the AI.
- The interview opening and results analysis use the context every participant may read.
- set-config checks a `sessionContext` it is sent.
- Saving part of a session's AI settings keeps the rest: set-config merges `ai` one level deep. The public config now shows reasoning effort and says that the Worker merges `ai`, so the settings page edits AI only on Workers that do.
- set-config accepts the highlighted and hidden question and survey lists, up to 500 IDs each. Changing them signs no one out.
- `fetch_url` and `fetch_image` need https on a public host and give up after 10 seconds; `fetch_url` also reads plain text and Markdown.
- Agent-proposed questions are no longer tagged "object".
- GPT-6.1 models use the Responses API, and every model is sent a reasoning effort it accepts.
- Requests to Claude 5.x, Opus 4.5 or later and Sonnet 4.6 or later carry the session's effort and any JSON schema. A refusal or an empty answer returns HTTP 422 instead of an empty reply.
- Interview mapping can run at medium effort on a low-effort session, and the interview opening allows 2,000 tokens, so models that think have room to answer.
- Results analysis accepts JSON wrapped in a code fence. Agent results record the model that actually ran.
- Wrapped posters use gpt-image-2.5-flare.
- Storage export manifests drop `rewrapRequiredForNewDeployment`, the deprecated copy of `deploymentKekContinuityRequired`, and Lit requests no longer read the retired `gateChainId` field; send `chainId`.
- After an upgrade from 0.8.0, a restore that 0.8.0 had already published is finished, instead of being offered for abandonment or deleted when it expires.
- A retried answer upload keeps its own storage ID, so a stalled first attempt that finishes late can't make the saved answer unreadable; the late attempt removes its own copy.
- An agent's overlapping next-question requests are handled one at a time, so none repeats a question or loses history, and a repeated `requestId` returns the same question. A restore target that holds agent question state is no longer treated as empty.
- Session context accepts Wikipedia, Notion and block-explorer links. The secret check also refuses Telegram bot tokens, RPC links carrying an Alchemy or Infura key, and Stripe and Hugging Face keys.
- A payload's own groups narrow a group-gated session's audience instead of adding to it, so a session member outside them can't read or list the payload.
- Session Wrapped loads catalogs of more than 200 questions instead of returning 503. It still reads at most 1,000 stored question rows, and re-uploaded or hidden questions count toward that.
- Context links drop hidden script, style and navigation text however the closing tag is written.
- A context link or PDF reading started by an admin who has since been replaced is refused instead of published.
- One request at a time reads a context PDF; another gets 409 "already being read", and readings and removals no longer undo each other.
- Faucet payouts take turns with their signing wallet, in hosted and registry sessions, for agents and for sponsored grants, so concurrent requests no longer fail on the same nonce, even when sessions share a key. A running payout keeps its turn; a request that waits 30 seconds gets 503 and leaves a sponsored grant unspent.
- Results analysis drops ratings off the question's step grid, agent-created rating questions keep their end labels, and the interview catalog and brief include each rating's step.
- Results analysis respects each answer's own access rule. The automatic queue lost the rule, so an answer limited to admins could reach the AI and the published analysis. Sessions that ran automatic analysis with such answers should regenerate it.
- Results analysis picks the current version of each question and answer before checking who may read it, so a newer restricted version no longer brings back the older public one.
- Automatic Results analysis uses the stored answer rather than its shortened copy in the queue, once the stored one is listed.
- A bootstrap upload applies the signed-origin check login uses, so an admin's signature made for another site is refused before its nonce is spent. It now needs a browser `Origin` header from a trusted origin.
- An access rule gives the same answer in any order. A member or admin who qualifies through one condition is let in while another condition's group check is down, instead of getting a 503, and a failed condition in an all-of rule refuses with 403.
- A first upload that fails partway no longer leaves its ID free for another author to claim; its author can retry it.
- Agent answer drafts are kept under the question's full ID, so a question with a crafted ID can't share another question's draft.
- When storage can't read an agent's earlier draft, saving the draft fails with the retryable `answer_draft_read_failed`, instead of resetting its edit count and origin.
- An agent re-posting a question can't change its options or scale under earlier answers, or bring back an archived one: the re-post is refused with `question_schema_conflict` or `question_archived`. An identical re-post leaves the stored question as it is.
- An agent's batch of new questions reports every question it stored. Before, it could report stored questions as skipped.
- Hiding a question from the Storage panel also has the saved interview opening written again, and an interview no longer shares an opening still being written for a different set of hidden questions.
- The Worker's AI features and the context list find context files among hundreds of other library files. Before, about 300 other files could leave the AI without context, with no sign of it; a failed context scan is now logged.
- A session's context can be an uploaded HTML page of up to 20,000 characters, in place of its paragraphs and links. Set-config refuses the two together and checks the page, as written and as its words, for anything that looks like a key. The session's AI reads the page as plain text, in no more room than typed paragraphs get, so attached files still fit.

### Benchmark

- Keep the standalone Raw Results heading readable and correctly wrapped at narrow widths, scope Risk Matrix heading colors to their own dialog, and give export buttons readable colors and descriptive accessible names.
- `answer --resume` asks again when the endpoint, model settings, declared model revision, routing or answer schema change. Answers saved by earlier versions are asked again once. Answer files record each model's revision, and a run that reaches two deployments of one model stops with an error.
- Typed answers and importance replies ignore drafts inside reasoning tags and refuse truncated reasoning.
- An importance reply holding two different allocations, or one cut off mid-object, is retried instead of scored by its first allocation.
- Flipped rating prompts are used only when flipped answers stay on the scale's grid.
- Mock ratings land on the scale's step grid.
- `compare-answers` skips a question that the answer file and the export define differently, and says what differs.
- `compare-answers` reports everyone apart from groups, so a group named `everyone` stays separate.

### Agents and MCP

- Several Agent HTTP names no longer say Telegram. In question sources and reasons, `telegram_only_*` is now `hosted_*`, `telegram_worker_question_index` is now `worker_question_index`, and a question with no id gets a `hosted-` one. In submit results, `telegram_submit_queue_*` is now `agent_submit_queue_*`. In group data, a `membershipSource` of `telegram_user` is now `agent_principal`. An agent that matches the old strings must switch to the new ones.
- Agent admin status no longer reports `canManageResponseExportAllowlist`, because sessions have no export allowlist.
- Agent fidelity takes the latest record by the time the Worker stored it, never by the participant's own clock, so a later withdrawal or edit counts.
- Agent fidelity and MCP `get_results` reject ratings off the step grid and allocations over the voice-credit budget.
- Agent fidelity keeps equally typical people in one group, so reordering records can't change the most-unusual and most-typical results. When everyone is equally typical, it reports no groups. Confident misses with equal confidence list in question order.
- Agent fidelity's AI score beside the most common answer, overall and in each typicality third, counts only the predictions that answer can be checked against, so the two differ by exactly the lift.
- Agents read an uploaded HTML context as its words, in `paragraphs`, never as markup; a page with no words gives no paragraph.

### Local tooling

- `npm run test:worker:agent` is the agent test command; `test:worker:agent-bridge` is gone. Public history replay keeps the audited cutover for old commits and accepts only a complete retirement of the Bridge subtree.
- Corrected documentation across the README, guides, spec, private runbooks and companion docs, and deleted finished audit notes. Three scripts now use kebab-case names.
- `deploy:evm` passes the RPC URL to `forge script`, which ignored `ETH_RPC_URL` and only simulated.
- `deploy:evm` stops with an error instead of printing wrong addresses when another transaction from the deployer moves its nonce.
- The public package no longer lists `ai:playwright-server`, whose script the public tree leaves out.
- Corpus freshness with `--as-of` ignores entries dated after that day.
- Rendering a film frame range that skips frame 0 still writes the video still.

## [0.8.1] - not released; included in 0.9.0

### Verification and shared rules

- Pin the recovery-key export test's clock to midday UTC so it no longer fails near midnight.

- Give the AI prediction results tests 8 seconds to show their scores; hosted CI under coverage needed more than 1.

- Separate the voice-mode modal shell and interview panel to keep client components within the release size limits.

- Include catalog completeness in the interview compatibility fixture.

- Complete mocked Lit provisioning checkpoints before testing atomic configuration writes.

- Give upload-diagnostics fixtures the durable storage targets required by receipts.

- Isolate SBT name tests by clearing their complete cache namespace.

- Use hexadecimal commitments in answer-size regression fixtures.

- Mark the Lit provisioning mock credential as an explicit fixture for release scans.

- Isolate community regression tests by clearing complete cache namespaces.

- Use complete encrypted-envelope fixtures in decrypt-and-resubmit regression tests.

- Verify interview submission leaves unrelated manual answers pending for ordinary Submit.

- Verify mixed-file generation retains rejected-file notices while sending only supported extracted text to the model.

- Provide the mocked wallet-action boundary in shared Jest setup for session-page imports as well as account components.

- Keep the wallet URI encoder override effective after npm hoisting and validate the installed query-dependency tree.

- Mock wallet disconnection in community and sponsorship lifecycle tests when importing the shared logout boundary.

- Install the Session Worker package in the hosted contracts job before its registry smoke imports Worker code.

- Refresh the client coverage inventory count without changing measured coverage or enforced floors.

- Cover the pinned Worker session route with read-only navigation fixtures and
  loaded-session assertions while keeping unmatched network requests blocked.

- Seed encrypted provisioned secrets in admin integration fixtures.

- Align integration assertions with explicit General comparison links and scanned
  SBT mint totals.

- Keep the analysis session-switch regression mock compatible with typed Jest.

- Preserve the Session Worker's isolated dependencies in public replay checks.

- Include shared answer validation in Worker release source comparisons.

- Check signed payment hashes in proof-authorized faucet integration tests.

- Verify authenticated faucet replies against the signed payment hash and amount.

- Preserve the original benchmark rating prompts for integer-origin, step-1
  scales; describe increments only for other rating grids.

- Reject eager client runtime import cycles in the wiring gate, with a zero
  baseline and exclusions for type-only imports and deferred loads.

- Use one rating bounds and step rule across browser sliders, agent drafts and
  submissions, Wrapped, MCP and benchmark answers; suggested buttons are display hints.

### Arweave

- Use one forced-refresh option across payload caches and in-flight requests.
  Evict malformed JSON replies so ordinary reads can retry immediately.

### Agents and MCP

- Keep up to 50 research runs per agent identity, up from 20, and state the limit in the agent instructions.

- Mark research summaries incomplete when they hold records an earlier Worker wrote without a participant or run, instead of showing an invented participant.

- Prepare MCP 0.2.0 with shared rating validation: fractional grids are supported, and new answers must follow the stored step (default 1). Existing answers remain unchanged. The minor version marks the changed accepted-input behavior; application and MCP versions remain independent.

- Summarize research runs from bounded per-principal journal coverage, storing each frozen question list once. Summary exports read attempt metadata and one answer state per principal instead of every answer event.

- Reuse registry creation-block lookup across MCP configuration refreshes.

- Bound MCP registry reads and cached/local answers to the configured session window, using historical pointers at its end.

- Read research gold and wide exports from permanent submitted-answer history,
  preserving revision order and gold answers from before each prediction.

- Count research completion from distinct stored answers and privacy skips, using
  the Wrapped image coverage rule. Retried attempts remain marked as replays.

- Recheck MCP cancellation after chain validation, token refresh and retry-key
  persistence before sending writes, preserving results already broadcast.

- Mark MCP results, question lists and own-answer reads incomplete when listed
  payloads are unread, including cached misses, and report unread answer counts.

- Require the storage target and timestamp on every upload receipt reservation and
  execute reply, while preserving interrupted uploads at their original target.

- Persist and retry failed question-index ranges, and keep unread question payloads
  incomplete until recovery succeeds.

- Refresh expired registry question indexes even after their historical scan is
  complete, sharing concurrent background refreshes and preserving the indexed block.

- Publish complete MCP key files atomically on filesystems with hard links, so
  concurrent first launches share one identity without reading a partial key.

- Resolve default MCP registry links to the registered `general` session while
  continuing to reject mismatched session identities.

- Serve every eligible question before repeating, including catalogs larger than
  250 questions. Prune removed questions while preserving sponsored priority.

- Limit failed-issuance credential cleanup to its own token record, preserving
  newer credentials issued concurrently and reporting failed revocation writes.

- Keep targeted question-vote matches regardless of catalog size or position,
  with stable ordering for equally relevant recommendations.

- Score participant results from each question's type and rating scale. Keep
  freeform, choice and other unscored answers out of agreement counts and averages.

- Require structured approval for sponsored question changes; text-only approval
  no longer applies them. Require a valid plan digest and reject it when the plan changes.

- Keep canonical submitted answers when a stale submission-index copy has the
  same timestamp. Newer timestamps still take precedence when deduplicating copies.

- Keep the CC package's shipped rating-scale module synchronized with the shared
  rating validation rules.

- Give each agent answer edit a durable revision and request identity, so changing
  back to an earlier answer submits the edit while retries remain idempotent.

- Count one current answer per participant and question in agent results and
  answered-state views, using a shared deterministic revision order within each
  participant/question and chronological order across the selected answers.

### Local tooling

- Add an in-process participation rehearsal for concurrent invite, Wrapped prediction and signed-in browser response flows, with optional KV write throttling.

### Client — available when the site deploys

- Open the group recorder from `?mode=groupRecording` links; `?mode=recordGroup` no longer opens it.

- Keep a Group Conversation recording running when someone taps outside the dialog or presses Escape, and offer "Close and keep the audio" only after Stop.

- Retry a recording upload that stops responding instead of letting it hold up later chunks, and add Retry to uploading chunks.

- Let Clear work without device storage and with failed chunks, asking before it deletes audio. A recording stays with the account that made it: another account or a signed-out visitor starts fresh, and audio held only on this page stays until it is saved or downloaded.

- Require real speech, not just gap markers, before generating questions from a recording.

- Keep speaker labels on when one chunk's audio is rejected as too large or unreadable; any other refusal, such as an older Worker's, turns them off for the rest of the recording with a notice.

- Stagger chunk retries so rooms sharing a key don't retry together, and apply a slow speaker-label check that answers before Record is pressed.

- Save hidden-page notices with the recording so they survive a reload and reopening the recorder.

- Keep the voice dialog and its recording when someone signs in with a wallet on a different chain from a chain session's.

- Stop the unsaved-answers notice from returning after an interview submission and Clear.

- Report a skipped file once, on the next Generate, instead of on every later run or after the sources change.

- Leave hidden draft facts out of voice interviews wherever they appear, including the summary, while keeping shown facts that contain the same words intact.

- End the wallet connection when logout can't reach the wallet, so the next sign-in starts with a fresh connection.

- Shorten the passkey sign-out error to one sentence, with details behind a "?" button.

- Keep Group Conversation audio held only in memory when stored recordings can't be read on reopening, when the recorder is left without Close and keep the audio, and when Close and keep runs before saved audio has loaded.

- Show when the microphone or recorder stops ahead of the storage, offline and question-generation notices; the storage notice no longer says that recording continues. A chunk-rotation error clears once the next chunk starts.

- Keep Group Conversation audio held only in memory when its dialog is closed and reopened more than once, and retry saving it to the device on each reopening.

- Reject malformed WalletConnect query escapes with native URI decoding, removing the vulnerable decoder dependency while keeping the existing wallet stack.

- Remove the unused SBT canvas image-load callback; previews continue to use fetched image files.

- Preserve the pinned Worker session through the full question view, filters, and response editor so alias routes such as `/session/demo/questions` load without an EVM network.

- Remove the unused standalone `/debate`, `/beta`, `/contributors`, `/matrix`, and `/demos` pages and obsolete navigation. Preserve Atlas, simulated profiles, demo sessions, and the shared risk matrix.

- Preserve an in-flight SBT image when pasting supplies no usable replacement; only an applied image supersedes it.

- Keep bare question URLs unpinned until their session is explicit or found in cache, so General fallback cannot become permanent.

- Recheck invalid Arweave metadata after the terminal cooldown so a temporary gateway error cannot hide SBT metadata permanently.

- Omit imported facts tied only to hidden drafts from voice interview context, including copied context text.

- Give hidden-draft help an accessible description and keep its tooltip open while hovered.

- Keep rejected file names visible when question generation starts, while clearing stale extraction failures.

- Show passkey disconnect failures in the login modal after local sign-out clears the account, instead of leaving an unhandled button promise.

- Accept configured Claude model IDs for photo requests through Anthropic and OpenRouter without restricting the family name or version.

- Track all pending agent answers so navigating between concurrent submissions keeps each pending answer disabled until its own request finishes.

- Show the pending-page-answer notice beside Submit only after an interview submission leaves answers unsaved. Clear it after ordinary submission.

- Keep previous publication IDs and cache-hydration status out of saved authoring drafts.

- Preserve internal option spacing through the live Results controller so Breakdown counts match stored selections.

- Keep a closed profile analysis dialog closed when refreshed inputs invalidate its result.

- Disconnect wagmi and persist logout intent in shared teardown, including agent logout, so stale wallet props cannot sign the participant back in.

- Document phone recording limits, a dedicated powered recorder, and the revised 45-minute recovery rehearsal.

- Enable Group Conversation recording with plain transcription when the speaker-label provider check takes more than two seconds.

- Leave no empty recording chunk when microphone capture fails to start or rotate; retain the active chunk on rotation failure.

- Keep timestamped hidden-page recording notices after returning and stopping, until dismissed.

- Name recording uploads and audio downloads by their MIME container, including WebM, MP4, M4A, Ogg and WAV.

- Fall back to plain transcription on provider speaker-label rejections, including errors nested in the Worker response, while keeping temporary errors in the retry queue.

- Keep breakout capture and its transcript together across sign-in or delayed account restoration by pinning the recording scope until it is cleared.

- Retry temporary recording failures for as long as the page is open, keep failed audio with transcript gap markers, continue later chunks after permanent errors, and offer closing with pending audio kept for reopening.

- Keep recording and transcription running from memory when device storage fails or is unavailable. Save cumulative audio snapshots at most every ten seconds and retain audio until its transcript is saved.

- Enable speaker labels by default for OpenAI Group Conversation recordings, with the existing plain-transcription fallback.

- Keep recording chunks in IndexedDB until their transcripts are saved, retry uploads in order, and offer per-chunk retry/download controls with storage, offline and microphone guidance.

- Show concealed AI guesses as grey answer areas with readable help text in both themes until the participant answers.

- Preserve multiple-choice selections in generated results so options containing semicolons count correctly.

- Require at least one question type before generation and explain responses with no usable questions.

- Reuse cached and in-flight Arweave payloads when loading SBT metadata.

- Release agent login loading after account changes and allow independent answer submissions to finish.

- Keep profile analysis open across data refreshes while discarding stale results.

- Accept Claude 5 model names for photo analysis through Anthropic and OpenRouter.

- Clear stale source and rejected-file warnings when starting a new question generation.

- Keep tags entered during generation and exclude generation progress from saved drafts.

- Clear unchanged authoring drafts after publication even when their debounced save lagged behind the form.

- Recheck encrypted wallet storage before saving a newly created passkey wallet.

- Show the remaining unsubmitted page-answer count with Submit after an interview.

- Keep response scan watermarks unchanged when live events arrive, so refreshes retry earlier unreadable payloads.

- Fall back to plain transcription when speaker labels are unavailable, retain text-only replies, and hide the labels toggle for other providers.

- Preserve registry routing in join links and recover from invalid admin Worker fields when resolving interview compatibility.

- Preserve internal whitespace in Breakdown choice labels so valid selections and participant totals match the Report.

- Disconnect MetaMask before logout clears account props, preserve explicit disconnect intent, and surface passkey disconnect failures.

- Keep General-session question bookmarks, result links, and copied URLs pinned to General even when another session is selected.

- Preserve the latest SBT image choice and saved bytes when an earlier image request finishes late.

- Count Community groups by chain and contract address, while counting the same contract across session caches only once.

- Open the saved-filter loader in inline Results even when no filters are active or after clearing them; tokens and full URLs restore Group and Top question selections.

- Finish and save Group Conversation transcription before Close, Escape, or outside dismissal; keep failed audio available in the open dialog for retry.

- Count every quadratic step in double and triple clicks after pile auto-advance,
  while still ignoring leftover clicks from the previous question.

- Use session-sponsored AI and viewer authentication for Polis group analysis,
  and show failed requests with a working retry instead of caching a local summary.

- Preserve edited questions and saved drafts on failed regeneration, asking before a usable replacement overwrites edits.

- Count distinct demo personas separately from their modeled responses, omitting unknown persona counts.

- Accept photo sources with the built-in Claude presets using explicit preset image capabilities.

- Open Breakdown distributions directly and select questions even when no demographic segments exist.

- Include public response explanations in comparison AI input and expanded details.

- Keep pending AI tag suggestions attached to the question that requested them, releasing busy state after edits or removal.

- Cap question text once in Results analysis input and keep every included response linked to an included question.

- Keep profile analysis, cached results and pending updates bound to their original person, session and inputs.

- Clear all agent and Worker credentials on either logout, cancelling pending logins and requests before resetting mounted views.

- Generate questions only from extracted source text; name skipped files and stop offering PDF or PowerPoint generation input.

- Limit HTML report files and snapshot downloads to the selected sections; hide the JSON download when unchecked.

- Release participant Group creation after an account change while preserving its draft and ignoring old completions.

- Preserve participant Group drafts across configuration refreshes; update default tags only while untouched.

- Keep cleared cache namespaces empty after storage recovery and report incomplete clears without reloading.

- Limit interview submissions to selected changed answers through validation,
  encryption, upload and draft cleanup; leave unselected manual drafts intact.

- Preserve multilingual speech after overlapping audio chunks by trimming
  only verified transcript offsets in both uploaded and rolling audio.

- Try another document index after malformed GraphQL replies and retain the
  current document list when every endpoint fails.

- Compare freeform answers and comments as exact text throughout editing,
  dirty counts, submission differences and interview review; only rating
  answers use numeric equivalence.

- Keep loaded empty saved answers distinct from unknown baselines, so a newer
  saved clear drops older draft edits while incomplete loading preserves them.

- Hold back an invalid saved locked response individually while submitting other
  valid changes, and keep rejecting newly typed lone asterisks before upload.

- Refuse lone asterisks in answers and comments before upload, require valid
  envelopes for encrypted response fields, and clear old ciphertext on edits.

- Re-encrypt response fields and ratings when gate conditions or chains change;
  require decryption before submitting a still-locked field to a different gate.

- Clear cached registry overrides when their on-chain fields are empty, restoring
  metadata or defaults while preserving failed and unrequested fields.

- Keep Realtime interview questions and answers in conversation order when
  transcription completions arrive late or repeat.

- Keep cluster AI explanations on the selected session Worker with the current viewer authentication context.

- Prioritize newer unanswered questions in the voice interview and personal AI-prefill prompt using the browser’s own answer state, preserving public catalog versions and fingerprints.

- Add optional Group Conversation speaker labels, stored per recording chunk in the local transcript draft. Speaker review and claiming remain unavailable.

- Keep Group Conversation and Interview screens awake where supported, and offer a remembered speaker-audio option for recording remote participants heard through the device speakers.

- Add a compact Join panel with a voice-interview QR code, a copyable session link and the existing review-only AI prompt on session, admin and publish-result pages.

- Preserve every stored survey answer when submitting a partial edit. Read the
  current raw container before uploads, retain unchanged encrypted rows exactly,
  and refuse submission when that snapshot cannot be read.

- Finish question and survey publication in its original session, preserve drafts
  edited while publishing, and leave newly opened forms and their timers untouched.

- Pin all SBT writes to the collection session’s configured chain, reject missing
  chains and wallet mismatches, and include the chain in the approved transaction.

- Keep SBT history reads on the session chain and retain cached counts when its
  provider is unavailable, without substituting an injected wallet’s history.

- Separate SBT count-scan coverage from pending live activity. Fill missed history
  without double counting, replace orphaned counts on complete scans, and rebuild
  obsolete cache entries instead of migrating them.

- Read later-edited answers at the configured scan end, with separate historical
  requests and partial-failure reasons when archive state is unavailable.

- Apply pending decrypts only to their original response and unchanged viewer,
  profile and source-session context, preserving newer response revisions.

- Limit General comparisons to General data and carry the same explicit session
  through comparison URLs, provenance and AI requests.

- Treat retired SBT collections as fully hydrated when their admin is the zero
  address, so discovery advances and does not repeatedly fetch their metadata.

- Keep in-flight AI analysis tied to its starting session, reader and chain;
  exports omit analysis when the current filtered inputs have changed.

- Drop live events outside the session scope or configured block limits without
  treating a lagging RPC head as a configured end.

- Cache every live survey responder in a block, order same-block edits by transaction
  and log position, and ignore duplicate events.

- Reloading the Session Wizard preserves explicit start blocks. New blank starts record draft-only provenance so automatic defaults can follow chain changes without entering published configuration.

- Empty completed filters export zero questions and responses, with report availability based on those same counts. Session totals remain the fallback while filters hydrate.

- Survey discovery retains creation blocks from raw event logs and keeps the earliest block for duplicate survey IDs.

- Retry chain-backed response payload failures from their event block instead of
  advancing past them. Forced refreshes rescan from the session's start block.

- Refuse encrypted-key wallet creation when a wallet is already saved for this
  RP ID, preserving its recovery key before any new passkey prompt.

- Cancel pending passkey creation, unlocks, and signing on logout or deletion.
  Late replies cannot restore the signer or connected metadata; expiry still
  permits one signature re-unlock.

- Remove circular session-parser and Arweave imports while preserving resource
  diagnostics and gateway URL normalization.

- Validate wallet transaction quantities before policy checks and sign that same
  normalized transaction in both the Worker and in-memory fallback.

- Reconcile Worker question and survey caches against complete catalogs, keeping
  pending writes and a ten-minute grace period for new records.

- Keep hidden Worker questions and surveys hidden in the reader cache, including
  when saved answers carry their question text. Clear hides only after a complete catalog refresh.

- Add a **Measure how well AI represents participants** switch to Interview
  settings, in the wizard and `/admin` (needs a Session Worker newer than
  0.8.0). It turns on research sharing by default, hidden drafts for 1 in 5
  AI-prefill drafts and the participant score together, and in `/admin` turns
  voice interviews back on if they were off; turning it off restores the
  research defaults.

- Add **How well AIs predicted people** to the Results report of sessions that
  turn on **Show “How well AIs predicted people” in Results**: the overall and
  hidden-draft Mirror Scores, how often people changed a shown draft, stated
  confidence against answers kept, and results by platform. It appears once
  the responses include AI-prefill drafts from the session's minimum number
  of people, 5 by default, and withholds any figure from fewer, and a
  platform also when subtracting it from the overall score would reveal
  fewer. It scores in a background thread.

- Add two Interview settings for that section, in the wizard and `/admin`
  (each needs a Session Worker newer than 0.8.0): **Show “How well AIs
  predicted people” in Results** (`interviewMode.showFidelityResults`, off by
  default), which adds it, while the participant score stays private to each
  person; and under it, **Smallest group shown in “How
  well AIs predicted people”** (`interviewMode.fidelityMinimumPeople`, 5 by
  default), whose **Off** shows every figure, even one person's.

- Suggest the session's open groups after an interview or AI prefill link
  (`interviewMode.suggestGroups`, off by default; needs a Session Worker
  newer than 0.8.0). A group named like the person's single-choice answer
  comes first without an AI call, hidden AI drafts stay out until shown, and
  suggestions never join anyone. A join started before sign-in now survives
  it, and suggestions no longer reload, with an AI call, on every render.

- Resolve the `rxc-ra-test-2` session from its short URL through bundled Worker
  discovery, without requiring a `worker` query parameter.

- Move Discard interview out of the modal footer into a trash button beside
  the microphone. Its tooltip, and its description for screen readers, say
  what discarding clears and that submitted responses are kept.

- Offer the ChatGPT or Claude prefill prompt from the voice chooser, in a
  **Let your AI draft your answers** card below Interview and Group
  Conversation, instead of inside the interview; the chooser's descriptions
  now sit behind question-mark tooltips. `?mode=voice` opens the chooser.
  Prefill links still open the interview on their drafts, now with a status
  line and a **Talk through your drafts** microphone.

- Open the interview's AI submission choices inside their dropdown instead of
  over the drafts, with every sharing choice listed before the prefill metadata.
  The metadata no longer repeats what an unticked box leaves out, and is hidden
  when nothing is shared.

- Leave questions people have already answered out of interview and AI-prefill
  drafts, and say how many were left out. A voice or typed interview that gives
  a different answer still shows that draft, noting the answer it changes.
  Answers saved earlier but not yet loaded on the page now count too, so an
  interview no longer replaces them unasked. While questions remain open, the
  voice interviewer asks only about those.

- Update `follow-redirects` to 1.16.2, which fixes a case where custom credential
  headers could follow a redirect.

### Workers — requires redeployment

- Clear saved Lit setup only when Lit confirms it is gone (the saved key is refused, or a complete list lacks the saved group or wallet), including after an operator replaces a revoked key, so setup can start over; network, rate-limit and billing errors keep saved progress.

- Isolate Wrapped and submit permission revocation tests from invite removal.

- Mark interview discovery incomplete for temporary Cloudflare payload-read failures, and stop retrying permanently missing or malformed on-chain payloads.

- Preserve Lit accounts and setup resources across failed attempts. Authority-choice switches with a saved group, PKP or action name those resources and offer Resume; supplied keys are checked before reserving an attempt.

- Keep web and agent sessions signed in across effective content-only settings edits, including wizard verification, while revoking authorization for authority changes.

- Return speaker-labelled transcription segments for Group Conversation recordings.

- Recover lost restore handoff replies using a scoped, expiring completion receipt for the importing signer.

- Mark interview discovery incomplete when question pointers or payloads cannot be read, while retaining readable eligible questions and retryable empty results.

- Calculate research completion from each run’s own answer events and initial statement set.

- Allow failed Lit setup to restart with a fresh authority choice, reject conflicting credentials clearly, and preserve checkpoint writes across content revisions.

- Preserve rating scales and fractional steps through public agent questions and results scoring.

- Route automatic custom-provider results analysis through the same checked HTTPS fetch path as manual analysis, including redirect checks.

- Store and revoke General-session login tokens under one namespace, preserving explicit session isolation.

- Checkpoint Lit setup resources in encrypted coordinator storage and resume
  failed attempts without recreating completed resources; activate only after
  the complete setup is finalized atomically.

- Count only eligible public questions toward interview discovery's 100-question
  limit, with separate scan budgets and retryable incomplete-discovery errors.

- Reject encrypted response fields without a valid envelope and public lone-asterisk masks.

- Require public HTTPS targets without embedded credentials throughout custom AI
  redirects, and refuse requests when outbound safety checks are unavailable.

- Bind restored session Worker URLs to the signed, verified destination origin so
  recovery at a new Worker passes client discovery without loosening ordinary edits.

- Keep the importing admin authorized through restore cleanup; publish the restored
  authority and release its lock atomically, with status reads able to finish cleanup.

- Check each listing group once per request and return a retryable failure when
  membership is unavailable, instead of reporting an incomplete page as complete.

- Patch the committed encrypted secret document, preserving key replacements
  and removals across stale KV reads, retries, Lit setup and backup restore.

- Recheck group mutation authority in the session config coordinator and order the separate group commit against admin rotation, including participant epoch checks.

- Remove legacy membership reads and migration from group rosters, preserving
  removal tombstones across repeated paginated listings.

- Research CSV exports use the browser's shared formula guard and quote every cell; JSONL exports retain exact participant text.

- Groups result images draw only participants in groups that meet the minimum size, matching JSON group counts without assigning suppressed participants to another group.

- Anonymous IPv6 callers in one /64 now share a quota; IPv4-mapped addresses share the corresponding IPv4 quota.

- Extract fetched HTML in linear time, including responses with repeated
  unclosed tags, while preserving ordinary visible text.

- Sign each faucet payment once and resend the same bytes across RPC fallback.
  Return the transaction hash on uncertain outcomes, including agent requests.

- Cap Cloudflare upload metadata at 64 KiB with bounded tags so accepted records
  fit backup entries; legacy oversized export errors name the affected storage ID.

- Preserve zero-byte documents through backup and restore, treating an empty KV
  payload as valid bytes rather than a missing object.

- Reject question options that are not strings; client cache and input readers
  ignore malformed legacy options without converting untrusted objects.

- Resume interrupted response uploads at their reserved storage ID and timestamp,
  retaining pending receipts and avoiding duplicate published answers after a crash.

### Benchmark reports

- Compare importance shuffle and mock-allocation hashes in code-point order; model fingerprint ordering retains its explicit English locale.

- Omit full-bank importance from question-limited previews with an explicit integrity warning instead of silently dropping allocation runs.

- Require one schedule seed per release report and warn when previews combine different seeds.

- Allow completed benchmark runs at different repeat depths to share a report while preserving their seeds and strict resume checks.

- Keep importance prompt fingerprints stable across host locales.

- Bind preview importance allocations to the full question wording and order before display limits.

- Refuse preview reports with missing or mismatched question prompt hashes before answers can be exported against changed wording.

- Bind longitudinal snapshots to the persona instructions and prompt template actually used, rejecting changed or missing context.

- Parse benchmark answers after removing inline reasoning, and retry conflicting or truncated final answers.

- Publish rendered previews with the same validated analysis overlay, retaining HTML equality and integrity checks.

- Keep report trait names and values as own dictionary keys, including built-in
  names such as constructor, across grouping, filtering and export.

- Audit every model the full OpenRouter runner will send, using one effective
  roster for preflight, planning and execution.

- Validate OpenRouter's transport and serving provider separately. Enforce upstream
  routing restrictions with normalized comparisons while preserving reported metadata.

- Use the validated release receipt for benchmark labels, indexing and publication
  status. Require explicit release confirmation and verify the embedded report's hash.

- Compare similarity drift over the same usable question set in both snapshots,
  report its IDs and count, and mark insufficient common overlap unavailable.

- Keep benchmark deadlines active through success/error bodies and structured-output
  fallback attempts, cancelling stalled streams so tasks can retry.

- Repair incomplete checkpoint tails and missing final newlines before any
  benchmark resume appends new records; reject corrupt middle lines.

- Bind importance resume to its recorded endpoint and reject mixed endpoints
  using the deployment identity check shared with stance runs.

- Hash importance prompts in model-id and numeric-repeat order for both generation
  and release validation, independent of roster order.

- Let the AI discourse benchmark answer any session's questions, every type
  included: `answer` asks each model with reversed wording, flipped rating
  scales and shuffled options, and checks replies with the MCP's answer rules,
  now shared in `shared/questions/answerValue.mjs`. `compare-answers` then
  compares models with everyone and with each group, using statistics suited
  to each question type; a group is withheld when it has fewer than 5 people
  or when subtracting it from everyone would leave fewer.

### Research

- Add Cohen's kappa for choice predictions and rating error, as a share of
  the scale, to the agent fidelity report.

- Add an agent fidelity report: `scripts/agent-fidelity-report.mjs` scores
  how well AI drafts predicted participants' answers from a Results JSON
  export or Session Wrapped rows. It reports Mirror Score, correction rate,
  calibration, lift over a majority guess, accuracy for unusual views, and
  whether drafts flatten strong or varied views. See `docs/agent-fidelity.md`.
  It counts each response under the responder the Worker or chain recorded,
  not the payload's own claim, reads platforms as ChatGPT, Claude or other,
  and withholds calibration bands from fewer than 5 people, and any platform,
  draft-source or group row whose subtraction from the total would reveal
  fewer.

- Keep shared AI draft comparisons minimal by default: predicted answers, ratings,
  confidence and changed fields, without the AI's notes, drafted text or drafts
  for skipped questions. Owners can choose full detail with
  `interviewMode.researchDetail`, which needs a Session Worker newer than 0.8.0.
  Records now carry `version: 2`, `researchTier` and `draftOrigin`, and a line
  beside Submit says when sharing is on.

- Hide a share of AI-prefill drafts until people answer, to measure how much
  seeing a draft sways answers: `interviewMode.hiddenDraftShare`, which needs a
  Session Worker newer than 0.8.0. Each hidden question shows the AI's guess
  after the answer, and research records keep `predictionCondition`, the answer
  from before the reveal and when it was shown. Anchoring now compares hidden
  drafts only with shown drafts from the same source.

- Ask AI prefill and interview drafting for confidence as the chance the
  person keeps the answer unchanged (prompt `ce-interview-brief-v6`), so it can
  be calibrated. v4 and v5 links and catalogs still work; the fidelity report
  calibrates only confidences with this meaning.

- Show participants a private score after they submit AI-prefill drafts
  (`interviewMode.showFidelityScore`, which needs a Session Worker newer than
  0.8.0): how many answers their AI matched, its Mirror Score, its hidden-draft
  guesses and most confident misses, worked out in the browser. The footer
  button stays in place.

## [0.8.0] - 2026-10-28

### Agents and MCP

- Serialize Wrapped research batches in the session coordinator. Bind retries
  to their original content, preserve concurrent answer summaries, and return a
  retryable response while KV is busy. Export both readable question sources
  and report source outages instead of silently dropping history.
- Retry unexpected queue-processing failures instead of acknowledging an
  unprocessed submission.

- Use one continuous Wrapped space per session. Remove weekly windows and their
  opening action; saved answers retain their exact statement wording and schema,
  with current access checked on reads and exports.
- Project completed direct agent submissions to KV once and repair delayed
  projections with a durable alarm. Queued successes retain their outcome while
  an accepted persistence-only message repairs KV. Keep successful outcomes successful, retain uploaded
  payload IDs on retry, validate before admission, and use server timestamps.
- Surface Wrapped config/state read failures and proposal outages. Keep the
  first 2,000 proposals with an explicit incomplete marker instead of dropping
  them or reporting complete aggregates.

- Apply participant upload preflight to agent writes, retain submission outcomes
  across authority changes, and retry pre-send failures without duplicate uploads.
- Preserve Wrapped history across selection and visibility changes; fail closed
  on incomplete KV reads and invalid export cursors. Bind signed operator writes
  to their HTTP method and body, and bound registry RPC response bodies.
- Persist native verification capabilities for Admin and reject deployment
  capabilities whose origin differs from the Session Worker.

- Serve new-session Agent HTTP and Session Wrapped from the Session Worker,
  including scoped credentials, atomic invites, source-bound browser exchange,
  managed testnet submissions and optional queue processing. Remove separate
  Bridge deployment and release bundles without migrating or retiring existing resources.
- Apply canonical session gates and stored-key AI policy to agent workflows.
  Optional operator-funded posters stay disabled by default. Agent auxiliary
  state and signing keys are excluded from session archives.

- Prepare MCP 0.1.2 with the updated agent behavior and automated release workflow.
  Default new host configurations to `npx -y --prefer-online @agalmic/contextengine@latest`.
  Existing users should update their host command once and restart to receive
  future published updates; exact version pins remain available for reproducible
  runs. Publication stays disabled until the application release is merged,
  canonical CI passes and the repository owner enables it.
- Add opt-in GitHub-to-npm publication of the exact CI-tested MCP tarball using
  npm Trusted Publishing, with version, source, integrity and stale-run checks.

- Require explicit `session_login` scope when a service credential exchanges
  into a Session Worker login. Personal user credentials retain login, and exchanged
  tokens are capped by source expiry and invalidated when the source is revoked.
- Retain confirmed local answers in incomplete registry reads during a failed
  block-mark check, while preserving newer canonical answers.
- Persist pending answer-upload identities so repeating a timed-out tool call
  replays the settled record. Keep complete Worker listings complete after an
  agent answers, and hold registry scan cursors when a block mark cannot be checked.
- Verify each remembered registry write against its own block before using it,
  share block probes within a read, and report incomplete results when RPC
  history is unavailable without discarding the last verified scan mark.
- Send response-upload request IDs so a retry within an upload operation can
  replay the original stored reference.
- Bind saved agent state to its wallet and stop startup if its key is missing
  or differs from the recorded identity. Legacy state adopts its existing key.
- Rebuild registry reads when the scanned block is replaced, and discard local
  questions and remembered answers from orphaned blocks.
- Route every MCP registry chain call, including reads, log scans and test-ETH
  checks, through one error sanitizer, and redact URLs and ethers diagnostics
  from tool errors and logs, so a keyed RPC URL cannot reach a transcript.

### Client — available when the site deploys

- Restart backup downloads after configuration/group changes or invalid cursors.
  Before restoring into an unpublished session, check the pinned Worker origin
  and show the target before asking for a signature.
- Clear authoring draft warnings and unload prompts after Clear form or successful
  publication, cancelling queued saves of the discarded draft.
- Keep the license-analysis module inventory outside the published site output.

- Add a versioned product film and 1200×630 poster for site link previews, with
  crawler HTML for About. Posts keep their own header images and omit the film.

- Show persistent authoring draft save failures with Retry and Copy draft,
  a JSON download fallback, and an unload warning while failed edits are unsaved.
- Enforce local scripts and wallet workers through the static CSP, with one
  exact script hash for the sandboxed benchmark report. Browser smoke tests
  apply the real headers, reject CSP violations and check blocked injections.
- Reuse an unchanged survey container on response retries, and refresh cached
  readiness on Submit only when submission is unavailable.
- Restart changed-session backups without retaining stale pages. Deployment
  replay identifies a preserved recovery key and its known fingerprint.
- Advance saved-answer revisions when edited, including changing an
  answer back, and discard in-flight submission state when the account changes.
- Recheck unavailable Worker readiness on Submit and avoid caching transient
  network failures. Expire near-head numeric RPC reads after two seconds so a
  recent chain replacement cannot remain cached for ten minutes.
- Preserve operator-supplied recovery keys through wizard identity changes,
  normalize hex case and distinguish supplied from generated keys. Stream JSONL
  restore files and let admins abandon an unfinished restore.
- Show automatic-analysis retry exhaustion beside manual recovery controls.
  Add private admin diagnostics for upload receipts, automatic-analysis retries
  and pending configuration repair, with bounded pages and explicit refresh.
- Keep a submission's operation ID across failed and partial attempts, so an
  unchanged answer can recover a lost upload reply without another stored copy.
- Gate admin corrections on Worker authority-stamp support and explain known
  submission readiness failures. Show Worker API/bundle details and upgrade hints.
- Add complete session backup and resumable restore to admin settings, with
  generated or operator-supplied recovery keys during setup and confirmed key
  export for existing sessions. Key dialogs offer a private download and keep
  their raw values out of browser persistence.
- Preserve the bookmark action the page showed, match Results bookmark IDs
  case-insensitively, and keep optimistic writes that start during a tab reload.
- Extend required browser coverage to lost upload replies, backup/import and
  recovery-key downloads; pin previous-minor records across canonical readers.
- Keep successfully stored Worker answers saved after a later upload fails,
  name the unsaved drafts, and keep Submit available to retry only those drafts.
- Serialize persisted cache writes across tabs and reload saved values on
  cross-tab notifications. Bookmark changes preserve other tabs' additions.
- Merge saved filters, SBT bookmarks and analysis results into current local
  storage, and retain valid bookmark lists when another list is missing.
- Require browser checks for hosted publication, reload, Results, permissions,
  partial-submit retry and concurrent two-tab bookmarks in CI.
- Scope cached Worker questions and answers to the signed-in reader. Account
  switches and logouts purge Worker cache nodes, a load started under another
  account is discarded, and a complete listing drops answers the reader can no
  longer read.
- Load Interview saved answers after a full survey submission, whose stored
  survey container previously failed the whole load.
- Resume capped response listings on the next refresh, so sessions above
  10,000 answers eventually load every row.
- Give multichoice questions that the old delimiter encoding conflated, such as
  options containing `,` or `:`, a versioned id. Every other id is unchanged,
  and either form verifies in the web client, MCP and CE-CC.

### Workers — requires redeployment

- Clear completed restore journals and page receipts in resumable steps, retaining
  a small completion record. A later import must pass the empty-target check.
- Bound upload diagnostics registration to 250 ms, back off failed attempts for
  60 seconds, and retry through the existing alarm; counts can lag until retry.
- Apply outbound URL checks and timeouts to interview openings, and name a missing
  provider key when refusing a request.
- Recognize configured thinking models regardless of name and preserve inventoried
  built-in output budgets with fixed ceilings up to 16,000 tokens. Caller limits
  can only lower them; aggregate AI usage policy remains separate.
- Preserve Headers inputs in Bridge replies and deploy-helper requests; expand
  the source guard to fallback spreads, optional chains and Object.assign targets.

- Bound session-funded AI requests to configured models, per-operation output
  limits, standard processing, and configured reasoning effort. Remove caller
  tools while preserving saved custom-provider Functions. BYO keys keep their
  existing behavior; interview text generation now follows session settings.
  These limits do not provide aggregate AI budgets.
- Add `GET /admin/diagnostics` with incomplete-count reporting and opaque,
  expiring pagination tokens. Uploads now register their receipt stores in the
  diagnostics index on a best-effort basis; this requires a Worker redeploy.
- Preserve CORS headers on deployment, recovery and provider-backoff replies.
- Authenticate backup cursors before building signed pages, and advance group
  backup revisions only when a successful operation changes state. Upload-limit
  errors retain CORS headers, including their 413 responses.
- Restore R2 resource metadata, authenticate backup pages and refuse archives
  when any required recovery key is missing. Detect writes during export,
  require an empty restore target and keep backup/import pages within their
  storage-operation budget. Abandoning a restore removes all imported rows
  through a resumable cleanup journal before releasing the target.
- Protect receipt identifiers and payload digests with keyed MACs, expire them
  by alarm and validate deterministic upload failures before reserving a lease.
  Replayed settled uploads also recover a missed automatic-analysis enqueue.
- Retry transient automatic-analysis failures after 1, 5 and 30 minutes before
  marking retries exhausted. Honor Retry-After up to 30 minutes, preserve uploads
  merged during a run, and pause invalid output without another billed retry.
- Preserve ownership, authority, visibility and group fields in encrypted
  envelope exports. Add complete paginated session backups and signed imports
  covering chunked payloads, config, ownership, groups, wrapped keys and encrypted
  service secrets. Restore requires the matching recovery keys; a hermetic fresh
  deployment drill verifies recovered reads and access rules.
- Deduplicate settled response uploads by participant and request ID for seven
  days, returning the original reference without another storage write and
  enqueueing automatic analysis idempotently.
  An expired attempt can leave an orphan; legacy Workers retain their old behavior.
- Advertise public capabilities and non-sensitive session readiness categories.
- Return newly generated recovery keys only with the fresh deployment response,
  exclude them from saved receipts, and allow confirmed signed admin export at
  most three times per session per UTC day on single-session deployments.
  Multi-session deployment keys remain with the operator.
- Settle Worker Group mutations stranded by a KV failure: the next operation on
  that group or member replays the recorded intent instead of answering
  not-found, and memberships no longer fail for every member.
- Admit queued automatic analysis against the coordinator's authoritative
  config, so disabling AI also stops jobs already queued.
- Walk every question page in the interview catalog and the Agent Bridge before
  choosing versions, and present one current version per question in the Bridge.

### Verification and shared rules

- Verify recovery of saved answers and unsaved drafts after reload without
  resending saved records.
- Exercise current MCP and browser readers against the unchanged previous
  released Worker bundle. Add duplicate-alarm, account-switch, reload-recovery
  and same-height/higher-head registry convergence regressions.
- Pin previous-release tests to an immutable Worker tag and require that tag in
  CI. Include the Agent Bridge and Worker in shared session-ID/sign-in vectors.
- Share group-password derivation, sign-in message/session-ID rules and admin
  typed-data construction while preserving the client/MCP ethers-v5 and Session
  Worker ethers-v6 package boundary.
- Check installed production dependencies and actual client, MCP, Session Worker,
  Agent Bridge and deploy-helper bundle inputs in CI, including bundled development
  packages. Released Worker bundles must carry complete notices; reviewed license
  exceptions fail when their package versions are no longer installed.

### License

- Project-authored code is MPL-2.0 throughout, including Workers, the generated
  deployment package, contracts/Foundry sources and the CC add-on. Earlier
  releases keep the licenses they shipped with. Corpus data remains CC0-1.0;
  third-party dependencies and assets keep their own licenses and notices.
- Ship full generated third-party notices inside all three released Worker bundles
  and with the standalone Worker deploy package, plus the MIT notice beside the
  add-on's bundled ethers library. Release hashes include the appended notices.

### Benchmark reports

- File questions without valid answers under "no data" in the report's tag
  filter instead of "mixed / unsure".


## [0.7.0] - 2026-10-21

### Agents and MCP

- Prepare MCP 0.1.1 with sanitized registry RPC errors and retained transaction
  hashes for uncertain submissions. Keep successful answers successful when
  their local history cannot be saved, returning a separate warning.
- Prevent overlapping MCP state updates from losing remembered sessions; fail
  safely when a writer lock remains after a stopped process.

- Pin a hosted session's ID in the dedicated Agent Session Wrapped policy.
  Hosted Wrapped deployments previously produced a policy their own Bridge
  rejected, so deployment could not verify.

- Release hosted test-ETH quota after setup failures before submission, while
  keeping quota reserved for uncertain transaction broadcasts.

- Read recent registry answers first and resume older history across calls, so
  long-running sessions keep showing new responses within bounded scans.
- Preserve faucet transaction hashes and refusal reasons during SBT claims and
  registry writes, including pending funding and failed balance checks.

- Let MCP agents join unencrypted OP Sepolia registry sessions from normal
  session links, read public questions and results, and submit answers and
  statements with their own test-ETH gas and the session Worker's uploads.

- Show confirmed test-ETH offers in session headers, cached session lists and
  MCP session details. Add `request_test_eth` for agents to request funding
  for their own address, shared with SBT claim funding.

- Package the MCP server as `@agalmic/contextengine`, with a standalone executable
  and bundled license notices. Agents install with `npx -y @agalmic/contextengine`;
  host configs can pin `@agalmic/contextengine@0.1.0`.

- Add a Context Engine MCP server (`mcp/`) that lets an AI agent join hosted
  sessions as its own participant. The agent signs in with its own key, reads
  the session context, answers, adds statements, joins open groups, claims
  session SBTs with the same codes people use, and reads public results. Its
  records match the web app's, so they appear in the same Results, with a
  self-declared agent marker and optional display name.

### Client — available when the site deploys

- Let eligible signed-in participants record or upload audio using the session
  AI key, while keeping anonymous transcription available where permitted.
- Hand a finished dictation to its answer field once, outside React rendering,
  and preserve edits when Submit follows typing, dictation or rewrite immediately.
- Cancel obsolete recordings and AI edits when the account, session, Worker or
  field changes. Keep queued drafts scoped to the authority that created them.
- Show the configured gate names on masked questions and restore the missing
  runtime helpers used by prompt decryption, response resets and JSON previews.
- Show the Worker denial for signed-out dictation even when an injected wallet
  is unlocked; retain valid tokens after terminal scope denials.
- Sign in once more after a scope denial when an SBT claim or Worker Group join
  in any open tab may have granted that scope since the last sign-in, so newly
  eligible participants can dictate or use AI without waiting for token expiry.

- Keep provider keys, wallet keys and faucet keys out of copied setup JSON.
- Refuse header images that publishing cannot upload, such as WebP or SVG, as
  soon as they are chosen or pasted instead of failing at publish.
- Name every setup step, use plain labels for advanced fields, show an access
  badge only on protected fields, and explain why Worker verification must be
  repeated after a reload or settings change.
- Let arrow keys move between hosting templates without choosing one; Enter or
  Space chooses, so keyboard users can compare templates first.
- Keep session-network and SBT rules consistent through edits and reloads;
  preserve custom encrypted-storage rules and explicit HTTP-agent opt-outs.
- Accept valid Arweave Worker setup payloads, validate owner-written Interview
  openings before publication, and clear draft Group secrets when the wizard
  closes or the account changes.
- Keep interview settings saving to Session Workers before 0.7.0 by leaving the
  research-sharing default out while it is off; turning it on needs a 0.7.0 Worker.
- Let owners make sharing AI draft changes for research the default. When it
  starts on, the interview review opens its submission info so participants
  see the choice, which covers drafts they removed, before submitting.
- Describe current response-read permissions and saved export preferences
  accurately in setup; distinguish unavailable dropdown choices visually.
- Let a fresh encrypted session publish its first question without treating
  initial storage-key creation as a change in authorization.
- Request sign-in for private Worker reads that require a participant identity,
  and preserve canonical draft ownership on aliased demo session routes.

- Keep Stats group-dialog labels and profile survey previews readable in light
  and dark themes, with desktop/mobile browser contrast coverage.

- Offer an optional test-ETH faucet for hosted sessions with SBT rules on their
  test network. Validate and privately deploy its key, and show the funding address.
- Limit hosted participant faucets to the caller's wallet and three successful
  payouts in 24 hours; balance and other refusals do not consume the allowance.
- Keep a hosted faucet's quota reservation after an uncertain RPC submission,
  and avoid sending another payout through a fallback RPC in the same request.
- Explain how to continue when an older deploy helper or sponsoring Worker
  refuses participant test ETH; a sponsored grant stays reserved for that draft.

- Offer "Anyone can see the public stored results" for unencrypted hosted
  sessions in `/new`. Choosing it makes stored answers public-read; leaving it
  or enabling encryption restores the default access rules.
- Keep `/new` session settings valid after switching encryption back from Lit
  or removing SBT rules, and keep settings when the selected storage or
  encryption is clicked again.

- Preserve ordinary wallet/passkey web participation when Agent HTTP is enabled.
  Agent-token login opens the agent view, and agent logout restores the web page.
- Rename the retained hosted agent surface and utilities around Agent HTTP. Keep
  agent token login, questions, local drafts, explicit Submit, Worker Groups,
  and aggregate results; remove retired bot/Mini App wizard controls.

### Workers — requires redeployment

- Allow existing Wrapped policies without a session ID to gain that ID during
  updates while requiring every other authority field to remain unchanged.
- Keep automatic analysis eligible after an ineligible trigger instead of
  treating it as a permanent generation failure.
- Re-enqueue pending agent answers after queue publication failures using the
  same request generation; preserve uncertain and completed transaction outcomes.
  Mark the failed submission `retryable` so agents send the same answer again.
- Keep normalized faucet settings stable so enabling the wizard switch does not
  trigger repeated render updates.
- Grant new hosted faucets through `faucet_self`, which older Workers ignore.
  Updated Workers map it to the existing faucet route with recipient and daily limits.
- Update `follow-redirects` to 1.16.1 to fix credential-header handling on redirects.

- Enable public Worker-to-Worker routing so same-account Wrapped health checks
  can run. Preserve verified capabilities and health proof through deploy retries.
- Allow dedicated Wrapped HTTP access to be turned off or back on in place while
  preserving pinned authority and signing secrets; search every KV inventory page
  before creating a deployment namespace.
- Use Cloudflare-compatible redirect handling for Lit requests while rejecting
  redirects before credentials can reach another host.
- Recheck session authority before publishing metadata, preserve upload-time
  ownership, and make canonical version selection deterministic.
- Bound encrypted exports and analysis scans, and validate generated analysis
  claims against the responses they cite.
- Recover queued agent submissions without repeating uncertain broadcasts.
- Keep explicit Agent HTTP disablement authoritative over an older enabled
  alias in profile-less Bridge policies.

- Retire Agent Bridge bot webhooks, commands, callbacks, and Mini App routes.
  Keep scoped HTTP credentials, one-time invites, browser login exchange,
  submission queues, and Session Wrapped. Explicit Agent HTTP disablement wins
  over legacy flags; existing account keys, credentials, queue identifiers,
  legacy HTTP/skill aliases, and historical review evidence stay compatible.
- Remove bot secret provisioning and webhook/menu/name/photo requests from the
  local Bridge deployment helper. Existing deployments require separate operator
  webhook/menu and secret cleanup; no live cleanup is performed by this change.
- Keep caller `humanApproved` submission authorization distinct from historical
  verified human confirmation/edit evidence. Current HTTP routes cannot create
  those historical review records.
- Regenerate the native Cloudflare deployment package with the current Session
  Worker authority and storage fixes.

- Keep generated session Worker and Agent Bridge names within Cloudflare's
  54-character limit for Workers with version previews. Hosted deploys for
  sessions with long names were rejected; existing names are unchanged, and a
  deploy already rejected for a long name asks to be started again.
- Keep the group list of a `group_gate` storage profile when the deploy helper
  stores session config. Without it, the Worker denied every group-gated upload.
- Stop sending the `cache` fetch option, which Workers at the deployed
  compatibility date reject. Deploy helpers could not read release manifests,
  hosted Wrapped deployments never passed their health check, and Wrapped
  Bridges could not confirm session membership.

### Benchmark reports

- Preserve observed response distributions, uncertainty and source provenance
  across saved reports, HTML reports and Context Engine exports.
- Keep legacy analysis fingerprints bound to the saved report while normalizing
  display content. Correct saved distributions using the original cell-rounding
  calculation when necessary, without relaxing inconsistent-statistics checks.
- Keep the benchmark Results presentation and its publication artifact aligned.

### Build and verification

- Update the PDF export dependency DOMPurify to 3.4.17 to address its newly
  reported sanitizer vulnerabilities.
- Refresh the shared Zod dependency to 4.6.7 within its consumers' supported
  ranges to address a validation memory-exhaustion advisory.
- Pin the browser smoke job to Ubuntu 24.04, which supports the pinned
  Playwright version, so runner image updates do not prevent Chromium setup.

### Contract source

- Reject survey and question IDs that collide across the two types, preventing
  them from sharing a response-hash slot. The public ABI is unchanged. This guard
  applies to newly deployed contracts; existing deployed contracts are unchanged.

### Upgrade notes

- Follow the [publication upgrade guide](docs/publication-upgrade.md) before
  the site deploys. The client now gives admin precedence only to versions an
  upgraded Worker stamped at upload, so older admin corrections to questions
  and surveys stop winning until an admin republishes them. Upgrade affected
  Workers and republish intended corrections before the new client is live.
- Builds without a Netlify `COMMIT_REF` deploy the Workers pinned to 0.6.14,
  which never write that stamp; admin corrections in sessions they create keep
  ordinary precedence until those Workers come from 0.7.0 or later.
- Existing Agent Bridges keep their Telegram webhook, menu and bot secrets until
  an operator removes them; this release performs no live cleanup.
- Update the project deploy helper and the relevant session Workers and Agent
  Bridges to use the Worker-side changes; a site deployment alone does not
  update existing Workers. See the [Worker documentation](docs/session-cors-worker.md)
  for deployment and compatibility requirements.
- New hosted faucet setup requires the updated deploy helper and Session Worker.
  Older helpers reject `faucet_self`, and older Workers do not grant it. Do not
  substitute the broad `faucet` scope to work around an old deployment.
- The application is version 0.7.0. MCP source is prepared as the independent
  package version 0.1.1; publishing the application does not publish it to npm.
  The existing `@agalmic/contextengine@0.1.0` package lacks these error-handling fixes.

## [0.6.14] - 2026-10-14

### Client — available when the site deploys

- Show the question actions hamburger by default on mobile, alongside the
  previous/next arrows. Stack the phone question counter in a narrow column
  and keep Submit, clear, the menu, and navigation together on one row.
- Move the filtered question count beside the session's Questions heading when
  there are no surveys, freeing toolbar space on phones. Keep the selector when
  surveys are available, and show zero when no questions match the filters.
- Keep long session names and their link icons inside phone layouts, reserve
  space for the Stats loading indicator, and keep Appearance menus readable.
  Wrap Worker group error details within narrow screens.
- Let Settings sponsorship checks finish across equivalent parent renders,
  retain General among other sponsor sessions, and show the route's session
  context when Settings opens on a session page.
- Count every question type shown in Stats, show loading indicators until the
  selected scope is ready, and request Worker sign-in only for the active session.
- Keep radio-key navigation and open comments on the current question; prevent
  double-clicks and double-taps from answering the next card.
- Match Context's AI prompt preview to the selected session's model settings.
- Verify Home's configured Worker independently of explicit session links and
  retain on-chain group reads for verified hybrid Worker sessions.
- Refresh bounded partial results for large Worker sessions while retaining the
  prior report during loading. The 10,000-record cap and incomplete-results
  warning remain in place.

## [0.6.13] - 2026-10-13

### Client — available when the site deploys

- Align desktop question navigation with the top of the card and keep its counter
  on one line when moving between questions. Keep mobile Submit controls clear
  of the navigation arrows.

- Show the Quadratic question type with a compact four-square graphic.

- Keep the Users Details session selector and Filter on one row, with long session
  titles contained beside the external-link icon.

- Fit Appearance controls into a compact row, align question navigation with
  the action buttons, and retain loaded results during background refreshes.

- Switch the active session directly from the Groups page, with session-scoped
  navigation and the selected session’s Worker discovery address.

- Load Questions in Tools from the selected session’s verified Worker, keeping
  unresolved counts in a loading state and failed reads distinct from confirmed zero.

- Bring the group creation form into view when opening it below the visible list.

- Center the session loading message with larger text and a spinner while keeping
  the elapsed-seconds counter visible across themes.

- Resolve Worker session sponsorship in Settings from verified session config and
  live resource presence. Distinguish unavailable checks from missing sponsorship,
  and retain selected-session model defaults for text AI and transcription.

- Route Context dictation and AI rewrite through the selected session's Worker,
  including local session changes and returning to the global default.
- Keep Back and Session above one Groups action row containing View All, Create,
  and Refresh.
- Restore the Questions toolbar as a full-width bordered panel with evenly
  distributed controls and centered wrapping on phones across all themes. Keep
  it pinned near the viewport top while scrolling, including pending Submit controls.
- Show the owning session name and slug for session-wide group member visibility.
  Keep shared group links scoped with an explicit `sessionSlug`, including when
  a different session is active, while supporting older links.
- Advance the question pile after binary and single-choice answers by default.
  Configure the deployment default in the client environment and override it
  per session with `pileAutoAdvanceEnabled`. Keep manual navigation available.
- Keep the active session selection consistent across Stats, account settings,
  Questions, Groups, and Context. Add a session filter to user details and link
  question rows directly to their session report.
- Simplify Stats counters and distribute four visible totals evenly. Make
  Explorer help work by click, tap, or keyboard even when automatic explainers
  are disabled, and keep navigation controls together when space permits.
- Refine the white theme with clearer account controls, readable wordmarks,
  softer Welcome artwork, larger mobile tabs, and a compact footer. Refresh
  returning clients to the updated default theme once.
- Add a collapsible setup graphic to Docs and shorten Groups help. Keep the
  standalone benchmark Results help popup within narrow screens.

## [0.6.9] - 2026-10-13

### Client — available when the site deploys

- Give Minimal session titles and their info controls readable dark-gray text,
  and show loading labels in black on Minimal and Classic 95 light surfaces.
- Use the shared title spacing, timed fade, and hover/focus reveal in Minimal.
  Compact its mobile header with a smaller logo while preserving account controls.
- Match the RxC session tooltip to the shorter Results description, including
  when cached session metadata still contains the retired trailing instructions.

## [0.6.8] - 2026-10-12

### Client — available when the site deploys

- Apply build-time deployment settings before theme and app configuration load,
  so hosted Worker release commits and self-hosted helper URLs take effect on
  the first browser load. Keep the pinned defaults when no override is set.
- Keep standalone benchmark Results headings, help controls, mobile spacing,
  and vote counts aligned with session reports: vote rows read Agree, Unsure,
  Disagree, and Responses, with Invalid shown when any run gave no usable
  answer.
- Make Minimal the default light theme with readable controls, dialogs, response
  cards, reports, group pages, and article charts. Preserve saved theme
  selections and binary answer colors.
- Add a Sessions directory to community Stats with authority totals and filters
  for session type, creation date, recorded activity, and admin address. Show the
  chart and leaderboard's session scope above each section. Undated sessions stay
  in date-filtered views, labelled "date unavailable".
- Improve mobile session spacing, section help icons, filter checkboxes, and
  narrow-screen logo display. Hide section subtitles while their content is open.
- Show one lightweight vector logo in every theme, sized and placed like the
  previous default logo. Remove the animated logo and the hidden per-theme
  copies that a first visit downloaded (up to about 8 MB).
- Enable the AI question filter for Worker sessions with configured AI access.
  Signed-out visitors in participant-only AI sessions are asked to sign in. When
  questions change, both AI filter views keep their ranking and ask you to click
  Apply to update it.
- Rename the Tools entry to Debate Map, retain its embedded view when a detail
  closes, and remove the disabled Suggest Tool card.

Answering and saved answers:

- Preserve a saved comment when an interview import leaves that field blank;
  explicitly cleared comments remain cleared.
- Keep edits to questions hidden by a filter when you submit, instead of marking
  them saved and discarding them.
- Wait for saved answers to load before any upload, in the pile, View all and
  single-question editors, including after a failed or capped listing, a failed
  start-up load, or a change in another tab.
- Load each question's saved answers before restoring its unsaved changes, in
  the pile, View all, and single-question editors, including questions that
  appear after a Submit (even when the refresh after it fails), a failed Submit,
  a decrypt, a filter change, or a sign-in after Clear changes. Submit no longer
  replaces saved answers with blanks, filtering a question out and back in keeps
  its draft, and an edit typed just before its question is filtered out is kept.
- Keep drafts to unsaved changes only. When restoring them, drop only the fields
  whose saved value changed since, and keep drafts written before saved answers
  loaded. Never store decrypted ratings in a draft while the saved ratings stay
  encrypted.
- Clear the previous account's answers, comments, ratings, and unsaved drafts for
  every session on sign-out or account switch.
- Make clearing a saved answer or comment take effect and stay cleared when
  saved answers reload, upload a cleared locked answer as cleared, keep encrypted ratings intact across repeated submits, keep a pending
  rating through Decrypt & Edit, and never publish a "*" placeholder.
- Keep saved encrypted ratings encrypted unless you turn a lock off, including
  when a locked comment's text is deleted or another question is submitted. A
  Submit leaves the saved answers of questions it didn't upload unchanged.
- After a reload, keep an answer or comment that was unlocked but not submitted
  locked as saved, with a note to decrypt and unlock it again.
- Hold back and name a question that can't be uploaded, such as an answer that
  is too long for the session Worker or a locked answer whose new audience needs
  a decrypt first, and upload the rest. A held-back answer keeps its draft and
  its consent choices.
- Size answers as the session Worker stores them, including the question text
  each answer repeats, locked fields, saved locked ratings, and interview
  records, and say how much to shorten an answer before submitting. Unlocked
  answers can use the full stored size.
- Never revert a consent withdrawal: withdrawn names, AI attribution, and
  research sharing stay withdrawn through undo, Clear changes, reloads, and
  failed or partial submits. After a reload, every stored withdrawal is pending
  and uploads with the next Submit.
- Send interview edits to the imported context (removed facts and names) to the
  AI, include unsaved pile edits in the interview review, and stop uploading
  interview drafts removed after a failed submit or discard.
- Show the saved-answers loading notice on session pages, keep the first pile
  card stable on a fresh visit, and skip re-reading cached question files on
  reload.

Sign-in, wallets, and privacy:

- Restore passkey sign-in after a reload without opening the login window.
  Logging out, or disconnecting from a wallet extension, also signs out a saved
  passkey wallet.
- Clear decrypted session names, information, headers, answers, and Lit keys
  from memory on logout or account switch.
- Send profile Analyze your public answers and public comments, but never
  answers you decrypted in this browser ("Only me", "Me + admin", Session or
  SBT-gated), and never cache an analysis built from them.
- Passkey wallet: reject a signing request for another account (error 4100);
  keep your account on a background re-unlock or ask you to log in again;
  relock when the app switches chains, finishing a request already in flight on
  its original chain; never resend a transaction after a lock; and give each new
  passkey a random user handle.
- Check that your own account signed the key wrap before deriving "Only me"
  keys, for MetaMask and passkey signatures alike. Envelopes written with 0.6.7
  still decrypt.
- Bind importance and conviction decrypts to their rating and question.
- Explain sign-in rate limits ("Too many sign-in attempts…") and retry once on
  an expired sign-in nonce.
- Keep Lit debug helpers out of production builds and load the Poseidon library
  only when a commitment is first computed.

Results and reports:

- Let admins decrypt "Me + admin" and Session answers from Results.
- Keep non-voters and comment-only participants out of the Report's opinion map;
  UMAP no longer treats skipped questions as "Unsure".
- Link named participants to their own profile.
- Prefer question metadata over answer payloads in the Report, CSV, and HTML AI
  analysis, and include multiple-choice answers in the HTML AI analysis.
- Show responses and non-responses for binary questions, count Breakdown choices
  once per person and option, and make the Raw Results summary line count like
  the Report.
- Stop recomputing the Report on idle refreshes, refresh it when comments or
  names change, and keep AI cluster summaries across live refreshes.
- Neutralize spreadsheet formulas in CSV exports, and read legacy 0–100 ratings
  on the 0–10 scale.
- Offer Retry in Results when responses fail to load, instead of loading
  indefinitely.

Authoring, sessions, and links:

- Show document, Arweave, token, and metadata links from uploaded surveys,
  questions, responses, SBTs, and session records only when they are safe web,
  Arweave, or same-site links; show other values as plain text. "View on
  Arweave" links only to Arweave transactions.
- Open uploaded, decrypted, and group files that could run script (SVG, HTML,
  XML) only as text or downloads; only raster images display as images.
- Keep one malformed upload from crashing the survey list or stopping new
  questions and surveys from loading for everyone.
- Treat reusing another author's question as published only when the stored
  question has exactly the same type, wording, and options; otherwise show the
  Worker's refusal. Scope new Worker survey ids to their author.
- Append generated questions to a non-empty draft, and don't let a slow registry
  check block publishing.
- Session creation: verify and publish Worker-backed sessions again (broken
  since 0.6.4); send cleared end times and limits; accept only slugs that
  participant links can open; keep Worker secrets on wherever "Require users to
  pay" is hidden; show why verification failed; and link the live session after
  a lost readback.
- Deploy grants send this build's configured Worker release, never an uploaded
  file or manual URL, and explain clearly when a sponsor has no release to
  deploy. /sponsor refuses grants up front when the sponsoring Worker has no
  release recorded.
- Builds without a Netlify commit deploy the 0.6.7 Worker release by default
  (previously 0.6.4).
- Show when a Lit authority needs replacement and let admins acknowledge the
  content-access limits before creating a fresh authority.

SBT groups:

- Protect group passwords against offline guessing: the client stretches each
  password with PBKDF2-SHA256 (600,000 rounds), salted by the group's contract
  address, before deriving the on-chain password check. Group-password groups
  always deploy to their predicted address.
- Start new group-password groups with a generated five-word passphrase and a
  Generate new button. Warn about custom passwords shorter than 16 characters
  and ask for confirmation. Lock the password during and after creation, and
  show it in the success panel for unlimited groups.
- Explain wrong, unreadable, and unsupported group passwords clearly, and offer
  Retry instead of an open Join when a group's password check can't be read.

App shell and performance:

- Recover from a stale deploy: reload once when a section fails to load, then
  show "A new version of Context Engine is available" with a Reload button.
  Never reload automatically while offline, more than once a minute, or twice
  for the same failure in the same deployed version.
- Cache only files that are part of the current deploy for a year; a missing
  /assets file now returns 404 instead of the app page.
- Enforce a baseline Content Security Policy (frame-ancestors, object-src,
  base-uri, form-action) and report a stricter scripts-only-from-this-site
  policy.
- Load fonts in one request with font-display: swap, give Minimal real Open Sans
  bold weights, and match the browser bar color to the theme.
- Smaller loads: the dev agent no longer ships in production; QR code libraries,
  DebateMap styles, the voice modal, and (on first load of non-demo sessions)
  the demo datasets load only where needed. If a demo's data can't load, the
  page shows the new-version panel instead of staying empty. The About demo
  video is about half the size, and About, post, and social preview images are
  smaller.

Docs:

- Describe the trusted operators for Lit-encrypted data: the session Worker and
  Lit account administrators. New authorities require Worker authorization;
  scoped usage keys alone do not grant key release. Lit is not end-to-end encryption.

### Worker — requires a session Worker update

- Authenticate Lit Action requests with a per-session Worker signature and
  encrypt decrypt replies to that request. A leaked scoped usage key cannot
  impersonate an SBT holder or substitute an RPC. Existing unsigned authorities
  fail closed and need a fresh PKP/group/key cutover; old permissions and
  historical ciphertext require separate handling. See the
  [Lit cutover guide](docs/lit-worker-authorization.md).
- Verify a reused Lit Action CID matches the Worker's signer, session, and PKP
  before granting permissions or returning the existing authority.
- Let only a question's or survey's first uploader or a session admin replace
  it, and add admin hide and unhide for questions and surveys. Ids stored before
  this release become admin-only; very large sessions finish indexing them over
  a few uploads, which may briefly return 503.
- Serve stored files with nosniff and a sandbox CSP, and download script-capable
  types instead of rendering them.
- Sign sign-in nonces instead of storing them, so other people can neither
  cancel a pending sign-in nor stop a wallet from getting a nonce; nonces are
  EIP-4361 compliant.
- Parse sign-in messages as strict EIP-4361 and require the signed Worker and
  session binding.
- Refuse voice calls when interviews are off, compare the deploy-helper secret
  in constant time, and cap and shape-check uploads (128 KiB per question,
  256 KiB per survey, 2 MiB per response upload, 96 KiB per stored answer).
- Results analysis: superseded public answers no longer return after a
  participant locks or clears them; only encryption flags lock a row; ratings
  read like the client; ties break deterministically; admin snapshots validate
  current question types and keep older types such as polls; answers that older
  clients cleared while locked read as cleared.
- Validate set-config against the merged config, replace limits on set-config,
  and compare origins ignoring case, default ports, and a trailing slash.
- Sponsored grant deploys use only the sponsoring Worker's recorded release. The
  0.6.8 deploy helper records the verified release on each new session Worker,
  and a retried deploy whose bundle check fails stays pending instead of
  orphaning its staged resources.

### Agent Bridge — requires an Agent Bridge Worker update

- Sign the Worker and session in sign-in messages. Update the Agent Bridge
  **before** session Workers: the new bridge works with both Worker versions,
  while 0.6.8 session Workers refuse the older bridge's sign-ins. This order
  keeps Telegram, Mini App, agent, and managed-faucet sign-ins available.
- Preserve established session aliases in those bindings and reject a named
  session mismatch without retrying against an unspecified session.

### Upgrade notes

- Breaking: password joins and new invite links no longer work for SBT groups
  created before 0.6.8; a clear message explains this. Invite codes already
  issued keep working. Admins who want password joins need a new group.
- Sponsoring Workers must run 0.6.8 or later code, with WORKER_BUNDLE_URL and
  WORKER_BUNDLE_MANIFEST_URL set, before their grants deploy a pinned release.
- Update each session Worker before editing questions or surveys with the new
  client. Rows written by 0.6.7 and earlier have no trusted uploader metadata,
  so readers use the earliest version, subject to the client's plaintext
  question hash-integrity check. Reapply any edits made during the
  upgrade window after the Worker update; updating alone does not recover them.
- Export required readable Lit content **before** updating that session's
  Worker. The new Worker rejects unsigned authorities, and creating a fresh
  authority does not migrate or restore access to historical ciphertext.
- During an in-place session Worker update or rollback, sign-in and new-id
  uploads can fail briefly while the update propagates. Nonce issuance fails
  closed with a retryable 503 when the coordinator cannot issue a signed nonce;
  it does not fall back to issuing a legacy stored nonce. Previously issued
  stored nonces remain consumable once.
- Fresh listings omit hidden question and survey ids. Older cached clients may
  retain entries until updated or reloaded. Unauthorized rewrites of an owned
  id return 409.
- Hiding removes a question or survey from discovery, new-answer views,
  interviews, and analysis. It does not delete historical responses or remove
  them from Raw Results and CSV exports; already-open cached views may need a reload.

## [0.6.7] - 2026-10-09

### Client — available when the site deploys

- Combine RxC context and topic navigation in one compact section. Start with
  three area circles, zoom into a group or topic in place, and use Back to return
  without scrolling past the full topic list. Related topic links omit the extra
  heading, and the introduction omits the repeated “More context” topic summary.
- Temporarily hide Debate Map for `rxc-ra-test`, keeping Report, Raw Results, and
  the Context guide available.
- Omit retired participation instructions from the `rxc-ra-test` report description,
  including when older session metadata is cached.

These client changes do not require updating existing session Workers. The known
issues listed for 0.6.5 remain unchanged.

## [0.6.6] - 2026-10-08

### Client — available when the site deploys

- Reuse cached user analysis when visible profile inputs are unchanged, including
  hosted profiles and the default session. Opening Analyze no longer forces a
  refresh; changed inputs, explicit Refresh and the existing 24-hour expiry still
  generate fresh analysis.
- Open Reverse Alignment focus areas in place of the topic list, with Back and
  previous/next controls at the top for easier navigation on mobile.
- Remove the decorative atlas image and redundant debate-map preview text.

These client changes do not require updating existing session Workers. The known
issues listed for 0.6.5 remain unchanged.

## [0.6.5] - 2026-10-04

### Client — available when the site deploys

- Update the legacy Axios dependency to fix inherited request-method and form-data option handling.
- Make quadratic allocation easier to answer: each option has − and + buttons, a block of squares showing what its votes cost, and a bar showing where your credits have gone. The question-type tile shows a matching compact preview.
- Keep group details inside session pages, simplify interview review controls,
  and improve help controls, documentation contrast and mobile atlas layout.
  Results now separates Report, Debate Map and Raw Results for RxC sessions.
- Make the pile and editing-card decrypt buttons open saved locked fields.
  Preserve audience changes made before or during decryption. Decrypt saved
  ratings with the answer so audience changes re-encrypt all three, and retain
  encrypted importance and conviction across successive locked edits.
- Wait for saved responses to load before uploading changes from a new device.
  Show loading and retry feedback, recover after a failed refresh, and read the
  participant's own saved answers when a complete public listing is unavailable.
  Keep completed submissions readable and preserve untouched answers, comments
  and ratings across sittings.
- Keep locks chosen on blank answers and comments while saved answers load.
  Allow navigation during that read, clear stale loading feedback after account
  changes, and let a completed sync supersede a stalled read on the next Submit.
- Make interview name and AI-attribution choices agree with the uploaded record
  after a failed submission, reopening or reload. Show the name actually being
  sent, retain consent per question, and keep withdrawals when moving between
  pile and full-survey editing.
- Let interview Apply finish after its own-answer read while public results
  are still loading, and clear read failures after a successful retry.
- Avoid repeated session initialization when the live URL changes between
  sessions before router props catch up.
- Preserve valid group joins through same-content configuration refreshes, while
  cancelling joins when their destination changes or authentication fails.
- Keep decrypted drafts with their owning account, mask retained locked values
  in uploads, and pad encrypted choices to avoid revealing their selected length.
- Bind sign-in messages to the intended Worker and session, improve rating
  keyboard controls, and reduce unused code and eager imports.

### Worker — requires a session Worker update

- Reject sign-ins and upload authorizations bound to another Worker or session,
  and validate signed destination Resources before accepting uploads.
- Count public answers with locked notes accurately in Results, while keeping
  encrypted ratings and note contents out of public analysis.
- Pin downloaded Worker packages to the client build's release. Updating the
  client does not automatically update an existing session Worker.

### Known issues

- In full-survey editing, saved per-question name and AI-attribution choices
  arriving after the editor mounts can be omitted from a later edit.
- Production SBT detail pages can lack the current block number because the
  subscription depends on a component name changed by minification.
- Simultaneous consent changes with equal timestamps and reloads against a
  lagging response cache still need stronger conflict-resolution guarantees.
- On a new device, leaving a question while saved answers load can leave its
  saved answer blank in the editor. A later comment-only submission can then
  overwrite that saved answer with an empty value.
- If the response listing lags immediately after a submission, loading saved
  answers can briefly revert a just-saved answer in the editor.
- On a new device, an interview prefill can clear a previously saved comment.

## [0.6.4] - 2026-09-28

### Client — available when the site deploys

- Add a browsable Reverse Alignment Atlas with twelve focus areas, source context,
  search, related topics, and mobile navigation for the RxC sessions. Keep the
  unpopulated topic map in Results labelled "Waiting for more data".
- Discover both RxC test sessions from their clean URLs on a fresh visit.
- Display linked community groups from their configured owning session, preserving
  existing memberships and logos without creating duplicate groups.
- Put compact AI submission choices beside Submit responses, strengthen the
  review heading, and remove the duplicate imported-context title.
- Resolve the signing chain before encrypting responses and preserve the saved
  chain during decryption. Hide new response locks when encryption is disabled.
- Keep Only me fields restricted to the submitter. Offer Me + admin on compatible
  Cloudflare sessions and Session only when membership is private.
- Keep binary interview answers when drafts are submitted again, for example
  after a cancelled signature or Continue interview, and keep unsaved pile edits
  when the interview loads saved answers.
- Make quadratic Reset an undo: it restores the AI's drafted allocation during
  interview review and the saved answer elsewhere, and stays disabled when
  nothing would change.
- Keep a later AI comment when the first draft had none, and restore the
  AI-proposed marker when a comment returns to its starting text.
- Score comparison ratings on each question's own scale, and count report
  answers with the same validation as the Worker's analysis.
- Load the Session Wizard without a second copy of the global stylesheet.

### Worker — requires a session Worker update

- Add authenticated response-field key wrapping for administrator and private
  session audiences, with current membership checks, bound session/field context,
  audit records, and no plaintext key cache in the client.
- Allow explicitly opted-in Cloudflare sessions to offer optional field encryption
  while keeping ordinary responses and Results public by default.
- Advertise these audiences only when the Worker has the encryption key and audit
  storage available. Existing session privacy settings remain unchanged.

### Agent Bridge — requires an Agent Bridge Worker update

- Describe quadratic questions to agents with their voice-credit budget, and
  document the quadratic answer format in agent instructions and skills.

## [0.6.3] - 2026-09-23

### Client fixes — available when the site deploys

- Show comparison summaries and clearly labelled perspective maps together, with
  model attribution and expandable comparisons for each answer type.

- Keep session-scoped profile groups on the selected session, distinguish private memberships from empty results, and place theme and color-blind controls together when space allows.

- Keep profile comparisons in the selected session, load Hosted answers without waiting for chain membership, verify the session configuration on a fresh visit, and show elapsed seconds and Retry when session data cannot load. Restore compact participant pills and comparison styling in both themes.

- Show which AI model generated a profile summary and describe preferences in
  plain language rather than listing scores and vote totals.

- Make interview prompt copying work on the first ready tap in Safari and iOS.
  Check session compatibility in advance, offer Retry when that check fails,
  and reveal the prompt for manual copying if clipboard access fails.
- Keep interview submission working with older session Workers by waiting for
  complete public response hydration when the older saved-answer lookup is
  detected. Current Workers retain strict saved-answer identity and completion
  checks. Existing v4 and v5 interview catalogs remain supported.
- Preserve interview review edits and complete voice instructions, handle
  legacy transcript events, and improve rating and quadratic-answer validation.
- Correct report totals, response ordering and exports; keep partial results
  visible with a warning when a large response history exceeds the loading cap.
- Improve keyboard access, report contrast, group filtering and cancellation,
  and passkey locking. Reduce the initial application bootstrap download.

### Worker fixes — sessions created after this release

New sessions receive the Worker package from this release. The package:

- Enforces private response-read permissions and the configured upload gate.
- Validates storage resource names and checks current authentication on the
  results-analysis artifact route, including stale tokens.
- Improves nonce handling and batches response-index reads.
- Supports authenticated `mine=true` saved-answer listings with responder,
  session and pagination proofs.
- Verifies the public configuration used by setup and publication, and keeps
  Verify usable before the first Publish.
- Strengthens Telegram invite, group and administrator authorization and
  validates all supported answer types in generated results.

Sessions created before 0.6.3 keep their existing Worker and remain supported
by the client. Creators may redeploy to pick up Worker-side fixes.

## Previously published changes

- Align report response bars with pile colors and add persistent Color-blind mode
  under Theme settings, applying shared response and chart palettes across the
  site and PDF reports. Preserve multiple-choice bars in desktop PDF captures.

- Add filtered written-response, rating, multiple-choice, and quadratic sections
  to the Polis report, with top-question previews, expansion, and PDF pagination
  that keeps fitting question blocks together. Remove the binary-only notice.
- Populate built-in Polis demo reports with tagged examples of all four answer
  sections, multiple questions per type, and configurable quadratic budgets.

### Added

- Quadratic allocation questions with configurable voice credits (99 by default),
  signed whole-number votes, quadratic budget validation, and positive, negative,
  and net result totals. Available in survey and standalone authoring, response
  views, named-vote AI analysis, exports, interview prefills, Telegram, and the
  local companion. Tag cards, simulated profiles, demo adapters, and report
  snapshots preserve ordered options and custom budgets.
  Pile submission errors remain visible with pending answers available for retry.

### Changed

- Added Cloudflare Group auto-join links on the detail pages of open, session-visible Groups.
  Session links retain the target across navigation and refresh before sign-in,
  join immediately after login, recognize existing membership, and clear
  completed or cancelled intent. A compact notice names the Group
  before sign-in and offers cancellation alongside the status.
  Group detail links preserve public Worker discovery across new tabs.
  Older clean Group links re-verify cached Worker discovery and show the full
  Group page instead of falling back to SBT block-scan progress.
  Kept the Cloudflare Groups refresh icon borderless and beside the section title.
  Matched the full Groups toolbar controls in height and styling, with subtle
  half-opacity white borders and borderless Refresh.

- Refreshed About functionality copy with accounts, gated content, and interviews.
  Added collapsible related-work and recognition sections with project-specific
  descriptions and links, including the Cosmos × FIRE grant announcement and
  Foresight Institute grant. Grant and event cards use official Cosmos × FIRE,
  Foresight, EDDY, and Edge Patagonia artwork.
  Recognition entries include visual badges, Agent Village artwork, and a
  collapsed preview strip. Renamed the original Recognition section to Acknowledgements.
  Related Work previews benchmark, eval, and media categories, with entries for
  Agent Village Wrapped and Ladders Made of Numbers.
  Moved Whitepaper and the email icon into the title bar and kept the mobile
  Demo and New Session actions side by side. Use-case buttons use compact rows that wrap on smaller screens.
  Title links briefly expand with matching labels on hover, focus, and press.
  Kept Related Work and Uses & Recognition previews compact, with square badges.
  Recognition combines Recognized & Used By and Acknowledgements under one dropdown.
  Acknowledgement dialogs introduce each entity before its connection to Context Engine.

- Kept Account Settings open when a saved passkey session restores in the
  background; the one-second success auto-close now belongs only to an explicit
  passkey **Create** or **Login** action. The signed-in owner's profile labels
  its session-scoped Cloudflare membership list **Groups Joined** and refreshes
  that private list when the active Worker session changes.
- Restored direct URL/file/photo context saves in the Tool Explorer without
  requiring question generation. The action names the active session, routes
  canonical Worker sessions through Cloudflare document storage, keeps
  Arweave/Lit behavior scoped to Arweave-backed sessions, and improves queued
  photo removal contrast across themes.
- Aligned the local Context Engine companion's default session scan with the
  Cloudflare-canonical `demo-sh` default and made its Worker login integration
  fixture attest the registry chain it is actually testing.
- Added credential-free CI configuration-contract coverage for every reachable
  session-mode family, plus runtime assurance for generated Cloudflare Worker
  envelope storage, concurrent multi-agent voting, representative
  response-encryption paths, and both `/new` infrastructure presets while
  keeping external-service live suites operator-run.
- Hardened the operator-local Cloudflare two-key E2E around isolated dev-server
  ports, exact deployment/auditor credential roles, current preset copy, Worker
  secret readiness, and fresh-KV propagation. The live proof now verifies the
  exact restricted token policy, worker-canonical login and encrypted
  upload/read/export, and exact cleanup of its temporary Worker and namespace.
- Reworked the demo Context viewer with a compact single-row desktop header so
  tweets, policy, papers, essays, interviews, sci-fi, metrics, and cross-corpus
  synthesis each use a distinct medium-native presentation. The Question
  Results modal now uses a coherent high-contrast overlay palette with a
  clearly separated light action panel.
- Brought pre-deployment Cloudflare Worker Group drafts to feature parity with
  normal Group creation: `/session/new` now queues image URLs or deferred local
  image uploads, tags, public reference URLs, member limits, join deadlines,
  admin addresses, join modes, and member visibility. Publish uploads local
  artwork only after Worker identity verification, merges session default tags,
  and preserves the uploaded URL for safe retries.
- Kept answer and additional-comment encryption controls independent by default:
  locking an answer no longer visually or actually encrypts its comments unless
  the user explicitly selects **same as answer** or a mandatory gate applies.
- Shortened the ordinary Claude/ChatGPT interview-prefill prompt, moved new
  handoffs to a distinct inert catalog URL to avoid stale external fetches, and
  made binary, rating, and multichoice answer formats explicit.
- Added default-on, per-session voice modes to the session microphone:
  `?mode=interview` runs an OpenAI Realtime one-person interview and maps only
  supported transcript/context evidence into explicitly reviewed response
  drafts, while `?mode=recordGroup` reuses rolling transcription to generate
  draft questions. Ordinary ChatGPT or Claude can use a public per-session
  Worker prompt and base64url fragment link to prefill the same review flow
  without MCP, plugins, installation, or pre-login account linking. Existing
  local answers are never replaced silently, normal login/submission remains
  final authority, and optional source platform/model prediction provenance is
  retained beside the final edited answer. Session creators can set the OpenAI
  Realtime voice model in `/new`; it defaults to `gpt-realtime-2.1` and is
  persisted in the public per-session interview configuration. The Interview
  modal now uses the session's high-contrast surface tokens, hides responder
  context unless an AI prefill supplied it, replaces verbose status text with
  an accessible green/red dot, and presents the Claude/ChatGPT memory handoff
  in a collapsed-by-default card titled **Paste this prompt to augment interview
  with history from Claude or ChatGPT**, with a dedicated caret-labelled **View
  prompt** control, muted prompt preview, and top-right clipboard icon. That
  zero-install handoff now presents itself
  as an explicit review-only user request, accepts only a session-approved
  return origin, requires a readable fact preview before encoding, strips
  identifying source details, and returns a clean interview link instead of an
  opaque empty packet when no relevant memory exists. The copied prompt now
  contains the complete user request while the fetched Worker endpoint returns
  only an inert JSON question catalog, avoiding fetched-page instruction
  ambiguity. External agents can include defensible low-confidence predictions
  with an explained basis; confidence is shown in the review UI and retained in
  submitted prediction provenance without re-authoring version 3 drafts through
  another model. The review now uses pile-style binary choices, confidence
  progress meters, collapsed evidence bases, compact remove/apply actions, and
  a scroll-bounded sticky apply rail. Copying the external-agent prompt gives
  immediate checkmark feedback, and the prompt asks Claude/ChatGPT to hide the
  base64url payload behind an **Open prefilled interview** link. Model provenance
  now survives the anonymous-review-to-login draft migration before submission.
  The `demo-interview` poll questions now use question-specific
  choices while legacy demo fixtures retain their historical choices. Realtime call setup now preserves the browser
  SDP offer byte-for-byte (including its terminal CRLF) and sends the SDP and
  JSON as typed multipart fields, avoiding OpenAI's empty-offer parse failure.
  Voice-mode chooser hover states now keep both titles and descriptions on the
  high-contrast accent text color, and the modal heading is larger. The
  interviewer now explicitly invites personal or topic-level insight and tells
  the responder they can steer the conversation at any point; completed
  responder speech is available afterward in a collapsed transcript
  disclosure. Empty evidence-to-response mappings now show a descriptive,
  high-contrast “not enough information” notice with concrete next steps and
  hide the unchanged retry action. The bundled `demo-interview` session also
  resolves its Worker without exposing a `worker=` query parameter. Claude and
  ChatGPT handoffs may now carry an already-known preferred responder name;
  sharing it with submitted answers requires a separate default-off opt-in, and
  opted-in names become the participant label in the results report. Interview
  review also has a separate default-on accuracy-research consent that records
  the original AI prediction, final submitted response, confidence, and changed
  fields. Locked answers and comments are represented by redacted markers in
  that comparison, with final plaintext captured before encryption solely to
  calculate the edit signal.
  External Claude/ChatGPT handoffs now also self-report research coverage:
  distinct prior chats, memory items, connected sources, and user-authored
  statements searched or used. The review shows those counts, unknown searched
  totals remain `null`, and opted-in model provenance retains them beside the
  final prediction comparison for fidelity analysis.
- Refreshed mounted Stats immediately after successful Cloudflare group
  mutations, evicting the affected session's short-lived Worker catalog cache
  before recounting groups and visible participants.
- Fixed Stats Users/Participants for Cloudflare-canonical sessions so visible
  Worker group admins and the signed-in viewer's own memberships contribute to
  the identity count without fetching or inferring hidden member identities.
- Updated Tag Explorer's Groups count and listing to combine tagged on-chain
  SBT groups with the public or account-authorized Worker group catalog for
  Cloudflare-canonical sessions, including direct URL-pinned demo sessions
  before registry hydration, using Worker-native detail links.
- Fixed inline Polis filtering for Cloudflare-canonical sessions so tag and
  question-type totals use identity-matched Worker question metadata instead
  of silently treating every question as metadata-free.
- Fixed Raw Results for pure Cloudflare-canonical sessions so identity-matched
  Worker question/response caches populate totals without requiring a chain ID
  or starting an RPC latest-block read.
- Fixed home Stats for an active Cloudflare-canonical session so questions and
  surveys come from its identity-scoped Worker caches, Groups count the
  viewer-visible Worker catalog, and the Groups detail modal stays on the
  Worker-native route.
- Renamed the `/new` setup choices to **Centralized** and **Decentralized**, moved Session
  colors into a default-collapsed More options section, and replaced the
  freeform group-creation policy input with a constrained dropdown there.
- Restored centered Welcome-slide headings across responsive layouts while
  preserving each theme profile's constant slide-frame and navigation height.
  Classic 95 now uses a compact viewport-aware frame across every slide, with
  wrapped titles and copy kept inside the shared content pane.
  On standard full-screen desktops, the opening artwork is centered and sized
  to keep the controls visible while placing the site footer below the fold,
  and the taller navigation strip restores the pre-theme 80px arrow scale.
- Replaced the Classic 95 beeswarm tooltip's yellow-to-olive Unsure gradient
  with a solid warning-yellow segment.
- Kept both Classic 95 Welcome-slide navigation arrows fully opaque and white
  while preserving the Context Engine theme's existing arrow treatment.
- Restored editing controls for an account's submitted standalone-question
  response and made explicit passkey login open the platform chooser when
  multiple passkey-derived wallets are available; background signing remains
  pinned to the active credential.
- Gave the Classic 95 question lock-audience popup a raised Windows-style
  boundary so it remains distinct from the question card beneath it.
- Fixed signed-out standalone-question bookmarks so the control updates its
  pressed/color state immediately and restores the session-scoped bookmark
  after a reload.
- Restored the Questions toolbar's viewport-sticky behavior in Classic 95 and
  kept unchanged response inputs memoized so binary vote selection avoids
  rebuilding every visible question control.
- Kept related-tag chips readable in both bundled app themes by using each
  theme's paired control surface and foreground colors.
- Reordered Docs so Prompts precedes FAQ, removed the external-tools notice,
  grouped the bottom session context and Smart Contracts viewer in one frame,
  and added a public GitHub shortcut beside the title. The signed-out login
  control is now text-only and uses the active theme's button font.
- Removed the duplicate Posts link from the About hero while retaining Posts
  in the persistent footer navigation.
- Added a named runtime SCSS app-theme contract with user/deployment precedence,
  pre-paint initialization, a default-on Settings selector, and bundled
  `context-engine` and `classic-95` themes. The complete client presentation
  surface now consumes semantic runtime color, typography, geometry, border,
  elevation, and control-state tokens; a zero-baseline source gate prevents
  raw presentation colors outside narrowly owned theme, export, QR/bitmap, and
  deterministic avatar sources. Session metadata cannot select an app theme.
  Question authoring now uses explicit paired workspace/control/input tokens;
  Classic 95 renders the generator and its toolbar on readable standard gray
  surfaces with white fields instead of mixing black controls into navy. The
  session question, simulated-user, and Groups surfaces now retain readable,
  minimal gray panels at desktop and mobile widths. Its semantic
  `desktop-window` layout profile now presents Tools as Control Panel applets,
  Community Stats as a participant/plot split window, session questions as
  compact dialogs, and footer navigation as a taskbar without theme-ID
  selectors in components. The Classic 95 taskbar stays docked to the viewport
  bottom on short and scrolling pages while reserving space for page content.
- Fixed local Vite startup for the shared CommonJS group-password derivation
  helper. Persistent startup failures now stop after one automatic cache-busted
  reload, and the recovery heading uses the active panel-text token so the
  fallback remains readable across themes.
- Added **Session colors** to the Session Wizard with the curated
  `context-engine`, `ocean`, and `amber` schemes, immediate preview, exact
  `appearance.colorSchemeId` persistence across Worker/Arweave paths, scoped
  active-session accents, accessibility contrast checks, and fixed-light
  standalone exports.
- Added `/session/demo-2` as a fixture-backed preview of “Living With
  Artificial Minds”: 40 typed questions, 62 unique simulated participants,
  deterministic generated responses, and a three-cluster Polis report.
  Poll choices, rating bounds, freeform answers, and stable question IDs now
  agree across the session, report, and question-results surfaces. Simulated
  rows are display-only and live responses win collisions. `demo-sh` remains
  the public default until a dedicated demo-2 Worker, canonical question seed,
  and Worker-held AI key pass live voice/AI verification; no credential is
  stored in the preview config or fixture data.
- Preserved the published `demo-sh` question fixture exactly while preventing
  tri-state sentiment from being presented as a poll, rating, or freeform
  answer. Distinct corrected choices for legacy polls remain deferred until a
  deliberate Worker reseed. Direct Debate Map issue links now close back to the
  Atlas index when no safe return target exists.
- Made SBT and related holder-cache writes atomic across discovery, detail
  hydration, profile scans, filters, selectors, and realtime events. Delayed
  scans now preserve newer activity, unrelated networks, and concurrent user
  responses, and readiness is published only after persistence succeeds.
- Added a `/benchmarks` route for bundled AI Opinions Benchmark reports. The
  static viewer treats models as participants, preserves interactive report
  controls inside a sandboxed frame, and labels incomplete or unvalidated
  artifacts as development previews rather than released results.
- Replaced the `/contracts` utility reference with a user-facing `/docs` page
  containing a quickstart, session-options guide, and FAQ. The page retains
  AI prompt references and a contract deployment explorer that waits for an
  explicit session selection before showing its chain and published contract
  addresses; sessions without published addresses show an empty state instead
  of global template contracts. The page removes the JSON bundle and
  byte-conversion UI. Existing `/contracts` paths permanently rewrite to
  `/docs` while preserving deep-link paths, queries, hashes, and deployment
  base paths.
- Added a repository link to the Docs header. Refreshed the public `llms.txt`
  agent summary with the
  current deployment profiles, authoritative architecture references, and safe
  automation guidance.
- Made address comparison session-aware across legacy registry, pure
  Cloudflare, and hybrid session profiles. Compare routes now preserve the
  active session, wait for its canonical caches, isolate cache and prompt
  fallbacks by slug, await on-chain profile enrichment before analysis, and
  skip chain scans for pure Worker sessions. Independent summary, compass, and
  overlap work now loads concurrently with section-level progress, and compass
  exports use a descriptive comparison filename. Two- and three-participant
  Venn diagrams now share one deterministic region model, expose keyboard- and
  click-pinned detail cards with membership images, and keep AI output from
  overriding region counts or evidence. SBT comparison and profile ownership
  now share session + chain + contract identity and one count-provenance rule;
  native Worker Groups use the same projection contract with session + group
  identity. Canonical compare URLs now use repeated `subject=` parameters with
  explicit `wallet:`, `worker:`, and `sim:` tokens; legacy address-path links
  normalize through the same route contract. Wallet and Worker responders now
  resolve from the active session projection while shipped simulated personas
  use stable corpus question IDs; the UI names each source and session, skips
  chain/cache waiting for simulation-only comparisons, and suppresses opinion
  or membership sections when their evidence is not canonically compatible.
  Related simulated-persona cards now offer a canonical compare action while
  retaining their existing profile links.
- Moved the Community, Polis, and demographic-comparison question beeswarms
  onto a reusable renderer with explicit consumer-owned metric/domain labels,
  named force/stacked layouts, stable-key hover state, and
  keyboard/click-pinned detail cards. Community's live and demo paths also
  share one result-to-point projection so their counts and fallbacks cannot
  drift.
- Clarified the repository boundary between canonical Worker source,
  Cloudflare-native deployment packages, local bundle output, immutable CI
  bundle releases, and the stripped public-source snapshot. Release docs now
  accurately distinguish immutable bundle publication from the separately
  approved stable/`latest` promotion workflow. Source-tree public-text checks
  now scan the same tracked and non-ignored files as the release exporter,
  avoiding ignored local caches without overlooking untracked release input.
- Streamlined the client dependency surface by removing eight unused direct
  packages, replacing standalone preview and source-map tools with Vite-native
  preview and a local deterministic bundle report, and loading only the
  two-input and three-input Poseidon implementations used by survey runtime.
- Added automatic patch-version commits for each prepared public release
  candidate, synchronized across root/client manifests and lockfiles. Public
  release tooling, pre-push checks, CI, and worker-release metadata now enforce
  the shared version, while minor and major bumps remain explicit
  operator-directed decisions.
- `/new` now capability-filters optional fields even after `Customize`: pure
  Cloudflare sessions omit block, faucet, and contract controls, persist
  generic Worker/Group defaults, and may set a Worker-enforced closing
  timestamp that stops participant resource use and mutations while preserving
  reads and signed admin access. Explicit Cloudflare + on-chain SBT profiles
  expose only their network and Group Factory subset; decentralized profiles
  retain their chain controls. Worker Group creators now prefill the configured
  generic tags with legacy `defaultSbtTags` fallback. Joining a Worker Group now
  reports success and changes the membership action to **Leave**; authenticated
  participants can remove only their own membership through `/groups/leave`.
  Permission-visible Groups expose a paginated SBT-style member browser without
  leaking Worker storage keys, and unlimited capacity now uses only the
  infinity icon instead of repeating “Unlimited.”
- Telegram group approval no longer creates bearer-capability `startgroup`
  URLs. Bot, Mini App, and Agent API compatibility surfaces now direct a
  configured session admin to approve from inside the target group with
  `/join <session>`, while legacy approval payloads fail closed. Mini App
  onboarding now accepts signed Telegram `initData` only in a POST JSON body or
  the canonical request header; GET and query-string credential transport are
  rejected.
- Worker-canonical sessions now project setup, account settings, Admin metadata,
  diagnostics, secrets, and route errors from the active capability profile.
  Pure Cloudflare sessions use passkey access, Worker config, AI, storage, and
  native Groups without presenting RPC, gas, faucet, Arweave, Lit, registry, or
  SBT requirements; explicitly enabled hybrid and registry sessions retain
  their chain controls. Profile compilation, persistence, canonical readback,
  and Worker validation now reject schema-only, unavailable, malformed, and
  cross-lineage combinations instead of inferring capabilities from legacy
  chain fields. Profile-bearing Worker records now require one matching
  canonical storage object, including exact backend, payload policy, and access
  conditions; incoherent deploys, mutations, and public readbacks fail closed.
  Public-result claims require unencrypted public storage. Session pages also suppress wallet/network controls, Lit hooks,
  SBT auto-mint and filters, non-Cloudflare document references, and Polis
  blockchain metadata for pure Worker profiles, clearing stale chain-backed
  state when the active capability profile changes.
- The native `/new` deployment path now presents an honest Cloudflare dashboard
  checklist with copy controls, return guidance, and Worker URL/CORS/canonical
  config verification before success. Its entry chooser removes redundant
  infrastructure guidance, identifies decentralized RPC access and gas as
  `EVM RPC URL` and `EVM Gas (TX Fees)`,
  and links directly to the README architecture diagram on GitHub. The
  deploy-helper remains a collapsed legacy fallback.
- Worker route failures now distinguish missing discovery, reachability, CORS,
  missing canonical config, and identity mismatch, while native Group cards add
  stable detail/share links and state the current admin-managed leave boundary.
- Worker-canonical web sessions now use native Cloudflare Groups instead of
  opening the on-chain SBT deployment form. Group records support names,
  descriptions, HTTPS images, open or admin-added membership, and visibility
  without contract addresses, chain transactions, gas, RPC, or burn settings.
  They also retain SBT-style tags and public reference URLs plus Worker-native
  member limits, self-join deadlines, and group-admin addresses; limits and
  deadlines are enforced in the authoritative Durable Object membership path,
  and participant creation derives the admin address from the signed principal;
  their creator now shares the compact URL, clipboard-paste, file-upload, and
  preview workflow used by the SBT creator, publishing uploaded files through
  the active session storage policy before group creation;
  the client pins the exact Worker origin while nonce/login, JWT, Group
  request/response, record, and Durable Object state bind the canonical slug and
  session ID. Missing or conflicting identity and pre-existing same-slug data
  fail closed with reconciliation required, late cross-session responses are
  discarded, Worker/SBT hybrids label their configured on-chain conditions
  separately as Advanced access, Worker-native creation stays scoped to the
  active session, and registry-backed sessions retain the SBT flow. Native
  Group card bodies now open the full SBT-style detail layout in a new tab;
  canonical list links use `/groups?sessionName=<slug>` and non-address
  Worker detail links use `/group/<groupId>?sessionName=<slug>`. Legacy
  `/groups/:slug` links normalize to those routes, while address-shaped
  Worker IDs remain at `/groups?sessionName=<slug>#group-<groupId>` so
  `/group/<address>` stays reserved for SBT detail.
  Full detail translates SBT stats into member capacity and a live join
  deadline, exposes member counts and identities only through authenticated
  visibility-aware responses, and renders the Group's public document
  references and tags in the shared More section.
  Legacy per-session Worker question payloads without an embedded session ID
  remain readable from their verified Worker authority, while present
  mismatched or malformed IDs still fail closed; cache readiness now commits
  after the final Worker hydration state so session question collections render
  immediately.
- Every `/new` mode now offers an admin-only or all-participants group-creation
  policy. Worker participants use an authenticated, chain-free create route
  that forces open session-visible groups while admin mutation controls remain
  signed. Independently, explicitly public, unencrypted, ungated Worker modes
  expose only redacted, session-visible group metadata before sign-in; private
  modes and all joining, creation, memberships, member identities, and member
  counts remain authenticated. Public group routes stay anonymous even when the
  browser remembers an account, deferring Worker authentication until a visitor
  chooses Create or Join; session-scoped group routes also expose their
  canonical session identifier in the query string and a prominent link back
  to the active session. Registry sessions enforce the creation choice across
  their session and SBT page controls while disclosing that public factories
  remain independently callable on-chain. Legacy Worker configs remain
  admin-only.
- Git-backed Netlify builds now bind the native Cloudflare Deploy Button to
  Netlify's exact public `COMMIT_REF`; builds without a public commit remain
  fail-closed with the native deployment card disabled.
- Public-release scrubbing now preserves the byte-stable generated Cloudflare
  Worker package while continuing to scan its bundled dependency contacts,
  preventing email-shaped wordlist data from being rewritten after hashing.
  Hosted public-text verification now builds a temporary canonical release
  artifact and scans its actual bytes, while direct source-tree verification
  remains strict.
- SBT claim and invite codes now default to explicit export without silent
  browser persistence; existing scoped recovery entries remain readable for
  compatibility.
- Added explicit opt-in encrypted SBT recovery using AES-GCM, authenticated
  chain/address metadata, and a non-extractable IndexedDB key. Unsupported,
  missing-key, and tampered records fail closed to export-only behavior, and
  group-scoped local recovery can be cleared from the admin UI.
- Made Worker authorization current at request time. Login tokens now bind a
  server-managed session authorization epoch, effective config changes
  invalidate prior tokens, and protected routes fail closed unless both the
  signed scope and the current default/route-specific policy allow access.
  Nonce redemption and route limits now use the mandatory Session Durable
  Object, closing cross-isolate replay and concurrent-limit overshoot without
  persisting principal identifiers in coordinator records.
- Encrypted every canonical Session Worker secret record at rest with
  session-bound AES-256-GCM before deploy-helper or signed-admin KV writes.
  Current/previous KEK recovery is bounded, legacy plaintext records are
  read-only compatible and migrate on signed update, all new deployments
  receive an independent KEK, and interrupted activation cannot silently bind
  ciphertext to a lost replacement key.
- Closed the legacy first-signer Worker bootstrap path. Initial session config
  now requires either the deployment-bound bootstrap admin or an existing
  registry session whose on-chain admin matches; missing registry wiring and
  unregistered slugs fail closed.
- Enforced client entry, non-vendor chunk, and temporary AppShell byte budgets
  from Vite's build manifest, with protected no-growth policy and generated-doc
  drift checks. Removed an unconsumed static-image compatibility copy that
  duplicated 21 emitted assets (16,618,799 bytes); future cross-tree image
  duplicates now fail the post-build gate.
- Made client test-universe claims complete and monotonic. One instrumented
  Jest run now accounts for every tracked production source while preserving a
  fixed legacy comparison metric; recursive Node discovery closes nested test
  omissions; and every tracked typed test/helper is classified under a
  real-framework-type diagnostic ratchet. Coverage exclusions, floors, legacy
  membership, and typed-test debt now fail closed against protected baselines.
- Bound Worker releases to the exact bytes produced by successful aggregate
  CI. SHA-keyed artifacts now carry source/replay/tree, builder-run, recipe,
  lockfile, and bundle-digest provenance; publication refuses failed or
  mismatched runs and never rebuilds. Immutable releases no longer move
  `latest` automatically, while a serialized, protected manual promotion keeps
  stable and previous rollback refs. GitHub Actions are pinned immutably.
  Session Setup and Admin Wrapped deploys now bind the corresponding manifest
  digest before request coordination and reject changed bytes before any
  Cloudflare mutation, including retry and repair paths.
- Unified local and hosted CI behind `scripts/ci-gates.json`. The local
  aggregate now runs the full client coverage and tracked root Node universes once,
  hosted jobs execute the same named gates, aggregate results fail closed
  against the hosted profile, and `verify:release` remains a separate
  non-coverage release rehearsal. Public-package scrubbing keeps retained gate
  commands aligned with retained scripts.
- Hardened new-session profile continuity and enforcement: explicit saved
  profiles now survive `/new` reloads behind a clear continue action, invalid
  profiles fail before publish side effects and are rechecked against the live
  draft after asynchronous preflight, stage-local errors identify the
  setting to fix, storage backend changes preserve an explicit Cloudflare role
  gate without carrying Cloudflare fields into Arweave, and unsupported
  result/export promises remain visible but unavailable. The compact selectors
  now support arrow keys and editable multi-digit group thresholds.
- Made Telegram Mini App an independently enforced session surface that still
  requires Telegram, while keeping Agent Session Wrapped independent. The
  Bridge now consumes canonical nested result-exposure settings before legacy
  aliases and excludes Mini-App-disabled sessions from every Mini App picker
  and route; onboarding cannot mint a credential for a disabled Mini App,
  activity and settings requests fail closed when no enabled session remains,
  and launch-bound settings cannot target a different session.
- Made direct Agent HTTP authorization independent of Telegram for user invite,
  service bootstrap, and ordinary authenticated API requests. Explicit session
  profiles now enforce `surfaces.agentHttp`; pre-profile Bridge records retain
  their historical direct API behavior unless they explicitly disable it.
- Integrated hosting customization into the existing session setup stages:
  storage, encryption, decryption access, and result visibility now live in
  Privacy; optional participation channels live in Worker; and export policy
  lives in Deploy. The compact header no longer opens a large technical
  popover, profile-based drafts no longer show a duplicate legacy storage
  editor, and custom decryption rules stay hidden until the creator overrides
  the explicit Cloudflare defaults.
- Moved session hosting selection into a compact header control, kept the
  selected Cloudflare, decentralized, or custom profile visible in the title,
  and previewed Corporate hosting as unavailable without changing publishing
  semantics. Cloudflare token guidance now explains that the linked form
  prefills permissions for users already signed in.
- Restored the two primary `/new` setup choices as large, requirement-aware
  entry cards. Selecting Centralized or Decentralized now transitions to
  the existing compact header selector; the native fast path identifies its
  creator inputs as a Cloudflare login and one AI API key.
- Made `contextengine.sh` the canonical public URL across site metadata,
  discovery assets, documentation, and Agent Bridge links. Worker and Bridge
  bootstrap allowlists now prefer `.sh` while retaining `.xyz` as redirect
  compatibility.
- Replaced the placeholder emoji favicon family with an optically centered
  white Context Engine circuit C on transparent browser, Apple touch, and
  Android icon backgrounds, using the high-resolution circuit artwork for the
  larger touch and installed-app assets.
- Added a repository-owned Netlify build contract for strict, Node 20 client
  builds from public `main`, with pull-request preview guidance and the existing
  manual-deploy redirect fallback retained.
- Refreshed the AI discourse corpus with verified 2026 policy, safety,
  evaluation, and practitioner sources; consolidated duplicate records,
  repaired primary-source provenance and tweet metadata, synchronized the
  client sample, and added normalized-URL and duplicate-title quality gates.
- Toolchain correction (2026-07-19): Vite is the canonical client dev/build
  path, and normal client installs again use npm's strict peer resolution.
  Earlier entries describing Create React App as canonical or durable
  `legacy-peer-deps` installation reflect superseded intermediate states.
- Unified Agent Bridge authentication around session-bound user, browser, and
  named service credentials. Telegram is now an optional identity adapter;
  one-time invites can onboard an opaque non-Telegram user, the root token is
  limited to bootstrap/break-glass semantics, and browser exchange returns
  separate Bridge and session-worker credentials.
- Added the hybrid Agent Session Wrapped path for worker-canonical and
  registry-canonical sessions through one deployment-pinned session-Worker
  membership verifier. Dedicated Bridges now require explicit one-session
  policy, use the sole `surfaces.agentHttp` capability bit, deploy without the
  unused Durable Object or Telegram resources by default, exchange Worker
  credentials for at-most-24-hour session-bound `ceagt_` member credentials,
  and accept Wrapped answers over HTTPS/KV without an agent-originated EVM
  transaction. Session Setup and Admin support request-only enable, retained-
  resource disable-access, health, and idempotent redeploy controls with
  capability publication only after durable verification. Ordinary Wrapped
  uses canonical session questions, explicit historical/agent-only configs
  retain proposal windows and storage prefixes, and posters default to the
  deterministic local renderer with separately configured optional OpenAI
  generation.
- Added direct session-worker access-group views and open self-join controls to
  agent-enabled sessions, plus signed group and member administration in the
  existing Admin surface. The Agent Bridge does not proxy or mirror this state.
- Removed the unused mock OpenClaw forwarding module and catalog entry while
  retaining transport-neutral direct HTTP and optional host-agent adapters.
- Completed the frontend modernization baseline with typed domain boundaries,
  downward-only type-debt and size ratchets, decomposed session, survey, and
  application shells, split CI/release verification, synchronized worker-bundle
  checks, and public-release surface validation.
- Added stable automation hooks for gate-lock state and gate selection without
  changing user-facing behavior.
- Hardened public documentation packaging so operator runbooks and internal
  planning material are stripped, while retained Markdown is checked for
  private references, unavailable commands, and broken local links.
- Hardened public release artifacts so private file inventories are not
  published, retained text is scanned for private references, and unowned image
  files fail verification; removed unused image assets without changing the
  active animated logos.
- Reduced the two active logo GIFs by about two thirds while preserving their
  dimensions, duration, looping behavior, luminosity-blended presentation, and
  current Navbar and SBT loading owners.
- Enlarged the sparse three-card Tools view so its image cards use the available
  full-screen width and viewport height while retaining compact mobile sizing.
- Replaced the default Tools image-card status frame with UserPage-style 3D
  depth, keeping live/future borders visible only while demo mode is enabled.
- Moved desktop main-screen Welcome controls into a compact bottom strip and
  kept titles, artwork, and copy within one viewport-capped frame, including
  ultra-wide/short displays, without changing session welcome slides.
- Added theme-owned Welcome artwork detail controls so Classic 95 can present
  legacy slide images with visible detail and readable native final actions
  while Context Engine preserves its original treatment.
- Added the agent bridge worker and its test runner to the public release
  surface, with public-safe setup examples and artifact-level PII verification.

### Fixed

- Corrected passkey account creation so Chromium-compatible registration offers
  ES256 and RS256, uses PRF output from registration without an unconditional
  sign-in-style second prompt, and labels the pending action as creation.
  Worker-canonical sessions now retain their verified dedicated Worker during
  response submission, skip chain-only block scans and automatic faucet calls,
  finish durable Cloudflare response writes without an EVM transaction, and
  hydrate those responses after reload under a stable chainless cache scope.
  Response list metadata is bound to the authenticated Worker uploader instead
  of trusting a self-claimed responder address in the stored JSON.
- Replaced the About-page Google Drive video embed and thumbnail dependency
  with the repository-owned `about-demo.mp4` on desktop and mobile, so public
  playback no longer depends on third-party cookies or Drive playback limits.
- Kept registry-backed session scans bounded when Arweave metadata is temporarily
  unavailable by deriving the creation block from the registry tuple timestamp
  before attempting legacy event-log recovery.
- Kept history-preserving public releases self-testing when the Agent Bridge
  cutover follows a source-only baseline by restoring its narrow root test
  command alongside the audited worker and runner snapshot, while using the
  artifact scrubber to remove commands whose private runners are stripped.
- Made Agent Bridge credential rotation publish replacements before retiring
  prior records, rejected query-string bearer credentials and nested browser
  exchanges, pinned credentials to their issued session, and made managed
  account issuance fail closed without signer configuration.
- Enforced `session_member_aggregate` result visibility against live canonical
  worker membership and the configured minimum group size for JSON and image
  results, failing closed when membership cannot be checked. Telegram-optional
  user and service exchanges now derive their worker wallet from the stored
  credential principal.
- Granted the explicit worker-group scope after a registry-backed participant
  passes the session's default gate, restoring direct group reads and joins
  without weakening group membership checks.
- Prevented worker-native group state from silently switching to an unrelated
  D1 or envelope-audit binding: session-worker groups now use only the explicit
  group KV or storage-index KV aliases, and D1-only group configuration fails
  as unconfigured.
- Kept worker-envelope key-release audits on the explicit audit KV or storage
  index KV, ignored unrelated D1 aliases, and preserved fail-closed
  audit-before-decrypt behavior when persistence is unavailable.
- Required the explicit `groups` JWT scope for worker group listing,
  self-membership reads, and joins instead of accepting the legacy `arweave`
  storage compatibility scope.
- Stopped generated session-worker Cloudflare profiles from advertising an
  unused D1 primitive; payload indexes, envelope audits, and group records now
  describe the KV authority that the deployed worker actually binds.
- Made KV index rows authoritative for per-item Cloudflare R2 authorization
  metadata: uploads now require a readable/writable index binding, and reads
  fail closed without a valid matching row instead of falling back to weaker
  object metadata.
- Bounded Cloudflare storage listings to opaque-cursor pages and preserved
  manual continuation in the Document Library when authorization filtering
  produces an empty page with a later cursor.
- Made targeted survey-response refreshes merge into the latest cache snapshot,
  resolve concurrent same-responder updates without regressing newer or
  unorderable values, keep scan watermarks monotonic, and publish their UI
  revision only after durable cache persistence succeeds; detached initial
  refresh failures are now caught and logged at the results lifecycle boundary.
- Made the remaining survey and question discovery, response hydration, and
  application event cache commits merge only their active deltas into the
  latest managed-cache snapshot. Concurrent metadata, responder recency,
  retry state, and monotonic watermarks are preserved, while readiness,
  revisions, and awaited success are withheld when persistence fails.
- Serialized first-use worker-envelope keys and signed session-config writes
  through one per-session coordinator, rejected unreadable R2-only envelope
  writes, and removed unsafe unused key-changing Admin actions. Cloudflare
  uploads retain documented at-least-once retry behavior.
- Hardened the `Surveys` source contract and client preflight so zero survey or
  question IDs, zero content or response hashes, and mismatched optional
  survey-response pairs fail before ambiguous state or wallet submission.
- Required configured deterministic SBT deployments to be submitted by the
  configured SBT admin in both the source contract and ethers-v5 client
  preflight, preventing public callers from front-running predicted addresses.
  These immutable-contract fixes require a separate testnet redeploy before
  they are live at configured addresses.
- Fixed passkey survey-response uploads by preserving object-valued EIP-1193
  providers through worker authentication, kept SBT metadata and image reads on
  AR.IO while direct mode is enabled, and serialized shared RPC reads per
  endpoint so one 429 stops queued requests before they create a console burst.
- Fixed active-session SBT loading and sponsorship reporting by avoiding full
  registry enumeration, refreshing selected worker fields before survey
  uploads, moving the rate-limited Tenderly OP Sepolia gateway to the last
  fallback, and reading boolean-only resource presence from the session worker.
- Prevented repeated RPC retries against browser-forbidden (`403`) endpoints,
  and constrained returning passkey-wallet unlocks to the stored credential so
  SBT mint/sign prompts do not reopen the passkey account chooser.
- Removed failing anonymous OP Sepolia fallback fanout from cold session loads,
  deferred worker resource-presence checks until account settings are opened,
  and resolved Vite's browser `buffer` shim explicitly.

## [0.7.0] - 2026-07-06

### Added

- Published the M1 source release with a curated public tree and public-safe
  history on `main`.
- Added the mode-first session creation entry flow for Cloudflare-backed and
  decentralized sessions, with the existing setup UI revealed after Continue.
- Added public release PII scanning and stricter public push protection for
  release branches.
- Added a default-off MetaMask build profile. Passkey-only builds remove the
  MetaMask login control and fail if MetaMask/RainbowKit connector modules or
  assets enter the emitted client bundle.

### Fixed

- Fixed public CI regressions in passkey PRF normalization, public contact
  email handling, stripped corpus helper scripts, and private E2E script naming.
- Kept public package scripts and release-surface checks aligned with stripped
  private runner paths.

### Operator TODOs

- Tag `v0.7.0` after the public `main` state and latest worker-bundle release
  asset smoke check are confirmed.

## 2026-07-03

### Completed TODOs

- Added the public `/posts` route backed by root-level Markdown files, a default-on `REACT_APP_CE_ABOUT_POSTS_ENABLED` toggle, an About-page Posts link, static Vite serving/copying for `posts/`, per-post attachment directories, manifest header images, Markdown image blocks, and initial `ce-viz` post exhibits for category dot grids, ranked theme panels, theme networks, and quote walls.

## 2026-06-09

### Completed TODOs

- Added a public-release surface verifier that blocks JavaScript/TypeScript imports into stripped paths before release branches are imported or pushed, changed the Worker Chipotle tests to read the public client action catalog instead of a private mirror, and made release replay run public `test:node` before push so stripped public-copy regressions fail locally.

## 2026-06-06

### Completed TODOs

- Added a signed worker `secret-presence` admin action that returns allowed-key booleans without exposing secret values, and updated `/admin` Worker secrets cards so blank write-only inputs show unknown/configured/empty status from the worker presence manifest instead of local draft emptiness.

## 2026-05-25

### Completed TODOs

- Added the first Session Results HTML report export slice: redacted snapshot/HTML helpers, safe embedded JSON, a SurveyResults confirmation/download flow, and focused regression coverage.
- Extended Session Results exports with logged-in downloader metadata, visible artifact watermarking, explicit unavailable reasons, section checkboxes, exported viewer/static HTML/single-page PDF options, and local AI-generated analysis artifacts that use synthetic participant IDs before provider calls.
- Simplified the Session Results export modal copy, fixed light-mode checkbox/radio layout, and added demo preview mode for local demo analysis sections without wallet auth.

## 2026-05-17

### Completed TODOs

- Added a Vite sidecar for the React client with separate `dev:vite`, `build:vite`, and `preview:vite` scripts, `build-vite/` output, CRA-compatible env/static-asset shims, and focused ethers ESM import compatibility while keeping CRA/react-app-rewired as the canonical client path.

## 2026-05-13

### Completed TODOs

- Kept uploaded sponsored Custom RPC URLs out of public registry fields while preserving the `sponsored_rpc` flag, and made sponsored RPC access fall back to the session's default on-chain gate when no resource-specific RPC gate is set.

## 2026-05-09

### Completed TODOs

- Hardened worker-mediated Lit Chipotle encryption by forwarding worker env credentials into authenticated execution, allowing non-holder authors to encrypt for a target SBT audience, enforcing SBT ownership only for check/decrypt, deriving decrypt/check RPC URLs from worker-approved config/defaults, verifying action-side chain IDs, binding v2 wrapped CEKs to canonical policy fingerprints, rejecting legacy Chipotle wrapped-key formats, and documenting the required Lit Action CID re-provisioning step.

## 2026-05-08

### Completed TODOs

- Added the session storage routing layer with normalized `storageRef` compatibility, worker `/storage/upload`, `/storage/read`, and `/storage/list` contract tests, Cloudflare-safe opaque refs backed by mocked R2/KV contracts, Lit-Arweave document enforcement, and Document Library routing for Arweave, Lit-Arweave, and plaintext Cloudflare docs/context while preserving legacy `/arweave/upload` and `arweaveTxId` behavior.
- Threaded `storageRef` compatibility into client question/survey/response reads and CE-CC agent question/response summaries where legacy Arweave tx ids are still the contract source of truth.
- Added explicit dual-field helpers, made question/survey/response client and CE-CC records prefer `storageRef` before legacy `arweaveTxId`, extended worker storage tests for `questions`, `surveys`, and `responses`, and documented the future canonical `storageRef` naming migration.
- Routed Cloudflare-configured session question, survey, and response writes through sessionCorsWorker `/storage/upload`, using opaque bytes32-compatible Cloudflare IDs in existing Surveys pointer fields without changing the contract ABI; readers now try Cloudflare `storageRef` resolution before Arweave fallback.
- Clarified Cloudflare setup permissions for R2 payload blobs, D1/KV metadata indexes, and Durable Objects only for signer/runtime coordination.
- Added the then-current `/new` Cloudflare payload aliases:
  `worker_sbt_gate` was the default in this release and `lit_encrypted` required
  pre-encrypted payloads. Both names are now legacy read compatibility; current
  profiles use explicit `gate` and `encryption` fields, and pure Worker profiles
  do not default to an SBT gate.
- Fixed encrypted Document Library image thumbnails so scoped Lit hooks arriving after initial render trigger preview loading.

### Remaining TODOs

- Finish the Cloudflare `encryption: "lit"` envelope producer/reader (legacy
  alias `lit_encrypted`) so documents, private questions/responses, surveys, and
  generated artifacts can be encrypted before `/storage/upload` without routing
  through Lit-Arweave.
- Once all public and agent readers are storageRef-aware, rename the top-level payload pointer contract to `storageRef` in API docs and schemas, leaving `arweaveTxId` as a deprecated Arweave compatibility alias.

## 2026-05-04

### Completed TODOs

- Made direct encrypted-question routes fail soft while fresh Arweave metadata propagates by rendering a masked `[encrypted]` question placeholder and continuing background retries, and restored AR.IO-only Arweave read routing as the default while leaving legacy gateway fanout behind an explicit opt-out.
- Routed Survey contract hash/metadata/response/event reads through the session-aware read provider so open or verified sponsored `rpcUrl` / `rpcUrlsByChainId` entries are actually used for that session before the normal anonymous fallback stack.
- Deprioritized the OP Labs public OP Sepolia RPC in browser fallback ordering and added endpoint-level exponential backoff after RPC 429s so throttled providers are not hammered by repeated reads.
- Added an explicit `Decrypt Prompt` action to gated single-question notices so masked prompts are not only clickable through the `[encrypted]` badge.
- Kept single-question route load passive by preventing legacy Porto session restore from showing a passkey prompt until a signer is actually needed, and fixed the Wagmi RPC backoff wrapper TypeScript build error.
- Made automatic gated prompt/response decrypt respect Porto session-key auto-sign readiness: passive restores no longer trigger repeated passkey prompts during single-question bootstrap, while an unlocked Porto session can auto-decrypt SBT-gated prompts; non-creator metadata decrypts now prefer Lit SBT recipients before self-sign unwraps.
- Preserved per-question source session slugs on profile question cards so created/answered question links use their real session, such as `demo-4`, instead of falling back to the current profile page session.

## 2026-05-01

### Completed TODOs

- Hardened SBT mint-policy enforcement by storing an explicit on-chain `mintMode`, making `claim()`, password minting, reusable group signatures, and invite signatures fail closed outside their declared modes, rejecting contradictory factory deploy args, threading the resolved mode through CreateSBTGroup and deferred session-wizard publish state, and adding regression coverage for the old public-claim group-password vulnerability. Existing vulnerable unlimited `groupPassword` SBTs are not compatibility targets and should be rotated to newly deployed replacements.

## 2026-04-19

### Completed TODOs

- Made the local historical-avatar asset set canonical for demo personas, removed tracked placeholder avatar sentinel strings from the historical figure manifests and demo fixtures, rewrote avatar-source tests to ban placeholder-style sentinels and unapproved hotlinks, cleaned up planning-backed inline TODO comments in `SessionWizard` / `SingleQuestionResponse`, and removed the remaining `sponsoredSbtAddress` compatibility reads so `sponsored.gates` is the only canonical sponsored-SBT shape.

## 2026-04-17

### Completed TODOs

- Pinned `client` devDependency `typescript` to exactly `5.8.3` to match `@lit-protocol/contracts@0.9.1`'s strict peer, and adopted `--legacy-peer-deps` as the durable client install contract via `client/.npmrc` so `npm install` / `npm ci` no longer require the flag at the CLI. Strict restoration of plain `npm install` at the dep-graph level is deferred to the Phase 2 toolchain decision to move off `react-scripts@4` / CRA.

## 2026-04-16

### Completed TODOs

- Taught the shared client read-provider resolver to normalize browser-visible session RPC fields (`rpcUrlsByChainId`, `rpcEndpoint`, `rpcUrl`) alongside legacy `rpc.providers.path.*` overrides, so participant-facing session reads can use session-sponsored RPC directly when the on-chain `rpc` gate is open or the current wallet already has a cached grant, while restricted/unverified cases still fail closed onto the normal fallback stack; added focused regression coverage for worker-only, open, granted, and denied session-RPC selection paths.

## 2026-04-15

### Completed TODOs

- Strengthened crawler-visible discovery by adding a raw-HTML `noscript` summary to `client/public/index.html`, linking the canonical GitHub repo plus the live `main` branch source tree, adding a static `discoverability.html` summary page and `llms.txt`, limiting the sitemap to raw-HTML crawlable pages, and adding tests/docs so the public discovery links stay in sync.

## 2026-04-14

### Completed TODOs

- Stopped tracking generated worker bundle artifacts in `dist/`, updated CI and release verification to rebuild bundles before verifying them, removed the client-served `/worker/sessionCorsWorker.bundle.js` fallback path so normal and sponsored deploy flows now use the hosted GitHub release asset by default while still allowing one-off manual bundle URL or upload overrides after a fetch failure, explicitly marked automated worker-bundle GitHub releases as latest so the client's `releases/latest/download/...` URL stays current, refreshed Session Wizard fallback copy to explain the retry options, and updated docs/tests to treat `dist/*.bundle.js` as generated local fallback output rather than committed repo state.
- Added JSON-LD structured data for the public site so search engines can associate `contextengine.xyz` with the public GitHub repository via `sameAs`, while keeping the structured data synced with SPA route changes.
- Updated the public metadata description to align more closely with the README framing around AI-enhanced deliberation, large-group sensemaking, permanent records, and cryptographic access control.

## 2026-04-13

### Completed TODOs

- Strengthened root-site discovery metadata by updating the SPA shell title/description/canonical/social tags, added static `robots.txt` and `sitemap.xml` crawl assets, pointed root and client `homepage` metadata at `https://contextengine.xyz/`, refreshed the README opening section with stronger public framing and key links, and verified the client build copies the crawl assets into `client/build/`.

## 2026-04-06

### Completed TODOs

- Removed unused client dependencies `react-copy-to-clipboard`, `react-iframe`, `react-moment`, `fetchival`, `html-react-parser`, `papaparse`, `react-tooltip`, and `request`; regenerated `client/package-lock.json`; verified the production client build on Node 20.
- Removed unused client dependencies `axios`, `react-markdown`, `react-chartjs-2`, `chart.js`, `lucide-react`, and `moment`; removed dev dependencies `imagemin-cli` and `redux-devtools-extension`; replaced `classnames`, `react-hot-toast`, `react-datepicker`, and `idb-keyval` with repo-owned client code; regenerated `client/package-lock.json`; verified targeted tests locally and the production client build on Node 16; plain Node 20 `npm run build` still hits the repo's existing Webpack/OpenSSL incompatibility.

### Remaining TODOs

- Outstanding: complete the higher-risk peer-dependency cleanup still needed for clean no-flags `cd client && npm install`, especially `react-rangeslider`, `react-select`, and `reactstrap`.
