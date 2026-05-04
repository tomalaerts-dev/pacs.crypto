# pacs.crypto

> *ISO 20022 meets blockchain. pacs.crypto is an open specification family bridging ISO 20022 standards to crypto asset payments, covering FATF Travel Rule compliance, structured payment instructions including returns and reversals as compensating transactions, and blockchain account reporting. All built on ISO 20022 message components.*

---

## Vision

ISO 20022 has become the global language of financial messaging. Blockchain payment networks have their own rapidly maturing ecosystem of assets, chains, and compliance requirements. Today, these two worlds speak past each other: banks processing pacs.008 must build custom translation layers to interact with crypto-native VASPs, and structured payment data — remittance information, party identification, purpose codes — is routinely lost at the crypto conversion point.

**pacs.crypto is a proposed family of open API specifications and message standards designed to bridge this gap systematically.** Each specification in the family takes a well-defined ISO 20022 message or component and extends it purposefully for the blockchain context — preserving the data model, field semantics, and regulatory alignment that ISO 20022 provides, while adding the chain identification, token identification, wallet address handling, and bridge transfer support that blockchain payments require.

The project is offered as a **community proposal**, not a finished standard. The design decisions are documented and argued, the known limitations are acknowledged honestly, and the ambition is to build something the industry can rally around — collaboratively, in the open.

---

## How to read these specifications

The pacs.crypto YAML files are dense OpenAPI 3.1.0 documents. Substantive architectural commentary (sanctions compliance, finality semantics, custody and signing models, returns and reversals framing, push notification patterns) lives in the top-level `info.description` block and uses markdown heading hierarchy. A few practical notes for reviewers:

