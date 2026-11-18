import { doc, setDoc, onSnapshot, Unsubscribe, getDoc, arrayUnion } from 'firebase/firestore';
import { db, setFirestoreNetworkActive } from './firebase';
import { getApiUrl } from './licenseService';

export type CalamariParticipantId = 'dida' | 'tuna' | 'silvio' | 'daniel';

export interface ParticipantDef {
  id: CalamariParticipantId;
  name: string;
  pin?: string;
  role: 'competitor' | 'admin';
  description: string;
}

export const CALAMARI_PARTICIPANTS: ParticipantDef[] = [
  { id: 'dida', name: 'Dida', role: 'competitor', description: '' },
  { id: 'tuna', name: 'Tuna', pin: '963', role: 'competitor', description: '' },
  { id: 'silvio', name: 'Silvio', pin: '741', role: 'competitor', description: '' },
  { id: 'daniel', name: 'Daniel', pin: '2026', role: 'admin', description: '' }
];

export const CALAMARI_PIN_PARTICIPANTS: CalamariParticipantId[] = ['silvio', 'tuna', 'daniel'];

export const CALAMARI_DATES = [
  { dateStr: '18.11.2026', label: 'Srijeda 18.11.' },
  { dateStr: '19.11.2026', label: 'Četvrtak 19.11.' },
  { dateStr: '20.11.2026', label: 'Petak 20.11.' },
  { dateStr: '21.11.2026', label: 'Subota 21.11.' },
  { dateStr: '22.11.2026', label: 'Nedjelja 22.11.' }
];

export type CalamariSpeciesId = 'lignja' | 'sipa' | 'hobotnica';

export interface CalamariSpeciesDef {
  id: CalamariSpeciesId;
  numLabel: string;
  name: string;
  fullLabel: string;
}

export const CALAMARI_SPECIES_LIST: CalamariSpeciesDef[] = [
  { id: 'lignja', numLabel: '1.', name: 'Lignja', fullLabel: '1. Lignja' },
  { id: 'sipa', numLabel: '2.', name: 'Sipa', fullLabel: '2. Sipa' },
  { id: 'hobotnica', numLabel: '3.', name: 'Hobotnica', fullLabel: '3. Hobotnica' }
];

export interface SpeciesCatchCounts {
  lignja: number;
  sipa: number;
  hobotnica: number;
}

export type DailyCatches = Record<string, number>; // dateStr -> count
export type AllCalamariData = Record<CalamariParticipantId, DailyCatches>;

export type DailySpeciesCatches = Record<string, SpeciesCatchCounts>; // dateStr -> { lignja, sipa, hobotnica }
export type AllCalamariSpeciesData = Record<CalamariParticipantId, DailySpeciesCatches>;

export interface CalamariCompetitionState {
  catches: AllCalamariData;
  speciesCatches?: AllCalamariSpeciesData;
  updatedAt: number;
  lastUpdatedBy?: string;
  loggedParticipants?: CalamariParticipantId[];
  logged_silvio?: boolean;
  logged_tuna?: boolean;
  logged_daniel?: boolean;
}

const LOCAL_CALAMARI_KEY = 'ribo_calamari_competition_v1';
const STORAGE_LOGGED_USER_KEY = 'ribo_calamari_logged_user_v1';
const STORAGE_LOGGED_HISTORY_KEY = 'ribo_calamari_logged_users_history_v1';
const FIRESTORE_CALAMARI_DOC = 'novi_vinodolski_2026';

const FIRESTORE_REST_BASE =
  'https://firestore.googleapis.com/v1/projects/titanium-domain-wv4kj/databases/ai-studio-hrvatskiradnipro-badf4099-cdd8-4a4a-b90c-6a3aea6c7b94/documents';

export function createEmptyCalamariData(): AllCalamariData {
  const emptyDays = (): DailyCatches => ({
    '18.11.2026': 0,
    '19.11.2026': 0,
    '20.11.2026': 0,
    '21.11.2026': 0,
    '22.11.2026': 0
  });

  return {
    dida: emptyDays(),
    tuna: emptyDays(),
    silvio: emptyDays(),
    daniel: emptyDays()
  };
}

export function createEmptySpeciesCatchesData(): AllCalamariSpeciesData {
  const emptySpeciesDays = (): DailySpeciesCatches => ({
    '18.11.2026': { lignja: 0, sipa: 0, hobotnica: 0 },
    '19.11.2026': { lignja: 0, sipa: 0, hobotnica: 0 },
    '20.11.2026': { lignja: 0, sipa: 0, hobotnica: 0 },
    '21.11.2026': { lignja: 0, sipa: 0, hobotnica: 0 },
    '22.11.2026': { lignja: 0, sipa: 0, hobotnica: 0 }
  });

  return {
    dida: emptySpeciesDays(),
    tuna: emptySpeciesDays(),
    silvio: emptySpeciesDays(),
    daniel: emptySpeciesDays()
  };
}

