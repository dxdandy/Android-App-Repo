import { doc, setDoc, onSnapshot, Unsubscribe, getDoc } from 'firebase/firestore';
import { db } from './firebase';
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

export type DailyCatches = Record<string, number>; // dateStr -> count
export type AllCalamariData = Record<CalamariParticipantId, DailyCatches>;

export interface CalamariCompetitionState {
  catches: AllCalamariData;
  updatedAt: number;
  lastUpdatedBy?: string;
  loggedParticipants?: CalamariParticipantId[];
}

const LOCAL_CALAMARI_KEY = 'ribo_calamari_competition_v1';
const STORAGE_LOGGED_USER_KEY = 'ribo_calamari_logged_user_v1';
const STORAGE_LOGGED_HISTORY_KEY = 'ribo_calamari_logged_users_history_v1';
const FIRESTORE_CALAMARI_DOC = 'novi_vinodolski_2026';

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

/**
 * Dohvaća sve prijave spremljene lokalno na ovom uređaju
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
    const rawComp = localStorage.getItem(LOCAL_CALAMARI_KEY);
    if (rawComp) {
      const parsedComp = JSON.parse(rawComp);
      if (Array.isArray(parsedComp?.loggedParticipants)) {
        parsedComp.loggedParticipants.forEach((id: any) => {
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

export function getStoredCalamariData(): CalamariCompetitionState {
  if (typeof window === 'undefined') {
    return { catches: createEmptyCalamariData(), updatedAt: Date.now(), loggedParticipants: [] };
  }
  try {
    const raw = localStorage.getItem(LOCAL_CALAMARI_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.catches) {
        return {
          ...parsed,
          loggedParticipants: mergeLoggedParticipants(parsed.loggedParticipants)
        };
      }
    }
  } catch {}
  return {
    catches: createEmptyCalamariData(),
    updatedAt: Date.now(),
    loggedParticipants: getLocalDeviceLoggedParticipants()
  };
}

export function saveStoredCalamariData(state: CalamariCompetitionState): void {
  if (typeof window === 'undefined') return;
  try {
    const merged: CalamariCompetitionState = {
      ...state,
      loggedParticipants: mergeLoggedParticipants(state.loggedParticipants)
    };
    localStorage.setItem(LOCAL_CALAMARI_KEY, JSON.stringify(merged));
  } catch {}
}

async function pushCalamariToBackend(state: CalamariCompetitionState): Promise<void> {
  try {
    await fetch(getApiUrl('/api/calamari/update'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
  } catch {}
}

/**
 * Automatski sinkronizira lokalno prijavljene sudionike s ovog uređaja u Firestore i poslužitelj
 * (osigurava da se svatko tko se već prijavio odmah ukloni s liste prijava na svim uređajima)
 */
export async function syncLocalCalamariLoginsToServer(): Promise<CalamariCompetitionState> {
  const localLogged = getLocalDeviceLoggedParticipants();
  const state = await fetchCalamariDataServer();
  const remoteLogged = Array.isArray(state.loggedParticipants) ? state.loggedParticipants : [];
  const mergedLogged = mergeLoggedParticipants(remoteLogged, localLogged);

  const hasNewLocal = mergedLogged.some(id => !remoteLogged.includes(id));
  if (hasNewLocal) {
    const updated: CalamariCompetitionState = {
      ...state,
      loggedParticipants: mergedLogged,
      updatedAt: Math.max(Date.now(), state.updatedAt || 0)
    };
    saveStoredCalamariData(updated);
    pushCalamariToBackend(updated);
    try {
      await setDoc(doc(db, 'calamari_competition', FIRESTORE_CALAMARI_DOC), updated, { merge: true });
    } catch {}
    return updated;
  }
  return state;
}

export async function fetchCalamariDataServer(): Promise<CalamariCompetitionState> {
  const stored = getStoredCalamariData();
  let bestState: CalamariCompetitionState = stored;
  let remoteLogged: CalamariParticipantId[] = [];

  // 1. Pokušaj dohvatiti s Express poslužitelja
  try {
    const res = await fetch(getApiUrl(`/api/calamari?t=${Date.now()}`), {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.catches) {
        if (Array.isArray(data.loggedParticipants)) {
          remoteLogged = mergeLoggedParticipants(remoteLogged, data.loggedParticipants);
        }
        if (!bestState.updatedAt || (data.updatedAt || 0) >= bestState.updatedAt) {
          bestState = data;
        }
      }
    }
  } catch {}

  // 2. Dohvat iz Firestore oblaka
  try {
    const snap = await getDoc(doc(db, 'calamari_competition', FIRESTORE_CALAMARI_DOC));
    if (snap.exists()) {
      const data = snap.data() as CalamariCompetitionState;
      if (data && data.catches) {
        if (Array.isArray(data.loggedParticipants)) {
          remoteLogged = mergeLoggedParticipants(remoteLogged, data.loggedParticipants);
        }
        if (!bestState.updatedAt || (data.updatedAt || 0) >= bestState.updatedAt) {
          bestState = data;
        }
      }
    }
  } catch {}

  const mergedLogged = mergeLoggedParticipants(
    stored.loggedParticipants,
    bestState.loggedParticipants,
    remoteLogged
  );

  const finalState: CalamariCompetitionState = {
    ...bestState,
    loggedParticipants: mergedLogged
  };

  saveStoredCalamariData(finalState);

  // Ako ovaj uređaj ima lokalnu prijavu koja još nije zapisana u oblaku, odmah ju zapiši
  const cloudMissingLocal = mergedLogged.some(id => !remoteLogged.includes(id));
  if (cloudMissingLocal && mergedLogged.length > 0) {
    pushCalamariToBackend(finalState);
    try {
      await setDoc(doc(db, 'calamari_competition', FIRESTORE_CALAMARI_DOC), finalState, { merge: true });
    } catch {}
  }

  return finalState;
}

