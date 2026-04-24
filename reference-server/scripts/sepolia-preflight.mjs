import { Contract, JsonRpcProvider, Wallet, formatEther, formatUnits, parseUnits } from 'ethers';

const EXPECTED_CHAIN_ID = 11155111n;
const DEFAULT_GAS_LIMIT = 85000;
const DEFAULT_MAX_FEE_GWEI = '35';
const DEFAULT_MAX_PRIORITY_FEE_GWEI = '2';
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

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

function requireEnv(name) {
  const value = process.env[name];
  if (!hasText(value)) {
    throw new Error(`${name} must be set.`);
  }

  return value.trim();
}

async function main() {
  const rpcUrl = requireEnv('REF_SERVER_SEPOLIA_RPC_URL');
  const privateKey = requireEnv('REF_SERVER_SEPOLIA_PRIVATE_KEY');
  const usdcContractAddress = normalizeHex(
    requireEnv('REF_SERVER_SEPOLIA_USDC_CONTRACT_ADDRESS'),
  );
  const configuredSourceAddress = normalizeHex(
    process.env.REF_SERVER_SEPOLIA_SOURCE_ADDRESS ?? '',
  );
  const gasLimit = parsePositiveInteger(
    process.env.REF_SERVER_SEPOLIA_GAS_LIMIT,
    DEFAULT_GAS_LIMIT,
  );
  const maxFeePerGasGwei =
    process.env.REF_SERVER_SEPOLIA_MAX_FEE_GWEI ?? DEFAULT_MAX_FEE_GWEI;
  const maxPriorityFeePerGasGwei =
    process.env.REF_SERVER_SEPOLIA_MAX_PRIORITY_FEE_GWEI ??
    DEFAULT_MAX_PRIORITY_FEE_GWEI;

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);
  const sourceAddress = wallet.address;
  const contract = new Contract(usdcContractAddress, ERC20_ABI, provider);

  const [
    network,
    ethBalanceWei,
    contractCode,
    usdcBalanceRaw,
    usdcDecimals,
    usdcSymbol,
  ] = await Promise.all([
    provider.getNetwork(),
    provider.getBalance(sourceAddress),
    provider.getCode(usdcContractAddress),
    contract.balanceOf(sourceAddress),
    contract.decimals(),
    contract.symbol(),
  ]);

  const chainId = BigInt(network.chainId);
  const maxGasCostWei = parseUnits(String(maxFeePerGasGwei), 9) * BigInt(gasLimit);
  const recommendations = [];
  let ok = true;

  if (chainId !== EXPECTED_CHAIN_ID) {
    ok = false;
    recommendations.push(
      `RPC is on chain_id ${chainId}, but this flow expects Sepolia ${EXPECTED_CHAIN_ID}.`,
    );
  }

  if (
    configuredSourceAddress &&
    configuredSourceAddress.toLowerCase() !== sourceAddress.toLowerCase()
  ) {
    ok = false;
    recommendations.push(
      'Configured source address does not match the supplied private key.',
    );
  }

  if (contractCode === '0x') {
    ok = false;
    recommendations.push(
      'No contract code found at REF_SERVER_SEPOLIA_USDC_CONTRACT_ADDRESS.',
    );
  }

  if (ethBalanceWei < maxGasCostWei) {
    ok = false;
    recommendations.push(
      'ETH balance is below the configured maximum gas-cost envelope for one transfer.',
    );
  } else if (ethBalanceWei < maxGasCostWei * 2n) {
    recommendations.push(
      'ETH balance is technically sufficient, but topping it up would reduce demo risk.',
    );
  }

  if (usdcBalanceRaw === 0n) {
    recommendations.push('USDC balance is zero; the demo transfer will fail.');
  }

  const summary = {
    ok,
    checked_at: new Date().toISOString(),
    network: {
      chain_id: String(chainId),
      expected_chain_id: String(EXPECTED_CHAIN_ID),
      matches_expected: chainId === EXPECTED_CHAIN_ID,
      name: network.name ?? null,
    },
    source_wallet: {
      address: sourceAddress,
      configured_source_address: configuredSourceAddress,
      matches_private_key:
        configuredSourceAddress === null
          ? null
          : configuredSourceAddress.toLowerCase() === sourceAddress.toLowerCase(),
      eth_balance: formatEther(ethBalanceWei),
    },
    token: {
      contract_address: usdcContractAddress,
      symbol: usdcSymbol,
      decimals: Number(usdcDecimals),
      balance: formatUnits(usdcBalanceRaw, usdcDecimals),
      code_present: contractCode !== '0x',
    },
    gas_policy: {
      gas_limit: gasLimit,
      max_fee_per_gas_gwei: String(maxFeePerGasGwei),
      max_priority_fee_per_gas_gwei: String(maxPriorityFeePerGasGwei),
      max_gas_cost_eth: formatEther(maxGasCostWei),
    },
    recommendations,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
