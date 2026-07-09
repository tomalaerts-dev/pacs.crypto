# Control Room QA smoke — 2026-07-08

Status: REQUEST_CHANGES
Claude posture: not-applicable — Shaka cold QA review only; no implementation delegated.

## Scope read

Task: PCD-005 visual fidelity, interaction, and source hygiene smoke for `bank-to-vasp-control-room.html`.

Files inspected:
- `bank-to-vasp-control-room.html`
- `README.md`
- `docs/demo-bank-to-vasp.md`
- `index.html` diff/navigation context
- `reference-server/package.json`
- `/Users/agent/.hermes/cache/documents/doc_91e76e3bd394_README.md`
- `assets/control-room/` — not present

No product-code remediation was performed. This file is the QA artifact.

## Git state and diff summary

Pre-report git status:

```text
## main...fork/main
 M README.md
 M docs/demo-bank-to-vasp.md
 M index.html
?? bank-to-vasp-control-room.html
```

Post-report git status:

```text
## main...fork/main
 M README.md
 M docs/demo-bank-to-vasp.md
 M index.html
?? bank-to-vasp-control-room.html
?? docs/qa/
```

Diff scope observed:
- `bank-to-vasp-control-room.html`: new standalone Control Room shell, bundled happy-path payloads, 11-step state model, MOCK/LIVE modes, local reference-server fetches.
- `README.md`: quick-start and roadmap links now include the Control Room and separate MOCK / local LIVE / real-chain paths.
- `docs/demo-bank-to-vasp.md`: reviewer walkthrough now includes Control Room, local LIVE, and corrected relative sample-payload links.
- `index.html`: home-page navigation now points to v1.3 simulators/specs and links the Control Room.

## Checks run

```text
$ git diff --check
# exit 0, no output
```

```text
$ cd reference-server && npm test
# exit 0
# tests 96, pass 95, fail 0, skipped 1, duration_ms 1681.485833
# skipped: funded Sepolia broadcast, gated behind REF_SERVER_SEPOLIA_FUNDED_TEST and credentials
```

```text
$ npm start  # reference server for browser LIVE smoke
pacs.crypto reference server listening on http://127.0.0.1:5050

$ curl -sS -i http://127.0.0.1:5050/health
HTTP/1.1 200 OK
access-control-allow-origin: *
...
{"status":"ok","service":"pacs.crypto reference server",...}
```

```text
$ /Users/agent/.hermes/hermes-agent/venv/bin/python /tmp/pacs-control-room-smoke-2026-07-08/control_room_smoke.py
# exit 1 because reduced/mobile viewport check failed
# 16/17 scripted browser checks passed
```

Browser smoke pass evidence:
- Desktop 1660x900 fixed geometry matched handoff: stage 1660x900, header 56, corridor 108, body 736, rail 300, center 1060, spine 300, evidence 452, payload 608 at initial render.
- Keyboard left/right passed.
- Click-to-step passed.
- Autoplay play/pause passed.
- SAY toggle passed.
- REQUEST/RESPONSE toggle passed on a request-bearing step.
- Payload panel was present on all 11 scripted steps.
- Traceability spine reveal order matched the handoff at steps 1, 3, 4, 5, 9, 10, and 11.
- Local LIVE switch passed with the reference server running: UI showed `http://127.0.0.1:5050`, `sepolia-usdc`, and a `live · 201` Travel Rule response.
- MOCK switch back passed.
- Desktop and reduced-viewport console/pageerror capture had no errors.

Screenshots / browser artifacts:
- Desktop screenshot: `/tmp/pacs-control-room-smoke-2026-07-08/control-room-desktop-1660x900.png` (1660 x 900)
- Reduced viewport screenshot: `/tmp/pacs-control-room-smoke-2026-07-08/control-room-reduced-390x844-fullpage.png` (1025 x 900)
- Full browser result JSON: `/tmp/pacs-control-room-smoke-2026-07-08/control-room-smoke-results.json`
- Smoke harness: `/tmp/pacs-control-room-smoke-2026-07-08/control_room_smoke.py`

## Source hygiene scan

Scoped scan of `bank-to-vasp-control-room.html`, `README.md`, `docs/demo-bank-to-vasp.md`, and `index.html` for credential prefixes, private-key labels, private-workstation path markers, and URL references.

