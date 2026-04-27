function sendNotFound(reply, resourceName) {
  return reply.code(404).send({
    error: 'not_found',
    message: `${resourceName} not found.`,
  });
}

export function registerEventRoutes(app) {
  app.get('/event-outbox', async (request) => {
    return app.store.listOutboxEvents(request.query);
  });

  app.get('/event-outbox/:eventId', async (request, reply) => {
    const event = app.store.getOutboxEvent(request.params.eventId);
    if (!event) {
      return sendNotFound(reply, 'Event outbox record');
    }

    return event;
  });
}
