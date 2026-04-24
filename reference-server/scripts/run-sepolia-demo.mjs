import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(moduleDir, '..');
const DEFAULT_BASE_URL = 'http://127.0.0.1:5050';
const DEFAULT_OUTPUT_DIR = resolve(projectRoot, 'data', 'demo-runs');
const DEFAULT_AMOUNT = '1.00';
const DEFAULT_POLL_INTERVAL_MS = 10_000;
const DEFAULT_TIMEOUT_MS = 300_000;
const CHAIN_DLI = 'X9J9XDMTD';
const TOKEN_DTI = '4H95J0R2X';

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeHex(value) {
  if (!hasText(value)) {
    return null;
  }

  const normalized = value.trim();
  return normalized.startsWith('0x') ? normalized : `0x${normalized}`;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function requireEnv(name, fallback = null) {
  const value = process.env[name] ?? fallback;
  if (!hasText(value)) {
    throw new Error(`${name} must be set.`);
  }

  return value.trim();
}

function buildBaseUrl(value) {
  return value.endsWith('/') ? value : `${value}/`;
}

function buildRunId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function buildExplorerUrl(transactionHash) {
  return transactionHash
    ? `https://sepolia.etherscan.io/tx/${transactionHash}`
    : null;
}

function sleep(ms) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}

