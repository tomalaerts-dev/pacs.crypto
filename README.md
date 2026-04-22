# pacs.crypto

> *ISO 20022 meets blockchain. pacs.crypto is an open specification family bridging ISO 20022 standards to crypto asset payments — starting with FATF Travel Rule compliance and structured remittance information, built on pacs.008.001.14.*

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
- adapter-backed mocked EVM lifecycle progression with amount-aware fee, slippage, and finality modeling:
  `PENDING → BROADCAST → CONFIRMING → FINAL`

The two HTML simulators can still run standalone in **Demo** mode, but now also support **Live API** mode against the local reference server.

### Quick Start

Run the reference server:

```bash
cd reference-server
npm install
npm start
```

Then open either simulator locally:

- `travel-rule-simulator-v3.html`
- `instruction-simulator-v1.html`

Switch **Execution Mode** to `Live API` and keep the default API base URL `http://127.0.0.1:5050`.

### Roadmap And Backlog

The active forward plan is now documented in:

- [`docs/roadmap.md`](docs/roadmap.md) — 12-month roadmap for the execution wedge
- [`docs/backlog.md`](docs/backlog.md) — prioritized execution backlog with dependencies and acceptance criteria
- [`docs/conformance.md`](docs/conformance.md) — current spec-to-server conformance matrix
- [`docs/reference-stack-plan.md`](docs/reference-stack-plan.md) — original pivot plan that led to the current implementation

### Current Baseline

Implemented now:

- executable reference server with persistence, state transitions, and tests
- live simulator support for the Travel Rule and instruction flows
- status, finality, webhook, and reporting read surfaces

Still mocked or partial:

- chain lifecycle remains mocked, but now runs through an adapter-backed fee/finality policy
- webhook delivery is background-driven with retries, but still demo-grade rather than production-hardened
- incomplete OpenAPI conformance coverage against the YAML specs
- no delegated signing implementation
- no testnet path yet

Explicitly deferred:

- non-EVM chains
- tokenized assets
- CBDC
- regulated DeFi
- agent-driven submission

---

## Released specifications

### Spec 1 — Travel Rule & Remittance Information API

**`travel-rule-api-v3.yaml`** — A full OpenAPI 3.1.0 specification defining endpoints, data model, and behavioural rules for FATF Travel Rule compliance and structured remittance information on blockchain payment networks. All data structures are modelled directly on pacs.008.001.14.

Endpoints covered: Travel Rule submission (`POST /travel-rule`), record correction after rejection (`PUT /travel-rule/{recordId}`), record retrieval (`GET /travel-rule/{recordId}`), callback acknowledgement by the receiving VASP (`POST /travel-rule/{recordId}/callback`), local record search (`GET /travel-rule/search`), and aggregate statistics (`GET /travel-rule/stats`).

**`travel-rule-simulator-v3.html`** — A self-contained interactive simulator. Open locally in any browser — no server, no dependencies. Covers all six endpoints across ten pre-built scenarios: single-chain B2B transfer, unhosted wallet retail flow, cross-chain USDC bridge, PUT correction after rejection, callback acknowledgement (accepted / rejected / under review), record retrieval, search, and statistics.

#### Why ISO 20022 alignment matters here

The Travel Rule problem is fundamentally an identity data exchange problem between financial institutions. ISO 20022 — specifically pacs.008 — already solves this for conventional payments. Building Travel Rule APIs on proprietary schemas (IVMS101, bespoke JSON) forces a translation layer at every integration point. This API eliminates that layer: a bank's existing pacs.008 fields map directly to the Travel Rule submission with no transformation. The API also carries `RemittanceInformation26` alongside the on-chain transfer, solving the structured remittance data loss that currently occurs at the crypto conversion point in B2B payment flows.

#### Key design decisions