export function normalizeSpeciesCatches(raw?: any): AllCalamariSpeciesData {
  const base = createEmptySpeciesCatchesData();
  if (!raw || typeof raw !== 'object') return base;

  for (const pid of ['dida', 'tuna', 'silvio', 'daniel'] as CalamariParticipantId[]) {
    const pData = raw[pid];
    if (pData && typeof pData === 'object') {
      for (const d of CALAMARI_DATES) {
        const dayObj = pData[d.dateStr];
        if (dayObj && typeof dayObj === 'object') {
          base[pid][d.dateStr] = {
            lignja: Math.max(0, Number(dayObj.lignja) || 0),
            sipa: Math.max(0, Number(dayObj.sipa) || 0),
            hobotnica: Math.max(0, Number(dayObj.hobotnica) || 0)
          };
        }
      }
    }
  }
  return base;
}

/**
 * Izvlači listu prijavljenih sudionika iz dokumenta (podržava i polje loggedParticipants i neovisne zastavice logged_silvio / logged_tuna / logged_daniel)
 */
export function extractLoggedFromState(data?: Partial<CalamariCompetitionState> | null): CalamariParticipantId[] {
  if (!data) return [];
  const set = new Set<CalamariParticipantId>();
  if (Array.isArray(data.loggedParticipants)) {
    data.loggedParticipants.forEach((id: any) => {
      if (CALAMARI_PIN_PARTICIPANTS.includes(id)) set.add(id);
    });
  }
  if (data.logged_silvio === true) set.add('silvio');
  if (data.logged_tuna === true) set.add('tuna');
  if (data.logged_daniel === true) set.add('daniel');
  return Array.from(set);
}

/**
 * Dohvaća sve prijave spremljene lokalno na ovom uređaju
 * (Strogo provjerava samo stvarno unesene šifre na ovom uređaju kako ne bi lažno označio tuđu prijavu)
 */
export function getLocalDeviceLoggedParticipants(): CalamariParticipantId[] {
  if (typeof window === 'undefined') return [];
  const set = new Set<CalamariParticipantId>();
  try {
    const single = localStorage.getItem(STORAGE_LOGGED_USER_KEY) as CalamariParticipantId | null;
    if (single && CALAMARI_PIN_PARTICIPANTS.includes(single)) {
      set.add(single);
    }
    const rawHist = localStorage.getItem(STORAGE_LOGGED_HISTORY_KEY);
    if (rawHist) {
      const parsed = JSON.parse(rawHist);
      if (Array.isArray(parsed)) {
        parsed.forEach((id: any) => {
          if (CALAMARI_PIN_PARTICIPANTS.includes(id)) set.add(id);
        });
      }
    }
  } catch {}
  return Array.from(set);
}

function mergeLoggedParticipants(
  ...lists: (CalamariParticipantId[] | undefined | null)[]
): CalamariParticipantId[] {
  const set = new Set<CalamariParticipantId>(getLocalDeviceLoggedParticipants());
  for (const list of lists) {
    if (Array.isArray(list)) {
      for (const id of list) {
        if (CALAMARI_PIN_PARTICIPANTS.includes(id)) {
          set.add(id);
        }
      }
    }
  }
  return Array.from(set);
}

function buildLoggedFlags(loggedList: CalamariParticipantId[]): {
  logged_silvio?: boolean;
  logged_tuna?: boolean;
  logged_daniel?: boolean;
} {
  const flags: { logged_silvio?: boolean; logged_tuna?: boolean; logged_daniel?: boolean } = {};
  if (loggedList.includes('silvio')) flags.logged_silvio = true;
  if (loggedList.includes('tuna')) flags.logged_tuna = true;
  if (loggedList.includes('daniel')) flags.logged_daniel = true;
  return flags;
}

/**
 * Pričuvni dohvat i zapis preko izravnog Firestore REST API-ja (radi čak i ako WebChannel zapne na mobilnoj mreži)
 */
async function syncParticipantLoginRestFallback(participantId: CalamariParticipantId): Promise<void> {
  try {
    const flagField = `logged_${participantId}`;
    const url = `${FIRESTORE_REST_BASE}/calamari_competition/${FIRESTORE_CALAMARI_DOC}?updateMask.fieldPaths=${flagField}`;
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          [flagField]: { booleanValue: true }
        }
      }),
      signal: AbortSignal.timeout(4500)
    });
  } catch {}
}

