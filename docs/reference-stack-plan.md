# pacs.crypto Reference Stack Plan

This document captures the original pivot from a specs-only repo to an executable reference stack.

The active program-of-record now lives in:

- [Roadmap](roadmap.md)
- [Backlog](backlog.md)

## Objective

Turn this repo from a strong proposal into a credible reference implementation for one serious bank-to-VASP payment flow.

The goal is not to publish more standards text. The goal is to prove that the existing standards can survive real API behavior, real validation, real state transitions, and real blockchain settlement mechanics.

## Recommended Wedge

Build a narrow "bank instructs VASP" reference stack with:

- one asset: USDC
- one chain family: EVM
- one corridor: bank -> sending VASP -> on-chain transfer -> receiving VASP
- linked Travel Rule record + remittance information + instruction lifecycle
- real API server, real persistence, real contract tests
- mock compliance decisions first, chain integration second

This is the fastest path to something that is both technically credible and strategically impressive.

## What To Build First

### In scope for v0

- `POST /travel-rule`
- `POST /travel-rule/{recordId}/callback`
- `PUT /travel-rule/{recordId}`
- `GET /travel-rule/{recordId}`
- `GET /travel-rule/search`
- `GET /travel-rule/stats`
- `POST /instruction/quote`
- `POST /instruction`
- `GET /instruction/{instructionId}`

### Explicitly out of scope for v0

- multi-chain support
- non-EVM signing flows
- delegated signing
- production PKI and counterparty discovery
- real sanctions screening
- real KYC systems
- network-wide reconciliation
- AI agent submission flows

The first win is not breadth. It is execution quality.

## Technical Position

### Stack

- TypeScript
- Fastify
- OpenAPI-driven request/response validation
- SQLite for local demo persistence
- in-process job scheduler for lifecycle simulation
- chain adapter interface with a mock EVM adapter first

### Why this stack

- TypeScript + Fastify is fast to stand up and easy to keep aligned with OpenAPI.
- SQLite is enough for a serious local reference stack and avoids premature ops work.
- A chain adapter abstraction lets the first version run entirely mocked, then switch to testnet without reworking the API layer.

## Phases

### Phase 1 - Reposition the repo

Deliverables:

- a tightened README framing the repo as an interoperability stack, not just a family of proposals
- this implementation plan
- a backlog of spec hardening issues
- a target repo layout:
  - `specs/`
  - `simulators/`
  - `reference-server/`
  - `conformance/`
  - `docs/`

Success criteria:

- the repo clearly states the primary use case
- the first implementation target is obvious
- non-goals are explicit

### Phase 2 - Reference server skeleton

Deliverables:

- runnable API server
- persistence models for Travel Rule records, callbacks, quotes, and instructions
- endpoint skeletons for the v0 scope
- state machine for Travel Rule and instruction lifecycle
- fixtures for canonical scenarios

Success criteria:

- a user can start the server and execute the end-to-end happy path locally
- the API returns real stored data, not simulator-only fabricated responses

### Phase 3 - Conformance layer

Deliverables:

- contract tests for the supported endpoints
- example payload fixtures
- schema validation tied to the OpenAPI files
- error/status matrix for implemented flows

Success criteria:

- the repo can prove which parts of the spec are implemented
- examples and runtime behavior do not drift

### Phase 4 - Chain realism

Deliverables:

- EVM transaction lifecycle adapter
- fee estimate model
- broadcast simulation moving to testnet integration
- tx hash, confirmation depth, and finality transitions
- webhook/status update mechanism

Success criteria:

- instruction status changes reflect believable chain behavior
- the API can demonstrate quote -> instruction -> broadcast -> confirming -> final

### Phase 5 - Demo package

Deliverables:

- one polished demo scenario
- sequence diagrams
- architecture note describing what changed from the original proposal
- short explanation of where blockchain reality forced sharper design choices

Success criteria:

- a reviewer can understand the value in under ten minutes
- the implementation feels like a serious reference stack, not a UI mock

## Spec Hardening Before Or During Implementation

These should be addressed early because they affect credibility:

- fix lifecycle contradictions in the Travel Rule callback flow
- fix the misplaced health route
- tighten instruction failure semantics around undisclosed `FAILED` cases
- define a minimal webhook contract for instruction status updates
- convert important prose-only conditions into enforceable validation rules
- make simulator behavior match normative schema behavior

## Demo Story To Optimize For

The best demo is:

1. Bank submits Travel Rule record with remittance data.
2. Receiving VASP acknowledges data quality via callback.
3. Bank requests quote for a USDC transfer.
4. Bank submits payment instruction referencing the Travel Rule record.
5. VASP broadcasts on-chain.
6. API progresses from pending to confirming to final.
7. User can inspect both compliance record and settlement result from one coherent stack.

If this works cleanly, the project stops being theoretical.

## Immediate Build Order

1. Create `reference-server/` and choose the server/tooling baseline.
2. Implement Travel Rule state model and storage.
3. Implement instruction quote + submission + status model.
4. Back the HTML simulators with the real server.
5. Add contract tests.
6. Add mock chain adapter.
7. Replace mock chain adapter with testnet integration.

## What Will Actually Impress A Standards Expert

- executable behavior, not more prose
- precise lifecycle handling
- traceability from spec to running system
- honest scoping
- documented reasons where implementation forced spec refinement

The strongest position is: this started as a proposal, and now it behaves like a system.
