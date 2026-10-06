import { pathToFileURL } from 'node:url';

const playwright = process.env.PLAYWRIGHT_MODULE
  ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
  : await import('playwright');
const { chromium } = playwright;

const target = 'https://2gud4u-bit.github.io/naija-life/?renderer-smoke=20261006';
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']
});

try {
  for (const mode of ['webgl2-preferred', 'webgl1-only']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const pageErrors = [];
    const relevantResponses = {};
    if (mode === 'webgl1-only') {
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          if (type === 'webgl2') return null;
          return Reflect.apply(original, this, [type, ...args]);
        };
      });
    }
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('response', response => {
      const pathname = new URL(response.url()).pathname;
      if (/\/naija-life\/js\/(world3d\.js|three-world\.js|vendor\/three\.module\.js)$/.test(pathname)) {
        relevantResponses[pathname] = response.status();
      }
    });

    await page.goto(target + '-' + mode, { waitUntil: 'domcontentloaded', timeout: 90000 });
    try {
      await page.waitForFunction(
        () => ['ready', 'rendering', 'failed'].includes(window.__NAIJA_3D_STATUS?.status),
        null,
        { timeout: 45000 }
      );
    } catch {
      const state = await page.evaluate(() => window.__NAIJA_3D_STATUS || null);
      throw new Error(mode + ': 3D startup did not finish. Status: ' + JSON.stringify(state) + '; files: ' + JSON.stringify(relevantResponses));
    }

    const startup = await page.evaluate(() => window.__NAIJA_3D_STATUS);
    if (startup.status === 'failed') {
      throw new Error(mode + ': 3D startup failed at ' + startup.stage + ': ' + (startup.error || 'unknown error') + '; files: ' + JSON.stringify(relevantResponses));
    }

    await page.evaluate(() => {
      if (!window.Game.state) window.Game.newState('Renderer smoke test', 'woman', 'dark', 'curls', 'green');
      window.Game.running = true;
    });
    try {
      await page.waitForFunction(() => ['rendering', 'failed'].includes(window.__NAIJA_3D_STATUS?.status), null, { timeout: 45000 });
    } catch {
      const state = await page.evaluate(() => window.__NAIJA_3D_STATUS || null);
      throw new Error(mode + ': renderer initialized but did not render a frame. Status: ' + JSON.stringify(state) + '; files: ' + JSON.stringify(relevantResponses));
    }
    const renderStatus = await page.evaluate(() => window.__NAIJA_3D_STATUS);
    if (renderStatus.status === 'failed') {
      throw new Error(mode + ': 3D render failed at ' + renderStatus.stage + ': ' + (renderStatus.error || 'unknown error') + '; stack: ' + (renderStatus.stack || 'unavailable') + '; files: ' + JSON.stringify(relevantResponses));
    }

    const result = await page.evaluate(() => {
      const api = window.Game.world.threeWorld;
      const canvas = api?.renderer?.domElement;
      const gl = api?.renderer?.getContext();
      return {
        status: window.__NAIJA_3D_STATUS.status,
        stage: window.__NAIJA_3D_STATUS.stage,
        canvasConnected: !!canvas?.isConnected,
        canvasSize: canvas ? [canvas.width, canvas.height] : null,
        webglContext: gl?.constructor?.name || null,
        stats: api?.stats || null,
        visible: canvas ? getComputedStyle(canvas).display !== 'none' : false
      };
    });

    if (pageErrors.length) throw new Error(mode + ': browser JavaScript errors: ' + JSON.stringify(pageErrors));
    if (Object.values(relevantResponses).some(status => status >= 400)) {
      throw new Error(mode + ': a required 3D file returned an HTTP error: ' + JSON.stringify(relevantResponses));
    }
    if (result.status !== 'rendering' || !result.canvasConnected || !result.visible ||
        !result.stats || result.stats.drawCalls < 1 || result.stats.triangles < 1) {
      throw new Error(mode + ': the live page did not produce a visible 3D frame: ' + JSON.stringify(result));
    }
    if (mode === 'webgl1-only' && result.webglContext !== 'WebGLRenderingContext') {
      throw new Error('WebGL1-only check did not create a WebGL 1 context: ' + JSON.stringify(result));
    }

    console.log(JSON.stringify({ mode, target, requiredFiles: relevantResponses, result, pageErrors }, null, 2));
    await page.close();
  }
} finally {
  await browser.close();
}

