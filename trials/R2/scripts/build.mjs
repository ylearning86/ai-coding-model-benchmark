import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/src', { recursive: true });
await Promise.all([
  cp('index.html', 'dist/index.html'),
  cp('styles.css', 'dist/styles.css'),
  cp('src/game.js', 'dist/src/game.js'),
  cp('src/app.js', 'dist/src/app.js')
]);
console.log('Built static application in dist/.');