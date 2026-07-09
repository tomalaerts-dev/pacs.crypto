# Bank-to-VASP Control Room narrated demo video

This packet contains the GitHub review copy and HyperFrames source for the professional narrated walkthrough of `bank-to-vasp-control-room.html`.

## Primary artifact

- `renders/pacs-control-room-demo-720p-review.mp4` — 720p H.264/AAC review copy, small enough for GitHub browsing/download.

## Source-of-truth files

- `index.html` — HyperFrames composition source.
- `SCRIPT.md` — exact narration script.
- `DESIGN.md` — visual identity and motion constraints.
- `assets/narration.wav` — Kokoro narration used by the composition.
- `assets/control-room-real-demo-capture-timed.mp4` — timed real UI capture used by the composition.
- `renders/contact-sheet.jpg` — QA contact sheet sampled across the rendered video.

## Coverage

The video walks through every Control Room section:

1. Travel Rule submission
2. Beneficiary VASP callback
3. Quote request/response
4. Instruction submission
5. Pending lifecycle state
6. Broadcast lifecycle state
7. Confirming lifecycle state
8. Final lifecycle state
9. Finality receipt
10. Creditor notification
11. Creditor statement

It also shows presenter controls, request/response payload toggles, the traceability spine, MOCK mode, and local LIVE API mode.

## Claim boundary

This is a reviewer/demo artifact only:

- MOCK mode uses bundled sample payloads.
- LIVE mode is local reference-server mode only.
- No production system, publication, certification, or funded Sepolia transaction is implied.

## Verification performed before adding to GitHub

- HyperFrames lint: 0 errors, 0 warnings.
- HyperFrames validate: pass, no console errors, text contrast passes.
- HyperFrames inspect: 0 layout issues across 8 samples after intentional app-video overlay allowances.
- `ffprobe` on review copy: H.264 video + AAC audio, about 106 seconds.
- Contact sheet visually checked: title frame, app walkthrough frames, lower-third overlays, and late local-LIVE / closed-gate frames are present.

## Repository-size note

The 1080p master render and raw Playwright recording are intentionally kept out of git to avoid duplicate binary history. This GitHub packet keeps the portable review copy plus the source files needed to understand and rerender the video.
