import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { createMockEvmChainAdapter } from './chain/mock-evm-adapter.js';

const TRAVEL_RULE_CALLBACK_STATUSES = new Set([
  'ACCEPTED',
  'REJECTED',
  'UNDER_REVIEW',
]);
const TRAVEL_RULE_SUBMISSION_TIMINGS = new Set([
  'PRE_TX',
  'POST_TX',
  'SIMULTANEOUS',
]);
const WEBHOOK_EVENT_TYPES = [
  'execution_status.updated',
  'finality_receipt.updated',
  'reporting_notification.created',
];
const WEBHOOK_DELIVERY_TERMINAL_STATES = new Set(['DELIVERED', 'FAILED']);

function nowIso() {
  return new Date().toISOString();
}

function parseJson(value, fallback) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function serialize(value) {
  return JSON.stringify(value);
}

function formatDecimalAmount(value, digits = 8) {
  return Number(value).toFixed(digits).replace(/\.?0+$/, '');
}

function buildWebhookSignature(signingSecret, timestamp, body) {
  const digest = createHmac('sha256', signingSecret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

const DEFAULT_WEBHOOK_RETRY_SCHEDULE_MS = [30_000, 120_000, 600_000, 1_800_000];

function normalizeRetryScheduleMs(retryScheduleMs) {
  if (!Array.isArray(retryScheduleMs)) {
    return [...DEFAULT_WEBHOOK_RETRY_SCHEDULE_MS];
  }

  const normalized = retryScheduleMs
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value > 0);

  return normalized.length > 0
    ? normalized
    : [...DEFAULT_WEBHOOK_RETRY_SCHEDULE_MS];
}

function buildNextAttemptAt(fromIso, attemptCount, retryScheduleMs) {
  const schedule = normalizeRetryScheduleMs(retryScheduleMs);
  const delayMs = schedule[Math.min(attemptCount - 1, schedule.length - 1)];
  return new Date(
    Date.parse(fromIso) + delayMs,
  ).toISOString();
}

function normalizeTravelRuleSubmissionTiming(value) {
  return TRAVEL_RULE_SUBMISSION_TIMINGS.has(value) ? value : 'PRE_TX';
}

function parseListFilter(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => String(item).split(',')).map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function encodeCursor(index) {
  return Buffer.from(JSON.stringify({ index }), 'utf8').toString('base64');
}

function decodeCursor(cursor) {
  if (!cursor) {
    return 0;
  }

  try {
    const payload = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
    return Number.isInteger(payload.index) && payload.index >= 0 ? payload.index : 0;
  } catch {
    return 0;
  }
}

function getTravelRuleData(record) {
  return record.travel_rule_data ?? {};
}

function getTravelRuleLatestCallbackStatus(record) {
  return record.callbacks?.at(-1)?.callback_status ?? 'PENDING';
}

function getTravelRulePrimaryChainId(record) {
  return (
    getTravelRuleData(record).blockchain_settlement?.primary_chain_id ??
    getTravelRuleData(record).settlement_instruction?.clearing_system?.proprietary ??
    null
  );
}

function getTravelRuleTokenIdentification(record) {
  const data = getTravelRuleData(record);
  return (
    data.token_identification ??
    data.blockchain_settlement?.legs?.[0]?.token_identification ??
    null
  );
}

function getTravelRuleDirection() {
  return 'OUTGOING';
}

function getTravelRuleVolumeKey(record) {
  const data = getTravelRuleData(record);
  const currency = data.interbank_settlement_amount?.currency ?? 'XXX';
  const tokenIdentification = getTravelRuleTokenIdentification(record);
  return serialize({
    currency,
    token_identification: currency === 'XXX' ? tokenIdentification : null,
  });
}

function buildTravelRuleCurrencyVolumeMap(records) {
  const volumes = new Map();
  for (const record of records) {
    const data = getTravelRuleData(record);
    const key = getTravelRuleVolumeKey(record);
    const existing = volumes.get(key) ?? {
      currency: data.interbank_settlement_amount?.currency ?? 'XXX',
      token_identification:
        (data.interbank_settlement_amount?.currency ?? 'XXX') === 'XXX'
          ? getTravelRuleTokenIdentification(record)
          : undefined,
      total_amount: 0,
      record_count: 0,
    };

    existing.total_amount += Number.parseFloat(
      data.interbank_settlement_amount?.amount ?? '0',
    );
    existing.record_count += 1;
    volumes.set(key, existing);
  }

  return Array.from(volumes.values()).map((entry) => ({
    currency: entry.currency,
    ...(entry.token_identification ? { token_identification: entry.token_identification } : {}),
    total_amount: entry.total_amount.toFixed(8).replace(/\.?0+$/, (match) =>
      match.includes('.') ? '' : match,
    ),
    record_count: entry.record_count,
  }));
}

function buildTravelRuleSummary(record) {
  const data = getTravelRuleData(record);
  const amount = data.interbank_settlement_amount ?? {};
  return {
    record_id: record.record_id,
    direction: getTravelRuleDirection(record),
    submitted_at: record.submitted_at,
    last_updated_at: record.last_updated_at,
    status: record.status,
    submission_timing: record.submission_timing,
    primary_chain_id: getTravelRulePrimaryChainId(record),
    is_bridge: (data.blockchain_settlement?.legs?.length ?? 0) > 1,
    debtor_name: data.debtor?.name ?? null,
    debtor_vasp_lei:
      data.debtor_agent?.financial_institution_identification?.lei ??
      data.debtor_agent?.lei ??
      null,
    creditor_name: data.creditor?.name ?? null,
    creditor_vasp_lei:
      data.creditor_agent?.financial_institution_identification?.lei ??
      data.creditor_agent?.lei ??
      null,
    settlement_amount: amount.amount ?? null,
    settlement_currency: amount.currency ?? null,
    token_identification: getTravelRuleTokenIdentification(record),
    debtor_wallet_type: data.debtor_wallet_type ?? null,
    creditor_wallet_type: data.creditor_wallet_type ?? null,
    latest_callback_status: getTravelRuleLatestCallbackStatus(record),
  };
}

function buildTravelRuleCallbackReceipt(record, previousStatus, callbackRecordedAt) {
  return {
    record_id: record.record_id,
    callback_recorded_at: callbackRecordedAt,
    current_status: record.status,
    previous_status: previousStatus ?? null,
  };
}

function getTravelRuleBreakdownKey(record, groupBy) {
  const data = getTravelRuleData(record);
  const summary = buildTravelRuleSummary(record);

  if (groupBy === 'status') {
    return { value: record.status, label: record.status };
  }
  if (groupBy === 'callback_status') {
    return {
      value: getTravelRuleLatestCallbackStatus(record),
      label: getTravelRuleLatestCallbackStatus(record),
    };
  }
  if (groupBy === 'submission_timing') {
    return { value: record.submission_timing, label: record.submission_timing };
  }
  if (groupBy === 'chain') {
    return {
      value: summary.primary_chain_id ?? 'UNKNOWN',
      label: summary.primary_chain_id ?? 'UNKNOWN',
    };
  }
  if (groupBy === 'token') {
    const token = summary.token_identification ?? {};
    return {
      value: token.dti ?? token.isin ?? token.ticker ?? 'UNKNOWN',
      label: token.ticker ?? token.dti ?? token.isin ?? 'UNKNOWN',
    };
  }
  if (groupBy === 'wallet_type') {
    const value = summary.debtor_wallet_type ?? summary.creditor_wallet_type ?? 'UNKNOWN';
    return { value, label: value };
  }
  if (groupBy === 'counterparty_vasp') {
    return {
      value: summary.creditor_vasp_lei ?? 'UNKNOWN',
      label:
        data.creditor_agent?.financial_institution_identification?.name ??
        data.creditor_agent?.name ??
        summary.creditor_vasp_lei ??
        'UNKNOWN',
    };
  }
  if (groupBy === 'rejection_reason_code') {
    const code = record.callbacks?.at(-1)?.rejection_reasons?.[0]?.code ?? 'NONE';
    return { value: code, label: code };
  }

  return null;
}

function buildInstructionResponse(record) {
  return {
    instruction_id: record.instruction_id,
    uetr: record.uetr,
    status: record.status,
    custody_model: record.custody_model,
    fee_estimate: record.fee_estimate,
    expiry_date_time: record.expiry_date_time,
    debit_timing: record.debit_timing,
    created_at: record.created_at,
  };
}

function buildCancellationResponse(record, cancelledAt) {
  return {
    instruction_id: record.instruction_id,
    status: 'CANCELLED',
    cancelled_at: cancelledAt,
  };
}

function getInstructionStatusReason(status, failureReason = null) {
  if (status === 'PENDING') {
    return {
      code: 'ACCEPTED_FOR_EXECUTION',
      description: 'Instruction accepted and queued for execution.',
    };
  }
  if (status === 'QUOTED') {
    return {
      code: 'AWAITING_SIGNATURE',
      description: 'Unsigned transaction returned; awaiting delegated signing.',
    };
  }
  if (status === 'BROADCAST') {
    return {
      code: 'BROADCAST_TO_CHAIN',
      description: 'Transaction submitted to the blockchain network.',
    };
  }
  if (status === 'CONFIRMING') {
    return {
      code: 'BLOCK_INCLUDED',
      description: 'Transaction included in a block and accumulating confirmations.',
    };
  }
  if (status === 'FINAL') {
    return {
      code: 'FINALITY_THRESHOLD_REACHED',
      description: 'Transaction reached the required finality threshold.',
    };
  }
  if (status === 'FAILED') {
    return {
      code: 'EXECUTION_FAILED',
      description: failureReason ?? 'Instruction execution failed.',
    };
  }
  if (status === 'CANCELLED') {
    return {
      code: 'CANCELLED_BY_INSTRUCTING_PARTY',
      description: 'Instruction cancelled before on-chain broadcast.',
    };
  }
  if (status === 'EXPIRED') {
    return {
      code: 'EXPIRY_REACHED',
      description: failureReason ?? 'Instruction expired before execution.',
    };
  }
  if (status === 'SLIPPAGE_EXCEEDED') {
    return {
      code: 'SLIPPAGE_LIMIT_EXCEEDED',
      description: failureReason ?? 'Instruction rejected because slippage exceeded the limit.',
    };
  }
  if (status === 'RAMP_FAILED') {
    return {
      code: 'RAMP_EXECUTION_FAILED',
      description: failureReason ?? 'On/off-ramp execution failed.',
    };
  }

  return {
    code: 'STATUS_UPDATED',
    description: 'Instruction status updated.',
  };
}

function buildInstructionStatusEvent({ status, statusAt, failureReason = null }) {
  const reason = getInstructionStatusReason(status, failureReason);
  return {
    event_id: randomUUID(),
    status,
    status_at: statusAt,
    reason_code: reason.code,
    description: reason.description,
  };
}

function buildInstructionStatusHistory(record) {
  return (record.status_history ?? []).map((event, index) => ({
    sequence: index + 1,
    ...event,
  }));
}

function deriveInstructionStatusGroup(status) {
  if (['PENDING', 'QUOTED'].includes(status)) {
    return 'PRE_EXECUTION';
  }
  if (['BROADCAST', 'CONFIRMING'].includes(status)) {
    return 'IN_FLIGHT';
  }
  if (status === 'FINAL') {
    return 'SETTLED';
  }
  if (status === 'CANCELLED') {
    return 'CANCELLED';
  }

  return 'EXCEPTION';
}

function findInstructionStatusEvent(record, status) {
  const history = record.status_history ?? [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].status === status) {
      return history[index];
    }
  }

  return null;
}

