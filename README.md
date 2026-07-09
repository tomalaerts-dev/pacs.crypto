# pacs.crypto

> *ISO 20022 meets blockchain. pacs.crypto is an open specification family bridging ISO 20022 standards to crypto asset payments — covering FATF Travel Rule compliance, structured payment instructions with returns and reversals as compensating transactions, blockchain account reporting, exception and investigation flows, and own-account liquidity management. All built on ISO 20022 message components.*

---

## v1.3 release notes

The v1.3 release of the pacs.crypto family bundles three substantive additions:

- **Optional debtor and creditor agents across the family.** The Instruction and Travel Rule APIs now support corporate self-hosting and corporate-direct flows. Where a corporate operates its own node or holds wallet keys directly, the regulated bank or VASP agent on that side may be absent. The originator and beneficiary parties themselves remain mandatory; the regulatory identity obligation under FATF Recommendation 16 attaches to the parties, not to the agents. The Instruction API also adds a third custody model, `SELF_CUSTODY`, to record transactions the originator has executed itself.
- **Exception and Investigation API (Spec 4).** A new specification supporting post-settlement investigation flows aligned with ISO 20022 camt.110.001.02 (InvestigationRequest) and camt.111.001.03 (InvestigationResponse). The supported investigation types are filtered to those that meaningfully apply on-chain: `UTAP` UnableToApply, `RQFI` RequestForInformation, `RQCH` RequestRelatedToCharges, `ACCT` AccountRelatedInvestigation, and `OTHR` Other. Compliance-flavoured reason codes (`AMLI`, `FCCI`, `FWTR`) are deliberately omitted to avoid creating a tipping-off vocabulary, consistent with the discipline applied across the family.
- **Liquidity Management API (Spec 5).** A new specification covering own-account flows where the legal account holder is the same on both sides of the transfer. Four core operations: wallet-to-wallet transfer (same-chain or cross-chain), wallet position query, and wallet limit query and amendment. Cross-chain transfers use a bridge mechanism chosen by the VASP, with the instructing party expressing only source, destination, amount, and optional preference and slippage bound. Travel Rule data exchange does not apply because the legal holder is the same on both sides.

The family version aligns at v1.3.0 across all five specifications. Travel Rule was previously at v3.5.0 and Account Reporting at v1.0.0 in their separate version trails; v1.3.0 unifies them under the family version. No breaking changes are introduced in the Instruction API: the agent fields move from required to optional, which is a relaxation; existing implementations continue to work unchanged.

---

## Vision

ISO 20022 has become the global language of financial messaging. Blockchain payment networks have their own rapidly maturing ecosystem of assets, chains, and compliance requirements. Today, these two worlds speak past each other: banks processing pacs.008 must build custom translation layers to interact with crypto-native VASPs, and structured payment data — remittance information, party identification, purpose codes — is routinely lost at the crypto conversion point.

**pacs.crypto is a proposed family of open API specifications and message standards designed to bridge this gap systematically.** Each specification in the family takes a well-defined ISO 20022 message or component and extends it purposefully for the blockchain context — preserving the data model, field semantics, and regulatory alignment that ISO 20022 provides, while adding the chain identification, token identification, wallet address handling, and bridge transfer support that blockchain payments require.

The project is offered as a **community proposal**, not a finished standard. The design decisions are documented and argued, the known limitations are acknowledged honestly, and the ambition is to build something the industry can rally around — collaboratively, in the open.

---

## Current Direction

The project is now being taken in a more execution-oriented direction: not just a family of proposal specs, but an **executable reference stack** for a bank-to-VASP blockchain payment flow. The current implementation wedge is intentionally narrow:

- one asset: USDC
- one chain family: EVM
- one corridor: bank → sending VASP → on-chain transfer → receiving VASP
- linked Travel Rule record + remittance information + instruction lifecycle

This repo therefore has two parallel layers:

- **specification layer** — the YAML specs and standalone simulators at the repo root
- **reference implementation layer** — the live server under `reference-server/`

The near-term goal is to prove that the existing specs survive real request validation, persistence, state transitions, and on-chain lifecycle handling before the family expands further.

### Reference Stack Status

The first executable slice lives in `reference-server/` and currently supports:

- Travel Rule submit, update, callback, retrieval, search, and stats
- instruction quote, submission, retrieval, cancellation, and search
- pacs.002-like execution status read endpoints by `instruction_id` and `uetr`
- camt.025-like finality receipt read endpoints by `instruction_id` and `uetr`
- event outbox endpoints that mirror execution-status and finality-receipt payloads for webhook-style delivery
- webhook endpoint registration, signed delivery attempts, and retry logs on top of the outbox
- `camt.054`-like reporting notifications for booked debit and credit entries
- `camt.052`-like intraday movement view built from the reporting notification feed
- `camt.053`-like statement view derived from reporting notifications and instruction context
- first-slice exception-family endpoints for `investigation_case` and `return_case`
- live statement and reporting traceability views in the instruction simulator
- adapter-backed mocked EVM lifecycle progression with amount-aware fee, slippage, and finality modeling:
  `PENDING → BROADCAST → CONFIRMING → FINAL`
