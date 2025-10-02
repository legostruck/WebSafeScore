# WebSafeScore - Website Safety Scanner

This repository is a Chrome extension that computes explainable safety scores for websites.

Features
- Explainable scoring core in `lib/score.cjs` returning `{ score, rawScore, breakdown, confidence }`.
- Deterministic, testable heuristics in `popup.js` for local testing.
- Server-side proxy (`server.js`) with a mock reputation endpoint and a handler to integrate real providers behind a server.
- UI: dark monochrome theme, explainable breakdown, calibration sliders to tune weights at runtime, and a visual confidence gauge.

Getting started
1. Install dependencies (server only):

```powershell
npm install
```

2. Run server for local testing (optional):

```powershell
npm start
```

3. Load the extension in Chrome:
- Open `chrome://extensions`
- Enable Developer mode
- Click "Load unpacked" and select this repository directory

Testing
- Unit tests are in `test/`.
- Run tests:

```powershell
npm test
```

Notes on reputation API
- The extension includes a server-side proxy endpoint: `GET /api/reputation/:domain`.
- By default the server returns a deterministic mock. To integrate a real provider, set `REPUTATION_API_KEY` on the server and implement the provider forwarding in `server.js`.
- Keeping API keys server-side avoids exposing them in the extension.



License: MIT
