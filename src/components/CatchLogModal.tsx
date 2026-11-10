import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Plus, 
  Trophy, 
  Lock, 
  Unlock, 
  Check, 
  History, 
  UserCheck,
  RotateCcw,
  ChevronLeft,
  Award,
  Activity,
  Waves,
  Thermometer,
  Gauge
} from 'lucide-react';
import {
  ANGLERS,
  FISH_SPECIES,
  AnglerId,
  FishSpeciesId,
  CatchStatsData,
  getLocalCatchStats,
  subscribeToCatchStats,
  resolveCurrentUserAnglerId,
  canUserEditAngler,
  claimAnglerProfile,
  addCatchForAngler,
  addBatchCatchesForAngler,
  updatePersonalBestForAngler,
  adminSetAnglerDevice,
  getCurrentRiverConditionsSnapshot
} from '../services/catchService';
import { 
  getDeviceId, 
  getUserName, 
  checkAdminPin, 
  isAdminUnlocked, 
  setAdminUnlocked 
} from '../services/licenseService';

interface CatchLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CatchLogModal: React.FC<CatchLogModalProps> = ({ isOpen, onClose }) => {
  const [stats, setStats] = useState<CatchStatsData>(() => getLocalCatchStats());
  const [adminMode, setAdminMode] = useState<boolean>(() => isAdminUnlocked());
  const [showAdminPinPrompt, setShowAdminPinPrompt] = useState<boolean>(false);
  const [pinValue, setPinValue] = useState<string>('');
  const [pinError, setPinError] = useState<boolean>(false);

  // Odabrana ćelija za brzi unos količine ulova i osobnog rekorda (PB)
  const [activeCell, setActiveCell] = useState<{ anglerId: AnglerId; speciesId: FishSpeciesId } | null>(null);
  const [customInputAmount, setCustomInputAmount] = useState<string>('1');
  const [pbCmInput, setPbCmInput] = useState<string>('');
  const [pbKgInput, setPbKgInput] = useState<string>('');
  const [showPbEditor, setShowPbEditor] = useState<boolean>(false);

  // Način "Višestruki upis nakon izlaska u ribolov" (upis u više polja vlastitog stupca odjednom)
  const [isBatchEntryMode, setIsBatchEntryMode] = useState<boolean>(false);
  const [batchInputs, setBatchInputs] = useState<Partial<Record<FishSpeciesId, string>>>({});
  const [batchTargetAngler, setBatchTargetAngler] = useState<AnglerId | null>(null);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const deviceId = useMemo(() => getDeviceId(), []);
  const currentUserName = getUserName();
  const liveSnapshot = useMemo(() => getCurrentRiverConditionsSnapshot(), [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setAdminMode(isAdminUnlocked());
    const unsub = subscribeToCatchStats(updated => {
      setStats(updated);
    });
    return () => unsub();
  }, [isOpen]);

  const myAnglerId = useMemo(
    () => resolveCurrentUserAnglerId(stats, deviceId, currentUserName),
    [stats, deviceId, currentUserName]
  );

  useEffect(() => {
    if (myAnglerId && !batchTargetAngler) {
      setBatchTargetAngler(myAnglerId);
    }
  }, [myAnglerId, batchTargetAngler]);

  // Izračun zbroja po svakom ribolovcu
  const totalsByAngler = useMemo(() => {
    const res: Record<AnglerId, number> = {
      sikac: 0,
      krasni: 0,
      domo: 0,
      malisa: 0
    };
    for (const angler of ANGLERS) {
      let sum = 0;
      for (const fish of FISH_SPECIES) {
        sum += Number(stats.counts?.[angler.id]?.[fish.id] || 0);
      }
      res[angler.id] = sum;
    }
    return res;
  }, [stats]);

  // Izračun zbroja po svakoj vrsti ribe
  const totalsBySpecies = useMemo(() => {
    const res: Record<FishSpeciesId, number> = {
      bucov: 0,
      smud: 0,
      som: 0,
      stuka: 0,
      mrena: 0
    };
    for (const fish of FISH_SPECIES) {
      let sum = 0;
      for (const angler of ANGLERS) {
        sum += Number(stats.counts?.[angler.id]?.[fish.id] || 0);
      }
      res[fish.id] = sum;
    }
    return res;
  }, [stats]);

