import {
  formatValidationErrors,
  validateInvestigationCaseSearchQuery,
  validateInvestigationCaseSubmission,
  validateInvestigationCaseUpdate,
  validateReturnCaseSearchQuery,
  validateReturnCaseSubmission,
  validateReturnCaseUpdate,
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

async function resolveInstructionReference(store, {
  instructionId = null,
  uetr = null,
  instructionField = 'related_instruction_id',
  uetrField = 'related_uetr',
} = {}) {
  const byInstructionId = instructionId ? await store.getInstructionAsync(instructionId) : null;
  const byUetr = uetr ? await store.findInstructionByUetrAsync(uetr) : null;

  if (instructionId && !byInstructionId) {
    return {
      error: {
        error: 'invalid_reference',
        message: `${instructionField} does not reference a known instruction.`,
      },
    };
  }

  if (uetr && !byUetr) {
    return {
      error: {
        error: 'invalid_reference',
        message: `${uetrField} does not reference a known instruction.`,
      },
    };
  }

  if (
    byInstructionId &&
    byUetr &&
    byInstructionId.instruction_id !== byUetr.instruction_id
  ) {
    return {
      error: {
        error: 'invalid_reference',
        message: `${instructionField} and ${uetrField} must reference the same instruction.`,
      },
    };
  }

  return {
    instruction: byInstructionId ?? byUetr ?? null,
  };
}

function sendReferenceError(reply, payload) {
  return reply.code(400).send(payload);
}

function sendDomainError(reply, error) {
  if (error?.code === 'CONFLICT') {
    return reply.code(409).send({
      error: 'invalid_state',
      message: error.message,
    });
  }

  if (error?.code === 'INVALID_REQUEST') {
    return reply.code(400).send({
      error: 'invalid_request',
      message: error.message,
    });
  }

  throw error;
}

function resolveExceptionReportingReferences(store, {
  instructionId,
  affectedNotificationIds,
  affectedStatementIds,
} = {}) {
  const normalizedNotificationIds = Array.isArray(affectedNotificationIds)
    ? Array.from(new Set(affectedNotificationIds.filter(Boolean)))
    : undefined;
  const normalizedStatementIds = Array.isArray(affectedStatementIds)
    ? Array.from(new Set(affectedStatementIds.filter(Boolean)))
    : undefined;

  if (normalizedNotificationIds) {
    for (const notificationId of normalizedNotificationIds) {
      const notification = store.getReportingNotification(notificationId);
      if (!notification) {
        return {
          error: {
            error: 'invalid_reference',
            message: `affected_notification_ids contains unknown notification_id ${notificationId}.`,
          },
        };
      }
      if (notification.instruction_id !== instructionId) {
        return {
          error: {
            error: 'invalid_reference',
            message:
              'affected_notification_ids must reference reporting records for the same underlying instruction.',
          },
        };
      }
    }
  }

  if (normalizedStatementIds) {
    for (const statementId of normalizedStatementIds) {
      const statement = store.getReportingStatement(statementId);
      if (!statement) {
        return {
          error: {
            error: 'invalid_reference',
            message: `affected_statement_ids contains unknown statement_id ${statementId}.`,
          },
        };
      }
      if (statement.instruction_id !== instructionId) {
        return {
          error: {
            error: 'invalid_reference',
            message:
              'affected_statement_ids must reference reporting records for the same underlying instruction.',
          },
        };
      }
    }
  }

  return {
    affected_notification_ids: normalizedNotificationIds,
    affected_statement_ids: normalizedStatementIds,
  };
}

export function registerExceptionRoutes(app) {
  app.post('/exceptions/investigations', async (request, reply) => {
    const errors = validateInvestigationCaseSubmission(request.body);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    const reference = await resolveInstructionReference(app.store, {
      instructionId: request.body.related_instruction_id,
      uetr: request.body.related_uetr,
      instructionField: 'related_instruction_id',
      uetrField: 'related_uetr',
    });
    if (reference.error) {
      return sendReferenceError(reply, reference.error);
    }

    let linkedReturnCase = null;
    if (request.body.linked_return_case_id) {
      linkedReturnCase = app.store.getReturnCase(request.body.linked_return_case_id);
      if (!linkedReturnCase) {
        return sendReferenceError(reply, {
          error: 'invalid_reference',
          message: 'linked_return_case_id does not reference a known return case.',
        });
      }
      if (
        linkedReturnCase.related_instruction_id !==
        reference.instruction.instruction_id
      ) {
        return sendReferenceError(reply, {
          error: 'invalid_reference',
          message: 'linked_return_case_id must reference the same underlying instruction.',
        });
      }
    }

    const reportingReferences = resolveExceptionReportingReferences(app.store, {
      instructionId: reference.instruction.instruction_id,
      affectedNotificationIds: request.body.affected_notification_ids,
      affectedStatementIds: request.body.affected_statement_ids,
    });
    if (reportingReferences.error) {
      return sendReferenceError(reply, reportingReferences.error);
    }

    const investigation = app.store.createInvestigationCase({
      ...request.body,
      ...reportingReferences,
    }, {
      instruction: reference.instruction,
      linkedReturnCase,
    });
    return reply.code(201).send(investigation);
  });

  app.patch('/exceptions/investigations/:caseId', async (request, reply) => {
    const errors = validateInvestigationCaseUpdate(request.body);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    const existing = app.store.getInvestigationCase(request.params.caseId);
    if (!existing) {
      return sendNotFound(reply, 'Investigation case');
    }

    let linkedReturnCase = null;
    if (request.body.linked_return_case_id) {
      linkedReturnCase = app.store.getReturnCase(request.body.linked_return_case_id);
      if (!linkedReturnCase) {
        return sendReferenceError(reply, {
          error: 'invalid_reference',
          message: 'linked_return_case_id does not reference a known return case.',
        });
      }
      if (
        linkedReturnCase.related_instruction_id !== existing.related_instruction_id
      ) {
        return sendReferenceError(reply, {
          error: 'invalid_reference',
          message: 'linked_return_case_id must reference the same underlying instruction.',
        });
      }
    }

    const reportingReferences = resolveExceptionReportingReferences(app.store, {
      instructionId: existing.related_instruction_id,
      affectedNotificationIds: request.body.affected_notification_ids,
      affectedStatementIds: request.body.affected_statement_ids,
    });
    if (reportingReferences.error) {
      return sendReferenceError(reply, reportingReferences.error);
    }

    try {
      return app.store.updateInvestigationCase(
        request.params.caseId,
        {
          ...request.body,
          ...reportingReferences,
        },
        {
          linkedReturnCase,
        },
      );
    } catch (error) {
      return sendDomainError(reply, error);
    }
  });

  app.get('/exceptions/investigations', async (request, reply) => {
    const errors = validateInvestigationCaseSearchQuery(request.query);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    return app.store.listInvestigationCases(request.query);
  });

  app.get('/exceptions/investigations/:caseId', async (request, reply) => {
    const investigation = app.store.getInvestigationCase(request.params.caseId);
    if (!investigation) {
      return sendNotFound(reply, 'Investigation case');
    }

    return investigation;
  });

  app.post('/exceptions/returns', async (request, reply) => {
    const errors = validateReturnCaseSubmission(request.body);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    const reference = await resolveInstructionReference(app.store, {
      instructionId: request.body.original_instruction_id,
      uetr: request.body.original_uetr,
      instructionField: 'original_instruction_id',
      uetrField: 'original_uetr',
    });
    if (reference.error) {
      return sendReferenceError(reply, reference.error);
    }

    if (reference.instruction.status !== 'FINAL') {
      return sendReferenceError(reply, {
        error: 'invalid_state',
        message: 'Return cases can only be opened for instructions in FINAL status.',
      });
    }

    if (
      request.body.compensating_instruction_id &&
      !(await app.store.getInstructionAsync(request.body.compensating_instruction_id))
    ) {
      return sendReferenceError(reply, {
        error: 'invalid_reference',
        message: 'compensating_instruction_id does not reference a known instruction.',
      });
    }

    let linkedInvestigationCase = null;
    if (request.body.linked_investigation_case_id) {
      linkedInvestigationCase = app.store.getInvestigationCase(
        request.body.linked_investigation_case_id,
      );
      if (!linkedInvestigationCase) {
        return sendReferenceError(reply, {
          error: 'invalid_reference',
          message: 'linked_investigation_case_id does not reference a known investigation case.',
        });
      }
      if (
        linkedInvestigationCase.related_instruction_id !==
        reference.instruction.instruction_id
      ) {
        return sendReferenceError(reply, {
          error: 'invalid_reference',
          message: 'linked_investigation_case_id must reference the same underlying instruction.',
        });
      }
    }

    const reportingReferences = resolveExceptionReportingReferences(app.store, {
      instructionId: reference.instruction.instruction_id,
      affectedNotificationIds: request.body.affected_notification_ids,
      affectedStatementIds: request.body.affected_statement_ids,
    });
    if (reportingReferences.error) {
      return sendReferenceError(reply, reportingReferences.error);
    }

    const returnCase = app.store.createReturnCase({
      ...request.body,
      ...reportingReferences,
    }, {
      instruction: reference.instruction,
      linkedInvestigationCase,
    });
    return reply.code(201).send(returnCase);
  });

  app.patch('/exceptions/returns/:returnCaseId', async (request, reply) => {
    const errors = validateReturnCaseUpdate(request.body);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    const existing = app.store.getReturnCase(request.params.returnCaseId);
    if (!existing) {
      return sendNotFound(reply, 'Return case');
    }

    let linkedInvestigationCase = null;
    if (request.body.linked_investigation_case_id) {
      linkedInvestigationCase = app.store.getInvestigationCase(
        request.body.linked_investigation_case_id,
      );
      if (!linkedInvestigationCase) {
        return sendReferenceError(reply, {
          error: 'invalid_reference',
          message: 'linked_investigation_case_id does not reference a known investigation case.',
        });
      }
      if (
        linkedInvestigationCase.related_instruction_id !== existing.related_instruction_id
      ) {
        return sendReferenceError(reply, {
          error: 'invalid_reference',
          message: 'linked_investigation_case_id must reference the same underlying instruction.',
        });
      }
    }

    if (
      request.body.compensating_instruction_id &&
      !(await app.store.getInstructionAsync(request.body.compensating_instruction_id))
    ) {
      return sendReferenceError(reply, {
        error: 'invalid_reference',
        message: 'compensating_instruction_id does not reference a known instruction.',
      });
    }

    const reportingReferences = resolveExceptionReportingReferences(app.store, {
      instructionId: existing.related_instruction_id,
      affectedNotificationIds: request.body.affected_notification_ids,
      affectedStatementIds: request.body.affected_statement_ids,
    });
    if (reportingReferences.error) {
      return sendReferenceError(reply, reportingReferences.error);
    }

    try {
      return app.store.updateReturnCase(
        request.params.returnCaseId,
        {
          ...request.body,
          ...reportingReferences,
        },
        {
          linkedInvestigationCase,
        },
      );
    } catch (error) {
      return sendDomainError(reply, error);
    }
  });

  app.get('/exceptions/returns', async (request, reply) => {
    const errors = validateReturnCaseSearchQuery(request.query);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    return app.store.listReturnCases(request.query);
  });

  app.get('/exceptions/returns/:returnCaseId', async (request, reply) => {
    const returnCase = app.store.getReturnCase(request.params.returnCaseId);
    if (!returnCase) {
      return sendNotFound(reply, 'Return case');
    }

    return returnCase;
  });
}
