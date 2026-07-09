import test from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/app.js';
import { x402IntentToInstruction } from '../src/interop/x402-binding.js';
import {
  buildAccessCredential,
  verifyAccessCredential,
} from '../src/interop/trust-anchor.js';

test('credential_attestation round-trips through the store onto the instruction detail', async () => {
  const app = await buildApp();

  const create = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: {
      payment_identification: { end_to_end_identification: 'INV-ATTEST-RT' },
      charge_bearer: 'DEBT',
      debtor: { name: 'Acme Trading GmbH', lei: '529900T8BM49AURSDO55' },
      creditor: { name: 'Bravo Supplies B.V.', lei: '724500QHKL6MVSQQ1Z17' },
      interbank_settlement_amount: { amount: '100.00', currency: 'USD' },
      blockchain_instruction: {
        token: { token_symbol: 'USDC', token_dti: 'T9B3X8H2K' },
        chain_dli: 'X9J9XDMTD',
        custody_model: 'FULL_CUSTODY',
      },
      credential_attestation: {
        standard: 'ERC-7943',
        attester_address: '0xattester',
        enforcement: { standard: 'ERC-7943', transfer_validation_required: true },
      },
    },
  });
  assert.equal(create.statusCode, 201);

  const id = create.json().instruction_id;
  const detail = await app.inject({ method: 'GET', url: `/instruction/${id}` });
  assert.equal(detail.json().credential_attestation.standard, 'ERC-7943');
  assert.equal(
    detail.json().credential_attestation.enforcement.transfer_validation_required,
    true,
  );

  await app.close();
});

test('x402 binding places the beneficiary wallet at the top level (not nested)', () => {
  const { instruction } = x402IntentToInstruction(
    {
      payer: { name: 'Agent Principal Ltd' },
      payee: { name: 'Example Feed Inc' },
      payTo: '0xfeed',
      amount: '1',
      asset: 'USDC',
      network: 'base',
    },
    { networkToDli: { base: 'X9J9XDMTD' }, assetToDti: { USDC: 'T9B3X8H2K' } },
  );

  assert.equal(instruction.creditor_account.proxy.identification, '0xfeed');
  assert.equal(instruction.blockchain_instruction.creditor_account, undefined);
});

test('trust anchor verify enforces expiry even when policy.now is omitted', () => {
  const { credential } = buildAccessCredential(
    { name: 'Acme', lei: '529900T8BM49AURSDO55', screening_completed: true },
    { expires_at: '2000-01-01T00:00:00Z' },
  );

  const verdict = verifyAccessCredential(credential, {}); // no policy.now supplied
  assert.equal(verdict.allowed, false);
  assert.ok(verdict.reasons.some((r) => /expired/.test(r)));
});
