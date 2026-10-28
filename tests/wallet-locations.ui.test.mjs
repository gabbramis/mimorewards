// Isolated real-browser component test. All API responses are fixtures; no Supabase or Wallet calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { resolve, extname } from 'node:path';
import { build } from '../.tmp/wallet-validation/node_modules/esbuild/lib/main.js';
import { chromium } from '../.tmp/wallet-validation/node_modules/playwright-core/index.mjs';

test('pilot editor works on desktop/mobile and leaves campaigns without send actions', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const basePath = `/admin/negocios/${id}/comunicaciones`;
  const output = await build({
    stdin: {
      contents: `import React from 'react'; import { createRoot } from 'react-dom/client';
        import CommunicationsClient from './src/components/merchant/CommunicationsClient';
        createRoot(document.getElementById('root')).render(<CommunicationsClient businessId="${id}" section={location.pathname.split('/').pop()} basePath="${basePath}" />);`,
      resolveDir: root, loader: 'tsx',
    },
    absWorkingDir: root, tsconfigRaw: {}, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    plugins: [{ name: 'workspace-only-resolution', setup(bundle) {
      bundle.onResolve({ filter: /.*/ }, (args) => {
        if (args.path === 'next/link') return { path: resolve(root, 'link-fixture.js'), namespace: 'link-fixture' };
        const request = args.path.startsWith('@/') ? resolve(root, 'src', args.path.slice(2)) : args.path;
        const from = args.importer && args.importer !== '<stdin>' ? args.importer : resolve(root, 'package.json');
        const resolver = createRequire(from);
        let resolved;
        try { resolved = resolver.resolve(request); }
        catch (error) {
          for (const suffix of ['.ts', '.tsx']) {
            try { resolved = resolver.resolve(request + suffix); break; } catch { /* Try the next TypeScript extension. */ }
          }
          if (!resolved) throw error;
        }
        return { path: resolved, namespace: 'isolated' };
      });
      bundle.onLoad({ filter: /.*/, namespace: 'isolated' }, async (args) => ({
        contents: await readFile(args.path, 'utf8'),
        loader: ({ '.tsx': 'tsx', '.ts': 'ts', '.json': 'json' })[extname(args.path)] ?? 'js',
      }));
      bundle.onLoad({ filter: /.*/, namespace: 'link-fixture' }, () => ({
        contents: "import React from 'react'; export default function Link({href,children,...props}) { return React.createElement('a',{href,...props},children); }", loader: 'js',
      }));
    } }],
    define: { 'process.env.NODE_ENV': '"development"' },
  });
  const cssFiles = (await readdir(`${root}/.next/static/chunks`)).filter((name) => name.endsWith('.css'));
  const css = (await Promise.all(cssFiles.map((name) => readFile(`${root}/.next/static/chunks/${name}`, 'utf8')))).join('\n');
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', request.url === '/preview.js' ? 'text/javascript' : 'text/html; charset=utf-8');
    response.end(request.url === '/preview.js' ? output.outputFiles[0].text : `<!doctype html><html lang="es"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style><body style="background:#fff9f5"><main style="max-width:1200px;margin:auto;padding:24px"><div id="root"></div></main><script src="/preview.js"></script></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    const browserErrors = [];
    page.on('pageerror', (error) => { browserErrors.push(error.message); console.error(error.message); });
    let config = {
      business: { name: 'Coffe Dreams', slug: 'coffe-dreams', active: true, wallet_locations_enabled: false, wallet_location_revision: 0 },
      superadmin: true, locations: [], summary: { counts: {}, errors: [] }, configured: { apple: true, google: false },
    };
    let saved;
    await page.route('**/api/comercio/*/wallet-locations', async (route) => {
      if (route.request().method() === 'PUT') {
        saved = route.request().postDataJSON();
        config = { ...config, locations: saved.locations, business: { ...config.business, wallet_locations_enabled: saved.enabled, wallet_location_revision: 1 } };
        await route.fulfill({ json: { revision: 1, message: 'Configuración guardada. La sincronización quedó en cola.' } });
      } else await route.fulfill({ json: config });
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.goto(`${origin}${basePath}/geolocalizacion`);
    await page.getByRole('button', { name: 'Usar coordenadas del piloto' }).click();
    assert.equal(await page.getByLabel('Latitud', { exact: true }).inputValue(), '-34.9056557');
    assert.equal(await page.getByLabel('Longitud', { exact: true }).inputValue(), '-56.1706692');
    await page.getByLabel('Habilitar el piloto para este negocio').check();
    await page.getByLabel('Usar esta ubicación para cercanía').check();
    await page.getByRole('button', { name: 'Guardar configuración' }).click();
    await page.getByRole('status').filter({ hasText: 'Configuración guardada' }).waitFor();
    assert.equal(saved.locations[0].latitude, -34.9056557);
    assert.equal(saved.locations[0].longitude, -56.1706692);
    assert.equal(saved.locations[0].enabled, true);
    assert.equal(saved.enabled, true);
    await mkdir(`${root}/.tmp`, { recursive: true });
    await page.screenshot({ path: `${root}/.tmp/communications-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${root}/.tmp/communications-mobile.png`, fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'The page must not overflow horizontally on mobile');
    await page.goto(`${origin}${basePath}/campanas`);
    await page.getByRole('heading', { name: 'Campañas · Próxima etapa' }).waitFor();
    assert.equal(await page.getByRole('button', { name: /enviar|nueva campaña/i }).count(), 0);
    assert.deepEqual(browserErrors, []);
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
