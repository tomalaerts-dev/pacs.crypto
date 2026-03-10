# pacs.crypto

> *ISO 20022 meets blockchain. pacs.crypto is an open specification family bridging ISO 20022 standards to crypto asset payments — starting with FATF Travel Rule compliance and structured remittance information, built on pacs.008.001.14.*

---

## Vision

ISO 20022 has become the global language of financial messaging. Blockchain payment networks have their own rapidly maturing ecosystem of assets, chains, and compliance requirements. Today, these two worlds speak past each other: banks processing pacs.008 must build custom translation layers to interact with crypto-native VASPs, and structured payment data — remittance information, party identification, purpose codes — is routinely lost at the crypto conversion point.

**pacs.crypto is a proposed family of open API specifications and message standards designed to bridge this gap systematically.** Each specification in the family takes a well-defined ISO 20022 message or component and extends it purposefully for the blockchain context — preserving the data model, field semantics, and regulatory alignment that ISO 20022 provides, while adding the chain identification, token identification, wallet address handling, and bridge transfer support that blockchain payments require.

This first specification addresses what is arguably the most urgent regulatory need: **FATF Travel Rule compliance and structured remittance information for blockchain transfers.** Further specifications in the family — covering areas such as account reporting, payment status, settlement finality notification, and tokenised asset transfers — are a natural next step and explicitly invited as community contributions.

The project is offered as a **community proposal**, not a finished standard. The design decisions are documented and argued, the known limitations are acknowledged honestly, and the ambition is to build something the industry can rally around — collaboratively, in the open.

---

## This release: Travel Rule & Remittance Information API

### What is included

**`travel-rule-api-v3.yaml`** — A full OpenAPI 3.1.0 specification defining endpoints, data model, and behavioural rules for:
- Travel Rule compliance submission (`POST /travel-rule`)
- Record correction after rejection (`PUT /travel-rule/{recordId}`)
- Record retrieval (`GET /travel-rule/{recordId}`)
- Callback acknowledgement by the receiving VASP (`POST /travel-rule/{recordId}/callback`)
- Local record search (`GET /travel-rule/search`)
- Aggregate statistics and reporting (`GET /travel-rule/stats`)

**`travel-rule-simulator-v3.html`** — A self-contained interactive simulator. Open locally in any browser — no server, no dependencies. Covers all six endpoints across ten pre-built scenarios: single-chain B2B transfer, unhosted wallet retail flow, cross-chain USDC bridge, PUT correction after rejection, callback acknowledgement (accepted / rejected / under review), record retrieval, search, and statistics.

---

### Why ISO 20022 alignment matters

The Travel Rule problem is fundamentally an identity data exchange problem between financial institutions. ISO 20022 — specifically pacs.008 — already solves this for conventional payments. Banks have invested heavily in pacs.008 infrastructure. Crypto custodians increasingly serve bank clients. Regulators think in ISO 20022 terms.

Building Travel Rule APIs on proprietary schemas (IVMS101, bespoke JSON) forces a translation layer between the bank's internal data model and the Travel Rule message at every integration point. This API eliminates that translation layer: a bank's existing pacs.008 fields map directly to the Travel Rule submission with no transformation. For VASPs, this simplifies bank client onboarding significantly. For regulators and auditors, it makes the data trail from payment instruction to Travel Rule record semantically continuous.

The API also carries `RemittanceInformation26` — the same structure used in pacs.008 for conventional payments — as an off-chain envelope alongside the on-chain transfer. This solves the structured remittance data loss that currently occurs at the crypto conversion point in B2B payment flows, delivering invoice-level reconciliation detail to the beneficiary's ERP in the same format it would receive from a conventional bank transfer.

---

### Key design decisions

- **pacs.008.001.14 data model** — party identification, account references, agents, remittance information, and regulatory reporting use native ISO 20022 component types and field names throughout
- **Legal Entity Identifier (LEI) for organisation identification** — where parties are legal entities (corporates, financial institutions, VASPs), use of the LEI (ISO 17442) is possible and recommended in all organisation identification fields. The LEI is the only globally unique, publicly verifiable, and jurisdiction-neutral identifier for legal entities, making it the natural fit for cross-border Travel Rule data where counterparties may be unknown to each other. It maps directly to OrganisationIdentification39/lei in the pacs.008 data model.
- **ISO 24165 token and ledger identification** — DTI for tokens, DLI for chains, with contract address as a universally resolvable fallback and an explicit migration path toward full DTI/DLI adoption as registry coverage expands
- **Transport-agnostic** — defines what is exchanged and how the interface is structured, not how parties discover each other or establish a channel; designed to sit alongside TRISA, TRP, and OpenVASP rather than compete with them
- **Layered deployment model** — `debtor_crypto_agent` / `creditor_crypto_agent` fields support bank-as-agent + custodian-as-executor arrangements, allowing banks to discharge their Travel Rule obligation bilaterally without involving custodians in the identity exchange
- **Sanctions compliance by design** — the callback mechanism is strictly scoped to data quality, with explicit prohibition on using any API channel to communicate sanctions findings, grounded in anti-tipping-off obligations under EU AMLD, UK POCA, and US BSA
- **Correction flow** — `correction_of_callback_ref` on PUT requests links a correction to a specific prior rejection for targeted re-validation and self-documenting audit trail
- **Search and reporting** — local record querying and aggregate statistics with ISO 20022 camt.052 / camt.053 / camt.060 analogies

---

### What this specification does not define

Intentionally out of scope, to be addressed at the ecosystem level:

- Counterparty discovery and API endpoint URL resolution (VASP directory / supervisory register)
- Certificate authority model and PKI for mTLS
- Legal and data sharing agreement templates
- Mapping to specific Travel Rule network transports

The specification includes a Deployment Ecosystem section describing what a complete deployment requires, with candidate approaches for each layer.

---

## How to contribute

This project benefits from review by people with operational experience on either side of the bank-VASP boundary, and from people who can see where the family should go next. Specifically welcome:

- **Compliance and legal review** — are the sanctions, tipping-off, and FATF obligation descriptions accurate and complete across jurisdictions?
- **Implementation feedback** — what would break or be missing if you tried to implement this against your current system?
- **ISO 20022 alignment review** — are the pacs.008 component mappings correct and idiomatic? Are there other ISO 20022 messages that should be in scope for the family?
- **Ecosystem proposals** — concrete proposals for the PKI model, directory service, or legal framework layer
- **Next specifications** — proposals for the next member of the pacs.crypto family: account reporting, payment status, tokenised asset settlement notification, CBDC integration, or others
- **Additional scenarios** — new example flows: tokenised securities, stablecoin issuers, regulated DeFi, institutional custody, etc.

Please open an issue or a pull request. Fundamental challenges to the approach are as welcome as incremental improvements.

---

## Author

**Tom Alaerts**
Formerly SWIFT Standards principal specialist.
www.linkedin.com/in/tom-alaerts-60a2981

This project was developed in collaboration with Claude (Anthropic) as an experiment in AI-assisted standards design — exploring how far a well-grounded prompt-based workflow can take a technically demanding specification. The ISO 20022 alignment, design decisions, and compliance framework reflect domain expertise; the AI contributed drafting speed, consistency checking, and the interactive simulator.

---

*Licensed under Apache 2.0. Use freely, contribute generously.*
