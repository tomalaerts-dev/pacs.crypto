# Control Room QA smoke remediation — 2026-07-08

Status: PASS_AFTER_REMEDIATION

This follow-up supersedes the earlier `control-room-smoke-2026-07-08.md` request-changes verdict without editing that dated report.

## Remediation applied

Changed only `bank-to-vasp-control-room.html`:

- Narrow/reduced viewports now left-align the fixed 1660px desktop presenter canvas and expose horizontal/vertical scroll instead of centering the canvas with the left rail clipped offscreen.
- The Evidence | Payload grid now uses `minmax(0, 1fr)` and `min-width:0`/internal overflow on the payload lane so long reporting JSON scrolls inside the payload panel instead of expanding/clipping the grid.

## Re-run evidence

```text
$ /Users/agent/.hermes/hermes-agent/venv/bin/python /tmp/pacs-control-room-smoke-2026-07-08/control_room_smoke.py
SMOKE_RC=0
```

Browser smoke result:

- `ok: true`
- Desktop 1660x900 layout regions visible and aligned.
- Keyboard left/right passed.
- Click-to-step passed.
- Autoplay play/pause passed.
- SAY toggle passed.
- REQUEST/RESPONSE payload toggle passed.
- Payload panel visible at all 11 steps.
- Traceability spine reveals identifiers only at or after the expected steps.
- LIVE switch against `http://127.0.0.1:5050` passed using the local reference server only.
- MOCK switch-back restored bundled-payload mode.
- Reduced 390x844 viewport now reports `stage.x=0`, `stage.width=1660`, `docScrollWidth=1660`; the fixed desktop canvas is inspectable with scroll.
- No desktop or reduced-viewport console/page errors.

Targeted overflow probe:

```text
steps 9, 10, 11: payloadRight == midRight, headerRight == midRight, overflow = 0px
```

Reference-server regression:

```text
$ cd reference-server && npm test
NPM_TEST_RC=0
tests 96, pass 95, fail 0, skipped 1
```

Source/link hygiene:

- `git diff --check`: exit 0.
- Credential/private-path scan on product files: no unexpected hits.
- Expected URL references only: local reference-server URLs, Google Fonts stylesheet, Sepolia Etherscan template gated by live tx hash, existing public documentation links.

Artifacts:

- Desktop screenshot: `/tmp/pacs-control-room-smoke-2026-07-08/control-room-desktop-1660x900.png`
- Reduced viewport full-page screenshot: `/tmp/pacs-control-room-smoke-2026-07-08/control-room-reduced-390x844-fullpage.png`
- JSON result: `/tmp/pacs-control-room-smoke-2026-07-08/control-room-smoke-results.json`
- Smoke harness: `/tmp/pacs-control-room-smoke-2026-07-08/control_room_smoke.py`

## Gate decisions

- Push: NO — not authorized.
- PR/open: NO — not authorized.
- Merge: NO — not authorized.
- Deploy: NO — not authorized.
- Migration: NO — not applicable / not authorized.
- Production-data operation: NO.
- Service restart: NO production/service restart; local dev server was started for smoke and killed.
- Release/publication: NO.
