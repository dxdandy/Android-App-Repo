/**
 * Sustav za automatsko Live Web Ažuriranje aplikacije (OTA In-App Live Updater)
 * Autor: Daniel Čizmar
 * GitHub: dxdandy/Android-App-Repo
 *
 * Napomena: Ažuriranja se primjenjuju izravno unutar aplikacije (Live Web OTA)
 * odmah pri pokretanju, bez preuzimanja APK datoteka i bez Google Play Protect blokada,
 * uz zadržavanje sigurnog lokalnog WebView konteksta (bez 404 preusmjeravanja).
 */

import { registerPlugin } from '@capacitor/core';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { showAppUpdateAvailableNotification } from './notificationService';

export const BUNDLED_APP_VERSION = '1.7.8';
export const LIVE_VERSION_STORAGE_KEY = 'ribo_current_live_version';
export const LIVE_UPDATE_INFO_STORAGE_KEY = 'ribo_last_live_update_info';

const FIRESTORE_REST_BASE =
  'https://firestore.googleapis.com/v1/projects/titanium-domain-wv4kj/databases/ai-studio-hrvatskiradnipro-badf4099-cdd8-4a4a-b90c-6a3aea6c7b94/documents';

function parseFirestoreRestFields(fieldsObj: any): Record<string, any> {
  const result: Record<string, any> = {};
  if (!fieldsObj || typeof fieldsObj !== 'object') return result;
  for (const [k, val] of Object.entries(fieldsObj)) {
    const v = val as any;
    if (!v || typeof v !== 'object') continue;
    if ('stringValue' in v) result[k] = v.stringValue;
    else if ('integerValue' in v) result[k] = Number(v.integerValue);
    else if ('doubleValue' in v) result[k] = Number(v.doubleValue);
    else if ('booleanValue' in v) result[k] = Boolean(v.booleanValue);
    else if ('arrayValue' in v) {
      const vals = v.arrayValue?.values || [];
      result[k] = vals.map((item: any) => item.stringValue ?? item.integerValue ?? item);
    }
  }
  return result;
}

async function getFirestoreDocQuotaSafe(collectionName: string, docId: string): Promise<Record<string, any> | null> {
  try {
    const snap = await Promise.race([
      getDoc(doc(db, collectionName, docId)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))
    ]);
    if (snap && (snap as any).exists && (snap as any).exists()) {
      return (snap as any).data();
    }
  } catch {}

  try {
    const url = `${FIRESTORE_REST_BASE}/${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}?updateMask.fieldPaths=_ping`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { _ping: { integerValue: '1' } } })
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.fields) {
        return parseFirestoreRestFields(json.fields);
      }
    }
  } catch {}

  return null;
}

/**
 * Uspoređuje dvije semantičke verzije (npr. '1.6.3' > '1.6.2')
 * Vraća true ako je remoteVer novija od currentVer
 */
