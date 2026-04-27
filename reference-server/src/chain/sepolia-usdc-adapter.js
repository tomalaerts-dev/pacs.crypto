import {
  Contract,
  Interface,
  JsonRpcProvider,
  Wallet,
  formatEther,
  formatUnits,
  parseUnits,
} from 'ethers';
import { randomUUID } from 'node:crypto';

const SEPOLIA_CHAIN_DLI = 'X9J9XDMTD';
const SEPOLIA_CHAIN_ID = 11155111n;
const SEPOLIA_USDC_TOKEN_DTI = 'T9B3X8H2K';
const DEFAULT_REQUIRED_CONFIRMATIONS = 3;
const DEFAULT_USDC_DECIMALS = 6;
const DEFAULT_GAS_LIMIT = 85000;
const DEFAULT_MAX_FEE_GWEI = '35';
const DEFAULT_PRIORITY_FEE_GWEI = '2';
const DEFAULT_EXPLORER_BASE_URL = 'https://sepolia.etherscan.io';
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];
const ERC20_INTERFACE = new Interface(ERC20_ABI);

function nowIso() {
  return new Date().toISOString();
}

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

function normalizeIdentifier(value, prefix = null) {
  if (!hasText(value)) {
    return null;
  }

  const normalized = value.trim();
  if (prefix && normalized.toUpperCase().startsWith(`${prefix}/`)) {
    return normalized.slice(prefix.length + 1);
  }
  return normalized;
}

function normalizeComparisonAddress(value) {
  return normalizeHex(value)?.toLowerCase() ?? null;
}

function normalizeLogAddress(value) {
  return normalizeComparisonAddress(value);
}

function normalizeInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseGweiToWei(value) {
  return parseUnits(String(value ?? '0'), 9);
}

