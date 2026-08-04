import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/mayama/.copilot/skills/azure-portal-screenshot/scripts/pw/node_modules/playwright-core');

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '..');
const evidenceDirectory = path.join(root, 'evidence');
const nodeExecutable = 'C:/Program Files/nodejs/node.exe';
const attack = '<img src=x onerror="document.body.dataset.benchmarkXss=failed">';

const runs = [
  { id: 'R1', url: 'http://127.0.0.1:8001/', start: null, storageKey: 'nova-tetris-ranking' },
  { id: 'R2', url: 'http://127.0.0.1:8002/', start: 'START', storageKey: 'lumen-fall-ranking-v1' },
  { id: 'R3', url: 'http://127.0.0.1:5173/', start: 'ゲーム開始', storageKey: 'cascade.ranking.v1' },
  { id: 'R4', url: 'http://127.0.0.1:5174/', start: 'ゲーム開始', storageKey: 'block_puzzle_scores' },
];

const servers = [
  spawn('py', ['-m', 'http.server', '8001', '--bind', '127.0.0.1', '--directory', path.join(root, 'trials', 'R1')], { stdio: 'ignore' }),
  spawn('py', ['-m', 'http.server', '8002', '--bind', '127.0.0.1', '--directory', path.join(root, 'trials', 'R2', 'dist')], { stdio: 'ignore' }),
  spawn(nodeExecutable, [path.join(root, 'trials', 'R3', 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '5173'], { cwd: path.join(root, 'trials', 'R3'), stdio: 'ignore' }),
  spawn(nodeExecutable, [path.join(root, 'trials', 'R4', 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '5174'], { cwd: path.join(root, 'trials', 'R4'), stdio: 'ignore' }),
];

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let browser;

try {
  await mkdir(evidenceDirectory, { recursive: true });
  await delay(1800);
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const results = [];

  for (const run of runs) {
    const pageErrors = [];
    const onPageError = (error) => pageErrors.push(error.message);
    page.on('pageerror', onPageError);
    await page.goto(run.url, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });

    let startClick = 'automatic';
    if (run.start) {
      try {
        await page.getByRole('button', { name: run.start, exact: true }).click({ timeout: 3000 });
        startClick = 'success';
      }
      catch (error) {
        startClick = `failed: ${error.message.split('\n')[0]}`;
      }
    }

    await page.evaluate(({ key, payload }) => localStorage.setItem(key, JSON.stringify([{ name: payload, score: 10, lines: 1, level: 1, date: 'x', at: 1 }])), { key: run.storageKey, payload: attack });
    await page.reload({ waitUntil: 'networkidle' });
    const xssMarker = await page.evaluate(() => document.body.dataset.benchmarkXss ?? null);

    await page.evaluate(({ key }) => localStorage.setItem(key, '{}'), { key: run.storageKey });
    await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
    await delay(100);
    const bodyTextLength = await page.locator('body').innerText().then((text) => text.length).catch(() => 0);
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }));

    results.push({
      id: run.id,
      startClick,
      xssMarker,
      malformedStorageRendered: bodyTextLength > 0,
      pageErrors,
      dimensions,
    });
    page.off('pageerror', onPageError);
  }

  await writeFile(path.join(evidenceDirectory, 'browser-validation.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  await context.close();
  console.log(JSON.stringify(results, null, 2));
}
finally {
  if (browser) await browser.close();
  for (const server of servers) {
    if (!server.killed) server.kill();
  }
}
