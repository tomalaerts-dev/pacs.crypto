// Epic 19 — Travel Rule interoperability.
//
// Maps pacs.crypto Spec 1 Travel Rule data to/from IVMS101 (the FATF Travel
// Rule identity data model used by TRISA / TRP / OpenVASP transports), so an
// ISO 20022-native record can bridge to those networks rather than compete with
// them. This is a CORE-FIELD mapping (legal-person name, LEI, country of
// registration, wallet account) — the slice pacs.crypto actually carries today.
// Anything without a mapping is reported in `unmapped`, never silently dropped.

const LEGAL_PERSON_NAME_TYPE = 'LEGL';
const LEI_IDENTIFIER_TYPE = 'LEIX';

function hasPartyIdentity(party) {
  return Boolean(
    party && (party.name || party.lei || party.postal_address?.country || party.country),
  );
}

function ivmsLegalPerson(party = {}) {
  const name = party.name;
  const lei = party.lei;
  const country = party.postal_address?.country ?? party.country;

  const legalPerson = {
    name: {
      nameIdentifier: [
        {
          legalPersonName: name ?? null,
          legalPersonNameIdentifierType: LEGAL_PERSON_NAME_TYPE,
        },
      ],
    },
  };

  if (lei) {
    legalPerson.nationalIdentification = {
      nationalIdentifier: lei,
      nationalIdentifierType: LEI_IDENTIFIER_TYPE,
    };
  }
  if (country) {
    legalPerson.countryOfRegistration = country;
  }

  return { legalPerson };
}

function fromIvmsLegalPerson(persons = [], accountNumber = []) {
  const legalPerson = persons?.[0]?.legalPerson ?? {};
  const name = legalPerson.name?.nameIdentifier?.[0]?.legalPersonName ?? undefined;
  const national = legalPerson.nationalIdentification;
  const lei =
    national?.nationalIdentifierType === LEI_IDENTIFIER_TYPE
      ? national.nationalIdentifier
      : undefined;
  const country = legalPerson.countryOfRegistration;
  const wallet = accountNumber?.[0];

  const party = {};
  if (name !== undefined) party.name = name;
  if (lei) party.lei = lei;
  if (country) party.postal_address = { country };

  return { party, wallet };
}

// pacs.crypto Spec 1 `travel_rule_data` -> IVMS101.
export function travelRuleDataToIvms101(data = {}) {
  const debtorWallet = data.debtor_account?.proxy?.identification;
  const creditorWallet = data.creditor_account?.proxy?.identification;

  const unmapped = [];
  if (data.interbank_settlement_amount) {
    // IVMS101 carries identity, not transfer amounts; flag rather than drop.
    unmapped.push('interbank_settlement_amount');
  }
  if (data.debtor && !data.debtor.name) unmapped.push('debtor.name');
  if (data.creditor && !data.creditor.name) unmapped.push('creditor.name');
  // The core mapping carries name/LEI/country/wallet only; report anything else
  // we drop (vLEI credentials, address subfields beyond country) per the
  // module's "never silently drop" contract.
  for (const [role, party] of [
    ['debtor', data.debtor],
    ['creditor', data.creditor],
  ]) {
    if (party?.vlei_credential) unmapped.push(`${role}.vlei_credential`);
    for (const field of Object.keys(party?.postal_address ?? {})) {
      if (field !== 'country') unmapped.push(`${role}.postal_address.${field}`);
    }
  }

  const ivms101 = {
    originator: {
      originatorPersons: hasPartyIdentity(data.debtor) ? [ivmsLegalPerson(data.debtor)] : [],
      accountNumber: debtorWallet ? [debtorWallet] : [],
    },
    beneficiary: {
      beneficiaryPersons: hasPartyIdentity(data.creditor) ? [ivmsLegalPerson(data.creditor)] : [],
      accountNumber: creditorWallet ? [creditorWallet] : [],
    },
  };

  return { ivms101, unmapped };
}

// IVMS101 -> pacs.crypto Spec 1 `travel_rule_data` (core fields).
export function ivms101ToTravelRuleData(ivms101 = {}) {
  const originator = fromIvmsLegalPerson(
    ivms101.originator?.originatorPersons,
    ivms101.originator?.accountNumber,
  );
  const beneficiary = fromIvmsLegalPerson(
    ivms101.beneficiary?.beneficiaryPersons,
    ivms101.beneficiary?.accountNumber,
  );

  const data = {};
  if (Object.keys(originator.party).length > 0) {
    data.debtor = originator.party;
  }
  if (Object.keys(beneficiary.party).length > 0) {
    data.creditor = beneficiary.party;
  }
  if (originator.wallet) {
    data.debtor_account = { proxy: { identification: originator.wallet } };
  }
  if (beneficiary.wallet) {
    data.creditor_account = { proxy: { identification: beneficiary.wallet } };
  }

  return data;
}