- **pacs.008.001.14 data model** — party identification, account references, agents, remittance information, and regulatory reporting use native ISO 20022 component types and field names throughout
- **Legal Entity Identifier (LEI) for organisation identification** — LEI (ISO 17442) is possible and recommended in all organisation identification fields; maps directly to `OrganisationIdentification39/lei` in pacs.008
- **ISO 24165 token and ledger identification** — DTI for tokens, DLI for chains, with contract address as universally resolvable fallback
- **Transport-agnostic** — defines what is exchanged, not how parties discover each other; sits alongside TRISA, TRP, and OpenVASP rather than competing with them
- **Layered deployment model** — `debtor_crypto_agent` / `creditor_crypto_agent` fields support bank-as-agent + custodian-as-executor arrangements
- **Sanctions compliance by design** — callback mechanism strictly scoped to data quality; explicit prohibition on communicating sanctions findings, grounded in anti-tipping-off obligations under EU AMLD, UK POCA, and US BSA
- **Correction flow** — `correction_of_callback_ref` on PUT requests links a resubmission to a specific prior rejection for targeted re-validation and self-documenting audit trail
- **Search and reporting** — local record querying and aggregate statistics with ISO 20022 camt.052 / camt.053 / camt.060 analogies

#### What this specification does not define

Intentionally out of scope: counterparty discovery and endpoint URL resolution, certificate authority model and PKI for mTLS, legal and data sharing agreement templates, mapping to specific Travel Rule network transports. The specification includes a Deployment Ecosystem section describing what a complete deployment requires, with candidate approaches for each layer.

---

### Spec 2 — Blockchain Payment Instruction API

**`instruction-api-v1.yaml`** — A full OpenAPI 3.1.0 specification allowing a bank or corporate treasury to instruct a VASP to execute a blockchain token transfer on their behalf — in the same way a bank today instructs a correspondent via pacs.008. The instruction carries payment details, Travel Rule identity data, and structured remittance information in a single submission. The VASP handles key management, transaction signing, broadcast, and confirmation reporting.

Endpoints covered: pre-execution quote (`POST /instruction/quote`), instruction submission (`POST /instruction`), status and on-chain confirmation retrieval (`GET /instruction/{instructionId}`), instruction cancellation (`DELETE /instruction/{instructionId}`), signed transaction submission for delegated signing (`POST /instruction/{instructionId}/signed-transaction`), and instruction search (`GET /instruction/search`).

**`instruction-simulator-v1.html`** — A self-contained interactive simulator covering all endpoints and the key scenarios: B2B USDC full custody, EUR→USDC onramp, Bitcoin retail full custody, delegated signing flow, slippage rejection, cancellation, and status tracking through to finality.

#### Why this spec matters

There is no clean, ISO-aligned way for a bank to instruct a VASP today. This specification fills that gap. It is particularly relevant for smaller banks that wish to offer blockchain payment rails to their corporate clients without building crypto infrastructure internally — the bank sends a familiar pacs.008-structured instruction; the VASP executes on-chain and reports back. The two pacs.crypto specs form a natural stack: VASPs implement the Travel Rule spec; banks that instruct VASPs implement both.

#### Key design decisions

