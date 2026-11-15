import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  KeyRound, 
  Trophy, 
  Calendar, 
  MapPin, 
  Award,
  ChevronLeft,
  Compass,
  Waves,
  Moon,
  Sparkles,
  Check,
  ShieldCheck,
  SlidersHorizontal,
  RotateCcw,
  Star,
  Flame,
  Clock
} from 'lucide-react';
import { 
  CALAMARI_PARTICIPANTS, 
  CALAMARI_DATES, 
  CalamariCompetitionState, 
  CalamariParticipantId, 
  adminResetParticipantOrDateServer,
  calculateVinodolskiSolunar,
  fetchCalamariDataServer, 
  getStoredCalamariData, 
  recordCalamariParticipantLogin,
  subscribeToCalamariData, 
  updateCalamariCatchesServer 
} from '../services/calamariService';
import { fetchMeteoForCoords } from '../services/weatherService';

interface CalamariModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_LOGGED_USER_KEY = 'ribo_calamari_logged_user_v1';
const STORAGE_LOGGED_HISTORY_KEY = 'ribo_calamari_logged_users_history_v1';

const SHORT_DAY_LABELS: Record<string, { dayName: string; dateShort: string; isoDate: string }> = {
  '18.11.2026': { dayName: 'Sri', dateShort: '18.11.', isoDate: '2026-11-18T18:00:00' },
  '19.11.2026': { dayName: 'Čet', dateShort: '19.11.', isoDate: '2026-11-19T18:00:00' },
  '20.11.2026': { dayName: 'Pet', dateShort: '20.11.', isoDate: '2026-11-20T18:00:00' },
  '21.11.2026': { dayName: 'Sub', dateShort: '21.11.', isoDate: '2026-11-21T18:00:00' },
  '22.11.2026': { dayName: 'Ned', dateShort: '22.11.', isoDate: '2026-11-22T18:00:00' }
};

type SolunarTargetOption = 'now_24h' | 'now_48h' | 'now_72h' | '18.11.2026' | '19.11.2026' | '20.11.2026' | '21.11.2026' | '22.11.2026';

