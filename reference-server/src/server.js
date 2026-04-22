import { loadConfig } from './config.js';
import { buildApp } from './app.js';

const config = loadConfig();
const app = await buildApp({
  dbPath: config.dbPath,
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