- **pacs.008.001.14 data model** — `CreditTransferTransaction73` as the structural foundation; field names, component structures, and semantics preserved throughout
- **LEI for all organisation identification** — same convention as the Travel Rule API; VASPs identified by LEI, banks by BIC or LEI
- **ISO 24165 DTI/DLI** — bare 9-character values in purpose-built `blockchain_instruction` fields; `DTID/` and `DLID/` prefixes used only in generic ISO 20022 fields (`local_instrument/proprietary`, `settlement_information/clearing_system/proprietary`) where self-description is required
- **Wallet addresses in `CashAccount40/proxy/EWAL`** — fully aligned with the Travel Rule API; `proxy/type/code = EWAL`, `proxy/identification` = wallet address string, `type/proprietary = DIGT` for digital asset accounts
- **Two custody models** — full custody (VASP holds keys, signs, broadcasts) and delegated signing (bank holds HSM key; VASP returns unsigned transaction for bank to sign and resubmit)
- **Multi-chain signing** — `transaction_format` field on the unsigned transaction response covers `RLP_EVM`, `PSBT_BITCOIN`, `SOLANA_TRANSACTION`, `XDR_XRP`, and `OTHER`; not just EVM
- **On/off-ramp** — structured `ramp_instruction` object for ONRAMP / OFFRAMP / ONRAMP_AND_OFFRAMP patterns, complemented by `instruction_for_next_agent` coded routing for ISO 20022-processing intermediaries (`ONRAMP/<LEI>`, `OFFRAMP/<LEI>`)
- **Slippage control** — `maximum_slippage_rate` field; instruction rejected with `SLIPPAGE_EXCEEDED` rather than executed at an unexpected rate
- **Pre-execution quote** — `POST /instruction/quote` with `fee_lock_type` (`INDICATIVE`, `CAPPED`, `EXACT`) so the instructing party knows what they are committing to before instruction submission
- **Instruction expiry** — `expiry_date_time` prevents execution at an unexpectedly late time due to chain congestion; recommended windows documented per chain
- **Idempotency** — `POST /instruction` is idempotent on `end_to_end_identification`; safe to retry after timeout; 409 returns the original `instruction_id` for tracking
- **Debit timing transparency** — `debit_timing` on the instruction response (`ON_ACCEPTANCE`, `ON_BROADCAST`, `ON_FINALITY`) so treasury systems can correctly reflect the pending debit
- **Finality semantics** — `FinalityStatus` enum (`PENDING`, `PROBABILISTIC`, `FINAL`) separate from `confirmation_depth`; chain-specific finality semantics documented (Ethereum checkpoint, Bitcoin 6-conf convention, Solana Tower BFT)
- **Sanctions compliance by design** — no `COMPLIANCE_HOLD` or `WALLET_SCREENING_FAILED` status; unexplained `FAILED` responses must be treated as requiring the instructing party's own independent review; tipping-off prohibition documented explicitly
- **Travel Rule linkage** — `travel_rule_record_id` links the instruction to a pre-submitted Travel Rule record in Spec 1

#### What this specification does not define

Intentionally out of scope: counterparty discovery, PKI/CA model, legal agreement templates, wallet screening methodology, fiat nostro settlement mechanics for onramp/offramp legs. Status push notification is supported bilaterally via webhook using the `InstructionStatusResponse` schema; the specification does not define a normative webhook endpoint — see the spec description for the rationale and a pointer to the Travel Rule API callback pattern as a reference.

---

## Roadmap

The current roadmap is execution-first and narrow by design.

Current priority order:

1. conformance and spec hardening
2. chain adapter boundary and lifecycle realism
3. webhook delivery maturity
4. reporting completion and demo packaging

The detailed program of record lives in [`docs/roadmap.md`](docs/roadmap.md) and [`docs/backlog.md`](docs/backlog.md).

### Deferred expansion candidates

These remain intentionally out of the current 12-month wedge:

- delegated signing
- non-EVM chains
- tokenized assets
- CBDC
- regulated DeFi
- agent-driven submission

---

## How to contribute

This project benefits from review by people with operational experience on either side of the bank-VASP boundary, and from people who can see where the family should go next. Specifically welcome:

- **Compliance and legal review** — are the sanctions, tipping-off, and FATF obligation descriptions accurate and complete across jurisdictions?
- **Implementation feedback** — what would break or be missing if you tried to implement either spec against your current system?
- **ISO 20022 alignment review** — are the pacs.008 component mappings correct and idiomatic? Are there other ISO 20022 messages that should be in scope for the family?
- **Ecosystem proposals** — concrete proposals for the PKI model, directory service, or legal framework layer
- **Next specifications** — proposals for the next family member: account reporting, settlement finality notification, tokenised assets, CBDC integration, or others
- **Additional scenarios** — new example flows: tokenised securities, stablecoin issuers, regulated DeFi, institutional custody, delegated signing with HSM, etc.

Please open an issue or a pull request. Fundamental challenges to the approach are as welcome as incremental improvements.

---

## Author

**Tom Alaerts**
Formerly SWIFT Standards — ISO 20022 and financial messaging standards
https://www.linkedin.com/in/tom-alaerts-60a2981/

This project was developed in collaboration with Claude (Anthropic) as an experiment in AI-assisted standards design — exploring how far a well-grounded prompt-based workflow can take a technically demanding specification. The ISO 20022 alignment, design decisions, and compliance framework reflect domain expertise; the AI contributed drafting speed, consistency checking, and the interactive simulators.

---

*Licensed under Creative Commons Zero v1.0 Universal (CC0). Use freely, contribute generously.*
