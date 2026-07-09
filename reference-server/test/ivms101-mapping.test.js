import test from 'node:test';
import assert from 'node:assert/strict';

import {
  travelRuleDataToIvms101,
  ivms101ToTravelRuleData,
} from '../src/interop/ivms101-mapping.js';

const sample = {
  debtor: {
    name: 'Acme Trading GmbH',
    lei: '529900T8BM49AURSDO55',
    postal_address: { country: 'DE' },
  },
  debtor_account: { proxy: { identification: '0xabc' } },
  creditor: {
    name: 'Bravo Supplies B.V.',
    lei: '724500QHKL6MVSQQ1Z17',
    postal_address: { country: 'NL' },
  },
  creditor_account: { proxy: { identification: '0xdef' } },
  interbank_settlement_amount: { amount: '50000.00', currency: 'EUR' },
};

test('travel rule data maps to an IVMS101 originator/beneficiary structure', () => {
  const { ivms101, unmapped } = travelRuleDataToIvms101(sample);

  const originator = ivms101.originator.originatorPersons[0].legalPerson;
  assert.equal(originator.name.nameIdentifier[0].legalPersonName, 'Acme Trading GmbH');
  assert.equal(originator.nationalIdentification.nationalIdentifier, '529900T8BM49AURSDO55');
  assert.equal(originator.nationalIdentification.nationalIdentifierType, 'LEIX');
  assert.equal(originator.countryOfRegistration, 'DE');
  assert.deepEqual(ivms101.originator.accountNumber, ['0xabc']);

  const beneficiary = ivms101.beneficiary.beneficiaryPersons[0].legalPerson;
  assert.equal(beneficiary.name.nameIdentifier[0].legalPersonName, 'Bravo Supplies B.V.');
  assert.deepEqual(ivms101.beneficiary.accountNumber, ['0xdef']);

  // amount has no IVMS101 home — flagged rather than silently dropped
  assert.ok(unmapped.includes('interbank_settlement_amount'));
});

test('IVMS101 round-trips back to travel rule core fields', () => {
  const { ivms101 } = travelRuleDataToIvms101(sample);
  const back = ivms101ToTravelRuleData(ivms101);

  assert.equal(back.debtor.name, 'Acme Trading GmbH');
  assert.equal(back.debtor.lei, '529900T8BM49AURSDO55');
  assert.equal(back.debtor.postal_address.country, 'DE');
  assert.equal(back.debtor_account.proxy.identification, '0xabc');
  assert.equal(back.creditor.name, 'Bravo Supplies B.V.');
  assert.equal(back.creditor.lei, '724500QHKL6MVSQQ1Z17');
  assert.equal(back.creditor_account.proxy.identification, '0xdef');
});
