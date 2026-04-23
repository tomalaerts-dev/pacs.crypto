# pacs.crypto Roadmap

## Purpose

This is the active post-wedge roadmap for `pacs.crypto`.

The first execution wedge is now complete enough that the next phase is no
longer about proving the mock reference stack. It is about turning the same
stack into a real-chain, reviewer-credible execution system without widening
the API family prematurely.

## Current Defaults

These defaults are locked for the next phase:

- first real execution target: `Ethereum Sepolia`
- first real asset: `USDC on Sepolia`
- first real execution mode: `FULL_CUSTODY`
- primary audience: `Tom-facing reviewer demo`
- implementation seam: chain adapter internals first, route contracts later only if unavoidable

## Baseline As Of April 2026

### Implemented now

- root-level YAML specifications for Travel Rule and instruction submission
- standalone HTML simulators with `Demo` and `Live API` modes
- reference server with persisted Travel Rule, quote, instruction, status, finality, webhook, reporting, and first-slice exception data
- pacs.002-like `execution-status` read surface
- camt.025-like `finality-receipt` read surface
- outbox-backed webhook registration and signed delivery attempts
- reporting family first slice:
  - `reporting/notifications` (`camt.054` analogue)
  - `reporting/intraday` (`camt.052` analogue)
  - `reporting/statements` (`camt.053` analogue)
- exception family first slice:
  - `exceptions/investigations` (`camt.029` analogue)
  - `exceptions/returns` (`pacs.004` analogue)

### Still mocked or partial

- chain lifecycle still runs through a mock adapter rather than real chain execution
- the current reviewer demo is still mock-backed even though the stack itself is executable
- delegated signing remains intentionally unimplemented
- broader exception workflow is still shallow compared with real operator remediation

### Explicitly deferred

- non-EVM chains
- tokenized assets
- CBDC
- regulated DeFi
- agent-driven flows

## Roadmap

### Phase A - Real Sepolia execution
Target window: Q2 to Q3 2026

Objective:
Replace the mocked EVM lifecycle with real Sepolia execution while preserving
the current public API family.

Deliverables:

- real `Sepolia USDC` adapter behind the existing chain-adapter seam
- real transaction submission and tracking for the `FULL_CUSTODY` path
- real tx hash, confirmation depth, and finality receipt population through the current read surfaces
- mock adapter retained as a non-default fallback path for local demo/testing

Success criteria:

- one instruction can progress from submit to real Sepolia tx hash without route redesign
- `execution-status` and `finality-receipt` remain the canonical read models
- reporting, webhooks, and exceptions keep using the same identifiers

Current status:

- in progress: the `sepolia-usdc` adapter is implemented behind the existing adapter seam, read-only mode is available without private key material, and broadcast mode is environment-gated
- remaining: run a funded-wallet Sepolia transaction and capture the resulting tx hash, confirmations, and finality receipt for the reviewer demo

### Phase B - Reviewer demo with real chain evidence
Target window: Q3 2026

Objective:
Turn the reviewer package into a real-chain proof point rather than a strong
mock narrative.

Deliverables:

- one canonical bank-to-VASP walkthrough backed by a real Sepolia transaction
- real-chain sample payload pack with tx hash, confirmations, and finality receipt
- docs and simulator guidance that distinguish `mock demo` from `real-chain demo`

Success criteria:

- a reviewer can inspect one live scenario with real chain evidence in under ten minutes
- the demo strengthens the standards story instead of turning into a generic crypto showcase

### Phase C - Exception handling deepening
Target window: Q3 to Q4 2026

Objective:
Make the current exception-family first slice strong enough for real operator
follow-up on real-chain flows.

Deliverables:

- richer `investigation_case` transitions and operator workflow
- richer `return_case` remediation semantics across off-chain refund and compensating-transfer patterns
- stronger linkage from exception records to real-chain evidence, finality, and reporting consequences

Success criteria:

- real-chain operational follow-up can be tracked without mutating original `FINAL` payments
- exception-family objects remain distinct from execution-status and finality reads

### Phase D - Delegated signing
Target window: Q4 2026 to Q1 2027

Objective:
Add the next real bank/VASP differentiator without widening the corridor.

Deliverables:

- delegated-signing support on the existing instruction family
- unsigned transaction return plus signed transaction resubmission for the Sepolia wedge
- conformance and demo coverage for the delegated path

Success criteria:

- the same corridor supports both `FULL_CUSTODY` and delegated signing
- delegated signing uses the existing family boundaries rather than a new execution model

### Phase E - Broader expansion
Target window: after Q1 2027

Objective:
Expand only after the Sepolia-backed wedge is credible.

Candidate areas:

- non-EVM chains
- tokenized assets
- CBDC
- regulated DeFi
- agent-driven flows

Success criteria:

- the current stack remains narrow and defensible until the real-chain wedge is proven
- broader family growth does not displace the Sepolia execution program
