/**
 * Sustav za provjeru i instalaciju novih verzija aplikacije (OTA In-App Updater)
 * Autor: Daniel Čizmar
 * GitHub: dxdandy/Android-App-Repo
 */

import { registerPlugin } from '@capacitor/core';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { showAppUpdateAvailableNotification } from './notificationService';

export const BUNDLED_APP_VERSION = '1.6.0';

/**
 * Vraća trenutnu aktivnu verziju instalirane aplikacije
 */
export function getCurrentAppVersion(): string {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('ribo_current_live_version');
    } catch {}
  }
  return BUNDLED_APP_VERSION;
}

export const CURRENT_APP_VERSION = getCurrentAppVersion();

export interface AppVersionInfo {
  version: string;
  name: string;
  releaseDate: string;
  apkUrl: string;
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

/**
 * Uspoređuje dvije semantičke verzije (npr. '1.1.0' > '1.0.1')
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
 * Vraća listu svih online adresa koje aplikacija redom provjerava za novu verziju
 */
export function getUpdateEndpoints(): string[] {
  const endpoints: string[] = [];
  const repo = getSavedGithubRepo();

  // 1. GitHub Raw CDN (službeni i javno dostupni repozitorij)
  if (repo && repo.includes('/')) {
    endpoints.push(`https://raw.githubusercontent.com/${repo}/main/public/version.json?t=${Date.now()}`);
    endpoints.push(`https://raw.githubusercontent.com/${repo}/master/public/version.json?t=${Date.now()}`);
    endpoints.push(`https://api.github.com/repos/${repo}/releases/latest?t=${Date.now()}`);
  }

  // 2. Ako se otvara u web pregledniku na samom poslužitelju
  if (typeof window !== 'undefined' && !window.location.origin.includes('localhost') && !window.location.protocol.startsWith('capacitor')) {
    endpoints.push(`${window.location.origin}/api/version?t=${Date.now()}`);
  }

  return endpoints;
}

/**
 * Parsira odgovor bilo s običnog version.json ili s GitHub Releases API-ja
 */
function parseVersionData(json: any, repo: string): AppVersionInfo | null {
  if (!json) return null;

  // Format 1: version.json ili /api/version
  if (json.version) {
    const cleanVer = json.version.replace(/^[vV]/, '').trim();
    return {
      version: cleanVer,
      name: json.name || 'RiboPrognoza',
      releaseDate: json.releaseDate || new Date().toISOString().split('T')[0],
      apkUrl: json.apkUrl || `https://github.com/${repo}/releases/latest/download/RiboPrognoza_v${cleanVer}.apk`,
      changelog: Array.isArray(json.changelog) ? json.changelog : ['Redovna ažuriranja i poboljšanja'],
      isCritical: !!json.isCritical,
      updateType: 'apk'
    };
  }

  // Format 2: GitHub Releases API ({ tag_name: "v1.1.0", ... })
  if (json.tag_name) {
    const cleanTag = json.tag_name.replace(/^[vV]/, '').trim();
    const apkAsset = json.assets?.find((a: any) => typeof a.name === 'string' && a.name.toLowerCase().endsWith('.apk'));
    return {
      version: cleanTag,
      name: json.name || 'RiboPrognoza',
      releaseDate: (json.published_at || new Date().toISOString()).split('T')[0],
      apkUrl: apkAsset?.browser_download_url || `https://github.com/${repo}/releases/latest/download/RiboPrognoza_v${cleanTag}.apk`,
      changelog: json.body ? json.body.split('\n').map((s: string) => s.trim()).filter(Boolean) : ['Nova verzija aplikacije'],
      isCritical: false,
      updateType: 'apk'
    };
  }

  return null;
}

/**
 * Provjerava postoji li novija verzija aplikacije na internet poslužitelju
 * @param force Ako je true, ignorira prethodno odabrano "Podsjeti me kasnije"
 */
export async function checkForAppUpdate(force: boolean = false): Promise<CheckUpdateResult> {
  const endpoints = getUpdateEndpoints();
  const repo = getSavedGithubRepo();
  let latestData: AppVersionInfo | null = null;
  let successfulEndpoint: string | undefined;
  let lastErrorMsg: string = 'Nije pronađen dostupan poslužitelj za provjeru ažuriranja.';

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000)
      });

      if (!response.ok) {
        lastErrorMsg = `HTTP ${response.status} na ${url.split('?')[0]}`;
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        lastErrorMsg = `Poslužitelj je vratio HTML umjesto JSON podataka.`;
        continue;
      }

      const json = await response.json();
      const parsed = parseVersionData(json, repo);
      if (parsed && parsed.version) {
        latestData = parsed;
        successfulEndpoint = url;
        break;
      }
    } catch (err: any) {
      lastErrorMsg = err?.message || 'Greška u mrežnoj vezi.';
    }
  }

  // Ako nijedan endpoint nije vratio valjani JSON
  if (!latestData || !latestData.version) {
    return {
      status: 'network_error',
      currentVersion: CURRENT_APP_VERSION,
      errorMessage: lastErrorMsg
    };
  }

  // Usporedi verzije
  const hasUpdate = isNewerVersion(latestData.version, CURRENT_APP_VERSION);

  if (!hasUpdate) {
    return {
      status: 'up_to_date',
      serverVersion: latestData.version,
      currentVersion: CURRENT_APP_VERSION,
      endpointUsed: successfulEndpoint
    };
  }

  // Provjeri je li korisnik odgodio prikaz za 24h
  if (!force) {
    const dismissedTime = localStorage.getItem(`${DISMISS_KEY_PREFIX}${latestData.version}`);
    if (dismissedTime) {
      const diffHours = (Date.now() - parseInt(dismissedTime, 10)) / (1000 * 60 * 60);
      if (diffHours < 24) {
        return {
          status: 'up_to_date',
          serverVersion: latestData.version,
          currentVersion: CURRENT_APP_VERSION,
          endpointUsed: successfulEndpoint
        };
      }
    }
  }

  return {
    status: 'update_available',
    updateInfo: latestData,
    serverVersion: latestData.version,
    currentVersion: CURRENT_APP_VERSION,
    endpointUsed: successfulEndpoint
  };
}

