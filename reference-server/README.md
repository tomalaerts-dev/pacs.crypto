# pacs.crypto Reference Server

First executable slice of the `pacs.crypto` reference stack.

Conformance status for the spec-covered routes is tracked in [`../docs/conformance.md`](../docs/conformance.md).
Current lifecycle and webhook/reporting decision rules are captured in [`../docs/spec-hardening.md`](../docs/spec-hardening.md).
The current chain-adapter boundary is documented in [`../docs/chain-adapter.md`](../docs/chain-adapter.md).
The delivery model is documented in [`../docs/webhook-delivery.md`](../docs/webhook-delivery.md).

Current scope:

- `GET /health`
- `POST /travel-rule`
- `GET /travel-rule/:recordId`
- `PUT /travel-rule/:recordId`
- `POST /travel-rule/:recordId/callback`
- `GET /travel-rule/search`
- `GET /travel-rule/stats`
- `POST /instruction/quote`
- `POST /instruction`
- `GET /instruction/:instructionId`
- `DELETE /instruction/:instructionId`
- `GET /instruction/search`
- `POST /instruction/:instructionId/return` (Tom v1.2)
- `POST /instruction/:instructionId/reverse` (Tom v1.2)
- `GET /instruction/:instructionId/reversal-status` (Tom v1.2)
- `GET /execution-status/:instructionId`
- `GET /execution-status/uetr/:uetr`
- `GET /finality-receipt/:instructionId`
- `GET /finality-receipt/uetr/:uetr`
- `GET /event-outbox`
- `GET /event-outbox/:eventId`
- `POST /exceptions/investigations`
- `PATCH /exceptions/investigations/:caseId`
- `GET /exceptions/investigations`
- `GET /exceptions/investigations/:caseId`
- `POST /exceptions/returns`
- `PATCH /exceptions/returns/:returnCaseId`
- `GET /exceptions/returns`
- `GET /exceptions/returns/:returnCaseId`
- `POST /webhook-endpoints`
- `GET /webhook-endpoints`
- `GET /webhook-endpoints/:subscriptionId`
- `GET /webhook-endpoints/:subscriptionId/deliveries`
- `GET /webhook-deliveries`
- `GET /webhook-deliveries/stats`
- `GET /webhook-deliveries/dead-letter`
- `GET /webhook-deliveries/:deliveryId`
- `POST /webhook-deliveries/dispatch`
- `GET /reporting/notifications`
- `GET /reporting/notifications/:notificationId`
- `GET /reporting/intraday`
- `GET /reporting/statements`
- `GET /reporting/statements/:statementId`
- `POST /report/query`
- `GET /report/intraday`
- `GET /report/statement`
- `GET /report/notification/:notificationId`
- `GET /report/search`
- `GET /report/stats`

## Run

```bash
npm install
npm start
```

Server defaults:

- host: `127.0.0.1`
- port: `5050`
- database: `reference-server/data/reference-stack.sqlite`

Environment overrides:

- `REF_SERVER_HOST`
- `REF_SERVER_PORT`
- `REF_SERVER_DB_PATH`
- `REF_SERVER_WEBHOOK_AUTO_DISPATCH`
- `REF_SERVER_WEBHOOK_DISPATCH_INTERVAL_MS`
- `REF_SERVER_WEBHOOK_DISPATCH_BATCH_SIZE`
- `REF_SERVER_WEBHOOK_RETRY_SCHEDULE_MS`
- `REF_SERVER_CHAIN_ADAPTER` (`mock-evm` by default, or `sepolia-usdc`)
- `REF_SERVER_SEPOLIA_RPC_URL`
- `REF_SERVER_SEPOLIA_PRIVATE_KEY`
- `REF_SERVER_SEPOLIA_USDC_CONTRACT_ADDRESS`
- `REF_SERVER_SEPOLIA_SOURCE_ADDRESS`
- `REF_SERVER_SEPOLIA_BROADCAST_ENABLED`
- `REF_SERVER_SEPOLIA_REQUIRED_CONFIRMATIONS`
- `REF_SERVER_SEPOLIA_GAS_LIMIT`
- `REF_SERVER_SEPOLIA_MAX_FEE_GWEI`
- `REF_SERVER_SEPOLIA_MAX_PRIORITY_FEE_GWEI`

