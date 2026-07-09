import test from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/app.js';

// Epics 16 (vLEI), 17 (settlement_transport), 20 (ERC-7943 attestation):
// optional, additive interoperability fields validated when present.

function baseInstruction(extra = {}) {
  return {
    payment_identification: {
      end_to_end_identification: extra.e2e ?? 'INV-INTEROP',
    },
    charge_bearer: 'DEBT',
    debtor: {
      name: 'Acme Trading GmbH',
      lei: '529900T8BM49AURSDO55',
      ...(extra.debtor ?? {}),
    },
    creditor: { name: 'Bravo Supplies B.V.', lei: '724500QHKL6MVSQQ1Z17' },
    interbank_settlement_amount: { amount: '250000.00', currency: 'USD' },
    blockchain_instruction: {
      token: { token_symbol: 'USDC', token_dti: 'T9B3X8H2K' },
      chain_dli: 'X9J9XDMTD',
      custody_model: 'FULL_CUSTODY',
      ...(extra.blockchain_instruction ?? {}),
    },
    ...(extra.top ?? {}),
  };
}

function baseTravelRule(extra = {}) {
  return {
    submission_timing: 'PRE_TX',
    travel_rule_data: {
      payment_identification: {
        end_to_end_identification: extra.e2e ?? 'E2E-TR-INTEROP',
      },
      interbank_settlement_amount: { amount: '50000.00', currency: 'EUR' },
      charge_bearer: 'SHAR',
      debtor: { name: 'Acme Trading GmbH', postal_address: { country: 'DE' } },
      debtor_account: { proxy: { identification: '0xabc' } },
      creditor: { name: 'Bravo Supplies B.V.', postal_address: { country: 'NL' } },
      creditor_account: { proxy: { identification: '0xdef' } },
      counterparty_wallet_type: 'HOSTED',
      ...(extra.travel_rule_data ?? {}),
    },
  };
}

test('instruction accepts v1.3 interop fields (settlement_transport + ERC-7943 attestation + vLEI)', async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: baseInstruction({
      e2e: 'INV-INTEROP-OK',
      debtor: {
        vlei_credential: {
          credential_id: 'vlei:acme:001',
          issuer_lei: '529900T8BM49AURSDO55',
          status: 'VALID',
        },
      },
      blockchain_instruction: { settlement_transport: 'CCTP' },
      top: {
        credential_attestation: {
          standard: 'ERC-7943',
          attester_address: '0xattester',
          enforcement: {
            standard: 'ERC-7943',
            transfer_validation_required: true,
            can_force_transfer: false,
            can_freeze: true,
          },
        },
      },
    }),
  });

  assert.equal(response.statusCode, 201);
  await app.close();
});

test('instruction rejects an unknown settlement_transport', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: baseInstruction({
      e2e: 'INV-BAD-TRANSPORT',
      blockchain_instruction: { settlement_transport: 'NOPE' },
    }),
  });
  assert.equal(response.statusCode, 400);
  assert.ok(
    response
      .json()
      .details.some((d) => d.field === 'blockchain_instruction.settlement_transport'),
  );
  await app.close();
});

test('instruction rejects an invalid attestation enforcement standard', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: baseInstruction({
      e2e: 'INV-BAD-ATTEST',
      top: { credential_attestation: { enforcement: { standard: 'ERC-9999' } } },
    }),
  });
  assert.equal(response.statusCode, 400);
  assert.ok(
    response
      .json()
      .details.some((d) => d.field === 'credential_attestation.enforcement.standard'),
  );
  await app.close();
});

test('instruction rejects an invalid vLEI credential status', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: baseInstruction({
      e2e: 'INV-BAD-VLEI',
      debtor: { vlei_credential: { credential_id: 'x', status: 'BOGUS' } },
    }),
  });
  assert.equal(response.statusCode, 400);
  assert.ok(
    response.json().details.some((d) => d.field === 'debtor.vlei_credential.status'),
  );
  await app.close();
});

test('travel-rule submission accepts an optional credential_attestation', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/travel-rule',
    payload: baseTravelRule({
      travel_rule_data: {
        credential_attestation: { standard: 'EAS', attester_address: '0xattester' },
      },
    }),
  });
  assert.equal(response.statusCode, 201);
  await app.close();
});
