import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildComplianceRecord,
  toRegimeFiling,
  emitFilings,
} from '../src/interop/compliance-reporting.js';

const context = {
  instruction_id: 'i-1',
  uetr: 'u-1',
  debtor: { name: 'Acme Trading GmbH', lei: '529900T8BM49AURSDO55' },
  creditor: { name: 'Bravo Supplies B.V.', lei: '724500QHKL6MVSQQ1Z17' },
  amount: '250000.00',
  currency: 'USD',
  token_dti: 'T9B3X8H2K',
  chain_dli: 'X9J9XDMTD',
  transaction_hash: '0xhash',
};

test('one canonical compliance record emits MiCA and GENIUS filings', () => {
  const record = buildComplianceRecord(context);
  const filings = emitFilings(record);
  assert.equal(filings.length, 2);

  const mica = filings.find((f) => f.regime === 'MICA');
  assert.equal(mica.schema, 'auth.117');
  assert.equal(mica.report.digitalTokenIdentifier, 'T9B3X8H2K');
  assert.equal(mica.report.originatorLei, '529900T8BM49AURSDO55');
  assert.equal(mica.report.distributedLedgerIdentifier, 'X9J9XDMTD');

  const genius = filings.find((f) => f.regime === 'GENIUS');
  assert.equal(genius.report.token_dti, 'T9B3X8H2K');
  assert.equal(genius.report.originator, 'Acme Trading GmbH');

  // no sanctions reasoning anywhere in the filings
  assert.ok(!JSON.stringify(filings).match(/sanction|aml|screening/i));
});

test('unsupported reporting regime throws', () => {
  const record = buildComplianceRecord({ instruction_id: 'x' });
  assert.throws(() => toRegimeFiling(record, 'UNKNOWN'));
});
