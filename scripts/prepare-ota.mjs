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
      console.log(`[prepare-ota] Uspješno ugrađen Live Web OTA loader u dist/index.html (v${bundledVersion})`);
    }
  }

  // Kopiraj kompilirani paket u public/live-ota kako bi bio trenutačno dostupan preko GitHub Raw i poslužitelja
  const publicOtaDir = path.join(rootDir, 'public', 'live-ota');
  if (!fs.existsSync(publicOtaDir)) {
    fs.mkdirSync(publicOtaDir, { recursive: true });
  }

  const jsBundle = path.join(rootDir, 'dist', 'assets', 'app-bundle.js');
  const cssBundle = path.join(rootDir, 'dist', 'assets', 'app-bundle.css');

  if (fs.existsSync(jsBundle)) {
    fs.copyFileSync(jsBundle, path.join(publicOtaDir, 'app-bundle.js'));
    const cssContent = fs.existsSync(cssBundle) ? fs.readFileSync(cssBundle, 'utf-8') : '';
    if (fs.existsSync(cssBundle)) {
      fs.copyFileSync(cssBundle, path.join(publicOtaDir, 'app-bundle.css'));
    }
    const jsStats = fs.statSync(jsBundle);
    const manifest = {
      version: bundledVersion,
      jsSize: jsStats.size,
      css: cssContent,
      updatedAt: Date.now()
    };
    fs.writeFileSync(path.join(publicOtaDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`[prepare-ota] Uspješno sinkroniziran public/live-ota paket (v${bundledVersion}, ${jsStats.size} B)`);
  }
} catch (err) {
  console.warn('[prepare-ota] Upozorenje:', err);
}
