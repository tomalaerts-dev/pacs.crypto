# pacs.crypto Backlog

## How To Read This Backlog

- `P0` means current top priority.
- `P1` means next after `P0`.
- `P2` means important but sequenced after the current execution wedge is hardened.
- `P3` means deferred expansion only.

Status values:

- `Done`
- `In progress`
- `Planned`
- `Deferred`

## Baseline Already Landed

These are no longer backlog items; they define the current starting point.

### Foundation stack
Priority: complete
Status: `Done`

- reference server with persisted Travel Rule, quote, instruction, status, finality, webhook, and reporting state
- live simulator support for Travel Rule and instruction flows
- pacs.002-like status reads and camt.025-like finality reads
- outbox-backed webhook subscriptions and signed delivery attempts
- reporting notifications, intraday views, and statements

## Now

### Epic 1 - Program-of-record docs
Priority: `P0`
Status: `Done`
Depends on: current implementation baseline

Work items:

- create and maintain `docs/roadmap.md`
- create and maintain `docs/backlog.md`
- align `README.md` to the execution-first roadmap
- keep a current-state summary of what is real, mocked, and deferred

Acceptance criteria:

- repo-level docs describe the current state without needing code inspection
- roadmap and backlog are treated as the canonical forward plan

### Epic 2 - OpenAPI conformance layer
Priority: `P0`
Status: `Done`
Depends on: existing route and test coverage

Work items:

- validate implemented request payloads against the YAML specs
- add response-shape verification for implemented endpoints
- create a documented conformance matrix for Travel Rule and instruction surfaces
- mark unsupported features explicitly, including delegated signing

Acceptance criteria:

- every implemented endpoint is either conformant, partial, or explicitly out of scope
- spec examples and runtime behavior do not drift silently

### Epic 3 - Spec hardening decisions
Priority: `P0`
Status: `Done`
Depends on: OpenAPI review and current route behavior

Work items:

- formalize Travel Rule callback lifecycle rules
- formalize terminal instruction failure semantics
- formalize webhook event contract and canonical payload usage
- formalize reporting-family boundaries and identifiers
- publish the current decision record in `docs/spec-hardening.md`

Acceptance criteria:

- major behavioral rules are documented, not left implicit in code
- the repo can explain where implementation sharpened the original proposal

## Next

### Epic 4 - Chain adapter abstraction
Priority: `P1`
Status: `Done`
Depends on: stable status and finality response shapes

Work items:

- introduce a chain adapter interface for quote realism, broadcast, confirmation depth, and finality
- move the deterministic lifecycle progression into a mock EVM adapter
- deepen the mock adapter with amount-aware fee, slippage, and confirmation policy
- expose adapter-derived lifecycle metadata without changing current public routes

Acceptance criteria:

- route handlers no longer own lifecycle simulation logic directly
- later testnet work can plug into the adapter boundary

### Epic 5 - Webhook delivery maturity
Priority: `P1`
Status: `Done`
Depends on: current outbox and webhook delivery persistence

Work items:

- add background dispatch
- persist retry schedule and next-attempt timestamps
- add exhausted-delivery handling
- document delivery guarantees and operational limits

Acceptance criteria:

- webhook delivery behaves like a real outbound notification subsystem
- polling and push remain schema-aligned

### Epic 6 - Reporting polish and traceability
Priority: `P1`
Status: `Done`
Depends on: current reporting endpoints

Work items:

- tighten statement period semantics and booked-entry derivation
- add statement visibility to simulator live mode
- improve traceability from reporting objects back to `instruction_id`, `uetr`, tx hash, and Travel Rule references where available

Acceptance criteria:

- one payment can be followed cleanly from instruction submission to reporting outputs
- reporting stays institution-facing and internally coherent

## Later

### Epic 7 - Demo package
Priority: `P2`
Status: `Done`
Depends on: conformance layer, chain adapter boundary, webhook maturity

Work items:

- produce one polished bank-to-VASP demo scenario
- add sequence diagram and architecture note
- add sample payload pack for the happy path

Acceptance criteria:

- a reviewer can understand the system quickly without reading the whole codebase
- the demo reinforces implementation credibility rather than adding more speculative scope

### Epic 8 - Exception-family design
Priority: `P2`
Status: `Planned`
Depends on: stable lifecycle and identifier semantics

Work items:

- define pre-broadcast cancellation boundaries versus post-settlement remediation
- outline return, investigation, and richer exception-case objects
- decide which exception behavior stays in current APIs and which becomes a new family

Acceptance criteria:

- exception handling is decision-ready before implementation starts
- blockchain irreversibility is reflected honestly in the design

## Deferred

### Epic 9 - Broader family expansion
Priority: `P3`
Status: `Deferred`
Depends on: completion of the current wedge

Deferred items:

- delegated signing
- testnet execution
- non-EVM chains
- tokenized assets
- CBDC
- regulated DeFi
- agent-driven submission

Rule:

- none of these start before conformance, chain abstraction, webhook maturity, and demo packaging are complete
