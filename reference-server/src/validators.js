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
const MAX_SLIPPAGE_PATTERN = /^0*(\d{0,2}\.\d{1,8}|\d{0,3})$/;

const WEBHOOK_EVENT_TYPES = new Set([
  'execution_status.updated',
  'finality_receipt.updated',
  'reporting_notification.created',
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

function validateUuidField(errors, value, field) {
  if (value === undefined || value === null || value === '') {
    return;
  }

  if (!isUuid(value)) {
    pushError(errors, field, `${field} must be a UUID.`);
  }
}

function validateTextField(errors, value, field, message) {
  validateRequiredField(errors, hasText(value), field, message);
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