export const CalamariModal: React.FC<CalamariModalProps> = ({ isOpen, onClose }) => {
  const [state, setState] = useState<CalamariCompetitionState>(() => getStoredCalamariData());
  const [loggedUser, setLoggedUser] = useState<CalamariParticipantId | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return (localStorage.getItem(STORAGE_LOGGED_USER_KEY) as CalamariParticipantId) || null;
    } catch {
      return null;
    }
  });

  const [localLoggedHistory, setLocalLoggedHistory] = useState<CalamariParticipantId[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_LOGGED_HISTORY_KEY);
      const parsed: CalamariParticipantId[] = raw ? JSON.parse(raw) : [];
      const single = localStorage.getItem(STORAGE_LOGGED_USER_KEY) as CalamariParticipantId | null;
      if (single && !parsed.includes(single)) {
        parsed.push(single);
      }
      return parsed;
    } catch {
      return [];
    }
  });

  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [selectedUserForPin, setSelectedUserForPin] = useState<CalamariParticipantId | null>(null);
  const [showManualLoginPanel, setShowManualLoginPanel] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Admin napredne kontrole za uređivanje svih sudionika u tablici
  const [adminEditAllEnabled, setAdminEditAllEnabled] = useState<boolean>(true);
  const [showAdminTools, setShowAdminTools] = useState<boolean>(false);
  const [confirmResetTarget, setConfirmResetTarget] = useState<{ mode: 'participant' | 'date' | 'all'; key: string; label: string } | null>(null);

  // Odabrani dan u Solunarnom & John Alden Knight kalkulatoru
  const [selectedSolunarTarget, setSelectedSolunarTarget] = useState<SolunarTargetOption>('now_24h');

  const [noviMeteo, setNoviMeteo] = useState<{
    temp: number;
    seaTemp: number;
    windSpeed: number;
    windDirectionDeg: number;
    windNameHr: string;
    condition: string;
    pressure: number;
  }>({
    temp: 8.4,
    seaTemp: 16.9,
    windSpeed: 1.7,
    windDirectionDeg: 28,
    windNameHr: 'Sjeveroistočni vjetar (Bura)',
    condition: 'djelomicno_oblacno',
    pressure: 1023
  });

  useEffect(() => {
    if (!isOpen) return;

    const getFullCroatianWindName = (deg?: number, speedMs?: number): string => {
      if (speedMs !== undefined && speedMs < 0.3) {
        return 'Tiho bez vjetra (Bonaca)';
      }
      if (deg === undefined || isNaN(deg)) {
        return 'Sjeveroistočni vjetar (Bura)';
      }
      const norm = ((deg % 360) + 360) % 360;
      if (norm >= 337.5 || norm < 22.5) return 'Sjeverni vjetar (Tramontana)';
      if (norm >= 22.5 && norm < 67.5) return 'Sjeveroistočni vjetar (Bura)';
      if (norm >= 67.5 && norm < 112.5) return 'Istočni vjetar (Levant)';
      if (norm >= 112.5 && norm < 157.5) return 'Jugoistočni vjetar (Jugo)';
      if (norm >= 157.5 && norm < 202.5) return 'Južni vjetar (Oštro)';
      if (norm >= 202.5 && norm < 247.5) return 'Jugozapadni vjetar (Lebić)';
      if (norm >= 247.5 && norm < 292.5) return 'Zapadni vjetar (Pulenat)';
      return 'Sjeverozapadni vjetar (Maestral)';
    };

    const loadLiveNoviVinodolskiData = async () => {
      try {
        const [meteoRes, weatherRawRes, marineRawRes] = await Promise.allSettled([
          fetchMeteoForCoords(45.1278, 14.7892),
          fetch(
            'https://api.open-meteo.com/v1/forecast?latitude=45.1278&longitude=14.7892&current=temperature_2m,pressure_msl,surface_pressure,weather_code,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=Europe%2FZagreb',
            { signal: AbortSignal.timeout(4500) }
          ).then(r => (r.ok ? r.json() : null)),
          fetch(
            'https://marine-api.open-meteo.com/v1/marine?latitude=45.11&longitude=14.76&current=sea_surface_temperature&timezone=Europe%2FZagreb',
            { signal: AbortSignal.timeout(4500) }
          ).then(r => (r.ok ? r.json() : null))
        ]);

        const baseMeteo = meteoRes.status === 'fulfilled' ? meteoRes.value : null;
        const rawCurr = weatherRawRes.status === 'fulfilled' && weatherRawRes.value?.current ? weatherRawRes.value.current : null;
        const marineCurr = marineRawRes.status === 'fulfilled' && marineRawRes.value?.current ? marineRawRes.value.current : null;

        const airTemp =
          typeof rawCurr?.temperature_2m === 'number'
            ? Math.round(rawCurr.temperature_2m * 10) / 10
            : baseMeteo?.airTempC ?? 8.4;

        const windSpeed =
          typeof rawCurr?.wind_speed_10m === 'number'
            ? Math.round(rawCurr.wind_speed_10m * 10) / 10
            : baseMeteo?.windSpeedMs ?? 1.7;

        const windDeg =
          typeof rawCurr?.wind_direction_10m === 'number'
            ? Math.round(rawCurr.wind_direction_10m)
            : 28;

        const pressure =
          typeof rawCurr?.pressure_msl === 'number'
            ? Math.round(rawCurr.pressure_msl)
            : baseMeteo?.airPressureHpa ?? 1023;

        const seaTemp =
          typeof marineCurr?.sea_surface_temperature === 'number'
            ? Math.round(marineCurr.sea_surface_temperature * 10) / 10
            : 16.9;

        setNoviMeteo({
          temp: airTemp,
          seaTemp,
          windSpeed,
          windDirectionDeg: windDeg,
          windNameHr: getFullCroatianWindName(windDeg, windSpeed),
          condition: baseMeteo?.weatherCondition || 'djelomicno_oblacno',
          pressure
        });
      } catch {}
    };

    loadLiveNoviVinodolskiData();
    const intervalId = window.setInterval(loadLiveNoviVinodolskiData, 5 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [isOpen]);

  // Sinkronizacija u stvarnom vremenu s Firestoreom
  useEffect(() => {
    if (!isOpen) return;
    fetchCalamariDataServer().then(res => setState(res));
    const unsubscribe = subscribeToCalamariData((newData) => {
      setState(newData);
    });
    return () => unsubscribe();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Kombinirana lista svih prijavljenih sudionika (lokalno + sinkronizirano)
  const allLoggedParticipants = useMemo(() => {
    const set = new Set<CalamariParticipantId>(localLoggedHistory);
    if (loggedUser) set.add(loggedUser);
    if (Array.isArray(state.loggedParticipants)) {
      state.loggedParticipants.forEach(id => set.add(id));
    }
    return Array.from(set);
  }, [localLoggedHistory, loggedUser, state.loggedParticipants]);

  // Provjera jesu li se sva trojica s šiframa (Silvio, Tuna, Daniel) prijavila
  const areAllUsersLogged = useMemo(() => {
    return (
      allLoggedParticipants.includes('silvio') &&
      allLoggedParticipants.includes('tuna') &&
      allLoggedParticipants.includes('daniel')
    );
  }, [allLoggedParticipants]);

  // Je li na ovom uređaju prijavljen administrator (Daniel)
  const isAdminUser = useMemo(() => {
    return loggedUser === 'daniel' || localLoggedHistory.includes('daniel');
  }, [loggedUser, localLoggedHistory]);

  const handleLoginWithPin = async (participantId: CalamariParticipantId) => {
    const participant = CALAMARI_PARTICIPANTS.find(p => p.id === participantId);
    if (!participant) return;

    if (participantId === 'dida') {
      setPinError('Za Dida unose uređuje Daniel.');
      return;
    }

    if (participant.pin && pinInput.trim() === participant.pin) {
      setLoggedUser(participantId);
      const updatedLocal = Array.from(new Set([...localLoggedHistory, participantId]));
      setLocalLoggedHistory(updatedLocal);
      try {
        localStorage.setItem(STORAGE_LOGGED_USER_KEY, participantId);
        localStorage.setItem(STORAGE_LOGGED_HISTORY_KEY, JSON.stringify(updatedLocal));
      } catch {}

      setPinInput('');
      setPinError(null);
      setSelectedUserForPin(null);
      setShowManualLoginPanel(false);
      setSuccessToast(`✓ Prijava spremljena: ${participant.name}`);
      setTimeout(() => setSuccessToast(null), 2800);

      const updatedState = await recordCalamariParticipantLogin(participantId);
      setState(updatedState);
    } else {
      setPinError('Netočna šifra! Pokušajte ponovno.');
    }
  };

  // Provjera može li ovaj uređaj uređivati ulov za odabranog natjecatelja
  const canEditParticipant = (targetId: CalamariParticipantId): boolean => {
    if (isAdminUser) {
      // Ako je Admin uključio uređivanje svih (zadano uključeno), može uređivati svima (Dida, Tuna, Silvio, Daniel)
      if (adminEditAllEnabled) return true;
      // Inače uređuje za sebe (Daniel) i za Dida
      return targetId === 'daniel' || targetId === 'dida';
    }
    if (loggedUser === targetId || localLoggedHistory.includes(targetId)) {
      return true;
    }
    return false;
  };

  const handleUpdateCatch = async (targetId: CalamariParticipantId, dateStr: string, newCount: number) => {
    if (!canEditParticipant(targetId)) {
      return;
    }

    const safeCount = Math.max(0, Math.min(999, newCount));
    const editorName = isAdminUser
      ? 'Daniel (Admin)'
      : loggedUser
      ? (CALAMARI_PARTICIPANTS.find(p => p.id === loggedUser)?.name || 'Natjecatelj')
      : 'Natjecatelj';
    const updated = await updateCalamariCatchesServer(targetId, dateStr, safeCount, editorName);
    setState(updated);
  };

  const handleExecuteAdminReset = async () => {
    if (!confirmResetTarget || !isAdminUser) return;
    const updated = await adminResetParticipantOrDateServer(
      confirmResetTarget.mode,
      confirmResetTarget.key,
      'Daniel (Admin)'
    );
    setState(updated);
    setSuccessToast(`✓ Resetirano: ${confirmResetTarget.label}`);
    setConfirmResetTarget(null);
    setTimeout(() => setSuccessToast(null), 2800);
  };

  // Izračun ukupnog ulova po osobi i po danu
  const calculateTotalForParticipant = (id: CalamariParticipantId) => {
    const days = state.catches[id] || {};
    return Object.values(days).reduce((acc, val) => acc + (Number(val) || 0), 0);
  };

  const calculateTotalForDate = (dateStr: string) => {
    return CALAMARI_PARTICIPANTS.reduce((acc, p) => {
      const days = state.catches[p.id] || {};
      return acc + (Number(days[dateStr]) || 0);
    }, 0);
  };

  const grandTotal = CALAMARI_PARTICIPANTS.reduce((acc, p) => acc + calculateTotalForParticipant(p.id), 0);

  // Rang lista natjecatelja (sortirano po ukupnom broju liganja silazno)
  const sortedParticipants = [...CALAMARI_PARTICIPANTS].sort((a, b) => {
    return calculateTotalForParticipant(b.id) - calculateTotalForParticipant(a.id);
  });

  // Izračun aktivnog datuma za Solunarnu teoriju (John Alden Knight) & Vinodolski kanal
  const activeSolunarAnalysis = useMemo(() => {
    let targetDate = new Date();
    if (selectedSolunarTarget === 'now_24h') {
      targetDate = new Date();
    } else if (selectedSolunarTarget === 'now_48h') {
      targetDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    } else if (selectedSolunarTarget === 'now_72h') {
      targetDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
    } else if (SHORT_DAY_LABELS[selectedSolunarTarget]) {
      targetDate = new Date(SHORT_DAY_LABELS[selectedSolunarTarget].isoDate);
    }
    return calculateVinodolskiSolunar(
      targetDate,
      noviMeteo.pressure,
      noviMeteo.windSpeed,
      noviMeteo.temp
    );
  }, [selectedSolunarTarget, noviMeteo]);

  // Izračun za brze kartice 24h / 48h / 72h
  const solunar24h = useMemo(
    () => calculateVinodolskiSolunar(new Date(), noviMeteo.pressure, noviMeteo.windSpeed, noviMeteo.temp),
    [noviMeteo]
  );
  const solunar48h = useMemo(
    () => calculateVinodolskiSolunar(new Date(Date.now() + 24 * 3600 * 1000), noviMeteo.pressure, noviMeteo.windSpeed, noviMeteo.temp),
    [noviMeteo]
  );
  const solunar72h = useMemo(
    () => calculateVinodolskiSolunar(new Date(Date.now() + 48 * 3600 * 1000), noviMeteo.pressure, noviMeteo.windSpeed, noviMeteo.temp),
    [noviMeteo]
  );

  if (!isOpen) return null;

  const shouldShowLoginSection = !areAllUsersLogged || showManualLoginPanel;

  return (
    <div className="fixed inset-0 z-[60] bg-gradient-to-b from-slate-950 via-[#041428] to-slate-950 flex flex-col w-full h-full overflow-hidden animate-fade-in">
      
      {/* STATIČNO ZAGLAVLJE NA VRHU EKRANA - na istoj poziciji i visini kao RiboPrognoza, s proširenjem prema dolje za sve podatke */}
      <header className="sticky top-0 z-30 shrink-0 w-full bg-slate-950/95 backdrop-blur-md border-b border-cyan-500/40 shadow-[0_4px_24px_rgba(6,182,212,0.18)] pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-1.5 sm:py-2.5 w-full">
          
          {/* Glavni red zaglavlja - identičan položaj ikone i naslova kao RiboPrognoza */}
          <div className="flex items-center justify-between gap-2 w-full">
            
            {/* Lijevo: Ikona s glavom lignje, krakovima i ekstra velikim očima + bijeli dvoredni naslov */}
            <div 
              onClick={onClose}
              className="flex items-center gap-2 sm:gap-2.5 min-w-0 cursor-pointer shrink-0 group"
              title="Povratak na RiboPrognozu"
            >
              <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl bg-gradient-to-br from-cyan-500/35 via-blue-700/40 to-slate-900 border border-cyan-400/70 flex items-center justify-center shadow-md ring-1 sm:ring-2 ring-cyan-500/30 group-hover:ring-cyan-400/60 transition-all shrink-0 overflow-hidden p-0.5">
                <svg
                  viewBox="0 0 64 64"
                  className="w-full h-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-label="Calamari ikona"
                >
                  <defs>
                    <linearGradient id="squidHeadGrad" x1="32" y1="4" x2="32" y2="42" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#ff7eb3" />
                      <stop offset="55%" stopColor="#f43f5e" />
                      <stop offset="100%" stopColor="#be123c" />
                    </linearGradient>
                    <linearGradient id="squidTentacleGrad" x1="32" y1="38" x2="32" y2="62" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#fb7185" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                  </defs>

                  {/* Krakovi (tentacles) dolje */}
                  <path
                    d="M18 39 C13 47, 9 53, 12 60 C14 56, 17 50, 21 42"
                    stroke="url(#squidTentacleGrad)"
                    strokeWidth="3.6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M24 41 C21 49, 19 56, 22 62"
                    stroke="url(#squidTentacleGrad)"
                    strokeWidth="3.6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M29 42 C28 50, 28 57, 30 62"
                    stroke="url(#squidTentacleGrad)"
                    strokeWidth="3.6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M35 42 C36 50, 36 57, 34 62"
                    stroke="url(#squidTentacleGrad)"
                    strokeWidth="3.6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M40 41 C43 49, 45 56, 42 62"
                    stroke="url(#squidTentacleGrad)"
                    strokeWidth="3.6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M46 39 C51 47, 55 53, 52 60 C50 56, 47 50, 43 42"
                    stroke="url(#squidTentacleGrad)"
                    strokeWidth="3.6"
                    strokeLinecap="round"
                  />

                  {/* Bočne peraje glave lignje (plašt) */}
                  <path
                    d="M32 3 L54 18 L44 26 L20 26 L10 18 Z"
                    fill="#fb7185"
                    stroke="#fda4af"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />

                  {/* Glava / Plašt lignje */}
                  <path
                    d="M32 4 C43 12, 48 23, 46 38 C45 41, 39 43, 32 43 C25 43, 19 41, 18 38 C16 23, 21 12, 32 4 Z"
                    fill="url(#squidHeadGrad)"
                    stroke="#ffe4e6"
                    strokeWidth="1.5"
                  />

                  {/* EKSTRA VELIKE OČI (Lijevo i Desno) */}
                  {/* Lijevo oko */}
                  <circle cx="21.5" cy="29.5" r="9.5" fill="#ffffff" stroke="#0f172a" strokeWidth="2" />
                  <circle cx="22.5" cy="29.5" r="5.6" fill="#020617" />
                  <circle cx="22.5" cy="29.5" r="4.2" fill="#06b6d4" />
                  <circle cx="22.5" cy="29.5" r="2.7" fill="#020617" />
                  <circle cx="19.5" cy="26.5" r="2.4" fill="#ffffff" />
                  <circle cx="24.8" cy="32.2" r="1.1" fill="#ffffff" />

                  {/* Desno oko */}
                  <circle cx="42.5" cy="29.5" r="9.5" fill="#ffffff" stroke="#0f172a" strokeWidth="2" />
                  <circle cx="41.5" cy="29.5" r="5.6" fill="#020617" />
                  <circle cx="41.5" cy="29.5" r="4.2" fill="#06b6d4" />
                  <circle cx="41.5" cy="29.5" r="2.7" fill="#020617" />
                  <circle cx="39.5" cy="26.5" r="2.4" fill="#ffffff" />
                  <circle cx="44.8" cy="32.2" r="1.1" fill="#ffffff" />
                </svg>
              </div>
              <div className="h-9 sm:h-11 py-[1px] flex flex-col justify-between items-start text-left select-none shrink-0">
                <span className="font-black text-white text-[15px] sm:text-[19px] leading-none tracking-tight block">
                  Calamari
                </span>
                <span className="font-black text-white text-[15px] sm:text-[19px] leading-none tracking-tight block">
                  Kup 2026
                </span>
              </div>
            </div>

            {/* Desno: Ukupni ulov, gumb za prijavu i gumb za zatvaranje */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-cyan-950/90 border border-cyan-500/50 flex items-center gap-1.5 shadow-inner">
                <span className="text-[11px] sm:text-xs font-bold text-cyan-200">Ukupno:</span>
                <span className="text-sm sm:text-base font-black text-amber-400 font-mono tabular-nums">
                  {grandTotal}
                </span>
                <span className="text-[11px] sm:text-xs text-cyan-300 hidden xs:inline">liganja</span>
              </div>

              <button
                type="button"
                onClick={() => setShowManualLoginPanel(prev => !prev)}
                className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center border transition-all cursor-pointer active:scale-95 shrink-0 ${
                  showManualLoginPanel
                    ? 'bg-cyan-600 text-white border-cyan-300 shadow-md'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-cyan-300 border-cyan-500/40'
                }`}
                title="Prijava natjecatelja / Admin pristup"
              >
                <KeyRound className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-slate-700/80 shrink-0 active:scale-95"
                title="Zatvori Calamari kup (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Prošireni donji dio zaglavlja prema dolje kako bi svi podaci o lokaciji, terminu, mjesečevoj mijeni i vremenu bili potpuno vidljivi */}
          <div className="mt-2 pt-1.5 border-t border-cyan-500/20 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] sm:text-xs text-cyan-200/90">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="inline-flex items-center gap-1 font-bold text-white">
                <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                Novi Vinodolski
              </span>
              <span className="text-cyan-600">•</span>
              <span className="inline-flex items-center gap-1 font-mono text-cyan-200">
                <Calendar className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                18.11. – 22.11.2026.
              </span>
              <span className="text-cyan-600">•</span>
              <span className="inline-flex items-center gap-1 font-bold text-amber-300">
                <span>{solunar24h.moonIcon}</span>
                <span>{solunar24h.moonPhaseName} ({solunar24h.illuminationPct}%)</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10.5px] sm:text-xs text-teal-300">
              <span>Indeks griza: <strong className="text-amber-400">{solunar24h.solunarIndex}/100</strong></span>
              <span className="text-slate-600">•</span>
              <span>Temp. zraka: <strong className="text-white">{noviMeteo.temp}°C</strong></span>
              <span className="text-slate-600">•</span>
              <span>Vjetar: <strong className="text-white">{noviMeteo.windSpeed} m/s</strong></span>
              <span className="text-slate-600">•</span>
              <span>Tlak zraka: <strong className="text-white">{noviMeteo.pressure} hPa</strong></span>
              <span className="text-slate-600">•</span>
              <span>Temp. mora: <strong className="text-cyan-300">{noviMeteo.seaTemp}°C</strong></span>
              <span className="text-slate-600">•</span>
              <span>Smjer vjetra: <strong className="text-amber-300">{noviMeteo.windNameHr}</strong></span>
            </div>
          </div>

        </div>
      </header>

      {/* RUBRIKA ZA PRIJAVU - Centrirani gumbovi s povećanim razmakom, automatski se skriva kad su svi prijavljeni */}
      {shouldShowLoginSection && (
        <div className="bg-gradient-to-r from-slate-950 via-cyan-950/60 to-slate-950 px-3 sm:px-6 py-3 border-b border-cyan-500/30 shrink-0">
          <div className="max-w-4xl mx-auto flex flex-col items-center justify-center gap-2.5">
            <span className="text-xs font-bold text-cyan-200 text-center">
              Odaberite svoje ime za prijavu i unos ulova
            </span>

            {/* Gumbovi Silvio, Tuna i Daniel u sredini ekrana s velikim razmakom */}
            <div className="flex items-center justify-center gap-8 sm:gap-12 flex-wrap w-full py-1">
              {(['silvio', 'tuna', 'daniel'] as CalamariParticipantId[]).map((pid) => {
                const pDef = CALAMARI_PARTICIPANTS.find(p => p.id === pid)!;
                const isAlreadyLogged = allLoggedParticipants.includes(pid);
                const isSelected = selectedUserForPin === pid;

                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => {
                      setSelectedUserForPin(pid);
                      setPinInput('');
                      setPinError(null);
                    }}
                    className={`min-w-[92px] sm:min-w-[110px] px-4 py-2 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 shadow-md border ${
                      isSelected
                        ? 'bg-cyan-500 text-slate-950 border-white shadow-cyan-500/30'
                        : isAlreadyLogged
                        ? 'bg-teal-950/90 text-teal-200 border-teal-400/60 hover:bg-teal-900'
                        : 'bg-cyan-950/90 hover:bg-cyan-900 text-cyan-100 border-cyan-500/50'
                    }`}
                  >
                    {isAlreadyLogged && <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />}
                    <span>{pDef.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Polje za unos tajne šifre odabranog natjecatelja */}
            {selectedUserForPin && (
              <div className="w-full max-w-md mt-1 bg-slate-900/95 border border-cyan-500/40 rounded-2xl p-3 flex flex-col items-center gap-2 shadow-xl animate-slide-up">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-200">
                  <KeyRound className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    Unesite osobnu šifru za: <strong className="text-white uppercase">{selectedUserForPin}</strong>
                  </span>
                </div>

                <div className="flex items-center justify-center gap-2 w-full">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLoginWithPin(selectedUserForPin);
                    }}
                    placeholder="Tajna šifra..."
                    className="bg-slate-950 border border-cyan-500/50 rounded-xl px-3.5 py-2 text-white text-center text-sm font-mono focus:outline-none focus:border-cyan-300 w-36 sm:w-44"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleLoginWithPin(selectedUserForPin)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 text-xs sm:text-sm font-black cursor-pointer shadow-md shrink-0 active:scale-95"
                  >
                    Potvrdi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserForPin(null);
                      setPinError(null);
                    }}
                    className="px-2.5 py-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {pinError && (
                  <span className="text-rose-400 text-[11px] font-bold text-center">
                    {pinError}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast obavijest */}
      {successToast && (
        <div className="bg-teal-500/20 border-b border-teal-400/40 px-4 py-2 text-teal-200 text-xs font-bold text-center shrink-0 animate-fade-in">
          {successToast}
        </div>
      )}

      {/* GLAVNI SADRŽAJ - Morski dizajn, bez horizontalnog skrolanja */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-2.5 sm:px-6 lg:px-8 py-3 sm:py-5">
        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">

          {/* 1. TRENUTNI POREDAK (Morski trofejni prikaz bez opisa uloga) */}
          <section className="bg-gradient-to-br from-slate-900/95 via-[#07223d]/90 to-slate-950 border border-cyan-500/40 rounded-2xl p-3 sm:p-4 shadow-lg">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-xs sm:text-sm font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Trenutni poredak</span>
              </h2>
              <span className="text-[11px] font-mono text-cyan-200/80">
                Novi Vinodolski 2026
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {sortedParticipants.map((p, idx) => {
                const total = calculateTotalForParticipant(p.id);
                const isLeader = idx === 0 && total > 0;
                return (
                  <div
                    key={p.id}
                    className={`rounded-xl p-2.5 sm:p-3 border flex flex-col items-center justify-center text-center transition-all ${
                      isLeader
                        ? 'bg-gradient-to-b from-amber-500/20 via-cyan-950/80 to-slate-900 border-amber-400/70 shadow-md shadow-amber-500/10'
                        : 'bg-slate-950/75 border-cyan-500/25'
                    }`}
                  >
                    <div className="flex items-center gap-1 text-xs sm:text-sm font-bold text-cyan-200">
                      <span className="font-mono text-cyan-400">#{idx + 1}</span>
                      <strong className="text-white tracking-tight">{p.name}</strong>
                      {isLeader && <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    </div>
                    <div className="mt-1">
                      <span className="text-xl sm:text-2xl font-black text-teal-300 font-mono tabular-nums leading-none">
                        {total}
                      </span>
                      <span className="text-[10px] text-cyan-300/70 block mt-0.5">
                        liganja
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2. VERTIKALNA TABLICA ULOVA PO DANIMA I SUDIONICIMA + ADMIN KONTROLE ZA UREĐIVANJE SVIH */}
          <section className="bg-gradient-to-b from-slate-900/95 via-[#061c33]/95 to-slate-950 border border-cyan-500/40 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-cyan-950/50 border-b border-cyan-500/30 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Waves className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                  Evidencija ulova po danima (18.11. – 22.11.)
                </span>
              </div>

              {/* Admin kontrole ako je Daniel prijavljen, ili brzi gumb za Admin prijavu */}
              {isAdminUser ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setAdminEditAllEnabled(prev => !prev)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition-all cursor-pointer flex items-center gap-1 ${
                      adminEditAllEnabled
                        ? 'bg-teal-500/20 text-teal-200 border-teal-400/60 shadow-xs'
                        : 'bg-slate-900 text-slate-300 border-slate-700'
                    }`}
                    title="Kao administrator možete uređivati tablicu svim sudionicima (Dida, Tuna, Silvio, Daniel)"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span>{adminEditAllEnabled ? 'Admin: Uređivanje SVIH uključeno' : 'Admin: Samo Daniel i Dida'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAdminTools(prev => !prev)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                      showAdminTools
                        ? 'bg-cyan-600 text-white border-cyan-300'
                        : 'bg-slate-900/90 hover:bg-slate-800 text-cyan-300 border-cyan-500/40'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                    <span>Admin alati</span>
                  </button>
                </div>
              ) : (
                <span className="text-[10.5px] sm:text-xs text-cyan-300 font-medium">
                  Promjene su odmah vidljive svima
                </span>
              )}
            </div>

            {/* Prošireni Admin alati za brzo uređivanje ili nuliranje po potrebi */}
            {isAdminUser && showAdminTools && (
              <div className="p-3 sm:p-4 bg-slate-950/95 border-b border-cyan-500/30 space-y-3 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black text-teal-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-teal-400" />
                    Administratorska upravljačka ploča tablice (Daniel)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    U tablici ispod možete izravno mijenjati broj liganja (- / + / upis) za Dida, Tuna, Silvio i Daniel
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-bold text-slate-300 mr-1">Brzo nuliranje sudionika:</span>
                  {CALAMARI_PARTICIPANTS.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setConfirmResetTarget({ mode: 'participant', key: p.id, label: `Svi unosi za: ${p.name}` })}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/80 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-500/40 text-[11px] font-bold cursor-pointer flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{p.name} (0)</span>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setConfirmResetTarget({ mode: 'all', key: 'all', label: 'Cijela Calamari tablica (svi dani i sudionici)' })}
                    className="ml-auto px-2.5 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-500/40 text-[11px] font-black cursor-pointer flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Resetiraj cijelu tablicu</span>
                  </button>
                </div>

                {confirmResetTarget && (
                  <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-500/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-rose-200 font-bold">
                      Želite li sigurno postaviti na 0: <strong className="text-white">{confirmResetTarget.label}</strong>?
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExecuteAdminReset}
                        className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black cursor-pointer"
                      >
                        Da, potvrdi
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmResetTarget(null)}
                        className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white font-bold cursor-pointer"
                      >
                        Odustani
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Vertikalna matrica: Redovi su dani (18.11. - 22.11.), stupci su Dida, Tuna, Silvio, Daniel + Σ */}
            <div className="w-full overflow-x-hidden">
              <table className="w-full table-fixed border-collapse text-center">
                <thead>
                  <tr className="bg-slate-950/90 border-b border-cyan-500/30 text-[11px] sm:text-xs">
                    <th className="w-[62px] sm:w-[110px] py-2.5 px-1.5 text-left font-black text-cyan-300">
                      Dan
                    </th>
                    {CALAMARI_PARTICIPANTS.map((p) => {
                      const editable = canEditParticipant(p.id);
                      return (
                        <th key={p.id} className="py-2.5 px-0.5 sm:px-2 font-black text-white truncate">
                          <div className="flex flex-col items-center justify-center leading-tight">
                            <span className="text-xs sm:text-sm">{p.name}</span>
                            {editable && (
                              <span className="text-[9px] font-bold text-teal-400">
                                ● Unos
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                    <th className="w-[42px] sm:w-[72px] py-2.5 px-1 font-black text-amber-300 bg-slate-950">
                      Σ
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-cyan-500/20 text-xs">
                  {CALAMARI_DATES.map((d) => {
                    const shortInfo = SHORT_DAY_LABELS[d.dateStr] || { dayName: '', dateShort: d.label, isoDate: '' };
                    const dayTotal = calculateTotalForDate(d.dateStr);

                    return (
                      <tr key={d.dateStr} className="hover:bg-cyan-950/25 transition-colors">
                        {/* Stupac: Dan i datum */}
                        <td className="py-2.5 px-1.5 text-left align-middle bg-slate-950/40">
                          <div className="flex flex-col leading-tight">
                            <span className="font-bold text-white text-[11px] sm:text-xs">
                              {shortInfo.dayName}
                            </span>
                            <span className="font-mono text-[10px] sm:text-xs text-cyan-300">
                              {shortInfo.dateShort}
                            </span>
                          </div>
                        </td>

                        {/* Stupci: 4 natjecatelja (Dida, Tuna, Silvio, Daniel) */}
                        {CALAMARI_PARTICIPANTS.map((p) => {
                          const count = (state.catches[p.id] && state.catches[p.id][d.dateStr]) || 0;
                          const canEdit = canEditParticipant(p.id);

                          return (
                            <td key={p.id} className="py-2 px-0.5 sm:px-1.5 align-middle font-mono">
                              {canEdit ? (
                                <div className="inline-flex items-center justify-center bg-slate-950/90 border border-cyan-500/40 rounded-lg sm:rounded-xl p-0.5 max-w-full">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateCatch(p.id, d.dateStr, count - 1)}
                                    className="w-4.5 h-6 sm:w-6 sm:h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer text-xs font-black active:scale-95 shrink-0"
                                    title={`Smanji (${p.name})`}
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    max={999}
                                    value={count}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value, 10);
                                      handleUpdateCatch(p.id, d.dateStr, isNaN(val) ? 0 : val);
                                    }}
                                    className="w-6 sm:w-9 text-center bg-transparent text-white font-black text-xs sm:text-sm focus:outline-none tabular-nums appearance-none m-0"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateCatch(p.id, d.dateStr, count + 1)}
                                    className="w-4.5 h-6 sm:w-6 sm:h-7 rounded bg-teal-600 hover:bg-teal-500 text-white flex items-center justify-center cursor-pointer text-xs font-black active:scale-95 shrink-0"
                                    title={`Povećaj (${p.name})`}
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <span className="inline-flex items-center justify-center min-w-[28px] sm:min-w-[36px] px-1.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-cyan-200 font-black text-xs sm:text-sm tabular-nums">
                                  {count}
                                </span>
                              )}
                            </td>
                          );
                        })}

                        {/* Stupac: Ukupno za taj dan */}
                        <td className="py-2.5 px-1 align-middle font-mono font-black text-xs sm:text-sm text-amber-300 bg-slate-950/60 tabular-nums">
                          {dayTotal}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr className="bg-slate-950 border-t-2 border-cyan-500/40 font-black text-xs sm:text-sm">
                    <td className="py-2.5 px-1.5 text-left text-cyan-300 uppercase text-[10px] sm:text-xs">
                      Ukupno
                    </td>
                    {CALAMARI_PARTICIPANTS.map((p) => (
                      <td
                        key={p.id}
                        className="py-2.5 px-1 text-center font-mono text-sm sm:text-base text-teal-300 tabular-nums"
                      >
                        {calculateTotalForParticipant(p.id)}
                      </td>
                    ))}
                    <td className="py-2.5 px-1 text-center font-mono text-sm sm:text-base text-amber-400 bg-cyan-950/50 tabular-nums">
                      {grandTotal}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* 3. MJESEČEVA MIJENA, SOLUNARNI INDEKS GRIZA, SOLUNARNA TEORIJA (JOHN ALDEN KNIGHT) & POLOŽAJ MJESECA U VINODOLSKOM KANALU + GOOGLE AI ANALIZA */}
          <section className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#04182e] via-slate-900 to-slate-950 border border-cyan-500/50 text-xs text-slate-200 space-y-4 shadow-xl">
            
            {/* Zaglavlje sekcije */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyan-500/30 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <h3 className="font-black text-white text-xs sm:text-base uppercase tracking-wider">
                    Solunarna teorija (John Alden Knight) & Vinodolski kanal
                  </h3>
                </div>
                <p className="text-[11px] text-cyan-300/90 mt-0.5">
                  Astronomski položaj Mjeseca (45.13°N, 14.79°E) + Google AI analiza optimalnih sati griza liganja
                </p>
              </div>

              {/* Interaktivni odabir dana za izračun (Danas/+24h, +48h, +72h ili dani Calamari kupa) */}
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { id: 'now_24h', label: '+24h' },
                  { id: 'now_48h', label: '+48h' },
                  { id: 'now_72h', label: '+72h' },
                  { id: '18.11.2026', label: '18.11.' },
                  { id: '19.11.2026', label: '19.11.' },
                  { id: '20.11.2026', label: '20.11.' },
                  { id: '21.11.2026', label: '21.11.' },
                  { id: '22.11.2026', label: '22.11.' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedSolunarTarget(tab.id as SolunarTargetOption)}
                    className={`px-2 py-1 rounded-lg font-mono text-[10.5px] font-bold transition-all cursor-pointer ${
                      selectedSolunarTarget === tab.id
                        ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                        : 'bg-slate-950/90 text-cyan-300 hover:text-white border border-cyan-500/30'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Gornji blok: Mjesečeva mijena + Solunarni indeks griza */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Kartica 1: Mjesečeva mijena i astronomski parametri */}
              <div className="bg-slate-950/85 border border-cyan-500/35 rounded-xl p-3.5 flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-950 via-cyan-950 to-slate-900 border border-cyan-400/50 flex items-center justify-center text-3xl shrink-0 shadow-inner">
                  {activeSolunarAnalysis.moonIcon}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10.5px] font-bold text-cyan-400 uppercase tracking-wider">
                      Mjesečeva mijena ({activeSolunarAnalysis.dateLabel})
                    </span>
                  </div>
                  <div className="text-sm sm:text-base font-black text-white truncate">
                    {activeSolunarAnalysis.moonPhaseName}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-mono text-teal-300">
                    <span>Osvijetljenost: <strong className="text-white">{activeSolunarAnalysis.illuminationPct}%</strong></span>
                    <span>•</span>
                    <span>Starost: <strong className="text-white">{activeSolunarAnalysis.moonAgeDays} d</strong></span>
                  </div>
                </div>
              </div>

              {/* Kartica 2: Solunarni indeks griza liganja */}
              <div className="bg-slate-950/85 border border-amber-500/40 rounded-xl p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10.5px] font-bold text-amber-300 uppercase tracking-wider">
                    Solunarni indeks griza (Vinodolski kanal)
                  </span>
                  <div className="flex items-center gap-0.5 text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < activeSolunarAnalysis.starRating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="my-1.5 flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tabular-nums leading-none">
                      {activeSolunarAnalysis.solunarIndex}
                    </span>
                    <span className="text-xs font-mono text-slate-400">/ 100</span>
                  </div>
                  <span className="text-xs font-bold text-teal-300 text-right">
                    {activeSolunarAnalysis.ratingLabel}
                  </span>
                </div>

                {/* Progres traka indeksa griza */}
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-400 via-cyan-400 to-amber-400 rounded-full transition-all duration-300"
                    style={{ width: `${activeSolunarAnalysis.solunarIndex}%` }}
                  />
                </div>
              </div>

            </div>

            {/* Srednji blok: 4 Astronomska položaja Mjeseca u Vinodolskom kanalu prema Johnu Aldenu Knightu */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-cyan-300 font-bold">
                <span className="flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5 text-cyan-400" />
                  Astronomski položaj Mjeseca u Vinodolskom kanalu (Major & Minor tablica – John Alden Knight)
                </span>
                <span className="font-mono text-slate-400 hidden sm:inline">
                  Izlazak Sunca: {activeSolunarAnalysis.sunriseTime} h • Zalazak: {activeSolunarAnalysis.sunsetTime} h
                </span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                {/* MAJOR 1: Gornja kulminacija (Zenit) */}
                <div className="bg-gradient-to-b from-cyan-950/70 to-slate-950 p-3 rounded-xl border border-cyan-500/40 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-300 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      MAJOR 1 • Gornja kulminacija
                    </span>
                    <div className="text-sm sm:text-base font-black text-white font-mono my-1 tabular-nums">
                      {activeSolunarAnalysis.majorZenith.start} – {activeSolunarAnalysis.majorZenith.end}
                    </div>
                    <p className="text-[10.5px] text-slate-300 leading-snug">
                      Mjesec u zenitu iznad Vinodolskog kanala (Vrhunac: <strong className="text-cyan-300">{activeSolunarAnalysis.majorZenith.peak} h</strong>)
                    </p>
                  </div>
                </div>

                {/* MAJOR 2: Donja kulminacija (Nadir) */}
                <div className="bg-gradient-to-b from-cyan-950/70 to-slate-950 p-3 rounded-xl border border-cyan-500/40 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-300 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      MAJOR 2 • Donja kulminacija
                    </span>
                    <div className="text-sm sm:text-base font-black text-white font-mono my-1 tabular-nums">
                      {activeSolunarAnalysis.majorNadir.start} – {activeSolunarAnalysis.majorNadir.end}
                    </div>
                    <p className="text-[10.5px] text-slate-300 leading-snug">
                      Mjesec u nadiru ispod obzora (Vrhunac: <strong className="text-cyan-300">{activeSolunarAnalysis.majorNadir.peak} h</strong>)
                    </p>
                  </div>
                </div>

                {/* MINOR 1: Izlazak Mjeseca */}
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-teal-300 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      MINOR 1 • Izlazak Mjeseca
                    </span>
                    <div className="text-sm sm:text-base font-black text-white font-mono my-1 tabular-nums">
                      {activeSolunarAnalysis.minorMoonrise.start} – {activeSolunarAnalysis.minorMoonrise.end}
                    </div>
                    <p className="text-[10.5px] text-slate-400 leading-snug">
                      Izdiže se iznad Velebitskog grebena ({activeSolunarAnalysis.minorMoonrise.peak} h)
                    </p>
                  </div>
                </div>

                {/* MINOR 2: Zalazak Mjeseca */}
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-teal-300 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      MINOR 2 • Zalazak Mjeseca
                    </span>
                    <div className="text-sm sm:text-base font-black text-white font-mono my-1 tabular-nums">
                      {activeSolunarAnalysis.minorMoonset.start} – {activeSolunarAnalysis.minorMoonset.end}
                    </div>
                    <p className="text-[10.5px] text-slate-400 leading-snug">
                      Zalazak prema otoku Krku ({activeSolunarAnalysis.minorMoonset.peak} h)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Donji blok: Google AI & John Alden Knight sinteza za optimalne sate griza */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-950/90 p-3.5 rounded-xl border border-cyan-500/30 space-y-1.5">
                <span className="text-[11px] font-black text-cyan-300 uppercase tracking-wider block">
                  📐 Solunarna teorija (John Alden Knight) u Vinodolskom kanalu
                </span>
                <p className="text-[11.5px] text-slate-300 leading-relaxed">
                  {activeSolunarAnalysis.knightCanalSynthesis}
                </p>
              </div>

              <div className="bg-slate-950/90 p-3.5 rounded-xl border border-teal-500/30 space-y-1.5">
                <span className="text-[11px] font-black text-teal-300 uppercase tracking-wider block">
                  🤖 Google AI analiza za optimalne sate griza liganja
                </span>
                <p className="text-[11.5px] text-slate-300 leading-relaxed">
                  {activeSolunarAnalysis.aiTacticalAnalysis}
                </p>
                <div className="pt-1.5 flex flex-wrap items-center gap-2 font-mono text-[10.5px]">
                  <span className="text-amber-300">
                    ★ Sumrak: <strong className="text-white">{activeSolunarAnalysis.optimalEveningWindow}</strong>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-cyan-300">
                    ★ Noćni tranzit: <strong className="text-white">{activeSolunarAnalysis.optimalNightWindow}</strong>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-indigo-300">
                    ★ Zora: <strong className="text-white">{activeSolunarAnalysis.optimalDawnWindow}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Brzi pregled za iduća 24h / 48h / 72h */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
              {[
                { title: '+24 SATA (Danas / Noćas)', data: solunar24h, accent: 'text-cyan-300' },
                { title: '+48 SATI (Sutra / Noć)', data: solunar48h, accent: 'text-teal-300' },
                { title: '+72 SATA (Prekosutra)', data: solunar72h, accent: 'text-indigo-300' }
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex flex-col justify-between space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-black text-xs ${item.accent}`}>{item.title}</span>
                    <span className="text-amber-400 font-black font-mono text-xs">
                      {item.data.moonIcon} {item.data.solunarIndex}%
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 space-y-0.5">
                    <div>
                      <strong className="text-teal-300">Sumrak:</strong> {item.data.optimalEveningWindow}
                    </div>
                    <div>
                      <strong className="text-cyan-300">Major zenit:</strong> {item.data.majorZenith.start} – {item.data.majorZenith.end} h
                    </div>
                    <div>
                      <strong className="text-indigo-300">Zora:</strong> {item.data.optimalDawnWindow}
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </section>

          {/* 4. REAL-TIME PROGNOZA I PREPORUKA BOJA SKOSAVICA ZA NOVI VINODOLSKI */}
          <section className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-[#05263b]/80 to-slate-950 border border-teal-500/35 text-xs text-slate-300 space-y-3 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-500/20 pb-2.5">
              <span className="font-black text-white text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Taktička preporuka skosavica (Egi) i mikrolokacije • Novi Vinodolski</span>
              </span>
              <span className="font-mono text-[11px] text-teal-300">
                Uživo: Zrak {noviMeteo.temp}°C • More {noviMeteo.seaTemp}°C • {noviMeteo.windNameHr} ({noviMeteo.windSpeed} m/s) • {noviMeteo.pressure} hPa
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                <span className="font-black text-amber-300 block text-xs uppercase">
                  🎨 Preporučene boje skosavica prema trenutnim uvjetima
                </span>
                <p className="text-slate-300 text-xs leading-relaxed">
                  {noviMeteo.condition === 'vedro' || noviMeteo.temp > 15 ? (
                    <span>
                      Uz bistrije more i vedrije vrijeme najbolji odabir su <strong>plava leđa (Blue Sardine)</strong>, <strong>prirodni dekor skuše/srdele</strong> te <strong>Keimura (UV ljubičasta/plava)</strong> veličine <strong>3.0</strong> (brzina tonjenja 3.2 s/m).
                    </span>
                  ) : noviMeteo.windSpeed > 5 ? (
                    <span>
                      Zbog pojačanog vjetra i valova birajte <strong>narančasto-zlatnu (Orange Gold)</strong>, <strong>žuto-zelenu fluo</strong> i teže skosavice <strong>3.0 – 3.5</strong> za stabilan kontakt s dnom.
                    </span>
                  ) : (
                    <span>
                      Za sumrak i noćni lov u Novom Vinodolskom vrhunske rezultate daju <strong>Roza (Pink Glow)</strong>, <strong>Bijela s crvenom glavom (Red Head)</strong> te <strong>zelena fosforna (Full Glow)</strong> u veličini <strong>2.5 i 3.0</strong>.
                    </span>
                  )}
                </p>
              </div>

              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                <span className="font-black text-cyan-300 block text-xs uppercase">
                  📍 Top pozicije i dubine (Vinodolski kanal)
                </span>
                <p className="text-slate-300 text-xs leading-relaxed">
                  U sumrak pretražujte vanjski dio <strong>glavnog lukobrana u Novom Vinodolskom</strong>, strme pragove oko <strong>otočića San Marino</strong> i uvalu <strong>Povile</strong> na dubinama od <strong>7 do 16 metara</strong> gdje plimni kurenat nosi sitnu plavu ribu.
                </p>
              </div>
            </div>
          </section>

        </div>
      </div>

      {/* Donja traka za brzi povratak */}
      <div className="p-2.5 sm:p-3 bg-slate-950/95 border-t border-cyan-500/30 text-center shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-200 hover:text-white font-bold text-xs transition-all border border-cyan-500/40 cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 mx-auto"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Povratak na RiboPrognozu</span>
        </button>
      </div>
    </div>
  );
};
