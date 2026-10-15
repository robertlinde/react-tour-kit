/**
 * Records the README's animated preview (.github/assets/demo.gif) and its still poster
 * (.github/assets/demo-poster.png) from the showcase in demos/react.
 *
 *   npm run demo:record
 *
 * Needs ffmpeg and gifski (`brew install ffmpeg gifski`) and the web demo's dependencies
 * (`npm install --prefix demos/react`). Run it again whenever the showcase or the tour's look changes.
 *
 * How: the showcase plays in a browser window drawn by scripts/demo-harness.html, with a pointer that
 * glides to Next and clicks. Chromium's screencast captures every painted frame with its timestamp;
 * ffmpeg turns them into a constant 20 fps sequence; gifski encodes the GIF, as small as it takes to
 * stay below GitHub's image proxy limit.
 */
import {Buffer} from 'node:buffer';
import {spawn, spawnSync, type SpawnSyncOptions} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir, mkdtemp, readdir, rm, stat, writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {type Browser, chromium, type FrameLocator} from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const demo = path.join(root, 'demos/react');
const assets = path.join(root, '.github/assets');
const harness = path.join(root, 'scripts/demo-harness.html');

/** The stage in CSS pixels, drawn at 1.5× (a 1440 px GIF), so text stays crisp on high-density screens. */
const stageSize = {width: 960, height: 600};
const scale = 1.5;
const fps = 20;
/** GitHub's image proxy has failed on GIFs of about 6 MB. */
const maxBytes = 4.5 * 1024 * 1024;
/** How long each step is on screen, from settled until the click on Next. */
const dwellMs = 2200;
const glideMs = 550;
/** How long the last frame stays; the GIF then loops to the first, which looks the same. */
const outroMs = 400;
/** Where the pointer waits, in stage coordinates: over plain content, so nothing shows a hover state. */
const rest = {x: 600, y: 470};
/** The steps' titles (a dialog's name matches when it contains the title). */
const titles = [
  'Welcome to Acme',
  'Find anything',
  'Start something new',
  'Stay in the loop',
  'Bring your team',
  'Help is always here',
];

type Point = {readonly x: number; readonly y: number};
type Rect = {readonly left: number; readonly top: number; readonly width: number; readonly height: number};
type CapturedFrame = {readonly file: string; readonly time: number};

function run(command: string, args: string[], options: SpawnSyncOptions = {}): void {
  const result = spawnSync(command, args, {stdio: 'inherit', ...options});
  if (result.status !== 0) {
    throw new Error(`Failed: ${command} ${args.slice(0, 6).join(' ')}…`);
  }
}

