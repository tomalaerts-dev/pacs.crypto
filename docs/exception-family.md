# Exception-Family Design

This document defines the exception-family boundary for the current
`pacs.crypto` wedge and now doubles as the design note for the implemented
first slice.

The current runtime covers `investigation_case` and `return_case` read/write
surfaces. It does not yet implement richer bilateral cancellation or full
remediation workflow semantics.

## Purpose

The current stack already has terminal and exceptional statuses:

- `CANCELLED`
- `EXPIRED`
- `FAILED`
- `SLIPPAGE_EXCEEDED`
- `RAMP_FAILED`

Those are necessary, but they are not a full exception-family.

The missing design question is:

- when does an operational exception remain part of the existing instruction
  lifecycle
- and when does it become a new cross-party exception or remediation object

## Core Rule

Blockchain irreversibility must remain explicit.

That means:

- pre-broadcast cancellation is a workflow control decision
- post-settlement remediation is a new economic action, not a hidden reversal of
  the original transfer
- investigations are case-management objects, not overloaded status fields

## Decision Summary

### Stays in current APIs

These behaviors stay where they are:

- `DELETE /instruction/{instructionId}` for pre-broadcast cancellation only
- terminal execution outcomes on `execution-status`
- finality proof on `finality-receipt`
- Travel Rule correction on the existing Travel Rule record

These do **not** require a new family for the current wedge.

### Becomes a dedicated exception family

These behaviors should become explicit exception-family objects:

- post-settlement return or compensating transfer
- cross-party cancellation negotiation once there is real bilateral workflow
- investigation and case handling across instruction, finality, reporting, and
  Travel Rule references

## Exception Taxonomy

### 1. Pre-broadcast cancellation

Definition:

- the instructing party withdraws the payment before on-chain broadcast

Current system behavior:

- remains in the current instruction API
- terminal status is `CANCELLED`
- no exception-family object is required for the current wedge

Reason:

- this is still command-surface behavior, not post-fact remediation

### 2. Pre-execution expiry or bounded rejection

Definition:

- the payment never becomes an on-chain transfer because it expires or violates
  a bounded execution constraint

Current system behavior:

- remains in the current lifecycle surfaces
- status is `EXPIRED`, `SLIPPAGE_EXCEEDED`, or `RAMP_FAILED`

Reason:

- this is still execution-state semantics, not a separate exception workflow

### 3. Post-broadcast execution failure

Definition:

- the instruction progressed beyond pure acceptance but did not cleanly reach
  intended settlement

Current system behavior:

- remains visible through `execution-status` and `finality-receipt`
- generic undisclosed failure remains `FAILED`

Future family impact:

- only escalates into an investigation case when cross-party follow-up is
  needed

### 4. Post-settlement remediation

Definition:

- the original payment is already economically final or treated as final enough
  that remediation requires a new transfer or off-chain refund

This is the first true exception-family object.

Design rule:

- do not represent this as the original payment changing from `FINAL` to some
  synthetic “reversed” status
- represent it as a linked remediation record

Recommended message analogue:

- `pacs.004`-like return or compensation object

Tom v1.2 instruction façade:

- `POST /instruction/{instructionId}/return` is implemented as a public v1.2 path
  backed by this return-case model. It creates a real compensating instruction
  and keeps the original instruction `FINAL`.
- The response follows Tom's `CompensatingInstructionResponse` shape, while the
  internal exception-family record retains traceability and operator workflow
  fields.

### 5. Investigation and dispute handling

Definition:

- an operator needs structured follow-up without altering the original payment
  object

Examples:

- beneficiary credit query after chain finality
- mismatch between booked reporting and beneficiary handling
- Travel Rule dispute after an accepted record
- operational query around a failed or ambiguous transfer

Recommended message analogue:

- `camt.029`-like investigation case

## Recommended Family Boundaries

### Keep the current command surface narrow

The current instruction API should continue to own:

- quote
- submit
- get current instruction state
- pre-broadcast cancel

It should **not** become the container for:

- returns
- dispute narratives
- bilateral cancellation negotiation after execution has started

### Add a dedicated exception family

Current first-slice runtime:

- `return_case` (`pacs.004` analogue), including Tom v1.2 `/return`
  requests backed by real compensating instructions
- `reversal` request records (`pacs.007`-like Tom v1.2 `/reverse` façade) stored
  as exception-family cases while the original on-chain instruction remains
  final
- `investigation_case` (`camt.029` analogue)
- optional later `cancellation_case` (`camt.056` / `057` / `058` analogue),
  including any broader `status-request` surface if Tom's direction calls for it

## Proposed Object Model

