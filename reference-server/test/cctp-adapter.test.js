import test from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/app.js';
import { createMockCctpAdapter } from '../src/chain/mock-cctp-adapter.js';

// Epic 18 — the CCTP adapter settles through the existing route contracts and
// surfaces cross-chain burn-and-mint metadata, proving the chain-adapter seam
// supports a second settlement venue without route changes.

function buildInstructionPayload(e2e) {
  return {
    payment_identification: { end_to_end_identification: e2e },
    charge_bearer: 'DEBT',
    debtor: { name: 'Acme Trading GmbH', lei: '529900T8BM49AURSDO55' },
    creditor: { name: 'Bravo Supplies B.V.', lei: '724500QHKL6MVSQQ1Z17' },
    interbank_settlement_amount: { amount: '250000.00', currency: 'USD' },
    blockchain_instruction: {
      token: { token_symbol: 'USDC', token_dti: 'T9B3X8H2K' },
      chain_dli: 'X9J9XDMTD',
      custody_model: 'FULL_CUSTODY',
      settlement_transport: 'CCTP',
    },
  };
}

test('CCTP adapter accepts an instruction unchanged and surfaces cross-chain metadata', async () => {
  const app = await buildApp({
    chainAdapter: createMockCctpAdapter({ sourceDomain: 0, destinationDomain: 6 }),
  });

  const create = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: buildInstructionPayload('INV-CCTP-001'),
  });
  assert.equal(create.statusCode, 201);
  assert.equal(create.json().adapter_metadata.adapter_id, 'mock-cctp');

  const instructionId = create.json().instruction_id;
  const detail = await app.inject({
    method: 'GET',
    url: `/instruction/${instructionId}`,
  });
  assert.equal(detail.statusCode, 200);

  const metadata = detail.json().adapter_metadata;
  assert.equal(metadata.adapter_id, 'mock-cctp');
  assert.equal(metadata.chain_family, 'EVM-CCTP');
  assert.equal(metadata.settlement_model, 'CCTP_BURN_AND_MINT');
  assert.ok(metadata.cross_chain, 'cross_chain metadata present');
  assert.equal(metadata.cross_chain.protocol, 'CIRCLE_CCTP_V2');
  assert.equal(metadata.cross_chain.destination_domain, 6);

  await app.close();
});

test('CCTP adapter still produces a quote through the existing route', async () => {
  const app = await buildApp({ chainAdapter: createMockCctpAdapter() });

  const quote = await app.inject({
    method: 'POST',
    url: '/instruction/quote',
    payload: {
      token: { token_symbol: 'USDC', token_dti: 'T9B3X8H2K' },
      chain_dli: 'X9J9XDMTD',
      amount: '250000.00',
      currency: 'USD',
      custody_model: 'FULL_CUSTODY',
    },
  });

  assert.equal(quote.statusCode, 200);
  assert.equal(quote.json().adapter_metadata.adapter_id, 'mock-cctp');
  assert.equal(quote.json().adapter_metadata.cross_chain.protocol, 'CIRCLE_CCTP_V2');

  await app.close();
});
