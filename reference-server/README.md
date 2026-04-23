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

## Notes

- Persistence uses Node's built-in `node:sqlite` module.
- Instruction status progression now runs through an injected chain-adapter boundary.
- The default adapter is a mocked EVM adapter with amount-aware fee, slippage, and finality modeling over the lifecycle:
  `PENDING -> BROADCAST -> CONFIRMING -> FINAL`
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
- Reporting records now carry explicit traceability back to instruction, status, finality, transaction hash, and Travel Rule resources where available, plus statement derivation metadata sourced from booked notifications.
- Reporting notifications are also emitted as `reporting_notification.created` events through the same outbox and webhook delivery pipeline.
- `exceptions/investigations` is the first exception-family runtime slice: a `camt.029`-like investigation case object linked to instruction, finality, reporting, and Travel Rule references without rewriting the original payment state.
- `exceptions/returns` is the second exception-family runtime slice: a `pacs.004`-like remediation object for post-settlement return or refund handling, again linked to rather than overwriting the original payment.
- Exception-family changes are emitted as `investigation_case.updated` and `return_case.updated` through the same outbox and webhook delivery pipeline.
- Delegated signing is intentionally not implemented in this first slice.
- The root HTML simulators support both `Demo` mode and `Live API` mode against this server.
- The adapter boundary is intentionally narrow: quote generation, fee estimates, settlement defaults, lifecycle advancement, lifecycle timestamps, and lifecycle metadata now come from the chain adapter rather than being hard-coded in route or storage logic.
