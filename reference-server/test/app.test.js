import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { buildApp } from '../src/app.js';
import { createMockEvmChainAdapter } from '../src/chain/mock-evm-adapter.js';
import { createSepoliaUsdcAdapter } from '../src/chain/sepolia-usdc-adapter.js';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, overrides = {}) {
  if (!isObject(base) || !isObject(overrides)) {
    return overrides === undefined ? base : overrides;
  }

  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (isObject(value) && isObject(base[key])) {
      result[key] = deepMerge(base[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function buildQuoteRequest(overrides = {}) {
  return deepMerge(
    {
      token: {
        token_symbol: 'USDC',
        token_dti: '4H95J0R2X',
      },
      chain_dli: 'X9J9XDMTD',
      amount: '250000.00',
      currency: 'USD',
      custody_model: 'FULL_CUSTODY',
    },
    overrides,
  );
}

function buildInstructionPayload(overrides = {}) {
  return deepMerge(
    {
      payment_identification: {
        end_to_end_identification: 'INV-BASE',
      },
      charge_bearer: 'DEBT',
      debtor: {
        name: 'Acme Trading GmbH',
        lei: '529900T8BM49AURSDO55',
      },
      debtor_agent: {
        name: 'Bankhaus Example AG',
        lei: '7245007VX57GR4IUVZ79',
      },
      creditor: {
        name: 'Bravo Supplies B.V.',
        lei: '724500QHKL6MVSQQ1Z17',
      },
      creditor_agent: {
        name: 'Kraken Belgium BVBA',
        lei: '635400DUFB71VFOHVB49',
      },
      interbank_settlement_amount: {
        amount: '250000.00',
        currency: 'USD',
      },
      blockchain_instruction: {
        token: {
          token_symbol: 'USDC',
          token_dti: '4H95J0R2X',
        },
        chain_dli: 'X9J9XDMTD',
        custody_model: 'FULL_CUSTODY',
      },
    },
    overrides,
  );
}

function buildTravelRuleSubmission(overrides = {}) {
  return deepMerge(
    {
      submission_timing: 'PRE_TX',
      travel_rule_data: {
        payment_identification: {
          end_to_end_identification: 'E2E-TR-BASE',
        },
        interbank_settlement_amount: {
          amount: '50000.00',
          currency: 'EUR',
        },
        charge_bearer: 'SHAR',
        debtor: {
          name: 'Acme Trading GmbH',
          postal_address: {
            country: 'DE',
          },
        },
        debtor_account: {
          proxy: {
            identification: '0xabc',
          },
        },
        debtor_agent: {
          name: 'Coinbase Europe Ltd',
          lei: '7245007VX57GR4IUVZ79',
        },
        creditor: {
          name: 'Bravo Supplies B.V.',
          postal_address: {
            country: 'NL',
          },
        },
        creditor_account: {
          proxy: {
            identification: '0xdef',
          },
        },
        creditor_agent: {
          name: 'Kraken Belgium BVBA',
          lei: '635400DUFB71VFOHVB49',
        },
        counterparty_wallet_type: 'HOSTED',
        blockchain_settlement: {
          primary_chain_id: 'DLID/X9J9XDMTD',
          legs: [{ leg_type: 'ORIGINATION' }],
        },
      },
    },
    overrides,
  );
}

function buildTravelRuleCallback(overrides = {}) {
  return deepMerge(
    {
      callback_status: 'ACCEPTED',
      receiving_vasp: {
        name: 'Bitvavo B.V.',
        lei: '635400DUFB71VFOHVB49',
      },
      callback_timestamp: new Date().toISOString(),
    },
    overrides,
  );
}

function buildInvestigationCasePayload(overrides = {}) {
  return deepMerge(
    {
      case_type: 'BENEFICIARY_CREDIT_QUERY',
      priority: 'HIGH',
      requires_counterparty_action: true,
      reason_code: 'BENEFICIARY_NOT_CREDITED',
      narrative:
        'Beneficiary reports no credit despite final on-chain settlement.',
      opened_by: {
        name: 'Acme Bank Operations',
      },
      counterparty: {
        name: 'Receiving VASP Operations',
      },
    },
    overrides,
  );
}

function buildReturnCasePayload(overrides = {}) {
  return deepMerge(
    {
      return_type: 'CUSTOMER_REFUND',
      return_method: 'OFF_CHAIN_REFUND',
      return_amount: {
        amount: '250000.00',
        currency: 'USD',
      },
      reason_code: 'BENEFICIARY_REJECTED_FUNDS',
      narrative:
        'Funds must be remediated after beneficiary-side exception handling.',
      opened_by: {
        name: 'Acme Bank Operations',
      },
      counterparty: {
        name: 'Receiving VASP Operations',
      },
    },
    overrides,
  );
}

function assertUuid(value) {
  assert.match(
    value,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
}

function assertIsoDateTime(value) {
  assert.equal(Number.isNaN(Date.parse(value)), false);
}

function assertTravelRuleRecordShape(record) {
  assertUuid(record.record_id);
  assertIsoDateTime(record.submitted_at);
  assert.ok(record.status);
  assert.ok(record.travel_rule_data);
}

function assertTravelRuleSearchResponseShape(response) {
  assert.equal(typeof response.total_matched, 'number');
  assert.equal(typeof response.page_size, 'number');
  assertIsoDateTime(response.generated_at);
  assert.ok(Array.isArray(response.records));
}

function assertTravelRuleStatsResponseShape(response) {
  assertIsoDateTime(response.generated_at);
  assert.ok(response.period);
  assert.ok(response.totals);
  assert.equal(typeof response.totals.record_count, 'number');
  assert.ok(Array.isArray(response.totals.volumes));
}

function assertQuoteResponseShape(response) {
  assertUuid(response.quote_id);
  assertIsoDateTime(response.valid_until);
  assertIsoDateTime(response.created_at);
  assert.ok(response.fee_estimate);
}

function assertInstructionResponseShape(response) {
  assertUuid(response.instruction_id);
  assertUuid(response.uetr);
  assert.ok(response.status);
  assert.ok(response.custody_model);
  assert.ok(response.fee_estimate);
  assertIsoDateTime(response.created_at);
}

function assertInstructionStatusResponseShape(response) {
  assertUuid(response.instruction_id);
  assertUuid(response.uetr);
  assert.ok(response.status);
  assert.ok(response.payment_identification);
  assert.ok(response.interbank_settlement_amount);
  assert.ok(response.blockchain_instruction);
  assertIsoDateTime(response.created_at);
  assertIsoDateTime(response.updated_at);
}

function assertInstructionSearchResponseShape(response) {
  assert.equal(typeof response.total_matched, 'number');
  assert.equal(typeof response.page_size, 'number');
  assertIsoDateTime(response.generated_at);
  assert.ok(Array.isArray(response.instructions));
}

function assertTravelRuleCallbackReceiptShape(response) {
  assertUuid(response.record_id);
  assertIsoDateTime(response.callback_recorded_at);
  assert.ok(response.current_status);
}

function assertCancellationResponseShape(response) {
  assertUuid(response.instruction_id);
  assert.equal(response.status, 'CANCELLED');
  assertIsoDateTime(response.cancelled_at);
}

function assertAdapterMetadataShape(metadata, expectedAdapterId = null) {
  assert.ok(metadata);
  assert.equal(typeof metadata.adapter_id, 'string');
  assert.equal(typeof metadata.adapter_mode, 'string');
  assert.equal(typeof metadata.chain_family, 'string');
  assert.equal(typeof metadata.chain_dli, 'string');
  assert.ok(metadata.lifecycle_policy);
  assert.ok(metadata.fee_model);
  if (expectedAdapterId) {
    assert.equal(metadata.adapter_id, expectedAdapterId);
  }
}

function assertInvestigationCaseShape(response) {
  assertUuid(response.investigation_case_id);
  assert.equal(response.exception_type, 'INVESTIGATION');
  assertUuid(response.related_instruction_id);
  assertUuid(response.related_uetr);
  assertIsoDateTime(response.opened_at);
  assertIsoDateTime(response.updated_at);
  assert.ok(Array.isArray(response.status_history));
  assert.ok(response.traceability);
}

function assertReturnCaseShape(response) {
  assertUuid(response.return_case_id);
  assert.equal(response.exception_type, 'RETURN');
  assertUuid(response.original_instruction_id);
  assertUuid(response.original_uetr);
  assertIsoDateTime(response.opened_at);
  assertIsoDateTime(response.updated_at);
  assert.ok(Array.isArray(response.status_history));
  assert.ok(response.traceability);
}

async function waitFor(assertion, { timeoutMs = 1500, intervalMs = 20 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      return await assertion();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => {
        setTimeout(resolve, intervalMs);
      });
    }
  }

  throw lastError ?? new Error('Timed out waiting for condition.');
}

test('travel rule submit -> callback -> retrieve', async () => {
  const app = await buildApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/travel-rule',
    payload: buildTravelRuleSubmission({
      travel_rule_data: {
        payment_identification: {
          end_to_end_identification: 'E2E-TR-001',
        },
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);
  const createdRecord = createResponse.json();
  assertTravelRuleRecordShape(createdRecord);
  assert.equal(createdRecord.status, 'SUBMITTED');
  assert.equal(createdRecord.submission_timing, 'PRE_TX');

  const callbackResponse = await app.inject({
    method: 'POST',
    url: `/travel-rule/${createdRecord.record_id}/callback`,
    payload: buildTravelRuleCallback({
      description: 'Data quality sufficient.',
    }),
  });

  assert.equal(callbackResponse.statusCode, 200);
  assertTravelRuleCallbackReceiptShape(callbackResponse.json());
  assert.equal(callbackResponse.json().current_status, 'ACCEPTED');
  assert.equal(callbackResponse.json().previous_status, 'SUBMITTED');

  const getResponse = await app.inject({
    method: 'GET',
    url: `/travel-rule/${createdRecord.record_id}`,
  });

  assert.equal(getResponse.statusCode, 200);
  assert.equal(getResponse.json().callbacks.length, 1);
  assertTravelRuleRecordShape(getResponse.json());

  await app.close();
});

test('quote -> instruction -> get status', async () => {
  const app = await buildApp();

  const quoteResponse = await app.inject({
    method: 'POST',
    url: '/instruction/quote',
    payload: buildQuoteRequest(),
  });

  assert.equal(quoteResponse.statusCode, 200);
  const quote = quoteResponse.json();
  assertQuoteResponseShape(quote);
  assert.ok(quote.quote_id);
  assertAdapterMetadataShape(quote.adapter_metadata, 'mock-evm');

  const instructionResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-042',
        quote_id: quote.quote_id,
      },
      interbank_settlement_amount: {
        amount: '250000.00',
        currency: 'USD',
      },
    }),
  });

  assert.equal(instructionResponse.statusCode, 201);
  const instruction = instructionResponse.json();
  assertInstructionResponseShape(instruction);
  assert.equal(instruction.status, 'PENDING');
  assert.equal(instruction.debit_timing, 'ON_BROADCAST');
  assert.ok(instruction.fee_estimate);
  assertAdapterMetadataShape(instruction.adapter_metadata, 'mock-evm');

  const getResponse = await app.inject({
    method: 'GET',
    url: `/instruction/${instruction.instruction_id}`,
  });

  assert.equal(getResponse.statusCode, 200);
  assertInstructionStatusResponseShape(getResponse.json());
  assert.ok(getResponse.json().instruction_id);
  assert.ok(['PENDING', 'BROADCAST', 'CONFIRMING', 'FINAL'].includes(getResponse.json().status));
  assertAdapterMetadataShape(getResponse.json().adapter_metadata, 'mock-evm');

  const searchResponse = await app.inject({
    method: 'GET',
    url: '/instruction/search?status=PENDING&page_size=10',
  });

  assert.equal(searchResponse.statusCode, 200);
  assertInstructionSearchResponseShape(searchResponse.json());
  assert.ok(Array.isArray(searchResponse.json().instructions));
  assert.equal(searchResponse.json().total_matched, 1);
  assert.equal(searchResponse.json().instructions[0].debtor_name, 'Acme Trading GmbH');

  await app.close();
});

