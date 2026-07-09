import { createMockEvmChainAdapter } from './mock-evm-adapter.js';

// Epic 18 — mock Circle CCTP V2 settlement adapter.
//
// Composes the mock EVM lifecycle and presents cross-chain burn-and-mint USDC
// settlement metadata, proving the chain-adapter seam supports a non-default
// settlement venue without changing any route contract. This is a SIMULATED
// adapter: it does not call Circle's CCTP contracts or attestation service. A
// real CCTP integration would replace the lifecycle internals here, exactly as
// the Sepolia adapter does for direct EVM transfers, while keeping this
// metadata shape.
export function createMockCctpAdapter({
  sourceDomain = 0,
  destinationDomain = 6,
} = {}) {
  const base = createMockEvmChainAdapter();

  return {
    ...base,
    id: 'mock-cctp',
    mode: 'SIMULATED',
    chain_family: 'EVM-CCTP',
    // Inherited from the mock base, but stated explicitly: this is a simulator,
    // so it may simulate the delegated-signing lifecycle (no real custody key).
    supports_delegated_signing: true,

    describeLifecycle(input = {}) {
      const metadata = base.describeLifecycle.call(this, input);
      return {
        ...metadata,
        settlement_model: 'CCTP_BURN_AND_MINT',
        cross_chain: {
          protocol: 'CIRCLE_CCTP_V2',
          mechanism: 'BURN_AND_MINT',
          source_domain: sourceDomain,
          destination_domain: destinationDomain,
        },
      };
    },
  };
}
