import {
  formatValidationErrors,
  validateWebhookDispatchRequest,
  validateWebhookSubscriptionSubmission,
} from '../validators.js';

function sendValidationError(reply, errors) {
  return reply.code(400).send({
    error: 'invalid_request',
    code: 'INVALID_REQUEST',
    message: 'Request validation failed.',
    details: formatValidationErrors(errors),
  });
}

function sendNotFound(reply, resourceName) {
  return reply.code(404).send({
    error: 'not_found',
    message: `${resourceName} not found.`,
  });
}

export function registerWebhookRoutes(app) {
  app.post('/webhook-endpoints', async (request, reply) => {
    const errors = validateWebhookSubscriptionSubmission(request.body);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    const subscription = app.store.createWebhookSubscription(request.body);
    return reply.code(201).send(subscription);
  });

  app.get('/webhook-endpoints', async () => {
    return app.store.listWebhookSubscriptions();
  });

  app.get('/webhook-endpoints/:subscriptionId/deliveries', async (request, reply) => {
    const subscription = app.store.getWebhookSubscription(request.params.subscriptionId);
    if (!subscription) {
      return sendNotFound(reply, 'Webhook subscription');
    }

    return app.store.listWebhookDeliveries({
      ...request.query,
      subscription_id: request.params.subscriptionId,
    });
  });

  app.get('/webhook-endpoints/:subscriptionId', async (request, reply) => {
    const subscription = app.store.getWebhookSubscription(request.params.subscriptionId);
    if (!subscription) {
      return sendNotFound(reply, 'Webhook subscription');
    }

    return subscription;
  });

  app.get('/webhook-deliveries', async (request) => {
    return app.store.listWebhookDeliveries(request.query);
  });

  app.get('/webhook-deliveries/stats', async (request) => {
    return app.store.getWebhookDeliveryStats(request.query);
  });

  app.get('/webhook-deliveries/dead-letter', async (request) => {
    return app.store.listDeadLetterWebhookDeliveries(request.query);
  });

  app.get('/webhook-deliveries/:deliveryId', async (request, reply) => {
    const delivery = app.store.getWebhookDelivery(request.params.deliveryId);
    if (!delivery) {
      return sendNotFound(reply, 'Webhook delivery');
    }

    return delivery;
  });

  app.post('/webhook-deliveries/dispatch', async (request, reply) => {
    const errors = validateWebhookDispatchRequest(request.body);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    const result = await app.dispatchDueWebhookDeliveries({
      limit: request.body?.limit,
      subscriptionId: request.body?.subscription_id ?? null,
    });

    return reply.code(200).send(result);
  });
}
