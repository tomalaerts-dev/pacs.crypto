# pacs.crypto Backlog

## How To Read This Backlog

- `P0` means current top priority.
- `P1` means next after `P0`.
- `P2` means important but sequenced after the current real-chain wedge is proven.
- `P3` means deferred expansion only.

Status values:

- `Done`
- `In progress`
- `Planned`
- `Deferred`

## Baseline Already Landed

These are the completed foundations for the next phase.

### Foundation stack
Priority: complete
Status: `Done`

- reference server with persisted Travel Rule, quote, instruction, status, finality, webhook, reporting, and first-slice exception state
- live simulator support for Travel Rule and instruction flows
- pacs.002-like status reads and camt.025-like finality reads
- outbox-backed webhook subscriptions, retries, dead-letter handling, and signed delivery attempts
- reporting notifications, intraday views, and statements
- root `/report/*` pull routes now emit camt-style wrappers on top of the internal reporting records
- first-slice `investigation_case` and `return_case` runtime surfaces
- reviewer demo package, architecture note, and sample payload pack

## Active Defaults

These defaults are now part of the backlog, not open questions:

- first real execution target: `Ethereum Sepolia`
- first real asset: `USDC on Sepolia`
- first real execution mode: `FULL_CUSTODY`
- primary audience: `Tom-facing reviewer demo`
- implementation seam: replace adapter internals before changing public routes
- current public status/finality/reporting/exception surfaces remain canonical

## Now

### Epic 10 - Testnet execution
Priority: `P0`
Status: `In progress`
Depends on: completed chain-adapter boundary

Work items:

- implement a real `Sepolia USDC` adapter behind the existing chain-adapter contract
- keep `POST /instruction`, `GET /execution-status`, and `GET /finality-receipt` route shapes unchanged
- replace mock broadcast/finality state with real transaction submission, tracking, and confirmation reads
- surface real execution context through existing `adapter_metadata`
- keep the first live path restricted to `FULL_CUSTODY`

Current status:

- `sepolia-usdc` adapter exists and is opt-in by environment
- mock adapter remains default
- read-only Sepolia mode is covered by tests
- happy-path Sepolia broadcast, confirmation, and reporting linkage are now covered in automated tests through injected provider/signer stubs
- incomplete broadcast configuration fails safely
- wrong-network RPC configuration now fails safely
- preflight and demo-run scripts now exist for the funded-wallet path
- real funded-wallet broadcast still needs to be run and captured

Acceptance criteria:

- one instruction can produce a real Sepolia transaction hash through the existing instruction flow
- `execution-status` and `finality-receipt` are populated from real chain state without route redesign
- the same identifiers still join instruction, webhook, reporting, and exception records
- the mock adapter remains available as a fallback/demo path

## Next

### Epic 11 - Demo with real chain evidence
Priority: `P1`
Status: `Planned`
Depends on: Epic 10

Work items:

- update the reviewer walkthrough so one canonical scenario runs against the Sepolia adapter
- publish one sample path with real tx hash, real confirmations, and real finality receipt output
- distinguish clearly between `mock demo` and `real-chain demo` in docs and simulator guidance
- keep the narrative optimized for Tom review rather than public platform packaging

Current status:

- real-chain demo runner and preflight scripts are in place for the funded-wallet path
- reviewer-summary generation is now scripted so a captured run can be turned into a Tom-facing markdown evidence pack immediately

Acceptance criteria:

- a reviewer can follow one bank-to-VASP happy path backed by a real Sepolia transaction
- the live demo materials show real chain evidence without changing the message-family story
- the repo no longer describes testnet execution as absent once Epic 10 is done

### Epic 12 - Deepen exception handling
Priority: `P1`
Status: `In progress`
Depends on: Epic 10

Work items:

- deepen `investigation_case` statuses, transitions, and operator workflow
- deepen `return_case` remediation semantics around real-chain versus off-chain outcomes
- tighten linkage from exception objects to real-chain evidence and reporting consequences
- keep bilateral cancellation deferred unless real operator flow proves it is necessary

Current status:

- investigation cases now enforce explicit lifecycle transitions and closure requirements
- return cases now enforce method-specific settlement evidence for on-chain versus off-chain remediation
- both exception families can now link directly to specific reporting notifications and statements for the same instruction

Acceptance criteria:

- investigation and return cases can model post-settlement follow-up against real-chain outcomes
- original instruction and finality records remain authoritative and are not overwritten
- exception workflow remains a separate family rather than leaking into execution-state surfaces

## Later

### Epic 13 - Delegated signing
Priority: `P2`
Status: `Planned`
Depends on: Epic 10 and Epic 11

Work items:

- implement the currently stubbed delegated-signing path on the existing instruction family
- keep the first delegated flow EVM-only and aligned to the Sepolia wedge
- support unsigned transaction return plus signed transaction resubmission without inventing a parallel API family
- update conformance docs and demo materials once the flow is credible

Acceptance criteria:

- delegated signing works on the same instruction lifecycle and status/finality surfaces
- the bank/VASP split is credible for the existing corridor
- the flow remains narrower than a general multi-chain signing framework

## Deferred

### Epic 14 - Broader expansion
Priority: `P3`
Status: `Deferred`
Depends on: completion of Epics 10 through 13

Deferred items:

- non-EVM chains
- tokenized assets
- CBDC
- regulated DeFi
- agent-driven flows

Rule:

- none of these start before real Sepolia execution, real-chain reviewer demo, deeper exception handling, and delegated signing are either implemented or explicitly superseded
