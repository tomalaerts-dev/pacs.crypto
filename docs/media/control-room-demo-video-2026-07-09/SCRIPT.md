# pacs.crypto Control Room video script

## Narration

This is the pacs dot crypto Bank-to-VASP Control Room: a presenter-grade walkthrough of one compliant USDC payment from bank instruction to VASP settlement evidence.

We start in MOCK mode. Nothing here needs a server, a wallet, or a funded chain. The page is using bundled happy-path payloads, so a reviewer can inspect the full lifecycle safely.

Step one submits the Travel Rule record. Step two shows the beneficiary VASP callback accepting that compliance context. Step three moves to the quote surface: fees, chain, custody model, and token identity are separated before execution.

Then the instruction is submitted. The Control Room keeps the commercial payment identifiers visible, while chain execution moves through pending, broadcast, confirming, and final states. That separation is the point: status, finality, webhooks, and reporting are linked, but not collapsed into one oversized API response.

The evidence panel shows what the reviewer should trust at each point. The payload panel flips between request and response bodies. The traceability spine reveals identifiers only when they exist: record id, quote id, instruction id, transaction hash, block, notification, and creditor statement.

The reporting steps close the loop with camt-style creditor notification and statement views derived from the same payment.

Finally, the shell switches to local LIVE API mode against the reference server on localhost. That exercises real request validation and lifecycle handling with the default mock adapter only. No production system, no publication gate, and no funded Sepolia transaction are implied.

This is a narrow execution wedge: reviewer-friendly, auditable, and ready for the next demo gate.
