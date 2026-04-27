import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(moduleDir, '..');
const defaultRunsRoot = resolve(projectRoot, 'data', 'demo-runs');

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

async function readJson(targetPath) {
  const raw = await readFile(targetPath, 'utf8');
  return JSON.parse(raw);
}

async function findLatestRunDir(runsRoot) {
  const entries = await readdir(runsRoot, { withFileTypes: true });
  const directories = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const targetPath = resolve(runsRoot, entry.name);
    const targetStat = await stat(targetPath);
    directories.push({
      name: entry.name,
      path: targetPath,
      modifiedMs: targetStat.mtimeMs,
    });
  }

  directories.sort((left, right) => right.modifiedMs - left.modifiedMs);
  return directories[0]?.path ?? null;
}

function formatMaybe(value, fallback = 'n/a') {
  return hasText(value) ? value : fallback;
}

function buildEvidenceMarkdown({
  runDir,
  summary,
  finalityReceipt,
  executionStatus,
  notificationDetail,
  statementDetail,
}) {
  const lines = [
    '# Reviewer Evidence Summary',
    '',
    `Run: \`${summary.run_id ?? basename(runDir)}\``,
    '',
    '## Evidence',
    '',
    `- Final status: \`${formatMaybe(summary.final_status)}\``,
    `- Instruction ID: \`${formatMaybe(summary.instruction_id)}\``,
    `- UETR: \`${formatMaybe(summary.uetr)}\``,
    `- Travel Rule record: \`${formatMaybe(summary.travel_rule_record_id)}\``,
    `- Transaction hash: \`${formatMaybe(summary.transaction_hash)}\``,
    `- Explorer: ${summary.transaction_explorer_url ?? 'n/a'}`,
    `- Finality status: \`${formatMaybe(summary.finality_status)}\``,
    `- Confirmation depth: \`${summary.confirmation_depth ?? 'n/a'} / ${summary.required_confirmation_depth ?? 'n/a'}\``,
    '',
    '## Reporting',
    '',
    `- Reporting notifications: \`${summary.reporting_notification_count ?? 'n/a'}\``,
    `- Reporting statements: \`${summary.reporting_statement_count ?? 'n/a'}\``,
    `- Notification ID: \`${formatMaybe(notificationDetail?.notification_id)}\``,
    `- Statement ID: \`${formatMaybe(statementDetail?.statement_id)}\``,
    '',
    '## What This Run Proves',
    '',
    '- Travel Rule, instruction, execution status, finality receipt, and reporting records all share the same identifiers.',
    '- A real or real-ready chain adapter path can surface transaction hash, confirmation depth, and finality without changing the API family.',
    '- Reporting is derived from the same payment record rather than being a disconnected explorer lookup.',
    '',
    '## Key Fields',
    '',
    `- Execution status latest state: \`${formatMaybe(executionStatus?.status)}\``,
    `- Finality receipt observed at: \`${formatMaybe(finalityReceipt?.observed_at)}\``,
    `- Finality receipt final at: \`${formatMaybe(finalityReceipt?.final_at)}\``,
    `- Reporting account wallet: \`${formatMaybe(notificationDetail?.account?.identification?.proxy?.identification)}\``,
    `- Reporting entry status: \`${formatMaybe(notificationDetail?.entry?.entry_status)}\``,
    '',
    '## Artifact Files',
    '',
    '- `20-summary.json`',
    '- `11-execution-status.final.response.json`',
    '- `13-finality-receipt.response.json`',
    '- `15-reporting-notification.detail.response.json`',
    '- `17-reporting-statement.detail.response.json`',
    '',
    `Generated from: \`${runDir}\``,
    '',
  ];

  return `${lines.join('\n')}`;
}

async function main() {
  const explicitRunDir = process.argv[2];
  const envRunDir = process.env.REF_SERVER_DEMO_RUN_DIR;
  const runsRoot = resolve(
    process.env.REF_SERVER_DEMO_OUTPUT_DIR ?? defaultRunsRoot,
  );
  const runDir = explicitRunDir
    ? resolve(explicitRunDir)
    : hasText(envRunDir)
      ? resolve(envRunDir)
      : await findLatestRunDir(runsRoot);

  if (!runDir) {
    throw new Error('No demo run directory found.');
  }

  const summary = await readJson(resolve(runDir, '20-summary.json'));
  const executionStatus = await readJson(
    resolve(runDir, '11-execution-status.final.response.json'),
  );
  const finalityReceipt = await readJson(
    resolve(runDir, '13-finality-receipt.response.json'),
  );

  let notificationDetail = null;
  try {
    notificationDetail = await readJson(
      resolve(runDir, '15-reporting-notification.detail.response.json'),
    );
  } catch {}

  let statementDetail = null;
  try {
    statementDetail = await readJson(
      resolve(runDir, '17-reporting-statement.detail.response.json'),
    );
  } catch {}

  const markdown = buildEvidenceMarkdown({
    runDir,
    summary,
    finalityReceipt,
    executionStatus,
    notificationDetail,
    statementDetail,
  });
  const outputPath = resolve(runDir, '21-reviewer-summary.md');
  await writeFile(outputPath, markdown, 'utf8');

  console.log(
    JSON.stringify(
      {
        run_dir: runDir,
        summary_file: resolve(runDir, '20-summary.json'),
        reviewer_summary_file: outputPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
