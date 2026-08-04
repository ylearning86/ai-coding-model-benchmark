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

const runs = [
  { id: 'R1', url: 'http://127.0.0.1:8001/' },
  { id: 'R2', url: 'http://127.0.0.1:8002/' },
  { id: 'R3', url: 'http://127.0.0.1:5173/' },
  { id: 'R4', url: 'http://127.0.0.1:5174/' },
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
  const metrics = [];

  for (const run of runs) {
    await page.goto(run.url, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });

    for (const viewport of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'mobile', width: 390, height: 844 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await delay(250);
      const size = await page.evaluate(() => ({
        innerWidth,
        innerHeight,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      }));
      const output = path.join(evidenceDirectory, `capture-${run.id}-${viewport.name}.png`);
      await page.screenshot({ path: output });
      metrics.push({ id: run.id, viewport: viewport.name, ...size, output });
    }
  }

  await writeFile(path.join(evidenceDirectory, 'browser-metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');
  await context.close();
  console.log(`Captured ${metrics.length} screenshots.`);
}
finally {
  if (browser) await browser.close();
  for (const server of servers) {
    if (!server.killed) server.kill();
  }
}
