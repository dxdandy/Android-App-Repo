import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Plus, 
  Minus, 
  Trophy, 
  Lock, 
  Unlock, 
  Check, 
  History, 
  ShieldCheck, 
  UserCheck,
  RotateCcw,
  ChevronLeft
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
  adminSetAnglerDevice
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

  // Odabrana ćelija za brzi unos količine ulova (kada ribolovac klikne na vrstu ribe u svom stupcu)
  const [activeCell, setActiveCell] = useState<{ anglerId: AnglerId; speciesId: FishSpeciesId } | null>(null);
  const [customInputAmount, setCustomInputAmount] = useState<string>('1');

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

  // Ako se uključi batch mod, postavi ciljnog ribolovca na vlastiti profil
  useEffect(() => {
    if (myAnglerId && !batchTargetAngler) {
      setBatchTargetAngler(myAnglerId);
    }
  }, [myAnglerId, batchTargetAngler]);

  // Izračun zbroja po svakom ribolovcu (Ukupno upecano svih vrsta za Sikac, Krasni, Domo, Mališa)
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

  // Izračun zbroja po svakoj vrsti ribe (ukupno svih 4 ribolovca za pojedinu vrstu)
  const totalsBySpecies = useMemo(() => {
    const res: Record<FishSpeciesId, number> = {
      bucov: 0,
      smud: 0,
      stuka: 0,
      som: 0,
      bikonja: 0,
      saran: 0,
      mrena: 0,
      klen: 0,
      buljo: 0
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
        showToast(`${anglerName}: ${sign} ${speciesName} (Ukupno: ${res.data.counts[anglerId][speciesId]})`);
        setActiveCell(null);
        setCustomInputAmount('1');
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
        showToast(`Spremljeno! ${anglerName} je pribrojio ${sign} ulova u tablicu.`);
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
      
      {/* 1. FIKSNI GORNJI ZAGLAVLJE MODALA (Kompaktan za vertikalni ekran mobitela) */}
      <div className="bg-slate-900 border-b border-slate-800 px-2.5 sm:px-5 py-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Gumb za povratak unatrag na Osnovni mod */}
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
                Evidencija Ulova po Vrstama
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
            {/* Gumb za povijest zadnjih unosa */}
            <button
              type="button"
              onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
              className={`h-8 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-colors cursor-pointer ${
                showHistoryDrawer
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                  : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:text-white'
              }`}
              title="Zadnji upisani ulovi"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Dnevnik</span>
            </button>

            {/* Admin otključavanje (PIN 2026) */}
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

            {/* Zatvori */}
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

        {/* Admin PIN polje ako je kliknuto */}
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

        {/* Jednokratni odabir profila ako uređaj još nije povezan ni s jednim od 4 ribolovca */}
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

        {/* Traka s gumbom za brzi višestruki unos nakon ribolova */}
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
                  Klikni na broj u stupcu <strong className="text-emerald-400">{ANGLERS.find(a => a.id === myAnglerId)?.name}</strong> ili upiši cijeli ulov s izlaska:
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

        {/* Status / Toast poruka */}
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

      {/* 2. FIKSNI ZAGLAVLJE TABLICE S IMENIMA RIBOLOVACA (UVIJEK VIDLJIVO PRI SCROLLANJU GORE/DOLJE!) */}
      <div className="bg-slate-900/95 border-b-2 border-slate-700 px-1.5 sm:px-5 shrink-0 z-20 shadow-md">
        <div className="max-w-4xl mx-auto grid grid-cols-[1.22fr_1fr_1fr_1fr_1fr] items-stretch">
          {/* Stupac 1: Vrsta ribe */}
          <div className="py-2 pr-1 flex flex-col justify-center">
            <span className="text-[11px] sm:text-xs font-black text-slate-300 uppercase tracking-tight">
              Vrsta ribe
            </span>
            <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium">
              + zbroj vrste
            </span>
          </div>

          {/* Stupci 2-5: Sikac, Krasni, Domo, Mališa (UVIJEK VIDLJIVA IMENA) */}
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

                {/* Ukupni zbroj svih riba ispod imena osobe u zaglavlju */}
                <span
                  className={`mt-0.5 text-[10px] sm:text-xs font-mono font-bold tabular-nums leading-none ${
                    isMyColumn ? 'text-emerald-400' : 'text-cyan-300'
                  }`}
                >
                  Σ {totalCaught}
                </span>

                {/* Oznaka "TVOJ DIO" za vlasnika stupca */}
                {isMyColumn && (
                  <span className="text-[8px] sm:text-[9px] font-black text-emerald-400 uppercase tracking-wider leading-none mt-0.5">
                    TVOJ DIO
                  </span>
                )}

                {/* U Admin modu: mogućnost oslobađanja/resetiranja uređaja vezanog za ime */}
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

      {/* 3. VERTIKALNO SCROLLABILNO TIJELO TABLICE (Sve vrste riba i svi ribolovci stanu u ekran) */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-1.5 sm:px-5 divide-y divide-slate-800/80">
        <div className="max-w-4xl mx-auto divide-y divide-slate-800/80">
          {FISH_SPECIES.map((fish, rowIdx) => {
            const speciesSum = totalsBySpecies[fish.id] || 0;
            const isEven = rowIdx % 2 === 0;

            return (
              <div
                key={fish.id}
                className={`grid grid-cols-[1.22fr_1fr_1fr_1fr_1fr] items-stretch transition-colors ${
                  isEven ? 'bg-slate-950' : 'bg-slate-900/40'
                }`}
              >
                {/* Lijevi stupac: Naziv vrste ribe + Ukupan zbroj te vrste */}
                <div className="py-2.5 sm:py-3.5 pr-1 flex flex-col justify-center min-w-0">
                  <span className="text-xs sm:text-base font-black text-white leading-tight truncate">
                    {fish.name}
                  </span>
                  <span className="text-[10px] sm:text-xs font-mono tabular-nums text-slate-400 mt-0.5">
                    Ukupno: <strong className="text-slate-200">{speciesSum}</strong>
                  </span>
                </div>

                {/* 4 stupca za ribolovce: Sikac, Krasni, Domo, Mališa */}
                {ANGLERS.map(angler => {
                  const count = stats.counts?.[angler.id]?.[fish.id] || 0;
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
                        } else {
                          setActiveCell({ anglerId: angler.id, speciesId: fish.id });
                          setCustomInputAmount('1');
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
                      {/* Trenutni ukupni broj ulovljene ribe ove vrste za ovog ribolovca */}
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

                      {/* Ako je uključen mod "Upiši ulov s izlaska" za vlastiti stupac */}
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
                        /* Standardni gumb "+ Dodaj" unutar vlastitog stupca */
                        <div className="mt-1 flex items-center justify-center gap-1">
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[9px] sm:text-[10px] font-bold text-emerald-300">
                            <Plus className="w-2.5 h-2.5" />
                            <span>Dodaj</span>
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
      </div>

      {/* 4. SKOČNA TRAKA ZA UNOS KOLIČINE KADA KORISNIK KLIKNE NA VRSTU RIBE U SVOM STUPCU */}
      {activeCell && !isBatchEntryMode && (
        <div className="bg-slate-900 border-t-2 border-emerald-500/60 px-3 py-2.5 shrink-0 z-30 shadow-2xl">
          <div className="max-w-4xl mx-auto flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs sm:text-sm font-bold text-white">
                <span className="text-emerald-400 font-black">
                  {ANGLERS.find(a => a.id === activeCell.anglerId)?.name}
                </span>
                {' · '}
                <span>
                  Dodaj ulov za vrstu:{' '}
                  <strong className="text-amber-300">
                    {FISH_SPECIES.find(f => f.id === activeCell.speciesId)?.name}
                  </strong>
                </span>
                <span className="text-slate-400 text-xs ml-1.5 font-mono tabular-nums">
                  (Trenutno: {stats.counts[activeCell.anglerId][activeCell.speciesId]})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveCell(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-1.5 flex-wrap">
              {/* Brzi gumbi +1, +2, +3, +5 */}
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

              {/* Ručni upis bilo kojeg broja komada + gumb za ispravak (-1) */}
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

                {/* Gumb -1 ako je korisnik slučajno upisao previše */}
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

      {/* Ladica s dnevnikom zadnjih upisanih ulova */}
      {showHistoryDrawer && (
        <div className="bg-slate-900 border-t border-slate-700 max-h-48 overflow-y-auto px-3 py-2.5 shrink-0 z-30">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black text-cyan-300 uppercase tracking-wider">
                Zadnji upisani ulovi
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
              <div className="space-y-1">
                {stats.history.slice(0, 15).map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60"
                  >
                    <div>
                      <strong className="text-white">{item.anglerName}</strong>
                      <span className="text-slate-400"> · {item.speciesName} </span>
                      <span
                        className={`font-mono font-black ${
                          item.delta > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {item.delta > 0 ? `+${item.delta}` : item.delta}
                      </span>
                      <span className="text-slate-500 font-mono text-[11px] ml-1">
                        (ukupno: {item.newTotal})
                      </span>
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

      {/* 5. FIKSNI DONJI RED S UKUPNIM ZBROJEM SVIH ULOVA PO OSOBI (UVIJEK VIDLJIV NA DNU) */}
      <div className="bg-slate-900 border-t-2 border-slate-700 px-1.5 sm:px-5 pb-[calc(0.4rem+env(safe-area-inset-bottom,0px))] pt-1.5 shrink-0 z-20">
        <div className="max-w-4xl mx-auto grid grid-cols-[1.22fr_1fr_1fr_1fr_1fr] items-center">
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
