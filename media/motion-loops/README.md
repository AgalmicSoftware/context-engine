# Context Engine motion loops

Silent, seamlessly looping demos built as deterministic SVG animations and rendered
to GIF and MP4: one for the repository README, and one prospective film for each use
case on the `/about` page.

They share the look and pacing of the [product film](../product-film/README.md): the
same light palette, card, section badges, ring steppers and participant dots. Unlike
the film, which is designed for link-preview size and tells its story in shapes, these
loops use real words, because their viewers have the time and the pixels to read them.

All data in the films is illustrative, and the use-case films are prospective: they
show how Context Engine could serve each setting, not a real deployment. Two of them
show roadmap work rather than shipped features: scoring forecasts while they stay
sealed (Companies) and representative models (Groups).

## Films

| Film | Length | Story |
| --- | --- | --- |
| `readme` | 15.4 s | Five question types, then Groups, then Results. |
| `ai-discourse` | 12 s | A yes-or-no question about a data center in your community opens into what it would change, and the answers become a public map tracked across years. |
| `corporate` | 11.4 s | A forecast with its confidence and assumption is sealed with a timestamp. Once the outcome is known, the good predictors on the topic are identified without revealing them. |
| `cities` | 12 s | Residents weigh priorities with quadratic credits, and the record is filtered by constituency. |
| `conferences` | 12 s | The room answers, participants gather into an opinion map, and the map grows from one gathering to the next. |
| `digital-groups` | 12 s | Members' preferences train a group model that stays attributable, licensable and revocable. |

The use-case film names match the `slug` of each entry in `USE_CASES`
(`client/src/components/About/AboutPageContent.tsx`), and the heading over each film's
main scene is that entry's `solutionTitle`.

### README loop scenes

| Scene | Time | What happens |
| --- | --- | --- |
| Agreement | 0–2.0 s | Frame 0 is a finished poster, with nothing selected. Agree is then pressed and selected. |
| Freeform | 2.0–3.85 s | The microphone records while a short answer arrives in the field. |
| Rating | 3.85–5.25 s | The slider moves to 7 and its value follows the knob. |
| Multiple choice | 5.25–6.75 s | Speed, Cost and Quality are checked in turn. |
| Quadratic | 6.75–8.75 s | Six presses of + build 3, 2 and 1. Each option's cost is the square of its allocation, drawn as an n×n grid, and the footer reaches 14 / 99 credits. |
| Groups | 8.75–11.6 s | The lock closes, the filter narrows and the membership badge fills, then all three hold. |
| Results | 11.6–14.7 s | The Opinion Map settles, Breakdown's bars grow and the Analysis matrix resolves, then all three hold. |
| Resolve | 14.7–15.4 s | Breakdown's middle bar grows into the Agree, Unsure and Disagree buttons, so the last frames are identical to frame 0. |

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Viewer with play/pause, a scrubber and links to every film. |
| `kit.js` | Shared palette, helpers, parts (card, heading, dots, slider, quadratic rows, Opinion Map, bars, lock, timeline) and the capture API. |
| `films/*.js` | One film per file: its timeline (`BEATS`), content, and `build` and `render` functions. |
| `motion.css` | Page background, fonts and viewer styles. No CSS animations or transitions. |
| `render/render.mjs` | Frame-accurate renderer and invariant checks. |
| `dist/` | Local render output (git-ignored). |

Fonts are the product film's self-hosted Poppins (`../product-film/fonts/`, SIL Open
Font License 1.1).

To change a film's rhythm, edit its `BEATS`. Timings inside a scene are offsets from
its start, so they move with it. A duration that is a multiple of 0.2 s gives a whole
number of frames at 20, 25 and 30 fps.

## Preview

Serve `media/` over HTTP, so the page can reach the shared fonts:

```bash
python3 -m http.server 8098 -d media
open "http://localhost:8098/motion-loops/?film=cities"
```

`?t=7.5` opens paused at 7.5 s and `?paused=1` opens paused at 0 s. Space toggles
playback. With `prefers-reduced-motion: reduce` the viewer opens paused on frame 0.

## Render

Requirements: the repository's root dev dependencies (`npm install` at the repository
root provides Playwright), a Playwright Chromium (`npx playwright install chromium`, or
point `CHROMIUM_PATH` at Chrome), and `ffmpeg` and `gifsicle` on `PATH`. No new npm
dependencies are needed.

```bash
# from the repository root; about a minute per film
node media/motion-loops/render/render.mjs all readme   # one film
node media/motion-loops/render/render.mjs all          # every film
```

| File | Spec |
| --- | --- |
| `docs/assets/readme-feature-rotation.gif` | 1600×900, 25 fps, infinite loop. |
| `media/motion-loops/dist/use-cases/<film>.gif` | 1280×720, 25 fps, infinite loop. |
| `media/motion-loops/dist/<film>-1080p.mp4` | 1920×1080, 30 fps constant, H.264 High, yuv420p, BT.709, CRF 16, fast start, no audio track. |
| `media/motion-loops/dist/use-cases/<film>-720p.mp4` | The web-page version of a use-case film: 1280×720, 30 fps constant, H.264 High, yuv420p, BT.709, CRF 21, fast start, no audio track. |
| `media/motion-loops/dist/use-cases/<film>-poster.jpg` | Frame 0 at 1280×720, for the `<video>` poster. |

GIFs use one global palette with no dithering and are optimized with gifsicle, which
stores identical consecutive frames as one longer frame. Frames are rasterized directly
at GIF size instead of being downscaled from the master, and every colour in the design
gets an exact palette entry, so text stays clean and flat colours stay true.

`render.mjs` also takes `video`, `gif`, `verify` and `stills <film> 0 7.8 12`, and the
options listed at the top of the file. A failed run leaves existing output untouched.

## Checks

`node media/motion-loops/render/render.mjs verify` runs first in `all`. For every film it
fails if any of these stop holding:

- The section headings share one anchor and size, and only one shows at a time. At rest
  each is exactly 0.5 opacity.
- The last frame is pixel-identical to frame 0, so the loop is seamless.
- A frame is pixel-identical however it is reached, in order or by seeking, and frames
  sampled across the timeline all differ from one another.

For the README loop it also fails unless:

- The footer total equals the sum of the squared allocations on every frame, and
  throughout the quadratic scene it also equals the number of credit squares shown.
- On screen, the quadratic scene ends at 3, 2 and 1 for 14 credits, the rating at 7, and
  all three checkboxes checked.

To check a render:

```bash
ffprobe -v error -show_entries stream=profile,width,height,pix_fmt,r_frame_rate,nb_frames:format=duration,size -of default=nw=1 media/motion-loops/dist/readme-1080p.mp4
gifsicle --info docs/assets/readme-feature-rotation.gif | head -5
```

When sampling a GIF frame with `ffmpeg`, decode with `-vf fps=25,select=…` rather than
`-ss`. A held frame is stored once, so `-ss` lands on the frame after the hold.
