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

### Epic 10A - Execution safety and evidence hardening
Priority: `P0`
Status: `Implemented - pending funded validation`
Depends on: completed chain-adapter boundary

Work items:

- make real broadcast an explicit single-writer operation rather than a side
  effect of read/search/reporting paths
- prevent duplicate Sepolia transfers under concurrent polling or duplicate
  lifecycle advancement
- enforce the narrow live corridor before transfer:
  - debtor wallet must match the configured signing/source wallet
  - chain must be Sepolia DLI
  - token must be USDC DTI/symbol
  - settlement currency must be USD
- verify ERC-20 `Transfer` logs before claiming correct final settlement
- fix debtor-side reporting so a debit observed at `BROADCAST` cannot stay
  permanently pending after the instruction reaches `FINAL`
- emit reporting balances with unsigned amounts plus credit/debit indicators
- harden preflight and demo evidence generation so failed or non-final runs
  cannot be packaged as reviewer proof
- correct USDC token identifiers in demo tooling and sample evidence

Current status:

- implemented: submit-only live broadcast boundary, concurrency/idempotency guard,
  Sepolia corridor checks, ERC-20 transfer-log verification, debtor reporting
  upgrade, unsigned balance evidence, and demo/preflight failure gates
- automated Sepolia lifecycle coverage uses injected provider/signer stubs and
  now checks transfer-log evidence, but still does not prove funded safety
- real funded-wallet broadcast is ready for controlled validation once
  credentials, funds, and a recipient wallet are configured

Acceptance criteria:

- no `GET`, search, reporting, duplicate-check, or list path can submit a real
  transaction
- concurrent polling cannot produce duplicate broadcasts for the same
  instruction
- the adapter rejects source/debtor mismatch, wrong chain, wrong token, and
  wrong settlement currency before transfer
- finality receipt verifies the ERC-20 transfer log for token contract, sender,
  recipient, and amount
- debtor reporting upgrades from pending to booked after final settlement
- preflight fails when configured funds are insufficient for the demo amount
- demo runner exits non-zero unless execution status and finality are both
  `FINAL`

### Epic 10 - Testnet execution
Priority: `P1`
Status: `Ready for funded validation`
Depends on: Epic 10A

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
- live execution is unblocked from the Epic 10A safety review perspective
- real funded-wallet broadcast still needs to be run and captured (one human-authorised, funded action)
- the funded-run acceptance is now ENCODED as a gated integration test (`test/sepolia-funded.integration.test.js`): it submits a real instruction, polls to `FINAL`, and asserts a real on-chain tx hash the moment `REF_SERVER_SEPOLIA_FUNDED_TEST=1` and the `REF_SERVER_SEPOLIA_*` credentials are present (skips cleanly otherwise)

Acceptance criteria:

- one instruction can produce a real Sepolia transaction hash through the existing instruction flow
- `execution-status` and `finality-receipt` are populated from real chain state without route redesign
- the same identifiers still join instruction, webhook, reporting, and exception records
- the mock adapter remains available as a fallback/demo path

## Next

### Epic 11 - Demo with real chain evidence
Priority: `P1`
Status: `Planned`
Depends on: Epic 10A and Epic 10

Work items:

- update the reviewer walkthrough so one canonical scenario runs against the Sepolia adapter
- publish one sample path with real tx hash, real confirmations, and real finality receipt output
- distinguish clearly between `mock demo` and `real-chain demo` in docs and simulator guidance
- keep the narrative optimized for Tom review rather than public platform packaging

Current status:

- real-chain demo runner and preflight scripts are in place for the funded-wallet path
- reviewer-summary generation is now scripted so a captured run can be turned into a Tom-facing markdown evidence pack immediately
- reviewer evidence generation must not be used for a funded run until Epic 10A is complete
- the real-chain happy path is encoded as a gated integration test (see Epic 10); the reviewer evidence bundle is produced by `npm run demo:sepolia` once a funded run is authorised

Acceptance criteria:

