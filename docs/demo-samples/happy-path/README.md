# Happy-Path Sample Pack

This directory contains the canonical sample payloads for the current reviewer
demo:

- `USDC`
- `EVM`
- `FULL_CUSTODY`
- Travel Rule accepted before instruction execution
- lifecycle progressed through `PENDING -> BROADCAST -> CONFIRMING -> FINAL`

These payloads were generated from the current local reference implementation on
`2026-04-22`.

## Included Files

- `01-travel-rule-submit.request.json`
- `02-travel-rule-submit.response.json`
- `03-travel-rule-callback.request.json`
- `04-travel-rule-callback.response.json`
- `05-instruction-quote.request.json`
- `06-instruction-quote.response.json`
- `07-instruction-submit.request.json`
- `08-instruction-submit.response.json`
- `09-execution-status.final.response.json`
- `10-finality-receipt.final.response.json`
- `11-reporting-notification.creditor.response.json`
- `12-reporting-statement.creditor.response.json`

## Notes

- IDs and timestamps come from one generated run and are intentionally kept
  consistent across the pack.
- The reporting samples use the creditor-side objects to keep the pack compact.
- The live server also exposes the symmetric debtor-side reporting objects.