test('quote request validates required fields', async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: 'POST',
    url: '/instruction/quote',
    payload: {
      chain_dli: 'X9J9XDMTD',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, 'INVALID_REQUEST');
  assert.equal(response.json().message, 'Request validation failed.');
  assert.ok(Array.isArray(response.json().details));
  assert.equal(
    response.json().details.some((detail) => detail.field === 'token'),
    true,
  );

  await app.close();
});

test('instruction submission enforces spec-required parties and charge bearer', async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: {
      payment_identification: {
        end_to_end_identification: 'INV-MISSING-FIELDS',
      },
      interbank_settlement_amount: {
        amount: '25.00',
        currency: 'USD',
      },
      blockchain_instruction: {
        token: {
          token_symbol: 'USDC',
        },
        chain_dli: 'bad-chain',
        custody_model: 'BAD_MODEL',
      },
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, 'INVALID_REQUEST');
  assert.equal(
    response.json().details.some((detail) => detail.field === 'charge_bearer'),
    true,
  );
  assert.equal(
    response.json().details.some((detail) => detail.field === 'debtor'),
    true,
  );
  assert.equal(
    response.json().details.some(
      (detail) => detail.field === 'blockchain_instruction.chain_dli',
    ),
    true,
  );
  assert.equal(
    response.json().details.some(
      (detail) => detail.field === 'blockchain_instruction.custody_model',
    ),
    true,
  );

  await app.close();
});

test('travel rule callback enforces receiving vasp identity and timestamp', async () => {
  const app = await buildApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/travel-rule',
    payload: buildTravelRuleSubmission({
      travel_rule_data: {
        payment_identification: {
          end_to_end_identification: 'E2E-CB-VALIDATION-001',
        },
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);

  const callbackResponse = await app.inject({
    method: 'POST',
    url: `/travel-rule/${createResponse.json().record_id}/callback`,
    payload: {
      callback_status: 'REJECTED',
      rejection_reasons: [{ code: 'INVALID_FORMAT' }],
    },
  });

  assert.equal(callbackResponse.statusCode, 400);
  assert.equal(
    callbackResponse.json().details.some(
      (detail) => detail.field === 'receiving_vasp',
    ),
    true,
  );
  assert.equal(
    callbackResponse.json().details.some(
      (detail) => detail.field === 'callback_timestamp',
    ),
    true,
  );

  await app.close();
});

test('duplicate end_to_end_identification returns 409 with original instruction id', async () => {
  const app = await buildApp();

  const payload = {
    ...buildInstructionPayload(),
    payment_identification: {
      end_to_end_identification: 'INV-042',
    },
  };

  const firstResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload,
  });

  const duplicateResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload,
  });

  assert.equal(firstResponse.statusCode, 201);
  assert.equal(duplicateResponse.statusCode, 409);
  assert.equal(
    duplicateResponse.json().instruction_id,
    firstResponse.json().instruction_id,
  );

  await app.close();
});

test('pending instruction can be cancelled before broadcast', async () => {
  const app = await buildApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-043',
      },
      interbank_settlement_amount: {
        amount: '1000.00',
        currency: 'USD',
      },
    }),
  });

  const cancelResponse = await app.inject({
    method: 'DELETE',
    url: `/instruction/${createResponse.json().instruction_id}`,
  });

  assert.equal(cancelResponse.statusCode, 200);
  assertCancellationResponseShape(cancelResponse.json());

  await app.close();
});

test('travel rule search validates spec query parameters', async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: 'GET',
    url: '/travel-rule/search?direction=SIDEWAYS&submitted_from=bad-date&status=UNKNOWN&page_size=999&sort=latest',
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, 'INVALID_REQUEST');
  assert.equal(
    response.json().details.some((detail) => detail.field === 'direction'),
    true,
  );
  assert.equal(
    response.json().details.some((detail) => detail.field === 'submitted_from'),
    true,
  );
  assert.equal(
    response.json().details.some((detail) => detail.field === 'status'),
    true,
  );
  assert.equal(
    response.json().details.some((detail) => detail.field === 'page_size'),
    true,
  );
  assert.equal(
    response.json().details.some((detail) => detail.field === 'sort'),
    true,
  );

  await app.close();
});

test('travel rule search applies currency wallet and sort filters from the spec', async () => {
  const app = await buildApp();

  const firstResponse = await app.inject({
    method: 'POST',
    url: '/travel-rule',
    payload: buildTravelRuleSubmission({
      travel_rule_data: {
        payment_identification: {
          end_to_end_identification: 'E2E-SEARCH-001',
        },
        interbank_settlement_amount: {
          amount: '100.00',
          currency: 'USD',
        },
        debtor_account: {
          proxy: {
            identification: '0xdebtorsearch',
          },
        },
        creditor_account: {
          proxy: {
            identification: '0xcreditorone',
          },
        },
      },
    }),
  });

  const secondResponse = await app.inject({
    method: 'POST',
    url: '/travel-rule',
    payload: buildTravelRuleSubmission({
      travel_rule_data: {
        payment_identification: {
          end_to_end_identification: 'E2E-SEARCH-002',
        },
        interbank_settlement_amount: {
          amount: '250.00',
          currency: 'USD',
        },
        debtor_account: {
          proxy: {
            identification: '0xdebtorsearch',
          },
        },
        creditor_account: {
          proxy: {
            identification: '0xcreditortwo',
          },
        },
      },
    }),
  });

  const thirdResponse = await app.inject({
    method: 'POST',
    url: '/travel-rule',
    payload: buildTravelRuleSubmission({
      travel_rule_data: {
        payment_identification: {
          end_to_end_identification: 'E2E-SEARCH-003',
        },
        interbank_settlement_amount: {
          amount: '999.00',
          currency: 'EUR',
        },
        debtor_account: {
          proxy: {
            identification: '0xotherdebtor',
          },
        },
      },
    }),
  });

  assert.equal(firstResponse.statusCode, 201);
  assert.equal(secondResponse.statusCode, 201);
  assert.equal(thirdResponse.statusCode, 201);

  const response = await app.inject({
    method: 'GET',
    url: '/travel-rule/search?currency=USD&debtor_wallet=0xdebtorsearch&sort=amount_desc',
  });

  assert.equal(response.statusCode, 200);
  assertTravelRuleSearchResponseShape(response.json());
  assert.equal(response.json().total_matched, 2);
  assert.equal(response.json().records[0].settlement_amount, '250.00');
  assert.equal(response.json().records[1].settlement_amount, '100.00');

  await app.close();
});

