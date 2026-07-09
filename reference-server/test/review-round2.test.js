import test from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/app.js';
import { createMockEvmChainAdapter } from '../src/chain/mock-evm-adapter.js';
import { x402IntentToInstruction } from '../src/interop/x402-binding.js';
import {
  buildAccessCredential,
  verifyAccessCredential,
} from '../src/interop/trust-anchor.js';

// Regression tests for the second review round (HIGH bugs in the delegated-
// signing fixes, plus two edge fixes).

function delegatedPayload(e2e, extra = {}) {
  return {
    payment_identification: { end_to_end_identification: e2e },
    charge_bearer: 'DEBT',
    debtor: { name: 'Acme Trading GmbH', lei: '529900T8BM49AURSDO55' },
    creditor: { name: 'Bravo Supplies B.V.', lei: '724500QHKL6MVSQQ1Z17' },
    interbank_settlement_amount: { amount: '250000.00', currency: 'USD' },
    blockchain_instruction: {
      token: { token_symbol: 'USDC', token_dti: 'T9B3X8H2K' },
      chain_dli: 'X9J9XDMTD',
      custody_model: 'DELEGATED_SIGNING',
    },
    ...extra,
  };
}

test('mock lifecycle anchors to lifecycle_anchor_at, not created_at, after signing', () => {
  const adapter = createMockEvmChainAdapter();
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const baseRecord = {
    status: 'PENDING',
    created_at: tenMinutesAgo,
    interbank_settlement_amount: { amount: '250000.00' },
    blockchain_instruction: { chain_dli: 'X9J9XDMTD' },
  };

  // Accepted 10 minutes ago with no anchor → already FINAL on the simulated clock.
  assert.equal(adapter.deriveLifecycleState(baseRecord).status, 'FINAL');

  // Same record signed just now → the lifecycle resumes from the anchor → PENDING,
  // so a late signature no longer jumps straight to FINAL.
  const signedNow = { ...baseRecord, lifecycle_anchor_at: new Date().toISOString() };
  assert.equal(adapter.deriveLifecycleState(signedNow).status, 'PENDING');
});

test('delegated signing is rejected on a custodial adapter, and never re-broadcasts custodially', async () => {
  // A custodial adapter (supports_delegated_signing = false, with a
  // submitLifecycleState that would re-sign with the server key) must reject
  // delegated signing up front rather than execute the wrong custodial path.
  let submitCalls = 0;
  const custodialAdapter = {
    ...createMockEvmChainAdapter(),
    id: 'stub-custodial',
    supports_delegated_signing: false,
    submitLifecycleState(record) {
      submitCalls += 1;
      return { status: 'BROADCAST', failureReason: null, onChainSettlement: record.on_chain_settlement };
    },
  };

  const app = await buildApp({ chainAdapter: custodialAdapter });
  const create = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: delegatedPayload('INV-DELEGATED-UNSUPPORTED'),
  });
  assert.equal(create.statusCode, 501);
  assert.equal(create.json().error, 'not_implemented');
  assert.equal(submitCalls, 0, 'the custodial broadcast path is never reached for delegated signing');

  await app.close();
});

test('a delegated instruction signed near its expiry does not flip to EXPIRED (expiry cleared on signing)', async () => {
  const app = await buildApp();
  const create = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: delegatedPayload('INV-SIGN-NEAR-EXPIRY', {
      expiry_date_time: new Date(Date.now() + 500).toISOString(),
    }),
  });
  assert.equal(create.statusCode, 201);
  const id = create.json().instruction_id;

  // Sign while still held (well within the 500ms window).
  const sign = await app.inject({
    method: 'POST',
    url: `/instruction/${id}/signed-transaction`,
    payload: { signed_transaction_data: '0xsigned' },
  });
  assert.equal(sign.statusCode, 200);

  // After the original expiry passes, the signed instruction must NOT be EXPIRED.
  await new Promise((resolve) => setTimeout(resolve, 700));
  const detail = await app.inject({ method: 'GET', url: `/instruction/${id}` });
  assert.notEqual(detail.json().status, 'EXPIRED');

  await app.close();
});

test('cancelling a held delegated instruction clears the awaiting flag and never later expires', async () => {
  const app = await buildApp();
  const create = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: delegatedPayload('INV-CANCEL-CLEAR', {
      expiry_date_time: new Date(Date.now() + 500).toISOString(),
    }),
  });
  assert.equal(create.statusCode, 201);
  const id = create.json().instruction_id;

  const cancel = await app.inject({ method: 'DELETE', url: `/instruction/${id}` });
  assert.equal(cancel.json().status, 'CANCELLED');

  // The awaiting flag and unsigned transaction are cleared — no self-contradiction.
  const afterCancel = await app.inject({ method: 'GET', url: `/instruction/${id}` });
  assert.equal(afterCancel.json().awaiting_signed_transaction, false);
  assert.equal(afterCancel.json().unsigned_transaction, null);

  // After the expiry passes, a read must NOT flip the terminal CANCELLED state.
  await new Promise((resolve) => setTimeout(resolve, 700));
  const afterExpiry = await app.inject({ method: 'GET', url: `/instruction/${id}` });
  assert.equal(afterExpiry.json().status, 'CANCELLED');

  await app.close();
});

test('x402 binding treats amount 0 as provided (no spurious missing warning)', () => {
  const { instruction, warnings } = x402IntentToInstruction(
    { payer: { name: 'Agent' }, amount: 0, asset: 'USDC', network: 'base' },
    { networkToDli: { base: 'X9J9XDMTD' }, assetToDti: { USDC: 'T9B3X8H2K' } },
  );
  assert.equal(instruction.interbank_settlement_amount.amount, '0');
  assert.ok(!warnings.some((w) => /amount missing/.test(w)));
});

test('trust anchor verify falls back to current time when policy.now is unparseable', () => {
  const { credential } = buildAccessCredential(
    { name: 'Acme', lei: '529900T8BM49AURSDO55', screening_completed: true },
    { expires_at: '2000-01-01T00:00:00Z' },
  );
  const verdict = verifyAccessCredential(credential, { now: 'garbage' });
  assert.equal(verdict.allowed, false);
  assert.ok(verdict.reasons.some((r) => /expired/.test(r)));
});
