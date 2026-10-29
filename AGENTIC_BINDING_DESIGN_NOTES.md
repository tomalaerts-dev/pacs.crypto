# Agentic authorisation binding — design notes

Status: DESIGN ONLY, not built. Captures decisions + reasoning from the design
discussion so the build (later) does not lose the subtle points, especially the
security-critical ones. Nothing here is final YAML; it is the agreed shape and
the rationale behind each choice.

## 1. Strategic framing (why this shape)

The agent-authorisation space has strong convergent standards already:
- **Google AP2** (Agent Payments Protocol) — the authorisation layer. Cryptographic
  mandates (Intent / Cart / Payment) carried as W3C Verifiable Credentials.
  Donated to the FIDO Alliance (Apr 2026); spec work continues there. Stablecoin-aware.
- **GLEIF vLEI / Agent Mandate Credential (AMC)** — the organisational-identity
  anchor beneath the authorisation. Binds an agent's authority back to a verified
  legal entity via the LEI → OOR/ECR → AMC credential chain. Working paper only,
  schemas not yet defined.

DECISION: do NOT build a competing mandate-credential format. Consume vLEI/AP2.
Build the piece both explicitly lack and that pacs.crypto is uniquely positioned
for: the **ISO 20022 payment-instruction-layer binding + compliance bindings**
(Travel Rule, regulatory reporting). GLEIF names this exact gap: "a standard
interface for credential presentation and chain verification at the payment
instruction layer, without which the model cannot scale."

Three-layer story (also the article angle):
  identity anchor (vLEI/LEI, or person-level later)
    → authorisation mandate (AP2/AMC)
      → ISO 20022 payment-instruction + compliance binding (pacs.crypto — ours)

## 2. What we build vs consume vs already have

- CONSUME (do not build): the mandate credential itself (vLEI AMC / AP2 Intent
  Mandate); the cryptographic chain verification (vLEI/KERI, AP2/FIDO).
- BUILD (the missing seam): presentation hook on the Instruction; the verification
  *interface contract* (not the engine); the envelope-check wired to the verified
  mandate; the Travel Rule compliance binding; the reporting/audit binding.
- ALREADY HAVE (modest extension): Instruction API delegated-signing + cross-check
  fields (amount, recipient, chain DLI, nonce) — reuse for the envelope check;
  Travel Rule PartyIdentification272 person/org handling; reporting resources.

## 3. The binding — component sketch (Parts A–D)

### Part A — presentation hook on the Instruction (NEW, optional block)
`agent_authorisation`, present only for agent-initiated instructions:
- `mandate_scheme.type`: VLEI_AMC | AP2_INTENT | OTHER
- `mandate_reference`: id of the external mandate (resolvable)
- `presented_credential`: the VC/ACDC payload or resolvable pointer
- `agent_identifier`: the agent's DID/key id that signs the instruction (= agent
  "signature 2"; your existing signing flow)
- `principal_identifier`: see Part E (choice, NOT assumed LEI)
- `declared_envelope_for_display`: see Part C (display-only, non-authoritative)

Two-signature model (settled earlier): principal signs the mandate/envelope
(external, via vLEI/AP2) = authority; agent signs each instruction (your existing
flow) = authentication. Agent cannot widen its own authority because the envelope
carries the principal's signature, not the agent's. Verifier checks a signature
with the signer's PUBLIC key (principal's public key, registered at mandate time).

### Part B — MandateEnvelope (NEW constraint schema; pain.009 vocabulary lands here)
NOT a credential — the ISO-idiomatic expression of the constraints the VASP checks
against. Concepts LIFTED from ISO pain.009 mandate family (lifecycle/amounts/
validity/sequence/reason), NOT the direct-debit creditor-pull plumbing:
- `max_amount` (← pain.009 MaxAmt, "per instruction")
- `validity` {from, until} (← pain.009 duration / first-final dates)
- `repeatability`: SINGLE_USE | REPEATABLE (← pain.009 SeqTp OOFF/RCUR concept)
- `allowed_counterparties` (allowlist — crypto-native, no ISO source)
- `allowed_chains_tokens` (permitted chain DLIs / token DTIs — crypto-native)
Lifecycle to mirror from ISO (four-act, agreed): initiate / amend / revoke /
accept. "Accept" = the VASP's explicit confirmation it has registered and will
honour the mandate (handshake before the agent transacts).

### Part C — verification interface (the CONTRACT, not the engine)
Deny-by-default flow (matches AP2/GLEIF):
1. Verify agent signed the instruction (existing signing flow).
2. Hand `presented_credential` to the external verifier (vLEI/AP2) → returns
   {valid, principal id, AUTHORITATIVE envelope, revocation status}. WE DEFINE THE
   INTERFACE, we do not implement the verifier.
3. Check instruction against the AUTHORITATIVE envelope (amount ≤ max, beneficiary
   ∈ allowlist, within validity, chain/token permitted). REUSES existing HSM-side
   policy-check machinery + signing cross-check fields.
4. Any check fails → reject, authorise nothing.

LOAD-BEARING UNKNOWN: this interface is exactly what GLEIF says does not yet exist
at operational scale, and AP2's is moving (now under FIDO). So build Parts A/B/D
concretely; define Part C as an interface with a CLEARLY FLAGGED dependency on the
external schemes stabilising. Do not pretend the verifier contract can be pinned
today. "We just invoke the verifier" hides real design work in the contract.

## 4. SECURITY-CRITICAL decision: the declared envelope is DISPLAY-ONLY

The trap: there are two copies of the envelope. The AUTHORITATIVE one is inside
the signed credential (agent cannot alter it without breaking the principal's
signature). The DECLARED one is a convenience field the agent populates. If an
implementer authorises a payment against the DECLARED envelope (because it is
conveniently present in the instruction), a misbehaving/buggy agent can declare a
"generous" envelope (e.g. max 10,000,000, any beneficiary, no expiry) while the
principal only signed a "tight" one (e.g. 10,000, allowlist, single-use). The
agent would have written its own permission slip. The whole security property
collapses, silently.

