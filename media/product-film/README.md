# Context Engine product film

A 14.1-second, silent, looping product film for Context Engine, built as a
deterministic HTML/SVG animation and rendered to MP4 for link previews.

> Discourse and Decision Tools For Humans and Agents

The film is designed for link-preview size, where small text is unreadable.
Words appear only on the brand card (Context Engine and the title), which is
both frame 0 and the end of the loop, and in two section headings: "Question"
on every input type and "Results" over the results. The URL is left out
because the link preview around the film already shows the domain. Every other
beat is told with product shapes, icons, color and motion: what people write
is drawn as rounded lines, and each of the 48 illustrative participants is a
colored dot whose color is their answer.

The film is light and follows the site's Minimal theme: an off-white page,
white product cards, Minimal-theme text and border colors, and the vector
Context Engine logo that every theme uses
(`client/src/assets/img/context_engine_logo.svg`), drawn in ink. At
rest each participant is one of the 48 round pads at the ends of its circuit
traces.

| Scene | Time | What happens |
| --- | --- | --- |
| Open | 0–1.4 s | Brand card: the wordmark and title beside the Context Engine logo. Frame 0 is a finished poster. The logo's pads light up in answer colors: they are the participants. |
| Input | 1.4–5.9 s | The logo draws off, the participants step aside into two columns, and a large question card headed "Question" responds four ways: typing (lines and a caret), speaking (a waveform), structured choices (agree/unsure/disagree, then multiple choice), and quadratic allocation (− / + steppers whose cost grows as an n×n block of credit squares while a credits meter fills: +3 costs 9, −2 costs 4, +1 costs 1). Each submitted response lights its participant. |
| Results | 5.9–11.65 s | A "Results" heading replaces "Question" in the same place over the first results view. All 48 responses form a distribution of colored rows, reorganize into the Participants Graph (rings and axes drawn clearly) with three opinion groups and a per-group agree/unsure/disagree bar, then take their places on a political compass (four tinted quadrants, as in the product's PoliticalCompassView), and finally one group's representative responses feed a grounded AI summary. |
| Resolve | 11.65–14.1 s | The logo draws back on, everyone returns to a pad, and the colors settle into the logo, so the final frames are identical to frame 0 and the loop is seamless. |

The interfaces are simplified, faithful references to shipped surfaces:
`SurveyTool` question cards (`BinaryChoiceInput`, `MultichoiceQuestionInput`,
`QuadraticAllocationInput`, freeform with voice input) and the Polis-style
report (`PolisReport`: Participants Graph, opinion groups, Analyze clusters,
per-group stance bars).

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Viewer with play/pause, restart, scrubber, timecode and scene navigation. |
| `film.js` | The whole film: brand copy, palette and illustrative dataset (`COPY`, `TH`, `ANSWERS`, `GROUPS`), the vector logo and its pad geometry (`LOGO`), the timeline (`SCENES`, `K`), and `renderAtTime(seconds)`. |
| `film.css` | Light composition, product-card and viewer styles. No CSS animations or transitions. |
| `fonts/` | Self-hosted Poppins and JetBrains Mono Latin subsets from the Fontsource packages `@fontsource/poppins` 5.3.0 and `@fontsource/jetbrains-mono` 5.3.0 (SIL Open Font License 1.1; licenses included). |
| `render/render.mjs` | Frame-accurate renderer: Playwright screenshots piped into ffmpeg. |
| `render/inline.mjs` | Writes a single self-contained HTML file (fonts inlined) to `dist/`. |
| `dist/` | Local render output (git-ignored). |

Published outputs live in `client/public/media/product-film/v1/` and are
referenced from `client/src/variables/publicSocialPreview.json`.

## Preview

Serve the folder over HTTP (fonts do not load reliably from `file://`):

```bash
python3 -m http.server 8099 --bind 127.0.0.1 -d media/product-film
open http://localhost:8099/
```

URL options:

- `?t=8.7` opens paused at 8.7 s.
- `?paused=1` opens paused at 0 s.
- `?capture=1` shows only the 1920×1080 stage at 1:1, without controls.
- `?poster=1` shows the 1200×630 `og:image` composition.

Keyboard: Space play/pause, ←/→ one second, Shift+←/→ one frame, 1–4 scenes,
Home restart. Playback loops. With `prefers-reduced-motion: reduce` the viewer
opens paused on frame 0.

`window.renderAtTime(seconds)` and `window.film` (`duration`, `fps`, `scenes`,
`ready`, `capture`) are exposed for capture tools. `film.ready` resolves after
the fonts and the logo artwork have loaded and the stage is built.
`await film.capture(seconds)` renders a frame and then has the browser rebuild
the stage's rendering, because Chrome can reuse rasters from earlier frames for
some layers; captured frames are therefore identical however they are reached
(in order, after seeking, or alone).

## Render

Requirements: the repository's root dev dependencies (`npm install` at the
repo root provides Playwright 1.58.2), a Playwright Chromium
(`npx playwright install chromium`, or point `CHROMIUM_PATH` at Chrome), and
`ffmpeg` on `PATH`. No new npm dependencies are needed.