function safeBigInt(value) {
  if (value === undefined || value === null) {
    return null;
  }

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function getRecipientAddress(input = {}) {
  return (
    normalizeHex(input.creditor_account?.proxy?.identification) ??
    normalizeHex(input.blockchain_instruction?.destination_wallet_address) ??
    null
  );
}

function getDebtorAddress(input = {}) {
  return (
    normalizeHex(input.debtor_account?.proxy?.identification) ??
    normalizeHex(input.blockchain_instruction?.source_wallet_address) ??
    null
  );
}

function validateSepoliaUsdcCorridor({ config, record, wallet }) {
  const chainDli = normalizeIdentifier(
    record.blockchain_instruction?.chain_dli,
    'DLID',
  );
  if (chainDli !== SEPOLIA_CHAIN_DLI) {
    return `Sepolia USDC broadcast requires chain_dli ${SEPOLIA_CHAIN_DLI}.`;
  }

  const token = record.blockchain_instruction?.token ?? {};
  const tokenDti = normalizeIdentifier(token.token_dti, 'DTID');
  const tokenSymbol = token.token_symbol?.toUpperCase?.() ?? null;
  if (tokenDti !== SEPOLIA_USDC_TOKEN_DTI || tokenSymbol !== 'USDC') {
    return `Sepolia USDC broadcast requires token_dti ${SEPOLIA_USDC_TOKEN_DTI} and token_symbol USDC.`;
  }

  const settlementCurrency = record.interbank_settlement_amount?.currency ?? null;
  if (settlementCurrency !== 'USD') {
    return 'Sepolia USDC broadcast requires interbank_settlement_amount.currency USD.';
  }

  const debtorAddress = normalizeComparisonAddress(getDebtorAddress(record));
  const sourceAddress = normalizeComparisonAddress(config.sourceAddress ?? wallet.address);
  if (!debtorAddress) {
    return 'Sepolia USDC broadcast requires debtor_account.proxy.identification as source wallet address.';
  }
  if (debtorAddress !== sourceAddress) {
    return 'Sepolia USDC broadcast requires debtor wallet to match the configured source wallet.';
  }

  return null;
}

function buildFallbackFeeEstimate(config = {}) {
  const maxFeePerGas = parseGweiToWei(config.maxFeePerGasGwei);
  const gasLimit = BigInt(config.gasLimit);
  const gasCostWei = maxFeePerGas * gasLimit;
  return {
    gas_cost_native: {
      amount: formatEther(gasCostWei),
      currency: 'ETH',
    },
    gas_cost_fiat: {
      amount: '0.00',
      currency: 'USD',
    },
    vasp_service_fee: {
      amount: '0.00',
      currency: 'USD',
    },
    ramp_spread_bps: 0,
    slippage_estimate_bps: 0,
    total_cost_fiat: {
      amount: '0.00',
      currency: 'USD',
    },
  };
}

function normalizeConfig(config = {}) {
  return {
    rpcUrl: config.rpcUrl ?? null,
    provider: config.provider ?? null,
    walletFactory: config.walletFactory ?? null,
    contractFactory: config.contractFactory ?? null,
    privateKey: normalizeHex(config.privateKey),
    usdcContractAddress: normalizeHex(config.usdcContractAddress),
    sourceAddress: normalizeHex(config.sourceAddress),
    requiredConfirmations: normalizeInteger(
      config.requiredConfirmations,
      DEFAULT_REQUIRED_CONFIRMATIONS,
    ),
    usdcDecimals: normalizeInteger(config.usdcDecimals, DEFAULT_USDC_DECIMALS),
    gasLimit: normalizeInteger(config.gasLimit, DEFAULT_GAS_LIMIT),
    broadcastEnabled: config.broadcastEnabled === true,
    maxFeePerGasGwei: config.maxFeePerGasGwei ?? DEFAULT_MAX_FEE_GWEI,
    maxPriorityFeePerGasGwei:
      config.maxPriorityFeePerGasGwei ?? DEFAULT_PRIORITY_FEE_GWEI,
    explorerBaseUrl: config.explorerBaseUrl ?? DEFAULT_EXPLORER_BASE_URL,
  };
}

function buildAdapterMetadata(config, input = {}) {
  return {
    adapter_id: 'sepolia-usdc',
    adapter_mode: config.broadcastEnabled ? 'TESTNET_BROADCAST' : 'TESTNET_READ_ONLY',
    chain_family: 'EVM',
    chain_dli: input.chain_dli ?? input.blockchain_instruction?.chain_dli ?? SEPOLIA_CHAIN_DLI,
    settlement_model: 'SEPOLIA_TESTNET_CONFIRMATION_THRESHOLD',
    simulated: false,
    network_profile: {
      chain_name: 'Ethereum Sepolia',
      expected_chain_id: String(SEPOLIA_CHAIN_ID),
      native_currency: 'ETH',
      usdc_contract_address: config.usdcContractAddress,
      configured_source_address: config.sourceAddress,
      rpc_configured: hasText(config.rpcUrl),
      explorer_base_url: config.explorerBaseUrl,
    },
    lifecycle_policy: {
      custody_model:
        input.custody_model ?? input.blockchain_instruction?.custody_model ?? 'FULL_CUSTODY',
      required_confirmation_depth: config.requiredConfirmations,
      broadcast_enabled: config.broadcastEnabled,
      read_only_without_private_key: !hasText(config.privateKey),
    },
    fee_model: {
      gas_limit: config.gasLimit,
      max_fee_gwei: String(config.maxFeePerGasGwei),
      max_priority_fee_gwei: String(config.maxPriorityFeePerGasGwei),
    },
  };
}

function buildPreExecutionSettlementState(settlement, amount, config) {
  return {
    ...settlement,
    transaction_hash: settlement?.transaction_hash ?? null,
    block_number: settlement?.block_number ?? null,
    block_timestamp: settlement?.block_timestamp ?? null,
    confirmation_depth: settlement?.confirmation_depth ?? 0,
    required_confirmation_depth:
      settlement?.required_confirmation_depth ?? config.requiredConfirmations,
    finality_status: settlement?.finality_status ?? 'PENDING',
    actual_amount_transferred: settlement?.actual_amount_transferred ?? amount ?? '0',
    actual_gas_cost_native: settlement?.actual_gas_cost_native ?? '0.000000',
    actual_gas_cost_fiat: settlement?.actual_gas_cost_fiat ?? {
      amount: '0.00',
      currency: 'USD',
    },
    actual_slippage_rate: settlement?.actual_slippage_rate ?? '0.0000',
    adapter_execution_mode:
      settlement?.adapter_execution_mode ??
      (config.broadcastEnabled ? 'LIVE_BROADCAST' : 'READ_ONLY'),
  };
}

function buildProvider(config) {
  if (config.provider) {
    return config.provider;
  }
  return hasText(config.rpcUrl) ? new JsonRpcProvider(config.rpcUrl) : null;
}

function buildWallet(config, provider) {
  if (typeof config.walletFactory === 'function') {
    return config.walletFactory({
      provider,
      privateKey: config.privateKey,
      sourceAddress: config.sourceAddress,
      config,
    });
  }

  return new Wallet(config.privateKey, provider);
}

function buildUsdcContract(config, wallet) {
  if (typeof config.contractFactory === 'function') {
    return config.contractFactory({
      contractAddress: config.usdcContractAddress,
      wallet,
      config,
    });
  }

  return new Contract(config.usdcContractAddress, ERC20_ABI, wallet);
}

function parseTransferLog(log) {
  if (!log || typeof log !== 'object') {
    return null;
  }

  if (
    log.eventName === 'Transfer' &&
    log.args &&
    log.args.from !== undefined &&
    log.args.to !== undefined &&
    log.args.value !== undefined
  ) {
    return {
      from: log.args.from,
      to: log.args.to,
      value: safeBigInt(log.args.value),
    };
  }

  if (
    log.fragment?.name === 'Transfer' &&
    log.args &&
    log.args.from !== undefined &&
    log.args.to !== undefined &&
    log.args.value !== undefined
  ) {
    return {
      from: log.args.from,
      to: log.args.to,
      value: safeBigInt(log.args.value),
    };
  }

  try {
    const parsed = ERC20_INTERFACE.parseLog({
      topics: log.topics,
      data: log.data,
    });
    if (parsed?.name !== 'Transfer') {
      return null;
    }

    return {
      from: parsed.args.from,
      to: parsed.args.to,
      value: safeBigInt(parsed.args.value),
    };
  } catch {
    return null;
  }
}

function buildExpectedTransfer({ config, record, settlement }) {
  const expectedFrom =
    normalizeComparisonAddress(getDebtorAddress(record)) ??
    normalizeComparisonAddress(settlement?.broadcast_transaction?.from) ??
    normalizeComparisonAddress(config.sourceAddress);
  const expectedTo = normalizeComparisonAddress(getRecipientAddress(record));
  const expectedToken = normalizeComparisonAddress(config.usdcContractAddress);
  const expectedValue = safeBigInt(
    parseUnits(
      record.interbank_settlement_amount?.amount ?? '0',
      config.usdcDecimals,
    ),
  );

  return {
    expectedFrom,
    expectedTo,
    expectedToken,
    expectedValue,
  };
}

function verifyTransferLog({ config, record, receipt, settlement }) {
  const expected = buildExpectedTransfer({ config, record, settlement });
  if (
    !expected.expectedFrom ||
    !expected.expectedTo ||
    !expected.expectedToken ||
    expected.expectedValue === null
  ) {
    return {
      verified: false,
      failure_reason:
        'Sepolia finality requires source wallet, recipient wallet, token contract, and amount evidence.',
    };
  }

  const logs = Array.isArray(receipt?.logs) ? receipt.logs : [];
  for (const log of logs) {
    if (normalizeLogAddress(log.address) !== expected.expectedToken) {
      continue;
    }

    const transfer = parseTransferLog(log);
    if (!transfer) {
      continue;
    }

    const from = normalizeComparisonAddress(transfer.from);
    const to = normalizeComparisonAddress(transfer.to);
    const value = transfer.value;

    if (
      from === expected.expectedFrom &&
      to === expected.expectedTo &&
      value === expected.expectedValue
    ) {
      return {
        verified: true,
        token_contract_address: normalizeHex(config.usdcContractAddress),
        from: normalizeHex(transfer.from),
        to: normalizeHex(transfer.to),
        amount: formatUnits(value, config.usdcDecimals),
        amount_raw: value.toString(),
        log_index: log.index ?? log.logIndex ?? null,
      };
    }
  }

  return {
    verified: false,
    token_contract_address: normalizeHex(config.usdcContractAddress),
    expected_from: normalizeHex(expected.expectedFrom),
    expected_to: normalizeHex(expected.expectedTo),
    expected_amount_raw: expected.expectedValue.toString(),
    failure_reason:
      'Sepolia transaction receipt did not contain the expected USDC Transfer log.',
  };
}

async function getProviderChainId(provider) {
  if (!provider || typeof provider.getNetwork !== 'function') {
    return null;
  }

  const network = await provider.getNetwork();
  if (!network || network.chainId === undefined || network.chainId === null) {
    return null;
  }

  try {
    return BigInt(network.chainId);
  } catch {
    return null;
  }
}

async function validateSepoliaNetwork(provider) {
  const chainId = await getProviderChainId(provider);
  if (chainId === null) {
    return null;
  }

  if (chainId !== SEPOLIA_CHAIN_ID) {
    return `Configured RPC endpoint is on chain_id ${chainId}, expected Sepolia ${SEPOLIA_CHAIN_ID}.`;
  }

  return null;
}

async function buildFeeEstimate(config, provider) {
  if (!provider) {
    return buildFallbackFeeEstimate(config);
  }

  try {
    const feeData = await provider.getFeeData();
    const maxFeePerGas =
      feeData.maxFeePerGas ?? parseGweiToWei(config.maxFeePerGasGwei);
    const gasCostWei = maxFeePerGas * BigInt(config.gasLimit);
    return {
      ...buildFallbackFeeEstimate(config),
      gas_cost_native: {
        amount: formatEther(gasCostWei),
        currency: 'ETH',
      },
    };
  } catch {
    return buildFallbackFeeEstimate(config);
  }
}

async function getReceiptSettlementState({ config, provider, record, settlement }) {
  if (!provider || !settlement?.transaction_hash) {
    return settlement;
  }

  const networkFailure = await validateSepoliaNetwork(provider);
  if (networkFailure) {
    return {
      ...settlement,
      finality_status: 'FAILED',
      network_failure_reason: networkFailure,
    };
  }

  const receipt = await provider.getTransactionReceipt(settlement.transaction_hash);
  if (!receipt) {
    return {
      ...settlement,
      finality_status: 'PENDING',
      confirmation_depth: 0,
    };
  }

  const latestBlock = await provider.getBlockNumber();
  const confirmationDepth = Math.max(latestBlock - receipt.blockNumber + 1, 0);
  const finalityStatus =
    confirmationDepth >= config.requiredConfirmations ? 'FINAL' : 'PROBABILISTIC';
  const block = await provider.getBlock(receipt.blockNumber);
  const gasCostWei =
    receipt.gasUsed * (receipt.gasPrice ?? receipt.effectiveGasPrice ?? 0n);
  const transferVerification =
    receipt.status === 0
      ? {
          verified: false,
          failure_reason: 'Sepolia transaction reverted before token transfer verification.',
        }
      : verifyTransferLog({ config, record, receipt, settlement });
  const finalityFailureReason = transferVerification.verified
    ? null
    : transferVerification.failure_reason;

  return {
    ...settlement,
    block_number: receipt.blockNumber,
    block_timestamp: block?.timestamp
      ? new Date(block.timestamp * 1000).toISOString()
      : settlement.block_timestamp ?? nowIso(),
    confirmation_depth: confirmationDepth,
    required_confirmation_depth: config.requiredConfirmations,
    finality_status:
      receipt.status === 0 || !transferVerification.verified
        ? 'FAILED'
        : finalityStatus,
    transfer_verification: transferVerification,
    network_failure_reason:
      receipt.status === 0
        ? 'Sepolia transaction reverted.'
        : finalityFailureReason ?? settlement.network_failure_reason ?? null,
    actual_amount_transferred:
      transferVerification.verified
        ? transferVerification.amount
        : (settlement.actual_amount_transferred ??
          record.interbank_settlement_amount?.amount ??
          '0'),
    actual_gas_cost_native: formatEther(gasCostWei),
    adapter_execution_mode: config.broadcastEnabled ? 'LIVE_BROADCAST' : 'READ_ONLY',
  };
}

async function broadcastUsdcTransfer({ config, provider, record, settlement }) {
  if (!provider || !hasText(config.rpcUrl)) {
    return {
      status: 'FAILED',
      failureReason: 'Sepolia broadcast is enabled but no RPC URL is configured.',
      onChainSettlement: settlement,
    };
  }

  const networkFailure = await validateSepoliaNetwork(provider);
  if (networkFailure) {
    return {
      status: 'FAILED',
      failureReason: networkFailure,
      onChainSettlement: settlement,
    };
  }

  if (!hasText(config.privateKey)) {
    return {
      status: 'FAILED',
      failureReason: 'Sepolia broadcast is enabled but no private key is configured.',
      onChainSettlement: settlement,
    };
  }

  if (!hasText(config.usdcContractAddress)) {
    return {
      status: 'FAILED',
      failureReason: 'Sepolia broadcast is enabled but no USDC contract address is configured.',
      onChainSettlement: settlement,
    };
  }

  const recipientAddress = getRecipientAddress(record);
  if (!recipientAddress) {
    return {
      status: 'FAILED',
      failureReason:
        'Sepolia broadcast requires creditor_account.proxy.identification as recipient wallet address.',
      onChainSettlement: settlement,
    };
  }

  const wallet = buildWallet(config, provider);
  const sourceAddress = config.sourceAddress ?? wallet.address;
  if (sourceAddress.toLowerCase() !== wallet.address.toLowerCase()) {
    return {
      status: 'FAILED',
      failureReason: 'Configured Sepolia source address does not match private key.',
      onChainSettlement: settlement,
    };
  }

  const corridorFailure = validateSepoliaUsdcCorridor({
    config,
    record,
    wallet,
  });
  if (corridorFailure) {
    return {
      status: 'FAILED',
      failureReason: corridorFailure,
      onChainSettlement: settlement,
    };
  }

  const contract = buildUsdcContract(config, wallet);
  const amount = parseUnits(
    record.interbank_settlement_amount?.amount ?? '0',
    config.usdcDecimals,
  );
  const transaction = await contract.transfer(recipientAddress, amount, {
    gasLimit: BigInt(config.gasLimit),
    maxFeePerGas: parseGweiToWei(config.maxFeePerGasGwei),
    maxPriorityFeePerGas: parseGweiToWei(config.maxPriorityFeePerGasGwei),
  });

  return {
    status: 'BROADCAST',
    failureReason: null,
    onChainSettlement: {
      ...settlement,
      transaction_hash: transaction.hash,
      confirmation_depth: 0,
      required_confirmation_depth: config.requiredConfirmations,
      finality_status: 'PENDING',
      adapter_execution_mode: 'LIVE_BROADCAST',
      broadcast_transaction: {
        from: wallet.address,
        to: config.usdcContractAddress,
        recipient_wallet_address: recipientAddress,
      },
    },
  };
}

export function createSepoliaUsdcAdapter(config = {}) {
  const normalizedConfig = normalizeConfig(config);
  const provider = buildProvider(normalizedConfig);

  return {
    id: 'sepolia-usdc',
    mode: normalizedConfig.broadcastEnabled ? 'TESTNET_BROADCAST' : 'TESTNET_READ_ONLY',
    chain_family: 'EVM',

    hasExpired(expiryDateTime) {
      return Boolean(expiryDateTime) && Date.parse(expiryDateTime) <= Date.now();
    },

    buildFeeEstimate() {
      return buildFallbackFeeEstimate(normalizedConfig);
    },

    describeLifecycle(input = {}) {
      return buildAdapterMetadata(normalizedConfig, input);
    },

    async buildQuoteResponse(request = {}) {
      const createdAt = nowIso();
      return {
        quote_id: randomUUID(),
        valid_until: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        fee_lock_type: 'INDICATIVE',
        fee_estimate: await buildFeeEstimate(normalizedConfig, provider),
        estimated_confirmation_seconds: normalizedConfig.requiredConfirmations * 12,
        chain_conditions: {
          congestion_level: provider ? 'RPC_AVAILABLE' : 'RPC_NOT_CONFIGURED',
          current_base_fee_gwei: null,
          average_block_time_seconds: 12,
        },
        adapter_metadata: this.describeLifecycle(request),
        created_at: createdAt,
      };
    },

    normalizeOnChainSettlement(onChainSettlement, amount) {
      return buildPreExecutionSettlementState(
        onChainSettlement,
        amount,
        normalizedConfig,
      );
    },

    getLifecycleTimestamp(record, status) {
      const history = record.status_history ?? [];
      for (let index = history.length - 1; index >= 0; index -= 1) {
        if (history[index].status === status) {
          return history[index].status_at;
        }
      }

      return record.updated_at ?? record.created_at ?? nowIso();
    },

    async deriveLifecycleState(record) {
      const normalizedSettlement = this.normalizeOnChainSettlement(
        record.on_chain_settlement,
        record.interbank_settlement_amount?.amount,
        record,
      );

      if (record.status === 'PENDING' && this.hasExpired(record.expiry_date_time)) {
        return {
          status: 'EXPIRED',
          failureReason: 'Instruction expired before execution.',
          onChainSettlement: normalizedSettlement,
        };
      }

      if (['CANCELLED', 'EXPIRED', 'SLIPPAGE_EXCEEDED', 'RAMP_FAILED', 'FAILED'].includes(record.status)) {
        return {
          status: record.status,
          failureReason: record.failure_reason ?? null,
          onChainSettlement: normalizedSettlement,
        };
      }

      if (normalizedSettlement.transaction_hash) {
        const settlement = await getReceiptSettlementState({
          config: normalizedConfig,
          provider,
          record,
          settlement: normalizedSettlement,
        });
        const status =
          settlement.finality_status === 'FAILED'
            ? 'FAILED'
            : settlement.finality_status === 'FINAL'
              ? 'FINAL'
              : settlement.block_number
                ? 'CONFIRMING'
                : 'BROADCAST';

        return {
          status,
          failureReason:
            settlement.finality_status === 'FAILED'
              ? settlement.network_failure_reason ?? 'Sepolia transaction reverted.'
              : null,
          onChainSettlement: settlement,
        };
      }

      return {
        status: record.status,
        failureReason: record.failure_reason ?? null,
        onChainSettlement: normalizedSettlement,
      };
    },

    async submitLifecycleState(record) {
      const normalizedSettlement = this.normalizeOnChainSettlement(
        record.on_chain_settlement,
        record.interbank_settlement_amount?.amount,
        record,
      );

      if (record.status === 'PENDING' && this.hasExpired(record.expiry_date_time)) {
        return {
          status: 'EXPIRED',
          failureReason: 'Instruction expired before execution.',
          onChainSettlement: normalizedSettlement,
        };
      }

      if (
        !normalizedConfig.broadcastEnabled ||
        normalizedSettlement.transaction_hash ||
        !['PENDING', 'BROADCAST', 'CONFIRMING'].includes(record.status)
      ) {
        return this.deriveLifecycleState(record);
      }

      try {
        return await broadcastUsdcTransfer({
          config: normalizedConfig,
          provider,
          record,
          settlement: normalizedSettlement,
        });
      } catch (error) {
        return {
          status: 'FAILED',
          failureReason: `Sepolia broadcast failed: ${error.message}`,
          onChainSettlement: normalizedSettlement,
        };
      }
    },
  };
}
