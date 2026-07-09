// Epic 23 — Agentic-payment settlement binding.
//
// Maps an x402-style agent payment intent (HTTP 402 / EIP-712 stablecoin
// micropayment) into a compliant pacs.crypto instruction submission, so
// pacs.crypto is the regulated settlement + Travel Rule leg behind machine
// micropayments. The agent's verified principal becomes the debtor; the
// resource server becomes the creditor. Network/asset are resolved to ISO 24165
// DLI/DTI via the supplied resolver (DTI-first, per Epic 15). Anything that
// still needs human/compliance resolution is returned in `warnings` rather than
// fabricated — notably Travel Rule identity, which the agent layer rarely holds.

function resolve(map, key, fallback = null) {
  if (!map || key === undefined || key === null) return fallback;
  // Only own properties — otherwise keys like 'constructor'/'toString' would
  // resolve to inherited Object.prototype members. Also treat '' as unresolved so
  // chain_dli/token_dti stay consistent with the "unresolvable" warning.
  for (const k of [key, String(key)]) {
    if (Object.prototype.hasOwnProperty.call(map, k)) {
      const value = map[k];
      if (value !== undefined && value !== null && value !== '') return value;
    }
  }
  return fallback;
}

export function x402IntentToInstruction(intent = {}, options = {}) {
  const { networkToDli = {}, assetToDti = {} } = options;
  const warnings = [];

  const chainDli = resolve(networkToDli, intent.network, null);
  const tokenDti = resolve(assetToDti, intent.asset, null);
  if (!chainDli) warnings.push('network could not be resolved to an ISO 24165 DLI');
  if (!tokenDti) warnings.push('asset could not be resolved to an ISO 24165 DTI');

  const payer = intent.payer ?? {};
  if (!payer.name) warnings.push('payer.name missing — required for a valid instruction');
  if (intent.amount === undefined || intent.amount === null || intent.amount === '') {
    warnings.push('amount missing — required for a valid instruction');
  }

  const debtor = {};
  if (payer.name) debtor.name = payer.name;
  if (payer.lei) debtor.lei = payer.lei;
  if (payer.vlei_credential) debtor.vlei_credential = payer.vlei_credential;

  const blockchainInstruction = {
    token: {
      token_symbol: intent.asset ?? 'USDC',
      ...(tokenDti ? { token_dti: tokenDti } : {}),
    },
    chain_dli: chainDli,
    // Agent-initiated transfers are typically originator-executed; SELF_CUSTODY
    // records that, FULL_CUSTODY if a VASP executes on the agent's behalf.
    custody_model: intent.custody_model ?? 'SELF_CUSTODY',
    settlement_transport: intent.settlement_transport ?? 'DIRECT_EVM',
  };
  const instruction = {
    payment_identification: {
      end_to_end_identification:
        intent.resource ?? intent.nonce ?? intent.id ?? 'x402-intent',
    },
    charge_bearer: 'DEBT',
    debtor,
    creditor: { name: intent.payee?.name ?? 'x402 resource server' },
    interbank_settlement_amount: {
      amount: intent.amount != null ? String(intent.amount) : undefined,
      currency: intent.currency ?? 'USD',
    },
    blockchain_instruction: blockchainInstruction,
  };
  // creditor_account belongs at the top level (pacs.008): nesting it under
  // blockchain_instruction would drop the beneficiary wallet during normalisation.
  if (intent.payTo) {
    instruction.creditor_account = {
      proxy: { type: { code: 'EWAL' }, identification: intent.payTo },
    };
  }

  // The agent layer holds payment intent, not counterparty Travel Rule identity.
  warnings.push(
    'Travel Rule data is not derivable from an x402 intent; submit a linked travel_rule_record_id where the corridor requires it',
  );

  return { instruction, warnings };
}
