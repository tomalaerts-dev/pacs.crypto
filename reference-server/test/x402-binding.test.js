import test from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/app.js';
import { x402IntentToInstruction } from '../src/interop/x402-binding.js';

const resolvers = {
  networkToDli: { base: 'X9J9XDMTD', ethereum: 'X9J9XDMTD' },
  assetToDti: { USDC: 'T9B3X8H2K' },
};

test('x402 intent maps to a pacs.crypto instruction that clears server validation', async () => {
  const app = await buildApp();

  const intent = {
    resource: 'https://api.example/feed?id=42',
    payer: { name: 'Agent Principal Ltd', lei: '529900T8BM49AURSDO55' },
    payee: { name: 'Example Feed Inc' },
    payTo: '0xfeed',
    amount: '0.25',
    currency: 'USD',
    asset: 'USDC',
    network: 'base',
  };

  const { instruction, warnings } = x402IntentToInstruction(intent, resolvers);
  assert.equal(instruction.blockchain_instruction.chain_dli, 'X9J9XDMTD');
  assert.equal(instruction.blockchain_instruction.token.token_dti, 'T9B3X8H2K');
  assert.equal(instruction.blockchain_instruction.custody_model, 'SELF_CUSTODY');
  assert.ok(warnings.some((w) => /Travel Rule/.test(w)));

  // A 501 (not a 400) proves the mapped instruction passed validation: it is a
  // well-formed SELF_CUSTODY instruction, which this wedge accepts but does not
  // execute.
  const response = await app.inject({
    method: 'POST',
    url: '/instruction',
    payload: instruction,
  });
  assert.equal(response.statusCode, 501);

  await app.close();
});

test('x402 binding warns when network/asset cannot be resolved to ISO 24165 ids', () => {
  const { instruction, warnings } = x402IntentToInstruction({
    payer: { name: 'X Agent' },
    amount: '1',
    asset: 'WHO',
    network: 'unknownchain',
  });

  assert.equal(instruction.blockchain_instruction.chain_dli, null);
  assert.ok(warnings.some((w) => /DLI/.test(w)));
  assert.ok(warnings.some((w) => /DTI/.test(w)));
});
