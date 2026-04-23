import {
  formatValidationErrors,
  validateInstructionSearchQuery,
  validateInstructionSubmission,
  validateQuoteRequest,
} from '../validators.js';

function sendValidationError(reply, errors) {
  return reply.code(400).send({
    error: 'invalid_request',
    code: 'INVALID_REQUEST',
    message: 'Request validation failed.',
    details: formatValidationErrors(errors),
  });
}

export function registerInstructionRoutes(app) {
  app.post('/instruction/quote', async (request, reply) => {
    const errors = validateQuoteRequest(request.body);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    const quote = await app.store.createQuoteAsync(request.body);
    return reply.code(200).send(quote);
  });

  app.post('/instruction', async (request, reply) => {
    const errors = validateInstructionSubmission(request.body);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    const quoteId = request.body.payment_identification?.quote_id;
    if (quoteId) {
      const quote = app.store.getQuote(quoteId);
      if (!quote) {
        return reply.code(400).send({
          error: 'invalid_quote',
          message: 'Referenced quote_id was not found.',
        });
      }

      if (Date.parse(quote.valid_until) < Date.now()) {
        return reply.code(400).send({
          error: 'expired_quote',
          message: 'Referenced quote_id is no longer valid.',
        });
      }
    }

    const endToEndIdentification =
      request.body.payment_identification?.end_to_end_identification;
    if (endToEndIdentification) {
      const existing = await app.store.findInstructionByEndToEndIdAsync(endToEndIdentification);
      if (existing) {
        return reply.code(409).send({
          error: 'duplicate_instruction',
          instruction_id: existing.instruction_id,
          message:
            'Instruction already exists for this end_to_end_identification.',
        });
      }
    }

    const custodyModel =
      request.body.blockchain_instruction?.custody_model ??
      request.body.custody_model ??
      'FULL_CUSTODY';

    if (custodyModel === 'DELEGATED_SIGNING') {
      return reply.code(501).send({
        error: 'not_implemented',
        message: 'Delegated signing is not implemented in v0.',
      });
    }

    const travelRuleRecordId = request.body.travel_rule_record_id;
    if (travelRuleRecordId && !app.store.getTravelRuleRecord(travelRuleRecordId)) {
      return reply.code(400).send({
        error: 'invalid_reference',
        message: 'travel_rule_record_id does not reference a known record.',
      });
    }

    const instruction = await app.store.createInstructionAsync(request.body);
    return reply.code(201).send(app.store.toInstructionResponse(instruction));
  });

  app.delete('/instruction/:instructionId', async (request, reply) => {
    const result = await app.store.cancelInstructionAsync(request.params.instructionId);
    if (!result) {
      return reply.code(404).send({
        error: 'not_found',
        message: 'Instruction not found.',
      });
    }

    if (result.error === 'too_late') {
      return reply.code(409).send({
        error: 'cancellation_too_late',
        current_status: result.current.status,
        message: 'Instruction can only be cancelled in PENDING or QUOTED status.',
      });
    }

    return result.cancellation;
  });

  app.get('/instruction/:instructionId', async (request, reply) => {
    const instruction = await app.store.getInstructionAsync(request.params.instructionId);
    if (!instruction) {
      return reply.code(404).send({
        error: 'not_found',
        message: 'Instruction not found.',
      });
    }

    return app.store.toInstructionDetailResponse(instruction);
  });

  app.post('/instruction/:instructionId/signed-transaction', async (_request, reply) => {
    return reply.code(501).send({
      error: 'not_implemented',
      message: 'Delegated signing is not implemented in v0.',
    });
  });

  app.get('/instruction/search', async (request, reply) => {
    const errors = validateInstructionSearchQuery(request.query);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    return app.store.searchInstructionsAsync(request.query);
  });
}