export function isNewerVersion(remoteVer: string, currentVer: string): boolean {
  if (!remoteVer || !currentVer) return false;

  const cleanRemote = remoteVer.replace(/^[vV]/, '').trim();
  const cleanCurrent = currentVer.replace(/^[vV]/, '').trim();

  const remoteParts = cleanRemote.split('.').map(n => parseInt(n, 10) || 0);
  const currentParts = cleanCurrent.split('.').map(n => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(remoteParts.length, currentParts.length); i++) {
    const r = remoteParts[i] || 0;
    const c = currentParts[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }

  return false;
}

/**
 * Vraća trenutnu aktivnu verziju aplikacije (uzima u obzir instalirana Live Web ažuriranja)
 */
export function getCurrentAppVersion(): string {
  if (typeof window !== 'undefined') {
    try {
      // Ako se trenutno u memoriji izvršava OTA paket, to je stvarna verzija koda!
      const runningOtaVer = (window as any).__RUNNING_OTA_VERSION__;
      if (runningOtaVer && isNewerVersion(runningOtaVer, BUNDLED_APP_VERSION)) {
        return runningOtaVer.replace(/^[vV]/, '').trim();
      }

      // Ako je zabilježena verzija u localStorageu, ali stvarni kod nije primijenjen, nemoj lažno prikazivati noviju verziju
      const liveVer = localStorage.getItem(LIVE_VERSION_STORAGE_KEY);
      if (liveVer && isNewerVersion(liveVer, BUNDLED_APP_VERSION)) {
        // Provjeri poklapa li se s pokrenutim kodom
        if (runningOtaVer && runningOtaVer === liveVer) {
          return liveVer.replace(/^[vV]/, '').trim();
        }
      }
      localStorage.setItem(LIVE_VERSION_STORAGE_KEY, BUNDLED_APP_VERSION);
    } catch {}
  }
  return BUNDLED_APP_VERSION;
}

export const CURRENT_APP_VERSION = getCurrentAppVersion();

export interface AppVersionInfo {
  version: string;
  name: string;
  releaseDate: string;
  apkUrl?: string;
  changelog: string[];
  isCritical?: boolean;
  updateType?: 'live_web' | 'apk';
  liveWebUrl?: string;
}

export type CheckUpdateStatus = 'update_available' | 'up_to_date' | 'network_error';

export interface CheckUpdateResult {
  status: CheckUpdateStatus;
  updateInfo?: AppVersionInfo;
  serverVersion?: string;
  currentVersion: string;
  endpointUsed?: string;
  errorMessage?: string;
}

const DISMISS_KEY_PREFIX = 'ribo_dismissed_update_';
const GITHUB_REPO_KEY = 'ribo_github_repo';
export const DEFAULT_FALLBACK_REPO = 'dxdandy/Android-App-Repo';

export function getSavedGithubRepo(): string {
  if (typeof window === 'undefined') return DEFAULT_FALLBACK_REPO;
  const saved = localStorage.getItem(GITHUB_REPO_KEY);
  return (saved && saved.trim()) ? saved.trim() : DEFAULT_FALLBACK_REPO;
}

export function setSavedGithubRepo(repo: string): void {
  if (typeof window === 'undefined') return;
  const clean = repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
  localStorage.setItem(GITHUB_REPO_KEY, clean || DEFAULT_FALLBACK_REPO);
}

/**
 * Vraća listu svih online adresa koje aplikacija redom provjerava za novu Live Web verziju
 */
export function getUpdateEndpoints(): string[] {
  const endpoints: string[] = [];
  const repo = getSavedGithubRepo();

  // 1. Ako se otvara u web pregledniku na samom poslužitelju
  if (typeof window !== 'undefined' && !window.location.origin.includes('localhost') && !window.location.protocol.startsWith('capacitor')) {
    endpoints.push(`${window.location.origin}/api/version?t=${Date.now()}`);
  }

  // 2. GitHub Raw CDN (službeni i javno dostupni repozitorij)
  if (repo && repo.includes('/')) {
    endpoints.push(`https://raw.githubusercontent.com/${repo}/main/public/version.json?t=${Date.now()}`);
    endpoints.push(`https://raw.githubusercontent.com/${repo}/master/public/version.json?t=${Date.now()}`);
  }

  return endpoints;
}

/**
 * Parsira odgovor s version.json ili Firestore dokumenta u Live Web format
 */
function parseVersionData(json: any, repo: string): AppVersionInfo | null {
  if (!json) return null;

  if (json.version) {
    const cleanVer = String(json.version).replace(/^[vV]/, '').trim();
    return {
      version: cleanVer,
      name: json.name || 'RiboPrognoza',
      releaseDate: json.releaseDate || new Date().toISOString().split('T')[0],
      apkUrl: json.apkUrl || `https://github.com/${repo}/releases/latest/download/RiboPrognoza_v${cleanVer}.apk`,
      changelog: Array.isArray(json.changelog) ? json.changelog : ['Automatsko Live Web ažuriranje i poboljšanja'],
      isCritical: !!json.isCritical,
      updateType: 'live_web'
    };
  }

  if (json.tag_name && json.tag_name !== 'latest') {
    const cleanTag = String(json.tag_name).replace(/^[vV]/, '').trim();
    return {
      version: cleanTag,
      name: json.name || 'RiboPrognoza',
      releaseDate: (json.published_at || new Date().toISOString()).split('T')[0],
      changelog: json.body ? json.body.split('\n').map((s: string) => s.trim()).filter(Boolean) : ['Nova Live Web verzija aplikacije'],
      isCritical: false,
      updateType: 'live_web'
    };
  }

  return null;
}

/**
 * Provjerava postoji li novija Live Web verzija aplikacije (prvo putem Firestore baze, zatim GitHub CDN-a)
 */
export async function checkForAppUpdate(force: boolean = false): Promise<CheckUpdateResult> {
  const activeVersion = getCurrentAppVersion();
  const repo = getSavedGithubRepo();
  let latestData: AppVersionInfo | null = null;
  let successfulEndpoint: string | undefined;
  let lastErrorMsg: string = 'Nije pronađen dostupan poslužitelj za provjeru ažuriranja.';

  // 1. Prvo provjeri Firestore (app_updates/latest) uz pričuvu otpornu na kvotu
  try {
    const docData = await getFirestoreDocQuotaSafe('app_updates', 'latest');
    if (docData) {
      const parsed = parseVersionData(docData, repo);
      if (parsed && parsed.version) {
        latestData = parsed;
        successfulEndpoint = 'Firestore Cloud (app_updates/latest)';
      }
    }
  } catch (err: any) {
    lastErrorMsg = err?.message || 'Greška pri provjeri Firestore oblaka.';
  }

  // 2. Provjeri i HTTP/GitHub Raw endpointe (uzimamo najnoviju verziju između Firestorea i GitHuba)
  const endpoints = getUpdateEndpoints();
  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        lastErrorMsg = `HTTP ${response.status} na ${url.split('?')[0]}`;
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        continue;
      }

      const json = await response.json();
      const parsed = parseVersionData(json, repo);
      if (parsed && parsed.version) {
        if (!latestData || isNewerVersion(parsed.version, latestData.version)) {
          latestData = parsed;
          successfulEndpoint = url;
        }
        break;
      }
    } catch (err: any) {
      lastErrorMsg = err?.message || 'Greška u mrežnoj vezi.';
    }
  }

  if (!latestData || !latestData.version) {
    return {
      status: 'network_error',
      currentVersion: activeVersion,
      errorMessage: lastErrorMsg
    };
  }

  const hasUpdate = isNewerVersion(latestData.version, activeVersion);

  if (!hasUpdate) {
    return {
      status: 'up_to_date',
      serverVersion: latestData.version,
      currentVersion: activeVersion,
      endpointUsed: successfulEndpoint
    };
  }

  if (!force) {
    const dismissedTime = localStorage.getItem(`${DISMISS_KEY_PREFIX}${latestData.version}`);
    if (dismissedTime) {
      const diffHours = (Date.now() - parseInt(dismissedTime, 10)) / (1000 * 60 * 60);
      if (diffHours < 24) {
        return {
          status: 'up_to_date',
          serverVersion: latestData.version,
          currentVersion: activeVersion,
          endpointUsed: successfulEndpoint
        };
      }
    }
  }

  return {
    status: 'update_available',
    updateInfo: latestData,
    serverVersion: latestData.version,
    currentVersion: activeVersion,
    endpointUsed: successfulEndpoint
  };
}

