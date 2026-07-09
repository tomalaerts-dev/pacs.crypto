import test from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/app.js';

// Epics 19/21/22/23/24 — HTTP exposure of the interoperability reference modules.

test('POST /interop/travel-rule/to-ivms101 maps Spec 1 data to IVMS101', async () => {
  const app = await buildApp();
  const res = await app.inject({
    method: 'POST',
    url: '/interop/travel-rule/to-ivms101',
    payload: {
      travel_rule_data: {
        debtor: { name: 'Acme', lei: '529900T8BM49AURSDO55', postal_address: { country: 'DE' } },
        debtor_account: { proxy: { identification: '0xabc' } },
        creditor: { name: 'Bravo' },
        creditor_account: { proxy: { identification: '0xdef' } },
      },
    },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(
    res.json().ivms101.originator.originatorPersons[0].legalPerson.name.nameIdentifier[0]
      .legalPersonName,
    'Acme',
  );
  await app.close();
});

test('POST /interop/access-credentials issues, and verify approves', async () => {
  const app = await buildApp();
  const issue = await app.inject({
    method: 'POST',
    url: '/interop/access-credentials',
    payload: {
      subject: { name: 'Acme', lei: '529900T8BM49AURSDO55', screening_completed: true },
      issuer: 'Bank Trust Anchor',
      scope: ['POOL_TRADE'],
      expires_at: '2027-01-01T00:00:00Z',
    },
  });
  assert.equal(issue.statusCode, 200);
  const credential = issue.json().credential;
  assert.equal(credential.eligibility, 'ELIGIBLE');

  const verify = await app.inject({
    method: 'POST',
    url: '/interop/access-credentials/verify',
    payload: { credential, policy: { required_scope: 'POOL_TRADE', now: '2026-06-16T00:00:00Z' } },
  });
  assert.equal(verify.json().allowed, true);
  await app.close();
});

test('POST /interop/compliance-filings emits MiCA and GENIUS, rejects unknown regime', async () => {
  const app = await buildApp();
  const ok = await app.inject({
    method: 'POST',
    url: '/interop/compliance-filings',
    payload: {
      context: {
        instruction_id: 'i-1',
        debtor: { name: 'Acme', lei: '529900T8BM49AURSDO55' },
        creditor: { name: 'Bravo' },
        amount: '100.00',
        currency: 'USD',
        token_dti: 'T9B3X8H2K',
        chain_dli: 'X9J9XDMTD',
      },
    },
  });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().filings.length, 2);

  const bad = await app.inject({
    method: 'POST',
    url: '/interop/compliance-filings',
    payload: { context: { instruction_id: 'x' }, regimes: ['UNKNOWN'] },
  });
  assert.equal(bad.statusCode, 400);
  await app.close();
});

test('POST /interop/x402/bind returns an instruction and warnings', async () => {
  const app = await buildApp();
  const res = await app.inject({
    method: 'POST',
    url: '/interop/x402/bind',
    payload: {
      intent: { payer: { name: 'Agent' }, payTo: '0xfeed', amount: '1', asset: 'USDC', network: 'base' },
      resolvers: { networkToDli: { base: 'X9J9XDMTD' }, assetToDti: { USDC: 'T9B3X8H2K' } },
    },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().instruction.blockchain_instruction.chain_dli, 'X9J9XDMTD');
  assert.ok(Array.isArray(res.json().warnings));
  await app.close();
});

test('POST /interop/unified-ledger/pre-settlement builds posture + readiness', async () => {
  const app = await buildApp();
  const res = await app.inject({
    method: 'POST',
    url: '/interop/unified-ledger/pre-settlement',
    payload: {
      context: {
        instruction_id: 'i-1',
        amount: '100.00',
        currency: 'USD',
        token_dti: 'T9B3X8H2K',
        aml_checked: true,
        sanctions_screened: true,
        limit_within_bounds: true,
      },
    },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().pre_settlement.profile, 'BIS_AGORA_UNIFIED_LEDGER');
  assert.equal(res.json().readiness.ready, true);
  await app.close();
});

test('interop endpoints reject missing required bodies', async () => {
  const app = await buildApp();
  const res = await app.inject({
    method: 'POST',
    url: '/interop/access-credentials',
    payload: {},
  });
  assert.equal(res.statusCode, 400);
  await app.close();
});
