import { doc, getDoc, setDoc, onSnapshot, Unsubscribe, collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { 
  getDeviceId, 
  getUserName, 
  setStoredUserName, 
  getLocalLicenses, 
  getApiUrl, 
  safeFetchJson,
  isAdminUnlocked
} from './licenseService';

export type AnglerId = 'sikac' | 'krasni' | 'domo' | 'malisa';

export type FishSpeciesId =
  | 'bucov'
  | 'smud'
  | 'stuka'
  | 'som'
  | 'bikonja'
  | 'saran'
  | 'mrena'
  | 'klen'
  | 'buljo';

export interface AnglerDef {
  id: AnglerId;
  name: string;
}

export interface FishSpeciesDef {
  id: FishSpeciesId;
  name: string;
}

export const ANGLERS: AnglerDef[] = [
  { id: 'sikac', name: 'Sikac' },
  { id: 'krasni', name: 'Krasni' },
  { id: 'domo', name: 'Domo' },
  { id: 'malisa', name: 'Mališa' }
];

export const FISH_SPECIES: FishSpeciesDef[] = [
  { id: 'bucov', name: 'Bucov' },
  { id: 'smud', name: 'Smuđ' },
  { id: 'stuka', name: 'Štuka' },
  { id: 'som', name: 'Som' },
  { id: 'bikonja', name: 'Bikonja' },
  { id: 'saran', name: 'Šaran' },
  { id: 'mrena', name: 'Mrena' },
  { id: 'klen', name: 'Klen' },
  { id: 'buljo', name: 'Buljo' }
];

export type AnglerCatchCounts = Record<FishSpeciesId, number>;
export type AllCatchCounts = Record<AnglerId, AnglerCatchCounts>;
export type AnglerDeviceMap = Partial<Record<AnglerId, string>>;

export interface CatchHistoryEntry {
  id: string;
  anglerId: AnglerId;
  anglerName: string;
  speciesId: FishSpeciesId;
  speciesName: string;
  delta: number;
  newTotal: number;
  timestamp: string;
  createdAt: number;
  deviceId: string;
}

export interface CatchStatsData {
  counts: AllCatchCounts;
  anglerDevices: AnglerDeviceMap;
  history: CatchHistoryEntry[];
  updatedAt: number;
}

const LOCAL_CATCH_CACHE_KEY = 'ribo_catch_stats_v1';
const FIRESTORE_COLLECTION = 'catch_stats';
const FIRESTORE_DOC_ID = 'dunav_ulovi';

export function createEmptyCounts(): AllCatchCounts {
  const baseSpecies = (): AnglerCatchCounts => ({
    bucov: 0,
    smud: 0,
    stuka: 0,
    som: 0,
    bikonja: 0,
    saran: 0,
    mrena: 0,
    klen: 0,
    buljo: 0
  });

  return {
    sikac: baseSpecies(),
    krasni: baseSpecies(),
    domo: baseSpecies(),
    malisa: baseSpecies()
  };
}

export function normalizeCatchData(raw?: Partial<CatchStatsData> | null): CatchStatsData {
  const empty = createEmptyCounts();
  const counts: AllCatchCounts = {
    sikac: { ...empty.sikac, ...(raw?.counts?.sikac || {}) },
    krasni: { ...empty.krasni, ...(raw?.counts?.krasni || {}) },
    domo: { ...empty.domo, ...(raw?.counts?.domo || {}) },
    malisa: { ...empty.malisa, ...(raw?.counts?.malisa || {}) }
  };

  // Osiguraj da su svi brojevi nenegativni cijeli brojevi
  for (const angler of ANGLERS) {
    for (const fish of FISH_SPECIES) {
      const val = Number(counts[angler.id]?.[fish.id] ?? 0);
      counts[angler.id][fish.id] = Number.isFinite(val) && val > 0 ? Math.round(val) : 0;
    }
  }

  return {
    counts,
    anglerDevices: { ...(raw?.anglerDevices || {}) },
    history: Array.isArray(raw?.history) ? raw!.history.slice(0, 40) : [],
    updatedAt: typeof raw?.updatedAt === 'number' ? raw.updatedAt : Date.now()
  };
}

export function getLocalCatchStats(): CatchStatsData {
  if (typeof window === 'undefined') return normalizeCatchData(null);
  try {
    const raw = localStorage.getItem(LOCAL_CATCH_CACHE_KEY);
    if (!raw) return normalizeCatchData(null);
    return normalizeCatchData(JSON.parse(raw));
  } catch {
    return normalizeCatchData(null);
  }
}

export function saveLocalCatchStats(data: CatchStatsData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_CATCH_CACHE_KEY, JSON.stringify(data));
  } catch {}
}

