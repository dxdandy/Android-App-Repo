import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const distDir = path.join(rootDir, 'dist');
const distIndex = path.join(distDir, 'index.html');
const pkgPath = path.join(rootDir, 'package.json');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const bundledVersion = String(pkg.version || '1.9.2').trim();
  const otaManifestVersion = `${bundledVersion}.1`;

  if (fs.existsSync(distIndex)) {
    let html = fs.readFileSync(distIndex, 'utf-8');

    // Ukloni automatsku registraciju Service Workera kako nikada ne bi vraćao staru verziju iz predmemorije
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
      function normalizeVer(ver) {
        const clean = String(ver || '').replace(/^[vV]/, '').trim();
        const parts = clean.split('.');
        return parts.length > 3 ? parts.slice(0, 3).join('.') : clean;
      }
      function isNewerVer(remoteVer, currentVer) {
        if (!remoteVer || !currentVer) return false;
        const rParts = normalizeVer(remoteVer).split('.').map(n => parseInt(n, 10) || 0);
        const cParts = normalizeVer(currentVer).split('.').map(n => parseInt(n, 10) || 0);
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
            window.__RUNNING_OTA_VERSION__ = normalizeVer(ota.version);
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
            console.log('[RiboPrognoza OTA] Uspješno aktiviran Live Web paket v' + window.__RUNNING_OTA_VERSION__);
          }
        } catch (err) {
          console.warn('[RiboPrognoza OTA] Fallback na ugrađeni paket:', err);
        }
        if (!loadedOta) {
          window.__RUNNING_OTA_VERSION__ = "${bundledVersion}";
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
      console.log(`[prepare-ota] Uspješno ugrađen Live Web OTA loader u dist/index.html (v${bundledVersion})`);
    }
  }

  // Postavi samo-uklanjajući sw.js i registerSW.js kako niti jedan uređaj ne bi ostao na starom Service Workeru
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

  // Kopiraj kompilirani paket u public/live-ota i dist/live-ota kako bi bio trenutačno dostupan preko GitHub Raw i poslužitelja
  const publicOtaDir = path.join(rootDir, 'public', 'live-ota');
  const distOtaDir = path.join(distDir, 'live-ota');

  const jsBundle = path.join(rootDir, 'dist', 'assets', 'app-bundle.js');
  const cssBundle = path.join(rootDir, 'dist', 'assets', 'app-bundle.css');

  if (fs.existsSync(jsBundle)) {
    const cssContent = fs.existsSync(cssBundle) ? fs.readFileSync(cssBundle, 'utf-8') : '';
    const jsStats = fs.statSync(jsBundle);
    const manifest = {
      version: otaManifestVersion,
      appVersion: bundledVersion,
      jsSize: jsStats.size,
      css: cssContent,
      updatedAt: Date.now()
    };
    const manifestStr = JSON.stringify(manifest, null, 2);

    for (const targetDir of [publicOtaDir, distOtaDir]) {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.copyFileSync(jsBundle, path.join(targetDir, 'app-bundle.js'));
      if (fs.existsSync(cssBundle)) {
        fs.copyFileSync(cssBundle, path.join(targetDir, 'app-bundle.css'));
      }
      fs.writeFileSync(path.join(targetDir, 'manifest.json'), manifestStr, 'utf-8');
    }
    console.log(`[prepare-ota] Uspješno sinkroniziran public/live-ota paket (v${otaManifestVersion} / appVersion v${bundledVersion}, ${jsStats.size} B)`);
  }

  // Automatski sinkroniziraj dist/ u android/app/src/main/assets/public/
  const androidPublicDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public');
  if (fs.existsSync(distDir) && fs.existsSync(path.join(rootDir, 'android', 'app'))) {
    copyDirRecursive(distDir, androidPublicDir);
    console.log(`[prepare-ota] Uspješno sinkroniziran Android assets/public direktorij (v${bundledVersion})`);
  }
} catch (err) {
  console.warn('[prepare-ota] Upozorenje:', err);
}