```bash
# from the repository root
node media/product-film/render/render.mjs all        # video + poster
node media/product-film/render/render.mjs video      # 1080p master, 720p preview, 16:9 still
node media/product-film/render/render.mjs poster     # 1200x630 og:image
STILL_WIDTH=600 node media/product-film/render/render.mjs stills 0 2.7 5.4 8.0 9.6
node media/product-film/render/inline.mjs            # self-contained HTML
```

Outputs in `media/product-film/dist/`:

| File | Spec |
| --- | --- |
| `context-engine-film-1080p.mp4` | 1920×1080, 30 fps constant, 423 frames (14.1 s), H.264 High, yuv420p, BT.709 tags, CRF 15, fast start, no audio track. |
| `context-engine-film-720p.mp4` | 1280×720 Lanczos downscale of the master, H.264 High, yuv420p, CRF 19 `-tune animation`, fast start. Used for `og:video`. |
| `context-engine-og-1200x630.png` / `.jpg` | Link-preview poster. The PNG is used for `og:image`. |
| `context-engine-film-still-1280x720.jpg` | Frame 0 for `<video poster>` or player pages. |
| `stills/` | Review stills. |

Rendering takes about 2 minutes. Each frame is produced by calling
`film.capture(i / 30)` and taking a screenshot, so the output is independent of
machine speed and of the order frames are rendered in.

Check a render:

```bash
ffprobe -v error -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_frames:format=duration,size -of default=nw=1 media/product-film/dist/context-engine-film-720p.mp4
```

## Publishing a new version

The two published media files have exact-path `Cache-Control: public,
max-age=31536000, immutable` and `X-Content-Type-Options: nosniff` rules in
`client/public/_headers`. Never overwrite a published file. Wildcards are
excluded so missing media cannot receive an immutable cache lifetime.

1. Edit `film.js` / `film.css`, preview, then render.
2. Copy the 720p MP4 and the poster PNG into a new version directory (for
   example `v2/`) beside `client/public/media/product-film/v1/`.
3. Update the URLs (and dimensions, if they changed) in
   `client/src/variables/publicSocialPreview.json` and the matching tags in
   `client/index.html`. Add exact-path rules for the new files in
   `client/public/_headers` and update the cache-rule tests; retain rules for
   earlier versions that remain available.
4. Run `cd client && npm test -- --watchAll=false --runTestsByPath src/socialPreviewMetadata.test.js src/utilities/ui/publicPageHead.test.ts`.
   The metadata test reads the PNG and MP4 headers and fails if the declared
   dimensions, fast start, file size or URLs drift.

## Link previews

The homepage, `/about` and the other app routes advertise:

- `og:type` `video.other` (pages with the film; posts stay `article`, and a
  page without a video falls back to `website`);
- `og:image` 1200×630 poster with type, dimensions and alt text;
- `og:video`, `og:video:secure_url`, `og:video:type` (`video/mp4`),
  `og:video:width` (1280) and `og:video:height` (720);
- `twitter:card` `summary_large_image` with the same poster and alt text.

These tags are in the initial HTML (`client/index.html`, plus build-time
`about.html` and `about/index.html` with their own canonical URL), and
`syncPublicPageHead()` keeps the runtime head identical. Posts keep their own
header image and drop the film and poster dimensions.

`og:video` lets a platform offer playback; it does not guarantee an animated
preview or autoplay. Each platform decides, and many show only the poster, so
the poster is designed to stand on its own. Where the film can play from these
tags, the expected behavior is:

- Apple Messages (iOS, macOS) can play the MP4 inline within its preview media
  size limits. The 720p film is about 1.5 MB.
- Discord can offer inline playback for the `video.other` page type.
- X uses the `summary_large_image` poster. Player cards require a separate
  player integration and approval; this change does not enable them.
- Slack, LinkedIn, WhatsApp and most other clients show the poster.

Validate these expectations on the deployed site using each platform's tools.
Platform behavior and cached previews can change independently of these tags.

## After deploying

```bash
curl -sI https://contextengine.sh/media/product-film/v1/context-engine-film-720p.mp4   # 200, video/mp4, cache headers
curl -s -r 0-1023 -o /dev/null -w '%{http_code}\n' https://contextengine.sh/media/product-film/v1/context-engine-film-720p.mp4   # 206
curl -s -A 'facebookexternalhit/1.1' https://contextengine.sh/ | grep -E 'og:(video|image)'
curl -s -A 'Twitterbot/1.0' https://contextengine.sh/about | grep -E 'og:url|twitter:card'
```

Check the live response headers, then use each platform's own preview tool,
for example the Facebook Sharing Debugger and LinkedIn Post Inspector, to
refresh its cache. Local builds confirm metadata and media files; they cannot
confirm a platform's deployed preview behavior.
