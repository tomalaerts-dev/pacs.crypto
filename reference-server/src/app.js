import Fastify from 'fastify';

import { normalizeChainAdapter } from './chain/adapter-contract.js';
import { ReferenceStore } from './db.js';
import { registerExceptionRoutes } from './routes/exception-routes.js';
import { registerEventRoutes } from './routes/event-routes.js';
import { registerHealthRoutes } from './routes/health-routes.js';
import { registerInstructionRoutes } from './routes/instruction-routes.js';
import { registerReportingRoutes } from './routes/reporting-routes.js';
import { registerStatusRoutes } from './routes/status-routes.js';
import { registerTravelRuleRoutes } from './routes/travel-rule-routes.js';
import { registerWebhookRoutes } from './routes/webhook-routes.js';

async function defaultWebhookSender({ url, headers, body }) {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });

  return {
    status: response.status,
    bodyText: await response.text(),
  };
}

function normalizeWebhookDispatchConfig(config = {}) {
  const intervalMs = Number.parseInt(config.intervalMs ?? '1000', 10);
  const batchSize = Number.parseInt(config.batchSize ?? '20', 10);

  return {
    enabled: config.enabled === true,
    intervalMs: Number.isInteger(intervalMs) && intervalMs > 0 ? intervalMs : 1000,
    batchSize: Number.isInteger(batchSize) && batchSize > 0 ? batchSize : 20,
  };
}

export async function buildApp({
  dbPath = ':memory:',
  chainAdapter = null,
  webhookSender = defaultWebhookSender,
  webhookDispatch = {},
  webhookRetryScheduleMs,
} = {}) {
  const app = Fastify({ logger: false });
  const dispatchConfig = normalizeWebhookDispatchConfig(webhookDispatch);
  const normalizedChainAdapter = normalizeChainAdapter(chainAdapter);
  const store = new ReferenceStore({
    dbPath,
    chainAdapter: normalizedChainAdapter,
    webhookRetryScheduleMs,
  });
  let dispatchTimer = null;
  let dispatchInFlight = false;

  app.decorate('store', store);
  app.decorate('chainAdapter', normalizedChainAdapter);
  app.decorate('webhookSender', webhookSender);
  app.decorate('dispatchDueWebhookDeliveries', async ({ limit, subscriptionId } = {}) =>
    store.dispatchPendingWebhookDeliveries({
      sender: app.webhookSender,
      limit: limit ?? dispatchConfig.batchSize,
      subscriptionId: subscriptionId ?? null,
    }),
  );

  app.addHook('onRequest', async (request, reply) => {
    reply.header('access-control-allow-origin', '*');
    reply.header(
      'access-control-allow-methods',
      'GET,POST,PUT,DELETE,OPTIONS',
    );
    reply.header(
      'access-control-allow-headers',
      'content-type, authorization',
    );

    if (request.method === 'OPTIONS') {
      reply.code(204).send();
    }
  });

  app.addHook('onReady', async () => {
    if (!dispatchConfig.enabled) {
      return;
    }

    dispatchTimer = setInterval(async () => {
      if (dispatchInFlight) {
        return;
      }

      dispatchInFlight = true;
      try {
        await app.dispatchDueWebhookDeliveries({
          limit: dispatchConfig.batchSize,
        });
      } catch (error) {
        app.log.error(error, 'background webhook dispatch failed');
      } finally {
        dispatchInFlight = false;
      }
    }, dispatchConfig.intervalMs);

    dispatchTimer.unref?.();
  });

  app.addHook('onClose', async () => {
    if (dispatchTimer) {
      clearInterval(dispatchTimer);
      dispatchTimer = null;
    }
    store.close();
  });

  registerHealthRoutes(app);
  registerTravelRuleRoutes(app);
  registerInstructionRoutes(app);
  registerExceptionRoutes(app);
  registerStatusRoutes(app);
  registerEventRoutes(app);
  registerWebhookRoutes(app);
  registerReportingRoutes(app);

  return app;
}