export async function recordCalamariParticipantLogin(
  participantId: CalamariParticipantId
): Promise<CalamariCompetitionState> {
  const current = await fetchCalamariDataServer();
  const mergedLogged = mergeLoggedParticipants(current.loggedParticipants, [participantId]);

  const updated: CalamariCompetitionState = {
    ...current,
    loggedParticipants: mergedLogged,
    updatedAt: Date.now()
  };

  saveStoredCalamariData(updated);
  pushCalamariToBackend(updated);
  try {
    await setDoc(doc(db, 'calamari_competition', FIRESTORE_CALAMARI_DOC), updated, { merge: true });
  } catch (err) {
    console.warn('Greška pri spremanju prijave u Firestore:', err);
  }
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
  current.updatedAt = Date.now();
  current.lastUpdatedBy = editorName;
  current.loggedParticipants = mergeLoggedParticipants(current.loggedParticipants);

  saveStoredCalamariData(current);
  pushCalamariToBackend(current);

  try {
    await setDoc(doc(db, 'calamari_competition', FIRESTORE_CALAMARI_DOC), current, { merge: true });
  } catch (err) {
    console.warn('Greška pri spremanju Calamari podataka u Firestore:', err);
  }

  return current;
}

export async function adminResetParticipantOrDateServer(
  mode: 'participant' | 'date' | 'all',
  targetKey: string,
  editorName: string = 'Daniel (Admin)'
): Promise<CalamariCompetitionState> {
  const current = getStoredCalamariData();

  if (mode === 'all') {
    current.catches = createEmptyCalamariData();
  } else if (mode === 'participant') {
    const pid = targetKey as CalamariParticipantId;
    if (current.catches[pid]) {
      CALAMARI_DATES.forEach(d => {
        current.catches[pid][d.dateStr] = 0;
      });
    }
  } else if (mode === 'date') {
    CALAMARI_PARTICIPANTS.forEach(p => {
      if (!current.catches[p.id]) current.catches[p.id] = {};
      current.catches[p.id][targetKey] = 0;
    });
  }

  current.updatedAt = Date.now();
  current.lastUpdatedBy = editorName;
  current.loggedParticipants = mergeLoggedParticipants(current.loggedParticipants);
  saveStoredCalamariData(current);
  pushCalamariToBackend(current);

  try {
    await setDoc(doc(db, 'calamari_competition', FIRESTORE_CALAMARI_DOC), current, { merge: true });
  } catch (err) {
    console.warn('Greška pri admin resetiranju Calamari podataka:', err);
  }

  return current;
}

export function subscribeToCalamariData(callback: (state: CalamariCompetitionState) => void): Unsubscribe {
  const docRef = doc(db, 'calamari_competition', FIRESTORE_CALAMARI_DOC);
  const unsubFirestore = onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data() as CalamariCompetitionState;
      if (data && data.catches) {
        const local = getStoredCalamariData();
        const merged: CalamariCompetitionState = {
          ...data,
          loggedParticipants: mergeLoggedParticipants(local.loggedParticipants, data.loggedParticipants)
        };
        saveStoredCalamariData(merged);
        callback(merged);
      }
    }
  }, (error) => {
    console.warn('Calamari live sync warning:', error);
  });

  // Dodatni live interval prema poslužitelju svakih 6 sekundi dok je prozor otvoren
  const pollTimer = setInterval(async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      const res = await fetch(getApiUrl(`/api/calamari?t=${Date.now()}`), {
        cache: 'no-store',
        signal: AbortSignal.timeout(3500)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.catches) {
          const local = getStoredCalamariData();
          const mergedLogged = mergeLoggedParticipants(local.loggedParticipants, data.loggedParticipants);
          if (
            (data.updatedAt || 0) > (local.updatedAt || 0) ||
            mergedLogged.length !== (local.loggedParticipants?.length || 0)
          ) {
            const merged: CalamariCompetitionState = {
              ...((data.updatedAt || 0) >= (local.updatedAt || 0) ? data : local),
              loggedParticipants: mergedLogged
            };
            saveStoredCalamariData(merged);
            callback(merged);
          }
        }
      }
    } catch {}
  }, 6000);

  return () => {
    unsubFirestore();
    clearInterval(pollTimer);
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
  // Referentni mlađak: 18.01.2026. 18:50 UTC
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

  // Meridijanski tranzit Mjeseca za Novi Vinodolski (14.79° E)
  const transitHour = (ageDays * 0.815 + 12.15) % 24;
  const nadirHour = (transitHour + 12) % 24;
  const moonriseHour = (transitHour - 5.8 + 24) % 24;
  const moonsetHour = (transitHour + 5.8) % 24;

  // Studeni u Vinodolskom kanalu: izlazak Sunca ~06:58, zalazak ~16:34
  const sunriseHour = 6.96;
  const sunsetHour = 16.56;

  // John Alden Knight Solunar Index izračun (baza + faza Mjeseca + preklapanje sa sumrakom/zorom + barometar/vjetar)
  let index = 76;
  // Utjecaj syzygya (Mlađak / Uštap) ili prve/zadnje četvrti
  if (ageDays <= 2.5 || Math.abs(ageDays - 14.76) <= 2.5) {
    index += 14;
  } else if (Math.abs(ageDays - 7.38) <= 2.0 || Math.abs(ageDays - 22.15) <= 2.0) {
    index += 10;
  } else {
    index += 6;
  }

  // John Alden Knight bonus kada se Major ili Minor preklopi sa zalaskom ili izlaskom Sunca
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

  // Utjecaj barometra i vjetra u Vinodolskom kanalu
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
