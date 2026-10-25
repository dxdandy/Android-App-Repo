/**
 * Sustav za provjeru i instalaciju novih verzija aplikacije (OTA In-App Updater)
 * Autor: Daniel Čizmar
 */

export const CURRENT_APP_VERSION = '1.0.1';

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

/**
 * Provjerava postoji li novija verzija aplikacije na serveru/GitHubu
 * @param force Ako je true, ignorira prethodno odabrano "Podsjeti me kasnije"
 */
export async function checkForAppUpdate(force: boolean = false): Promise<AppVersionInfo | null> {
  try {
    // 1. Pokušaj dohvata sa statičkog /version.json ili /api/version
    const endpoints = [
      `/version.json?t=${Date.now()}`,
      `/api/version?t=${Date.now()}`
    ];

    let data: AppVersionInfo | null = null;

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          data = await response.json();
          if (data && data.version) break;
        }
      } catch {
        // Probaj sljedeći endpoint
      }
    }

    if (!data || !data.version) {
      return null;
    }

    // Provjeri je li verzija novija od instalirane
    const hasUpdate = isNewerVersion(data.version, CURRENT_APP_VERSION);
    if (!hasUpdate) {
      return null;
    }

    // Ako nije forsirana provjera, provjeri je li korisnik odabrao "Podsjeti me kasnije" u zadnjih 24 sata
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

  // Otvara izravno preuzimanje APK datoteke.
  // Na Androidu, preuzimanje APK-a automatski pokreće Package Installer za nadogradnju.
  const link = document.createElement('a');
  link.href = apkUrl;
  link.setAttribute('download', 'RiboPrognoza.apk');
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
