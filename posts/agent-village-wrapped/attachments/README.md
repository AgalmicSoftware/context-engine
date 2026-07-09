# Attachments — Agent Village Wrapped post

Static assets for this post: the header image, example Wrapped poster images, and exported chart data.

Conventions (apply to every post folder):

- `header.png` — banner image for the post; the manifest's `headerImage` field points at it and the posts page renders it above the title.
- Images referenced from the post body use relative paths, e.g. `attachments/example-wrapped-poster.jpeg`.
- Data behind any `ce-viz` exhibit can be mirrored here as JSON/CSV for reuse.
- Keep assets non-identifying: no raw Telegram IDs, wallet addresses, or private memory content in exported data.

Wanted:

- [x] `header.png` — banner image (a cropped Wrapped poster works well at ~3:1)
- [x] `example-wrapped-poster.jpeg` — a real Agent Village Wrapped output image
- [x] `norms-map-compass.jpeg` — a compass-style meme mapping a predicted view against reference figures
- [x] `diagram-loop.png`, `diagram-calibration-curve.png` — rendered from `../diagram-prompts.md`, embedded in the eval section (the calibration curve is illustrative and captioned as such).
- [ ] Remaining rendered diagrams from `../diagram-prompts.md` are optional and can be added later if the post needs them.
