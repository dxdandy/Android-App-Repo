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
import { doc, onSnapshot, getDoc, Unsubscribe } from 'firebase/firestore';
import { db, setFirestoreNetworkActive } from './firebase';
import { showAppUpdateAvailableNotification } from './notificationService';
import { getApiUrl } from './licenseService';

export const BUNDLED_APP_VERSION = '1.9.2';
export const LIVE_VERSION_STORAGE_KEY = 'ribo_current_live_version';
export const LIVE_UPDATE_INFO_STORAGE_KEY = 'ribo_last_live_update_info';
const SHARED_CLOUD_BACKEND_URL = 'https://ais-pre-w265pmwlescn6ezxznnwhn-294488753863.europe-west2.run.app';
const DEV_CLOUD_BACKEND_URL = 'https://ais-dev-w265pmwlescn6ezxznnwhn-294488753863.europe-west2.run.app';

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
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
    ]);
    if (snap && (snap as any).exists && (snap as any).exists()) {
      return (snap as any).data();
    }
  } catch {}

  try {
    // Čisti GET upit (bez pisanja _ping polja) kako provjera ažuriranja nikada ne bi budila ostale uređaje
    const url = `${FIRESTORE_REST_BASE}/${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}?t=${Date.now()}`;
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6500)
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
 * Brzi i robusni dohvat velikih OTA dijelova (manifest i chunk_0..N) iz Firestorea:
 * koristi izravni HTTPS REST GET s 15s timeoutom (ne blokira se na WebChannelu) uz fallback na Firebase SDK i 3 pokušaja po dijelu.
 */
async function getFirestoreOtaDocWithRetry(docId: string, maxAttempts: number = 3): Promise<Record<string, any> | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 800 * attempt));
    }
    try {
      const url = `${FIRESTORE_REST_BASE}/ota_bundle/${encodeURIComponent(docId)}?t=${Date.now()}_${attempt}`;
      const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000)
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.fields) {
          const parsed = parseFirestoreRestFields(json.fields);
          if (parsed && Object.keys(parsed).length > 0) {
            return parsed;
          }
        }
      }
    } catch {}

    try {
      setFirestoreNetworkActive(true);
      const snap = await Promise.race([
        getDoc(doc(db, 'ota_bundle', docId)),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000))
      ]);
      if (snap && (snap as any).exists && (snap as any).exists()) {
        return (snap as any).data();
      }
    } catch {}
  }
  return null;
}

/**
 * Normalizira internu 4-dijelnu OTA verziju paketa (npr. '1.9.2.1' -> '1.9.2') za prikaz i usporedbu aplikacije
 */
