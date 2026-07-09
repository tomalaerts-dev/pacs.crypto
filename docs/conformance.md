# pacs.crypto Conformance Matrix

This matrix tracks how the current `reference-server/` aligns with the root OpenAPI specifications.

Status meanings:

- `Implemented` means the current server exposes the spec-covered route and the request/response shape is intentionally aligned for the current wedge.
- `Partial` means the route exists, but the behavior or wire shape still diverges from the spec in a documented way.
- `Out of scope` means the route exists in the spec but is intentionally not implemented in the current wedge.
- `Extension` means the route exists in the reference server but is not defined in the current root YAML specs.

## Spec-covered surfaces

| Endpoint | Spec | Request schema | Response schema | Status | Notes |
|---|---|---|---|---|---|
| `POST /travel-rule` | `travel-rule-api-v1.3.yaml` | `TravelRuleSubmission` | `TravelRuleRecord` | Implemented | Request validation now enforces the main required pacs.008-style objects used in the current wedge. |
| `GET /travel-rule/{recordId}` | `travel-rule-api-v1.3.yaml` | n/a | `TravelRuleRecord` | Implemented | Returns the persisted compliance record. |
| `PUT /travel-rule/{recordId}` | `travel-rule-api-v1.3.yaml` | `TravelRuleSubmission` | `TravelRuleRecord` | Implemented | Correction flow remains tied to the current record lifecycle model. |
| `POST /travel-rule/{recordId}/callback` | `travel-rule-api-v1.3.yaml` | `TravelRuleCallback` | `TravelRuleCallbackReceipt` | Implemented | Request validation follows the callback schema and the route now returns the receipt object defined in the spec. |
| `GET /travel-rule/search` | `travel-rule-api-v1.3.yaml` | query params | `TravelRuleSearchResponse` | Implemented | Query validation now covers the spec-defined filter set used in the current server, including direction, status, callback status, currency, wallets, pagination, and sort. |
| `GET /travel-rule/stats` | `travel-rule-api-v1.3.yaml` | query params | `TravelRuleStatsResponse` | Implemented | Stats envelope and aggregate totals are present for the current local dataset. |
| `POST /instruction/quote` | `instruction-api-v1.3.yaml` | `QuoteRequest` | `QuoteResponse` | Implemented | Request validation now enforces token, DLI, amount, currency, and custody model fields. |
| `POST /instruction` | `instruction-api-v1.3.yaml` | `PaymentInstruction` | `InstructionResponse` | Implemented | Validation enforces the mandatory pacs.008-derived parties, amount, charge bearer, and blockchain instruction fields. Per v1.3, `debtor_agent`/`creditor_agent` are optional (corporate-direct / self-hosting flows), and `custody_model` accepts `FULL_CUSTODY`, `DELEGATED_SIGNING`, and `SELF_CUSTODY`. `FULL_CUSTODY` and `DELEGATED_SIGNING` execute; `SELF_CUSTODY` clears validation and returns `501`. Optional `settlement_transport`, `vlei_credential`, and `credential_attestation` (incl. ERC-7943 enforcement) fields are validated when present (Epics 16/17/20). |
| `GET /instruction/{instructionId}` | `instruction-api-v1.3.yaml` | n/a | `InstructionStatusResponse` | Implemented | The returned object includes the required status surface plus extra reference-server fields. |
| `DELETE /instruction/{instructionId}` | `instruction-api-v1.3.yaml` | n/a | `CancellationResponse` | Implemented | The route now returns the narrow cancellation receipt defined in the spec. |
| `POST /instruction/{instructionId}/signed-transaction` | `instruction-api-v1.3.yaml` | `SignedTransactionSubmission` | delegated-signing response | Implemented | DELEGATED_SIGNING instructions are held with an `unsigned_transaction` until this route accepts the signed transaction, which lifts the gate and resumes the lifecycle (Epic 13). Only enabled on adapters that *simulate* delegated signing (`supports_delegated_signing`, i.e. the mock); a custodial adapter (Sepolia re-signs with the server key) rejects DELEGATED_SIGNING with `501`. |
| `POST /instruction/{instructionId}/return` | `instruction-api-v1.3.yaml` | `ReturnRequest` (pacs.004) | compensating-instruction response | Partial | Implemented as a Tom v1.2-compatible instruction-level façade backed by the existing `return_case` exception model; full v1.3 reason-code vocabulary alignment remains a follow-up. |
| `POST /instruction/{instructionId}/reverse` | `instruction-api-v1.3.yaml` | `ReversalRequest` (pacs.007) | reversal request response | Partial | Implemented as a Tom v1.2-compatible reversal request façade backed by the exception-family store; it records a request in `REQUESTED` state rather than creating a compensating instruction immediately. |
| `GET /instruction/{instructionId}/reversal-status` | `instruction-api-v1.3.yaml` | n/a | `ReversalStatus` | Partial | Implemented as a Tom v1.2-compatible status read for the latest reversal request; compensating-instruction fields are exposed only after a later accepted/completed outcome. |
| `GET /instruction/search` | `instruction-api-v1.3.yaml` | query params | `InstructionSearchResponse` | Implemented | Search envelope, compact summaries, and query validation for status, DLI/DTI, pagination, and time range are present. |
| `POST /report/query` | `account-reporting-api-v1.3.yaml` | `ReportQuery` | `QueryResponse` | Partial | Supports synchronous balance and intraday responses, synchronous or async statement delivery, and wallet-scoped notification subscribe/unsubscribe flows on top of the current webhook subsystem. Notification subscriptions now deliver raw camt.054-style bodies and async statements are queued through the retrying delivery engine. The route remains partial because the bank-side callback endpoint and full request idempotency window are still out of scope. |
| `GET /report/intraday` | `account-reporting-api-v1.3.yaml` | query params | `IntradayReport` | Implemented | The route now returns a root-spec camt.052-style wrapper with `group_header`, `report`, paginated `entries`, and per-token balance lines built from the reference-server reporting records. |
| `GET /report/statement` | `account-reporting-api-v1.3.yaml` | query params | `WalletStatement` | Implemented | The route now returns a root-spec camt.053-style wrapper with `group_header`, `statement`, paginated booked entries, and statement-period balance lines for the current wallet/date filters. |
| `GET /report/notification/{notificationId}` | `account-reporting-api-v1.3.yaml` | n/a | `BlockchainNotification` | Implemented | The route now returns a root-spec camt.054-style wrapper with `group_header`, `account`, and `entry` derived from the underlying reporting notification and instruction context. |
| `POST /report/notification/callback` | `account-reporting-api-v1.3.yaml` | `BlockchainNotification` | acknowledgement | Out of scope | This is explicitly a bank-side endpoint. The reference server is the VASP side and returns `501` to make that boundary explicit. |
| `GET /report/search` | `account-reporting-api-v1.3.yaml` | query params | `EntrySearchResponse` | Implemented | Wallet-scoped entry search, pagination, amount/finality filters, and spec-style entry summaries are present. |
| `GET /report/stats` | `account-reporting-api-v1.3.yaml` | query params | `ReportStatsResponse` | Implemented | Wallet-scoped token totals and grouped breakdowns are present for the current local dataset. |

