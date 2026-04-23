import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(moduleDir, '..');
const DEFAULT_WEBHOOK_RETRY_SCHEDULE_MS = [30_000, 120_000, 600_000, 1_800_000];

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

function parseRetryScheduleMs(value) {
  if (!value) {
    return [...DEFAULT_WEBHOOK_RETRY_SCHEDULE_MS];
  }

  const schedule = String(value)
    .split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isInteger(item) && item > 0);

  return schedule.length > 0 ? schedule : [...DEFAULT_WEBHOOK_RETRY_SCHEDULE_MS];
}

export function loadConfig() {
  const chainAdapter = process.env.REF_SERVER_CHAIN_ADAPTER ?? 'mock-evm';
  return {
    host: process.env.REF_SERVER_HOST ?? '127.0.0.1',
    port: Number(process.env.REF_SERVER_PORT ?? 5050),
    dbPath:
      process.env.REF_SERVER_DB_PATH ??
      resolve(projectRoot, 'data', 'reference-stack.sqlite'),
    webhookDispatch: {
      enabled: parseBoolean(process.env.REF_SERVER_WEBHOOK_AUTO_DISPATCH, true),
      intervalMs: parsePositiveInteger(
        process.env.REF_SERVER_WEBHOOK_DISPATCH_INTERVAL_MS,
        1000,
      ),
      batchSize: parsePositiveInteger(
        process.env.REF_SERVER_WEBHOOK_DISPATCH_BATCH_SIZE,
        20,
      ),
    },
    webhookRetryScheduleMs: parseRetryScheduleMs(
      process.env.REF_SERVER_WEBHOOK_RETRY_SCHEDULE_MS,
    ),
    chainAdapter: {
      id: chainAdapter,
      sepolia: {
        rpcUrl: process.env.REF_SERVER_SEPOLIA_RPC_URL ?? null,
        privateKey: process.env.REF_SERVER_SEPOLIA_PRIVATE_KEY ?? null,
        usdcContractAddress:
          process.env.REF_SERVER_SEPOLIA_USDC_CONTRACT_ADDRESS ?? null,
        sourceAddress: process.env.REF_SERVER_SEPOLIA_SOURCE_ADDRESS ?? null,
        requiredConfirmations: parsePositiveInteger(
          process.env.REF_SERVER_SEPOLIA_REQUIRED_CONFIRMATIONS,
          3,
        ),
        gasLimit: parsePositiveInteger(
          process.env.REF_SERVER_SEPOLIA_GAS_LIMIT,
          85000,
        ),
        broadcastEnabled: parseBoolean(
          process.env.REF_SERVER_SEPOLIA_BROADCAST_ENABLED,
          false,
        ),
        maxFeePerGasGwei:
          process.env.REF_SERVER_SEPOLIA_MAX_FEE_GWEI ?? '35',
        maxPriorityFeePerGasGwei:
          process.env.REF_SERVER_SEPOLIA_MAX_PRIORITY_FEE_GWEI ?? '2',
      },
    },
  };
}
