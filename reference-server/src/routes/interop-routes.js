import {
  travelRuleDataToIvms101,
  ivms101ToTravelRuleData,
} from '../interop/ivms101-mapping.js';
import {
  buildAccessCredential,
  verifyAccessCredential,
} from '../interop/trust-anchor.js';
import {
  buildComplianceRecord,
  emitFilings,
} from '../interop/compliance-reporting.js';
import { x402IntentToInstruction } from '../interop/x402-binding.js';
import {
  buildUnifiedLedgerPreSettlement,
  isSettlementReady,
} from '../interop/unified-ledger.js';

// HTTP exposure for the interoperability reference modules (Epics 19/21/22/23/24).
// These are stateless transform endpoints — no persistence — wrapping the pure
// modules so the directions are reachable over the wire, not just importable.

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function badRequest(reply, message) {
  return reply.code(400).send({ error: 'invalid_request', message });
}

export function registerInteropRoutes(app) {
  // Epic 19 — Travel Rule <-> IVMS101
  app.post('/interop/travel-rule/to-ivms101', async (request, reply) => {
    const data = request.body?.travel_rule_data ?? request.body;
    if (!isObject(data)) return badRequest(reply, 'travel_rule_data is required.');
    return travelRuleDataToIvms101(data);
  });

  app.post('/interop/travel-rule/from-ivms101', async (request, reply) => {
    const ivms = request.body?.ivms101 ?? request.body;
    if (!isObject(ivms)) return badRequest(reply, 'ivms101 is required.');
    return { travel_rule_data: ivms101ToTravelRuleData(ivms) };
  });

  // Epic 21 — Trust Anchor pool-access credentials
  app.post('/interop/access-credentials', async (request, reply) => {
    const { subject, ...options } = request.body ?? {};
    if (!isObject(subject)) return badRequest(reply, 'subject is required.');
    return buildAccessCredential(subject, options);
  });

  app.post('/interop/access-credentials/verify', async (request, reply) => {
    const { credential, policy } = request.body ?? {};
    if (!isObject(credential)) return badRequest(reply, 'credential is required.');
    return verifyAccessCredential(credential, policy ?? {});
  });

  // Epic 22 — Multi-regime compliance filings
  app.post('/interop/compliance-filings', async (request, reply) => {
    const { context, regimes } = request.body ?? {};
    if (!isObject(context)) return badRequest(reply, 'context is required.');
    const record = buildComplianceRecord(context);
    try {
      // A non-array `regimes` (e.g. JSON null) falls back to the default set.
      return { record, filings: emitFilings(record, Array.isArray(regimes) ? regimes : undefined) };
    } catch (error) {
      return badRequest(reply, error.message);
    }
  });

  // Epic 23 — x402 agent-intent binding
  app.post('/interop/x402/bind', async (request, reply) => {
    const { intent, resolvers } = request.body ?? {};
    if (!isObject(intent)) return badRequest(reply, 'intent is required.');
    return x402IntentToInstruction(intent, resolvers ?? {});
  });

  // Epic 24 — Unified-ledger pre-settlement (reference scaffold, gated)
  app.post('/interop/unified-ledger/pre-settlement', async (request, reply) => {
    const context = request.body?.context ?? request.body;
    if (!isObject(context)) return badRequest(reply, 'context is required.');
    const preSettlement = buildUnifiedLedgerPreSettlement(context);
    return { pre_settlement: preSettlement, readiness: isSettlementReady(preSettlement) };
  });
}
