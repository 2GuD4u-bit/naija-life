import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';

const playwright = process.env.PLAYWRIGHT_MODULE
  ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
  : await import('playwright');
const { chromium } = playwright;

const target = process.env.NAIJA_SMOKE_URL || 'https://2gud4u-bit.github.io/naija-life/?renderer-smoke=20261006';
const screenshotDir = process.env.NAIJA_SCREENSHOT_DIR;
if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']
});

try {
  for (const mode of ['webgl2-preferred', 'webgl1-only']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const pageErrors = [];
    const relevantResponses = {};
    const verifiedAssetLogs = [];
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
    page.on('console', message => {
      if (message.text().includes('[Naija 3D] production-cc0-assets-ready')) verifiedAssetLogs.push(message.text());
    });
    page.on('response', response => {
      const pathname = new URL(response.url()).pathname;
      if (/\/js\/(world3d\.js|three-world\.js|vendor\/(three\.module|GLTFLoader|BufferGeometryUtils)\.js)$/.test(pathname) || pathname.startsWith('/naija-life/assets/3d/polyhaven/')) {
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

    const movement = await page.evaluate(() => {
      const start = document.getElementById('start-screen');
      start?.classList.add('hide');
      window.Game.ui.panel = null;
      window.Game.state.inside = null;
      window.Game.state.vehicle = null;
      window.Game.state.x = 1010;
      window.Game.state.y = 744;
      window.Game.state.hour = 20;
      const before = [window.Game.state.x, window.Game.state.y];
      window.Game.keys.w = true;
      window.Player.update(0.2);
      window.Game.keys.w = false;
      window.Game.world.threeWorld.render();
      return { before, after: [window.Game.state.x, window.Game.state.y] };
    });
    if (movement.before[0] === movement.after[0] && movement.before[1] === movement.after[1]) {
      throw new Error(mode + ': the player could not move from the game start position: ' + JSON.stringify(movement));
    }

    const interaction = await page.evaluate(() => {
      const phoneButton = document.querySelector('.bottom-nav [data-panel="phone"]');
      phoneButton?.click();
      const phoneLauncher = document.querySelector('#panel-content .phone-device');
      const appCount = document.querySelectorAll('#panel-content .phone-app').length;
      const screens = {};
      for (const tab of ['jobs','messages','contacts','people','salary','events','games','nollywood','sports','food','bank','boutique','finance','houses','vehicles','invite','health','invest','business','family','government-governor','police','ads','settings']) {
        window.Game.launchApp(tab);
        const content = document.querySelector('#panel-content .phone-app-content');
        screens[tab] = !!content && content.textContent.trim().length > 0;
      }
      document.querySelector('.bottom-nav [data-panel="inventory"]')?.click();
      const bag = document.getElementById('panel-content')?.textContent || '';
      document.querySelector('.bottom-nav [data-panel="map"]')?.click();
      const mapVisible = !!document.querySelector('#panel-content #city-map-svg');
      const zoomBefore = window.Game.view.zoom;
      document.querySelector('[data-world-zoom="in"]')?.click();
      const zoomAfter = window.Game.view.zoom;
      const api = window.Game.world.threeWorld;
      window.Game.state.hour = 12; window.Game.state.minute = 0; api.render();
      const dayColor = api.scene.background.getHexString();
      window.Game.state.hour = 23; window.Game.state.minute = 0; api.render();
      const nightColor = api.scene.background.getHexString();
      return { phoneLauncher: !!phoneLauncher, appCount, screens, bagHasPhone: bag.includes('Phone'), bagHasWater: bag.includes('Water'), mapVisible, zoomChanged: zoomAfter > zoomBefore, dayColor, nightColor, lightingChanges: dayColor !== nightColor, errorBanner: document.getElementById('runtime-error')?.textContent || '' };
    });
    const missingScreens = Object.entries(interaction.screens).filter(([, rendered]) => !rendered).map(([name]) => name);
    if (!interaction.phoneLauncher || interaction.appCount < 20 || missingScreens.length ||
        !interaction.bagHasPhone || !interaction.bagHasWater || !interaction.mapVisible ||
        !interaction.zoomChanged || !interaction.lightingChanges || interaction.errorBanner) {
      throw new Error(mode + ': phone, bag, navigation, camera, or day/night UI check failed: ' + JSON.stringify({ interaction, missingScreens }));
    }

    const result = await page.evaluate(movement => {
      const api = window.Game.world.threeWorld;
      const canvas = api?.renderer?.domElement;
      const gl = api?.renderer?.getContext();
      const world = window.Game.world;
      const names = new Set((world.buildings || []).map(b => b.name));
      const builders = world.assetBuilders || {};
      let mappedCityMaterials = 0;
      for (const chunk of api?.chunks?.values?.() || []) chunk.traverse(object => {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        if (object.isInstancedMesh && materials.some(material => material?.map && material?.roughnessMap && (material?.normalMap || material?.bumpMap))) mappedCityMaterials++;
      });
      return {
        status: window.__NAIJA_3D_STATUS.status,
        stage: window.__NAIJA_3D_STATUS.stage,
        canvasConnected: !!canvas?.isConnected,
        canvasSize: canvas ? [canvas.width, canvas.height] : null,
        webglContext: gl?.constructor?.name || null,
        stats: api?.stats || null,
        dimensions: [window.Game.W, window.Game.H],
        districts: world.districts?.length || 0,
        locations: world.buildings?.length || 0,
        cityLots: world.cityLots?.length || 0,
        residentialLots: world.houseLots?.length || 0,
        roadSegments: api?.stats?.roads || 0,
        mappedCityMaterials,
        cc0AssetLoaded: verifiedAssetLogs.length > 0,
        realPlantInstances: [...(api?.chunks?.values?.() || [])].reduce((n, chunk) => { let count=0; chunk.traverse(object => { if (object.isInstancedMesh && object.name === 'Poly Haven CC0 sorrel planting') count+=object.count; }); return n+count; }, 0),
        destinations: {
          abujacar: names.has('ABUJACAR CAR DEALERSHIP'),
          devoltMould: names.has('Devolt Mould Flagship'),
          airport: names.has('Nnamdi Azikiwe International Airport'),
          restaurants: ['Blucabana Restaurant', 'The Vue', 'Cilantro Abuja', 'A Class Restaurant', 'Istanbul Restaurant & Café', 'Vibes by Ann’s', 'City View Restaurant'].filter(name => names.has(name)).length,
          carStands: ['Manga Car Stand', 'Abana Car Stand', 'Sarkin Mota Car Stand'].filter(name => names.has(name)).length
        },
        customBuildersReady: ['car-stand', 'restaurant-property', 'fashion-flagship', 'airport-terminal', 'mosque', 'retail-complex', 'transport-terminal'].every(name => typeof builders[name] === 'function'),
        playerMoved: movement.before[0] !== movement.after[0] || movement.before[1] !== movement.after[1],
        phoneAndBagVerified: true,
        visible: canvas ? getComputedStyle(canvas).display !== 'none' : false
      };
    }, movement);

    if (pageErrors.length) throw new Error(mode + ': browser JavaScript errors: ' + JSON.stringify(pageErrors));
    if (Object.values(relevantResponses).some(status => status >= 400)) {
      throw new Error(mode + ': a required 3D file returned an HTTP error: ' + JSON.stringify(relevantResponses));
    }
    const requiredAssetPaths = [
      '/naija-life/js/vendor/GLTFLoader.js', '/naija-life/js/vendor/BufferGeometryUtils.js',
      '/naija-life/assets/3d/polyhaven/concrete_tile_facade/diff.jpg',
      '/naija-life/assets/3d/polyhaven/concrete_tile_facade/nor_gl.jpg',
      '/naija-life/assets/3d/polyhaven/concrete_tile_facade/arm.jpg',
      '/naija-life/assets/3d/polyhaven/shrub_sorrel_01/shrub_sorrel_01_1k.gltf',
      '/naija-life/assets/3d/polyhaven/shrub_sorrel_01/shrub_sorrel_01.bin',
      '/naija-life/assets/3d/polyhaven/shrub_sorrel_01/textures/shrub_sorrel_01_diff_1k.jpg',
      '/naija-life/assets/3d/polyhaven/shrub_sorrel_01/textures/shrub_sorrel_01_nor_gl_1k.jpg',
      '/naija-life/assets/3d/polyhaven/shrub_sorrel_01/textures/shrub_sorrel_01_arm_1k.jpg'
    ];
    const missingAssets = requiredAssetPaths.filter(path => relevantResponses[path] !== 200);
    if (!verifiedAssetLogs.length || missingAssets.length) {
      throw new Error(mode + ': production CC0 assets failed to load: ' + JSON.stringify({ missingAssets, logs: verifiedAssetLogs, responses: relevantResponses }));
    }
    if (result.status !== 'rendering' || !result.canvasConnected || !result.visible ||
        !result.stats || result.stats.drawCalls < 1 || result.stats.triangles < 1) {
      throw new Error(mode + ': the live page did not produce a visible 3D frame: ' + JSON.stringify(result));
    }
    if (result.dimensions[0] !== 14400 || result.dimensions[1] !== 9600 || result.districts < 20 ||
        result.cityLots !== 3568 || result.residentialLots !== 320 || result.roadSegments !== 576 || result.mappedCityMaterials < 1 || result.realPlantInstances < 1 ||
        (result.stats.cityLots || 0) < 500 || (result.stats.roundabouts || 0) < 10 || (result.stats.trees || 0) < 15 ||
        !result.destinations.abujacar || !result.destinations.devoltMould || !result.destinations.airport ||
        result.destinations.restaurants !== 7 || result.destinations.carStands !== 3 ||
        !result.customBuildersReady || !result.playerMoved) {
      throw new Error(mode + ': the live world expansion or movement is incomplete: ' + JSON.stringify(result));
    }
    if (mode === 'webgl1-only' && result.webglContext !== 'WebGLRenderingContext') {
      throw new Error('WebGL1-only check did not create a WebGL 1 context: ' + JSON.stringify(result));
    }

    if (screenshotDir && mode === 'webgl2-preferred') {
      await page.evaluate(() => {
        // Close the UI panel through the game's own API. Clearing only ui.panel
        // leaves #shade visible and invalidates the world screenshots.
        window.Game.closePanel?.();
        document.getElementById('start-screen')?.classList.add('hide');
        window.Game.state.inside = null;
        window.Game.state.vehicle = null;
        window.Game.state.hour = 12;
        window.Game.state.minute = 15;
        window.Game.world.threeWorld.render();
      });
      await page.screenshot({ path: `${screenshotDir}/abuja-city-day.png`, timeout: 90000 });
      await page.evaluate(() => {
        window.Game.state.hour = 20;
        window.Game.state.minute = 15;
        window.Game.world.threeWorld.render();
      });
      await page.screenshot({ path: `${screenshotDir}/abuja-city-night.png`, timeout: 90000 });
      await page.evaluate(() => {
        const G = window.Game;
        G.state.inside = null; G.state.vehicle = null; G.ui.panel = null;
        G.state.x = 3600; G.state.y = 3200;
        G.state.hour = 12; G.state.minute = 30;
        G.view.scale = .46; G.view.zoom = .46;
        G.world.threeWorld.render();
      });
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `${screenshotDir}/abuja-city-aerial.png`, timeout: 90000 });
      const dealership = await page.evaluate(() => {
        const G = window.Game, lot = G.world.carDealership.lot;
        G.state.inside = null; G.state.vehicle = null; G.ui.panel = null;
        G.view.scale = 1; G.view.zoom = 1;
        G.state.x = lot.x + lot.w / 2; G.state.y = lot.y - 38;
        G.state.hour = 12; G.state.minute = 20;
        G.world.threeWorld.render();
        return { player: [G.state.x, G.state.y], lot: { ...lot }, cars: G.world.carDealership.cars.length };
      });
      await page.waitForTimeout(1800);
      const dealershipScene = await page.evaluate(() => {
        const api = window.Game.world.threeWorld;
        let dealer = null;
        for (const chunk of api.chunks.values()) chunk.traverse(object => {
          if (object.userData?.type === 'dealer') dealer = object;
        });
        if (!dealer) return { found: false };
        let meshes = 0, lights = 0, vehicles = 0, signs = 0, bevelledBodies = 0;
        dealer.traverse(object => {
          if (object.isMesh) meshes++;
          if (object.isMesh && object.geometry?.type === 'ExtrudeGeometry') bevelledBodies++;
          if (object.isLight) lights++;
          if (object.userData?.vehicleKind) vehicles++;
          if (object.isSprite) signs++;
        });
        return { found: true, meshes, lights, vehicles, signs, bevelledBodies, bounds: dealer.userData.name };
      });
      if (!dealershipScene.found || dealershipScene.meshes < 100 || dealershipScene.vehicles < 18 || dealershipScene.signs < 4 || dealershipScene.bevelledBodies < 18) {
        throw new Error('ABUJACAR property did not build its detailed 3D showroom and compound: ' + JSON.stringify({ dealership, dealershipScene }));
      }
      await page.screenshot({ path: `${screenshotDir}/abujacar-gameplay-overview.png`, timeout: 90000 });
      await page.evaluate(() => {
        window.Game.view.scale = Math.max(window.Game.view.scale || 1, 1.9);
        window.Game.view.zoom = Math.max(window.Game.view.zoom || 1, 1.9);
        window.Game.world.threeWorld.render();
      });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${screenshotDir}/abujacar-gameplay-close.png`, timeout: 90000 });
      console.log(JSON.stringify({ visualCheckpoints: [`${screenshotDir}/abuja-city-day.png`, `${screenshotDir}/abuja-city-night.png`, `${screenshotDir}/abuja-city-aerial.png`, `${screenshotDir}/abujacar-gameplay-overview.png`, `${screenshotDir}/abujacar-gameplay-close.png`], dealership, dealershipScene }));
    }

    console.log(JSON.stringify({ mode, target, requiredFiles: relevantResponses, result, pageErrors }, null, 2));
    await page.close();
  }
} finally {
  await browser.close();
}


