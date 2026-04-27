import {
  formatValidationErrors,
  validateReportIntradayQuery,
  validateReportQuery,
  validateReportSearchQuery,
  validateReportStatementQuery,
  validateReportStatsQuery,
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

function extractWalletAddressFromAccount(account) {
  return account?.identification?.proxy?.identification ?? null;
}

function extractChainDliFromAccount(account) {
  const proprietary = account?.type?.proprietary ?? null;
  if (typeof proprietary !== 'string') {
    return null;
  }

  return proprietary.startsWith('DLID/') ? proprietary.slice(5) : proprietary;
}

function mapCreditDebitIndicatorToEntryType(value) {
  if (value === 'DBIT') {
    return 'DEBIT';
  }
  if (value === 'CRDT') {
    return 'CREDIT';
  }
  return null;
}

function normalizeReportFilters(query = {}) {
  return {
    instruction_id: query.instruction_id ?? null,
    uetr: query.uetr ?? null,
    travel_rule_record_id: query.travel_rule_record_id ?? null,
    wallet_address: query.wallet_address ?? null,
    chain_dli: query.chain_dli ?? null,
    token_dti: query.token_dti ?? null,
    counterparty_wallet: query.counterparty_wallet ?? null,
    transaction_hash: query.transaction_hash ?? null,
    booked_from: query.from_date_time ?? query.booked_from ?? null,
    booked_to: query.to_date_time ?? query.booked_to ?? null,
    entry_status: query.entry_status ?? null,
    entry_type:
      mapCreditDebitIndicatorToEntryType(query.credit_debit_indicator) ??
      query.entry_type ??
      null,
    finality_status: query.finality_status ?? null,
    amount_min: query.amount_min ?? null,
    amount_max: query.amount_max ?? null,
    group_by: query.group_by ?? null,
    page_size: query.page_size ?? null,
    cursor: query.after ?? query.cursor ?? null,
    sort: query.sort ?? null,
  };
}

function normalizeStatementFilters(query = {}) {
  return {
    wallet_address: query.wallet_address ?? null,
    chain_dli: query.chain_dli ?? null,
    token_dti: query.token_dti ?? null,
    statement_date_from: query.from_date ?? null,
    statement_date_to: query.to_date ?? null,
    booked_from: query.from_date ? `${query.from_date}T00:00:00Z` : null,
    booked_to: query.to_date ? `${query.to_date}T23:59:59.999Z` : null,
    page_size: query.page_size ?? null,
    cursor: query.after ?? query.cursor ?? null,
    sort: query.sort ?? null,
  };
}

export function registerReportingRoutes(app) {
  app.post('/report/query', async (request, reply) => {
    const errors = validateReportQuery(request.body);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    const walletAddress = extractWalletAddressFromAccount(request.body.account);
    const chainDli = extractChainDliFromAccount(request.body.account);
    const tokenDti = request.body.token_filter?.[0]?.token_dti ?? null;
    const queryFilters = {
      wallet_address: walletAddress,
      chain_dli: chainDli,
      token_dti: tokenDti,
      booked_from: request.body.reporting_period?.from_date_time ?? null,
      booked_to: request.body.reporting_period?.to_date_time ?? null,
      entry_status: Array.isArray(request.body.entry_status_filter)
        ? request.body.entry_status_filter.join(',')
        : null,
    };

    switch (request.body.query_type) {
      case 'BALANCE':
        return reply.code(201).send({
          query_identification: request.body.query_identification,
          query_type: request.body.query_type,
          balances: app.store.getReportBalanceResponse(queryFilters),
        });

      case 'INTRADAY':
        return reply.code(201).send({
          query_identification: request.body.query_identification,
          query_type: request.body.query_type,
          intraday_report: app.store.getSpecIntradayReport(queryFilters),
        });

      case 'STATEMENT': {
        const statement = app.store.getSpecStatementReport({
          wallet_address: walletAddress,
          chain_dli: chainDli,
          token_dti: tokenDti,
          statement_date_from:
            request.body.reporting_period?.from_date_time?.slice(0, 10) ?? null,
          statement_date_to:
            request.body.reporting_period?.to_date_time?.slice(0, 10) ?? null,
          booked_from: request.body.reporting_period?.from_date_time ?? null,
          booked_to: request.body.reporting_period?.to_date_time ?? null,
        });
        if (!statement) {
          return sendNotFound(reply, 'Wallet statement');
        }

        if (request.body.callback_url) {
          app.store.createReportStatementCallback({
            callbackUrl: request.body.callback_url,
            queryIdentification: request.body.query_identification,
            walletAddress,
            chainDli,
            statement,
          });

          return reply.code(202).send({
            query_identification: request.body.query_identification,
            message:
              'Statement will be delivered asynchronously to the provided callback_url.',
          });
        }

        return reply.code(201).send({
          query_identification: request.body.query_identification,
          query_type: request.body.query_type,
          statement,
        });
      }

      case 'NOTIFICATION_SUBSCRIBE': {
        const result = app.store.createReportNotificationSubscription({
          callbackUrl: request.body.callback_url,
          walletAddress,
          chainDli,
          queryIdentification: request.body.query_identification,
        });

        if (result.duplicate) {
          return reply.code(409).send({
            subscription_id: result.subscription.subscription_id,
            message:
              'An active subscription already exists for this account and callback URL.',
          });
        }

        return reply.code(201).send({
          query_identification: request.body.query_identification,
          query_type: request.body.query_type,
          subscription_id: result.subscription.subscription_id,
          subscription_status: 'ACTIVE',
        });
      }

      case 'NOTIFICATION_UNSUBSCRIBE': {
        const cancelled = app.store.cancelReportNotificationSubscription(
          request.body.subscription_id,
        );
        if (!cancelled) {
          return sendNotFound(reply, 'Notification subscription');
        }

        return reply.code(201).send({
          query_identification: request.body.query_identification,
          query_type: request.body.query_type,
          subscription_id: cancelled.subscription_id,
          subscription_status: 'CANCELLED',
        });
      }

      default:
        return reply.code(400).send({
          error: 'invalid_request',
          message: 'Unsupported query_type.',
        });
    }
  });

  app.get('/report/intraday', async (request, reply) => {
    const errors = validateReportIntradayQuery(request.query);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    return app.store.getSpecIntradayReport(normalizeReportFilters(request.query));
  });

  app.get('/report/statement', async (request, reply) => {
    const errors = validateReportStatementQuery(request.query);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    const statement = app.store.getSpecStatementReport(
      normalizeStatementFilters(request.query),
    );
    if (!statement) {
      return sendNotFound(reply, 'Wallet statement');
    }

    return statement;
  });

  app.get('/report/notification/:notificationId', async (request, reply) => {
    const notification = app.store.getSpecReportingNotification(
      request.params.notificationId,
    );
    if (!notification) {
      return sendNotFound(reply, 'Reporting notification');
    }

    return notification;
  });

  app.post('/report/notification/callback', async (_request, reply) => {
    return reply.code(501).send({
      error: 'not_implemented',
      message:
        'The bank-side notification callback endpoint is out of scope for the reference VASP server.',
    });
  });

  app.get('/report/search', async (request, reply) => {
    const errors = validateReportSearchQuery(request.query);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    return app.store.searchReportEntries(normalizeReportFilters(request.query));
  });

  app.get('/report/stats', async (request, reply) => {
    const errors = validateReportStatsQuery(request.query);
    if (errors.length) {
      return sendValidationError(reply, errors);
    }

    return app.store.getReportStats(normalizeReportFilters(request.query));
  });

  app.get('/reporting/notifications', async (request) => {
    return app.store.listReportingNotifications(request.query);
  });

  app.get('/reporting/notifications/:notificationId', async (request, reply) => {
    const notification = app.store.getReportingNotification(
      request.params.notificationId,
    );
    if (!notification) {
      return sendNotFound(reply, 'Reporting notification');
    }

    return notification;
  });

  app.get('/reporting/intraday', async (request) => {
    return app.store.getIntradayReportingView(request.query);
  });

  app.get('/reporting/statements', async (request) => {
    return app.store.listReportingStatements(request.query);
  });

  app.get('/reporting/statements/:statementId', async (request, reply) => {
    const statement = app.store.getReportingStatement(request.params.statementId);
    if (!statement) {
      return sendNotFound(reply, 'Reporting statement');
    }

    return statement;
  });
}
