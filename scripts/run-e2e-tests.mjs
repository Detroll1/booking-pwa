// Runs the Playwright suite. The mocked suite needs no backend; the live spec
// is opt-in via E2E_LIVE=1. Requires `npx playwright install chromium` once.
import {spawnSync} from 'node:child_process';

const args = ['playwright', 'test', '--config', 'playwright.config.ts', ...process.argv.slice(2)];
const result = spawnSync('npx', args, {stdio: 'inherit', shell: process.platform === 'win32'});
process.exit(result.status ?? 1);
