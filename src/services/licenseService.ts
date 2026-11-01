/**
 * Sustav licenci i zaštite aplikacije (Hardverski ID uređaja + Centralni registar i opoziv)
 * Autor: Daniel Čizmar
 */

const SECRET_SALT = 'DUNAV_ZANDER_DANIEL_CIZMAR_2026_PROTECT_KEY';
export const ADMIN_MASTER_PIN = '2026'; // PIN za pristup Danielovom generatoru i admin panelu

export interface LicenseRecord {
  deviceId: string;
  activationKey: string;
  userName: string;
  status: 'active' | 'revoked';
  chatEnabled?: boolean;
  createdAt: string;
  lastSeenAt: string;
  notes?: string;
}

// Jednostavna i pouzdana funkcija za hashiranje (radi 100% offline bez vanjskih paketa)
function hashString(str: string): number[] {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  
  return [Math.abs(h1), Math.abs(h2)];
}

/**
 * Dohvaća ili stvara trajni jedinstveni ID uređaja (npr. RP-8B3E-72C9)
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'RP-0000-0000';
  
  let deviceId = localStorage.getItem('ribo_device_id');
  if (!deviceId || !deviceId.startsWith('RP-')) {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let part1 = '';
    let part2 = '';
    for (let i = 0; i < 4; i++) {
      part1 += chars.charAt(Math.floor(Math.random() * chars.length));
      part2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    deviceId = `RP-${part1}-${part2}`;
    localStorage.setItem('ribo_device_id', deviceId);
  }
  return deviceId;
}

/**
 * Dohvaća spremljeni aktivacijski ključ
 */
export function getStoredActivationKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('ribo_activation_key') || '';
}

/**
 * Dohvaća ime trenutnog korisnika dodijeljeno u bazi ili lokalno
 */
export function getUserName(): string {
  if (typeof window === 'undefined') return 'Ribič';
  const saved = localStorage.getItem('ribo_user_name');
  if (saved && saved.trim()) return saved;
  const devId = getDeviceId();
  return `Ribič (${devId.slice(-4)})`;
}

export function setStoredUserName(name: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('ribo_user_name', name.trim());
}

/**
 * Matematički generator: Iz ID-a uređaja izračunava točan aktivacijski ključ
 * Primjer: RP-4A9B-8C2D -> AKT-7E2F-9A4B
 */
export function generateActivationKey(deviceId: string): string {
  const cleanId = deviceId.trim().toUpperCase();
  const input = `${cleanId}:${SECRET_SALT}`;
  const [h1, h2] = hashString(input);

  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let block1 = '';
  let block2 = '';

  let n1 = h1;
  let n2 = h2;
  for (let i = 0; i < 4; i++) {
    block1 += chars.charAt(n1 % chars.length);
    n1 = Math.floor(n1 / chars.length);
    block2 += chars.charAt(n2 % chars.length);
    n2 = Math.floor(n2 / chars.length);
  }

  return `AKT-${block1}-${block2}`;
}

/**
 * Provjerava je li uneseni ključ ispravan za zadani ID uređaja
 */
export function verifyActivationKey(deviceId: string, enteredKey: string): boolean {
  if (!deviceId || !enteredKey) return false;
  
  const expectedKey = generateActivationKey(deviceId);
  const normalizedEntered = enteredKey.trim().toUpperCase().replace(/\s+/g, '');
  const normalizedExpected = expectedKey.replace(/\s+/g, '');
  
  return normalizedEntered === normalizedExpected;
}

/**
 * Provjerava je li aplikacija trenutno trajno aktivirana na ovom uređaju
 */
export function isAppActivated(): boolean {
  if (typeof window === 'undefined') return true;
  
  // Ako je licenca izričito ukinuta od administratora
  if (localStorage.getItem('ribo_license_revoked') === 'true') {
    return false;
  }

  const currentDeviceId = getDeviceId();
  const storedKey = localStorage.getItem('ribo_activation_key');
  
  if (!storedKey) return false;
  return verifyActivationKey(currentDeviceId, storedKey);
}

/**
 * Pokušava aktivirati aplikaciju s unesenim ključem i registrira je na poslužitelju
 */
// Cloud backend URL kada se aplikacija pokreće unutar Android Capacitor WebViewa
export const CLOUD_BACKEND_URL = 'https://ais-dev-w265pmwlescn6ezxznnwhn-294488753863.europe-west2.run.app';
const LOCAL_LICENSES_CACHE_KEY = 'ribo_admin_licenses_cache';

/**
 * Razrješava ispravan URL API rute ovisno o okruženju (Web preglednik vs. Android Capacitor)
 */
export function getApiUrl(endpoint: string): string {
  if (typeof window === 'undefined') return endpoint;
  
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // U svim web preglednicima (desktop, mobitel, iframe) uvijek koristi relativnu putanju
  // kako ne bi došlo do CORS ili "Failed to fetch" blokada
  const isCapacitorNative = 
    window.location.protocol === 'capacitor:' ||
    (typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.());

  if (isCapacitorNative) {
    return `${CLOUD_BACKEND_URL}${cleanEndpoint}`;
  }
  
  return cleanEndpoint;
}

