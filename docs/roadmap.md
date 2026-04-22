# pacs.crypto Roadmap

## Purpose

This is the active 12-month roadmap for `pacs.crypto`.

It assumes a narrow execution wedge:

- one asset: USDC
- one chain family: EVM
- one corridor: bank -> sending VASP -> on-chain transfer -> receiving VASP
- one custody model for the current program: full custody

The primary audience is standards-savvy reviewers who care about message-family discipline, implementation realism, and honest scoping.

## Baseline As Of April 2026

### Implemented now

- root-level YAML specifications for Travel Rule and instruction submission
- standalone HTML simulators with `Demo` and `Live API` modes
- reference server with persisted Travel Rule, quote, instruction, status, finality, webhook, and reporting data
- pacs.002-like `execution-status` read surface
- camt.025-like `finality-receipt` read surface
- outbox-backed webhook registration and signed delivery attempts
- reporting family first slice:
  - `reporting/notifications` (`camt.054` analogue)
  - `reporting/intraday` (`camt.052` analogue)
  - `reporting/statements` (`camt.053` analogue)

### Still mocked or partial

- chain lifecycle is still mocked, but now runs through an adapter-backed fee and finality policy
- webhook dispatch is background-driven with persisted retries, but still demo-grade rather than production-hardened
- OpenAPI conformance is incomplete
- delegated signing is intentionally unimplemented
- no testnet execution path exists yet
- no packaged reviewer demo exists yet

### Explicitly deferred

- non-EVM chains
- tokenized assets
- CBDC
- regulated DeFi
- agent-driven submission

## Roadmap

### Phase 0 - Program of record and baseline snapshot
Target window: Q2 2026

Objective:
Lock the repo around the actual execution wedge and make the current baseline legible.

Deliverables:

- roadmap and backlog docs under `docs/`
- README links to the active roadmap and backlog
- current-state summary of implemented, mocked, and deferred surfaces
- initial architecture framing across specs, simulators, reference server, and docs

Success criteria:

- a new reviewer can understand the repo direction in under five minutes
- the project no longer relies on scattered prose to explain what is real

### Phase 1 - Conformance and spec hardening
Target window: Q2 to Q3 2026

Objective:
Move the reference server from “working prototype” to “spec-disciplined implementation.”

Deliverables:

- request validation tied more directly to the OpenAPI specs for implemented endpoints
- response-shape checks for implemented endpoints
- conformance matrix showing `implemented`, `partial`, and `not implemented`
- documented hardening decisions for Travel Rule callback behavior, instruction failure semantics, webhook contract, and reporting-family boundaries

Success criteria:

- runtime behavior and examples do not drift from the YAML
- the repo can state exactly which spec surfaces are implemented in code

### Phase 2 - Chain adapter and lifecycle realism
Target window: Q3 2026

Objective:
Put the mocked lifecycle behind a clean chain-adapter boundary.

Deliverables:

- chain adapter interface around quote realism, broadcast, confirmation depth, and finality
- current deterministic lifecycle refactored into a mock EVM adapter
- fee-estimate model tied to the adapter boundary
- richer finality metadata without changing the existing public read surfaces

Success criteria:

- the mock flow still works end to end
- the API layer can later move to testnet without route redesign

Current status:

- in progress: quote generation, fee estimates, slippage gating, confirmation thresholds, settlement defaults, lifecycle progression, and lifecycle timestamps now run through the injected mock EVM adapter boundary

### Phase 3 - Webhook and event delivery maturity
Target window: Q3 to Q4 2026

Objective:
Turn the existing outbox and delivery model into an operationally credible notification system.

Deliverables:

- background dispatch instead of manual dispatch-only operation
- persisted retry scheduling and attempt counters
- exhausted-delivery handling
- explicit delivery guarantees and limits in docs

Success criteria:

- webhook behavior is credible enough for an institution-facing demo
- push and poll remain aligned to the same canonical objects

Current status:

- in progress: due deliveries can dispatch automatically in the background with persisted retry scheduling, while manual dispatch remains available for testing and operator forcing

### Phase 4 - Reporting family completion
Target window: Q4 2026

Objective:
Complete the first reporting family around the current instruction flow.

Deliverables:

- tighter `camt.052` and `camt.053` semantics for balances, periods, and booked entries
- simulator visibility for statements in live mode
- clearer identifier traceability across instruction, status, finality, and reporting reads

Success criteria:

- a user can trace one payment from instruction submission to booked reporting outputs
- reporting remains institution-facing rather than becoming a block-explorer surrogate

### Phase 5 - Demo package and reviewer kit
Target window: Q1 2027

Objective:
Package the stack into a short, high-credibility demonstration.

Deliverables:

- one polished end-to-end scenario with sample payloads
- sequence diagram and architecture note
- short explanation of what changed from the original proposal once implementation began

Success criteria:

- a standards expert can understand the value in under ten minutes
- the system reads as a coherent reference stack, not a UI mock

### Phase 6 - Deferred expansion
Target window: after Q1 2027

Objective:
Expand only after the narrow wedge is stable and credible.

Candidate areas:

- delegated signing
- exception family: returns, investigations, richer cancellation semantics
- testnet execution
- non-EVM chains
- tokenized assets
- CBDC
- regulated DeFi
- agent-driven submission

Success criteria:

- the current stack remains narrow and defensible
- new family growth happens after the core system is mature