/**
 * Normalizira ime radi usporedbe (npr. "Mališa" -> "malisa", "Sikac" -> "sikac")
 */
export function matchNameToAnglerId(name?: string | null): AnglerId | null {
  if (!name) return null;
  const clean = name
    .trim()
    .toLowerCase()
    .replace(/š/g, 's')
    .replace(/đ/g, 'd')
    .replace(/č/g, 'c')
    .replace(/ć/g, 'c')
    .replace(/ž/g, 'z');

  if (clean === 'sikac' || clean.includes('sikac')) return 'sikac';
  if (clean === 'krasni' || clean.includes('krasni')) return 'krasni';
  if (clean === 'domo' || clean.includes('domo')) return 'domo';
  if (clean === 'malisa' || clean.includes('malisa')) return 'malisa';
  return null;
}

/**
 * Određuje koji je ribolovac trenutni korisnik na temelju:
 * 1. Trajno povezanog ID-a uređaja u anglerDevices mapi
 * 2. Imena korisnika u licenci / lokalnom profilu
 */
export function resolveCurrentUserAnglerId(
  data: CatchStatsData,
  deviceId: string = getDeviceId(),
  userName: string = getUserName()
): AnglerId | null {
  // 1. Provjeri je li ovaj deviceId već izravno povezan s nekim od 4 ribolovca
  for (const angler of ANGLERS) {
    if (data.anglerDevices?.[angler.id] === deviceId) {
      return angler.id;
    }
  }

  // 2. Provjeri poklapa li se postavljeno ime ovog uređaja s nekim od 4 ribolovca
  const matchedFromName = matchNameToAnglerId(userName);
  if (matchedFromName) {
    const existingBoundDevice = data.anglerDevices?.[matchedFromName];
    if (!existingBoundDevice || existingBoundDevice === deviceId) {
      return matchedFromName;
    }
  }

  // 3. Provjeri lokalnu predmemoriju licenci za ovaj deviceId
  const licenses = getLocalLicenses();
  const myLic = licenses.find(l => l.deviceId === deviceId);
  if (myLic?.userName) {
    const matchedFromLic = matchNameToAnglerId(myLic.userName);
    if (matchedFromLic) {
      const existingBoundDevice = data.anglerDevices?.[matchedFromLic];
      if (!existingBoundDevice || existingBoundDevice === deviceId) {
        return matchedFromLic;
      }
    }
  }

  return null;
}

/**
 * Provjerava ima li trenutni korisnik pravo uređivati stupac odabranog ribolovca
 */
export function canUserEditAngler(
  anglerId: AnglerId,
  data: CatchStatsData,
  isAdminOverride: boolean = false
): boolean {
  if (isAdminOverride || isAdminUnlocked()) return true;
  const myAnglerId = resolveCurrentUserAnglerId(data);
  return myAnglerId === anglerId;
}

/**
 * Trajno povezuje trenutni uređaj s odabranim profilom ribolovca (Sikac, Krasni, Domo ili Mališa)
 */
export async function claimAnglerProfile(anglerId: AnglerId): Promise<{ success: boolean; data: CatchStatsData; error?: string }> {
  const deviceId = getDeviceId();
  const current = getLocalCatchStats();

  // Provjeri je li taj ribolovac već zauzet drugim uređajem
  const boundDevice = current.anglerDevices?.[anglerId];
  if (boundDevice && boundDevice !== deviceId && !isAdminUnlocked()) {
    return {
      success: false,
      data: current,
      error: 'Ovaj profil je već povezan s drugim uređajem.'
    };
  }

  // Ukloni eventualnu staru vezu ovog uređaja s drugim profilom (osim ako je admin)
  const updatedDevices: AnglerDeviceMap = { ...current.anglerDevices };
  for (const a of ANGLERS) {
    if (updatedDevices[a.id] === deviceId) {
      delete updatedDevices[a.id];
    }
  }
  updatedDevices[anglerId] = deviceId;

  const anglerDef = ANGLERS.find(a => a.id === anglerId);
  if (anglerDef) {
    setStoredUserName(anglerDef.name);
    try {
      await setDoc(doc(db, 'licenses', deviceId), { userName: anglerDef.name }, { merge: true });
    } catch {}
  }

  const nextData: CatchStatsData = {
    ...current,
    anglerDevices: updatedDevices,
    updatedAt: Date.now()
  };

  saveLocalCatchStats(nextData);
  await syncCatchStatsToCloudAndServer(nextData);

  return { success: true, data: nextData };
}

/**
 * Admin funkcija: ručno poveži ili oslobodi profil ribolovca
 */