function buildExecutionStatusResponse(record) {
  const history = buildInstructionStatusHistory(record);
  const latestStatusEvent = history.at(-1) ?? null;

  return {
    instruction_id: record.instruction_id,
    uetr: record.uetr,
    end_to_end_identification:
      record.payment_identification?.end_to_end_identification ?? null,
    travel_rule_record_id: record.travel_rule_record_id,
    status: record.status,
    status_group: deriveInstructionStatusGroup(record.status),
    latest_status_at: latestStatusEvent?.status_at ?? record.updated_at,
    failure_reason: record.failure_reason,
    chain_dli: record.blockchain_instruction?.chain_dli ?? null,
    token: record.blockchain_instruction?.token ?? null,
    transaction_hash: record.on_chain_settlement?.transaction_hash ?? null,
    finality_status: record.on_chain_settlement?.finality_status ?? null,
    confirmation_depth: record.on_chain_settlement?.confirmation_depth ?? null,
    required_confirmation_depth:
      record.on_chain_settlement?.required_confirmation_depth ?? null,
    debit_timing: record.debit_timing,
    expiry_date_time: record.expiry_date_time,
    created_at: record.created_at,
    updated_at: record.updated_at,
    status_history: history,
  };
}

function buildFinalityReceipt(record) {
  const broadcastEvent = findInstructionStatusEvent(record, 'BROADCAST');
  const confirmingEvent = findInstructionStatusEvent(record, 'CONFIRMING');
  const finalEvent = findInstructionStatusEvent(record, 'FINAL');
  let notApplicableReason = null;

  if (record.status === 'CANCELLED') {
    notApplicableReason = 'Instruction was cancelled before on-chain broadcast.';
  } else if (record.status === 'EXPIRED') {
    notApplicableReason = 'Instruction expired before on-chain broadcast.';
  } else if (['PENDING', 'QUOTED'].includes(record.status)) {
    notApplicableReason = 'Instruction has not yet been broadcast to chain.';
  }

  return {
    instruction_id: record.instruction_id,
    uetr: record.uetr,
    end_to_end_identification:
      record.payment_identification?.end_to_end_identification ?? null,
    travel_rule_record_id: record.travel_rule_record_id,
    instruction_status: record.status,
    chain_dli: record.blockchain_instruction?.chain_dli ?? null,
    token: record.blockchain_instruction?.token ?? null,
    settlement_amount: record.interbank_settlement_amount ?? null,
    transaction_hash: record.on_chain_settlement?.transaction_hash ?? null,
    broadcast_at: broadcastEvent?.status_at ?? null,
    included_at:
      confirmingEvent?.status_at ??
      record.on_chain_settlement?.block_timestamp ??
      null,
    block_number: record.on_chain_settlement?.block_number ?? null,
    block_timestamp: record.on_chain_settlement?.block_timestamp ?? null,
    confirmation_depth: record.on_chain_settlement?.confirmation_depth ?? null,
    required_confirmation_depth:
      record.on_chain_settlement?.required_confirmation_depth ?? null,
    finality_status: record.on_chain_settlement?.finality_status ?? null,
    observed_at: record.updated_at,
    final_at: finalEvent?.status_at ?? null,
    not_applicable_reason: notApplicableReason,
  };
}

function normalizeInstructionStatusHistory(statusHistory, record) {
  if (Array.isArray(statusHistory) && statusHistory.length > 0) {
    return statusHistory;
  }

  return [
    buildInstructionStatusEvent({
      status: record.status,
      statusAt: record.updated_at ?? record.created_at ?? nowIso(),
      failureReason: record.failure_reason ?? null,
    }),
  ];
}

function appendInstructionStatusEvent(record, status, statusAt, failureReason = null) {
  const history = normalizeInstructionStatusHistory(record.status_history, record);
  if (history.at(-1)?.status === status) {
    return history;
  }

  return [
    ...history,
    buildInstructionStatusEvent({
      status,
      statusAt,
      failureReason,
    }),
  ];
}

function normalizeTravelRuleSubmission(submission) {
  const travelRuleData = {
    ...(submission.travel_rule_data ?? {}),
  };
  if (!travelRuleData.blockchain_settlement && submission.blockchain_settlement) {
    travelRuleData.blockchain_settlement = submission.blockchain_settlement;
  }

  return {
    submission_timing: normalizeTravelRuleSubmissionTiming(submission.submission_timing),
    travel_rule_data: travelRuleData,
    submitting_vasp:
      submission.submitting_vasp ??
      submission.travel_rule_data?.debtor_agent ??
      null,
    correction_of_callback_ref: submission.correction_of_callback_ref ?? null,
  };
}

