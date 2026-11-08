import React, { useState } from 'react';
import { 
  Rocket, 
  Download, 
  Clock, 
  X, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck,
  Zap,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import { 
  AppVersionInfo, 
  CURRENT_APP_VERSION, 
  startApkDownload, 
  dismissUpdateFor24h,
  applyLiveWebUpdate 
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
  const [applyStatus, setApplyStatus] = useState<string | null>(null);

  if (!isOpen || !updateInfo) return null;

  const isLiveWeb = updateInfo.updateType !== 'apk';

  const handleApplyLive = async () => {
    setIsApplying(true);
    setApplyStatus('Preuzimanje najnovijeg web koda...');
    
    setTimeout(() => {
      setApplyStatus('Osvježavanje predmemorije i sinkronizacija...');
    }, 600);

    setTimeout(async () => {
      setApplyStatus('Aktivacija najnovije verzije...');
      await applyLiveWebUpdate(updateInfo.version);
    }, 1200);
  };

  const handleDownloadApk = () => {
    startApkDownload(updateInfo.apkUrl);
    onClose();
  };

  const handleRemindLater = () => {
    dismissUpdateFor24h(updateInfo.version);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-slate-900 border border-cyan-500/50 rounded-3xl p-5 sm:p-7 max-w-md w-full shadow-2xl relative text-white space-y-4">
        
        {/* Gumb za zatvaranje */}
        {!updateInfo.isCritical && !isApplying && (
          <button
            onClick={handleRemindLater}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800/80 cursor-pointer transition-colors"
            title="Zatvori"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Zaglavlje s ikonom */}
        <div className="flex items-center space-x-3.5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-slate-950 shadow-lg shrink-0 ${
            isLiveWeb 
              ? 'bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 shadow-teal-500/20' 
              : 'bg-gradient-to-tr from-cyan-600 to-teal-400 shadow-cyan-500/20'
          }`}>
            {isLiveWeb ? (
              <Zap className="w-6 h-6 animate-pulse text-slate-950 fill-current" />
            ) : (
              <Rocket className="w-6 h-6 animate-pulse" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                isLiveWeb
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                  : 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
              }`}>
                {isLiveWeb ? '⚡ Live Web Ažuriranje' : 'Novo APK Ažuriranje'}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {updateInfo.releaseDate}
              </span>
            </div>
            <h2 className="text-lg font-black text-white leading-tight mt-0.5">
              {isLiveWeb ? 'Dostupna je nova Live verzija!' : 'Dostupna je nova verzija!'}
            </h2>
          </div>
        </div>

        {/* Usporedba verzija */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-around text-center">
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Instalirano</span>
            <span className="font-mono text-xs font-bold text-slate-300">v{CURRENT_APP_VERSION}</span>
          </div>
          <div className="text-cyan-400 font-black text-base">➔</div>
          <div>
            <span className="text-[10px] text-emerald-400 block font-semibold uppercase">Najnovije</span>
            <span className="font-mono text-sm font-black text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-lg border border-emerald-500/40">
              v{updateInfo.version}
            </span>
          </div>
        </div>

        {/* Što je novo */}
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Što donosi ova verzija:</span>
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
              <p className="text-slate-400 italic">Poboljšanja performansi i točnosti vodostaja.</p>
            )}
          </div>
        </div>

        {/* Live Web prednosti kartica */}
        {isLiveWeb && (
          <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-3 space-y-1 text-xs text-emerald-200">
            <div className="flex items-center gap-2 font-bold text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Glatko ažuriranje bez preuzimanja datoteka</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-snug">
              Nema Google Play Protect upozorenja i nema ručnih postavki. Aplikacija se automatski sinkronizira s poslužiteljem.
            </p>
          </div>
        )}

        {/* Gumbi za akciju */}
        <div className="space-y-2 pt-1">
          {isLiveWeb ? (
            <>
              <button
                onClick={handleApplyLive}
                disabled={isApplying}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-sm tracking-wide transition-all shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-75"
              >
                {isApplying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    <span>{applyStatus || 'Ažuriranje u tijeku...'}</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    <span>Primijeni Live Web ažuriranje odmah</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleDownloadApk}
                  className="text-[10.5px] text-slate-400 hover:text-cyan-300 underline underline-offset-2 transition-colors cursor-pointer"
                >
                  Ili preuzmi APK datoteku za ručnu instalaciju
                </button>

                {!updateInfo.isCritical && !isApplying && (
                  <button
                    onClick={handleRemindLater}
                    className="text-[10.5px] text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Clock className="w-3 h-3" />
                    <span>Podsjeti me kasnije</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={handleDownloadApk}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-sm tracking-wide transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Download className="w-4 h-4" />
                <span>Preuzmi APK instalacijsku datoteku</span>
              </button>

              {!updateInfo.isCritical && (
                <button
                  onClick={handleRemindLater}
                  className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Podsjeti me sutra</span>
                </button>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
};