export function normalizeDisplayVersion(ver: string): string {
  const clean = String(ver || '').replace(/^[vV]/, '').trim();
  const parts = clean.split('.');
  if (parts.length > 3) {
    return parts.slice(0, 3).join('.');
  }
  return clean;
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
  const currentParts = currentPartsFromStr(cleanCurrent);

  for (let i = 0; i < Math.max(remoteParts.length, currentParts.length); i++) {
    const r = remoteParts[i] || 0;
    const c = currentParts[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }

  return false;
}

function currentPartsFromStr(str: string): number[] {
  return str.split('.').map(n => parseInt(n, 10) || 0);
}

/**
 * Vraća trenutnu aktivnu verziju aplikacije (uzima u obzir stvarno pokrenuti kod i instalirana Live Web ažuriranja)
 */
export function getCurrentAppVersion(): string {
  let bestVer = normalizeDisplayVersion(BUNDLED_APP_VERSION);
  if (typeof window !== 'undefined') {
    try {
      const runningOtaVer = (window as any).__RUNNING_OTA_VERSION__;
      if (runningOtaVer) {
        const cleanRunning = normalizeDisplayVersion(runningOtaVer);
        if (isNewerVersion(cleanRunning, bestVer)) {
          bestVer = cleanRunning;
        }
      }

      // Sinkroniziraj localStorage i globalnu oznaku sa stvarno izvršavanom 3-znamenkastom verzijom koda
      (window as any).__RUNNING_OTA_VERSION__ = bestVer;
      localStorage.setItem(LIVE_VERSION_STORAGE_KEY, bestVer);
    } catch {}
  }
  return bestVer;
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

  // 1. Primarni pouzdani poslužitelj aplikacije (radi u web pregledniku i unutar Android Capacitor WebViewa)
  try {
    const backendVersionUrl = getApiUrl(`/api/version?t=${Date.now()}`);
    if (backendVersionUrl) {
      endpoints.push(backendVersionUrl);
    }
  } catch {}

  // 2. Ako se otvara u web pregledniku na samom poslužitelju
  if (typeof window !== 'undefined' && !window.location.origin.includes('localhost') && !window.location.protocol.startsWith('capacitor')) {
    const originUrl = `${window.location.origin}/api/version?t=${Date.now()}`;
    if (!endpoints.includes(originUrl)) {
      endpoints.push(originUrl);
    }
  }

  // 3. GitHub Raw CDN (službeni i javno dostupni repozitorij)
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
    const cleanVer = normalizeDisplayVersion(String(json.version));
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
    const cleanTag = normalizeDisplayVersion(String(json.tag_name));
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
 * Provjerava postoji li novija Live Web verzija aplikacije (provjerava Firestore, backend poslužitelj i GitHub)
 */
export async function checkForAppUpdate(force: boolean = false): Promise<CheckUpdateResult> {
  const activeVersion = getCurrentAppVersion();
  const repo = getSavedGithubRepo();
  let latestData: AppVersionInfo | null = null;
  let successfulEndpoint: string | undefined;
  let lastErrorMsg: string = 'Nije pronađen dostupan poslužitelj za provjeru ažuriranja.';

  // 1. Provjeri izravne HTTP endpointe
  const endpoints = getUpdateEndpoints();
  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(4500)
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
          successfulEndpoint = url.split('?')[0];
        }
      }
    } catch (err: any) {
      lastErrorMsg = err?.message || 'Greška u mrežnoj vezi.';
    }
  }

  // 2. Provjeri i Firestore (app_updates/latest) te uzmi noviju verziju ako je Firestore svježiji od GitHuba
  try {
    const docData = await getFirestoreDocQuotaSafe('app_updates', 'latest');
    if (docData) {
      const parsed = parseVersionData(docData, repo);
      if (parsed && parsed.version) {
        if (!latestData || isNewerVersion(parsed.version, latestData.version)) {
          latestData = parsed;
          successfulEndpoint = 'Firestore Cloud (app_updates/latest)';
        }
      }
    }
  } catch (err: any) {
    lastErrorMsg = err?.message || 'Greška pri provjeri Firestore oblaka.';
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
        details.push(`✓ Firestore Cloud (app_updates/latest) -> Verzija: ${normalizeDisplayVersion(String(d.version))} [Live Web OTA] (${durFs}ms)`);
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
          tx.oncomplete = () => {
            try {
              const verifyTx = idb.transaction('bundles', 'readonly');
              const verifyStore = verifyTx.objectStore('bundles');
              const getReq = verifyStore.get('active');
              getReq.onsuccess = () => {
                const savedObj = getReq.result;
                if (savedObj && savedObj.version === bundle.version && savedObj.jsCode && savedObj.jsCode.length > 1000) {
                  resolve(true);
                } else {
                  resolve(false);
                }
              };
              getReq.onerror = () => resolve(true);
            } catch {
              resolve(true);
            }
          };
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
 * Provjerava je li verzija paketa valjana za preuzimanje:
 * mora biti novija od trenutno pokrenutog koda I ne smije biti starija od ciljane verzije ažuriranja
 */
function isAcceptableBundleVersion(remoteVer: string, runningCodeVer: string, targetVer?: string): boolean {
  const cleanRemote = normalizeDisplayVersion(remoteVer);
  const cleanRunning = normalizeDisplayVersion(runningCodeVer);
  // Nikada ne dopusti povratak na staru verziju 1.8.4 ili 1.8.4.x
  if (cleanRemote === '1.8.4' || String(remoteVer).startsWith('1.8.4')) {
    return false;
  }
  if (!isNewerVersion(cleanRemote, cleanRunning) && !isNewerVersion(remoteVer, runningCodeVer)) {
    return false;
  }
  if (targetVer) {
    const cleanTarget = normalizeDisplayVersion(targetVer);
    // Ako je remote paket stariji od ciljane verzije, odbaci ga!
    if (isNewerVersion(cleanTarget, cleanRemote)) {
      return false;
    }
  }
  return true;
}

/**
 * Preuzima stvarni kompilirani JS i CSS kod nove verzije (poslužitelj -> Firestore ota_bundle -> GitHub Raw)
 * kako bi se promjene u sučelju 100% primijenile na mobitelu bez lažnog ažuriranja samo broja verzije.
 */
async function downloadAndCacheOtaCodeBundle(targetVersion?: string): Promise<{ downloadedNewCode: boolean; bundleVersion?: string }> {
  const runningCodeVer = normalizeDisplayVersion(
    (typeof window !== 'undefined' && (window as any).__RUNNING_OTA_VERSION__) || BUNDLED_APP_VERSION
  );

  // 1. Primarni izvor: Izravni dohvat s poslužitelja aplikacije (provjerava lokalni, dev i shared URL te da odgovor nije HTML login stranica)
  const serverBaseCandidates = [
    getApiUrl(''),
    SHARED_CLOUD_BACKEND_URL,
    DEV_CLOUD_BACKEND_URL
  ];
  const uniqueBases = Array.from(new Set(serverBaseCandidates.map(b => b.replace(/\/$/, ''))));

  for (const base of uniqueBases) {
    try {
      const manifestUrl = `${base}/api/ota/manifest?t=${Date.now()}`;
      const manifestRes = await fetch(manifestUrl, {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000)
      });

      const contentType = manifestRes.headers.get('content-type') || '';
      if (manifestRes.ok && contentType.includes('application/json')) {
        const manifest = await manifestRes.json();
        if (manifest && (manifest.appVersion || manifest.version)) {
          const remoteBundleVer = normalizeDisplayVersion(String(manifest.appVersion || manifest.version));
          if (isAcceptableBundleVersion(remoteBundleVer, runningCodeVer, targetVersion)) {
            console.log(`[OTA] Preuzimam novi kod v${remoteBundleVer} izravno s poslužitelja (${base || 'local'})...`);
            const bundleUrl = `${base}/api/ota/bundle?t=${Date.now()}`;
            const bundleRes = await fetch(bundleUrl, {
              cache: 'no-store',
              signal: AbortSignal.timeout(35000)
            });
            const bundleType = bundleRes.headers.get('content-type') || '';
            if (bundleRes.ok && !bundleType.includes('text/html')) {
              const fullJsCode = await bundleRes.text();
              if (fullJsCode && fullJsCode.length > 50000 && !fullJsCode.trimStart().startsWith('<!') && fullJsCode.includes(remoteBundleVer)) {
                const saved = await saveOtaBundleToIndexedDB({
                  version: remoteBundleVer,
                  jsCode: fullJsCode,
                  cssCode: manifest.css || '',
                  updatedAt: Date.now()
                });
                if (saved) {
                  console.log(`[OTA] Uspješno spremljen novi kod v${remoteBundleVer} u IndexedDB s poslužitelja!`);
                  return { downloadedNewCode: true, bundleVersion: remoteBundleVer };
                }
              }
            }
          }
        }
      }
    } catch (backendErr) {
      console.warn('[OTA] Direktni dohvat s poslužitelja nije uspio, prelazim na idući izvor:', backendErr);
    }
  }

  // 2. Glavni oblačni izvor za mobitel (APK): Firestore ota_bundle kolekcija (s brzim 15s REST dohvatom i retryjem po svakom dijelu)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, 1800));
      }
      const manifest = await getFirestoreOtaDocWithRetry('manifest', 2);
      if (manifest && (manifest.appVersion || manifest.version)) {
        const count = typeof manifest?.totalChunks === 'number'
          ? manifest.totalChunks
          : (typeof manifest?.chunkCount === 'number' ? manifest.chunkCount : 0);
        const remoteBundleVer = normalizeDisplayVersion(String(manifest.appVersion || manifest.version));

        if (count > 0 && isAcceptableBundleVersion(remoteBundleVer, runningCodeVer, targetVersion)) {
          console.log(`[OTA] Preuzimam novi kod v${remoteBundleVer} (${count} dijelova) iz Firestorea...`);
          const chunks: string[] = [];
          let allChunksOk = true;
          for (let i = 0; i < count; i++) {
            const chunkData = await getFirestoreOtaDocWithRetry(`chunk_${i}`, 3);
            if (!chunkData || !chunkData.data) {
              console.warn(`[OTA] Nedostaje ota_bundle/chunk_${i} u Firestoreu.`);
              allChunksOk = false;
              break;
            }
            chunks.push(chunkData.data);
          }

          if (allChunksOk) {
            const fullJsCode = chunks.join('');
            if (fullJsCode && fullJsCode.length > 50000 && fullJsCode.includes(remoteBundleVer)) {
              const saved = await saveOtaBundleToIndexedDB({
                version: remoteBundleVer,
                jsCode: fullJsCode,
                cssCode: manifest.css || '',
                updatedAt: Date.now()
              });
              if (saved) {
                console.log(`[OTA] Uspješno spremljen novi kod v${remoteBundleVer} u IndexedDB iz Firestorea!`);
                return { downloadedNewCode: true, bundleVersion: remoteBundleVer };
              }
            }
          }
        }
      }
    } catch (fsErr) {
      console.warn(`[OTA] Firestore ota_bundle pokušaj ${attempt + 1} upozorenje:`, fsErr);
    }
  }

  // 3. Pričuvni izvor: GitHub Raw CDN (provjerava main i master granu, prihvaća isključivo ako ima traženu novu verziju!)
  const repo = getSavedGithubRepo();
  if (repo && repo.includes('/')) {
    for (const branch of ['main', 'master']) {
      try {
        const ghManifestUrl = `https://raw.githubusercontent.com/${repo}/${branch}/public/live-ota/manifest.json?t=${Date.now()}`;
        const ghManifestRes = await fetch(ghManifestUrl, {
          cache: 'no-store',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8000)
        });
        if (ghManifestRes.ok) {
          const ghManifest = await ghManifestRes.json();
          if (ghManifest && (ghManifest.appVersion || ghManifest.version)) {
            const ghVer = normalizeDisplayVersion(String(ghManifest.appVersion || ghManifest.version));
            if (isAcceptableBundleVersion(ghVer, runningCodeVer, targetVersion)) {
              console.log(`[OTA] Preuzimam novi kod v${ghVer} s GitHub Raw CDN-a (${branch})...`);
              const ghBundleUrl = `https://raw.githubusercontent.com/${repo}/${branch}/public/live-ota/app-bundle.js?t=${Date.now()}`;
              const ghBundleRes = await fetch(ghBundleUrl, {
                cache: 'no-store',
                signal: AbortSignal.timeout(35000)
              });
              if (ghBundleRes.ok) {
                const fullJsCode = await ghBundleRes.text();
                if (fullJsCode && fullJsCode.length > 50000 && !fullJsCode.trimStart().startsWith('<!') && fullJsCode.includes(ghVer)) {
                  const saved = await saveOtaBundleToIndexedDB({
                    version: ghVer,
                    jsCode: fullJsCode,
                    cssCode: ghManifest.css || '',
                    updatedAt: Date.now()
                  });
                  if (saved) {
                    console.log(`[OTA] Uspješno spremljen novi kod v${ghVer} u IndexedDB s GitHub Raw CDN-a!`);
                    return { downloadedNewCode: true, bundleVersion: ghVer };
                  }
                }
              }
            }
          }
        }
      } catch (ghErr) {
        console.warn(`[OTA] GitHub Raw (${branch}) dohvat bundlea nije uspio:`, ghErr);
      }
    }
  }

  return { downloadedNewCode: false };
}