/**
 * Siguran dohvat JSON odgovora koji nikada ne ruši aplikaciju s greškom "Unexpected token <" ili "Failed to fetch"
 */
export async function safeFetchJson<T>(url: string, options?: RequestInit): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const data = await res.json();
      return { ok: res.ok, status: res.status, data, error: data?.error || data?.message };
    }
    
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return { ok: res.ok, status: res.status, data, error: data?.error || data?.message };
    } catch {
      // Primljen je HTML dokument (npr. SPA index.html fallback u Capacitoru ili 404 stranica)
      return { 
        ok: false, 
        status: res.status, 
        data: null, 
        error: `Poslužitelj privremeno nije vratio tražene podatke (kod: ${res.status}).` 
      };
    }
  } catch (err: any) {
    const errMsg = err?.message?.toLowerCase().includes('failed to fetch')
      ? 'Komunikacija s poslužiteljem trenutno nije uspjela (provjerite internet).'
      : (err?.message || 'Greška u mrežnoj komunikaciji.');
    return { ok: false, status: 0, data: null, error: errMsg };
  }
}

/**
 * Lokalna predmemorija registriranih licenci (osigurava nesmetan rad offline ili u Capacitoru)
 */
export function getLocalLicenses(): LicenseRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_LICENSES_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalLicenses(records: LicenseRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_LICENSES_CACHE_KEY, JSON.stringify(records));
  } catch {}
}

/**
 * Pokušava aktivirati aplikaciju s unesenim ključem i registrira je na poslužitelju
 */
export async function activateApp(key: string, proposedName?: string): Promise<{ success: boolean; message?: string }> {
  const currentDeviceId = getDeviceId();
  if (!verifyActivationKey(currentDeviceId, key)) {
    return { success: false, message: 'Aktivacijski ključ nije ispravan za ovaj uređaj.' };
  }

  const formattedKey = generateActivationKey(currentDeviceId);
  localStorage.setItem('ribo_activation_key', formattedKey);
  localStorage.removeItem('ribo_license_revoked');

  // Registriraj ili provjeri na poslužitelju (koristi getApiUrl za Capacitor)
  try {
    const res = await safeFetchJson<any>(getApiUrl('/api/license/register-or-verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: currentDeviceId,
        activationKey: formattedKey,
        proposedName: proposedName || getUserName()
      })
    });
    
    if (res.data) {
      if (res.data.userName) {
        setStoredUserName(res.data.userName);
      }
      if (res.data.status === 'revoked') {
        localStorage.setItem('ribo_license_revoked', 'true');
        return { success: false, message: 'Vaša licenca je ukinuta od strane administratora.' };
      }
    }
  } catch (err) {
    console.warn('Poslužitelj trenutno nije dostupan, aktivacija spremljena lokalno.');
  }

  return { success: true };
}

/**
 * Provjerava valjanost licence na poslužitelju (provjera opoziva)
 */
export async function verifyLicenseWithServer(): Promise<{ valid: boolean; status: 'active' | 'revoked'; userName: string; message?: string }> {
  const deviceId = getDeviceId();
  const activationKey = getStoredActivationKey();
  
  if (!activationKey) {
    return { valid: false, status: 'revoked', userName: '', message: 'Aplikacija nije aktivirana.' };
  }

  try {
    const res = await safeFetchJson<any>(getApiUrl('/api/license/register-or-verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, activationKey, proposedName: getUserName() })
    });
    
    if (res.ok && res.data) {
      if (res.data.userName) {
        setStoredUserName(res.data.userName);
      }
      if (res.data.status === 'revoked') {
        localStorage.setItem('ribo_license_revoked', 'true');
        return { valid: false, status: 'revoked', userName: res.data.userName || '', message: res.data.message };
      }
      localStorage.removeItem('ribo_license_revoked');
      return { valid: true, status: 'active', userName: res.data.userName || '' };
    }
  } catch {}

  // Ako nema interneta ili poslužitelj vrati grešku, vjerujemo lokalnoj matematičkoj provjeri
  const localValid = verifyActivationKey(deviceId, activationKey);
  return { valid: localValid, status: 'active', userName: getUserName() };
}

/**
 * Deaktivira aplikaciju (korisno za testiranje)
 */
export function deactivateApp(): void {
  localStorage.removeItem('ribo_activation_key');
  localStorage.removeItem('ribo_license_revoked');
}

/**
 * Provjerava administratorski PIN za otvaranje generatora ključeva
 */
export function checkAdminPin(pin: string): boolean {
  return pin.trim() === ADMIN_MASTER_PIN;
}

/* =====================================================================
 * ADMIN POZIVI ZA KONTROLU I OPOZIV LICENCI (S LOKALNOM POUZDANOM POHRANOM)
 * ===================================================================== */

