# Session Listening Mode

Session listening mode is the Record branch of the session microphone surface.
Open it with:

```text
/session/<slug>?mode=listening
```

The query parameter opens a record-first listening control without changing the
pile card's vertical placement. Desktop uses a floating recorder, and
mobile/narrow screens place the recorder below the pile and auto-scroll to it.
Recording does not start automatically; the user must click Record so browser
microphone permission is requested from a user gesture.

Microphone capture requests browser speech processing (echo cancellation,
noise suppression, automatic gain control, and mono audio). The selected
browser/system input is preserved unless it is clearly an iPhone, iPad, or
Continuity microphone and an identifiable built-in computer microphone is
available. In that case the client switches to the local microphone; if the
replacement cannot be opened, it keeps the already-authorized input.

While recording, the panel switches from the large Record button into the
HealthBot-style recorder strip: inset waveform, elapsed-time timer, Stop, and
Pause/Resume controls. Pausing keeps the current recorder session open, stops
the visible elapsed timer and chunk rotation, and resumes both when recording is
continued. Closing the panel while recording or while a transcription chunk is
pending finalizes the current recorder segment before unmounting when the
browser can still flush the audio.

## Recording Model

- The client keeps one user-visible microphone session active.
- A fresh browser `MediaRecorder` segment starts every 3 minutes before the
  previous segment is stopped and flushed.
- Pause/Resume uses the same active `MediaRecorder` session and does not flush a
  user-visible clip while paused.
- Recording continues while each completed chunk is sent to the session
  worker `/transcribe` path.
- Transcription uploads are anonymous-only at the transport layer. A worker
  denial is surfaced in the recorder instead of escalating into an unexpected
  wallet or passkey signing prompt.
- Returned transcripts are stitched in segment order with overlap deduplication.
- The browser stores only the cumulative transcript and segment status metadata
  in local storage by default.
- Segment counts are internal. The UI does not expose clip done/pending/failed
  counters; it only surfaces actionable recording, transcript, generation, or
  error states.
- Raw audio chunks are discarded after successful transcription unless a future
  recovery/download mode explicitly retains them.

## Outputs

The first implementation generates suggested new questions from the stitched
transcript. Suggestions are drafts rendered through the existing
`CreateQuestionsAndSurveys` review surface in Questions mode by default; they
are not auto-published. The generated survey title is preserved so the user can
switch the draft to Survey mode if needed.

The visible transcript is collapsed by default. Opening the transcript section
starts from a compact `Transcript` character-count button, then shows the
read-only stitched transcript and an overlaid clear control. The transcript
button remains available after generated question drafts are shown.

Question generation sends the stitched transcript directly to the
question-generation prompt with transcript-specific instructions that ask the
model to compare early, middle, and late transcript topics and prioritize the
most contentious or debate-worthy material. The Generate questions control stays
hidden until transcript text exists and shows elapsed seconds while generation
is running.

The transcript summary/upload source path is disabled for this mode for now.
Standalone questions do not currently have a document URL field; source
references remain a planned follow-up for standalone question records.

Answer suggestions remain reserved for the later Interview branch of the
microphone feature.

## Files

- `client/src/components/SurveyTool/SessionListeningPanel.tsx`
- `client/src/utilities/audio/useRollingTranscriptionRecorder.ts`
- `client/src/utilities/audio/rollingTranscription.ts`
- `client/src/components/SurveyTool/sessionListeningQuestions.ts`
