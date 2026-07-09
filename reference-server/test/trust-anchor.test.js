import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAccessCredential,
  verifyAccessCredential,
} from '../src/interop/trust-anchor.js';

test('trust anchor issues an eligible access credential from identity data', () => {
  const { credential } = buildAccessCredential(
    {
      name: 'Acme Trading GmbH',
      lei: '529900T8BM49AURSDO55',
      wallet: '0xabc',
      screening_completed: true,
    },
    { issuer: 'Bank Trust Anchor', scope: ['POOL_TRADE'], expires_at: '2027-01-01T00:00:00Z' },
  );

  assert.equal(credential.eligibility, 'ELIGIBLE');
  // no sanctions / AML reasoning leaked
  assert.ok(!JSON.stringify(credential).match(/sanction|aml|screening_result/i));

  const verdict = verifyAccessCredential(credential, {
    required_scope: 'POOL_TRADE',
    now: '2026-06-16T00:00:00Z',
  });
  assert.equal(verdict.allowed, true);
});

test('not-eligible without screening; verify denies', () => {
  const { credential } = buildAccessCredential({
    name: 'Acme Trading GmbH',
    lei: '529900T8BM49AURSDO55',
    screening_completed: false,
  });

  assert.equal(credential.eligibility, 'NOT_ELIGIBLE');
  const verdict = verifyAccessCredential(credential, {});
  assert.equal(verdict.allowed, false);
  assert.ok(verdict.reasons.length > 0);
});

test('verify enforces scope and expiry', () => {
  const { credential } = buildAccessCredential(
    { name: 'Acme', lei: '529900T8BM49AURSDO55', screening_completed: true },
    { scope: ['POOL_TRADE'], expires_at: '2026-01-01T00:00:00Z' },
  );

  const expired = verifyAccessCredential(credential, { now: '2026-06-16T00:00:00Z' });
  assert.equal(expired.allowed, false);
  assert.ok(expired.reasons.some((r) => /expired/.test(r)));

  const wrongScope = verifyAccessCredential(credential, {
    required_scope: 'POOL_REDEEM',
    now: '2025-12-01T00:00:00Z',
  });
  assert.equal(wrongScope.allowed, false);
});
