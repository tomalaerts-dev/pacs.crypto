# pacs.crypto Spec Hardening Decisions

This document captures the behavioral decisions that are now treated as part of
the current executable wedge. It exists to keep major rules out of route code
and to make later reporting, demo, and exception-family work build on explicit
semantics.

## Scope

These decisions apply to the current bank-to-VASP reference stack:

- Travel Rule record lifecycle in the reference server
- instruction terminal and exception semantics
- webhook/event payload contract
- reporting-family boundaries and identifiers

They do not define long-term normative standards for every future `pacs.crypto`
family member. They define the current executable interpretation for this repo.

## Travel Rule Callback Lifecycle

### Core rule

The Travel Rule callback is a **data-quality acknowledgement**, not an execution
gate and not a sanctions signal.

The callback status only answers:

- was the submitted Travel Rule data structurally sufficient for the receiving
  VASP's intake and review process
- does the receiving VASP require correction or more review time

It does not answer:

- whether the blockchain transfer was or should be broadcast
- whether the receiving VASP cleared or blocked the transfer on sanctions grounds
- whether beneficiary crediting occurred

### Allowed record lifecycle

- `POST /travel-rule` creates `SUBMITTED`
- `POST /travel-rule/{recordId}/callback` may move `SUBMITTED` to:
  - `ACCEPTED`
  - `REJECTED`
  - `UNDER_REVIEW`
- `UNDER_REVIEW` is non-terminal and may later move to:
  - `ACCEPTED`
  - `REJECTED`
- `REJECTED` is correctable via `PUT /travel-rule/{recordId}` and a later follow-up callback
- `ACCEPTED` is terminal for the current wedge

### Correction semantics

When correcting a rejected record:

- the same `record_id` is retained
- the corrected payload is submitted with `PUT /travel-rule/{recordId}`
- `correction_of_callback_ref` should point to the rejected callback being addressed
- a new callback is expected after the corrected data is reviewed

The reference server keeps the callback chain on the record rather than
forking new child records. This keeps audit linkage simple for the current demo wedge.

### Conflict rule

Once a record reaches `ACCEPTED`, a later superseding callback is rejected in the
reference implementation. That makes the accepted state stable for downstream
linking from instructions and reporting.

## Instruction Terminal Failure Semantics

### Status taxonomy

The current wedge distinguishes between:

- operational completion: `FINAL`
- operator cancellation: `CANCELLED`
- expiry without execution: `EXPIRED`
- generic undisclosed failure: `FAILED`
- bounded execution rejection: `SLIPPAGE_EXCEEDED`
- ramp-specific failure: `RAMP_FAILED`

### Disclosure rule

`FAILED` is intentionally generic.

Where the VASP cannot safely disclose the true operational reason, the system may
return `FAILED` with no detailed `failure_reason`. This preserves the design
principle already stated in the instruction spec: the API must not create a side
channel for sanctions screening outcomes or similar sensitive compliance signals.

By contrast, `SLIPPAGE_EXCEEDED`, `EXPIRED`, and `RAMP_FAILED` are explicitly
disclosable because they are execution conditions rather than protected compliance findings.

### Cancellation rule

Cancellation is allowed only before on-chain broadcast.

In the current stack that means:

- cancellable: `PENDING`, `QUOTED`
- no longer cancellable: `BROADCAST`, `CONFIRMING`, `FINAL`, and all terminal failures

If cancellation is attempted too late, the API returns a conflict rather than
pretending to reverse a chain action that may already be economically final.

### Slippage rule

For ramped instructions, the mock EVM adapter may reject the instruction as
`SLIPPAGE_EXCEEDED` before broadcast when the estimated slippage is above the
declared `maximum_slippage_rate`.

This is treated as a terminal business rejection, not as an in-flight failure.

## Webhook Event Contract

### Canonical payload rule

Webhook payloads must mirror the polling surfaces rather than invent a separate
schema for push delivery.

The current event families are:

- `execution_status.updated`
- `finality_receipt.updated`
- `reporting_notification.created`
- `reporting_statement.ready` (internal callback-delivery event)

For each event:

- the event `payload` is the same object returned by the matching read endpoint
- the transport envelope adds delivery and event metadata only

Current reporting exception:

- generic webhook subscriptions still receive the event envelope
- `POST /report/query` notification subscriptions receive the raw
  `BlockchainNotification` body
- `POST /report/query` statement callbacks receive the raw `WalletStatement`
  body

This keeps push and poll aligned and reduces the chance of divergent field semantics.

### Delivery model

The current delivery model is outbox-based:

- instruction and reporting changes write canonical events to the outbox
- matching webhook subscriptions create delivery records
- deliveries are signed and attempted against subscriber endpoints
- retries are persisted with `PENDING`, `RETRYING`, `DELIVERED`, and `FAILED`

The server now supports both:

- background dispatch for due deliveries
- manual dispatch forcing via `POST /webhook-deliveries/dispatch`

Manual dispatch remains useful for demos and deterministic testing.

### Delivery guarantee rule

The current guarantee is `AT_LEAST_ONCE_BEST_EFFORT`.

That means the stack intentionally prefers canonical event persistence plus
retry over any claim of exactly-once delivery. Polling remains the recovery
surface when a receiver needs to reconcile after missed or duplicate push events.

### Exhaustion rule

When delivery can no longer make progress, the record moves to terminal
`FAILED` with explicit operator fields:

- `failure_category`
- `terminal_reason`
- `dead_lettered_at`

Current terminal reasons are:

- `MAX_ATTEMPTS_EXHAUSTED`
- `SUBSCRIPTION_INACTIVE`
- `EVENT_MISSING`

This keeps exhausted delivery behavior visible and auditable instead of leaving
it implicit inside retry counters.

### Signature rule

Webhook deliveries are signed with `x-pacscrypto-signature` over:

- `<timestamp>.<raw-body>`

The signature metadata is separate from the canonical payload and does not alter
the business object being delivered.

## Reporting-Family Boundaries And Identifiers

### Boundary rule

Reporting remains institution-facing booked-entry reporting. It is not a block
explorer substitute and it is not another status API.

The current split is:

- `execution-status`: execution lifecycle and status history
- `finality-receipt`: settlement/finality proof
- `reporting/notifications`: booked-entry notifications
- `reporting/intraday`: movement summaries built from booked notifications
- `reporting/statements`: persisted statement views derived from reporting notifications

Reporting may reference status and finality, but it must not replace them.

### Identifier rule

The same identifiers must flow across families wherever applicable:

- `instruction_id`
- `uetr`
- `travel_rule_record_id`
- `transaction_hash`

This keeps traceability stable across:

- instruction submission
- lifecycle polling
- webhook delivery
- booked reporting outputs

### Travel Rule linkage rule

Travel Rule data remains a linked compliance context rather than being duplicated
into every downstream message family. Downstream surfaces reference
`travel_rule_record_id` where relevant instead of embedding the entire Travel Rule payload.

## What This Prepares Next

These decisions unblock the next work cleanly:

- reporting polish can improve statements and traceability without reopening core lifecycle rules
- the demo package can explain exact status/reporting boundaries without hand-waving
- future exception-family design can start from explicit terminal-state semantics