Sepolia execution is opt-in. The mock adapter remains the default. To enable
the Sepolia adapter in read-only mode, set `REF_SERVER_CHAIN_ADAPTER=sepolia-usdc`.
To broadcast transactions, also set `REF_SERVER_SEPOLIA_BROADCAST_ENABLED=true`,
`REF_SERVER_SEPOLIA_RPC_URL`, `REF_SERVER_SEPOLIA_PRIVATE_KEY`,
`REF_SERVER_SEPOLIA_SOURCE_ADDRESS`, and
`REF_SERVER_SEPOLIA_USDC_CONTRACT_ADDRESS`.

## Real-Chain Workflow

Use these commands when you want to run the first funded-wallet Sepolia proof
path rather than the mock wedge.

### 1. Preflight the wallet and RPC

```bash
cd reference-server
npm run preflight:sepolia
```

Required environment for preflight:

- `REF_SERVER_SEPOLIA_RPC_URL`
- `REF_SERVER_SEPOLIA_PRIVATE_KEY`
- `REF_SERVER_SEPOLIA_USDC_CONTRACT_ADDRESS`
- optional but recommended: `REF_SERVER_SEPOLIA_SOURCE_ADDRESS`
- optional: `REF_SERVER_DEMO_AMOUNT` (defaults to `1.00`)

The preflight checks:

- the RPC is actually Sepolia (`chain_id = 11155111`)
- the private key matches the configured source address
- code exists at the configured USDC contract
- the source wallet has ETH for gas and enough USDC for `REF_SERVER_DEMO_AMOUNT`

### 2. Start the server in broadcast mode

```bash
REF_SERVER_CHAIN_ADAPTER=sepolia-usdc \
REF_SERVER_SEPOLIA_BROADCAST_ENABLED=true \
npm start
```

### 3. Run the canonical demo flow and capture evidence

```bash
REF_SERVER_DEMO_RECIPIENT_WALLET=0x... \
REF_SERVER_DEMO_DEBTOR_WALLET="$REF_SERVER_SEPOLIA_SOURCE_ADDRESS" \
npm run demo:sepolia
```

Optional demo controls:

- `REF_SERVER_DEMO_BASE_URL` (defaults to `http://127.0.0.1:5050`)
- `REF_SERVER_DEMO_AMOUNT` (defaults to `1.00`)
- `REF_SERVER_DEMO_POLL_INTERVAL_MS`
- `REF_SERVER_DEMO_TIMEOUT_MS`
- `REF_SERVER_DEMO_LABEL`
- `REF_SERVER_DEMO_OUTPUT_DIR`
- `REF_SERVER_DEMO_SEND_TRAVEL_RULE_CALLBACK`

The demo runner writes a full artifact bundle under:

- `reference-server/data/demo-runs/<run-id>/`

The runner exits non-zero unless the captured execution status and finality
receipt are both `FINAL`, so failed or probabilistic runs are not mistaken for
reviewer evidence.

To render a reviewer-facing markdown summary from a captured run:

```bash
npm run demo:report -- data/demo-runs/<run-id>
```

Artifacts include:

- quote request/response
- Travel Rule request/response and callback
- instruction request/response
- execution-status poll history and final payload
- finality receipt
- reporting notification and statement payloads
- report search and report stats payloads
- a final summary with the tx hash and Sepolia Etherscan URL
- a reviewer markdown summary

## Notes

- Persistence uses Node's built-in `node:sqlite` module.
- Instruction status progression now runs through an injected chain-adapter boundary.
- The default adapter is a mocked EVM adapter with amount-aware fee, slippage, and finality modeling over the lifecycle:
  `PENDING -> BROADCAST -> CONFIRMING -> FINAL`