Findings:
- No credential prefix, private-key label, or private-workstation path-marker matches in the inspected changed/new files.
- Expected local API references: `http://127.0.0.1:5050` in Control Room/docs/index.
- Expected design/runtime external references: Google Fonts stylesheet in `bank-to-vasp-control-room.html:7`; Sepolia Etherscan link template in `bank-to-vasp-control-room.html:1565`; general documentation links in README.
- No external tracking script or unexpected JS library/CDN dependency found. Google Fonts is the only external stylesheet dependency and is consistent with the design handoff.

## Findings

### RC-1 — Reduced/mobile viewport is not fully inspectable and no desktop-only constraint is documented

Severity: blocking for PCD-005 acceptance.

Evidence:
- Source fixes the canvas at 1660x900 and centers it in the body: `bank-to-vasp-control-room.html:21`, `bank-to-vasp-control-room.html:29`.
- At 390x844, Playwright measured:
  - `stage.x = -635`, `stage.width = 1660`, `stage.height = 900`
  - `rail.x = -635`, so the left script rail starts offscreen
  - `documentElement.scrollWidth = 1025`, less than the 1660px stage width, so the clipped left 635px is not reachable by normal horizontal scrolling
  - reduced full-page screenshot dimensions were 1025x900, not 1660x900
- Repo docs call the shell “presenter-driven” but do not explicitly document a desktop-presenter-only constraint: `README.md:71`, `README.md:102`, `docs/demo-bank-to-vasp.md:79-93`.

Why it matters:
- The acceptance criterion allows either an inspectable reduced/mobile viewport or an explicit desktop-presenter-only constraint. Current state provides neither: the fixed console is partially clipped on narrow viewports, and the constraint is not documented in the product-facing docs/page.

Suggested fix:
- Either make the fixed 1660px canvas left-aligned/scrollable on narrow viewports (`justify-content:flex-start` or a scroll wrapper that exposes the full stage), or explicitly document the shell as desktop-presenter-only in the page/docs. A small viewport note is enough if Raf wants the fixed desktop console preserved.

### RC-2 — Payload column overflows/clips at reporting steps with long JSON values

Severity: blocking for visual fidelity / payload-panel acceptance.

Evidence:
- Payload grid is `grid-template-columns:452px 1fr` without `min-width:0` on the payload grid item: `bank-to-vasp-control-room.html:1607-1613`, `bank-to-vasp-control-room.html:1617-1619`.
- Targeted desktop probe at 1660x900 found payload overflow once long reporting payloads render:
  - Step 9: payload right edge extends 55.94px beyond the center stage.
  - Step 10: payload right edge extends 352.63px beyond the center stage; the RESPONSE button right edge is 334.63px beyond the visible center-stage boundary.
  - Step 11: payload right edge extends 380.22px beyond the center stage; the RESPONSE button right edge is 362.22px beyond the visible center-stage boundary.
- Because the center stage has `overflow:hidden`, the panel content remains partly visible, but the right side of the payload header/control area is clipped at steps 10 and 11.

Why it matters:
- The handoff requires the Evidence | Payload region to stay aligned as `452px | 1fr` with the raw payload always visible. Long JSON should scroll inside the payload body, not expand the grid item outside its visible lane.

Suggested fix:
- Add `min-width:0` to the evidence/payload grid and especially the payload grid item / scroll body so long JSON lines scroll inside the payload pane instead of expanding the CSS grid track. Keep the change surgical and verify steps 9–11 at 1660x900.

## Non-blocking notes

- The Google Fonts stylesheet is an external request in the HTML. It is expected from the design handoff, and no external JS library/tracking dependency was found. If the desired interpretation of “no network” is strict even for font assets, self-host IBM Plex or use system fallbacks.
- LIVE mode browser smoke used only the local reference server with the default mock adapter; no real-chain/funded Sepolia path was run.

## Gate decisions

- Push: NO — not authorized.
- PR/open: NO — not authorized.
- Merge: NO — not authorized.
- Deploy: NO — not authorized.
- Migration: NO — not applicable / not authorized.
- Data operation: NO — only local sample payloads and local reference-server responses used.
- Service restart: NO production/service restart; local reference server was started for smoke and then killed.
- Release/publication: NO — not authorized.

## Overall decision

REQUEST_CHANGES. Most desktop interactions and local LIVE behavior pass, and the reference-server regression is green, but the reduced viewport is clipped without a documented desktop-only constraint, and reporting-step payload overflow clips the payload control area on desktop.
