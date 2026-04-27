import {
  formatValidationErrors,
  validateTravelRuleCallback,
  validateTravelRuleSearchQuery,
  validateTravelRuleStatsQuery,
  validateTravelRuleSubmission,
} from '../validators.js';

function sendValidationError(reply, errors) {
  return reply.code(400).send({
    error: 'invalid_request',
    code: 'INVALID_REQUEST',
    message: 'Request validation failed.',
    details: formatValidationErrors(errors),
  });
}

export function registerTravelRuleRoutes(app) {
  app.post('/travel-rule', async (request, reply) => {
    const errors = validateTravelRuleSubmission(request.body);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    const record = app.store.createTravelRuleRecord(request.body);
    return reply.code(201).send(record);
  });

  app.get('/travel-rule/search', async (request, reply) => {
    const errors = validateTravelRuleSearchQuery(request.query);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }
    return app.store.searchTravelRuleResponse(request.query);
  });

  app.get('/travel-rule/stats', async (request, reply) => {
    const errors = validateTravelRuleStatsQuery(request.query);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    return app.store.getTravelRuleStats(request.query);
  });

  app.get('/travel-rule/:recordId', async (request, reply) => {
    const record = app.store.getTravelRuleRecord(request.params.recordId);
    if (!record) {
      return reply.code(404).send({
        error: 'not_found',
        message: 'Travel Rule record not found.',
      });
    }

    return record;
  });

  app.put('/travel-rule/:recordId', async (request, reply) => {
    const errors = validateTravelRuleSubmission(request.body);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    const record = app.store.updateTravelRuleRecord(
      request.params.recordId,
      request.body,
    );

    if (!record) {
      return reply.code(404).send({
        error: 'not_found',
        message: 'Travel Rule record not found.',
      });
    }

    return record;
  });

  app.post('/travel-rule/:recordId/callback', async (request, reply) => {
    const errors = validateTravelRuleCallback(request.body);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    try {
      const result = app.store.appendTravelRuleCallback(
        request.params.recordId,
        request.body,
      );

      if (!result) {
        return reply.code(404).send({
          error: 'not_found',
          message: 'Travel Rule record not found.',
        });
      }

      return result.receipt;
    } catch (error) {
      return reply.code(error.code === 'CONFLICT' ? 409 : 400).send({
        error: 'invalid_request',
        message: error.message,
      });
    }
  });
}
