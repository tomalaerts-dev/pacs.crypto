import { createMockEvmChainAdapter } from './mock-evm-adapter.js';

export function normalizeChainAdapter(chainAdapter = null) {
  const fallback = createMockEvmChainAdapter();
  const candidate = chainAdapter ?? {};

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
  };
}