DECISION (keep the field for UX, but make misuse structurally hard):
- KEEP a declared envelope for human-friendliness (prepopulated display for
  maker/checker and treasury-review flows). UX value is real.
- NAME it so it cannot be mistaken for authority: `declared_envelope_for_display`.
  Field description MUST begin: "Non-authoritative. For human display and
  cross-check only. MUST NOT be used for authorisation decisions; the
  authoritative envelope is extracted from the verified credential."
- DROP the earlier idea of a single-value enum ("declared, must be verified").
  Reason: a one-value enum carries no information, becomes visual noise, gets
  optimised away, and invites breakage the day a second value is added.
- STRONGER MECHANISM (agreed): put the safety status on the VASP's VERIFICATION
  RESULT, not on the agent's declaration. Add a VASP-populated `mandate_verification`
  block, UNSET on arrival, filled only after the VASP verifies the credential:
    { verified: bool, authoritative_envelope: {...}, matches_declared: bool,
      verified_at: ... }
  The AUTHORITATIVE envelope lives HERE, produced by verification, never by the
  agent. Structural safety: the field an implementer must check against does not
  EXIST until verification has happened. Reaching for the declared one means
  reaching into a field literally named "for display".
- EXECUTION GATE (the mandatory part of Tom's instinct, placed where it bites):
  an instruction MUST NOT be executed until `mandate_verification.verified == true`.
  Mandatory gate on the VASP's result, not on an agent-controlled field.
- BONUS cross-check / UX: `matches_declared` lets the VASP warn a human if the
  agent's displayed limits differ from its verified mandate. Two-copy situation
  becomes an integrity feature, not just a risk.

## 5. Principal identifier — CHOICE component, do NOT assume LEI

LIMITATION Tom surfaced (correct and important): LEI (ISO 17442) is for LEGAL
ENTITIES only. GLEIF does not issue LEIs to natural persons. So the vLEI/AMC
agent-authority architecture is organisation-first. But pacs.crypto's payment
layer ALREADY supports natural-person originators/beneficiaries (Travel Rule
Party52Choice person/org). Structural mismatch: payment layer is person-capable;
the agent-authority layer we consume is organisation-only today.

DECISION: `principal_identifier` is a CHOICE, not an LEI field:
  oneOf:
    - lei: ISO 17442               # organisational principal (vLEI-anchored)
    - other_identity:              # natural person / other scheme
        scheme: ...                # e.g. eIDAS wallet, AP2 wallet-key VC, TBD
        identifier: ...
Notes:
- Keep the "other" arm DELIBERATELY OPEN / lightly specified (scheme + identifier).
  The person-level anchor is NOT settled industry-wide (eIDAS 2.0 / EU Digital
  Identity Wallet, AP2 wallet-key VCs, others still forming). Tight spec now = rework.
- Idiomatic for the family (already uses Party52Choice and code-or-proprietary
  choices).
- v1 SCOPE: support ORGANISATIONAL principals (LEI/vLEI). Natural-person principals
  = explicit KNOWN LIMITATION, await a maturing person-level identity anchor. State
  this in the spec; do not quietly assume LEI covers everyone.
- Longer-term ripple: a natural-person principal's ENVELOPE may differ from an
  organisational one (no treasury-officer role in chain; different validity/assurance).
  The choice is the first seam of a broader person-vs-org distinction, not an
  isolated field.

## 6. Travel Rule upgrade (Part D — the elegant, high-value, distinct piece)

Travel Rule API already identifies originator/beneficiary (PartyIdentification272).
For an AGENT-INITIATED transfer, add an optional `initiating_agent` block binding
the agent mandate to the compliance data:
  initiating_agent:
    agent_identifier
    principal_identifier   (same choice component as Part 5)
    mandate_reference      (links to agent_authorisation on the instruction)
Why elegant: the Travel Rule message ALREADY must carry originator data; adding
"initiated by agent X under mandate Y for principal Z" extends existing FATF R.16
originator data naturally. Answers GLEIF's point that on stablecoin rails (no bank
intermediary) compliance logic must TRAVEL WITH the transaction — the agent-authority
becomes part of the compliance payload that already travels. No new message.

## 7. Related future items (noted, not now)

- pain.013/014 (CreditorPaymentActivationRequest + status) = request-to-pay / RTP.
  NOT direct debit, NOT mandates. Possible FUTURE resource: agent-to-agent
  request-to-pay (payee-agent requests, payer-agent decides within its mandate),
  governed by a service description. Keep separate from mandate work; do not conflate
  (RTP = payee asks, payer decides; mandate = principal pre-authorises agent).
- Crypto signing specifics (what the signature covers — full payload incl. amount,
  destination, nonce, per AP2 dynamic-linking; replay protection; revocation
  propagation; key rotation) = VERIFY against current practice at build time, do
  NOT design from memory. Security-critical.

## 8. Article angle (Tom's idea)

Write a piece building visibly on the GLEIF working paper (which explicitly invites
collaboration) + AP2: present the three-layer framing and position pacs.crypto as
the ISO 20022 payment-instruction + compliance binding that both layers lack.
Advertises the work and contributes to a conversation GLEIF opened. Honest to note
the LEI/natural-person gap as something ISO/compliance depth is positioned to spot.

────────────────────────────────────────────────────────────────────────
## 9. Additional agent concepts — triage (added after review)
────────────────────────────────────────────────────────────────────────

Reviewed the agent concepts GLEIF/AP2 carry that the binding sketch did not yet
cover. Tiered by decision. Discipline reminder: completeness is NOT the goal; a
tight, honest, bounded binding is. Only the IN-V1 items get built; the rest are
named so the spec is honest about its boundaries.

### IN V1 (confirmed essential)

- **Single-use consumption state.** The envelope offers SINGLE_USE, but an external
  AP2/vLEI credential is static and does not know it has been used. Replay-prevention
  state must therefore live at OUR binding layer. The VASP MUST track that a
  single-use mandate has been consumed and atomically refuse a second instruction
  against it. Without this, SINGLE_USE is not actually single-use. Near-mandatory
  if single-use is offered. Lands as mandate status/state at the binding
  (active / consumed / expired / revoked), consumed atomically on execution.