function normalizeInstructionSubmission(submission) {
  const paymentIdentification = submission.payment_identification ?? {};
  const blockchainInstruction = submission.blockchain_instruction ?? {};
  const token = blockchainInstruction.token ?? submission.token ?? {};

  return {
    payment_identification: {
      ...paymentIdentification,
      end_to_end_identification:
        paymentIdentification.end_to_end_identification ??
        `E2E-${randomUUID().slice(0, 8).toUpperCase()}`,
      uetr: paymentIdentification.uetr ?? randomUUID(),
      quote_id: paymentIdentification.quote_id ?? null,
    },
    settlement_information: submission.settlement_information ?? null,
    payment_type_information: submission.payment_type_information ?? null,
    debtor: submission.debtor ?? null,
    debtor_account: submission.debtor_account ?? null,
    debtor_agent: submission.debtor_agent ?? null,
    creditor: submission.creditor ?? null,
    creditor_account: submission.creditor_account ?? null,
    creditor_agent: submission.creditor_agent ?? null,
    interbank_settlement_amount:
      submission.interbank_settlement_amount ?? {
        amount: submission.amount ?? '0',
        currency: submission.currency ?? 'USD',
      },
    instructed_amount: submission.instructed_amount ?? null,
    instruction_for_next_agent: submission.instruction_for_next_agent ?? null,
    purpose: submission.purpose ?? null,
    remittance_information: submission.remittance_information ?? null,
    blockchain_instruction: {
      token: {
        token_symbol: token.token_symbol ?? submission.currency ?? 'USDC',
        token_dti: token.token_dti ?? '4H95J0R2X',
        ...token,
      },
      chain_dli: blockchainInstruction.chain_dli ?? submission.chain_dli ?? 'X9J9XDMTD',
      custody_model: blockchainInstruction.custody_model ?? submission.custody_model ?? 'FULL_CUSTODY',
      maximum_slippage_rate:
        blockchainInstruction.maximum_slippage_rate ??
        submission.maximum_slippage_rate ??
        '0.0010',
      ...blockchainInstruction,
    },
    travel_rule_record_id: submission.travel_rule_record_id ?? null,
    expiry_date_time:
      submission.expiry_date_time ??
      new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
}

function buildInstructionSearchSummary(record) {
  return {
    instruction_id: record.instruction_id,
    status: record.status,
    end_to_end_identification:
      record.payment_identification?.end_to_end_identification ?? null,
    debtor_name: record.debtor?.name ?? null,
    creditor_name: record.creditor?.name ?? null,
    created_at: record.created_at,
    amount: record.interbank_settlement_amount?.amount ?? null,
    currency: record.interbank_settlement_amount?.currency ?? null,
    chain_dli: record.blockchain_instruction?.chain_dli ?? null,
    token_symbol: record.blockchain_instruction?.token?.token_symbol ?? null,
    finality_status: record.on_chain_settlement?.finality_status ?? null,
    transaction_hash: record.on_chain_settlement?.transaction_hash ?? null,
  };
}

function getInstructionStatusRank(status) {
  if (['PENDING', 'QUOTED'].includes(status)) {
    return 1;
  }
  if (status === 'BROADCAST') {
    return 2;
  }
  if (status === 'CONFIRMING') {
    return 3;
  }
  if (status === 'FINAL') {
    return 4;
  }

  return 0;
}

function hasInstructionReachedStatus(record, status) {
  return getInstructionStatusRank(record?.status) >= getInstructionStatusRank(status);
}

function getDebitNotificationTriggerStatus(debitTiming) {
  if (debitTiming === 'ON_ACCEPTANCE') {
    return 'PENDING';
  }
  if (debitTiming === 'ON_FINALITY') {
    return 'FINAL';
  }

  return 'BROADCAST';
}

function buildReportingNotificationRecord(record, notificationKind, chainAdapter) {
  const isDebit = notificationKind === 'DEBTOR_DEBIT';
  const accountRole = isDebit ? 'DEBTOR' : 'CREDITOR';
  const party = isDebit ? record.debtor : record.creditor;
  const counterparty = isDebit ? record.creditor : record.debtor;
  const partyAccount = isDebit ? record.debtor_account : record.creditor_account;
  const counterpartyAccount = isDebit ? record.creditor_account : record.debtor_account;
  const partyAgent = isDebit ? record.debtor_agent : record.creditor_agent;
  const counterpartyAgent = isDebit ? record.creditor_agent : record.debtor_agent;
  const triggerStatus = isDebit
    ? getDebitNotificationTriggerStatus(record.debit_timing)
    : 'FINAL';
  const bookingDateTime = chainAdapter.getLifecycleTimestamp(record, triggerStatus);

  return {
    notification_id: randomUUID(),
    message_family: 'camt.054_analogue',
    notification_type: 'BOOKED_ENTRY',
    entry_type: isDebit ? 'DEBIT' : 'CREDIT',
    account_role: accountRole,
    booking_status: 'BOOKED',
    booking_date_time: bookingDateTime,
    value_date_time: bookingDateTime,
    instruction_id: record.instruction_id,
    uetr: record.uetr,
    end_to_end_identification:
      record.payment_identification?.end_to_end_identification ?? null,
    travel_rule_record_id: record.travel_rule_record_id,
    status_reference: {
      trigger_status: triggerStatus,
      debit_timing: record.debit_timing,
      current_instruction_status: record.status,
    },
    party: {
      name: party?.name ?? null,
      lei: party?.lei ?? null,
      wallet_address: partyAccount?.proxy?.identification ?? null,
    },
    counterparty: {
      name: counterparty?.name ?? null,
      lei: counterparty?.lei ?? null,
      wallet_address: counterpartyAccount?.proxy?.identification ?? null,
    },
    servicing_agent: partyAgent
      ? {
          name: partyAgent.name ?? null,
          lei: partyAgent.lei ?? null,
          bic: partyAgent.bic ?? null,
        }
      : null,
    counterparty_agent: counterpartyAgent
      ? {
          name: counterpartyAgent.name ?? null,
          lei: counterpartyAgent.lei ?? null,
          bic: counterpartyAgent.bic ?? null,
        }
      : null,
    settlement_amount: record.interbank_settlement_amount ?? null,
    chain_dli: record.blockchain_instruction?.chain_dli ?? null,
    token: record.blockchain_instruction?.token ?? null,
    transaction_hash: record.on_chain_settlement?.transaction_hash ?? null,
    remittance_information: record.remittance_information ?? null,
    created_at: nowIso(),
  };
}

function buildReportingNotificationSummary(record) {
  return {
    notification_id: record.notification_id,
    entry_type: record.entry_type,
    account_role: record.account_role,
    booking_status: record.booking_status,
    booking_date_time: record.booking_date_time,
    instruction_id: record.instruction_id,
    uetr: record.uetr,
    end_to_end_identification: record.end_to_end_identification,
    party_name: record.party?.name ?? null,
    counterparty_name: record.counterparty?.name ?? null,
    amount: record.settlement_amount?.amount ?? null,
    currency: record.settlement_amount?.currency ?? null,
    token_symbol: record.token?.token_symbol ?? null,
    chain_dli: record.chain_dli,
    transaction_hash: record.transaction_hash,
  };
}

function buildStatementPeriod(notifications) {
  const ordered = [...notifications].sort(
    (left, right) =>
      Date.parse(left.booking_date_time) - Date.parse(right.booking_date_time),
  );

  return {
    from: ordered[0]?.booking_date_time ?? null,
    to: ordered.at(-1)?.booking_date_time ?? null,
  };
}

function buildReportingStatementKey(record, accountRole) {
  return serialize({
    instruction_id: record.instruction_id,
    account_role: accountRole,
  });
}

function buildReportingStatementRecord(record, notifications, accountRole) {
  if (!notifications.length) {
    return null;
  }

  const orderedNotifications = [...notifications].sort(
    (left, right) =>
      Date.parse(left.booking_date_time) - Date.parse(right.booking_date_time),
  );
  const summaryNotifications = orderedNotifications.map((notification) =>
    buildReportingNotificationSummary(notification),
  );
  const currency = orderedNotifications[0]?.settlement_amount?.currency ?? 'XXX';
  const debitTotal = orderedNotifications
    .filter((notification) => notification.entry_type === 'DEBIT')
    .reduce((total, notification) => total + Number.parseFloat(notification.settlement_amount?.amount ?? '0'), 0);
  const creditTotal = orderedNotifications
    .filter((notification) => notification.entry_type === 'CREDIT')
    .reduce((total, notification) => total + Number.parseFloat(notification.settlement_amount?.amount ?? '0'), 0);
  const openingBalance = 0;
  const closingBalance = creditTotal - debitTotal;
  const period = buildStatementPeriod(orderedNotifications);

  return {
    statement_id: randomUUID(),
    statement_key: buildReportingStatementKey(record, accountRole),
    message_family: 'camt.053_analogue',
    statement_type: 'ACCOUNT_STATEMENT',
    instruction_id: record.instruction_id,
    uetr: record.uetr,
    account_role: accountRole,
    statement_date: period.from ? period.from.slice(0, 10) : record.created_at.slice(0, 10),
    period,
    party: orderedNotifications[0]?.party ?? null,
    counterparty: orderedNotifications[0]?.counterparty ?? null,
    chain_dli: orderedNotifications[0]?.chain_dli ?? null,
    token: orderedNotifications[0]?.token ?? null,
    transaction_hash: record.on_chain_settlement?.transaction_hash ?? null,
    instruction_context: {
      status: record.status,
      finality_status: record.on_chain_settlement?.finality_status ?? null,
      debit_timing: record.debit_timing ?? null,
      end_to_end_identification:
        record.payment_identification?.end_to_end_identification ?? null,
    },
    balance_summary: {
      opening_balance: {
        amount: formatDecimalAmount(openingBalance),
        currency,
      },
      closing_balance: {
        amount: formatDecimalAmount(closingBalance),
        currency,
      },
      available_balance: {
        amount: formatDecimalAmount(closingBalance),
        currency,
      },
    },
    movement_summary: {
      entry_count: summaryNotifications.length,
      debit_total: formatDecimalAmount(debitTotal),
      credit_total: formatDecimalAmount(creditTotal),
      net_total: formatDecimalAmount(closingBalance),
    },
    entries: summaryNotifications,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

function buildReportingStatementSummary(record) {
  return {
    statement_id: record.statement_id,
    statement_key: record.statement_key,
    statement_type: record.statement_type,
    statement_date: record.statement_date,
    instruction_id: record.instruction_id,
    uetr: record.uetr,
    account_role: record.account_role,
    wallet_address: record.party?.wallet_address ?? null,
    party_name: record.party?.name ?? null,
    counterparty_name: record.counterparty?.name ?? null,
    chain_dli: record.chain_dli,
    token_symbol: record.token?.token_symbol ?? null,
    transaction_hash: record.transaction_hash,
    balance_summary: record.balance_summary,
    movement_summary: record.movement_summary,
    period: record.period,
    instruction_context: record.instruction_context,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

function getReportingAggregationKey(record) {
  return serialize({
    currency: record.settlement_amount?.currency ?? 'XXX',
    token_dti: record.token?.token_dti ?? null,
    token_symbol: record.token?.token_symbol ?? null,
  });
}

function buildReportingMovementTotals(records) {
  const totals = new Map();
  for (const record of records) {
    const key = getReportingAggregationKey(record);
    const existing = totals.get(key) ?? {
      currency: record.settlement_amount?.currency ?? 'XXX',
      token_dti: record.token?.token_dti ?? null,
      token_symbol: record.token?.token_symbol ?? null,
      debit_total: 0,
      credit_total: 0,
      notification_count: 0,
    };
    const amount = Number.parseFloat(record.settlement_amount?.amount ?? '0');

    if (record.entry_type === 'DEBIT') {
      existing.debit_total += amount;
    } else if (record.entry_type === 'CREDIT') {
      existing.credit_total += amount;
    }

    existing.notification_count += 1;
    totals.set(key, existing);
  }

  return Array.from(totals.values()).map((entry) => ({
    currency: entry.currency,
    ...(entry.token_dti ? { token_dti: entry.token_dti } : {}),
    ...(entry.token_symbol ? { token_symbol: entry.token_symbol } : {}),
    debit_total: formatDecimalAmount(entry.debit_total),
    credit_total: formatDecimalAmount(entry.credit_total),
    net_total: formatDecimalAmount(entry.credit_total - entry.debit_total),
    notification_count: entry.notification_count,
  }));
}

function buildIntradayAccountKey(record) {
  return serialize({
    account_role: record.account_role,
    wallet_address: record.party?.wallet_address ?? null,
    party_name: record.party?.name ?? null,
  });
}

function buildIntradayAccountViews(records) {
  const accountMap = new Map();
  for (const record of records) {
    const key = buildIntradayAccountKey(record);
    const existing = accountMap.get(key) ?? {
      account_role: record.account_role,
      party_name: record.party?.name ?? null,
      party_lei: record.party?.lei ?? null,
      wallet_address: record.party?.wallet_address ?? null,
      chain_dli: record.chain_dli ?? null,
      notifications: [],
    };
    existing.notifications.push(record);
    accountMap.set(key, existing);
  }

  return Array.from(accountMap.values()).map((entry) => ({
    account_role: entry.account_role,
    party_name: entry.party_name,
    party_lei: entry.party_lei,
    wallet_address: entry.wallet_address,
    chain_dli: entry.chain_dli,
    notification_count: entry.notifications.length,
    movement_totals: buildReportingMovementTotals(entry.notifications),
  }));
}

function buildOutboxEvent({
  eventType,
  payloadSchema,
  resourcePath,
  createdAt,
  record,
  instructionId,
  uetr,
  payload,
}) {
  return {
    event_id: randomUUID(),
    event_type: eventType,
    payload_schema: payloadSchema,
    instruction_id: instructionId ?? record?.instruction_id ?? null,
    uetr: uetr ?? record?.uetr ?? null,
    created_at: createdAt,
    delivery_state: 'PENDING',
    resource_path: resourcePath,
    payload,
  };
}

function normalizeWebhookEventTypes(eventTypes) {
  if (!Array.isArray(eventTypes) || eventTypes.length === 0) {
    return [...WEBHOOK_EVENT_TYPES];
  }

  return eventTypes.filter((eventType) => WEBHOOK_EVENT_TYPES.includes(eventType));
}

function buildWebhookSubscriptionRecord(submission) {
  const timestamp = nowIso();
  return {
    subscription_id: randomUUID(),
    url: submission.url,
    description: submission.description ?? null,
    active: submission.active !== false,
    signing_secret: submission.signing_secret,
    signing_secret_last4: submission.signing_secret.slice(-4),
    subscribed_event_types: normalizeWebhookEventTypes(submission.subscribed_event_types),
    created_at: timestamp,
    updated_at: timestamp,
    max_attempts: Number.isInteger(submission.max_attempts) && submission.max_attempts > 0
      ? submission.max_attempts
      : 5,
    last_delivery_at: null,
  };
}

function buildWebhookSubscriptionResponse(record, { includeSecret = false } = {}) {
  return {
    subscription_id: record.subscription_id,
    url: record.url,
    description: record.description,
    active: record.active,
    signing_secret_last4: record.signing_secret_last4,
    subscribed_event_types: record.subscribed_event_types,
    created_at: record.created_at,
    updated_at: record.updated_at,
    max_attempts: record.max_attempts,
    last_delivery_at: record.last_delivery_at,
    ...(includeSecret ? { signing_secret: record.signing_secret } : {}),
  };
}

function buildWebhookDeliveryRecord(event, subscription) {
  return {
    delivery_id: randomUUID(),
    subscription_id: subscription.subscription_id,
    event_id: event.event_id,
    event_type: event.event_type,
    instruction_id: event.instruction_id,
    uetr: event.uetr,
    target_url: subscription.url,
    delivery_state: 'PENDING',
    attempt_count: 0,
    last_attempt_at: null,
    next_attempt_at: event.created_at,
    response_status: null,
    response_body_excerpt: null,
    last_error: null,
    last_signature: null,
    created_at: event.created_at,
    updated_at: event.created_at,
  };
}

function buildWebhookEnvelope(event, delivery) {
  return {
    delivery_id: delivery.delivery_id,
    delivery_attempt: delivery.attempt_count + 1,
    event_id: event.event_id,
    event_type: event.event_type,
    payload_schema: event.payload_schema,
    instruction_id: event.instruction_id,
    uetr: event.uetr,
    created_at: event.created_at,
    payload: event.payload,
  };
}

function shouldEmitExecutionStatusEvent(record, previousRecord) {
  if (!previousRecord) {
    return true;
  }

  return (
    record.status !== previousRecord.status ||
    (record.failure_reason ?? null) !== (previousRecord.failure_reason ?? null) ||
    (record.updated_at ?? null) !== (previousRecord.updated_at ?? null)
  );
}

function shouldEmitFinalityReceiptEvent(record, previousRecord) {
  if (!previousRecord) {
    return true;
  }

  const currentSettlement = record.on_chain_settlement ?? {};
  const previousSettlement = previousRecord.on_chain_settlement ?? {};

  return (
    record.status !== previousRecord.status ||
    (currentSettlement.transaction_hash ?? null) !==
      (previousSettlement.transaction_hash ?? null) ||
    (currentSettlement.block_number ?? null) !==
      (previousSettlement.block_number ?? null) ||
    (currentSettlement.block_timestamp ?? null) !==
      (previousSettlement.block_timestamp ?? null) ||
    (currentSettlement.confirmation_depth ?? null) !==
      (previousSettlement.confirmation_depth ?? null) ||
    (currentSettlement.required_confirmation_depth ?? null) !==
      (previousSettlement.required_confirmation_depth ?? null) ||
    (currentSettlement.finality_status ?? null) !==
      (previousSettlement.finality_status ?? null)
  );
}

export class ReferenceStore {
  constructor({
    dbPath = ':memory:',
    chainAdapter = createMockEvmChainAdapter(),
    webhookRetryScheduleMs = DEFAULT_WEBHOOK_RETRY_SCHEDULE_MS,
  } = {}) {
    if (dbPath !== ':memory:') {
      mkdirSync(dirname(dbPath), { recursive: true });
    }

    this.chainAdapter = chainAdapter;
    this.webhookRetryScheduleMs = normalizeRetryScheduleMs(webhookRetryScheduleMs);
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS travel_rule_records (
        record_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        last_updated_at TEXT NOT NULL,
        record_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS instruction_quotes (
        quote_id TEXT PRIMARY KEY,
        valid_until TEXT NOT NULL,
        created_at TEXT NOT NULL,
        request_json TEXT NOT NULL,
        response_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS instructions (
        instruction_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        instruction_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS event_outbox (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        instruction_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        event_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS webhook_subscriptions (
        subscription_id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        active INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        subscription_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        delivery_id TEXT PRIMARY KEY,
        subscription_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        instruction_id TEXT NOT NULL,
        delivery_state TEXT NOT NULL,
        next_attempt_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        delivery_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reporting_notifications (
        notification_id TEXT PRIMARY KEY,
        instruction_id TEXT NOT NULL,
        booking_date_time TEXT NOT NULL,
        notification_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reporting_statements (
        statement_id TEXT PRIMARY KEY,
        statement_key TEXT NOT NULL UNIQUE,
        instruction_id TEXT NOT NULL,
        account_role TEXT NOT NULL,
        statement_date TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        statement_json TEXT NOT NULL
      );
    `);

    this.insertTravelRuleStmt = this.db.prepare(`
      INSERT INTO travel_rule_records (
        record_id, status, submitted_at, last_updated_at, record_json
      ) VALUES (?, ?, ?, ?, ?)
    `);
    this.updateTravelRuleStmt = this.db.prepare(`
      UPDATE travel_rule_records
      SET status = ?, last_updated_at = ?, record_json = ?
      WHERE record_id = ?
    `);
    this.getTravelRuleStmt = this.db.prepare(`
      SELECT record_json FROM travel_rule_records WHERE record_id = ?
    `);
    this.listTravelRulesStmt = this.db.prepare(`
      SELECT record_json FROM travel_rule_records ORDER BY submitted_at DESC
    `);

    this.insertQuoteStmt = this.db.prepare(`
      INSERT INTO instruction_quotes (
        quote_id, valid_until, created_at, request_json, response_json
      ) VALUES (?, ?, ?, ?, ?)
    `);
    this.getQuoteStmt = this.db.prepare(`
      SELECT response_json FROM instruction_quotes WHERE quote_id = ?
    `);

    this.insertInstructionStmt = this.db.prepare(`
      INSERT INTO instructions (
        instruction_id, status, created_at, updated_at, instruction_json
      ) VALUES (?, ?, ?, ?, ?)
    `);
    this.updateInstructionStmt = this.db.prepare(`
      UPDATE instructions
      SET status = ?, updated_at = ?, instruction_json = ?
      WHERE instruction_id = ?
    `);
    this.getInstructionStmt = this.db.prepare(`
      SELECT instruction_json FROM instructions WHERE instruction_id = ?
    `);
    this.listInstructionsStmt = this.db.prepare(`
      SELECT instruction_json FROM instructions ORDER BY created_at DESC
    `);
    this.insertOutboxEventStmt = this.db.prepare(`
      INSERT INTO event_outbox (
        event_id, event_type, instruction_id, created_at, event_json
      ) VALUES (?, ?, ?, ?, ?)
    `);
    this.getOutboxEventStmt = this.db.prepare(`
      SELECT event_json FROM event_outbox WHERE event_id = ?
    `);
    this.listOutboxEventsStmt = this.db.prepare(`
      SELECT event_json FROM event_outbox ORDER BY created_at DESC, event_id DESC
    `);
    this.insertWebhookSubscriptionStmt = this.db.prepare(`
      INSERT INTO webhook_subscriptions (
        subscription_id, url, active, updated_at, subscription_json
      ) VALUES (?, ?, ?, ?, ?)
    `);
    this.updateWebhookSubscriptionStmt = this.db.prepare(`
      UPDATE webhook_subscriptions
      SET url = ?, active = ?, updated_at = ?, subscription_json = ?
      WHERE subscription_id = ?
    `);
    this.getWebhookSubscriptionStmt = this.db.prepare(`
      SELECT subscription_json FROM webhook_subscriptions WHERE subscription_id = ?
    `);
    this.listWebhookSubscriptionsStmt = this.db.prepare(`
      SELECT subscription_json FROM webhook_subscriptions ORDER BY updated_at DESC, subscription_id DESC
    `);
    this.insertWebhookDeliveryStmt = this.db.prepare(`
      INSERT INTO webhook_deliveries (
        delivery_id, subscription_id, event_id, event_type, instruction_id,
        delivery_state, next_attempt_at, updated_at, delivery_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.updateWebhookDeliveryStmt = this.db.prepare(`
      UPDATE webhook_deliveries
      SET delivery_state = ?, next_attempt_at = ?, updated_at = ?, delivery_json = ?
      WHERE delivery_id = ?
    `);
    this.getWebhookDeliveryStmt = this.db.prepare(`
      SELECT delivery_json FROM webhook_deliveries WHERE delivery_id = ?
    `);
    this.listWebhookDeliveriesStmt = this.db.prepare(`
      SELECT delivery_json FROM webhook_deliveries ORDER BY updated_at DESC, delivery_id DESC
    `);
    this.insertReportingNotificationStmt = this.db.prepare(`
      INSERT INTO reporting_notifications (
        notification_id, instruction_id, booking_date_time, notification_json
      ) VALUES (?, ?, ?, ?)
    `);
    this.getReportingNotificationStmt = this.db.prepare(`
      SELECT notification_json FROM reporting_notifications WHERE notification_id = ?
    `);
    this.listReportingNotificationsStmt = this.db.prepare(`
      SELECT notification_json FROM reporting_notifications ORDER BY booking_date_time DESC, notification_id DESC
    `);
    this.insertReportingStatementStmt = this.db.prepare(`
      INSERT INTO reporting_statements (
        statement_id, statement_key, instruction_id, account_role, statement_date, updated_at, statement_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    this.updateReportingStatementStmt = this.db.prepare(`
      UPDATE reporting_statements
      SET statement_date = ?, updated_at = ?, statement_json = ?
      WHERE statement_key = ?
    `);
    this.getReportingStatementStmt = this.db.prepare(`
      SELECT statement_json FROM reporting_statements WHERE statement_id = ?
    `);
    this.getReportingStatementByKeyStmt = this.db.prepare(`
      SELECT statement_json FROM reporting_statements WHERE statement_key = ?
    `);
    this.listReportingStatementsStmt = this.db.prepare(`
      SELECT statement_json FROM reporting_statements ORDER BY statement_date DESC, updated_at DESC, statement_id DESC
    `);
  }

  close() {
    this.db.close();
  }

  createTravelRuleRecord(submission) {
    const timestamp = nowIso();
    const normalized = normalizeTravelRuleSubmission(submission);

    const record = {
      record_id: randomUUID(),
      submitted_at: timestamp,
      last_updated_at: timestamp,
      submission_timing: normalized.submission_timing,
      status: 'SUBMITTED',
      travel_rule_data: normalized.travel_rule_data,
      submitting_vasp: normalized.submitting_vasp,
      callbacks: [],
      correction_of_callback_ref: normalized.correction_of_callback_ref,
    };

    this.insertTravelRuleStmt.run(
      record.record_id,
      record.status,
      record.submitted_at,
      record.last_updated_at,
      serialize(record),
    );

    return record;
  }

  getTravelRuleRecord(recordId) {
    const row = this.getTravelRuleStmt.get(recordId);
    return row ? parseJson(row.record_json, null) : null;
  }

  updateTravelRuleRecord(recordId, submission) {
    const current = this.getTravelRuleRecord(recordId);
    if (!current) {
      return null;
    }

    const normalized = normalizeTravelRuleSubmission(submission);
    const updated = {
      ...current,
      last_updated_at: nowIso(),
      submission_timing: normalized.submission_timing,
      status: 'SUBMITTED',
      travel_rule_data: normalized.travel_rule_data,
      correction_of_callback_ref: normalized.correction_of_callback_ref,
    };

    this.updateTravelRuleStmt.run(
      updated.status,
      updated.last_updated_at,
      serialize(updated),
      recordId,
    );

    return updated;
  }

  appendTravelRuleCallback(recordId, callbackSubmission) {
    const current = this.getTravelRuleRecord(recordId);
    if (!current) {
      return null;
    }

    if (!TRAVEL_RULE_CALLBACK_STATUSES.has(callbackSubmission.callback_status)) {
      throw new Error('Unsupported callback_status');
    }

    if (current.status === 'ACCEPTED') {
      const error = new Error('ACCEPTED records do not accept superseding callbacks.');
      error.code = 'CONFLICT';
      throw error;
    }

    const callback = {
      callback_status: callbackSubmission.callback_status,
      callback_timestamp: callbackSubmission.callback_timestamp ?? nowIso(),
      description: callbackSubmission.description ?? null,
      review_reason: callbackSubmission.review_reason ?? null,
      receiving_vasp: callbackSubmission.receiving_vasp ?? null,
      receiving_vasp_record_ref:
        callbackSubmission.receiving_vasp_record_ref ?? null,
      rejection_reasons: callbackSubmission.rejection_reasons ?? [],
    };

    const callbackRecordedAt = nowIso();
    const updated = {
      ...current,
      status: callback.callback_status,
      last_updated_at: callbackRecordedAt,
      callbacks: [...(current.callbacks ?? []), callback],
    };

    this.updateTravelRuleStmt.run(
      updated.status,
      updated.last_updated_at,
      serialize(updated),
      recordId,
    );

    return {
      record: updated,
      receipt: buildTravelRuleCallbackReceipt(
        updated,
        current.status,
        callbackRecordedAt,
      ),
    };
  }

  searchTravelRuleRecords(filters = {}) {
    const rows = this.listTravelRulesStmt.all();
    const records = rows.map((row) => parseJson(row.record_json, null)).filter(Boolean);
    const statuses = parseListFilter(filters.status);
    const callbackStatuses = parseListFilter(filters.callback_status);

    return records.filter((record) => {
      if (statuses.length && !statuses.includes(record.status)) {
        return false;
      }

      if (filters.record_id && record.record_id !== filters.record_id) {
        return false;
      }

      const latestCallbackStatus = getTravelRuleLatestCallbackStatus(record);
      if (callbackStatuses.length && !callbackStatuses.includes(latestCallbackStatus)) {
        return false;
      }

      if (
        filters.submission_timing &&
        record.submission_timing !== filters.submission_timing
      ) {
        return false;
      }

      if (
        filters.submitted_from &&
        Date.parse(record.submitted_at) < Date.parse(filters.submitted_from)
      ) {
        return false;
      }

      if (
        filters.submitted_to &&
        Date.parse(record.submitted_at) > Date.parse(filters.submitted_to)
      ) {
        return false;
      }

      if (filters.direction && filters.direction !== 'BOTH' && filters.direction !== getTravelRuleDirection(record)) {
        return false;
      }

      if (
        filters.chain_id &&
        getTravelRulePrimaryChainId(record) !== filters.chain_id
      ) {
        return false;
      }

      const tokenIdentification = getTravelRuleTokenIdentification(record);
      if (
        filters.token_identifier &&
        tokenIdentification?.dti !== filters.token_identifier &&
        tokenIdentification?.isin !== filters.token_identifier &&
        tokenIdentification?.ticker !== filters.token_identifier
      ) {
        return false;
      }

      if (
        filters.counterparty_vasp_lei &&
        buildTravelRuleSummary(record).creditor_vasp_lei !== filters.counterparty_vasp_lei &&
        buildTravelRuleSummary(record).debtor_vasp_lei !== filters.counterparty_vasp_lei
      ) {
        return false;
      }

      if (
        filters.wallet_type &&
        buildTravelRuleSummary(record).debtor_wallet_type !== filters.wallet_type &&
        buildTravelRuleSummary(record).creditor_wallet_type !== filters.wallet_type
      ) {
        return false;
      }

      if (filters.amount_min || filters.amount_max) {
        const amount = Number.parseFloat(getTravelRuleData(record).interbank_settlement_amount?.amount ?? '0');
        if (filters.amount_min && amount < Number.parseFloat(filters.amount_min)) {
          return false;
        }
        if (filters.amount_max && amount > Number.parseFloat(filters.amount_max)) {
          return false;
        }
      }

      return true;
    });
  }

  searchTravelRuleResponse(filters = {}) {
    const pageSize = Number.parseInt(filters.page_size ?? '50', 10) || 50;
    const records = this.searchTravelRuleRecords(filters);
    const offset = decodeCursor(filters.after);
    const page = records.slice(offset, offset + pageSize);
    const nextOffset = offset + page.length;
    return {
      total_matched: records.length,
      page_size: page.length,
      ...(nextOffset < records.length ? { next_cursor: encodeCursor(nextOffset) } : {}),
      query_period: {
        from: filters.submitted_from ?? null,
        to: filters.submitted_to ?? null,
      },
      generated_at: nowIso(),
      records: page.map((record) => buildTravelRuleSummary(record)),
    };
  }

  getTravelRuleStats(filters = {}) {
    const records = this.searchTravelRuleRecords(filters);
    const latestRejectedCount = records.filter(
      (record) => getTravelRuleLatestCallbackStatus(record) === 'REJECTED',
    ).length;
    const pendingCount = records.filter(
      (record) => getTravelRuleLatestCallbackStatus(record) === 'PENDING',
    ).length;
    const unhostedWalletCount = records.filter((record) => {
      const summary = buildTravelRuleSummary(record);
      return (
        summary.debtor_wallet_type === 'UNHOSTED' ||
        summary.creditor_wallet_type === 'UNHOSTED'
      );
    }).length;
    const groupBy = filters.group_by;
    const breakdownMap = new Map();

    if (groupBy) {
      for (const record of records) {
        const breakdownKey = getTravelRuleBreakdownKey(record, groupBy);
        if (!breakdownKey) {
          continue;
        }
        const existing = breakdownMap.get(breakdownKey.value) ?? {
          dimension_value: breakdownKey.value,
          dimension_label: breakdownKey.label,
          records: [],
        };
        existing.records.push(record);
        breakdownMap.set(breakdownKey.value, existing);
      }
    }

    return {
      period: {
        from: filters.submitted_from,
        to: filters.submitted_to,
      },
      direction: filters.direction ?? 'BOTH',
      generated_at: nowIso(),
      totals: {
        record_count: records.length,
        volumes: buildTravelRuleCurrencyVolumeMap(records),
        callback_pending_count: pendingCount,
        rejection_count: latestRejectedCount,
        rejection_rate_pct:
          records.length === 0
            ? 0
            : Number(((latestRejectedCount / records.length) * 100).toFixed(2)),
        unhosted_wallet_count: unhostedWalletCount,
      },
      ...(groupBy
        ? {
            breakdown: Array.from(breakdownMap.values()).map((entry) => {
              const rejectionCount = entry.records.filter(
                (record) => getTravelRuleLatestCallbackStatus(record) === 'REJECTED',
              ).length;
              return {
                dimension_value: entry.dimension_value,
                dimension_label: entry.dimension_label,
                record_count: entry.records.length,
                volumes: buildTravelRuleCurrencyVolumeMap(entry.records),
                rejection_count: rejectionCount,
                rejection_rate_pct:
                  entry.records.length === 0
                    ? 0
                    : Number(((rejectionCount / entry.records.length) * 100).toFixed(2)),
              };
            }),
          }
        : {}),
    };
  }

  createQuote(request) {
    const quote = this.chainAdapter.buildQuoteResponse(request);
    this.insertQuoteStmt.run(
      quote.quote_id,
      quote.valid_until,
      quote.created_at,
      serialize(request),
      serialize(quote),
    );

    return quote;
  }

  getQuote(quoteId) {
    const row = this.getQuoteStmt.get(quoteId);
    return row ? parseJson(row.response_json, null) : null;
  }

  listInstructions() {
    return this.listInstructionsStmt
      .all()
      .map((row) => parseJson(row.instruction_json, null))
      .filter(Boolean)
      .map((record) => this.advanceInstructionLifecycle(record, { persist: true }));
  }

  findInstructionByEndToEndId(endToEndIdentification) {
    return this.listInstructions().find(
      (record) =>
        record.payment_identification?.end_to_end_identification ===
        endToEndIdentification,
    );
  }

  findInstructionByUetr(uetr) {
    return this.listInstructions().find(
      (record) =>
        record.uetr === uetr || record.payment_identification?.uetr === uetr,
    );
  }

  createInstruction(submission) {
    const normalized = normalizeInstructionSubmission(submission);
    const createdAt = nowIso();
    const initialStatus = this.chainAdapter.hasExpired(normalized.expiry_date_time)
      ? 'EXPIRED'
      : 'PENDING';
    const feeEstimate = normalized.payment_identification.quote_id
      ? this.getQuote(normalized.payment_identification.quote_id)?.fee_estimate ??
        this.chainAdapter.buildFeeEstimate({
          amount: normalized.interbank_settlement_amount.amount,
          ramp_type: normalized.blockchain_instruction?.ramp_instruction?.ramp_type,
        })
      : this.chainAdapter.buildFeeEstimate({
          amount: normalized.interbank_settlement_amount.amount,
          ramp_type: normalized.blockchain_instruction?.ramp_instruction?.ramp_type,
        });

    const record = {
      instruction_id: randomUUID(),
      uetr: normalized.payment_identification.uetr,
      status: initialStatus,
      custody_model: normalized.blockchain_instruction.custody_model,
      debit_timing: 'ON_BROADCAST',
      payment_identification: normalized.payment_identification,
      settlement_information: normalized.settlement_information,
      payment_type_information: normalized.payment_type_information,
      debtor: normalized.debtor,
      debtor_account: normalized.debtor_account,
      debtor_agent: normalized.debtor_agent,
      creditor: normalized.creditor,
      creditor_account: normalized.creditor_account,
      creditor_agent: normalized.creditor_agent,
      interbank_settlement_amount: normalized.interbank_settlement_amount,
      instructed_amount: normalized.instructed_amount,
      instruction_for_next_agent: normalized.instruction_for_next_agent,
      purpose: normalized.purpose,
      remittance_information: normalized.remittance_information,
      blockchain_instruction: normalized.blockchain_instruction,
      fee_estimate: feeEstimate,
      on_chain_settlement: this.chainAdapter.normalizeOnChainSettlement(
        null,
        normalized.interbank_settlement_amount.amount,
        normalized,
      ),
      travel_rule_record_id: normalized.travel_rule_record_id,
      created_at: createdAt,
      updated_at: createdAt,
      expiry_date_time: normalized.expiry_date_time,
      failure_reason: initialStatus === 'EXPIRED'
        ? 'Instruction expired before execution.'
        : null,
      status_history: [
        buildInstructionStatusEvent({
          status: initialStatus,
          statusAt: createdAt,
          failureReason:
            initialStatus === 'EXPIRED'
              ? 'Instruction expired before execution.'
              : null,
        }),
      ],
    };

    this.insertInstructionStmt.run(
      record.instruction_id,
      record.status,
      record.created_at,
      record.updated_at,
      serialize(record),
    );
    this.appendInstructionOutboxEvents(record, null);
    this.appendReportingNotifications(record);

    return record;
  }

  toInstructionResponse(record) {
    return buildInstructionResponse(record);
  }

  toExecutionStatusResponse(record) {
    return buildExecutionStatusResponse(record);
  }

  toFinalityReceipt(record) {
    return buildFinalityReceipt(record);
  }

  appendInstructionOutboxEvents(record, previousRecord = null) {
    const events = [];

    if (shouldEmitExecutionStatusEvent(record, previousRecord)) {
      const payload = this.toExecutionStatusResponse(record);
      events.push(
        buildOutboxEvent({
          eventType: 'execution_status.updated',
          payloadSchema: 'execution_status',
          resourcePath: `/execution-status/${record.instruction_id}`,
          createdAt: payload.latest_status_at ?? record.updated_at ?? nowIso(),
          record,
          payload,
        }),
      );
    }

    if (shouldEmitFinalityReceiptEvent(record, previousRecord)) {
      const payload = this.toFinalityReceipt(record);
      events.push(
        buildOutboxEvent({
          eventType: 'finality_receipt.updated',
          payloadSchema: 'finality_receipt',
          resourcePath: `/finality-receipt/${record.instruction_id}`,
          createdAt: payload.observed_at ?? record.updated_at ?? nowIso(),
          record,
          payload,
        }),
      );
    }

    for (const event of events) {
      this.insertOutboxEventStmt.run(
        event.event_id,
        event.event_type,
        event.instruction_id,
        event.created_at,
        serialize(event),
      );
      this.createWebhookDeliveriesForEvent(event);
    }

    return events;
  }

  getOutboxEvent(eventId) {
    const row = this.getOutboxEventStmt.get(eventId);
    return row ? parseJson(row.event_json, null) : null;
  }

  listOutboxEvents(filters = {}) {
    const pageSize = Number.parseInt(filters.page_size ?? '50', 10) || 50;
    const offset = decodeCursor(filters.cursor);
    const eventTypes = parseListFilter(filters.event_type);
    const events = this.listOutboxEventsStmt
      .all()
      .map((row) => parseJson(row.event_json, null))
      .filter(Boolean)
      .filter((event) => {
        if (filters.instruction_id && event.instruction_id !== filters.instruction_id) {
          return false;
        }
        if (filters.uetr && event.uetr !== filters.uetr) {
          return false;
        }
        if (eventTypes.length && !eventTypes.includes(event.event_type)) {
          return false;
        }
        if (filters.from && Date.parse(event.created_at) < Date.parse(filters.from)) {
          return false;
        }
        if (filters.to && Date.parse(event.created_at) > Date.parse(filters.to)) {
          return false;
        }
        return true;
      });
    const page = events.slice(offset, offset + pageSize);
    const nextOffset = offset + page.length;

    return {
      total_matched: events.length,
      page_size: page.length,
      ...(nextOffset < events.length ? { next_cursor: encodeCursor(nextOffset) } : { next_cursor: null }),
      generated_at: nowIso(),
      events: page,
    };
  }

  createWebhookSubscription(submission) {
    const record = buildWebhookSubscriptionRecord(submission);
    this.insertWebhookSubscriptionStmt.run(
      record.subscription_id,
      record.url,
      record.active ? 1 : 0,
      record.updated_at,
      serialize(record),
    );

    return buildWebhookSubscriptionResponse(record, { includeSecret: true });
  }

  getWebhookSubscriptionRecord(subscriptionId) {
    const row = this.getWebhookSubscriptionStmt.get(subscriptionId);
    return row ? parseJson(row.subscription_json, null) : null;
  }

  getWebhookSubscription(subscriptionId) {
    const record = this.getWebhookSubscriptionRecord(subscriptionId);
    return record ? buildWebhookSubscriptionResponse(record) : null;
  }

  listWebhookSubscriptionRecords() {
    return this.listWebhookSubscriptionsStmt
      .all()
      .map((row) => parseJson(row.subscription_json, null))
      .filter(Boolean);
  }

  listWebhookSubscriptions() {
    return {
      total_matched: this.listWebhookSubscriptionRecords().length,
      generated_at: nowIso(),
      subscriptions: this.listWebhookSubscriptionRecords().map((record) =>
        buildWebhookSubscriptionResponse(record),
      ),
    };
  }

  createWebhookDeliveriesForEvent(event) {
    const subscriptions = this.listWebhookSubscriptionRecords().filter(
      (subscription) =>
        subscription.active &&
        subscription.subscribed_event_types.includes(event.event_type),
    );

    const deliveries = [];
    for (const subscription of subscriptions) {
      const delivery = buildWebhookDeliveryRecord(event, subscription);
      this.insertWebhookDeliveryStmt.run(
        delivery.delivery_id,
        delivery.subscription_id,
        delivery.event_id,
        delivery.event_type,
        delivery.instruction_id,
        delivery.delivery_state,
        delivery.next_attempt_at,
        delivery.updated_at,
        serialize(delivery),
      );
      deliveries.push(delivery);
    }

    return deliveries;
  }

  getWebhookDelivery(deliveryId) {
    const row = this.getWebhookDeliveryStmt.get(deliveryId);
    return row ? parseJson(row.delivery_json, null) : null;
  }

  listWebhookDeliveries(filters = {}) {
    const pageSize = Number.parseInt(filters.page_size ?? '50', 10) || 50;
    const offset = decodeCursor(filters.cursor);
    const eventTypes = parseListFilter(filters.event_type);
    const deliveryStates = parseListFilter(filters.delivery_state);
    const deliveries = this.listWebhookDeliveriesStmt
      .all()
      .map((row) => parseJson(row.delivery_json, null))
      .filter(Boolean)
      .filter((delivery) => {
        if (
          filters.subscription_id &&
          delivery.subscription_id !== filters.subscription_id
        ) {
          return false;
        }
        if (filters.instruction_id && delivery.instruction_id !== filters.instruction_id) {
          return false;
        }
        if (filters.uetr && delivery.uetr !== filters.uetr) {
          return false;
        }
        if (eventTypes.length && !eventTypes.includes(delivery.event_type)) {
          return false;
        }
        if (deliveryStates.length && !deliveryStates.includes(delivery.delivery_state)) {
          return false;
        }
        return true;
      });
    const page = deliveries.slice(offset, offset + pageSize);
    const nextOffset = offset + page.length;

    return {
      total_matched: deliveries.length,
      page_size: page.length,
      ...(nextOffset < deliveries.length ? { next_cursor: encodeCursor(nextOffset) } : { next_cursor: null }),
      generated_at: nowIso(),
      deliveries: page,
    };
  }

  async dispatchPendingWebhookDeliveries({
    sender,
    limit = 50,
    subscriptionId = null,
  } = {}) {
    const dueNow = nowIso();
    const candidates = this.listWebhookDeliveriesStmt
      .all()
      .map((row) => parseJson(row.delivery_json, null))
      .filter(Boolean)
      .filter((delivery) => {
        if (subscriptionId && delivery.subscription_id !== subscriptionId) {
          return false;
        }
        if (WEBHOOK_DELIVERY_TERMINAL_STATES.has(delivery.delivery_state)) {
          return false;
        }
        return Date.parse(delivery.next_attempt_at) <= Date.parse(dueNow);
      })
      .slice(0, limit);

    const results = [];
    for (const delivery of candidates) {
      const subscription = this.getWebhookSubscriptionRecord(delivery.subscription_id);
      const event = this.getOutboxEvent(delivery.event_id);

      if (!subscription || !subscription.active || !event) {
        const skipped = {
          ...delivery,
          delivery_state: 'FAILED',
          last_error: 'Subscription inactive or event missing.',
          updated_at: nowIso(),
          next_attempt_at: delivery.next_attempt_at,
        };
        this.updateWebhookDeliveryStmt.run(
          skipped.delivery_state,
          skipped.next_attempt_at,
          skipped.updated_at,
          serialize(skipped),
          skipped.delivery_id,
        );
        results.push(skipped);
        continue;
      }

      const attemptAt = nowIso();
      const envelope = buildWebhookEnvelope(event, delivery);
      const body = serialize(envelope);
      const timestamp = String(Math.floor(Date.parse(attemptAt) / 1000));
      const signature = buildWebhookSignature(subscription.signing_secret, timestamp, body);

      try {
        const response = await sender({
          url: subscription.url,
          headers: {
            'content-type': 'application/json',
            'x-pacscrypto-event-id': event.event_id,
            'x-pacscrypto-delivery-id': delivery.delivery_id,
            'x-pacscrypto-event-type': event.event_type,
            'x-pacscrypto-signature': signature,
            'x-pacscrypto-signature-timestamp': timestamp,
          },
          body,
        });
        const attemptCount = delivery.attempt_count + 1;
        const delivered = response.status >= 200 && response.status < 300;
        const updated = {
          ...delivery,
          attempt_count: attemptCount,
          delivery_state: delivered
            ? 'DELIVERED'
            : attemptCount >= subscription.max_attempts
              ? 'FAILED'
              : 'RETRYING',
          last_attempt_at: attemptAt,
          next_attempt_at: delivered
            ? attemptAt
            : attemptCount >= subscription.max_attempts
              ? attemptAt
              : buildNextAttemptAt(
                  attemptAt,
                  attemptCount,
                  this.webhookRetryScheduleMs,
                ),
          response_status: response.status,
          response_body_excerpt: response.bodyText?.slice(0, 500) ?? null,
          last_error: delivered ? null : `Endpoint returned HTTP ${response.status}.`,
          last_signature: signature,
          updated_at: attemptAt,
        };

        this.updateWebhookDeliveryStmt.run(
          updated.delivery_state,
          updated.next_attempt_at,
          updated.updated_at,
          serialize(updated),
          updated.delivery_id,
        );

        if (delivered) {
          const subscriptionUpdated = {
            ...subscription,
            last_delivery_at: attemptAt,
            updated_at: attemptAt,
          };
          this.updateWebhookSubscriptionStmt.run(
            subscriptionUpdated.url,
            subscriptionUpdated.active ? 1 : 0,
            subscriptionUpdated.updated_at,
            serialize(subscriptionUpdated),
            subscriptionUpdated.subscription_id,
          );
        }

        results.push(updated);
      } catch (error) {
        const attemptCount = delivery.attempt_count + 1;
        const updated = {
          ...delivery,
          attempt_count: attemptCount,
          delivery_state:
            attemptCount >= subscription.max_attempts ? 'FAILED' : 'RETRYING',
          last_attempt_at: attemptAt,
          next_attempt_at:
            attemptCount >= subscription.max_attempts
              ? attemptAt
              : buildNextAttemptAt(
                  attemptAt,
                  attemptCount,
                  this.webhookRetryScheduleMs,
                ),
          response_status: null,
          response_body_excerpt: null,
          last_error: error.message,
          last_signature: signature,
          updated_at: attemptAt,
        };
        this.updateWebhookDeliveryStmt.run(
          updated.delivery_state,
          updated.next_attempt_at,
          updated.updated_at,
          serialize(updated),
          updated.delivery_id,
        );
        results.push(updated);
      }
    }

    return {
      dispatched_count: results.length,
      generated_at: nowIso(),
      deliveries: results,
    };
  }

  getReportingNotification(notificationId) {
    const row = this.getReportingNotificationStmt.get(notificationId);
    return row ? parseJson(row.notification_json, null) : null;
  }

  listReportingNotificationRecords() {
    return this.listReportingNotificationsStmt
      .all()
      .map((row) => parseJson(row.notification_json, null))
      .filter(Boolean);
  }

  listReportingNotificationsForInstruction(instructionId) {
    return this.listReportingNotificationRecords().filter(
      (record) => record.instruction_id === instructionId,
    );
  }

  appendReportingNotificationOutboxEvents(notifications) {
    const events = [];
    for (const notification of notifications) {
      const event = buildOutboxEvent({
        eventType: 'reporting_notification.created',
        payloadSchema: 'reporting_notification',
        resourcePath: `/reporting/notifications/${notification.notification_id}`,
        createdAt: notification.created_at,
        instructionId: notification.instruction_id,
        uetr: notification.uetr,
        payload: notification,
      });
      this.insertOutboxEventStmt.run(
        event.event_id,
        event.event_type,
        event.instruction_id,
        event.created_at,
        serialize(event),
      );
      this.createWebhookDeliveriesForEvent(event);
      events.push(event);
    }

    return events;
  }

  appendReportingNotifications(record) {
    const existing = this.listReportingNotificationsForInstruction(record.instruction_id);
    const hasDebtorDebit = existing.some(
      (notification) =>
        notification.account_role === 'DEBTOR' &&
        notification.entry_type === 'DEBIT',
    );
    const hasCreditorCredit = existing.some(
      (notification) =>
        notification.account_role === 'CREDITOR' &&
        notification.entry_type === 'CREDIT',
    );
    const created = [];
    const debitTriggerStatus = getDebitNotificationTriggerStatus(record.debit_timing);

    if (!hasDebtorDebit && hasInstructionReachedStatus(record, debitTriggerStatus)) {
      const notification = buildReportingNotificationRecord(
        record,
        'DEBTOR_DEBIT',
        this.chainAdapter,
      );
      this.insertReportingNotificationStmt.run(
        notification.notification_id,
        notification.instruction_id,
        notification.booking_date_time,
        serialize(notification),
      );
      created.push(notification);
    }

    if (!hasCreditorCredit && record.status === 'FINAL') {
      const notification = buildReportingNotificationRecord(
        record,
        'CREDITOR_CREDIT',
        this.chainAdapter,
      );
      this.insertReportingNotificationStmt.run(
        notification.notification_id,
        notification.instruction_id,
        notification.booking_date_time,
        serialize(notification),
      );
      created.push(notification);
    }

    this.appendReportingNotificationOutboxEvents(created);
    this.refreshReportingStatements(record);
    return created;
  }

  refreshReportingStatements(record) {
    const notifications = this.listReportingNotificationsForInstruction(record.instruction_id);
    const notificationGroups = new Map();

    for (const notification of notifications) {
      const key = notification.account_role;
      const existing = notificationGroups.get(key) ?? [];
      existing.push(notification);
      notificationGroups.set(key, existing);
    }

    for (const [accountRole, groupedNotifications] of notificationGroups.entries()) {
      const statement = buildReportingStatementRecord(
        record,
        groupedNotifications,
        accountRole,
      );
      if (!statement) {
        continue;
      }

      const existing = this.getReportingStatementByKey(statement.statement_key);
      const persistedStatement = existing
        ? {
            ...statement,
            statement_id: existing.statement_id,
            created_at: existing.created_at ?? statement.created_at,
          }
        : statement;

      if (existing) {
        this.updateReportingStatementStmt.run(
          persistedStatement.statement_date,
          persistedStatement.updated_at,
          serialize(persistedStatement),
          persistedStatement.statement_key,
        );
      } else {
        this.insertReportingStatementStmt.run(
          persistedStatement.statement_id,
          persistedStatement.statement_key,
          persistedStatement.instruction_id,
          persistedStatement.account_role,
          persistedStatement.statement_date,
          persistedStatement.updated_at,
          serialize(persistedStatement),
        );
      }
    }
  }

  filterReportingNotificationRecords(filters = {}) {
    const entryTypes = parseListFilter(filters.entry_type);
    const accountRoles = parseListFilter(filters.account_role);
    return this.listReportingNotificationRecords().filter((record) => {
      if (filters.instruction_id && record.instruction_id !== filters.instruction_id) {
        return false;
      }
      if (filters.uetr && record.uetr !== filters.uetr) {
        return false;
      }
      if (entryTypes.length && !entryTypes.includes(record.entry_type)) {
        return false;
      }
      if (accountRoles.length && !accountRoles.includes(record.account_role)) {
        return false;
      }
      if (filters.chain_dli && record.chain_dli !== filters.chain_dli) {
        return false;
      }
      if (
        filters.token_dti &&
        record.token?.token_dti !== filters.token_dti
      ) {
        return false;
      }
      if (
        filters.wallet_address &&
        record.party?.wallet_address !== filters.wallet_address
      ) {
        return false;
      }
      if (
        filters.booked_from &&
        Date.parse(record.booking_date_time) < Date.parse(filters.booked_from)
      ) {
        return false;
      }
      if (
        filters.booked_to &&
        Date.parse(record.booking_date_time) > Date.parse(filters.booked_to)
      ) {
        return false;
      }
      return true;
    });
  }

  listReportingNotifications(filters = {}) {
    const pageSize = Number.parseInt(filters.page_size ?? '50', 10) || 50;
    const offset = decodeCursor(filters.cursor);
    const records = this.filterReportingNotificationRecords(filters);
    const page = records.slice(offset, offset + pageSize);
    const nextOffset = offset + page.length;

    return {
      total_matched: records.length,
      page_size: page.length,
      ...(nextOffset < records.length ? { next_cursor: encodeCursor(nextOffset) } : { next_cursor: null }),
      generated_at: nowIso(),
      notifications: page.map((record) => buildReportingNotificationSummary(record)),
    };
  }

  getReportingStatement(statementId) {
    const row = this.getReportingStatementStmt.get(statementId);
    return row ? parseJson(row.statement_json, null) : null;
  }

  getReportingStatementByKey(statementKey) {
    const row = this.getReportingStatementByKeyStmt.get(statementKey);
    return row ? parseJson(row.statement_json, null) : null;
  }

  listReportingStatementRecords() {
    return this.listReportingStatementsStmt
      .all()
      .map((row) => parseJson(row.statement_json, null))
      .filter(Boolean);
  }

  filterReportingStatementRecords(filters = {}) {
    const accountRoles = parseListFilter(filters.account_role);
    return this.listReportingStatementRecords().filter((record) => {
      if (filters.instruction_id && record.instruction_id !== filters.instruction_id) {
        return false;
      }
      if (filters.uetr && record.uetr !== filters.uetr) {
        return false;
      }
      if (accountRoles.length && !accountRoles.includes(record.account_role)) {
        return false;
      }
      if (filters.wallet_address && record.party?.wallet_address !== filters.wallet_address) {
        return false;
      }
      if (filters.chain_dli && record.chain_dli !== filters.chain_dli) {
        return false;
      }
      if (
        filters.token_dti &&
        record.token?.token_dti !== filters.token_dti
      ) {
        return false;
      }
      if (
        filters.statement_date_from &&
        record.statement_date < filters.statement_date_from
      ) {
        return false;
      }
      if (
        filters.statement_date_to &&
        record.statement_date > filters.statement_date_to
      ) {
        return false;
      }
      if (
        filters.booked_from &&
        record.period?.to &&
        Date.parse(record.period.to) < Date.parse(filters.booked_from)
      ) {
        return false;
      }
      if (
        filters.booked_to &&
        record.period?.from &&
        Date.parse(record.period.from) > Date.parse(filters.booked_to)
      ) {
        return false;
      }
      return true;
    });
  }

  listReportingStatements(filters = {}) {
    const pageSize = Number.parseInt(filters.page_size ?? '50', 10) || 50;
    const offset = decodeCursor(filters.cursor);
    const records = this.filterReportingStatementRecords(filters);
    const page = records.slice(offset, offset + pageSize);
    const nextOffset = offset + page.length;

    return {
      total_matched: records.length,
      page_size: page.length,
      ...(nextOffset < records.length ? { next_cursor: encodeCursor(nextOffset) } : { next_cursor: null }),
      generated_at: nowIso(),
      statements: page.map((record) => buildReportingStatementSummary(record)),
    };
  }

  getIntradayReportingView(filters = {}) {
    const records = this.filterReportingNotificationRecords(filters);
    const debitRecords = records.filter((record) => record.entry_type === 'DEBIT');
    const creditRecords = records.filter((record) => record.entry_type === 'CREDIT');

    return {
      period: {
        from: filters.booked_from ?? null,
        to: filters.booked_to ?? null,
      },
      filters_applied: {
        instruction_id: filters.instruction_id ?? null,
        uetr: filters.uetr ?? null,
        account_role: filters.account_role ?? null,
        wallet_address: filters.wallet_address ?? null,
        chain_dli: filters.chain_dli ?? null,
        token_dti: filters.token_dti ?? null,
      },
      generated_at: nowIso(),
      movement_summary: {
        notification_count: records.length,
        debit_count: debitRecords.length,
        credit_count: creditRecords.length,
        totals: buildReportingMovementTotals(records),
      },
      account_views: buildIntradayAccountViews(records),
      notifications: records.map((record) => buildReportingNotificationSummary(record)),
    };
  }

  saveInstruction(record, {
    previousRecord = null,
    emitEvents = false,
    emitNotifications = false,
  } = {}) {
    this.updateInstructionStmt.run(
      record.status,
      record.updated_at,
      serialize(record),
      record.instruction_id,
    );
    if (emitEvents) {
      this.appendInstructionOutboxEvents(record, previousRecord);
    }
    if (emitNotifications) {
      this.appendReportingNotifications(record);
    }
    return record;
  }

  getInstruction(instructionId) {
    const row = this.getInstructionStmt.get(instructionId);
    if (!row) {
      return null;
    }

    const current = parseJson(row.instruction_json, null);
    if (!current) {
      return null;
    }

    return this.advanceInstructionLifecycle(current, { persist: true });
  }

  cancelInstruction(instructionId) {
    const current = this.getInstruction(instructionId);
    if (!current) {
      return null;
    }

    if (!['PENDING', 'QUOTED'].includes(current.status)) {
      return { error: 'too_late', current };
    }

    const cancelledAt = nowIso();
    const updated = {
      ...current,
      status: 'CANCELLED',
      updated_at: cancelledAt,
      failure_reason: null,
      status_history: appendInstructionStatusEvent(
        current,
        'CANCELLED',
        cancelledAt,
      ),
      on_chain_settlement: {
        ...this.chainAdapter.normalizeOnChainSettlement(
          current.on_chain_settlement,
          current.interbank_settlement_amount?.amount,
          current,
        ),
        transaction_hash: null,
        confirmation_depth: null,
        finality_status: null,
        block_number: null,
        block_timestamp: null,
      },
    };

    this.saveInstruction(updated, {
      previousRecord: current,
      emitEvents: true,
      emitNotifications: true,
    });

    return {
      record: updated,
      cancellation: buildCancellationResponse(updated, cancelledAt),
    };
  }

  searchInstructions(filters = {}) {
    const pageSize = Number.parseInt(filters.page_size ?? '50', 10) || 50;
    const statuses = parseListFilter(filters.status);
    const offset = decodeCursor(filters.cursor);
    const instructions = this.listInstructions().filter((record) => {
      if (statuses.length && !statuses.includes(record.status)) {
        return false;
      }

      if (
        filters.chain_dli &&
        record.blockchain_instruction?.chain_dli !== filters.chain_dli
      ) {
        return false;
      }

      if (
        filters.token_dti &&
        record.blockchain_instruction?.token?.token_dti !== filters.token_dti
      ) {
        return false;
      }

      if (filters.from && Date.parse(record.created_at) < Date.parse(filters.from)) {
        return false;
      }

      if (filters.to && Date.parse(record.created_at) > Date.parse(filters.to)) {
        return false;
      }

      return true;
    });
    const page = instructions.slice(offset, offset + pageSize);
    const nextOffset = offset + page.length;

    return {
      total_matched: instructions.length,
      page_size: page.length,
      ...(nextOffset < instructions.length ? { next_cursor: encodeCursor(nextOffset) } : { next_cursor: null }),
      generated_at: nowIso(),
      instructions: page.map((record) => buildInstructionSearchSummary(record)),
    };
  }

  advanceInstructionLifecycle(record, { persist = false } = {}) {
    const normalized = {
      ...record,
      on_chain_settlement: this.chainAdapter.normalizeOnChainSettlement(
        record.on_chain_settlement,
        record.interbank_settlement_amount?.amount,
        record,
      ),
      status_history: normalizeInstructionStatusHistory(record.status_history, record),
    };

    if (!['PENDING', 'BROADCAST', 'CONFIRMING'].includes(normalized.status)) {
      if (persist && serialize(normalized) !== serialize(record)) {
        this.saveInstruction(normalized, {
          previousRecord: record,
          emitEvents: true,
          emitNotifications: true,
        });
      }
      return normalized;
    }

    const lifecycleState = this.chainAdapter.deriveLifecycleState(normalized);
    const status = lifecycleState.status;
    const failureReason = lifecycleState.failureReason;

    const updatedAt =
      status === normalized.status
        ? normalized.updated_at
        : new Date().toISOString();

    const updated = {
      ...normalized,
      status,
      updated_at: updatedAt,
      failure_reason: failureReason,
      status_history:
        status === normalized.status
          ? normalized.status_history
          : appendInstructionStatusEvent(
              normalized,
              status,
              updatedAt,
              failureReason,
            ),
      on_chain_settlement: {
        ...lifecycleState.onChainSettlement,
      },
    };

    if (persist && serialize(updated) !== serialize(record)) {
      this.saveInstruction(updated, {
        previousRecord: record,
        emitEvents: true,
        emitNotifications: true,
      });
    }

    return updated;
  }
}