  const grandTotalAllFish = useMemo(() => {
    return (
      totalsByAngler.sikac +
      totalsByAngler.krasni +
      totalsByAngler.domo +
      totalsByAngler.malisa
    );
  }, [totalsByAngler]);

  // Izračun rekordera sezone (Team Record) po vrsti ribe (na temelju cm ili kg)
  const speciesBestRecord = useMemo(() => {
    const map: Partial<Record<FishSpeciesId, { anglerId: AnglerId; anglerName: string; cm?: number; kg?: number }>> = {};
    for (const fish of FISH_SPECIES) {
      let bestScore = 0;
      let bestHolder: { anglerId: AnglerId; anglerName: string; cm?: number; kg?: number } | undefined;
      for (const angler of ANGLERS) {
        const pb = stats.personalBests?.[angler.id]?.[fish.id];
        if (pb && (pb.cm || pb.kg)) {
          // Vrednujemo prvenstveno kg (ako je unesen) ili cm
          const score = (pb.kg ? pb.kg * 100 : 0) + (pb.cm || 0);
          if (score > bestScore) {
            bestScore = score;
            bestHolder = {
              anglerId: angler.id,
              anglerName: angler.name,
              cm: pb.cm,
              kg: pb.kg
            };
          }
        }
      }
      if (bestHolder) {
        map[fish.id] = bestHolder;
      }
    }
    return map;
  }, [stats.personalBests]);

