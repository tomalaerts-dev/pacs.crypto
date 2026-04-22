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
| `POST /travel-rule` | `travel-rule-api-v3.yaml` | `TravelRuleSubmission` | `TravelRuleRecord` | Implemented | Request validation now enforces the main required pacs.008-style objects used in the current wedge. |
| `GET /travel-rule/{recordId}` | `travel-rule-api-v3.yaml` | n/a | `TravelRuleRecord` | Implemented | Returns the persisted compliance record. |
| `PUT /travel-rule/{recordId}` | `travel-rule-api-v3.yaml` | `TravelRuleSubmission` | `TravelRuleRecord` | Implemented | Correction flow remains tied to the current record lifecycle model. |
| `POST /travel-rule/{recordId}/callback` | `travel-rule-api-v3.yaml` | `TravelRuleCallback` | `TravelRuleCallbackReceipt` | Implemented | Request validation follows the callback schema and the route now returns the receipt object defined in the spec. |
| `GET /travel-rule/search` | `travel-rule-api-v3.yaml` | query params | `TravelRuleSearchResponse` | Implemented | Query validation now covers the spec-defined filter set used in the current server, including direction, status, callback status, currency, wallets, pagination, and sort. |
| `GET /travel-rule/stats` | `travel-rule-api-v3.yaml` | query params | `TravelRuleStatsResponse` | Implemented | Stats envelope and aggregate totals are present for the current local dataset. |
| `POST /instruction/quote` | `instruction-api-v1.yaml` | `QuoteRequest` | `QuoteResponse` | Implemented | Request validation now enforces token, DLI, amount, currency, and custody model fields. |
| `POST /instruction` | `instruction-api-v1.yaml` | `PaymentInstruction` | `InstructionResponse` | Implemented | Current validation enforces the main mandatory pacs.008-derived parties, agents, amount, charge bearer, and blockchain instruction fields. |
| `GET /instruction/{instructionId}` | `instruction-api-v1.yaml` | n/a | `InstructionStatusResponse` | Implemented | The returned object includes the required status surface plus extra reference-server fields. |
| `DELETE /instruction/{instructionId}` | `instruction-api-v1.yaml` | n/a | `CancellationResponse` | Implemented | The route now returns the narrow cancellation receipt defined in the spec. |
| `POST /instruction/{instructionId}/signed-transaction` | `instruction-api-v1.yaml` | `SignedTransactionSubmission` | delegated-signing response | Out of scope | Delegated signing is intentionally not implemented in the current wedge. |
| `GET /instruction/search` | `instruction-api-v1.yaml` | query params | `InstructionSearchResponse` | Implemented | Search envelope, compact summaries, and query validation for status, DLI/DTI, pagination, and time range are present. |

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

## Current conformance focus

The current conformance work is intentionally limited to the bank-to-VASP wedge already implemented in code:

- stricter request validation for the spec-covered write routes
- stricter query validation for the spec-covered search and stats routes
- response-shape coverage for the core spec-covered read and search routes
- explicit documentation of the current out-of-scope spec surface:
  - delegated signing

Delegated signing, non-EVM flows, and richer exception families remain outside the current conformance target. The current conformance layer is hand-authored in code for the implemented wedge rather than generated directly from the YAML.