test('ramp instructions fail early when estimated slippage exceeds the configured limit', async () => {
  const app = await buildApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-RAMP-SLIP-001',
      },
      interbank_settlement_amount: {
        amount: '25000.00',
        currency: 'USD',
      },
      blockchain_instruction: {
        token: {
          token_symbol: 'USDC',
          token_dti: '4H95J0R2X',
        },
        chain_dli: 'X9J9XDMTD',
        custody_model: 'FULL_CUSTODY',
        maximum_slippage_rate: '0.0005',
        ramp_instruction: {
          ramp_type: 'ONRAMP',
        },
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);

  const statusResponse = await app.inject({
    method: 'GET',
    url: `/execution-status/${createResponse.json().instruction_id}`,
  });

  assert.equal(statusResponse.statusCode, 200);
  assert.equal(statusResponse.json().status, 'SLIPPAGE_EXCEEDED');
  assert.match(statusResponse.json().failure_reason, /Estimated slippage/);
  assert.equal(statusResponse.json().transaction_hash, null);
  assert.equal(statusResponse.json().confirmation_depth, 0);

  await app.close();
});

test('instruction search validates spec query parameters', async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: 'GET',
    url: '/instruction/search?from=bad-date&status=UNKNOWN&chain_dli=bad&page_size=9999',
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, 'INVALID_REQUEST');
  assert.equal(
    response.json().details.some((detail) => detail.field === 'from'),
    true,
  );
  assert.equal(
    response.json().details.some((detail) => detail.field === 'status'),
    true,
  );
  assert.equal(
    response.json().details.some((detail) => detail.field === 'chain_dli'),
    true,
  );
  assert.equal(
    response.json().details.some((detail) => detail.field === 'page_size'),
    true,
  );

  await app.close();
});

test('delegated signing remains explicitly out of scope', async () => {
  const app = await buildApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-DELEGATED-001',
      },
      blockchain_instruction: {
        token: {
          token_symbol: 'USDC',
          token_dti: '4H95J0R2X',
        },
        chain_dli: 'X9J9XDMTD',
        custody_model: 'DELEGATED_SIGNING',
      },
    }),
  });

  assert.equal(createResponse.statusCode, 501);
  assert.equal(createResponse.json().error, 'not_implemented');

  const signedTransactionResponse = await app.inject({
    method: 'POST',
    url: '/instruction/550e8400-e29b-41d4-a716-446655440000/signed-transaction',
    payload: {
      signed_transaction: '0xdeadbeef',
    },
  });

  assert.equal(signedTransactionResponse.statusCode, 501);
  assert.equal(signedTransactionResponse.json().error, 'not_implemented');

  await app.close();
});

test('travel rule search and stats return spec-like envelope', async () => {
  const app = await buildApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/travel-rule',
    payload: buildTravelRuleSubmission({
      submission_timing: 'POST_TX',
      travel_rule_data: {
        payment_identification: {
          end_to_end_identification: 'E2E-001',
        },
        interbank_settlement_amount: {
          amount: '50000.00',
          currency: 'EUR',
        },
        blockchain_settlement: {
          primary_chain_id: 'DLID/X9J9XDMTD',
          legs: [{ leg_type: 'ORIGINATION' }],
        },
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);

  const searchResponse = await app.inject({
    method: 'GET',
    url: '/travel-rule/search?status=SUBMITTED&submitted_from=2025-01-01T00:00:00Z&submitted_to=2030-01-01T00:00:00Z&page_size=1',
  });

  assert.equal(searchResponse.statusCode, 200);
  assertTravelRuleSearchResponseShape(searchResponse.json());
  assert.equal(searchResponse.json().total_matched, 1);
  assert.equal(searchResponse.json().page_size, 1);
  assert.equal(searchResponse.json().records[0].latest_callback_status, 'PENDING');
  assert.equal(searchResponse.json().records[0].primary_chain_id, 'DLID/X9J9XDMTD');

  const statsResponse = await app.inject({
    method: 'GET',
    url: '/travel-rule/stats?submitted_from=2025-01-01T00:00:00Z&submitted_to=2030-01-01T00:00:00Z&group_by=status',
  });

  assert.equal(statsResponse.statusCode, 200);
  assertTravelRuleStatsResponseShape(statsResponse.json());
  assert.equal(statsResponse.json().totals.record_count, 1);
  assert.equal(statsResponse.json().totals.volumes[0].currency, 'EUR');
  assert.equal(statsResponse.json().direction, 'BOTH');
  assert.equal(statsResponse.json().breakdown[0].dimension_value, 'SUBMITTED');

  await app.close();
});

test('accepted travel rule record rejects superseding callback', async () => {
  const app = await buildApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/travel-rule',
    payload: buildTravelRuleSubmission({
      travel_rule_data: {
        payment_identification: {
          end_to_end_identification: 'E2E-ACCEPTED-001',
        },
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);

  const acceptedResponse = await app.inject({
    method: 'POST',
    url: `/travel-rule/${createResponse.json().record_id}/callback`,
    payload: buildTravelRuleCallback(),
  });

  assert.equal(acceptedResponse.statusCode, 200);
  assert.equal(acceptedResponse.json().current_status, 'ACCEPTED');

  const rejectedResponse = await app.inject({
    method: 'POST',
    url: `/travel-rule/${createResponse.json().record_id}/callback`,
    payload: buildTravelRuleCallback({
      callback_status: 'REJECTED',
      rejection_reasons: [{ field: 'debtor.name', code: 'INVALID_FORMAT' }],
    }),
  });

  assert.equal(rejectedResponse.statusCode, 409);

  await app.close();
});

test('execution status can be retrieved by instruction id and uetr', async () => {
  const app = await buildApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-044',
      },
      interbank_settlement_amount: {
        amount: '2750.00',
        currency: 'USD',
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);
  const instruction = createResponse.json();

  const byInstructionIdResponse = await app.inject({
    method: 'GET',
    url: `/execution-status/${instruction.instruction_id}`,
  });

  assert.equal(byInstructionIdResponse.statusCode, 200);
  assert.equal(byInstructionIdResponse.json().status, 'PENDING');
  assert.equal(byInstructionIdResponse.json().status_group, 'PRE_EXECUTION');
  assert.equal(byInstructionIdResponse.json().transaction_hash, null);
  assert.equal(byInstructionIdResponse.json().status_history.length, 1);
  assert.equal(byInstructionIdResponse.json().status_history[0].status, 'PENDING');
  assertAdapterMetadataShape(byInstructionIdResponse.json().adapter_metadata, 'mock-evm');

  const byUetrResponse = await app.inject({
    method: 'GET',
    url: `/execution-status/uetr/${instruction.uetr}`,
  });

  assert.equal(byUetrResponse.statusCode, 200);
  assert.equal(
    byUetrResponse.json().instruction_id,
    instruction.instruction_id,
  );

  await app.close();
});

test('finality receipt reflects settled on-chain state and supports uetr lookup', async () => {
  const app = await buildApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-045',
      },
      interbank_settlement_amount: {
        amount: '5000.00',
        currency: 'USD',
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);
  const instruction = createResponse.json();
  const currentRecord = app.store.getInstruction(instruction.instruction_id);
  const agedTimestamp = new Date(Date.now() - 12000).toISOString();
  app.store.saveInstruction({
    ...currentRecord,
    created_at: agedTimestamp,
    updated_at: agedTimestamp,
  });

  const byInstructionIdResponse = await app.inject({
    method: 'GET',
    url: `/finality-receipt/${instruction.instruction_id}`,
  });

  assert.equal(byInstructionIdResponse.statusCode, 200);
  assert.equal(byInstructionIdResponse.json().instruction_status, 'FINAL');
  assert.equal(byInstructionIdResponse.json().finality_status, 'FINAL');
  assert.equal(byInstructionIdResponse.json().confirmation_depth, 12);
  assert.ok(byInstructionIdResponse.json().transaction_hash);
  assert.ok(byInstructionIdResponse.json().final_at);
  assertAdapterMetadataShape(byInstructionIdResponse.json().adapter_metadata, 'mock-evm');

  const byUetrResponse = await app.inject({
    method: 'GET',
    url: `/finality-receipt/uetr/${instruction.uetr}`,
  });

  assert.equal(byUetrResponse.statusCode, 200);
  assert.equal(byUetrResponse.json().instruction_id, instruction.instruction_id);

  await app.close();
});

test('finality receipt remains stable after execution status has already advanced the instruction', async () => {
  const app = await buildApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-FINALITY-STABLE-001',
      },
      interbank_settlement_amount: {
        amount: '125000.00',
        currency: 'USD',
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);
  const instruction = createResponse.json();
  const currentRecord = app.store.getInstruction(instruction.instruction_id);
  const agedTimestamp = new Date(Date.now() - 12000).toISOString();
  app.store.saveInstruction({
    ...currentRecord,
    created_at: agedTimestamp,
    updated_at: agedTimestamp,
  });

  const statusResponse = await app.inject({
    method: 'GET',
    url: `/execution-status/${instruction.instruction_id}`,
  });

  assert.equal(statusResponse.statusCode, 200);
  assert.equal(statusResponse.json().status, 'FINAL');
  assert.ok(statusResponse.json().transaction_hash);

  const finalityResponse = await app.inject({
    method: 'GET',
    url: `/finality-receipt/${instruction.instruction_id}`,
  });

  assert.equal(finalityResponse.statusCode, 200);
  assert.equal(finalityResponse.json().instruction_status, 'FINAL');
  assert.equal(finalityResponse.json().finality_status, 'FINAL');
  assert.equal(
    finalityResponse.json().transaction_hash,
    statusResponse.json().transaction_hash,
  );
  assert.ok(finalityResponse.json().block_number);
  assert.ok(finalityResponse.json().block_timestamp);

  await app.close();
});

test('execution status history captures cancellation as a terminal event', async () => {
  const app = await buildApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-046',
      },
      interbank_settlement_amount: {
        amount: '310.00',
        currency: 'USD',
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);

  const cancelResponse = await app.inject({
    method: 'DELETE',
    url: `/instruction/${createResponse.json().instruction_id}`,
  });

  assert.equal(cancelResponse.statusCode, 200);

  const statusResponse = await app.inject({
    method: 'GET',
    url: `/execution-status/${createResponse.json().instruction_id}`,
  });

  assert.equal(statusResponse.statusCode, 200);
  assert.equal(statusResponse.json().status, 'CANCELLED');
  assert.equal(statusResponse.json().status_group, 'CANCELLED');
  assert.equal(statusResponse.json().status_history.length, 2);
  assert.equal(
    statusResponse.json().status_history.at(-1).reason_code,
    'CANCELLED_BY_INSTRUCTING_PARTY',
  );

  await app.close();
});

