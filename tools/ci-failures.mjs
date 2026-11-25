// CI only: say which playtest checks failed, without having to open the log.
// Reads .playtest/report.json (the last playtest run) and writes an error annotation and the
// job summary. Annotations of a public repository can be read without signing in.
import fs from 'node:fs';

const FILE = '.playtest/report.json';
if (!fs.existsSync(FILE)) {
  console.log(`::error title=verify::Failed before the playtests wrote ${FILE} (types, unit tests or the build).`);
  process.exit(0);
}
const report = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const failed = report.checks.filter((c) => c.status === 'fail');
const cut = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);
const lines = failed.map((c) => `- ${cut(c.name.replace(/\s+/g, ' '), 140)} — ${cut(String(c.detail ?? '').replace(/\s+/g, ' '), 420)}`);
const head = `${report.summary.passed} passed, ${failed.length} failed, ${report.summary.warnings} warnings (fps ${JSON.stringify(report.fps ?? null)})`;

// GitHub shows at most 10 errors per step: put several failures into each.
const escape = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const PER = 8;
for (let i = 0; i < Math.min(lines.length, PER * 10); i += PER) {
  console.log(`::error title=playtest ${i + 1}-${Math.min(i + PER, lines.length)} of ${lines.length}::${escape(`${head}\n${lines.slice(i, i + PER).join('\n')}`)}`);
}
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Playtest\n\n${head}\n\n${lines.join('\n')}\n`);
