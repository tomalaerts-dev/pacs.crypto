function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDateTime(value) {
  return hasText(value) && !Number.isNaN(Date.parse(value));
}

function isUuid(value) {
  return (
    hasText(value) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isDecimalString(value) {
  return hasText(value) && /^(0|[1-9]\d*)(\.\d+)?$/.test(value);
}

function hasValidTopLevelOrNestedName(value) {
  return hasText(value?.name) || hasText(value?.financial_institution_identification?.name);
}

function getTopLevelOrNestedLei(value) {
  return value?.lei ?? value?.financial_institution_identification?.lei ?? null;
}

function getTopLevelOrNestedBic(value) {
  return value?.bic ?? value?.financial_institution_identification?.bic ?? null;
}

const CHAIN_DLI_PATTERN = /^[A-Z0-9]{9}$/;
const TOKEN_DTI_PATTERN = /^[A-Z0-9]{9}$/;
const LEI_PATTERN = /^[A-Z0-9]{18}[0-9]{2}$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;
const MAX_SLIPPAGE_PATTERN = /^0*(\d{0,2}\.\d{1,8}|\d{0,3})$/;

const WEBHOOK_EVENT_TYPES = new Set([
  'execution_status.updated',
  'finality_receipt.updated',
  'reporting_notification.created',
  'investigation_case.updated',
  'return_case.updated',
]);

const TRAVEL_RULE_SUBMISSION_TIMINGS = new Set([
  'PRE_TX',
  'POST_TX',
  'SIMULTANEOUS',
]);

const TRAVEL_RULE_CALLBACK_STATUSES = new Set([
  'ACCEPTED',
  'REJECTED',
  'UNDER_REVIEW',
]);

const TRAVEL_RULE_CALLBACK_FILTER_STATUSES = new Set([
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'UNDER_REVIEW',
]);

const TRAVEL_RULE_RECORD_STATUSES = new Set([
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'UNDER_REVIEW',
  'ARCHIVED',
]);

const TRAVEL_RULE_WALLET_TYPES = new Set([
  'HOSTED',
  'UNHOSTED',
  'UNKNOWN',
]);

const CUSTODY_MODELS = new Set([
  'FULL_CUSTODY',
  'DELEGATED_SIGNING',
]);

const RAMP_TYPES = new Set([
  'NONE',
  'ONRAMP',
  'OFFRAMP',
  'ONRAMP_AND_OFFRAMP',
]);

const CHARGE_BEARERS = new Set([
  'DEBT',
  'CRED',
  'SHAR',
  'SLEV',
]);

const INSTRUCTION_STATUSES = new Set([
  'PENDING',
  'QUOTED',
  'BROADCAST',
  'CONFIRMING',
  'FINAL',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
  'SLIPPAGE_EXCEEDED',
  'RAMP_FAILED',
]);

const REPORT_QUERY_TYPES = new Set([
  'BALANCE',
  'INTRADAY',
  'STATEMENT',
  'NOTIFICATION_SUBSCRIBE',
  'NOTIFICATION_UNSUBSCRIBE',
]);

const REPORT_ENTRY_STATUSES = new Set([
  'BOOK',
  'PDNG',
]);

const REPORT_CREDIT_DEBIT_INDICATORS = new Set([
  'CRDT',
  'DBIT',
]);

const REPORT_SEARCH_SORTS = new Set([
  'booking_date_asc',
  'booking_date_desc',
  'amount_asc',
  'amount_desc',
]);

const REPORT_STATS_GROUP_BY = new Set([
  'entry_status',
  'finality_status',
  'credit_debit',
  'token',
  'day',
  'counterparty_wallet',
]);

const INVESTIGATION_CASE_TYPES = new Set([
  'STATUS_QUERY',
  'BENEFICIARY_CREDIT_QUERY',
  'TRAVEL_RULE_DISPUTE',
  'RETURN_REQUEST',
  'SETTLEMENT_DISCREPANCY',
]);

const INVESTIGATION_CASE_STATUSES = new Set([
  'OPEN',
  'IN_PROGRESS',
  'WAITING_COUNTERPARTY',
  'RESOLVED',
  'CLOSED',
]);

const INVESTIGATION_PRIORITIES = new Set([
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
]);

const INVESTIGATION_RESOLUTION_TYPES = new Set([
  'INFORMATION_PROVIDED',
  'NO_ISSUE_FOUND',
  'RETURN_INITIATED',
  'MANUAL_REMEDIATION',
  'REJECTED',
]);

const RETURN_CASE_TYPES = new Set([
  'CUSTOMER_REFUND',
  'BENEFICIARY_REJECTED',
  'DUPLICATE_PAYMENT',
  'SETTLEMENT_CORRECTION',
  'COMPLIANCE_REMEDIATION',
]);

const RETURN_METHODS = new Set([
  'ON_CHAIN_COMPENSATING_TRANSFER',
  'OFF_CHAIN_REFUND',
  'MANUAL_FIAT_REMEDIATION',
]);

const RETURN_CASE_STATUSES = new Set([
  'PROPOSED',
  'APPROVED',
  'SETTLED',
  'DECLINED',
  'CANCELLED',
]);

const TOM_RETURN_REASON_CODES = new Set([
  'CANC',
  'AC01',
  'AC04',
  'AM05',
  'BE04',
  'RC03',
  'RR04',
  'FRAD',
  'TECH',
  'NARR',
]);

const TOM_REVERSAL_REASON_CODES = new Set([
  'DUPL',
  'FRAD',
  'TECH',
  'CUST',
  'UPAY',
  'CANC',
  'NARR',
]);

const STATS_DIRECTIONS = new Set([
  'OUTGOING',
  'INCOMING',
  'BOTH',
]);

const STATS_GROUP_BY = new Set([
  'status',
  'callback_status',
  'submission_timing',
  'chain',
  'token',
  'wallet_type',
  'counterparty_vasp',
  'rejection_reason_code',
]);

const TRAVEL_RULE_SEARCH_SORTS = new Set([
  'submitted_at_asc',
  'submitted_at_desc',
  'amount_asc',
  'amount_desc',
]);

const CALLBACK_REJECTION_CODES = new Set([
  'MISSING_MANDATORY_FIELD',
  'MISSING_CONDITIONAL_FIELD',
  'INVALID_FORMAT',
  'UNRESOLVABLE_IDENTIFIER',
  'INCONSISTENT_DATA',
  'INSUFFICIENT_IDENTIFICATION',
  'UNSUPPORTED_VALUE',
]);

function pushError(errors, field, message) {
  errors.push({ field, message });
}

function parseQueryList(value) {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(','))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function validateRequiredField(errors, condition, field, message) {
  if (!condition) {
    pushError(errors, field, message);
  }
}

function validateEnumField(errors, value, allowedValues, field, label) {
  if (value === undefined || value === null) {
    return;
  }

  if (!allowedValues.has(value)) {
    pushError(
      errors,
      field,
      `${label} must be one of: ${Array.from(allowedValues).join(', ')}.`,
    );
  }
}

function validatePatternField(errors, value, pattern, field, message) {
  if (value === undefined || value === null || value === '') {
    return;
  }

  if (!pattern.test(value)) {
    pushError(errors, field, message);
  }
}

function validateDateTimeField(errors, value, field, required = false) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      pushError(errors, field, `${field} is required.`);
    }
    return;
  }

  if (!isIsoDateTime(value)) {
    pushError(errors, field, `${field} must be an ISO 8601 date-time string.`);
  }
}