- adapter metadata surfaced on quote, instruction, execution-status, and finality reads
- webhook delivery stats and dead-letter reads for exhausted subscription attempts

The two HTML simulators can still run standalone in **Demo** mode, but now also support **Live API** mode against the local reference server.

### Quick Start

There are three reviewer paths, in increasing order of setup:

**1. MOCK demo — no server needed.** Open the presenter-driven Control Room shell straight from the repo root:

- [`bank-to-vasp-control-room.html`](bank-to-vasp-control-room.html) — a guided walkthrough of the happy-path corridor (Travel Rule → settlement → camt.053 statement) with sample payloads bundled into the page. In **MOCK** mode it performs no network call; no reference server or chain is required.

**2. LIVE local API demo — local reference server, no funded chain.** Run the reference server:

```bash
cd reference-server
npm install
npm start
```

Then open either simulator locally (or switch the Control Room shell to its **Live API** mode):

- `travel-rule-simulator-v1.3.html`
- `instruction-simulator-v1.3.html`

Switch **Execution Mode** to `Live API` and keep the default API base URL `http://127.0.0.1:5050`. This runs against the default mock EVM adapter — no funded chain is touched.

**3. Real-chain Sepolia evidence capture — separate funded-wallet path, not run by default.** An explicitly configured funded-wallet run that broadcasts one USDC transfer on Ethereum Sepolia and captures a reviewer evidence bundle. It is not part of the default walkthrough; see [`docs/demo-bank-to-vasp.md`](docs/demo-bank-to-vasp.md).

### Roadmap And Backlog

The active forward plan is now documented in:

- [`docs/roadmap.md`](docs/roadmap.md) — active post-wedge roadmap for real Sepolia execution, reviewer demo, deeper exceptions, and delegated signing
- [`docs/backlog.md`](docs/backlog.md) — prioritized post-wedge backlog with `P0/P1/P2/P3` sequencing
- [`docs/conformance.md`](docs/conformance.md) — current spec-to-server conformance matrix
- [`docs/spec-hardening.md`](docs/spec-hardening.md) — implementation decisions for lifecycle, failure, webhook, and reporting semantics
- [`docs/chain-adapter.md`](docs/chain-adapter.md) — current adapter contract and swap-in boundary for later testnet work
- [`docs/webhook-delivery.md`](docs/webhook-delivery.md) — delivery guarantees, retry model, and dead-letter handling
- [`bank-to-vasp-control-room.html`](bank-to-vasp-control-room.html) — presenter-driven reviewer demo shell (MOCK bundled payloads, or Live API mode against the local server)
- [`docs/demo-bank-to-vasp.md`](docs/demo-bank-to-vasp.md) — reviewer walkthrough, sequence diagram, and live demo script
- [`docs/visual-showcase.html`](docs/visual-showcase.html) — reviewer-facing visual artifact page that keeps the draft PR non-normative
- [`docs/visual-flow-map.md`](docs/visual-flow-map.md) — visual lifecycle map for Travel Rule, instruction, status, returns/reversals, and draft investigation flows
- [`docs/architecture-note.md`](docs/architecture-note.md) — what changed architecturally once the proposal became executable
- [`docs/demo-samples/happy-path/`](docs/demo-samples/happy-path/) — canonical happy-path payload pack
- [`docs/exception-family.md`](docs/exception-family.md) — implemented first-slice exception-family design and runtime boundaries
- [`docs/reference-stack-plan.md`](docs/reference-stack-plan.md) — original pivot plan that led to the current implementation
- [`docs/interop-defi-tradfi.md`](docs/interop-defi-tradfi.md) — DeFi ↔ TradFi interoperability research and new-direction opportunities (2025–2026 landscape)
- [`docs/interop-roadmap.md`](docs/interop-roadmap.md) — horizon-based expansion roadmap built from that research

### Current Baseline

Implemented now:

- executable reference server with persistence, state transitions, and tests
- live simulator support for the Travel Rule and instruction flows
- status, finality, webhook, reporting, and first-slice exception read/write surfaces

Still mocked or partial:

- chain lifecycle remains mocked, but now runs through an adapter-backed fee/finality policy with surfaced adapter metadata
- webhook delivery is background-driven with retries, dead-letter handling, and operator stats, but still demo-grade rather than production-hardened
- spec-covered conformance is explicit and tested, but still hand-authored rather than YAML-generated
- delegated signing is implemented on the mock EVM wedge (instruction held with an unsigned transaction, then resumed on signed-transaction resubmission); `SELF_CUSTODY` is still surface-only
- a first interoperability layer is in place as tested reference components (mock CCTP settlement adapter, IVMS101 Travel Rule mapping, x402 agent-intent binding, Trust Anchor pool-access credentials, multi-regime compliance reporting) — see [`docs/interop-defi-tradfi.md`](docs/interop-defi-tradfi.md)
- spec layer is synced to Tom's v1.3: the server accepts v1.3 `SELF_CUSTODY` and optional debtor/creditor agents, but executes `FULL_CUSTODY` only; Spec 4 (exception & investigation, camt.110/111), the instruction-level returns/reversals endpoints, and Spec 5 (liquidity management) are not yet implemented
- Sepolia adapter path exists, but a funded-wallet live transaction still needs to be run and captured
- reviewer/demo package is now present, but still built around the current mock EVM wedge

