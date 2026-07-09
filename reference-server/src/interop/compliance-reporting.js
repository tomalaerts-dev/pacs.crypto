// Epic 22 — Multi-regime compliance-reporting substrate.
//
// One canonical record (built from an instruction + its settlement context)
// emits regime-specific filings, because the regimes are deliberately
// incompatible (MiCA vs GENIUS vs others). The substrate sits *underneath* the
// regulator-specific filing pipelines a CASP already operates — it produces the
// data, not the vertical filing flow. Sanctions reasoning is never included.

function pickParty(party = {}) {
  return { name: party?.name ?? null, lei: party?.lei ?? null };
}

export function buildComplianceRecord(context = {}) {
  return {
    record_id: context.instruction_id ?? null,
    uetr: context.uetr ?? null,
    parties: {
      originator: pickParty(context.debtor),
      beneficiary: pickParty(context.creditor),
    },
    asset: {
      token_dti: context.token_dti ?? null,
      chain_dli: context.chain_dli ?? null,
    },
    amount: context.amount ?? null,
    currency: context.currency ?? null,
    travel_rule_record_id: context.travel_rule_record_id ?? null,
    settlement: {
      transaction_hash: context.transaction_hash ?? null,
      settled_at: context.settled_at ?? null,
    },
  };
}

export function toRegimeFiling(record = {}, regime) {
  if (regime === 'MICA') {
    // Representative ESMA MiCA CASP transaction report (auth.117 family). DTI is
    // primary per the ESMA ISO 24165 mandate (Epic 15).
    return {
      regime: 'MICA',
      schema: 'auth.117',
      report: {
        transactionIdentification: record.record_id,
        originatorLei: record.parties?.originator?.lei ?? null,
        beneficiaryLei: record.parties?.beneficiary?.lei ?? null,
        digitalTokenIdentifier: record.asset?.token_dti ?? null,
        distributedLedgerIdentifier: record.asset?.chain_dli ?? null,
        amount: record.amount,
        currency: record.currency,
        onChainReference: record.settlement?.transaction_hash ?? null,
      },
    };
  }

  if (regime === 'GENIUS') {
    return {
      regime: 'GENIUS',
      schema: 'payment-stablecoin-transaction',
      report: {
        transaction_id: record.record_id,
        originator: record.parties?.originator?.name ?? null,
        beneficiary: record.parties?.beneficiary?.name ?? null,
        token_dti: record.asset?.token_dti ?? null,
        amount: record.amount,
        currency: record.currency,
        tx_hash: record.settlement?.transaction_hash ?? null,
      },
    };
  }

  throw new Error(`Unsupported reporting regime: ${regime}`);
}

export function emitFilings(record, regimes = ['MICA', 'GENIUS']) {
  return regimes.map((regime) => toRegimeFiling(record, regime));
}