function validateDateField(errors, value, field, required = false) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      pushError(errors, field, `${field} is required.`);
    }
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    pushError(errors, field, `${field} must be an ISO 8601 date string.`);
    return;
  }

  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed)) {
    pushError(errors, field, `${field} must be an ISO 8601 date string.`);
  }
}

function validateUuidField(errors, value, field) {
  if (value === undefined || value === null || value === '') {
    return;
  }

  if (!isUuid(value)) {
    pushError(errors, field, `${field} must be a UUID.`);
  }
}

function validateUuidArrayField(errors, value, field) {
  if (value === undefined || value === null) {
    return;
  }

  if (!Array.isArray(value)) {
    pushError(errors, field, `${field} must be an array of UUIDs.`);
    return;
  }

  value.forEach((entry, index) => {
    validateUuidField(errors, entry, `${field}[${index}]`);
  });
}

function validateTextField(errors, value, field, message) {
  validateRequiredField(errors, hasText(value), field, message);
}

function validateEnumListField(errors, value, allowedValues, field, label) {
  if (value === undefined || value === null || value === '') {
    return;
  }

  const values = parseQueryList(value);
  if (values.length === 0) {
    pushError(errors, field, `${field} must contain at least one value.`);
    return;
  }

  for (const entry of values) {
    if (!allowedValues.has(entry)) {
      pushError(
        errors,
        field,
        `${label} must contain only: ${Array.from(allowedValues).join(', ')}.`,
      );
      return;
    }
  }
}

function validateIntegerRangeField(errors, value, field, { min, max }) {
  if (value === undefined || value === null || value === '') {
    return;
  }

  const raw = String(value);
  if (!/^\d+$/.test(raw)) {
    pushError(errors, field, `${field} must be an integer.`);
    return;
  }

  const parsed = Number.parseInt(raw, 10);
  if (parsed < min || parsed > max) {
    pushError(errors, field, `${field} must be between ${min} and ${max}.`);
  }
}

function validateDecimalField(errors, value, field) {
  if (value === undefined || value === null || value === '') {
    return;
  }

  if (!/^\d+(\.\d+)?$/.test(String(value))) {
    pushError(errors, field, `${field} must be a positive decimal number.`);
  }
}

function validateCursorField(errors, value, field) {
  if (value === undefined || value === null || value === '') {
    return;
  }

  if (!hasText(value)) {
    pushError(errors, field, `${field} must be a non-empty string.`);
  }
}

function validateBooleanField(errors, value, field) {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== 'boolean') {
    pushError(errors, field, `${field} must be a boolean.`);
  }
}

function validateBooleanQueryField(errors, value, field) {
  if (value === undefined || value === null || value === '') {
    return;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'].includes(normalized)) {
    pushError(errors, field, `${field} must be a boolean value.`);
  }
}

function validateDateRange(errors, fromValue, toValue, fromField, toField) {
  if (!isIsoDateTime(fromValue) || !isIsoDateTime(toValue)) {
    return;
  }

  if (Date.parse(fromValue) > Date.parse(toValue)) {
    pushError(errors, fromField, `${fromField} must be earlier than or equal to ${toField}.`);
  }
}

function validateParty(errors, value, field) {
  validateRequiredField(
    errors,
    isObject(value),
    field,
    `${field} is required and must be an object.`,
  );
  if (!isObject(value)) {
    return;
  }

  validateTextField(errors, value.name, `${field}.name`, `${field}.name is required.`);
  validatePatternField(
    errors,
    value.lei,
    LEI_PATTERN,
    `${field}.lei`,
    `${field}.lei must be a valid LEI.`,
  );
  validatePatternField(
    errors,
    value.country,
    COUNTRY_CODE_PATTERN,
    `${field}.country`,
    `${field}.country must be an ISO 3166-1 alpha-2 country code.`,
  );
}

function validateAgent(errors, value, field) {
  validateRequiredField(
    errors,
    isObject(value),
    field,
    `${field} is required and must be an object.`,
  );
  if (!isObject(value)) {
    return;
  }

  validateRequiredField(
    errors,
    hasValidTopLevelOrNestedName(value),
    `${field}.name`,
    `${field}.name is required.`,
  );
  validatePatternField(
    errors,
    getTopLevelOrNestedLei(value),
    LEI_PATTERN,
    `${field}.lei`,
    `${field}.lei must be a valid LEI.`,
  );
  validatePatternField(
    errors,
    getTopLevelOrNestedBic(value),
    /^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/,
    `${field}.bic`,
    `${field}.bic must be a valid BIC.`,
  );
}

function validateWalletAccount(errors, value, field) {
  validateRequiredField(
    errors,
    isObject(value),
    field,
    `${field} is required and must be an object.`,
  );
  if (!isObject(value)) {
    return;
  }

  validateTextField(
    errors,
    value.proxy?.identification,
    `${field}.proxy.identification`,
    `${field}.proxy.identification is required.`,
  );
}

function validateNamedReference(errors, value, field, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) {
      pushError(errors, field, `${field} is required and must be an object.`);
    }
    return;
  }

  validateRequiredField(
    errors,
    isObject(value),
    field,
    `${field} must be an object.`,
  );
  if (!isObject(value)) {
    return;
  }

  validateTextField(errors, value.name, `${field}.name`, `${field}.name is required.`);
  validatePatternField(
    errors,
    value.lei,
    LEI_PATTERN,
    `${field}.lei`,
    `${field}.lei must be a valid LEI.`,
  );
}

function validateAmountObject(errors, value, field) {
  validateRequiredField(
    errors,
    isObject(value),
    field,
    `${field} is required and must be an object.`,
  );
  if (!isObject(value)) {
    return;
  }

  validateRequiredField(
    errors,
    isDecimalString(value.amount),
    `${field}.amount`,
    `${field}.amount is required and must be a decimal string.`,
  );
  validateTextField(
    errors,
    value.currency,
    `${field}.currency`,
    `${field}.currency is required.`,
  );
}

function validateTokenIdentification(errors, value, field) {
  validateRequiredField(
    errors,
    isObject(value),
    field,
    `${field} is required and must be an object.`,
  );
  if (!isObject(value)) {
    return;
  }

  const hasIdentifier =
    hasText(value.token_dti) ||
    hasText(value.contract_address) ||
    hasText(value.isin) ||
    hasText(value.token_symbol);
  validateRequiredField(
    errors,
    hasIdentifier,
    field,
    `${field} must include at least one token identifier.`,
  );
  validatePatternField(
    errors,
    value.token_dti,
    TOKEN_DTI_PATTERN,
    `${field}.token_dti`,
    `${field}.token_dti must be a 9-character uppercase DTI value.`,
  );
  validatePatternField(
    errors,
    value.chain_dli,
    CHAIN_DLI_PATTERN,
    `${field}.chain_dli`,
    `${field}.chain_dli must be a 9-character uppercase DLI value.`,
  );
}