export async function fetchAdminLicenses(pin: string): Promise<LicenseRecord[]> {
  const localList = getLocalLicenses();
  
  const res = await safeFetchJson<{ success: boolean; licenses: LicenseRecord[] }>(
    getApiUrl('/api/admin/licenses'),
    {
      headers: { 'x-admin-pin': pin.trim() }
    }
  );

  if (res.ok && res.data?.licenses) {
    const serverList = res.data.licenses;
    // Spoji zapise tako da server i lokalni podaci ostanu sinkronizirani
    const map = new Map<string, LicenseRecord>();
    localList.forEach(item => map.set(item.deviceId, item));
    serverList.forEach(item => map.set(item.deviceId, item));
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
    );
    saveLocalLicenses(merged);
    return merged;
  }

  // Ako je poslužitelj privremeno nedostupan ili je vratio HTML, vrati lokalne spremljene licence
  return localList;
}

export async function addAdminLicense(
  pin: string,
  payload: {
    deviceId: string;
    userName?: string;
    activationKey?: string;
    status?: 'active' | 'revoked';
    chatEnabled?: boolean;
    notes?: string;
  }
): Promise<LicenseRecord> {
  const cleanId = payload.deviceId.trim().toUpperCase();
  const validKey = payload.activationKey?.trim().toUpperCase() || generateActivationKey(cleanId);
  const cleanName = payload.userName?.trim() || `Ribič (${cleanId.slice(-4)})`;
  const cleanStatus = payload.status === 'revoked' ? 'revoked' : 'active';
  const cleanChat = payload.chatEnabled !== false;

  // 1. Uvijek odmah spremi u lokalnu trajnu bazu na uređaju
  const localRecord: LicenseRecord = {
    deviceId: cleanId,
    activationKey: validKey,
    userName: cleanName,
    status: cleanStatus,
    chatEnabled: cleanChat,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    notes: payload.notes?.trim() || ''
  };

  const currentLocal = getLocalLicenses();
  const existingIdx = currentLocal.findIndex(l => l.deviceId === cleanId);
  if (existingIdx >= 0) {
    currentLocal[existingIdx] = { ...currentLocal[existingIdx], ...localRecord };
  } else {
    currentLocal.unshift(localRecord);
  }
  saveLocalLicenses(currentLocal);

  // 2. Pošalji na poslužitelj putem sigurne rute bez rušenja na HTML
  const res = await safeFetchJson<{ success: boolean; license: LicenseRecord }>(
    getApiUrl('/api/admin/licenses/add'),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': pin.trim()
      },
      body: JSON.stringify({
        deviceId: cleanId,
        userName: cleanName,
        activationKey: validKey,
        status: cleanStatus,
        chatEnabled: cleanChat,
        notes: payload.notes
      })
    }
  );

  if (res.ok && res.data?.license) {
    // Ažuriraj lokalnu bazu sa poslužiteljskim podacima
    const updated = getLocalLicenses().map(l => l.deviceId === cleanId ? res.data!.license : l);
    saveLocalLicenses(updated);
    return res.data.license;
  }

  // Vrati lokalno kreiran i potvrđen zapis čak i ako poslužitelj nije vratio JSON
  return localRecord;
}

export async function updateAdminLicense(
  pin: string, 
  payload: { 
    deviceId: string; 
    userName?: string; 
    status?: 'active' | 'revoked'; 
    chatEnabled?: boolean;
    notes?: string;
  }
): Promise<LicenseRecord> {
  const cleanId = payload.deviceId.trim().toUpperCase();

  // 1. Ažuriraj lokalnu bazu odmah
  const currentLocal = getLocalLicenses();
  const target = currentLocal.find(l => l.deviceId === cleanId);
  if (target) {
    if (typeof payload.userName === 'string') target.userName = payload.userName.trim();
    if (payload.status) target.status = payload.status;
    if (typeof payload.chatEnabled === 'boolean') target.chatEnabled = payload.chatEnabled;
    if (typeof payload.notes === 'string') target.notes = payload.notes.trim();
    saveLocalLicenses(currentLocal);
  }

  // 2. Pošalji na poslužitelj sigurno
  const res = await safeFetchJson<{ success: boolean; license: LicenseRecord }>(
    getApiUrl('/api/admin/licenses/update'),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': pin.trim()
      },
      body: JSON.stringify(payload)
    }
  );

  if (res.ok && res.data?.license) {
    return res.data.license;
  }

  if (target) return target;

  // Fallback ako još nije postojao u lokalnoj bazi
  return {
    deviceId: cleanId,
    activationKey: generateActivationKey(cleanId),
    userName: payload.userName || `Ribič (${cleanId.slice(-4)})`,
    status: payload.status || 'active',
    chatEnabled: payload.chatEnabled !== false,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    notes: payload.notes || ''
  };
}

export async function deleteAdminLicense(pin: string, deviceId: string): Promise<boolean> {
  const cleanId = deviceId.trim().toUpperCase();
  
  // Ukloni lokalno odmah
  const updated = getLocalLicenses().filter(l => l.deviceId !== cleanId);
  saveLocalLicenses(updated);

  try {
    await safeFetchJson(getApiUrl(`/api/admin/licenses/${encodeURIComponent(cleanId)}`), {
      method: 'DELETE',
      headers: { 'x-admin-pin': pin.trim() }
    });
  } catch {}

  return true;
}