Current next defaults:

- first real execution target: `Ethereum Sepolia`
- first real asset: `USDC on Sepolia`
- first real execution mode: `FULL_CUSTODY`
- first real-chain demo audience: Tom-facing reviewer walkthrough

Explicitly deferred:

- non-EVM chains
- tokenized assets
- CBDC
- regulated DeFi
- agent-driven submission

## How to read these specifications

The pacs.crypto YAML files are dense OpenAPI 3.1.0 documents. Substantive architectural commentary (sanctions compliance, finality semantics, custody and signing models, returns and reversals framing, push notification patterns, anti-tipping-off discipline) lives in the top-level `info.description` block and uses markdown heading hierarchy. A few practical notes for reviewers:

- For architectural review, [Redoc](https://github.com/Redocly/redoc) and [SwaggerHub](https://swagger.io/tools/swaggerhub/) are the recommended renderers. Both surface the description-block subsections as navigable headings, so the cross-cutting reasoning sits alongside the endpoints and schemas where it belongs. SwaggerUI also works well for interactive testing of request and response shapes.
- Tools optimised for client developers, such as APIDog and Postman, may flatten the description-block content and present only endpoints and schemas. The YAML files remain authoritative regardless of renderer.
- The simulators are entirely self-contained HTML and run in any modern browser without a server, dependency install, or network call. They are intended for first-look familiarisation rather than production testing.

---

## Released specifications

### Spec 1 — Travel Rule & Remittance Information API

**`travel-rule-api-v1.3.yaml`** — A full OpenAPI 3.1.0 specification defining endpoints, data model, and behavioural rules for FATF Travel Rule compliance and structured remittance information on blockchain payment networks. All data structures are modelled directly on pacs.008.001.14.

Endpoints covered: Travel Rule submission (`POST /travel-rule`), record correction after rejection (`PUT /travel-rule/{recordId}`), record retrieval (`GET /travel-rule/{recordId}`), callback acknowledgement by the receiving VASP (`POST /travel-rule/{recordId}/callback`), local record search (`GET /travel-rule/search`), and aggregate statistics (`GET /travel-rule/stats`).

**`travel-rule-simulator-v1.3.html`** — A self-contained interactive simulator covering all endpoints across pre-built scenarios including the new v1.3 corporate self-hosting flows.

#### Why ISO 20022 alignment matters here

The Travel Rule problem is fundamentally an identity data exchange problem between financial institutions. ISO 20022 — specifically pacs.008 — already solves this for conventional payments. Building Travel Rule APIs on proprietary schemas (IVMS101, bespoke JSON) forces a translation layer at every integration point. This API eliminates that layer: a bank's existing pacs.008 fields map directly to the Travel Rule submission with no transformation. The API also carries `RemittanceInformation26` alongside the on-chain transfer, solving the structured remittance data loss that currently occurs at the crypto conversion point in B2B payment flows.

#### Key design decisions

- **pacs.008.001.14 data model** — party identification, account references, agents, remittance information, and regulatory reporting use native ISO 20022 component types and field names throughout
- **Optional debtor and creditor agents (v1.3)** — the agent fields are now optional to support self-hosting corporates and corporate-direct flows. The originator and beneficiary parties themselves remain mandatory; the FATF Recommendation 16 obligation attaches to the parties, not to the agents
- **Legal Entity Identifier (LEI) for organisation identification** — LEI (ISO 17442) is possible and recommended in all organisation identification fields; maps directly to `OrganisationIdentification39/lei` in pacs.008
- **ISO 24165 token and ledger identification** — DTI for tokens, DLI for chains, with contract address as universally resolvable fallback
- **Transport-agnostic** — defines what is exchanged, not how parties discover each other; sits alongside TRISA, TRP, and OpenVASP rather than competing with them
- **Layered deployment model** — `debtor_crypto_agent` / `creditor_crypto_agent` fields support bank-as-agent + custodian-as-executor arrangements
- **Sanctions compliance by design** — callback mechanism strictly scoped to data quality; explicit prohibition on communicating sanctions findings, grounded in anti-tipping-off obligations under EU AMLD, UK POCA, and US BSA
- **Correction flow** — `correction_of_callback_ref` on PUT requests links a resubmission to a specific prior rejection for targeted re-validation and self-documenting audit trail

#### What this specification does not define

Intentionally out of scope: counterparty discovery and endpoint URL resolution, certificate authority model and PKI for mTLS, legal and data sharing agreement templates, mapping to specific Travel Rule network transports. The specification includes a Deployment Ecosystem section describing what a complete deployment requires, with candidate approaches for each layer.

---

### Spec 2 — Blockchain Payment Instruction API

**`instruction-api-v1.3.yaml`** — A full OpenAPI 3.1.0 specification allowing a bank or corporate treasury to instruct a VASP to execute a blockchain token transfer on their behalf — in the same way a bank today instructs a correspondent via pacs.008. The instruction carries payment details, Travel Rule identity data, and structured remittance information in a single submission. The VASP handles key management, transaction signing, broadcast, and confirmation reporting.

Endpoints covered: pre-execution quote (`POST /instruction/quote`), instruction submission (`POST /instruction`), status and on-chain confirmation retrieval (`GET /instruction/{instructionId}`), instruction cancellation (`DELETE /instruction/{instructionId}`), signed transaction submission for delegated signing (`POST /instruction/{instructionId}/signed-transaction`), return initiation (`POST /instruction/{instructionId}/return`), reversal request (`POST /instruction/{instructionId}/reverse`), reversal status retrieval (`GET /instruction/{instructionId}/reversal-request`), and instruction search (`GET /instruction/search`).

**`instruction-simulator-v1.3.html`** — A self-contained interactive simulator covering all endpoints including the new v1.3 corporate-direct and self-custody scenarios.

#### Flow variants supported in v1.3

The Instruction API is designed for use across several operational configurations without structural change to the data model:

- **Bank to VASP.** The canonical case where a bank instructs its VASP partner.
- **Corporate to VASP.** A corporate treasury instructs a VASP directly, without an intermediating bank. `debtor_agent` is omitted.
- **Corporate to bank.** A corporate instructs its bank for onward processing.
- **Corporate self-custody.** The originator (typically a corporate with its own node) signs and broadcasts the on-chain transaction itself. The Instruction API is not used by the originator in the canonical case — there is no party to instruct. The new `SELF_CUSTODY` value of `custody_model` is provided for the case where the corporate nevertheless uses the API to record the transaction with a partner VASP for reconciliation, audit, or reporting purposes.
- **Receiver self-custody.** The beneficiary controls the receiving wallet directly without a VASP. `creditor_agent` is omitted; the instructing-side flow is otherwise unchanged.

#### Why this spec matters

There is no clean, ISO-aligned way for a bank or corporate to instruct a VASP today. This specification fills that gap. It is particularly relevant for smaller banks that wish to offer blockchain payment rails to their corporate clients without building crypto infrastructure internally — the bank sends a familiar pacs.008-structured instruction; the VASP executes on-chain and reports back. For large corporates with their own treasury operations, the v1.3 corporate-direct and self-custody flows let the same data model serve increasingly disintermediated configurations.

#### Key design decisions

- **pacs.008.001.14 data model** — `CreditTransferTransaction73` as the structural foundation; field names, component structures, and semantics preserved throughout
- **Optional debtor and creditor agents (v1.3)** — supports the flow variants above
- **Three custody models** — `FULL_CUSTODY` (VASP holds keys, signs, broadcasts), `DELEGATED_SIGNING` (instructing party holds HSM key; VASP returns unsigned transaction for instructing party to sign and resubmit), and `SELF_CUSTODY` (originator signs and broadcasts directly, API used for partner-VASP reconciliation only)
- **Multi-chain signing** — `transaction_format` field on the unsigned transaction response covers `RLP_EVM`, `PSBT_BITCOIN`, `SOLANA_TRANSACTION`, `XDR_XRP`, and `OTHER`
- **On/off-ramp** — structured `ramp_instruction` object for ONRAMP / OFFRAMP / ONRAMP_AND_OFFRAMP patterns, complemented by `instruction_for_next_agent` coded routing
- **Slippage control** — `maximum_slippage_rate` field; instruction rejected with `SLIPPAGE_EXCEEDED` rather than executed at an unexpected rate
- **Pre-execution quote** — `POST /instruction/quote` with `fee_lock_type` (`INDICATIVE`, `CAPPED`, `EXACT`)
- **Returns and reversals as compensating transactions** — `POST /instruction/{id}/return` and `/reverse` model post-settlement remediation as a new on-chain transfer rather than an attempt to unwind the original (which is technically impossible on a blockchain). Aligned with pacs.004 (return) and pacs.007 (reversal) semantics. Reversal rejection vocabulary deliberately omits compliance-flavoured codes to avoid tipping-off
- **Finality semantics** — `FinalityStatus` enum (`PENDING`, `PROBABILISTIC`, `FINAL`) separate from `confirmation_depth`
- **Sanctions compliance by design** — no `COMPLIANCE_HOLD` or `WALLET_SCREENING_FAILED` status; unexplained `FAILED` responses must be treated as requiring the instructing party's own independent review
- **Travel Rule linkage** — `travel_rule_record_id` links the instruction to a pre-submitted Travel Rule record in Spec 1

#### What this specification does not define

Intentionally out of scope: counterparty discovery, PKI/CA model, legal agreement templates, wallet screening methodology, fiat nostro settlement mechanics for onramp/offramp legs.

---

### Spec 3 — Blockchain Account Reporting API

**`account-reporting-api-v1.3.yaml`** — A full OpenAPI 3.1.0 specification providing ISO 20022-aligned account reporting and notification for blockchain wallet positions held by a VASP on behalf of a bank or corporate treasury. The third specification in the pacs.crypto family and the first to be based on the ISO 20022 camt message family rather than pacs.008.

Four reporting functions are defined, each modelled on its ISO 20022 camt counterpart:

| Endpoint | ISO 20022 analogue | Function |
|---|---|---|
| `POST /report/query` | camt.060 | Account reporting query — request a report or notification subscription |
| `GET /report/intraday` | camt.052 | Intraday wallet report — balance snapshot and pending/booked entries |
| `GET /report/statement` | camt.053 | End-of-period wallet statement — booked entries for reconciliation |
| `POST /report/notification/callback` + `GET /report/notification/{id}` | camt.054 | Debit/credit notification — event-driven per-transaction notification with finality confirmation |

Search and aggregate statistics are provided via `GET /report/search` and `GET /report/stats`.

**`account-reporting-simulator-v1.3.html`** — A self-contained interactive simulator covering the reporting endpoints.

#### Why this spec completes the bank-VASP-corporate picture

A bank instructing a VASP via Spec 2 needs to monitor the resulting wallet positions and receive booking confirmations in a format its treasury and accounting systems can process directly. Without this, the bank must either build a custom reporting integration against the VASP's proprietary API or poll the instruction status endpoint indefinitely. This spec closes that gap: the VASP reports wallet balances and transaction events in camt-structured format, and the bank's existing camt processing pipeline handles the rest — no new data model required.

#### Key design decisions

- **CashAccount43 alignment** — wallet accounts follow `CashAccount43` as closely as possible; wallet address carried in `identification/proxy/identification` with `proxy/type/code = EWAL`; chain identified via `type/proprietary = DLID/<dli>`
- **Multi-token wallet model** — the account is the wallet address + chain; per-token balances are `WalletBalance` lines (modelled on `CashBalance8`) under the same account
- **TokenAmount precision** — token amounts carried as decimal strings with up to 18 integer and 18 fractional digits, accommodating full-precision 18-decimal tokens such as ETH/Wei
- **Two-layer gas charges** — `gas_detail` carries the chain-native fee breakdown; `charges_information` carries the fiat-equivalent rollup in ISO 20022 `ChargesInformation` format for treasury accounting systems
- **Two-notification finality pattern** — each on-chain transaction triggers two camt.054 notifications: `ENTRY_PENDING` at broadcast and `ENTRY_FINAL` at finality; `FinalityStatus` and `confirmation_depth` are both carried, serving operations engineers and treasury systems respectively
- **Full audit chain** — `instruction_id` and `travel_rule_record_id` on every entry link back to Spec 2 and Spec 1 records respectively, enabling end-to-end traceability

#### What this specification does not define

Intentionally out of scope: wallet screening methodology, fiat position valuation methodology, PKI/CA model for webhook delivery authentication, normative webhook retry policy.

---

### Spec 4 — Exception and Investigation API

**`exception-investigation-api-v1.3.yaml`** — A new fourth specification, introduced in v1.3, providing investigation request and response flows aligned with ISO 20022 camt.110.001.02 (InvestigationRequest) and camt.111.001.03 (InvestigationResponse). The API surface follows modern resource-based conventions: one Investigation resource holds the entire conversation, with subordinate resources for responses and follow-up actions, rather than mirroring the camt request-response message pair one-to-one.

Endpoints covered: investigation creation (`POST /investigation`), retrieval with full lifecycle history (`GET /investigation/{id}`), response submission (`POST /investigation/{id}/response`), follow-up action submission (`POST /investigation/{id}/action` for `RQCL` RequestClosure / `RQST` RequestStatus / `RQOB` RequestObjection), and search (`GET /investigation/search`).

**`ei-simulator-v1.3.html`** — A self-contained interactive simulator covering the five supported investigation types.

#### Supported investigation types — filtered to what applies on-chain

Five types are supported with documented rationale:

- `UTAP` UnableToApplyByCreditor — receiving party received an on-chain credit but cannot match it to a customer or instruction.
- `RQFI` RequestForInformation — generic clarification request, used for Travel Rule supplementation, attestation verification, and bilateral data clarification.
- `RQCH` RequestRelatedToCharges — questions about gas fees, VASP charges, slippage costs.
- `ACCT` AccountRelatedInvestigation — wallet-related questions: status, ownership confirmation post-settlement.
- `OTHR` Other — catch-all with narrative.

#### Investigation types deliberately excluded

Four camt.110 types are out of scope with explicit rationale documented in the spec:

- `CCNR` ClaimNonReceipt and `CONR` CreditorAgentClaimCoverNonReceipt — on-chain settlement is publicly observable via the transaction hash; there is no ambiguity about whether the credit happened.
- `RQVA` RequestValueDateAdjustment — the settlement timestamp is the block timestamp, not retroactively adjustable.
- `RQDA` RequestDebitAuthorisation — on-chain transfers require the wallet holder's signature; debit authorisation does not apply. The compensating-transaction model in the Instruction API handles the analogous flow.
- `RQUF` RequestUseOfFunds — covered by Account Reporting status fields and Instruction API status response.
- `PINC` PaymentInitiationNotConfirmed — covered by the Instruction API's GET endpoint; the on-chain transaction status is publicly verifiable.
- `RIMF` RequestFromIMF — out of scope for the institutional crypto payments market at this stage.

#### Key design decisions

- **camt.110.001.02 / camt.111.001.03 alignment** — the request and response data models reuse the camt structure including `EIR` End-to-end Investigation Reference, `RqstrInvstgtnId` / `RspndrInvstgtnId`, status flow (`PDNG` Pending → `CLSD` Closed or `RJCT` Rejected), and the standard status reason vocabulary
- **Modern API surface, not message-mirror** — one Investigation resource per conversation, with subordinate response and action resources, rather than two parallel request and response endpoints
- **Sanctions compliance by design** — the investigation reason codes `AMLI`, `FCCI`, and `FWTR` are deliberately omitted to avoid creating a tipping-off vocabulary. Where a compliance-related question genuinely needs to be raised, `RQDO` RequestDocumentation with narrative is the recommended path
- **Three proposed crypto-specific reason codes** — `TRSU` TravelRuleSupplement, `WALV` WalletVerification, `ATTR` AttestationRequest, carried as proprietary codes until formally registered with ISO 20022
- **Linkage to other family records** — every investigation references at least one underlying business event via `instruction_reference`, `travel_rule_reference`, or `reporting_reference`

#### What this specification does not define

Intentionally out of scope: the camt.110 scenarios listed above as excluded, with rationale; counterparty discovery; PKI for webhook delivery.

---

### Spec 5 — Liquidity Management API

**`liquidity-management-api-v1.3.yaml`** — A new fifth specification, introduced in v1.3, covering own-account liquidity operations: moving funds between wallets controlled by the same legal account holder, querying wallet positions, and managing operational limits on wallets. Grounded in the ISO 20022 camt family (camt.050 for liquidity transfers, camt.004 / camt.052 for position reporting, camt.009-012 for limits).

Endpoints covered: wallet-to-wallet transfer submission (`POST /wallet-transfer`), transfer status retrieval (`GET /wallet-transfer/{transferId}`), transfer search (`GET /wallet-transfer/search`), wallet position query (`GET /wallet-position`), wallet limit query (`GET /wallet-limit`), and wallet limit amendment (`POST /wallet-limit`).

**`liquidity-simulator-v1.3.html`** — A self-contained interactive simulator covering the four core operations.

#### Defining characteristic — same legal account holder on both sides

The legal account holder is the same on both sides of every Liquidity Management transfer. Two material consequences follow:

1. **FATF Travel Rule does not fire** for internal moves. Recommendation 16 applies to transfers between different originator and beneficiary persons. Where the legal holder is the same, there is no inter-party identity exchange to perform. The pacs.crypto Travel Rule API is not used by Liquidity Management operations. Implementations must still satisfy their own internal controls and reporting obligations, but the inter-institutional Travel Rule transmission is not required.
2. **The instruction surface is simpler.** No counterparty party identification, no remittance information, no purpose code, no charge bearer choice. The instruction carries only what is operationally necessary: source wallet, destination wallet, amount, token, chain, and operational guidance.

Customer-instructed payments — even where the customer is also the institution executing the transfer — are out of scope. Those use the Instruction API with appropriate party identification.

#### Key design decisions

- **camt.050 / camt.004 / camt.052 / camt.009-012 alignment** — the data model reuses ISO 20022 components from the liquidity-management message families
- **Cross-chain bridge mechanism is a VASP responsibility** — the instructing party specifies only source, destination, amount, token, chains, and optional preference (`OPTIMISE_COST`, `OPTIMISE_TIME`, `OPTIMISE_FINALITY`) plus optional `maximum_slippage_rate`. The VASP selects the bridge protocol and routes the transfer. The bridge protocol used, destination transaction hash, bridge-leg cost, and elapsed time are reported back in the status response. This keeps the operation simple for the instructing party and avoids locking the spec into any particular bridge technology
- **Wallet position queries include pending in-flight transfers** — gives the instructing party a true picture of usable liquidity for further operations, distinct from the booked balance
- **Limit basis distinguishes operational, regulatory, and risk limits** — regulatory limits cannot be amended through the API and return 422 if attempted
- **EWAL proxy convention preserved** — wallet identification follows the same `CashAccount40` proxy/EWAL convention as the rest of the family

#### What v1.3.0 does not yet cover

The following are deferred to a future v2.0 of the Liquidity Management API. The v1.3.0 data model is designed to be extended rather than replaced:

- **Pooling** — automated rebalancing across a set of wallets to maintain target balances
- **Sweeping** — automated movement of excess balance from operational wallets to a designated treasury wallet
- **Netting** — between-wallet netting across multiple participants where the participants agree to multilateral net settlement
- **Standing orders** — periodic rebalancing on a schedule
- **Cash concentration across multiple legal entities** — group treasury operations where the legal account holder differs between wallets but the group treasury function spans them

---

## Ecosystem — how the specifications fit together

The five pacs.crypto specifications form a layered stack covering the full lifecycle of an institutional blockchain payment, plus the post-settlement and own-account flows that operationally complete the picture:

```
┌──────────────────────────────────────────────────────────────┐
│  Bank / Corporate Treasury / Self-Hosting Corporate          │
│  (ISO 20022 native — pacs.008, camt.052/053/054, camt.110)   │
└───────┬───────────────────▲───────────▲────────────▲─────────┘
        │ Spec 2            │ Spec 3   │ Spec 4    │ Spec 5
        │ Instruction       │ Account  │ E&I       │ Liquidity
        │ (pacs.008-aligned)│ Reporting│ (camt.110)│ Management
        │ bank→VASP /       │ (camt-   │ post-     │ own-account
        │ corp→VASP /       │ aligned) │ settlement│ wallet-to-
        │ self-custody      │ VASP→bank│ flows     │ wallet
        ▼                   │          │           │
┌───────────────────────────┴──────────┴───────────┴───────────┐
│  VASP / Custodian / Self-Custody Operator                    │
│  (executes on-chain, holds keys, reports positions,          │
│   participates in investigations, handles liquidity ops)     │
└───────┬───────────────────────────────────────────────────────┘
        │ Spec 1
        │ Travel Rule (pacs.008-aligned)
        │ originating party → receiving party
        ▼
┌──────────────────────────────────────────────────────────────┐
│  Counterparty VASP / Self-Hosting Counterparty               │
└──────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│  Blockchain (Ethereum, Bitcoin, Solana, XRPL, Polygon…)      │
└──────────────────────────────────────────────────────────────┘
```

### Relation to corporate treasury — TCMAG-aligned use

The specifications work for bank-to-VASP, corporate-to-VASP, corporate-to-bank, corporate-self-custody, and own-account liquidity flows. With v1.3, a self-hosting corporate that runs its own blockchain infrastructure can use the Travel Rule API to discharge its FATF Recommendation 16 obligations directly, the Instruction API to record its own transactions for reconciliation with partner VASPs (using `SELF_CUSTODY`), and the Liquidity Management API to manage its multi-wallet treasury positions across chains.

Corporates whose treasury management systems (TMS) or ERP platforms already process pacs.008 and camt.052/053/054 — for example SAP, Kyriba, FIS, and similar — can ingest pacs.crypto API responses through the same pipeline they use for conventional payment reporting. The `ChargesInformation` layer ensures gas costs arrive as standard charge lines ready for accounting treatment without requiring chain-specific parsing. Account reporting via the camt-aligned spec delivers wallet positions in a structure TMS systems already understand. Liquidity moves between own wallets pass through the same accounting pipelines as conventional liquidity transfers.

This positioning aligns directly with the principles published by the [Tokenized Cash Management Advisory Group (TCMAG)](https://www.tcmag.org) — in particular the *Integrated* principle (seamless TMS/ERP integration via standard interfaces), *Multi-Bank / Multi-Issuer* (no single-provider dependency), *Accounting Standards* (unambiguous accounting treatment), *Settlement Finality* (explicit `FinalityStatus` semantics), *Functional Equivalence* (tokenised cash management works like conventional cash management), and *Operational Resilience* (structured reversal, cancellation, and investigation handling). The pacs.crypto family is offered as a community building block that corporate treasurers, banks, and their technology providers can use to operationalise tokenised cash management on ISO 20022-aligned rails.

### Relation to on-chain compliance standards — EAS / ERC-3643

For regulated tokenised asset transfers (real-world assets, tokenised securities, regulated stablecoins under MiCA), smart-contract-enforced compliance is increasingly common. The leading framework is **ERC-3643 / T-REX**, used in production by BlackRock BUIDL, ABN AMRO, and Société Générale Forge, combined with **EAS (Ethereum Attestation Service)** for portable compliance attestations.

The EEA's [Shibui project](https://entethalliance.github.io/rnd-rwa-erc3643-eas/) provides a concrete implementation of this approach: KYC and accreditation checks are published as EAS attestations, which ERC-3643 tokens read on-chain to enforce transfer eligibility. GLEIF vLEI and ISO 20022 are explicitly cited as inputs to the attestation schema — making Shibui a natural complement to pacs.crypto at the smart contract layer.

The pacs.crypto family operates at the **API messaging layer** — it governs how institutions communicate instructions, Travel Rule identity data, account reporting, investigation flows, and liquidity moves to each other. It does not replace or duplicate on-chain enforcement. The two layers are complementary: the smart contract enforces who may hold or transfer a token on-chain; pacs.crypto governs the off-chain identity exchange and reporting that satisfies regulatory obligations and connects the transaction to the bank's existing payment infrastructure.

To support this combination, the relevant pacs.crypto specifications include an optional `credential_attestation` field. Where a transfer involves an ERC-3643 or equivalent regulated token, the instructing or reporting party may populate this field with a reference to the relevant EAS attestation. The new Exception and Investigation API includes an `ATTR` AttestationRequest reason code for the post-settlement case where an investigation needs to verify a referenced attestation.

### Relation to public blockchain infrastructure — EBSI

The [European Blockchain Services Infrastructure (EBSI)](https://ec.europa.eu/digital-building-blocks/sites/display/EBSI/Home) is a pan-European EVM-compatible public blockchain network operated by EU member states and governed by EUROPEUM-EDIC. Its primary focus is cross-border public services and verifiable credentials, but it represents exactly the kind of institutional-grade public chain infrastructure that banks will need to interact with as blockchain payment use cases mature.

Banks connecting to EBSI — or any EVM-compatible chain — via a VASP or gateway can use the full pacs.crypto family without any new data modelling. The ISO 20022 alignment means the bank's existing payment infrastructure handles all of it.

---

## Roadmap — where the family goes next

The current implementation roadmap is execution-first and narrow by design. Broader family expansion remains valuable, but the immediate credibility target is to prove one real bank-to-VASP-to-chain corridor end to end.

### 1. Compliance Base Info Reporting API

The next planned specification in the family. A canonical record schema for downstream regulatory reporting, audit, and dispute resolution. Captures parties (with LEI/BIC), transfer specifics, Travel Rule data, instruction context, on-chain settlement, credential attestation, sanctions screening flags at the operational level, state-transition timestamps, retention class, and version chain. Pairs with a separate field-by-field mapping document showing how pacs.crypto records produce ESMA's published `auth.116`, `auth.117`, and `auth.118` JSON schemas for MiCA reporting. The compliance reporting layer sits underneath the regulator-specific filing pipelines that CASPs already operate; pacs.crypto is well-suited to providing the substrate, less suited to the vertical filing flows themselves where each regulator owns the format.

### 2. Liquidity Management API v2.0

The v1.3.0 Liquidity Management spec covers the basic transfer and reporting primitives. The v2.0 evolution extends to pooling, sweeping, netting, standing orders, and cash concentration across multiple legal entities. These are the more sophisticated treasury operations that TCMAG cares about but that benefit from operational experience with the v1.3.0 primitives first.

### 3. Tokenised asset transfers

Extensions for regulated tokenised securities, CBDCs, and stablecoin issuers where additional asset-specific fields and regulatory reporting requirements apply. The `credential_attestation` field introduced in the current specs is the foundation for this work.

### 4. Regulated DeFi

How the pacs.crypto data model applies when one or both counterparties interact via smart contract rather than a custodial VASP.

### 5. Agent-driven submission — OpenClaw integration

Personal AI agent platforms such as [OpenClaw](https://openclaw.ai) are emerging as a new kind of user interface to structured APIs — capable of assembling, validating, and dispatching API calls on behalf of a user, from natural language instructions, via any chat application. All pacs.crypto APIs are well suited to agent-driven submission. A reference OpenClaw skill is planned as a concrete deliverable.

### 6. Pre-execution intelligence API — later phase

Stablecoin and blockchain payments at institutional scale require answers to a set of pre-transaction questions that today have no standardised interface: current slippage, realistic gas cost, bridge liquidity, stablecoin peg deviation. A pre-execution intelligence API surfacing this information in a consistent, chain-agnostic format would complete the picture. Flagged as a later phase effort because it is fundamentally dependent on real-time external data sources (chain RPC, DEX state, oracle feeds), which introduces infrastructure dependencies that make it harder to specify well in practice.

---

## How to contribute

This project benefits from review by people with operational experience across the bank–VASP boundary, the corporate treasury boundary, and the post-settlement investigation and treasury operations layers, and from people who can see where the family should go next. Specifically welcome:

- **Compliance and legal review** — are the sanctions, tipping-off, and FATF obligation descriptions accurate and complete across jurisdictions? Are the deliberate omissions in the E&I reason code subset and the Instruction API rejection vocabulary the right choices?
- **Implementation feedback** — what would break or be missing if you tried to implement any spec against your current system?
- **Corporate treasury / TMS / ERP perspective** — do the specs map cleanly to existing ISO 20022 ingestion in TMS and ERP platforms? Do the new v1.3 corporate-direct and self-custody flows match how large corporates actually operate?
- **ISO 20022 alignment review** — are the pacs.008, camt, and camt.110/111 component mappings correct and idiomatic? Are there other ISO 20022 messages that should be in scope for the family?
- **Bridge ecosystem perspective** — for the Liquidity Management API cross-chain flows, does the VASP-chooses-the-bridge architecture map to operational reality for the major bridge protocols (LayerZero, Wormhole, Stargate, Across, Circle CCTP)?
- **Ecosystem proposals** — concrete proposals for the PKI model, directory service, or legal framework layer
- **Next specifications** — proposals for the next family member: Compliance Base Info Reporting, Liquidity Management v2.0 features, tokenised assets, regulated DeFi
- **Additional scenarios** — new example flows: tokenised securities, stablecoin issuers, regulated DeFi, institutional custody, delegated signing with HSM, ERC-3643 regulated token transfers, EBSI gateway integration, corporate-to-bank-to-VASP three-party chains, multi-bank corporate treasury

Please open an issue or a pull request. Fundamental challenges to the approach are as welcome as incremental improvements.

---

## Author

**Tom Alaerts**
Formerly SWIFT Standards — ISO 20022 and financial messaging standards
https://www.linkedin.com/in/tom-alaerts-60a2981/

This project was developed in collaboration with Claude (Anthropic) as an experiment in AI-assisted standards design — exploring how far a well-grounded prompt-based workflow can take a technically demanding specification. The ISO 20022 alignment, design decisions, and compliance framework reflect domain expertise; the AI contributed drafting speed, consistency checking, and the interactive simulators.

---

*Licensed under Creative Commons Zero v1.0 Universal (CC0). Use freely, contribute generously.*
