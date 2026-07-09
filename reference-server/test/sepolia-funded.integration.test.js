import test from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/app.js';
import { createSepoliaUsdcAdapter } from '../src/chain/sepolia-usdc-adapter.js';

// Epic 10 / Epic 11 acceptance, ENCODED.
//
// This is the only acceptance criterion that requires real funds and a
// human-authorised broadcast, so it is gated, never automatic: it runs a REAL
// Sepolia USDC transfer and asserts a real on-chain transaction hash reaching
// FINAL, but only when the operator explicitly opts in
// (REF_SERVER_SEPOLIA_FUNDED_TEST=1) and supplies funded credentials. Without
// them it skips with an explanatory reason. The full safety/corridor/lifecycle
// behaviour around this path is already covered by the stub-based Sepolia tests
// in app.test.js; this test closes the loop the moment credentials exist.

const env = process.env;
const REQUIRED = [
  'REF_SERVER_SEPOLIA_RPC_URL',
  'REF_SERVER_SEPOLIA_PRIVATE_KEY',
  'REF_SERVER_SEPOLIA_USDC_CONTRACT_ADDRESS',
  'REF_SERVER_SEPOLIA_SOURCE_ADDRESS',
  'REF_SERVER_SEPOLIA_RECIPIENT_ADDRESS',
];

const optedIn = env.REF_SERVER_SEPOLIA_FUNDED_TEST === '1';
const haveCreds = REQUIRED.every((key) => typeof env[key] === 'string' && env[key].trim().length > 0);
const skip =
  !optedIn || !haveCreds
    ? 'set REF_SERVER_SEPOLIA_FUNDED_TEST=1 and the REF_SERVER_SEPOLIA_* credentials to run a real funded broadcast'
    : false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test(
  'funded Sepolia broadcast produces a real on-chain transaction reaching FINAL',
  { skip },
  async () => {
    const adapter = createSepoliaUsdcAdapter({
      rpcUrl: env.REF_SERVER_SEPOLIA_RPC_URL,
      privateKey: env.REF_SERVER_SEPOLIA_PRIVATE_KEY,
      usdcContractAddress: env.REF_SERVER_SEPOLIA_USDC_CONTRACT_ADDRESS,
      sourceAddress: env.REF_SERVER_SEPOLIA_SOURCE_ADDRESS,
      requiredConfirmations: Number(env.REF_SERVER_SEPOLIA_REQUIRED_CONFIRMATIONS ?? 3),
      broadcastEnabled: true,
    });
    const app = await buildApp({ chainAdapter: adapter });

    try {
      const create = await app.inject({
        method: 'POST',
        url: '/instruction',
        payload: {
          payment_identification: {
            end_to_end_identification: `INV-SEPOLIA-FUNDED-${Date.now()}`,
          },
          charge_bearer: 'DEBT',
          debtor: { name: 'Reference Bank', lei: '529900T8BM49AURSDO55' },
          debtor_account: {
            proxy: { type: { code: 'EWAL' }, identification: env.REF_SERVER_SEPOLIA_SOURCE_ADDRESS },
          },
          creditor: { name: 'Reference VASP', lei: '724500QHKL6MVSQQ1Z17' },
          creditor_account: {
            proxy: {
              type: { code: 'EWAL' },
              identification: env.REF_SERVER_SEPOLIA_RECIPIENT_ADDRESS,
            },
          },
          interbank_settlement_amount: {
            amount: env.REF_SERVER_SEPOLIA_DEMO_AMOUNT ?? '1.00',
            currency: 'USD',
          },
          blockchain_instruction: {
            token: { token_symbol: 'USDC', token_dti: 'T9B3X8H2K' },
            chain_dli: 'X9J9XDMTD',
            custody_model: 'FULL_CUSTODY',
          },
        },
      });

      assert.equal(create.statusCode, 201);
      assert.notEqual(
        create.json().status,
        'FAILED',
        create.json().failure_reason ?? 'instruction failed at submission',
      );
      const instructionId = create.json().instruction_id;

      const deadline = Date.now() + 300_000;
      let status = null;
      let transactionHash = null;
      while (Date.now() < deadline) {
        const detail = await app.inject({ method: 'GET', url: `/instruction/${instructionId}` });
        status = detail.json().status;
        transactionHash = detail.json().on_chain_settlement?.transaction_hash ?? null;
        if (status === 'FINAL' || status === 'FAILED') break;
        await sleep(10_000);
      }

      assert.equal(status, 'FINAL', `expected FINAL, got ${status}`);
      assert.match(transactionHash ?? '', /^0x[0-9a-fA-F]{64}$/);
    } finally {
      await app.close();
    }
  },
);