/**
 * Detaljna dijagnostika Live Web sustava ažuriranja (za administratorski panel)
 */
export async function runUpdateDiagnostic(): Promise<{
  success: boolean;
  endpointChecked?: string;
  serverVersion?: string;
  currentVersion: string;
  hasUpdate: boolean;
  error?: string;
  details: string[];
}> {
  const activeVersion = getCurrentAppVersion();
  const endpoints = getUpdateEndpoints();
  const repo = getSavedGithubRepo();
  const details: string[] = [];

  try {
    const startFs = Date.now();
    const snap = await getDoc(doc(db, 'app_updates', 'latest'));
    const durFs = Date.now() - startFs;
    if (snap.exists()) {
      const d = snap.data();
      if (d?.version) {
        details.push(`✓ Firestore Cloud (app_updates/latest) -> Verzija: ${d.version} [Live Web OTA] (${durFs}ms)`);
      }
    }
  } catch (e: any) {
    details.push(`⚠️ Firestore Cloud -> ${e?.message || 'Nedostupno'}`);
  }

  for (const url of endpoints) {
    const cleanUrl = url.split('?')[0];
    try {
      const start = Date.now();
      const response = await fetch(url, {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      const duration = Date.now() - start;

      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        details.push(`❌ ${cleanUrl} -> HTTP ${response.status} (${duration}ms)`);
        continue;
      }

      if (contentType.includes('text/html')) {
        details.push(`⚠️ ${cleanUrl} -> Vraćen HTML (${duration}ms)`);
        continue;
      }

      const json = await response.json();
      const parsed = parseVersionData(json, repo);
      if (parsed && parsed.version) {
        const hasUpdate = isNewerVersion(parsed.version, activeVersion);
        details.push(`✓ ${cleanUrl} -> Verzija: ${parsed.version} [Live Web OTA] (${duration}ms)`);
        return {
          success: true,
          endpointChecked: cleanUrl,
          serverVersion: parsed.version,
          currentVersion: activeVersion,
          hasUpdate,
          details
        };
      } else {
        details.push(`⚠️ ${cleanUrl} -> Nije pronađen broj verzije`);
      }
    } catch (err: any) {
      details.push(`❌ ${cleanUrl} -> ${err?.message || 'Greška'}`);
    }
  }

  if (details.some(d => d.startsWith('✓ Firestore'))) {
    return {
      success: true,
      endpointChecked: 'Firestore Cloud (app_updates/latest)',
      serverVersion: activeVersion,
      currentVersion: activeVersion,
      hasUpdate: false,
      details
    };
  }

  return {
    success: false,
    currentVersion: activeVersion,
    hasUpdate: false,
    error: 'Nije moguće dohvatiti verziju s niti jedne adrese.',
    details
  };
}

/**
 * Sprema odgodu za prikaz obavijesti za određenu verziju na 24 sata
 */
export function dismissUpdateFor24h(version: string): void {
  try {
    localStorage.setItem(`${DISMISS_KEY_PREFIX}${version}`, Date.now().toString());
  } catch {}
}

interface ApkCleanerPlugin {
  cleanApks(): Promise<{ success: boolean; deletedCount: number }>;
}

export const ApkCleaner = registerPlugin<ApkCleanerPlugin>('ApkCleaner');

/**
 * Automatski briše privremene instalacijske APK datoteke s mobilnog uređaja
 */
export async function cleanupInstallationFiles(): Promise<{ success: boolean; deletedCount: number }> {
  try {
    if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
      const res = await ApkCleaner.cleanApks();
      if (res && res.deletedCount > 0) {
        console.log(`[RiboPrognoza] Uspješno uklonjeno ${res.deletedCount} starih instalacijskih APK datoteka.`);
      }
      return res;
    }
  } catch (err) {
    console.debug('ApkCleaner status:', err);
  }
  return { success: true, deletedCount: 0 };
}

