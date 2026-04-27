export function registerHealthRoutes(app) {
  app.get('/health', async () => ({
    status: 'ok',
    service: 'pacs.crypto reference server',
    supported_flows: [
      'travel_rule_submission',
      'travel_rule_callback',
      'travel_rule_search',
      'instruction_quote',
      'instruction_submission',
      'instruction_status',
    ],
  }));
}
