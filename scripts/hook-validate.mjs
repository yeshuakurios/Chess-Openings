// PostToolUse hook: re-validate content when a content/*.json file was edited. Hook input arrives as JSON on stdin.
import { execSync } from 'node:child_process';
let raw = '';
process.stdin.on('data', d => (raw += d));
process.stdin.on('end', () => {
  let path = '';
  try { path = JSON.parse(raw).tool_input?.file_path ?? ''; } catch { /* not JSON */ }
  if (!/[\\/]content[\\/][^\\/]+\.json$/.test(path)) process.exit(0);
  try { execSync('npm run -s validate', { stdio: 'inherit' }); }
  catch { process.exit(2); } // exit 2 feeds the validation output back to Claude
});
