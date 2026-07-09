import test from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/app.js';

// Regression tests for the delegated-signing bugs found by the review.

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

test('a cancelled held DELEGATED_SIGNING instruction cannot be revived by signing', async () => {
  const app = await buildApp();

  const create = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: delegatedPayload('INV-CANCEL-SIGN'),
  });
  assert.equal(create.statusCode, 201);
  const id = create.json().instruction_id;

  const cancel = await app.inject({ method: 'DELETE', url: `/instruction/${id}` });
  assert.equal(cancel.json().status, 'CANCELLED');

  // The signed transaction must be rejected — a cancelled payment cannot settle.
  const sign = await app.inject({
    method: 'POST',
    url: `/instruction/${id}/signed-transaction`,
    payload: { signed_transaction_data: '0xsigned' },
  });
  assert.equal(sign.statusCode, 409);

  const get = await app.inject({ method: 'GET', url: `/instruction/${id}` });
  assert.equal(get.json().status, 'CANCELLED');

  await app.close();
});

test('concurrent signed-transaction submissions sign exactly once (no lost update)', async () => {
  const app = await buildApp();
  const store = app.store;

  const created = await store.createInstructionAsync(delegatedPayload('INV-CONCURRENT-SIGN'));
  assert.equal(created.awaiting_signed_transaction, true);
  const id = created.instruction_id;

  const [a, b] = await Promise.all([
    store.submitSignedTransactionAsync(id, { signed_transaction_data: '0xfirst' }),
    store.submitSignedTransactionAsync(id, { signed_transaction_data: '0xsecond' }),
  ]);

  // Serialized through the per-instruction lock: exactly one submission signs;
  // the other sees the already-signed state and is rejected. No lost update.
  const signed = [a, b].filter((r) => r.record);
  const rejected = [a, b].filter((r) => r.error === 'not_awaiting');
  assert.equal(signed.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(signed[0].record.signed_transaction.signed_transaction_data, '0xfirst');

  await app.close();
});

test('a concurrent cancel and sign cannot revive a cancelled delegated instruction', async () => {
  const app = await buildApp();
  const store = app.store;

  const created = await store.createInstructionAsync(delegatedPayload('INV-SIGN-CANCEL-RACE'));
  const id = created.instruction_id;

  // Cancel acquires the per-instruction lock first; the sign that follows must
  // see CANCELLED and be rejected, never overwrite the terminal state.
  const [cancelResult, signResult] = await Promise.all([
    store.cancelInstructionAsync(id),
    store.submitSignedTransactionAsync(id, { signed_transaction_data: '0xsigned' }),
  ]);

  assert.equal(cancelResult.cancellation.status, 'CANCELLED');
  assert.equal(signResult.error, 'not_awaiting');

  const final = await store.getInstructionAsync(id);
  assert.equal(final.status, 'CANCELLED');
  assert.equal(final.awaiting_signed_transaction, false);

  await app.close();
});

test('a held DELEGATED_SIGNING instruction expires when its signing window lapses', async () => {
  const app = await buildApp();

  const shortExpiry = new Date(Date.now() + 250).toISOString();
  const create = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: delegatedPayload('INV-HOLD-EXPIRE', { expiry_date_time: shortExpiry }),
  });
  assert.equal(create.statusCode, 201);
  assert.equal(create.json().awaiting_signed_transaction, true, 'created while still held');
  const id = create.json().instruction_id;

  await new Promise((resolve) => setTimeout(resolve, 400));

  const get = await app.inject({ method: 'GET', url: `/instruction/${id}` });
  assert.equal(get.json().status, 'EXPIRED');
  assert.equal(get.json().awaiting_signed_transaction, false);

  // An expired hold can no longer be signed.
  const sign = await app.inject({
    method: 'POST',
    url: `/instruction/${id}/signed-transaction`,
    payload: { signed_transaction_data: '0xtoolate' },
  });
  assert.equal(sign.statusCode, 409);

  await app.close();
});

test('signed-transaction submission rejects an invalid transaction_format', async () => {
  const app = await buildApp();

  const create = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: delegatedPayload('INV-BAD-FORMAT'),
  });
  const id = create.json().instruction_id;

  const sign = await app.inject({
    method: 'POST',
    url: `/instruction/${id}/signed-transaction`,
    payload: { transaction_format: 'BOGUS', signed_transaction_data: '0xabc' },
  });
  assert.equal(sign.statusCode, 400);
  assert.ok(sign.json().details.some((d) => d.field === 'transaction_format'));

  await app.close();
});