function validateRejectionReasons(errors, reasons, field) {
  if (!Array.isArray(reasons) || reasons.length === 0) {
    pushError(
      errors,
      field,
      `${field} is required and must contain at least one rejection reason.`,
    );
    return;
  }

  reasons.forEach((reason, index) => {
    const baseField = `${field}[${index}]`;
    validateRequiredField(
      errors,
      isObject(reason),
      baseField,
      `${baseField} must be an object.`,
    );
    if (!isObject(reason)) {
      return;
    }
    validateEnumField(
      errors,
      reason.code,
      CALLBACK_REJECTION_CODES,
      `${baseField}.code`,
      `${baseField}.code`,
    );
  });
}

function validateUriField(errors, value, field, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      pushError(errors, field, `${field} is required.`);
    }
    return;
  }

  if (!hasText(value)) {
    pushError(errors, field, `${field} must be a non-empty URI string.`);
    return;
  }

  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      pushError(errors, field, `${field} must be an http or https URI.`);
    }
  } catch {
    pushError(errors, field, `${field} must be a valid URI.`);
  }
}

function extractChainDliFromAccount(account) {
  const proprietary = account?.type?.proprietary;
  if (!hasText(proprietary)) {
    return null;
  }

  const normalized = proprietary.trim();
  return normalized.startsWith('DLID/') ? normalized.slice(5) : normalized;
}

function validateReportAccount(errors, value, field) {
  validateRequiredField(
    errors,
    isObject(value),
    field,
    `${field} is required and must be an object.`,
  );
  if (!isObject(value)) {
    return;
  }

  validateTextField(
    errors,
    value.identification?.proxy?.identification,
    `${field}.identification.proxy.identification`,
    `${field}.identification.proxy.identification is required.`,
  );
  validateTextField(
    errors,
    value.type?.proprietary,
    `${field}.type.proprietary`,
    `${field}.type.proprietary is required.`,
  );
  validatePatternField(
    errors,
    extractChainDliFromAccount(value),
    CHAIN_DLI_PATTERN,
    `${field}.type.proprietary`,
    `${field}.type.proprietary must contain a valid DLID/<dli> or bare DLI value.`,
  );
}

export function formatValidationErrors(errors) {
  return errors.map(({ field, message }) => ({
    field,
    issue: message,
  }));
}

export function validateQuoteRequest(body) {
  const errors = [];
  validateRequiredField(errors, isObject(body), 'body', 'Request body must be a JSON object.');
  if (errors.length) {
    return errors;
  }

  validateTokenIdentification(errors, body.token, 'token');
  validateRequiredField(
    errors,
    hasText(body.chain_dli),
    'chain_dli',
    'chain_dli is required.',
  );
  validatePatternField(
    errors,
    body.chain_dli,
    CHAIN_DLI_PATTERN,
    'chain_dli',
    'chain_dli must be a 9-character uppercase DLI value.',
  );
  validateRequiredField(
    errors,
    isDecimalString(body.amount),
    'amount',
    'amount is required and must be a decimal string.',
  );
  validateTextField(errors, body.currency, 'currency', 'currency is required.');
  validateTextField(
    errors,
    body.custody_model,
    'custody_model',
    'custody_model is required.',
  );
  validateEnumField(
    errors,
    body.custody_model,
    CUSTODY_MODELS,
    'custody_model',
    'custody_model',
  );
  validateEnumField(
    errors,
    body.ramp_type,
    RAMP_TYPES,
    'ramp_type',
    'ramp_type',
  );
  validateDateTimeField(
    errors,
    body.requested_execution_time,
    'requested_execution_time',
  );
  return errors;
}

export function validateInstructionSubmission(body) {
  const errors = [];
  validateRequiredField(errors, isObject(body), 'body', 'Request body must be a JSON object.');
  if (errors.length) {
    return errors;
  }

  validateRequiredField(
    errors,
    isObject(body.payment_identification),
    'payment_identification',
    'payment_identification is required.',
  );
  validateTextField(
    errors,
    body.payment_identification?.end_to_end_identification,
    'payment_identification.end_to_end_identification',
    'payment_identification.end_to_end_identification is required.',
  );
  validateUuidField(
    errors,
    body.payment_identification?.uetr,
    'payment_identification.uetr',
  );
  validateUuidField(
    errors,
    body.payment_identification?.quote_id,
    'payment_identification.quote_id',
  );

  validateTextField(
    errors,
    body.charge_bearer,
    'charge_bearer',
    'charge_bearer is required.',
  );
  validateEnumField(
    errors,
    body.charge_bearer,
    CHARGE_BEARERS,
    'charge_bearer',
    'charge_bearer',
  );

  validateAmountObject(
    errors,
    body.interbank_settlement_amount,
    'interbank_settlement_amount',
  );
  validateParty(errors, body.debtor, 'debtor');
  validateAgent(errors, body.debtor_agent, 'debtor_agent');
  validateParty(errors, body.creditor, 'creditor');
  validateAgent(errors, body.creditor_agent, 'creditor_agent');

  validateRequiredField(
    errors,
    isObject(body.blockchain_instruction),
    'blockchain_instruction',
    'blockchain_instruction is required.',
  );
  if (isObject(body.blockchain_instruction)) {
    validateTokenIdentification(
      errors,
      body.blockchain_instruction.token,
      'blockchain_instruction.token',
    );
    validateTextField(
      errors,
      body.blockchain_instruction.chain_dli,
      'blockchain_instruction.chain_dli',
      'blockchain_instruction.chain_dli is required.',
    );
    validatePatternField(
      errors,
      body.blockchain_instruction.chain_dli,
      CHAIN_DLI_PATTERN,
      'blockchain_instruction.chain_dli',
      'blockchain_instruction.chain_dli must be a 9-character uppercase DLI value.',
    );
    validateTextField(
      errors,
      body.blockchain_instruction.custody_model,
      'blockchain_instruction.custody_model',
      'blockchain_instruction.custody_model is required.',
    );
    validateEnumField(
      errors,
      body.blockchain_instruction.custody_model,
      CUSTODY_MODELS,
      'blockchain_instruction.custody_model',
      'blockchain_instruction.custody_model',
    );
    validateEnumField(
      errors,
      body.blockchain_instruction.ramp_instruction?.ramp_type,
      RAMP_TYPES,
      'blockchain_instruction.ramp_instruction.ramp_type',
      'blockchain_instruction.ramp_instruction.ramp_type',
    );
    validatePatternField(
      errors,
      body.blockchain_instruction.maximum_slippage_rate,
      MAX_SLIPPAGE_PATTERN,
      'blockchain_instruction.maximum_slippage_rate',
      'blockchain_instruction.maximum_slippage_rate must be a decimal fraction.',
    );
  }

  validateUuidField(
    errors,
    body.travel_rule_record_id,
    'travel_rule_record_id',
  );
  validateDateTimeField(errors, body.expiry_date_time, 'expiry_date_time');

  return errors;
}

