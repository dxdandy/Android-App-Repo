import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function copyDirRecursiveSync(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function prepareOtaVitePlugin(): Plugin {
  return {
    name: 'ribo-prepare-ota-plugin',
    apply: 'build',
    closeBundle() {
      try {
        const rootDir = path.resolve(import.meta.dirname, '.');
        const distDir = path.join(rootDir, 'dist');
        const distIndex = path.join(distDir, 'index.html');
        const pkgPath = path.join(rootDir, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const bundledVersion = String(pkg.version || '1.8.8').trim();

        if (fs.existsSync(distIndex)) {
          let html = fs.readFileSync(distIndex, 'utf-8');
          html = html.replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/gi, '');

          const otaLoaderScript = `<script type="module">
      window.__BUNDLED_APP_VERSION__ = "${bundledVersion}";
      try {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(regs => {
            regs.forEach(r => r.unregister());
          }).catch(() => {});
        }
        if ('caches' in window) {
          window.caches.keys().then(keys => {
            keys.forEach(k => window.caches.delete(k));
          }).catch(() => {});
        }
      } catch {}
      function isNewerVer(remoteVer, currentVer) {
        if (!remoteVer || !currentVer) return false;
        const rParts = String(remoteVer).replace(/^[vV]/, '').trim().split('.').map(n => parseInt(n, 10) || 0);
        const cParts = String(currentVer).replace(/^[vV]/, '').trim().split('.').map(n => parseInt(n, 10) || 0);
        for (let i = 0; i < Math.max(rParts.length, cParts.length); i++) {
          const r = rParts[i] || 0;
          const c = cParts[i] || 0;
          if (r > c) return true;
          if (r < c) return false;
        }
        return false;
      }
      function loadOtaFromIndexedDB() {
        return new Promise((resolve) => {
          try {
            if (!window.indexedDB) return resolve(null);
            const req = window.indexedDB.open('ribo_ota_code_db', 1);
            req.onupgradeneeded = (e) => {
              const db = e.target.result;
              if (!db.objectStoreNames.contains('bundles')) {
                db.createObjectStore('bundles');
              }
            };
            req.onsuccess = (e) => {
              try {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('bundles')) return resolve(null);
                const tx = db.transaction('bundles', 'readonly');
                const store = tx.objectStore('bundles');
                const getReq = store.get('active');
                getReq.onsuccess = () => resolve(getReq.result || null);
                getReq.onerror = () => resolve(null);
              } catch {
                resolve(null);
              }
            };
            req.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        });
      }
      (async () => {
        let loadedOta = false;
        try {
          const ota = await loadOtaFromIndexedDB();
          if (ota && ota.version && ota.jsCode && isNewerVer(ota.version, window.__BUNDLED_APP_VERSION__)) {
            if (ota.cssCode) {
              const oldStyle = document.getElementById('ribo-ota-live-css');
              if (oldStyle) oldStyle.remove();
              const styleEl = document.createElement('style');
              styleEl.id = 'ribo-ota-live-css';
              styleEl.textContent = ota.cssCode;
              document.head.appendChild(styleEl);
            }
            window.__RUNNING_OTA_VERSION__ = ota.version;
            try {
              const blob = new Blob([ota.jsCode], { type: 'text/javascript' });
              const blobUrl = URL.createObjectURL(blob);
              await import(blobUrl);
              loadedOta = true;
            } catch (importErr) {
              console.warn('[RiboPrognoza OTA] Blob import nije uspio, pokušavam preko script taga:', importErr);
              const scriptEl = document.createElement('script');
              scriptEl.type = 'module';
              scriptEl.textContent = ota.jsCode;
              document.body.appendChild(scriptEl);
              loadedOta = true;
            }
            console.log('[RiboPrognoza OTA] Uspješno aktiviran Live Web paket v' + ota.version);
          }
        } catch (err) {
          console.warn('[RiboPrognoza OTA] Fallback na ugrađeni paket:', err);
        }
        if (!loadedOta) {
          window.__RUNNING_OTA_VERSION__ = window.__BUNDLED_APP_VERSION__;
          await import('/assets/app-bundle.js');
        }
      })();
    </script>`;

          if (html.includes('/assets/app-bundle.js')) {
            html = html.replace(
              /<script type="module"[^>]*src="\/assets\/app-bundle\.js"[^>]*><\/script>/i,
              otaLoaderScript
            );
            fs.writeFileSync(distIndex, html, 'utf-8');
          }
        }

        const selfDestroyingSw = `self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', () => {
  self.registration.unregister().then(() => self.clients.matchAll()).then((clients) => {
    clients.forEach(client => { if (client.url && 'navigate' in client) client.navigate(client.url); });
  });
});
`;
        if (fs.existsSync(distDir)) {
          fs.writeFileSync(path.join(distDir, 'sw.js'), selfDestroyingSw, 'utf-8');
          fs.writeFileSync(path.join(distDir, 'registerSW.js'), '// Service Worker disabled to prevent stale cache loops\n', 'utf-8');
        }

        const jsBundle = path.join(distDir, 'assets', 'app-bundle.js');
        const cssBundle = path.join(distDir, 'assets', 'app-bundle.css');

        if (fs.existsSync(jsBundle)) {
          const cssContent = fs.existsSync(cssBundle) ? fs.readFileSync(cssBundle, 'utf-8') : '';
          const jsStats = fs.statSync(jsBundle);
          const manifestObj = {
            version: bundledVersion,
            jsSize: jsStats.size,
            css: cssContent,
            updatedAt: Date.now()
          };
          const manifestJson = JSON.stringify(manifestObj, null, 2);

          for (const targetOtaDir of [path.join(rootDir, 'public', 'live-ota'), path.join(distDir, 'live-ota')]) {
            if (!fs.existsSync(targetOtaDir)) {
              fs.mkdirSync(targetOtaDir, { recursive: true });
            }
            fs.copyFileSync(jsBundle, path.join(targetOtaDir, 'app-bundle.js'));
            if (fs.existsSync(cssBundle)) {
              fs.copyFileSync(cssBundle, path.join(targetOtaDir, 'app-bundle.css'));
            }
            fs.writeFileSync(path.join(targetOtaDir, 'manifest.json'), manifestJson, 'utf-8');
          }
        }

        const androidPublicDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public');
        if (fs.existsSync(distDir) && fs.existsSync(path.join(rootDir, 'android', 'app'))) {
          copyDirRecursiveSync(distDir, androidPublicDir);
        }
      } catch (err) {
        console.warn('[prepareOtaVitePlugin] Upozorenje:', err);
      }
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        selfDestroying: true,
        injectRegister: null,
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          id: '/',
          name: 'RiboPrognoza - Dunav (Aljmaš & Bogojevo)',
          short_name: 'RiboPrognoza',
          description: 'Službeni vodostaji Dunava za Aljmaš i Bogojevo uživo, meteo podaci, barometar i dnevni solunarni rezultati za ribolov.',
          theme_color: '#020617',
          background_color: '#020617',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          categories: ['sports', 'weather', 'utilities'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
      prepareOtaVitePlugin(),
    ],
    build: {
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          entryFileNames: 'assets/app-bundle.js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'assets/app-bundle.css';
            }
            return 'assets/[name]-[hash][extname]';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      hmr: false,
      watch: null,
    },
  };
});