  // Pametna analiza uvjeta iz zabilježenih ulova ("Kada riba najbolje radi")
  const conditionsInsight = useMemo(() => {
    const positiveEntries = (stats.history || []).filter(h => h.delta > 0 && h.conditions);
    if (positiveEntries.length === 0) {
      return {
        hasRecordedConditions: false,
        avgAljmasCm: liveSnapshot.aljmasLevelCm ?? -70,
        avgWaterTemp: liveSnapshot.waterTempC ?? 9.8,
        avgPressure: liveSnapshot.airPressureHpa ?? 1021,
        dominantTrend: liveSnapshot.aljmasTrend ?? 'stagnira',
        topSpeciesName: 'Smuđ / Bucov',
        sampleCount: 0
      };
    }

    let totalWeight = 0;
    let sumAljmas = 0;
    let sumTemp = 0;
    let sumPressure = 0;
    const trendCounts: Record<string, number> = {};
    const speciesCounts: Record<string, number> = {};

    positiveEntries.forEach(entry => {
      const w = Math.max(1, entry.delta);
      const c = entry.conditions!;
      totalWeight += w;
      sumAljmas += (c.aljmasLevelCm ?? -70) * w;
      sumTemp += (c.waterTempC ?? 10) * w;
      sumPressure += (c.airPressureHpa ?? 1018) * w;
      const tr = c.aljmasTrend || 'stagnira';
      trendCounts[tr] = (trendCounts[tr] || 0) + w;
      speciesCounts[entry.speciesName] = (speciesCounts[entry.speciesName] || 0) + w;
    });

    const dominantTrend = Object.entries(trendCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'stagnira';
    const topSpeciesName = Object.entries(speciesCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Smuđ';

    return {
      hasRecordedConditions: true,
      avgAljmasCm: Math.round(sumAljmas / totalWeight),
      avgWaterTemp: Number((sumTemp / totalWeight).toFixed(1)),
      avgPressure: Math.round(sumPressure / totalWeight),
      dominantTrend,
      topSpeciesName,
      sampleCount: totalWeight
    };
  }, [stats.history, liveSnapshot]);

  const showToast = (msg: string, isErr = false) => {
    if (isErr) {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 3500);
    } else {
      setStatusMessage(msg);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleClaimProfile = async (anglerId: AnglerId) => {
    setIsSubmitting(true);
    try {
      const res = await claimAnglerProfile(anglerId);
      if (res.success) {
        setStats(res.data);
        setBatchTargetAngler(anglerId);
        const name = ANGLERS.find(a => a.id === anglerId)?.name || anglerId;
        showToast(`Tvoj uređaj je trajno povezan s profilom: ${name}`);
      } else if (res.error) {
        showToast(res.error, true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAdd = async (anglerId: AnglerId, speciesId: FishSpeciesId, delta: number) => {
    if (!canUserEditAngler(anglerId, stats, adminMode)) {
      showToast('Možeš dodavati ulove samo u svom stupcu!', true);
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await addCatchForAngler(anglerId, speciesId, delta, adminMode);
      if (res.success) {
        setStats(res.data);
        const speciesName = FISH_SPECIES.find(f => f.id === speciesId)?.name || speciesId;
        const anglerName = ANGLERS.find(a => a.id === anglerId)?.name || anglerId;
        const sign = delta > 0 ? `+${delta}` : `${delta}`;
        showToast(`${anglerName}: ${sign} ${speciesName} (Ukupno: ${res.data.counts[anglerId][speciesId]} · spremljeni uvjeti Dunava)`);
        setActiveCell(null);
        setCustomInputAmount('1');
      } else if (res.error) {
        showToast(res.error, true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSavePersonalBest = async () => {
    if (!activeCell) return;
    setIsSubmitting(true);
    try {
      const cmVal = pbCmInput.trim() ? Number(pbCmInput.trim().replace(',', '.')) : null;
      const kgVal = pbKgInput.trim() ? Number(pbKgInput.trim().replace(',', '.')) : null;
      const res = await updatePersonalBestForAngler(
        activeCell.anglerId,
        activeCell.speciesId,
        cmVal,
        kgVal,
        adminMode
      );
      if (res.success) {
        setStats(res.data);
        const speciesName = FISH_SPECIES.find(f => f.id === activeCell.speciesId)?.name || '';
        showToast(`Osobni rekord (PB) za vrstu ${speciesName} je spremljen!`);
        setShowPbEditor(false);
      } else if (res.error) {
        showToast(res.error, true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveBatch = async () => {
    const targetAngler = batchTargetAngler || myAnglerId;
    if (!targetAngler) {
      showToast('Najprije odaberi svoj profil na vrhu tablice.', true);
      return;
    }

    const deltas: Partial<Record<FishSpeciesId, number>> = {};
    let hasAny = false;
    for (const fish of FISH_SPECIES) {
      const raw = batchInputs[fish.id];
      if (raw && raw.trim() !== '') {
        const val = parseInt(raw.trim(), 10);
        if (Number.isFinite(val) && val !== 0) {
          deltas[fish.id] = val;
          hasAny = true;
        }
      }
    }

    if (!hasAny) {
      showToast('Upiši količinu ulova barem za jednu vrstu ribe.', true);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addBatchCatchesForAngler(targetAngler, deltas, adminMode);
      if (res.success) {
        setStats(res.data);
        setBatchInputs({});
        setIsBatchEntryMode(false);
        const anglerName = ANGLERS.find(a => a.id === targetAngler)?.name || targetAngler;
        const sign = res.addedTotal > 0 ? `+${res.addedTotal}` : `${res.addedTotal}`;
        showToast(`Spremljeno! ${anglerName} je pribrojio ${sign} ulova uz trenutne uvjete Dunava.`);
      } else if (res.error) {
        showToast(res.error, true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyAdminPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkAdminPin(pinValue)) {
      setAdminMode(true);
      setAdminUnlocked(true);
      setShowAdminPinPrompt(false);
      setPinValue('');
      setPinError(false);
      showToast('Administratorski mod otključan (moguće uređivanje svih stupaca).');
    } else {
      setPinError(true);
    }
  };

  if (!isOpen) return null;

  const activeEditableAngler: AnglerId | null = isBatchEntryMode
    ? (adminMode ? (batchTargetAngler || myAnglerId || 'sikac') : myAnglerId)
    : myAnglerId;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col w-full h-full overflow-hidden select-none">
      
      {/* 1. FIKSNI GORNJI ZAGLAVLJE MODALA */}
      <div className="bg-slate-900 border-b border-slate-800 px-2.5 sm:px-5 py-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-white border border-slate-700/80 flex items-center gap-1 transition-colors cursor-pointer shrink-0 active:scale-95 shadow-sm"
              title="Povratak u Osnovni mod"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
              <span className="text-[11px] font-bold hidden xs:inline">Natrag</span>
            </button>

            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Trophy className="w-4 h-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-black text-white leading-tight truncate">
                Evidencija Ulova i Osobni Rekordi (PB)
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-400 truncate">
                {myAnglerId ? (
                  <span className="text-emerald-400 font-bold">
                    Tvoj stupac: {ANGLERS.find(a => a.id === myAnglerId)?.name}
                  </span>
                ) : adminMode ? (
                  <span className="text-amber-400 font-bold">Admin način (svi stupci otključani)</span>
                ) : (
                  <span className="text-amber-300">Odaberi svoje ime ispod za unos ulova</span>
                )}
                <span>·</span>
                <span className="font-mono tabular-nums text-slate-300">Ukupno: {grandTotalAllFish}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
              className={`h-8 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-colors cursor-pointer ${
                showHistoryDrawer
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                  : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:text-white'
              }`}
              title="Zadnji upisani ulovi i uvjeti na vodi"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Dnevnik</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (adminMode) {
                  setAdminMode(false);
                } else {
                  setShowAdminPinPrompt(!showAdminPinPrompt);
                }
              }}
              className={`h-8 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-colors cursor-pointer ${
                adminMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-slate-800/90 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title="Administratorski pristup"
            >
              {adminMode ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-300 hover:text-rose-300 border border-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              title="Zatvori tablicu ulova"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showAdminPinPrompt && !adminMode && (
          <form onSubmit={handleVerifyAdminPin} className="max-w-4xl mx-auto mt-2 pt-2 border-t border-slate-800 flex items-center gap-2">
            <span className="text-[11px] text-slate-300 font-medium shrink-0">Admin PIN:</span>
            <input
              type="password"
              inputMode="numeric"
              value={pinValue}
              onChange={e => {
                setPinValue(e.target.value);
                setPinError(false);
              }}
              placeholder="Unesi PIN..."
              className="w-28 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
            >
              Otključaj
            </button>
            {pinError && <span className="text-[11px] text-rose-400 font-bold">Pogrešan PIN</span>}
          </form>
        )}

        {!myAnglerId && !adminMode && (
          <div className="max-w-4xl mx-auto mt-2 pt-2 border-t border-slate-800/80">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-amber-300 font-bold">
                Odaberi svoje ime za uređivanje vlastitog stupca (trajno se veže za tvoj mobitel):
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {ANGLERS.map(angler => {
                  const boundToOther = Boolean(
                    stats.anglerDevices?.[angler.id] && stats.anglerDevices[angler.id] !== deviceId
                  );
                  return (
                    <button
                      key={angler.id}
                      type="button"
                      disabled={boundToOther || isSubmitting}
                      onClick={() => handleClaimProfile(angler.id)}
                      className={`py-1.5 px-1 rounded-lg text-xs font-black border transition-all flex flex-col items-center justify-center ${
                        boundToOther
                          ? 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed'
                          : 'bg-teal-950/80 hover:bg-teal-900 border-teal-500/50 text-teal-200 cursor-pointer active:scale-95'
                      }`}
                    >
                      <span>{angler.name}</span>
                      <span className="text-[9px] font-normal opacity-80">
                        {boundToOther ? 'Zauzeto' : 'Odaberi'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {(myAnglerId || adminMode) && (
          <div className="max-w-4xl mx-auto mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
              {adminMode ? (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-amber-300 font-bold">Uređuješ:</span>
                  {ANGLERS.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setBatchTargetAngler(a.id)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                        (batchTargetAngler || myAnglerId || 'sikac') === a.id
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] text-slate-300">
                  Klikni na polje u stupcu <strong className="text-emerald-400">{ANGLERS.find(a => a.id === myAnglerId)?.name}</strong> za brzi unos (+1 ili PB rekord):
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setIsBatchEntryMode(!isBatchEntryMode);
                setActiveCell(null);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                isBatchEntryMode
                  ? 'bg-rose-950/90 text-rose-200 border border-rose-500/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow-sm'
              }`}
            >
              {isBatchEntryMode ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  <span>Odustani od unosa</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Upiši ulov s izlaska</span>
                </>
              )}
            </button>
          </div>
        )}

        {(statusMessage || errorMessage) && (
          <div
            className={`max-w-4xl mx-auto mt-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-center ${
              errorMessage
                ? 'bg-rose-950/90 text-rose-200 border border-rose-500/40'
                : 'bg-emerald-950/90 text-emerald-200 border border-emerald-500/40'
            }`}
          >
            {errorMessage || statusMessage}
          </div>
        )}
      </div>

      {/* 2. FIKSNI ZAGLAVLJE TABLICE S IMENIMA RIBOLOVACA */}
      <div className="bg-slate-900/95 border-b-2 border-slate-700 px-1.5 sm:px-5 shrink-0 z-20 shadow-md">
        <div className="max-w-4xl mx-auto grid grid-cols-[1.28fr_1fr_1fr_1fr_1fr] items-stretch">
          <div className="py-2 pr-1 flex flex-col justify-center">
            <span className="text-[11px] sm:text-xs font-black text-slate-300 uppercase tracking-tight">
              Vrsta ribe
            </span>
            <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium">
              Ukupno + Rekord
            </span>
          </div>

          {ANGLERS.map(angler => {
            const isEditable = canUserEditAngler(angler.id, stats, adminMode);
            const isMyColumn = myAnglerId === angler.id;
            const totalCaught = totalsByAngler[angler.id] || 0;

            return (
              <div
                key={angler.id}
                className={`py-1.5 px-0.5 flex flex-col items-center justify-center text-center border-l border-slate-800/90 relative ${
                  isMyColumn
                    ? 'bg-emerald-950/40'
                    : isEditable
                    ? 'bg-amber-950/20'
                    : ''
                }`}
              >
                <div className="flex items-center justify-center gap-0.5 max-w-full">
                  <span
                    className={`text-xs sm:text-sm font-black tracking-tight truncate ${
                      isMyColumn ? 'text-emerald-300' : 'text-white'
                    }`}
                  >
                    {angler.name}
                  </span>
                  {isEditable ? (
                    <UserCheck className="w-3 h-3 text-emerald-400 shrink-0 hidden sm:inline" />
                  ) : (
                    <Lock className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                  )}
                </div>

                <span
                  className={`mt-0.5 text-[10px] sm:text-xs font-mono font-bold tabular-nums leading-none ${
                    isMyColumn ? 'text-emerald-400' : 'text-cyan-300'
                  }`}
                >
                  Σ {totalCaught}
                </span>

                {isMyColumn && (
                  <span className="text-[8px] sm:text-[9px] font-black text-emerald-400 uppercase tracking-wider leading-none mt-0.5">
                    TVOJ DIO
                  </span>
                )}

                {adminMode && stats.anglerDevices?.[angler.id] && (
                  <button
                    type="button"
                    onClick={() => {
                      adminSetAnglerDevice(angler.id, null).then(setStats);
                      showToast(`Oslobođen uređaj za profil ${angler.name}`);
                    }}
                    className="mt-0.5 text-[8px] text-amber-300 underline cursor-pointer"
                    title={`Povezani ID: ${stats.anglerDevices[angler.id]} (klikni za odspajanje)`}
                  >
                    Reset ID
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. VERTIKALNO SCROLLABILNO TIJELO TABLICE + ANALIZA UVJETA NA DUNAVU */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-1.5 sm:px-5 pb-4">
        <div className="max-w-4xl mx-auto border-b-2 border-slate-700 shadow-sm divide-y divide-slate-800/80">
          {FISH_SPECIES.map((fish, rowIdx) => {
            const speciesSum = totalsBySpecies[fish.id] || 0;
            const isEven = rowIdx % 2 === 0;
            const teamBest = speciesBestRecord[fish.id];

            return (
              <div
                key={fish.id}
                className={`grid grid-cols-[1.28fr_1fr_1fr_1fr_1fr] items-stretch transition-colors ${
                  isEven ? 'bg-slate-950' : 'bg-slate-900/40'
                }`}
              >
                {/* Lijevi stupac: Naziv vrste ribe + Ukupan zbroj + Rekord ekipe */}
                <div className="py-2 sm:py-3 pr-1 flex flex-col justify-center min-w-0">
                  <span className="text-xs sm:text-base font-black text-white leading-tight truncate">
                    {fish.name}
                  </span>
                  <span className="text-[10px] sm:text-xs font-mono tabular-nums text-slate-400 mt-0.5">
                    Ukupno: <strong className="text-slate-200">{speciesSum}</strong>
                  </span>
                  {teamBest && (
                    <span className="mt-0.5 inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-bold text-amber-300 truncate" title={`Rekord ekipe drži ${teamBest.anglerName}`}>
                      <Award className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                      <span className="truncate">
                        {teamBest.anglerName}: {teamBest.kg ? `${teamBest.kg}kg` : ''}{teamBest.kg && teamBest.cm ? ' / ' : ''}{teamBest.cm ? `${teamBest.cm}cm` : ''}
                      </span>
                    </span>
                  )}
                </div>

                {/* 4 stupca za ribolovce */}
                {ANGLERS.map(angler => {
                  const count = stats.counts?.[angler.id]?.[fish.id] || 0;
                  const pb = stats.personalBests?.[angler.id]?.[fish.id];
                  const isTeamRecordHolder = teamBest?.anglerId === angler.id;
                  const canEdit = canUserEditAngler(angler.id, stats, adminMode);
                  const isMyColumn = myAnglerId === angler.id;
                  const isSelectedCell =
                    activeCell?.anglerId === angler.id && activeCell?.speciesId === fish.id;
                  const showBatchInputHere =
                    isBatchEntryMode && activeEditableAngler === angler.id && canEdit;

                  return (
                    <div
                      key={angler.id}
                      onClick={() => {
                        if (!canEdit || isBatchEntryMode) return;
                        if (isSelectedCell) {
                          setActiveCell(null);
                          setShowPbEditor(false);
                        } else {
                          setActiveCell({ anglerId: angler.id, speciesId: fish.id });
                          setCustomInputAmount('1');
                          setPbCmInput(pb?.cm ? String(pb.cm) : '');
                          setPbKgInput(pb?.kg ? String(pb.kg) : '');
                          setShowPbEditor(false);
                        }
                      }}
                      className={`py-2 sm:py-3 px-0.5 border-l border-slate-800/80 flex flex-col items-center justify-center relative transition-colors ${
                        isSelectedCell
                          ? 'bg-emerald-900/50 ring-1 ring-inset ring-emerald-400'
                          : isMyColumn
                          ? 'bg-emerald-950/20 hover:bg-emerald-950/35 cursor-pointer'
                          : canEdit
                          ? 'bg-amber-950/10 hover:bg-amber-950/25 cursor-pointer'
                          : ''
                      }`}
                    >
                      <span
                        className={`text-base sm:text-xl font-black font-mono tabular-nums leading-none ${
                          count > 0
                            ? isMyColumn
                              ? 'text-emerald-300'
                              : 'text-white'
                            : 'text-slate-600'
                        }`}
                      >
                        {count}
                      </span>

                      {/* Prikaz osobnog rekorda (PB u kg / cm) ako je upisan */}
                      {pb && (pb.cm || pb.kg) && (
                        <span
                          className={`mt-0.5 px-1 py-0.2 rounded text-[8.5px] sm:text-[10px] font-mono font-bold leading-tight truncate max-w-full ${
                            isTeamRecordHolder
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-slate-800/90 text-cyan-300'
                          }`}
                          title="Osobni rekord sezone (PB)"
                        >
                          {isTeamRecordHolder ? '🏆 ' : 'PB: '}
                          {pb.kg ? `${pb.kg}kg` : ''}
                          {pb.kg && pb.cm ? '·' : ''}
                          {pb.cm ? `${pb.cm}cm` : ''}
                        </span>
                      )}

                      {showBatchInputHere ? (
                        <div
                          className="mt-1.5 flex items-center justify-center w-full px-0.5"
                          onClick={e => e.stopPropagation()}
                        >
                          <div className="flex items-center w-full max-w-[64px] bg-slate-950 border border-emerald-500/70 rounded-lg overflow-hidden">
                            <span className="pl-1 text-[10px] font-black text-emerald-400">+</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              max="999"
                              placeholder="0"
                              value={batchInputs[fish.id] || ''}
                              onChange={e =>
                                setBatchInputs(prev => ({
                                  ...prev,
                                  [fish.id]: e.target.value
                                }))
                              }
                              className="w-full py-1 pr-1 bg-transparent text-center font-mono text-xs font-black text-white focus:outline-none tabular-nums"
                            />
                          </div>
                        </div>
                      ) : canEdit ? (
                        <div className="mt-1 flex items-center justify-center gap-1">
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[8.5px] sm:text-[10px] font-bold text-emerald-300">
                            <Plus className="w-2.5 h-2.5" />
                            <span>Dodaj / PB</span>
                          </span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* PAMETNA STATISTIKA UVJETA ULOVA ("KADA RIBA NAJBOLJE RADI NA DUNAVU") */}
        <div className="max-w-4xl mx-auto mt-3 p-3 sm:p-4 rounded-2xl bg-slate-900/90 border border-teal-500/30 shadow-md">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-300 shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wide">
                  Analiza ulova: Kada riba najbolje radi
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-400">
                  {conditionsInsight.hasRecordedConditions
                    ? `Izračunato iz ${conditionsInsight.sampleCount} zabilježenih ulova s automatski spremljenim stanjem Dunava`
                    : 'Pri svakom novom upisu (+1) aplikacija automatski bilježi vodostaj, temp. vode i tlak zraka'}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-lg bg-teal-950 text-teal-300 border border-teal-500/30 text-[10px] font-bold">
              Trenutno Aljmaš: {liveSnapshot.aljmasLevelCm} cm · {liveSnapshot.waterTempC} °C
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2">
              <Waves className="w-4 h-4 text-teal-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[9px] text-slate-400 uppercase font-bold block truncate">Optimalni vodostaj</span>
                <span className="text-xs sm:text-sm font-black text-white font-mono">
                  {conditionsInsight.avgAljmasCm} cm <span className="text-[10px] text-teal-300 font-normal">({conditionsInsight.dominantTrend})</span>
                </span>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[9px] text-slate-400 uppercase font-bold block truncate">Optimalna temp. vode</span>
                <span className="text-xs sm:text-sm font-black text-cyan-300 font-mono">
                  {conditionsInsight.avgWaterTemp} °C
                </span>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-indigo-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[9px] text-slate-400 uppercase font-bold block truncate">Optimalni tlak zraka</span>
                <span className="text-xs sm:text-sm font-black text-indigo-200 font-mono">
                  {conditionsInsight.avgPressure} hPa
                </span>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[9px] text-slate-400 uppercase font-bold block truncate">Najaktivnija vrsta</span>
                <span className="text-xs sm:text-sm font-black text-amber-300 truncate block">
                  {conditionsInsight.topSpeciesName}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. SKOČNA TRAKA ZA UNOS KOLIČINE I OSOBNOG REKORDA (PB) */}
      {activeCell && !isBatchEntryMode && (
        <div className="bg-slate-900 border-t-2 border-emerald-500/60 px-3 py-2.5 shrink-0 z-30 shadow-2xl">
          <div className="max-w-4xl mx-auto flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 flex-wrap">
                <span className="text-emerald-400 font-black">
                  {ANGLERS.find(a => a.id === activeCell.anglerId)?.name}
                </span>
                <span>·</span>
                <span>
                  Vrsta:{' '}
                  <strong className="text-amber-300">
                    {FISH_SPECIES.find(f => f.id === activeCell.speciesId)?.name}
                  </strong>
                </span>
                <span className="text-slate-400 text-xs font-mono tabular-nums">
                  (Komada: {stats.counts[activeCell.anglerId][activeCell.speciesId]})
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowPbEditor(!showPbEditor)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 border cursor-pointer transition-colors ${
                    showPbEditor
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Osobni rekord (PB)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveCell(null);
                    setShowPbEditor(false);
                  }}
                  className="text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {showPbEditor ? (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-amber-300">
                  🏆 Najveći ulov sezone ({FISH_SPECIES.find(f => f.id === activeCell.speciesId)?.name}):
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      placeholder="kg (npr. 4.5)"
                      value={pbKgInput}
                      onChange={e => setPbKgInput(e.target.value)}
                      className="w-24 h-8 px-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-400"
                    />
                    <span className="text-xs text-slate-400 font-bold">kg</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="cm (npr. 78)"
                      value={pbCmInput}
                      onChange={e => setPbCmInput(e.target.value)}
                      className="w-24 h-8 px-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-400"
                    />
                    <span className="text-xs text-slate-400 font-bold">cm</span>
                  </div>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleSavePersonalBest}
                    className="h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Spremi PB</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 5].map(num => (
                    <button
                      key={num}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleQuickAdd(activeCell.anglerId, activeCell.speciesId, num)}
                      className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black font-mono text-xs sm:text-sm cursor-pointer active:scale-95 transition-transform shadow-sm"
                    >
                      +{num}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 ml-auto">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="999"
                    value={customInputAmount}
                    onChange={e => setCustomInputAmount(e.target.value)}
                    className="w-14 h-9 px-2 rounded-xl bg-slate-950 border border-slate-700 text-center font-mono text-sm font-black text-white focus:outline-none focus:border-emerald-400 tabular-nums"
                  />
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      const parsed = parseInt(customInputAmount, 10);
                      if (Number.isFinite(parsed) && parsed > 0) {
                        handleQuickAdd(activeCell.anglerId, activeCell.speciesId, parsed);
                      }
                    }}
                    className="h-9 px-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs sm:text-sm cursor-pointer active:scale-95 transition-transform flex items-center gap-1"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Pribroji</span>
                  </button>

                  {stats.counts[activeCell.anglerId][activeCell.speciesId] > 0 && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleQuickAdd(activeCell.anglerId, activeCell.speciesId, -1)}
                      className="h-9 px-2.5 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 font-mono text-xs font-bold cursor-pointer"
                      title="Oduzmi 1 (ispravak pogrešnog unosa)"
                    >
                      -1
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Traka za spremanje kada je uključen višestruki unos nakon izlaska u ribolov */}
      {isBatchEntryMode && (
        <div className="bg-slate-900 border-t-2 border-emerald-500/60 px-3 py-2.5 shrink-0 z-30">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
            <span className="text-xs text-slate-300">
              Upiši količinu ulovljene ribe u polja <strong className="text-emerald-400">+0</strong> i klikni Spremi:
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setBatchInputs({})}
                className="h-9 px-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Poništi</span>
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSaveBatch}
                className="h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Spremi i zbroji</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ladica s dnevnikom zadnjih upisanih ulova i zabilježenim uvjetima na Dunavu */}
      {showHistoryDrawer && (
        <div className="bg-slate-900 border-t border-slate-700 max-h-56 overflow-y-auto px-3 py-2.5 shrink-0 z-30">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black text-cyan-300 uppercase tracking-wider">
                Zadnji upisani ulovi i uvjeti na vodi
              </span>
              <button
                type="button"
                onClick={() => setShowHistoryDrawer(false)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Zatvori
              </button>
            </div>
            {stats.history.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">Još nema upisanih ulova u dnevniku.</p>
            ) : (
              <div className="space-y-1.5">
                {stats.history.slice(0, 20).map(item => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between text-xs py-1.5 border-b border-slate-800/60 gap-1"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <strong className="text-white">{item.anglerName}</strong>
                      <span className="text-slate-400">· {item.speciesName}</span>
                      <span
                        className={`font-mono font-black ${
                          item.delta > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {item.delta > 0 ? `+${item.delta}` : item.delta}
                      </span>
                      <span className="text-slate-500 font-mono text-[11px]">
                        (ukupno: {item.newTotal})
                      </span>
                      {item.conditions && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-teal-300">
                          🌊 Aljmaš {item.conditions.aljmasLevelCm} cm · 🌡️ {item.conditions.waterTempC}°C · {item.conditions.airPressureHpa} hPa
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {item.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. FIKSNI DONJI RED S UKUPNIM ZBROJEM SVIH ULOVA PO OSOBI */}
      <div className="bg-slate-900 border-t-2 border-slate-700 px-1.5 sm:px-5 pb-[calc(0.4rem+env(safe-area-inset-bottom,0px))] pt-1.5 shrink-0 z-20">
        <div className="max-w-4xl mx-auto grid grid-cols-[1.28fr_1fr_1fr_1fr_1fr] items-center">
          <div className="py-1 pr-1 flex flex-col">
            <span className="text-[10px] sm:text-xs font-black text-amber-400 uppercase tracking-tight leading-tight">
              UKUPNO RIBA
            </span>
            <span className="text-[9px] sm:text-[10px] font-mono text-slate-400 tabular-nums">
              Sveukupno: {grandTotalAllFish}
            </span>
          </div>

          {ANGLERS.map(angler => {
            const isMyColumn = myAnglerId === angler.id;
            const total = totalsByAngler[angler.id] || 0;
            return (
              <div
                key={angler.id}
                className={`py-1 px-0.5 border-l border-slate-800 flex flex-col items-center justify-center ${
                  isMyColumn ? 'bg-emerald-950/40 rounded-b-lg' : ''
                }`}
              >
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 truncate max-w-full">
                  {angler.name}
                </span>
                <span
                  className={`text-sm sm:text-lg font-black font-mono tabular-nums leading-tight ${
                    isMyColumn ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {total}
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
