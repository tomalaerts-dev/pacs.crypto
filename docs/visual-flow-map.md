# Visual flow map

This note gives reviewers a visual entry point into the current `pacs.crypto` reference stack. It is intentionally descriptive rather than normative: the implemented reference server is concrete, while the richer investigation family remains draft until the spec design catches up.

## Reviewer questions this map answers

- Where do the Travel Rule record, payment instruction, status reads, finality evidence, returns, reversals, and investigation paths sit in one lifecycle?
- Which parts are already implemented in the reference server?
- Which ISO 20022 analogues are being preserved by name because they are recognised industry vocabulary?
- Which parts are deliberately parked as draft input for future spec work?

## Main lifecycle

```mermaid
sequenceDiagram
  autonumber
  participant Bank as Originating bank / treasury
  participant SVASP as Sending VASP
  participant Chain as Public chain
  participant RVASP as Receiving VASP
  participant Ops as Exception / investigation ops

  Bank->>SVASP: POST /travel-rule<br/>pacs.008-aligned identity + remittance data
  SVASP->>RVASP: Travel Rule callback / acknowledgement
  Bank->>SVASP: POST /instruction/quote
  Bank->>SVASP: POST /instruction<br/>linked travel_rule_record_id
  SVASP->>Chain: Broadcast token transfer
  Chain-->>SVASP: PENDING → BROADCAST → CONFIRMING → FINAL
  Bank->>SVASP: GET /instruction/{instructionId}<br/>pure status readback
  Bank->>SVASP: GET /execution-status/{instructionId}<br/>pacs.002-like execution status
  Bank->>SVASP: GET /finality-receipt/{instructionId}<br/>camt.025-like finality evidence
  SVASP-->>Bank: camt.054-like notification<br/>camt.052/camt.053-like reporting views

  alt Post-settlement remediation
    Bank->>SVASP: POST /return-cases<br/>pacs.004 return terminology preserved
    Bank->>SVASP: POST /return-cases/{id}/reverse<br/>pacs.007-aligned reversal path
  else Pre-broadcast cancellation window
    Bank->>SVASP: DELETE /instruction/{instructionId}<br/>camt.056 analogue only before broadcast
  else Rich investigation still draft
    Bank->>Ops: request-for-information / exception workflow
    Ops->>SVASP: investigation_case draft machinery<br/>future camt.026 / camt.027 / camt.087 analogues TBD
  end
```

## Flow ownership map

```mermaid
flowchart LR
  A[Travel Rule + remittance<br/>pacs.008-aligned] --> B[Instruction quote]
  B --> C[Instruction submit]
  C --> D[Chain adapter lifecycle<br/>PENDING → BROADCAST → CONFIRMING → FINAL]
  D --> E[Status and finality reads]
  E --> F[Reporting views<br/>camt.054 / camt.052 / camt.053]

  D --> G[Return case<br/>pacs.004]
  G --> H[Reverse path<br/>pacs.007]
  C -. pre-broadcast only .-> I[Cancellation<br/>camt.056 analogue]
  E -. draft / not locked .-> J[Investigation family<br/>camt.026 / camt.027 / camt.087 TBD]

  classDef implemented fill:#e8f5e9,stroke:#1b5e20,color:#111;
  classDef partial fill:#fff8e1,stroke:#ff8f00,color:#111;
  classDef draft fill:#fce4ec,stroke:#ad1457,color:#111;
  class A,B,C,D,E,F,G,H implemented;
  class I partial;
  class J draft;
```

## Alignment notes

| Area | Current posture | Why |
| --- | --- | --- |
| Reverse / return terminology | Preserve `pacs.004` and `pacs.007` wording | These names are recognised industry vocabulary and help reviewers understand the intent quickly. |
| `/reverse` | Keep `pacs.007` aligned | Post-settlement remediation is the realistic blockchain case once a public-chain transfer is final. |
| `camt.056` | Treat as pre-broadcast cancellation only | On a public chain, the cancellation window after broadcast is essentially zero. |
| Pure status request | Use `GET /instruction/{instructionId}` | A dedicated richer status-request path is not needed for simple readback. |
| Exception / investigation family | Keep as reference-server draft machinery | Useful concrete input, but the future spec shape should stay open until the design is clearer. |

## Suggested reviewer use

1. Open [`../index.html`](../index.html) for the visual console.
2. Use the inline lifecycle map to orient the discussion.
3. Use this note when reviewing the draft exception-family machinery, especially the boundary between implemented reference behaviour and future spec design.