export function validateTravelRuleSubmission(body) {
  const errors = [];
  validateRequiredField(errors, isObject(body), 'body', 'Request body must be a JSON object.');
  if (errors.length) {
    return errors;
  }

  validateEnumField(
    errors,
    body.submission_timing,
    TRAVEL_RULE_SUBMISSION_TIMINGS,
    'submission_timing',
    'submission_timing',
  );
  validateDateTimeField(
    errors,
    body.correction_of_callback_ref?.callback_timestamp,
    'correction_of_callback_ref.callback_timestamp',
  );

  const data = body.travel_rule_data;
  validateRequiredField(errors, isObject(data), 'travel_rule_data', 'travel_rule_data is required.');
  if (!isObject(data)) {
    return errors;
  }

  validateRequiredField(
    errors,
    isObject(data.payment_identification),
    'travel_rule_data.payment_identification',
    'travel_rule_data.payment_identification is required.',
  );
  validateTextField(
    errors,
    data.payment_identification?.end_to_end_identification,
    'travel_rule_data.payment_identification.end_to_end_identification',
    'travel_rule_data.payment_identification.end_to_end_identification is required.',
  );

  validateAmountObject(
    errors,
    data.interbank_settlement_amount,
    'travel_rule_data.interbank_settlement_amount',
  );
  validateTextField(
    errors,
    data.charge_bearer,
    'travel_rule_data.charge_bearer',
    'travel_rule_data.charge_bearer is required.',
  );
  validateEnumField(
    errors,
    data.charge_bearer,
    CHARGE_BEARERS,
    'travel_rule_data.charge_bearer',
    'travel_rule_data.charge_bearer',
  );
  validateParty(errors, data.debtor, 'travel_rule_data.debtor');
  validateWalletAccount(
    errors,
    data.debtor_account,
    'travel_rule_data.debtor_account',
  );
  validateAgent(errors, data.debtor_agent, 'travel_rule_data.debtor_agent');
  validateParty(errors, data.creditor, 'travel_rule_data.creditor');
  validateWalletAccount(
    errors,
    data.creditor_account,
    'travel_rule_data.creditor_account',
  );
  validateAgent(errors, data.creditor_agent, 'travel_rule_data.creditor_agent');
  validateEnumField(
    errors,
    data.counterparty_wallet_type,
    TRAVEL_RULE_WALLET_TYPES,
    'travel_rule_data.counterparty_wallet_type',
    'travel_rule_data.counterparty_wallet_type',
  );

  return errors;
}

export function validateTravelRuleCallback(body) {
  const errors = [];
  validateRequiredField(errors, isObject(body), 'body', 'Request body must be a JSON object.');
  if (errors.length) {
    return errors;
  }

  validateTextField(
    errors,
    body.callback_status,
    'callback_status',
    'callback_status is required.',
  );
  validateEnumField(
    errors,
    body.callback_status,
    TRAVEL_RULE_CALLBACK_STATUSES,
    'callback_status',
    'callback_status',
  );
  validateAgent(errors, body.receiving_vasp, 'receiving_vasp');
  validateDateTimeField(
    errors,
    body.callback_timestamp,
    'callback_timestamp',
    true,
  );

  if (body.callback_status === 'REJECTED') {
    validateRejectionReasons(errors, body.rejection_reasons, 'rejection_reasons');
  }

  return errors;
}

export function validateTravelRuleStatsQuery(query) {
  const errors = [];
  validateDateTimeField(errors, query.submitted_from, 'submitted_from', true);
  validateDateTimeField(errors, query.submitted_to, 'submitted_to', true);
  validateDateRange(
    errors,
    query.submitted_from,
    query.submitted_to,
    'submitted_from',
    'submitted_to',
  );
  validateEnumField(
    errors,
    query.direction,
    STATS_DIRECTIONS,
    'direction',
    'direction',
  );
  validateEnumField(
    errors,
    query.group_by,
    STATS_GROUP_BY,
    'group_by',
    'group_by',
  );
  return errors;
}

export function validateTravelRuleSearchQuery(query) {
  const errors = [];
  validateEnumField(
    errors,
    query.direction,
    STATS_DIRECTIONS,
    'direction',
    'direction',
  );
  validateDateTimeField(errors, query.submitted_from, 'submitted_from');
  validateDateTimeField(errors, query.submitted_to, 'submitted_to');
  validateDateRange(
    errors,
    query.submitted_from,
    query.submitted_to,
    'submitted_from',
    'submitted_to',
  );
  validateEnumListField(
    errors,
    query.status,
    TRAVEL_RULE_RECORD_STATUSES,
    'status',
    'status',
  );
  validateEnumListField(
    errors,
    query.callback_status,
    TRAVEL_RULE_CALLBACK_FILTER_STATUSES,
    'callback_status',
    'callback_status',
  );
  validateEnumField(
    errors,
    query.submission_timing,
    TRAVEL_RULE_SUBMISSION_TIMINGS,
    'submission_timing',
    'submission_timing',
  );
  validatePatternField(
    errors,
    query.currency,
    CURRENCY_CODE_PATTERN,
    'currency',
    'currency must be a 3-letter uppercase ISO 4217 code.',
  );
  validatePatternField(
    errors,
    query.counterparty_vasp_lei,
    LEI_PATTERN,
    'counterparty_vasp_lei',
    'counterparty_vasp_lei must be a valid LEI.',
  );
  validateEnumField(
    errors,
    query.wallet_type,
    TRAVEL_RULE_WALLET_TYPES,
    'wallet_type',
    'wallet_type',
  );
  validateDecimalField(errors, query.amount_min, 'amount_min');
  validateDecimalField(errors, query.amount_max, 'amount_max');
  validateIntegerRangeField(errors, query.page_size, 'page_size', { min: 1, max: 200 });
  validateCursorField(errors, query.after, 'after');
  validateEnumField(
    errors,
    query.sort,
    TRAVEL_RULE_SEARCH_SORTS,
    'sort',
    'sort',
  );
  return errors;
}

export function validateInstructionSearchQuery(query) {
  const errors = [];
  validateDateTimeField(errors, query.from, 'from');
  validateDateTimeField(errors, query.to, 'to');
  validateDateRange(errors, query.from, query.to, 'from', 'to');
  validateEnumListField(
    errors,
    query.status,
    INSTRUCTION_STATUSES,
    'status',
    'status',
  );
  validatePatternField(
    errors,
    query.chain_dli,
    CHAIN_DLI_PATTERN,
    'chain_dli',
    'chain_dli must be a 9-character uppercase DLI value.',
  );
  validatePatternField(
    errors,
    query.token_dti,
    TOKEN_DTI_PATTERN,
    'token_dti',
    'token_dti must be a 9-character uppercase DTI value.',
  );
  validateIntegerRangeField(errors, query.page_size, 'page_size', { min: 1, max: 500 });
  validateCursorField(errors, query.cursor, 'cursor');
  return errors;
}

