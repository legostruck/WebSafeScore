Press Start 2P local bundling
=============================

To ensure the 8-bit "Press Start 2P" font is available offline and looks consistent in the extension popup, download the WOFF2 font file and place it in the `fonts/` directory.

1. Download the WOFF2 file from Google Fonts (or a trusted mirror). Suggested filename: `PressStart2P-Regular.woff2`.
2. Create the `fonts` directory at the extension root and place the font file there.
3. The extension's `popup.css` already prefers the local font via `@font-face`; no further changes are needed.

License note: Press Start 2P is an open-source font under the SIL Open Font License. Verify licensing terms before redistribution.
