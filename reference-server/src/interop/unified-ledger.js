// Epic 24 — Unified-ledger / tokenised-deposit interop profile (BIS Agorá model).
//
// REFERENCE SCAFFOLD ONLY. The epic is gated on external maturity (BIS Agorá
// outcomes, tokenised-deposit production rollouts); this is not a production
// commitment, just a tested shape that demonstrates the bank-edge direction.
//
// It expresses the unified-ledger idea of running compliance "simultaneously"
// with settlement as a single structured pre-settlement record: the settlement
// intent plus the compliance checks a unified ledger would evaluate atomically.
// Each compliance check is a readiness posture (a boolean), never a sanctions
// finding — the family's anti-tipping-off discipline still binds.

export function buildUnifiedLedgerPreSettlement(context = {}) {
  return {
    profile: 'BIS_AGORA_UNIFIED_LEDGER',
    status: 'PROPOSED',
    atomic: true,
    settlement_intent: {
      instruction_id: context.instruction_id ?? null,
      debtor_account: context.debtor_account ?? null,
      creditor_account: context.creditor_account ?? null,
      amount: context.amount ?? null,
      currency: context.currency ?? null,
      token_dti: context.token_dti ?? null,
      asset_type: context.asset_type ?? 'TOKENISED_DEPOSIT',
    },
    compliance_posture: {
      aml_checked: Boolean(context.aml_checked),
      sanctions_screened: Boolean(context.sanctions_screened),
      limit_within_bounds: Boolean(context.limit_within_bounds),
      travel_rule_record_id: context.travel_rule_record_id ?? null,
    },
  };
}

export function isSettlementReady(preSettlement = {}) {
  const posture = preSettlement.compliance_posture ?? {};
  const reasons = [];
  if (!posture.aml_checked) reasons.push('aml not checked');
  if (!posture.sanctions_screened) reasons.push('sanctions not screened');
  if (!posture.limit_within_bounds) reasons.push('limit not within bounds');
  return { ready: reasons.length === 0, reasons };
}
