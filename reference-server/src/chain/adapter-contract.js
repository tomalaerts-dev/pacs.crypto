import { createMockEvmChainAdapter } from './mock-evm-adapter.js';

export function normalizeChainAdapter(chainAdapter = null) {
  const fallback = createMockEvmChainAdapter();
  if (chainAdapter == null) {
    return fallback;
  }
  const candidate = chainAdapter;

  return {
    ...fallback,
    ...candidate,
    id:
      typeof candidate.id === 'string' && candidate.id.trim().length > 0
        ? candidate.id
        : fallback.id,
    mode:
      typeof candidate.mode === 'string' && candidate.mode.trim().length > 0
        ? candidate.mode
        : fallback.mode,
    chain_family:
      typeof candidate.chain_family === 'string' &&
      candidate.chain_family.trim().length > 0
        ? candidate.chain_family
        : fallback.chain_family,
    // Fail closed: an explicit chain adapter must opt in to delegated signing.
    // Otherwise a custodial adapter that merely omits the flag would inherit the
    // mock fallback's `true` and wrongly accept (and simulate) party-signed
    // transactions it cannot actually broadcast.
    supports_delegated_signing: candidate.supports_delegated_signing === true,
  };
}