test('event outbox mirrors initial execution status and finality payloads', async () => {
  const app = await buildApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-047',
      },
      interbank_settlement_amount: {
        amount: '725.00',
        currency: 'USD',
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);
  const instruction = createResponse.json();

  const outboxResponse = await app.inject({
    method: 'GET',
    url: `/event-outbox?instruction_id=${instruction.instruction_id}`,
  });

  assert.equal(outboxResponse.statusCode, 200);
  assert.equal(outboxResponse.json().total_matched, 2);
  assert.equal(
    outboxResponse.json().events.some((event) => event.event_type === 'execution_status.updated'),
    true,
  );
  assert.equal(
    outboxResponse.json().events.some((event) => event.event_type === 'finality_receipt.updated'),
    true,
  );

  const executionStatusEvent = outboxResponse.json().events.find(
    (event) => event.event_type === 'execution_status.updated',
  );
  const finalityEvent = outboxResponse.json().events.find(
    (event) => event.event_type === 'finality_receipt.updated',
  );

  assert.equal(executionStatusEvent.payload.status, 'PENDING');
  assert.equal(finalityEvent.payload.instruction_status, 'PENDING');

  const eventLookupResponse = await app.inject({
    method: 'GET',
    url: `/event-outbox/${executionStatusEvent.event_id}`,
  });

  assert.equal(eventLookupResponse.statusCode, 200);
  assert.equal(eventLookupResponse.json().event_id, executionStatusEvent.event_id);

  await app.close();
});

test('event outbox records final lifecycle transitions with mirrored payloads', async () => {
  const app = await buildApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-048',
      },
      interbank_settlement_amount: {
        amount: '9825.00',
        currency: 'USD',
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);
  const instruction = createResponse.json();
  const currentRecord = app.store.getInstruction(instruction.instruction_id);
  const agedTimestamp = new Date(Date.now() - 12000).toISOString();
  app.store.saveInstruction({
    ...currentRecord,
    created_at: agedTimestamp,
    updated_at: agedTimestamp,
  });

  const statusResponse = await app.inject({
    method: 'GET',
    url: `/execution-status/${instruction.instruction_id}`,
  });

  assert.equal(statusResponse.statusCode, 200);
  assert.equal(statusResponse.json().status, 'FINAL');

  const outboxResponse = await app.inject({
    method: 'GET',
    url: `/event-outbox?instruction_id=${instruction.instruction_id}&event_type=execution_status.updated,finality_receipt.updated`,
  });

  assert.equal(outboxResponse.statusCode, 200);
  assert.equal(outboxResponse.json().total_matched, 4);

  const finalStatusEvent = outboxResponse.json().events.find(
    (event) =>
      event.event_type === 'execution_status.updated' &&
      event.payload.status === 'FINAL',
  );
  const finalityEvent = outboxResponse.json().events.find(
    (event) =>
      event.event_type === 'finality_receipt.updated' &&
      event.payload.finality_status === 'FINAL',
  );

  assert.ok(finalStatusEvent);
  assert.ok(finalityEvent);
  assert.equal(finalStatusEvent.payload.instruction_id, instruction.instruction_id);
  assert.equal(finalityEvent.payload.instruction_id, instruction.instruction_id);

  await app.close();
});

test('webhook subscriptions receive signed deliveries for outbox events', async () => {
  const signingSecret = 'whsec_test_123456';
  const deliveriesReceived = [];
  const app = await buildApp({
    webhookSender: async ({ url, headers, body }) => {
      deliveriesReceived.push({ url, headers, body });
      return {
        status: 202,
        bodyText: 'accepted',
      };
    },
  });

  const subscriptionResponse = await app.inject({
    method: 'POST',
    url: '/webhook-endpoints',
    payload: {
      url: 'https://receiver.example/pacs',
      signing_secret: signingSecret,
      subscribed_event_types: [
        'execution_status.updated',
        'finality_receipt.updated',
      ],
      description: 'Treasury lifecycle receiver',
    },
  });

  assert.equal(subscriptionResponse.statusCode, 201);
  const subscription = subscriptionResponse.json();
  assert.equal(subscription.signing_secret, signingSecret);

  const createResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-049',
      },
      interbank_settlement_amount: {
        amount: '1800.00',
        currency: 'USD',
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);
  const instruction = createResponse.json();

  const pendingDeliveriesResponse = await app.inject({
    method: 'GET',
    url: `/webhook-endpoints/${subscription.subscription_id}/deliveries`,
  });

  assert.equal(pendingDeliveriesResponse.statusCode, 200);
  assert.equal(pendingDeliveriesResponse.json().total_matched, 2);

  const dispatchResponse = await app.inject({
    method: 'POST',
    url: '/webhook-deliveries/dispatch',
    payload: {
      subscription_id: subscription.subscription_id,
      limit: 10,
    },
  });

  assert.equal(dispatchResponse.statusCode, 200);
  assert.equal(dispatchResponse.json().dispatched_count, 2);
  assert.equal(deliveriesReceived.length, 2);

  const firstDelivery = deliveriesReceived[0];
  const timestamp = firstDelivery.headers['x-pacscrypto-signature-timestamp'];
  const expectedDigest = createHmac('sha256', signingSecret)
    .update(`${timestamp}.${firstDelivery.body}`)
    .digest('hex');
  assert.equal(
    firstDelivery.headers['x-pacscrypto-signature'],
    `t=${timestamp},v1=${expectedDigest}`,
  );

  const parsedEnvelope = JSON.parse(firstDelivery.body);
  assert.equal(parsedEnvelope.instruction_id, instruction.instruction_id);
  assert.ok(
    ['execution_status.updated', 'finality_receipt.updated'].includes(
      parsedEnvelope.event_type,
    ),
  );

  const deliveredResponse = await app.inject({
    method: 'GET',
    url: `/webhook-endpoints/${subscription.subscription_id}/deliveries?delivery_state=DELIVERED`,
  });

  assert.equal(deliveredResponse.statusCode, 200);
  assert.equal(deliveredResponse.json().total_matched, 2);
  assert.equal(
    deliveredResponse.json().deliveries.every(
      (delivery) => delivery.response_status === 202,
    ),
    true,
  );

  const subscriptionLookupResponse = await app.inject({
    method: 'GET',
    url: `/webhook-endpoints/${subscription.subscription_id}`,
  });

  assert.equal(subscriptionLookupResponse.statusCode, 200);
  assert.ok(subscriptionLookupResponse.json().last_delivery_at);

  await app.close();
});