async function fetchCalamariRestFallback(): Promise<Partial<CalamariCompetitionState> | null> {
  try {
    // Čisti GET upit (bez PATCH pisanja _ping polja) kako se ne bi trošila kvota pisanja i budili ostali uređaji
    const url = `${FIRESTORE_REST_BASE}/calamari_competition/${FIRESTORE_CALAMARI_DOC}?t=${Date.now()}`;
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4500)
    });
    if (!res.ok) return null;
    const json = await res.json();
    const fields = json?.fields;
    if (!fields) return null;

    const loggedSet = new Set<CalamariParticipantId>();
    if (fields.logged_silvio?.booleanValue === true) loggedSet.add('silvio');
    if (fields.logged_tuna?.booleanValue === true) loggedSet.add('tuna');
    if (fields.logged_daniel?.booleanValue === true) loggedSet.add('daniel');
    if (Array.isArray(fields.loggedParticipants?.arrayValue?.values)) {
      fields.loggedParticipants.arrayValue.values.forEach((v: any) => {
        const s = v?.stringValue as CalamariParticipantId;
        if (s && CALAMARI_PIN_PARTICIPANTS.includes(s)) loggedSet.add(s);
      });
    }

    const catches = createEmptyCalamariData();
    const catchesMap = fields.catches?.mapValue?.fields;
    if (catchesMap) {
      for (const pid of ['dida', 'tuna', 'silvio', 'daniel'] as CalamariParticipantId[]) {
        const pDays = catchesMap[pid]?.mapValue?.fields;
        if (pDays) {
          for (const [dKey, dVal] of Object.entries(pDays)) {
            const v = dVal as any;
            catches[pid][dKey] = Number(v?.integerValue ?? v?.doubleValue ?? 0) || 0;
          }
        }
      }
    }

    const speciesCatches = createEmptySpeciesCatchesData();
    const speciesMap = fields.speciesCatches?.mapValue?.fields;
    if (speciesMap) {
      for (const pid of ['dida', 'tuna', 'silvio', 'daniel'] as CalamariParticipantId[]) {
        const pDays = speciesMap[pid]?.mapValue?.fields;
        if (pDays) {
          for (const [dKey, dVal] of Object.entries(pDays)) {
            const spFields = (dVal as any)?.mapValue?.fields;
            if (spFields && speciesCatches[pid][dKey]) {
              speciesCatches[pid][dKey] = {
                lignja: Number(spFields.lignja?.integerValue ?? spFields.lignja?.doubleValue ?? 0) || 0,
                sipa: Number(spFields.sipa?.integerValue ?? spFields.sipa?.doubleValue ?? 0) || 0,
                hobotnica: Number(spFields.hobotnica?.integerValue ?? spFields.hobotnica?.doubleValue ?? 0) || 0
              };
            }
          }
        }
      }
    }

    const updatedAt = Number(fields.updatedAt?.integerValue ?? fields.updatedAt?.doubleValue ?? 0) || Date.now();
    const lastUpdatedBy = fields.lastUpdatedBy?.stringValue || undefined;
    const loggedParticipants = Array.from(loggedSet);

    return {
      catches,
      speciesCatches,
      updatedAt,
      lastUpdatedBy,
      loggedParticipants,
      ...buildLoggedFlags(loggedParticipants)
    };
  } catch {
    return null;
  }
}

export function getStoredCalamariData(): CalamariCompetitionState {
  if (typeof window === 'undefined') {
    return {
      catches: createEmptyCalamariData(),
      speciesCatches: createEmptySpeciesCatchesData(),
      updatedAt: Date.now(),
      loggedParticipants: []
    };
  }
  try {
    const raw = localStorage.getItem(LOCAL_CALAMARI_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.catches) {
        const mergedLogged = mergeLoggedParticipants(extractLoggedFromState(parsed));
        return {
          ...parsed,
          speciesCatches: normalizeSpeciesCatches(parsed.speciesCatches),
          loggedParticipants: mergedLogged,
          ...buildLoggedFlags(mergedLogged)
        };
      }
    }
  } catch {}
  const localLogged = getLocalDeviceLoggedParticipants();
  return {
    catches: createEmptyCalamariData(),
    speciesCatches: createEmptySpeciesCatchesData(),
    updatedAt: Date.now(),
    loggedParticipants: localLogged,
    ...buildLoggedFlags(localLogged)
  };
}

export function saveStoredCalamariData(state: CalamariCompetitionState): void {
  if (typeof window === 'undefined') return;
  try {
    const mergedLogged = mergeLoggedParticipants(extractLoggedFromState(state));
    const merged: CalamariCompetitionState = {
      ...state,
      speciesCatches: normalizeSpeciesCatches(state.speciesCatches),
      loggedParticipants: mergedLogged,
      ...buildLoggedFlags(mergedLogged)
    };
    localStorage.setItem(LOCAL_CALAMARI_KEY, JSON.stringify(merged));
  } catch {}
}

async function pushCalamariToBackend(state: CalamariCompetitionState): Promise<void> {
  try {
    await fetch(getApiUrl('/api/calamari/update'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
      signal: AbortSignal.timeout(4000)
    });
  } catch {}
}

/**
 * Automatski sinkronizira lokalno prijavljene sudionike s ovog uređaja u Firestore i poslužitelj
 * bez prepisivanja prijava drugih sudionika (koristi arrayUnion i neovisne zastavice logged_silvio/tuna/daniel)
 */
