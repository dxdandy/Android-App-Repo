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
export async function activateApp(key: string, proposedName?: string): Promise<{ success: boolean; message?: string }> {
  const currentDeviceId = getDeviceId();
  if (!verifyActivationKey(currentDeviceId, key)) {
    return { success: false, message: 'Aktivacijski ključ nije ispravan za ovaj uređaj.' };
  }

  const formattedKey = generateActivationKey(currentDeviceId);
  localStorage.setItem('ribo_activation_key', formattedKey);
  localStorage.removeItem('ribo_license_revoked');

  // Registriraj ili provjeri na poslužitelju
  try {
    const res = await fetch('/api/license/register-or-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: currentDeviceId,
        activationKey: formattedKey,
        proposedName: proposedName || getUserName()
      })
    });
    const data = await res.json();
    if (data.userName) {
      setStoredUserName(data.userName);
    }
    if (data.status === 'revoked') {
      localStorage.setItem('ribo_license_revoked', 'true');
      return { success: false, message: 'Vaša licenca je ukinuta od strane administratora.' };
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
    const res = await fetch('/api/license/register-or-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, activationKey, proposedName: getUserName() })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { valid: false, status: 'revoked', userName: '', message: err.message || 'Greška provjere licence.' };
    }
    const data = await res.json();
    if (data.userName) {
      setStoredUserName(data.userName);
    }
    if (data.status === 'revoked') {
      localStorage.setItem('ribo_license_revoked', 'true');
      return { valid: false, status: 'revoked', userName: data.userName || '', message: data.message };
    }
    localStorage.removeItem('ribo_license_revoked');
    return { valid: true, status: 'active', userName: data.userName || '' };
  } catch {
    // Ako nema interneta, vjerujemo lokalnoj matematičkoj provjeri
    const localValid = verifyActivationKey(deviceId, activationKey);
    return { valid: localValid, status: 'active', userName: getUserName() };
  }
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
 * ADMIN POZIVI ZA KONTROLU I OPOZIV LICENCI
 * ===================================================================== */

export async function fetchAdminLicenses(pin: string): Promise<LicenseRecord[]> {
  const res = await fetch('/api/admin/licenses', {
    headers: { 'x-admin-pin': pin.trim() }
  });
  if (!res.ok) throw new Error('Neuspješno dohvaćanje licenci. Provjerite PIN.');
  const data = await res.json();
  return data.licenses || [];
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
  const res = await fetch('/api/admin/licenses/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': pin.trim()
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Dodavanje korisnika nije uspjelo.');
  }
  const data = await res.json();
  return data.license;
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
  const res = await fetch('/api/admin/licenses/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': pin.trim()
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Ažuriranje licence nije uspjelo.');
  const data = await res.json();
  return data.license;
}

export async function deleteAdminLicense(pin: string, deviceId: string): Promise<boolean> {
  const res = await fetch(`/api/admin/licenses/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
    headers: { 'x-admin-pin': pin.trim() }
  });
  return res.ok;
}