test('webhook deliveries retry on non-2xx endpoint responses', async () => {
  const app = await buildApp({
    webhookSender: async () => ({
      status: 500,
      bodyText: 'upstream unavailable',
    }),
  });

  const subscriptionResponse = await app.inject({
    method: 'POST',
    url: '/webhook-endpoints',
    payload: {
      url: 'https://receiver.example/retry',
      signing_secret: 'whsec_retry_123456',
      subscribed_event_types: ['execution_status.updated'],
    },
  });

  assert.equal(subscriptionResponse.statusCode, 201);
  const subscription = subscriptionResponse.json();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-050',
      },
      interbank_settlement_amount: {
        amount: '900.00',
        currency: 'USD',
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);

  const dispatchResponse = await app.inject({
    method: 'POST',
    url: '/webhook-deliveries/dispatch',
    payload: {
      subscription_id: subscription.subscription_id,
    },
  });

  assert.equal(dispatchResponse.statusCode, 200);
  assert.equal(dispatchResponse.json().dispatched_count, 1);
  assert.equal(dispatchResponse.json().deliveries[0].delivery_state, 'RETRYING');

  const retryingDeliveriesResponse = await app.inject({
    method: 'GET',
    url: `/webhook-endpoints/${subscription.subscription_id}/deliveries?delivery_state=RETRYING`,
  });

  assert.equal(retryingDeliveriesResponse.statusCode, 200);
  assert.equal(retryingDeliveriesResponse.json().total_matched, 1);
  assert.equal(retryingDeliveriesResponse.json().deliveries[0].attempt_count, 1);
  assert.equal(retryingDeliveriesResponse.json().deliveries[0].response_status, 500);
  assert.match(
    retryingDeliveriesResponse.json().deliveries[0].last_error,
    /HTTP 500/,
  );
  assert.ok(
    Date.parse(retryingDeliveriesResponse.json().deliveries[0].next_attempt_at) >
      Date.parse(retryingDeliveriesResponse.json().deliveries[0].last_attempt_at),
  );

  await app.close();
});

test('background webhook dispatch retries and eventually delivers due events', async () => {
  let attempts = 0;
  const app = await buildApp({
    webhookDispatch: {
      enabled: true,
      intervalMs: 10,
      batchSize: 10,
    },
    webhookRetryScheduleMs: [15, 30],
    webhookSender: async () => {
      attempts += 1;
      if (attempts === 1) {
        return {
          status: 503,
          bodyText: 'busy',
        };
      }

      return {
        status: 202,
        bodyText: 'accepted',
      };
    },
  });

  const subscriptionResponse = await app.inject({
    method: 'POST',
    url: '/webhook-endpoints',
    payload: {
      url: 'https://receiver.example/background',
      signing_secret: 'whsec_background_123456',
      subscribed_event_types: ['execution_status.updated'],
      max_attempts: 3,
    },
  });

  assert.equal(subscriptionResponse.statusCode, 201);
  const subscription = subscriptionResponse.json();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-WEBHOOK-BG-001',
      },
      interbank_settlement_amount: {
        amount: '1500.00',
        currency: 'USD',
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);

  const delivered = await waitFor(async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/webhook-endpoints/${subscription.subscription_id}/deliveries?event_type=execution_status.updated`,
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().total_matched, 1);
    assert.equal(response.json().deliveries[0].delivery_state, 'DELIVERED');
    return response.json().deliveries[0];
  });

  assert.ok(delivered.attempt_count >= 2);
  assert.equal(delivered.response_status, 202);
  assert.equal(attempts >= 2, true);

  await app.close();
});

test('webhook deliveries move to dead-letter after max attempts and expose operator stats', async () => {
  let attempts = 0;
  const app = await buildApp({
    webhookDispatch: {
      enabled: true,
      intervalMs: 10,
      batchSize: 10,
    },
    webhookRetryScheduleMs: [10],
    webhookSender: async () => {
      attempts += 1;
      return {
        status: 502,
        bodyText: 'upstream failed',
      };
    },
  });

  const subscriptionResponse = await app.inject({
    method: 'POST',
    url: '/webhook-endpoints',
    payload: {
      url: 'https://receiver.example/dead-letter',
      signing_secret: 'whsec_deadletter_123456',
      subscribed_event_types: ['execution_status.updated'],
      max_attempts: 2,
    },
  });

  assert.equal(subscriptionResponse.statusCode, 201);
  const subscription = subscriptionResponse.json();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-WEBHOOK-DEADLETTER-001',
      },
      interbank_settlement_amount: {
        amount: '950.00',
        currency: 'USD',
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);

  const deadLetterDelivery = await waitFor(async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/webhook-deliveries/dead-letter?subscription_id=${subscription.subscription_id}`,
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().total_matched, 1);
    const delivery = response.json().deliveries[0];
    assert.equal(delivery.delivery_state, 'FAILED');
    assert.equal(delivery.terminal_reason, 'MAX_ATTEMPTS_EXHAUSTED');
    assert.equal(delivery.failure_category, 'HTTP_RESPONSE');
    assert.ok(delivery.dead_lettered_at);
    return delivery;
  }, { timeoutMs: 2500, intervalMs: 25 });

  const statsResponse = await app.inject({
    method: 'GET',
    url: `/webhook-deliveries/stats?subscription_id=${subscription.subscription_id}`,
  });

  assert.equal(statsResponse.statusCode, 200);
  assert.equal(statsResponse.json().delivery_guarantee, 'AT_LEAST_ONCE_BEST_EFFORT');
  assert.deepEqual(statsResponse.json().retry_schedule_ms, [10]);
  assert.equal(statsResponse.json().state_counts.FAILED, 1);
  assert.equal(statsResponse.json().dead_letter_count, 1);
  assert.equal(attempts >= 2, true);
  assert.equal(deadLetterDelivery.delivery_guarantee, 'AT_LEAST_ONCE_BEST_EFFORT');

  await app.close();
});

test('reporting notifications are created when an instruction reaches settlement milestones', async () => {
  const app = await buildApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-051',
      },
      charge_bearer: 'DEBT',
      debtor: {
        name: 'Acme Trading GmbH',
        lei: '529900T8BM49AURSDO55',
      },
      debtor_account: {
        proxy: { identification: '0xdebtoracct' },
      },
      debtor_agent: {
        name: 'Bitvavo B.V.',
        lei: '7245007VX57GR4IUVZ79',
      },
      creditor: {
        name: 'Bravo Supplies B.V.',
        lei: '724500QHKL6MVSQQ1Z17',
      },
      creditor_account: {
        proxy: { identification: '0xcreditoracct' },
      },
      creditor_agent: {
        name: 'Kraken Belgium BVBA',
        lei: '635400DUFB71VFOHVB49',
      },
      interbank_settlement_amount: {
        amount: '4250.00',
        currency: 'USD',
      },
      remittance_information: {
        unstructured: 'INV-2025-777 / Supplier payment',
      },
      blockchain_instruction: {
        token: {
          token_symbol: 'USDC',
          token_dti: '4H95J0R2X',
        },
        chain_dli: 'X9J9XDMTD',
        custody_model: 'FULL_CUSTODY',
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);
  const instruction = createResponse.json();

  const initialNotificationsResponse = await app.inject({
    method: 'GET',
    url: `/reporting/notifications?instruction_id=${instruction.instruction_id}`,
  });

  assert.equal(initialNotificationsResponse.statusCode, 200);
  assert.equal(initialNotificationsResponse.json().total_matched, 0);

  const currentRecord = app.store.getInstruction(instruction.instruction_id);
  const agedTimestamp = new Date(Date.now() - 12000).toISOString();
  app.store.saveInstruction({
    ...currentRecord,
    created_at: agedTimestamp,
    updated_at: agedTimestamp,
  });

  const statusResponse = await app.inject({
    method: 'GET',
    url: `/instruction/${instruction.instruction_id}`,
  });

  assert.equal(statusResponse.statusCode, 200);
  assert.equal(statusResponse.json().status, 'FINAL');

  const notificationsResponse = await app.inject({
    method: 'GET',
    url: `/reporting/notifications?instruction_id=${instruction.instruction_id}`,
  });

  assert.equal(notificationsResponse.statusCode, 200);
  assert.equal(notificationsResponse.json().total_matched, 2);
  assert.equal(
    notificationsResponse.json().notifications.some(
      (notification) =>
        notification.entry_type === 'DEBIT' &&
        notification.account_role === 'DEBTOR',
    ),
    true,
  );
  assert.equal(
    notificationsResponse.json().notifications.some(
      (notification) =>
        notification.entry_type === 'CREDIT' &&
        notification.account_role === 'CREDITOR',
    ),
    true,
  );

  const debitNotification = notificationsResponse.json().notifications.find(
    (notification) => notification.entry_type === 'DEBIT',
  );

  const debitNotificationDetailResponse = await app.inject({
    method: 'GET',
    url: `/reporting/notifications/${debitNotification.notification_id}`,
  });

  assert.equal(debitNotificationDetailResponse.statusCode, 200);
  assert.equal(debitNotificationDetailResponse.json().party.wallet_address, '0xdebtoracct');
  assert.equal(
    debitNotificationDetailResponse.json().counterparty.wallet_address,
    '0xcreditoracct',
  );
  assert.equal(
    debitNotificationDetailResponse.json().status_reference.trigger_status,
    'BROADCAST',
  );
  assert.equal(
    debitNotificationDetailResponse.json().remittance_information.unstructured,
    'INV-2025-777 / Supplier payment',
  );

  const filteredNotificationsResponse = await app.inject({
    method: 'GET',
    url: `/reporting/notifications?instruction_id=${instruction.instruction_id}&entry_type=DEBIT`,
  });

  assert.equal(filteredNotificationsResponse.statusCode, 200);
  assert.equal(filteredNotificationsResponse.json().total_matched, 1);

  await app.close();
});

