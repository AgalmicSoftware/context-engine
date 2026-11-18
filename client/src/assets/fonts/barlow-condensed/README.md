# Barlow Condensed

The app self-hosts Barlow Condensed for the headlines on the personal analysis
picture card, so the card is drawn in the same face on every device and no page
asks a font service for it.

- Source: npm package `@fontsource/barlow-condensed` 5.3.0, files unchanged
- Files: weight 800, normal, in the latin and latin-ext subsets the package
  splits by `unicode-range` (37 KB together); a browser fetches them only when
  a card is drawn
- License: SIL Open Font License 1.1; see `OFL.txt`