export async function adminSetAnglerDevice(
  anglerId: AnglerId,
  targetDeviceId: string | null
): Promise<CatchStatsData> {
  const current = getLocalCatchStats();
  const updatedDevices: AnglerDeviceMap = { ...current.anglerDevices };
  if (!targetDeviceId || !targetDeviceId.trim()) {
    delete updatedDevices[anglerId];
  } else {
    updatedDevices[anglerId] = targetDeviceId.trim();
  }

  const nextData: CatchStatsData = {
    ...current,
    anglerDevices: updatedDevices,
    updatedAt: Date.now()
  };

  saveLocalCatchStats(nextData);
  await syncCatchStatsToCloudAndServer(nextData);
  return nextData;
}

/**
 * Dodaje ulov za pojedinu vrstu ribe i ribolovca te automatski zbraja u ukupnu statistiku
 */
export async function addCatchForAngler(
  anglerId: AnglerId,
  speciesId: FishSpeciesId,
  delta: number,
  isAdminOverride: boolean = false
): Promise<{ success: boolean; data: CatchStatsData; error?: string }> {
  const current = getLocalCatchStats();

  if (!canUserEditAngler(anglerId, current, isAdminOverride)) {
    return {
      success: false,
      data: current,
      error: 'Možete uređivati i dodavati ulove isključivo u svom vlastitom stupcu.'
    };
  }

  const cleanDelta = Math.round(Number(delta));
  if (!Number.isFinite(cleanDelta) || cleanDelta === 0) {
    return { success: false, data: current, error: 'Unesite valjanu količinu ulova.' };
  }

  const deviceId = getDeviceId();
  const prevCount = current.counts[anglerId]?.[speciesId] || 0;
  const newTotal = Math.max(0, prevCount + cleanDelta);
  const actualDelta = newTotal - prevCount;

  if (actualDelta === 0 && cleanDelta < 0) {
    return { success: true, data: current };
  }

  const updatedCounts: AllCatchCounts = {
    ...current.counts,
    [anglerId]: {
      ...current.counts[anglerId],
      [speciesId]: newTotal
    }
  };

  // Osiguraj da je uređaj zabilježen uz profil ako ga uređuje sam vlasnik
  const updatedDevices: AnglerDeviceMap = { ...current.anglerDevices };
  if (!isAdminOverride && !updatedDevices[anglerId]) {
    updatedDevices[anglerId] = deviceId;
  }

  const anglerName = ANGLERS.find(a => a.id === anglerId)?.name || anglerId;
  const speciesName = FISH_SPECIES.find(f => f.id === speciesId)?.name || speciesId;
  const now = new Date();
  const formattedTime = `${now.toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit' })} ${now.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}`;

  const historyEntry: CatchHistoryEntry = {
    id: `ulov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    anglerId,
    anglerName,
    speciesId,
    speciesName,
    delta: actualDelta,
    newTotal,
    timestamp: formattedTime,
    createdAt: Date.now(),
    deviceId
  };

  const nextData: CatchStatsData = {
    counts: updatedCounts,
    anglerDevices: updatedDevices,
    history: [historyEntry, ...(current.history || [])].slice(0, 40),
    updatedAt: Date.now()
  };

  saveLocalCatchStats(nextData);
  await syncCatchStatsToCloudAndServer(nextData);

  return { success: true, data: nextData };
}

/**
 * Dodaje ulove za više vrsta riba odjednom (npr. nakon povratka iz ribolova) i zbraja ih u postojeće stanje
 */
export async function addBatchCatchesForAngler(
  anglerId: AnglerId,
  speciesDeltas: Partial<Record<FishSpeciesId, number>>,
  isAdminOverride: boolean = false
): Promise<{ success: boolean; data: CatchStatsData; addedTotal: number; error?: string }> {
  const current = getLocalCatchStats();

  if (!canUserEditAngler(anglerId, current, isAdminOverride)) {
    return {
      success: false,
      data: current,
      addedTotal: 0,
      error: 'Možete dodavati ulove isključivo u svom stupcu.'
    };
  }

  const deviceId = getDeviceId();
  const updatedAnglerCounts: AnglerCatchCounts = { ...current.counts[anglerId] };
  const newHistoryEntries: CatchHistoryEntry[] = [];
  const anglerName = ANGLERS.find(a => a.id === anglerId)?.name || anglerId;
  const now = new Date();
  const formattedTime = `${now.toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit' })} ${now.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}`;

  let addedTotal = 0;

  for (const fish of FISH_SPECIES) {
    const rawDelta = Number(speciesDeltas[fish.id] || 0);
    const cleanDelta = Math.round(rawDelta);
    if (Number.isFinite(cleanDelta) && cleanDelta !== 0) {
      const prev = updatedAnglerCounts[fish.id] || 0;
      const nextVal = Math.max(0, prev + cleanDelta);
      const actualDelta = nextVal - prev;
      if (actualDelta !== 0) {
        updatedAnglerCounts[fish.id] = nextVal;
        addedTotal += actualDelta;
        newHistoryEntries.push({
          id: `ulov_${Date.now()}_${fish.id}_${Math.random().toString(36).slice(2, 5)}`,
          anglerId,
          anglerName,
          speciesId: fish.id,
          speciesName: fish.name,
          delta: actualDelta,
          newTotal: nextVal,
          timestamp: formattedTime,
          createdAt: Date.now(),
          deviceId
        });
      }
    }
  }

  if (newHistoryEntries.length === 0) {
    return {
      success: false,
      data: current,
      addedTotal: 0,
      error: 'Unesite količinu barem za jednu vrstu ribe.'
    };
  }

  const updatedDevices: AnglerDeviceMap = { ...current.anglerDevices };
  if (!isAdminOverride && !updatedDevices[anglerId]) {
    updatedDevices[anglerId] = deviceId;
  }

  const nextData: CatchStatsData = {
    counts: {
      ...current.counts,
      [anglerId]: updatedAnglerCounts
    },
    anglerDevices: updatedDevices,
    history: [...newHistoryEntries, ...(current.history || [])].slice(0, 40),
    updatedAt: Date.now()
  };

  saveLocalCatchStats(nextData);
  await syncCatchStatsToCloudAndServer(nextData);

  return { success: true, data: nextData, addedTotal };
}

/**
 * Sinkronizira podatke s Firestore oblakom i Express poslužiteljem
 */
async function syncCatchStatsToCloudAndServer(data: CatchStatsData): Promise<void> {
  // 1. Firestore
  try {
    await setDoc(doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID), {
      counts: data.counts,
      anglerDevices: data.anglerDevices,
      history: data.history,
      updatedAt: data.updatedAt
    }, { merge: true });
  } catch (err) {
    console.warn('Upozorenje pri spremanju ulova u Firestore:', err);
  }

  // 2. Poslužitelj
  try {
    await safeFetchJson(getApiUrl('/api/catches/update'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch {}
}

/**
 * Pretplata u stvarnom vremenu na tablicu evidencije ulova (Firestore + Server + auto-povezivanje licenci)
 */
export function subscribeToCatchStats(
  callback: (data: CatchStatsData) => void
): Unsubscribe {
  let active = true;

  // 1. Odmah prikaži iz lokalne predmemorije
  const initialLocal = getLocalCatchStats();
  callback(initialLocal);

  // 2. Pokušaj automatski povezati poznate licence po imenu (Sikac, Krasni, Domo, Mališa)
  getDocs(collection(db, 'licenses'))
    .then(snap => {
      if (!active || snap.empty) return;
      const current = getLocalCatchStats();
      let changed = false;
      const updatedDevices: AnglerDeviceMap = { ...current.anglerDevices };

      snap.forEach(docSnap => {
        const lic = docSnap.data();
        if (lic?.deviceId && lic?.userName) {
          const matched = matchNameToAnglerId(lic.userName);
          if (matched && !updatedDevices[matched]) {
            updatedDevices[matched] = lic.deviceId;
            changed = true;
          }
        }
      });

      if (changed) {
        const merged: CatchStatsData = {
          ...current,
          anglerDevices: updatedDevices,
          updatedAt: Date.now()
        };
        saveLocalCatchStats(merged);
        callback(merged);
        setDoc(doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID), {
          anglerDevices: updatedDevices
        }, { merge: true }).catch(() => {});
      }
    })
    .catch(() => {});

  // 3. Dohvati s Express poslužitelja kao dodatni izvor
  safeFetchJson<CatchStatsData>(getApiUrl('/api/catches'))
    .then(res => {
      if (!active || !res.ok || !res.data) return;
      const serverNormalized = normalizeCatchData(res.data);
      const local = getLocalCatchStats();
      if (serverNormalized.updatedAt >= local.updatedAt) {
        saveLocalCatchStats(serverNormalized);
        callback(serverNormalized);
      }
    })
    .catch(() => {});

  // 4. Slušaj promjene u stvarnom vremenu iz Firestore baze
  const unsubFirestore = onSnapshot(
    doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID),
    snapshot => {
      if (!active) return;
      if (snapshot.exists()) {
        const cloudData = normalizeCatchData(snapshot.data() as Partial<CatchStatsData>);
        saveLocalCatchStats(cloudData);
        callback(cloudData);
      } else {
        // Ako dokument još ne postoji u Firestoreu, inicijaliziraj ga
        const current = getLocalCatchStats();
        setDoc(doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID), current, { merge: true }).catch(() => {});
      }
    },
    err => {
      console.warn('Firestore catch_stats listener warning:', err);
    }
  );

  return () => {
    active = false;
    unsubFirestore();
  };
}