### Shared exception identifiers

Every exception-family object should carry:

- `exception_case_id`
- `exception_type`
- `status`
- `opened_at`
- `updated_at`
- `related_instruction_id`
- `related_uetr`
- `related_travel_rule_record_id`
- `related_transaction_hash`
- `opened_by`
- `counterparty`
- `reason_code`
- `narrative`

This preserves the same traceability discipline already used across lifecycle
and reporting surfaces.

### Return case

Recommended fields:

- `return_case_id`
- `return_type`
- `original_instruction_id`
- `original_transaction_hash`
- `return_method`
- `return_amount`
- `return_asset`
- `return_status`
- `compensating_instruction_id` when remediation itself is executed through the
  stack
- `off_chain_reference` when remediation happens outside the chain flow

Recommended `return_method` values:

- `ON_CHAIN_COMPENSATING_TRANSFER`
- `OFF_CHAIN_REFUND`
- `MANUAL_FIAT_REMEDIATION`

### Investigation case

Recommended fields:

- `investigation_case_id`
- `case_type`
- `case_status`
- `priority`
- `requires_counterparty_action`
- `resolution_type`
- `resolution_summary`
- `linked_return_case_id` where relevant

Recommended `case_type` values:

- `STATUS_QUERY`
- `BENEFICIARY_CREDIT_QUERY`
- `TRAVEL_RULE_DISPUTE`
- `RETURN_REQUEST`
- `SETTLEMENT_DISCREPANCY`

### Cancellation case

This should remain a later addition only if the stack grows beyond the current
single-orchestrator command model.

If later implemented, it should cover:

- asynchronous bilateral cancellation request
- acceptance or rejection by the counterparty
- lapse/expiry of the cancellation request

For the current wedge, `DELETE /instruction/{instructionId}` remains enough.

## Status Rules

### Original payment stays authoritative

The original instruction should keep its real terminal outcome:

- `CANCELLED`
- `EXPIRED`
- `FAILED`
- `FINAL`

The exception-family object links to it; it does not overwrite it.

### Return cases do not rewrite finality

If a payment has reached `FINAL`, then:

- `execution-status` remains `FINAL`
- `finality-receipt` remains `FINAL`
- any remediation is represented as a separate return or compensating object

This is the single most important design rule in the family.

## Current First-Slice Endpoints

Implemented now:

- `POST /instruction/{instructionId}/return` (Tom v1.2 façade over return cases)
- `POST /instruction/{instructionId}/reverse` (Tom v1.2 reversal request façade)
- `GET /instruction/{instructionId}/reversal-status` (Tom v1.2 reversal status read)
- `POST /exceptions/returns`
- `GET /exceptions/returns/:returnCaseId`
- `GET /exceptions/returns`
- `PATCH /exceptions/returns/:returnCaseId`
- `POST /exceptions/investigations`
- `GET /exceptions/investigations/:caseId`
- `GET /exceptions/investigations`
- `PATCH /exceptions/investigations/:caseId`

Hold for later:

- `POST /exceptions/cancellation-requests`
- `GET /exceptions/cancellation-requests/:caseId`

## Eventing Rule

The same push/poll discipline should apply here as elsewhere.

Current implemented event families:

- `return_case.updated`
- `investigation_case.updated`

Optional later event family:

- `cancellation_case.updated`

For each event:

- the push payload should equal the canonical polling object
- the transport envelope should add delivery metadata only

## Implementation Order

The order used for the first slice is:

1. `investigation_case`
2. `return_case`
3. `cancellation_case` only if bilateral orchestration really demands it

Current status:

- `investigation_case`: implemented and now enforcing workflow transitions plus operator metadata
- `return_case`: implemented and now enforcing method-specific settlement evidence plus reporting-linkage fields
- `cancellation_case`: deferred

Reason:

- investigations are the safest addition because they preserve current payment
  objects and let operators track disputes without inventing fake reversals
- returns come next because they require remediation semantics but still fit the
  existing traceability model
- bilateral cancellation is the most workflow-heavy and least necessary for the
  current wedge

## Next Follow-Ups

The next questions after the first slice are:

1. Decide whether reviewer-facing demo material should include one explicit exception flow after the Sepolia evidence path lands.
2. Decide whether compensating-transfer returns should eventually require a completed linked instruction rather than just a stored reference.
3. Decide whether bilateral cancellation is actually needed before adding a
   `cancellation_case` family.

## Non-Goals

This family should not:

- invent a fake chain reversal
- leak sanctions-specific internal reasoning
- replace `execution-status` or `finality-receipt`
- duplicate the full Travel Rule payload into every case object