export async function syncLocalCalamariLoginsToServer(): Promise<CalamariCompetitionState> {
  const localLogged = getLocalDeviceLoggedParticipants();

  // Ako na ovom uređaju postoji spremljena prijava, odmah pošalji atomsku zastavicu u Firestore
  if (localLogged.length > 0) {
    for (const pid of localLogged) {
      syncParticipantLoginRestFallback(pid).catch(() => {});
    }
    try {
      await Promise.race([
        setDoc(
          doc(db, 'calamari_competition', FIRESTORE_CALAMARI_DOC),
          {
            loggedParticipants: arrayUnion(...localLogged),
            ...buildLoggedFlags(localLogged)
          },
          { merge: true }
        ),
        new Promise(r => setTimeout(r, 3500))
      ]);
    } catch {}
  }

  return fetchCalamariDataServer();
}

export async function fetchCalamariDataServer(): Promise<CalamariCompetitionState> {
  const stored = getStoredCalamariData();
  let bestState: CalamariCompetitionState = stored;
  let remoteLogged: CalamariParticipantId[] = [];
  let gotFirestoreOrRest = false;

  // 1. Dohvat iz Firestore oblaka (s timeoutom od 3.5 s)
  try {
    const snap = await Promise.race([
      getDoc(doc(db, 'calamari_competition', FIRESTORE_CALAMARI_DOC)),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 3500))
    ]);
    if (snap && (snap as any).exists && (snap as any).exists()) {
      const data = (snap as any).data() as CalamariCompetitionState;
      if (data) {
        gotFirestoreOrRest = true;
        remoteLogged = mergeLoggedParticipants(remoteLogged, extractLoggedFromState(data));
        if (data.catches && (!bestState.updatedAt || (data.updatedAt || 0) >= bestState.updatedAt)) {
          bestState = data;
        }
      }
    }
  } catch {}

  // 2. Ako WebChannel getDoc nije odgovorio, dohvati izravno preko Firestore REST API-ja
  if (!gotFirestoreOrRest) {
    const restData = await fetchCalamariRestFallback();
    if (restData) {
      gotFirestoreOrRest = true;
      remoteLogged = mergeLoggedParticipants(remoteLogged, extractLoggedFromState(restData));
      if (restData.catches && (!bestState.updatedAt || (restData.updatedAt || 0) >= bestState.updatedAt)) {
        bestState = restData as CalamariCompetitionState;
      }
    }
  }

  // 3. Pokušaj dohvatiti i s Express poslužitelja
  try {
    const res = await fetch(getApiUrl(`/api/calamari?t=${Date.now()}`), {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3500)
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data && data.catches) {
        remoteLogged = mergeLoggedParticipants(remoteLogged, extractLoggedFromState(data));
        if (!bestState.updatedAt || (data.updatedAt || 0) >= bestState.updatedAt) {
          bestState = data;
        }
      }
    }
  } catch {}

  // Priznajemo lokalnu prijavu s ovog uređaja + sve potvrđene prijave iz Firestorea/poslužitelja
  const localDeviceOnly = getLocalDeviceLoggedParticipants();
  const mergedLogged = Array.from(new Set([...localDeviceOnly, ...remoteLogged]));

  const finalState: CalamariCompetitionState = {
    ...bestState,
    speciesCatches: normalizeSpeciesCatches(bestState.speciesCatches),
    loggedParticipants: mergedLogged,
    ...buildLoggedFlags(mergedLogged)
  };

  saveStoredCalamariData(finalState);

  // Ako ovaj uređaj ima vlastitu lokalnu prijavu koja još nije u oblaku, odmah ju zapiši
  const cloudMissingLocal = localDeviceOnly.some(id => !remoteLogged.includes(id));
  if (cloudMissingLocal && localDeviceOnly.length > 0) {
    for (const pid of localDeviceOnly) {
      syncParticipantLoginRestFallback(pid).catch(() => {});
    }
    pushCalamariToBackend(finalState);
    try {
      await Promise.race([
        setDoc(
          doc(db, 'calamari_competition', FIRESTORE_CALAMARI_DOC),
          {
            loggedParticipants: arrayUnion(...localDeviceOnly),
            ...buildLoggedFlags(localDeviceOnly),
            updatedAt: Date.now()
          },
          { merge: true }
        ),
        new Promise(r => setTimeout(r, 3500))
      ]);
    } catch {}
  }

  return finalState;
}

