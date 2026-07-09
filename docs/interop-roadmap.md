# pacs.crypto Interoperability Roadmap (DeFi ↔ TradFi)

> Strategic, multi-horizon roadmap for the new directions identified in
> [`interop-defi-tradfi.md`](interop-defi-tradfi.md). This is the **expansion**
> roadmap; the execution-wedge program of record remains [`roadmap.md`](roadmap.md)
> and the prioritised work items live in [`backlog.md`](backlog.md) (Epics 15+).

## Gating principle

Nothing in this roadmap starts before the current wedge is credible. The hard
prerequisites are: real Sepolia execution (roadmap Phase A/Epic 10), the real-chain
reviewer demo (Phase C/Epic 11), deeper exceptions (Phase D/Epic 12), and the open
v1.3 conformance follow-ups (`SELF_CUSTODY` execution, instruction-level
returns/reversals, formal Spec 4 camt.110/111, Spec 5 liquidity). These directions
**compound** on that base; they do not replace it.

Each horizon maps to opportunities `O1`–`O10` from the research note and to backlog
epics. Horizons are sequencing bands, not fixed dates.

---

## Horizon 0 — Coherence and low-cost alignment (overlaps current wedge)

Objective: bind to standards that have become concrete, with near-zero structural
change, so the family stays current while the wedge is proven.

Deliverables:
- **O10 — DTI-first hardening.** Make ISO 24165 DTI the primary/recommended-mandatory
  asset identifier across the family; add DTI-registry resolution guidance. Tracks the
  existing ESMA/MiCA mandate. (Epic 15)
- **O3 (spec-only first) — vLEI fields.** Reserve optional `vlei_credential` fields
  alongside every LEI in the specs, with semantics documented even before runtime
  support. (Epic 16, spec slice)
- Documentation: this note + the research landscape published and cross-linked from
  the README reference-stack section.

Success criteria:
- no normative change breaks existing implementations (additive/optional only)
- the family visibly tracks ESMA DTI and GLEIF vLEI without widening the wedge

Depends on: nothing new (documentation + optional spec fields).

---

## Horizon 1 — Make multi-venue settlement real (near term)

Objective: prove pacs.crypto sits cleanly *above* the winning interop transports, and
turn the Travel Rule model into a practical bridge.

Deliverables:
- **O1 — `settlement_transport` abstraction.** One instruction targets direct-EVM /
  CCTP / CCIP-CRE / Canton without data-model change. (Epic 17)
- **O8 — CCTP + Canton reference-stack adapters.** Implement real adapters behind the
  existing chain-adapter seam, proving cross-chain USDC (CCTP V2) and a deposit-token /
  Treasury venue (Canton). The demonstrable backing for O1. (Epic 18)
- **O3 (runtime) — vLEI verification.** Reference-server verification of `vlei_credential`
  on submission and surfacing on reads. (Epic 16, runtime slice)
- **O9 — Travel Rule interoperability conformance layer.** Field-level mappings from
  Spec 1 to TRISA / TRP / IVMS101 + a conformance harness. (Epic 19)

Success criteria:
- one instruction settles through at least two distinct transports unchanged
- a Spec 1 record round-trips to/from at least one external Travel Rule transport in test
- vLEI verification works end-to-end on the reference corridor

Depends on: real Sepolia execution (Epic 10) and the chain-adapter seam.

---

## Horizon 2 — New regulated-asset and access surfaces (mid term)

Objective: extend the family to the asset classes and access models the institutional
market is standardising around.

Deliverables:
- **O2 — Tokenised-asset / RWA transfer spec.** Instruction + reporting for regulated
  tokenised securities/RWAs; `credential_attestation` extended to ERC-7943 enforcement
  context and ERC-3643 identity-registry references. (Epic 20)
- **O4 — Trust Anchor / regulated-DeFi access profile.** Bank/VASP issues, pool
  verifies, access credentials from pacs.crypto identity data (Project Guardian model).
  Messaging-layer only — assert eligibility, never adjudicate sanctions on-chain.
  (Epic 21)
- **O7 — Multi-regime compliance-reporting substrate.** Build the planned Compliance
  Base Info Reporting spec as regime-aware (MiCA `auth.116/117/118`, GENIUS, MAS …).
  (Epic 22)
- **O5 — Agentic-payment settlement binding.** Map x402 / AP2 / MPP agent intents onto
  compliant pacs.crypto instructions; pacs.crypto as the regulated settlement +
  Travel Rule leg behind machine micropayments. (Epic 23)

Success criteria:
- a tokenised-RWA transfer carries enforcement + identity-registry references end-to-end
- a permissioned-pool eligibility credential can be issued and verified without leaking
  sanctions reasoning
- one agent intent produces a fully-structured, Travel-Rule-linked instruction

Depends on: Horizon 1 (transport + vLEI), ERC-7943/3643 stability, deeper exceptions.

---

## Horizon 3 — Unified-ledger / tokenised-deposit / CBDC (long term)

Objective: position the family at the bank edge of the unified-ledger world if and
when it materialises.

Deliverables:
- **O6 — Tokenised-deposit / unified-ledger interop profile.** Bank-edge messaging that
  expresses "simultaneous compliance" as structured pre-settlement data for
  tokenised-deposit and (later) wholesale-CBDC corridors (BIS Agorá model). (Epic 24)

Success criteria:
- a credible mapping from pacs.crypto pre-settlement data to an Agorá-style simultaneous
  AML/sanctions/settlement flow, validated against the published Agorá outcomes

Depends on: Horizon 2, and external maturity — gate on BIS Agorá's mid-2026 report and
tokenised-deposit production rollouts (JPMorgan Kinexys/JPMD, Citi, BNY) before
committing build effort.

---

## Horizon map at a glance

| Horizon | Opportunities | Epics | Theme |
|---|---|---|---|
| H0 | O10, O3(spec) | 15, 16(spec) | Cheap standards alignment |
| H1 | O1, O8, O3(runtime), O9 | 17, 18, 16(runtime), 19 | Multi-venue settlement + Travel Rule bridge |
| H2 | O2, O4, O7, O5 | 20, 21, 22, 23 | Regulated assets, access, reporting, agents |
| H3 | O6 | 24 | Unified ledger / tokenised deposits / CBDC |

Re-verify the external landscape (standards status, pilot outcomes) at the start of
each horizon — see the dated caveats in the research note.
