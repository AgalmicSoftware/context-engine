# Interview Research Diagrams

These diagrams explain the optional interview research metadata attached to a submitted response when a participant chooses to share AI draft changes for research. They describe the submitted record, not every step an AI provider may process while creating drafts.

## Overview

[![Diagram titled What does Interview mode collect? It shows interview or import input, AI drafts, participant review, and submit. The submit step branches to final responses when research sharing is unchecked and to final responses plus an interviewProvenance research record when checked. The diagram notes that sharing starts off, AI source details are separate, encrypted answer and comment text is redacted, transcripts and imported conversation history are not attached, no keystrokes or timing are recorded, and the record follows normal response visibility.](session-interview-overview.png)](session-interview-overview.png)

## Research Record

[![Diagram titled Inside the optional research record. It shows the record attached at responses[].interviewProvenance, with separate stages for AI proposed, you reviewed, and you submitted. A worked example shows Unsure to Agree back to Unsure, where changedFields is empty but userEditedFields contains answer. Protection notes say encrypted answer and comment text is redacted, evidence is removed, field names and numeric ratings can remain, no full transcript or imported chat history is attached, and no keystrokes, edit timing, or agreement score are recorded. Visibility notes say wallet and question IDs accompany responses, normal session storage and visibility apply, records are not automatically anonymous, AI source details are separate, and there is no automatic Edge2026 export.](interview-research-record.png)](interview-research-record.png)

For the field-level schema and consent behavior, see [session interview research metadata](../../session-interview-research.md). Generation prompts and provenance are recorded in [diagram provenance](diagrams.md).