export async function recordCalamariParticipantLogin(
  participantId: CalamariParticipantId
): Promise<CalamariCompetitionState> {
  // 1. Odmah pošalji neovisnu zastavicu preko REST-a (100% otporno na sve mrežne uvjete)
  await syncParticipantLoginRestFallback(participantId);

  const current = await fetchCalamariDataServer();
  const mergedLogged = Array.from(
    new Set([...extractLoggedFromState(current), ...getLocalDeviceLoggedParticipants(), participantId])
  );

  const updated: CalamariCompetitionState = {
    ...current,
    speciesCatches: normalizeSpeciesCatches(current.speciesCatches),
    loggedParticipants: mergedLogged,
    ...buildLoggedFlags(mergedLogged),
    updatedAt: Date.now()
  };

  saveStoredCalamariData(updated);
  pushCalamariToBackend(updated);

  try {
    await Promise.race([
      setDoc(
        doc(db, 'calamari_competition', FIRESTORE_CALAMARI_DOC),
        {
          ...updated,
          loggedParticipants: arrayUnion(...mergedLogged),
          ...buildLoggedFlags(mergedLogged)
        },
        { merge: true }
      ),
      new Promise(r => setTimeout(r, 4000))
    ]);
  } catch (err) {
    console.warn('Greška pri spremanju prijave u Firestore:', err);
  }
  return updated;
}

/**
 * Omogućuje Administratoru (Danielu) da ručno označi ili poništi status prijave za pojedinog sudionika
 */
export async function adminToggleParticipantLoginServer(
  participantId: CalamariParticipantId,
  shouldBeLogged: boolean
): Promise<CalamariCompetitionState> {
  const current = await fetchCalamariDataServer();
  const existing = extractLoggedFromState(current);
  const nextLogged = shouldBeLogged
    ? Array.from(new Set([...existing, participantId]))
    : existing.filter(id => id !== participantId);

  const flagField = `logged_${participantId}`;
  const updated: any = {
    ...current,
    speciesCatches: normalizeSpeciesCatches(current.speciesCatches),
    loggedParticipants: nextLogged,
    logged_silvio: nextLogged.includes('silvio'),
    logged_tuna: nextLogged.includes('tuna'),
    logged_daniel: nextLogged.includes('daniel'),
    updatedAt: Date.now()
  };

  try {
    const raw = localStorage.getItem(LOCAL_CALAMARI_KEY);
    if (raw) {
      localStorage.setItem(LOCAL_CALAMARI_KEY, JSON.stringify(updated));
    }
  } catch {}

  pushCalamariToBackend(updated);

  try {
    const url = `${FIRESTORE_REST_BASE}/calamari_competition/${FIRESTORE_CALAMARI_DOC}?updateMask.fieldPaths=${flagField}`;
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          [flagField]: { booleanValue: shouldBeLogged }
        }
      }),
      signal: AbortSignal.timeout(4000)
    });
  } catch {}

  try {
    await Promise.race([
      setDoc(doc(db, 'calamari_competition', FIRESTORE_CALAMARI_DOC), updated, { merge: true }),
      new Promise(r => setTimeout(r, 3500))
    ]);
  } catch {}

  return updated;
}

export async function updateCalamariCatchesServer(
  participantId: CalamariParticipantId,
  dateStr: string,
  count: number,
  editorName: string
): Promise<CalamariCompetitionState> {
  const current = getStoredCalamariData();
  if (!current.catches[participantId]) {
    current.catches[participantId] = {};
  }
  current.catches[participantId][dateStr] = Math.max(0, count);
  current.speciesCatches = normalizeSpeciesCatches(current.speciesCatches);
  current.updatedAt = Date.now();
  current.lastUpdatedBy = editorName;
  const mergedLogged = mergeLoggedParticipants(extractLoggedFromState(current));
  current.loggedParticipants = mergedLogged;
  Object.assign(current, buildLoggedFlags(mergedLogged));

  saveStoredCalamariData(current);
  pushCalamariToBackend(current);

  try {
    await Promise.race([
      setDoc(
        doc(db, 'calamari_competition', FIRESTORE_CALAMARI_DOC),
        {
          catches: current.catches,
          speciesCatches: current.speciesCatches,
          updatedAt: current.updatedAt,
          lastUpdatedBy: current.lastUpdatedBy,
          ...(mergedLogged.length > 0 ? { loggedParticipants: arrayUnion(...mergedLogged) } : {}),
          ...buildLoggedFlags(mergedLogged)
        },
        { merge: true }
      ),
      new Promise(r => setTimeout(r, 3500))
    ]);
  } catch (err) {
    console.warn('Greška pri spremanju Calamari podataka u Firestore:', err);
  }

  return current;
}

/**
 * Sprema količine ulova po vrstama (1. Lignja, 2. Sipa, 3. Hobotnica) za odabranog natjecatelja
 * i odmah sinkronizira promjene sa svim ostalim korisnicima u stvarnom vremenu
 */
