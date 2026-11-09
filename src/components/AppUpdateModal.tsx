import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  X, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck,
  RefreshCw,
  ChevronLeft
} from 'lucide-react';
import { 
  AppVersionInfo, 
  getCurrentAppVersion, 
  applyLiveWebUpdate, 
  dismissUpdateFor24h
} from '../services/updateService';

interface AppUpdateModalProps {
  updateInfo: AppVersionInfo | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({
  updateInfo,
  isOpen,
  onClose
}) => {
  const [isApplying, setIsApplying] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [installedVer, setInstalledVer] = useState<string>(() => getCurrentAppVersion());

  useEffect(() => {
    if (isOpen && updateInfo) {
      setInstalledVer(getCurrentAppVersion());
      setIsApplying(true);
      setIsCompleted(false);

      // Automatski odmah primijeni Live Web ažuriranje po otvaranju
      const timer = setTimeout(async () => {
        await applyLiveWebUpdate(updateInfo.version, updateInfo.changelog);
        setIsApplying(false);
        setIsCompleted(true);
        setInstalledVer(updateInfo.version);
      }, 900);

      return () => clearTimeout(timer);
    }
  }, [isOpen, updateInfo]);

  if (!isOpen || !updateInfo) return null;

  const handleApplyNow = async () => {
    setIsApplying(true);
    await applyLiveWebUpdate(updateInfo.version, updateInfo.changelog);
    setIsApplying(false);
    setIsCompleted(true);
    setInstalledVer(updateInfo.version);
    setTimeout(() => {
      onClose();
    }, 800);
  };

  const handleClose = () => {
    dismissUpdateFor24h(updateInfo.version);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-slate-900 border border-cyan-500/50 rounded-3xl p-5 sm:p-7 max-w-md w-full shadow-2xl relative text-white space-y-4">
        
        {/* Gumb za zatvaranje */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800/80 cursor-pointer transition-colors"
          title="Zatvori"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Zaglavlje s ikonom */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleClose}
            className="w-10 h-10 rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-teal-300 hover:text-white border border-slate-700/80 flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
            title="Povratak u Osnovni mod"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>

          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-slate-950 shadow-lg shrink-0 bg-gradient-to-tr from-cyan-500 to-emerald-400 shadow-cyan-500/20">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider bg-emerald-950 text-emerald-300 border-emerald-500/40">
                ⚡ Live Web Ažuriranje (OTA)
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {updateInfo.releaseDate}
              </span>
            </div>
            <h2 className="text-lg font-black text-white leading-tight mt-0.5">
              {isCompleted ? 'Aplikacija je ažurirana!' : 'Automatsko Live Web ažuriranje'}
            </h2>
          </div>
        </div>

        {/* Usporedba verzija */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-around text-center">
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Status</span>
            <span className="font-mono text-xs font-bold text-cyan-300">Live Web OTA</span>
          </div>
          <div className="text-emerald-400 font-black text-base">➔</div>
          <div>
            <span className="text-[10px] text-emerald-400 block font-semibold uppercase">Aktivna verzija</span>
            <span className="font-mono text-sm font-black text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-lg border border-emerald-500/40">
              v{isCompleted ? installedVer : updateInfo.version}
            </span>
          </div>
        </div>

        {/* Što je novo */}
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Novosti u verziji v{updateInfo.version}:</span>
          </span>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 max-h-36 overflow-y-auto space-y-1.5 text-xs text-slate-300">
            {updateInfo.changelog && updateInfo.changelog.length > 0 ? (
              updateInfo.changelog.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{item}</span>
                </div>
              ))
            ) : (
              <p className="text-slate-400 italic">Poboljšanja performansi, stabilnosti i točnosti vodostaja.</p>
            )}
          </div>
        </div>

        {/* Objašnjenje Live Web sustava (bez APK datoteka) */}
        <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-2xl p-3 space-y-1.5 text-xs text-emerald-200">
          <div className="flex items-center gap-2 font-bold text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {isCompleted
                ? '✓ Live Web ažuriranje je uspješno instalirano!'
                : 'Ažuriranje bez preuzimanja APK datoteke'}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-snug">
            Sve promjene i nove pogodnosti primjenjuju se <strong>automatski po pokretanju aplikacije</strong> putem Live Web (OTA) tehnologije, bez preuzimanja APK instalacije i bez sigurnosnih blokada mobitela.
          </p>
        </div>

        {/* Gumb za potvrdu */}
        <div className="space-y-2 pt-1">
          <button
            onClick={isCompleted ? onClose : handleApplyNow}
            disabled={isApplying}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-sm tracking-wide transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-60"
          >
            {isApplying ? (
              <>
                <RefreshCw className="w-4 h-4 text-slate-950 animate-spin" />
                <span>Primjenjujem Live Web ažuriranje...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-slate-950" />
                <span>{isCompleted ? 'Nastavi u aplikaciju (v' + updateInfo.version + ')' : 'Primijeni Live Web ažuriranje odmah'}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
