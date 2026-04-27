import { randomUUID } from 'node:crypto';

const DEFAULT_CHAIN_PROFILE = {
  nativeCurrency: 'ETH',
  nativeUsdPrice: 3785,
  blockBaseNumber: 22190456,
  blockTimeSeconds: 12,
};

function nowIso() {
  return new Date().toISOString();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function hashText(value = '') {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function buildMockTransactionHash(seed = randomUUID()) {
  let state = hashText(seed);
  let hex = '';

  while (hex.length < 64) {
    state = Math.imul(state ^ 0x9e3779b9, 1664525) + 1013904223;
    hex += (state >>> 0).toString(16).padStart(8, '0');
  }

  return `0x${hex.slice(0, 64)}`;
}

function resolveChainProfile(chainDli) {
  if (chainDli === 'X9J9XDMTD') {
    return DEFAULT_CHAIN_PROFILE;
  }

  return DEFAULT_CHAIN_PROFILE;
}

function resolveCongestionLevel({
  amount = 0,
  rampType = 'NONE',
  maximumSlippageRate = 0,
} = {}) {
  let score = 0;

  if (amount >= 250000) {
    score += 2;
  } else if (amount >= 2500) {
    score += 1;
  }

  if (rampType && rampType !== 'NONE') {
    score += 1;
  }

  if (maximumSlippageRate > 0 && maximumSlippageRate < 0.0015) {
    score += 1;
  }

  if (score >= 3) {
    return 'HIGH';
  }
  if (score >= 1) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function getCongestionProfile(level, chainProfile) {
  if (level === 'HIGH') {
    return {
      baseFeeGwei: 33.6,
      priorityFeeGwei: 2.8,
      blockTimeSeconds: chainProfile.blockTimeSeconds + 2,
      confirmationIntervalMs: 360,
      gasLimit: 81000,
    };
  }

  if (level === 'LOW') {
    return {
      baseFeeGwei: 11.2,
      priorityFeeGwei: 1.0,
      blockTimeSeconds: Math.max(chainProfile.blockTimeSeconds - 1, 10),
      confirmationIntervalMs: 170,
      gasLimit: 61000,
    };
  }

  return {
    baseFeeGwei: 19.8,
    priorityFeeGwei: 1.7,
    blockTimeSeconds: chainProfile.blockTimeSeconds,
    confirmationIntervalMs: 250,
    gasLimit: 70000,
  };
}

function resolveConfirmationDepth({ amount = 0, rampType = 'NONE' } = {}) {
  if (amount >= 250000 || rampType === 'ONRAMP_AND_OFFRAMP') {
    return 18;
  }
  if (amount >= 1000 || rampType !== 'NONE') {
    return 12;
  }
  return 6;
}

function deriveBlockNumber(record, policy) {
  const seed = `${record.instruction_id ?? record.payment_identification?.uetr ?? ''}:${record.created_at ?? ''}`;
  return policy.chainProfile.blockBaseNumber + (hashText(seed) % 100000);
}

function resolveSimulationPolicy(input = {}) {
  const amount = Number.parseFloat(
    input.amount ?? input.interbank_settlement_amount?.amount ?? '0',
  );
  const rampType =
    input.ramp_type ??
    input.blockchain_instruction?.ramp_instruction?.ramp_type ??
    'NONE';
  const maximumSlippageRate = Number.parseFloat(
    input.maximum_slippage_rate ??
      input.blockchain_instruction?.maximum_slippage_rate ??
      '0',
  );
  const chainDli =
    input.chain_dli ?? input.blockchain_instruction?.chain_dli ?? 'X9J9XDMTD';
  const chainProfile = resolveChainProfile(chainDli);
  const congestionLevel = resolveCongestionLevel({
    amount,
    rampType,
    maximumSlippageRate,
  });
  const congestionProfile = getCongestionProfile(congestionLevel, chainProfile);
  const requiredConfirmationDepth = resolveConfirmationDepth({
    amount,
    rampType,
  });
  const gasPriceGwei =
    congestionProfile.baseFeeGwei + congestionProfile.priorityFeeGwei;
  const gasCostNative =
    (gasPriceGwei * congestionProfile.gasLimit) / 1_000_000_000;
  const serviceFee =
    amount >= 250000 ? 45 : amount >= 10000 ? 24.5 : 12.5;
  const rampSpreadBps =
    rampType === 'NONE'
      ? 0
      : rampType === 'ONRAMP_AND_OFFRAMP'
        ? 45
        : 25;
  const slippageEstimateBps =
    rampType === 'NONE'
      ? clamp(4 + (amount >= 100000 ? 3 : amount >= 10000 ? 1 : 0), 4, 9)
      : clamp(12 + (amount >= 100000 ? 10 : amount >= 10000 ? 5 : 0), 12, 36);
  const broadcastDelayMs = congestionLevel === 'HIGH' ? 1100 : 850;
  const inclusionDelayMs =
    broadcastDelayMs +
    (congestionLevel === 'HIGH' ? 1500 : congestionLevel === 'MEDIUM' ? 950 : 700);
  const finalityDelayMs =
    inclusionDelayMs +
    (requiredConfirmationDepth * congestionProfile.confirmationIntervalMs);
  const estimatedConfirmationSeconds = Math.round(
    requiredConfirmationDepth * congestionProfile.blockTimeSeconds,
  );

  return {
    amount,
    rampType,
    maximumSlippageRate: Number.isFinite(maximumSlippageRate)
      ? maximumSlippageRate
      : 0,
    chainDli,
    chainProfile,
    congestionLevel,
    requiredConfirmationDepth,
    baseFeeGwei: congestionProfile.baseFeeGwei,
    priorityFeeGwei: congestionProfile.priorityFeeGwei,
    blockTimeSeconds: congestionProfile.blockTimeSeconds,
    confirmationIntervalMs: congestionProfile.confirmationIntervalMs,
    broadcastDelayMs,
    inclusionDelayMs,
    finalityDelayMs,
    estimatedConfirmationSeconds,
    gasLimit: congestionProfile.gasLimit,
    gasCostNative,
    gasCostFiat: gasCostNative * chainProfile.nativeUsdPrice,
    serviceFee,
    rampSpreadBps,
    slippageEstimateBps,
  };
}

function buildFeeEstimate(request = {}) {
  const policy = resolveSimulationPolicy(request);

  return {
    gas_cost_native: {
      amount: policy.gasCostNative.toFixed(6),
      currency: policy.chainProfile.nativeCurrency,
    },
    gas_cost_fiat: {
      amount: policy.gasCostFiat.toFixed(2),
      currency: 'USD',
    },
    vasp_service_fee: {
      amount: policy.serviceFee.toFixed(2),
      currency: 'USD',
    },
    ramp_spread_bps: policy.rampSpreadBps,
    slippage_estimate_bps: policy.slippageEstimateBps,
    total_cost_fiat: {
      amount: (policy.gasCostFiat + policy.serviceFee).toFixed(2),
      currency: 'USD',
    },
  };
}

function buildPreExecutionSettlementState(settlement, policy, amount) {
  return {
    ...settlement,
    transaction_hash: null,
    block_number: null,
    block_timestamp: null,
    confirmation_depth: 0,
    required_confirmation_depth: policy.requiredConfirmationDepth,
    finality_status: 'PENDING',
    actual_amount_transferred: amount ?? '0',
    actual_gas_cost_native: '0.000000',
    actual_gas_cost_fiat: {
      amount: '0.00',
      currency: 'USD',
    },
    actual_slippage_rate:
      policy.rampType === 'NONE'
        ? '0.0000'
        : (policy.slippageEstimateBps / 10000).toFixed(4),
  };
}

function buildExecutedSettlementState({
  settlement,
  policy,
  transactionHash,
  blockNumber,
  blockTimestamp,
  confirmationDepth,
  finalityStatus,
}) {
  const netTransferredAmount =
    policy.rampType === 'NONE'
      ? policy.amount
      : policy.amount * (1 - (policy.slippageEstimateBps / 10000));

  return {
    ...settlement,
    transaction_hash: transactionHash,
    block_number: blockNumber,
    block_timestamp: blockTimestamp,
    confirmation_depth: confirmationDepth,
    required_confirmation_depth: policy.requiredConfirmationDepth,
    finality_status: finalityStatus,
    actual_amount_transferred: netTransferredAmount.toFixed(2),
    actual_gas_cost_native: policy.gasCostNative.toFixed(6),
    actual_gas_cost_fiat: {
      amount: policy.gasCostFiat.toFixed(2),
      currency: 'USD',
    },
    actual_slippage_rate: (policy.slippageEstimateBps / 10000).toFixed(4),
  };
}

function buildAdapterMetadata(adapter, input = {}) {
  const policy = resolveSimulationPolicy(input);

  return {
    adapter_id: adapter.id ?? 'mock-evm',
    adapter_mode: adapter.mode ?? 'SIMULATED',
    chain_family: adapter.chain_family ?? 'EVM',
    chain_dli: policy.chainDli,
    settlement_model: 'PROBABILISTIC_TO_THRESHOLD_FINALITY',
    simulated: (adapter.mode ?? 'SIMULATED') === 'SIMULATED',
    congestion_level: policy.congestionLevel,
    network_profile: {
      native_currency: policy.chainProfile.nativeCurrency,
      native_usd_price: policy.chainProfile.nativeUsdPrice,
      reference_block_base_number: policy.chainProfile.blockBaseNumber,
    },
    lifecycle_policy: {
      ramp_type: policy.rampType,
      maximum_slippage_rate: policy.maximumSlippageRate.toFixed(4),
      required_confirmation_depth: policy.requiredConfirmationDepth,
      estimated_confirmation_seconds: policy.estimatedConfirmationSeconds,
      block_time_seconds: policy.blockTimeSeconds,
      confirmation_interval_ms: policy.confirmationIntervalMs,
      broadcast_delay_ms: policy.broadcastDelayMs,
      inclusion_delay_ms: policy.inclusionDelayMs,
      finality_delay_ms: policy.finalityDelayMs,
    },
    fee_model: {
      gas_limit: policy.gasLimit,
      base_fee_gwei: policy.baseFeeGwei.toFixed(1),
      priority_fee_gwei: policy.priorityFeeGwei.toFixed(1),
      service_fee_usd: policy.serviceFee.toFixed(2),
      ramp_spread_bps: policy.rampSpreadBps,
      slippage_estimate_bps: policy.slippageEstimateBps,
    },
  };
}

export function createMockEvmChainAdapter() {
  return {
    id: 'mock-evm',
    mode: 'SIMULATED',
    chain_family: 'EVM',

    hasExpired(expiryDateTime) {
      return Boolean(expiryDateTime) && Date.parse(expiryDateTime) <= Date.now();
    },

    buildFeeEstimate,

    describeLifecycle(input = {}) {
      return buildAdapterMetadata(this, input);
    },

    buildQuoteResponse(request = {}) {
      const createdAt = nowIso();
      const validUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const policy = resolveSimulationPolicy(request);

      return {
        quote_id: randomUUID(),
        valid_until: validUntil,
        fee_lock_type: policy.congestionLevel === 'HIGH' ? 'INDICATIVE' : 'CAPPED',
        fee_estimate: buildFeeEstimate(request),
        estimated_confirmation_seconds: policy.estimatedConfirmationSeconds,
        chain_conditions: {
          congestion_level: policy.congestionLevel,
          current_base_fee_gwei: policy.baseFeeGwei.toFixed(1),
          average_block_time_seconds: policy.blockTimeSeconds,
        },
        adapter_metadata: this.describeLifecycle(request),
        created_at: createdAt,
      };
    },

    normalizeOnChainSettlement(onChainSettlement, amount, input = {}) {
      const policy = resolveSimulationPolicy({
        ...input,
        amount,
      });

      return buildPreExecutionSettlementState(
        {
          required_confirmation_depth: policy.requiredConfirmationDepth,
          ...onChainSettlement,
        },
        policy,
        amount ?? '0',
      );
    },

    getLifecycleTimestamp(record, status) {
      const history = record.status_history ?? [];
      for (let index = history.length - 1; index >= 0; index -= 1) {
        if (history[index].status === status) {
          return history[index].status_at;
        }
      }

      const createdAt = Date.parse(record.created_at);
      if (Number.isNaN(createdAt)) {
        return record.updated_at ?? nowIso();
      }

      const policy = resolveSimulationPolicy(record);

      if (['PENDING', 'QUOTED', 'SLIPPAGE_EXCEEDED', 'RAMP_FAILED'].includes(status)) {
        return record.created_at;
      }
      if (status === 'BROADCAST') {
        return new Date(createdAt + policy.broadcastDelayMs).toISOString();
      }
      if (status === 'CONFIRMING') {
        return new Date(createdAt + policy.inclusionDelayMs).toISOString();
      }
      if (status === 'FINAL') {
        return new Date(createdAt + policy.finalityDelayMs).toISOString();
      }

      return record.updated_at ?? nowIso();
    },

    deriveLifecycleState(record) {
      const policy = resolveSimulationPolicy(record);
      const normalizedSettlement = this.normalizeOnChainSettlement(
        record.on_chain_settlement,
        record.interbank_settlement_amount?.amount,
        record,
      );
      const elapsedMs = Date.now() - Date.parse(record.created_at);
      const transactionSeed =
        record.instruction_id ??
        record.payment_identification?.uetr ??
        record.created_at ??
        randomUUID();
      const transactionHash =
        normalizedSettlement.transaction_hash ?? buildMockTransactionHash(transactionSeed);
      const blockNumber = deriveBlockNumber(record, policy);
      const blockTimestamp = new Date(
        Date.parse(record.created_at) + policy.inclusionDelayMs,
      ).toISOString();

      if (record.status === 'PENDING' && this.hasExpired(record.expiry_date_time)) {
        return {
          status: 'EXPIRED',
          failureReason: 'Instruction expired before execution.',
          onChainSettlement: buildPreExecutionSettlementState(
            normalizedSettlement,
            policy,
            record.interbank_settlement_amount?.amount ?? '0',
          ),
        };
      }

      if (
        record.status === 'PENDING' &&
        policy.rampType !== 'NONE' &&
        policy.maximumSlippageRate > 0 &&
        policy.maximumSlippageRate < (policy.slippageEstimateBps / 10000)
      ) {
        return {
          status: 'SLIPPAGE_EXCEEDED',
          failureReason: `Estimated slippage of ${(policy.slippageEstimateBps / 100).toFixed(2)}% exceeds configured maximum slippage.`,
          onChainSettlement: buildPreExecutionSettlementState(
            normalizedSettlement,
            policy,
            record.interbank_settlement_amount?.amount ?? '0',
          ),
        };
      }

      if (['CANCELLED', 'EXPIRED', 'SLIPPAGE_EXCEEDED', 'RAMP_FAILED', 'FAILED'].includes(record.status)) {
        return {
          status: record.status,
          failureReason: record.failure_reason ?? null,
          onChainSettlement:
            record.status === 'CANCELLED'
              ? buildPreExecutionSettlementState(
                  normalizedSettlement,
                  policy,
                  record.interbank_settlement_amount?.amount ?? '0',
                )
              : normalizedSettlement,
        };
      }

      if (elapsedMs >= policy.finalityDelayMs) {
        return {
          status: 'FINAL',
          failureReason: null,
          onChainSettlement: buildExecutedSettlementState({
            settlement: normalizedSettlement,
            policy,
            transactionHash,
            blockNumber,
            blockTimestamp,
            confirmationDepth: policy.requiredConfirmationDepth,
            finalityStatus: 'FINAL',
          }),
        };
      }

      if (elapsedMs >= policy.inclusionDelayMs) {
        const confirmationsEarned =
          Math.floor(
            (elapsedMs - policy.inclusionDelayMs) / policy.confirmationIntervalMs,
          ) + 1;

        return {
          status: 'CONFIRMING',
          failureReason: null,
          onChainSettlement: buildExecutedSettlementState({
            settlement: normalizedSettlement,
            policy,
            transactionHash,
            blockNumber,
            blockTimestamp,
            confirmationDepth: clamp(
              confirmationsEarned,
              1,
              Math.max(policy.requiredConfirmationDepth - 1, 1),
            ),
            finalityStatus: 'PROBABILISTIC',
          }),
        };
      }

      if (elapsedMs >= policy.broadcastDelayMs) {
        return {
          status: 'BROADCAST',
          failureReason: null,
          onChainSettlement: buildExecutedSettlementState({
            settlement: normalizedSettlement,
            policy,
            transactionHash,
            blockNumber: null,
            blockTimestamp: null,
            confirmationDepth: 0,
            finalityStatus: 'PENDING',
          }),
        };
      }

      return {
        status: record.status,
        failureReason: record.failure_reason ?? null,
        onChainSettlement: buildPreExecutionSettlementState(
          normalizedSettlement,
          policy,
          record.interbank_settlement_amount?.amount ?? '0',
        ),
      };
    },
  };
}