export function validateReportQuery(body) {
  const errors = [];
  validateRequiredField(errors, isObject(body), 'body', 'Request body must be a JSON object.');
  if (errors.length) {
    return errors;
  }

  validateTextField(
    errors,
    body.query_identification,
    'query_identification',
    'query_identification is required.',
  );
  validateTextField(errors, body.query_type, 'query_type', 'query_type is required.');
  validateEnumField(errors, body.query_type, REPORT_QUERY_TYPES, 'query_type', 'query_type');
  validateReportAccount(errors, body.account, 'account');

  if (body.token_filter !== undefined) {
    if (!Array.isArray(body.token_filter) || body.token_filter.length === 0) {
      pushError(
        errors,
        'token_filter',
        'token_filter must be a non-empty array when provided.',
      );
    } else {
      body.token_filter.forEach((token, index) => {
        validateTokenIdentification(errors, token, `token_filter[${index}]`);
      });
    }
  }

  if (body.reporting_period !== undefined) {
    validateRequiredField(
      errors,
      isObject(body.reporting_period),
      'reporting_period',
      'reporting_period must be an object.',
    );
    if (isObject(body.reporting_period)) {
      validateDateTimeField(
        errors,
        body.reporting_period.from_date_time,
        'reporting_period.from_date_time',
      );
      validateDateTimeField(
        errors,
        body.reporting_period.to_date_time,
        'reporting_period.to_date_time',
      );
      validateDateRange(
        errors,
        body.reporting_period.from_date_time,
        body.reporting_period.to_date_time,
        'reporting_period.from_date_time',
        'reporting_period.to_date_time',
      );
    }
  }

  if (body.entry_status_filter !== undefined) {
    if (!Array.isArray(body.entry_status_filter) || body.entry_status_filter.length === 0) {
      pushError(
        errors,
        'entry_status_filter',
        'entry_status_filter must be a non-empty array when provided.',
      );
    } else {
      body.entry_status_filter.forEach((status) => {
        if (!REPORT_ENTRY_STATUSES.has(status)) {
          pushError(
            errors,
            'entry_status_filter',
            `entry_status_filter must contain only: ${Array.from(REPORT_ENTRY_STATUSES).join(', ')}.`,
          );
        }
      });
    }
  }

  validateUriField(errors, body.callback_url, 'callback_url');
  validateUuidField(errors, body.subscription_id, 'subscription_id');

  if (body.query_type === 'NOTIFICATION_SUBSCRIBE') {
    validateUriField(errors, body.callback_url, 'callback_url', { required: true });
  }

  if (body.query_type === 'NOTIFICATION_UNSUBSCRIBE') {
    if (!body.subscription_id) {
      pushError(
        errors,
        'subscription_id',
        'subscription_id is required for NOTIFICATION_UNSUBSCRIBE.',
      );
    }
  }

  return errors;
}

export function validateReportIntradayQuery(query) {
  const errors = [];
  validateTextField(errors, query.wallet_address, 'wallet_address', 'wallet_address is required.');
  validateTextField(errors, query.chain_dli, 'chain_dli', 'chain_dli is required.');
  validatePatternField(
    errors,
    query.chain_dli,
    CHAIN_DLI_PATTERN,
    'chain_dli',
    'chain_dli must be a 9-character uppercase DLI value.',
  );
  validateDateTimeField(errors, query.from_date_time, 'from_date_time');
  validateDateTimeField(errors, query.to_date_time, 'to_date_time');
  validateDateRange(errors, query.from_date_time, query.to_date_time, 'from_date_time', 'to_date_time');
  validatePatternField(
    errors,
    query.token_dti,
    TOKEN_DTI_PATTERN,
    'token_dti',
    'token_dti must be a 9-character uppercase DTI value.',
  );
  validateEnumListField(
    errors,
    query.entry_status,
    REPORT_ENTRY_STATUSES,
    'entry_status',
    'entry_status',
  );
  validateEnumField(
    errors,
    query.credit_debit_indicator,
    REPORT_CREDIT_DEBIT_INDICATORS,
    'credit_debit_indicator',
    'credit_debit_indicator',
  );
  validateIntegerRangeField(errors, query.page_size, 'page_size', { min: 1, max: 200 });
  validateCursorField(errors, query.after, 'after');
  validateEnumField(errors, query.sort, REPORT_SEARCH_SORTS, 'sort', 'sort');
  return errors;
}

export function validateReportStatementQuery(query) {
  const errors = [];
  validateTextField(errors, query.wallet_address, 'wallet_address', 'wallet_address is required.');
  validateTextField(errors, query.chain_dli, 'chain_dli', 'chain_dli is required.');
  validatePatternField(
    errors,
    query.chain_dli,
    CHAIN_DLI_PATTERN,
    'chain_dli',
    'chain_dli must be a 9-character uppercase DLI value.',
  );
  validateDateField(errors, query.from_date, 'from_date', true);
  validateDateField(errors, query.to_date, 'to_date', true);
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(String(query.from_date ?? '')) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(query.to_date ?? ''))
  ) {
    if (Date.parse(`${query.from_date}T00:00:00Z`) > Date.parse(`${query.to_date}T00:00:00Z`)) {
      pushError(errors, 'from_date', 'from_date must be earlier than or equal to to_date.');
    }
  }
  validatePatternField(
    errors,
    query.token_dti,
    TOKEN_DTI_PATTERN,
    'token_dti',
    'token_dti must be a 9-character uppercase DTI value.',
  );
  validateIntegerRangeField(errors, query.page_size, 'page_size', { min: 1, max: 200 });
  validateCursorField(errors, query.after, 'after');
  validateEnumField(errors, query.sort, REPORT_SEARCH_SORTS, 'sort', 'sort');
  return errors;
}

export function validateReportSearchQuery(query) {
  const errors = [];
  validateTextField(errors, query.wallet_address, 'wallet_address', 'wallet_address is required.');
  validateTextField(errors, query.chain_dli, 'chain_dli', 'chain_dli is required.');
  validatePatternField(
    errors,
    query.chain_dli,
    CHAIN_DLI_PATTERN,
    'chain_dli',
    'chain_dli must be a 9-character uppercase DLI value.',
  );
  validateDateTimeField(errors, query.from_date_time, 'from_date_time');
  validateDateTimeField(errors, query.to_date_time, 'to_date_time');
  validateDateRange(errors, query.from_date_time, query.to_date_time, 'from_date_time', 'to_date_time');
  validatePatternField(
    errors,
    query.token_dti,
    TOKEN_DTI_PATTERN,
    'token_dti',
    'token_dti must be a 9-character uppercase DTI value.',
  );
  validateEnumListField(
    errors,
    query.entry_status,
    REPORT_ENTRY_STATUSES,
    'entry_status',
    'entry_status',
  );
  validateEnumField(
    errors,
    query.finality_status,
    new Set(['PENDING', 'PROBABILISTIC', 'FINAL']),
    'finality_status',
    'finality_status',
  );
  validateEnumField(
    errors,
    query.credit_debit_indicator,
    REPORT_CREDIT_DEBIT_INDICATORS,
    'credit_debit_indicator',
    'credit_debit_indicator',
  );
  validateDecimalField(errors, query.amount_min, 'amount_min');
  validateDecimalField(errors, query.amount_max, 'amount_max');
  validateUuidField(errors, query.instruction_id, 'instruction_id');
  validateUuidField(errors, query.travel_rule_record_id, 'travel_rule_record_id');
  validateIntegerRangeField(errors, query.page_size, 'page_size', { min: 1, max: 200 });
  validateCursorField(errors, query.after, 'after');
  validateEnumField(errors, query.sort, REPORT_SEARCH_SORTS, 'sort', 'sort');
  return errors;
}

