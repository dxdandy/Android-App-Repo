/**
 * Sustav za provjeru i instalaciju novih verzija aplikacije (OTA In-App Updater)
 * Autor: Daniel Čizmar
 * GitHub: dxdandy/Android-App-Repo
 */

export const CURRENT_APP_VERSION = '1.1.5';

export interface AppVersionInfo {
  version: string;
  name: string;
  releaseDate: string;
  apkUrl: string;
  changelog: string[];
  isCritical?: boolean;
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

  // 1. GitHub Raw CDN (javni i brzi CDN)
  if (repo && repo.includes('/')) {
    endpoints.push(`https://raw.githubusercontent.com/${repo}/main/public/version.json?t=${Date.now()}`);
    endpoints.push(`https://raw.githubusercontent.com/${repo}/master/public/version.json?t=${Date.now()}`);
    endpoints.push(`https://api.github.com/repos/${repo}/releases/latest?t=${Date.now()}`);
  }

  // 2. Ako se otvara u web pregledniku na samom poslužitelju (ne u APK localhostu)
  if (typeof window !== 'undefined' && !window.location.origin.includes('localhost') && !window.location.protocol.startsWith('capacitor')) {
    endpoints.push(`${window.location.origin}/api/version?t=${Date.now()}`);
    endpoints.push(`${window.location.origin}/version.json?t=${Date.now()}`);
  }

  return endpoints;
}

/**
 * Parsira odgovor bilo s običnog version.json ili s GitHub Releases API-ja
 */
function parseVersionData(json: any, repo: string): AppVersionInfo | null {
  if (!json) return null;

  // Format 1: version.json
  if (json.version) {
    return {
      version: json.version.replace(/^[vV]/, '').trim(),
      name: json.name || 'RiboPrognoza',
      releaseDate: json.releaseDate || new Date().toISOString().split('T')[0],
      apkUrl: json.apkUrl || `https://github.com/${repo}/releases/latest/download/RiboPrognoza.apk`,
      changelog: Array.isArray(json.changelog) ? json.changelog : ['Redovna ažuriranja i poboljšanja'],
      isCritical: !!json.isCritical
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
      apkUrl: apkAsset?.browser_download_url || `https://github.com/${repo}/releases/latest/download/RiboPrognoza.apk`,
      changelog: json.body ? json.body.split('\n').map((s: string) => s.trim()).filter(Boolean) : ['Nova verzija aplikacije'],
      isCritical: false
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

/**
 * Pokreće preuzimanje i instalaciju novog APK-a
 */
export function startApkDownload(apkUrl: string): void {
  const repo = getSavedGithubRepo();
  const finalUrl = apkUrl || `https://github.com/${repo}/releases/latest/download/RiboPrognoza.apk`;

  if (typeof window !== 'undefined') {
    window.open(finalUrl, '_blank');
  }
}