async function writeJson(targetPath, value) {
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function requestJson(baseUrl, path, { method = 'GET', payload } = {}) {
  const response = await fetch(new URL(path.replace(/^\//, ''), baseUrl), {
    method,
    headers: payload ? { 'content-type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw_body: text };
    }
  }
  return {
    status: response.status,
    json,
  };
}

function assertOk(response, context) {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `${context} failed with HTTP ${response.status}: ${
        response.json?.message ?? response.json?.error ?? JSON.stringify(response.json)
      }`,
    );
  }
}

function buildTravelRuleSubmission({
  amount,
  debtorWallet,
  recipientWallet,
  runId,
}) {
  return {
    submission_timing: 'PRE_TX',
    travel_rule_data: {
      payment_identification: {
        end_to_end_identification: `E2E-SEPOLIA-${runId}`,
      },
      interbank_settlement_amount: {
        amount,
        currency: 'USD',
      },
      charge_bearer: 'SHAR',
      debtor: {
        name: 'Acme Trading GmbH',
        postal_address: {
          country: 'DE',
        },
      },
      debtor_account: {
        proxy: {
          identification: debtorWallet,
        },
      },
      debtor_agent: {
        name: 'Bankhaus Example AG',
        lei: '7245007VX57GR4IUVZ79',
      },
      creditor: {
        name: 'Bravo Supplies B.V.',
        postal_address: {
          country: 'NL',
        },
      },
      creditor_account: {
        proxy: {
          identification: recipientWallet,
        },
      },
      creditor_agent: {
        name: 'Kraken Belgium BVBA',
        lei: '635400DUFB71VFOHVB49',
      },
      counterparty_wallet_type: 'HOSTED',
      blockchain_settlement: {
        primary_chain_id: `DLID/${CHAIN_DLI}`,
        legs: [{ leg_type: 'ORIGINATION' }],
      },
    },
  };
}

function buildTravelRuleCallback() {
  return {
    callback_status: 'ACCEPTED',
    receiving_vasp: {
      name: 'Kraken Belgium BVBA',
      lei: '635400DUFB71VFOHVB49',
    },
    callback_timestamp: new Date().toISOString(),
    description: 'Structured Travel Rule payload accepted for testnet execution.',
  };
}

function buildQuoteRequest(amount) {
  return {
    token: {
      token_symbol: 'USDC',
      token_dti: TOKEN_DTI,
    },
    chain_dli: CHAIN_DLI,
    amount,
    currency: 'USD',
    custody_model: 'FULL_CUSTODY',
  };
}

function buildInstructionPayload({
  amount,
  debtorWallet,
  recipientWallet,
  quoteId,
  travelRuleRecordId,
  runId,
}) {
  return {
    payment_identification: {
      end_to_end_identification: `INV-SEPOLIA-${runId}`,
      quote_id: quoteId,
    },
    charge_bearer: 'DEBT',
    debtor: {
      name: 'Acme Trading GmbH',
      lei: '529900T8BM49AURSDO55',
    },
    debtor_account: {
      proxy: {
        identification: debtorWallet,
      },
    },
    debtor_agent: {
      name: 'Bankhaus Example AG',
      lei: '7245007VX57GR4IUVZ79',
    },
    creditor: {
      name: 'Bravo Supplies B.V.',
      lei: '724500QHKL6MVSQQ1Z17',
    },
    creditor_account: {
      proxy: {
        identification: recipientWallet,
      },
    },
    creditor_agent: {
      name: 'Kraken Belgium BVBA',
      lei: '635400DUFB71VFOHVB49',
    },
    interbank_settlement_amount: {
      amount,
      currency: 'USD',
    },
    remittance_information: {
      unstructured: `Sepolia reviewer demo ${runId}`,
    },
    blockchain_instruction: {
      token: {
        token_symbol: 'USDC',
        token_dti: TOKEN_DTI,
      },
      chain_dli: CHAIN_DLI,
      custody_model: 'FULL_CUSTODY',
    },
    travel_rule_record_id: travelRuleRecordId,
  };
}

async function collectArtifacts({
  baseUrl,
  instructionId,
  debtorWallet,
  startedAt,
}) {
  const [instructionDetail, finalityReceipt, notifications, statements, reportSearch, reportStats] =
    await Promise.all([
      requestJson(baseUrl, `/instruction/${instructionId}`),
      requestJson(baseUrl, `/finality-receipt/${instructionId}`),
      requestJson(baseUrl, `/reporting/notifications?instruction_id=${instructionId}`),
      requestJson(baseUrl, `/reporting/statements?instruction_id=${instructionId}`),
      requestJson(
        baseUrl,
        `/report/search?wallet_address=${encodeURIComponent(
          debtorWallet,
        )}&chain_dli=${CHAIN_DLI}&instruction_id=${instructionId}`,
      ),
      requestJson(
        baseUrl,
        `/report/stats?wallet_address=${encodeURIComponent(
          debtorWallet,
        )}&chain_dli=${CHAIN_DLI}&from_date_time=${encodeURIComponent(
          startedAt,
        )}&to_date_time=${encodeURIComponent(new Date().toISOString())}&group_by=credit_debit`,
      ),
    ]);

  const notificationId = notifications.json?.notifications?.[0]?.notification_id ?? null;
  const statementId = statements.json?.statements?.[0]?.statement_id ?? null;
  const notificationDetail = notificationId
    ? await requestJson(baseUrl, `/report/notification/${notificationId}`)
    : null;
  const statementDetail = statementId
    ? await requestJson(baseUrl, `/reporting/statements/${statementId}`)
    : null;

  return {
    instruction_detail: instructionDetail,
    finality_receipt: finalityReceipt,
    reporting_notifications: notifications,
    reporting_notification_detail: notificationDetail,
    reporting_statements: statements,
    reporting_statement_detail: statementDetail,
    report_search: reportSearch,
    report_stats: reportStats,
  };
}

async function main() {
  const baseUrl = buildBaseUrl(
    process.env.REF_SERVER_DEMO_BASE_URL ?? DEFAULT_BASE_URL,
  );
  const runId = process.env.REF_SERVER_DEMO_LABEL ?? buildRunId();
  const amount = process.env.REF_SERVER_DEMO_AMOUNT ?? DEFAULT_AMOUNT;
  const debtorWallet = normalizeHex(
    requireEnv(
      'REF_SERVER_DEMO_DEBTOR_WALLET',
      process.env.REF_SERVER_SEPOLIA_SOURCE_ADDRESS,
    ),
  );
  const recipientWallet = normalizeHex(
    requireEnv('REF_SERVER_DEMO_RECIPIENT_WALLET'),
  );
  const sendTravelRuleCallback = parseBoolean(
    process.env.REF_SERVER_DEMO_SEND_TRAVEL_RULE_CALLBACK,
    true,
  );
  const pollIntervalMs = parsePositiveInteger(
    process.env.REF_SERVER_DEMO_POLL_INTERVAL_MS,
    DEFAULT_POLL_INTERVAL_MS,
  );
  const timeoutMs = parsePositiveInteger(
    process.env.REF_SERVER_DEMO_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  );
  const outputRoot = resolve(
    process.env.REF_SERVER_DEMO_OUTPUT_DIR ?? DEFAULT_OUTPUT_DIR,
    runId,
  );
  const startedAt = new Date().toISOString();

  await mkdir(outputRoot, { recursive: true });

  const health = await requestJson(baseUrl, '/health');
  assertOk(health, 'Health check');
  await writeJson(resolve(outputRoot, '01-health.response.json'), health.json);

  const quoteRequest = buildQuoteRequest(amount);
  await writeJson(resolve(outputRoot, '02-instruction-quote.request.json'), quoteRequest);
  const quoteResponse = await requestJson(baseUrl, '/instruction/quote', {
    method: 'POST',
    payload: quoteRequest,
  });
  assertOk(quoteResponse, 'Instruction quote');
  await writeJson(
    resolve(outputRoot, '03-instruction-quote.response.json'),
    quoteResponse.json,
  );

  const adapterMetadata = quoteResponse.json?.adapter_metadata ?? {};
  if (adapterMetadata.adapter_id !== 'sepolia-usdc') {
    throw new Error(
      `Server is running adapter ${adapterMetadata.adapter_id ?? 'unknown'}, expected sepolia-usdc.`,
    );
  }
  if (adapterMetadata.adapter_mode !== 'TESTNET_BROADCAST') {
    throw new Error(
      `Server adapter mode is ${adapterMetadata.adapter_mode ?? 'unknown'}, expected TESTNET_BROADCAST.`,
    );
  }

  const travelRuleSubmission = buildTravelRuleSubmission({
    amount,
    debtorWallet,
    recipientWallet,
    runId,
  });
  await writeJson(
    resolve(outputRoot, '04-travel-rule-submit.request.json'),
    travelRuleSubmission,
  );
  const travelRuleResponse = await requestJson(baseUrl, '/travel-rule', {
    method: 'POST',
    payload: travelRuleSubmission,
  });
  assertOk(travelRuleResponse, 'Travel Rule submission');
  await writeJson(
    resolve(outputRoot, '05-travel-rule-submit.response.json'),
    travelRuleResponse.json,
  );

  let travelRuleCallbackResponse = null;
  if (sendTravelRuleCallback) {
    const callbackPayload = buildTravelRuleCallback();
    await writeJson(
      resolve(outputRoot, '06-travel-rule-callback.request.json'),
      callbackPayload,
    );
    travelRuleCallbackResponse = await requestJson(
      baseUrl,
      `/travel-rule/${travelRuleResponse.json.record_id}/callback`,
      {
        method: 'POST',
        payload: callbackPayload,
      },
    );
    assertOk(travelRuleCallbackResponse, 'Travel Rule callback');
    await writeJson(
      resolve(outputRoot, '07-travel-rule-callback.response.json'),
      travelRuleCallbackResponse.json,
    );
  }

  const instructionPayload = buildInstructionPayload({
    amount,
    debtorWallet,
    recipientWallet,
    quoteId: quoteResponse.json.quote_id,
    travelRuleRecordId: travelRuleResponse.json.record_id,
    runId,
  });
  await writeJson(
    resolve(outputRoot, '08-instruction-submit.request.json'),
    instructionPayload,
  );
  const instructionResponse = await requestJson(baseUrl, '/instruction', {
    method: 'POST',
    payload: instructionPayload,
  });
  assertOk(instructionResponse, 'Instruction submission');
  await writeJson(
    resolve(outputRoot, '09-instruction-submit.response.json'),
    instructionResponse.json,
  );

  const instructionId = instructionResponse.json.instruction_id;
  const pollEvents = [];
  const deadline = Date.now() + timeoutMs;
  let finalExecutionStatus = null;
  while (Date.now() < deadline) {
    const executionStatus = await requestJson(
      baseUrl,
      `/execution-status/${instructionId}`,
    );
    assertOk(executionStatus, 'Execution status');
    pollEvents.push({
      observed_at: new Date().toISOString(),
      payload: executionStatus.json,
    });

    if (
      ['FINAL', 'FAILED', 'CANCELLED', 'EXPIRED', 'SLIPPAGE_EXCEEDED', 'RAMP_FAILED'].includes(
        executionStatus.json.status,
      )
    ) {
      finalExecutionStatus = executionStatus.json;
      break;
    }

    await sleep(pollIntervalMs);
  }

  if (!finalExecutionStatus) {
    throw new Error(
      `Timed out waiting for terminal status after ${timeoutMs}ms.`,
    );
  }

  await writeJson(
    resolve(outputRoot, '10-execution-status.polls.json'),
    pollEvents,
  );
  await writeJson(
    resolve(outputRoot, '11-execution-status.final.response.json'),
    finalExecutionStatus,
  );

  const artifacts = await collectArtifacts({
    baseUrl,
    instructionId,
    debtorWallet,
    startedAt,
  });

  assertOk(artifacts.instruction_detail, 'Instruction detail');
  assertOk(artifacts.finality_receipt, 'Finality receipt');
  assertOk(artifacts.reporting_notifications, 'Reporting notifications');
  assertOk(artifacts.reporting_statements, 'Reporting statements');
  assertOk(artifacts.report_search, 'Report search');
  assertOk(artifacts.report_stats, 'Report stats');

  await writeJson(
    resolve(outputRoot, '12-instruction-detail.response.json'),
    artifacts.instruction_detail.json,
  );
  await writeJson(
    resolve(outputRoot, '13-finality-receipt.response.json'),
    artifacts.finality_receipt.json,
  );
  await writeJson(
    resolve(outputRoot, '14-reporting-notifications.response.json'),
    artifacts.reporting_notifications.json,
  );
  if (artifacts.reporting_notification_detail) {
    await writeJson(
      resolve(outputRoot, '15-reporting-notification.detail.response.json'),
      artifacts.reporting_notification_detail.json,
    );
  }
  await writeJson(
    resolve(outputRoot, '16-reporting-statements.response.json'),
    artifacts.reporting_statements.json,
  );
  if (artifacts.reporting_statement_detail) {
    await writeJson(
      resolve(outputRoot, '17-reporting-statement.detail.response.json'),
      artifacts.reporting_statement_detail.json,
    );
  }
  await writeJson(
    resolve(outputRoot, '18-report-search.response.json'),
    artifacts.report_search.json,
  );
  await writeJson(
    resolve(outputRoot, '19-report-stats.response.json'),
    artifacts.report_stats.json,
  );

  const summary = {
    run_id: runId,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    output_dir: outputRoot,
    instruction_id: instructionId,
    uetr: instructionResponse.json.uetr,
    travel_rule_record_id: travelRuleResponse.json.record_id,
    final_status: finalExecutionStatus.status,
    transaction_hash: finalExecutionStatus.transaction_hash ?? null,
    transaction_explorer_url: buildExplorerUrl(
      finalExecutionStatus.transaction_hash ?? null,
    ),
    finality_status: artifacts.finality_receipt.json.finality_status ?? null,
    confirmation_depth: artifacts.finality_receipt.json.confirmation_depth ?? null,
    required_confirmation_depth:
      artifacts.finality_receipt.json.required_confirmation_depth ?? null,
    reporting_notification_count:
      artifacts.reporting_notifications.json.total_matched ?? null,
    reporting_statement_count:
      artifacts.reporting_statements.json.total_matched ?? null,
  };

  await writeJson(resolve(outputRoot, '20-summary.json'), summary);

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