- A `sepolia-usdc` adapter is available behind `REF_SERVER_CHAIN_ADAPTER`. It uses ethers for Sepolia RPC reads, USDC transfer broadcast, transaction receipt polling, and confirmation-depth based finality.
- The Sepolia adapter now fails safely if the configured RPC endpoint is not actually Sepolia.
- Adapter metadata is surfaced on quote, instruction, execution-status, and finality reads without adding new execution families.
- `execution-status` is the pacs.002-like read surface for lifecycle state and history.
- `finality-receipt` is the camt.025-like read surface for transaction hash, confirmations, and finality proof.
- `event-outbox` is the webhook-style delivery mirror. Event payloads are the same objects returned by `execution-status` and `finality-receipt`, so push and poll stay aligned.
- Webhook deliveries are HMAC-signed with `x-pacscrypto-signature` over `<timestamp>.<raw-body>`, plus delivery and event ids in headers.
- Delivery retries are persisted with `PENDING`, `RETRYING`, `DELIVERED`, and `FAILED` states. Background dispatch is enabled by default in the server process, and dispatch can still be forced manually via `POST /webhook-deliveries/dispatch`.
- Exhausted deliveries now carry explicit dead-letter fields and can be inspected through `GET /webhook-deliveries/stats` and `GET /webhook-deliveries/dead-letter`.
- `reporting/notifications` is the first reporting-family surface: a `camt.054` analogue for booked debtor debit and creditor credit notifications keyed to the instruction lifecycle.
- `reporting/intraday` is the next reporting-family surface: a narrow `camt.052` analogue summarizing booked intraday movements and account views from those notifications.
- `reporting/statements` starts the statement layer: a `camt.053` analogue that persists per-instruction account statements derived from the existing reporting notifications and instruction context.
- The root `Spec 3` reporting paths (`/report/*`) are also exposed alongside the legacy `/reporting/*` aliases, and the pull reads now return camt-style `group_header` / `report` / `statement` / `entry` wrappers rather than the earlier internal-only record shapes.
- Reporting records now carry explicit traceability back to instruction, status, finality, transaction hash, and Travel Rule resources where available, plus statement derivation metadata sourced from booked notifications.
- Reporting notifications are also emitted as `reporting_notification.created` events through the same outbox and webhook delivery pipeline. Generic webhook subscriptions receive the event envelope; `/report/query` notification subscriptions receive the raw camt-style notification body.
- `POST /report/query` with `STATEMENT + callback_url` now queues a raw camt-style statement callback through the same retrying delivery engine instead of inventing a separate callback subsystem.
- `exceptions/investigations` is the first exception-family runtime slice: a `camt.029`-like investigation case object linked to instruction, finality, reporting, and Travel Rule references without rewriting the original payment state.
- `exceptions/returns` is the second exception-family runtime slice: a `pacs.004`-like remediation object for post-settlement return or refund handling, again linked to rather than overwriting the original payment.
- Tom v1.2 return/reversal reconciliation is layered on top of the existing exception family. `POST /instruction/{instructionId}/return` materializes a real compensating instruction (retrievable via `GET /instruction/{instructionId}`) and a Tom-origin return case (`exception_type=RETURN`, `origin=TOM`, `return_status=APPROVED`) while returning the v1.2 `CompensatingInstructionResponse` shape (`status=PENDING`, `accepted_at`, `compensating_uetr`). `POST /instruction/{instructionId}/reverse` records a reversal request as an exception-family case with `exception_type=REVERSAL` and `status=REQUESTED` only — no compensating instruction is created at REQUESTED. `GET /instruction/{instructionId}/reversal-status` returns the most recent REVERSAL case for the original instruction. On-chain final transfers are compensated, not literally unwound. `webhook_url` is only accepted on `ReversalRequest`. Reversal cases are filtered out of the legacy `/exceptions/returns` list and detail surfaces.
- Exception-family changes are emitted as `investigation_case.updated` and `return_case.updated` through the same outbox and webhook delivery pipeline.
- Delegated signing is intentionally not implemented in this first slice.
- The root HTML simulators support both `Demo` mode and `Live API` mode against this server.
- The adapter boundary is intentionally narrow: quote generation, fee estimates, settlement defaults, lifecycle advancement, lifecycle timestamps, and lifecycle metadata now come from the chain adapter rather than being hard-coded in route or storage logic.