export function validateReportStatsQuery(query) {
  const errors = [];
  validateTextField(errors, query.wallet_address, 'wallet_address', 'wallet_address is required.');
  validateTextField(errors, query.chain_dli, 'chain_dli', 'chain_dli is required.');
  validatePatternField(
    errors,
    query.chain_dli,
    CHAIN_DLI_PATTERN,
    'chain_dli',
    'chain_dli must be a 9-character uppercase DLI value.',
  );
  validateDateTimeField(errors, query.from_date_time, 'from_date_time', true);
  validateDateTimeField(errors, query.to_date_time, 'to_date_time', true);
  validateDateRange(errors, query.from_date_time, query.to_date_time, 'from_date_time', 'to_date_time');
  validatePatternField(
    errors,
    query.token_dti,
    TOKEN_DTI_PATTERN,
    'token_dti',
    'token_dti must be a 9-character uppercase DTI value.',
  );
  validateEnumListField(
    errors,
    query.entry_status,
    REPORT_ENTRY_STATUSES,
    'entry_status',
    'entry_status',
  );
  validateEnumField(
    errors,
    query.group_by,
    REPORT_STATS_GROUP_BY,
    'group_by',
    'group_by',
  );
  return errors;
}

export function validateWebhookSubscriptionSubmission(body) {
  const errors = [];
  validateRequiredField(errors, isObject(body), 'body', 'Request body must be a JSON object.');
  if (errors.length) {
    return errors;
  }

  validateRequiredField(errors, hasText(body.url), 'url', 'url is required.');
  validateRequiredField(
    errors,
    hasText(body.signing_secret),
    'signing_secret',
    'signing_secret is required.',
  );

  if (
    body.subscribed_event_types !== undefined &&
    !Array.isArray(body.subscribed_event_types)
  ) {
    pushError(
      errors,
      'subscribed_event_types',
      'subscribed_event_types must be an array when provided.',
    );
  }

  if (Array.isArray(body.subscribed_event_types)) {
    for (const eventType of body.subscribed_event_types) {
      if (!WEBHOOK_EVENT_TYPES.has(eventType)) {
        pushError(
          errors,
          'subscribed_event_types',
          `Unsupported event type: ${eventType}`,
        );
      }
    }
  }

  return errors;
}

export function validateWebhookDispatchRequest(body) {
  if (body === undefined || body === null) {
    return [];
  }

  const errors = [];
  validateRequiredField(errors, isObject(body), 'body', 'Request body must be a JSON object.');
  if (errors.length) {
    return errors;
  }

  if (
    body.limit !== undefined &&
    (!Number.isInteger(body.limit) || body.limit <= 0)
  ) {
    pushError(errors, 'limit', 'limit must be a positive integer when provided.');
  }

  if (body.subscription_id !== undefined && !hasText(body.subscription_id)) {
    pushError(
      errors,
      'subscription_id',
      'subscription_id must be a non-empty string when provided.',
    );
  }

  return errors;
}

export function validateInvestigationCaseSubmission(body) {
  const errors = [];
  validateRequiredField(errors, isObject(body), 'body', 'Request body must be a JSON object.');
  if (errors.length) {
    return errors;
  }

  validateTextField(errors, body.case_type, 'case_type', 'case_type is required.');
  validateEnumField(errors, body.case_type, INVESTIGATION_CASE_TYPES, 'case_type', 'case_type');
  validateEnumField(errors, body.priority, INVESTIGATION_PRIORITIES, 'priority', 'priority');
  validateBooleanField(
    errors,
    body.requires_counterparty_action,
    'requires_counterparty_action',
  );
  validateUuidField(errors, body.related_instruction_id, 'related_instruction_id');
  validateUuidField(errors, body.related_uetr, 'related_uetr');
  validateRequiredField(
    errors,
    hasText(body.related_instruction_id) || hasText(body.related_uetr),
    'related_instruction_id',
    'related_instruction_id or related_uetr is required.',
  );
  validateTextField(errors, body.reason_code, 'reason_code', 'reason_code is required.');
  validateTextField(errors, body.narrative, 'narrative', 'narrative is required.');
  validateNamedReference(errors, body.opened_by, 'opened_by');
  validateNamedReference(errors, body.current_owner, 'current_owner');
  validateNamedReference(errors, body.counterparty, 'counterparty');
  if (body.assigned_team !== undefined) {
    validateTextField(
      errors,
      body.assigned_team,
      'assigned_team',
      'assigned_team must be a non-empty string.',
    );
  }
  validateDateTimeField(errors, body.next_action_due_at, 'next_action_due_at');
  validateBooleanField(
    errors,
    body.reporting_follow_up_required,
    'reporting_follow_up_required',
  );
  if (body.counterparty_reference !== undefined) {
    validateTextField(
      errors,
      body.counterparty_reference,
      'counterparty_reference',
      'counterparty_reference must be a non-empty string.',
    );
  }
  validateUuidField(errors, body.linked_return_case_id, 'linked_return_case_id');
  validateUuidArrayField(
    errors,
    body.affected_notification_ids,
    'affected_notification_ids',
  );
  validateUuidArrayField(
    errors,
    body.affected_statement_ids,
    'affected_statement_ids',
  );

  return errors;
}