## v1.3 family additions (Spec 4 & Spec 5)

The v1.3 release added two specifications that the current bank-to-VASP wedge does not implement as formal spec surfaces:

| Spec | Status | Notes |
|---|---|---|
| `exception-investigation-api-v1.3.yaml` (Spec 4 — Exception & Investigation, camt.110/111) | Out of scope | The formal `/investigation/*` surface and camt.110/111 investigation types (`UTAP`, `RQFI`, `RQCH`, `ACCT`, `OTHR`) are not implemented. The reference server has a *related but divergent* operational exception surface under `/exceptions/*` (tracked below as an extension) that predates Spec 4; re-basing it onto camt.110/111 is a tracked follow-up. |
| `liquidity-management-api-v1.3.yaml` (Spec 5 — Liquidity Management) | Out of scope | Own-account `/wallet-transfer`, `/wallet-position`, and `/wallet-limit` flows are outside the bank-to-VASP wedge and are deferred. |

## Interoperability reference modules (Epics 15–24)

These are tested reference components built from the DeFi ↔ TradFi interoperability
research ([`interop-defi-tradfi.md`](interop-defi-tradfi.md)). They prove each
direction at the messaging layer and are now exposed over HTTP under `/interop/*`
(stateless transform endpoints) in addition to being importable modules.