/**
 * Detaljna dijagnostika veze sa serverom za ažuriranja (za administratorski panel)
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
  const endpoints = getUpdateEndpoints();
  const repo = getSavedGithubRepo();
  const details: string[] = [];

  for (const url of endpoints) {
    const cleanUrl = url.split('?')[0];
    try {
      const start = Date.now();
      const response = await fetch(url, {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000)
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
        const hasUpdate = isNewerVersion(parsed.version, CURRENT_APP_VERSION);
        details.push(`✓ ${cleanUrl} -> Verzija: ${parsed.version} (${duration}ms)`);
        return {
          success: true,
          endpointChecked: cleanUrl,
          serverVersion: parsed.version,
          currentVersion: CURRENT_APP_VERSION,
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

  return {
    success: false,
    currentVersion: CURRENT_APP_VERSION,
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
 * kako ne bi nepotrebno zauzimale korisničku memoriju nakon ažuriranja.
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
 * Pokreće preuzimanje i instalaciju novog APK-a
 * U nativnoj mobilnoj aplikaciji koristi '_system' kako bi preuzimanje preuzeo Android sustav
 * i nikada ne dira unutarnji WebView aplikacije.
 */
export function startApkDownload(apkUrl?: string): void {
  const repo = getSavedGithubRepo();
  const finalUrl = apkUrl || `https://github.com/${repo}/releases/latest/download/RiboPrognoza.apk`;

  try {
    localStorage.setItem('ribo_pending_apk_cleanup', 'true');
  } catch {}

  if (typeof window !== 'undefined') {
    // '_system' osigurava pokretanje vanjskog download managera / preglednika uređaja
    window.open(finalUrl, '_system');
  }
}

/**
 * Primjenjuje ažuriranje aplikacije:
 * - Na webu/PWA: čisti predmemoriju i osvježava stranicu
 * - U nativnoj Android aplikaciji: pokreće preuzimanje APK datoteke bez preusmjeravanja WebView-a
 */
export async function applyLiveWebUpdate(targetVersion?: string, targetApkUrl?: string): Promise<{ success: boolean; message: string }> {
  try {
    if (typeof window !== 'undefined') {
      // 1. Očisti CacheStorage predmemoriju
      if ('caches' in window) {
        try {
          const cacheKeys = await window.caches.keys();
          await Promise.all(cacheKeys.map(key => window.caches.delete(key)));
        } catch {}
      }

      // 2. Ažuriraj Service Worker ako postoji
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

      // 3. Ako je aplikacija unutar nativnog Android Capacitor WebViewa
      const isCapacitorNative = 
        window.location.protocol === 'capacitor:' ||
        (typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.());

      if (isCapacitorNative) {
        startApkDownload(targetApkUrl);
        return { success: true, message: 'Pokrenuto je preuzimanje nove instalacijske datoteke.' };
      }

      // Za standardni web preglednik
      window.location.reload();
      return { success: true, message: 'Aplikacija se osvježava s najnovijom verzijom...' };
    }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Greška pri primjeni ažuriranja.' };
  }
  return { success: true, message: 'Uspješno' };
}

/**
 * Pretplata na Firestore real-time obavijesti o verziji
 * Kada Daniel ili server objave novu verziju u Firestoreu,
 * svi uređaji dobivaju obavijest u roku od 1 sekunde!
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
          version: data.version,
          name: data.name || 'RiboPrognoza',
          releaseDate: data.releaseDate || new Date().toISOString().split('T')[0],
          apkUrl: data.apkUrl || `https://github.com/${repo}/releases/latest/download/RiboPrognoza_v${data.version}.apk`,
          changelog: Array.isArray(data.changelog) ? data.changelog : ['Nova verzija aplikacije'],
          isCritical: !!data.isCritical,
          updateType: 'apk'
        };

        // Ako je korisnik u aplikaciji:
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          onUpdateAvailable(updateInfo);
        } else {
          // Ako je aplikacija u pozadini: pošalji sistemsku obavijest s ikonom udice
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
