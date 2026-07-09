function sendNotFound(reply, resourceName) {
  return reply.code(404).send({
    error: 'not_found',
    message: `${resourceName} not found.`,
  });
}

export function registerStatusRoutes(app) {
  app.get('/execution-status/:instructionId', async (request, reply) => {
    const instruction = await app.store.getInstructionAsync(request.params.instructionId);
    if (!instruction) {
      return sendNotFound(reply, 'Instruction execution status');
    }

    return app.store.toExecutionStatusResponse(instruction);
  });

  app.get('/execution-status/uetr/:uetr', async (request, reply) => {
    const instruction = await app.store.findInstructionByUetrAsync(request.params.uetr);
    if (!instruction) {
      return sendNotFound(reply, 'Instruction execution status');
    }

    return app.store.toExecutionStatusResponse(instruction);
  });

  app.get('/finality-receipt/:instructionId', async (request, reply) => {
    const instruction = await app.store.getInstructionAsync(request.params.instructionId);
    if (!instruction) {
      return sendNotFound(reply, 'Instruction finality receipt');
    }

    return app.store.toFinalityReceipt(instruction);
  });

  app.get('/finality-receipt/uetr/:uetr', async (request, reply) => {
    const instruction = await app.store.findInstructionByUetrAsync(request.params.uetr);
    if (!instruction) {
      return sendNotFound(reply, 'Instruction finality receipt');
    }

    return app.store.toFinalityReceipt(instruction);
  });
}
