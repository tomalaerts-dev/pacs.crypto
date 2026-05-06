import {
  formatValidationErrors,
  validateInstructionSearchQuery,
  validateInstructionSubmission,
  validateQuoteRequest,
  validateTomReturnRequest,
  validateTomReversalRequest,
} from '../validators.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendValidationError(reply, errors) {
  return reply.code(400).send({
    error: 'invalid_request',
    code: 'INVALID_REQUEST',
    message: 'Request validation failed.',
    details: formatValidationErrors(errors),
  });
}

function sendInvalidPathUuid(reply, field) {
  return reply.code(400).send({
    error: 'invalid_request',
    code: 'INVALID_REQUEST',
    message: `${field} must be a UUID.`,
    details: [{ field, issue: `${field} must be a UUID.` }],
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

  app.post('/instruction/:instructionId/return', async (request, reply) => {
    const { instructionId } = request.params;
    if (!UUID_PATTERN.test(instructionId)) {
      return sendInvalidPathUuid(reply, 'instructionId');
    }

    const errors = validateTomReturnRequest(request.body);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    const instruction = await app.store.getInstructionAsync(instructionId);
    if (!instruction) {
      return reply.code(404).send({
        error: 'not_found',
        code: 'INSTRUCTION_NOT_FOUND',
        message: 'Instruction not found.',
      });
    }

    if (instruction.status !== 'FINAL') {
      return reply.code(409).send({
        error: 'invalid_state',
        code: 'INSTRUCTION_NOT_FINAL',
        message: 'Return can only be requested for instructions in FINAL status.',
        current_status: instruction.status,
      });
    }

    const existing = app.store.findActiveTomCaseForInstruction(instructionId);
    if (existing) {
      return reply.code(409).send({
        error: 'invalid_state',
        code: 'ALREADY_RETURNED',
        message:
          'An active Tom-origin return or reversal already exists for this instruction.',
        existing_exception_type: existing.exception_type,
        existing_exception_case_id: existing.return_case_id,
      });
    }

    const { record } = await app.store.createTomReturnAsync(instruction, request.body);
    return reply.code(202).send(app.store.toTomReturnResponse(record));
  });

  app.post('/instruction/:instructionId/reverse', async (request, reply) => {
    const { instructionId } = request.params;
    if (!UUID_PATTERN.test(instructionId)) {
      return sendInvalidPathUuid(reply, 'instructionId');
    }

    const errors = validateTomReversalRequest(request.body);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    const instruction = await app.store.getInstructionAsync(instructionId);
    if (!instruction) {
      return reply.code(404).send({
        error: 'not_found',
        code: 'INSTRUCTION_NOT_FOUND',
        message: 'Instruction not found.',
      });
    }

    if (instruction.status !== 'FINAL') {
      return reply.code(409).send({
        error: 'invalid_state',
        code: 'INSTRUCTION_NOT_FINAL',
        message:
          'Reversal can only be requested for instructions in FINAL status.',
        current_status: instruction.status,
      });
    }

    const existing = app.store.findActiveTomCaseForInstruction(instructionId);
    if (existing) {
      return reply.code(409).send({
        error: 'invalid_state',
        code: 'ALREADY_RETURNED',
        message:
          'An active Tom-origin return or reversal already exists for this instruction.',
        existing_exception_type: existing.exception_type,
        existing_exception_case_id: existing.return_case_id,
      });
    }

    const record = app.store.createTomReversalRequest(instruction, request.body);
    return reply.code(202).send(app.store.toTomReversalResponse(record));
  });

  app.get('/instruction/:instructionId/reversal-status', async (request, reply) => {
    const { instructionId } = request.params;
    if (!UUID_PATTERN.test(instructionId)) {
      return sendInvalidPathUuid(reply, 'instructionId');
    }

    const instruction = await app.store.getInstructionAsync(instructionId);
    if (!instruction) {
      return reply.code(404).send({
        error: 'not_found',
        code: 'INSTRUCTION_NOT_FOUND',
        message: 'Instruction not found.',
      });
    }

    const reversal = app.store.getLatestReversalForInstruction(instructionId);
    if (!reversal) {
      return reply.code(404).send({
        error: 'not_found',
        code: 'REVERSAL_NOT_FOUND',
        message: 'No reversal request exists for this instruction.',
      });
    }

    return reply.code(200).send(app.store.toTomReversalStatusResponse(reversal));
  });
}