function requireTools(): void {
  const missing = ['ffmpeg', 'gifski'].filter((tool) => spawnSync(tool, ['-h'], {stdio: 'ignore'}).error);
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(' and ')}. Install the recording tools with: brew install ffmpeg gifski`);
  }

  if (!existsSync(path.join(demo, 'node_modules/.bin/vite'))) {
    throw new Error('The web demo is not installed. Run: npm install --prefix demos/react');
  }
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === 'object' && address) {
          resolve(address.port);
        } else {
          reject(new Error('No free port'));
        }
      });
    });
  });
}

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Not listening yet.
    }

    // eslint-disable-next-line no-await-in-loop
    await sleep(200);
  }

  throw new Error(`The showcase preview did not start at ${url}`);
}

function rectOf(element: Element): Rect {
  const {left, top, width, height} = element.getBoundingClientRect();
  return {left, top, width, height};
}

/**
 * Opens the stage. Positions are in stage CSS pixels (the pointer's, and the showcase's own, offset by the
 * iframe's origin); the mouse moves in page pixels, `scale` times as many. Playwright's `boundingBox()`
 * and `click()` cannot be used inside the showcase: they do not account for the scale inside the iframe.
 */
async function openStage(browser: Browser, url: string, pointerAt?: Point) {
  const page = await browser.newPage({viewport: {width: stageSize.width * scale, height: stageSize.height * scale}});
  const parameters = new URLSearchParams({scale: String(scale), src: url});
  if (pointerAt) {
    parameters.set('x', String(pointerAt.x));
    parameters.set('y', String(pointerAt.y));
  }

  await page.goto(`${pathToFileURL(harness).href}?${parameters.toString()}`);
  const app = page.frameLocator('iframe');
  await app.locator('[data-tour="search"]').waitFor();
  const frame = await page.locator('iframe').evaluate(rectOf);
  const origin = {x: frame.left / scale, y: frame.top / scale};

  // The pointer, drawn by the stage page (`stage` there).
  const pointer = {
    async move({x, y}: Point, duration: number) {
      await page.evaluate(`stage.move(${x}, ${y}, ${duration})`);
    },
    async press() {
      await page.evaluate('stage.press()');
    },
  };
  const mouse = {
    async move({x, y}: Point) {
      await page.mouse.move(x * scale, y * scale);
    },
    async click({x, y}: Point) {
      await page.mouse.click(x * scale, y * scale);
    },
  };

  /** Where the pointer clicks `name`: a little right of and below its centre, like a hand would. */
  async function buttonPoint(name: string): Promise<Point> {
    const box = await app.getByRole('button', {name, exact: true}).evaluate(rectOf);
    return {
      x: Math.round(origin.x + box.left + box.width * 0.55),
      y: Math.round(origin.y + box.top + box.height * 0.6),
    };
  }

  return {page, app, pointer, mouse, buttonPoint};
}

/** Waits until the step titled `title` is on screen and its entrance animation is over. */
async function settled(app: FrameLocator, title: string): Promise<void> {
  await app.getByRole('dialog', {name: title}).waitFor({timeout: 10_000});
  await app.locator('[data-rtk-tooltip]:not([data-hidden]):not([data-entering])').waitFor({timeout: 10_000});
}

/**
 * Plays the tour with the pointer while Chromium's screencast captures every painted frame. Returns the
 * frames, and when continuous animations started (each click, and the pointer's way back at the end).
 */
async function record(browser: Browser, url: string, rawDirectory: string) {
  const {page, app, pointer, mouse, buttonPoint} = await openStage(browser, url, rest);
  await mouse.move(rest);
  // The screencast starts with the last painted frame: make sure that one is complete.
  await page.evaluate('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');

  const frames: CapturedFrame[] = [];
  const writes: Array<Promise<void>> = [];
  const cdp = await page.context().newCDPSession(page);
  cdp.on('Page.screencastFrame', (event) => {
    const file = path.join(rawDirectory, `${String(frames.length).padStart(5, '0')}.png`);
    frames.push({file, time: (event.metadata.timestamp ?? Date.now() / 1000) * 1000});
    writes.push(writeFile(file, Buffer.from(event.data, 'base64')));
    void cdp.send('Page.screencastFrameAck', {sessionId: event.sessionId});
  });
  await cdp.send('Page.startScreencast', {format: 'png'});

  // The tour starts by itself, a moment after the showcase has loaded.
  const animations: number[] = [];
  for (const [index, title] of titles.entries()) {
    // eslint-disable-next-line no-await-in-loop
    await settled(app, title);
    const settledAt = Date.now();
    // eslint-disable-next-line no-await-in-loop
    const target = await buttonPoint(index === titles.length - 1 ? 'Finish' : 'Next');
    // eslint-disable-next-line no-await-in-loop
    await sleep(Math.max(0, settledAt + dwellMs - glideMs - Date.now()));
    // eslint-disable-next-line no-await-in-loop
    await pointer.move(target, glideMs);
    // eslint-disable-next-line no-await-in-loop
    await mouse.move(target);
    // eslint-disable-next-line no-await-in-loop
    await sleep(100);
    animations.push(Date.now());
    // eslint-disable-next-line no-await-in-loop
    await pointer.press();
    // eslint-disable-next-line no-await-in-loop
    await mouse.click(target);
  }

  await app.locator('[data-rtk-root]').waitFor({state: 'detached', timeout: 10_000});
  await sleep(250);
  animations.push(Date.now());
  await pointer.move(rest, glideMs);
  await mouse.move(rest);
  await sleep(300);
  await cdp.send('Page.stopScreencast');
  await Promise.all(writes);
  await page.close();
  return {frames, animations};
}

/** A capture that missed frames; recording again usually fixes it. */
class CaptureError extends Error {
  override name = 'CaptureError';
}

/** Every animation must be captured smoothly: no gap of more than 3 frames (at 60 Hz) while it runs. */
function checkPacing(frames: readonly CapturedFrame[], animations: readonly number[]): void {
  for (const start of animations) {
    const times = frames.map((frame) => frame.time).filter((time) => time >= start && time <= start + 500);
    const worst = Math.max(0, ...times.slice(1).map((time, index) => time - (times[index] ?? time)));
    if (worst > 50) {
      throw new CaptureError(`the capture dropped frames (a ${Math.round(worst)} ms gap)`);
    }
  }
}

/** Resamples the captured frames, each shown until the next one was painted, to a constant frame rate. */
async function resample(frames: readonly CapturedFrame[], directory: string): Promise<string[]> {
  const last = frames.at(-1);
  if (!last) {
    throw new Error('Nothing was captured');
  }

  const lines = frames.flatMap((frame, index) => {
    const next = frames[index + 1];
    const seconds = next ? (next.time - frame.time) / 1000 : outroMs / 1000;
    return [`file '${frame.file}'`, `duration ${seconds.toFixed(4)}`];
  });
  // The concat demuxer ignores the duration of the last entry unless the file is listed once more.
  lines.push(`file '${last.file}'`);
  const list = path.join(directory, 'frames.txt');
  await writeFile(list, `${lines.join('\n')}\n`);

  const output = path.join(directory, 'gif');
  await mkdir(output);
  const pattern = path.join(output, '%05d.png');
  run('ffmpeg', ['-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `fps=${fps}`, pattern]);
  // Numbered by ffmpeg, from 1.
  const {length} = await readdir(output);
  return Array.from({length}, (_, index) => path.join(output, `${String(index + 1).padStart(5, '0')}.png`));
}

/** The GIF loops: its last frame must look like its first. */
function checkLoop(pngs: readonly string[]): void {
  const [first, last] = [pngs[0], pngs.at(-1)];
  if (!first || !last) {
    throw new Error('No frames to encode');
  }

  const result = spawnSync('ffmpeg', ['-i', first, '-i', last, '-lavfi', 'psnr', '-f', 'null', '-'], {
    encoding: 'utf8',
  });
  const psnr = result.stderr.split('average:')[1]?.split(' ')[0] ?? 'unknown';
  if (psnr !== 'inf' && !(Number(psnr) >= 45)) {
    throw new CaptureError(`the last frame differs from the first (PSNR ${psnr} dB), so the loop would jump`);
  }
}

/** Encodes the GIF at the best quality that fits the size budget. */
async function encode(pngs: readonly string[], output: string) {
  // Below quality 100, gifski keeps stale pixels where frames barely differ: faint ghosts of earlier
  // tooltips under the dimmed overlay. So the width goes down first.
  for (const quality of [100, 90]) {
    for (const width of [stageSize.width * scale, 1200, stageSize.width]) {
      const settings = ['--quiet', '--fps', String(fps), '--quality', String(quality), '--width', String(width)];
      run('gifski', [...settings, '--output', output, ...pngs], {stdio: 'ignore'});
      // eslint-disable-next-line no-await-in-loop
      const {size: bytes} = await stat(output);
      if (bytes <= maxBytes) {
        return {width, quality, bytes};
      }
    }
  }

  throw new Error('The GIF does not fit 4.5 MB even at the lowest settings: shorten the tour or the dwell time.');
}

/** A sharp still of the edge step, for visitors who prefer reduced motion and for link previews. */
async function poster(browser: Browser, url: string, output: string): Promise<void> {
  const {page, app, mouse, buttonPoint} = await openStage(browser, url);
  for (const [index, title] of titles.slice(0, 3).entries()) {
    if (index > 0) {
      // eslint-disable-next-line no-await-in-loop
      await mouse.click(await buttonPoint('Next'));
    }

    // eslint-disable-next-line no-await-in-loop
    await settled(app, title);
  }

  // No hover state on the button that was clicked last.
  await mouse.move(rest);
  await sleep(400);
  await page.screenshot({path: output});
  await page.close();
}

/** Records until a capture passes the checks (a busy machine can make the screencast miss frames). */
async function recordFrames(browser: Browser, url: string, work: string): Promise<string[]> {
  const attempts = 3;
  for (let attempt = 1; ; attempt++) {
    const directory = path.join(work, `attempt-${attempt}`);
    const raw = path.join(directory, 'raw');
    // eslint-disable-next-line no-await-in-loop
    await mkdir(raw, {recursive: true});
    console.log('Recording the showcase tour…');
    try {
      // eslint-disable-next-line no-await-in-loop
      const {frames, animations} = await record(browser, url, raw);
      checkPacing(frames, animations);
      // eslint-disable-next-line no-await-in-loop
      const pngs = await resample(frames, directory);
      checkLoop(pngs);
      return pngs;
    } catch (error) {
      if (!(error instanceof CaptureError) || attempt === attempts) {
        throw error;
      }

      console.log(`The recording is not usable: ${error.message}. Recording again…`);
    }
  }
}

async function main(): Promise<void> {
  requireTools();
  run('npm', ['run', 'build:showcase'], {cwd: demo});

  const port = await freePort();
  const url = `http://localhost:${port}/`;
  const preview = spawn(
    path.join(demo, 'node_modules/.bin/vite'),
    ['preview', '--mode', 'showcase', '--port', String(port), '--strictPort'],
    {cwd: demo, stdio: 'ignore'},
  );
  const work = await mkdtemp(path.join(tmpdir(), 'react-tour-kit-demo-'));
  const browser = await chromium.launch();
  try {
    await waitForServer(url);
    await mkdir(assets, {recursive: true});

    const pngs = await recordFrames(browser, url, work);

    console.log(`Encoding ${pngs.length} frames (${(pngs.length / fps).toFixed(1)} s)…`);
    const gif = path.join(assets, 'demo.gif');
    const {width, quality, bytes} = await encode(pngs, gif);
    console.log(`${path.relative(root, gif)}: ${(bytes / 1024 / 1024).toFixed(2)} MB, ${width} px, quality ${quality}`);

    const still = path.join(assets, 'demo-poster.png');
    await poster(browser, url, still);
    const {size} = await stat(still);
    console.log(`${path.relative(root, still)}: ${(size / 1024).toFixed(0)} kB`);
  } finally {
    await browser.close();
    preview.kill();
    await rm(work, {recursive: true, force: true});
  }
}

await main();
