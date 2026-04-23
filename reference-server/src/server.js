import { loadConfig } from './config.js';
import { buildApp } from './app.js';
import { createSepoliaUsdcAdapter } from './chain/sepolia-usdc-adapter.js';

function buildConfiguredChainAdapter(config) {
  if (config.chainAdapter.id === 'sepolia-usdc') {
    return createSepoliaUsdcAdapter(config.chainAdapter.sepolia);
  }

  return null;
}

const config = loadConfig();
const app = await buildApp({
  dbPath: config.dbPath,
  chainAdapter: buildConfiguredChainAdapter(config),
  webhookDispatch: config.webhookDispatch,
  webhookRetryScheduleMs: config.webhookRetryScheduleMs,
});

try {
  await app.listen({
    host: config.host,
    port: config.port,
  });

  console.log(
    `pacs.crypto reference server listening on http://${config.host}:${config.port}`,
  );
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