test('reporting notifications are emitted through outbox and webhook delivery', async () => {
  const deliveriesReceived = [];
  const app = await buildApp({
    webhookSender: async ({ headers, body }) => {
      deliveriesReceived.push({ headers, body });
      return {
        status: 200,
        bodyText: 'ok',
      };
    },
  });

  const subscriptionResponse = await app.inject({
    method: 'POST',
    url: '/webhook-endpoints',
    payload: {
      url: 'https://receiver.example/reporting',
      signing_secret: 'whsec_reporting_123456',
      subscribed_event_types: ['reporting_notification.created'],
    },
  });

  assert.equal(subscriptionResponse.statusCode, 201);
  const subscription = subscriptionResponse.json();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-052',
      },
      debtor: { name: 'Acme Trading GmbH' },
      debtor_agent: {
        name: 'Bankhaus Example AG',
        lei: '7245007VX57GR4IUVZ79',
      },
      debtor_account: {
        proxy: { identification: '0xreportdebit' },
      },
      creditor: { name: 'Bravo Supplies B.V.' },
      creditor_agent: {
        name: 'Kraken Belgium BVBA',
        lei: '635400DUFB71VFOHVB49',
      },
      creditor_account: {
        proxy: { identification: '0xreportcredit' },
      },
      interbank_settlement_amount: {
        amount: '6400.00',
        currency: 'USD',
      },
      blockchain_instruction: {
        token: {
          token_symbol: 'USDC',
          token_dti: '4H95J0R2X',
        },
        chain_dli: 'X9J9XDMTD',
        custody_model: 'FULL_CUSTODY',
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);
  const instruction = createResponse.json();

  const currentRecord = app.store.getInstruction(instruction.instruction_id);
  const agedTimestamp = new Date(Date.now() - 7000).toISOString();
  app.store.saveInstruction({
    ...currentRecord,
    created_at: agedTimestamp,
    updated_at: agedTimestamp,
  });

  const statusResponse = await app.inject({
    method: 'GET',
    url: `/instruction/${instruction.instruction_id}`,
  });

  assert.equal(statusResponse.statusCode, 200);
  assert.equal(statusResponse.json().status, 'FINAL');

  const outboxResponse = await app.inject({
    method: 'GET',
    url: `/event-outbox?instruction_id=${instruction.instruction_id}&event_type=reporting_notification.created`,
  });

  assert.equal(outboxResponse.statusCode, 200);
  assert.equal(outboxResponse.json().total_matched, 2);

  const dispatchResponse = await app.inject({
    method: 'POST',
    url: '/webhook-deliveries/dispatch',
    payload: {
      subscription_id: subscription.subscription_id,
    },
  });

  assert.equal(dispatchResponse.statusCode, 200);
  assert.equal(dispatchResponse.json().dispatched_count, 2);
  assert.equal(deliveriesReceived.length, 2);

  const envelope = JSON.parse(deliveriesReceived[0].body);
  assert.equal(envelope.event_type, 'reporting_notification.created');
  assert.ok(envelope.payload.notification_id);

  const deliveredResponse = await app.inject({
    method: 'GET',
    url: `/webhook-endpoints/${subscription.subscription_id}/deliveries?delivery_state=DELIVERED`,
  });

  assert.equal(deliveredResponse.statusCode, 200);
  assert.equal(deliveredResponse.json().total_matched, 2);

  await app.close();
});

test('intraday reporting view summarizes booked movements and supports account filters', async () => {
  const app = await buildApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-053',
      },
      debtor: {
        name: 'Acme Trading GmbH',
        lei: '529900T8BM49AURSDO55',
      },
      debtor_account: {
        proxy: { identification: '0xintradaydebit' },
      },
      creditor: {
        name: 'Bravo Supplies B.V.',
        lei: '724500QHKL6MVSQQ1Z17',
      },
      creditor_account: {
        proxy: { identification: '0xintradaycredit' },
      },
      interbank_settlement_amount: {
        amount: '5100.00',
        currency: 'USD',
      },
      blockchain_instruction: {
        token: {
          token_symbol: 'USDC',
          token_dti: '4H95J0R2X',
        },
        chain_dli: 'X9J9XDMTD',
        custody_model: 'FULL_CUSTODY',
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);
  const instruction = createResponse.json();
  const currentRecord = app.store.getInstruction(instruction.instruction_id);
  const agedTimestamp = new Date(Date.now() - 7000).toISOString();
  app.store.saveInstruction({
    ...currentRecord,
    created_at: agedTimestamp,
    updated_at: agedTimestamp,
  });

  const statusResponse = await app.inject({
    method: 'GET',
    url: `/instruction/${instruction.instruction_id}`,
  });

  assert.equal(statusResponse.statusCode, 200);
  assert.equal(statusResponse.json().status, 'FINAL');

  const intradayResponse = await app.inject({
    method: 'GET',
    url: `/reporting/intraday?instruction_id=${instruction.instruction_id}`,
  });

  assert.equal(intradayResponse.statusCode, 200);
  assert.equal(intradayResponse.json().movement_summary.notification_count, 2);
  assert.equal(intradayResponse.json().movement_summary.debit_count, 1);
  assert.equal(intradayResponse.json().movement_summary.credit_count, 1);
  assert.equal(intradayResponse.json().account_views.length, 2);
  assert.equal(intradayResponse.json().movement_summary.totals[0].currency, 'USD');
  assert.equal(
    intradayResponse.json().traceability.instruction_id,
    instruction.instruction_id,
  );

  const debtorOnlyResponse = await app.inject({
    method: 'GET',
    url: `/reporting/intraday?instruction_id=${instruction.instruction_id}&account_role=DEBTOR`,
  });

  assert.equal(debtorOnlyResponse.statusCode, 200);
  assert.equal(debtorOnlyResponse.json().movement_summary.notification_count, 1);
  assert.equal(debtorOnlyResponse.json().account_views.length, 1);
  assert.equal(
    debtorOnlyResponse.json().account_views[0].wallet_address,
    '0xintradaydebit',
  );
  assert.equal(
    debtorOnlyResponse.json().account_views[0].instruction_ids[0],
    instruction.instruction_id,
  );
  assert.equal(
    debtorOnlyResponse.json().movement_summary.totals[0].net_total,
    '-5100',
  );

  await app.close();
});

test('statement reporting derives persisted account statements from reporting notifications', async () => {
  const app = await buildApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-054',
      },
      debtor: {
        name: 'Acme Trading GmbH',
        lei: '529900T8BM49AURSDO55',
      },
      debtor_account: {
        proxy: { identification: '0xstatementdebit' },
      },
      creditor: {
        name: 'Bravo Supplies B.V.',
        lei: '724500QHKL6MVSQQ1Z17',
      },
      creditor_account: {
        proxy: { identification: '0xstatementcredit' },
      },
      interbank_settlement_amount: {
        amount: '5100.00',
        currency: 'USD',
      },
      blockchain_instruction: {
        token: {
          token_symbol: 'USDC',
          token_dti: '4H95J0R2X',
        },
        chain_dli: 'X9J9XDMTD',
        custody_model: 'FULL_CUSTODY',
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);
  const instruction = createResponse.json();
  const currentRecord = app.store.getInstruction(instruction.instruction_id);
  const agedTimestamp = new Date(Date.now() - 7000).toISOString();
  app.store.saveInstruction({
    ...currentRecord,
    created_at: agedTimestamp,
    updated_at: agedTimestamp,
  });

  const statusResponse = await app.inject({
    method: 'GET',
    url: `/instruction/${instruction.instruction_id}`,
  });

  assert.equal(statusResponse.statusCode, 200);
  assert.equal(statusResponse.json().status, 'FINAL');

  const statementsResponse = await app.inject({
    method: 'GET',
    url: `/reporting/statements?instruction_id=${instruction.instruction_id}`,
  });

  assert.equal(statementsResponse.statusCode, 200);
  assert.equal(statementsResponse.json().total_matched, 2);
  assert.equal(statementsResponse.json().statements.length, 2);

  const debtorStatement = statementsResponse.json().statements.find(
    (statement) => statement.account_role === 'DEBTOR',
  );

  assert.ok(debtorStatement);
  assert.equal(debtorStatement.balance_summary.closing_balance.amount, '-5100');
  assert.equal(debtorStatement.movement_summary.entry_count, 1);
  assert.equal(debtorStatement.instruction_context.finality_status, 'FINAL');
  assert.equal(debtorStatement.statement_scope.source_notification_count, 1);

  const debtorStatementDetailResponse = await app.inject({
    method: 'GET',
    url: `/reporting/statements/${debtorStatement.statement_id}`,
  });

  assert.equal(debtorStatementDetailResponse.statusCode, 200);
  assert.equal(debtorStatementDetailResponse.json().entries.length, 1);
  assert.equal(debtorStatementDetailResponse.json().entries[0].entry_type, 'DEBIT');
  assert.equal(
    debtorStatementDetailResponse.json().statement_scope.derivation_basis,
    'BOOKED_NOTIFICATIONS',
  );

  const filteredStatementsResponse = await app.inject({
    method: 'GET',
    url: `/reporting/statements?instruction_id=${instruction.instruction_id}&account_role=DEBTOR&wallet_address=0xstatementdebit`,
  });

  assert.equal(filteredStatementsResponse.statusCode, 200);
  assert.equal(filteredStatementsResponse.json().total_matched, 1);
  assert.equal(filteredStatementsResponse.json().statements[0].statement_id, debtorStatement.statement_id);

  await app.close();
});