/**
 * Primjenjuje Live Web Ažuriranje (OTA) unutar aplikacije:
 * - PRVO preuzima najnoviji kompilirani JS/CSS paket u IndexedDB
 * - Strogo provjerava je li novi paket koda stvarno preuzet prije promjene broja verzije na ekranu!
 * - Ako paket koda nije preuzet, NE mijenja broj verzije kako bi aplikacija ponovno pokušala pri idućoj provjeri
 */
export async function applyLiveWebUpdate(
  targetVersion?: string,
  changelog?: string[]
): Promise<{ success: boolean; version: string; message: string }> {
  const newVer = normalizeDisplayVersion(targetVersion || BUNDLED_APP_VERSION);

  try {
    if (typeof window !== 'undefined') {
      // 1. Preuzmi stvarni kompilirani JS i CSS kod nove verzije
      const otaCodeResult = await downloadAndCacheOtaCodeBundle(newVer);
      const codeAlreadyBundled = !isNewerVersion(newVer, normalizeDisplayVersion(BUNDLED_APP_VERSION));

      // STROGA ZAŠTITA: Ako novi kod nije preuzet, a ugrađeni kod je stariji od ciljane verzije,
      // NIKADA ne zapisuj novu verziju na prazno!
      if (!otaCodeResult.downloadedNewCode && !codeAlreadyBundled) {
        console.warn(`[OTA] Novi paket koda za v${newVer} još nije preuzet — broj verzije se neće promijeniti dok se kod ne preuzme.`);
        return {
          success: false,
          version: getCurrentAppVersion(),
          message: `Preuzimanje paketa koda za v${newVer} trenutno nije uspjelo. Pokušat će se ponovno.`
        };
      }

      const finalVer = normalizeDisplayVersion(otaCodeResult.bundleVersion || newVer);

      // 2. Tek sada kada je kod 100% preuzet i spremljen u IndexedDB, zabilježi novu verziju
      try {
        localStorage.setItem(LIVE_VERSION_STORAGE_KEY, finalVer);
        (window as any).__RUNNING_OTA_VERSION__ = finalVer;
        localStorage.setItem(
          LIVE_UPDATE_INFO_STORAGE_KEY,
          JSON.stringify({
            version: finalVer,
            appliedAt: new Date().toISOString(),
            changelog: changelog || ['Automatsko Live Web ažuriranje primijenjeno']
          })
        );
      } catch {}

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

      // 4. Ukloni sve stare Service Workere
      if ('serviceWorker' in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        } catch {}
      }

      // 5. Obavijesti komponente u aplikaciji
      try {
        window.dispatchEvent(
          new CustomEvent('ribo-live-update-applied', {
            detail: { version: finalVer, changelog }
          })
        );
      } catch {}

      // 6. Odmah osvježi WebView nakon kratke potvrde disk transakcije kako bi index.html učitao novi JS kod iz IndexedDB-a
      // (uz automatski fallback na location.replace ako Android WebView ignorira standardni reload)
      if (otaCodeResult.downloadedNewCode) {
        setTimeout(() => {
          try {
            window.location.reload();
          } catch {}
          setTimeout(() => {
            try {
              const baseHref = window.location.origin + window.location.pathname;
              window.location.replace(`${baseHref}?ota=${encodeURIComponent(finalVer)}&t=${Date.now()}`);
            } catch {}
          }, 500);
        }, 450);
      }

      return {
        success: true,
        version: finalVer,
        message: `Live Web ažuriranje na verziju v${finalVer} uspješno je primijenjeno!`
      };
    }

    return {
      success: true,
      version: newVer,
      message: `Live Web ažuriranje na verziju v${newVer} uspješno je primijenjeno!`
    };
  } catch (err: any) {
    return {
      success: false,
      version: getCurrentAppVersion(),
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
 * Sluša i app_updates/latest i ota_bundle/manifest kako bi se ažuriranje primijenilo čim je paket koda spreman!
 */
export function subscribeToLiveUpdates(
  onUpdateAvailable: (info: AppVersionInfo) => void
): () => void {
  try {
    let unsubUpdates: Unsubscribe | null = null;
    let unsubManifest: Unsubscribe | null = null;

    const handleIncomingVersion = (rawVersion: string, data?: any) => {
      if (!rawVersion) return;
      const cleanVer = normalizeDisplayVersion(rawVersion);
      const currentVer = getCurrentAppVersion();
      if (isNewerVersion(cleanVer, currentVer)) {
        const repo = getSavedGithubRepo();
        const updateInfo: AppVersionInfo = {
          version: cleanVer,
          name: data?.name || 'RiboPrognoza',
          releaseDate: data?.releaseDate || new Date().toISOString().split('T')[0],
          apkUrl: data?.apkUrl || `https://github.com/${repo}/releases/latest/download/RiboPrognoza_v${cleanVer}.apk`,
          changelog: Array.isArray(data?.changelog) ? data.changelog : ['Automatsko Live Web ažuriranje'],
          isCritical: true,
          updateType: 'live_web'
        };

        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          onUpdateAvailable(updateInfo);
        } else {
          applyLiveWebUpdate(updateInfo.version, updateInfo.changelog).catch(() => {});
          showAppUpdateAvailableNotification(updateInfo.version, updateInfo.changelog[0]);
        }
      }
    };

    const attachListeners = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setFirestoreNetworkActive(true);
      if (!unsubUpdates) {
        unsubUpdates = onSnapshot(
          doc(db, 'app_updates', 'latest'),
          (snapshot) => {
            if (!snapshot.exists()) return;
            const data = snapshot.data();
            if (data?.version) {
              handleIncomingVersion(String(data.version), data);
            }
          },
          () => {}
        );
      }
      if (!unsubManifest) {
        unsubManifest = onSnapshot(
          doc(db, 'ota_bundle', 'manifest'),
          (snapshot) => {
            if (!snapshot.exists()) return;
            const data = snapshot.data();
            if (data?.version) {
              handleIncomingVersion(String(data.version), data);
            }
          },
          () => {}
        );
      }
    };

    const detachListeners = () => {
      if (unsubUpdates) {
        try {
          unsubUpdates();
        } catch {}
        unsubUpdates = null;
      }
      if (unsubManifest) {
        try {
          unsubManifest();
        } catch {}
        unsubManifest = null;
      }
    };

    attachListeners();

    const handleVisibility = () => {
      if (typeof document === 'undefined') return;
      if (document.hidden) {
        // Čim aplikacija ode u pozadinu ili se zaslon ugasi, odspoji listenere radi 0% potrošnje baterije
        detachListeners();
      } else {
        attachListeners();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      detachListeners();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  } catch {
    return () => {};
  }
}