- **Human-present vs human-not-present signal.** A field on the agent-initiated
  instruction recording whether a human approved THIS specific execution, versus
  fully autonomous execution under a standing mandate. AP2 carries this because it
  changes liability allocation. Cheap, high compliance/liability value. Feeds both
  the Travel Rule and reporting bindings (see disclosure item below).

- **Escalation threshold.** The envelope has max_amount as a HARD ceiling. Add a
  softer sub-limit above which a human co-sign is required before execution
  ("autonomous up to X; human co-sign between X and the ceiling"). GLEIF explicitly
  raises maker/checker and multi-signature as expectations that exist even without
  agents. Envelope should be able to express this.

### IN V1 (confirmed from the "decide" tier)

- **Revocation-check freshness.** The verification result carries a
  "revocation_checked_at" timestamp, and the binding states a max-staleness policy
  (how fresh revocation status must be for a given action). GLEIF Annex D treats
  acceptable staleness as an explicit design parameter. NOTE: the achievable
  freshness depends on what the external verifier (Part C) exposes, so this couples
  to the verification-interface work — specify the policy, flag the dependency.

- **Agent-initiated disclosure in regulatory reporting (IMPORTANT).** Not just a
  passive flag on the instruction — a FIRST-CLASS REPORTABLE, QUERYABLE attribute in
  the Regulatory Reporting resource. Rationale (Tom, compliance-officer lens): an
  officer will want to ask e.g. "show me agent-initiated payments over X" or "show
  me fully-autonomous high-value transfers". So it lands in reporting ALONGSIDE the
  amount and the human-present/not-present signal, as a filterable dimension, not a
  bare boolean. This is a distinct, high-value compliance contribution the agentic-
  payment protocols do not make.

### NOTE ONLY (no field yet)

- **Mandate assurance level.** GLEIF: liability should follow mandate assurance the
  way it follows authentication strength in card schemes / signature levels in
  e-signature law. Keep as a NOTE. Do NOT add a field yet — the assurance-level
  framework is not defined enough to pin. Leave room on the verification result to
  carry it later if/when the external schemes define levels.

### OUT OF SCOPE for the API layer (named as known non-goals, so we don't pretend)

- **Sub-delegation / multi-agent authority.** An agent spawning sub-agents with
  partitioned authority. GLEIF flags it as open and unsolved even for them. Deferred;
  explicit non-goal for v1.

- **Runtime attestation of agent state.** Proving the deployed agent is acting on the
  configuration that was authorised. An execution-environment concern (trusted
  execution environments, hardware anchoring), NOT an API-layer concern. Out of scope.

────────────────────────────────────────────────────────────────────────
## 10. pain.009 reuse boundary — what to lift vs what would be displaced
────────────────────────────────────────────────────────────────────────

The test for every pain.009 element: does it describe a CONSTRAINT THE VASP CHECKS
AGAINST (reusable, lives at our binding layer), or does it describe the MANDATE
CREDENTIAL ITSELF (do not build — comes from vLEI/AP2)? That line sorts safe reuse
from displacement risk. The safely-reusable set is deliberately NARROW; that
narrowness is the signal we are correctly scoped to the binding layer and not
rebuilding a mandate standard. If we found ourselves reusing a lot of pain.009, it
would mean we had drifted back into building a credential.

### SAFE TO REUSE (describes the envelope the VASP checks; standard-agnostic)

- **Constraint vocabulary** (already mined): MaxAmt; validity duration/dates;
  sequence-type concept (once vs recurring → SINGLE_USE / REPEATABLE). These are the
  ISO-idiomatic way of EXPRESSING what the verified credential authorises, so the
  VASP can check an instruction against it. Not displaced by AP2/vLEI, because those
  define the CREDENTIAL, not the ISO constraint expression. This is where pain.009
  concepts legitimately earn their place (the MandateEnvelope, Part B).

- **Reason-code machinery** for amend/revoke. If we record WHY a mandate was amended
  or revoked in our reporting/audit trail, ISO's mandate reason codes are worth
  lifting — a coded vocabulary we'd otherwise invent, independent of credential format.

### DO NOT BUILD (would be displaced by vLEI AMC / AP2 Intent Mandate)

- **The mandate credential structure itself** — anything that issues, signs, or holds
  the mandate as a document. That is vLEI/AP2 territory. pain.009 structures around
  the mandate as a signed artefact (its authentication block; the creditor/debtor
  signatory framing) are exactly what gets displaced. Building them is the
  over-engineering to avoid.

- **The four-act lifecycle AS MESSAGES.** We earlier agreed to mirror initiate/amend/
  revoke/accept. Reconsidered against the pivot: do NOT build these as our own
  mandate-management endpoints. MANAGING the mandate (issue/amend/revoke) is the
  credential layer's job (vLEI/AP2). What we reuse is only the lifecycle AS REFLECTED
  AT OUR LAYER: the "accept" handshake (VASP confirms it will honour a presented
  mandate) and the consumption/revocation STATE we track (section 9 single-use
  consumption). Initiate and amend happen in vLEI/AP2, not in our API. So the
  lifecycle concept informs our STATE MODEL; we do not build four lifecycle endpoints.

### STUB-NOTE INTENT (write this into the Part C / MandateEnvelope stub)

State explicitly, in the stub, that the MandateEnvelope constraint vocabulary is
"lifted from pain.009 concepts but is our own ISO-idiomatic CONSTRAINT EXPRESSION,
not a mandate credential." Purpose: a future reader/co-author understands the
envelope is deliberately a CHECK-TARGET, not a competing credential, and must not
"complete" it into a full mandate object during the build. One line of intent that
stops the envelope drifting into displacement territory.

────────────────────────────────────────────────────────────────────────
## 11. Agent identification + the bounded agent_identity construct
────────────────────────────────────────────────────────────────────────

