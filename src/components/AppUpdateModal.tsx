import React from 'react';
import { 
  Rocket, 
  Download, 
  Clock, 
  X, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck 
} from 'lucide-react';
import { 
  AppVersionInfo, 
  CURRENT_APP_VERSION, 
  startApkDownload, 
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
  if (!isOpen || !updateInfo) return null;

  const handleDownload = () => {
    startApkDownload(updateInfo.apkUrl);
    onClose();
  };

  const handleRemindLater = () => {
    dismissUpdateFor24h(updateInfo.version);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-slate-900 border border-cyan-500/50 rounded-3xl p-5 sm:p-7 max-w-md w-full shadow-2xl relative text-white space-y-5">
        
        {/* Gumb za zatvaranje */}
        {!updateInfo.isCritical && (
          <button
            onClick={handleRemindLater}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800/80 cursor-pointer transition-colors"
            title="Zatvori"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Zaglavlje s ikonom rakete */}
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-teal-400 flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/20 shrink-0">
            <Rocket className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40 uppercase tracking-wider">
                Novo ažuriranje
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {updateInfo.releaseDate}
              </span>
            </div>
            <h2 className="text-lg font-black text-white leading-tight mt-0.5">
              Dostupna je nova verzija!
            </h2>
          </div>
        </div>

        {/* Usporedba verzija */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-around text-center">
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Instalirano</span>
            <span className="font-mono text-sm font-bold text-slate-300">v{CURRENT_APP_VERSION}</span>
          </div>
          <div className="text-cyan-400 font-black text-lg">➔</div>
          <div>
            <span className="text-[10px] text-cyan-400 block font-semibold uppercase">Najnovije</span>
            <span className="font-mono text-base font-black text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded-lg border border-cyan-500/30">
              v{updateInfo.version}
            </span>
          </div>
        </div>

        {/* Što je novo */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Što donosi ova verzija:</span>
          </span>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 max-h-40 overflow-y-auto space-y-1.5 text-xs text-slate-300">
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

        {/* Napomena o licenci */}
        <div className="flex items-center gap-2 px-3 py-2 bg-teal-950/30 border border-teal-500/30 rounded-xl text-[11px] text-teal-300">
          <ShieldCheck className="w-4 h-4 shrink-0 text-teal-400" />
          <span>Aktivacijski ključ i podaci ostaju trajno sačuvani nakon ažuriranja.</span>
        </div>

        {/* Gumbi za akciju */}
        <div className="space-y-2 pt-1">
          <button
            onClick={handleDownload}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-sm tracking-wide transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Download className="w-4 h-4" />
            <span>Preuzmi i ažuriraj odmah</span>
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

          <p className="text-[10px] text-slate-400 text-center leading-snug pt-1">
            ℹ️ Nakon preuzimanja dodirnite preuzetu datoteku. Ako Android ponudi opciju, odaberite <em>"Dozvoli iz ovog izvora"</em> i <em>"Ipak instaliraj"</em>.
          </p>
        </div>

      </div>
    </div>
  );
};