- For architectural review, [Redoc](https://github.com/Redocly/redoc) and [SwaggerHub](https://swagger.io/tools/swaggerhub/) are the recommended renderers. Both surface the description-block subsections as navigable headings, so the cross-cutting reasoning sits alongside the endpoints and schemas where it belongs. SwaggerUI also works well for interactive testing of request and response shapes.
- Tools optimised for client developers, such as APIDog and Postman, may flatten the description-block content and present only endpoints and schemas. The YAML files remain authoritative regardless of renderer.
- The simulators are entirely self-contained HTML and run in any modern browser without a server, dependency install, or network call. They are intended for first-look familiarisation rather than production testing.

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
- **Search and reporting** — local record querying and aggregate statistics with ISO 20022 camt analogies
- **Token amount precision** — `amount` fields sized to 37 characters (18 integer digits + decimal separator + 18 fractional digits) to accommodate full-precision 18-decimal tokens such as ETH, where 1 ETH = 10^18 Wei. Fiat and stablecoin amounts use standard precision in practice. Amounts represented as decimal strings to avoid IEEE 754 floating-point loss.
- **On-chain credential attestation** — optional `credential_attestation` field carries a reference to an EAS (Ethereum Attestation Service) on-chain compliance attestation, supporting regulated tokenised asset transfers where smart-contract-enforced identity proofs complement the off-chain Travel Rule record

#### What this specification does not define

Intentionally out of scope: counterparty discovery and endpoint URL resolution, certificate authority model and PKI for mTLS, legal and data sharing agreement templates, mapping to specific Travel Rule network transports. The specification includes a Deployment Ecosystem section describing what a complete deployment requires, with candidate approaches for each layer.

---

### Spec 2 — Blockchain Payment Instruction API

**`instruction-api-v1.2.yaml`** — A full OpenAPI 3.1.0 specification allowing a bank or corporate treasury to instruct a VASP to execute a blockchain token transfer on their behalf, in the same way a bank today instructs a correspondent via pacs.008. The instruction carries payment details, Travel Rule identity data, and structured remittance information in a single submission. The VASP handles key management, transaction signing, broadcast, and confirmation reporting. Version 1.2 adds returns and reversals as compensating on-chain transactions (pacs.004 and pacs.007 analogues), an alternative compact signing-hash payload for institutional HSM and MPC contexts, push notification of reversal status, and a sanctions-aware structured rejection vocabulary.

Endpoints covered: pre-execution quote (`POST /instruction/quote`), instruction submission (`POST /instruction`), status and on-chain confirmation retrieval (`GET /instruction/{instructionId}`), instruction cancellation pre-broadcast (`DELETE /instruction/{instructionId}`), signed transaction or signed hash submission for delegated signing (`POST /instruction/{instructionId}/signed-transaction`), payment return as compensating transaction (`POST /instruction/{instructionId}/return`, pacs.004 analogue), payment reversal request (`POST /instruction/{instructionId}/reverse`, pacs.007 analogue), reversal request status retrieval as fallback to push notifications (`GET /instruction/{instructionId}/reversal-status`), and instruction search (`GET /instruction/search`).

**`instruction-simulator-v1.2.html`** — A self-contained interactive simulator covering all endpoints across sixteen pre-built scenarios. The original v1.0 scenarios (B2B USDC full custody, EUR→USDC onramp, Bitcoin retail, delegated signing full transaction format, slippage rejection, cancellation, status tracking) are joined in v1.2 by compact-hash delegated signing demonstrating the VASP-signed cross-check payload, three return scenarios (wrong wallet address `AC01`, post-settlement cancellation `CANC`, regulatory reason `RR04` with the tipping-off discipline made explicit), and three reversal scenarios (fraud `FRAD` with the full request lifecycle and four push notifications, rejection with the sanctions-aware `OTHER` code, and sender withdrawal).

#### Why this spec matters

There is no clean, ISO-aligned way for a bank to instruct a VASP today. This specification fills that gap. It is particularly relevant for smaller banks that wish to offer blockchain payment rails to their corporate clients without building crypto infrastructure internally — the bank sends a familiar pacs.008-structured instruction; the VASP executes on-chain and reports back. The two pacs.crypto specs form a natural stack: VASPs implement the Travel Rule spec; banks that instruct VASPs implement both.

This API is also directly relevant to regulated public blockchain infrastructures such as the [European Blockchain Services Infrastructure (EBSI)](https://ec.europa.eu/digital-building-blocks/sites/display/EBSI/Home) — where banks connecting to an EVM-compatible public chain need a way to instruct on-chain transfers and receive reporting in a language they already understand, taking advantage of the ISO 20022 migration already under way for traditional payments.

#### Key design decisions

- **pacs.008.001.14 data model.** `CreditTransferTransaction73` as the structural foundation; field names, component structures, and semantics preserved throughout.
- **LEI for all organisation identification.** Same convention as the Travel Rule API; VASPs identified by LEI, banks by BIC or LEI.
- **ISO 24165 DTI/DLI.** Bare 9-character values in purpose-built `blockchain_instruction` fields; `DTID/` and `DLID/` prefixes used only in generic ISO 20022 fields (`local_instrument/proprietary`, `settlement_information/clearing_system/proprietary`) where self-description is required.
- **Wallet addresses in `CashAccount40/proxy/EWAL`.** Aligned with the Travel Rule API. `proxy/type/code = EWAL` is the registered ExternalProxyAccountType1Code for electronic wallets and is sufficient by itself to identify a blockchain wallet account; `proxy/identification` carries the wallet address string.
- **Two custody models.** Full custody (VASP holds keys, signs, broadcasts) and delegated signing (bank holds HSM key; VASP returns either a full unsigned transaction or a compact signing hash for the bank to sign and resubmit).
- **Two delegated-signing payload formats.** With `signing_payload_format = FULL_TRANSACTION` (default), the VASP returns the complete unsigned blockchain transaction in wire format and the signing infrastructure constructs the hash internally from the transaction, with full visibility into content. With `signing_payload_format = COMPACT_HASH`, the VASP returns a precomputed signing hash plus VASP-signed cross-check fields (instruction ID, chain DLI, recipient, amount, nonce). The compact format addresses institutional contexts where the signing service signs opaque hashes rather than chain-specific transactions, such as MPC threshold signers, generic hardware wallets, and air-gapped signers. The end-to-end VASP signature over the cross-check payload converts the amount into a non-repudiation commitment: the VASP cannot later argue the hash was for a different transaction or amount. The compact format shifts verification responsibility from the signing service to the bank's application layer, and is appropriate only for trusted-VASP relationships.
- **Multi-chain signing.** `transaction_format` field on the unsigned transaction response covers `RLP_EVM`, `PSBT_BITCOIN`, `SOLANA_TRANSACTION`, `XDR_XRP`, and `OTHER`.
- **On/off-ramp.** Structured `ramp_instruction` object for ONRAMP, OFFRAMP, and ONRAMP_AND_OFFRAMP patterns, complemented by `instruction_for_next_agent` coded routing for ISO 20022-processing intermediaries (`ONRAMP/<LEI>`, `OFFRAMP/<LEI>`).
- **Slippage control.** `maximum_slippage_rate` field; instruction rejected with `SLIPPAGE_EXCEEDED` rather than executed at an unexpected rate.
- **Pre-execution quote.** `POST /instruction/quote` with `fee_lock_type` (`INDICATIVE`, `CAPPED`, `EXACT`) so the instructing party knows what they are committing to before instruction submission.
- **Instruction expiry.** `expiry_date_time` prevents execution at an unexpectedly late time due to chain congestion; recommended windows documented per chain.
- **Idempotency.** `POST /instruction` is idempotent on `end_to_end_identification`. Safe to retry after timeout; 409 returns the original `instruction_id` for tracking.
- **Debit timing transparency.** `debit_timing` on the instruction response (`ON_ACCEPTANCE`, `ON_BROADCAST`, `ON_FINALITY`) so treasury systems can correctly reflect the pending debit.
- **Finality semantics.** `FinalityStatus` enum (`PENDING`, `PROBABILISTIC`, `FINAL`) separate from `confirmation_depth`; chain-specific finality semantics documented (Ethereum checkpoint, Bitcoin 6-conf convention, Solana Tower BFT).
- **Returns and reversals as compensating transactions.** On-chain transactions cannot be reversed once final, so the pacs.crypto remediation model is a compensating transaction in the opposite direction, linked to the original by reference. `POST /instruction/{id}/return` is the receiver-initiated path (pacs.004 analogue, used when the receiver controls the destination wallet and can issue the compensating transfer directly), with reason codes `AC01`, `AC04`, `AM05`, `BE04`, `CANC`, `FRAD`, `RC03`, `RR04`, `TECH`, `NARR`. `POST /instruction/{id}/reverse` is the sender-initiated path (pacs.007 analogue, used when the sender requests the receiving VASP to issue a compensating transfer), with reason codes `DUPL`, `FRAD`, `TECH`, `CUST`, `UPAY`, `CANC`, `NARR`. The original instruction stays at `FINAL` on-chain because the chain itself does not forget; a derived `returned: true` or `reversed: true` flag is set on its record, and a `compensating_instruction_id` reference is added.
- **Reversal request lifecycle is distinct from compensating transaction lifecycle.** A reversal request transitions through `REQUESTED`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`, `COMPLETED`. The compensating transaction, once issued, has its own standard instruction lifecycle (`PENDING`, `BROADCAST`, `CONFIRMING`, `FINAL`). Two parallel state machines run after acceptance.
- **Push notifications for reversal status.** Reversal lifecycles span time periods (the receiver may take minutes, hours, or days to respond, and the compensating transaction has its own settlement window). Polling alone is operationally weak. The receiving VASP pushes `ReversalStatusUpdate` notifications to the sending VASP at every status transition and at compensating-transaction lifecycle progression. Required notification events: initial response, compensating transaction lifecycle, completion. The `webhook_url` field on `ReversalRequest` lets the sender direct push notifications per request. `GET /instruction/{id}/reversal-status` remains available as a fallback for missed pushes, audit reconciliation, and explicit lookups.
- **Sanctions-aware rejection vocabulary.** The structured codes available for rejecting a reversal request (`WALLET_LOST_CONTROL`, `CUSTOMER_REFUSED`, `OPERATIONAL`, `INVESTIGATION_PENDING`, `OTHER`) deliberately omit any regulatory rejection code. There is no `RR04` here: introducing a structured code to express *why* a regulatory action happened creates a tipping-off vocabulary even when the intention is the opposite. `OTHER` is the catch-all that absorbs both routine and undisclosable rejections together; the statistical cover is the discipline. Senders cannot infer that an `OTHER` rejection is sanctions-related, because most `OTHER` rejections in practice are routine.
- **Sanctions compliance by design throughout.** No `COMPLIANCE_HOLD` or `WALLET_SCREENING_FAILED` status. Unexplained `FAILED` responses must be treated as requiring the instructing party's own independent review; the tipping-off prohibition is documented explicitly. The same discipline applies to reversal rejections.
- **On-chain credential attestation.** Optional `credential_attestation` field carried on instruction submission, status response, and compensating transactions. Allows the VASP to verify ERC-3643 compliance attestations pre-execution and preserves the reference through the audit trail.
- **TokenIdentification compatibility.** The Instruction API and camt Reporting API share harmonised field naming (`token_dti`, `chain_dli`, `token_symbol`); the Travel Rule API uses the equivalent `dti`, `contract_chain_id` / `ticker_chain_id`, `ticker` fields. Semantics are identical; see in-spec mapping table.
- **Travel Rule linkage.** `travel_rule_record_id` links the instruction to a pre-submitted Travel Rule record in Spec 1.

#### What this specification does not define

Intentionally out of scope: counterparty discovery, PKI/CA model, legal agreement templates, wallet screening methodology, fiat nostro settlement mechanics for onramp/offramp legs. General instruction-status push notification is supported bilaterally via webhook using the `InstructionStatusResponse` schema; the specification does not mandate a webhook URL convention for general status. Reversal status notification is treated differently in v1.2: the receiving VASP is expected to push `ReversalStatusUpdate` notifications to the sending VASP at every transition, with `webhook_url` settable per request and `GET /reversal-status` available as a fallback. The Travel Rule API callback pattern remains the reference for authentication and retry behaviour.

---

### Spec 3 — Blockchain Account Reporting API

**`camt-crypto-reporting-v1.yaml`** — A full OpenAPI 3.1.0 specification providing ISO 20022-aligned account reporting and notification for blockchain wallet positions held by a VASP on behalf of a bank or corporate treasury. This is the third specification in the pacs.crypto family and the first to be based on the ISO 20022 camt message family rather than pacs.008.

Four reporting functions are defined, each modelled on its ISO 20022 camt counterpart:

| Endpoint | ISO 20022 analogue | Function |
|---|---|---|
| `POST /report/query` | camt.060 | Account reporting query — request a report or notification subscription |
| `GET /report/intraday` | camt.052 | Intraday wallet report — balance snapshot and pending/booked entries |
| `GET /report/statement` | camt.053 | End-of-period wallet statement — booked entries for reconciliation |
| `POST /report/notification/callback` + `GET /report/notification/{id}` | camt.054 | Debit/credit notification — event-driven per-transaction notification with finality confirmation |

Search and aggregate statistics are provided via `GET /report/search` and `GET /report/stats`.

#### Why this spec completes the family

A bank instructing a VASP via Spec 2 needs to monitor the resulting wallet positions and receive booking confirmations in a format its treasury and accounting systems can process directly. Without this, the bank must either build a custom reporting integration against the VASP's proprietary API or poll the instruction status endpoint indefinitely. This spec closes that gap: the VASP reports wallet balances and transaction events in camt-structured format, and the bank's existing camt processing pipeline handles the rest — no new data model required.

#### Key design decisions

- **CashAccount43 alignment** — wallet accounts follow `CashAccount43` as closely as possible; wallet address carried in `identification/proxy/identification` with `proxy/type/code = EWAL`; chain identified via `type/proprietary = DLID/<dli>`, consistent with the `settlement_information` convention in Spec 2
- **Multi-token wallet model** — the account is the wallet address + chain; per-token balances are `WalletBalance` lines (modelled on `CashBalance8`) under the same account, reflecting custodian accounting practice
- **TokenAmount precision** — token amounts carried as decimal strings with up to 18 integer and 18 fractional digits, accommodating full-precision 18-decimal tokens such as ETH/Wei; distinct from ISO 20022 fiat amounts which are capped at 18 digits total
- **Two-layer gas charges** — `gas_detail` carries the chain-native fee breakdown (EVM gas units, base fee, priority fee); `charges_information` carries the fiat-equivalent rollup in ISO 20022 `ChargesInformation` format for treasury accounting systems
- **Two-notification finality pattern** — each on-chain transaction triggers two camt.054 notifications: `ENTRY_PENDING` at broadcast and `ENTRY_FINAL` at finality; `FinalityStatus` (`PENDING` / `PROBABILISTIC` / `FINAL`) and `confirmation_depth` are both carried, serving operations engineers and treasury systems respectively
- **Finality absorbs camt.025 role** — the `ENTRY_FINAL` notification, with `entry_status = BOOK` and `finality_status = FINAL`, serves as the settlement finality confirmation; a separate camt.025 analogue is not needed
- **Full audit chain** — `instruction_id` and `travel_rule_record_id` on every entry link back to Spec 2 and Spec 1 records respectively, enabling end-to-end traceability from payment instruction through Travel Rule record to on-chain settlement to account statement
- **Sanctions compliance by design** — consistent with the rest of the pacs.crypto family; no compliance hold or screening result is communicated via any reporting field
- **On-chain credential attestation** — optional `credential_attestation` field on entries supports regulated tokenised asset transfers; see the Ecosystem section below

#### What this specification does not define

Intentionally out of scope: wallet screening methodology, fiat position valuation methodology (valuation source identified by LEI but valuation model is bilateral), PKI/CA model for webhook delivery authentication, normative webhook retry policy (the Travel Rule API callback pattern is the reference). Statement delivery for large periods may be asynchronous via the `callback_url` mechanism defined in `POST /report/query`.

---

## Ecosystem — how the specifications fit together

The three pacs.crypto specifications form a layered stack covering the full lifecycle of an institutional blockchain payment:

```
┌─────────────────────────────────────────────────────────┐
│  Bank / Corporate Treasury                               │
│  (ISO 20022 native — pacs.008, camt.052/053/054)        │
└────────────┬────────────────────────▲───────────────────┘
             │ Spec 2                 │ Spec 3
             │ Instruction API        │ Account Reporting API
             │ (pacs.008 aligned)     │ (camt aligned)
             │ bank → VASP            │ VASP → bank
             ▼                        │
┌─────────────────────────────────────┴───────────────────┐
│  VASP / Custodian                                        │
│  (executes on-chain, holds keys, reports positions)      │
└────────────┬────────────────────────────────────────────┘
             │ Spec 1
             │ Travel Rule API (pacs.008 aligned)
             │ sending VASP → receiving VASP
             ▼
┌─────────────────────────────────────────────────────────┐
│  Counterparty VASP                                       │
│  (receives Travel Rule identity data)                    │
└─────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│  Blockchain                                              │
│  (settlement layer — Ethereum, Bitcoin, Solana, XRPL…)  │
└─────────────────────────────────────────────────────────┘
```

### Relation to corporate treasury — TCMAG-aligned use

The specifications work unchanged for **corporate-to-bank** flows, not just bank-to-VASP. A corporate treasury submitting a pacs.crypto instruction sits naturally as the ISO 20022 `debtor`, with its relationship bank as the `debtor_agent`. The bank can act as the VASP itself, or forward the instruction to a partner VASP, which then takes the `debtor_crypto_agent` role. pacs.008 supports this multi-agent chain natively (via `previous_instructing_agent_1/2/3` where relevant), so no structural change to the specs is required to accommodate it.

Corporates whose treasury management systems (TMS) or ERP platforms already process pacs.008 and camt.052/053/054 — for example SAP, Kyriba, FIS, and similar — can ingest pacs.crypto API responses through the same pipeline they use for conventional payment reporting. The `ChargesInformation` layer ensures gas costs arrive as standard charge lines ready for accounting treatment without requiring chain-specific parsing. Account reporting via the camt spec delivers wallet positions in a structure TMS systems already understand.

This positioning aligns directly with the principles published by the [Tokenized Cash Management Advisory Group (TCMAG)](https://www.tcmag.org) in April 2026 — in particular the *Integrated* principle (seamless TMS/ERP integration via standard interfaces), *Multi-Bank / Multi-Issuer* (no single-provider dependency), *Accounting Standards* (unambiguous accounting treatment), *Settlement Finality* (explicit `FinalityStatus` semantics), and *Operational Resilience* (structured reversal and cancellation handling via camt.056/029 and `ENTRY_REVERSED`). The pacs.crypto family is offered as a community building block that corporate treasurers, banks, and their technology providers can use to operationalise tokenised cash management on ISO 20022-aligned rails.

A brief comparison to `pain.001` / `pain.002` is worth noting. In traditional payments, `pain.001` is the customer-to-bank initiation message, while `pacs.008` is the bank-to-bank interbank message derived from it. The pacs.crypto Instruction API plays a `pain.001`-equivalent role when used corporate-to-bank, structured on pacs.008 components — a deliberate choice to keep a single dictionary across both deployment patterns rather than split the family into two parallel specifications.

### Relation to on-chain compliance standards — EAS / ERC-3643

For regulated tokenised asset transfers (real-world assets, tokenised securities, regulated stablecoins under MiCA), smart-contract-enforced compliance is increasingly common. The leading framework is **ERC-3643 / T-REX**, used in production by BlackRock BUIDL, ABN AMRO, and Société Générale Forge, combined with **EAS (Ethereum Attestation Service)** for portable compliance attestations.

The EEA's [Shibui project](https://entethalliance.github.io/rnd-rwa-erc3643-eas/) provides a concrete implementation of this approach: KYC and accreditation checks are published as EAS attestations, which ERC-3643 tokens read on-chain to enforce transfer eligibility. GLEIF vLEI and ISO 20022 are explicitly cited as inputs to the attestation schema — making Shibui a natural complement to pacs.crypto at the smart contract layer.

The pacs.crypto family operates at the **API messaging layer** — it governs how institutions communicate instructions, Travel Rule identity data, and account reporting to each other. It does not replace or duplicate on-chain enforcement. The two layers are complementary: the smart contract enforces who may hold or transfer a token on-chain; pacs.crypto governs the off-chain identity exchange and reporting that satisfies regulatory obligations and connects the transaction to the bank's existing payment infrastructure.

To support this combination, all three pacs.crypto specifications include an optional `credential_attestation` field. Where a transfer involves an ERC-3643 or equivalent regulated token, the instructing or reporting party may populate this field with a reference to the relevant EAS attestation — carrying the EAS schema UID, attestation UID, attester wallet address, and chain — creating a verifiable link between the off-chain API record and the on-chain compliance proof. This field is entirely optional and has no effect on the processing of transfers that do not involve regulated token standards.

### Relation to public blockchain infrastructure — EBSI

The [European Blockchain Services Infrastructure (EBSI)](https://ec.europa.eu/digital-building-blocks/sites/display/EBSI/Home) is a pan-European EVM-compatible public blockchain network operated by EU member states and governed by EUROPEUM-EDIC. Its primary focus is cross-border public services and verifiable credentials, but it represents exactly the kind of institutional-grade public chain infrastructure that banks will need to interact with as blockchain payment use cases mature.

Banks connecting to EBSI — or any EVM-compatible chain — via a VASP or gateway can use the pacs.crypto Instruction API to submit transfers and the Account Reporting API to receive wallet position updates, without any new data modelling. The ISO 20022 alignment means the bank's existing payment infrastructure handles both — the VASP or gateway is the only party that needs to speak both pacs.crypto and the chain's native protocol.

---

## Roadmap — where the family goes next

These are areas under active exploration. Contributions, challenges, and alternative proposals are all welcome.

### 1. Agent-driven submission — OpenClaw integration

Personal AI agent platforms such as [OpenClaw](https://openclaw.ai) are emerging as a new kind of user interface to structured APIs — capable of assembling, validating, and dispatching API calls on behalf of a user, from natural language instructions, via any chat application.

All three pacs.crypto APIs are well suited to agent-driven submission. A returning VASP customer — whose identity has already been KYC-verified — could instruct their OpenClaw agent via WhatsApp or Telegram: *"send 0.5 ETH to this address for invoice INV-042"*. The agent, holding the user's verified identity fields in its persistent memory, constructs the full pacs.crypto submission, attaches the structured remittance information, and calls the VASP's API endpoint automatically. The VASP's KYC obligation is unchanged; what changes is the quality and consistency of the data arriving at the API — pre-formatted, correctly structured, with remittance detail already attached.

A reference OpenClaw skill for pacs.crypto submission is planned as a concrete deliverable.

### 2. Further family members under consideration

- **Liquidity Management API.** A separate fifth specification covering own-account flows where the legal account holder is the same on both sides: a bank rebalancing between its own wallets at one VASP, treasury sweeping, in-house banking. The customer-to-customer same-VASP transfer case stays in the Instruction API as a `transfer_type` flag (no Travel Rule firing where the parties are the same VASP's customers). Pooling, sweeping, and netting primitives extend this layer naturally and align with the [TCMAG](https://www.tcmag.org) *Functional Equivalence* principle for tokenised corporate cash management. ISO 20022 already defines these flows for conventional cash (`camt.050` for liquidity transfers, `camt.004` and `camt.005` for account queries, `camt.009` through `camt.015` for limit and standing order management); the work adapts the relevant components for multi-wallet, multi-token positions with settlement finality semantics.
- **Compliance Base Info Reporting API.** A sixth specification providing a canonical record schema for downstream regulatory reporting, audit, and dispute resolution. Captures parties (with LEI/BIC), transfer specifics, Travel Rule data, instruction context, on-chain settlement, credential attestation, sanctions screening flags at the operational level, state-transition timestamps, retention class, and version chain. Pairs with a separate field-by-field mapping document (`mapping-to-esma-mica.md`) showing how pacs.crypto records produce ESMA's published `auth.116`, `auth.117`, and `auth.118` JSON schemas for MiCA reporting. The compliance reporting layer sits underneath the regulator-specific filing pipelines that CASPs already operate; pacs.crypto is well-suited to providing the substrate, less suited to the vertical filing flows themselves where each regulator owns the format.
- **Tokenised asset transfers.** Extensions for regulated tokenised securities, CBDCs, and stablecoin issuers where additional asset-specific fields and regulatory reporting requirements apply. The `credential_attestation` field introduced in the current specs is the foundation for this work.
- **Regulated DeFi.** How the pacs.crypto data model applies when one or both counterparties interact via smart contract rather than a custodial VASP.

### 3. Pre-execution intelligence API — later phase

Stablecoin and blockchain payments at institutional scale require answers to a set of pre-transaction questions that today have no standardised interface: what is the current slippage for this token and amount? What is the realistic gas cost right now? Is the bridge pool sufficiently liquid? What is the current peg deviation of the stablecoin being transacted?

A pre-execution intelligence API surfacing this information in a consistent, chain-agnostic format would complete the picture for institutions using the Instruction API. This is flagged as a **later phase effort** for an honest reason: unlike the other specs in the family, which define data exchanged between regulated parties who generate that data themselves, this API is fundamentally dependent on real-time external data sources — chain RPC nodes, DEX liquidity pool state, oracle feeds, bridge contract state. That introduces infrastructure dependencies and data quality challenges that make it significantly harder to specify well in practice. The right time to tackle this is once the Instruction API has operational experience behind it.

---

## How to contribute

This project benefits from review by people with operational experience across the bank–VASP boundary and corporate treasury boundary, and from people who can see where the family should go next. Specifically welcome:

- **Compliance and legal review** — are the sanctions, tipping-off, and FATF obligation descriptions accurate and complete across jurisdictions?
- **Implementation feedback** — what would break or be missing if you tried to implement any spec against your current system?
- **Corporate treasury / TMS / ERP perspective** — do the specs map cleanly to existing ISO 20022 ingestion in TMS and ERP platforms? What additional fields or flows would make the corporate deployment pattern more operational?
- **ISO 20022 alignment review** — are the pacs.008 and camt component mappings correct and idiomatic? Are there other ISO 20022 messages that should be in scope for the family?
- **Ecosystem proposals** — concrete proposals for the PKI model, directory service, or legal framework layer
- **Next specifications** — proposals for the next family member: tokenised assets, CBDC integration, corporate cash management primitives (pooling, sweeping, netting), regulated DeFi, or others
- **Additional scenarios** — new example flows: tokenised securities, stablecoin issuers, regulated DeFi, institutional custody, delegated signing with HSM, ERC-3643 regulated token transfers, EBSI gateway integration, corporate-to-bank-to-VASP three-party chains

Please open an issue or a pull request. Fundamental challenges to the approach are as welcome as incremental improvements.

---

## Author

**Tom Alaerts**
Formerly SWIFT Standards — ISO 20022 and financial messaging standards
https://www.linkedin.com/in/tom-alaerts-60a2981/

This project was developed in collaboration with Claude (Anthropic) as an experiment in AI-assisted standards design — exploring how far a well-grounded prompt-based workflow can take a technically demanding specification. The ISO 20022 alignment, design decisions, and compliance framework reflect domain expertise; the AI contributed drafting speed, consistency checking, and the interactive simulators.

---

*Licensed under Creative Commons Zero v1.0 Universal (CC0). Use freely, contribute generously.*
