/**
 * Sustav licenci i zaštite aplikacije (Opcija 1 - Hardverski ID uređaja + Kriptografski ključ)
 * Autor: Daniel Čizmar
 */

const SECRET_SALT = 'DUNAV_ZANDER_DANIEL_CIZMAR_2026_PROTECT_KEY';
const ADMIN_MASTER_PIN = '2026'; // PIN za pristup Danielovom generatoru ključeva

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
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // bez zbunjujućih slova 0, 1, I, O
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
  
  const currentDeviceId = getDeviceId();
  const storedKey = localStorage.getItem('ribo_activation_key');
  
  if (!storedKey) return false;
  return verifyActivationKey(currentDeviceId, storedKey);
}

/**
 * Pokušava aktivirati aplikaciju s unesenim ključem
 */
export function activateApp(key: string): boolean {
  const currentDeviceId = getDeviceId();
  if (verifyActivationKey(currentDeviceId, key)) {
    const formattedKey = generateActivationKey(currentDeviceId);
    localStorage.setItem('ribo_activation_key', formattedKey);
    return true;
  }
  return false;
}

/**
 * Deaktivira aplikaciju (korisno za testiranje)
 */
export function deactivateApp(): void {
  localStorage.removeItem('ribo_activation_key');
}

/**
 * Provjerava administratorski PIN za otvaranje generatora ključeva
 */
export function checkAdminPin(pin: string): boolean {
  return pin.trim() === ADMIN_MASTER_PIN;
}
