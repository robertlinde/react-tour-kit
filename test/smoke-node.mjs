// Packs the library like `npm publish` would, installs the tarball into a temporary project and
// imports the web entry with plain Node ESM (no bundler), including a server render. This guards
// against the 0.x packaging bugs (directory imports, `require` in ESM, broken `exports`).
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = mkdtempSync(path.join(tmpdir(), 'rtk-smoke-'));
try {
  execFileSync('npm', ['pack', '--pack-destination', work, '--ignore-scripts'], {cwd: root, stdio: 'ignore'});
  const tarball = readdirSync(work).find((file) => file.endsWith('.tgz'));
  writeFileSync(path.join(work, 'package.json'), JSON.stringify({name: 'smoke', private: true, type: 'module'}));
  execFileSync(
    'npm',
    ['install', '--no-audit', '--no-fund', '--ignore-scripts', path.join(work, tarball), 'react@19', 'react-dom@19'],
    {cwd: work, stdio: 'ignore'},
  );
  writeFileSync(
    path.join(work, 'smoke.mjs'),
    `import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import {TourProvider, useTour, getTruncatedDots} from '@robertlinde/react-tour-kit/react';
if (typeof TourProvider !== 'function' || typeof useTour !== 'function' || typeof getTruncatedDots !== 'function') {
  throw new Error('Missing exports');
}
const html = renderToString(createElement(TourProvider, null, createElement('main', null, 'ok')));
if (html !== '<main>ok</main>') throw new Error('Unexpected SSR output: ' + html);
console.log('Node ESM import and server render: OK');
`,
  );
  execFileSync('node', ['smoke.mjs'], {cwd: work, stdio: 'inherit'});
} finally {
  rmSync(work, {recursive: true, force: true});
}
