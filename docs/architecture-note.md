# Architecture Note

This note explains what changed once `pacs.crypto` moved from proposal specs to
an executable reference stack.

## Original Center Of Gravity

The original repo strength was standards framing:

- `pacs.008` alignment
- blockchain-specific field extensions
- Travel Rule and instruction proposals
- simulator-driven readability

That was useful, but still left an open question:

- would the model stay coherent once it had to persist state, expose lifecycles,
  and produce operational outputs?

## What Changed In Implementation

### 1. The repo narrowed to one wedge

Instead of expanding breadth, the implementation fixed scope to:

- `USDC`
- one `EVM` chain family
- one `FULL_CUSTODY` model
- one bank-to-VASP payment corridor

This was the right tradeoff because credibility comes from one narrow flow that
works, not from a broader but shallower standards family.

### 2. The instruction API stopped carrying everything

A major implementation lesson was that blockchain payment execution should not
collapse into one giant instruction response.

The current split is:

- `instruction` as the command/orchestration surface
- `execution-status` as the lifecycle read surface
- `finality-receipt` as settlement proof
- reporting surfaces for booked-entry outputs

That is the closest analogue to how real payment ecosystems separate command,
status, settlement, and reporting concerns.

### 3. Lifecycle realism moved behind an adapter

Another key change was architectural rather than presentational:

- quote realism
- fee modeling
- broadcast/inclusion/finality timing
- settlement defaults

now live behind a chain adapter boundary.

That matters because later testnet work can replace adapter internals without
rewriting the route layer.

### 4. Push delivery became an outbox problem

The implementation made webhook behavior explicit:

- outbox event persistence
- canonical payload reuse
- signed delivery attempts
- retries
- dead-letter handling and operator reads

This is more credible than an undocumented “status callback” story because the
repo now shows how push and poll relate operationally.

### 5. Reporting became a first-class family

A useful implementation outcome was that reporting could not remain an afterthought.

The repo now includes:

- `camt.054`-like booked notifications
- `camt.052`-like intraday view
- `camt.053`-like statement view

Those surfaces reuse the same identifiers as instruction and status reads, which
is what makes the stack feel operationally coherent.

## What Stayed Intentionally Narrow

The implementation did not try to win by multiplying surface area.

Still deferred:

- delegated signing
- non-EVM chains
- testnet execution
- exception-family APIs
- broader tokenized-asset/CBDC/DeFi expansion

That restraint is part of the design quality, not a missing ambition signal.

## Why This Matters

The project now demonstrates something materially stronger than “an ISO 20022
proposal for crypto payments.”

It demonstrates:

- a message-family disciplined reference architecture
- executable request/response behavior
- traceable lifecycle state
- believable settlement semantics for the current wedge
- booked reporting derived from the same payment objects

That is the architectural shift that makes the repo credible to a standards-savvy reviewer.