export function validateInvestigationCaseUpdate(body) {
  const errors = [];
  validateRequiredField(errors, isObject(body), 'body', 'Request body must be a JSON object.');
  if (errors.length) {
    return errors;
  }

  validateEnumField(
    errors,
    body.case_status,
    INVESTIGATION_CASE_STATUSES,
    'case_status',
    'case_status',
  );
  validateEnumField(errors, body.priority, INVESTIGATION_PRIORITIES, 'priority', 'priority');
  validateBooleanField(
    errors,
    body.requires_counterparty_action,
    'requires_counterparty_action',
  );
  validateEnumField(
    errors,
    body.resolution_type,
    INVESTIGATION_RESOLUTION_TYPES,
    'resolution_type',
    'resolution_type',
  );
  validateUuidField(errors, body.linked_return_case_id, 'linked_return_case_id');
  validateNamedReference(errors, body.current_owner, 'current_owner');
  validateNamedReference(errors, body.counterparty, 'counterparty');
  if (body.assigned_team !== undefined) {
    validateTextField(
      errors,
      body.assigned_team,
      'assigned_team',
      'assigned_team must be a non-empty string.',
    );
  }
  validateDateTimeField(errors, body.next_action_due_at, 'next_action_due_at');
  validateBooleanField(
    errors,
    body.reporting_follow_up_required,
    'reporting_follow_up_required',
  );
  if (body.counterparty_reference !== undefined) {
    validateTextField(
      errors,
      body.counterparty_reference,
      'counterparty_reference',
      'counterparty_reference must be a non-empty string.',
    );
  }
  validateUuidArrayField(
    errors,
    body.affected_notification_ids,
    'affected_notification_ids',
  );
  validateUuidArrayField(
    errors,
    body.affected_statement_ids,
    'affected_statement_ids',
  );
  if (body.narrative !== undefined) {
    validateTextField(errors, body.narrative, 'narrative', 'narrative must be a non-empty string.');
  }
  if (body.resolution_summary !== undefined) {
    validateTextField(
      errors,
      body.resolution_summary,
      'resolution_summary',
      'resolution_summary must be a non-empty string.',
    );
  }
  if (
    body.case_status &&
    ['RESOLVED', 'CLOSED'].includes(body.case_status) &&
    !hasText(body.resolution_summary)
  ) {
    pushError(
      errors,
      'resolution_summary',
      'resolution_summary is required when case_status is RESOLVED or CLOSED.',
    );
  }

  return errors;
}

export function validateInvestigationCaseSearchQuery(query) {
  const errors = [];
  validateUuidField(errors, query.related_instruction_id, 'related_instruction_id');
  validateUuidField(errors, query.related_uetr, 'related_uetr');
  validateEnumListField(
    errors,
    query.case_type,
    INVESTIGATION_CASE_TYPES,
    'case_type',
    'case_type',
  );
  validateEnumListField(
    errors,
    query.case_status,
    INVESTIGATION_CASE_STATUSES,
    'case_status',
    'case_status',
  );
  validateEnumListField(
    errors,
    query.priority,
    INVESTIGATION_PRIORITIES,
    'priority',
    'priority',
  );
  validateBooleanQueryField(
    errors,
    query.requires_counterparty_action,
    'requires_counterparty_action',
  );
  validateDateTimeField(errors, query.opened_from, 'opened_from');
  validateDateTimeField(errors, query.opened_to, 'opened_to');
  validateDateRange(errors, query.opened_from, query.opened_to, 'opened_from', 'opened_to');
  validateIntegerRangeField(errors, query.page_size, 'page_size', { min: 1, max: 200 });
  validateCursorField(errors, query.cursor, 'cursor');
  return errors;
}

export function validateReturnCaseSubmission(body) {
  const errors = [];
  validateRequiredField(errors, isObject(body), 'body', 'Request body must be a JSON object.');
  if (errors.length) {
    return errors;
  }

  validateTextField(errors, body.return_type, 'return_type', 'return_type is required.');
  validateEnumField(errors, body.return_type, RETURN_CASE_TYPES, 'return_type', 'return_type');
  validateTextField(errors, body.return_method, 'return_method', 'return_method is required.');
  validateEnumField(
    errors,
    body.return_method,
    RETURN_METHODS,
    'return_method',
    'return_method',
  );
  validateUuidField(errors, body.original_instruction_id, 'original_instruction_id');
  validateUuidField(errors, body.original_uetr, 'original_uetr');
  validateRequiredField(
    errors,
    hasText(body.original_instruction_id) || hasText(body.original_uetr),
    'original_instruction_id',
    'original_instruction_id or original_uetr is required.',
  );
  validateAmountObject(errors, body.return_amount, 'return_amount');
  if (body.return_asset !== undefined) {
    validateTokenIdentification(errors, body.return_asset, 'return_asset');
  }
  validateTextField(errors, body.reason_code, 'reason_code', 'reason_code is required.');
  validateTextField(errors, body.narrative, 'narrative', 'narrative is required.');
  validateNamedReference(errors, body.opened_by, 'opened_by');
  validateNamedReference(errors, body.current_owner, 'current_owner');
  validateNamedReference(errors, body.counterparty, 'counterparty');
  if (body.assigned_team !== undefined) {
    validateTextField(
      errors,
      body.assigned_team,
      'assigned_team',
      'assigned_team must be a non-empty string.',
    );
  }
  validateDateTimeField(errors, body.next_action_due_at, 'next_action_due_at');
  validateBooleanField(
    errors,
    body.reporting_follow_up_required,
    'reporting_follow_up_required',
  );
  if (body.counterparty_reference !== undefined) {
    validateTextField(
      errors,
      body.counterparty_reference,
      'counterparty_reference',
      'counterparty_reference must be a non-empty string.',
    );
  }
  validateUuidField(
    errors,
    body.linked_investigation_case_id,
    'linked_investigation_case_id',
  );
  validateUuidField(
    errors,
    body.compensating_instruction_id,
    'compensating_instruction_id',
  );
  if (body.off_chain_reference !== undefined) {
    validateTextField(
      errors,
      body.off_chain_reference,
      'off_chain_reference',
      'off_chain_reference must be a non-empty string.',
    );
  }
  validateUuidArrayField(
    errors,
    body.affected_notification_ids,
    'affected_notification_ids',
  );
  validateUuidArrayField(
    errors,
    body.affected_statement_ids,
    'affected_statement_ids',
  );

  return errors;
}

export function validateReturnCaseUpdate(body) {
  const errors = [];
  validateRequiredField(errors, isObject(body), 'body', 'Request body must be a JSON object.');
  if (errors.length) {
    return errors;
  }

  validateEnumField(
    errors,
    body.return_status,
    RETURN_CASE_STATUSES,
    'return_status',
    'return_status',
  );
  validateUuidField(
    errors,
    body.linked_investigation_case_id,
    'linked_investigation_case_id',
  );
  validateUuidField(
    errors,
    body.compensating_instruction_id,
    'compensating_instruction_id',
  );
  validateNamedReference(errors, body.current_owner, 'current_owner');
  validateNamedReference(errors, body.counterparty, 'counterparty');
  if (body.assigned_team !== undefined) {
    validateTextField(
      errors,
      body.assigned_team,
      'assigned_team',
      'assigned_team must be a non-empty string.',
    );
  }
  validateDateTimeField(errors, body.next_action_due_at, 'next_action_due_at');
  validateBooleanField(
    errors,
    body.reporting_follow_up_required,
    'reporting_follow_up_required',
  );
  if (body.counterparty_reference !== undefined) {
    validateTextField(
      errors,
      body.counterparty_reference,
      'counterparty_reference',
      'counterparty_reference must be a non-empty string.',
    );
  }
  validateUuidArrayField(
    errors,
    body.affected_notification_ids,
    'affected_notification_ids',
  );
  validateUuidArrayField(
    errors,
    body.affected_statement_ids,
    'affected_statement_ids',
  );
  if (body.narrative !== undefined) {
    validateTextField(errors, body.narrative, 'narrative', 'narrative must be a non-empty string.');
  }
  if (body.resolution_summary !== undefined) {
    validateTextField(
      errors,
      body.resolution_summary,
      'resolution_summary',
      'resolution_summary must be a non-empty string.',
    );
  }
  if (body.off_chain_reference !== undefined) {
    validateTextField(
      errors,
      body.off_chain_reference,
      'off_chain_reference',
      'off_chain_reference must be a non-empty string.',
    );
  }

  return errors;
}