| Component | Epic | Form | Notes |
|---|---|---|---|
| `src/chain/mock-cctp-adapter.js` | 18 | chain adapter | Selectable via `REF_SERVER_CHAIN_ADAPTER=mock-cctp`; settles through existing routes with CCTP burn-and-mint metadata. |
| `src/interop/ivms101-mapping.js` | 19 | module | Bidirectional Spec 1 ⇄ IVMS101 core-field mapping (name, LEI, country, wallet); unmapped fields reported. |
| `src/interop/x402-binding.js` | 23 | module | x402 agent intent → compliant instruction; DTI-first resolution; Travel Rule gap surfaced as a warning. |
| `src/interop/trust-anchor.js` | 21 | module | Issue/verify permissioned-pool access credentials; asserts eligibility only, no sanctions reasoning. |
| `src/interop/compliance-reporting.js` | 22 | module | One canonical record → MiCA `auth.117`-shaped + GENIUS-shaped filings. |
| `src/interop/unified-ledger.js` | 24 | module (scaffold) | Unified-ledger pre-settlement posture (BIS Agorá model); reference scaffold pending the external gate. |
| `src/routes/interop-routes.js` | 19/21/22/23/24 | routes | Exposes the above modules as `/interop/*` stateless transform endpoints. |
| `vlei_credential` / `settlement_transport` / `credential_attestation` validators | 16/17/20 | validation | Optional, additive; validated when present and round-trip through the store. |

## Reference-server extensions

These routes are real, but they are outside the current root YAML specs and therefore are tracked as server extensions rather than spec conformance:

- `GET /execution-status/:instructionId`
- `GET /execution-status/uetr/:uetr`
- `GET /finality-receipt/:instructionId`
- `GET /finality-receipt/uetr/:uetr`
- `GET /event-outbox`
- `GET /event-outbox/:eventId`
- `POST /webhook-endpoints`
- `GET /webhook-endpoints`
- `GET /webhook-endpoints/:subscriptionId`
- `GET /webhook-endpoints/:subscriptionId/deliveries`
- `GET /webhook-deliveries`
- `GET /webhook-deliveries/:deliveryId`
- `POST /webhook-deliveries/dispatch`
- `GET /reporting/notifications`
- `GET /reporting/notifications/:notificationId`
- `GET /reporting/intraday`
- `GET /reporting/statements`
- `GET /reporting/statements/:statementId`
- `POST /exceptions/investigations`
- `GET /exceptions/investigations`
- `GET /exceptions/investigations/:caseId`
- `PATCH /exceptions/investigations/:caseId`
- `POST /exceptions/returns`
- `GET /exceptions/returns`
- `GET /exceptions/returns/:returnCaseId`
- `PATCH /exceptions/returns/:returnCaseId`

The `/reporting/*` routes above remain as compatibility aliases for the earlier
reference-server surface. New conformance work is targeting the root
`/report/*` path family from `account-reporting-api-v1.3.yaml`.

The `/exceptions/*` routes are the reference server's operational exception model
(`investigation_case` + `return_case`). They predate v1.3 and are conceptually
related to both Spec 4 (Exception & Investigation) and the v1.3 instruction-level
returns/reversals endpoints, but they are a divergent surface rather than a
conformant implementation of either — see [`exception-family.md`](exception-family.md).

## Current conformance focus

The current conformance work is intentionally limited to the bank-to-VASP wedge already implemented in code:

- stricter request validation for the spec-covered write routes
- stricter query validation for the spec-covered search and stats routes
- response-shape coverage for the core spec-covered read and search routes
- Tom upstream v1.2 return/reverse/reversal-status alignment using the existing exception-family model as the backing store
- reporting path-family alignment against `account-reporting-api-v1.3.yaml`
- wallet-scoped notification subscription support on top of the webhook subsystem
- explicit documentation of the current out-of-scope spec surface:
  - self-custody execution
  - formal v1.3 Spec 4 investigation and Spec 5 liquidity-management surfaces
  - bank-side reporting callback endpoint

`SELF_CUSTODY` execution, non-EVM flows, the formal v1.3 Spec 4
exception-investigation surface (camt.110/111), the Spec 5 liquidity-management
family, bank-side callback endpoint implementation, and full request
idempotency-window semantics remain outside the current conformance target.
Delegated signing is limited to adapters that simulate the flow, as noted above.
The current conformance layer is hand-authored in code for the implemented wedge
rather than generated directly from the YAML.