test('reporting records expose traceability links back to instruction and travel rule records', async () => {
  const app = await buildApp();

  const travelRuleResponse = await app.inject({
    method: 'POST',
    url: '/travel-rule',
    payload: buildTravelRuleSubmission({
      travel_rule_data: {
        payment_identification: {
          end_to_end_identification: 'E2E-REPORT-TRACE-001',
        },
      },
    }),
  });

  assert.equal(travelRuleResponse.statusCode, 201);
  const travelRuleRecord = travelRuleResponse.json();

  const instructionResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-REPORT-TRACE-001',
      },
      travel_rule_record_id: travelRuleRecord.record_id,
      debtor_account: {
        proxy: { identification: '0xtraceabilitydebit' },
      },
      creditor_account: {
        proxy: { identification: '0xtraceabilitycredit' },
      },
      interbank_settlement_amount: {
        amount: '1800.00',
        currency: 'USD',
      },
    }),
  });

  assert.equal(instructionResponse.statusCode, 201);
  const instruction = instructionResponse.json();
  const currentRecord = app.store.getInstruction(instruction.instruction_id);
  const agedTimestamp = new Date(Date.now() - 7000).toISOString();
  app.store.saveInstruction({
    ...currentRecord,
    created_at: agedTimestamp,
    updated_at: agedTimestamp,
  });

  const statusResponse = await app.inject({
    method: 'GET',
    url: `/instruction/${instruction.instruction_id}`,
  });

  assert.equal(statusResponse.statusCode, 200);
  assert.equal(statusResponse.json().status, 'FINAL');

  const notificationsResponse = await app.inject({
    method: 'GET',
    url: `/reporting/notifications?instruction_id=${instruction.instruction_id}`,
  });

  assert.equal(notificationsResponse.statusCode, 200);
  assert.equal(notificationsResponse.json().total_matched, 2);
  const notification = notificationsResponse.json().notifications[0];
  assert.equal(notification.travel_rule_record_id, travelRuleRecord.record_id);
  assert.equal(
    notification.traceability.resource_paths.travel_rule_record,
    `/travel-rule/${travelRuleRecord.record_id}`,
  );

  const notificationDetailResponse = await app.inject({
    method: 'GET',
    url: `/reporting/notifications/${notification.notification_id}`,
  });

  assert.equal(notificationDetailResponse.statusCode, 200);
  assert.equal(
    notificationDetailResponse.json().traceability.instruction_id,
    instruction.instruction_id,
  );
  assert.equal(
    notificationDetailResponse.json().traceability.travel_rule_record_id,
    travelRuleRecord.record_id,
  );

  const statementsResponse = await app.inject({
    method: 'GET',
    url: `/reporting/statements?instruction_id=${instruction.instruction_id}`,
  });

  assert.equal(statementsResponse.statusCode, 200);
  assert.equal(statementsResponse.json().total_matched, 2);
  const statement = statementsResponse.json().statements[0];
  assert.equal(statement.travel_rule_record_id, travelRuleRecord.record_id);
  assert.equal(statement.statement_scope.source_notification_count, 1);

  const statementDetailResponse = await app.inject({
    method: 'GET',
    url: `/reporting/statements/${statement.statement_id}`,
  });

  assert.equal(statementDetailResponse.statusCode, 200);
  assert.equal(
    statementDetailResponse.json().traceability.resource_paths.reporting_statement,
    `/reporting/statements/${statement.statement_id}`,
  );
  assert.equal(
    statementDetailResponse.json().traceability.resource_paths.travel_rule_record,
    `/travel-rule/${travelRuleRecord.record_id}`,
  );
  assert.equal(
    statementDetailResponse.json().statement_scope.source_notification_ids.length,
    1,
  );

  await app.close();
});

test('chain adapter can be partially injected without changing route contracts', async () => {
  const baseAdapter = createMockEvmChainAdapter();
  const customAdapter = {
    id: 'testnet-ready-mock',
    mode: 'TESTNET_READY',
    buildQuoteResponse: baseAdapter.buildQuoteResponse,
    describeLifecycle(input) {
      const metadata = baseAdapter.describeLifecycle(input);
      return {
        ...metadata,
        adapter_id: 'testnet-ready-mock',
        adapter_mode: 'TESTNET_READY',
        lifecycle_policy: {
          ...metadata.lifecycle_policy,
          required_confirmation_depth: 9,
        },
      };
    },
    deriveLifecycleState(record) {
      const lifecycle = baseAdapter.deriveLifecycleState(record);
      if (record.status === 'PENDING' && Date.now() - Date.parse(record.created_at) >= 1000) {
        return {
          status: 'BROADCAST',
          failureReason: null,
          onChainSettlement: {
            ...lifecycle.onChainSettlement,
            transaction_hash: '0xadapter00000000000000000000000000000000000000000000000000000000',
            required_confirmation_depth: 9,
          },
        };
      }
      return lifecycle;
    },
  };

  const app = await buildApp({ chainAdapter: customAdapter });

  const quoteResponse = await app.inject({
    method: 'POST',
    url: '/instruction/quote',
    payload: buildQuoteRequest(),
  });

  assert.equal(quoteResponse.statusCode, 200);
  assertAdapterMetadataShape(
    quoteResponse.json().adapter_metadata,
    'testnet-ready-mock',
  );
  assert.equal(
    quoteResponse.json().adapter_metadata.adapter_mode,
    'TESTNET_READY',
  );

  const createResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-ADAPTER-001',
      },
      interbank_settlement_amount: {
        amount: '900.00',
        currency: 'USD',
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);
  const instruction = createResponse.json();
  const currentRecord = app.store.getInstruction(instruction.instruction_id);
  const agedTimestamp = new Date(Date.now() - 1500).toISOString();
  app.store.saveInstruction({
    ...currentRecord,
    created_at: agedTimestamp,
    updated_at: agedTimestamp,
  });

  const statusResponse = await app.inject({
    method: 'GET',
    url: `/execution-status/${instruction.instruction_id}`,
  });

  assert.equal(statusResponse.statusCode, 200);
  assert.equal(statusResponse.json().status, 'BROADCAST');
  assert.equal(statusResponse.json().required_confirmation_depth, 9);
  assert.equal(
    statusResponse.json().transaction_hash,
    '0xadapter00000000000000000000000000000000000000000000000000000000',
  );
  assertAdapterMetadataShape(
    statusResponse.json().adapter_metadata,
    'testnet-ready-mock',
  );
  assert.equal(
    statusResponse.json().adapter_metadata.lifecycle_policy.required_confirmation_depth,
    9,
  );

  await app.close();
});

test('Sepolia USDC adapter can run read-only without changing route contracts', async () => {
  const app = await buildApp({
    chainAdapter: createSepoliaUsdcAdapter({
      usdcContractAddress: '0x0000000000000000000000000000000000000001',
      broadcastEnabled: false,
    }),
  });

  const quoteResponse = await app.inject({
    method: 'POST',
    url: '/instruction/quote',
    payload: buildQuoteRequest({
      amount: '10.00',
    }),
  });

  assert.equal(quoteResponse.statusCode, 200);
  assertAdapterMetadataShape(quoteResponse.json().adapter_metadata, 'sepolia-usdc');
  assert.equal(
    quoteResponse.json().adapter_metadata.adapter_mode,
    'TESTNET_READ_ONLY',
  );
  assert.equal(quoteResponse.json().adapter_metadata.simulated, false);

  const createResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-SEPOLIA-READONLY-001',
        quote_id: quoteResponse.json().quote_id,
      },
      interbank_settlement_amount: {
        amount: '10.00',
        currency: 'USD',
      },
      creditor_account: {
        proxy: {
          identification: '0x0000000000000000000000000000000000000002',
        },
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);
  assert.equal(createResponse.json().status, 'PENDING');
  assertAdapterMetadataShape(createResponse.json().adapter_metadata, 'sepolia-usdc');

  const statusResponse = await app.inject({
    method: 'GET',
    url: `/execution-status/${createResponse.json().instruction_id}`,
  });

  assert.equal(statusResponse.statusCode, 200);
  assert.equal(statusResponse.json().status, 'PENDING');
  assert.equal(statusResponse.json().transaction_hash, null);
  assert.equal(statusResponse.json().finality_status, 'PENDING');
  assertAdapterMetadataShape(statusResponse.json().adapter_metadata, 'sepolia-usdc');

  await app.close();
});

