import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const distIndex = path.join(rootDir, 'dist', 'index.html');
const pkgPath = path.join(rootDir, 'package.json');

try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const bundledVersion = pkg.version || '1.6.7';

  if (fs.existsSync(distIndex)) {
    let html = fs.readFileSync(distIndex, 'utf-8');

    // Zamijeni statični <script type="module" crossorigin src="/assets/app-bundle.js"></script>
    // s pametnim OTA učitavačem koji prvo provjerava je li iz Firestorea preuzet noviji kod u IndexedDB
    const otaLoaderScript = `<script type="module">
      window.__BUNDLED_APP_VERSION__ = "${bundledVersion}";
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
              const styleEl = document.createElement('style');
              styleEl.id = 'ribo-ota-live-css';
              styleEl.textContent = ota.cssCode;
              document.head.appendChild(styleEl);
            }
            window.__RUNNING_OTA_VERSION__ = ota.version;
            const blob = new Blob([ota.jsCode], { type: 'text/javascript' });
            const blobUrl = URL.createObjectURL(blob);
            await import(blobUrl);
            loadedOta = true;
            console.log('[RiboPrognoza OTA] Uspješno pokrenut Live Web paket v' + ota.version);
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
      console.log(`[prepare-ota] Uspješno ugrađen Live Web OTA loader u dist/index.html (v${bundledVersion})`);
    }
  }
} catch (err) {
  console.warn('[prepare-ota] Upozorenje:', err);
}
