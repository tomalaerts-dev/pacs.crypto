# Session Handoff

This document captures the current working state of `pacs.crypto` so a fresh
Codex session can resume without relying on prior chat history.

## Repo State

As of `2026-04-24`:

- repo root: `/Users/Raafet/Projects/codex_test/PACS_CRYPTO`
- active branch: `main`
- remote target: `origin` = `Raafet57/pacs.crypto`
- intended Git identity:
  - `Raafet57`
  - `Raafet57@users.noreply.github.com`
- the current working batch is staged but not yet committed
- the previous session could not run `git commit` or `git push` because the
  Codex approval/write limit blocked Git writes inside `.git/`

## Validation Status

Current validation before commit:

- `npm test` in `reference-server/`: `44/44` passing
- `git diff --check`: clean

## What Is In The Current Batch

### 1. Spec 3 reporting alignment

Implemented and tightened the root reporting family:

- `/report/query`
- `/report/intraday`
- `/report/statement`
- `/report/notification/{notificationId}`
- `/report/search`
- `/report/stats`

Behavior added in this batch:

- camt-style wrappers for intraday, statement, and notification reads
- raw `BlockchainNotification` delivery for `POST /report/query`
  notification subscriptions
- async statement delivery via `callback_url` through the retrying webhook
  engine
- compatibility aliases under legacy `/reporting/*` remain in place

Primary files:

- `reference-server/src/db.js`
- `reference-server/src/routes/reporting-routes.js`
- `reference-server/src/validators.js`
- `docs/conformance.md`
- `docs/spec-hardening.md`
- `docs/webhook-delivery.md`
- `reference-server/README.md`

### 2. Exception workflow deepening

Extended the first-slice exception runtime:

- stronger `investigation_case` lifecycle rules
- stronger `return_case` lifecycle and settlement evidence rules
- explicit linkage from exceptions to reporting notifications/statements for
  the same instruction
- operator workflow fields such as owner, team, due date, and counterparty
  reference

Primary files:

- `reference-server/src/db.js`
- `reference-server/src/routes/exception-routes.js`
- `reference-server/src/validators.js`
- `docs/exception-family.md`

### 3. Sepolia demo tooling

Added operational scripts for the real-chain demo path:

- `reference-server/scripts/sepolia-preflight.mjs`
- `reference-server/scripts/run-sepolia-demo.mjs`
- `reference-server/scripts/render-demo-evidence.mjs`

Package scripts added:

- `npm run preflight:sepolia`
- `npm run demo:sepolia`
- `npm run demo:report`

Supporting changes:

- `.gitignore` excludes local demo-run artifacts
- `docs/demo-bank-to-vasp.md` and `reference-server/README.md` now explain the
  funded-wallet flow and reviewer bundle generation

### 4. Sepolia adapter hardening

The `sepolia-usdc` adapter now:

- fails safely when broadcast mode is enabled but configuration is incomplete
- fails safely when the configured RPC is not actually Sepolia
- exposes more detailed adapter metadata for the testnet path
- supports injected wallet/contract factories for test coverage of broadcast
  behavior without a funded wallet in CI

Primary file:

- `reference-server/src/chain/sepolia-usdc-adapter.js`

### 5. New Sepolia happy-path lifecycle coverage

The test suite now covers the real-chain lifecycle shape without changing the
public API:

- `PENDING -> BROADCAST -> CONFIRMING -> FINAL`
- finality receipt linkage
- reporting linkage on the same instruction identifiers

Primary file:

- `reference-server/test/app.test.js`

This does not replace the need for a funded Sepolia run. It reduces the
remaining `P0` gap to actual live-chain evidence capture.

## Key Files In The Batch

- `.gitignore`
- `docs/backlog.md`
- `docs/conformance.md`
- `docs/demo-bank-to-vasp.md`
- `docs/exception-family.md`
- `docs/roadmap.md`
- `docs/spec-hardening.md`
- `docs/webhook-delivery.md`
- `reference-server/README.md`
- `reference-server/package.json`
- `reference-server/scripts/render-demo-evidence.mjs`
- `reference-server/scripts/run-sepolia-demo.mjs`
- `reference-server/scripts/sepolia-preflight.mjs`
- `reference-server/src/chain/sepolia-usdc-adapter.js`
- `reference-server/src/db.js`
- `reference-server/src/routes/exception-routes.js`
- `reference-server/src/routes/reporting-routes.js`
- `reference-server/src/validators.js`
- `reference-server/test/app.test.js`

## Immediate Next Action

Create one commit for the current batch and push it.

Suggested commit message:

`feat(reference-stack): deepen reporting and sepolia demo tooling`

If committing manually in a normal shell:

```bash
cd /Users/Raafet/Projects/codex_test/PACS_CRYPTO

GIT_AUTHOR_NAME="Raafet57" \
GIT_AUTHOR_EMAIL="Raafet57@users.noreply.github.com" \
GIT_COMMITTER_NAME="Raafet57" \
GIT_COMMITTER_EMAIL="Raafet57@users.noreply.github.com" \
git commit -m "feat(reference-stack): deepen reporting and sepolia demo tooling"

git push origin main
```

## Next Engineering Priority

After commit/push, continue with `P0`:

- run the funded Sepolia path and capture one real evidence bundle under
  `reference-server/data/demo-runs/<run-id>/`
- generate `21-reviewer-summary.md` with `npm run demo:report` only after the
  run reaches `FINAL` execution and `FINAL` finality

## Main Remaining Blocker

The real-chain evidence run still requires actual Sepolia configuration and
funding. In-session, the following were not available:

- `REF_SERVER_SEPOLIA_RPC_URL`
- `REF_SERVER_SEPOLIA_PRIVATE_KEY`
- `REF_SERVER_SEPOLIA_USDC_CONTRACT_ADDRESS`
- `REF_SERVER_SEPOLIA_SOURCE_ADDRESS`
- `REF_SERVER_DEMO_RECIPIENT_WALLET`

Until those are present, the strongest remaining credibility jump is still
pending: one captured Sepolia transaction hash, confirmation sequence, finality
receipt, and reviewer evidence bundle.