### The problem (one LEI, many agents)
`principal_identifier` resolves to the legal entity. But one LEI can have 1000+
agents. If all present as "acting for LEI X", a compliance officer cannot tell
them apart — cannot see which agent initiated a payment, trace a bad payment to a
specific agent, or revoke one agent without affecting the others. That breaks the
accountability property, which is the whole point.

### What AP2/KYA actually do (checked, not from memory)
- AP2 does NOT solve agent identity. It signs the USER's authorisation for the
  agent to spend, not the agent's identity to the counterparty. A mandate proves
  the user signed something; it does not prove the agent attaching it is the agent
  intended. AP2 binds the mandate to the user's signing key, not the agent's.
- Agent identity is a SEPARATE discipline: Know Your Agent (KYA). Attestation is
  expected from a layer alongside AP2: Visa Trusted Agent Protocol (agent id signed
  into HTTP headers), Mastercard agentic tokens (agent id bound to the card token),
  DIDs (did:ap2:<agent-id> for crypto-native agents), or GLEIF/vLEI (agent id as a
  delegated identifier under the issuing human's key event log).
- So each agent DOES get a distinct cryptographic identifier at the lower layer
  (DID or vLEI delegated id). AP2's mandate is just anchored to the user, not the agent.

### The split (what is ours)
- Cryptographic DISTINCTNESS (agent #447 vs #892 under one LEI) is handled BELOW us
  by the DID / vLEI delegated id. We do NOT build this.
- Payload + compliance VISIBILITY (a compliance officer seeing / filtering /
  tracing / reporting on which specific agent initiated a payment) is NOT done by
  AP2 or the Travel Rule world today. This is the ISO-compliance-binding value we add.
- Driving example (Tom): "show me high-value payments by autonomous agents" → the
  agent id must be a first-class, REPORTABLE field, travelling up from the DID layer
  into our payload and into reporting.

### DECISION: a small, bounded `agent_identity` construct (NOT a "KYA" construct)
A dedicated construct beats scattered fields because it carries a VERIFICATION
RESULT, so it wants the same structural-safety pattern as mandate_verification
(the thing you check must be VASP-populated, never agent-asserted), and it groups
the "who is this agent and how do we know" answer legibly for compliance.

NAMING TRAP (important): do NOT call it a "KYA construct". If the spec contains a
thing named KYA, readers infer we DO KYA (reputation, directory, attestation) —
the exact overreach to avoid. Name it `agent_identity`; document that it CONSUMES
external KYA/attestation. It references and verifies; it does not attest.

Shape — a SECOND presentation+verification pair under `agent_authorisation`,
alongside the mandate pair. This separates the two concerns that were blurred:
IDENTITY (who is this agent, how attested) vs AUTHORITY (the mandate, what it may do).

  agent_authorisation:
    agent_identity:                      # KYA-consuming; identity, not authority
      agent_identifier                   # DID / vLEI delegated id
      agent_operator                     # optional — who operates the agent (may
                                         #   differ per agent under one LEI)
      attestation:                       # CONSUMED from the external KYA/DID/vLEI layer
        scheme                           #   e.g. TAP, vLEI, Mastercard token, DID
        reference                        #   pointer/proof, not the attestation itself
      identity_verification:             # VASP-POPULATED result (unset on arrival)
        verified                         #   structural-safety: check this, not the
        scheme                           #   agent's claim
        verified_at
    mandate:                             # the existing authority pair (Parts A–C)
      mandate_reference
      presented_credential
      declared_envelope_for_display      # display-only (section 4)
      mandate_verification               # VASP-populated (section 4)
    principal_identifier                 # the choice component (section 5)

Surfaces into: Travel Rule `initiating_agent` block (Part D), and the REPORTABLE
dimension of the Regulatory Reporting resource (section 9 disclosure) — agent id
(and operator) filterable alongside amount and the human-present signal.

### BOUNDARY (the "without overreach" line — state in the spec)
The construct carries: identifiers + an attestation REFERENCE + a verification
RESULT. It does NOT: compute reputation, maintain a directory, or attest identity
itself. Those stay in the KYA / DID / vLEI layer. If reputation or directory needs
ever arise, that is a SEPARATE decision, not a quiet expansion of this construct.

### Other AP2 elements worth surfacing (same surface-don't-rebuild principle)
- agent_operator — included above.
- mandate/intent reference — we already have mandate_reference; confirmed right.
- nonce / replay protection — AP2 envelopes carry a nonce; connects to the
  "what the signature covers" build-time verification item (section 7). Align.
- human-present signal — already in section 9; AP2 confirms it is first-class.

────────────────────────────────────────────────────────────────────────
## 12. Correctness gates + N-of-M agent approval (hallucination-risk discussion)
────────────────────────────────────────────────────────────────────────

Context: AIs hallucinate. An agent may be AUTHORISED (valid mandate, within
envelope) yet make a WRONG payment — e.g. keeps paying a recurring invoice after
the user stopped the service. Authority is intact; CORRECTNESS has failed. The
mandate model does not catch this. The user is legally to blame, but a standard
that helps PREVENT the error is worth more than one that only assigns fault.

HONEST LIMIT (state in spec): the API layer CANNOT detect hallucination — it
cannot see whether the service was still used, the invoice real, the reasoning
sound. Any field claiming to DETECT hallucination would be theatre. What the API
CAN do: carry signals/rules that let a better-positioned process catch the error,
and make risk-correlated conditions trigger a check before execution.

Triage of the brainstormed options:
- (1) Agent reasoning assertion ("why I think this is due") — DROPPED. Weak; the
  VASP cannot interpret free-text reasoning meaningfully. Dead weight at the
  payment layer. (Tom's call, agreed.)
- (2) Deviation detection — NO new field. VASP computes from its own history.
  Trace appears only in the verification RESULT (a flag), not an input.
- (3) Cool-off / confirmation gate — ONE field (below). The DETECTION is server-
  side; the RULE (what condition triggers what action) is carried in the envelope.

### DECISION 12a: execution_gates (one bounded envelope field)
Generalises section 9's escalation threshold (which triggers only on AMOUNT) to
other risk conditions. A small list of trigger→action rules in the mandate envelope:

  execution_gates:
    - trigger: NEW_BENEFICIARY       action: REQUIRE_HUMAN_CONFIRM
    - trigger: AMOUNT_DEVIATION      action: HOLD_24H
    - trigger: OVER_SOFT_LIMIT       action: REQUIRE_HUMAN_CONFIRM   # = section 9
    - trigger: POST_GAP              action: REQUIRE_HUMAN_CONFIRM   # after a gap in
                                     #   an otherwise-recurring series

Flow: at execution the VASP evaluates each trigger against its history for this
mandate; a firing trigger applies its action (hold / human-confirm / escalate)
instead of executing straight through; no trigger → execute normally.

Why a field (not just server config): makes the risk policy VISIBLE and PORTABLE
in the mandate — a compliance officer reads "payments to new beneficiaries held
24h" as part of stated authority, not a hidden implementation detail. For a POC
whose job is to show tangible benefit, that visibility is the point.

Honest limit to document: the gate only helps for conditions the VASP can compute.
The unchanged-amount / same-beneficiary recurring hallucination looks NORMAL and
deviation won't catch it — but a POST_GAP or periodic re-confirm gate WOULD
interrupt blind recurrence. So the field is a place to express checks that help,
not a guarantee.

BOUNDARY (avoid runtime-policy-engine overreach): `trigger` and `action` are small
FIXED ENUMS (new-beneficiary, amount-deviation, over-soft-limit, post-gap, maybe
velocity; confirm / hold / escalate). NOT an open expression language. A declarative
gate, not a programming surface.

### DECISION 12b: N-of-M agent approval (optional envelope constraint) — maker/checker for agents
The strongest hallucination mitigation: require TWO (or N) INDEPENDENT agents to
agree before a payment executes. Independence matters — a single agent hallucinates
consistently; a second, independently-reasoning agent (different model/data path)
is unlikely to share the same hallucination. This is the agentic form of multi-party
authorisation. GLEIF's paper EXPLICITLY flags that agent payments should support the
maker/checker and multi-signature processes that exist even without agents — so this
is a gap the initiatives NAMED, not out of scope.

MODELLABLE (reuses existing machinery): the REQUIREMENT for N-of-M approval is a
mandate envelope constraint ("requires 2 independent agent signatures for payments
over X, or to new beneficiaries"). It generalises the two-signature model (principal
signs envelope; agent signs instruction) to a REQUIRED SET of agent signatures on
the instruction, each with a distinct `agent_identity` block (section 11), ideally
different operators. The VASP checks the required number of distinct, independently-
attested agent signatures are present before executing — same shape as the envelope
check.

NOT MODELLABLE (state honestly): whether the agents are GENUINELY independent in
reasoning (different models, non-colluding, not fed the same hallucinated context).
The API asserts distinct identifiers/operators; it cannot verify reasoning
independence. Carry the requirement + identifiers; do not claim to guarantee
independence.

SCOPE BOUNDARY: this is an OPTIONAL envelope feature for high-risk mandates, NOT a
default (most agent payments need one agent; forcing two everywhere makes the family
look heavy). And multi-agent COORDINATION (how the agents reach agreement) is
someone else's layer (A2A / multi-agent protocols), same as credential issuance is
vLEI's. We model the REQUIREMENT and the CHECK; not the coordination.

### DECISION 12c: cite GLEIF + AP2 in the YAML field docs
In the built YAML, the agentic fields carry EXPLICIT references to the source
initiatives, to show the work does not stand alone and is deliberately aligned:
- `agent_identity` / attestation fields → reference AP2 and the KYA/DID/vLEI layer
  (AP2 does not carry agent identity; attestation comes from TAP / vLEI / tokens /
  DIDs). Cite the AP2 overview (ap2-protocol.org) and GLEIF AMC (Annex A).
- `MandateEnvelope`, `execution_gates`, N-of-M approval, credential-time vs runtime
  split → reference GLEIF "Agentic AI in Payments" (credential-time vs runtime;
  maker/checker/multi-signature; mandate scope = limits + counterparties + validity).
- principal_identifier choice → note the LEI (organisation) vs person-level anchor
  gap (GLEIF is organisation-first; section 5).
Purpose: positions pacs.crypto as the ISO 20022 payment-instruction + compliance
BINDING on top of GLEIF/AP2, and supports the planned article (section 8).

### DECISION 12d: where the gate lives — NOT an instruction field (clarification)
The gate touches THREE places, each the right one — and the instruction INPUT is
not one of them:
- RULES: in the mandate envelope (`execution_gates`), set once by the principal at
  authority-time. The agent does NOT declare gates; the principal does.
- EVALUATION: the VASP, at runtime, against its history for the mandate.
- OUTCOME: surfaced in the PAYMENT STATUS the VASP returns — not a simple
  accepted/rejected. The status model gains GATED STATES (e.g. HELD,
  AWAITING_HUMAN_CONFIRMATION, HELD_UNTIL<time>, ESCALATED) plus the triggering
  REASON (which gate fired).

So: NO gate field on the instruction input. The instruction stays clean. This
matters for the same reason the display-only envelope does — the agent cannot set
its own gates or declare itself un-gated; rules are in the principal-signed mandate,
evaluation is the VASP's, the agent just receives the verdict.

BUILD NOTE: the gated states + reason are an EXTENSION of the Instruction API's
existing status lifecycle, not a new instruction field and not a parallel status
model. Extend the status enumeration; add the reason.

────────────────────────────────────────────────────────────────────────
## 13. Intent misalignment — the third failure mode (bind, don't verify)
────────────────────────────────────────────────────────────────────────

Three distinct agent failure modes, now all named:
1. AUTHORISATION failure — agent does what it was not PERMITTED to. → mandate.
2. HALLUCINATION — agent acts on a false belief about the WORLD (invoice due when
   it isn't). → gates (12a) + N-of-M (12b), partially.
3. INTENT MISALIGNMENT (this section) — agent does something PERMITTED and
   factually grounded, but NOT what the user MEANT. It understood the instruction
   wrongly ("pay the supplier" → right supplier wrong amount, or a similar-named
   wrong supplier, or paid when the user meant "prepare for my review").

WHY IT IS THE HARDEST / FUNDAMENTALLY NOT SOLVABLE AT OUR LAYER: the user's true
intent lives only in their head and the natural-language instruction they gave the
agent — NEITHER reaches the payment layer. By the time an instruction arrives, intent
is already translated into a concrete payment; the misunderstanding, if any, is baked
in and invisible. You cannot check an action against an intent you never see. Do NOT
model "intent verification" / "intent matching" — it would be theatre and would give
false comfort about the one risk genuinely outside reach, undermining the parts that
are real.

WHAT THE LAYER CAN HONESTLY DO (limited):
- Gates (12a) give a human a SECOND LOOK at the concrete action — the one moment a
  misunderstanding could be caught. HONEST CAVEAT: only works if the human actually
  reads the confirmation; agent delegation erodes exactly that attention. Weak live
  lever, already covered by 12a — no new mechanism.
- Tight envelopes incidentally cap blast radius (allowlist catches wrong supplier,
  max amount caps wrong amount) — but that is the mandate doing its job, and misses
  the middle ("pay 4,900 when you meant 4,100" passes every check). No new mechanism.

### DECISION 13: OPTIONAL link to an upstream intent artifact (the one modellable thing)
Not prevention — AUDITABILITY. AP2's Intent Mandate captures the user's stated intent
BEFORE the agent acts, as a signed record. Our binding carries an OPTIONAL REFERENCE
to that upstream intent artifact, so the executed payment can be reconciled against
what the user originally asked for, AFTER THE FACT. (`mandate_reference` already
exists; this is a sibling intent reference, or the same mechanism pointing at the
intent artifact.)
- Honest claim: we do NOT prevent the misunderstanding (nothing at our layer can);
  we make it DISCOVERABLE by binding action → stated intent.
- Positioning: tech-world protocols carry the intent artifact; we are the layer that
  binds it to the ISO payment and makes it auditable in COMPLIANCE terms.
- SCOPE: optional field, a reference only. Do NOT overbuild this fundamentally
  unsolvable issue (Tom's steer). No intent-matching logic, no verification claim.

### 13 addendum: resolution belongs in the user's agent GUI, not the API
Sharpening (Tom): intent misalignment is best RESOLVED in the user-facing agent
interface, via a confirmation loop at the moment intent is formed — while the human
still holds the intent in their head. Example: "I understand you want to order 100
Lamborghini CARS, correct?" when the user meant 100 Lamborghini OUTBOARD MOTORS for
their shipbuilding. Only the GUI, upstream, can catch that; by the time the payment
reaches the API it simply says one or the other.

Division of labour (clean, honest):
- GUI (upstream, OUTSIDE our API) RESOLVES intent via the "did you mean X?" loop.
  This is where prevention actually happens. Not our layer, not in API comms.
- Our API REFERENCES the resulting intent artifact (optional link, DECISION 13) so
  the GUI's upstream resolution is VERIFIABLE DOWNSTREAM — in a dispute, you can show
  intent was confirmed and what it said.
So: the API does not resolve, verify, or participate in the confirmation; it binds
the payment to the record of what was confirmed. GUI resolves, API references.
Positioning: our binding connects the GUI's resolution to the ISO payment + compliance
record — without claiming to prevent the error.

────────────────────────────────────────────────────────────────────────
## 14. Considered and REJECTED: model-provider fields; risk-profile as a value
────────────────────────────────────────────────────────────────────────
(Recording rejections, not just decisions — stops these reopening later and shows
the boundary was reasoned.)

### 14a. Model-provider distinction (OpenAI- vs Claude-powered agent) — REJECTED
No model-provider protocol difference belongs in the payment API.
- The agent-payment stack is model-AGNOSTIC by design. AP2, vLEI, DID layer — none
  care which model reasons inside the agent. An agent presents identity + mandate +
  signature; what's inside is invisible and meant to be.
- GLEIF treats the agent as "an assembly of interfaces, LLMs, data sources and
  policies" whose model may CHANGE over time via retraining — which is exactly why
  they anchor identity to the DELEGATING ENTITY, not the model.
- A provider field would date instantly (models change; the mandate shouldn't) and
  invite brittle, fragmenting provider-specific trust logic ("trust Claude agents
  more"). Cuts against the whole open-standard grain.
CONCLUSION: below our data level. Model-agnostic by design. Do NOT add.

### 14b. Where genuine agent differences DO live
Real per-agent variation (autonomy, human-in-the-loop, capability, risk) is a
per-AGENT / per-DEPLOYMENT property, NOT a model-provider property — the same model
can power a tight treasury agent and a loose shopping agent. These already have homes:
- `agent_identity` attestation reference (section 11) — what this specific agent is.
- mandate envelope — what it may do.
- human-present signal (section 9) — how it operates.
All provider-neutral by construction.

### 14c. Risk profile — REFERENCE only, never a VALUE field — REJECTED as a field
Do NOT add a `risk_profile` VALUE field (e.g. risk_profile: HIGH).
- Defining a risk-profile field means defining what profiles MEAN (scale, categories,
  assessment, who's trusted to assign) — a scoring/assessment framework that lives in
  the KYA/attestation layer we CONSUME, not build.
- A value without its attestation is an unverifiable claim that LOOKS authoritative —
  worse than useless. Carrying the attestation behind it = building the KYA scoring
  system we said we wouldn't.
- A pacs.crypto risk vocabulary would compete with AP2/vLEI/KYA taxonomies — the
  "parallel and competing approach" GLEIF warns against.
DECISION: carry a REFERENCE to the agent's attested risk/capability profile, the same
way `agent_identity.attestation` carries {scheme, reference}. Likely a sub-reference
under attestation, not a first-class field. The value stays where it was assessed;
our API makes it REACHABLE and BOUND to the payment.
LINE: carry a reference to a risk profile; NEVER carry a risk-profile value. The first
is a pointer the API is honest about; the second is a claim the API can't stand behind.

────────────────────────────────────────────────────────────────────────
## 15. Unique-value items: audit extension (soon) + pre-payment check (later)
────────────────────────────────────────────────────────────────────────
Both exploit the vantage ONLY our layer has: the downstream, post-settlement,
compliance-complete view that AP2/vLEI do not see.

### 15a. Agentic audit/report extension — NEAR-TERM (do relatively soon)
Confirmed CONSEQUENCE of sections 9 + 11, not a new idea. Audit and reporting
records for users AT OUR LEVEL (the compliance officer) must carry the agentic
facts: which agent initiated, under which mandate, human-present or not, whether a
gate fired, the agent_identity / operator references, and (section 13) the intent-
artifact link. This is honest unique value — the audit trail is something our layer
OWNS. Folds into the Regulatory Reporting / audit work that already percolates after
the Instruction + Travel Rule build. Tom: do this relatively soon.

### 15b. Pre-payment acceptance check — V-NEXT (later, maybe)
Scenario: originator instructs → a BRIDGE converts mid-flow → creditor VASP delivers
the receiving coin. The creditor VASP sees "agent-initiated" in the Travel Rule data
and might, for policy/regulatory reasons, decline agent-initiated payments (or above
a size / below an assurance level).
- v1 SAFETY NET already exists: the return-payment mechanism (earlier E&I / exception
  work). Nothing breaks today — a declined agentic payment returns. So this is an
  OPTIMISATION, not a correctness requirement.
- THE WANT: discovering the refusal AFTER the payment has flowed, BRIDGED (conversion
  cost + slippage, paid twice to unwind), and arrived is wasteful and slow. A pre-flight
  check — "will you accept a payment of this shape?" — avoids the round-trip. Kin to an
  account-verification / reachability check (idiomatic: cf. the family's Account
  Verification → EPC Validation of Payee lineage).

CAVEATS (scope it right when the time comes):
1. LATER, not now. It is an optimisation; the return path already makes the system
   correct. Do NOT pull into the first build.
2. BROADER THAN AGENTIC. It is "will the receiving side accept a payment with THESE
   PROPERTIES" — agent-initiated is ONE property among coin, amount, jurisdiction,
   sanctions posture. Build it as a GENERAL pre-flight acceptance check that includes
   agentic attributes, NOT an agent-specific API. Avoid mis-scoping as "agentic
   pre-check".
3. OPTIONAL + SITUATIONAL. A pre-flight round-trip cuts against the straight-through
   automation that is the appeal of agent payments. It pays off when the downstream
   cost of rejection is HIGH (bridge conversion, cross-jurisdiction) and is dead weight
   when rejection is cheap. Use when the flow warrants it (bridge present, high value);
   skip for safe straight-through. Same optional-not-default discipline as N-of-M.

────────────────────────────────────────────────────────────────────────
## 16. Review corrections (applied to v1.4 build)
────────────────────────────────────────────────────────────────────────
Tom's first-review catches on the built YAMLs:

16a. TERMINOLOGY: "agent" is overloaded in ISO 20022 (debtor_agent, creditor_agent,
     AgentIdentification = financial INSTITUTIONS). Our AI-agent additions are
     renamed AIAgent* / ai_agent_* throughout both APIs to disambiguate. ISO FI-agent
     fields untouched.

16b. allowed_counterparties: now ENCOURAGES LEI (structured object: lei preferred,
     wallet/other fallback) rather than bare strings — consistent with family party
     identification, better for compliance. LEI encouraged, NOT required (a wallet
     with no LEI is a legitimate entry).

16c. declared_envelope_for_display mismatch handling: SHOULD → MUST. The VASP MUST
     compare declared vs authoritative and MUST surface any mismatch (red flag for a
     misbehaving agent). Block-vs-flag on mismatch is VASP policy; authoritative
     envelope always governs enforcement.

16d. N-of-M EVIDENCE GAP (Tom caught a real design hole, not just wording):
     - Wording: "N-of-M" now spelled out with an example (2 of 3 = any two of three
       authorised agents must approve).
     - ORDERING clarified: multi-agent approval happens BEFORE the instruction is
       submitted; the payment API triggers AFTER.
     - THE GAP: the envelope stated the REQUIREMENT (N approvals) but the instruction
       had nowhere to carry the EVIDENCE that approvals happened. Added
       `ai_agent_authorisation.approving_ai_agents[]` — each approving agent's
       identifier + signature over the instruction + optional operator/timestamp. The
       VASP MUST verify the count of distinct validly-signed attested approvers meets
       `required` before executing; else status AWAITING_AGENT_APPROVALS.
     - HONEST LIMIT retained: signatures prove N distinct agents approved THIS exact
       instruction (authentication); they do NOT prove independent reasoning (not
       checkable at this layer).

────────────────────────────────────────────────────────────────────────
## 17. Credential-expressiveness check: do we need a mandate API? (NO)
────────────────────────────────────────────────────────────────────────
Verified against AP2 / Verifiable Intent / GLEIF (search, not memory). Answers
Tom's question: are all mandate-scope details set by GLEIF/AP2, and do we need a
mandate API at our level?

### AP2 Intent Mandate — what it can express
Structured as a W3C Verifiable Credential (SD-JWT+kb, ECDSA P-256, detached JWS
over RFC-8785 JCS payload). Hard constraints: max price, item specification,
expiry/TTL, allowed merchants, agent identity reference. The Verifiable Intent
constraint vocabulary adds named types: allowed_merchants, line_items,
allowed_payees, amount_range, budget cap, merchant-managed recurrence.
GLEIF AMC is at a similar level: payment class, counterparties, transaction
ceilings, validity period.

### Map against our MandateEnvelope
EXPRESSIBLE in AP2/GLEIF today (these genuinely live in the signed external
mandate; our declared_envelope_for_display is a faithful echo of what was signed):
  - max_amount            → price cap / amount_range / budget
  - validity              → TTL / expiry
  - allowed_counterparties→ allowed_merchants / allowed_payees
  - repeatability         → one-time vs ongoing authorization scope
  - escalation            → human-present / human-not-present
NOT EXPRESSIBLE in their current vocabulary (commerce/identity-oriented; no chain/
token notion):
  - allowed_chains_tokens (chain DLIs, token DTIs)
  - DTI-denominated amounts
  - crypto-native execution_gates triggers (POST_GAP, on-chain deviation)

### Decisions
17a. NO MANDATE API AT OUR LEVEL — confirmed. Issuance, scope-setting and signing
     all live in AP2/GLEIF, both of which use an EXTENSIBLE constraint model (AP2
     nests all its fields under an `ap2` object precisely so new constraint types
     slot in and the base schema stays clean). Building a mandate-issuance API
     would be the parallel-credential overreach we ruled out. We consume theirs.

17b. CRYPTO-NATIVE CONSTRAINTS ARE THE ONE GAP — and the shape of the fix is a
     FORK (open decision, Tom to weigh):
       (a) Define a crypto-native CONSTRAINT-TYPE EXTENSION for the AP2 / Verifiable
           Intent mandate vocabulary ("pacs.crypto crypto-asset constraint
           extension": allowed chains/tokens, DTI amounts, on-chain gate triggers).
           Collaborative, on-brand — the mandate-layer equivalent of the Travel Rule
           binding: not a competing format, a crypto-native extension to theirs. The
           extension mechanism to do this ALREADY EXISTS (the `ap2` object / VI
           constraint-type registry). PREFERRED direction.
       (b) OR enforce the crypto-native constraints VASP-side as policy that is NOT
           principal-signed. Weaker: those constraints would not carry the principal's
           signature, so they are not part of the verifiable authority — only a local
           check. Acceptable as a fallback / interim, but loses the "principal signed
           this limit" property for the crypto-specific constraints.
     This is the most valuable thing the check surfaced: our highest-leverage mandate-
     layer contribution is likely defining the crypto-native constraint extension (a),
     a precise bounded collaborative gap, rather than anything standalone.

### Consequence for declared_envelope_for_display
Two kinds of constraint now distinguished: those AP2/GLEIF can carry (faithfully
echoed from the signed credential) and the crypto-native ones they cannot (which,
until (a) exists, cannot be "verified against the credential" and would fall to
VASP-side policy per (b)). Worth making explicit in the field doc at build-hardening
time, so implementers know which envelope constraints are principal-signed and which
are (currently) local policy.

### Article angle (Tom flagged this as an interesting paragraph)
The expressiveness map is a clean article beat: AP2/VI and GLEIF already express the
GENERIC authority envelope (amount, validity, counterparties, recurrence) as an
extensible signed-credential constraint vocabulary — but have no CRYPTO-NATIVE
constraint types (chains, tokens, DTI). pacs.crypto's contribution at the mandate
layer is therefore not another mandate format but a crypto-asset constraint EXTENSION
to theirs, mirroring how the whole project is the ISO 20022 + compliance BINDING on
top of the convergent identity/authority stack. Reinforces the three-layer story and
the "extend, don't compete" positioning.

────────────────────────────────────────────────────────────────────────
## 18. Action-scoped mandate (v1.4 refactor) — the mandate grants ACTION CLASSES
────────────────────────────────────────────────────────────────────────
Tom's catch: the mandate was implicitly "permission to pay" (envelope = payment
constraints). But an agent also raises investigations, moves liquidity, amends
limits — DIFFERENT permissions a principal may grant or withhold INDEPENDENTLY.
So a mandate grants permission to perform specific CLASSES OF ACTION, each with its
own constraints — not a blanket transact permission. More correct, and better
aligned with GLEIF/AP2 (which describe a mandate's SCOPE OF ACTION / payment class,
not only amount limits).

REFACTOR APPLIED to Instruction API MandateEnvelope:
- MandateEnvelope now has `authorised_actions[]`; mandate-wide `validity` and
  `repeatability` stay at the top; each action entry has an `action_class` +
  class-specific constraints.
- action_class enum: INITIATE_PAYMENT, RAISE_INVESTIGATION, MANAGE_LIQUIDITY,
  AMEND_LIMIT (extensible).
- PaymentActionConstraints: everything the old flat envelope had (max_amount,
  allowed_counterparties, allowed_chains_tokens, escalation_threshold,
  required_ai_agent_approvals, execution_gates) moved HERE, under INITIATE_PAYMENT.
  Nothing lost — moved one level down.
- LiquidityActionConstraints: max_transfer_amount, allowed_accounts,
  max_limit_ceiling (caps how high AMEND_LIMIT may set), escalation_threshold.
- InvestigationActionConstraints: minimal (allowed_responders, max_open_investigations)
  — raising an investigation moves INFORMATION not value, so lower-stakes.
- VASP check is now TWO-LEVEL: (1) is the action's class in authorised_actions at
  all? (2) within that class's constraints? A payment-only mandate attempting a
  limit amendment fails at level 1 — this is what makes "may pay but not amend
  limits" actually enforceable.
- Both Instruction examples rewrapped; the high-value one now shows an agent
  authorised for BOTH payment AND liquidity with different per-class constraints.

DOWNSTREAM APIs consume the same mandate (no parallel mandate systems):
- E&I (exception-investigation-api-v1.4): initiating_ai_agent disclosure on the
  investigation-raising schema; agent needs RAISE_INVESTIGATION scope. Disclosure-
  level (identified + scope-checked, no payment-style gates).
- Liquidity (liquidity-management-api-v1.4): initiating_ai_agent disclosure on
  WalletTransfer (needs MANAGE_LIQUIDITY) and WalletLimitAmendment (needs
  AMEND_LIMIT, bounded by max_limit_ceiling). Value-like, so real constraints apply.
- Reporting (regulatory-reporting-api-v1.4): AgentInitiationDisclosure on
  TransactionRecord — first-class reportable/filterable (see section 15a / §below).

The InitiatingAIAgent disclosure block is the SAME compliance-visible shape across
Travel Rule, E&I and Liquidity (consistency; authority/verification stay at the
Instruction layer). Reporting uses the richer AgentInitiationDisclosure (adds the
filter dimensions: multi_agent_approved, gate_fired, intent ref).