- a reviewer can follow one bank-to-VASP happy path backed by a real Sepolia transaction
- the live demo materials show real chain evidence without changing the message-family story
- the repo no longer describes testnet execution as absent once Epic 10 is done

### Epic 12 - Deepen exception handling
Priority: `P1`
Status: `In progress`
Depends on: Epic 10A and Epic 10 for real-chain evidence linkage

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
Status: `Implemented`
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
- the DeFi ↔ TradFi interoperability expansion of these coarse items is detailed in Epics 15–24 below and sequenced in [`interop-roadmap.md`](interop-roadmap.md)

## Interoperability Directions (DeFi ↔ TradFi)

These epics come from the interoperability research in
[`interop-defi-tradfi.md`](interop-defi-tradfi.md) and are sequenced by horizon in
[`interop-roadmap.md`](interop-roadmap.md). They remain `P3` (post-wedge expansion),
but Epics 15–23 now have **reference slices implemented and tested** in
`reference-server/`: additive validators (vLEI / settlement_transport / ERC-7943
attestation / DTI-first), the selectable mock CCTP adapter, delegated signing, and
the `src/interop/` modules for IVMS101, x402, Trust Anchor access, and multi-regime
compliance reporting — proving each direction at the messaging layer without
widening the executed corridor. Epic 24 stays deferred behind its external gate.
The `Horizon` tag marks how cheaply each can be pulled forward (H0 = low-cost,
additive; H3 = long-horizon, externally gated). Each maps to an opportunity
`O1`–`O10` from the research note.

### Epic 15 - DTI-first identifier hardening
Priority: `P3`
Status: `Implemented (reference slice)`
Horizon: H0 · Opportunity: O10

Work items:

- make ISO 24165 DTI the primary, recommended-mandatory asset identifier across the family
- document DTI-registry (DTIF) resolution and the contract-address fallback ordering
- keep changes additive so existing `token_dti` / `chain_dli` usage is unaffected

Acceptance criteria:

- specs and reference server treat DTI as the canonical asset key, aligned to the ESMA/MiCA mandate
- no breaking change to existing implementations

### Epic 16 - vLEI verifiable organisational identity
Priority: `P3`
Status: `Implemented (reference slice)`
Horizon: H0 (spec) / H1 (runtime) · Opportunity: O3

Work items:

- reserve optional `vlei_credential` fields wherever LEI appears (parties, agents) and a wallet-to-vLEI binding reference
- add reference-server verification of presented vLEI credentials on submission and surfacing on reads
- keep all fields optional and off-chain-data-minimising

Acceptance criteria:

- a counterparty's organisational identity can be computationally verified without putting sensitive data on-chain
- LEI-only flows continue to validate unchanged

### Epic 17 - Settlement-transport abstraction
Priority: `P3`
Status: `Implemented (reference slice)`
Horizon: H1 · Opportunity: O1

Work items:

- define a `settlement_transport` profile (direct-EVM / Circle CCTP / Chainlink CCIP-CRE / Canton) on the instruction
- keep the instruction data model unchanged across transports
- document pacs.crypto's position as the open API layer above the transport, not a competing bridge

Acceptance criteria:

- one instruction can name different transports without data-model change
- transport choice never alters identity, Travel Rule, or reporting semantics

### Epic 18 - Cross-chain reference-stack adapters (CCTP + Canton)
Priority: `P3`
Status: `Implemented (reference slice)`
Horizon: H1 · Opportunity: O8
Depends on: Epic 10 (chain-adapter seam), Epic 17

Work items:

- implement a Circle CCTP V2 adapter (cross-chain USDC) behind the existing chain-adapter contract
- implement a Canton / deposit-token settlement adapter as a second venue
- keep route shapes and identifiers unchanged; surface venue context through `adapter_metadata`

Acceptance criteria:

- one instruction settles through at least two distinct transports unchanged
- the mock adapter remains the default fallback