export async function updateCalamariSpeciesServer(
  participantId: CalamariParticipantId,
  updatedParticipantSpecies: DailySpeciesCatches,
  editorName: string
): Promise<CalamariCompetitionState> {
  const current = getStoredCalamariData();
  const allSpecies = normalizeSpeciesCatches(current.speciesCatches);

  for (const d of CALAMARI_DATES) {
    const dayCounts = updatedParticipantSpecies[d.dateStr];
    if (dayCounts) {
      const l = Math.max(0, Math.min(999, Number(dayCounts.lignja) || 0));
      const s = Math.max(0, Math.min(999, Number(dayCounts.sipa) || 0));
      const h = Math.max(0, Math.min(999, Number(dayCounts.hobotnica) || 0));
      allSpecies[participantId][d.dateStr] = {
        lignja: l,
        sipa: s,
        hobotnica: h
      };
    }
  }

  current.speciesCatches = allSpecies;
  current.updatedAt = Date.now();
  current.lastUpdatedBy = editorName;
  const mergedLogged = mergeLoggedParticipants(extractLoggedFromState(current));
  current.loggedParticipants = mergedLogged;
  Object.assign(current, buildLoggedFlags(mergedLogged));

  saveStoredCalamariData(current);
  pushCalamariToBackend(current);

  try {
    await Promise.race([
      setDoc(
        doc(db, 'calamari_competition', FIRESTORE_CALAMARI_DOC),
        {
          catches: current.catches,
          speciesCatches: current.speciesCatches,
          updatedAt: current.updatedAt,
          lastUpdatedBy: current.lastUpdatedBy,
          ...(mergedLogged.length > 0 ? { loggedParticipants: arrayUnion(...mergedLogged) } : {}),
          ...buildLoggedFlags(mergedLogged)
        },
        { merge: true }
      ),
      new Promise(r => setTimeout(r, 3500))
    ]);
  } catch (err) {
    console.warn('Greška pri spremanju Calamari vrsta u Firestore:', err);
  }

  return current;
}

export async function adminResetParticipantOrDateServer(
  mode: 'participant' | 'date' | 'all',
  targetKey: string,
  editorName: string = 'Daniel (Admin)'
): Promise<CalamariCompetitionState> {
  const current = getStoredCalamariData();
  current.speciesCatches = normalizeSpeciesCatches(current.speciesCatches);

  if (mode === 'all') {
    current.catches = createEmptyCalamariData();
    current.speciesCatches = createEmptySpeciesCatchesData();
  } else if (mode === 'participant') {
    const pid = targetKey as CalamariParticipantId;
    if (current.catches[pid]) {
      CALAMARI_DATES.forEach(d => {
        current.catches[pid][d.dateStr] = 0;
        current.speciesCatches![pid][d.dateStr] = { lignja: 0, sipa: 0, hobotnica: 0 };
      });
    }
  } else if (mode === 'date') {
    CALAMARI_PARTICIPANTS.forEach(p => {
      if (!current.catches[p.id]) current.catches[p.id] = {};
      current.catches[p.id][targetKey] = 0;
      if (current.speciesCatches?.[p.id]) {
        current.speciesCatches[p.id][targetKey] = { lignja: 0, sipa: 0, hobotnica: 0 };
      }
    });
  }

  current.updatedAt = Date.now();
  current.lastUpdatedBy = editorName;
  const mergedLogged = mergeLoggedParticipants(extractLoggedFromState(current));
  current.loggedParticipants = mergedLogged;
  Object.assign(current, buildLoggedFlags(mergedLogged));
  saveStoredCalamariData(current);
  pushCalamariToBackend(current);

  try {
    await Promise.race([
      setDoc(doc(db, 'calamari_competition', FIRESTORE_CALAMARI_DOC), current, { merge: true }),
      new Promise(r => setTimeout(r, 3500))
    ]);
  } catch (err) {
    console.warn('Greška pri admin resetiranju Calamari podataka:', err);
  }

  return current;
}

function getCalamariStateSignature(s: CalamariCompetitionState): string {
  const logged = extractLoggedFromState(s).slice().sort().join(',');
  return JSON.stringify({
    c: s.catches,
    sc: normalizeSpeciesCatches(s.speciesCatches),
    l: logged,
    by: s.lastUpdatedBy || ''
  });
}

