/**
 * Sustav za provjeru i instalaciju novih verzija aplikacije (OTA In-App Updater)
 * Autor: Daniel Čizmar
 */

export const CURRENT_APP_VERSION = '1.1.0';

// Glavni online poslužitelj aplikacije u oblaku (Cloud Run)
// Čak i kada se aplikacija vrti na mobitelu unutar Android APK-a (gdje je lokalna domena http://localhost),
// aplikacija se spaja na ovaj stvarni internet poslužitelj kako bi provjerila najnoviju verziju.
export const PRIMARY_CLOUD_API_URL = 'https://ais-dev-w265pmwlescn6ezxznnwhn-294488753863.europe-west2.run.app';

export interface AppVersionInfo {
  version: string;
  name: string;
  releaseDate: string;
  apkUrl: string;
  changelog: string[];
  isCritical?: boolean;
}

/**
 * Uspoređuje dvije semantičke verzije (npr. '1.1.0' > '1.0.0')
 * Vraća true ako je remoteVer novija od currentVer
 */
export function isNewerVersion(remoteVer: string, currentVer: string): boolean {
  if (!remoteVer || !currentVer) return false;

  const remoteParts = remoteVer.replace(/^[vV]/, '').split('.').map(n => parseInt(n, 10) || 0);
  const currentParts = currentVer.replace(/^[vV]/, '').split('.').map(n => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(remoteParts.length, currentParts.length); i++) {
    const r = remoteParts[i] || 0;
    const c = currentParts[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }

  return false;
}

const DISMISS_KEY_PREFIX = 'ribo_dismissed_update_';
const CUSTOM_SERVER_KEY = 'ribo_custom_update_server';

/**
 * Vraća listu svih online adresa koje aplikacija redom provjerava za novu verziju
 */
export function getUpdateEndpoints(): string[] {
  const endpoints: string[] = [];
  const custom = typeof window !== 'undefined' ? localStorage.getItem(CUSTOM_SERVER_KEY) : null;

  if (custom && custom.trim()) {
    const cleanCustom = custom.trim().replace(/\/$/, '');
    endpoints.push(`${cleanCustom}/api/version?t=${Date.now()}`);
    endpoints.push(`${cleanCustom}/version.json?t=${Date.now()}`);
  }

  // 1. Primarni Cloud Run poslužitelj
  endpoints.push(`${PRIMARY_CLOUD_API_URL}/api/version?t=${Date.now()}`);
  endpoints.push(`${PRIMARY_CLOUD_API_URL}/version.json?t=${Date.now()}`);

  // 2. Ako se otvara u web pregledniku na samom serveru (ne u APK localhostu)
  if (typeof window !== 'undefined' && !window.location.origin.includes('localhost') && !window.location.protocol.startsWith('capacitor')) {
    endpoints.push(`/api/version?t=${Date.now()}`);
    endpoints.push(`/version.json?t=${Date.now()}`);
  }

  return endpoints;
}

/**
 * Provjerava postoji li novija verzija aplikacije na internet poslužitelju
 * @param force Ako je true, ignorira prethodno odabrano "Podsjeti me kasnije"
 */
export async function checkForAppUpdate(force: boolean = false): Promise<AppVersionInfo | null> {
  try {
    const endpoints = getUpdateEndpoints();
    let data: AppVersionInfo | null = null;

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(6000)
        });

        if (response.ok) {
          const json = await response.json();
          if (json && json.version) {
            data = json;
            break;
          }
        }
      } catch (e) {
        // Pokušaj sljedeći online endpoint
      }
    }

    if (!data || !data.version) {
      return null;
    }

    // Provjeri je li verzija na internet poslužitelju novija od instalirane na mobitelu
    const hasUpdate = isNewerVersion(data.version, CURRENT_APP_VERSION);
    if (!hasUpdate) {
      return null;
    }

    // Ako nije forsirana provjera, provjeri je li korisnik odabrao "Podsjeti me kasnije" unutar zadnjih 24 sata
    if (!force) {
      const dismissedTime = localStorage.getItem(`${DISMISS_KEY_PREFIX}${data.version}`);
      if (dismissedTime) {
        const diffHours = (Date.now() - parseInt(dismissedTime, 10)) / (1000 * 60 * 60);
        if (diffHours < 24) {
          return null; // Nemoj dosađivati unutar 24 sata
        }
      }
    }

    return data;
  } catch (err) {
    console.warn('Greška pri provjeri nadogradnje:', err);
    return null;
  }
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
  rawResponse?: any;
}> {
  const endpoints = getUpdateEndpoints();
  let lastError = 'Nije moguće uspostaviti vezu';

  for (const url of endpoints) {
    try {
      const start = Date.now();
      const response = await fetch(url, {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(7000)
      });

      if (response.ok) {
        const json = await response.json();
        const duration = Date.now() - start;
        if (json && json.version) {
          const hasUpdate = isNewerVersion(json.version, CURRENT_APP_VERSION);
          return {
            success: true,
            endpointChecked: `${url.split('?')[0]} (${duration}ms)`,
            serverVersion: json.version,
            currentVersion: CURRENT_APP_VERSION,
            hasUpdate,
            rawResponse: json
          };
        }
      } else {
        lastError = `Poslužitelj ${url.split('?')[0]} vratio status: ${response.status}`;
      }
    } catch (err: any) {
      lastError = err?.message || 'Greška u mreži';
    }
  }

  return {
    success: false,
    currentVersion: CURRENT_APP_VERSION,
    hasUpdate: false,
    error: lastError
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

/**
 * Pokreće preuzimanje i instalaciju novog APK-a
 */
export function startApkDownload(apkUrl: string): void {
  if (!apkUrl) return;

  // Izravno preuzimanje APK datoteke
  // Na Androidu, preuzimanje APK-a automatski pokreće Package Installer za nadogradnju.
  if (typeof window !== 'undefined') {
    window.open(apkUrl, '_blank');
  }
}
