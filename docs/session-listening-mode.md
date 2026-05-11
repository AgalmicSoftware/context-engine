# Session Listening Mode

Session listening mode is the Record branch of the session microphone surface.
Open it with:

```text
/session/<slug>?mode=listening
```

The query parameter opens the listening panel beside the pile view. Recording
does not start automatically; the user must click Record so browser microphone
permission is requested from a user gesture.

## Recording Model

- The client keeps one user-visible microphone session active.
- A fresh browser `MediaRecorder` segment starts every 3 minutes before the
  previous segment is stopped and flushed.
- Recording continues while each completed chunk is sent to the session
  worker `/transcribe` path.
- Returned transcripts are stitched in segment order with overlap deduplication.
- The browser stores only the cumulative transcript and segment status metadata
  in local storage by default.
- Raw audio chunks are discarded after successful transcription unless a future
  recovery/download mode explicitly retains them.

## Outputs

The first implementation generates suggested new questions from the stitched
transcript. Suggestions are drafts rendered through the existing
`CreateQuestionsAndSurveys` review surface; they are not auto-published.

Answer suggestions remain reserved for the later Interview branch of the
microphone feature.

## Files

- `client/src/components/SurveyTool/SessionListeningPanel.tsx`
- `client/src/utilities/audio/useRollingTranscriptionRecorder.ts`
- `client/src/utilities/audio/rollingTranscription.ts`
- `client/src/components/SurveyTool/sessionListeningQuestions.ts`