### Epic 19 - Travel Rule interoperability conformance layer
Priority: `P3`
Status: `Implemented (reference slice)`
Horizon: H1 · Opportunity: O9

Work items:

- publish field-level mappings from Spec 1 to TRISA, TRP, and IVMS101
- build a conformance harness that round-trips a Spec 1 record to/from at least one external transport
- keep pacs.crypto positioned alongside (not competing with) existing Travel Rule networks

Acceptance criteria:

- a Spec 1 record round-trips to/from at least one external Travel Rule transport in test
- mapping gaps are documented rather than silently dropped

### Epic 20 - Tokenised-asset / RWA transfer spec
Priority: `P3`
Status: `Implemented (reference slice)`
Horizon: H2 · Opportunity: O2

Work items:

- promote the deferred "tokenised assets" item into instruction + reporting surfaces for regulated tokenised securities / RWAs
- extend `credential_attestation` to carry ERC-7943 enforcement context and ERC-3643 identity-registry references
- keep sanctions/tipping-off discipline intact

Acceptance criteria:

- a tokenised-RWA transfer carries enforcement and identity-registry references end-to-end
- non-RWA flows are unaffected

### Epic 21 - Trust Anchor / regulated-DeFi access profile
Priority: `P3`
Status: `Implemented (reference slice)`
Horizon: H2 · Opportunity: O4

Work items:

- define how a bank/VASP issues and a permissioned pool verifies an access credential built from pacs.crypto identity data (LEI/vLEI + Travel Rule + screening posture)
- model the Project Guardian "Trust Anchor" pattern at the messaging layer only
- explicitly prohibit communicating sanctions findings or adjudication on-chain

Acceptance criteria:

- a permissioned-pool eligibility credential can be issued and verified without leaking sanctions reasoning
- the profile asserts eligibility only and performs no on-chain compliance enforcement

### Epic 22 - Multi-regime compliance-reporting substrate
Priority: `P3`
Status: `Implemented (reference slice)`
Horizon: H2 · Opportunity: O7

Work items:

- build the planned Compliance Base Info Reporting spec as a regime-aware canonical record
- emit MiCA `auth.116/117/118` and analogous filings under other regimes (GENIUS, MAS) from one substrate
- keep the substrate underneath regulator-specific filing pipelines rather than owning the vertical filing flows

Acceptance criteria:

- one canonical record can produce at least two regime-specific outputs
- incompatibilities between regimes are represented as data, not lost

### Epic 23 - Agentic-payment settlement binding
Priority: `P3`
Status: `Implemented (reference slice)`
Horizon: H2 · Opportunity: O5

Work items:

- define the mapping from an agent payment intent (x402 / AP2 / MPP) to a compliant pacs.crypto instruction
- pre-resolve identity fields from the agent's verified principal and attach Travel Rule + structured remittance
- position pacs.crypto as the regulated settlement + Travel Rule leg behind machine micropayments

Acceptance criteria:

- one agent intent produces a fully-structured instruction; the Travel Rule leg is surfaced as a required-but-not-derivable warning rather than fabricated
- the binding adds no new custody or sanctions-adjudication responsibility to the agent layer

### Epic 24 - Unified-ledger / tokenised-deposit / CBDC interop profile
Priority: `P3`
Status: `Reference scaffold (external gate not cleared)`
Horizon: H3 · Opportunity: O6
Depends on: external maturity — gate on BIS Agorá outcomes and tokenised-deposit production rollouts

Work items:

- define a bank-edge messaging profile that expresses "simultaneous compliance" as structured pre-settlement data for tokenised-deposit and wholesale-CBDC corridors
- map pacs.crypto pre-settlement data onto an Agorá-style simultaneous AML/sanctions/settlement flow
- treat this as the longest-horizon, highest-ceiling direction

Acceptance criteria:

- a credible mapping exists from pacs.crypto pre-settlement data to an Agorá-style simultaneous flow, validated against published Agorá outcomes
- no build effort is committed before the external gate is cleared