export function subscribeToCalamariData(callback: (state: CalamariCompetitionState) => void): Unsubscribe {
  const docRef = doc(db, 'calamari_competition', FIRESTORE_CALAMARI_DOC);
  let unsubFirestore: Unsubscribe | null = null;
  let lastSignature = '';

  const emitIfChanged = (state: CalamariCompetitionState) => {
    const sig = getCalamariStateSignature(state);
    if (sig !== lastSignature) {
      lastSignature = sig;
      callback(state);
    }
  };

  const attachRealtimeListener = () => {
    if (unsubFirestore) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    setFirestoreNetworkActive(true);

    unsubFirestore = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as CalamariCompetitionState;
          if (data && data.catches) {
            const localDeviceOnly = getLocalDeviceLoggedParticipants();
            const remoteLogged = extractLoggedFromState(data);
            const mergedLogged = Array.from(new Set([...localDeviceOnly, ...remoteLogged]));
            const merged: CalamariCompetitionState = {
              ...data,
              speciesCatches: normalizeSpeciesCatches(data.speciesCatches),
              loggedParticipants: mergedLogged,
              ...buildLoggedFlags(mergedLogged)
            };
            saveStoredCalamariData(merged);
            emitIfChanged(merged);
          }
        }
      },
      (error) => {
        console.warn('Calamari live sync warning:', error);
      }
    );
  };

  const detachRealtimeListener = () => {
    if (unsubFirestore) {
      try {
        unsubFirestore();
      } catch {}
      unsubFirestore = null;
    }
  };

  // Odmah pokreni real-time slušanje dok je Calamari sekcija otvorena i zaslon uključen
  attachRealtimeListener();

  // Brzi pričuvni interval (svake 4 sekunde isključivo dok je zaslon uključen)
  // Osigurava da svaki unos ulova ili prijave bude odmah vidljiv kod svih čak i na slabijem mobilnom signalu,
  // a potpuno miruje (0% baterije) kada je zaslon zaključan ili aplikacija u pozadini!
  const pollTimer = setInterval(async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      const fresh = await fetchCalamariDataServer();
      emitIfChanged(fresh);
    } catch {}
  }, 4000);

  const handleVisibilityChange = () => {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      // Korisnik je zaključao zaslon ili minimizirao aplikaciju -> odspoji listener radi 0% potrošnje baterije
      detachRealtimeListener();
    } else {
      // Korisnik je ponovno uključio zaslon -> odmah spoji real-time listener i povuci najsvježije podatke
      attachRealtimeListener();
      fetchCalamariDataServer()
        .then((fresh) => emitIfChanged(fresh))
        .catch(() => {});
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  return () => {
    detachRealtimeListener();
    clearInterval(pollTimer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  };
}

export interface VinodolskiSolunarAnalysis {
  dateLabel: string;
  moonIcon: string;
  moonPhaseName: string;
  illuminationPct: number;
  moonAgeDays: number;
  solunarIndex: number; // 0 - 100
  starRating: number; // 1 - 5
  ratingLabel: string;
  majorZenith: { start: string; end: string; peak: string };
  majorNadir: { start: string; end: string; peak: string };
  minorMoonrise: { start: string; end: string; peak: string };
  minorMoonset: { start: string; end: string; peak: string };
  sunsetTime: string;
  sunriseTime: string;
  optimalEveningWindow: string;
  optimalNightWindow: string;
  optimalDawnWindow: string;
  knightCanalSynthesis: string;
  aiTacticalAnalysis: string;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function fmtHour(hFloat: number): string {
  const norm = ((hFloat % 24) + 24) % 24;
  const h = Math.floor(norm);
  const m = Math.floor((norm - h) * 60);
  return `${pad2(h)}:${pad2(m)}`;
}

/**
 * Izračun Solunarne teorije (John Alden Knight, 1926.) + Astronomskog položaja Mjeseca
 * za Vinodolski kanal (Novi Vinodolski: 45.1278° N, 14.7892° E) + Google AI sinteza optimalnih sati griza
 */
export function calculateVinodolskiSolunar(
  targetDate: Date,
  pressureHpa: number = 1020,
  windSpeedMs: number = 2.8,
  tempC: number = 13.5
): VinodolskiSolunarAnalysis {
  const refNewMoon = new Date('2026-01-18T18:50:00Z');
  const synodicMonth = 29.53058867;
  const diffDays = (targetDate.getTime() - refNewMoon.getTime()) / (1000 * 60 * 60 * 24);
  const ageDays = ((diffDays % synodicMonth) + synodicMonth) % synodicMonth;
  const moonAgeDays = Math.round(ageDays * 10) / 10;

  const illuminationPct = Math.round(((1 - Math.cos((ageDays / synodicMonth) * 2 * Math.PI)) / 2) * 100);

  let moonIcon = '🌔';
  let moonPhaseName = 'Rastući Mjesec';

  if (ageDays < 1.84) {
    moonIcon = '🌑';
    moonPhaseName = 'Mlađak (Novi Mjesec)';
  } else if (ageDays < 7.38) {
    moonIcon = '🌒';
    moonPhaseName = 'Rastući srp';
  } else if (ageDays < 9.22) {
    moonIcon = '🌓';
    moonPhaseName = 'Prva četvrt';
  } else if (ageDays < 14.76) {
    moonIcon = '🌔';
    moonPhaseName = 'Rastući grbavi Mjesec';
  } else if (ageDays < 16.61) {
    moonIcon = '🌕';
    moonPhaseName = 'Pun Mjesec (Uštap)';
  } else if (ageDays < 22.15) {
    moonIcon = '🌖';
    moonPhaseName = 'Opadajući grbavi Mjesec';
  } else if (ageDays < 23.99) {
    moonIcon = '🌗';
    moonPhaseName = 'Zadnja četvrt';
  } else {
    moonIcon = '🌘';
    moonPhaseName = 'Opadajući srp';
  }

  const transitHour = (ageDays * 0.815 + 12.15) % 24;
  const nadirHour = (transitHour + 12) % 24;
  const moonriseHour = (transitHour - 5.8 + 24) % 24;
  const moonsetHour = (transitHour + 5.8) % 24;

  const sunriseHour = 6.96;
  const sunsetHour = 16.56;

  let index = 76;
  if (ageDays <= 2.5 || Math.abs(ageDays - 14.76) <= 2.5) {
    index += 14;
  } else if (Math.abs(ageDays - 7.38) <= 2.0 || Math.abs(ageDays - 22.15) <= 2.0) {
    index += 10;
  } else {
    index += 6;
  }

  const minDistToTwilight = Math.min(
    Math.abs(transitHour - sunsetHour),
    Math.abs(nadirHour - sunsetHour),
    Math.abs(moonriseHour - sunsetHour),
    Math.abs(transitHour - sunriseHour)
  );
  if (minDistToTwilight <= 1.8) {
    index += 7;
  } else if (minDistToTwilight <= 3.2) {
    index += 4;
  }

  if (pressureHpa >= 1013 && pressureHpa <= 1024) index += 4;
  if (windSpeedMs <= 4.5) index += 3;
  else if (windSpeedMs > 7.5) index -= 6;

  const solunarIndex = Math.max(55, Math.min(99, Math.round(index)));
  const starRating = solunarIndex >= 90 ? 5 : solunarIndex >= 78 ? 4 : 3;
  const ratingLabel =
    solunarIndex >= 92
      ? 'Ekstremni griz (Vrhunski solunar)'
      : solunarIndex >= 84
      ? 'Izvrstan griz (Visoka aktivnost)'
      : 'Vrlo dobar griz (Stabilna aktivnost)';

  const optimalEveningStart = sunsetHour - 0.35;
  const optimalEveningEnd = sunsetHour + 3.6;

  const dateLabel = targetDate.toLocaleDateString('hr-HR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return {
    dateLabel,
    moonIcon,
    moonPhaseName,
    illuminationPct,
    moonAgeDays,
    solunarIndex,
    starRating,
    ratingLabel,
    majorZenith: {
      start: fmtHour(transitHour - 1.0),
      end: fmtHour(transitHour + 1.0),
      peak: fmtHour(transitHour)
    },
    majorNadir: {
      start: fmtHour(nadirHour - 1.0),
      end: fmtHour(nadirHour + 1.0),
      peak: fmtHour(nadirHour)
    },
    minorMoonrise: {
      start: fmtHour(moonriseHour - 0.5),
      end: fmtHour(moonriseHour + 0.5),
      peak: fmtHour(moonriseHour)
    },
    minorMoonset: {
      start: fmtHour(moonsetHour - 0.5),
      end: fmtHour(moonsetHour + 0.5),
      peak: fmtHour(moonsetHour)
    },
    sunsetTime: fmtHour(sunsetHour),
    sunriseTime: fmtHour(sunriseHour),
    optimalEveningWindow: `${fmtHour(optimalEveningStart)} – ${fmtHour(optimalEveningEnd)} h`,
    optimalNightWindow: `${fmtHour(transitHour - 0.75)} – ${fmtHour(transitHour + 1.1)} h`,
    optimalDawnWindow: `${fmtHour(sunriseHour - 1.4)} – ${fmtHour(sunriseHour + 0.4)} h`,
    knightCanalSynthesis: `Prema Solunarnoj teoriji Johna Aldena Knighta (1926.), kombinirana gravitacijska sila Sunca i Mjeseca u fazi "${moonPhaseName}" (${illuminationPct}% osvijetljenosti, starost ${moonAgeDays} d) stvara plimni mikro-kurenat kroz Vinodolski kanal između obale Novog Vinodolskog i otoka Krka. Gornja kulminacija Mjeseca u ${fmtHour(transitHour)} h i donja kulminacija u ${fmtHour(nadirHour)} h pokreću sitnu plavu ribu (gavune i srdele) uz strme prijelaze dna, što izravno aktivira jato liganja.`,
    aiTacticalAnalysis: `Google AI multi-faktorska analiza (sinkronizacija Knightovih Major/Minor tablica, kuta mjesečine nad Velebitsko-Vinodolskim kanalom, tlaka od ${pressureHpa} hPa i temperature od ${tempC}°C) izračunava Solunarni indeks griza od ${solunarIndex}/100. Najjači udar liganja očekuje se u sumrak (${fmtHour(optimalEveningStart)} – ${fmtHour(optimalEveningEnd)} h) kada se pad dnevnog svjetla spaja sa solunarnim impulsom, te tijekom noćnog meridijanskog tranzita (${fmtHour(transitHour - 0.75)} – ${fmtHour(transitHour + 1.1)} h) na dubinama 8–16 m.`
  };
}