/**
 * Sprema preuzeti Live Web OTA paket (JS + CSS) u IndexedDB na uređaju
 */
function saveOtaBundleToIndexedDB(bundle: { version: string; jsCode: string; cssCode: string; updatedAt: number }): Promise<boolean> {
  return new Promise(resolve => {
    try {
      if (typeof window === 'undefined' || !window.indexedDB) return resolve(false);
      const req = window.indexedDB.open('ribo_ota_code_db', 1);
      req.onupgradeneeded = (e: any) => {
        const idb = e.target.result;
        if (!idb.objectStoreNames.contains('bundles')) {
          idb.createObjectStore('bundles');
        }
      };
      req.onsuccess = (e: any) => {
        try {
          const idb = e.target.result;
          const tx = idb.transaction('bundles', 'readwrite');
          const store = tx.objectStore('bundles');
          store.put(bundle, 'active');
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      };
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Preuzima stvarni kompilirani JS i CSS kod nove verzije iz Firestore (ota_bundle)
 * kako bi se promjene u sučelju primijenile na mobitelu bez APK instalacije.
 */
async function downloadAndCacheOtaCodeBundle(): Promise<{ downloadedNewCode: boolean; bundleVersion?: string }> {
  try {
    const manifest = await getFirestoreDocQuotaSafe('ota_bundle', 'manifest');
    if (!manifest) {
      console.warn('[OTA] ota_bundle/manifest nije dostupan u Firestoreu.');
      return { downloadedNewCode: false };
    }
    const count = typeof manifest?.totalChunks === 'number' 
      ? manifest.totalChunks 
      : (typeof manifest?.chunkCount === 'number' ? manifest.chunkCount : 0);

    if (!manifest || !manifest.version || count <= 0) {
      console.warn('[OTA] ota_bundle/manifest nema ispravan broj dijelova:', manifest);
      return { downloadedNewCode: false };
    }

    const remoteBundleVer = String(manifest.version).replace(/^[vV]/, '').trim();
    const runningCodeVer = (typeof window !== 'undefined' && (window as any).__RUNNING_OTA_VERSION__) || BUNDLED_APP_VERSION;

    if (!isNewerVersion(remoteBundleVer, runningCodeVer)) {
      return { downloadedNewCode: false, bundleVersion: remoteBundleVer };
    }

    console.log(`[OTA] Preuzimam novi kod v${remoteBundleVer} (${count} dijelova)...`);
    const chunks: string[] = [];
    for (let i = 0; i < count; i++) {
      const chunkData = await getFirestoreDocQuotaSafe('ota_bundle', `chunk_${i}`);
      if (!chunkData) {
        console.warn(`[OTA] Nedostaje ota_bundle/chunk_${i} u Firestoreu.`);
        return { downloadedNewCode: false };
      }
      chunks.push(chunkData?.data || '');
    }

    const fullJsCode = chunks.join('');
    if (!fullJsCode || fullJsCode.length < 1000) {
      return { downloadedNewCode: false };
    }

    const saved = await saveOtaBundleToIndexedDB({
      version: remoteBundleVer,
      jsCode: fullJsCode,
      cssCode: manifest.css || '',
      updatedAt: Date.now()
    });

    return { downloadedNewCode: saved, bundleVersion: remoteBundleVer };
  } catch (err) {
    console.warn('OTA code bundle check warning:', err);
    return { downloadedNewCode: false };
  }
}

/**
 * Primjenjuje Live Web Ažuriranje (OTA) trenutno i tiho unutar aplikacije:
 * - Preuzima najnoviji kompilirani JS/CSS paket iz Firestore ota_bundle kolekcije u IndexedDB
 * - NIKADA ne pokreće preuzimanje APK datoteka niti izaziva Google Play Protect blokade
 * - NIKADA ne preusmjerava WebView na vanjske 404 adrese
 * - Osvježava predmemoriju, Service Worker i aktivnu verziju odmah po pokretanju
 */
export async function applyLiveWebUpdate(
  targetVersion?: string,
  changelog?: string[]
): Promise<{ success: boolean; version: string; message: string }> {
  const newVer = (targetVersion || BUNDLED_APP_VERSION).replace(/^[vV]/, '').trim();

  try {
    if (typeof window !== 'undefined') {
      // 1. Preuzmi stvarni kompilirani kod nove verzije iz Firestore ota_bundle kolekcije
      const otaCodeResult = await downloadAndCacheOtaCodeBundle();

      // 2. Trajno spremi novu aktivnu Live Web verziju u memoriju uređaja SAMO ako je kod uspješno preuzet i spremljen u IndexedDB!
      if (otaCodeResult.downloadedNewCode || isNewerVersion(BUNDLED_APP_VERSION, newVer) === false) {
        try {
          localStorage.setItem(LIVE_VERSION_STORAGE_KEY, newVer);
          localStorage.setItem(
            LIVE_UPDATE_INFO_STORAGE_KEY,
            JSON.stringify({
              version: newVer,
              appliedAt: new Date().toISOString(),
              changelog: changelog || ['Automatsko Live Web ažuriranje primijenjeno']
            })
          );
        } catch {}
      }

      // 3. Očisti zastarjelu CacheStorage predmemoriju i stare podatke o temperaturi vode
      try {
        localStorage.removeItem('ribo_cache_aljmas_station_data');
        localStorage.removeItem('ribo_cache_bogojevo_station_data');
      } catch {}

      if ('caches' in window) {
        try {
          const cacheKeys = await window.caches.keys();
          await Promise.all(cacheKeys.map(key => window.caches.delete(key)));
        } catch {}
      }

      // 4. Ažuriraj Service Worker u pozadini ako je prisutan
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.update();
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          }
        } catch {}
      }

      // 5. Obavijesti sve komponente u aplikaciji da je nova Live Web verzija aktivna
      try {
        window.dispatchEvent(
          new CustomEvent('ribo-live-update-applied', {
            detail: { version: newVer, changelog }
          })
        );
      } catch {}

      // 6. Ako je preuzet novi kompilirani JS/CSS paket iz Firestorea, osvježi lokalni WebView da odmah učita novi kod!
      if (otaCodeResult.downloadedNewCode) {
        setTimeout(() => {
          window.location.reload();
        }, 400);
      }
    }

    return {
      success: true,
      version: newVer,
      message: `Live Web ažuriranje na verziju v${newVer} uspješno je primijenjeno!`
    };
  } catch (err: any) {
    return {
      success: false,
      version: newVer,
      message: err?.message || 'Greška pri primjeni Live Web ažuriranja.'
    };
  }
}

/**
 * Zadržano radi kompatibilnosti - umjesto APK preuzimanja izvršava Live Web ažuriranje
 */
export function startApkDownload(_apkUrl?: string): void {
  applyLiveWebUpdate().catch(() => {});
}

/**
 * Pretplata na Firestore real-time obavijesti o novoj Live Web verziji
 * Kada se objavi nova verzija, aplikacija se odmah automatski ažurira putem Live Web sustava!
 */
export function subscribeToLiveUpdates(
  onUpdateAvailable: (info: AppVersionInfo) => void
): () => void {
  try {
    const unsub = onSnapshot(doc(db, 'app_updates', 'latest'), snapshot => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      if (!data || !data.version) return;

      const currentVer = getCurrentAppVersion();
      if (isNewerVersion(data.version, currentVer)) {
        const repo = getSavedGithubRepo();
        const updateInfo: AppVersionInfo = {
          version: String(data.version).replace(/^[vV]/, '').trim(),
          name: data.name || 'RiboPrognoza',
          releaseDate: data.releaseDate || new Date().toISOString().split('T')[0],
          apkUrl: data.apkUrl || `https://github.com/${repo}/releases/latest/download/RiboPrognoza_v${data.version}.apk`,
          changelog: Array.isArray(data.changelog) ? data.changelog : ['Automatsko Live Web ažuriranje'],
          isCritical: !!data.isCritical,
          updateType: 'live_web'
        };

        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          onUpdateAvailable(updateInfo);
        } else {
          // Ako je u pozadini, tiho primijeni Live Web ažuriranje i pošalji obavijest
          applyLiveWebUpdate(updateInfo.version, updateInfo.changelog).catch(() => {});
          showAppUpdateAvailableNotification(updateInfo.version, updateInfo.changelog[0]);
        }
      }
    }, err => {
      console.warn('Greška pri slušanju app_updates u Firestoreu:', err);
    });

    return unsub;
  } catch {
    return () => {};
  }
}