export function validateReturnCaseSearchQuery(query) {
  const errors = [];
  validateUuidField(errors, query.original_instruction_id, 'original_instruction_id');
  validateUuidField(errors, query.original_uetr, 'original_uetr');
  validateUuidField(
    errors,
    query.linked_investigation_case_id,
    'linked_investigation_case_id',
  );
  validateEnumListField(
    errors,
    query.return_type,
    RETURN_CASE_TYPES,
    'return_type',
    'return_type',
  );
  validateEnumListField(
    errors,
    query.return_method,
    RETURN_METHODS,
    'return_method',
    'return_method',
  );
  validateEnumListField(
    errors,
    query.return_status,
    RETURN_CASE_STATUSES,
    'return_status',
    'return_status',
  );
  validateDateTimeField(errors, query.opened_from, 'opened_from');
  validateDateTimeField(errors, query.opened_to, 'opened_to');
  validateDateRange(errors, query.opened_from, query.opened_to, 'opened_from', 'opened_to');
  validateIntegerRangeField(errors, query.page_size, 'page_size', { min: 1, max: 200 });
  validateCursorField(errors, query.cursor, 'cursor');
  return errors;
}

function validateTomAmountObject(errors, value, field) {
  validateRequiredField(
    errors,
    isObject(value),
    field,
    `${field} is required and must be an object.`,
  );
  if (!isObject(value)) {
    return;
  }

  if (typeof value.amount !== 'string' || value.amount.length === 0) {
    pushError(errors, `${field}.amount`, `${field}.amount is required and must be a string.`);
  } else if (value.amount.length > 30) {
    pushError(errors, `${field}.amount`, `${field}.amount must be at most 30 characters.`);
  } else if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(value.amount)) {
    pushError(errors, `${field}.amount`, `${field}.amount must be a decimal string.`);
  }

  if (typeof value.currency !== 'string' || value.currency.length === 0) {
    pushError(
      errors,
      `${field}.currency`,
      `${field}.currency is required and must be a string.`,
    );
  } else if (value.currency.length > 20) {
    pushError(
      errors,
      `${field}.currency`,
      `${field}.currency must be at most 20 characters.`,
    );
  }
}

function validateTomReasonObject(errors, value, field, allowedCodes) {
  validateRequiredField(
    errors,
    isObject(value),
    field,
    `${field} is required and must be an object.`,
  );
  if (!isObject(value)) {
    return;
  }

  if (!hasText(value.code)) {
    pushError(errors, `${field}.code`, `${field}.code is required.`);
  } else if (!allowedCodes.has(value.code)) {
    pushError(
      errors,
      `${field}.code`,
      `${field}.code must be one of: ${Array.from(allowedCodes).join(', ')}.`,
    );
  }

  const additionalInformation = value.additional_information;
  const isNarr = value.code === 'NARR';

  if (additionalInformation === undefined || additionalInformation === null) {
    if (isNarr) {
      pushError(
        errors,
        `${field}.additional_information`,
        `${field}.additional_information is required when code is NARR.`,
      );
    }
    return;
  }

  if (!Array.isArray(additionalInformation)) {
    pushError(
      errors,
      `${field}.additional_information`,
      `${field}.additional_information must be an array of strings.`,
    );
    return;
  }

  if (additionalInformation.length < 1 || additionalInformation.length > 5) {
    pushError(
      errors,
      `${field}.additional_information`,
      `${field}.additional_information must contain between 1 and 5 entries.`,
    );
  }

  additionalInformation.forEach((entry, index) => {
    if (typeof entry !== 'string' || entry.length === 0) {
      pushError(
        errors,
        `${field}.additional_information[${index}]`,
        `${field}.additional_information[${index}] must be a non-empty string.`,
      );
      return;
    }
    if (entry.length > 105) {
      pushError(
        errors,
        `${field}.additional_information[${index}]`,
        `${field}.additional_information[${index}] must be at most 105 characters.`,
      );
    }
  });
}

function validateTomOptionalString(errors, value, field, maxLength) {
  if (value === undefined || value === null) {
    return;
  }
  if (typeof value !== 'string' || value.length === 0) {
    pushError(errors, field, `${field} must be a non-empty string when provided.`);
    return;
  }
  if (value.length > maxLength) {
    pushError(errors, field, `${field} must be at most ${maxLength} characters.`);
  }
}

function validateTomOptionalAmountObject(errors, value, field) {
  if (value === undefined || value === null) {
    return;
  }
  validateTomAmountObject(errors, value, field);
}

function validateTomWebhookUrl(errors, value, field) {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== 'string' || value.length === 0) {
    pushError(errors, field, `${field} must be a non-empty string when provided.`);
    return;
  }

  if (value.length > 500) {
    pushError(errors, field, `${field} must be at most 500 characters.`);
    return;
  }

  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      pushError(errors, field, `${field} must be an http or https URI.`);
    }
  } catch {
    pushError(errors, field, `${field} must be a valid URI.`);
  }
}

export function validateTomReturnRequest(body) {
  const errors = [];
  validateRequiredField(errors, isObject(body), 'body', 'Request body must be a JSON object.');
  if (errors.length) {
    return errors;
  }

  validateTomReasonObject(
    errors,
    body.return_reason,
    'return_reason',
    TOM_RETURN_REASON_CODES,
  );
  validateTomAmountObject(errors, body.returned_amount, 'returned_amount');
  validateTomOptionalAmountObject(errors, body.compensation_amount, 'compensation_amount');
  validateTomOptionalString(errors, body.return_identification, 'return_identification', 35);
  validateTomOptionalString(errors, body.instruction_for_creditor, 'instruction_for_creditor', 210);
  if (body.webhook_url !== undefined && body.webhook_url !== null) {
    pushError(
      errors,
      'webhook_url',
      'webhook_url is only accepted on ReversalRequest.',
    );
  }
  return errors;
}

export function validateTomReversalRequest(body) {
  const errors = [];
  validateRequiredField(errors, isObject(body), 'body', 'Request body must be a JSON object.');
  if (errors.length) {
    return errors;
  }

  validateTomReasonObject(
    errors,
    body.reversal_reason,
    'reversal_reason',
    TOM_REVERSAL_REASON_CODES,
  );
  validateTomAmountObject(errors, body.reversed_amount, 'reversed_amount');
  validateTomOptionalAmountObject(errors, body.compensation_amount, 'compensation_amount');
  validateTomOptionalString(errors, body.reversal_identification, 'reversal_identification', 35);
  validateTomOptionalString(errors, body.request_narrative, 'request_narrative', 500);
  validateTomWebhookUrl(errors, body.webhook_url, 'webhook_url');
  return errors;
}
