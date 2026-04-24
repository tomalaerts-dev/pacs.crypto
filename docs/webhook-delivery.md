# pacs.crypto Webhook Delivery Model

This document captures the current webhook delivery semantics for the reference
stack.

The goal is operational credibility for the current demo wedge, not a claim of
production-grade guarantees.

## Delivery Guarantee

The current delivery guarantee is:

- `AT_LEAST_ONCE_BEST_EFFORT`

That means:

- matching subscriptions should receive each outbox event at least once when the
  endpoint is reachable
- duplicate delivery is possible
- exactly-once delivery is not guaranteed
- global ordering across subscriptions is not guaranteed

Polling remains the canonical recovery path when a receiver needs to reconcile
state.

## Canonical Push Model

The push model remains aligned to the polling model:

- outbox events carry canonical business objects
- webhook envelopes add transport metadata only
- the `payload` equals the object returned by the matching read endpoint

Reporting note:

- generic `/webhook-endpoints` subscriptions receive the event envelope
- `POST /report/query` notification subscriptions receive the raw
  `BlockchainNotification` message body from the root reporting spec
- `POST /report/query` statement callbacks receive the raw `WalletStatement`
  message body from the root reporting spec
- receivers can distinguish the mode via `x-pacscrypto-payload-mode`

Current event families:

- `execution_status.updated`
- `finality_receipt.updated`
- `reporting_notification.created`
- `reporting_statement.ready` (internal callback-delivery event)

## Delivery States

Current persisted delivery states:

- `PENDING`
- `RETRYING`
- `DELIVERED`
- `FAILED`

Additional operator fields now make terminal handling explicit:

- `failure_category`
- `terminal_reason`
- `dead_lettered_at`
- `delivery_guarantee`

Current terminal reasons:

- `MAX_ATTEMPTS_EXHAUSTED`
- `SUBSCRIPTION_INACTIVE`
- `EVENT_MISSING`

## Retry Model

The server supports:

- background dispatch for due deliveries
- manual dispatch forcing via `POST /webhook-deliveries/dispatch`
- persisted retry scheduling using `next_attempt_at`
- per-subscription `max_attempts`

Retry delays are controlled by:

- `REF_SERVER_WEBHOOK_RETRY_SCHEDULE_MS`

Background worker behavior is controlled by:

- `REF_SERVER_WEBHOOK_AUTO_DISPATCH`
- `REF_SERVER_WEBHOOK_DISPATCH_INTERVAL_MS`
- `REF_SERVER_WEBHOOK_DISPATCH_BATCH_SIZE`

## Dead-Letter Handling

A delivery is considered dead-lettered when it reaches `FAILED` with
`dead_lettered_at` populated.

Current operator reads:

- `GET /webhook-deliveries`
- `GET /webhook-deliveries/stats`
- `GET /webhook-deliveries/dead-letter`
- `GET /webhook-deliveries/:deliveryId`

These surfaces let an operator or demo user inspect:

- queued work
- retrying work
- exhausted deliveries
- current retry schedule and delivery counts

## Signature Rule

Webhook deliveries are signed over:

- `<timestamp>.<raw-body>`

Headers:

- `x-pacscrypto-signature`
- `x-pacscrypto-signature-timestamp`
- `x-pacscrypto-event-id`
- `x-pacscrypto-delivery-id`
- `x-pacscrypto-event-type`
- `x-pacscrypto-payload-mode`

## Scope Limit

This is still a demo-grade notification subsystem.

It does not yet claim:

- durable worker sharding
- ordered fanout guarantees
- endpoint health suppression windows
- replay tooling
- exactly-once consumer semantics

Those belong after the current reviewer/demo package, not before.