test('Sepolia broadcast mode fails safely when execution credentials are incomplete', async () => {
  const app = await buildApp({
    chainAdapter: createSepoliaUsdcAdapter({
      usdcContractAddress: '0x0000000000000000000000000000000000000001',
      broadcastEnabled: true,
    }),
  });

  const createResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-SEPOLIA-SAFEFAIL-001',
      },
      interbank_settlement_amount: {
        amount: '10.00',
        currency: 'USD',
      },
      creditor_account: {
        proxy: {
          identification: '0x0000000000000000000000000000000000000002',
        },
      },
    }),
  });

  assert.equal(createResponse.statusCode, 201);

  const statusResponse = await app.inject({
    method: 'GET',
    url: `/execution-status/${createResponse.json().instruction_id}`,
  });

  assert.equal(statusResponse.statusCode, 200);
  assert.equal(statusResponse.json().status, 'FAILED');
  assert.match(statusResponse.json().failure_reason, /RPC URL/);
  assert.equal(statusResponse.json().transaction_hash, null);
  assertAdapterMetadataShape(statusResponse.json().adapter_metadata, 'sepolia-usdc');

  await app.close();
});

test('investigation cases can be created, updated, listed, and emitted through outbox/webhooks', async () => {
  const app = await buildApp();

  const createInstructionResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-EXC-INVEST-001',
      },
      interbank_settlement_amount: {
        amount: '250000.00',
        currency: 'USD',
      },
    }),
  });

  assert.equal(createInstructionResponse.statusCode, 201);
  const instruction = createInstructionResponse.json();
  const agedTimestamp = new Date(Date.now() - 12000).toISOString();
  const currentRecord = app.store.getInstruction(instruction.instruction_id);
  app.store.saveInstruction({
    ...currentRecord,
    created_at: agedTimestamp,
    updated_at: agedTimestamp,
  });
  const finalizedInstruction = await waitFor(() => {
    const record = app.store.getInstruction(instruction.instruction_id);
    assert.equal(record.status, 'FINAL');
    return record;
  });
  assert.equal(finalizedInstruction.status, 'FINAL');

  const subscriptionResponse = await app.inject({
    method: 'POST',
    url: '/webhook-endpoints',
    payload: {
      url: 'https://receiver.example/investigations',
      signing_secret: 'whsec_investigations_123456',
      subscribed_event_types: ['investigation_case.updated'],
    },
  });

  assert.equal(subscriptionResponse.statusCode, 201);

  const createCaseResponse = await app.inject({
    method: 'POST',
    url: '/exceptions/investigations',
    payload: buildInvestigationCasePayload({
      related_instruction_id: instruction.instruction_id,
    }),
  });

  assert.equal(createCaseResponse.statusCode, 201);
  const investigation = createCaseResponse.json();
  assertInvestigationCaseShape(investigation);
  assert.equal(investigation.case_status, 'OPEN');
  assert.equal(investigation.related_instruction_id, instruction.instruction_id);
  assert.equal(
    investigation.traceability.resource_paths.investigation_case,
    `/exceptions/investigations/${investigation.investigation_case_id}`,
  );

  const updateCaseResponse = await app.inject({
    method: 'PATCH',
    url: `/exceptions/investigations/${investigation.investigation_case_id}`,
    payload: {
      case_status: 'WAITING_COUNTERPARTY',
      resolution_summary: 'Counterparty confirmation requested.',
    },
  });

  assert.equal(updateCaseResponse.statusCode, 200);
  assert.equal(updateCaseResponse.json().case_status, 'WAITING_COUNTERPARTY');
  assert.equal(updateCaseResponse.json().status_history.length, 2);

  const listResponse = await app.inject({
    method: 'GET',
    url: `/exceptions/investigations?related_instruction_id=${instruction.instruction_id}&case_status=WAITING_COUNTERPARTY`,
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().total_matched, 1);
  assert.equal(
    listResponse.json().investigation_cases[0].investigation_case_id,
    investigation.investigation_case_id,
  );

  const instructionStillFinalResponse = await app.inject({
    method: 'GET',
    url: `/instruction/${instruction.instruction_id}`,
  });

  assert.equal(instructionStillFinalResponse.statusCode, 200);
  assert.equal(instructionStillFinalResponse.json().status, 'FINAL');

  const outboxResponse = await app.inject({
    method: 'GET',
    url: `/event-outbox?instruction_id=${instruction.instruction_id}&event_type=investigation_case.updated`,
  });

  assert.equal(outboxResponse.statusCode, 200);
  assert.equal(outboxResponse.json().total_matched, 2);

  const deliveryResponse = await app.inject({
    method: 'GET',
    url: `/webhook-endpoints/${subscriptionResponse.json().subscription_id}/deliveries?event_type=investigation_case.updated`,
  });

  assert.equal(deliveryResponse.statusCode, 200);
  assert.equal(deliveryResponse.json().total_matched, 2);

  await app.close();
});

test('return cases can be created and settled without rewriting the original instruction', async () => {
  const app = await buildApp();

  const createInstructionResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-EXC-RETURN-001',
      },
      interbank_settlement_amount: {
        amount: '250000.00',
        currency: 'USD',
      },
    }),
  });

  assert.equal(createInstructionResponse.statusCode, 201);
  const instruction = createInstructionResponse.json();
  const agedTimestamp = new Date(Date.now() - 12000).toISOString();
  const currentRecord = app.store.getInstruction(instruction.instruction_id);
  app.store.saveInstruction({
    ...currentRecord,
    created_at: agedTimestamp,
    updated_at: agedTimestamp,
  });
  const finalizedInstruction = await waitFor(() => {
    const record = app.store.getInstruction(instruction.instruction_id);
    assert.equal(record.status, 'FINAL');
    return record;
  });
  assert.equal(finalizedInstruction.status, 'FINAL');

  const investigationResponse = await app.inject({
    method: 'POST',
    url: '/exceptions/investigations',
    payload: buildInvestigationCasePayload({
      related_instruction_id: instruction.instruction_id,
      case_type: 'RETURN_REQUEST',
      reason_code: 'RETURN_REQUESTED',
      narrative: 'Return requested after beneficiary-side remediation flow.',
    }),
  });

  assert.equal(investigationResponse.statusCode, 201);
  const investigation = investigationResponse.json();

  const createReturnResponse = await app.inject({
    method: 'POST',
    url: '/exceptions/returns',
    payload: buildReturnCasePayload({
      original_instruction_id: instruction.instruction_id,
      linked_investigation_case_id: investigation.investigation_case_id,
    }),
  });

  assert.equal(createReturnResponse.statusCode, 201);
  const returnCase = createReturnResponse.json();
  assertReturnCaseShape(returnCase);
  assert.equal(returnCase.return_status, 'PROPOSED');
  assert.equal(returnCase.original_instruction_id, instruction.instruction_id);
  assert.equal(
    returnCase.linked_investigation_case_id,
    investigation.investigation_case_id,
  );

  const updateReturnResponse = await app.inject({
    method: 'PATCH',
    url: `/exceptions/returns/${returnCase.return_case_id}`,
    payload: {
      return_status: 'SETTLED',
      off_chain_reference: 'REFUND-2026-0001',
      resolution_summary: 'Off-chain refund completed.',
    },
  });

  assert.equal(updateReturnResponse.statusCode, 200);
  assert.equal(updateReturnResponse.json().return_status, 'SETTLED');
  assert.equal(updateReturnResponse.json().off_chain_reference, 'REFUND-2026-0001');
  assertIsoDateTime(updateReturnResponse.json().settled_at);

  const listReturnResponse = await app.inject({
    method: 'GET',
    url: `/exceptions/returns?original_instruction_id=${instruction.instruction_id}&return_status=SETTLED`,
  });

  assert.equal(listReturnResponse.statusCode, 200);
  assert.equal(listReturnResponse.json().total_matched, 1);
  assert.equal(
    listReturnResponse.json().return_cases[0].return_case_id,
    returnCase.return_case_id,
  );

  const instructionStillFinalResponse = await app.inject({
    method: 'GET',
    url: `/instruction/${instruction.instruction_id}`,
  });

  assert.equal(instructionStillFinalResponse.statusCode, 200);
  assert.equal(instructionStillFinalResponse.json().status, 'FINAL');

  const outboxResponse = await app.inject({
    method: 'GET',
    url: `/event-outbox?instruction_id=${instruction.instruction_id}&event_type=return_case.updated`,
  });

  assert.equal(outboxResponse.statusCode, 200);
  assert.equal(outboxResponse.json().total_matched, 2);

  await app.close();
});

test('return cases reject instructions that have not reached final settlement', async () => {
  const app = await buildApp();

  const createInstructionResponse = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload({
      payment_identification: {
        end_to_end_identification: 'INV-EXC-RETURN-REJECT-001',
      },
    }),
  });

  assert.equal(createInstructionResponse.statusCode, 201);

  const createReturnResponse = await app.inject({
    method: 'POST',
    url: '/exceptions/returns',
    payload: buildReturnCasePayload({
      original_instruction_id: createInstructionResponse.json().instruction_id,
    }),
  });

  assert.equal(createReturnResponse.statusCode, 400);
  assert.equal(createReturnResponse.json().error, 'invalid_state');

  await app.close();
});
